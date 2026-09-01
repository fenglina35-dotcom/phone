import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');

test('Apple compatibility moves only the two requested top controls', () => {
  assert.match(html, /html\.north-apple-remote-safe \.pet-world-top\{padding-top:var\(--north-apple-remote-offset\)/);
  assert.match(html, /html\.north-apple-remote-safe \.wxlogin-topbar\{padding-top:var\(--north-apple-remote-offset\)/);
  assert.match(app, /<div class="nav wxlogin-topbar"/);
  assert.doesNotMatch(html, /html:not\(\.north-apple-remote-safe\).*pet-world-top/);
});

test('cohabitation can persist a requested online message without duplicating it locally', () => {
  assert.match(app, /function cohabApplyOnlineMessageTags/);
  assert.match(app, /\[共同生活发消息\|微信\|消息正文\]/);
  assert.match(app, /msgs\(c\.id\)\.push\(m\);notifyIncoming\(c,m\)/);
  assert.match(app, /g\.msgs\.push\(m\);save\(\);gNotify\(g,c\)/);
  assert.match(app, /const exact=groups\.filter/);
  assert.match(app, /群聊时必须先自然追问群名，绝不能随机选择/);
  assert.match(app, /online=cohabApplyOnlineMessageTags\(phone\.text,c,actionOutcome\)/);
});
