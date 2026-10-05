import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../小手机.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const ai = fs.readFileSync(new URL('../photo-album.js', import.meta.url), 'utf8');

const helpers = sw.slice(0, sw.indexOf("self.addEventListener('install'"));
const context = {Response, AbortController, fetch:()=>{}, setTimeout, clearTimeout};
vm.createContext(context);
vm.runInContext(helpers,context);

assert.equal(context.validShellText('html',html),true,'complete HTML must pass');
assert.equal(context.validShellText('app',app),true,'complete app.js must pass');
assert.equal(context.validShellText('album',ai),true,'complete ai-account.js must pass');
assert.equal(context.validShellText('html',html.slice(0,50000)),false,'truncated HTML must fail');
assert.equal(context.validShellText('app',app.slice(0,900000)),false,'truncated app.js must fail');
assert.equal(context.validShellText('album',ai.slice(0,100)),false,'truncated ai-account.js must fail');
assert.match(sw,/Promise\.all\(CORE_FILES\.map[\s\S]*checkedResponse\(item\.url,item\.kind,3\)/);
assert.match(sw,/currentCore\(cache,'html'\)/);
assert.match(sw,/currentCore\(cache,'app'\)/);
assert.match(sw,/const GLASS_ICON_CACHE='north-glass-icons-v1'/);
assert.match(sw,/assets\\\/app-icons\\\/glass/);
assert.doesNotMatch(app,/loading="lazy" decoding="async" fetchpriority="low"/);
assert.match(app,/packed\?' decoding="sync" loading="eager" fetchpriority="high"':''/);

console.log('cache integrity tests passed');
