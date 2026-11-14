-- ULPA · personal hub: invite links. The owner makes a one-time code; a friend opens
-- kainar.online/hub/?invite=CODE and picks his own username and password (hub-ai "join").
-- Only the service role (hub-ai Edge Function) reads or writes this table.
create table if not exists public.hub_invites (
  code text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);
alter table public.hub_invites enable row level security;
revoke all on public.hub_invites from anon, authenticated;
