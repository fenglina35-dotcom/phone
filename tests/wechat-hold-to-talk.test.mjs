import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

assert.match(app,/onclick="chatVoiceToggle\(\)"/);
assert.match(app,/function chatVoiceButtonIcon\(\)/);
assert.match(app,/function chatVoiceToggle\(\)/);
assert.doesNotMatch(app.match(/function chatVoiceToggle\(\)[\s\S]*?function sendText/)?.[0]??'',/render\(\)/);
assert.match(app,/_voiceMode\?'输入文字，发送为语音条…':'发消息…'/);
assert.match(app,/>\$\{_voiceMode\?'发语音':'发送'\}<\/button>/);
assert.match(app,/let _voiceMode=false;let _panelPage='fn';let _chatFnPage=0;/);
assert.match(app,/if\(_voiceMode\)pushMsg\(id,\{role:'user',type:'voice',content:t,dur:Math\.max\(1,Math\.round\(t\.length\/3\)\),id:uid\(\),quote:q\}\);/);
assert.match(app,/else pushMsg\(id,\{role:'user',type:'text',content:t,quote:q\}\);/);
assert.doesNotMatch(app,/id="holdbtn"|class="holdtalk"|onpointerdown="recDown/);
assert.doesNotMatch(app,/function toggleChatVoiceMode\(|function finishChatRec\(|function recDown\(|function recUp\(/);
assert.doesNotMatch(html,/\.inputbar \.holdtalk|\.voice-toggle/);

console.log('wechat v600 text-to-voice input tests passed');
