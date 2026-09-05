import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const script=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-reply-intercept.js');

test('private v1178 loads diagnostic parity between app core and theater extension',()=>{
  for(const file of ['index.html','小手机.html']){
    const html=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/'+file);
    assert.match(html,/app\.js\?v=1182[^\n]*<\/script>\s*<script src="private-reply-intercept\.js\?v=1182&r=v1178-private-intercept-parity-1"[^\n]*<\/script>\s*<script src="cohab-theater\.js\?v=1182/);
  }
  assert.doesNotMatch(read('小手机.html'),/private-reply-intercept\.js/);
});

test('online, offline and cohab settings expose the last intercepted model text',()=>{
  assert.match(script,/window\.__NORTH_PRIVATE_REPLY_INTERCEPT__='v1178-private-intercept-parity-1'/);
  assert.match(script,/roleInterceptDiagnosticOpen\('\$\{id\}','online'\)/);
  assert.match(script,/roleInterceptDiagnosticOpen\('\$\{_off&&_off\.id\|\|''\}','offline'\)/);
  assert.match(script,/roleInterceptDiagnosticOpen\('\$\{id\}','cohab'\)/);
  assert.ok((script.match(/查看上一轮拦截内容/g)||[]).length>=3);
  assert.match(script,/sessionStorage\.setItem\(KEY,JSON\.stringify\(rows\)\)/);
});

test('diagnostic capture excludes theater JSON and release is explicit and rollback-safe',()=>{
  assert.match(script,/if\(!\(opt&&opt\.theaterActor\)\)turnCandidate\(activeTurn,out\)/);
  assert.match(script,/if\(!await uiConfirm\('把这一轮全部/);
  assert.match(script,/_interceptReleased:true/);
  assert.match(script,/if\(list&&list\.length>before\)list\.splice\(before\)/);
  assert.match(script,/只写入原文，不重新执行其中的功能标签/);
});
