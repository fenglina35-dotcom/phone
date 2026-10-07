import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import cp from 'node:child_process';

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
  const c={northMarketArgument:x=>JSON.stringify(x).replace(/"/g,'&quot;'),northMarketCartRows:()=>[],northMarketHeader:()=>'',northFavoriteButton:()=>'',northMarketImage:()=>'<img>',northSignatureBadge:()=>'',northCartMascot:()=>'',northCents:x=>x*100,money:x=>x.toFixed(2),esc:x=>String(x||'')};vm.createContext(c);vm.runInContext(fn('function northMarketStoreHTML(v)')+';this.store=northMarketStoreHTML;',c);
  let html=c.store(v);assert.match(html,/north-menu-layout/);assert.match(html,/蛋糕/);assert.equal((html.match(/class="north-drink(?: north-soldout)?"/g)||[]).length,50);assert.match(html,/disabled>选规格/);assert.doesNotMatch(html,/下一批商品|自取/);
  v.group='cakes';html=c.store(v);assert.equal((html.match(/class="north-drink(?: north-soldout)?"/g)||[]).length,25);
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
