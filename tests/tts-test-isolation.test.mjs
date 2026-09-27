import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const bases=['','native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/'];
function extract(s,name){const start=s.search(new RegExp('(?:async )?function '+name+'\\('));assert(start>=0,name);const next=s.slice(start+10).search(/\n(?:async )?function /);return s.slice(start,next<0?undefined:start+10+next);}
function fixture(base,relay,fields={}){const app=fs.readFileSync(base+'app.js','utf8'),account=fs.readFileSync(base+'ai-account.js','utf8'),result={style:{},textContent:''},calls=[];const config={relay,enabled:true,base:'https://saved.example/v1',key:'saved-key',voice:'saved-voice'};const c={S:{settings:{tts:config}},$:id=>id==='#testT'?result:{value:fields[id]||''},audioUnlock(){},initAudio(){},aiCoreUrl:()=> 'https://owned.example',ttsArr:async(text,o,opt)=>{calls.push({text,o,opt,global:c.S.settings.tts});return new ArrayBuffer(1)},decodeBuf:async()=>({}),playBuf:async()=>true,toast(){},aiVoiceRelayOn:()=>!!c.S.settings.tts.relay,aiVoiceTestText:()=> 'test',cur:()=>({p:'home'}),aiRenderStable(){},aiInternalVoiceId:()=>'',AI_DEFAULT_TTS_VOICE:'voice',aiRelay:async()=>{calls.push('internal');throw Error('fixture stop');},setTimeout(){},_aiVoiceTestBusy:false,_aiVoiceTestStatus:'',aiAccountRefresh(){}};vm.createContext(c);vm.runInContext(extract(app,'testTTS'),c);vm.runInContext(extract(account,'aiTestVoice'),c);return {c,app,account,result,calls,config};}
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
 test(base+'internal test respects OFF before making any request',async()=>{
  const f=fixture(base,false);await f.c.aiTestVoice();assert.equal(f.calls.length,0);assert.equal(f.c._aiVoiceTestBusy,false);assert.match(f.c._aiVoiceTestStatus,/关闭/);
 });
 test(base+'central internal generation guard blocks before identity sync or HTTP when OFF',async()=>{
  const f=fixture(base,false);let identities=0;f.c.licenseSyncAiIdentity=async()=>{identities++;throw Error('identity reached');};
  vm.runInContext(extract(f.app,'aiRelay'),f.c);
  await assert.rejects(f.c.aiRelay('tts',{text:'hello'}),/内置语音.*关闭/);assert.equal(identities,0);
  await assert.rejects(f.c.aiRelay('external_tts',{text:'hello',key:'   '}),/外置.*Key/);assert.equal(identities,0);
 });
 test(base+'existing internal users retain their voice, charged result and refund access',async()=>{
  for(const enabled of [true,undefined]){
   const f=fixture(base,true);f.config.enabled=enabled;f.config.relayVoice='existing-paid-voice';const requests=[];
   Object.assign(f.c,{licenseSyncAiIdentity:async()=>{},aiUserId:()=> 'existing-user',aiUserSecret:()=> 'fixture-secret',aiCoreKey:()=> 'fixture-public-key',fetchT:async(url,opt)=>{requests.push(JSON.parse(opt.body));return {ok:true,json:async()=>({ok:true,data:{audio:'fixture'},charged:1,balance:9})}}});
   vm.runInContext(extract(f.app,'aiRelay'),f.c);
   const result=await f.c.aiRelay('tts',{text:'hello',voice_id:f.config.relayVoice});assert.equal(result.charged,1);assert.equal(result.balance,9);assert.equal(requests[0].voice_id,'existing-paid-voice');assert.equal(f.config.relayVoice,'existing-paid-voice');
   f.config.relay=false;await f.c.aiRelay('tts_refund',{ledger_id:'existing-ledger'});assert.equal(requests[1].action,'tts_refund');
  }
 });
 test(base+'switching OFF during identity sync prevents the pending internal request',async()=>{
  const f=fixture(base,true);let http=0;
  f.c.licenseSyncAiIdentity=async()=>{f.c.S.settings.tts={relay:false};};f.c.fetchT=async()=>{http++;};
  vm.runInContext(extract(f.app,'aiRelay'),f.c);
  await assert.rejects(f.c.aiRelay('tts',{text:'test'}),/已关闭/);assert.equal(http,0);
 });
 test(base+'external test does not overwrite a setting changed while synthesis is pending',async()=>{
  const f=fixture(base,true,{'#s_tbase':'https://own.example/v1','#s_tkey':'own-key'});const updated={relay:false,voice:'user-new-choice'};
  f.c.ttsArr=async()=>{f.c.S.settings.tts=updated;return new ArrayBuffer(1);};await f.c.testTTS();assert.equal(f.c.S.settings.tts,updated);
 });
}
