import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root=process.cwd();
const web=fs.readFileSync(path.join(root,'app.js'),'utf8');
const privateApp=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneWeb.bundle','app.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneNativeBridge.swift'),'utf8');
const webView=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','LocalPhoneWebView.swift'),'utf8');

function functionSource(source,name){
  const asyncStart=source.indexOf(`async function ${name}(`),start=asyncStart>=0?asyncStart:source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('private phone backup crosses the native bridge in bounded unicode-safe chunks',async()=>{
  const calls=[],received=[];
  const context=vm.createContext({
    JSON,Object,String,Math,Promise,setTimeout,
    privatePhoneAccountCall:async(action,payload)=>{
      calls.push(action);
      if(action==='account.backup.begin')return{transferId:'transfer-1',chunkCharacters:49152};
      if(action==='account.backup.chunk'){
        received.push(payload.chunk);
        return{accepted:true,nextOffset:Buffer.byteLength(received.join(''),'utf8')};
      }
      if(action==='account.backup.commit')return{ok:true,byteCount:payload.byteCount};
      if(action==='account.backup.cancel')return{cancelled:true};
      throw new Error(`unexpected ${action}`);
    },
    Buffer
  });
  vm.runInContext(`${functionSource(web,'privatePhoneBackupChunkEnd')}\n${functionSource(web,'privatePhoneAccountBackupUpload')}\nthis.upload=privatePhoneAccountBackupUpload;`,context);
  const value='a'.repeat(49151)+'😀'+'中'.repeat(55000),snapshot={settings:{ok:true},value};
  const result=await context.upload(snapshot,{capturedAt:123});
  assert.equal(result.ok,true);
  assert.equal(received.join(''),JSON.stringify(snapshot),'chunk boundaries must preserve surrogate pairs and all JSON bytes');
  assert.deepEqual(calls.filter(x=>x.startsWith('account.backup.')),['account.backup.begin',...received.map(()=> 'account.backup.chunk'),'account.backup.commit']);
  assert.ok(received.length>=3,'large snapshots must not cross as one bridge message');
  assert.ok(received.every(chunk=>Buffer.byteLength(chunk,'utf8')<=256*1024),'every bridge chunk stays under the native bound');
});

test('web and bundled private app use the same chunked upload and native commit is off-main-thread prepared',()=>{
  for(const name of ['privatePhoneBackupChunkEnd','privatePhoneAccountBackupUpload']){
    assert.equal(functionSource(privateApp,name),functionSource(web,name),`${name} must match in both entry copies`);
  }
  assert.match(web,/privatePhoneAccountBackupUpload\(snapshot,\{capturedAt:/);
  assert.doesNotMatch(functionSource(web,'privatePhoneCloudBackup'),/account\.backup\.upload/,'the active backup path must not send one giant object');
  for(const action of ['account.backup.begin','account.backup.chunk','account.backup.commit','account.backup.cancel'])assert.match(bridge,new RegExp(action.replaceAll('.','\\.')));
  assert.match(bridge,/Task\.detached\(priority: \.utility\)/,'large JSON validation and request-body construction must leave MainActor');
  assert.match(bridge,/privateBackupChunkMaximumBytes = 256 \* 1_024/);
  assert.match(bridge,/timeoutInterval: 120/,'native upload gets an explicit total request window');
  assert.match(webView,/action === 'account\.backup\.commit' \? 150000/,'the web bridge must wait longer than the native upload window');
});
