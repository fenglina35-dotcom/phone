import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadPemBytes(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('function pemBytes(');
  const end = source.indexOf('\n}\n', start) + 3;
  const fn = source.slice(start, end).replace('pem: string', 'pem');
  const context = vm.createContext({ Uint8Array, TextDecoder, String, JSON, Error, atob });
  vm.runInContext(`${fn};globalThis.pemBytes=pemBytes`, context);
  return context.pemBytes;
}

const der = Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x00, 0x04, 0x01, 0x01]);
const base64 = Buffer.from(der).toString('base64');
const pem = `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;

for (const path of [
  '../supabase/functions/phone-role-push/index.ts',
  '../supabase/functions/phone-companion-push/index.ts',
]) {
  test(`${path} accepts escaped and base64-wrapped APNs p8 secrets`, () => {
    const decode = loadPemBytes(path);
    assert.deepEqual([...decode(JSON.stringify(pem))], [...der]);
    assert.deepEqual([...decode(Buffer.from(pem).toString('base64'))], [...der]);
  });
}
