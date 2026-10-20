import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {webcrypto} from 'node:crypto';
import {TextEncoder} from 'node:util';
const source = new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-sky-sync.js', import.meta.url);
const box = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(source,'utf8'),box);
const api=box.module.exports;
test('binding requires an exact account and role and rejects ambiguity',()=>{
 const state={me:{accounts:[{id:'main',name:'主号'},{id:'space',name:'虚空间'}]},contacts:[{id:'sir',name:'Claude',remark:'先生',_added:{space:true}}]};
 assert.equal(api.resolveBinding(state).accountId,'space');
 assert.equal(api.resolveBinding(state).roleId,'sir');
 state.contacts.push({id:'other',remark:'先生',_added:{space:true}});
 assert.throws(()=>api.resolveBinding(state),/唯一/);
});
test('only plain conversation is imported and transport metadata is not visible',()=>{
 const m=api.eventMessage({id:'event',role:'assistant',text:'刚才跑图好开心',at:1700000000000,session:'s'});
 assert.equal(m.content,'刚才跑图好开心');
 assert.equal(m.type,'text');
 assert.equal(m._skySource,'sky');
 assert.equal(api.eventMessage({id:'control',role:'system',text:'[系统标签]'}),null);
});
test('duplicate replay and account changes do not mutate another conversation',()=>{
 const rows=[],e={id:'same',role:'user',text:'先生',at:1700000000000};
 api.mergeEvents(rows,[e,e]);assert.equal(rows.length,1);
 api.mergeEvents(rows,[e]);assert.equal(rows.length,1);
 assert.equal(rows[0].content,'先生');
});
function runtime(changeAccount=false){
 const rows=[],calls=[],c={id:'sir',persona:'先生的人设'},cfg={enabled:true,accountId:'space',roleId:'sir',cursor:0,linkId:'link'};
 const S={me:{name:'North'},settings:{hist:3,skyRoleSync:cfg}},facts=[],summaries=[];
 let account='space',saved=0,intervals=0,remoteScene='sky';
 const ctx={S,Date,Math,JSON,Array,Set,Object,String,Number,AbortSignal:{timeout:()=>undefined},
  document:{hidden:false,addEventListener(){}},setInterval(){intervals++;},setTimeout(){},clearTimeout(){},crypto:webcrypto,TextEncoder,
  actId:()=>account,cloudId:()=> 'owner',companionHeaders:()=>({}),companionOwnerSecret:()=> 'test-owner',
  getC:()=>c,addedHere:()=>true,msgs:()=>rows,memoryList:()=>facts,summaryList:()=>summaries,
  rememberForChar:(_,t)=>facts.push({text:t}),fmtDT:x=>String(x),msgToText:m=>m.content,
  lastRounds:a=>a,friendMeta:()=>({}),onlineMemoryRecallLimits:()=>({memory:1,summary:1,total:2}),
  saveNowAsync:async()=>{saved++;return true;},
  fetch:async(url,init)=>{const req=JSON.parse(init.body);calls.push(req);
   if(req.p_action==='phone')remoteScene='phone';
   if(changeAccount)account='other';
   return {ok:true,json:async()=>({ok:true,scene:remoteScene,sceneVersion:4,
    cursor:1,events:req.p_packet?[]:[{seq:1,event:{id:'game-123456789012',role:'assistant',text:'刚才一起跑图了',at:1700000000000,session:'s'}}]})};}
 };ctx.window=ctx;ctx.__SMALL_PHONE_PRIVATE__=true;
 vm.runInNewContext(fs.readFileSync(source,'utf8'),ctx);
 return {api:ctx.NorthSkyRoleSync,c,rows,calls,saved:()=>saved,cfg,intervals:()=>intervals};
}
test('foreground sync imports plain game text without ending the session; phone reply does end it',async()=>{
 const rt=runtime();await rt.api.sync(false);
 assert.equal(rt.rows.length,1);assert.equal(rt.rows[0].content,'刚才一起跑图了');
 assert.deepEqual(rt.calls.map(x=>x.p_action),['sync','sync']);assert.equal(rt.calls[1].p_packet.contextRounds,3);
 assert.ok(rt.saved()>0);
 await rt.api.preparePhone(rt.c);assert(rt.calls.some(x=>x.p_action==='phone'));assert.equal(rt.cfg.scene,'phone');
 assert.equal(rt.rows.length,1);
 assert.match(rt.api.historyContent(rt.rows[0],rt.rows[0].content),/光遇游戏/);
 assert.equal(rt.rows[0].content,'刚才一起跑图了');
});
test('idle has no polling timer and unchanged snapshots make no cloud request',async()=>{
 const rt=runtime();assert.equal(rt.intervals(),0);assert.equal(rt.calls.length,0);
 await rt.api.sync(false);const count=rt.calls.length;
 assert.equal(await rt.api.publish(),false);assert.equal(rt.calls.length,count);
 rt.c.persona='修改后的人设';assert.equal(await rt.api.publish(),true);
 assert.equal(rt.calls.length,count+1);assert.equal(rt.calls.at(-1).p_action,'sync');
});
test('switching account while network is pending never imports into the new account',async()=>{
 const rt=runtime(true);await assert.rejects(rt.api.sync(false),/账号已变化/);
 assert.equal(rt.rows.length,0);assert.equal(rt.saved(),0);
});
test('real SQL enforces role credentials, deduplication, scene ordering and private tables',async()=>{
 const require=createRequire(import.meta.url),{PGlite}=require(path.join(os.homedir(),'AppData/Local/CodexHardwareTests/robot-voice-sql-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema extensions;
   create function phone_companion_hash(v text) returns text language sql immutable as $$select md5(v)$$;
   create function phone_companion_owner_ok(t text,s text) returns boolean language sql as $$select t='owner' and s='secret'$$;`);
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/202610200001_sky_role_sync.sql',import.meta.url),'utf8'));
  const owner=async(action,fields={})=>(await db.query(`select phone_sky_owner($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) r`,['owner','secret','space','sir',action,fields.packet?JSON.stringify(fields.packet):null,fields.after||0,fields.token||null,fields.version??null])).rows[0].r;
  const token='a'.repeat(64),packet={accountId:'space',roleId:'sir',contextRounds:2,persona:'先生',history:[],facts:[]};
  const bound=await owner('bind',{token,packet}),link=bound.linkId;
  const device=async(action,events=[],version=null,auth=token)=>(await db.query(`select phone_sky_device($1,$2,$3,$4,$5,$6::jsonb) r`,[link,auth,action,'session-1234567890',version,JSON.stringify(events)])).rows[0].r;
  await assert.rejects(device('pull',[],null,'wrong'),/unauthorized/);
  const start=await device('start',[],0);assert.equal(start.scene,'sky');
  await assert.rejects(owner('phone',{version:0}),/scene-changed/);
  const e={id:'event-123456789012',role:'user',source:'sky',text:'先生',session:'session-1234567890',at:1700000000000};
  await device('append',[e,e]);await device('append',[e]);
  const got=await owner('sync');assert.equal(got.events.length,1);assert.equal(got.events[0].event.text,'先生');
  assert.equal((await owner('sync',{after:got.cursor})).events.length,0);
  assert.equal((await owner('phone',{version:start.sceneVersion})).scene,'phone');
  await assert.rejects(device('start',[],start.sceneVersion),/scene-changed/);
  await assert.rejects(device('append',[{...e,id:'bad-event-12345678',role:'system'}]),/invalid-event/);
  await assert.rejects(owner('sync',{packet:{...packet,accountId:'other'}}),/binding-mismatch/);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from phone_sky_events'),/permission denied/);
 }finally{await db.close();}
});
