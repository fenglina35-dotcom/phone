import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const wechat = fs.readFileSync(new URL('../wechat-me.js', import.meta.url), 'utf8');

assert.match(source, /showMoodTag:true/);
assert.match(source, /# 角色内心想法（仅展示，不控制角色）/);
assert.match(wechat, /心情气泡/);
assert.match(wechat, /S\.settings\.showMoodTag=S\.settings\.showMoodTag===false;save\(\);render\(\)/);
assert.match(source, /naturalInnerThoughtText\(c\.innerThought\)\|\|naturalInnerThoughtText\(c\.innerThoughtLastValid\)/);
assert.doesNotMatch(source, /innerThoughtMissingAt[^\n]{0,180}\?'':/,'a failed refresh must not hide the last confirmed thought');
assert.match(source, /thought=visibleRoleThought\(c\)/);
assert.match(source, /id="chatMoodBar"/);
assert.match(source, /display:\$\{S\.settings\.showMoodTag!==false\?'flex':'none'\}/);
assert.match(source, /function refreshChatMood\(id\)/);
assert.match(source, /function initialFriendInnerThought\(c,opt\)/);
assert.match(source, /initialFriendInnerThought\(c,\{kind:r\.kind,readd:wasReadd,at:now\}\)/);
assert.match(source, /thoughtOpen=_naturalMood\?'showInnerThought':'showMood'/);
assert.match(source, /function showInnerThought\(id\)/);

console.log('mood tag visibility tests passed');

// Run the real response boundary in both runtimes, including streaming-normalized
// results and unfiltered output. No UI page or current contact grants permission.
for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
  const src=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const functions=src.split(/\r?\n/).filter(line=>/^function roleMoodScope(?:Text|Messages)\(|^async function chatResultText\(/.test(line)).join('\n');
  const ctx=vm.createContext({});vm.runInContext(functions,ctx);
  const raw='[心情|有点开心]\n【内心：想听你说话】\n［心情｜期待］\n[内心没有竖线]\n我今天心情不错\n【轻轻牵住你的手】\n【心情复杂地望着你】\n[转账|520|给你]\n[心情值|+2]\n[事件簿|今天一起听歌]';
  const data={choices:[{finish_reason:'stop',message:{content:raw}}]};
  for(const scene of ['group','music','call','douyin','wxLogin','offline','cohab','cinema']){
    const out=await ctx.chatResultText([],{unfilteredOutput:true,scene},data);
    assert.doesNotMatch(out,/开心|想听你说话|期待|没有竖线/,file+' '+scene);
    for(const kept of ['我今天心情不错','【轻轻牵住你的手】','【心情复杂地望着你】','[转账|520|给你]','[心情值|+2]','[事件簿|今天一起听歌]'])assert.ok(out.includes(kept),file+' preserves '+kept);
  }
  assert.equal(await ctx.chatResultText([],{unfilteredOutput:true,allowWechatThought:true},data),raw,file+' WeChat role thought unchanged');
  const user={role:'user',content:'请解释[心情|开心]是什么意思'},messages=[{role:'system',content:'人设'},user];
  const request=ctx.roleMoodScopeMessages(messages,{});
  assert.equal(request.length,3);assert.equal(request[1],user);assert.equal(messages.length,2);
  assert.match(request[2].content,/群聊、音乐、电话、抖音/);
  assert.equal(ctx.roleMoodScopeMessages(messages,{allowWechatThought:true}),messages);
  assert.match(src,/_md=\{allowWechatThought:true,roleReplyLanguageGuard:true/);
  assert.match(src,/messages=roleMoodScopeMessages\(messages,opt\)/);
}
console.log('mood tag scene isolation tests passed');
