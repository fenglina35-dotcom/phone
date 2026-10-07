import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import cp from 'node:child_process';

// Executed against PostgreSQL inside a transaction ending with ROLLBACK.
export const transactionSQL=String.raw`
do $test$
declare seller text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));
 host text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));guest text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));
 s uuid:=gen_random_uuid();h uuid:=gen_random_uuid();g uuid:=gen_random_uuid();shop uuid;split uuid;oid uuid;request uuid:=gen_random_uuid();result jsonb;product jsonb;catalog jsonb;lines jsonb;address jsonb;failed boolean;balance bigint;scheduled timestamptz:=now()+interval '1 day';
begin
 insert into public.phone_friend_profiles(phone_id,secret_hash,display_name,allow_search) values(seller,public.phone_friend_hash('social-test-secret'),'事务店主',false),(host,public.phone_friend_hash('social-test-secret'),'事务发起人',false),(guest,public.phone_friend_hash('social-test-secret'),'事务好友',false);
 insert into public.phone_licenses(id,status,phone_friend_id) values(s,'active',seller),(h,'active',host),(g,'active',guest);
 product:=jsonb_build_object('id','tea','name','事务奶茶','groupId','drinks','price',2000,'unit','杯','description','','image','','signature',true,'available',true,'specGroups','[]'::jsonb);
 catalog:=jsonb_build_object('name','事务拼单茶铺','category','奶茶','intro','','cover','','minimum',2000,'delivery',191,'published',true,'groups',jsonb_build_array(jsonb_build_object('id','drinks','name','饮品')),'products',jsonb_build_array(product));
 shop:=(public.north_market_save_shop(seller,'social-test-secret',0,catalog)->>'id')::uuid;
 perform public.north_market_claim(seller,'social-test-secret');perform public.north_market_stock_change(seller,'social-test-secret',shop,'tea',50,'wallet',gen_random_uuid(),'00000',40000,false);
 perform public.north_market_claim(host,'social-test-secret');perform public.north_market_claim(guest,'social-test-secret');
 lines:=jsonb_build_array(jsonb_build_object('productId','tea','quantity',1,'selections','{}'::jsonb));address:=jsonb_build_object('name','验收','address','虚拟位置','phone','');
 failed:=false;begin perform public.north_market_split_create(host,'social-test-secret',request,guest,shop,1,lines,address,false,'',2191);exception when others then failed:=true;end;
 if not failed then raise exception 'FAIL non-friend invitation';end if;
 insert into public.phone_friend_requests(from_id,to_id,status) values(host,guest,'accepted');
 split:=(public.north_market_split_create(host,'social-test-secret',request,guest,shop,1,lines,address,false,'',2191)->>'id')::uuid;
 if (public.north_market_split_create(host,'social-test-secret',request,guest,shop,1,lines,address,false,'',2191)->>'id')::uuid<>split then raise exception 'FAIL duplicate invitation';end if;
 result:=public.north_market_split_get(host,'social-test-secret',null,request);
 if jsonb_array_length(result->'splits')<>1 or result->'splits'->0->>'client_id'<>request::text then raise exception 'FAIL client recovery lookup';end if;
 failed:=false;begin perform public.north_market_order_create(host,'social-test-secret',request,shop,1,lines,address,false,'','',null,'00000',2191,null);exception when others then failed:=true;end;
 if not failed then raise exception 'FAIL ordinary checkout bypasses split nonce';end if;
 failed:=false;begin perform public.north_market_split_pay(seller,'social-test-secret',split,'00000');exception when others then failed:=true;end;if not failed then raise exception 'FAIL outsider pays';end if;
 result:=public.north_market_split_pay(host,'social-test-secret',split,'11111');if result->>'ok'<>'false' then raise exception 'FAIL bad PIN';end if;
 perform public.north_market_split_pay(guest,'social-test-secret',split,'00000');perform public.north_market_split_pay(guest,'social-test-secret',split,'00000');
 if (public.north_market_wallet(guest,'social-test-secret')->>'balance')::bigint<>48904 then raise exception 'FAIL guest half or replay';end if;
 if exists(select 1 from public.north_market_orders where client_id=request) then raise exception 'FAIL order before both paid';end if;
 result:=public.north_market_split_pay(host,'social-test-secret',split,'00000');oid:=(result->>'orderId')::uuid;perform public.north_market_split_pay(host,'social-test-secret',split,'00000');
 if oid is null or (public.north_market_wallet(host,'social-test-secret')->>'balance')::bigint<>48905 then raise exception 'FAIL host half or replay';end if;
 if (public.north_market_order(guest,'social-test-secret',oid)->>'isBuyer')::boolean then raise exception 'FAIL guest owns order';end if;
 perform public.north_market_order_status(host,'social-test-secret',oid,'cancelled');perform public.north_market_order_status(host,'social-test-secret',oid,'cancelled');
 if (public.north_market_wallet(host,'social-test-secret')->>'balance')::bigint<>50000 or (public.north_market_wallet(guest,'social-test-secret')->>'balance')::bigint<>50000 then raise exception 'FAIL paid split refunds to each source';end if;
 split:=(public.north_market_split_create(host,'social-test-secret',gen_random_uuid(),guest,shop,1,lines,address,false,'',2191)->>'id')::uuid;
 perform public.north_market_split_pay(host,'social-test-secret',split,'00000');update public.north_market_splits set expires_at=now()-interval '1 second' where id=split;
 perform public.north_market_split_get(guest,'social-test-secret',split);perform public.north_market_split_get(host,'social-test-secret',split);
 if (public.north_market_wallet(host,'social-test-secret')->>'balance')::bigint<>50000 then raise exception 'FAIL expired refund';end if;
 address:=address||jsonb_build_object('scheduledAt',scheduled);
 result:=public.north_market_order_create(host,'social-test-secret',gen_random_uuid(),shop,1,lines,address,false,'','',null,'00000',2191,null);oid:=(result->'order'->>'id')::uuid;
 if (result->'order'->>'scheduled_at')::timestamptz<>scheduled then raise exception 'FAIL reservation snapshot';end if;
 perform public.north_market_order_status(seller,'social-test-secret',oid,'accepted');failed:=false;begin perform public.north_market_order_status(seller,'social-test-secret',oid,'ready');exception when others then failed:=true;end;if not failed then raise exception 'FAIL reservation sent early';end if;
 update public.north_market_orders set scheduled_at=now()-interval '1 second' where id=oid;
 perform public.north_market_order_status(seller,'social-test-secret',oid,'ready');perform public.north_market_order_status(seller,'social-test-secret',oid,'delivered');perform public.north_market_order_status(host,'social-test-secret',oid,'completed');
 failed:=false;begin perform public.north_market_order_status(host,'social-test-secret',oid,'cancelled');exception when raise_exception then failed:=SQLERRM='market-completed-order-no-refund';end;if not failed then raise exception 'FAIL completed buyer refund';end if;
 failed:=false;begin perform public.north_market_order_status(seller,'social-test-secret',oid,'cancelled');exception when raise_exception then failed:=SQLERRM='market-completed-order-no-refund';end;if not failed then raise exception 'FAIL completed seller refund';end if;
 perform public.north_market_review_save(host,'social-test-secret',oid,0,jsonb_build_object('rating',4,'text','评价','images','[]'::jsonb,'anonymous',true));
 failed:=false;begin perform public.north_market_reply(guest,'social-test-secret',oid,'冒充店主');exception when others then failed:=true;end;if not failed then raise exception 'FAIL wrong seller reply';end if;
 perform public.north_market_reply(seller,'social-test-secret',oid,'谢谢评价');perform public.north_market_reply(seller,'social-test-secret',oid,'谢谢评价');
 failed:=false;begin perform public.north_market_reply(seller,'social-test-secret',oid,'再次回复');exception when others then failed:=true;end;if not failed then raise exception 'FAIL second reply';end if;
 perform public.north_market_review_save(host,'social-test-secret',oid,1,jsonb_build_object('rating',5,'text','修改评价','images','[]'::jsonb,'anonymous',true));
 if public.north_market_reviews(shop,null)->'reviews'->0->>'seller_reply'<>'谢谢评价' then raise exception 'FAIL reply missing from public feed';end if;
 if (public.north_market_review_inbox(host,'social-test-secret',false,null)->>'unread')::integer<>1 then raise exception 'FAIL unread reply';end if;
 perform public.north_market_reply_read(guest,'social-test-secret',jsonb_build_array(oid));if (public.north_market_review_inbox(host,'social-test-secret',false,null)->>'unread')::integer<>1 then raise exception 'FAIL outsider clears unread';end if;
 perform public.north_market_reply_read(host,'social-test-secret',jsonb_build_array(oid));if (public.north_market_review_inbox(host,'social-test-secret',false,null)->>'unread')::integer<>0 then raise exception 'FAIL read acknowledgement';end if;
 raise notice 'PASS split shares/PIN/identity/replay/pending/refund/expiry, reservation, one seller reply and read acknowledgement';
if (select quantity from public.north_market_stock where shop_id=shop and product_id='tea')<>49 then raise exception 'FAIL reservation/refund inventory';end if;
 result:=public.north_market_business(seller,'social-test-secret');if (result->>'profit')::bigint<>1200 or (result->>'income')::bigint<>2000 then raise exception 'FAIL realized margin';end if;
 perform public.north_market_claim(host,'social-test-secret');if (public.north_market_wallet(host,'social-test-secret')->>'balance')::bigint<>47809 then raise exception 'FAIL grant repeats';end if;
 request:=gen_random_uuid();perform public.north_market_stock_change(seller,'social-test-secret',shop,'tea',1,'wallet',request,'00000',800,false);perform public.north_market_stock_change(seller,'social-test-secret',shop,'tea',1,'wallet',request,'00000',800,false);
 if (public.north_market_wallet(seller,'social-test-secret')->>'balance')::bigint<>9200 then raise exception 'FAIL restock replay';end if;
 perform public.north_market_stock_change(seller,'social-test-secret',shop,'tea',50,'wallet',gen_random_uuid(),'00000',40000,true);
 if (public.north_market_wallet(seller,'social-test-secret')->>'balance')::bigint<>49200 then raise exception 'FAIL return original cost';end if;
 failed:=false;begin perform public.north_market_quote(shop,1,lines);exception when raise_exception then failed:=SQLERRM='market-stock-unavailable';end;if not failed then raise exception 'FAIL soldout purchasable';end if;
 perform public.north_market_couple(seller,'social-test-secret','shop-partner','Partner');result:=public.north_market_business_notices(seller,'social-test-secret','shop-partner',null);
 if jsonb_array_length(result->'notices')<>1 then raise exception 'FAIL soldout notice';end if;
 perform public.north_market_business_notices(seller,'social-test-secret','shop-partner',jsonb_build_array(result->'notices'->0->>'id'));
 if jsonb_array_length(public.north_market_business_notices(seller,'social-test-secret','shop-partner',null)->'notices')<>0 then raise exception 'FAIL repeated stock notice';end if;
 result:=public.north_market_couple(host,'social-test-secret','partner','Partner');balance:=(result->'couple'->>'revision')::integer;
 if public.north_market_role_search(host,'social-test-secret','partner','tea')->>'status'<>'unfunded' then raise exception 'FAIL auto funded role';end if;
 perform public.north_market_transfer(host,'social-test-secret','wallet','couple','partner',5000,gen_random_uuid());
 perform public.north_market_stock_change(seller,'social-test-secret',shop,'tea',1,'income',gen_random_uuid(),'00000',800,false);
 result:=public.north_market_role_search(host,'social-test-secret','partner',product->>'name');if jsonb_array_length(result->'offers')<>1 or result->'offers'->0->>'shopId'<>shop::text then raise exception 'FAIL role live keyword search';end if;
 request:=gen_random_uuid();result:=public.north_market_role_order(host,'social-test-secret','partner',balance::integer,request,shop,1,lines,address,true,2191);oid:=(result->'order'->>'id')::uuid;
 perform public.north_market_role_order(host,'social-test-secret','partner',balance::integer,request,shop,1,lines,address,true,2191);
 result:=public.north_market_wallet(host,'social-test-secret');if (result->>'balance')::bigint<>42809 or (result->'couple'->>'balance')::bigint<>2809 then raise exception 'FAIL role pays source/replay';end if;
 perform public.north_market_order_status(host,'social-test-secret',oid,'cancelled');if (public.north_market_wallet(host,'social-test-secret')->'couple'->>'balance')::bigint<>5000 then raise exception 'FAIL role refund';end if;
 perform public.north_market_stock_change(seller,'social-test-secret',shop,'tea',1,'wallet',gen_random_uuid(),'00000',800,true);if (public.north_market_wallet(seller,'social-test-secret')->>'income')::bigint<>2000 then raise exception 'FAIL income-funded return';end if;
 failed:=false;begin perform public.north_market_shop_create(seller,'social-test-secret','Second','Food',gen_random_uuid(),20000,'00000');exception when raise_exception then failed:=SQLERRM='market-earned-profit-required';end;if not failed then raise exception 'FAIL expansion without profit';end if;
 -- Isolated rolled-back fixture for threshold and maximum-store checks.
 update public.north_market_orders set subtotal=100000,stock_cost=1000 where id in(select id from public.north_market_orders where seller_id=s::text and status='completed' limit 1);
 update public.north_market_wallets set income=100000 where owner_id=s::text;
 request:=gen_random_uuid();result:=public.north_market_shop_create(seller,'social-test-secret','Second','Food',request,20000,'00000');perform public.north_market_shop_create(seller,'social-test-secret','Second','Food',request,20000,'00000');
 perform public.north_market_shop_create(seller,'social-test-secret','Third','Food',gen_random_uuid(),40000,'00000');
 if (public.north_market_wallet(seller,'social-test-secret')->>'income')::bigint<>40000 then raise exception 'FAIL startup replay/fees';end if;
 failed:=false;begin perform public.north_market_shop_create(seller,'social-test-secret','Fourth','Food',gen_random_uuid(),40000,'00000');exception when raise_exception then failed:=SQLERRM='market-three-shop-limit';end;if not failed then raise exception 'FAIL fourth shop';end if;
end $test$;
`;

for(const priv of [false,true]){
 const src=fs.readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 test((priv?'private':'web')+' AI checkout has no minimum while fixed and owner-defined minimum remain',()=>{
  let rendered=0;const ctx={deliveryRealEnabled:()=>false,northValidSaleItem:()=>true,northMerchantSaved:()=>({id:'own',minimum:2500,delivery:200}),northCents:p=>Math.round(p*100),toast(){},northPersonalView:null,northMerchantView:null,northProductEdit:null,northMyView:null,northCouponView:null,northCouponPurchase:null,northOrderView:null,northCheckoutDraft:null,northView:null,actId:()=> 'main',uid:()=> 'request',northShopName:'Fixed',northAllowed:()=>false,closeModal(){},render:()=>rendered++,S:{food:{cart:[]}}};vm.createContext(ctx);vm.runInContext(src.match(/  function northCheckout\(items,generic\)\{[^\n]+/)[0]+';this.checkout=northCheckout;',ctx);
  ctx.checkout([{price:5,shop:'AI',_northGeneric:true}],true);assert.equal(ctx.northCheckoutDraft.minimum,0);assert.equal(rendered,1);
  ctx.northCheckoutDraft=null;ctx.checkout([{price:5,_northSku:'fixed'}],false);assert.equal(ctx.northCheckoutDraft,null);
  ctx.checkout([{price:20,_northMerchant:true}],true);assert.equal(ctx.northCheckoutDraft,null);
  ctx.checkout([{price:25,_northMerchant:true}],true);assert.equal(ctx.northCheckoutDraft.minimum,2500);
 });
 test((priv?'private':'web')+' visits expire at thirty days and a failed cleanup preserves saved history',async()=>{
  const now=Date.now(),day=86400000,keep={at:now-29*day,key:'recent'},old={at:now-30*day,key:'old'},favorite={key:'favorite'},rows=[keep,old,{at:now+day},{at:'invalid'}];let allow=false;
  const ctx={Date,northSaving:false,S:{food:{north:{personal:{main:{visits:rows,favorites:[favorite]},other:{visits:[old],favorites:[]}}}}},northCommit:async mutate=>{const undo=mutate();if(!allow)undo();return allow;}};vm.createContext(ctx);vm.runInContext(src.match(/  function northRecentVisits\(rows,now\)\{[^\n]+/)[0]+'\n'+src.match(/  async function northExpireFootprints\(\)\{[^\n]+/)[0]+';this.recent=northRecentVisits;this.cleanup=northExpireFootprints;',ctx);
  assert.equal(ctx.recent(rows,now).length,1);assert.equal(await ctx.cleanup(),false);assert.equal(ctx.S.food.north.personal.main.visits,rows);
  allow=true;assert.equal(await ctx.cleanup(),true);assert.equal(ctx.S.food.north.personal.main.visits.length,1);assert.equal(ctx.S.food.north.personal.other.visits.length,0);assert.equal(ctx.S.food.north.personal.main.favorites[0],favorite);
 });
 test((priv?'private':'web')+' a completed local order cannot refund or restore a used coupon',async()=>{
  const order={id:'done',status:'completed',total:2000};let refunded=0;const ctx={window:{},deliveryRealEnabled:()=>false,northSaving:false,northFind:()=>order,northStatus:o=>o.status,northFundingRefund:()=>refunded++,S:{me:{balance:50}}};vm.createContext(ctx);vm.runInContext(src.match(/  window.northRefund=async function\(id\)\{[^\n]+/)[0],ctx);await ctx.window.northRefund('done');assert.equal(refunded,0);assert.equal(order.status,'completed');assert.equal(ctx.S.me.balance,50);
 });
 test((priv?'private':'web')+' failed cloud shop import retains the prior shop and its library entry',async()=>{
  const prior={id:'old',marketId:'old-cloud',name:'Old'},target={id:'new-cloud',name:'New',published:true,revision:1,catalog:{groups:[],products:[]}},data={merchants:{main:prior},merchantLibrary:{main:{'old-cloud':prior}}};let opened=0;
  const ctx={window:{},S:{},northMarketBusy:false,actId:()=> 'main',northMarketEnsure:async()=>true,northMarketRpc:async()=>({shop:target}),northMerchantSaved:()=>prior,northData:()=>data,uid:()=> 'new-local',saveNowAsync:async()=>false,northMerchantEditor:()=>opened++,toast(){}};vm.createContext(ctx);vm.runInContext(src.match(/  window.northMarketManageMine=async function\(preview,shopId\)\{[^\n]+/)[0],ctx);
  await ctx.window.northMarketManageMine(false,target.id);assert.equal(data.merchants.main,prior);assert.equal(data.merchantLibrary.main['old-cloud'],prior);assert.equal(data.merchantLibrary.main['new-cloud'],undefined);assert.equal(opened,0);assert.equal(ctx.northMarketBusy,false);
 });
 test((priv?'private':'web')+' reserved simulated order cannot arrive before the selected time',()=>{
  const fn=src.match(/  function northStatus\(o\)\{[^\n]+/)[0],ctx={Date};vm.createContext(ctx);vm.runInContext(fn+';this.status=northStatus;',ctx);
  assert.equal(ctx.status({createdAt:Date.now()-120000,scheduledAt:Date.now()+3600000,status:'paid'}),'paid');
  assert.equal(ctx.status({createdAt:Date.now()-120000,scheduledAt:Date.now()-1000,status:'paid'}),'delivered');
  assert.equal(ctx.status({createdAt:Date.now()-120000,scheduledAt:Date.now()+3600000,status:'cancelled'}),'cancelled');
 });
 test((priv?'private':'web')+' stale local coupon PIN cannot debit a local wallet or mint new vouchers',async()=>{
  let closed=0;const ctx={northCouponPurchase:{authorized:true},northPinEntry:{},closeModal:()=>closed++,toast(){},S:{me:{balance:200},food:{north:{vouchers:[]}}}};vm.createContext(ctx);vm.runInContext(src.match(/  async function northFinalizeCouponPurchase\(\)\{[^\n]+/)[0]+';this.finalize=northFinalizeCouponPurchase;',ctx);
  assert.equal(await ctx.finalize(),false);assert.equal(ctx.S.me.balance,200);assert.equal(ctx.S.food.north.vouchers.length,0);assert.equal(ctx.northCouponPurchase,null);assert.equal(closed,1);
 });
}

for (const priv of [false,true]) {
 const src=fs.readFileSync(priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js','utf8');
 test((priv?'private':'web')+' main cloud vouchers retain colorful layout and actual cloud coupon fields',()=>{
  const c={id:'cloud-coupon',face:500,minimum:3500,inflated:true,expires_at:'2026-11-01T00:00:00Z'};
  const ctx={money:n=>(+n).toFixed(2),esc:String,fmtDT:n=>new Date(+n||1791356400000).toISOString(),mtGlyph:()=>'',northNavIcon:()=>'',northMarketNavigation:()=>'<nav>nav</nav>',window:{},toast:()=>{},northCouponPacks:[{id:'light',name:'轻享包',price:590},{id:'daily',name:'日常包',price:690}]};
  vm.createContext(ctx);vm.runInContext(src.match(/  function northMarketCouponsHTML\(v\)\{[^\n]+/)[0],ctx);
  const html=ctx.northMarketCouponsHTML({busy:false,rows:[c]});
  assert.match(html,/north-voucher-header/);assert.match(html,/north-voucher-hero/);
  assert.match(html,/¥5\.00/);assert.match(html,/35\.00/);assert.match(html,/2026-11-01/);
  assert.match(html,/northMarketCouponBuy\(/);assert.match(html,/northMarketCouponBoost\(/);
  assert.doesNotMatch(html,/northStartCouponPurchase\(/);
 });
 test((priv?'private':'web')+' errand entry only reports development without triggering a search',()=>{
  let notices=[],searches=0;const ctx={window:{},toast:s=>notices.push(s),foodQuick:()=>searches++};
  vm.createContext(ctx);const handler=src.match(/  window\.mtFoodErrand=function\(\)\{[^\n]+/);
  assert.ok(handler,'errand development handler exists');vm.runInContext(handler[0],ctx);
  ctx.window.mtFoodErrand();assert.deepEqual(notices,['开发中']);assert.equal(searches,0);
 });
}

for(const priv of [false,true]){
 const src=fs.readFileSync(priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js','utf8');
 test((priv?'private':'web')+' rules page is read only and stock/wallet icons are distinct',()=>{
  const ctx={esc:String,northPersonalHeader:s=>'<header>'+s+'</header>',mtGlyph:()=>'<svg>order</svg>'};vm.createContext(ctx);
  vm.runInContext(src.match(/  function northPlayRulesHTML\(\)\{[^\n]+/)[0],ctx);
  const html=ctx.northPlayRulesHTML();assert.match(html,/玩法规则/);assert.match(html,/首次可领取500/);assert.match(html,/已完成订单不能退款/);assert.match(html,/真人店不支持亲属卡/);assert.doesNotMatch(html,/onclick=|<input|<form/);
  vm.runInContext(src.match(/  function northMyFunctionIcon\(kind\)\{[^\n]+/)[0],ctx);
  assert.match(ctx.northMyFunctionIcon('stock'),/data-north-icon="stock"/);assert.match(ctx.northMyFunctionIcon('wallet'),/data-north-icon="wallet"/);assert.notEqual(ctx.northMyFunctionIcon('stock'),ctx.northMyFunctionIcon('wallet'));
 });
}

// New role selection regressions use real functions with controlled RPC/model boundaries.
for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js';
 const src=process.env.NORTH_ROLE_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(file,'utf8');
 function roleContext(opt={}){
  const c={id:'partner',name:'角色',model:'main'},identity={id:'phone',secret:'test'},data={},events=[],messages=[],state={me:{name:'我'}},coupon={id:'coupon',minimum:2000,face:300,expires_at:'2099-01-01T00:00:00Z'};
  const tea={id:'tea',name:'芋泥奶茶',price:1800,stock:5,available:true,soldOut:false,specGroups:[{id:'heat',name:'温度',required:true,mode:'single',options:[{id:'cold',label:'冰的',price:0},{id:'warm',label:'温的',price:100}]}]},addon={id:'addon',name:'小料',price:100,stock:5,available:true,soldOut:false,specGroups:[]},cake={id:'cake',name:'草莓小熊蛋糕',price:2500,stock:3,available:true,soldOut:false,specGroups:[]},wrong={id:'wrong',name:'巧克力蛋糕',price:2500,stock:3,available:true,soldOut:false,specGroups:[]};
  const shop={id:'shop',name:'真人店',revision:2,minimum:2000,delivery:190,products:[tea,addon,cake,wrong]},catalog={shops:[shop]},intent={queries:['芋泥','奶茶'],must:['芋泥','奶茶'],quantity:1,preferences:[{group:'温度',value:'温'}]},choice={shopId:'shop',primaryId:'tea',lines:[{productId:'tea',quantity:1,selections:{heat:['warm']}},{productId:'addon',quantity:1,selections:{}}]};
  let modelCalls=0,paid=0;const notices=[];const ctx={window:{},Date,JSON,Math,Set,crypto:{randomUUID:()=> 'request'},S:state,location:{hostname:'localhost'},NORTH_PREVIEW:false,actId:()=> 'main',phoneFriendState:()=>identity,northMarketCoupleRole:()=>c,northData:()=>data,msgs:()=>messages,uid:()=> 'message',money:n=>(n).toFixed(2),save(){},saveNowAsync:async()=>true,northMarketWalletCache:null,northRoleFoodCard:()=>({type:'food'}),toast:s=>notices.push(s),roleChatRouteIndex:()=>0,chatAPI:async(ms,settings)=>{modelCalls++;events.push('model'+modelCalls);assert.equal(settings.independentRoleModel,true);if(opt.switchAccount&&modelCalls===2)ctx.actId=()=> 'other';if(modelCalls===1)return JSON.stringify(intent);if(modelCalls===2)return JSON.stringify(opt.badSpec?{...choice,lines:[{productId:'tea',quantity:2,selections:{heat:['cold']}}]}:choice);if(opt.finalFailure)throw Error('model offline');return JSON.stringify({message:'给你挑好了，慢慢享用吧。'});},northMarketRpc:async(name,args)=>{events.push(name);if(name==='wallet')return {couple:{id:c.id,balance:5000,revision:1}};if(name==='role_catalog'){assert.ok(args.p_queries.includes('芋泥'));assert.deepEqual(Array.from(args.p_required),['芋泥','奶茶']);if(opt.networkFailure)throw Error('network offline');return catalog;}if(name==='coupons')return {coupons:[coupon]};if(name==='quote')return {subtotal:2000,delivery:190,total:2190};if(name==='role_checkout'){paid++;assert.equal(args.p_coupon,'coupon');assert.equal(args.p_total,1890);assert.equal(args.p_topup,true);if(opt.unknown){const e=Error('timeout');e.httpStatus=504;throw e;}return {order:{id:'order',shop_name:'真人店',subtotal:2000,delivery:190,discount:300,total:1890,note:'角色点餐：为凑起送价增加商品或份数',items:[{productId:'tea',name:'芋泥奶茶',quantity:1,labels:['温的']},{productId:'addon',name:'小料',quantity:1,labels:[]}]}};}if(name==='orders')return {orders:[]};throw Error('unexpected RPC '+name);}};
  vm.createContext(ctx);let start=src.indexOf('  function northRoleFoodReceipt('),end=src.indexOf('  function northMarketRoleFoodCard(',start);assert.ok(start>=0&&end>start);vm.runInContext(src.slice(start,end),ctx);return {ctx,c,data,events,notices,catalog,shop,choice,intent,paid:()=>paid,modelCalls:()=>modelCalls};
 }
 test((priv?'private':'web')+' role keeps flavor keywords and actual specs, then pays once with cloud coupon and reports verified extras',async()=>{const t=roleContext();const result=await t.ctx.northPreferredRoleFood(t.c,'芋泥奶茶','18|某店|半糖|温的|1','main',{turnId:'turn'});assert.equal(result.type,'marketfood');assert.equal(t.paid(),1);assert.equal(t.modelCalls(),3);assert.match(result.marketFood.resultText,/为凑起送价，加了小料 ×1/);assert.match(result.marketFood.resultText,/已减 ¥3.00/);assert.match(result.marketFood.resultText,/实付 ¥18.90/);assert.ok(t.events.indexOf('role_checkout')<t.events.indexOf('model3'));t.ctx.msgs=()=>[result];assert.equal(await t.ctx.northPreferredRoleFood(t.c,'芋泥奶茶','18','main',{turnId:'turn'}),null);assert.equal(t.paid(),1);});
 test((priv?'private':'web')+' role rejects wrong temperature, invented options, wrong flavor and unnecessary topups before payment',async()=>{const t=roleContext({badSpec:true});assert.equal((await t.ctx.northPreferredRoleFood(t.c,'芋泥奶茶','18','main',{turnId:'turn'})).type,'text');assert.equal(t.paid(),0);assert.match(t.notices.join(''),/规格不符合/);const choose=t.ctx.northRoleChoice;const cakePlan={must:['草莓','蛋糕'],quantity:1,preferences:[]};assert.throws(()=>choose(JSON.stringify({shopId:'shop',primaryId:'wrong',lines:[{productId:'wrong',quantity:1,selections:{}}]}),t.catalog,cakePlan),/口味/);assert.throws(()=>choose(JSON.stringify({shopId:'shop',primaryId:'cake',lines:[{productId:'cake',quantity:1,selections:{}},{productId:'addon',quantity:1,selections:{}}]}),t.catalog,cakePlan),/无需凑/);const invented=JSON.parse(JSON.stringify(t.choice));invented.lines[0].selections.heat=['fake'];assert.throws(()=>choose(JSON.stringify(invented),t.catalog,t.intent),/不存在的规格/);});
 test((priv?'private':'web')+' role preserves paid receipt when final model fails and never converts network errors to virtual orders',async()=>{const t=roleContext({finalFailure:true});const result=await t.ctx.northPreferredRoleFood(t.c,'芋泥奶茶','18','main',{turnId:'turn'});assert.equal(result.type,'marketfood');assert.match(result.marketFood.resultText,/已付款/);assert.equal(t.paid(),1);const fail=roleContext({networkFailure:true});assert.match((await fail.ctx.northPreferredRoleFood(fail.c,'芋泥奶茶','18','main',{turnId:'turn'})).content,/没有下单成功/);assert.equal(fail.paid(),0);assert.equal(fail.data.roleMarketIntents[0].status,'failed');});
 test((priv?'private':'web')+' role account change and unknown payment cannot create or replay a charge',async()=>{const changed=roleContext({switchAccount:true});assert.equal(await changed.ctx.northPreferredRoleFood(changed.c,'芋泥奶茶','18','main',{turnId:'turn'}),null);assert.equal(changed.paid(),0);const unknown=roleContext({unknown:true});assert.match((await unknown.ctx.northPreferredRoleFood(unknown.c,'芋泥奶茶','18','main',{turnId:'turn'})).content,/付款结果暂时还没确认/);assert.equal(unknown.data.roleMarketIntents[0].status,'unknown');assert.equal(await unknown.ctx.northPreferredRoleFood(unknown.c,'芋泥奶茶','18','main',{turnId:'other-turn'}),null);assert.equal(unknown.paid(),1);});
 test((priv?'private':'web')+' role coupon selection rejects expired, used and unmet thresholds and prefers earliest expiry at equal discount',()=>{const t=roleContext(),best=t.ctx.northRoleBestCoupon;const coupons=[{id:'expired',minimum:0,face:1000,expires_at:'2000-01-01'},{id:'used',minimum:0,face:1000,expires_at:'2099-01-01',used_order_id:'used'},{id:'threshold',minimum:3500,face:500,expires_at:'2099-01-01'},{id:'later',minimum:2000,face:300,expires_at:'2099-02-01'},{id:'first',minimum:2000,face:300,expires_at:'2099-01-01'}];assert.equal(best(coupons,2000).id,'first');assert.equal(best(coupons,1500),null);});
}

export const roleSelectionSQL=String.raw`
do $test$
declare seller text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));buyer text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));
 s uuid:=gen_random_uuid();b uuid:=gen_random_uuid();shop uuid;rev integer;req uuid:=gen_random_uuid();oid uuid;cid uuid;othercid uuid;
 product jsonb;catalog jsonb;lines jsonb;address jsonb:=jsonb_build_object('address','回滚验收地址','name','测试','phone','');result jsonb;failed boolean;before_wallet bigint;
begin
 insert into public.phone_friend_profiles(phone_id,secret_hash,display_name,allow_search) values(seller,public.phone_friend_hash('role-selection-test'),'回滚店主',false),(buyer,public.phone_friend_hash('role-selection-test'),'回滚顾客',false);
 insert into public.phone_licenses(id,status,phone_friend_id) values(s,'active',seller),(b,'active',buyer);
 product:=jsonb_build_object('id','tea','name','回滚芋泥奶茶','groupId','drinks','price',2000,'unit','杯','description','芋泥奶茶','image','','available',true,'signature',false,'specGroups',jsonb_build_array(jsonb_build_object('id','heat','name','温度','mode','single','required',true,'options',jsonb_build_array(jsonb_build_object('id','cold','label','冰的','price',0),jsonb_build_object('id','warm','label','温的','price',100)))));
 catalog:=jsonb_build_object('name','回滚角色店','category','奶茶','intro','','cover','','minimum',2000,'delivery',190,'published',true,'groups',jsonb_build_array(jsonb_build_object('id','drinks','name','饮品')),'products',jsonb_build_array(product));
 shop:=(public.north_market_save_shop(seller,'role-selection-test',0,catalog)->>'id')::uuid;
 perform public.north_market_claim(seller,'role-selection-test');perform public.north_market_claim(buyer,'role-selection-test');
 perform public.north_market_stock_change(seller,'role-selection-test',shop,'tea',5,'wallet',gen_random_uuid(),'00000',4000,false);
 result:=public.north_market_couple(buyer,'role-selection-test','partner','角色');rev:=(result->'couple'->>'revision')::integer;
 perform public.north_market_transfer(buyer,'role-selection-test','wallet','couple','partner',5000,gen_random_uuid());
 result:=public.north_market_role_catalog(buyer,'role-selection-test','partner','["芋泥","奶茶"]','["芋泥","奶茶"]');
 if not exists(select 1 from jsonb_array_elements(result->'shops') x where x->>'id'=shop::text and x->'products'->0->'specGroups'->0->'options'->1->>'label'='温的') then raise exception 'FAIL keyword catalog/specs';end if;
 failed:=false;begin perform public.north_market_role_catalog(seller,'role-selection-test','shop-partner','["芋泥"]','["芋泥"]');exception when raise_exception then failed:=SQLERRM='market-couple-only';end;if not failed then raise exception 'FAIL couple boundary';end if;
end $test$;
do $test$
declare seller text;buyer text;s text;b text;shop uuid;rev integer;req uuid:=gen_random_uuid();oid uuid;cid uuid;othercid uuid;result jsonb;failed boolean;before_wallet bigint;
 lines jsonb:='[{"productId":"tea","quantity":1,"selections":{"heat":["warm"]}}]';address jsonb:=jsonb_build_object('address','回滚验收地址','name','测试','phone','');
begin
 -- Locate only this transaction's fixture by its secret hash, never production accounts.
 select phone_id into seller from public.phone_friend_profiles where secret_hash=public.phone_friend_hash('role-selection-test') and display_name='回滚店主';
 select phone_id into buyer from public.phone_friend_profiles where secret_hash=public.phone_friend_hash('role-selection-test') and display_name='回滚顾客';
 select id::text into s from public.phone_licenses where phone_friend_id=seller;select id::text into b from public.phone_licenses where phone_friend_id=buyer;
 select id into shop from public.north_market_shops where owner_id=s;
 rev:=(public.north_market_wallet(buyer,'role-selection-test')->'couple'->>'revision')::integer;
 perform public.north_market_coupon_buy(buyer,'role-selection-test','light',gen_random_uuid(),'00000');
 select id into cid from public.north_market_coupons where owner_id=b and minimum=2000 order by expires_at,id limit 1;
 insert into public.north_market_coupons(owner_id,face,minimum) values(s,300,2000) returning id into othercid;
 before_wallet:=(public.north_market_wallet(buyer,'role-selection-test')->'couple'->>'balance')::bigint;
 failed:=false;begin perform public.north_market_role_checkout(buyer,'role-selection-test','partner',rev,gen_random_uuid(),shop,1,lines,address,true,1990,othercid,false);exception when raise_exception then failed:=SQLERRM='market-coupon-unavailable';end;if not failed then raise exception 'FAIL foreign coupon';end if;
 failed:=false;begin perform public.north_market_role_checkout(buyer,'role-selection-test','partner',rev,gen_random_uuid(),shop,1,lines,address,true,1,cid,false);exception when raise_exception then failed:=SQLERRM='market-price-changed';end;if not failed then raise exception 'FAIL invented total';end if;
 result:=public.north_market_role_checkout(buyer,'role-selection-test','partner',rev,req,shop,1,lines,address,true,1990,cid,true);oid:=(result->'order'->>'id')::uuid;
 if (result->'order'->>'discount')::integer<>300 or result->'order'->'items'->0->'labels'->>0<>'温度：温的' then raise exception 'FAIL discount/spec snapshot';end if;
 perform public.north_market_role_checkout(buyer,'role-selection-test','partner',rev,req,shop,1,lines,address,true,1990,cid,true);
 if (public.north_market_wallet(buyer,'role-selection-test')->'couple'->>'balance')::bigint<>before_wallet-1990 or (select quantity from public.north_market_stock where shop_id=shop and product_id='tea')<>4 then raise exception 'FAIL replay debited twice';end if;
 failed:=false;begin perform public.north_market_role_checkout(buyer,'role-selection-test','partner',rev,gen_random_uuid(),shop,1,lines,address,true,1990,cid,true);exception when raise_exception then failed:=SQLERRM='market-coupon-unavailable';end;if not failed then raise exception 'FAIL used coupon reused';end if;
 perform public.north_market_order_status(buyer,'role-selection-test',oid,'cancelled');
 if (select used_order_id from public.north_market_coupons where id=cid) is not null or (public.north_market_wallet(buyer,'role-selection-test')->'couple'->>'balance')::bigint<>before_wallet then raise exception 'FAIL coupon/role refund';end if;
 update public.north_market_coupons set expires_at=now()-interval '1 second' where id=cid;
 failed:=false;begin perform public.north_market_role_checkout(buyer,'role-selection-test','partner',rev,gen_random_uuid(),shop,1,lines,address,true,1990,cid,false);exception when raise_exception then failed:=SQLERRM='market-coupon-unavailable';end;if not failed then raise exception 'FAIL expired coupon';end if;
 result:=public.north_market_role_catalog(buyer,'role-selection-test','partner','["芋泥"]','["芋泥","蛋糕"]');if exists(select 1 from jsonb_array_elements(result->'shops') x where x->>'id'=shop::text) then raise exception 'FAIL flavor AND category';end if;
 result:=public.north_market_role_catalog(buyer,'role-selection-test','partner','["芋泥"]','["芋泥"]');if result::text like '%owner_id%' or result::text like '%secret%' then raise exception 'FAIL private catalog leakage';end if;
 select (public.north_market_couple(seller,'role-selection-test','shop-partner','角色')->'couple'->>'revision')::integer into rev;
 result:=public.north_market_role_catalog(seller,'role-selection-test','shop-partner','["芋泥"]','["芋泥"]');if exists(select 1 from jsonb_array_elements(result->'shops')x where x->>'id'=shop::text) then raise exception 'FAIL own shop recommendation';end if;
 raise notice 'PASS role catalog AND keywords, actual specs, own-shop exclusion, coupon ownership/expiry/replay/refund, atomic role payment and stock';
end $test$;
`;
