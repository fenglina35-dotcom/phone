-- Private cloud only. Install BEFORE distributing the avatar-preserving client.
-- Preserve only the same row's photo when a marked client cannot serialize it.
-- Do not replace the profile RPC: its auth, scheduling and memory rules stay intact.
begin;
create or replace function public.phone_private_preserve_notification_avatar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.automation_config->'notificationAvatarPreserve' = 'true'::jsonb
     and coalesce(new.avatar_data, '') = '' then
    new.avatar_data := old.avatar_data;
  end if;
  return new;
end;
$$;
revoke all on function public.phone_private_preserve_notification_avatar() from public;
drop trigger if exists phone_private_preserve_notification_avatar on public.phone_role_push_profiles;
create trigger phone_private_preserve_notification_avatar
before update on public.phone_role_push_profiles
for each row execute function public.phone_private_preserve_notification_avatar();
commit;
