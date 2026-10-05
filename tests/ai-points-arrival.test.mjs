import assert from 'node:assert/strict';import fs from 'node:fs';
// Explicit retirement; do not reintroduce balance polling or purchase UI.
assert.equal(fs.existsSync(new URL('../ai-account.js',import.meta.url)),false);
assert.doesNotMatch(fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8'),/src="ai-account\.js/);
