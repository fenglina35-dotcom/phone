// Mechanical identity update only. Preserve divergent private core and historical documents.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),bundle='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const paths=cp.execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for(const name of paths){
 const runtime=(!name.includes('/')||name.startsWith(bundle)&&!name.slice(bundle.length).includes('/'))&&/\.(?:js|html|css|webmanifest)$/.test(name);
 const native=/^native\/private-small-phone\/XcodeProject\/PhoneCompanionTest\/[^/]+\.(?:swift|plist)$/.test(name)||name==='native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj';
 const test=name.startsWith('tests/')&&name.endsWith('.test.mjs');if(!runtime&&!native&&!test)continue;
 const file=path.join(root,name),old=fs.readFileSync(file,'utf8');let text=old;
 if(runtime||test)text=text.replace(/(?<!\d)1210(?!\d)/g,'1211');
 if(native||name.startsWith(bundle)||test)text=text.replace(/1\.0\.335/g,'1.0.336').replace(/1\\\.0\\\.335/g,'1\\.0\\.336').replace(/\(335\)/g,'(336)').replace(/\\\(335\\\)/g,'\\(336\\)').replace(/CURRENT_PROJECT_VERSION = 335/g,'CURRENT_PROJECT_VERSION = 336').replace(/private-smart-lock\.(js|css)\?v=335/g,'private-smart-lock.$1?v=336');
 text=text.replace(/安装_v1211_iOS334_请先读/g,'安装_v1211_iOS336_请先读');
 if(name==='app.js')text=text.replace(/APP_VER='v1211[^']*'/,"APP_VER='v1211 · 北京时间气泡版'");
 if(name===bundle+'app.js')text=text.replace(/APP_VER='v1211[^']*'/,"APP_VER='v1211 · 私人北京时间与后台消息版'");
 if(test)text=text.replace(/v1211 · 私人聊天中断紧急修复版/g,'v1211 · 私人北京时间与后台消息版').replace(/v1211 · 聊天中断紧急修复版/g,'v1211 · 北京时间气泡版');
 if(text!==old){fs.writeFileSync(file,text);console.log(name);}
}
