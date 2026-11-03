// ROLE_LITE_SYSTEM_V1 (2026-11-04): one- or two-line background features no longer send the full chat persona
// (often 10-20k characters). Agreed list: 日程提醒, 闹钟, 心情记录, 关系变化 (two calls), 突然查岗. 节日祝福 stays full.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES, PRIV_DIR } from './_helpers.mjs';

for (const [label, file] of BUNDLES) {
  const src = read(file);
  const ctx = vm.createContext({
    Math, Number, String, Object, Array, JSON, Date,
    S: { me: { name: '我' }, settings: { timeAware: true } },
    isMain: () => true, traitSpeechDesc: () => '\n说话短，爱逗人。', rolePriorityPrompt: () => '',
    affTone: () => '你们是恋人。', fmtDT: () => '2026年11月4日 21:00', roleSchedulePrompt: () => '\n你现在下班在家。',
    selectRelevantMemory: (c, q, n) => ({ items: [{ text: '她怕打雷' }], query: q, n }),
    memoryRetrievalPrompt: (c, m) => '\n\n# 本轮真正相关的记忆\n· ' + m.items.map(x => x.text).join('\n· '),
    lastRounds: (a, n) => a.slice(-n * 2), msgs: () => [{ role: 'user', content: '晚安' }, { role: 'assistant', content: '睡吧' }],
    msgToText: (m) => m.content,
  });
  vm.runInContext(fnSource(src, 'roleLiteSystem'), ctx);
  const c = { id: 'r1', name: '顾', remark: '先生', persona: '人设原文一字不改' };
  const lite = ctx.roleLiteSystem(c, { query: '打雷', wechat: true });
  for (const part of ['人设原文一字不改', '说话短，爱逗人', '「我」', '「先生」', '你们是恋人', '你现在下班在家', '她怕打雷', '我：晚安', '先生：睡吧', '一行一条'])
    assert.ok(lite.includes(part), `${label}: lite persona keeps ${part}`);
  assert.ok(!ctx.roleLiteSystem(c, { recent: false }).includes('最近聊天'), `${label}: recent chat can be left out`);

  const uses = (name) => /roleLiteSystem\(/.test(fnSource(src, name)) && !/buildSystem\(/.test(fnSource(src, name));
  for (const name of ['remindEvent', 'alarmPrepareCompanionText', 'recordTaMood', 'relAfterScene', 'relAutoLink'])
    assert.ok(uses(name), `${label}: ${name} uses the lite persona`);
  assert.match(fnSource(src, 'holidayGreet'), /buildSystem\(/, `${label}: holiday greeting keeps the full persona`);
}
for (const file of ['phone-shortcuts.js', PRIV_DIR + 'phone-shortcuts.js']) {
  const src = read(file);
  const gen = src.slice(src.indexOf('async function generate('), src.indexOf('async function generate(') + 900);
  assert.match(gen, /typeof roleLiteSystem==='function'\?roleLiteSystem\(x\.c/, `${file}: 突然查岗 uses the lite persona when present`);
}
console.log('role lite system tests passed');
