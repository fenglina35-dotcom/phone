import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const asyncStart = source.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('offline reply errors distinguish balance, auth, throttling, timeout and empty output', () => {
  const context = vm.createContext({ apiCaughtCN: e => `fallback:${e.message}` });
  vm.runInContext(`${functionSource('offlineReplyFailureReason')}${functionSource('offlineReplyEmptyReason')}this.reason=offlineReplyFailureReason;this.empty=offlineReplyEmptyReason;`, context);
  assert.match(context.reason(new Error('AI点数不足，请充值')), /余额或点数不足/);
  assert.match(context.reason(new Error('HTTP 401 unauthorized')), /API Key 无效/);
  assert.match(context.reason(new Error('HTTP 429 rate limit')), /请求太频繁|额度达到上限/);
  assert.match(context.reason(new Error('request timeout')), /请求超时/);
  assert.match(context.reason(new Error('Failed to connect')), /网络连接失败/);
  assert.match(context.empty(), /接口已经响应/);
  assert.match(context.empty(), /返回可能为空、只含控制标签、重复旧话，或线下格式不完整/);
  assert.match(context.empty(), /不是已确认的余额问题/);
});

test('offline reply UI reports the real reason while preserving the conversation', () => {
  const off = functionSource('offAI');
  assert.match(off, /线下回复未生成：.*offlineReplyEmptyReason/);
  assert.match(off, /const reason=offlineReplyFailureReason\(e\)[\s\S]*线下回复失败：'\+reason/);
  assert.match(off, /routeIndex=roleChatRouteIndex\(c\)[\s\S]*offlineReplyChatRequest\(req/,'single-date replies must use the route shown for that role');
  assert.match(off, /roleInterceptDiagnosticTurnFailure\(_offAudit,e,\{reason\}\)/,'a failed request must remain inspectable without inventing a reply');
  assert.match(off, /原对话没有被改动/);
  assert.doesNotMatch(off, /线下回复暂时没有生成，原对话没有被改动/);
});

test('a failed optional de-duplication rewrite keeps an already valid genuine model reply', () => {
  const context=vm.createContext({
    roleVisibleEnvelopeText:x=>String(x||''),
    offlineRoleDrift:x=>!String(x).includes('【'),
    offReplyItems:x=>String(x).includes('【')?[{text:String(x)}]:[]
  });
  vm.runInContext(`${functionSource('offlineKeepValidReplyOnRepairFailure')}this.keep=offlineKeepValidReplyOnRepairFailure;`,context);
  const valid='【他抬眼看过来。】\n我在。';
  assert.equal(context.keep(valid,new Error('network failed')),valid);
  assert.throws(()=>context.keep('只有裸露的第三人称描写',new Error('network failed')),/network failed/,'unsafe or unusable content must never masquerade as a fallback reply');
});

test('only optional repeat repair may preserve an earlier reply; initial and empty retries still fail closed',()=>{
  const off=functionSource('offAI'),cohab=functionSource('cohabReplyCore');
  assert.match(off,/roleInterceptDiagnosticTurn\(c,'offline',null,'单次约会'\)/);
  assert.match(cohab,/roleInterceptDiagnosticTurn\(c,'cohab',null,'共同生活'\)/);
  assert.match(cohab,/auditOpt=\(opt,stage\)=>Object\.assign\(\{\},opt,\{roleInterceptAudit:audit,roleInterceptStage:stage\}\)/);
  assert.match(off,/repeats\.length[\s\S]*try\{const fixRaw=await chatAPI[\s\S]*offlineKeepValidReplyOnRepairFailure\(r,e\)/);
  assert.match(cohab,/repairFails\.length[\s\S]*try\{const fixRaw=await cohabRoleChat[\s\S]*cohabRepeatRepairNote\(c,repairFails\)[\s\S]*offlineKeepValidReplyOnRepairFailure\(r,e\)/);
  assert.match(cohab,/return\{items,route,inspection,trips,travelErrors:travel\.errors\|\|\[\],_interceptAudit:audit,_interceptFinal:auditFinal,_interceptPartial:auditPartial,_interceptActionHandled:auditActionHandled,_interceptDone:false\}/);
  assert.match(cohab,/catch\(e\)\{roleInterceptDiagnosticTurnFailure\(audit,e,\{reason:offlineReplyFailureReason\(e\)\}\);throw e;\}/);
  assert.match(functionSource('cohabReplyAuditFinish'),/result\._interceptDone=true;return roleInterceptDiagnosticTurnFinish\(result\._interceptAudit,result\._interceptFinal,\{delivered:!!delivered,partial:!!\(result\._interceptPartial\|\|partial\)\}\)/);
  assert.doesNotMatch(off,/let retry[\s\S]{0,240}offlineKeepValidReplyOnRepairFailure/);
  assert.doesNotMatch(cohab,/let retry[\s\S]{0,240}offlineKeepValidReplyOnRepairFailure/);
});

test('the real common-life reply pipeline delivers the first genuine answer when only its optional rewrite loses network',async()=>{
  const runtime={calls:0,failFirst:false,auditFinished:0};
  const context=vm.createContext({
    Date,Map,String,
    offlineHistoryMessages:()=>[],cohabContextLimit:()=>30,
    cohabOnlineReturnState:()=>null,
    cohabSystem:()=>'',cohabMemoryPrompt:()=>'',offlineRequestMessages:()=>[],
    cohabRepairMessages:()=>[],
    personaPin:()=>'',offlineFormatPin:()=>'',roleReplyContinuityPin:()=>'',offlineWechatLiveOn:()=>true,
    roleVisibleEnvelopeText:x=>String(x||''),offlineRoleDrift:()=>false,
    roleInterceptDiagnosticTurn:()=>({candidates:[],selectedId:0}),
    roleInterceptDiagnosticTurnSelect:()=>true,
    roleInterceptDiagnosticTurnOutcome:()=>true,
    roleInterceptDiagnosticTurnFinish:()=>{runtime.auditFinished++;return false;},
    roleInterceptDiagnosticTurnFailure:(_audit,error)=>{runtime.auditFinished++;return !!error;},
    offlineReplyFailureReason:error=>String(error&&error.message||error),
    offReplyItems:x=>x?[{id:'genuine',who:'ta',text:'我在。'}]:[],
    cohabRoleChat:async()=>{runtime.calls++;if(runtime.failFirst||runtime.calls===2)throw new Error('network failed');return '【他抬眼看过来。】\n我在。';},
    offlineRepeatAudit:()=>({fails:['重复风险'],score:5}),cohabTimeEchoAudit:()=>({fails:[],score:0}),cohabRepeatRepairNote:()=>'',
    applyGrudgeTags:x=>x,offlineApplyMemoryTags:x=>({text:x}),
    cohabApplyPhoneTags:x=>({text:x}),cohabApplyOnlineMessageTags:x=>({text:x}),cohabApplyScheduleTags:x=>({text:x}),
    cohabExtractTravelTags:x=>({text:x,plans:[],errors:[]}),cohabApplyStateTags:x=>({text:x,matched:true}),
    cohabInferVisiblePlace:()=>{},offDedupeItems:x=>x,cohabCommitTripPlans:()=>[]
  });
  vm.runInContext(`${functionSource('offlineKeepValidReplyOnRepairFailure')}${functionSource('cohabReplyHistory')}${functionSource('cohabReplyCore')}${functionSource('cohabReplyAuditFinish')}this.run=cohabReplyCore;this.finish=cohabReplyAuditFinish;`,context);
  const result=await context.run({id:'role',name:'角色'},{},'最新一句','最新一句',600,{});
  assert.equal(runtime.calls,2,'one successful main request plus one failed optional repair');
  context.finish(result,true,false);
  assert.equal(runtime.auditFinished,1,'the common-life audit must finish even when optional repair loses network');
  context.finish(result,true,false);
  assert.equal(runtime.auditFinished,1,'finishing the same delivered result twice must not duplicate the audit');
  assert.deepEqual(Array.from(result.items,x=>x.text),['我在。'],'the genuine first response remains deliverable');
  runtime.calls=0;runtime.failFirst=true;runtime.auditFinished=0;
  await assert.rejects(()=>context.run({id:'role',name:'角色'},{},'最新一句','最新一句',600,{}),/network failed/,'a failed first request still cannot create a fake reply');
  assert.equal(runtime.auditFinished,1,'the common-life audit must also finish after a failed first request');
});

test('a transport failure retries once with the same genuine model route and never retries HTTP/auth errors',async()=>{
  const retryable=functionSource('offlineReplyTransportRetryable'),request=functionSource('offlineReplyChatRequest');
  let calls=0,lastOptions=null;
  const context=vm.createContext({
    String,Object,Math,Promise,setTimeout,
    chatAPI:async(_messages,opt)=>{calls++;lastOptions=opt;if(calls===1){const error=new Error('Load failed');error.transportRaw='Load failed';throw error;}return '真实模型回复';}
  });
  vm.runInContext(`${retryable}${request}this.run=offlineReplyChatRequest;`,context);
  const reply=await context.run([],{routeIndex:2,aux:false,roleInterceptStage:'单次约会主候选'});
  assert.equal(reply,'真实模型回复');
  assert.equal(calls,2);
  assert.equal(lastOptions.routeIndex,2,'retry must stay on the same selected route');
  assert.match(lastOptions.roleInterceptStage,/网络重试/);

  calls=0;
  context.chatAPI=async()=>{calls++;const error=new Error('HTTP 401 unauthorized');error.status=401;throw error;};
  await assert.rejects(()=>context.run([],{routeIndex:2}),/401/);
  assert.equal(calls,1,'an auth or HTTP response must not be retried or charged again');
});
