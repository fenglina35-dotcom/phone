import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const P='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
function fn(s,name){const start=s.indexOf(`function ${name}(`);assert.ok(start>=0,`missing ${name}`);const brace=s.indexOf('{',start);let d=0,q='',e=false;
  for(let i=brace;i<s.length;i++){const ch=s[i];if(q){if(e)e=false;else if(ch==='\\')e=true;else if(ch===q)q='';continue;}if(ch==='"'||ch==="'"||ch==='`'){q=ch;continue;}if(ch==='{')d++;else if(ch==='}'&&--d===0)return s.slice(start,i+1);}throw new Error('unterminated '+name);}

for(const [label,p] of [['web','app.js'],['private',P+'app.js']]){
  const s=read(p);
  test(`${label}: lunar festivals are known and only the couple role is sent a holiday task`,()=>{
    for(const k of ["'2026-02-17':'春节'","'2026-08-19':'七夕'","'2026-09-25':'中秋节'","'2026-06-19':'端午节'","'2027-02-05':'除夕'"])assert.ok(s.includes(k),k);
    const cal=fn(s,'checkCalendar');
    assert.doesNotMatch(cal,/holidayGreet\(/,'其他角色过节不再主动发祝福');
    assert.match(cal,/calendarDeliver\('gift_hol_'\+coupleCid,today,\(\)=>holidayCare\(coupleCid,hol,today\)\)/);
    assert.match(cal,/holidayCareWindow\(hol,now\)/);
    assert.match(cal,/\/生日\/\.test\(a\.title\)\?holidayCare\(coupleCid,a\.title,today,\{birthday:true\}\)/);
  });
  test(`${label}: important days require a gift, red packet or transfer; others only a greeting`,()=>{
    const care=fn(s,'holidayCare');
    assert.match(care,/一定要准备一份心意/);assert.match(care,/\[送礼\|礼物名\|价格\|附言\]/);assert.match(care,/\[红包\|金额\|祝福语\]/);assert.match(care,/\[转账\|金额\|说明\]/);
    assert.match(care,/不送也可以，但祝福一定要有/);assert.match(care,/不要输出 \[保持安静\]/);
    const imp=new Function(fn(s,'holidayCareImportant')+';return holidayCareImportant;')();
    for(const n of ['情人节','520','七夕','春节','除夕','中秋节','圣诞节','生日'])assert.ok(imp(n),n);
    for(const n of ['元旦','劳动节','国庆节','端午节'])assert.ok(!imp(n),n);
  });
  test(`${label}: background only changes when she explicitly asks in words`,()=>{
    const req=new Function(fn(s,'wechatBgRequest')+';return wechatBgRequest;')();
    for(const t of ['把这张换成背景','拿这张当背景','帮我换个背景','背景换成这张吧','设成我们的聊天背景'])assert.ok(req(t),t);
    for(const t of ['你看这张照片','这张照片背景好看吗','我今天拍的，背景是海','背景音乐好吵','这是我的手机背景','别换背景'])assert.ok(!req(t),t);
    assert.match(s,/if\(!_wantBg\)continue;\n\s*if\(wechatApplyBgRequest\(c,id\)\)_bgApplied=true;/);
    assert.match(s,/ta只是发了照片、没用文字明确说「换背景」，那就只是给你看照片，绝对不是让你换背景/);
  });
}
test('desk pet settings page no longer shows the explanatory line under the name',()=>{
  assert.doesNotMatch(read('desk-pet.js'),/屏幕里的虚拟小机器人，和实体的小 K 是分开的<\/small>/);
});
