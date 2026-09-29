import * as T from 'three';
import {DEMO_ZH,chineseSubtitle,dialogueText} from './dialogue-text.mjs';

export function createDialogue({camera,chest,onStart,onFinish,notice}){
 const demo=DEMO_ZH;
 const style=document.createElement('style');style.textContent=`
 .floating-words{position:fixed;pointer-events:none;z-index:21;text-align:center;max-width:320px;width:max-content;padding:9px 14px;border-radius:14px;background:transparent;color:#91c9ff;font:600 19px/1.65 sans-serif;text-shadow:0 2px 3px #342738,1px 0 #342738,-1px 0 #342738,0 -1px #342738;transform:translate(-50%,-50%)}
 .floating-words span{display:inline-block;white-space:pre;animation:word-enter .16s ease-out both}@keyframes word-enter{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}.floating-words.falling{background:transparent;transition:background .3s}
 .floating-words.falling span{animation:word-fall .95s ease-in forwards;animation-delay:var(--delay)}
 @keyframes word-fall{to{transform:translate(var(--drift),145px) rotate(var(--tilt));opacity:0}}
 #voice-controls{position:fixed;left:14px;bottom:70px;z-index:31;background:#fff6e9ed;padding:10px;border-radius:14px;max-width:310px;color:#40372f;font:13px/1.5 sans-serif}
 #voice-controls button,#voice-controls input,#voice-controls select{padding:8px;margin:3px;border-radius:8px;border:1px solid #c6b5a2;max-width:270px}#voice-controls small{display:block}#voice-controls .voice-status{max-width:270px}
 `;document.head.append(style);
 const actorText=document.createElement('div'),userText=document.createElement('div');
 for(const [el,label]of [[actorText,'人物字幕'],[userText,'我的字幕']]){el.className='floating-words';el.setAttribute('aria-label',label);el.hidden=true;document.body.append(el);}
 userText.style.left='50%';userText.style.top='64%';userText.style.color='#ffb2d5';
 const box=document.createElement('details');box.id='voice-controls';box.open=true;
 box.innerHTML='<summary>说话与麦克风</summary><select aria-label="系统朗读声音"></select><div><button type="button" data-demo>听他说一句</button><button type="button" data-stop>停止说话</button></div><button type="button" data-mic>开启麦克风说话</button><small>麦克风仅在点击后开启。语音识别可能使用浏览器提供的在线服务。</small><input aria-label="我的文字" maxlength="160" placeholder="也可以输入你想说的话"><button type="button" data-text>显示我的字幕</button><p class="voice-status" role="status" aria-live="polite">麦克风未开启</p>';
 document.body.append(box);
 let externalText=null;
 let utterance=null,active=false,watchdog=0,serial=0,recognition=null,listening=false;
 const timers=new Map();
 function status(message){box.querySelector('.voice-status').textContent=message;}
 function show(el,text){text=chineseSubtitle(text);if(el===actorText){clearTimeout(timers.get(userText));userText.hidden=true;userText.replaceChildren();}clearTimeout(timers.get(el));const chars=[...text];let keep=0;if(!el.classList.contains('falling'))while(keep<chars.length&&el.children[keep]?.textContent===chars[keep])keep++;while(el.children.length>keep)el.lastChild.remove();for(const [i,char]of chars.entries()){if(i<keep)continue;const span=document.createElement('span');span.textContent=char;span.style.setProperty('--delay',`${i*.027}s`);span.style.setProperty('--drift',`${Math.sin(i*2.3)*24}px`);span.style.setProperty('--tilt',`${Math.cos(i*1.7)*24}deg`);el.append(span);}el.classList.remove('falling');el.hidden=false;}
 function fall(el){if(el.hidden)return;el.classList.add('falling');timers.set(el,setTimeout(()=>{el.hidden=true;el.replaceChildren();},1100+el.children.length*27));}
 const mic=box.querySelector('[data-mic]');
 const synth=window.speechSynthesis,select=box.querySelector('select');let voices=[];
 function loadVoices(){const previous=select.value;voices=synth?.getVoices()||[];select.replaceChildren();for(const v of voices){const option=document.createElement('option');option.value=v.voiceURI;option.textContent=v.name+' · '+v.lang;select.append(option);}select.value=voices.some(v=>v.voiceURI===previous)?previous:(voices.find(v=>/^zh/i.test(v.lang)&&/Kangkang|Yunxi|Yunyang|康康/i.test(v.name))||voices.find(v=>/^zh/i.test(v.lang))||voices[0])?.voiceURI||'';if(!voices.length){const o=document.createElement('option');o.textContent='系统默认声音';select.append(o);}}
 loadVoices();synth?.addEventListener('voiceschanged',loadVoices);
 function stop(){serial++;clearTimeout(watchdog);synth?.cancel();if(active){active=false;onFinish();}utterance=null;fall(actorText);if(micWanted&&!document.hidden)micRestart=setTimeout(startMic,650);}
 function say(text=demo){
  stop();const token=serial;let sentence;const voice=voices.find(v=>v.voiceURI===select.value)||null;
  try{sentence=dialogueText(text,voice?.lang||'zh-CN');}catch(e){status(e.message);notice(e.message);onFinish();return;}active=true;pauseMic();
  if(!synth||!window.SpeechSynthesisUtterance){active=false;notice('当前浏览器不支持系统朗读');onFinish();return;}
  const u=new SpeechSynthesisUtterance(sentence.spokenText);utterance=u;u.lang=sentence.language;u.rate=.88;u.pitch=.9;u.voice=voice?.lang.split('-')[0]===sentence.language.split('-')[0]?voice:voices.find(v=>v.lang.split('-')[0]===sentence.language.split('-')[0])||null;
  let started=false;
  u.onstart=()=>{if(token!==serial)return;started=true;show(actorText,sentence.displayText);onStart();status('人物正在说话');};
  const end=error=>{if(token!==serial)return;clearTimeout(watchdog);active=false;utterance=null;onFinish();fall(actorText);status(error?'系统朗读未能播放：'+error:'人物说完了，字幕正在落下');};
  u.onend=()=>{end();if(micWanted)micRestart=setTimeout(startMic,650);};u.onerror=e=>end(e.error);
  watchdog=setTimeout(()=>{if(token!==serial)return;synth.cancel();end(started?'播放超时':'未启动，请重新点击试听或换一个系统声音');},Math.max(20000,sentence.spokenText.length*600));
  synth.speak(u);
 }
 let micWanted=false,micRestart=0,lastFinal='';
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 function micLabel(){const label=mic.querySelector('.mic-label');const text=micWanted?'结束麦克风说话':'开启麦克风说话';if(label)label.textContent=text;else mic.textContent=text;mic.setAttribute('aria-label',text);mic.classList.toggle('listening',micWanted);}
 function pauseMic(){clearTimeout(micRestart);const r=recognition;recognition=null;r?.abort();listening=false;}
 function stopMic(){micWanted=false;pauseMic();micLabel();status('话筒已关闭，不再识别');}
 function startMic(){
  if(!micWanted||recognition||active||document.hidden)return;
  if(!SR){micWanted=false;micLabel();status('这个浏览器不支持语音识别，可以输入文字。');return;}
  const r=new SR();recognition=r;r.lang='zh-CN';r.interimResults=true;r.continuous=true;let finalText='';
  r.onstart=()=>{if(!micWanted){r.abort();return;}listening=true;micLabel();status('正在听你说话，再点一下话筒关闭');};
  r.onresult=e=>{if(!micWanted||active||recognition!==r)return;let text='';for(let i=e.resultIndex||0;i<e.results.length;i++)text+=e.results[i][0].transcript;try{finalText=chineseSubtitle(text);show(userText,finalText);if([...e.results].some(x=>x.isFinal)){lastFinal=finalText;}}catch{finalText='';status('识别结果需要中文译文，暂不显示外语字幕。');}};
  r.onerror=e=>{if(['not-allowed','service-not-allowed','audio-capture','network'].includes(e.error)){micWanted=false;micLabel();}status(({'not-allowed':'麦克风权限未允许，请在浏览器中允许后重试。','audio-capture':'没有找到可用麦克风。','network':'语音识别服务连接失败，可先输入文字。','no-speech':'仍在听，你可以继续说话。'})[e.error]||'语音识别未完成：'+e.error);};
  r.onend=()=>{if(recognition===r)recognition=null;listening=false;if(micWanted&&!active&&!document.hidden)micRestart=setTimeout(startMic,650);};
  try{r.start();}catch(e){recognition=null;micWanted=false;micLabel();status('麦克风启动失败：'+e.message);}
 }
 mic.onclick=()=>{if(micWanted)stopMic();else{micWanted=true;micLabel();startMic();}};
 box.querySelector('[data-text]').onclick=()=>{const input=box.querySelector('input'),text=input.value.trim();if(!text)return;try{chineseSubtitle(text);}catch(e){status(e.message);return;}show(userText,text);status('已显示你的字幕');};
 box.querySelector('[data-stop]').onclick=stop;
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();pauseMic();}else if(micWanted)startMic();});
 const projected=new T.Vector3(),direction=new T.Vector3();
 function update(){if(actorText.hidden)return;const position=chest();direction.copy(position).sub(camera.position);camera.getWorldDirection(projected);if(direction.dot(projected)<=0){actorText.style.visibility='hidden';return;}projected.copy(position).project(camera);actorText.style.visibility=Math.abs(projected.x)>1.2||Math.abs(projected.y)>1.2?'hidden':'visible';actorText.style.left=`${(projected.x*.5+.5)*innerWidth}px`;actorText.style.top=`${(-projected.y*.5+.5)*innerHeight}px`;}
 return {say,stop,update,prepareExternal(text){stop();externalText=chineseSubtitle(text);},startExternal(){if(!externalText)return;active=true;show(actorText,externalText);onStart();},endExternal(){externalText=null;active=false;onFinish();fall(actorText);},userSubtitle(text){show(userText,text);},get active(){return active;},bindDemo(fn){box.querySelector('[data-demo]').onclick=()=>fn(demo);}};
}
