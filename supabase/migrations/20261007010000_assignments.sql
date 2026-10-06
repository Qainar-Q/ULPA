-- ULPA · Stage 6 · Assignments
--
-- Two separate things (so one student ticking "done" never affects anyone else):
--   assignments           — what the teacher set (admin creates/edits/removes)
--   assignment_status     — one row per (assignment, student) when THAT student marks it done
-- Visibility follows the schedule rules:
--   group_no NULL → both groups ("ортақ"), 1/2 → only that group (+ admins).
-- Attachments: private bucket "assignment-files", path "<assignment id>/<attachment id>-<name>".

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------
create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 150),
  description  text check (description is null or char_length(description) <= 5000),
  due_at       timestamptz,
  group_no     smallint check (group_no in (1, 2)),
  created_by   uuid references public.students (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists assignments_course_idx on public.assignments (course_id);
create index if not exists assignments_due_idx on public.assignments (due_at);

alter table public.assignments enable row level security;

create or replace function private.stamp_assignment_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    new.created_by := private.current_student_id();
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'assignments_stamp_creator') then
    create trigger assignments_stamp_creator before insert on public.assignments
      for each row execute function private.stamp_assignment_creator();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'assignments_set_updated_at') then
    create trigger assignments_set_updated_at before update on public.assignments
      for each row execute function private.set_updated_at();
  end if;
end $$;

grant select on public.assignments to authenticated;
grant insert (course_id, title, description, due_at, group_no) on public.assignments to authenticated;
grant update (course_id, title, description, due_at, group_no) on public.assignments to authenticated;
grant delete on public.assignments to authenticated;
grant all on public.assignments to service_role;

create or replace function private.can_see_group_item(p_group smallint)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_class_member()
     and (p_group is null or p_group = private.current_group() or private.is_admin());
$$;
grant execute on function private.can_see_group_item(smallint) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignments' and policyname = 'assignments_read_visible') then
    create policy assignments_read_visible on public.assignments for select to authenticated
      using ((select private.can_see_group_item(group_no)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignments' and policyname = 'assignments_admin_insert') then
    create policy assignments_admin_insert on public.assignments for insert to authenticated
      with check ((select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignments' and policyname = 'assignments_admin_update') then
    create policy assignments_admin_update on public.assignments for update to authenticated
      using ((select private.is_admin())) with check ((select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignments' and policyname = 'assignments_admin_delete') then
    create policy assignments_admin_delete on public.assignments for delete to authenticated
      using ((select private.is_admin()));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Per-student completion
-- ---------------------------------------------------------------------------
create table if not exists public.assignment_status (
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  student_id     uuid not null references public.students (id) on delete cascade,
  completed_at   timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create index if not exists assignment_status_student_idx on public.assignment_status (student_id);

alter table public.assignment_status enable row level security;

create or replace function private.stamp_status_student()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    new.student_id := private.current_student_id();   -- you can only tick for yourself
  end if;
  new.completed_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'assignment_status_stamp') then
    create trigger assignment_status_stamp before insert on public.assignment_status
      for each row execute function private.stamp_status_student();
  end if;
end $$;

grant select on public.assignment_status to authenticated;
grant insert (assignment_id) on public.assignment_status to authenticated;
grant delete on public.assignment_status to authenticated;
grant all on public.assignment_status to service_role;

create or replace function private.can_see_assignment(p_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments a
    where a.id = p_assignment and private.can_see_group_item(a.group_no)
  );
$$;
grant execute on function private.can_see_assignment(uuid) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignment_status' and policyname = 'status_read_own_or_admin') then
    create policy status_read_own_or_admin on public.assignment_status for select to authenticated
      using (student_id = (select private.current_student_id()) or (select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignment_status' and policyname = 'status_insert_own_visible') then
    create policy status_insert_own_visible on public.assignment_status for insert to authenticated
      with check (student_id = (select private.current_student_id()) and (select private.can_see_assignment(assignment_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignment_status' and policyname = 'status_delete_own') then
    create policy status_delete_own on public.assignment_status for delete to authenticated
      using (student_id = (select private.current_student_id()));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Attachments (admin uploads, visible to whoever can see the assignment)
-- ---------------------------------------------------------------------------
create table if not exists public.assignment_attachments (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments (id) on delete cascade,
  file_name      text not null check (char_length(file_name) between 1 and 200),
  mime_type      text,
  size_bytes     bigint check (size_bytes is null or size_bytes between 0 and 52428800),
  storage_path   text not null unique,
  uploaded       boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists assignment_attachments_assignment_idx on public.assignment_attachments (assignment_id);

alter table public.assignment_attachments enable row level security;

create or replace function private.prepare_attachment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Server decides the storage path; only a safe version of the name is used.
  new.storage_path := new.assignment_id::text || '/' || new.id::text || '-' ||
    left(regexp_replace(new.file_name, '[^A-Za-z0-9._-]+', '_', 'g'), 80);
  new.uploaded := false;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'assignment_attachments_prepare') then
    create trigger assignment_attachments_prepare before insert on public.assignment_attachments
      for each row execute function private.prepare_attachment();
  end if;
end $$;

grant select on public.assignment_attachments to authenticated;
grant insert (id, assignment_id, file_name, mime_type, size_bytes) on public.assignment_attachments to authenticated;
grant update (uploaded) on public.assignment_attachments to authenticated;
grant delete on public.assignment_attachments to authenticated;
grant all on public.assignment_attachments to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignment_attachments' and policyname = 'attachments_read_visible') then
    create policy attachments_read_visible on public.assignment_attachments for select to authenticated
      using ((select private.can_see_assignment(assignment_id)) and (uploaded or (select private.is_admin())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignment_attachments' and policyname = 'attachments_admin_insert') then
    create policy attachments_admin_insert on public.assignment_attachments for insert to authenticated
      with check ((select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignment_attachments' and policyname = 'attachments_admin_update') then
    create policy attachments_admin_update on public.assignment_attachments for update to authenticated
      using ((select private.is_admin())) with check ((select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignment_attachments' and policyname = 'attachments_admin_delete') then
    create policy attachments_admin_delete on public.assignment_attachments for delete to authenticated
      using ((select private.is_admin()));
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assignment-files', 'assignment-files', false, 20971520,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip'
  ]
)
on conflict (id) do nothing;

create or replace function private.can_read_assignment_file(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignment_attachments f
    where f.storage_path = p_name and private.can_see_assignment(f.assignment_id)
  );
$$;

create or replace function private.can_write_assignment_file(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
     and exists (select 1 from public.assignment_attachments f where f.storage_path = p_name);
$$;

grant execute on function private.can_read_assignment_file(text), private.can_write_assignment_file(text) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assignment_files_read') then
    create policy assignment_files_read on storage.objects for select to authenticated
      using (bucket_id = 'assignment-files' and (select private.can_read_assignment_file(name)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assignment_files_upload') then
    create policy assignment_files_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'assignment-files' and (select private.can_write_assignment_file(name)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assignment_files_remove') then
    create policy assignment_files_remove on storage.objects for delete to authenticated
      using (bucket_id = 'assignment-files' and (select private.can_write_assignment_file(name)));
  end if;
end $$;
