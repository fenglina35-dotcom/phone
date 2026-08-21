import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const bundled = fs.readFileSync(path.join(root, 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'), 'utf8');

function functionSource(name, text = source) {
  const start = text.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = text.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

test('transfer-to-self uses an in-app form instead of unsupported WKWebView prompt dialogs', () => {
  const open = functionSource('spyWxTransferOpen');
  assert.doesNotMatch(open, /\bprompt\s*\(/);
  assert.match(open, /openModal\(/);
  assert.match(open, /spyWxTransferAmount/);
  assert.match(open, /spyWxTransferSubmit/);
});

test('the in-app transfer form validates and submits its amount and note', () => {
  const calls = [];
  const fields = {
    '#spyWxTransferAmount': { value: '88.50' },
    '#spyWxTransferNote': { value: '今晚的零花钱' },
  };
  const context = vm.createContext({
    $: (id) => fields[id] || null,
    closeModal: () => calls.push(['close']),
    spyWxTransferDo: (...args) => calls.push(['transfer', ...args]),
    toast: (message) => calls.push(['toast', message]),
  });
  vm.runInContext(`${functionSource('spyWxTransferSubmit')}this.submit=spyWxTransferSubmit;`, context);
  assert.equal(context.submit('role.1'), true);
  assert.deepEqual(calls, [['close'], ['transfer', 'role.1', 88.5, '今晚的零花钱']]);
  fields['#spyWxTransferAmount'].value = '0';
  assert.equal(context.submit('role.1'), false);
  assert.deepEqual(calls.at(-1), ['toast', '金额不对']);
});

test('transfer functions stay synchronized in the private app bundle', () => {
  const normalized = (value) => value.replace(/\r\n/g, '\n');
  for (const name of ['spyWxTransferOpen', 'spyWxTransferSubmit', 'spyWxTransferDo']) {
    assert.equal(normalized(functionSource(name, bundled)), normalized(functionSource(name)));
  }
});
