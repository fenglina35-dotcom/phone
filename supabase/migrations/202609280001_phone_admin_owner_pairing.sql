create table if not exists public.phone_admin_owner_pairings (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists phone_admin_owner_pairings_expiry_idx
  on public.phone_admin_owner_pairings(expires_at);

alter table public.phone_admin_owner_pairings enable row level security;
revoke all on public.phone_admin_owner_pairings from public, anon, authenticated;

create or replace function public.phone_admin_owner_pair_claim(p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.phone_admin_owner_pairings
  set used_at = now()
  where code_hash = trim(coalesce(p_code_hash, ''))
    and used_at is null
    and expires_at >= now()
  returning id into v_id;
  return v_id is not null;
end;
$$;

revoke all on function public.phone_admin_owner_pair_claim(text) from public, anon, authenticated;
grant execute on function public.phone_admin_owner_pair_claim(text) to service_role;

comment on table public.phone_admin_owner_pairings is
  'Short-lived, one-use pairing codes for binding a new owner-admin browser without exposing the long-lived owner credential.';
