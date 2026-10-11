import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
 const src=fs.readFileSync(file,'utf8');
 const pick=name=>src.match(new RegExp('function '+name+'\\([^\\n]+(?:\\n(?!function |async function |const |let )[^\\n]*)*'))[0];
 function harness(){
  const messages=[{id:'u1',role:'user',type:'text',content:'你在干嘛'}],sent=[];
  const ctx={_roleBackgroundPending:{},_replyTimers:{},busy:false,messages,sent,
   roleBackgroundAvailable:()=>true,msgsForAccount:()=>messages,replyStateKey:id=>'main:'+id,
   replyGenerationBusy:()=>ctx.busy,roleBackgroundEnqueue:(id,kind,payload)=>sent.push([id,kind,payload.messageId])};
  vm.createContext(ctx);vm.runInContext(pick('roleBackgroundFlush')+'\n'+pick('roleBackgroundShouldHandOff'),ctx);
  ctx._roleBackgroundPending.c={kind:'reply_handoff',payload:{messageId:'u1',accountId:'main'},baseline:1};
  return ctx;
 }
 test(file+' v1714 going to the background never makes the server answer a turn the phone was not answering',()=>{
  const t=harness();t.roleBackgroundFlush();t.roleBackgroundFlush();assert.equal(t.sent.length,0,'停在前台没回、退后台也不接力');
 });
 test(file+' v1714 an in-progress reply is handed over once, not again on every background switch',()=>{
  const t=harness();t._replyTimers['main:c']=1;t.roleBackgroundFlush();t.roleBackgroundFlush();t.roleBackgroundFlush();
  assert.deepEqual(t.sent.map(x=>x[2]),['u1'],'同一条消息只交给服务器一次');
 });
 test(file+' v1714 once the message has been answered the pending relay is dropped',()=>{
  const t=harness();t.busy=true;t.messages[0]._replyHandoffCompleted={owner:'server'};t.roleBackgroundFlush();
  assert.equal(t.sent.length,0);assert.equal(t._roleBackgroundPending.c,undefined);
 });
}
