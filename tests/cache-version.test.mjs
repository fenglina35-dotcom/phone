import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const repair = fs.readFileSync(new URL('../repair.html', import.meta.url), 'utf8');
const privateHtml = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html', import.meta.url), 'utf8');
const privateApp = fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js', import.meta.url), 'utf8');

const version = app.match(/APP_VER='v(\d+)\b/)?.[1];
const privateVersion = privateApp.match(/APP_VER='v(\d+)\b/)?.[1];
assert.ok(version, 'app.js must expose a numeric APP_VER');
assert.ok(privateVersion, 'private app.js must expose its own numeric APP_VER');

assert.match(html, new RegExp(`app\\.js\\?v=${version}\\b`));
assert.match(html, new RegExp(`ai-account\\.js\\?v=${version}\\b`));
assert.match(html, new RegExp(`sw\\.js\\?v=${version}\\b`));
assert.match(html, new RegExp(`north-sw-reloaded-${version}\\b`));
const controllerStart=html.indexOf("addEventListener('controllerchange'");
const controllerEnd=html.indexOf("var url='sw.js",controllerStart);
assert.ok(controllerStart>=0&&controllerEnd>controllerStart,'service worker controller handler must exist');
assert.doesNotMatch(html.slice(controllerStart,controllerEnd),/location\\.replace|searchParams\\.set/,'cache activation must not reload the active app page');
assert.match(html, new RegExp(`window\\.__NORTH_SHELL_BUILD__='${version}'`));
assert.match(app, new RegExp(`window\\.__NORTH_SHELL_BUILD__!=='${version}'`));
assert.match(app, new RegExp(`sw\\.js\\?v=${version}\\b`));
assert.match(sw, new RegExp(`north-shell-v${version}\\b`));
assert.match(sw, new RegExp(`const BUILD='${version}'`));
assert.match(sw, /validShellText/);
assert.match(sw, /incomplete/);
assert.match(sw, /cache:'no-store'/);
const activateStart=sw.indexOf("self.addEventListener('activate'");
const fetchStart=sw.indexOf("self.addEventListener('fetch'",activateStart);
assert.ok(activateStart>=0&&fetchStart>activateStart,'service worker activation handler must exist');
const activation=sw.slice(activateStart,fetchStart);
assert.match(activation, /self\.clients\.claim\(\)/);
assert.doesNotMatch(activation, /client\.navigate|location\.(?:replace|reload)|clients\.openWindow/,'cache activation must never interrupt the active app page');
assert.match(index, new RegExp(`小手机\\.html\\?v=${version}\\b`));
assert.match(repair, new RegExp(`小手机\\.html\\?v=${version}\\b`));
assert.match(privateHtml, new RegExp(`window\\.__NORTH_SHELL_BUILD__='${privateVersion}'`));
assert.match(privateHtml, new RegExp(`app\\.js\\?v=${privateVersion}\\b`));
assert.match(privateHtml, new RegExp(`ai-account\\.js\\?v=${privateVersion}\\b`));
assert.match(privateHtml, new RegExp(`delivery\\.js\\?v=${privateVersion}\\b`));
assert.match(privateHtml, new RegExp(`pet-game\\.js\\?v=${privateVersion}\\b`));
assert.match(privateApp, new RegExp(`window\\.__NORTH_SHELL_BUILD__!==\\'${privateVersion}\\'`));

console.log(`cache version tests passed (web v${version}, private v${privateVersion})`);
