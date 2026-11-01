// VOICE_BAR_FOLLOWS_AUDIO_V1：语音条在声音放完之前一直动，放完才静止。
// 设 FIX_TEST_OLD=1 时读取 HEAD 里的旧代码，用来确认这些测试在修复前会失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read, fnSource, PRIV_DIR } from './_helpers.mjs';

const PRIV = PRIV_DIR;

function harness(src) {
  const bar = { classes: new Set() };
  bar.classList = { add: (c) => bar.classes.add(c), remove: (c) => bar.classes.delete(c), toggle: (c, on) => (on ? bar.classes.add(c) : bar.classes.delete(c)) };
  const audios = [];
  class FakeAudio {
    constructor(url) { this.url = url; this.handlers = {}; audios.push(this); }
    addEventListener(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
    emit(ev) { (this.handlers[ev] || []).forEach((fn) => fn()); }
    play() { return Promise.resolve(); }
    pause() { setTimeout(() => this.emit('pause'), 0); }
  }
  const timers = [];
  const ctx = vm.createContext({
    Audio: FakeAudio, VOICE_MAX_SECONDS: 60, Promise, String, Math,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: () => {},
    document: { querySelectorAll: (sel) => (sel === '[data-vid="v1"]' ? [bar] : []), querySelector: () => bar },
    _curAudio: null, _audio: null, volMul: () => 1, ensureAudio: () => {}, audioDataToBuf: async () => null, decodeBuf: async () => null, playBuf: async () => false,
  });
  const block = src.slice(src.indexOf('/* VOICE_BAR_FOLLOWS_AUDIO_V1'), src.indexOf('function playUrl('));
  vm.runInContext('var _curAudio=null;' + block + fnSource(src, 'playUrl') + ';this.want=voiceBarWant;this.play=playUrl;this.getCur=()=>_curAudio;', ctx);
  return { ctx, bar, audios, timers };
}

for (const [label, file] of [['web', 'app.js'], ['private', PRIV + 'app.js']]) {
  const src = read(file);

  test(label + ' the voice bar keeps moving until the audio really ends, however long it is', () => {
    assert.ok(src.includes('/* VOICE_BAR_FOLLOWS_AUDIO_V1'), '缺少 VOICE_BAR_FOLLOWS_AUDIO_V1');
    const { ctx, bar, audios, timers } = harness(src);
    ctx.want('v1');
    ctx.play('blob:voice');
    assert.equal(bar.classes.has('playing'), false, '声音还没开始，先不动');
    audios[0].emit('playing');
    assert.equal(bar.classes.has('playing'), true, '开始放就动');
    assert.ok(timers.every((t) => t.ms >= 60000), '没有按估算时长（9 秒）提前停的计时');
    audios[0].emit('ended');
    assert.equal(bar.classes.has('playing'), false, '放完才静止');
  });

  test(label + ' the voice bar stops on error, and when another sound replaces it', () => {
    const a = harness(src);
    a.ctx.want('v1'); a.ctx.play('blob:one'); a.audios[0].emit('playing');
    a.audios[0].emit('error');
    assert.equal(a.bar.classes.has('playing'), false);
    const b = harness(src);
    b.ctx.want('v1'); b.ctx.play('blob:one'); b.audios[0].emit('playing');
    b.ctx.play('blob:ding');
    assert.equal(b.bar.classes.has('playing'), false, '被别的声音顶掉就停');
  });

  test(label + ' no tap path stops the bar after a fixed estimated time any more', () => {
    assert.doesNotMatch(src, /classList\.add\('playing'\);\s*setTimeout\([^;]*Math\.min\(9000,\(m\.dur\|\|3\)\*1000/);
    assert.match(fnSource(src, 'playVoice'), /voiceBarWant\(mid\);/);
  });
}
