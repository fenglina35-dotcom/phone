-- PRIVATE_MCP_ACCOUNT_V1. Credentials remain encrypted on the private backend.
create table if not exists public.private_phone_mcp_connections (
 user_id uuid not null references auth.users(id) on delete cascade,
 account_id text not null check(length(account_id) between 1 and 160),
 id text not null check(length(id) between 1 and 100),
 revision bigint not null default 0 check(revision>=0),
 ciphertext text check(length(ciphertext)<=1800000),
 active boolean not null default false,
 deleted boolean not null default false,
 staging_ciphertext text check(length(staging_ciphertext)<=1800000),
 staging_nonce uuid,
 staging_digest text,
 activated_nonce uuid,
 activated_digest text,
 credential_epoch bigint not null default 0,
 staging_credential_epoch bigint,
 staging_reset_credentials boolean not null default false,
 refresh_unknown boolean not null default false,
 lease_token uuid,
 lease_until timestamptz,
 updated_at timestamptz not null default now(),
 primary key(user_id,account_id,id)
);
alter table public.private_phone_mcp_connections add column if not exists activated_digest text;
alter table public.private_phone_mcp_connections add column if not exists credential_epoch bigint not null default 0;
alter table public.private_phone_mcp_connections add column if not exists staging_credential_epoch bigint;
alter table public.private_phone_mcp_connections add column if not exists staging_reset_credentials boolean not null default false;
create table if not exists public.private_phone_mcp_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 account_id text not null,
 connection_id text not null,
 id uuid not null,
 digest text not null,
 state text not null check(state in ('claimed','submitted','complete','unknown')),
 ciphertext text check(length(ciphertext)<=4000000),
 created_at timestamptz not null default now(),
 primary key(user_id,account_id,connection_id,id)
);
alter table public.private_phone_mcp_operations drop constraint if exists private_phone_mcp_operations_ciphertext_check;
alter table public.private_phone_mcp_operations add constraint private_phone_mcp_operations_ciphertext_check check(length(ciphertext)<=4000000);
alter table public.private_phone_mcp_connections enable row level security;
alter table public.private_phone_mcp_operations enable row level security;
revoke all on public.private_phone_mcp_connections,public.private_phone_mcp_operations from public,anon,authenticated;
grant select,insert,update,delete on public.private_phone_mcp_connections,public.private_phone_mcp_operations to service_role;

create or replace function public.private_phone_mcp_read(p_user uuid,p_session uuid,p_device uuid,p_account text,p_id text default null,p_after text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb; more boolean;
begin
 perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
 if length(p_account) not between 1 and 160 then raise exception 'invalid_account'; end if;
 if p_id is not null then
  select jsonb_build_object('id',id,'revision',revision::text,'ciphertext',ciphertext,'active',active,'deleted',deleted,
    'stagingNonce',staging_nonce,'activatedNonce',activated_nonce,'refreshUnknown',refresh_unknown)
   into rows from public.private_phone_mcp_connections where user_id=p_user and account_id=p_account and id=p_id;
  return jsonb_build_object('connection',rows);
 end if;
 select coalesce(jsonb_agg(item),'[]'::jsonb) into rows from (
  select jsonb_build_object('id',id,'revision',revision::text,'ciphertext',ciphertext,'active',active,'deleted',deleted) item
  from public.private_phone_mcp_connections where user_id=p_user and account_id=p_account and id>p_after and active
  order by id limit 1
 ) page;
 select exists(select 1 from public.private_phone_mcp_connections where user_id=p_user and account_id=p_account and active and id>coalesce(rows->0->>'id',p_after)) into more;
 return jsonb_build_object('connections',rows,'nextCursor',case when more then rows->0->>'id' else null end);
end $$;

drop function if exists public.private_phone_mcp_put(uuid,uuid,uuid,text,text,bigint,uuid,text,text,boolean);
create or replace function public.private_phone_mcp_put(p_user uuid,p_session uuid,p_device uuid,p_account text,p_id text,p_revision bigint,p_nonce uuid,p_digest text,p_ciphertext text,p_activate boolean default false,p_reset_credentials boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.private_phone_mcp_connections%rowtype;
begin
 perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
 perform pg_advisory_xact_lock(hashtextextended('mcp/'||p_user::text||'/'||p_account||'/'||p_id,5));
 if p_account is null or length(p_account) not between 1 and 160 or p_id is null or length(p_id) not between 1 and 100 or p_nonce is null
   or p_revision is null or p_revision<0 or p_digest is null or length(p_digest) not between 40 and 100 then raise exception 'invalid_change'; end if;
 insert into public.private_phone_mcp_connections(user_id,account_id,id) values(p_user,p_account,p_id) on conflict do nothing;
 select * into c from public.private_phone_mcp_connections where user_id=p_user and account_id=p_account and id=p_id for update;
 if c.activated_nonce=p_nonce then
  if c.activated_digest is distinct from p_digest then raise exception 'mutation_payload_changed';end if;
  if c.deleted then raise exception 'connection_missing';end if;
  return jsonb_build_object('ok',true,'active',c.active,'revision',c.revision::text);
 end if;
 if c.revision<>p_revision then raise exception 'connection_changed';end if;
 if c.lease_until>now() then raise exception 'connection_busy';end if;
 if p_activate then
  if c.staging_nonce is distinct from p_nonce or c.staging_digest is distinct from p_digest or c.staging_ciphertext is null then raise exception 'migration_changed';end if;
  if c.staging_credential_epoch is distinct from c.credential_epoch then raise exception 'credential_changed';end if;
  if c.refresh_unknown and not c.staging_reset_credentials then raise exception 'refresh_result_unknown';end if;
  update public.private_phone_mcp_connections set ciphertext=staging_ciphertext,active=true,deleted=false,revision=revision+1,
   activated_nonce=p_nonce,activated_digest=p_digest,staging_ciphertext=null,staging_nonce=null,staging_digest=null,
   credential_epoch=credential_epoch+1,refresh_unknown=false,updated_at=now()
   where user_id=p_user and account_id=p_account and id=p_id returning * into c;
 else
  if p_ciphertext is null or length(p_ciphertext)>1800000 then raise exception 'invalid_change';end if;
  if c.staging_nonce=p_nonce and c.staging_digest is distinct from p_digest then raise exception 'mutation_payload_changed';end if;
  update public.private_phone_mcp_connections set staging_ciphertext=p_ciphertext,staging_nonce=p_nonce,staging_digest=p_digest,
   staging_credential_epoch=credential_epoch,staging_reset_credentials=p_reset_credentials
   where user_id=p_user and account_id=p_account and id=p_id;
 end if;
 return jsonb_build_object('ok',true,'active',case when p_activate then true else c.active end,'revision',c.revision::text);
end $$;

create or replace function public.private_phone_mcp_remove(p_user uuid,p_session uuid,p_device uuid,p_account text,p_id text,p_revision bigint,p_keep_ciphertext text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
 perform pg_advisory_xact_lock(hashtextextended('mcp/'||p_user::text||'/'||p_account||'/'||p_id,5));
 update public.private_phone_mcp_connections set active=true,deleted=(p_keep_ciphertext is null),ciphertext=p_keep_ciphertext,staging_ciphertext=null,staging_nonce=null,
  lease_token=null,lease_until=null,revision=revision+1,updated_at=now()
  where user_id=p_user and account_id=p_account and id=p_id and revision=p_revision;
 if not found then raise exception 'connection_changed';end if;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.private_phone_mcp_claim(p_user uuid,p_session uuid,p_device uuid,p_account text,p_id text,p_revision bigint,p_operation uuid,p_digest text,p_lease uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.private_phone_mcp_connections%rowtype; op public.private_phone_mcp_operations%rowtype;
begin
 perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
 perform pg_advisory_xact_lock(hashtextextended('mcp/'||p_user::text||'/'||p_account||'/'||p_id,5));
 select * into c from public.private_phone_mcp_connections where user_id=p_user and account_id=p_account and id=p_id for update;
 if not found or not c.active or c.deleted then raise exception 'connection_missing';end if;
 if c.revision<>p_revision then raise exception 'connection_changed';end if;
 select * into op from public.private_phone_mcp_operations where user_id=p_user and account_id=p_account and connection_id=p_id and id=p_operation;
 if found then
  if op.digest<>p_digest then raise exception 'mutation_payload_changed';end if;
  if op.state='complete' then return jsonb_build_object('state','complete','ciphertext',op.ciphertext);end if;
  return jsonb_build_object('state','unknown');
 end if;
 if c.lease_until>now() then return jsonb_build_object('state','busy');end if;
 if c.refresh_unknown then raise exception 'refresh_result_unknown';end if;
 update public.private_phone_mcp_connections set lease_token=p_lease,lease_until=now()+interval '55 seconds'
  where user_id=p_user and account_id=p_account and id=p_id;
 insert into public.private_phone_mcp_operations(user_id,account_id,connection_id,id,digest,state) values(p_user,p_account,p_id,p_operation,p_digest,'claimed');
 return jsonb_build_object('state','claimed','ciphertext',c.ciphertext);
end $$;

create or replace function public.private_phone_mcp_progress(p_user uuid,p_session uuid,p_device uuid,p_account text,p_id text,p_operation uuid,p_lease uuid,p_phase text,p_ciphertext text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
 perform 1 from public.private_phone_mcp_connections where user_id=p_user and account_id=p_account and id=p_id and lease_token=p_lease and lease_until>now() and not deleted for update;
 if not found then raise exception 'operation_lease_expired';end if;
 if p_phase='refresh-start' then
  update public.private_phone_mcp_connections set refresh_unknown=true where user_id=p_user and account_id=p_account and id=p_id;
 elsif p_phase='refresh-complete' then
  if p_ciphertext is null then raise exception 'invalid_change';end if;
  update public.private_phone_mcp_connections set ciphertext=p_ciphertext,refresh_unknown=false,credential_epoch=credential_epoch+1 where user_id=p_user and account_id=p_account and id=p_id;
 elsif p_phase='submitted' then
  update public.private_phone_mcp_operations set state='submitted' where user_id=p_user and account_id=p_account and connection_id=p_id and id=p_operation and state='claimed';
 elsif p_phase in ('complete','unknown') then
  if p_phase='complete' and p_ciphertext is null then raise exception 'invalid_change';end if;
  update public.private_phone_mcp_operations set state=p_phase,ciphertext=p_ciphertext where user_id=p_user and account_id=p_account and connection_id=p_id and id=p_operation;
  update public.private_phone_mcp_connections set lease_token=null,lease_until=null where user_id=p_user and account_id=p_account and id=p_id;
 else raise exception 'invalid_phase';end if;
 return jsonb_build_object('ok',true);
end $$;

revoke all on function public.private_phone_mcp_read(uuid,uuid,uuid,text,text,text),public.private_phone_mcp_put(uuid,uuid,uuid,text,text,bigint,uuid,text,text,boolean,boolean),
 public.private_phone_mcp_remove(uuid,uuid,uuid,text,text,bigint,text),public.private_phone_mcp_claim(uuid,uuid,uuid,text,text,bigint,uuid,text,uuid),
 public.private_phone_mcp_progress(uuid,uuid,uuid,text,text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.private_phone_mcp_read(uuid,uuid,uuid,text,text,text),public.private_phone_mcp_put(uuid,uuid,uuid,text,text,bigint,uuid,text,text,boolean,boolean),
 public.private_phone_mcp_remove(uuid,uuid,uuid,text,text,bigint,text),public.private_phone_mcp_claim(uuid,uuid,uuid,text,text,bigint,uuid,text,uuid),
 public.private_phone_mcp_progress(uuid,uuid,uuid,text,text,uuid,uuid,text,text) to service_role;
