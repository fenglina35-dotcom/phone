import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const bundle=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js',import.meta.url),'utf8');

function fn(name){
  const starts=[source.indexOf(`function ${name}(`),source.indexOf(`async function ${name}(`)].filter(x=>x>=0);
  assert.ok(starts.length,`missing ${name}`);
  const start=Math.min(...starts),brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const replyFns=['hisFriendReplyKey','hisFriendReplyBusy','queueHisFriendReply','hisFriendReplyFallback','hisFriendReplyText','aiHisFriendReply'];

function harness(chatAPI){
  const c={id:'role',name:'先生'},friends=[
    {id:'a',name:'阿哲',relation:'朋友',msgs:[{r:'me',c:'在吗',t:1}]},
    {id:'b',name:'林姐',relation:'同事',msgs:[{r:'me',c:'有空吗',t:2}]}
  ],spy={};
  const context=vm.createContext({
    String,Date,setTimeout,clearTimeout,chatAPI,
    getC:id=>id==='role'?c:null,
    hisWxData:()=>({friends}),
    hisSpyFriend:(cid,name)=>spy[name]||(spy[name]={lines:[]}),
    cleanReply:x=>String(x||''),
    save:()=>{},cur:()=>({p:'none'}),render:()=>{}
  });
  vm.runInContext(`let _hisReplyState={};${replyFns.map(fn).join('\n')}globalThis.queue=queueHisFriendReply;globalThis.busy=hisFriendReplyBusy;`,context);
  return {context,friends,spy};
}

async function waitFor(check){for(let i=0;i<40;i++){if(check())return;await new Promise(r=>setTimeout(r,0));}throw new Error('timed out');}

test('logged-in WeChat friends reply independently instead of sharing one dropped global lock',async()=>{
  const pending=[];
  const h=harness((messages)=>new Promise(resolve=>pending.push({messages,resolve})));
  h.context.queue('role','a');
  h.context.queue('role','b');
  await waitFor(()=>pending.length===2);
  assert.equal(h.context.busy('role','a'),true);
  assert.equal(h.context.busy('role','b'),true);
  pending.find(x=>x.messages[0].content.includes('阿哲')).resolve('刚看到，怎么了？');
  pending.find(x=>x.messages[0].content.includes('林姐')).resolve('有空，你说。');
  await waitFor(()=>!h.context.busy('role','a')&&!h.context.busy('role','b'));
  assert.equal(h.friends[0].msgs.at(-1).c,'刚看到，怎么了？');
  assert.equal(h.friends[1].msgs.at(-1).c,'有空，你说。');
  assert.deepEqual(h.spy['阿哲'].lines,['阿哲：刚看到，怎么了？']);
  assert.deepEqual(h.spy['林姐'].lines,['林姐：有空，你说。']);
});

test('an empty or failed friend response retries once, then still leaves a natural visible reply',async()=>{
  const routes=[];
  const h=harness(async(messages,opt)=>{routes.push(opt.aux);return '';});
  h.context.queue('role','a');
  await waitFor(()=>!h.context.busy('role','a'));
  assert.deepEqual(routes,[true,false]);
  assert.equal(h.friends[0].msgs.filter(x=>x.r==='ta').length,1);
  assert.ok(h.friends[0].msgs.at(-1).c.trim());
  assert.equal(h.spy['阿哲'].lines.length,1);
});

test('the send and UI paths use the reliable per-friend queue',()=>{
  assert.match(fn('hisChatSend'),/queueHisFriendReply\(cid,fid\)/);
  assert.doesNotMatch(source,/let _hisReplyBusy=false/);
  assert.match(fn('renderHisChat'),/hisFriendReplyBusy\(cid,fid\)/);
  assert.match(fn('renderHisChat'),/对方正在输入/);
  assert.match(source,/APP_VER='v1042 · 跨场景记忆与外卖验证续跑修复版'/);
  assert.match(bundle,/queueHisFriendReply\(cid,fid\)/);
  assert.doesNotMatch(bundle,/let _hisReplyBusy=false/);
});
