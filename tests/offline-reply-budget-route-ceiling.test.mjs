import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const start = source.indexOf('function offlineReplyBudget(input,c)');
const end = source.indexOf('\n', start);
assert.ok(start >= 0, 'offlineReplyBudget must exist with its route-aware signature');

const sandbox = {
  chatMainCopy(x) { return { maxTokens: x && x.maxTokens != null ? x.maxTokens : 900 }; },
  chatRequestRoute(index) { return sandbox.__route; },
  roleChatRouteIndex(c) { return c ? 0 : null; },
  S: { settings: { chat: {} } },
};
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end) + ';globalThis.budget=offlineReplyBudget;', sandbox);

// No contact: falls back to the built-in short/medium/long floor.
assert.equal(sandbox.budget('短'), 600);
assert.equal(sandbox.budget('a'.repeat(200)), 650);
assert.equal(sandbox.budget('a'.repeat(600)), 700);

// Contact present, route uses the default 900 maxTokens: raises the floor to 900.
sandbox.__route = null;
assert.equal(sandbox.budget('短', { id: 'c1' }), 900, 'default route maxTokens (900) must raise the short-message floor');

// Contact present, user has configured a higher reply length on their route:
// that configured ceiling must take effect instead of the built-in floor.
sandbox.__route = { maxTokens: 40000 };
assert.equal(sandbox.budget('短', { id: 'c1' }), 40000, 'a user-configured route maxTokens must be honored as the ceiling');

// A configured value below the built-in floor must never shrink it.
sandbox.__route = { maxTokens: 200 };
assert.equal(sandbox.budget('a'.repeat(600), { id: 'c1' }), 700, 'a low route maxTokens must not shrink the long-message floor');

console.log('offline reply budget route ceiling tests passed');
