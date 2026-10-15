/* v1747 私人版：角色回复里带 [存共同相册|…] 或 [回忆相册|…] 时整轮报
   「Can't find variable: roleInterceptDiagnosticAction」——模型已回复、已扣费，界面却显示「模型未回复」。
   根因：这个函数只在网页版的回复拦截诊断模块里定义，私人版 app.js 和共用的 photo-album.js 却无保护地调用它。
   第一个用例在旧的私人 app.js 上抛出 ReferenceError。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const DIR='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const privateApp=read(DIR+'app.js');
const fnLine=(src,name)=>{const l=src.split('\n').find(x=>x.startsWith('function '+name+'(')||x.startsWith('async function '+name+'('));assert.ok(l,'missing '+name);return l;};

test('a private reply carrying [存共同相册|…] and [回忆相册|…] is processed instead of throwing',async()=>{
  const saved=[],photo=read(DIR+'photo-album.js');
  const ctx=vm.createContext({String,Date,Promise,saved,coupleAlbumSaveRecent:async(c,text,cat)=>{saved.push([cat,text]);return true;}});
  vm.runInContext(fnLine(privateApp,'roleInterceptDiagnosticAction')+'\n'+fnLine(privateApp,'coupleAlbumConsumeSaveTag'),ctx);
  const reply='[内心|她把我纹身的照片存进相册了]\n先生看到了。\n[存共同相册|回忆|"North"]\n过来。';
  const outcome={};
  const out=await ctx.coupleAlbumConsumeSaveTag(reply,{id:'r'},outcome,'先生～');
  assert.doesNotMatch(out,/存共同相册/);
  assert.match(out,/先生看到了。/);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)),[['回忆','"North"']]);
  assert.deepEqual({...outcome},{matched:1,handled:1});
  assert.match(photo,/function photoAlbumConsumeMemory\(/);
  assert.equal(await ctx.coupleAlbumConsumeSaveTag('[存共同相册]',{id:'r'},null,''),'','a null outcome (the normal chat path) is accepted');
});

test('every helper the private bundle calls without a typeof guard is defined in the private bundle',()=>{
  const files=fs.readdirSync(new URL('../'+DIR,import.meta.url)).filter(n=>n.endsWith('.js'));
  const all=files.map(n=>read(DIR+n)).join('\n')+read(DIR+'index.html');
  assert.match(all,/function roleInterceptDiagnosticAction\(outcome,ok\)/);
  for(const n of files){const s=read(DIR+n);for(const m of s.matchAll(/(?<![\w$.])roleInterceptDiagnosticAction\s*\(/g)){const before=s.slice(Math.max(0,m.index-80),m.index);if(/typeof roleInterceptDiagnosticAction|function $/.test(before))continue;assert.match(all,/function roleInterceptDiagnosticAction\(/,n+' calls an undefined helper');}}
});
