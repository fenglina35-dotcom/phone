import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// TTS_CALL_TIMEOUT_V1 (2026-10-30, her report: in a call one line sometimes waited minutes before the next): she uses Fish
// 会员登录 (fishmcp). Its requests had no time limit, and each line was tried up to three times (other providers waited up to
// 190 s per try). Each try now waits at most 60 s, three tries; she asked that audio is never silently dropped.
function fn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert(i >= 0, name);
  let d = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
for (const file of ['fish-mcp.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/fish-mcp.js']) {
  const s = fs.readFileSync(file, 'utf8');
  test(file + ': a Fish request that never answers is given up at the limit', async () => {
    const ctx = { AbortController, setTimeout, clearTimeout, fetch: (url, init) => new Promise((_, reject) => { init.signal.addEventListener('abort', () => reject(new Error('aborted'))); }) };
    vm.createContext(ctx); vm.runInContext('let _limitMs=60000;' + fn(s, 'fetchLimit'), ctx);
    const t0 = Date.now();
    await assert.rejects(ctx.fetchLimit('https://x', {}, 5000), /aborted/);
    const took = Date.now() - t0; assert(took >= 4900 && took < 7000, 'gave up after about 5 s, took ' + took);
    assert(!/await fetch\(MCP_VIA|await fetch\(AUDIO_VIA|else r=await fetch\(au\.url\)/.test(s), 'no unlimited fetch left in speak/rpc');
  });
}
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  test(file + ': each try waits at most 60 s, three tries', () => {
    assert(s.includes("if(!(+opt.timeoutMs>0))opt.timeoutMs=60000;") && s.includes("+opt.tries||3));"));
    assert(s.includes('timeoutMs:opt&&opt.timeoutMs});') && (s.match(/externalTtsRelay\(tts,\{[^}]*\}(?:\})?,opt&&opt\.timeoutMs\)/g) || []).length >= 5);
  });
}

// TTS_DOT_V1 (2026-10-30, her request): in phone/video calls and 共同生活 voice a small light right of the name blinks red
// while a line's voice is being made and stays green when it is ready. She did not want a text notice.
for (const file of ['app.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']) {
  const s = fs.readFileSync(file, 'utf8');
  test(file + ': the light is red while voice is being made in a call, green when done', async () => {
    const dots = [{ cls: new Set(), attrs: {}, classList: null, setAttribute(k, v) { this.attrs[k] = v; } }];
    dots[0].classList = { toggle: (c, on) => { on ? dots[0].cls.add(c) : dots[0].cls.delete(c); } };
    let release, seen = [];
    const ctx = { _call: { state: 'active' }, document: { querySelectorAll: () => dots }, toast() {}, setTimeout, VOICE_MAX_CHARS: 300 };
    vm.createContext(ctx);
    const i = s.indexOf('let _ttsPending=0;'), j = s.indexOf('async function ttsArr(text,o,opt){', i);
    vm.runInContext(s.slice(i, j).replace('let _ttsPending', 'var _ttsPending'), ctx);
    // wrap a fake slow voice step the same way ttsArr does
    ctx.slow = async () => { const live = ctx.ttsDotLive(); if (live) { ctx._ttsPending++; ctx.ttsDotSync(); } try { await new Promise(r => { release = r; }); } finally { if (live) { ctx._ttsPending = Math.max(0, ctx._ttsPending - 1); ctx.ttsDotSync(); } } };
    const p = ctx.slow(); seen.push(dots[0].cls.has('busy')); release(); await p; seen.push(dots[0].cls.has('busy'));
    assert.deepEqual(seen, [true, false]);
    assert.match(ctx.ttsDotHTML(), /class="tts-dot"/);
    assert(s.includes("async function ttsArr(text,o,opt){opt=Object.assign({},opt||{});text=ttsDropOffLanguage(text,o);const _dotLive=ttsDotLive();if(_dotLive){_ttsPending++;ttsDotSync();}try{"), 'ttsArr counts itself');
    assert(s.includes("finally{if(_dotLive){_ttsPending=Math.max(0,_ttsPending-1);ttsDotSync();}}}"));
    assert(s.includes("${esc(c.remark||c.name)}${typeof ttsDotHTML==='function'?ttsDotHTML():''}</div>"), 'shown next to the name in calls');
  });
}
for (const file of ['cohab-theater.js', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/cohab-theater.js'])
  test(file + ': 共同生活 voice shows the light next to the name', () => { assert(fs.readFileSync(file, 'utf8').includes("esc2(c.remark||c.name)+(typeof ttsDotHTML==='function'?ttsDotHTML():'')+'</b>")); });
for (const css of ['glass-theme.css', 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/glass-theme.css'])
  test(css + ': red blinking, green steady', () => { const c = fs.readFileSync(css, 'utf8'); assert(/\.tts-dot\{[^}]*background:#30d158/.test(c) && /\.tts-dot\.busy\{[^}]*background:#ff453a[^}]*animation:ttsDotBlink/.test(c)); });
