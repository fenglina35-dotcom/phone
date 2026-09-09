import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPrivatePhoneWebTransforms } from './private-phone-web-transform.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const privateRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(privateRoot, '..', '..');
const manifestPath = path.join(
  privateRoot,
  'Resources',
  'private-phone-web.manifest.json'
);
const outputRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(
      privateRoot,
      'XcodeProject',
      'PhoneCompanionTest',
      'PhoneWeb.bundle'
    );

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const entries = [
  ...(manifest.files ?? []),
  ...(manifest.directories ?? [])
];

if (!entries.includes(manifest.entry)) {
  throw new Error('manifest entry must be included in files');
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const relative of entries) {
  if (path.isAbsolute(relative) || relative.includes('..')) {
    throw new Error(`unsafe manifest path: ${relative}`);
  }
  const source = path.join(repoRoot, relative);
  const destination = path.join(outputRoot, relative);
  const sourceStat = await stat(source);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, {
    recursive: sourceStat.isDirectory(),
    force: true
  });
}

const bundledEntry = path.join(outputRoot, manifest.entry);
await applyPrivatePhoneWebTransforms(outputRoot, manifest.entry);

// Keep every private-only smart-home overlay in a clean staged bundle.
const privateWebRoot = path.join(privateRoot, 'Resources', 'Web');
for (const item of await readdir(privateWebRoot, { withFileTypes: true })) {
  if (!item.isFile()) continue;
  await cp(
    path.join(privateWebRoot, item.name),
    path.join(outputRoot, item.name),
    { force: true }
  );
}

// WKWebView uses an ASCII entry name so the main resource and its allowed
// read directory are always resolved from exactly the same bundle path.
await cp(
  bundledEntry,
  path.join(outputRoot, 'index.html'),
  { force: true }
);

await cp(
  path.join(privateRoot, 'Resources', 'PhoneWebBundleInfo.plist'),
  path.join(outputRoot, 'Info.plist'),
  { force: true }
);

process.stdout.write(
  `Staged ${entries.length} shared entries to ${outputRoot}\n`
);
