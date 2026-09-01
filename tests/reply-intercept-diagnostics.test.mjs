import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const web=fs.readFileSync(path.join(root,'app.js'),'utf8');
const privateApp=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneWeb.bundle','app.js'),'utf8');

function diagnosticBlock(source){
  const start=source.indexOf("const ROLE_INTERCEPT_DIAG_SESSION_KEY=");
  const end=source.indexOf('function offlineUnsafeRoleDrift',start);
  assert.ok(start>=0&&end>start,'diagnostic helper block must exist');
  return source.slice(start,end);
}

function sourceBetween(source,startNeedle,endNeedle){
  const start=source.indexOf(startNeedle),end=source.indexOf(endNeedle,start+startNeedle.length);
  assert.ok(start>=0&&end>start,`source block must exist: ${startNeedle}`);
  return source.slice(start,end);
}

const webBlock=diagnosticBlock(web);
const privateBlock=diagnosticBlock(privateApp);
assert.equal(
  privateBlock.replaceAll('\r\n','\n'),
  webBlock.replaceAll('\r\n','\n'),
  'web and private bundle must share the same diagnostic helper block before private packaging'
);
assert.doesNotMatch(webBlock,/\b(?:save|chatAPI|scheduleReply|msgs|cohabPushMessage)\s*\(/,'diagnostic storage must not write app state, chat, memory, or call a model');
assert.doesNotMatch(webBlock,/\b(?:localStorage|indexedDB)\b/,'diagnostic storage must stay session-only');

const store=new Map();
let writes=0,account='main',modal='';
const sessionStorage={
  getItem(key){return store.has(key)?store.get(key):null;},
  setItem(key,value){writes++;store.set(key,String(value));}
};
const contacts=new Map([
  ['a',{id:'a',name:'角色A',remark:'A'}],
  ['b',{id:'b',name:'角色B',remark:'B'}]
]);
const S={sentinel:{unchanged:true}};
const context={
  sessionStorage,
  actId:()=>account,
  getC:id=>contacts.get(id),
  openModal:html=>{modal=String(html);},
  fmtDT:at=>'TIME-'+at,
  esc:value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  roleVisibleEnvelopeText:value=>String(value??'').trim(),
  cleanRolePunct:value=>String(value??'').trim(),
  S,console,encodeURIComponent,JSON,Date,Array,String,Object
};
vm.createContext(context);
vm.runInContext(`${webBlock}\nthis.diag={remember:roleInterceptDiagnosticRemember,read:roleInterceptDiagnosticRead,open:roleInterceptDiagnosticOpen,begin:roleInterceptDiagnosticTurn,candidate:roleInterceptDiagnosticTurnCandidate,select:roleInterceptDiagnosticTurnSelect,outcome:roleInterceptDiagnosticTurnOutcome,finish:roleInterceptDiagnosticTurnFinish,fail:roleInterceptDiagnosticTurnFailure};`,context);
const {remember,read,open,begin,candidate,select,outcome,finish,fail}=context.diag;
const beforeS=JSON.stringify(S);

const turn=begin(contacts.get('a'),'online','main','线上微信');
candidate(turn,'重复候选','主回复');
candidate(turn,'重复候选','第一次纠正');
candidate(turn,'最终会显示','第二次纠正');
assert.equal(writes,0,'collecting candidates must not overwrite the prior row mid-turn');
assert.equal(select(turn,'最终会显示'),true);
assert.equal(finish(turn,'最终会显示',{delivered:true}),true);
let row=read(contacts.get('a'),'online','main');
assert.deepEqual(Array.from(row.items,item=>item.raw),['重复候选','重复候选'],'identical rejected model calls must both remain in call order');
assert.deepEqual(Array.from(row.items,item=>item.stage),['主回复','第一次纠正']);
assert.equal(writes,1,'one reply turn must atomically write its discarded candidates once');

const oldMain=JSON.stringify(row);
const clean=begin(contacts.get('a'),'online','main','线上微信');
candidate(clean,'干净回复','主回复');select(clean,'干净回复');
assert.equal(finish(clean,'干净回复',{delivered:true}),false,'a fully delivered clean turn is not an intercept');
assert.equal(JSON.stringify(read(contacts.get('a'),'online','main')),oldMain,'a clean turn must not erase the latest genuine intercept');

const partial=begin(contacts.get('a'),'online','alt','线上微信');
candidate(partial,'会显示\n<分析>不该显示</分析>','主回复');select(partial,'会显示\n<分析>不该显示</分析>');
assert.equal(finish(partial,'会显示',{delivered:true,partial:true}),true);
row=read(contacts.get('a'),'online','alt');
assert.equal(row.items.length,1);
assert.equal(row.items[0].raw,'会显示\n<分析>不该显示</分析>');
assert.match(row.items[0].action,/部分内容/);

const hidden=begin(contacts.get('a'),'offline',null,'单次约会');
candidate(hidden,'第一份没显示','主回复');candidate(hidden,'第二份也没显示','纠正回复');
assert.equal(finish(hidden,'',{delivered:false}),true);
assert.deepEqual(Array.from(read(contacts.get('a'),'offline').items,item=>item.raw),['第一份没显示','第二份也没显示']);

const cohab=begin(contacts.get('a'),'cohab',null,'共同生活');candidate(cohab,'共同生活被拦','主回复');finish(cohab,'',{delivered:false});
assert.equal(read(contacts.get('a'),'cohab').raw,'共同生活被拦');
assert.equal(read(contacts.get('a'),'offline').raw,'第一份没显示','cohab and single-date records must not overwrite each other');
assert.equal(read(contacts.get('b'),'cohab'),null,'another role must not see the record');
assert.equal(read(contacts.get('a'),'online','main').raw,'重复候选','online main must remain account-scoped');
assert.equal(read(contacts.get('a'),'online','alt').raw,'会显示\n<分析>不该显示</分析>','online alt must remain account-scoped');

const handledMixed=begin(contacts.get('b'),'online','main','线上微信');
candidate(handledMixed,'[心情|开心]\n我到了','主回复');select(handledMixed,'[心情|开心]\n我到了');select(handledMixed,'我到了');
outcome(handledMixed,{handled:1});
assert.equal(finish(handledMixed,'我到了',{delivered:true}),false,'a successfully handled mood tag plus fully shown prose is not an intercept');
const handledOnly=begin(contacts.get('b'),'online','main','线上微信');
candidate(handledOnly,'[闹钟|07:00|起床]','主回复');select(handledOnly,'[闹钟|07:00|起床]');
outcome(handledOnly,{handled:1});
assert.equal(finish(handledOnly,'',{delivered:true}),false,'a successfully executed function-only reply is not an intercept');
const unknown=begin(contacts.get('b'),'online','main','线上微信');
candidate(unknown,'[未知协议|秘密正文]','主回复');select(unknown,'[未知协议|秘密正文]');
assert.equal(finish(unknown,'',{delivered:true}),true,'an unknown silently removed tag must remain viewable');

const successfulErrorText=begin(contacts.get('b'),'offline',null,'单次约会');
candidate(successfulErrorText,'Load failed','模型实际正文');
assert.equal(finish(successfulErrorText,'',{delivered:false}),true,'text returned by a successful model call is a candidate even when it resembles a network error');
const beforeTransport=JSON.stringify(read(contacts.get('b'),'offline'));
for(const value of ['', 'Load failed', 'Failed to fetch', 'HTTP 503 upstream busy', '网络连接失败或接口等待过久断开'])assert.equal(remember(contacts.get('b'),'offline',value,'错误','隐藏'),false,`direct transport/empty diagnostic must be ignored: ${value}`);
assert.equal(JSON.stringify(read(contacts.get('b'),'offline')),beforeTransport,'transport errors must not overwrite a model candidate captured by a successful call');

const failedTurn=begin(contacts.get('b'),'offline',null,'单次约会');
const failedError=new Error('网络连接失败或接口等待过久断开');
Object.assign(failedError,{transportRaw:'Load failed',routeName:'路线3',model:'genuine-model',modelKind:'主模型',replyStage:'单次约会主候选 · 网络重试',elapsedMs:1880,retryCount:1});
assert.equal(fail(failedTurn,failedError,{reason:'网络连接失败或接口等待过久断开'}),true);
row=read(contacts.get('b'),'offline');
assert.equal(row.kind,'request-failure');
assert.equal(row.items.length,0,'a transport failure must not be relabelled as intercepted model text');
assert.equal(row.failure.routeName,'路线3');
assert.equal(row.failure.model,'genuine-model');
open('b','offline');
assert.match(modal,/上一轮回复失败依据/);
assert.match(modal,/路线3/);
assert.match(modal,/genuine-model/);
assert.match(modal,/Load failed/);
assert.match(modal,/已自动重试 1 次/);

const long='😀'.repeat(12001),longTurn=begin(contacts.get('b'),'cohab',null,'共同生活');candidate(longTurn,long,'长候选');finish(longTurn,'',{delivered:false});
const longItem=read(contacts.get('b'),'cohab').items[0];
assert.equal(longItem.truncated,true);
assert.equal(Array.from(longItem.raw).length,12000,'every item must be Unicode-safe capped at 12000 characters');

const htmlTurn=begin(contacts.get('a'),'cohab',null,'共同生活');
candidate(htmlTurn,'<script>alert(1)</script>','<img src=x onerror=1>');candidate(htmlTurn,'<b>second</b>','第二候选');finish(htmlTurn,'',{delivered:false});
open('a','cohab');
assert.match(modal,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(modal,/&lt;b&gt;second&lt;\/b&gt;/);
assert.match(modal,/&lt;img src=x onerror=1&gt;/);
assert.ok(modal.indexOf('&lt;script&gt;')<modal.indexOf('&lt;b&gt;second'),'viewer must preserve candidate order');
assert.doesNotMatch(modal,/<script>|<img src=x onerror=1>/,'viewer must HTML-escape candidate text and metadata');
assert.match(modal,/按模型实际返回顺序保留这一轮全部未原样展示/);
assert.equal(JSON.stringify(S),beforeS,'diagnostic begin/candidate/finish/open must not mutate app state');

for(const [label,source] of [['web',web],['private',privateApp]]){
  const replyItemsSource=sourceBetween(source,'function offReplyItems(','function offlineMemoryRule');
  const unsafeSource=sourceBetween(source,'function offlineUnsafeRoleDrift(','function offlineRoleDrift');
  let itemSeq=0;
  const replyContext=vm.createContext({
    roleVisibleEnvelopeText:value=>String(value||''),
    splitBubbles:value=>String(value||'').split(/\r?\n/),
    normTag:value=>String(value||''),
    LEAKRE:/<分析>|<指令解析>|思维链/i,
    isOOCLine:value=>/^OOC[:：]/i.test(String(value||'')),
    isRefusal:value=>/^REFUSE[:：]/i.test(String(value||'')),
    offResponsePart:value=>{const text=String(value||'').trim(),m=text.match(/^【([\s\S]*)】$/);return m?{kind:'nar',text:m[1]}:{kind:'say',text};},
    splitActions:value=>[String(value||'')],
    uid:()=>`item-${++itemSeq}`
  });
  vm.runInContext(`${replyItemsSource}\nthis.parse=offReplyItems;`,replyContext);

  const droppedMeta={};
  const droppedItems=replyContext.parse('我还在\n[未知协议|这段不能静默消失]\n<分析>内部推理</分析>\nOOC: 我是模型\nREFUSE: 我不能继续',droppedMeta);
  assert.deepEqual(Array.from(droppedItems,item=>item.text),['我还在'],`${label}: visible prose must remain while hidden tag/leak/OOC/refusal lines are removed`);
  assert.equal(droppedMeta.partial,true,`${label}: every removed tag, reasoning leak, OOC line, or refusal must mark the candidate as partially intercepted`);
  const inlineMeta={};
  const inlineItems=replyContext.parse('我在这里[任意未来标签|秘密正文]',inlineMeta);
  assert.deepEqual(Array.from(inlineItems,item=>item.text),['我在这里'],`${label}: an arbitrary inline tag may be removed from display`);
  assert.equal(inlineMeta.partial,true,`${label}: arbitrary inline tags must remain discoverable in the intercept viewer`);

  const unsafeContext=vm.createContext({
    roleVisibleEnvelopeText:value=>String(value||''),
    isRefusal:()=>false,
    splitBubbles:value=>[String(value||'')],
    isOOCLine:()=>false,
    wechatReasoningLeak:value=>String(value||'').includes('<指令解析>')
  });
  vm.runInContext(`${unsafeSource}\nthis.unsafe=offlineUnsafeRoleDrift;`,unsafeContext);
  assert.equal(unsafeContext.unsafe('<指令解析>先分析用户意图</指令解析>'),true,`${label}: the shared reasoning-leak detector must hard-block leaked chain-of-thought offline too`);

  const coreSource=sourceBetween(source,'async function cohabReplyCore(','function cohabReplyAuditFinish');
  async function runCoreScenario({travel,committed=[],parserPartial=false}){
    const coreContext=vm.createContext({
      Date,Map,String,Object,
      offlineHistoryMessages:()=>[],cohabReplyHistory:()=>[],cohabOnlineReturnState:()=>null,
      cohabSystem:()=>'',cohabMemoryPrompt:()=>'',offlineRequestMessages:()=>[],cohabRepairMessages:()=>[],
      personaPin:()=>'',offlineFormatPin:()=>'',roleReplyContinuityPin:()=>'',offlineWechatLiveOn:()=>true,
      roleVisibleEnvelopeText:value=>String(value||''),offlineRoleDrift:()=>false,offlineUnsafeRoleDrift:()=>false,
      roleInterceptDiagnosticTurn:()=>({candidates:[{id:1,raw:'candidate'}],selectedId:0}),
      roleInterceptDiagnosticTurnSelect:audit=>{audit.selectedId=1;return true;},
      roleInterceptDiagnosticTurnOutcome:()=>true,
      roleInterceptDiagnosticTurnFinish:()=>true,
      roleInterceptDiagnosticTurnFailure:()=>true,
      offlineReplyFailureReason:error=>String(error&&error.message||error),
      roleInterceptDiagnosticAction:(outcome,ok)=>{if(outcome){outcome.matched=(outcome.matched||0)+1;if(ok)outcome.handled=(outcome.handled||0)+1;else outcome.failed=(outcome.failed||0)+1;}return !!ok;},
      cohabRoleChat:async()=> '【他抬眼看过来。】\n我在。\n[双人订票|北京|2026-09-03|08:00]',
      offlineRepeatAudit:()=>({fails:[],score:0}),cohabTimeEchoAudit:()=>({fails:[],score:0}),
      offlineKeepValidReplyOnRepairFailure:()=>'',cohabRepeatRepairNote:()=>'',offlineRoleRepairPrompt:()=>'',
      applyGrudgeTags:value=>value,offlineApplyMemoryTags:value=>({text:value}),
      cohabApplyPhoneTags:value=>({text:value,inspect:''}),
      cohabApplyOnlineMessageTags:value=>({text:value,delivered:0}),
      cohabApplyScheduleTags:value=>({text:value,changed:false}),
      cohabExtractTravelTags:()=>travel,
      cohabApplyStateTags:value=>({text:value,matched:true}),cohabInferVisiblePlace:()=>{},
      offReplyItems:(value,meta)=>{if(meta&&parserPartial)meta.partial=true;return[{id:'visible',who:'ta',text:String(value||'')}];},
      offDedupeItems:items=>items,
      cohabCommitTripPlans:()=>committed
    });
    vm.runInContext(`${coreSource}\nthis.run=cohabReplyCore;`,coreContext);
    return coreContext.run({id:'role',name:'角色'},{},'最新一句','最新一句',600,{allowTravel:true});
  }
  const invalidTrip=await runCoreScenario({travel:{text:'我在。',plans:[],errors:['出发时间无效']}});
  assert.equal(invalidTrip._interceptPartial,true,`${label}: an invalid trip tag must make the original model candidate viewable even when an error notice is shown`);
  const duplicateTrip=await runCoreScenario({travel:{text:'我在。',plans:[{to:'北京'}],errors:[]},committed:[]});
  assert.equal(duplicateTrip._interceptPartial,true,`${label}: a duplicate trip that creates no booking must remain viewable as an unexecuted candidate action`);
  const parserDrop=await runCoreScenario({travel:{text:'我在。',plans:[],errors:[]},parserPartial:true});
  assert.equal(parserDrop._interceptPartial,true,`${label}: content removed by offReplyItems must propagate to the shared cohab audit`);

  const finishSource=sourceBetween(source,'function cohabReplyAuditFinish(','const _cohabArrivalBusy');
  let finishCalls=0;
  const finishContext=vm.createContext({roleInterceptDiagnosticTurnFinish:()=>{finishCalls++;return true;}});
  vm.runInContext(`${finishSource}\nthis.finish=cohabReplyAuditFinish;`,finishContext);
  const sharedResult={_interceptAudit:{},_interceptFinal:'候选',_interceptPartial:false,_interceptDone:false};
  assert.equal(finishContext.finish(sharedResult,true,false),true,`${label}: the shared cohab audit must finish at its delivery owner`);
  assert.equal(finishContext.finish(sharedResult,true,false),false,`${label}: a shared audit must not be finished twice by nested and outer callers`);
  assert.equal(finishCalls,1,`${label}: exactly one diagnostic row may be written for a shared cohab turn`);

  const offAISource=sourceBetween(source,'async function offAI(','function offNarrationMode');
  async function runInspectionScenario({inspected=true,travelErrors=[]}){
    const finishArgs=[],caught=[];
    const offContext=vm.createContext({
      Date,String,Object,Promise,
      seedOff:{id:'role',mode:'cohab',busy:false},
      getC:()=>({id:'role',name:'角色',remark:'角色'}),
      offSceneData:()=>({msgs:[]}),rolePhoneInspectionEpoch:()=>1,rolePhoneInspectionBlocksOrdinary:()=>false,
      cohabTogetherScene:()=>true,cohabPhaseLabel:()=>'',offRender:()=>{},offCurrentInput:()=>'',
      cohabCurrentTurnPrompt:()=>'',offlineReplyBudget:()=>600,offlineRememberExplicitRequest:()=>{},
      companionInspectionRequestFromUser:()=>'',
      cohabReplyCore:async()=>({items:[],inspection:travelErrors.length?'':'相册',trips:[],travelErrors,_interceptAudit:{},_interceptFinal:'[共同生活查看|相册]',_interceptPartial:false,_interceptDone:false}),
      cohabRunPhoneInspection:async()=>inspected,
      rolePhoneInspectionGenerationStale:()=>false,toast:()=>{},offRevealTiming:()=>({step:0,total:0}),
      cohabPushMessage:()=>{},cohabPushNotice:()=>{},cohabTripBookedNotice:()=>'',save:()=>{},cohabMaybeSummarize:()=>{},
      cohabReplyAuditFinish:(result,delivered,partial)=>{finishArgs.push({delivered:!!delivered,partial:!!partial,resultPartial:!!result._interceptPartial});return true;},
      roleInterceptDiagnosticTurnOutcome:()=>true,roleInterceptDiagnosticTurnFinish:()=>false,
      offlineReplyFailureReason:error=>{caught.push(error);return String(error&&error.message||error);},
      offlineReplyEmptyReason:()=> 'empty',
      setTimeout
    });
    vm.runInContext(`var _off=this.seedOff;${offAISource}\nthis.run=offAI;`,offContext);
    await offContext.run('');
    if(caught.length)throw caught[0];
    return finishArgs.at(-1);
  }
  assert.deepEqual(await runInspectionScenario({inspected:true}),{delivered:true,partial:false,resultPartial:false},`${label}: only a genuinely completed phone inspection counts as a handled action`);
  assert.deepEqual(await runInspectionScenario({inspected:false}),{delivered:false,partial:true,resultPartial:true},`${label}: a failed inspection must not consume the model tag as successful and must stay viewable`);
  assert.deepEqual(await runInspectionScenario({travelErrors:['重复行程或时间无效']}),{delivered:false,partial:true,resultPartial:true},`${label}: travelErrors are failed model actions, not successful visible replies`);
}

for(const source of [web,privateApp]){
  assert.match(source,/roleInterceptDiagnosticOpen\('\$\{id\}','online'\)[\s\S]{0,100}<span>查看上一轮拦截内容<\/span>/);
  assert.match(source,/roleInterceptDiagnosticOpen\('\$\{id\}','offline'\)">查看上一轮拦截内容<\/button>/);
  assert.match(source,/roleInterceptDiagnosticOpen\('\$\{id\}','cohab'\)"><span>查看上一轮拦截内容<\/span>/);
  assert.match(source,/roleInterceptAudit:null[\s\S]{0,300}return joinAIContinuation/,'continuation fragments must not become separate candidates');
  assert.ok((source.match(/roleInterceptDiagnosticTurnCandidate\(opt\.roleInterceptAudit/g)||[]).length>=2,'both chat transports must capture successful role reply candidates');
  assert.match(source,/roleInterceptDiagnosticTurn\(c,'online',replyAccount,'线上微信'\)/);
  assert.match(source,/roleInterceptDiagnosticTurn\(c,'cohab',null,'共同生活'\)/);
  assert.match(source,/roleInterceptDiagnosticTurn\(c,'offline',null,'单次约会'\)/);
  assert.match(source,/finally\{roleInterceptDiagnosticTurnOutcome\(_replyAudit,[\s\S]{0,220}roleInterceptDiagnosticTurnFinish\(_replyAudit/,'online early returns must still finish the audit');
  assert.match(source,/function cohabReplyAuditFinish\(result,delivered,partial\)/,'cohab audit must finish only after actual delivery is known');
  assert.match(source,/finally\{cohabReplyAuditFinish\(result,delivered/,'arrival and phone-result paths must settle the cohab audit');
  assert.match(source,/finally\{if\(_cohabAuditResult\)cohabReplyAuditFinish\(_cohabAuditResult/,'interactive cohab must settle after actual message insertion');
  assert.match(source,/cohabPhoneDeliverFact[\s\S]*?\{audit\}[\s\S]*?finally\{cohabReplyAuditFinish\(result,delivered/,'cohab phone retries must share one ordered audit and settle after display');
  assert.match(source,/finally\{[\s\S]{0,300}roleInterceptDiagnosticTurnFinish\(_offAudit/,'single-date early returns must still finish the audit');
  assert.ok((source.match(/roleInterceptAudit:null/g)||[]).length>=4,'continuation, inner-thought and delivery-only helper calls must be excluded');
  assert.doesNotMatch(source,/let interceptCaptured=false|roleInterceptOfflineCandidate\(c,(?:rawReply|fixRaw|retryRaw|retryFixRaw)/,'candidate auditing must no longer keep only the first unsafe offline response');
}

console.log('reply intercept diagnostics tests passed');
