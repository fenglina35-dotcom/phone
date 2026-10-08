import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Run after the migration text inside the same BEGIN, followed by ROLLBACK.
// Random fixture identities are created only in that transaction; no real customer data is modified.
export const transactionSQL=String.raw`
do $test$
declare
 seller_phone text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));
 buyer_phone text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));
 seller uuid:=gen_random_uuid();buyer uuid:=gen_random_uuid();request uuid:=gen_random_uuid();
 shop jsonb;product jsonb;catalog jsonb;result jsonb;quote jsonb;order_id uuid;image_id uuid;couple_revision integer;failed boolean;before_balance bigint;
begin
 insert into public.phone_friend_profiles(phone_id,secret_hash,display_name,allow_search) values(seller_phone,public.phone_friend_hash('north-market-test-secret'),'事务验收店主',false),(buyer_phone,public.phone_friend_hash('north-market-test-secret'),'事务验收顾客',false);
 insert into public.phone_licenses(id,status,phone_friend_id) values(seller,'active',seller_phone),(buyer,'active',buyer_phone);
 perform set_config('request.headers',jsonb_build_object('x-north-phone',buyer_phone,'x-north-secret','north-market-test-secret')::text,true);
 if public.north_market_storage_owner()<>md5(buyer::text) then raise exception 'FAIL image owner identity';end if;
 execute 'set local role anon';
 failed:=false;begin insert into storage.objects(bucket_id,name) values('north-market',md5(seller::text)||'/invalid-test.jpg');exception when others then failed:=true;end;
 if not failed then execute 'reset role';raise exception 'FAIL image upload into another owner folder';end if;
 insert into storage.objects(bucket_id,name) values('north-market',md5(buyer::text)||'/owned-test.jpg') returning id into image_id;
 execute 'reset role';
 perform set_config('request.headers','{}',true);
 product:=jsonb_build_object('id','tea','name','招牌奶茶','groupId','drinks','price',1800,'unit','杯','description','测试商品','image','','signature',true,'available',true,'specGroups',jsonb_build_array(jsonb_build_object('id','temperature','name','温度','mode','single','required',true,'options',jsonb_build_array(jsonb_build_object('id','cold','label','冰','price',0),jsonb_build_object('id','warm','label','温','price',200)))));
 catalog:=jsonb_build_object('name','事务验收奶茶店','category','奶茶','intro','','cover','','minimum',2000,'delivery',190,'published',true,'groups',jsonb_build_array(jsonb_build_object('id','drinks','name','饮品')),'products',jsonb_build_array(product));
 result:=public.north_market_save_shop(seller_phone,'north-market-test-secret',0,catalog);
 shop:=public.north_market_shop((result->>'id')::uuid);
 if shop->'products'->0->>'name'<>'招牌奶茶' then raise exception 'FAIL catalog read';end if;
 if exists(select 1 from jsonb_object_keys(shop->'shop') k where k='owner_id') then raise exception 'FAIL private owner leaked';end if;
 failed:=false;begin perform public.north_market_save_shop(buyer_phone,'wrong-secret',0,catalog);exception when others then failed:=true;end;if not failed then raise exception 'FAIL unauthenticated publication';end if;
 failed:=false;begin perform public.north_market_save_shop(seller_phone,'north-market-test-secret',0,catalog);exception when others then failed:=true;end;if not failed then raise exception 'FAIL stale revision';end if;
 result:=public.north_market_claim(buyer_phone,'north-market-test-secret');
 perform public.north_market_claim(buyer_phone,'north-market-test-secret');
 if (public.north_market_wallet(buyer_phone,'north-market-test-secret')->>'balance')::bigint<>100000 then raise exception 'FAIL duplicated first 1000 grant';end if;
 result:=public.north_market_couple(buyer_phone,'north-market-test-secret','partner','情侣');
 couple_revision:=(result->'couple'->>'revision')::integer;
 perform public.north_market_transfer(buyer_phone,'north-market-test-secret','wallet','couple','partner',20000,request);
 perform public.north_market_transfer(buyer_phone,'north-market-test-secret','wallet','couple','partner',20000,request);
 result:=public.north_market_wallet(buyer_phone,'north-market-test-secret');
 if (result->>'balance')::bigint<>80000 or (result->'couple'->>'balance')::bigint<>20000 then raise exception 'FAIL transfer replay';end if;
 failed:=false;begin perform public.north_market_transfer(buyer_phone,'north-market-test-secret','wallet','couple','ordinary',1000,gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'FAIL ordinary role receives money';end if;
 failed:=false;begin perform public.north_market_quote((shop->'shop'->>'id')::uuid,1,jsonb_build_array(jsonb_build_object('productId','tea','quantity',1,'selections',jsonb_build_object('temperature',jsonb_build_array('cold')))));exception when others then failed:=true;end;if not failed then raise exception 'FAIL below minimum';end if;
 quote:=public.north_market_quote((shop->'shop'->>'id')::uuid,1,jsonb_build_array(jsonb_build_object('productId','tea','quantity',1,'selections',jsonb_build_object('temperature',jsonb_build_array('warm')))));
 if (quote->>'total')::integer<>2190 then raise exception 'FAIL server quote';end if;
 request:=gen_random_uuid();
 result:=public.north_market_order_create(buyer_phone,'north-market-test-secret',request,(shop->'shop'->>'id')::uuid,1,jsonb_build_array(jsonb_build_object('productId','tea','quantity',1,'selections',jsonb_build_object('temperature',jsonb_build_array('warm')))),jsonb_build_object('name','事务顾客','address','测试模拟位置','phone',''),false,'','partner',couple_revision,'11111',2190);
 if result->>'ok'<>'false' then raise exception 'FAIL incorrect PIN accepted';end if;
 result:=public.north_market_order_create(buyer_phone,'north-market-test-secret',request,(shop->'shop'->>'id')::uuid,1,jsonb_build_array(jsonb_build_object('productId','tea','quantity',1,'selections',jsonb_build_object('temperature',jsonb_build_array('warm')))),jsonb_build_object('name','事务顾客','address','测试模拟位置','phone',''),false,'','partner',couple_revision,'00000',2190);
 order_id:=(result->'order'->>'id')::uuid;
 perform public.north_market_order_create(buyer_phone,'north-market-test-secret',request,(shop->'shop'->>'id')::uuid,1,jsonb_build_array(jsonb_build_object('productId','tea','quantity',1,'selections',jsonb_build_object('temperature',jsonb_build_array('warm')))),jsonb_build_object('name','事务顾客','address','测试模拟位置','phone',''),false,'','partner',couple_revision,'00000',2190);
 if (public.north_market_wallet(buyer_phone,'north-market-test-secret')->'couple'->>'balance')::bigint<>17810 then raise exception 'FAIL duplicated debit';end if;
 failed:=false;begin perform public.north_market_review_save(buyer_phone,'north-market-test-secret',order_id,0,jsonb_build_object('rating',4,'packaging',5,'anonymous',true,'text','','images',jsonb_build_array()));exception when others then failed:=true;end;if not failed then raise exception 'FAIL unfinished review';end if;
 perform public.north_market_order_status(seller_phone,'north-market-test-secret',order_id,'accepted');
 perform public.north_market_order_status(seller_phone,'north-market-test-secret',order_id,'ready');
 failed:=false;begin perform public.north_market_order_status(seller_phone,'north-market-test-secret',order_id,'completed');exception when others then failed:=true;end;if not failed then raise exception 'FAIL seller self-completes';end if;
 perform public.north_market_order_status(buyer_phone,'north-market-test-secret',order_id,'completed');
 perform public.north_market_order_status(buyer_phone,'north-market-test-secret',order_id,'completed');
 if (public.north_market_wallet(seller_phone,'north-market-test-secret')->>'income')::bigint<>2000 then raise exception 'FAIL duplicated seller income';end if;
 perform public.north_market_review_save(buyer_phone,'north-market-test-secret',order_id,0,jsonb_build_object('rating',4,'packaging',5,'anonymous',true,'text','','images',jsonb_build_array()));
 perform public.north_market_review_save(buyer_phone,'north-market-test-secret',order_id,1,jsonb_build_object('rating',5,'packaging',5,'anonymous',true,'text','修改同一条评价','images',jsonb_build_array()));
 result:=public.north_market_reviews((shop->'shop'->>'id')::uuid);
 if (result->>'count')::integer<>1 or (result->>'rating')::numeric<>5 then raise exception 'FAIL review score counted twice';end if;
 if result->'reviews'->0->>'name'<>'匿名用户' then raise exception 'FAIL anonymous name';end if;
 failed:=false;begin perform public.north_market_review_save(seller_phone,'north-market-test-secret',order_id,2,jsonb_build_object('rating',1,'anonymous',true,'images',jsonb_build_array()));exception when others then failed:=true;end;if not failed then raise exception 'FAIL review ownership';end if;
 perform public.north_market_transfer(seller_phone,'north-market-test-secret','income','wallet','',2000,gen_random_uuid());
 if (public.north_market_wallet(seller_phone,'north-market-test-secret')->>'income')::bigint<>0 or (public.north_market_wallet(seller_phone,'north-market-test-secret')->>'balance')::bigint<>2000 then raise exception 'FAIL income withdrawal';end if;
 failed:=false;begin perform public.north_market_transfer(seller_phone,'north-market-test-secret','wallet','local-wallet','',100,gen_random_uuid());exception when others then failed:=true;end;if not failed then raise exception 'FAIL money leaves Meituan';end if;
 perform public.north_market_couple(buyer_phone,'north-market-test-secret','','');
 if (public.north_market_wallet(buyer_phone,'north-market-test-secret')->>'balance')::bigint<>97810 then raise exception 'FAIL couple unlink funds recovery';end if;
 failed:=false;begin perform public.north_market_order_create(buyer_phone,'north-market-test-secret',gen_random_uuid(),(shop->'shop'->>'id')::uuid,1,jsonb_build_array(jsonb_build_object('productId','tea','quantity',1,'selections',jsonb_build_object('temperature',jsonb_build_array('warm')))),jsonb_build_object('name','事务顾客','address','测试位置'),false,'','partner',couple_revision,'00000',2190);exception when others then failed:=true;end;if not failed then raise exception 'FAIL former couple still pays';end if;
 request:=gen_random_uuid();
 result:=public.north_market_coupon_buy(buyer_phone,'north-market-test-secret','light',request,'00000');
 perform public.north_market_coupon_buy(buyer_phone,'north-market-test-secret','light',request,'00000');
 if jsonb_array_length(result->'coupons')<>3 or (public.north_market_wallet(buyer_phone,'north-market-test-secret')->>'balance')::bigint<>97220 then raise exception 'FAIL voucher purchase replay';end if;
 failed:=false;begin perform public.north_market_coupon_buy(buyer_phone,'north-market-test-secret','daily',gen_random_uuid(),'00000');exception when others then failed:=true;end;if not failed then raise exception 'FAIL voucher daily cap';end if;
 result:=public.north_market_coupon_boost(buyer_phone,'north-market-test-secret');
 failed:=false;begin perform public.north_market_coupon_boost(buyer_phone,'north-market-test-secret');exception when others then failed:=true;end;if not failed then raise exception 'FAIL boost daily cap';end if;
 select jsonb_build_object('id',id) into result from public.north_market_coupons where owner_id=buyer::text and face=300 limit 1;
 quote:=public.north_market_order_create(buyer_phone,'north-market-test-secret',gen_random_uuid(),(shop->'shop'->>'id')::uuid,1,jsonb_build_array(jsonb_build_object('productId','tea','quantity',1,'selections',jsonb_build_object('temperature',jsonb_build_array('warm')))),jsonb_build_object('name','事务顾客','address','测试位置'),false,'','',null,'00000',1890,(result->>'id')::uuid);
 order_id:=(quote->'order'->>'id')::uuid;
 if (quote->'order'->>'discount')::integer<>300 then raise exception 'FAIL server voucher discount';end if;
 perform public.north_market_order_status(buyer_phone,'north-market-test-secret',order_id,'cancelled');
 perform public.north_market_order_status(buyer_phone,'north-market-test-secret',order_id,'cancelled');
 if (public.north_market_wallet(buyer_phone,'north-market-test-secret')->>'balance')::bigint<>97220 or not exists(select 1 from public.north_market_coupons where id=(result->>'id')::uuid and used_order_id is null) then raise exception 'FAIL exact refund/voucher restoration';end if;
 raise notice 'PASS market identity, once-only 1000, couple-only transfer/payment, price/spec/minimum, PIN, idempotent debit, buyer completion, income, one-order-one-review, anonymity, withdrawal and unlink';
end $test$;
select 'market transaction assertions passed; fixture changes rolled back' as verification;
`;

// These client tests do not substitute for executing the migration/transaction tests in PostgreSQL.
for (const [kind,path] of [['web','commerce-ui.js'],['private','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js']]) {
  function setup(fetcher){
    const source=fs.readFileSync(path,'utf8');
    const start=source.indexOf('  async function northMarketRpc('),end=source.indexOf('  function northMarketImage(',start);
    const state={},identity={id:'SPTEST0001',secret:'fixture-secret'};
    let account='main';
    const context={S:state,northData:()=>({}),actId:()=>account,phoneFriendState:()=>identity,GATE_URL:'https://fixture.invalid',pfHeaders:()=>({'Content-Type':'application/json'}),fetchT:fetcher,Error};
    vm.runInNewContext(source.split('\n').filter(l=>l.startsWith('  var northDeletedSyncBusy=')||l.startsWith('  async function northSyncDeletedShops(')).join('\n')+source.slice(start,end)+';globalThis.call=northMarketRpc;',context);
    return {context,identity,switchAccount:()=>{account='other';}};
  }
  test(`${kind} public directory request does not send a private identity`,async()=>{
    let request;
    const {context}=setup(async(url,opt)=>{request={url,opt};return {ok:true,json:async()=>({ok:true,shops:[]})};});
    await context.call('list',{p_query:'奶茶',p_limit:9},false);
    const body=JSON.parse(request.opt.body);
    assert.equal(body.p_phone_id,undefined);assert.equal(body.p_secret,undefined);
    assert.equal(request.url,'https://fixture.invalid/rest/v1/rpc/north_market_list');
  });
  test(`${kind} store publication authenticates in the request body without mutating caller arguments`,async()=>{
    let request;
    const {context}=setup(async(url,opt)=>{request={url,opt};return {ok:true,json:async()=>({ok:true,id:'fixture'})};});
    const args={p_expected:0,p_shop:{name:'测试'}};
    await context.call('save_shop',args,true);
    assert.equal(JSON.parse(request.opt.body).p_secret,'fixture-secret');
    assert.equal(args.p_secret,undefined);assert(!request.url.includes('fixture-secret'));
  });
  test(`${kind} late cross-account response is rejected before a caller can apply it`,async()=>{
    let release;
    const pending=new Promise(resolve=>{release=resolve;});
    const fixture=setup(()=>pending);
    const call=fixture.context.call('mine',{},true);
    fixture.switchAccount();release({ok:true,json:async()=>({ok:true,shop:{name:'前一账号'}})});
    await assert.rejects(call,/账号已切换/);
  });
  test(`${kind} an in-place phone identity replacement also discards a late response`,async()=>{
    let release;const pending=new Promise(resolve=>{release=resolve;});const fixture=setup(()=>pending);
    const call=fixture.context.call('wallet',{},true);fixture.identity.id='SPOTHER001';release({ok:true,json:async()=>({ok:true,balance:100000})});
    await assert.rejects(call,/账号已切换/);
  });
  test(`${kind} denied backend responses do not look like successful publication`,async()=>{
    const {context}=setup(async()=>({ok:false,status:401,json:async()=>({message:'market-auth-required'})}));
    await assert.rejects(context.call('save_shop',{},true),error=>error.backendMessage==='market-auth-required'&&error.httpStatus===401&&error.message.includes('云端交易授权'));
  });
  test(`${kind} public invitation-free preview can browse but cannot register or trade as a real account`,async()=>{
    let fetches=0,registrations=0;
    const {context}=setup(async()=>{fetches++;return {ok:true,json:async()=>({ok:true,shops:[]})};});
    context.NORTH_PREVIEW=true;context.location={hostname:'preview.github.io'};context.pfEnsure=async()=>{registrations++;};
    await assert.rejects(context.call('save_shop',{},true),/免邀请码预览/);assert.equal(fetches,0);
    await context.call('list',{p_query:''});assert.equal(fetches,1);
    const source=fs.readFileSync(path,'utf8');vm.runInContext(source.match(/  async function northMarketEnsure\(\)\{[^\n]+/)[0]+';this.ensure=northMarketEnsure;',context);
    await assert.rejects(context.ensure(),/免邀请码预览/);assert.equal(registrations,0);
  });
  test(`${kind} opening a public store keeps every available product rather than only eight`,async()=>{
    const source=fs.readFileSync(path,'utf8');
    const start=source.indexOf('  window.northMarketOpen='),end=source.indexOf('  window.northMarketProductPage=',start);
    const products=Array.from({length:50},(_,i)=>({id:`product_${i}`,name:`商品${i}`}));
    const context={window:{},northMarketBusy:false,northMarketEpoch:0,northMarketView:null,actId:()=> 'main',cur:()=>({p:'food'}),render:()=>{},northMarketPageGet:()=>null,northMarketPagePut(){},northMarketPageReset(){},northMarketPagePaint(){},northMarketRpc:async()=>({shop:{id:'shop'},products})};
    Object.assign(context,Object.fromEntries(['northMerchantView','northProductEdit','northMyView','northCouponView','northCouponPurchase','northOrderView','northCheckoutDraft','northPinEntry','northView','northPersonalView'].map(k=>[k,null])));
    const enterStart=source.indexOf('  function northMarketEnter('),enterEnd=source.indexOf('  var northMarketOrderSeller=',enterStart);
    vm.runInNewContext('var northMarketKnownStores={};'+source.split('\n').find(l=>l.startsWith('  function northMerchantOrderedProducts('))+source.match(/  function northMarketRemember\(rows\)\{[^\n]+/)[0]+source.slice(enterStart,enterEnd)+source.slice(start,end),context);
    await context.window.northMarketOpen('shop');
    assert.equal(context.northMarketView.products.length,50);
    assert.equal(context.northMarketView.products[49].name,'商品49');
    assert.equal(context.northMarketView.more,false);
  });
  test(`${kind} cloud role funds are restricted to the current living couple role in the main account`,()=>{
    const source=fs.readFileSync(path,'utf8');
    const start=source.indexOf('  function northMarketCoupleRole('),end=source.indexOf('  async function northMarketRpc(',start);
    const role={id:'couple'},state={couple:{cid:role.id}};let account='main';
    const context={S:state,getC:id=>id===role.id?role:null,actId:()=>account};
    vm.runInNewContext(source.slice(start,end)+';globalThis.couple=northMarketCoupleRole;',context);
    assert.equal(context.couple(),role);
    state.couple.cid='ordinary-role';assert.equal(context.couple(),null);
    state.couple.cid=role.id;role.deleted=true;assert.equal(context.couple(),null);
    role.deleted=false;role.blocked=true;assert.equal(context.couple(),null);
    role.blocked=false;role.isPhoneFriend=true;assert.equal(context.couple(),null);
    role.isPhoneFriend=false;account='other';assert.equal(context.couple(),null);
    account='main';state.couple=null;assert.equal(context.couple(),null);
  });
  test(`${kind} an unknown purchase outcome is recovered by its persisted nonce without a second charge`,async()=>{
    const source=fs.readFileSync(path,'utf8');const start=source.indexOf('  window.northMarketSubmitOrder=async'),end=source.indexOf('  window.northMarketPublish=',start);
    const snapshotStart=source.indexOf('  function northMarketTransactionSnapshot('),snapshotEnd=source.indexOf('\n',snapshotStart);
    const state={food:{cart:[{_northRow:'row-1',_northAccount:'main'}]}},transactions=[];let writes=0,applied=null;
    const draft={state,account:'main',roleId:'',rows:['row-1'],client:'same-request',lines:[],quote:{shopId:'shop',revision:1,total:2190},shipping:{address:'测试地址',name:'我',phone:'',note:''},utensils:false,wallet:{}};
    const context={window:{},S:state,actId:()=> 'main',northMarketBusy:false,northMarketPayDraft:draft,northMarketCoupleRole:()=>null,northMarketTransactions:()=>transactions,saveNowAsync:async()=>true,document:{querySelectorAll:()=>[],getElementById:()=>null},toast:()=>{},northMarketApplyOrder:async(d,o)=>{applied=o;},northMarketRpc:async name=>{if(name==='order_create'){writes++;throw Error('network response lost');}return {orders:[{id:'confirmed-server-order',total:2190}]};}};
    vm.runInNewContext(source.slice(snapshotStart,snapshotEnd)+source.slice(start,end),context);await context.window.northMarketSubmitOrder('00000');
    assert.equal(transactions[0].status,'unknown');assert.equal(transactions[0].client,'same-request');assert(!JSON.stringify(transactions).includes('00000'),'PIN is not persisted');
    await context.window.northMarketSubmitOrder('00000');assert.equal(writes,1);assert.equal(applied.id,'confirmed-server-order');
  });
}

test('cloud soft-delete excludes old management rows, releases slots and preserves assets',async()=>{
 const {createRequire}=await import('node:module'),nodePath=await import('node:path'),os=await import('node:os'),require=createRequire(import.meta.url);const {PGlite}=require(nodePath.join(os.homedir(),'AppData','Local','CodexHardwareTests','robot-voice-sql-runtime','node_modules','@electric-sql','pglite','dist','index.cjs'));const db=new PGlite();
 try{await db.exec(`create role anon;create role authenticated;create role service_role;create table public.phone_friend_profiles(phone_id text,secret_hash text,display_name text,allow_search boolean);create table public.phone_licenses(id uuid,status text,phone_friend_id text,created_at timestamptz default now());create table public.phone_friend_requests(from_id text,to_id text,status text);create function public.phone_friend_hash(text) returns text language sql immutable as 'select md5($1)';create schema cron;create table cron.job(jobid bigint,jobname text,command text);create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);create function storage.foldername(text) returns text[] language sql immutable as 'select string_to_array($1,''/'')';create schema extensions;create function extensions.crypt(text,text) returns text language sql immutable as 'select md5($1||$2)';create function extensions.gen_salt(text) returns text language sql as 'select ''fixture-salt''::text';`);
 for(const name of ['202610070001_north_market.sql','202610070002_north_market_social_orders.sql','202610070004_north_market_role_selection.sql','202610080001_north_market_order_covers.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));await db.exec(fs.readFileSync('supabase/migrations/202610080006_north_market_shop_delete.sql','utf8'));
 await db.exec(`insert into public.phone_friend_profiles values('DELETE_TEST',md5('test-secret'),'test',false),('DELETE_OTHER',md5('other-secret'),'other',false);insert into public.phone_licenses(id,status,phone_friend_id) values('11111111-1111-4111-8111-111111111111','active','DELETE_TEST'),('22222222-2222-4222-8222-222222222222','active','DELETE_OTHER');insert into public.north_market_wallets(owner_id,balance,income) values('11111111-1111-4111-8111-111111111111',10000,3000);`);
 const call=async(name,args,phone='DELETE_TEST',secret='test-secret')=>(await db.query('select public.north_market_'+name+'('+[...Array(args.length+2)].map((_,i)=>'$'+(i+1)).join(',')+') as d',[phone,secret,...args])).rows[0].d;
 const old=await call('shop_create',['old','food','33333333-3333-4333-8333-333333333333',0,null]),mine=await call('shop_mine',[null]);await db.query("insert into public.north_market_stock(shop_id,product_id,name,unit,quantity) values($1,'stock','Historical stock','份',2)",[old.id]);await assert.rejects(()=>call('shop_delete',[old.id,mine.shop.revision+1]),/market-revision-changed/);await assert.rejects(()=>call('shop_delete',[old.id,mine.shop.revision],'DELETE_OTHER','other-secret'),/market-shop-unavailable/);await call('shop_delete',[old.id,mine.shop.revision]);assert.equal((await call('shop_delete',[old.id,mine.shop.revision])).duplicate,true);assert.equal((await call('shop_mine',[null])).shop,null);const cleared=await call('business',[]);assert.equal(cleared.shopCount,0);assert.equal(cleared.nextStartupFee,0);assert.equal(cleared.shops.length,0);assert.equal(cleared.stock.length,0);assert.equal(cleared.balance,10000);assert.equal(cleared.income,3000);assert.equal((await db.query('select quantity from public.north_market_stock where shop_id=$1',[old.id])).rows[0].quantity,2);const priorRequest='55555555-5555-4555-8555-555555555555';await db.query("insert into public.north_market_business_ops(owner_id,request_id,fingerprint,result) values('11111111-1111-4111-8111-111111111111',$1,md5(jsonb_build_array($2::uuid,'stock',1,'wallet',40,false)::text),'{\"ok\":true,\"amount\":40}'::jsonb)",[priorRequest,old.id]);assert.equal((await call('stock_change',[old.id,'stock',1,'wallet',priorRequest,'00000',40,false])).amount,40);await assert.rejects(()=>call('stock_change',[old.id,'stock',1,'wallet','66666666-6666-4666-8666-666666666666','00000',40,false]),/market-shop-deleted/);const fresh=await call('shop_create',['fresh','food','44444444-4444-4444-8444-444444444444',0,null]);assert.notEqual(fresh.id,old.id);assert.equal((await call('business',[])).shopCount,1);await assert.rejects(()=>call('shop_create',['old','food','33333333-3333-4333-8333-333333333333',0,null]),/market-shop-deleted/);assert.equal((await db.query('select count(*)::int as n from public.north_market_shops')).rows[0].n,2);assert.equal((await db.query("select relrowsecurity as yes from pg_class where oid='public.north_market_shops'::regclass")).rows[0].yes,true);
 }finally{await db.close();}
});
