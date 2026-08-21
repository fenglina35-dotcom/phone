import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const bundled = fs.readFileSync(path.join(root, 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'), 'utf8');

function functionSource(name, source = app) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} is not closed`);
}

test('call log participates in render scroll restoration', () => {
  assert.match(functionSource('renderScrollTarget'), /calllog:\['cllog',0\]/);
});

test('call log groups persist their expanded state across deletes and rerenders', () => {
  const render = functionSource('renderCallLog');
  assert.match(app, /let _clTab='all',_clOpen=\{\};/);
  assert.match(render, /data-cl-key="\$\{esc\(groupKey\)\}"/);
  assert.match(render, /_clOpen\[groupKey\]\?'open':''/);
  assert.match(render, /ontoggle="clToggle\(this\)"/);
  assert.match(functionSource('clToggle'), /_clOpen\[key\]=!!el\.open/);
});

test('call log mutations restore the old viewport after layout settles', () => {
  const keep = functionSource('clKeep');
  assert.match(keep, /details\[data-cl-key\]/);
  assert.match(keep, /requestAnimationFrame/);
  assert.match(keep, /bottom<80/);
  assert.match(keep, /scrollHeight-el\.clientHeight-bottom/);
});

test('private bundle receives the same call log state fix', () => {
  for (const name of ['renderScrollTarget', 'renderCallLog', 'clToggle', 'clKeep']) {
    assert.equal(functionSource(name, bundled).replace(/\r\n/g, '\n'), functionSource(name).replace(/\r\n/g, '\n'), `${name} must match the private bundle`);
  }
});
