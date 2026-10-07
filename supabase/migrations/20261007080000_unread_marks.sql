-- ULPA · "New" dots
-- Each student has a last-seen time per area. unread_counts() counts items that
-- appeared since then (by someone else, visible to the student). Polls count
-- open polls the student has not voted in yet. Additive only.

create table if not exists public.seen_marks (
  student_id  uuid not null references public.students (id) on delete cascade,
  area        text not null check (area in ('tasks', 'photos', 'announcements', 'polls', 'materials')),
  seen_at     timestamptz not null default now(),
  primary key (student_id, area)
);
alter table public.seen_marks enable row level security;

grant select on public.seen_marks to authenticated;
grant all on public.seen_marks to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'seen_marks' and policyname = 'seen_marks_read_own') then
    create policy seen_marks_read_own on public.seen_marks for select to authenticated
      using (student_id = (select private.current_student_id()));
  end if;
end $$;

-- Only way to write: mark one area as seen for the caller.
create or replace function public.mark_seen(p_area text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_student uuid := private.current_student_id();
begin
  if v_student is null or p_area not in ('tasks', 'photos', 'announcements', 'polls', 'materials') then
    return;
  end if;
  insert into public.seen_marks (student_id, area, seen_at) values (v_student, p_area, now())
  on conflict (student_id, area) do update set seen_at = excluded.seen_at;
end;
$$;
grant execute on function public.mark_seen(text) to authenticated;

create or replace function public.unread_counts()
returns table (area text, unread integer)
language sql stable security definer set search_path = '' as $$
  with me as (
    select private.current_student_id() as id
  ),
  since as (
    select a.area,
           coalesce((select m.seen_at from public.seen_marks m, me where m.student_id = me.id and m.area = a.area),
                    now() - interval '3 days') as at
      from (values ('tasks'), ('photos'), ('announcements'), ('materials')) as a (area)
  )
  select 'tasks', count(*)::integer from public.assignments t, me
   where private.can_see_group_item(t.group_no)
     and t.created_at > (select at from since where area = 'tasks')
     and t.created_by is distinct from me.id
  union all
  select 'photos', count(*)::integer from public.course_photos p, me
   where p.uploaded and private.can_see_photo(p.group_no, p.uploaded, p.uploaded_by)
     and p.created_at > (select at from since where area = 'photos')
     and p.uploaded_by is distinct from me.id
  union all
  select 'announcements', count(*)::integer from public.announcements n, me
   where private.can_see_group_item(n.group_no)
     and n.created_at > (select at from since where area = 'announcements')
     and n.author_id is distinct from me.id
  union all
  select 'materials', count(*)::integer from public.course_materials c, me
   where c.uploaded and private.can_see_group_item(c.group_no)
     and c.created_at > (select at from since where area = 'materials')
     and c.uploaded_by is distinct from me.id
  union all
  select 'polls', count(*)::integer from public.polls q, me
   where private.can_see_group_item(q.group_no)
     and not q.closed and (q.closes_at is null or q.closes_at > now())
     and q.created_by is distinct from me.id
     and not exists (select 1 from public.poll_votes v where v.poll_id = q.id and v.student_id = me.id);
$$;
grant execute on function public.unread_counts() to authenticated;
