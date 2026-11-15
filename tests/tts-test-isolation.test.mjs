import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {read,fnSource} from './_helpers.mjs';
const bases=['','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/'];
function extract(s,name){const start=s.search(new RegExp('(?:async )?function '+name+'\\('));assert(start>=0,name);const next=s.slice(start+10).search(/\n(?:async )?function /);return s.slice(start,next<0?undefined:start+10+next);}
function fixture(base,relay,fields={}){const app=fs.readFileSync(base+'app.js','utf8'),result={style:{},textContent:''},calls=[];const config={relay,enabled:true,base:'https://saved.example/v1',key:'saved-key',voice:'saved-voice'};const c={S:{settings:{tts:config}},$:id=>id==='#testT'?result:{value:fields[id]||''},audioUnlock(){},initAudio(){},aiCoreUrl:()=> 'https://owned.example',ttsArr:async(text,o,opt)=>{calls.push({text,o,opt,global:c.S.settings.tts});return new ArrayBuffer(1)},decodeBuf:async()=>({}),playBuf:async()=>true,toast(){},aiVoiceRelayOn:()=>!!c.S.settings.tts.relay,aiVoiceTestText:()=> 'test',cur:()=>({p:'home'}),aiRenderStable(){},aiInternalVoiceId:()=>'',AI_DEFAULT_TTS_VOICE:'voice',aiRelay:async()=>{calls.push('internal');throw Error('fixture stop');},setTimeout(){},_aiVoiceTestBusy:false,_aiVoiceTestStatus:'',aiAccountRefresh(){}};vm.createContext(c);vm.runInContext(extract(app,'testTTS'),c);;return {c,app,result,calls,config};}
for(const base of bases){
 test(base+'external empty/partial form never calls any synthesis route regardless of saved relay',async()=>{
  for(const relay of [false,true])for(const fields of [{},{s_tbase:'https://own.example'},{s_tkey:'own-key'}]){
   const f=fixture(base,relay,Object.fromEntries(Object.entries(fields).map(([k,v])=>['#'+k,v])));await f.c.testTTS();assert.equal(f.calls.length,0);assert.equal(f.c.S.settings.tts,f.config);assert.match(f.result.textContent,/外置.*地址.*Key/);
  }
 });
 test(base+'external test captures only the entered route without replacing live config',async()=>{
  const f=fixture(base,true,{'#s_tbase':'https://own.example/v1','#s_tkey':'own-key','#s_tvoice':'own-voice'});
  await f.c.testTTS();assert.equal(f.calls.length,1);assert.equal(f.calls[0].global,f.config);assert.equal(f.calls[0].opt.externalConfig.key,'own-key');assert.equal(f.c.S.settings.tts,f.config);assert.match(f.result.textContent,/外置/);
 });





 test(base+'external test does not overwrite a setting changed while synthesis is pending',async()=>{
  const f=fixture(base,true,{'#s_tbase':'https://own.example/v1','#s_tkey':'own-key'});const updated={relay:false,voice:'user-new-choice'};
  f.c.ttsArr=async()=>{f.c.S.settings.tts=updated;return new ArrayBuffer(1);};await f.c.testTTS();assert.equal(f.c.S.settings.tts,updated);
 });
}

for(const base of bases)test(base+' external errors retain nested provider reason and redact credentials',async()=>{
 const app=read(base+'app.js'),secret='sk_fixture_PRIVATE_1234567890';
 for(const [status,body,expected] of [
  [401,{detail:{status:'invalid_api_key',message:'Invalid API key'}},/密钥认证失败/],
  [401,{detail:{code:'missing_permissions',message:'Missing text_to_speech permission'}},/缺少所需权限/],
  [401,{detail:{status:'paid_plan_required',message:'Upgrade to use this voice'}},/需要付费套餐权限/],
  [402,{detail:{code:'quota_exceeded',message:'Not enough credits'}},/额度不足/],
  [404,{detail:{code:'voice_not_found',message:'Voice not found'}},/音色不存在或不可访问/],
  [403,{error:{message:'Denied '+secret}},/Denied/],
  [401,{detail:'Invalid token '+secret},/Invalid token/],
  [500,'upstream failed '+secret,/upstream failed/]
 ]){
  let calls=0;
  const c=vm.createContext({Object,String,Error,Array,JSON,EXTERNAL_TTS_RELAY_URL:'https://fixture.invalid',ttsProviderKind:()=> 'elevenlabs',fetchT:async()=>{calls++;return {ok:false,status,clone:()=>({text:async()=>typeof body==='string'?body:JSON.stringify(body)})}}});
  if(app.includes('function externalTtsErrorDetail('))vm.runInContext(fnSource(app,'externalTtsErrorDetail'),c);
  vm.runInContext(fnSource(app,'externalTtsRelay'),c);
  let failure;try{await c.externalTtsRelay({key:secret},{voice_id:'fixture',text:'test'});}catch(e){failure=e;}
  assert(failure);assert.match(failure.message,expected);assert(!failure.message.includes(secret));assert(!failure.message.includes('[object Object]'));assert.equal(failure.status,status);assert.equal(calls,1);
 }
});
