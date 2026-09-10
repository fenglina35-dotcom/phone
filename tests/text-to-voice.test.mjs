import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const privateSource = fs.readFileSync(new URL("../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js", import.meta.url), "utf8");

assert.match(source, /const VOICE_MAX_CHARS=300;/);

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = source.indexOf("\nfunction ", start + 9);
  return source.slice(start, next < 0 ? source.length : next).replace(/\r/g, "");
}

function functionSourceFrom(text, name) {
  const start = text.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name} in private bundle`);
  const next = text.indexOf("\nfunction ", start + 9);
  return text.slice(start, next < 0 ? text.length : next).replace(/\r/g, "");
}

const context = vm.createContext({
  S: { settings: { voiceFreq: 1 } },
  VOICE_MAX_CHARS: 300,
  normVoiceLang: (lang) => lang || "zh",
  ttsContentLang: (c) => (c && c.voice && c.voice.lang) || "zh",
  parseVoiceTagLine: (line) => /^\s*[\[【]\s*语音[|｜:：]/.test(line || "") ? {} : null,
  ttsRequestedCue: () => "",
  ttsAutoCue: () => "",
});
vm.runInContext(functionSource("explicitVoiceReplyRequest"), context);
vm.runInContext(functionSource("voiceReplyBlocked"), context);
vm.runInContext(functionSource("forceRequestedVoiceReply"), context);

assert.equal(context.explicitVoiceReplyRequest("先生，你发一个五十字以上的语音"), true);
assert.equal(context.explicitVoiceReplyRequest("请用语音回复我"), true);
assert.equal(context.explicitVoiceReplyRequest("给我来段语音"), true);
assert.equal(context.explicitVoiceReplyRequest("发语音，我文盲"), true);
assert.equal(context.explicitVoiceReplyRequest("重新发语音"), true);
assert.equal(context.explicitVoiceReplyRequest("不要发语音"), false);
assert.equal(context.explicitVoiceReplyRequest("我刚才发的语音你听到了吗"), false);

const forced = context.forceRequestedVoiceReply(
  "[心情|认真]\n宝贝，我知道你现在很忙。\n等你忙完了回来找我，我们再慢慢把这件事说清楚。",
  "发一条语音给我",
  { voice: { lang: "zh" } },
);
assert.match(forced, /^\[心情\|认真\]\n\[语音\|/);
assert.equal((forced.match(/\[语音\|/g) || []).length, 1);
assert.doesNotMatch(forced, /\n宝贝，我知道你现在很忙。\n/);

context.S.settings.voiceFreq = 0;
const forcedForeign = context.forceRequestedVoiceReply(
  "[心情|想抱紧你]\nCome closer to me, my little puppy. Let me hold you properly.",
  "发语音，我文盲",
  { voice: { lang: "英" } },
);
assert.match(forcedForeign, /^\[心情\|想抱紧你\]\n\[语音\|Come closer to me/);
assert.equal((forcedForeign.match(/\[语音\|/g) || []).length, 1);
assert.doesNotMatch(forcedForeign, /\nCome closer to me/);
assert.equal(context.voiceReplyBlocked(0, false, true, true), false, "an explicit request must override automatic voice frequency and a missing foreign translation");
assert.equal(context.voiceReplyBlocked(0, false, true, false), true, "automatic voice policy remains unchanged without an explicit request");
assert.equal(context.voiceReplyBlocked(1, true, false, true), true, "oversized audio must still be blocked");

assert.match(source, /canTextVoice=m\.role==='assistant'&&m\.type==='text'/);
assert.match(source, /onclick="openTextToVoice\('\$\{cid\}','\$\{mid\}'\)"/);
assert.match(source, /重复播放不会再次扣点/);
assert.match(source, /已转为语音，本次扣除 '\+info\.points\+' 点；重复播放不再扣点/);
assert.match(source, /const info=textToVoiceInfo\(m\.content,c\),useRelay=ttsUseRelay\(c\)/);
assert.match(source, /_textToVoiceBusy\.has\(mid\)/);
assert.match(source, /m\.type='voice'/);
assert.match(source, /m\.type='text';delete m\.showText/);
assert.match(source, /content=forceRequestedVoiceReply\(content,_voiceRequired\?_userText:''\,c\)/);
assert.match(source, /const _voiceRequired=!note&&explicitVoiceReplyRequest\(_userText\)/);
assert.match(source, /const vm=voiceReplyBlocked\(vf0,tooLong,badLang,_voiceRequired\)/);
for (const name of ["explicitVoiceReplyRequest", "requestedVoiceNeedsFix", "voiceReplyBlocked", "forceRequestedVoiceReply"]) {
  assert.equal(functionSourceFrom(privateSource, name), functionSource(name), `${name} must stay aligned in the private built-in runtime`);
}
