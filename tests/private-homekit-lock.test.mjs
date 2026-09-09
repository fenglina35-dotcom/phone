import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const nativeRoot=path.join(root,'native','private-small-phone');
const xcodeRoot=path.join(nativeRoot,'XcodeProject','PhoneCompanionTest');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const swift=fs.readFileSync(path.join(xcodeRoot,'HomeKitLockBridge.swift'),'utf8');
const bridge=fs.readFileSync(path.join(xcodeRoot,'PhoneNativeBridge.swift'),'utf8');
const info=fs.readFileSync(path.join(xcodeRoot,'Info.plist'),'utf8');
const privateSource=fs.readFileSync(path.join(nativeRoot,'Resources','Web','private-smart-lock.js'),'utf8');
const bundledSource=fs.readFileSync(path.join(xcodeRoot,'PhoneWeb.bundle','private-smart-lock.js'),'utf8');
const privateCss=fs.readFileSync(path.join(nativeRoot,'Resources','Web','private-smart-lock.css'),'utf8');
const privateIndex=fs.readFileSync(path.join(xcodeRoot,'PhoneWeb.bundle','index.html'),'utf8');
const privateApp=fs.readFileSync(path.join(xcodeRoot,'PhoneWeb.bundle','app.js'),'utf8');

test('lock bridge discovers HomeKit locks and freshly reads current state',()=>{
  assert.match(swift,/HMServiceTypeLockMechanism/);
  assert.match(swift,/HMCharacteristicTypeCurrentLockMechanismState/);
  assert.match(swift,/HMCharacteristicTypeTargetLockMechanismState/);
  assert.match(swift,/readValue\(candidate\)/);
  assert.match(swift,/"complete"\] = state\["currentStateRaw"\] != nil/);
});

test('unlock is Face ID only, gated by known state, and never uses passcode fallback',()=>{
  assert.match(swift,/currentRaw == 0 \|\| currentRaw == 1/);
  assert.match(swift,/\.deviceOwnerAuthenticationWithBiometrics/);
  assert.match(swift,/context\.biometryType == \.faceID/);
  assert.doesNotMatch(swift,/deviceOwnerAuthentication(?!WithBiometrics)/);
  assert.match(info,/NSFaceIDUsageDescription/);
});

test('lock commands require matching fresh readback before success',()=>{
  assert.match(swift,/verifyReadback\(/);
  assert.match(swift,/state\["currentStateRaw"\] as\? Int == expectedRaw/);
  assert.match(swift,/"verified": true/);
  assert.match(swift,/homekit_lock_readback_mismatch/);
  assert.match(swift,/不能判定成功/);
});

test('events preserve known event time and never invent a time during reconciliation',()=>{
  const live=swift.slice(swift.indexOf('func accessory('),swift.indexOf('private func reconcileSnapshot'));
  const reconcile=swift.slice(swift.indexOf('private func reconcileSnapshot'),swift.indexOf('private func targetKey'));
  assert.match(live,/"timing": "known"/);
  assert.match(live,/"eventAt": now/);
  assert.match(reconcile,/"timing": "unknown"/);
  assert.match(reconcile,/"observedAt": observedAt/);
  assert.doesNotMatch(reconcile,/"eventAt"/);
  assert.match(swift,/smallPhone\.homeKitLockEvents\.v1/);
  assert.match(swift,/enableNotification\(true\)/);
});

test('native bridge preserves lock snapshot, command, event drain, and ack on contract 37',()=>{
  for(const action of ['homekit.locks.snapshot','homekit.lock.command','homekit.locks.events','homekit.locks.events.ack'])assert.match(bridge,new RegExp(action.replaceAll('.','\\.')));
  assert.match(bridge,/static let contractVersion = 37/);
  assert.match(bridge,/small-phone-homekit-lock-event/);
});

test('door-lock overlay is private-only and bundled after the shared smart-home module',()=>{
  assert.equal(bundledSource,privateSource);
  assert.equal(
    fs.readFileSync(path.join(xcodeRoot,'PhoneWeb.bundle','private-smart-lock.css'),'utf8'),
    fs.readFileSync(path.join(nativeRoot,'Resources','Web','private-smart-lock.css'),'utf8')
  );
  assert.match(privateIndex,/private-smart-lock\.css\?v=339/);
  assert.match(privateIndex,/smart-home\.js[^\n]+\n<script src="private-smart-lock\.js\?v=339"/);
  assert.equal(read('小手机.html').includes('private-smart-lock'),false);
  assert.equal(read('app.js').includes('homekit.locks.snapshot'),false);
  assert.equal(read('smart-home.js').includes('homekit.lock.command'),false);
});

function runtime(){
  const calls=[];let queued='',route={p:'wxsmarthome'};
  const context={console,Date,Promise,Math,JSON,String,Number,Array,Object,Set,RegExp,
    S:{settings:{},couple:{cid:'role-1'},me:{name:'小北'},messages:{}},
    document:{hidden:false,addEventListener(){}},
    setTimeout(){return 1;},setInterval(){return 1;},clearTimeout(){},
    save(){},cur(){return route;},render(){},toast(){},
    getC(){return{id:'role-1',name:'角色',deleted:false,blocked:false};},
    scheduleFeatureReply(id,note){queued=note;return id==='role-1';},
    featureEventNote(kind,detail){return kind+'\n'+detail;},
    roleVisibleEnvelopeText(value){return String(value||'');},
    renderWxSmartHome(){return '<div><p class="wx-smart-home-foot">说明</p></div>';},
    smartHomeRolePrompt(){return '灯提示';},
    async smartHomeRoleFinalize(content){return{content,matched:false};},
    SmallPhoneNative:{async request(action,payload){calls.push({action,payload});return{ok:true};}},
    __SMALL_PHONE_PRIVATE__:true
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(privateSource,context,{filename:'private-smart-lock.js'});
  return{context,calls,queued:()=>queued,setRoute(next){route=next;}};
}

test('light and lock are independent pages and the existing light page remains untouched',()=>{
  const r=runtime();
  r.context.__privateSmartLockTest.applySnapshot({ok:true,locks:[{accessoryId:'a',serviceId:'s',accessoryName:'Claude门',roomName:'入口',reachable:true,complete:true,currentState:'locked',battery:100,model:'ZNMS02ES',firmware:'1.1.39'}]});
  const chooser=r.context.renderWxSmartHome();
  assert.match(chooser,/选择设备/);
  assert.match(chooser,/卧室小灯/);
  assert.match(chooser,/Claude门/);
  assert.match(chooser,/device-shape lamp/);
  assert.match(chooser,/door-card locked/);
  r.setRoute({p:'wxsmarthome',device:'light'});
  assert.equal(r.context.renderWxSmartHome(),'<div><p class="wx-smart-home-foot">说明</p></div>');
  r.setRoute({p:'wxsmarthome',device:'lock'});
  const page=r.context.renderWxSmartHome();
  assert.match(page,/Claude门/);
  assert.match(page,/已锁/);
  assert.match(page,/100%/);
  assert.match(page,/ZNMS02ES/);
  assert.match(page,/Face ID 解锁/);
  assert.match(page,/private-lock-state locked/);
  assert.match(page,/class="lock-button active"/);
  assert.match(page,/class="unlock-button /);
  assert.match(page,/private-lock-action-icon/);
  assert.match(page,/x="5" y="5" width="38" height="66"/);
  assert.match(page,/x="35" y="51" width="24" height="20"/);
  assert.match(page,/M41 51v-6a6 6 0 0 1 12 0v6/);
  assert.doesNotMatch(page,/入口/);
  assert.doesNotMatch(page,/卧室小灯/);
  assert.match(privateCss,/\.private-lock-state\.locked\{color:#ff5c64/);
  assert.match(privateCss,/\.private-lock-state\.unlocked\{color:#3bd589/);
  assert.match(privateCss,/\.private-lock-actions \.lock-button\{[^}]*color:#ff6a70/);
  assert.match(privateCss,/\.private-lock-actions \.unlock-button\{[^}]*color:#43d68d/);
});

test('lock display name is user configurable without changing the HomeKit accessory name',()=>{
  const r=runtime();
  r.context.__privateSmartLockTest.applySnapshot({ok:true,locks:[{accessoryId:'a',serviceId:'s',accessoryName:'Claude门',roomName:'入口',reachable:true,complete:true,currentState:'locked'}]});
  r.context.S.settings.smartHomeLock.displayName='回家门';
  assert.equal(r.context.__privateSmartLockTest.lockDisplayName(),'回家门');
  assert.match(r.context.__privateSmartLockTest.renderLockPage(),/回家门/);
  assert.doesNotMatch(r.context.__privateSmartLockTest.renderLockPage(),/入口/);
});

test('role action parser does not turn ordinary keywords into a command',()=>{
  const r=runtime(),api=r.context.__privateSmartLockTest;
  assert.equal(api.lockDecision('帮我开门',{id:'role-1'}),null);
  const decision=api.lockDecision('[智能家电|门锁|action=unlock]',{id:'role-1'});
  assert.equal(decision.valid,true);
  assert.equal(decision.action,'unlock');
  assert.equal(api.lockDecision('[智能家电|门锁|action=unlock]\n[智能家电|小灯|power=on]',{id:'role-1'}).valid,false);
});

test('door-lock action tags are removed again at the final visible-message boundary',()=>{
  const r=runtime(),api=r.context.__privateSmartLockTest;
  assert.equal(api.stripLockTags('[智能家电|门锁|action=unlock]'),'');
  assert.equal(api.stripLockTags('门开了。\n[智能家电|门锁|action=unlock]\n进来。'),'门开了。\n\n进来。');
  assert.match(privateApp,/function modelUnfilteredMessages\([^\n]+privateSmartLockStripTags/);
  assert.match(privateApp,/function cleanWechatVisibleLine\([^\n]+\n\s*let t=[^\n]+\n\s*if\(typeof privateSmartLockStripTags===['"]function['"]\)t=privateSmartLockStripTags\(t\)/);
});

test('a private upgrade removes already stored assistant action-tag bubbles without touching user text',()=>{
  const r=runtime(),api=r.context.__privateSmartLockTest;
  r.context.S.messages.main=[
    {role:'assistant',type:'text',content:'[智能家电|门锁|action=unlock]'},
    {role:'assistant',type:'text',content:'门开了。\n[智能家电|门锁|action=unlock]'},
    {role:'user',type:'text',content:'[智能家电|门锁|action=unlock]'}
  ];
  assert.equal(api.cleanupStoredLockTags(),true);
  assert.deepEqual(JSON.parse(JSON.stringify(r.context.S.messages.main)),[
    {role:'assistant',type:'text',content:'门开了。'},
    {role:'user',type:'text',content:'[智能家电|门锁|action=unlock]'}
  ]);
});

test('delayed event copy distinguishes occurrence time from observation time',async()=>{
  const r=runtime(),api=r.context.__privateSmartLockTest;
  const known={eventId:'known-1',accessoryName:'Claude门',currentState:'unlocked',timing:'known',eventAt:'2026-09-08T04:10:00Z',observedAt:'2026-09-08T04:10:00Z'};
  const unknown={eventId:'unknown-1',accessoryName:'Claude门',currentState:'unlocked',timing:'unknown',observedAt:'2026-09-08T05:20:00Z'};
  assert.match(api.eventKnownText(known),/原始状态时间是/);
  assert.match(api.eventKnownText(known),/状态回读或回调时间，不是独立门锁日志证明的物理操作瞬间/);
  assert.match(api.eventKnownText(known),/默认视为用户本人开的门/);
  assert.match(api.eventKnownText(known),/不是 HomeKit 识别出的操作者身份/);
  assert.match(api.eventUnknownText(unknown),/实际解锁时间无法确认/);
  assert.match(api.eventUnknownText(unknown),/只是恢复观察时间，不是实际发生时间/);
  assert.match(api.eventUnknownText(unknown),/默认视为用户本人开的门/);
  await api.processEvent(unknown);
  assert.match(r.queued(),/恢复连接时发现/);
  assert.equal(r.calls.some(x=>x.action==='homekit.locks.events.ack'),true);
});

test('only unlock events notify the role while lock state stays readable',async()=>{
  const r=runtime(),api=r.context.__privateSmartLockTest;
  api.applySnapshot({ok:true,locks:[{accessoryId:'a',serviceId:'s',accessoryName:'Claude门',reachable:true,complete:true,currentState:'locked'}]});
  const locked={eventId:'locked-1',accessoryName:'Claude门',currentState:'locked',timing:'known',eventAt:'2026-09-08T10:10:00Z',observedAt:'2026-09-08T10:10:00Z'};
  assert.equal(await api.processEvent(locked),false);
  assert.equal(r.queued(),'');
  assert.equal(r.calls.some(x=>x.action==='homekit.locks.events.ack'&&x.payload.eventIds[0]==='locked-1'),true);
  assert.match(r.context.smartHomeRolePrompt({id:'role-1'}),/当前由 HomeKit 刚回读的真实状态是“已锁”/);
});

test('a verified manual unlock notifies the role without turning a manual lock into a notification',async()=>{
  const r=runtime(),api=r.context.__privateSmartLockTest;
  api.applySnapshot({ok:true,locks:[{accessoryId:'a',serviceId:'s',accessoryName:'Claude门',reachable:true,complete:true,currentState:'locked'}]});
  r.context.SmallPhoneNative.request=async(action,payload)=>{
    if(action==='homekit.lock.command')return{ok:true,verified:true,verifiedAt:'2026-09-08T10:20:00Z',state:{accessoryId:'a',serviceId:'s',accessoryName:'Claude门',reachable:true,complete:true,currentState:payload.action==='unlock'?'unlocked':'locked'}};
    return{ok:true};
  };
  await r.context.privateSmartLockControl('unlock');
  assert.match(r.queued(),/由小手机真实回读为“已解锁”/);
  const lockedRuntime=runtime(),lockedApi=lockedRuntime.context.__privateSmartLockTest;
  lockedApi.applySnapshot({ok:true,locks:[{accessoryId:'a',serviceId:'s',accessoryName:'Claude门',reachable:true,complete:true,currentState:'unlocked'}]});
  lockedRuntime.context.SmallPhoneNative.request=async(action,payload)=>action==='homekit.lock.command'?{ok:true,verified:true,verifiedAt:'2026-09-08T10:21:00Z',state:{accessoryId:'a',serviceId:'s',accessoryName:'Claude门',reachable:true,complete:true,currentState:payload.action==='lock'?'locked':'unlocked'}}:{ok:true};
  await lockedRuntime.context.privateSmartLockControl('lock');
  assert.equal(lockedRuntime.queued(),'');
});

test('private release identity is iOS 349 while public web stays v1226',()=>{
  const webView=fs.readFileSync(path.join(xcodeRoot,'LocalPhoneWebView.swift'),'utf8');
  const project=fs.readFileSync(path.join(nativeRoot,'XcodeProject','PhoneCompanionTest.xcodeproj','project.pbxproj'),'utf8');
  assert.match(webView,/1\.0\.349 \(349\)/);
  assert.match(project,/CURRENT_PROJECT_VERSION = 349/);
  assert.match(project,/MARKETING_VERSION = 1\.0\.349/);
  assert.match(read('app.js'),/__NORTH_SHELL_BUILD__!==\'1226\'/);
});
