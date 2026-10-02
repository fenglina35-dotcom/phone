import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const P='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fnSrc=(s,n)=>{const i=s.indexOf(`function ${n}(`);assert.ok(i>=0,n);return s.slice(i,s.indexOf('\n',i));};
for(const [label,p,h] of [['web','app.js','小手机.html'],['private',P+'app.js',P+'index.html']]){
  const s=read(p),html=read(h);
  test(`${label}: read receipts for roles and real friends share one switch in 角色、时间与消息`,()=>{
    assert.match(s,/function readReceiptOn\(\)\{return !\(S\.settings&&S\.settings\.readReceipt===false\);\}/);
    assert.match(s,/<span>微信已读<br>/);assert.match(s,/onclick="readReceiptToggle\(\)"/);
    assert.match(s,/function pfReadStatus\(m,scope,gid\)\{if\(!readReceiptOn\(\)\)return '';/);
    assert.match(s,/function pfAckRead\(mid\)\{[^}]*readReceiptOn\(\)/,'关掉后不再告诉真人好友读没读');
  });
  test(`${label}: the role marks her messages read when he starts replying, shown on a line the premium theme does not hide`,()=>{
    assert.match(s,/roleMarkRead\(id\);\n  \/\/ typing/);
    assert.match(s,/\$\{inner\}\$\{ts\}\$\{readLine\}<\/div>/);
    assert.match(s,/class="msgread msgread-line" data-read-for=/);
    assert.match(s,/\$\{rs\?`<div class="msgread-line"\$\{me\?'':` data-pf-in="\$\{m\.id\}"`\}>\$\{rs\}<\/div>`:''\}/);
    assert.doesNotMatch(s,/\$\{rs\?`<span style="margin-right:8px;color:#8d8d96">/,'真人好友的已读不能再塞进被隐藏的时间行');
    assert.match(html,/\.msgread-line\{position:absolute;bottom:1px;right:calc\(100% \+ 6px\)/);assert.match(html,/\.msg\.them \.msgread-line\{right:auto;left:calc\(100% \+ 6px\)\}/);
    assert.match(s,/const readLine=me\?roleReadLabelHTML\(c,m\):roleSeenLabelHTML\(c,m\);/,'他发来的消息旁边也显示你读没读');
    assert.match(s,/setInterval\(roleSeenTick,500\);/);
    assert.match(s,/\(!me&&!m\._transferReceipt&&readReceiptOn\(\)\?\(pfReadIds\(m\)\.indexOf\(p\.id\)>=0\?'已读':'未读'\):''\)/,'真人好友发来的每一条都显示你读没读');
    assert.match(s,/function pfReadInPlace\(id\)/);
    assert.doesNotMatch(fnSrc(s,'roleReadLabelHTML'),/display:none/,'每一条都显示，不能后面读了前面就藏起来');
    assert.doesNotMatch(fnSrc(s,'roleSeenLabelHTML'),/display:none/);
    assert.match(s,/if\(_main&&typeof roleReadPrompt==='function'\)s\+=roleReadPrompt\(c\);/,'角色知道你已读没回');
  });
}
