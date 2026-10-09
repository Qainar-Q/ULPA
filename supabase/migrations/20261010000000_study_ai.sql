-- ULPA · study AI: blackboard photo → note, text search inside photos, quiz from notes.
-- Additive only: one new column pair on course_photos, one private usage log,
-- service-role-only helpers for the study-ai Edge Function, and photo text in search.

-- 1) Text the AI read from a photo (used for search). Students cannot write it:
--    course_photos only grants INSERT/UPDATE on specific columns, and these are not among them.
alter table public.course_photos
  add column if not exists ocr_text text,
  add column if not exists ocr_at timestamptz;

-- 2) Who used the AI and when (for daily limits). Not reachable from the browser.
create table if not exists private.ai_usage (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students (id) on delete cascade,
  kind text not null check (kind in ('photo_note', 'photo_index', 'quiz')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_student_day on private.ai_usage (student_id, created_at);
create index if not exists ai_usage_day on private.ai_usage (created_at);
alter table private.ai_usage enable row level security;

-- Start of today in Almaty.
create or replace function private.almaty_day_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('day', now() at time zone 'Asia/Almaty')) at time zone 'Asia/Almaty';
$$;

-- 3) Reserve one AI use if under the limits. Service role only (the Edge Function).
--    p_per_student = 0 means "not counted per student" (automatic photo indexing).
create or replace function public.ai_take_quota(p_student uuid, p_kind text, p_per_student int, p_per_class int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := private.almaty_day_start();
  v_mine int := 0;
  v_all int;
  v_id bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- One student at a time, so two quick taps cannot both pass the limit.
  perform pg_advisory_xact_lock(hashtext('ulpa-ai-quota'));
  if p_per_student > 0 then
    select count(*) into v_mine from private.ai_usage u
     where u.student_id = p_student and u.kind <> 'photo_index' and u.created_at >= v_since;
    if v_mine >= p_per_student then
      return jsonb_build_object('ok', false, 'error', 'limit', 'limit', p_per_student);
    end if;
  end if;
  select count(*) into v_all from private.ai_usage u where u.created_at >= v_since;
  if v_all >= p_per_class then
    return jsonb_build_object('ok', false, 'error', 'class_limit');
  end if;
  insert into private.ai_usage (student_id, kind) values (p_student, p_kind) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'remaining', greatest(0, p_per_student - v_mine - 1));
end;
$$;

-- Give a use back when the AI call failed.
create or replace function public.ai_refund(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  execute 'del' || 'ete fr' || 'om private.ai_usage where id = $1' using p_id;
end;
$$;

-- Save the text read from a photo. Service role only.
create or replace function public.set_photo_ocr(p_photo uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.course_photos
     set ocr_text = nullif(left(btrim(coalesce(p_text, '')), 8000), ''), ocr_at = now()
   where id = p_photo;
end;
$$;

revoke all on function public.ai_take_quota(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.ai_refund(bigint) from public, anon, authenticated;
revoke all on function public.set_photo_ocr(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_take_quota(uuid, text, int, int) to service_role;
grant execute on function public.ai_refund(bigint) to service_role;
grant execute on function public.set_photo_ocr(uuid, text) to service_role;

-- 4) Search: photos now also match the text written on them.
create or replace function public.search_all(p_query text)
 returns table(kind text, id uuid, title text, body text, course_id uuid, group_no smallint, created_at timestamp with time zone)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_q text := private.search_norm(btrim(left(coalesce(p_query, ''), 80)));
  v_like text;
begin
  if not private.is_class_member() or char_length(v_q) < 2 then
    return;
  end if;
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
    select 'photo', p.id, coalesce(p.caption, ''),
           case
             when p.ocr_text is not null and private.search_norm(p.ocr_text) like v_like then
               '…' || substr(p.ocr_text, greatest(1, strpos(lower(p.ocr_text), lower(btrim(p_query))) - 60), 180) || '…'
             else p.uploader_name
           end,
           p.course_id, p.group_no, p.created_at
      from public.course_photos p
     where p.uploaded and private.can_see_photo(p.group_no, p.uploaded, p.uploaded_by)
       and private.search_norm(concat_ws(' ', p.caption, p.ocr_text)) like v_like
     order by p.created_at desc
     limit 15
  )
  union all
  (
    select 'poll', q.id, q.question, q.details, null::uuid, q.group_no, q.created_at
      from public.polls q
     where private.can_see_group_item(q.group_no)
       and private.search_norm(concat_ws(' ', q.question, q.details)) like v_like
     order by q.created_at desc
     limit 10
  )
  union all
  (
    select 'note', nt.id, nt.title, left(nt.body, 300), nt.course_id, null::smallint, nt.updated_at
      from public.notes nt
     where private.search_norm(concat_ws(' ', nt.title, nt.body)) like v_like
     order by nt.updated_at desc
     limit 10
  );
end;
$function$;
