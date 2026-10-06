-- ULPA · Login screen name preview
--
-- When a student types "01" on the login page, the page shows "Қайнар" so they can
-- confirm they typed their own code. Returns ONLY the display name — never the
-- group, birthday, role or account state. Unknown codes return NULL.
--
-- Trade-off (accepted by the owner): anyone who opens the login page can look up
-- the first names behind codes 01–18. No other data is exposed.

create or replace function public.student_display_name(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.full_name
  from public.students s
  where s.code = p_code and p_code ~ '^[0-9]{2}$';
$$;

grant execute on function public.student_display_name(text) to anon, authenticated;
