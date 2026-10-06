-- Independent user-created storefronts. No existing friend, AI or companion table is changed.
-- Virtual currency only. Tables are closed; RPCs check canonical profile secrets and active licenses.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table if not exists public.north_market_shops (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  revision integer not null default 1,
  published boolean not null default false,
  name text not null check(length(name) between 1 and 40),
  category text not null check(length(category) between 1 and 40),
  intro text not null default '' check(length(intro)<=400),
  cover text not null default '',
  minimum integer not null check(minimum between 0 and 999999),
  delivery integer not null check(delivery between 0 and 999999),
  catalog jsonb not null,
  updated_at timestamptz not null default now(),
  unique(owner_id)
);
create index if not exists north_market_directory on public.north_market_shops(id) where published;

create table if not exists public.north_market_wallets (
  owner_id text primary key,
  balance bigint not null default 0 check(balance>=0),
  income bigint not null default 0 check(income>=0),
  pin_hash text,
  pin_failures integer not null default 0,
  pin_blocked_until timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.north_market_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id text not null,
  seller_id text not null,
  shop_id uuid not null references public.north_market_shops(id),
  client_id uuid not null,
  fingerprint text not null,
  status text not null default 'paid' check(status in ('paid','accepted','ready','completed','cancelled')),
  items jsonb not null,
  shop_name text not null,
  subtotal integer not null check(subtotal>0),
  delivery integer not null check(delivery>=0),
  total integer not null check(total>0),
  discount integer not null default 0 check(discount>=0),
  coupon_id uuid,
  address jsonb not null,
  utensils boolean not null,
  payer_role text not null default '',
  note text not null default '' check(length(note)<=200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(buyer_id,client_id),
  check(buyer_id<>seller_id)
);
create index if not exists north_market_buyer_orders on public.north_market_orders(buyer_id,id);
create index if not exists north_market_seller_orders on public.north_market_orders(seller_id,id);
create index if not exists north_market_shop_orders on public.north_market_orders(shop_id,created_at) where status='completed';
create table if not exists public.north_market_reviews (
  order_id uuid primary key references public.north_market_orders(id),
  shop_id uuid not null references public.north_market_shops(id),
  buyer_id text not null,
  rating integer not null check(rating between 1 and 5),
  packaging integer check(packaging between 1 and 5),
  anonymous boolean not null default true,
  text text not null default '' check(length(text)<=200),
  images jsonb not null default '[]'::jsonb,
  visible boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists north_market_shop_reviews on public.north_market_reviews(shop_id,order_id) where visible;
create table if not exists public.north_market_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  kind text not null check(kind in ('grant','admin_credit','purchase','refund','income','withdraw','allocate','coupon')),
  amount bigint not null,
  order_id uuid references public.north_market_orders(id),
  request_id uuid,
  target text,
  created_at timestamptz not null default now(),
  unique(owner_id,kind,request_id)
);
create table if not exists public.north_market_couples (
  owner_id text primary key,
  role_id text not null default '',
  role_name text not null default '',
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
create table if not exists public.north_market_coupons (
 id uuid primary key default gen_random_uuid(),owner_id text not null,face integer not null check(face in (300,500,800)),minimum integer not null check(minimum in (2000,3500,5000)),inflated boolean not null default false,expires_at timestamptz not null default now()+interval '31 days',created_at timestamptz not null default now(),used_order_id uuid references public.north_market_orders(id)
);
create index if not exists north_market_owner_coupons on public.north_market_coupons(owner_id,expires_at);
alter table public.north_market_shops enable row level security;
alter table public.north_market_wallets enable row level security;
alter table public.north_market_orders enable row level security;
alter table public.north_market_reviews enable row level security;
alter table public.north_market_ledger enable row level security;
alter table public.north_market_couples enable row level security;
alter table public.north_market_coupons enable row level security;
revoke all on public.north_market_shops,public.north_market_wallets,public.north_market_orders,public.north_market_reviews,public.north_market_ledger,public.north_market_couples,public.north_market_coupons from anon,authenticated;

create or replace function public.north_market_identity(p_phone_id text,p_secret text)
returns text language plpgsql security definer set search_path='' as $$
declare actor text;
begin
  if not exists(select 1 from public.phone_friend_profiles p where p.phone_id=upper(trim(p_phone_id)) and p.secret_hash=public.phone_friend_hash(p_secret)) then raise exception 'market-auth-required';end if;
  select id::text into actor from public.phone_licenses where phone_friend_id=upper(trim(p_phone_id)) and status='active' order by created_at,id limit 1;
  if actor is null then raise exception 'market-license-required'; end if;
  return actor;
end $$;
create or replace function public.north_market_image_valid(p_url text,p_owner text)
returns boolean language sql immutable set search_path='' as $$
select coalesce(p_url,'')='' or p_url ~ ('^https://lkhlyfpssmrjkkzhuzag[.]supabase[.]co/storage/v1/object/public/north-market/'||md5(p_owner)||'/[a-zA-Z0-9_-]{1,100}[.](jpg|jpeg|png|webp)$');
$$;

-- Ownership for Storage uses authentication headers, not a client-supplied object owner.
create or replace function public.north_market_storage_owner()
returns text language plpgsql stable security definer set search_path='' as $$
declare h jsonb; actor text;
begin
  h:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  actor:=public.north_market_identity(h->>'x-north-phone',h->>'x-north-secret');
  return md5(actor);
exception when others then return null;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('north-market','north-market',true,1048576,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='north_market_upload') then
  create policy north_market_upload on storage.objects for insert to anon,authenticated
  with check(bucket_id='north-market' and (storage.foldername(name))[1]=public.north_market_storage_owner());
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='north_market_upload_boundary') then
  create policy north_market_upload_boundary on storage.objects as restrictive for insert to anon,authenticated
  with check(bucket_id is distinct from 'north-market' or (storage.foldername(name))[1]=public.north_market_storage_owner());
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='north_market_no_client_overwrite') then
  create policy north_market_no_client_overwrite on storage.objects as restrictive for update to anon,authenticated using(bucket_id is distinct from 'north-market') with check(bucket_id is distinct from 'north-market');
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='north_market_no_client_delete') then
  create policy north_market_no_client_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id is distinct from 'north-market');
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='north_market_no_client_listing') then
  create policy north_market_no_client_listing on storage.objects as restrictive for select to anon,authenticated using(bucket_id is distinct from 'north-market' or (storage.foldername(name))[1]=public.north_market_storage_owner());
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='north_market_owner_listing') then
  create policy north_market_owner_listing on storage.objects for select to anon,authenticated using(bucket_id='north-market' and (storage.foldername(name))[1]=public.north_market_storage_owner());
 end if;
end $$;

create or replace function public.north_market_save_shop(p_phone_id text,p_secret text,p_expected integer,p_shop jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; old public.north_market_shops; row public.north_market_shops; p jsonb; g jsonb; o jsonb; names text[]; labels text[]; products jsonb; groups jsonb;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-owner:'||actor,0));
 select * into old from public.north_market_shops where owner_id=actor for update;
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
 insert into public.north_market_shops(owner_id,name,category,intro,cover,minimum,delivery,catalog,published)
 values(actor,trim(p_shop->>'name'),trim(p_shop->>'category'),coalesce(p_shop->>'intro',''),coalesce(p_shop->>'cover',''),(p_shop->>'minimum')::integer,(p_shop->>'delivery')::integer,jsonb_build_object('groups',groups,'products',products),coalesce((p_shop->>'published')::boolean,false))
 on conflict(owner_id) do update set name=excluded.name,category=excluded.category,intro=excluded.intro,cover=excluded.cover,minimum=excluded.minimum,delivery=excluded.delivery,catalog=excluded.catalog,published=excluded.published,revision=north_market_shops.revision+1,updated_at=now() returning * into row;
 return jsonb_build_object('ok',true,'id',row.id,'revision',row.revision,'published',row.published);
end $$;

create or replace function public.north_market_list(p_query text default '',p_after uuid default null,p_limit integer default 8)
returns jsonb language sql stable security definer set search_path='' as $$
with page as (
 select s.id,s.name,s.category,s.cover,s.minimum,s.delivery,s.revision,
 (select count(*) from public.north_market_orders o where o.shop_id=s.id and o.status='completed' and o.created_at>=date_trunc('month',now())) as monthly_sales,
 (select round(avg(r.rating),1) from public.north_market_reviews r where r.shop_id=s.id and r.visible) as rating,
 (select count(*) from public.north_market_reviews r where r.shop_id=s.id and r.visible) as review_count
 from public.north_market_shops s where s.published and exists(select 1 from public.phone_licenses l where l.id::text=s.owner_id and l.status='active') and (p_after is null or s.id>p_after)
 and (coalesce(trim(p_query),'')='' or position(lower(left(trim(p_query),60)) in lower(s.name||' '||s.category))>0 or exists(select 1 from jsonb_array_elements(s.catalog->'products') p where (p->>'available')::boolean and position(lower(left(trim(p_query),60)) in lower(p->>'name'))>0))
 order by s.id limit greatest(1,least(coalesce(p_limit,8),9))
) select jsonb_build_object('ok',true,'shops',coalesce(jsonb_agg(to_jsonb(page) order by id),'[]'::jsonb)) from page;
$$;
create or replace function public.north_market_shop(p_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('ok',true,'shop',jsonb_build_object('id',s.id,'name',s.name,'category',s.category,'intro',s.intro,'cover',s.cover,'minimum',s.minimum,'delivery',s.delivery,'revision',s.revision,'groups',s.catalog->'groups'),'products',coalesce((select jsonb_agg(value) from jsonb_array_elements(s.catalog->'products') where (value->>'available')::boolean),'[]'::jsonb)) from public.north_market_shops s where s.id=p_id and s.published and exists(select 1 from public.phone_licenses l where l.id::text=s.owner_id and l.status='active');
$$;
create or replace function public.north_market_mine(p_phone_id text,p_secret text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text; row public.north_market_shops;
begin actor:=public.north_market_identity(p_phone_id,p_secret);select * into row from public.north_market_shops where owner_id=actor;
 return jsonb_build_object('ok',true,'imageFolder',md5(actor),'shop',case when row.id is null then null else to_jsonb(row)-'owner_id' end);end $$;

-- No RPC can credit its caller. Only a trusted administrator can assign virtual trading credit.
create or replace function public.north_market_admin_credit(p_owner text,p_amount integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_amount not between 1 and 100000000 or not exists(select 1 from public.phone_licenses where id::text=p_owner and status='active') then raise exception 'market-invalid-credit'; end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||p_owner,0));
 if exists(select 1 from public.north_market_ledger where owner_id=p_owner and kind='admin_credit' and request_id=p_request) then return jsonb_build_object('ok',true,'duplicate',true); end if;
 insert into public.north_market_wallets(owner_id,balance) values(p_owner,p_amount) on conflict(owner_id) do update set balance=north_market_wallets.balance+p_amount;
 insert into public.north_market_ledger(owner_id,kind,amount,request_id) values(p_owner,'admin_credit',p_amount,p_request);
 return jsonb_build_object('ok',true);
end $$;

revoke all on function public.north_market_identity(text,text),public.north_market_image_valid(text,text),public.north_market_admin_credit(text,integer,uuid) from public,anon,authenticated;
revoke all on function public.north_market_storage_owner(),public.north_market_save_shop(text,text,integer,jsonb),public.north_market_list(text,uuid,integer),public.north_market_shop(uuid),public.north_market_mine(text,text) from public;
grant execute on function public.north_market_storage_owner(),public.north_market_save_shop(text,text,integer,jsonb),public.north_market_list(text,uuid,integer),public.north_market_shop(uuid),public.north_market_mine(text,text) to anon,authenticated;
grant execute on function public.north_market_admin_credit(text,integer,uuid) to service_role;

-- First gift is once per licensed account, not per device, persona or role. No automatic monthly minting.
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
create or replace function public.north_market_claim(p_phone_id text,p_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 if not exists(select 1 from public.north_market_ledger where owner_id=actor and kind='grant') then
  insert into public.north_market_wallets(owner_id,balance) values(actor,100000) on conflict(owner_id) do update set balance=north_market_wallets.balance+100000;
  insert into public.north_market_ledger(owner_id,kind,amount,request_id) values(actor,'grant',100000,'00000000-0000-0000-0000-000000000001');
 end if;
 return public.north_market_wallet(p_phone_id,p_secret);
end $$;
create or replace function public.north_market_couple(p_phone_id text,p_secret text,p_role text,p_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; old public.north_market_couples; balance bigint;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_role is null or (p_role<>'' and p_role !~ '^[a-zA-Z0-9_-]{1,80}$') or length(coalesce(p_name,''))>40 then raise exception 'market-invalid-couple'; end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into old from public.north_market_couples where owner_id=actor for update;
 -- Leaving/changing a couple returns unused funds to their owning user, without minting any money.
 if old.role_id<>'' and old.role_id<>p_role then
  select w.balance into balance from public.north_market_wallets w where owner_id=actor||'/'||old.role_id for update;
  if coalesce(balance,0)>0 then
   update public.north_market_wallets set balance=0 where owner_id=actor||'/'||old.role_id;
   insert into public.north_market_wallets(owner_id,balance) values(actor,balance) on conflict(owner_id) do update set balance=north_market_wallets.balance+excluded.balance;
   insert into public.north_market_ledger(owner_id,kind,amount,target) values(actor,'allocate',balance,'couple-return');
  end if;
 end if;
 insert into public.north_market_couples(owner_id,role_id,role_name) values(actor,p_role,coalesce(p_name,'')) on conflict(owner_id) do update set role_id=excluded.role_id,role_name=excluded.role_name,revision=case when north_market_couples.role_id=excluded.role_id then north_market_couples.revision else north_market_couples.revision+1 end,updated_at=now();
 return public.north_market_wallet(p_phone_id,p_secret);
end $$;
create or replace function public.north_market_transfer(p_phone_id text,p_secret text,p_source text,p_target text,p_role text,p_amount integer,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; source_key text; target_key text; available bigint; existing public.north_market_ledger;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_amount is null or p_amount not between 1 and 100000000 or p_request is null or p_source is null or p_target is null or p_source not in ('wallet','income','couple') or p_target not in ('wallet','couple') then raise exception 'market-invalid-transfer'; end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into existing from public.north_market_ledger where owner_id=actor and kind in ('allocate','withdraw') and request_id=p_request;
 if existing.id is not null then
  if existing.amount<>p_amount or existing.target<>p_source||'>'||p_target||':'||coalesce(p_role,'') then raise exception 'market-request-reused'; end if;
  return jsonb_build_object('ok',true,'receipt',existing.id,'amount',existing.amount,'target',p_target,'wallet',public.north_market_wallet(p_phone_id,p_secret));
 end if;
 if p_source='couple' or p_target='couple' then
  if p_role is null or p_role='' or not exists(select 1 from public.north_market_couples where owner_id=actor and role_id=p_role) then raise exception 'market-couple-only'; end if;
 end if;
 if p_source=p_target then raise exception 'market-transfer-not-supported'; end if;
 source_key:=case when p_source='couple' then actor||'/'||p_role else actor end;
 target_key:=case when p_target='couple' then actor||'/'||p_role else actor end;
 select case when p_source='income' then income else balance end into available from public.north_market_wallets where owner_id=source_key for update;
 if coalesce(available,0)<p_amount then raise exception 'market-insufficient-funds'; end if;
 if p_source='income' then update public.north_market_wallets set income=income-p_amount where owner_id=source_key;
 else update public.north_market_wallets set balance=balance-p_amount where owner_id=source_key;end if;
 if p_target in ('wallet','couple') then
  insert into public.north_market_wallets(owner_id,balance) values(target_key,p_amount) on conflict(owner_id) do update set balance=north_market_wallets.balance+p_amount;
 end if;
 insert into public.north_market_ledger(owner_id,kind,amount,request_id,target)
 values(actor,case when p_source='income' then 'withdraw' else 'allocate' end,p_amount,p_request,p_source||'>'||p_target||':'||coalesce(p_role,'')) returning * into existing;
 return jsonb_build_object('ok',true,'receipt',existing.id,'amount',p_amount,'target',p_target,'wallet',public.north_market_wallet(p_phone_id,p_secret));
end $$;
revoke all on function public.north_market_wallet(text,text),public.north_market_claim(text,text),public.north_market_couple(text,text,text,text),public.north_market_transfer(text,text,text,text,text,integer,uuid) from public;
grant execute on function public.north_market_wallet(text,text),public.north_market_claim(text,text),public.north_market_couple(text,text,text,text),public.north_market_transfer(text,text,text,text,text,integer,uuid) to anon,authenticated;

create or replace function public.north_market_quote(p_id uuid,p_revision integer,p_lines jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare shop public.north_market_shops; line jsonb; product jsonb; spec jsonb; option jsonb; selection jsonb; choice text; labels jsonb; items jsonb:='[]'; quantity integer; unit_price integer; subtotal bigint:=0;
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
 return jsonb_build_object('ok',true,'shopId',shop.id,'shopName',shop.name,'revision',shop.revision,'items',items,'subtotal',subtotal,'delivery',shop.delivery,'total',subtotal+shop.delivery);
end $$;

create or replace function public.north_market_order_create(p_phone_id text,p_secret text,p_client uuid,p_shop uuid,p_revision integer,p_lines jsonb,p_address jsonb,p_utensils boolean,p_note text,p_role text,p_couple_revision integer,p_pin text,p_total integer,p_coupon uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; seller text; payer text; quote jsonb; prior public.north_market_orders; order_row public.north_market_orders; wallet public.north_market_wallets; fingerprint text;coupon public.north_market_coupons;discount integer:=0;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_client is null or p_address is null or jsonb_typeof(p_address)<>'object' or length(coalesce(p_address->>'address','')) not between 1 and 200 or length(coalesce(p_address->>'name','')) not between 1 and 40 or length(coalesce(p_address->>'phone',''))>30 or p_utensils is null or length(coalesce(p_note,''))>200 or p_role is null then raise exception 'market-invalid-order'; end if;
 p_address:=jsonb_build_object('address',p_address->>'address','name',p_address->>'name','phone',coalesce(p_address->>'phone',''),'recipientRole',coalesce(p_address->>'recipientRole',''));
 fingerprint:=md5(jsonb_build_object('shop',p_shop,'revision',p_revision,'lines',p_lines,'address',p_address,'utensils',p_utensils,'note',p_note,'role',p_role,'total',p_total,'coupon',p_coupon)::text);
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into prior from public.north_market_orders where buyer_id=actor and client_id=p_client;
 if prior.id is not null then
  if prior.fingerprint<>fingerprint then raise exception 'market-request-reused'; end if;
  return jsonb_build_object('ok',true,'order',to_jsonb(prior)-'buyer_id'-'seller_id'-'fingerprint');
 end if;
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
 insert into public.north_market_orders(buyer_id,seller_id,shop_id,client_id,fingerprint,items,shop_name,subtotal,delivery,total,address,utensils,note,payer_role,discount,coupon_id)
 values(actor,seller,p_shop,p_client,fingerprint,quote->'items',quote->>'shopName',(quote->>'subtotal')::integer,(quote->>'delivery')::integer,p_total,p_address,p_utensils,coalesce(p_note,''),p_role,discount,p_coupon) returning * into order_row;
 if p_coupon is not null then update public.north_market_coupons set used_order_id=order_row.id where id=p_coupon;end if;
 insert into public.north_market_ledger(owner_id,kind,amount,order_id,request_id,target) values(actor,'purchase',-p_total,order_row.id,p_client,p_role);
 return jsonb_build_object('ok',true,'order',to_jsonb(order_row)-'buyer_id'-'seller_id'-'fingerprint');
end $$;
create or replace function public.north_market_orders(p_phone_id text,p_secret text,p_seller boolean default false,p_after uuid default null,p_client uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 return jsonb_build_object('ok',true,'orders',coalesce((select jsonb_agg(to_jsonb(x)-'buyer_id'-'seller_id'-'fingerprint' order by x.id desc) from (select o.* from public.north_market_orders o where (case when p_seller then o.seller_id=actor else o.buyer_id=actor end) and (p_after is null or o.id<p_after) and (p_client is null or o.client_id=p_client) order by o.id desc limit 21)x),'[]'::jsonb));end $$;
create or replace function public.north_market_order_status(p_phone_id text,p_secret text,p_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; order_row public.north_market_orders; payer text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 select * into order_row from public.north_market_orders where id=p_id and (buyer_id=actor or seller_id=actor);
 if order_row.id is null then raise exception 'market-order-unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||order_row.buyer_id,0));
 select * into order_row from public.north_market_orders where id=p_id for update;
 if order_row.status=p_status then return jsonb_build_object('ok',true); end if;
 if p_status='accepted' and actor=order_row.seller_id and order_row.status='paid' or p_status='ready' and actor=order_row.seller_id and order_row.status='accepted' then
  update public.north_market_orders set status=p_status,updated_at=now() where id=p_id;
 elsif p_status='completed' and actor=order_row.buyer_id and order_row.status='ready' then
  update public.north_market_orders set status='completed',updated_at=now() where id=p_id;
  insert into public.north_market_wallets(owner_id,income) values(order_row.seller_id,order_row.subtotal) on conflict(owner_id) do update set income=north_market_wallets.income+excluded.income;
  insert into public.north_market_ledger(owner_id,kind,amount,order_id,request_id) values(order_row.seller_id,'income',order_row.subtotal,p_id,p_id);
 elsif p_status='cancelled' and order_row.status in ('paid','accepted','ready') and (actor=order_row.seller_id or order_row.status='paid') then
  update public.north_market_orders set status='cancelled',updated_at=now() where id=p_id;
  payer:=case when order_row.payer_role='' or not exists(select 1 from public.north_market_couples where owner_id=order_row.buyer_id and role_id=order_row.payer_role) then order_row.buyer_id else order_row.buyer_id||'/'||order_row.payer_role end;
  insert into public.north_market_wallets(owner_id,balance) values(payer,order_row.total) on conflict(owner_id) do update set balance=north_market_wallets.balance+excluded.balance;
  insert into public.north_market_ledger(owner_id,kind,amount,order_id,request_id,target) values(order_row.buyer_id,'refund',order_row.total,p_id,p_id,payer);
  if order_row.coupon_id is not null then update public.north_market_coupons set used_order_id=null where id=order_row.coupon_id and used_order_id=p_id and expires_at>now();end if;
 else raise exception 'market-invalid-order-transition';end if;
 return jsonb_build_object('ok',true);
end $$;

revoke all on function public.north_market_quote(uuid,integer,jsonb),public.north_market_order_create(text,text,uuid,uuid,integer,jsonb,jsonb,boolean,text,text,integer,text,integer,uuid),public.north_market_orders(text,text,boolean,uuid,uuid),public.north_market_order_status(text,text,uuid,text) from public;
grant execute on function public.north_market_quote(uuid,integer,jsonb),public.north_market_order_create(text,text,uuid,uuid,integer,jsonb,jsonb,boolean,text,text,integer,text,integer,uuid),public.north_market_orders(text,text,boolean,uuid,uuid),public.north_market_order_status(text,text,uuid,text) to anon,authenticated;

create or replace function public.north_market_order(p_phone_id text,p_secret text,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text; row public.north_market_orders; review public.north_market_reviews;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 select * into row from public.north_market_orders where id=p_id and (buyer_id=actor or seller_id=actor);
 if row.id is null then raise exception 'market-order-unavailable';end if;
 select * into review from public.north_market_reviews where order_id=p_id;
 return jsonb_build_object('ok',true,'order',to_jsonb(row)-'buyer_id'-'seller_id'-'fingerprint','isBuyer',row.buyer_id=actor,'review',case when review.order_id is null then null else to_jsonb(review)-'buyer_id' end);end $$;
create or replace function public.north_market_pin(p_phone_id text,p_secret text,p_old text,p_new text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; row public.north_market_wallets;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 insert into public.north_market_wallets(owner_id) values(actor) on conflict(owner_id) do nothing;
 select * into row from public.north_market_wallets where owner_id=actor for update;
 if row.pin_blocked_until>now() then return jsonb_build_object('ok',false,'error','请稍后再修改支付密码');end if;
 if p_old is null or row.pin_hash is null and p_old<>'00000' or row.pin_hash is not null and extensions.crypt(p_old,row.pin_hash)<>row.pin_hash then
  update public.north_market_wallets set pin_failures=pin_failures+1,pin_blocked_until=case when pin_failures>=4 then now()+interval '5 minutes' else null end where owner_id=actor;
  return jsonb_build_object('ok',false,'error','原支付密码不正确');end if;
 if not coalesce(p_new ~ '^[0-9]{5}$',false) then raise exception 'market-invalid-pin';end if;
 update public.north_market_wallets set pin_hash=extensions.crypt(p_new,extensions.gen_salt('bf')),pin_failures=0,pin_blocked_until=null where owner_id=actor;
 return jsonb_build_object('ok',true);end $$;

create or replace function public.north_market_review_save(p_phone_id text,p_secret text,p_id uuid,p_expected integer,p_review jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; row public.north_market_orders; old public.north_market_reviews; image text;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 select * into row from public.north_market_orders where id=p_id and buyer_id=actor for update;
 if row.id is null or row.status<>'completed' then raise exception 'market-completed-order-required';end if;
 select * into old from public.north_market_reviews where order_id=p_id;
 if p_expected is null or coalesce(old.revision,0)<>p_expected then raise exception 'market-review-changed';end if;
 if p_review is null or not coalesce(p_review->>'rating' ~ '^[1-5]$',false) or p_review->'packaging' is not null and p_review->'packaging'<>'null'::jsonb and not coalesce(p_review->>'packaging' ~ '^[1-5]$',false) or jsonb_typeof(p_review->'anonymous') is distinct from 'boolean' or length(coalesce(p_review->>'text',''))>200 or jsonb_typeof(p_review->'images') is distinct from 'array' or jsonb_array_length(p_review->'images')>6 then raise exception 'market-invalid-review';end if;
 for image in select jsonb_array_elements_text(p_review->'images') loop
  if image='' or not public.north_market_image_valid(image,actor) then raise exception 'market-invalid-image';end if;
 end loop;
 insert into public.north_market_reviews(order_id,shop_id,buyer_id,rating,packaging,anonymous,text,images)
 values(p_id,row.shop_id,actor,(p_review->>'rating')::integer,(p_review->>'packaging')::integer,(p_review->>'anonymous')::boolean,coalesce(p_review->>'text',''),p_review->'images')
 on conflict(order_id) do update set rating=excluded.rating,packaging=excluded.packaging,anonymous=excluded.anonymous,text=excluded.text,images=excluded.images,visible=true,revision=north_market_reviews.revision+1,updated_at=now();
 return jsonb_build_object('ok',true);end $$;
create or replace function public.north_market_review_delete(p_phone_id text,p_secret text,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 update public.north_market_reviews set visible=false,revision=revision+1,updated_at=now() where order_id=p_id and buyer_id=actor and visible;
 return jsonb_build_object('ok',true);end $$;
create or replace function public.north_market_reviews(p_shop uuid,p_after uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
with page as (
 select r.order_id,r.rating,r.packaging,r.anonymous,r.text,r.images,r.created_at,r.updated_at,
 case when r.anonymous then '匿名用户' else coalesce((select p.display_name from public.phone_licenses l join public.phone_friend_profiles p on p.phone_id=l.phone_friend_id where l.id::text=r.buyer_id),'顾客') end as name,
 (select jsonb_agg(x->>'name') from jsonb_array_elements(o.items)x) as products
 from public.north_market_reviews r join public.north_market_orders o on o.id=r.order_id
 where r.shop_id=p_shop and r.visible and o.status='completed' and (p_after is null or r.order_id<p_after) and exists(select 1 from public.north_market_shops s where s.id=p_shop and s.published)
 order by r.order_id desc limit 9
)select jsonb_build_object('ok',true,'reviews',coalesce(jsonb_agg(to_jsonb(page) order by order_id desc),'[]'::jsonb),'rating',(select round(avg(r.rating),1) from public.north_market_reviews r where r.shop_id=p_shop and r.visible),'count',(select count(*) from public.north_market_reviews r where r.shop_id=p_shop and r.visible)) from page;
$$;
revoke all on function public.north_market_order(text,text,uuid),public.north_market_pin(text,text,text,text),public.north_market_review_save(text,text,uuid,integer,jsonb),public.north_market_review_delete(text,text,uuid),public.north_market_reviews(uuid,uuid) from public;
grant execute on function public.north_market_order(text,text,uuid),public.north_market_pin(text,text,text,text),public.north_market_review_save(text,text,uuid,integer,jsonb),public.north_market_review_delete(text,text,uuid),public.north_market_reviews(uuid,uuid) to anon,authenticated;

create or replace function public.north_market_coupons(p_phone_id text,p_secret text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 return jsonb_build_object('ok',true,'coupons',coalesce((select jsonb_agg(to_jsonb(c)-'owner_id' order by expires_at,id) from public.north_market_coupons c where owner_id=actor and used_order_id is null and expires_at>now()),'[]'::jsonb));end $$;
create or replace function public.north_market_coupon_buy(p_phone_id text,p_secret text,p_kind text,p_client uuid,p_pin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;price integer;wallet public.north_market_wallets;previous public.north_market_ledger;pair jsonb;
begin
 actor:=public.north_market_identity(p_phone_id,p_secret);
 if p_client is null or p_kind is null or p_kind not in ('light','daily') then raise exception 'market-invalid-pack';end if;
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 select * into previous from public.north_market_ledger where owner_id=actor and kind='coupon' and request_id=p_client;
 if previous.id is not null then if previous.target<>p_kind then raise exception 'market-request-reused';end if;return public.north_market_coupons(p_phone_id,p_secret);end if;
 if exists(select 1 from public.north_market_ledger where owner_id=actor and kind='coupon' and created_at>now()-interval '24 hours') then raise exception 'market-pack-daily-limit';end if;
 if (select count(*) from public.north_market_coupons where owner_id=actor and used_order_id is null and expires_at>now())+(case when p_kind='light' then 3 else 5 end)>20 then raise exception 'market-coupon-holding-limit';end if;
 select * into wallet from public.north_market_wallets where owner_id=actor for update;
 price:=case when p_kind='light' then 590 else 690 end;
 if wallet.owner_id is null or wallet.balance<price then raise exception 'market-insufficient-funds';end if;
 if wallet.pin_blocked_until>now() then return jsonb_build_object('ok',false,'error','请稍后再输入支付密码');end if;
 if p_pin is null or p_pin !~ '^[0-9]{5}$' or wallet.pin_hash is null and p_pin<>'00000' or wallet.pin_hash is not null and extensions.crypt(p_pin,wallet.pin_hash)<>wallet.pin_hash then
  update public.north_market_wallets set pin_failures=pin_failures+1,pin_blocked_until=case when pin_failures>=4 then now()+interval '5 minutes' else null end where owner_id=actor;
  return jsonb_build_object('ok',false,'error','支付密码不正确');end if;
 update public.north_market_wallets set balance=balance-price,pin_failures=0,pin_blocked_until=null where owner_id=actor;
 for pair in select value from jsonb_array_elements(case when p_kind='light' then '[[300,2000],[300,2000],[500,3500]]'::jsonb else '[[300,2000],[300,2000],[300,2000],[500,3500],[500,3500]]'::jsonb end) loop
  insert into public.north_market_coupons(owner_id,face,minimum) values(actor,(pair->>0)::integer,(pair->>1)::integer);
 end loop;
 insert into public.north_market_ledger(owner_id,kind,amount,request_id,target) values(actor,'coupon',-price,p_client,p_kind);
 return public.north_market_coupons(p_phone_id,p_secret);
end $$;
create or replace function public.north_market_coupon_boost(p_phone_id text,p_secret text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;coupon public.north_market_coupons;
begin actor:=public.north_market_identity(p_phone_id,p_secret);
 perform pg_advisory_xact_lock(hashtextextended('north-market-wallet:'||actor,0));
 if exists(select 1 from public.north_market_ledger where owner_id=actor and kind='allocate' and target='coupon-boost' and created_at>now()-interval '24 hours') then raise exception 'market-boost-daily-limit';end if;
 select * into coupon from public.north_market_coupons where owner_id=actor and not inflated and used_order_id is null and expires_at>now() and face in (300,500) order by expires_at,id limit 1 for update;
 if coupon.id is null then raise exception 'market-no-boost-coupon';end if;
 update public.north_market_coupons set face=case when coupon.face=300 then 500 else 800 end,minimum=case when coupon.face=300 then 3500 else 5000 end,inflated=true where id=coupon.id;
 insert into public.north_market_ledger(owner_id,kind,amount,target) values(actor,'allocate',0,'coupon-boost');
 return public.north_market_coupons(p_phone_id,p_secret);end $$;
revoke all on function public.north_market_coupons(text,text),public.north_market_coupon_buy(text,text,text,uuid,text),public.north_market_coupon_boost(text,text) from public;
grant execute on function public.north_market_coupons(text,text),public.north_market_coupon_buy(text,text,text,uuid,text),public.north_market_coupon_boost(text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
