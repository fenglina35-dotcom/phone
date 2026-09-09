import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const dir='native/private-small-phone/XcodeProject/PhoneCompanionTest/';
const app=read(dir+'PhoneWeb.bundle/app.js'),sync=read(dir+'CompanionSyncView.swift'),bridge=read(dir+'PhoneNativeBridge.swift'),content=read(dir+'ContentView.swift'),edge=read('supabase/functions/phone-role-push/index.ts');
const line=name=>app.split(/\r?\n/).find(x=>x.startsWith('function '+name+'('));
function edgeFn(name){const start=edge.indexOf('function '+name+'(');assert(start>=0,name);const end=edge.indexOf('\nfunction ',start+10);return stripTypeScriptTypes(edge.slice(start,end));}
test('private role and owner commands retain distinct explicit provenance',async()=>{
 const sent=[],ctx={S:{me:{name:'主人'},couple:{}},_companionNativeCommandLane:Promise.resolve(),companionScope:x=>x,companionLocalNativeAvailable:()=>true,companionNativeCommandRun:async command=>{sent.push(command);return {result:{message:'ok'}}},save(){},companionRefreshPanel(){},toast(){}};
 vm.createContext(ctx);vm.runInContext(line('companionSendCommand'),ctx);
 for(const by of ['role','owner',undefined]){ctx.companionSendCommand({commands:[]},'lock',{id:'ios.a',name:'软件'},{by,actor:by==='role'?'先生':'主人'},null);await new Promise(setImmediate);}
 assert.deepEqual(sent.map(x=>x.by),['role','owner','owner']);assert.equal(sent[0].actor,'先生');
});
test('native bridge preserves provenance; only role sources write names before shield application',()=>{
 assert.match(bridge,/let by = arguments\["by"\] as\? String/);assert.match(bridge,/actor: actor,\s*by: by,/);
 const local=sync.slice(sync.indexOf('func performLocalCommand('),sync.indexOf('func performLocalCommand(')+900);
 assert.match(local,/by: String\?/);assert.match(local,/actor: actor,\s*by: by/);
 assert.match(sync,/command\.by == "role-app-watch" \|\| command\.by == "role"/);
 assert.match(sync,/else if command\.by == "owner" \{\s*forgetRoleShieldActor/);
 assert.match(sync,/saveShieldRoleActors\(previousRoleActors\)/);
});
test('native batch produces one event; single unlock and empty no-op remain separate',()=>{
 assert.match(content,/recordExplicitManualUnlock\(\s*lockedAppTokens, batch: true/);
 assert.match(sync,/batch: Bool = false/);assert.match(sync,/guard !tokens\.isEmpty else \{ return \}/);
 assert.match(sync,/if batch \{/);assert.match(sync,/"source": "native-management-batch"/);
 assert.match(content,/recordExplicitManualUnlock\(\[token\]\)/);
});
test('batch survives snapshot merge without splitting or losing delivered status',()=>{
 const ctx={companionTime:Number,Date};vm.createContext(ctx);vm.runInContext(line('companionMergeAutomationEvents'),ctx);
 const event={id:'batch1',kind:'manualUnlock',explicit:true,source:'native-management-batch',appName:'本次批量解除的全部 App',ts:Date.now()};
 let rows=ctx.companionMergeAutomationEvents([], [event]);rows[0].delivered=true;rows=ctx.companionMergeAutomationEvents(rows,[event]);
 assert.equal(rows.length,1);assert.equal(rows[0].source,event.source);assert.equal(rows[0].delivered,true);
});
test('private local batch prompt asks for one natural response without enumerating apps',()=>{
 const ctx={S:{me:{name:'我'}},companionAutomationCandidateCore:()=>null,companionAutomationNote:(_k,b)=>b};vm.createContext(ctx);
 vm.runInContext(app.split(/\r?\n/).find(x=>x.startsWith('companionAutomationCandidate=function')),ctx);
 const event={id:'b1',kind:'manualUnlock',explicit:true,source:'native-management-batch',appName:'本次批量解除的全部 App',ts:Date.now()};
 const candidate=ctx.companionAutomationCandidate({}, {automationRuns:{},automationEvents:[event],automations:{manualUnlockAlert:true},permissions:{appControl:true}},Date.now());
 assert.match(candidate.note,/本次批量解锁/);assert.match(candidate.note,/只回应一次/);assert.match(candidate.note,/不要逐个/);
});
test('server batch facts suppress app list; nonbatch facts are unchanged',()=>{
 const ctx={publicNorthCloud:()=>false,snapshotTime:Number};vm.createContext(ctx);vm.runInContext(edgeFn('snapshotAutomationFacts'),ctx);
 const event={id:'b1',kind:'manualUnlock',explicit:true,source:'native-management-batch',appName:'QQ、百度',ts:Date.now()};
 const facts=ctx.snapshotAutomationFacts({automationEvents:[event]},'manualUnlock',{});
 assert.match(facts,/本次批量解锁/);assert.match(facts,/只回应一次/);assert.doesNotMatch(facts,/QQ|百度/);
 assert.match(ctx.snapshotAutomationFacts({automationEvents:[{...event,source:'native-management',appName:'QQ'}]},'manualUnlock',{}),/手动解锁了QQ/);
});
test('failed batch model generation does not fabricate a role reply',()=>{
 const ctx={roleManualUnlockFallback:()=> '旧的单项回退'};vm.createContext(ctx);vm.runInContext(edgeFn('roleManualUnlockFailureResult'),ctx);
 assert.equal(ctx.roleManualUnlockFailureResult('本次批量解锁',[]).kind,'unavailable');
 assert.equal(ctx.roleManualUnlockFailureResult('手动解锁了QQ',[]).body,'旧的单项回退');
});
const workerJS=stripTypeScriptTypes(edge.slice(0,edge.indexOf('Deno.serve(')).replace(/^import .*;\r?$/gm,''));
function worker(raw,on,{noProvider=false,httpError=false}={}){
 const requests=[],ctx={console,URL,Date,Intl,AbortController,setTimeout,clearTimeout,Deno:{env:{get:()=>''}},fetch:async(_url,opt)=>{requests.push(JSON.parse(opt.body));return {ok:!httpError,status:502,text:async()=>'',json:async()=>({choices:[{message:{content:raw}}]})};}};
 vm.createContext(ctx);vm.runInContext(workerJS,ctx);
 const profile={role_name:'先生',user_name:'我',message_min:3,message_max:5,automation_config:{flags:{manualUnlockAlert:true},permissions:{appControl:true},modelOutputUnfiltered:on,modelRoute:noProvider?{}:{base:'https://model.example.test/v1',key:'fixture',model:'fixture'}}};
 return {ctx,profile,requests};
}
for(const on of [false,true])test(`batch backend generates once and consumes one event raw=${on}`,async()=>{
 const w=worker('这次都解开了，下次先跟我说一声。',on),event={id:'batch-real',kind:'manualUnlock',explicit:true,source:'native-management-batch',appName:'本次批量解除的全部 App',ts:Date.now()},snapshot={generatedAt:new Date().toISOString(),automationEvents:[event]};
 const candidate=w.ctx.automationCandidate(w.profile,snapshot);assert.equal(candidate.key,'manualUnlock:batch-real');
 const result=await w.ctx.roleMessage(w.profile,[],'当前聊天对象本人亲自成功解锁App',candidate.facts,false);
 assert.equal(result.kind,'message');assert.equal(result.body,'这次都解开了，下次先跟我说一声。');assert.equal(w.requests.length,1);
 assert.match(w.requests[0].messages.at(-1).content,/只回应一次/);
 w.profile.automation_state={runs:{[candidate.key]:Date.now()}};assert.equal(w.ctx.automationCandidate(w.profile,snapshot),null);
});
test('batch backend unavailable cases never insert fixed role text',async()=>{
 for(const config of [{noProvider:true},{httpError:true},{}]){
  const w=worker('',false,config),result=await w.ctx.roleMessage(w.profile,[],'本人亲自成功解锁App','本次批量解锁',false);
  assert.equal(result.kind,'unavailable');assert.equal(result.body,'');assert(w.requests.length<=1);
 }
});
test('local failed batch does not use single-app fallback and successful model text is preserved',()=>{
 const ctx={manualUnlockReplyNeedsRepair:()=> 'repeat',manualUnlockReplyFallback:()=>{throw new Error('must not fabricate');}};vm.createContext(ctx);vm.runInContext(line('manualUnlockReplyGuard'),ctx);
 assert.throws(()=>ctx.manualUnlockReplyGuard('c','main','本次批量解锁','',{}),/模型未生成有效回复/);
 ctx.manualUnlockReplyNeedsRepair=()=>'';assert.equal(ctx.manualUnlockReplyGuard('c','main','本次批量解锁','你一下全解开了呀。',{}).content,'你一下全解开了呀。');
});
