import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const source = path.resolve(root, '..', 'phone-delivery-browser', 'src');
const destination = path.join(root, 'runtime');
const codeDestination = path.join(destination, 'code');
const files = ['adapter.mjs', 'security.mjs', 'taobao-flash-browser.mjs'];

await fs.rm(destination, { recursive: true, force: true });
await fs.mkdir(codeDestination, { recursive: true });
for (const file of files.filter((name) => name !== 'adapter.mjs')) {
  await fs.copyFile(path.join(source, file), path.join(codeDestination, file));
}
// Runtime code lives under app.asar.unpacked so a bare `qrcode` import cannot
// resolve packages stored inside app.asar. Bundle that dependency into the
// signed adapter while keeping the two updateable local modules external.
await build({
  entryPoints: [path.join(source, 'adapter.mjs')],
  outfile: path.join(codeDestination, 'adapter.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['./security.mjs', './taobao-flash-browser.mjs'],
  banner: {
    js: 'import { createRequire as __smallPhoneCreateRequire } from "node:module"; const require = __smallPhoneCreateRequire(import.meta.url);',
  },
  legalComments: 'inline',
  logLevel: 'silent',
});
await fs.writeFile(path.join(codeDestination, 'runtime-version.json'), `${JSON.stringify({ version: process.env.SMALL_PHONE_DELIVERY_RUNTIME_VERSION || '0.1.5', files }, null, 2)}\n`);
const webApp = await fs.readFile(path.resolve(root, '..', '..', 'app.js'), 'utf8');
const supabaseUrl = webApp.match(/const\s+COMPANION_URL='([^']+)'/)?.[1] || '';
const publishableKey = webApp.match(/const\s+COMPANION_KEY='([^']+)'/)?.[1] || '';
if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl) || publishableKey.length < 40) {
  throw new Error('没有从当前小手机网页读取到一致的公开伴生云配置');
}
let runtimeUpdatePublicKey = '';
try {
  runtimeUpdatePublicKey = await fs.readFile(path.resolve(root, '..', '..', '..', '.smallphone-release-keys', 'delivery-agent-ed25519-public.pem'), 'utf8');
} catch {}
await fs.writeFile(path.join(destination, 'public-config.json'), `${JSON.stringify({
  supabaseUrl,
  publishableKey,
  smallPhoneUrl: 'https://fenglina35-dotcom.github.io/phone/',
  runtimeManifestUrl: 'https://fenglina35-dotcom.github.io/phone/delivery-agent/runtime-manifest.json',
  runtimeUpdatePublicKey,
}, null, 2)}\n`);
await fs.copyFile(
  path.resolve(root, '..', '..', 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon 11024x1024.png'),
  path.join(destination, 'icon.png'),
);
