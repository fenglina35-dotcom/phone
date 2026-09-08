import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
 const src=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const take=name=>{const start=src.indexOf('function '+name+'(');assert(start>=0);const tail=src.slice(start+1),end=/^(?:(?:async )?function |(?:let|const|var) )/m.exec(tail);return src.slice(start,start+1+end.index);};
 test(file+': activity uses the requested role with no ambient c binding',()=>{
  const role={id:'a',name:'甲'},ctx={S:{contacts:[role],me:{name:'用户',lifeNotes:[]},moments:[]},getC:id=>id===role.id?role:null,memoryScopeKey:()=> 'main',readdDiscoveryLine:()=>'',friendRequestActivity:()=>'',travelTicketDiscoveryLine:()=>'',phoneFriendActivity:()=>'',phActivity:()=>'',webBatteryFactText:()=>'',privatePhoneAccountAvailable:()=>false,shopOrderRows:()=>[],fmtDT:()=> '日期',aboutMeNoteText:x=>x};
  ctx.msgs=()=>[];ctx.lastMsg=()=>null;
  vm.createContext(ctx);vm.runInContext(['lifeNotes','lifeNotesForRole','lifeNoteReadableText','lifeNoteAuthorship','myActivity'].map(take).join('\n'),ctx);
  assert.doesNotThrow(()=>ctx.myActivity('a'));
  ctx.S.me.lifeNotes=[{text:'我的观察',roleId:'a',accountId:'main',rolePerspective:true,ts:20},{text:'别人秘密',roleId:'b',rolePerspective:true,ts:20},{text:'其他账号',roleId:'a',accountId:'alt',ts:20},{text:'旧记录',ts:10}];
  const before=JSON.stringify(ctx.S.me.lifeNotes),result=ctx.myActivity('a');
  assert.match(result,/我的观察/);assert.match(result,/我指甲/);assert.match(result,/旧记录/);assert.doesNotMatch(result,/别人秘密|其他账号/);
  assert.doesNotMatch(ctx.myActivity('a',15),/旧记录/);assert.doesNotMatch(ctx.myActivity('a',30),/我的观察/);assert.doesNotThrow(()=>ctx.myActivity('missing'));
  assert.equal(JSON.stringify(ctx.S.me.lifeNotes),before);
 });
}
