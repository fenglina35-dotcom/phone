-- Three lifetime reward tiers, requiring 1/2/3 currently owned active cloud shops.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.north_market_ledger add column if not exists shop_reward_tier smallint;
update public.north_market_ledger set shop_reward_tier=1 where kind='shop_reward' and shop_reward_tier is null;
alter table public.north_market_ledger add constraint north_market_shop_reward_tier_check check
 ((kind='shop_reward' and shop_reward_tier is not null and shop_reward_tier between 1 and 3) or (kind<>'shop_reward' and shop_reward_tier is null));
create unique index north_market_one_shop_reward_tier on public.north_market_ledger(owner_id,shop_reward_tier) where kind='shop_reward';
drop index public.north_market_one_shop_reward;

create or replace function public.north_market_shop_reward_state(p_owner text)
returns jsonb language sql stable set search_path='' as $$
 with owned as (select count(*)::integer n from public.north_market_shops where owner_id=p_owner and deleted_at is null),
 claimed as (select coalesce(max(shop_reward_tier),0)::integer n from public.north_market_ledger where owner_id=p_owner and kind='shop_reward')
 select jsonb_build_object('amount',100000,'shopCount',owned.n,'claimedTiers',claimed.n,'nextTier',case when claimed.n<3 then claimed.n+1 else null end,
 'eligible',claimed.n<3 and owned.n>=claimed.n+1,'claimed',claimed.n=3,'totalClaimed',claimed.n*100000,'limit',3) from owned,claimed;
$$;
revoke all on function public.north_market_shop_reward_state(text) from public;

-- Change only the reward projection; keep existing wallet, couple and ledger fields.
do $wallet$
declare definition text; old_fragment text:='jsonb_build_object(''amount'',100000,''eligible'',exists(select 1 from public.north_market_shops where owner_id=actor and deleted_at is null),''claimed'',exists(select 1 from public.north_market_ledger where owner_id=actor and kind=''shop_reward''))';
begin
 select pg_get_functiondef('public.north_market_wallet(text,text)'::regprocedure) into definition;
 if strpos(definition,old_fragment)=0 then raise exception 'market-shop-reward-wallet-source-changed';end if;
 execute replace(definition,old_fragment,'public.north_market_shop_reward_state(actor)');
end $wallet$;

create or replace function public.north_market_shop_reward(p_phone_id text,p_secret text,p_tier integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;duplicate boolean;shop uuid;owned integer;claimed integer;request uuid;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_tier is null or p_tier not between 1 and 3 then raise exception 'market-shop-reward-invalid-tier';end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 duplicate:=exists(select 1 from public.north_market_ledger where owner_id=actor and kind='shop_reward' and shop_reward_tier=p_tier);
 if not duplicate then
  select count(*) into owned from public.north_market_shops where owner_id=actor and deleted_at is null;
  select coalesce(max(shop_reward_tier),0) into claimed from public.north_market_ledger where owner_id=actor and kind='shop_reward';
  if p_tier<>claimed+1 then raise exception 'market-shop-reward-tier-order';end if;
  if owned<p_tier then raise exception 'market-shop-reward-requires-shops';end if;
  select id into shop from public.north_market_shops where owner_id=actor and deleted_at is null order by created_at,id limit 1;
  request:=case when p_tier=1 then '00000000-0000-0000-0000-000000000002'::uuid else md5('north-market-shop-reward-tier:'||p_tier::text)::uuid end;
  insert into public.north_market_wallets(owner_id,balance) values(actor,100000) on conflict(owner_id) do update set balance=north_market_wallets.balance+excluded.balance,updated_at=now();
  insert into public.north_market_ledger(owner_id,kind,amount,request_id,shop_id,target,shop_reward_tier) values(actor,'shop_reward',100000,request,shop,'wallet',p_tier);
 end if;
 return public.north_market_wallet(p_phone_id,p_secret)||jsonb_build_object('rewardDuplicate',duplicate,'rewardTier',p_tier);
end $$;
-- Old clients always address tier 1. A retry can never silently advance to tier 2.
create or replace function public.north_market_shop_reward(p_phone_id text,p_secret text)
returns jsonb language sql security definer set search_path='' as $$
 select public.north_market_shop_reward(p_phone_id,p_secret,1);
$$;
revoke all on function public.north_market_shop_reward(text,text,integer) from public;
grant execute on function public.north_market_shop_reward(text,text,integer) to anon,authenticated;
create or replace function public.north_market_shop_create(p_phone_id text,p_secret text,p_name text,p_category text,p_request uuid,p_expected integer,p_pin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;count integer;fee integer;prior public.north_market_shop_creations;shop public.north_market_shops;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_request is null or length(trim(coalesce(p_name,''))) not between 1 and 40 or length(trim(coalesce(p_category,''))) not between 1 and 40 then raise exception 'market-invalid-shop';end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into prior from public.north_market_shop_creations where owner_id=actor and request_id=p_request;
 if prior.shop_id is not null then if exists(select 1 from public.north_market_shops where id=prior.shop_id and deleted_at is not null) then raise exception 'market-shop-deleted';end if;if prior.fee<>p_expected or not exists(select 1 from public.north_market_shops where id=prior.shop_id and name=trim(p_name) and category=trim(p_category)) then raise exception 'market-request-reused';end if;return jsonb_build_object('ok',true,'id',prior.shop_id,'fee',prior.fee,'duplicate',true);end if;
 select count(*) into count from public.north_market_shops where owner_id=actor and deleted_at is null;
 if count>=3 then raise exception 'market-three-shop-limit';end if;
 fee:=case count when 0 then 0 when 1 then 20000 else 50000 end;
 if p_expected is null or fee<>p_expected then raise exception 'market-price-changed';end if;
 if fee>0 then
  if not public.north_market_check_pin(actor,p_pin) then return jsonb_build_object('ok',false,'error','支付密码不正确或暂时锁定');end if;
  update public.north_market_wallets set balance=balance-fee,updated_at=now() where owner_id=actor and balance>=fee;
  if not found then raise exception 'market-insufficient-funds';end if;
 end if;
 insert into public.north_market_shops(owner_id,name,category,minimum,delivery,catalog,published) values(actor,trim(p_name),trim(p_category),2000,190,jsonb_build_object('groups',jsonb_build_array(jsonb_build_object('id','default','name','默认分组')),'products','[]'::jsonb),false) returning * into shop;
 insert into public.north_market_shop_creations(owner_id,request_id,shop_id,fee) values(actor,p_request,shop.id,fee);
 if fee>0 then insert into public.north_market_ledger(owner_id,kind,amount,request_id,shop_id,target) values(actor,'startup',-fee,p_request,shop.id,'wallet');end if;
 return jsonb_build_object('ok',true,'id',shop.id,'fee',fee);
end $$;
-- Startup fees use the owner's available cloud balance, never profit or income.
do $business_fee$
declare definition text;
begin
 select pg_get_functiondef('public.north_market_business(text,text)'::regprocedure) into definition;
 if strpos(definition,'when 2 then 40000')=0 then raise exception 'market-startup-fee-source-changed';end if;
 execute replace(definition,'when 2 then 40000','when 2 then 50000');
end $business_fee$;
-- Empty-only batches preserve all atomic debit, PIN, quote and replay checks.
create or replace function public.north_market_stock_empty_batch(
 p_phone_id text,p_secret text,p_lines jsonb,p_source text,p_request uuid,p_pin text,p_expected integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;line jsonb;item jsonb;shop public.north_market_shops;
 previous public.north_market_business_ops;fingerprint text;canonical jsonb;
 total bigint:=0;amount bigint;quantity integer;stock integer;child uuid;result jsonb;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_request is null or p_source is null or p_source not in ('wallet','income')
   or p_lines is null or jsonb_typeof(p_lines)<>'array' then raise exception 'market-invalid-stock-request';end if;
 if jsonb_array_length(p_lines) not between 1 and 150 then raise exception 'market-invalid-stock-request';end if;
 if exists(select 1 from jsonb_array_elements(p_lines)x where jsonb_typeof(x)<>'object'
   or coalesce(x->>'shopId','')='' or coalesce(x->>'productId','')=''
   or coalesce(x->>'quantity','')!~'^[0-9]{1,4}$'
   or coalesce(x->>'expected','')!~'^[0-9]{1,10}$')
   or exists(select 1 from jsonb_array_elements(p_lines)x group by x->>'shopId',x->>'productId' having count(*)>1)
 then raise exception 'market-invalid-stock-request';end if;
 select jsonb_agg(jsonb_build_object('shopId',(x->>'shopId')::uuid,'productId',x->>'productId',
   'quantity',(x->>'quantity')::integer,'expected',(x->>'expected')::bigint) order by (x->>'shopId')::uuid,x->>'productId')
   into canonical from jsonb_array_elements(p_lines)x;
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 fingerprint:=md5(jsonb_build_array('stock-empty-batch',canonical,p_source,p_expected)::text);
 select * into previous from public.north_market_business_ops where owner_id=actor and request_id=p_request;
 if previous.request_id is not null then
   if previous.fingerprint<>fingerprint then raise exception 'market-request-reused';end if;
   return previous.result;
 end if;
 if not public.north_market_check_pin(actor,p_pin) then
   return jsonb_build_object('ok',false,'error','支付密码不正确或暂时锁定');
 end if;
 -- Validate the entire batch before any debit, locking shops in stable order.
 for line in select value from jsonb_array_elements(canonical) loop
   quantity:=(line->>'quantity')::integer;
   if quantity not between 1 and 1000 then raise exception 'market-invalid-stock-request';end if;
   select * into shop from public.north_market_shops where id=(line->>'shopId')::uuid and owner_id=actor for share;
   if shop.id is null then raise exception 'market-shop-unavailable';end if;
   select value into item from jsonb_array_elements(shop.catalog->'products') where value->>'id'=line->>'productId';
   if item is null or (item->>'price')::integer<3 then raise exception 'market-invalid-stock-product';end if;
   amount:=greatest(1,(item->>'price')::integer*40/100)::bigint*quantity;
   if amount<>(line->>'expected')::bigint then raise exception 'market-price-changed';end if;
   perform pg_advisory_xact_lock(hashtextextended('north-market-stock:'||shop.id::text||':'||(line->>'productId'),0));
   select s.quantity into stock from public.north_market_stock s where s.shop_id=shop.id and s.product_id=line->>'productId' for update;
   if coalesce(stock,0)<>0 then raise exception 'market-stock-not-empty';end if;
   if coalesce(stock,0)+quantity>9999 then raise exception 'market-stock-limit';end if;
   total:=total+amount;
 end loop;
 if p_expected is null or p_expected<>total then raise exception 'market-price-changed';end if;
 if not exists(select 1 from public.north_market_wallets where owner_id=actor
   and (case when p_source='wallet' then balance else income end)>=total) then raise exception 'market-insufficient-funds';end if;
 for line in select value from jsonb_array_elements(canonical) loop
   child:=md5('north-stock-batch:'||p_request::text||':'||(line->>'shopId')||':'||(line->>'productId'))::uuid;
   result:=public.north_market_stock_change(p_phone_id,p_secret,(line->>'shopId')::uuid,line->>'productId',
     (line->>'quantity')::integer,p_source,child,p_pin,(line->>'expected')::integer,false);
   if coalesce((result->>'ok')::boolean,false)=false then raise exception 'market-batch-stock-failed';end if;
 end loop;
 result:=jsonb_build_object('ok',true,'amount',total,'products',jsonb_array_length(canonical));
 insert into public.north_market_business_ops(owner_id,request_id,fingerprint,result) values(actor,p_request,fingerprint,result);
 return result;
end $$;
revoke all on function public.north_market_stock_empty_batch(text,text,jsonb,text,uuid,text,integer) from public;
grant execute on function public.north_market_stock_empty_batch(text,text,jsonb,text,uuid,text,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
