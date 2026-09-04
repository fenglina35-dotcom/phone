import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false,regex=false,regexClass=false,prev='';
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(regex){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='[')regexClass=true;else if(ch===']')regexClass=false;else if(ch==='/'&&!regexClass)regex=false;continue;}
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='/'&&source[i+1]!=='/'&&source[i+1]!=='*'&&/[=(,:;!&|?\[{]/.test(prev)){regex=true;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
    if(!/\s/.test(ch))prev=ch;
  }
  throw new Error(`unterminated ${name}`);
}

const mediaElement=functionSource('uiToneElement');
const ringElement=functionSource('ringToneElement');
const toneUrl=functionSource('uiToneUrl');
const webTone=functionSource('webToneSequence');
const mediaWake=functionSource('audioMediaWake');
const mediaTone=functionSource('playMediaTone');

assert.match(mediaElement,/_audioMediaPrimer/,'iOS UI sounds must reuse one persistent media element');
assert.match(ringElement,/_ringMediaAudio/,'incoming calls must own an independent persistent media element');
assert.match(ringElement,/new Audio\(\)/);
assert.match(mediaTone,/uiToneElement\(\)/);
assert.match(mediaTone,/a\.play\(\)/);
assert.match(mediaTone,/webToneSequence/,'Web Audio remains a fallback only');
assert.match(mediaWake,/uiToneElement\(\)/,'touch wake must prime the same element later used for UI sounds');
assert.doesNotMatch(mediaWake,/new Audio\(/,'touch wake must not unlock a disposable element on iOS');
assert.doesNotMatch(mediaWake,/removeAttribute\(['"]src/,'the primed iOS element must remain reusable');
assert.match(functionSource('playDing'),/playMediaTone/);
assert.match(functionSource('playDing'),/decay:true/,'message sound must use the original soft decaying envelope');
assert.match(toneUrl,/rate=44100/,'media tone should not use a harsh low sample rate');
assert.match(toneUrl,/Math\.exp/,'soft message tone must decay instead of sustaining at full amplitude');
assert.match(webTone,/if\(opt\.sustain\)g\.gain\.setValueAtTime\(level/,'continuous-ring fallback must hold its gain until the final fade');
assert.match(mediaWake,/callMediaElement\(\)/,'the same user touch must prime the dedicated iOS call media channel');
assert.match(functionSource('phSound'),/playMediaTone/);
const phoneSound=functionSource('phSound');
const incomingRing=functionSource('ringStart');
const outgoingCall=functionSource('placeCall');
assert.match(phoneSound,/call:\[\[880,\.22\]\]/,'dialing must use the same single-note family as a message chime');
assert.match(phoneSound,/decay:type==='call'/);
assert.doesNotMatch(phoneSound,/call:\[\[[^\]]+\],\[/,'dialing must not return to any alternating two-tone alarm pattern');
assert.match(functionSource('ringAssetStart'),/incomingRingUrl/,'incoming calls must resolve the saved ringtone choice');
assert.match(functionSource('ringAssetStart'),/a\.loop=true/);
assert.doesNotMatch(incomingRing+functionSource('ringAssetStart'),/playMediaTone|webToneSequence|880|1175|520|660/,'incoming calls must use only a bundled selectable ringtone asset');
assert.match(outgoingCall,/\[\[880,\.22\]\][\s\S]*outgoing-call-message-soft-v3[\s\S]*decay:true/,'role calls must use the same single-note soft family');

assert.doesNotMatch(source,/# 标点和口吻（必须遵守）/);
assert.equal(functionSource('cleanRolePunct'),"function cleanRolePunct(t){return String(t||'');}");

console.log('iOS UI audio and natural punctuation tests passed');
