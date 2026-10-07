-- ULPA · First-login guided tour
-- Remembers (per student, across devices) that the tour was finished or skipped.
-- Additive only.

create table if not exists public.onboarding_done (
  student_id  uuid primary key references public.students (id) on delete cascade,
  done_at     timestamptz not null default now()
);
alter table public.onboarding_done enable row level security;

grant select on public.onboarding_done to authenticated;
grant all on public.onboarding_done to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'onboarding_done' and policyname = 'onboarding_done_own') then
    create policy onboarding_done_own on public.onboarding_done for select to authenticated
      using (student_id = (select private.current_student_id()));
  end if;
end $$;

create or replace function public.complete_onboarding()
returns void language plpgsql security definer set search_path = '' as $$
declare v_student uuid := private.current_student_id();
begin
  if v_student is null then
    return;
  end if;
  insert into public.onboarding_done (student_id) values (v_student)
  on conflict (student_id) do update set done_at = now();
end;
$$;
grant execute on function public.complete_onboarding() to authenticated;
