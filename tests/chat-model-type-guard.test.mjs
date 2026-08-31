import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0, quote = "", escaped = false, regex = false, regexClass = false, prev = "";
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (regex) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "[") regexClass = true;
      else if (ch === "]") regexClass = false;
      else if (ch === "/" && !regexClass) regex = false;
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "/" && source[i + 1] !== "/" && source[i + 1] !== "*" && /[=(,:;!&|?\[{]/.test(prev)) { regex = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
    if (!/\s/.test(ch)) prev = ch;
  }
  throw new Error(`unterminated ${name}`);
}

const fields = {
  s_cbase: { value: "https://chat.example/v1" },
  s_ckey: { value: "sk-chat" },
  s_cmodel: { value: "speech-2.8-hd", focused: 0, selected: 0, focus() { this.focused++; }, select() { this.selected++; } },
  s_xbase: { value: "" },
  s_xkey: { value: "" },
  s_xmodel: { value: "gpt-4o-mini" },
  testC: { style: {}, textContent: "" },
  testX: { style: {}, textContent: "" },
};
let fetches = 0;
let response = { ok: true, status: 200, text: async () => "" };
const context = vm.createContext({
  CHAT_ROUTE_NAMES: ["路线一", "路线二", "路线三", "路线四"],
  S: { settings: { chatRouteActive: 0 } },
  $: (selector) => fields[String(selector).replace(/^#/, "")] || null,
  fetchT: async () => { fetches++; return response; },
  apiErrorCN: () => "接口错误",
  apiCaughtCN: (e) => String(e && e.message || e),
});
for (const name of ["chatModelIsTtsOnly", "chatModelTypeError", "chatModelAssertText", "testModel"]) {
  const fn = functionSource(name);
  vm.runInContext(name === "testModel" ? "async " + fn : fn, context);
}

assert.equal(context.chatModelIsTtsOnly("SPEECH-2.8-HD"), true);
assert.equal(context.chatModelIsTtsOnly("vendor/speech_02_turbo"), true);
assert.equal(context.chatModelIsTtsOnly("tts-1-hd"), true);
assert.equal(context.chatModelIsTtsOnly("gpt-4o-mini-tts"), true);
assert.equal(context.chatModelIsTtsOnly("speechless-chat"), false);
assert.equal(context.chatModelIsTtsOnly("gpt-4.1-mini"), false);

assert.throws(
  () => context.chatModelAssertText("speech-2.8-hd", "主聊天模型"),
  (error) => error && error.code === "chat-model-is-tts" && /语音合成模型/.test(error.message),
);
assert.doesNotThrow(() => context.chatModelAssertText("gpt-4o-mini", "主聊天模型"));

await context.testModel("s_cbase", "s_ckey", "s_cmodel", "testC", "gpt-4o-mini");
assert.equal(fetches, 0, "testing a TTS-only model must stop before the network request");
assert.match(fields.testC.textContent, /只能填在「语音模型 \/ TTS」里/);
assert.equal(fields.s_cmodel.focused, 1);
assert.equal(fields.s_cmodel.selected, 1);

fields.s_cmodel.value = "gpt-4o-mini";
await context.testModel("s_cbase", "s_ckey", "s_cmodel", "testC", "gpt-4o-mini");
assert.equal(fetches, 1, "a normal chat model must keep using the existing test request");
assert.match(fields.testC.textContent, /连接成功/);
assert.match(fields.testC.textContent, /路线一 · 主模型「gpt-4o-mini」/);

response = { ok: false, status: 503, text: async () => '{"error":{"message":"upstream worker overloaded"}}' };
await context.testModel("s_cbase", "s_ckey", "s_cmodel", "testC", "gpt-4o-mini");
assert.equal(fetches, 2);
assert.match(fields.testC.textContent, /路线一 · 主模型「gpt-4o-mini」测试失败/);
assert.match(fields.testC.textContent, /接口错误/);

console.log("chat model type guard tests passed");
