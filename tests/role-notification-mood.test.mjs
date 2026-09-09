import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const source=fs.readFileSync(new URL('../supabase/functions/phone-role-push/index.ts',import.meta.url),'utf8');
const code=stripTypeScriptTypes(source.slice(0,source.indexOf('Deno.serve(')).replace(/^import .*;\r?$/gm,''),{mode:'strip'});
function worker(){
  const alerts=[];
  const ctx={console,URL,Date,Intl,crypto,Deno:{env:{get:()=> 'fixture'}}};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  ctx.apnsJWT=async()=> 'fixture-jwt';
  ctx.apnsFetch=async(url,options)=>{alerts.push({url,...JSON.parse(options.body),headers:options.headers});return {response:{ok:true,headers:{get:()=> 'fixture-id'}},attempt:1};};
  return {ctx,alerts,send:body=>ctx.sendAPNs('fixture-device','production','role-a','先生',body,'outbox-a','https://fixture.test/avatar')};
}
test('screenshot mood line never becomes a lockscreen alert; all three speech lines survive',async()=>{
  const w=worker();
  const result=await w.send('[心情|微愠]\n昨晚一点半闭的眼，一共就睡了四个小时？\n起来洗漱。\n中午想吃什么，发过来。');
  assert.equal(result.status,'sent');
  assert.deepEqual(w.alerts.map(x=>x.aps.alert.body),['昨晚一点半闭的眼，一共就睡了四个小时？','起来洗漱。','中午想吃什么，发过来。']);
  assert.deepEqual(w.alerts.map(x=>[x.rolePush.messageIndex,x.rolePush.messageCount]),[[0,3],[1,3],[2,3]]);
});
test('inline, fullwidth and multiple mood metadata are removed before sentence splitting',async()=>{
  const w=worker();await w.send('【 心情｜真能睡 】北。\n[内心|醒了？有点担心。]还没起？\n[心情值：80]醒了先喝温水。');
  assert.deepEqual(w.alerts.map(x=>x.aps.alert.body),['北。','还没起？','醒了先喝温水。']);
});
test('metadata does not consume the ten visible notification slots',async()=>{
  const w=worker();await w.send('[心情|在意]\n'+Array.from({length:10},(_,i)=>`消息${i}。`).join('\n'));
  assert.equal(w.alerts.length,10);assert.equal(w.alerts[9].aps.alert.body,'消息9。');
});
test('mood-only delivery is explicitly suppressed without blank or invented notification',async()=>{
  const w=worker();const result=await w.send('[心情|微愠]\n[内心|想见你]');
  assert.equal(result.status,'suppressed-metadata');assert.equal(result.error,'');assert.equal(w.alerts.length,0);
  assert.equal((await w.send('')).status,'failed-empty');
});
test('call invitation with mood keeps call identity and ordinary action previews',async()=>{
  const w=worker();await w.send('[心情|担心]\n[来电|语音]');
  assert.equal(w.alerts.length,1);assert.equal(w.alerts[0].rolePush.kind,'call');assert.equal(w.alerts[0].rolePush.callKind,'语音');
  assert.equal(w.alerts[0].aps.alert.body,'语音通话邀请');
  const actions=worker();await actions.send('[送礼|热茶|10|暖手]\n[图片|窗边的茶]\n[位置|家]');
  assert.equal(actions.alerts.length,3);assert.equal(actions.alerts[0].aps.alert.body,'给你准备了「热茶」');
});
test('ordinary words about moods, refusal prose and translations remain unchanged at notification layer',async()=>{
  const w=worker();await w.send('我心情很好。\n我不愿意，我们换个话题。\nGood morning（早上好）');
  assert.deepEqual(w.alerts.map(x=>x.aps.alert.body),['我心情很好。','我不愿意，我们换个话题。','Good morning（早上好）']);
});
function outboxClient(existingStatus){
  const writes=[];const row={id:'outbox-a',push_status:existingStatus,avatar_token:'fixture'};
  const client={from(table){return {upsert(value){writes.push(value);return this;},select(){return this;},eq(){return this;},update(value){writes.push(value);return this;},async maybeSingle(){return {data:table==='phone_companion_links'?{apns_device_token:'fixture',apns_environment:'sandbox'}:row};}};}};
  return {client,writes};
}
test('persistAndPush retains original mood for frontend sync and completes metadata-only without retries',async()=>{
  const w=worker(),db=outboxClient('pending');const body='[心情|微愠]';
  assert.equal(await w.ctx.persistAndPush(db.client,'https://fixture.test',{target:'owner',role_id:'role-a',role_name:'先生'},body,'automation:test','dedupe-a'),true);
  assert.equal(db.writes[0].body,body);assert.equal(db.writes[1].push_status,'suppressed-metadata');assert.equal(w.alerts.length,0);
  const retry=outboxClient('suppressed-metadata');w.ctx.sendAPNs=()=>{throw new Error('must not retry suppressed delivery');};
  assert.equal(await w.ctx.persistAndPush(retry.client,'https://fixture.test',{target:'owner',role_id:'role-a'},body,'automation:test','dedupe-a'),true);
});
test('transport failures remain failures with original diagnostics',async()=>{
  const w=worker();w.ctx.apnsFetch=async()=>({response:{ok:false,status:403,headers:{get:()=> 'denied'},text:async()=> 'Forbidden'},attempt:1});
  const out=await w.send('[心情|在意]\n早。');assert.equal(out.status,'failed-403');assert.equal(out.error,'Forbidden');
});
