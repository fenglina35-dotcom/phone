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

  /* v1738：一轮回复里的多条外语气泡合并成一次请求。以前每条各调一次模型，连发几句就连吃 429。 */
  const TRANSLATION_FUNCTIONS=['roleTextTranslationClean','roleTextTranslationPrompt','roleTextTranslationBatchPrompt','roleTextTranslationBatchParse','roleTextTranslationRetryable','roleTextTranslationBackoff','roleTextTranslationFailureLabel','roleTextTranslationRun','roleTextTranslationFlush','roleTextTranslationSchedule','translateRoleTextMessage','retryRoleTextTranslation'];
  function translationSandbox(messages,chatAPI,extra){
    const c=Object.assign({Set,Map,Promise,Math,String,Number,Date,Array,Error,RegExp,setTimeout,clearTimeout,
      _roleTextTranslationBusy:new Set(),_roleTextTranslationQueue:Promise.resolve(),_roleTextTranslationPending:[],_roleTextTranslationTimer:0,
      ROLE_TEXT_TRANSLATION_BATCH_MAX:12,ROLE_TEXT_TRANSLATION_BATCH_CHARS:3200,ROLE_TEXT_TRANSLATION_BATCH_WAIT:9000,
      getC:id=>id==='c1'?{id}:null,msgs:()=>messages,cur:()=>({p:'home'}),refreshChatMessages(){},save(){},
      roleTextNeedsTranslation:()=>true,roleChatRouteIndex:()=>0,sleeps:[],chatAPI},extra||{});
    c.sleep=ms=>{c.sleeps.push(ms);return Promise.resolve();};
    vm.createContext(c);
    for(const name of TRANSLATION_FUNCTIONS)vm.runInContext(sourceOf(source,name),c);
    return c;
  }
  const numbered=rows=>rows[rows.length-1].content;

  test(file+' sends every pending bubble of a reply in ONE numbered request and waits out a 429',async()=>{
    const messages=[
      {id:'m1',role:'assistant',type:'text',content:'First English message.'},
      {id:'m2',role:'assistant',type:'text',content:'Second English message.'},
      {id:'m3',role:'assistant',type:'text',content:'Third English message.'},
    ];
    let calls=0,active=0,maxActive=0,first429=true;const prompts=[];
    const c=translationSandbox(messages,async rows=>{calls++;active++;maxActive=Math.max(maxActive,active);prompts.push(numbered(rows));await new Promise(r=>setTimeout(r,5));active--;if(first429){first429=false;const e=new Error('HTTP 429');e.status=429;throw e;}return '[1] 第一句\n[2] 第二句\n[3] 第三句';});
    await Promise.all(messages.map(m=>c.translateRoleTextMessage('c1',m.id)));
    assert.equal(maxActive,1,'translation calls must never overlap');
    assert.equal(calls,2,'three bubbles cost one request, plus one retry for the 429 — not one request per bubble');
    assert.match(prompts[0],/^\[1\] First English message\.\n\n\[2\] Second English message\.\n\n\[3\] Third English message\.$/);
    assert.deepEqual(messages.map(x=>x.textTrans),['第一句','第二句','第三句']);
    assert.deepEqual(c.sleeps,[2500],'a rate limit backs off for seconds instead of re-sending after 650ms');
    assert.equal(c.roleTextTranslationRetryable(new Error('翻译结果为空')),true,'empty model output should receive a bounded retry');
    assert.equal(c._roleTextTranslationBusy.size,0,'completed batch items must release their busy keys');
  });

  test(file+' keeps collecting while the role is still sending bubbles, so a staggered reply is still one request',async()=>{
    const messages=[{id:'m1',role:'assistant',type:'text',content:'First English message.'},{id:'m2',role:'assistant',type:'text',content:'Second English message.'}];
    let calls=0,busy=true;
    const c=translationSandbox(messages,async()=>{calls++;return '[1] 第一句\n[2] 第二句';},{replyGenerationBusy:()=>busy});
    const first=c.translateRoleTextMessage('c1','m1');
    await new Promise(r=>setTimeout(r,330));
    assert.equal(calls,0,'nothing is sent while the reply is still being emitted');
    const second=c.translateRoleTextMessage('c1','m2');busy=false;
    await Promise.all([first,second]);
    assert.equal(calls,1);
    assert.deepEqual(messages.map(x=>x.textTrans),['第一句','第二句']);
  });

  test(file+' asks again only for the numbers the model skipped, still as one request',async()=>{
    const messages=[1,2,3].map(n=>({id:'m'+n,role:'assistant',type:'text',content:'English message number '+n+'.'}));
    const prompts=[];
    const c=translationSandbox(messages,async rows=>{prompts.push(numbered(rows));return prompts.length===1?'[1] 第一句\n[3] 第三句':'只漏掉的那句';});
    await Promise.all(messages.map(m=>c.translateRoleTextMessage('c1',m.id)));
    assert.equal(prompts.length,2);
    assert.equal(prompts[1],'English message number 2.','the follow-up carries only the skipped bubble');
    assert.deepEqual(messages.map(x=>x.textTrans),['第一句','只漏掉的那句','第三句']);
  });

  test(file+' parses numbered translations with multi-line bodies and ignores numbers outside the batch',()=>{
    const c=translationSandbox([],async()=>'');
    assert.deepEqual(Array.from(c.roleTextTranslationBatchParse('[1] 第一行\n第二行\n【2】：第二条\n[9] 多出来的',2)),['第一行\n第二行','第二条']);
    assert.deepEqual(Array.from(c.roleTextTranslationBatchParse('完全没有编号',2)),['','']);
  });

  test(file+' releases a queued item when its message changed before execution',async()=>{
    const messages=[
      {id:'m1',role:'assistant',type:'text',content:'First English message.'},
      {id:'m2',role:'assistant',type:'text',content:'Second English message.'},
    ];
    const prompts=[];
    const c=translationSandbox(messages,async rows=>{prompts.push(numbered(rows));return '中文译文';});
    const first=c.translateRoleTextMessage('c1','m1'),second=c.translateRoleTextMessage('c1','m2');
    messages[1].content='Message edited while waiting.';
    await Promise.all([first,second]);
    assert.equal(c._roleTextTranslationBusy.size,0,'changed queued messages must not stay permanently busy');
    assert.deepEqual(prompts,['First English message.'],'the edited bubble is dropped from the batch');
    assert.equal(messages[0].textTrans,'中文译文');
    assert.equal(messages[1].textTrans,undefined);
  });

  test(file+' exposes a safe actionable translation failure label without retrying authentication errors',async()=>{
    const message={id:'m1',role:'assistant',type:'text',content:'English message.'};let calls=0;
    const c=translationSandbox([message],async()=>{calls++;const e=new Error('HTTP 401');e.status=401;throw e;});
    await c.translateRoleTextMessage('c1','m1');
    assert.equal(calls,1);
    assert.match(message._textTransLabel,/鉴权|Key/);
    assert.match(sourceOf(source,'roleTextTranslationHTML'),/_textTransLabel/);
  });

  test(file+' retries every failed bubble of the chat together when one retry link is tapped',async()=>{
    const messages=[1,2].map(n=>({id:'m'+n,role:'assistant',type:'text',content:'English message number '+n+'.',_textTransState:'failed',_textTransLabel:'翻译请求太多'}));
    let calls=0;
    const c=translationSandbox(messages,async()=>{calls++;return '[1] 第一句\n[2] 第二句';});
    c.retryRoleTextTranslation('c1','m2');
    await new Promise(r=>setTimeout(r,330));await c._roleTextTranslationQueue;
    assert.equal(calls,1);
    assert.deepEqual(messages.map(x=>x.textTrans),['第一句','第二句']);
  });
}
