import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const webHTML=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const privateHTML=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',import.meta.url),'utf8');
const privateGlass=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/glass-theme.css',import.meta.url),'utf8');

test('supported web browsers refresh battery on resume without duplicate listeners',async()=>{
  const start=source.indexOf('function paintBatt()');
  const end=source.indexOf('function hydrateStoredImageNodes()',start);
  assert.ok(start>=0&&end>start);
  const listeners={};
  let gets=0,saves=0;
  const status={textContent:'',title:''};
  const battery={level:.26,charging:false,addEventListener(name,fn){(listeners[name]||=[]).push(fn);},removeEventListener(){}};
  const sandbox={S:{me:{}},Promise,Math,navigator:{getBattery:async()=>{gets++;return battery;}},document:{hidden:false,addEventListener(){}},window:{addEventListener(){}},$:sel=>sel==='#battinfo'?status:null,save:()=>{saves++;}};
  vm.runInNewContext(source.slice(start,end)+';globalThis.run=async()=>{await initBattery();await initBattery();await initBattery(true);};',sandbox);
  await sandbox.run();
  assert.equal(sandbox.S.me.battery,26);
  assert.equal(sandbox.S.me.charging,false);
  assert.equal(gets,2,'normal refresh reuses the manager while a resume refresh reacquires it');
  assert.equal(listeners.levelchange.length,1);
  assert.equal(listeners.chargingchange.length,1);
  assert.equal(saves,1,'unchanged foreground refresh must not rewrite storage');
  assert.match(status.textContent,/26%/,'a supported browser shows the refreshed value in the web status bar');
});

test('unsupported browsers keep the last real value and never invent 88 percent',()=>{
  assert.doesNotMatch(source,/S\.me\.battery!=null\?S\.me\.battery\+'%':'88%'/);
  assert.match(source,/typeof navigator\.getBattery!=='function'/);
  assert.match(source,/window\.addEventListener\('pageshow',webBatteryResume/);
  assert.match(source,/window\.addEventListener\('focus',webBatteryResume/);
  assert.match(source,/visibilitychange.*webBatteryResume/s);
  const start=source.indexOf('function paintBatt()');
  const end=source.indexOf('function hydrateStoredImageNodes()',start);
  const status={textContent:'',title:''};
  const sandbox={S:{me:{battery:26,charging:false}},Promise,Math,navigator:{},document:{hidden:false,addEventListener(){}},window:{addEventListener(){}},$:sel=>sel==='#battinfo'?status:null,save(){}};
  vm.runInNewContext(source.slice(start,end)+';paintBatt();',sandbox);
  assert.match(status.textContent,/网页不支持/,'unsupported browsers must not present an old stored value as live battery');
  assert.doesNotMatch(status.textContent,/26%|88%/);
});

test('web shell exposes a visible battery slot while the private native shell keeps its own status bar',()=>{
  for(const [name,html] of [['web',webHTML],['private bundle',privateHTML]]){
    assert.match(html,/id="statusbar"/i,`${name}: missing status bar container`);
    assert.match(html,/id="clock"/i,`${name}: missing live clock slot`);
    assert.match(html,/id="battinfo"/i,`${name}: missing battery display slot`);
  }
  assert.match(privateGlass,/html\.north-native-app \.statusbar\{display:none!important\}/,'native app must not duplicate the iOS status bar');
});
