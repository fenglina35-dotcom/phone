begin;
-- New sessions opt into 2.5x initial speed; versions 1 and 2 remain unchanged.
alter table public.north_runner_sessions drop constraint north_runner_sessions_physics_version_check;
alter table public.north_runner_sessions add constraint north_runner_sessions_physics_version_check check(physics_version in (1,2,3));
create or replace function public.north_market_runner_start(p_phone_id text,p_secret text,p_client uuid,p_physics integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;result jsonb;previous uuid;version integer;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 if p_physics not in (2,3) or p_physics is null then raise exception 'runner-invalid';end if;
 select id into previous from public.north_runner_sessions where owner_id=actor and client_id=p_client;
 result:=public.north_market_runner_start(p_phone_id,p_secret,p_client);
 if previous is null then update public.north_runner_sessions set physics_version=p_physics where id=(result->>'id')::uuid and owner_id=actor;end if;
 select physics_version into version from public.north_runner_sessions where id=(result->>'id')::uuid and owner_id=actor;
 return result||jsonb_build_object('physicsVersion',version);
end $$;
revoke all on function public.north_market_runner_start(text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.north_market_runner_start(text,text,uuid,integer) to anon,authenticated;
create or replace function public.north_market_runner_claim(p_phone_id text,p_secret text,p_id uuid,p_ticks integer,p_inputs jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;s public.north_runner_sessions;state jsonb;used integer;amount integer;
 n bigint;lane integer:=1;hearts integer:=3;jump_until integer:=0;slide_until integer:=0;shield_until integer:=0;
 row_distance bigint:=18000;world_distance bigint:=0;position_x integer:=1000;safe_lane integer:=1;warm_lane integer;pattern integer;row_index integer:=0;obstacle_lane integer;obstacle_type integer;blocked boolean;
 t integer;j integer:=0;len integer;event_tick integer;last_tick integer:=-6;a text;orders integer;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into s from public.north_runner_sessions where id=p_id and owner_id=actor for update;
 if not found then raise exception 'runner-invalid';end if;
 if s.status='claimed' then return public.north_market_runner_status(p_phone_id,p_secret)||jsonb_build_object('reward',s.reward,'duplicate',true);end if;
 if s.status<>'playing' or s.started_at<now()-interval '6 minutes' then raise exception 'runner-expired';end if;
 if p_ticks is null or p_ticks<1 or p_ticks>6000 or jsonb_typeof(p_inputs) is distinct from 'array' or jsonb_array_length(p_inputs)>1001 then raise exception 'runner-invalid';end if;
 if extract(epoch from(now()-s.started_at)) < p_ticks/60.0-2 then raise exception 'runner-too-fast';end if;
 len:=jsonb_array_length(p_inputs);
 -- Validate every control event before replay; the client cannot supply a score.
 if len>0 then for j in 0..len-1 loop
  if jsonb_typeof(p_inputs->j) is distinct from 'object' or (p_inputs->j->>'t') !~ '^[0-9]{1,4}$' or coalesce(p_inputs->j->>'a','') not in ('l','r','u','d') or not(p_inputs->j ? 't' and p_inputs->j ? 'a') then raise exception 'runner-invalid';end if;
  event_tick:=(p_inputs->j->>'t')::integer;
  if event_tick-last_tick<6 or event_tick>=p_ticks then raise exception 'runner-invalid';end if;
  last_tick:=event_tick;
 end loop;end if;
 j:=0;n:=s.seed;if s.physics_version=3 then row_distance:=45000;end if;
 for t in 0..p_ticks loop
  if t>0 then
   position_x:=position_x+greatest(-160,least(160,lane*1000-position_x));
   world_distance:=world_distance+case when s.physics_version=3 then 400 else 160 end+case when s.physics_version=1 then least(240,t/12) else t/12 end;
   while row_distance<=world_distance loop
    n:=mod(n*48271,2147483647);
    if row_index<3 then
     warm_lane:=mod(s.seed+row_index,3);pattern:=-1;
     if warm_lane=safe_lane then safe_lane:=case when safe_lane=1 then mod(n/6,2)*2 else 1 end;end if;
    else
     pattern:=mod(n,6);
     if pattern not in (2,3) then safe_lane:=case when safe_lane=1 then mod(n/6,2)*2 else 1 end;end if;
    end if;
    for obstacle_lane in 0..2 loop
     blocked:=true;
     if pattern=-1 then blocked:=obstacle_lane=warm_lane;obstacle_type:=2;
     elsif pattern=2 then obstacle_type:=0;
     elsif pattern=3 then obstacle_type:=1;
     elsif obstacle_lane=safe_lane then blocked:=pattern=5;obstacle_type:=0;
     else obstacle_type:=2;end if;
     if blocked and abs(position_x-obstacle_lane*1000)<430
      and not(obstacle_type=0 and jump_until-t between 11 and 31)
      and not(obstacle_type=1 and slide_until-t between 4 and 38)
      and t>=shield_until then hearts:=hearts-1;shield_until:=t+50;end if;
    end loop;
    n:=mod(n*48271,2147483647);
    row_distance:=row_distance+case when s.physics_version=3 then 26000 else 0 end+case when row_index<3 then 22000+mod(n,3001) else 19000+case when s.physics_version=1 then 0 else least(12000,row_index*350) end+mod(n,4001) end;
    row_index:=row_index+1;
   end loop;
  end if;
  if j<len and (p_inputs->j->>'t')::integer=t then
   a:=p_inputs->j->>'a';j:=j+1;
   if a='l' then lane:=greatest(0,lane-1);elsif a='r' then lane:=least(2,lane+1);
   elsif a='u' and t>=jump_until and t>=slide_until then jump_until:=t+42;
   elsif a='d' and t>=jump_until and t>=slide_until then slide_until:=t+42;end if;
  end if;
  if hearts=0 and t<>p_ticks then raise exception 'runner-invalid';end if;
 end loop;
 if hearts<>0 and p_ticks<>6000 then raise exception 'runner-invalid';end if;
 orders:=least(10,p_ticks/600);
 state:=public.north_market_runner_status(p_phone_id,p_secret);used:=(state->>'used')::integer;amount:=least(orders*100,greatest(0,3000-used));
 update public.north_runner_sessions set status='claimed',finished_at=now(),ticks=p_ticks,reward=amount where id=s.id;
 if amount>0 then
  insert into public.north_market_wallets(owner_id,balance) values(actor,amount) on conflict(owner_id) do update set balance=north_market_wallets.balance+amount,updated_at=now();
  insert into public.north_market_ledger(owner_id,kind,amount,request_id,target) values(actor,'runner_reward',amount,s.id,'小袋鼠跑腿');
 end if;
 return public.north_market_runner_status(p_phone_id,p_secret)||jsonb_build_object('reward',amount,'orders',orders);
end $$;
commit;
