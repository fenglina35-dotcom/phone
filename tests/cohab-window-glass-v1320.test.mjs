import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

const read = n => fs.readFileSync(new URL("../" + n, import.meta.url), "utf8");
const PRIV = "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/";
const apps = { web: read("app.js"), private: read(PRIV + "app.js") };
const theaters = { web: read("cohab-theater.js"), private: read(PRIV + "cohab-theater.js") };
const shells = {
  web: read("小手机.html"),
  privateIndex: read(PRIV + "index.html"),
  privateAlias: read(PRIV + "小手机.html"),
};

function fnSource(src, name) {
  const asyncStart = src.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = src.indexOf("{", start);
  let depth = 0, quote = "", esc = false;
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (quote) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === quote) quote = ""; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error("unterminated " + name);
}

function windowBox(app) {
  const box = vm.createContext({ _off: { id: "c1", mode: "cohab" }, renders: 0 });
  box.render = () => { box.renders++; };
  box.$ = () => null;
  vm.runInContext(app.match(/const OFF_WINDOW_STEP=\d+;/)[0], box);
  vm.runInContext("let _offWindow={key:'',n:OFF_WINDOW_STEP};", box);
  for (const n of ["offWindowKey", "offWindowSize", "offWindowRows", "offShowMore", "offRgba"]) {
    vm.runInContext(fnSource(app, n), box);
  }
  return box;
}

test("一万条只画最近 300 条，其余留在存档里，按钮说明还剩多少", () => {
  for (const [name, app] of Object.entries(apps)) {
    assert.match(app, /const OFF_WINDOW_STEP=300;/, name);
    const box = windowBox(app);
    const rows = n => Array.from({ length: n }, (_, i) => ({ id: "m" + i }));
    const few = box.offWindowRows("c1", rows(120));
    assert.equal(few.rows.length, 120, name);
    assert.equal(few.hidden, 0);
    assert.equal(few.more, "", "没超过就不该出现「看更早」");
    const many = box.offWindowRows("c1", rows(10000));
    assert.equal(many.rows.length, 300, name);
    assert.equal(many.hidden, 9700);
    assert.equal(many.rows[299].id, "m9999", "画的必须是最新的那一段");
    assert.match(many.more, /看更早的 9700 条/);
    assert.match(many.more, /onclick="offShowMore\('c1'\)"/);
    // 点一下再放 300 条出来
    box.offShowMore("c1");
    assert.equal(box.offWindowRows("c1", rows(10000)).rows.length, 600, name);
    assert.equal(box.renders, 1, "看更早要重画一次");
    // 换一个角色/场景，窗口回到 300
    box._off = { id: "c2", mode: "date" };
    assert.equal(box.offWindowRows("c2", rows(10000)).rows.length, 300, name);
  }
});

test("看更早保住的是「离底部多远」，不是 scrollTop", () => {
  for (const [name, app] of Object.entries(apps)) {
    const src = fnSource(app, "offShowMore");
    assert.match(src, /scrollHeight-b\.scrollTop/, name);
    assert.match(src, /g\.scrollTop=Math\.max\(0,g\.scrollHeight-keep\)/, name);
  }
});

test("三个渲染入口都走这个窗口", () => {
  for (const [name, app] of Object.entries(apps)) {
    const hits = app.match(/_win=offWindowRows\(id,/g) || [];
    assert.equal(hits.length, 2, `${name}: 共同生活和一次性约会各一处`);
    assert.equal((app.match(/body=_win\.more\+_win\.rows\.map\(/g) || []).length, 2, name);
  }
  for (const [name, th] of Object.entries(theaters)) {
    assert.match(th, /_win=offWindowRows\(id,rows\),body=_win\.more\+_win\.rows\.map\(/, name);
  }
  for (const [name, css] of Object.entries(shells)) {
    assert.match(css, /\.off-more\{display:block;/, name);
    assert.match(css, /\.offstage\.off-classic \.off-more\{/, `${name}: 经典主题也要有自己的样子`);
  }
});

test("两边的气泡都是半透明磨砂，经典主题还是实心的", () => {
  for (const [name, app] of Object.entries(apps)) {
    assert.match(app, /--offc-me-soft:\$\{offRgba\(t\.me,\.62\)\};--offc-them-soft:\$\{offRgba\(t\.them,\.52\)\};/, name);
    const box = windowBox(app);
    assert.equal(box.offRgba("#d2c9ba", 0.62), "rgba(210,201,186,0.62)", name);
    assert.equal(box.offRgba("#26262a", 0.52), "rgba(38,38,42,0.52)", name);
    assert.equal(box.offRgba("nope", 0.5), "", "不是六位十六进制就不要瞎编");
  }
  for (const [name, css] of Object.entries(shells)) {
    for (const side of ["them", "me"]) {
      const re = new RegExp(`\\.offstage:not\\(\\.off-classic\\) \\.offmsg\\.${side} \\.offbubble\\{background:var\\(--offc-${side}-soft[^}]*backdrop-filter:blur\\(13px\\) saturate\\(1\\.3\\)`);
      assert.match(css, re, `${name}: ${side} 气泡要磨砂`);
    }
    assert.match(css, /\.offstage\.off-classic \.offmsg\.me \.offbubble\{background:#d2c9ba!important/, `${name}: 经典主题不动`);
  }
});

test("我的气泡默认是浅黄，旧的那个蓝只迁一次", () => {
  for (const [name, app] of Object.entries(apps)) {
    assert.match(app, /const OFF_THEME_DEF=\{me:'#d2c9ba',meInk:'#181614',/, name);
    const box = vm.createContext({});
    vm.runInContext(app.match(/const OFF_THEME_DEF=\{[^\n]*\}/)[0] + ";", box);
    vm.runInContext(app.match(/const OFF_THEME_OLD_ME='[^']*';/)[0], box);
    vm.runInContext(fnSource(app, "offColorOk"), box);
    vm.runInContext(fnSource(app, "offTheme"), box);
    const theme = stored => { box.c = { offTheme: stored }; return vm.runInContext("offTheme(c)", box); };
    const migrated = theme({ me: "#0a84ff", meInk: "#ffffff" });
    assert.equal(migrated.me, "#d2c9ba", `${name}: 没人选过的旧默认蓝要换成浅黄`);
    assert.equal(migrated.meInk, "#181614", name);
    assert.equal(migrated._meWarmV1, 1, name);
    const picked = theme({ me: "#ff6699", meInk: "#ffffff" });
    assert.equal(picked.me, "#ff6699", `${name}: 自己挑过的颜色一点都不能动`);
    const again = { me: "#0a84ff", meInk: "#ffffff", _meWarmV1: 1 };
    assert.equal(theme(again).me, "#0a84ff", `${name}: 迁过一次之后她再选蓝就留着`);
    assert.equal(theme({}).me, "#d2c9ba", `${name}: 全新的角色直接就是浅黄`);
  }
});

// 她截图里旁白和记下都有高光线，中间的输入框一条都没有：
// 加亮版那条规则当初只给了两颗按钮，输入框还用着暗的，壁纸一亮就看不见。
test("输入框的高光环和两颗按钮同一条加亮规则", () => {
  for (const [name, css] of Object.entries(shells)) {
    const bright = css.match(/\.off-field:before,\.offinput \.send:before\{background:linear-gradient\(140deg,rgba\(255,255,255,\.8\)[^}]*\}/g) || [];
    assert.equal(bright.length, 1, `${name}: 加亮版必须同时盖住输入框和按钮`);
    assert.match(bright[0], /backdrop-filter:brightness\(1\.72\) saturate\(1\.68\)/, name);
    assert.doesNotMatch(css, /\n\.offinput \.send:before\{background:linear-gradient\(140deg,rgba\(255,255,255,\.8\)/,
      `${name}: 不得再留只管按钮的那一条`);
  }
});

test("两份 app.js、两份剧场和三个壳子在这一轮上同步", () => {
  const grab = (src, marker, n) => { const i = src.indexOf(marker); assert.ok(i >= 0, marker); return src.slice(i, i + (n || 300)); };
  assert.equal(grab(apps.web, "const OFF_WINDOW_STEP=300;", 900), grab(apps.private, "const OFF_WINDOW_STEP=300;", 900));
  assert.equal(grab(theaters.web, "_win=offWindowRows(id,rows)"), grab(theaters.private, "_win=offWindowRows(id,rows)"));
  assert.equal(shells.privateIndex, shells.privateAlias, "私人两个壳子必须逐字节相同");
  for (const sel of [".off-more{", ".offstage:not(.off-classic) .offmsg.me .offbubble{"]) {
    assert.equal(shells.web.slice(shells.web.indexOf(sel), shells.web.indexOf(sel) + 200),
      shells.privateIndex.slice(shells.privateIndex.indexOf(sel), shells.privateIndex.indexOf(sel) + 200), sel);
  }
});
