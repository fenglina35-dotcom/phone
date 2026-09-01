import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

assert.match(source,/delete c\.traits/,'legacy numeric personality sliders must be removed from saved roles');
assert.match(source,/delete c\.suspicion/,'legacy suspicion state must be removed during migration');
assert.match(source,/delete c\.moodVal/,'numeric mood must be removed during migration');
assert.doesNotMatch(source,/id="ct_suspicious"|id="ct_paranoid"/,'retired suspicion sliders must have no visible fields');
assert.match(source,/function dialogueEmotion\(\)\{return null;\}/,'hidden emotion controller must be inactive');
assert.match(source,/function dialogueEmotionPrompt\(\)\{return'';/);
assert.match(source,/function adjMood\(\)\{return false;\}/,'numeric mood mutations must be inactive');
assert.match(source,/function traitDesc\(c\)\{return traitSpeechDesc\(c\);/,'only written speech/persona description may shape the role');
assert.match(source,/function rejectedCallPrompt/,'real rejection events must remain available');
assert.match(source,/不自动代表冷落、撒谎或感情变化/,'events must not force suspicion or emotion');
assert.match(source,/content=applyControlTags\(content,c,id,_statedPwd,_userText,_replyActionOutcome\)/,'permission-bound actions remain executable');
assert.match(source,/function roleCapabilityPrompt\(\)/,'the role still knows available capabilities');

console.log('retired numeric suspicion and mood controller tests passed');
