import assert from "node:assert/strict";
import fs from "node:fs";
import { REL, vre } from './_helpers.mjs';

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

assert.match(app, vre(String.raw`APP_VER='v{WEB} · {WEBLABEL}'`));
assert.match(app, /function northUpdateAvailable\(build\)/);
assert.match(app, /发现新版本 v\$\{esc\(build\)\}/);
assert.match(app, /不需要退出或划掉小手机/);
assert.match(app, /function northUpdateReload\(\).*location\.replace\(next\.href\)/s);
assert.match(app, /setInterval\(\(\)=>reg\.update\(\)\.catch\(\(\)=>\{\}\),15\*60\*1000\)/);
assert.match(app, /postMessage\(\{type:'north-version-query'\}\)/);
assert.match(sw, /client\.postMessage\(\{type:'north-update-ready',build:BUILD\}\)/);
assert.match(sw, /event\.data\.type!==['"]north-version-query['"]/);
assert.match(html, vre(String.raw`window\.__NORTH_SHELL_BUILD__='{WEB}'`));
assert.match(html, vre(String.raw`sw\.js\?v={WEB}&r=v{WEB}-owner-todo-report-1`));
assert.match(html, vre(String.raw`web-hotfix\.js\?v={WEB}&r=v{WEB}-owner-todo-report-1`));

console.log("update prompt tests passed");

const {default:vm}=await import('node:vm');
const northUpdateCheckLine=app.split('\n').find(line=>line.startsWith('function northUpdateCheck('));
let queried=0,checked=0;const updateContext={Promise,navigator:{serviceWorker:{controller:{postMessage(){queried++;}}}}};vm.createContext(updateContext);vm.runInContext(northUpdateCheckLine,updateContext);
await updateContext.northUpdateCheck({update:async()=>{checked++;}});assert.equal(queried,1);assert.equal(checked,1);
await updateContext.northUpdateCheck({active:{postMessage(){queried++;}},update:async()=>{throw new Error('offline');}});assert.equal(queried,2);
assert.match(app,/addEventListener\('controllerchange',ask\)/);assert.match(app,/worker.state==='activated'/);

const {read:updateRead,fnSource:updateFn}=await import('./_helpers.mjs');
const updateApp=updateRead('app.js');
let updateReloaded=false;const installFixture={Promise,document:{getElementById:()=>null},saveNowAsync:async()=>false,northUpdateManualStatus(){},northUpdateReload(){updateReloaded=true;}};vm.createContext(installFixture);vm.runInContext("let _northUpdateManualBusy=false,_northUpdatePending='next';"+updateFn(updateApp,'northUpdateInstallNow'),installFixture);await installFixture.northUpdateInstallNow();assert.equal(updateReloaded,false,'unconfirmed save must block updating');installFixture.saveNowAsync=async()=>true;await installFixture.northUpdateInstallNow();assert.equal(updateReloaded,true);

for(const mode of ['current','new','offline','invalid']){
 let message='',ready=false,updated=0;
 const target=REL.web+1,ctx={Promise,URL,AbortController,Date,APP_VER:'v'+REL.web,window:{__NORTH_SHELL_BUILD__:String(REL.web)},location:{href:'https://fixture.invalid/小手机.html'},navigator:{serviceWorker:{}},document:{getElementById:()=>null},privateNativeAppOn:()=>false,esc:String,openModal(){},setTimeout:()=>1,clearTimeout(){},fetch:async()=>{if(mode==='offline')throw Error('offline');return{ok:true,text:async()=>mode==='invalid'?'not a worker':"const BUILD='"+(mode==='new'?target:REL.web)+"';"};},northUpdateManualStatus:(text,canInstall)=>{message=text;ready=canInstall;},registerSW:async()=>({update:async()=>{updated++;},active:{postMessage(){vm.runInContext("_northUpdatePending='"+target+"'",ctx);}}})};
 vm.createContext(ctx);vm.runInContext("let _northUpdateManualBusy=false,_northUpdatePending='';"+updateFn(updateApp,'northBuildNumber')+updateFn(updateApp,'northUpdateManualCheck'),ctx);await ctx.northUpdateManualCheck();
 assert.equal(ready,mode==='new',mode);if(mode==='new')assert.equal(updated,1);if(mode==='current')assert.match(message,/最新版本/);if(mode==='offline'||mode==='invalid')assert.match(message,/未完成/);
}
