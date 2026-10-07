-- ULPA · Presence for the admin dashboard
-- While the app is open and in the foreground, it pings about once a minute.
-- Stored per student per day: first/last time seen and the number of active
-- minutes. No page-level tracking. Students are told about this on their profile.
-- Only the admin can read it (via admin_presence); nobody can read the table directly.
-- Additive only.

create table if not exists public.student_activity_days (
  student_id      uuid not null references public.students (id) on delete cascade,
  day             date not null,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  active_minutes  integer not null default 1,
  primary key (student_id, day)
);
alter table public.student_activity_days enable row level security;
grant all on public.student_activity_days to service_role;
-- No grants/policies for authenticated: only the functions below touch it.

create or replace function public.touch_presence()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid := private.current_student_id();
  v_day date := (now() at time zone 'Asia/Almaty')::date;
begin
  if v_student is null then
    return;
  end if;
  insert into public.student_activity_days (student_id, day)
  values (v_student, v_day)
  on conflict (student_id, day) do update
    set active_minutes = public.student_activity_days.active_minutes
                         + case when public.student_activity_days.last_seen < now() - interval '45 seconds' then 1 else 0 end,
        last_seen = case when public.student_activity_days.last_seen < now() - interval '45 seconds'
                         then now() else public.student_activity_days.last_seen end;
end;
$$;
grant execute on function public.touch_presence() to authenticated;

-- Admin only: one row per student with last seen, online flag and recent frequency.
create or replace function public.admin_presence()
returns table (
  code text, full_name text, group_no smallint, activated boolean,
  last_seen timestamptz, online boolean,
  days_7 integer, days_30 integer, minutes_7 integer, minutes_today integer,
  last_14 integer[]
)
language plpgsql stable security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'Asia/Almaty')::date;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.code, s.full_name, s.group_no, s.user_id is not null,
           (select max(a.last_seen) from public.student_activity_days a where a.student_id = s.id),
           coalesce((select max(a.last_seen) from public.student_activity_days a where a.student_id = s.id) > now() - interval '3 minutes', false),
           (select count(*)::integer from public.student_activity_days a where a.student_id = s.id and a.day > v_today - 7),
           (select count(*)::integer from public.student_activity_days a where a.student_id = s.id and a.day > v_today - 30),
           (select coalesce(sum(a.active_minutes), 0)::integer from public.student_activity_days a where a.student_id = s.id and a.day > v_today - 7),
           (select coalesce(sum(a.active_minutes), 0)::integer from public.student_activity_days a where a.student_id = s.id and a.day = v_today),
           array(select coalesce((select a.active_minutes from public.student_activity_days a where a.student_id = s.id and a.day = d::date), 0)
                   from generate_series(v_today - 13, v_today, interval '1 day') as d order by d)
      from public.students s
     order by s.code;
end;
$$;
grant execute on function public.admin_presence() to authenticated;
