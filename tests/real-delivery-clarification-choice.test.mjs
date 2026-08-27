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
  const searches=[],merchants=[];
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
      merchants.push(body.payload.orderIntent.merchant);
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
  return {ctx,searches,merchants,meta,task};
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

test('role-listed add-ons are stored on the same task before a terse answer arrives',async()=>{
  const {ctx,searches,meta,task}=makeRuntime('都要');
  const stored=ctx.deliveryCaptureClarificationCandidates('role-1','这家店里可以点煎饺和灌汤包，你要哪个。',meta);
  assert.deepEqual(Array.from(stored),['煎饺','灌汤包']);
  assert.deepEqual(Array.from(task.clarificationCandidates),['煎饺','灌汤包']);
  ctx.msgs('role-1').splice(0,3);
  await ctx.deliveryTryClarificationFallback('role-1','都要',meta);
  assert.deepEqual(searches,[{taskId:'delivery-existing',items:['撒汤','煎饺','灌汤包']}]);
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

test('a precise merchant and product reply stays actionable without repeating 点 or 想喝',async()=>{
  const {ctx,searches,merchants,meta}=makeRuntime('李若桃家的：草莓桃儿白糯米酸奶昔');
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText='李若桃家的：草莓桃儿白糯米酸奶昔';
  await ctx.deliveryTryExplicitApprovalFallback('role-1',meta.userText,'等我看看。',meta);
  assert.deepEqual(merchants,['李若桃']);
  assert.deepEqual(searches[0].items,['草莓桃儿白糯米酸奶昔']);
});

test('a natural brand product and specification starts on the first current ordering turn',async()=>{
  const request='百分茶的暴打土芭乐柠檬茶，不另加糖';
  const {ctx,searches,merchants,meta}=makeRuntime(request);
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText=request;
  await ctx.deliveryTryExplicitApprovalFallback('role-1',request,'等我看看。',meta);
  assert.deepEqual(merchants,['百分茶']);
  assert.deepEqual(searches,[{taskId:'delivery_id-1',items:['暴打土芭乐柠檬茶']}]);
  const task=Object.values(ctx.S.food.real.roleTasks)[0];
  assert.match(task.query,/门店=百分茶；商品=暴打土芭乐柠檬茶；规格=不另外加糖/);
});

test('a malformed current structured action is repaired from the natural brand product sentence',async()=>{
  const request='百分茶的暴打土芭乐柠檬茶，不另加糖';
  const {ctx,searches,merchants,meta}=makeRuntime(request);
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText=request;
  await ctx.deliveryHandleRoleRequest('role-1','用户明确',meta);
  assert.deepEqual(merchants,['百分茶']);
  assert.deepEqual(searches,[{taskId:'delivery_id-1',items:['暴打土芭乐柠檬茶']}]);
  const task=Object.values(ctx.S.food.real.roleTasks)[0];
  assert.match(task.query,/规格=不另外加糖/);
});

test('history refusal and opinion sentences never enter the natural ordering bridge',async()=>{
  for(const request of ['我以前喝过百分茶的暴打土芭乐柠檬茶','不要点百分茶的暴打土芭乐柠檬茶','你觉得百分茶的暴打土芭乐柠檬茶怎么样']){
    const {ctx,searches,meta}=makeRuntime(request);
    delete ctx.S.food.real.roleClarifications['role-1'];
    delete ctx.S.food.real.roleAttempts['role-1'];
    ctx.S.food.real.roleTasks={};
    meta.userText=request;
    assert.equal(await ctx.deliveryTryExplicitApprovalFallback('role-1',request,'等我看看。',meta),false,request);
    assert.equal(ctx.deliveryMissingActionRepairPrompt('role-1',request,'等我看看。',meta),'',request);
    assert.equal(searches.length,0,request);
  }
});

test('a precise merchant and product turn reaches genuine-model repair even with an unusual role reply',()=>{
  const {ctx,meta}=makeRuntime('李若桃家的：草莓桃儿白糯米酸奶昔');
  delete ctx.S.food.real.roleClarifications['role-1'];
  meta.userText='李若桃家的：草莓桃儿白糯米酸奶昔';
  const prompt=ctx.deliveryMissingActionRepairPrompt('role-1',meta.userText,'我来处理。',meta);
  assert.match(prompt,/你的当前真实决定是唯一授权/);
  assert.match(prompt,/不要因为缺少“点”字(?:或冒号)?而漏掉/);
});

test('a later fresh message can retry the same precise item without being swallowed by the prior task',async()=>{
  const {ctx,searches,meta}=makeRuntime('李若桃家的：草莓桃儿白糯米酸奶昔');
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText='李若桃家的：草莓桃儿白糯米酸奶昔';
  await ctx.deliveryTryExplicitApprovalFallback('role-1',meta.userText,'等我看看。',meta);
  const retry={...meta,turnId:'user-retry',messageId:'user-retry',modelReplyId:'reply-retry'};
  await ctx.deliveryTryExplicitApprovalFallback('role-1',retry.userText,'这次我来。',retry);
  assert.equal(searches.length,2);
  assert.notEqual(searches[0].taskId,searches[1].taskId);
});

test('an autonomous role commitment can request a structured decision without a food keyword in the user turn',()=>{
  const {ctx,meta}=makeRuntime('今天有点忙');
  delete ctx.S.food.real.roleClarifications['role-1'];
  meta.userText='今天有点忙';
  const prompt=ctx.deliveryMissingActionRepairPrompt('role-1',meta.userText,'你忙你的，我去给你点点吃的。',meta);
  assert.match(prompt,/主动关心/);
});

test('a genuine one-word approval directly starts an explicit order without a second model call',async()=>{
  const {ctx,searches,merchants,meta}=makeRuntime('我想吃那个杨姥姥家de撒汤，商品名叫：撒汤');
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText='我想吃那个杨姥姥家de撒汤，商品名叫：撒汤';
  await ctx.deliveryTryExplicitApprovalFallback('role-1',meta.userText,'好。',meta);
  assert.deepEqual(searches,[{taskId:'delivery_id-1',items:['撒汤']}]);
  assert.deepEqual(merchants,['杨姥姥']);
});

test('a McDonalds breakfast bundle request is normalized to the homepage bundle and exact option labels',async()=>{
  const request='先生我要吃麦当劳套餐要选那个吉士蛋+油条+要豆浆🥺';
  const {ctx,searches,merchants,meta}=makeRuntime(request);
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText=request;
  await ctx.deliveryTryExplicitApprovalFallback('role-1',request,'等着。',meta);
  assert.deepEqual(merchants,['麦当劳']);
  assert.deepEqual(searches,[{taskId:'delivery_id-1',items:['麦满分单人餐随心选']}]);
  const task=Object.values(ctx.S.food.real.roleTasks)[0];
  assert.match(task.query,/规格=吉士蛋麦满分、脆香油条、小杯优品豆浆/);
});

test('a malformed current structured action is repaired from the same explicit McDonalds turn',async()=>{
  const request='先生我要吃麦当劳套餐要选那个吉士蛋+油条+要豆浆🥺';
  const {ctx,searches,merchants,meta}=makeRuntime(request);
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText=request;
  await ctx.deliveryHandleRoleRequest('role-1','用户明确',meta);
  assert.deepEqual(merchants,['麦当劳']);
  assert.deepEqual(searches,[{taskId:'delivery_id-1',items:['麦满分单人餐随心选']}]);
  const task=Object.values(ctx.S.food.real.roleTasks)[0];
  assert.match(task.query,/规格=吉士蛋麦满分、脆香油条、小杯优品豆浆/);
});

test('a complete but untrained McDonalds action is normalized before browser search',async()=>{
  const request='先生我要吃麦当劳套餐要选那个吉士蛋+油条+要豆浆🥺';
  const {ctx,searches,merchants,meta}=makeRuntime(request);
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText=request;
  await ctx.deliveryHandleRoleRequest('role-1','用户明确；门店=麦当劳；商品=吉士蛋、油条、豆浆',meta);
  assert.deepEqual(merchants,['麦当劳']);
  assert.deepEqual(searches,[{taskId:'delivery_id-1',items:['麦满分单人餐随心选']}]);
  const task=Object.values(ctx.S.food.real.roleTasks)[0];
  assert.match(task.query,/规格=吉士蛋麦满分、脆香油条、小杯优品豆浆/);
});

test('broad and product-only requests wait for the current role to choose a concrete structured route',async()=>{
  const first=makeRuntime('随便点一个主食');
  delete first.ctx.S.food.real.roleClarifications['role-1'];
  delete first.ctx.S.food.real.roleAttempts['role-1'];
  first.ctx.S.food.real.roleTasks={};
  first.meta.userText='随便点一个主食';
  assert.equal(await first.ctx.deliveryTryExplicitApprovalFallback('role-1',first.meta.userText,'行，我看看。',first.meta),false);
  assert.equal(first.searches.length,0);
  assert.match(first.ctx.deliveryMissingActionRepairPrompt('role-1',first.meta.userText,'行，我看看。',first.meta),/唯一授权/);
  const second=makeRuntime('点一碗兰州牛肉面');
  delete second.ctx.S.food.real.roleClarifications['role-1'];
  delete second.ctx.S.food.real.roleAttempts['role-1'];
  second.ctx.S.food.real.roleTasks={};
  second.meta.userText='点一碗兰州牛肉面';
  assert.equal(await second.ctx.deliveryTryExplicitApprovalFallback('role-1',second.meta.userText,'等着。',second.meta),false);
  assert.equal(second.searches.length,0);
  assert.match(second.ctx.deliveryMissingActionRepairPrompt('role-1',second.meta.userText,'等着。',second.meta),/唯一授权/);
});

test('a merchant-free multi-item request waits for the role structured choice instead of inventing a shop',async()=>{
  const {ctx,searches,meta}=makeRuntime('我想吃燕麦牛奶粥+茶叶蛋');
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText='我想吃燕麦牛奶粥+茶叶蛋';
  assert.equal(await ctx.deliveryTryExplicitApprovalFallback('role-1',meta.userText,'可以，我去看。',meta),false);
  assert.equal(searches.length,0);
  assert.match(ctx.deliveryMissingActionRepairPrompt('role-1',meta.userText,'可以，我去看。',meta),/唯一授权/);
});

test('a broad meal request reaches role decision but not a parser-invented merchant',async()=>{
  const {ctx,searches,meta}=makeRuntime('我想吃一碗粥');
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText='我想吃一碗粥';
  assert.equal(await ctx.deliveryTryExplicitApprovalFallback('role-1',meta.userText,'没问题，交给我。',meta),false);
  assert.equal(searches.length,0);
  assert.match(ctx.deliveryMissingActionRepairPrompt('role-1',meta.userText,'没问题，交给我。',meta),/唯一授权/);
});

test('an accepted merchant-free fruit-tea request becomes a committed action repair',()=>{
  const request='给我点一杯果茶，随便点一杯，不加糖就行';
  const {ctx,meta}=makeRuntime(request);
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText=request;
  const prompt=ctx.deliveryMissingActionRepairPrompt('role-1',request,'行，我给你找。',meta);
  assert.match(prompt,/已经明确答应/);
  assert.match(prompt,/主动关心；门店=你现在选定的一家真实具体门店；商品=你现在选定的一件具体果茶商品/);
  assert.match(prompt,/不加糖/);
  assert.match(prompt,/不能改成拒绝、追问或 \[不启动外卖\]/);
});

test('an invalid first repair gets one strict retry only after the role committed',()=>{
  const request='给我点一杯果茶，随便点一杯，不加糖就行';
  const {ctx,meta}=makeRuntime(request);
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText=request;
  const retry=ctx.deliveryMissingActionRetryPrompt('role-1',request,'行，我给你找。','我再看看。',meta);
  assert.match(retry,/最后一次动作格式纠正/);
  assert.match(retry,/只输出一行/);
  assert.match(retry,/规格=不加糖/);
  assert.equal(ctx.deliveryMissingActionRetryPrompt('role-1',request,'不了，不给你找。','',meta),'');
  assert.equal(ctx.deliveryMissingActionRetryPrompt('role-1','今天在忙什么','我给你回消息。','',meta),'');
});

test('ordinary non-food arrangements cannot be converted into delivery by a one-word approval',async()=>{
  const {ctx,searches,meta}=makeRuntime('这件工作你安排一下');
  delete ctx.S.food.real.roleClarifications['role-1'];
  meta.userText='这件工作你安排一下';
  assert.equal(await ctx.deliveryTryExplicitApprovalFallback('role-1',meta.userText,'好。',meta),false);
  assert.equal(ctx.deliveryMissingActionRepairPrompt('role-1',meta.userText,'好。',meta),'');
  assert.equal(searches.length,0);
});

test('malformed autonomous chat text inside a delivery tag is rejected before search',async()=>{
  const {ctx,searches,meta}=makeRuntime('今天聊点别的');
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText='今天聊点别的';
  await ctx.deliveryHandleRoleRequest('role-1','主动关心:什么？ y。]！！我只爱老公',meta);
  assert.equal(searches.length,0);
  assert.equal(Object.keys(ctx.S.food.real.roleTasks).length,0);
});

test('a short ordinary-chat phrase cannot become an autonomous product query',async()=>{
  const {ctx,searches,meta}=makeRuntime('最近随便聊聊');
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText='最近随便聊聊';
  await ctx.deliveryHandleRoleRequest('role-1','主动关心；门店=李若桃；商品=不太好',meta);
  assert.equal(searches.length,0);
  assert.equal(Object.keys(ctx.S.food.real.roleTasks).length,0);
});

test('a canonical current-turn autonomous action still has full authority to start',async()=>{
  const {ctx,searches,merchants,meta}=makeRuntime('今天有点忙');
  delete ctx.S.food.real.roleClarifications['role-1'];
  delete ctx.S.food.real.roleAttempts['role-1'];
  ctx.S.food.real.roleTasks={};
  meta.userText='今天有点忙';
  await ctx.deliveryHandleRoleRequest('role-1','主动关心；门店=曼玲粥店；商品=皮蛋瘦肉粥',meta);
  assert.deepEqual(merchants,['曼玲粥店']);
  assert.deepEqual(searches[0].items,['皮蛋瘦肉粥']);
  const task=Object.values(ctx.S.food.real.roleTasks)[0];
  assert.equal(task.authorizationSource,'role_current_turn');
});

test('ordinary chat still cannot use a one-word role reply to start delivery',()=>{
  const {ctx,meta}=makeRuntime('今天累不累');
  delete ctx.S.food.real.roleClarifications['role-1'];
  meta.userText='今天累不累';
  assert.equal(ctx.deliveryTryExplicitApprovalFallback('role-1',meta.userText,'好。',meta),false);
});

test('a genuine role refusal never starts the relaxed approval bridge',()=>{
  const {ctx,meta}=makeRuntime('点一碗兰州牛肉面');
  delete ctx.S.food.real.roleClarifications['role-1'];
  meta.userText='点一碗兰州牛肉面';
  assert.equal(ctx.deliveryTryExplicitApprovalFallback('role-1',meta.userText,'好吧，还是不点了。',meta),false);
});

test('the role can repair a current autonomous meal-care decision without waiting for a direct order',()=>{
  const {ctx,meta}=makeRuntime('我今天没吃饭');
  delete ctx.S.food.real.roleClarifications['role-1'];
  meta.userText='我今天没吃饭';
  const prompt=ctx.deliveryMissingActionRepairPrompt('role-1',meta.userText,'等着。',meta);
  assert.match(prompt,/你本人在当前回合基于人设与上下文自主决定/);
  assert.match(prompt,/自主决定时拥有完整选择权，并必须使用“主动关心”来源/);
});

test('a terse 都要 clarification can use the original task without another user message',()=>{
  const {ctx,meta}=makeRuntime('都要');
  const prompt=ctx.deliveryMissingActionRepairPrompt('role-1','都要','行，都给你点。',meta);
  assert.match(prompt,/澄清回答必须严格沿用上方原 taskId 语义/);
});

test('chat wiring tries same-task and direct approval fallbacks before hidden model repair',()=>{
  assert.match(app,/_deliveryActionFallbackHandled=false[\s\S]*?deliveryTryClarificationFallback\(id,_userText,_deliveryActionMeta\)/);
  assert.match(app,/deliveryTryExplicitApprovalFallback\(id,_userText,content,_deliveryActionMeta\)[\s\S]*?_deliveryActionFallbackHandled=!!_directRun/);
  assert.match(app,/deliveryMissingActionRepairPrompt\(id,_userText,content,_deliveryActionMeta\)[\s\S]*?await chatAPI\(/);
  assert.match(app,/_deliveryRepairActions\.length===1[\s\S]*?\+'\\n\[真实外卖\|'/);
  assert.match(app,/deliveryMissingActionRetryPrompt\(id,_userText,content,_deliveryRepair,_deliveryActionMeta\)/);
  assert.match(app,/_deliveryStrictRepairActions\.length===1/);
  assert.match(app,/deliveryReportActionRepairFailure\(id,_userText,content,_deliveryActionMeta\)/);
  assert.doesNotMatch(app,/deliveryRequestPreludeRetry\(id/,'missing actions must be repaired in the same authorized turn, not by scheduling a new background turn');
});

test('full-width Chinese delivery actions are normalized before execution',()=>{
  assert.match(app,/replace\(\/\^【\\s\*\(真实外卖\|点外卖\)[\s\S]*?'\[\$1\|\$2\]'\)/);
  assert.match(app,/const _realDeliveryTag=\/\^\[\\\[【\][\s\S]*?真实外卖\|点外卖/);
});
