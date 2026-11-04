// Remote control (2026-11-04):
// REMOTE_FACE_TO_FACE_V1: the role did not know his caption lines show on her screen, so they read like inner monologue.
//   Every line he speaks during remote control is now framed as said to her face, he sees what he already said this
//   session, and later chats remember what he said.
// REMOTE_DECISION_WAIT_V1: choosing which chats to open and the final delete/lock decision waited only 4-6 s (raised to
//   10 s inside chatAPI); a thinking model timed out and he opened no chat at all. All remote calls now wait 30 s.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, BUNDLES } from './_helpers.mjs';

for (const [label, file] of BUNDLES) {
  const src = read(file);
  const ctx = vm.createContext({ Math, Number, String, Object, Array, JSON, S: { me: { name: '我' } },
    factStamp: () => '今天', chatAPI: async (m, o) => o });
  for (const name of ['remoteControlAudienceNote', 'remoteControlSaidLines', 'remoteControlHistoryPrompt', 'remoteControlModelCall'])
    vm.runInContext(fnSource(src, name), ctx);
  const note = ctx.remoteControlAudienceNote();
  for (const part of ['实时显示在我手机屏幕最下方', '当面对我说', '用“你”称呼我', '不能写成心里话', '自言自语'])
    assert.ok(note.includes(part), `${label}: audience note says ${part}`);
  assert.match(ctx.remoteControlSaidLines({ actions: [{ roleLines: ['你跟谁聊这么晚？'] }] }), /已经当面对她说过[\s\S]*你跟谁聊这么晚？/);
  const mem = ctx.remoteControlHistoryPrompt({ remoteControlHistory: [{ ts: 1, actions: [{ memory: '查看了微信', roleLines: ['你跟谁聊这么晚？'] }] }] });
  assert.match(mem, /当时你当面对我说了：「你跟谁聊这么晚？」/, `${label}: later chats remember what he said`);

  const reaction = fnSource(src, 'remoteControlRoleReaction');
  assert.ok(reaction.startsWith('async function'), `${label}: reaction stays async`);
  assert.match(reaction, /const note=task\+'。'\+\(typeof remoteControlAudienceNote==='function'\?remoteControlAudienceNote\(\)\+remoteControlSaidLines\(ctl\):''\)/);
  assert.match(fnSource(src, 'remoteControlEnsureRoleCaption'), /当面对她说1到2句短话。'\+\(typeof remoteControlAudienceNote==='function'\?remoteControlAudienceNote\(\):''\)/);

  const opt = await ctx.remoteControlModelCall([], {}, 4800);
  assert.equal(opt.timeout, 30000, `${label}: remote decisions wait 30 s, not 4.8 s`);
}
console.log('remote face to face tests passed');
