import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
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

assert.match(source, /APP_VER='v1074 · 存档歌单与网页电量修复版'/);
assert.match(source, /friendDiscovery:\{enabled:false,freq:180,max:2/);
assert.match(source, /else if\(c\.p==='newfriends'\)html=renderNewFriends\(\)/);
assert.match(source, /好友申请与最近添加/);
assert.match(source, /queueFriendRequest\(c,\{kind:'created',delay:10000/);
assert.match(source, /status==='rejected'&&now-\(\+r\.decidedAt\|\|r\.time\)>=86400000/);
assert.match(source, /r\.status='accepted';r\.decidedAt=now/);
assert.match(functionSource("ignoreFriend"), /render\(\)/);
assert.doesNotMatch(functionSource("ignoreFriend"), /toast\(/);
assert.match(source, /friendRequestRemoveForContact\(id\);c\._friendPending=false/);
assert.match(source, /friendRequestRemoveForContact\(tgt\.id\)/);
assert.match(source, /r\.contactId===id&&r\.kind==='readd'&&r\.status==='pending'/);
assert.match(source, /你为什么会出现在这个微信里（持续有效）/);
assert.match(source, /不能聊两句就变成毫无目的的随机陌生人/);
assert.match(source, /系统只生成角色资料和验证消息，不会在后台自动消耗聊天 API/);
assert.doesNotMatch(functionSource("friendDiscoveryGenerate"), /chatAPI\(/);
assert.match(source, /近三天/);
assert.match(source, /三天前/);
assert.match(html, /\.nf-page/);
assert.match(html, /\.nf-card/);
assert.match(html, /\.nf-entry-icon/);
assert.doesNotMatch(source, /每一次认识，都有来意/);
assert.match(source, /content:wasReadd\?'你重新通过了'\+c\.name\+'的好友申请':'你刚刚通过了'\+c\.name\+'的好友申请'/);
assert.match(source, /if\(r\.kind==='created'&&!coupleHasActiveRole\(\)\)S\.couple=coupleDefaultState\(c\.id\)/);
assert.match(source, /function friendLineAvatar\(seed\)/);
assert.match(functionSource("friendDiscoveryProfile"), /tn=target&&target\.name\|\|''/);
assert.doesNotMatch(functionSource("friendDiscoveryProfile"), /target\.remark/);
assert.doesNotMatch(functionSource("friendDiscoveryProfile"), /🌙|🪶|🎧|🕯️|🫧|🦋|📷|🌫️|🪐|🍃|🧩|☕/);

const ctx = vm.createContext({
  S: { friendDiscovery: { enabled: true, freq: 30, max: 0, today: "", n: 0, nextAt: 0 }, contacts: [], couple: null, me: { name: "北" } },
  Date,
  Math,
  Set,
  getC: () => null,
  fmtDT: () => "现在",
  fmtDur: () => "1分钟",
});
vm.runInContext([
  functionSource("friendDiscoveryState"),
  functionSource("friendRequestVisible"),
  functionSource("friendDiscoveryTarget"),
  functionSource("friendDiscoveryRepairRoleName"),
  functionSource("friendLineAvatar"),
  functionSource("friendDiscoveryProfile"),
  functionSource("friendOriginPrompt"),
  "globalThis.api={friendDiscoveryState,friendRequestVisible,friendDiscoveryRepairRoleName,friendDiscoveryProfile,friendOriginPrompt};",
].join("\n"), ctx);

assert.equal(ctx.api.friendDiscoveryState().max, 0, "daily max=0 must stay disabled instead of reverting to 2");
const now = Date.now();
assert.equal(ctx.api.friendRequestVisible({ time: now, visibleAt: now + 10000 }, now), false);
assert.equal(ctx.api.friendRequestVisible({ time: now, visibleAt: now + 10000 }, now + 10000), true);

ctx.S.contacts = [{ id: "lead", name: "顾沉", remark: "先生^^", pinned: true, deleted: false }];
for (let i = 0; i < 24; i++) {
  const p = ctx.api.friendDiscoveryProfile();
  assert.ok(p.name && p.source && p.intent && p.msg && p.persona);
  assert.match(p.avatar, /^data:image\/svg\+xml/);
  assert.ok(p.intent.length >= 8, "surprise request needs a concrete purpose");
  assert.ok(p.persona.includes("目的") || p.persona.includes("想") || p.persona.includes("来"));
  assert.doesNotMatch([p.source,p.intent,p.msg,p.persona].join("\n"), /先生/);
}

const oldLinked={id:"visitor",name:"林澈",remark:"",relation:"先生^^的家人",persona:"你是先生^^的一位家人。",signature:"",friendOrigin:{kind:"surprise",source:"自称 · 先生^^的家人",intent:"因为在意先生^^而来",requestMsg:"我是先生^^的家人"}};
ctx.S.contacts.push(oldLinked);
assert.equal(ctx.api.friendDiscoveryRepairRoleName(oldLinked),true);
assert.doesNotMatch(JSON.stringify(oldLinked),/先生/);
assert.match(JSON.stringify(oldLinked),/顾沉/);

const prompt = ctx.api.friendOriginPrompt({
  friendOrigin: { source: "抖音 · 关注了你", intent: "想从公开关注走到真正认识", requestMsg: "想认识你", acceptedAt: Date.now() - 60000 },
  _deleteCount: 0,
});
assert.match(prompt, /想从公开关注走到真正认识/);
assert.match(prompt, /刚正式成为微信好友/);

console.log("new friends tests passed");
