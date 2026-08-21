import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const markers = [`function ${name}(`, `async function ${name}(`];
  const starts = markers.map(x => source.indexOf(x)).filter(x => x >= 0);
  assert.ok(starts.length, `missing ${name}`);
  const start = Math.min(...starts), brace = source.indexOf("{", start);
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

test("chat archive stamp is bounded to conversation edges and tracks real list changes", () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource("messageArchiveStamp")};globalThis.stamp=messageArchiveStamp;`, context);
  const store = { role: [
    { id: "first", time: 1, role: "user", content: "hello" },
    { id: "middle", time: 2, role: "assistant", content: "kept" },
    { id: "last", time: 3, role: "user", content: "world" },
  ] };
  const first = context.stamp(store);
  store.role.push({ id: "new", time: 4, role: "assistant", content: "reply" });
  const appended = context.stamp(store);
  assert.notEqual(appended, first);
  store.role.at(-1).read = true;
  assert.notEqual(context.stamp(store), appended);
  store.role.splice(1, 1);
  assert.notEqual(context.stamp(store), appended);
  assert.doesNotMatch(functionSource("messageArchiveStamp"), /for\(const m of rows\)/);
});

test("multi-select deletion flushes the updated large chat archive before success", async () => {
  const writes = [], events = [];
  const context = vm.createContext({
    S: { messages: { role: [{ id: "kept", content: "x".repeat(22000) }] } },
    _heavy: {},
    _heavyStamp: {},
    _heavyReady: new Set(),
    _messageArchiveWrite: Promise.resolve(),
    imgPut: async (key, value) => { writes.push({ key, value }); events.push("archive"); },
    imgDel: async key => { events.push(`delete:${key}`); },
    saveNowAsync: async () => { events.push("core"); return true; },
  });
  for (const name of ["messageArchiveStamp", "writeMessageArchive", "deleteMessageArchive", "persistWechatMessagesNow"])
    vm.runInContext(`${functionSource(name)};globalThis.${name}=${name};`, context);
  assert.equal(await context.persistWechatMessagesNow(), true);
  assert.deepEqual(events, ["archive", "core"]);
  assert.equal(writes[0].key, "__messages");
  assert.equal(JSON.parse(writes[0].value).role.length, 1);
  assert.match(functionSource("delSelected"), /await persistWechatMessagesNow\(\)/);
  assert.match(functionSource("doClear"), /await persistWechatMessagesNow\(\)/);
});

test("a small post-delete chat state removes the stale large archive first", async () => {
  const events = [];
  const context = vm.createContext({
    S: { messages: { role: [{ id: "kept", content: "short" }] } },
    _heavy: { messages: "old" },
    _heavyStamp: { messages: "old" },
    _heavyReady: new Set(["messages"]),
    _messageArchiveWrite: Promise.resolve(),
    imgPut: async () => {},
    imgDel: async key => { events.push(`delete:${key}`); },
    saveNowAsync: async () => { events.push("core"); return true; },
  });
  for (const name of ["messageArchiveStamp", "writeMessageArchive", "deleteMessageArchive", "persistWechatMessagesNow"])
    vm.runInContext(`${functionSource(name)};globalThis.${name}=${name};`, context);
  await context.persistWechatMessagesNow();
  assert.deepEqual(events, ["delete:__messages", "core"]);
  assert.equal(context._heavyReady.has("messages"), false);
});
