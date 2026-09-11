import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=src.indexOf('let _fullBackupExport');
const code=src.slice(start>=0?start:src.indexOf('async function exportData('),src.indexOf('async function readJsonFile(',start));

function setup(prepare,save){
  const events=[];
  const context=vm.createContext({
    Blob,Date,JSON,Promise,setTimeout,File,
    fullBackupFileBlob:async()=>new Blob([JSON.stringify(await prepare())],{type:'application/json'}),
    toast:s=>events.push(['toast',s]),
    openModal:html=>events.push(['modal',html]),closeModal(){},esc:s=>s,navigator:{},
    URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:u=>events.push(['revoke',u])},
    beautySaveFile:save||((blob,name)=>{events.push(['save',blob,name]);return Promise.resolve('downloaded');})
  });
  vm.runInContext(code,context);
  return {context,events};
}

test('one complete-backup click immediately uses the proven JSON save path',async()=>{
  const {context,events}=setup(async()=>({settings:{backupFixture:'原文'},messages:{x:[{content:'完整保留'}]}}));
  await vm.runInContext('exportData()',context);
  const saved=events.find(e=>e[0]==='save');
  assert.ok(saved,'exportData must save automatically instead of requiring a second modal click');
  assert.match(saved[2],/^North备份_\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(saved[1].type,'application/json');
  assert.deepEqual(JSON.parse(await saved[1].text()),{settings:{backupFixture:'原文'},messages:{x:[{content:'完整保留'}]}});
  assert.ok(events.some(e=>e[0]==='toast'&&e[1]==='已导出'));
});

test('repeated taps do not start two large backup preparations',async()=>{
  let calls=0,finish;
  const {context,events}=setup(()=>{calls++;return new Promise(resolve=>{finish=resolve;});});
  const first=vm.runInContext('exportData()',context);
  await new Promise(resolve=>setTimeout(resolve,10));
  await vm.runInContext('exportData()',context);
  assert.equal(calls,1);
  assert.ok(events.some(e=>e[0]==='toast'&&e[1].includes('正在生成')));
  finish({settings:{}});
  await first;
  assert.equal(events.filter(e=>e[0]==='save').length,1);
});

test('backup failures are visible and a later click can retry',async()=>{
  let fail=true;
  const {context,events}=setup(async()=>{if(fail)throw new Error('storage failed');return{settings:{}};});
  await vm.runInContext('exportData()',context);
  assert.ok(events.some(e=>e[0]==='toast'&&e[1].includes('storage failed')));
  fail=false;
  await vm.runInContext('exportData()',context);
  assert.equal(events.filter(e=>e[0]==='save').length,1);
});

test('imports still accept the temporary TXT fallback files produced by v1234',()=>{
  assert.match(src,/pickFile\('\.json,\.txt,application\/json,text\/plain'/);
});
