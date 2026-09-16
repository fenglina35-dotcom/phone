import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 用户报告：真人好友的撤回"功能没有了"——原先点气泡会弹出撤回，现在点了没反应。
// 核查：撤回的实现（phoneFriendRecallMessage）、时间戳旁的小按钮和云端调用一直都在，
// 真正缺的是气泡上的点击入口。气泡内的「收藏」「撤回」一直写着 event.stopPropagation()，
// 正是"外层应当有一层菜单"的残留证据。

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const lines = app.split('\n');
const block = name => {
  const start = lines.findIndex(l => l.startsWith(`function ${name}(`) || l.startsWith(`async function ${name}(`));
  assert.ok(start >= 0, `missing ${name}`);
  let depth = 0;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    out.push(lines[i]);
    for (const ch of lines[i]) { if (ch === '{') depth++; else if (ch === '}') depth--; }
    if (i > start && depth <= 0) break;
    if (i === start && depth === 0) break;
  }
  return out.join('\n');
};

test('单聊和群聊的气泡都挂上了消息操作入口', () => {
  assert.match(app, /<div class="col" onclick="pfMsgMenu\('\$\{m\.id\}','friend','\$\{id\}'\)">/, '真人好友单聊');
  assert.match(app, /<div class="col" onclick="pfMsgMenu\('\$\{m\.id\}','group','\$\{gid\}'\)">/, '真人好友群聊');
  // 挂在 .col 上而不是整行：群聊头像有长按@和双击拍一拍，不能被菜单抢走
  assert.doesNotMatch(app, /<div class="msg \$\{me\?'me':'them'\}" onclick="pfMsgMenu/);
});

test('菜单按消息归属给出正确的操作', () => {
  const opened = [];
  const ctx = {
    String, Object, Array, JSON, Promise,
    openModal: html => opened.push(html),
    closeModal: () => {},
    toast: () => {},
    copyTextCompat: () => true,
    pfMsgList: (store, key) => (store && store[key]) || [],
    pfMsgPayload: m => { try { const v = JSON.parse(String(m && m.text || '')); return v && v.type ? v : null; } catch (_) { return null; } },
    pfSaveSticker: () => {},
    phoneFriendRecallMessage: () => {},
  };
  const mine = { id: 'm1', from: 'AAA', text: '晚安' };
  const theirs = { id: 'm2', from: 'BBB', text: JSON.stringify({ type: 'sticker', img: 'https://x/y.png' }) };
  const pendingMine = { id: 'local_9', from: 'AAA', text: '刚发的' };
  const recalled = { id: 'm3', from: 'AAA', text: '', recalled: true };
  ctx.phoneFriendState = () => ({ id: 'AAA', messages: { BBB: [mine, theirs, pendingMine, recalled] }, groupMessages: {} });
  vm.runInNewContext(block('pfMsgMenu') + '\n' + block('pfCopyMsgText') + '\nglobalThis.menu=pfMsgMenu;', ctx);

  ctx.menu('m1', 'friend', 'BBB');
  assert.match(opened.at(-1), /撤回这条消息/, '自己的消息能撤回');
  assert.match(opened.at(-1), /复制文字/);
  assert.doesNotMatch(opened.at(-1), /收藏这个表情/);

  ctx.menu('m2', 'friend', 'BBB');
  assert.match(opened.at(-1), /收藏这个表情/, '对方的表情能收藏');
  assert.doesNotMatch(opened.at(-1), /撤回这条消息/, '不能撤回别人的消息');

  ctx.menu('local_9', 'friend', 'BBB');
  assert.match(opened.at(-1), /这条还在发送/, '未同步的消息要说清为什么撤不了');

  const before = opened.length;
  ctx.menu('m3', 'friend', 'BBB');
  assert.equal(opened.length, before, '已撤回的消息不再弹菜单');
  ctx.menu('nope', 'friend', 'BBB');
  assert.equal(opened.length, before, '找不到的消息不弹菜单');
});

test('撤回的实现本身没有被动过', () => {
  const src = block('phoneFriendRecallMessage');
  assert.match(src, /found\.recalled=true/);
  assert.match(src, /phone_friend_recall_message/, '仍然同步到云端');
  assert.match(src, /消息还在发送，稍后再撤回/);
  assert.match(app, /class="pfrecall"/, '时间戳旁边那颗小按钮保留，两条路都能撤回');
});
