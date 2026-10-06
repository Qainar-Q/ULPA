-- ULPA · Class monitors, announcements, birthdays, saved grades

-- ---------------------------------------------------------------------------
-- Class monitors (староста). Not updatable through the API.
-- ---------------------------------------------------------------------------
alter table public.students add column if not exists is_monitor boolean not null default false;

create or replace function private.is_monitor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.students s where s.user_id = auth.uid() and s.is_monitor);
$$;
grant execute on function private.is_monitor() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Birthdays: class members see first name + day/month of everyone (no year stored).
-- ---------------------------------------------------------------------------
create or replace function public.class_birthdays()
returns table (code text, full_name text, birth_month smallint, birth_day smallint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_class_member() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.code, s.full_name, s.birth_month, s.birth_day
    from public.students s
    where s.birth_month is not null
    order by s.birth_month, s.birth_day;
end;
$$;
grant execute on function public.class_birthdays() to authenticated;

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  body         text check (body is null or char_length(body) <= 3000),
  group_no     smallint check (group_no in (1, 2)),
  pinned       boolean not null default false,
  author_id    uuid references public.students (id) on delete set null,
  author_name  text,
  author_role  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists announcements_recent_idx on public.announcements (created_at desc);
alter table public.announcements enable row level security;

create or replace function private.stamp_announcement()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.students%rowtype;
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    select * into v from public.students s where s.user_id = auth.uid();
    if tg_op = 'INSERT' then
      new.author_id := v.id;
      new.author_name := v.full_name;
      new.author_role := case when v.role = 'admin' then 'admin' when v.is_monitor then 'monitor' else 'student' end;
    end if;
    -- Only the admin can pin.
    if v.role <> 'admin' then
      new.pinned := case when tg_op = 'UPDATE' then old.pinned else false end;
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'announcements_stamp') then
    create trigger announcements_stamp before insert or update on public.announcements
      for each row execute function private.stamp_announcement();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'announcements_set_updated_at') then
    create trigger announcements_set_updated_at before update on public.announcements
      for each row execute function private.set_updated_at();
  end if;
end $$;

grant select on public.announcements to authenticated;
grant insert (title, body, group_no, pinned) on public.announcements to authenticated;
grant update (title, body, group_no, pinned) on public.announcements to authenticated;
grant delete on public.announcements to authenticated;
grant all on public.announcements to service_role;

-- Monitors may post to the whole class or their own group only.
create or replace function private.can_post_announcement(p_group smallint)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or (private.is_monitor() and (p_group is null or p_group = private.current_group()));
$$;
grant execute on function private.can_post_announcement(smallint) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'announcements' and policyname = 'announcements_read_visible') then
    create policy announcements_read_visible on public.announcements for select to authenticated
      using ((select private.can_see_group_item(group_no)));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'announcements' and policyname = 'announcements_insert_staff') then
    create policy announcements_insert_staff on public.announcements for insert to authenticated
      with check ((select private.can_post_announcement(group_no)));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'announcements' and policyname = 'announcements_update_author_or_admin') then
    create policy announcements_update_author_or_admin on public.announcements for update to authenticated
      using (author_id = (select private.current_student_id()) or (select private.is_admin()))
      with check ((select private.can_post_announcement(group_no)));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'announcements' and policyname = 'announcements_delete_author_or_admin') then
    create policy announcements_delete_author_or_admin on public.announcements for delete to authenticated
      using (author_id = (select private.current_student_id()) or (select private.is_admin()));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Saved grades (private to each student — nobody else can read them, not even admins)
-- ---------------------------------------------------------------------------
create table if not exists public.student_grades (
  student_id  uuid not null references public.students (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  ab1         numeric(5,2) check (ab1 between 0 and 100),
  ab2         numeric(5,2) check (ab2 between 0 and 100),
  exam        numeric(5,2) check (exam between 0 and 100),
  updated_at  timestamptz not null default now(),
  primary key (student_id, course_id)
);
alter table public.student_grades enable row level security;

create or replace function private.stamp_grade_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    new.student_id := private.current_student_id();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'student_grades_owner') then
    create trigger student_grades_owner before insert or update on public.student_grades
      for each row execute function private.stamp_grade_owner();
  end if;
end $$;

grant select on public.student_grades to authenticated;
grant insert (course_id, ab1, ab2, exam) on public.student_grades to authenticated;
grant update (ab1, ab2, exam) on public.student_grades to authenticated;
grant delete on public.student_grades to authenticated;
grant all on public.student_grades to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'student_grades' and policyname = 'grades_own_select') then
    create policy grades_own_select on public.student_grades for select to authenticated
      using (student_id = (select private.current_student_id()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'student_grades' and policyname = 'grades_own_insert') then
    create policy grades_own_insert on public.student_grades for insert to authenticated
      with check (student_id = (select private.current_student_id()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'student_grades' and policyname = 'grades_own_update') then
    create policy grades_own_update on public.student_grades for update to authenticated
      using (student_id = (select private.current_student_id()))
      with check (student_id = (select private.current_student_id()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'student_grades' and policyname = 'grades_own_delete') then
    create policy grades_own_delete on public.student_grades for delete to authenticated
      using (student_id = (select private.current_student_id()));
  end if;
end $$;
