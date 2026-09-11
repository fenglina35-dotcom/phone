import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const asyncStart=source.indexOf(`async function ${name}(`);
  const start=asyncStart>=0?asyncStart:source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
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

test('a large Android backup is split before its first core snapshot',async()=>{
  const image='data:image/jpeg;base64,'+'A'.repeat(1024*1024);
  const db=new Map();
  const context=vm.createContext({
    Blob,Date,JSON,Promise,WeakSet,Map,Set,setTimeout,clearTimeout,
    S:{
      settings:{},
      me:{phoneFriend:{id:'friend',messages:{f:[{id:'pf1',time:1,content:'p'.repeat(22000),img:image}]},groupMessages:{}}},
      contacts:[{id:'c1',avatar:image}],
      messages:{c1:[{id:'m1',time:1,role:'user',type:'image',img:image,content:'x'.repeat(24000)}]},
    },
    imgPut:async(key,value)=>{db.set(key,value);},
    imgDel:async key=>{db.delete(key);},
    lazyStoredImagesOn:()=>false,
    privateTrimImageMemoryCache:()=>0,
    imageReferenceCompactSoon(){},writeMessageArchive(){throw new Error('message archive should already be primed');},
    writeHeavyMessageArchive(){throw new Error('friend archive should already be primed');},
  });
  vm.runInContext(`let _imgRev=new Map(),_imgCache={},_imgReady=new Set(),_imgSeq=0,_heavy={},_heavyStamp={},_heavyReady=new Set();`,context);
  for(const name of ['isBigImg','primeImageForSave','stateBigImages','primeStateImagesForSave','compactReadyStateImages','pfMsgStoreKey','pfGroupMsgStoreKey','messageArchiveStamp','primeImportedMessageStore',...(source.includes('async function compactImportedImages(')?['compactImportedImages']:[]),'prepareImportedStateForSave','_imgReplacer'])vm.runInContext(functionSource(name),context);

  await vm.runInContext('prepareImportedStateForSave()',context);
  const core=vm.runInContext('JSON.stringify(S,_imgReplacer)',context);
  assert.doesNotMatch(core,/data:image/,'the first core write must not retain imported base64 images');
  assert.match(core,/"messages":\{"__idb":"messages"\}/,'long main chat must already be an archive reference');
  assert.match(core,/"__idb":"phoneFriendMessages"/,'long real-friend chat must already be an archive reference');
  assert.doesNotMatch(db.get('__messages'),/data:image/,'the chat archive itself must use stored-image references');
  assert.match(db.get('__messages'),/"img":"idb:/);
  assert.ok([...db.keys()].some(key=>/^i/.test(key)),'the imported image must exist before the compact core is allowed to save');
});

test('full-backup apply writes recovery before core and rolls memory back on staging failure',async()=>{
  const events=[];
  const context=vm.createContext({
    S:{settings:{},marker:'before'},Date,JSON,
    mergeStateData:data=>({...data}),normalizeLoadedState(){},phoneFriendState(){},toast(){},
    prepareImportedStateForSave:async()=>{events.push('prepare');},
    _imgReplacer(_key,value){return value;},
    northNativeTimedJSON:value=>JSON.stringify(value),
    recoveryStateStats:()=>({contacts:1}),recoveryStateMeaningful:()=>true,
    queueRecoverySnapshot:async(_json,_savedAt,force)=>{events.push(`snapshot:${force}`);return true;},
    saveNowAsync:async()=>{events.push('save');return true;},
    render(){events.push('render');},
  });
  vm.runInContext(functionSource('applyFullBackupData'),context);
  await vm.runInContext(`applyFullBackupData({settings:{},marker:'after'})`,context);
  assert.deepEqual(events,['prepare','snapshot:true','save','render']);
  assert.equal(context.S.marker,'after');

  context.S={settings:{},marker:'stable'};
  context.prepareImportedStateForSave=async()=>{throw new Error('stage failed');};
  await assert.rejects(vm.runInContext(`applyFullBackupData({settings:{},marker:'broken'})`,context),/stage failed/);
  assert.equal(context.S.marker,'stable','a failed import must restore the previously active in-memory state');
});


test('import compacts each stored image without retaining the whole backup in the image cache',async()=>{
  let peak=0,writes=0,yields=0;
  const images=Array.from({length:36},(_,i)=>'data:image/jpeg;base64,'+String(i).padStart(3,'0')+'A'.repeat(256*1024));
  const ctx=vm.createContext({S:{images:images.map(img=>({img,again:img}))},Date,JSON,Map,Set,WeakSet,Promise,
    setTimeout:fn=>{yields++;return setTimeout(fn,0);},
    imgPut:async()=>{writes++;peak=Math.max(peak,vm.runInContext('Object.keys(_imgCache).length',ctx));},
    lazyStoredImagesOn:()=>true,privateTrimImageMemoryCache(){},
    primeImportedMessageStore:async()=>{},pfMsgStoreKey:()=>'',pfGroupMsgStoreKey:()=>''});
  vm.runInContext('let _imgRev=new Map(),_imgCache={},_imgReady=new Set(),_imgSeq=0;',ctx);
  for(const name of ['isBigImg','primeImageForSave','stateBigImages','primeStateImagesForSave','compactReadyStateImages',...(source.includes('async function compactImportedImages(')?['compactImportedImages']:[]),'prepareImportedStateForSave'])vm.runInContext(functionSource(name),ctx);
  await vm.runInContext('prepareImportedStateForSave()',ctx);
  assert.equal(writes,36,'duplicate references share one stored image');
  assert.ok(peak<=2,`retained ${peak} imported images in cache`);
  assert.ok(yields>=18,'large imports must let input and rendering run between batches');
  assert.ok(ctx.S.images.every(x=>x.img.startsWith('idb:')&&x.img===x.again));
});

test('a failed image write leaves its raw data intact and preserves existing visible cache entries',async()=>{
 const first='data:image/png;base64,'+'A'.repeat(3000),second='data:image/png;base64,'+'B'.repeat(3000);
 const ctx=vm.createContext({Date,Map,Set,WeakSet,Promise,setTimeout,isBigImg:v=>typeof v==='string'&&v.startsWith('data:image'),lazyStoredImagesOn:()=>true,
 root:{first,second},imgPut:async(_key,v)=>{if(v===second)throw new Error('quota');}});
 vm.runInContext('let _imgRev=new Map(),_imgCache={},_imgReady=new Set(),_imgSeq=0;',ctx);
 ctx.first=first;vm.runInContext("_imgRev.set(first,'visible');_imgCache.visible=first;_imgReady.add('visible');",ctx);
 for(const name of ['primeImageForSave','compactImportedImages'])vm.runInContext(functionSource(name),ctx);
 await assert.rejects(vm.runInContext('compactImportedImages(root)',ctx),/quota/);
 assert.equal(ctx.root.first,'idb:visible');assert.equal(ctx.root.second,second);
 assert.equal(vm.runInContext('_imgCache.visible',ctx),first);
});
