import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const account = fs.readFileSync(new URL('../ai-account.js', import.meta.url), 'utf8');
const license = fs.readFileSync(new URL('../license-gate.js', import.meta.url), 'utf8');
const bridge = fs.readFileSync(
  new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift', import.meta.url),
  'utf8',
);

test('temporary refresh failures preserve the private phone Keychain session', () => {
  const refresh = bridge.slice(
    bridge.indexOf('private func validPrivateAccountSession()'),
    bridge.indexOf('private struct PrivateAccountHTTPResponse'),
  );
  assert.match(refresh, /云端暂时无法验证，手机号登录已保留/);
  assert.doesNotMatch(refresh, /deletePrivateAccountSession\(\)/);
  assert.match(bridge, /case "account\.signout"[\s\S]*?deletePrivateAccountSession\(\)/);
});

test('only explicit terminal license codes may clear a browser session', () => {
  assert.match(license, /const permanentCodes = new Set/);
  assert.match(license, /'license-admin-blocked'/);
  assert.doesNotMatch(license, /'license-session-invalid'/);
  assert.match(license, /out\.permanent = !!\(payload && payload\.permanent\) && permanentCodes\.has\(out\.code\)/);
  assert.match(app, /e&&e\.server&&e\.code==='license-admin-blocked'/);
  assert.doesNotMatch(app, /e&&e\.server&&e\.permanent===true/);
});

test('automatic authorization checks back off silently during an outage', () => {
  const check = app.slice(
    app.indexOf('let _licenseCheckBusy='),
    app.indexOf('async function licenseBindCurrent'),
  );
  assert.match(check, /_licenseCheckFailures/);
  assert.match(check, /_licenseCheckNextAt/);
  assert.match(check, /Math\.min\(30\*60000,60000\*Math\.pow\(2,_licenseCheckFailures-1\)\)/);
  assert.doesNotMatch(check, /toast\('授权检查暂时未连通/);
});

test('the last successful private voice list remains owned by the AI account page', () => {
  assert.match(account, /function aiCachedPrivateVoices/);
  assert.match(account, /function aiRememberPrivateVoices/);
  assert.match(account, /function aiCachedVoiceList/);
  assert.match(account, /云端暂时不可用，显示上次成功读取的音色/);
  assert.doesNotMatch(app, /typeof aiCachedVoiceList==='function'/);
  assert.match(app, /正在拉取外置账号音色/);
});
