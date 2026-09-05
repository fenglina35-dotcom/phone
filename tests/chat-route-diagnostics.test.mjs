import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('function apiRawErrorDetail(');
const end=source.indexOf('function apiCaughtCN(',start);
assert.ok(start>=0&&end>start,'API error detail helpers must exist');
const sandbox={};
vm.runInNewContext(source.slice(start,end),sandbox);

const detail=sandbox.apiRawErrorDetail('{"error":{"message":"upstream worker overloaded"}}');
assert.equal(detail,'upstream worker overloaded');
assert.match(sandbox.apiErrorCN(503,'{"error":{"message":"upstream worker overloaded"}}'),/HTTP 503/);
assert.match(sandbox.apiErrorCN(503,'{"error":{"message":"upstream worker overloaded"}}'),/上游原始原因：upstream worker overloaded/);
assert.doesNotMatch(sandbox.apiRawErrorDetail('failed with sk-secret-example-123456789'),/sk-secret-example/,'diagnostics must redact API-key-like values');

assert.match(source,/模型与路线诊断/,'role settings must expose the latest route diagnosis');
assert.match(source,/“测试主模型”和“测试副模型”各自只测对应槽位/,'diagnostic UI must distinguish the two explicit test buttons');
assert.match(source,/角色已经选择副模型时只请求这一份副模型，不存在第二个副模型，也不会再自动回退/,'diagnostic UI must not invent a second auxiliary fallback');
assert.match(source,/主模型「'\+firstMeta\.model\+'」失败，已由副模型「'\+fallbackMeta\.model\+'」成功回复/,'successful fallback must identify both actual models');
assert.match(source,/reason:'主模型：'\+firstReason\+'；副模型：'\+wechatDiagnosticReason\(e\)/,'dual failure must retain both causes');

const role={id:'r1',model:'chat',chatRouteIndex:0,_chatRouteDiagnostic:{at:1,outcome:'fallback',routeName:'路线一',slot:'主模型',model:'model-main',actualRoute:'路线一',actualSlot:'副模型',actualModel:'model-aux',status:503,reason:'worker <overloaded>',messageCount:14,requestChars:16384}};
let modal='';
const uiSandbox={
  S:{settings:{chat:{model:'model-main'},aux:{model:'model-aux'},chatRouteActive:0}},
  CHAT_ROUTE_NAMES:['路线一','路线二','路线三','路线四'],
  chatRoutesInit:()=>Array.from({length:4},(_,i)=>({base:'https://route-'+i+'.example/v1',key:'key-'+i,model:'model-'+i,aux:{model:'aux-'+i}})),
  chatRequestRoute:i=>({model:'model-'+i,aux:{model:'aux-'+i}}),
  getC:id=>id==='r1'?role:null,
  roleChatRouteOwnIndex:c=>Number.isInteger(c.chatRouteIndex)?c.chatRouteIndex:null,
  roleChatRouteIndex:c=>Number.isInteger(c.chatRouteIndex)?c.chatRouteIndex:0,
  roleChatRouteSource:c=>Number.isInteger(c.chatRouteIndex)?'角色独立路线':'跟随默认路线',
  fmtDT:()=> '2026/8/31 12:00',
  esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
  openModal:html=>{modal=html;},
};
const uiStart=source.indexOf('function wechatAuxConfigured(');
const uiEnd=source.indexOf('const _wechatActualModelRoute',uiStart);
vm.runInNewContext(source.slice(uiStart,uiEnd),uiSandbox);
uiSandbox.roleChatDiagnosticOpen('r1');
assert.match(modal,/路线一 · 主模型/);
assert.match(modal,/路线一 · 副模型/);
assert.match(modal,/model-aux/);
assert.match(modal,/14 条 · 16384 字符/);
assert.match(modal,/HTTP 503/);
assert.match(modal,/worker &lt;overloaded&gt;/,'raw provider details must be HTML-escaped before display');

role._chatRouteDiagnostic={at:1,outcome:'fallback',routeName:'路线一',slot:'主模型',model:'[CR]claude-opus-4-6',actualRoute:'路线一',actualSlot:'副模型',actualModel:'[AI]gemini-3.1-pro',status:403,reason:'用户额度不足，剩余额度: ¥-0.640000',messageCount:354,requestChars:76849};
uiSandbox.roleChatDiagnosticOpen('r1');
assert.match(modal,/不是小手机计算出的本地余额/,'provider balance errors must not masquerade as a local app balance calculation');
assert.match(modal,/同一站点的另一模型通道成功，也不能证明这个通道可用/);
assert.match(modal,/超过 6 万字符/,'large requests should be called out as a cost variable without claiming causation');

role.chatRouteIndex=1;
uiSandbox.roleChatDiagnosticOpen('r1');
assert.match(modal,/切换前实际结果/,'an old route-three-style record must not masquerade as the current route');
assert.match(modal,/当前路线尚未发起新请求|当前路线二尚未发起新请求/);
role.chatRouteIndex=0;

role.model='aux';
role._chatRouteDiagnostic={at:2,outcome:'failed',routeName:'路线一',slot:'副模型',model:'model-aux',actualRoute:'路线一',actualSlot:'副模型',actualModel:'model-aux',status:503,reason:'provider overloaded',messageCount:18,requestChars:22000};
uiSandbox.roleChatDiagnosticOpen('r1');
assert.match(modal,/副模型没有成功取得回复/,'an auxiliary-role failure must be described as one auxiliary failure, not a main-and-aux failure');
assert.doesNotMatch(modal,/主\/副模型都没有成功/);

console.log('chat route diagnostics tests passed');
