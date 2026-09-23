import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../小手机.html", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

assert.match(app, /APP_VER='v1300 · 磨砂＋细高光、共同生活状态、背景画质'/);
assert.match(app, /function northUpdateAvailable\(build\)/);
assert.match(app, /发现新版本 v\$\{esc\(build\)\}/);
assert.match(app, /不需要退出或划掉小手机/);
assert.match(app, /function northUpdateReload\(\).*location\.replace\(next\.href\)/s);
assert.match(app, /setInterval\(\(\)=>reg\.update\(\)\.catch\(\(\)=>\{\}\),15\*60\*1000\)/);
assert.match(app, /postMessage\(\{type:'north-version-query'\}\)/);
assert.match(sw, /client\.postMessage\(\{type:'north-update-ready',build:BUILD\}\)/);
assert.match(sw, /event\.data\.type!==['"]north-version-query['"]/);
assert.match(html, /window\.__NORTH_SHELL_BUILD__='1300'/);
assert.match(html, /sw\.js\?v=1300&r=v1300-web-imsg-7/);
assert.match(html, /web-hotfix\.js\?v=1300&r=v1300-web-imsg-7/);

console.log("update prompt tests passed");
