-- ULPA · Defence in depth: being signed in is not enough.
-- Only auth users linked to a row in public.students (one of the 18 class members)
-- may read courses or the schedule. Protects against accounts created through an
-- open sign-up endpoint.

create or replace function private.is_class_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.students s where s.user_id = auth.uid());
$$;
grant execute on function private.is_class_member() to authenticated, service_role;

alter policy courses_read_signed_in on public.courses
  using ((select private.is_class_member()));

alter policy schedule_read_own_group on public.schedule_entries
  using (
    (select private.is_class_member())
    and (group_no is null or group_no = (select private.current_group()) or (select private.is_admin()))
  );
