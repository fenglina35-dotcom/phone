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

const context = vm.createContext({
  hasCN: (text) => /[\u3400-\u9fff]/.test(text || ""),
  CJK_RE: /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g,
  CN_PUNCT_RE: /[（）()「」『』【】《》〈〉、，。．！？；：…—～·“”‘’]/g,
  splitBubbles: (text) => (text || "").split("\n").map((s) => s.trim()).filter(Boolean),
  ttsCueKind: (cue) => cue || "",
  ttsContentLang: (c) => c?.lang || "zh",
  isRefusal: (text) => /legacy refusal/i.test(text || ""),
  isCallRefusal: (text) => /model refusal/i.test(text || ""),
  isOOCLine: (text) => /system policy/i.test(text || ""),
  callVideoVisionReplyGrounded: () => true,
});

for (const name of [
  "normVoiceLang",
  "pickSpoken",
  "callCnTermFix",
  "callNormalizeCnTranslationLine",
  "callNormalizeForeignOrig",
  "callNormalizeLine",
  "callIsActionLine",
  "callHasVideoAction",
  "ensureVideoCallAction",
  "callHasSpokenDialogue",
  "callVideoFallbackDialogue",
  "ensureVideoCallDialogue",
  "hasForeign",
  "callBadForeignMix",
  "callBadForeignLine",
  "callDrifted",
  "callEnglishTranslationRequired",
  "callCantoneseTranslationRequired",
  "callTranslationIssue",
  "callOutputIssue",
  "callExplicitSelfHarmIntent",
  "callUnansweredMistake",
]) {
  vm.runInContext(functionSource(name), context);
}

assert.equal(context.callNormalizeLine("(baby。)", "英"), "（宝贝。）");
assert.equal(context.callNormalizeLine("（Baby.）", "英"), "（宝贝.）");
assert.equal(context.callNormalizeLine("Answer先生.", "英"), "Answer me.");
assert.equal(context.callBadForeignMix("Answer先生.", "英"), true);
assert.equal(context.callBadForeignMix("baby嘴还敢硬?", "英语"), true);
assert.equal(context.callBadForeignMix("baby嘴还敢硬?", "en"), true);
assert.equal(context.callBadForeignMix("Answer me.", "英"), false);
assert.equal(context.callBadForeignLine("任务是23:59之前交完", "英语"), true);
assert.equal(context.callBadForeignLine("【凑近镜头笑】", "英语"), false);
assert.equal(context.callDrifted("baby嘴还敢硬?\n（宝贝还敢顶嘴？）", "英语"), true);
assert.equal(context.callDrifted("任务是23:59之前交完\n（任务截止时间是23:59）", "英语"), true);
assert.equal(context.callDrifted("【凑近镜头笑】\nBaby, still talking back?\n（宝贝，还敢顶嘴？）", "英语"), false);
assert.equal(context.callTranslationIssue("Baby, still talking back?\n（宝贝，还敢顶嘴？）", "英语"), "");
assert.equal(context.callTranslationIssue("Baby, still talking back?", "英语"), "英语台词没有逐句普通话翻译");
assert.equal(context.callTranslationIssue("I want you to stay right here with me.\n（我要你留在这里陪我。）\nYou need to look directly at me now.", "英语"), "英语台词没有逐句普通话翻译");
assert.equal(context.callTranslationIssue("I cannot continue this intimate roleplay with you.", "zh"), "");
assert.equal(context.callTranslationIssue("Claude", "zh"), "");
assert.equal(context.callTranslationIssue("North", "英语"), "");
assert.equal(context.callTranslationIssue("My darling.", "英语"), "");
assert.equal(context.callTranslationIssue("好掛住你", "粤语"), "粤语台词没有逐句普通话翻译");
assert.equal(context.callTranslationIssue("好掛住你\n（很想你。）", "粤语"), "");
assert.equal(context.callTranslationIssue("好きだよ", "日语"), "");
assert.equal(context.callTranslationIssue("사랑해", "韩语"), "");
assert.equal(context.callOutputIssue("model refusal", { lang: "英" }, false, {}), "模型跳出角色或输出了拒绝/说教内容");
assert.equal(context.callOutputIssue("Stay here.\n（待在这里。）", { lang: "英" }, false, {}), "");
assert.equal(context.callOutputIssue("North", { lang: "英" }, false, {}), "");
assert.equal(context.callOutputIssue("I want you to stay right here with me.", { lang: "英" }, false, {}), "英语台词没有逐句普通话翻译");
assert.equal(context.callOutputIssue("我好掛住你", { lang: "粤" }, false, {}), "粤语台词没有逐句普通话翻译");
assert.equal(context.callOutputIssue("我好掛住你\n（我很想你。）", { lang: "粤" }, false, {}), "");
assert.equal(context.callExplicitSelfHarmIntent("疼，轻一点"), false);
assert.equal(context.callExplicitSelfHarmIntent("我真的想自杀"), true);
assert.equal(context.callHasVideoAction("你好\n【凑近镜头笑】"), true);
assert.equal(context.callHasVideoAction("你好\n[挂断]"), false);
assert.equal(context.ensureVideoCallAction("你好", "laugh"), "你好\n【看着镜头轻轻笑了一下】");
assert.equal(context.ensureVideoCallAction("你好\n【抬手整理衣领】", "tense"), "你好\n【抬手整理衣领】");
assert.equal(context.callHasSpokenDialogue("【看着镜头，神情随着话音轻轻变化】", "zh"), false);
assert.equal(context.callHasSpokenDialogue("[通话语气|中性]\n【看着镜头】", "zh"), false);
assert.equal(context.callHasSpokenDialogue("【看着镜头】\n我在，怎么了？", "zh"), true);
assert.equal(context.callHasSpokenDialogue("【看着镜头】\nI'm here.\n（我在。）", "英"), true);
assert.equal(context.callHasSpokenDialogue("【看着镜头】\n（我在。）", "英"), false);
assert.equal(context.ensureVideoCallDialogue("【看着镜头】", "zh"), "【看着镜头】\n我在，刚才有点走神。");
assert.equal(context.ensureVideoCallDialogue("【看着镜头】", "英"), "【看着镜头】\nI'm here. I got distracted for a moment.\n（我在，刚才有点走神。）");
assert.match(source, /英文原文行不能夹中文称谓/);
assert.match(source, /中文翻译必须写“宝贝\/亲爱的”/);
assert.match(source, /每一轮都必须至少说1句真正会被听见的台词，同时至少有1行动作/);
assert.match(source, /语言纠正重试仍未提供逐句普通话翻译/);
assert.match(source, /上一版只有动作、神态或控制标签，没有任何真正说出口的台词/);
assert.match(source, /if\(isAction\)\{_call\.sub=\{who:'them',text:subText\};updateCallSub\(\);await sleep\(callPaceMs\(Math\.max\(1150,Array\.from\(u\.orig\)\.length\*105\),760\)\);continue;\}/);
assert.doesNotMatch(source, /Math\.min\(980,360\+Array\.from\(u\.orig\)\.length\*17\)/);

console.log("call format tests passed");
