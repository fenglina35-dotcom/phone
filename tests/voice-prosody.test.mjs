import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const backend = fs.readFileSync(new URL("../supabase/functions/phone-ai/index.ts", import.meta.url), "utf8");

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

const context = vm.createContext({ ttsUseRelay: () => false, ttsCfg: () => ({}), DEFAULT_TTS_VOICE: "male-qn-qingse" });
for (const name of ["ttsStyleKind", "ttsCueKind", "ttsAutoCue", "ttsRequestedCue", "tts2p8Interjection", "tts2p8IsInterjectionCue", "ttsRelayInterjection", "ttsFishSoundLead", "ttsFishTags", "ttsFishEmphasis", "ttsFishPerformance", "ttsBracketPerformance", "voiceRate", "voicePitch", "voiceApiPitch", "voiceApiTuningOn", "voicePauseSeconds", "ttsSentencePauseText", "ttsVoiceProfile", "parseVoiceTagLine", "normVoiceLang", "ttsContentLang", "ttsLanguageBoost", "normVoiceAccent", "voiceEnglishPrompt", "applySystemVoice", "hasForeign", "voiceLangName", "explicitVoiceReplyRequest", "voiceReplyTagValid", "requestedVoiceNeedsFix", "voiceTagNeedsLangFix", "ttsVoiceAccessErrorText", "ttsRelayVoiceIds"]) {
  vm.runInContext(functionSource(name), context);
}
vm.runInContext(functionSource("fishVoiceItems"), context);
context.splitBubbles = (text) => (text || "").split("\n").map((s) => s.trim()).filter(Boolean);
context.hasCN = (text) => /[\u3400-\u9fff]/.test(text || "");

assert.equal(context.ttsRequestedCue("Be meaner. Lower your voice."), "质问");
assert.equal(context.ttsRequestedCue("Please whisper and speak softly."), "低声");
assert.equal(context.tts2p8IsInterjectionCue(context.ttsRequestedCue("Please laugh once.")), true);
assert.equal(context.tts2p8IsInterjectionCue(context.ttsRequestedCue("Give me a kiss.")), true);
assert.equal(context.ttsCueKind("emotion: angry"), "tense");
assert.equal(context.ttsCueKind("surprised"), "surprised");
assert.equal(context.ttsCueKind("低沉"), "sleepy");
assert.equal(context.ttsAutoCue("Tell me why you lied to me.", null), "tense");
assert.equal(context.tts2p8Interjection("Come here.", "亲亲"), "Come here. (lip-smacking)");
assert.equal(context.tts2p8Interjection("I missed you.", "叹气"), "(sighs) I missed you.");
assert.equal(context.tts2p8Interjection("I missed you.", "难过"), "I missed you.");

const minimax28 = { base: "https://api.minimax.io", model: "speech-2.8-turbo" };
assert.deepEqual(JSON.parse(JSON.stringify(context.parseVoiceTagLine("[我发语音说：哦？ 是吗。看来是我误会宝宝了。 |语气:低沉]"))), {
  text: "哦？ 是吗。看来是我误会宝宝了。",
  trans: "",
  cue: "低沉",
});
assert.deepEqual(JSON.parse(JSON.stringify(context.parseVoiceTagLine("[语音|Tell me why.|语气:质问]"))), {
  text: "Tell me why.",
  trans: "",
  cue: "质问",
});
assert.equal(context.voiceTagNeedsLangFix("[我发语音说：哦？ 是吗。|语气:低沉]", { voice: { lang: "英" } }), true);
context.S = { settings: { voiceFreq: 1 } };
context.VOICE_MAX_CHARS = 300;
assert.equal(context.requestedVoiceNeedsFix("I miss you.", "给我发一条语音", { voice: { lang: "英" } }), true);
assert.equal(context.requestedVoiceNeedsFix("[语音|I miss you.|我想你了|语气:温柔]", "给我发一条语音", { voice: { lang: "英" } }), false);
assert.equal(context.requestedVoiceNeedsFix("[语音|I miss you.|我想你了]\n再补一大段普通文字", "给我发一条语音", { voice: { lang: "英" } }), true);
context.ttsUseRelay = () => true;
context.ttsCfg = () => ({ relayLang: "英" });
assert.equal(context.ttsContentLang({ voice: { lang: "zh" } }), "英", "built-in language must override the role language");
assert.equal(context.ttsLanguageBoost({ voice: { lang: "zh" } }), "English", "built-in English must be explicit in the TTS request");
context.ttsUseRelay = () => false;
assert.equal(context.ttsContentLang({ voice: { lang: "英" } }), "英", "external voice must keep the role language");
assert.equal(context.ttsLanguageBoost({ voice: { lang: "日" } }), "Japanese");
assert.equal(context.ttsLanguageBoost({ voice: { lang: "粤" } }), "Chinese,Yue");
assert.equal(context.ttsLanguageBoost({ voice: { lang: "法" } }), "French");
assert.equal(context.ttsLanguageBoost({ voice: { lang: "德" } }), "German");
assert.equal(context.ttsLanguageBoost({ voice: { lang: "俄" } }), "Russian");
assert.equal(context.normVoiceLang("yue-HK"), "粤");
assert.equal(context.normVoiceLang("French"), "法");
assert.equal(context.normVoiceLang("de-DE"), "德");
assert.equal(context.normVoiceLang("Russian"), "俄");
assert.equal(context.voiceLangName("粤"), "粤语");
assert.equal(context.voiceLangName("法"), "法语");
assert.equal(context.voiceLangName("德"), "德语");
assert.equal(context.voiceLangName("俄"), "俄语");
assert.equal(context.hasForeign("Je suis là.", "法"), true);
assert.equal(context.hasForeign("Grüß dich.", "德"), true);
assert.equal(context.hasForeign("Я здесь.", "俄"), true);
assert.equal(context.hasForeign("I am here.", "俄"), false);
assert.equal(context.voiceTagNeedsLangFix("[语音|Tell me why.|为什么这样？|语气:质问]", { voice: { lang: "英" } }), false);
assert.equal(context.normVoiceAccent({ lang: "\u82f1", accent: "british" }), "en-GB");
assert.equal(context.normVoiceAccent({ lang: "\u82f1", accent: "en-US" }), "en-US");
assert.equal(context.normVoiceAccent({ lang: "\u82f1" }), "auto");
assert.match(context.voiceEnglishPrompt({ voice: { lang: "\u82f1", accent: "en-GB" } }), /British English/);
assert.equal(context.voiceEnglishPrompt({ voice: { lang: "zh", accent: "en-GB" } }), "");
context._voices = [{ voiceURI: "gb-voice", lang: "en-GB" }, { voiceURI: "us-voice", lang: "en-US" }];
const utterance = {};
context.applySystemVoice(utterance, { lang: "\u82f1", accent: "en-GB", voiceURI: "" });
assert.equal(utterance.lang, "en-GB");
assert.equal(utterance.voice.voiceURI, "gb-voice");
context._voices = [{ voiceURI: "hk-voice", lang: "zh-HK" }];
const cantoneseUtterance = {};
context.applySystemVoice(cantoneseUtterance, { lang: "粤", accent: "auto", voiceURI: "" });
assert.equal(cantoneseUtterance.lang, "yue-HK");
assert.equal(cantoneseUtterance.voice.voiceURI, "hk-voice");
context._voices = [{ voiceURI: "fr-voice", lang: "fr-FR" }, { voiceURI: "de-voice", lang: "de-DE" }, { voiceURI: "ru-voice", lang: "ru-RU" }];
for (const [lang, locale, voiceURI] of [["法", "fr-FR", "fr-voice"], ["德", "de-DE", "de-voice"], ["俄", "ru-RU", "ru-voice"]]) {
  const localized = {};
  context.applySystemVoice(localized, { lang, accent: "auto", voiceURI: "" });
  assert.equal(localized.lang, locale);
  assert.equal(localized.voice.voiceURI, voiceURI);
}

const minimax02 = { base: "https://api.minimax.io", model: "speech-02-turbo" };
const eleven3 = { base: "https://api.elevenlabs.io", model: "eleven_v3" };
const fish21 = { base: "https://api.fish.audio", model: "s2.1-pro-free" };
const hume2 = { base: "https://api.hume.ai", model: "octave-2" };
assert.equal(context.ttsStyleKind(eleven3), "eleven");
assert.equal(context.ttsStyleKind(fish21), "fish");
assert.equal(context.ttsStyleKind(hume2), "hume");
assert.equal(context.ttsBracketPerformance("Tell me why you lied.", "questioning", "fish", true), "[frustrated][confident] Tell me [emphasis] why you lied.");
assert.equal(context.ttsBracketPerformance("I am jealous.", "jealous", "fish", true), "[jealous] I am jealous.");
assert.equal(context.ttsBracketPerformance("Please whisper.", "whisper", "fish", true), "[whispering] Please whisper.");
assert.equal(context.ttsBracketPerformance("Tell me the truth.", "质问", "eleven", true), "[angry, controlled] Tell me the truth.");
assert.equal(context.ttsBracketPerformance("Come here.", "亲亲", "fish", true), "[kissing softly] Mwah. Come here.");
assert.equal(context.ttsBracketPerformance("That was funny.", "giggle", "fish", true), "[chuckling] Heh, heh. That was funny.");
context.ttsCleanBase = (x) => String(x || "").trim();
context.ttsSafeProsody = (x) => x;
context.VOICE_MAX_CHARS = 300;
vm.runInContext(functionSource("ttsPerformanceText"), context);
assert.equal(context.ttsPerformanceText("Come here.", null, minimax28, { cue: "亲亲" }), "Come here. (lip-smacking)");
assert.equal(context.ttsPerformanceText("Come here.", null, minimax28, { cue: "亲亲", interjection: false }), "Come here.");
assert.equal(context.ttsPerformanceText("Come here.", null, minimax02, { cue: "亲亲" }), "Come here.");
assert.equal(context.ttsPerformanceText("Tell me.", null, eleven3, { cue: "质问" }), "[angry, controlled] Tell me.");
assert.equal(context.ttsPerformanceText("Come here.", null, fish21, { cue: "亲亲" }), "[kissing softly] Mwah. Come here.");
context.ttsUseRelay = () => true;
assert.equal(context.ttsPerformanceText("That was funny.", null, minimax02, { cue: "giggle" }), "Heh... That was funny.");
context.ttsUseRelay = () => false;
assert.deepEqual(
  JSON.parse(JSON.stringify(context.ttsVoiceProfile("Tell me why.", { cue: "angry" }, minimax28))),
  { speed: 1, vol: 1, pitch: 0, emotion: "angry" },
);
assert.equal(context.ttsVoiceProfile("No way!", { cue: "surprised" }, minimax28).pitch, 0);
assert.equal(context.ttsVoiceProfile("I am hurt.", { cue: "sad" }, minimax28).emotion, "sad");
assert.equal(context.ttsVoiceProfile("Tell me why.", { cue: "angry" }, minimax02).emotion, undefined);
assert.equal(context.ttsVoiceProfile("Come here.", { cue: "亲亲" }, minimax28).emotion, undefined);
assert.equal(context.ttsVoiceProfile("I miss you.", { cue: "warm" }, minimax28).emotion, undefined);
assert.equal(JSON.stringify({ emotion: context.ttsVoiceProfile("I miss you.", { cue: "warm" }, minimax28).emotion }), "{}");
assert.equal(JSON.parse(JSON.stringify({ emotion: context.ttsVoiceProfile("Tell me why.", { cue: "angry" }, minimax28).emotion })).emotion, "angry");
const protectedProfile = context.ttsVoiceProfile("Keep the cloned voice.", {}, minimax28, { rate: 0.6, pitch: 0.5 });
assert.equal(protectedProfile.speed, 1);
assert.equal(protectedProfile.pitch, 0);
const tunedProfile = context.ttsVoiceProfile("Slow down.", {}, minimax28, { rate: 0.6, pitch: 0.5, apiTuning: true });
assert.equal(tunedProfile.speed, 0.6);
assert.equal(tunedProfile.pitch, -12);
assert.equal(context.ttsSentencePauseText("One. Two.", { pause: 1 }), "One. Two.");
for (const cue of ["angry", "sad", "happy", "surprised", "fearful", "disgusted", "whisper", "kiss"]) {
  const profile = context.ttsVoiceProfile("Keep my voice.", { cue }, minimax28);
  assert.equal(profile.pitch, 0, `${cue} changed pitch`);
  assert.equal(profile.speed, 1, `${cue} changed speed`);
  assert.equal(profile.vol, 1, `${cue} changed volume`);
}

assert.match(source, /aiRelay\('tts',\{text:t,voice_id:vid\|\|DEFAULT_TTS_VOICE,model:'speech-02-turbo',language_boost:languageBoost,voice_setting:setting\}\)/);
assert.match(source, /if\(cue==='laugh'\)setting\.emotion='happy'/);
assert.deepEqual(JSON.parse(JSON.stringify(context.ttsRelayVoiceIds({ voice: "account-clone" }))), ["account-clone"]);
assert.deepEqual(JSON.parse(JSON.stringify(context.ttsRelayVoiceIds({ relayVoice: "internal-clone", voice: "external-clone" }))), ["internal-clone"]);
assert.deepEqual(JSON.parse(JSON.stringify(context.ttsRelayVoiceIds({ voice: "" }))), ["male-qn-qingse"]);
assert.equal(context.ttsVoiceAccessErrorText("you don't have access to this voice_id"), true);
assert.equal(context.ttsVoiceAccessErrorText("tts-private-voice-not-owned"), true);
assert.match(source, /const ids=ttsRelayVoiceIds\(tts\)/);
assert.doesNotMatch(source, /ttsRelayVoiceIds\(v&&v\.ttsVoice,tts\)/);
assert.doesNotMatch(source, /ttsRelayOn\(t\)&&!ttsExternalOn\(t\)/);
assert.match(source, /function ttsUseRelay\(\)\{const t=ttsCfg\(\);return !!\(ttsEnabled\(t\)&&ttsRelayOn\(t\)\);\}/);
assert.match(source, /try\{if\(ttsUseRelay\(\)\)\{const d=await aiRelay\('tts_voices'/);
assert.match(backend, /model = "speech-02-turbo"/);
assert.match(backend, /language_boost: safeTTSLanguageBoost\(languageBoost\)/);
assert.match(backend, /"Chinese,Yue"/);
assert.match(backend, /"French"/);
assert.match(backend, /"German"/);
assert.match(backend, /"Russian"/);
assert.match(backend, /body\.voice_setting \|\| null, body\.language_boost/);
assert.match(backend, /voice_setting: \{ voice_id: voiceId, \.\.\.safeTTSVoiceSetting\(setting\) \}/);
assert.match(backend, /if \(allowed\.has\(emotion\)\) out\.emotion = emotion/);
assert.doesNotMatch(backend, /: "neutral";/);
assert.match(backend, /if \(chars > TTS_MAX_CHARS\)/);
assert.match(backend, /ledger_id: c\.ledgerId/);
assert.match(backend, /action === "tts_refund"/);
assert.match(backend, /function refundTtsLedger/);
assert.match(source, /ttsRefundLedger\(ledger,'tts-no-audio'\)/);
assert.match(source, /ttsRefundAudio\(ab,'tts-decode-failed'\)/);

const route = { enabled: true, relay: false, base: "https://api.minimax.io", key: "sk-direct" };
const routeContext = vm.createContext({
  ttsCfg: () => route,
  aiCoreUrl: () => "https://relay.test/functions/v1/phone-ai",
});
for (const name of ["ttsExternalOn", "ttsRelayOn", "ttsEnabled", "ttsUseRelay"]) {
  vm.runInContext(functionSource(name), routeContext);
}
assert.equal(routeContext.ttsUseRelay(), false, "external MiniMax must stay external");
route.relay = true;
assert.equal(routeContext.ttsUseRelay(), true, "the explicit built-in voice switch must take priority over saved external credentials");
route.base = "";
route.key = "";
assert.equal(routeContext.ttsUseRelay(), true, "relay must remain active after external credentials are cleared");

assert.match(source, /model:tts\.model\|\|'speech-02-turbo'/);
assert.match(source, /'https:\/\/api\.elevenlabs\.io','eleven_v3'/);
assert.match(source, /id="v_accent"/);
assert.match(source, /option value="法"[^>]*>法语<\/option>/);
assert.match(source, /option value="德"[^>]*>德语<\/option>/);
assert.match(source, /option value="俄"[^>]*>俄语<\/option>/);
assert.match(source, /Bonjour, voici ma voix/);
assert.match(source, /Hallo, das ist meine Stimme/);
assert.match(source, /Привет, это мой голос/);
assert.match(source, /accent:\$\('#v_accent'\)\.value/);
assert.match(source, /applySystemVoice\(u,v\)/);
assert.match(source, /'https:\/\/api\.fish\.audio','s2\.1-pro-free'/);
assert.match(source, /'https:\/\/api\.hume\.ai','octave-2'/);
assert.match(source, /'X-Hume-Api-Key':tts\.key/);
assert.match(source, /function ttsFishTags/);
assert.match(source, /function ttsFishPerformance/);
assert.match(source, /aiRelay\('external_tts',\{provider:'fish'/);
assert.match(source, /stripCallControlTags\(l,c,_call\.id,video\)/);
assert.match(source, /if\(!keepActions\)t=t\.replace\(\/【\[\^】\]\*】\/g,''\)/);
assert.match(source, /const VOICE_AUDIO_TTL_MS=24\*60\*60\*1000/);
assert.match(source, /function voiceAudioExpired/);
assert.match(source, /m\.audioTs=Date\.now\(\)/);
assert.match(source, /if\(voiceAudioExpired\(m\)\)clearVoiceAudio\(m\)/);
assert.match(source, /function fishVoiceItems/);
assert.match(source, /base\+'\/model\?self=true&page_size=100'/);
assert.deepEqual(JSON.parse(JSON.stringify(context.fishVoiceItems({ items: [{ _id: "fish-voice-id", title: "我的克隆" }] }))), [
  { id: "fish-voice-id", name: "我的克隆", clone: true },
]);
assert.match(backend, /if \(action === "external_tts"\)/);
assert.match(backend, /async function externalFishTTS/);
assert.match(backend, /headers\.model = model/);
assert.match(source, /通话字幕延后/);
assert.match(source, /通话句间衔接/);
assert.match(source, /function callPaceRate\(\)/);
assert.doesNotMatch(source, /s\.playbackRate\.value=callPaceRate\(\)/);
assert.doesNotMatch(source, /u\.rate=\(\+v\.rate\|\|1\)\*vp\.speed/);
assert.match(functionSource("speakWait"), /u\.rate=voiceRate\(v\);u\.pitch=voicePitch\(v\)/, "system speech sliders must be applied exactly once");
assert.match(functionSource("previewVoice"), /audioUnlock\(\)/, "voice preview must unlock mobile audio inside the click gesture");
assert.match(functionSource("previewVoice"), /await speak\(samp,c\)/, "voice preview must keep the temporary voice until async playback starts");
assert.match(functionSource("previewVoice"), /finally\{c\.voice=tmp;\}/, "voice preview must restore the saved role voice after playback setup");
assert.match(functionSource("playBuf"), /if\(_audio\.state!==\x27running\x27\)return false/, "buffer playback must not report success while the mobile audio context is still suspended");
assert.match(functionSource("testTTS"), /const played=await playBuf\(buf\)/, "external voice test must report actual playback instead of only successful generation");
assert.match(functionSource("testTTS"), /relay:!!\(saved&&saved\.relay\)/, "voice test must exercise the currently active internal route even when an external route is also configured");
assert.match(source, /API音色使用上面的语速和音调/);
assert.match(source, /voiceProgressive:false/);
assert.match(source, /语音逐句生成/);
assert.doesNotMatch(functionSource("aiReply"), /await warmVoiceMsg\(vm,c\)/, "voice generation must not hide the role reply until audio is ready");
const voiceReplySource=functionSource("aiReply"),voiceBubbleAt=voiceReplySource.indexOf("appendChatMessageHTML(id,c,vm"),voiceWarmAt=voiceReplySource.indexOf("scheduleVoiceWarm(vm,c");
assert.ok(voiceBubbleAt>=0&&voiceWarmAt>voiceBubbleAt, "the reply bubble must render before background voice generation starts");
assert.match(functionSource("scheduleVoiceWarm"), /_voiceWarmQueues/, "progressive chat voice generation should remain sequential in the background");
assert.doesNotMatch(backend, /signal: AbortSignal\.timeout\(25000\)/, "slow but valid voice generation must not be cut off before audio exists");
assert.doesNotMatch(functionSource("testTTS"), /Promise\.race/, "voice testing must wait for the configured provider instead of discarding late audio");
assert.match(functionSource("testTTS"), /audioUnlock\(\);const played=await playBuf\(buf\)/, "voice testing should wake the shared audio path again before playback");
assert.match(functionSource("ensureAudio"), /staleSuspended=rebuildSuspended&&_audio&&_audio\.state==='suspended'/, "a stale suspended mobile audio context must be rebuilt on the next gesture");
assert.match(functionSource("audioUnlock"), /ensureAudio\(true\)/, "all user gestures must use the recovery path for app-wide audio");
assert.match(functionSource("audioUnlock"), /createBuffer\(1,32,22050\)/, "running-but-silent Android audio routes must receive an output pulse");
assert.match(functionSource("audioUnlock"), /navigator[\s\S]*userActivation[\s\S]*ua\.isActive/, "background pageshow must not consume the next real user-gesture unlock");
assert.doesNotMatch(functionSource("audioUnlock"), /ac&&ac\.state!==['"]running['"]\)\{[^}]*createBuffer/, "a context that claims to be running must not skip the unlock pulse");
assert.match(functionSource("playUrl"), /audioDataToBuf\(url\)[\s\S]*decodeBuf\(ab\)[\s\S]*playBuf\(buf\)/, "cached voice playback must fall back to WebAudio when HTML audio is blocked");
assert.match(functionSource("phSimRoleSay"), /!voiceProgressiveOn\(\)/);
assert.match(functionSource("callAI"), /ttsApiOn\(\)&&!voiceProgressiveOn\(\)/);
assert.match(source, /hasNextSpoken&&voicePauseMs\(c\)>0/);
assert.match(source, /await sleep\(voicePauseMs\(c\)\)/);
assert.equal(context.ttsSentencePauseText("One. Two.", { pause: 1 }), "One. Two.");
assert.doesNotMatch(context.ttsSentencePauseText("One. Two.", { pause: 2 }), /…/, "sentence pause must not be encoded as repeated ellipses");
assert.match(source, /if\(video\)content=ensureVideoCallAction\(content,_callCueTag\)/);
assert.match(source, /function phReleaseSimSub\(callId,line\)/);
assert.doesNotMatch(source, /preT=setTimeout|off<0/, "call subtitles must never race ahead from request time");
assert.match(functionSource("phPhoneVoiceOffset"), /Math\.max\(0,Math\.min\(1200/, "saved negative offsets must be clamped to zero");
assert.doesNotMatch(functionSource("callPrefetchSpeech"), /Math\.min\(2,rows\.length\)/, "the first call sentence must not compete with a second TTS request");
assert.match(functionSource("callPrefetchSpeech"), /if\(rows\.length\)worker\(\)/, "call TTS must use one ordered prefetch worker");
assert.match(functionSource("speakWait"), /prepared:?\s*opt\.prepared|opt\.prepared\?await opt\.prepared/, "call playback must accept prefetched audio");

const playbackEvents = [];
let playbackSource = null;
const playbackAudio = {
  state: "suspended",
  destination: {},
  async resume() {
    playbackEvents.push("resume");
    this.state = "running";
  },
  createBufferSource() {
    playbackSource = {
      connect() {},
      start() {
        playbackEvents.push("start");
        queueMicrotask(() => this.onended && this.onended());
      },
      stop() {},
    };
    return playbackSource;
  },
  createGain() {
    return { gain: { value: 1 }, connect() {} };
  },
};
const playbackContext = vm.createContext({
  _audio: playbackAudio,
  _curSrc: null,
  ensureAudio() {},
  volMul: () => 1,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
});
vm.runInContext("async " + functionSource("callAudioReady"), playbackContext);
vm.runInContext(functionSource("stopBufSource"), playbackContext);
vm.runInContext("async " + functionSource("playBufWait"), playbackContext);
assert.equal(await playbackContext.playBufWait({ duration: 0.01 }, () => playbackEvents.push("subtitle")), true);
assert.deepEqual(playbackEvents.slice(0, 3), ["resume", "start", "subtitle"], "subtitle must follow a resumed context and a started source");

let activePrefetch = 0, maxPrefetch = 0;
const prefetchContext = vm.createContext({
  Array,
  Promise,
  Math,
  async prepareCallSpeech(text) {
    activePrefetch++;
    maxPrefetch = Math.max(maxPrefetch, activePrefetch);
    await new Promise((resolve) => setTimeout(resolve, 12));
    activePrefetch--;
    return { buf: text };
  },
  async ttsRefundAudio() {},
});
vm.runInContext(functionSource("callPrefetchSpeech"), prefetchContext);
const prefetched = await Promise.all(prefetchContext.callPrefetchSpeech(
  ["one", "two", "three", "four"].map((spoken) => ({ spoken })),
  {},
  () => true,
));
assert.equal(prefetched.length, 4);
assert.equal(maxPrefetch, 1, "the first call sentence must be prepared before later sentences start");

console.log("voice prosody tests passed");
