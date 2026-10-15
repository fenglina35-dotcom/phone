import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";

// 私人版：小家里当面说的话(_cozy)与微信消息共用一条记忆，但发给角色的历史要标明
// 线下/线上切换，离开小家后的普通微信聊天不受影响。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_APP = process.env.COZY_SCENE_APP || path.join(root, "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js");
const source = fs.readFileSync(PRIVATE_APP, "utf8");

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

const ctx = { dayKey: t => new Date(t).toDateString(), chatHistoryDateNote: () => "DATE", msgToText: m => m.content };
vm.createContext(ctx);
vm.runInContext(functionSource("chatHistoryWithDateBoundaries"), ctx);
// vm 内的数组原型不同，转成本上下文的普通数据再比较。
const history = list => JSON.parse(JSON.stringify(ctx.chatHistoryWithDateBoundaries(list)));
const day = new Date(2026, 9, 15, 20).getTime();
const msg = (role, content, cozy, i) => ({ role, content, time: day + i * 1000, ...(cozy ? { _cozy: true } : {}) });
const notes = rows => rows.filter(r => r.role === "system" && r.content !== "DATE").map(r => r.content);

test("ordinary WeChat history gains no scene notes", () => {
  const rows = history([msg("user", "在吗", false, 0), msg("assistant", "在", false, 1)]);
  assert.deepEqual(notes(rows), []);
  assert.deepEqual(rows.map(r => r.content), ["DATE", "在吗", "在"]);
});

test("entering and leaving the cozy home are marked in the shared history", () => {
  const rows = history([
    msg("user", "微信1", false, 0), msg("user", "当面1", true, 1), msg("assistant", "当面2", true, 2),
    msg("user", "回到微信", false, 3), msg("assistant", "嗯", false, 4)
  ]);
  const text = rows.map(r => r.content);
  const home = text.findIndex(t => /面对面相处/.test(t)), online = text.findIndex(t => /已离开小家/.test(t));
  assert.ok(home > text.indexOf("微信1") && home < text.indexOf("当面1"), "进入小家的提示必须在第一句当面对话之前");
  assert.ok(online > text.indexOf("当面2") && online < text.indexOf("回到微信"), "离开小家的提示必须在回到微信的第一句之前");
  assert.equal(notes(rows).length, 2);
  assert.ok(!/North/.test(source.slice(source.indexOf("function chatHistoryWithDateBoundaries"), source.indexOf("function chatHistoryWithDateBoundaries") + 1200)), "共用文件不得写入用户名字");
});

test("a history that ends inside the cozy home is labelled face to face", () => {
  const rows = history([msg("user", "到家啦", true, 0), msg("assistant", "欢迎回来", true, 1)]);
  assert.equal(notes(rows).length, 1);
  assert.match(notes(rows)[0], /小家里面对面/);
});
