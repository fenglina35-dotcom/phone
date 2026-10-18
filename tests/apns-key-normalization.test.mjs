import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

function loadPemBytes(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('function pemBytes(');
  const end = source.indexOf('\n}\n', start) + 3;
  const fn = source.slice(start, end).replace('pem: string', 'pem');
  const context = vm.createContext({ Uint8Array, TextDecoder, String, JSON, Error, atob });
  vm.runInContext(`${fn};globalThis.pemBytes=pemBytes`, context);
  return context.pemBytes;
}

const der = Uint8Array.from([0x30, 0x06, 0x02, 0x01, 0x00, 0x04, 0x01, 0x01]);
const base64 = Buffer.from(der).toString('base64');
const pem = `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;

for (const path of [
  '../supabase/functions/phone-role-push/index.ts',
  '../supabase/functions/phone-companion-push/index.ts',
]) {
  test(`${path} accepts escaped and base64-wrapped APNs p8 secrets`, () => {
    const decode = loadPemBytes(path);
    assert.deepEqual([...decode(JSON.stringify(pem))], [...der]);
    assert.deepEqual([...decode(Buffer.from(pem).toString('base64'))], [...der]);
  });
}


// APNS_ENV_FALLBACK_V1: only a definite BadDeviceToken rejection may try the other APNs environment.
function apnsTransport(replies){
 const s=fs.readFileSync(new URL('../supabase/functions/phone-role-push/index.ts',import.meta.url),'utf8'),start=s.indexOf('async function apnsFetch('),end=s.indexOf('\nasync function sendAPNs(',start),calls=[];
 const ctx={AbortController,AbortSignal,setTimeout,clearTimeout,Response,pushException:e=>String(e),fetch:async(url,init)=>{calls.push({url,body:init.body});const next=replies.shift();if(next instanceof Error)throw next;return new Response(JSON.stringify(next?.body||{}),{status:next?.status||200});}};
 vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(s.slice(start,end),{mode:'strip'}),ctx);return{calls,run:env=>ctx.apnsFetch('https://'+(env==='sandbox'?'api.sandbox.push.apple.com':'api.push.apple.com')+'/3/device/fixture',{method:'POST',body:'same-payload'})};
}
for(const env of ['production','sandbox'])test('APNs '+env+' BadDeviceToken tries exactly the other environment after definite rejection',async()=>{const t=apnsTransport([{status:400,body:{reason:'BadDeviceToken'}},{status:200}]),r=await t.run(env);assert(r.response.ok);assert.equal(t.calls.length,2);assert.notEqual(new URL(t.calls[0].url).host,new URL(t.calls[1].url).host);assert.equal(t.calls[0].body,t.calls[1].body);});
for(const [status,reason] of [[200,''],[400,'DeviceTokenNotForTopic'],[400,'BadTopic'],[403,'InvalidProviderToken'],[429,'TooManyRequests'],[500,'InternalServerError']])test('APNs '+status+' '+reason+' never changes environment',async()=>{const t=apnsTransport([{status,body:{reason}}]);await t.run('production');assert.equal(t.calls.length,1);});
test('APNs both environments rejecting does not loop or pretend success',async()=>{const t=apnsTransport([{status:400,body:{reason:'BadDeviceToken'}},{status:400,body:{reason:'BadDeviceToken'}}]);const r=await t.run('production');assert.equal(r.response.status,400);assert.equal(t.calls.length,2);});
test('APNs uncertain network outcome does not trigger cross-environment fallback',async()=>{const t=apnsTransport([new Error('fixture network'),new Error('fixture network')]);const r=await t.run('production');assert.equal(r.response,null);assert.equal(t.calls.length,2);assert.equal(t.calls[0].url,t.calls[1].url);});
