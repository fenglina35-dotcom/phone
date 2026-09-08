-- Owner-authenticated, read-only history shared by the public controller and private app.
create or replace function public.phone_role_push_history(p_target text,p_owner_secret text,p_role_id text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
begin
 if not public.phone_companion_owner_ok(p_target,p_owner_secret) then raise exception 'owner-not-linked'; end if;
 return coalesce((select jsonb_agg(row order by at desc) from (
  select o.created_at as at,jsonb_build_object('at',o.created_at,'body',o.body,'outcome','message','pushStatus',o.push_status,'reason',coalesce(o.push_error,'')) as row
  from public.phone_role_push_outbox o where o.target=p_target and o.role_id=p_role_id
  union all
  select a.attempted_at,jsonb_build_object('at',a.attempted_at,'body','','outcome',a.outcome,'pushStatus',a.push_status,'reason',a.reason)
  from public.phone_role_push_attempts a where a.target=p_target and a.role_id=p_role_id and a.outbox_id is null
  order by at desc limit 60
 ) recent),'[]'::jsonb);
end $$;
revoke all on function public.phone_role_push_history(text,text,text) from public;
grant execute on function public.phone_role_push_history(text,text,text) to anon,authenticated;
