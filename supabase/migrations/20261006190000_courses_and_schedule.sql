-- ULPA · Stage 4 · Courses and weekly schedule
--
-- Visibility rules (enforced by RLS, not by the UI):
--   * group_no IS NULL  → shared session (both groups attend, e.g. lectures)
--   * group_no = 1 / 2  → only that group (and admins) can see it
--   * every lab MUST belong to exactly one group
-- Times are Almaty local wall-clock times (weekday + time, no time zone math).
--
-- Re-runnable without DROP statements: objects are created only if missing.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'session_type' and typnamespace = 'public'::regnamespace) then
    create type public.session_type as enum ('lecture', 'lab');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  code         text not null check (char_length(code) between 1 and 8),
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  teacher      text check (teacher is null or char_length(teacher) <= 120),
  description  text check (description is null or char_length(description) <= 2000),
  hue          smallint not null default 210 check (hue between 0 and 360),
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.courses enable row level security;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'courses_set_updated_at') then
    create trigger courses_set_updated_at before update on public.courses
      for each row execute function private.set_updated_at();
  end if;
end $$;

grant select on public.courses to authenticated;
grant insert, update, delete on public.courses to authenticated;
grant all on public.courses to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'courses' and policyname = 'courses_read_signed_in') then
    create policy courses_read_signed_in on public.courses
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'courses' and policyname = 'courses_admin_insert') then
    create policy courses_admin_insert on public.courses
      for insert to authenticated with check ((select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'courses' and policyname = 'courses_admin_update') then
    create policy courses_admin_update on public.courses
      for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'courses' and policyname = 'courses_admin_delete') then
    create policy courses_admin_delete on public.courses
      for delete to authenticated using ((select private.is_admin()));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Weekly schedule
-- ---------------------------------------------------------------------------
create table if not exists public.schedule_entries (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  weekday       smallint not null check (weekday between 1 and 7),   -- 1 = Monday (ISO)
  start_time    time not null,
  end_time      time,                                                -- NULL until confirmed
  room          text check (room is null or char_length(room) <= 40),
  session_type  public.session_type not null,
  group_no      smallint check (group_no in (1, 2)),                 -- NULL = both groups
  note          text check (note is null or char_length(note) <= 300),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint schedule_lab_has_group check (session_type <> 'lab' or group_no is not null),
  constraint schedule_end_after_start check (end_time is null or end_time > start_time)
);

-- One slot per group per time (shared sessions use slot 0).
create unique index if not exists schedule_slot_unique
  on public.schedule_entries (weekday, start_time, coalesce(group_no, 0));
create index if not exists schedule_course_idx on public.schedule_entries (course_id);

alter table public.schedule_entries enable row level security;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'schedule_set_updated_at') then
    create trigger schedule_set_updated_at before update on public.schedule_entries
      for each row execute function private.set_updated_at();
  end if;
end $$;

grant select on public.schedule_entries to authenticated;
grant insert, update, delete on public.schedule_entries to authenticated;
grant all on public.schedule_entries to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'schedule_entries' and policyname = 'schedule_read_own_group') then
    create policy schedule_read_own_group on public.schedule_entries
      for select to authenticated
      using (
        group_no is null
        or group_no = (select private.current_group())
        or (select private.is_admin())
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'schedule_entries' and policyname = 'schedule_admin_insert') then
    create policy schedule_admin_insert on public.schedule_entries
      for insert to authenticated with check ((select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'schedule_entries' and policyname = 'schedule_admin_update') then
    create policy schedule_admin_update on public.schedule_entries
      for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'schedule_entries' and policyname = 'schedule_admin_delete') then
    create policy schedule_admin_delete on public.schedule_entries
      for delete to authenticated using ((select private.is_admin()));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Course catalog (fixed list of six; schedule rows are seeded separately)
-- ---------------------------------------------------------------------------
insert into public.courses (slug, code, name, teacher, hue, sort_order) values
  ('space-systems-design-1',    'ҒЖЖ', 'Ғарыштық жүйелерді жобалау 1',           'Калыбекова А.А.', 214, 1),
  ('satellite-communication',   'СБЖ', 'Серіктік байланыс жүйелері',             'Минглибаев М.Д.', 174, 2),
  ('aerodynamics',              'АД',  'Аэродинамика',                           'Толеуханов А.Е.',  32, 3),
  ('programmable-logic-devices','БЛҚ', 'Бағдарламаланатын логикалық құрылғылар', 'Калыбеков А.А.',  262, 4),
  ('rocket-dynamics',           'РД',  'Ракетодинамика',                         'Байсбаев О.Б.',   350, 5),
  ('applied-gyroscope-theory',  'ГҚТ', 'Гироскоптың қолданбалы теориясы',        'Байсбаев О.Б.',   196, 6)
on conflict (slug) do nothing;
