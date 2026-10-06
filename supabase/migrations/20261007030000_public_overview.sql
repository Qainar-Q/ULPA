-- ULPA · Guest mode overview
-- Anyone (also signed-out visitors) may see HOW MUCH exists — counts only.
-- No names, titles, times, rooms, photos, birthdays or any other content.

create or replace function public.public_overview()
returns table (
  courses bigint,
  weekly_sessions bigint,
  photos bigint,
  assignments bigint,
  announcements bigint,
  students bigint,
  active_students bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.courses),
    (select count(*) from public.schedule_entries),
    (select count(*) from public.course_photos where uploaded),
    (select count(*) from public.assignments),
    (select count(*) from public.announcements),
    (select count(*) from public.students),
    (select count(*) from public.students where activated_at is not null);
$$;

grant execute on function public.public_overview() to anon, authenticated;
