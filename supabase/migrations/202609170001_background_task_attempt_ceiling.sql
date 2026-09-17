-- A reply_handoff task is "finish the reply she is already waiting for", so it
-- deliberately has no cooldown and no daily cap: normally it runs once and the
-- app cancels it. But phone_role_background_claim_due re-picks any task whose
-- two-minute lease expired, and `attempts` was incremented without ever being
-- read. A task the app could not cancel therefore called the model again every
-- two minutes, forever — each run a paid call, each run believing it was the
-- first time the role had spoken, and each run pushing another notification.
--
-- The client now cancels the server task on both paths that used to leave it
-- running (a locally answered turn, and a turn that cannot be delivered while
-- the user is in cohabitation, an offline date or a call). This ceiling is the
-- backstop for any path still unaccounted for: a task that has burned through
-- its attempts stops being claimable instead of running unbounded.

create or replace function public.phone_role_background_claim_due(p_limit integer default 20)
returns setof public.phone_role_background_tasks
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  return query
  with picked as (
    select id from public.phone_role_background_tasks
     where (status = 'pending' or (status = 'claimed' and claimed_until < now()))
       and due_at <= now()
       and attempts < 3
     order by due_at asc
     for update skip locked
     limit greatest(1, least(50, coalesce(p_limit, 20)))
  )
  update public.phone_role_background_tasks t
     set status = 'claimed', claimed_until = now() + interval '2 minutes', attempts = t.attempts + 1
    from picked where t.id = picked.id
  returning t.*;
end;
$$;

-- A task that exhausted its attempts is retired rather than left 'claimed'
-- forever, so the table does not accumulate rows that can never run again.
create or replace function public.phone_role_background_retire_exhausted()
returns integer language plpgsql security definer
set search_path = public, extensions as $$
declare v_count integer;
begin
  update public.phone_role_background_tasks
     set status = 'canceled', completed_at = now(), claimed_until = null
   where status in ('pending', 'claimed')
     and attempts >= 3
     and (claimed_until is null or claimed_until < now());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.phone_role_background_retire_exhausted() from public;
