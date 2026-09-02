import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const deliveryPath=new URL('../delivery.js',import.meta.url);
const privateDeliveryPath=new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/delivery.js',import.meta.url);
const appPath=new URL('../app.js',import.meta.url);
const privateAppPath=new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url);
const delivery=fs.readFileSync(deliveryPath,'utf8');
const privateDelivery=fs.readFileSync(privateDeliveryPath,'utf8');
const app=fs.readFileSync(appPath,'utf8');
const privateApp=fs.readFileSync(privateAppPath,'utf8');

let seq=0,saves=0;
const now=Date.now();
const role={id:'role-1',name:'角色一'};
const S={
  me:{name:'用户'},
  food:{
    cart:[],results:[],
    orders:[{
      id:'order-real-1',accountId:'main',roleId:role.id,real:true,
      merchant:'兰州牛肉面(合景店)',status:'pending_payment',
      items:[{name:'手工兰州牛肉拉面',options:'小份、微辣'}],
      createdAt:now-60_000,updatedAt:now-30_000
    }],
    real:{enabled:true,learnedMemories:[]}
  }
};
const window={};
const context=vm.createContext({
  window,S,console,URL,AbortController,crypto:webcrypto,
  localStorage:{getItem(){return'';},setItem(){}},
  uid(){return `id-${++seq}`;},
  save(){saves++;},render(){},toast(){},openModal(){},closeModal(){},esc(value){return String(value);},
  setTimeout(){return 0;},clearTimeout(){},actId(){return'main';},
  getC(id){return id===role.id?role:null;},msgs(){return[];},scheduleReply(){},
  chatAPI:async()=>'',cur(){return{p:'chat'};},APP_VER:'test',COMPANION_URL:''
});
vm.runInContext(delivery,context,{filename:'delivery.js'});

const meta=(overrides={})=>({
  structuredModelAction:true,allowNewTask:true,accountId:'main',sessionId:'session-1',
  turnId:'turn-1',messageId:'message-1',modelReplyId:'reply-1',
  channel:'chat',userText:'这家好好吃',...overrides
});
const consume=(text,overrides={})=>window.deliveryConsumeMemoryTags(text,role,meta(overrides));

assert.equal(consume('确实不错\n[外卖记忆|喜欢；门店=这家；商品=这个]').trim(),'确实不错','the structured memory action must stay hidden from chat');
assert.equal(S.food.real.learnedMemories.length,1,'a grounded current-model action should create one learned preference');
assert.deepEqual(
  JSON.parse(JSON.stringify(S.food.real.learnedMemories[0])),
  {
    id:'dlm_id-1',roleId:'role-1',accountId:'main',attitude:'like',category:'staple',
    merchant:'兰州牛肉面(合景店)',item:'手工兰州牛肉拉面',spec:'',weight:1,confirmations:1,
    sourceMessageId:'message-1',sourceText:'这家好好吃',sourceOrderId:'order-real-1',
    createdAt:S.food.real.learnedMemories[0].createdAt,updatedAt:S.food.real.learnedMemories[0].updatedAt,active:true
  },
  'deictic names must bind to the same role/account recent real order with provenance'
);

consume('[外卖记忆|喜欢；门店=这家；商品=这个]');
assert.equal(S.food.real.learnedMemories[0].confirmations,1,'replaying the same model message must be idempotent');
consume('[外卖记忆|喜欢；门店=这家；商品=这个]',{turnId:'turn-2',messageId:'message-2'});
assert.equal(S.food.real.learnedMemories.length,1,'a repeated preference should strengthen the same record');
assert.equal(S.food.real.learnedMemories[0].confirmations,2);
assert.equal(S.food.real.learnedMemories[0].weight,2);

const beforeOrdinary=S.food.real.learnedMemories.length;
window.deliveryConsumeMemoryTags('我饿了，想吃东西',role,meta({turnId:'turn-3',messageId:'message-3',userText:'我饿了'}));
window.deliveryConsumeMemoryTags('[外卖记忆|喜欢；门店=不存在咖啡店]',role,meta({turnId:'turn-4',messageId:'message-4',userText:'我饿了'}));
window.deliveryConsumeMemoryTags('[外卖记忆|喜欢；门店=这家]',role,{...meta({turnId:'turn-5',messageId:'message-5'}),structuredModelAction:false});
assert.equal(S.food.real.learnedMemories.length,beforeOrdinary,'keywords, hallucinated values, and non-model calls must not learn');

consume('[外卖记忆|忌口；规格=微辣]',{turnId:'turn-6',messageId:'message-6',userText:'以后别给我点辣的'});
assert.equal(S.food.real.learnedMemories.length,beforeOrdinary,'a safety restriction must not be inferred from a non-matching spec name');
consume('[外卖记忆|忌口；规格=微辣]',{turnId:'turn-7',messageId:'message-7',userText:'以后不要微辣'});
assert.equal(S.food.real.learnedMemories.at(-1).attitude,'avoid','an explicit safety restriction should be stored separately');

window.deliveryConsumeMemoryTags('[外卖记忆|喜欢；商品=生椰拿铁]',role,meta({accountId:'alt',turnId:'turn-alt',messageId:'message-alt',userText:'我喜欢生椰拿铁'}));
assert.equal(S.food.real.learnedMemories.filter(x=>x.accountId==='alt').length,1,'learned preferences must be account scoped');
const prompt=window.deliveryRolePrompt(role);
assert.match(prompt,/喜欢「兰州牛肉面\(合景店\) \/ 手工兰州牛肉拉面」/,'the current role/account prompt should receive learned soft preferences');
assert.doesNotMatch(prompt,/生椰拿铁/,'another account preference must not leak into the current account prompt');
assert.match(prompt,/不能授权、创建、恢复或重启任何订单/,'memory actions must be explicitly separated from order authorization');
assert.match(prompt,/普通的“饿了”“没吃饭”“想吃东西”不是偏好/,'ordinary meal keywords must not be treated as preferences');
assert.match(prompt,/高成功率池为五类：奶茶、咖啡、麦当劳、KFC、粥/,'autonomous role ordering must prefer only the categories that completed the main training pass');
assert.match(prompt,/麦当劳固定品牌为麦当劳，KFC 固定品牌为肯德基/,'McDonalds and KFC must keep their fixed brands');
assert.match(prompt,/奶茶和粥不固定品牌或门店/,'flexible trained categories must select from the current live marketplace');
assert.match(prompt,/单选水果、甜品和五类之外的食物能力没有删除/,'fruit and dessert ordering must remain available even though their training was paused');
assert.match(prompt,/尚未达到训练池的稳定度/,'paused categories must not be presented as high-success');
assert.match(prompt,/随便、都可以、都行、你来点、你来选、你决定、你看着点、按你想的/,'all broad-choice aliases must grant autonomous selection');
assert.match(prompt,/香蕉只是示例，不是固定禁选项/,'fruit exclusions must apply to whichever fruit the user actually rejects');
assert.match(prompt,/不爱吃橙子、不喜欢芒果或排除其他水果/,'natural-language fruit dislikes must stay hard constraints');
assert.match(prompt,/明确列出的水果必须逐项完成，不得用拼盘、混合果切或水果捞替代/,'explicit fruit lists must remain separate single-fruit items');
assert.match(prompt,/明确点名水果、甜品、品牌或其他食物时仍须照常搜索尝试/,'untrained food requests must remain available when the user asks explicitly');
assert.match(prompt,/不能假装具有与训练池相同的成功率/,'the role must not overstate untrained food reliability');
assert.match(prompt,/麦当劳菜单辅助知识（真实页面优先）/,'the role must receive McDonalds menu knowledge for autonomous and underspecified ordering');
assert.match(prompt,/默认把首页可见的“麦满分单人餐随心选”作为商品/,'an underspecified McDonalds bundle must start from the storefront card');
assert.match(prompt,/“火腿巴麦满分”按平台名称“火腿扒麦满分”理解/,'spoken McDonalds aliases must map to the exact live option name');
assert.match(prompt,/“香玉派、香鱼派”按平台名称“香芋派”理解/,'spoken dessert aliases must map to the exact storefront item');
assert.match(prompt,/“香芋派”只选“香芋派\(1份\)”/,'the role must default McDonalds pies to the single-serving card');
assert.match(prompt,/必须排除“香芋派2份、菠萝派2份”/,'the role must reject two-serving pie cards unless explicitly requested');
assert.match(prompt,/当天页面没有对应项时必须如实澄清或失败/,'remembered names must never override the current live menu');
assert.match(delivery,/var autonomous=broadDeliveryChoiceGranted\(current\)/,'only the current real-model turn may grant broad autonomous choice');
assert.doesNotMatch(delivery,/autonomous=broadDeliveryChoiceGranted\(joined\)/,'an older broad-choice message must not authorize a later turn');

const learnedId=S.food.real.learnedMemories.find(x=>x.accountId==='main'&&x.attitude==='like').id;
window.deliveryForgetLearnedMemory(learnedId);
assert.ok(!S.food.real.learnedMemories.some(x=>x.id===learnedId),'the user must be able to delete a learned preference in delivery settings');
assert.ok(saves>=4,'learning and deletion must persist through the existing app state save path');

for(const marker of ['consumeMemoryTags','learnedPreferenceText','forgetLearnedMemory']){
  assert.match(delivery,new RegExp('function '+marker+'\\b'),`web delivery-learning function missing: ${marker}`);
  assert.match(privateDelivery,new RegExp('function '+marker+'\\b'),`private delivery-learning function missing: ${marker}`);
}
for(const marker of ['rememberFromConversation(c,mm[1],_userText,content)','deliveryConsumeMemoryTags(content,c,_deliveryActionMeta)','换气泡|外卖记忆']){
  assert.ok(privateApp.includes(marker),`private app delivery-learning marker missing: ${marker}`);
}
assert.match(app,/_deliveryActionMeta=\{structuredModelAction:true,allowNewTask:_deliveryCurrentUserTurn,accountId:String\(replyAccount[\s\S]{0,420}deliveryConsumeMemoryTags\(content,c,_deliveryActionMeta\)/,'chat replies must bind learned memories to the current structured model turn');
assert.match(app,/channel:'call'[\s\S]{0,260}userText:/,'call replies must bind learned memories to the current structured model turn');
assert.match(app,/换气泡\|外卖记忆/,'an unconsumed memory action must never appear as a role chat bubble');

console.log('real delivery learning tests passed');
