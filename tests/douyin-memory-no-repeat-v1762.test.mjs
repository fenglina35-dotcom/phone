/* 她发了一条抖音，角色在微信问过一次，隔几轮又问一遍（2026-10-16 实机）。
   原因：dyMemoryPrompt 每轮都把她最近的作品放进系统提示，标题写「可以自然提起」，却没有时间，也没说已经聊过的别再问。
   这里锁住：每条带「多久以前」，并明确已经在微信里聊过的不要再问。真实模型是否完全不再重复，需要实机观察。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fnSource(src,name){const start=src.indexOf('function '+name+'(');assert.ok(start>=0,'missing '+name);const brace=src.indexOf('{',start);let depth=0,quote='',esc=false;
  for(let i=brace;i<src.length;i++){const ch=src[i];if(quote){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===quote)quote='';continue;}if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return src.slice(start,i+1);}throw new Error('unterminated '+name);}
for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
  test(file+': her Douyin posts carry how long ago, and already-discussed posts must not be asked about again',()=>{
    const src=read(file),now=Date.now();
    const ctx=vm.createContext({Date,Math,String,S:{me:{name:'North'},dy:{dms:[],mine:[{ts:now-3*3600e3,desc:'今天的晚霞',comments:[]}]}},dyGroups:()=>[],dyWorkBody:()=>'',dyGFind:()=>null});
    vm.runInContext(fnSource(src,'dyTimeAgo')+'\n'+fnSource(src,'dyMemoryLines')+'\n'+fnSource(src,'dyMemoryPrompt'),ctx);
    const out=ctx.dyMemoryPrompt({id:'c1'});
    assert.match(out,/（3小时前）【North发的抖音作品】今天的晚霞/,'each entry says when it happened');
    assert.match(out,/已经问过、夸过、聊过的作品或事情，不要再问一遍/,'no re-asking what was already discussed');
  });
}
