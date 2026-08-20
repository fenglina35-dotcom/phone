import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; opened = true; }
    if (app[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('an explicitly selected font color is not replaced on a custom gray bubble', () => {
  const source = [
    functionSource('bubbleSolid'),
    functionSource('bubbleReadableText'),
  ].join('\n');
  const readable = Function('contrastRatio', `${source};return bubbleReadableText;`)(() => 1);
  assert.equal(readable('#b9bdc6', '#f15bb5', '#111111'), '#f15bb5');
  assert.equal(readable('#b9bdc6', '#ffffff', '#111111'), '#ffffff');
});

test('web and private-App bubble renderers stay aligned', () => {
  const bundled = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'PhoneWeb.bundle', 'app.js'), 'utf8');
  assert.ok(bundled.includes(functionSource('bubbleReadableText')));
});
