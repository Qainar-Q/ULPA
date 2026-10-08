-- ULPA · small performance + check-in tweaks (additive)
-- 1. Indexes for foreign keys the database advisor flagged (deletes/joins stay fast).
create index if not exists checkin_sessions_entry_idx on private.checkin_sessions (schedule_entry_id, session_date);
create index if not exists teacher_codes_teacher_idx on private.teacher_codes (teacher_id);
create index if not exists official_attendance_marked_by_idx on public.official_attendance (marked_by_teacher);
create index if not exists attendance_marks_entry_idx on public.attendance_marks (schedule_entry_id);
create index if not exists photo_reactions_student_idx on public.photo_reactions (student_id);
create index if not exists photo_comments_student_idx on public.photo_comments (student_id);
create index if not exists poll_votes_student_idx on public.poll_votes (student_id);
create index if not exists student_grades_course_idx on public.student_grades (course_id);
create index if not exists course_photos_uploaded_by_idx on public.course_photos (uploaded_by);
create index if not exists birthday_wishes_author_idx on public.birthday_wishes (author_id);

-- 2. Check-in: also accept the code from the previous 40 s. A student who scans the
-- QR and first has to sign in would otherwise often arrive with an expired code.
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
     and v_code in (private.checkin_code(c.secret, v_window),
                    private.checkin_code(c.secret, v_window - 1),
                    private.checkin_code(c.secret, v_window - 2))
   limit 1;

  if not found then
    insert into private.checkin_attempts (student_id) values (v_student);
    return jsonb_build_object('ok', false, 'error', 'wrong_code');
  end if;

  select * into v_entry from public.schedule_entries e where e.id = v_session.schedule_entry_id;
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
