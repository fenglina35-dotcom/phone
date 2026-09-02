import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const marker=`function ${name}(`,found=source.indexOf(marker),start=found>=6&&source.slice(found-6,found)==='async '?found-6:found;
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('public app avoids parse-blocking syntax used by older Huawei and QQ Android engines',()=>{
  assert.doesNotMatch(source,/\?\.[A-Za-z_$\[]/,'optional chaining would stop the entire app from parsing');
  assert.doesNotMatch(source,/(^|[^\\])\?\?/,'nullish coalescing would stop the entire app from parsing');
  assert.doesNotMatch(source,/\(\?<=|\(\?<!/,'lookbehind regex literals would stop the entire app from parsing');
  assert.match(source,/if\(!String\.prototype\.matchAll\)Object\.defineProperty\(String\.prototype,'matchAll'/,'matchAll receives a bounded compatibility fallback');
  assert.match(source,/if\(!Array\.prototype\.flatMap\)/,'flatMap receives a bounded compatibility fallback');
});

test('legacy punctuation helper preserves the existing output boundaries',()=>{
  const context=vm.createContext({Array,String,RegExp});
  vm.runInContext(functionSource('splitAfterPunctuation'),context);
  assert.deepEqual(Array.from(context.splitAfterPunctuation('第一句。第二句！尾巴','。！')),['第一句。','第二句！','尾巴']);
});

test('an Android IndexedDB open that never settles fails within the bounded startup window',async()=>{
  let timerMs=0;
  const context=vm.createContext({
    IMG_DB_VERSION:2,_idbOpenFailure:'',indexedDB:{open:()=>({error:null})},
    setTimeout:fn=>{timerMs=7000;queueMicrotask(fn);return 1;},clearTimeout:()=>{},
    Promise,Error,String,Object,Array,queueMicrotask,
  });
  vm.runInContext(functionSource('imgDB'),context);
  await assert.rejects(context.imgDB(),/IndexedDB open timeout/);
  assert.equal(timerMs,7000);
  assert.match(context._idbOpenFailure,/timeout/);
});

test('orphan-core probing blocks blank writes until recovery has finished',()=>{
  assert.match(functionSource('saveNow'),/_coreBootRef\|\|\(typeof _androidOrphanCoreProbe!=='undefined'&&_androidOrphanCoreProbe\)/);
  assert.match(functionSource('bootOverflowCore'),/已停止空白启动以保护原存档/);
});
