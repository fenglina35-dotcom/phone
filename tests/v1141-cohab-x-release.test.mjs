import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { REL, vre } from './_helpers.mjs';

const root = process.cwd();
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('v1184 web identity and cache markers are aligned', () => {
  const app = read('app.js');
  const shell = read('小手机.html');
  const sw = read('sw.js');
  const hotfix = read('web-hotfix.js');
  const index = read('index.html');
  const repair = read('repair.html');
  assert.match(app, vre(String.raw`__NORTH_SHELL_BUILD__!=='{WEB}'`));
  assert.match(app, vre(String.raw`APP_VER='v{WEB} · {WEBLABEL}'`));
  assert.match(shell, vre(String.raw`__NORTH_SHELL_BUILD__='{WEB}'`));
  assert.match(shell, vre(String.raw`app\.js\?v={WEB}&r=v{WEB}-owner-todo-report-1`));
  assert.match(sw, vre(String.raw`const BUILD='{WEB}'`));
  assert.match(sw, vre(String.raw`v{WEB}-owner-todo-report-1`));
  assert.match(hotfix, vre(String.raw`v{WEB}-owner-todo-report-1`));
  assert.match(index, vre(String.raw`小手机\.html\?v={WEB}`));
  assert.match(repair, vre(String.raw`小手机\.html\?v={WEB}`));
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
