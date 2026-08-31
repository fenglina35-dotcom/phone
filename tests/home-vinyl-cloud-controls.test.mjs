import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const privateBundle = new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/', import.meta.url);
const read = (base, name) => readFile(new URL(name, base), 'utf8');

test('main-screen vinyl color is independent from the music app disc and remains optional', async () => {
  const [app, css] = await Promise.all([read(root, 'app.js'), read(root, 'glass-theme.css')]);
  assert.match(app, /function homeVinylCustomColor\(\).*homeVinylColor/);
  assert.match(app, /function homeVinylSurface\(\).*home-vinyl-custom/);
  assert.match(app, /主屏唱片颜色/);
  assert.match(app, /只改桌面外面的圆盘；不影响音乐 App 的唱片设置/);
  assert.match(app, /主屏唱片恢复跟随主题/);
  assert.match(app, /function homeVinylColorReset\(\).*delete S\.me\.homeVinylColor/);
  assert.match(css, /\.home-vinyl-card \.vinyl-record\.home-vinyl-custom\{[^}]*--home-vinyl-color[^}]*!important/);
  for (const line of app.match(/\[[^\n]*homeVinylColor[^\n]*\]/g) || []) assert.doesNotMatch(line, /musicDiscColor/);
});

test('main-screen vinyl color survives cleanup and beauty export/import', async () => {
  const app = await read(root, 'app.js');
  const hits = app.match(/homeVinylColor/g) || [];
  assert.ok(hits.length >= 10, `expected persistence coverage, got ${hits.length}`);
  assert.match(app, /\['widgets'[^\n]*'homeVinylColor'[^\n]*全部主屏\/微信外观/);
  assert.match(app, /me:pickObj\(me,\[[^\n]*'homeVinylColor'/);
  assert.match(app, /beautyAssign\(S\.me,pack\.me,\[[^\n]*'homeVinylColor'/);
});

test('cloud dialog identifies the runtime and restores the web immediate-backup action safely', async () => {
  const app = await read(root, 'app.js');
  assert.match(app, /mode=native\?'私人 App 主设备':'网页版云同步'/);
  assert.match(app, /native\?`<button[^`]*privateMirrorPublishNow[^`]*privatePhoneCloudRestoreOpen/);
  assert.match(app, /:`<button[^`]*cloudDoBackup\(\)[^`]*立即备份当前网页版[^`]*privateMirrorPullNow[^`]*privateMirrorRestoreRollback/);
  assert.match(app, /if\(current&&privateMirrorMeta\(current\.data,current\)\)throw new Error\('当前云ID由私人版本主设备管理；网页仅作镜像，不能反向覆盖私人数据'\)/);
  assert.match(app, /cloud-sync-auto-row[^\n]*overflow:hidden/);
  assert.match(app, /flex:1;min-width:0;overflow-wrap:anywhere/);
  assert.match(app, /class="sw \$\{S\.settings\.cloudAuto[^\n]*flex:0 0 44px/);
});

test('web and private bundle carry identical repaired code and styles', async () => {
  const [webApp, privateApp, webCss, privateCss] = await Promise.all([
    read(root, 'app.js'), read(privateBundle, 'app.js'), read(root, 'glass-theme.css'), read(privateBundle, 'glass-theme.css')
  ]);
  for(const marker of [
    'function homeVinylCustomColor()','function homeVinylSurface()',
    'function homeVinylColorReset()','function cloudSyncModal()',
    'function privateMirrorPublishNow()','function privateMirrorPullNow()',
  ]){
    assert.ok(webApp.includes(marker),`web marker missing: ${marker}`);
    assert.ok(privateApp.includes(marker),`private marker missing: ${marker}`);
  }
  assert.equal(privateCss, webCss);
});

test('private phone account keeps local login visible when only remote backup status fails', async () => {
  const [app, bridge] = await Promise.all([
    read(root, 'app.js'),
    read(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/', import.meta.url), 'PhoneNativeBridge.swift')
  ]);
  assert.match(app, /if\(_privatePhoneAccount\.loggedIn\)\{try\{const info=await privatePhoneAccountCall\('account\.backup\.info'\)/);
  assert.match(app, /_privatePhoneAccount\.backup=\{found:false,unknown:true\}/);
  assert.match(app, /手机号登录仍保留在本机/);
  assert.match(bridge, /request\.timeoutInterval = 18/);
  assert.match(bridge, /privateAccountFailureResult\(_ error: Error\)/);
  assert.match(bridge, /account_auth_timeout/);
  assert.match(bridge, /手机号登录凭证仍保留在本机/);
});
