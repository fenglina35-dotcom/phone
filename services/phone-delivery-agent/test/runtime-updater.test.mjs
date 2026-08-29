import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import AdmZip from 'adm-zip';
import { RuntimeUpdater, isNewerVersion } from '../src/runtime-updater.mjs';

const allowed = ['adapter.mjs', 'security.mjs', 'taobao-flash-browser.mjs'];

function response(bytes) {
  return new Response(bytes, { status: 200, headers: { 'content-length': String(Buffer.byteLength(bytes)) } });
}

function release(pair, version, extraEntry = null) {
  const zip = new AdmZip();
  for (const file of allowed) zip.addFile(file, Buffer.from(`// ${file} ${version}\n`));
  zip.addFile('runtime-version.json', Buffer.from(`${JSON.stringify({ version })}\n`));
  if (extraEntry) zip.addFile(extraEntry, Buffer.from('not allowed'));
  const archive = zip.toBuffer();
  const payload = {
    version,
    url: `https://updates.example/runtime-${version}.zip`,
    sha256: crypto.createHash('sha256').update(archive).digest('hex'),
    size: archive.length,
    createdAt: '2026-08-30T00:00:00.000Z',
  };
  return {
    archive,
    payload,
    manifest: {
      payload,
      signature: crypto.sign(null, Buffer.from(JSON.stringify(payload)), pair.privateKey).toString('base64'),
      algorithm: 'Ed25519',
    },
  };
}

async function runtime(version = '0.1.0') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'smallphone-runtime-'));
  await fs.mkdir(path.join(root, 'code'), { recursive: true });
  await fs.writeFile(path.join(root, 'code', 'runtime-version.json'), JSON.stringify({ version }));
  for (const file of allowed) await fs.writeFile(path.join(root, 'code', file), '// old\n');
  return root;
}

function updater(root, pair, item, archiveOverride = null) {
  const manifestUrl = 'https://updates.example/runtime-manifest.json';
  const fetcher = async url => {
    if (url === manifestUrl) return response(JSON.stringify(item.manifest));
    if (url === item.payload.url) return response(archiveOverride || item.archive);
    return new Response('missing', { status: 404 });
  };
  return new RuntimeUpdater({ runtimeRoot: root, manifestUrl, publicKey: pair.publicKey, fetcher });
}

test('version comparison is numeric and never downgrades', () => {
  assert.equal(isNewerVersion('0.2.0', '0.1.9'), true);
  assert.equal(isNewerVersion('0.1.0', '0.1.0'), false);
  assert.equal(isNewerVersion('0.0.9', '0.1.0'), false);
  assert.equal(isNewerVersion('latest', '0.1.0'), false);
});

test('a signed allowlisted runtime is installed atomically', async t => {
  const root = await runtime();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const pair = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const item = release(pair, '0.2.0');
  const result = await updater(root, pair, item).checkAndInstall();
  assert.equal(result.updated, true);
  const current = JSON.parse(await fs.readFile(path.join(root, 'code', 'runtime-version.json'), 'utf8'));
  const previous = JSON.parse(await fs.readFile(path.join(root, 'code.previous', 'runtime-version.json'), 'utf8'));
  assert.equal(current.version, '0.2.0');
  assert.equal(previous.version, '0.1.0');
});

test('tampering and unauthorized zip entries are rejected without replacing current runtime', async t => {
  const root = await runtime();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const pair = crypto.generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const valid = release(pair, '0.2.0');
  await assert.rejects(() => updater(root, pair, valid, Buffer.concat([valid.archive, Buffer.from('changed')])).checkAndInstall(), /大小校验失败|哈希校验失败/);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'code', 'runtime-version.json'), 'utf8')).version, '0.1.0');

  const malicious = release(pair, '0.2.0', 'evil.js');
  await assert.rejects(() => updater(root, pair, malicious).checkAndInstall(), /未授权文件/);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'code', 'runtime-version.json'), 'utf8')).version, '0.1.0');
});
