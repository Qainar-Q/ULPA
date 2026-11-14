-- ULPA · personal hub: this project does not give the service role table rights by default,
-- so the hub-ai Edge Function could not create invite codes or friends' accounts ("create_failed").
grant select, insert, update, delete on public.hub_invites to service_role;
grant select, insert, update, delete on public.hub_members to service_role;
grant select, insert, update, delete on public.hub_state to service_role;
