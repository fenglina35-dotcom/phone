import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 三份用户报告：
//  ① 后台消息像接力赛，同一条用户消息被反复调用模型，每一次都以为是第一次开口，
//     消息只到锁屏通知、进不了聊天。
//  ② 外语语音条下面同时显示外语原文和中文翻译，只想要翻译。
//  ③ 角色决定“这次不说话”，结果 [保持安静] 被当成一句话发了出来。
// 同时：「模型原文输出」升为全局默认，开关移除。

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const lines = app.split('\n');
const one = name => {
  const found = lines.find(l => l.startsWith(`function ${name}(`) || l.startsWith(`async function ${name}(`));
  assert.ok(found, `missing ${name}`);
  return found;
};

test('① 本地已回过的接力，确认收件时一并取消服务器任务', () => {
  // 以前只 queueAck，服务器任务留着，租约每两分钟到期就重新领走、重新调一次模型。
  assert.match(app, /if\(handoffState==='completed'\)\{if\(await persistWechatMessagesNow\(\)\)\{queueAck\(row,true\);if\(handoff\)replyHandoffCancelRemote\(handoff\);else roleBackgroundCancel\(c\.id,\['reply_handoff'\]\);\}continue;\}/);
  assert.doesNotMatch(app, /handoffState==='completed'\)\{if\(await persistWechatMessagesNow\(\)\)queueAck\(row,true\);continue;\}/);
});

test('① 送不进去时先停掉服务器那一侧，消息本体不确认收件、留着补送', () => {
  assert.match(app, /if\(roleServerPushDeliveryBlocked\(c\.id\)\)\{roleServerPushSyncSoon\(c\.id\);roleServerPushHoldHandoff\(c,handoffPeek\(c,row\)\);continue;\}/);
  // 关键：这一支仍然不能 queueAck，否则角色说的话就真的丢了
  const branch = app.match(/if\(roleServerPushDeliveryBlocked\(c\.id\)\)\{[^}]*\}/)[0];
  assert.doesNotMatch(branch, /queueAck/, '被拦下的消息不能确认收件，否则内容会丢');
});

test('① 同一条接力只向服务器取消一次，轮询不会打成请求风暴', () => {
  const cancels = [];
  const ctx = {
    Set, String,
    replyHandoffCancelRemote: t => cancels.push('turn:' + t.key),
    roleBackgroundCancel: id => cancels.push('role:' + id),
  };
  vm.runInNewContext(
    lines.find(l => l.startsWith('const _handoffHeldCancelled=')) + '\n' + one('roleServerPushHoldHandoff') +
    '\nglobalThis.hold=roleServerPushHoldHandoff;', ctx);
  const c = { id: 'r1' }, turn = { key: 'r1|main|m9' };
  assert.equal(ctx.hold(c, turn), true);
  assert.equal(ctx.hold(c, turn), false, '每分钟一次的轮询不能反复发取消');
  assert.equal(ctx.hold(c, turn), false);
  assert.deepEqual([...cancels], ['turn:r1|main|m9']);
  // 没有接力信息时退回按角色取消
  assert.equal(ctx.hold({ id: 'r2' }, null), true);
  assert.deepEqual([...cancels], ['turn:r1|main|m9', 'role:r2']);
});

test('① 服务器端有重跑上限兜底，不会无限调用模型', () => {
  const sql = fs.readFileSync(
    new URL('../supabase/migrations/202609170001_background_task_attempt_ceiling.sql', import.meta.url), 'utf8');
  assert.match(sql, /and attempts < 3/, '领取时必须检查重跑次数');
  assert.match(sql, /phone_role_background_retire_exhausted/, '用尽次数的任务要退休，不能永远挂着');
  assert.match(sql, /status = 'claimed', claimed_until = now\(\) \+ interval '2 minutes'/, '其余领取语义不变');
});

test('② 语音条只显示中文翻译，不再把外语原文也铺出来', () => {
  assert.match(app, /\$\{m\.showText\?`<div class="vtext" style="\$\{voiceTranslationLook\(c,me\)\}">\$\{esc\(m\.trans\|\|m\.content\)\}<\/div>`:''\}/);
  assert.doesNotMatch(app, /\$\{esc\(m\.content\)\}\$\{m\.trans\?'<br><span>译：'/, '不能再同时画原文和译文');
  // 发声用的仍然是 m.content，改动只在显示层
  assert.ok(app.includes('await ttsArr(m.content,o,{cue:m.voiceCue})'), '语音合成仍然读原文，声音不受影响');
});

test('③ [保持安静] 是要执行的决定，三条路都不再把它当成一句话', () => {
  const ctx = { String, RegExp, roleReplyEnglishOnly: () => false, wechatReasoningLeak: () => false, modelOutputUnfiltered: () => true };
  vm.runInNewContext([one('roleServerPushUnsafeBody'), one('roleServerPushVisibleBody')].join('\n') +
    '\nglobalThis.v=roleServerPushVisibleBody;', ctx);
  assert.equal(ctx.v('[保持安静]'), '', '服务器推送：整条沉默就是不发');
  assert.equal(ctx.v('【保持安静】'), '');
  assert.equal(ctx.v('[不说话]'), '');
  assert.equal(ctx.v('嗯？\n[保持安静]'), '嗯？', '只抹掉那一行，说过的话留着');
  assert.equal(ctx.v('今天好累。'), '今天好累。', '正常内容一个字不动');

  // 通话与微信两条路不再挂在原文输出开关后面
  assert.match(app, /if\(wechatNaturalOn\(\)\)content=String\(content\|\|''\)\.replace\(\/\[\\\[【\]\\s\*\(\?:保持安静\|不说话\)/);
  assert.doesNotMatch(app, /!_rawOutput&&wechatNaturalOn\(\)\)content=String/);
  assert.match(app, /if\(_autonomyNote\)\{if\(wechatNaturalSilentDecision\(content,note\)\)\{/);
  assert.doesNotMatch(app, /!_rawOutput&&_autonomyNote\)\{if\(wechatNaturalSilentDecision/);
});

test('模型原文输出已是全局默认，设置里不再有这个开关', () => {
  assert.equal(new Function(one('modelOutputUnfiltered') + ';return modelOutputUnfiltered();')(), true);
  assert.doesNotMatch(app, /modelOutputUnfilteredToggle/, '开关与切换函数都要移除');
  assert.doesNotMatch(app, /S\.settings\.modelOutputUnfiltered/, '不再读写这个设置项');
  assert.doesNotMatch(app, /模型原文输出（实验）/, '设置页不再显示这一行');
});
