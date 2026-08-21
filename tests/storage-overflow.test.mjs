import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const app = readFileSync(join(root, 'app.js'), 'utf8');

function functionSource(name) {
  const asyncStart = app.indexOf(`async function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : app.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = app.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = brace; i < app.length; i++) {
    const ch = app[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('large core state migrates to IndexedDB before localStorage reaches its browser quota', () => {
  assert.match(app, /const CORE_IDB_KEY='__core_state',RECOVERY_IDB_KEY='__recovery_state',RECOVERY_HISTORY_IDB_KEY='__recovery_history_state',CORE_INLINE_LIMIT=3\.5\*1024\*1024/);
  assert.match(app, /bytes>CORE_INLINE_LIMIT/);
  assert.match(app, /queueCoreMirror\(json,savedAt,true\)/);
  assert.match(app, /imgPut\(CORE_IDB_KEY,\{ver:1,savedAt:job\.savedAt,json:job\.json\}\)/);
  assert.match(app, /writeCoreBootShell\(savedAt\)/);
  assert.match(app, /__coreIdb:\{ver:1,savedAt:/);
  assert.match(app, /async function bootOverflowCore\(\)/);
  assert.match(app, /primary=await imgGet\(CORE_IDB_KEY\)/);
  assert.match(app, /backup=await imgGet\(RECOVERY_IDB_KEY\)/);
  assert.match(app, /recoveryStateMeaningful\(stats\)/);
  assert.match(app, /S=mergeStateData\(restored\)/);
  assert.match(functionSource('bootImages'), /^async function bootImages\(\)\{await bootOverflowCore\(\);if\(privateNativeAppOn\(\)&&!_recoverySnapshotAt\)_recoverySnapshotAt=Date\.now\(\);try\{/);
  assert.match(app, /if\(_coreBootRef&&!_appBootFinished\)return true/);
});

test('overflow saves are verified asynchronously and failures are rate limited', () => {
  assert.match(app, /function saveNowAsync\(\)/);
  assert.match(app, /_coreMirrorWrite\.then\(Boolean\)/);
  assert.match(app, /_coreQueuedSave=\{json,savedAt,activateOverflow:!!activateOverflow\}/);
  assert.match(app, /while\(_coreQueuedSave\)/);
  assert.match(app, /function storageSaveFailure\(e,largeStore\)/);
  assert.match(app, /now-_storageFailureToastAt>60000/);
  assert.match(app, /now-_storageFailureModalAt>300000/);
  assert.match(app, /大容量存档保存失败/);
  assert.match(app, /无痕\/隐私模式/);
  assert.match(app, /const IMG_DB_VERSION=2/);
  assert.match(functionSource('imgDB'), /objectStoreNames\.contains\('img'\)/);
  assert.match(functionSource('imgPutIDBWithRetry'), /attempt<3/);
  assert.match(functionSource('imgPut'), /imgPutIDBWithRetry\(k,v\)/);
  assert.doesNotMatch(app, /catch\(e\)\{toast\(isQuotaError\(e\)\?'核心存档写不进去了/);
});

test('storage meter distinguishes the compact core index from browser-wide capacity', () => {
  assert.match(app, /overflow=!!_coreOverflowMode/);
  assert.match(app, /数据量 '\+si\.logicalMb\.toFixed\(2\)\+'MB · 大容量模式/);
  assert.match(app, /当前数字是本站已经使用的数据量，不是容量上限/);
  assert.match(app, /coreDanger=!si\.overflow&&si\.pct>=99/);
  assert.match(app, /navigator\.storage&&navigator\.storage\.persist/);
});

test('private app always moves core state to native storage and reports real device capacity', () => {
  assert.match(app, /nativeCore=privateNativeCoreStorageKey\(CORE_IDB_KEY\)/);
  assert.match(app, /overflow=nativeCore\|\|_coreOverflowMode\|\|bytes>CORE_INLINE_LIMIT/);
  assert.doesNotMatch(app, /if\(privateNativeCoreStorageKey\(CORE_IDB_KEY\)&&!_coreOverflowMode\)save\(0\)/);
  assert.match(app, /nativeCore=privateNativeCoreStorageKey\(CORE_IDB_KEY\)/);
  assert.match(app, /SmallPhoneNative\.request\('storage\.status'\)/);
  assert.match(app, /nativeTotal=.*native\.totalBytes/);
  assert.match(app, /手机当前可安全使用约/);
  assert.match(app, /原生核心存档使用双副本与旧写入拦截/);
  assert.match(app, /音乐、视频等大文件仍放在 App 私有 WebKit 数据库中/);
});

test('storage details separate core, chats, images, voice cache and music', () => {
  assert.match(app, /function scanIDBStoreBytes\(openDB,storeName,classify\)/);
  assert.match(app, /function appStorageBreakdown\(\)/);
  assert.match(app, /k===CORE_IDB_KEY\|\|k===RECOVERY_IDB_KEY\|\|k===RECOVERY_HISTORY_IDB_KEY\?'core'/);
  assert.match(app, /\^__\(\?:messages\|pf_messages\|pf_group_messages\)/);
  assert.match(app, /k\.indexOf\('__audio_'\)===0\?'voice'/);
  assert.match(app, /scanIDBStoreBytes\(mIDB,'audio',\(\)=> 'music'\)/);
  assert.match(app, /__cinema_asr-job_'/);
  assert.match(app, /'cinemaSubtitle'/);
  assert.match(app, /parts\.cinemaSubtitle/);
  assert.match(app, /核心数据[\s\S]*长聊天库[\s\S]*图片[\s\S]*语音\/通话缓存[\s\S]*音乐文件/);
  assert.match(app, /onclick="showStorageBreakdown\(\)">查看占用明细/);
});

test('browser compatibility fallbacks cover clipboard, notifications, DOM replacement and iOS exports', () => {
  assert.match(app, /function copyTextCompat\(text,input\)/);
  assert.match(app, /document\.execCommand&&document\.execCommand\('copy'\)/);
  assert.match(app, /function requestNotificationPermission\(\)/);
  assert.match(app, /Notification\.requestPermission\(finish\)/);
  assert.match(app, /function replaceChildrenCompat\(el,node\)/);
  assert.match(app, /while\(el\.firstChild\)el\.removeChild\(el\.firstChild\)/);
  assert.match(app, /const name='North备份_'[\s\S]*?await beautySaveFile\(blob,name\)/);
  assert.match(app, /musicPrepareReadyExport\(blob,[\s\S]*?new Date\(\)\.toISOString\(\)\.slice\(0,10\)/);
  assert.match(app, /function musicSaveReadyExport\(\)[\s\S]*?await beautySaveFile\(ready\.blob,ready\.name\)/);
  assert.match(app, /r\.onblocked=fail/);
  assert.match(app, /db\.onversionchange=/);
  assert.match(app, /indexedDB\.open\('yibeiMusic',1\)[\s\S]*?r\.onblocked=fail/);
  assert.match(app, /function mPut\(k,b\)[\s\S]*?db\.close\(\)/);
});

test('real save flow keeps only the newest queued large snapshot and restores it', async () => {
  const db = new Map();
  const local = new Map();
  let writes = 0;
  const context = vm.createContext({
    Blob, Date, Promise, setTimeout, clearTimeout,
    localStorage: {
      getItem: key => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, String(value)),
    },
    imgPut: async (key, value) => {
      writes++;
      await new Promise(resolve => setTimeout(resolve, 5));
      db.set(key, value);
    },
    imgGet: async key => db.get(key) ?? null,
    queueRecoverySnapshot: () => Promise.resolve(true),
    storageSaveFailure: error => { throw error; },
    toast: () => {},
  });
  vm.runInContext(`
    const KEY='north-test',CORE_IDB_KEY='__core_state',CORE_INLINE_LIMIT=3.5*1024*1024;
    let _coreBootRef=null,_coreOverflowMode=false,_coreMirrorWrite=Promise.resolve(true),
      _coreQueuedSave=null,_coreLogicalBytes=0,_coreSavePending=false,_coreFailureAt=0,
      _appBootFinished=true,_saveTimer=null,_saveIdleHandle=0,_savePending=false,_saveLast=0,_saveOkLast=0;
    let S={settings:{},me:{accounts:[]},marker:'first',payload:'x'.repeat(3.6*1024*1024)};
    function defState(){return {settings:{},me:{accounts:[]}}}
    function _imgReplacer(key,value){return value}
    function privateNativeCoreStorageKey(){return false}
    function isQuotaError(){return false}
    function mergeStateData(data){return Object.assign(defState(),data||{})}
    function recoveryStateStats(data){return {contacts:(data.contacts||[]).length,accounts:1,messages:0,memories:0,moments:0,groups:0}}
    function recoveryStateMeaningful(stats){return !!stats.contacts}
    function normalizeLoadedState(){}
  `, context);
  for (const name of ['storedTextBytes', 'coreBootShell', 'writeCoreBootShell', 'queueCoreMirror', 'cancelScheduledSave', 'saveNow', 'bootOverflowCore']) {
    vm.runInContext(functionSource(name), context);
  }

  vm.runInContext(`saveNow();S.marker='second';saveNow();S.marker='newest';saveNow();`, context);
  assert.equal(await vm.runInContext('_coreMirrorWrite', context), true);
  assert.ok(writes <= 2, `expected coalesced writes, got ${writes}`);
  assert.equal(JSON.parse(db.get('__core_state').json).marker, 'newest');
  assert.equal(JSON.parse(local.get('north-test')).__coreIdb.ver, 1);

  vm.runInContext(`S=coreBootShell(Date.now());_appBootFinished=false`, context);
  assert.equal(await vm.runInContext('bootOverflowCore()', context), true);
  assert.equal(vm.runInContext('S.marker', context), 'newest');
});

test('a missing large primary snapshot falls back to the protected recovery snapshot', async () => {
  const db = new Map();
  const local = new Map();
  const recovered = {settings:{},me:{accounts:[]},contacts:[{id:'kept'}],marker:'recovered'};
  db.set('__recovery_state',{ver:1,savedAt:1234,json:JSON.stringify(recovered),stats:{contacts:1,accounts:1,messages:0,memories:0,moments:0,groups:0}});
  const context = vm.createContext({
    Blob, Date, Promise, setTimeout, clearTimeout,
    localStorage:{setItem:(key,value)=>local.set(key,String(value))},
    imgGet:async key=>db.get(key)??null,
    imgPut:async(key,value)=>db.set(key,value),
    toast:()=>{},
  });
  vm.runInContext(`
    const KEY='north-test',CORE_IDB_KEY='__core_state',RECOVERY_IDB_KEY='__recovery_state';
    let _coreBootRef={ver:1,savedAt:2000},_coreOverflowMode=true,_coreLogicalBytes=0,S={};
    function defState(){return {settings:{},me:{accounts:[]},contacts:[]}}
    function mergeStateData(data){return Object.assign(defState(),data||{})}
    function normalizeLoadedState(){}
    function recoveryStateStats(data){return {contacts:(data&&data.contacts||[]).length}}
    function recoveryStateMeaningful(stats){return !!(stats&&stats.contacts)}
  `,context);
  for(const name of ['storedTextBytes','coreBootShell','writeCoreBootShell','bootOverflowCore'])vm.runInContext(functionSource(name),context);
  assert.equal(await vm.runInContext('bootOverflowCore()',context),true);
  assert.equal(vm.runInContext('S.marker',context),'recovered');
  assert.equal(JSON.parse(db.get('__core_state').json).marker,'recovered');
  assert.equal(JSON.parse(local.get('north-test')).__coreIdb.savedAt,1234);
});
