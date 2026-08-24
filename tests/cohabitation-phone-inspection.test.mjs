import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

function functionSource(name){
  const asyncStart=source.indexOf(`async function ${name}(`);
  const start=asyncStart>=0?asyncStart:source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('online and co-living inspections share one exclusive lane',()=>{
  const context=vm.createContext({uid:(()=>{let n=0;return()=>`t${++n}`;})(),wxLoginActive:()=>false,remoteControlActive:()=>false,String,Date});
  vm.runInContext(`let _rolePhoneInspectionLane=null;let _rolePhoneInspectionEpoch=0;${functionSource('rolePhoneInspectionBump')}${functionSource('rolePhoneInspectionLaneActive')}${functionSource('rolePhoneInspectionAcquire')}${functionSource('rolePhoneInspectionRelease')}this.acquire=rolePhoneInspectionAcquire;this.release=rolePhoneInspectionRelease;this.active=rolePhoneInspectionLaneActive;`,context);
  const first=context.acquire('cohab','c1','抖音');
  assert.equal(first,'t1');
  assert.equal(context.active(),true);
  assert.equal(context.acquire('online','c1','微信'),'', 'the online side cannot inspect at the same time');
  context.release(first);
  assert.equal(context.active(),false);
  assert.equal(context.acquire('online','c1','微信'),'t2');
});

test('unchanged facts deduplicate across online and co-living channels',()=>{
  const context=vm.createContext({replyDedupNorm:v=>String(v).toLowerCase(),wxLoginWechatSummary:()=>'',save:()=>{},String,Date,Math});
  vm.runInContext(`${functionSource('rolePhoneInspectionKey')}${functionSource('rolePhoneUsageSnapshotFromInspection')}${functionSource('rolePhoneInspectionSignature')}${functionSource('rolePhoneInspectionUnchanged')}${functionSource('rolePhoneInspectionCommit')}this.signature=rolePhoneInspectionSignature;this.unchanged=rolePhoneInspectionUnchanged;this.commit=rolePhoneInspectionCommit;`,context);
  const role={id:'c1'};
  const fact=context.signature(role,'抖音',{label:'抖音',data:'搜索：猫咪；点赞：一条视频'});
  assert.equal(context.unchanged(role,fact),false);
  context.commit(role,fact,'online');
  assert.equal(context.unchanged(role,context.signature(role,'抖音',{label:'抖音',data:'搜索：猫咪；点赞：一条视频'})),true);
  assert.equal(role._phoneInspectionFacts.douyin.channel,'online');
  context.commit(role,fact,'cohab');
  assert.equal(role._phoneInspectionFacts.douyin.channel,'cohab');
});

test('co-living inspection is autonomous, factual, visible and not daily-count limited',()=>{
  const prompt=functionSource('cohabPhonePrompt');
  const autonomy=functionSource('cohabPhoneAutonomyMaybe');
  const run=functionSource('cohabRunPhoneInspection');
  const deliver=functionSource('cohabPhoneDeliverFact');
  assert.match(prompt,/不限每天次数/);
  assert.match(prompt,/\[共同生活查看\|准确项目\]/);
  assert.match(prompt,/\[共同生活锁定\|准确App名\]/);
  assert.match(prompt,/\[共同生活解锁\|准确App名\]/);
  assert.match(prompt,/\[共同生活限额\|准确App名\|1到720的分钟数\]/);
  assert.match(prompt,/iPhone睡眠与步数/);
  assert.match(prompt,/总时长及全部逐 App 时长/);
  assert.match(prompt,/心率、电量、位置和其他内容都不是必查项/);
  assert.match(prompt,/\[共同生活登录微信\]/);
  assert.match(prompt,/不得删除、发布、代发/);
  assert.match(autonomy,/完全由你按本人性格、关系、当前现场和动机决定/);
  assert.match(autonomy,/cohabRunPhoneInspection/);
  assert.doesNotMatch(autonomy,/spyBudget|_spyCount|\.times/);
  assert.match(run,/spyFocusData\(id,target\)/);
  assert.match(run,/cohabPhoneProgress/);
  assert.match(run,/cohabTogetherScene\(d\)/);
  assert.match(deliver,/rolePhoneInspectionUnchanged/);
  assert.match(deliver,/rolePhoneInspectionCommit\(c,fact,'cohab'\)/);
  assert.match(deliver,/不要把结果发到微信或电话/);
  assert.match(html,/\.spybanner\.cohab-phone-view/);
});

test('co-living role limit tags use the existing bound dual-side limit path',()=>{
  const calls=[];
  const context=vm.createContext({
    companionDispatchRoleByText:(...args)=>{calls.push(args);return true;},
    cohabPhoneTarget:()=>'',cohabRunPhoneInspection:()=>{},setTimeout:()=>{},String,parseInt
  });
  vm.runInContext(`${functionSource('cohabApplyPhoneTags')}this.apply=cohabApplyPhoneTags;`,context);
  const result=context.apply('[共同生活限额|抖音|45]\n我给你改好了。',{id:'c1',remark:'角色'});
  assert.equal(result.text,'我给你改好了。');
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],'limit');
  assert.equal(calls[0][1],'抖音');
  assert.equal(calls[0][2].minutes,45);
  assert.equal(calls[0][2].scope,'both');
});

test('co-living takes over mandatory daily checks and shares completion markers with online',()=>{
  const daily=functionSource('cohabDailyRequiredMaybe');
  const tick=functionSource('cohabPhoneAutonomyTick');
  const candidate=functionSource('companionRequiredDailyCandidate');
  const morning=functionSource('companionMorningSleepCandidate');
  assert.match(daily,/companionRequiredDailyCandidate/);
  assert.match(daily,/iPhone睡眠与步数/);
  assert.match(daily,/iPhone屏幕使用时间/);
  assert.match(daily,/companionAutomationRecord\(candidate\)/);
  assert.match(daily,/dailyKind:candidate\.kind/);
  assert.match(tick,/await cohabDailyRequiredMaybe\(id\)/);
  assert.match(candidate,/requiredDaily:true/);
  assert.doesNotMatch(morning,/heartRateBpm|st\.battery|st\.location/);
  assert.match(morning,/今日步数/);
  assert.match(functionSource('cohabPhoneDeliverFact'),/dailyDay/);
});

test('only the originating channel receives the inspection reaction',()=>{
  assert.match(functionSource('companionAutomationMaybeSend'),/cohabOnlineQuiet/);
  assert.doesNotMatch(functionSource('initiativeMaybeSend'),/cohabOnlineQuiet/,'co-living must still allow ordinary proactive contact when no face-to-face scene is open');
  assert.match(functionSource('maybeSpyIdle'),/cohabOnlineQuiet/);
  assert.match(functionSource('checkSpyTime'),/cohabOnlineQuiet/);
  assert.match(functionSource('doSpyView'),/rolePhoneInspectionAcquire\('online'/);
  assert.match(functionSource('cohabRunPhoneInspection'),/rolePhoneInspectionAcquire\('cohab'/);
  const logout=functionSource('wxLogout');
  assert.match(logout,/wl\.channel==='cohab'/);
  assert.match(logout,/cohabPhoneLoginFinished/);
  assert.match(logout,/else\{if\(!c\.blocked&&!unchanged\)/);
});

test('WeChat login completion follows active co-living and otherwise stays online',()=>{
  const context=vm.createContext({S:{cohabitation:null}});
  vm.runInContext(`${functionSource('wxLoginCompletionChannel')}this.channel=wxLoginCompletionChannel;`,context);
  assert.equal(context.channel('c1',{}),'online');
  context.S.cohabitation={enabled:true,paused:false,cid:'c1'};
  assert.equal(context.channel('c1',{}),'cohab');
  assert.equal(context.channel('c2',{}),'online');
  context.S.cohabitation.paused=true;
  assert.equal(context.channel('c1',{}),'online');
  assert.equal(context.channel('c1',{channel:'cohab'}),'cohab');
  assert.match(functionSource('wxDoLogin'),/channel=wxLoginCompletionChannel\(cid,opt\)/);
});

test('a co-living reply-tag turn produces only the completed inspection reaction',()=>{
  const timers=[];
  const context=vm.createContext({
    cohabPhoneTarget:target=>String(target||'').trim(),
    cohabRunPhoneInspection:()=>true,
    companionDispatchRoleByText:()=>true,
    setTimeout:fn=>{timers.push(fn);return timers.length;},
    String,parseInt
  });
  vm.runInContext(`${functionSource('cohabApplyPhoneTags')}this.apply=cohabApplyPhoneTags;`,context);
  const parsed=context.apply('我先看一下。\n[共同生活查看|微信聊天]',{id:'c1',remark:'角色'},null,{schedule:false});
  assert.equal(parsed.inspect,'微信聊天');
  assert.equal(timers.length,0,'the initiating reply must not schedule a second parallel delivery');
  const core=functionSource('cohabReplyCore'),send=functionSource('offAI');
  assert.match(core,/inspectionOwner==='offAI'&&phone\.inspect/);
  assert.match(core,/inspection=phone\.inspect;items=\[\]/);
  assert.match(send,/await cohabRunPhoneInspection\(c\.id,inspection/);
  assert.match(send,/if\(!items\.length&&!inspection\)toast/);
  assert.match(send,/if\(life&&!inspection\)cohabMaybeSummarize/);
});

test('real companion sleep, steps, battery and screen-time facts are available to co-living',()=>{
  assert.match(functionSource('cohabPhoneTargets'),/per\.health/);
  assert.match(functionSource('cohabPhoneTargets'),/iPhone心率/);
  assert.match(functionSource('cohabPhoneTargets'),/per\.screenTime/);
  assert.match(functionSource('cohabPhoneTargets'),/per\.battery/);
  assert.match(functionSource('spyFocusData'),/companionRoleDailyHealthText/);
  assert.match(functionSource('spyFocusData'),/companionRoleStepsText/);
  assert.match(functionSource('spyFocusData'),/companionRoleHeartRateText/);
  assert.match(functionSource('spyFocusData'),/companionRoleScreenTimeText/);
  assert.match(functionSource('spyFocusData'),/companionRoleBatteryText/);
  assert.match(functionSource('cohabPhoneTargets'),/iPhone全部数据/);
  assert.match(functionSource('cohabRunPhoneInspection'),/companionRoleAllFocus/);
});
