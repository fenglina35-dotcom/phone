// Mechanical version alignment only; preserve the independent private runtime.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='native/private-small-phone/XcodeProject/',bundle=base+'PhoneCompanionTest/PhoneWeb.bundle/';
const edit=(rel,fn)=>{const p=path.join(root,rel),old=fs.readFileSync(p,'utf8'),next=fn(old);if(next!==old)fs.writeFileSync(p,next);};
for(const rel of ['app.js','小手机.html','index.html','repair.html','sw.js','web-hotfix.js',...['app.js','index.html','小手机.html','repair.html','web-hotfix.js'].map(n=>bundle+n)])
 edit(rel,s=>s.replace(/(?<!\d)1222(?!\d)/g,'1223').replace('v1223 · 外卖店内搜索修复版','v1223 · 聊天重新生成修复版'));
for(const rel of [base+'PhoneCompanionTest/LocalPhoneWebView.swift',base+'PhoneCompanionTest/PhoneNativeBridge.swift',base+'PhoneCompanionTest.xcodeproj/project.pbxproj'])
 edit(rel,s=>s.replaceAll('1.0.345 (345)','1.0.346 (346)').replaceAll('CURRENT_PROJECT_VERSION = 345;','CURRENT_PROJECT_VERSION = 346;').replaceAll('MARKETING_VERSION = 1.0.345;','MARKETING_VERSION = 1.0.346;'));
for(const n of ['index.html','小手机.html'])edit(bundle+n,s=>s.replaceAll('private-smart-air.js?v=342','private-smart-air.js?v=1223'));
for(const rel of ['native/private-small-phone/Resources/Web/private-smart-air.js',bundle+'private-smart-air.js'])edit(rel,s=>s.replace('342-homekit-air-v1','1223-homekit-capabilities-v2'));
for(const n of fs.readdirSync(path.join(root,'tests'))){
 if(!n.endsWith('.test.mjs')||/^(north-public-|north-review-|public-north-)/.test(n))continue;
 edit('tests/'+n,s=>s.replace(/(?<!\d)1222(?!\d)/g,'1223').replace(/(?<!\d)345(?!\d)/g,'346').replaceAll('private-smart-air\\.js\\?v=342','private-smart-air\\.js\\?v=1223').replaceAll('v1223 · 外卖店内搜索修复版','v1223 · 聊天重新生成修复版'));
}
