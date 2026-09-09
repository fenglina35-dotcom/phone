import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
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

const manual = functionSource("replyGenerationRun");
const touch = functionSource("replyTouch");
assert.match(source, /function replyVisibleAssistantCount\(id,aid\)/);
assert.match(source, /function manualReplyRetryAllowed\(id,aid,token\)/);
assert.match(manual, /before=replyVisibleAssistantCount\(id,aid\)/);
assert.match(manual, /await aiReply\(id,_note,token,aid,'user',\{reopenCompleted:true\}\)/);
assert.match(manual, /inspectionPending=\(\)=>nativeInspectionPending\(_manualUser,id\)/);
assert.match(manual, /replyVisibleAssistantCount\(id,aid\)===before&&manualReplyRetryAllowed/);
assert.match(manual, /刚才没有形成任何用户能看到的微信消息/);
assert.equal((manual.match(/await aiReply\(/g) || []).length, 2, "manual reply should make at most one automatic retry");
assert.match(manual, /replyNoVisibleReasonGet\(id,aid,token\)/);
assert.match(manual, /模型未回复：/);
assert.match(source, /接口请求成功，但返回正文为空/);
assert.match(source, /模型只返回了心情、记忆或操作指令，没有可显示的聊天内容/);
assert.doesNotMatch(manual, /这次模型没有返回可见消息，请再点一下/);
assert.match(manual, /replyVisibleAssistantCount\(id,aid\)===before&&inspectionPending\(\)\)return true/, "only the current user message's own inspection may take over its reply");
assert.match(manual, /if\(inspectionPending\(\)\)return true/, "a newly queued inspection must stop the generic retry");
assert.match(manual, /!inspectionPending\(\)&&manualReplyRetryAllowed/, "the generic empty-model hint remains available when no inspection belongs to this message");
assert.doesNotMatch(manual, /rolePhoneInspectionBlocksOrdinary|rolePhoneInspectionEpoch/, "unrelated companion work must never own the ordinary reply channel");
assert.match(manual, /const running=\{id,aid,startedAt:Date\.now\(\),cancelled:false\}/, "each manual reply run needs its own ownership token");
assert.match(manual, /replyGenerationStore\(\)\[key\]===running/, "a stale request must not clear a newer reply run");
assert.match(touch, /running\.cancelled=true;delete replyGenerationStore\(\)\[k\]/, "a new user message must release a stale manual reply lock");
assert.match(touch, /_replyQueue=.*filter\(x=>x&&x\.key!==k\)/, "a newer user message must replace an obsolete queued reply");

console.log("manual reply reliability tests passed");
