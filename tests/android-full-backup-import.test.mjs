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
  for(const name of ['isBigImg','primeImageForSave','stateBigImages','primeStateImagesForSave','compactReadyStateImages','pfMsgStoreKey','pfGroupMsgStoreKey','messageArchiveStamp','primeImportedMessageStore','prepareImportedStateForSave','_imgReplacer'])vm.runInContext(functionSource(name),context);

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
