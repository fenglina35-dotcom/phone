import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root=process.cwd();
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const app=read('app.js');
const shell=read('小手机.html');
const index=read('index.html');
const repair=read('repair.html');
const worker=read('sw.js');
const hotfix=read('web-hotfix.js');

function functionSource(name){
  const asyncStart=app.indexOf(`async function ${name}(`),start=asyncStart>=0?asyncStart:app.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=app.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('v1148 has a unique visible identity across every public entry and cache layer',()=>{
  assert.match(app,/__NORTH_SHELL_BUILD__!==\'1148\'/);
  assert.match(app,/APP_VER='v1148 · 安卓启动与模型路线修复版'/);
  assert.match(shell,/__NORTH_SHELL_BUILD__='1148'/);
  assert.match(shell,/app\.js\?v=1148&r=v1148-android-startup-route-1/);
  assert.match(index,/小手机\.html\?v=1148/);
  assert.match(repair,/小手机\.html\?v=1148/);
  assert.match(worker,/const BUILD='1148'/);
  assert.match(worker,/north-shell-v1148-android-startup-route-1/);
  assert.match(hotfix,/sw\.js\?v=1148&r=v1148-android-startup-route-1/);
  for(const [name,source] of Object.entries({app,shell,index,repair,worker,hotfix})){
    assert.doesNotMatch(source,/v?1127/,`${name} must not reuse the prior web version`);
  }
});

test('the published backup path crosses the private bridge in bounded unicode-safe chunks',async()=>{
  const calls=[],received=[];
  const context=vm.createContext({
    JSON,Object,String,Math,Promise,setTimeout,Buffer,
    privatePhoneAccountCall:async(action,payload)=>{
      calls.push(action);
      if(action==='account.backup.begin')return{transferId:'v1148-transfer',chunkCharacters:49152};
      if(action==='account.backup.chunk'){
        received.push(payload.chunk);
        return{accepted:true,nextOffset:Buffer.byteLength(received.join(''),'utf8')};
      }
      if(action==='account.backup.commit')return{ok:true,byteCount:payload.byteCount};
      if(action==='account.backup.cancel')return{cancelled:true};
      throw new Error(`unexpected ${action}`);
    }
  });
  vm.runInContext(`${functionSource('privatePhoneBackupChunkEnd')}\n${functionSource('privatePhoneAccountBackupUpload')}\nthis.upload=privatePhoneAccountBackupUpload;`,context);
  const snapshot={settings:{ok:true},value:'a'.repeat(49151)+'😀'+'中'.repeat(55000)};
  const result=await context.upload(snapshot,{capturedAt:1148});
  assert.equal(result.ok,true);
  assert.equal(received.join(''),JSON.stringify(snapshot));
  assert.ok(received.length>=3);
  assert.ok(received.every(chunk=>Buffer.byteLength(chunk,'utf8')<=256*1024));
  assert.deepEqual(calls.filter(x=>x.startsWith('account.backup.')),['account.backup.begin',...received.map(()=> 'account.backup.chunk'),'account.backup.commit']);
  assert.doesNotMatch(functionSource('privatePhoneCloudBackup'),/account\.backup\.upload/);
});

test('offline replies honor the selected role route and preserve genuine failure evidence',()=>{
  const off=functionSource('offAI'),retry=functionSource('offlineReplyChatRequest');
  assert.match(off,/routeIndex=roleChatRouteIndex\(c\)/);
  assert.match(off,/offlineReplyChatRequest\(req/);
  assert.match(retry,/offlineReplyTransportRetryable/);
  assert.match(retry,/setTimeout\(resolve,450\)/);
  assert.match(retry,/retryCount=Math\.max\(1/);
  assert.match(app,/function roleInterceptDiagnosticTurnFailure\(/);
  assert.match(app,/kind:'request-failure'/);
  assert.match(app,/上一轮回复失败依据/);
  assert.match(app,/这轮请求在取得可显示回复前失败，所以没有“被拦截正文”/);
});
