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
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

assert.match(source, /function friendAcceptedLocalFallback\(id,note,aid\)/);
assert.match(source, /if\(!success&&friendAcceptedAutoNote\(note\)\)success=friendAcceptedLocalFallback\(id,note,aid\)/);
assert.match(source, /catch\(e\)\{if\(typingEl\)typingEl\.remove\(\);[\s\S]*?toast\('模型未回复：'\+em,10000\);\}/);
assert.doesNotMatch(source, /pushMsg\([^\n]*content:'⚠️ '\+e\.message/);

const messages = [];
const sandbox = {
  getC: () => ({ id: "role", name: "角色", blocked: false, deleted: false }),
  actId: () => "alt_1",
  friendReaddFallback: () => "重新添加兜底",
  msgsForAccount: () => messages,
  uid: () => "fallback_1",
  save: () => {},
  notifyIncoming: () => {},
  cur: () => ({ p: "chat", id: "role" }),
  render: () => {},
};
vm.createContext(sandbox);
vm.runInContext(
  `${functionSource("wechatServiceGreeting")}
   ${functionSource("altFriendFirstContact")}
   ${functionSource("altFriendOpeningFallback")}
   ${functionSource("friendAcceptedAutoNote")}
   ${functionSource("friendAcceptedLocalFallback")}
   this.api={wechatServiceGreeting,altFriendFirstContact,altFriendOpeningFallback,friendAcceptedAutoNote,friendAcceptedLocalFallback};`,
  sandbox,
);

assert.equal(sandbox.api.friendAcceptedAutoNote("[系统：小号刚通过你的微信号把你加为好友。]"), true);
assert.equal(sandbox.api.friendAcceptedLocalFallback("role", "[系统：小号刚通过你的微信号把你加为好友。]", "alt_1"), true);
assert.equal(messages.length, 1);
assert.equal(messages[0].content, "刚加上就来找我，是有什么事吗？");
assert.equal(sandbox.api.wechatServiceGreeting("嗨！有什么我可以帮你的吗？"), true);
assert.equal(sandbox.api.wechatServiceGreeting("刚加上就来找我，是有什么事吗？"), false);

messages.length = 0;
messages.push({ role: "user", type: "sys", content: "✅ 你通过微信号添加了 角色，你们已经是好友了" });
assert.equal(sandbox.api.altFriendFirstContact({ id: "role" }, "alt_1"), true);
messages.push({ role: "assistant", type: "text", content: "正常角色消息" });
assert.equal(sandbox.api.altFriendFirstContact({ id: "role" }, "alt_1"), false);

assert.ok(source.includes("if((_altFirstContact&&wechatRoleDrift(content))||(replyAccount!=='main'&&wechatServiceGreeting(content)))content=altFriendOpeningFallback(c);"));
assert.match(source, /if\(note\)hist\.push\(\{role:friendAcceptedAutoNote\(note\)\|\|initiativeNoteActive\(note\)\|\|wechatNaturalCallEventActive\(note\)\|\|featureEventNoteActive\(note\)\?'user'/);
assert.match(source, /!friendAcceptedAutoNote\(note\)\)toast\('模型未回复：'\+em,10000\)/);

assert.match(source, /const plan=wechatNaturalInitiativePlan\(c\)/);
assert.match(functionSource('initiativeMaybeSend'), /callChance=effCallProb\(c\)/, 'the restored user setting may select a call only after a natural proactive opportunity becomes due');
assert.match(functionSource('initiativeMaybeSend'), /roleOnlineProactiveBlocked/, 'the restored call chance must not bypass live scene and call guards');
assert.match(source, /function blockedPhoneStart\(c,now\)[\s\S]*?dueAt:t\+20000[\s\S]*?max:3/);
assert.match(source, /function blockedPhoneRetry\(call,why\)[\s\S]*?Date\.now\(\)\+20000/);
assert.match(source, /if\(isMain\(\)\)blockedPhoneStart\(c,now\)/);
assert.match(source, /blockedOutreach:true,attempt,maxAttempts/);

assert.match(source, /function friendRejectRemember\(c,r\)/);
assert.match(source, /function friendReqUnique\(c,text,attempt\)/);
assert.match(source, /if\(r\.kind==='readd'&&c\)\{friendRejectRemember\(c,r\)/);
assert.match(source, /s\+=_main\?friendReaddPrompt\(c\):''/);
assert.match(source, /friendReaddReplyNeedsRepair\(c,_userText,content\)/);

assert.doesNotMatch(source, /function checkFollowups\(\)\{if\(wechatNaturalOn\(\)/);
assert.doesNotMatch(source, /async function maybeFollowup\(id,text\)\{const c=getC\(id\);if\(wechatNaturalOn\(\)/);
assert.doesNotMatch(source, /async function holidayGreet\(id,hol\)\{if\(wechatNaturalOn\(\)/);
assert.doesNotMatch(source, /checkStepReport=function\(\)\{if\(wechatNaturalOn\(\)/);

console.log("v965 natural mode and friend recovery tests passed");
