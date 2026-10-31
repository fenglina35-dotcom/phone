// VOICE_TAP_RETRY_V1：生成失败的空语音，点一下就重新生成。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import cp from 'node:child_process';

const PRIV = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read = (file) => process.env.FIX_TEST_OLD
  ? cp.execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8', maxBuffer: 64e6 })
  : fs.readFileSync(file, 'utf8');

function fnSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0, opened = false;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') { depth += 1; opened = true; }
    if (src[i] === '}') { depth -= 1; if (opened && depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unterminated ${name}`);
}

function page(src, message) {
  const spoken = [];
  const ctx = vm.createContext({
    S: { messages: { r1: [message] }, me: {} }, getC: () => ({ id: 'r1' }), setTimeout, Promise, Math,
    document: { querySelector: () => null }, speakMsg: (m) => spoken.push(m.id), voiceBarWant: () => {},
  });
  const live = src.includes('const _voiceWarmLive=new Set();') ? 'const _voiceWarmLive=new Set();' : '';
  vm.runInContext(live + fnSource(src, 'voiceTtsPending') + fnSource(src, 'playVoice') + ';this.play=playVoice;this.pending=voiceTtsPending;', ctx);
  return { ctx, spoken };
}

for (const [label, file] of [['web', 'app.js'], ['private', PRIV + 'app.js']]) {
  const src = read(file);

  test(label + ' a failed empty voice that was saved as "generating" regenerates when tapped', () => {
    // 存进聊天再读回来的样子：任务对象变成了 {}，生成中标记还在，没有音频
    const m = JSON.parse(JSON.stringify({ id: 'v1', role: 'assistant', type: 'voice', content: '你好', _ttsLoading: true, _ttsTask: {}, _ttsFailAt: Date.now() }));
    const { ctx, spoken } = page(src, m);
    assert.equal(ctx.pending(m), false, '读回来的旧标记不算正在生成');
    ctx.play('v1');
    assert.deepEqual(spoken, ['v1'], '点一下就去重新生成');
    assert.equal(m._ttsFailAt, undefined, '她亲手点，不用等失败冷却');
  });

  test(label + ' a voice that is really generating right now is not started twice', () => {
    const m = { id: 'v2', role: 'assistant', type: 'voice', content: '你好', _ttsTask: new Promise(() => {}) };
    const { ctx, spoken } = page(src, m);
    ctx.play('v2');
    assert.deepEqual(spoken, []);
  });
}

test('warm-up clears a stale task object and releases the loading mark when it returns early', () => {
  for (const file of ['app.js', PRIV + 'app.js']) {
    const src = read(file), warm = fnSource(src, 'warmVoiceMsg'), schedule = fnSource(src, 'scheduleVoiceWarm');
    assert.match(warm, /if\(m\._ttsTask instanceof Promise\)return m\._ttsTask;delete m\._ttsTask;/, file);
    assert.match(warm, /<15000&&[^{]*\)\{delete m\._ttsLoading;refreshVoiceBubble\(m\);return null;\}/, file);
    assert.match(schedule, /_voiceWarmLive\.add\(live\)/, file);
    assert.match(src, /if\(voiceTtsPending\(m\)\)\{toast\('这条语音还在生成，请稍等'\);return;\}/, file);
  }
});
