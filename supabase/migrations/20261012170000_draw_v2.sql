-- ULPA · Draws, faster and safer
-- 1. draw_v2 answers with the finished draw in one request (make_draw needed a second request to read it back).
-- 2. Each attempt carries a request id, so if a phone loses the answer and tries again, the same draw comes back
--    instead of a second, different one (nobody can "re-roll" by pretending the network failed).
-- 3. Groups can be made by size ("3 people per group") as well as by count.
-- make_draw stays for app versions that are still open on someone's phone.

alter table public.draws add column if not exists request_id uuid;
create unique index if not exists draws_request_idx on public.draws (created_by, request_id) where request_id is not null;
-- The daily limit counts a person's own draws; this also covers the created_by foreign key.
create index if not exists draws_creator_idx on public.draws (created_by, created_at desc);

-- Covering indexes for foreign keys the database advisor listed (cheap; they speed up joins and deletes).
create index if not exists announcements_author_idx on public.announcements (author_id);
create index if not exists assignments_created_by_idx on public.assignments (created_by);
create index if not exists campus_markers_updated_by_idx on public.campus_markers (updated_by);
create index if not exists course_materials_uploaded_by_idx on public.course_materials (uploaded_by);
create index if not exists notes_created_by_idx on public.notes (created_by);
create index if not exists notes_updated_by_idx on public.notes (updated_by);
create index if not exists polls_created_by_idx on public.polls (created_by);

/**
 * p_mode: 'groups' → split into p_amount groups, or into groups of p_per_group people when that is given;
 *         'pick'   → choose p_amount names; 'order' → shuffle everyone.
 * p_request: a random id made by the app for this attempt; repeating it returns the same draw.
 * Returns the saved draw as JSON (same fields the app lists).
 */
create or replace function public.draw_v2(
  p_title text, p_mode text, p_amount integer, p_codes text[], p_extra text[] default '{}',
  p_request uuid default null, p_per_group integer default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_student_id();
  v_names text[];
  v_shuffled text[];
  v_result jsonb;
  v_count integer;
  v_amount integer := p_amount;
  v_row public.draws;
begin
  if v_me is null or not private.is_class_member() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_request is not null then
    select * into v_row from public.draws d where d.created_by = v_me and d.request_id = p_request;
    if found then
      return jsonb_build_object('id', v_row.id, 'title', v_row.title, 'mode', v_row.mode, 'amount', v_row.amount, 'pool', v_row.pool,
        'result', v_row.result, 'created_by', v_row.created_by, 'creator_name', v_row.creator_name, 'created_at', v_row.created_at);
    end if;
  end if;

  if (select count(*) from public.draws d where d.created_by = v_me and d.created_at > now() - interval '1 day') >= 100 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  select coalesce(array_agg(s.full_name order by s.code), '{}') into v_names
    from public.students s where s.code = any (coalesce(p_codes, '{}'));
  select v_names || coalesce(array_agg(btrim(e)), '{}') into v_names
    from unnest(coalesce(p_extra, '{}')) e where char_length(btrim(e)) between 1 and 60;
  v_count := coalesce(array_length(v_names, 1), 0);
  if v_count < 2 or v_count > 80 then
    raise exception 'bad_pool' using errcode = '22023';
  end if;

  if p_mode = 'groups' and p_per_group is not null then
    if p_per_group < 1 then raise exception 'bad_amount' using errcode = '22023'; end if;
    v_amount := ceil(v_count::numeric / p_per_group)::integer;
  end if;
  if p_mode = 'groups' and (v_amount < 2 or v_amount > v_count) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_mode = 'pick' and (v_amount < 1 or v_amount > v_count) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;

  select array_agg(n order by random()) into v_shuffled from unnest(v_names) n;

  if p_mode = 'groups' then
    select jsonb_agg(g.members order by g.grp) into v_result
      from (
        select (i - 1) % v_amount as grp, jsonb_agg(v_shuffled[i] order by i) as members
          from generate_series(1, v_count) i
         group by 1
      ) g;
  elsif p_mode = 'pick' then
    v_result := to_jsonb(v_shuffled[1:v_amount]);
  elsif p_mode = 'order' then
    v_result := to_jsonb(v_shuffled);
  else
    raise exception 'bad_mode' using errcode = '22023';
  end if;

  insert into public.draws (title, mode, amount, pool, result, created_by, creator_name, request_id)
  values (btrim(p_title), p_mode, case when p_mode = 'order' then v_count else v_amount end,
          to_jsonb(v_names), v_result, v_me, private.current_student_name(), p_request)
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'title', v_row.title, 'mode', v_row.mode, 'amount', v_row.amount, 'pool', v_row.pool,
    'result', v_row.result, 'created_by', v_row.created_by, 'creator_name', v_row.creator_name, 'created_at', v_row.created_at);
end;
$$;
revoke all on function public.draw_v2(text, text, integer, text[], text[], uuid, integer) from public, anon;
grant execute on function public.draw_v2(text, text, integer, text[], text[], uuid, integer) to authenticated;
