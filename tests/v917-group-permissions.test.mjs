import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(
  new URL('../supabase/migrations/202608140001_phone_friend_group_disband.sql', import.meta.url),
  'utf8',
);

// 2026-11-02 她改了主意：AI 群聊里的消息（包括角色说的）可以编辑，菜单里不放 emoji（GROUP_MSG_EDIT_V1）。
test('AI group message menu can edit and shows no emoji', () => {
  const start = app.indexOf('function gMsgMenu(gid,mid)');
  const end = app.indexOf('function gDelOne(', start);
  assert.ok(start >= 0 && end > start);
  const menu = app.slice(start, app.indexOf('/* GROUP_MSG_EDIT_V1', start));
  assert.match(menu, /gEditMsg\('\$\{gid\}','\$\{mid\}'\)">编辑/);
  assert.doesNotMatch(menu, /\p{Extended_Pictographic}/u);
  assert.match(menu, /gForwardOne/);
  assert.match(menu, /gRecallMsg/);
  assert.match(menu, /gDelOne/);
});

test('only the real group owner is shown the disband control', () => {
  assert.match(app, /pfGroupIsOwner\(g\)\?`<div class="it danger" onclick="phoneFriendDisbandGroup/);
  assert.match(app, /function phoneFriendDisbandGroup\(gid\)/);
  assert.match(app, /phone_friend_group_disband/);
  assert.match(app, /if\(!g\|\|!pfGroupIsOwner\(g\)\)/);
});

test('server disband verifies owner and atomically removes all group data', () => {
  assert.match(migration, /create or replace function public\.phone_friend_group_disband/);
  assert.match(migration, /public\.phone_friend_check\(v_owner, p_secret\)/);
  assert.match(migration, /owner_id = v_owner[\s\S]*for update/);
  assert.match(migration, /delete from public\.phone_friend_message_recalls/);
  assert.match(migration, /delete from public\.phone_friend_groups/);
  assert.match(migration, /grant execute[\s\S]*anon, authenticated/);
});
