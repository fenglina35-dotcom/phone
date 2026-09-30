import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// v1356 群管理：群主设最多 3 个管理员；管理员可禁言、踢除群主以外的任何人（v1358 起包括别的管理员）；
// 角色群里只有和我是情侣关系的管理员角色可以禁言我（不能踢我）。真人群只认群主发的管理员名单。
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
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
const load = extra => {
  const ctx = Object.assign({ S: { couple: { cid: 'couple' } }, Date, Object, Array, String }, extra || {});
  vm.runInNewContext([line('const GROUP_ADMIN_MAX='), fn('gmGroup'), fn('gmMeKey'), fn('gmOwnerKey'), fn('gmAdmins'), fn('gmMutes'), fn('gmIsOwner'), fn('gmIsAdmin'), fn('gmCanActOn'), 'globalThis.can=gmCanActOn;globalThis.admins=gmAdmins;'].join('\n'), ctx);
  return ctx;
};

test('role groups: admins manage members, only the couple admin may mute the owner, nobody kicks the owner', () => {
  const g = { id: 'g1', members: ['couple', 'helper', 'shy'], admins: ['couple', 'helper'] };
  const ctx = load({ S: { couple: { cid: 'couple' }, groups: [g] } });
  assert.equal(ctx.can('role', 'g1', 'helper', 'shy', 'mute'), true);
  assert.equal(ctx.can('role', 'g1', 'helper', 'shy', 'kick'), true);
  assert.equal(ctx.can('role', 'g1', 'helper', 'couple', 'mute'), true, 'admins can mute other admins too (v1358)');
  assert.equal(ctx.can('role', 'g1', 'helper', 'couple', 'kick'), true, 'admins can kick anyone except the owner (v1358)');
  assert.equal(ctx.can('role', 'g1', 'helper', 'me', 'mute'), false, 'a non-couple admin cannot mute the owner');
  assert.equal(ctx.can('role', 'g1', 'couple', 'me', 'mute'), true, 'the couple admin may mute the owner');
  assert.equal(ctx.can('role', 'g1', 'couple', 'me', 'kick'), false, 'nobody kicks the owner');
  assert.equal(ctx.can('role', 'g1', 'shy', 'helper', 'mute'), false, 'ordinary members have no power');
  assert.equal(ctx.can('role', 'g1', 'me', 'couple', 'kick'), true, 'the owner manages everyone');
  g.admins = ['a', 'b', 'c', 'd'];
  assert.equal(ctx.admins('role', 'g1').length, 3, 'at most three admins');
});

test('real-person groups only accept an admin list from the owner and admins cannot mute the owner', () => {
  const pref = {};
  const state = { id: 'SPOWNER001', groups: [{ group_id: 'PG1', owner_id: 'SPOWNER001', members: [] }] };
  const ctx = load({ phoneFriendState: () => state, pfGroupById: id => state.groups.find(g => g.group_id === id), pfGroupPref: () => pref, pfMsgPayload: m => JSON.parse(m.text), setTimeout: () => {}, save: () => {} });
  vm.runInNewContext(fn('pfAbsorbGroupManage') + '\nglobalThis.absorb=pfAbsorbGroupManage;', ctx);
  ctx.absorb('PG1', 'SPMEMB0001', { id: 'a', text: JSON.stringify({ type: 'group_admins', admins: ['SPMEMB0001'] }) });
  assert.equal((pref.admins || []).length, 0, 'forged admin list ignored');
  ctx.absorb('PG1', 'SPOWNER001', { id: 'b', text: JSON.stringify({ type: 'group_admins', admins: ['SPADMIN001'] }) });
  assert.deepEqual(Array.from(pref.admins), ['SPADMIN001']);
  ctx.absorb('PG1', 'SPADMIN001', { id: 'c', text: JSON.stringify({ type: 'group_mute', target: 'SPOWNER001', until: Date.now() + 60000 }) });
  assert.ok(!(pref.mutes && pref.mutes.SPOWNER001), 'admins cannot mute the owner');
  ctx.absorb('PG1', 'SPADMIN001', { id: 'd', text: JSON.stringify({ type: 'group_mute', target: 'SPMEMB0001', until: Date.now() + 60000 }) });
  assert.ok(pref.mutes.SPMEMB0001 > Date.now());
});

test('muted people cannot send and the management page replaces the old modals', () => {
  assert.match(fn('sendGroup'), /if\(gmMutedUntil\('role',id,'me'\)\)\{toast\('你已被禁言'\)/);
  assert.match(fn('renderGroupInfoPage'), /ginfoRow\('群管理','',`go\('gmanage',\{kind:'\$\{kind\}',id:'\$\{id\}'\}\)`\)/);
  assert.ok(!/onclick="phoneFriendGroupManage\(|onclick="groupInfo\(/.test(app), 'old group modals are no longer reachable');
  assert.match(fn('groupRoleReplyItems'), /content=groupRoleAdminTags\(g,c,content\)/);
});
