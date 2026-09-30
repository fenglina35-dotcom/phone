import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1362 角色群：单独/合并调用模型、角色想发就发红包转账（可设个数、可转给群友）、禁言我之后私聊发微信并能放我出来、公开版配对码网络失败会重试。
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const pub = fs.readFileSync(new URL('../public-north-runtime.js', import.meta.url), 'utf8');
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

test('couple role calls alone by default, others are merged, and the choice is per role', () => {
  const ctx = { S: { couple: { cid: 'c' } }, Object };
  vm.runInNewContext(fn('gCallSolo') + '\nglobalThis.solo=gCallSolo;', ctx);
  assert.equal(ctx.solo({}, 'c'), true);
  assert.equal(ctx.solo({}, 'x'), false);
  assert.equal(ctx.solo({ callSolo: { c: false, x: true } }, 'c'), false);
  assert.equal(ctx.solo({ callSolo: { c: false, x: true } }, 'x'), true);
  assert.match(fn('aiGroupReplyRun'), /route:typeof roleChatRouteIndex==='function'\?roleChatRouteIndex\(c\):null/);
  assert.match(fn('groupRoleReplyItems'), /opt\.route!=null\?\{routeIndex:opt\.route,independentRoleModel:true\}/);
});

test('one merged reply is split back to each role by 【名字】 headers', async () => {
  const g = { id: 'g', members: ['a', 'b', 'q'], msgs: [], admins: [] };
  const people = { a: { id: 'a', name: '小助手' }, b: { id: 'b', name: '阿言' }, q: { id: 'q', name: '路人' } };
  const ctx = {
    S: { me: { name: 'North' } }, Map, String, Math, GROUP_SILENT_RE: /[\[【]\s*(?:不说话|不回|沉默|潜水)\s*[\]】]/,
    gnm: (g, id) => people[id].name, gContext: () => '', roleVisibleEnvelopeText: x => x,
    chatAPI: async () => '【小助手】\n哈哈我来了\n又是我\n【路人】\n不该算给小助手\n【阿言】\n[不说话]',
    groupRoleReplyNickname: x => x, groupRoleAdminTags: (g, c, x) => x,
    gParseReply: content => content.split('\n').filter(Boolean).map(t => ({ type: 'text', content: t })),
  };
  vm.runInNewContext([fn('gBatchNames'), fn('gBatchPrompt'), fn('groupBatchReplyItems'), 'globalThis.run=groupBatchReplyItems;'].join('\n'), ctx);
  const why = [];
  const out = await ctx.run(g, [{ c: people.a, cap: 2 }, { c: people.b, cap: 1 }], [], why);
  assert.deepEqual(Array.from(out.get('a'), x => x.content), ['哈哈我来了', '又是我']);
  assert.equal(out.has('b'), false, 'a role that chose silence sends nothing');
});

test('roles may set a red packet count and pay another member', () => {
  const g = { members: ['x', 'y'] };
  const ctx = { S: { me: { name: 'North' } }, GRP_MAX_COUNT: 100, String, parseInt, getC: id => ({ x: { name: '小助手' }, y: { name: '阿言' } })[id], gnm: (g, id) => ({ x: '小助手', y: '阿言' })[id] };
  vm.runInNewContext(fn('gPayExtras') + '\nglobalThis.ex=gPayExtras;', ctx);
  const rp = ctx.ex({ type: 'redpacket', amount: 6, note: '大家抢|3' }, g);
  assert.equal(rp.count, 3); assert.equal(rp.note, '大家抢');
  const tf = ctx.ex({ type: 'transfer', amount: 5, note: '给你的|阿言' }, g);
  assert.equal(tf.to, 'y');
  assert.equal(ctx.ex({ type: 'transfer', amount: 5, note: '给你|North' }, g).to, 'me');
});

test('a role that mutes me messages me privately and can release me with [群解禁]', () => {
  assert.match(fn('gmMute'), /if\(target==='me'&&until&&actor!=='me'&&getC\(actor\)\)gmMuteDM\(id,actor\);/);
  assert.match(fn('gmMuteDM'), /scheduleFeatureReply\(cid,featureEventNote\('你在群里禁言了'/);
  assert.match(app, /content=applyControlTags\(content,c,id,_statedPwd,_userText,_replyActionOutcome\);content=applyGroupUnmuteTag\(content,c\);/);
  assert.match(app, /\+_thoughtTurnPrompt\+_usageTruth\+wxGroupMutePrompt\(c\),_sys=/);
  assert.match(fn('applyGroupUnmuteTag'), /gmMute\('role',hit\.g\.id,c\.id,'me',0\)/);
});

test('public pairing retries once on Safari "Load failed" and explains the network problem', () => {
  assert.match(pub, /if\(attempt>=1\)throw Error\('连不上配对服务器（网络中断或被拦截）/);
});
