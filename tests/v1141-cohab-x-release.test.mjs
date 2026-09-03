import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('v1159 web identity and cache markers are aligned', () => {
  const app = read('app.js');
  const shell = read('小手机.html');
  const sw = read('sw.js');
  const hotfix = read('web-hotfix.js');
  const index = read('index.html');
  const repair = read('repair.html');
  assert.match(app, /__NORTH_SHELL_BUILD__!=='1159'/);
  assert.match(app, /APP_VER='v1159 · 微信外语文字自动翻译版'/);
  assert.match(shell, /__NORTH_SHELL_BUILD__='1159'/);
  assert.match(shell, /app\.js\?v=1159&r=v1159-wechat-text-auto-translation-1/);
  assert.match(sw, /const BUILD='1159'/);
  assert.match(sw, /v1159-wechat-text-auto-translation-hotfix-1/);
  assert.match(hotfix, /v1159-wechat-text-auto-translation-1/);
  assert.match(index, /小手机\.html\?v=1159/);
  assert.match(repair, /小手机\.html\?v=1159/);
});

test('v1159 publishes shared cohab memory and X comment controls', () => {
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
