import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const asyncStart = source.indexOf(`async function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}`);
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

assert.match(source, /onclick="importBeautyData\(\)"/);
assert.match(source, /d&&d\.type==='north-beauty-pack'/);
assert.match(source, /navigator\.share\(\{files:\[file\],title:name\}\)/);

const oldChat = [{ content: "keep chat" }];
const S = {
  me: {
    avatar: "old-avatar", persona: "keep persona", homeBg: "old-bg", appIcons: {},
    widgets: ["dashboard", "vinyl", "sweetie"],
    appLayout: [["wechat"], ["music"], []],
    homeLayout: [["w:dashboard", "wechat"], ["music"], []],
    appDock: ["calendar", "games", "mail", "settings"],
    homeReferenceAppSlots: { wechat: 3 },
    _glassReferenceLayoutV2: 1,
    _glassSecondPageLayoutV1: 1,
    phoneFriend: { id: "pf-1", messages: { one: oldChat }, bubbleStyle: { old: true } },
  },
  phoneapp: { roleAvatars: {}, regions: {}, sms: { one: oldChat } },
  music: { songs: [{ id: "song-1" }], bg: "old-music-bg" },
  contacts: [{ id: "c1", name: "Role", persona: "keep role persona", avatar: "old-role", chatBg: "" }],
  groups: [{ id: "g1", name: "Group", members: ["c1"], avatar: "old-group" }],
  settings: { chat: { key: "keep-api" } },
};
const primed = [];
let saved = 0, rendered = 0, lockRendered = 0;
const context = vm.createContext({
  S,
  phoneFriendState: () => S.me.phoneFriend,
  phState: () => S.phoneapp,
  isBigImg: (v) => typeof v === "string" && v.startsWith("data:image") && v.length > 2000,
  primeImageForSave: async (v) => { primed.push(v); },
  saveNowAsync: async () => { saved++; return true; },
  render: () => { rendered++; },
  renderLockScreen: () => { lockRendered++; },
});

for (const name of ["beautyClone", "beautyAssign", "beautyLayoutSnapshot", "beautyLayoutRestore", "beautyFind", "mergeBeautyPack", "primeBeautyPackImages", "applyBeautyPack"]) {
  vm.runInContext(functionSource(name), context);
}
vm.runInContext(source.match(/const BEAUTY_ME_KEYS=\[[^;]+;/)[0], context);
vm.runInContext(source.match(/const BEAUTY_LAYOUT_KEYS=\[[^;]+;/)[0], context);

const originalLayout = JSON.parse(JSON.stringify({
  widgets: S.me.widgets,
  appLayout: S.me.appLayout,
  homeLayout: S.me.homeLayout,
  appDock: S.me.appDock,
  homeReferenceAppSlots: S.me.homeReferenceAppSlots,
  _glassReferenceLayoutV2: S.me._glassReferenceLayoutV2,
  _glassSecondPageLayoutV1: S.me._glassSecondPageLayoutV1,
}));

const image = "data:image/png;base64," + "x".repeat(2200);
const pack = {
  type: "north-beauty-pack", ver: 1,
  me: {
    avatar: image, homeBg: image, appIcons: { wechat: image }, persona: "must not import",
    widgets: ["sweetie"], appLayout: [["music"]], homeLayout: [["w:sweetie", "music"]],
    appDock: ["music"], homeReferenceAppSlots: { music: 0 },
    _glassReferenceLayoutV2: 0, _glassSecondPageLayoutV1: 0,
  },
  phoneFriend: { bubbleStyle: { bg: "pink" }, messages: { bad: true } },
  phoneapp: { roleAvatars: { c1: image }, sms: { bad: true } },
  music: { bg: image, songs: [{ id: "bad" }] },
  contacts: [{ id: "c1", avatar: image, chatBg: image, bubbleStyle: { glow: true }, persona: "bad" }],
  groups: [{ id: "g1", avatar: image, chatBg: image, memberBubbleStyles: { c1: { bg: "black" } }, members: [] }],
};

const count = await context.applyBeautyPack(pack);
assert.ok(count >= 10);
assert.equal(S.me.homeBg, image);
assert.equal(S.me.persona, "keep persona");
assert.deepEqual(JSON.parse(JSON.stringify({
  widgets: S.me.widgets,
  appLayout: S.me.appLayout,
  homeLayout: S.me.homeLayout,
  appDock: S.me.appDock,
  homeReferenceAppSlots: S.me.homeReferenceAppSlots,
  _glassReferenceLayoutV2: S.me._glassReferenceLayoutV2,
  _glassSecondPageLayoutV1: S.me._glassSecondPageLayoutV1,
})), originalLayout, "beauty import must preserve every home layout field");
assert.deepEqual(S.me.phoneFriend.messages.one, oldChat);
assert.deepEqual(S.phoneapp.sms.one, oldChat);
assert.deepEqual(S.music.songs, [{ id: "song-1" }]);
assert.equal(S.contacts[0].persona, "keep role persona");
assert.deepEqual(S.groups[0].members, ["c1"]);
assert.equal(S.contacts[0].bubbleStyle.glow, true);
assert.equal(S.groups[0].memberBubbleStyles.c1.bg, "black");
assert.equal(primed.length, 1, "duplicate image data should be persisted once");
assert.equal(saved, 1);
assert.equal(rendered, 1);
assert.equal(lockRendered, 1);

await assert.rejects(() => context.applyBeautyPack({ settings: {} }), /not|valid|有效|美化包/);

console.log("beauty import/export tests passed");
