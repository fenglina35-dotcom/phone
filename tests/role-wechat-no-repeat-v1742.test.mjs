/* v1742 登录角色微信：和好友的聊天一段一段重复。
   根因：hisSeed 把「查他手机」的聊天快照并进角色微信时按「方向+原文」逐字比对；模型每次刷新重写快照，
   同一句话只差空格、全角/半角逗号或把角色写成简称（「裴：」），就被当成新消息再追加一遍。
   第一个用例在旧实现上 3 → 5 → 7。 */
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const runtime of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
const test=(name,run)=>nodeTest(runtime+': '+name,run);
const app=fs.readFileSync(new URL('../'+runtime,import.meta.url),'utf8');
const fn=name=>{const s=app.indexOf('\nfunction '+name+'(');assert.ok(s>=0,'missing '+name);const e=app.indexOf('\nfunction ',s+5);return app.slice(s+1,e);};
function sandbox(){
  const S={me:{name:'North'},spy:{r:{wechat:[]}},hisWx:{}};
  const ctx=vm.createContext({S,JSON,Math,Array,String,Date,Map,save(){},getC:()=>({id:'r',name:'裴。'})});
  vm.runInContext([fn('hisWxData'),fn('hisMsgKey'),fn('hisCollapseRepeats'),fn('hisSeed')].join('\n'),ctx);
  return {ctx,S};
}
const A='小安醒了，点了名要喝皮蛋瘦肉粥，我下楼在厨房熬着。',B='知道了，你伯母刚才还在客厅抹眼泪，你多耐着性子。',C='我知道，他不吃什么我比谁都清楚。';

test('refreshing the phone snapshot with the same lines written slightly differently never re-imports them',()=>{
  const {ctx,S}=sandbox(),sizes=[];
  for(const lines of [
    ['他：'+A,'对方：'+B,'他：'+C],
    ['他： '+A,'林孟：'+B+' ','裴。：'+C],                       // 多了空格、对方写成名字、角色写全名
    ['他：'+A.replace('，',','),'对方：'+B,'裴：'+C],             // 半角逗号、角色写成简称（会被认成对方）
    ['他：'+A,'对方：'+B,'他：'+C,'对方：那你快去吧。'],          // 真正的新消息照常进来
  ]){S.spy.r.wechat=[{who:'林孟',relation:'朋友',lines}];ctx.hisSeed('r');sizes.push(S.hisWx.r.friends[0].msgs.length);}
  assert.deepEqual(sizes,[3,3,3,4]);
  assert.deepEqual(S.hisWx.r.friends[0].msgs.map(m=>m.c),[A,B,C,'那你快去吧。']);
});

test('conversations that were already saved with repeated blocks are collapsed when the role WeChat opens',()=>{
  const {ctx,S}=sandbox(),row=(r,c,extra)=>Object.assign({r,c,t:1},extra||{});
  S.hisWx.r={seeded:true,moments:[],log:[],friends:[{id:'f1',name:'林孟',msgs:[row('me',A),row('ta',B),row('me',C),row('me',A),row('ta',B),row('me',C),row('me',A+' '),row('ta',B),row('me',C),row('ta','好'),row('ta','好'),row('me','[图片]',{type:'image',src:'x'}),row('me','[图片]',{type:'image',src:'x'}),row('me','你到家了吗？我刚下班准备回去。'),row('me','你到家了吗？我刚下班准备回去。')]}]};
  ctx.hisSeed('r');
  const out=S.hisWx.r.friends[0].msgs.map(m=>(m.type||'text')+':'+m.c.trim());
  assert.deepEqual(out,['text:'+A,'text:'+B,'text:'+C,'text:好','text:好','image:[图片]','image:[图片]','text:你到家了吗？我刚下班准备回去。'],
    'repeated blocks and a repeated long sentence collapse; short replies like 好 and images are left alone');
});

test('messages the user sent from the role account, payments and images survive the merge',()=>{
  const {ctx,S}=sandbox();
  S.hisWx.r={seeded:true,moments:[],log:[],friends:[{id:'f1',name:'林孟',msgs:[{r:'me',c:A,t:1,mine:1},{r:'me',c:'[转账 ¥20.00] 买粥',t:2,mine:1,type:'transfer',_hisPaymentId:'p1'},{r:'ta',c:'在吗',t:3}]}]};
  S.spy.r.wechat=[{who:'林孟',lines:['他：'+A,'他：[转账 ¥20.00] 买粥','对方：在吗','对方：'+B]}];
  ctx.hisSeed('r');
  const msgs=S.hisWx.r.friends[0].msgs;
  assert.deepEqual(msgs.map(m=>m.c),[A,'[转账 ¥20.00] 买粥','在吗',B]);
  assert.equal(msgs[1]._hisPaymentId,'p1');
});

}
