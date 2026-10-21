import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// GRUDGE_JAIL_PIN_V1 (2026-10-21): with 8 open grudges and 小黑屋 allowed, the reminder sat in the middle of a
// ~100k-character prompt and he never brought it up. Now a short note is also pinned right after her latest
// message, in WeChat and in phone calls (not 共同生活, her choice). He still chooses his own words.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  test(file + ': the note appears only when 8 grudges are open and 小黑屋 is allowed', () => {
    const s = fs.readFileSync(file, 'utf8');
    const ctx = { S: { me: { name: 'North' }, couple: { cid: 'r1', jailAuth: true }, jail: { active: false } } };
    vm.createContext(ctx);
    vm.runInContext(fn(s, 'roleGrudgeJailPrompt') + '\n' + fn(s, 'roleGrudgeJailPin'), ctx);
    const role = n => ({ id: 'r1', grudges: Array.from({ length: n }, (_, i) => ({ text: '事' + i, done: false })).concat([{ text: '已和好', done: true }]) });
    const pin = ctx.roleGrudgeJailPin(role(8));
    assert.match(pin, /小纸条：该算账了/);
    assert.match(pin, /有 8 笔还没解决/);
    assert.match(pin, /\[关小黑屋\|你自己写的原因\]/);
    assert.match(pin, /怎么说、什么语气都由你决定，不用固定台词/);
    assert.equal(ctx.roleGrudgeJailPin(role(7)), '', 'seven is not yet the line');
    ctx.S.couple.jailAuth = false; assert.equal(ctx.roleGrudgeJailPin(role(9)), '', 'not without her permission');
    ctx.S.couple.jailAuth = true; ctx.S.jail.active = true; assert.equal(ctx.roleGrudgeJailPin(role(9)), '', 'not while she is already inside');
    ctx.S.jail.active = false; ctx.S.couple.cid = 'other'; assert.equal(ctx.roleGrudgeJailPin(role(9)), '', 'only the couple-space role');
    assert.match(ctx.roleGrudgeJailPrompt({ id: 'other', grudges: [] }) + '', /^$/);
  });
  test(file + ': pinned in WeChat and ordinary phone calls, not in 共同生活', () => {
    const s = fs.readFileSync(file, 'utf8');
    assert(s.includes("+roleReplyCrossChannelHandoffPrompt(c,now)+(typeof roleGrudgeJailPin==='function'?roleGrudgeJailPin(c):'')};}"), 'WeChat replies');
    assert(s.includes("personaPin(c)+_ordinaryCallContinuity+(_call.cohab||_videoVision||_screenShareEvent||_connectionEvent||_inspectionCompletion?'':roleGrudgeJailPin(c))"), 'phone calls, not the 共同生活 voice mode');
    assert(s.includes('到了这一步，记仇规则里的「可以先忍着」「别反复提同一笔旧账」都不再适用。'), 'the two softer rules no longer hold him back at 8');
  });
}
