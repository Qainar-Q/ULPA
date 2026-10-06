-- ULPA · Weekly schedule, autumn 2026 (provided by the class admin, 2026-10-06)
-- Lectures are shared by both groups (group_no NULL); labs belong to one group.
-- End times were not provided and are left NULL. Safe to re-run.

insert into public.schedule_entries (course_id, weekday, start_time, room, session_type, group_no)
select c.id, v.weekday, v.start_time::time, v.room, v.session_type::public.session_type, v.group_no
from (values
  -- Shared lectures
  ('rocket-dynamics',            1, '10:00', '114',   'lecture', null::smallint),
  ('space-systems-design-1',     1, '13:00', '115',   'lecture', null),
  ('programmable-logic-devices', 1, '14:00', '105',   'lecture', null),
  ('satellite-communication',    2, '10:00', '115',   'lecture', null),
  ('applied-gyroscope-theory',   2, '11:00', '114',   'lecture', null),
  ('aerodynamics',               3, '12:00', '10Б-1', 'lecture', null),
  -- Group 1 labs
  ('aerodynamics',               1, '08:00', '114',   'lab', 1),
  ('aerodynamics',               1, '09:00', '114',   'lab', 1),
  ('rocket-dynamics',            1, '11:00', '114',   'lab', 1),
  ('rocket-dynamics',            1, '12:00', '114',   'lab', 1),
  ('space-systems-design-1',     1, '15:00', '105',   'lab', 1),
  ('programmable-logic-devices', 2, '08:00', '131',   'lab', 1),
  ('programmable-logic-devices', 2, '09:00', '131',   'lab', 1),
  ('space-systems-design-1',     2, '12:00', '105',   'lab', 1),
  ('applied-gyroscope-theory',   3, '10:00', '114',   'lab', 1),
  ('applied-gyroscope-theory',   3, '11:00', '114',   'lab', 1),
  ('satellite-communication',    3, '13:00', '115',   'lab', 1),
  ('satellite-communication',    3, '14:00', '115',   'lab', 1),
  -- Group 2 labs
  ('programmable-logic-devices', 1, '08:00', '115',   'lab', 2),
  ('programmable-logic-devices', 1, '09:00', '115',   'lab', 2),
  ('space-systems-design-1',     1, '11:00', '115',   'lab', 2),
  ('space-systems-design-1',     1, '12:00', '115',   'lab', 2),
  ('satellite-communication',    2, '12:00', '10Б-4', 'lab', 2),
  ('satellite-communication',    2, '13:00', '10Б-4', 'lab', 2),
  ('applied-gyroscope-theory',   3, '08:00', '114',   'lab', 2),
  ('applied-gyroscope-theory',   3, '09:00', '114',   'lab', 2),
  ('aerodynamics',               3, '13:00', '101',   'lab', 2),
  ('aerodynamics',               3, '14:00', '101',   'lab', 2),
  ('rocket-dynamics',            4, '09:00', '510',   'lab', 2),
  ('rocket-dynamics',            4, '10:00', '510',   'lab', 2)
) as v(slug, weekday, start_time, room, session_type, group_no)
join public.courses c on c.slug = v.slug
on conflict (weekday, start_time, coalesce(group_no, 0)) do nothing;
