import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const routingSource = app.match(/const PHONE_NON_WECHAT_TARGET=[\s\S]*?(?=\nfunction applyAuxTags)/)?.[0] || '';
const restoreAllSource = app.match(/function phoneInspectionRestoreAllPermissionsIntent\(text\)[\s\S]*?(?=\nfunction remoteControlIntentContext)/)?.[0] || '';

function routingHarness(wxLoginAuth) {
  const context = {
    S: { couple: { cid: 'role-1', wxLoginAuth } },
    _remoteIntentPurpose: {},
    _remoteIntentContext: {},
  };
  vm.runInNewContext(`${restoreAllSource}
${routingSource}
this.routePhoneInspectionTags = routePhoneInspectionTags;`, context);
  return context;
}

test('inspection tags preserve the role chosen entry point while recording remote purpose', () => {
  assert.match(app, /function phoneInspectionNonWechatIntent\(text\)/);
  assert.match(app, /function phoneInspectionWechatOnly\(text\)/);
  assert.match(app, /function phoneInspectionRestoreAllPermissionsIntent\(text\)/);
  assert.match(app, /function routePhoneInspectionTags\(content,c,requestText\)/);
  assert.match(app, /content=_wxLoginCompletion\?wxLoginCompletionVisibleContent\(content\):routePhoneInspectionTags\(content,c,_userText\)/);
  assert.match(app, /if\(!_wxLoginCompletion\)\{const _nativeInspectionQueued=maybeSpyIntent/);
  assert.match(app, /content=\(_videoVision\|\|_screenShareEvent\)\?content:routePhoneInspectionTags\(content,c,_luc&&msgToText\(_luc\)\)/);
  assert.match(app, /if\(hasRemote\)[\s\S]*?remember\(restoreAll\?'restore_all_permissions'/);
  assert.doesNotMatch(app, /入口分流是硬规则/);
});

test('routing behavior no longer rewrites a single entry tag chosen by the role', () => {
  const enabled = routingHarness(true);
  assert.match(enabled.routePhoneInspectionTags('我只看微信。\\n[申请远程操控]', { id: 'role-1' }, '你查一下微信'), /\[申请远程操控\]/);
  assert.match(enabled.routePhoneInspectionTags('我去看看。\\n[登录微信]', { id: 'role-1' }, '帮我查一下抖音私信'), /\[登录微信\]/);
  assert.match(enabled.routePhoneInspectionTags('我去查抖音。\\n[登录微信]', { id: 'role-1' }, '随便你'), /\[申请远程操控\]/);

  const disabled = routingHarness(false);
  const restore = disabled.routePhoneInspectionTags('我去看微信。\\n[登录微信]', { id: 'role-1' }, '你查一下微信');
  assert.match(restore, /\[登录微信\]/);
  assert.equal(disabled._remoteIntentPurpose['role-1'], undefined);
});

test('a disabled WeChat login permission is restored through a consented narrow remote session', () => {
  assert.match(app, /remember\(restoreAll\?'restore_all_permissions':\(onlyWx&&!\(S\.couple&&S\.couple\.cid===c\.id&&S\.couple\.wxLoginAuth\)\)\?'restore_wx':'inspect_phone'\)/);
  assert.match(app, /purpose==='restore_wx'/);
  assert.match(app, /targetId:'wxLoginAuth'/);
  assert.match(app, /resumeWx[\s\S]*?wxDoLogin\(c\.id\)/);
  const request = app.match(/function remoteControlRequest\(cid\)[\s\S]*?(?=\nfunction remoteControlDeny)/)?.[0] || '';
  assert.doesNotMatch(request, /remote-consent-copy|ta这次只会进入情侣空间/);
});

test('disabled couple permissions remain visible and can be re-enabled by the role', () => {
  assert.match(app, /function remoteControlCouplePermissions\(\)/);
  assert.match(app, /function remoteControlEnableCouplePermission\(key\)/);
  assert.match(app, /'enable_couple_permission'/);
  assert.match(app, /closedCouplePermissions/);
  assert.match(app, /app==='couple'[\s\S]*?couplescroll[\s\S]*?behavior:'smooth'/);
  assert.match(app, /remoteControlDesktopKey\(app\)[\s\S]*?couple:'wechat'/);
});

test('turning off the remote-request switch does not bypass per-session consent', () => {
  assert.match(app, /function remoteControlAllowed\(cid\)\{return !!\(S\.couple&&S\.couple\.cid===cid\);\}/);
  assert.match(app, /remoteControlRequest\(cid\)[\s\S]*?_remoteRequest=\{cid,ts:Date\.now\(\),purpose,intentContext\}/);
  assert.match(app, /remoteControlApprove\('\$\{c\.id\}'\)/);
  assert.match(app, /remoteControlDeny\('\$\{c\.id\}'\)/);
});
