import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const privateApp=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneWeb.bundle','app.js'),'utf8');
const publicApp=fs.readFileSync(path.join(root,'app.js'),'utf8');
const privateBackup=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','PhoneWeb.bundle','private-cloud-backup.js'),'utf8');
const privateWebView=fs.readFileSync(path.join(root,'native','private-small-phone','XcodeProject','PhoneCompanionTest','LocalPhoneWebView.swift'),'utf8');

function functionSource(source,name){
  const start=source.indexOf(`function ${name}`);assert.notEqual(start,-1,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false,regex=false,regexClass=false,prev='';
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(regex){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='[')regexClass=true;else if(ch===']')regexClass=false;else if(ch==='/'&&!regexClass)regex=false;continue;}
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='/'&&source[i+1]!=='/'&&source[i+1]!=='*'&&/[=(,:;!&|?\[{]/.test(prev)){regex=true;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
    if(!/\s/.test(ch))prev=ch;
  }
  throw new Error(`unterminated ${name}`);
}

function runtime(){
  const context=vm.createContext({String,Array,Object,RegExp,Set,Math,
    CJK_RE:/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g,
    CJK_TEST:/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/,
    CN_PUNCT_RE:/[（）()「」『』【】《》〈〉、，。．！？；：…—～·“”‘’]/g,
    ttsContentLang:c=>c&&c.lang||'英'
  });
  for(const name of ['normVoiceLang','hasForeign','hasCN','callCnTermFix','callNormalizeCnTranslationLine','callNormalizeForeignOrig','callIsActionLine','callInlineTranslationParts','callNormalizeLine','callBadForeignMix','callBadForeignLine','callResponseUnits','callStoredLineParts','smartHomeRoleStripTags']){
    vm.runInContext(functionSource(privateApp,name),context);
  }
  return context;
}

test('private call parser separates inline Chinese translation and drops the repeated following line',()=>{
  const c=runtime();
  assert.deepEqual(JSON.parse(JSON.stringify(c.callInlineTranslationParts('Unlucky? （倒霉？）','英'))),{orig:'Unlucky?',trans:'（倒霉？）'});
  assert.deepEqual(JSON.parse(JSON.stringify(c.callResponseUnits([
    'Unlucky? （倒霉？）','（倒霉？）','【伸手把她脑袋轻轻按进自己胸口】',
    'Tell Sir what else happened. （跟先生说说还发生什么了。）','（跟先生说说还发生什么了。）'
  ],'英',false))),[
    {orig:'Unlucky?',trans:'（倒霉？）'},
    {orig:'【伸手把她脑袋轻轻按进自己胸口】',trans:''},
    {orig:'Tell Sir what else happened.',trans:'（跟先生说说还发生什么了。）'}
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(c.callResponseUnits(['So no. (所以不行。)','（所以不行。）'],'英',true))),[
    {orig:'So no.',trans:'（所以不行。）'}
  ]);
});

test('stored private call rows display one original and one translation without rewriting the record',()=>{
  const c=runtime(),message={content:'So no. Not until you answer. （所以不行，除非你回答。）',_callTrans:'（所以不行，除非你回答。）'};
  assert.deepEqual(JSON.parse(JSON.stringify(c.callStoredLineParts(message,{lang:'英'}))),{
    text:'So no. Not until you answer.',trans:'（所以不行，除非你回答。）'
  });
  const render=functionSource(privateApp,'renderCallLog');
  assert.match(render,/filter\(m=>m\._call&&!m\._callTranslationOf\)/);
  assert.match(render,/callStoredLineParts\(m,c\)/);
});

test('private call boundary hides every smart-home protocol while public v1290 stays unchanged',()=>{
  const c=runtime(),raw='先处理。\n[智能家电|门锁|action=unlock]\n[智能家电|空调|temperature=24]\n[智能家电|小灯|power=on]';
  assert.equal(c.smartHomeRoleStripTags(raw),'先处理。');
  assert.match(privateApp,/content=_rawOutput\?smartHomeRoleStripTags\(content\):_callSmartHomeFinal\.content/);
  assert.match(publicApp,/APP_VER='v1290 · 抖音图片铺满整屏'/);
});

test('successful private cloud-backup timeout fix remains a release blocker',()=>{
  assert.match(privateBackup,/account\.backup\.file\.commit'\s*,\s*\{token\}\s*,\s*1920000/);
  assert.match(privateWebView,/action === 'account\.backup\.file\.commit' \? 1800000/);
});
