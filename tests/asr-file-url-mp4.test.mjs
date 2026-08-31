import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const privateApp=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');
const classic=fs.readFileSync(new URL('../vendor/mp4box.all.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

assert.match(app,/cinemaMp4Library\(\)[\s\S]*?mp4box\.all\.js\?v=1122&r=file-safe-1/);
assert.doesNotMatch(app,/cinemaMp4Library\(\)[\s\S]*?import\('\.\/vendor\/mp4box\.all\.mjs/);
assert.equal(privateApp.includes("mp4box.all.js?v=1122&r=file-safe-1"),true);
assert.match(sw,/mp4box\.all\.js\?v='\+BUILD\+'&r=file-safe-1/);

const context={};
context.globalThis=context;
vm.runInNewContext(classic,context,{filename:'mp4box.all.js'});
assert.equal(typeof context.NorthMP4Box?.createFile,'function');
assert.equal(typeof context.NorthMP4Box.createFile(false)?.appendBuffer,'function');

console.log('file-safe MP4Box loader tests passed');
