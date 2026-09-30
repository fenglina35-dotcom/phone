import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1354 群聊改版：加号面板在输入框下面、情侣角色先回且按性格决定说不说、真实可扫的群二维码
// 只接受自己发出且未过期的令牌、聊天信息/加人/移出/查找都是独立页面。
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
const line = prefix => app.split('\n').find(l => l.startsWith(prefix)) || '';

test('group tool panels open below the input bar like one-to-one chat', () => {
  assert.match(html, /#gpanel,#pfgpanel\{order:2;flex:0 0 auto;\}/);
});

test('the couple role always replies first; shy roles may stay silent; chatty roles on their topic say more', () => {
  const ctx = { S: { couple: { cid: 'c' } } };
  vm.runInNewContext([line('const GROUP_QUIET_RE='), line('const GROUP_LIVELY_RE='), line('const GROUP_TOPIC_STOP='), fn('groupRoleTemper'), fn('groupRoleCares'), fn('groupReplyPlan'), 'globalThis.plan=groupReplyPlan;'].join('\n'), ctx);
  const members = [{ id: 'q', name: '阿言', persona: '社恐，内向，喜欢猫' }, { id: 'l', name: '小助手', persona: '话痨，喜欢游戏' }, { id: 'c', name: '克劳德', persona: '' }];
  for (const r of [0, 0.2, 0.5, 0.8, 0.99]) {
    const p = ctx.plan({ msgMin: 1, msgMax: 2 }, members, '今晚打游戏吗', () => r);
    assert.equal(p[0].c.id, 'c', 'couple role first for rand ' + r);
  }
  const high = ctx.plan({ msgMin: 1, msgMax: 2 }, members, '今晚打游戏吗', () => 0.5);
  const lively = high.find(x => x.c.id === 'l');
  assert.ok(lively && lively.cares && lively.cap === 3, 'chatty role on its topic may send up to 3');
  assert.ok(!high.some(x => x.c.id === 'q'), 'a shy role off-topic usually stays quiet');
  assert.match(fn('groupRoleReplyItems'), /if\(!opt\.first&&GROUP_SILENT_RE\.test\(content\)\)return\[\];/);
});

test('group QR codes round-trip, and only the issuer’s unexpired token triggers an invite', async () => {
  const invited = [];
  const state = { id: 'SPOWNER001', friends: [{ phone_id: 'SPSCAN0001' }], groups: [{ group_id: 'PG1', members: [{ phone_id: 'SPOWNER001' }] }], groupPrefs: {} };
  const ctx = {
    location: { origin: 'https://example.com', pathname: '/小手机.html', href: 'https://example.com/小手机.html' }, URL, Date, Object, Array, String, encodeURIComponent,
    phoneFriendState: () => state, save: () => {}, uid: () => 'abcdef123456789',
    pfGroupById: gid => state.groups.find(g => g.group_id === gid) || null,
    pfGroupMemberById: (g, id) => (g.members || []).find(m => m.phone_id === id) || null,
    phoneFriendById: id => state.friends.find(f => f.phone_id === id) || null,
    pfUnpack: s => { try { return JSON.parse(s); } catch (_) { return null; } },
    phoneFriendSendGroupInvites: async (gid, ids) => { invited.push(gid + ':' + ids.join(',')); },
    pfGroupInviteAccept: () => {}, setTimeout,
  };
  vm.runInNewContext([line('const GROUP_QR_DAYS='), fn('pfGroupPref'), fn('groupQrBase'), fn('groupQrPayload'), fn('groupQrParse'), fn('pfGroupJoinSend'), fn('pfGroupQrProcess'), 'globalThis.pay=groupQrPayload;globalThis.parse=groupQrParse;globalThis.proc=pfGroupQrProcess;'].join('\n'), ctx);
  const q = ctx.pay('pf', 'PG1'), parsed = ctx.parse(q.url);
  assert.equal(parsed.kind + parsed.id + parsed.from, 'pfPG1SPOWNER001');
  assert.ok(parsed.exp > Date.now() + 6 * 86400000);
  ctx.proc([{ id: 'x1', from_id: 'SPSCAN0001', body: JSON.stringify({ type: 'group_join_request', groupId: 'PG1', token: 'forged' }) }]);
  ctx.proc([{ id: 'x2', from_id: 'SPSCAN0001', body: JSON.stringify({ type: 'group_join_request', groupId: 'PG1', token: parsed.t }) }]);
  ctx.proc([{ id: 'x2', from_id: 'SPSCAN0001', body: JSON.stringify({ type: 'group_join_request', groupId: 'PG1', token: parsed.t }) }]);
  assert.deepEqual(invited, ['PG1:SPSCAN0001'], 'forged tokens and repeats never invite');
  assert.match(line('function pfIsGroupQrTransport'), /group_join_request/);
  assert.match(fs.readFileSync(new URL('../wechat-me.js', import.meta.url), 'utf8'), /if\(typeof groupQrParse==='function'&&groupQrParse\(raw\)\)\{wxScanStop\(\);groupQrScanResult\(raw\);return;\}/);
});

test('chat info, member picker, QR and search are standalone WeChat-style pages for both group kinds', () => {
  for (const page of ["c.p==='ginfo')html=renderGroupInfoPage", "c.p==='gpick')html=renderGroupPick", "c.p==='gqr')html=renderGroupQrPage", "c.p==='gsearch')html=renderGroupSearchPage"]) assert.ok(app.includes(page), page);
  assert.match(fn('renderGroup'), /onclick="ginfoOpen\('role','\$\{id\}'\)"/);
  assert.match(fn('renderPhoneFriendGroup'), /onclick="ginfoOpen\('pf','\$\{gid\}'\)"/);
  assert.match(html, /\.gpick-done\.on\{background:var\(--gi-green\)/);
  assert.match(html, /\.msg\.them\.gnamed>\.avatar/);
});
