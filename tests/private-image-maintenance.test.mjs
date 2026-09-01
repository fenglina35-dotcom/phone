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
  const calls=[],stored={},diagnostics=[],coreWatchdogResets=[];
  let paused=false,clock=0,visibilityChange=null;
  const context={
    Number,String,Date,
    performance:{now:()=>clock},
    document:{
      hidden:false,
      documentElement:{classList:{contains(){return paused;}}},
      addEventListener(event,callback){if(event==='visibilitychange')visibilityChange=callback;}
    },
    Set,
    window:{
      setTimeout(callback,delay,...args){calls.push({kind:'timeout',callback,delay,args});return calls.length;},
      setInterval(callback,delay,...args){calls.push({kind:'interval',callback,delay,args});return calls.length;},
      __northNativePerformanceWatchReset(epoch,phase){coreWatchdogResets.push({epoch,phase});return true;},
      __smallPhoneNativeDiag(event,fields){diagnostics.push({event,fields});return true;}
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
  let watchdogRuns=0;
  const watchdog=()=>{watchdogRuns++;};
  Object.defineProperty(watchdog,'name',{value:''});
  context.window.setInterval(watchdog,2000);
  assert.equal(calls.length,6);
  assert.notEqual(calls[5].callback,watchdog,'only the existing event-loop watchdog is measured');
  clock=3000;
  calls[5].callback();
  assert.equal(watchdogRuns,1);
  assert.equal(diagnostics.at(-1).event,'event-loop.lag');
  assert.equal(diagnostics.at(-1).fields.ms,1000,'one isolated watchdog delay is retained');
  const lagCount=diagnostics.filter(row=>row.event==='event-loop.lag').length;
  context.document.hidden=true;
  visibilityChange();
  clock=100000;
  context.document.hidden=false;
  visibilityChange();
  calls[5].callback();
  assert.equal(
    diagnostics.filter(row=>row.event==='event-loop.lag').length,
    lagCount,
    'the first callback after foreground cannot turn background time into fake lag'
  );
  const beforeNativeLifecycleLagCount=diagnostics.filter(row=>row.event==='event-loop.lag').length;
  context.window.__smallPhoneNativeWatchdogEpochReset({epoch:1,phase:'resign-active'});
  assert.equal(context.window.__SMALL_PHONE_WATCHDOG_STATE__.active,false);
  clock=156000;
  calls[5].callback();
  context.window.__smallPhoneNativeWatchdogEpochReset({epoch:2,phase:'background'});
  context.window.__smallPhoneNativeWatchdogEpochReset({epoch:3,phase:'foreground'});
  context.window.__smallPhoneNativeWatchdogEpochReset({epoch:4,phase:'active'});
  assert.equal(context.window.__SMALL_PHONE_WATCHDOG_STATE__.active,true);
  clock=158000;
  calls[5].callback();
  assert.equal(
    diagnostics.filter(row=>row.event==='event-loop.lag').length,
    beforeNativeLifecycleLagCount,
    'a native-only lifecycle transition cannot turn background time into fake lag'
  );
  const stableEpoch=context.window.__SMALL_PHONE_WATCHDOG_STATE__.epoch;
  const resetCount=coreWatchdogResets.length;
  context.window.__smallPhoneNativeWatchdogEpochReset({epoch:3,phase:'foreground'});
  assert.equal(context.window.__SMALL_PHONE_WATCHDOG_STATE__.epoch,stableEpoch,'stale native epochs are ignored');
  assert.equal(coreWatchdogResets.length,resetCount,'stale epochs do not reset the core watchdog again');
  clock=161000;
  calls[5].callback();
  const foregroundLag=diagnostics.filter(row=>row.event==='event-loop.lag').at(-1);
  assert.equal(foregroundLag.fields.ms,1000,'a later genuine foreground stall is still diagnosed');
  assert.equal(foregroundLag.fields.scope,'stable');
  assert.ok(coreWatchdogResets.some(row=>row.phase==='active'),'native lifecycle resets reach the core watchdog');
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
