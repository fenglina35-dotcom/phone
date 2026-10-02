import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const P='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('offline and common life can delete chat history by day, older than 1 or 3 days, or all',()=>{
  for(const p of ['app.js',P+'app.js']){const s=read(p);
    assert.match(s,/function offHistMatch\(kind,day\)\{const now=Date\.now\(\);if\(kind==='all'\)return\(\)=>true;if\(kind==='1d'\)return m=>\(\+m\.time\|\|0\)<now-864e5;if\(kind==='3d'\)return m=>\(\+m\.time\|\|0\)<now-3\*864e5;/);
    assert.match(s,/function offDelHistory\(id\)\{const o=offSceneData\(id\)/);
    assert.match(s,/删除这一天的记录/);assert.match(s,/删除一天前的记录/);assert.match(s,/删除三天前的记录/);assert.match(s,/'全部删除'/);
    assert.match(s,/if\(!await uiConfirm\('删除'\+label\+'的 '\+n\+' 条聊天记录？删除后不能恢复'\)\)return;/);
    assert.match(s,/\/\* 删完后空着的日期分隔也一起去掉 \*\//);
    assert.equal((s.match(/onclick="offDelHistory\('\$\{id\}'\)">删除聊天记录<\/button>/g)||[]).length,2,'线下和共同生活两个多选栏都有');
  }
  for(const p of ['cohab-theater.js',P+'cohab-theater.js'])assert.match(read(p),/onclick="offDelHistory\('\$\{id\}'\)">删除聊天记录<\/button>/,'多人剧场的共同生活页也有');
});

test('the narration button state survives deletes and re-renders and is what gets sent',()=>{
  for(const p of ['app.js',P+'app.js']){const s=read(p);
    assert.match(s,/const _offNarrateById=\{\};/);
    assert.match(s,/function offNarrateBtnHTML\(\)\{const on=offNarrationMode\(\);/);
    assert.match(s,/placeholder="\$\{esc\(typeof offInputPlaceholder==='function'\?offInputPlaceholder\(placeholder\):placeholder\)\}"/);
    assert.match(s,/<div class="inputbar offinput\$\{offNarrationMode\(\)\?' narration-mode':''\}">\$\{offNarrateBtnHTML\(\)\}/);
  }
  const t=read('cohab-theater.js');
  assert.match(t,/html\.replace\(\/<div class="inputbar offinput\[\^"\]\*">/,'旁白开着时“你已暂时离场”面板也能替换输入栏');
});

test('the addressee shown on screen is the one used, and a returning member is re-selected',()=>{
  const t=read('cohab-theater.js');assert.equal(read(P+'cohab-theater.js'),t);
  assert.match(t,/function theaterSyncAddressFromUI\(id\)/);
  assert.match(t,/ta\.value='';theaterSyncAddressFromUI\(_off\.id\);/);
  assert.match(t,/t\.addressAway=\{kind,fallback:t\.addressTo\}/);
  assert.match(t,/function theaterTurnOrder\(t,target\)/);
  assert.match(t,/toast\(name\+' 暂时离场，改由在场的人接话'\)/);
});
