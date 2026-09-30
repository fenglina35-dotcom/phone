import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1358 群聊：长按引用、拼手气红包按个数让大家抢、群转账先选收款方、管理员能管除群主外的任何人、名字和气泡往下挪。
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
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

test('lucky red packets split exactly, never below one cent', () => {
  const ctx = {};
  vm.runInNewContext(fn('rpSplitCents') + '\nglobalThis.split=rpSplitCents;', ctx);
  for (const [total, n] of [[1, 3], [0.05, 5], [200, 7], [6.66, 4]]) {
    for (const r of [() => 0, () => 0.999, Math.random]) {
      const parts = ctx.split(total, n, r);
      assert.equal(parts.length, n);
      assert.equal(Math.round(parts.reduce((a, b) => a + b, 0) * 100), Math.round(total * 100));
      assert.ok(parts.every(x => x >= 0.01), 'every share is at least 0.01');
    }
  }
});

test('each person grabs one share, the packet runs out at its count, and old single packets still work', () => {
  const bills = [];
  const ctx = { S: {}, Date, Math, Array, uid: () => 'u' + Math.random(), save: () => {}, gnm: (g, id) => id === 'me' ? 'North' : id, addBill: (...a) => bills.push(a) };
  vm.runInNewContext([fn('gRpState'), fn('gRpTake'), 'globalThis.take=gRpTake;globalThis.state=gRpState;'].join('\n'), ctx);
  const g = { msgs: [] };
  const m = { senderId: 'me', type: 'redpacket', amount: 1, count: 2, lucky: true, splits: [0.6, 0.4], grabs: [], time: 1 };
  assert.equal(ctx.take(g, m, 'a').amount, 0.6);
  assert.equal(ctx.take(g, m, 'a'), null, 'no double grab');
  assert.equal(ctx.take(g, m, 'me').amount, 0.4, 'the sender can grab their own group packet like WeChat');
  assert.equal(ctx.take(g, m, 'b'), null, 'no shares left');
  assert.ok(ctx.state(m).done && ctx.state(m).best === 0);
  assert.deepEqual(g.msgs.map(x => x.content), ['a领取了你的红包', '你领取了自己发的红包']);
  assert.equal(bills.length, 1);
  const legacy = { senderId: 'c1', type: 'redpacket', amount: 5, time: 1 };
  assert.equal(ctx.take(g, legacy, 'me').amount, 5);
  assert.ok(legacy.received && ctx.state(legacy).done);
});

test('admins can mute and kick anyone but the owner', () => {
  const g = { id: 'g1', members: ['couple', 'helper', 'shy'], admins: ['couple', 'helper'] };
  const ctx = { S: { couple: { cid: 'couple' }, groups: [g] }, Object, Array, String, Date };
  const line = p => app.split('\n').find(l => l.startsWith(p)) || '';
  vm.runInNewContext([line('const GROUP_ADMIN_MAX='), fn('gmGroup'), fn('gmMeKey'), fn('gmOwnerKey'), fn('gmAdmins'), fn('gmIsAdmin'), fn('gmCanActOn'), 'globalThis.can=gmCanActOn;'].join('\n'), ctx);
  assert.equal(ctx.can('role', 'g1', 'helper', 'couple', 'mute'), true);
  assert.equal(ctx.can('role', 'g1', 'helper', 'couple', 'kick'), true);
  assert.equal(ctx.can('role', 'g1', 'helper', 'me', 'mute'), false);
  assert.equal(ctx.can('role', 'g1', 'couple', 'me', 'kick'), false);
});

test('group long-press quotes, new pay pages and payTo transfers are wired in', () => {
  assert.match(fn('gbubble'), /ontouchstart="gqPressStart\('\$\{g\.id\}','\$\{m\.id\}'\)"/);
  assert.match(fn('gMsgMenu'), /^function gMsgMenu\(gid,mid\)\{if\(_lpFired\)\{_lpFired=false;return;\}/);
  assert.match(fn('sendGroup'), /q:q\|\|undefined/);
  assert.match(fn('renderGroup'), /onclick="groupRpSendOpen\('\$\{id\}'\)"/);
  assert.match(fn('renderGroup'), /onclick="groupPayPick\('role','\$\{id\}'\)"/);
  assert.ok(!/groupSendCard\('\$\{id\}'/.test(app), 'the old prompt() red packet is no longer reachable');
  assert.match(fn('phoneFriendGroupTransferModal'), /if\(type==='transfer'\)\{groupPayPick\('pf',gid\);return;\}/);
  assert.match(fn('pfReceivePay'), /if\(pay\.payTo&&String\(pay\.payTo\)\.toUpperCase\(\)!==String\(p\.id\|\|''\)\.toUpperCase\(\)\)/);
  assert.ok(app.includes("c.p==='grpSend')html=renderGroupRpSend(c)"));
  assert.match(fn('renderRpDetail'), /if\(r&&\(r\.scope==='group'\|\|r\.lucky\)\)return renderGroupRpDetail\(r\);/);
  assert.match(html, /\.msg\.them\.gnamed>span:first-child\{margin-top:2px\}/);
});

test('real-person lucky packets: every phone orders the hidden grabs the same way and money follows the confirmed rank', () => {
  const bills = [];
  const state = { id: 'SPME000001', groupMessages: { PG1: [{ id: 'R1', from: 'SPAAAA0001', text: 'pay', time: 1 }] }, rpGrabs: {}, rpCredited: {} };
  const pay = { type: 'redpacket', amount: 3, count: 2, lucky: true, splits: [2, 1] };
  const ctx = { phoneFriendState: () => state, pfMsgList: (s, k) => (s && s[k]) || [], pfMsgPayload: m => m.text === 'pay' ? pay : JSON.parse(m.text), pfNameById: id => id, phoneFriendById: () => null, pfGroupById: () => null, pfGroupMemberById: () => null, pfGroupMemberName: () => '', addBill: (...a) => bills.push(a), String, Math, Array, Date, Object };
  vm.runInNewContext(['pfIsRpGrabTransport', 'pfRpGrabStore', 'pfAbsorbRpGrab', 'pfRpName', 'pfRpFind', 'pfRpLucky', 'pfRpState', 'pfRpSettle'].map(fn).join('\n') + '\nglobalThis.absorb=pfAbsorbRpGrab;globalThis.st=pfRpState;', ctx);
  const grab = (id, from, time) => ctx.absorb('PG1', from, { id, text: JSON.stringify({ type: 'rp_grab', mid: 'R1' }), time });
  grab('local_x', 'SPME000001', 50);
  assert.equal(bills.length, 0, 'no money before the server confirms the grab');
  grab('s1', 'SPME000001', 30);
  assert.deepEqual(bills.map(b => b[0] + b[1]), ['in2']);
  grab('s0', 'SPBBBB0001', 20);
  const s = ctx.st(state.groupMessages.PG1[0], pay);
  assert.deepEqual(Array.from(s.grabs, x => x.who + ':' + x.amount), ['SPBBBB0001:2', 'SPME000001:1']);
  assert.deepEqual(bills.map(b => b[0] + b[1]), ['in2', 'out1'], 'a late earlier grab moves me down and the difference is corrected');
  grab('s2', 'SPCCCC0001', 40);
  assert.ok(ctx.st(state.groupMessages.PG1[0], pay).done);
  assert.match(fn('pfStoreGroupMessage'), /if\(pfIsRpGrabTransport\(kept\)\)\{pfAbsorbRpGrab\(gid,from,kept\);return false;\}/);
  assert.match(fn('phoneFriendGroupTransferModal'), /if\(type==='redpacket'\)\{groupRpSendOpen\(gid,'pf'\);return;\}/);
});
