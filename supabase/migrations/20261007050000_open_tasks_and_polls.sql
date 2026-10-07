-- ULPA · Open assignments + class polls
--
-- 1. Assignments: every class member may post a task for their own group or for
--    both groups. Who may change/remove a task (and its files):
--      the student who posted it · the monitor of that task's group · the admin.
--    Visibility is unchanged (shared → everyone, 1/2 → that group + admin).
-- 2. Polls: same posting/managing rules. One vote per person (or several options
--    when the poll allows multiple choice). Votes are private rows; results come
--    from public.poll_results(), which hides names for anonymous polls.
--
-- Additive only: new helpers, policies altered in place, new tables.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function private.can_post_to_group(p_group smallint)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_class_member()
     and (private.is_admin() or p_group is null or p_group = private.current_group());
$$;

create or replace function private.can_manage_group_item(p_author uuid, p_group smallint)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_class_member() and (
       private.is_admin()
    or (p_author is not null and p_author = private.current_student_id())
    or (private.is_monitor() and p_group is not null and p_group = private.current_group())
  );
$$;

grant execute on function private.can_post_to_group(smallint), private.can_manage_group_item(uuid, smallint)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Assignments
-- ---------------------------------------------------------------------------
alter table public.assignments add column if not exists creator_name text;

create or replace function private.stamp_assignment_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.students%rowtype;
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    select * into v from public.students s where s.user_id = auth.uid();
    new.created_by := v.id;
    new.creator_name := v.full_name;
    -- Guard against accidental floods: 20 new tasks per person per day (admin unlimited).
    if v.role <> 'admin' and (
      select count(*) from public.assignments a
      where a.created_by = v.id and a.created_at > now() - interval '1 day'
    ) >= 20 then
      raise exception 'daily task limit reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

update public.assignments a
   set creator_name = s.full_name
  from public.students s
 where s.id = a.created_by and a.creator_name is null;

create or replace function private.can_manage_assignment(p_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments a
    where a.id = p_assignment and private.can_manage_group_item(a.created_by, a.group_no)
  );
$$;
grant execute on function private.can_manage_assignment(uuid) to authenticated, service_role;

alter policy assignments_admin_insert on public.assignments
  with check ((select private.can_post_to_group(group_no)));
alter policy assignments_admin_update on public.assignments
  using ((select private.can_manage_group_item(created_by, group_no)))
  with check ((select private.can_post_to_group(group_no)));
alter policy assignments_admin_delete on public.assignments
  using ((select private.can_manage_group_item(created_by, group_no)));

alter policy attachments_read_visible on public.assignment_attachments
  using ((select private.can_see_assignment(assignment_id))
         and (uploaded or (select private.can_manage_assignment(assignment_id))));
alter policy attachments_admin_insert on public.assignment_attachments
  with check ((select private.can_manage_assignment(assignment_id)));
alter policy attachments_admin_update on public.assignment_attachments
  using ((select private.can_manage_assignment(assignment_id)))
  with check ((select private.can_manage_assignment(assignment_id)));
alter policy attachments_admin_delete on public.assignment_attachments
  using ((select private.can_manage_assignment(assignment_id)));

create or replace function private.can_write_assignment_file(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignment_attachments f
    where f.storage_path = p_name and private.can_manage_assignment(f.assignment_id)
  );
$$;

-- Clearer names now that these are no longer admin-only.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'assignments' and policyname = 'assignments_admin_insert') then
    alter policy assignments_admin_insert on public.assignments rename to assignments_insert_member;
    alter policy assignments_admin_update on public.assignments rename to assignments_update_manager;
    alter policy assignments_admin_delete on public.assignments rename to assignments_remove_manager;
    alter policy attachments_admin_insert on public.assignment_attachments rename to attachments_insert_manager;
    alter policy attachments_admin_update on public.assignment_attachments rename to attachments_update_manager;
    alter policy attachments_admin_delete on public.assignment_attachments rename to attachments_remove_manager;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Polls
-- ---------------------------------------------------------------------------
create table if not exists public.polls (
  id            uuid primary key default gen_random_uuid(),
  question      text not null check (char_length(btrim(question)) between 1 and 200),
  details       text check (details is null or char_length(details) <= 1000),
  group_no      smallint check (group_no in (1, 2)),
  multiple      boolean not null default false,
  anonymous     boolean not null default true,
  closes_at     timestamptz,
  closed        boolean not null default false,
  created_by    uuid references public.students (id) on delete set null,
  creator_name  text,
  created_at    timestamptz not null default now()
);
create index if not exists polls_recent_idx on public.polls (created_at desc);

create table if not exists public.poll_options (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references public.polls (id) on delete cascade,
  label     text not null check (char_length(btrim(label)) between 1 and 100),
  position  smallint not null default 0
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id);

create table if not exists public.poll_votes (
  poll_id     uuid not null references public.polls (id) on delete cascade,
  option_id   uuid not null references public.poll_options (id) on delete cascade,
  student_id  uuid not null references public.students (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (option_id, student_id)
);
create index if not exists poll_votes_poll_student_idx on public.poll_votes (poll_id, student_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create or replace function private.can_see_poll(p_poll uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.polls p where p.id = p_poll and private.can_see_group_item(p.group_no));
$$;

create or replace function private.can_manage_poll(p_poll uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.polls p where p.id = p_poll and private.can_manage_group_item(p.created_by, p.group_no));
$$;

create or replace function private.poll_is_open(p_poll uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.polls p
    where p.id = p_poll and not p.closed and (p.closes_at is null or p.closes_at > now())
  );
$$;

grant execute on function private.can_see_poll(uuid), private.can_manage_poll(uuid), private.poll_is_open(uuid)
  to authenticated, service_role;

create or replace function private.stamp_poll()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v public.students%rowtype;
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    select * into v from public.students s where s.user_id = auth.uid();
    new.created_by := v.id;
    new.creator_name := v.full_name;
    new.closed := false;
    if v.role <> 'admin' and (
      select count(*) from public.polls p
      where p.created_by = v.id and p.created_at > now() - interval '1 day'
    ) >= 10 then
      raise exception 'daily poll limit reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Options are fixed once anyone has voted (so nobody's vote changes meaning). Max 10.
create or replace function private.check_poll_option()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.poll_votes v where v.poll_id = new.poll_id) then
    raise exception 'poll already has votes' using errcode = 'P0001';
  end if;
  if (select count(*) from public.poll_options o where o.poll_id = new.poll_id) >= 10 then
    raise exception 'too many options' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Server fills in who votes and for which poll; one vote unless multiple choice.
create or replace function private.prepare_poll_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_multiple boolean;
begin
  new.student_id := private.current_student_id();
  select o.poll_id into new.poll_id from public.poll_options o where o.id = new.option_id;
  if new.poll_id is null or new.student_id is null then
    raise exception 'unknown option' using errcode = 'P0001';
  end if;
  if not private.poll_is_open(new.poll_id) then
    raise exception 'poll closed' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext(new.poll_id::text || new.student_id::text));
  select p.multiple into v_multiple from public.polls p where p.id = new.poll_id;
  if not v_multiple and exists (
    select 1 from public.poll_votes v where v.poll_id = new.poll_id and v.student_id = new.student_id
  ) then
    raise exception 'already voted' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'polls_stamp') then
    create trigger polls_stamp before insert on public.polls
      for each row execute function private.stamp_poll();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'poll_options_check') then
    create trigger poll_options_check before insert on public.poll_options
      for each row execute function private.check_poll_option();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'poll_votes_prepare') then
    create trigger poll_votes_prepare before insert on public.poll_votes
      for each row execute function private.prepare_poll_vote();
  end if;
end $$;

grant select on public.polls to authenticated;
grant insert (question, details, group_no, multiple, anonymous, closes_at) on public.polls to authenticated;
grant update (closed, closes_at) on public.polls to authenticated;  -- never "anonymous": cannot be unmasked later
grant delete on public.polls to authenticated;
grant all on public.polls to service_role;

grant select on public.poll_options to authenticated;
grant insert (poll_id, label, position) on public.poll_options to authenticated;
grant all on public.poll_options to service_role;

grant select on public.poll_votes to authenticated;
grant insert (option_id) on public.poll_votes to authenticated;
grant delete on public.poll_votes to authenticated;
grant all on public.poll_votes to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'polls' and policyname = 'polls_read_visible') then
    create policy polls_read_visible on public.polls for select to authenticated
      using ((select private.can_see_group_item(group_no)));
    create policy polls_insert_member on public.polls for insert to authenticated
      with check ((select private.can_post_to_group(group_no)));
    create policy polls_update_manager on public.polls for update to authenticated
      using ((select private.can_manage_group_item(created_by, group_no)))
      with check ((select private.can_manage_group_item(created_by, group_no)));
    create policy polls_remove_manager on public.polls for delete to authenticated
      using ((select private.can_manage_group_item(created_by, group_no)));

    create policy poll_options_read_visible on public.poll_options for select to authenticated
      using ((select private.can_see_poll(poll_id)));
    create policy poll_options_insert_manager on public.poll_options for insert to authenticated
      with check ((select private.can_manage_poll(poll_id)));

    -- Everyone sees only their own votes; totals come from poll_results().
    create policy poll_votes_read_own on public.poll_votes for select to authenticated
      using (student_id = (select private.current_student_id()));
    create policy poll_votes_insert_own on public.poll_votes for insert to authenticated
      with check (student_id = (select private.current_student_id()) and (select private.can_see_poll(poll_id)));
    create policy poll_votes_remove_own_open on public.poll_votes for delete to authenticated
      using (student_id = (select private.current_student_id()) and (select private.poll_is_open(poll_id)));
  end if;
end $$;

-- Tallies for every poll the caller can see. Names only for non-anonymous polls.
create or replace function public.poll_results()
returns table (poll_id uuid, option_id uuid, votes integer, voters text[], total_voters integer)
language sql stable security definer set search_path = '' as $$
  with visible as (
    select p.id, p.anonymous from public.polls p where private.can_see_group_item(p.group_no)
  )
  select o.poll_id,
         o.id,
         count(v.student_id)::integer,
         case when vis.anonymous then null
              else coalesce(array_agg(s.full_name order by s.code) filter (where s.id is not null), '{}') end,
         (select count(distinct v2.student_id)::integer from public.poll_votes v2 where v2.poll_id = o.poll_id)
    from public.poll_options o
    join visible vis on vis.id = o.poll_id
    left join public.poll_votes v on v.option_id = o.id
    left join public.students s on s.id = v.student_id
   group by o.poll_id, o.id, vis.anonymous;
$$;
grant execute on function public.poll_results() to authenticated;
