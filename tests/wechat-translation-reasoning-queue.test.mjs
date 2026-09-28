import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const files=['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'];
function sourceOf(source,name){
  const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
  assert.ok(start>=0,name+' is missing');
  const rest=source.slice(start),next=rest.slice(1).search(/\n(?:async )?function /);
  return next<0?rest:rest.slice(0,next+1);
}

for(const file of files){
  const source=fs.readFileSync(file,'utf8');

  test(file+' strips closed reasoning envelopes and rejects the photographed unclosed reasoning stream',()=>{
    const c={roleVisibleEnvelopeText:value=>String(value||'')};vm.createContext(c);
    for(const name of ['wechatStripReasoningEnvelope','wechatReasoningLeak'])vm.runInContext(sourceOf(source,name),c);
    assert.equal(c.wechatStripReasoningEnvelope('<think>internal steps</think>\nI am here.'),'I am here.');
    assert.equal(c.wechatStripReasoningEnvelope('<think>\nStorm is saying the app finally locked.\nLet me think about what to do.'),'');
    assert.equal(c.wechatReasoningLeak('Storm is saying that the app actually locked this time.\nSo the context is: I tried several times.\nLet me think about what to do.'),true);
    assert.equal(c.wechatReasoningLeak('Let me think for a second, I miss you.'),false,'one ordinary sentence must not be over-blocked');
  });

  if(file!==files[0])continue;

  test(file+' serializes translation requests and retries only transient failures',async()=>{
    const messages=[
      {id:'m1',role:'assistant',type:'text',content:'First English message.'},
      {id:'m2',role:'assistant',type:'text',content:'Second English message.'},
    ];
    let active=0,maxActive=0,calls=0,first429=true;
    const c={
      Set,Promise,Math,String,Number,Date,
      _roleTextTranslationBusy:new Set(),_roleTextTranslationQueue:Promise.resolve(),
      getC:id=>id==='c1'?{id}:null,msgs:()=>messages,cur:()=>({p:'home'}),refreshChatMessages(){},save(){},
      roleTextNeedsTranslation:()=>true,roleChatRouteIndex:()=>0,
      roleTextTranslationPrompt:s=>[{role:'user',content:s}],roleTextTranslationClean:s=>String(s||'').trim(),
      sleep:()=>Promise.resolve(),
      chatAPI:async rows=>{calls++;active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,5));active--;if(first429){first429=false;const e=new Error('HTTP 429');e.status=429;throw e;}return '中文译文';},
    };
    vm.createContext(c);
    for(const name of ['roleTextTranslationRetryable','roleTextTranslationFailureLabel','roleTextTranslationRun','translateRoleTextMessage'])vm.runInContext(sourceOf(source,name),c);
    await Promise.all([c.translateRoleTextMessage('c1','m1'),c.translateRoleTextMessage('c1','m2')]);
    assert.equal(maxActive,1,'translation calls must never overlap');
    assert.equal(calls,3,'one 429 is retried once, then the next queued item runs');
    assert.deepEqual(messages.map(x=>x.textTrans),['中文译文','中文译文']);
    assert.equal(c.roleTextTranslationRetryable(new Error('翻译结果为空')),true,'empty model output should receive one bounded retry');
    assert.equal(c._roleTextTranslationBusy.size,0,'completed queue items must release their busy keys');
  });

  test(file+' releases a queued item when its message changed before execution',async()=>{
    const messages=[
      {id:'m1',role:'assistant',type:'text',content:'First English message.'},
      {id:'m2',role:'assistant',type:'text',content:'Second English message.'},
    ];
    let releaseFirst;
    const firstGate=new Promise(resolve=>{releaseFirst=resolve;});
    const c={Set,Promise,Math,String,Number,Date,_roleTextTranslationBusy:new Set(),_roleTextTranslationQueue:Promise.resolve(),getC:()=>({id:'c1'}),msgs:()=>messages,cur:()=>({p:'home'}),refreshChatMessages(){},save(){},roleTextNeedsTranslation:()=>true,roleChatRouteIndex:()=>0,roleTextTranslationPrompt:s=>[{role:'user',content:s}],roleTextTranslationClean:s=>String(s||'').trim(),sleep:()=>Promise.resolve(),chatAPI:async rows=>{if(rows[0].content==='First English message.')await firstGate;return '中文译文';}};
    vm.createContext(c);
    for(const name of ['roleTextTranslationRetryable','roleTextTranslationFailureLabel','roleTextTranslationRun','translateRoleTextMessage'])vm.runInContext(sourceOf(source,name),c);
    const first=c.translateRoleTextMessage('c1','m1'),second=c.translateRoleTextMessage('c1','m2');
    messages[1].content='Message edited while waiting.';
    releaseFirst();
    await Promise.all([first,second]);
    assert.equal(c._roleTextTranslationBusy.size,0,'changed queued messages must not stay permanently busy');
    assert.equal(messages[1].textTrans,undefined);
  });

  test(file+' exposes a safe actionable translation failure label without retrying authentication errors',async()=>{
    const message={id:'m1',role:'assistant',type:'text',content:'English message.'};let calls=0;
    const c={Set,Promise,Math,String,Number,Date,_roleTextTranslationBusy:new Set(),_roleTextTranslationQueue:Promise.resolve(),getC:()=>({id:'c1'}),msgs:()=>[message],cur:()=>({p:'home'}),refreshChatMessages(){},save(){},roleTextNeedsTranslation:()=>true,roleChatRouteIndex:()=>0,roleTextTranslationPrompt:s=>[{role:'user',content:s}],roleTextTranslationClean:s=>String(s||'').trim(),sleep:()=>Promise.resolve(),chatAPI:async()=>{calls++;const e=new Error('HTTP 401');e.status=401;throw e;}};
    vm.createContext(c);
    for(const name of ['roleTextTranslationRetryable','roleTextTranslationFailureLabel','roleTextTranslationRun','translateRoleTextMessage'])vm.runInContext(sourceOf(source,name),c);
    await c.translateRoleTextMessage('c1','m1');
    assert.equal(calls,1);
    assert.match(message._textTransLabel,/鉴权|Key/);
    assert.match(sourceOf(source,'roleTextTranslationHTML'),/_textTransLabel/);
  });
}
