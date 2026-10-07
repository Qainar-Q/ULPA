-- ULPA · EASYФОТО reactions and comments
--
-- Whoever can see a photo can react (fixed emoji set, toggle on/off) and comment.
-- Reactions show who reacted. A comment can be removed by its author, the
-- photo's uploader, the monitor of the photo's group, or the admin.
-- Additive only.

create or replace function private.can_see_photo_id(p_photo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_photos p
    where p.id = p_photo and p.uploaded and private.can_see_photo(p.group_no, p.uploaded, p.uploaded_by)
  );
$$;
grant execute on function private.can_see_photo_id(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------
create table if not exists public.photo_reactions (
  photo_id      uuid not null references public.course_photos (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  student_name  text,
  emoji         text not null check (emoji in ('❤️', '😂', '🔥', '😮', '👏', '👍')),
  created_at    timestamptz not null default now(),
  primary key (photo_id, student_id, emoji)
);
alter table public.photo_reactions enable row level security;

create or replace function private.stamp_photo_reaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.students%rowtype;
begin
  select * into v from public.students s where s.user_id = auth.uid();
  new.student_id := v.id;
  new.student_name := v.full_name;
  new.created_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
create table if not exists public.photo_comments (
  id           uuid primary key default gen_random_uuid(),
  photo_id     uuid not null references public.course_photos (id) on delete cascade,
  student_id   uuid references public.students (id) on delete set null,
  author_name  text,
  body         text not null check (char_length(btrim(body)) between 1 and 500),
  created_at   timestamptz not null default now()
);
create index if not exists photo_comments_photo_idx on public.photo_comments (photo_id, created_at);
alter table public.photo_comments enable row level security;

create or replace function private.stamp_photo_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.students%rowtype;
begin
  select * into v from public.students s where s.user_id = auth.uid();
  new.student_id := v.id;
  new.author_name := v.full_name;
  new.created_at := now();
  if v.role <> 'admin' and (
    select count(*) from public.photo_comments c
    where c.student_id = v.id and c.created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'comment limit reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.can_remove_photo_comment(p_author uuid, p_photo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_photos p
    where p.id = p_photo
      and (private.can_manage_group_item(p_author, p.group_no)
           or (p.uploaded_by is not null and p.uploaded_by = private.current_student_id()))
  );
$$;
grant execute on function private.can_remove_photo_comment(uuid, uuid) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'photo_reactions_stamp') then
    create trigger photo_reactions_stamp before insert on public.photo_reactions
      for each row execute function private.stamp_photo_reaction();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'photo_comments_stamp') then
    create trigger photo_comments_stamp before insert on public.photo_comments
      for each row execute function private.stamp_photo_comment();
  end if;
end $$;

grant select on public.photo_reactions to authenticated;
grant insert (photo_id, emoji) on public.photo_reactions to authenticated;
grant delete on public.photo_reactions to authenticated;
grant all on public.photo_reactions to service_role;

grant select on public.photo_comments to authenticated;
grant insert (photo_id, body) on public.photo_comments to authenticated;
grant delete on public.photo_comments to authenticated;
grant all on public.photo_comments to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'photo_reactions' and policyname = 'photo_reactions_read_visible') then
    create policy photo_reactions_read_visible on public.photo_reactions for select to authenticated
      using ((select private.can_see_photo_id(photo_id)));
    create policy photo_reactions_insert_own on public.photo_reactions for insert to authenticated
      with check (student_id = (select private.current_student_id()) and (select private.can_see_photo_id(photo_id)));
    create policy photo_reactions_remove_own on public.photo_reactions for delete to authenticated
      using (student_id = (select private.current_student_id()));

    create policy photo_comments_read_visible on public.photo_comments for select to authenticated
      using ((select private.can_see_photo_id(photo_id)));
    create policy photo_comments_insert_own on public.photo_comments for insert to authenticated
      with check (student_id = (select private.current_student_id()) and (select private.can_see_photo_id(photo_id)));
    create policy photo_comments_remove_moderated on public.photo_comments for delete to authenticated
      using ((select private.can_remove_photo_comment(student_id, photo_id)));
  end if;
end $$;

-- Counts for the thumbnail grid (only photos the caller can see).
create or replace function public.photo_engagement()
returns table (photo_id uuid, reactions integer, comments integer)
language sql stable security definer set search_path = '' as $$
  select p.id,
         (select count(*)::integer from public.photo_reactions r where r.photo_id = p.id),
         (select count(*)::integer from public.photo_comments c where c.photo_id = p.id)
    from public.course_photos p
   where p.uploaded
     and private.can_see_photo(p.group_no, p.uploaded, p.uploaded_by)
     and (exists (select 1 from public.photo_reactions r where r.photo_id = p.id)
          or exists (select 1 from public.photo_comments c where c.photo_id = p.id));
$$;
grant execute on function public.photo_engagement() to authenticated;
