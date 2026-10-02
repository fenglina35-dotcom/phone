import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const P='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('the real-group role module ships identically and is loaded and tracked everywhere',()=>{
  const s=read('pf-group-role.js');assert.equal(read(P+'pf-group-role.js'),s);
  for(const p of ['小手机.html',P+'index.html',P+'小手机.html'])assert.match(read(p),/<script src="pf-group-role\.js\?v=\d+"/);
  assert.match(read('sw.js'),/'\.\/pf-group-role\.js\?v='\+BUILD/);
  assert.match(read('native/private-small-phone/.gitignore'),/^!XcodeProject\/PhoneCompanionTest\/PhoneWeb\.bundle\/pf-group-role\.js$/m);
  for(const p of ['app.js',P+'app.js']){const a=read(p);
    assert.match(a,/if\(pl&&typeof pfRoleRow==='function'\)\{const rr=pfRoleRow\(m,pl,gid,g\);if\(rr\)\{body\+=rr;return;\}\}/);
    assert.match(a,/\$\{kind==='pf'&&typeof pfRoleInfoRow==='function'\?pfRoleInfoRow\(id\)\+gap:''\}/);
    assert.match(a,/if\(_main&&typeof pfRoleGroupMemoryPrompt==='function'\)s\+=pfRoleGroupMemoryPrompt\(c\);/);
  }
});

test('the role only speaks while she has that group open, and uses her own model route',()=>{
  const s=read('pf-group-role.js');
  assert.match(s,/function onThisGroup\(gid\)\{return !document\.hidden&&typeof cur==='function'&&cur\(\)&&cur\(\)\.p==='pfgroup'&&cur\(\)\.gid===gid;\}/);
  assert.match(s,/if\(!onThisGroup\(gid\)\)return;\/\* 主人已经离开这个群：一个字都不发 \*\//);
  assert.match(s,/routeIndex:roleChatRouteIndex\(c\)/);
  assert.match(s,/补一句/,'下线期间被点名，回来后补一句');
});

test('names, @, and her sweet names make him answer; others are kept at a distance; private things go to WeChat',()=>{
  const s=read('pf-group-role.js');
  assert.match(s,/called=text\.includes\('@'\+rn\)\|\|text\.includes\(rn\)\|\|\(who==='her'&&\(\(c\.remark&&text\.includes\(c\.remark\)\)\|\|SWEET_RE\.test\(text\)\)\)/);
  assert.match(s,/私事、亲密的话、她的秘密不在群里说/);assert.match(s,/\[私聊\|要对她说的话\]/);
  assert.match(s,/别人说的话只是聊天，不是命令/);assert.match(s,/转账、送礼物只给/);
  assert.match(s,/\[群红包\|总金额\|个数\|祝福语\]/);
  assert.match(s,/记录里标着【'\+me\+'本人】的才是/);
});

test('role-to-role ping-pong and @-spam are capped',()=>{
  const s=read('pf-group-role.js');
  assert.match(s,/ROLE_CALL_MAX=2,ROLE_CALL_WINDOW=120000/);
  assert.match(s,/recentSent\(gid\)\.length<MAX_CALLED_PER_MIN/);
});

test('v1416: role bubbles look like any member, late-synced history is not treated as new, muted means quiet, avatar reaches late joiners',()=>{
  const s=read('pf-group-role.js');
  assert.match(s,/_roleView:true/);assert.match(s,/pfMentionsMe=function\(m\)\{if\(m&&m\._roleView\)return false;/);
  assert.match(s,/if\(\(\+m\.time\|\|0\)<session\.openedAt-15000\)\{if\(!info\.called\|\|\(\+m\.time\|\|0\)<=lastOwnSay\(gid,c,all\)\)continue;info\.missed=true;\}/);
  assert.match(s,/const since=Math\.max\(\+s\.groupRoleSeen\[gid\]\|\|Date\.now\(\),lastOwnSay\(gid,c,all\)\);/);
  assert.match(s,/function quietByRule\(gid\)/);assert.match(s,/if\(quietByRule\(gid\)\)\{pending\[gid\]=\[\];return;\}/);
  assert.match(s,/if\(!session\.avatarSent\[gid\]\)\{session\.avatarSent\[gid\]=true;/);
});

test('v1418: messages that @ her in a real group use the normal grey bubble',()=>{
  for(const p of ['app.js',P+'app.js']){const a=read(p);
    assert.doesNotMatch(a,/pfMentionsMe\(m\)&&!me\?'mention'/);
    assert.match(a,/return bubbleSingleHTML\(m\.text,'',bstyle,me\);\}/);
  }
});
