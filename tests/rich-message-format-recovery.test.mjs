import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const privateApp=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

function fnSource(source,name){
  const start=source.indexOf(`function ${name}(`);assert.notEqual(start,-1,`${name} must exist`);
  const next=source.indexOf('\nfunction ',start+10);
  return source.slice(start,next<0?source.length:next);
}

test('common duration-prefixed voice tags become playable voice payloads',()=>{
  const ctx=vm.createContext({String});
  vm.runInContext(fnSource(app,'parseVoiceTagLine')+'\nthis.parse=parseVoiceTagLine;',ctx);
  const cases=[
    ['[语音消息 00:03] 听好了，就这一次。','听好了，就这一次。'],
    ['[语音消息|00:03|粥喝完了再放给你听。]','粥喝完了再放给你听。'],
    ['【语音消息：现在去。】','现在去。'],
    ['[语音|我爱你|语气:温柔]','我爱你']
  ];
  for(const [raw,text] of cases){const got=ctx.parse(raw);assert.ok(got,raw);assert.equal(got.text,text);}
  assert.equal(ctx.parse('[语音消息 00:03]'),null,'a duration without spoken text is not a fake voice');
  for(const source of [app,privateApp])assert.match(source,/const voiceTag=parseVoiceTagLine\(line\);if\(voiceTag\)/,'voice normalization must feed the actual voice-message delivery branch');
});

test('malformed inner-thought brackets are normalized locally before any repair request',()=>{
  for(const source of [app,privateApp]){
    const ctx=vm.createContext({String,roleVisibleEnvelopeText:v=>String(v||'')});
    vm.runInContext(fnSource(source,'normalizeHiddenThoughtFormats')+'\n'+fnSource(source,'wechatInnerThoughtValue')+'\nthis.norm=normalizeHiddenThoughtFormats;this.value=wechatInnerThoughtValue;',ctx);
    const raw='[内心]周末本来没什么长会，小狗拼完图知道来找我了。]\n开完了。';
    assert.equal(ctx.norm(raw),'[内心|周末本来没什么长会，小狗拼完图知道来找我了。]\n开完了。');
    assert.equal(ctx.value(raw),'周末本来没什么长会，小狗拼完图知道来找我了。');
    assert.equal(ctx.value('【内心】有点想她】\n早点回来。'),'有点想她');
    assert.match(source,/!wechatInnerThoughtValue\(content\)\)\{let thought='';try\{const raw=await chatAPI/,'the paid repair call remains behind the normalized local-value check');
  }
});

function gameRuntime(source,initial){
  let seq=0;const rows=initial.map(x=>({...x})),contact={id:'c1',gamesPlayed:[]};
  const ctx=vm.createContext({String,GAMES:[{k:'drawguess',n:'你画我猜'},{k:'heartquiz',n:'心动审判'},{k:'beads',n:'像素拼拼乐'}],msgs:()=>rows,getC:()=>contact,uid:()=>`m${++seq}`,Date,notifyIncoming(){},save(){},refreshChatMessages(){},render(){},cur:()=>({p:'chat',id:'c1'})});
  const names=['gameInviteDecide','gameKindFromLabel','latestUserGameInvite','roleGameAcceptOrReinvite','roleGameInvite'];
  vm.runInContext(names.map(n=>fnSource(source,n)).join('\n')+'\nthis.accept=roleGameAcceptOrReinvite;this.invite=roleGameInvite;',ctx);
  return{ctx,rows};
}

test('natural game tags recover cards and a later yes after refusal sends a fresh role invite',()=>{
  for(const source of [app,privateApp]){
    const pending=gameRuntime(source,[{id:'u1',role:'user',type:'gameinvite',game:'beads',gname:'像素拼拼乐',status:'pending'}]);
    assert.equal(pending.ctx.accept('c1',''),true);assert.equal(pending.rows[0].status,'accepted');assert.equal(pending.rows.length,1);
    const declined=gameRuntime(source,[{id:'u2',role:'user',type:'gameinvite',game:'beads',gname:'像素拼拼乐',status:'declined'}]);
    assert.equal(declined.ctx.accept('c1','像素拼拼乐'),true);assert.equal(declined.rows.length,2);assert.equal(declined.rows[1].role,'assistant');assert.equal(declined.rows[1].game,'beads');assert.equal(declined.rows[1].status,'pending');
    assert.match(source,/接受\|同意[^\n]+游戏邀请/,'accept variants must be consumed instead of shown as text');
    assert.match(source,/发送\|发出[^\n]+游戏邀请/,'sent-invite variants must be consumed instead of shown as text');
    assert.match(source,/^\s*if\(\/\^\\\[像素拼拼乐/m,'the canonical pixel-game tag must create a card');
  }
});
