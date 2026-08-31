import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bundled = fs.readFileSync(
  new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url),
  'utf8'
);

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') { depth += 1; opened = true; }
    if (source[index] === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('an unreadable account backup is shown as unknown instead of never uploaded', () => {
  for (const source of [app, bundled]) {
    const section = functionSource(source, 'privatePhoneAccountSection');
    assert.match(section, /backupLabel=a\.error\?'暂时无法确认'/);
    assert.match(section, /b\.found\?privatePhoneAccountBytes/);
    assert.match(section, /onclick="privatePhoneCloudBackup\(false\)">立即备份本机/);
  }
});

test('server push verification repaints the role feature page after success or failure', () => {
  for (const source of [app, bundled]) {
    const check = functionSource(source, 'roleServerPushCheckStatus');
    assert.match(check, /\['contact','contactInfo','roleFeatures'\]\.includes\(page\.p\)/);
    assert.match(check, /finally\{[^}]*roleFeatures[^}]*render\(\)/);
  }
});

test('the web runtime can back up its own data while private-managed cloud ids remain protected', () => {
  for (const source of [app, bundled]) {
    const modal = functionSource(source, 'cloudSyncModal');
    assert.match(modal, /privateMirrorPullNow\(\).*一键读取云端版本/);
    assert.match(modal, /网页版不会反向覆盖私人 App/);
    assert.match(modal, /cloudDoBackup\(\).*立即备份当前网页版/);
    assert.match(source, /当前云ID由私人版本主设备管理；网页仅作镜像，不能反向覆盖私人数据/);
  }
});
