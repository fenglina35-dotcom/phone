import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('the narration button toggles the existing composer without a modal',()=>{
  const classes=new Set();
  const button={classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}},setAttribute(name,value){this[name]=value;},title:''};
  const bar={classList:{toggle(name,on){if(on)classes.add(`bar:${name}`);else classes.delete(`bar:${name}`);}}};
  const textarea={placeholder:'',focus(){this.focused=true;},closest:()=>bar};
  const context=vm.createContext({document:{},_off:{mode:'cohab',busy:false,narrateMode:false},$:selector=>selector==='.off-narrate'?button:selector==='#off_in'?textarea:null});
  vm.runInContext(`${functionSource('offNarrationMode')}${functionSource('offNarrationDecorate')}${functionSource('offNarrate')}this.toggle=offNarrate;`,context);
  context.toggle();
  assert.equal(context._off.narrateMode,true);
  assert.equal(button['aria-pressed'],'true');
  assert.equal(classes.has('on'),true);
  assert.match(textarea.placeholder,/第三人称动作/);
  assert.equal(textarea.focused,true);
  context.toggle();
  assert.equal(context._off.narrateMode,false);
  assert.equal(button['aria-pressed'],'false');
  assert.equal(classes.has('on'),false);
  assert.match(textarea.placeholder,/当面对TA说/);
  assert.doesNotMatch(functionSource('offNarrate'),/prompt\(/);
});

test('the same send button stores narration or normal dialogue according to the toggle',()=>{
  const send=functionSource('offSay');
  assert.match(send,/offNarrationMode\(\)\?\{id:uid\(\),who:'旁白',source:'me',text:v,time:Date\.now\(\)\}:\{id:uid\(\),who:'me',text:v,time:Date\.now\(\)\}/);
  assert.match(send,/if\(_off\.mode==='cohab'\)cohabPushMessage\(o,item\);else o\.msgs\.push\(item\)/);
  assert.match(send,/!manualReplySceneOn\('offline'\)\)offAI\(\)/);
  assert.match(functionSource('offRender'),/offNarrationDecorate/);
  assert.match(html,/\.offinput \.off-narrate\.on/);
  assert.match(html,/\.offinput\.narration-mode #off_in/);
});
