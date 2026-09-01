import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const bundled = fs.readFileSync(path.join(root, 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'), 'utf8');

function functionSource(name, source = app) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} is not closed`);
}

function normalized(value) {
  return value.replace(/\r\n/g, '\n');
}

test('ordinary online chat keeps the real iPhone control protocol and exact all-app action', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    function companionReady(st){return !!(st && st.linked);}
    ${functionSource('companionRoleControlOnlyPrompt')}
    this.prompt=companionRoleControlOnlyPrompt;
  `, context);
  const prompt = context.prompt({ name: '角色' }, {
    linked: true,
    permissions: { appControl: true, limits: true },
    apps: [{ name: '微信' }, { name: '抖音' }],
  });
  assert.match(prompt, /当前按稳定 ID 可控制的 App：微信、抖音/);
  assert.match(prompt, /\[锁定\|全部内外 App\|内外同时\]/);
  assert.match(prompt, /小手机中已经授权给你的全部内置 App/);
  assert.match(prompt, /真实 iPhone 当前全部已选 App/);
  assert.match(prompt, /设备回执和新快照确认前绝不能谎称已经锁好/);
  assert.match(prompt, /不能把它缩成仅内置或仅外置/);
  assert.match(app, /if\(!inspection\)return companionRoleControlOnlyPrompt\(c,config\)/);
  assert.match(app, /companionRolePrompt=function\(c,opt\)\{return privateCompanionAppOn\(\)\?companionRolePromptPrivateCore\(c,opt\):'';\}/);
});

test('a definite natural claim to lock every app is recovered without depending on a model parser', () => {
  const sent = [];
  const context = vm.createContext({ sent });
  vm.runInContext(`
    const state={linked:true,roleAccess:true,permissions:{appControl:true},apps:[{id:'a'},{id:'b'}]};
    function companionState(){return state;}
    function companionReady(st){return !!st.linked;}
    function companionDispatchRoleAll(action,opt){sent.push({action,actor:opt.actor});return true;}
    ${functionSource('companionAllControlClauseAction')}
    ${functionSource('companionNaturalAllControlAction')}
    ${functionSource('companionRecoverNaturalAllControl')}
    this.detect=companionNaturalAllControlAction;
    this.recover=companionRecoverNaturalAllControl;
  `, context);
  assert.equal(context.detect('我已经把你的所有软件都锁上了。'), 'lock');
  assert.equal(context.detect('全部 App 都给你解开了。'), 'unlock');
  assert.equal(context.detect('再不听话我就把所有软件锁了。'), '');
  assert.equal(context.detect('要不要把全部软件锁掉？'), '');
  assert.equal(context.detect('全部锁定。'), 'lock');
  assert.equal(context.detect('全部解锁。'), 'unlock');
  assert.equal(context.detect('一键全锁。'), 'lock');
  assert.equal(context.detect('一键全解。'), 'unlock');
  assert.equal(context.detect('解除全锁。'), 'unlock');
  assert.equal(context.detect('解除全部软件锁定。'), 'unlock');
  assert.equal(context.detect('取消所有应用的锁定。'), 'unlock');
  assert.equal(context.detect('我把你的软件全部锁掉了。'), 'lock');
  assert.equal(context.detect('我还没把所有软件锁掉。'), '');
  assert.equal(context.detect('不解开全部，只解开三个。'), '');
  assert.equal(context.detect('“乖一天”换不回全部。选三个，今晚给你解开三个。'), '');
  assert.equal(context.detect('All of them.\n（全部。）\nBut "good for one day" does not earn back everything.\n（但“乖了一天”换不回全部。）\nPick three. I will unlock three for you tonight.\n（选三个。今晚给你解开三个。）'), '');
  assert.equal(context.detect('我不会全部解开，只给你解开三个。'), '');
  assert.equal(context.detect('全部不解开。'), '');
  assert.equal(context.recover('我把你的软件全部锁掉了。', { name: '北', remark: '先生' }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [{ action: 'lock', actor: '先生' }]);
});

test('all-app companion commands dispatch every selected real iPhone app and every authorized internal app', () => {
  const external = [];
  const internal = [];
  const context = vm.createContext({ external, internal });
  vm.runInContext(`
    const st={
      defaultScope:'both',
      linked:true,
      roleAccess:true,
      permissions:{appControl:true},
      apps:[{id:'real.wechat',name:'微信'},{id:'real.video',name:'视频'}],
      bindings:[{externalAppId:'real.wechat',internalAppId:'wechat'}]
    };
    const S={couple:{grant:{wechat:true}}};
    const LOCKABLE={wechat:'微信'};
    function companionState(){return st;}
    function companionReady(value){return !!(value&&value.linked);}
    function companionScopeForAction(){return 'appControl';}
    function companionScope(value){return ['internal','external','both'].includes(value)?value:'';}
    function companionUnifiedLimitInternalIds(){return [];}
    function companionBindingMirrorsLock(){return true;}
    function companionDispatchRoleExternal(action,app,opt){external.push({action,id:app.id,actor:opt.actor});return {ok:true};}
    function companionDispatchBound(action,id,opt){internal.push({action,id,scope:opt.scope});return {ok:true};}
    function companionBindingForInternal(){return null;}
    function _appKeys(){return [];}
    ${functionSource('companionAllExternalIntent')}
    ${functionSource('companionMentionedExternalTargets')}
    ${functionSource('companionExternalTargetsByText')}
    ${functionSource('companionDispatchRoleByText')}
    ${functionSource('companionDispatchRoleAll')}
    this.dispatch=companionDispatchRoleByText;
  `, context);
  assert.equal(context.dispatch('lock', '全部已选 App', { scope: 'external', actor: '角色' }), true);
  assert.equal(context.dispatch('unlock', '全部已选 App', { scope: 'external', actor: '角色' }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(external)), [
    { action: 'lock', id: 'real.wechat', actor: '角色' },
    { action: 'lock', id: 'real.video', actor: '角色' },
    { action: 'unlock', id: 'real.wechat', actor: '角色' },
    { action: 'unlock', id: 'real.video', actor: '角色' },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(internal)), [
    { action: 'lock', id: 'wechat', scope: 'internal' },
    { action: 'unlock', id: 'wechat', scope: 'internal' },
  ]);
  assert.match(functionSource('companionDispatchRoleExternal'), /companionSendCommand\(st,action,app/);
  assert.match(functionSource('companionSendCommand'), /companionNativeCommandRun\(command\)/);
  assert.match(functionSource('companionNativeCommandRun'), /SmallPhoneNative\.request\('device\.command',command\)/);
});

test('an incorrect internal-only model tag cannot downgrade a spoken all-lock or all-unlock', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    ${functionSource('companionAllExternalIntent')}
    ${functionSource('companionAllControlClauseAction')}
    ${functionSource('companionNaturalAllControlAction')}
    ${functionSource('companionRequestedAllControlAction')}
    ${functionSource('companionStripSupersededAllControlTags')}
    this.detect=companionRequestedAllControlAction;
    this.strip=companionStripSupersededAllControlTags;
  `, context);
  const wrongLock='我已经把全部软件锁好了。\n[锁定|云程、放映室、音乐、惊悚抉择、规则怪谈、角色扮演|仅内置]';
  const wrongUnlock='解除全锁了。\n[解锁|云程、放映室、音乐、惊悚抉择、规则怪谈、角色扮演|仅内置]';
  assert.equal(context.detect(wrongLock),'lock');
  assert.equal(context.detect(wrongUnlock),'unlock');
  assert.doesNotMatch(context.strip(wrongLock,'lock'),/\[锁定\|/);
  assert.doesNotMatch(context.strip(wrongUnlock,'unlock'),/\[解锁\|/);
  const apply=functionSource('applyControlTags');
  assert.ok(apply.indexOf('companionRequestedAllControlAction(content,requestText)') < apply.indexOf("content.replace(/[\\[【]\\s*(锁定|上锁|解锁"));
  assert.match(apply,/companionDispatchRoleAll\(allControlAction/);
  assert.match(apply,/changed=companionReads\.changed\|\|phonePwdChanged\|\|diaryPwdChanged\|\|allControlChanged/);
});

test('an explicit user all-control request upgrades a matching internal-only model action', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    ${functionSource('companionAllExternalIntent')}
    ${functionSource('companionAllControlClauseAction')}
    ${functionSource('companionNaturalAllControlAction')}
    ${functionSource('companionRequestedAllControlAction')}
    this.detect=companionRequestedAllControlAction;
  `, context);
  assert.equal(context.detect('好。\n[锁定|云程、音乐|仅内置]', '把所有软件全部锁定。'), 'lock');
  assert.equal(context.detect('行。\n[解锁|云程、音乐|仅内置]', '解除全锁。'), 'unlock');
  assert.equal(context.detect('我不想这么做。', '把所有软件全部锁定。'), '');
  assert.equal(context.detect('好。\n[解锁|云程、音乐|仅内置]', '把所有软件全部锁定。'), '');
  assert.equal(context.detect('好。\n[锁定|云程、音乐|仅内置]', '要不要把所有软件锁定？'), '');
  assert.equal(context.detect('选三个。今晚给你解开三个。\n[解锁|云程、音乐、放映室|仅内置]', '把这三个解开，不要解开全部。'), '');
});

test('a negative mention of all never upgrades a partial target to all external apps', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    function companionLatestUserText(){return '把这三个解开，不要解开全部。';}
    function companionRoleRequestedScope(){return 'both';}
    function companionMentionedExternalTargets(){return [];}
    function companionRoleReferenceCount(){return 3;}
    function companionRecentExternalGroup(){return [{name:'云程'},{name:'音乐'},{name:'放映室'}];}
    function companionRecentUniqueExternal(){return null;}
    ${functionSource('companionAllExternalIntent')}
    ${functionSource('companionAllControlClauseAction')}
    ${functionSource('companionNaturalAllControlAction')}
    ${functionSource('companionResolveRoleActionTarget')}
    this.resolve=companionResolveRoleActionTarget;
  `, context);
  const resolved=context.resolve({}, {}, '这几个', '“乖一天”换不回全部。今晚只给你解开三个。');
  assert.equal(resolved.text, '云程、音乐、放映室');
  assert.equal(resolved.scope, 'both');
  assert.notEqual(resolved.text, '全部内外 App');
});

test('control extraction uses deterministic all-app recovery first and retries parser failures once', () => {
  const extract = functionSource('extractControl');
  assert.ok(extract.indexOf('companionRecoverNaturalAllControl(reply,c)') < extract.indexOf('chatAPI('));
  assert.match(extract, /attempt<2/);
  assert.match(extract, /aux:attempt===0/);
  assert.equal(normalized(functionSource('companionRoleControlOnlyPrompt', bundled)), normalized(functionSource('companionRoleControlOnlyPrompt')));
  assert.equal(normalized(functionSource('companionAllControlClauseAction', bundled)), normalized(functionSource('companionAllControlClauseAction')));
  assert.equal(normalized(functionSource('companionNaturalAllControlAction', bundled)), normalized(functionSource('companionNaturalAllControlAction')));
  assert.equal(normalized(functionSource('companionRequestedAllControlAction', bundled)), normalized(functionSource('companionRequestedAllControlAction')));
  assert.equal(normalized(functionSource('companionDispatchRoleAll', bundled)), normalized(functionSource('companionDispatchRoleAll')));
  assert.equal(normalized(functionSource('extractControl', bundled)), normalized(extract));
});

test('companion controls resolve a stable app id even after polling reorders the array', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionAppByRef')}this.find=companionAppByRef;`, context);
  const st = { apps: [{ id: 'second', name: 'B' }, { id: 'first', name: 'A' }] };
  assert.equal(context.find(st, 'first').name, 'A');
  assert.equal(context.find(st, 0).name, 'B');
  const render = functionSource('renderCompanionPage');
  assert.match(render, /data-companion-app-id="\$\{esc\(app\.id\)\}"/);
  assert.match(render, /companionBindExternal\(this\.dataset\.companionAppId,this\.value\)/);
  assert.doesNotMatch(render, /companionBindExternal\(\$\{index\}/);
});

test('a refreshed native id repairs the saved association without duplicating the old app', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    function companionBindingBackupWrite(){return true;}
    ${functionSource('companionRememberBindingTarget')}
    ${functionSource('companionRepairBindings')}
    this.repair=companionRepairBindings;
  `, context);
  const st = {
    apps: [{ id: 'new-token', bindingCode: '013', name: '外置 013' }],
    bindings: [{ id: 'binding.1', internalAppId: 'wechat', externalAppId: 'old-token', externalBindingCode: '013', externalAppName: '微信' }],
    lockIntents: { 'old-token': { desiredLocked: true, source: 'explicit', updatedAt: 1 } },
  };
  const rebound = context.repair(st, [{ id: 'old-token', bindingCode: '013', name: '微信' }]);
  assert.equal(st.bindings[0].externalAppId, 'new-token');
  assert.equal(st.bindings[0].externalAppName, '微信');
  assert.equal(st.apps[0].name, '微信');
  assert.equal(st.lockIntents['new-token'].desiredLocked, true);
  assert.equal(st.lockIntents['old-token'], undefined);
  assert.equal(rebound.has('old-token'), true);
});

test('an App association survives a later state overwrite through its independent local backup', () => {
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
  const context = vm.createContext({ localStorage });
  vm.runInContext(`
    const LOCKABLE={wechat:'微信'};
    function cloudId(){return 'owner.1';}
    function uid(){return 'fixed';}
    ${functionSource('companionBindingBackupKey')}
    ${functionSource('companionBindingBackupRows')}
    ${functionSource('companionBindingBackupWrite')}
    ${functionSource('companionBindingBackupRestore')}
    this.write=companionBindingBackupWrite;
    this.restore=companionBindingBackupRestore;
  `, context);
  const saved = {
    deviceId: 'iphone-1',
    bindings: [{ id: 'binding.1', internalAppId: 'wechat', externalAppId: 'real.wechat', externalBindingCode: '013', externalAppName: '微信' }],
  };
  assert.equal(context.write(saved), true);
  const overwritten = { deviceId: 'iphone-1', bindings: [] };
  assert.equal(context.restore(overwritten), true);
  assert.deepEqual(JSON.parse(JSON.stringify(overwritten.bindings)), saved.bindings);

  assert.equal(context.write({ deviceId: 'iphone-1', bindings: [] }), true);
  const explicitlyUnbound = { deviceId: 'iphone-1', bindings: [] };
  assert.equal(context.restore(explicitlyUnbound), false);
  assert.deepEqual(explicitlyUnbound.bindings, []);
});

test('association metadata is durably saved and bundled code stays synchronized', () => {
  const bind = functionSource('companionBindExternal');
  assert.match(bind, /companionRememberBindingTarget\(binding,app\)/);
  assert.match(bind, /await saveNowAsync\(\)/);
  assert.match(bind, /关联没有保存成功/);
  assert.match(bind, /st\.bindings=oldBindings;app\.name=oldName/);
  assert.ok(bind.indexOf('await saveNowAsync()') < bind.indexOf("companionDispatchBound('limit'"));
  for (const name of ['companionBindingBackupKey', 'companionBindingBackupRows', 'companionBindingBackupWrite', 'companionBindingBackupRestore', 'companionAppByRef', 'companionRememberBindingTarget', 'companionRepairBindings', 'companionBindExternal', 'companionRenameExternal', 'companionOwnerAction']) {
    assert.equal(normalized(functionSource(name, bundled)), normalized(functionSource(name)), `${name} must match the private bundle`);
  }
});
