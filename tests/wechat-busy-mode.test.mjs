import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bundled=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`missing ${name}`);
  const end=app.indexOf('\nfunction ',start+10);
  return app.slice(start,end<0?app.length:end);
}

test('busy reply is an opt-in role feature and stays visually silent',()=>{
  assert.match(app,/拟人忙碌回复/);
  assert.match(app,/class="sw \$\{roleBusyEnabled\(c\)\?'on':''\}" onclick="roleBusyTestToggle/);
  assert.match(functionSource('roleBusyPrompt'),/人设、职业、作息和此刻真实时间自主决定/);
  assert.match(functionSource('roleBusyPrompt'),/明确说出一个大概能恢复回复的时间/);
  assert.equal(vm.runInNewContext(`(${functionSource('roleBusyHeaderBadge')})()`).toString(),'');
  assert.doesNotMatch(functionSource('roleBusyTestToggle'),/toast\(/);
});

test('busy deadline parser accepts real commitments and rejects questions or history',()=>{
  const source=[functionSource('clockNumberValue'),functionSource('roleBusyClockTarget'),functionSource('roleBusyReturnAtFromLine')].join('\n');
  const context={roleTimeParts:at=>{const d=new Date(at);return{hour:d.getHours(),minute:d.getMinutes(),second:d.getSeconds()};}};
  vm.createContext(context);
  vm.runInContext(`${source};this.parse=roleBusyReturnAtFromLine`,context);
  const base=new Date(2026,7,27,15,35,0).getTime();
  assert.equal(context.parse('先生这边还有个会，四点前回不了消息别乱想。',base)-base,25*60000);
  assert.equal(context.parse('我大概半个小时后再找你。',base)-base,30*60000);
  assert.equal(context.parse('约十分钟后找你。',base)-base,10*60000);
  assert.equal(context.parse('我四点有个会。',base),0);
  assert.equal(context.parse('你四点前是不是回不了？',base),0);
  assert.equal(context.parse('我昨天四点前回不了。',base),0);
});

test('busy state migrates the legacy manual lock without trapping chat',()=>{
  const context={};
  vm.createContext(context);
  vm.runInContext(`${functionSource('roleBusyState')};this.state=roleBusyState`,context);
  const c={wechatBusy:{active:true,status:'busy',pendingMessageIds:[]}};
  const st=context.state(c,true);
  assert.equal(st.modeVersion,2);
  assert.equal(st.enabled,false);
  assert.equal(st.active,false);
});

test('messages before the deadline are saved without entering the model route',()=>{
  const c={id:'c1',wechatBusy:{modeVersion:2,enabled:true,active:true,status:'busy',sessionId:'s1',accountId:'main',startedAt:1000,until:Date.now()+60000,pendingMessageIds:[]}};
  const rows=[{id:'u1',role:'user',type:'text',content:'你忙完了吗',time:2000}];
  let saves=0,timers=0;
  const context={getC:()=>c,actId:()=> 'main',msgsForAccount:()=>rows,msgClearTime:m=>m.time,save:()=>{saves++},setTimeout:()=>{timers++},Date};
  vm.createContext(context);
  vm.runInContext([functionSource('roleBusyState'),functionSource('roleBusyReturnNote'),functionSource('roleBusyDeferReply')].join('\n')+';this.defer=roleBusyDeferReply',context);
  assert.equal(context.defer('c1',null,'main'),true);
  assert.deepEqual([...c.wechatBusy.pendingMessageIds],['u1']);
  assert.equal(saves,1);
  assert.equal(timers,0);
  assert.equal('chatAPI' in context,false,'the defer path must not call or require a model');
});

test('deadline reply bypass survives merged feature events and keeps real-model recovery',()=>{
  const bypass=vm.runInNewContext(`(${functionSource('roleBusyReturnNote')})`);
  assert.equal(bypass('[功能事件即时反应｜解锁]\n\n[紧接着发生的下一项真实上下文]\n[忙碌结束后回复|等待消息]'),true);
  assert.match(functionSource('roleBusyEndAndReply'),/const queued=scheduleReply\(c\.id,note,ok=>roleBusyFinish/);
  assert.match(functionSource('roleBusyFinish'),/st\.status='return_pending'/);
  assert.match(functionSource('roleBusyDeferReply'),/const retry=st\.status==='return_pending'/);
  assert.doesNotMatch(functionSource('roleBusyEndAndReply'),/msgs\(c\.id\)\.push\(\{role:'assistant'/,'must not manufacture a canned role message');
  assert.doesNotMatch(functionSource('roleBusyFinish'),/toast\(/);
});

test('one complete timed flow stays silent before deadline and replies once at deadline',()=>{
  const names=['roleBusyState','roleBusyEnabled','roleBusyTimerKey','roleBusyArmTimer','roleBusyExpire','clockNumberValue','roleBusyClockTarget','roleBusyReturnAtFromLine','roleBusyCaptureReply','roleBusyActive','roleBusyPendingRows','roleBusyReturnNote','roleBusyDeferReply','roleBusyFinish','roleBusyEndAndReply'];
  let now=new Date(2026,7,27,15,35,0).getTime(),timerSeq=0,modelCalls=0,done=null,lastNote='';
  const c={id:'c1',wechatBusy:{modeVersion:2,enabled:true,active:false,status:'idle',sessionId:'',accountId:'',startedAt:0,until:0,endedAt:0,pendingMessageIds:[],returnSentAt:0,returnAttempts:0,nextRetryAt:0}},rows=[];
  const timers=new Map();
  const context={
    Date:{now:()=>now},S:{contacts:[c],me:{name:'用户'}},_roleBusyTimers:{},
    roleTimeParts:()=>({hour:15,minute:35,second:0}),getC:()=>c,actId:()=> 'main',uid:()=> 'session1',
    msgsForAccount:()=>rows,msgClearTime:m=>m.time,msgToText:m=>m.content||'',save:()=>{},render:()=>{},cur:()=>({p:'home'}),roleServerPushSyncSoon:()=>{},
    setTimeout:(fn,wait)=>{const id=++timerSeq;timers.set(id,{fn,wait});return id;},clearTimeout:id=>timers.delete(id),
    scheduleReply:(_id,note,cb)=>{modelCalls++;lastNote=note;done=cb;return true;}
  };
  vm.createContext(context);
  vm.runInContext(names.map(functionSource).join('\n')+';this.capture=roleBusyCaptureReply;this.defer=roleBusyDeferReply;this.expire=roleBusyExpire',context);
  assert.equal(context.capture(c,'我一分钟后找你。','main'),true);
  rows.push({id:'u1',role:'user',type:'text',content:'忙完了吗',time:now+10000});
  now+=10000;
  assert.equal(context.defer('c1',null,'main'),true);
  assert.equal(modelCalls,0,'no model call is made while the promised time has not arrived');
  now+=50000;
  assert.equal(context.expire('c1',c.wechatBusy.sessionId),true);
  assert.equal(modelCalls,1,'the waiting messages enter the genuine model route exactly once at the deadline');
  assert.match(lastNote,/忙碌结束后回复/);
  done(true);
  assert.equal(c.wechatBusy.active,false);
  assert.deepEqual([...c.wechatBusy.pendingMessageIds],[]);
});

test('ordinary and background routes both honor the busy deadline',()=>{
  assert.ok(app.indexOf('roleBusyDeferReply(id,note,aid)')<app.indexOf('const token=replyEpoch(id,aid)'),'ordinary reply must defer before scheduling model work');
  assert.match(functionSource('roleServerPushQuietUntil'),/busy=st&&st\.active&&st\.until>Date\.now\(\)\?st\.until:0/);
  assert.match(functionSource('roleOnlineProactiveBlocked'),/roleBusyActive/);
  assert.match(functionSource('roleServerPushDeliveryBlocked'),/roleBusyActive/);
  assert.match(app,/roleBusyCaptureReply\(c,_replyCandidate,replyAccount\)/);
  assert.match(app,/finishAppBoot\(\)[\s\S]{0,500}roleBusyResumeAll\(\)/);
});

test('web and private bundle keep the same busy implementation',()=>{
  assert.equal(app,bundled);
});
