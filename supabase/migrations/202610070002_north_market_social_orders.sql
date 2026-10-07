-- Marketplace follow-up: immutable seller replies and delivery reservations.
-- Existing marketplace data is preserved; no friend/companion tables are changed.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

alter table public.north_market_reviews add column if not exists seller_reply text;
alter table public.north_market_reviews add column if not exists replied_at timestamptz;
alter table public.north_market_reviews add column if not exists reply_read_at timestamptz;
alter table public.north_market_orders add column if not exists scheduled_at timestamptz;

create or replace function public.north_market_reply(p_phone_id text,p_secret text,p_order uuid,p_text text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; r public.north_market_reviews;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if length(trim(coalesce(p_text,''))) not between 1 and 500 then raise exception 'market-invalid-reply';end if;
 select v.* into r from public.north_market_reviews v join public.north_market_orders o on o.id=v.order_id
 where v.order_id=p_order and o.seller_id=actor and o.status='completed' and v.visible for update of v;
 if r.order_id is null then raise exception 'market-review-unavailable';end if;
 if r.replied_at is not null then
  if r.seller_reply=trim(p_text) then return jsonb_build_object('ok',true);end if;
  raise exception 'market-reply-already-sent';
 end if;
 update public.north_market_reviews set seller_reply=trim(p_text),replied_at=now(),reply_read_at=null where order_id=p_order;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.north_market_review_inbox(p_phone_id text,p_secret text,p_seller boolean default false,p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 return jsonb_build_object('ok',true,'unread',(select count(*) from public.north_market_reviews r where r.buyer_id=actor and r.visible and r.replied_at is not null and r.reply_read_at is null),
 'reviews',coalesce((select jsonb_agg(to_jsonb(x) order by x.order_id desc) from (
 select r.order_id,r.shop_id,r.rating,r.packaging,r.text,r.images,r.revision,r.created_at,r.updated_at,r.seller_reply,r.replied_at,r.reply_read_at,
 o.shop_name,(select jsonb_agg(i->>'name') from jsonb_array_elements(o.items)i) as products,
 case when r.anonymous then '匿名顾客' else coalesce((select p.display_name from public.phone_licenses l join public.phone_friend_profiles p on p.phone_id=l.phone_friend_id where l.id::text=r.buyer_id),'顾客') end as name
 from public.north_market_reviews r join public.north_market_orders o on o.id=r.order_id
 where r.visible and o.status='completed' and (case when p_seller then o.seller_id=actor else r.buyer_id=actor end)
 and (p_after is null or r.order_id<p_after) order by r.order_id desc limit 21)x),'[]'::jsonb));
end $$;

create or replace function public.north_market_reply_read(p_phone_id text,p_secret text,p_orders jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if jsonb_typeof(p_orders)<>'array' or jsonb_array_length(p_orders)>20 then raise exception 'market-invalid-request';end if;
 update public.north_market_reviews set reply_read_at=now() where buyer_id=actor and replied_at is not null and reply_read_at is null
 and order_id::text in (select jsonb_array_elements_text(p_orders));
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.north_market_reviews(p_shop uuid,p_after uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
with page as (
 select r.order_id,r.rating,r.packaging,r.anonymous,r.text,r.images,r.created_at,r.updated_at,r.seller_reply,r.replied_at,
 case when r.anonymous then '匿名用户' else coalesce((select p.display_name from public.phone_licenses l join public.phone_friend_profiles p on p.phone_id=l.phone_friend_id where l.id::text=r.buyer_id),'顾客') end as name,
 (select jsonb_agg(x->>'name') from jsonb_array_elements(o.items)x) as products
 from public.north_market_reviews r join public.north_market_orders o on o.id=r.order_id
 where r.shop_id=p_shop and r.visible and o.status='completed' and (p_after is null or r.order_id<p_after)
 and exists(select 1 from public.north_market_shops s where s.id=p_shop and s.published)
 order by r.order_id desc limit 9
)select jsonb_build_object('ok',true,'reviews',coalesce(jsonb_agg(to_jsonb(page) order by order_id desc),'[]'::jsonb),
 'rating',(select round(avg(r.rating),1) from public.north_market_reviews r where r.shop_id=p_shop and r.visible),
 'count',(select count(*) from public.north_market_reviews r where r.shop_id=p_shop and r.visible)) from page;
$$;

revoke all on function public.north_market_reply(text,text,uuid,text),public.north_market_review_inbox(text,text,boolean,uuid),public.north_market_reply_read(text,text,jsonb) from public;
grant execute on function public.north_market_reply(text,text,uuid,text),public.north_market_review_inbox(text,text,boolean,uuid),public.north_market_reply_read(text,text,jsonb) to anon,authenticated;

create table if not exists public.north_market_splits (
 id uuid primary key default gen_random_uuid(),host_id text not null,guest_id text not null,seller_id text not null,
 client_id uuid not null,shop_id uuid not null references public.north_market_shops(id),shop_revision integer not null,
 fingerprint text not null,quote jsonb not null,address jsonb not null,utensils boolean not null,note text not null default '',
 host_share integer not null check(host_share>0),guest_share integer not null check(guest_share>0),
 host_paid boolean not null default false,guest_paid boolean not null default false,
 state text not null default 'pending' check(state in ('pending','paid','cancelled','expired')),
 order_id uuid references public.north_market_orders(id),expires_at timestamptz not null default now()+interval '30 minutes',
 created_at timestamptz not null default now(),unique(host_id,client_id),check(host_id<>guest_id),check(host_id<>seller_id),check(guest_id<>seller_id)
);
create index if not exists north_market_split_host on public.north_market_splits(host_id,state);
create index if not exists north_market_split_guest on public.north_market_splits(guest_id,state);
alter table public.north_market_splits enable row level security;
revoke all on public.north_market_splits from anon,authenticated;

create or replace function public.north_market_schedule(p_value text)
returns timestamptz language plpgsql stable set search_path='' as $$
declare scheduled timestamptz;
begin
 if coalesce(p_value,'')='' then return null;end if;
 scheduled:=p_value::timestamptz;
 if scheduled<now()+interval '30 minutes' or scheduled>now()+interval '6 days' then raise exception 'market-invalid-delivery-time';end if;
 return scheduled;
end $$;
revoke all on function public.north_market_schedule(text) from public;

-- Internal refund. Calling endpoints authenticate the participant before invoking this function.
create or replace function public.north_market_split_refund(p_id uuid,p_expired boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare g public.north_market_splits;a text;amount integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('north-market-split:'||p_id::text,0));
 select * into g from public.north_market_splits where id=p_id for update;
 if g.id is null or g.state<>'pending' or p_expired and g.expires_at>now() then return;end if;
 for a,amount in select g.host_id,g.host_share where g.host_paid union all select g.guest_id,g.guest_share where g.guest_paid loop
  perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||a,0));
  update public.north_market_wallets set balance=balance+amount,updated_at=now() where owner_id=a;
  insert into public.north_market_ledger(owner_id,kind,amount,request_id,target) values(a,'refund',amount,g.id,'split:'||g.id::text);
 end loop;
 update public.north_market_splits set state=case when p_expired then 'expired' else 'cancelled' end where id=g.id;
end $$;
revoke all on function public.north_market_split_refund(uuid,boolean) from public;

create or replace function public.north_market_split_create(p_phone_id text,p_secret text,p_client uuid,p_guest text,p_shop uuid,p_revision integer,p_lines jsonb,p_address jsonb,p_utensils boolean,p_note text,p_total integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;guest text;seller text;q jsonb;g public.north_market_splits;fingerprint text;scheduled timestamptz;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_client is null or p_utensils is null or length(coalesce(p_note,''))>200 or length(coalesce(p_address->>'address','')) not between 1 and 200 or length(coalesce(p_address->>'name','')) not between 1 and 40 or length(coalesce(p_address->>'phone',''))>30 then raise exception 'market-invalid-order';end if;
 if not exists(select 1 from public.phone_friend_requests where status='accepted' and ((from_id=upper(trim(p_phone_id)) and to_id=upper(trim(p_guest))) or (to_id=upper(trim(p_phone_id)) and from_id=upper(trim(p_guest))))) then raise exception 'market-friend-only';end if;
 select id::text into guest from public.phone_licenses where phone_friend_id=upper(trim(p_guest)) and status='active' order by created_at,id limit 1;
 select owner_id into seller from public.north_market_shops where id=p_shop and published;
 if guest is null or seller is null or guest=actor or seller in (actor,guest) then raise exception 'market-invalid-participant';end if;
 scheduled:=nullif(p_address->>'scheduledAt','')::timestamptz;
 p_address:=jsonb_build_object('address',p_address->>'address','name',p_address->>'name','phone',coalesce(p_address->>'phone',''),'scheduledAt',scheduled);
 fingerprint:=md5(jsonb_build_object('guest',guest,'shop',p_shop,'revision',p_revision,'lines',p_lines,'address',p_address,'utensils',p_utensils,'note',p_note,'total',p_total)::text);
 perform pg_advisory_xact_lock(hashtextextended('north-market-split-client:'||actor||p_client::text,0));
 select * into g from public.north_market_splits where host_id=actor and client_id=p_client;
 if g.id is not null then
  if g.fingerprint<>fingerprint then raise exception 'market-request-reused';end if;
  return jsonb_build_object('ok',true,'id',g.id);
 end if;
 if exists(select 1 from public.north_market_orders where buyer_id=actor and client_id=p_client) then raise exception 'market-client-already-used';end if;
 perform public.north_market_schedule(p_address->>'scheduledAt');
 if (select count(*) from public.north_market_splits where host_id=actor and state='pending' and expires_at>now())>=5 then raise exception 'market-too-many-pending-splits';end if;
 q:=public.north_market_quote(p_shop,p_revision,p_lines);
 if p_total is null or p_total<>(q->>'total')::integer then raise exception 'market-price-changed';end if;
 insert into public.north_market_splits(host_id,guest_id,seller_id,client_id,shop_id,shop_revision,fingerprint,quote,address,utensils,note,host_share,guest_share)
 values(actor,guest,seller,p_client,p_shop,p_revision,fingerprint,q,p_address,p_utensils,coalesce(p_note,''),p_total/2,p_total-p_total/2) returning * into g;
 return jsonb_build_object('ok',true,'id',g.id);
end $$;

create or replace function public.north_market_split_get(p_phone_id text,p_secret text,p_id uuid default null,p_client uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;expired uuid;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 for expired in select id from public.north_market_splits where (host_id=actor or guest_id=actor) and state='pending' and expires_at<=now() order by case when host_paid then host_id when guest_paid then guest_id else null end,id loop perform public.north_market_split_refund(expired,true);end loop;
 return jsonb_build_object('ok',true,'splits',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
 select id,client_id,shop_id,quote,address,utensils,note,host_share,guest_share,host_paid,guest_paid,state,order_id,expires_at,created_at,host_id=actor as is_host
 from public.north_market_splits where (host_id=actor or guest_id=actor) and (p_id is null or id=p_id) and (p_client is null or client_id=p_client) order by created_at desc limit 21)x),'[]'::jsonb));
end $$;

create or replace function public.north_market_split_cancel(p_phone_id text,p_secret text,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if not exists(select 1 from public.north_market_splits where id=p_id and (host_id=actor or guest_id=actor)) then raise exception 'market-split-unavailable';end if;
 perform public.north_market_split_refund(p_id,false);
 if exists(select 1 from public.north_market_splits where id=p_id and state='paid') then raise exception 'market-split-already-ordered';end if;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.north_market_split_pay(p_phone_id text,p_secret text,p_id uuid,p_pin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;g public.north_market_splits;wallet public.north_market_wallets;amount integer;order_uuid uuid;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-split:'||p_id::text,0));
 select * into g from public.north_market_splits where id=p_id and (host_id=actor or guest_id=actor) for update;
 if g.id is null then raise exception 'market-split-unavailable';end if;
 if g.state='pending' and g.expires_at<=now() then perform public.north_market_split_refund(p_id,true);return jsonb_build_object('ok',false,'error','拼单已超时，已付款部分原路退回');end if;
 if g.state in ('expired','cancelled') then raise exception 'market-split-closed';end if;
 if g.state='paid' or actor=g.host_id and g.host_paid or actor=g.guest_id and g.guest_paid then return jsonb_build_object('ok',true,'orderId',g.order_id);end if;
 if not exists(select 1 from public.north_market_shops where id=g.shop_id and published and revision=g.shop_revision) then perform public.north_market_split_refund(p_id,false);return jsonb_build_object('ok',false,'error','店铺或商品发生变化，拼单已取消并退款');end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into wallet from public.north_market_wallets where owner_id=actor for update;
 if wallet.owner_id is null then raise exception 'market-claim-first';end if;
 if wallet.pin_blocked_until>now() then return jsonb_build_object('ok',false,'error','支付密码错误次数过多，请稍后重试');end if;
 if p_pin is null or p_pin !~ '^[0-9]{5}$' or wallet.pin_hash is null and p_pin<>'00000' or wallet.pin_hash is not null and extensions.crypt(p_pin,wallet.pin_hash)<>wallet.pin_hash then
  update public.north_market_wallets set pin_failures=pin_failures+1,pin_blocked_until=case when pin_failures>=4 then now()+interval '5 minutes' else null end where owner_id=actor;
  return jsonb_build_object('ok',false,'error','支付密码不正确');
 end if;
 amount:=case when actor=g.host_id then g.host_share else g.guest_share end;
 update public.north_market_wallets set balance=balance-amount,pin_failures=0,pin_blocked_until=null,updated_at=now() where owner_id=actor and balance>=amount;
 if not found then raise exception 'market-insufficient-funds';end if;
 insert into public.north_market_ledger(owner_id,kind,amount,request_id,target) values(actor,'purchase',-amount,g.id,'split:'||g.id::text);
 update public.north_market_splits set host_paid=host_paid or actor=host_id,guest_paid=guest_paid or actor=guest_id where id=p_id returning * into g;
 if g.host_paid and g.guest_paid then
  insert into public.north_market_orders(buyer_id,seller_id,shop_id,client_id,fingerprint,items,shop_name,subtotal,delivery,total,address,utensils,note,scheduled_at)
  values(g.host_id,g.seller_id,g.shop_id,g.client_id,g.fingerprint,g.quote->'items',g.quote->>'shopName',(g.quote->>'subtotal')::integer,(g.quote->>'delivery')::integer,(g.quote->>'total')::integer,g.address,g.utensils,g.note,(g.address->>'scheduledAt')::timestamptz) returning id into order_uuid;
  update public.north_market_splits set state='paid',order_id=order_uuid where id=p_id;
 end if;
 return jsonb_build_object('ok',true,'orderId',order_uuid);
end $$;

revoke all on function public.north_market_split_create(text,text,uuid,text,uuid,integer,jsonb,jsonb,boolean,text,integer),public.north_market_split_get(text,text,uuid,uuid),public.north_market_split_cancel(text,text,uuid),public.north_market_split_pay(text,text,uuid,text) from public;
grant execute on function public.north_market_split_create(text,text,uuid,text,uuid,integer,jsonb,jsonb,boolean,text,integer),public.north_market_split_get(text,text,uuid,uuid),public.north_market_split_cancel(text,text,uuid),public.north_market_split_pay(text,text,uuid,text) to anon,authenticated;


alter table public.north_market_orders drop constraint north_market_orders_status_check;
alter table public.north_market_orders add constraint north_market_orders_status_check check(status in ('paid','accepted','ready','delivered','completed','cancelled'));
create or replace function public.north_market_order_create(p_phone_id text,p_secret text,p_client uuid,p_shop uuid,p_revision integer,p_lines jsonb,p_address jsonb,p_utensils boolean,p_note text,p_role text,p_couple_revision integer,p_pin text,p_total integer,p_coupon uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; seller text; payer text; quote jsonb; prior public.north_market_orders; order_row public.north_market_orders; wallet public.north_market_wallets; fingerprint text;scheduled timestamptz;coupon public.north_market_coupons;discount integer:=0;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_client is null or p_address is null or jsonb_typeof(p_address)<>'object' or length(coalesce(p_address->>'address','')) not between 1 and 200 or length(coalesce(p_address->>'name','')) not between 1 and 40 or length(coalesce(p_address->>'phone',''))>30 or p_utensils is null or length(coalesce(p_note,''))>200 or p_role is null then raise exception 'market-invalid-order'; end if;
 scheduled:=nullif(p_address->>'scheduledAt','')::timestamptz;
 p_address:=jsonb_build_object('address',p_address->>'address','name',p_address->>'name','phone',coalesce(p_address->>'phone',''),'recipientRole',coalesce(p_address->>'recipientRole',''),'scheduledAt',scheduled);
 if scheduled is null then p_address:=p_address-'scheduledAt';end if;
 fingerprint:=md5(jsonb_build_object('shop',p_shop,'revision',p_revision,'lines',p_lines,'address',p_address,'utensils',p_utensils,'note',p_note,'role',p_role,'total',p_total,'coupon',p_coupon)::text);
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into prior from public.north_market_orders where buyer_id=actor and client_id=p_client;
 if prior.id is not null then
  if prior.fingerprint<>fingerprint then raise exception 'market-request-reused'; end if;
  return jsonb_build_object('ok',true,'order',to_jsonb(prior)-'buyer_id'-'seller_id'-'fingerprint');
 end if;
 if exists(select 1 from public.north_market_splits where host_id=actor and client_id=p_client) then raise exception 'market-client-used-for-split';end if;
 perform public.north_market_schedule(p_address->>'scheduledAt');
 select owner_id into seller from public.north_market_shops where id=p_shop and published for share;
 if seller is null or seller=actor then raise exception 'market-self-order-not-allowed'; end if;
 quote:=public.north_market_quote(p_shop,p_revision,p_lines);
 if p_coupon is not null then
  select * into coupon from public.north_market_coupons where id=p_coupon and owner_id=actor and used_order_id is null and expires_at>now() for update;
  if coupon.id is null or (quote->>'subtotal')::integer<coupon.minimum then raise exception 'market-coupon-unavailable';end if;
  discount:=least(coupon.face,(quote->>'subtotal')::integer);
 end if;
 if p_total is null or p_total<>(quote->>'total')::integer-discount then raise exception 'market-price-changed'; end if;
 if p_role<>'' and not exists(select 1 from public.north_market_couples where owner_id=actor and role_id=p_role and revision=p_couple_revision) then raise exception 'market-couple-only'; end if;
 if coalesce(p_address->>'recipientRole','')<>'' and not exists(select 1 from public.north_market_couples where owner_id=actor and role_id=p_address->>'recipientRole') then raise exception 'market-couple-only';end if;
 select * into wallet from public.north_market_wallets where owner_id=actor for update;
 if wallet.owner_id is null then raise exception 'market-claim-first'; end if;
 if wallet.pin_blocked_until>now() then return jsonb_build_object('ok',false,'error','支付密码错误次数过多，请稍后重试'); end if;
 if p_pin is null or p_pin !~ '^[0-9]{5}$' or wallet.pin_hash is null and p_pin<>'00000' or wallet.pin_hash is not null and extensions.crypt(p_pin,wallet.pin_hash)<>wallet.pin_hash then
  update public.north_market_wallets set pin_failures=pin_failures+1,pin_blocked_until=case when pin_failures>=4 then now()+interval '5 minutes' else null end where owner_id=actor;
  return jsonb_build_object('ok',false,'error','支付密码不正确');
 end if;
 update public.north_market_wallets set pin_failures=0,pin_blocked_until=null where owner_id=actor;
 payer:=case when p_role='' then actor else actor||'/'||p_role end;
 update public.north_market_wallets set balance=balance-p_total,updated_at=now() where owner_id=payer and balance>=p_total;
 if not found then raise exception 'market-insufficient-funds'; end if;
 insert into public.north_market_orders(buyer_id,seller_id,shop_id,client_id,fingerprint,items,shop_name,subtotal,delivery,total,address,utensils,note,payer_role,discount,coupon_id,scheduled_at)
 values(actor,seller,p_shop,p_client,fingerprint,quote->'items',quote->>'shopName',(quote->>'subtotal')::integer,(quote->>'delivery')::integer,p_total,p_address,p_utensils,coalesce(p_note,''),p_role,discount,p_coupon,scheduled) returning * into order_row;
 if p_coupon is not null then update public.north_market_coupons set used_order_id=order_row.id where id=p_coupon;end if;
 insert into public.north_market_ledger(owner_id,kind,amount,order_id,request_id,target) values(actor,'purchase',-p_total,order_row.id,p_client,p_role);
 return jsonb_build_object('ok',true,'order',to_jsonb(order_row)-'buyer_id'-'seller_id'-'fingerprint');
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
create or replace function public.north_market_orders(p_phone_id text,p_secret text,p_seller boolean default false,p_after uuid default null,p_client uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 return jsonb_build_object('ok',true,'orders',coalesce((select jsonb_agg(to_jsonb(x)-'buyer_id'-'seller_id'-'fingerprint' order by x.id desc) from (select o.*,o.buyer_id=actor as is_buyer from public.north_market_orders o where (case when p_seller then o.seller_id=actor else o.buyer_id=actor or exists(select 1 from public.north_market_splits g where g.order_id=o.id and g.guest_id=actor) end) and (p_after is null or o.id<p_after) and (p_client is null or o.client_id=p_client) order by o.id desc limit 21)x),'[]'::jsonb));end $$;
create or replace function public.north_market_order(p_phone_id text,p_secret text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text; row public.north_market_orders; review public.north_market_reviews;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 select * into row from public.north_market_orders where id=p_id and (buyer_id=actor or seller_id=actor or exists(select 1 from public.north_market_splits g where g.order_id=p_id and g.guest_id=actor));
 if row.id is null then raise exception 'market-order-unavailable';end if;
 select * into review from public.north_market_reviews where order_id=p_id;
 return jsonb_build_object('ok',true,'order',to_jsonb(row)-'buyer_id'-'seller_id'-'fingerprint','isBuyer',row.buyer_id=actor,'isSeller',row.seller_id=actor,'review',case when review.order_id is null then null else to_jsonb(review)-'buyer_id' end);end $$;

create or replace function public.north_market_split_expire()
returns integer language plpgsql security definer set search_path='' as $$
declare id uuid;count integer:=0;
begin
 for id in select g.id from public.north_market_splits g where g.state='pending' and g.expires_at<=now() order by case when g.host_paid then g.host_id when g.guest_paid then g.guest_id else null end,g.id limit 100 loop
  perform public.north_market_split_refund(id,true);count:=count+1;
 end loop;
 return count;
end $$;
revoke all on function public.north_market_split_expire() from public;
grant execute on function public.north_market_split_expire() to service_role;
-- If pg_cron is already enabled, add only our own expiry job. Never change another scheduled job.
do $$ begin
 if to_regclass('cron.job') is not null then
  if not exists(select 1 from cron.job where jobname='north-market-split-expiry') then
   perform cron.schedule('north-market-split-expiry','* * * * *','select public.north_market_split_expire()');
  elsif exists(select 1 from cron.job where jobname='north-market-split-expiry' and command<>'select public.north_market_split_expire()') then raise exception 'market-cron-name-conflict';end if;
 end if;
end $$;

create or replace function public.north_market_notifications(p_phone_id text,p_secret text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 return jsonb_build_object('ok',true,'unreadReplies',(select count(*) from public.north_market_reviews where buyer_id=actor and visible and replied_at is not null and reply_read_at is null),
 'deliveries',coalesce((select jsonb_agg(x) from (select o.id,o.shop_name,o.updated_at from public.north_market_orders o where o.status='delivered'
 and (o.buyer_id=actor or exists(select 1 from public.north_market_splits g where g.order_id=o.id and g.guest_id=actor)) order by o.updated_at desc limit 20)x),'[]'::jsonb));
end $$;
revoke all on function public.north_market_notifications(text,text) from public;
grant execute on function public.north_market_notifications(text,text) to anon,authenticated;

create or replace function public.north_market_wallet(p_phone_id text,p_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; wallet public.north_market_wallets; couple public.north_market_couples;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 select * into wallet from public.north_market_wallets where owner_id=actor;
 select * into couple from public.north_market_couples where owner_id=actor;
 return jsonb_build_object('ok',true,'accountKey',md5(actor),'balance',coalesce(wallet.balance,0),'income',coalesce(wallet.income,0),'claimed',exists(select 1 from public.north_market_ledger where owner_id=actor and kind='grant'),'couple',case when couple.role_id<>'' then jsonb_build_object('id',couple.role_id,'name',couple.role_name,'revision',couple.revision,'balance',coalesce((select balance from public.north_market_wallets where owner_id=actor||'/'||couple.role_id),0)) else null end,
 'ledger',coalesce((select jsonb_agg(x order by x.created_at desc) from (select kind,amount,target,created_at from public.north_market_ledger where owner_id=actor order by created_at desc,id desc limit 30)x),'[]'::jsonb));
end $$;
create unique index if not exists north_market_split_order on public.north_market_splits(order_id) where order_id is not null;
create index if not exists north_market_split_expiry on public.north_market_splits(expires_at,id) where state='pending';
create index if not exists north_market_unread_reply on public.north_market_reviews(buyer_id) where visible and replied_at is not null and reply_read_at is null;
create index if not exists north_market_delivered_buyer on public.north_market_orders(buyer_id,updated_at desc) where status='delivered';
-- Inventory is paid for with cloud virtual funds, never with simulated local balances.
alter table public.north_market_shops add column if not exists created_at timestamptz not null default now();
alter table public.north_market_orders add column if not exists stock_cost bigint not null default 0;
alter table public.north_market_orders add column if not exists stock_lines jsonb not null default '[]'::jsonb;
alter table public.north_market_splits add column if not exists stock_cost bigint not null default 0;
alter table public.north_market_splits add column if not exists stock_lines jsonb not null default '[]'::jsonb;
alter table public.north_market_ledger add column if not exists shop_id uuid references public.north_market_shops(id);
alter table public.north_market_ledger drop constraint if exists north_market_ledger_kind_check;
alter table public.north_market_ledger add constraint north_market_ledger_kind_check check(kind in ('grant','admin_credit','purchase','refund','income','withdraw','allocate','coupon','restock','stock_return','startup'));

create table if not exists public.north_market_stock (
 shop_id uuid not null references public.north_market_shops(id),product_id text not null,
 name text not null,unit text not null,image text not null default '',
 quantity integer not null default 0 check(quantity>=0),
 restock_revision integer not null default 0,notice_revision integer not null default 0,
 notice_id uuid not null default gen_random_uuid(),updated_at timestamptz not null default now(),
 primary key(shop_id,product_id)
);
create table if not exists public.north_market_stock_lots (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,product_id text not null,
 owner_id text not null,quantity integer not null check(quantity between 1 and 1000),
 remaining integer not null check(remaining between 0 and quantity),unit_cost integer not null check(unit_cost>0),
 funding text not null check(funding in ('wallet','income')),request_id uuid not null,
 created_at timestamptz not null default now(),foreign key(shop_id,product_id) references public.north_market_stock(shop_id,product_id),unique(owner_id,request_id)
);
create index if not exists north_market_stock_lots_available on public.north_market_stock_lots(shop_id,product_id,created_at,id) where remaining>0;
alter table public.north_market_stock enable row level security;
alter table public.north_market_stock_lots enable row level security;
revoke all on public.north_market_stock,public.north_market_stock_lots from anon,authenticated;

create or replace function public.north_market_check_pin(p_actor text,p_pin text)
returns boolean language plpgsql security definer set search_path='' as $$
declare wallet public.north_market_wallets;
begin
 select * into wallet from public.north_market_wallets where owner_id=p_actor for update;
 if wallet.owner_id is null then raise exception 'market-claim-first';end if;
 if wallet.pin_blocked_until>now() then return false;end if;
 if p_pin is null or p_pin !~ '^[0-9]{5}$' or wallet.pin_hash is null and p_pin<>'00000' or wallet.pin_hash is not null and extensions.crypt(p_pin,wallet.pin_hash)<>wallet.pin_hash then
  update public.north_market_wallets set pin_failures=pin_failures+1,pin_blocked_until=case when pin_failures>=4 then now()+interval '5 minutes' else null end where owner_id=p_actor;return false;
 end if;
 update public.north_market_wallets set pin_failures=0,pin_blocked_until=null where owner_id=p_actor;return true;
end $$;
revoke all on function public.north_market_check_pin(text,text) from public;

create table if not exists public.north_market_business_ops(owner_id text not null,request_id uuid not null,fingerprint text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(owner_id,request_id));
alter table public.north_market_business_ops enable row level security;revoke all on public.north_market_business_ops from anon,authenticated;
create or replace function public.north_market_stock_change(p_phone_id text,p_secret text,p_shop uuid,p_product text,p_quantity integer,p_source text,p_request uuid,p_pin text,p_expected integer,p_return boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;shop public.north_market_shops;item jsonb;head public.north_market_stock;lot public.north_market_stock_lots;amount bigint;cost integer;left_quantity integer;take integer;wallet_return bigint:=0;income_return bigint:=0;fingerprint text;previous public.north_market_business_ops;result jsonb;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_request is null or p_quantity not between 1 and 1000 or p_source not in ('wallet','income') or p_product is null then raise exception 'market-invalid-stock-request';end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 fingerprint:=md5(jsonb_build_array(p_shop,p_product,p_quantity,p_source,p_expected,p_return)::text);select * into previous from public.north_market_business_ops where owner_id=actor and request_id=p_request;if previous.request_id is not null then if previous.fingerprint<>fingerprint then raise exception 'market-request-reused';end if;return previous.result;end if;
 select * into shop from public.north_market_shops where id=p_shop and owner_id=actor;
 if shop.id is null then raise exception 'market-shop-unavailable';end if;
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
revoke all on function public.north_market_stock_change(text,text,uuid,text,integer,text,uuid,text,integer,boolean) from public;
grant execute on function public.north_market_stock_change(text,text,uuid,text,integer,text,uuid,text,integer,boolean) to anon,authenticated;

create or replace function public.north_market_stock_take(p_shop uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare product text;wanted_quantity integer;head public.north_market_stock;lot public.north_market_stock_lots;left_quantity integer;take integer;line_cost bigint;lines jsonb:='[]'::jsonb;total bigint:=0;
begin
 for product,wanted_quantity in select x->>'productId',sum((x->>'quantity')::integer)::integer from jsonb_array_elements(p_items)x group by x->>'productId' order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('north-market-stock:'||p_shop::text||':'||product,0));
  select * into head from public.north_market_stock where shop_id=p_shop and product_id=product for update;
  if head.shop_id is null or head.quantity<wanted_quantity then raise exception 'market-stock-unavailable';end if;
  left_quantity:=wanted_quantity;
  for lot in select * from public.north_market_stock_lots where shop_id=p_shop and product_id=product and remaining>0 order by created_at,id for update loop
   exit when left_quantity=0;take:=least(left_quantity,lot.remaining);line_cost:=take::bigint*lot.unit_cost;
   if exists(select 1 from jsonb_array_elements(p_items)x where x->>'productId'=product and (x->>'unitPrice')::integer<=lot.unit_cost) then raise exception 'market-unprofitable-price';end if;
   update public.north_market_stock_lots set remaining=remaining-take where id=lot.id;
   lines:=lines||jsonb_build_array(jsonb_build_object('lotId',lot.id,'productId',product,'quantity',take,'unitCost',lot.unit_cost,'cost',line_cost));total:=total+line_cost;left_quantity:=left_quantity-take;
  end loop;
  if left_quantity<>0 then raise exception 'market-stock-invariant';end if;
  update public.north_market_stock set quantity=quantity-wanted_quantity,updated_at=now() where shop_id=p_shop and product_id=product;
 end loop;
 return jsonb_build_object('cost',total,'lines',lines);
end $$;
revoke all on function public.north_market_stock_take(uuid,jsonb) from public;

create or replace function public.north_market_stock_restore(p_shop uuid,p_lines jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;product text;returned integer;
begin
 for product,returned in select x->>'productId',sum((x->>'quantity')::integer)::integer from jsonb_array_elements(p_lines)x group by x->>'productId' order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('north-market-stock:'||p_shop::text||':'||product,0));
  for item in select x from jsonb_array_elements(p_lines)x where x->>'productId'=product loop
   update public.north_market_stock_lots set remaining=remaining+(item->>'quantity')::integer where id=(item->>'lotId')::uuid and shop_id=p_shop and product_id=product;
   if not found then raise exception 'market-stock-invariant';end if;
  end loop;
  update public.north_market_stock set quantity=quantity+returned,updated_at=now() where shop_id=p_shop and product_id=product;
 end loop;
end $$;
revoke all on function public.north_market_stock_restore(uuid,jsonb) from public;

create or replace function public.north_market_stock_order_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare reservation public.north_market_splits;stock jsonb;
begin
 if tg_op='INSERT' then
  select * into reservation from public.north_market_splits where host_id=new.buyer_id and client_id=new.client_id and host_paid and guest_paid and state='pending';
  if reservation.id is not null then new.stock_cost:=reservation.stock_cost;new.stock_lines:=reservation.stock_lines;
  else stock:=public.north_market_stock_take(new.shop_id,new.items);new.stock_cost:=(stock->>'cost')::bigint;new.stock_lines:=stock->'lines';end if;
 elsif new.status='cancelled' and old.status<>'cancelled' then perform public.north_market_stock_restore(old.shop_id,old.stock_lines);
 end if;
 return new;
end $$;
revoke all on function public.north_market_stock_order_trigger() from public;
drop trigger if exists north_market_stock_orders on public.north_market_orders;
create trigger north_market_stock_orders before insert or update of status on public.north_market_orders for each row execute function public.north_market_stock_order_trigger();

create or replace function public.north_market_stock_split_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare stock jsonb;
begin
 if old.state='pending' and not old.host_paid and not old.guest_paid and (new.host_paid or new.guest_paid) then
  stock:=public.north_market_stock_take(new.shop_id,new.quote->'items');new.stock_cost:=(stock->>'cost')::bigint;new.stock_lines:=stock->'lines';
 elsif old.state='pending' and new.state in ('cancelled','expired') then perform public.north_market_stock_restore(old.shop_id,old.stock_lines);
 end if;
 return new;
end $$;
revoke all on function public.north_market_stock_split_trigger() from public;
drop trigger if exists north_market_stock_splits on public.north_market_splits;
create trigger north_market_stock_splits before update on public.north_market_splits for each row execute function public.north_market_stock_split_trigger();

create or replace function public.north_market_business(p_phone_id text,p_secret text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;wallet public.north_market_wallets;profit bigint;stores integer;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);select * into wallet from public.north_market_wallets where owner_id=actor;
 select count(*) into stores from public.north_market_shops where owner_id=actor;
 profit:=coalesce((select sum(subtotal-stock_cost) from public.north_market_orders where seller_id=actor and status='completed'),0)+coalesce((select sum(amount) from public.north_market_ledger where owner_id=actor and kind='startup'),0);
 return jsonb_build_object('ok',true,'imageFolder',md5(actor),'balance',coalesce(wallet.balance,0),'income',coalesce(wallet.income,0),'profit',profit,'shopCount',stores,'nextStartupFee',case stores when 0 then 0 when 1 then 20000 when 2 then 40000 else null end,
 'inventoryValue',coalesce((select sum(l.remaining::bigint*l.unit_cost) from public.north_market_stock_lots l where l.owner_id=actor),0),
 'shops',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at,x.id) from (select s.*,coalesce((select sum(o.subtotal) from public.north_market_orders o where o.shop_id=s.id and o.status='completed'),0) as revenue,coalesce((select sum(o.stock_cost) from public.north_market_orders o where o.shop_id=s.id and o.status='completed'),0) as cost from public.north_market_shops s where s.owner_id=actor)x),'[]'::jsonb),
 'stock',coalesce((select jsonb_agg(to_jsonb(x)) from (select i.*,s.name as shop_name,
  coalesce((select sum(l.remaining::bigint*l.unit_cost) from public.north_market_stock_lots l where l.shop_id=i.shop_id and l.product_id=i.product_id),0) as cost_value,
  coalesce((select max(l.unit_cost) from public.north_market_stock_lots l where l.shop_id=i.shop_id and l.product_id=i.product_id and l.remaining>0),0) as highest_cost,
  (select (p->>'price')::integer from jsonb_array_elements(s.catalog->'products')p where p->>'id'=i.product_id) as sale_price,
  coalesce((select jsonb_agg(jsonb_build_object('quantity',l.remaining,'unitCost',l.unit_cost,'source',l.funding) order by l.created_at,l.id) from public.north_market_stock_lots l where l.shop_id=i.shop_id and l.product_id=i.product_id and l.remaining>0),'[]'::jsonb) as lots
  from public.north_market_stock i join public.north_market_shops s on s.id=i.shop_id where s.owner_id=actor and (i.quantity>0 or exists(select 1 from jsonb_array_elements(s.catalog->'products')p where p->>'id'=i.product_id)))x),'[]'::jsonb));
end $$;
revoke all on function public.north_market_business(text,text) from public;
grant execute on function public.north_market_business(text,text) to anon,authenticated;

-- The free first storefront is retained. Expansion uses earned, unsettled shop income.
create table if not exists public.north_market_shop_creations(owner_id text not null,request_id uuid not null,shop_id uuid not null references public.north_market_shops(id),fee integer not null,created_at timestamptz not null default now(),primary key(owner_id,request_id));
alter table public.north_market_shop_creations enable row level security;
revoke all on public.north_market_shop_creations from anon,authenticated;
alter table public.north_market_shops drop constraint if exists north_market_shops_owner_id_key;
create index if not exists north_market_shops_owner on public.north_market_shops(owner_id,created_at,id);

create or replace function public.north_market_shop_create(p_phone_id text,p_secret text,p_name text,p_category text,p_request uuid,p_expected integer,p_pin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;count integer;fee integer;profit bigint;prior public.north_market_shop_creations;shop public.north_market_shops;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_request is null or length(trim(coalesce(p_name,''))) not between 1 and 40 or length(trim(coalesce(p_category,''))) not between 1 and 40 then raise exception 'market-invalid-shop';end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into prior from public.north_market_shop_creations where owner_id=actor and request_id=p_request;
 if prior.shop_id is not null then if prior.fee<>p_expected or not exists(select 1 from public.north_market_shops where id=prior.shop_id and name=trim(p_name) and category=trim(p_category)) then raise exception 'market-request-reused';end if;return jsonb_build_object('ok',true,'id',prior.shop_id,'fee',prior.fee,'duplicate',true);end if;
 select count(*) into count from public.north_market_shops where owner_id=actor;
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
revoke all on function public.north_market_shop_create(text,text,text,text,uuid,integer,text) from public;
grant execute on function public.north_market_shop_create(text,text,text,text,uuid,integer,text) to anon,authenticated;

create or replace function public.north_market_save_shop(p_phone_id text,p_secret text,p_expected integer,p_shop jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; old public.north_market_shops; row public.north_market_shops; p jsonb; g jsonb; o jsonb; names text[]; labels text[]; products jsonb; groups jsonb;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));
 if coalesce(p_shop->>'marketId','')<>'' then select * into old from public.north_market_shops where owner_id=actor and id=(p_shop->>'marketId')::uuid for update;if old.id is null then raise exception 'market-shop-unavailable';end if;else select * into old from public.north_market_shops where owner_id=actor order by created_at,id limit 1 for update;end if;
 if coalesce(old.revision,0)<>p_expected then raise exception 'market-revision-changed'; end if;
 if p_shop is null or jsonb_typeof(p_shop)<>'object' or p_shop->>'name' is null or p_shop->>'category' is null or not coalesce(p_shop->>'minimum' ~ '^[0-9]{1,6}$',false) or not coalesce(p_shop->>'delivery' ~ '^[0-9]{1,6}$',false) or length(trim(p_shop->>'name')) not between 1 and 40 or length(trim(p_shop->>'category')) not between 1 and 40 then raise exception 'market-invalid-shop'; end if;
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
  values(actor,trim(p_shop->>'name'),trim(p_shop->>'category'),coalesce(p_shop->>'intro',''),coalesce(p_shop->>'cover',''),(p_shop->>'minimum')::integer,(p_shop->>'delivery')::integer,jsonb_build_object('groups',groups,'products',products),coalesce((p_shop->>'published')::boolean,false)) returning * into row;
 else
  update public.north_market_shops set name=trim(p_shop->>'name'),category=trim(p_shop->>'category'),intro=coalesce(p_shop->>'intro',''),cover=coalesce(p_shop->>'cover',''),minimum=(p_shop->>'minimum')::integer,delivery=(p_shop->>'delivery')::integer,catalog=jsonb_build_object('groups',groups,'products',products),published=coalesce((p_shop->>'published')::boolean,false),revision=revision+1,updated_at=now() where id=old.id and owner_id=actor returning * into row;
 end if;
 return jsonb_build_object('ok',true,'id',row.id,'revision',row.revision,'published',row.published);
end $$;
create or replace function public.north_market_claim(p_phone_id text,p_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 if not exists(select 1 from public.north_market_ledger where owner_id=actor and kind='grant') then
  insert into public.north_market_wallets(owner_id,balance) values(actor,50000) on conflict(owner_id) do update set balance=north_market_wallets.balance+50000;
  insert into public.north_market_ledger(owner_id,kind,amount,request_id) values(actor,'grant',50000,'00000000-0000-0000-0000-000000000001');
 end if;
 return public.north_market_wallet(p_phone_id,p_secret);
end $$;
create or replace function public.north_market_mine(p_phone_id text,p_secret text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text; row public.north_market_shops;
begin actor:=public.north_market_identity(p_phone_id,p_secret);select * into row from public.north_market_shops where owner_id=actor order by created_at,id limit 1;
 return jsonb_build_object('ok',true,'imageFolder',md5(actor),'shop',case when row.id is null then null else to_jsonb(row)-'owner_id' end);end $$;
create or replace function public.north_market_stock_catalog_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb;head public.north_market_stock;
begin
 if tg_op='UPDATE' then
  if exists(select 1 from public.north_market_stock i where i.shop_id=new.id and i.quantity>0 and not exists(select 1 from jsonb_array_elements(new.catalog->'products')p where p->>'id'=i.product_id)) then raise exception 'market-return-stock-before-removal';end if;
 end if;
 for item in select value from jsonb_array_elements(new.catalog->'products') loop
  if (item->>'price')::integer<3 then raise exception 'market-minimum-sale-price';end if;
  if exists(select 1 from public.north_market_stock_lots l where l.shop_id=new.id and l.product_id=item->>'id' and l.remaining>0 and l.unit_cost>=(item->>'price')::integer) then raise exception 'market-unprofitable-price';end if;
  insert into public.north_market_stock(shop_id,product_id,name,unit,image) values(new.id,item->>'id',item->>'name',item->>'unit',coalesce(item->>'image',''))
  on conflict(shop_id,product_id) do update set name=excluded.name,unit=excluded.unit,image=excluded.image,updated_at=now();
 end loop;
 return new;
end $$;
revoke all on function public.north_market_stock_catalog_trigger() from public;
drop trigger if exists north_market_stock_catalog on public.north_market_shops;
create trigger north_market_stock_catalog after insert or update of catalog on public.north_market_shops for each row execute function public.north_market_stock_catalog_trigger();
insert into public.north_market_stock(shop_id,product_id,name,unit,image)
 select s.id,p->>'id',p->>'name',p->>'unit',coalesce(p->>'image','') from public.north_market_shops s cross join lateral jsonb_array_elements(s.catalog->'products')p
 on conflict(shop_id,product_id) do nothing;

create or replace function public.north_market_shop_mine(p_phone_id text,p_secret text,p_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;shop public.north_market_shops;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 select * into shop from public.north_market_shops where owner_id=actor and (p_id is null or id=p_id) order by created_at,id limit 1;
 if p_id is not null and shop.id is null then raise exception 'market-shop-unavailable';end if;
 return jsonb_build_object('ok',true,'imageFolder',md5(actor),'shop',case when shop.id is null then null else to_jsonb(shop)-'owner_id' end);
end $$;
revoke all on function public.north_market_shop_mine(text,text,uuid) from public;
grant execute on function public.north_market_shop_mine(text,text,uuid) to anon,authenticated;

create or replace function public.north_market_shop(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('ok',true,'shop',jsonb_build_object('id',s.id,'name',s.name,'category',s.category,'intro',s.intro,'cover',s.cover,'minimum',s.minimum,'delivery',s.delivery,'revision',s.revision,'groups',s.catalog->'groups'),
 'products',coalesce((select jsonb_agg(p||jsonb_build_object('stock',coalesce(i.quantity,0),'soldOut',coalesce(i.quantity,0)=0)) from jsonb_array_elements(s.catalog->'products')p left join public.north_market_stock i on i.shop_id=s.id and i.product_id=p->>'id' where (p->>'available')::boolean),'[]'::jsonb))
 from public.north_market_shops s where s.id=p_id and s.published and exists(select 1 from public.phone_licenses l where l.id::text=s.owner_id and l.status='active');
$$;

create or replace function public.north_market_business_notices(p_phone_id text,p_secret text,p_role text,p_ids jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if not exists(select 1 from public.north_market_couples where owner_id=actor and role_id=p_role and role_id<>'') then raise exception 'market-couple-only';end if;
 if p_ids is not null then
  if jsonb_typeof(p_ids)<>'array' or jsonb_array_length(p_ids)>20 then raise exception 'market-invalid-request';end if;
  update public.north_market_stock i set notice_revision=i.restock_revision from public.north_market_shops s where s.id=i.shop_id and s.owner_id=actor and i.quantity=0 and i.notice_id::text in (select jsonb_array_elements_text(p_ids));
 end if;
 return jsonb_build_object('ok',true,'notices',coalesce((select jsonb_agg(to_jsonb(x)) from (select i.notice_id as id,i.shop_id,i.product_id,i.name,s.name as shop_name,i.updated_at from public.north_market_stock i join public.north_market_shops s on s.id=i.shop_id where s.owner_id=actor and i.quantity=0 and i.restock_revision>i.notice_revision order by i.updated_at,i.shop_id,i.product_id limit 20)x),'[]'::jsonb));
end $$;
revoke all on function public.north_market_business_notices(text,text,text,jsonb) from public;
grant execute on function public.north_market_business_notices(text,text,text,jsonb) to anon,authenticated;
create or replace function public.north_market_quote(p_id uuid,p_revision integer,p_lines jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare shop public.north_market_shops; line jsonb; product jsonb; spec jsonb; option jsonb; selection jsonb; choice text; labels jsonb; items jsonb:='[]'; quantity integer; unit_price integer; subtotal bigint:=0;
 stock_product text;stock_needed integer;stock_available integer;stock_maxcost integer;
begin
 select * into shop from public.north_market_shops s where id=p_id and published and exists(select 1 from public.phone_licenses l where l.id::text=s.owner_id and l.status='active');
 if shop.id is null then raise exception 'market-shop-unavailable'; end if;
 if p_revision is null or shop.revision<>p_revision then raise exception 'market-revision-changed'; end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 20 then raise exception 'market-invalid-cart'; end if;
 for line in select value from jsonb_array_elements(p_lines) loop
  if not coalesce(line->>'quantity' ~ '^[0-9]{1,2}$',false) then raise exception 'market-invalid-quantity'; end if;
  quantity:=(line->>'quantity')::integer;if quantity not between 1 and 20 then raise exception 'market-invalid-quantity'; end if;
  select value into product from jsonb_array_elements(shop.catalog->'products') where value->>'id'=line->>'productId' and (value->>'available')::boolean;
  if product is null then raise exception 'market-product-unavailable'; end if;
  if jsonb_typeof(line->'selections') is distinct from 'object' then raise exception 'market-invalid-spec'; end if;
  if exists(select 1 from jsonb_object_keys(line->'selections') k where not exists(select 1 from jsonb_array_elements(product->'specGroups') g where g->>'id'=k)) then raise exception 'market-invalid-spec'; end if;
  unit_price:=(product->>'price')::integer;labels:='[]';
  for spec in select value from jsonb_array_elements(product->'specGroups') loop
   selection:=coalesce(line->'selections'->(spec->>'id'),'[]');
   if jsonb_typeof(selection)<>'array' then raise exception 'market-invalid-spec'; end if;
   if (spec->>'required')::boolean and jsonb_array_length(selection)=0 or spec->>'mode'='single' and jsonb_array_length(selection)>1 or exists(select 1 from jsonb_array_elements_text(selection) v group by v having count(*)>1) then raise exception 'market-invalid-spec'; end if;
   for choice in select jsonb_array_elements_text(selection) loop
    select value into option from jsonb_array_elements(spec->'options') where value->>'id'=choice;
    if option is null then raise exception 'market-invalid-spec'; end if;
    unit_price:=unit_price+(option->>'price')::integer;labels:=labels||jsonb_build_array(spec->>'name'||'：'||(option->>'label'));
   end loop;
  end loop;
  subtotal:=subtotal+unit_price::bigint*quantity;
  if subtotal>100000000 then raise exception 'market-cart-limit'; end if;
  items:=items||jsonb_build_array(jsonb_build_object('productId',product->>'id','name',product->>'name','image',product->>'image','signature',coalesce((product->>'signature')::boolean,false),'quantity',quantity,'unit',product->>'unit','unitPrice',unit_price,'total',unit_price*quantity,'labels',labels,'selections',line->'selections'));
 end loop;
 if subtotal<shop.minimum then raise exception 'market-below-minimum'; end if;

 for stock_product,stock_needed in select x->>'productId',sum((x->>'quantity')::integer)::integer from jsonb_array_elements(p_lines)x group by x->>'productId' loop
  select quantity into stock_available from public.north_market_stock where shop_id=p_id and product_id=stock_product;
  if coalesce(stock_available,0)<stock_needed then raise exception 'market-stock-unavailable';end if;
  select coalesce(max(unit_cost),0) into stock_maxcost from public.north_market_stock_lots where shop_id=p_id and product_id=stock_product and remaining>0;
  if exists(select 1 from jsonb_array_elements(items)x where x->>'productId'=stock_product and (x->>'unitPrice')::integer<=stock_maxcost) then raise exception 'market-unprofitable-price';end if;
 end loop;
 return jsonb_build_object('ok',true,'shopId',shop.id,'shopName',shop.name,'revision',shop.revision,'items',items,'subtotal',subtotal,'delivery',shop.delivery,'total',subtotal+shop.delivery);
end $$;
-- A role can spend only its manually funded, currently bound cloud wallet.
-- This endpoint does not allocate funds or access the owner's personal balance.
create or replace function public.north_market_role_search(p_phone_id text,p_secret text,p_role text,p_query text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;balance bigint;entry record;product jsonb;spec jsonb;option jsonb;selections jsonb;unit_price integer;quantity integer;quote jsonb;offers jsonb:='[]'::jsonb;matches integer:=0;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if length(trim(coalesce(p_query,''))) not between 1 and 60 then raise exception 'market-invalid-query';end if;
 if not exists(select 1 from public.north_market_couples where owner_id=actor and role_id=p_role and role_id<>'') then raise exception 'market-couple-only';end if;
 select coalesce(w.balance,0) into balance from public.north_market_wallets w where w.owner_id=actor||'/'||p_role;
 balance:=coalesce(balance,0);if balance=0 then return jsonb_build_object('ok',true,'status','unfunded','offers','[]'::jsonb,'balance',0);end if;
 for entry in select s.id,s.revision,s.minimum,s.delivery,i.product_id from public.north_market_stock i join public.north_market_shops s on s.id=i.shop_id
 where s.published and s.owner_id<>actor and i.quantity>0 and exists(select 1 from public.phone_licenses l where l.id::text=s.owner_id and l.status='active')
 and (position(lower(trim(p_query)) in lower(i.name||' '||s.name||' '||s.category))>0) order by s.id,i.product_id limit 100 loop
  select value into product from jsonb_array_elements((select catalog->'products' from public.north_market_shops where id=entry.id)) where value->>'id'=entry.product_id and (value->>'available')::boolean;
  if product is null then continue;end if;matches:=matches+1;selections:='{}'::jsonb;unit_price:=(product->>'price')::integer;
  for spec in select value from jsonb_array_elements(product->'specGroups') loop
   if (spec->>'required')::boolean then
    select value into option from jsonb_array_elements(spec->'options') order by (value->>'price')::integer,value->>'id' limit 1;
    if option is null then continue;end if;
    selections:=selections||jsonb_build_object(spec->>'id',jsonb_build_array(option->>'id'));unit_price:=unit_price+(option->>'price')::integer;
   end if;
  end loop;
  quantity:=greatest(1,ceil(entry.minimum::numeric/greatest(1,unit_price))::integer);
  if quantity>20 or quantity*unit_price+entry.delivery>balance then continue;end if;
  begin quote:=public.north_market_quote(entry.id,entry.revision,jsonb_build_array(jsonb_build_object('productId',entry.product_id,'quantity',quantity,'selections',selections)));
  exception when others then continue;end;
  offers:=offers||jsonb_build_array(jsonb_build_object('shopId',entry.id,'revision',entry.revision,'lines',jsonb_build_array(jsonb_build_object('productId',entry.product_id,'quantity',quantity,'selections',selections)),'quote',quote));
  exit when jsonb_array_length(offers)>=8;
 end loop;
 return jsonb_build_object('ok',true,'status',case when jsonb_array_length(offers)>0 then 'available' when matches=0 then 'no_match' else 'budget_or_stock' end,'offers',offers,'balance',balance);
end $$;
revoke all on function public.north_market_role_search(text,text,text,text) from public;
grant execute on function public.north_market_role_search(text,text,text,text) to anon,authenticated;

create or replace function public.north_market_role_order(p_phone_id text,p_secret text,p_role text,p_couple_revision integer,p_client uuid,p_shop uuid,p_revision integer,p_lines jsonb,p_address jsonb,p_utensils boolean,p_total integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;payer text;seller text;quote jsonb;prior public.north_market_orders;row public.north_market_orders;fingerprint text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_client is null or p_role is null or p_role='' or jsonb_typeof(p_address)<>'object' or length(coalesce(p_address->>'address','')) not between 1 and 200 or length(coalesce(p_address->>'name','')) not between 1 and 40 or length(coalesce(p_address->>'phone',''))>30 or p_utensils is null then raise exception 'market-invalid-order';end if;
 p_address:=jsonb_build_object('address',p_address->>'address','name',p_address->>'name','phone',coalesce(p_address->>'phone',''));
 fingerprint:=md5(jsonb_build_array('role-order',p_role,p_shop,p_revision,p_lines,p_address,p_utensils,p_total)::text);
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into prior from public.north_market_orders where buyer_id=actor and client_id=p_client;
 if prior.id is not null then if prior.fingerprint<>fingerprint then raise exception 'market-request-reused';end if;return jsonb_build_object('ok',true,'order',to_jsonb(prior)-'buyer_id'-'seller_id'-'fingerprint');end if;
 if not exists(select 1 from public.north_market_couples where owner_id=actor and role_id=p_role and revision=p_couple_revision) then raise exception 'market-couple-only';end if;
 if exists(select 1 from public.north_market_splits where host_id=actor and client_id=p_client) then raise exception 'market-client-used-for-split';end if;
 select owner_id into seller from public.north_market_shops where id=p_shop and published;
 if seller is null or seller=actor then raise exception 'market-self-order-not-allowed';end if;
 quote:=public.north_market_quote(p_shop,p_revision,p_lines);if p_total is null or p_total<>(quote->>'total')::integer then raise exception 'market-price-changed';end if;
 payer:=actor||'/'||p_role;
 update public.north_market_wallets set balance=balance-p_total,updated_at=now() where owner_id=payer and balance>=p_total;
 if not found then raise exception 'market-insufficient-funds';end if;
 insert into public.north_market_orders(buyer_id,seller_id,shop_id,client_id,fingerprint,items,shop_name,subtotal,delivery,total,address,utensils,payer_role,note)
 values(actor,seller,p_shop,p_client,fingerprint,quote->'items',quote->>'shopName',(quote->>'subtotal')::integer,(quote->>'delivery')::integer,p_total,p_address,p_utensils,p_role,'角色使用手动充值的云银行卡点餐') returning * into row;
 insert into public.north_market_ledger(owner_id,kind,amount,order_id,request_id,target) values(actor,'purchase',-p_total,row.id,p_client,p_role);
 return jsonb_build_object('ok',true,'order',to_jsonb(row)-'buyer_id'-'seller_id'-'fingerprint');
end $$;
revoke all on function public.north_market_role_order(text,text,text,integer,uuid,uuid,integer,jsonb,jsonb,boolean,integer) from public;
grant execute on function public.north_market_role_order(text,text,text,integer,uuid,uuid,integer,jsonb,jsonb,boolean,integer) to anon,authenticated;
commit;
