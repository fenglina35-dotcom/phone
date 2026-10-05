import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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
