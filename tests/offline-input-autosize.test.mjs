import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=fs.readFileSync(path.join(root,'app.js'),'utf8');
const privateApp=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'),'utf8');
const shell=fs.readFileSync(path.join(root,'小手机.html'),'utf8');
const privateShell=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html'),'utf8');
const privateIndex=fs.readFileSync(path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html'),'utf8');

function functionSource(source,name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`${name} must exist`);
  let depth=0,opened=false;
  for(let i=start;i<source.length;i++){
    if(source[i]==='{'){depth++;opened=true;}
    else if(source[i]==='}'&&opened&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`${name} is incomplete`);
}

test('offline textarea grows from one line to three lines and then scrolls internally',()=>{
  const sandbox={};
  vm.createContext(sandbox);
  vm.runInContext(functionSource(web,'offInputAutoSize')+';globalThis.resize=offInputAutoSize;',sandbox);
  const input={style:{},scrollHeight:42,scrollTop:19};
  sandbox.resize(input);
  assert.equal(input.style.height,'42px');
  assert.equal(input.style.overflowY,'hidden');
  assert.equal(input.scrollTop,0);
  input.scrollHeight=68;
  sandbox.resize(input);
  assert.equal(input.style.height,'68px');
  assert.equal(input.style.overflowY,'hidden');
  input.scrollHeight=140;
  sandbox.resize(input);
  assert.equal(input.style.height,'90px');
  assert.equal(input.style.overflowY,'auto');
});

test('offline textarea uses a normal caret line height instead of a 42px caret',()=>{
  assert.match(shell,/\.offinput #off_in\{[^}]*max-height:90px!important[^}]*padding:10px 12px!important[^}]*line-height:20px!important/);
  assert.doesNotMatch(shell,/\.offinput #off_in\{[^}]*line-height:42px/);
});

test('ordinary offline date and common life share a first-render autosize listener',()=>{
  assert.equal((web.match(/<textarea id="off_in"/g)||[]).length,2);
  assert.match(web,/document\.addEventListener\('input',e=>\{const ta=e&&e\.target;if\(ta&&ta\.id==='off_in'\)offInputAutoSize\(ta\);\},\{passive:true\}\)/);
  assert.match(functionSource(web,'offNarrationDecorate'),/offInputAutoSize\(ta\)/);
});

test('web and private app keep the offline input fix identical',()=>{
  const normalize=value=>value.replaceAll('\r\n','\n');
  assert.equal(normalize(functionSource(privateApp,'offInputAutoSize')),normalize(functionSource(web,'offInputAutoSize')));
  assert.equal(normalize(functionSource(privateApp,'offNarrationDecorate')),normalize(functionSource(web,'offNarrationDecorate')));
  const css=/\.offinput\{[^}]+\}\s*\.offinput #off_in\{[^}]+\}\s*\.offinput #off_in::\-webkit-scrollbar\{[^}]+\}/;
  assert.equal(normalize(privateShell.match(css)?.[0]),normalize(shell.match(css)?.[0]));
  assert.equal(normalize(privateIndex.match(css)?.[0]),normalize(privateShell.match(css)?.[0]));
});
