import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const webHTML=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const privateHTML=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',import.meta.url),'utf8');
const privateIndex=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html',import.meta.url),'utf8');

test('supported web browsers refresh battery on resume without duplicate listeners',async()=>{
  const start=source.indexOf('function paintBatt()');
  const end=source.indexOf('function hydrateStoredImageNodes()',start);
  assert.ok(start>=0&&end>start);
  const listeners={};
  let gets=0,saves=0;
  const battery={level:.26,charging:false,addEventListener(name,fn){(listeners[name]||=[]).push(fn);},removeEventListener(){}};
  const sandbox={S:{me:{}},Promise,Math,Date,navigator:{getBattery:async()=>{gets++;return battery;}},document:{hidden:false,addEventListener(){}},window:{addEventListener(){}},$:()=>null,save:()=>{saves++;}};
  vm.runInNewContext(source.slice(start,end)+';globalThis.run=async()=>{await initBattery();await initBattery();await initBattery(true);return webBatteryFactText();};',sandbox);
  const fact=await sandbox.run();
  assert.equal(sandbox.S.me.battery,26);
  assert.equal(sandbox.S.me.charging,false);
  assert.equal(gets,2,'normal refresh reuses the manager while a resume refresh reacquires it');
  assert.equal(listeners.levelchange.length,1);
  assert.equal(listeners.chargingchange.length,1);
  assert.equal(saves,1,'unchanged foreground refresh must not rewrite storage');
  assert.equal(sandbox.S.me.webBatterySource,'browser');
  assert.ok(sandbox.S.me.webBatteryAt>0);
  assert.match(fact,/当前网页设备真实电量 26%/);
});

test('unsupported browsers keep the last real value and never invent 88 percent',()=>{
  assert.doesNotMatch(source,/S\.me\.battery!=null\?S\.me\.battery\+'%':'88%'/);
  assert.match(source,/typeof navigator\.getBattery!=='function'/);
  assert.match(source,/window\.addEventListener\('pageshow',webBatteryResume/);
  assert.match(source,/window\.addEventListener\('focus',webBatteryResume/);
  assert.match(source,/visibilitychange.*webBatteryResume/s);
  const start=source.indexOf('function paintBatt()');
  const end=source.indexOf('function hydrateStoredImageNodes()',start);
  const sandbox={S:{me:{battery:26,charging:false,webBatterySource:'browser',webBatteryAt:Date.now()}},Promise,Math,Date,navigator:{},document:{hidden:false,addEventListener(){}},window:{addEventListener(){}},$:()=>null,save(){}};
  vm.runInNewContext(source.slice(start,end)+';globalThis.fact=webBatteryFactText();',sandbox);
  assert.equal(sandbox.fact,'','unsupported browsers must not present an old stored value as live battery');
});

test('web shell does not inject a duplicate simulated status bar',()=>{
  for(const [name,html] of [['web',webHTML],['private bundle',privateHTML],['private index',privateIndex]]){
    assert.doesNotMatch(html,/id="statusbar"/i,`${name}: duplicate status bar regression`);
    assert.doesNotMatch(html,/id="battinfo"/i,`${name}: duplicate battery strip regression`);
    assert.doesNotMatch(html,/📶\s*5G/i,`${name}: simulated network text regression`);
  }
});

test('role battery inspection uses fresh web facts without pulling the external iPhone',()=>{
  assert.match(source,/function companionRoleExternalFocus\(focus\)\{if\(!privateNativeAppOn\(\)\)return false/);
  assert.match(source,/label:'当前网页设备电量'/);
  assert.match(source,/不能用主屏手动显示值冒充系统电量/);
  assert.match(source,/const liveBattery=webBatteryFactText\(\)/);
});
