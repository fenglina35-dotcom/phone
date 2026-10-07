-- Order metadata only: preserve authorization, paging, signatures and existing ACLs.
-- Current store cover remains available for past orders even after unpublishing.
begin;
create or replace function public.north_market_orders(p_phone_id text,p_secret text,p_seller boolean default false,p_after uuid default null,p_client uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 return jsonb_build_object('ok',true,'orders',coalesce((select jsonb_agg(to_jsonb(x)-'buyer_id'-'seller_id'-'fingerprint' order by x.id desc) from (select o.*,s.cover as shop_cover,o.buyer_id=actor as is_buyer from public.north_market_orders o left join public.north_market_shops s on s.id=o.shop_id where (case when p_seller then o.seller_id=actor else o.buyer_id=actor or exists(select 1 from public.north_market_splits g where g.order_id=o.id and g.guest_id=actor) end) and (p_after is null or o.id<p_after) and (p_client is null or o.client_id=p_client) order by o.id desc limit 21)x),'[]'::jsonb));end $$;
create or replace function public.north_market_order(p_phone_id text,p_secret text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text; row public.north_market_orders; review public.north_market_reviews;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 select * into row from public.north_market_orders where id=p_id and (buyer_id=actor or seller_id=actor or exists(select 1 from public.north_market_splits g where g.order_id=p_id and g.guest_id=actor));
 if row.id is null then raise exception 'market-order-unavailable';end if;
 select * into review from public.north_market_reviews where order_id=p_id;
 return jsonb_build_object('ok',true,'order',(to_jsonb(row)-'buyer_id'-'seller_id'-'fingerprint')||jsonb_build_object('shop_cover',(select s.cover from public.north_market_shops s where s.id=row.shop_id)),'isBuyer',row.buyer_id=actor,'isSeller',row.seller_id=actor,'review',case when review.order_id is null then null else to_jsonb(review)-'buyer_id' end);end $$;

create or replace function public.north_market_save_shop(p_phone_id text,p_secret text,p_expected integer,p_shop jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; old public.north_market_shops; row public.north_market_shops; p jsonb; g jsonb; o jsonb; names text[]; labels text[]; products jsonb; groups jsonb;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));
 if coalesce(p_shop->>'marketId','')<>'' then select * into old from public.north_market_shops where owner_id=actor and id=(p_shop->>'marketId')::uuid for update;if old.id is null then raise exception 'market-shop-unavailable';end if;else select * into old from public.north_market_shops where owner_id=actor order by created_at,id limit 1 for update;end if;
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
  if exists(select 1 from public.north_market_shops where owner_id=actor) then raise exception 'market-shop-selection-required';end if;
  insert into public.north_market_shops(owner_id,name,category,intro,cover,minimum,delivery,catalog,published)
  values(actor,trim(p_shop->>'name'),trim(p_shop->>'category'),coalesce(p_shop->>'intro',''),coalesce(p_shop->>'cover',''),(p_shop->>'minimum')::integer,(p_shop->>'delivery')::integer,jsonb_build_object('groups',groups,'products',products,'deliveryMinutes',coalesce((p_shop->>'deliveryMinutes')::integer,(old.catalog->>'deliveryMinutes')::integer,30)),coalesce((p_shop->>'published')::boolean,false)) returning * into row;
 else
  update public.north_market_shops set name=trim(p_shop->>'name'),category=trim(p_shop->>'category'),intro=coalesce(p_shop->>'intro',''),cover=coalesce(p_shop->>'cover',''),minimum=(p_shop->>'minimum')::integer,delivery=(p_shop->>'delivery')::integer,catalog=jsonb_build_object('groups',groups,'products',products,'deliveryMinutes',coalesce((p_shop->>'deliveryMinutes')::integer,(old.catalog->>'deliveryMinutes')::integer,30)),published=coalesce((p_shop->>'published')::boolean,false),revision=revision+1,updated_at=now() where id=old.id and owner_id=actor returning * into row;
 end if;
 return jsonb_build_object('ok',true,'id',row.id,'revision',row.revision,'published',row.published);
end $$;
create or replace function public.north_market_shop(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('ok',true,'shop',jsonb_build_object('id',s.id,'name',s.name,'category',s.category,'intro',s.intro,'cover',s.cover,'minimum',s.minimum,'delivery',s.delivery,'deliveryMinutes',coalesce((s.catalog->>'deliveryMinutes')::integer,30),'revision',s.revision,'groups',s.catalog->'groups'),
 'products',coalesce((select jsonb_agg(p||jsonb_build_object('stock',coalesce(i.quantity,0),'soldOut',coalesce(i.quantity,0)=0)) from jsonb_array_elements(s.catalog->'products')p left join public.north_market_stock i on i.shop_id=s.id and i.product_id=p->>'id' where (p->>'available')::boolean),'[]'::jsonb))
 from public.north_market_shops s where s.id=p_id and s.published and exists(select 1 from public.phone_licenses l where l.id::text=s.owner_id and l.status='active');
$$;


-- Only new paid orders receive a fixed delivery deadline; old orders remain manual.
alter table public.north_market_orders add column if not exists auto_delivery_at timestamptz;
alter table public.north_market_orders add column if not exists delivery_minutes integer check(delivery_minutes between 10 and 120);
create index if not exists north_market_auto_delivery_due on public.north_market_orders(auto_delivery_at) where auto_delivery_at is not null and status in ('paid','accepted','ready','delivered');
create or replace function public.north_market_delivery_snapshot()
returns trigger language plpgsql security definer set search_path='' as $$
declare minutes integer;
begin
 select coalesce((s.catalog->>'deliveryMinutes')::integer,30) into minutes from public.north_market_shops s where s.id=new.shop_id;
 if minutes is null or minutes not between 10 and 120 then raise exception 'market-invalid-delivery-minutes';end if;
 new.delivery_minutes:=minutes;
 new.auto_delivery_at:=greatest(now()+make_interval(mins=>minutes),new.scheduled_at);
 return new;
end $$;
revoke all on function public.north_market_delivery_snapshot() from public,anon,authenticated;
create trigger north_market_delivery_snapshot before insert on public.north_market_orders for each row execute function public.north_market_delivery_snapshot();
create or replace function public.north_market_auto_deliver()
returns integer language plpgsql security definer set search_path='' as $$
declare candidate record;o public.north_market_orders;g public.north_market_splits;who text;phase text;n integer:=0;
begin
 for candidate in select id from public.north_market_orders where auto_delivery_at is not null and status in ('paid','accepted','ready','delivered') and
 (auto_delivery_at<=now() or status='paid' and auto_delivery_at-make_interval(mins=>delivery_minutes)+interval '1 minute'<=now() or status='accepted' and auto_delivery_at-make_interval(secs=>delivery_minutes*30)<=now()) order by auto_delivery_at,id limit 100 loop
  select * into o from public.north_market_orders where id=candidate.id;
  select * into g from public.north_market_splits where order_id=o.id;
  if g.id is not null then
   perform pg_advisory_xact_lock(hashtextextended('north-market-split:'||g.id::text,0));
   for who in select host_id from public.north_market_splits where id=g.id union select guest_id from public.north_market_splits where id=g.id order by 1 loop perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||who,0));end loop;
  else perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||o.buyer_id,0));end if;
  select * into o from public.north_market_orders where id=candidate.id for update;
  if o.status not in ('paid','accepted','ready','delivered') or o.auto_delivery_at is null then continue;end if;
  if o.auto_delivery_at<=now() then
   update public.north_market_orders set status='completed',updated_at=now() where id=o.id;
   insert into public.north_market_wallets(owner_id,income) values(o.seller_id,o.subtotal) on conflict(owner_id) do update set income=north_market_wallets.income+excluded.income;
   insert into public.north_market_ledger(owner_id,kind,amount,order_id,request_id) values(o.seller_id,'income',o.subtotal,o.id,o.id);
   n:=n+1;
  elsif o.status in ('paid','accepted') then
   phase:=case when o.auto_delivery_at-make_interval(secs=>o.delivery_minutes*30)<=now() then 'ready' else 'accepted' end;
   if o.status<>phase then update public.north_market_orders set status=phase,updated_at=now() where id=o.id;end if;
  end if;
 end loop;return n;
end $$;
revoke all on function public.north_market_auto_deliver() from public,anon,authenticated;
grant execute on function public.north_market_auto_deliver() to service_role;
do $$ begin
 if to_regclass('cron.job') is null then raise exception 'market-auto-delivery-requires-cron';end if;
 if not exists(select 1 from cron.job where jobname='north-market-auto-delivery') then perform cron.schedule('north-market-auto-delivery','* * * * *','select public.north_market_auto_deliver()');
 elsif exists(select 1 from cron.job where jobname='north-market-auto-delivery' and command<>'select public.north_market_auto_deliver()') then raise exception 'market-cron-name-conflict';end if;
end $$;

create or replace function public.north_market_order_status(p_phone_id text,p_secret text,p_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; order_row public.north_market_orders; payer text;split public.north_market_splits;refund_actor text;refund_amount integer;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 select * into order_row from public.north_market_orders where id=p_id and (buyer_id=actor or seller_id=actor);
 if order_row.id is null then raise exception 'market-order-unavailable'; end if;
 select * into split from public.north_market_splits where order_id=p_id;
 if split.id is not null then perform pg_advisory_xact_lock(hashtextextended('north-market-split:'||split.id::text,0));end if;
 if split.id is null then perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||order_row.buyer_id,0));else
  for refund_actor in select host_id from public.north_market_splits where id=split.id union select guest_id from public.north_market_splits where id=split.id order by 1 loop perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||refund_actor,0));end loop;
 end if;
 select * into order_row from public.north_market_orders where id=p_id for update;
 if order_row.status='completed' and p_status='cancelled' then raise exception 'market-completed-order-no-refund';end if;
 if order_row.auto_delivery_at>now() and p_status in ('delivered','completed') then raise exception 'market-delivery-time-not-reached';end if;
 if order_row.status=p_status then return jsonb_build_object('ok',true); end if;
 if p_status='ready' and order_row.scheduled_at>now()+interval '20 minutes' or p_status in ('delivered','completed') and order_row.scheduled_at>now() then raise exception 'market-scheduled-time-not-reached';end if;
 if p_status='accepted' and actor=order_row.seller_id and order_row.status='paid' or p_status='ready' and actor=order_row.seller_id and order_row.status='accepted' or p_status='delivered' and actor=order_row.seller_id and order_row.status in ('ready','delivered') then
  update public.north_market_orders set status=p_status,updated_at=now() where id=p_id;
 elsif p_status='completed' and actor=order_row.buyer_id and order_row.status in ('ready','delivered') then
  update public.north_market_orders set status='completed',updated_at=now() where id=p_id;
  insert into public.north_market_wallets(owner_id,income) values(order_row.seller_id,order_row.subtotal) on conflict(owner_id) do update set income=north_market_wallets.income+excluded.income;
  insert into public.north_market_ledger(owner_id,kind,amount,order_id,request_id) values(order_row.seller_id,'income',order_row.subtotal,p_id,p_id);
 elsif p_status='cancelled' and order_row.status in ('paid','accepted','ready','delivered') and (actor=order_row.seller_id or order_row.status='paid') then
  update public.north_market_orders set status='cancelled',updated_at=now() where id=p_id;
  if split.id is not null then
  for refund_actor,refund_amount in select split.host_id,split.host_share union all select split.guest_id,split.guest_share loop
   perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||refund_actor,0));
   update public.north_market_wallets set balance=balance+refund_amount,updated_at=now() where owner_id=refund_actor;
   insert into public.north_market_ledger(owner_id,kind,amount,order_id,request_id,target) values(refund_actor,'refund',refund_amount,p_id,p_id,'split:'||split.id::text);
  end loop;
  update public.north_market_splits set state='cancelled' where id=split.id;
 else
  payer:=case when order_row.payer_role='' or not exists(select 1 from public.north_market_couples where owner_id=order_row.buyer_id and role_id=order_row.payer_role) then order_row.buyer_id else order_row.buyer_id||'/'||order_row.payer_role end;
  insert into public.north_market_wallets(owner_id,balance) values(payer,order_row.total) on conflict(owner_id) do update set balance=north_market_wallets.balance+excluded.balance;
  insert into public.north_market_ledger(owner_id,kind,amount,order_id,request_id,target) values(order_row.buyer_id,'refund',order_row.total,p_id,p_id,payer);
  end if;
  if order_row.coupon_id is not null then update public.north_market_coupons set used_order_id=null where id=order_row.coupon_id and used_order_id=p_id and expires_at>now();end if;
 else raise exception 'market-invalid-order-transition';end if;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.north_market_notifications(p_phone_id text,p_secret text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 return jsonb_build_object('ok',true,'unreadReplies',(select count(*) from public.north_market_reviews where buyer_id=actor and visible and replied_at is not null and reply_read_at is null),
 'deliveries',coalesce((select jsonb_agg(x) from (select o.id,o.shop_name,o.updated_at from public.north_market_orders o where (o.status='delivered' or o.status='completed' and o.auto_delivery_at is not null)
 and (o.buyer_id=actor or exists(select 1 from public.north_market_splits g where g.order_id=o.id and g.guest_id=actor)) order by o.updated_at desc limit 20)x),'[]'::jsonb));
end $$;
commit;
