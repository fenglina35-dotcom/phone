import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// MOMENT_LONG_TEXT_V1 (2026-10-30, her report): a long role 朋友圈 was cut off. The text was sliced at 140 characters in
// the middle of a sentence, and the generator only asked for 220 tokens. Now up to 500 characters, cut at a sentence end.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
const LONG = '今天下班路过那家旧书店，老板还记得我上次买的那本诗集。' + '雨下得很细，街灯一盏一盏亮起来，我站在门口等她回消息。'.repeat(8);
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const ctx = { CTLLEAK: /^\s*\[(?:心情|心声)/, cleanRolePunct: t => t }; vm.createContext(ctx);
  vm.runInContext(['trimSentence', 'cleanMomentBody', 'cleanMomentText'].map(n => fn(s, n)).join('\n'), ctx);
  test(file + ': a long 朋友圈 keeps its whole text', () => {
    assert(LONG.length > 140 && LONG.length < 500);
    assert.equal(ctx.cleanMomentText(LONG), LONG);
    assert.equal(ctx.cleanMomentText('[发朋友圈|' + LONG + ']'), LONG, 'also from the 发朋友圈 tag');
  });
  test(file + ': a very long one ends at a sentence, not mid-word', () => {
    const v = ctx.cleanMomentText(LONG.repeat(3));
    assert(v.length <= 620 && v.length >= 400); assert(/[。！？…]$/.test(v));
    assert(/max:700,temp:\.75,complete:true/.test(s), 'the generator has room for a longer post');
  });
}
