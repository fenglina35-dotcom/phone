// SYNC_ROUNDS_V1 (2026-11-04): WeChat/calls and 共同生活/单次约会 shared only the last 30 rows each way (about 6 rounds).
// They now share the last N rounds (设置→聊天与媒体→线上线下互相同步, default 20, 2-60): a round is everything she says
// before he answers plus his one reply; a phone call counts as one round and keeps only its last ~1500 characters.
// The live scene is already in his own history, so in the shared timeline it is shortened (anchors kept whole).
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES, PRIV_DIR } from './_helpers.mjs';

for (const [label, file] of BUNDLES) {
  const src = read(file);
  const ctx = vm.createContext({ Math, Number, String, Object, Array, JSON, Set, S: { me: { name: '我' }, settings: {} } });
  for (const n of ['syncRoundsLimit', 'syncSceneRowCount', 'offlineIsUserMsg', 'lastRounds', 'offlineOnlineRoundRows', 'offlineOnlineTimelineRows', 'offlineTimelinePromptRows'])
    vm.runInContext(fnSource(src, n), ctx);
  assert.equal(ctx.syncRoundsLimit(), 20, `${label}: default 20 rounds`);
  ctx.S.settings.syncRounds = 99; assert.equal(ctx.syncRoundsLimit(), 60);
  ctx.S.settings.syncRounds = 3; assert.equal(ctx.syncRoundsLimit(), 3);

  const scene = { msgs: [] };
  for (let r = 1; r <= 5; r++) scene.msgs.push({ who: 'me', text: 'u' + r }, { who: 'me', text: 'u' + r + 'b' }, { who: '旁白', source: 'ta', text: 'n' + r }, { who: 'ta', text: 'a' + r });
  assert.equal(ctx.syncSceneRowCount(scene, 2), 8, `${label}: two scene rounds = her lines + narration + his reply`);

  const W = [];
  let t = 1_700_000_000_000;
  for (let r = 1; r <= 6; r++) { W.push({ role: 'user', content: 'q' + r, time: t += 60000 }, { role: 'assistant', content: 'a' + r, time: t += 1000 }); }
  for (let k = 0; k < 40; k++) W.push({ role: k % 2 ? 'assistant' : 'user', content: 'call' + k + '话'.repeat(90), _call: true, _cs: 'S1', time: t += 2000 });
  ctx.msgs = () => W; ctx.msgToText = (m) => m.content; ctx.callToCN = (x) => x; ctx.c = { id: 'r1', name: '他' };
  const rows = ctx.offlineOnlineRoundRows({ id: 'r1', name: '他' }, 3);
  const text = rows.map(x => x.text).join('|');
  assert.ok(text.includes('q5') && text.includes('a6') && !text.includes('q4'), `${label}: two WeChat rounds + the call = three rounds`);
  assert.ok(text.includes('call39') && !text.includes('call0话'), `${label}: a long call keeps only its latest part`);
  assert.ok(rows.filter(x => /^call/.test(x.text)).reduce((n, x) => n + x.text.length, 0) < 1700);

  const many = Array.from({ length: 400 }, (_, i) => ({ text: '字'.repeat(100), i }));
  const capped = ctx.offlineTimelinePromptRows(many, 30);
  assert.ok(capped.length > 150 && capped.length < 200, `${label}: timeline holds up to about 30000 characters`);

  assert.match(fnSource(src, 'offlineUnifiedTimelinePrompt'), /dedupe&&x\.active&&!x\.current&&x!==state\.previousUser&&x!==state\.previousRole/, `${label}: live scene shortened, anchors kept whole`);
  assert.match(src, /aria-label="线上线下互相同步轮数"/, `${label}: setting lives in 聊天与媒体`);
}
for (const f of ['cohab-theater.js', PRIV_DIR + 'cohab-theater.js'])
  assert.match(read(f), /cohabRecentContext=function\(d,c,limit\)\{\/\* SYNC_ROUNDS_V1/, `${f}: theater copy also counts rounds`);
console.log('sync rounds tests passed');
