// MAIL_FORWARD_GUARD_V1（2026-10-31 群里用户：情侣角色聊天和生成 X 全部报「mailForwardHistory is not defined」）：
// mail-outbox.js 没加载成功时，聊天里有转发信件也不能让整理聊天记录、显示聊天卡死。两版都要满足。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = process.env.FIX_TEST_ROOT || new URL('..', import.meta.url).pathname;
for (const [label, file] of [['web', '/app.js'], ['private', '/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']]) {
  const src = fs.readFileSync(ROOT + file, 'utf8');
  test(`${label}：信箱文件没加载时，转发的信也能整理成文字`, () => {
    assert.match(src, /if\(m&&m\.type==='mailforward'\)return typeof mailForwardHistory==='function'\?mailForwardHistory\(m\):mailForwardFallbackText\(m\);/);
    const i = src.indexOf('function mailForwardFallbackText(');
    assert.ok(i > 0, '要有替代写法');
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(src.slice(i, src.indexOf('\n', i)), ctx);
    const t = ctx.mailForwardFallbackText({ letter: { subject: '给你的信', authorName: '他', body: '想你了' } });
    assert.match(t, /转发信件/);
    assert.match(t, /想你了/);
  });
  test(`${label}：信箱文件没加载时，聊天里的转发信件卡片也能显示`, () => {
    assert.match(src, /if\(m\.type==='mailforward'\)return typeof mailForwardCard==='function'\?mailForwardCard\(m,c\.id\):/);
  });
}
