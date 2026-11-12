import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const context=vm.createContext({
  S:{
    contacts:[
      {id:'active',name:'仍在的角色',deleted:false},
      {id:'deleted',name:'已删角色',deleted:true},
    ],
    music:{songs:[],chat:[
      {cid:'active',role:'assistant',content:'保留'},
      {cid:'deleted',role:'assistant',content:'隐藏'},
      {cid:'missing',role:'assistant',content:'孤立'},
    ]},
  },
});

vm.runInContext(functionSource('musicInit'),context);
vm.runInContext(functionSource('musicChatContacts'),context);
vm.runInContext(functionSource('musicChatRows'),context);

assert.deepEqual(Array.from(context.musicChatContacts(),c=>c.id),['active']);
assert.deepEqual(Array.from(context.musicChatRows(),m=>m.content),['保留']);
assert.deepEqual(Array.from(context.musicChatRows('active'),m=>m.content),['保留']);
assert.equal(context.musicChatRows('deleted').length,0);

const home=functionSource('renderMusicHome');
assert.doesNotMatch(home,/<em>\$\{chatCount/);
assert.match(functionSource('musicChatHistoryModal'),/onchange="musicChatHistoryModal\(this\.value\)"/);

console.log('music chat history tests passed');

// ROLE_SONG_LIBRARY_V1：拥有者、真实音频和取消边界都必须在两包一致。
const {default:test}=await import('node:test');
const {read,fnSource,PRIV_DIR}=await import('./_helpers.mjs');
function singingHarness(src){
  let account='main',serial=0,release=null;
  const stored=new Map(),played=[],stops=[],rows=[];
  const blob=new Blob([new Uint8Array(12)],{type:'audio/mpeg'});
  const song=(id,owner,ready,title)=>({id,title,roleSongOwner:owner,roleSongReady:ready,src:{t:'idb'},mediaKind:'audio',fileSize:12});
  const state={contacts:[{id:'a',name:'甲'},{id:'b',name:'乙'}],couple:{cid:'a'},music:{songs:[song('mine','',false,'我的原曲'),song('a1','a',true,'小星星'),song('a0','a',false,'未转换'),song('b1','b',true,'乙的歌')],libraryTab:'mine'}};
  state.music.songs[1].roleSongAliases=['Twinkle'];
  const cx=vm.createContext({S:state,Blob,URL,AbortController,Uint8Array,Math,Date,String,Number,Promise,Error,JSON,location:{href:'https://example.test/'},_mCur:null,_ma:null,_mPlaying:false,_call:{id:'a',session:'s1',state:'active',kind:'voice'},_roleSongCallJob:null,
    actId:()=>account,getC:id=>cx.S.contacts.find(c=>c.id===id),uid:()=>String(++serial),mGet:async()=>blob,
    decodeBuf:async()=>({duration:187}),audioBufToDataUrl:()=> 'data:audio/mpeg;base64,AAAA',imgPut:async(k,v)=>stored.set(k,v),imgDel:async k=>stored.delete(k),audioPlayableUrl:async ref=>ref?'blob:song':null,
    playUrl:url=>played.push(url),voiceBarWant:()=>{},save:()=>{},toast:()=>{},msgs:()=>rows,updateCallSub:()=>{},stopCallMediaAudio:why=>stops.push(why),stopBufSource:()=>{},
    playCallMediaWait:async(ab,buf,start,live)=>{if(!live())return false;start();return new Promise(r=>release=r);},setTimeout,clearTimeout,setInterval,clearInterval,
  });
  for(const name of ['roleSongCloudConfig','roleSongSourceStamp','roleSongConvertCandidate','roleSongCloudRequest','roleSongConvert','musicLibraryRoleId','musicLibrarySongs','musicRoleSongs','musicPlaybackSongs','musicKeyText','roleSongIntent','roleSongFind','roleSongPrompt','roleSongLoad','roleSongVoiceMessage','roleSongSpeakMessage','roleSongStopCall','roleSongPlayCall','voiceAudioExpired','voiceDisplayDuration'])vm.runInContext(fnSource(src,name),cx);
  vm.runInContext('const _roleSongConversions=new Map();',cx);cx.fetch=async()=>{throw new Error('unexpected network')};
  cx.VOICE_MAX_SECONDS=60;cx.VOICE_AUDIO_TTL_MS=60000;cx.voiceEstimatedSeconds=()=>5;
  return {cx,stored,played,stops,rows,state,blob,setAccount:x=>account=x,finish:x=>release&&release(x)};
}
for(const [label,file] of [['web','app.js'],['private',PRIV_DIR+'app.js']]){
 const src=read(file);
 test(label+' separates mine, each role, source songs and unambiguous aliases',()=>{
  const {cx}=singingHarness(src);
  assert.deepEqual(Array.from(cx.musicLibrarySongs(),s=>s.id),['mine']);
  assert.deepEqual(Array.from(cx.musicLibrarySongs('role','a'),s=>s.id),['a1','a0']);
  assert.deepEqual(Array.from(cx.musicRoleSongs('a'),s=>s.id),['a1']);
  assert.equal(cx.musicRoleSongs('').length,0);
  assert.equal(cx.roleSongFind('a','Twinkle').id,'a1');
  assert.equal(cx.roleSongFind('a','b1'),null);
  assert.equal(cx.roleSongFind('a','未转换'),null);
  assert.equal(cx.roleSongFind('a','随机').id,'a1');
  const prompt=cx.roleSongPrompt(cx.S.contacts[0],'随机唱首歌','wechat');
  assert.ok(prompt.includes('小星星'));assert.ok(!prompt.includes('乙的歌'));assert.ok(!prompt.includes('未转换'));
  cx._mCur='a1';assert.deepEqual(Array.from(cx.musicPlaybackSongs(),s=>s.id),['a1','a0']);
  cx.S={contacts:[],music:{songs:[]}};assert.equal(cx.musicRoleSongs('a').length,0);
 });
 test(label+' includes an explicitly requested older song even when the library exceeds the prompt limit',()=>{
  const h=singingHarness(src);for(let i=0;i<45;i++)h.state.music.songs.push({id:'extra'+i,title:'演唱曲目'+i,roleSongOwner:'a',roleSongReady:true,src:{t:'idb'}});
  h.state.music.songs.push({id:'requested-old-song',title:'月亮晚安曲',roleSongAliases:['月亮睡眠曲'],roleSongOwner:'a',roleSongReady:true,src:{t:'idb'}});
  const prompt=h.cx.roleSongPrompt(h.state.contacts[0],'给我唱月亮睡眠曲吧','wechat');assert.ok(prompt.includes('requested-old-song'));assert.ok(!prompt.includes('乙的歌'));
 });
 test(label+' spoken singing requests bypass ordinary voice coercion without affecting speech',async()=>{
  const h=singingHarness(src),cx=h.cx;
  for(const name of ['explicitVoiceReplyRequest','voiceReplyTagValid','forceRequestedVoiceReply','finalizeVoiceReply'])vm.runInContext(fnSource(src,name),cx);
  if(src.includes('function roleSongRequestAvailable('))vm.runInContext(fnSource(src,'roleSongRequestAvailable'),cx);
  cx.voiceLangName=()=> '中文';cx.roleReplyEnglishOnly=()=>false;cx.wechatRoleDrift=()=>false;cx.voiceTagNeedsLangFix=()=>false;cx.roleReplyAssertLanguage=()=>{};cx.ttsContentLang=()=> 'zh';cx.splitBubbles=s=>s.split('\n');cx.parseVoiceTagLine=line=>{const m=line.match(/^\[语音\|([^\]]+)\]$/);return m?{text:m[1]}:null;};cx.VOICE_MAX_CHARS=300;cx.ttsRequestedCue=()=>'';cx.ttsAutoCue=()=>'';
  const expression=src.match(/const _voiceRequired=(.*?),_voiceTurnPrompt/)[1];
  const required=text=>{cx._userText=text;cx.note='';cx.c=h.state.contacts[0];return vm.runInContext(expression,cx);};
  const request='我想听小星星用语音给我唱。',forceVoice=required(request);let repairs=0;
  const content=await cx.finalizeVoiceReply('[唱歌|a1]',forceVoice?request:'',cx.c,async()=>{repairs++;return '[语音|一闪一闪亮晶晶]';});
  assert.equal(repairs,0,'真实唱歌指令不应被普通语音修正再次送模');
  assert.equal(content,'[唱歌|a1]');assert.equal(forceVoice,false);
  assert.equal(required('请用语音回复我'),true);
  h.state.music.songs=h.state.music.songs.filter(s=>s.roleSongOwner!=='a');
  assert.equal(required(request),true,'没有本角色曲目时不改变原语音规则');
  h.state.music.songs.push({id:'raw',title:'小星星',roleSongOwner:'a',roleSongReady:false,src:{t:'idb'}});
  assert.equal(required(request),true,'未连接云端的原曲不能声称可演唱');
  h.state.settings={roleSongCloud:{a:{url:'https://song.example',key:'test-key',pitch:-12,model:'claude_fish'}}};
  assert.equal(required(request),true,'仅连接的原曲不自动启动翻唱');
 });
 test(label+' singing a pending source never starts conversion without the music action',async()=>{
  const h=singingHarness(src),cx=h.cx;h.state.settings={roleSongCloud:{a:{url:'https://fixture.invalid',key:'test-key',pitch:-12,model:'claude_fish'}}};
  let calls=0;cx.roleSongConvert=async()=>{calls++;throw Error('unexpected automatic conversion');};
  await assert.rejects(cx.roleSongVoiceMessage('a','a0'),/还没有准备好/);assert.equal(calls,0);
  const prompt=cx.roleSongPrompt(h.state.contacts[0],'给我唱未转换','wechat');assert.ok(!prompt.includes('"id":"a0"'));
 });
 test(label+' upload respects selected performance and rejects unsupported video without silently changing it',async()=>{
  for(const kind of ['audio','video']){
   const h=singingHarness(src),cx=h.cx,fields={mu_owner:{value:'role'},mu_role:{value:'a'},mu_ready:{value:'performance'},mu_accompaniment:{value:'vocals'},mu_t:{value:'上传成品'},mu_a:{value:''},mu_l:{value:''},mu_url:{value:''}};
   const before=h.state.music.songs.length,notices=[],deleted=[];let closed=0;
   cx.document={getElementById:id=>fields[id]};cx.$=selector=>fields[selector.slice(1)];cx.window={_muBlob:h.blob,_muFileMeta:{mediaKind:kind,fileName:'finished.'+(kind==='video'?'mp4':'wav')}};cx.musicInit=()=>{};cx.mPutVerified=async()=>({size:h.blob.size,type:h.blob.type,sig:'verified',duration:187,mediaKind:kind});cx.mDelIDB=async id=>deleted.push(id);cx.closeModal=()=>{closed++;};cx.render=()=>{};cx.toast=t=>notices.push(t);
   for(const name of ['musicSongOwnerRead','musicApplyStoredMeta','musicAddSave'])vm.runInContext(fnSource(src,name),cx);
   await cx.musicAddSave();
   if(kind==='audio'){assert.equal(h.state.music.songs.length,before+1);assert.equal(h.state.music.songs[0].roleSongReady,true);assert.equal(h.state.music.songs[0].roleSongOwner,'a');assert.equal(closed,1);}
   else{assert.equal(h.state.music.songs.length,before,'不能把选择的成品静默保存为待转换');assert.equal(closed,0);assert.equal(deleted.length,1);assert.ok(notices.some(t=>t.includes('视频')));}
  }
 });
 test(label+' reuses an uploaded performance when the model names the old source entry',async()=>{
  const h=singingHarness(src),cx=h.cx;h.state.settings={roleSongCloud:{a:{url:'https://fixture.invalid',key:'test-key',pitch:-12,model:'claude_fish'}}};
  h.state.music.songs.find(s=>s.id==='a0').title='小星星';
  h.state.music.songs.find(s=>s.id==='a1').roleSongConvertedFrom='prior-cloud-result';
  h.state.music.songs.unshift({id:'uploaded-performance',title:'小星星',roleSongOwner:'a',roleSongReady:true,src:{t:'idb'},mediaKind:'audio',fileSize:12});
  let conversions=0;cx.roleSongConvert=async()=>{conversions++;throw Error('不应再次转换');};
  const voice=await cx.roleSongVoiceMessage('a','a0');
  assert.equal(conversions,0);assert.equal(voice.roleSong.id,'uploaded-performance');
  assert.equal(cx.roleSongFind('a','小星星').id,'uploaded-performance');assert.equal(cx.roleSongFind('a','a1').id,'uploaded-performance');assert.equal(cx.roleSongFind('a','随机').id,'uploaded-performance');
  const prompt=cx.roleSongPrompt(h.state.contacts[0],'给我唱小星星','call');
  assert.ok(prompt.includes('uploaded-performance'));assert.ok(!prompt.includes('prior-cloud-result'));assert.ok(!prompt.includes('"id":"a1"'));
  assert.equal(cx.roleSongFind('b','a0'),null);
 });
 test(label+' stores actual song audio, preserves long duration and never expires it into speech',async()=>{
  const {cx,stored,played}=singingHarness(src);
  const m=await cx.roleSongVoiceMessage('a','a1');
  assert.equal(m.type,'voice');assert.equal(m.dur,187);assert.equal(m.roleSong.cid,'a');assert.equal(stored.size,1);
  assert.equal(cx.voiceDisplayDuration(m),187);assert.equal(cx.voiceDisplayDuration({dur:187}),60);
  m.audioTs=1;assert.equal(cx.voiceAudioExpired(m),false);assert.equal(cx.voiceAudioExpired({role:'assistant',type:'voice',audio:'old',audioTs:1}),true);
  await cx.roleSongSpeakMessage(m,cx.S.contacts[0]);assert.deepEqual(played,['blob:song']);
  assert.equal(await cx.roleSongSpeakMessage(m,cx.S.contacts[1]),false);assert.equal(played.length,1);
 });
 test(label+' rejects late file loads after account switches without persisting or delivering',async()=>{
  const h=singingHarness(src);let ready;h.cx.mGet=()=>new Promise(r=>ready=r);
  const work=h.cx.roleSongVoiceMessage('a','a1');await Promise.resolve();h.setAccount('alt');ready(h.blob);
  assert.equal(await work,null);assert.equal(h.stored.size,0);assert.equal(h.played.length,0);
 });
 test(label+' does not play a historical song after a late account switch',async()=>{
  const h=singingHarness(src);let resolve;h.cx.audioPlayableUrl=()=>new Promise(r=>resolve=r);
  const work=h.cx.roleSongSpeakMessage({id:'m1',audio:'idb-audio:old',roleSong:{cid:'a',id:'a1'}},h.state.contacts[0]);
  h.setAccount('alt');resolve('blob:late');assert.equal(await work,false);assert.equal(h.played.length,0);
 });
 test(label+' cancels pending song delivery when ownership, source or contact changes',async()=>{
  for(const mutation of [h=>h.state.music.songs[1].roleSongOwner='b',h=>h.state.music.songs.splice(1,1),h=>h.state.contacts[0].deleted=true,h=>h.state.music.songs[1].src={t:'url',url:'https://example.test/replaced.mp3'}]){
   const h=singingHarness(src);let resolve;h.cx.mGet=()=>new Promise(r=>resolve=r);
   const work=h.cx.roleSongVoiceMessage('a','a1');mutation(h);resolve(h.blob);
   assert.equal(await work,null);assert.equal(h.stored.size,0);
  }
 });
 test(label+' cloud conversion preserves the original, verifies output and stores only in its role',async()=>{
  const h=singingHarness(src),calls=[];h.state.settings={roleSongCloud:{a:{url:'https://song.example',key:'private-test-key',pitch:-12,model:'claude_fish'}}};
  h.cx.fetch=async(url,opts)=>{calls.push({url,opts});return url.includes('/jobs?')?{ok:true,status:200,json:async()=>({id:'fc-own',proof:'own-proof'})}:{ok:true,status:200,headers:{get:()=> 'audio/mpeg'},blob:async()=>h.blob};};
  h.cx.mPutVerified=async(id,blob,kind)=>{assert.equal(kind,'audio');assert.equal(blob,h.blob);return {size:12,type:'audio/mpeg',sig:'verified',duration:187};};h.cx.musicApplyStoredMeta=(target,prepared,stored)=>Object.assign(target,{fileSize:stored.size,fileType:stored.type,fileSig:stored.sig,mediaDuration:stored.duration});
  const original=h.state.music.songs.find(s=>s.id==='a0'),result=await h.cx.roleSongConvert('a','a0');
  assert.equal(result.roleSongReady,true);assert.equal(result.roleSongOwner,'a');assert.equal(result.mediaDuration,187);assert.equal(original.roleSongReady,false);assert.ok(h.state.music.songs.includes(original));
  assert.equal(calls.length,2);assert.ok(calls[0].url.includes('separate=true'));assert.equal(calls[0].opts.headers.Authorization,'Bearer private-test-key');assert.ok(!JSON.stringify(h.state.music).includes('private-test-key'));assert.ok(!JSON.stringify(h.state.music).includes('own-proof'));
  assert.equal(await h.cx.roleSongConvert('b','a0'),null);
 });
 test(label+' explicitly making a new pitch creates a new performance while unchanged settings reuse it',async()=>{
  const h=singingHarness(src);h.state.settings={roleSongCloud:{a:{url:'https://song.example',key:'private-test-key',pitch:-12,model:'claude_fish'}}};let requests=0;
  h.cx.fetch=async(url)=>{requests++;return url.includes('/jobs?')?{ok:true,status:200,json:async()=>({id:'fc-own',proof:'proof'})}:{ok:true,status:200,headers:{get:()=> 'audio/mpeg'},blob:async()=>h.blob};};h.cx.mPutVerified=async()=>({size:12,type:'audio/mpeg',sig:'verified',duration:187});h.cx.musicApplyStoredMeta=(target,p,stored)=>Object.assign(target,{fileSize:stored.size,fileSig:stored.sig});
  const first=await h.cx.roleSongConvert('a','a0');h.state.settings.roleSongCloud.a.pitch=0;const second=await h.cx.roleSongConvert('a','a0');assert.notEqual(first.id,second.id);assert.equal(requests,4);assert.equal((await h.cx.roleSongConvert('a','a0')).id,second.id);assert.equal(requests,4);assert.ok(!JSON.stringify(h.state.music).includes('private-test-key'));
 });
 test(label+' cloud job resumes without a second upload and rejects late account results',async()=>{
  const h=singingHarness(src);h.state.settings={roleSongCloud:{a:{url:'https://song.example',key:'private-test-key',pitch:-12,model:'claude_fish'}},roleSongJobs:{}};const song=h.state.music.songs.find(s=>s.id==='a0'),stamp=h.cx.roleSongSourceStamp(song);
  h.state.settings.roleSongJobs['main|a|a0']={id:'fc-own',proof:'own-proof',source:stamp,config:JSON.stringify(['https://song.example','claude_fish',-12]),time:Date.now()};let resolve,uploads=0;
  h.cx.fetch=(url,opts)=>{if(opts.method==='POST')uploads++;return new Promise(r=>resolve=r);};
  const work=h.cx.roleSongConvert('a','a0');h.setAccount('alt');resolve({ok:true,status:200,headers:{get:()=> 'audio/mpeg'},blob:async()=>h.blob});
  assert.equal(await work,null);assert.equal(uploads,0);assert.equal(h.state.music.songs.length,4);
 });
 test(label+' keeps the source and releases a confirmed failed cloud job for a later explicit retry',async()=>{
  const h=singingHarness(src);h.state.settings={roleSongCloud:{a:{url:'https://song.example',key:'test-key',pitch:-12,model:'claude_fish'}},roleSongJobs:{}};const source=h.state.music.songs.find(s=>s.id==='a0');h.state.settings.roleSongJobs['main|a|a0']={id:'fc-failed',proof:'proof',source:h.cx.roleSongSourceStamp(source),config:JSON.stringify(['https://song.example','claude_fish',-12]),time:Date.now()};let calls=0;h.cx.fetch=async()=>{calls++;return{ok:false,status:422};};
  await assert.rejects(h.cx.roleSongConvert('a','a0'));assert.equal(calls,1);assert.equal(h.state.settings.roleSongJobs['main|a|a0'],undefined);assert.ok(h.state.music.songs.includes(source));assert.equal(source.roleSongReady,false);
 });
 test(label+' call singing waits for audio and stop releases only that session',async()=>{
  const h=singingHarness(src);const work=h.cx.roleSongPlayCall(h.state.contacts[0],'a1','s1');
  for(let i=0;i<20&&!h.rows.length;i++)await new Promise(r=>setTimeout(r,0));
  assert.equal(h.rows.length,1);assert.equal(h.rows[0]._cs,'s1');assert.equal(h.rows[0].callAudio,h.rows[0].audio);
  assert.equal(h.cx._call.sub.text,'♪ 小星星');assert.ok(h.cx._roleSongCallJob);
  assert.equal(h.cx.roleSongStopCall('manual'),true);assert.equal(await work,false);assert.equal(h.cx._roleSongCallJob,null);
  assert.deepEqual(h.stops,['manual']);
 });
}
for(const [label,file] of [['web','app.js'],['private',PRIV_DIR+'app.js']]){
 test(label+' historical song audio does not age into a spoken replacement',()=>{
  const cx=vm.createContext({Date,Number,VOICE_AUDIO_TTL_MS:1000});vm.runInContext(fnSource(read(file),'voiceAudioExpired'),cx);
  assert.equal(cx.voiceAudioExpired({role:'assistant',type:'voice',audio:'stored-song',audioTs:1,roleSong:{cid:'a',id:'song'}}),false);
  assert.equal(cx.voiceAudioExpired({role:'assistant',type:'voice',audio:'ordinary-tts',audioTs:1}),true);
 });
}
for(const [label,file] of [['web','app.js'],['private',PRIV_DIR+'app.js']]){
 test(label+' call replay never bills a recorded song as regenerated spoken text',async()=>{
  let confirmations=0,ttsCalls=0;
  const cx=vm.createContext({_callReplayRevoiceBusy:false,getC:()=>({id:'a'}),callReplayPickRows:()=>[{role:'assistant',roleSong:true,action:false,text:'♪ 小星星'}],ttsApiOn:()=>true,ttsContentLang:()=> 'zh',pickSpoken:x=>x,toast:()=>{},uiConfirm:async()=>{confirmations++;return false;},ttsArr:async()=>{ttsCalls++;}});
  vm.runInContext(fnSource(read(file),'clReplayRevoice'),cx);await cx.clReplayRevoice('a','session');assert.equal(confirmations,0);assert.equal(ttsCalls,0);
 });
}
