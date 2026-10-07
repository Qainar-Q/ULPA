-- ULPA · Study materials library + admin tools
--
-- Materials: any class member may share a file for a course (lecture notes, PDFs, references).
--   group_no NULL → whole class; 1/2 → only that group (+ admins). Students can only share
--   to the whole class or their own group. Uploader or admin may delete.
-- Files: private bucket "course-materials", path "<material id>/<safe name>".
-- Admin tools: edit a student's profile, class dashboard stats, storage meter covers all buckets.

-- ---------------------------------------------------------------------------
-- Materials
-- ---------------------------------------------------------------------------
create table if not exists public.course_materials (
  id             uuid primary key default gen_random_uuid(),
  course_id      uuid not null references public.courses (id) on delete cascade,
  title          text not null check (char_length(btrim(title)) between 1 and 150),
  description    text check (description is null or char_length(description) <= 1000),
  group_no       smallint check (group_no in (1, 2)),
  file_name      text not null check (char_length(file_name) between 1 and 200),
  mime_type      text,
  size_bytes     bigint check (size_bytes is null or size_bytes between 0 and 26214400),
  storage_path   text not null unique,
  uploaded       boolean not null default false,
  uploaded_by    uuid references public.students (id) on delete set null,
  uploader_name  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists course_materials_course_idx on public.course_materials (course_id, created_at desc);

alter table public.course_materials enable row level security;

create or replace function private.prepare_material()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.students%rowtype;
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    select * into v from public.students s where s.user_id = auth.uid();
    if v.id is null then
      raise exception 'not a class member' using errcode = '42501';
    end if;
    new.uploaded_by := v.id;
    new.uploader_name := v.full_name;
    if v.role <> 'admin' and new.group_no is not null then
      new.group_no := v.group_no;   -- students: whole class or own group only
    end if;
  end if;
  new.uploaded := false;
  new.storage_path := new.id::text || '/' ||
    left(regexp_replace(new.file_name, '[^A-Za-z0-9._-]+', '_', 'g'), 100);
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'course_materials_prepare') then
    create trigger course_materials_prepare before insert on public.course_materials
      for each row execute function private.prepare_material();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'course_materials_set_updated_at') then
    create trigger course_materials_set_updated_at before update on public.course_materials
      for each row execute function private.set_updated_at();
  end if;
end $$;

grant select on public.course_materials to authenticated;
grant insert (id, course_id, title, description, group_no, file_name, mime_type, size_bytes) on public.course_materials to authenticated;
grant update (title, description, uploaded) on public.course_materials to authenticated;
grant delete on public.course_materials to authenticated;
grant all on public.course_materials to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'course_materials' and policyname = 'materials_read_visible') then
    create policy materials_read_visible on public.course_materials for select to authenticated
      using ((select private.can_see_group_item(group_no))
             and (uploaded or uploaded_by = (select private.current_student_id()) or (select private.is_admin())));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'course_materials' and policyname = 'materials_insert_member') then
    create policy materials_insert_member on public.course_materials for insert to authenticated
      with check ((select private.is_class_member()) and uploaded_by = (select private.current_student_id()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'course_materials' and policyname = 'materials_update_owner_or_admin') then
    create policy materials_update_owner_or_admin on public.course_materials for update to authenticated
      using (uploaded_by = (select private.current_student_id()) or (select private.is_admin()))
      with check (uploaded_by = (select private.current_student_id()) or (select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'course_materials' and policyname = 'materials_delete_owner_or_admin') then
    create policy materials_delete_owner_or_admin on public.course_materials for delete to authenticated
      using (uploaded_by = (select private.current_student_id()) or (select private.is_admin()));
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-materials', 'course-materials', false, 26214400,
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

create or replace function private.can_read_material_file(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_materials m
    where m.storage_path = p_name
      and private.can_see_group_item(m.group_no)
      and (m.uploaded or m.uploaded_by = private.current_student_id() or private.is_admin())
  );
$$;

create or replace function private.can_write_material_file(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.course_materials m
    where m.storage_path = p_name
      and (m.uploaded_by = private.current_student_id() or private.is_admin())
  );
$$;

grant execute on function private.can_read_material_file(text), private.can_write_material_file(text) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'course_materials_read') then
    create policy course_materials_read on storage.objects for select to authenticated
      using (bucket_id = 'course-materials' and (select private.can_read_material_file(name)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'course_materials_upload') then
    create policy course_materials_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'course-materials' and (select private.can_write_material_file(name)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'course_materials_remove') then
    create policy course_materials_remove on storage.objects for delete to authenticated
      using (bucket_id = 'course-materials' and (select private.can_write_material_file(name)));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage meter: all ULPA buckets share the 1 GB free quota
-- ---------------------------------------------------------------------------
create or replace function public.admin_storage_usage()
returns table (bytes bigint, files bigint, photos bigint)
language plpgsql stable security definer set search_path = '' as $$
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
    where o.bucket_id in ('course-photos', 'assignment-files', 'course-materials');
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: edit a student's profile (role is never changed here)
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_student(
  p_code text,
  p_full_name text,
  p_group_no smallint,
  p_birth_month smallint,
  p_birth_day smallint,
  p_is_monitor boolean
)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_birth_month is not null and p_birth_day is not null
     and p_birth_day > extract(day from (make_date(2024, p_birth_month, 1) + interval '1 month - 1 day')) then
    raise exception 'invalid_birthday' using errcode = '22023';
  end if;
  update public.students
  set full_name   = btrim(p_full_name),
      group_no    = p_group_no,
      birth_month = p_birth_month,
      birth_day   = p_birth_day,
      is_monitor  = coalesce(p_is_monitor, false)
  where code = p_code;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.admin_update_student(text, text, smallint, smallint, smallint, boolean) to authenticated;

-- Admin roster with full profile fields (used by the student editor).
create or replace function public.admin_list_students()
returns table (code text, full_name text, group_no smallint, role public.app_role, is_monitor boolean,
               birth_month smallint, birth_day smallint, activated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.code, s.full_name, s.group_no, s.role, s.is_monitor, s.birth_month, s.birth_day, s.activated_at
    from public.students s order by s.code;
end;
$$;

grant execute on function public.admin_list_students() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: class dashboard
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'students', (select count(*) from public.students),
    'activated', (select count(*) from public.students where activated_at is not null),
    'not_activated', coalesce((
      select jsonb_agg(jsonb_build_object('code', s.code, 'full_name', s.full_name, 'group_no', s.group_no) order by s.code)
      from public.students s where s.activated_at is null), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(row_data order by due_at nulls last)
      from (
        select a.due_at, jsonb_build_object(
          'id', a.id, 'title', a.title, 'course_id', a.course_id, 'due_at', a.due_at, 'group_no', a.group_no,
          'done', (select count(*) from public.assignment_status st where st.assignment_id = a.id),
          'target', (select count(*) from public.students s where a.group_no is null or s.group_no = a.group_no)
        ) as row_data
        from public.assignments a
      ) t), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'course_id', c.id,
        'photos', (select count(*) from public.course_photos p where p.course_id = c.id and p.uploaded),
        'materials', (select count(*) from public.course_materials m where m.course_id = c.id and m.uploaded),
        'assignments', (select count(*) from public.assignments a where a.course_id = c.id)
      ) order by c.sort_order)
      from public.courses c), '[]'::jsonb),
    'announcements', (select count(*) from public.announcements)
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_dashboard() to authenticated;
