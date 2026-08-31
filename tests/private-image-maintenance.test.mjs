import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const privateApp=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'),'utf8');
const nativeWebView=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift'),'utf8');

test('private App suppresses only the automatic one-minute full image sweep at the native boundary',()=>{
  assert.match(privateApp,/setTimeout\(imgGC,60000\)/,'the bundled application keeps the shared source behavior');
  assert.match(nativeWebView,/const nativeSetTimeout = window\.setTimeout\.bind\(window\)/);
  assert.match(nativeWebView,/Number\(delay\) === 60000/);
  assert.match(nativeWebView,/callback\.name === 'imgGC'/);
  assert.match(nativeWebView,/north_private_auto_image_gc_suppressed_v1/);
});

test('the timer shim keeps image GC suppressed while leaving ordinary timers unchanged',()=>{
  assert.match(nativeWebView,/return nativeSetTimeout\(callback, delay, \.\.\.args\)/);
  const start=nativeWebView.indexOf('const nativeSetTimeout = window.setTimeout.bind(window);');
  const end=nativeWebView.indexOf(
    'const root = document.documentElement;',
    nativeWebView.indexOf('window.setInterval =',start)
  );
  assert.ok(start>=0&&end>start,'native timer guard source is present');
  const calls=[],stored={};
  let paused=false;
  const context={
    Number,String,Date,
    document:{hidden:false,documentElement:{classList:{contains(){return paused;}}}},
    Set,
    window:{
      setTimeout(callback,delay,...args){calls.push({kind:'timeout',callback,delay,args});return calls.length;},
      setInterval(callback,delay,...args){calls.push({kind:'interval',callback,delay,args});return calls.length;}
    },
    localStorage:{setItem(key,value){stored[key]=value;}},
  };
  vm.runInNewContext(`(()=>{${nativeWebView.slice(start,end)}})()`,context);
  const ordinary=()=>{};
  context.window.setTimeout(ordinary,125,'ok');
  assert.equal(calls.length,1);
  assert.equal(calls[0].delay,125);
  function imgGC(){}
  context.window.setTimeout(imgGC,60000);
  assert.equal(calls.length,2);
  assert.equal(calls[1].delay,0,'the automatic sweep is replaced by one empty zero-delay timer');
  assert.ok(stored.north_private_auto_image_gc_suppressed_v1);
  context.window.setTimeout(ordinary,250);
  assert.equal(calls.length,3);
  assert.equal(calls[2].delay,250,'ordinary timers still use the original implementation');
  function suspicionTick(){}
  assert.equal(context.window.setInterval(suspicionTick,1000),0);
  assert.equal(calls.length,3,'the no-op one-second interval is not scheduled');
  let optionalRuns=0;
  function checkInitiative(){optionalRuns++;}
  context.window.setInterval(checkInitiative,15000);
  assert.equal(calls.length,4);
  paused=true;
  calls[3].callback();
  assert.equal(optionalRuns,0,'optional work stays paused under the circuit breaker');
  paused=false;
  calls[3].callback();
  assert.equal(optionalRuns,1,'optional work resumes after pressure clears');
  function roleServerPushPull(){}
  context.window.setInterval(roleServerPushPull,60000);
  assert.equal(calls.length,5);
  assert.equal(calls[4].callback,roleServerPushPull,'critical role inbox work is never wrapped');
});

test('private timer circuit breaker pauses only optional maintenance and removes the no-op one-second wake',()=>{
  assert.match(nativeWebView,/const nativeSetInterval = window\.setInterval\.bind\(window\)/);
  assert.match(nativeWebView,/const optionalMaintenance = new Set\(\[[\s\S]*?'checkInitiative'[\s\S]*?'checkSpyTime'/);
  assert.match(nativeWebView,/callback\.name === 'suspicionTick'[\s\S]*?return 0/);
  assert.match(nativeWebView,/root\.classList\.contains\('north-native-performance-guard'\)/);
  const optionalBlock=nativeWebView.slice(
    nativeWebView.indexOf('const optionalMaintenance = new Set(['),
    nativeWebView.indexOf(']);',nativeWebView.indexOf('const optionalMaintenance = new Set(['))+3
  );
  assert.doesNotMatch(optionalBlock,/roleServerPush/);
  assert.doesNotMatch(optionalBlock,/companionPollSnapshot/);
});

test('explicit cleanup remains available and keeps referenced images and reserved archives protected',()=>{
  assert.match(privateApp,/function imgUsedKeys\(\)/);
  assert.match(privateApp,/key\.indexOf\('__'\)===0\|\|used\.has\(key\)/);
  assert.match(privateApp,/function imgGC\(\)/);
});
