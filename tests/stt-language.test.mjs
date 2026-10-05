import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const direct = source.indexOf(`function ${name}`);
  const asyncStart = source.indexOf(`async function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : direct;
  assert.ok(start >= 0, `missing ${name}`);
  const next = source.indexOf("\nfunction ", start + 9);
  return source.slice(start, next < 0 ? source.length : next);
}

const context = vm.createContext({});
vm.runInContext(functionSource("sttLangCode"), context);
vm.runInContext(functionSource("sttApiLang"), context);
vm.runInContext(functionSource("sttRelayLang"), context);

assert.equal(context.sttLangCode("zh-CN"), "zh-CN");
assert.equal(context.sttLangCode("粤语"), "yue-HK");
assert.equal(context.sttLangCode("yue-HK"), "yue-HK");
assert.equal(context.sttLangCode("英"), "en-US");
assert.equal(context.sttLangCode("en-US"), "en-US");
assert.equal(context.sttLangCode("日"), "ja-JP");
assert.equal(context.sttLangCode("韩"), "ko-KR");
assert.equal(context.sttApiLang("zh-CN"), "zh");
assert.equal(context.sttApiLang("yue-HK"), "zh");
assert.equal(context.sttRelayLang("yue-HK"), "yue");
assert.equal(context.sttApiLang("en-US"), "en");
assert.equal(context.sttApiLang("ja-JP"), "ja");
assert.equal(context.sttApiLang("ko-KR"), "ko");

assert.match(source, /id="s_slang"/);
assert.match(source, /fetchModels\('s_sbase','s_skey','s_smodel'\)/);
assert.match(source, /onclick="testSTT\(\)"/);
assert.match(source, /async function testSTT/);
assert.match(source, /getUserMedia\(\{audio:true\}\)/);
assert.match(source, /await sttRequest\(blob,\{timestamps:true,lang\}\)/);
assert.match(source, /影片“一键提取字幕”不可用/);
assert.match(source, /识别语言（只转写，不翻译）/);
assert.match(source, /英文 → 英文文字/);
assert.match(source, /rawLang=opt\.lang\|\|a\.lang,language=sttApiLang\(rawLang\)/);
assert.match(source, /fd\.append\('language',language\)/);
assert.match(source, /fd\.append\('response_format','verbose_json'\)/);
assert.match(source, /fd\.append\('timestamp_granularities\[\]','segment'\)/);
assert.match(source, /async function sttTranscribeTimed/);
assert.match(source, /r\.lang=sttLangCode\(lang\|\|\(\(S\.settings\.stt\|\|\{\}\)\.lang\)\)/);
assert.match(source, /function callHFStart\(\)\{audioMicRouteCancel\(\);const sr=makeSR\(\)/);
assert.doesNotMatch(source, /function callHFStart\(\)[^}]*makeSR\('zh-CN'\)/);

const timed = vm.createContext({
  sttRequest: async () => ({
    segments: [
      { start: 1.25, end: 2.75, text: " first line " },
      { start: 5, end: 8.5, text: "second   line" },
      { start: null, end: null, text: "bad" },
    ],
  }),
});
vm.runInContext(functionSource("sttTranscribeTimed") + ";globalThis.run=sttTranscribeTimed;", timed);
const timedRows = await timed.run({}, "movie.mp4");
assert.deepEqual(
  JSON.parse(JSON.stringify(timedRows)),
  [
    { start: 1.25, end: 2.75, text: "first line", source: "extract" },
    { start: 5, end: 8.5, text: "second line", source: "extract" },
  ],
);
