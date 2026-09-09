import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const nativeRoot=path.join(root,'native','private-small-phone');
const xcodeRoot=path.join(nativeRoot,'XcodeProject','PhoneCompanionTest');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const swift=fs.readFileSync(path.join(xcodeRoot,'HomeKitClimateBridge.swift'),'utf8');
const bridge=fs.readFileSync(path.join(xcodeRoot,'PhoneNativeBridge.swift'),'utf8');
const airSource=fs.readFileSync(path.join(nativeRoot,'Resources','Web','private-smart-air.js'),'utf8');
const airBundle=fs.readFileSync(path.join(xcodeRoot,'PhoneWeb.bundle','private-smart-air.js'),'utf8');
const airCss=fs.readFileSync(path.join(nativeRoot,'Resources','Web','private-smart-air.css'),'utf8');
const lockSource=fs.readFileSync(path.join(nativeRoot,'Resources','Web','private-smart-lock.js'),'utf8');
const privateIndex=fs.readFileSync(path.join(xcodeRoot,'PhoneWeb.bundle','index.html'),'utf8');

test('native climate bridge discovers both standard HomeKit climate services',()=>{
  assert.match(swift,/HMServiceTypeHeaterCooler/);
  assert.match(swift,/HMServiceTypeThermostat/);
  assert.match(swift,/HMCharacteristicTypeActive/);
  assert.match(swift,/HMCharacteristicTypeCurrentTemperature/);
  assert.match(swift,/HMCharacteristicTypeTargetTemperature/);
  assert.match(swift,/HMCharacteristicTypeTargetHeatingCooling/);
  assert.match(swift,/HMCharacteristicTypeTargetHeaterCoolerState/);
});

test('temperature and optional fan speed require writable fresh readback',()=>{
  assert.match(swift,/HMCharacteristicTypeRotationSpeed/);
  assert.match(swift,/supportsFanSpeed/);
  assert.match(swift,/properties\.contains\(HMCharacteristicPropertyWritable\)/);
  assert.match(swift,/verifyReadback/);
  assert.match(swift,/homekit_climate_readback_mismatch/);
  assert.match(swift,/"verified": true/);
});

test('private native contract exposes climate snapshot and command without changing public web',()=>{
  assert.match(bridge,/static let contractVersion = 37/);
  assert.match(bridge,/case "homekit\.climates\.snapshot"/);
  assert.match(bridge,/case "homekit\.climate\.command"/);
  assert.equal(read('app.js').includes('homekit.climates.snapshot'),false);
  assert.equal(read('小手机.html').includes('private-smart-air'),false);
});

test('air UI is private-only, mirrored byte-for-byte, and loaded after lock overlay',()=>{
  assert.equal(airSource,airBundle);
  assert.equal(airCss,fs.readFileSync(path.join(xcodeRoot,'PhoneWeb.bundle','private-smart-air.css'),'utf8'));
  assert.match(privateIndex,/private-smart-air\.css\?v=342/);
  assert.match(privateIndex,/private-smart-lock\.js\?v=339[^]*private-smart-air\.js\?v=1224/);
  assert.match(lockSource,/privateSmartAirChooserCard/);
  const staging=read('native/private-small-phone/scripts/stage-private-phone-web.mjs');
  assert.match(staging,/path\.join\(privateRoot, 'Resources', 'Web'\)/);
  assert.match(staging,/readdir\(privateWebRoot/);
});

function runtime(){
  let route={p:'wxsmarthome'};const calls=[];
  const context={console,Date,Promise,Math,JSON,String,Number,Array,Object,Set,RegExp,
    S:{settings:{},couple:{cid:'role-1'},me:{name:'小北'},messages:{}},
    document:{hidden:false,addEventListener(){},getElementById(){return null;}},
    setTimeout(){return 1;},setInterval(){return 1;},clearTimeout(){},
    save(){},cur(){return route;},render(){},toast(){},back(){},go(){},
    getC(){return{id:'role-1',name:'角色',deleted:false,blocked:false};},
    roleVisibleEnvelopeText(value){return String(value||'');},
    renderWxSmartHome(){return'<div id="original-light">卧室小灯原页面</div>';},
    smartHomeRolePrompt(){return'灯提示';},
    async smartHomeRoleFinalize(content){return{content,matched:false};},
    SmallPhoneNative:{async request(action,payload){calls.push({action,payload});return{ok:true};}},
    __SMALL_PHONE_PRIVATE__:true
  };
  context.window=context;vm.createContext(context);
  vm.runInContext(lockSource,context,{filename:'private-smart-lock.js'});
  vm.runInContext(airSource,context,{filename:'private-smart-air.js'});
  return{context,calls,setRoute(next){route=next;}};
}

const climate={accessoryId:'air-a',serviceId:'air-s',accessoryName:'空调',roomName:'卧室',reachable:true,complete:true,power:true,mode:'cool',currentTemperature:28,targetTemperature:25,minimumTemperature:16,maximumTemperature:30,temperatureStep:1,supportsTemperature:true,supportsFanSpeed:true,fanSpeed:60,minimumFanSpeed:0,maximumFanSpeed:100,fanSpeedStep:10,supportedModes:['auto','heat','cool'],manufacturer:'LENGCEOI.COM',model:'ACN1-AIR'};

test('air is a third independent page and leaves light and lock renderers intact',()=>{
  const r=runtime();r.context.__privateSmartAirTest.applySnapshot({ok:true,climates:[climate]});
  const chooser=r.context.renderWxSmartHome();
  assert.match(chooser,/卧室小灯/);assert.match(chooser,/家庭门锁/);assert.match(chooser,/空调/);assert.match(chooser,/air-card running/);
  r.setRoute({p:'wxsmarthome',device:'light'});assert.equal(r.context.renderWxSmartHome(),'<div id="original-light">卧室小灯原页面</div>');
  r.setRoute({p:'wxsmarthome',device:'lock'});assert.match(r.context.renderWxSmartHome(),/智能门锁/);
  r.setRoute({p:'wxsmarthome',device:'air'});const page=r.context.renderWxSmartHome();
  assert.match(page,/智能空调/);assert.match(page,/卧室空调|空调/);assert.match(page,/制冷中/);assert.match(page,/25℃/);assert.match(page,/室内 28℃/);assert.match(page,/风速/);assert.match(page,/60%/);assert.match(page,/ACN1-AIR/);
  assert.doesNotMatch(page,/Face ID|卧室小灯/);
});

test('fan controls disappear when HomeKit does not expose a writable fan speed',()=>{
  const r=runtime();r.context.__privateSmartAirTest.applySnapshot({ok:true,climates:[{...climate,supportsFanSpeed:false,fanSpeed:undefined}]});r.setRoute({p:'wxsmarthome',device:'air'});const page=r.context.renderWxSmartHome();
  assert.doesNotMatch(page,/>风速</);assert.doesNotMatch(page,/privateSmartAirFan/);
});

test('temperature controls never invent a writable 25 degree fallback',()=>{
  const r=runtime();r.context.__privateSmartAirTest.applySnapshot({ok:true,climates:[{...climate,supportsTemperature:false,targetTemperature:undefined}]});r.setRoute({p:'wxsmarthome',device:'air'});const page=r.context.renderWxSmartHome();
  assert.match(page,/目标温度未提供/);
  assert.doesNotMatch(page,/privateSmartAirTemperature/);
  assert.doesNotMatch(page,/>25℃</);
});

test('ACN1 heater-cooler uses its active mode threshold instead of an unrelated generic target',async()=>{
  const r=runtime(),state={...climate,serviceKind:'heaterCooler',targetTemperature:25,coolingTargetTemperature:20,heatingTargetTemperature:28,mode:'cool'};
  r.context.__privateSmartAirTest.applySnapshot({ok:true,climates:[state]});
  r.setRoute({p:'wxsmarthome',device:'air'});
  const page=r.context.renderWxSmartHome();
  assert.match(page,/20℃/);
  assert.doesNotMatch(page,/25(?:\.0)?℃/);
  r.context.SmallPhoneNative.request=async(action,payload)=>{r.calls.push({action,payload});return{ok:true,verified:true,state:{...state,coolingTargetTemperature:payload.value,targetTemperature:payload.value}};};
  await r.context.privateSmartAirTemperature(1);
  assert.equal(r.calls.at(-1).payload.action,'temperature');
  assert.equal(r.calls.at(-1).payload.value,21);
});

test('mode buttons only expose modes reported by HomeKit',()=>{
  const r=runtime(),api=r.context.__privateSmartAirTest;api.applySnapshot({ok:true,climates:[{...climate,supportedModes:['heat','cool']}]});r.setRoute({p:'wxsmarthome',device:'air'});const page=r.context.renderWxSmartHome();
  assert.match(page,/>制热</);assert.match(page,/>制冷</);assert.doesNotMatch(page,/>自动</);
  assert.equal(api.airDecision('[智能家电|空调|mode=auto]',{id:'role-1'}).valid,false);
});

test('three-level fan decreases from 100 to the real 66 percent step',async()=>{
  const r=runtime(),state={...climate,fanSpeed:100,fanSpeedStep:1,fanControlValues:[33,66,100]};
  r.context.__privateSmartAirTest.applySnapshot({ok:true,climates:[state]});
  r.context.SmallPhoneNative.request=async(action,payload)=>{r.calls.push({action,payload});return{ok:true,verified:true,state:{...state,fanSpeed:payload.value}};};
  const result=await r.context.privateSmartAirFan(-1);
  assert.equal(result.verified,true);
  assert.equal(r.calls.at(-1).payload.action,'fan');
  assert.equal(r.calls.at(-1).payload.value,66);
});

test('role context states the last read power mode temperature and fan without guessing',()=>{
  const r=runtime();r.context.__privateSmartAirTest.applySnapshot({ok:true,climates:[{...climate,readAt:'2026-09-09T18:05:00Z'}]});
  const prompt=r.context.smartHomeRolePrompt({id:'role-1'});
  assert.match(prompt,/当前为开启/);assert.match(prompt,/模式为制冷/);assert.match(prompt,/设定温度25℃/);assert.match(prompt,/室内温度28℃/);assert.match(prompt,/风速60%/);assert.match(prompt,/最近读取时间/);
});

test('role may autonomously care, but ordinary hot or cold words never directly trigger native commands',()=>{
  const r=runtime(),api=r.context.__privateSmartAirTest;r.context.__privateSmartAirTest.applySnapshot({ok:true,climates:[climate]});
  assert.equal(api.airDecision('好热啊',{id:'role-1'}),null);
  const decision=api.airDecision('[智能家电|空调|power=on|mode=cool|temperature=24|fan=70]',{id:'role-1'});
  assert.equal(decision.valid,true);assert.equal(decision.temperature,24);assert.equal(decision.fan,70);
  assert.match(r.context.smartHomeRolePrompt({id:'role-1'}),/主动决定开关、模式、温度或风速/);
  assert.equal(r.calls.some(x=>x.action==='homekit.climate.command'),false);
});

test('air action tags are removed from visible messages and cannot mix with another device',()=>{
  const r=runtime(),api=r.context.__privateSmartAirTest;
  assert.equal(api.stripAirTags('好了\n[智能家电|空调|temperature=24]'),'好了');
  assert.equal(api.airDecision('[智能家电|空调|power=on]\n[智能家电|门锁|action=lock]',{id:'role-1'}).valid,false);
});

test('role air actions execute in order and only produce a reply after verified readback',async()=>{
  const r=runtime(),finalState={...climate,targetTemperature:24,fanSpeed:70};
  r.context.__privateSmartAirTest.applySnapshot({ok:true,climates:[climate]});
  r.context.SmallPhoneNative.request=async(action,payload)=>{
    r.calls.push({action,payload});
    return{ok:true,verified:true,state:finalState};
  };
  const result=await r.context.smartHomeRoleFinalize(
    '先照顾她。\n[智能家电|空调|power=on|mode=cool|temperature=24|fan=70]',
    {id:'role-1',name:'角色'},
    '好热啊',
    async prompt=>{assert.match(prompt,/已重新读取并确认/);return'给你调到舒服一点了。';}
  );
  assert.equal(result.verified,true);
  assert.equal(result.content,'给你调到舒服一点了。');
  assert.deepEqual(r.calls.map(item=>item.payload.action),['power','mode','temperature','fan']);
  assert.ok(r.calls.every(item=>item.payload.source==='role'));
});

test('private identity advances while public web stays unchanged',()=>{
  const privateApp=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js');
  const webView=read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
  const project=read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');
  assert.match(privateApp,/APP_VER='v1229 · 私人语音修复与日常事件簿'/);
  assert.match(webView,/1\.0\.352 \(352\)/);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 352;/g)||[]).length,12);
  assert.equal((project.match(/MARKETING_VERSION = 1\.0\.352;/g)||[]).length,12);
  assert.match(read('app.js'),/APP_VER='v1229 · 语音修复与日常事件簿'/);
});
