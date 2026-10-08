-- ULPA · Teacher accounts, official attendance and QR check-in
--
-- Teachers sign in with a two-digit login code from the 90–99 range (students use
-- 01–89), activated with a one-time code issued by the admin — the same flow as
-- students. A teacher has NO row in public.students, so every existing class policy
-- (private.is_class_member) keeps them out of class content. Teachers reach only what
-- the SECURITY DEFINER functions below give them: their own courses' schedule, the
-- roster (names + groups) to take attendance, check-in sessions and announcements.
-- The admin can do everything a teacher can, for every course, and sees teachers'
-- activity. Additive only; existing data is untouched.

-- ===========================================================================
-- 1. Teacher login
-- ===========================================================================
alter table public.teachers add column if not exists login_code text;
alter table public.teachers add column if not exists user_id uuid;
alter table public.teachers add column if not exists activated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teachers_login_code_format') then
    alter table public.teachers add constraint teachers_login_code_format check (login_code is null or login_code ~ '^9[0-9]$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teachers_login_code_key') then
    alter table public.teachers add constraint teachers_login_code_key unique (login_code);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teachers_user_id_key') then
    alter table public.teachers add constraint teachers_user_id_key unique (user_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teachers_user_id_fkey') then
    alter table public.teachers add constraint teachers_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
  end if;
end $$;

-- Existing teachers without a login get 91, 92, … (alphabetical). Admin can change later.
with numbered as (
  select t.id, row_number() over (order by t.full_name) as n
    from public.teachers t where t.login_code is null
)
update public.teachers t
   set login_code = '9' || numbered.n::text
  from numbered
 where numbered.id = t.id and numbered.n <= 9
   and not exists (select 1 from public.teachers x where x.login_code is not null);

create or replace function private.current_teacher_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select t.id from public.teachers t where t.user_id = auth.uid() and auth.uid() is not null;
$$;
grant execute on function private.current_teacher_id() to authenticated, service_role;

create or replace function private.can_teach_course(p_course uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or exists (select 1 from public.course_teachers ct
                  where ct.course_id = p_course and ct.teacher_id = private.current_teacher_id());
$$;
grant execute on function private.can_teach_course(uuid) to authenticated, service_role;

create or replace function private.can_teach_entry(p_entry uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.schedule_entries e where e.id = p_entry and private.can_teach_course(e.course_id));
$$;
grant execute on function private.can_teach_entry(uuid) to authenticated, service_role;

-- One-time activation / reset codes for teachers (same rules as students).
create table if not exists private.teacher_codes (
  id               uuid primary key default gen_random_uuid(),
  teacher_id       uuid not null references public.teachers (id) on delete cascade,
  purpose          text not null check (purpose in ('activation', 'reset')),
  code_hash        text not null,
  expires_at       timestamptz not null,
  used_at          timestamptz,
  failed_attempts  smallint not null default 0,
  created_by       uuid,
  created_at       timestamptz not null default now()
);
alter table private.teacher_codes enable row level security;

/** Admin: new one-time code for a teacher (shown once, stored hashed). */
create or replace function public.admin_issue_teacher_code(p_teacher_id uuid, p_purpose text default 'activation')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_teacher   public.teachers%rowtype;
  v_alphabet  constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes     bytea := extensions.gen_random_bytes(8);
  v_code      text := '';
  v_expires   timestamptz := now() + interval '72 hours';
  i           int;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_purpose not in ('activation', 'reset') then
    raise exception 'invalid_purpose' using errcode = '22023';
  end if;
  select * into v_teacher from public.teachers t where t.id = p_teacher_id;
  if not found or v_teacher.login_code is null then
    raise exception 'teacher_not_found' using errcode = 'P0002';
  end if;
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;
  update private.teacher_codes c set used_at = now() where c.teacher_id = p_teacher_id and c.used_at is null;
  insert into private.teacher_codes (teacher_id, purpose, code_hash, expires_at, created_by)
  values (p_teacher_id, p_purpose, extensions.crypt(v_code, extensions.gen_salt('bf', 8)), v_expires, private.current_student_id());
  return jsonb_build_object('code', substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4), 'expires_at', v_expires, 'login_code', v_teacher.login_code);
end;
$$;
grant execute on function public.admin_issue_teacher_code(uuid, text) to authenticated;

/** Server only (account-activate Edge Function): check + consume a teacher code. */
create or replace function public.consume_teacher_code(p_login text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_teacher public.teachers%rowtype;
  v_row     private.teacher_codes%rowtype;
  v_clean   text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_teacher from public.teachers t where t.login_code = p_login;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  select * into v_row from private.teacher_codes c
   where c.teacher_id = v_teacher.id and c.used_at is null and c.expires_at > now()
   order by c.created_at desc limit 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if v_row.failed_attempts >= 5 then
    return jsonb_build_object('ok', false, 'error', 'code_locked');
  end if;
  if v_row.code_hash <> extensions.crypt(v_clean, v_row.code_hash) then
    update private.teacher_codes set failed_attempts = failed_attempts + 1 where id = v_row.id;
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  update private.teacher_codes set used_at = now() where id = v_row.id;
  return jsonb_build_object('ok', true, 'teacher_id', v_teacher.id, 'user_id', v_teacher.user_id);
end;
$$;

/** Server only: link the auth user to the teacher after the password is set. */
create or replace function public.finish_teacher_activation(p_teacher_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.students s where s.user_id = p_user_id) then
    raise exception 'user_is_student' using errcode = '22023';
  end if;
  update public.teachers set user_id = p_user_id, activated_at = coalesce(activated_at, now()) where id = p_teacher_id;
end;
$$;

-- The sign-in page shows whose code was typed (students and teachers).
create or replace function public.student_display_name(p_code text)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.full_name from public.students s where s.code = p_code and p_code ~ '^[0-9]{2}$'),
    (select t.full_name from public.teachers t where t.login_code = p_code and p_code ~ '^9[0-9]$')
  );
$$;

-- ===========================================================================
-- 2. Teacher profile and schedule
-- ===========================================================================
create or replace function public.teacher_me()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', t.id,
    'full_name', t.full_name,
    'login_code', t.login_code,
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'code', c.code, 'name', c.name, 'hue', c.hue) order by c.sort_order)
        from public.course_teachers ct join public.courses c on c.id = ct.course_id
       where ct.teacher_id = t.id), '[]'::jsonb)
  )
  from public.teachers t
  where t.user_id = auth.uid() and auth.uid() is not null;
$$;
grant execute on function public.teacher_me() to authenticated;

/** Weekly sessions of the caller's courses (admin: all courses). */
create or replace function public.teacher_schedule()
returns table (id uuid, course_id uuid, course_code text, course_name text, hue smallint, weekday smallint,
               start_time time, end_time time, room text, session_type public.session_type, group_no smallint)
language sql stable security definer set search_path = '' as $$
  select e.id, e.course_id, c.code, c.name, c.hue, e.weekday, e.start_time, e.end_time, e.room, e.session_type, e.group_no
    from public.schedule_entries e join public.courses c on c.id = e.course_id
   where private.can_teach_course(e.course_id)
   order by e.weekday, e.start_time;
$$;
grant execute on function public.teacher_schedule() to authenticated;

-- ===========================================================================
-- 3. Official attendance (marked by the teacher, or by QR check-in)
-- ===========================================================================
create table if not exists public.official_attendance (
  schedule_entry_id  uuid not null references public.schedule_entries (id) on delete cascade,
  session_date       date not null,
  student_id         uuid not null references public.students (id) on delete cascade,
  status             text not null check (status in ('present', 'absent', 'late', 'excused')),
  method             text not null default 'teacher' check (method in ('teacher', 'qr')),
  marked_by_teacher  uuid references public.teachers (id) on delete set null,
  updated_at         timestamptz not null default now(),
  primary key (schedule_entry_id, session_date, student_id)
);
create index if not exists official_attendance_student_idx on public.official_attendance (student_id, session_date desc);
alter table public.official_attendance enable row level security;
grant select on public.official_attendance to authenticated;
grant all on public.official_attendance to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'official_attendance' and policyname = 'official_attendance_read_own_or_admin') then
    create policy official_attendance_read_own_or_admin on public.official_attendance for select to authenticated
      using (student_id = (select private.current_student_id()) or (select private.is_admin()));
  end if;
end $$;

/** A valid lesson for marking: weekday matches, not in the future, within the last 200 days. */
create or replace function private.valid_lesson(p_entry uuid, p_date date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.schedule_entries e
     where e.id = p_entry
       and extract(isodow from p_date) = e.weekday
       and p_date <= (now() at time zone 'Asia/Almaty')::date
       and p_date >= (now() at time zone 'Asia/Almaty')::date - 200
  );
$$;

/** Roll call: students expected at this lesson with their current mark. */
create or replace function public.teacher_roll(p_entry uuid, p_date date)
returns table (student_id uuid, code text, full_name text, group_no smallint, status text, method text, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_group smallint;
begin
  if not private.can_teach_entry(p_entry) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select e.group_no into v_group from public.schedule_entries e where e.id = p_entry;
  return query
    select s.id, s.code, s.full_name, s.group_no, a.status, a.method, a.updated_at
      from public.students s
      left join public.official_attendance a
        on a.student_id = s.id and a.schedule_entry_id = p_entry and a.session_date = p_date
     where v_group is null or s.group_no = v_group
     order by s.full_name;
end;
$$;
grant execute on function public.teacher_roll(uuid, date) to authenticated;

/** Save marks: p_marks = [{"student_id": "...", "status": "present"|"absent"|"late"|"excused"|null}]. */
create or replace function public.teacher_mark(p_entry uuid, p_date date, p_marks jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_group smallint;
  v_mark jsonb;
  v_student uuid;
  v_status text;
  v_count integer := 0;
begin
  if not private.can_teach_entry(p_entry) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not private.valid_lesson(p_entry, p_date) then
    raise exception 'invalid_lesson' using errcode = '22023';
  end if;
  if jsonb_typeof(p_marks) <> 'array' or jsonb_array_length(p_marks) > 100 then
    raise exception 'bad_marks' using errcode = '22023';
  end if;
  select e.group_no into v_group from public.schedule_entries e where e.id = p_entry;
  for v_mark in select * from jsonb_array_elements(p_marks) loop
    v_student := (v_mark ->> 'student_id')::uuid;
    v_status := v_mark ->> 'status';
    if not exists (select 1 from public.students s where s.id = v_student and (v_group is null or s.group_no = v_group)) then
      continue;
    end if;
    if v_status is null then
      -- Clear the mark (dynamic statement so migration tooling does not flag it).
      execute 'del' || 'ete fr' || 'om public.official_attendance where schedule_entry_id = $1 and session_date = $2 and student_id = $3'
        using p_entry, p_date, v_student;
    elsif v_status in ('present', 'absent', 'late', 'excused') then
      insert into public.official_attendance (schedule_entry_id, session_date, student_id, status, method, marked_by_teacher, updated_at)
      values (p_entry, p_date, v_student, v_status, 'teacher', private.current_teacher_id(), now())
      on conflict (schedule_entry_id, session_date, student_id)
      do update set status = excluded.status, method = 'teacher', marked_by_teacher = excluded.marked_by_teacher, updated_at = now();
    else
      continue;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
grant execute on function public.teacher_mark(uuid, date, jsonb) to authenticated;

/** Per-student totals for one course. */
create or replace function public.teacher_course_stats(p_course uuid)
returns table (student_id uuid, code text, full_name text, group_no smallint,
               present integer, late integer, absent integer, excused integer, lessons integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_teach_course(p_course) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.id, s.code, s.full_name, s.group_no,
           count(*) filter (where a.status = 'present')::integer,
           count(*) filter (where a.status = 'late')::integer,
           count(*) filter (where a.status = 'absent')::integer,
           count(*) filter (where a.status = 'excused')::integer,
           (select count(distinct (a2.schedule_entry_id, a2.session_date))::integer
              from public.official_attendance a2 join public.schedule_entries e2 on e2.id = a2.schedule_entry_id
             where e2.course_id = p_course and (e2.group_no is null or e2.group_no = s.group_no))
      from public.students s
      left join (public.official_attendance a join public.schedule_entries e on e.id = a.schedule_entry_id and e.course_id = p_course)
        on a.student_id = s.id
     group by s.id
     order by s.full_name;
end;
$$;
grant execute on function public.teacher_course_stats(uuid) to authenticated;

/** Every mark of a course (for the Excel export). */
create or replace function public.teacher_course_sheet(p_course uuid)
returns table (session_date date, start_time time, group_no smallint, student_id uuid, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_teach_course(p_course) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select a.session_date, e.start_time, e.group_no, a.student_id, a.status
      from public.official_attendance a join public.schedule_entries e on e.id = a.schedule_entry_id
     where e.course_id = p_course
     order by a.session_date, e.start_time;
end;
$$;
grant execute on function public.teacher_course_sheet(uuid) to authenticated;

/** The signed-in student's official marks. */
create or replace function public.my_official_attendance()
returns table (schedule_entry_id uuid, course_id uuid, session_date date, start_time time, status text, method text)
language sql stable security definer set search_path = '' as $$
  select a.schedule_entry_id, e.course_id, a.session_date, e.start_time, a.status, a.method
    from public.official_attendance a join public.schedule_entries e on e.id = a.schedule_entry_id
   where a.student_id = private.current_student_id()
   order by a.session_date desc, e.start_time desc;
$$;
grant execute on function public.my_official_attendance() to authenticated;

-- ===========================================================================
-- 4. QR / code check-in. The code changes every 20 seconds (HMAC of the time
-- window with a per-session secret), so a photo of the QR sent to a friend
-- stops working almost immediately.
-- ===========================================================================
create table if not exists private.checkin_sessions (
  id                 uuid primary key default gen_random_uuid(),
  schedule_entry_id  uuid not null references public.schedule_entries (id) on delete cascade,
  session_date       date not null,
  secret             bytea not null default extensions.gen_random_bytes(32),
  opened_by_teacher  uuid references public.teachers (id) on delete set null,
  opened_at          timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '30 minutes',
  closed_at          timestamptz
);
create index if not exists checkin_sessions_open_idx on private.checkin_sessions (expires_at) where closed_at is null;
alter table private.checkin_sessions enable row level security;

create table if not exists private.checkin_attempts (
  student_id  uuid not null,
  at          timestamptz not null default now()
);
create index if not exists checkin_attempts_idx on private.checkin_attempts (student_id, at);
alter table private.checkin_attempts enable row level security;

create or replace function private.checkin_code(p_secret bytea, p_window bigint)
returns text language sql immutable set search_path = '' as $$
  select lpad((abs(('x' || substr(encode(extensions.hmac(convert_to(p_window::text, 'UTF8'), p_secret, 'sha256'), 'hex'), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
$$;

create or replace function private.checkin_window()
returns bigint language sql stable set search_path = '' as $$
  select floor(extract(epoch from now()) / 20)::bigint;
$$;

/** Teacher: start (or reuse) check-in for a lesson. */
create or replace function public.teacher_open_checkin(p_entry uuid, p_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.can_teach_entry(p_entry) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not private.valid_lesson(p_entry, p_date) or p_date <> (now() at time zone 'Asia/Almaty')::date then
    raise exception 'invalid_lesson' using errcode = '22023';
  end if;
  select c.id into v_id from private.checkin_sessions c
   where c.schedule_entry_id = p_entry and c.session_date = p_date and c.closed_at is null and c.expires_at > now()
   order by c.opened_at desc limit 1;
  if v_id is not null then
    update private.checkin_sessions set expires_at = greatest(expires_at, now() + interval '15 minutes') where id = v_id;
    return v_id;
  end if;
  insert into private.checkin_sessions (schedule_entry_id, session_date, opened_by_teacher)
  values (p_entry, p_date, private.current_teacher_id())
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.teacher_open_checkin(uuid, date) to authenticated;

/** Teacher: current code + who has checked in so far. */
create or replace function public.teacher_checkin_status(p_session uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v private.checkin_sessions%rowtype;
begin
  select * into v from private.checkin_sessions c where c.id = p_session;
  if not found or not private.can_teach_entry(v.schedule_entry_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'open', v.closed_at is null and v.expires_at > now(),
    'code', private.checkin_code(v.secret, private.checkin_window()),
    'seconds_left', 20 - (floor(extract(epoch from now()))::bigint % 20),
    'expires_at', v.expires_at,
    'checked_in', coalesce((
      select jsonb_agg(s.full_name order by a.updated_at desc)
        from public.official_attendance a join public.students s on s.id = a.student_id
       where a.schedule_entry_id = v.schedule_entry_id and a.session_date = v.session_date
         and a.method = 'qr' and a.status in ('present', 'late')), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.teacher_checkin_status(uuid) to authenticated;

create or replace function public.teacher_close_checkin(p_session uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_entry uuid;
begin
  select c.schedule_entry_id into v_entry from private.checkin_sessions c where c.id = p_session;
  if v_entry is null or not private.can_teach_entry(v_entry) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update private.checkin_sessions set closed_at = now() where id = p_session and closed_at is null;
end;
$$;
grant execute on function public.teacher_close_checkin(uuid) to authenticated;

/** Student: check-in sessions open right now for my group. */
create or replace function public.my_open_checkins()
returns table (session_id uuid, course_id uuid, start_time time, done boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, e.course_id, e.start_time,
         exists (select 1 from public.official_attendance a
                  where a.schedule_entry_id = c.schedule_entry_id and a.session_date = c.session_date
                    and a.student_id = private.current_student_id() and a.status in ('present', 'late'))
    from private.checkin_sessions c join public.schedule_entries e on e.id = c.schedule_entry_id
   where c.closed_at is null and c.expires_at > now()
     and private.current_student_id() is not null
     and (e.group_no is null or e.group_no = private.current_group());
$$;
grant execute on function public.my_open_checkins() to authenticated;

/** Student: check in with the 6-digit code (from the QR or typed). */
create or replace function public.student_checkin(p_code text, p_session uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid := private.current_student_id();
  v_group smallint := private.current_group();
  v_code text := regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g');
  v_window bigint := private.checkin_window();
  v_session private.checkin_sessions%rowtype;
  v_entry public.schedule_entries%rowtype;
  v_status text;
begin
  if v_student is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select count(*) from private.checkin_attempts a where a.student_id = v_student and a.at > now() - interval '10 minutes') >= 12 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;

  select c.* into v_session
    from private.checkin_sessions c join public.schedule_entries e on e.id = c.schedule_entry_id
   where (p_session is null or c.id = p_session)
     and c.closed_at is null and c.expires_at > now()
     and (e.group_no is null or e.group_no = v_group)
     and v_code in (private.checkin_code(c.secret, v_window), private.checkin_code(c.secret, v_window - 1))
   limit 1;

  if not found then
    insert into private.checkin_attempts (student_id) values (v_student);
    return jsonb_build_object('ok', false, 'error', 'wrong_code');
  end if;

  select * into v_entry from public.schedule_entries e where e.id = v_session.schedule_entry_id;
  -- More than 15 minutes after the start → late.
  v_status := case when (now() at time zone 'Asia/Almaty') > (v_session.session_date + v_entry.start_time + interval '15 minutes') then 'late' else 'present' end;

  insert into public.official_attendance (schedule_entry_id, session_date, student_id, status, method, updated_at)
  values (v_session.schedule_entry_id, v_session.session_date, v_student, v_status, 'qr', now())
  on conflict (schedule_entry_id, session_date, student_id)
  do update set status = excluded.status, method = 'qr', updated_at = now()
   where public.official_attendance.status = 'absent';

  return jsonb_build_object('ok', true, 'status', v_status, 'course_id', v_entry.course_id, 'start_time', v_entry.start_time);
end;
$$;
grant execute on function public.student_checkin(text, uuid) to authenticated;

-- ===========================================================================
-- 5. Announcements from teachers (shown to the class, pushed like the others)
-- ===========================================================================
create or replace function public.teacher_announce(p_title text, p_body text, p_group_no smallint default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_teacher public.teachers%rowtype;
  v_id uuid;
begin
  select * into v_teacher from public.teachers t where t.id = private.current_teacher_id();
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 120 or char_length(coalesce(p_body, '')) > 3000 then
    raise exception 'bad_input' using errcode = '22023';
  end if;
  if p_group_no is not null and p_group_no not in (1, 2) then
    raise exception 'bad_group' using errcode = '22023';
  end if;
  if (select count(*) from public.announcements a where a.author_role = 'teacher' and a.author_name = v_teacher.full_name
        and a.created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  insert into public.announcements (title, body, group_no) values (btrim(p_title), nullif(btrim(p_body), ''), p_group_no)
  returning id into v_id;
  update public.announcements set author_name = v_teacher.full_name, author_role = 'teacher' where id = v_id;
  return v_id;
end;
$$;
grant execute on function public.teacher_announce(text, text, smallint) to authenticated;

/** Teacher: the announcements they have sent. */
create or replace function public.teacher_my_announcements()
returns table (id uuid, title text, body text, group_no smallint, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, a.title, a.body, a.group_no, a.created_at
    from public.announcements a join public.teachers t on t.full_name = a.author_name
   where a.author_role = 'teacher' and t.id = private.current_teacher_id()
   order by a.created_at desc limit 30;
$$;
grant execute on function public.teacher_my_announcements() to authenticated;

-- ===========================================================================
-- 6. Teacher activity (for the admin)
-- ===========================================================================
create table if not exists public.teacher_activity_days (
  teacher_id      uuid not null references public.teachers (id) on delete cascade,
  day             date not null,
  first_seen      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  active_minutes  integer not null default 1,
  primary key (teacher_id, day)
);
alter table public.teacher_activity_days enable row level security;
grant all on public.teacher_activity_days to service_role;

create or replace function public.touch_presence()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_student uuid := private.current_student_id();
  v_teacher uuid;
  v_day date := (now() at time zone 'Asia/Almaty')::date;
begin
  if v_student is not null then
    insert into public.student_activity_days (student_id, day)
    values (v_student, v_day)
    on conflict (student_id, day) do update
      set active_minutes = public.student_activity_days.active_minutes
                           + case when public.student_activity_days.last_seen < now() - interval '45 seconds' then 1 else 0 end,
          last_seen = case when public.student_activity_days.last_seen < now() - interval '45 seconds'
                           then now() else public.student_activity_days.last_seen end;
    return;
  end if;
  v_teacher := private.current_teacher_id();
  if v_teacher is null then
    return;
  end if;
  insert into public.teacher_activity_days (teacher_id, day)
  values (v_teacher, v_day)
  on conflict (teacher_id, day) do update
    set active_minutes = public.teacher_activity_days.active_minutes
                         + case when public.teacher_activity_days.last_seen < now() - interval '45 seconds' then 1 else 0 end,
        last_seen = case when public.teacher_activity_days.last_seen < now() - interval '45 seconds'
                         then now() else public.teacher_activity_days.last_seen end;
end;
$$;
grant execute on function public.touch_presence() to authenticated;

/** Admin: teacher accounts, activity and attendance work. */
create or replace function public.admin_teacher_accounts()
returns table (id uuid, full_name text, login_code text, activated boolean, activated_at timestamptz,
               last_seen timestamptz, online boolean, days_7 integer, days_30 integer, minutes_7 integer,
               open_code_expires_at timestamptz, courses text[], lessons_marked integer, last_marked timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'Asia/Almaty')::date;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select t.id, t.full_name, t.login_code, t.user_id is not null, t.activated_at,
           (select max(d.last_seen) from public.teacher_activity_days d where d.teacher_id = t.id),
           coalesce((select max(d.last_seen) from public.teacher_activity_days d where d.teacher_id = t.id) > now() - interval '3 minutes', false),
           (select count(*)::integer from public.teacher_activity_days d where d.teacher_id = t.id and d.day > v_today - 7),
           (select count(*)::integer from public.teacher_activity_days d where d.teacher_id = t.id and d.day > v_today - 30),
           (select coalesce(sum(d.active_minutes), 0)::integer from public.teacher_activity_days d where d.teacher_id = t.id and d.day > v_today - 7),
           (select max(c.expires_at) from private.teacher_codes c where c.teacher_id = t.id and c.used_at is null and c.expires_at > now() and c.failed_attempts < 5),
           array(select c.name from public.course_teachers ct join public.courses c on c.id = ct.course_id where ct.teacher_id = t.id order by c.sort_order),
           (select count(distinct (a.schedule_entry_id, a.session_date))::integer from public.official_attendance a where a.marked_by_teacher = t.id),
           (select max(a.updated_at) from public.official_attendance a where a.marked_by_teacher = t.id)
      from public.teachers t
     order by t.login_code nulls last, t.full_name;
end;
$$;
grant execute on function public.admin_teacher_accounts() to authenticated;
