import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(source, /const APP_VER='v1084 · 睡眠来源与限额锁标识版'/);
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
assert.match(source, /function appLaunch\(k\)[\s\S]*?privateNativeAppOn\(\)&&typeof queueMicrotask===['"]function['"]\)queueMicrotask\(f\);else setTimeout\(f,0\)/,'private App launches ahead of a congested timer queue while web keeps the compatibility-click deferral');
assert.match(source, /offline:openOfflineMenu/,'offline opening inherits the shared deferred pointerup launch');

console.log("android app launch tests passed");
