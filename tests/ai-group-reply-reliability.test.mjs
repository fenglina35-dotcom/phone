import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const asyncStart=source.indexOf(`async function ${name}(`);
  const start=asyncStart>=0?asyncStart:source.indexOf(`function ${name}(`);
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

test('each AI group role gets one genuine-model retry after an empty result',async()=>{
  let calls=0;
  const context=vm.createContext({
    S:{me:{name:'用户'}},
    buildSystem:()=>'',gContext:()=>'',save:()=>{},
    roleVisibleEnvelopeText:value=>String(value||''),
    chatAPI:async()=>++calls===1?'':'第二次真实回复',
    gParseReply:content=>content?[{type:'text',content}]:[],
    String
  });
  vm.runInContext(`${functionSource('groupRoleReplyNickname')}${functionSource('groupRoleReplyItems')}this.run=groupRoleReplyItems;`,context);
  const items=await context.run({nicks:{}},{id:'c1'},[],2);
  assert.equal(calls,2);
  assert.equal(items.length,1);
  assert.equal(items[0].content,'第二次真实回复');
});

test('group reply failure stays silent instead of manufacturing a role message',async()=>{
  let calls=0;
  const context=vm.createContext({
    S:{me:{name:'用户'}},
    buildSystem:()=>'',gContext:()=>'',save:()=>{},
    roleVisibleEnvelopeText:value=>String(value||''),
    chatAPI:async()=>{calls++;throw new Error('route unavailable');},
    gParseReply:()=>[],String
  });
  vm.runInContext(`${functionSource('groupRoleReplyNickname')}${functionSource('groupRoleReplyItems')}this.run=groupRoleReplyItems;`,context);
  assert.deepEqual(Array.from(await context.run({nicks:{}},{id:'c1'},[],2)),[]);
  assert.equal(calls,2);
});

test('group reply turns are serialized per group without disabling selected responders',()=>{
  const queue=functionSource('aiGroupReply');
  const run=functionSource('aiGroupReplyRun');
  assert.match(queue,/_aiGroupReplyQueues\.get\(id\)/);
  assert.match(queue,/previous\.catch\(\(\)=>\{\}\)\.then\(\(\)=>aiGroupReplyRun\(id,fromText\)\)\.catch\(\(\)=>\{\}\)/);
  assert.match(run,/const allowed=\(g\.responders&&g\.responders\.length\)\?g\.responders:g\.members/);
  assert.match(run,/await groupRoleReplyItems\(g,c,recent,pcap\)/);
});
