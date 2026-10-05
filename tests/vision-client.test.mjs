import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const marker = `function ${name}`;
  const found = source.indexOf(marker);
  assert.ok(found >= 0, `missing ${name}`);
  const start = source.slice(Math.max(0, found - 6), found) === "async " ? found - 6 : found;
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
    if (ch === "/" && source[i + 1] !== "/" && source[i + 1] !== "*" && (/[=(,:;!&|?\[{]/.test(prev) || /\b(?:return|case|throw)\s*$/.test(source.slice(Math.max(start, i - 20), i)))) { regex = true; regexClass = false; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
    if (!/\s/.test(ch)) prev = ch;
  }
  throw new Error(`unterminated ${name}`);
}

const calls = [];
const context = vm.createContext({
  URL,
  S: { settings: { chat: { base: "https://relay.test/v1", key: "secret", model: "claude-opus-4-6" }, vision: { base: "https://relay.test/v1", key: "secret", model: "gemini-2.5-pro", protocols: {} } } },
  aiCoreOn: () => false,
  fetchT: async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "看到了" }] }) };
  },
});
vm.runInContext("let _visionLast={},_visionModelCache={};", context);

for (const name of [
  "uniq", "visionModels", "visionImagePart", "visionNoImageText", "roleImageFailureText", "visionText",
  "visionData", "visionNativeURL", "visionIsClaude", "visionErrKind", "visionConfigured", "visionRouteKey",
  "visionChatRouteKey", "visionBackupSameAsChat", "visionFailure", "visionRelayFailure", "visionCacheableFailure",
  "visionMarkChatFailure", "visionClearChatFailure", "visionChatSkipped", "visionRelayMessages",
  "visionPostOpenAI", "visionPostAnthropic", "visionAvailableModels", "visionFallbackModels",
  "visionTryModel", "visionTryChat", "visionTryBackup", "visionAPI", "quoteContextText", "msgToText",
]) vm.runInContext(functionSource(name), context);

assert.equal(context.visionNativeURL("https://vg.v1api.cc/v1"), "https://vg.v1api.cc/v1/messages");
assert.equal(context.visionNativeURL("https://api.anthropic.com/"), "https://api.anthropic.com/v1/messages");
assert.equal(context.visionNativeURL("https://x.test/v1/chat/completions"), "https://x.test/v1/messages");

assert.equal(context.visionText({ choices: [{ message: { content: "OpenAI string" } }] }), "OpenAI string");
assert.equal(context.visionText({ choices: [{ message: { content: [{ type: "text", text: "parts" }] } }] }), "parts");
assert.equal(context.visionText({ content: [{ type: "text", text: "Anthropic" }] }), "Anthropic");
assert.match(context.msgToText({ role: "user", type: "text", content: "补上", quote: { who: "ta", text: "车里那张" } }), /车里那张/);
assert.match(context.msgToText({ role: "user", type: "text", content: "之前那张补上", quote: { who: "me", text: "小狗看主人的皮鞋" } }), /小狗看主人的皮鞋/);
assert.match(context.msgToText({ role: "user", type: "voice", content: "就这句", quote: { who: "me", text: "刚才那张照片" } }), /刚才那张照片/);
assert.equal(context.visionNoImageText("没有看到任何图片附件"), true);
assert.equal(context.roleImageFailureText("图片识别失败了，你说给我听"), true);
assert.match(context.msgToText({ role: "user", type: "image", visionState: "pending", desc: "" }), /先等待识图完成/);
assert.match(context.msgToText({ role: "user", type: "image", visionState: "success", desc: "一只白猫" }), /已经看到了真实画面/);

const dataURL = "data:image/jpeg;base64,QUJD";
await context.visionPostOpenAI("https://relay.test/v1", "secret", "gemini-2.5-pro", dataURL, "读图", true);
assert.equal(calls[0].url, "https://relay.test/v1/chat/completions");
assert.equal(calls[0].body.messages[0].content[0].type, "image_url");
assert.equal(calls[0].body.messages[0].content[1].type, "text");

await context.visionPostAnthropic("https://vg.v1api.cc/v1", "secret", "claude-opus-4-6", dataURL, "读图");
assert.equal(calls[1].url, "https://vg.v1api.cc/v1/messages");
assert.equal(calls[1].body.messages[0].content[0].type, "image");
assert.equal(calls[1].body.messages[0].content[0].source.data, "QUJD");
assert.equal(calls[1].body.messages[0].content[1].type, "text");
assert.equal(calls[1].options.headers["anthropic-version"], "2023-06-01");

const directBefore = calls.length;
assert.ok(await context.visionAPI(dataURL, "先由聊天模型直接看图"));
assert.equal(calls.length - directBefore, 1, "a successful chat vision route must not call the backup route");
assert.equal(vm.runInContext("_visionLast.route", context), "chat");

const fallbackCalls = [];
context.fetchT = async (url, options = {}) => {
  const body = options.body ? JSON.parse(options.body) : null;
  fallbackCalls.push({ url, body });
  if (url.endsWith("/models")) return { ok: true, status: 200, json: async () => ({ data: [{ id: "claude-opus-4-6" }, { id: "gemini-2.5-pro" }] }) };
  if (url.endsWith("/messages")) return { ok: false, status: 404, json: async () => ({ error: { message: "not found" } }) };
  if (body?.model === "claude-opus-4-6") return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "没有看到任何图片附件" } }] }) };
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "备用模型看到了白猫" } }] }) };
};
assert.equal(await context.visionAPI(dataURL, "描述图片"), "备用模型看到了白猫");
assert.equal(context.S.settings.vision.lastGoodModel, "gemini-2.5-pro");
assert.match(context.S.settings.vision.chatImageFailedKey, /claude-opus-4-6/);
assert.equal(fallbackCalls.filter(x => x.body?.model === "claude-opus-4-6").length, 2);
const beforeSecond = fallbackCalls.length;
assert.equal(await context.visionAPI(dataURL, "再描述一次"), "备用模型看到了白猫");
assert.equal(fallbackCalls.slice(beforeSecond).filter(x => x.body?.model === "claude-opus-4-6").length, 0);
assert.equal(fallbackCalls.slice(beforeSecond).filter(x => x.body?.model === "gemini-2.5-pro").length, 1);

context.aiCoreOn = () => false;
context.S.settings.chat = { base: "https://same.test/v1", key: "same", model: "gpt-4o-mini" };
context.S.settings.vision = { base: "https://same.test/v1", key: "same", model: "gpt-4o-mini", protocols: {} };
assert.equal(context.visionBackupSameAsChat(context.S.settings.vision, context.S.settings.chat), true);
const duplicateBefore = fallbackCalls.length;
await assert.rejects(context.visionTryBackup(dataURL, "不应重复请求", "gpt-4o-mini"), /阻止重复识别/);
assert.equal(fallbackCalls.length, duplicateBefore, "an identical backup must be rejected before any HTTP request");

const imageBubble = functionSource("buildPart");
assert.doesNotMatch(imageBubble, /正在让聊天模型看图片|图片理解失败 · 点这里重试|已看清|备用.*聊天模型/);
assert.match(imageBubble, /msgMenu\('\$\{c\.id\}','\$\{m\.id\}'\)/, "the image bubble must open the message menu without an out-of-character status caption");

console.log("vision client protocol tests passed");
