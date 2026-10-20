-- SKY_ROLE_SYNC_V1: private, explicitly paired role channel. No backup access.
create table if not exists public.phone_sky_roles (
 id uuid primary key default gen_random_uuid(), target text not null,
 account_id text not null, role_id text not null, device_hash text not null,
 packet jsonb not null default '{}'::jsonb, revision bigint not null default 0,
 scene text not null default 'phone', scene_version bigint not null default 0,
 session_id text not null default '', updated_at timestamptz not null default now(),
 unique(target,account_id,role_id)
);
create table if not exists public.phone_sky_events (
 seq bigint generated always as identity primary key,
 link_id uuid not null references public.phone_sky_roles(id) on delete cascade,
 event_id text not null, event jsonb not null, received_at timestamptz not null default now(),
 unique(link_id,event_id)
);
alter table public.phone_sky_roles enable row level security;
alter table public.phone_sky_events enable row level security;
revoke all on public.phone_sky_roles,public.phone_sky_events from public,anon,authenticated;

create or replace function public.phone_sky_owner(
 p_target text,p_secret text,p_account text,p_role text,p_action text,
 p_packet jsonb default null,p_after bigint default 0,p_device_token text default null,
 p_expected_version bigint default null
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare r public.phone_sky_roles; events jsonb; cursor_value bigint;
begin
 if not public.phone_companion_owner_ok(p_target,p_secret) then raise exception 'unauthorized' using errcode='42501'; end if;
 if length(coalesce(p_account,'')) not between 1 and 80 or length(coalesce(p_role,'')) not between 1 and 80 then raise exception 'invalid-binding'; end if;
 if p_action='bind' then
  if length(coalesce(p_device_token,''))<48 then raise exception 'invalid-device-token'; end if;
  insert into public.phone_sky_roles(target,account_id,role_id,device_hash)
   values(p_target,p_account,p_role,public.phone_companion_hash(p_device_token))
   on conflict(target,account_id,role_id) do update set device_hash=excluded.device_hash;
 end if;
 select * into r from public.phone_sky_roles where target=p_target and account_id=p_account and role_id=p_role for update;
 if not found then raise exception 'not-bound'; end if;
 if p_action not in ('bind','sync','phone') then raise exception 'invalid-action'; end if;
 if p_action='phone' then
  if p_expected_version is not null and p_expected_version is distinct from r.scene_version then raise exception 'scene-changed-retry'; end if;
  update public.phone_sky_roles set scene='phone',scene_version=scene_version+1 where id=r.id returning * into r;
 end if;
 if p_packet is not null then
  if jsonb_typeof(p_packet)<>'object' or octet_length(p_packet::text)>2097152 then raise exception 'invalid-packet'; end if;
  if p_packet->>'accountId' is distinct from p_account or p_packet->>'roleId' is distinct from p_role then raise exception 'binding-mismatch'; end if;
  if coalesce((p_packet->>'contextRounds')::int,0) not between 2 and 100 then raise exception 'invalid-context'; end if;
  update public.phone_sky_roles set packet=jsonb_set(p_packet,'{phoneCursor}',to_jsonb(p_after)),revision=revision+1,updated_at=now() where id=r.id returning * into r;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('seq',seq,'event',event) order by seq),'[]'::jsonb),coalesce(max(seq),p_after)
 into events,cursor_value from (select seq,event from public.phone_sky_events where link_id=r.id and seq>p_after order by seq limit 200) e;
 return jsonb_build_object('ok',true,'linkId',r.id,'revision',r.revision,'scene',r.scene,'sceneVersion',r.scene_version,'session',r.session_id,'events',events,'cursor',cursor_value);
end $$;

create or replace function public.phone_sky_device(
 p_link uuid,p_token text,p_action text,p_session text default '',
 p_expected_version bigint default null,p_events jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare r public.phone_sky_roles; e jsonb; accepted jsonb='[]'::jsonb; accepted_sequences jsonb='{}'::jsonb; event_seq bigint;
begin
 select * into r from public.phone_sky_roles where id=p_link and device_hash=public.phone_companion_hash(p_token) for update;
 if not found then raise exception 'unauthorized' using errcode='42501'; end if;
 if p_action not in ('pull','start','append','status') then raise exception 'invalid-action'; end if;
 if p_action='status' then return jsonb_build_object('ok',true,'revision',r.revision,'scene',r.scene,'sceneVersion',r.scene_version,'session',r.session_id); end if;
 if p_action='start' then
  if p_expected_version is distinct from r.scene_version then raise exception 'scene-changed-retry'; end if;
  if length(p_session) not between 16 and 80 then raise exception 'invalid-session'; end if;
  update public.phone_sky_roles set scene='sky',scene_version=scene_version+1,session_id=p_session where id=r.id returning * into r;
 end if;
 if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>100 or octet_length(p_events::text)>1048576 then raise exception 'invalid-events'; end if;
 for e in select value from jsonb_array_elements(p_events) loop
  if coalesce(e->>'role','') not in ('user','assistant') or coalesce(e->>'source','')<>'sky' or length(coalesce(e->>'id','')) not between 16 and 100 or length(coalesce(e->>'text','')) not between 1 and 20000 or length(coalesce(e->>'session','')) not between 16 and 80 then raise exception 'invalid-event'; end if;
  insert into public.phone_sky_events(link_id,event_id,event) values(r.id,e->>'id',e)
   on conflict(link_id,event_id) do nothing;
  accepted=accepted||jsonb_build_array(e->>'id');
  select seq into event_seq from public.phone_sky_events where link_id=r.id and event_id=e->>'id';
  accepted_sequences=accepted_sequences||jsonb_build_object(e->>'id',event_seq);
 end loop;
 return jsonb_build_object('ok',true,'packet',r.packet,'revision',r.revision,'scene',r.scene,'sceneVersion',r.scene_version,'session',r.session_id,'accepted',accepted,'acceptedSequences',accepted_sequences,'updatedAt',r.updated_at);
end $$;
revoke all on function public.phone_sky_owner(text,text,text,text,text,jsonb,bigint,text,bigint) from public;
revoke all on function public.phone_sky_device(uuid,text,text,text,bigint,jsonb) from public;
grant execute on function public.phone_sky_owner(text,text,text,text,text,jsonb,bigint,text,bigint) to anon,authenticated;
grant execute on function public.phone_sky_device(uuid,text,text,text,bigint,jsonb) to anon,authenticated;
