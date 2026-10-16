// K keeps its own speech routes (private-robot-voice.js, cloudSettings). The owner switched the
// phone's Fish voice to member login with drama-3 on 2026-10-17 and K was cut off ("小手机尚未连接
// 语音通道"), because the cloud sync required the phone's current route to be Fish API key +
// s2.1-pro-free. Now K remembers the last usable Groq and Fish API routes and keeps using them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const voice=fs.readFileSync(new URL('../native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-robot-voice.js',import.meta.url),'utf8');

function world(){
  const start=voice.indexOf("  const K_ROUTES_KEY="),end=voice.indexOf('  let cloudPending=null;',start);
  assert.ok(start>0&&end>start,'K route block present');
  const store=new Map();
  const phone={
    stt:{base:'https://api.groq.com/openai/v1/',key:'groq-key',model:'whisper-large-v3-turbo'},
    tts:{provider:'fish',base:'https://api.fish.audio',key:'fish-api-key',model:'s2.1-pro-free',enabled:true},
    voice:'voice-of-role',
  };
  const context={
    phone,store,
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    state:{roleId:'role-1'},
    getC:id=>id==='role-1'?{id,model:'main'}:null,
    sttCfg:()=>phone.stt,sttRelayOn:()=>false,
    ttsProviderKind:t=>t.provider,
    external:()=>{if(!phone.tts)throw Error('当前角色没有启用已匹配的外置语音路线');return {cfg:phone.tts,voice:phone.voice};},
    chatRequestRoute:()=>({base:'https://chat.example/v1',key:'chat-key',model:'role-model'}),roleChatRouteIndex:()=>0,
    msgsForAccount:()=>[],chinese:m=>m.content,buildSystem:()=>'人设',
  };
  vm.createContext(context);
  vm.runInContext(voice.slice(start,end)+'\nthis.cloudSettings=cloudSettings;',context);
  return context;
}

test('K uses the phone routes while they suit it, and remembers them',()=>{
  const w=world();
  const r=w.cloudSettings().routes;
  assert.equal(r.asr.base,'https://api.groq.com/openai/v1');assert.equal(r.asr.key,'groq-key');
  assert.equal(JSON.stringify(r.tts),JSON.stringify({base:'https://api.fish.audio',key:'fish-api-key',model:'s2.1-pro-free',voice:'voice-of-role'}));
  assert.ok(w.store.get('smallPhone.robotVoice.kRoutes.v1').includes('fish-api-key'));
});

test('switching the phone to Fish member login with drama-3 does not cut K off',()=>{
  const w=world();
  Object.assign(w.phone.tts,{provider:'fishmcp',model:'drama-3'});
  const r=w.cloudSettings().routes;
  assert.equal(r.tts.model,'s2.1-pro-free','K always speaks with s2.1-pro-free');assert.equal(r.tts.key,'fish-api-key');assert.equal(r.tts.voice,'voice-of-role');
});

test('another voice platform, a missing key or another STT: K keeps what it remembered',()=>{
  const w=world();w.cloudSettings();
  w.phone.tts={provider:'minimax',base:'https://api.minimax.chat',key:'mm',model:'speech-02'};
  w.phone.stt={base:'https://stt.example/v1',key:'other'};
  let r=w.cloudSettings().routes;
  assert.equal(r.tts.key,'fish-api-key');assert.equal(r.asr.key,'groq-key');
  w.phone.tts={provider:'fishmcp',base:'https://api.fish.audio',key:'',model:'drama-3'};
  r=w.cloudSettings().routes;assert.equal(r.tts.key,'fish-api-key','member login with the API key field empty');
  w.phone.tts=null;r=w.cloudSettings().routes;assert.equal(r.tts.voice,'voice-of-role');
});

test('with nothing usable now or before, the reason is said plainly',()=>{
  const w=world();
  w.phone.tts={provider:'fishmcp',base:'https://api.fish.audio',key:'',model:'drama-3'};
  assert.throws(()=>w.cloudSettings(),/Fish 音色和 Fish API Key/);
  const v=world();v.phone.stt={base:'https://stt.example/v1',key:'x'};
  assert.throws(()=>v.cloudSettings(),/Groq 语音转文字/);
});

test('a Fish voice remembered for one role is not used for another',()=>{
  const w=world();w.cloudSettings();
  w.state.roleId='role-2';w.getC=id=>({id,model:'main'});
  w.phone.tts={provider:'fishmcp',base:'https://api.fish.audio',key:'',model:'drama-3'};
  assert.throws(()=>w.cloudSettings(),/Fish 音色和 Fish API Key/);
});
