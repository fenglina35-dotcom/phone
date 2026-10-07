import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

assert.match(source, /const MUSIC_AUDIO_FILE_ACCEPT='\.mp3,\.m4a/);
assert.match(source, /const MUSIC_VIDEO_FILE_ACCEPT='\.mp4,\.m4v/);
assert.match(source, /function mPickAudioFile\(\)/);
assert.match(source, /function mPickVideoFile\(\)/);
assert.doesNotMatch(source, /pickFile\('audio\/\*,video\/\*'/);

const sandbox = { S: { settings: { web: { enabled: true } } } };
vm.createContext(sandbox);
vm.runInContext(
  `${functionSource("localPersonalStateQuery")}
   ${functionSource("autoWebQuery")}
   this.api={localPersonalStateQuery,autoWebQuery};`,
  sandbox,
);

assert.equal(sandbox.api.autoWebQuery("刚刚有人给你发消息吗？", {}), "");
assert.equal(sandbox.api.autoWebQuery("刚才谁加你微信了？", {}), "");
assert.equal(sandbox.api.autoWebQuery("帮我联网查一下今天的新闻", {}), "");

assert.match(source, /function altReportDeliverLocal\(c,info\)/);
assert.match(source, /_altReportLocalFallback:true/);
assert.match(source, /严禁逐句复读聊天/);
assert.match(source, /严禁逐句复读聊天、列出“某某：\/我：”/);
assert.doesNotMatch(source, /最近大概聊的是：/);

console.log("v965 iOS music picker and alt-account report tests passed");
