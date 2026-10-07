-- ULPA · Site-wide search
-- One function searches courses, tasks, announcements, materials, teachers, photo
-- captions and polls, returning only what the caller is allowed to see (same rules
-- as the pages). Matching ignores case and Kazakh-specific letters (қ→к, ә→а, ...)
-- so a Russian keyboard finds Kazakh words. Read-only; no table changes.

create or replace function private.search_norm(p_text text)
returns text language sql immutable set search_path = '' as $$
  select translate(lower(coalesce(p_text, '')), 'әіңғүұқөһё', 'аингуукохе');
$$;

create or replace function public.search_all(p_query text)
returns table (kind text, id uuid, title text, body text, course_id uuid, group_no smallint, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := private.search_norm(btrim(left(coalesce(p_query, ''), 80)));
  v_like text;
begin
  if not private.is_class_member() or char_length(v_q) < 2 then
    return;
  end if;
  -- Escape LIKE wildcards typed by the user.
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  (
    select 'course'::text, c.id, c.name, concat_ws(' · ', c.code, c.teacher, c.description), c.id, null::smallint, c.created_at
      from public.courses c
     where private.search_norm(concat_ws(' ', c.name, c.code, c.teacher, c.description)) like v_like
     limit 10
  )
  union all
  (
    select 'task', a.id, a.title, a.description, a.course_id, a.group_no, a.created_at
      from public.assignments a
     where private.can_see_group_item(a.group_no)
       and private.search_norm(concat_ws(' ', a.title, a.description)) like v_like
     order by a.created_at desc
     limit 15
  )
  union all
  (
    select 'announcement', n.id, n.title, n.body, null::uuid, n.group_no, n.created_at
      from public.announcements n
     where private.can_see_group_item(n.group_no)
       and private.search_norm(concat_ws(' ', n.title, n.body, n.author_name)) like v_like
     order by n.created_at desc
     limit 10
  )
  union all
  (
    select 'material', m.id, m.title, concat_ws(' · ', m.description, m.file_name), m.course_id, m.group_no, m.created_at
      from public.course_materials m
     where m.uploaded and private.can_see_group_item(m.group_no)
       and private.search_norm(concat_ws(' ', m.title, m.description, m.file_name, m.uploader_name)) like v_like
     order by m.created_at desc
     limit 15
  )
  union all
  (
    select 'teacher', t.id, t.full_name, concat_ws(' · ', t.position, t.office, t.office_hours), null::uuid, null::smallint, t.created_at
      from public.teachers t
     where private.search_norm(concat_ws(' ', t.full_name, t.position, t.office, t.note)) like v_like
     limit 10
  )
  union all
  (
    select 'photo', p.id, coalesce(p.caption, ''), p.uploader_name, p.course_id, p.group_no, p.created_at
      from public.course_photos p
     where p.uploaded and private.can_see_photo(p.group_no, p.uploaded, p.uploaded_by)
       and p.caption is not null
       and private.search_norm(p.caption) like v_like
     order by p.created_at desc
     limit 10
  )
  union all
  (
    select 'poll', q.id, q.question, q.details, null::uuid, q.group_no, q.created_at
      from public.polls q
     where private.can_see_group_item(q.group_no)
       and private.search_norm(concat_ws(' ', q.question, q.details)) like v_like
     order by q.created_at desc
     limit 10
  );
end;
$$;
grant execute on function public.search_all(text) to authenticated;
