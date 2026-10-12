import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const [kind,path] of [['web','app.js'],['private','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']]) {
  test(`${kind} real-friend sync slows down while nothing is new and snaps back on activity`,()=>{
    const s=fs.readFileSync(path,'utf8'),a=s.indexOf('let _pfIdleSyncs=0;'),b=s.indexOf("if(typeof document!=='undefined'&&document.addEventListener)document.addEventListener('visibilitychange',()=>{if(!document.hidden)phoneFriendSyncActive();});",a);
    assert.ok(a>0&&b>a);let page='home';const ctx={cur:()=>({p:page}),Math};vm.createContext(ctx);
    vm.runInContext(s.slice(a,b)+';this.delay=phoneFriendPollDelay;this.active=phoneFriendSyncActive;this.idle=n=>{_pfIdleSyncs=n;};',ctx);
    assert.equal(ctx.delay(),30000,'其他页面起步 30 秒（原来 15 秒）');ctx.idle(20);assert.equal(ctx.delay(),180000,'最慢 3 分钟');
    page='wechat';assert.equal(ctx.delay(),30000);ctx.active();assert.equal(ctx.delay(),6000,'有动静立刻恢复');
    page='pfchat';assert.equal(ctx.delay(),2500,'聊天里保持 2.5 秒');ctx.idle(20);assert.equal(ctx.delay(),8000,'聊天里最慢 8 秒');
    assert.match(s,/if\(changed\)_pfIdleSyncs=0;else _pfIdleSyncs\+\+;/,'有新东西才重置');
    assert.match(s,/function pfRpc\(fn,args,ms\)\{if\(\/send\|respond\|create_group\|invite\|accept\/\.test\(fn\)/,'自己发消息后立刻恢复快速');
  });
}
