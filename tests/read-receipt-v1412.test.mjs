import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const P='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const fnSrc=(s,n)=>{const i=s.indexOf(`function ${n}(`);assert.ok(i>=0,n);return s.slice(i,s.indexOf('\n',i));};
for(const [label,p,h] of [['web','app.js','小手机.html'],['private',P+'app.js',P+'index.html']]){
  const s=read(p),html=read(h);
  test(`${label}: read receipts for roles and real friends share one switch in 角色、时间与消息`,()=>{
    assert.match(s,/function readReceiptOn\(\)\{return !\(S\.settings&&S\.settings\.readReceipt===false\);\}/);
    assert.match(s,/<span>微信已读<br>/);assert.match(s,/onclick="readReceiptToggle\(\)"/);
    assert.match(s,/function pfReadStatus\(m,scope,gid\)\{[^\n]*if\(!readReceiptOn\(\)\)return '';/);
    assert.match(s,/function pfAckRead\(mid\)\{[^}]*readReceiptOn\(\)/,'关掉后不再告诉真人好友读没读');
  });
  test(`${label}: the role marks her messages read when he starts replying, shown on a line the premium theme does not hide`,()=>{
    assert.match(s,/roleMarkRead\(id\);\n  \/\/ typing/);
    assert.match(s,/\$\{inner\}\$\{ts\}\$\{readLine\}<\/div>/);
    assert.match(s,/class="msgread msgread-line" data-read-for=/);
    assert.match(s,/class="msgread-line"[\s\S]*data-pf-in=[\s\S]*data-wx-read=/,'真人好友已读独立显示且等待真实回执');
    assert.doesNotMatch(s,/\$\{rs\?`<span style="margin-right:8px;color:#8d8d96">/,'真人好友的已读不能再塞进被隐藏的时间行');
    assert.match(html,/\.msgread-line\{position:absolute;bottom:1px;right:calc\(100% \+ 6px\)/);assert.match(html,/\.msg\.them \.msgread-line\{right:auto;left:calc\(100% \+ 6px\)\}/);
    assert.match(s,/const readLine=me\?roleReadLabelHTML\(c,m\):roleSeenLabelHTML\(c,m\);/,'他发来的消息旁边也显示你读没读');
    assert.match(s,/setInterval\(roleSeenTick,500\);/);
    assert.match(s,/pfReadIds\(m\)\.indexOf\(p\.id\)>=0\?'已读':''/,'真人好友未读留白，已读依据回执');
    assert.match(s,/function pfReadInPlace\(id\)/);
    assert.doesNotMatch(fnSrc(s,'roleReadLabelHTML'),/display:none/,'每一条都显示，不能后面读了前面就藏起来');
    assert.doesNotMatch(fnSrc(s,'roleSeenLabelHTML'),/display:none/);
    assert.match(s,/if\(_main&&typeof roleReadPrompt==='function'\)s\+=roleReadPrompt\(c\);/,'角色知道你已读没回');
  });
}

for(const file of ['app.js',P+'app.js']){
 test(file+': unread is blank and each incoming message has its own two-second deadline',()=>{
  const app=read(file),fn=fnSrc(app,'wechatMotionReadDue'),ctx=vm.createContext({Math,readReceiptOn:()=>true,roleReadCounted:()=>true,roleMsgRead:()=>false});vm.runInContext(fn+'\n'+fnSrc(app,'roleReadLabelHTML')+'\n'+fnSrc(app,'roleSeenLabelHTML'),ctx);assert(!ctx.roleReadLabelHTML({id:'c'},{id:'u',role:'user'}).includes('未读'));assert(!ctx.roleSeenLabelHTML({id:'c'},{id:'a',role:'assistant'}).includes('未读'));
  const first={born:1000,initial:false,due:0},second={born:1800,initial:false,due:0};
  assert.equal(ctx.wechatMotionReadDue(first,'',1200,true),0,'no receipt means no fabricated read');
  assert.equal(ctx.wechatMotionReadDue(first,'已读',1200,true),3000);
  assert.equal(ctx.wechatMotionReadDue(second,'已读',1900,true),3800);
  assert.equal(ctx.wechatMotionReadDue(first,'已读',2500,true),3000,'refresh cannot restart the first timer');
  assert.equal(ctx.wechatMotionReadDue({born:1000,initial:false,due:0},'已读',6000,false),8000,'outgoing uses actual receipt arrival');
  assert.equal(ctx.wechatMotionReadDue({born:1000,initial:true,due:0},'已读',6000,true),6000,'historical read never replays');
 });
}
