const fs=require('fs');
const path=require('path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const bundle=path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneWeb.bundle');
const index=fs.readFileSync(path.join(bundle,'index.html'),'utf8');
const baseCss=[...index.matchAll(/<style>([^]*?)<\/style>/g)].map(match=>match[1]).join('\n');
const lockCss=fs.readFileSync(path.join(bundle,'private-smart-lock.css'),'utf8');
const airCss=fs.readFileSync(path.join(bundle,'private-smart-air.css'),'utf8');
const wechatCss=fs.readFileSync(path.join(bundle,'wechat-me.css'),'utf8');
const airJs=path.join(bundle,'private-smart-air.js');
const output=path.join(root,'artifacts','private-air-page-v1217.png');
fs.mkdirSync(path.dirname(output),{recursive:true});

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:430,height:900},deviceScaleFactor:2});
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}\n${wechatCss}\n${lockCss}\n${airCss}\nbody{padding:10px;background:#1d2428}.phone{width:390px;height:844px;max-height:none;padding:0;border-radius:44px;background:#050607;box-shadow:0 28px 80px rgba(0,0,0,.48)}.screen{border-radius:44px;background:#050607}.statusbar{height:48px;flex-basis:48px;padding:10px 26px 0;font-size:14px}.preview-icons{letter-spacing:3px}.island{top:10px;width:112px;height:30px}.wx-smart-home-page{padding:0 18px 24px}.wx-smart-home-nav{flex:0 0 auto}.wx-real-nav.titled{height:55px}</style></head><body><div class="phone"><div class="screen"><div class="island"></div><div class="statusbar"><span>14:41</span><span class="preview-icons">▮▮▮  Wi-Fi  57%</span></div><div id="app"></div></div></div></body></html>`);
  await page.evaluate(()=>{
    window.__SMALL_PHONE_PRIVATE__=true;
    window.S={settings:{smartHomeAir:{displayName:'卧室空调'}},couple:{cid:'role-1'},me:{name:'小北'},messages:{}};
    window.cur=()=>({p:'wxsmarthome',device:'air'});
    window.back=()=>{};window.go=()=>{};window.save=()=>{};window.toast=()=>{};
    window.smartHomeRolePrompt=()=>'';window.smartHomeRoleFinalize=async content=>({content,matched:false});
    window.renderWxSmartHome=()=>'';
    window.SmallPhoneNative={request:async action=>action==='homekit.climates.snapshot'?{ok:true,climates:[{accessoryId:'air-a',serviceId:'air-s',accessoryName:'空调',roomName:'卧室',reachable:true,complete:true,power:true,mode:'cool',currentMode:'cool',currentTemperature:28,targetTemperature:25,minimumTemperature:16,maximumTemperature:30,temperatureStep:1,supportsFanSpeed:true,fanSpeed:60,minimumFanSpeed:0,maximumFanSpeed:100,fanSpeedStep:10,supportedModes:['auto','heat','cool'],manufacturer:'LENGCEOI.COM',model:'ACN1-AIR'}]}:{ok:true}};
    window.render=()=>{document.getElementById('app').innerHTML=window.renderWxSmartHome();};
  });
  await page.addScriptTag({path:airJs});
  await page.evaluate(()=>{window.__privateSmartAirTest.applySnapshot({ok:true,climates:[{accessoryId:'air-a',serviceId:'air-s',accessoryName:'空调',roomName:'卧室',reachable:true,complete:true,power:true,mode:'cool',currentMode:'cool',currentTemperature:28,targetTemperature:25,minimumTemperature:16,maximumTemperature:30,temperatureStep:1,supportsFanSpeed:true,fanSpeed:60,minimumFanSpeed:0,maximumFanSpeed:100,fanSpeedStep:10,supportedModes:['auto','heat','cool'],manufacturer:'LENGCEOI.COM',model:'ACN1-AIR'}]});window.render();});
  await page.locator('.screen').screenshot({path:output});
  await browser.close();
  console.log(output);
})().catch(error=>{console.error(error);process.exitCode=1;});
