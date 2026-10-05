import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.match(app, /function testTTS\(\)[\s\S]*ttsArr\(/, 'the settings test must keep the external TTS path');
assert.match(app, /function ttsContentLang\(c\)/);
assert.match(app, /function ttsLanguageBoost\(c\)/);
assert.match(app, /ttsUseRelay\(c\)&&t\.relayLang\?t\.relayLang:role/);
assert.match(app, /_vlang=ttsContentLang\(c\)/);
assert.match(app, /const _lang=ttsContentLang\(c\)/);

console.log("AI voice language tests passed");
