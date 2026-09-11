import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=src.includes('let _fullBackupExport')?src.indexOf('let _fullBackupExport'):src.indexOf('async function exportData(');
const code=src.slice(start,src.indexOf('function readJsonFile(',start));
function setup(prepare){
 const events=[],context=vm.createContext({Blob,Date,JSON,File,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:u=>events.push(['revoke',u])},
 fullBackupState:prepare,openModal:html=>events.push(['modal',html]),closeModal(){},toast:s=>events.push(['toast',s]),
 setTimeout,Promise,navigator:{},esc:s=>s,beautySaveFile:async()=>{events.push(['automatic-download']);return 'downloaded';}});
 vm.runInContext(code,context);return{context,events};
}
test('prepared full backup waits for an explicit save click and exposes a retryable download link',async()=>{
 const {context,events}=setup(async()=>({settings:{},messages:{x:[{content:'原文'}]}}));
 await vm.runInContext('exportData()',context);
 assert.ok(events.some(e=>e[0]==='modal'&&/download=/.test(e[1])&&/blob:fixture/.test(e[1])));
 assert.ok(!events.some(e=>e[0]==='automatic-download'));
 assert.ok(!events.some(e=>e[0]==='revoke'));
});
test('backup preparation failures are visible and a later attempt can succeed',async()=>{
 let fail=true;const {context,events}=setup(async()=>{if(fail)throw new Error('storage failed');return{settings:{}};});
 await vm.runInContext('exportData()',context);
 assert.ok(events.some(e=>e[0]==='modal'&&e[1].includes('storage failed')&&e[1].includes('重新生成')));
 fail=false;await vm.runInContext('exportData()',context);
 assert.ok(events.some(e=>e[0]==='modal'&&/download=/.test(e[1])));
});

test('repeated export clicks share one preparation and sharing cancellation preserves the download',async()=>{
 let calls=0,finish;const {context,events}=setup(()=>{calls++;return new Promise(r=>finish=r);});
 context.navigator={canShare:()=>true,share:()=>Promise.reject(Object.assign(new Error('cancel'),{name:'AbortError'}))};
 const first=vm.runInContext('exportData()',context);await new Promise(r=>setTimeout(r,10));
 await vm.runInContext('exportData()',context);assert.equal(calls,1);finish({settings:{}});await first;
 const before=vm.runInContext('_fullBackupExport.url',context);
 await vm.runInContext('shareFullBackupExport()',context);assert.equal(vm.runInContext('_fullBackupExport.url',context),before);
  assert.ok(events.some(e=>e[0]==='toast'&&e[1].includes('已取消')));
});

test('Huawei Edge gets an immediate preparing screen and an explicit TXT download route',async()=>{
  assert.match(code,/正在生成完整备份/);
  assert.match(code,/data-full-backup-preparing/);
  assert.match(code,/data-primary-backup-download/);
  assert.match(code,/application\/octet-stream/);
});

test('Android file sharing uses a widely shareable text file that import accepts',()=>{
  assert.match(code,/text\/plain/);
  assert.match(code,/\.txt/);
  assert.match(src,/pickFile\('\.json,\.txt,application\/json,text\/plain'/);
});
