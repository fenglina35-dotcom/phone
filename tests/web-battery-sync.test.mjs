import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('supported web browsers refresh battery on resume without duplicate listeners',async()=>{
  const start=source.indexOf('function paintBatt()');
  const end=source.indexOf('function hydrateStoredImageNodes()',start);
  assert.ok(start>=0&&end>start);
  const listeners={};
  let gets=0,saves=0;
  const battery={level:.26,charging:false,addEventListener(name,fn){(listeners[name]||=[]).push(fn);},removeEventListener(){}};
  const sandbox={S:{me:{}},Promise,Math,navigator:{getBattery:async()=>{gets++;return battery;}},document:{hidden:false,addEventListener(){}},window:{addEventListener(){}},$:()=>null,save:()=>{saves++;}};
  vm.runInNewContext(source.slice(start,end)+';globalThis.run=async()=>{await initBattery();await initBattery();await initBattery(true);};',sandbox);
  await sandbox.run();
  assert.equal(sandbox.S.me.battery,26);
  assert.equal(sandbox.S.me.charging,false);
  assert.equal(gets,2,'normal refresh reuses the manager while a resume refresh reacquires it');
  assert.equal(listeners.levelchange.length,1);
  assert.equal(listeners.chargingchange.length,1);
  assert.equal(saves,1,'unchanged foreground refresh must not rewrite storage');
});

test('unsupported browsers keep the last real value and never invent 88 percent',()=>{
  assert.doesNotMatch(source,/S\.me\.battery!=null\?S\.me\.battery\+'%':'88%'/);
  assert.match(source,/typeof navigator\.getBattery!=='function'/);
  assert.match(source,/window\.addEventListener\('pageshow',webBatteryResume/);
  assert.match(source,/window\.addEventListener\('focus',webBatteryResume/);
  assert.match(source,/visibilitychange.*webBatteryResume/s);
});
