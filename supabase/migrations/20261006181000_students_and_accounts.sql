-- ULPA · Stage 3 · Students, roles and one-time account codes
--
-- Login model:
--   * Each student has a 2-digit code (01–18). Auth users use an internal email
--     s<code>@students.kainar.online that never receives mail.
--   * An admin issues a one-time access code (24 h, single use, 5 wrong tries max).
--   * The student enters code + access code + new password. The Edge Function
--     `account-activate` verifies the access code and sets the password.
--   * Knowing a student code alone is never enough to take over an account.
--
-- Safe to re-run: every object uses IF NOT EXISTS / OR REPLACE / guarded DO blocks.

-- ---------------------------------------------------------------------------
-- 0. Housekeeping
-- ---------------------------------------------------------------------------

-- The auto-RLS helper created by Supabase was callable through the public API.
-- It only needs to run as an event trigger, so nobody should call it directly.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- Private schema: NOT exposed through the REST API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Roles and students
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role' and typnamespace = 'public'::regnamespace) then
    create type public.app_role as enum ('student', 'admin');
  end if;
end $$;

create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[0-9]{2}$'),
  full_name     text not null check (char_length(btrim(full_name)) between 1 and 80),
  group_no      smallint not null check (group_no in (1, 2)),
  role          public.app_role not null default 'student',
  birth_month   smallint check (birth_month between 1 and 12),
  birth_day     smallint check (birth_day between 1 and 31),
  avatar_path   text check (avatar_path is null or char_length(avatar_path) <= 300),
  user_id       uuid unique references auth.users (id) on delete set null,
  activated_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint students_birthday_pair check ((birth_month is null) = (birth_day is null))
);

comment on table public.students is 'Class roster. One row per student; user_id links to auth.users after activation.';

create index if not exists students_group_idx on public.students (group_no);

alter table public.students enable row level security;

-- updated_at maintenance
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
  before update on public.students
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Permission helpers (used by RLS policies in this and later migrations)
-- ---------------------------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.students s
    where s.user_id = auth.uid() and s.role = 'admin'
  );
$$;

create or replace function private.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.students s where s.user_id = auth.uid();
$$;

create or replace function private.current_group()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select s.group_no from public.students s where s.user_id = auth.uid();
$$;

revoke all on function private.is_admin(), private.current_student_id(), private.current_group() from public, anon;
grant execute on function private.is_admin(), private.current_student_id(), private.current_group() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Table privileges + RLS for students
-- ---------------------------------------------------------------------------

-- New tables are not auto-exposed in this project, so grant explicitly.
revoke all on public.students from anon, authenticated;
grant select on public.students to authenticated;
-- Only these columns can ever be changed through the API. code, role, user_id,
-- activated_at are never updatable by any signed-in user (admins included).
grant update (full_name, group_no, birth_month, birth_day, avatar_path) on public.students to authenticated;
grant all on public.students to service_role;

drop policy if exists students_select_own_or_admin on public.students;
create policy students_select_own_or_admin
  on public.students
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists students_update_own_or_admin on public.students;
create policy students_update_own_or_admin
  on public.students
  for update
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

-- A student may update only their avatar. Name, group and birthday are admin-only.
create or replace function private.guard_student_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' and not private.is_admin() then
    if new.full_name   is distinct from old.full_name
    or new.group_no    is distinct from old.group_no
    or new.birth_month is distinct from old.birth_month
    or new.birth_day   is distinct from old.birth_day then
      raise exception 'Only an administrator can change this field'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists students_guard_update on public.students;
create trigger students_guard_update
  before update on public.students
  for each row execute function private.guard_student_update();

-- ---------------------------------------------------------------------------
-- 4. One-time account codes (private, never readable through the API)
-- ---------------------------------------------------------------------------

create table if not exists private.account_codes (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  purpose          text not null check (purpose in ('activation', 'reset')),
  code_hash        text not null,
  expires_at       timestamptz not null,
  used_at          timestamptz,
  failed_attempts  smallint not null default 0,
  created_by       uuid references public.students (id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table private.account_codes enable row level security;
revoke all on private.account_codes from public, anon, authenticated;

create index if not exists account_codes_open_idx
  on private.account_codes (student_id)
  where used_at is null;

-- Internal: create a new code. Plaintext is returned once and never stored.
create or replace function private.issue_account_code(
  p_student_code text,
  p_purpose text,
  p_issued_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_alphabet   constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L
  v_bytes      bytea := extensions.gen_random_bytes(8);
  v_code       text := '';
  v_expires    timestamptz := now() + interval '24 hours';
  i            int;
begin
  if p_purpose not in ('activation', 'reset') then
    raise exception 'invalid_purpose';
  end if;

  select s.id into v_student_id from public.students s where s.code = p_student_code;
  if v_student_id is null then
    raise exception 'student_not_found';
  end if;

  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;

  -- Only one open code per student: issuing a new one cancels the old one.
  delete from private.account_codes c where c.student_id = v_student_id and c.used_at is null;

  insert into private.account_codes (student_id, purpose, code_hash, expires_at, created_by)
  values (v_student_id, p_purpose, extensions.crypt(v_code, extensions.gen_salt('bf', 8)), v_expires, p_issued_by);

  return jsonb_build_object(
    'code', substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4),
    'expires_at', v_expires
  );
end;
$$;

revoke all on function private.issue_account_code(text, text, uuid) from public, anon, authenticated;
grant execute on function private.issue_account_code(text, text, uuid) to service_role;

-- Public RPC for the admin page. Checks admin rights inside the database.
create or replace function public.admin_issue_account_code(p_student_code text, p_purpose text default 'activation')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return private.issue_account_code(p_student_code, p_purpose, private.current_student_id());
end;
$$;

revoke all on function public.admin_issue_account_code(text, text) from public, anon;
grant execute on function public.admin_issue_account_code(text, text) to authenticated;

-- Admin overview: roster + activation state (no code values, ever).
create or replace function public.admin_list_accounts()
returns table (
  code text,
  full_name text,
  group_no smallint,
  role public.app_role,
  activated_at timestamptz,
  open_code_purpose text,
  open_code_expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.code, s.full_name, s.group_no, s.role, s.activated_at, c.purpose, c.expires_at
    from public.students s
    left join lateral (
      select ac.purpose, ac.expires_at
      from private.account_codes ac
      where ac.student_id = s.id and ac.used_at is null and ac.expires_at > now() and ac.failed_attempts < 5
      order by ac.created_at desc
      limit 1
    ) c on true
    order by s.code;
end;
$$;

revoke all on function public.admin_list_accounts() from public, anon;
grant execute on function public.admin_list_accounts() to authenticated;

-- Server-only: check and consume a code. Returns a status instead of raising,
-- so failed attempts are recorded (an exception would roll the counter back).
create or replace function public.consume_account_code(p_student_code text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_row     private.account_codes%rowtype;
  v_clean   text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into v_student from public.students s where s.code = p_student_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_row
  from private.account_codes c
  where c.student_id = v_student.id and c.used_at is null and c.expires_at > now()
  order by c.created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if v_row.failed_attempts >= 5 then
    return jsonb_build_object('ok', false, 'error', 'code_locked');
  end if;

  if length(v_clean) <> 8 or v_row.code_hash <> extensions.crypt(v_clean, v_row.code_hash) then
    update private.account_codes set failed_attempts = failed_attempts + 1 where id = v_row.id;
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  update private.account_codes set used_at = now() where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'student_id', v_student.id,
    'user_id', v_student.user_id,
    'purpose', v_row.purpose
  );
end;
$$;

revoke all on function public.consume_account_code(text, text) from public, anon, authenticated;
grant execute on function public.consume_account_code(text, text) to service_role;

-- Server-only: link the auth user after the password has been set.
create or replace function public.finish_account_activation(p_student_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.students
  set user_id = p_user_id,
      activated_at = coalesce(activated_at, now())
  where id = p_student_id;
end;
$$;

revoke all on function public.finish_account_activation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finish_account_activation(uuid, uuid) to service_role;
