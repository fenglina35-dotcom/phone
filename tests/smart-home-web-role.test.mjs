import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const feature=fs.readFileSync(new URL('../smart-home.js',import.meta.url),'utf8');
const services=fs.readFileSync(new URL('../wechat-me.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../wechat-me.css',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-smart-home/index.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202609020005_phone_smart_home_device_relay.sql',import.meta.url),'utf8');
const privateBase='../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const privateApp=fs.readFileSync(new URL(privateBase+'app.js',import.meta.url),'utf8');
const privateHtml=fs.readFileSync(new URL(privateBase+'小手机.html',import.meta.url),'utf8');
const privateFeature=fs.readFileSync(new URL(privateBase+'smart-home.js',import.meta.url),'utf8');
const privateServices=fs.readFileSync(new URL(privateBase+'wechat-me.js',import.meta.url),'utf8');
const privateCss=fs.readFileSync(new URL(privateBase+'wechat-me.css',import.meta.url),'utf8');

assert.match(html,/smart-home\.js\?v=\d+/,'public shell must load the smart-home runtime');
assert.match(services,/wxServiceTile\('smarthome','智能家电'/,'service page must expose a smart-home tile');
assert.match(services,/smarthome:'<path/,'smart-home icon must be a repo-native outline');
assert.doesNotMatch(services.match(/smarthome:'([^']+)'/)?.[1]||'',/circle|bulb|灯/,'service icon must retain only the house outline');
assert.match(css,/\.wx-smart-home-page/);
assert.match(css,/linear-gradient\(180deg,#080808/,'page must use the approved black-led monochrome treatment');
assert.match(app,/c\.p==='wxsmarthome'/,'router must expose the standalone page');
assert.match(app,/function smartHomeRoleDecision/,'role action must pass through an explicit parser');
assert.match(app,/角色一次给出了多个灯控动作，未执行/);
assert.match(app,/角色灯控动作超出白名单/);
assert.match(app,/smartHomeRoleColorMismatch/,'named color claims must be checked against the returned state');
assert.match(app,/channel=privateNativeAppOn\(\)\?'真实 HomeKit':'Windows 助手'/,'role finalization must name the active private or web execution channel');
assert.match(app,/smartHomeRoleFinalize\(content,c,_userText/,'chat replies must wait for smart-home finalization');
assert.match(app,/smartHomeRoleFinalize\(content,c,\(_luc/,'call replies must wait for smart-home finalization');
assert.match(privateHtml,/smart-home\.js\?v=\d+/,'private shell must load every public smart-home runtime');
assert.match(privateServices,/wxServiceTile\('smarthome','智能家电'/,'private service page must expose the same smart-home entry');
assert.match(privateCss,/\.wx-smart-home-page/,'private package must carry the smart-home page styles');
assert.match(privateApp,/c\.p==='wxsmarthome'/,'private router must expose the smart-home page');
assert.match(privateApp,/function smartHomeRoleDecision/,'private role replies must use the same smart-home whitelist parser');
assert.doesNotMatch(privateApp,/^\+function smartHomeRoleAvailable/m,'a patch marker must never turn the private availability declaration into an unbound function expression');
assert.match(privateApp,/^function smartHomeRoleAvailable/m,'private role availability must be a real global declaration');
assert.match(privateApp,/typeof smartHomeRoleAvailable!==['"]function['"]/,'missing optional smart-home code must never block ordinary role replies');
assert.match(privateApp,/smartHomeRoleFinalize\(content,c,_userText/,'private chat replies must wait for verified device state');
assert.match(privateApp,/smartHomeRoleFinalize\(content,c,\(_luc/,'private calls must wait for verified device state');
assert.equal(privateFeature.replace(/\r\n/g,'\n'),feature.replace(/\r\n/g,'\n'),'private package must embed the complete public smart-home runtime');

assert.match(feature,/response\.status===202/,'web must poll the same pending job');
assert.match(feature,/result\.verified!==true/,'unverified control results must be rejected');
assert.match(feature,/requestKey:requestKey\(\)/,'each real action must have an idempotency key');
assert.match(feature,/window\.wxSmartHomeRoleExecute=execute/);
assert.match(feature,/连接 Windows 助手/,'fresh web users must see the Windows pairing panel instead of the old preview');
assert.match(feature,/生成十位配对码/,'pairing must be available from the standalone page');
assert.doesNotMatch(feature,/wifi.*password|password.*wifi/i,'web source must not collect a Wi-Fi password');

assert.match(edge,/new Set\(\["power","brightness","color","hue","saturation","warmth"\]\)/);
assert.match(migration,/action text not null check \(action in \('snapshot','control'\)\)/);
assert.match(migration,/device_secret_hash=public\.phone_companion_hash\(p_device_secret\)/,'device pulls require the independent device secret');
assert.match(migration,/created_at<now\(\)-interval '1 minute'/,'stale device jobs must expire');
assert.match(migration,/grant execute on function public\.phone_smart_home_pull[^\n]+ to anon,authenticated/);
assert.doesNotMatch(migration,/grant\s+(?:select|insert|update|delete).*phone_smart_home_/i,'raw relay tables must never be exposed');

const worker=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.match(worker,/\.\/smart-home\.js\?v='\+BUILD/,'offline cache must include the public smart-home runtime');

const runtime={
  window:{},S:{settings:{}},COMPANION_URL:'https://example.invalid',COMPANION_KEY:'public-test-key',
  uid:()=> 'test-id',crypto:{getRandomValues:value=>value.fill(7),randomUUID:()=> '00000000-0000-4000-8000-000000000000'},
  localStorage:{getItem:()=>'',setItem:()=>{}},setTimeout:()=>0,setInterval:()=>0,clearTimeout:()=>{},
  esc:value=>String(value),save:()=>{},render:()=>{},cur:()=>({p:'wxsmarthome'}),toast:()=>{},openModal:()=>{},closeModal:()=>{},
  confirm:()=>false,document:{getElementById:()=>null},fetch:async()=>{throw new Error('test must not call cloud');},AbortController:globalThis.AbortController,
  Number,Math,String,Object,Array,Promise,Error,RegExp,JSON,Date,Set,console
};
runtime.window=runtime;
vm.runInNewContext(feature,runtime);
const freshPage=runtime.renderWxSmartHome();
assert.match(freshPage,/连接电脑助手/,'an unpaired browser must render the real pairing page');
assert.match(freshPage,/生成十位配对码/);
assert.doesNotMatch(freshPage,/角色控制待接入|预览/,'the retired private preview must not be rendered on public web');
assert.doesNotMatch(freshPage,/HomeKit|苹果家庭/,'ordinary web users must not be offered the private native HomeKit route');

const nativeCalls=[];
const privateRuntime={...runtime,window:null,S:{settings:{}},__SMALL_PHONE_PRIVATE__:true,
  SmallPhoneNative:{request:async(action,payload)=>{
    nativeCalls.push({action,payload});
    if(action==='homekit.lights.snapshot')return{ok:true,readAt:'2026-09-04T03:20:00Z',lights:[{homeName:'我的家',roomName:'卧室',accessoryId:'a',serviceId:'s',accessoryName:'床头灯',reachable:true,complete:true,power:false,brightness:35,hue:335,saturation:60}]};
    assert.equal(action,'homekit.light.command');
    assert.equal(payload.accessoryId,'a');
    assert.equal(payload.serviceId,'s');
    return{ok:true,verified:true,verifiedAt:'2026-09-04T03:21:00Z',state:{homeName:'我的家',roomName:'卧室',accessoryId:'a',serviceId:'s',accessoryName:'床头灯',reachable:true,complete:true,power:payload.action==='power'?payload.value:true,brightness:payload.action==='brightness'?payload.value:35,hue:payload.action==='color'?payload.hue:335,saturation:payload.action==='color'?payload.saturation:60}};
  }}
};
privateRuntime.window=privateRuntime;
vm.runInNewContext(feature,privateRuntime);
const privateFresh=privateRuntime.renderWxSmartHome();
assert.match(privateFresh,/允许访问苹果家庭/,'a fresh private App must ask for native Home permission');
assert.match(privateFresh,/不需要连接电脑/);
assert.doesNotMatch(privateFresh,/生成十位配对码|连接 Windows 助手/,'the private App must never fall back to the web computer pairing panel');
assert.equal(await privateRuntime.wxSmartHomeConnect(),true);
const privateLinked=privateRuntime.renderWxSmartHome();
assert.match(privateLinked,/iPhone · HomeKit 直连/);
assert.match(privateLinked,/HomeKit 已连接/);
const privateControlled=await privateRuntime.wxSmartHomeRoleExecute({power:'on',brightness:48,color:'pink'});
assert.equal(privateControlled.verified,true);
assert.deepEqual(nativeCalls.slice(1).map(row=>[row.action,row.payload.action]),[
  ['homekit.light.command','power'],
  ['homekit.light.command','brightness'],
  ['homekit.light.command','color'],
]);
assert.equal(nativeCalls.at(-1).payload.hue,335);
assert.equal(nativeCalls.at(-1).payload.saturation,60);

console.log('smart-home web and role security tests passed');
