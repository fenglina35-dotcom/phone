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
  assert.match(app, /id="coutab3"[^>]*onclick="couTab\(3\)"/);
  assert.match(app, /id="coupage3"/);
  assert.match(app, /伴生设备/);
  assert.match(functionSource('couTab'), /\[1,2,3\]/);
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
  assert.match(functionSource('companionDispatchBound'), /外置 App 尚未通过稳定 ID 完成绑定/);
});

test('a both-scope instruction creates separate internal and external rules', () => {
  const dispatch = functionSource('companionDispatchBound');
  const tags = functionSource('applyControlTags');
  assert.match(dispatch, /needsExternal=scope!==\x27internal\x27/);
  assert.match(dispatch, /needsInternal=scope!==\x27external\x27/);
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
  assert.match(ui, /两边各自计时/);
  assert.match(ui, /绝不合并时长/);
  assert.match(ui, /待 iPhone 端接入/);
  assert.match(functionSource('companionRolePrompt'), /当前只有总时长/);
  assert.match(functionSource('companionRolePrompt'), /不得自行拆分或猜测/);
});

test('prototype data is clearly non-device data and version is aligned', () => {
  assert.match(functionSource('companionLoadDemo'), /不会连接或控制真实 iPhone/);
  assert.match(functionSource('companionSourceLabel'), /原型测试数据 · 非真实设备/);
  assert.match(app, /const APP_VER='v812 · 微信自主自然模式与电子宠物扩充'/);
});

test('manual sync sends a device request and schedules server refreshes', () => {
  const source = functionSource('companionRequestSync');
  assert.match(source, /companionApplyAction\(st,'view'/);
  assert.match(source, /scope:'external'/);
  assert.match(source, /setTimeout\(\(\)=>companionPollSnapshot\(true\),35000\)/);
  assert.match(source, /最迟约 30 秒回传/);
});

test('unbound external apps remain controllable without guessing an internal id', () => {
  const owner = functionSource('companionOwnerAction');
  const batch = functionSource('companionBatchAction');
  assert.match(owner, /else if\(app\)r=companionApplyAction/);
  assert.match(owner, /scope:'external'/);
  assert.match(owner, /本次仅控制真实 iPhone/);
  assert.match(batch, /for\(const app of st\.apps\)/);
  assert.match(batch, /externalOnly\+\+/);
});

test('role external commands resolve a synced display name to its stable external id', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionExternalTargetsByText')}\nthis.pick=companionExternalTargetsByText;`, context);
  const state = { apps: [
    { id: 'ios.stable.douyin', name: '抖音' },
    { id: 'ios.stable.wechat', name: '微信' },
  ] };
  assert.deepEqual(Array.from(context.pick(state, '抖音'), x => x.id), ['ios.stable.douyin']);
  assert.deepEqual(Array.from(context.pick(state, '全部'), x => x.id), ['ios.stable.douyin', 'ios.stable.wechat']);
  assert.deepEqual(Array.from(context.pick(state, '不存在'), x => x.id), []);
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
  assert.match(bound, /needsInternal&&!?\(S\.couple\.grant\|\|\{\}\)\[internalId\]/);
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
  assert.match(phone, /v809 伴生设备控制台/);
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
