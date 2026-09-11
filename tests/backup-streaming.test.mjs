import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=src.indexOf('// 文件备份按块读写');
const code=src.slice(start<0?src.indexOf('let _fullBackupExportBusy'):start,src.indexOf('async function applyFullBackupData('));
function setup(state={},extras={}){
 const db=new Map(),events=[];let saved;
 const c=vm.createContext({Blob,Date,JSON,TextDecoder,TextEncoder,Uint8Array,crypto:webcrypto,setTimeout,clearTimeout,Promise,Map,Set,Math,Object,Array,
  S:state,_bootImagesPromise:null,fullBackupState:async()=>state,
  imgGet:async k=>db.get(k),imgPut:async(k,v)=>db.set(k,v),imgDel:async k=>db.delete(k),isBigImg:v=>typeof v==='string'&&v.startsWith('data:image')&&v.length>2000,
  toast:s=>events.push(s),beautySaveFile:async b=>{saved=b;return 'downloaded';},...extras});
 vm.runInContext(code,c);return{c,db,events,get saved(){return saved;}};
}
test('export survives aggregate JSON larger than the engine string budget',async()=>{
 const image='data:image/png;base64,'+'A'.repeat(128*1024),state={settings:{text:'聊天原文'},images:Array(32).fill(image)};
 const limitedJSON={parse:JSON.parse,stringify(...args){const s=JSON.stringify(...args);if(s&&s.length>2*1024*1024)throw new RangeError('Invalid string length');return s;}};
 const env=setup(state,{JSON:limitedJSON});await vm.runInContext('exportData()',env.c);
 assert.ok(env.saved,'must produce a complete Blob without serializing aggregate JSON into one string: '+env.events.join(';'));
 assert.deepEqual(JSON.parse(await env.saved.text()),state);
});
test('file import only reads bounded slices, preserves JSON and stages duplicate media once',async()=>{
 const image='data:image/png;base64,'+'B'.repeat(400000),original=JSON.parse('{"settings":{"quote":"汉字😀\\n\\\"\\\\","__proto__":{"safe":true}},"messages":{"a":[null,true,1e3]},"images":[]}');original.images=Array(12).fill(image);
 const blob=new Blob([JSON.stringify(original)]);let maxRead=0,imported;
 const f={size:blob.size,slice(a,b){maxRead=Math.max(maxRead,b-a);return blob.slice(a,b);}};
 const env=setup({settings:{},before:true},{FileReader:class{readAsText(){throw new Error('whole-file read is forbidden');}}});env.c.fixture=f;env.c.apply=async d=>{imported=d;};
 await vm.runInContext('readJsonFile(fixture,apply)',env.c);
 assert.ok(imported,'import should reach apply without whole-file FileReader');assert.ok(maxRead<=262144);
 assert.equal(env.db.size,1);assert.ok(imported.images.every(s=>s===imported.images[0]&&s.startsWith('idb:')));
 imported.images=imported.images.map(s=>env.db.get(s.slice(4)));assert.equal(JSON.stringify(imported),JSON.stringify(original));
 assert.equal({}.safe,undefined);assert.equal(env.c.S.before,true);
});
test('truncated file and quota failure never publish partial state; retry remains available',async()=>{
 let calls=0;const env=setup({settings:{},before:true});env.c.apply=async()=>{calls++;};
 for(const raw of ['{"settings":{},"x":"unterminated','{"settings":{}} trailing','{"x":[1,]}']){env.c.fixture=new Blob([raw]);await vm.runInContext('readJsonFile(fixture,apply)',env.c);}
 env.c.imgPut=async()=>{throw new Error('quota fixture');};env.c.fixture=new Blob([JSON.stringify({settings:{},image:'data:image/png;base64,'+'A'.repeat(5000)})]);await vm.runInContext('readJsonFile(fixture,apply)',env.c);
 assert.equal(calls,0);assert.equal(env.c.S.before,true);assert.ok(env.events.some(s=>s.includes('quota fixture')));
 env.c.fixture=new Blob(['{"settings":{}}']);await vm.runInContext('readJsonFile(fixture,apply)',env.c);assert.equal(calls,1);
});
test('chunk boundaries preserve escaped quotes, backslashes, Unicode and JSON syntax',async()=>{
 const env=setup();const fixture={settings:{},items:Array.from({length:1200},(_,i)=>({s:'😀汉字\\\"\n\u0001'.repeat(i%61),n:i%2?-i*1e-22:i,b:i%2===0,empty:[],nil:null}))};
 env.c.fixture=new Blob([JSON.stringify(fixture)]);const result=await vm.runInContext('readBackupJson(fixture)',env.c);assert.equal(JSON.stringify(result),JSON.stringify(fixture));
});
test('export hydrates stored media and all three archives without touching live state',async()=>{
 const state={settings:{},messages:{__idb:'messages'},me:{phoneFriend:{id:'f',messages:{__idb:'phoneFriendMessages'},groupMessages:{__idb:'phoneFriendGroupMessages'}}}},env=setup(state);
 env.db.set('pic','data:image/png;base64,hello');env.db.set('__messages',JSON.stringify({a:[{img:'idb:pic'}]}));env.db.set('__pf_messages_f','{"f":[{"text":"friend"}]}');env.db.set('__pf_group_messages_f','{"g":[{"text":"group"}]}');
 await vm.runInContext('exportData()',env.c);const d=JSON.parse(await env.saved.text());assert.equal(d.messages.a[0].img,env.db.get('pic'));assert.equal(d.me.phoneFriend.messages.f[0].text,'friend');assert.equal(d.me.phoneFriend.groupMessages.g[0].text,'group');assert.equal(state.messages.__idb,'messages');
 env.db.delete('pic');await vm.runInContext('exportData()',env.c);assert.ok(env.events.some(x=>x.includes('缺图')));
});
test('export preserves surrogate pairs at string chunk boundaries and handles absent values',async()=>{
 const s='A'.repeat(65535)+'😀汉字\\\"\n'+'B'.repeat(70000),state={settings:{s},items:[undefined,null,NaN],sparse:Array(3),omit:undefined};const env=setup(state);await vm.runInContext('exportData()',env.c);assert.equal(await env.saved.text(),JSON.stringify(state));
});
test('partial media from a truncated backup is removed without changing existing stored images',async()=>{
 const env=setup();env.db.set('existing','preserve');env.c.fixture=new Blob(['{"settings":{},"img":'+JSON.stringify('data:image/png;base64,'+'C'.repeat(10000))+',"broken":']);env.c.apply=()=>{throw new Error('must not apply');};await vm.runInContext('readJsonFile(fixture,apply)',env.c);assert.deepEqual([...env.db],[['existing','preserve']]);assert.equal(vm.runInContext('_backupImportPins.size',env.c),0);
});
