import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf('function '+name+'(');assert.ok(start>=0,'missing '+name);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error('unterminated '+name);
}

function sandbox(){
  const s=vm.createContext({String,setTimeout:()=>{throw new Error('completed translations must not enqueue again');}});
  s.esc=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  for(const name of ['roleTextLanguageStats','roleTextNeedsTranslation','roleTextTranslationHTML'])vm.runInContext('this.'+name+'='+functionSource(name),s);
  return s;
}

test('Chinese and incidental Latin do not trigger, while major foreign scripts do',()=>{
  const s=sandbox();
  assert.equal(s.roleTextNeedsTranslation('今天早点回家，我等你。'),false);
  assert.equal(s.roleTextNeedsTranslation('今天 OK，网址 https://example.com'),false);
  assert.equal(s.roleTextNeedsTranslation('I will wait for you at home.'),true);
  assert.equal(s.roleTextNeedsTranslation('今日はちゃんとご飯を食べた？'),true);
  assert.equal(s.roleTextNeedsTranslation('오늘은 꼭 밥 먹어.'),true);
  assert.equal(s.roleTextNeedsTranslation('Я буду ждать тебя дома.'),true);
  assert.equal(s.roleTextNeedsTranslation('سأنتظرك في المنزل.'),true);
  assert.equal(s.roleTextNeedsTranslation('ฉันจะรอคุณอยู่ที่บ้าน'),true);
});

test('assistant foreign text renders the original bubble plus a persisted Simplified Chinese translation',()=>{
  const s=sandbox(),message={id:'m1',type:'text',role:'assistant',content:'I will wait for you at home.',textTrans:'我会在家等你。',textTransSource:'I will wait for you at home.',_textTransState:'done'};
  const out=s.roleTextTranslationHTML({id:'c1'},message,false);
  assert.match(out,/role-text-trans-label/);
  assert.match(out,/我会在家等你。/);
  assert.doesNotMatch(out,/正在翻译|点此重试/);
  assert.equal(s.roleTextTranslationHTML({id:'c1'},{type:'text',role:'assistant',content:'我会在家等你。'},false),'');
  assert.equal(s.roleTextTranslationHTML({id:'c1'},message,true),'','user messages are never auto-translated');
});

test('generation policy permits natural foreign text but forbids model-written inline translations',()=>{
  assert.match(source,/也可以直接发送任何语言的外语原文/);
  assert.match(source,/不要自己追加“译：”、括号中文或解释语言/);
  assert.doesNotMatch(source,/function _chatDrift\(/);
  assert.doesNotMatch(source,/这是中文文字聊天，请用【纯中文】把刚才想说的重说一遍/);
  assert.match(html,/\.role-text-trans\{/);
});

test('translation uses the role route, low temperature, a bounded request, and no role interception audit',()=>{
  const fn=functionSource('translateRoleTextMessage');
  assert.match(fn,/roleChatRouteIndex\(c\)/);
  assert.match(fn,/aux:true/);
  assert.match(fn,/temp:\.1/);
  assert.match(fn,/timeout:90000/);
  assert.match(fn,/roleInterceptAudit:null/);
  assert.match(fn,/m\.textTrans=out/);
  assert.match(fn,/m\.textTransSource=source/);
});

test('web runtime contains the automatic text-translation contract',()=>{
  assert.match(source,/function roleTextNeedsTranslation\(/);
  assert.match(source,/async function translateRoleTextMessage\(/);
  assert.match(source,/function roleTextTranslationHTML\(/);
  assert.match(source,/任何语言的外语原文/);
  assert.doesNotMatch(source,/function _chatDrift\(/);
  assert.match(html,/\.role-text-trans\{/);
});
