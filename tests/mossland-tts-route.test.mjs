import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'supabase/functions/phone-ai/index.ts'), 'utf8');
const relay = fs.readFileSync(path.join(root, 'services/phone-license-relay/worker.mjs'), 'utf8');

assert.match(app, /const TTS_ROUTE_NAMES=\['语音路线一','语音路线二','语音路线三','语音路线四'\]/);
assert.match(app, /function ttsRoutesInit\(\)/);
assert.match(app, /function ttsRouteSwitch\(i\)/);
assert.match(app, /data-tts-route=/);
assert.match(app, /ttsRoutes:\[\],ttsRouteActive:0/);
assert.match(app, /\['https:\/\/api\.mosi\.cn\/v1','moss-tts','Mossland','mossland'\]/);
assert.match(app, /provider==='mossland'/);
assert.match(app, /provider==='mossland'[\s\S]*?externalTtsRelay\(tts,\{voice_id:vid,text:t\}\)/);
assert.match(relay, /delivery_method:'audio'/);
assert.match(app, /operation:'list_voices'/);

assert.match(backend, /function mosslandApiBase\(/);
assert.match(backend, /hostname\.toLowerCase\(\) !== "api\.mosi\.cn"/);
assert.match(backend, /async function externalMosslandTTS\(/);
assert.match(backend, /async function externalMosslandVoices\(/);
assert.match(backend, /base \+ "\/audio\/speech"/);
assert.match(backend, /base \+ "\/audio\/voices\?limit=200"/);
assert.match(backend, /delivery_method: "audio"/);
assert.match(backend, /provider === "mossland"/);
assert.match(relay, /https:\/\/api\.mosi\.cn\/v1\/audio\/speech/);

console.log('mossland tts routes: ok');
