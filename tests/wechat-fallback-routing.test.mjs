import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function wechatAuxConfigured(');
const end=source.indexOf('async function aiReply(id,note,replyToken,replyAccount,replyIntent)',start);
const visibleStart=source.indexOf('function roleVisibleEnvelopeText(value)');
const visibleEnd=source.indexOf('\n',visibleStart);
assert.ok(start>=0&&end>start,'wechat fallback helpers must exist');
assert.ok(visibleStart>=0&&visibleEnd>visibleStart,'visible reply envelope parser must exist');

assert.match(source,/具体约会只能使用本轮已选中的一条相关记忆/);
assert.doesNotMatch(source,/_off\.memory\.map\(offMemText\)/);
assert.match(source,/let content;try\{content=await wechatPrimaryReply\(\[\{role:'system',content:_sys\},\.\.\.hist,_pin\],_md,_routeState,c\)/);
assert.match(source,/wechatRoleDrift\(content\)&&!_routeState\.fallback/);
assert.match(source,/content:_stableSys/,'natural mode failures must use the complete stable prompt');
assert.match(source,/const _routeIndex=roleChatRouteIndex\(c\),_md=\{routeIndex:_routeIndex,aux:c\.model==='aux',complete:true\}/);
assert.match(source,/_repairMd=Object\.assign\(\{\},_md,\{aux:c\.model==='aux'\|\|wechatAuxConfigured\(_routeIndex\)\}\)/);
assert.match(source,/const fix=await wechatRoleRepair\(\[\{role:'system',content:_stableSys\}/,'role drift should use the bounded auxiliary repair helper');
assert.match(source,/toast\(c\.model==='aux'\?'已切换副模型':'已切换主模型',3000\)/,'manual model changes should use the short three-second notice');

const calls=[];
const notices=[];
const sandbox={
  S:{settings:{aux:{model:'backup-model'}}},
  chatRequestRoute:()=>null,
  apiRawErrorDetail:value=>String(value||'').slice(0,220),
  toast:(text,ms)=>notices.push([text,ms]),
  mode:'normal',
  async chatAPI(_messages,md){
    calls.push(!!md.aux);
    if(sandbox.mode==='throw'&&!md.aux)throw new Error('primary failed');
    if(sandbox.mode==='empty'&&!md.aux)return '';
    return md.aux?'aux reply':'main reply';
  },
  isRefusal:t=>/refusal/i.test(String(t||'')),
  wechatReasoningLeak:()=>false,
  splitBubbles:t=>String(t||'').split('\n'),
  isOOCLine:t=>/^OOC/.test(String(t||'')),
};
vm.runInNewContext(source.slice(visibleStart,visibleEnd)+'\n'+source.slice(start,end),sandbox);
const role={id:'c1'};

sandbox.mode='throw';let directState={fallback:false};
assert.equal(await sandbox.wechatPrimaryReply([], {aux:false}, directState,{id:'direct-failure'}),'aux reply');
assert.deepEqual(calls.splice(0),[false,true]);
let fallbackNotices=notices.splice(0);
assert.equal(fallbackNotices.length,1,'the first request must emit one precise fallback notice');
assert.match(fallbackNotices[0][0],/主模型.*失败.*副模型.*成功回复/);
assert.equal(fallbackNotices[0][1],8000);
assert.equal(directState.fallback,true);

let state={fallback:false};
sandbox.mode='normal';
assert.equal(await sandbox.wechatPrimaryReply([], {aux:false}, state,role),'main reply');
assert.deepEqual(calls.splice(0),[false]);
assert.equal(state.fallback,false);
assert.deepEqual(notices.splice(0),[]);

sandbox.mode='throw';state={fallback:false};
assert.equal(await sandbox.wechatPrimaryReply([], {aux:false}, state,role),'aux reply');
assert.deepEqual(calls.splice(0),[false,true]);
assert.equal(state.fallback,true);
fallbackNotices=notices.splice(0);
assert.equal(fallbackNotices.length,1);
assert.match(fallbackNotices[0][0],/主模型.*失败.*副模型.*成功回复/);
assert.equal(role._chatRouteDiagnostic.outcome,'fallback');
assert.equal(role._chatRouteDiagnostic.actualSlot,'副模型');
assert.match(role._chatRouteDiagnostic.reason,/primary failed/);
assert.equal(role._chatRouteDiagnostic.messageCount,0);

sandbox.mode='normal';state={fallback:false};
assert.equal(await sandbox.wechatPrimaryReply([], {aux:false}, state,role),'main reply');
assert.deepEqual(calls.splice(0),[false]);
assert.deepEqual(notices.splice(0),[['已切换主模型',3000]]);

sandbox.mode='empty';state={fallback:false};
assert.equal(await sandbox.wechatPrimaryReply([], {aux:false}, state,role),'aux reply');
assert.deepEqual(calls.splice(0),[false,true]);
assert.equal(state.fallback,true);
fallbackNotices=notices.splice(0);
assert.equal(fallbackNotices.length,1);
assert.match(fallbackNotices[0][0],/主模型.*失败.*副模型.*成功回复/);

sandbox.mode='throw';state={fallback:false};
sandbox.chatAPI=async(_messages,md)=>{calls.push(!!md.aux);throw new Error(md.aux?'aux failed':'primary failed');};
await assert.rejects(()=>sandbox.wechatPrimaryReply([], {aux:false}, state,role),/aux failed/);
assert.deepEqual(calls.splice(0),[false,true]);
assert.equal(state.fallback,true,'a failed auxiliary attempt must still consume the one fallback');
assert.deepEqual(notices.splice(0),[],'remaining on the already-visible auxiliary route should not duplicate the notice');
assert.equal(role._chatRouteDiagnostic.outcome,'failed');
assert.match(role._chatRouteDiagnostic.reason,/主模型：primary failed；副模型：aux failed/);

sandbox.S.settings.aux.model='';sandbox.mode='throw';state={fallback:false};
sandbox.chatAPI=async(_messages,md)=>{calls.push(!!md.aux);throw new Error('primary failed');};
await assert.rejects(()=>sandbox.wechatPrimaryReply([], {aux:false}, state,role),/primary failed/);
assert.deepEqual(calls.splice(0),[false]);
assert.equal(state.fallback,false);

sandbox.S.settings.aux.model='backup-model';state={fallback:false};
sandbox.chatAPI=async(_messages,md)=>{calls.push(!!md.aux);throw new Error('auxiliary 503');};
await assert.rejects(()=>sandbox.wechatPrimaryReply([], {aux:true}, state,role),/auxiliary 503/);
assert.deepEqual(calls.splice(0),[true],'a role already configured for the auxiliary model must make exactly one auxiliary request');
assert.equal(state.fallback,false,'there is no second auxiliary model to fall back to');
assert.equal(role._chatRouteDiagnostic.slot,'副模型');
assert.match(role._chatRouteDiagnostic.reason,/auxiliary 503/);

assert.equal(sandbox.wechatRoleDrift('normal reply'),false);
assert.equal(sandbox.wechatRoleDrift('refusal'),true);
assert.equal(sandbox.wechatRoleDrift('OOC: assistant'),true);

sandbox.S.settings.aux.model='backup-model';
sandbox.chatAPI=async(_messages,md)=>{calls.push(!!md.aux);return md.aux?'repaired in character':'main reply';};
const driftRole={id:'role-drift'},driftState={fallback:false};
assert.equal(await sandbox.wechatPrimaryReply([], {aux:false}, driftState,driftRole),'main reply');
assert.deepEqual(calls.splice(0),[false]);
assert.equal(await sandbox.wechatRoleRepair([], {aux:true}, driftState,driftRole),'repaired in character');
assert.deepEqual(calls.splice(0),[true]);
assert.deepEqual(notices.splice(0),[['已切换副模型',3000]]);
assert.equal(await sandbox.wechatRoleRepair([], {aux:true}, driftState,driftRole),null,'role drift repair must be limited to one auxiliary attempt');
assert.deepEqual(calls.splice(0),[]);

console.log('wechat fallback routing tests passed');
