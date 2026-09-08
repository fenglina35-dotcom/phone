import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, 'app.js'), 'utf8');
const glass = readFileSync(join(root, 'glass-theme.css'), 'utf8');

function functionSource(name) {
  const marker = 'function ' + name + '(';
  const start = app.indexOf(marker);
  assert.notEqual(start, -1, name + ' should exist');
  const end = app.indexOf('\n', start);
  return app.slice(start, end === -1 ? app.length : end);
}

test('visible role text is recovered from common JSON and fenced envelopes', () => {
  const context = vm.createContext({});
  vm.runInContext(functionSource('roleVisibleEnvelopeText') + ';this.unwrap=roleVisibleEnvelopeText', context);
  const fence = String.fromCharCode(96).repeat(3);
  assert.equal(
    context.unwrap(fence + 'json\n{"choices":[{"message":{"content":"【他走近】\\n我在。"}}]}\n' + fence),
    '【他走近】\n我在。',
  );
  assert.equal(
    context.unwrap('{"output":[{"content":[{"type":"output_text","text":"别躲，我看见你了。"}]}]}'),
    '别躲，我看见你了。',
  );
  assert.equal(context.unwrap(fence + 'text\n只是普通正文\n' + fence), '只是普通正文');
});

test('format-only role replies use the short repair path while unsafe drift stays blocked', () => {
  const context = vm.createContext({
    isRefusal: text => /作为AI|不能继续/.test(String(text)),
    splitBubbles: text => String(text || '').split(/\n+/).filter(Boolean),
    isOOCLine: line => /系统说明|作为AI/.test(String(line)),
    offResponseParts: text => /【[^】]+】/.test(String(text))
      ? [{ kind: 'nar', text: '动作' }, { kind: 'talk', text: '台词' }]
      : [{ kind: 'talk', text: String(text) }],
    S: { me: { name: '我' } },
  });
  vm.runInContext([
    functionSource('roleVisibleEnvelopeText'),
    functionSource('offlineUnsafeRoleDrift'),
    functionSource('offlineRoleDrift'),
    functionSource('offlineRepairNote'),
    functionSource('offlineSimpleFormatNote'),
    functionSource('offlineRoleRepairPrompt'),
    'this.unsafe=offlineUnsafeRoleDrift;this.drift=offlineRoleDrift;this.repair=offlineRoleRepairPrompt;',
  ].join('\n'), context);
  const role = { name: '阿屿' };
  assert.equal(context.unsafe('我在，慢慢说。'), false);
  assert.equal(context.drift('我在，慢慢说。'), true);
  assert.match(context.repair(role, '我在，慢慢说。'), /只输出两类正文/);
  assert.equal(context.unsafe('作为AI，我不能继续。'), true);
  assert.match(context.repair(role, '作为AI，我不能继续。'), /上一版完全作废/);
  assert.match(app, /offlineRoleRepairPrompt\(c,r\)/);
  assert.match(app, /offlineRoleDrift\(r\)&&offlineUnsafeRoleDrift\(r\)/);
  assert.match(functionSource('offReplyItems'), /roleVisibleEnvelopeText\(text\)/);
  assert.match(functionSource('replyNoVisibleReasonFromContent'), /roleVisibleEnvelopeText\(content\)/);
});

test('public adapter controls access while private cache stays separated', () => {
  const state = {
    roleAccess: true,
    readScope: 'external',
    permissions: { screenTime: true },
  };
  const context = vm.createContext({
    S: { couple: { cid: 'role' } },
    privateNativeAppOn: () => false,
    companionState: () => state,
    companionLocalNativeAvailable: () => false,
    rolePhoneInspectionLaneActive: () => false,
  });
  vm.runInContext(functionSource('companionRoleReadsExternal') + ';this.reads=companionRoleReadsExternal', context);
  assert.equal(context.reads({ id: 'role' }, 'screenTime'), false);
  context.privateNativeAppOn = () => true;
  assert.equal(context.reads({ id: 'role' }, 'screenTime'), true);

  assert.match(functionSource('companionRoleDataState'), /privateNativeAppOn\(\)&&rolePhoneInspectionLaneActive\(\)/);
  assert.match(functionSource('companionRoleExternalFocus'), /if\(!privateNativeAppOn\(\)\)return false/);
  assert.match(functionSource('cohabPhoneTargets'), /st=privateNativeAppOn\(\)&&S\.couple/);
  assert.match(functionSource('cohabPhonePrompt'), /当前环境没有真实 iPhone 伴生读取能力/);
  assert.match(app, /if\(_main&&companionFeatureAvailable\(\)\)\{const companionPrompt=companionRolePrompt\(c,opt\)/);
  assert.match(app, /companionRolePrompt=function\(c,opt\)\{return companionFeatureAvailable\(\)\?companionRolePromptPrivateCore\(c,opt\):'';\}/);
  assert.match(functionSource('initiativeQueueNote'), /ambient=privateNativeAppOn\(\)\?companionAmbientContext/);
  assert.match(functionSource('initiativeGroundingContext'), /ambient=privateNativeAppOn\(\)\?companionAmbientContext/);
  assert.match(app, /你给ta定的每日使用时长 & 今日已用/);
  assert.match(app, /S\.couple\.timeLimit/);
});

test('native no-backdrop fallback restores opaque-enough page-two cards in every palette', () => {
  assert.match(glass, /north-native-app\.north-glass-ui \.glass-second-portrait,[\s\S]*?background-color:rgba\(18,19,23,\.62\)!important/);
  assert.match(glass, /north-native-app\.north-glass-ui\.north-pack-pink \.glass-second-portrait,[\s\S]*?rgba\(244,181,208,\.55\)/);
  assert.match(glass, /north-native-app\.north-glass-ui\.north-pack-blue \.glass-second-portrait,[\s\S]*?rgba\(169,205,244,\.52\)/);
  assert.match(glass, /north-native-app\.north-glass-ui\.north-pack-gray \.glass-second-portrait,[\s\S]*?rgba\(228,232,239,\.56\)/);
  assert.match(glass, /home\.glass-widget-custom \.glass-second-portrait,[\s\S]*?rgba\(var\(--ng-widget-rgb\),var\(--ng-widget-alpha\)\)/);
  assert.match(glass, /glass-second-portrait-copy\{background-color:rgba\(5,6,8,\.7\)!important\}/);
  assert.doesNotMatch(glass, /html\.north-glass-ui \.glass-second-portrait\{[^}]*background-color:rgba\(18,19,23,\.62\)/);
});
