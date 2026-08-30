import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(source, /const VOICE_MAX_CHARS=300;/);

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const next = source.indexOf("\nfunction ", start + 9);
  return source.slice(start, next < 0 ? source.length : next);
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
vm.runInContext(functionSource("forceRequestedVoiceReply"), context);

assert.equal(context.explicitVoiceReplyRequest("先生，你发一个五十字以上的语音"), true);
assert.equal(context.explicitVoiceReplyRequest("请用语音回复我"), true);
assert.equal(context.explicitVoiceReplyRequest("给我来段语音"), true);
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

assert.match(source, /canTextVoice=m\.role==='assistant'&&m\.type==='text'/);
assert.match(source, /onclick="openTextToVoice\('\$\{cid\}','\$\{mid\}'\)"/);
assert.match(source, /重复播放不会再次扣点/);
assert.match(source, /已转为语音，本次扣除 '\+info\.points\+' 点；重复播放不再扣点/);
assert.match(source, /const info=textToVoiceInfo\(m\.content,c\),useRelay=ttsUseRelay\(c\)/);
assert.match(source, /_textToVoiceBusy\.has\(mid\)/);
assert.match(source, /m\.type='voice'/);
assert.match(source, /m\.type='text';delete m\.showText/);
assert.match(source, /content=forceRequestedVoiceReply\(content,_voiceRequired\?_userText:''\,c\)/);
