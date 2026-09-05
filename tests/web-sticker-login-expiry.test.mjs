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

test('web-only sticker repair keeps durable role avatars on the IndexedDB hydration path',()=>{
  const context=vm.createContext({
    window:{addEventListener(){},__SMALL_PHONE_PRIVATE__:false},
    document:{addEventListener(){},hidden:false},
    navigator:{},location:{protocol:'https:'},
    privateNativeAppOn:()=>false,
    S:{wxLogin:null},setTimeout(){},Date
  });
  vm.runInContext(`
    let _imgCache={};
    function esc(v){return String(v);}
    function _avIc(){return '<svg></svg>';}
    function isImg(value){return /^(https?:|data:|blob:)/i.test(String(value||''));}
    function isStoredImgRef(value){return String(value||'').startsWith('idb:');}
    function av(value){if(isImg(value))return '<img src="'+value+'">';if(isStoredImgRef(value))return '<div data-idb-avatar="'+value.slice(4)+'"></div>';return '<div></div>';}
    function _mAvHTML(value){if(isImg(value))return '<img src="'+value+'">';if(isStoredImgRef(value))return '<div data-idb-avatar="'+value.slice(4)+'"></div>';return '<div></div>';}
    function spyLockAvatar(contact){const value=contact&&contact.avatar;if(isImg(value))return '<img src="'+value+'">';if(isStoredImgRef(value))return '<div data-idb-avatar="'+value.slice(4)+'"></div>';return '<div></div>';}
    function coAvatar(contact){const value=contact&&contact.avatar;if(isImg(value))return '<img src="'+value+'">';return '<div>'+String(value||'')+'</div>';}
    function callStoredImageSource(value){if(isImg(value))return value;if(isStoredImgRef(value))return _imgCache[value.slice(4)]||'';return '';}
    function wxLoginActive(){return false;}
  `,context);
  vm.runInContext(hotfix,context);
  for(const html of [context.av('idb:role-avatar'),context._mAvHTML('idb:music-avatar'),context.spyLockAvatar({avatar:'idb:spy-avatar'}),context.coAvatar({avatar:'idb:cohab-avatar'})]){
    assert.match(html,/data-idb-avatar=/,'stored avatars must leave a hydration target');
    assert.doesNotMatch(html,/<img src="idb:/,'stored avatars must never become invalid browser URLs');
  }
  assert.equal(context.callStoredImageSource('idb:call-avatar'),'','an uncached call avatar must wait for IndexedDB hydration');
  assert.equal(context.isImg('idb:sent-sticker'),true,'sticker bubbles retain the durable-image repair');
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
  assert.match(shell,/web-hotfix\.js\?v=1183&r=v1183-cohab-keyboard-vinyl-release-1/);
  assert.match(hotfix,/sw\.js\?v=1183&r=v1183-cohab-keyboard-vinyl-release-1/);
  assert.match(worker,/kind:'hotfix'/);
  assert.match(worker,/north-shell-v1183-cohab-keyboard-vinyl-release-1/);
  assert.doesNotMatch(source,/__NORTH_WEB_HOTFIX__/);
  assert.doesNotMatch(privateApp,/__NORTH_WEB_HOTFIX__/,'the private runtime does not embed the web-only repair');
  assert.doesNotMatch(privateShell,/web-hotfix\.js/,'the private package does not load the web-only repair');
});
