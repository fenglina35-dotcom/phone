-- Bind one physically confirmed MSL430 fingerprint to one web household.
-- This prevents accidental cross-household claims and makes the agent refuse
-- every same-model lamp except the one the user saw blink during enrollment.
alter table public.phone_smart_home_devices add column if not exists lamp_id_hash text;
alter table public.phone_smart_home_devices add column if not exists lamp_verified_at timestamptz;

create unique index if not exists phone_smart_home_one_active_owner_per_lamp
on public.phone_smart_home_devices(lamp_id_hash)
where revoked_at is null and lamp_id_hash is not null;

create or replace function public.phone_smart_home_bind_verified_device(
  p_pair_code text,
  p_device_id text,
  p_device_name text,
  p_device_secret text,
  p_agent_version text,
  p_lamp_id_hash text,
  p_lamp_name text default 'MSL430'
)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_pair public.phone_smart_home_pairings%rowtype;
  v_id text:=left(trim(coalesce(p_device_id,'')),160);
  v_name text:=left(coalesce(nullif(trim(p_device_name),''),'Windows 智能家电电脑'),80);
  v_lamp text:=lower(trim(coalesce(p_lamp_id_hash,'')));
  v_old_target text;
begin
  if trim(coalesce(p_pair_code,''))!~'^[0-9]{10}$' then raise exception 'invalid-pair-code'; end if;
  if length(v_id)<16 or length(coalesce(p_device_secret,''))<32 then raise exception 'invalid-device-identity'; end if;
  if v_lamp!~'^sha256:[0-9a-f]{64}$' then raise exception 'invalid-lamp-fingerprint'; end if;
  select * into v_pair from public.phone_smart_home_pairings
    where pair_code_hash=public.phone_companion_hash('smart-home-pair:'||trim(p_pair_code))
      and pair_expires_at>=now() for update;
  if v_pair.target is null then raise exception 'pair-code-invalid-or-expired'; end if;

  if exists(select 1 from public.phone_smart_home_devices
    where lamp_id_hash=v_lamp and revoked_at is null and target<>v_pair.target and device_id<>v_id)
  then raise exception 'lamp-already-bound-to-another-home'; end if;

  select target into v_old_target from public.phone_smart_home_devices where device_id=v_id and target<>v_pair.target;
  if v_old_target is not null then
    update public.phone_smart_home_jobs set status='expired',error='device-moved',updated_at=now()
      where target=v_old_target and status in('pending','claimed');
    delete from public.phone_smart_home_devices where target=v_old_target and device_id=v_id;
  end if;

  insert into public.phone_smart_home_devices(
    target,device_id,device_name,device_secret_hash,paired_at,last_seen_at,agent_version,
    lamp_model,lamp_name,lamp_id_hash,lamp_verified_at,revoked_at
  ) values(
    v_pair.target,v_id,v_name,public.phone_companion_hash(p_device_secret),now(),now(),
    left(trim(coalesce(p_agent_version,'')),40),'MSL430',left(trim(coalesce(p_lamp_name,'MSL430')),80),
    v_lamp,now(),null
  )
  on conflict(target) do update set
    device_id=excluded.device_id,device_name=excluded.device_name,
    device_secret_hash=excluded.device_secret_hash,paired_at=now(),last_seen_at=now(),
    agent_version=excluded.agent_version,lamp_model='MSL430',lamp_name=excluded.lamp_name,
    lamp_id_hash=excluded.lamp_id_hash,lamp_verified_at=now(),revoked_at=null,updated_at=now();

  delete from public.phone_smart_home_pairings where target=v_pair.target;
  update public.phone_smart_home_jobs set status='expired',error='device-replaced',updated_at=now()
    where target=v_pair.target and status in('pending','claimed');
  return jsonb_build_object('ok',true,'target',v_pair.target,'deviceName',v_name,'securityVerified',true);
exception when unique_violation then
  raise exception 'lamp-already-bound-to-another-home';
end $$;

create or replace function public.phone_smart_home_status(p_target text,p_owner_secret text)
returns jsonb language plpgsql stable security definer set search_path=public,extensions as $$
declare v public.phone_smart_home_devices%rowtype;
begin
  if not public.phone_delivery_owner_ok(p_target,p_owner_secret) then raise exception 'smart-home-owner-auth-failed'; end if;
  select * into v from public.phone_smart_home_devices where target=trim(p_target) and revoked_at is null;
  if v.target is null then return jsonb_build_object('linked',false); end if;
  return jsonb_build_object(
    'linked',true,
    'securityVerified',v.lamp_id_hash~'^sha256:[0-9a-f]{64}$' and v.lamp_verified_at is not null,
    'online',v.last_seen_at>=now()-interval '30 seconds',
    'deviceName',v.device_name,'agentVersion',v.agent_version,'lampModel',v.lamp_model,
    'lampName',v.lamp_name,'lastSeenAt',v.last_seen_at
  );
end $$;

create or replace function public.phone_smart_home_enqueue(p_target text,p_owner_secret text,p_request_key text,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_target text:=trim(coalesce(p_target,'')); v_key text:=left(trim(coalesce(p_request_key,'')),160); v_action text:=lower(trim(coalesce(p_action,''))); v_job public.phone_smart_home_jobs%rowtype;
begin
  if not public.phone_delivery_owner_ok(v_target,p_owner_secret) then raise exception 'smart-home-owner-auth-failed'; end if;
  if length(v_key)<16 or v_action not in('snapshot','control') then raise exception 'invalid-smart-home-job'; end if;
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' or pg_column_size(p_payload)>8192 then raise exception 'invalid-job-payload'; end if;
  if not exists(select 1 from public.phone_smart_home_devices where target=v_target and revoked_at is null and lamp_id_hash~'^sha256:[0-9a-f]{64}$' and lamp_verified_at is not null)
    then raise exception 'smart-home-lamp-verification-required'; end if;
  update public.phone_smart_home_jobs set status='pending',claimed_at=null,lease_expires_at=null,error='',updated_at=now() where target=v_target and status='claimed' and lease_expires_at<now();
  update public.phone_smart_home_jobs set status='expired',error='job-expired',updated_at=now() where target=v_target and status in('pending','claimed') and created_at<now()-interval '1 minute';
  insert into public.phone_smart_home_jobs(target,request_key,action,payload) values(v_target,v_key,v_action,coalesce(p_payload,'{}'::jsonb)) on conflict(target,request_key) do nothing;
  select * into v_job from public.phone_smart_home_jobs where target=v_target and request_key=v_key;
  return jsonb_build_object('id',v_job.id,'status',v_job.status,'result',v_job.result,'error',v_job.error,'updatedAt',v_job.updated_at);
end $$;

create or replace function public.phone_smart_home_pull_verified(
  p_target text,p_device_secret text,p_agent_version text default '',p_lamp_model text default '',
  p_lamp_name text default '',p_lamp_id_hash text default ''
)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_result jsonb; v_lamp text:=lower(trim(coalesce(p_lamp_id_hash,'')));
begin
  if v_lamp!~'^sha256:[0-9a-f]{64}$' then return null; end if;
  if not exists(select 1 from public.phone_smart_home_devices where target=trim(p_target) and revoked_at is null
    and device_secret_hash=public.phone_companion_hash(p_device_secret) and lamp_id_hash=v_lamp and lamp_verified_at is not null)
    then return null; end if;
  update public.phone_smart_home_devices set last_seen_at=now(),agent_version=left(trim(coalesce(p_agent_version,'')),40),
    lamp_model=left(trim(coalesce(p_lamp_model,'')),40),lamp_name=left(trim(coalesce(p_lamp_name,'')),80),updated_at=now()
    where target=trim(p_target) and device_secret_hash=public.phone_companion_hash(p_device_secret)
      and lamp_id_hash=v_lamp and revoked_at is null;
  update public.phone_smart_home_jobs set status='pending',claimed_at=null,lease_expires_at=null,error='',updated_at=now()
    where target=trim(p_target) and status='claimed' and lease_expires_at<now();
  with picked as (
    select id from public.phone_smart_home_jobs where target=trim(p_target) and status='pending'
      and created_at>=now()-interval '1 minute' order by created_at limit 1 for update skip locked
  ), claimed as (
    update public.phone_smart_home_jobs j set status='claimed',claimed_at=now(),lease_expires_at=now()+interval '30 seconds',updated_at=now()
      from picked where j.id=picked.id returning j.*
  ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'action',action,'payload',payload,'createdAt',created_at)),'[]'::jsonb)
    into v_result from claimed;
  return v_result;
end $$;

revoke execute on function public.phone_smart_home_bind_device(text,text,text,text,text) from anon,authenticated;
revoke execute on function public.phone_smart_home_pull(text,text,text,text,text) from anon,authenticated;
revoke all on function public.phone_smart_home_bind_verified_device(text,text,text,text,text,text,text) from public;
revoke all on function public.phone_smart_home_pull_verified(text,text,text,text,text,text) from public;
grant execute on function public.phone_smart_home_bind_verified_device(text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.phone_smart_home_pull_verified(text,text,text,text,text,text) to anon,authenticated;
