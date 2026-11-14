-- ULPA · personal hub: friends the owner invites get their own private hub (kainar.online/hub).
-- Additive only. Members are NOT students: they cannot see anything in ULPA, only their own hub row.

create table if not exists public.hub_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  login text not null unique,
  created_at timestamptz not null default now()
);
alter table public.hub_members enable row level security;
revoke all on public.hub_members from anon, authenticated;
-- No policies: only the service role (hub-ai Edge Function) reads or writes it.

create or replace function private.is_hub_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_hub_owner()
      or exists (select 1 from public.hub_members m where m.user_id = auth.uid());
$$;

-- 'owner', 'member' or null: what the hub page may show.
create or replace function public.hub_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_hub_owner() then 'owner'
              when exists (select 1 from public.hub_members m where m.user_id = auth.uid()) then 'member'
         end;
$$;
revoke all on function public.hub_role() from public, anon;
grant execute on function public.hub_role() to authenticated;

drop policy if exists hub_state_owner_select on public.hub_state;
drop policy if exists hub_state_owner_insert on public.hub_state;
drop policy if exists hub_state_owner_update on public.hub_state;

create policy hub_state_user_select on public.hub_state
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_hub_user()));
create policy hub_state_user_insert on public.hub_state
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_hub_user()));
create policy hub_state_user_update on public.hub_state
  for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_hub_user()))
  with check (user_id = (select auth.uid()) and (select private.is_hub_user()));
