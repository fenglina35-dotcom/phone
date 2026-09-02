import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "小手机.html"), "utf8");

assert.match(source, /const APP_VER='v1153 · 外卖独立身份与拦截释放版'/);
assert.match(source, /const APP_TAP_MOVE=26,APP_TAP_MS=650,APP_DRAG_MS=620/);
assert.match(source, /onclick="appTap\(event,\\''\+k\+'\\'\)"/);
assert.match(source, /onpointerdown="appDown\(event,\\''\+k\+'\\'\)"/);
assert.match(source, /function appTap\(e,k\)/);
assert.match(source, /function appLaunch\(k\)/);
assert.match(source, /function appCancel\(\)/);
assert.match(source, /document\.addEventListener\('pointercancel',appCancel\)/);
assert.match(source, /Date\.now\(\)-p\.t<=APP_TAP_MS[\s\S]*?appLaunch\(p\.k\)/);
assert.match(source, /function appPendingMove\(x,y\)[\s\S]*?Math\.max\(Math\.abs\(dx\),Math\.abs\(dy\)\)<=APP_TAP_MOVE/);
assert.match(source, /function appMove\(e\)[\s\S]*?appPendingMove\(e\.clientX,e\.clientY\)/);
assert.match(source, /function appTouchMove\(e\)[\s\S]*?appPendingMove\(t\.clientX,t\.clientY\)/);
assert.doesNotMatch(source, /function appPanMove\(/);
assert.match(source, /tale:\(\)=>openApp\('tale'\)/);
assert.match(source, /dread:\(\)=>openApp\('dread'\)/);
assert.match(source, /tale:taleStart/);
assert.match(source, /dread:dreadStart/);
assert.match(source, /function appLaunch\(k\)[\s\S]*?privateNativeAppOn\(\)&&typeof queueMicrotask===['"]function['"]\)queueMicrotask\(f\);else setTimeout\(f,0\)/,'the private shell keeps its previously stable prioritized launch while other shells defer');
assert.match(source, /offline:openOfflineMenu/,'offline opening inherits the shared deferred pointerup launch');

assert.match(source, /const NORTH_ANDROID=.*?Android/,'Android is detected without changing the private iOS path');
assert.match(source, /function lazyStoredImagesOn\(\)\{return privateNativeAppOn\(\)\|\|NORTH_ANDROID;\}/);
assert.match(source, /const lazy=lazyStoredImagesOn\(\),keys=lazy\?privateBootImageKeys\(\):imageRefKeys\(S\)/,'Android startup avoids loading every historical image before first paint');
assert.match(source, /function scheduleVisibleStoredImages\(force,alreadyHydrated\)\{if\(!lazyStoredImagesOn\(\)\)return;/,'Android reuses the visible-image lazy loader after startup');
assert.match(source, /limit=NORTH_ANDROID&&!privateNativeAppOn\(\)\?24\*1024\*1024:PRIVATE_IMAGE_CACHE_CHAR_LIMIT/,'Android image memory is bounded independently of iOS');
assert.match(html, /window\.__northBootProgress=function/);
assert.match(html, /setTimeout\(function\(\)\{if\(!window\.__northBootReady\)window\.__northBootProgress[\s\S]*?\},12000\)/,'12 seconds reports slow progress instead of replacing a healthy boot');
assert.match(html, /setTimeout\(function\(\)\{if\(!window\.__northBootReady\)window\.__northBootFail[\s\S]*?\},60000\)/,'a genuinely stuck boot still exposes recovery');
assert.doesNotMatch(html, /__northBootFail\('启动超过 12 秒/);

console.log("android app launch tests passed");
