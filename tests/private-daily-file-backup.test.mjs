import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const path='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const code=fs.readFileSync(path+'private-cloud-backup.js','utf8');
const old=fs.readFileSync(path+'app.js','utf8').split('\n').find(x=>x.startsWith('async function privatePhoneCloudBackup('));
function fixture(source=code,opt={}){
 const data={settings:{},contacts:[{id:'test'}],image:'data:image/png;base64,'+'A'.repeat(700000)},blob=new Blob([JSON.stringify(data)]),store=new Map(),calls=[],notices=[];let cloud=null,parts=[],offset=0,commits=0,fullStateCalls=0,mirrorUploads=0,progressPolls=0,fail=false;
 const c={Blob,Uint8Array,Date,Math,JSON,String,Number,Promise,btoa:x=>Buffer.from(x,'binary').toString('base64'),setInterval(){},setTimeout:opt.realTimers?setTimeout:function(){return 1;},clearTimeout(){},document:{hidden:false},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},__SMALL_PHONE_PRIVATE__:true,
 _privatePhoneAccount:{userId:'owner-a',loggedIn:true,loaded:true},_privatePhoneCloudBusy:false,_privatePhoneCloudDirtyAt:1,_privatePhoneCloudTimer:null,_privatePhoneLastInteractionAt:0,_bootImagesPromise:Promise.resolve(),APP_VER:'fixture',S:data,
 privatePhoneAccountAvailable:()=>true,privatePhoneAccountRefresh:async()=>{c._privatePhoneAccount.loaded=true;},northNativeMaintenancePaused:()=>false,replyGenerationStore:()=>({}),recoveryStateStats:()=>({}),recoveryStateMeaningful:()=>true,saveNowAsync:async()=>true,fullBackupFileBlob:async()=>blob,fullBackupState:async()=>{fullStateCalls++;return data;},cloudUrl:()=>opt.webMirror?'https://cloud.example':'',cloudKey:()=>opt.webMirror?'key':'',privatePrimaryMirrorUpload:async()=>{mirrorUploads++;return {uploaded:true};},toast:t=>notices.push(t),privatePhoneAccountSection:()=>'',
 privatePhoneAccountCall:async(action,payload={},timeoutMs)=>{calls.push({action,bytes:JSON.stringify(payload).length,timeoutMs});if(action==='account.backup.info')return {ok:true,found:!!cloud,backup:cloud};if(action==='account.backup.upload')throw new Error('bridge oversized payload');if(action.endsWith('.begin')){parts=[];offset=0;return {ok:true,token:'fixture'};}if(action.endsWith('.chunk')){if(fail)throw new Error('chunk failed');assert.equal(payload.offset,offset);const bytes=Buffer.from(payload.base64,'base64');assert(bytes.length<=192*1024);parts.push(bytes);offset+=bytes.length;return {ok:true};}if(action.endsWith('.progress')){progressPolls++;return {ok:true,sentBytes:50,expectedBytes:100};}if(action.endsWith('.commit')){if(opt.slowCommit)await new Promise(resolve=>setTimeout(resolve,8));if(opt.requireCommitTimeout&&!(timeoutMs>=660000))throw new Error('outer web timeout expired before native upload');commits++;assert.deepEqual(JSON.parse(Buffer.concat(parts).toString()),data);return {ok:true,saved:true};}return {ok:true};}};
 c.window=c;vm.createContext(c);vm.runInContext(source,c);return {c,calls,notices,store,get commits(){return commits;},get fullStateCalls(){return fullStateCalls;},get mirrorUploads(){return mirrorUploads;},get progressPolls(){return progressPolls;},setCloud(v){cloud=v;},fail(){fail=true;}};
}
test('regression: the old 120-second wrapper loses a slow commit while the fixed wrapper waits for native upload',async()=>{
 const oldCode=code.replace("account.backup.file.commit',{token},720000","account.backup.file.commit',{token}");
 assert.notEqual(oldCode,code);
 const old=fixture(oldCode,{requireCommitTimeout:true});assert.equal(await old.c.privatePhoneCloudBackup(false),false);assert.equal(old.commits,0);assert(old.notices.some(x=>x.includes('outer web timeout')));
 const fixed=fixture(code,{requireCommitTimeout:true});assert.equal(await fixed.c.privatePhoneCloudBackup(false),true);assert.equal(fixed.commits,1);
});
test('old whole-object bridge fails while new backup sends bounded blocks and confirms one daily success',async()=>{
 const previous=fixture();vm.runInContext(old,previous.c);await previous.c.privatePhoneCloudBackup(false);assert(previous.notices.some(x=>x.includes('oversized')));assert.equal(previous.commits,0);
 const f=fixture();assert.equal(await f.c.privatePhoneCloudBackup(false),true);assert.equal(f.commits,1);assert(f.calls.filter(x=>x.action.endsWith('.chunk')).length>=4);assert(f.calls.every(x=>x.bytes<270000));assert.equal(await f.c.NorthPrivateCloudBackup.tick(),false);assert.equal(f.commits,1);
 const commit=f.calls.find(x=>x.action==='account.backup.file.commit');assert(commit.timeoutMs>=660000,'the web timeout must not expire before the native upload timeout');
});

test('native upload stays visible with real cloud-byte percentage until commit settles',async()=>{
 const progressCode=code.replace('wait(900)','wait(1)');
 const f=fixture(progressCode,{slowCommit:true,realTimers:true});
 assert.equal(await f.c.privatePhoneCloudBackup(false),true);
 assert(f.progressPolls>0);
 assert(f.notices.some(x=>x.includes('正在上传私人云备份 50%')));
});
test('chunk failure aborts staging and never marks a daily backup successful',async()=>{
 const f=fixture();f.fail();assert.equal(await f.c.privatePhoneCloudBackup(false),false);assert.equal(f.commits,0);assert(f.calls.some(x=>x.action.endsWith('.abort')));assert.equal(f.c.NorthPrivateCloudBackup.status().lastSuccess,0);assert.equal(f.c._privatePhoneCloudBusy,false);
});
test('automatic task does not overwrite an unconfirmed cloud or run while hidden',async()=>{
 const f=fixture();f.setCloud({captured_at:new Date().toISOString()});assert.equal(await f.c.NorthPrivateCloudBackup.tick(),false);assert.equal(f.commits,0);assert.equal(f.c.NorthPrivateCloudBackup.status().phase,'await-owner-confirmation');
 const hidden=fixture();hidden.c.document.hidden=true;await hidden.c.NorthPrivateCloudBackup.tick();assert.equal(hidden.calls.length,0);
});
test('another device update blocks automatic backup even after local source confirmation',async()=>{
 const f=fixture();f.store.set('north-private-daily-backup:owner-a',JSON.stringify({allowed:true,lastDay:'yesterday',capturedAt:100}));f.setCloud({captured_at:new Date(200).toISOString()});await f.c.NorthPrivateCloudBackup.tick();assert.equal(f.commits,0);assert.equal(f.c.NorthPrivateCloudBackup.status().phase,'await-owner-confirmation');
});
test('manual phone-account backup finishes after one file upload even when web mirror is configured',async()=>{
 const f=fixture(code,{webMirror:true});assert.equal(await f.c.privatePhoneCloudBackup(false),true);assert.equal(f.commits,1);assert.equal(f.fullStateCalls,0);assert.equal(f.mirrorUploads,0);assert.match(f.c.NorthPrivateCloudBackup.status().detail,/今日自动备份已完成/);
});
