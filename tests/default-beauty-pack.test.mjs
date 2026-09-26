import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const privateApp = fs.readFileSync(new URL(
  "../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
  import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const packWeb = fs.readFileSync(new URL("../assets/default-beauty-pack.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const packPrivate = fs.readFileSync(new URL(
  "../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/assets/default-beauty-pack.js",
  import.meta.url), "utf8").replace(/\r\n/g, "\n");

function functionSource(source, name) {
  // 名字后面必须跟着左括号，否则 defaultBeautyMark 会命中 defaultBeautyMarked
  const asyncStart = source.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = "", escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function loadPack(text) {
  const box = vm.createContext({ window: {} });
  vm.runInContext(text, box);
  return box.window.__NORTH_DEFAULT_BEAUTY__;
}

test("the bundled default pack is a real beauty pack and both copies are identical", () => {
  assert.equal(packWeb, packPrivate, "web and private app must ship the same default beauty pack");
  assert.match(packWeb, /^\/\*[\s\S]*?\*\/\nwindow\.__NORTH_DEFAULT_BEAUTY__=\{/);
  assert.doesNotMatch(packWeb, /<\/script/i, "a raw </script> would break the on-demand script tag");
  const pack = loadPack(packWeb);
  assert.equal(pack.type, "north-beauty-pack");
  assert.equal(pack.ver, 1);
  for (const key of ["homeBg", "lockBg", "appIcons", "homeDashboard", "homeSweetie", "glassWidgetAppearances"]) {
    assert.ok(pack.me[key], `default pack must carry ${key}`);
  }
  assert.equal(Object.keys(pack.me.appIcons).length, 26);
});

test("the default pack carries appearance only, never anyone's own data", () => {
  const pack = loadPack(packWeb);
  for (const key of ["phoneFriend", "phoneapp", "contacts", "groups", "music", "beautyArchive"]) {
    assert.ok(!(key in pack), `default pack must not ship ${key}`);
  }
  const keys = app.match(/const BEAUTY_ME_KEYS=\[([^\]]+)\]/s)?.[1] || "";
  for (const key of Object.keys(pack.me)) {
    assert.match(keys, new RegExp(`'${key}'`), `${key} is not part of the shared beauty key list`);
  }
  // 当时的状态不该替新人决定
  assert.ok(!("status" in pack.me) && !("place" in pack.me));
  const text = JSON.stringify(pack);
  assert.doesNotMatch(text, /\b1[3-9]\d{9}\b/, "no real phone numbers may ride along");
});

test("the 3MB pack is fetched on demand, never precached for everyone", () => {
  assert.doesNotMatch(sw, /default-beauty-pack/, "the service worker must not precache the default pack");
  assert.doesNotMatch(fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8"),
    /default-beauty-pack/, "the shell must not load the default pack up front");
  // file:// 下 fetch 会被 CORS 挡，所以只能用 script 标签
  const load = functionSource(app, "defaultBeautyLoad");
  assert.match(load, /createElement\('script'\)/);
  assert.doesNotMatch(load, /fetch\(/);
  assert.match(load, /DEFAULT_BEAUTY_SRC/);
  assert.match(app, /const DEFAULT_BEAUTY_SRC='assets\/default-beauty-pack\.js\?p=1'/);
});

test("both app copies apply the default pack once, right after boot", () => {
  for (const source of [app, privateApp]) {
    assert.match(source, /window\.__northBootReady=true;defaultBeautyApplyOnFirstRun\(\)\.catch\(\(\)=>\{\}\);/);
    assert.match(source, /_bootFreshInstall=true;/);
    assert.match(source, /me:pickObj\(me,BEAUTY_ME_KEYS\)/);
    assert.match(source, /beautyAssign\(S\.me,pack\.me,BEAUTY_ME_KEYS\)/);
  }
  for (const name of ["defaultBeautyBlank", "defaultBeautyLoad", "defaultBeautyApplyOnFirstRun",
    "beautyValueEmpty", "beautyValueSame"]) {
    assert.equal(functionSource(privateApp, name), functionSource(app, name),
      `private copy of ${name} drifted`);
  }
});

function sandbox(state, opts = {}) {
  const store = Object.assign({}, opts.store);
  const box = vm.createContext({
    S: state,
    _bootFreshInstall: opts.fresh !== false,
    NORTH_PREVIEW: !!opts.preview,
    defState: () => ({ me: { avatar: "🐱", momentCover: "", lockBg: "", uiMaterial: "glass", appIconPack: "black", status: "", place: "" } }),
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    save: () => { box.saved = (box.saved || 0) + 1; },
    applyBeautyPack: async (p) => { box.applied = p; return 9; },
    window: { __NORTH_DEFAULT_BEAUTY__: opts.pack },
  });
  box.store = store;
  vm.runInContext(app.match(/const BEAUTY_ME_KEYS=\[[^;]+;/)[0], box);
  vm.runInContext(app.match(/const DEFAULT_BEAUTY_SRC=[^;]+;/)[0], box);
  vm.runInContext(app.match(/const DEFAULT_BEAUTY_SKIP_KEYS=[^;]+;/)[0], box);
  vm.runInContext(functionSource(app, "beautyCustomPart"), box);
  for (const name of ["defaultBeautyMarked", "defaultBeautyMark", "beautyValueEmpty", "beautyValueSame",
    "defaultBeautyBlank", "defaultBeautyLoad", "defaultBeautyApplyOnFirstRun"]) {
    vm.runInContext(functionSource(app, name), box);
  }
  return box;
}

const blankState = () => ({
  me: { avatar: "🐱", momentCover: "", lockBg: "", uiMaterial: "glass", appIconPack: "black", status: "", place: "", theme: "" },
  contacts: [], groups: [], messages: {}, music: {},
});

test("a factory-fresh phone counts as blank", () => {
  assert.equal(sandbox(blankState()).defaultBeautyBlank(), true);
  const withIdbShell = blankState();
  withIdbShell.messages = { __idb: "messages" };
  assert.equal(sandbox(withIdbShell).defaultBeautyBlank(), true, "an empty archive shell is still blank");
});

test("what the phone fills in by itself still counts as blank", () => {
  // 真机上开机就会有这几样：组件里的电量心率、还空着的第二页相册、结构版本号
  const s = blankState();
  s.me.homeDashboard = { battery: 88, heartRate: 72 };
  s.me.homeSecondPage = { photos: [] };
  s.me._glassAppearanceSchema = 3;
  s.me.appIcons = {};
  assert.equal(sandbox(s).defaultBeautyBlank(), true, "手机自己填的东西不算谁弄过的美化");
  // 但真的放了照片就是美化
  for (const mutate of [
    (x) => { x.me.homeDashboard = { battery: 88, heartRate: 72, photo: "data:image/png;base64,zz" }; },
    (x) => { x.me.homeSecondPage = { photos: ["data:image/png;base64,zz"] }; },
    (x) => { x.me.homeSecondPage = { photos: [], portrait: "data:image/png;base64,zz" }; },
  ]) {
    const own = blankState();
    mutate(own);
    assert.equal(sandbox(own).defaultBeautyBlank(), false);
  }
});

test("anything the owner already has stops the default pack", () => {
  const cases = {
    "已经换过壁纸": (s) => { s.me.homeBg = "data:image/png;base64,zzz"; },
    "换过锁屏": (s) => { s.me.lockBg = "data:image/png;base64,zzz"; },
    "换过头像": (s) => { s.me.avatar = "data:image/png;base64,zzz"; },
    "换过图标包": (s) => { s.me.appIconPack = "pink"; },
    "自定义过 App 图标": (s) => { s.me.appIcons = { wechat: "x" }; },
    "有角色": (s) => { s.contacts = [{ id: "c1" }]; },
    "有群": (s) => { s.groups = [{ id: "g1" }]; },
    "有聊天记录": (s) => { s.messages = { c1: [{ id: "m1" }] }; },
    "真人好友气泡设过": (s) => { s.me.phoneFriend = { bubbleStyle: { bg: "pink" } }; },
    "音乐背景设过": (s) => { s.music = { bg: "data:image/png;base64,zzz" }; },
    "套过一次了": (s) => { s._defaultBeautyV1 = 1; },
  };
  for (const [why, mutate] of Object.entries(cases)) {
    const s = blankState();
    mutate(s);
    assert.equal(sandbox(s).defaultBeautyBlank(), false, `${why} 的手机不该被覆盖`);
  }
  assert.equal(sandbox(blankState(), { fresh: false }).defaultBeautyBlank(), false, "本机已有存档就不算第一次");
  assert.equal(sandbox(blankState(), { preview: true }).defaultBeautyBlank(), false, "预览模式不套");
});

test("a fresh phone gets the pack exactly once", async () => {
  const pack = loadPack(packWeb);
  const box = sandbox(blankState(), { pack });
  assert.equal(await box.defaultBeautyApplyOnFirstRun(), true);
  assert.equal(box.applied, pack);
  assert.equal(box.store.north_default_beauty_v1, "1");
  assert.equal(box.S._defaultBeautyV1, 1);
  assert.ok(!box.S._defaultBeautyPending);
  box.applied = null;
  assert.equal(await box.defaultBeautyApplyOnFirstRun(), false, "第二次开机不能再套一遍");
  assert.equal(box.applied, null);
});

test("a phone that already has its own look is marked and never touched", async () => {
  const s = blankState();
  s.me.homeBg = "data:image/png;base64,mine";
  const box = sandbox(s, { pack: loadPack(packWeb) });
  assert.equal(await box.defaultBeautyApplyOnFirstRun(), false);
  assert.equal(box.applied, undefined, "别人的美化一点都不能碰");
  assert.equal(s.me.homeBg, "data:image/png;base64,mine");
  assert.equal(box.store.north_default_beauty_v1, "1", "记个标记，以后不用再问");
});

test("a failed first download is retried on the next boot", async () => {
  const box = sandbox(blankState());   // 沙箱里没有 pack，script 标签也加载不出来
  box.document = { head: { appendChild: (el) => { setTimeout(() => el.onerror(), 0); } },
    createElement: () => ({ remove() {}, set src(v) { this._src = v; } }) };
  vm.runInContext("this.document=document;", box);
  assert.equal(await box.defaultBeautyApplyOnFirstRun(), false);
  assert.equal(box.S._defaultBeautyPending, 1, "下次开机要能再试一次");
  assert.equal(box.store.north_default_beauty_v1, undefined, "下载失败不能记成已经套过了");
  const retry = sandbox(box.S, { fresh: false, pack: loadPack(packWeb) });
  assert.equal(retry.defaultBeautyBlank(), true, "留了待办就算没有存档标记也该重试");
});

test("someone who beautifies while the pack is downloading keeps their own look", async () => {
  const s = blankState();
  const pack = loadPack(packWeb);
  const box = sandbox(s);
  // 下载那几秒里她自己换了壁纸：取包的那一刻才发生
  Object.defineProperty(box.window, "__NORTH_DEFAULT_BEAUTY__", {
    get() { s.me.homeBg = "data:image/png;base64,hers"; return pack; },
  });
  assert.equal(await box.defaultBeautyApplyOnFirstRun(), false);
  assert.equal(box.applied, undefined, "下载中途她动过手，就必须让开");
  assert.equal(s.me.homeBg, "data:image/png;base64,hers");
});
