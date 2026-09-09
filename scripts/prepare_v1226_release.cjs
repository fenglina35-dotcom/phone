// Allocate the shared voice-request repair release without touching public North work.
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),base='native/private-small-phone/XcodeProject/',bundle=base+'PhoneCompanionTest/PhoneWeb.bundle/';
const edit=(p,fn)=>{const file=path.join(root,p),old=fs.readFileSync(file,'utf8'),next=fn(old);if(next!==old)fs.writeFileSync(file,next);};
const webFiles=['app.js','小手机.html','index.html','repair.html','sw.js','web-hotfix.js'];
const privateWebFiles=['app.js','index.html','小手机.html','repair.html','web-hotfix.js'].map(x=>bundle+x);
for(const p of [...webFiles,...privateWebFiles])edit(p,s=>s.replaceAll('1225','1226'));
edit('app.js',s=>s.replace("const APP_VER='v1226 · 日常事件与控制修复版';","const APP_VER='v1226 · 明确语音请求修复版';"));
edit(bundle+'app.js',s=>s.replace("const APP_VER='v1226 · 私人日常事件与控制修复版';","const APP_VER='v1226 · 私人明确语音请求修复版';"));
for(const p of [base+'PhoneCompanionTest/LocalPhoneWebView.swift',base+'PhoneCompanionTest/PhoneNativeBridge.swift'])edit(p,s=>s.replaceAll('1.0.348 (348)','1.0.349 (349)'));
edit(base+'PhoneCompanionTest.xcodeproj/project.pbxproj',s=>s.replaceAll('CURRENT_PROJECT_VERSION = 348;','CURRENT_PROJECT_VERSION = 349;').replaceAll('MARKETING_VERSION = 1.0.348;','MARKETING_VERSION = 1.0.349;'));
for(const n of fs.readdirSync(path.join(root,'tests'))){
  if(!n.endsWith('.test.mjs')||/^(north-public-|north-review-|public-north-)/.test(n))continue;
  edit('tests/'+n,s=>s
    .replaceAll('v1225','v1226')
    .replaceAll("BUILD='1225'","BUILD='1226'")
    .replaceAll("shellBuild, '1225'","shellBuild, '1226'")
    .replaceAll('1.0.348 (348)','1.0.349 (349)')
    .replaceAll('1\\.0\\.348 \\(348\\)','1\\.0\\.349 \\(349\\)')
    .replaceAll('CURRENT_PROJECT_VERSION = 348','CURRENT_PROJECT_VERSION = 349')
    .replaceAll('MARKETING_VERSION = 1\\.0\\.348','MARKETING_VERSION = 1\\.0\\.349')
  );
}
