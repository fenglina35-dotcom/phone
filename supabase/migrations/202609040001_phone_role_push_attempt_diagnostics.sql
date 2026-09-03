alter table public.phone_role_push_profiles
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_attempt_outcome text,
  add column if not exists last_attempt_reason text not null default '',
  add column if not exists consecutive_unavailable integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'phone_role_push_profiles_last_attempt_outcome_check'
  ) then
    alter table public.phone_role_push_profiles
      add constraint phone_role_push_profiles_last_attempt_outcome_check
      check (last_attempt_outcome is null or last_attempt_outcome in ('message', 'silent', 'unavailable', 'superseded'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'phone_role_push_profiles_consecutive_unavailable_check'
  ) then
    alter table public.phone_role_push_profiles
      add constraint phone_role_push_profiles_consecutive_unavailable_check
      check (consecutive_unavailable >= 0);
  end if;
end;
$$;

create table if not exists public.phone_role_push_attempts (
  id uuid primary key default gen_random_uuid(),
  target text not null references public.phone_companion_links(target) on delete cascade,
  role_id text not null,
  attempted_at timestamptz not null default now(),
  outcome text not null check (outcome in ('message', 'silent', 'unavailable', 'superseded')),
  reason text not null default '',
  duration_ms integer not null default 0 check (duration_ms >= 0),
  next_due_at timestamptz,
  route_summary jsonb not null default '[]'::jsonb,
  outbox_id uuid references public.phone_role_push_outbox(id) on delete set null,
  push_status text not null default ''
);

create index if not exists phone_role_push_attempts_target_role_idx
  on public.phone_role_push_attempts(target, role_id, attempted_at desc);

alter table public.phone_role_push_attempts enable row level security;
revoke all on public.phone_role_push_attempts from public, anon, authenticated;

create or replace function public.phone_role_push_status(
  p_target text,
  p_owner_secret text,
  p_role_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.phone_companion_links%rowtype;
  v_profile public.phone_role_push_profiles%rowtype;
  v_outbox public.phone_role_push_outbox%rowtype;
begin
  if not public.phone_companion_owner_ok(p_target, p_owner_secret) then
    return jsonb_build_object('ok', false, 'reason', 'owner-not-linked');
  end if;
  select * into v_link from public.phone_companion_links
    where target = trim(p_target);
  select * into v_profile from public.phone_role_push_profiles
    where target = trim(p_target) and role_id = left(trim(p_role_id), 120);
  select * into v_outbox from public.phone_role_push_outbox
    where target = trim(p_target) and role_id = left(trim(p_role_id), 120)
    order by created_at desc limit 1;
  return jsonb_build_object(
    'ok', true,
    'linked', v_link.device_secret_hash is not null,
    'pushRegistered', v_link.apns_device_token is not null,
    'pushEnvironment', v_link.apns_environment,
    'profileExists', v_profile.role_id is not null,
    'profileEnabled', coalesce(v_profile.enabled, false),
    'nextDueAt', v_profile.next_due_at,
    'lastSentAt', v_profile.last_sent_at,
    'dailyCount', coalesce(v_profile.daily_count, 0),
    'dailyLimit', coalesce(v_profile.daily_limit, 0),
    'lastAttemptAt', v_profile.last_attempt_at,
    'lastAttemptOutcome', v_profile.last_attempt_outcome,
    'lastAttemptReason', v_profile.last_attempt_reason,
    'consecutiveUnavailable', coalesce(v_profile.consecutive_unavailable, 0),
    'lastPushStatus', v_outbox.push_status,
    'lastPushError', v_outbox.push_error,
    'cronActive', exists(
      select 1 from cron.job
      where jobname = 'phone-role-push-every-minute' and active
    )
  );
end;
$$;

revoke all on function public.phone_role_push_status(text, text, text)
  from public;
grant execute on function public.phone_role_push_status(text, text, text)
  to anon, authenticated;
