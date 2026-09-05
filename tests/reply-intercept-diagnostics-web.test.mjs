import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source=fs.readFileSync(path.join(process.cwd(),'app.js'),'utf8');
const start=source.indexOf("const ROLE_INTERCEPT_DIAG_SESSION_KEY=");
const end=source.indexOf('function offlineUnsafeRoleDrift',start);
assert.ok(start>=0&&end>start,'web diagnostic helper block must exist');
const block=source.slice(start,end);
assert.doesNotMatch(block,/\b(?:save|chatAPI|scheduleReply|msgs|cohabPushMessage)\s*\(/);
assert.doesNotMatch(block,/\b(?:localStorage|indexedDB)\b/);

const values=new Map();
let writes=0,account='main',modal='';
const contacts=new Map([['a',{id:'a',name:'角色A'}],['b',{id:'b',name:'角色B'}]]);
const context={
  sessionStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes++;values.set(key,String(value));}},
  actId:()=>account,
  getC:id=>contacts.get(id),
  openModal:html=>{modal=String(html);},
  fmtDT:at=>'TIME-'+at,
  esc:value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  roleVisibleEnvelopeText:value=>String(value??'').trim(),
  cleanRolePunct:value=>String(value??'').trim(),
  console,encodeURIComponent,JSON,Date,Array,String,Object
};
vm.createContext(context);
vm.runInContext(`${block}\nthis.diag={read:roleInterceptDiagnosticRead,open:roleInterceptDiagnosticOpen,begin:roleInterceptDiagnosticTurn,candidate:roleInterceptDiagnosticTurnCandidate,select:roleInterceptDiagnosticTurnSelect,outcome:roleInterceptDiagnosticTurnOutcome,finish:roleInterceptDiagnosticTurnFinish};`,context);
const {read,open,begin,candidate,select,outcome,finish}=context.diag;

const turn=begin(contacts.get('a'),'online','main','线上微信');
candidate(turn,'相同旧候选','主回复');
candidate(turn,'相同旧候选','纠正一');
candidate(turn,'最后采用','纠正二');
assert.equal(writes,0);
select(turn,'最后采用');
assert.equal(finish(turn,'最后采用',{delivered:true}),true);
assert.deepEqual(Array.from(read(contacts.get('a'),'online','main').items,x=>x.raw),['相同旧候选','相同旧候选']);
assert.equal(writes,1,'one turn writes all discarded candidates atomically');

const clean=begin(contacts.get('a'),'online','main','线上微信');candidate(clean,'完整显示','主回复');select(clean,'完整显示');
assert.equal(finish(clean,'完整显示',{delivered:true}),false);
assert.equal(read(contacts.get('a'),'online','main').items.length,2,'a clean turn does not erase the last intercept');

const partial=begin(contacts.get('a'),'online','alt','线上微信');candidate(partial,'保留句\n被删句','主回复');select(partial,'保留句\n被删句');
finish(partial,'保留句',{delivered:true,partial:true});
assert.equal(read(contacts.get('a'),'online','alt').raw,'保留句\n被删句');

const offline=begin(contacts.get('a'),'offline',null,'单次约会');candidate(offline,'线下初稿','主回复');candidate(offline,'线下修复稿','纠正');finish(offline,'',{delivered:false});
const cohab=begin(contacts.get('a'),'cohab',null,'共同生活');candidate(cohab,'共同生活初稿','主回复');finish(cohab,'',{delivered:false});
assert.equal(read(contacts.get('a'),'offline').raw,'线下初稿');
assert.equal(read(contacts.get('a'),'cohab').raw,'共同生活初稿');
assert.equal(read(contacts.get('b'),'cohab'),null);

const handled=begin(contacts.get('b'),'online','main','线上微信');candidate(handled,'[心情|开心]\n我到了','主回复');select(handled,'[心情|开心]\n我到了');select(handled,'我到了');
outcome(handled,{handled:1});
assert.equal(finish(handled,'我到了',{delivered:true}),false);
const alarm=begin(contacts.get('b'),'online','main','线上微信');candidate(alarm,'[闹钟|07:00|起床]','主回复');select(alarm,'[闹钟|07:00|起床]');
outcome(alarm,{handled:1});
assert.equal(finish(alarm,'',{delivered:true}),false);
const unknown=begin(contacts.get('b'),'online','main','线上微信');candidate(unknown,'[未知协议|正文]','主回复');select(unknown,'[未知协议|正文]');
assert.equal(finish(unknown,'',{delivered:true}),true);

const html=begin(contacts.get('a'),'cohab',null,'共同生活');candidate(html,'<script>alert(1)</script>','<img onerror=1>');candidate(html,'<b>第二项</b>','第二候选');finish(html,'',{delivered:false});
open('a','cohab');
assert.match(modal,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(modal,/&lt;b&gt;第二项&lt;\/b&gt;/);
assert.doesNotMatch(modal,/<script>|<img onerror=1>/);
assert.ok(modal.indexOf('&lt;script&gt;')<modal.indexOf('&lt;b&gt;第二项'));

assert.match(source,/roleInterceptDiagnosticOpen\('\$\{id\}','online'\)[\s\S]{0,100}<span>查看上一轮拦截内容<\/span>/);
assert.match(source,/roleInterceptDiagnosticOpen\('\$\{id\}','offline'\)">查看上一轮拦截内容<\/button>/);
assert.match(source,/roleInterceptDiagnosticOpen\('\$\{id\}','cohab'\)"><span>查看上一轮拦截内容<\/span>/);
assert.match(source,/roleInterceptAudit:null[\s\S]{0,300}return joinAIContinuation/);
assert.ok((source.match(/roleInterceptDiagnosticTurnCandidate\(opt\.roleInterceptAudit/g)||[]).length>=2);
assert.match(source,/roleInterceptDiagnosticTurn\(c,'online',replyAccount,'线上微信'\)/);
assert.match(source,/roleInterceptDiagnosticTurn\(c,'cohab',null,'共同生活'\)/);
assert.match(source,/roleInterceptDiagnosticTurn\(c,'offline',null,'单次约会'\)/);
const onlineFinallyLine=source.split(/\r?\n/).find(line=>line.includes('finally{roleInterceptDiagnosticTurnOutcome(_replyAudit'))||'';
assert.ok(onlineFinallyLine,'online reply finally must attach real action outcome before finishing the diagnostic turn');
assert.doesNotMatch(onlineFinallyLine,/roleInterceptDiagnosticOnlyHandled/,'finally must not infer success from a tag name alone');
assert.match(onlineFinallyLine,/roleInterceptDiagnosticTurnOutcome\(_replyAudit,\{handled:_replyAuditHandled\?1:0,failed:_replyAuditPartial\?1:0\}\);roleInterceptDiagnosticTurnFinish/);
assert.match(source,/forceRequestedVoiceReply[\s\S]{0,160}if\(_replyActionOutcome\.handled\)_replyAuditHandled=true;if\(_replyActionOutcome\.failed\)_replyAuditPartial=true;/);
assert.match(source,/_queueReplyIncoming=kind=>\{const pending=new Promise[\s\S]{0,700}roleInterceptDiagnosticTurnRememberFailure/);
assert.match(source,/content=content\.replace\([^\n]+来电[^\n]+_queueReplyIncoming\(k==='视频'\?'video':'voice'\);return '';/);
assert.match(source,/hiddenThoughtTags=\[\.\.\.String\(line\|\|''\)\.matchAll[\s\S]{0,420}hiddenThoughtFailed=hiddenThoughtTags\.some[\s\S]{0,260}if\(hiddenThoughtFailed\)_replyAuditPartial=true;else _replyAuditHandled=true;/);
assert.match(source,/\[心情值\\\|[\s\S]{0,180}if\(adjMood\(id,parseInt\(mm\[1\],10\)\|\|0\)\)_replyAuditHandled=true;else _replyAuditPartial=true;/);
assert.match(source,/if\(_replyAuditHandled\)got=true;\s*if\(got&&typeof roleBusyCaptureReply/);
assert.match(source,/if\(_wxLoginCompletion\)\{const before=content;content=wxLoginCompletionVisibleContent\(content\);if\(roleInterceptDiagnosticComparable\(before,false\)!==roleInterceptDiagnosticComparable\(content,false\)\)_replyAuditPartial=true;\}/);
assert.match(source,/const visibleLine=cleanWechatVisibleLine\(line,c\);if\(roleInterceptDiagnosticComparable\(line,false\)!==roleInterceptDiagnosticComparable\(visibleLine,false\)\)_replyAuditPartial=true;/);
assert.match(source,/function cohabReplyAuditFinish\(result,delivered,partial\)/);
assert.match(source,/finally\{cohabReplyAuditFinish\(result,delivered/);
assert.match(source,/finally\{if\(_cohabAuditResult\)cohabReplyAuditFinish\(_cohabAuditResult/);
assert.match(source,/cohabPhoneDeliverFact[\s\S]*?\{audit\}[\s\S]*?finally\{cohabReplyAuditFinish\(result,delivered/);
assert.match(source,/finally\{[\s\S]{0,300}roleInterceptDiagnosticTurnFinish\(_offAudit/);
assert.ok((source.match(/roleInterceptAudit:null/g)||[]).length>=4);

const wxLoginHelperStart=source.indexOf('function wxLoginCompletionVisibleContent(');
const wxLoginHelperEnd=source.indexOf('function wxLoginCompletionReplyValid(',wxLoginHelperStart);
const wxLoginFilterLine=source.split(/\r?\n/).find(line=>line.includes('if(_wxLoginCompletion){const before=content;'))||'';
assert.ok(wxLoginHelperStart>=0&&wxLoginHelperEnd>wxLoginHelperStart&&wxLoginFilterLine,'login-completion visible filter must remain testable');
{
  const helper=source.slice(wxLoginHelperStart,wxLoginHelperEnd),ctx={
    roleInterceptDiagnosticComparable:v=>String(v??'').replace(/\s+/g,' ').trim(),
    routePhoneInspectionTags:v=>String(v??'')
  };
  vm.createContext(ctx);
  vm.runInContext(`${helper}\nthis.run=function(raw,active=true){let content=raw,_replyAuditPartial=false,_wxLoginCompletion=active;${wxLoginFilterLine.trim()}return{content,partial:_replyAuditPartial};};`,ctx);
  const cut=ctx.run('我看完了 [登录微信]');
  assert.equal(cut.content,'我看完了');
  assert.equal(cut.partial,true,'login-completion filtering that deletes a model tag must preserve the original candidate');
  const untouched=ctx.run('我看完了');
  assert.equal(untouched.partial,false);
}

const wxActionStart=source.indexOf("const WX_ACTION_WORDS=");
const wxActionEnd=source.indexOf('function wxEscRe(',wxActionStart);
const cleanWechatStart=source.indexOf('function cleanWechatVisibleLine(');
const cleanWechatEnd=source.indexOf('function wxLocationMsg(',cleanWechatStart);
assert.ok(wxActionStart>=0&&wxActionEnd>wxActionStart&&cleanWechatStart>=0&&cleanWechatEnd>cleanWechatStart,'actual visible-line cleaner must remain testable');
const cleanWechatContext={
  stripHiddenThoughtTags:v=>String(v??''),
  cleanRolePunct:v=>String(v??''),
  wxKnownTagLine:()=>false,
  wxNarrationNameRe:()=>'(?:角色A)',
  wechatNarrationLeakLine:()=>false
};
vm.createContext(cleanWechatContext);
vm.runInContext(`${source.slice(wxActionStart,wxActionEnd)}\n${source.slice(cleanWechatStart,cleanWechatEnd)}\nthis.clean=cleanWechatVisibleLine;`,cleanWechatContext);
const mixedActionOriginal='我到了【低头看着你】';
const mixedActionVisible=cleanWechatContext.clean(mixedActionOriginal,{name:'角色A'});
assert.equal(mixedActionVisible,'我到了','mixed narration/action must be removed without discarding the visible speech');

const cohabPhoneStart=source.indexOf('function cohabApplyPhoneTags(');
const cohabPhoneEnd=source.indexOf('function cohabApplyScheduleTags(',cohabPhoneStart);
assert.ok(cohabPhoneStart>=0&&cohabPhoneEnd>cohabPhoneStart,'cohab phone-tag outcome helper must remain testable');
function runCohabPhoneTag(raw,opt={}){
  const audit={matched:0,handled:0,failed:0},ctx={
    roleInterceptDiagnosticAction:(row,ok)=>{if(row){row.matched++;if(ok)row.handled++;else row.failed++;}return !!ok;},
    cohabPhoneTarget:target=>opt.inspectValid===false?'':String(target||'').trim(),
    companionDispatchRoleByText:()=>opt.dispatchResult!==false,
    setTimeout:()=>0,
    cohabRunPhoneInspection:async()=>false
  };
  vm.createContext(ctx);
  vm.runInContext(`${source.slice(cohabPhoneStart,cohabPhoneEnd)}\nthis.runTag=cohabApplyPhoneTags;`,ctx);
  const result=ctx.runTag(raw,{id:'a',name:'角色A'},'',{schedule:opt.schedule!==false,audit});
  return{result,audit};
}
{
  const invalidDeferred=runCohabPhoneTag('[共同生活查看|不存在的目标]',{schedule:false,inspectValid:false});
  assert.deepEqual(invalidDeferred.audit,{matched:1,handled:0,failed:1},'schedule:false must still mark an invalid inspection target as failed');
  const validDeferred=runCohabPhoneTag('[共同生活查看|抖音]',{schedule:false,inspectValid:true});
  assert.deepEqual(validDeferred.audit,{matched:0,handled:0,failed:0},'a valid inspection owned by offAI is deferred, not falsely executed or failed');
  assert.equal(validDeferred.result.inspect,'抖音');
  const executed=runCohabPhoneTag('[共同生活锁定|抖音]',{schedule:false,dispatchResult:true});
  assert.deepEqual(executed.audit,{matched:1,handled:1,failed:0});
  const blocked=runCohabPhoneTag('[共同生活锁定|抖音]',{schedule:false,dispatchResult:false});
  assert.deepEqual(blocked.audit,{matched:1,handled:0,failed:1});

  const successTurn=begin(contacts.get('a'),'cohab',null,'共同生活');candidate(successTurn,'[共同生活锁定|抖音]','主回复');select(successTurn,'[共同生活锁定|抖音]');outcome(successTurn,executed.audit);
  assert.equal(finish(successTurn,'',{delivered:true}),false,'a tag with a real successful dispatch is not an intercept');
  const failedTurn=begin(contacts.get('a'),'cohab',null,'共同生活');candidate(failedTurn,'[共同生活锁定|抖音]','主回复');select(failedTurn,'[共同生活锁定|抖音]');outcome(failedTurn,blocked.audit);
  assert.equal(finish(failedTurn,'',{delivered:false,partial:true}),true,'a hidden tag whose dispatch failed remains inspectable');
}

/*
 * Run the real online-WeChat message-consumer loop with deterministic action
 * adapters.  These checks deliberately distinguish "the model returned a
 * command" from "the command really executed": a failed/no-op command is not
 * visible in chat, so the complete model candidate must remain inspectable.
 */
const onlineLoopStart=source.indexOf('const _replyCandidate=String(content||\'\').trim()');
const onlineLoopEnd=source.indexOf("if(got&&typeof roleBusyCaptureReply==='function')",onlineLoopStart);
assert.ok(onlineLoopStart>=0&&onlineLoopEnd>onlineLoopStart,'online reply consumer loop must remain testable');
const onlineLoop=source.slice(onlineLoopStart,onlineLoopEnd);
const onlineGameDecisionLine=source.split(/\r?\n/).find(line=>line.includes('同意游戏|拒绝游戏')&&line.includes('gameInviteDecide(id'))||'';
assert.ok(onlineGameDecisionLine,'online pending-game decision consumer must exist');

const preLoopHandledClause=(source.match(/if\(_replyActionOutcome\.handled\)_replyAuditHandled=true;/)||[])[0]||'';
assert.ok(preLoopHandledClause,'pre-loop action outcome must promote a real action to handled');
{
  const ctx={};vm.createContext(ctx);
  vm.runInContext(`this.run=function(handled){const _replyActionOutcome={handled};let _replyAuditHandled=false;${preLoopHandledClause}return _replyAuditHandled;};`,ctx);
  assert.equal(ctx.run(1),true,'a pre-loop action that really executed must be counted as handled');
  assert.equal(ctx.run(0),false,'an absent pre-loop action must not be counted as handled');
}

const replySetupLine=source.split(/\r?\n/).find(line=>line.includes('_queueReplyIncoming=kind=>'))||'';
const queueStart=replySetupLine.indexOf('_queueReplyIncoming='),queueEnd=replySetupLine.indexOf(';let _initiativeNoImage',queueStart);
const queueAssignment=queueStart>=0&&queueEnd>queueStart?replySetupLine.slice(queueStart,queueEnd):'';
const inlineIncomingCallLine=source.split(/\r?\n/).find(line=>line.includes('content=content.replace')&&line.includes("_queueReplyIncoming(k==='视频'?'video':'voice')"))||'';
const settleIncomingLine=source.split(/\r?\n/).find(line=>line.includes('const callResults=await Promise.all(_replyDeferredIncoming)'))||'';
assert.ok(queueAssignment&&inlineIncomingCallLine&&settleIncomingLine,'deferred incoming-call producer, consumer and result settlement must all exist');
async function runInlineIncoming(callResult){
  let calls=0,rememberedFailures=0;const ctx={
    Promise,
    setTimeout:fn=>{fn();return 1;},
    incomingCall:()=>{calls++;return callResult;},
    roleInterceptDiagnosticTurnRememberFailure:()=>{rememberedFailures++;return true;}
  };
  vm.createContext(ctx);
  vm.runInContext(`this.run=async function(raw){const c={id:'a'},_explicitCallTurn=false,_replyAudit={},_replyDeferredIncoming=[];let content=raw,_replyAuditHandled=false,_replyAuditPartial=false;let ${queueAssignment};${inlineIncomingCallLine.trim()}${settleIncomingLine.trim()}return{content,handled:_replyAuditHandled,partial:_replyAuditPartial};};`,ctx);
  return{result:await ctx.run('先等等[来电|视频]'),calls,rememberedFailures};
}
{
  const success=await runInlineIncoming(true);
  assert.equal(success.result.content,'先等等');
  assert.equal(success.result.handled,true,'a deferred call is handled only after incomingCall really succeeds');
  assert.equal(success.result.partial,false);
  assert.equal(success.calls,1);
  assert.equal(success.rememberedFailures,0);
  const failed=await runInlineIncoming(false);
  assert.equal(failed.result.content,'先等等');
  assert.equal(failed.result.handled,false,'merely scheduling a deferred call must not claim success');
  assert.equal(failed.result.partial,true,'an incomingCall no-op must preserve the swallowed call tag as partial');
  assert.equal(failed.calls,1);
  assert.equal(failed.rememberedFailures,1);
}

function runOnlineGameDecision(actionResult){
  const ctx={gameInviteDecide:()=>actionResult,roleGameAcceptOrReinvite:()=>actionResult};
  vm.createContext(ctx);
  vm.runInContext(`this.run=function(){const id='a';let content='答应你\\n[同意游戏]',_replyAuditPartial=false,_replyAuditHandled=false;${onlineGameDecisionLine.trim()}return{content,partial:_replyAuditPartial};};`,ctx);
  return ctx.run();
}

const giftSendStart=source.indexOf('function giftSend(');
const giftSendEnd=source.indexOf('let _giftNotifyBusy',giftSendStart);
assert.ok(giftSendStart>=0&&giftSendEnd>giftSendStart,'gift action helper must exist');
const giftSendBlock=source.slice(giftSendStart,giftSendEnd);
function runGiftSendContract(messages=[]){
  const calls={parcel:0,save:0},rows=messages.map(x=>({...x})),role={id:'a',name:'角色A'},ctx={
    getC:()=>role,
    msgs:()=>rows,
    Date,
    giftEffectRecipe:()=>({}),
    uid:()=>`gift-${rows.length+1}`,
    parcelDeliver:()=>{calls.parcel++;},
    save:()=>{calls.save++;},
    cur:()=>({p:'none'}),
    appendChatMessageHTML:()=>{},
    render:()=>{}
  };
  vm.createContext(ctx);
  vm.runInContext(`${giftSendBlock}\nthis.runGift=giftSend;`,ctx);
  return {value:ctx.runGift('a','花',99,''),rows,calls};
}

const quoteMatchStart=source.indexOf('function _matchMyLine(');
const quoteMatchEnd=source.indexOf('function qPressStart(',quoteMatchStart);
assert.ok(quoteMatchStart>=0&&quoteMatchEnd>quoteMatchStart,'role quote matcher must exist');
const quoteMatchBlock=source.slice(quoteMatchStart,quoteMatchEnd);
function runQuoteMatcher(fragment,userLines){
  const rows=(userLines||[]).map((content,i)=>({role:'user',type:'text',content,id:`u${i}`})),ctx={
    msgs:()=>rows,
    _gnorm:v=>String(v??'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'')
  };
  vm.createContext(ctx);
  vm.runInContext(`${quoteMatchBlock}\nthis.runQuote=_matchMyLine;`,ctx);
  return ctx.runQuote('a',fragment);
}

async function runOnlineConsumer(raw,opt={}){
  const runtime={
    opt,
    messages:(opt.messages||[]).map(x=>({...x})),
    notified:[],
    saved:0,
    stickerPicks:0,
    gameCalls:0,
    cinemaCalls:0,
    giftCalls:0,
    blocked:false,
    uid:0
  };
  const role=Object.assign({id:'a',name:'角色A',blocked:false,noSticker:false,stickerGroups:[]},opt.role||{});
  const state={settings:{quoteOn:opt.quoteOn!==false,voiceFreq:1},aiStickers:(opt.aiStickers||[]).map(x=>({...x})),calendar:[]};
  const ctx={
    runtime,
    S:state,
    Date,
    Math,
    String,
    Array,
    Object,
    RegExp,
    Promise,
    console,
    cleanRolePunct:v=>String(v??'').trim(),
    normalizeImageLine:v=>String(v??''),
    normTag:v=>String(v??''),
    hiddenThoughtTagPresent:v=>/<(?:指令解析|思维链)>|[\[【]\s*(?:思维链|分析|内心|心情)(?:[|｜:：]|[\]】])/i.test(String(v??'')),
    stripHiddenThoughtTags:v=>String(v??'').replace(/[\[【]\s*(?:内心|心情)\s*[|｜:：][^\]】]*[\]】]/gi,''),
    cleanWechatVisibleLine:v=>typeof opt.cleanWechatVisibleLine==='function'?opt.cleanWechatVisibleLine(String(v??'')):String(v??''),
    roleInterceptDiagnosticComparable:v=>String(v??'').replace(/\s+/g,' ').trim(),
    splitChatBubbles:v=>String(v??'').split(/\n+/).map(x=>x.trim()).filter(Boolean),
    isPhotoPromptFragment:()=>false,
    parseMomentCommandLine:()=>null,
    postRoleMoment:()=>false,
    isRefusal:()=>false,
    setNaturalInnerThought:()=>false,
    moodInnerMonologue:v=>v,
    honestMoodText:(_c,v)=>v,
    adjMood:()=>opt.moodResult===true,
    aboutMeNoteText:v=>String(v??''),
    rememberFromConversation:()=>opt.rememberResult||'added',
    save:()=>{runtime.saved++;},
    toast:()=>{},
    publishRoleTweet:()=>false,
    replyStale:()=>false,
    actId:()=>opt.account||'main',
    sleep:async()=>{},
    roleMessageGap:()=>0,
    offlineReplyBlocked:()=>false,
    wxLoginBlockReply:()=>false,
    deliveryRealEnabled:()=>false,
    deliveryRolePreludeAllowed:()=>false,
    deliveryHandleRoleRequest:()=>{},
    msgs:()=>runtime.messages,
    notifyIncoming:(_c,m)=>runtime.notified.push(m),
    refreshChatMessages:()=>{},
    addAlarm:()=>true,
    uid:()=>`m${++runtime.uid}`,
    parseVoiceTagLine:()=>null,
    markPay:()=>null,
    parcelDeliver:()=>{},
    markFood:()=>[],
    addBill:()=>{},
    markTransfer:()=>null,
    lastGift:()=>null,
    incomingCall:()=>{},
    rpCreateInviteFromAI:async()=>false,
    roleGameInvite:()=>{runtime.gameCalls++;return opt.gameResult!==false;},
    genWxid:()=>'',
    setBlk:(_c,v)=>{runtime.blocked=!!v;_c.blocked=!!v;},
    friendMetaSet:()=>{},
    render:()=>{},
    aiPickSticker:()=>{runtime.stickerPicks++;return opt.sticker||null;},
    _matchMyLine:()=>opt.quoteMatch===undefined?null:opt.quoteMatch,
    lineToMsgs:(line)=>{
      if(typeof opt.lineToMsgs==='function')return opt.lineToMsgs(line);
      return [{role:'assistant',type:'text',content:line}];
    },
    roleInterceptDiagnosticHandledTagLine:()=>false,
    deCallFmt:v=>String(v??''),
    splitActions:v=>[String(v??'')],
    LEAKRE:/(?:<指令解析>|指令解析|思维链|^分析[:：])/i,
    wechatTailJournalWrite:()=>{},
    cur:()=>({p:'none'}),
    appendChatMessageHTML:()=>{},
    cinemaRoleInvite:()=>false,
    cinemaRoleAnswerInvite:()=>{runtime.cinemaCalls++;return opt.cinemaResult!==false;},
    giftSend:()=>{runtime.giftCalls++;return opt.giftResult!==false;},
    ttsContentLang:()=>'',
    hasForeign:()=>true,
    ttsRequestedCue:()=>'',
    ttsAutoCue:()=>'',
    ttsApiOn:()=>false,
    scheduleVoiceWarm:()=>{},
    voiceProgressiveOn:()=>false,
    roleImageStudioOn:()=>false,
    imageGenerationAvailable:()=>false,
    _altReportInfo:null,
    diceCompare:false
  };
  vm.createContext(ctx);
  vm.runInContext(`
    this.exercise=async function(content){
      const id='a',c=role,replyAccount=${JSON.stringify(opt.account||'main')},replyToken=1,replyIntent=null,note='',_userText='',_deliveryActionMeta={},_explicitCallTurn=false;
      const _initiativeNoImage=false,_initiativeNoLocation=false,_naturalOn=${opt.naturalOn===true},cap=20;
      let _replyAuditFinal='',_replyAuditPartial=false,_replyAuditHandled=false,_replyDeferredIncoming=[];
      const _queueReplyIncoming=kind=>{runtime.incomingCalls=(runtime.incomingCalls||0)+1;const pending=Promise.resolve(runtime.opt.incomingResult!==false);_replyDeferredIncoming.push(pending);return pending;};
      ${onlineLoop}
      return {partial:_replyAuditPartial,handled:_replyAuditHandled,got,final:_replyAuditFinal,pendQuote};
    };
  `,Object.assign(ctx,{role}));
  const result=await ctx.exercise(String(raw??''));
  return {result,runtime,state,role};
}

{
  const legacyWrong=await runOnlineConsumer('[内心|不能显示的旧模式内心]');
  assert.equal(legacyWrong.result.partial,true,'legacy mode must retain a swallowed natural-mode inner-thought tag for inspection');
  assert.equal(legacyWrong.result.got,false);
  const naturalWrong=await runOnlineConsumer('[心情|不能显示的旧模式心情]',{naturalOn:true});
  assert.equal(naturalWrong.result.partial,true,'natural mode must retain a swallowed legacy mood tag for inspection');
  assert.equal(naturalWrong.result.got,false);
  const emptyNaturalThought=await runOnlineConsumer('[内心|]',{naturalOn:true});
  assert.equal(emptyNaturalThought.result.partial,true,'an empty mode-correct inner-thought tag did not execute and must remain inspectable');
  assert.equal(emptyNaturalThought.result.handled,false);
  assert.equal(emptyNaturalThought.result.got,false);
  const legacyRight=await runOnlineConsumer('[心情|平静]');
  assert.equal(legacyRight.result.partial,false,'the mode-correct hidden mood tag is a successful internal action');
  assert.equal(legacyRight.result.handled,true);
  assert.equal(legacyRight.result.got,true,'a pure successful hidden action must make the turn count as delivered');
}

{
  const failedMood=await runOnlineConsumer('[心情值|+5]');
  assert.equal(failedMood.result.partial,true,'a mood-value command rejected by the state layer must remain inspectable');
  assert.equal(failedMood.result.got,false);
  const changedMood=await runOnlineConsumer('[心情值|+5]',{moodResult:true});
  assert.equal(changedMood.result.partial,false);
  assert.equal(changedMood.result.handled,true);
  assert.equal(changedMood.result.got,true,'a pure successful mood-value action must count as delivered');
  const alarmOnly=await runOnlineConsumer('[闹钟|07:00|起床]');
  assert.equal(alarmOnly.result.partial,false);
  assert.equal(alarmOnly.result.handled,true);
  assert.equal(alarmOnly.result.got,true,'a pure successful alarm action must count as delivered');
}

{
  const acceptedCall=await runOnlineConsumer('[来电|视频]',{incomingResult:true});
  assert.equal(acceptedCall.result.partial,false);
  assert.equal(acceptedCall.result.handled,true);
  assert.equal(acceptedCall.runtime.incomingCalls,1);
  const rejectedCall=await runOnlineConsumer('[来电|视频]',{incomingResult:false});
  assert.equal(rejectedCall.result.partial,true,'a whole-line call tag whose incomingCall failed must remain inspectable');
  assert.equal(rejectedCall.result.handled,false);
  assert.equal(rejectedCall.runtime.incomingCalls,1);
}

{
  const mixed=await runOnlineConsumer(mixedActionOriginal,{cleanWechatVisibleLine:line=>cleanWechatContext.clean(line,{name:'角色A'})});
  assert.equal(mixed.result.partial,true,'a mixed line whose action narration was removed must preserve the original candidate as partial');
  assert.equal(mixed.runtime.messages.length,1);
  assert.equal(mixed.runtime.messages[0].content,'我到了');
}

{
  const failed=await runOnlineConsumer('[表情|开心]');
  assert.equal(failed.result.partial,true,'missing sticker must preserve the swallowed model candidate');
  assert.equal(failed.runtime.messages.length,0);
  const disabled=await runOnlineConsumer('[表情|开心]',{role:{noSticker:true}});
  assert.equal(disabled.result.partial,true,'disabled stickers must not be mistaken for an executed command');
  const sent=await runOnlineConsumer('[表情|开心]',{sticker:{img:'data:image/png;base64,ok',meaning:'开心'}});
  assert.equal(sent.result.partial,false,'a sticker actually added to chat is handled, not intercepted');
  assert.equal(sent.runtime.messages.at(-1).type,'sticker');
}

{
  const missingCinema=await runOnlineConsumer('[同意放映]',{cinemaResult:false});
  assert.equal(missingCinema.result.partial,true,'no pending cinema invitation must be inspectable');
  const acceptedCinema=await runOnlineConsumer('[同意放映]',{cinemaResult:true});
  assert.equal(acceptedCinema.result.partial,false,'an invitation that was actually accepted is handled');
  assert.equal(runOnlineGameDecision(false).partial,true,'no pending game invitation must be inspectable');
  assert.equal(runOnlineGameDecision(true).partial,false,'a pending game invitation actually answered is handled');
  const missingGame=await runOnlineConsumer('[你画我猜]',{gameResult:false});
  assert.equal(missingGame.result.partial,true,'a game command whose card was not created must be inspectable');
  const openedGame=await runOnlineConsumer('[你画我猜]',{gameResult:true});
  assert.equal(openedGame.result.partial,false,'a game card that was actually created is handled');
}

for(const type of ['transfer','redpacket']){
  const now=Date.now(),card={role:'assistant',type,amount:66,time:now};
  const duplicate=await runOnlineConsumer(type,{messages:[card],lineToMsgs:()=>[{role:'assistant',type,amount:66}]});
  assert.equal(duplicate.result.partial,true,`duplicate ${type} suppressed from chat must remain inspectable`);
  assert.equal(duplicate.runtime.messages.length,1);
  const fresh=await runOnlineConsumer(type,{lineToMsgs:()=>[{role:'assistant',type,amount:66}]});
  assert.equal(fresh.result.partial,false,`fresh ${type} that is appended is handled`);
  assert.equal(fresh.runtime.messages.length,1);
}

{
  const duplicateContract=runGiftSendContract([{role:'assistant',type:'gift',name:'花',time:Date.now()}]);
  assert.equal(duplicateContract.value,false,'giftSend must report a duplicate/no-op as failure');
  assert.equal(duplicateContract.calls.parcel,0);
  const successContract=runGiftSendContract();
  assert.equal(successContract.value,true,'giftSend must report a real parcel/message write as success');
  assert.equal(successContract.calls.parcel,1);
  const duplicateGift=await runOnlineConsumer('[送礼|花|99]',{giftResult:false});
  assert.equal(duplicateGift.result.partial,true,'a duplicate/rejected gift action must be inspectable');
  const sentGift=await runOnlineConsumer('[送礼|花|99]',{giftResult:true});
  assert.equal(sentGift.result.partial,false,'a gift action that actually ran is handled');
}

{
  const empty=await runOnlineConsumer('被格式清理掉的普通内容',{lineToMsgs:()=>[]});
  assert.equal(empty.result.partial,true,'non-command content producing no message must be inspectable');
  assert.equal(empty.runtime.messages.length,0);
}

{
  assert.equal(runQuoteMatcher('完全不存在',['今天吃了面','早点休息']),null,'quote matcher must not invent a match by returning the model fragment');
  assert.equal(runQuoteMatcher('早点休息',['今天吃了面','早点休息']),'早点休息');
  const missingQuote=await runOnlineConsumer('[引用|聊天里不存在的原话]',{quoteMatch:null});
  assert.equal(missingQuote.result.partial,true,'an unmatched quote command must be inspectable');
  const danglingQuote=await runOnlineConsumer('[引用|真实原话]',{quoteMatch:'真实原话'});
  assert.equal(danglingQuote.result.partial,true,'a matched quote with no following bubble is still unexecuted');
  const usedQuote=await runOnlineConsumer('[引用|真实原话]\n随后回复',{quoteMatch:'真实原话'});
  assert.equal(usedQuote.result.partial,false,'a quote attached to a real following bubble is handled');
  assert.equal(usedQuote.runtime.messages.at(-1).quote.text,'真实原话');
}

{
  const lateLeak=await runOnlineConsumer('先正常说一句\n分析：这段内部推理不能显示');
  assert.equal(lateLeak.result.partial,true,'late-stage reasoning removed after a visible bubble must remain inspectable');
  assert.equal(lateLeak.runtime.messages.length,1);
  assert.equal(lateLeak.runtime.messages[0].content,'先正常说一句');
}

{
  const noCard=await runOnlineConsumer('[已加|小王]');
  assert.equal(noCard.result.partial,true,'[已加] without a pending name card must be inspectable');
  const card={role:'user',type:'namecard',dir:'mine',cname:'小王',_accepted:false};
  const acceptedCard=await runOnlineConsumer('[已加|小王]',{messages:[card]});
  assert.equal(acceptedCard.result.partial,false,'[已加] that updates the matching pending card is handled');
  assert.equal(acceptedCard.runtime.messages[0]._accepted,true);
  const mainBlock=await runOnlineConsumer('[拉黑]',{account:'main'});
  assert.equal(mainBlock.result.partial,true,'a forbidden/no-op main-account block tag must be inspectable');
  const altBlock=await runOnlineConsumer('[拉黑]',{account:'friend-account'});
  assert.equal(altBlock.result.partial,false,'an alternate-account block that actually changes state is handled');
  assert.equal(altBlock.role.blocked,true);
  const noFavourite=await runOnlineConsumer('[收藏表情]');
  assert.equal(noFavourite.result.partial,true,'favourite-sticker command without a source sticker must be inspectable');
  const sourceSticker={role:'user',type:'sticker',img:'data:image/png;base64,fav',meaning:'喜欢'};
  const savedFavourite=await runOnlineConsumer('[收藏表情]',{messages:[sourceSticker]});
  assert.equal(savedFavourite.result.partial,false,'a newly saved source sticker is handled');
  assert.equal(savedFavourite.state.aiStickers.length,1);
  const duplicateFavourite=await runOnlineConsumer('[收藏表情]',{messages:[sourceSticker],aiStickers:[{img:sourceSticker.img}]});
  assert.equal(duplicateFavourite.result.partial,true,'an already-saved favourite command is a swallowed no-op and must be inspectable');
}

console.log('web reply intercept diagnostics tests passed');
