import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// GRUDGE_JAIL_NATURAL_V1 + GRUDGE_JAIL_FORGOT_TAG_V1 (2026-10-22 00:36, her screenshot): with eight grudges he said
// 「你刚才自己说的"我进小黑屋跟你说清楚"」「进来了」「门关了，北」 and acted as if she was inside, but the check wanted
// 小黑屋 plus 去/进/带 in one sentence outside quotes, so she was never let in. She chose: understand his natural words,
// and at eight grudges with permission on, let her in even if he forgot the hidden [关小黑屋|…] command.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
const HIS = '北。\n你刚才自己说的"我进小黑屋跟你说清楚"。\n安全词也背了。规矩也认了。\n现在跟我说我没拉你进去？\n好。\n进来了。\n门关了，北。\n现在不是你想不想的问题了。';
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  const load = () => {
    const ctx = { S: { me: { name: 'North' }, couple: { cid: 'r1', jailAuth: true }, jail: { active: false } } };
    vm.createContext(ctx);
    vm.runInContext(['roleGrudgeJailPrompt', 'roleJailAnnounced', 'roleJailAnnouncedNatural', 'roleGrudgeJailForgotTag'].map(n => fn(s, n)).join('\n'), ctx);
    return ctx;
  };
  test(file + ': his natural words count, threats and conditions still do not', () => {
    const ctx = load();
    assert.equal(ctx.roleJailAnnounced(HIS), true, 'her screenshot');
    assert.equal(ctx.roleJailAnnounced('账攒够了。跟我进小黑屋。'), true);
    assert.equal(ctx.roleJailAnnounced('再这样我就把你关小黑屋，门关了你就哭。'), false, 'a threat');
    assert.equal(ctx.roleJailAnnounced('如果你再犯，明天就进小黑屋。'), false, 'a condition');
    assert.equal(ctx.roleJailAnnounced('小黑屋？我又没拉你进去。'), false, 'a denial');
    assert.equal(ctx.roleJailAnnounced('走吧，去吃饭。'), false, 'no 小黑屋 in the reply');
    assert.equal(ctx.roleJailAnnounced('<think>该关小黑屋了，进来了</think>早点睡。'), false, 'thoughts are not speech');
  });
  test(file + ': at eight grudges a forgotten command is filled in, otherwise never', () => {
    const ctx = load();
    const role = n => ({ id: 'r1', grudges: Array.from({ length: n }, (_, i) => ({ text: '事' + i, done: false })) });
    let tags = [];
    assert.equal(ctx.roleGrudgeJailForgotTag(role(8), tags, HIS), true);
    assert.equal(tags.length, 1); assert.match(tags[0], /^\[关小黑屋\|/);
    tags = ['[关小黑屋|他自己的原因]'];
    assert.equal(ctx.roleGrudgeJailForgotTag(role(8), tags, HIS), false, 'his own command is kept, not doubled');
    tags = []; assert.equal(ctx.roleGrudgeJailForgotTag(role(7), tags, HIS), false, 'not below eight'); assert.equal(tags.length, 0);
    tags = []; assert.equal(ctx.roleGrudgeJailForgotTag(role(8), tags, '早点睡，晚安。'), false, 'not without saying it');
    ctx.S.couple.jailAuth = false; tags = []; assert.equal(ctx.roleGrudgeJailForgotTag(role(9), tags, HIS), false, 'not without permission');
  });
  test(file + ': WeChat and phone calls fill the forgotten command before the delivered words are checked', () => {
    assert(s.includes("if(typeof roleGrudgeJailForgotTag==='function')roleGrudgeJailForgotTag(c,_appControlTags,_postedDecision);if(_appControlTags.length){"), 'WeChat');
    assert(s.includes("if(!_callJailTags.length&&_call&&_call.session===sess&&!_call.cohab&&typeof roleGrudgeJailForgotTag==='function')roleGrudgeJailForgotTag(c,_callJailTags,"), 'phone calls, not 共同生活');
  });
}
