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
  const functionStart = app.indexOf(`function ${name}(`);
  assert.notEqual(functionStart, -1, `missing ${name}`);
  const start = app.slice(Math.max(0, functionStart - 6), functionStart) === 'async '
    ? functionStart - 6 : functionStart;
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

test('legacy state stays compatible while the visible control is one real phone', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionDefaultState')}\nthis.value=companionDefaultState();`, context);
  assert.equal(context.value.defaultScope, 'both');
  assert.equal(context.value.readScope, 'external');
  assert.equal(context.value.screenTimeMode, 'total_only');
  assert.equal(context.value.screenTimeAvailable, false);
  assert.equal(context.value.dynamicSync, 0);
  assert.equal(context.value.roleAccess, false);
  assert.match(functionSource('renderCompanionPage'), /这里只有一台“真实手机”/);
  assert.doesNotMatch(functionSource('renderCompanionPage'), /仅内置/);
  assert.doesNotMatch(functionSource('renderCompanionPage'), /仅外置/);
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
  assert.match(ui, /不会形成第二套设备或第二份限额/);
  assert.match(ui, /待 iPhone 端接入/);
  assert.match(functionSource('companionRolePrompt'), /当前只有总时长/);
  assert.match(functionSource('companionRolePrompt'), /不得自行拆分或猜测/);
});

test('prototype data is clearly non-device data and version is aligned', () => {
  assert.match(functionSource('companionLoadDemo'), /不会连接或控制真实 iPhone/);
  assert.match(functionSource('companionSourceLabel'), /原型测试数据 · 非真实设备/);
  assert.match(app, /const APP_VER='v1161 · 外卖未知品牌识别版'/);
});

test('manual sync reads locally in the bundled app and keeps cloud fallback', () => {
  const source = functionSource('companionRequestSync');
  assert.match(source, /companionLocalNativeAvailable\(\)/);
  assert.match(source, /companionNativeSnapshot\('iPhone全部数据',st\)/);
  assert.match(source, /companionRoleProgressSteps\('iPhone全部数据',st\)/);
  assert.match(source, /本次真实数据读取结束/);
  assert.match(source, /companionApplyAction\(st,'view'/);
  assert.match(source, /scope:'external'/);
  assert.match(source, /setTimeout\(\(\)=>companionPollSnapshot\(true\),15000\)/);
  assert.match(source, /远程 iPhone 后台同步/);
});

test('bundled private app reads and executes through the native device bridge', () => {
  const nativeRead = functionSource('companionNativeSnapshot');
  const send = functionSource('companionSendCommand');
  const nativeRun = functionSource('companionNativeCommandRun');
  assert.match(nativeRead, /device\.snapshot/);
  assert.match(nativeRun, /device\.command/);
  assert.match(nativeRun, /stage!==\x27executed\x27/);
  assert.match(send, /_companionNativeCommandLane/);
  assert.match(send, /transport=\x27local-native\x27/);
  assert.match(functionSource('companionRolePullLatest'), /companionRolePullNativeSnapshot/);
  assert.match(functionSource('companionRolePullLatest'), /companionRoleSnapshotFresh/);
});

test('native companion controls serialize and retry only transient failures', async () => {
  const context = vm.createContext({ setTimeout, clearTimeout });
  vm.runInContext(`
    let calls=0;
    const window={SmallPhoneNative:{request:async(_action,command)=>{calls++;if(command.fail==='auth')throw new Error('屏幕使用时间授权已失效');if(calls===1)throw new Error('本地屏蔽配置写入失败，未发送成功回执');return {ok:true,stage:'executed'};}}};
    const sleep=()=>Promise.resolve();
    ${functionSource('companionNativeCommandRetryable')}
    ${functionSource('companionNativeCommandRun')}
    this.run=companionNativeCommandRun;
    this.calls=()=>calls;
  `, context);
  const receipt = await context.run({ action: 'lock' });
  assert.equal(receipt.retries, 1);
  assert.equal(context.calls(), 2);
  await assert.rejects(() => context.run({ action: 'lock', fail: 'auth' }));
  assert.equal(context.calls(), 3, 'non-transient authorization errors must not retry');
});

test('native Screen Time authorization is rechecked once and reports the exact state', () => {
  const sync = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'CompanionSyncView.swift'), 'utf8');
  assert.match(sync, /guard await screenTimeControlAuthorizationSettled\(\) else/);
  assert.match(sync, /Task\.sleep\(nanoseconds: 450_000_000\)/);
  assert.match(sync, /屏幕使用时间尚未完成授权/);
  assert.match(sync, /屏幕使用时间授权被系统拒绝或撤销/);
  assert.doesNotMatch(sync, /屏幕使用时间授权已失效，请在伴生 App 重新授权后再(?:锁定|解锁)/);
});

test('local control receipt does not wait for unrelated wellness refresh', () => {
  const sync = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'CompanionSyncView.swift'), 'utf8');
  const start = sync.indexOf('func performLocalCommand(');
  const end = sync.indexOf('private func updateDataAccessMode', start);
  const block = sync.slice(start, end);
  assert.match(block, /if action == "location"[\s\S]*await wellnessService\.refresh\(\)/);
  assert.doesNotMatch(block, /}\s*await wellnessService\.refresh\(\)\s*var snapshot/);
  assert.match(block, /"stage": "executed"/);
});

test('one-click role read names every real field and each actual app', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    ${functionSource('companionRoleUsageTarget')}
    ${functionSource('companionRoleAllFocus')}
    ${functionSource('companionRoleProgressSteps')}
    this.steps=companionRoleProgressSteps;
  `, context);
  const state = { apps: [
    { id: 'ios.douyin', name: '抖音', usedSec: 900 },
    { id: 'ios.weixin', name: '微信', usedSec: 120 },
  ] };
  assert.deepEqual(Array.from(context.steps('一键读取全部', state)), [
    '正在读取 iPhone 电量',
    '正在读取屏幕使用时间',
    '正在读取抖音软件使用时间',
    '正在读取微信软件使用时间',
    '正在读取今日步数',
    '正在读取睡眠',
    '正在读取最新心率',
    '正在读取心电与 HRV',
    '正在读取实时位置',
  ]);
});

test('all-data replies hide diagnostics and remain entirely model generated', () => {
  const facts = functionSource('rolePhoneInspectionAllFactsText');
  for (const label of ['电量', '屏幕', '逐 App', '步数', '睡眠', '心率', '心电', 'HRV', '位置']) {
    assert.match(facts, new RegExp(label));
  }
  assert.doesNotMatch(facts, /readErrors|本次未读到|尚未同步/);
  assert.doesNotMatch(app, /function rolePhoneInspectionExactSummary/);
  assert.match(functionSource('doSpyView'), /ownerRequested:!!\(opts&&opts\.bySheTold\)/);
  const online = functionSource('doSpyViewCore');
  const cohab = functionSource('cohabPhoneDeliverFact');
  assert.match(online, /rolePhoneInspectionReplyNatural\(content,fd,opts\.focus\)/);
  assert.match(online, /仍由你本人重新组织查看后的自然反应/);
  assert.match(online, /一条或多条由你决定/);
  assert.match(online, /return false/);
  assert.match(cohab, /rolePhoneInspectionReplyNatural/);
  assert.match(cohab, /不能使用固定汇报模板/);
  assert.match(cohab, /一段还是多句由你自己决定/);
  assert.doesNotMatch(online + cohab, /rolePhoneInspectionExactSummary/);
});

test('private companion inspection context is scoped away from ordinary chat replies', () => {
  assert.match(app, /const companionPrompt=companionRolePrompt\(c,opt\)/);
  assert.match(app, /companionRolePrompt=function\(c,opt\)/);
  assert.match(app, /if\(!inspection\)return companionRoleControlOnlyPrompt\(c,config\)/);
  assert.match(functionSource('doSpyViewCore'), /companionInspection:true/);
  assert.match(functionSource('queueNativeInspection'), /lu\._phoneInspectionUsed=true/);
});

test('native all-data read crosses HealthKit authorization and uses the report extension outside direct-data regions', () => {
  const sync = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'CompanionSyncView.swift'), 'utf8');
  const rootView = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'SmallPhonePrivateRootView.swift'), 'utf8');
  assert.match(sync, /wantsHealth, !wellnessService\.healthSyncEnabled/);
  assert.match(sync, /await wellnessService\.setHealthSyncEnabled\(true\)/);
  assert.match(sync, /authorizationStatus == \.approved[\s\S]{0,100}fetchTodayExtensionUsage/);
  assert.match(sync, /report\.today\.request\.v3/);
  assert.match(sync, /shared\.requestID == request\.requestID/);
  assert.match(sync, /readErrors\["battery"\]/);
  assert.match(rootView, /DeviceActivityReport\(reportContext, filter: todayFilter\)/);
  assert.match(rootView, /companionUsageReportRefreshRequested/);
});

test('all-data read cannot let the role speak before the same native session is complete', () => {
  const nativeSnapshot = functionSource('companionNativeSnapshot');
  const nativePull = functionSource('companionRolePullNativeSnapshot');
  const latest = functionSource('companionRolePullLatest');
  const intent = functionSource('maybeSpyIntent');
  assert.match(nativeSnapshot, /companionRoleAllFocus\(focus\)[\s\S]*raw\.readComplete!==true/);
  assert.match(nativePull, /raw\.readSessionId/);
  assert.match(nativePull, /st\.readFinishedAt=companionTime\(raw\.readFinishedAt\)/);
  assert.match(nativePull, /st\.readComplete=raw\.readComplete===true/);
  assert.match(nativePull, /st\.readOutcomes=raw\.readOutcomes/);
  assert.match(latest, /st\.readComplete!==true/);
  assert.match(latest, /companionRoleAllFocus\(st\.requestedFocus\)/);
  assert.match(latest, /now-st\.readFinishedAt>60000/);
  assert.match(intent, /opt\.nativeOnly/);
  assert.match(functionSource('queueNativeInspection'), /opt\.immediate\?120:6500/);
  assert.match(intent, /queueNativeInspection/);
  assert.match(functionSource('queueNativeInspection'), /_nativeInspectionPending\.add/);
  assert.match(functionSource('queueNativeInspection'), /rolePhoneInspectionBump/);

  const chatEarlyGate = app.indexOf('const _nativeUserInspectionQueued=');
  const chatModel = app.indexOf('wechatPrimaryReply(', chatEarlyGate);
  assert.ok(chatEarlyGate >= 0 && chatModel > chatEarlyGate, 'direct user read intent must stop before ordinary chat generation');
  const chatQueue = app.indexOf('const _nativeInspectionQueued=maybeSpyIntent');
  const chatGuard = app.indexOf('guardUnverifiedRolePhoneReply(content,note)', chatQueue);
  assert.ok(chatQueue >= 0 && chatGuard > chatQueue);
  assert.match(app.slice(chatQueue, chatGuard), /if\(_nativeInspectionQueued\).*return true/);
  assert.match(functionSource('aiReply'), /nativeInspectionPending\(_lu,id\)/);
  assert.doesNotMatch(functionSource('aiReply'), /if\(rolePhoneInspectionBlocksOrdinary\(id\)\)return/);
  assert.match(functionSource('aiReply'), /queueNativeInspection\(id,_lu,_phoneGuard\.focus/);

  const callQueue = app.indexOf('const _nativeCallInspectionQueued=!_screenShareEvent&&!_inspectionCompletion&&!_videoVision&&maybeSpyIntent');
  const callGuard = app.indexOf("guardUnverifiedRolePhoneReply(content,'')", callQueue);
  assert.ok(callQueue >= 0 && callGuard > callQueue);
  assert.match(app.slice(callQueue, callGuard), /if\(_nativeCallInspectionQueued\)/);

  const callEarlyGate = app.indexOf('const _nativeCallUserInspectionQueued=');
  const callModel = app.indexOf('let content=await chatAPI', callEarlyGate);
  assert.ok(callEarlyGate >= 0 && callModel > callEarlyGate, 'direct user read intent must stop before ordinary call generation');
  assert.match(functionSource('callAI'), /_inspectionCompletion/);
  assert.match(functionSource('callAI'), /rolePhoneInspectionGenerationStale\(c\.id,_inspectionStartEpoch\)/);
  assert.match(functionSource('doSpyViewCore'), /await callAI\(cn,\{inspectionCompletion:true\}\)/);
  assert.match(functionSource('offAI'), /directInspection/);
  assert.match(functionSource('offAI'), /rolePhoneInspectionGenerationStale/);
});

test('natural all-data wording enters the gate before any model reply', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    function rolePhoneTelemetryCategories(){return [];}
    function rolePhoneFocusFromCategories(){return '';}
    ${functionSource('companionInspectionFocusFromText')}
    ${functionSource('userPersonalAppUseStatement')}
    ${functionSource('companionInspectionRequestFromUser')}
    this.focus=companionInspectionFocusFromText;
    this.request=companionInspectionRequestFromUser;
  `, context);
  for (const phrase of [
    '你再刷一次快点，我在测试查一次所有的',
    '再刷一遍全部数据',
    '重新检查所有项目',
    '把完整的内容都读取一下',
  ]) {
    assert.equal(context.focus(phrase), 'iPhone全部数据', phrase);
    assert.equal(context.request(phrase), 'iPhone全部数据', phrase);
  }
  assert.equal(context.request('先别查所有数据'), '');
  assert.equal(context.request('我们刚才聊到所有数据'), '');
});

test('native completion receipt is written only after every requested reader has settled', () => {
  const sync = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'CompanionSyncView.swift'), 'utf8');
  const errors = sync.indexOf('snapshot["readErrors"] = readErrors');
  const outcomes = sync.indexOf('snapshot["readOutcomes"] = [', errors);
  const finished = sync.indexOf('snapshot["readFinishedAt"] = iso8601(Date())', outcomes);
  const complete = sync.indexOf('snapshot["readComplete"] = true', finished);
  const returned = sync.indexOf('return snapshot', complete);
  assert.ok(errors >= 0 && outcomes > errors && finished > outcomes && complete > finished && returned > complete);
});

test('background controller schema is installed before unified push claims it', () => {
  const migration = readFileSync(join(root, 'supabase', 'migrations', '202608110002_private_phone_companion_controller.sql'), 'utf8');
  for (const column of ['controller_user_id', 'controller_kind', 'controller_instance_id', 'controller_claimed_at']) {
    assert.match(migration, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(migration, /claim_private_phone_companion_controller/);
});

test('role usage facts never expose a configured limit as actual use', () => {
  const context = vm.createContext({
    state: {
      screenTimeAvailable: true,
      screenTimeMode: 'per_app',
      screenTimeSec: 11 * 3600 + 52 * 60,
      usageDay: '2026-08-11',
      usageGeneratedAt: 1,
      readSessionId: 'read-session-1',
      apps: [{ name: '抖音', usedSec: 5 * 60, limitMin: 120 }],
    },
  });
  vm.runInContext(`
    function companionRoleReadsExternal(){return true;}
    function companionRoleDataState(){return state;}
    function companionDuration(sec){sec=Math.floor(sec);const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60);return h?h+'小时'+m+'分钟':m+'分钟';}
    function fmtDT(){return '采集时间';}
    ${functionSource('companionRoleScreenTimeText')}
    this.read=companionRoleScreenTimeText;
  `, context);
  const text = context.read({});
  assert.match(text, /总屏幕使用 11小时52分钟/);
  assert.match(text, /抖音：实际使用 5分钟/);
  assert.doesNotMatch(text, /120|限额/);
  assert.doesNotMatch(functionSource('companionRoleLocationText'), /curLoc/);
});

test('inspection consistency guard rejects invented 78-step and 120-minute numbers', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    ${functionSource('rolePhoneInspectionNumbers')}
    ${functionSource('rolePhoneInspectionReplySafe')}
    this.safe=rolePhoneInspectionReplySafe;
  `, context);
  const fact = { data: '步数 497 步；最近睡眠 9小时46分钟；抖音实际使用 5分钟' };
  assert.equal(context.safe('步数497步，睡眠9小时46分钟，抖音5分钟。', fact), true);
  assert.equal(context.safe('步数78步，睡眠0分钟，抖音卡着120分钟。', fact), false);
});

test('telemetry wording starts a real read instead of claiming a failed refresh', () => {
  const context = vm.createContext({ String, Set });
  vm.runInContext(`
    let lane=false;
    function rolePhoneInspectionLaneActive(){return lane;}
    ${functionSource('rolePhoneTelemetryCategories')}
    ${functionSource('rolePhoneTelemetryClaim')}
    ${functionSource('rolePhoneAutomationScopes')}
    ${functionSource('rolePhoneFocusFromCategories')}
    ${functionSource('guardUnverifiedRolePhoneReply')}
    ${functionSource('companionInspectionFocusFromText')}
    this.guard=guardUnverifiedRolePhoneReply;
    this.focus=companionInspectionFocusFromText;
  `, context);
  const falseResult = context.guard('步数和屏幕时间，这次没刷出来，你手表又没戴吧。', '');
  assert.equal(falseResult.content, '我先实际看一眼。');
  assert.equal(falseResult.focus, 'iPhone全部数据');
  const ordinary = context.guard('我在，你慢慢说。', '');
  assert.equal(ordinary.content, '我在，你慢慢说。');
  assert.equal(ordinary.focus, '');
  assert.equal(context.focus('我看看步数和屏幕使用时间。'), 'iPhone全部数据');
  assert.equal(context.focus('我看看最新心率。'), 'iPhone最新心率');
});

test('critical-battery automation cannot invent screen, steps or watch state', () => {
  const context = vm.createContext({ String, Set });
  vm.runInContext(`
    function rolePhoneInspectionLaneActive(){return false;}
    ${functionSource('rolePhoneTelemetryCategories')}
    ${functionSource('rolePhoneTelemetryClaim')}
    ${functionSource('rolePhoneAutomationScopes')}
    ${functionSource('rolePhoneFocusFromCategories')}
    ${functionSource('guardUnverifiedRolePhoneReply')}
    this.guard=guardUnverifiedRolePhoneReply;
  `, context);
  const note = '【主动排队基线|0|companion-criticalBattery】';
  const result = context.guard('电量5%，快没了，充电线插上。\n步数和屏幕时间没刷出来，你手表没戴吧。', note);
  assert.equal(result.content, '电量5%，快没了，充电线插上。');
  assert.equal(result.focus, '');
});

test('ordinary phone activity does not leak cached real-device telemetry', () => {
  const activity = functionSource('myActivity');
  assert.doesNotMatch(activity, /companionRoleLocationText|companionRoleScreenTimeText/);
  assert.match(activity, /const liveBattery=webBatteryFactText\(\)/);
  assert.doesNotMatch(activity, /!privatePhoneAccountAvailable\(\)&&S\.me\.battery/);
  assert.match(app, /没有本次读取编号，也没有执行新的设备采集/);
  assert.match(app, /不得说“没刷新、没刷出来、没同步、没戴手表、读取不到”/);
});

test('role intent recognizer includes every native telemetry category', () => {
  const parser = functionSource('maybeSpyIntent');
  for (const word of ['屏幕使用时间', '睡眠', '步数', '心率', '心电', 'HRV', '电量']) {
    assert.match(parser, new RegExp(word));
  }
  assert.match(parser, /companionInspectionFocusFromText/);
  assert.match(app, /guardUnverifiedRolePhoneReply\(content,note\)/);
  assert.match(functionSource('aiReply'), /queueNativeInspection\(id,_lu,_phoneGuard\.focus/);
  assert.match(app, /guardUnverifiedRolePhoneReply\(content,''\)/);
  assert.match(functionSource('callAI'), /queueNativeInspection\(c\.id,_luc,_callPhoneGuard\.focus/);
  assert.match(functionSource('doSpyViewCore'), /!opts\.bySheTold&&!opts\.forceResult/);
});

test('native management records explicit unlock events for the web role', () => {
  const content = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'ContentView.swift'), 'utf8');
  const sync = readFileSync(join(root, 'native', 'private-small-phone', 'XcodeProject', 'PhoneCompanionTest', 'CompanionSyncView.swift'), 'utf8');
  assert.match(content, /recordExplicitManualUnlock\(\[token\]\)/);
  assert.match(content, /recordExplicitManualUnlock\([\s\S]{0,80}lockedAppTokens/);
  assert.match(sync, /"kind": "manualUnlock"/);
  assert.match(sync, /"explicit": true/);
  assert.match(sync, /snapshot\["automationEvents"\]/);
});

test('control-only wake snapshots preserve last-known dynamic data', () => {
  assert.match(app, /controlOnly=snapshot\.controlOnly===true/);
  assert.match(app, /app\.usedSec=Math\.max\(0,\+old\.usedSec\|\|0\)/);
  assert.match(app, /st\.screenTimeSec=prior\.screenTimeSec/);
  assert.match(app, /st\.dynamicSync=prior\.dynamicSync/);
  assert.match(app, /st\.location=prior\.location/);
  assert.match(app, /st\.health=controlOnly&&!snapshot\.health\?prior\.health/);
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

test('binding waits for durable storage and refreshes only the companion panel', () => {
  const bind = functionSource('companionBindExternal');
  const refresh = functionSource('companionRefreshPanel');
  assert.match(bind, /await saveNowAsync\(\)/);
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
  assert.equal(all.text, '全部内外 App');
  assert.equal(all.scope, 'both');
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
  assert.equal(context.state({ lastSync: 4, commands: [] }, appRow, 120005).kind, 'snapshotStale');
  const durableConfirmation = { lastSync: 4, commands: [{ action: 'lock', externalAppId: 'ios.trip', status: 'completed', ts: 3 }] };
  assert.equal(context.state(durableConfirmation, appRow, 120005).kind, 'confirmed');
  assert.equal(context.state({ commands: [{ action: 'lock', externalAppId: 'ios.trip', status: 'pending', ts: 2 }] }, appRow, 900003).kind, 'expired');
  const decorate = functionSource('companionDecoratePage');
  assert.match(decorate, /commandState\.kind==='snapshotStale'/);
  assert.match(decorate, /companion-app-pending/);
  assert.doesNotMatch(functionSource('companionApplyServerPayload'), /snapshot\.generatedAt\)\|\|Date\.now\(\)/);
  assert.match(app, /网页接受命令不等于设备执行成功/);
});

test('snapshot conflict copy reports a configuration mismatch without claiming enforcement', () => {
  assert.match(app, /锁定配置未写入：iPhone 新快照未含锁/);
  assert.match(app, /解锁配置未移除：iPhone 新快照仍含锁/);
  assert.match(app, /percent=Math\.max\(0,/);
});

test('the companion page refreshes immediately after returning to the foreground', () => {
  assert.match(app, /function privateResumeSyncSoon\(\)[\s\S]{0,320}companionPollSnapshot\(true\)/);
  assert.match(app, /visibilitychange[\s\S]{0,1200}privateResumeSyncSoon\(\)/);
  assert.match(app, /pageshow[\s\S]{0,700}privateResumeSyncSoon\(\)/);
  assert.match(functionSource('companionPollSnapshot'), /document\.hidden/);
});

test('external name matching prefers the longest overlapping app name', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionMentionedExternalTargets')}\nthis.pick=companionMentionedExternalTargets;`, context);
  const state = { apps: [{ id: 'ios.qq', name: 'QQ' }, { id: 'ios.qqmusic', name: 'QQ音乐' }] };
  assert.deepEqual(Array.from(context.pick(state, '把 QQ音乐 锁上'), x => x.id), ['ios.qqmusic']);
});

test('natural GPT alias resolves uniquely to the ChatGPT stable id', () => {
  const context = vm.createContext({});
  vm.runInContext(`${functionSource('companionMentionedExternalTargets')}\nthis.pick=companionMentionedExternalTargets;`, context);
  const state = { apps: [
    { id: 'ios.chatgpt', name: 'ChatGPT' },
    { id: 'ios.deepseek', name: 'DeepSeek' },
  ] };
  assert.deepEqual(Array.from(context.pick(state, 'GPT给你开了'), x => x.id), ['ios.chatgpt']);
});

test('an indirect unlock inherits one recent app but refuses an ambiguous group', () => {
  const context = vm.createContext({ rows: [
    { role: 'assistant', content: 'ChatGPT先关着。' },
    { role: 'user', content: '我想查资料。' },
  ] });
  vm.runInContext(`
    function msgs(){return rows;}
    function msgToText(row){return row.content||'';}
    ${functionSource('companionAllExternalIntent')}
    ${functionSource('companionMentionedExternalTargets')}
    ${functionSource('companionExternalTargetsByText')}
    ${functionSource('companionRoleReferenceCount')}
    ${functionSource('companionLatestUserText')}
    ${functionSource('companionRecentExternalGroup')}
    ${functionSource('companionRecentUniqueExternal')}
    function companionScope(value){return value==='external'||value==='internal'||value==='both'?value:'';}
    ${functionSource('companionRoleRequestedScope')}
    ${functionSource('companionResolveRoleActionTarget')}
    this.resolve=companionResolveRoleActionTarget;
  `, context);
  const state = { defaultScope: 'external', apps: [
    { id: 'ios.chatgpt', name: 'ChatGPT' },
    { id: 'ios.deepseek', name: 'DeepSeek' },
  ] };
  assert.equal(context.resolve(state, { id: 'role' }, '这个先放你用', '乖，给你开了。').text, 'ChatGPT');
  context.rows.unshift({ role: 'assistant', content: 'ChatGPT和DeepSeek都关着。' });
  context.rows.splice(1);
  assert.equal(context.resolve(state, { id: 'role' }, '给你解一个', '先放你用。').resolved, false);
});

test('a definite single-app natural unlock is recovered before the auxiliary model parser', () => {
  const context = vm.createContext({});
  vm.runInContext(`
    const sent=[];
    const state={linked:true,roleAccess:true,permissions:{appControl:true},apps:[{id:'ios.douyin',name:'抖音'}]};
    function companionState(){return state;}
    function companionReady(){return true;}
    function companionResolveRoleActionTarget(){return {text:'抖音',scope:'external',resolved:true};}
    function companionRoleScopeForText(){return 'external';}
    function companionDispatchRoleByText(action,target){sent.push({action,target});return true;}
    ${functionSource('companionMentionedExternalTargets')}
    ${functionSource('companionNaturalTargetedUnlockTarget')}
    ${functionSource('companionRecoverNaturalTargetedUnlock')}
    this.recover=companionRecoverNaturalTargetedUnlock;
    this.sent=sent;
  `, context);
  assert.equal(context.recover('行，抖音给你解开了。', { name: '角色' }), true);
  assert.deepEqual(Array.from(context.sent, x => `${x.action}:${x.target}`), ['unlock:抖音']);
  assert.equal(context.recover('抖音解锁失败了。', { name: '角色' }), false);
  assert.equal(context.recover('等你写完作业再把抖音解开。', { name: '角色' }), false);
  assert.equal(context.recover('要我把抖音解开吗？', { name: '角色' }), false);
  assert.equal(context.sent.length, 1);
  const recover = functionSource('companionRecoverNaturalTargetedUnlock');
  const extract = functionSource('extractControl');
  assert.match(recover, /companionNaturalTargetedUnlockTarget/);
  assert.match(recover, /companionDispatchRoleByText\('unlock'/);
  assert.match(extract, /companionRecoverNaturalTargetedUnlock\(reply,c\)/);
  assert.match(functionSource('companionNaturalTargetedUnlockTarget'), /给你开了/);
  assert.match(functionSource('companionNaturalTargetedUnlockTarget'), /失败/);
});

test('queued companion commands request APNs wake without treating push as the receipt', () => {
  const send = functionSource('companionSendCommand');
  assert.match(send, /await companionNotifyNative\(id\)/);
  assert.match(send, /wakeStatus=wake\.pushed\?'pushed':'queued'/);
  assert.match(send, /wake\.reason==='no-token'/);
  assert.match(send, /companionScheduleCommandPoll\(\)/);
  assert.doesNotMatch(functionSource('companionNotifyNative'), /status\s*=\s*['"]completed/);
  assert.match(functionSource('companionPollMinDelay'), /4000/);
  assert.match(functionSource('companionAudit'), /后台唤醒未确认/);
  assert.match(app, /setInterval\(\(\)=>\{if\(_appBootFinished\)companionPollSnapshot\(false\);\},8000\)/);
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
    function companionSendCommand(st,action,app,opt){sent.push({action,id:app.id,scope:opt.scope,by:opt.by});}
    ${functionSource('companionDispatchRoleExternal')}
    this.run=companionDispatchRoleExternal;
    this.sent=sent;
    this.state=state;
  `, context);
  const result = context.run('lock', { id: 'ios.stable.douyin', name: '抖音' }, { actor: '角色' });
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(context.sent, x => `${x.action}:${x.id}:${x.scope}:${x.by}`), ['lock:ios.stable.douyin:external:role']);
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
  assert.match(phone, /v824 伴生后台唤醒与自然解锁/);
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

test('a role-read usage snapshot remains authoritative across foreground and background replies', () => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).replaceAll('/', '-');
  const state = {
    screenTimeAvailable: true,
    usageDay: today,
    usageTimeZone: 'Asia/Shanghai',
    usageRevision: 7,
    usageGeneratedAt: Date.now(),
    screenTimeSec: 7 * 3600 + 30 * 60,
    apps: [{ name: '抖音', usedSec: 3 * 3600 + 42 * 60 }, { name: '微信', usedSec: 55 * 60 }],
  };
  const context = vm.createContext({ state, Intl, Date, Math, Number, Object, String, Array });
  vm.runInContext(`
    function replyDedupNorm(v){return String(v||'').toLowerCase();}
    function companionRoleDataState(){return state;}
    ${functionSource('companionUsageDayAt')}
    ${functionSource('companionDuration')}
    ${functionSource('rolePhoneInspectionKey')}
    ${functionSource('rolePhoneUsageSnapshotFromInspection')}
    ${functionSource('rolePhoneUsageAppsKey')}
    ${functionSource('rolePhoneInspectionSignature')}
    ${functionSource('rolePhoneInspectionUnchanged')}
    ${functionSource('rolePhoneAuthoritativeUsage')}
    ${functionSource('rolePhoneAuthoritativeUsageContext')}
    ${functionSource('rolePhoneUsageClaimMinutes')}
    ${functionSource('rolePhoneUsageConflict')}
    ${functionSource('rolePhoneUsageStripConflicts')}
    this.fact=rolePhoneInspectionSignature({},'屏幕使用时长',{label:'屏幕使用时长',data:'今日屏幕总使用 7小时30分钟；逐 App：抖音 3小时42分钟'});
    this.contact={_phoneInspectionFacts:{'screen-time':{hash:this.fact.hash,ts:Date.now(),usage:this.fact.usage}}};
    this.truth=rolePhoneAuthoritativeUsageContext(this.contact);
    this.same=rolePhoneInspectionUnchanged(this.contact,this.fact);
    this.oldSame=rolePhoneInspectionUnchanged({_phoneInspectionFacts:{'screen-time':{hash:this.fact.hash,usage:{...this.fact.usage,apps:[{name:'抖音',usedSec:169*60}]}}}},this.fact);
    this.oldConflict=rolePhoneUsageConflict(this.contact,'抖音169分钟。');
    this.currentConflict=rolePhoneUsageConflict(this.contact,'抖音3小时42分钟。');
    this.historicalConflict=rolePhoneUsageConflict(this.contact,'之前抖音169分钟。');
    this.cleaned=rolePhoneUsageStripConflicts(this.contact,'先问你一件事。\\n抖音169分钟。');
  `, context);
  assert.equal(context.fact.usage.apps[0].usedSec, 3 * 3600 + 42 * 60);
  assert.match(context.truth, /抖音 3小时42分钟/);
  assert.equal(context.same, true);
  assert.equal(context.oldSame, false);
  assert.equal(context.oldConflict, true);
  assert.equal(context.currentConflict, false);
  assert.equal(context.historicalConflict, false);
  assert.equal(context.cleaned, '先问你一件事。');
  assert.match(functionSource('roleServerPushRecentContext'), /rolePhoneAuthoritativeUsageContext\(c\)/);
  assert.match(functionSource('initiativeGroundingContext'), /rolePhoneAuthoritativeUsageContext\(c\)/);
  assert.match(functionSource('aiReply'), /rolePhoneUsageConflict\(c,content\)/);
});
