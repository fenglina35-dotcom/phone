import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

assert.match(app, /APP_VER='v1674 · 角色执行与上下文修复'/);
assert.match(app, /function northUpdateAvailable\(build\)/);
assert.match(app, /发现新版本 v\$\{esc\(build\)\}/);
assert.match(app, /不需要退出或划掉小手机/);
assert.match(app, /function northUpdateReload\(\).*location\.replace\(next\.href\)/s);
assert.match(app, /setInterval\(\(\)=>reg\.update\(\)\.catch\(\(\)=>\{\}\),15\*60\*1000\)/);
assert.match(app, /postMessage\(\{type:'north-version-query'\}\)/);
assert.match(sw, /client\.postMessage\(\{type:'north-update-ready',build:BUILD\}\)/);
assert.match(sw, /event\.data\.type!==['"]north-version-query['"]/);
assert.match(html, /window\.__NORTH_SHELL_BUILD__='1674'/);
assert.match(html, /sw\.js\?v=1674&r=v1674-couple-unbind-reopen-1/);
assert.match(html, /web-hotfix\.js\?v=1674&r=v1674-couple-unbind-reopen-1/);

console.log("update prompt tests passed");

const {default:vm}=await import('node:vm');
const northUpdateCheckLine=app.split('\n').find(line=>line.startsWith('function northUpdateCheck('));
let queried=0,checked=0;const updateContext={Promise,navigator:{serviceWorker:{controller:{postMessage(){queried++;}}}}};vm.createContext(updateContext);vm.runInContext(northUpdateCheckLine,updateContext);
await updateContext.northUpdateCheck({update:async()=>{checked++;}});assert.equal(queried,1);assert.equal(checked,1);
await updateContext.northUpdateCheck({active:{postMessage(){queried++;}},update:async()=>{throw new Error('offline');}});assert.equal(queried,2);
assert.match(app,/addEventListener\('controllerchange',ask\)/);assert.match(app,/worker.state==='activated'/);
