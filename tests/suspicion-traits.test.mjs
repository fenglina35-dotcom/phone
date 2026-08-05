import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

assert.match(source,/const TRAIT_DEFAULTS=\{own:50,ctrl:50,jelly:50,cling:50,active:50,spice:50,paranoid:0,suspicious:0\}/);
assert.match(source,/\['paranoid','偏执度'\],\['suspicious','敏感多疑'\]/);
assert.match(source,/两项都到95–100会进入严格执行档：强度优先于基础人设，人设只决定表达方式/);
assert.match(functionSource('traitDesc'),/敏感多疑/);
assert.match(functionSource('traitDesc'),/一旦有真实疑点就很难放下/);
assert.match(functionSource('suspicionPrompt'),/敏感多疑高、偏执低/);
assert.match(functionSource('suspicionPrompt'),/敏感低、偏执高/);
assert.match(functionSource('suspicionPrompt'),/不能凭空捏造/);
assert.match(functionSource('suspicionPrompt'),/绝不能绕过权限/);

const context=vm.createContext({Date,Math,extremeLoveOn:()=>false});
for(const name of ['traitValue','suspicionState','suspicionDecayRate','suspicionSnapshot'])vm.runInContext(functionSource(name),context);
const now=Date.now();
const low={traits:{paranoid:0},suspicion:{score:100,updatedAt:now-2*3600000,unresolved:[]}};
const high={traits:{paranoid:100},suspicion:{score:100,updatedAt:now-2*3600000,unresolved:[]}};
assert.ok(context.suspicionSnapshot(high,now)>context.suspicionSnapshot(low,now),'high paranoia must decay more slowly');
assert.equal(context.traitValue({traits:{}},'suspicious',0),0);

const hangup=functionSource('suspicionHandleUserHangup');
assert.match(hangup,/meta\.dir!=='incoming'/);
assert.match(hangup,/suspicionInterruptionDelay\(cc\)/);
assert.match(hangup,/不要在第一步同时来电、登录微信、远控或索要多种证明/);
assert.match(functionSource('suspicionTick'),/call_failed_wait/);
assert.match(functionSource('suspicionRunEscalation'),/suspicionEscalationChoice/);
assert.match(functionSource('suspicionEscalationChoice'),/S\.couple\.wxLoginAuth/);
assert.match(functionSource('suspicionEscalationChoice'),/remoteControlAllowed\(c\.id\)/);
assert.match(functionSource('incomingCall'),/_suspicionEvent:opt\.suspicionEvent/);
assert.match(functionSource('callMissed'),/suspicionCallFailed/);
assert.match(functionSource('declineCall'),/suspicionCallFailed/);
assert.match(functionSource('pushMsg'),/suspicionOnUserMsg\(id,m\)/);

assert.match(source,/要求报备\|要求定位\|要求照片/);
assert.match(functionSource('lineToMsg'),/suspicionRequestMessage/);
assert.match(functionSource('suspicionRequestMessage'),/lastRequestAt/);
assert.match(functionSource('suspicionRequestMessage'),/10\*60000/);
assert.match(functionSource('suspicionRequestAction'),/发送报备/);
assert.match(functionSource('suspicionRequestAction'),/cLoc\(id\)/);
assert.match(functionSource('suspicionRequestAction'),/cPhoto\(id\)/);
assert.match(functionSource('suspicionFulfillRequest'),/visionState==='success'/);
assert.match(functionSource('buildPart'),/m\.type==='verifyreq'/);
assert.match(functionSource('clearContactMemoryData'),/'suspicion'/);
assert.match(functionSource('coupleWxLoginAuth'),/suspicionRaise\(c,'permission_closed'/);
assert.match(functionSource('coupleRemoteControlAuth'),/suspicionRaise\(c,'permission_closed'/);
assert.match(source,/setInterval\(suspicionTick,1000\)/);

let seq=0;
const requestContext=vm.createContext({Date,Math,save:()=>{},uid:()=>`m${++seq}`,extremeLoveOn:()=>false});
for(const name of ['traitValue','suspicionState','suspicionEventOpen','suspicionRequestMessage'])vm.runInContext(functionSource(name),requestContext);
const requestRole={traits:{suspicious:80,paranoid:60}};
const request=requestContext.suspicionRequestMessage(requestRole,'location','想确认你安全到家');
assert.equal(request.type,'verifyreq');
assert.equal(request.requestKind,'location');
assert.equal(requestRole.suspicion.request.messageId,request.id);
assert.equal(requestContext.suspicionRequestMessage(requestRole,'photo','再拍一张'),null,'one active request must suppress duplicates');

const cardContext=vm.createContext({bubbleLook:()=>({cls:'',css:''}),bubbleIconFor:()=>'',esc:v=>String(v??'')});
vm.runInContext(functionSource('buildPart'),cardContext);
const card=cardContext.buildPart({id:'r1'},{id:'m1',type:'verifyreq',requestKind:'photo',reason:'看看你在做什么',status:'pending'},false);
assert.match(card,/确认请求 · 拍张照片/);
assert.match(card,/去拍照/);
assert.match(card,/稍后/);
assert.match(card,/拒绝/);

let hangupDone;
const hangupRole={id:'r1',traits:{suspicious:80,paranoid:70}};
const hangupState={score:20,unresolved:[]};
const hangupContext=vm.createContext({
  S:{me:{name:'小北'}},Date,Math,uid:()=>`e${++seq}`,save:()=>{},
  traitValue:(c,k)=>c.traits[k]||0,suspicionRaise:()=>hangupState,
  suspicionForceLevel:()=>4,suspicionInterruptionDelay:()=>10000,
  suspicionEventOpen:e=>!!e,
  scheduleReply:(id,note,done)=>{hangupDone=done;return true;},
  getC:()=>hangupRole,suspicionState:()=>hangupState,suspicionUserRepliedSince:()=>false,
});
vm.runInContext(functionSource('suspicionHandleUserHangup'),hangupContext);
assert.equal(hangupContext.suspicionHandleUserHangup(hangupRole,{dir:'outgoing',kind:'voice',dur:5}),false,'a call initiated by the user must not trigger this flow');
assert.equal(hangupContext.suspicionHandleUserHangup(hangupRole,{dir:'incoming',kind:'voice',dur:5}),true);
assert.equal(hangupState.pendingHangup.status,'asking');
hangupDone(true);
assert.equal(hangupState.pendingHangup.status,'waiting');
assert.ok(hangupState.pendingHangup.deadline-hangupState.pendingHangup.askedAt===10000);

const rejectedState={score:30,unresolved:[]};
hangupContext.suspicionRaise=()=>rejectedState;
hangupContext.suspicionState=()=>rejectedState;
assert.equal(hangupContext.suspicionHandleUserHangup(hangupRole,{dir:'incoming',kind:'voice',dur:0,rejected:true}),true);
assert.equal(rejectedState.pendingHangup.rejected,true);
assert.equal(rejectedState.pendingHangup.forceLevel,4);
hangupDone(true);
assert.equal(rejectedState.pendingHangup.status,'waiting');
assert.equal(rejectedState.pendingHangup.deadline-rejectedState.pendingHangup.askedAt,10000);

const forceContext=vm.createContext({Date,Math,extremeLoveOn:()=>false});
for(const name of ['traitValue','suspicionForceLevel','suspicionInterruptionDelay','suspicionActiveWindow'])vm.runInContext(functionSource(name),forceContext);
const maxTraits={traits:{suspicious:100,paranoid:100}};
assert.equal(forceContext.suspicionForceLevel(maxTraits),4);
assert.equal(forceContext.suspicionInterruptionDelay(maxTraits),10000);
assert.equal(forceContext.suspicionActiveWindow(maxTraits,new Date('2026-07-29T03:00:00+08:00')),true,'strict 100 mode must not be muted by quiet hours');
assert.equal(forceContext.suspicionForceLevel({traits:{suspicious:50,paranoid:50}}),1);

let escalationCall=null;
const escalationContext=vm.createContext({Date,save:()=>{},_call:null,suspicionUserRepliedSince:()=>false,suspicionCancelHangup:()=>{},suspicionEscalationChoice:()=>{throw new Error('strict first escalation must not be model-selected')},incomingCall:(id,kind,opt)=>{escalationCall={id,kind,opt};return true;},S:{couple:null},wxLoginActive:()=>false,wxDoLogin:()=>{},remoteControlAllowed:()=>false,remoteControlActive:()=>false,remoteControlRequest:()=>{},scheduleReply:()=>true});
vm.runInContext(functionSource('suspicionRunEscalation'),escalationContext);
const strictEvent={id:'strict1',kind:'voice',createdAt:Date.now()-20000,status:'waiting',forceLevel:4,rejected:true};
escalationContext.suspicionRunEscalation({id:'r1'},strictEvent,false);
assert.equal(strictEvent.action,'call');
assert.equal(strictEvent.status,'calling');
assert.equal(escalationCall.id,'r1');
assert.equal(escalationCall.kind,'voice');
assert.equal(escalationCall.opt.suspicionEvent,'strict1');

let loweredBy=0;
const aftermathState={pendingHangup:{id:'strict2',kind:'voice',rejected:true,forceLevel:4,status:'waiting',createdAt:Date.now()-130000,askedAt:Date.now()-120000}};
const aftermathContext=vm.createContext({Date,S:{me:{name:'小北'}},suspicionState:()=>aftermathState,suspicionForceLevel:()=>4,suspicionLower:(c,n)=>{loweredBy=n},save:()=>{}});
vm.runInContext(functionSource('suspicionCancelHangup'),aftermathContext);
assert.equal(aftermathContext.suspicionCancelHangup({id:'r1'},'reply'),true);
assert.equal(loweredBy,3,'a reply must not instantly erase 100-level paranoia');
assert.equal(aftermathState.aftermath.consumed,false);
assert.match(aftermathState.aftermath.summary,/拒接了你打来的语音电话/);

assert.match(functionSource('suspicionPrompt'),/具体表达必须像这个角色本人/);
assert.match(functionSource('suspicionStrictPrompt'),/强度高于基础角色设定/);
assert.match(functionSource('suspicionStrictPrompt'),/基础人设只能决定措辞、姿态与表达风格/);
assert.match(functionSource('suspicionRunEscalation'),/e\.forceLevel>=3\?'call'/);
assert.match(functionSource('suspicionPrompt'),/不要见到“朋友\/同事\/前任”就机械吃醋/);
assert.match(functionSource('suspicionStartDaily'),/决定是直接问、旁敲侧击还是表达担心\/不满/);
assert.match(functionSource('suspicionStartDaily'),/不能同时来电、登录微信、远控或索要多种证明/);
assert.match(functionSource('suspicionCheckDaily'),/lastSilenceMessageId/);
assert.match(functionSource('suspicionTick'),/这是同一件事最后一次跟进/);
assert.match(functionSource('suspicionRequestMessage'),/suspicionEventOpen\(st\.pendingHangup\)/);
assert.match(functionSource('maybeFollowup'),/suspicionPromiseCoversText/);
assert.match(source,/if\(got&&!_naturalOn\)suspicionOnAssistantReply\(c\)/);

const detailContext=vm.createContext({Date,Math,extremeLoveOn:()=>false});
for(const name of ['traitValue','suspicionNumber','suspicionPromiseDue','suspicionClaimFacts','suspicionDirectContradiction','suspicionSilenceDelay'])vm.runInContext(functionSource(name),detailContext);
const base=Date.parse('2026-07-29T10:00:00+08:00');
const tenMinutes=detailContext.suspicionPromiseDue('我十分钟后到家，到了给你报平安',base);
assert.equal(tenMinutes.kind,'arrival');
assert.equal(tenMinutes.due-base,10*60000);
const photoPromise=detailContext.suspicionPromiseDue('晚点我拍张照片发给你',base);
assert.equal(photoPromise.kind,'photo');
assert.equal(photoPromise.due-base,30*60000);
assert.equal(detailContext.suspicionPromiseDue('我现在到家了',base),null,'a completed action is not a future promise');
assert.equal(detailContext.suspicionSilenceDelay({traits:{suspicious:0}}),0,'disabled sensitivity must not trigger silence checks');
assert.ok(detailContext.suspicionSilenceDelay({traits:{suspicious:90}})<detailContext.suspicionSilenceDelay({traits:{suspicious:55}}),'higher sensitivity should notice silence sooner');
const first=detailContext.suspicionClaimFacts('我现在在公司')[0];first.ts=Date.now();
const moved=detailContext.suspicionClaimFacts('我刚到家')[0];
assert.equal(detailContext.suspicionDirectContradiction(first,moved,'我刚到家'),false,'a stated move is not a contradiction');
const conflict=detailContext.suspicionClaimFacts('我一直在家，没出门')[0];
assert.equal(detailContext.suspicionDirectContradiction(first,conflict,'我一直在家，没出门'),true,'an explicit continuity claim can contradict a recent location');

console.log('suspicion trait tests passed');
