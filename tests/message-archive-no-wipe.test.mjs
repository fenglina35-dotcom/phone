// MSG_ARCHIVE_NO_WIPE_V1 regression (2026-10-18 incident): on the private App the long chat archive
// `__messages` could not be read at boot (IndexedDB took 189 s and returned nothing). The old code treated
// "could not read" as "no chats"; the next saved role message then saw a tiny chat store and deleted the
// archive, wiping every message since the last recovery snapshot. Runs the real functions from both bundles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const BUNDLES={
  web:new URL('../app.js',import.meta.url),
  private:new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),
};

function functionSource(source,name){
  const asyncStart=source.indexOf(`async function ${name}(`);
  const start=asyncStart>=0?asyncStart:source.indexOf(`function ${name}(`);
  if(start<0)return '';
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

function load(url,{archive}){
  const source=readFileSync(url,'utf8');
  const calls={del:[],put:[]},timers=[];
  const store={__messages:archive};
  const context=vm.createContext({
    console,JSON,Object,Array,Set,Map,Math,Promise,String,Number,Boolean,Error,
    window:{},performance:{now:()=>Date.now()},Date,
    setTimeout:(fn,ms)=>{if(ms>=20000){timers.push(fn);return timers.length;}fn();return 0;},
    clearTimeout:()=>{},
    NORTH_ANDROID:false,
    imgGetIDB:async k=>store[k]??null,
    imgGet:async k=>store[k]??null,
    imgPut:async (k,v)=>{calls.put.push(k);store[k]=v;},
    imgPutIDBWithRetry:async (k,v)=>{calls.put.push(k);store[k]=v;},
    imgDel:async k=>{calls.del.push(k);delete store[k];},
    bootOverflowCore:async()=>false,musicManifestRestore:async()=>{},privateNativeAppOn:()=>false,
    lazyStoredImagesOn:()=>false,imageRefKeys:()=>[],imgMany:async()=>({}),_rehydrate:()=>{},privateBootImageKeys:()=>[],privateTrimImageMemoryCache:()=>{},
    wechatTailJournalMerge:()=>false,taskDailyJournalMerge:()=>false,socialDailyJournalMerge:()=>false,wxUnreadRestore:()=>false,
    repairWxLogoutEmoji:()=>false,repairStaleVisionStates:()=>false,repairStaleGeneratedImageStates:()=>false,voiceAudioGC:()=>false,
    save:()=>{},saveNowAsync:async()=>true,toast:()=>{},render:()=>{},isBigImg:()=>false,
    pfMsgStoreKey:()=>'__pf_messages_main',pfGroupMsgStoreKey:()=>'__pf_group_messages_main',
  });
  vm.runInContext(`var _heavy={},_heavyStamp={},_heavyReady=new Set(),_messageArchiveWrite=Promise.resolve(),_recoverySnapshotAt=0,_recoveryInlineSave=false,_webRecoveryInlineSave=false,_imgCache={},_imgRev=new Map(),_imgReady=new Set(),_persistWechatRequested=0,_persistWechatCompleted=0,_persistWechatRunning=false,_persistWechatWaiters=[];`,context);
  const flags=source.match(/^let _msgArchiveLost=[^\n]*;$/m);
  if(flags)vm.runInContext(flags[0].replace(/^let /,'var '),context);
  for(const name of ['messageArchiveStamp','mergeBootMessages','writeMessageArchive','deleteMessageArchive','msgArchiveBootRead','msgArchiveMarkLost','msgArchiveRetryLater',
    'persistWechatClock','persistWechatTrace','persistWechatSettle','persistWechatDrain','persistWechatMessagesNow','_imgReplacer','bootImages']){
    const src=functionSource(source,name);if(src)vm.runInContext(src,context);
  }
  return {context,calls,timers,store};
}

const oldChats={ciqgj7n2:Array.from({length:400},(_,i)=>({id:'old'+i,role:i%2?'assistant':'user',type:'text',content:'以前的聊天 '+i,time:1000+i}))};

for(const [name,url] of Object.entries(BUNDLES)){
  test(`${name}: an unreadable chat archive at boot is never deleted or overwritten`,async()=>{
    const archive=JSON.stringify(oldChats);
    const {context,calls,timers,store}=load(url,{archive:null});
    context.S={me:{},messages:{__idb:'messages',ciqgj7n2:[]}};
    await context.bootImages();
    // 角色在启动后发来几条新消息并立即落盘
    (context.S.messages.ciqgj7n2||=[]).push({id:'n1',role:'assistant',type:'text',content:'North。',time:5000},{id:'n2',role:'assistant',type:'text',content:'任务呢？',time:5001});
    await context.persistWechatMessagesNow();
    await context._messageArchiveWrite;
    assert.deepEqual(calls.del.filter(k=>k==='__messages'),[],'the long chat archive must not be deleted while it could not be read');
    assert.deepEqual(calls.put.filter(k=>k==='__messages'),[],'a smaller chat store must not overwrite the unreadable archive');
    const saved=context._imgReplacer('messages',context.S.messages);
    assert.equal(saved.__idb,'messages','the saved core must keep pointing at the long archive');
    assert.deepEqual(saved.ciqgj7n2.map(m=>m.id),['n1','n2'],'new messages are still saved in the core');
    // 长库后来读得出来了：合并回来，旧聊天和新消息都在
    store.__messages=archive;
    assert.ok(timers.length>0,'a background retry must be scheduled');
    await timers.shift()();
    assert.equal(context.S.messages.ciqgj7n2.length,402);
    assert.deepEqual(context.S.messages.ciqgj7n2.slice(-2).map(m=>m.id),['n1','n2']);
    // 之后正常保存会把合并后的完整聊天写回长库
    await context.persistWechatMessagesNow();
    await context._messageArchiveWrite;
    assert.equal(JSON.parse(store.__messages).ciqgj7n2.length,402);
  });

  test(`${name}: a readable chat archive still loads and persists normally`,async()=>{
    const {context,store}=load(url,{archive:JSON.stringify(oldChats)});
    context.S={me:{},messages:{__idb:'messages'}};
    await context.bootImages();
    assert.equal(context.S.messages.ciqgj7n2.length,400);
    context.S.messages.ciqgj7n2.push({id:'n1',role:'user',type:'text',content:'在吗',time:9000});
    await context.persistWechatMessagesNow();
    await context._messageArchiveWrite;
    assert.equal(JSON.parse(store.__messages).ciqgj7n2.length,401);
  });
}
