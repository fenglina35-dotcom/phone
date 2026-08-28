import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const privateSource = fs.readFileSync(new URL("../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js", import.meta.url), "utf8");

assert.match(source, /function accountMessageKey\(cid,aid\)/);
assert.match(source, /function msgsForAccount\(id,aid\)/);
assert.match(source, /function summaryList\(c,aid\)/);
assert.match(source, /function summaryState\(c,aid\)/);
assert.match(source, /function maybeSummarize\(id,aid\)[\s\S]*?msgsForAccount\(id,aid\)[\s\S]*?summaryList\(c,aid\)[\s\S]*?summaryState\(c,aid\)/);
assert.match(source, /summaryStoreResult\(c,candidate,rt\.imp,'',aid\)/);
assert.match(source, /summarizeCall\(id,kindTxt,sess,aid\)[\s\S]*?msgsForAccount\(id,aid\)/);
assert.match(source, /_accountSummaries/);
assert.match(source, /_accountSummaryState/);
assert.match(source, /# 当前联系人的独立身份（最高优先级）/);
assert.match(source, /严禁猜测、暗示或声称ta是任何其他联系人换号、切换身份、同一个人/);
assert.match(source, /你仍完整记得自己已有一位稳定伴侣/);
assert.match(source, /你已有稳定伴侣[\s\S]*?这条忠诚边界始终有效/);
assert.match(privateSource, /你已有稳定伴侣[\s\S]*?这条忠诚边界始终有效/);
assert.match(privateSource, /【小号最高优先级覆盖】[\s\S]*?这条边界始终有效/);
assert.match(source, /function altAccountReportNote\(note\)/);
assert.match(source, /function altReportReplyMatches\(info,content\)/);
assert.match(source, /内部报备事件时间戳/);
assert.match(source, /if\(_altReportInfo&&!altReportReplyMatches\(_altReportInfo,content\)\)/);
assert.match(source, /if\(_altReportInfo\)msg\._altReportEventTime=/);
assert.match(source, /_naturalOn=wechatNaturalOn\(\)/);
assert.match(privateSource, /_naturalOn=wechatNaturalOn\(\)/);
assert.match(source, /持续纠缠或严重越界时可以单独输出 \[拉黑\]/);
assert.doesNotMatch(source, /# 当前聊天身份（小号与大号严格分开）/);
assert.doesNotMatch(source, /现在跟你聊天的是小号身份/);
assert.match(source, /function rolePriorityPrompt\(\)/);
assert.match(source, /1\. 角色基础人设、身份与说话习惯/);
assert.match(source, /2\. 世界书中的真实设定和明确规则/);
assert.match(source, /3\. 当前真实事件、双方实际做过的事、长期记忆/);
assert.match(source, /function powerOn\(\)\{return false;\}/);
assert.doesNotMatch(source, /# 有别人加过你微信、和你聊过/);
assert.match(source, /if\(aid==='main'\)\{if\(!triggerAltReports\(\)\)resumeAccountReplies\(aid\);\}else resumeAccountReplies\(aid\)/);
assert.match(source, /scheduleReply\(c\.id,note,ok=>/);
assert.match(source, /const delivered=altReportVisibleEvidence\(cc,info\)\|\|\(ok\?false:altReportDeliverLocal\(cc,info\)\)/);
assert.match(source, /replyAccount!=='main'&&!c\.blocked/);
assert.match(source, /content:'你被'\+\(c\.remark\|\|c\.name\)\+'拉黑了'/);
assert.match(source, /function extremeLoveOn\(\)\{return false;\}/);
assert.match(source, /s\+=_main\?memoryResetPrompt\(c\):''/);
assert.match(source, /s\+=_main\?friendOriginPrompt\(c\):''/);
assert.match(source, /s\+=_main\?friendReaddPrompt\(c\):''/);
assert.match(source, /const _offlineLive=_main\?offlineWechatLiveState\(c\):null/);
assert.match(source, /const _cohabLive=_main&&!_offlineLive\?cohabWechatState\(c\):null/);
assert.match(source, /_hlPlan=null/);
assert.match(source, /_relIntent=null/);
assert.match(source, /# 姓名与称呼边界（重要）[\s\S]*?忆北的小手机[\s\S]*?应用\/设备名称/);
assert.doesNotMatch(source, /if\(scope==='main'\)\(c\.summaries\|\|\[\]\)\.forEach/);
assert.doesNotMatch(source, /if\(!c\|\|!isMain\(\)\)return '';const now=Date\.now\(\),items=\[\]/);

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
  altAccountReportNote: () => false,
  replyPendingUserText: () => "",
  featureEventAutoActive: () => false,
  featureEventNoteActive: () => false,
  featureEventNote: (_kind, note) => note,
  wxLoginBlockReply: () => false,
  wxLoginActive: () => false,
  rolePhoneInspectionBlocksOrdinary: () => false,
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
  friendAcceptedAutoNote: () => false,
  friendAcceptedLocalFallback: () => false,
};

vm.runInNewContext(
  "var altAccountReportNote=globalThis.altAccountReportNote,replyPendingUserText=globalThis.replyPendingUserText;" +
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

function extractFunction(name) {
  const marker = `function ${name}(`;
  let start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} must exist`);
  if (source.slice(Math.max(0, start - 6), start) === "async ") start -= 6;
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const reportRole = { id: "role_report", name: "角色", _altReportAt: 0 };
const reportMessages = {
  "role_report#alt_1": [
    { role: "user", type: "text", content: "你好", time: 100 },
    { role: "assistant", type: "text", content: "你好，刚认识。", time: 101 },
  ],
};
const reportCalls = [];
const reportSandbox = {
  S: {
    me: {
      active: "main",
      name: "大号联系人",
      accounts: [
        { id: "main", name: "大号联系人" },
        { id: "alt_1", name: "小号陌生人" },
      ],
    },
    contacts: [reportRole],
    messages: reportMessages,
  },
  isMain: () => true,
  msgToText: m => m.content || "",
  fmtDT: t => `T${t}`,
  msgsForAccount: (id, aid) => reportMessages[aid === "main" ? id : `${id}#${aid}`] || [],
  getC: id => id === reportRole.id ? reportRole : null,
  _altReportInFlight: Object.create(null),
  _altReportRetried: Object.create(null),
  setTimeout: fn => { fn(); return 1; },
  save() {},
  replyTouch() {},
  uid: () => `local_${Date.now()}`,
  wechatTailJournalWrite() {},
  notifyIncoming() {},
  cur: () => ({ p: "wechat" }),
  refreshChatMessages() {},
  render() {},
  scheduleReply: (id, note, onDone) => { reportCalls.push({ id, note, onDone }); return true; },
};
vm.runInNewContext(
  ["altReportReplyMatches", "altReportCleanText", "altReportTopic", "altReportReplyFallback", "altReportSnapshot", "lastAltMsgTime", "altReportVisibleEvidence", "altReportDeliverLocal", "altReportEventStore", "altReportRemember", "repairLegacyAltReportCursor", "triggerAltReports"]
    .map(extractFunction)
    .join("\n") +
    ";globalThis.runReports=triggerAltReports;globalThis.lastTime=lastAltMsgTime;globalThis.reportMatches=altReportReplyMatches;",
  reportSandbox,
);
const reportInfo = { aid: "alt_1", time: 101, who: "小号陌生人", recent: "小号陌生人：你好" };
assert.equal(reportSandbox.reportMatches(reportInfo, "好，那你先忙。"), false, "continuing the previous main-account topic is not a report");
assert.equal(reportSandbox.reportMatches(reportInfo, "刚才有个人联系了我。"), false, "a generic contact from the previous main-account topic is not enough for a named alt report");
assert.equal(reportSandbox.reportMatches(reportInfo, "刚才小号陌生人用另一个微信号联系了我。"), true, "a concrete account-contact statement is a report");
assert.equal(reportSandbox.lastTime("role_report"), 101);
reportSandbox.runReports();
assert.equal(reportCalls.length, 1, "first alt conversation must be reported once after returning to main");
assert.match(reportCalls[0].note, /独立联系人/);
assert.match(reportCalls[0].note, /最近内容/);
assert.match(reportCalls[0].note, /不能否认、不能说不记得、不能联网查/);
assert.match(reportCalls[0].note, /不要猜测两个账号是同一个人/);
assert.equal(reportRole._altReportAt, 0, "alt activity must not be consumed before a visible report succeeds");
reportSandbox.runReports();
assert.equal(reportCalls.length, 1, "an in-flight report must not be queued twice");
reportMessages.role_report = [{ role: "assistant", type: "text", content: "刚才小号陌生人用另一个微信号联系了我。", time: 110, _altReportEventTime: 101 }];
reportCalls[0].onDone(true);
assert.equal(reportRole._altReportAt, 101);
reportSandbox.runReports();
assert.equal(reportCalls.length, 1, "the same alt activity must not be reported twice");
reportMessages["role_report#alt_1"].push({ role: "user", type: "image", content: "新图片", time: 202 });
reportSandbox.runReports();
assert.equal(reportCalls.length, 2, "new alt activity must allow exactly one new report");
assert.match(reportCalls[1].note, /这次的新情况/);
reportCalls[1].onDone(false);
assert.equal(reportRole._altReportAt, 202, "a failed model report must be delivered by the local event fallback");
assert.equal(reportRole._altReportAt, 202);
assert.equal(reportRole._altReportDeliveredAt, 202);
assert.equal(reportCalls.length, 2, "local delivery avoids an endless model retry loop");
assert.match(reportMessages.role_report.at(-1).content, /刚才小号陌生人用另一个号找过我/);
assert.doesNotMatch(reportMessages.role_report.at(-1).content, /大概聊的是|小号陌生人：|我：/);
reportSandbox.runReports();
assert.equal(reportCalls.length, 2, "the locally delivered follow-up report must remain one-time");

reportRole._altReportAt = 999;
reportRole._altReportDeliveredAt = 0;
reportRole._altIntroDone = true;
reportMessages["role_report#alt_1"].push({ role: "user", type: "text", content: "旧存档里漏掉的消息", time: 303 });
reportSandbox.runReports();
assert.equal(reportCalls.length, 3, "a legacy pre-delivery cursor must be repaired and retried");
assert.equal(reportRole._altReportAt, 0, "legacy cursor is reset until the repaired report is visible");
reportMessages.role_report.push({ role: "assistant", type: "text", content: "刚才小号陌生人又联系我了。", time: 310, _altReportEventTime: 303 });
reportCalls[2].onDone(true);
assert.equal(reportRole._altReportAt, 303);

let summaryActive = "main";
const summarySandbox = {
  S: {
    settings: { summaryRounds: 1, summaryModel: "main" },
    me: {
      active: "main",
      name: "大号名",
      accounts: [
        { id: "main", name: "大号名", callName: "大号称呼" },
        { id: "alt_1", name: "小号名" },
      ],
    },
  },
  actId: () => summaryActive,
};
vm.runInNewContext(
  [
    "memoryScopeKey",
    "summaryAccountProfile",
    "summaryUserLabel",
    "summaryList",
    "summaryState",
    "summaryStateSave",
  ]
    .map(extractFunction)
    .join("\n") +
    ";globalThis.api={summaryList,summaryState,summaryStateSave,summaryUserLabel};",
  summarySandbox,
);

const role = { callme: "大号专属昵称", summaries: [{ text: "大号记忆" }], _sumCount: 9, _summaryCursorV2: true };
assert.equal(summarySandbox.api.summaryUserLabel(role, "main"), "大号专属昵称");
assert.equal(summarySandbox.api.summaryUserLabel(role, "alt_1"), "小号名", "alt must not inherit the main-only nickname");
assert.equal(summarySandbox.api.summaryList(role, "main").length, 1);
assert.equal(summarySandbox.api.summaryList(role, "alt_1").length, 0);
summarySandbox.api.summaryList(role, "alt_1").push({ text: "小号记忆" });
assert.deepEqual(Array.from(summarySandbox.api.summaryList(role, "main"), x => x.text), ["大号记忆"]);
assert.deepEqual(Array.from(summarySandbox.api.summaryList(role, "alt_1"), x => x.text), ["小号记忆"]);
assert.equal(summarySandbox.api.summaryState(role, "main").count, 9);
assert.equal(summarySandbox.api.summaryState(role, "alt_1").count, 0);
summarySandbox.api.summaryStateSave(role, "alt_1", 17);
assert.equal(summarySandbox.api.summaryState(role, "alt_1").count, 17);
assert.equal(summarySandbox.api.summaryState(role, "main").count, 9, "alt summary cursor must not advance main");

let resolveSummary;
const asyncRole = { id: "role_async", name: "角色", summaries: [] };
const asyncMessages = Array.from({ length: 10 }, (_, i) => ({
  role: i % 2 ? "assistant" : "user",
  type: "text",
  content: `消息${i}`,
}));
const summaryWrites = [];
const asyncSandbox = {
  S: summarySandbox.S,
  actId: () => summaryActive,
  getC: () => asyncRole,
  msgsForAccount: (id, aid) => {
    assert.equal(id, "role_async");
    assert.equal(aid, "alt_1");
    return asyncMessages;
  },
  msgToText: m => m.content,
  summaryCleanText: (c, text) => text,
  pruneSummaries() {},
  save() {},
  chatAPI: () => new Promise(resolve => { resolveSummary = resolve; }),
  rateAndText: raw => ({ imp: 3, text: raw }),
  cleanReply: x => x,
  trimSentence: x => x,
  summaryCompletedRounds: rows => rows.filter(m => m && m.role === "assistant").length,
  wechatSummarySystem: () => "",
  summaryPerspectiveValid: () => true,
  summaryStoreResult: (c, text, imp, prefix, aid) => {
    summaryWrites.push({ c, text, imp, prefix, aid });
    return "added";
  },
  perspRule: () => "",
  IMP_INSTR: "",
};
vm.runInNewContext(
  [
    "memoryScopeKey",
    "summaryAccountProfile",
    "summaryUserLabel",
    "summaryList",
    "summaryState",
    "summaryStateSave",
    "maybeSummarize",
  ]
    .map(extractFunction)
    .join("\n") +
    ";globalThis.runSummary=maybeSummarize;globalThis.summaryStateApi=summaryState;",
  asyncSandbox,
);
summaryActive = "alt_1";
const pendingSummary = asyncSandbox.runSummary("role_async", "alt_1");
summaryActive = "main";
resolveSummary("小号独立总结".repeat(12));
await pendingSummary;
assert.equal(summaryWrites.length, 1);
assert.equal(summaryWrites[0].aid, "alt_1", "async summary must remain bound to its originating account after a switch");
assert.equal(asyncSandbox.summaryStateApi(asyncRole, "alt_1").count, 10);
assert.equal(asyncSandbox.summaryStateApi(asyncRole, "main").count, 0);

console.log("account isolation tests passed");
