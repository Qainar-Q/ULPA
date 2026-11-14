-- ULPA · personal hub (1% Better): reminders by Web Push. Reuses ULPA's VAPID keys and hook secret (Vault).
-- Additive only.

create table if not exists public.hub_push (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  lang text not null default 'zh',
  tz text not null default 'Asia/Almaty',
  prefs jsonb not null default '{}'::jsonb,
  fast_end timestamptz,
  eat_end timestamptz,
  sent jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists hub_push_user on public.hub_push (user_id);
alter table public.hub_push enable row level security;
revoke all on public.hub_push from anon;
grant select, insert, update, delete on public.hub_push to authenticated;
grant select, insert, update, delete on public.hub_push to service_role;

drop policy if exists hub_push_own on public.hub_push;
create policy hub_push_own on public.hub_push
  for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_hub_user()))
  with check (user_id = (select auth.uid()) and (select private.is_hub_user()));

-- Public VAPID key for hub users (owner + invited friends).
create or replace function public.hub_push_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
   where name = 'ulpa_vapid_public_key' and private.is_hub_user();
$$;
revoke all on function public.hub_push_key() from public, anon;
grant execute on function public.hub_push_key() to authenticated;

-- Every 5 minutes: ask the hub-push Edge Function to send what is due.
create or replace function private.hub_push_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare v_secret text;
begin
  if not exists (select 1 from public.hub_push) then return; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'ulpa_push_hook_secret';
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://lxrjogpmmatpuzellnyu.supabase.co/functions/v1/hub-push',
    body := '{"action":"tick"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ulpa-hook', v_secret),
    timeout_milliseconds := 30000
  );
exception when others then
  raise warning 'hub_push_tick failed: %', sqlerrm;
end;
$$;

select cron.unschedule('hub-push-tick') where exists (select 1 from cron.job where jobname = 'hub-push-tick');
select cron.schedule('hub-push-tick', '*/5 * * * *', 'select private.hub_push_tick()');
