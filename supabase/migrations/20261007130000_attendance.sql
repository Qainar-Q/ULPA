-- ULPA · Personal attendance log
-- Each student records only exceptions (absent / late / excused / class cancelled)
-- for sessions of their own timetable. Strictly private: only the student can read
-- or change their rows — not even the admin. Additive only.

create table if not exists public.attendance_marks (
  student_id         uuid not null references public.students (id) on delete cascade,
  schedule_entry_id  uuid not null references public.schedule_entries (id) on delete cascade,
  session_date       date not null,
  status             text not null check (status in ('absent', 'late', 'excused', 'cancelled')),
  updated_at         timestamptz not null default now(),
  primary key (student_id, schedule_entry_id, session_date)
);
alter table public.attendance_marks enable row level security;

grant select, delete on public.attendance_marks to authenticated;
grant all on public.attendance_marks to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_marks' and policyname = 'attendance_read_own') then
    create policy attendance_read_own on public.attendance_marks for select to authenticated
      using (student_id = (select private.current_student_id()));
    create policy attendance_remove_own on public.attendance_marks for delete to authenticated
      using (student_id = (select private.current_student_id()));
  end if;
end $$;

-- The only way to write: checks the session belongs to the caller's timetable,
-- the date falls on that weekday and is not in the future.
create or replace function public.set_attendance(p_entry uuid, p_date date, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid := private.current_student_id();
  v_entry public.schedule_entries%rowtype;
  v_today date := (now() at time zone 'Asia/Almaty')::date;
begin
  if v_student is null then
    raise exception 'not a class member' using errcode = '42501';
  end if;
  if p_status not in ('absent', 'late', 'excused', 'cancelled') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  select * into v_entry from public.schedule_entries e where e.id = p_entry;
  if v_entry.id is null
     or not (v_entry.group_no is null or v_entry.group_no = private.current_group())
     or extract(isodow from p_date) <> v_entry.weekday
     or p_date > v_today
     or p_date < v_today - 200 then
    raise exception 'invalid session' using errcode = '22023';
  end if;
  insert into public.attendance_marks (student_id, schedule_entry_id, session_date, status)
  values (v_student, p_entry, p_date, p_status)
  on conflict (student_id, schedule_entry_id, session_date)
  do update set status = excluded.status, updated_at = now();
end;
$$;
grant execute on function public.set_attendance(uuid, date, text) to authenticated;
