import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
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

assert.match(source, /const CHAT_ROUTE_NAMES=\['路线一','路线二','路线三','路线四'\]/);
assert.match(source, /data-chat-route="\$\{i\}"/);
assert.match(source, /chatFunctionItem\('API路线','route','chatRouteQuickOpen\(\)'\)/);
assert.match(source, /function chatRouteQuickOpen\(\)/);
assert.match(source, /每条路线同时保存主聊天的地址、Key、模型、随机度、回复长度，以及辅助模型的地址、Key、模型/);
assert.equal((source.match(/onclick="chatRouteSaveCurrent\(\)"/g) || []).length, 2, "both model headers need a nearby save button");
assert.match(source, /routes\[routeActive\]=chatRouteCopy\(Object\.assign\(\{\},S\.settings\.chat,\{aux:S\.settings\.aux\}\)\)/);
assert.match(functionSource("chatAPI"), /chatModelAssertText\(guardModel,opt\.aux\?'辅助模型':'聊天模型'\)/, "every real chat request must reject a TTS-only model before calling the API");

const fields = {
  s_cbase: { value: "https://one.example/v1" },
  s_ckey: { value: "sk-one" },
  s_cmodel: { value: "model-one" },
  s_ctemp: { value: "0.7" },
  s_cmax: { value: "800" },
  s_xbase: { value: "https://aux-one.example/v1" },
  s_xkey: { value: "sk-aux-one" },
  s_xmodel: { value: "aux-one" },
  testC: { textContent: "old" },
  testX: { textContent: "old-aux" },
};
let currentPage = { p: 'settings' };
const context = vm.createContext({
  S: { settings: { chat: { base: "https://old.example/v1", key: "sk-old", model: "old", temp: 0.8, maxTokens: 900 }, aux: { base: "https://legacy-aux.example/v1", key: "sk-legacy-aux", model: "legacy-aux" } } },
  CHAT_ROUTE_NAMES: ["路线一", "路线二", "路线三", "路线四"],
  $: (selector) => fields[String(selector).replace(/^#/, "")] || null,
  document: { querySelectorAll: () => [] },
  save: () => { context.saved = (context.saved || 0) + 1; },
  toast: (text) => { context.toastText = text; },
  openModal: (html) => { context.modalHtml = html; },
  closeModal: () => { context.closed = (context.closed || 0) + 1; },
  render: () => { context.rendered = (context.rendered || 0) + 1; },
  esc: (text) => String(text ?? ""),
  cur: () => currentPage,
  getC: id => (context.S.contacts || []).find(contact => contact.id === id) || null,
  roleServerPushSync: () => { context.serverPushSynced = (context.serverPushSynced || 0) + 1; },
});
for (const name of ["chatModelIsTtsOnly", "chatModelTypeError", "chatMainCopy", "chatAuxCopy", "chatRouteCopy", "chatRoutesInit", "chatRouteContextContact", "roleChatRouteIndex", "chatRouteCurrentIndex", "chatModelPairError", "chatModelFormReady", "chatRouteSummary", "chatRouteCaptureForm", "chatRouteApply", "chatRouteFillForm", "chatRouteRefreshUI", "chatRouteSwitch", "chatRouteSaveCurrent", "chatRouteQuickOpen", "chatRouteQuickSwitch"]) {
  vm.runInContext(functionSource(name), context);
}

assert.equal(context.chatModelIsTtsOnly("speech-2.8-hd"), true);
assert.equal(context.chatModelIsTtsOnly("speech-02-turbo"), true);
assert.equal(context.chatModelIsTtsOnly("gpt-4o-mini-tts"), true);
assert.equal(context.chatModelIsTtsOnly("gpt-4o-mini"), false);
assert.equal(context.chatModelIsTtsOnly("claude-3-5-sonnet"), false);

let routes = context.chatRoutesInit();
assert.equal(routes.length, 4);
assert.equal(routes[0].base, "https://old.example/v1");
assert.equal(routes[0].aux.model, "legacy-aux", "the existing global auxiliary model must migrate into the first route");
assert.equal(routes[1].base, "");

context.chatRouteSwitch(1);
assert.equal(context.S.settings.chatRoutes[0].key, "sk-one", "switching must save the current form first");
assert.equal(context.S.settings.chatRoutes[0].aux.key, "sk-aux-one", "switching must save the auxiliary form with the main form");
assert.equal(context.S.settings.chatRouteActive, 1);
assert.equal(context.S.settings.chat.base, "");
assert.equal(context.S.settings.aux.model, "");
assert.equal(fields.s_cbase.value, "");
assert.equal(fields.s_xmodel.value, "");
assert.equal(fields.testC.textContent, "");
assert.equal(fields.testX.textContent, "");

fields.s_cbase.value = "https://two.example/v1";
fields.s_ckey.value = "sk-two";
fields.s_cmodel.value = "model-two";
fields.s_ctemp.value = "0.5";
fields.s_cmax.value = "1200";
fields.s_xbase.value = "https://aux-two.example/v1";
fields.s_xkey.value = "sk-aux-two";
fields.s_xmodel.value = "aux-two";
context.chatRouteSwitch(0);
assert.equal(context.S.settings.chatRoutes[1].base, "https://two.example/v1");
assert.equal(context.S.settings.chatRoutes[1].aux.model, "aux-two");
assert.equal(context.S.settings.chat.key, "sk-one");
assert.equal(context.S.settings.aux.key, "sk-aux-one");
assert.equal(fields.s_cmodel.value, "model-one");
assert.equal(fields.s_xmodel.value, "aux-one");
assert.equal(context.saved, 2);

fields.s_cmodel.value = "model-one-edited";
fields.s_xmodel.value = "aux-one-edited";
context.chatRouteSwitch(0);
assert.equal(context.S.settings.chat.model, "model-one-edited", "clicking the active route must not restore stale values");
assert.equal(context.S.settings.aux.model, "aux-one-edited", "clicking the active route must keep the edited auxiliary model too");
assert.equal(fields.s_cmodel.value, "model-one-edited");
assert.equal(context.saved, 3);

fields.s_xkey.value = "sk-aux-one-saved-nearby";
context.chatRouteSaveCurrent();
assert.equal(context.S.settings.chatRoutes[0].aux.key, "sk-aux-one-saved-nearby", "the nearby save button must persist both model groups");
assert.match(context.toastText, /主聊天＋辅助模型/);

const savedBeforeTtsMistake = context.saved;
fields.s_cmodel.value = "speech-2.8-hd";
assert.equal(context.chatRouteSaveCurrent(), false, "a TTS-only main model must not be saved into a chat route");
assert.equal(context.S.settings.chat.model, "model-one-edited", "rejecting the invalid form must preserve the last valid chat model");
assert.equal(context.saved, savedBeforeTtsMistake, "rejecting a TTS-only model must not persist anything");
assert.match(context.toastText, /只能填在「语音模型 \/ TTS」里/);
fields.s_cmodel.value = "model-one-edited";

fields.s_xmodel.value = "gpt-4o-mini-tts";
assert.equal(context.chatRouteSwitch(1), false, "switching routes must not silently save a TTS-only auxiliary model");
assert.equal(context.S.settings.chatRouteActive, 0);
fields.s_xmodel.value = "aux-one-edited";

context.S.settings.chatRoutes[2] = { base: "https://three.example/v1", key: "sk-three", model: "model-three", temp: 0.4, maxTokens: 700, aux: { base: "https://aux-three.example/v1", key: "sk-aux-three", model: "aux-three" } };
context.chatRouteQuickOpen();
assert.match(context.modalHtml, /API/);
assert.equal(context.chatRouteQuickSwitch(2), true);
assert.equal(context.S.settings.chatRouteActive, 2);
assert.equal(context.S.settings.chat.model, "model-three");
assert.equal(context.S.settings.aux.model, "aux-three", "quick switching must restore the route's auxiliary model");
assert.equal(context.closed, 1);
assert.equal(context.rendered, 1);

context.S.settings.chatRoutes[3] = { base: "", key: "", model: "" };
assert.equal(context.chatRouteQuickSwitch(3), false, "blank quick routes must not replace a working route");
assert.equal(context.S.settings.chatRouteActive, 2);

context.S.settings.chatRoutes[3] = { base: "https://voice.example/v1", key: "voice", model: "speech-2.8-hd", aux: { base: "", key: "", model: "" } };
assert.equal(context.chatRouteQuickSwitch(3), false, "an old saved route containing a TTS model must be blocked when activated");
assert.equal(context.S.settings.chatRouteActive, 2);

context.S.contacts = [
  { id: 'role-a', name: '角色甲' },
  { id: 'role-b', name: '角色乙' },
];
currentPage = { p: 'chat', id: 'role-a' };
assert.equal(context.chatRouteQuickSwitch(0), true);
assert.equal(context.S.contacts[0].chatRouteIndex, 0, 'the current role stores its own route');
assert.equal(context.S.contacts[1].chatRouteIndex, undefined, 'switching role A must not mutate role B');
assert.equal(context.S.settings.chatRouteActive, 2, 'switching a role must not mutate the global default route');
currentPage = { p: 'off', id: 'role-b' };
assert.equal(context.chatRouteQuickSwitch(1), true, 'the role route button in an offline scene must still target that role');
assert.equal(context.S.contacts[0].chatRouteIndex, 0);
assert.equal(context.S.contacts[1].chatRouteIndex, 1);
assert.equal(context.roleChatRouteIndex(context.S.contacts[0]), 0);
assert.equal(context.roleChatRouteIndex(context.S.contacts[1]), 1);
assert.equal(context.S.settings.chatRouteActive, 2);
currentPage = { p: 'settings' };

context.S.settings.chatRoutes = [
  { base: "https://legacy-one.example/v1", key: "one", model: "legacy-one" },
  { base: "https://legacy-two.example/v1", key: "two", model: "legacy-two" },
  { base: "https://explicit-empty.example/v1", key: "three", model: "explicit-empty", aux: { base: "", key: "", model: "" } },
];
context.S.settings.aux = { base: "https://shared-aux.example/v1", key: "shared", model: "shared-aux" };
routes = context.chatRoutesInit();
assert.equal(routes[0].aux.model, "shared-aux");
assert.equal(routes[1].aux.model, "shared-aux", "all legacy routes must inherit the previous global auxiliary model without data loss");
assert.equal(routes[2].aux.model, "", "an explicitly empty auxiliary model must stay empty instead of being overwritten by migration");

console.log("api route tests passed");
