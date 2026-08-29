import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repository = path.resolve(root, '..', '..');
const keyPath = path.join(path.dirname(repository), '.smallphone-release-keys', 'delivery-agent-ed25519-private.pem');
const codePath = path.join(root, 'runtime', 'code');
const releasePath = path.join(root, 'release');
const allowlist = ['adapter.mjs', 'security.mjs', 'taobao-flash-browser.mjs', 'runtime-version.json'];

const versionInfo = JSON.parse(await fs.readFile(path.join(codePath, 'runtime-version.json'), 'utf8'));
const version = String(versionInfo.version || '').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('runtime-version.json 版本号无效');

await fs.mkdir(releasePath, { recursive: true });
const archiveName = `small-phone-delivery-runtime-${version}.zip`;
const archivePath = path.join(releasePath, archiveName);
const zip = new AdmZip();
for (const file of allowlist) zip.addLocalFile(path.join(codePath, file), '', file);
zip.writeZip(archivePath);

const archive = await fs.readFile(archivePath);
const payload = {
  version,
  url: `https://fenglina35-dotcom.github.io/phone/delivery-agent/${archiveName}`,
  sha256: crypto.createHash('sha256').update(archive).digest('hex'),
  size: archive.length,
  createdAt: new Date().toISOString(),
};
const privateKey = await fs.readFile(keyPath, 'utf8');
const canonical = JSON.stringify(payload);
const signature = crypto.sign(null, Buffer.from(canonical), privateKey).toString('base64');
const manifest = { payload, signature, algorithm: 'Ed25519' };
await fs.writeFile(path.join(releasePath, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(releasePath, 'SHA256SUMS.txt'), `${payload.sha256}  ${archiveName}\n`);
console.log(`运行规则更新包已生成：${archivePath}`);
