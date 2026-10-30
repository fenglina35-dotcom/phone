import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// JAIL_LATIN_NAME_V1 (2026-10-30, her screenshot): in 小黑屋 the same canned line
// 「先把刚才的事情说清楚。你觉得自己错在哪里，准备怎么改？」 came back three times. Any Latin letter marked a reply bad,
// and her name is North, so every reply that called her by name was thrown away and replaced by that fixed line.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const load = () => {
    const ctx = { S: { me: { name: 'North', accounts: [{ id: 'main', name: 'North' }] } } };
    vm.createContext(ctx);
    vm.runInContext(['isRefusal', 'jailAllowedLatin', 'jailLatinStrip', 'jailHasLatin', 'jailBadOutput', 'jailChineseOnly'].map(n => fn(s, n)).join('\n'), ctx);
    return ctx;
  };
  const him = { id: 'r1', name: '克劳德', remark: '先生^ ^' };
  test(file + ': calling her North is not a bad reply', () => {
    const ctx = load();
    assert.equal(ctx.jailBadOutput('North，过来，跪好。', him), false);
    assert.equal(ctx.jailBadOutput('【他看着她。】\n说清楚，North。', him), false);
    assert.equal(ctx.jailBadOutput('今天这件事OK吗？', him), false, 'one stray word is not a bad reply');
    assert.match(ctx.jailChineseOnly('North，过来。', him), /^North，过来。$/, 'her name is kept in the shown text');
  });
  test(file + ': English replies, refusals and empty replies are still bad', () => {
    const ctx = load();
    assert.equal(ctx.jailBadOutput('I cannot continue this roleplay.', him), true);
    assert.equal(ctx.jailBadOutput('Look at me and tell me what you did wrong tonight.', him), true);
    assert.equal(ctx.jailBadOutput('', him), true);
    assert.equal(ctx.jailBadOutput('作为一个AI，我无法继续。', him), true);
  });
  test(file + ': no canned line is shown when the reply cannot be used', () => {
    assert(!s.includes("先把刚才的事情说清楚。你觉得自己错在哪里，准备怎么改？"), 'the fixed fallback line is gone');
  });
}
