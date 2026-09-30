import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1364：引用框不再把对方的气泡撑宽；抖音群每个人可以选单独调用或合并调用。
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const fn = name => {
  const i = app.search(new RegExp('(?:async )?function ' + name + '\\('));
  assert.ok(i >= 0, 'missing ' + name);
  let depth = 0, quote = '', esc = false;
  for (let k = app.indexOf('{', i); k < app.length; k++) {
    const ch = app[k];
    if (quote) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === quote) quote = ''; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++; else if (ch === '}' && !--depth) return app.slice(i, k + 1);
  }
};

test('a quote box under a message no longer stretches the bubble above it', () => {
  assert.match(html, /\.msg\.them>\.col>\.bubble\{align-self:flex-start\}/);
});

test('douyin group members can each be called alone or merged', () => {
  const ctx = { Object };
  vm.runInNewContext(fn('dyGCallSolo') + '\nglobalThis.solo=dyGCallSolo;', ctx);
  assert.equal(ctx.solo({}, { k: 'c:1', cid: '1' }), true, 'roles default to their own call');
  assert.equal(ctx.solo({}, { k: 's1' }), false, 'strangers default to the merged call');
  assert.equal(ctx.solo({ callSolo: { 'c:1': false, s1: true } }, { k: 'c:1', cid: '1' }), false);
  assert.equal(ctx.solo({ callSolo: { 'c:1': false, s1: true } }, { k: 's1' }), true);
  const run = fn('dyGroupReplyRun');
  assert.match(run, /if\(dyGCallSolo\(g,m\)\)\{/);
  assert.match(run, /const crowd=cast\.filter\(x=>!dyGCallSolo\(g,x\)/);
  assert.match(fn('dyGroupInfoView'), /dyGRow\('模型调用',dyGCallSummary\(g\),`dyGCallSetup\('\$\{g\.id\}'\)`\)/);
});

test('a merged role is matched by nickname or real name', () => {
  const ctx = { String, cleanReply: v => String(v || ''), getC: id => ({ 1: { name: '克劳德', remark: '先生' } })[id], dyGMemberName: m => m.cid ? '先生' : m.name };
  vm.runInNewContext(fn('dyGCrowdParse') + '\nglobalThis.P=dyGCrowdParse;', ctx);
  const out = ctx.P([{ k: 'c:1', cid: '1' }, { k: 's1', name: '路人甲' }], '克劳德：都在呢\n路人甲：来了');
  assert.equal(out['c:1'], '都在呢');
  assert.equal(out.s1, '来了');
});
