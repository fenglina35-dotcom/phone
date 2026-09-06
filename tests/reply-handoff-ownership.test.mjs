import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const files=['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'];
function runtime(file){
 const src=fs.readFileSync(file,'utf8'),a=src.indexOf('const _replyHandoffClaims='),b=src.indexOf('const _roleBackgroundPending=',a),rows=[{id:'u1',role:'user',type:'text',content:'同一句话'}],alt=[{id:'u1',role:'user',type:'text',content:'小号的话'}];
 const ctx={msgsForAccount:(_id,aid)=>aid==='alt'?alt:rows,msgToText:m=>m.content||'',replyPendingUserText:()=> '同一句话',featureEventNoteActive:n=>n==='feature',initiativeNoteActive:n=>n==='initiative'};
 vm.createContext(ctx);vm.runInContext(src.slice(a,b),ctx);return{ctx,rows,alt,local:()=>ctx.replyHandoffBegin('r',null,1,'main','user'),remote:(extra={})=>ctx.replyHandoffIncoming({id:'r'},{id:'o1',triggerKind:'reply_handoff',replyToMessageId:'u1',replyToAccountId:'main',...extra})};
}
for(const file of files){
 test(file+' background result wins before the local model returns',async()=>{const {ctx,local,remote}=runtime(file),l=local(),r=remote();assert.equal(ctx.replyHandoffClaimIncoming(r),'accept');ctx.replyHandoffMark(r);ctx.replyHandoffRelease(r);assert.equal(await ctx.replyHandoffClaimLocal(l),false);});
 test(file+' local completion excludes a rewritten remote answer by source ID',async()=>{const {ctx,rows,local,remote}=runtime(file),l=local();assert.equal(await ctx.replyHandoffClaimLocal(l),true);assert.equal(ctx.replyHandoffClaimIncoming(remote()),'defer');ctx.replyHandoffPush(l,rows,{role:'assistant',type:'text',content:'新的措辞'});assert.equal(ctx.replyHandoffMarkLocal(l),true);ctx.replyHandoffRelease(l);assert.equal(ctx.replyHandoffClaimIncoming(remote()),'completed');});
 test(file+' failed or empty local output releases the turn for recovery',async()=>{const {ctx,local,remote}=runtime(file),l=local();await ctx.replyHandoffClaimLocal(l);assert.equal(ctx.replyHandoffMarkLocal(l),false);ctx.replyHandoffRelease(l);assert.equal(ctx.replyHandoffClaimIncoming(remote()),'accept');});
 test(file+' a local candidate waits for an incoming save and can resume if it produced nothing',async()=>{const {ctx,local,remote}=runtime(file),r=remote();ctx.replyHandoffClaimIncoming(r);let finished=false;const waiting=ctx.replyHandoffClaimLocal(local()).then(x=>(finished=true,x));await Promise.resolve();assert.equal(finished,false);ctx.replyHandoffRelease(r);assert.equal(await waiting,true);});
 test(file+' current-turn ownership does not cancel another user message or account',async()=>{const {ctx,rows,local,remote}=runtime(file),l=local(),r=remote();ctx.replyHandoffClaimIncoming(r);ctx.replyHandoffMark(r);ctx.replyHandoffRelease(r);rows.push({id:'u2',role:'user',type:'text',content:'同一句话'});assert.equal(await ctx.replyHandoffClaimLocal(local()),true);assert.equal(await ctx.replyHandoffClaimLocal(l),false);assert.equal(ctx.replyHandoffBegin('r',null,1,'alt','user'),null);assert.equal(remote({replyToAccountId:'alt'}),null);});
 test(file+' scheduled/device/legacy messages never claim an unanswered user turn',()=>{const {ctx,remote}=runtime(file);for(const kind of ['scheduled','device_handoff','app_followup','one_minute_test'])assert.equal(remote({triggerKind:kind}),null);assert.equal(remote({replyToMessageId:''}),null);assert.equal(remote({replyToMessageId:'missing'}),null);assert.equal(ctx.replyHandoffBegin('r','feature',1,'main','user'),null);assert.equal(ctx.replyHandoffBegin('r','initiative',1,'main','user'),null);});
 test(file+' repeated pulling of the same staged remote row remains retryable',()=>{const {ctx,remote}=runtime(file),r=remote();ctx.replyHandoffClaimIncoming(r);ctx.replyHandoffMark(r);ctx.replyHandoffRelease(r);assert.equal(ctx.replyHandoffClaimIncoming(remote()),'accept');});
}
test('metadata joins only the authenticated target and role on the exact persisted task key',()=>{const sql=fs.readFileSync('supabase/migrations/202609060001_reply_handoff_source_identity.sql','utf8');assert.match(sql,/phone_companion_owner_ok/);assert.match(sql,/x\.dedupe_key = 'task:' \|\| t\.id::text/);assert.match(sql,/t\.target = x\.target and t\.role_id = x\.role_id/);assert.match(sql,/'replyToMessageId'/);assert.doesNotMatch(sql,/drop table|delete from/i);assert.match(sql,/payload->>'messageId' = p_message_id/);});

test('a persisted completion still blocks a second outbox after a full runtime restart',async()=>{
 for(const file of files){const first=runtime(file),turn=first.local();await first.ctx.replyHandoffClaimLocal(turn);first.ctx.replyHandoffPush(turn,first.rows,{role:'assistant',type:'text',content:'已经答完'});first.ctx.replyHandoffMarkLocal(turn);first.ctx.replyHandoffRelease(turn);const restored=runtime(file);restored.rows.splice(0,restored.rows.length,...JSON.parse(JSON.stringify(first.rows)));assert.equal(restored.ctx.replyHandoffClaimIncoming(restored.remote()),'completed');}
});

test('finishing an old user turn preserves the newer local queue and cancels only its exact remote task',async()=>{
 const {ctx,local}=runtime('app.js');ctx.companionRpc=async(name,args)=>{assert.equal(name,'phone_role_background_complete_turn');assert.equal(args.p_message_id,'u1');return true;};ctx.cloudId=()=> 'target';ctx.companionOwnerSecret=()=> 'test-owner';vm.runInContext("const _roleBackgroundPending={r:{kind:'reply_handoff',payload:{messageId:'u2'}}};this.pending=_roleBackgroundPending;",ctx);await ctx.replyHandoffCancelRemote(local());assert.equal(ctx.pending.r.payload.messageId,'u2');
});

test('queued old replies are skipped after exact completion while intentional continuation stays available',()=>{
 const {ctx,rows,remote}=runtime('app.js');const job={id:'r',aid:'main',handoffMessageId:ctx.replyHandoffQueuedSource('r','main')};const r=remote();ctx.replyHandoffClaimIncoming(r);ctx.replyHandoffMark(r);ctx.replyHandoffRelease(r);ctx.replyPendingUserText=()=>'';assert.equal(ctx.replyHandoffQueuedDone(job),true);assert.equal(ctx.replyHandoffQueuedDone({...job,handoffMessageId:'new-user'}),false);assert.equal(ctx.replyHandoffQueuedDone({...job,handoffMessageId:''}),false);assert.equal(ctx.replyHandoffBegin('r','please continue',2,'main','user'),null);assert.equal(ctx.replyHandoffBegin('r',null,1,'main','user').source,rows[0]);
});
