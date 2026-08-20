import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('v727 remote control does not include later hard session wrappers',()=>{
  assert.doesNotMatch(app,/REMOTE_SESSION_MAX_MS/);
  assert.doesNotMatch(app,/_remoteDeadlineTimer/);
});

test('v727 remote control does not include later page dwell wrappers',()=>{
  assert.doesNotMatch(app,/REMOTE_PAGE_MAX_MS/);
  assert.doesNotMatch(app,/function remoteControlBeginPage\(\)/);
  assert.doesNotMatch(app,/function remoteControlPageExpired\(\)/);
  assert.match(app,/async function remoteControlOpenApp\(a,c\)\{const ctl=_remoteCtl/);
});

test('remote flow keeps bounded model calls and adds autonomous page selection',()=>{
  assert.doesNotMatch(app,/function remoteControlTimed\(task,ms,fallback\)/);
  assert.match(app,/function remoteControlModelCall\(messages,opt,timeoutMs\)/);
  assert.match(app,/remote-control-model-timeout/);
  assert.match(app,/await remoteControlAutonomousPlan\(c,required\)/);
  assert.match(app,/const reaction=await remoteControlRoleReaction\(c,a,r\)/);
  assert.match(app,/await remoteControlDecisionPlan\(c,ctl\.actions\)/);
  assert.match(app,/await remoteControlShowRoleLines\(await remoteControlRoleLines\(c,a,r\)\)/);
});

test('remote-control model waits are bounded and visible list decisions keep progress moving',()=>{
  const start=app.indexOf('let _remoteCtl=');
  const end=app.indexOf('let _wxLoginTimer=',start);
  const remote=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(remote,/await chatAPI\(/,'remote-control model calls must use the bounded helper');
  assert.match(remote,/remoteControlModelCall\(/);
  assert.match(remote,/remoteControlProgress\(/);
  assert.match(remote,/本次远程操控的原始目标，执行中不得忘记/);
  assert.match(remote,/msgs\(c&&c\.id\)\|\|\[\]\)\.slice\(-8\)/);
  const reaction=remote.match(/async function remoteControlRoleReaction\(c,a,r\)[\s\S]*?(?=\nasync function remoteControlRoleLines)/)?.[0]||'';
  assert.match(reaction,/remoteControlModelCall\([\s\S]*?,9000\)/,'role reactions keep the July 23 quality window while remaining bounded');
});

test('remote control contains no friend-request rejection route',()=>{
  const start=app.indexOf('let _remoteCtl=');
  const end=app.indexOf('let _wxLoginTimer=',start);
  const remote=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(remote,/reject_friend_request|newFriendList|remoteControlNewFriend|remoteControlEnterNewFriends|remoteControlPrepareFriendReject/);
});

test('v727 keeps its original completion message flow',()=>{
  const start=app.indexOf('let _remoteCtl=');
  const end=app.indexOf('let _wxLoginTimer=',start);
  const remote=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(remote,/不要提系统、功能或远程操控。/);
  assert.doesNotMatch(remote,/不要再次申请远程操控或登录微信/);
  assert.doesNotMatch(remote,/这一轮不得再次输出 \[登录微信\] 或 \[申请远程操控\]/);
});
