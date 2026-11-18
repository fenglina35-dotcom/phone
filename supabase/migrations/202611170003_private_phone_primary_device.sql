-- PRIVATE_PRIMARY_DEVICE_V1: authority is independent of the immutable first-sync source.
-- Additive migration. No backup, record, conflict, ciphertext or root key is replaced.
-- Replacing an existing function preserves its ACL, including the incident pause.
create table if not exists public.private_phone_sync_primary (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_id uuid not null references public.private_phone_sync_devices(id),
  revision bigint not null default 1 check (revision > 0),
  changed_at timestamptz not null default now()
);
alter table public.private_phone_sync_primary enable row level security;
revoke all on public.private_phone_sync_primary from public, anon, authenticated;
grant select,insert,update on public.private_phone_sync_primary to service_role;

create or replace function public.private_phone_sync_authority(
  p_user uuid,p_session uuid,p_device uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare authority public.private_phone_sync_primary%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('sync/'||p_user::text,2));
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  -- Only the originally registered iPhone can become the implicit initial primary.
  -- Ordinary registration or re-login can never seize an existing primary role.
  insert into public.private_phone_sync_primary(user_id,device_id)
    select s.user_id,s.seed_device from public.private_phone_sync_state s
      join public.private_phone_sync_devices d on d.id=s.seed_device and d.user_id=s.user_id
      where s.user_id=p_user and d.platform='iOS' and d.revoked_at is null
    on conflict(user_id) do nothing;
  select * into authority from public.private_phone_sync_primary where user_id=p_user;
  return jsonb_build_object('primaryDeviceId',authority.device_id,
    'primaryRevision',coalesce(authority.revision,0)::text,
    'isPrimary',coalesce(authority.device_id=p_device,false));
end $$;

-- Called only by the fixed native endpoint AFTER a fresh Auth password verification.
-- Never grant this function to anon/authenticated; a normal JWT is insufficient.
create or replace function public.private_phone_sync_promote(
  p_user uuid,p_session uuid,p_device uuid,p_expected bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare authority jsonb; current_revision bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('sync/'||p_user::text,2));
  authority := public.private_phone_sync_authority(p_user,p_session,p_device);
  current_revision := (authority->>'primaryRevision')::bigint;
  if p_expected is null or p_expected<>current_revision then raise exception 'primary_changed'; end if;
  if authority->>'primaryDeviceId'=p_device::text then return authority || '{"ok":true}'::jsonb; end if;
  insert into public.private_phone_sync_primary(user_id,device_id,revision)
    values(p_user,p_device,current_revision+1)
    on conflict(user_id) do update set device_id=excluded.device_id,
      revision=excluded.revision,changed_at=now();
  return jsonb_build_object('ok',true,'primaryDeviceId',p_device,
    'primaryRevision',(current_revision+1)::text,'isPrimary',true);
end $$;

create or replace function public.private_phone_sync_revoke(
  p_user uuid,p_session uuid,p_device uuid,p_target uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare authority jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('sync/'||p_user::text,2));
  authority := public.private_phone_sync_authority(p_user,p_session,p_device);
  if not (authority->>'isPrimary')::boolean then raise exception 'primary_required'; end if;
  if p_target=p_device then raise exception 'cannot_revoke_primary'; end if;
  update public.private_phone_sync_devices set revoked_at=coalesce(revoked_at,now())
    where user_id=p_user and id=p_target;
  if not found then raise exception 'device_not_found'; end if;
  delete from public.private_phone_sync_turns where user_id=p_user and device_id=p_target;
  return jsonb_build_object('ok',true);
end $$;

revoke all on function public.private_phone_sync_authority(uuid,uuid,uuid),
  public.private_phone_sync_promote(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.private_phone_sync_authority(uuid,uuid,uuid),
  public.private_phone_sync_promote(uuid,uuid,uuid,bigint) to service_role;
-- Deliberately do NOT restore execute grants on the nine paused sync functions.

-- PRIVATE_SYNC_GENERATION_V2: quarantine previous bootstrap records in place.
-- Logical records of the new generation use state/sync2/ and blob/sync2/ keys.
-- No old record, mutation, conflict, wrapped key or backup is deleted.
alter table public.private_phone_sync_state drop constraint if exists private_phone_sync_state_format_check;
alter table public.private_phone_sync_state add constraint private_phone_sync_state_format_check check(format in (1,2));
create table if not exists public.private_phone_sync_bootstrap_archive (
  user_id uuid not null references auth.users(id) on delete cascade,
  format integer not null,
  state jsonb not null,
  archived_at timestamptz not null default now(),
  primary key(user_id,format)
);
alter table public.private_phone_sync_bootstrap_archive enable row level security;
revoke all on public.private_phone_sync_bootstrap_archive from public,anon,authenticated;
grant select,insert on public.private_phone_sync_bootstrap_archive to service_role;

create or replace function public.private_phone_sync_v2_status(p_user uuid,p_session uuid,p_device uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  return (select jsonb_build_object('phase',phase,'format',format,'sourceDeviceId',seed_device)
    from public.private_phone_sync_state where user_id=p_user and format=2);
end $$;

create or replace function public.private_phone_sync_v2_seed(p_user uuid,p_session uuid,p_device uuid,p_finish boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare seed public.private_phone_sync_state%rowtype; authority jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('sync/'||p_user::text,2));
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  select * into seed from public.private_phone_sync_state where user_id=p_user for update;
  if not found or seed.format<>2 then
    if p_finish is not false then raise exception 'invalid_seed'; end if;
    if not exists(select 1 from public.private_phone_sync_devices where id=p_device and platform='iOS') then raise exception 'seed_requires_phone'; end if;
    authority := public.private_phone_sync_authority(p_user,p_session,p_device);
    if authority->>'primaryDeviceId' is not null and not (authority->>'isPrimary')::boolean then raise exception 'primary_required'; end if;
    if seed.user_id is not null then
      insert into public.private_phone_sync_bootstrap_archive(user_id,format,state)
        values(p_user,seed.format,to_jsonb(seed)) on conflict(user_id,format) do nothing;
    end if;
    insert into public.private_phone_sync_state(user_id,seed_device,phase,format)
      values(p_user,p_device,'pending',2) on conflict(user_id) do update
      set seed_device=excluded.seed_device,phase='pending',format=2,created_at=now(),ready_at=null;
  end if;
  select * into seed from public.private_phone_sync_state where user_id=p_user for update;
  if seed.phase='pending' and seed.seed_device<>p_device then raise exception 'seed_in_progress'; end if;
  if p_finish is true and seed.phase='pending' then
    if not exists(select 1 from public.private_phone_sync_records where user_id=p_user and record_key='state/sync2/schema' and not deleted) then raise exception 'empty_seed'; end if;
    update public.private_phone_sync_state set phase='ready',ready_at=now() where user_id=p_user returning * into seed;
  end if;
  return jsonb_build_object('phase',seed.phase,'format',2,'sourceDeviceId',seed.seed_device);
end $$;

create or replace function public.private_phone_sync_v2_pull(p_user uuid,p_session uuid,p_device uuid,p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare records jsonb; cursor_value bigint; more boolean;
begin
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  if p_after is null or p_after<0 then raise exception 'invalid_cursor'; end if;
  with candidates as (
    select *,sum(coalesce(octet_length(ciphertext),0)+1024) over(order by seq) as bytes,
      row_number() over(order by seq) as row_number
    from (select * from public.private_phone_sync_records where user_id=p_user and seq>p_after
      and (record_key like 'state/sync2/%' or record_key like 'blob/sync2/%') order by seq limit 200) rows
  ), page as (select * from candidates where bytes<=1048576 or row_number=1)
  select coalesce(jsonb_agg(jsonb_build_object('key',record_key,'revision',revision::text,
    'seq',seq::text,'ciphertext',ciphertext,'deleted',deleted,'deviceId',device_id) order by seq),'[]'::jsonb),
    coalesce(max(seq),p_after) into records,cursor_value from page;
  select exists(select 1 from public.private_phone_sync_records where user_id=p_user and seq>cursor_value
    and (record_key like 'state/sync2/%' or record_key like 'blob/sync2/%')) into more;
  return jsonb_build_object('records',records,'cursor',cursor_value::text,'more',more,
    'seed',public.private_phone_sync_v2_status(p_user,p_session,p_device));
end $$;
revoke all on function public.private_phone_sync_v2_status(uuid,uuid,uuid),
  public.private_phone_sync_v2_seed(uuid,uuid,uuid,boolean),public.private_phone_sync_v2_pull(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.private_phone_sync_v2_status(uuid,uuid,uuid),
  public.private_phone_sync_v2_seed(uuid,uuid,uuid,boolean),public.private_phone_sync_v2_pull(uuid,uuid,uuid,bigint) to service_role;

-- PRIVATE_REVOKED_BACKUP_SESSION_V1: a signed JWT may outlive sign-out. Keep
-- the existing owner policies and add a restrictive check for a revoked device.
create or replace function public.private_phone_sync_session_allowed()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare owner uuid; session uuid;
begin
  owner := auth.uid();
  begin session := (auth.jwt()->>'session_id')::uuid; exception when others then return false; end;
  if owner is null or session is null then return false; end if;
  return not exists(select 1 from public.private_phone_sync_devices where user_id=owner
    and ((session_id=session and revoked_at is not null) or session=any(retired_sessions)));
end $$;
revoke all on function public.private_phone_sync_session_allowed() from public,anon;
grant execute on function public.private_phone_sync_session_allowed() to authenticated,service_role;
do $$
declare relation text;
begin
  foreach relation in array array['public.private_phone_backups','public.private_phone_backup_files'] loop
    if to_regclass(relation) is not null then
      execute format('drop policy if exists "private phone device session" on %s',relation);
      execute format('create policy "private phone device session" on %s as restrictive for all to authenticated using (public.private_phone_sync_session_allowed()) with check (public.private_phone_sync_session_allowed())',relation);
    end if;
  end loop;
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "private phone device session" on storage.objects';
    execute 'create policy "private phone device session" on storage.objects as restrictive for all to authenticated using (bucket_id<>''private-phone-backups'' or public.private_phone_sync_session_allowed()) with check (bucket_id<>''private-phone-backups'' or public.private_phone_sync_session_allowed())';
  end if;
end $$;
