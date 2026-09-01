import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const spy={pwd:'1111'},unlock={r1:true};
const context=vm.createContext({
  getSpy:()=>spy,
  _spyUnlock:unlock,
  Math,
});
vm.runInContext([
  functionSource('rolePhonePasswordDigits'),
  functionSource('rolePhonePasswordIntent'),
  functionSource('rolePhonePasswordApply'),
  ';globalThis.digits=rolePhonePasswordDigits;globalThis.intent=rolePhonePasswordIntent;globalThis.apply=rolePhonePasswordApply;',
].join('\n'),context);

assert.equal(context.intent('我把手机密码改成 4826 了。'),'4826');
assert.equal(context.intent('改好了，新密码是 7315。'),'7315');
assert.equal(context.intent('手机密码换好了，是 2480。'),'2480');
assert.equal(context.intent('以后就用 2580 当手机密码。'),'2580');
assert.equal(context.digits('６８２４'),'6824');
assert.equal(context.intent('我的锁屏密码是 6824。'),'6824');
assert.equal(context.intent('我的锁屏密码是 ６８２４。'),'6824');
assert.equal(context.intent('密码已经改好了，新密码是零六一九。'),'0619');
assert.equal(context.intent('密码还是1111，没改。'),'','a statement that the password did not change must not mutate it');
assert.equal(context.intent('验证码是4826。'),'','an unrelated four-digit code must not mutate the phone password');
assert.equal(context.intent('我把解锁密码换了。'),'random');
assert.equal(context.apply({id:'r1'},'4826'),true);
assert.equal(spy.pwd,'4826','a role-spoken explicit password must replace the old password');
assert.equal(unlock.r1,false,'changing the password must invalidate the previous unlocked session');
assert.equal(context.apply({id:'r1'},'零六一九'),true);
assert.equal(spy.pwd,'0619','spoken Chinese digits must be stored as the same four digits the user enters');

const role={id:'r1',spy:{pwd:'1111',diaryPwd:'1225'}},state={couple:{cid:'r1',grant:{},gagAuth:[]}},unlock2={r1:true},diaryUnlock={r1:true};
let saveCount=0,renderCount=0;
const integration=vm.createContext({
  S:state,
  Math,
  getSpy:c=>c.spy,
  _spyUnlock:unlock2,
  _spyDiaryUnlock:diaryUnlock,
  _collarTagFired:false,
  routePhoneInspectionTags:text=>text,
  companionApplyReadTags:text=>({content:text,changed:false}),
  companionRequestedAllControlAction:()=>'',
  companionStripSupersededAllControlTags:text=>text,
  companionDispatchRoleAll:()=>false,
  roleInterceptDiagnosticAction:(_outcome,ok)=>!!ok,
  save:()=>{saveCount++;},
  cur:()=>({p:'chat'}),
  render:()=>{renderCount++;},
});
vm.runInContext([
  functionSource('rolePhonePasswordDigits'),
  functionSource('rolePhonePasswordIntent'),
  functionSource('rolePhonePasswordApply'),
  functionSource('roleDiaryPasswordIntent'),
  functionSource('roleDiaryPasswordApply'),
  functionSource('applyControlTags'),
  functionSource('spyPwd'),
  ';globalThis.control=applyControlTags;globalThis.currentPwd=spyPwd;',
].join('\n'),integration);
const visible=integration.control('已经给你改好了，新密码是零六一九。',role,'r1',null);
assert.equal(visible,'已经给你改好了，新密码是零六一九。','the spoken reply must remain visible');
assert.equal(role.spy.pwd,'0619','the full reply pipeline must write the spoken password');
assert.equal(integration.currentPwd(role),'0619','the lock screen must read the exact password written by the reply pipeline');
assert.equal(unlock2.r1,false,'the full reply pipeline must invalidate the old unlocked session');
assert.equal(saveCount,1,'the full reply pipeline must persist the changed password');
assert.equal(renderCount,1,'the active chat should refresh after the password changes');
integration.control('[改密码|２４八〇]',role,'r1',null);
assert.equal(role.spy.pwd,'2480','the control tag and spoken-number normalization must share one write path');
integration.control('[改日记密码|０６一九]',role,'r1',null);
assert.equal(role.spy.diaryPwd,'0619','the diary password control tag must update the independent diary PIN');
assert.equal(role.spy.pwd,'2480','changing the diary password must not change the phone unlock password');
assert.equal(diaryUnlock.r1,false,'changing the diary password must lock the diary app again');

const control=functionSource('applyControlTags');
assert.match(control,/rolePhonePasswordIntent\(content\)/);
assert.match(control,/rolePhonePasswordApply\(c,naturalPhonePwd\)/);
assert.match(control,/phonePwdChanged/);
assert.match(source,/标签里的数字和你说出口的数字必须完全一致/);
assert.match(functionSource('spyPin'),/_spyPin===String\(spyPwd\(c\)\)/,'PIN entry must validate against the same role phone password');

console.log('phone password regression tests passed');
