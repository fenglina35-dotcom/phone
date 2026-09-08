// Mechanical release identity updates only; retain private divergence and old guides.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),bundle='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const names=cp.execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for(const name of names){
 const runtime=(!name.includes('/')||name.startsWith(bundle)&&!name.slice(bundle.length).includes('/'))&&/\.(?:js|html|css|webmanifest)$/.test(name);
 const native=/^native\/private-small-phone\/XcodeProject\/PhoneCompanionTest\/[^/]+\.(?:swift|plist)$/.test(name)||name==='native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj';
 const test=name.startsWith('tests/')&&name.endsWith('.test.mjs');if(!runtime&&!native&&!test)continue;
 const file=path.join(root,name),old=fs.readFileSync(file,'utf8');let text=old;
 if(runtime||test)text=text.replace(/v1211/g,'v1212').replace(/v=1211/g,'v=1212').replace(/BUILD='1211'/g,"BUILD='1212'").replace(/__NORTH_SHELL_BUILD__='1211'/g,"__NORTH_SHELL_BUILD__='1212'");
 if(native||name.startsWith(bundle)||test)text=text.replace(/1\.0\.337/g,'1.0.338').replace(/1\\\.0\\\.337/g,'1\\.0\\.338').replace(/\(337\)/g,'(338)').replace(/\\\(337\\\)/g,'\\(338\\)').replace(/CURRENT_PROJECT_VERSION = 337/g,'CURRENT_PROJECT_VERSION = 338').replace(/private-smart-lock\.(js|css)\?v=337/g,'private-smart-lock.$1?v=338');
 if(name==='app.js')text=text.replace(/APP_VER='v1212[^']*'/,"APP_VER='v1212 · 请求诊断与简洁时间版'");
 if(name===bundle+'app.js')text=text.replace(/APP_VER='v1212[^']*'/,"APP_VER='v1212 · 私人请求诊断与门锁更新版'");
 if(test)text=text.replace(/v1212 · 北京时间气泡版/g,'v1212 · 请求诊断与简洁时间版').replace(/v1212 · 私人北京时间与后台消息版/g,'v1212 · 私人请求诊断与门锁更新版').replace(/v1212 · 私人门锁内部标签隔离版/g,'v1212 · 私人请求诊断与门锁更新版').replace(/安装_v1212_iOS(?:336|337)_请先读/g,'安装_v1212_iOS338_请先读');
 if(text!==old){fs.writeFileSync(file,text);console.log(name);}
}
