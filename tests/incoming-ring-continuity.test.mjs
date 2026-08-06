import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const ringtonePath = path.join(root, 'assets', 'incoming-soft-ring-v1.wav');
const ringtoneChoices = [
  ['soft', 'incoming-soft-ring-v1.wav'],
  ['morning', 'incoming-morning-chime-v1.wav'],
  ['night', 'incoming-warm-night-v1.wav'],
];

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('default bundled ringtone is an eight-second quiet seamless short chime', () => {
  const wav = fs.readFileSync(ringtonePath);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt16LE(22), 1, 'mono keeps mobile decoding simple');
  assert.equal(wav.readUInt32LE(24), 44100);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.toString('ascii', 36, 40), 'data');
  const dataBytes = wav.readUInt32LE(40);
  const frames = dataBytes / 2;
  assert.ok(Math.abs(frames / 44100 - 8) < 0.001);

  const samples = new Int16Array(frames);
  let peak = 0, energy = 0;
  for (let i = 0; i < frames; i++) {
    const value = wav.readInt16LE(44 + i * 2);
    samples[i] = value;
    peak = Math.max(peak, Math.abs(value));
    energy += value * value;
  }
  const peakRatio = peak / 32767;
  const rmsRatio = Math.sqrt(energy / frames) / 32767;
  assert.ok(peakRatio >= 0.20 && peakRatio <= 0.23, `comfortable peak expected, got ${peakRatio}`);
  assert.ok(rmsRatio >= 0.035 && rmsRatio <= 0.065, `comfortable short-chime RMS expected, got ${rmsRatio}`);

  const window = Math.round(44100 * 0.05);
  let activeWindows = 0, longestQuietRun = 0, quietRun = 0;
  for (let start = 0; start + window <= frames; start += window) {
    let sum = 0;
    for (let i = start; i < start + window; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / window) / 32767;
    if (rms > 0.006) { activeWindows++; quietRun = 0; }
    else { quietRun++; longestQuietRun = Math.max(longestQuietRun, quietRun); }
  }
  assert.ok(activeWindows >= 80, `short chime must remain present through most of the loop, got ${activeWindows} active windows`);
  assert.ok(longestQuietRun <= 8, `continuous repeat must not leave a long one-second gap, got ${longestQuietRun * 0.05}s`);
  assert.ok(Math.abs(samples[0] - samples[frames - 1]) / 32767 < 0.012, 'loop seam must stay below an audible click');
  assert.match(serviceWorker, /\.\/assets\/incoming-soft-ring-v1\.wav/,'the ringtone must be available offline');
});

test('all three selectable ringtones are bundled, distinct short chimes, and offline-ready', () => {
  const decoded = [];
  for (const [key, file] of ringtoneChoices) {
    const wav = fs.readFileSync(path.join(root, 'assets', file));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF', key);
    assert.equal(wav.readUInt16LE(22), 1, `${key} must be mono`);
    assert.equal(wav.readUInt32LE(24), 44100, `${key} must use the mobile-safe sample rate`);
    const frames = wav.readUInt32LE(40) / 2;
    assert.ok(Math.abs(frames / 44100 - 8) < 0.001, `${key} must be eight seconds`);
    const window = Math.round(44100 * 0.05);
    let activeWindows = 0, longestQuietRun = 0, quietRun = 0;
    const samples = [];
    for (let start = 0; start + window <= frames; start += window) {
      let sum = 0;
      for (let i = start; i < start + window; i++) {
        const sample = wav.readInt16LE(44 + i * 2);
        samples.push(sample);
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / window) / 32767;
      if (rms > 0.006) { activeWindows++; quietRun = 0; }
      else { quietRun++; longestQuietRun = Math.max(longestQuietRun, quietRun); }
    }
    assert.ok(activeWindows >= 75, `${key} must behave like a repeating chime rather than isolated beeps`);
    assert.ok(longestQuietRun <= 8, `${key} must not leave a long one-second gap`);
    decoded.push([key, samples]);
    assert.match(serviceWorker, new RegExp(`\\./assets/${file.replaceAll('.', '\\.')}`));
    assert.match(source, new RegExp(`url:'assets/${file.replaceAll('.', '\\.')}'`));
  }
  for (let i = 0; i < decoded.length; i++) for (let j = 0; j < i; j++) {
    const a = decoded[i][1], b = decoded[j][1];
    let dot = 0, aa = 0, bb = 0;
    for (let k = 0; k < a.length; k++) { dot += a[k] * b[k]; aa += a[k] * a[k]; bb += b[k] * b[k]; }
    const correlation = Math.abs(dot / Math.sqrt(aa * bb));
    assert.ok(correlation < 0.25, `${decoded[i][0]} and ${decoded[j][0]} must sound measurably distinct (${correlation})`);
  }
  assert.match(source, /label:'叮咚轻铃'/);
  assert.match(source, /label:'清脆双响'/);
  assert.match(source, /label:'木质叮咚'/);
  assert.match(source, /点一种会立即试听并自动保存/);
  assert.match(source, /function incomingRingSelect\(key\)/);
  assert.match(source, /function incomingRingPreview\(\)/);
});

test('incoming calls use an independent audio element and fall back to the same asset', () => {
  const vibrations = [];
  const created = [];
  const shared = media('shared');
  function media(name) {
    return {
      name, loop: false, currentTime: 5, volume: 0, src: '', pauseCalls: 0, playCalls: 0, reject: null,
      pause() { this.pauseCalls++; },
      play() { this.playCalls++; return { catch: fn => { this.reject = fn; } }; },
      setAttribute() {},
    };
  }
  class FakeAudio {
    constructor() { const value = media(`independent-${created.length}`); created.push(value); return value; }
  }
  const ctx = vm.createContext({
    S: { settings: { sound: true, incomingRing: 'morning' } },
    navigator: { vibrate: pattern => vibrations.push(pattern) },
    volMul: () => 1,
    Audio: FakeAudio,
    uiToneElement: () => shared,
    clearInterval() {}, clearTimeout() {},
  });
  vm.runInContext(`let _ring=null,_ringPreviewTimer=null,_ringMediaAudio=null;const INCOMING_RING_CHOICES=[{key:'soft',url:'assets/incoming-soft-ring-v1.wav'},{key:'morning',url:'assets/incoming-morning-chime-v1.wav'},{key:'night',url:'assets/incoming-warm-night-v1.wav'}];${functionSource('incomingRingKey')}${functionSource('incomingRingUrl')}${functionSource('ringToneElement')}${functionSource('ringAssetStart')}${functionSource('ringStop')}${functionSource('ringStart')}globalThis.api={start:ringStart,stop:ringStop,ring:()=>_ring};`, ctx);

  ctx.api.start();
  const primary = created[0];
  assert.equal(ctx.api.ring(), primary);
  assert.equal(primary.src, 'assets/incoming-morning-chime-v1.wav');
  assert.equal(primary.loop, true);
  assert.equal(primary.volume, 0.42);
  assert.equal(primary.playCalls, 1);
  assert.equal(shared.playCalls, 0);

  primary.reject();
  assert.equal(primary.pauseCalls, 1);
  assert.equal(ctx.api.ring(), shared);
  assert.equal(shared.src, 'assets/incoming-morning-chime-v1.wav');
  assert.equal(shared.loop, true);
  assert.equal(shared.playCalls, 1);

  ctx.api.stop();
  assert.equal(shared.pauseCalls, 2);
  assert.equal(shared.loop, false);
  assert.equal(shared.currentTime, 0);
  assert.deepEqual(Array.from(vibrations[1]), [400, 200, 400, 200, 400]);
  assert.equal(vibrations.at(-1), 0);
});

test('sound-off calls vibrate without creating or playing a ringtone element', () => {
  let audioCreated = 0, sharedRequested = 0;
  const ctx = vm.createContext({
    S: { settings: { sound: false } },
    navigator: { vibrate() {} },
    volMul: () => 1,
    Audio: class { constructor() { audioCreated++; } },
    uiToneElement() { sharedRequested++; return null; },
    clearInterval() {}, clearTimeout() {},
  });
  vm.runInContext(`let _ring=null,_ringPreviewTimer=null,_ringMediaAudio=null;const INCOMING_RING_CHOICES=[{key:'soft',url:'assets/incoming-soft-ring-v1.wav'}];${functionSource('incomingRingKey')}${functionSource('incomingRingUrl')}${functionSource('ringToneElement')}${functionSource('ringAssetStart')}${functionSource('ringStop')}${functionSource('ringStart')}globalThis.start=ringStart;`, ctx);
  ctx.start();
  assert.equal(audioCreated, 0);
  assert.equal(sharedRequested, 0);
});

test('the old sustained pure-tone ringtone cannot return through either route', () => {
  const ring = functionSource('ringStart') + functionSource('ringAssetStart');
  assert.doesNotMatch(ring, /playMediaTone|webToneSequence|createOscillator/);
  assert.doesNotMatch(ring, /880|1174|520|660|repeat=|setInterval/);
  assert.match(source, /incoming-soft-ring-v1\.wav/);
  assert.match(source, /incoming-morning-chime-v1\.wav/);
  assert.match(source, /incoming-warm-night-v1\.wav/);
});
