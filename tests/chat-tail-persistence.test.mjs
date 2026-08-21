import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const asyncStart=source.indexOf(`async function ${name}`);
  const start=asyncStart>=0?asyncStart:source.indexOf(`function ${name}`);
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

test('the latest visible role reply has a compact synchronous recovery tail',()=>{
  const local=new Map();
  const context=vm.createContext({
    WECHAT_TAIL_KEY:'tail',Date:{now:()=>500},
    localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,String(v))},
    accountMessageKey:(id,aid)=>`${id}#${aid}`,actId:()=> 'main',
    S:{_persistedAt:100,messages:{'role#main':[
      {id:'m1',role:'user',type:'text',content:'在吗',time:100},
      {id:'m2',role:'assistant',type:'voice',content:'我在',audio:'data:audio/wav;base64,'+'x'.repeat(4000),time:200},
    ]}},
  });
  for(const name of ['wechatTailSafeRow','wechatTailJournalWrite','wechatTailJournalMerge'])vm.runInContext(functionSource(name),context);
  assert.equal(context.wechatTailJournalWrite('role','main'),true);
  const saved=JSON.parse(local.get('tail'));
  assert.equal(saved.rows.length,2);
  assert.equal(saved.rows[1].content,'我在');
  assert.equal(saved.rows[1].audio,undefined,'large audio bytes must not fill localStorage');
  assert.equal(saved.rows[1]._audioExpired,true);

  context.S={_persistedAt:100,messages:{'role#main':[{id:'m1',role:'user',content:'在吗',time:100}]}};
  assert.equal(context.wechatTailJournalMerge(),true);
  assert.deepEqual(Array.from(context.S.messages['role#main'],m=>m.id),['m1','m2']);
  assert.equal(context.wechatTailJournalMerge(),false,'recovery must be idempotent');

  context.S={_persistedAt:saved.at,messages:{'role#main':[]}};
  assert.equal(context.wechatTailJournalMerge(),false,'a newer saved core must prevent deleted messages from being resurrected');
});

test('each completed role turn is journaled and durably flushed before reply completion',()=>{
  const ai=functionSource('aiReply');
  assert.match(ai,/msgs\(id\)\.push\(vm\);wechatTailJournalWrite\(id,replyAccount\)/);
  assert.match(ai,/msgs\(id\)\.push\(msg\);wechatTailJournalWrite\(id,replyAccount\)/);
  const durable=ai.match(/if\(delivered\)\{\/\* 先把回复真正落盘[\s\S]*?roleBackgroundCancel\(id,\['reply_handoff'\]\);\}/)?.[0]||'';
  assert.ok(durable.indexOf('persistWechatMessagesNow()')>=0);
  assert.ok(durable.indexOf('persistWechatMessagesNow()')<durable.indexOf('roleBackgroundCancel'));
  assert.match(functionSource('bootImages'),/wechatTailJournalMerge\(\)/);
  assert.match(source,/function persistPendingStateOnHide\(\)[\s\S]{0,500}return saveNow\(\)/);
  assert.match(source,/pagehide'[\s\S]{0,500}persistPendingStateOnHide\(\)/);
  assert.doesNotMatch(source,/pagehide'[\s\S]{0,500}saveNow\(\);persistWechatMessagesNow\(\)\.catch/);
  assert.match(source,/visibilitychange'[\s\S]{0,900}persistPendingStateOnHide\(\)/);
  assert.doesNotMatch(source,/visibilitychange'[\s\S]{0,900}saveNow\(\);persistWechatMessagesNow\(\)\.catch/);
});
