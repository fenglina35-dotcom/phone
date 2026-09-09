// Mechanical shared candidate identity update. Does not build, commit or push.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),bundle='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const files=['app.js','小手机.html','index.html','repair.html','web-hotfix.js','sw.js',...['app.js','index.html','小手机.html','repair.html','web-hotfix.js'].map(x=>bundle+x),...fs.readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/'+x)];
for(const p of files){
 if(p.startsWith('tests/north-')||p.startsWith('tests/public-north-'))continue;
 const file=path.join(root,p),old=fs.readFileSync(file,'utf8');
 // Smart-air code and its independently owned asset version stay untouched.
 const next=old.split('\n').map(line=>{
  if(line.includes('private-smart-air')&&!line.includes('APP_VER'))return line;
  if(p==='tests/private-ios295-performance-inheritance.test.mjs'&&(line.includes('Mac guide')||line.includes('assert.match(mac,')))return line;
  return line.replace(/1223/g,'1224').replace(/聊天重新生成修复版/g,'日常事件与控制修复版').replace(/私人整合修复版/g,'私人日常事件与控制修复版');
 }).join('\n');
 if(next!==old){fs.writeFileSync(file,next);console.log(p);}
}
