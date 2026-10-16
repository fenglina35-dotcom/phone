/* 网页版与私人版共用大量代码，但各自的 app.js 并不完全一样。v1747 的事故：共用的相册代码和私人 app.js 调用了
   roleInterceptDiagnosticAction，而它只在网页 app.js 里定义——私人版一碰到 [存共同相册] 就整轮报错，模型已回复也扣了费。
   这个检查在每次全量测试里双向扫描：某一边调用了一个函数，这个函数只在另一边定义、在自己这边哪里都找不到，
   而且调用前没有 typeof 保护——就判失败。抄代码、合并、改共用文件时漏掉的定义会在发版前被拦下。
   （按名字做的静态扫描，覆盖「另一边有、这一边没有」这一类；拼错的名字等仍靠各自的运行测试。） */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('..',import.meta.url));
const PRIVATE='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read=f=>fs.readFileSync(path.resolve(ROOT,f),'utf8');
const list=dir=>fs.readdirSync(path.join(ROOT,dir)).filter(n=>n.endsWith('.js')).map(n=>dir+n);
const web=[...list(''),'小手机.html'],priv=[...list(PRIVATE),PRIVATE+'index.html',PRIVATE+'小手机.html'];

/* 已知且已评估过的例外：写明原因，修好就从这里删掉。 */
const KNOWN={
  /* 私人入口的样式表 onerror 调用它，但私人入口没定义。只在本地样式表加载失败时才会执行（App 内本地文件几乎不会失败），
     失败时只是少一次自动重试，不影响聊天。下一次私人包一并补上定义后删除这一行。 */
  'private:__northCssRetry':true,
};

function definitions(files){
  const d=new Set();
  for(const f of files){const s=read(f);
    for(const re of [/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g,/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,/(?:window|globalThis|root|self)\.([A-Za-z_$][\w$]*)\s*=/g,/\bclass\s+([A-Za-z_$][\w$]*)/g])
      for(const m of s.matchAll(re))d.add(m[1]);}
  return d;
}
function unguardedCalls(files,names){
  const hits=[];
  for(const f of files){const s=read(f);
    for(const name of names){const esc=name.replace(/\$/g,'\\$');
      for(const m of s.matchAll(new RegExp('(?<![\\w$.])'+esc+'\\s*\\(','g'))){
        const before=s.slice(Math.max(0,m.index-160),m.index);
        if(new RegExp('typeof\\s+'+esc+'\\b').test(before)||/function\s*\*?\s*$/.test(before))continue;
        hits.push(f+' → '+name);break;}}}
  return [...new Set(hits)];
}

test('helpers defined only in the web build are never called unguarded by the private App',()=>{
  const w=definitions(web),p=definitions(priv),onlyWeb=[...w].filter(n=>!p.has(n)&&!KNOWN['private:'+n]);
  assert.deepEqual(unguardedCalls(priv,onlyWeb),[],'the private bundle calls functions it never defines (define them in the private bundle, or guard with typeof)');
});

test('helpers defined only in the private App are never called unguarded by the web build',()=>{
  const w=definitions(web),p=definitions(priv),onlyPrivate=[...p].filter(n=>!w.has(n)&&!KNOWN['web:'+n]);
  assert.deepEqual(unguardedCalls(web,onlyPrivate),[],'the web build calls functions it never defines (define them in the web build, or guard with typeof)');
});

test('the scan catches the v1747 incident on the code that shipped it',()=>{
  /* 把 v1747 修复前私人 app.js 的那一行喂给扫描：必须被认出来，否则这道检查只是摆设。 */
  const before="async function coupleAlbumConsumeSaveTag(content,c,outcome,userText){for(const tag of tags){roleInterceptDiagnosticAction(outcome,await coupleAlbumSaveRecent(c));}}";
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'north-drift-')),f=path.join(dir,'probe.js');fs.writeFileSync(f,before);
  try{assert.deepEqual(unguardedCalls([f],['roleInterceptDiagnosticAction']),[f+' → roleInterceptDiagnosticAction']);}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
});
