import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const path='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const code=fs.readFileSync(path+'private-cloud-backup.js','utf8');
const old=fs.readFileSync(path+'app.js','utf8').split('\n').find(x=>x.startsWith('async function privatePhoneCloudBackup('));
function fixture(){
 const data={settings:{},contacts:[{id:'test'}],image:'data:image/png;base64,'+'A'.repeat(700000)},blob=new Blob([JSON.stringify(data)]),store=new Map(),calls=[],notices=[];let cloud=null,parts=[],offset=0,commits=0,fail=false;
 const c={Blob,Uint8Array,Date,Math,JSON,String,Number,Promise,btoa:x=>Buffer.from(x,'binary').toString('base64'),setInterval(){},setTimeout(){return 1;},clearTimeout(){},document:{hidden:false},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},__SMALL_PHONE_PRIVATE__:true,
 _privatePhoneAccount:{userId:'owner-a',loggedIn:true,loaded:true},_privatePhoneCloudBusy:false,_privatePhoneCloudDirtyAt:1,_privatePhoneCloudTimer:null,_privatePhoneLastInteractionAt:0,_bootImagesPromise:Promise.resolve(),APP_VER:'fixture',S:data,
 privatePhoneAccountAvailable:()=>true,privatePhoneAccountRefresh:async()=>{c._privatePhoneAccount.loaded=true;},northNativeMaintenancePaused:()=>false,replyGenerationStore:()=>({}),recoveryStateStats:()=>({}),recoveryStateMeaningful:()=>true,saveNowAsync:async()=>true,fullBackupFileBlob:async()=>blob,fullBackupState:async()=>data,cloudUrl:()=>'',cloudKey:()=>'',privatePrimaryMirrorUpload:async()=>({skipped:true}),toast:t=>notices.push(t),privatePhoneAccountSection:()=>'',
 privatePhoneAccountCall:async(action,payload={})=>{calls.push({action,bytes:JSON.stringify(payload).length});if(action==='account.backup.info')return {ok:true,found:!!cloud,backup:cloud};if(action==='account.backup.upload')throw new Error('bridge oversized payload');if(action.endsWith('.begin')){parts=[];offset=0;return {ok:true,token:'fixture'};}if(action.endsWith('.chunk')){if(fail)throw new Error('chunk failed');assert.equal(payload.offset,offset);const bytes=Buffer.from(payload.base64,'base64');assert(bytes.length<=192*1024);parts.push(bytes);offset+=bytes.length;return {ok:true};}if(action.endsWith('.commit')){commits++;assert.deepEqual(JSON.parse(Buffer.concat(parts).toString()),data);return {ok:true,saved:true};}return {ok:true};}};
 c.window=c;vm.createContext(c);vm.runInContext(code,c);return {c,calls,notices,store,get commits(){return commits;},setCloud(v){cloud=v;},fail(){fail=true;}};
}
test('old whole-object bridge fails while new backup sends bounded blocks and confirms one daily success',async()=>{
 const previous=fixture();vm.runInContext(old,previous.c);await previous.c.privatePhoneCloudBackup(false);assert(previous.notices.some(x=>x.includes('oversized')));assert.equal(previous.commits,0);
 const f=fixture();assert.equal(await f.c.privatePhoneCloudBackup(false),true);assert.equal(f.commits,1);assert(f.calls.filter(x=>x.action.endsWith('.chunk')).length>=4);assert(f.calls.every(x=>x.bytes<270000));assert.equal(await f.c.NorthPrivateCloudBackup.tick(),false);assert.equal(f.commits,1);
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
