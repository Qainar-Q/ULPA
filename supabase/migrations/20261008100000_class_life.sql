-- ULPA · Class life: birthday wishes, shared notes, draws (random groups / lottery),
-- suggestion box, achievement badges, translation usage log.
-- Additive only: new tables, functions and policies. Existing data is not touched.

-- ===========================================================================
-- 0. Class roster (names only) for the draw tool
-- ===========================================================================
create or replace function public.class_roster()
returns table (code text, full_name text, group_no smallint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_class_member() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select s.code, s.full_name, s.group_no from public.students s order by s.code;
end;
$$;
grant execute on function public.class_roster() to authenticated;

create or replace function private.current_student_name()
returns text language sql stable security definer set search_path = '' as $$
  select s.full_name from public.students s where s.user_id = auth.uid();
$$;
grant execute on function private.current_student_name() to authenticated, service_role;

-- ===========================================================================
-- 1. Birthday wishes
-- Classmates write a wish on someone's birthday (that day or the day after).
-- Everyone in the class can read the wall for the current year.
-- ===========================================================================
create table if not exists public.birthday_wishes (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id) on delete cascade,
  wish_year    smallint not null,
  author_id    uuid references public.students (id) on delete set null,
  author_name  text,
  emoji        text not null check (emoji in ('🎂', '🎉', '🎁', '🥳', '💐', '❤️', '⭐', '🎈')),
  body         text not null check (char_length(btrim(body)) between 1 and 300),
  created_at   timestamptz not null default now(),
  unique (student_id, wish_year, author_id)
);
create index if not exists birthday_wishes_to_idx on public.birthday_wishes (student_id, wish_year);
alter table public.birthday_wishes enable row level security;

grant select on public.birthday_wishes to authenticated;
grant all on public.birthday_wishes to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'birthday_wishes' and policyname = 'birthday_wishes_read_member') then
    create policy birthday_wishes_read_member on public.birthday_wishes for select to authenticated
      using ((select private.is_class_member()));
    create policy birthday_wishes_remove_own on public.birthday_wishes for delete to authenticated
      using (author_id = (select private.current_student_id()) or (select private.is_admin()));
  end if;
end $$;
grant delete on public.birthday_wishes to authenticated;

/** Is `p_day` (Almaty date) the birthday of month/day? 29 Feb counts on 28 Feb in other years. */
create or replace function private.is_birthday_on(p_month smallint, p_day smallint, p_date date)
returns boolean language sql immutable set search_path = '' as $$
  select p_month = extract(month from p_date)::int
     and (p_day = extract(day from p_date)::int
          or (p_month = 2 and p_day = 29 and extract(day from p_date)::int = 28
              and extract(day from (p_date + 1))::int = 1));
$$;

create or replace function public.send_birthday_wish(p_code text, p_emoji text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_student_id();
  v_to public.students%rowtype;
  v_today date := (now() at time zone 'Asia/Almaty')::date;
  v_year smallint;
  v_id uuid;
begin
  if v_me is null or not private.is_class_member() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_to from public.students where code = p_code;
  if not found or v_to.birth_month is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_to.id = v_me then
    raise exception 'own_birthday' using errcode = '22023';
  end if;
  -- On the birthday or the day after (for late wishes).
  if private.is_birthday_on(v_to.birth_month, v_to.birth_day, v_today) then
    v_year := extract(year from v_today);
  elsif private.is_birthday_on(v_to.birth_month, v_to.birth_day, v_today - 1) then
    v_year := extract(year from v_today - 1);
  else
    raise exception 'not_birthday' using errcode = '22023';
  end if;

  insert into public.birthday_wishes (student_id, wish_year, author_id, author_name, emoji, body)
  values (v_to.id, v_year, v_me, private.current_student_name(), p_emoji, btrim(p_body))
  on conflict (student_id, wish_year, author_id)
    do update set emoji = excluded.emoji, body = excluded.body, created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.send_birthday_wish(text, text, text) to authenticated;

/** Wishes for a student this birthday (current or just-passed birthday year). */
create or replace function public.birthday_wall(p_code text)
returns table (id uuid, author_name text, emoji text, body text, created_at timestamptz, mine boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := private.current_student_id();
  v_to uuid;
  v_today date := (now() at time zone 'Asia/Almaty')::date;
begin
  if not private.is_class_member() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select s.id into v_to from public.students s where s.code = p_code;
  return query
    select w.id, w.author_name, w.emoji, w.body, w.created_at, w.author_id = v_me
      from public.birthday_wishes w
     where w.student_id = v_to
       and w.wish_year in (extract(year from v_today)::smallint, extract(year from v_today - 1)::smallint)
       and w.created_at > now() - interval '3 days'
     order by w.created_at;
end;
$$;
grant execute on function public.birthday_wall(text) to authenticated;

-- ===========================================================================
-- 2. Shared notes (class wiki per course) with full edit history
-- ===========================================================================
create table if not exists public.notes (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid references public.courses (id) on delete set null,
  title            text not null check (char_length(btrim(title)) between 1 and 120),
  body             text not null default '' check (char_length(body) <= 60000),
  lesson_date      date,
  version          integer not null default 1,
  created_by       uuid references public.students (id) on delete set null,
  creator_name     text,
  updated_by       uuid references public.students (id) on delete set null,
  updated_by_name  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists notes_course_idx on public.notes (course_id, updated_at desc);
create index if not exists notes_updated_idx on public.notes (updated_at desc);
alter table public.notes enable row level security;

create table if not exists public.note_revisions (
  id           bigint generated always as identity primary key,
  note_id      uuid not null references public.notes (id) on delete cascade,
  version      integer not null,
  title        text not null,
  body         text not null,
  edited_by    uuid references public.students (id) on delete set null,
  editor_name  text,
  created_at   timestamptz not null default now(),
  unique (note_id, version)
);
create index if not exists note_revisions_editor_idx on public.note_revisions (edited_by);
alter table public.note_revisions enable row level security;

grant select on public.notes, public.note_revisions to authenticated;
grant delete on public.notes to authenticated;
grant all on public.notes, public.note_revisions to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_read_member') then
    create policy notes_read_member on public.notes for select to authenticated
      using ((select private.is_class_member()));
    create policy notes_remove_creator on public.notes for delete to authenticated
      using (created_by = (select private.current_student_id()) or (select private.is_admin()));
    create policy note_revisions_read_member on public.note_revisions for select to authenticated
      using ((select private.is_class_member()));
  end if;
end $$;

/**
 * Create (p_id null) or edit a note. p_base_version is the version the editor started
 * from; if someone saved in between, 'conflict' is raised so nothing is overwritten.
 */
create or replace function public.save_note(
  p_id uuid, p_course uuid, p_title text, p_body text, p_lesson_date date, p_base_version integer
)
returns table (id uuid, version integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_student_id();
  v_name text := private.current_student_name();
  v_note public.notes%rowtype;
  v_edits integer;
begin
  if v_me is null or not private.is_class_member() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_course is not null and not exists (select 1 from public.courses c where c.id = p_course) then
    raise exception 'bad_course' using errcode = '22023';
  end if;
  select count(*) into v_edits from public.note_revisions r
   where r.edited_by = v_me and r.created_at > now() - interval '1 day';
  if v_edits >= 300 then
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  if p_id is null then
    insert into public.notes (course_id, title, body, lesson_date, created_by, creator_name, updated_by, updated_by_name)
    values (p_course, btrim(p_title), coalesce(p_body, ''), p_lesson_date, v_me, v_name, v_me, v_name)
    returning * into v_note;
  else
    select * into v_note from public.notes n where n.id = p_id for update;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if v_note.version <> p_base_version then
      raise exception 'conflict' using errcode = '40001';
    end if;
    if v_note.title = btrim(p_title) and v_note.body = coalesce(p_body, '')
       and v_note.course_id is not distinct from p_course and v_note.lesson_date is not distinct from p_lesson_date then
      return query select v_note.id, v_note.version;  -- nothing changed
      return;
    end if;
    update public.notes n
       set course_id = p_course, title = btrim(p_title), body = coalesce(p_body, ''), lesson_date = p_lesson_date,
           version = n.version + 1, updated_by = v_me, updated_by_name = v_name, updated_at = now()
     where n.id = p_id
    returning * into v_note;
  end if;

  insert into public.note_revisions (note_id, version, title, body, edited_by, editor_name)
  values (v_note.id, v_note.version, v_note.title, v_note.body, v_me, v_name);
  return query select v_note.id, v_note.version;
end;
$$;
grant execute on function public.save_note(uuid, uuid, text, text, date, integer) to authenticated;

-- ===========================================================================
-- 3. Draws: random groups, lottery, random order. The shuffle happens here on the
-- server and every result is saved and visible to the class, so it is fair.
-- ===========================================================================
create table if not exists public.draws (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(btrim(title)) between 1 and 100),
  mode          text not null check (mode in ('groups', 'pick', 'order')),
  amount        integer not null check (amount between 1 and 80),
  pool          jsonb not null,
  result        jsonb not null,
  created_by    uuid references public.students (id) on delete set null,
  creator_name  text,
  created_at    timestamptz not null default now()
);
create index if not exists draws_created_idx on public.draws (created_at desc);
alter table public.draws enable row level security;
grant select, delete on public.draws to authenticated;
grant all on public.draws to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'draws' and policyname = 'draws_read_member') then
    create policy draws_read_member on public.draws for select to authenticated
      using ((select private.is_class_member()));
    create policy draws_remove_own on public.draws for delete to authenticated
      using (created_by = (select private.current_student_id()) or (select private.is_admin()));
  end if;
end $$;

/**
 * p_mode: 'groups' → split into p_amount groups (sizes differ by at most one);
 *         'pick'   → choose p_amount names; 'order' → shuffle everyone.
 * p_codes: who takes part (student codes; extra free-text names allowed in p_extra).
 */
create or replace function public.make_draw(p_title text, p_mode text, p_amount integer, p_codes text[], p_extra text[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := private.current_student_id();
  v_names text[];
  v_shuffled text[];
  v_result jsonb;
  v_count integer;
  v_id uuid;
begin
  if v_me is null or not private.is_class_member() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select count(*) from public.draws d where d.created_by = v_me and d.created_at > now() - interval '1 day') >= 40 then
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
  if p_mode = 'groups' and (p_amount < 2 or p_amount > v_count) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  if p_mode = 'pick' and (p_amount < 1 or p_amount > v_count) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;

  select array_agg(n order by random()) into v_shuffled from unnest(v_names) n;

  if p_mode = 'groups' then
    select jsonb_agg(g.members order by g.grp) into v_result
      from (
        select (i - 1) % p_amount as grp, jsonb_agg(v_shuffled[i] order by i) as members
          from generate_series(1, v_count) i
         group by 1
      ) g;
  elsif p_mode = 'pick' then
    v_result := to_jsonb(v_shuffled[1:p_amount]);
  elsif p_mode = 'order' then
    v_result := to_jsonb(v_shuffled);
  else
    raise exception 'bad_mode' using errcode = '22023';
  end if;

  insert into public.draws (title, mode, amount, pool, result, created_by, creator_name)
  values (btrim(p_title), p_mode, case when p_mode = 'order' then v_count else p_amount end,
          to_jsonb(v_names), v_result, v_me, private.current_student_name())
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.make_draw(text, text, integer, text[], text[]) to authenticated;

-- ===========================================================================
-- 4. Suggestion box: classmates never see who wrote; only the admin reads them
-- (and can look up the author if needed). The author sees their own + replies.
-- ===========================================================================
create table if not exists public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.students (id) on delete set null,
  category    text not null default 'other' check (category in ('study', 'class', 'site', 'other')),
  body        text not null check (char_length(btrim(body)) between 3 and 2000),
  status      text not null default 'new' check (status in ('new', 'seen', 'done')),
  reply       text check (reply is null or char_length(reply) <= 1000),
  replied_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists suggestions_created_idx on public.suggestions (created_at desc);
create index if not exists suggestions_author_idx on public.suggestions (author_id);
alter table public.suggestions enable row level security;

grant select on public.suggestions to authenticated;
grant insert (category, body) on public.suggestions to authenticated;
grant update (status, reply) on public.suggestions to authenticated;
grant all on public.suggestions to service_role;

create or replace function private.stamp_suggestion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := private.current_student_id();
    new.status := 'new';
    new.reply := null;
    new.replied_at := null;
    new.created_at := now();
    if (select count(*) from public.suggestions s
         where s.author_id = new.author_id and s.created_at > now() - interval '1 day') >= 5 then
      raise exception 'rate_limited' using errcode = '54000';
    end if;
  else
    if new.reply is distinct from old.reply then
      new.replied_at := case when new.reply is null then null else now() end;
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'suggestions_stamp') then
    create trigger suggestions_stamp before insert or update on public.suggestions
      for each row execute function private.stamp_suggestion();
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'suggestions' and policyname = 'suggestions_read_own_or_admin') then
    create policy suggestions_read_own_or_admin on public.suggestions for select to authenticated
      using (author_id = (select private.current_student_id()) or (select private.is_admin()));
    create policy suggestions_insert_member on public.suggestions for insert to authenticated
      with check ((select private.is_class_member()));
    create policy suggestions_update_admin on public.suggestions for update to authenticated
      using ((select private.is_admin())) with check ((select private.is_admin()));
  end if;
end $$;

/** Admin only: who wrote a suggestion (shown only when the admin asks). */
create or replace function public.admin_suggestion_author(p_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_name text;
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select s.full_name || ' (' || s.code || ')' into v_name
    from public.suggestions g join public.students s on s.id = g.author_id
   where g.id = p_id;
  return v_name;
end;
$$;
grant execute on function public.admin_suggestion_author(uuid) to authenticated;

-- ===========================================================================
-- 5. Translation log (Russian photo/text → Kazakh). Written only by the
-- translate Edge Function (service role); each student reads their own history.
-- ===========================================================================
create table if not exists public.translations (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students (id) on delete cascade,
  source_kind    text not null check (source_kind in ('image', 'text')),
  result         text not null check (char_length(result) <= 30000),
  input_tokens   integer,
  output_tokens  integer,
  created_at     timestamptz not null default now()
);
create index if not exists translations_student_idx on public.translations (student_id, created_at desc);
alter table public.translations enable row level security;
grant select, delete on public.translations to authenticated;
grant all on public.translations to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'translations' and policyname = 'translations_own') then
    create policy translations_own on public.translations for select to authenticated
      using (student_id = (select private.current_student_id()));
    create policy translations_remove_own on public.translations for delete to authenticated
      using (student_id = (select private.current_student_id()));
  end if;
end $$;

-- ===========================================================================
-- 6. Achievement badges, computed from what the student has done.
-- Only the student themself sees their badges.
-- ===========================================================================
create or replace function public.my_badges()
returns table (badge text, progress integer, goal integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := private.current_student_id();
  v_streak integer;
begin
  if v_me is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Longest run of consecutive active days.
  select coalesce(max(run), 0) into v_streak from (
    select count(*)::integer as run from (
      select d.day - (row_number() over (order by d.day))::integer as grp
        from public.student_activity_days d where d.student_id = v_me
    ) x group by grp
  ) y;

  return query values
    ('welcome'::text, 1, 1),
    ('photographer', (select count(*)::integer from public.course_photos p where p.uploaded_by = v_me and p.uploaded), 10),
    ('star', (select count(*)::integer from public.photo_reactions r join public.course_photos p on p.id = r.photo_id
               where p.uploaded_by = v_me and r.student_id <> v_me), 30),
    ('talker', (select count(*)::integer from public.photo_comments c where c.student_id = v_me), 20),
    ('voter', (select count(distinct o.poll_id)::integer from public.poll_votes v join public.poll_options o on o.id = v.option_id
                where v.student_id = v_me), 5),
    ('doer', (select count(*)::integer from public.assignment_status s where s.student_id = v_me), 15),
    ('early', (select count(*)::integer from public.assignment_status s join public.assignments a on a.id = s.assignment_id
                where s.student_id = v_me and a.due_at is not null and s.completed_at < a.due_at - interval '1 day'), 5),
    ('streak', v_streak, 7),
    ('regular', (select count(*)::integer from public.student_activity_days d where d.student_id = v_me), 30),
    ('notes', (select count(*)::integer from public.note_revisions r where r.edited_by = v_me), 5),
    ('kind', (select count(*)::integer from public.birthday_wishes w where w.author_id = v_me), 3),
    ('translator', (select count(*)::integer from public.translations t where t.student_id = v_me), 5),
    ('helper', (select count(*)::integer from public.assignments a where a.created_by = v_me)
             + (select count(*)::integer from public.course_materials m where m.uploaded_by = v_me and m.uploaded), 5);
end;
$$;
grant execute on function public.my_badges() to authenticated;

-- ===========================================================================
-- 7. Search also finds notes
-- ===========================================================================
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
$$;
grant execute on function public.search_all(text) to authenticated;

-- ===========================================================================
-- 8. Push: wishes → the birthday person; suggestions → admins;
-- 08:00 Almaty birthday reminder to the class.
-- ===========================================================================
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'birthday_wishes_push') then
    create trigger birthday_wishes_push after insert on public.birthday_wishes
      for each row execute function private.push_after_insert('wish');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'suggestions_push') then
    create trigger suggestions_push after insert on public.suggestions
      for each row execute function private.push_after_insert('suggestion');
  end if;
end $$;

create or replace function private.birthday_push()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.students s
              where s.birth_month is not null
                and private.is_birthday_on(s.birth_month, s.birth_day, (now() at time zone 'Asia/Almaty')::date)) then
    perform private.notify_push('birthdays', gen_random_uuid());
  end if;
end;
$$;

select cron.schedule('ulpa-birthday-morning', '0 3 * * *', 'select private.birthday_push()')
where not exists (select 1 from cron.job where jobname = 'ulpa-birthday-morning');
