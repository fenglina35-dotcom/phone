import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

// System-triggered call turns must never masquerade as user speech.
assert.match(source, /role:m\.type===\x27sys\x27\|\|m\._transferReceipt\?\x27system\x27:m\.role/);
assert.match(source, /if\(sysNote&&!_videoVisionAutomatic\)hist\.push\(\{role:_screenShareEvent\|\|_silentContinuation\|\|_connectionEvent\?'user':'system',content:sysNote\}\)/);
assert.match(source, /ta没有开口时，绝对不能说ta重复了你的话/);

// Hands-free recognition follows the proven v800/v850/v907 handoff: role audio is
// isolated from recognition, then the native recognizer is rebuilt afterwards.
assert.match(source, /if\(!_callHF\|\|_callHFBusy\|\|_callBusy\|\|Date\.now\(\)<_hfIgnoreUntil\)return/);
assert.match(source, /finally\{_hfIgnoreUntil=Math\.max\(_hfIgnoreUntil,Date\.now\(\)\+1500\)/);
assert.match(source, /hfAudioPaused=true;await callHFPauseForRoleAudio\(\)/);
assert.doesNotMatch(source, /_callHFPending\.push\(\{text:t,meta\}\)/);
assert.match(source, /await sleep\(760\).*typeof _callSR\.rebuild===\x27function\x27/s);

// A completed lookup is remembered in the active call without imposing a behavioral cooldown.
assert.match(source, /spyChecks:Array\.isArray\(_call\.spyChecks\)\?_call\.spyChecks\.slice\(-8\):\[\]/);
assert.match(source, /function callSpyRecentPrompt\(id\)/);
assert.match(source, /callSpyRemember\(id,opts\.focus,fd\)/);
assert.match(source, /但这不是冷却或禁止/);
assert.match(source, /出现了新的合理动机/);
assert.doesNotMatch(source, /CALL_SPY_REPEAT_MS|callSpyRecentFind/);
assert.match(source, /finishedLookup=.*刚才.*刚刚.*已经.*查过.*看过/);
assert.match(source, /heWants=heMentions&&!declinesLookup&&\(!finishedLookup\|\|wantsAgain\)/);
assert.match(source, /if\(\/\(别\|不要\|不许\|不用\|没必要\)/);

// One old user request cannot be reused by later system turns as a new request.
assert.match(source, /if\(sheInvites&&lu&&lu\._spyIntentUsed\)sheInvites=false/);
assert.match(source, /if\(sheInvites&&lu\)\{lu\._spyIntentUsed=true;save\(500\);\}/);

console.log("phone call continuity tests passed");
