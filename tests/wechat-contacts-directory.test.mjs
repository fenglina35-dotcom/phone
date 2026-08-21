import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const glass=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=app.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){
      if(escaped)escaped=false;
      else if(ch==='\\')escaped=true;
      else if(ch===quote)quote='';
      continue;
    }
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const contacts=functionSource('wxContacts');
assert.match(contacts,/新的朋友/);
assert.match(contacts,/仅聊天的朋友/);
assert.match(contacts,/群聊/);
assert.match(contacts,/标签/);
assert.match(contacts,/小手机好友/);
assert.doesNotMatch(contacts,/公众号|服务号|企业微信联系人/);

assert.match(functionSource('renderWxGroupCreate'),/选择一个已有的群/);
assert.match(functionSource('renderWxGroupCreate'),/面对面建群/);
assert.match(functionSource('renderWxGroupCreate'),/选择群聊中的朋友/);
assert.doesNotMatch(functionSource('renderWxGroupCreate'),/企业微信/);

assert.match(functionSource('wxQuickMenuHTML'),/发起群聊/);
assert.match(functionSource('wxQuickMenuHTML'),/添加朋友/);
assert.doesNotMatch(functionSource('wxQuickMenuHTML'),/扫一扫|收付款/);
assert.match(functionSource('toggleWxQuickMenu'),/_wxQuickOpen/);

assert.match(app,/else if\(c\.p==='wxonlychat'\)html=renderWxOnlyChat\(\)/);
assert.match(app,/else if\(c\.p==='wxlabels'\)html=renderWxLabels\(\)/);
assert.match(app,/else if\(c\.p==='wxgroupcreate'\)html=renderWxGroupCreate\(\)/);
assert.match(app,/else if\(c\.p==='contactEdit'\)html=renderContactEditor\(c\.id,c\.isNew\)/);
assert.match(functionSource('editContactAutonomy'),/go\('contactEdit'/);

assert.match(glass,/\.wx-contact-sticky-search\{[^}]*position:sticky/);
assert.match(glass,/\.wx-directory-head\{[^}]*backdrop-filter:blur/);
assert.match(glass,/\.wx-chat-premium>\.manual-reply-row,[^{]+\{[^}]*background:transparent!important/);
assert.match(glass,/\.wx-chat-premium>\.chat-glass-mood\{[^}]*width:max-content/);

console.log('wechat contacts directory tests passed');
