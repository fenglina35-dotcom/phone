-- New v6 sessions: 150 seconds, one unit per six seconds, maximum 25 per run.
-- Old v1-v5 sessions and the shared daily100 balance cap stay valid.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.north_runner_sessions drop constraint north_runner_sessions_physics_version_check;
alter table public.north_runner_sessions add constraint north_runner_sessions_physics_version_check check(physics_version in (1,2,3,4,5,6));
alter table public.north_runner_sessions drop constraint north_runner_sessions_reward_check;
alter table public.north_runner_sessions add constraint north_runner_sessions_reward_check check(reward between 0 and 2500);
do $runner_150$
declare definition text;old_limit text:='case when s.physics_version>=5 then 10800 else 6000 end';new_limit text:='case when s.physics_version>=6 then 9000 when s.physics_version>=5 then 10800 else 6000 end';old_orders text:='orders:=least(case when s.physics_version>=5 then 18 else 10 end,p_ticks/600)';
begin
 select pg_get_functiondef('public.north_market_runner_start(text,text,uuid,integer)'::regprocedure) into definition;
 if strpos(definition,'(2,3,4,5)')=0 and strpos(definition,'(2,3,4,5,6)')=0 then raise exception 'runner-version-source-changed';end if;
 execute replace(definition,'(2,3,4,5)','(2,3,4,5,6)');
 select pg_get_functiondef('public.north_market_runner_claim(text,text,uuid,integer,jsonb)'::regprocedure) into definition;
 if strpos(definition,'-- runner-150-seconds-v6')>0 then return;end if;
 if strpos(definition,old_limit)=0 or strpos(definition,old_orders)=0 then raise exception 'runner-150-source-changed';end if;
 definition:=replace(definition,old_limit,new_limit);
 definition:=replace(definition,'s.physics_version in (3,4,5)','s.physics_version in (3,4,5,6)');
 definition:=replace(definition,'when s.physics_version=5 then least(500,t/12)','when s.physics_version>=5 then least(500,t/12)');
 definition:=replace(definition,old_orders,'-- runner-150-seconds-v6'||chr(10)||'orders:=least(case when s.physics_version>=6 then 25 when s.physics_version>=5 then 18 else 10 end,p_ticks/(case when s.physics_version>=6 then 360 else 600 end))');
 execute definition;
end $runner_150$;
notify pgrst,'reload schema';
commit;
