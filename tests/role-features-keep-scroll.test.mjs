// ROLE_FEATURES_KEEP_SCROLL_V1：角色「聊天与主动」等功能页重新画时停在原位置，不再一往下滑就弹回顶部。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这个测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import cp from 'node:child_process';

const PRIV = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read = (file) => process.env.FIX_TEST_OLD
  ? cp.execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8', maxBuffer: 64e6 })
  : fs.readFileSync(file, 'utf8');
function fnSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0, opened = false;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') { depth += 1; opened = true; }
    if (src[i] === '}') { depth -= 1; if (opened && depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unterminated ${name}`);
}

for (const [label, file] of [['web', 'app.js'], ['private', PRIV + 'app.js']]) {
  const src = read(file);
  test(label + ' the role features page keeps its scroll position when it is drawn again', () => {
    // 假页面：当前「聊天与主动」页的滚动层
    const makeBox = (key) => ({ id: 'roleFeatureScroll', scrollTop: 0, scrollHeight: 2200, clientHeight: 600, isConnected: true, getAttribute: (k) => (k === 'data-render-scroll-key' ? key : null) });
    let box = makeBox('roleFeatures:r1:chat');
    const ctx = vm.createContext({
      document: { getElementById: (id) => (id === box.id ? box : null), querySelector: () => null },
      requestAnimationFrame: (fn) => fn(), _scrollBottomOnce: {}, _chatJump: null,
    });
    vm.runInContext(['renderPageKey', 'renderScrollTarget', 'renderScrollElement', 'renderScrollStateKey', 'captureRenderScroll', 'restoreRenderScroll'].map((n) => fnSource(src, n)).join('\n')
      + ';this.cap=captureRenderScroll;this.res=restoreRenderScroll;', ctx);
    const page = { p: 'roleFeatures', id: 'r1', group: 'chat' };
    box.scrollTop = 1400;
    const state = ctx.cap(page);
    box = makeBox('roleFeatures:r1:chat'); // 重新画出来的新滚动层，位置是 0
    ctx.res(page, state);
    assert.equal(box.scrollTop, 1400, '重新画以后停在原来滑到的位置');
    const other = { p: 'roleFeatures', id: 'r1', group: 'profile' };
    const st2 = ctx.cap(page);
    box = makeBox('roleFeatures:r1:profile');
    ctx.res(other, st2);
    assert.equal(box.scrollTop, 0, '换到另一组设置从顶上开始');
  });

  test(label + ' each role feature group gets its own scroll key', () => {
    assert.match(fnSource(src, 'renderRoleManagementAll'), /<div class="scroll" id="roleFeatureScroll" data-render-scroll-key="roleFeatures:\$\{id\}"/);
    assert.match(fnSource(src, 'renderRoleManagement'), /\.replace\('data-render-scroll-key="roleFeatures:'\+id\+'"','data-render-scroll-key="roleFeatures:'\+id\+':'\+active\+'"'\)/);
  });
}
