-- ULPA · Campus map marker positions
-- Building markers on the real map start at approximate positions (from the official
-- illustration). The admin drags them onto the right buildings; positions are stored
-- here and everyone sees the corrected map. Read: class members. Write: admin only.
-- Additive only.

create table if not exists public.campus_markers (
  id          text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  lat         double precision not null check (lat between 43.1 and 43.4),
  lng         double precision not null check (lng between 76.7 and 77.1),
  updated_by  uuid references public.students (id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table public.campus_markers enable row level security;

create or replace function private.stamp_campus_marker()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_by := private.current_student_id();
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'campus_markers_stamp') then
    create trigger campus_markers_stamp before insert or update on public.campus_markers
      for each row execute function private.stamp_campus_marker();
  end if;
end $$;

grant select on public.campus_markers to authenticated;
grant insert (id, lat, lng) on public.campus_markers to authenticated;
grant update (lat, lng) on public.campus_markers to authenticated;
grant all on public.campus_markers to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'campus_markers' and policyname = 'campus_markers_read_member') then
    create policy campus_markers_read_member on public.campus_markers for select to authenticated
      using ((select private.is_class_member()));
    create policy campus_markers_insert_admin on public.campus_markers for insert to authenticated
      with check ((select private.is_admin()));
    create policy campus_markers_update_admin on public.campus_markers for update to authenticated
      using ((select private.is_admin())) with check ((select private.is_admin()));
  end if;
end $$;
