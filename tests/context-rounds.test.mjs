// Context is counted by rounds (2026-11-04).
// A round = everything the user says before the role answers + the role's one reply (any number of bubbles,
// lines or narration). Applies to WeChat and 共同生活 / 单次约会. Calls keep the current call whole first.
// Bug: in a truth-or-dare phone call the user asked ten questions and the role said she had asked two,
// because every spoken line was one row and the call history stopped at 48 rows / 12000 characters.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES } from './_helpers.mjs';

for (const [label, file] of BUNDLES) {
  const src = read(file);
  const ctx = vm.createContext({ Array, Math, Number, String, Object });
  for (const name of ['callPromptHistory', 'lastRounds', 'offlineIsUserMsg', 'offlineIsAssistantMsg',
    'offlineMsgContent', 'offlinePendingStart', 'offlineHistoryMessages']) vm.runInContext(fnSource(src, name), ctx);

  // Phone call: older WeChat first, then ten questions, each answered in four separate spoken lines.
  const hist = [];
  for (let i = 0; i < 60; i++) hist.push({ role: i % 2 ? 'assistant' : 'user', content: `wechat-${i}-` + '聊'.repeat(300) });
  for (let q = 1; q <= 10; q++) {
    hist.push({ role: 'user', content: `第${q}个问题：真心话，你最怕什么？` });
    for (let l = 1; l <= 4; l++) hist.push({ role: 'assistant', content: `回答${q}-${l}：` + '嗯'.repeat(60) });
  }
  const sent = ctx.callPromptHistory(hist);
  const text = sent.map(r => r.content).join('\n');
  for (let q = 1; q <= 10; q++) assert.ok(text.includes(`第${q}个问题`), `${label}: call question ${q} reaches the model`);
  for (let l = 1; l <= 4; l++) assert.ok(text.includes(`回答1-${l}`), `${label}: every line of the role's first reply is kept`);
  assert.ok(sent.reduce((n, r) => n + r.content.length, 0) <= 40000, `${label}: call history keeps a safety budget`);
  for (let i = 1; i < sent.length; i++) {
    if (sent[i].role !== 'system') assert.notEqual(sent[i].role, sent[i - 1].role, `${label}: same-speaker lines are merged`);
  }
  assert.equal(hist[60].content, '第1个问题：真心话，你最怕什么？', `${label}: stored rows are not mutated`);

  // WeChat: five messages in a row before he answers are one round; his three bubbles belong to it.
  const t0 = 1_700_000_000_000;
  const wx = [
    { role: 'user', content: 'old-q', time: t0 }, { role: 'assistant', content: 'old-a', time: t0 + 5000 },
    { role: 'user', content: 'prev-q', time: t0 + 60000 }, { role: 'assistant', content: 'prev-a', time: t0 + 65000 },
    ...[1, 2, 3, 4, 5].map(i => ({ role: 'user', content: 'now-' + i, time: t0 + 120000 + i * 1000 })),
    ...[1, 2, 3].map(i => ({ role: 'assistant', content: 'reply-' + i, time: t0 + 130000 + i * 1000 })),
  ];
  const two = ctx.lastRounds(wx, 2).map(m => m.content);
  assert.deepEqual(two, ['prev-q', 'prev-a', 'now-1', 'now-2', 'now-3', 'now-4', 'now-5', 'reply-1', 'reply-2', 'reply-3'],
    `${label}: consecutive user messages count as one WeChat round`);
  // A message he sends on his own, long after his last reply, is a round of its own.
  const pro = wx.concat([{ role: 'assistant', content: 'proactive', time: t0 + 130000 + 20 * 60000 }]);
  assert.deepEqual(ctx.lastRounds(pro, 2).map(m => m.content), ['now-1', 'now-2', 'now-3', 'now-4', 'now-5', 'reply-1', 'reply-2', 'reply-3', 'proactive'],
    `${label}: a proactive message counts as one round`);

  // 共同生活 / 单次约会: limit counts rounds.
  const date = { msgs: [
    { who: 'me', text: 'u1' }, { who: 'ta', text: 'a1' },
    { who: 'me', text: 'u2' }, { who: 'me', text: 'u2b' }, { who: '旁白', source: 'ta', text: 'n2' }, { who: 'ta', text: 'a2' },
    { who: 'me', text: 'u3' }, { who: 'ta', text: 'a3' }, { who: 'ta', text: 'a3b' },
  ] };
  assert.deepEqual(Array.from(ctx.offlineHistoryMessages(date, 2), x => x.content), ['u2\nu2b', '【n2】\na2', 'u3', 'a3\na3b'],
    `${label}: cohab context keeps two whole rounds`);
}
console.log('context rounds tests passed');
