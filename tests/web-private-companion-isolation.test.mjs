import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('companion entries require an installed public adapter or private runtime', () => {
  assert.match(app, /function privateCompanionAppOn\(\)\{return privateNativeAppOn\(\);\}/);
  assert.match(app, /privateCompanion=companionFeatureAvailable\(\);if\(!privateCompanion&&_couTab===3\)_couTab=1/);
  assert.match(app, /\$\{privateCompanion\?`<button class="minibtn" id="coutab3"/);
  assert.match(app, /\$\{privateCompanion\?`<div id="coupage3"/);
  assert.match(app, /filter\(x=>companionFeatureAvailable\(\)\|\|!\/coupleJump\\\(3,/);
});

test('companion settings are gated by supported runtime capability', () => {
  assert.match(app, /\$\{companionFeatureAvailable\(\)\?`<div class="it"><span>关闭小手机后仍可主动联系/);
  assert.match(app, /知道我正在用哪个软件/);
  assert.match(app, /每天最多查看软件次数/);
});

test('shared timers and stale web data cannot call the private companion cloud', () => {
  assert.match(app, /async function companionRpc\(name,args\)\{if\(!companionFeatureAvailable\(\)\)throw new Error\('伴生云只在私人小手机 App 内可用'\)/);
  assert.match(app, /companionPollSnapshot=async function\(force\)\{if\(!companionFeatureAvailable\(\)\)return false/);
  assert.match(app, /companionNotifyNative=async function\(commandId\)\{if\(!companionFeatureAvailable\(\)\)return \{pushed:false,reason:'private-app-only'\}/);
  assert.match(app, /roleBackgroundEnqueue=async function\(\.\.\.args\)\{if\(!companionFeatureAvailable\(\)\)return null/);
  assert.match(app, /roleBackgroundDispatchNow=async function\(\.\.\.args\)\{if\(!companionFeatureAvailable\(\)\)return false;return roleBackgroundDispatchNowPrivateCore\(\.\.\.args\)/);
  assert.match(app, /roleServerPushPull=async function\(force\)\{if\(!companionFeatureAvailable\(\)\)return false/);
});

test('role prompts and action tags cannot leak private-device facts into web replies', () => {
  assert.match(app, /companionRolePrompt=function\(c,opt\)\{return companionFeatureAvailable\(\)\?companionRolePromptPrivateCore\(c,opt\):'';\}/);
  assert.match(app, /companionAmbientContext=function\(c,now\)\{return companionFeatureAvailable\(\)\?companionAmbientContextPrivateCore\(c,now\):'';\}/);
  assert.match(app, /companionApplyReadTags=function\(content,c\)\{return companionFeatureAvailable\(\)\?companionApplyReadTagsPrivateCore\(content,c\):\{content:String\(content\|\|''\),changed:false\};\}/);
});
