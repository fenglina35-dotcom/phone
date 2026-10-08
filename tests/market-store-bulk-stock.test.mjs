import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import cp from 'node:child_process';

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js';
 const src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const take=p=>src.split('\n').find(l=>l.startsWith('  '+p))||'';

 test((priv?'private':'web')+' real order headers show shop covers while products keep their own images',()=>{
  const base='https://lkhlyfpssmrjkkzhuzag.supabase.co/storage/v1/object/public/north-market/'+'a'.repeat(32)+'/';
  const c={northMarketHeader:()=>'',mtGlyph:()=>'',northMarketPendingSplitsHTML:()=>'',esc:s=>String(s||''),money:n=>n.toFixed(2),fmtDT:s=>s,northMarketStatus:s=>s};vm.createContext(c);vm.runInContext(take('function northMarketImage(')+'\n'+take('function northMarketOrdersHTML(')+';this.html=northMarketOrdersHTML;',c);
  const row={id:'order1',shop_name:'Dessert store',shop_cover:base+'store.jpg',status:'completed',created_at:'today',total:2500,items:[{name:'Cake',image:base+'cake.jpg'}]};
  for(const seller of [false,true]){const h=c.html({seller,rows:[row]});const head=h.match(/<button class="north-history-head"[\s\S]*?<\/button>/)[0];assert.match(head,/store\.jpg/);assert.doesNotMatch(head,/cake\.jpg|meituan-kangaroo\.png/);assert.match(h,/cake\.jpg/);assert.match(head,/Dessert store/);}
  row.shop_cover='javascript:alert(1)';let h=c.html({seller:false,rows:[row]});assert.doesNotMatch(h,/javascript:/);assert.match(h,/meituan-kangaroo\.png/);delete row.shop_cover;h=c.html({seller:false,rows:[row]});assert.match(h,/meituan-kangaroo\.png/);assert.match(h,/cake\.jpg/);
 });

 test((priv?'private':'web')+' real review uses the designed independent star and picture form',()=>{
  const d={account:'main',id:'order',order:{shop_name:'Shop',shop_cover:'https://lkhlyfpssmrjkkzhuzag.supabase.co/storage/v1/object/public/north-market/'+'a'.repeat(32)+'/cover.jpg'},rating:3,packaging:0,text:'Good',images:[],anonymous:true,uploading:false};const counter={textContent:''},c={northMarketReviewDraft:d,actId:()=> 'main',northMarketBusy:false,northMarketHeader:()=>'',northMarketArgument:s=>JSON.stringify(s),esc:s=>String(s||''),mtGlyph:()=>'<svg/>',document:{getElementById:()=>counter},render(){}};c.window=c;vm.createContext(c);
  vm.runInContext(['function northMarketImage(','function northReviewStarSVG(','function northReviewRatingText(','function northMarketReviewStars(','function northMarketReviewWriteHTML(','window.northMarketReviewDraftField='].map(take).join('\n')+';this.html=northMarketReviewWriteHTML;',c);
  let h=c.html();assert.match(h,/north-write-head/);assert.match(h,/north-write-publish/);assert.match(h,/cover\.jpg/);assert.equal((h.match(/data-star=/g)||[]).length,10);assert.match(h,/type="file" accept="image\/\*"/);assert.match(h,/4\/200/);assert.doesNotMatch(h,/添加视频/);c.northMarketReviewDraftField('text','x'.repeat(250));assert.equal(d.text.length,200);assert.equal(counter.textContent,'200/200字');c.northMarketReviewDraftField('rating',6);assert.equal(d.rating,3);d.uploading=true;assert.match(c.html(),/northMarketReviewSave\(\)" disabled/);c.actId=()=> 'other';assert.doesNotMatch(c.html(),/northMarketReviewSave/);
 });
 test((priv?'private':'web')+' automatic order ETA is the cloud deadline and merchant time validates',()=>{
  const state={name:'Store',category:'Food',tags:[],minimum:0,delivery:190,products:[],deliveryMinutes:30},c={window:{},northSaving:false,northMerchantActive:()=>true,northMerchantView:{draft:state},northMerchantMoney:n=>n*100};vm.createContext(c);vm.runInContext(take('window.northMerchantField=')+'\n'+take('function northMerchantError(')+';this.error=northMerchantError;',c);c.window.northMerchantField('deliveryMinutes','45');assert.equal(state.deliveryMinutes,45);assert.equal(c.error(state,false),'');for(const value of ['',5,121,10.5]){c.window.northMerchantField('deliveryMinutes',value);assert.ok(c.error(state,false));}
 });
 test((priv?'private':'web')+' real utensils require explicit save before PIN or partner authorization',()=>{
  const state={},draft={account:'main',state,utensils:null,roleId:''};let pins=0,requests=0;
  const save={disabled:true},c={window:{},S:state,northMarketPayDraft:draft,northMarketBusy:false,actId:()=> 'main',document:{querySelectorAll:()=>[{classList:{toggle(){}}},{classList:{toggle(){}}}],getElementById:()=>save},northMarketPinOpen:()=>pins++,northMarketRequestCouple:()=>requests++};vm.createContext(c);vm.runInContext(take('window.northMarketUtensils=')+'\n'+take('window.northMarketUtensilSave='),c);
  c.window.northMarketUtensils(false);assert.equal(pins,0);assert.equal(requests,0);assert.equal(save.disabled,false);assert.equal(draft.utensils,false);c.window.northMarketUtensilSave();assert.equal(pins,1);
  draft.roleId='partner';c.window.northMarketUtensils(true);assert.equal(requests,0);c.window.northMarketUtensilSave();assert.equal(requests,1);assert.equal(pins,1);
  draft.utensils=null;c.window.northMarketUtensilSave();assert.equal(requests,1);c.S={};c.window.northMarketUtensils(false);assert.equal(draft.utensils,null);
 });
 test((priv?'private':'web')+' real delivery map uses server status and never local elapsed-time simulation',()=>{
  const c={northMarketStatus:s=>s,esc:s=>String(s||''),fmtDT:s=>s,mtGlyph:()=>'<svg/>',northStage:()=>{throw Error('must not simulate real status');},northMapHint:()=>{throw Error('must not simulate real hint');}};vm.createContext(c);vm.runInContext(take('function northMap(')+'\n'+take('function northMarketProgress(')+';this.progress=northMarketProgress;',c);
  for(const [status,stage] of [['paid',0],['accepted',1],['ready',2],['delivered',3],['completed',3],['cancelled',-1]]){const h=c.progress({status,created_at:0});assert.match(h,new RegExp('data-stage="'+stage+'"'));assert.match(h,/meituan-kangaroo.png/);assert.equal((h.match(/north-track-node/g)||[]).length,4);assert.doesNotMatch(h,/northAdvance|northReceive|\u6a21\u62df\u6d41\u7a0b/);}
 });
 test((priv?'private':'web')+' home refresh pages four cloud shops and wraps without discarding data on failure',async()=>{
  const all=Array.from({length:7},(_,i)=>({id:String(i+1),name:'shop'+i})),requests=[];let render=0;
  const cache={rows:all.slice(0,4),at:1,busy:false,cursor:'4',pageAfter:null,account:'main'},c={window:{},S:{},actId:()=> 'main',northMarketHomeCache:cache,northMarketRemember(){},northMarketView:null,northView:null,northMyView:null,cur:()=>({p:'food'}),render:()=>render++,northMarketRpc:async(n,a)=>{requests.push(a);return{shops:all.filter(s=>!a.p_after||+s.id>+a.p_after).slice(0,a.p_limit)};}};vm.createContext(c);vm.runInContext(take('window.northMarketHomeRefresh='),c);
  await c.window.northMarketHomeRefresh(true);assert.deepEqual(cache.rows.map(s=>s.id),['5','6','7']);assert.equal(requests[0].p_limit,5);assert.equal(requests[0].p_after,'4');await c.window.northMarketHomeRefresh(true);assert.deepEqual(cache.rows.map(s=>s.id),['1','2','3','4']);assert.equal(requests.length,3);assert.equal(render,2);
  c.northMarketRpc=async()=>{throw Error('offline');};await c.window.northMarketHomeRefresh(true);assert.deepEqual(cache.rows.map(s=>s.id),['1','2','3','4']);assert.equal(cache.error,true);assert.equal(cache.busy,false);
  c.northMarketRpc=async()=>{c.actId=()=> 'other';return{shops:all.slice(4)};};await c.window.northMarketHomeRefresh(true);assert.deepEqual(cache.rows.map(s=>s.id),['1','2','3','4']);
 });
}

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js';
 const src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const take=p=>{const line=src.split('\n').find(l=>l.startsWith('  '+p));assert.ok(line,p);return line;};
 test((priv?'private':'web')+' hall cart badge and contents include current cloud rows only',()=>{
  let html='',badge=null;const button={querySelector:()=>badge,appendChild:b=>badge=b};
  const c={S:{food:{cart:[{_northAccount:'main',_northMarket:'cloud',name:'Cake',shop:'Real store',price:12,quantity:2,_northLabels:['cold']},{_northAccount:'other',_northMarket:'other',quantity:9},{_northAccount:'main',offerId:'platform',quantity:8}]}},actId:()=> 'main',deliveryRealEnabled:()=>false,document:{querySelector:()=>button,createElement:()=>({remove(){badge=null;}})},northSimulationCartRows:()=>[],northMarketArgument:id=>JSON.stringify(id).replace(/"/g,'&quot;'),northCents:n=>n*100,money:n=>n.toFixed(2),esc:n=>String(n||''),openModal:h=>html=h};c.window=c;vm.createContext(c);
  const visible=src.split('\n').find(l=>l.startsWith('  function northVisibleCartRows()'))||'';
  vm.runInContext(visible+';'+take('function mtPaintCart()')+';this.paint=mtPaintCart;',c);c.paint();assert.equal(badge.textContent,'2');
  vm.runInContext(take('window.northSimulationCart='),c);c.northSimulationCart();assert.match(html,/Cake/);assert.match(html,/northMarketOpen/);assert.doesNotMatch(html,/\u8d2d\u7269\u8f66\u662f\u7a7a\u7684/);
  c.S.food.cart.shift();c.paint();assert.equal(badge,null);c.northSimulationCart();assert.match(html,/\u8d2d\u7269\u8f66\u662f\u7a7a\u7684/);
 });
 test((priv?'private':'web')+' cloud gift shortcut explains missing partner without adding or charging',async()=>{
  let message='',adds=0;const c={window:{},northSaving:false,northMarketBusy:false,northMarketCoupleRole:()=>null,toast:m=>message=m,northMarketAdd:()=>adds++};vm.createContext(c);vm.runInContext(take('window.northMarketSpecAction='),c);await c.window.northMarketSpecAction('gift');assert.match(message,/\u60c5\u4fa3/);assert.equal(adds,0);
 });
 test((priv?'private':'web')+' hosted no-code preview rejects cloud add before altering the cart',async()=>{let text='',writes=0;const c={window:{},northSaving:false,northMarketBusy:false,northMarketSpecDraft:{account:'main',quote:{total:1200,labels:[]},product:{id:'p',name:'Cake'},shop:{id:'s',name:'Shop'},selections:{},quantity:1},actId:()=> 'main',NORTH_PREVIEW:true,location:{hostname:'example.com'},toast:m=>text=m,S:{food:{cart:[]}},northMarketCartRows:()=>[],uid:()=> 'r',northCommit:()=>{writes++;return false;}};vm.createContext(c);vm.runInContext(take('window.northMarketAdd='),c);assert.equal(await c.window.northMarketAdd(),false);assert.match(text,/\u9884\u89c8/);assert.equal(writes,0);assert.equal(c.S.food.cart.length,0);});
}

export const transactionSQL=String.raw`
do $test$
declare seller text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));
 outsider text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));
 sid uuid:=gen_random_uuid();uid uuid:=gen_random_uuid();shop uuid;req uuid:=gen_random_uuid();
 catalog jsonb;lines jsonb;result jsonb;failed boolean;balance bigint;
begin
 insert into public.phone_friend_profiles(phone_id,secret_hash,display_name,allow_search) values
 (seller,public.phone_friend_hash('bulk-test-secret'),'批量补货验收',false),
 (outsider,public.phone_friend_hash('bulk-test-secret'),'隔离验收',false);
 insert into public.phone_licenses(id,status,phone_friend_id) values(sid,'active',seller),(uid,'active',outsider);
 catalog:=jsonb_build_object('name','批量事务店','category','美食、甜点饮品','intro','','cover','',
 'minimum',0,'delivery',190,'published',true,'groups',jsonb_build_array(jsonb_build_object('id','cakes','name','蛋糕')),
 'products',jsonb_build_array(
 jsonb_build_object('id','a','name','草莓蛋糕','groupId','cakes','price',2000,'unit','份','description','','image','','available',true,'signature',true,'specGroups',jsonb_build_array(jsonb_build_object('id','heat','name','温度','mode','single','required',true,'options',jsonb_build_array(jsonb_build_object('id','cold','label','冰的','price',0),jsonb_build_object('id','warm','label','温的','price',100))))),
 jsonb_build_object('id','b','name','椰子蛋糕','groupId','cakes','price',1500,'unit','份','description','','image','','available',true,'signature',false,'specGroups','[]'::jsonb)));
 shop:=(public.north_market_save_shop(seller,'bulk-test-secret',0,catalog)->>'id')::uuid;
 perform public.north_market_claim(seller,'bulk-test-secret');perform public.north_market_claim(outsider,'bulk-test-secret');
 lines:=jsonb_build_array(jsonb_build_object('shopId',shop,'productId','a','quantity',3,'expected',2400),jsonb_build_object('shopId',shop,'productId','b','quantity',3,'expected',1800));
 result:=public.north_market_stock_batch(seller,'bulk-test-secret',lines,'wallet',req,'11111',4200);
 if result->>'ok'<>'false' then raise exception 'FAIL incorrect PIN';end if;
 if (public.north_market_wallet(seller,'bulk-test-secret')->>'balance')::bigint<>50000 then raise exception 'FAIL PIN debited';end if;
 perform public.north_market_stock_batch(seller,'bulk-test-secret',lines,'wallet',req,'00000',4200);
 perform public.north_market_stock_batch(seller,'bulk-test-secret',jsonb_build_array(lines->1,lines->0),'wallet',req,'00000',4200);
 if (public.north_market_wallet(seller,'bulk-test-secret')->>'balance')::bigint<>45800 or (select sum(quantity) from public.north_market_stock where shop_id=shop)<>6 then raise exception 'FAIL atomic replay';end if;
 failed:=false;begin perform public.north_market_stock_batch(seller,'bulk-test-secret',lines,'income',req,'00000',4200);exception when raise_exception then failed:=SQLERRM='market-request-reused';end;if not failed then raise exception 'FAIL reused request';end if;
 failed:=false;begin perform public.north_market_stock_batch(outsider,'bulk-test-secret',lines,'wallet',gen_random_uuid(),'00000',4200);exception when raise_exception then failed:=SQLERRM='market-shop-unavailable';end;if not failed then raise exception 'FAIL unauthorized stock';end if;
 failed:=false;begin perform public.north_market_stock_batch(seller,'bulk-test-secret',jsonb_build_array(lines->0,lines->0),'wallet',gen_random_uuid(),'00000',4800);exception when raise_exception then failed:=SQLERRM='market-invalid-stock-request';end;if not failed then raise exception 'FAIL duplicates';end if;
 failed:=false;begin perform public.north_market_stock_batch(seller,'bulk-test-secret',jsonb_build_array(lines->0,(lines->1)||jsonb_build_object('expected',1)),'wallet',gen_random_uuid(),'00000',2401);exception when raise_exception then failed:=SQLERRM='market-price-changed';end;if not failed then raise exception 'FAIL changed price';end if;
 if (public.north_market_wallet(seller,'bulk-test-secret')->>'balance')::bigint<>45800 or (select sum(quantity) from public.north_market_stock where shop_id=shop)<>6 then raise exception 'FAIL partial debit or stock';end if;
 update public.north_market_wallets set balance=3000,income=4200 where owner_id=sid::text;
 failed:=false;begin perform public.north_market_stock_batch(seller,'bulk-test-secret',lines,'wallet',gen_random_uuid(),'00000',4200);exception when raise_exception then failed:=SQLERRM='market-insufficient-funds';end;if not failed then raise exception 'FAIL insufficient total funds';end if;
 if (select sum(quantity) from public.north_market_stock where shop_id=shop)<>6 then raise exception 'FAIL partial affordable line';end if;
 perform public.north_market_stock_batch(seller,'bulk-test-secret',lines,'income',gen_random_uuid(),'00000',4200);
 if (public.north_market_wallet(seller,'bulk-test-secret')->>'balance')::bigint<>3000 or (public.north_market_wallet(seller,'bulk-test-secret')->>'income')::bigint<>0 then raise exception 'FAIL funding source';end if;
 update public.north_market_stock set quantity=9999 where shop_id=shop and product_id='b';
 failed:=false;begin perform public.north_market_stock_batch(seller,'bulk-test-secret',lines,'wallet',gen_random_uuid(),'00000',4200);exception when raise_exception then failed:=SQLERRM='market-stock-limit';end;if not failed then raise exception 'FAIL stock limit';end if;
 if (select quantity from public.north_market_stock where shop_id=shop and product_id='a')<>6 then raise exception 'FAIL stock limit partial success';end if;
 if not exists(select 1 from jsonb_array_elements(public.north_market_list('美食',null,9)->'shops')x where x->>'id'=shop::text) then raise exception 'FAIL quick category search';end if;
 result:=public.north_market_quote(shop,1,jsonb_build_array(jsonb_build_object('productId','a','quantity',1,'selections',jsonb_build_object('heat',jsonb_build_array('warm')))));
 if (result->>'subtotal')::integer<>2100 then raise exception 'FAIL live edited specs price';end if;
 raise notice 'PASS batch ownership, PIN, replay, original source, whole-batch rollback, stock limit, category search and live edited specifications';
end $test$;
`;

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js';
 const src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 function fn(prefix){const line=src.split('\n').find(l=>l.startsWith('  '+prefix));assert.ok(line,'missing '+prefix);return line;}
 const title=priv?'private':'web';
 test(title+' shop preview returns to hall unless it was opened from the editor',()=>{let back=0,editor=0;const c={northMerchantActive:()=>true,northMerchantView:{returnToEditor:false,dirty:false},northProductEdit:{},northMerchantLineDraft:{},northBack:()=>back++,northMerchantEditor:()=>editor++};c.window=c;vm.createContext(c);vm.runInContext(fn('window.northMerchantPreviewBack='),c);c.northMerchantPreviewBack();assert.equal(back,1);assert.equal(c.northMerchantView,null);c.northMerchantView={returnToEditor:true,dirty:true};c.northMerchantPreviewBack();assert.equal(editor,1);assert.equal(c.northMerchantView.dirty,true);});
 test(title+' real store uses grouped tea-shop layout with complete catalogue and sold-out protection',()=>{
  const v={shop:{id:'shop',name:'蛋糕店',minimum:2500,delivery:190,groups:[{id:'cakes',name:'蛋糕'},{id:'food',name:'主食'}]},products:Array.from({length:50},(_,i)=>({id:'p'+i,name:'商品'+i,price:1500,stock:i?3:0,soldOut:!i,unit:'份',groupId:i%2?'food':'cakes',signature:i===1}))};
  const c={northMarketAttr:x=>String(x),northMarketArgument:x=>JSON.stringify(x).replace(/"/g,'&quot;'),northMarketCartRows:()=>[],northMarketHeader:()=>'',northFavoriteButton:()=>'',northMarketImage:()=>'<img>',northSignatureBadge:()=>'',northCartMascot:()=>'',northCents:x=>x*100,money:x=>x.toFixed(2),esc:x=>String(x||'')};vm.createContext(c);vm.runInContext(fn('function northShareButton()')+';'+fn('function northMarketStoreHTML(v)')+';this.store=northMarketStoreHTML;',c);
  let html=c.store(v);assert.match(html,/north-menu-layout/);assert.match(html,/蛋糕/);assert.equal((html.match(/class="north-drink(?: north-soldout)?"/g)||[]).length,50);assert.match(html,/disabled>选规格/);assert.doesNotMatch(html,/下一批商品|自取/);
  v.group='cakes';html=c.store(v);assert.equal((html.match(/class="north-drink(?: north-soldout)?"/g)||[]).length,50);assert.equal((html.match(/data-cloud-group="food" hidden/g)||[]).length,25);
 });
 test(title+' bulk quote validates the whole list before offering a debit',()=>{
  const c={};vm.createContext(c);vm.runInContext(fn('function northBusinessBatchQuote(rows,quantity)')+';this.quote=northBusinessBatchQuote;',c);
  const rows=[{shop_id:'s',product_id:'a',sale_price:2000,quantity:3},{shop_id:'s',product_id:'b',sale_price:1500,quantity:1}];assert.equal(c.quote(rows,3).total,4200);assert.equal(c.quote(rows,0),null);assert.equal(c.quote(rows,1.5),null);assert.equal(c.quote([...rows,rows[0]],3),null);assert.equal(c.quote([{...rows[0],quantity:9999}],1),null);assert.equal(c.quote([{...rows[0],sale_price:NaN}],1),null);
 });
 test(title+' quick shop tags toggle persistable searchable categories without overwriting unrelated fields',()=>{
  let rendered=0;const c={northQuickCategories:['美食','甜点饮品'],northMerchantActive:()=>true,northSaving:false,northMerchantView:{draft:{category:'其他',name:'My shop',products:[{specGroups:[]}]},dirty:false},render:()=>rendered++,toast(){}};c.window=c;vm.createContext(c);vm.runInContext(fn('window.northMerchantQuickTag='),c);c.northMerchantQuickTag(0);c.northMerchantQuickTag(1);assert.equal(c.northMerchantView.draft.category,'美食、甜点饮品');c.northMerchantQuickTag(0);assert.equal(c.northMerchantView.draft.category,'甜点饮品');assert.equal(c.northMerchantView.draft.name,'My shop');assert.equal(rendered,3);
 });
}

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js';
 test((priv?'private':'web')+' AI shop uses grouped ordering layout and only checks out its own cart',()=>{
  const src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const take=p=>src.split('\n').find(l=>l.startsWith('  '+p));
  const products=[{name:'\u86cb\u7cd5',shop:'\u86cb\u7cd5\u5e97',price:8,_northResultId:'a'},{name:'\u5e03\u4e01',shop:'\u86cb\u7cd5\u5e97',price:6,_northResultId:'b'}];
  const rows=[{shop:'\u86cb\u7cd5\u5e97',price:8,quantity:1,_northGeneric:true},{shop:'\u522b\u7684\u5e97',price:10,_northGeneric:true}];
  let checkout;const c={northSimulationShop:{account:'me',name:'\u86cb\u7cd5\u5e97',items:products},actId:()=> 'me',S:{food:{results:products}},northPersonalHeader:()=>'',northFavoriteButton:()=>'',northShopFigures:()=>'',northSignatureBadge:()=>'',northCartMascot:()=>'',mtMedia:()=>'<img>',northSimulationCartRows:()=>rows,northCents:n=>n*100,money:n=>n.toFixed(2),esc:n=>String(n||''),northMarketArgument:n=>JSON.stringify(n).replace(/"/g,'&quot;'),deliveryRealEnabled:()=>false,northSaving:false,northCheckout:r=>checkout=r,toast(){}};c.window=c;vm.createContext(c);
  vm.runInContext(take('function northAIShopPage()')+';this.page=northAIShopPage;',c);const html=c.page();assert.match(html,/north-menu-layout/);assert.match(html,/north-drink-image/);assert.match(html,/north-checkout-button/);assert.match(html,/\u65e0\u8d77\u9001\u4ef7/);assert.equal((html.match(/class="north-drink"/g)||[]).length,2);
  vm.runInContext(take('window.northAIShopCheckout='),c);c.northAIShopCheckout();assert.equal(checkout.length,1);assert.equal(checkout[0].shop,'\u86cb\u7cd5\u5e97');
 });
}

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js',src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const take=p=>src.split('\n').find(l=>l.startsWith('  '+p));
 test((priv?'private':'web')+' published own shop occurs once above other real shops and opens cloud catalogue',()=>{
  const own={id:'local',name:'North甜品店',marketId:'cloud-own',marketPublished:true,status:'open',products:[],tags:[]};let opened,preview=0;
  const c={actId:()=> 'main',northMerchantSaved:()=>own,northOwnShopHomeHTML:()=>'<section>North甜品店</section>',northMarketStoreCards:r=>r.map(p=>p.name).join(','),northMarketHomeCache:{busy:false,at:Date.now(),rows:[{id:'cloud-own',name:own.name},{id:'cloud-other',name:'朋友的店'}]},Date,northMarketOpen:id=>opened=id,northMerchantPreview:()=>preview++,deliveryRealEnabled:()=>false};c.window=c;vm.createContext(c);
  vm.runInContext(take('function northMarketHomeHTML()')+';this.home=northMarketHomeHTML;',c);const html=c.home();assert.equal((html.match(/North甜品店/g)||[]).length,1);assert(html.indexOf('North甜品店')<html.indexOf('真人店铺'));assert.match(html,/朋友的店/);
  assert(take('window.northOwnShopOpen='));vm.runInContext(take('window.northOwnShopOpen='),c);c.northOwnShopOpen();assert.equal(opened,'cloud-own');assert.equal(preview,0);
 });
 test((priv?'private':'web')+' each merchant product exposes a direct editable specification entry',()=>{
  const c={northMerchantView:{draft:{groups:[{id:'g',name:'甜品'}],products:[{id:'cake',name:'蛋糕',groupId:'g',price:1500,specGroups:[],available:true}]}},mtMedia:()=>'',northSignatureBadge:()=>'',money:n=>n.toFixed(2),esc:n=>String(n||''),northMarketArgument:n=>JSON.stringify(n).replace(/"/g,'&quot;')};vm.createContext(c);vm.runInContext(take('function northMarketAttr(')+take('function northMerchantProductsHTML()')+';this.products=northMerchantProductsHTML;',c);assert.match(c.products(),/northMerchantProductSpecs/);assert.match(c.products(),/编辑规格/);
 });
}

for(const priv of [false,true]){
 const base=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/':'',src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+base+'commerce-ui.js'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+base+'commerce-ui.js',import.meta.url),'utf8');
 test((priv?'private':'web')+' local preview retains full storefront tabs and grouped product ordering',()=>{
  const shop={id:'local',name:'甜品店',category:'甜品',tags:[],status:'open',minimum:1500,delivery:190,groups:[{id:'g',name:'蛋糕'}],products:[{id:'cake',groupId:'g',name:'蛋糕',price:1500,available:true}]};
  const c={northMerchantView:{draft:shop,dirty:false,group:'all',tab:'menu'},actId:()=> 'me',mtGlyph:()=>'',mtMedia:()=>'<img>',northSignatureBadge:()=>'',northFavoriteButton:()=>'',northShopFigures:()=>'',northMerchantReviews:()=>'',northMarketAttr:n=>String(n||''),northMerchantCartbar:()=>'',northMarketArgument:n=>JSON.stringify(n).replace(/"/g,'&quot;'),money:n=>n.toFixed(2),esc:n=>String(n||'')};vm.createContext(c);vm.runInContext(src.split('\n').find(l=>l.startsWith('  function northShareButton()'))+';'+src.split('\n').find(l=>l.startsWith('  function northMerchantPreviewRender()'))+';this.page=northMerchantPreviewRender;',c);const html=c.page();assert.match(html,/north-info/);assert.match(html,/north-tabs/);assert.match(html,/north-menu-layout/);assert.match(html,/northMerchantPreviewTab/);
 });
 test((priv?'private':'web')+' cohab settings expose existing date-scoped chat deletion without executing deletion',()=>{
  const app=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+base+'app.js'],{encoding:'utf8',maxBuffer:12e6}):fs.readFileSync(new URL('../'+base+'app.js',import.meta.url),'utf8');
  const line=app.split('\n').find(l=>l.startsWith('function cohabSettingsPanel('));const c={cohabSettings:()=>({}),cohabSettingsBrief:()=>'',getC:()=>null,cohabTogetherScene:()=>false,CHAT_ROUTE_NAMES:[],esc:n=>String(n||''),roleScheduleBrief:()=>'',_offSel:null};vm.createContext(c);vm.runInContext(line+';this.panel=cohabSettingsPanel;',c);assert.match(c.panel('role',{summaries:[]}),/cohab-history-delete[^>]*offDelHistory/);assert.match(app,/function offHistMatch/);assert.match(app,/删除一天前的记录/);assert.match(app,/删除三天前的记录/);assert.match(app,/删除这一天的记录/);
 });
}

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js',src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),take=p=>src.split('\n').find(l=>l.startsWith('  '+p));
 test((priv?'private':'web')+' shop default specs are isolated and cloned for new products',()=>{
  assert(take('function northMerchantDefaultSpecs('));const c={};vm.createContext(c);vm.runInContext(take('function northMerchantDefaultSpecs(')+';this.specs=northMerchantDefaultSpecs;',c);
  const a={defaultSpecGroups:[{id:'heat',name:'温度',options:[{id:'warm',label:'温的',price:0}]}]},b={defaultSpecGroups:[{id:'spice',name:'辣度',options:[]}]},copy=c.specs(a);copy[0].options[0].label='修改';assert.equal(a.defaultSpecGroups[0].options[0].label,'温的');assert.equal(c.specs(b)[0].name,'辣度');assert.match(take('window.northMerchantProductEdit='),/specGroups:northMerchantDefaultSpecs\(d\)/);
 });
 test((priv?'private':'web')+' applying shop specs requires confirmation and never changes other shop or product fields',async()=>{
  assert(take('window.northMerchantSpecsApply='));const d={groups:[{id:'g'}],products:[{id:'a',name:'蛋糕',price:1500,image:'cake.jpg',specGroups:[]},{id:'b',name:'奶茶',price:2000,image:'tea.jpg',specGroups:[]}]},other={defaultSpecGroups:[{name:'别店规格'}]};let yes=false,closed=0;
  const c={northSaving:false,northMerchantView:{account:'me',nonce:'view',draft:d,dirty:false},northProductEdit:{product:{specGroups:[{id:'heat',name:'温度',mode:'single',required:true,options:[{id:'warm',label:'温的',price:0}]}]}},northProductActive:()=>true,northMerchantProductError:()=>'',actId:()=> 'me',uiConfirm:async()=>yes,closeModal:()=>closed++,render(){},toast(){}};c.window=c;vm.createContext(c);vm.runInContext(take('window.northMerchantSpecsApply='),c);await c.northMerchantSpecsApply();assert.equal(d.products[0].specGroups.length,0);yes=true;await c.northMerchantSpecsApply();assert.equal(closed,1);assert.equal(d.products[1].specGroups[0].name,'温度');assert.equal(d.products[0].price,1500);assert.equal(d.products[1].image,'tea.jpg');d.products[0].specGroups[0].name='单品修改';assert.equal(d.products[1].specGroups[0].name,'温度');assert.equal(d.defaultSpecGroups[0].name,'温度');assert.equal(other.defaultSpecGroups[0].name,'别店规格');
 });
}

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js';
 const src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(file,'utf8');
 const take=prefix=>{const line=src.split('\n').find(l=>l.startsWith('  '+prefix));assert.ok(line,'missing '+prefix);return line;};
 function context(){const p={id:'tea',name:'自由命名饮品',price:2200,unit:'杯',stock:5,specGroups:[{id:'size',name:'杯型',mode:'single',required:true,totalPrice:true,options:[{id:'standard',label:'标准杯',price:0,default:true},{id:'large',label:'大杯',price:300}]},{id:'heat',name:'温度',mode:'single',required:true,options:[{id:'cold',label:'冰的',price:0},{id:'less',label:'少冰',price:0,default:true},{id:'warm',label:'温的',price:0}]},{id:'extra',name:'自由加料',display:'cards',mode:'multiple',required:false,options:[{id:'green',label:'抹茶小丸',price:200,image:'idb:photo',recommended:true},{id:'taro',label:'彩虹芋圆',price:300,image:'idb:photo'}]}]};const c={window:{},money:n=>n.toFixed(2),esc:String,northMarketAttr:n=>String(n).replace(/"/g,'&quot;'),northMarketArgument:n=>JSON.stringify(n).replace(/"/g,'&quot;'),northMarketImage:(src,name)=>'<img src="'+src+'" alt="'+name+'">',mtMedia:p=>'<img src="'+p.imageUrl+'">',northSignatureBadge:()=>'',northFavoriteButton:()=>'<button>收藏</button>',northMarketCoupleRole:()=>({id:'partner'}),p};vm.createContext(c);return c;}
 test((priv?'private':'web')+' storefront spec dialog renders free chips, total prices, optional image cards and all three footer actions',()=>{const c=context();vm.runInContext(take('function northSpecDefaults(')+'\n'+take('function northSpecGroupsHTML(')+'\n'+take('function northSpecDialogHTML(')+'\n'+take('function northMerchantQuote('),c);const h=c.northSpecDialogHTML(c.p,true,true,{id:'shop'});assert.match(h,/north-spec-layout/);assert.match(h,/标准杯 · ¥22/);assert.match(h,/大杯 · ¥25/);assert.match(h,/自由加料/);assert.match(h,/彩虹芋圆/);assert.match(h,/north-extra-grid/);assert.match(h,/推荐/);assert.match(h,/我给角色点/);assert.match(h,/让角色代付/);assert.doesNotMatch(h,/<h4>份量<\/h4>/);const selections=c.northSpecDefaults(c.p);assert.equal(c.northMerchantQuote(c.p,selections,1).total,2200);selections.extra=['green','taro'];assert.equal(c.northMerchantQuote(c.p,selections,2).total,5400);c.p.specGroups=c.p.specGroups.slice(0,2);const noExtra=c.northSpecDialogHTML(c.p,false,true,{id:'shop'});assert.doesNotMatch(noExtra,/north-extra-grid|自由加料|抹茶小丸/);});
 test((priv?'private':'web')+' store owner can change display, default selection and recommendation without tying fields to tea',()=>{const c=context();c.northProductEdit={product:c.p};c.northProductActive=()=>true;c.northMerchantMoney=n=>Math.round(Number(n)*100);c.northMerchantRefreshSpecs=()=>{};c.window=c;vm.runInContext(take('window.northMerchantOptionField=')+'\n'+take('window.northMerchantSpecField=')+'\n'+take('function northMerchantSpecEditorHTML('),c);c.northMerchantOptionField('size','large','default',true);assert.equal(c.p.specGroups[0].options[0].default,false);assert.equal(c.p.specGroups[0].options[1].default,true);c.northMerchantOptionField('extra','green','recommended',false);assert.equal(c.p.specGroups[2].options[0].recommended,false);c.northMerchantSpecField('extra','name','加菜');c.northMerchantSpecField('extra','display','cards');const h=c.northMerchantSpecEditorHTML();for(const label of ['展示形式','两列图片卡片','默认选中','推荐标记','上传选项图片','加菜'])assert.ok(h.includes(label));});
 test((priv?'private':'web')+' cloud spec shortcut retains cart selection and stops after a failed or switched add',async()=>{const partner={id:'p'},draft={account:'main',quote:{},shop:{id:'s'}},calls=[];const c={window:{},northSaving:false,northMarketBusy:false,northMarketSpecDraft:draft,actId:()=> 'main',northMarketCoupleRole:()=>partner,northMarketAdd:async()=>{calls.push('add');return true;},northMarketCheckout:async()=>{calls.push('checkout');c.northMarketPayDraft={account:'main',quote:{shopId:'s'}};},northMarketGiftSelect:()=>calls.push('gift'),northMarketFunding:()=>calls.push('role'),northMarketPaymentMethods:()=>calls.push('methods')};vm.createContext(c);vm.runInContext(take('window.northMarketSpecAction='),c);await c.window.northMarketSpecAction('gift');assert.deepEqual(calls,['add','checkout','gift']);calls.length=0;c.northMarketAdd=async()=>false;await c.window.northMarketSpecAction('pay');assert.deepEqual(calls,[]);c.northMarketAdd=async()=>{c.actId=()=> 'other';return true;};await c.window.northMarketSpecAction('pay');assert.deepEqual(calls,[]);});
 test((priv?'private':'web')+' option pictures and same-shop templates publish as one deduplicated public image rather than local IDB refs',async()=>{const source={cover:'',products:[{image:'',specGroups:[{id:'extras',options:[{image:'idb:photo'}]}]}],defaultSpecGroups:[{id:'extras',options:[{image:'idb:photo'}]}]};let uploads=0,published;const c={window:{},S:{},northMarketBusy:false,northMerchantView:{dirty:false},northMerchantActive:()=>true,northMerchantSaved:()=>source,actId:()=> 'main',northMarketEnsure:async()=>{},northMerchantDefaultSpecs:p=>JSON.parse(JSON.stringify(p.defaultSpecGroups)),northMarketRpc:async(name,args)=>{if(name==='mine')return {imageFolder:'a'.repeat(32),shop:null};published=args.p_shop;return {id:'shop',revision:1,published:true};},imgGet:async()=> 'data:image/jpeg;base64,YQ==',fetch:async()=>({blob:async()=>({size:1,type:'image/jpeg'})}),compress:async()=> 'data:image/jpeg;base64,YQ==',crypto:{randomUUID:()=> 'one-image'},phoneFriendState:()=>({id:'phone',secret:'test'}),pfHeaders:()=>({}),GATE_URL:'https://lkhlyfpssmrjkkzhuzag.supabase.co',fetchT:async()=>{uploads++;return {ok:true};},saveNowAsync:async()=>true,render(){},toast(){}};vm.createContext(c);const begin=src.indexOf('  window.northMarketPublish=async function('),end=src.indexOf('\n  };',begin)+6;assert.ok(begin>=0&&end>begin);vm.runInContext(src.slice(begin,end),c);await c.window.northMarketPublish(true);assert.equal(uploads,1);assert.match(published.products[0].specGroups[0].options[0].image,/^https:/);assert.equal(published.products[0].specGroups[0].options[0].image,published.products[0]._northStoreSpecTemplate[0].options[0].image);assert.doesNotMatch(JSON.stringify(published),/idb:photo/);});
}

export const deliverySQL=String.raw`
do $test$
declare seller text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));buyer text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));stranger text:='SP'||upper(substr(md5(gen_random_uuid()::text),1,8));sid uuid:=gen_random_uuid();bid uuid:=gen_random_uuid();xid uuid:=gen_random_uuid();shop uuid;oid uuid;scheduled uuid;legacy uuid;r jsonb;cover text;lines jsonb;balance bigint;bad boolean;
begin
 insert into public.phone_friend_profiles(phone_id,secret_hash,display_name,allow_search) values(seller,public.phone_friend_hash('cover-test-secret'),'Cover seller',false),(buyer,public.phone_friend_hash('cover-test-secret'),'Cover buyer',false),(stranger,public.phone_friend_hash('cover-test-secret'),'Other buyer',false);
 insert into public.phone_licenses(id,status,phone_friend_id) values(sid,'active',seller),(bid,'active',buyer),(xid,'active',stranger);
 cover:='https://lkhlyfpssmrjkkzhuzag.supabase.co/storage/v1/object/public/north-market/'||md5(sid::text)||'/cover.jpg';
 shop:=(public.north_market_save_shop(seller,'cover-test-secret',0,jsonb_build_object('name','Cover shop','category','Food','cover',cover,'minimum',0,'delivery',190,'deliveryMinutes',45,'published',true,'groups',jsonb_build_array(jsonb_build_object('id','g','name','Cake')),'products',jsonb_build_array(jsonb_build_object('id','p','name','Cake','groupId','g','price',2000,'unit','portion','description','','image','','available',true,'signature',false,'specGroups','[]'::jsonb))))->>'id')::uuid;
 perform public.north_market_claim(seller,'cover-test-secret');perform public.north_market_claim(buyer,'cover-test-secret');
 perform public.north_market_stock_batch(seller,'cover-test-secret',jsonb_build_array(jsonb_build_object('shopId',shop,'productId','p','quantity',6,'expected',4800)),'wallet',gen_random_uuid(),'00000',4800);
 lines:=jsonb_build_array(jsonb_build_object('productId','p','quantity',1,'selections','{}'::jsonb));
 r:=public.north_market_order_create(buyer,'cover-test-secret',gen_random_uuid(),shop,1,lines,jsonb_build_object('address','Test','name','Buyer'),false,'','',0,'00000',2190,null);oid:=(r->'order'->>'id')::uuid;
 if (public.north_market_orders(buyer,'cover-test-secret')->'orders'->0->>'shop_cover') is distinct from cover then raise exception 'FAIL buyer shop cover';end if;
 if (public.north_market_orders(seller,'cover-test-secret',true)->'orders'->0->>'shop_cover') is distinct from cover then raise exception 'FAIL seller shop cover';end if;
 if jsonb_array_length(public.north_market_orders(stranger,'cover-test-secret')->'orders')<>0 then raise exception 'FAIL outsider orders';end if;
 bad:=false;begin perform public.north_market_order(stranger,'cover-test-secret',oid);exception when raise_exception then bad:=SQLERRM='market-order-unavailable';end;if not bad then raise exception 'FAIL outsider detail';end if;
 update public.north_market_shops set published=false where id=shop;
 if (public.north_market_order(buyer,'cover-test-secret',oid)->'order'->>'shop_cover') is distinct from cover then raise exception 'FAIL unpublished cover';end if;
 update public.north_market_shops set published=true where id=shop;
 if not exists(select 1 from public.north_market_orders where id=oid and delivery_minutes=45 and auto_delivery_at=created_at+interval '45 minutes') then raise exception 'FAIL due snapshot';end if;
 bad:=false;begin perform public.north_market_order_status(buyer,'cover-test-secret',oid,'completed');exception when raise_exception then bad:=SQLERRM='market-delivery-time-not-reached';end;if not bad then raise exception 'FAIL early complete';end if;
 update public.north_market_orders set auto_delivery_at=now()+interval '43 minutes' where id=oid;perform public.north_market_auto_deliver();if (select status from public.north_market_orders where id=oid)<>'accepted' then raise exception 'FAIL accepted phase';end if;
 update public.north_market_orders set auto_delivery_at=now()+interval '20 minutes' where id=oid;perform public.north_market_auto_deliver();if (select status from public.north_market_orders where id=oid)<>'ready' then raise exception 'FAIL ready phase';end if;
 balance:=(public.north_market_wallet(seller,'cover-test-secret')->>'income')::bigint;
 update public.north_market_orders set auto_delivery_at=now()-interval '1 minute' where id=oid;perform public.north_market_auto_deliver();perform public.north_market_auto_deliver();
 if (select status from public.north_market_orders where id=oid)<>'completed' or (public.north_market_wallet(seller,'cover-test-secret')->>'income')::bigint<>balance+2000 or (select count(*) from public.north_market_ledger where order_id=oid and kind='income')<>1 then raise exception 'FAIL one settlement';end if;
 if not exists(select 1 from jsonb_array_elements(public.north_market_notifications(buyer,'cover-test-secret')->'deliveries') x where x->>'id'=oid::text) then raise exception 'FAIL arrival notice';end if;
 bad:=false;begin perform public.north_market_order_status(seller,'cover-test-secret',oid,'cancelled');exception when raise_exception then bad:=SQLERRM='market-completed-order-no-refund';end;if not bad then raise exception 'FAIL completed refund';end if;
 perform public.north_market_review_save(buyer,'cover-test-secret',oid,0,jsonb_build_object('rating',5,'packaging',4,'anonymous',true,'text','Good','images','[]'::jsonb));
 r:=public.north_market_order_create(buyer,'cover-test-secret',gen_random_uuid(),shop,1,lines,jsonb_build_object('address','Test','name','Buyer','scheduledAt',now()+interval '1 day'),false,'','',0,'00000',2190,null);scheduled:=(r->'order'->>'id')::uuid;
 if not exists(select 1 from public.north_market_orders where id=scheduled and auto_delivery_at=scheduled_at) then raise exception 'FAIL scheduled deadline';end if;perform public.north_market_auto_deliver();if (select status from public.north_market_orders where id=scheduled)<>'paid' then raise exception 'FAIL early scheduled phase';end if;
 perform public.north_market_order_status(buyer,'cover-test-secret',scheduled,'cancelled');update public.north_market_orders set auto_delivery_at=now()-interval '1 minute' where id=scheduled;perform public.north_market_auto_deliver();if (select status from public.north_market_orders where id=scheduled)<>'cancelled' then raise exception 'FAIL cancelled advanced';end if;
 r:=public.north_market_order_create(buyer,'cover-test-secret',gen_random_uuid(),shop,1,lines,jsonb_build_object('address','Test','name','Buyer'),false,'','',0,'00000',2190,null);legacy:=(r->'order'->>'id')::uuid;update public.north_market_orders set auto_delivery_at=null,delivery_minutes=null where id=legacy;perform public.north_market_auto_deliver();if (select status from public.north_market_orders where id=legacy)<>'paid' then raise exception 'FAIL historical auto completion';end if;
 if has_function_privilege('anon','public.north_market_auto_deliver()','EXECUTE') or has_function_privilege('authenticated','public.north_market_auto_deliver()','EXECUTE') then raise exception 'FAIL exposed settlement job';end if;
 raise notice 'PASS cover authorization, unpublishing, deadline, auto phases, one settlement, arrival, review, refund, scheduled/cancelled/legacy isolation';
end $test$;
`;

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js';
 const src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const take=p=>src.split('\n').find(l=>l.startsWith('  '+p))||'';
 test((priv?'private':'web')+' cloud return never pushes duplicate food pages and repeated return is inert',()=>{
  let paints=0;const routes=[{p:'home'},{p:'food'}],c={northMarketEpoch:1,northMarketView:{page:'store'},northMarketBusy:true,northMarketOrigin:null,northPersonalView:null,northMyView:null,stack:routes,cur:()=>routes.at(-1),render:()=>paints++,closeModal(){},go:(p,a)=>routes.push({p,...a}),back:()=>{routes.pop();paints++;}};c.window=c;vm.createContext(c);vm.runInContext(take('window.northMarketClose='),c);
  c.northMarketClose();assert.equal(routes.length,2);assert.equal(c.northMarketView,null);assert.equal(c.northMarketBusy,false);assert.equal(paints,1);c.northMarketClose();assert.equal(routes.length,2);assert.equal(paints,1);
  routes.splice(1,1,{p:'chat',id:'role'},{p:'food'});c.northMarketView={page:'order'};c.northMarketOrigin={p:'chat',id:'role'};c.northMarketClose();assert.deepEqual(routes.at(-1),{p:'chat',id:'role'});assert.equal(routes.length,2);assert.equal(c.northMarketOrigin,null);
 });
 test((priv?'private':'web')+' leaving a loading shop ignores its delayed reply without reopening or repainting',async()=>{
  let resolve,paints=0;const routes=[{p:'home'},{p:'food'}],c={actId:()=> 'main',northMarketEnter:()=>true,northMarketEpoch:0,northMarketView:null,northMarketBusy:false,northMarketOrigin:null,northPersonalView:null,northMyView:null,stack:routes,cur:()=>routes.at(-1),render:()=>paints++,closeModal(){},go:p=>routes.push({p}),back:()=>routes.pop(),northMarketPageGet:()=>null,northMarketPagePut(){},northMarketPageReset(){},northMarketPagePaint:()=>paints++,northMarketRemember(){},northMarketRpc:()=>new Promise(r=>resolve=r)};c.window=c;vm.createContext(c);vm.runInContext(take('function northMerchantOrderedProducts(')+src.slice(src.indexOf('  window.northMarketOpen='),src.indexOf('  window.northMarketProductPage='))+take('window.northMarketClose='),c);
  const pending=c.northMarketOpen('shop');c.northMarketClose();const before=paints;resolve({shop:{id:'shop'},products:[]});await pending;assert.equal(c.northMarketView,null);assert.equal(c.northMarketBusy,false);assert.equal(paints,before);assert.equal(routes.length,2);
 });
 test((priv?'private':'web')+' real gift card uses escaped role remark then name and stays compact',()=>{
  const c={actId:()=> 'main',mtStyles(){},northNavIcon:()=>'',esc:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),money:n=>n.toFixed(2),northCompactOrderItems:()=>'<details>other items</details>'};vm.createContext(c);vm.runInContext(take('function northMarketGiftCard(')+';this.card=northMarketGiftCard;',c);const m={marketGiftOrderId:'order',marketGiftDetail:{account:'main',items:[],shop:'store',total:1200}};
  assert.match(c.card({remark:'先生',name:'默认名'},m),/我给先生点/);assert.match(c.card({name:'小北'},m),/我给小北点/);assert.match(c.card({remark:'<b>角色</b>'},m),/我给&lt;b&gt;角色&lt;\/b&gt;点/);assert.doesNotMatch(c.card({name:'小北'},m),/我给情侣点/);assert.equal(c.card({name:'小北'},{marketGiftDetail:{account:'other'}}),'');
 });
}

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js':'app.js';
 const src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 test((priv?'private':'web')+' global back dismisses active cloud page before popping unrelated navigation',()=>{
  let active=true,closes=0,paints=0;const routes=[{p:'home'},{p:'food'}],c={stack:routes,cur:()=>routes.at(-1),render:()=>paints++,northMarketBack:()=>{if(!active)return false;active=false;closes++;return true;}};vm.createContext(c);vm.runInContext(src.split('\n').find(l=>l.startsWith('function back(){'))+';this.leave=back;',c);c.leave();assert.equal(routes.length,2);assert.equal(closes,1);c.leave();assert.equal(routes.length,1);assert.equal(paints,1);
 });
}

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js';
 const src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const take=p=>src.split('\n').find(l=>l.startsWith('  '+p))||'';
 test((priv?'private':'web')+' real orders use the original yellow order header and filters',()=>{
  const c={northMarketHeader:()=>'<header class="north-personal-head">white</header>',mtGlyph:()=>'',northMarketPendingSplitsHTML:()=>'',esc:s=>s,money:n=>n,fmtDT:s=>s};vm.createContext(c);vm.runInContext(take('function northMarketOrdersHTML(')+';this.html=northMarketOrdersHTML;',c);const h=c.html({seller:false,busy:false,rows:[]});assert.match(h,/north-orders-header/);assert.match(h,/north-orders-filters/);assert.doesNotMatch(h,/north-personal-head/);
 });
 test((priv?'private':'web')+' page snapshots are bounded cloned short lived and isolated by state and identity',()=>{
  const pf={id:'phone1',secret:'s1'},c={S:{},actId:()=> 'main',phoneFriendState:()=>pf,Date:{now:()=>100000},JSON};vm.createContext(c);vm.runInContext(src.split('\n').filter(l=>/^  (var northMarketPageCache|function northMarketPage(Get|Put|Reset))/.test(l)).join('\n')+';this.get=northMarketPageGet;this.put=northMarketPagePut;',c);
  c.put('shop1',{shop:{name:'one'},products:[]});const snap=c.get('shop1');snap.shop.name='tampered';assert.equal(c.get('shop1').shop.name,'one');pf.secret='changed';assert.equal(c.get('shop1'),null);c.put('shop1',{shop:{name:'new'}});c.S={};assert.equal(c.get('shop1'),null);for(let i=0;i<30;i++)c.put('key'+i,{n:i});assert.equal(c.get('key0'),null);assert.equal(c.get('key29').n,29);c.Date.now=()=>300000;assert.equal(c.get('key29'),null);
 });
}

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js';
 const src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');const take=p=>src.split('\n').find(l=>l.startsWith('  '+p))||'';
 test((priv?'private':'web')+' cached shop returns immediately, refresh keeps content, and identical data never repaints',async()=>{
  let now=100000,calls=0,paint=0,resolve;const pf={id:'p',secret:'s'},data={shop:{id:'one',groups:[]},products:[]},c={S:{},phoneFriendState:()=>pf,actId:()=> 'main',Date:{now:()=>now},JSON,northMarketBusy:false,northMarketEpoch:0,northMarketView:null,northMarketEnter:()=>true,northMarketRemember(){},render:()=>paint++,northMarketPagePaint:()=>paint++,northMarketRpc:()=>{calls++;return new Promise(r=>resolve=r);}};c.window=c;vm.createContext(c);vm.runInContext(src.split('\n').filter(l=>/^  (var northMarketPageCache|function northMarketPage(Get|Put|Reset))/.test(l)).join('\n')+'\n'+take('function northMerchantOrderedProducts(')+'\n'+take('window.northMarketOpen='),c);
  const first=c.northMarketOpen('one');resolve(data);await first;assert.equal(calls,1);await c.northMarketOpen('one');assert.equal(calls,1);assert.equal(c.northMarketView.busy,false);now+=16000;const pending=c.northMarketOpen('one');assert.equal(c.northMarketView.shop.id,'one');assert.equal(c.northMarketView.busy,false);const before=paint;resolve(data);await pending;assert.equal(paint,before);assert.equal(c.northMarketBusy,false);
 });
 test((priv?'private':'web')+' cloud group change retains image nodes rather than rebuilding the page',()=>{
  let rendered=0;const nodes=[{group:'a',hidden:false},{group:'b',hidden:false}];nodes.forEach(n=>n.getAttribute=()=>n.group);const buttons=Array.from({length:3},()=>({classList:{toggle(){}}}));const root={querySelectorAll:q=>q==='[data-cloud-group]'?nodes:q.includes('aside')?buttons:[]};const c={northMarketView:{page:'store',account:'main',shop:{groups:[{id:'a'},{id:'b'}]}},actId:()=> 'main',document:{querySelector:()=>root},render:()=>rendered++};c.window=c;vm.createContext(c);vm.runInContext(take('window.northMarketGroup='),c);c.northMarketGroup('a');assert.equal(nodes[0].hidden,false);assert.equal(nodes[1].hidden,true);c.northMarketGroup('');assert.equal(nodes[1].hidden,false);assert.equal(rendered,0);
 });
}
