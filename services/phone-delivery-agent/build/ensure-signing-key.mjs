import fs from 'node:fs/promises';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, '..', '..', '..');
const keyDirectory = path.join(path.dirname(repository), '.smallphone-release-keys');
const privatePath = path.join(keyDirectory, 'delivery-agent-ed25519-private.pem');
const publicPath = path.join(keyDirectory, 'delivery-agent-ed25519-public.pem');

await fs.mkdir(keyDirectory, { recursive: true });
try {
  await Promise.all([fs.access(privatePath), fs.access(publicPath)]);
} catch {
  const pair = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  await fs.writeFile(privatePath, pair.privateKey, { encoding: 'utf8', mode: 0o600 });
  await fs.writeFile(publicPath, pair.publicKey, { encoding: 'utf8', mode: 0o644 });
}

console.log(`签名密钥已就绪：${publicPath}`);
