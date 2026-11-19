-- PRIVATE_BACKUP_PRESERVATION_V1: bounded separate coverage slots; no payload deletion.
create table public.private_phone_backup_preserved (
 user_id uuid not null references auth.users(id) on delete cascade,
 slot text not null check(slot in ('previous','partial','partial_previous')),
 manifest jsonb not null,
 primary key(user_id,slot)
);
alter table public.private_phone_backup_preserved enable row level security;
revoke all on public.private_phone_backup_preserved from public,anon,authenticated;
grant select on public.private_phone_backup_preserved to authenticated;
create policy "private backup preserved owner read" on public.private_phone_backup_preserved
 for select to authenticated using(user_id=auth.uid() and public.private_phone_sync_session_allowed());

create function public.private_phone_backup_assert_primary() returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s uuid; d uuid;
begin
 if u is null then raise exception 'authentication required' using errcode='28000'; end if;
 s:=(auth.jwt()->>'session_id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended('sync/'||u::text,2));
 select id into d from public.private_phone_sync_devices
 where user_id=u and session_id=s and revoked_at is null;
 if d is null then raise exception 'backup_primary_not_verified' using errcode='42501'; end if;
 if not coalesce((public.private_phone_sync_authority(u,s,d)->>'isPrimary')::boolean,false)
 then raise exception 'backup_primary_required' using errcode='42501'; end if;
 return u;
end $$;
revoke all on function public.private_phone_backup_assert_primary() from public,anon,authenticated;

-- Keep the previous implementation private. Old clients use the guarded wrapper too.
alter function public.save_private_phone_backup_manifest(timestamptz,text,text,bigint,text,integer,integer)
 rename to private_phone_backup_save_unprotected;
revoke all on function public.private_phone_backup_save_unprotected(timestamptz,text,text,bigint,text,integer,integer)
 from public,anon,authenticated;
revoke insert,update on public.private_phone_backup_files from authenticated;

create function public.save_private_phone_backup_manifest_v2(
 p_captured_at timestamptz,p_source_build text,p_checksum text,p_byte_count bigint,
 p_storage_prefix text,p_part_count integer,p_chunk_size integer,p_missing_images integer default 0
) returns table(saved boolean,revision bigint,captured_at timestamptz,uploaded_at timestamptz,
 previous_storage_prefix text,previous_part_count integer)
language plpgsql security definer set search_path='' as $$
declare u uuid; old jsonb; existing jsonb; result record; item jsonb; retired jsonb; i integer;
begin
 u:=public.private_phone_backup_assert_primary();
 if p_captured_at is null or p_captured_at>now()+interval '5 minutes'
 or p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$'
 or p_byte_count is null or p_byte_count<=0 or p_part_count is null or p_part_count not between 1 and 256
 or p_chunk_size is null or p_chunk_size not between 1 and 6291456
 or p_byte_count>p_part_count::bigint*p_chunk_size
 or p_byte_count<=(p_part_count-1)::bigint*p_chunk_size
 or p_storage_prefix is null or p_storage_prefix !~ ('^'||u::text||'/[0-9a-f-]{36}$')
 or p_missing_images is null or p_missing_images not between 0 and 1000000
 then raise exception 'invalid backup manifest' using errcode='22023'; end if;
 -- Serialize cleanup with publication and reject a manifest if cleanup won first.
 for i in 0..p_part_count-1 loop
  perform 1 from storage.objects where bucket_id='private-phone-backups'
   and name=p_storage_prefix||'/part-'||lpad(i::text,5,'0')||'.bin' and owner_id=u::text for share;
  if not found then raise exception 'backup_parts_missing' using errcode='22023'; end if;
 end loop;
 select to_jsonb(b) into old from public.private_phone_backup_files b where user_id=u;
 select manifest into existing from public.private_phone_backup_preserved where user_id=u and slot='partial';
 -- Capture times order snapshots only; they never authorize device ownership.
 if (old is not null and (old->>'captured_at')::timestamptz>p_captured_at)
 or (existing is not null and (existing->>'captured_at')::timestamptz>p_captured_at) then
  return query select false,0::bigint,p_captured_at,now(),null::text,null::integer;return;
 end if;
 if old->>'storage_prefix'=p_storage_prefix or existing->>'storage_prefix'=p_storage_prefix then
  item:=case when old->>'storage_prefix'=p_storage_prefix then old else existing end;
  if item->>'checksum'<>p_checksum or (item->>'byte_count')::bigint<>p_byte_count
  or (item->>'part_count')::integer<>p_part_count or (item->>'chunk_size')::integer<>p_chunk_size
  or (item->>'captured_at')::timestamptz<>p_captured_at
  or coalesce((item->>'missing_images')::integer,0)<>p_missing_images then raise exception 'backup_prefix_reused'; end if;
  return query select true,coalesce((item->>'revision')::bigint,1),p_captured_at,now(),null::text,null::integer;return;
 end if;
 if p_missing_images>0 then
  select manifest into retired from public.private_phone_backup_preserved where user_id=u and slot='partial_previous';
  if existing is not null then
   insert into public.private_phone_backup_preserved values(u,'partial_previous',existing)
   on conflict(user_id,slot) do update set manifest=excluded.manifest;
  end if;
  item:=jsonb_build_object('revision',coalesce((existing->>'revision')::bigint,0)+1,
   'captured_at',p_captured_at,'uploaded_at',now(),'source_build',left(coalesce(p_source_build,''),80),
   'checksum',p_checksum,'byte_count',p_byte_count,'storage_prefix',p_storage_prefix,
   'part_count',p_part_count,'chunk_size',p_chunk_size,'missing_images',p_missing_images,
   'coverage','core-and-readable-images');
  insert into public.private_phone_backup_preserved values(u,'partial',item)
  on conflict(user_id,slot) do update set manifest=excluded.manifest;
  return query select true,(item->>'revision')::bigint,p_captured_at,now(),retired->>'storage_prefix',(retired->>'part_count')::integer;
 else
  select manifest into retired from public.private_phone_backup_preserved where user_id=u and slot='previous';
  select * into result from public.private_phone_backup_save_unprotected(
   p_captured_at,p_source_build,p_checksum,p_byte_count,p_storage_prefix,p_part_count,p_chunk_size);
  if result.saved and old is not null then
   insert into public.private_phone_backup_preserved values(u,'previous',old)
   on conflict(user_id,slot) do update set manifest=excluded.manifest;
  end if;
  -- Only return the displaced, now-unreferenced generation for best-effort cleanup.
  return query select result.saved,result.revision,result.captured_at,result.uploaded_at,
   case when result.saved then retired->>'storage_prefix' end,
   case when result.saved then (retired->>'part_count')::integer end;
 end if;
end $$;
revoke all on function public.save_private_phone_backup_manifest_v2(timestamptz,text,text,bigint,text,integer,integer,integer) from public,anon;
grant execute on function public.save_private_phone_backup_manifest_v2(timestamptz,text,text,bigint,text,integer,integer,integer) to authenticated;

create function public.save_private_phone_backup_manifest(
 p_captured_at timestamptz,p_source_build text,p_checksum text,p_byte_count bigint,
 p_storage_prefix text,p_part_count integer,p_chunk_size integer
) returns table(saved boolean,revision bigint,captured_at timestamptz,uploaded_at timestamptz,
 previous_storage_prefix text,previous_part_count integer)
language sql security invoker set search_path='' as $$
 select * from public.save_private_phone_backup_manifest_v2(p_captured_at,p_source_build,p_checksum,
 p_byte_count,p_storage_prefix,p_part_count,p_chunk_size,0)
$$;
revoke all on function public.save_private_phone_backup_manifest(timestamptz,text,text,bigint,text,integer,integer) from public,anon;
grant execute on function public.save_private_phone_backup_manifest(timestamptz,text,text,bigint,text,integer,integer) to authenticated;

create function public.private_phone_backup_object_protected(object_name text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then return true; end if;
 -- VOLATILE SPI reads take a fresh snapshot after waiting for the publisher.
 perform pg_advisory_xact_lock(hashtextextended('sync/'||u::text,2));
 return exists(select 1 from public.private_phone_backup_files where user_id=u and object_name like storage_prefix||'/%')
 or exists(select 1 from public.private_phone_backup_preserved where user_id=u and object_name like (manifest->>'storage_prefix')||'/%');
end $$;
revoke all on function public.private_phone_backup_object_protected(text) from public,anon;
grant execute on function public.private_phone_backup_object_protected(text) to authenticated;
drop policy "private phone backup object delete" on storage.objects;
create policy "private phone backup object delete" on storage.objects for delete to authenticated
 using(bucket_id='private-phone-backups' and owner_id=auth.uid()::text
 and (storage.foldername(name))[1]=auth.uid()::text
 and not public.private_phone_backup_object_protected(name));

create function public.private_phone_backup_info_v2() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.private_phone_sync_session_allowed() then raise exception 'backup_session_unavailable' using errcode='42501'; end if;
 return (select jsonb_build_object('preservationVersion',1,'backup',(
  select manifest from (
   select to_jsonb(b)||jsonb_build_object('coverage','core-and-images','missing_images',0) manifest
   from public.private_phone_backup_files b where user_id=auth.uid()
   union all
   select manifest from public.private_phone_backup_preserved where user_id=auth.uid() and slot='partial'
  ) choices order by (manifest->>'captured_at')::timestamptz desc limit 1
 )));
end $$;
revoke all on function public.private_phone_backup_info_v2() from public,anon;
grant execute on function public.private_phone_backup_info_v2() to authenticated;

-- Preserve the pre-file legacy JSON row as a read-only fallback, including for old clients.
revoke insert,update on public.private_phone_backups from authenticated;
revoke execute on function public.save_private_phone_backup(jsonb,timestamptz,text,text,bigint) from authenticated;
