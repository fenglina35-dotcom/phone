import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'glass-theme.css'),'utf8');
const sync=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/CompanionSyncView.swift'),'utf8');
const bridge=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift'),'utf8');
const privateRoot=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/SmallPhonePrivateRootView.swift'),'utf8');
const screenShare=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/ScreenShareCoordinator.swift'),'utf8');
const appDelegate=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneCompanionTestApp.swift'),'utf8');
const location=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/LocationManager.swift'),'utf8');

function swiftFunction(source,name,nextName){
  const start=source.indexOf(`func ${name}(`);
  assert.notEqual(start,-1,`${name} is present`);
  const end=nextName?source.indexOf(`func ${nextName}(`,start+1):-1;
  return source.slice(start,end>=0?end:source.length);
}

test('private WKWebView does not create a backdrop compositor layer for every card and bubble',()=>{
  assert.match(css,/north-native-app\.north-glass-ui \.phone \*[\s\S]*?backdrop-filter:none!important/);
  assert.match(css,/north-native-app\.north-glass-ui \.phone \*::before/);
  assert.match(css,/north-native-app\.north-glass-ui \.phone \*::after/);
});

test('iPhone Safari and PWA receive the same compositor protection without changing Android',()=>{
  assert.match(app,/const NORTH_IOS_WEBKIT=/);
  assert.match(app,/classList\.toggle\('north-ios-webkit',NORTH_IOS_WEBKIT\)/);
  assert.match(css,/north-ios-webkit\.north-glass-ui \.phone \*[\s\S]*?backdrop-filter:none!important/);
  assert.doesNotMatch(css,/north-android\.north-glass-ui \.phone \*[\s\S]*?backdrop-filter:none!important/);
});

test('the lightweight native status poll does not repeatedly refresh Screen Time or HealthKit',()=>{
  assert.match(sync,/if wantsUsage \{\s*await refreshDataAccessState\(\)\s*\}/);
  assert.match(sync,/if wantsHealth \{\s*wellnessReadCompleted = await refreshWellnessWithTimeout/);
  assert.match(sync,/else \{\s*wellnessReadCompleted = true\s*\}/);
  assert.match(app,/companionNativeSnapshot\(\s*'\u72b6态'/);
});

test('unchanged companion timestamps do not rewrite the whole private core',()=>{
  assert.match(app,/function companionSnapshotPersistSignature\(st\)/);
  assert.match(app,/const st=companionState\(\),before=companionSnapshotPersistSignature\(st\)/);
  assert.match(app,/const after=companionSnapshotPersistSignature\(st\);if\(before!==after\)\{save\(\)/);
  assert.doesNotMatch(app,/JSON\.stringify\(\[st\.linked,st\.deviceId,st\.lastSync/);
  assert.match(app,/battery=st\.battery\?\{level:st\.battery\.level,state:st\.battery\.state,lowPower:/);
  assert.match(app,/automationEvents/);
});

test('companion persistence signature ignores refresh-only clocks but preserves real changes',()=>{
  const source=app.match(/function companionSnapshotPersistSignature\(st\)\{[^\r\n]+\}/)?.[0];
  assert.ok(source,'companionSnapshotPersistSignature source is present');
  const signature=vm.runInNewContext(`(${source})`);
  const base={
    linked:true,
    deviceId:'device-1',
    deviceName:'iPhone',
    screenTimeAvailable:true,
    screenTimeMode:'per_app',
    screenTimeSec:120,
    apps:[{id:'app-1',name:'App',usedSec:120,locked:false}],
    location:{lat:31.2,lng:121.4,accuracy:8,place:'家',ts:100},
    footprints:[{lat:31.2,lng:121.4,accuracy:8,place:'家',ts:100}],
    battery:{level:0.72,state:'充电中',lowPower:false,ts:100},
    health:{ts:100,steps:1234,heartRateBpm:72,heartRateAt:90},
    automationEvents:[],
    commands:[],
    readErrors:{}
  };
  const refreshed=structuredClone(base);
  refreshed.lastSync=999;
  refreshed.battery.ts=999;
  refreshed.health.ts=999;
  assert.equal(signature(base),signature(refreshed));

  const batteryChanged=structuredClone(refreshed);
  batteryChanged.battery.level=0.71;
  assert.notEqual(signature(base),signature(batteryChanged));
  const lockChanged=structuredClone(refreshed);
  lockChanged.apps[0].locked=true;
  assert.notEqual(signature(base),signature(lockChanged));
  const unlockEvent=structuredClone(refreshed);
  unlockEvent.automationEvents.push({id:'event-1',kind:'manualUnlock',externalAppId:'app-1',ts:888,explicit:true,delivered:false});
  assert.notEqual(signature(base),signature(unlockEvent));
});

test('native status snapshots batch stable app-token persistence and cache unchanged footprints',()=>{
  assert.match(sync,/let selectedApps: \[\(token: ApplicationToken, externalID: String\)\]/);
  assert.match(sync,/rememberTokens\(selectedApps\)/);
  assert.match(sync,/private func rememberTokens\([\s\S]*?guard changed else \{ return \}[\s\S]*?UserDefaults\.standard\.set\(registry/);
  assert.match(sync,/guard registry\[externalID\] != data else \{ return \}/);
  assert.match(sync,/if data == cachedFootprintData \{\s*return cachedTodayPoints\s*\}/);
});

test('idle clock work skips hidden pages and never rebuilds an unchanged lock-screen SVG mask',()=>{
  assert.match(app,/function northUiClockTick\(\)\{if\(typeof document!==['"]undefined['"]&&document\.hidden\)return/);
  assert.match(app,/function renderLockClock\(force\)[\s\S]*?_lockClockPaintKey===key[\s\S]*?return/);
  assert.match(app,/if\(b\.textContent!==value\)b\.textContent=value/);
  assert.match(app,/setInterval\(northUiClockTick,10000\)/);
});

test('large private saves and cloud backups are not repeated while the user is interacting',()=>{
  assert.match(app,/_useSaveT>60000/);
  assert.match(app,/PRIVATE_PHONE_AUTO_BACKUP_DELAY=30\*60\*1000/);
  assert.match(app,/Date\.now\(\)-_privatePhoneLastInteractionAt<90000/);
  assert.match(app,/function privatePhoneCloudWake\(\)[\s\S]*?privatePhoneCloudSchedule\(PRIVATE_PHONE_AUTO_BACKUP_DELAY\)/);
  assert.doesNotMatch(app,/privatePhoneCloudAutoBackup\(\),6000/);
});

test('motion step tracking never saves at the sensor callback rate',()=>{
  const start=app.indexOf('function stepMotion(');
  const end=app.indexOf('async function toggleSteps(',start);
  assert.notEqual(start,-1,'stepMotion is present');
  assert.notEqual(end,-1,'toggleSteps follows stepMotion');
  const motion=app.slice(start,end);
  assert.match(app,/function queueStepSave\(\)\{_stepDirty=true;if\(!_stepSaveTimer\)_stepSaveTimer=setTimeout\(flushStepSave,5000\);\}/);
  assert.match(motion,/const stepped=/);
  assert.match(motion,/if\(stepped\)[\s\S]*?queueStepSave\(\)/);
  assert.match(motion,/now-_stepDayCheckAt>=60000/);
  assert.doesNotMatch(motion,/save\s*\(/);
  assert.doesNotMatch(app,/if\(now-_stepLast>4000\)save\(\)/);
  assert.match(app,/visibilitychange'\s*,\(\)=>\{if\(document\.hidden\)flushStepSave\(\);\}/);
});

test('resume listeners collapse duplicate forced native and inbox pulls',()=>{
  assert.match(app,/function companionPollMinDelay\(\)[\s\S]*?:60000/);
  assert.match(app,/companionPollSnapshot\(force\)[\s\S]*?minDelay=force\?5000:companionPollMinDelay\(\)/);
  assert.match(app,/roleServerPushPull\(force\)[\s\S]*?minDelay=force\?5000:45000/);
  assert.match(app,/function privateResumeSyncSoon\(\)[\s\S]*?companionPollSnapshot\(true\);roleServerPushPull\(true\)/);
  assert.doesNotMatch(app,/setTimeout\(\(\)=>companionPollSnapshot\(true\),960\)/);
});

test('private saves avoid repeated full chat serialization on the tap path',()=>{
  assert.match(app,/function messageArchiveStamp\(store\)/);
  assert.match(app,/_heavyReady\.has\('messages'\)&&_heavyStamp\.messages===stamp/);
  assert.match(app,/requestIdleCallback\(\(\)=>\{_saveIdleHandle=0;if\(_savePending\)saveNow\(\)/);
  assert.match(app,/const PRIVATE_NATIVE_SAVE_GAP_MS=15000/);
  assert.match(app,/gap=native&&requested>0&&_saveLast\?Math\.max\(0,PRIVATE_NATIVE_SAVE_GAP_MS-\(Date\.now\(\)-_saveLast\)\):0/);
  assert.match(app,/native&&requested>0\?Math\.max\(700,requested,gap\):requested/);
});

test('inactive native helpers do not keep waking the main thread',()=>{
  assert.match(screenShare,/schedulePoll\(after: 4\)/);
  assert.match(screenShare,/schedulePoll\(after: 0\.5\)/);
  assert.doesNotMatch(screenShare,/withTimeInterval: 0\.5, repeats: true/);
  assert.match(privateRoot,/if reportMounted \{\s*DeviceActivityReport/);
  assert.match(privateRoot,/reportMounted = false/);
  assert.match(app,/setInterval\(friendRequestSweep,5000\)/);
  assert.match(app,/setInterval\(blockedPhoneSweepVisible,5000\)/);
});

test('private core storage stays off MainActor and restores large state through bounded chunks',()=>{
  assert.match(app,/const args=\{key:k,ver:[\s\S]*?stateJSON:String\(v\.json\|\|''\)\}[\s\S]*?request\('storage\.put',args\)/);
  assert.doesNotMatch(app,/request\('storage\.put',\{key:k,value:v\}\)/);
  assert.match(bridge,/private let storageQueue = DispatchQueue\([\s\S]*?qos: \.utility/);
  assert.match(bridge,/storageQueue\.async \{ \[weak self\] in/);
  assert.match(bridge,/stateData\.count > 131_072[\s\S]*?"chunked"\] = true[\s\S]*?"chunkBytes"\] = 196_608/);
  assert.match(bridge,/case "storage\.get\.chunk"[\s\S]*?chunkOffset \+ 196_608[\s\S]*?chunk\.base64EncodedString\(\)/);
  assert.match(app,/async function privateNativeCoreGet\(k\)[\s\S]*?new TextDecoder\('utf-8'\)[\s\S]*?request\('storage\.get\.chunk',[\s\S]*?parts\.join\(''\)/);
  assert.match(bridge,/nonisolated private func replyStorage[\s\S]*?let stateJSON = result\["stateJSON"\] as\? String/);
  assert.match(bridge,/let chunkBase64 = result\["chunkBase64"\] as\? String[\s\S]*?"chunkBase64": chunkBase64[\s\S]*?in: \.page/);
  assert.match(bridge,/callAsyncJavaScript\([\s\S]*?arguments: \[[\s\S]*?"stateJSON": stateJSON[\s\S]*?in: \.page/);
  assert.doesNotMatch(bridge,/__smallPhoneNativeReply\(\\\(json\)\)[\s\S]{0,120}?stateJSON/);
});

test('native background and inbox work waits for the restored core to finish booting',()=>{
  assert.match(app,/requestPersistentStorage\(\);privateResumeSyncSoon\(\)/);
  assert.match(app,/setInterval\(\(\)=>\{if\(_appBootFinished\)companionPollSnapshot\(false\);\},8000\)/);
  assert.match(app,/setInterval\(\(\)=>\{if\(_appBootFinished\)roleServerPushPull\(false\);\},60000\)/);
  assert.match(app,/setInterval\(\(\)=>\{if\(_appBootFinished\)phoneFriendMaybeSync\(false\);\},2500\)/);
});

test('private boot keeps historical image references lazy without allowing image garbage collection',()=>{
  assert.match(app,/const lazy=privateNativeAppOn\(\),keys=lazy\?privateBootImageKeys\(\):imageRefKeys\(S\)/);
  assert.match(app,/if\(!lazy\)_rehydrate\(S\)/);
  assert.match(app,/function imgGC\(\)[\s\S]*?if\(isStoredImgRef\(v\)\)used\.add\(v\.slice\(4\)\)/);
  assert.match(app,/app\.innerHTML=[\s\S]{0,900}?if\(privateNativeAppOn\(\)\)hydrateStoredImageNodes\(\)/);
  assert.match(app,/const _visibleImageMisses=new Map\(\)/);
  assert.match(app,/function visibleImageRetryDelay\(count\)[\s\S]*?Math\.min\(120000/);
  assert.match(app,/eligible\.slice\(0,12\)/);
  assert.match(app,/function scheduleVisibleStoredImages\(force\)[\s\S]*?requestIdleCallback\(run,\{timeout:1200\}\)/);
  assert.doesNotMatch(app,/function scheduleVisibleStoredImages\(\)[\s\S]{0,300}?requestAnimationFrame/);
});

test('private companion polling never constructs Intl.DateTimeFormat on the WebContent timer',()=>{
  assert.match(app,/const _companionUsageDayFormatters=new Map\(\)/);
  const start=app.indexOf('const _companionUsageDayFormatters=');
  const end=app.indexOf('function companionUsagePayloadDecision(',start);
  assert.ok(start>=0&&end>start,'companion usage day helpers are present');
  const sandbox={
    Date,Map,Number,String,
    privateNativeAppOn:()=>true,
    Intl:{DateTimeFormat(){throw new Error('private poll reached the expensive Intl constructor');}}
  };
  vm.runInNewContext(app.slice(start,end)+`;globalThis.day=companionUsageDayAt(1787587440000,'Asia/Shanghai');`,sandbox);
  const expected=new Date(1787587440000);
  const local=expected.getFullYear()+'-'+String(expected.getMonth()+1).padStart(2,'0')+'-'+String(expected.getDate()).padStart(2,'0');
  assert.equal(sandbox.day,local);
});

test('web companion usage reuses one formatter per reported phone time zone',()=>{
  const start=app.indexOf('const _companionUsageDayFormatters=');
  const end=app.indexOf('function companionUsagePayloadDecision(',start);
  let constructions=0;
  const sandbox={
    Date,Map,Number,String,
    privateNativeAppOn:()=>false,
    Intl:{DateTimeFormat:function(){constructions++;return{formatToParts:()=>[
      {type:'year',value:'2026'},{type:'literal',value:'/'},{type:'month',value:'08'},
      {type:'literal',value:'/'},{type:'day',value:'25'}
    ]};}}
  };
  vm.runInNewContext(app.slice(start,end)+`;globalThis.first=companionUsageDayAt(1,'Asia/Shanghai');globalThis.second=companionUsageDayAt(2,'Asia/Shanghai');`,sandbox);
  assert.equal(sandbox.first,'2026-08-25');
  assert.equal(sandbox.second,'2026-08-25');
  assert.equal(constructions,1);
});

test('a rejected visible-image batch backs off instead of immediately retrying the same database reads',async()=>{
  const start=app.indexOf('let _visibleImageHydrateTimer=');
  const end=app.indexOf('function refreshHydratedUI()',start);
  assert.ok(start>=0&&end>start,'visible image hydration block is present');
  const timers=[],sandbox={
    Date,Map,Set,Promise,
    _imgCache:{},_imgRev:new Map(),_imgReady:new Set(),
    visibleStoredImageKeys:()=>Array.from({length:13},(_,i)=>'img'+i),
    hydrateStoredImageNodes:()=>{},
    imgMany:async()=>{sandbox.reads++;throw new Error('database temporarily unavailable');},
    reads:0,
    setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},
    requestIdleCallback:()=>{throw new Error('batch failure must not immediately request another idle read');}
  };
  vm.runInNewContext(app.slice(start,end)+`;
    globalThis.runHydrate=()=>hydrateVisibleStoredImages(false);
    globalThis.missCount=()=>_visibleImageMisses.size;
    globalThis.immediateAgain=()=>_visibleImageHydrateAgain;
  `,sandbox);
  assert.equal(await sandbox.runHydrate(),false);
  assert.equal(sandbox.reads,1);
  assert.equal(sandbox.missCount(),12,'every failed key receives retry state');
  assert.equal(sandbox.immediateAgain(),false,'the failed batch cannot request an immediate follow-up');
  assert.equal(timers.length,1,'exactly one delayed retry is scheduled');
  assert.ok(timers[0].delay>=4000,'retry delay is at least four seconds');
});

test('private storage warnings use the native bridge rather than the web five-megabyte ceiling',()=>{
  assert.match(app,/function refreshNativeStorageEstimate\(force\)\{if\(!privateNativeAppOn\(\)/);
  assert.match(app,/native=privateNativeAppOn\(\)\?await refreshNativeStorageEstimate\(true\):null/);
  assert.match(app,/function checkStorageWarn\(\).*nativeCore=privateNativeCoreStorageKey\(CORE_IDB_KEY\).*coreDanger=!nativeCore&&!si\.overflow/s);
});

test('startup avoids immediate whole-state cloud and recovery work',()=>{
  assert.match(app,/setTimeout\(cloudAutoTick,8000\)/);
  assert.match(app,/privatePrimaryMirrorCheck\(\{silent:true\}\)/);
  assert.match(app,/if\(privateNativeAppOn\(\)\)\{privatePhoneCloudWake\(\);return;\}/);
  assert.doesNotMatch(app,/setTimeout\(\(\)=>\{if\(S\.settings&&S\.settings\.cloudAuto\)cloudBackup\(\)/);
  assert.match(app,/function queueRecoverySnapshot\(json,savedAt\)\{savedAt=[\s\S]*?_recoverySnapshotAt[\s\S]*?return _recoverySnapshotWrite;let data;try\{data=JSON\.parse\(json\)/);
  assert.doesNotMatch(app,/privateNativeCoreStorageKey\(CORE_IDB_KEY\)&&!_coreOverflowMode\)save\(0\)/);
  assert.match(app,/if\(!privateNativeAppOn\(\)\)setTimeout\(\(\)=>\{try\{const savedAt=Date\.now\(\),json=JSON\.stringify/);
});

test('background transitions perform one core save instead of two full state traversals',()=>{
  assert.match(app,/function persistPendingStateOnHide\(\)\{if\(!_savePending\)return false;[\s\S]*?return saveNow\(\);\}/);
  assert.match(app,/pagehide'[\s\S]{0,500}?persistPendingStateOnHide\(\)/);
  assert.match(app,/beforeunload'[\s\S]{0,350}?persistPendingStateOnHide\(\)/);
  assert.match(app,/visibilitychange'[\s\S]{0,800}?persistPendingStateOnHide\(\)/);
  assert.doesNotMatch(app,/pagehide'[\s\S]{0,500}?saveNow\(\);persistWechatMessagesNow\(\)/);
});

test('native performance protection is adaptive and preserves the normal visual path',()=>{
  assert.match(app,/function northNativeTimedJSON\(value,replacer,kind\)/);
  assert.match(app,/function northNativePerformanceWatchStart\(\)/);
  assert.match(app,/north-native-startup-quiet/);
  assert.match(app,/north-native-performance-guard/);
  assert.match(css,/north-native-performance-guard,.north-native-startup-quiet/);
  assert.match(css,/animation-play-state:paused!important/);
});

test('orphaned ReplayKit state cannot leave the host on the hot polling path',()=>{
  assert.match(screenShare,/func clearOrphanedBroadcastState/);
  assert.match(screenShare,/now - newest > 15/);
  assert.match(screenShare,/set\(false, forKey: "screenShare\.active\.v1"\)/);
  assert.match(screenShare,/func status\(\)[\s\S]{0,120}?clearOrphanedBroadcastState\(\)/);
  assert.match(screenShare,/private func poll\(force: Bool = false\)[\s\S]{0,120}?clearOrphanedBroadcastState\(\)/);
});

test('foreground snapshot synchronization is serialized and cooled down',()=>{
  assert.match(appDelegate,/private var foregroundSyncInFlight = false/);
  assert.match(appDelegate,/Date\(\)\.timeIntervalSince\(lastForegroundSyncAt\) >= 30/);
  assert.match(appDelegate,/func applicationDidBecomeActive[\s\S]{0,300}?synchronizeForegroundIfNeeded\(\)/);
  assert.match(appDelegate,/@MainActor\s+private func synchronizeForegroundIfNeeded\(\) async/);
  assert.match(appDelegate,/defer \{ foregroundSyncInFlight = false \}/);
});

test('location reads cannot leave best-accuracy GPS running after one role check',()=>{
  const startTracking=swiftFunction(location,'startTracking','refreshCurrentLocation');
  const refresh=swiftFunction(location,'refreshCurrentLocation','stopTracking');
  const addPoint=location.slice(
    location.indexOf('private func addFootprintPoint('),
    location.indexOf('private func resolvePlaceName(')
  );

  assert.match(location,/pausesLocationUpdatesAutomatically = true/);
  assert.match(startTracking,/manager\.stopUpdatingLocation\(\)/);
  assert.match(startTracking,/startMonitoringSignificantLocationChanges\(\)/);
  assert.match(startTracking,/requestOneShotLocation\(\)/);
  assert.doesNotMatch(startTracking,/startUpdatingLocation\(\)/);
  assert.match(refresh,/manager\.stopUpdatingLocation\(\)/);
  assert.match(refresh,/requestOneShotLocation\(\)/);
  assert.doesNotMatch(refresh,/startUpdatingLocation\(\)/);
  assert.match(location,/private func requestOneShotLocation\(\)[\s\S]*?guard !oneShotLocationPending else \{ return \}[\s\S]*?manager\.requestLocation\(\)/);
  assert.doesNotMatch(addPoint,/loadTodayPoints\(\)/);
  assert.match(location,/guard todayPoints\[index\]\.placeName != placeName else \{ return \}/);
  assert.match(location,/if compacted != savedPoints \{\s*saveTodayPoints\(\)\s*\}/);
});
