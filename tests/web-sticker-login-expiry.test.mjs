import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const hotfix=fs.readFileSync(new URL('../web-hotfix.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const privateApp=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');
const privateShell=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} exists`);
  const tail=source.slice(start+1),match=/\n(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*\(/.exec(tail);
  return source.slice(start,match?start+1+match.index:source.length).trim();
}

test('web-only hotfix makes durable sticker references renderable',()=>{
  const context=vm.createContext({
    window:{addEventListener(){},__SMALL_PHONE_PRIVATE__:false},
    document:{addEventListener(){},hidden:false},
    navigator:{},location:{protocol:'https:'},
    privateNativeAppOn:()=>false,
    isImg:value=>/^https?:|^data:|^blob:/.test(String(value||'')),
    isStoredImgRef:value=>String(value||'').startsWith('idb:'),
    wxLoginActive:()=>true,
    S:{wxLogin:null},
    setTimeout(){},
    Date
  });
  vm.runInContext(hotfix,context);
  assert.equal(context.isImg('idb:sent-sticker-1487'),true);
  assert.equal(context.isImg('not-an-image'),false);
});

test('web-only login expires at the visible deadline even while AI processing is slow',()=>{
  let now=1_000_000;
  const context=vm.createContext({
    window:{addEventListener(){},__SMALL_PHONE_PRIVATE__:false},
    document:{addEventListener(){},hidden:false},
    navigator:{},location:{protocol:'https:'},
    privateNativeAppOn:()=>false,
    isImg:()=>false,
    isStoredImgRef:()=>false,
    wxLoginActive:()=>true,
    S:{wxLogin:{until:now+60_000,processing:true,processingUntil:now+105_000}},
    setTimeout(){},
    Date:{now:()=>now}
  });
  vm.runInContext(hotfix,context);
  assert.equal(context.wxLoginActive(),true);
  now+=60_000;
  assert.equal(context.wxLoginActive(),false,'the lock must end when the countdown reaches zero');
});

test('the web shell and service worker require the hotfix while private files stay outside its entry path',()=>{
  assert.match(shell,/web-hotfix\.js\?v=1122&r=sticker-login-expiry-2/);
  assert.match(hotfix,/sw\.js\?v=1122&r=v1122-sticker-login-expiry-hotfix-2/);
  assert.match(worker,/kind:'hotfix'/);
  assert.match(worker,/north-shell-v1122-sticker-login-expiry-2/);
  assert.doesNotMatch(source,/__NORTH_WEB_HOTFIX__/);
  assert.equal(privateApp,source,'the shared main runtime remains byte-identical');
  assert.doesNotMatch(privateShell,/web-hotfix\.js/,'the private package does not load the web-only repair');
});
