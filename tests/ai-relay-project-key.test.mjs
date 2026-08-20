import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('phone-ai relay uses the public key belonging to its selected Supabase project', () => {
  const context = vm.createContext({
    String, URL,
    LICENSE_FAILOVER_URL: 'https://new-project.supabase.co',
    LICENSE_FAILOVER_KEY: 'new-public-key',
    GATE_KEY: 'old-public-key',
    aiCoreUrl: () => 'https://new-project.supabase.co/functions/v1/phone-ai',
  });
  vm.runInContext(functionSource('aiCoreKey'), context);
  assert.equal(context.aiCoreKey('https://new-project.supabase.co/functions/v1/phone-ai'), 'new-public-key');
  assert.equal(context.aiCoreKey('https://old-project.supabase.co/functions/v1/phone-ai'), 'old-public-key');
  const relay = source.slice(source.indexOf('async function aiRelay'), source.indexOf('function joinAIContinuation'));
  assert.match(relay, /relayKey=aiCoreKey\(url\)/);
  assert.match(relay, /'apikey':relayKey,'Authorization':'Bearer '\+relayKey/);
  assert.doesNotMatch(relay, /'apikey':GATE_KEY|'Authorization':'Bearer '\+GATE_KEY/);
});
