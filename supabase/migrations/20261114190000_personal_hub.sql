-- ULPA · personal hub (kainar.online/hub): Қайнар's own study / training / food / English tracker.
-- Additive only. One row of JSON per owner; only student 01 (the site owner) can read or write it.

create or replace function private.is_hub_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.students s
    where s.user_id = auth.uid() and s.code = '01'
  );
$$;

-- Lets the hub page ask "is this me?" without reading the roster.
create or replace function public.hub_is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_hub_owner();
$$;
revoke all on function public.hub_is_owner() from public, anon;
grant execute on function public.hub_is_owner() to authenticated;

create table if not exists public.hub_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.hub_state enable row level security;

revoke all on public.hub_state from anon, authenticated;
grant select, insert, update on public.hub_state to authenticated;

drop policy if exists hub_state_owner_select on public.hub_state;
create policy hub_state_owner_select on public.hub_state
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_hub_owner()));

drop policy if exists hub_state_owner_insert on public.hub_state;
create policy hub_state_owner_insert on public.hub_state
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_hub_owner()));

drop policy if exists hub_state_owner_update on public.hub_state;
create policy hub_state_owner_update on public.hub_state
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_hub_owner()))
  with check (user_id = (select auth.uid()) and (select private.is_hub_owner()));
