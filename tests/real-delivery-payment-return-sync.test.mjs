import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const role={id:'role-payment-sync',name:'North',avatar:'🖤'};
const order={
  id:'local-order-1',remoteId:'remote-order-1',real:true,roleId:role.id,accountId:'main',
  merchant:'曼玲粥店',items:[{name:'燕麦牛奶粥',quantity:1,price:16},{name:'茶叶蛋',quantity:1,price:3}],
  total:19,status:'pending_payment',paymentMethod:'alipay',payUrl:'https://cashier.example.test/pay/1',
  createdAt:Date.now(),updatedAt:Date.now(),lastPaymentSyncAt:Date.now(),notifiedStatuses:[],
};
const requests=[];
const replies=[];
const opened=[];
const sheets=[];
const messages=[{id:'delivery-card-1',type:'deliveryorder',orderId:order.id,remoteId:order.remoteId,order:{...order}}];
const ctx={
  console,URL,AbortController,JSON,Date,Math,Promise,Number,String,Array,Object,RegExp,
  COMPANION_URL:'https://delivery.example.test',COMPANION_KEY:'public-test-key',APP_VER:'v-test',
  S:{me:{name:'我'},food:{cart:[],results:[],q:'',orders:[order],real:{enabled:true}},contacts:[role]},
  _foodBusy:false,foodSearch(){},foodBuy(){},openFoodCart(){},openFoodOrders(){},
  privateNativeAppOn(){return false;},save(){},render(){},toast(){},uid(){return 'test-id';},
  actId(){return'main';},
  getC(id){return id===role.id?role:null;},cur(){return{p:'home'};},
  msgs(id){return id===role.id?messages:[];},
  scheduleReply(id,note){replies.push({id,note});return true;},
  esc:value=>String(value),av:value=>String(value),openModal(html){sheets.push(String(html));},closeModal(){},
  document:{hidden:false,getElementById(){return null;},addEventListener(){}},
  setInterval(){return 1;},setTimeout(){return 1;},clearTimeout(){},addEventListener(){},
  open(url,target,features){opened.push({url,target,features});},
};
ctx.window=ctx;
ctx.fetch=async(_url,init)=>{
  const body=JSON.parse(init.body);requests.push(body);
  if(body.action==='order_status')return {ok:true,status:200,json:async()=>({ok:true,data:{status:'paid',total:19,paymentMethod:'alipay',addressFingerprint:'addr-1'}})};
  throw new Error(`unexpected action ${body.action}`);
};

vm.runInNewContext(source,ctx,{filename:'delivery.js'});
ctx.S.food.real.enabled=true;

ctx.deliveryOpenChatOrder(role.id,messages[0].id);
assert.match(sheets.at(-1),/<small>订单状态<\/small><b>订单已提交<\/b>/,'an existing pending checkout opens as a submitted order after an update');
assert.doesNotMatch(sheets.at(-1),/<small>订单状态<\/small><b>待付款<\/b>/,'the role chat-card detail no longer exposes the internal pending-payment label');
assert.doesNotMatch(sheets.at(-1),/我已确认付款/,'the detail remains visually clean without a manual confirmation button');

ctx.deliveryLaunchPay(order.id);
assert.equal(opened.length,1,'the official payment handoff opens exactly once');
assert.ok(order.paymentHandoffAt,'opening the official cashier arms a return-status check');

const synced=await ctx.deliverySyncPaymentReturn('focus');
assert.equal(synced,true,'returning from payment checks the existing order');
assert.equal(order.status,'paid','the platform payment receipt is written back to the original order');
assert.ok(order.paymentConfirmedAt,'the confirmed payment time is persisted');
assert.equal(requests.filter(item=>item.action==='order_status').length,1,'only one bounded status request is issued');
assert.equal(requests.find(item=>item.action==='order_status').payload.orderId,order.remoteId,'the return hook reconciles the exact handed-off order');
assert.equal(requests.filter(item=>item.action==='search'||item.action==='create_order').length,0,'payment reconciliation never searches or creates another order');
assert.equal(replies.length,1,'the owning role receives the real paid status once');
assert.match(replies[0].note,/平台确认处于「已付款」/);

const prompt=ctx.deliveryRolePrompt(role);
assert.match(prompt,/"status":"paid"/,'later role replies keep the confirmed order status');
assert.match(prompt,/order_submitted/,'a submitted checkout remains a durable order fact for later role turns');
assert.match(prompt,/绝不能拿旧同步结果指责TA没付款或没吃/,'a stale platform state cannot override the user current statement');

await ctx.deliverySyncPaymentReturn('focus');
assert.equal(requests.filter(item=>item.action==='order_status').length,1,'a confirmed order is never polled twice by the return hook');

console.log('real delivery payment return sync tests passed');
