begin;

-- One idempotent transaction for the entire cart of replenishment products.
-- Reuse the existing per-product cost, funding, lot and stock-return rules.
create or replace function public.north_market_stock_batch(
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
 fingerprint:=md5(jsonb_build_array('stock-batch',canonical,p_source,p_expected)::text);
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
revoke all on function public.north_market_stock_batch(text,text,jsonb,text,uuid,text,integer) from public;
grant execute on function public.north_market_stock_batch(text,text,jsonb,text,uuid,text,integer) to anon,authenticated;
commit;
