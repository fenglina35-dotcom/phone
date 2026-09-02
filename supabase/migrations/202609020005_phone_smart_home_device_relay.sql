-- One-account/one-computer smart-home relay. The web owner secret and Windows
-- device secret are independent; only short-lived allow-listed jobs cross cloud.
create table if not exists public.phone_smart_home_devices (
  target text primary key references public.phone_delivery_clients(target) on delete cascade,
  device_id text not null unique,
  device_name text not null default 'Windows 智能家电电脑',
  device_secret_hash text not null,
  pair_code_hash text,
  pair_expires_at timestamptz,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  agent_version text not null default '',
  lamp_model text not null default '',
  lamp_name text not null default '',
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.phone_smart_home_pairings (
  target text primary key references public.phone_delivery_clients(target) on delete cascade,
  pair_code_hash text not null unique,
  pair_expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.phone_smart_home_jobs (
  id uuid primary key default gen_random_uuid(),
  target text not null references public.phone_delivery_clients(target) on delete cascade,
  request_key text not null,
  action text not null check (action in ('snapshot','control')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','claimed','completed','failed','expired')),
  result jsonb not null default '{}'::jsonb,
  error text not null default '',
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (target, request_key)
);

create index if not exists phone_smart_home_jobs_claim_idx on public.phone_smart_home_jobs(target,status,created_at);
alter table public.phone_smart_home_devices enable row level security;
alter table public.phone_smart_home_pairings enable row level security;
alter table public.phone_smart_home_jobs enable row level security;
revoke all on public.phone_smart_home_devices from public, anon, authenticated;
revoke all on public.phone_smart_home_pairings from public, anon, authenticated;
revoke all on public.phone_smart_home_jobs from public, anon, authenticated;

create or replace function public.phone_smart_home_begin_pairing(p_target text,p_owner_secret text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_target text:=trim(coalesce(p_target,'')); v_code text; v_hash text; v_expires timestamptz:=now()+interval '10 minutes'; v_attempt int:=0;
begin
  if not public.phone_delivery_owner_ok(v_target,p_owner_secret) then raise exception 'smart-home-owner-auth-failed'; end if;
  delete from public.phone_smart_home_pairings where pair_expires_at<now() or target=v_target;
  loop
    v_attempt:=v_attempt+1;
    v_code:=lpad(((('x'||encode(gen_random_bytes(6),'hex'))::bit(48)::bigint)%10000000000)::text,10,'0');
    v_hash:=public.phone_companion_hash('smart-home-pair:'||v_code);
    begin insert into public.phone_smart_home_pairings(target,pair_code_hash,pair_expires_at) values(v_target,v_hash,v_expires); exit;
    exception when unique_violation then if v_attempt>=5 then raise exception 'pair-code-generation-failed'; end if; end;
  end loop;
  return jsonb_build_object('pairCode',v_code,'expiresAt',v_expires);
end $$;

create or replace function public.phone_smart_home_bind_device(p_pair_code text,p_device_id text,p_device_name text,p_device_secret text,p_agent_version text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_pair public.phone_smart_home_pairings%rowtype; v_id text:=left(trim(coalesce(p_device_id,'')),160); v_name text:=left(coalesce(nullif(trim(p_device_name),''),'Windows 智能家电电脑'),80);
begin
  if trim(coalesce(p_pair_code,''))!~'^[0-9]{10}$' then raise exception 'invalid-pair-code'; end if;
  if length(v_id)<16 or length(coalesce(p_device_secret,''))<32 then raise exception 'invalid-device-identity'; end if;
  select * into v_pair from public.phone_smart_home_pairings where pair_code_hash=public.phone_companion_hash('smart-home-pair:'||trim(p_pair_code)) and pair_expires_at>=now() for update;
  if v_pair.target is null then raise exception 'pair-code-invalid-or-expired'; end if;
  insert into public.phone_smart_home_devices(target,device_id,device_name,device_secret_hash,paired_at,last_seen_at,agent_version,revoked_at)
  values(v_pair.target,v_id,v_name,public.phone_companion_hash(p_device_secret),now(),now(),left(trim(coalesce(p_agent_version,'')),40),null)
  on conflict(target) do update set device_id=excluded.device_id,device_name=excluded.device_name,device_secret_hash=excluded.device_secret_hash,paired_at=now(),last_seen_at=now(),agent_version=excluded.agent_version,revoked_at=null,updated_at=now();
  delete from public.phone_smart_home_pairings where target=v_pair.target;
  update public.phone_smart_home_jobs set status='expired',error='device-replaced',updated_at=now() where target=v_pair.target and status in('pending','claimed');
  return jsonb_build_object('ok',true,'target',v_pair.target,'deviceName',v_name);
end $$;

create or replace function public.phone_smart_home_status(p_target text,p_owner_secret text)
returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare v public.phone_smart_home_devices%rowtype;
begin
  if not public.phone_delivery_owner_ok(p_target,p_owner_secret) then raise exception 'smart-home-owner-auth-failed'; end if;
  select * into v from public.phone_smart_home_devices where target=trim(p_target) and revoked_at is null;
  if v.target is null then return jsonb_build_object('linked',false); end if;
  return jsonb_build_object('linked',true,'online',v.last_seen_at>=now()-interval '30 seconds','deviceName',v.device_name,'agentVersion',v.agent_version,'lampModel',v.lamp_model,'lampName',v.lamp_name,'lastSeenAt',v.last_seen_at);
end $$;

create or replace function public.phone_smart_home_revoke(p_target text,p_owner_secret text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  if not public.phone_delivery_owner_ok(p_target,p_owner_secret) then return false; end if;
  update public.phone_smart_home_devices set revoked_at=now(),updated_at=now() where target=trim(p_target) and revoked_at is null;
  update public.phone_smart_home_jobs set status='expired',error='device-revoked',updated_at=now() where target=trim(p_target) and status in('pending','claimed'); return true;
end $$;

create or replace function public.phone_smart_home_enqueue(p_target text,p_owner_secret text,p_request_key text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_target text:=trim(coalesce(p_target,'')); v_key text:=left(trim(coalesce(p_request_key,'')),160); v_action text:=lower(trim(coalesce(p_action,''))); v_job public.phone_smart_home_jobs%rowtype;
begin
  if not public.phone_delivery_owner_ok(v_target,p_owner_secret) then raise exception 'smart-home-owner-auth-failed'; end if;
  if length(v_key)<16 or v_action not in('snapshot','control') then raise exception 'invalid-smart-home-job'; end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' or pg_column_size(p_payload)>8192 then raise exception 'invalid-job-payload'; end if;
  if not exists(select 1 from public.phone_smart_home_devices where target=v_target and revoked_at is null) then raise exception 'smart-home-device-required'; end if;
  update public.phone_smart_home_jobs set status='pending',claimed_at=null,lease_expires_at=null,error='',updated_at=now() where target=v_target and status='claimed' and lease_expires_at<now();
  update public.phone_smart_home_jobs set status='expired',error='job-expired',updated_at=now() where target=v_target and status in('pending','claimed') and created_at<now()-interval '1 minute';
  insert into public.phone_smart_home_jobs(target,request_key,action,payload) values(v_target,v_key,v_action,coalesce(p_payload,'{}'::jsonb)) on conflict(target,request_key) do nothing;
  select * into v_job from public.phone_smart_home_jobs where target=v_target and request_key=v_key;
  return jsonb_build_object('id',v_job.id,'status',v_job.status,'result',v_job.result,'error',v_job.error,'updatedAt',v_job.updated_at);
end $$;

create or replace function public.phone_smart_home_pull(p_target text,p_device_secret text,p_agent_version text default '',p_lamp_model text default '',p_lamp_name text default '')
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.phone_smart_home_devices where target=trim(p_target) and revoked_at is null and device_secret_hash=public.phone_companion_hash(p_device_secret)) then return null; end if;
  update public.phone_smart_home_devices set last_seen_at=now(),agent_version=left(trim(coalesce(p_agent_version,'')),40),lamp_model=left(trim(coalesce(p_lamp_model,'')),40),lamp_name=left(trim(coalesce(p_lamp_name,'')),80),updated_at=now() where target=trim(p_target) and device_secret_hash=public.phone_companion_hash(p_device_secret) and revoked_at is null;
  update public.phone_smart_home_jobs set status='pending',claimed_at=null,lease_expires_at=null,error='',updated_at=now() where target=trim(p_target) and status='claimed' and lease_expires_at<now();
  with picked as (select id from public.phone_smart_home_jobs where target=trim(p_target) and status='pending' and created_at>=now()-interval '1 minute' order by created_at limit 1 for update skip locked), claimed as (update public.phone_smart_home_jobs j set status='claimed',claimed_at=now(),lease_expires_at=now()+interval '30 seconds',updated_at=now() from picked where j.id=picked.id returning j.*)
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'action',action,'payload',payload,'createdAt',created_at)),'[]'::jsonb) into v_result from claimed; return v_result;
end $$;

create or replace function public.phone_smart_home_complete(p_target text,p_device_secret text,p_job_id uuid,p_ok boolean,p_result jsonb default '{}'::jsonb,p_error text default '')
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare v_count int:=0;
begin
  if not exists(select 1 from public.phone_smart_home_devices where target=trim(p_target) and revoked_at is null and device_secret_hash=public.phone_companion_hash(p_device_secret)) then return false; end if;
  if jsonb_typeof(coalesce(p_result,'{}'::jsonb))<>'object' or pg_column_size(p_result)>32768 then raise exception 'invalid-job-result'; end if;
  update public.phone_smart_home_jobs set status=case when coalesce(p_ok,false) then 'completed' else 'failed' end,result=case when coalesce(p_ok,false) then coalesce(p_result,'{}'::jsonb) else '{}'::jsonb end,error=case when coalesce(p_ok,false) then '' else left(trim(coalesce(p_error,'')),240) end,completed_at=now(),lease_expires_at=null,updated_at=now() where id=p_job_id and target=trim(p_target) and status='claimed'; get diagnostics v_count=row_count; return v_count=1;
end $$;

revoke all on function public.phone_smart_home_begin_pairing(text,text) from public;
revoke all on function public.phone_smart_home_bind_device(text,text,text,text,text) from public;
revoke all on function public.phone_smart_home_status(text,text) from public;
revoke all on function public.phone_smart_home_revoke(text,text) from public;
revoke all on function public.phone_smart_home_enqueue(text,text,text,text,jsonb) from public;
revoke all on function public.phone_smart_home_pull(text,text,text,text,text) from public;
revoke all on function public.phone_smart_home_complete(text,text,uuid,boolean,jsonb,text) from public;
grant execute on function public.phone_smart_home_begin_pairing(text,text) to service_role;
grant execute on function public.phone_smart_home_status(text,text) to service_role;
grant execute on function public.phone_smart_home_revoke(text,text) to service_role;
grant execute on function public.phone_smart_home_enqueue(text,text,text,text,jsonb) to service_role;
grant execute on function public.phone_smart_home_bind_device(text,text,text,text,text) to anon,authenticated;
grant execute on function public.phone_smart_home_pull(text,text,text,text,text) to anon,authenticated;
grant execute on function public.phone_smart_home_complete(text,text,uuid,boolean,jsonb,text) to anon,authenticated;
