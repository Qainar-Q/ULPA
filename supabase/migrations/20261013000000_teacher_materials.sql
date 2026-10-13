-- ULPA · teachers can share files in "Материалдар".
-- Additive: one column, teacher branches in the existing checks, a push on upload.
-- Students' and the admin's rights are unchanged.

alter table public.course_materials
  add column if not exists teacher_id uuid references public.teachers (id) on delete set null;
create index if not exists course_materials_teacher on public.course_materials (teacher_id);

-- Who is uploading: a class member (as before) or a teacher of that course.
create or replace function private.prepare_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.students%rowtype;
  t public.teachers%rowtype;
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    select * into v from public.students s where s.user_id = auth.uid();
    if v.id is not null then
      new.uploaded_by := v.id;
      new.uploader_name := v.full_name;
      new.teacher_id := null;
      if v.role <> 'admin' and new.group_no is not null then
        new.group_no := v.group_no;
      end if;
    else
      select * into t from public.teachers x where x.user_id = auth.uid();
      if t.id is null or not private.can_teach_course(new.course_id) then
        raise exception 'not a class member' using errcode = '42501';
      end if;
      new.uploaded_by := null;
      new.teacher_id := t.id;
      new.uploader_name := t.full_name;
      if new.group_no is not null and new.group_no not in (1, 2) then
        new.group_no := null;
      end if;
    end if;
  end if;
  new.uploaded := false;
  new.storage_path := new.id::text || '/' ||
    left(regexp_replace(new.file_name, '[^A-Za-z0-9._-]+', '_', 'g'), 100);
  return new;
end;
$$;

create or replace function private.can_read_material_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_materials m
    where m.storage_path = p_name
      and (
        (private.can_see_group_item(m.group_no)
          and (m.uploaded or m.uploaded_by = private.current_student_id() or private.is_admin()))
        or (m.teacher_id is not null and m.teacher_id = private.current_teacher_id())
      )
  );
$$;

create or replace function private.can_write_material_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_materials m
    where m.storage_path = p_name
      and (m.uploaded_by = private.current_student_id()
           or private.is_admin()
           or (m.teacher_id is not null and m.teacher_id = private.current_teacher_id()))
  );
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'course_materials' and policyname = 'materials_insert_teacher') then
    create policy materials_insert_teacher on public.course_materials for insert to authenticated
      with check (teacher_id is not null and teacher_id = (select private.current_teacher_id()) and (select private.can_teach_course(course_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'course_materials' and policyname = 'materials_read_teacher') then
    create policy materials_read_teacher on public.course_materials for select to authenticated
      using (teacher_id is not null and teacher_id = (select private.current_teacher_id()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'course_materials' and policyname = 'materials_update_teacher') then
    create policy materials_update_teacher on public.course_materials for update to authenticated
      using (teacher_id is not null and teacher_id = (select private.current_teacher_id()))
      with check (teacher_id = (select private.current_teacher_id()) and (select private.can_teach_course(course_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'course_materials' and policyname = 'materials_delete_teacher') then
    create policy materials_delete_teacher on public.course_materials for delete to authenticated
      using (teacher_id is not null and teacher_id = (select private.current_teacher_id()));
  end if;
end $$;

-- Phone notification to the students when a teacher's file is ready.
create or replace function private.push_teacher_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.teacher_id is not null and new.uploaded and not coalesce(old.uploaded, false) then
    perform private.notify_push('material', new.id);
  end if;
  return null;
end;
$$;

create or replace trigger course_materials_push_teacher
  after update of uploaded on public.course_materials
  for each row execute function private.push_teacher_material();
