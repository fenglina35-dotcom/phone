import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(source, /function accountMessageKey\(cid,aid\)/);
assert.match(source, /function msgsForAccount\(id,aid\)/);
assert.match(source, /# 当前联系人的独立身份（最高优先级）/);
assert.match(source, /严禁猜测、暗示或声称ta是任何其他联系人换号、切换身份、同一个人/);
assert.doesNotMatch(source, /# 当前聊天身份（小号与大号严格分开）/);
assert.doesNotMatch(source, /现在跟你聊天的是小号身份/);
assert.match(source, /if\(_main\)\{if\(!_natural\)\{const av=affNow\(c\)/);
assert.match(source, /if\(_main&&!_natural&&!opt\.selectiveMemory\)\{const _pd=powerDynamicPrompt/);
assert.doesNotMatch(source, /# 有别人加过你微信、和你聊过/);
assert.doesNotMatch(source, /if\(aid==='main'\)setTimeout\(triggerAltReports/);
assert.match(source, /# 姓名与称呼边界（重要）[\s\S]*?忆北的小手机[\s\S]*?应用\/设备名称/);

assert.match(source, /function accountDeleteTap\(ev,id\)/);
assert.match(source, /aria-label="删除小号"/);
assert.doesNotMatch(source, /ontouchend="accountSwitchTap\(event/);
assert.doesNotMatch(source, /onpointerup="accountSwitchTap\(event/);

const start = source.indexOf("let _replyTimers={};");
const end = source.indexOf("/* 提示音 + 通知 */", start);
assert.ok(start >= 0 && end > start, "reply scheduler block must exist");

let active = "main";
const timers = [];
const calls = [];
const sandbox = {
  S: { settings: { replyDelay: 0, manualReply: false } },
  manualReplySceneOn: () => false,
  actId: () => active,
  accountMessageKey: (id, aid) => (aid === "main" ? id : `${id}#${aid}`),
  offlineFocusActive: () => false,
  wxLoginBlockReply: () => false,
  _call: null,
  cur: () => ({ p: "wechat" }),
  render() {},
  hasPendingVision: () => false,
  getC: () => ({ blocked: false }),
  msgsForAccount: () => [],
  msgToText: () => "",
  $: () => null,
  setTimeout(fn) {
    timers.push(fn);
    return timers.length;
  },
  clearTimeout() {},
  aiReply(id, note, token, aid) {
    calls.push({ id, note, token, aid });
  },
};

vm.runInNewContext(
  source.slice(start, end) +
    ";scheduleReply('role_1');globalThis.deferred=_replyDeferred;" +
    "globalThis.resume=function(aid){resumeAccountReplies(aid)};" +
    "globalThis.delayed=function(id,note,delay,aid){delayedAccountReply(id,note,delay,aid)};",
  sandbox,
);

assert.equal(timers.length, 1);
active = "alt_1";
timers.shift()();
assert.equal(calls.length, 0, "reply must not run under the newly selected account");
assert.ok(sandbox.deferred.role_1, "main-account reply should be deferred under the main thread key");

active = "main";
sandbox.resume("main");
assert.equal(timers.length, 1);
timers.shift()();
assert.deepEqual(calls, [{ id: "role_1", note: undefined, token: 0, aid: "main" }]);

sandbox.delayed("role_2", "main follow-up", 1500, "main");
assert.equal(timers.length, 1);
active = "alt_1";
timers.shift()();
assert.equal(calls.length, 1, "delayed follow-up must also stay out of the alt account");
assert.ok(sandbox.deferred.role_2);
active = "main";
sandbox.resume("main");
timers.shift()();
assert.deepEqual(calls[1], { id: "role_2", note: "main follow-up", token: 0, aid: "main" });

console.log("account isolation tests passed");
