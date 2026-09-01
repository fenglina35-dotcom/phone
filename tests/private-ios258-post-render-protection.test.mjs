import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const app=read('app.js');
const privateApp=read(
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/' +
    'PhoneWeb.bundle/app.js'
);
const webView=read(
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/' +
    'LocalPhoneWebView.swift'
);

function functionSource(source,name){
  let start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  if(source.slice(Math.max(0,start-6),start)==='async ')start-=6;
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped)escaped=false;
      else if(ch==='\\')escaped=true;
      else if(ch===quote)quote='';
      continue;
    }
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

function imageRuntime({hasNodes,keys=[],found={}}){
  const timers=[],idle=[],calls={nodeScans:0,domApply:0,trim:[],imgMany:[]};
  const context=vm.createContext({
    Map,Date,Promise,Object,
    lazyStoredImagesOn:()=>true,
    visibleStoredImageNodesOnPage:()=>{calls.nodeScans++;return hasNodes;},
    visibleStoredImageKeys:()=>keys.slice(),
    hydrateStoredImageNodes:()=>{calls.domApply++;},
    privateTrimImageMemoryCache:rows=>{calls.trim.push([...rows]);return 0;},
    imgMany:async rows=>{calls.imgMany.push([...rows]);return {...found};},
    northNativePerfClock:()=>0,
    northNativePerformanceSample:()=>{},
    _imgCache:{},
    _imgRev:new Map(),
    _imgReady:new Set(),
    setTimeout(callback,delay){timers.push({callback,delay});return timers.length;},
    clearTimeout:()=>{},
    requestIdleCallback(callback,options){idle.push({callback,options});return idle.length;},
    cancelIdleCallback:()=>{}
  });
  vm.runInContext([
    'let _visibleImageHydrateTimer=0,_visibleImageHydrateIdle=0,' +
      '_visibleImageHydrateBusy=false,_visibleImageHydrateAgain=false,' +
      "_visibleImageRouteKey='';",
    'const _visibleImageMisses=new Map();',
    functionSource(privateApp,'visibleImageRetryState'),
    functionSource(privateApp,'visibleImageRetryDelay'),
    functionSource(privateApp,'hydrateVisibleStoredImages'),
    functionSource(privateApp,'scheduleVisibleStoredImages'),
    ';globalThis.scheduleVisible=scheduleVisibleStoredImages;'
  ].join('\n'),context);
  return{context,timers,idle,calls};
}

test('private stored-image scheduling keeps its native-only empty-route protection',()=>{
  for(const name of [
    'visibleImageRetryState','visibleImageRetryDelay',
    'hydrateVisibleStoredImages','scheduleVisibleStoredImages'
  ]) assert.ok(functionSource(privateApp,name).length>40,name);
  assert.match(
    functionSource(privateApp,'hydrateVisibleStoredImages'),
    /privateNativeAppOn\(\)&&!keys\.length/
  );
  assert.doesNotMatch(
    functionSource(app,'hydrateVisibleStoredImages'),
    /privateNativeAppOn\(\)&&!keys\.length/
  );
});

test('a page without stored-image nodes schedules no zero-delay work or cache trim',()=>{
  const runtime=imageRuntime({hasNodes:false});
  runtime.context.scheduleVisible(true,true);
  runtime.context.scheduleVisible(false,true);
  assert.equal(runtime.calls.nodeScans,2);
  assert.deepEqual(runtime.timers,[]);
  assert.deepEqual(runtime.idle,[]);
  assert.equal(runtime.calls.domApply,0);
  assert.deepEqual(runtime.calls.imgMany,[]);
  assert.deepEqual(runtime.calls.trim,[]);
});

test('a page with stored-image nodes keeps the zero-delay forced hydration path',async()=>{
  const runtime=imageRuntime({
    hasNodes:true,
    keys:['hero'],
    found:{hero:'data:image/png;base64,AA=='}
  });
  runtime.context.scheduleVisible(true,true);
  assert.equal(runtime.timers.length,1);
  assert.equal(runtime.timers[0].delay,0);
  runtime.timers[0].callback();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(runtime.calls.imgMany,[['hero']]);
  assert.equal(runtime.calls.domApply,1);
  assert.deepEqual(runtime.calls.trim,[['hero']]);
  assert.equal(runtime.context._imgCache.hero,'data:image/png;base64,AA==');
});

test('automatic WebContent reload is staged, token-guarded, and clears recovery on success',()=>{
  for(const event of [
    'native.webcontent.reloadScheduled',
    'native.webcontent.reloadStarted',
    'native.webcontent.reloadSucceeded'
  ])assert.match(webView,new RegExp(event.replaceAll('.','\\.')));

  const terminationStart=webView.indexOf(
    'func webViewWebContentProcessDidTerminate(_ webView: WKWebView)'
  );
  const terminationEnd=webView.indexOf(
    '\n        func webView(\n            _ webView: WKWebView,\n            createWebViewWith',
    terminationStart
  );
  assert.ok(terminationStart>=0&&terminationEnd>terminationStart);
  const termination=webView.slice(terminationStart,terminationEnd);
  assert.match(termination,/let recoveryToken = automaticWebContentRecoveryToken/);
  assert.match(
    termination,
    /self\.automaticWebContentRecoveryToken == recoveryToken/
  );
  assert.ok(
    termination.indexOf('native.webcontent.reloadScheduled')<
      termination.indexOf('DispatchQueue.main.asyncAfter')
  );
  assert.ok(
    termination.indexOf('native.webcontent.reloadStarted')<
      termination.indexOf('webView.loadFileURL')
  );

  const didFinishStart=webView.indexOf(
    'func webView(\n            _ webView: WKWebView,\n            didFinish navigation'
  );
  const didFinishEnd=webView.indexOf(
    '\n        func webView(',
    didFinishStart+10
  );
  assert.ok(didFinishStart>=0&&didFinishEnd>didFinishStart);
  const didFinish=webView.slice(didFinishStart,didFinishEnd);
  assert.match(
    didFinish,
    /automaticWebContentRecoveryInFlight &&[\s\S]*?webView\.url\?\.isFileURL == true/
  );
  assert.match(
    didFinish,
    /automaticWebContentRecoveryInFlight = false[\s\S]*?automaticWebContentRecoveryToken \+= 1[\s\S]*?native\.webcontent\.reloadSucceeded/
  );
  assert.match(
    didFinish,
    /if recoveryNoticeActive \{[\s\S]*?recoveryNoticeActive = false[\s\S]*?DispatchQueue\.main\.async \{ \[onRecoveryContinued\] in[\s\S]*?onRecoveryContinued\(\)/
  );

  const cancelStart=webView.indexOf(
    'private func cancelAutomaticWebContentRecovery()'
  );
  const cancelEnd=webView.indexOf('\n        }',cancelStart)+10;
  assert.ok(cancelStart>=0&&cancelEnd>cancelStart);
  const cancel=webView.slice(cancelStart,cancelEnd);
  assert.match(cancel,/automaticWebContentRecoveryToken \+= 1/);
  assert.match(cancel,/pendingWebContentRecovery\?\.cancel\(\)/);
  assert.match(cancel,/pendingWebContentRecovery = nil/);
});
