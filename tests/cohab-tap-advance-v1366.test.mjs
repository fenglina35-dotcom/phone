import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1366 共同生活「点一下出一句」：第一句角色自己说，后面每点一下屏幕出一句；按钮输入框照常；离开时没点出来的台词直接收进记录。
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');

test('the setting exists and defaults to automatic playback', () => {
  assert.match(app, /x\.tapAdvance=x\.tapAdvance===true;return x;\}/);
  assert.match(app, /else if\(key==='tapAdvance'\)\{x\.tapAdvance=String\(value\)==='1'\|\|value===true;/);
  assert.match(app, /<span>台词播放<small>点一下屏幕出下一句<\/small><\/span>/);
});

test('after the first line, the next line waits for a tap instead of a timer', () => {
  assert.match(app, /if\(life&&i<items\.length-1&&cohabTapOn\(o\)\)cohabTapWait\(c\.id,item,timing\)\.then\(res\);else setTimeout\(res,timing\.total\);/);
  assert.match(app, /if\(pi<playback\.length-1&&cohabTapOn\(d\)\)cohabTapWait\(id,item,timing\)\.then\(res\);else setTimeout\(res,timing\.total\);/);
  assert.match(app, /document\.addEventListener\('click',cohabTapHandle,true\);/);
  assert.match(app, /if\(el\.closest\('button,a,input,textarea,select,label,summary,details,/, 'buttons and inputs keep working');
  assert.match(html, /\.cohab-tap-hint\{/);
});

test('leaving mid-dialogue keeps the lines that were not tapped out yet', () => {
  assert.match(app, /if\(!_off\)\{if\(life\)\{for\(let j=i;j<items\.length;j\+\+\)\{[^}]*cohabPushMessage\(o,items\[j\]\);/);
  assert.match(app, /if\(!_off\|\|_off\.id!==id\|\|_off\.mode!=='cohab'/);
});

test('the dialogue arrow only exists for a pending next line and uses the current reveal before advancing',()=>{for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){const src=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),lines=src.split(/\r?\n/),ctx={_cohabTap:null,_off:{id:'r',mode:'cohab'},offRender(){},cohabTapRelease(){ctx._cohabTap=null;}};vm.createContext(ctx);vm.runInContext(lines.filter(x=>x.startsWith('function cohabTapNext(')||x.startsWith('function cohabTapNextHTML(')).join('\n'),ctx);assert.equal(ctx.cohabTapNextHTML('r'),'');ctx._cohabTap={id:'r',item:{_reveal:true},revealEnd:Date.now()+10000};assert.match(ctx.cohabTapNextHTML('r'),/还有回复/);assert.equal(ctx.cohabTapNextHTML('other'),'');ctx.cohabTapNext();assert.equal(ctx._cohabTap.item._reveal,false);ctx.cohabTapNext();assert.equal(ctx._cohabTap,null);assert.equal(ctx.cohabTapNextHTML('r'),'');assert(src.includes('cohabTapNextHTML(id)'));}});
