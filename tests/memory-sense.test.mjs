// MEMORY_SENSE_V1 (2026-11-05): memory recall only matched shared two-character pieces, so a reworded message found
// nothing (all five paraphrase examples scored 0). A related-phrase table now treats phrases in one group as the same
// thing; groups are specific so unrelated small talk still recalls nothing. The health check also tests whether the
// current route supports embeddings (for a later "find by meaning" step); it never changes settings.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES } from './_helpers.mjs';

for (const [label, file] of BUNDLES) {
  const src = read(file);
  const i = src.indexOf('const MEMORY_SENSE=[');
  assert.ok(i >= 0, `${label}: related-phrase table exists`);
  const ctx = vm.createContext({ S: { me: { name: '北' } }, aboutMeNoteText: (x) => x });
  vm.runInContext(src.slice(i, src.indexOf('];', i) + 2) + ';' + ['memoryText', 'memoryTerms', 'memoryAtoms', 'memoryTopics', 'memorySenses', 'memoryItemScore'].map(n => fnSource(src, n)).join('\n'), ctx);
  const recalls = (m, q) => ctx.memoryItemScore({ text: m, importance: 3 }, q, Date.now()) >= 2.6;
  for (const [m, q] of [['她喜欢喝冰美式', '我平时爱喝什么'], ['她怕打雷', '外面下雷雨了好吓人'], ['她不吃香菜', '这家店的菜都放芫荽'],
    ['她的猫叫团子', '我家主子今天又拆家了'], ['她下周三要面试', '我明天要去见工作的人'], ['她来姨妈会肚子疼', '我生理期到了'], ['她喜欢听周杰伦', '我想去看演唱会']])
    assert.ok(recalls(m, q), `${label}: 「${q}」 recalls 「${m}」`);
  const mems = ['她喜欢喝冰美式', '她怕打雷', '她不吃香菜', '她的猫叫团子', '她下周三要面试', '她妈妈腰不好', '她最近失眠'];
  for (const q of ['今天好累啊', '你在干嘛', '晚安', '我今天吃了火锅'])
    assert.ok(!mems.some(m => recalls(m, q)), `${label}: 「${q}」 does not drag up unrelated memories`);
  assert.match(src, /\{id:'embed',group:'模型',title:'按意思找记忆'\}/, `${label}: health check tests embeddings support`);
}
console.log('memory sense tests passed');
