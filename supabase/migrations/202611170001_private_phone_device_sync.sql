-- PRIVATE_DEVICE_SYNC_V1: a separate journal; existing backups remain untouched.
create table if not exists public.private_phone_sync_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wrapped_key text not null check (length(wrapped_key) between 40 and 1000),
  key_version integer not null default 1 check (key_version > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.private_phone_sync_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  installation_id uuid,
  retired_sessions uuid[] not null default '{}',
  platform text not null check (platform in ('iOS','macOS')),
  label text not null check (length(label) between 1 and 80),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(user_id,session_id)
);
create unique index if not exists private_phone_sync_installation
  on public.private_phone_sync_devices(user_id,installation_id) where installation_id is not null;

create sequence if not exists public.private_phone_sync_sequence;
create table if not exists public.private_phone_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seed_device uuid not null references public.private_phone_sync_devices(id),
  phase text not null default 'pending' check (phase in ('pending','ready')),
  format integer not null default 1 check (format=1),
  created_at timestamptz not null default now(),
  ready_at timestamptz
);
create table if not exists public.private_phone_sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null check (length(record_key) between 1 and 512),
  revision bigint not null check (revision > 0),
  seq bigint not null default nextval('public.private_phone_sync_sequence'),
  ciphertext text check (length(ciphertext) <= 360000),
  deleted boolean not null default false,
  device_id uuid not null references public.private_phone_sync_devices(id),
  mutation_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key(user_id,record_key),
  check (deleted or ciphertext is not null)
);
create index if not exists private_phone_sync_records_cursor
  on public.private_phone_sync_records(user_id,seq);

create table if not exists public.private_phone_sync_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.private_phone_sync_devices(id),
  mutation_id uuid not null,
  digest text not null check (length(digest) between 40 and 100),
  outcome jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,device_id,mutation_id)
);

create table if not exists public.private_phone_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.private_phone_sync_devices(id),
  mutation_id uuid not null,
  record_key text not null,
  base_revision bigint not null,
  server_revision bigint not null,
  ciphertext text,
  deleted boolean not null,
  resolution jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,device_id,mutation_id)
);

create table if not exists public.private_phone_sync_turns (
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_key text not null check(length(thread_key) between 1 and 160),
  device_id uuid not null references public.private_phone_sync_devices(id),
  turn_key text not null check(length(turn_key) between 1 and 240),
  lease_token uuid not null,
  expires_at timestamptz not null,
  primary key(user_id,thread_key)
);
create table if not exists public.private_phone_sync_completed_turns (
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_key text not null,
  turn_key text not null,
  completed_at timestamptz not null default now(),
  primary key(user_id,thread_key,turn_key)
);

alter table public.private_phone_sync_keys enable row level security;
alter table public.private_phone_sync_devices enable row level security;
alter table public.private_phone_sync_state enable row level security;
alter table public.private_phone_sync_records enable row level security;
alter table public.private_phone_sync_mutations enable row level security;
alter table public.private_phone_sync_conflicts enable row level security;
alter table public.private_phone_sync_turns enable row level security;
alter table public.private_phone_sync_completed_turns enable row level security;
revoke all on public.private_phone_sync_keys, public.private_phone_sync_devices,
  public.private_phone_sync_records, public.private_phone_sync_mutations,
  public.private_phone_sync_conflicts,public.private_phone_sync_state,
  public.private_phone_sync_turns,public.private_phone_sync_completed_turns from public, anon, authenticated;
grant select,insert,update,delete on public.private_phone_sync_keys,
  public.private_phone_sync_devices,public.private_phone_sync_records,
  public.private_phone_sync_mutations,public.private_phone_sync_conflicts,public.private_phone_sync_state,
  public.private_phone_sync_turns,public.private_phone_sync_completed_turns to service_role;
grant usage,select on sequence public.private_phone_sync_sequence to service_role;

create or replace function public.private_phone_sync_device(
  p_user uuid,p_session uuid,p_platform text,p_label text,p_installation uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.private_phone_sync_devices%rowtype;
begin
  -- Commit order must match each account's cursor order, including concurrent devices.
  perform pg_advisory_xact_lock(hashtextextended('sync/'||p_user::text,2));
  if p_user is null or p_session is null or p_platform not in ('iOS','macOS')
     or length(p_label) not between 1 and 80 then raise exception 'invalid_device'; end if;
  if exists(select 1 from public.private_phone_sync_devices where user_id=p_user
    and p_session=any(retired_sessions)) then raise exception 'device_revoked'; end if;
  select * into d from public.private_phone_sync_devices
    where user_id=p_user and session_id=p_session for update;
  if found then
    if d.revoked_at is not null then raise exception 'device_revoked'; end if;
    if p_installation is not null and d.installation_id is not null and d.installation_id<>p_installation
      then raise exception 'invalid_device'; end if;
  elsif p_installation is not null then
    select * into d from public.private_phone_sync_devices
      where user_id=p_user and installation_id=p_installation for update;
    if found then
      if d.platform<>p_platform then raise exception 'invalid_device'; end if;
      -- Fresh password authentication re-enrols the same physical installation;
      -- an old revoked JWT session was rejected by the branch above.
      update public.private_phone_sync_devices set session_id=p_session,revoked_at=null,
        retired_sessions=array_append(retired_sessions,session_id) where id=d.id;
    end if;
  end if;
  if d.id is null then
    insert into public.private_phone_sync_devices(user_id,session_id,platform,label,installation_id)
      values(p_user,p_session,p_platform,p_label,p_installation) returning * into d;
  end if;
  update public.private_phone_sync_devices set last_seen_at=now(),label=p_label
    ,installation_id=coalesce(installation_id,p_installation)
    where id=d.id;
  return jsonb_build_object('id',d.id,'platform',d.platform,'label',p_label);
end $$;

create or replace function public.private_phone_sync_assert_device(
  p_user uuid,p_session uuid,p_device uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.private_phone_sync_devices
    where id=p_device and user_id=p_user and session_id=p_session and revoked_at is null
    for share;
  if not found then raise exception 'device_revoked_or_unknown'; end if;
end $$;

create or replace function public.private_phone_sync_seed(
  p_user uuid,p_session uuid,p_device uuid,p_finish boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare seed public.private_phone_sync_state%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('sync/'||p_user::text,2));
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  select * into seed from public.private_phone_sync_state where user_id=p_user for update;
  if not found then
    if p_finish is not false then raise exception 'invalid_seed'; end if;
    if not exists(select 1 from public.private_phone_sync_devices where id=p_device and platform='iOS')
      then raise exception 'seed_requires_phone'; end if;
    insert into public.private_phone_sync_state(user_id,seed_device) values(p_user,p_device)
      returning * into seed;
  end if;
  if seed.phase='pending' and seed.seed_device<>p_device then raise exception 'seed_in_progress'; end if;
  if p_finish is true and seed.phase='pending' then
    if not exists(select 1 from public.private_phone_sync_records where user_id=p_user)
      then raise exception 'empty_seed'; end if;
    update public.private_phone_sync_state set phase='ready',ready_at=now() where user_id=p_user
      returning * into seed;
  end if;
  return jsonb_build_object('phase',seed.phase,'format',seed.format,'sourceDeviceId',seed.seed_device);
end $$;

create or replace function public.private_phone_sync_turn(
  p_user uuid,p_session uuid,p_device uuid,p_action text,p_thread text,p_turn text,p_token uuid,p_complete boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare active public.private_phone_sync_turns%rowtype;
begin
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  if p_action not in ('acquire','renew','finish') or p_action is null or p_thread is null
    or length(p_thread) not between 1 and 160 or p_turn is null or length(p_turn) not between 1 and 240 or p_token is null
    then raise exception 'invalid_turn'; end if;
  perform pg_advisory_xact_lock(hashtextextended('turn/'||p_user::text||'/'||p_thread,3));
  if exists(select 1 from public.private_phone_sync_completed_turns where user_id=p_user and thread_key=p_thread and turn_key=p_turn)
    then return jsonb_build_object('ok',true,'acquired',false,'completed',true); end if;
  select * into active from public.private_phone_sync_turns where user_id=p_user and thread_key=p_thread for update;
  if p_action='acquire' then
    if found and active.expires_at>now() and (active.device_id<>p_device or active.lease_token<>p_token or active.turn_key<>p_turn)
      then return jsonb_build_object('ok',true,'acquired',false,'busy',true); end if;
    insert into public.private_phone_sync_turns(user_id,thread_key,device_id,turn_key,lease_token,expires_at)
      values(p_user,p_thread,p_device,p_turn,p_token,now()+interval '180 seconds')
      on conflict(user_id,thread_key) do update set device_id=excluded.device_id,turn_key=excluded.turn_key,
        lease_token=excluded.lease_token,expires_at=excluded.expires_at;
    return jsonb_build_object('ok',true,'acquired',true,'leaseSeconds',180);
  end if;
  if not found or active.device_id<>p_device or active.lease_token<>p_token or active.turn_key<>p_turn or active.expires_at<=now()
    then raise exception 'turn_lease_lost'; end if;
  if p_action='renew' then
    update public.private_phone_sync_turns set expires_at=now()+interval '180 seconds' where user_id=p_user and thread_key=p_thread;
    return jsonb_build_object('ok',true,'acquired',true,'leaseSeconds',180);
  end if;
  if p_complete is true then
    insert into public.private_phone_sync_completed_turns(user_id,thread_key,turn_key) values(p_user,p_thread,p_turn) on conflict do nothing;
  end if;
  delete from public.private_phone_sync_turns where user_id=p_user and thread_key=p_thread;
  return jsonb_build_object('ok',true,'finished',true);
end $$;

create or replace function public.private_phone_sync_apply(
  p_user uuid,p_session uuid,p_device uuid,p_changes jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  change jsonb; old public.private_phone_sync_records%rowtype;
  previous public.private_phone_sync_mutations%rowtype;
  outcome jsonb; outcomes jsonb := '[]'::jsonb; conflict_id uuid;
  key text; mutation uuid; expected bigint; deleted boolean; cipher text; digest text;
  next_revision bigint; next_sequence bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('sync/'||p_user::text,2));
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  if not exists(select 1 from public.private_phone_sync_state where user_id=p_user
    and (phase='ready' or seed_device=p_device)) then raise exception 'seed_not_ready'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes)>64
    then raise exception 'invalid_batch'; end if;
  -- Serialise retries for one device; key locks below are always acquired in sorted order.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||'/'||p_device::text,0));
  if (select count(*)<>count(distinct x->>'key') from jsonb_array_elements(p_changes) x)
    then raise exception 'duplicate_key'; end if;
  for change in select value from jsonb_array_elements(p_changes) order by value->>'key' loop
    key := change->>'key'; mutation := (change->>'mutationId')::uuid;
    expected := (change->>'baseRevision')::bigint;
    deleted := coalesce((change->>'deleted')::boolean,false);
    cipher := change->>'ciphertext'; digest := change->>'digest';
    if key is null or length(key) not between 1 and 512 or expected is null or expected<0
      or mutation is null or digest is null or length(digest) not between 40 and 100
      or (not deleted and cipher is null) or length(cipher)>360000
    then raise exception 'invalid_change'; end if;
    select * into previous from public.private_phone_sync_mutations
      where user_id=p_user and device_id=p_device and mutation_id=mutation;
    if found then
      if previous.digest<>digest then raise exception 'mutation_payload_changed'; end if;
      outcomes := outcomes||jsonb_build_array(previous.outcome);
      continue;
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p_user::text||'/'||key,1));
    select * into old from public.private_phone_sync_records
      where user_id=p_user and record_key=key for update;
    if coalesce(old.revision,0)<>expected then
      insert into public.private_phone_sync_conflicts
        (user_id,device_id,mutation_id,record_key,base_revision,server_revision,ciphertext,deleted)
        values(p_user,p_device,mutation,key,expected,coalesce(old.revision,0),cipher,deleted)
        returning id into conflict_id;
      outcome := jsonb_build_object('key',key,'mutationId',mutation,'status','conflict',
        'conflictId',conflict_id,'revision',coalesce(old.revision,0)::text);
    else
      next_revision := coalesce(old.revision,0)+1;
      next_sequence := nextval('public.private_phone_sync_sequence');
      insert into public.private_phone_sync_records
        (user_id,record_key,revision,seq,ciphertext,deleted,device_id,mutation_id)
        values(p_user,key,next_revision,next_sequence,cipher,deleted,p_device,mutation)
        on conflict(user_id,record_key) do update set revision=excluded.revision,
          seq=excluded.seq,ciphertext=excluded.ciphertext,deleted=excluded.deleted,
          device_id=excluded.device_id,mutation_id=excluded.mutation_id,updated_at=now();
      outcome := jsonb_build_object('key',key,'mutationId',mutation,'status','applied',
        'revision',next_revision::text,'seq',next_sequence::text);
    end if;
    insert into public.private_phone_sync_mutations(user_id,device_id,mutation_id,digest,outcome)
      values(p_user,p_device,mutation,digest,outcome);
    outcomes := outcomes||jsonb_build_array(outcome);
  end loop;
  return jsonb_build_object('outcomes',outcomes);
end $$;

create or replace function public.private_phone_sync_pull(
  p_user uuid,p_session uuid,p_device uuid,p_after bigint default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare records jsonb; cursor_value bigint; more boolean;
begin
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  if p_after is null or p_after<0 then raise exception 'invalid_cursor'; end if;
  with candidates as (
    select *,sum(coalesce(octet_length(ciphertext),0)+1024) over(order by seq) as bytes,
      row_number() over(order by seq) as row_number
    from (select * from public.private_phone_sync_records where user_id=p_user and seq>p_after
      order by seq limit 200) rows
  ), page as (select * from candidates where bytes<=1048576 or row_number=1)
  select coalesce(jsonb_agg(jsonb_build_object('key',record_key,'revision',revision::text,
    'seq',seq::text,'ciphertext',ciphertext,'deleted',deleted,'deviceId',device_id) order by seq),'[]'::jsonb),
    coalesce(max(seq),p_after) into records,cursor_value from page;
  select exists(select 1 from public.private_phone_sync_records
    where user_id=p_user and seq>cursor_value) into more;
  return jsonb_build_object('records',records,'cursor',cursor_value::text,'more',more,'seed',
    (select jsonb_build_object('phase',phase,'format',format,'sourceDeviceId',seed_device)
      from public.private_phone_sync_state where user_id=p_user));
end $$;

create or replace function public.private_phone_sync_revoke(
  p_user uuid,p_session uuid,p_device uuid,p_target uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('sync/'||p_user::text,2));
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  update public.private_phone_sync_devices set revoked_at=coalesce(revoked_at,now())
    where user_id=p_user and id=p_target;
  if not found then raise exception 'device_not_found'; end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.private_phone_sync_inspect(
  p_user uuid,p_session uuid,p_device uuid,p_conflict uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare devices jsonb; conflicts jsonb; candidate jsonb;
begin
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  if p_conflict is not null then
    select jsonb_build_object('id',id,'key',record_key,'baseRevision',base_revision::text,
      'revision',server_revision::text,'deleted',deleted,'ciphertext',ciphertext)
      into candidate from public.private_phone_sync_conflicts
      where user_id=p_user and id=p_conflict;
    if candidate is null then raise exception 'conflict_not_found'; end if;
    return jsonb_build_object('conflict',candidate);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'platform',platform,'label',label,
    'revokedAt',revoked_at,'lastSeenAt',last_seen_at) order by created_at),'[]'::jsonb)
    into devices from public.private_phone_sync_devices where user_id=p_user;
  select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) into conflicts from (
    select created_at,jsonb_build_object('id',id,'key',record_key,'deviceId',device_id,
      'baseRevision',base_revision::text,'revision',server_revision::text,'createdAt',created_at) item
    from public.private_phone_sync_conflicts where user_id=p_user and resolved_at is null
    order by created_at desc limit 100
  ) recent;
  return jsonb_build_object('devices',devices,'conflicts',conflicts,'seed',
    (select jsonb_build_object('phase',phase,'format',format,'sourceDeviceId',seed_device)
      from public.private_phone_sync_state where user_id=p_user));
end $$;

create or replace function public.private_phone_sync_resolve(
  p_user uuid,p_session uuid,p_device uuid,p_conflict uuid,p_choice text,
  p_revision bigint,p_mutation uuid,p_digest text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare candidate public.private_phone_sync_conflicts%rowtype; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('sync/'||p_user::text,2));
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  if p_choice not in ('server','candidate') or p_choice is null or p_mutation is null
     or p_revision is null or p_revision<0 or p_digest is null or length(p_digest) not between 40 and 100
    then raise exception 'invalid_change'; end if;
  select * into candidate from public.private_phone_sync_conflicts
    where user_id=p_user and id=p_conflict for update;
  if not found then raise exception 'conflict_not_found'; end if;
  if candidate.resolved_at is not null then
    if candidate.resolution->>'digest'<>p_digest then raise exception 'mutation_payload_changed'; end if;
    return candidate.resolution->'outcome';
  end if;
  if p_choice='server' then
    result := jsonb_build_object('ok',true,'resolved',true,'choice','server');
  else
    result := public.private_phone_sync_apply(p_user,p_session,p_device,jsonb_build_array(
      jsonb_build_object('key',candidate.record_key,'mutationId',p_mutation,
        'baseRevision',p_revision,'ciphertext',candidate.ciphertext,'deleted',candidate.deleted,'digest',p_digest)));
    if result->'outcomes'->0->>'status'<>'applied' then
      return result||jsonb_build_object('ok',true,'resolved',false);
    end if;
    result := result||jsonb_build_object('ok',true,'resolved',true,'choice','candidate');
  end if;
  update public.private_phone_sync_conflicts set resolved_at=now(),
    resolution=jsonb_build_object('digest',p_digest,'outcome',result) where id=p_conflict;
  return result;
end $$;

revoke all on function public.private_phone_sync_device(uuid,uuid,text,text,uuid),
  public.private_phone_sync_assert_device(uuid,uuid,uuid),
  public.private_phone_sync_apply(uuid,uuid,uuid,jsonb),
  public.private_phone_sync_pull(uuid,uuid,uuid,bigint),
  public.private_phone_sync_revoke(uuid,uuid,uuid,uuid),
  public.private_phone_sync_inspect(uuid,uuid,uuid,uuid),
  public.private_phone_sync_seed(uuid,uuid,uuid,boolean),
  public.private_phone_sync_turn(uuid,uuid,uuid,text,text,text,uuid,boolean),
  public.private_phone_sync_resolve(uuid,uuid,uuid,uuid,text,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.private_phone_sync_device(uuid,uuid,text,text,uuid),
  public.private_phone_sync_assert_device(uuid,uuid,uuid),
  public.private_phone_sync_apply(uuid,uuid,uuid,jsonb),
  public.private_phone_sync_pull(uuid,uuid,uuid,bigint),
  public.private_phone_sync_revoke(uuid,uuid,uuid,uuid),
  public.private_phone_sync_inspect(uuid,uuid,uuid,uuid),
  public.private_phone_sync_seed(uuid,uuid,uuid,boolean),
  public.private_phone_sync_turn(uuid,uuid,uuid,text,text,text,uuid,boolean),
  public.private_phone_sync_resolve(uuid,uuid,uuid,uuid,text,bigint,uuid,text) to service_role;
