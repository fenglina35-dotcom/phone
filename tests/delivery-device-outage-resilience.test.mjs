import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../delivery.js',import.meta.url),'utf8');
const privateSource=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/delivery.js',import.meta.url),'utf8');

function functionSource(name){
  const match=new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match,`missing ${name}`);
  const start=match.index;
  const open=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=open;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped)escaped=false;
      else if(ch==='\\\\')escaped=true;
      else if(ch===quote)quote='';
      continue;
    }
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const helpers=[
  functionSource('transientDeliveryServiceError'),
  functionSource('deliveryServiceErrorText'),
  functionSource('requestWithTransientRetry')
].join('\n');

function text(value,length=300){return String(value==null?'':value).trim().slice(0,length);}

{
  let calls=0;
  const context=vm.createContext({
    text,
    request:async()=>{calls++;if(calls===1)throw new Error('真实外卖服务响应超时');return{pairCode:'1234567890'};},
    setTimeout:fn=>{fn();return 1;},
    Error,
  });
  vm.runInContext(`${helpers};this.retry=requestWithTransientRetry;`,context);
  assert.equal((await context.retry('device_pairing_begin',{},15000)).pairCode,'1234567890');
  assert.equal(calls,2,'a transient pairing failure should retry exactly once');
}

{
  let calls=0;
  const context=vm.createContext({
    text,
    request:async()=>{calls++;throw new Error('配置无效');},
    setTimeout:fn=>{fn();return 1;},
    Error,
  });
  vm.runInContext(`${helpers};this.retry=requestWithTransientRetry;`,context);
  await assert.rejects(context.retry('device_pairing_begin',{},15000),/配置无效/);
  assert.equal(calls,1,'non-transient failures must not be retried');
}

{
  const state={deviceLinkStatus:{linked:true,online:true,deviceName:'朋友的电脑',deviceId:'device-1',at:100},_deviceStatusLoading:true};
  let saves=0,opens=0;
  const context=vm.createContext({
    text,
    request:async()=>{throw new Error('真实外卖服务 HTTP 502');},
    foodState:()=>state,
    save:()=>{saves++;},
    openSettings:()=>{opens++;},
    Date:{now:()=>200},
    Object,
    Error,
  });
  vm.runInContext(`${functionSource('transientDeliveryServiceError')}\n${functionSource('deliveryServiceErrorText')}\n${functionSource('refreshDeviceStatus')};this.refresh=refreshDeviceStatus;`,context);
  const result=await context.refresh(true);
  assert.equal(result.linked,true,'a cloud timeout must not erase a known binding');
  assert.equal(result.online,false,'online state is unknown during an outage');
  assert.equal(result.stale,true);
  assert.equal(result.deviceName,'朋友的电脑');
  assert.equal(result.error,'云端数据库暂时不可用，请稍后重试');
  assert.equal(result.at,100,'last successful check time must be preserved');
  assert.equal(result.lastAttemptAt,200);
  assert.equal(state._deviceStatusLoading,false);
  assert.equal(saves,1);
  assert.equal(opens,1);
}

assert.match(source,/暂时无法确认是否绑定/);
assert.doesNotMatch(source,/尚未绑定：'\+device\.error/);
for(const marker of ['transientDeliveryServiceError','deliveryServiceErrorText','refreshDeviceStatus']){
  assert.match(privateSource,new RegExp('(?:async\\s+)?function\\s+'+marker+'\\s*\\('),`private delivery outage function missing: ${marker}`);
}

console.log('delivery device outage resilience tests passed');
