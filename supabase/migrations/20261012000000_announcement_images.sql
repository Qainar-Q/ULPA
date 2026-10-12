-- ULPA · photos in announcements.
-- Additive only: a private bucket, one table, helper checks, storage policies.
-- Whoever may see an announcement may see its photos; whoever may edit it
-- (its author or the admin) may add or remove photos. Max 6 per announcement.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcement-images', 'announcement-images', false, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

create table if not exists public.announcement_images (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  storage_path text not null unique,
  width integer check (width between 1 and 10000),
  height integer check (height between 1 and 10000),
  position smallint not null default 0,
  uploaded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists announcement_images_announcement on public.announcement_images (announcement_id, position);
alter table public.announcement_images enable row level security;

-- Students only choose these columns; the path is set by the server.
revoke all on public.announcement_images from anon, authenticated;
grant select on public.announcement_images to authenticated;
grant insert (announcement_id, width, height, position) on public.announcement_images to authenticated;
grant update (uploaded) on public.announcement_images to authenticated;
grant delete on public.announcement_images to authenticated;

create or replace function private.can_see_announcement(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.announcements a where a.id = p_id and private.can_see_group_item(a.group_no));
$$;

create or replace function private.can_manage_announcement(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.announcements a
     where a.id = p_id
       and (private.is_admin() or (a.author_id = private.current_student_id() and private.can_post_announcement(a.group_no)))
  );
$$;

create or replace function private.can_read_announcement_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.announcement_images i where i.storage_path = p_name and private.can_see_announcement(i.announcement_id));
$$;

create or replace function private.can_write_announcement_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.announcement_images i where i.storage_path = p_name and private.can_manage_announcement(i.announcement_id));
$$;

-- Server-chosen path, and at most 6 photos per announcement.
create or replace function private.announcement_image_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.id := gen_random_uuid();
  new.storage_path := new.announcement_id::text || '/' || new.id::text || '.jpg';
  new.uploaded := false;
  new.created_at := now();
  perform pg_advisory_xact_lock(hashtext('ulpa-ann-img-' || new.announcement_id::text));
  if (select count(*) from public.announcement_images i where i.announcement_id = new.announcement_id) >= 6 then
    raise exception 'too_many_images' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace trigger announcement_image_before_insert
  before insert on public.announcement_images
  for each row execute function private.announcement_image_before_insert();

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'announcement_images' and policyname = 'ann_images_read') then
    create policy ann_images_read on public.announcement_images for select to authenticated
      using ((select private.can_see_announcement(announcement_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'announcement_images' and policyname = 'ann_images_insert') then
    create policy ann_images_insert on public.announcement_images for insert to authenticated
      with check ((select private.can_manage_announcement(announcement_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'announcement_images' and policyname = 'ann_images_update') then
    create policy ann_images_update on public.announcement_images for update to authenticated
      using ((select private.can_manage_announcement(announcement_id)))
      with check ((select private.can_manage_announcement(announcement_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'announcement_images' and policyname = 'ann_images_remove') then
    create policy ann_images_remove on public.announcement_images for delete to authenticated
      using ((select private.can_manage_announcement(announcement_id)));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'announcement_images_read') then
    create policy announcement_images_read on storage.objects for select to authenticated
      using (bucket_id = 'announcement-images' and (select private.can_read_announcement_file(name)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'announcement_images_upload') then
    create policy announcement_images_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'announcement-images' and (select private.can_write_announcement_file(name)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'announcement_images_remove') then
    create policy announcement_images_remove on storage.objects for delete to authenticated
      using (bucket_id = 'announcement-images' and (select private.can_write_announcement_file(name)));
  end if;
end $$;

-- Storage meter in the admin area counts these files too.
create or replace function public.admin_storage_usage()
returns table(bytes bigint, files bigint, photos bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select
      coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint,
      count(*)::bigint,
      (select count(*) from public.course_photos p where p.uploaded)::bigint
    from storage.objects o
    where o.bucket_id in ('course-photos', 'assignment-files', 'course-materials', 'teacher-photos', 'announcement-images');
end;
$$;
