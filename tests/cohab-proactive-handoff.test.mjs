import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";

// 她的原话：「我在线下聊完了，然后如果角色发来主动消息，就会沿着微信的话题继续，
// 而不是共同生活最新消息……除非你特意提到了事情她才承认。」
// 根子：线下回微信的交接只在「她先在微信发了一条」时才触发；角色主动发的那一条没有交接，
// 整段旧微信历史原样喂给模型，共同生活只剩两条小提示，模型就接着旧微信话题说。

const read = n => fs.readFileSync(new URL("../" + n, import.meta.url), "utf8");
const PRIV = "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js";
const apps = { web: read("app.js"), private: read(PRIV) };

function fnSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
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

const T0 = Date.UTC(2026, 8, 29, 12, 0, 0);
const min = n => n * 60000;

function box(app, { wechat, cohab, crossOn = true }) {
  const S = {
    me: { name: "North" },
    settings: { offlineWechatLive: crossOn ? true : false, timeAware: true },
    cohabitation: { enabled: true, paused: !crossOn, cid: "c1", homes: { c1: { startedAt: T0 - min(600), msgs: cohab } } },
  };
  const ctx = vm.createContext({
    S,
    msgs: () => wechat,
    msgToText: m => m.content,
    msgClearTime: m => m.time,
    fmtDT: t => new Date(t).toISOString().slice(11, 16),
    offlineWechatLiveOn: () => !(S.settings && S.settings.offlineWechatLive === false),
  });
  for (const n of ["cohabCrossChannelOn", "roleCrossChannelOn", "roleInteractionRows", "roleRecentChannelRounds",
    "roleReplyCrossChannelHandoff", "roleReplyOnlineHistorySource", "roleReplyCrossChannelHandoffPrompt"]) {
    vm.runInContext(fnSource(app, n), ctx);
  }
  return ctx;
}

const C = { id: "c1", name: "先生", remark: "先生" };
const oldWechat = [
  { id: "w1", role: "user", type: "text", content: "今天那个项目方案你看了没", time: T0 - min(300) },
  { id: "w2", role: "assistant", type: "text", content: "看了，第三页的数据要改", time: T0 - min(299) },
];
const cohabRound = [
  { id: "h1", who: "me", source: "me", text: "我冰还没敷，短剧看了两个半小时", time: T0 - min(40) },
  { id: "h2", who: "旁白", text: "他半跪在她身边的地毯上，抬手拢了拢她的碎发。", time: T0 - min(39) },
  { id: "h3", who: "ta", text: "先生不逼你今晚认，太晚了，你也累了。", time: T0 - min(38) },
];

for (const [name, app] of Object.entries(apps)) {
  test(`${name}: 共同生活之后角色主动发微信，必须接共同生活，不能接旧微信话题`, () => {
    const ctx = box(app, { wechat: oldWechat, cohab: cohabRound });
    const h = ctx.roleReplyCrossChannelHandoff(C, T0);
    assert.ok(h, "主动消息也必须有线下→微信的交接");
    assert.equal(h.proactive, true);
    assert.equal(h.current, null, "主动发的这一条前面没有她的新微信");
    assert.ok(h.between.some(x => /短剧看了两个半小时/.test(x.text)), "交接里必须有她在共同生活里最先说的那句");
    assert.ok(h.between.some(x => /不逼你今晚认/.test(x.text)), "也必须有共同生活最后那句");
    assert.equal(h.previousOnlineAt, oldWechat[1].time);
    // 旧微信只留最后一条当背景，不能再整段喂进去
    const src = ctx.roleReplyOnlineHistorySource(C, oldWechat, T0);
    assert.equal(src.length, 1);
    assert.equal(src[0].id, "w2");
    const p = ctx.roleReplyCrossChannelHandoffPrompt(C, T0);
    assert.match(p, /主动发的第一条/);
    assert.match(p, /短剧看了两个半小时/);
    assert.match(p, /不要回到更早的微信话题/);
    assert.doesNotMatch(p, /回复当前这条微信/, "主动消息没有「当前这条微信」可回复");
  });

  test(`${name}: 她先在微信发了新消息，还是原来那套交接，一个字不变`, () => {
    const wechat = [...oldWechat, { id: "w3", role: "user", type: "text", content: "睡了吗", time: T0 - min(5) }];
    const ctx = box(app, { wechat, cohab: cohabRound });
    const h = ctx.roleReplyCrossChannelHandoff(C, T0);
    assert.ok(h);
    assert.ok(!h.proactive);
    assert.equal(h.current.text, "睡了吗");
    assert.match(ctx.roleReplyCrossChannelHandoffPrompt(C, T0), /从线下回到微信后的第一条/);
    assert.match(ctx.roleReplyCrossChannelHandoffPrompt(C, T0), /再自然回复当前这条微信/);
  });

  test(`${name}: 角色已经在共同生活之后发过一条微信，就不再重复交接`, () => {
    const wechat = [...oldWechat, { id: "w4", role: "assistant", type: "text", content: "刚才是我语气重了", time: T0 - min(10) }];
    const ctx = box(app, { wechat, cohab: cohabRound });
    assert.equal(ctx.roleReplyCrossChannelHandoff(C, T0), null);
  });

  test(`${name}: 共同生活里只有角色自己在说、她没开口，不算一段新进展`, () => {
    const roleOnly = [{ id: "h9", who: "ta", text: "我先去洗澡了。", time: T0 - min(20) }];
    const ctx = box(app, { wechat: oldWechat, cohab: roleOnly });
    assert.equal(ctx.roleReplyCrossChannelHandoff(C, T0), null);
  });

  test(`${name}: 跨渠道关掉时一律不交接`, () => {
    const ctx = box(app, { wechat: oldWechat, cohab: cohabRound, crossOn: false });
    assert.equal(ctx.roleReplyCrossChannelHandoff(C, T0), null);
  });
}

test("两份 app.js 的交接函数逐字相同", () => {
  for (const n of ["roleReplyCrossChannelHandoff", "roleReplyCrossChannelHandoffPrompt"]) {
    assert.equal(fnSource(apps.private, n), fnSource(apps.web, n), n);
  }
});

test("后台推送那套上下文也带上同一段交接", () => {
  for (const [name, app] of Object.entries(apps)) {
    const src = fnSource(app, "roleServerPushRecentContext");
    assert.match(src, /const handoffPin=roleReplyCrossChannelHandoffPrompt\(c,Date\.now\(\)\);if\(handoffPin\)lines\.push\(handoffPin\.trim\(\)\);/, name);
    assert.ok(src.indexOf("handoffPin") < src.indexOf("roleServerPushConversationBoundary"), `${name}: 交接要在收尾边界之前`);
  }
});

test("她刚在微信发了新消息，共同生活那边稍晚冒出一句角色的收尾，普通交接照样生效", () => {
  for (const [name, app] of Object.entries(apps)) {
    const wechat = [...oldWechat, { id: "w3", role: "user", type: "text", content: "睡了吗", time: T0 - min(5) }];
    const cohab = [...cohabRound, { id: "h-late", who: "ta", text: "线下收尾句", time: T0 - min(4) }];
    const ctx = box(app, { wechat, cohab });
    const h = ctx.roleReplyCrossChannelHandoff(C, T0);
    assert.ok(h, `${name}: 不能因为那一行角色收尾就把交接吞掉`);
    assert.ok(!h.proactive, `${name}: 她刚发了微信，这是回复她，不是主动消息`);
    assert.equal(h.current.text, "睡了吗");
  }
});
