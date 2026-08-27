import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bundled=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

function functionSource(source,name){
  const fnStart=source.indexOf('function '+name+'(');
  assert.ok(fnStart>=0,'missing '+name);
  const start=source.slice(Math.max(0,fnStart-6),fnStart)==='async '?fnStart-6:fnStart;
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

test('a completed generated image is durably stored before the UI reports completion',()=>{
  assert.equal(root,bundled);
  const fill=functionSource(root,'fillGenImage');
  assert.match(fill,/await primeImageForSave\(msg\.src\)/);
  assert.match(fill,/await persistWechatMessagesNow\(\)/);
  assert.match(fill,/delete msg\.genPrompt/);
  assert.doesNotMatch(fill,/setTimeout\(\(\)=>fillGenImage/,'successful persistence must never schedule another model generation');
});

test('an interrupted assistant generation becomes a manual retry, never an automatic model call',()=>{
  const sandbox=vm.createContext({S:{messages:{a:[{id:'done',role:'assistant',type:'image',src:'data:image/png;base64,AA',pending:false},{id:'stale',role:'assistant',type:'image',src:'',pending:true,genPrompt:'一张照片'}]}}});
  vm.runInContext('this.repair='+functionSource(root,'repairStaleGeneratedImageStates'),sandbox);
  assert.equal(sandbox.repair(),true);
  const stale=sandbox.S.messages.a[1];
  assert.equal(stale.pending,false);
  assert.equal(stale.failed,true);
  assert.match(stale.errText,/点图片位置重试/);
  assert.equal(sandbox.S.messages.a[0].failed,undefined,'already completed images must remain completed');
});

test('a storage failure keeps the already generated image and never spends another generation call',async()=>{
  let generated=0,saved=0;
  const sandbox=vm.createContext({
    genImage:async()=>{generated++;return 'https://image.test/result.png';},
    stableImageSrc:async()=> 'data:image/png;base64,AA',
    primeImageForSave:async()=>{throw new Error('quota');},
    persistWechatMessagesNow:async()=>false,
    saveNow:()=>{saved++;},cur:()=>({p:'home'}),setTimeout,render:()=>{},Date,
  });
  vm.runInContext('this.fill='+functionSource(root,'fillGenImage'),sandbox);
  const msg={pending:true,genPrompt:'一张照片',genOptions:{roleId:'c1'}};
  await sandbox.fill(msg,msg.genPrompt);
  assert.equal(generated,1);
  assert.equal(msg.src,'data:image/png;base64,AA');
  assert.equal(msg.pending,false);
  assert.equal(msg.failed,false);
  assert.equal(msg.genPrompt,undefined);
  assert.equal(msg.persistWarning,true);
  assert.match(msg.errText,/不会自动重新生图/);
  assert.equal(saved,1);
});
