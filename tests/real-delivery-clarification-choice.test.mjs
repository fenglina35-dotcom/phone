import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function makeRuntime(answer){
  let n=0;
  const now=Date.now();
  const role={id:'role-1',name:'先生'};
  const messages=[
    {id:'a1',role:'assistant',type:'text',content:'撒汤差一点起送价。',time:now-700},
    {id:'a2',role:'assistant',type:'text',content:'那家店里还有煎饺和灌汤包。',time:now-600},
    {id:'a3',role:'assistant',type:'text',content:'你要加哪个。',time:now-500},
    {id:'user-current',role:'user',type:'text',content:answer,time:now-100},
  ];
  const searches=[];
  const ctx={
    console,URL,AbortController,JSON,Date,Math,Promise,Number,String,Array,Object,RegExp,
    COMPANION_URL:'https://delivery.example.test',COMPANION_KEY:'public-test-key',APP_VER:'v-test',
    S:{me:{name:'我'},food:{cart:[],results:[],q:'',orders:[]},contacts:[role]},_foodBusy:false,
    foodSearch(){},foodBuy(){},openFoodCart(){},openFoodOrders(){},privateNativeAppOn(){return false;},
    save(){},render(){},toast(){},uid(){return 'id-'+(++n);},getC(id){return id===role.id?role:null;},
    cur(){return{p:'home'};},scheduleReply(){return true;},msgs(id){return id===role.id?messages:[];},
    msgToText(m){return m&&m.content||'';},esc:String,av:String,openModal(){},closeModal(){},
    document:{hidden:false,getElementById(){return null;},addEventListener(){}},setInterval(){return 1;},
    setTimeout(){return 1;},clearTimeout(){},addEventListener(){},open(){},chatAPI:async()=>'',
  };
  ctx.window=ctx;
  ctx.fetch=async(_url,init)=>{
    const body=JSON.parse(init.body);
    if(body.action==='search'){
      searches.push({taskId:body.payload.task.taskId,items:[...body.payload.orderIntent.items]});
      return {ok:true,status:200,json:async()=>({ok:true,data:{offers:[{
        offerId:'offer-1',provider:'taobao_flash',merchantId:'shop-1',merchant:'杨姥佬家de撒汤',
        name:'乌鸡撒汤、煎饺、灌汤包1人套餐',price:21.8,total:21.8,quoteId:'quote-1',
        addressFingerprint:'addr-1',optionsLoaded:true,optionGroups:[],
      }]}})};
    }
    if(body.action==='create_order')return {ok:true,status:200,json:async()=>({ok:true,data:{orderId:'order-1',provider:'taobao_flash',merchant:'杨姥佬家de撒汤',merchantId:'shop-1',items:body.payload.task.userConstraints.includes('都要')?[{name:'撒汤',quantity:1},{name:'煎饺',quantity:1},{name:'灌汤包',quantity:1}]:[{name:'撒汤',quantity:1},{name:'灌汤包',quantity:1}],total:21.8,status:'created'}})};
    if(body.action==='pay_order')return {ok:true,status:200,json:async()=>({ok:true,data:{status:'pending_payment',paymentMethod:'alipay',payQrDataUrl:'data:image/png;base64,iVBORw0KGgo='}})};
    throw new Error('unexpected action '+body.action);
  };
  vm.runInNewContext(source,ctx,{filename:'delivery.js'});
  ctx.S.food.real.connectorUrl='https://delivery.example.test/api';
  ctx.S.food.real.enabled=true;
  ctx.S.food.real.approvedAddressFingerprint='addr-1';
  const task={
    taskId:'delivery-existing',authorizationSource:'user_explicit',roleId:role.id,accountId:'main',
    sessionId:'role-1:main',turnId:'user-original',messageId:'user-original',createdAt:now-2000,
    updatedAt:now-800,startedAt:now-2000,endedAt:0,expiresAt:now+30*60000,status:'awaiting_clarification',
    query:'用户明确；门店=杨姥佬家de撒汤；商品=撒汤',orderIntent:{merchant:'杨姥佬家de撒汤',items:['撒汤'],proactive:false},
    userMessages:['我想吃撒汤'],authorizationConstraints:'我想吃撒汤',completedItems:[],revision:2,
    clarification:{kind:'minimum_order',question:'要补哪一种同店小吃'},
  };
  ctx.S.food.real.roleTasks[task.taskId]=task;
  ctx.S.food.real.roleAttempts[role.id]=task;
  ctx.S.food.real.roleClarifications[role.id]={taskId:task.taskId,kind:'minimum_order',query:task.query,merchant:'杨姥佬家de撒汤',item:'撒汤',reason:'未达到起送价',at:now-800};
  const meta={structuredModelAction:true,allowNewTask:true,accountId:'main',sessionId:'role-1:main',turnId:'user-current',messageId:'user-current',modelReplyId:'reply-current',channel:'chat',userText:answer};
  return {ctx,searches,meta,task};
}

test('a named add-on resumes only that item on the original task',async()=>{
  const {ctx,searches,meta}=makeRuntime('要那个灌汤包');
  await ctx.deliveryTryClarificationFallback('role-1','要那个灌汤包',meta);
  assert.deepEqual(searches,[{taskId:'delivery-existing',items:['撒汤','灌汤包']}]);
});

test('都要 resumes every candidate named by the role and stays idempotent',async()=>{
  const {ctx,searches,meta,task}=makeRuntime('都要');
  await ctx.deliveryTryClarificationFallback('role-1','都要',meta);
  assert.deepEqual(searches,[{taskId:'delivery-existing',items:['撒汤','煎饺','灌汤包']}]);
  assert.deepEqual(Array.from(task.clarificationResolution.selectedAddons),['煎饺','灌汤包']);
  assert.equal(await ctx.deliveryTryClarificationFallback('role-1','都要',meta),false);
  assert.equal(searches.length,1,'the same clarification answer must not start twice');
});

test('an unclear answer cannot guess a candidate or create a new search',async()=>{
  const {ctx,searches,meta}=makeRuntime('你看着办');
  assert.equal(await ctx.deliveryTryClarificationFallback('role-1','你看着办',meta),false);
  assert.equal(searches.length,0);
});

test('a one-word role approval repairs an explicit current delivery turn only once',()=>{
  const {ctx,meta}=makeRuntime('我想吃杨姥佬家的撒汤');
  delete ctx.S.food.real.roleClarifications['role-1'];
  meta.userText='我想吃杨姥佬家的撒汤';
  const prompt=ctx.deliveryMissingActionRepairPrompt('role-1',meta.userText,'好',meta);
  assert.match(prompt,/真实外卖动作补判/);
  assert.match(prompt,/只输出一行完整的 \[真实外卖\|/);
  assert.equal(ctx.deliveryMissingActionRepairPrompt('role-1',meta.userText,'好',meta),'','the same message may run at most one genuine-model repair');
});

test('an ordinary chat followed by 好 cannot enter delivery repair',()=>{
  const {ctx,meta}=makeRuntime('今天在忙什么');
  delete ctx.S.food.real.roleClarifications['role-1'];
  meta.userText='今天在忙什么';
  assert.equal(ctx.deliveryMissingActionRepairPrompt('role-1',meta.userText,'好',meta),'');
});

test('the role can repair a current autonomous meal-care decision without waiting for a direct order',()=>{
  const {ctx,meta}=makeRuntime('我今天没吃饭');
  delete ctx.S.food.real.roleClarifications['role-1'];
  meta.userText='我今天没吃饭';
  const prompt=ctx.deliveryMissingActionRepairPrompt('role-1',meta.userText,'等着。',meta);
  assert.match(prompt,/你本人在当前回合基于人设与上下文自主决定/);
  assert.match(prompt,/自主决定必须使用“主动关心”来源/);
});

test('a terse 都要 clarification can use the original task without another user message',()=>{
  const {ctx,meta}=makeRuntime('都要');
  const prompt=ctx.deliveryMissingActionRepairPrompt('role-1','都要','行，都给你点。',meta);
  assert.match(prompt,/澄清回答必须严格沿用上方原 taskId 语义/);
});

test('chat wiring tries same-task fallback first, then one hidden real-model action repair',()=>{
  assert.match(app,/_deliveryClarificationFallbackHandled=false[\s\S]*?deliveryTryClarificationFallback\(id,_userText,_deliveryActionMeta\)/);
  assert.match(app,/deliveryMissingActionRepairPrompt\(id,_userText,content,_deliveryActionMeta\)[\s\S]*?await chatAPI\(/);
  assert.match(app,/_deliveryRepairActions\.length===1[\s\S]*?\+'\\n\[真实外卖\|'/);
  assert.doesNotMatch(app,/deliveryRequestPreludeRetry\(id/,'missing actions must be repaired in the same authorized turn, not by scheduling a new background turn');
});
