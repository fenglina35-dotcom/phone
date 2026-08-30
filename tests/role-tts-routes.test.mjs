import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
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

assert.match(source, /角色使用的外置语音路线/);
assert.match(source, /跟随当前默认路线/);
assert.match(source, /ttsRouteVoices/);
assert.match(source, /ttsApiOn\(c\).*callPrefetchSpeech/);
assert.match(functionSource('ttsArr'), /const tts=ttsCfg\(o\)/);
assert.match(functionSource('ttsArr'), /const vid=ttsRoleVoiceId\(o,tts\)/);
assert.match(functionSource('warmVoiceMsg'), /ttsApiOn\(o\)/);
assert.match(functionSource('textToVoiceInfo'), /ttsCfg\(c\)/);

const context = vm.createContext({
  S: {
    settings: {
      ttsRouteActive: 0,
      tts: { provider: 'mossland', base: 'https://active.example/v1', key: 'active-key', model: 'moss-tts', voice: 'active-default', enabled: true, relay: false },
      ttsRoutes: [
        { provider: 'mossland', base: 'https://active.example/v1', key: 'active-key', model: 'moss-tts', voice: 'active-default' },
        { provider: 'fish', base: 'https://fish.example/v1', key: 'fish-key', model: 's2.1', voice: 'fish-default' },
        { provider: 'elevenlabs', base: 'https://eleven.example/v1', key: 'eleven-key', model: 'eleven-v3', voice: 'eleven-default' },
        {},
      ],
    },
  },
  TTS_ROUTE_NAMES: ['语音路线一', '语音路线二', '语音路线三', '语音路线四'],
  Number, String, Array, Object, Math,
});

for (const name of ['ttsRouteCopy', 'ttsRoutesInit', 'ttsRoleRouteOwnIndex', 'ttsRoleRouteIndex', 'ttsCfg', 'ttsExternalOn', 'ttsRelayOn', 'ttsEnabled', 'ttsApiOn', 'ttsUseRelay', 'getVoice', 'ttsRoleVoiceId']) {
  vm.runInContext(functionSource(name), context);
}

const legacyRole = { id: 'legacy', voice: { engine: 'api', ttsVoice: 'legacy-voice' } };
assert.equal(context.ttsRoleRouteOwnIndex(legacyRole), null);
assert.equal(context.ttsCfg(legacyRole).base, 'https://active.example/v1', 'roles without a route keep following the current global route');
assert.equal(context.ttsRoleVoiceId(legacyRole, context.ttsCfg(legacyRole)), 'legacy-voice', 'the pre-upgrade role voice remains valid');

const fishRole = { id: 'fish-role', voice: { engine: 'api', ttsRouteIndex: 1, ttsVoice: 'legacy-moss-id', ttsRouteVoices: { 1: 'fish-role-id', 2: 'eleven-role-id' } } };
assert.equal(context.ttsCfg(fishRole).provider, 'fish');
assert.equal(context.ttsCfg(fishRole).model, 's2.1');
assert.equal(context.ttsRoleVoiceId(fishRole, context.ttsCfg(fishRole)), 'fish-role-id');
assert.equal(context.ttsApiOn(fishRole), true);

fishRole.voice.ttsRouteIndex = 2;
assert.equal(context.ttsCfg(fishRole).provider, 'elevenlabs');
assert.equal(context.ttsRoleVoiceId(fishRole, context.ttsCfg(fishRole)), 'eleven-role-id', 'switching routes selects that route’s role-specific voice');

delete fishRole.voice.ttsRouteVoices[2];
assert.equal(context.ttsRoleVoiceId(fishRole, context.ttsCfg(fishRole)), 'eleven-default', 'an explicit route without a role voice uses its own route default, never a legacy ID from another provider');

const blankRole = { id: 'blank', voice: { engine: 'api', ttsRouteIndex: 3, ttsVoice: 'must-not-leak' } };
assert.equal(context.ttsApiOn(blankRole), false, 'an unconfigured explicit route must not silently fall back to the global provider');
assert.equal(context.ttsRoleVoiceId(blankRole, context.ttsCfg(blankRole)), '', 'an unconfigured route must not reuse another provider voice ID');

console.log('role tts routes: ok');
