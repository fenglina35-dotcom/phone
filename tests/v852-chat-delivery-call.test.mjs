import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

const pollStart=source.indexOf('let _pfIdleSyncs=0;'),pollEnd=source.indexOf("if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',()=>{if(!document.hidden)phoneFriendSyncActive();});",pollStart);
assert.ok(pollStart>=0&&pollEnd>pollStart,'friend polling helpers must exist');
const polling={cur:()=>({p:'pfchat'}),Math};vm.createContext(polling);
vm.runInContext(source.slice(pollStart,pollEnd)+';globalThis.delay=phoneFriendPollDelay;globalThis.active=phoneFriendSyncActive;globalThis.idle=n=>{_pfIdleSyncs=n;};',polling);
assert.equal(polling.delay(),2500,'active friend chats must start with the fast foreground polling window');
polling.idle(20);assert.equal(polling.delay(),8000,'idle chats retain the v1732 bounded backoff');polling.active();assert.equal(polling.delay(),2500,'new activity restores the fastest window');
assert.match(source, /setInterval\(\(\)=>\{if\(_appBootFinished\)phoneFriendMaybeSync\(false\);\},2500\)/, 'friend sync scheduler must reach the fast polling window only after startup restoration finishes');
assert.match(source, /_pfRenderQueued=true/, 'messages received while typing must request a later safe repaint');

const callStart = source.indexOf('let _callHF=false');
const callEnd = source.indexOf('function hfRestart()', callStart);
assert.ok(callStart >= 0 && callEnd > callStart, 'hands-free recognition block must exist');

const heard = [];
let sr;
const sandbox = {
  audioMicRouteCancel() {},
  makeSR() {
    sr = { start() {} };
    return sr;
  },
  toast() {},
  audioHardWake() {},
  audioRouteReset() {},
  render() {},
  updateCallSub() {},
  hfHeard(text) { heard.push(text); },
  callVideoCameraVerifyAfterSpeech() {},
  _call: { sub: null },
  _callBusy: false,
  _audioMicGranted: false,
  setTimeout,
  Date,
};
vm.runInNewContext(source.slice(callStart, callEnd) + ';globalThis.start=callHFStart;', sandbox);
sandbox.start();

function result(text, isFinal) {
  const row = [{ transcript: text }];
  row.isFinal = isFinal;
  return row;
}

sr.onresult({ resultIndex: 0, results: [result('我到了', true)] });
sr.onresult({ resultIndex: 0, results: [result('我到了', true)] });
assert.deepEqual(heard, ['我到了'], 'the same stale final result must be consumed only once');
sr.onresult({ resultIndex: 0, results: [result('我到了', false)] });
sr.onresult({ resultIndex: 0, results: [result('我到了', true)] });
assert.deepEqual(heard, ['我到了', '我到了'], 'a genuinely new utterance with a fresh interim result may repeat the same words');

assert.doesNotMatch(source, /这里只展示角色自己写下的想法，不包含心情值，也不会改变角色的选择。/, 'chat thought popup must not show system explanation text');
assert.match(source, /function showInnerThought\(id\)[\s\S]*?<h3>\$\{esc\(c\.remark\|\|c\.name\)\}<\/h3>/, 'thought popup should show the role name without a system mood label');

console.log('v852 chat delivery and call recognition tests passed');
