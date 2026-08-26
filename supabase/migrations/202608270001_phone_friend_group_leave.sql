-- A verified non-owner member may leave a real small-phone group.
-- The group and its history remain available to every other member.
create or replace function public.phone_friend_group_leave(
  p_phone_id text,
  p_secret text,
  p_group_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := upper(trim(p_phone_id));
  v_removed boolean := false;
begin
  if not public.phone_friend_check(v_phone, p_secret) then
    raise exception 'bad-secret';
  end if;

  perform 1
  from public.phone_friend_groups
  where id = p_group_id
  for update;
  if not found then
    return false;
  end if;

  if exists(
    select 1 from public.phone_friend_groups
    where id = p_group_id and owner_id = v_phone
  ) then
    raise exception 'owner-must-disband';
  end if;

  delete from public.phone_friend_group_members
  where group_id = p_group_id
    and phone_id = v_phone;
  v_removed := found;

  update public.phone_friend_group_invites
  set status = 'declined', updated_at = now()
  where group_id = p_group_id
    and invitee_id = v_phone
    and status = 'pending';

  return v_removed;
end
$$;

revoke all on function public.phone_friend_group_leave(text,text,uuid) from public;
grant execute on function public.phone_friend_group_leave(text,text,uuid) to anon, authenticated;
