-- ULPA · Stage 5 · EASYФОТО (course photos)
--
-- Exactly two photo types, reusing public.session_type: 'lecture' (Дәріс) and 'lab' (Зертханалық жұмыс).
-- Visibility (enforced in the database AND on the files):
--   * lecture photos: group_no NULL → every class member (lectures are shared by both groups)
--   * lab photos:     group_no = uploader's group → only that group (+ admins)
-- The server decides group_no, uploader and file paths; the browser cannot choose them
-- (except an admin, who may file a lab photo under either group).
--
-- Files: private bucket "course-photos", paths "<photo id>/full.jpg" and "<photo id>/thumb.jpg".
-- Storage policies look up the photo row, so file access always matches row access.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.course_photos (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references public.courses (id) on delete cascade,
  photo_type     public.session_type not null,
  group_no       smallint check (group_no in (1, 2)),
  caption        text check (caption is null or char_length(caption) <= 200),
  storage_path   text not null unique,
  thumb_path     text not null unique,
  width          integer check (width is null or width between 1 and 10000),
  height         integer check (height is null or height between 1 and 10000),
  uploaded       boolean not null default false,
  uploaded_by    uuid references public.students (id) on delete set null,
  uploader_name  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint photo_lab_has_group check (photo_type <> 'lab' or group_no is not null),
  constraint photo_lecture_shared check (photo_type <> 'lecture' or group_no is null)
);

create index if not exists course_photos_course_idx on public.course_photos (course_id, created_at desc);
create index if not exists course_photos_recent_idx on public.course_photos (created_at desc);

alter table public.course_photos enable row level security;

-- Server-side defaults: who uploaded, which group, where the files go.
create or replace function private.prepare_course_photo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
begin
  select * into v_student from public.students s where s.user_id = auth.uid();

  if coalesce(auth.role(), '') = 'authenticated' then
    if v_student.id is null then
      raise exception 'not a class member' using errcode = '42501';
    end if;
    new.uploaded_by := v_student.id;
    new.uploader_name := v_student.full_name;

    if new.photo_type = 'lecture' then
      new.group_no := null;
    elsif v_student.role <> 'admin' or new.group_no is null then
      new.group_no := v_student.group_no;   -- students always file labs under their own group
    end if;
  end if;

  new.uploaded := false;
  new.storage_path := new.id::text || '/full.jpg';
  new.thumb_path := new.id::text || '/thumb.jpg';
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'course_photos_prepare') then
    create trigger course_photos_prepare before insert on public.course_photos
      for each row execute function private.prepare_course_photo();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'course_photos_set_updated_at') then
    create trigger course_photos_set_updated_at before update on public.course_photos
      for each row execute function private.set_updated_at();
  end if;
end $$;

-- Privileges: browsers may only send these columns.
grant select on public.course_photos to authenticated;
grant insert (id, course_id, photo_type, group_no, caption, width, height) on public.course_photos to authenticated;
grant update (caption, uploaded) on public.course_photos to authenticated;
grant delete on public.course_photos to authenticated;
grant all on public.course_photos to service_role;

-- Can the current user see this photo row?
create or replace function private.can_see_photo(p_group smallint, p_uploaded boolean, p_uploaded_by uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_class_member()
     and (p_uploaded or p_uploaded_by = private.current_student_id() or private.is_admin())
     and (p_group is null or p_group = private.current_group() or private.is_admin());
$$;
grant execute on function private.can_see_photo(smallint, boolean, uuid) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'course_photos' and policyname = 'photos_read_visible') then
    create policy photos_read_visible on public.course_photos for select to authenticated
      using ((select private.can_see_photo(group_no, uploaded, uploaded_by)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'course_photos' and policyname = 'photos_insert_member') then
    create policy photos_insert_member on public.course_photos for insert to authenticated
      with check ((select private.is_class_member()) and uploaded_by = (select private.current_student_id()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'course_photos' and policyname = 'photos_update_owner_or_admin') then
    create policy photos_update_owner_or_admin on public.course_photos for update to authenticated
      using (uploaded_by = (select private.current_student_id()) or (select private.is_admin()))
      with check (uploaded_by = (select private.current_student_id()) or (select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'course_photos' and policyname = 'photos_delete_owner_or_admin') then
    create policy photos_delete_owner_or_admin on public.course_photos for delete to authenticated
      using (uploaded_by = (select private.current_student_id()) or (select private.is_admin()));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage bucket + file policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-photos', 'course-photos', false, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

-- File readable ⇔ its photo row is readable.
create or replace function private.can_read_photo_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_photos p
    where (p.storage_path = p_name or p.thumb_path = p_name)
      and private.can_see_photo(p.group_no, p.uploaded, p.uploaded_by)
  );
$$;

-- File writable/deletable ⇔ caller uploaded the row (or is admin).
create or replace function private.can_write_photo_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_photos p
    where (p.storage_path = p_name or p.thumb_path = p_name)
      and (p.uploaded_by = private.current_student_id() or private.is_admin())
  );
$$;

grant execute on function private.can_read_photo_file(text), private.can_write_photo_file(text) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'course_photos_read') then
    create policy course_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'course-photos' and (select private.can_read_photo_file(name)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'course_photos_upload') then
    create policy course_photos_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'course-photos' and (select private.can_write_photo_file(name)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'course_photos_remove') then
    create policy course_photos_remove on storage.objects for delete to authenticated
      using (bucket_id = 'course-photos' and (select private.can_write_photo_file(name)));
  end if;
end $$;
