// CARD_LINE_RECOVER_V1 与 SEARCH_MODEL_FALLBACK_V1。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import cp from 'node:child_process';

const PRIV = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read = (file) => process.env.FIX_TEST_OLD
  ? cp.execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8', maxBuffer: 64e6 })
  : fs.readFileSync(file, 'utf8');
function fnSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const head = src.slice(Math.max(0, start - 6), start) === 'async ' ? start - 6 : start;
  let depth = 0, opened = false;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') { depth += 1; opened = true; }
    if (src[i] === '}') { depth -= 1; if (opened && depth === 0) return src.slice(head, i + 1); }
  }
  throw new Error(`unterminated ${name}`);
}

for (const [label, file] of [['web', 'app.js'], ['private', PRIV + 'app.js']]) {
  const src = read(file);

  test(label + ' a transfer written with ¥ or 元 keeps its amount instead of becoming 0', () => {
    const ctx = vm.createContext({});
    vm.runInContext(fnSource(src, 'parsePayCardLine') + ';this.p=parsePayCardLine;', ctx);
    for (const line of ['[转账|¥520|爱你]', '[转账|520元|爱你]', '[红包|￥88|早点睡]', '[转账|520|爱你]']) {
      const r = ctx.p(line);
      assert.ok(r, line);
      assert.equal(r.amount, line.includes('88') ? 88 : 520, line);
    }
  });

  test(label + ' raw replies: a bare [骰子] rolls a die and a card sharing a line with words is split, not shown as text', () => {
    const made = [];
    const ctx = vm.createContext({
      normTag: (s) => s, privateSmartLockStripTags: (s) => s,
      lineToMsgs: (line) => { made.push(line); return /^\[骰子/.test(line) ? [{ type: 'dice' }] : /^\[转账/.test(line) ? [{ type: 'transfer' }] : [{ type: 'text', content: line }]; },
    });
    vm.runInContext(fnSource(src, 'modelUnfilteredMessages') + ';this.m=modelUnfilteredMessages;', ctx);
    assert.deepEqual(Array.from(ctx.m('[骰子]', {})).map((x) => x.type), ['dice']);
    assert.deepEqual(Array.from(ctx.m('[转账|520|爱你] 收着', {})).map((x) => x.type + (x.content ? ':' + x.content : '')), ['transfer', 'text:收着']);
    assert.deepEqual(Array.from(ctx.m('收着 [转账|520|爱你]', {})).map((x) => x.type + (x.content ? ':' + x.content : '')), ['text:收着', 'transfer']);
    assert.deepEqual(Array.from(ctx.m('今天好累', {})).map((x) => x.type + ':' + x.content), ['text:今天好累'], '普通话原样不动');
  });

  test(label + ' web search falls back to the chat model when jina cannot be reached', async () => {
    const calls = [];
    const ctx = vm.createContext({
      S: { settings: { search: { mode: 'jina', base: 'https://s.jina.ai' }, chat: { base: 'https://api.test/v1', key: 'k', model: 'm' } } },
      encodeURIComponent, JSON, String, Promise,
      fetchT: async (url) => { calls.push(url); if (url.includes('jina')) { const e = new Error('Fetch is aborted'); e.name = 'AbortError'; throw e; } return { ok: true, json: async () => ({ choices: [{ message: { content: '今天北京晴，12 到 20 度' } }] }) }; },
    });
    const helper = src.includes('async function webSearchModelFallback(') ? fnSource(src, 'webSearchModelFallback') : '';
    vm.runInContext(helper + fnSource(src, 'webSearch') + ';this.ws=webSearch;', ctx);
    const out = await ctx.ws('北京天气');
    assert.match(out, /^（jina 连不上，以下由聊天模型回答，可能不是最新）今天北京晴/);
    assert.ok(calls.some((u) => u.includes('/chat/completions')));
  });
}
