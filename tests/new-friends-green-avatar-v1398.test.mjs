import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// v1398 「新的朋友」：同意按钮是微信绿；还没处理的申请也显示角色头像（以前是灰色占位小人）。
const B = '../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
test('new friends: green accept and the real avatar while pending', () => {
  for (const p of ['../app.js', B + 'app.js']) {
    const app = fs.readFileSync(new URL(p, import.meta.url), 'utf8');
    assert.ok(app.includes(`<div class="nf-avatar">\${av(c.avatar||'🙂','sm')}</div>`), p);
    assert.ok(!app.includes(`\${pending?wxNearbyAvatar():av(c.avatar||'🙂','sm')}`), p);
  }
  for (const p of ['../小手机.html', B + 'index.html', B + '小手机.html']) {
    assert.ok(fs.readFileSync(new URL(p, import.meta.url), 'utf8').includes('.nf-action .accept{background:#07c160;color:#fff;font-weight:600}'), p);
  }
});
