import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

for(const priv of [false,true]) test((priv?'private':'web')+' pending favorite save cannot discard selected drink specs',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8'),block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'));
 let seq=0,release,first=true;const fields={north_size:{value:'standard'},north_sugar:{value:'半糖'},north_ice:{value:'温热'},north_qty:{value:'1'}};
 const ctx={window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){},foodBuy(){},foodCart(){}},S:{food:{cart:[],results:[]},me:{name:'我',balance:100,bills:[],accounts:[]}},actId:()=> 'main',deliveryRealEnabled:()=>false,render(){},esc:String,familyContacts:()=>[],openModal(){},closeModal(){},toast(){},save(){},saveNowAsync:()=>first?(first=false,new Promise(r=>release=r)):Promise.resolve(true),uid:()=>String(++seq),fmtDT:String,money:n=>Number(n).toFixed(2),setInterval(){},mtPaintCart(){},document:{getElementById:id=>fields[id],querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext((src.match(/  async function northMarketSearchStores\(query,view\)\{[^\n]+/)||[''])[0]+'\n'+block,ctx);Object.assign(ctx,ctx.window);const api=ctx.window;
 api.northOpen();api.northSpecs(0);const saving=api.northFavorite('store','north','north');await api.northAction('cart');assert.equal(ctx.S.food.cart.length,0);release(true);await saving;await api.northAction('cart');assert.equal(ctx.S.food.cart.length,1);assert.equal(ctx.S.food.cart[0]._northIce,'温热');
});

for(const priv of [false,true]) test((priv?'private':'web')+' simulated shop figures are stable and address changes do not alter monthly sales',()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 const hash=src.slice(src.indexOf('  function seedOf('),src.indexOf('  function money(')),profile=src.match(/  function northShopDisplay\(kind,id,address\)\{[^\n]+/)[0];
 const ctx={S:{food:{north:{addresses:{main:{address:'生活街1号'}}}}},actId:()=> 'main',curMonth:()=> '2026-10'};vm.createContext(ctx);vm.runInContext(hash+profile+'\nthis.profile=northShopDisplay;',ctx);
 const first=ctx.profile('ai','晴天茶铺');assert.equal(JSON.stringify(first),JSON.stringify(ctx.profile('ai','晴天茶铺')));
 assert(first.distance>=.4&&first.distance<=6.4);assert(first.monthlySales>=80&&first.monthlySales<=5880);assert(first.etaMinutes>=16+Math.ceil(first.distance*4));
 const before=JSON.stringify(ctx.S);const values=['晴天茶铺','云朵茶铺','北街茶铺','小饭店'].map(name=>ctx.profile('ai',name));assert(new Set(values.map(x=>x.monthlySales)).size>1);assert(new Set(values.map(x=>x.distance)).size>1);assert.equal(JSON.stringify(ctx.S),before,'rendering display figures cannot mutate order/wallet state');
 ctx.S.food.north.addresses.main.address='另一个社区';const moved=ctx.profile('ai','晴天茶铺');assert.equal(moved.monthlySales,first.monthlySales);assert.notEqual(moved.distance,first.distance);
 ctx.S.food.north.addresses.main.address='生活街 1号';assert.equal(JSON.stringify(ctx.profile('ai','晴天茶铺')),JSON.stringify(first));
});

for(const priv of [false,true]) test((priv?'private':'web')+' store review feed excludes other stores, same-name AI stores and unfinished orders',()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 const code=src.match(/  function northUserReviewMatch\(o,f\)\{[^\n]+/)[0]+'\nthis.match=northUserReviewMatch;';
 const ctx={northShopName:'north 的奶茶店'};vm.createContext(ctx);vm.runInContext(code,ctx);
 const fixed={shop:'north 的奶茶店',status:'completed',items:[{_northSku:'snow-mango'}],review:{rating:4}};
 assert.equal(ctx.match(fixed,'全部'),true);
 assert.equal(ctx.match({...fixed,merchantId:'different-store',shop:'别的店'},'全部'),false);
 assert.equal(ctx.match({...fixed,items:[{_northGeneric:true}]},'全部'),false);
 assert.equal(ctx.match({...fixed,status:'paid'},'全部'),false);
 assert.equal(ctx.match(fixed,'差评'),false);
});

for(const priv of [false,true]) test((priv?'private':'web')+' reviews allow explicit stars only, require completion and update one order without losing followups',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8'),block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'));
 let account='main',ok=true,seq=0;const order={id:'review-only',account:'main',status:'paid',shop:'测试店',items:[{name:'奶茶',price:22}]},fields={north_review_rating:{value:'4'},north_review_text:{value:''}};
 const ctx={window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){},foodBuy(){},foodCart(){}},S:{food:{cart:[],results:[],north:{orders:[order]}},me:{name:'我',balance:100,bills:[],accounts:[]}},actId:()=>account,deliveryRealEnabled:()=>false,render(){},esc:String,mtMedia:p=>p.name,mtGlyph:()=>'',svgIc:()=>'',familyContacts:()=>[],openModal(){},closeModal(){},toast(){},save(){},saveNowAsync:async()=>ok,uid:()=>String(++seq),fmtDT:String,money:n=>Number(n).toFixed(2),setInterval(){},mtPaintCart(){},document:{getElementById:id=>fields[id],querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext((src.match(/  async function northMarketSearchStores\(query,view\)\{[^\n]+/)||[''])[0]+'\n'+block,ctx);Object.assign(ctx,ctx.window);const api=ctx.window;
 await api.northSaveReview(order.id);assert.equal(order.review,undefined,'unfinished order cannot rate');
 order.status='completed';await Promise.all([api.northSaveReview(order.id),api.northSaveReview(order.id)]);assert.equal(order.review.rating,4);assert.equal(order.review.text,'');const createdAt=order.review.createdAt;order.review.followups=[{text:'追评',at:Date.now()}];
 fields.north_review_rating.value='2';fields.north_review_text.value='修改';await api.northSaveReview(order.id);assert.equal(order.review.rating,2);assert.equal(order.review.createdAt,createdAt);assert.equal(order.review.followups.length,1);assert.equal(ctx.S.food.north.orders.filter(o=>o.review).length,1);
 const previous=JSON.stringify(order.review);fields.north_review_rating.value='5';ok=false;await api.northSaveReview(order.id);assert.equal(JSON.stringify(order.review),previous);
 ok=true;fields.north_review_rating.value='';await api.northSaveReview(order.id);assert.equal(JSON.stringify(order.review),previous,'no implicit default rating');
 fields.north_review_rating.value='5';account='other';await api.northSaveReview(order.id);assert.equal(JSON.stringify(order.review),previous);
});

for(const priv of [false,true]) test((priv?'private':'web')+' detailed role food uses catalog quote and freezes selected specs, while AI remains labeled',()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8'),block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'));
 let seq=0,real=false,account='main';const c={id:'role',name:'角色'},ctx={window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){},foodBuy(){},foodCart(){}},S:{food:{cart:[],results:[]},me:{name:'我',balance:100,bills:[],accounts:[],wxTheme:'white'}},actId:()=>account,deliveryRealEnabled:()=>real,msgs:()=>[{role:'user',type:'text',content:'想喝芒芒雪顶'}],render(){},esc:String,mtStyles(){},svgIc:()=>'',mtMedia:p=>p._northSource==='ai'?'kangaroo':p.imageUrl,familyContacts:()=>[],openModal(){},closeModal(){},toast(){},save(){},saveNowAsync:async()=>true,uid:()=>String(++seq),fmtDT:String,money:n=>Number(n).toFixed(2),setInterval(){},mtPaintCart(){},document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext((src.match(/  async function northMarketSearchStores\(query,view\)\{[^\n]+/)||[''])[0]+'\n'+block,ctx);Object.assign(ctx,ctx.window);const food=ctx.window.NorthCommerceFood;
 const m=food.createRoleCard(c,'芒芒雪顶','1|north 的奶茶店|大杯、半糖、抹茶小丸|温的|2','main');
 assert.equal(m.price,54,'catalog quote overrides guessed role price');assert.equal(m.foodDetail.quantity,2);assert.equal(m.foodDetail.temperature,'温热');assert.equal(m.foodDetail.unitPrice,2700);assert.match(m.foodDetail.imageUrl,/north-snow-mango/);
 const original=JSON.stringify(m.foodDetail);ctx.S.food.north.merchants={main:{id:'shop',name:'小饭店',status:'open',products:[{id:'rice',name:'牛肉饭',available:true,price:1500,image:'idb:food-picture',specGroups:[{id:'spice',name:'辣度',mode:'single',required:true,options:[{id:'mild',label:'微辣',price:200}]}]}]}};
 const custom=food.createRoleCard(c,'牛肉饭','1|小饭店|辣度:微辣|不适用|2','main');assert.equal(custom.price,34);assert.equal(custom.foodDetail.specs[0],'辣度：微辣');assert.equal(custom.foodDetail.imageUrl,'idb:food-picture');
 assert.equal(food.createRoleCard(c,'牛肉饭','15|小饭店|辣度:不存在|不适用|1','main'),null);
 const ai=food.createRoleCard(c,'幻云奶茶','23|幻云店|大杯、三分糖|冰的|1','main');assert.equal(ai.foodDetail.source,'ai');assert.match(food.card(c,ai),/kangaroo/);assert.match(food.card(c,ai),/AI 模拟商品/);assert.match(food.card(c,ai),/三分糖/);
 assert.equal(JSON.stringify(m.foodDetail),original);assert.equal(ctx.S.me.balance,100,'rendering and role plot cards do not invent wallet transactions');
 const legacy=food.card(c,{id:'old',type:'food',from:'ta',name:'旧奶茶',price:20});assert.match(legacy,/未记录/);assert.doesNotMatch(legacy,/半糖/);
 assert.equal(food.createRoleCard(c,'芒芒雪顶','22|north 的奶茶店|标准杯、半糖|少冰|0','main'),null);
 account='other';assert.equal(food.createRoleCard(c,'芒芒雪顶','22','main'),null);real=true;assert.equal(food.createRoleCard(c,'芒芒雪顶','22','other'),null);assert.equal(food.instructions(c.id),'');
});

for(const priv of [false,true]) test((priv?'private':'web')+' audit model food gifting rejects account switches, duplicates and failed persistence',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8'),block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'));
 let account='main',seq=0,callback,ok=true,replies=0,legacy=0;const messages=[],role={id:'role',name:'角色'};
 const ctx={window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){},foodBuy(){},foodGiftFlow(){legacy++}},S:{food:{cart:[],results:[{name:'饭',price:22,shop:'模拟饭店'}]},me:{name:'我',balance:100,bills:[],accounts:[]}},actId:()=>account,deliveryRealEnabled:()=>false,getC:id=>id==='role'?role:null,msgs:()=>messages,pickTarget:f=>callback=f,scheduleReply:()=>replies++,render(){},esc:String,openModal(){},closeModal(){},toast(){},save(){},saveNowAsync:async()=>ok,uid:()=>String(++seq),fmtDT:String,money:n=>Number(n).toFixed(2),setInterval(){},mtPaintCart(){},document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext((src.match(/  async function northMarketSearchStores\(query,view\)\{[^\n]+/)||[''])[0]+'\n'+block,ctx);Object.assign(ctx,ctx.window);
 ctx.window.foodGiftFlow(0);assert.equal(legacy,0);account='other';await callback('role');assert.equal(ctx.S.me.balance,100);assert.equal(messages.length,0);
 account='main';ctx.window.foodGiftFlow(0);ok=false;await callback('role');assert.equal(ctx.S.me.balance,100);assert.equal(messages.length,0);
 ok=true;ctx.window.foodGiftFlow(0);await callback('role');await callback('role');assert.equal(ctx.S.me.balance,78);assert.equal(messages.length,1);assert.equal(messages[0].type,'food');assert.equal(messages[0].from,'me');assert.equal(replies,1);assert.equal(ctx.S.me.bills.length,1);
});

for(const priv of [false,true]) test((priv?'private':'web')+' audit broad search calls AI, rejects invalid prices and ignores late account results',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 const block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'));
 let account='main',seq=0,calls=0,resolve;const fields={food_q:{value:'奶茶'}};
 const ctx={_foodBusy:false,window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){},foodSearch(){calls++},foodBuy(){}},S:{food:{cart:[],results:[]},me:{name:'我',balance:100,bills:[],accounts:[]}},actId:()=>account,deliveryRealEnabled:()=>false,cur:()=>({p:'food'}),render(){},esc:String,mtMedia:p=>p.name,mtGlyph:()=>'',svgIc:()=>'',familyContacts:()=>[],openModal(){},closeModal(){},toast(){},save(){},saveNowAsync:async()=>true,uid:()=>String(++seq),fmtDT:String,money:n=>Number(n).toFixed(2),setInterval(){},mtPaintCart(){},looseLines:()=>[],aiGen:async()=>{calls++;return [['草莓奶茶','18','晴天茶铺','果香','茶'],['坏价','-18','坏店','',''],['坏价2','0','坏店','',''],['坏价3','oops','坏店','','']]},document:{getElementById:id=>fields[id],querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext((src.match(/  async function northMarketSearchStores\(query,view\)\{[^\n]+/)||[''])[0]+'\n'+block,ctx);Object.assign(ctx,ctx.window);
 ctx.window.northSearchPage();await ctx.window.foodSearch();assert.equal(calls,1,'broad category must not be swallowed by fixed menu');
 assert.equal(ctx.S.food.results.length,1);assert.equal(ctx.S.food.results[0]._northSource,'ai');assert.equal(ctx.S.food.results[0].price,18);
 fields.food_q.value='未知店铺';const before=JSON.stringify(ctx.S.food.results);ctx.aiGen=()=>new Promise(r=>resolve=r);const pending=ctx.window.foodSearch();while(!resolve)await new Promise(r=>setImmediate(r));account='other';resolve([['旧账号奶茶','22','旧账号店','','']]);await pending;assert.equal(JSON.stringify(ctx.S.food.results),before);assert.equal(ctx._foodBusy,false);
});

for(const priv of [false,true]) test((priv?'private':'web')+' audit AI self checkout cannot bypass PIN and zero quantity cannot pay',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 const block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'));
 let legacy=0,seq=0;const fields={north_size:{value:'standard'},north_sugar:{value:'半糖'},north_ice:{value:'少冰'},north_qty:{value:'1'}};
 const ctx={_foodBusy:false,window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){legacy++},foodBuy(){legacy++}},S:{food:{cart:[],results:[{name:'奶茶',price:18,shop:'AI茶铺'}]},me:{name:'我',balance:100,bills:[],accounts:[]}},actId:()=> 'main',deliveryRealEnabled:()=>false,render(){},esc:String,familyContacts:()=>[],openModal(){},closeModal(){},toast(){},save(){},saveNowAsync:async()=>true,uid:()=>String(++seq),fmtDT:String,money:n=>Number(n).toFixed(2),setInterval(){},mtPaintCart(){},document:{getElementById:id=>fields[id],querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext(block+'\nwindow.auditValid=northValidItem;',ctx);Object.assign(ctx,ctx.window);
 ctx.window.foodBuy(0);assert.equal(legacy,0,'all AI self-buy routes must use unified checkout');assert.equal(ctx.S.me.balance,100);assert.equal(ctx.S.food.north.orders.length,0);
 ctx.window.northOpen();ctx.window.northSpecs(0);await ctx.window.northAction('cart');const item=ctx.S.food.cart[0];item.quantity=0;assert.equal(ctx.window.auditValid(item),false);
});

for (const priv of [false,true]) test((priv?'private':'web')+' personal food records are account-owned, persisted atomically and preserve checkout notes',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 const block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'))+'\nwindow.testPersonalHTML=northPersonalRender;';
 let account='main',seq=0,ok=true,real=false;const fields={north_address_edit:{value:'生活街 3号楼'},north_receiver_edit:{value:'测试'},north_phone_edit:{value:'13800000000'},north_tag_edit:{value:'家'},north_followup:{value:'追加感受'},north_review_rating:{value:'4'},north_review_text:{value:'修改评价'},food_q:{value:'奶茶'}};
 const ctx={_foodBusy:false,window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){},foodSearch(){throw Error('local search must not call model')},foodBuy(){}},S:{food:{cart:[]},me:{name:'我',balance:100,bills:[],accounts:[]}},actId:()=>account,deliveryRealEnabled:()=>real,render(){},esc:String,mtMedia:p=>p.name,mtGlyph:()=>'',svgIc:()=>'',familyContacts:()=>[],openModal(){},closeModal(){},toast(){},save(){},saveNowAsync:async()=>ok,uid:()=>String(++seq),fmtDT:String,money:n=>Number(n).toFixed(2),setInterval(){},mtPaintCart(){},document:{getElementById:id=>fields[id],querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext((src.match(/  async function northMarketSearchStores\(query,view\)\{[^\n]+/)||[''])[0]+'\n'+block,ctx);Object.assign(ctx,ctx.window);const api=ctx.window;
 api.northOpen();await api.northFavorite('store','north','north');
 const data=ctx.S.food.north.personal.main;assert.equal(data.favorites.length,1);assert.equal(data.visits.length,1);
 api.northOpen();assert.equal(data.visits.length,1,'repeat visit updates instead of duplicate');ok=false;await api.northFavorite('store','north','north');assert.equal(data.favorites.length,1);ok=true;
 await api.northFavorite('product','north','unknown-sku');assert.equal(data.favorites.length,1,'unknown SKU cannot be saved');
 api.northFavorites();assert.match(api.testPersonalHTML(),/店铺（1）/);
 account='other';api.northFavorites();assert.doesNotMatch(api.testPersonalHTML(),/north 的奶茶店/);account='main';
 api.northAddresses();api.northAddressEditor('');await api.northAddressSave();assert.equal(data.addresses.length,1);assert.equal(ctx.S.food.north.addresses.main.phone,'13800000000');
 api.northAddressEditor(data.addresses[0].id);fields.north_address_edit.value='修改位置';ok=false;await api.northAddressSave();assert.equal(data.addresses[0].address,'生活街 3号楼');ok=true;await api.northAddressSave();assert.equal(data.addresses[0].address,'修改位置');
 api.northPersonalEditMode();api.northPersonalSelect(data.addresses[0].id);await api.northPersonalDelete();assert.equal(data.addresses.length,0);assert.equal(ctx.S.food.north.addresses.main,undefined);
 const order={id:'review',account:'main',shop:'自己的店',status:'completed',receivedAt:Date.now(),items:[{name:'饭',price:12}],review:{rating:5,text:'原评价',createdAt:Date.now()}};
 ctx.S.food.north.orders.push(order);api.northLocalReviews();api.northReviewFollowup(order.id);await api.northReviewFollowupSave(order.id);assert.equal(order.review.followups[0].text,'追加感受');
 await api.northSaveReview(order.id);assert.equal(order.review.followups.length,1,'editing original review preserves followups');
 api.northLocalReviews();ok=false;await api.northReviewDelete(order.id);assert(order.review);ok=true;await api.northReviewDelete(order.id);assert.equal(order.review,undefined);assert.equal(ctx.S.food.north.orders.length,1);
 api.northSearchPage();await api.foodSearch();assert.equal(data.searches[0],'奶茶');await api.foodSearch();assert.equal(data.searches.length,1);ok=false;await api.northClearSearches();assert.equal(data.searches.length,1);ok=true;await api.northClearSearches();assert.equal(data.searches.length,0);
 real=true;const count=data.favorites.length;await api.northFavorite('store','north','north');assert.equal(data.favorites.length,count);
});

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../commerce-ui.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('shopping redesign keeps every existing purchase route reachable', () => {
  assert.match(ui, /window\.renderShop=function/);
  assert.match(ui, /shop-grid/);
  for (const handler of ['openCart()', 'openOrders()', 'buyNow(', 'addCart(', 'giftFlow(', 'payFlow(', 'familyPayFlow(', 'coInvite()']) {
    assert.ok(ui.includes(handler), `missing shopping handler: ${handler}`);
  }
  assert.match(ui, /window\.shopProductDetail=function/);
});

test('Meituan redesign preserves cart, checkout, gifting and orders', () => {
  assert.match(ui, /window\.renderFood=function/);
  assert.match(ui, /美团外卖/);
  assert.match(ui, /mt-cats/);
  for (const handler of ['openFoodCart()', 'openFoodOrders()', 'foodCart(', 'foodBuy(', 'foodGiftFlow(', 'northGenericCheckout(']) {
    assert.ok(ui.includes(handler), `missing food handler: ${handler}`);
  }
});

/* 抖音外壳（dy-shell、中间的发布键、「发现」标签）已整个搬回 app.js 的 renderDouyin。
   commerce-ui.js 再覆盖一遍，就会把编辑资料、主页访客、作品详情和底部评论区全部屏蔽掉，
   和它当初覆盖 dyProfile 是同一个陷阱。 */
test('Douyin redesign keeps feed actions and exposes a center publish control', () => {
  assert.doesNotMatch(ui, /window\.renderDouyin=function/, 'commerce-ui 不能再覆盖抖音外壳');
  assert.match(app, /function renderDouyin\(\)\{dyInit\(\);/, '外壳实现在 app.js');
  assert.match(app, /dycreate-wrap/, '中间的发布键随外壳一起搬过去');
  assert.match(app, /dytb\('friend',svgIc\('users',21\),'朋友'\)/, '第二个标签是「朋友」');
  assert.doesNotMatch(ui, /window\.dyFeedView=function/, 'commerce-ui 不能再覆盖首页信息流');
  assert.doesNotMatch(ui, /window\.dyVideoCard=function/, '作品卡片也搬回 app.js 了');
  for (const handler of ['dyLike(', 'dyComments(', 'dyTapVideo(', 'dyFwd(', 'dyCompose()']) {
    assert.ok(app.includes(handler), `missing Douyin handler: ${handler}`);
  }
  assert.match(app, /onclick="dyBack\(\)"/, '首页要有返回键');
});

/* 抖音「我」页已按真实抖音在 app.js 的 dyProfile 里重做。commerce-ui.js 原先用
   window.dyProfile=function 把它整个覆盖掉，导致改了核心却看不到效果——和
   private-reply-intercept.js 同类的陷阱，现已移除，只保留一份实现。 */
test('Douyin profile lives in one place and commerce-ui no longer overrides it', () => {
  assert.doesNotMatch(ui, /window\.dyProfile=function/, 'commerce-ui 不能再覆盖「我」页');
  assert.match(ui, /window\.dyProfileSwitch=function/, '旧的 onclick 仍要有兼容入口');
  assert.doesNotMatch(ui, /❤️/, '抖音壳里用矢量心，不用 emoji');
  assert.match(app, /function dyProfile\(\)\{const p=S\.dy\.profile/, '实现在 app.js');
  assert.match(html, /\.dyme-cover\{/, '样式随页面一起进壳');
  assert.match(html, /\.dyme-tabs span\.on:after\{/, '分栏下划线');
});

test('delivery and presentation layers load after app.js and are available offline', () => {
  assert.match(html, /<script src="app\.js\?v=(\d+)[^"]*"[^>]*><\/script>[\s\S]*?<script src="delivery\.js\?v=\1"[^>]*><\/script>\s*<script src="commerce-ui\.js\?v=\1"/);
  assert.match(html, /vendor\/qr\/qrcode\.js[\s\S]*vendor\/qr\/jsQR\.js[\s\S]*wechat-me\.js/);
  assert.match(html, /\.shop-card\{/);
  assert.match(html, /\.mt-card\{/);
  assert.match(html, /\.dy-scene\{/);
  assert.match(sw, /commerce-ui\.js\?v='\+BUILD/);
  assert.match(sw, /delivery\.js\?v='\+BUILD/);
  assert.match(sw, /\/commerce-ui\\\.js\$/);
});


for(const privateRuntime of [false,true]){
 const code=readFileSync(new URL(privateRuntime?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 for(const real of [false,true])test((privateRuntime?'private':'web')+' food add updates only the badge and preserves each existing cart rule '+(real?'real':'virtual'),()=>{
  const line=code.split(/\r?\n/).find(x=>x.startsWith('  function mtLocalCart('));assert(line);let paint=0,saves=0,delegated=0,onPage=true;
  const meal={offerId:'offer-1',name:'餐品',price:18,total:20},context={S:{food:{results:[meal],cart:[]},me:{balance:90}},document:{querySelector:()=>onPage?{}:null},deliveryRealEnabled:()=>real,mtPaintCart:()=>paint++,save:()=>saves++,toast:()=>{},core:()=>delegated++,real};
  vm.createContext(context);vm.runInContext(line+'\nglobalThis.add=mtLocalCart(core,real);',context);context.add(0);assert.equal(context.S.food.cart[0],meal);assert.equal(paint,1);assert.equal(saves,1);assert.equal(context.S.me.balance,90);context.add(0);assert.equal(context.S.food.cart.length,real?1:2);onPage=false;context.add(0);assert.equal(delegated,1);assert.equal(context.S.food.cart.length,real?1:2);
 });
}


for(const priv of [false,true])test((priv?'private':'web')+' fixed tea merchant prices, duplicate payment, rollback and account boundaries',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 const block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'));
 let account='main',real=false,writeOk=true,callback,sent=0,seq=0,selected=[];
 const fields={north_size:{value:'large'},north_sugar:{value:'半糖'},north_ice:{value:'少冰'},north_qty:{value:'1'},north_receiver:{value:'测试'},north_address:{value:'小手机的家'},north_note:{value:''},north_review_rating:{value:'5'},north_review_text:{value:'好喝'},north_utensil_save:{disabled:true}};
 const ctx={window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){}},S:{food:{cart:[]},me:{name:'演示',balance:100,bills:[],accounts:[]}},actId:()=>account,deliveryRealEnabled:()=>real,render(){},esc:x=>x,familyContacts:()=>[],openModal(){},closeModal(){},toast(){},save(){},saveNowAsync:async()=>writeOk,uid:()=>String(++seq),fmtDT:n=>String(n),money:n=>Number(n).toFixed(2),setInterval(){},mtPaintCart(){},document:{getElementById:id=>fields[id],querySelector:()=>null,querySelectorAll:selector=>selector.includes('north-addon-choice')?selected:[]},pickTarget:f=>callback=f,foodGiftTo:()=>sent++,payTo:()=>sent++,familyPayFlow:()=>sent++};
 vm.createContext(ctx);vm.runInContext((src.match(/  async function northMarketSearchStores\(query,view\)\{[^\n]+/)||[''])[0]+'\n'+block,ctx);Object.assign(ctx,ctx.window);const api=ctx.window;
 const authorize=async()=>{api.northPay();api.northUtensils('no');api.northUtensilSave();for(let i=0;i<4;i++)await api.northPinKey('0');await Promise.all([api.northPinKey('0'),api.northPinKey('0')]);};
 api.northOpen();api.northSpecs(0);await api.northAction('cart');await api.northAction('cart');
 assert.equal(ctx.S.food.cart.length,1);assert.equal(ctx.S.food.cart[0].price,25);assert.match(ctx.S.food.cart[0].name,/大杯／半糖／少冰/);
 api.northCheckoutCart();await authorize();assert.equal(ctx.S.food.north.orders.length,1);assert.equal(ctx.S.me.balance,73.1);assert.equal(ctx.S.me.bills.length,1);assert.equal(ctx.S.food.cart.length,0);
 const id=ctx.S.food.north.orders[0].id;await api.northRefund(id);await api.northRefund(id);assert.equal(ctx.S.me.balance,100);assert.equal(ctx.S.me.bills.length,2);
 api.northSpecs(0);await api.northAction('cart');api.northCheckoutCart();writeOk=false;await authorize();assert.equal(ctx.S.me.balance,100);assert.equal(ctx.S.food.north.orders.length,1);assert.equal(ctx.S.food.cart.length,1);assert.equal(ctx.S.me.bills.length,2);
 writeOk=true;await authorize();const order=ctx.S.food.north.orders[0];assert.equal(order.items[0].quantity,1);
 await api.northAdvance(order.id);await api.northAdvance(order.id);await api.northAdvance(order.id);await api.northReceive(order.id);await api.northSaveReview(order.id);assert.equal(order.review.text,'好喝');fields.north_review_text.value='修改后的评价';await api.northSaveReview(order.id);assert.equal(order.review.text,'修改后的评价');assert.equal(ctx.S.food.north.orders.filter(o=>o.review).length,1);
 selected=[{dataset:{extra:'extra-green'}},{dataset:{extra:'extra-rainbow'}}];fields.north_qty.value='2';api.northSpecs(0);await api.northAction('buy');const beforeExtras=ctx.S.me.balance;await authorize();const extraOrder=ctx.S.food.north.orders[0];assert.equal(extraOrder.items[0].price,60);assert.equal(extraOrder.total,6190);assert.match(extraOrder.items[0].name,/加抹茶小丸、彩虹芋圆/);assert.equal(ctx.S.me.balance,Number((beforeExtras-61.9).toFixed(2)));assert.deepEqual(Array.from(extraOrder.items[0]._northExtras),['extra-green','extra-rainbow']);selected=[];fields.north_qty.value='1';
 api.northSpecs(0);account='other';await api.northAction('cart');assert.equal(ctx.S.food.cart.length,0);
 account='main';api.northOpen();api.northSpecs(0);real=true;await api.northAction('cart');assert.equal(ctx.S.food.cart.length,0);
 real=false;api.northOpen();api.northSpecs(0);await api.northAction('gift');account='other';callback('role');assert.equal(sent,0);
 account='main';api.northOpen();api.northSpecs(0);await api.northAction('pay');real=true;callback('role');assert.equal(sent,0);
});

for(const priv of [false,true])test((priv?'private':'web')+' new purchases route to cloud only; historical vouchers expire, discount and refund atomically',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 const block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'));
 let seq=0,ok=true,account='main';const fields={north_size:{value:'standard'},north_sugar:{value:'半糖'},north_ice:{value:'少冰'},north_qty:{value:'1'},north_receiver:{value:'演示'},north_address:{value:'虚拟街区'},north_note:{value:''},north_utensil_save:{disabled:true}};
 const ctx={window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){}},S:{food:{cart:[]},me:{balance:200,bills:[],accounts:[]}},actId:()=>account,deliveryRealEnabled:()=>false,render(){},esc:x=>x,familyContacts:()=>[],openModal(){},closeModal(){},toast(){},save(){},saveNowAsync:async()=>ok,uid:()=>String(++seq),fmtDT:n=>String(n),money:n=>Number(n).toFixed(2),setInterval(){},mtPaintCart(){},document:{getElementById:id=>fields[id],querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext((src.match(/  async function northMarketSearchStores\(query,view\)\{[^\n]+/)||[''])[0]+'\n'+block,ctx);Object.assign(ctx,ctx.window);const api=ctx.window;
 const pin=async()=>{for(let i=0;i<4;i++)await api.northPinKey('0');await Promise.all([api.northPinKey('0'),api.northPinKey('0')]);};
 const routed=[];ctx.northMarketCouponBuy=id=>routed.push(id);api.northStartCouponPurchase('daily');api.northStartCouponPurchase('light');assert.deepEqual(routed,['daily','light']);assert.equal(ctx.S.me.balance,200);
 api.northOpen();const now=Date.now();ctx.S.food.north.vouchers=[[300,2000],[300,2000],[300,2000],[500,3500],[500,3500]].map((pair,i)=>({id:'historical-'+i,account:'main',face:pair[0],minimum:pair[1],createdAt:now,expiresAt:now+31*86400000,paid:true,inflated:false,usedOrderId:null,packId:'historical'}));ctx.S.food.north.voucherPurchases=[{id:'historical',account:'main',createdAt:now}];ctx.S.food.north.voucherRules={main:{lastPurchaseAt:now,lastBoostAt:0}};
 const expiry=ctx.S.food.north.vouchers[0].expiresAt;await Promise.all([api.northBoostCoupon(),api.northBoostCoupon()]);assert.equal(ctx.S.food.north.vouchers.filter(c=>c.inflated).length,1);assert.equal(ctx.S.food.north.vouchers[0].minimum,3500);assert.equal(ctx.S.food.north.vouchers[0].face,500);assert.equal(ctx.S.food.north.vouchers[0].expiresAt,expiry);
 api.northOpen();api.northSpecs(0);await api.northAction('buy');const c=ctx.S.food.north.vouchers[1];api.northPickCoupon(c.id);c.expiresAt=Date.now()-1;api.northPay();api.northUtensils('no');api.northUtensilSave();await pin();assert.equal(ctx.S.me.balance,200);assert.equal(ctx.S.food.north.orders.length,0);assert.equal(c.usedOrderId,null);
 c.expiresAt=expiry;api.northPay();api.northUtensils('no');api.northUtensilSave();await pin();const order=ctx.S.food.north.orders[0];assert.equal(order.discount,300);assert.equal(order.total,2090);assert.equal(ctx.S.me.balance,179.1);assert.equal(c.usedOrderId,order.id);
 await Promise.all([api.northRefund(order.id),api.northRefund(order.id)]);assert.equal(ctx.S.me.balance,200);assert.equal(c.usedOrderId,null);assert.equal(ctx.S.me.bills.filter(b=>b.id===order.id+'-refund').length,1);
 account='other';ok=false;api.northStartCouponPurchase('light');await pin();assert.equal(ctx.S.me.balance,200);assert.equal(ctx.S.food.north.vouchers.length,5);assert.equal(ctx.S.food.north.voucherPurchases.length,1);
});

for(const priv of [false,true])test((priv?'private':'web')+' local merchant custom specs, fee, revision and failed-save isolation',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');const block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'));
 let sequence=0,account='main',real=false,writeOk=true;const fields={north_receiver:{value:'演示'},north_address:{value:'虚拟街区'},north_note:{value:''},north_utensil_save:{disabled:true}};
 const ctx={window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){}},S:{food:{cart:[]},me:{balance:100,bills:[],accounts:[]}},actId:()=>account,deliveryRealEnabled:()=>real,render(){},esc:x=>x,money:n=>Number(n).toFixed(2),uid:()=>String(++sequence),fmtDT:n=>String(n),closeModal(){},toast(){},openModal(){},saveNowAsync:async()=>writeOk,setInterval(){},mtPaintCart(){},document:{getElementById:id=>fields[id],querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext((src.match(/  async function northMarketSearchStores\(query,view\)\{[^\n]+/)||[''])[0]+'\n'+block,ctx);Object.assign(ctx,ctx.window);const api=ctx.window;api.northMerchantEditor();const d=ctx.northMerchantView.draft;d.name='小灶饭店';d.category='家常菜';d.minimum=3000;d.delivery=250;
 const product={id:'rice',groupId:d.groups[0].id,name:'手工牛肉饭',price:1200,unit:'份',description:'',image:'',available:true,specGroups:[{id:'size',name:'分量',mode:'single',required:true,options:[{id:'normal',label:'标准份',price:0},{id:'plus',label:'加量',price:300}]},{id:'spice',name:'辣度',mode:'single',required:true,options:[{id:'mild',label:'微辣',price:0}]},{id:'extras',name:'配菜',mode:'multiple',required:false,options:[{id:'egg',label:'鸡蛋',price:200},{id:'mushroom',label:'香菇',price:100}]}]};d.products=[product];
 assert.equal(ctx.northMerchantQuote(product,{},2),null);assert.equal(ctx.northMerchantQuote(product,{size:['normal','plus'],spice:['mild']},2),null);assert.equal(ctx.northMerchantQuote(product,{size:['plus'],spice:['mild'],extras:['egg','egg']},2),null);assert.equal(ctx.northMerchantQuote(product,{size:['plus'],spice:['mild']},0),null);
 const selections={size:['plus'],spice:['mild'],extras:['egg','mushroom']},quote=ctx.northMerchantQuote(product,selections,2);assert.equal(quote.total,3600);assert.deepEqual(Array.from(quote.labels),['分量：加量','辣度：微辣','配菜：鸡蛋','配菜：香菇']);await api.northMerchantSave('open');const saved=ctx.S.food.north.merchants.main;assert.equal(saved.revision,1);
 const line={name:'手工牛肉饭（分量：加量／辣度：微辣／配菜：鸡蛋／香菇）',price:36,quantity:2,unit:'份',shop:saved.name,_northMerchant:saved.id,_northAccount:'main',_northProduct:product.id,_northRevision:1,_northSelections:selections};assert.equal(ctx.northMerchantValidLine(line),true);account='other';assert.equal(ctx.northMerchantValidLine(line),false);assert.equal(ctx.S.food.north.merchants.other,undefined);account='main';
 api.foodDoBuy([line]);api.northPay();api.northUtensils('no');api.northUtensilSave();for(let i=0;i<5;i++)await api.northPinKey('0');assert.equal(ctx.S.me.balance,61.5);assert.equal(ctx.S.food.north.orders[0].total,3850);assert.equal(ctx.S.food.north.orders[0].delivery,250);assert.equal(ctx.S.food.north.orders[0].merchantId,saved.id);const orderSnapshot=JSON.stringify(ctx.S.food.north.orders[0].items);
 api.northMerchantEditor();ctx.northMerchantView.draft.products[0].price=1400;writeOk=false;await api.northMerchantSave('open');assert.equal(ctx.S.food.north.merchants.main.products[0].price,1200);assert.equal(ctx.S.food.north.merchants.main.revision,1);writeOk=true;await api.northMerchantSave('open');assert.equal(ctx.S.food.north.merchants.main.products[0].price,1400);assert.equal(ctx.S.food.north.merchants.main.revision,2);assert.equal(JSON.stringify(ctx.S.food.north.orders[0].items),orderSnapshot);assert.equal(ctx.northMerchantValidLine(line),false);
});

for(const priv of [false,true])test((priv?'private':'web')+' funding never mixes wallets and customer income withdraws once',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8'),block=src.slice(src.indexOf('  var northShopName='),src.indexOf('  window.renderFood=function'));let seq=0,writeOk=true;
 const role={id:'payer',name:'角色',wallet:100,family:{bound:true,quota:200,used:0,month:'2026-10'}},messages=[],fields={north_size:{value:'standard'},north_sugar:{value:'半糖'},north_ice:{value:'少冰'},north_qty:{value:'1'},north_receiver:{value:'我'},north_address:{value:'家'},north_note:{value:''},north_utensil_save:{disabled:true},north_income_amount:{value:'10'}};
 const ctx={window:{openFoodCart(){},openFoodOrders(){},foodDoBuy(){}},S:{food:{cart:[]},me:{balance:100,bills:[],accounts:[],wxFeatures:{banks:[{id:'bank',name:'储蓄卡',last4:'1234',balance:80}]}},contacts:[role],spy:{payer:{wallet:[]}}},actId:()=> 'main',deliveryRealEnabled:()=>false,render(){},esc:x=>x,money:n=>Number(n).toFixed(2),uid:()=>String(++seq),fmtDT:n=>String(n),closeModal(){},toast(){},openModal(){},saveNowAsync:async()=>writeOk,setInterval(){},mtPaintCart(){},familyContacts:()=>[role],getC:id=>id===role.id?role:null,tvHotelRoleMoney:c=>({source:'roleWallet',balance:c.wallet}),curMonth:()=> '2026-10',msgs:()=>messages,pushMsg:(id,m)=>messages.push(m),scheduleReply:()=>true,save(){},document:{getElementById:id=>fields[id],querySelector:()=>null,querySelectorAll:()=>[]}};
 vm.createContext(ctx);vm.runInContext((src.match(/  async function northMarketSearchStores\(query,view\)\{[^\n]+/)||[''])[0]+'\n'+block,ctx);Object.assign(ctx,ctx.window);const api=ctx.window;
 const prepare=async(mode,id)=>{api.northOpen();api.northSpecs(0);await api.northAction('buy');api.northSetFunding(mode,id);api.northPay();api.northUtensils('no');};
 const pin=async()=>{for(let i=0;i<4;i++)await api.northPinKey('0');await Promise.all([api.northPinKey('0'),api.northPinKey('0')]);};
 await prepare('bank','bank');api.northUtensilSave();await pin();assert.equal(ctx.S.me.balance,100);assert.equal(ctx.S.me.wxFeatures.banks[0].balance,56.1);const bankOrder=ctx.S.food.north.orders[0];await api.northRefund(bankOrder.id);assert.equal(ctx.S.me.wxFeatures.banks[0].balance,80);assert.equal(ctx.S.me.balance,100);
 await prepare('family','payer');api.northUtensilSave();await pin();assert.equal(role.family.used,23.9);assert.equal(role.wallet,100);assert.equal(ctx.S.me.balance,100);await api.northRefund(ctx.S.food.north.orders[0].id);assert.equal(role.family.used,0);
 await prepare('role','payer');await api.northRequestRolePay();const request=ctx.S.food.north.payRequests[0];assert.equal(role.wallet,100);assert.equal(await api.NorthCommercePayment.roleDecision({id:'wrong-role'},request.id,false),false);const recalledCard=messages.splice(messages.findIndex(m=>m.northRequestId===request.id),1)[0];assert.equal(await api.NorthCommercePayment.roleDecision(role,request.id,false),false,'recalled request must not pay');assert.equal(role.wallet,100);messages.push(recalledCard);request.status='pending';await Promise.all([api.NorthCommercePayment.roleDecision(role,request.id,false),api.NorthCommercePayment.roleDecision(role,request.id,false)]);assert.equal(role.wallet,76.1);assert.equal(ctx.S.me.balance,100);assert.equal(request.status,'paid');await api.northRefund(request.orderId);assert.equal(role.wallet,100);assert.equal(ctx.S.me.balance,100);
 assert.equal(ctx.northIncomeAvailable(),0);ctx.S.food.north.incomeEntries.push({id:'customer',owner:'main',buyer:'friend',source:'customer',status:'settled',amount:2000,withdrawn:0},{id:'self',owner:'main',buyer:'main',source:'customer',status:'settled',amount:9000,withdrawn:0});assert.equal(ctx.northIncomeAvailable(),2000);api.northIncomePrepareWithdraw();await pin();assert.equal(ctx.S.me.balance,110);assert.equal(ctx.S.food.north.incomeEntries[0].withdrawn,1000);assert.equal(ctx.S.food.north.withdrawals.length,1);assert.equal(ctx.northIncomeAvailable(),1000);
 writeOk=false;api.northIncomePrepareWithdraw();await pin();assert.equal(ctx.S.me.balance,110);assert.equal(ctx.S.food.north.incomeEntries[0].withdrawn,1000);assert.equal(ctx.S.food.north.withdrawals.length,1);
});

for(const priv of [false,true]){
 const source=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 test((priv?'private':'web')+' soldout reminders merge, persist a five minute cooldown and never use a template',async()=>{
  let now=1000000,calls=0,fail=false;const c={id:'role',name:'先生'},state={food:{north:{merchants:{main:{marketId:'shop'}}}}},messages=[],acks=[],pending=[1,2,3,4,5].map(id=>({id:String(id),shop_id:'shop',shop_name:'我们的店',name:'商品'+id}));
  const ctx={Date:{now:()=>now},S:state,window:{},Set,JSON,isMain:()=>true,actId:()=> 'main',northMarketCoupleRole:()=>c,northBusinessCache:null,northMarketMyCache:null,northData:()=>state.food.north,msgs:()=>messages,pushMsg:(id,m)=>messages.push(m),saveNowAsync:async()=>true,notifyIncoming(){},cur:()=>({p:'home'}),buildSystem:()=> '角色独立人设',roleVisibleEnvelopeText:x=>x,chatAPI:async()=>{calls++;if(fail)throw Error('offline');return '店里有几样东西卖完了，等你空下来咱们补一下？';},northMarketRpc:async(name,args)=>{if(name==='business')return {shopCount:1};if(args.p_ids){acks.push(...args.p_ids);return {};}return {notices:pending.filter(n=>!acks.includes(n.id))};}};
  const start=source.indexOf('var northBusinessReminderFlights='),end=source.indexOf('  function northShopQueryCard(',start);assert.ok(start>=0);vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
  await Promise.all([ctx.northBusinessRoleRefresh(),ctx.northBusinessRoleRefresh()]);assert.equal(calls,1);assert.equal(messages.length,1);assert.equal(messages[0]._northBusinessNoticeIds.length,5);assert.equal(acks.length,5);assert.match(messages[0].content,/咱们/);
  pending.push({id:'6',shop_id:'shop',shop_name:'店',name:'新商品'});now+=299999;ctx.northBusinessCache=null;await ctx.northBusinessRoleRefresh();assert.equal(messages.length,1);assert.ok(!acks.includes('6'));
  now++;ctx.northBusinessCache=null;await ctx.northBusinessRoleRefresh();assert.equal(messages.length,2);assert.ok(acks.includes('6'));
  now+=300000;pending.push({id:'7',shop_id:'shop',name:'重试商品'});ctx.northBusinessCache=null;fail=true;await ctx.northBusinessRoleRefresh();assert.equal(messages.length,2);assert.ok(!acks.includes('7'));assert.equal(ctx.northBusinessReminderFlights.size,0);
 });
 test((priv?'private':'web')+' shared store cards expose the whole menu and open by locator without search',async()=>{
  const shop={id:'builtin-shop',name:'内置店',cover:'assets/cover.jpg',products:Array.from({length:50},(_,i)=>({id:String(i),name:'商品'+i,price:100+i,available:true,specGroups:[]}))},calls=[];
  const ctx={window:{},Map,Set,JSON,Date,northBuiltinShops:()=>[shop],northMenu:[],northCover:'',esc:x=>String(x).replace(/[<>"']/g,'_'),money:n=>n.toFixed(2),northMarketArgument:x=>JSON.stringify(x),northMarketView:null,northPersonalView:null,deliveryRealEnabled:()=>false,toast:x=>calls.push(x),go:x=>calls.push(x),northBuiltinOpen:id=>calls.push(id),northMarketOpen:async id=>calls.push(id),northOpen:()=>calls.push('north')};
  const start=source.indexOf('  var northShareDraft='),end=source.indexOf('  var mtArtSerial=',start);assert.ok(start>=0);vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);const card={version:1,source:'builtin',id:'builtin-shop',name:'内置店'};
  assert.match(ctx.northShareText(card),/商品49/);assert.match(ctx.northShareCard(card),/打开店铺/);await ctx.window.northShareVisit('builtin:builtin-shop');assert.deepEqual(calls,['food','builtin-shop']);assert.equal(ctx.northShareValid({...card,id:'x\" onclick=attack()'}),false);
 });
}

for(const priv of [false,true])test((priv?'private':'web')+' phone inspection separates buying and selling and reports failed reads without inventing absence',async()=>{
 const source=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8'),role={id:'partner'},state={},identity={id:'owner'},events=[];
 const order={id:'o',shop_name:'商家',status:'paid',created_at:'2026-10-08T00:00:00Z',items:[{name:'商品A',quantity:2,labels:['大份'],total:3000}],subtotal:3000,delivery:100,discount:300,total:2800,address:{name:'收货人'}};
 let fail=false;const ctx={S:state,Date,JSON,Number,Promise,northMarketCoupleRole:()=>role,actId:()=> 'main',phoneFriendState:()=>identity,deliveryRealEnabled:()=>false,northMyOrders:()=>[],getC:()=>role,money:x=>x.toFixed(2),northMarketStatus:x=>x,northMarketRpc:async(name,args)=>{events.push(args.p_seller);if(fail)throw Error('offline');return {orders:[{...order,id:args.p_seller?'sale':'buy'}]};}};
 const start=source.indexOf('  var northOrderInspectionCache='),end=source.indexOf('  window.NorthMarketBusiness=',start);assert.ok(start>=0);vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);await ctx.northPrepareOrderInspection(role);assert.deepEqual(events,[false,true]);const rows=ctx.northOrderInspectionRows(role),buy=rows.find(x=>x.id==='buy'),sale=rows.find(x=>x.id==='sale');assert.match(buy.text,/手机主人购买/);assert.match(sale.text,/不是手机主人购买/);assert.match(sale.text,/不把收货人当买家/);assert.match(buy.text,/商品A ×2 \[大份\]/);assert.match(buy.text,/实付¥28.00/);
 ctx.actId=()=> 'other';assert.ok(ctx.northOrderInspectionRows(role).some(x=>x.id==='cloud-unread'));fail=true;await ctx.northPrepareOrderInspection(role);assert.ok(ctx.northOrderInspectionRows(role).some(x=>x.id==='sell-failed'&&/读取失败/.test(x.text)));
});

for(const priv of [false,true]) test((priv?'private':'web')+' opening reward renders eligibility and accepts only backend credit with replay and identity guards',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');
 const block=src.slice(src.indexOf('  function northMarketShopRewardHTML('),src.indexOf('  function northMarketWalletHTML('));assert(block.length>0,'opening reward implementation required');
 let account='main',calls=0,release,identity={id:'SPTEST',secret:'fixture'},notices=[];const state={me:{balance:8}};
 const ctx={window:{},S:state,actId:()=>account,phoneFriendState:()=>identity,northMarketBusy:false,northMarketEpoch:4,northMarketEnter:()=>true,northMarketCoupleRole:()=>null,northMarketView:{page:'wallet',account:'main'},northMarketRpc:async(name,args)=>{assert.equal(name,'shop_reward');assert.deepEqual(Object.keys(args),[]);calls++;return new Promise(r=>release=r);},toast:x=>notices.push(x),render(){}};
 vm.createContext(ctx);vm.runInContext(block+'\nthis.rewardHTML=northMarketShopRewardHTML',ctx);
 assert.match(ctx.rewardHTML({shopReward:{eligible:true,claimed:false}}),/领取开店1000额度/);assert.match(ctx.rewardHTML({shopReward:{eligible:false,claimed:false}}),/去开店/);assert.doesNotMatch(ctx.rewardHTML({shopReward:{eligible:false,claimed:false}}),/onclick="northMarketShopRewardClaim/);assert.match(ctx.rewardHTML({shopReward:{eligible:true,claimed:true}}),/disabled/);
 const first=ctx.window.northMarketShopRewardClaim();await ctx.window.northMarketShopRewardClaim();assert.equal(calls,1);release({balance:123456,shopReward:{eligible:true,claimed:true},rewardDuplicate:false});await first;assert.equal(ctx.northMarketView.data.balance,123456);assert.equal(state.me.balance,8,'local wallet never credited');assert.match(notices[0],/已到账/);
 const second=ctx.window.northMarketShopRewardClaim();release({balance:123456,rewardDuplicate:true});await second;assert.match(notices[1],/未重复/);assert.equal(ctx.northMarketView.data.balance,123456);
 const third=ctx.window.northMarketShopRewardClaim();account='other';identity={id:'SPOTHER',secret:'other'};ctx.northMarketWalletCache=null;release({balance:999999});await third;assert.equal(ctx.northMarketWalletCache,null);assert.equal(notices.length,2,'changed account receives no false success');
});

for(const priv of [false,true]) test((priv?'private':'web')+' cloud review photos open the chosen full image from public, buyer, seller and draft views only',()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8');const block=src.slice(src.indexOf('  function northMarketReviewPhoto('),src.indexOf('  function northMarketReviewsHTML('));assert(block.length>0,'review photo handler required');
 const url='https://lkhlyfpssmrjkkzhuzag.supabase.co/storage/v1/object/public/north-market/'+'a'.repeat(32)+'/one.jpg',other=url.replace('one','two'),seen=[];
 let account='main';const ctx={window:{},actId:()=>account,northMarketView:{account:'main',page:'reviews',rows:[{order_id:'order',images:[url,other]}]},northMarketReviewDraft:{id:'order',account:'main',images:[url]},viewImg:u=>seen.push(u),toast(){},northMarketArgument:JSON.stringify,northMarketImage:()=>'<img>'};vm.createContext(ctx);vm.runInContext(block+'\nthis.photo=northMarketReviewPhoto',ctx);
 assert.match(ctx.photo(url,'order',0,false),/button.*aria-label=.*onclick="northMarketReviewImageOpen/);ctx.window.northMarketReviewImageOpen('order',1,false);assert.equal(seen[0],other);
 ctx.northMarketView.page='review-inbox';ctx.window.northMarketReviewImageOpen('order',0,false);assert.equal(seen[1],url);
 ctx.northMarketView.page='review-write';ctx.window.northMarketReviewImageOpen('order',0,true);assert.equal(seen[2],url);assert.match(ctx.photo(url,'order',0,true),/^<span/);
 account='other';ctx.window.northMarketReviewImageOpen('order',0,true);assert.equal(seen.length,3);account='main';ctx.northMarketView.page='reviews';ctx.northMarketView.rows[0].images[0]='javascript:alert(1)';ctx.window.northMarketReviewImageOpen('order',0,false);ctx.window.northMarketReviewImageOpen('order',-1,false);ctx.window.northMarketReviewImageOpen('missing',1,false);assert.equal(seen.length,3);
});

for(const priv of [false,true]) test((priv?'private':'web')+' approved role payment submits once without a user PIN while rejection and failed approval never submit',async()=>{
 const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8'),decision=src.match(/  async function northMarketRoleDecision\(c,id,reject\)\{[^\n]+/)[0],continuation=src.match(/  window.northMarketRoleContinue=(?:async )?function\(id\)\{[^\n]+/)[0];
 const role={id:'role'},message={northRequestId:'request'},request={id:'request',account:'main',roleId:'role',status:'pending',draft:{roleId:'role',client:'request',rows:[]}};let paid=0,allowed=true;
 const ctx={window:{},S:{},actId:()=> 'main',northMarketBusy:false,northSaving:false,northMarketRequests:()=>[request],northMarketRequestValid:()=>true,northMarketCoupleRole:()=>role,northMarketPinOpen:()=>assert.fail('no second PIN'),northCommit:async fn=>{const undo=fn();if(!allowed)undo();return allowed;},msgs:()=>[message],save(){},toast(){},northMarketSubmitOrder:async pin=>{assert.equal(pin,'');assert.equal(ctx.northMarketPayDraft.roleApproved,true);paid++;request.status='paid';return true;}};vm.createContext(ctx);vm.runInContext(continuation+'\n'+decision+'\nthis.decide=northMarketRoleDecision',ctx);ctx.northMarketRoleContinue=ctx.window.northMarketRoleContinue;
 await ctx.decide(role,'request',false);assert.equal(paid,1);await ctx.decide(role,'request',false);assert.equal(paid,1,'paid approval cannot submit twice');request.status='pending';await ctx.decide(role,'request',true);assert.equal(paid,1);assert(message._rejected);request.status='pending';allowed=false;await ctx.decide(role,'request',false);assert.equal(paid,1);assert.equal(request.status,'pending');
});

for(const priv of [false,true]) test((priv?'private':'web')+' asset order counter chooses cloud seller totals and never invents zero from local purchase history',()=>{const src=readFileSync(new URL(priv?'../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js':'../commerce-ui.js',import.meta.url),'utf8'),code=src.match(/  function northMyAssetOrders\(\)\{[^\n]+/)[0];const ctx={actId:()=> 'main',northMarketWalletCache:{account:'main',data:{shopCount:1,sellerOrderCount:83,buyerOrderCount:6}},northMarketMyCache:null};vm.createContext(ctx);vm.runInContext(code+'\nthis.counter=northMyAssetOrders',ctx);assert.equal(ctx.counter().count,83);assert.equal(ctx.counter().seller,true);ctx.northMarketWalletCache.data.shopCount=0;assert.equal(ctx.counter().count,6);assert.equal(ctx.counter().seller,false);ctx.northMarketWalletCache.account='other';assert.equal(ctx.counter().count,'—');});
