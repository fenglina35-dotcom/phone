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

for(const priv of [false,true]){
 const file=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'commerce-ui.js',src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const take=p=>src.split('\n').find(l=>l.startsWith('  '+p));
 test((priv?'private':'web')+' published own shop occurs once above other real shops and opens cloud catalogue',()=>{
  const own={id:'local',name:'North甜品店',marketId:'cloud-own',marketPublished:true,status:'open',products:[],tags:[]};let opened,preview=0;
  const c={northMerchantSaved:()=>own,northOwnShopHomeHTML:()=>'<section>North甜品店</section>',northMarketStoreCards:r=>r.map(p=>p.name).join(','),northMarketHomeCache:{busy:false,at:Date.now(),rows:[{id:'cloud-own',name:own.name},{id:'cloud-other',name:'朋友的店'}]},Date,northMarketOpen:id=>opened=id,northMerchantPreview:()=>preview++,deliveryRealEnabled:()=>false};c.window=c;vm.createContext(c);
  vm.runInContext(take('function northMarketHomeHTML()')+';this.home=northMarketHomeHTML;',c);const html=c.home();assert.equal((html.match(/North甜品店/g)||[]).length,1);assert(html.indexOf('North甜品店')<html.indexOf('真人店铺'));assert.match(html,/朋友的店/);
  assert(take('window.northOwnShopOpen='));vm.runInContext(take('window.northOwnShopOpen='),c);c.northOwnShopOpen();assert.equal(opened,'cloud-own');assert.equal(preview,0);
 });
 test((priv?'private':'web')+' each merchant product exposes a direct editable specification entry',()=>{
  const c={northMerchantView:{draft:{groups:[{id:'g',name:'甜品'}],products:[{id:'cake',name:'蛋糕',groupId:'g',price:1500,specGroups:[],available:true}]}},mtMedia:()=>'',northSignatureBadge:()=>'',money:n=>n.toFixed(2),esc:n=>String(n||''),northMarketArgument:n=>JSON.stringify(n).replace(/"/g,'&quot;')};vm.createContext(c);vm.runInContext(take('function northMerchantProductsHTML()')+';this.products=northMerchantProductsHTML;',c);assert.match(c.products(),/northMerchantProductSpecs/);assert.match(c.products(),/编辑规格/);
 });
}

for(const priv of [false,true]){
 const base=priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/':'',src=process.env.NORTH_TEST_OLD?cp.execFileSync('git',['show','HEAD:'+base+'commerce-ui.js'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(new URL('../'+base+'commerce-ui.js',import.meta.url),'utf8');
 test((priv?'private':'web')+' local preview retains full storefront tabs and grouped product ordering',()=>{
  const shop={id:'local',name:'甜品店',category:'甜品',tags:[],status:'open',minimum:1500,delivery:190,groups:[{id:'g',name:'蛋糕'}],products:[{id:'cake',groupId:'g',name:'蛋糕',price:1500,available:true}]};
  const c={northMerchantView:{draft:shop,dirty:false,group:'all',tab:'menu'},actId:()=> 'me',mtGlyph:()=>'',mtMedia:()=>'<img>',northSignatureBadge:()=>'',northFavoriteButton:()=>'',northShopFigures:()=>'',northMerchantReviews:()=>'',northMarketAttr:n=>String(n||''),northMerchantCartbar:()=>'',northMarketArgument:n=>JSON.stringify(n).replace(/"/g,'&quot;'),money:n=>n.toFixed(2),esc:n=>String(n||'')};vm.createContext(c);vm.runInContext(src.split('\n').find(l=>l.startsWith('  function northMerchantPreviewRender()'))+';this.page=northMerchantPreviewRender;',c);const html=c.page();assert.match(html,/north-info/);assert.match(html,/north-tabs/);assert.match(html,/north-menu-layout/);assert.match(html,/northMerchantPreviewTab/);
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
