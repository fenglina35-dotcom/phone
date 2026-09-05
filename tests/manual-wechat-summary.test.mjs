import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');

function functionSource(name) {
  const asyncStart = app.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; opened = true; }
    if (app[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

function makeSandbox(messages = [], initialState = { count: 0, cursorV2: true }) {
  const role = { id: 'c1', name: '先生', summaries: [], _accountSummaryState: { main: { ...initialState } } };
  const calls = { api: 0, confirm: 0, saved: 0, added: [], edited: 0, toasts: [] };
  let resolveApi = null;
  const sandbox = vm.createContext({
    Set,
    Array,
    String,
    S: { settings: { summaryModel: 'main' } },
    IMP_INSTR: '',
    memoryScopeKey: value => value || 'main',
    getC: id => id === 'c1' ? role : null,
    msgsForAccount: () => messages,
    summaryList: c => c.summaries,
    summaryState: c => c._accountSummaryState.main,
    summaryStateDone: (c, aid, all) => Math.max(0, Math.min(all.length, +c._accountSummaryState.main.count || 0)),
    summaryStateSave: (c, aid, upto, rows = messages) => {
      const anchor = upto > 0 && rows[upto - 1];
      c._accountSummaryState[aid] = { count: upto, cursorV2: true, lastMessageId: anchor?.id || '' };
    },
    msgToText: m => m.content || '',
    summaryUserLabel: () => 'North',
    summaryCleanText: (c, text) => text,
    perspRule: () => '',
    pruneSummaries() {},
    save: () => { calls.saved += 1; },
    editSummary: () => { calls.edited += 1; },
    toast: text => { calls.toasts.push(text); },
    uiConfirm: async () => { calls.confirm += 1; return true; },
    chatAPI: () => { calls.api += 1; return new Promise(resolve => { resolveApi = resolve; }); },
    rateAndText: value => ({ text: value, imp: 4 }),
    cleanReply: value => value,
    trimSentence: value => value,
    wechatSummarySystem: () => '',
    summaryPerspectiveValid: () => true,
    summaryStoreResult: (c, text, imp, prefix, aid) => {
      calls.added.push({ c, text, imp, prefix, aid });
      return 'added';
    },
  });
  vm.runInContext(`const _manualWechatSummaryBusy=new Set();\n${functionSource('manualWechatSummarySource')}\n${functionSource('manualWechatSummaryCanRepairClearedCursor')}\n${functionSource('manualWechatSummary')}\nthis.run=manualWechatSummary;`, sandbox);
  return { sandbox, role, calls, resolve: value => resolveApi(value) };
}

test('manual WeChat summary is exposed beside the existing model choice', () => {
  const ui = functionSource('editSummary');
  assert.match(ui, /手动总结/);
  assert.match(ui, /只整理尚未总结的新微信/);
  assert.match(ui, /manualWechatSummary\('\$\{id\}'\)/);
});

test('manual WeChat summary spends no model call when there is no new chat', async () => {
  const { sandbox, calls } = makeSandbox([]);
  assert.equal(await sandbox.run('c1'), false);
  assert.equal(calls.api, 0);
  assert.equal(calls.confirm, 0);
  assert.match(calls.toasts.join('\n'), /没有尚未总结的新微信/);
});

test('manual WeChat summary can recover an ambiguous cursor left by an older clear', async () => {
  const messages = [
    { id: 'new-u', role: 'user', content: '清空以后重新聊天。' },
    { id: 'new-a', role: 'assistant', content: '这次要记住。' },
  ];
  const { sandbox, role, calls, resolve } = makeSandbox(messages, { count: 2, cursorV2: true });
  const pending = sandbox.run('c1');
  for (let i = 0; i < 5 && calls.api === 0; i += 1) await new Promise(setImmediate);
  assert.equal(calls.confirm, 2, 'repair and paid summary each require explicit confirmation');
  assert.equal(calls.api, 1);
  assert.equal(role._accountSummaryState.main.count, 0, 'repair exposes current chat before the model succeeds');
  resolve('我记得North清空以后又重新和我聊天，也明确说希望这次的新内容能够继续被我认真记住。我会从现在的对话重新整理，不让旧进度再挡住新的共同记忆。');
  assert.equal(await pending, true);
  assert.equal(role._accountSummaryState.main.count, messages.length);
  assert.equal(role._accountSummaryState.main.lastMessageId, 'new-a');
});

test('manual WeChat summary excludes calls and system rows, saves once, and advances only after success', async () => {
  const messages = [
    { role: 'user', content: '我喜欢桂花。' },
    { role: 'assistant', content: '我记住了。' },
    { role: 'user', content: '系统行', type: 'sys' },
    { role: 'assistant', content: '电话行', _call: true },
  ];
  const { sandbox, role, calls, resolve } = makeSandbox(messages);
  const pending = sandbox.run('c1');
  for (let i = 0; i < 5 && calls.api === 0; i += 1) await new Promise(setImmediate);
  assert.equal(calls.api, 1);
  assert.equal(role._accountSummaryState.main.count, 0, 'cursor cannot advance before a real model result');
  const duplicate = await sandbox.run('c1');
  assert.equal(duplicate, false, 'a repeated tap cannot start another paid request');
  assert.equal(calls.api, 1);
  resolve('我记得North喜欢桂花，这是一件值得认真放在心上的小事。以后遇到桂花味的东西，我会自然想到North。');
  assert.equal(await pending, true);
  assert.equal(calls.added.length, 1);
  assert.equal(calls.added[0].aid, 'main');
  assert.equal(role._accountSummaryState.main.count, messages.length);
  assert.equal(calls.edited, 1);
});
