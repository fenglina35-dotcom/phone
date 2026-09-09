import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/',import.meta.url);
const app=fs.readFileSync(new URL('PhoneWeb.bundle/app.js',base),'utf8');
const wellness=fs.readFileSync(new URL('CompanionWellnessService.swift',base),'utf8');
const sync=fs.readFileSync(new URL('CompanionSyncView.swift',base),'utf8');
function harness(){
 const calls=[],st={};
 const ctx={S:{couple:{}},_couTab:1,_companionPollBusy:false,_companionPollAt:0,_companionPanelHealthPending:false,
 Date,document:{hidden:false},northNativeMaintenancePaused:()=>false,companionLocalNativeAvailable:()=>true,
 companionState:()=>st,companionSnapshotPersistSignature:()=>'',companionNativeSnapshot:async focus=>{calls.push(focus);return st;},$:()=>null};
 vm.createContext(ctx);
 for(const name of ['companionPollMinDelay','companionPollSnapshot','couTab']){
  const line=app.split(/\r?\n/).find(x=>x.startsWith('function '+name+'(')||x.startsWith('async function '+name+'('));vm.runInContext(line,ctx);
 }
 ctx.cur=()=>({p:'couple'});
 return {ctx,calls};
}
test('entering private companion requests passive health once, ordinary polls stay light',async()=>{
 const {ctx,calls}=harness();ctx.couTab(3);await new Promise(setImmediate);
 assert.deepEqual(calls,['伴生健康刷新']);ctx._companionPollAt=0;await ctx.companionPollSnapshot(false);
 assert.deepEqual(calls,['伴生健康刷新','状态']);
});
test('enter while a poll is busy retains health refresh for next poll',async()=>{
 const {ctx,calls}=harness();ctx._companionPollBusy=true;ctx.couTab(3);await new Promise(setImmediate);assert.equal(calls.length,0);
 ctx._companionPollBusy=false;await ctx.companionPollSnapshot(false);assert.deepEqual(calls,['伴生健康刷新']);
});
test('leaving companion before pending refresh does not start health work in chat',async()=>{
 const {ctx,calls}=harness();ctx._companionPollBusy=true;ctx.couTab(3);ctx.couTab(1);ctx._companionPollBusy=false;
 await ctx.companionPollSnapshot(false);assert.deepEqual(calls,['状态']);
});
test('battery snapshot explicitly reads current UIDevice value before publishing timestamp',()=>{
 const source=wellness.slice(wellness.indexOf('func deviceSnapshot()'),wellness.indexOf('private func refreshBattery()'));
 assert.match(source,/refreshBattery\(\)/);assert(source.indexOf('refreshBattery()')<source.indexOf('Self.iso8601(Date())'));
 assert.match(wellness,/Int\(\(level \* 100\)\.rounded\(\)\)/);
});
test('passive panel health respects native authorization and sixty second throttle',()=>{
 assert.match(sync,/let passiveHealthRefresh = focus == "伴生健康刷新"/);
 assert.match(sync,/!passiveHealthRefresh \|\| wellnessService.healthSyncEnabled/);
 assert.match(sync,/forceHealth: !passiveHealthRefresh/);
 assert.match(wellness,/if !force,[\s\S]{0,100}< 60/);
 assert.match(sync,/if wantsHealth, !wellnessReadCompleted, !passiveHealthRefresh/);
 assert.match(sync,/wellnessReadCompleted && healthWasRead/);
 assert.match(sync,/if wantsHealth \{\s*wellnessReadCompleted = await refreshWellnessWithTimeout/);
});
