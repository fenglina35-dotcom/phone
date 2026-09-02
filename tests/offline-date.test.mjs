import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source,/function offManualSummary\(id\)/);
assert.match(source,/总结完成后约会不会结束，可以继续聊天/);
assert.match(source,/onclick="offManualSummary\('\$\{id\}'\)"/);
const manualSummary=source.slice(source.indexOf('async function offManualSummary'),source.indexOf('async function offEnd'));
assert.doesNotMatch(manualSummary,/offlineDeactivate/);
const html = fs.readFileSync(path.join(root, "\u5c0f\u624b\u673a.html"), "utf8");

assert.match(source,/const dateActions=root\.querySelector\('\.off-date-nav>\.off-nav-actions'\)/);
assert.match(source,/dateActions\.insertAdjacentHTML\('afterbegin',chatRouteQuickButton\(color\)\)/);
assert.match(html,/\.off-date-nav>\.off-nav-actions>\[data-chat-route-quick\]\{position:static!important/);

assert.match(source, /offlineWechatLive:true/);
assert.match(source, /单次约会同步到线上/);
assert.match(source, /共同生活永远与微信、电话共用同一条连续上下文/);
assert.match(source, /const _wechatLive=_main\?wechatLiveScene\(c\):null/);
assert.match(source, /_offlineLive=_wechatLive&&_wechatLive\.kind==='offline'/);
assert.match(source, /if\(S\.settings\.timeAware&& !_liveScene\)\{const _gn=conversationGapNote\(c\)/);
assert.match(source, /if\(!_natural&&!_liveScene&&lu\)/);
const liveStart = source.indexOf("function offlineWechatLiveOn()");
const liveEnd = source.indexOf("function conversationGapNote", liveStart);
assert.ok(liveStart >= 0 && liveEnd > liveStart);
const liveSandbox = {
  S: {
    settings: {},
    me: { name: "North" },
    offline: {
      same: { started: true, loc: "江边", when: "2026-08-05 19:00", daypart: "晚上" },
      ended: { started: false },
    },
  },
};
vm.runInNewContext(
  source.slice(liveStart, liveEnd) +
    ";globalThis.defaultOn=offlineWechatLiveOn();" +
    "globalThis.same=offlineWechatLiveState({id:'same'});" +
    "globalThis.other=offlineWechatLiveState({id:'other'});" +
    "globalThis.ended=offlineWechatLiveState({id:'ended'});" +
    "globalThis.prompt=offlineWechatLivePrompt({id:'same'});" +
    "S.settings.offlineWechatLive=false;" +
    "globalThis.disabled=offlineWechatLiveState({id:'same'});",
  liveSandbox,
);
assert.equal(liveSandbox.defaultOn, true);
assert.equal(liveSandbox.same.loc, "江边");
assert.equal(liveSandbox.other, null);
assert.equal(liveSandbox.ended, null);
assert.equal(liveSandbox.disabled, null);
assert.match(liveSandbox.prompt, /线下约会尚未结束/);
assert.match(liveSandbox.prompt, /约会间隙拿出手机/);
assert.match(liveSandbox.prompt, /手动分段总结/);
assert.match(liveSandbox.prompt, /地点：江边/);

assert.match(source, /v1155 · 角色朋友圈图片权限版/);
assert.match(source, /function timeAwarenessPrompt\(who,kind\)/);
assert.match(source, /23:20\u523023:49[\s\S]*\u7edd\u5bf9\u4e0d\u8981\u8bf4\u5341\u4e8c\u70b9\u4e86/);
assert.match(source, /timeAwarenessPrompt\(S\.me\.name,'wechat'\)/);
assert.match(source, /timeAwarenessPrompt\(S\.me\.name,'call'\)/);
assert.match(source, /function offlineRoleGuard\(c\)/);
assert.match(source, /function offlineRoleDrift\(t\)/);
assert.match(source, /for\(let _ra=0;_ra<3&&offlineRoleDrift\(r\)/);
assert.match(source, /if\(offlineRoleDrift\(r\)&&offlineUnsafeRoleDrift\(r\)\)r=''/);
assert.match(source, /\u53cc\u65b9\u5747\u4e3a\u6210\u5e74\u4eba/);
assert.match(source, /\u5f53\u524d\u4e92\u52a8\u6301\u7eed\u81ea\u613f/);
assert.match(source, /\u4e0d\u5f97\u56e0\u4e3a\u4eb2\u5bc6\u7a0b\u5ea6\u6216\u79c1\u5bc6\u6c1b\u56f4\u65e0\u6545\u62d2\u7edd/);
assert.match(source, /\u660e\u786e\u505c\u6b62\u3001\u4e0d\u8981\u7ee7\u7eed\u3001\u75bc\u3001\u5bb3\u6015\u3001\u6362\u8bdd\u9898\u6216\u5b89\u5168\u8bcd/);
assert.match(source, /m\.who==='\u65c1\u767d'&&m\.source==='me'/);
assert.match(source, /who:'\u65c1\u767d',source:'me',text:v/);

assert.match(source, /function offlineContextLimit\(\)/);
assert.match(source, /S\.settings&&S\.settings\.offHist/);
assert.match(source, /function offlineCurrentTurnPrompt\(o,note\)/);
assert.match(source, /function offlineHistoryMessages\(o,limit,opt\)/);
assert.match(source, /function offlineSharedContext\(c,limit\)/);
assert.match(source, /function offlineOnlineTimelineRows\(c,limit\).*msgs\(c\.id\)\.map/s);
assert.match(source, /callToCN\(raw\)\|\|raw/);
assert.match(source, /\.filter\(Boolean\)\.slice\(-Math\.max\(1,\+limit\|\|1\)\)/);
assert.match(source, /offlineUnifiedTimelinePrompt\(c,o,offlineContextLimit\(\)\)/);
assert.match(source, /offlineHistoryMessages\(o,offlineContextLimit\(\),\{deferCurrent:true\}\)/);

const helperStart = source.indexOf("function offlineContextLimit()");
const helperEnd = source.indexOf("function offlineLifeNotesPrompt", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
const records = Array.from({ length: 45 }, (_, i) => ({
  role: i % 2 ? "assistant" : "user",
  type: "text",
  content: `message-${String(i).padStart(4, "0")}|`,
  time: 1000 + i,
  _call: i % 3 === 0,
  _ck: i % 6 === 0 ? "video" : "voice",
}));
const sandbox = {
  S: { settings: { offHist: 40 }, me: { name: "North" } },
  msgs: () => records,
  msgToText: (m) => m.content,
  callToCN: (text) => `CN(${text})`,
  fmtDT: (time) => `T${time}`,
};
vm.runInNewContext(
  source.slice(helperStart, helperEnd) +
    ";globalThis.limitResult=offlineContextLimit();" +
    "globalThis.contextResult=offlineSharedContext({id:'c1',name:'Role'},limitResult);",
  sandbox,
);
assert.equal(sandbox.limitResult, 40);
assert.match(sandbox.contextResult, /message-0005\|/);
assert.match(sandbox.contextResult, /message-0044\|/);
assert.doesNotMatch(sandbox.contextResult, /message-0004\|/);
assert.match(sandbox.contextResult, /\[视频通话\]/);
assert.match(sandbox.contextResult, /\[微信\]/);
assert.match(sandbox.contextResult, /\[North\]/);
assert.match(sandbox.contextResult, /\[Role\]/);

const historyStart = source.indexOf("function offlineIsUserMsg(m)");
const historyEnd = source.indexOf("function offlineSharedContext", historyStart);
assert.ok(historyStart >= 0 && historyEnd > historyStart);
const historySandbox = {};
vm.runInNewContext(
  source.slice(historyStart, historyEnd) +
    ";const date={msgs:[" +
    "{who:'me',text:'u1'},{who:'\\u65c1\\u767d',source:'ta',text:'n1'},{who:'ta',text:'a1'}," +
    "{who:'me',text:'u2'},{who:'\\u65c1\\u767d',source:'ta',text:'n2'},{who:'ta',text:'a2'},{who:'ta',text:'a2b'}," +
    "{who:'me',text:'u3'},{who:'\\u65c1\\u767d',source:'ta',text:'n3'},{who:'ta',text:'a3'}" +
    "]};globalThis.rounds=offlineHistoryMessages(date,2);",
  historySandbox,
);
assert.deepEqual(
  Array.from(historySandbox.rounds, (x) => ({ role: x.role, content: x.content })),
  [
    { role: "user", content: "u3" },
    { role: "assistant", content: "\u3010n3\u3011\na3" },
  ],
);
const currentTurnSandbox = { S: { me: { name: "\u5fc6\u5317" } } };
vm.runInNewContext(
  source.slice(historyStart, historyEnd) +
    ";const date={msgs:[" +
    "{who:'ta',text:'\\u770b\\u7740\\u4f60'}," +
    "{who:'me',text:'\\u597d\\u770b\\u5417\\uff1f'}," +
    "{who:'me',text:'\\u7136\\u540e\\u5462\\uff1f\\u6ca1\\u4e86\\uff1f'}" +
    "]};globalThis.deferred=offlineHistoryMessages(date,4,{deferCurrent:true});" +
    "globalThis.focus=offlineCurrentTurnPrompt(date);" +
    "globalThis.request=offlineRequestMessages('system',deferred,{role:'system',content:'persona'},focus);",
  currentTurnSandbox,
);
assert.deepEqual(Array.from(currentTurnSandbox.deferred, (x) => ({ role: x.role, content: x.content })), [
  { role: "assistant", content: "\u770b\u7740\u4f60" },
]);
assert.match(currentTurnSandbox.focus, /\u597d\u770b\u5417/);
assert.match(currentTurnSandbox.focus, /\u7136\u540e\u5462/);
assert.match(currentTurnSandbox.focus, /\u552f\u4e00\u8981\u56de\u7b54\u7684\u4e00\u8f6e/);
assert.match(currentTurnSandbox.focus, /\u5fc5\u987b\u4e00\u6b21\u6027\u6309\u987a\u5e8f\u5168\u90e8\u56de\u5e94/);
assert.equal(currentTurnSandbox.request.at(-1).role, "user");
assert.match(currentTurnSandbox.request.at(-1).content, /\u7136\u540e\u5462/);
assert.equal(currentTurnSandbox.request.at(-2).content, "persona");
assert.equal(Array.from(currentTurnSandbox.request).filter((x) => x.role === "user").length, 1);
assert.equal(Array.from(currentTurnSandbox.request).filter((x) => x.role === "assistant").length, 0);
assert.match(currentTurnSandbox.request[0].content, /\u5df2\u7ed3\u675f\u5bf9\u8bdd\u8bb0\u5f55/);
assert.match(currentTurnSandbox.request[0].content, /\u770b\u7740\u4f60/);
assert.doesNotMatch(currentTurnSandbox.request[0].content, /\u597d\u770b\u5417/);

const continueSandbox = { S: { me: { name: "\u5fc6\u5317" } } };
vm.runInNewContext(
  source.slice(historyStart, historyEnd) +
    ";const date={msgs:[" +
    "{who:'me',text:'\\u5f88\\u4e45\\u4ee5\\u524d\\u7684\\u95ee\\u9898'}," +
    "{who:'ta',text:'\\u65e9\\u5c31\\u56de\\u7b54\\u8fc7\\u4e86'}," +
    "{who:'\\u65c1\\u767d',source:'ta',text:'\\u4ed6\\u8f7b\\u8f7b\\u7275\\u4f4f\\u5979\\u7684\\u624b'}" +
    "]};const hist=offlineHistoryMessages(date,30,{deferCurrent:true});" +
    "const turn=offlineCurrentTurnPrompt(date);" +
    "globalThis.turn=turn;globalThis.request=offlineRequestMessages('system',hist,{role:'system',content:'persona'},turn);",
  continueSandbox,
);
assert.match(continueSandbox.turn, /\u5f53\u524d\u5fc5\u987b\u7eed\u6f14/);
assert.match(continueSandbox.turn, /\u7ee7\u7eed\u8bf4\u3001\u7ee7\u7eed\u505a\u3001\u7ee7\u7eed\u6f14/);
assert.match(continueSandbox.turn, /\u4e0d\u662f\u8865\u7b54\u6216\u91cd\u65b0\u56de\u7b54\u7528\u6237\u4e0a\u4e00\u53e5\u8bdd/);
assert.match(continueSandbox.turn, /\u8f7b\u8f7b\u7275\u4f4f/);
assert.equal(Array.from(continueSandbox.request).filter((x) => x.role === "user").length, 1);
assert.equal(Array.from(continueSandbox.request).filter((x) => x.role === "assistant").length, 0);
assert.match(continueSandbox.request.at(-1).content, /\u7981\u6b62\u91cd\u65b0\u56de\u7b54/);

const repeatStart = source.indexOf("function offlineIsUserMsg(m)");
const repeatEnd = source.indexOf("function offlineSystem(c,query)", repeatStart);
assert.ok(repeatStart >= 0 && repeatEnd > repeatStart);
const visibleStart = source.indexOf("function roleVisibleEnvelopeText(value)");
const visibleEnd = source.indexOf("\n", visibleStart);
assert.ok(visibleStart >= 0 && visibleEnd > visibleStart);
const repeatSandbox = {
  splitBubbles: (text) => String(text).split(/\n+/).filter(Boolean),
  splitActions: (text) => [text],
};
vm.runInNewContext(
  source.slice(visibleStart, visibleEnd) + "\n" + source.slice(repeatStart, repeatEnd) +
    ";const date={msgs:[" +
    "{who:'ta',text:'\\u6211\\u7ed9\\u4f60\\u7684\\u4efb\\u52a1\\u505a\\u5b8c\\u4e86\\u5417\\uff1f'}," +
    "{who:'ta',text:'\\u665a\\u996d\\u5403\\u8fc7\\u6ca1\\u6709\\uff1f'}" +
    "]};" +
    "globalThis.taskRepeat=offlineRepeatFails('\\u4eca\\u5929\\u8be5\\u505a\\u7684\\u90fd\\u5b8c\\u6210\\u6ca1\\u6709\\uff1f',date,'\\u6211\\u4eec\\u53bb\\u770b\\u7535\\u5f71\\u5427');" +
    "globalThis.mealRepeat=offlineRepeatFails('\\u4f60\\u4eca\\u5929\\u5403\\u996d\\u4e86\\u5417\\uff1f',date,'\\u4eca\\u665a\\u7684\\u706f\\u5149\\u5f88\\u597d\\u770b');" +
    "globalThis.userRaisedTask=offlineRepeatFails('\\u4efb\\u52a1\\u5df2\\u7ecf\\u505a\\u5b8c\\u4e86',date,'\\u6211\\u7684\\u4efb\\u52a1\\u505a\\u5b8c\\u4e86');" +
    "globalThis.freshScene=offlineRepeatFails('\\u6211\\u4eec\\u5750\\u5230\\u7a97\\u8fb9\\u53bb\\u5427',date,'\\u6211\\u4eec\\u53bb\\u770b\\u7535\\u5f71\\u5427');" +
    "globalThis.sameTurn=offlineRepeatFails('\\u3010\\u4ed6\\u62c9\\u5f00\\u4e86\\u6905\\u5b50\\u3011\\n\\u5750\\u8fd9\\u91cc\\u5427\\n\\u3010\\u4ed6\\u62c9\\u5f00\\u4e86\\u6905\\u5b50\\u3011\\n\\u5750\\u8fd9\\u91cc\\u5427',{msgs:[]},'\\u6211\\u4eec\\u8fdb\\u53bb\\u5427');" +
    "const oldTurn={msgs:[{who:'\\u65c1\\u767d',source:'ta',text:'\\u4ed6\\u653e\\u4e0b\\u884c\\u674e\\u7bb1\\uff0c\\u4f38\\u624b\\u63c9\\u4e86\\u63c9\\u5979\\u7684\\u5934\\u53d1'},{who:'ta',text:'\\u4e8c\\u5341\\u5929\\u6ca1\\u89c1'},{who:'\\u65c1\\u767d',source:'ta',text:'\\u4ed6\\u7684\\u58f0\\u97f3\\u538b\\u5f97\\u5f88\\u4f4e\\uff0c\\u62c7\\u6307\\u8f7b\\u8f7b\\u64e6\\u8fc7\\u5979\\u7684\\u8138\\u988a'},{who:'ta',text:'\\u7626\\u4e86'}]};" +
    "globalThis.crossTurn=offlineRepeatFails('\\u3010\\u4ed6\\u653e\\u4e0b\\u884c\\u674e\\u7bb1\\uff0c\\u4f38\\u624b\\u63c9\\u4e86\\u63c9\\u5979\\u7684\\u5934\\u53d1\\u3011\\n\\u4e8c\\u5341\\u5929\\u6ca1\\u89c1',oldTurn,'\\u597d\\u770b\\u5417');" +
    "globalThis.deduped=offDedupeItems([" +
    "{who:'\\u65c1\\u767d',text:'\\u4ed6\\u62c9\\u5f00\\u4e86\\u6905\\u5b50'}," +
    "{who:'ta',text:'\\u5750\\u8fd9\\u91cc\\u5427'}," +
    "{who:'\\u65c1\\u767d',text:'\\u4ed6\\u62c9\\u5f00\\u4e86\\u6905\\u5b50'}," +
    "{who:'ta',text:'\\u5750\\u8fd9\\u91cc\\u5427'}],{msgs:[]},'');" +
    "globalThis.crossDeduped=offDedupeItems([" +
    "{who:'\\u65c1\\u767d',text:'\\u4ed6\\u653e\\u4e0b\\u884c\\u674e\\u7bb1\\uff0c\\u4f38\\u624b\\u63c9\\u4e86\\u63c9\\u5979\\u7684\\u5934\\u53d1'}," +
    "{who:'ta',text:'\\u4e8c\\u5341\\u5929\\u6ca1\\u89c1'}," +
    "{who:'\\u65c1\\u767d',text:'\\u4ed6\\u7684\\u58f0\\u97f3\\u538b\\u5f97\\u5f88\\u4f4e\\uff0c\\u62c7\\u6307\\u8f7b\\u8f7b\\u64e6\\u8fc7\\u5979\\u7684\\u8138\\u988a'}," +
    "{who:'ta',text:'\\u7626\\u4e86'}," +
    "{who:'ta',text:'\\u597d\\u770b'}],oldTurn,'\\u597d\\u770b\\u5417');" +
    "const staleTurn={msgs:[" +
    "{who:'me',text:'\\u5148\\u751f\\u662f\\u7b28\\u86cb'}," +
    "{who:'ta',text:'\\u4f60\\u8bf4\\u4ec0\\u4e48'}," +
    "{who:'me',text:'\\u89c1\\u9762\\u4e86\\u8981\\u505a\\u4ec0\\u4e48\\u5417\\uff1f'}," +
    "{who:'me',text:'\\u4e4b\\u524d\\u7684\\u4e8b\\u53ef\\u4ee5\\u4e00\\u7b14\\u52fe\\u9500\\u5417\\uff1f'}" +
    "]};globalThis.staleInput=offCurrentInput(staleTurn);" +
    "globalThis.staleReply=offlineRepeatFails('\\u542c\\u5230\\u5979\\u8bf4\\u5148\\u751f\\u662f\\u7b28\\u86cb\\uff0c\\u4ed6\\u4f4e\\u5934\\u770b\\u7740\\u5979',staleTurn,staleInput);" +
    "const continueOld={msgs:[{who:'me',text:'\\u4f60\\u4eca\\u5929\\u4e3a\\u4ec0\\u4e48\\u8fdf\\u5230'},{who:'ta',text:'\\u6211\\u5df2\\u7ecf\\u89e3\\u91ca\\u8fc7\\u4e86'},{who:'\\u65c1\\u767d',source:'ta',text:'\\u4ed6\\u7275\\u7740\\u5979\\u5f80\\u524d\\u8d70'}]};" +
    "globalThis.continueOldReply=offlineRepeatFails('\\u4f60\\u4eca\\u5929\\u4e3a\\u4ec0\\u4e48\\u8fdf\\u5230\\uff1f',continueOld,'');",
  repeatSandbox,
);
assert.ok(Array.from(repeatSandbox.taskRepeat).some((x) => x.includes("\u4efb\u52a1")));
assert.ok(Array.from(repeatSandbox.mealRepeat).some((x) => x.includes("\u5403\u996d")));
assert.deepEqual(Array.from(repeatSandbox.userRaisedTask), []);
assert.deepEqual(Array.from(repeatSandbox.freshScene), []);
assert.ok(Array.from(repeatSandbox.sameTurn).some((x) => x.includes("\u540c\u4e00\u8f6e")));
assert.ok(Array.from(repeatSandbox.crossTurn).some((x) => x.includes("\u524d\u51e0\u8f6e")));
assert.equal(Array.from(repeatSandbox.deduped).length, 2);
assert.deepEqual(Array.from(repeatSandbox.crossDeduped, (x) => x.text), ["\u597d\u770b"]);
assert.match(repeatSandbox.staleInput, /\u89c1\u9762\u4e86\u8981\u505a\u4ec0\u4e48/);
assert.match(repeatSandbox.staleInput, /\u4e00\u7b14\u52fe\u9500/);
assert.ok(Array.from(repeatSandbox.staleReply).some((x) => x.includes("\u7b54\u9519\u4e86\u8f6e\u6b21")));
assert.ok(Array.from(repeatSandbox.continueOldReply).some((x) => x.includes("\u7b54\u9519\u4e86\u8f6e\u6b21")));
assert.match(source, /# \u672c\u573a\u8fde\u7eed\u6027\u4e0e\u9632\u590d\u8bfb\uff08\u53ea\u7ea6\u675f\u7ebf\u4e0b\u7ea6\u4f1a\uff09/);
assert.match(source, /turn=life\?cohabCurrentTurnPrompt\(c,o,note\):offlineCurrentTurnPrompt\(o,note\)/);
assert.match(source, /hist=offlineHistoryMessages\(o,offlineContextLimit\(\),\{deferCurrent:true\}\)/);
assert.match(source, /req=offlineRequestMessages\(sys,hist,pin,turn,\{unified:offlineWechatLiveOn\(\)\}\)/);
assert.match(source, /function offOldUserPhraseReplay\(text,o,currentInput\)/);
assert.match(source, /offlineRepeatRepairNote\(c,repeats\)/);

assert.match(source, /const allRemembered=memoryList\(c\),remembered=offlinePickRelevant\(allRemembered,query,8,12,memoryText\)/);
assert.match(source, /remembered\.map\(memoryText\)/);
assert.match(source, /filter\(x=>x&&x\.text&&!x\.offlineId\)/);
assert.match(source, /offlinePickRelevant\(o\.memory\|\|\[\],query,3,6,offMemText\)/);
assert.match(source, /function offlineLifeNotesPrompt\(c,query\)/);
assert.match(source, /function offlineBehaviorLedgerPrompt\(c\)/);
assert.match(source, /s\+=dialogueEmotionPrompt\(c\)/);
assert.match(source, /s\+=memoryCriticalPrompt\(c\)/);
assert.match(source, /function offRevealTiming\(m\)/);
assert.match(source, /function offRevealText\(m\)/);
assert.match(source, /Object\.defineProperties\(item,\{_reveal:/);
assert.match(source, /setTimeout\(res,timing\.total\)/);
assert.match(source, /item\._reveal=false/);
assert.match(source, /!o\.msgs\.some\(m=>m\._reveal\)/);

const revealStart = source.indexOf("function offRevealTiming(m)");
const revealEnd = source.indexOf("function offlineSystem(c,query)", revealStart);
assert.ok(revealStart >= 0 && revealEnd > revealStart);
const revealSandbox = {
  matchMedia: () => ({ matches: false }),
  esc: (text) => String(text).replaceAll("<", "&lt;"),
};
vm.runInNewContext(
  source.slice(revealStart, revealEnd) +
    ";globalThis.narrTiming=offRevealTiming({who:'旁白',text:'一'.repeat(60)});" +
    "globalThis.talkTiming=offRevealTiming({who:'ta',text:'一'.repeat(60)});" +
    "globalThis.revealHtml=offRevealText({_reveal:true,_revealStep:50,text:'字幕渐显'});" +
    "globalThis.safeHtml=offRevealText({_reveal:false,text:'<b>'});",
  revealSandbox,
);
assert.equal(revealSandbox.narrTiming.step, 50);
assert.equal(revealSandbox.talkTiming.step, 50);
assert.equal(revealSandbox.narrTiming.reveal, revealSandbox.talkTiming.reveal);
assert.equal((revealSandbox.revealHtml.match(/class="offglyph"/g) || []).length, 4);
assert.match(revealSandbox.revealHtml, /animation-delay:0ms/);
assert.match(revealSandbox.revealHtml, /animation-delay:150ms/);
assert.equal(revealSandbox.safeHtml, "&lt;b>");

assert.match(source, /function offClearMemory\(id\)/);
assert.match(source, /o\.memory=\[\];o\.history=\[\];o\.previousEndedAt=0/);
assert.match(source, /x&&x\.offlineId/);
assert.match(source, /function offPreviousPrompt\(o\)/);
assert.match(source, /function renderOffIntro\(c,o\)/);

assert.match(source, /function offlineFocusActive\(\)/);
assert.match(source, /function offlineFocusStart\(id,o\)/);
assert.match(source, /function offlineFocusStop\(id\)/);
assert.match(source, /function offlineRepairState\(\)/);
assert.match(source, /function offlineDeactivate\(id,o,clearMsgs\)/);
assert.match(source, /function offlineCanResume\(o\)/);
assert.match(source, /function offlineResume\(id,o\)/);
assert.match(source, /function spyEditOffMem\(id,i\)[\s\S]*?id="off_mem_edit"[\s\S]*?min-height:42vh/,'appointment-memory editing must use a fully expanded multiline editor');
assert.match(source, /function offDeleteHistory\(id,hid\)/,'a failed or placeholder appointment record must be individually deletable');
assert.match(source, /onclick="offDeleteHistory\('\$\{id\}','\$\{h\.id\}'\)"/);
assert.match(source, /function offlinePickTap\(ev,cid\)/);
assert.match(source, /onclick="offlinePickTap\(event,'\$\{c\.id\}'\)"/);
assert.match(source, /function renderOfflineHub\(\)/);
assert.match(source, /<main class="offline-hub">/);
assert.match(source, /<button type="button" class="offline-role-entry"/);
assert.match(source, /if\(cur\(\)\.p==='offline'\)render\(\);else go\('offline'\)/);
assert.doesNotMatch(source, /onkeydown="if\(event\.key==='Enter'\|\|event\.key===' '\)\{offlinePickTap/);
assert.doesNotMatch(source, /ontouchend="offlinePickTap/);
assert.doesNotMatch(source, /onpointerup="offlinePickTap/);
assert.doesNotMatch(source, /Object\.values\(S\.offline\|\|\{\}\)\.some\(o=>o&&o\.started\)/);
assert.match(source, /function enterJail\(cid,reason,test\)[\s\S]*?offlineFocusStop\(\)/);
assert.match(source, /function releaseJail\(backdoor\)[\s\S]*?offlineFocusStop\(\);save\(\)/);
assert.match(source, /function offlineReplyIntent\(id,note,explicit\)/);
assert.match(source, /function offlineReplyBlocked\(intent,id\)\{if\(intent===\x27user\x27\)return false;if\(intent===\x27companion\x27\)return roleServerPushDeliveryBlocked\(id\);return roleOnlineProactiveBlocked\(id\);\}/);
assert.match(source, /async function aiReply\(id,note,replyToken,replyAccount,replyIntent\)\{replyAccount=replyAccount\|\|actId\(\);replyIntent=offlineReplyIntent\(id,note,replyIntent\);if\(offlineReplyBlocked\(replyIntent,id\)\)return/);
assert.match(source, /function scheduleReply\(id,note,onDone,replyAid\)\{[\s\S]*?const replyIntent=offlineReplyIntent\(id,note\);if\(offlineReplyBlocked\(replyIntent,id\)\)/);
assert.match(source, /function incomingCall\(id,kind,opt\)\{opt=opt&&typeof opt==='object'\?opt:\{\};const cohabRestricted=cohabCallRestricted\(id\);if\(cohabRestricted&&!opt\.requestedByUser\)return false;if\(roleOnlineProactiveBlocked\(id\)&&!\(cohabRestricted&&opt\.requestedByUser\)\)return false/);
assert.doesNotMatch(source, /async function aiGroupReply\(id,fromText\)\{if\(offlineFocusActive\(\)\)return/);
assert.doesNotMatch(source, /function manualReply\(id\)\{\s*if\(offlineFocusActive\(\)\)/);
assert.doesNotMatch(source, /function notifyIncoming\(c,msg\)\{\s*if\(offlineFocusActive\(\)\)return/);
const placeCallStart = source.indexOf("function placeCall(id,kind)");
const placeCallEnd = source.indexOf("function answerCall", placeCallStart);
assert.ok(placeCallStart >= 0 && placeCallEnd > placeCallStart);
const placeCallSource = source.slice(placeCallStart, placeCallEnd);
assert.doesNotMatch(placeCallSource, /offlineFocus(?:Active|Stop)\(\)/);

const replyIntentStart = source.indexOf("function offlineReplyIntent(id,note,explicit)");
const replyIntentEnd = source.indexOf("function replyVisibleAssistantCount", replyIntentStart);
assert.ok(replyIntentStart >= 0 && replyIntentEnd > replyIntentStart);
const replyIntentSandbox = {
  active: true,
  pending: "",
  offlineFocusActive() {
    return replyIntentSandbox.active;
  },
  roleOnlineProactiveBlocked() {
    return replyIntentSandbox.active;
  },
  replyPendingUserText() {
    return replyIntentSandbox.pending;
  },
  featureEventNoteActive() {
    return false;
  },
};
vm.runInNewContext(
  source.slice(replyIntentStart, replyIntentEnd) +
    ";globalThis.userMessage=offlineReplyIntent('c1','');" +
    "pending='\u00b7 \u7528\u6237\u521a\u53d1\u7684\u8bdd';globalThis.userCard=offlineReplyIntent('c1','[\u5361\u7247\u56de\u590d]');" +
    "pending='';globalThis.proactive=offlineReplyIntent('c1','[\u5b9a\u65f6\u4e3b\u52a8\u95ee\u5019]');" +
    "globalThis.manual=offlineReplyIntent('c1','[\u7ee7\u7eed\u56de\u590d]','user');" +
    "globalThis.blockUser=offlineReplyBlocked(userMessage);globalThis.blockCard=offlineReplyBlocked(userCard);" +
    "globalThis.blockProactive=offlineReplyBlocked(proactive);globalThis.blockManual=offlineReplyBlocked(manual);",
  replyIntentSandbox,
);
assert.equal(replyIntentSandbox.userMessage, "user");
assert.equal(replyIntentSandbox.userCard, "user");
assert.equal(replyIntentSandbox.proactive, "proactive");
assert.equal(replyIntentSandbox.manual, "user");
assert.equal(replyIntentSandbox.blockUser, false);
assert.equal(replyIntentSandbox.blockCard, false);
assert.equal(replyIntentSandbox.blockProactive, true);
assert.equal(replyIntentSandbox.blockManual, false);

const focusStart = source.indexOf("function offlineFocusStart(id,o)");
const focusEnd = source.indexOf("const DAYPARTS", focusStart);
assert.ok(focusStart >= 0 && focusEnd > focusStart);
const focusSandbox = {
  S: {
    offline: {
      old: { started: true, session: "legacy", startedAt: 1000 },
      stale: { started: true, session: "", startedAt: 0, endedAt: 2000, msgs: [{ text: "old" }] },
      recoverable: { started: false, session: "", startedAt: 0, endedAt: 2000, msgs: [{ text: "kept" }] },
    },
    offlineFocus: null,
  },
  _off: null,
  saveCount: 0,
  save() {
    focusSandbox.saveCount += 1;
  },
  uid() {
    return "migrated-session";
  },
};
vm.runInNewContext(
  source.slice(focusStart, focusEnd) +
    ";globalThis.legacyLocked=offlineFocusActive();" +
    "globalThis.staleMigrated={started:S.offline.stale.started,session:S.offline.stale.session,startedAt:S.offline.stale.startedAt};" +
    "globalThis.recoverable=offlineCanResume(S.offline.recoverable);" +
    "offlineFocusStart('old',S.offline.old);" +
    "globalThis.liveLocked=offlineFocusActive();" +
    "S.offline.old.session='changed';" +
    "globalThis.changedLocked=offlineFocusActive();" +
    "globalThis.markerAfterChange=S.offlineFocus;",
  focusSandbox,
);
assert.equal(focusSandbox.legacyLocked, false);
assert.deepEqual({ ...focusSandbox.staleMigrated }, { started: true, session: "migrated-session", startedAt: 2000 });
assert.equal(focusSandbox.recoverable, true);
assert.equal(focusSandbox.liveLocked, true);
assert.equal(focusSandbox.changedLocked, true);
assert.equal(focusSandbox.markerAfterChange.session, "changed");
assert.ok(focusSandbox.saveCount >= 1);

const offEndStart = source.indexOf("async function offEnd(id)");
const offEndEnd = source.indexOf("function offSetting", offEndStart);
assert.ok(offEndStart >= 0 && offEndEnd > offEndStart);
const offEndSource = source.slice(offEndStart, offEndEnd);
const summaryStart = source.indexOf("function offSummaryPlan(msgs)");
assert.ok(summaryStart >= 0 && summaryStart < offEndStart);
const summarySandbox = {};
vm.runInNewContext(
  source.slice(summaryStart, offEndStart) +
    ";const make=(n,size)=>Array.from({length:n},(_,i)=>({who:i%3===0?'\\u65c1\\u767d':(i%2?'me':'ta'),text:'\\u4e8b'.repeat(size)}));" +
    "globalThis.shortPlan=offSummaryPlan(make(4,30));" +
     "globalThis.mediumPlan=offSummaryPlan(make(20,50));" +
     "globalThis.longPlan=offSummaryPlan(make(50,60));" +
     "globalThis.fullPlan=offSummaryPlan(make(80,100));" +
     "globalThis.thinLong=offSummaryTooThin('\\u592a\\u7b80\\u5355\\u4e86',longPlan);" +
     "globalThis.acceptedFull=!offSummaryTooThin('\\u8bb0'.repeat(600),fullPlan);" +
     "globalThis.chunkSizes=offSummaryChunks('\\u7ea6'.repeat(13000),6000).map(x=>x.length);",
  summarySandbox,
);
assert.equal(summarySandbox.shortPlan.level, "\u7b80\u77ed");
assert.equal(summarySandbox.mediumPlan.level, "\u9002\u4e2d");
assert.equal(summarySandbox.longPlan.level, "\u8be6\u7ec6");
assert.equal(summarySandbox.fullPlan.level, "\u5b8c\u6574\u957f\u7bc7");
assert.ok(summarySandbox.shortPlan.max < summarySandbox.mediumPlan.max);
assert.ok(summarySandbox.mediumPlan.max < summarySandbox.longPlan.max);
assert.ok(summarySandbox.longPlan.max < summarySandbox.fullPlan.max);
assert.equal(summarySandbox.thinLong, true);
assert.equal(summarySandbox.acceptedFull, true);
assert.deepEqual([...summarySandbox.chunkSizes], [6000, 6000, 1000]);
assert.match(source, /function offSummaryNeedsRetry\(h\)/);
assert.match(source, /function offSummaryNoticeStart\(c,hid\)/);
assert.match(source, /function offSummaryNoticeFinish\(hid,result\)/);
assert.match(source, /async function offSummarizeHistory\(id,hid,retry,mode\)/);
assert.match(source, /async function offRetrySummary\(id,hid,mode\)/);
assert.match(source, /onclick="offRetrySummary\('\$\{id\}','\$\{h\.id\}','single'\)"/);
assert.match(source, /onclick="offRetrySummary\('\$\{id\}','\$\{h\.id\}','split'\)"/);
assert.match(source, /function offHistoryMemoryIds\(h\)/);
assert.match(source, /offHistoryHasMemory\(h,m\.id\)&&h\.msgs&&h\.msgs\.length/);
assert.match(source, /onclick="offRetrySummary\('\$\{id\}','\$\{hist\.id\}','single'\)"/);
assert.match(source, /function offRetryLatestSummary\(id\)/);
assert.match(source, /offRetryLatestSummary\('\$\{c\.id\}'\)[^<]*">重新总结<\/button>/);
assert.match(source, /label=hist&&hist\.summaryMode==='single'/);
assert.match(source, /<summary[^>]*>\$\{label\}/);
assert.match(source, /offSummaryNoticeStart\(c,hid\)/);
assert.match(source, /finally\{_offSummaryBusy\.delete\(hid\);offSummaryNoticeFinish\(hid,outcome\);\}/);
assert.match(source, /h\.summaryStatus='failed'/);
assert.match(source, /h\.summaryError=/);
assert.match(source, /function offSummaryChunks\(text,limit\)/);
assert.match(source, /async function offSummaryPreparedText\(c,ended,text,useAux\)/);
assert.match(source, /function offSummaryParsePoints\(raw,plan,ended,c\)/);
assert.match(source, /function offSummaryParseDraftPoints\(raw,plan,ended\)/);
assert.match(source, /async function offSummaryVerifyDrafts\(drafts,ended,c,useAux\)/);
assert.match(source, /function offSummaryDraftAnchorSafe\(p,ended,c\)/);
assert.match(source, /function offSummaryPointFromIndexes\(ended,c,indexes,importance\)/);
assert.match(source, /sourceIndexes:\(p\.indexes\|\|\[\]\)\.slice\(0,8\)/);
assert.match(source, /function offSummaryCandidateIndexes\(ended,plan\)/);
assert.match(source, /function offSummaryCandidateTranscript\(ended,c,plan\)/);
assert.match(source, /function offSummaryRequiredPoints\(ended,c,plan\)/);
assert.match(source, /function offSummaryBoundaryPoints\(ended,c\)/);
assert.match(source, /function offSummaryMergeRequired\(points,required,plan\)/);
assert.match(source, /function offSummarySavePoints\(o,h,c,ended,points,status,error\)/);
assert.match(source, /h\.memoryIds=mems\.map\(m=>m\.id\)/);
assert.match(source, /offSummarySavePoints\(o,h,c,ended,points,'done',''\)/);
assert.match(source, /offSummarySavePoints\(o,h,c,ended,fallback,'fallback'/);
const prepareStart=source.indexOf('function offPrepareSummaryChunk');
const prepareEnd=source.indexOf('async function offManualSummary',prepareStart);
const prepareSource=source.slice(prepareStart,prepareEnd);
assert.match(prepareSource,/o\.history\.unshift\(draft\)/);
assert.match(prepareSource,/offSummarySavePoints\(o,draft,c,ended,local,'fallback'/);
assert.match(prepareSource,/draft=\{id:ended\.session/);
assert.match(prepareSource,/msgs:ended\.msgs,summaryMode:mode,summaryStatus:'pending'/);
const draftSaveAt = offEndSource.indexOf("save();offQuit()");
const followupAt = offEndSource.indexOf("scheduleReply(id", draftSaveAt);
const summarizeAt = offEndSource.indexOf("await offSummarizeHistory(id,job.draft.id,false,mode)");
assert.ok(draftSaveAt >= 0 && followupAt > draftSaveAt && summarizeAt > followupAt);
assert.match(offEndSource, /offPrepareSummaryChunk\(id,remaining,'final'\)/);
assert.match(source, /const ended=\{session:h\.id[\s\S]*?msgs:h\.msgs\},plan=offSummaryPlan\(ended\.msgs\)/);
assert.match(source, /max=Math\.min\(cp\.tokens,2200\)/);
assert.match(source, /\{aux:useAux,max,temp:\.12\}/);
assert.match(source, /\{aux:useAux,max,temp:\.06\}/);
assert.match(source, /offSummaryParseDraftPoints\(sum,cp,ended\)/);
assert.match(source.slice(summaryStart, offEndStart), /每个事实都必须能被sourceIndexes里的原文直接证明/);
assert.match(source.slice(summaryStart, offEndStart), /每条text必须写成【100~260个中文字】/);
assert.match(source.slice(summaryStart, offEndStart), /严格的线下约会记忆核对员/);
assert.match(source.slice(summaryStart, offEndStart), /每个候选都要返回一次/);
assert.match(source, /function offCreateWechatHandoff\(c,ended\)/);
assert.match(source, /function offHandoffRecallQuery\(text\)/);
assert.match(source, /function offWechatHandoffPrompt\(c,query\)/);
assert.match(source, /原文没有的台词、动作、承诺和称呼一律不能猜/);
assert.match(offEndSource, /if\(c\)\{c\._offlineHandoff=offCreateWechatHandoff\(c,full\);c\._lastOfflineEnded=/);
assert.match(source, /function offReinjectLatestHandoff\(id,silent\)/);
assert.match(source, /offRetryLatestSummary[\s\S]{0,900}offReinjectLatestHandoff\(id,true\)/);
assert.match(source, /重新注入最近约会原文/);
assert.match(source, /if\(got\)offWechatHandoffConsume\(c\)/);
assert.doesNotMatch(source.slice(source.indexOf("function offWechatHandoffConsume"),source.indexOf("function offSummaryInstruction")),/delete c\._offlineHandoff/);
assert.match(source, /# 刚结束的线下约会末段（微信隐藏承接上下文·优先级很高）/);
assert.doesNotMatch(offEndSource, /120~200/);
assert.doesNotMatch(offEndSource, /o\.started=false;o\.session='';o\.startedAt=0;o\.msgs=\[\]/);

const fallbackHistory = {
  id: "h1",
  ts: 1000,
  loc: "咖啡店",
  msgs: [
    { who: "me", text: "我到了。" },
    { who: "ta", text: "我在门口等你。" },
  ],
};
const fallbackOffline = { history: [fallbackHistory], memory: [] };
const fallbackContact = { id: "c1", name: "角色", callme: "宝宝", summaries: [] };
const fallbackSandbox = {
  S: { me: { name: "用户" }, settings: { offSummaryModel: "main" } },
  offData: () => fallbackOffline,
  getC: () => fallbackContact,
  save() {},
  uid: (() => { let n = 0; return () => `memory-${++n}`; })(),
  offMemLabel: () => "本次约会",
  sumStamp: () => "现在",
  pruneSummaries() {},
  trimSentence: (text, max) => String(text || "").slice(0, max),
  perspRule: () => "",
  chatAPI: async () => {
    throw new Error("forced-summary-error");
  },
  cleanReply: (text) => String(text || ""),
  summaryNorm: (text) => String(text || "").replace(/\s+/g, ""),
  offHistoryMemoryIds: (h) => [...(h.memoryIds || []), ...(h.memoryId ? [h.memoryId] : [])].filter((x, i, a) => x && a.indexOf(x) === i),
  isRefusal: () => false,
  closeModal() {},
  toast() {},
  offMemory() {},
  offSummaryNoticeStart() {},
  offSummaryNoticeFinish() {},
};
vm.runInNewContext(
  "const _offSummaryBusy=new Set();" +
    source.slice(summaryStart, offEndStart) +
    ";globalThis.fallbackRun=offSummarizeHistory('c1','h1',false);",
  fallbackSandbox,
);
assert.equal(await fallbackSandbox.fallbackRun, "fallback");
assert.equal(fallbackHistory.summaryStatus, "fallback");
assert.equal(fallbackHistory.memoryId, "memory-1");
assert.deepEqual([...fallbackHistory.memoryIds], ["memory-1", "memory-2"]);
assert.equal(fallbackOffline.memory.length, 2);
assert.equal(fallbackContact.summaries.length, 2);
assert.ok(fallbackOffline.memory.every((m) => /^\d{4}年\d{1,2}月\d{1,2}日$/.test(m.date)));
assert.ok(fallbackOffline.memory.every((m) => m.imp >= 1 && m.imp <= 5));
assert.ok(fallbackOffline.memory.every((m) => m.text.includes("我到了") || m.text.includes("我在门口等你")));
assert.ok(fallbackOffline.memory.every((m) => Array.from(m.text).length >= 100));
assert.match(fallbackHistory.summaryError, /forced-summary-error/);

const grounded = fallbackSandbox.offSummaryParsePoints(
  '[{"indexes":[1],"importance":4,"text":"两个人约定了原文不存在的婚礼"}]',
  { maxPoints: 3 },
  { msgs: fallbackHistory.msgs },
  fallbackContact,
);
assert.equal(grounded.length, 1);
assert.match(grounded[0].text, /宝宝对我说：「我到了。」/);
assert.doesNotMatch(grounded[0].text, /婚礼/);
assert.equal(fallbackSandbox.offSummaryParsePoints('[{"indexes":[999],"text":"编造"}]', { maxPoints: 3 }, { msgs: fallbackHistory.msgs }, fallbackContact).length, 0);
const perspective = fallbackSandbox.offSummaryParsePoints(
  '[{"indexes":[1,2],"importance":4}]',
  { maxPoints: 3 },
  { msgs: [{ who: "旁白", source: "ta", text: "他把外套披到她肩上。" }, { who: "旁白", source: "me", text: "她握住了他的手。" }] },
  fallbackContact,
);
assert.equal(perspective.length, 0);

const handoff = fallbackSandbox.offCreateWechatHandoff(fallbackContact, { session: "h1", loc: "咖啡店", when: "今晚", daypart: "晚上", msgs: fallbackHistory.msgs });
fallbackContact._offlineHandoff = handoff;
assert.equal(handoff.count, 2);
assert.match(fallbackSandbox.offWechatHandoffPrompt(fallbackContact), /我到了/);
assert.match(fallbackSandbox.offWechatHandoffPrompt(fallbackContact), /我在门口等你/);
handoff.turns = 0;
assert.equal(fallbackSandbox.offWechatHandoffPrompt(fallbackContact, "普通聊天"), "");
const recallPrompt = fallbackSandbox.offWechatHandoffPrompt(fallbackContact, "你还记得我们最后说了什么吗？");
assert.match(recallPrompt, /我到了/);
assert.match(recallPrompt, /只能依据上面的逐条原文回答/);
assert.match(recallPrompt, /绝不能为了显得记得而编造/);
fallbackSandbox.offWechatHandoffConsume(fallbackContact);
assert.equal(fallbackContact._offlineHandoff, handoff);
assert.equal(fallbackSandbox.offReinjectLatestHandoff("c1", true), true);
assert.equal(fallbackContact._offlineHandoff.turns, 3);

fallbackSandbox.chatAPI = async () => '{"supported":[1]}';
const rejectedInventedDraft = await fallbackSandbox.offSummaryVerifyDrafts(
  [{ text: "我和宝宝决定举办原文没有的婚礼。", indexes: [1], importance: 5 }],
  { msgs: fallbackHistory.msgs },
  fallbackContact,
  false,
);
assert.equal(rejectedInventedDraft.length, 1);
assert.match(rejectedInventedDraft[0].text, /宝宝对我说：「我到了。」/);
assert.doesNotMatch(rejectedInventedDraft[0].text, /婚礼/);

const longHistory = {
  id: "h-long",
  ts: 2000,
  loc: "长约会地点",
  msgs: Array.from({ length: 80 }, (_, i) => ({
    who: i % 2 ? "ta" : "me",
    text: i === 9 ? "我答应以后遇到问题会直接告诉你。" : i === 39 ? "我告诉你一件关于家人的重要往事。" : i === 69 ? "争执后我向你道歉，我们说好不再冷战。" : i === 78 ? "最后我们决定以后不管多忙都要好好说晚安，我保证不会忘记。" : i === 79 ? "真正结束时，宝宝坐上车后回头挥了挥手，我站在原地看着车离开。" : `普通原文-${i + 1}`,
  })),
};
fallbackOffline.history.unshift(longHistory);
fallbackSandbox.chatCalls = 0;
fallbackSandbox.chatAPI = async (messages) => {
  fallbackSandbox.chatCalls += 1;
  fallbackSandbox.candidateInput = messages[1].content;
  if (messages[0].content.includes("严格的线下约会记忆核对员")) return '{"supported":[1,2,3,4,5,6,7,8]}';
  const pad = "我把当时发生的前因后果、双方说过的话以及最后的结果都按照原记录记了下来，不会省略这件事的开头和结尾。".repeat(2);
  return JSON.stringify([{text:"我答应以后遇到问题会直接告诉宝宝。"+pad,sourceIndexes:[10],importance:5},{text:"我记得普通原文-20。"+pad,sourceIndexes:[20],importance:2},{text:"我记得普通原文-30。"+pad,sourceIndexes:[30],importance:2},{text:"宝宝告诉我一件关于家人的重要往事。"+pad,sourceIndexes:[40],importance:4},{text:"我记得普通原文-50。"+pad,sourceIndexes:[50],importance:2},{text:"我记得普通原文-60。"+pad,sourceIndexes:[60],importance:2},{text:"争执后我向宝宝道歉，我们说好不再冷战。"+pad,sourceIndexes:[70],importance:5},{text:"最后我们决定以后不管多忙都要好好说晚安，我保证不会忘记。"+pad,sourceIndexes:[79],importance:5}]);
};
assert.equal(await fallbackSandbox.offSummarizeHistory("c1", "h-long", false), "done");
assert.equal(fallbackSandbox.chatCalls, 2);
assert.match(fallbackSandbox.candidateInput, /待核对候选/);
assert.match(fallbackSandbox.candidateInput, /答应以后遇到问题/);
assert.match(fallbackSandbox.candidateInput, /关于家人的重要往事/);
assert.match(fallbackSandbox.candidateInput, /说好不再冷战/);
const longMemories = fallbackOffline.memory.filter((m) => m.historyId === "h-long");
assert.ok(longMemories.length >= 8 && longMemories.length <= 12);
assert.ok(longMemories.every((m) => m.sourceIndexes.length >= 1));
assert.ok(longMemories.every((m) => Array.from(m.text).length >= 100));
assert.ok(longMemories.some((m) => m.text.includes("答应以后遇到问题")));
assert.ok(longMemories.some((m) => m.text.includes("关于家人的重要往事")));
assert.ok(longMemories.some((m) => m.text.includes("说好不再冷战")));
assert.ok(longMemories.some((m) => m.text.includes("好好说晚安") && m.text.includes("保证不会忘记")));
assert.ok(longMemories.some((m) => m.text.includes("坐上车") && m.text.includes("看着车离开")));

assert.match(source, /function tvStartDate\(tid\)[\s\S]*?offBeginSession\(trip\.cid,o,trip\.to,trip\.date,dayPartNow\(\)\)/);
assert.match(source, /who:'\u65c1\u767d',source:'me',text:'\uff08'\+tvMD\(trip\.date\)/);

assert.match(source, /const item=items\[i\],timing=offRevealTiming\(item\)/);
assert.match(source, /d\.msgs\.some\(m=>m\._reveal\)/);
assert.match(source, /who:'\u65c1\u767d',source:'me',text:v/);
assert.match(source, /m\.who==='\u65c1\u767d'&&m\.source==='me'/);
assert.match(source, /class="rpnar/);
assert.match(source, /class="bubble rpbubble"/);

assert.match(html, /\.offstage\{/);
assert.match(html, /\.offintro\{/);
assert.match(html, /\.offmsg\.them \.offbubble\{/);
assert.match(html, /\.offmsg\.me \.offbubble\{/);
assert.match(html, /\.offreveal \.offglyph/);
assert.match(html, /@keyframes offglyph/);
assert.doesNotMatch(html, /\.offnar,\.offmsg\{animation:offfade/);
assert.match(html, /\.rpstage\{/);
assert.match(html, /\.rpnar\{/);
assert.match(html, /\.rpmsg\.them \.rpbubble\{/);
assert.match(html, /\.rpmsg\.me \.rpbubble\{/);
assert.match(html, /app\.js\?v=1155/);

console.log("offline date tests passed");
