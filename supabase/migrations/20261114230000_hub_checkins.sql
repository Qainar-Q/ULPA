-- ULPA · personal hub: daily check-ins that hub users (owner + invited friends) can see of each other.
-- Only done / not done per area (fast, train, eng, study, kcal) and a score; no amounts, no food, no notes.
-- Additive only.

create table if not exists public.hub_checkins (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  name text not null check (char_length(name) between 1 and 24),
  items jsonb not null default '{}'::jsonb,
  score smallint not null default 0 check (score between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists hub_checkins_day on public.hub_checkins (day);
alter table public.hub_checkins enable row level security;
revoke all on public.hub_checkins from anon;
grant select, insert, update on public.hub_checkins to authenticated;
grant select, insert, update, delete on public.hub_checkins to service_role;

-- Every hub user may read everyone's check-ins of the last 14 days.
drop policy if exists hub_checkins_read on public.hub_checkins;
create policy hub_checkins_read on public.hub_checkins
  for select to authenticated
  using ((select private.is_hub_user()) and day >= current_date - 14);

-- Each one writes only his own row.
drop policy if exists hub_checkins_insert on public.hub_checkins;
create policy hub_checkins_insert on public.hub_checkins
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_hub_user()));
drop policy if exists hub_checkins_update on public.hub_checkins;
create policy hub_checkins_update on public.hub_checkins
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_hub_user()))
  with check (user_id = (select auth.uid()) and (select private.is_hub_user()));
