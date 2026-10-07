-- Additive role ordering APIs. Existing order/RPC signatures remain compatible.
begin;
create or replace function public.north_market_role_catalog(p_phone_id text,p_secret text,p_role text,p_queries jsonb,p_required jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;result jsonb;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if not exists(select 1 from public.north_market_couples where owner_id=actor and role_id=p_role and role_id<>'') then raise exception 'market-couple-only';end if;
 if jsonb_typeof(p_queries) is distinct from 'array' then raise exception 'market-invalid-query';end if;
 if jsonb_array_length(p_queries) not between 1 and 5 or exists(select 1 from jsonb_array_elements(p_queries) q where jsonb_typeof(q)<>'string' or length(trim(q#>>'{}')) not between 1 and 60) then raise exception 'market-invalid-query';end if;
 if jsonb_typeof(p_required) is distinct from 'array' then raise exception 'market-invalid-query';end if;
 if jsonb_array_length(p_required) not between 1 and 6 or exists(select 1 from jsonb_array_elements(p_required) q where jsonb_typeof(q)<>'string' or length(trim(q#>>'{}')) not between 1 and 20) then raise exception 'market-invalid-query';end if;
 with selected as (
  select s.*,(select count(*) from jsonb_array_elements_text(p_queries) q where exists(select 1 from jsonb_array_elements(s.catalog->'products') p join public.north_market_stock i on i.shop_id=s.id and i.product_id=p->>'id' where i.quantity>0 and (p->>'available')::boolean and position(lower(trim(q)) in lower((p->>'name')||' '||coalesce(p->>'description','')))>0)) score
  from public.north_market_shops s where s.published and s.owner_id<>actor
  and exists(select 1 from public.phone_licenses l where l.id::text=s.owner_id and l.status='active')
  and exists(select 1 from jsonb_array_elements(s.catalog->'products') p join public.north_market_stock i on i.shop_id=s.id and i.product_id=p->>'id' where i.quantity>0 and (p->>'available')::boolean and not exists(select 1 from jsonb_array_elements_text(p_required) r where position(lower(trim(r)) in lower((p->>'name')||' '||coalesce(p->>'description','')))=0) and exists(select 1 from jsonb_array_elements_text(p_queries) q where position(lower(trim(q)) in lower((p->>'name')||' '||coalesce(p->>'description','')||' '||s.name||' '||s.category))>0))
  order by score desc,s.id limit 6
 ), menus as (
  select s.id,s.name,s.revision,s.minimum,s.delivery,
  (select coalesce(jsonb_agg(item order by matches desc,price,id),'[]'::jsonb) from (
    select jsonb_build_object('id',p->>'id','name',p->>'name','description',left(coalesce(p->>'description',''),160),'price',(p->>'price')::integer,'unit',p->>'unit','available',true,'stock',i.quantity,'soldOut',false,'specGroups',p->'specGroups') item,
    (select count(*) from jsonb_array_elements_text(p_queries) q where position(lower(trim(q)) in lower((p->>'name')||' '||coalesce(p->>'description','')))>0) matches,(p->>'price')::integer price,p->>'id' id
    from jsonb_array_elements(s.catalog->'products') p join public.north_market_stock i on i.shop_id=s.id and i.product_id=p->>'id'
    where i.quantity>0 and (p->>'available')::boolean order by matches desc,price,id limit 28
  ) products) products from selected s
 ) select coalesce(jsonb_agg(to_jsonb(menus)),'[]'::jsonb) into result from menus;
 return jsonb_build_object('ok',true,'shops',result,'bounded',true);
end $$;
revoke all on function public.north_market_role_catalog(text,text,text,jsonb,jsonb) from public;
grant execute on function public.north_market_role_catalog(text,text,text,jsonb,jsonb) to anon,authenticated;

create or replace function public.north_market_role_checkout(p_phone_id text,p_secret text,p_role text,p_couple_revision integer,p_client uuid,p_shop uuid,p_revision integer,p_lines jsonb,p_address jsonb,p_utensils boolean,p_total integer,p_coupon uuid,p_topup boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;payer text;seller text;q jsonb;prior public.north_market_orders;row public.north_market_orders;fingerprint text;coupon public.north_market_coupons;discount integer:=0;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_client is null or coalesce(p_role,'')='' or jsonb_typeof(p_address) is distinct from 'object' or length(coalesce(p_address->>'address','')) not between 1 and 200 or length(coalesce(p_address->>'name','')) not between 1 and 40 or length(coalesce(p_address->>'phone',''))>30 or p_utensils is null or p_topup is null then raise exception 'market-invalid-order';end if;
 p_address:=jsonb_build_object('address',p_address->>'address','name',p_address->>'name','phone',coalesce(p_address->>'phone',''));
 fingerprint:=md5(jsonb_build_array('role-checkout',p_role,p_shop,p_revision,p_lines,p_address,p_utensils,p_total,p_coupon,p_topup)::text);
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into prior from public.north_market_orders where buyer_id=actor and client_id=p_client;
 if prior.id is not null then if prior.fingerprint<>fingerprint then raise exception 'market-request-reused';end if;return jsonb_build_object('ok',true,'order',to_jsonb(prior)-'buyer_id'-'seller_id'-'fingerprint');end if;
 if not exists(select 1 from public.north_market_couples where owner_id=actor and role_id=p_role and revision=p_couple_revision) then raise exception 'market-couple-only';end if;
 if exists(select 1 from public.north_market_splits where host_id=actor and client_id=p_client) then raise exception 'market-client-used-for-split';end if;
 select owner_id into seller from public.north_market_shops where id=p_shop and published for share;
 if seller is null or seller=actor then raise exception 'market-self-order-not-allowed';end if;
 q:=public.north_market_quote(p_shop,p_revision,p_lines);
 if p_coupon is not null then
  select * into coupon from public.north_market_coupons where id=p_coupon and owner_id=actor and used_order_id is null and expires_at>now() for update;
  if coupon.id is null or (q->>'subtotal')::integer<coupon.minimum then raise exception 'market-coupon-unavailable';end if;
  discount:=least(coupon.face,(q->>'subtotal')::integer);
 end if;
 if p_total is null or p_total<>(q->>'total')::integer-discount then raise exception 'market-price-changed';end if;
 payer:=actor||'/'||p_role;
 update public.north_market_wallets set balance=balance-p_total,updated_at=now() where owner_id=payer and balance>=p_total;
 if not found then raise exception 'market-insufficient-funds';end if;
 insert into public.north_market_orders(buyer_id,seller_id,shop_id,client_id,fingerprint,items,shop_name,subtotal,delivery,total,address,utensils,payer_role,note,discount,coupon_id)
 values(actor,seller,p_shop,p_client,fingerprint,q->'items',q->>'shopName',(q->>'subtotal')::integer,(q->>'delivery')::integer,p_total,p_address,p_utensils,p_role,case when p_topup then '角色点餐：为凑起送价增加商品或份数' else '角色使用手动充值的云银行卡点餐' end,discount,p_coupon) returning * into row;
 if p_coupon is not null then update public.north_market_coupons set used_order_id=row.id where id=p_coupon;end if;
 insert into public.north_market_ledger(owner_id,kind,amount,order_id,request_id,target) values(actor,'purchase',-p_total,row.id,p_client,p_role);
 return jsonb_build_object('ok',true,'order',to_jsonb(row)-'buyer_id'-'seller_id'-'fingerprint');
end $$;
revoke all on function public.north_market_role_checkout(text,text,text,integer,uuid,uuid,integer,jsonb,jsonb,boolean,integer,uuid,boolean) from public;
grant execute on function public.north_market_role_checkout(text,text,text,integer,uuid,uuid,integer,jsonb,jsonb,boolean,integer,uuid,boolean) to anon,authenticated;
commit;
