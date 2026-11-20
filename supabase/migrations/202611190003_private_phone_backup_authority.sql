-- PRIVATE_DEVICE_SYNC_RETIRED_V1: cloud backup retains Auth ownership, not device synchronization roles.
-- The legacy helper name is retained for existing callers. No data, keys or device sessions are deleted.
create or replace function public.private_phone_backup_assert_primary() returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'authentication required' using errcode='28000'; end if;
 perform pg_advisory_xact_lock(hashtextextended('sync/'||u::text,2));
 return u;
end $$;
revoke all on function public.private_phone_backup_assert_primary() from public,anon,authenticated;
drop policy if exists "private phone device session" on public.private_phone_backups;
drop policy if exists "private phone device session" on public.private_phone_backup_files;
drop policy if exists "private phone device session" on storage.objects;
drop policy if exists "private backup preserved owner read" on public.private_phone_backup_preserved;
create policy "private backup preserved owner read" on public.private_phone_backup_preserved
 for select to authenticated using(user_id=auth.uid());

create or replace function public.private_phone_backup_info_v2() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'backup_session_unavailable' using errcode='42501'; end if;
 return (select jsonb_build_object('preservationVersion',1,'owner',auth.uid()::text,'deviceSyncRetired',true,
 'backup',(
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

