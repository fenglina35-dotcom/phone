import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const edge=process.env.ROLE_VISIBILITY_EDGE_FILE
 ?fs.readFileSync(process.env.ROLE_VISIBILITY_EDGE_FILE,'utf8')
 :read('supabase/functions/phone-role-push/index.ts');
const source=(s,name)=>s.slice(s.indexOf(`function ${name}(`),s.indexOf('\n}',s.indexOf(`function ${name}(`))+2);
const samples=[
 ['你先休息。\n[应用处理|提醒]','你先休息。'],
 ['【应用处理｜提醒】先休息。','先休息。'],
 ['[ 应用处理 | 锁定 ]',''],
 ['[应用处理|提醒]\n[应用处理|提醒]',''],
 ['[送礼|鲜花] [未知|格式]','[送礼|鲜花] [未知|格式]'],
];

test('APNs projection removes internal app decisions regardless of marker position',()=>{
 const fn=vm.runInNewContext('('+stripTypeScriptTypes(source(edge,'roleNotificationBody'))+')');
 for(const [input,want] of samples)assert.equal(fn(input),want);
 assert.equal(fn('你好。\n[应用处理|提醒]\n[内心|想你。]'),'你好。');
});

for(const file of ['app.js','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js']){
 const app=read(file);
 const one=name=>app.split(/\r?\n/).find(l=>l.startsWith(`function ${name}(`));
 test(file+' foreground suppresses old outbox markers and raw output without hiding cards',()=>{
  const ctx=vm.createContext({roleServerPushUnsafeBody:()=>false,stripHiddenThoughtTags:()=>''});
  vm.runInContext(one('roleServerPushVisibleBody')+'\n'+one('modelUnfilteredThoughtTags'),ctx);
  for(const [input,want] of samples){
   assert.equal(ctx.roleServerPushVisibleBody(input),want);
   assert.equal(ctx.modelUnfilteredThoughtTags(input,{}).trim(),want);
  }
  assert.equal(ctx.modelUnfilteredThoughtTags('  正常原文  ',{}),'  正常原文  ');
 });
 test(file+' ordinary parsed output also strips the internal marker',()=>{
  const ctx=vm.createContext({normalizeHiddenThoughtFormats:s=>s});
  vm.runInContext(one('stripHiddenThoughtTags'),ctx);
  for(const [input,want] of samples)assert.equal(ctx.stripHiddenThoughtTags(input,{}),want);
 });
}

test('persist boundary removes marker before outbox write and APNs without discarding mood metadata',async()=>{
 const start=edge.indexOf('async function persistAndPush('),end=edge.indexOf('\nasync function backgroundTaskStatus(',start);
 let saved,pushed;
 const chain={upsert(row){saved=row;return this;},select(){return this;},eq(){return this;},
  async maybeSingle(){return{data:{id:'row',apns_device_token:'fixture'}};},update(){return this;}};
 const fn=vm.runInNewContext('('+stripTypeScriptTypes(edge.slice(start,end))+')',{
  sendAPNs:async(...a)=>{pushed=a[4];return{status:'sent'};},avatarURL:()=>''
 });
 const input='你好。\n[应用处理|提醒]\n[内心|想你]';
 assert.equal(await fn({from:()=>chain},'',{target:'fixture'},input,'app','fixture'),true);
 assert.equal(saved.body,'你好。\n\n[内心|想你]');
 assert.equal(pushed,saved.body);
 saved=pushed=null;
 assert.equal(await fn({from:()=>chain},'',{target:'fixture'},'[应用处理|提醒]','app','fixture-only'),true);
 assert.equal(saved,null);
 assert.equal(pushed,null);
});
