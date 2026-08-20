import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const account = fs.readFileSync(new URL("../ai-account.js", import.meta.url), "utf8");
const aiTestVoiceStart = account.indexOf('async function aiTestVoice()');
const aiTestVoiceEnd = account.indexOf('function aiAccountApplyResult', aiTestVoiceStart);
assert.ok(aiTestVoiceStart >= 0 && aiTestVoiceEnd > aiTestVoiceStart, 'aiTestVoice source must be extractable');
const aiTestVoiceSource = account.slice(aiTestVoiceStart, aiTestVoiceEnd);
const aiInternalVoiceSource = account.match(/function aiInternalVoiceId\(\)\{[^\n]+\}/)?.[0];
assert.ok(aiInternalVoiceSource, 'aiInternalVoiceId source must be extractable');
const internalVoiceContext = {
  S: { settings: { tts: { voice: 'external-only-voice' } } },
  AI_VOICE_PRESETS: [{ id: 'male-qn-qingse' }],
  aiPrivateVoices: () => [],
  aiCachedVoiceList: () => [],
};
vm.createContext(internalVoiceContext);
vm.runInContext(aiInternalVoiceSource, internalVoiceContext);
assert.equal(internalVoiceContext.aiInternalVoiceId(), '', 'an arbitrary external voice id must not be migrated into the internal voice slot');
internalVoiceContext.S.settings.tts.relayVoice = 'internal-clone';
assert.equal(internalVoiceContext.aiInternalVoiceId(), 'internal-clone', 'the dedicated internal voice slot must win without changing the external slot');
assert.equal(internalVoiceContext.S.settings.tts.voice, 'external-only-voice');
delete internalVoiceContext.S.settings.tts.relayVoice;
internalVoiceContext.S.settings.tts.voice = 'male-qn-qingse';
assert.equal(internalVoiceContext.aiInternalVoiceId(), 'male-qn-qingse', 'known legacy internal voices remain compatible');

assert.match(account, /内置语音语言/);
assert.match(account, /只影响内置AI语音；外置语音仍使用角色里的语言/);
assert.match(account, /语音扣点明码标价/);
assert.match(account, /1～50字：1点/);
assert.match(account, /51～100字：2点/);
assert.match(account, /101～150字：3点/);
assert.match(account, /最多300字：6点/);
assert.match(account, /生成失败：不扣点/);
assert.match(account, /color:#ff5b6f/);
assert.match(account, /function aiSetVoiceLanguage\(lang\)/);
assert.match(account, /relayLang=\['zh','粤','英','日','韩','法','德','俄'\]\.includes\(lang\)\?lang:''/);
assert.match(account, /option value="粤"/);
assert.match(account, /option value="法"[^>]*>法语<\/option>/);
assert.match(account, /option value="德"[^>]*>德语<\/option>/);
assert.match(account, /option value="俄"[^>]*>俄语<\/option>/);
assert.match(account, /'粤':'我而家試緊呢把聲嘅效果同埋收費。'/);
assert.match(account, /function aiVoiceTestText\(\)/);
assert.match(account, /function aiInternalVoiceId\(\)/);
assert.match(account, /relayVoice/);
assert.match(account, /当前内置音色/);
assert.match(account, /测试内置语音/);
assert.match(account, /外置语音的地址、Key、模型和音色不会在这里被改动/);
assert.match(aiTestVoiceSource, /aiRelay\('tts'/);
assert.doesNotMatch(aiTestVoiceSource, /ttsArr\(/, 'AI account must never route its internal test through the external TTS client');
assert.match(account, /S\.settings\.tts\.relayVoice=id/);
assert.doesNotMatch(account, /function aiPickVoice\(id\)[^\n]*S\.settings\.tts\.voice=id/, 'choosing an internal voice must not overwrite the external voice id');
assert.match(app, /function ttsRelayVoiceIds\(tts\)[^\n]*tts\.relayVoice/);
assert.match(app, /function testTTS\(\)[\s\S]*ttsArr\(/, 'the settings test must keep the external TTS path');
assert.match(account, /'英':'Hi, I am testing the cost and sound of this voice\.'/);
assert.match(account, /'法':'Bonjour, je teste/);
assert.match(account, /'德':'Hallo, ich teste/);
assert.match(account, /'俄':'Привет, я проверяю/);
assert.match(app, /function ttsContentLang\(c\)/);
assert.match(app, /function ttsLanguageBoost\(c\)/);
assert.match(account, /language_boost:typeof ttsLanguageBoost==='function'\?ttsLanguageBoost\(null\):'auto'/);
assert.match(app, /ttsUseRelay\(\)&&t\.relayLang\?t\.relayLang:role/);
assert.match(app, /_vlang=ttsContentLang\(c\)/);
assert.match(app, /const _lang=ttsContentLang\(c\)/);

console.log("AI voice language tests passed");
