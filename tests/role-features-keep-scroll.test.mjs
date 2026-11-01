// ROLE_FEATURES_KEEP_SCROLL_V1：角色「聊天与主动」等功能页重新画时停在原位置，不再一往下滑就弹回顶部。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这个测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, PRIV_DIR } from './_helpers.mjs';

const PRIV = PRIV_DIR;
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
