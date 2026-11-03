import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {read,fnSource,BUNDLES} from './_helpers.mjs';

// MAIL_DAILY_INBOX_COUNT_V1（2026-11-03）：设了每天一封，他一天主动写来两封（不是回信、礼物、心情信）。
// 计数 S._mailCount 被清零后会以为今天没写。现在写之前再数信箱里今天他主动写的信。
for(const [label,file] of BUNDLES){
 const src=read(file);
 const run=async(mail)=>{const calls=[],now=Date.now();
  const ctx=vm.createContext({S:{contacts:[{id:'r1',mailPerDay:1}],mail,_mailCount:{}},isMain:()=>true,actId:()=> 'main',save(){},Math:Object.assign(Object.create(Math),{random:()=>0.99}),Date,
   genLetter:async(id)=>{calls.push(id);return true;},northNativeBackgroundTask:(n,f)=>f(),_mailBusy:{}});
  const helper=src.includes('function mailAutoTodayCount(')?fnSource(src,'mailAutoTodayCount'):'';
  vm.runInContext(helper+fnSource(src,'scanMail'),ctx);await ctx.scanMail();await new Promise(r=>setImmediate(r));return calls.length;};
 test(label+': a letter he already wrote today blocks a second one even if the counter was reset',async()=>{
  const today=Date.now();
  assert.equal(await run([{id:'a',cid:'r1',acct:'main',subject:'给你',body:'…',time:today}]),0,'already wrote today');
  assert.equal(await run([{id:'b',cid:'r1',acct:'main',subject:'回信',body:'…',time:today,replyTo:'x'},{id:'c',cid:'r1',acct:'main',subject:'心情',body:'…',time:today,mood:'miss'},{id:'d',cid:'r1',type:'gift',subject:'礼物',body:'…',time:today}]),1,'replies, mood and gift letters do not count');
  assert.equal(await run([{id:'e',cid:'r1',acct:'main',subject:'昨天',body:'…',time:today-86400000*2}]),1,'older letters do not count');
 });
}
