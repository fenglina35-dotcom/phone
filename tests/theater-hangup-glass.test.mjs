// 2026-11-02 三个问题：
// THEATER_GUEST_INTERCEPT_V1：多人剧场来客的回复被纯英文拦截挡掉时，「查看上一轮拦截内容」要能看到；来客提示词要有语言要求。
// HANGUP_REMARK_NAME_V1：通话结束提示写备注名（先生主动挂断），不写「角色主动挂断」。
// HOME_GLASS_MEMORY_V1：主屏组件镜片缓存的画布没了内存要重烤，烤失败会自动再试，丢掉的画布把内存还回去。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, PRIV_DIR, BUNDLES } from './_helpers.mjs';

for (const [label, file] of [['web', 'cohab-theater.js'], ['private', PRIV_DIR + 'cohab-theater.js']]) {
  const src = read(file);

  test(label + ' theater guest: a reply blocked as English-only is kept for 查看上一轮拦截内容', async () => {
    const calls = { turn: [], failure: [] }, host = { id: 'h1', name: '先生' };
    const englishError = Object.assign(new Error('已拦截纯英文回复：没有中文翻译'), { code: 'ROLE_ENGLISH_ONLY' });
    let seenOpt = null;
    const ctx = vm.createContext({
      modelOutputUnfiltered: () => true, getC: (id) => (id === 'h1' ? host : null), cohabData: () => ({}), theaterState: () => ({ supportBubbleLimit: 2 }),
      roleChatRouteIndex: () => 0, offlineReplyBudget: () => 600,
      theaterActorPrompt: () => ({ actor: { id: 'g1' }, entry: { contactId: 'g1', episodeId: 'e1' }, name: 'Ann', messages: [{ role: 'system', content: 'x' }, { role: 'user', content: 'y' }] }),
      offlineForegroundRequest: (fn) => fn(), chatAPI: async (_m, opt) => { seenOpt = opt; throw englishError; },
      roleInterceptDiagnosticTurn: (c, channel, account, scene) => { const t = { c, channel, scene, candidates: [] }; calls.turn.push(t); return t; },
      roleInterceptDiagnosticTurnFailure: (turn, e) => { calls.failure.push({ turn, e }); return true; },
      roleInterceptDiagnosticTurnFinish: () => false,
      theaterRawActor: () => ({ bubbles: [], leave: false }), theaterParseActor: () => ({ bubbles: [], leave: false }), theaterFixBubbles: (b) => b,
      theaterGuestKind: (k) => k === 'guest' || k === 'guest2', uid: () => 'u', Date, Math, Array, Object, String,
    });
    vm.runInContext(fnSource(src, 'cohabTheaterActorItems') + ';this.run=cohabTheaterActorItems;', ctx);
    const out = await ctx.run('h1', 'guest', '', 80, '');
    assert.deepEqual(Array.from(out.items), []);
    assert.equal(calls.turn.length, 1, '来客请求要建一条拦截记录');
    assert.equal(calls.turn[0].c, host, '记在主角名下，共同生活设置里那个按钮读的就是这里');
    assert.equal(calls.turn[0].channel, 'cohab');
    assert.equal(seenOpt.roleInterceptAudit, calls.turn[0], '拦截记录要随请求带过去，挡掉时才会记下正文');
    assert.equal(calls.failure.length, 1, '失败时把这一轮记下来');
  });

  test(label + ' theater guest: the prompt asks for Chinese, with a translation after any foreign line', () => {
    assert.match(src, /【语言】动作和台词都用简体中文写。人设里说外语的，台词可以说外语，但同一句后面必须用括号附上中文翻译/);
  });
}

for (const [label, file] of BUNDLES) {
  const src = read(file);

  test(label + ' hangup notice uses the role remark name, e.g. 先生主动挂断', () => {
    const body = fnSource(src, 'hangupCall');
    const m = body.match(/const (?:_endWho=[^;]*?,)?endText=[^;]*;/);
    assert.ok(m, '找不到 endText');
    const ctx = vm.createContext({ getC: () => ({ name: 'Th', remark: '先生' }), id: 'r1' });
    for (const [byAI, reason, want] of [[true, '', '先生主动挂断'], [true, 'wxlogin', '先生为了登录你的微信主动挂断'], [false, '', '你主动挂断']]) {
      ctx.byAI = byAI; ctx.reason = reason;
      assert.equal(vm.runInContext(m[0].replace(/^const /, 'var ') + ';endText', ctx), want);
    }
    ctx.getC = () => ({ name: 'Th' }); ctx.byAI = true; ctx.reason = '';
    assert.equal(vm.runInContext(m[0].replace(/^const /, 'var ') + ';endText', ctx), 'Th主动挂断', '没写备注就用名字');
  });

  test(label + ' home glass: an emptied cached lens is baked again, and a failed bake is retried', async () => {
    const mk = (filled) => ({ width: filled ? 100 : 0, height: filled ? 80 : 0, isConnected: false, filled, getContext: () => (filled ? {} : null) });
    const baked = [], attached = [];
    const ctx = vm.createContext({
      _lg: { cache: new Map(), texs: new Map() }, window: { devicePixelRatio: 2 }, lgStyle: () => {},
      lgGeometry: () => ({ x: 0, y: 0, w: 50, h: 40 }), lgKey: () => 'k1', lgTexture: async () => true,
      lgBake: () => { const c = mk(true); baked.push(c); return c; }, lgAttachTo: (host, cv) => attached.push(cv),
      Math, Map, Array,
    });
    const names = ['lgApply', 'lgRemember'].concat(src.includes('function lgCanvasOk(') ? ['lgFree', 'lgCanvasOk', 'lgFreeCache'] : []);
    vm.runInContext(names.map((n) => fnSource(src, n)).join('\n') + ';this.apply=lgApply;this.remember=lgRemember;', ctx);
    const empty = mk(false);
    ctx._lg.cache.set('k1', empty);
    const host = { parentElement: null, querySelector: () => null, isConnected: true };
    assert.equal(await ctx.apply({}, [host], 'wall', {}), true);
    assert.equal(baked.length, 1, '缓存里那张已经没了画布内存，要重新烤，不能直接贴上去');
    assert.equal(attached[0], baked[0]);

    for (let i = 0; i < 20; i++) ctx.remember('x' + i, mk(true));
    assert.ok(ctx._lg.cache.size <= 12, '缓存张数少一点，iOS 画布内存才够用');

    const refresh = fnSource(src, 'lgHomeRefresh');
    assert.match(refresh, /retry\(\)/, '烤失败要自动再试');
  });
}
