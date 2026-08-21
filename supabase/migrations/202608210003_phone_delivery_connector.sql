create table if not exists public.phone_delivery_clients (
  target text primary key,
  secret_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.phone_delivery_orders (
  id uuid primary key default gen_random_uuid(),
  target text not null references public.phone_delivery_clients(target) on delete cascade,
  role_id text not null default '',
  provider text not null,
  remote_order_id text not null,
  client_request_id text not null,
  merchant text not null default '',
  merchant_id text not null default '',
  offer_id text not null default '',
  quote_id text not null default '',
  total numeric(12,2) not null check (total >= 0),
  authorized_total numeric(12,2),
  payment_method text not null default '',
  status text not null,
  address_label text not null default '',
  address_fingerprint text not null default '',
  items jsonb not null default '[]'::jsonb,
  risk jsonb not null default '[]'::jsonb,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target, client_request_id),
  unique (provider, remote_order_id)
);

create table if not exists public.phone_delivery_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  target text not null references public.phone_delivery_clients(target) on delete cascade,
  order_id uuid not null references public.phone_delivery_orders(id) on delete cascade,
  client_request_id text not null,
  automatic boolean not null default false,
  authorized_total numeric(12,2),
  status text not null default 'pending',
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target, client_request_id)
);

create table if not exists public.phone_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  remote_order_id text not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists phone_delivery_orders_target_updated_idx
  on public.phone_delivery_orders (target, updated_at desc);
create index if not exists phone_delivery_orders_remote_idx
  on public.phone_delivery_orders (provider, remote_order_id);

alter table public.phone_role_background_tasks
  drop constraint if exists phone_role_background_tasks_kind_check;
alter table public.phone_role_background_tasks
  add constraint phone_role_background_tasks_kind_check
  check (kind in ('reply_handoff','device_handoff','one_minute_test','app_followup','app_watch_test','delivery_status'));
alter table public.phone_role_background_tasks
  add column if not exists external_key text;
create unique index if not exists phone_role_background_tasks_external_key_idx
  on public.phone_role_background_tasks(external_key)
  where external_key is not null;

alter table public.phone_delivery_clients enable row level security;
alter table public.phone_delivery_orders enable row level security;
alter table public.phone_delivery_payment_attempts enable row level security;
alter table public.phone_delivery_events enable row level security;

revoke all on public.phone_delivery_clients from public, anon, authenticated;
revoke all on public.phone_delivery_orders from public, anon, authenticated;
revoke all on public.phone_delivery_payment_attempts from public, anon, authenticated;
revoke all on public.phone_delivery_events from public, anon, authenticated;

create or replace function public.phone_delivery_authenticate(
  p_target text,
  p_secret text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target text := trim(coalesce(p_target, ''));
  v_hash text := public.phone_companion_hash(p_secret);
begin
  if v_target !~ '^yb_[a-z0-9]{20,96}$'
     or length(coalesce(p_secret, '')) < 24 then
    return false;
  end if;

  insert into public.phone_delivery_clients(target, secret_hash)
  values (v_target, v_hash)
  on conflict (target) do nothing;

  update public.phone_delivery_clients
  set last_seen_at = now()
  where target = v_target and secret_hash = v_hash;
  return found;
end;
$$;

revoke all on function public.phone_delivery_authenticate(text, text) from public;
grant execute on function public.phone_delivery_authenticate(text, text) to service_role;
