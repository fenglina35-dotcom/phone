import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const app=fs.readFileSync(
  path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'),
  'utf8'
);

function watchdogSource(){
  const start=app.indexOf('let _nativePerfWatch=');
  const end=app.indexOf('function persistPendingStateOnHide()',start);
  assert.ok(start>=0&&end>start,'private core watchdog source is present');
  return app.slice(start,end);
}

function createRuntime(){
  let now=0;
  const intervals=[],timeouts=[],classes=new Set(),samples=[];
  const sandbox={
    Date,
    Math,
    Number,
    String,
    Object,
    performance:{now:()=>now},
    privateNativeAppOn:()=>true,
    privateTrimImageMemoryCache(){},
    document:{
      hidden:false,
      documentElement:{classList:{
        add:value=>classes.add(value),
        remove:value=>classes.delete(value),
        contains:value=>classes.has(value)
      }}
    },
    sessionStorage:{setItem(){}},
    setInterval(callback,delay){intervals.push({callback,delay});return intervals.length;},
    setTimeout(callback,delay){timeouts.push({callback,delay});return timeouts.length;},
    clearTimeout(){},
    window:{
      __SMALL_PHONE_WATCHDOG_STATE__:{epoch:0,phase:'bootstrap'},
      __smallPhoneNativePerformanceSampleTrace(sample){samples.push(sample);}
    }
  };
  sandbox.window.window=sandbox.window;
  vm.runInNewContext(
    watchdogSource()+
      ';globalThis.startWatch=northNativePerformanceWatchStart;'+
      'globalThis.sampleWork=northNativePerformanceSample;',
    sandbox
  );
  return{
    sandbox,intervals,timeouts,classes,samples,
    setNow:value=>{now=value;}
  };
}

test('native lifecycle epoch resets the core watchdog without adding another interval',()=>{
  const runtime=createRuntime();
  runtime.sandbox.startWatch();
  assert.equal(runtime.intervals.length,1);
  assert.equal(runtime.intervals[0].delay,2000);

  runtime.setNow(56000);
  runtime.sandbox.window.__SMALL_PHONE_WATCHDOG_STATE__={epoch:1,phase:'background'};
  assert.equal(runtime.sandbox.window.__northNativePerformanceWatchReset(1),true);
  runtime.intervals[0].callback();
  assert.equal(runtime.classes.has('north-native-performance-guard'),false,'background time is not diagnosed as foreground lag');
  assert.equal(runtime.intervals.length,1,'reset does not register a new timer');

  runtime.setNow(58000);
  runtime.sandbox.window.__SMALL_PHONE_WATCHDOG_STATE__={epoch:2,phase:'active'};
  runtime.sandbox.window.__northNativePerformanceWatchReset(2);
  runtime.intervals[0].callback();
  assert.equal(runtime.classes.has('north-native-performance-guard'),false);

  runtime.setNow(61000);
  runtime.intervals[0].callback();
  assert.equal(runtime.classes.has('north-native-performance-guard'),false,'one later foreground stall is retained but not overclaimed');
  runtime.setNow(64000);
  runtime.intervals[0].callback();
  assert.equal(runtime.classes.has('north-native-performance-guard'),true,'repeated genuine foreground stalls still trigger protection');
});

test('core watchdog rejects an older epoch and forwards bounded performance samples',()=>{
  const runtime=createRuntime();
  assert.equal(runtime.sandbox.window.__northNativePerformanceWatchReset(4),true);
  assert.equal(runtime.sandbox.window.__northNativePerformanceWatchReset(3),false);
  runtime.sandbox.sampleWork('render-settings',245);
  assert.equal(runtime.samples.length,1);
  assert.equal(runtime.samples[0].kind,'render-settings');
  assert.equal(runtime.samples[0].ms,245);
});
