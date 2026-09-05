import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('v1184 web identity and cache markers are aligned', () => {
  const app = read('app.js');
  const shell = read('小手机.html');
  const sw = read('sw.js');
  const hotfix = read('web-hotfix.js');
  const index = read('index.html');
  const repair = read('repair.html');
  assert.match(app, /__NORTH_SHELL_BUILD__!=='1190'/);
  assert.match(app, /APP_VER='v1190 · 情侣空间聊天与软件监管版'/);
  assert.match(shell, /__NORTH_SHELL_BUILD__='1190'/);
  assert.match(shell, /app\.js\?v=1190&r=v1190-couple-watch-1/);
  assert.match(sw, /const BUILD='1190'/);
  assert.match(sw, /v1184-ios-web-crash-cohab-turn-keyboard-1/);
  assert.match(hotfix, /v1190-couple-watch-1/);
  assert.match(index, /小手机\.html\?v=1190/);
  assert.match(repair, /小手机\.html\?v=1190/);
});

test('v1184 publishes shared cohab memory and X comment controls', () => {
  const app = read('app.js');
  const privateCopy = read('native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'PhoneWeb.bundle', 'app.js');
  for (const source of [app, privateCopy]) {
    assert.match(source, /function cohabMemoryEnsureIds\(d\)/);
    assert.match(source, /function cohabMemoryRestoreScroll\(top\)/);
    assert.match(source, /function cohabMemorySetImp\(id,key,n\)/);
    assert.match(source, /function xNetCommentCustomOn\(\)/);
    assert.match(source, /开启自定义网友评论风格/);
    assert.match(source, /function xRegenerateRoleComment\(id,commentId\)/);
    assert.match(source, /\$\{cm\.authorLiked\?'取消赞':'作者赞'\}<\/span>\$\{xRoleCommentResetButton\(id,cm\)\}/);
  }
});
