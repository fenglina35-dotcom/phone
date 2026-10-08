-- Hide deleted shops in seller lists only. Historical orders, buyer history and accounting remain.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $orders_source$ begin if md5(replace((select prosrc from pg_proc where oid='public.north_market_orders(text,text,boolean,uuid,uuid)'::regprocedure),chr(13),''))<>'63471a12133b1fd2966cdda7b53b85dd' then raise exception 'market-orders-source-changed';end if;end $orders_source$;
create or replace function public.north_market_orders(p_phone_id text,p_secret text,p_seller boolean default false,p_after uuid default null,p_client uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 return jsonb_build_object('ok',true,'orders',coalesce((select jsonb_agg(to_jsonb(x)-'buyer_id'-'seller_id'-'fingerprint' order by x.id desc) from (select o.*,s.cover as shop_cover,s.deleted_at is not null as shop_deleted,o.buyer_id=actor as is_buyer from public.north_market_orders o left join public.north_market_shops s on s.id=o.shop_id where (case when p_seller then o.seller_id=actor else o.buyer_id=actor or exists(select 1 from public.north_market_splits g where g.order_id=o.id and g.guest_id=actor) end) and (not coalesce(p_seller,false) or s.deleted_at is null and s.id is not null) and (p_after is null or o.id<p_after) and (p_client is null or o.client_id=p_client) order by o.id desc limit 21)x),'[]'::jsonb));end $$;

do $count$
declare definition text; old_fragment text:='(select count(*) from public.north_market_orders where seller_id=actor)';
begin
 select pg_get_functiondef('public.north_market_wallet(text,text)'::regprocedure) into definition;
 if strpos(definition,old_fragment)=0 then raise exception 'market-seller-count-source-changed';end if;
 execute replace(definition,old_fragment,'(select count(*) from public.north_market_orders o where o.seller_id=actor and exists(select 1 from public.north_market_shops s where s.id=o.shop_id and s.deleted_at is null))');
end $count$;
notify pgrst,'reload schema';
commit;
