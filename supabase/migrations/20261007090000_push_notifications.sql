-- ULPA · Push notifications
--
-- Flow: a new task / announcement / poll / photo comment → trigger → pg_net posts
-- {type, id} to the Edge Function "push-send" with a shared secret header. The
-- function (service role) works out who may see the item, respects each
-- student's preferences and sends Web Push messages. A daily pg_cron job at
-- 20:00 Almaty sends "due tomorrow" reminders.
--
-- Secrets live in Supabase Vault and are generated inside the database / Edge
-- Function, so they never appear in the repository or the browser:
--   ulpa_push_hook_secret   — random, created here
--   ulpa_vapid_private_jwk  — created by push-send on first run
--   ulpa_vapid_public_key   — public, readable by signed-in students
-- Additive only.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Subscriptions (one per browser/device) and preferences
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint         text primary key,
  student_id       uuid not null references public.students (id) on delete cascade,
  p256dh           text not null,
  auth             text not null,
  user_agent       text,
  created_at       timestamptz not null default now(),
  last_success_at  timestamptz
);
create index if not exists push_subscriptions_student_idx on public.push_subscriptions (student_id);
alter table public.push_subscriptions enable row level security;

create table if not exists public.notification_prefs (
  student_id     uuid primary key references public.students (id) on delete cascade,
  tasks          boolean not null default true,
  announcements  boolean not null default true,
  polls          boolean not null default true,
  comments       boolean not null default true,
  deadlines      boolean not null default true,
  updated_at     timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;

grant select, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
grant select on public.notification_prefs to authenticated;
grant all on public.notification_prefs to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'push_subscriptions_own') then
    create policy push_subscriptions_own on public.push_subscriptions for select to authenticated
      using (student_id = (select private.current_student_id()));
    create policy push_subscriptions_remove_own on public.push_subscriptions for delete to authenticated
      using (student_id = (select private.current_student_id()));
    create policy notification_prefs_own on public.notification_prefs for select to authenticated
      using (student_id = (select private.current_student_id()));
  end if;
end $$;

-- Register this device for the signed-in student. Only real browser push services
-- are accepted, so the server never posts to arbitrary addresses.
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_student uuid := private.current_student_id();
begin
  if v_student is null then
    raise exception 'not a class member' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
     or char_length(p_endpoint) > 1000
     or p_p256dh !~ '^[A-Za-z0-9_-]{80,100}$'
     or p_auth !~ '^[A-Za-z0-9_-]{16,32}$' then
    raise exception 'invalid subscription' using errcode = '22023';
  end if;
  if (select count(*) from public.push_subscriptions s where s.student_id = v_student and s.endpoint <> p_endpoint) >= 10 then
    raise exception 'too many devices' using errcode = 'P0001';
  end if;
  insert into public.push_subscriptions (endpoint, student_id, p256dh, auth, user_agent)
  values (p_endpoint, v_student, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set student_id = excluded.student_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;
grant execute on function public.push_subscribe(text, text, text, text) to authenticated;

create or replace function public.set_notification_pref(p_key text, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_student uuid := private.current_student_id();
begin
  if v_student is null or p_key not in ('tasks', 'announcements', 'polls', 'comments', 'deadlines') then
    return;
  end if;
  insert into public.notification_prefs (student_id) values (v_student) on conflict (student_id) do nothing;
  execute format('update public.notification_prefs set %I = $1, updated_at = now() where student_id = $2', p_key)
    using coalesce(p_on, true), v_student;
end;
$$;
grant execute on function public.set_notification_pref(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Secrets
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ulpa_push_hook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'ulpa_push_hook_secret',
                                'Shared secret: database triggers → push-send Edge Function');
  end if;
end $$;

-- Public VAPID key for the browser (safe to share; needed to subscribe).
create or replace function public.push_public_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets
   where name = 'ulpa_vapid_public_key' and private.is_class_member();
$$;
grant execute on function public.push_public_key() to authenticated;

-- Server-only: everything push-send needs. Refuses any caller but the service role.
create or replace function public.push_server_config()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'hook_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ulpa_push_hook_secret'),
    'vapid_private_jwk', (select decrypted_secret from vault.decrypted_secrets where name = 'ulpa_vapid_private_jwk'),
    'vapid_public_key', (select decrypted_secret from vault.decrypted_secrets where name = 'ulpa_vapid_public_key')
  );
end;
$$;

-- Server-only, first run: store generated VAPID keys (never overwrites).
create or replace function public.push_store_vapid(p_private_jwk text, p_public_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from vault.secrets where name = 'ulpa_vapid_private_jwk') then
    return false;
  end if;
  perform vault.create_secret(p_private_jwk, 'ulpa_vapid_private_jwk', 'VAPID private key (JWK) for Web Push');
  perform vault.create_secret(p_public_key, 'ulpa_vapid_public_key', 'VAPID public key (base64url)');
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers → Edge Function
-- ---------------------------------------------------------------------------
create or replace function private.notify_push(p_type text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'ulpa_push_hook_secret';
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://lxrjogpmmatpuzellnyu.supabase.co/functions/v1/push-send',
    body := jsonb_build_object('type', p_type, 'id', p_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ulpa-hook', v_secret),
    timeout_milliseconds := 30000
  );
exception when others then
  -- Notifications are best effort: never block saving the task/announcement/comment.
  raise warning 'notify_push failed: %', sqlerrm;
end;
$$;

create or replace function private.push_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_push(tg_argv[0], new.id);
  return null;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'assignments_push') then
    create trigger assignments_push after insert on public.assignments
      for each row execute function private.push_after_insert('task');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'announcements_push') then
    create trigger announcements_push after insert on public.announcements
      for each row execute function private.push_after_insert('announcement');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'polls_push') then
    create trigger polls_push after insert on public.polls
      for each row execute function private.push_after_insert('poll');
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'photo_comments_push') then
    create trigger photo_comments_push after insert on public.photo_comments
      for each row execute function private.push_after_insert('comment');
  end if;
end $$;

-- Every evening at 20:00 Almaty (15:00 UTC): "due tomorrow" reminders.
select cron.schedule('ulpa-deadline-reminders', '0 15 * * *', $$select private.notify_push('deadlines', null)$$);
