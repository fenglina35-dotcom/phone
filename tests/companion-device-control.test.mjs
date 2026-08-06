import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');
const phone = readFileSync(join(root, '小手机.html'), 'utf8');
function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; opened = true; }
    if (app[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return app.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

test('couple space exposes a third companion-device page', () => {
  assert.match(app, /id="coutab3"[^>]*onclick="companionEnter\(\)"/);
  assert.match(app, /id="coupage3"/);
  assert.match(app, /伴生设备/);
  assert.match(functionSource('couTab'), /\[1,2,3\]/);
});

test('companion device entry requires the fixed password only once per browser', () => {
  const store = new Map();
  const context = vm.createContext({
    localStorage: {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { store.set(key, value); },
    },
  });
  vm.runInContext(`
    const COMPANION_ENTRY_GATE_KEY='north-companion-entry-unlocked-v1';
    ${functionSource('companionEntryUnlocked')}
    ${functionSource('companionEntryPasswordOK')}
    this.unlocked=companionEntryUnlocked;
    this.passwordOK=companionEntryPasswordOK;
  `, context);
  assert.equal(context.unlocked(), false);
  assert.equal(context.passwordOK('206414'), true);
  assert.equal(context.passwordOK('206413'), false);
  context.localStorage.setItem('north-companion-entry-unlocked-v1', '1');
  assert.equal(context.unlocked(), true);
  assert.match(functionSource('coupleJump'), /\+tab===3/);
  assert.match(functionSource('coupleJump'), /companionEnter\(id\)/);
  assert.match(functionSource('companionSubmitEntry'), /localStorage\.setItem\(COMPANION_ENTRY_GATE_KEY,'1'\)/);
});

test('control defaults to both while role reads default to external only', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionDefaultState')}\nthis.value=companionDefaultState();`, context);
  assert.equal(context.value.defaultScope, 'both');
  assert.equal(context.value.readScope, 'external');
  assert.equal(context.value.screenTimeMode, 'total_only');
  assert.equal(context.value.screenTimeAvailable, false);
  assert.equal(context.value.roleAccess, false);
  assert.match(app, /内外同时/);
  assert.match(app, /读取来源铁律/);
  assert.match(app, /绝对不要与小手机内置计时或剧情位置合并/);
});

test('internal and external apps bind through distinct stable ids', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionBindingForInternal')}\n${functionSource('companionExternalById')}\n${functionSource('companionBoundExternal')}`, context);
  const state = {
    apps: [{ id: 'ios.token.douyin', name: '抖音' }],
    bindings: [{ internalAppId: 'douyin', externalAppId: 'ios.token.douyin' }],
  };
  assert.equal(context.companionBindingForInternal(state, 'douyin').externalAppId, 'ios.token.douyin');
  assert.equal(context.companionBoundExternal(state, 'douyin').id, 'ios.token.douyin');
  assert.equal(context.companionBoundExternal(state, 'music'), null);
  assert.match(functionSource('companionDispatchBound'), /binding\.externalAppId/);
  assert.match(functionSource('companionDispatchBound'), /外置 App 尚未通过稳定 ID 完成关联/);
});

test('a unified limit creates separate internal and external execution rules', () => {
  const dispatch = functionSource('companionDispatchBound');
  const tags = functionSource('applyControlTags');
  assert.match(dispatch, /needsExternal=scope!==\x27internal\x27/);
  assert.match(dispatch, /needsInternal=scope!==\x27external\x27/);
  assert.match(dispatch, /scope=action===\x27limit\x27\?\x27both\x27:requestedScope/);
  assert.match(dispatch, /companionApplyInternalAction/);
  assert.match(dispatch, /companionApplyAction/);
  assert.match(dispatch, /外置 DeviceActivity 规则已提交/);
  assert.match(functionSource('applyControlTags'), /仅内置\|只内置\|仅外置\|只外置\|内外同时/);
  assert.match(functionSource('applyControlTags'), /companionDispatchRoleByText\(\x27limit\x27/);
  assert.match(tags, /dual=!!\(st&&st\.roleAccess\)/);
  assert.doesNotMatch(tags, /roleAccess&&companionReady/);
});

test('role location and usage reads are pinned to the external iPhone source', () => {
  assert.match(functionSource('companionRoleReadsExternal'), /st\.readScope===\x27external\x27/);
  assert.match(functionSource('companionRoleLocationText'), /companionRoleReadsExternal/);
  assert.match(functionSource('companionRoleScreenTimeText'), /companionDuration/);
  assert.match(functionSource('spyFocusData'), /companionRoleLocationText/);
  assert.match(functionSource('spyFocusData'), /companionRoleScreenTimeText/);
  assert.match(functionSource('remoteControlViewableSnapshot'), /externalScreenTime:companionRoleScreenTimeText/);
});

test('internal and external usage stay independent and per-app external time is pending', () => {
  const ui = functionSource('renderCompanionPage');
  const payload = functionSource('companionApplyServerPayload');
  assert.match(ui, /internalUsed=internalId\?usedSecOf\(internalId\):0/);
  assert.match(ui, /companionDuration\(app\.usedSec\)/);
  assert.match(ui, /screenTimeAvailable/);
  assert.match(payload, /reportAvailable/);
  assert.match(ui, /两边仍各自计时/);
  assert.match(ui, /待 iPhone 端接入/);
  assert.match(functionSource('companionRolePrompt'), /当前只有总时长/);
  assert.match(functionSource('companionRolePrompt'), /不得自行拆分或猜测/);
});

test('prototype data is clearly non-device data and version is aligned', () => {
  assert.match(functionSource('companionLoadDemo'), /不会连接或控制真实 iPhone/);
  assert.match(functionSource('companionSourceLabel'), /原型测试数据 · 非真实设备/);
  assert.match(app, /const APP_VER='v824 · 三款非音乐型来电短铃'/);
});

test('manual sync sends a device request and schedules server refreshes', () => {
  const source = functionSource('companionRequestSync');
  assert.match(source, /companionApplyAction\(st,'view'/);
  assert.match(source, /scope:'external'/);
  assert.match(source, /setTimeout\(\(\)=>companionPollSnapshot\(true\),35000\)/);
  assert.match(source, /最迟约 30 秒回传/);
});

test('unbound external apps remain lockable but cannot receive an independent limit', () => {
  const owner = functionSource('companionOwnerAction');
  const batch = functionSource('companionBatchAction');
  assert.match(owner, /else r=companionApplyAction/);
  assert.match(owner, /scope:'external'/);
  assert.match(owner, /action===\x27limit\x27&&!binding/);
  assert.match(owner, /限额只保留一份并同步到内外两端/);
  assert.match(owner, /本次只控制真实 iPhone/);
  assert.match(batch, /for\(const app of st\.apps\)/);
  assert.match(batch, /externalOnly\+\+/);
  assert.match(functionSource('companionBindingOptions'), /不关联（外置仍可锁定 \/ 解锁）/);
  assert.match(functionSource('renderCompanionPage'), /关联小手机 App（可选，仅同名时同步锁定）/);
  assert.match(functionSource('renderCompanionPage'), /未关联（外置仍可单独锁定或解锁）/);
  assert.match(functionSource('renderCompanionPage'), /placeholder="不限额"/);
});

test('binding is saved immediately and refreshes only the companion panel', () => {
  const bind = functionSource('companionBindExternal');
  const refresh = functionSource('companionRefreshPanel');
  assert.match(bind, /saveNow\(\)/);
  assert.match(bind, /companionRefreshPanel\(\)/);
  assert.doesNotMatch(bind, /save\(\);render\(\)/);
  assert.match(refresh, /scrollTop/);
  assert.match(refresh, /renderCompanionPage/);
  assert.match(refresh, /oldSection\.innerHTML=newSection\.innerHTML/);
  assert.doesNotMatch(refresh, /panel\.innerHTML=/);
  assert.doesNotMatch(refresh, /return render\(\)/);
  for (const name of ['companionOwnerAction', 'companionBatchAction']) {
    const source = functionSource(name);
    assert.match(source, /saveNow\(\);companionRefreshPanel\(\)/);
    assert.doesNotMatch(source, /save\(\);render\(\)/);
  }
});

test('role limits require a binding and are forced to both endpoints', () => {
  const route = functionSource('companionDispatchRoleByText');
  const external = functionSource('companionDispatchRoleExternal');
  assert.match(route, /action===\x27limit\x27/);
  assert.match(route, /scope:'both'/);
  assert.match(route, /companionUnifiedLimitInternalIds/);
  assert.match(external, /action===\x27limit\x27/);
  assert.match(external, /只支持已关联 App 的内外统一设置/);
});

test('anonymous external apps receive stable matching numbers instead of upload-order names', () => {
  const context = vm.createContext({ LOCKABLE: {} });
  vm.runInContext(`${functionSource('companionSnapshotApps')}\nthis.read=companionSnapshotApps;`, context);
  const state = { apps: [], bindings: [] };
  const value = context.read(state, { apps: [
    { id: 'ios.z', usedSeconds: 7 },
    { id: 'ios.a', usedSeconds: 3 },
  ] });
  assert.deepEqual(Array.from(value, x => x.id), ['ios.a', 'ios.z']);
  assert.deepEqual(Array.from(value, x => x.bindingCode), ['01', '02']);
  assert.deepEqual(Array.from(value, x => x.name), ['外置 01', '外置 02']);
  assert.match(functionSource('companionSnapshotApps'), /row\.bindingCode/);
});

test('role external commands resolve a synced display name to its stable external id', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionAllExternalIntent')}\n${functionSource('companionMentionedExternalTargets')}\n${functionSource('companionExternalTargetsByText')}\nthis.pick=companionExternalTargetsByText;`, context);
  const state = { apps: [
    { id: 'ios.stable.douyin', name: '抖音' },
    { id: 'ios.stable.wechat', name: '微信' },
  ] };
  assert.deepEqual(Array.from(context.pick(state, '抖音'), x => x.id), ['ios.stable.douyin']);
  assert.deepEqual(Array.from(context.pick(state, '全部已选 App'), x => x.id), ['ios.stable.douyin', 'ios.stable.wechat']);
  assert.deepEqual(Array.from(context.pick(state, '全锁'), x => x.id), []);
  assert.deepEqual(Array.from(context.pick(state, '不存在'), x => x.id), []);
});

test('role collective references resolve only the recently named external app group', () => {
  const rows = [
    { role: 'assistant', content: '四个里面，ChatGPT 综合能力最强，DeepSeek 推理不错，Gemini 搜索可以，豆包适合陪聊。' },
    { role: 'user', content: '小孩子才做选择，我都要。' },
  ];
  const context = vm.createContext({ rows });
  vm.runInContext(`
    function msgs(){return rows;}
    function msgToText(row){return row.content||'';}
    ${functionSource('companionAllExternalIntent')}
    ${functionSource('companionMentionedExternalTargets')}
    ${functionSource('companionExternalTargetsByText')}
    ${functionSource('companionRoleReferenceCount')}
    ${functionSource('companionLatestUserText')}
    ${functionSource('companionRecentExternalGroup')}
    function companionScope(value){return value==='external'||value==='internal'||value==='both'?value:'';}
    ${functionSource('companionRoleRequestedScope')}
    ${functionSource('companionResolveRoleActionTarget')}
    this.rows=rows;
    this.resolve=companionResolveRoleActionTarget;
  `, context);
  const state = { defaultScope: 'external', apps: [
    { id: 'ios.gemini', name: 'Gemini' },
    { id: 'ios.doubao', name: '豆包' },
    { id: 'ios.chatgpt', name: 'ChatGPT' },
    { id: 'ios.deepseek', name: 'DeepSeek' },
    { id: 'ios.bilibili', name: '哔哩哔哩' },
  ] };
  const resolved = context.resolve(state, { id: 'role' }, '全部', '四个。全锁。');
  assert.equal(resolved.scope, 'both');
  assert.deepEqual(resolved.text.split('、').sort(), ['ChatGPT', 'DeepSeek', 'Gemini', '豆包'].sort());
  assert.doesNotMatch(resolved.text, /哔哩哔哩/);
  context.rows.push({ role: 'user', content: '把全部已选 App 都锁上。' });
  const all = context.resolve(state, { id: 'role' }, '全部', '都锁好了。');
  assert.equal(all.text.split('、').length, 5);
});

test('resolved four-app reference dispatches exactly four stable external ids', () => {
  const sent = [];
  const context = vm.createContext({ sent });
  vm.runInContext(`
    const S={couple:{grant:{}}};
    const LOCKABLE={};
    const state={defaultScope:'both',bindings:[],apps:[
      {id:'ios.gemini',name:'Gemini'},{id:'ios.doubao',name:'豆包'},
      {id:'ios.chatgpt',name:'ChatGPT'},{id:'ios.deepseek',name:'DeepSeek'},
      {id:'ios.bilibili',name:'哔哩哔哩'}
    ]};
    function companionState(){return state;}
    function companionScope(value){return value==='external'||value==='internal'||value==='both'?value:'';}
    function companionUnifiedLimitInternalIds(){return [];}
    function companionDispatchBound(){return {ok:false};}
    function companionDispatchRoleExternal(action,app){sent.push({action,id:app.id});return {ok:true};}
    function _appKeys(){return [];}
    ${functionSource('companionAllExternalIntent')}
    ${functionSource('companionMentionedExternalTargets')}
    ${functionSource('companionExternalTargetsByText')}
    ${functionSource('companionDispatchRoleByText')}
    this.run=companionDispatchRoleByText;
  `, context);
  assert.equal(context.run('lock', 'Gemini、豆包、ChatGPT、DeepSeek', { scope: 'external', actor: '先生' }), true);
  assert.deepEqual(Array.from(context.sent, x => x.id), ['ios.gemini', 'ios.doubao', 'ios.chatgpt', 'ios.deepseek']);
});

test('bound role targets lock both endpoints while unbound targets stay external only', () => {
  const calls = [];
  const context = vm.createContext({ calls });
  vm.runInContext(`
    const S={couple:{grant:{qq:true}}};
    const LOCKABLE={qq:'QQ'};
    const state={defaultScope:'both',apps:[
      {id:'ios.qq',name:'QQ'},{id:'ios.wechat',name:'微信'}
    ],bindings:[{internalAppId:'qq',externalAppId:'ios.qq'}]};
    function companionState(){return state;}
    function companionScope(value){return value==='external'||value==='internal'||value==='both'?value:'';}
    function companionUnifiedLimitInternalIds(){return [];}
    function companionBindingForInternal(st,id){return st.bindings.find(x=>x.internalAppId===id)||null;}
    ${functionSource('companionComparableAppName')}
    ${functionSource('companionBindingMirrorsLock')}
    function companionDispatchBound(action,id,opt){calls.push({kind:'bound',action,id,scope:opt.scope});return {ok:true};}
    function companionDispatchRoleExternal(action,app){calls.push({kind:'external',action,id:app.id,scope:'external'});return {ok:true};}
    function _appKeys(){return [];}
    ${functionSource('companionAllExternalIntent')}
    ${functionSource('companionMentionedExternalTargets')}
    ${functionSource('companionExternalTargetsByText')}
    ${functionSource('companionDispatchRoleByText')}
    this.run=companionDispatchRoleByText;
  `, context);
  assert.equal(context.run('lock', 'QQ、微信', { scope: 'both', actor: '先生' }), true);
  assert.deepEqual(Array.from(context.calls, x => `${x.kind}:${x.id}:${x.scope}`), [
    'bound:qq:both',
    'external:ios.wechat:external',
  ]);
});

test('a mismatched limit association can never substitute a virtual internal app for a real lock target', () => {
  const calls = [];
  const context = vm.createContext({ calls });
  vm.runInContext(`
    const S={couple:{grant:{cinema:true}}};
    const LOCKABLE={cinema:'放映室'};
    const state={defaultScope:'both',apps:[{id:'ios.chatgpt',name:'ChatGPT'}],bindings:[{internalAppId:'cinema',externalAppId:'ios.chatgpt'}]};
    function companionState(){return state;}
    function companionScope(value){return value==='external'||value==='internal'||value==='both'?value:'';}
    function companionUnifiedLimitInternalIds(){return [];}
    function companionBindingForInternal(st,id){return st.bindings.find(x=>x.internalAppId===id)||null;}
    function companionDispatchBound(action,id,opt){calls.push({kind:'bound',action,id,scope:opt.scope});return {ok:true};}
    function companionDispatchRoleExternal(action,app){calls.push({kind:'external',action,id:app.id,scope:'external'});return {ok:true};}
    function _appKeys(){return [];}
    ${functionSource('companionComparableAppName')}
    ${functionSource('companionBindingMirrorsLock')}
    ${functionSource('companionAllExternalIntent')}
    ${functionSource('companionMentionedExternalTargets')}
    ${functionSource('companionExternalTargetsByText')}
    ${functionSource('companionDispatchRoleByText')}
    this.run=companionDispatchRoleByText;
  `, context);
  assert.equal(context.run('lock', 'ChatGPT', { scope: 'both', actor: '先生' }), true);
  assert.deepEqual(Array.from(context.calls, x => `${x.kind}:${x.id}:${x.scope}`), ['external:ios.chatgpt:external']);
  assert.match(functionSource('companionOwnerAction'), /没有同名内置 App，不能拿其他虚拟 App 代替锁定/);
});

test('pending and conflicting device commands never masquerade as a confirmed red lock card', () => {
  const context = vm.createContext({});
  vm.runInContext(`const COMPANION_SNAPSHOT_FRESH_MS=120000,COMPANION_COMMAND_PENDING_MS=900000;${functionSource('companionLastExternalCommand')}\n${functionSource('companionSnapshotIsFresh')}\n${functionSource('companionExternalCommandState')}\nthis.state=companionExternalCommandState;`, context);
  const appRow = { id: 'ios.trip', name: '携程旅行', locked: true };
  const pending = { commands: [{ action: 'unlock', externalAppId: 'ios.trip', status: 'pending', ts: 2 }] };
  assert.equal(context.state(pending, appRow, 4).kind, 'pendingUnlock');
  const awaitingSnapshot = { lastSync: 2, commands: [{ action: 'unlock', externalAppId: 'ios.trip', status: 'completed', ts: 3 }] };
  assert.equal(context.state(awaitingSnapshot, appRow, 4).kind, 'awaitSnapshot');
  const conflict = { lastSync: 4, commands: [{ action: 'unlock', externalAppId: 'ios.trip', status: 'completed', ts: 3 }] };
  assert.equal(context.state(conflict, appRow, 4).kind, 'conflict');
  assert.equal(context.state({ lastSync: 4, commands: [] }, appRow, 120005).kind, 'stale');
  assert.equal(context.state({ commands: [{ action: 'lock', externalAppId: 'ios.trip', status: 'pending', ts: 2 }] }, appRow, 900003).kind, 'expired');
  const decorate = functionSource('companionDecoratePage');
  assert.match(decorate, /confirmedLocked=!!app\.locked&&\(commandState\.kind==='snapshot'\|\|commandState\.kind==='confirmed'\)/);
  assert.match(decorate, /companion-app-pending/);
  assert.doesNotMatch(functionSource('companionApplyServerPayload'), /snapshot\.generatedAt\)\|\|Date\.now\(\)/);
  assert.match(app, /网页接受命令不等于设备执行成功/);
});

test('the companion page refreshes immediately after returning to the foreground', () => {
  assert.match(app, /visibilitychange[\s\S]{0,900}companionPollSnapshot\(true\)/);
  assert.match(app, /pageshow[\s\S]{0,700}companionPollSnapshot\(true\)/);
  assert.match(functionSource('companionPollSnapshot'), /document\.hidden/);
});

test('external name matching prefers the longest overlapping app name', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionMentionedExternalTargets')}\nthis.pick=companionMentionedExternalTargets;`, context);
  const state = { apps: [{ id: 'ios.qq', name: 'QQ' }, { id: 'ios.qqmusic', name: 'QQ音乐' }] };
  assert.deepEqual(Array.from(context.pick(state, '把 QQ音乐 锁上'), x => x.id), ['ios.qqmusic']);
});

test('role external lock uses the stable id without requiring an internal grant', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    const sent=[];
    const state={roleAccess:true,permissions:{appControl:true},linked:true,demo:false,commands:[]};
    function companionState(){return state;}
    function companionScopeForAction(){return 'appControl';}
    function companionReady(st){return !!st.linked;}
    function companionApplyAction(){return {ok:true};}
    function companionLog(st,action,detail,status,actor){const row={action,detail,status,actor};st.commands.push(row);return row;}
    function companionSendCommand(st,action,app,opt){sent.push({action,id:app.id,scope:opt.scope});}
    ${functionSource('companionDispatchRoleExternal')}
    this.run=companionDispatchRoleExternal;
    this.sent=sent;
    this.state=state;
  `, context);
  const result = context.run('lock', { id: 'ios.stable.douyin', name: '抖音' }, { actor: '角色' });
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(context.sent, x => `${x.action}:${x.id}:${x.scope}`), ['lock:ios.stable.douyin:external']);
  context.state.permissions.appControl = false;
  assert.equal(context.run('unlock', { id: 'ios.stable.douyin', name: '抖音' }, {}).ok, false);
  assert.equal(context.sent.length, 1);
});

test('a synced external-only app is routed to the real iPhone without silent dual-scope failure', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    const S={couple:{grant:{}}};
    const LOCKABLE={douyin:'抖音'};
    function _appKeys(text,keys,filter){return String(text).includes('抖音')&&filter('douyin')?['douyin']:[];}
    ${functionSource('companionAllExternalIntent')}
    ${functionSource('companionMentionedExternalTargets')}
    ${functionSource('companionExternalTargetsByText')}
    ${functionSource('companionRoleScopeForText')}
    this.pick=companionRoleScopeForText;
    this.S=S;
  `, context);
  const state = {defaultScope:'both', apps:[{id:'ios.qq', name:'QQ'}]};
  assert.equal(context.pick(state, 'QQ'), 'external');
  assert.equal(context.pick(state, '不存在'), 'both');
  state.apps.push({id:'ios.douyin', name:'抖音'});
  context.S.couple.grant.douyin = true;
  assert.equal(context.pick(state, '抖音'), 'both');
});

test('role parser routes explicit and natural external controls through the companion dispatcher', () => {
  const tags = functionSource('applyControlTags');
  const natural = functionSource('extractControl');
  const bound = functionSource('companionDispatchBound');
  assert.match(tags, /companionDispatchRoleByText\('lock'/);
  assert.match(tags, /companionDispatchRoleByText\('limit'/);
  assert.match(tags, /companionDispatchRoleByText\('unlock'/);
  assert.match(natural, /externalNames=dual&&\(deviceState\.permissions\.appControl\|\|deviceState\.permissions\.limits\)/);
  assert.match(natural, /companionDispatchRoleByText\('limit'/);
  assert.match(natural, /companionRoleScopeForText\(deviceState/);
  assert.match(natural, /collectiveTarget/);
  assert.match(natural, /companionResolveRoleActionTarget/);
  const prompt = functionSource('companionRolePrompt');
  assert.match(prompt, /回看最近一组明确提到的 App/);
  assert.match(prompt, /按自己的性格自然发挥/);
  assert.match(prompt, /标签会被动作引擎隐藏/);
  assert.match(bound, /needsInternal&&!\(S\.couple\.grant\|\|\{\}\)\[internalId\]/);
});

test('companion operation history expires automatically after three days', () => {
  const context = vm.createContext({});
  const now = 10 * 24 * 60 * 60 * 1000;
  vm.runInContext(
    `const COMPANION_AUDIT_RETENTION_MS=3*24*60*60*1000;${functionSource('companionPruneAudit')}this.st={commands:[{ts:${now}-1000},{ts:${now}-4*24*60*60*1000}]};companionPruneAudit(this.st,${now});`,
    context,
  );
  assert.equal(context.st.commands.length, 1);
});

test('external display aliases can be saved without changing stable ids', () => {
  const rename = functionSource('companionRenameExternal');
  assert.match(rename, /app\.name=name/);
  assert.match(rename, /稳定 ID 没有改变/);
  assert.match(functionSource('renderCompanionPage'), /companionRenameExternal/);
});

test('companion device page has advanced locked-state cards without changing command behavior', () => {
  const decorate = functionSource('companionDecoratePage');
  assert.match(functionSource('renderCompanionPage'), /setTimeout\(companionDecoratePage,0\)/);
  assert.match(decorate, /companion-app-locked/);
  assert.match(decorate, /companion-usage-meter/);
  assert.match(decorate, /last\.actor/);
  assert.match(phone, /v822 伴生命令回执与内置图片下线/);
  assert.match(phone, /#coupage3/);
  assert.match(phone, /\.companion-app-locked/);
  assert.match(phone, /linear-gradient\(90deg,#ac2848,#ff6377\)/);
});

test('companion device page is fixed to vertical scrolling without clipped controls', () => {
  assert.match(phone, /#couplescroll\{overflow-x:hidden;overscroll-behavior-x:none;touch-action:pan-y\}/);
  assert.match(phone, /#coupage3\{box-sizing:border-box;width:100%;max-width:100%;min-width:0;margin:-10px 0 0;/);
  assert.doesNotMatch(phone, /#coupage3\{[^}]*margin:-10px -10px 0/);
  assert.match(phone, /#cou_companion_apps\{overflow:hidden!important/);
  assert.match(phone, /\.companion-app-card\{[^}]*width:100%;max-width:100%;min-width:0/);
  assert.match(phone, /\.companion-app-card>div:last-child\{margin-left:0!important\}/);
});
