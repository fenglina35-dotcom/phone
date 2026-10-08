-- One opening reward per licensed owner, independent of startup grants and admin credits.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.north_market_ledger drop constraint north_market_ledger_kind_check;
alter table public.north_market_ledger add constraint north_market_ledger_kind_check check(kind in ('grant','admin_credit','purchase','refund','income','withdraw','allocate','coupon','restock','stock_return','startup','runner_reward','shop_reward'));
create unique index if not exists north_market_one_shop_reward on public.north_market_ledger(owner_id) where kind='shop_reward';
create or replace function public.north_market_wallet(p_phone_id text,p_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; wallet public.north_market_wallets; couple public.north_market_couples;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 select * into wallet from public.north_market_wallets where owner_id=actor;
 select * into couple from public.north_market_couples where owner_id=actor;
 return jsonb_build_object('ok',true,'accountKey',md5(actor),'balance',coalesce(wallet.balance,0),'income',coalesce(wallet.income,0),'claimed',exists(select 1 from public.north_market_ledger where owner_id=actor and kind='grant'),'couple',case when couple.role_id<>'' then jsonb_build_object('id',couple.role_id,'name',couple.role_name,'revision',couple.revision,'balance',coalesce((select balance from public.north_market_wallets where owner_id=actor||'/'||couple.role_id),0)) else null end,
 'buyerOrderCount',(select count(*) from public.north_market_orders where buyer_id=actor),'sellerOrderCount',(select count(*) from public.north_market_orders where seller_id=actor),'shopCount',(select count(*) from public.north_market_shops where owner_id=actor and deleted_at is null),'shopReward',jsonb_build_object('amount',100000,'eligible',exists(select 1 from public.north_market_shops where owner_id=actor and deleted_at is null),'claimed',exists(select 1 from public.north_market_ledger where owner_id=actor and kind='shop_reward')),'ledger',coalesce((select jsonb_agg(x order by x.created_at desc) from (select kind,amount,target,created_at from public.north_market_ledger where owner_id=actor order by created_at desc,id desc limit 30)x),'[]'::jsonb));
end $$;
create or replace function public.north_market_shop_reward(p_phone_id text,p_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;duplicate boolean;shop uuid;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 duplicate:=exists(select 1 from public.north_market_ledger where owner_id=actor and kind='shop_reward');
 if not duplicate then
  select id into shop from public.north_market_shops where owner_id=actor and deleted_at is null order by created_at,id limit 1;
  if shop is null then raise exception 'market-shop-reward-requires-shop';end if;
  insert into public.north_market_wallets(owner_id,balance) values(actor,100000) on conflict(owner_id) do update set balance=north_market_wallets.balance+excluded.balance,updated_at=now();
  insert into public.north_market_ledger(owner_id,kind,amount,request_id,shop_id,target) values(actor,'shop_reward',100000,'00000000-0000-0000-0000-000000000002',shop,'wallet');
 end if;
 return public.north_market_wallet(p_phone_id,p_secret)||jsonb_build_object('rewardDuplicate',duplicate);
end $$;
revoke all on function public.north_market_shop_reward(text,text) from public;
grant execute on function public.north_market_shop_reward(text,text) to anon,authenticated;

-- Preserve order metadata, wallet payment PIN checks and every existing authorization guard.
do $role_pin$
declare definition text;start_anchor text:='if wallet.pin_blocked_until>now() then';end_anchor text:='payer:=case when p_role=';a integer;b integer;
begin
 select pg_get_functiondef('public.north_market_order_create(text,text,uuid,uuid,integer,jsonb,jsonb,boolean,text,text,integer,text,integer,uuid)'::regprocedure) into definition;
 if strpos(definition,'-- role-card-no-second-pin')>0 then return;end if;
 a:=strpos(definition,start_anchor);b:=strpos(definition,end_anchor);
 if a=0 or b<=a or strpos(substr(definition,a,b-a),'p_pin is null')=0 or strpos(definition,'market-couple-only')=0 then raise exception 'market-role-pin-source-changed';end if;
 definition:=substr(definition,1,a-1)||'-- role-card-no-second-pin'||chr(10)||'if p_role='''' then'||chr(10)||substr(definition,a,b-a)||'end if;'||chr(10)||substr(definition,b);
 execute definition;
end $role_pin$;


-- Only the daily cap changes; preserve v4 physics, timing and replay validation.
do $runner_cap$
declare definition text;
begin
 select pg_get_functiondef('public.north_market_runner_status(text,text)'::regprocedure) into definition;
 if strpos(definition,'''limit'',3000')=0 and strpos(definition,'''limit'',10000')=0 then raise exception 'runner-limit-source-changed';end if;
 execute replace(definition,'''limit'',3000','''limit'',10000');
 select pg_get_functiondef('public.north_market_runner_claim(text,text,uuid,integer,jsonb)'::regprocedure) into definition;
 if strpos(definition,'greatest(0,3000-used)')=0 and strpos(definition,'greatest(0,10000-used)')=0 then raise exception 'runner-claim-source-changed';end if;
 execute replace(definition,'greatest(0,3000-used)','greatest(0,10000-used)');
end $runner_cap$;


-- New v5 sessions last up to three minutes; old sessions keep their terminal ticks.
alter table public.north_runner_sessions drop constraint north_runner_sessions_physics_version_check;
alter table public.north_runner_sessions add constraint north_runner_sessions_physics_version_check check(physics_version in (1,2,3,4,5));
alter table public.north_runner_sessions drop constraint north_runner_sessions_reward_check;
alter table public.north_runner_sessions add constraint north_runner_sessions_reward_check check(reward between 0 and 1800);
do $runner_duration$
declare definition text;
begin
 select pg_get_functiondef('public.north_market_runner_start(text,text,uuid,integer)'::regprocedure) into definition;
 if strpos(definition,'(2,3,4)')=0 and strpos(definition,'(2,3,4,5)')=0 then raise exception 'runner-version-source-changed';end if;
 execute replace(definition,'(2,3,4)','(2,3,4,5)');
 select pg_get_functiondef('public.north_market_runner_claim(text,text,uuid,integer,jsonb)'::regprocedure) into definition;
 if strpos(definition,'-- runner-three-minute-v5')>0 then return;end if;
 if strpos(definition,'p_ticks>6000')=0 or strpos(definition,'orders:=least(10,p_ticks/600)')=0 then raise exception 'runner-duration-source-changed';end if;
 definition:=replace(definition,'p_ticks>6000','p_ticks>(case when s.physics_version>=5 then 10800 else 6000 end)');
 definition:=replace(definition,'p_ticks<>6000','p_ticks<>(case when s.physics_version>=5 then 10800 else 6000 end)');
 definition:=replace(definition,'jsonb_array_length(p_inputs)>1001','jsonb_array_length(p_inputs)>1801');
 definition:=replace(definition,'^[0-9]{1,4}$','^[0-9]{1,5}$');
 definition:=replace(definition,'s.physics_version=4','s.physics_version>=4');
 definition:=replace(definition,'s.physics_version in (3,4)','s.physics_version in (3,4,5)');
 definition:=replace(definition,'else t/12 end','when s.physics_version=5 then least(500,t/12) else t/12 end');
 definition:=replace(definition,'orders:=least(10,p_ticks/600)','-- runner-three-minute-v5'||chr(10)||'orders:=least(case when s.physics_version>=5 then 18 else 10 end,p_ticks/600)');
 execute definition;
end $runner_duration$;

notify pgrst,'reload schema';
commit;
