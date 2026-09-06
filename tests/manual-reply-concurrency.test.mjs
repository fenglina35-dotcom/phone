import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

assert.match(source, /const MANUAL_REPLY_LIMIT=2;/, 'manual reply concurrency must stay capped at two');
assert.match(source, /replyGenState==='queued'\?'排队中…'/, 'queued chats must show a visible queued state');

const calls = [];
const context = vm.createContext({
  replyPendingUserText:()=>'',
  msgsForAccount:()=>[],
  _replying: {},
  _replyQueue: [],
  MANUAL_REPLY_LIMIT: 2,
  actId: () => 'main',
  replyStateKey: (id, aid) => `${aid}|${id}`,
  getC: id => ({id, blocked: false, deleted: false}),
  offlineFocusActive: () => false,
  hasPendingVision: () => false,
  toast: () => {},
  cur: () => ({p: 'wechat'}),
  render: () => {},
});

vm.runInContext([
  source.slice(source.indexOf('const _replyHandoffClaims='),source.indexOf('const _roleBackgroundPending=')),
  functionSource('replyGenerationStore'),
  functionSource('replyGenerationKey'),
  functionSource('replyGenerationState'),
  functionSource('replyGenerationBusy'),
  functionSource('replyGenerationCount'),
  functionSource('replyGenerationRefresh'),
  functionSource('replyGenerationDrain'),
  functionSource('manualReply'),
].join('\n'), context);

context.replyGenerationRun = (id, aid) => {
  const key = context.replyGenerationKey(id, aid);
  context._replying[key] = {id, aid};
  calls.push(id);
};

assert.equal(context.manualReply('r1'), true);
assert.equal(context.manualReply('r2'), true);
assert.deepEqual(calls, ['r1', 'r2'], 'two different roles should start immediately');
assert.equal(context.replyGenerationCount(), 2);

assert.equal(context.manualReply('r3'), true);
assert.equal(context.replyGenerationState('r3'), 'queued');
assert.equal(context._replyQueue.length, 1, 'the third role should wait in the queue');
assert.equal(context.manualReply('r3'), false, 'a queued role must not be enqueued twice');
assert.equal(context._replyQueue.length, 1);

delete context._replying['main|r1'];
context.replyGenerationDrain();
assert.deepEqual(calls, ['r1', 'r2', 'r3'], 'the queued role should start when one slot is released');
assert.equal(context._replyQueue.length, 0);
assert.equal(context.replyGenerationCount(), 2);
assert.equal(context.manualReply('r2'), false, 'the same active role must not generate twice');
