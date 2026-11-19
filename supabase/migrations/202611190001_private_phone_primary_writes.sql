-- PRIVATE_PRIMARY_ONLY_WRITES_V1: only the current primary may change account state.
-- Checked under the same account transaction lock as primary transfer.
-- Existing records, deletions, conflicts, backup data, encryption and ACLs remain intact.
-- MCP credentials have a separate explicitly authorized vault protocol.

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
  if not coalesce((public.private_phone_sync_authority(p_user,p_session,p_device)->>'isPrimary')::boolean,false)
    then raise exception 'primary_required'; end if;
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

create or replace function public.private_phone_sync_resolve(
  p_user uuid,p_session uuid,p_device uuid,p_conflict uuid,p_choice text,
  p_revision bigint,p_mutation uuid,p_digest text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare candidate public.private_phone_sync_conflicts%rowtype; result jsonb; current_revision bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('sync/'||p_user::text,2));
  perform public.private_phone_sync_assert_device(p_user,p_session,p_device);
  if not coalesce((public.private_phone_sync_authority(p_user,p_session,p_device)->>'isPrimary')::boolean,false)
    then raise exception 'primary_required'; end if;
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
  select revision into current_revision from public.private_phone_sync_records
    where user_id=p_user and record_key=candidate.record_key;
  if coalesce(current_revision,0)<>p_revision then
    return jsonb_build_object('ok',true,'resolved',false,'reason','revision_changed');
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
