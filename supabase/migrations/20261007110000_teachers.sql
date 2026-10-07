-- ULPA · Teachers page
-- Teacher cards (photo, position, contacts, office hours) linked to courses.
-- Readable by class members only (contacts are personal data); edited by the admin.
-- Seeded from the teacher names already stored on courses. Additive only.

create table if not exists public.teachers (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null unique check (char_length(btrim(full_name)) between 2 and 120),
  position      text check (position is null or char_length(position) <= 120),
  phone         text check (phone is null or char_length(phone) <= 40),
  email         text check (email is null or char_length(email) <= 120),
  office        text check (office is null or char_length(office) <= 120),
  office_hours  text check (office_hours is null or char_length(office_hours) <= 300),
  note          text check (note is null or char_length(note) <= 1000),
  photo_path    text,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.teachers enable row level security;

create table if not exists public.course_teachers (
  course_id   uuid not null references public.courses (id) on delete cascade,
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  primary key (course_id, teacher_id)
);
create index if not exists course_teachers_teacher_idx on public.course_teachers (teacher_id);
alter table public.course_teachers enable row level security;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'teachers_set_updated_at') then
    create trigger teachers_set_updated_at before update on public.teachers
      for each row execute function private.set_updated_at();
  end if;
end $$;

grant select on public.teachers, public.course_teachers to authenticated;
grant insert (full_name, position, phone, email, office, office_hours, note, photo_path, sort_order) on public.teachers to authenticated;
grant update (full_name, position, phone, email, office, office_hours, note, photo_path, sort_order) on public.teachers to authenticated;
grant delete on public.teachers to authenticated;
grant insert, delete on public.course_teachers to authenticated;
grant all on public.teachers, public.course_teachers to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teachers' and policyname = 'teachers_read_member') then
    create policy teachers_read_member on public.teachers for select to authenticated
      using ((select private.is_class_member()));
    create policy teachers_insert_admin on public.teachers for insert to authenticated
      with check ((select private.is_admin()));
    create policy teachers_update_admin on public.teachers for update to authenticated
      using ((select private.is_admin())) with check ((select private.is_admin()));
    create policy teachers_remove_admin on public.teachers for delete to authenticated
      using ((select private.is_admin()));

    create policy course_teachers_read_member on public.course_teachers for select to authenticated
      using ((select private.is_class_member()));
    create policy course_teachers_insert_admin on public.course_teachers for insert to authenticated
      with check ((select private.is_admin()));
    create policy course_teachers_remove_admin on public.course_teachers for delete to authenticated
      using ((select private.is_admin()));
  end if;
end $$;

-- Seed from the existing course data (no new names invented).
insert into public.teachers (full_name)
select distinct btrim(c.teacher) from public.courses c
 where c.teacher is not null and btrim(c.teacher) <> ''
on conflict (full_name) do nothing;

insert into public.course_teachers (course_id, teacher_id)
select c.id, t.id from public.courses c join public.teachers t on t.full_name = btrim(c.teacher)
on conflict do nothing;

-- Photos: private bucket, class members read, admin writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('teacher-photos', 'teacher-photos', false, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'teacher_photos_read') then
    create policy teacher_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'teacher-photos' and (select private.is_class_member()));
    create policy teacher_photos_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'teacher-photos' and (select private.is_admin()));
    create policy teacher_photos_remove on storage.objects for delete to authenticated
      using (bucket_id = 'teacher-photos' and (select private.is_admin()));
  end if;
end $$;

-- Storage meter now also counts teacher photos.
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
    where o.bucket_id in ('course-photos', 'assignment-files', 'course-materials', 'teacher-photos');
end;
$$;
