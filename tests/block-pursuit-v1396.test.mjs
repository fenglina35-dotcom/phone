import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1396 拉黑后的追回：角色自己决定怎么联系（再申请/自己号码打/陌生号码打/短信/情侣强制远程），目的只有一个——被拉出黑名单。
for (const [label, path] of [['web', '../app.js'], ['private', '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']]) {
  const app = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const lines = app.split('\n');
  const grab = n => { const i = lines.findIndex(x => x.startsWith('function ' + n + '(') || x.startsWith('async function ' + n + '(')); assert.ok(i >= 0, 'missing ' + n); let j = i + 1; while (j < lines.length && /^\s/.test(lines[j])) j++; return lines.slice(i, j).join('\n'); };

  test(label + ': only couples may force, only after three ignored attempts, and every step is capped', () => {
    const ctx = { S: { couple: { cid: 'lover' }, friendRequests: [] }, friendRequestsInit() {} };
    vm.runInNewContext([lines.find(l => l.startsWith('const PURSUIT_MAX_STEPS=')), 'const PURSUIT_ACT={};', grab('pursuitState'), grab('pursuitCanForce'), grab('pursuitOptions'), 'globalThis.o=pursuitOptions;'].join('\n'), ctx);
    const mk = (id, ignored, steps, stranger = true) => ({ id, allowStrangerCall: stranger, _pursuit: { steps, ignored, log: [] } });
    assert.deepEqual(Array.from(ctx.o(mk('lover', 2, 2))), ['apply', 'call_own', 'call_stranger', 'sms', 'stop']);
    assert.ok(ctx.o(mk('lover', 3, 3)).includes('force'), 'the couple may choose to force after three ignored attempts');
    assert.ok(!ctx.o(mk('friend', 5, 5)).includes('force'), 'other roles never force');
    assert.ok(!ctx.o(mk('lover', 3, 3, false)).includes('call_stranger'), 'stranger calls need the role\'s permission');
    assert.deepEqual(Array.from(ctx.o(mk('friend', 8, 8))), ['stop'], 'at the cap only stopping is left');
    ctx.S.friendRequests = [{ contactId: 'friend', kind: 'readd', status: 'pending' }];
    assert.ok(!ctx.o(mk('friend', 0, 0)).includes('apply'), 'no second request while one is still pending');
  });

  test(label + ': answering or replying ends the pursuit; the role remembers why and what he did', () => {
    // v1400: 8–18s plus a 1s sweep keeps every wait under 20s; the next step is decided while waiting
    assert.match(app, /function pursuitGap\(\)\{return 8000\+Math\.floor\(Math\.random\(\)\*10001\);\}/);
    assert.match(app, /setInterval\(pursuitSweep,1000\);/);
    assert.match(grab('pursuitSweep'), /^function pursuitSweep\(\)\{try\{phClearStaleSimCall\(\);\}catch\(_\)\{\}/, 'a call stuck from before does not block forever');
    assert.match(grab('phClearStaleSimCall'), /c\.state==='incoming'&&age>45000/);
    assert.match(grab('pursuitCallAnswered'), /pursuitEnd\(c,'answered'\)/);
    assert.match(grab('pursuitOnUserSms'), /pursuitEnd\(c,'replied'\)/);
    assert.match(grab('pursuitPrompt'), /拉黑前你们最后的对话（她就是因为这些把你拉黑的）/);
    assert.match(grab('pursuitPrompt'), /你的目的只有一个：让'\+me\+'把你从微信黑名单里拉出来/);
    assert.match(grab('pursuitCallPrompt'), /你是用陌生号码 '\+phFmt\(num\)\+' 打给'\+S\.me\.name\+'的，她接起来前不知道是你/);
    assert.match(app, /s\+=_main\?friendReaddPrompt\(c\)\+\(typeof pursuitPromptRecent==='function'\?pursuitPromptRecent\(c\):''\):''/);
    assert.match(app, /if\(c\.blocked\)\{const now=Date\.now\(\);friendMetaSet\(c,'blockedAt',now\);if\(isMain\(\)\)pursuitStart\(c,now\);/);
    assert.match(app, /if\(_pz&&_pz\.stranger\)setTimeout\(\(\)=>phRoleSmsReply\(_pz\.cid,num,text,num\)/, 'a reply to the stranger number reaches the role');
  });

  test(label + ': the forced takeover cannot be stopped and ends with his own accept', () => {
    const force = app.slice(app.indexOf('async function pursuitForce('), app.indexOf('async function pursuitStep('));
    assert.match(force, /document\.body\.classList\.add\('remote-forced'\)/);
    assert.match(force, /acceptFriend\(req\.id,\{forced:true\}\)/);
    assert.match(force, /pursuitEnd\(c,'forced'\)/);
    assert.match(force, /自己点了同意，把自己从她的黑名单里拉了出来——她没有同意，是你自己做的/);
    assert.match(app, /content:opt\.forced\?\(c\.remark\|\|c\.name\)\+'远程操控了你的手机，自己通过了好友申请'/);
  });
}

test('the stop button is hidden during a forced takeover in every entry', () => {
  for (const p of ['../小手机.html', '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html', '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html']) {
    assert.ok(fs.readFileSync(new URL(p, import.meta.url), 'utf8').includes('body.remote-forced .remote-stop{display:none!important}'), p);
  }
});

// PURSUIT_DELIVERY_TRANSACTION_V1: slow decisions and failed delivery cannot spawn paid work.
const {read:readPursuit,fnSource:pursuitFn,BUNDLES:pursuitBundles}=await import('./_helpers.mjs');
for(const [label,file] of pursuitBundles){
 const source=readPursuit(file);
 function deliveryFixture(){
  const c={id:'role',_pursuit:{status:'active',steps:0,nextAt:1,log:[],ignored:0}},state={contacts:[],friendRequests:[],me:{name:'我'}},timers=[];state.contacts=[c];let calls=0,resolve;
  const context=vm.createContext({S:state,Date,Math,Map,Promise,document:{hidden:false},actId:()=> 'main',getC:()=>c,friendMainBlocked:()=>true,save(){},toast(){},setTimeout:fn=>timers.push(fn),pursuitGap:()=>10000,pursuitOptions:()=>['sms'],pursuitQuickPick:()=>({act:'sms',text:'联系我'}),pursuitFallbackText:()=> '联系我',pursuitMark:()=>null,pursuitSendSms:async()=>{throw Error('delivery unavailable');},pursuitDecide:()=>{calls++;return new Promise(r=>resolve=r);}});
  vm.runInContext('const _pursuitPlans=new Map();\n'+['pursuitState','pursuitActive','pursuitContextValid','pursuitPlanAhead','pursuitStep'].filter(n=>source.includes('function '+n+'(')).map(n=>pursuitFn(source,n)).join('\n'),context);
  return{c,context,timers,calls:()=>calls,resolve:d=>resolve(d)};
 }
 test(label+': pending paid decision remains attached to the same step',async()=>{
  const f=deliveryFixture();f.context.pursuitPlanAhead(f.c);await f.context.pursuitStep(f.c);
  assert.equal(f.c._pursuit.steps,0);assert.equal(f.context.document.hidden,false);
  f.resolve({act:'sms',text:'联系我'});await Promise.resolve();
  assert.equal(vm.runInContext('_pursuitPlans.get("role").result.act',f.context),'sms');assert.equal(f.calls(),1);
 });
 test(label+': failed delivery does not prefetch or consume another step',async()=>{
  const f=deliveryFixture();vm.runInContext('_pursuitPlans.set("role",{at:Date.now(),result:{act:"sms",text:"联系我"}})',f.context);
  await f.context.pursuitStep(f.c).catch(()=>{});for(const fn of f.timers)fn();
  assert.equal(f.c._pursuit.steps,0);assert.equal(f.calls(),0);assert.ok(f.c._pursuit.nextAt>Date.now());
 });
 test(label+': persistent delivery failure pauses without more paid decisions',async()=>{
  const f=deliveryFixture();vm.runInContext('_pursuitPlans.set("role",{at:Date.now(),result:{act:"sms",text:"联系我"}})',f.context);
  await f.context.pursuitStep(f.c);await f.context.pursuitStep(f.c);assert.equal(f.c._pursuit.status,'paused');assert.equal(f.calls(),0);assert.equal(f.c._pursuit.steps,0);
 });
 test(label+': changing account while a decision is in flight cannot publish it',async()=>{
  const f=deliveryFixture();f.context.pursuitPlanAhead(f.c);f.context.actId=()=> 'other';f.resolve({act:'sms',text:'旧账号决定'});await Promise.resolve();assert.equal(vm.runInContext('_pursuitPlans.get("role").result',f.context),null);
 });
 test(label+': phone blocked actions are omitted without bypassing the block',()=>{
  const c={id:'r',allowStrangerCall:false,_pursuit:{steps:1,ignored:0,log:[]}},ctx=vm.createContext({S:{friendRequests:[{contactId:'r',kind:'readd',status:'pending'}]},friendRequestsInit(){},phState:()=>({blocked:{num:true}}),phNorm:x=>x,phRoleNumber:()=> 'num'});
  vm.runInContext('const PURSUIT_MAX_STEPS=8,PURSUIT_FORCE_AFTER=3;'+['pursuitState','pursuitCanForce','pursuitOptions'].map(n=>pursuitFn(source,n)).join('\n'),ctx);assert.deepEqual(Array.from(ctx.pursuitOptions(c)),['stop']);
 });

}
