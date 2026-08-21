import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const notices=[];
let oldSearchCalls=0;
let sequence=0;
const role={id:'role-1',name:'North',remark:'',avatar:'🖤'};
const ctx={
  console,URL,AbortController,JSON,Date,Math,Promise,Number,String,Array,Object,RegExp,
  COMPANION_URL:'https://delivery.example.test',COMPANION_KEY:'public-test-key',
  APP_VER:'v-test',S:{me:{name:'我'},food:{cart:[],results:[],q:''},contacts:[role]},
  _foodBusy:false,
  foodSearch(){oldSearchCalls++;},foodBuy(){},openFoodCart(){},openFoodOrders(){},
  privateNativeAppOn(){return false;},save(){},render(){},toast(){},uid(){return 'id-'+(++sequence);},
  getC(id){return id===role.id?role:null;},cur(){return{p:'home'};},
  scheduleReply(id,note){notices.push({id,note});return true;},
  chatAPI:async()=>'{"matched":true,"offerId":"offer-1","reason":""}',
  esc:s=>String(s),av:s=>String(s),openModal(){},closeModal(){},
  document:{hidden:false,getElementById(id){return id==='food_q'?{value:'奶茶'}:null;},addEventListener(){}},
  setInterval(){return 1;},setTimeout(){return 1;},clearTimeout(){},
  addEventListener(){},open(){},
};
ctx.window=ctx;
vm.runInNewContext(source,ctx,{filename:'delivery.js'});

assert.equal(ctx.deliveryRealEnabled(),false,'real delivery defaults off at runtime');
await ctx.foodSearch();
assert.equal(oldSearchCalls,1,'virtual search remains active while real delivery is off');

ctx.S.food.real.connectorUrl='https://delivery.example.test/api';
ctx.deliverySetEnabled(true);
let mode='search-fail';
ctx.fetch=async(_url,init)=>{
  const body=JSON.parse(init.body);
  if(mode==='search-fail')return {ok:false,status:503,json:async()=>({ok:false,error:'平台维护'})};
  if(body.action==='search')return {ok:true,status:200,json:async()=>({ok:true,data:{offers:[{offerId:'offer-1',provider:'taobao_flash',merchantId:'m1',merchant:'真实奶茶店',name:'真实奶茶',price:18,deliveryFee:2,total:20,quoteId:'q1',addressFingerprint:'addr-1',optionsLoaded:true,optionGroups:[]}]}})};
  if(body.action==='create_order')return {ok:true,status:200,json:async()=>({ok:true,data:{orderId:'order-1',provider:'taobao_flash',merchantId:'m1',merchant:'真实奶茶店',items:[{name:'真实奶茶',quantity:1,price:18}],total:20,status:'created',addressFingerprint:'addr-1'}})};
  if(body.action==='pay_order')return {ok:true,status:200,json:async()=>({ok:true,data:{status:'pending_payment',paymentMethod:'alipay',payUrl:'https://alipay.example.test/cashier'}})};
  throw new Error('unexpected action '+body.action);
};
await ctx.foodSearch();
assert.equal(oldSearchCalls,1,'real search failure must never call the virtual search fallback');
assert.equal(ctx.S.food.results.length,0,'real search failure leaves the result list empty');

mode='success';
await ctx.foodSearch();
assert.equal(ctx.S.food.results.length,1);
assert.equal(ctx.S.food.results[0].merchant,'真实奶茶店');

ctx.S.food.real.approvedAddressFingerprint='addr-1';
role.deliveryWallet={balance:100,singleLimit:100,dailyLimit:200,spentDay:'',spentToday:0,ledger:[]};
await ctx.deliveryHandleRoleRequest(role.id,'奶茶');
assert.equal(ctx.S.food.orders[0].status,'pending_payment','ordinary users receive an official unpaid order');
assert.equal(role.deliveryWallet.balance,100,'the retired role wallet is never debited');
assert.equal(role.deliveryWallet.spentToday,0);
assert.equal(notices.length,1,'the role receives one model-generation fact prompt for the result');
assert.match(notices[0].note,/当前真实状态：待付款/);

console.log('real delivery state-machine tests passed');
