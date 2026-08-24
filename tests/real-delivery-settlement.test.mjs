import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
let sequence=0;
let remoteStatus='pending_payment';
let createFails=false;
const role={id:'role-settlement',name:'North',avatar:'🖤'};
const calls=[];
const ctx={
  console,URL,AbortController,JSON,Date,Math,Promise,Number,String,Array,Object,RegExp,
  COMPANION_URL:'https://delivery.example.test',COMPANION_KEY:'public-test-key',
  APP_VER:'v-test',S:{me:{name:'我'},food:{cart:[],results:[],q:''},contacts:[role]},
  _foodBusy:false,foodSearch(){},foodBuy(){},openFoodCart(){},openFoodOrders(){},
  privateNativeAppOn(){return false;},save(){},render(){},toast(){},uid(){return 'id-'+(++sequence);},
  getC(id){return id===role.id?role:null;},cur(){return{p:'home'};},scheduleReply(){return true;},
  chatAPI:async()=>'{"matched":true,"offerId":"offer-1","reason":""}',esc:s=>String(s),av:s=>String(s),
  openModal(){},closeModal(){},document:{hidden:false,getElementById(){return null;},addEventListener(){}},
  setInterval(){return 1;},setTimeout(){return 1;},clearTimeout(){},addEventListener(){},open(){},
};
ctx.window=ctx;
ctx.fetch=async(_url,init)=>{
  const body=JSON.parse(init.body);calls.push(body);
  if(body.action==='confirm_address')return {ok:true,status:200,json:async()=>({ok:true,data:{addressLabel:'家',addressFingerprint:'addr-1'}})};
  if(body.action==='search')return {ok:true,status:200,json:async()=>({ok:true,data:{offers:[{offerId:'offer-1',provider:'taobao_flash',merchantId:'m1',merchant:'真实奶茶店',name:'真实奶茶',price:18,deliveryFee:2,total:20,quoteId:'q1',addressFingerprint:'addr-1',optionsLoaded:true,optionGroups:[]}]}})};
  if(body.action==='create_order')return createFails?{ok:false,status:503,json:async()=>({ok:false,error:'网络中断'})}:{ok:true,status:200,json:async()=>({ok:true,data:{orderId:'order-1',provider:'taobao_flash',merchantId:'m1',merchant:'真实奶茶店',items:[{name:'真实奶茶',quantity:1,price:18}],total:20,status:'created',addressFingerprint:'addr-1'}})};
  if(body.action==='pay_order')return {ok:true,status:200,json:async()=>({ok:true,data:{status:'pending_payment',paymentMethod:'alipay',payUrl:'javascript:alert(1)'}})};
  if(body.action==='order_status')return {ok:true,status:200,json:async()=>({ok:true,data:{status:remoteStatus,total:20,addressFingerprint:'addr-1'}})};
  throw new Error('unexpected action '+body.action);
};

vm.runInNewContext(source,ctx,{filename:'delivery.js'});
const roleAction=(turn,userText='帮我点一杯奶茶')=>({structuredModelAction:true,allowNewTask:true,accountId:'main',sessionId:'role-settlement:main',turnId:turn,messageId:turn,modelReplyId:'reply-'+turn,channel:'chat',userText});
ctx.S.food.real.connectorUrl='https://delivery.example.test/api';
ctx.deliverySetEnabled(true);
await ctx.deliveryConfirmAddress();
assert.equal(ctx.S.food.real.approvedAddressFingerprint,'addr-1','the user can explicitly approve the current address');

role.deliveryWallet={balance:100,singleLimit:100,dailyLimit:200,spentDay:'',spentToday:0,ledger:[]};
await ctx.deliveryHandleRoleRequest(role.id,'用户明确；门店=真实奶茶店；商品=真实奶茶',roleAction('turn-1'));
const order=ctx.S.food.orders[0];
assert.equal(order.status,'pending_payment');
assert.equal(order.payUrl,'','unsafe payment URLs must be rejected');
assert.equal(role.deliveryWallet.balance,100,'the retired role wallet is never debited');
const createCall=calls.find(x=>x.action==='create_order');
const payCall=calls.find(x=>x.action==='pay_order');
assert.ok(createCall.payload.clientRequestId,'order creation must carry an idempotency key');
assert.ok(payCall.payload.clientRequestId,'payment must carry an idempotency key');
assert.equal(payCall.payload.automatic,false,'ordinary users always receive a本人付款 request');

remoteStatus='paid';
await ctx.deliveryPollOrders(false);
assert.equal(order.status,'paid');
assert.equal(role.deliveryWallet.balance,100,'platform payment status does not mutate a fake wallet');
assert.equal(role.deliveryWallet.spentToday,0);
await ctx.deliveryPollOrders(false);
assert.equal(role.deliveryWallet.balance,100,'repeated paid receipts still do not mutate a fake wallet');

remoteStatus='refunded';
await ctx.deliveryPollOrders(false);
assert.equal(order.status,'refunded');
assert.equal(role.deliveryWallet.balance,100,'a platform refund leaves the retired wallet untouched');
assert.equal(role.deliveryWallet.spentToday,0);

ctx.S.food.orders.unshift({id:'order-2',remoteId:'order-2',real:true,status:'delivering',total:15,roleId:'',createdAt:Date.now(),notifiedStatuses:[]});
remoteStatus='preparing';
await ctx.deliveryPollOrders(false);
assert.equal(ctx.S.food.orders[0].status,'delivering','stale platform responses must not move an order backwards');

createFails=true;
await ctx.deliveryHandleRoleRequest(role.id,'用户明确；门店=真实奶茶店；商品=真实奶茶',roleAction('turn-2'));
await ctx.deliveryHandleRoleRequest(role.id,'用户明确；门店=真实奶茶店；商品=真实奶茶',roleAction('turn-2'));
const failedCreates=calls.filter(x=>x.action==='create_order').slice(-1);
assert.equal(failedCreates.length,1);
assert.ok(failedCreates[0].payload.task.taskId,'the failed create remains bound to one durable task id');
assert.equal(calls.filter(x=>x.action==='create_order'&&x.payload.task.taskId===failedCreates[0].payload.task.taskId).length,1,'replaying the same model turn must not create a second order attempt');

const beforeDifferentText=calls.length;
await ctx.deliveryHandleRoleRequest(role.id,'用户明确；门店=另一家奶茶店；商品=果汁',roleAction('turn-2','改成另一家果汁'));
assert.equal(calls.length,beforeDifferentText,'the same user turn cannot create a second task by changing merchant or product text');

const beforeBackground=calls.length;
await ctx.deliveryHandleRoleRequest(role.id,'主动关心；门店=任意奶茶店；商品=果汁',{...roleAction('turn-3','之前说过想喝东西'),allowNewTask:false});
assert.equal(calls.length,beforeBackground,'a background or restored model reply cannot start search from stale user text');

console.log('real delivery settlement tests passed');
