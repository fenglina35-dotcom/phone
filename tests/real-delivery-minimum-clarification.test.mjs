import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const requests=[];
const notices=[];
const role={id:'role-soup',name:'North',remark:'',avatar:'🖤'};
let sequence=0;
const ctx={
  console,URL,AbortController,JSON,Date,Math,Promise,Number,String,Array,Object,RegExp,
  COMPANION_URL:'https://delivery.example.test',COMPANION_KEY:'public-test-key',APP_VER:'v-test',
  S:{me:{name:'我'},food:{cart:[],results:[],q:''},contacts:[role]},_foodBusy:false,
  foodSearch(){},foodBuy(){},openFoodCart(){},openFoodOrders(){},privateNativeAppOn(){return false;},
  save(){},render(){},toast(){},uid(){return 'id-'+(++sequence);},getC(id){return id===role.id?role:null;},
  cur(){return{p:'home'};},scheduleReply(id,note){notices.push({id,note});return true;},msgs(){return[];},
  chatAPI:async()=>'{"matched":true,"offerId":"soup-offer","reason":""}',esc:String,av:String,
  openModal(){},closeModal(){},document:{hidden:false,getElementById(){return null;},addEventListener(){}},
  setInterval(){return 1;},setTimeout(){return 1;},clearTimeout(){},addEventListener(){},open(){},
};
ctx.window=ctx;
vm.runInNewContext(source,ctx,{filename:'delivery.js'});
ctx.S.food.real.connectorUrl='https://delivery.example.test/api';
ctx.deliverySetEnabled(true);
ctx.S.food.real.approvedAddressFingerprint='addr-1';

let createAttempts=0;
ctx.fetch=async(_url,init)=>{
  const body=JSON.parse(init.body);requests.push(body);
  if(body.action==='search')return {ok:true,status:200,json:async()=>({ok:true,data:{offers:[{
    offerId:'soup-offer',provider:'taobao_flash',merchantId:'shop-1',merchant:'杨姥佬家de撒汤',
    name:'（招牌）营养鸡丝 撒汤',price:8.9,deliveryFee:2.8,total:11.7,quoteId:'quote-1',
    quoteExpiresAt:Date.now()+120000,addressFingerprint:'addr-1',optionsLoaded:true,optionGroups:[],
  }]}})};
  if(body.action==='create_order'){
    createAttempts++;
    if(createAttempts===1)return {ok:false,status:409,json:async()=>({ok:false,error:'该门店最低起送金额为¥20.00，当前类别没有可自动添加的同店小料或小吃；请让角色先问你要加什么'})};
    return {ok:true,status:200,json:async()=>({ok:true,data:{
      orderId:'order-soup',provider:'taobao_flash',merchantId:'shop-1',merchant:'杨姥佬家de撒汤',
      items:[
        {name:'（招牌）营养鸡丝 撒汤',quantity:1,price:8.9},
        {name:'爆款鲜肉煎饺（8个）',quantity:1,price:7.8},
        {name:'金陵/灌汤包（6个）',quantity:1,price:7.8},
      ],total:24.5,status:'created',addressFingerprint:'addr-1',
    }})};
  }
  if(body.action==='pay_order')return {ok:true,status:200,json:async()=>({ok:true,data:{status:'pending_payment',paymentMethod:'alipay',payUrl:'https://alipay.example.test/cashier'}})};
  throw new Error('unexpected action '+body.action);
};

const firstAction={structuredModelAction:true,allowNewTask:true,accountId:'main',sessionId:'role-soup:main',turnId:'message-1',messageId:'message-1',modelReplyId:'reply-1',channel:'chat',userText:'我要吃杨姥姥家的撒汤'};
await ctx.deliveryHandleRoleRequest(role.id,'用户明确；门店=杨姥佬家de撒汤；商品=撒汤',firstAction);
const firstSearch=requests.find(row=>row.action==='search');
const task=ctx.S.food.real.roleTasks[firstSearch.payload.task.taskId];
assert.equal(task.status,'awaiting_clarification');
assert.equal(task.revision,2,'asking the minimum-order question reserves exactly the next task revision');

ctx.deliveryCaptureClarificationCandidates(role.id,'还有煎饺和灌汤包，你要加哪个。',firstAction);
const secondAction={...firstAction,turnId:'message-2',messageId:'message-2',modelReplyId:'reply-2',userText:'都要！'};
await ctx.deliveryTryClarificationFallback(role.id,'都要！',secondAction);

const searches=requests.filter(row=>row.action==='search');
assert.equal(searches.length,2);
assert.equal(searches[1].payload.task.taskId,searches[0].payload.task.taskId,'the add-on answer must continue the original task');
assert.equal(searches[1].payload.task.revision,searches[0].payload.task.revision+1,'the add-on answer must advance only one revision');
assert.deepEqual(searches[1].payload.orderIntent.items,['撒汤','煎饺','灌汤包']);
assert.equal(ctx.S.food.orders.length,1);
assert.deepEqual(ctx.S.food.orders[0].items.map(item=>[item.name,item.quantity]),[
  ['（招牌）营养鸡丝 撒汤',1],['爆款鲜肉煎饺（8个）',1],['金陵/灌汤包（6个）',1],
]);
assert.equal(ctx.S.food.orders[0].status,'pending_payment');
assert.equal(createAttempts,2,'the failed draft and the one clarified continuation are the only create attempts');

console.log('real delivery minimum-order clarification tests passed');
