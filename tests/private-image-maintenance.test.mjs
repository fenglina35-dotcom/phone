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

test('the timer shim removes itself immediately and leaves every other timer unchanged',()=>{
  assert.match(nativeWebView,/window\.setTimeout = nativeSetTimeout;[\s\S]*?return nativeSetTimeout\(\(\) => \{\}, 0\)/);
  assert.match(nativeWebView,/return nativeSetTimeout\(callback, delay, \.\.\.args\)/);
  const start=nativeWebView.indexOf('const nativeSetTimeout = window.setTimeout.bind(window);');
  const end=nativeWebView.indexOf('const root = document.documentElement;',start);
  assert.ok(start>=0&&end>start,'native timer guard source is present');
  const calls=[],stored={};
  const context={
    Number,String,Date,
    window:{setTimeout(callback,delay,...args){calls.push({callback,delay,args});return calls.length;}},
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
  assert.equal(calls[2].delay,250,'the original timer implementation is restored after interception');
});

test('explicit cleanup remains available and keeps referenced images and reserved archives protected',()=>{
  assert.match(privateApp,/function imgUsedKeys\(\)/);
  assert.match(privateApp,/key\.indexOf\('__'\)===0\|\|used\.has\(key\)/);
  assert.match(privateApp,/function imgGC\(\)/);
});
