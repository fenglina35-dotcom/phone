import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const read = n => fs.readFileSync(new URL("../" + n, import.meta.url), "utf8");
const PRIV = "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/";
const apps = { web: read("app.js"), private: read(PRIV + "app.js") };
const theaters = { web: read("cohab-theater.js"), private: read(PRIV + "cohab-theater.js") };
const shells = {
  web: read("小手机.html"),
  privateIndex: read(PRIV + "index.html"),
  privateAlias: read(PRIV + "小手机.html"),
};

// 「让TA回」点不动的根子：.offstage>* 给每个直接子级都发了 z-index:1，
// 设置面板和消息列表同为 1，列表在后面就把按钮压在下面，点下去命中的是消息（再弹出删除）。
test("共同生活的设置层必须压过消息列表，否则「让TA回」永远点不到", () => {
  const num = (css, sel) => {
    const rule = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}"));
    assert.ok(rule, `missing rule ${sel}`);
    const z = rule[1].match(/z-index:(\d+)/);
    assert.ok(z, `${sel} 必须写明 z-index`);
    return Number(z[1]);
  };
  for (const [name, css] of Object.entries(shells)) {
    const wrap = num(css, ".cohab-settings-wrap");
    const stageKid = num(css, ".offstage>*");
    assert.ok(wrap > stageKid, `${name}: 设置层 ${wrap} 必须高过同层的消息列表 ${stageKid}`);
    assert.match(css, /\.cohab-debug-reply\{position:absolute;z-index:6/, `${name}: 按钮本身仍在设置层里`);
  }
});

test("悬浮的「让TA回」不再压在第一条消息上", () => {
  for (const [name, css] of Object.entries(shells)) {
    assert.match(css, /\.offstage\.cohab-has-reply \.cohab-scroll\{padding-top:46px\}/, name);
  }
  for (const [name, app] of Object.entries(apps)) {
    assert.match(app, /_manualReply=cohabTogetherScene\(o\)&&!sel&&manualReplySceneOn\('offline'\)/, name);
    assert.match(app, /cohab-stage\$\{_st\.cls\}\$\{_manualReply\?' cohab-has-reply':''\}/, name);
  }
});

// 那一行本来是三列网格，却塞了四个孩子，外观被挤到看不见的第二行
test("共同生活顶部那一行只放三个格子，按钮收进一个 acts 里", () => {
  const metaRe = /<div class="cohab-meta">([\s\S]*?)<\/div>/;
  for (const [name, src] of [...Object.entries(apps), ...Object.entries(theaters)]) {
    const meta = src.match(metaRe);
    assert.ok(meta, `${name}: 找不到 cohab-meta`);
    const kids = meta[1].match(/<(span|time|button)\b/g) || [];
    // span(一起生活了) + time + span.cohab-meta-acts，acts 里的 button 不算顶层格子
    const top = meta[1].replace(/<span class="cohab-meta-acts">[\s\S]*$/, "").match(/<(span|time|button)\b/g) || [];
    assert.equal(top.length, 2, `${name}: acts 之前只能有两个格子，现在是 ${top.length}`);
    assert.match(meta[1], /<span class="cohab-meta-acts">/, name);
    assert.ok(kids.length >= 5, name);
    for (const label of ["多选", "外观", "测试控制"]) {
      assert.ok(meta[1].includes(">" + label.replace("多选", "") ) || meta[1].includes(label), `${name}: 少了 ${label}`);
    }
    assert.match(meta[1], /onclick="offSelToggle\(\)"/, `${name}: 共同生活要能多选删除`);
    assert.match(meta[1], /onclick="offAppearance\('\$\{id\}'\)"/, `${name}: 共同生活要能改外观`);
  }
  for (const [name, css] of Object.entries(shells)) {
    assert.match(css, /\.cohab-meta-acts\{justify-self:end;display:flex/, name);
    assert.match(css, /\.cohab-meta\{display:grid;grid-template-columns:1fr auto 1fr/, name);
  }
});

// 剧场那份拷贝是旧的：写死了 offstage cohab-stage，背景和气泡颜色一律套不上
test("多人剧场那份拷贝也要套同一套外观，不能再写死", () => {
  for (const [name, src] of Object.entries(theaters)) {
    assert.match(src, /const _st=offStageAttrs\(c\),_manualReply=/, name);
    assert.match(src, /class="offstage cohab-stage\$\{_st\.cls\}\$\{_manualReply\?' cohab-has-reply':''\}" style="\$\{_st\.style\}"/, name);
    assert.doesNotMatch(src, /`<div class="offstage cohab-stage">/, `${name}: 不得再写死舞台类名`);
  }
});

test("记下不再是蓝色，和旁白同一家、稍微白一点", () => {
  const rgba = s => (s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/) || []).slice(1).map(Number);
  for (const [name, css] of Object.entries(shells)) {
    const note = css.match(/\.offinput \.off-note\{([^}]*)\}/);
    const nar = css.match(/\.offinput \.off-narrate\{([^}]*)\}/);
    assert.ok(note && nar, name);
    assert.doesNotMatch(note[1], /10,\s*132,\s*255|#0a84ff/i, `${name}: 记下不能再是那个蓝`);
    const [nr, ng, nb] = rgba(note[1]), [ar, ag, ab] = rgba(nar[1]);
    assert.ok(nr && ar, name);
    // 同一家灰调：三个通道彼此接近，且都不偏蓝
    assert.ok(Math.max(nr, ng, nb) - Math.min(nr, ng, nb) <= 24, `${name}: 记下要是中性灰`);
    assert.ok(nr > ar && ng > ag && nb > ab, `${name}: 记下要比旁白再白一点`);
  }
});

test("没换背景时「让TA回」也是磨砂高光，经典主题仍然是实心的老样子", () => {
  for (const [name, css] of Object.entries(shells)) {
    assert.match(css, /\.offstage:not\(\.hasbg\):not\(\.off-classic\) \.cohab-debug-reply\{[^}]*backdrop-filter:blur\(14px\) saturate\(1\.32\)/, name);
    assert.match(css, /\.offstage:not\(\.hasbg\):not\(\.off-classic\) \.cohab-debug-reply:before\{[^}]*mask-composite:exclude/, name);
    assert.match(css, /\.offstage\.hasbg:not\(\.off-classic\) \.cohab-debug-reply\{/, `${name}: 有背景那条不能丢`);
    assert.match(css, /\.cohab-debug-reply\{position:absolute;z-index:6;[^}]*background:#1b1813/, `${name}: 经典主题仍走这条实心底`);
  }
});

test("两份 app.js 和三个壳子在这一轮上完全同步", () => {
  const grab = (src, marker) => {
    const i = src.indexOf(marker);
    assert.ok(i >= 0, "missing " + marker);
    return src.slice(i, i + 460);
  };
  assert.equal(grab(apps.web, '<div class="cohab-meta">'), grab(apps.private, '<div class="cohab-meta">'));
  assert.equal(grab(theaters.web, '<div class="cohab-meta">'), grab(theaters.private, '<div class="cohab-meta">'));
  assert.equal(shells.privateIndex, shells.privateAlias, "私人两个壳子必须逐字节相同");
  for (const sel of [".cohab-meta-acts{", ".offstage.cohab-has-reply .cohab-scroll{", ".cohab-settings-wrap{"]) {
    const web = shells.web.slice(shells.web.indexOf(sel), shells.web.indexOf(sel) + 160);
    const priv = shells.privateIndex.slice(shells.privateIndex.indexOf(sel), shells.privateIndex.indexOf(sel) + 160);
    assert.equal(web, priv, sel);
  }
});
