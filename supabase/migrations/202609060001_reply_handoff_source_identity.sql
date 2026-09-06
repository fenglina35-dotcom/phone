-- Add exact source identity to reply handoffs; ordinary proactive rows remain unassociated.
create or replace function public.phone_role_push_pull(
  p_target text,
  p_owner_secret text,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.phone_companion_owner_ok(trim(p_target), p_owner_secret) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', x.id, 'roleId', x.role_id, 'roleName', x.role_name,
      'body', x.body, 'triggerKind', x.trigger_kind,
      'pushStatus', x.push_status, 'createdAt', x.created_at,
      'consumedAt', x.consumed_at,
      'replyToMessageId', case when x.trigger_kind = 'reply_handoff' then t.payload->>'messageId' end,
      'replyToAccountId', case when x.trigger_kind = 'reply_handoff' then coalesce(nullif(t.payload->>'accountId', ''), 'main') end
    ) order by (x.consumed_at is not null), x.created_at)
    from (
      select * from public.phone_role_push_outbox
      where target = trim(p_target)
        and (
          consumed_at is null
          or (push_status = 'sent' and consumed_at >= now() - interval '24 hours')
        )
      order by (consumed_at is not null), created_at asc
      limit greatest(1, least(50, coalesce(p_limit, 20)))
    ) x
    left join public.phone_role_background_tasks t
      on x.trigger_kind = 'reply_handoff' and t.kind = 'reply_handoff'
      and x.dedupe_key = 'task:' || t.id::text
      and t.target = x.target and t.role_id = x.role_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.phone_role_push_pull(text, text, integer) from public;
grant execute on function public.phone_role_push_pull(text, text, integer) to anon, authenticated;

-- Completing an old reply must not cancel the role's newer user turn.
create or replace function public.phone_role_background_complete_turn(
  p_target text, p_owner_secret text, p_role_id text, p_message_id text
) returns boolean language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not public.phone_companion_owner_ok(trim(p_target), p_owner_secret)
     or coalesce(trim(p_message_id), '') = '' then return false; end if;
  update public.phone_role_background_tasks
     set status = 'canceled', completed_at = now(), claimed_until = null
   where target = trim(p_target) and role_id = p_role_id and kind = 'reply_handoff'
     and payload->>'messageId' = p_message_id
     and coalesce(nullif(payload->>'accountId',''),'main') = 'main' and status in ('pending', 'claimed');
  return true;
end;
$$;
revoke all on function public.phone_role_background_complete_turn(text,text,text,text) from public;
grant execute on function public.phone_role_background_complete_turn(text,text,text,text) to anon, authenticated;
