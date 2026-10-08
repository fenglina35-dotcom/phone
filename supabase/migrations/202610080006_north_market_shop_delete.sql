-- Soft deletion releases active shop slots; preserves orders, stock and ledgers.
begin;
set local lock_timeout='3s';
alter table public.north_market_shops add column if not exists deleted_at timestamptz;
create or replace function public.north_market_shop_create(p_phone_id text,p_secret text,p_name text,p_category text,p_request uuid,p_expected integer,p_pin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;count integer;fee integer;profit bigint;prior public.north_market_shop_creations;shop public.north_market_shops;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_request is null or length(trim(coalesce(p_name,''))) not between 1 and 40 or length(trim(coalesce(p_category,''))) not between 1 and 40 then raise exception 'market-invalid-shop';end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into prior from public.north_market_shop_creations where owner_id=actor and request_id=p_request;
 if prior.shop_id is not null then if exists(select 1 from public.north_market_shops where id=prior.shop_id and deleted_at is not null) then raise exception 'market-shop-deleted';end if;if prior.fee<>p_expected or not exists(select 1 from public.north_market_shops where id=prior.shop_id and name=trim(p_name) and category=trim(p_category)) then raise exception 'market-request-reused';end if;return jsonb_build_object('ok',true,'id',prior.shop_id,'fee',prior.fee,'duplicate',true);end if;
 select count(*) into count from public.north_market_shops where owner_id=actor and deleted_at is null;
 if count>=3 then raise exception 'market-three-shop-limit';end if;
 fee:=case count when 0 then 0 when 1 then 20000 else 40000 end;
 if p_expected is null or fee<>p_expected then raise exception 'market-price-changed';end if;
 if fee>0 then
  if not public.north_market_check_pin(actor,p_pin) then return jsonb_build_object('ok',false,'error','支付密码不正确或暂时锁定');end if;
  profit:=coalesce((select sum(subtotal-stock_cost) from public.north_market_orders where seller_id=actor and status='completed'),0)+coalesce((select sum(amount) from public.north_market_ledger where owner_id=actor and kind='startup'),0);
  if profit<fee then raise exception 'market-earned-profit-required';end if;
  update public.north_market_wallets set income=income-fee,updated_at=now() where owner_id=actor and income>=fee;
  if not found then raise exception 'market-unsettled-income-required';end if;
 end if;
 insert into public.north_market_shops(owner_id,name,category,minimum,delivery,catalog,published) values(actor,trim(p_name),trim(p_category),2000,190,jsonb_build_object('groups',jsonb_build_array(jsonb_build_object('id','default','name','默认分组')),'products','[]'::jsonb),false) returning * into shop;
 insert into public.north_market_shop_creations(owner_id,request_id,shop_id,fee) values(actor,p_request,shop.id,fee);
 if fee>0 then insert into public.north_market_ledger(owner_id,kind,amount,request_id,shop_id,target) values(actor,'startup',-fee,p_request,shop.id,'startup');end if;
 return jsonb_build_object('ok',true,'id',shop.id,'fee',fee);
end $$;
create or replace function public.north_market_save_shop(p_phone_id text,p_secret text,p_expected integer,p_shop jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; old public.north_market_shops; row public.north_market_shops; p jsonb; g jsonb; o jsonb; names text[]; labels text[]; products jsonb; groups jsonb;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));
 if coalesce(p_shop->>'marketId','')<>'' then select * into old from public.north_market_shops where owner_id=actor and deleted_at is null and id=(p_shop->>'marketId')::uuid for update;if old.id is null then raise exception 'market-shop-unavailable';end if;else select * into old from public.north_market_shops where owner_id=actor and deleted_at is null order by created_at,id limit 1 for update;end if;
 if coalesce(old.revision,0)<>p_expected then raise exception 'market-revision-changed'; end if;
 if p_shop is null or jsonb_typeof(p_shop)<>'object' or p_shop->>'name' is null or p_shop->>'category' is null or not coalesce(p_shop->>'minimum' ~ '^[0-9]{1,6}$',false) or not coalesce(p_shop->>'delivery' ~ '^[0-9]{1,6}$',false) or length(trim(p_shop->>'name')) not between 1 and 40 or length(trim(p_shop->>'category')) not between 1 and 40 then raise exception 'market-invalid-shop'; end if;
 if p_shop ? 'deliveryMinutes' and (not coalesce(p_shop->>'deliveryMinutes' ~ '^[0-9]{1,3}$',false) or (p_shop->>'deliveryMinutes')::integer not between 10 and 120) then raise exception 'market-invalid-delivery-minutes';end if;
 products:=p_shop->'products';groups:=p_shop->'groups';
 if products is null or groups is null or jsonb_typeof(products)<>'array' or jsonb_array_length(products)>50 or jsonb_typeof(groups)<>'array' or jsonb_array_length(groups) not between 1 and 20 or length(coalesce(p_shop->>'intro',''))>400 then raise exception 'market-catalog-limit'; end if;
 if not public.north_market_image_valid(p_shop->>'cover',actor) then raise exception 'market-invalid-image'; end if;
 if (p_shop->>'minimum')::integer not between 0 and 999999 or (p_shop->>'delivery')::integer not between 0 and 999999 then raise exception 'market-invalid-amount'; end if;
 if exists(select 1 from jsonb_array_elements(groups) x group by x->>'id' having count(*)>1) or exists(select 1 from jsonb_array_elements(products) x group by x->>'id' having count(*)>1) then raise exception 'market-duplicate-id'; end if;
 for g in select value from jsonb_array_elements(groups) loop
  if not coalesce(g->>'id' ~ '^[a-zA-Z0-9_-]{1,80}$',false) or g->>'name' is null then raise exception 'market-invalid-group'; end if;
  if length(coalesce(g->>'id','')) not between 1 and 80 or length(trim(g->>'name')) not between 1 and 40 then raise exception 'market-invalid-group'; end if;
 end loop;
 for p in select value from jsonb_array_elements(products) loop
  if not coalesce(p->>'id' ~ '^[a-zA-Z0-9_-]{1,80}$',false) or p->>'name' is null or p->>'unit' is null or p->>'available' is null or p->'specGroups' is null or not coalesce(p->>'price' ~ '^[0-9]{1,6}$',false) then raise exception 'market-invalid-product'; end if;
  if length(coalesce(p->>'id','')) not between 1 and 80 or length(trim(p->>'name')) not between 1 and 40 or length(trim(p->>'unit')) not between 1 and 12 or (p->>'price')::integer not between 1 and 999999 or not exists(select 1 from jsonb_array_elements(groups) x where x->>'id'=p->>'groupId') then raise exception 'market-invalid-product'; end if;
  if not public.north_market_image_valid(p->>'image',actor) or length(coalesce(p->>'description',''))>300 or jsonb_typeof(p->'available')<>'boolean' or coalesce(jsonb_typeof(p->'signature'),'boolean')<>'boolean' then raise exception 'market-invalid-product-fields'; end if;
  if jsonb_typeof(p->'specGroups')<>'array' or jsonb_array_length(p->'specGroups')>10 then raise exception 'market-spec-limit'; end if;
  if exists(select 1 from jsonb_array_elements(p->'specGroups') x group by x->>'id' having count(*)>1) then raise exception 'market-duplicate-spec-id';end if;
  names:=array[]::text[];
  for g in select value from jsonb_array_elements(p->'specGroups') loop
   if not coalesce(g->>'id' ~ '^[a-zA-Z0-9_-]{1,80}$',false) or g->>'name' is null or g->>'mode' is null or g->>'required' is null or g->'options' is null then raise exception 'market-invalid-spec'; end if;
   if length(trim(g->>'name')) not between 1 and 40 or g->>'name'=any(names) or length(coalesce(g->>'id','')) not between 1 and 80 or g->>'mode' not in ('single','multiple') or jsonb_typeof(g->'required')<>'boolean' or jsonb_typeof(g->'options')<>'array' or jsonb_array_length(g->'options')>20 or ((g->>'required')::boolean and jsonb_array_length(g->'options')=0) then raise exception 'market-invalid-spec'; end if;
   if exists(select 1 from jsonb_array_elements(g->'options') x group by x->>'id' having count(*)>1) then raise exception 'market-duplicate-option-id';end if;
   names:=array_append(names,g->>'name');labels:=array[]::text[];
   for o in select value from jsonb_array_elements(g->'options') loop
    if not coalesce(o->>'id' ~ '^[a-zA-Z0-9_-]{1,80}$',false) or o->>'label' is null or not coalesce(o->>'price' ~ '^[0-9]{1,6}$',false) then raise exception 'market-invalid-option'; end if;
    if length(trim(o->>'label')) not between 1 and 40 or o->>'label'=any(labels) or length(coalesce(o->>'id','')) not between 1 and 80 or (o->>'price')::integer not between 0 and 999999 then raise exception 'market-invalid-option'; end if;
    labels:=array_append(labels,o->>'label');
   end loop;
  end loop;
 end loop;
 if coalesce((p_shop->>'published')::boolean,false) and not exists(select 1 from jsonb_array_elements(products) x where (x->>'available')::boolean) then raise exception 'market-empty-shop'; end if;
 if old.id is null then
  if exists(select 1 from public.north_market_shops where owner_id=actor and deleted_at is null) then raise exception 'market-shop-selection-required';end if;
  insert into public.north_market_shops(owner_id,name,category,intro,cover,minimum,delivery,catalog,published)
  values(actor,trim(p_shop->>'name'),trim(p_shop->>'category'),coalesce(p_shop->>'intro',''),coalesce(p_shop->>'cover',''),(p_shop->>'minimum')::integer,(p_shop->>'delivery')::integer,jsonb_build_object('groups',groups,'products',products,'deliveryMinutes',coalesce((p_shop->>'deliveryMinutes')::integer,(old.catalog->>'deliveryMinutes')::integer,30)),coalesce((p_shop->>'published')::boolean,false)) returning * into row;
 else
  update public.north_market_shops set name=trim(p_shop->>'name'),category=trim(p_shop->>'category'),intro=coalesce(p_shop->>'intro',''),cover=coalesce(p_shop->>'cover',''),minimum=(p_shop->>'minimum')::integer,delivery=(p_shop->>'delivery')::integer,catalog=jsonb_build_object('groups',groups,'products',products,'deliveryMinutes',coalesce((p_shop->>'deliveryMinutes')::integer,(old.catalog->>'deliveryMinutes')::integer,30)),published=coalesce((p_shop->>'published')::boolean,false),revision=revision+1,updated_at=now() where id=old.id and owner_id=actor returning * into row;
 end if;
 return jsonb_build_object('ok',true,'id',row.id,'revision',row.revision,'published',row.published);
end $$;
create or replace function public.north_market_mine(p_phone_id text,p_secret text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text; row public.north_market_shops;
begin actor:=public.north_market_identity(p_phone_id,p_secret);select * into row from public.north_market_shops where owner_id=actor and deleted_at is null order by created_at,id limit 1;
 return jsonb_build_object('ok',true,'imageFolder',md5(actor),'shop',case when row.id is null then null else to_jsonb(row)-'owner_id' end);end $$;
create or replace function public.north_market_shop_mine(p_phone_id text,p_secret text,p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;shop public.north_market_shops;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 select * into shop from public.north_market_shops where owner_id=actor and deleted_at is null and (p_id is null or id=p_id) order by created_at,id limit 1;
 if p_id is not null and shop.id is null then raise exception 'market-shop-unavailable';end if;
 return jsonb_build_object('ok',true,'imageFolder',md5(actor),'shop',case when shop.id is null then null else to_jsonb(shop)-'owner_id' end);
end $$;
create or replace function public.north_market_business(p_phone_id text,p_secret text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;wallet public.north_market_wallets;profit bigint;stores integer;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);select * into wallet from public.north_market_wallets where owner_id=actor;
 select count(*) into stores from public.north_market_shops where owner_id=actor and deleted_at is null;
 profit:=coalesce((select sum(subtotal-stock_cost) from public.north_market_orders where seller_id=actor and status='completed'),0)+coalesce((select sum(amount) from public.north_market_ledger where owner_id=actor and kind='startup'),0);
 return jsonb_build_object('ok',true,'imageFolder',md5(actor),'balance',coalesce(wallet.balance,0),'income',coalesce(wallet.income,0),'profit',profit,'shopCount',stores,'nextStartupFee',case stores when 0 then 0 when 1 then 20000 when 2 then 40000 else null end,
 'inventoryValue',coalesce((select sum(l.remaining::bigint*l.unit_cost) from public.north_market_stock_lots l where l.owner_id=actor),0),
 'shops',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from (select s.*,coalesce((select sum(o.subtotal) from public.north_market_orders o where o.shop_id=s.id and o.status='completed'),0) as revenue,coalesce((select sum(o.stock_cost) from public.north_market_orders o where o.shop_id=s.id and o.status='completed'),0) as cost from public.north_market_shops s where s.owner_id=actor and s.deleted_at is null)x),'[]'::jsonb),
 'stock',coalesce((select jsonb_agg(to_jsonb(x)) from (select i.*,s.name as shop_name,
  coalesce((select sum(l.remaining::bigint*l.unit_cost) from public.north_market_stock_lots l where l.shop_id=i.shop_id and l.product_id=i.product_id),0) as cost_value,
  coalesce((select max(l.unit_cost) from public.north_market_stock_lots l where l.shop_id=i.shop_id and l.product_id=i.product_id and l.remaining>0),0) as highest_cost,
  (select (p->>'price')::integer from jsonb_array_elements(s.catalog->'products')p where p->>'id'=i.product_id) as sale_price,
  coalesce((select jsonb_agg(jsonb_build_object('quantity',l.remaining,'unitCost',l.unit_cost,'source',l.funding) order by l.created_at,l.id) from public.north_market_stock_lots l where l.shop_id=i.shop_id and l.product_id=i.product_id and l.remaining>0),'[]'::jsonb) as lots
  from public.north_market_stock i join public.north_market_shops s on s.id=i.shop_id where s.owner_id=actor and s.deleted_at is null and (i.quantity>0 or exists(select 1 from jsonb_array_elements(s.catalog->'products')p where p->>'id'=i.product_id)))x),'[]'::jsonb));
end $$;
create or replace function public.north_market_stock_change(p_phone_id text,p_secret text,p_shop uuid,p_product text,p_quantity integer,p_source text,p_request uuid,p_pin text,p_expected integer,p_return boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;shop public.north_market_shops;item jsonb;head public.north_market_stock;lot public.north_market_stock_lots;amount bigint;cost integer;left_quantity integer;take integer;wallet_return bigint:=0;income_return bigint:=0;fingerprint text;previous public.north_market_business_ops;result jsonb;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_request is null or p_quantity not between 1 and 1000 or p_source not in ('wallet','income') or p_product is null then raise exception 'market-invalid-stock-request';end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 fingerprint:=md5(jsonb_build_array(p_shop,p_product,p_quantity,p_source,p_expected,p_return)::text);select * into previous from public.north_market_business_ops where owner_id=actor and request_id=p_request;if previous.request_id is not null then if previous.fingerprint<>fingerprint then raise exception 'market-request-reused';end if;return previous.result;end if;
 select * into shop from public.north_market_shops where id=p_shop and owner_id=actor;
 if shop.id is null then raise exception 'market-shop-unavailable';end if;if shop.deleted_at is not null and not p_return then raise exception 'market-shop-deleted';end if;
 if not public.north_market_check_pin(actor,p_pin) then return jsonb_build_object('ok',false,'error','支付密码不正确或暂时锁定');end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-stock:'||p_shop::text||':'||p_product,0));
 select * into head from public.north_market_stock where shop_id=p_shop and product_id=p_product for update;
 if p_return then
  if head.shop_id is null or head.quantity<p_quantity then raise exception 'market-stock-unavailable';end if;
  left_quantity:=p_quantity;
  for lot in select * from public.north_market_stock_lots where shop_id=p_shop and product_id=p_product and remaining>0 order by created_at,id for update loop
   exit when left_quantity=0;take:=least(left_quantity,lot.remaining);
   if lot.funding='wallet' then wallet_return:=wallet_return+take::bigint*lot.unit_cost;else income_return:=income_return+take::bigint*lot.unit_cost;end if;
   update public.north_market_stock_lots set remaining=remaining-take where id=lot.id;left_quantity:=left_quantity-take;
  end loop;
  if left_quantity<>0 then raise exception 'market-stock-invariant';end if;
  if p_expected is null or p_expected<>wallet_return+income_return then raise exception 'market-price-changed';end if;
  update public.north_market_wallets set balance=balance+wallet_return,income=income+income_return,updated_at=now() where owner_id=actor;
  update public.north_market_stock set quantity=quantity-p_quantity,updated_at=now() where shop_id=p_shop and product_id=p_product;
  insert into public.north_market_ledger(owner_id,kind,amount,request_id,shop_id,target) values(actor,'stock_return',wallet_return+income_return,p_request,p_shop,p_product);
  result:=jsonb_build_object('ok',true,'amount',wallet_return+income_return);insert into public.north_market_business_ops(owner_id,request_id,fingerprint,result) values(actor,p_request,fingerprint,result);return result;
 end if;
 select value into item from jsonb_array_elements(shop.catalog->'products') where value->>'id'=p_product;
 if item is null or (item->>'price')::integer<3 then raise exception 'market-invalid-stock-product';end if;
 cost:=greatest(1,(item->>'price')::integer*40/100);amount:=cost::bigint*p_quantity;
 if p_expected is null or p_expected<>amount then raise exception 'market-price-changed';end if;
 if coalesce(head.quantity,0)+p_quantity>9999 then raise exception 'market-stock-limit';end if;
 update public.north_market_wallets set balance=balance-case when p_source='wallet' then amount else 0 end,income=income-case when p_source='income' then amount else 0 end,updated_at=now() where owner_id=actor and (case when p_source='wallet' then balance else income end)>=amount;
 if not found then raise exception 'market-insufficient-funds';end if;
 insert into public.north_market_stock(shop_id,product_id,name,unit,image,quantity,restock_revision) values(p_shop,p_product,item->>'name',item->>'unit',coalesce(item->>'image',''),p_quantity,1)
 on conflict(shop_id,product_id) do update set name=excluded.name,unit=excluded.unit,image=excluded.image,quantity=north_market_stock.quantity+excluded.quantity,restock_revision=north_market_stock.restock_revision+1,notice_id=gen_random_uuid(),updated_at=now();
 insert into public.north_market_stock_lots(shop_id,product_id,owner_id,quantity,remaining,unit_cost,funding,request_id) values(p_shop,p_product,actor,p_quantity,p_quantity,cost,p_source,p_request);
 insert into public.north_market_ledger(owner_id,kind,amount,request_id,shop_id,target) values(actor,'restock',-amount,p_request,p_shop,p_product);
 result:=jsonb_build_object('ok',true,'amount',amount,'unitCost',cost);insert into public.north_market_business_ops(owner_id,request_id,fingerprint,result) values(actor,p_request,fingerprint,result);return result;
end $$;
create or replace function public.north_market_shop_delete(p_phone_id text,p_secret text,p_id uuid,p_expected integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;shop public.north_market_shops;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));
 select * into shop from public.north_market_shops where owner_id=actor and id=p_id for update;
 if shop.id is null then raise exception 'market-shop-unavailable';end if;
 if shop.deleted_at is not null then return jsonb_build_object('ok',true,'id',shop.id,'deleted',true,'revision',shop.revision,'duplicate',true);end if;
 if p_expected is null or shop.revision<>p_expected then raise exception 'market-revision-changed';end if;
 update public.north_market_shops set deleted_at=now(),published=false,revision=revision+1,updated_at=now() where id=shop.id returning * into shop;
 return jsonb_build_object('ok',true,'id',shop.id,'deleted',true,'revision',shop.revision);
end $$;
revoke all on function public.north_market_shop_delete(text,text,uuid,integer) from public;
grant execute on function public.north_market_shop_delete(text,text,uuid,integer) to anon,authenticated;
commit;
