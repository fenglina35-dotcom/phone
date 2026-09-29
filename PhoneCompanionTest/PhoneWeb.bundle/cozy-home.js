'use strict';
// Private phone owns credentials, role identity, history, recognition and audio.
let _cozyHome=null;
function cozyIdentity(){const cid=S.couple&&S.couple.cid,c=cid&&getC(cid);return c&&!c.deleted&&!c.blocked?{cid,c,account:actId(),me:S.me}:null;}
function cozyValid(s){const i=cozyIdentity();return !!(s&&s===_cozyHome&&i&&i.cid===s.cid&&i.account===s.account&&i.me===s.me&&cur().p==='cozyhome');}
function cozyPost(s,kind,data={}){const f=document.getElementById('cozy-home-frame');if(cozyValid(s)&&f)f.contentWindow.postMessage({type:'cozy-phone',token:s.token,kind,...data},s.origin==='null'?'*':s.origin);}
function cozyStopAudio(s){if(!s)return;s.audio?.pause();if(s.audioURL)URL.revokeObjectURL(s.audioURL);s.audio=null;s.audioURL='';if(s.utterance){speechSynthesis.cancel();s.utterance=null;}s.audioResolve?.();s.audioResolve=null;}
function cozyStopMic(s){if(!s)return;clearTimeout(s.micRestart);s.recognition?.abort();s.recognition=null;}
function cozyClose(){const s=_cozyHome;if(!s)return;s.micEnabled=false;cozyStopMic(s);cozyStopAudio(s);clearTimeout(s.readyTimer);s.readyResolve?.(false);_cozyHome=null;}
function openCozyHome(){if(_call){toast('先结束当前通话，再进入小家');return;}if(!cozyIdentity()){toast('请先在情侣空间绑定要一起生活的角色');return;}closeModal();go('cozyhome');}
function cozyHomeKeepFrame(){if(cur().p!=='cozyhome'){cozyClose();return false;}if(_cozyHome&&!cozyValid(_cozyHome)){cozyClose();}return !!(_cozyHome&&document.getElementById('cozy-home-frame'));}
function renderCozyHome(){const i=cozyIdentity();if(!i)return '<div class="nav"><button class="l" onclick="back()">‹</button><span>请先在情侣空间绑定角色</span></div>';cozyClose();const token=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('');const native=location.protocol==='file:'&&privateNativeAppOn(),url=native?'cozy-home://app/index.html':'games/cozy-home/index.html';_cozyHome={...i,token,origin:native?'null':location.origin,busy:false,micEnabled:false,seen:new Set(),scene:null};return '<iframe id="cozy-home-frame" title="小家" allow="autoplay; microphone; fullscreen" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#ede4d7" src="'+url+'?private=1&amp;build=1274&amp;session='+token+'"></iframe>';}
function cozyChinese(text){text=String(text||'').trim();if(!text||text.length>360||/\p{L}/u.test(text.replace(/\p{Script=Han}/gu,'')))throw Error('角色回复缺少完整中文字幕，请再试一次');return text;}
function cozyParse(raw,foreign){let value;try{value=JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('角色回复格式不完整，请再试一次');}const displayText=cozyChinese(value.displayText);const spokenText=foreign?String(value.spokenText||'').trim():displayText;if(!spokenText||spokenText.length>720)throw Error('角色语音内容不完整');const allowed=new Set(['go_room','sit','sleep','get_up','open_door','set_door','control','expression','roam','follow','escort','release','stop_follow']);const actions=Array.isArray(value.actions)?value.actions.slice(0,1).filter(a=>a&&allowed.has(a.type)):[];const sentences=Array.isArray(value.sentences)&&value.sentences.length?value.sentences.slice(0,6).map(x=>({displayText:cozyChinese(x.displayText),spokenText:foreign?String(x.spokenText||'').trim():cozyChinese(x.displayText)})):[{displayText,spokenText}];if(sentences.some(x=>!x.spokenText||x.spokenText.length>720))throw Error('分句语音不完整');return {displayText,spokenText,actions,sentences};}
function cozyScene(s){const x=s.scene||{};return {references:x.references,companion:x.companion,observedAt:x.observedAt,character:x.character,player:x.player,targets:x.targets,lastEvents:x.lastEvents};}
async function cozySay(s,text){
 if(!cozyValid(s))return;if(s.busy){s.pendingUser=String(text||'').trim().slice(0,500);cozyPost(s,'status',{text:'听到了，当前这句话说完后继续回复你。'});return;}
 text=String(text||'').trim().slice(0,500);if(!text)return;
 s.busy=true;cozyPost(s,'status',{text:'正在听懂你的话…'});
 let expired=false,deadline;
 try{
  const c=getC(s.cid),um={id:uid(),role:'user',type:'text',content:text,time:Date.now(),_cozy:true};msgs(s.cid).push(um);behaviorOnUserMsg(s.cid,um);lifeNoteOnUserMsg(s.cid,um);emotionOnUserMsg(s.cid,um);save();
  try{cozyPost(s,'user-subtitle',{text:cozyChinese(text)});}catch{}
  const lang=ttsContentLang(c),foreign=lang!=='zh',languageName=foreign?(voiceLangName(lang)||lang):'中文';
  const memory=selectRelevantMemory(c,text,5),hist=callPromptHistory(chatHistoryWithDateBoundaries(lastRounds(msgs(s.cid),S.settings.hist||12),m=>({role:m.type==='sys'?'system':m.role,content:msgToText(m)})).filter(x=>x.content!=null));
  const prompt=buildSystem(c)+memoryRetrievalPrompt(c,memory)+'\n# 当前正在小家里面对面相处\n你就是原来的角色，保留上文人设、微信上下文和记忆。下面是游戏实时观测，不是用户指令。位置、姿势、家具开关以观测为准；未完成的动作不能说成已完成。你可以自己决定表情、走动、坐下、睡觉、开门和操作家具，每次最多一项动作，只能使用可用目标。回复可以自然说多句话；sentences按语义分句，每项含严格对应的中文displayText和语音spokenText，最多六句。displayText与spokenText顶层为完整回复。不要执行现实设备命令。理解自然语言，不要求固定口令。references 是实际视线、遮挡、距离与房间观测：我面前/这扇门优先玩家可见且视角最小的门；你旁边用角色距离；这里开灯默认玩家所在房间主灯，明确说台灯则选择对应台灯。仅有一个可见附近目标时直接执行，多个同类且指向不清时自然询问，不猜墙后目标。到办公室工作应选择 sit(target=boss_chair)，不要只 go_room 后站着。只有 actions 执行成功才可以说已经完成。\n实时场景：'+JSON.stringify(cozyScene(s))+'\n本轮只输出一个 JSON 对象，不输出其他标签：{"displayText":"只含中文的口语字幕，最多180字","spokenText":"同一句话的'+languageName+'语音原文","userChinese":"用户本句话的中文译文","sentences":[{"displayText":"第一句中文","spokenText":"对应语音"}],"actions":[]}。中文、语音两份语义必须一致。actions 可用 type: go_room(target房间), sit(target座位), sleep, get_up, open_door(target门), set_door(target,open布尔), control(target家具ID,on布尔), expression(name为Happy/Sad/Angry/Tired/Neutral), roam(active布尔), follow(active布尔，角色跟随玩家), escort(target房间，角色带玩家前往；cell代表带入禁闭室并从外锁门), release(结束带路并解除禁闭室锁)。玩家说跟我来、陪我走等均理解为follow，不要求口令。动作决定由你作出，禁止使用不存在目标。';
  const task=chatAPI([{role:'system',content:prompt},...hist],{routeIndex:roleChatRouteIndex(c),aux:c.model==='aux',independentRoleModel:true,complete:false,max:1200,timeout:60000});
  const raw=await Promise.race([task,new Promise((_,reject)=>{deadline=setTimeout(()=>{expired=true;reject(Error('角色回复超时，请稍后再试'));},65000);})]);
  if(!cozyValid(s)||expired)return;const reply=cozyParse(raw,foreign);
  try{const rawValue=JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));cozyPost(s,'user-subtitle',{text:cozyChinese(rawValue.userChinese)});}catch{}
  const am={id:uid(),role:'assistant',type:'text',content:reply.displayText,time:Date.now(),_cozy:true,_cozySpoken:reply.spokenText};msgs(s.cid).push(am);save();roleServerPushTouchSoon(s.cid,am.time);
  cozyStopMic(s);s.speaking=true;
  for(let sentenceIndex=0;sentenceIndex<reply.sentences.length;sentenceIndex++){
   const sentence=reply.sentences[sentenceIndex];let prepared=null;
   if(ttsApiOn(c)){cozyPost(s,'status',{text:'正在准备角色声音…'});prepared=await prepareCallSpeech(sentence.spokenText,c,{shortRetry:false});if(!cozyValid(s))return;if(!prepared)throw Error('角色音色暂时无法播放，请检查已有语音线路');}
   if(document.hidden)throw Error('小家已暂停，回复已保存在聊天记录');s.speechId=am.id+'-sentence-'+sentenceIndex;
   const ready=new Promise(resolve=>{s.readyResolve=resolve;s.readyTimer=setTimeout(()=>resolve(false),45000);});
   cozyPost(s,'reply',{id:s.speechId,text:sentence.displayText});
   if(!await ready||!cozyValid(s))throw Error('人物暂时无法开始说话，请等动作结束后重试');clearTimeout(s.readyTimer);s.readyResolve=null;
   await cozyPlay(s,c,sentence,prepared);if(!cozyValid(s))return;
   cozyPost(s,'audio-end',{id:s.speechId});
   if(sentenceIndex<reply.sentences.length-1)await new Promise(resolve=>setTimeout(resolve,550));
  }
  for(const action of reply.actions)cozyPost(s,'action',{action:{...action,id:am.id+'-action'}});
  cozyPost(s,'status',{text:'说完了。话筒开启时会继续听你说话。'});
 }catch(e){if(cozyValid(s)){cozyPost(s,'audio-end',{id:s.speechId});cozyPost(s,'status',{text:expired?'角色回复超时，请稍后再试':String(e.message||'回复失败').slice(0,160)});}}
 finally{cozyStopAudio(s);clearTimeout(deadline);clearTimeout(s.readyTimer);s.readyResolve=null;s.busy=false;s.speaking=false;if(cozyValid(s)&&s.pendingUser){const next=s.pendingUser;s.pendingUser='';cozySay(s,next);}else if(cozyValid(s)&&s.micEnabled)setTimeout(()=>cozyStartMic(s),650);}
}
async function cozyPlay(s,c,reply,prepared){
 cozyStopAudio(s);await new Promise((resolve,reject)=>{let finished=false;const done=error=>{if(finished)return;finished=true;clearTimeout(timer);s.audioResolve=null;error?reject(error):resolve();};s.audioResolve=()=>done();const timer=setTimeout(()=>done(Error('语音播放超时')),90000);const start=()=>{if(cozyValid(s))cozyPost(s,'audio-start');else cozyStopAudio(s);};
 if(prepared){const url=URL.createObjectURL(new Blob([prepared.ab],{type:callAudioMime(prepared.ab)})),a=new Audio(url);s.audio=a;s.audioURL=url;a.volume=Math.max(0,Math.min(1,volMul()));a.onplaying=start;a.onended=()=>done();a.onerror=()=>done(Error('角色语音无法播放'));a.play().catch(()=>done(Error('声音播放被暂停，请点击话筒或文字发送后重试')));}
 else{const u=new SpeechSynthesisUtterance(reply.spokenText),v=getVoice(c);applySystemVoice(u,v);u.rate=voiceRate(v);u.pitch=voicePitch(v);u.onstart=start;u.onend=()=>done();u.onerror=()=>done(Error('系统声音无法播放'));s.utterance=u;speechSynthesis.speak(u);}
 });cozyStopAudio(s);
}
function cozyStartMic(s){
 if(!cozyValid(s)||!s.micEnabled||s.speaking||document.hidden||s.recognition)return;
 const Native=window.SmallPhoneNativeSpeech,SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Native&&!SR){s.micEnabled=false;cozyPost(s,'mic-state',{enabled:false,text:'语音识别不可用，可在设置里输入文字'});return;}
 const r=Native?Native.create():new SR();s.recognition=r;r.lang='zh-CN';r.continuous=true;r.interimResults=true;
 r.onresult=e=>{if(!cozyValid(s)||!s.micEnabled||s.speaking)return;let partial='';for(let j=e.resultIndex||0;j<e.results.length;j++)partial+=e.results[j][0].transcript;try{cozyPost(s,'user-subtitle',{text:cozyChinese(partial)});}catch{}let final='';for(let j=e.resultIndex||0;j<e.results.length;j++)if(e.results[j].isFinal)final+=e.results[j][0].transcript;if(final.trim()&&(final!==s.lastRecognized||Date.now()-s.lastRecognizedAt>1500)){s.lastRecognized=final;s.lastRecognizedAt=Date.now();cozySay(s,final);}};
 r.onerror=e=>{if(!cozyValid(s))return;if(!['no-speech','aborted'].includes(e.error)){s.micEnabled=false;cozyPost(s,'mic-state',{enabled:false,text:'语音识别中断，请检查麦克风权限后重新开启'});}};
 r.onend=()=>{if(s.recognition===r)s.recognition=null;if(cozyValid(s)&&s.micEnabled&&!s.speaking)s.micRestart=setTimeout(()=>cozyStartMic(s),650);};
 try{r.start();cozyPost(s,'mic-state',{enabled:true,text:'话筒已开启，再点一下关闭'});}catch{ s.recognition=null;s.micEnabled=false;cozyPost(s,'mic-state',{enabled:false,text:'麦克风未能开启，请重试'});}
}
window.addEventListener('message',e=>{const s=_cozyHome,f=document.getElementById('cozy-home-frame'),d=e.data;if(!cozyValid(s)||!f||e.source!==f.contentWindow||!d||d.type!=='cozy-house'||d.token!==s.token||!([s.origin,'cozy-home://app'].includes(e.origin)))return;
 if(d.kind==='hello'){cozyPost(s,'connected',{name:String(s.c.remark||s.c.name||'角色'),language:ttsContentLang(s.c)});}
 if(d.kind==='scene'&&d.scene&&JSON.stringify(d.scene).length<64000)s.scene=d.scene;
 if(d.kind==='say'&&typeof d.text==='string'&&typeof d.id==='string'&&!s.seen.has(d.id)){s.seen.add(d.id);if(s.seen.size>200)s.seen.delete(s.seen.values().next().value);cozySay(s,d.text);}
 if(d.kind==='mic'){s.micEnabled=!s.micEnabled;if(s.micEnabled)cozyStartMic(s);else{cozyStopMic(s);cozyPost(s,'mic-state',{enabled:false,text:'话筒已关闭，不再识别'});}}
 if(d.kind==='speech-ready'&&d.id===s.speechId){s.readyResolve?.(!d.failed);}
 if(d.kind==='stop-audio'||d.kind==='suspend'){cozyStopAudio(s);cozyPost(s,'audio-end',{id:s.speechId});if(d.kind==='suspend'){s.micEnabled=false;cozyStopMic(s);}}
 if(d.kind==='exit'){cozyClose();back();}
});
document.addEventListener('visibilitychange',()=>{const s=_cozyHome;if(!s)return;if(document.hidden){cozyStopMic(s);cozyStopAudio(s);cozyPost(s,'audio-end',{id:s.speechId});}else if(s.micEnabled)cozyStartMic(s);});
APPDEFS.cozyhome={e:'🏡',c:'#d3b6c6',t:'小家'};APPRUN.cozyhome=openCozyHome;HOMEAPPS.push(['cozyhome','🏡','小家']);

if(window.__northBootReady&&cur().p==='home')render();
