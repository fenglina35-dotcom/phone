import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('app.js');
const backend=read('supabase/functions/phone-ai/index.ts');
const html=read('小手机.html');
const sw=read('sw.js');
const privateManifest=read('native/private-small-phone/Resources/private-phone-web.manifest.json');


assert.doesNotMatch(sw,/pay-assets/);
assert.doesNotMatch(privateManifest,/pay-assets/);
assert.equal(fs.existsSync(path.join(root,'pay-assets')),false,'public payment QR directory must be removed');

assert.match(backend,/plans: \[\]/);
assert.doesNotMatch(backend,/const PLANS\s*=/);
assert.match(backend,/if \(action === "purchase_create"\) \{\s*return json\(\{ ok: false, error: "purchase-channel-closed" \}, 410\);\s*\}/);
assert.match(backend,/if \(action === "purchase_submit"\) \{\s*return json\(\{ ok: false, error: "purchase-channel-closed" \}, 410\);\s*\}/);
assert.match(backend,/purchases: purchases \|\| \[\]/);


const frontVersion=app.match(/APP_VER='v(\d+)\b/)?.[1];
assert.ok(frontVersion,'frontend version should be numeric');
assert.match(html,new RegExp(`photo-album\\.js\\?v=${frontVersion}\\b`));
assert.match(sw,new RegExp(`north-shell-v${frontVersion}\\b`));

console.log('AI purchase retirement tests passed');
