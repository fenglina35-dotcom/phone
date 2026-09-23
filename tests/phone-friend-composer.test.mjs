import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* 她说「真人好友的键盘聊天框，能不能用和角色的那种，功能不用，就是聊天框和角色的
   那种会看着舒服一点，功能不会在聊天框的上面，而是在聊天框的下面弹出来，
   跟那个微信角色的一样就行」。

   之前单聊那边还留着最早那版：一个光秃秃的 ＋ 号 + 老的 .panel（一条矮条贴在框上），
   而好友【群聊】早就换成了和微信角色同一套 chat-inputbar + chat-tools-panel。
   这条测试卡住单聊也走同一套。 */

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const priv = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(new URL('../glass-theme.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const lines = s => s.split('\n');
const block = (src, name) => {
  const ls = lines(src);
  const start = ls.findIndex(l => l.startsWith(`function ${name}(`) || l.startsWith(`async function ${name}(`));
  assert.ok(start >= 0, `找不到 ${name}`);
  let end = start + 1;
  while (end < ls.length && !/^(?:async )?function |^const |^let /.test(ls[end])) end += 1;
  return ls.slice(start, end).join('\n');
};

for (const [label, src] of [['网页版', app], ['私人版', priv]]) {
  test(`${label}：真人好友单聊用的是和角色一样的聊天框`, () => {
    const render = block(src, 'renderPhoneFriendChat');
    assert.match(render, /groupComposerHTML\('pffriend',id,'pf_input'/, '输入栏要复用角色那一套');
    assert.equal(/<span class="plus"/.test(render), false, '老那个光秃秃的 ＋ 号撤掉了');
    assert.equal(/phoneFriendPanelToggle\('pfpanel'\)/.test(render), false, '老的面板开关也撤掉了');
    /* 复用之后自然就有语音／表情／功能三个键和发送键 */
    const composer = block(src, 'groupComposerHTML');
    for (const k of ['chat-voice-toggle', 'chat-emoji-toggle', 'chat-function-toggle', 'chat-send'])
      assert.ok(composer.includes(k), '少了 ' + k);
  });

  test(`${label}：功能面板是从下面弹出来的整块，不是压在框上的一条`, () => {
    const panel = block(src, 'pfPanelHTML');
    assert.match(panel, /class="panel chat-tools-panel group-chat-tools" id="pfpanel" data-page="fn"/);
    assert.match(panel, /chat-function-pane/, '要有功能页');
    assert.match(panel, /chat-emoji-pane/, '要有表情页');
    assert.equal(/class="pgrid"/.test(panel), false, '老那套矮条布局撤掉了');
    /* 功能项还是好友自己的那几个——她说「功能不用」照搬角色的 */
    for (const k of ['相册', '转账', '红包', '添加表情', '批量添加'])
      assert.ok(panel.includes(k), '好友自己的功能项少了 ' + k);
    assert.equal(/拍一拍/.test(panel), false, '单聊没有拍一拍，别把群聊那套抄过来');
  });

  test(`${label}：好友单聊也认语音模式`, () => {
    const send = block(src, 'sendPhoneFriend');
    assert.match(send, /groupComposerVoiceOn\('pffriend',id\)/);
    assert.match(send, /voice\?pfPack\(\{type:'voice',text/, '开了语音就发语音条');
    assert.match(send, /chatComposerStateSync\(ta\)/, '发完要把输入框高度收回去');
    assert.match(block(src, 'groupComposerVoiceToggle'), /scope==='pffriend'\?'发消息…'/,
      '关掉语音之后占位文案要回到好友单聊那句');
  });
}

test('好友单聊那一页本来就挂着角色聊天的皮肤，样式才对得上', () => {
  assert.match(app, /\['chat','pfchat','pfgroup','group'\]\.includes\(c\.p\)\?' wx-chat-premium'/);
  assert.match(css, /\.wx-chat-premium>\.chat-tools-panel\{height:\d+px/, '面板要有键盘那么高');
  assert.match(css, /\.wx-chat-premium>\.chat-inputbar\{/, '输入栏的皮肤也在这一套里');
});
