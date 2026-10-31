// MODEL_CALL_LEDGER_V1（2026-10-31 她要求）：每次模型调用标明是哪个功能；「副模型使用清单」逐个功能切换主/副模型，
// 没拨过的功能和原来完全一样；微信聊天等核心对话不受清单影响。两版都要满足。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = process.env.FIX_TEST_ROOT || new URL('..', import.meta.url).pathname;
const BUNDLES = {
  private: ROOT + '/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/',
  web: ROOT + '/',
};

function load(dir, settings = {}) {
  const src = fs.readFileSync(dir + 'app.js', 'utf8');
  const a = src.indexOf('/* MODEL_CALL_LEDGER_V1'), b = src.indexOf('async function chatAPI(');
  assert.ok(a > 0 && b > a, '要有调用记录和清单代码');
  const store = {};
  const ctx = {
    S: { settings }, saved: 0, Set, Object, JSON, Error, document: { getElementById: () => null },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
    save() { ctx.saved++; }, gameModelUseAux: () => !!settings.gameUseAux, esc: String, toast() {}, openModal() {},
  };
  vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) + `
    function spyRefresh(o){return modelFeatureOf(o||{});}
    function spyContinueJson(){return modelFeatureOf({});}
    function xRefreshComments(){return modelFeatureOf({});}
    function someNewThing(){return modelFeatureOf({});}
    this.__api={modelFeatureOf,modelFeatureApply,modelFeatureToggle,modelFeatureUsesAux,modelFeatureIndex,spyRefresh,spyContinueJson,xRefreshComments,someNewThing};`, ctx);
  return { ctx, api: ctx.__api, src };
}

for (const [label, dir] of Object.entries(BUNDLES)) {
  test(`${label}：认得出是哪个功能调用的模型`, () => {
    const { api } = load(dir);
    assert.equal(api.spyRefresh().label, '查他手机·刷新');
    assert.equal(api.spyContinueJson().label, '查他手机·刷新（接着写）');
    assert.equal(api.xRefreshComments().label, 'X·网友评论');
    assert.equal(api.someNewThing().label, '其他（someNewThing）', '表里没有的也能看到函数名');
    const cont = api.modelFeatureOf({ roleInterceptPurpose: 'length-continuation', diagnosticFeatureKey: 'letter', diagnosticFeature: '信箱·角色写信' });
    assert.equal(cont.label, '信箱·角色写信（接着写）', '写不完自动接着写的那次也标明');
  });

  test(`${label}：没拨过开关时和原来完全一样`, () => {
    const { api } = load(dir);
    const x = api.xRefreshComments(), o1 = { aux: true };
    api.modelFeatureApply(x, o1);
    assert.equal(o1.aux, true);
    const o2 = { aux: false };
    api.modelFeatureApply(api.spyRefresh(), o2);
    assert.equal(o2.aux, false);
  });

  test(`${label}：清单开关能改主/副，拨回原样就恢复原来的做法`, () => {
    const settings = {};
    const { api, ctx } = load(dir, settings);
    const x = api.xRefreshComments();
    api.modelFeatureApply(x, { aux: true }); // 记下原来用副模型
    assert.equal(api.modelFeatureUsesAux(x), true);
    api.modelFeatureToggle('x_net_comments');
    assert.equal(settings.modelFeatureAux.x_net_comments, false);
    const o = { aux: true };
    api.modelFeatureApply(x, o);
    assert.equal(o.aux, false, '拨成主模型后真的用主模型');
    api.modelFeatureToggle('x_net_comments');
    assert.equal(Object.prototype.hasOwnProperty.call(settings.modelFeatureAux, 'x_net_comments'), false, '拨回去就不再记');
    assert.ok(ctx.saved >= 2);
  });

  test(`${label}：微信聊天等核心对话不受清单影响`, () => {
    const settings = { modelFeatureAux: { wechat: true } };
    const { api } = load(dir, settings);
    const wechat = api.modelFeatureIndex().byKey.wechat, o = { aux: false };
    assert.equal(wechat.toggle, false);
    api.modelFeatureApply(wechat, o);
    assert.equal(o.aux, false);
  });

  test(`${label}：自己已有主/副切换的功能不放进清单，只写去哪里切换`, () => {
    // 2026-10-31 她要求：游戏大厅、角色扮演等里面能切换的就不要加，没有切换按钮的才加。
    const settings = { modelFeatureAux: { spy_refresh: false, game_hub: true, rp: true, jail: true } };
    const { api } = load(dir, settings);
    const idx = api.modelFeatureIndex().byKey;
    for (const key of ['spy_refresh', 'spy_diary', 'game_hub', 'undercover', 'draw_guess', 'word_guess', 'heart_quiz', 'mini_drama', 'rp', 'jail', 'wechat_summary', 'cohab_summary', 'offline_summary', 'wechat', 'call', 'cohab', 'offline']) {
      assert.equal(idx[key].toggle, false, key + ' 不该有清单开关');
      assert.ok(idx[key].where, key + ' 要写去哪里切换');
    }
    const o = { aux: false };
    api.modelFeatureApply(idx.game_hub, o);
    assert.equal(o.aux, false, '清单里残留的旧设置也不会盖过游戏大厅自己的按钮');
    assert.equal(idx.rp_setup.toggle, true, '角色扮演开局和存档没有自己的开关，留在清单');
    assert.equal(idx.jail_summary.toggle, true);
  });

  test(`${label}：请求入口、调用记录和设置页都接上了`, () => {
    const { src } = load(dir);
    assert.match(src, /async function chatAPI\(messages,opt\)\{opt=opt\|\|\{\};const _modelFeature=typeof modelFeatureOf==='function'\?modelFeatureOf\(opt\):null;/);
    assert.match(src, /opt\.aux=false;if\(_modelFeature&&typeof modelFeatureApply==='function'\)modelFeatureApply\(_modelFeature,opt\);const fixedRoute=/, '清单的开关排在游戏、线路页面规则之后');
    assert.match(src, /ids:\['set_chat','set_aux','set_search','set_modeldiag'\]/);
    assert.match(src, /onclick="modelLedgerOpen\(\)"/);
    assert.match(src, /onclick="modelFeatureListOpen\(\)"/);
    assert.match(src, /在本页最下面「副模型使用清单」里逐个开关/, '辅助模型提示字改了');
    const diag = fs.readFileSync(dir + 'request-diagnostics.js', 'utf8');
    assert.match(diag, /feature:scrub\(opt\.diagnosticFeature\|\|''\)/);
    assert.match(diag, /function listAll\(\)/);
    assert.match(diag, /'副模型没填·用主模型'/);
  });
}

// 漏登记检查：两版所有调用模型的地方，包住它的函数都要在 MODEL_FEATURES 表里有中文名。
// 失败时：在 app.js（两版都要）的 MODEL_FEATURES 加一行，同名函数写成「文件名:函数名」。
function bodyEnd(s, at, cache) {
  if (cache.has(at)) return cache.get(at);
  let i = s.indexOf('{', at), d = 0;
  if (i < 0) { cache.set(at, -1); return -1; }
  for (; i < s.length; i++) { const c = s[i]; if (c === '{') d++; else if (c === '}' && --d === 0) break; }
  cache.set(at, i); return i;
}
function callers(dir) {
  const DECL = [/function\s+([A-Za-z0-9_$]+)\s*\(/g, /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:function\b|(?:\([^()]*\)|[A-Za-z0-9_$]+)\s*=>\s*\{)/g];
  const out = new Set();
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js') && x !== 'sw.js')) {
    const s = fs.readFileSync(dir + f, 'utf8'), decls = [], cache = new Map();
    for (const re of DECL) { re.lastIndex = 0; let m; while ((m = re.exec(s))) decls.push([m.index + m[0].indexOf(m[1]), m[1]]); }
    decls.sort((a, b) => a[0] - b[0]);
    const call = /(?<![.\w$])(chatAPI|aiGen|dyAuxChat|offlineReplyChatRequest)\s*\(/g; let m;
    while ((m = call.exec(s))) {
      if (/function\s+$/.test(s.slice(Math.max(0, m.index - 16), m.index))) continue;
      let name = '?';
      for (let i = decls.length - 1; i >= 0; i--) { const at = decls[i][0]; if (at < m.index && bodyEnd(s, at, cache) > m.index) { name = decls[i][1]; break; } }
      if (name === '?') for (let i = decls.length - 1; i >= 0; i--) if (decls[i][0] < m.index) { name = decls[i][1]; break; }
      out.add(f + ':' + name);
    }
  }
  return out;
}
for (const [label, dir] of Object.entries(BUNDLES)) {
  test(`${label}：每个调用模型的功能都登记了中文名（漏了就不能发布）`, () => {
    const { api, src } = load(dir);
    const idx = api.modelFeatureIndex().byFn;
    const skip = src.slice(src.indexOf('const MODEL_FEATURE_SKIP'), src.indexOf(';', src.indexOf('const MODEL_FEATURE_SKIP')));
    const missing = [...callers(dir)].filter(k => { const [file, name] = k.split(':'); return !idx[k] && !idx[name] && !skip.includes("'" + name + "'"); });
    assert.deepEqual(missing, [], '这些调用模型的函数还没在 MODEL_FEATURES 登记中文名：' + missing.join('、'));
  });
}
test('两版的功能表一模一样', () => {
  const a = load(BUNDLES.private).src, b = load(BUNDLES.web).src;
  const cut = s => s.slice(s.indexOf('const MODEL_FEATURES=['), s.indexOf('async function chatAPI('));
  assert.equal(cut(a), cut(b));
});
