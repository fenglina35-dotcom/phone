import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bundled=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

test('role settings expose one real busy-state test button',()=>{
  assert.match(app,/忙碌状态（测试）/);
  assert.match(app,/<button type="button" class="sw \$\{roleBusyActive\(c\)\?'on':''\}" onclick="roleBusyTestToggle/);
  assert.match(app,/在线 · 忙碌中/);
});

test('busy mode defers ordinary replies and resumes with the genuine role route',()=>{
  assert.match(app,/function roleBusyDeferReply\(id,note,aid\)\{if\(note\)return false/);
  assert.match(app,/typeof roleBusyDeferReply==='function'&&roleBusyDeferReply\(id,note,aid\).*return true/);
  assert.match(app,/const queued=scheduleReply\(c\.id,note,ok=>roleBusyFinish/);
  assert.match(app,/用你自己的完整人设、当前关系和自然说话习惯/);
  assert.doesNotMatch(app,/roleBusyEndAndReply[\s\S]{0,1800}msgs\(c\.id\)\.push\(\{role:'assistant'/,'busy return must not manufacture a canned assistant bubble');
});

test('busy state is durable, idempotent and blocks manual or proactive bypasses',()=>{
  assert.match(app,/st\.sessionId=retry&&st\.sessionId\?st\.sessionId:'busy_'\+uid\(\)/);
  assert.match(app,/if\(!st\|\|st\.sessionId!==sessionId\)return/);
  assert.match(app,/typeof roleBusyActive==='function'&&roleBusyActive\(c,aid\).*ta现在处于忙碌状态/);
  assert.match(app,/function roleOnlineProactiveBlocked\(id\)[^\n]+busy=/);
});

test('web and private bundle keep the same busy implementation',()=>{
  assert.equal(app,bundled);
});
