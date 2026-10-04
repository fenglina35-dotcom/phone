import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const dirs=['','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/'];
for(const dir of dirs){
 const read=name=>fs.readFileSync(new URL(dir+name,root),'utf8');
 test(dir+'removed event ledger has no entry, runtime or model injection',()=>{
  assert.equal(fs.existsSync(new URL(dir+'daily-event-ledger.js',root)),false);
  for(const name of (dir?['小手机.html','index.html']:['小手机.html','sw.js']))assert.doesNotMatch(read(name),/daily-event-ledger/);
  const app=read('app.js');
  assert.doesNotMatch(app,/日常事件簿|dailyEventLedgerHTML/);
  assert.match(app,/\['lifelog','小事簿'/);
  assert.match(app,/function lifeNoteReplyDraft\(/);
 });
 test(dir+'old event tags remain invisible and legacy navigation returns home',()=>{
  const app=read('app.js'),ctx={_spyApp:null,cur:()=>({p:'spy'}),render(){ctx.rendered=true;}};
  vm.createContext(ctx);
  vm.runInContext(app.match(/^function lifeNoteStripModelTags\(.*$/m)[0]+'\n'+app.match(/^function spyOpen\(.*$/m)[0],ctx);
  assert.equal(ctx.lifeNoteStripModelTags('好的。[事件簿|新|已发生|吃饭|吃过饭]'),'好的。');
  assert.equal(ctx.lifeNoteStripModelTags('好的。[小事簿|吃饭|吃过饭]'),'好的。');
  ctx.spyOpen('role','events');assert.equal(ctx._spyApp,null);assert.equal(ctx.rendered,true);
 });
}
test('private active package manifest excludes removed component',()=>{
 const manifest=fs.readFileSync(new URL('native/private-small-phone/Resources/private-phone-web.manifest.json',root),'utf8');
 assert.doesNotMatch(manifest,/daily-event-ledger/);JSON.parse(manifest);
});
