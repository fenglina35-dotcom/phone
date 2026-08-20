-- Background diagnostics must never keep competing with a real user reply.
-- Advancing last_user_at is authoritative user activity, so cancel only the
-- disposable test/follow-up tasks. The new reply_handoff for that same user
-- message is enqueued afterwards and remains independent.
create or replace function public.phone_role_cancel_followup_on_user_activity()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.last_user_at is distinct from old.last_user_at
     and new.last_user_at > coalesce(old.last_user_at, '-infinity'::timestamptz) then
    update public.phone_role_background_tasks
       set status = 'canceled', completed_at = now(), claimed_until = null
     where target = new.target and role_id = new.role_id
       and kind in ('app_followup', 'one_minute_test', 'app_watch_test')
       and status in ('pending', 'claimed');
  end if;
  return new;
end;
$$;

drop trigger if exists phone_role_cancel_followup_on_user_activity on public.phone_role_push_profiles;
create trigger phone_role_cancel_followup_on_user_activity
after update of last_user_at on public.phone_role_push_profiles
for each row execute function public.phone_role_cancel_followup_on_user_activity();
