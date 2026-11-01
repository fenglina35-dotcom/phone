function coldLeft(c){return (c&&c.coldUntil&&c.coldUntil>Date.now())?c.coldUntil:0;}
function jailRecent(cid){return msgs(cid).slice(-12).map(m=>{const t=msgToText(m);const c=getC(cid);return t?((m.role==='user'?S.me.name:(c?c.name:'ta'))+'：'+t.replace(/\n/g,' ').slice(0,40)):'';}).filter(Boolean).join('\n');}
/* 恐怖氛围音 */
let _jailGlitchT=null,_jailIdleT=null,_jailLastAct=0;
//@@ web
function jailGlitchTick(){if(!S.jail||!S.jail.active){_jailGlitchT=null;return;}const w=document.getElementById('jailwrap');if(w&&!_jailBusy){w.classList.add('jglitch');jailStab();setTimeout(()=>{try{w.classList.remove('jglitch');}catch(e){}},340);}_jailGlitchT=setTimeout(jailGlitchTick,7000+Math.random()*10000);}
//@@ private
function jailGlitchTick(){if(!S.jail||!S.jail.active){_jailGlitchT=null;return;}const w=document.getElementById('jailwrap');if(w&&!_jailBusy){w.classList.add('jglitch');jailStab();setTimeout(()=>{try{w.classList.remove('jglitch');}catch(e){}},341);}_jailGlitchT=setTimeout(jailGlitchTick,7000+Math.random()*10000);}
//@@ end
function jailCreep(text){try{const el=document.createElement('div');el.className='jcreep';el.innerHTML='<span>'+esc((text||'').slice(0,24))+'</span>';document.body.appendChild(el);jailHeartRush(360);if(navigator&&navigator.vibrate)navigator.vibrate(50);setTimeout(()=>{try{el.remove();}catch(e){}},3400);}catch(e){}}
function jailIntro(){try{const el=document.createElement('div');el.className='jintro';el.innerHTML='<span>门……锁上了</span>';document.body.appendChild(el);setTimeout(()=>{try{el.remove();}catch(e){}},2600);}catch(e){}}
function jailBump(){_jailLastAct=Date.now();}
function jailIdleTick(){if(!S.jail||!S.jail.active){_jailIdleT=null;return;}
  if(!_jailBusy&&!(S.jail&&S.jail.choice)&&cur().p==='jail'&&Date.now()-_jailLastAct>26000){const L=['你在躲我？','看着我。','别想跑。','心跳这么快…','回答我。','乖，别让我等。'];jailCreep(L[Math.floor(Math.random()*L.length)]);_jailLastAct=Date.now()-10000;}
  _jailIdleT=setTimeout(jailIdleTick,4000);}
function jailAmbientStart(){_jailLastAct=_jailLastAct||Date.now();if(!_jailGlitchT)_jailGlitchT=setTimeout(jailGlitchTick,8000+Math.random()*8000);if(!_jailIdleT)_jailIdleT=setTimeout(jailIdleTick,4000);ensureAudio();if(!_audio||_jailOsc||!S.settings.sound)return;try{
  const g=_audio.createGain();g.gain.value=0.05*volMul();g.connect(_audio.destination);
  const o1=_audio.createOscillator();o1.type='sine';o1.frequency.value=54;
  const o2=_audio.createOscillator();o2.type='triangle';o2.frequency.value=57.7;
  const lfo=_audio.createOscillator();lfo.frequency.value=0.14;const lg=_audio.createGain();lg.gain.value=0.03;lfo.connect(lg);lg.connect(g.gain);
  o1.connect(g);o2.connect(g);o1.start();o2.start();lfo.start();_jailOsc={o1,o2,lfo};
}catch(e){}jailHeartStart();}
function jailAmbientStop(){if(_jailOsc){try{_jailOsc.o1.stop();_jailOsc.o2.stop();_jailOsc.lfo.stop();}catch(e){}_jailOsc=null;}jailHeartStop();if(_jailGlitchT){clearTimeout(_jailGlitchT);_jailGlitchT=null;}if(_jailIdleT){clearTimeout(_jailIdleT);_jailIdleT=null;}}
function jailStab(){ensureAudio();if(!_audio||!S.settings.sound)return;try{const o=_audio.createOscillator(),g=_audio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(900,_audio.currentTime);o.frequency.exponentialRampToValueAtTime(110,_audio.currentTime+.18);g.gain.setValueAtTime(Math.min(.5,.16*volMul()),_audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,_audio.currentTime+.22);o.connect(g);g.connect(_audio.destination);o.start();o.stop(_audio.currentTime+.24);}catch(e){}}
function jailScream(){ensureAudio();if(!_audio||!S.settings.sound)return;try{const t=_audio.currentTime;
  const o=_audio.createOscillator(),g=_audio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(1500,t);o.frequency.exponentialRampToValueAtTime(70,t+.5);g.gain.setValueAtTime(Math.min(.95,.55*volMul()),t);g.gain.exponentialRampToValueAtTime(.001,t+.6);o.connect(g);g.connect(_audio.destination);o.start();o.stop(t+.62);
  const o2=_audio.createOscillator(),g2=_audio.createGain();o2.type='sine';o2.frequency.setValueAtTime(130,t);o2.frequency.exponentialRampToValueAtTime(34,t+.5);g2.gain.setValueAtTime(Math.min(.95,.55*volMul()),t);g2.gain.exponentialRampToValueAtTime(.001,t+.55);o2.connect(g2);g2.connect(_audio.destination);o2.start();o2.stop(t+.6);
}catch(e){}}
function jailJumpscare(text){try{const el=document.createElement('div');el.className='jscare';el.innerHTML='<span>'+esc((text||'').slice(0,18))+'</span>';document.body.appendChild(el);jailScream();jailHeartRush(300);if(navigator.vibrate)navigator.vibrate([60,40,120]);setTimeout(()=>{try{el.remove();}catch(e){}},860);}catch(e){}}
let _jailHeart=null,_jailHeartT=null,_jailHeartMs=1050;
function jailThump(){ensureAudio();if(!_audio||!S.settings.sound)return;try{const mk=(at,fr)=>{const o=_audio.createOscillator(),g=_audio.createGain();o.type='sine';o.frequency.setValueAtTime(fr,at);o.frequency.exponentialRampToValueAtTime(fr*0.6,at+.12);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(Math.min(.7,.34*volMul()),at+.02);g.gain.exponentialRampToValueAtTime(.0001,at+.2);o.connect(g);g.connect(_audio.destination);o.start(at);o.stop(at+.22);};const t=_audio.currentTime;mk(t,64);mk(t+.21,50);}catch(e){}}
function jailHeartStart(){if(_jailHeart||!(S.settings&&S.settings.sound))return;_jailHeartMs=1050;const tick=()=>{jailThump();_jailHeart=setTimeout(tick,_jailHeartMs);};_jailHeart=setTimeout(tick,400);}
function jailHeartStop(){if(_jailHeart){clearTimeout(_jailHeart);_jailHeart=null;}if(_jailHeartT){clearTimeout(_jailHeartT);_jailHeartT=null;}}
//@@ web
function jailHeartRush(ms){_jailHeartMs=ms||340;if(_jailHeartT)clearTimeout(_jailHeartT);_jailHeartT=setTimeout(()=>{_jailHeartMs=1050;},4500);}
//@@ private
function jailHeartRush(ms){_jailHeartMs=ms||341;if(_jailHeartT)clearTimeout(_jailHeartT);_jailHeartT=setTimeout(()=>{_jailHeartMs=1050;},4500);}
//@@ end
function enterJail(cid,reason,test){const c=getC(cid);if(!c)return;
  if(S.jail&&S.jail.active)return;/* 已经在小黑屋里了，别重复进（防"结束后重复拉进去"的bug）*/
  if(!test&&S.jail&&S.jail.releasedAt&&Date.now()-S.jail.releasedAt<300000)return;/* 刚放出来不到5分钟，别立刻又被自动拉回去 */
  if(typeof _call!=='undefined'&&_call){
    const ended={ts:Date.now(),kind:_call.kind,dir:_call.dir||(_call.state==='incoming'?'incoming':'outgoing'),byAI:true,dur:_call.start?Math.floor((Date.now()-_call.start)/1000):0,reason:'jail'};
    c._lastCallEnded=ended;
    try{clearInterval(_callTimer);}catch(e){}
    try{ringStop();}catch(e){}
    _call=null;_callBusy=false;_callPend=null;_callVisionPend=[];_callStatePend=null;_callStateEpoch++;callClearPersist();
    try{renderCall();}catch(e){}
  }
  offlineFocusStop();
  const _gd=(!test&&c.grudges)?c.grudges.filter(x=>!x.done):[];
  const _gtxt=_gd.length?('\n你记仇小本本上还没清的旧账（这次正好借机一笔一笔跟对方谈清楚，一条都别漏）：\n'+_gd.map((x,i)=>(i+1)+'. '+x.text+'（'+ymd(x.ts||0)+'记的）').join('\n')):'';
  S.jail={active:true,cid:cid,test:!!test,reason:reason||'',msgs:[],choice:null,optRounds:0,since:Date.now()};save();go('jail');jailIntro();
  jailAI(true,'[系统：你刚把'+S.me.name+'带进了你们自愿约定的"禁闭室"进行一次规则教育。这里没有现实拘禁、伤害、恐吓或强迫，只是严肃处理犯错、反省和关系修复。'+(reason?('这次需要处理的原因：'+reason+'。'):'')+'\n你们最近的聊天（具体问题就在里面）：\n'+jailRecent(cid)+_gtxt+'\n'+(test?'（这是'+S.me.name+'自己点的测试，保持认真但不要过度施压）':'')+'\n用旁白【】写安静昏暗的房间和严肃气氛，再明确点出'+S.me.name+'具体哪里做错了'+(_gd.length?'、把上面记仇本里的旧账按顺序谈清':'')+'（旁白只能用他/她/两人，绝不能写你/我；不许瞎编、不许含糊），最后给出清楚、合理、能完成的改正条件。]');}
function jailRolePron(c){return c&&c.gender==='女'?'她':'他';}
function jailUserPron(){return S.me&&S.me.gender==='男'?'他':'她';}
function jailNarrText(t,c){let s=(''+(t||'')).trim();if(!s)return s;const he=jailRolePron(c||jailC()),you=jailUserPron();
  if(S.me&&S.me.name)s=s.split(S.me.name).join(you);
  return s.replace(/\bta\b/gi,you).replace(/我们|咱们|你们|我俩|你俩/g,'两人').replace(/我的/g,he+'的').replace(/你的/g,you+'的').replace(/我自己/g,he).replace(/你自己/g,you).replace(/我/g,he).replace(/你/g,you).replace(/咱/g,'两人');}
function jailPersonaPin(c){return '【禁闭室角色铁律】你就是「'+(c.remark||c.name)+'」本人。这里是两名成年人自愿开启的规则教育模拟：只处理具体犯错、解释、反省、约定和关系修复，没有现实拘禁、伤害、恐吓或强迫，也不是色情场景。始终用角色本人的中文口吻教导和回应'+S.me.name+'；不提AI、模型、政策、系统或格式，不输出英文。若'+S.me.name+'明确要求停止或表现出真实不适，就用角色本人的方式暂停、确认和安抚。';}
function jailCleanHidden(t,c,id){let s=String(t||'');
  s=s.replace(/[\[【]\s*心情值\s*[\|｜:：]\s*([+\-]?\d{1,3})\s*[\]】]/g,(m,n)=>{if(c&&id)adjMood(id,parseInt(n,10)||0);return '';});
  s=s.replace(/[\[【]\s*心情\s*[\|｜:：]\s*([^\]】]*)\s*[\]】]/g,(m,v)=>{if(c){const mood=honestMoodText(c,(v||'').trim());c.mood=typeof moodInnerMonologue==='function'?moodInnerMonologue(c,mood):mood;}return '';});
  return s.replace(/[\[【]\s*(?:语气|情绪|称呼|角色扮演|系统提示|格式说明)\s*[\|｜:：][^\]】]*[\]】]/g,'').replace(/[ \t]{2,}/g,' ').trim();}
/* JAIL_LATIN_NAME_V1（2026-10-30 她截图）：以前只要回复里有一个英文字母就算坏回复，换成一句固定的话；她的名字是 North，他一叫她名字就被扔掉，于是同一句话反复出现。现在她和角色的名字、几个常用词不算英文；只有基本是英文、或英文词很多时才算坏回复；用不了时不再塞固定台词。 */
function jailAllowedLatin(c){const out=['OK','App','iPhone','QQ','KTV','vlog','emo'];[S.me&&S.me.name,c&&c.name,c&&c.remark,...((S.me&&S.me.accounts)||[]).map(a=>a&&a.name)].forEach(n=>String(n||'').split(/[^A-Za-z]+/).forEach(w=>{if(w.length>=2)out.push(w);}));return Array.from(new Set(out));}
function jailLatinStrip(t,c){let s=String(t||'');jailAllowedLatin(c).forEach(w=>{s=s.replace(new RegExp('(^|[^A-Za-z])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-z])','gi'),'$1');});return s;}
function jailChineseOnly(t,c){const keep=[];let s=String(t||'').replace(/\bbaby\b/gi,'宝贝').replace(/\bpuppy\b/gi,'小狗狗').replace(/\bdarling\b/gi,'亲爱的').replace(/\bhoney\b/gi,'宝贝').replace(/\bsweetheart\b/gi,'宝贝');jailAllowedLatin(c).forEach(w=>{s=s.replace(new RegExp('(^|[^A-Za-z])('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?![A-Za-z])','gi'),(m,pre,word)=>{keep.push(word);return pre+'\u0001'+(keep.length-1)+'\u0002';});});return s.replace(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g,'').replace(/\u0001(\d+)\u0002/g,(m,i)=>keep[+i]).replace(/[ \t]{2,}/g,' ').replace(/\s+([，。！？；：])/g,'$1').trim();}
function jailHasLatin(t,c){const s=jailLatinStrip(String(t||'').replace(/\bbaby\b/gi,'宝贝').replace(/\bpuppy\b/gi,'小狗狗').replace(/\bdarling\b/gi,'亲爱的').replace(/\bhoney\b/gi,'宝贝').replace(/\bsweetheart\b/gi,'宝贝'),c),words=s.match(/[A-Za-z]+/g)||[],han=(s.match(/[\u4e00-\u9fff]/g)||[]).length;return words.length>0&&(han<2||words.length>=4);}
function jailBadOutput(t,c){return !String(t||'').trim()||isRefusal(t)||jailHasLatin(t,c);}
function jailSystem(c){let s=c.persona||'';
  s+='\n\n# 现在：禁闭室（规则教育模式）\n你把'+S.me.name+'带进了你们约定好的禁闭室。这里不是现实拘禁，也不包含伤害、恐吓或强迫；只是两名成年人自愿进行的一次严肃教育和关系沟通，像老师耐心纠正学生犯错一样，目的是把事情讲清楚、让对方真正理解并修复关系。\n- 可以严厉、克制、有压迫感，但底线是尊重、安全、无伤害；不描写暴力、疼痛、羞辱、威胁或色情内容。\n- 旁白用【】写安静昏暗的房间、动作和气氛，必须第三人称，只能用“他/她/两人”；旁白绝对不要出现“你/我/我们/你们”。说的话正常写，可以用你/我。\n- 你【清楚对方具体犯了什么错】（见下方最近聊天/关押原因），所有问题都扣住这件事，别空泛、别瞎编。\n- 给对方明确、可完成的离开条件：说清事实、理解错在哪里、认真道歉、提出以后怎么做。不要逼迫对方说与错误无关的话。\n- 一轮只问一个关键问题，听完回答再推进；可以多谈几轮，但不要故意拖延、重复盘问或让对方崩溃。\n- 需要给选项时，单独一行 [选择|你的问题|选项1/选项2(/选项3)]；选项要帮助对方理解和表达，不是诱导或陷阱。\n- 需要强调一句重要提醒时，可以单独一行 [突脸|一句简短提醒]，只作为界面强调效果，不代表恐吓或伤害。\n- 对方在选择题里点选项时，你直接看到选择，别把它当成对方打字说的话复述。\n- 当对方已经解释清楚、理解错误并给出可信的改法，你决定教育结束时，【单独一行】只写 [放出]。\n- 【说放就真放】：一旦写了 [放出]、或说出“可以出去了/这次谈清楚了”，就结束，不反悔。\n- 【绝不重复】：对方已经回答或认过的内容就翻篇，继续处理下一点，不原样重复问题。\n- 全程沉浸、有分寸，重点是教导、反省和修复关系。'+((S.jail&&S.jail.reason)?'\n这次需要处理的原因：'+S.jail.reason+'。':'');
  const rc=S.jail?jailRecent(S.jail.cid):'';if(rc)s+='\n\n# 你们最近的聊天（具体问题就在里头）\n'+rc;
  const _jg=(S.jail&&!S.jail.test&&c.grudges)?c.grudges.filter(x=>!x.done):[];
  if(_jg.length)s+='\n\n# 你的记仇小本本（这次要把这些旧账一笔一笔谈清）\n'+_jg.map((x,i)=>(i+1)+'. '+x.text).join('\n')+'\n【怎么谈】：按编号一笔一笔顺着往下处理，问清第①笔、确认'+S.me.name+'理解了，再谈第②笔。\n【千万别翻来覆去重复同一笔】——一笔谈清就翻篇、进行到下一笔，别绕回去重复刚问完的内容。\n等这些账都谈过、'+S.me.name+'理解影响并提出可信的改法，你再考虑结束。';
  s+=worldbookPrompt([(c.persona||'')+traitDesc(c),(S.jail&&S.jail.reason)||'',rc,_jg.map(x=>x.text).join('\n')].join('\n'),c.id,'小黑屋/禁闭室','jail');
  s+='\n\n'+jailPersonaPin(c);
  s+='\n\n# 输出铁律\n- 全程只输出中文角色内容，不得出现英文字母、代码、政策说明、系统说明或格式解释。\n- 隐藏标签 [心情|...]、[心情值|...] 只能单独使用，绝不能混进正文；它们不会展示给用户。\n- 每轮简洁自然，几段即可。';
  return s;}
function jailMsgHTML(m,fresh,shake){const cls=(fresh?' jin':'')+(shake?' jshake':'');
  // 长按可删（隐藏式，不显删除标记，避免出戏）；ta的话/旁白/突脸都能删，你自己的不删
  const lp=(m.id&&m.who!=='me')?` onpointerdown="jailPress('${m.id}')" onpointerup="jailPressEnd()" onpointerleave="jailPressEnd()" onpointercancel="jailPressEnd()"`:'';
  if(m.who==='scare')return `<div class="jred q${fresh?' jin':''}" style="text-align:center;font-size:22px;font-weight:800;padding:14px 16px"${lp}>${esc(m.text)}</div>`;
  if(m.who==='旁白')return `<div class="jnar${cls}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}"${lp}>${esc(jailNarrText(m.text))}</div>`;
  if(m.who==='me')return `<div class="jbub me${cls}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}">${esc(m.text)}</div>`;
  return `<div class="jbub${cls}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}"${lp}>${esc(m.text)}</div>`;}
let _jlpT=null,_jlpFired=false;
function jailPress(id){_jlpFired=false;clearTimeout(_jlpT);_jlpT=setTimeout(()=>{_jlpFired=true;jailDelMsg(id);},550);}
function jailPressEnd(){clearTimeout(_jlpT);}
async function jailDelMsg(id){if(!S.jail||!S.jail.msgs)return;const i=S.jail.msgs.findIndex(m=>m.id===id);if(i<0)return;if(!await uiConfirm('删掉这一条？'))return;S.jail.msgs.splice(i,1);if(S.jail.choice){S.jail.choice=null;}save();jailRender();}
async function jailReveal(items){for(let i=0;i<items.length;i++){if(!S.jail||!S.jail.active)return;const it=items[i];
    if(it.scare){const m={id:uid(),who:'scare',text:it.text};S.jail.msgs.push(m);save();const b=$('#jailbox');if(b){const stick=nearBottom(b);b.insertAdjacentHTML('beforeend',jailMsgHTML(m,true,false));if(stick)chatPinBottom(b);}jailJumpscare(it.text);await sleep(1100);continue;}
    const m={id:uid(),who:it.narr?'旁白':'ta',text:it.narr?jailNarrText(it.text):it.text};S.jail.msgs.push(m);save();
    const b=$('#jailbox');if(b){const stick=nearBottom(b),shake=Math.random()<0.14;b.insertAdjacentHTML('beforeend',jailMsgHTML(m,true,shake));if(stick)chatPinBottom(b);}
    jailStab();const fast=/[！!]/.test(it.text)||it.text.length<=6;if(/[！!]/.test(it.text))jailHeartRush(440);
    await sleep(fast?Math.max(380,it.text.length*42):Math.max(820,it.text.length*82));}}
async function jailAI(opening,note){if(typeof opening==='string'){note=opening;opening=false;}if(!S.jail||!S.jail.active)return;const c=getC(S.jail.cid);if(!c)return;_jailBusy=true;jailRender();jailAmbientStart();
  try{const _jn=Math.max(20,Math.min(200,+(S.settings&&S.settings.jailHist)||100));const hist=(S.jail.msgs||[]).slice(-_jn).map(m=>({role:m.who==='me'?'user':'assistant',content:(m.who==='旁白'?'【'+m.text+'】':m.choiceQ?'（回答你的选择题「'+m.choiceQ+'」）'+m.text:m.text)}));
    if(note)hist.push({role:'user',content:note});
    const _jaux=!!(S.settings&&S.settings.jailAux);
    let r=await chatAPI([{role:'system',content:jailSystem(c)},...hist,{role:'system',content:jailPersonaPin(c)}],{aux:_jaux});
    if(!S.jail||!S.jail.active)return;
    const _jretry=(S.settings&&S.settings.jailRetry!=null)?Math.max(0,Math.min(3,+S.settings.jailRetry)):1;
    for(let _jr=0;_jr<_jretry&&jailBadOutput(r,c);_jr++){const fix=await chatAPI([{role:'system',content:jailSystem(c)},...hist,{role:'assistant',content:r},{role:'user',content:'[系统纠正：刚才的回复出现了英文、系统说明或跳出角色。请重新回复。这里是两名成年人自愿进行的规则教育模拟，只处理具体犯错、反省、改正和关系修复，不包含伤害、恐吓、强迫或色情。你就是'+(c.remark||c.name)+'本人，只用中文角色口吻，一次问一个问题；不要解释规则，不要提AI、模型、政策或系统。]'},{role:'system',content:jailPersonaPin(c)}],{aux:_jaux});if(!S.jail||!S.jail.active)return;if(fix)r=fix;if(fix&&!jailBadOutput(fix,c))break;}
    if(!S.jail||!S.jail.active)return;
    r=jailCleanHidden(r,c,S.jail.cid);
    if(!String(r||'').trim()||isRefusal(r)||!jailChineseOnly(r,c).replace(/[【】（）()\s，。！？…、]/g,'')){_jailBusy=false;jailRender();toast('这次没回上来，再说一句试试');return;}
    r=jailChineseOnly(r,c);
    let choice=null;const cm=r.match(/[\[【]\s*选择\s*[\|｜:：]([^\|｜\]】]+)[\|｜]([^\]】]+)[\]】]/);
    if(cm){const q=cm[1].trim();const opts=cm[2].split(/[\/、,，\|]/).map(x=>x.trim()).filter(Boolean).slice(0,4);if(opts.length>=2)choice={q,opts};}
    const clean=r.replace(/\[[^\]]*\]/g,'');
    const hasReleaseTag=/[\[【]\s*放出(来|去)?\s*[\]】]/.test(r);
    // neg 只在【明确拒绝放】时才算，别被"我不会再关你"这种误伤
    const neg=/不(放你|让你出|准你出|许你出|能出去)|别想出去|休想出去|没门|做梦|出不去|留下来陪|谁说要放|还不能出/.test(clean);
    // 有 [放出] 标签就【一定放】(哪怕同一段里还带了选择题也放)；没标签才靠说的话判断
    const free=hasReleaseTag||(!opening&&!choice&&!neg&&/(门开了|放你出去|放你出来|可以出去了|放你走|放过你|饶你这(次|回)|你可以走了|出去吧|放你自由)/.test(clean));
    const items=[];splitBubbles(r).forEach(l=>{l=(l||'').trim();if(!l)return;
      const sm=l.match(/^[\[【]\s*突脸\s*[\|｜:：]\s*([^\]】]+)[\]】]/);if(sm){items.push({scare:true,text:sm[1].trim()});return;}
      if(/^[\[【]\s*选择\s*[\|｜:：]/.test(l))return;
      l=normTag(l);const cc=l.replace(/\[[^\]]*\]/g,'').trim();if(!cc)return;
      splitActions(cc).forEach(p=>{p=(p||'').trim();if(!p)return;const nar=/^[（(【][\s\S]*[）)】]$/.test(p);items.push({narr:nar,text:nar?p.replace(/^[（(【]+|[）)】]+$/g,'').trim():p});});});
    {const _jopt=S.jail._lastOpt;S.jail._lastOpt='';if(_jopt){const k=jailEchoKey(_jopt),keep=items.filter(it=>{const t=jailEchoKey(it.text);return it.scare||it.narr||!t||!(t===k||t.length<=k.length+6&&t.indexOf(k)>=0&&/选/.test(it.text||''));});if(keep.length)items.splice(0,items.length,...keep);}}
    await jailReveal(items);
    if(S.jail&&S.jail.active){
      if(free){S.jail.choice=null;S.jail.optRounds=0;}/* 要放人了，别再挂选择题挡着 */
      else{
        // 选项题最多连出两轮，第三轮强制让她【自己打字】(忽略本轮的选择题)，如此轮流：两次选项→一次打字
        const forceFree=(S.jail.optRounds||0)>=2;
        if(choice&&!forceFree){S.jail.choice=choice;S.jail.optRounds=(S.jail.optRounds||0)+1;}
        else{S.jail.choice=null;S.jail.optRounds=0;}
      }
      save();
    }
    _jailBusy=false;jailBump();jailRender();
    if(free)setTimeout(()=>releaseJail(false),1200);
    return;
  }catch(e){if(S.jail&&S.jail.active){S.jail.msgs.push({id:uid(),who:'旁白',text:'（黑暗里只有他的呼吸……再说点什么吧）'});save();}}
  _jailBusy=false;jailRender();}
function jailRender(){if(cur().p==='jail')render();}
function jailSay(){if(!S.jail||!S.jail.active||_jailBusy||S.jail.choice)return;const ta=$('#jail_in');if(!ta)return;const v=(ta.value||'').trim();if(!v)return;ta.value='';jailBump();S.jail.msgs.push({id:uid(),who:'me',text:v});save();jailRender();jailAI();}
function jailPlea(){if(!S.jail||!S.jail.active||_jailBusy||S.jail.choice)return;jailBump();jailAI('[系统：'+S.me.name+'在请求结束这次禁闭室教育。根据'+S.me.name+'目前有没有说清错误、理解影响并提出可信改法来回应；条件已经做到就 [放出]，还没做到就只指出下一件需要谈清的事。保持严肃但不恐吓、不羞辱、不伤害。]');}
function jailEchoKey(t){return String(t||'').replace(/[\s「」『』“”"'‘’，。！？!?…、：:（）()~～]/g,'');}
function jailChoose(i){if(!S.jail||!S.jail.active||_jailBusy||!S.jail.choice)return;const q=S.jail.choice.q,opt=S.jail.choice.opts[i];if(opt==null)return;jailBump();S.jail.choice=null;/* JAIL_CHOICE_HISTORY_V1（2026-10-30 她说选完选项角色会把选项重复一遍）：以前题目和她点的答案都不进对话记录，角色只看到一句「她点了某某」，就复述出来。现在答案当成她说的话存进记录（带上题目），角色看到的是一问一答。 */S.jail.msgs.push({id:uid(),who:'me',text:opt,choiceQ:q});S.jail._lastOpt=opt;save();jailRender();
  const freeRound=(S.jail.optRounds||0)>=2;/* 已经连出两轮选项了→这一轮让她自己打字 */
  jailAI('[系统：上一条是'+S.me.name+'在你出的选择题里点的答案。直接回应这个答案背后的意思，不要把选项原文再说一遍，也不要说「你选了……」。根据这个答案是否真正理解问题继续教育：'+(freeRound?'这一轮绝对不要再出选择题，改为请'+S.me.name+'用自己的话说明理由和以后怎么做，等回应。':'答案合适就推进下一点；答案不合适就简明指出问题，也可以再用 [选择|新问题|选项1/选项2] 帮助重新理解。需要强调时可用 [突脸|一句重要提醒]，但不能恐吓、羞辱或威胁。')+']');}
function releaseJail(backdoor){if(!S.jail)return;jailAmbientStop();const test=S.jail.test,c=getC(S.jail.cid),reason=S.jail.reason;const _jmsgs=(S.jail.msgs||[]).slice();S.jail.active=false;S.jail.choice=null;S.jail.releasedAt=Date.now();S.jail.endMode=backdoor?'backdoor':(test?'test':'released');offlineFocusStop();save();
  let _cleared=0;
  if(!test&&c){_cleared=(c.grudges||[]).filter(x=>!x.done).length;
    // 关进小黑屋清算完，旧账都算已处理→自动清空省空间，只留这次关押记录
    c.grudges=[{id:uid(),text:'把'+S.me.name+'关进小黑屋、清算了所有旧账'+(reason?('（'+reason+'）'):'')+(backdoor?'，ta最后是灰头土脸钻狗洞逃出去的（被我逮个正着）':''),done:false,ts:Date.now()}];
    c.coldUntil=backdoor?Date.now()+Math.round(COLD_MS*.5):0;
    c._jailHandoff={ts:Date.now(),text:'你刚刚把'+S.me.name+'从小黑屋放出来。你亲自关了ta、审了ta、清算旧账，'+(backdoor?'ta最后从狗洞逃出去又被你逮到，所以你更介意，但仍然很在意ta。':'ta已经认错服软，你才放ta出来，账算完后你心里有余温，也想看ta怎么靠近你。')+(_cleared?'这次积压的 '+_cleared+' 笔旧账已经算过并翻篇，但关系里的余温还在。':'')};
    summarizeJail(c,reason,backdoor,_jmsgs);// 写一条出狱记忆：让微信里的他记得自己关过ta、小黑屋里发生了啥
    save();}
  go('home');toast(test?'🧪 测试结束，没留任何记录':('🚪 门开了…你出来了'+(_cleared?'｜清算并清空了 '+_cleared+' 笔旧账':'')));
  if(!test&&c&&!c.blocked)scheduleReply(c.id,'[系统：你刚把'+S.me.name+'从小黑屋放出来'+(_cleared?'，把积压的 '+_cleared+' 笔旧账都清算翻篇了（你的记仇小本本已清空）':'')+'。现在不是要晾着ta：你记得刚才发生的一切，带着余温、占有欲和一点别扭回微信。不要只丢一句短话敷衍ta，先用你自己的性格说一句有情绪、有在意的话；如果ta服软或情绪不好，要明显软下来。]');}
async function summarizeJail(c,reason,backdoor,jmsgs){if(!c)return;
  const stamp=northLocaleDate(Date.now(),{year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  c.summaries=c.summaries||[];
  const push=t=>{const v=trimSentence(t,320);addSummary(c,v,4,'【小黑屋】');c._jailHandoff={ts:Date.now(),text:'刚才的小黑屋总结：'+v+' 现在你刚回到微信，必须接着这件事后的余温、占有欲和关系承接继续，不要回到旧微信话题；但不要晾着ta或爱答不理。'};save();};
  const fallback='我把'+S.me.name+'关进了禁闭室小黑屋惩罚ta'+(reason?('，因为'+reason):'')+'，'+(backdoor?'ta最后从墙角狗洞里灰头土脸钻出去逃跑、被我逮个正着':'我逼问审够、ta认错服软了才放ta出来')+'，积压的旧账也都清算翻篇了。';
  const text=(jmsgs||[]).map(m=>{const who=(m.who==='me')?S.me.name:(m.who==='旁白'?'（场景）':(c.name||'我'));return who+'：'+(m.text||'');}).filter(x=>x.slice(-1)!=='：'&&x.indexOf('（场景）：')!==0).join('\n');
  if(!text.trim()){push(fallback);return;}
  try{const sum=await chatAPI([{role:'system',content:'你就是「'+c.name+'」本人。下面是【你】刚把'+S.me.name+'关进"小黑屋禁闭室"惩罚ta时发生的事（是你在逼问ta、你在审ta、ta在认错求饶）。请用第一人称把这次小黑屋经历记成一段记忆：为什么关ta、你逼问/算了哪些账、ta认了什么错、求饶/保证了什么、最后怎么放ta出来、你的感受。用"我"指你自己('+c.name+')，用"'+S.me.name+'"称呼对方。3到4句、一两百字、把话说完整，是你的口吻和视角，直接写正文别分点。\n【特别注意·绝不搞反】这次是【你关了ta、你审了ta、你训了ta】，一定要写成"我把ta关进小黑屋、我逼问ta、ta认错求饶"，【绝对不能】写反成"ta把我关起来/ta审我/ta训我"——搞反就全错了。'+perspRule(c)},{role:'user',content:text}],{max:520,temp:.5});
    push((sum?cleanReply(sum):'')||fallback);
  }catch(e){push(fallback);}}
async function jailBackdoor(){if(!await uiConfirm('🕳️ 趴下去钻狗洞逃出去？\n灰头土脸地爬出去，是能出去，但会被他抓包、丢死人——（真实模式下他会更记仇、情绪余温更久）。'))return;releaseJail(true);}
function jailTest(){const c=(S.couple&&getC(S.couple.cid))||S.contacts.find(x=>!x.deleted&&!x.blocked&&isLover(x))||S.contacts.find(x=>!x.deleted&&!x.blocked);if(!c){toast('先有个恋人角色/绑定情侣空间');return;}closeModal();enterJail(c.id,'',true);}
function coupleJailAuth(){if(!S.couple)return;S.couple.jailAuth=!S.couple.jailAuth;save();render();const cid=S.couple.cid,c=cid&&getC(cid);if(c&&!c.blocked)scheduleFeatureReply(cid,featureEventNote('情侣权限变化',S.me.name+(S.couple.jailAuth?'刚允许你使用小黑屋。':'刚悄悄关闭了你的小黑屋权限。你立刻知道了；如果按你的性格不接受，可以发起远程操控申请，等ta本次同意后进入情侣空间向下找到并重新开启。')+'按你的人设自然反应。'),120);}
function outpassRequest(){const cp=S.couple;if(!cp||!cp.cid){toast('先绑定情侣空间');return;}const c=getC(cp.cid);if(!c){toast('恋人角色不在了');return;}if(c.blocked){toast('已拉黑ta了');return;}
  openModal(`<h3>出门报备申请</h3><div class="hint">向 ${esc(c.remark||c.name)} 申请出门，等ta批准。</div>
    <div class="field"><label>去哪</label><input id="op_where" placeholder="比如：和闺蜜去逛街 / 公司团建"></div>
    <div class="field"><label>和谁（可不填）</label><input id="op_who" placeholder="比如：小美、同事"></div>
    <div class="field"><label>大概多久（可不填）</label><input id="op_dur" placeholder="比如：3小时 / 晚饭前回"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="outpassSend()">发申请</button></div>`);}
function outpassSend(){const cp=S.couple;if(!cp||!cp.cid)return;const c=getC(cp.cid);if(!c)return;const where=(($('#op_where')||{}).value||'').trim();if(!where){toast('至少填一下去哪呀');return;}
  const who=(($('#op_who')||{}).value||'').trim(),dur=(($('#op_dur')||{}).value||'').trim();
  pushMsg(cp.cid,{role:'user',type:'outpass',where:where.slice(0,40),who:who.slice(0,30),dur:dur.slice(0,20),status:'pending',reason:'',id:uid()});
  closeModal();toast('已发出申请，等ta批准');scheduleReply(cp.cid);}
function coupleWxLoginAuth(){if(!S.couple)return;S.couple.wxLoginAuth=!S.couple.wxLoginAuth;const cid=S.couple.cid,c=cid&&getC(cid);if(c&&!S.couple.wxLoginAuth)suspicionRaise(c,'permission_closed',8,S.me.name+'收回了微信登录权');save();render();if(c&&!c.blocked)scheduleFeatureReply(cid,featureEventNote('情侣权限变化',S.me.name+(S.couple.wxLoginAuth?'刚把【微信登录权】交给你了——你现在可以随时单独一行 [登录微信] 进入ta的微信。按你人设自然回应。':'刚悄悄收回了微信登录权。你立刻知道了；如果你还想只查微信，可以按人设决定是否发起远程操控申请，得到本次同意后再重新开启并登录。')),120);}
function coupleRemoteControlAuth(){if(!S.couple)return;S.couple.remoteControlAuth=S.couple.remoteControlAuth===false;if(!S.couple.remoteControlAuth)S.couple.remoteControlAutoApprove=false;const cid=S.couple.cid,c=cid&&getC(cid);if(c&&!S.couple.remoteControlAuth)suspicionRaise(c,'permission_closed',8,S.me.name+'关闭了远程操控申请权限');save();render();if(c&&!c.blocked)scheduleFeatureReply(cid,featureEventNote('情侣权限变化',S.me.name+(S.couple.remoteControlAuth?'刚允许你【发起远程操控申请】。你可以按自己性格和真实动机申请，但每次真正开始前仍必须等ta亲手点同意，除非ta另外打开免同意。':'刚悄悄关闭了【远程操控申请】权限，同时免同意远控也失效。你立刻知道了；按你的人设自然反应，但绝不能绕过本次确认或假装已经操控。')),120);}
function jailLockHome(){const c=jailC();setTimeout(jailAmbientStart,60);return `<div class="jail jailbg"><div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px">
  <div class="jred q" style="font-size:46px">🩸</div><div class="jred jtitle" style="font-size:24px;font-weight:700;margin:14px 0">禁 闭 室</div>
  <div class="jnar">门……从外面锁上了。<br>${esc((c&&(c.remark||c.name))||'他')}把ta关了进来。<br>乖乖做到他要的，他才会放ta出去。</div>
  <button class="dybtn" style="background:#8a0018;margin-top:18px" onclick="go('jail')">进去面对他</button></div></div>`;}
function renderJailHistory(){const j=S.jail,c=j&&getC(j.cid);const has=!!(j&&!j.test&&(j.msgs||[]).length);const body=has?(j.msgs||[]).map(m=>jailMsgHTML(Object.assign({},m,{id:''}),false,false)).join(''):'';
  const when=j&&j.since?northLocaleDate(j.since,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'';const ended=j&&j.endMode==='backdoor'?'从狗洞逃出':'已经离开';
  return `<div class="jail jailbg"><div style="position:relative;z-index:482;flex:0 0 auto;padding:12px;border-bottom:1px solid #2a0008;display:flex;align-items:center"><span onclick="home()" style="font-size:28px;color:#aaa;cursor:pointer">‹</span><div style="flex:1;text-align:center"><div class="jred jtitle" style="font-size:18px;font-weight:700">上一次小黑屋记录</div>${has?`<div style="color:#777;font-size:11px">${esc((c&&(c.remark||c.name))||'角色')} · ${esc(when)} · ${ended}</div>`:''}</div><span style="width:20px"></span></div>
    <div class="xscroll" style="flex:1;position:relative;z-index:482">${has?`${j.reason?`<div class="jnar">关押原因：${esc(j.reason)}</div>`:''}${body}<div class="jnar">—— 本场记录会保留到下一场小黑屋开始 ——</div>`:'<div class="empty" style="padding:80px 24px;color:#777">还没有可查看的上一场记录</div>'}</div></div>`;}
function renderJail(){if(!S.jail||!S.jail.active)return renderJailHistory();const c=getC(S.jail.cid);if(!c)return '';setTimeout(jailAmbientStart,60);
  const body=(S.jail.msgs||[]).map(m=>jailMsgHTML(m,false,false)).join('')+(_jailBusy?`<div class="jnar" style="opacity:.5">…他正盯着ta…</div>`:'');
  const pending=(!_jailBusy&&S.jail.choice);
  const foot=pending?`<div style="padding:8px 14px"><div class="jred" style="font-size:15px;text-align:center;margin-bottom:10px">${esc(S.jail.choice.q)}</div><div style="display:flex;flex-direction:column;gap:9px">${S.jail.choice.opts.map((o,i)=>`<button class="jopt" onclick="jailChoose(${i})">${esc(o)}</button>`).join('')}</div></div>`
    :`<div style="padding:6px 10px 0"><button class="dybtn" style="width:100%;background:#8a0018" ${_jailBusy?'disabled':''} onclick="jailPlea()">${_jailBusy?'……':'🙏 求他放我出去'}</button></div>
    <div class="inputbar" style="background:#120006"><textarea id="jail_in" rows="1" placeholder="对他说…（认错 / 求饶 / 回答他）" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();jailSay();}"></textarea><button class="send" style="background:#8a0018" onclick="jailSay()">说</button></div>`;
  return `<div class="jail jailbg" id="jailwrap">
    <div class="jvig"></div><div class="jscan"></div>
    <div style="position:relative;z-index:482;flex:0 0 auto;padding:12px;text-align:center;border-bottom:1px solid #2a0008"><div class="jred jtitle" style="font-size:18px;font-weight:700">🩸 禁闭室 · ${esc(c.remark||c.name)}</div>${S.jail.test?'<div style="color:#888;font-size:11px">🧪 测试中 · 不留记录，随时可出</div>':'<div style="color:#6a0014;font-size:11px">做到他要的，才放ta出去</div>'}</div>
    <div class="xscroll" id="jailbox" style="flex:1;position:relative;z-index:482">${body||'<div class="jnar">黑暗里，他正盯着ta……</div>'}</div>
    <div style="position:relative;z-index:482">${foot}
    <div style="text-align:center;padding:8px"><span onclick="jailBackdoor()" style="color:#3a3a3a;font-size:11px;cursor:pointer">······墙角好像有个狗洞🕳️，钻出去</span></div></div></div>`;}

function offEnterScene(id){const o=offData(id);o.introSeen=true;offlineFocusStart(id,o);save();render();}
function renderOffIntro(c,o){const prev=o.previousEndedAt?`上一场结束于 ${offDateTime(o.previousEndedAt)}<br>已经过去 ${offElapsed(o.previousEndedAt,o.startedAt||Date.now())}`:'这是你们的第一场线下约会';return `<div class="offstage offintro">
  <div class="offintro-top"><span onclick="offQuit()">退出</span><span>RENDEZVOUS</span></div>
  <div class="offintro-main">
    <div class="offintro-rule"></div>
    <div class="offintro-kicker">${esc(o.daypart||dayPartNow())} · ${esc(o.when||offDateTime(o.startedAt||Date.now()))}</div>
    <div class="offintro-avatar">${av(c.avatar,'lg')}</div>
    <div class="offintro-name">${esc(c.remark||c.name)}</div>
    <div class="offintro-place">${esc(o.loc||'未定')}</div>
    <div class="offintro-gap">${prev}</div>
    <button class="off-enter" onclick="offEnterScene('${c.id}')">进入这场约会</button>
    <div class="offintro-note">从这一刻起，只属于本场见面</div>
  </div>
  </div>`;}
const cohabSettingsPanelBase=cohabSettingsPanel;
cohabSettingsPanel=function(id,o){const panel=cohabSettingsPanelBase(id,o).replace(/<div class="cohab-debug-actions">.*?<\/div>/,'');const manualReply=cohabTogetherScene(o)&&!_offSel&&manualReplySceneOn('offline');const reply=manualReply?`<button type="button" class="cohab-debug-reply" ${_off&&_off.busy?'disabled':''} onclick="offReply()">${_off&&_off.busy?'回应中…':'让TA回'}</button>`:'';return `<div class="cohab-settings-wrap">${panel}${reply}</div>`;};
//@@ web
function cohabSettingsPanel(id,o){const x=cohabSettings(o),c=getC(id),sc=c&&c.sched,manualReply=cohabTogetherScene(o)&&!_offSel&&manualReplySceneOn('offline'),opt=(value,current,label)=>`<option value="${value}" ${current===value?'selected':''}>${label}</option>`,apiOpts=(current,reply)=>`${reply?opt('reply',current,'跟随对话路线'):''}${opt('follow',current,'跟随微信当前路线')}${CHAT_ROUTE_NAMES.map((name,i)=>opt(String(i),current,name)).join('')}`;return `<details class="cohab-settings"><summary><span><b>共同生活设置</b><small id="cohab-settings-brief">${esc(cohabSettingsBrief(o))}</small></span><i>⌄</i></summary>${manualReply?`<div class="cohab-debug-actions"><button type="button" class="cohab-debug-reply" ${_off&&_off.busy?'disabled':''} onclick="offReply()">${_off&&_off.busy?'回应中…':'让TA回'}</button></div>`:''}<div class="cohab-settings-grid"><label><span>最近上下文<small>共同生活与线上隐藏背景</small></span><input type="number" min="10" max="80" step="1" value="${x.contextLimit}" onchange="cohabSettingSet('${id}','contextLimit',this.value,this)"></label><label><span>自动总结<small>0 代表关闭</small></span><input type="number" min="0" max="40" step="1" value="${x.summaryRounds}" onchange="cohabSettingSet('${id}','summaryRounds',this.value,this)"><em>轮</em></label><label><span>记忆上限<small>共存多少条，0 表示不限</small></span><input type="number" min="0" max="2000" step="10" value="${x.memoryCap}" onchange="cohabSettingSet('${id}','memoryCap',this.value,this)"></label><label><span>旧总结引用<small>按话题读取这里的记忆</small></span><input type="number" min="1" max="20" step="1" value="${x.summaryMemoryLimit}" onchange="cohabSettingSet('${id}','summaryMemoryLimit',this.value,this)"><em>条</em></label><label><span>总结方式<small>自动与立即总结共用</small></span><select onchange="cohabSettingSet('${id}','summaryMode',this.value,this)">${opt('split',x.summaryMode,'分段重点')}${opt('single',x.summaryMode,'一整段')}</select></label><label><span>对话模型<small>主模型或副模型</small></span><select onchange="cohabSettingSet('${id}','replyModel',this.value,this)">${opt('role',x.replyModel,'跟随微信角色')}${opt('main',x.replyModel,'主模型')}${opt('aux',x.replyModel,'副模型')}</select></label><label><span>对话 API 路线<small>接口地址、Key 与模型组</small></span><select onchange="cohabSettingSet('${id}','replyApiRoute',this.value,this)">${apiOpts(x.replyApiRoute,false)}</select></label><label><span>总结模型<small>只影响共同生活总结</small></span><select onchange="cohabSettingSet('${id}','summaryModel',this.value,this)">${opt('reply',x.summaryModel,'跟随对话模型')}${opt('main',x.summaryModel,'主模型')}${opt('aux',x.summaryModel,'副模型')}</select></label><label><span>总结 API 路线<small>只影响共同生活总结</small></span><select onchange="cohabSettingSet('${id}','summaryApiRoute',this.value,this)">${apiOpts(x.summaryApiRoute,true)}</select></label><label><span>台词播放<small>点一下屏幕出下一句</small></span><select onchange="cohabSettingSet('${id}','tapAdvance',this.value,this)">${opt('0',x.tapAdvance?'1':'0','自动一句句出')}${opt('1',x.tapAdvance?'1':'0','点一下出一句')}</select></label><div class="hint" style="grid-column:1/-1;padding:0 2px;line-height:1.65">“对话模型”与“对话 API 路线”都选择跟随时，会完整继承微信里该角色的主/副模型选择和微信当前路线；固定路线只影响共同生活，不会切换微信。</div><button type="button" class="cohab-memory-open cohab-schedule-open" onclick="schedSet('${id}')"><span>作息时间表</span><small>${esc(roleScheduleBrief(c))} ›</small></button><button type="button" class="cohab-memory-open cohab-history-delete" onclick="offDelHistory('${id}')"><span>删除聊天记录</span><small>按日期 / 一天前 / 三天前 / 全部清空 ›</small></button><button type="button" class="cohab-memory-open" onclick="cohabMemoryOpen('${id}')"><span>查看共同生活记忆</span><small>${(o.summaries||[]).length} 条 ›</small></button><button type="button" class="cohab-memory-open" onclick="roleInterceptDiagnosticOpen('${id}','cohab')"><span>查看上一轮拦截内容</span><small>仅本机诊断 ›</small></button><button type="button" class="cohab-memory-open cohab-summary-now" onclick="cohabSummarizeNow('${id}')"><span>立即总结</span><small>${x.summaryMode==='split'?'分段':'整段'} ›</small></button></div></details>`;}
//@@ private
function cohabSettingsPanel(id,o){const x=cohabSettings(o),c=getC(id),sc=c&&c.sched,manualReply=cohabTogetherScene(o)&&!_offSel&&manualReplySceneOn('offline'),opt=(value,current,label)=>`<option value="${value}" ${current===value?'selected':''}>${label}</option>`,apiOpts=(current,reply)=>`${reply?opt('reply',current,'跟随对话路线'):''}${opt('follow',current,'跟随微信当前路线')}${CHAT_ROUTE_NAMES.map((name,i)=>opt(String(i),current,name)).join('')}`;return `<details class="cohab-settings"><summary><span><b>共同生活设置</b><small id="cohab-settings-brief">${esc(cohabSettingsBrief(o))}</small></span><i>⌄</i></summary>${manualReply?`<div class="cohab-debug-actions"><button type="button" class="cohab-debug-reply" ${_off&&_off.busy?'disabled':''} onclick="offReply()">${_off&&_off.busy?'回应中…':'让TA回'}</button></div>`:''}<div class="cohab-settings-grid"><label><span>最近上下文<small>共同生活与线上隐藏背景</small></span><input type="number" min="10" max="80" step="1" value="${x.contextLimit}" onchange="cohabSettingSet('${id}','contextLimit',this.value,this)"></label><label><span>自动总结<small>0 代表关闭</small></span><input type="number" min="0" max="40" step="1" value="${x.summaryRounds}" onchange="cohabSettingSet('${id}','summaryRounds',this.value,this)"><em>轮</em></label><label><span>记忆上限<small>共存多少条，0 表示不限</small></span><input type="number" min="0" max="2000" step="10" value="${x.memoryCap}" onchange="cohabSettingSet('${id}','memoryCap',this.value,this)"></label><label><span>旧总结引用<small>按话题读取这里的记忆</small></span><input type="number" min="1" max="20" step="1" value="${x.summaryMemoryLimit}" onchange="cohabSettingSet('${id}','summaryMemoryLimit',this.value,this)"><em>条</em></label><label><span>总结方式<small>自动与立即总结共用</small></span><select onchange="cohabSettingSet('${id}','summaryMode',this.value,this)">${opt('split',x.summaryMode,'分段重点')}${opt('single',x.summaryMode,'一整段')}</select></label><label><span>对话模型<small>主模型或副模型</small></span><select onchange="cohabSettingSet('${id}','replyModel',this.value,this)">${opt('role',x.replyModel,'跟随微信角色')}${opt('main',x.replyModel,'主模型')}${opt('aux',x.replyModel,'副模型')}</select></label><label><span>对话 API 路线<small>接口地址、Key 与模型组</small></span><select onchange="cohabSettingSet('${id}','replyApiRoute',this.value,this)">${apiOpts(x.replyApiRoute,false)}</select></label><label><span>总结模型<small>只影响共同生活总结</small></span><select onchange="cohabSettingSet('${id}','summaryModel',this.value,this)">${opt('reply',x.summaryModel,'跟随对话模型')}${opt('main',x.summaryModel,'主模型')}${opt('aux',x.summaryModel,'副模型')}</select></label><label><span>总结 API 路线<small>只影响共同生活总结</small></span><select onchange="cohabSettingSet('${id}','summaryApiRoute',this.value,this)">${apiOpts(x.summaryApiRoute,true)}</select></label><label><span>台词播放<small>点一下屏幕出下一句</small></span><select onchange="cohabSettingSet('${id}','tapAdvance',this.value,this)">${opt('0',x.tapAdvance?'1':'0','自动一句句出')}${opt('1',x.tapAdvance?'1':'0','点一下出一句')}</select></label><div class="hint" style="grid-column:1/-1;padding:0 2px;line-height:1.65">“对话模型”与“对话 API 路线”都选择跟随时，会完整继承微信里该角色的主/副模型选择和微信当前路线；固定路线只影响共同生活，不会切换微信。</div><button type="button" class="cohab-memory-open cohab-schedule-open" onclick="schedSet('${id}')"><span>作息时间表</span><small>${esc(roleScheduleBrief(c))} ›</small></button><button type="button" class="cohab-memory-open cohab-history-delete" onclick="offDelHistory('${id}')"><span>删除聊天记录</span><small>按日期 / 一天前 / 三天前 / 全部清空 ›</small></button><button type="button" class="cohab-memory-open" onclick="cohabMemoryOpen('${id}')"><span>查看共同生活记忆</span><small>${(o.summaries||[]).length} 条 ›</small></button><button type="button" class="cohab-memory-open cohab-summary-now" onclick="cohabSummarizeNow('${id}')"><span>立即总结</span><small>${x.summaryMode==='split'?'分段':'整段'} ›</small></button></div></details>`;}
//@@ end
function renderCohab(id){const c=getC(id),o=cohabAdvance(id);if(!c||!o)return'';const sel=_offSel,away=!cohabTogetherScene(o),name=esc(c.remark||c.name),messages=(o.msgs||[]).filter(m=>m&&typeof m==='object'),notices=(o.notices||[]).filter(n=>n&&typeof n==='object'),rows=[...messages,...notices.map(n=>Object.assign({_notice:true},n))].sort((a,b)=>(+a.time||0)-(+b.time||0)),_win=offWindowRows(id,rows),body=_win.more+_win.rows.map(m=>{if(!m._notice&&m.who!=='me'&&m.source!=='me'&&!offlineStripMoodTags(m.text).trim())return'';if(m._notice)return `<div style="margin:12px auto;max-width:82%;padding:8px 12px;border-radius:12px;background:rgba(123,132,151,.12);border:1px solid rgba(123,132,151,.18);color:#8d96a8;text-align:center;font-size:11px;line-height:1.55;letter-spacing:.2px">${esc(m.text)}</div>`;const on=sel&&sel.indexOf(m.id)>=0,cb=sel?`<span style="margin-right:6px;color:${on?'#19a463':'#888'}">${on?'☑':'⚪'}</span>`:'',oc=sel?`offSelTog('${m.id}')`:`offMsgMenu('${id}','${m.id}')`;if(m.who==='日期')return `<div class="offdate cohab-date" data-chat-motion-row="${esc(naturalMotionRowKey(m))}">${esc(m.text).replace(/\n/g,'<br>')}</div>`;if(m.who==='旁白'||m.who==='ta'&&offResponsePart(m.text).kind==='nar')return `<div class="offnar ${m.source==='me'?'mine':''} ${m._reveal?'offreveal':''}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}" onclick="${oc}">${cb}${offRevealText(m)}</div>`;if(m.who==='me')return `<div class="msg me offmsg" data-chat-motion-row="${esc(naturalMotionRowKey(m))}" onclick="${oc}"><div class="col"><div class="bubble offbubble">${cb}${esc(m.text)}</div>${typeof messageBeijingTimeHTML==='function'?messageBeijingTimeHTML(m):''}</div></div>`;return `<div class="msg them offmsg ${m._reveal?'offreveal':''}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}" onclick="${oc}"><div class="col"><div class="bubble offbubble">${cb}${offRevealText(m)}</div>${typeof messageBeijingTimeHTML==='function'?messageBeijingTimeHTML(m):''}</div></div>`;}).join('')+(_off&&_off.busy&&!messages.some(m=>m._reveal)?`<div class="msg them offmsg"><div class="col"><div class="bubble offbubble typing"><span></span><span></span><span></span></div></div></div>`:'');const _st=offStageAttrs(c),_manualReply=cohabTogetherScene(o)&&!sel&&manualReplySceneOn('offline');return `<div class="offstage cohab-stage${_st.cls}${_manualReply?' cohab-has-reply':''}" style="${_st.style}"><div class="nav offnav cohab-nav"><button type="button" class="l" style="border:0;padding:0;background:transparent;color:inherit;font:inherit;touch-action:manipulation" aria-label="返回桌面" onclick="return cohabActionTap(null,'quit','${id}')">‹</button><span class="t"><small>共同生活</small>${name}</span><span class="off-nav-actions"><button type="button" class="cohab-status-chip phase-${o.phase}" onclick="return cohabActionTap(null,'controls','${id}')"><i></i><b>${esc(cohabStatusLabel(o))}</b></button></span></div><div class="cohab-meta"><span>一起生活了 ${offElapsed(o.startedAt,Date.now())}</span><time id="cohabLiveTime">${esc(cohabClockText())}</time><span class="cohab-meta-acts"><button type="button" onclick="offSelToggle()">${sel?'取消':'多选'}</button><button type="button" onclick="offAppearance('${id}')">外观</button><button type="button" onclick="return cohabActionTap(null,'controls','${id}')">测试控制</button></span></div>${cohabSettingsPanel(id,o)}${o.unreadReturn&&o.phase==='home'?`<div class="cohab-return-banner"><span><b>${name}回来了</b><small>这段共同生活还在继续</small></span><button onclick="cohabSeen('${id}')">知道了</button></div>`:''}<div class="scroll offscroll cohab-scroll" id="offbg">${body||`<div class="cohab-empty"><span>OUR EVERYDAY</span><b>从今天起，是一起生活的日常</b><small>可以当面对TA说话，也可以加入你的动作旁白</small></div>`}${!sel&&!away?cohabTapNextHTML(id):''}</div>${away?`<div class="cohab-away-panel"><span><b>${name}${o.phase==='returning'?'正在回家路上':o.phase==='work'?'正在上班':'暂时外出'}</b><small>${esc(cohabStatusLabel(o))} · 现在不在同一空间，共同生活记录会保留</small></span><button onclick="cohabGoWechat('${id}')">去微信找TA</button></div>`:sel?`<div class="offselect"><button onclick="offSelToggle()">取消</button><button class="danger" onclick="offDelSel('${id}')">删除选中 (${sel.length})</button><button class="danger" onclick="offDelHistory('${id}')">删除聊天记录</button></div>`:`<div class="inputbar offinput${offNarrationMode()?' narration-mode':''}">${offNarrateBtnHTML()}${offFieldHTML('当面对TA说…')}<button class="send off-note" onclick="offSay()">记下</button></div>`}</div>`;}
function renderOff(id,mode){const c=getC(id);if(!c)return '';if(mode==='cohab'||_off&&_off.mode==='cohab'&&_off.id===id){if(!_off||_off.id!==id||_off.mode!=='cohab')_off={id,busy:false,mode:'cohab'};return renderCohab(id);}const o=offData(id);if(o.introSeen===false)return renderOffIntro(c,o);const sel=_offSel,replyTop=!sel&&manualReplySceneOn('offline')?`<button type="button" class="off-reply-top" ${_off&&_off.busy?'disabled':''} onclick="offReply()">${_off&&_off.busy?'回应中':'让TA回'}</button>`:'';
  const _win=offWindowRows(id,o.msgs);
  const body=_win.more+_win.rows.map(m=>{if(m.who!=='me'&&m.source!=='me'&&!offlineStripMoodTags(m.text).trim())return'';const on=sel&&sel.indexOf(m.id)>=0;const cb=sel?`<span style="margin-right:6px;color:${on?'#19a463':'#888'}">${on?'☑':'⚪'}</span>`:'';const oc=sel?`offSelTog('${m.id}')`:`offMsgMenu('${id}','${m.id}')`;
    if(m.who==='日期')return `<div class="offdate" data-chat-motion-row="${esc(naturalMotionRowKey(m))}">${esc(m.text).replace(/\n/g,'<br>')}</div>`;
    if(m.who==='旁白'||m.who==='ta'&&offResponsePart(m.text).kind==='nar')return `<div class="offnar ${m.source==='me'?'mine':''} ${m._reveal?'offreveal':''}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}" onclick="${oc}">${cb}${offRevealText(m)}</div>`;
    if(m.who==='me')return `<div class="msg me offmsg" data-chat-motion-row="${esc(naturalMotionRowKey(m))}" onclick="${oc}"><div class="col"><div class="bubble offbubble">${cb}${esc(m.text)}</div>${typeof messageBeijingTimeHTML==='function'?messageBeijingTimeHTML(m):''}</div></div>`;
    return `<div class="msg them offmsg ${m._reveal?'offreveal':''}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}" onclick="${oc}"><div class="col"><div class="bubble offbubble">${cb}${offRevealText(m)}</div>${typeof messageBeijingTimeHTML==='function'?messageBeijingTimeHTML(m):''}</div></div>`;}).join('')
    +(_off&&_off.busy&&!o.msgs.some(m=>m._reveal)?`<div class="msg them offmsg"><div class="col"><div class="bubble offbubble typing"><span></span><span></span><span></span></div></div></div>`:'');
  const _st=offStageAttrs(c);
  return `<div class="offstage${_st.cls}" style="${_st.style}">
   <div class="nav offnav off-date-nav"><span class="l" onclick="offQuit()">‹</span><span class="t">${esc(c.remark||c.name)}</span><span class="off-nav-actions">${replyTop}<button type="button" class="off-end" onclick="offEnd('${id}')">结束</button></span></div>
   <div class="offmeta"><span><b>${esc(o.loc||'未定')}</b> · ${esc(o.daypart||o.when||'现在')}</span><span><button onclick="offSelToggle()">${sel?'取消':'多选'}</button><button onclick="offAppearance('${id}')">外观</button><button onclick="offManualSummary('${id}')">总结</button><button onclick="offSetting('${id}')">设定</button><button onclick="offMemory('${id}')">记忆</button></span></div>
   <div class="scroll offscroll" id="offbg">${body||'<div class="empty" style="padding:30px;color:#5f5b55">等待这场见面的第一句话</div>'}</div>
   ${sel?`<div class="offselect"><button onclick="offSelToggle()">取消</button><button class="danger" onclick="offDelSel('${id}')">删除选中 (${sel.length})</button><button class="danger" onclick="offDelHistory('${id}')">删除聊天记录</button></div>`:''}
   <div class="inputbar offinput${offNarrationMode()?' narration-mode':''}">${offNarrateBtnHTML()}${offFieldHTML('当面对他说…')}<button class="send off-note" onclick="offSay()">记下</button></div>
   </div>`;}
/* ===== 信箱 ===== */
function fmtDate(t){const d=new Date(t||Date.now());return (d.getMonth()+1)+'月'+d.getDate()+'日 '+hm(t);}
function mailCleanText(t){return (''+(t||'')).replace(/[💌📮📦🎁💗✅🚚]/gu,'').replace(/[ \t]{2,}/g,' ').trim();}
function renderMail(){const list=typeof mailVisibleInbox==='function'?mailVisibleInbox():S.mail||[];
  return `<div class="nav"><span class="l" onclick="home()">‹</span><span class="t">信箱</span><span class="r" onclick="mailSettings()">${svgIc('gear',19,'#ccc')}</span></div>
   <div class="scroll mail-scroll" data-render-scroll-key="mail:${esc(String(actId()))}" style="background:#000;padding:10px">
   <div class="hint">他趁你不在时写给你的信。点右上角设置可以让角色每天主动写几封。</div>
   <div onclick="mailMoodModal()" style="margin:10px 0 12px;border:1px solid #303036;background:linear-gradient(145deg,#111113,#1d1d21);border-radius:12px;padding:13px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;box-shadow:0 8px 20px rgba(0,0,0,.22)">
     <div style="width:38px;height:38px;border-radius:10px;background:#080809;border:1px solid #38383d;display:flex;align-items:center;justify-content:center">${svgIc('envelope',22,'#d7d7dc',1.35)}</div>
     <div style="flex:1;min-width:0"><div style="font-size:15px;color:#eee;font-weight:700;letter-spacing:.5px">按心情拆一封信</div><div style="font-size:12px;color:#8f8f98;margin-top:3px">选一个当下心情，让角色临时写给你</div></div>
     <span style="color:#777;font-size:22px">›</span>
   </div>
   ${list.length?list.map(L=>{const c=getC(L.cid);return `<div class="section"><div class="it" onclick="openLetter('${L.id}')" style="align-items:flex-start">
//@@ web
     <div style="width:34px;height:34px;border-radius:9px;background:#151520;border:1px solid #34343a;margin-right:8px;display:flex;align-items:center;justify-content:center">${svgIc(L.type==='gift'?'gift':'envelope',19,L.read?'#8f8f98':'#d7d7dc',1.35)}</div>
//@@ private
     <div style="width:34px;height:34px;border-radius:9px;background:#151518;border:1px solid #34343a;margin-right:8px;display:flex;align-items:center;justify-content:center">${svgIc(L.type==='gift'?'gift':'envelope',19,L.read?'#8f8f98':'#d7d7dc',1.35)}</div>
//@@ end
     <div style="flex:1;min-width:0"><div style="font-weight:600;${L.read?'color:#999':''}">${esc(mailCleanText(L.subject))} ${L.read?'':'<span class="badge" style="display:inline-flex">新</span>'}</div>
     <div style="font-size:12px;color:#888;margin-top:3px">${esc(c?(c.remark||c.name):'TA')} · ${fmtDate(L.time)}</div></div>
     ${(L.type==='gift'&&!L.signed)?`<button class="minibtn" onclick="event.stopPropagation();signGift('${L.id}')" style="background:#ee5a6f;color:#fff;margin-right:4px">签收</button>`:''}<span onclick="event.stopPropagation();delLetter('${L.id}')" style="color:#fa5151;cursor:pointer;padding:0 4px">×</span></div></div>`;}).join(''):'<div class="empty" style="padding:50px;line-height:2">还没有信<br>点右上角设置，让角色每天主动写信</div>'}
   <div style="height:20px"></div></div>`;}
function openLetter(lid){const L=(typeof mailVisibleInbox==='function'?mailVisibleInbox():S.mail||[]).find(x=>x.id===lid);if(!L)return;L.read=true;lockClearTarget({type:'mail'},true);save();const c=getC(L.cid);
//@@ web
  openModal(`<div style="text-align:center"><div style="width:48px;height:48px;border-radius:14px;background:#151520;border:1px solid #34343a;margin:0 auto 8px;display:flex;align-items:center;justify-content:center">${svgIc(L.type==='gift'?'gift':'envelope',27,'#d7d7dc',1.35)}</div><h3 style="margin:6px 0 2px">${esc(mailCleanText(L.subject))}</h3>
//@@ private
  openModal(`<div style="text-align:center"><div style="width:48px;height:48px;border-radius:14px;background:#151518;border:1px solid #34343a;margin:0 auto 8px;display:flex;align-items:center;justify-content:center">${svgIc(L.type==='gift'?'gift':'envelope',27,'#d7d7dc',1.35)}</div><h3 style="margin:6px 0 2px">${esc(mailCleanText(L.subject))}</h3>
//@@ end
   <div style="font-size:12px;color:#888;margin-bottom:12px">${esc(c?(c.remark||c.name):'TA')} 写于 ${fmtDate(L.time)}</div></div>
   <div style="background:#fffdf3;color:#3a3a3a;border-radius:14px;padding:18px;line-height:2;white-space:pre-wrap;font-size:15px;max-height:52vh;overflow:auto;box-shadow:inset 0 0 0 1px #f0e6c8">${esc(mailCleanText(L.body))}</div>
   <div class="btns" style="margin-top:14px"><button class="btn d" onclick="delLetter('${lid}')">删除</button>${(L.type==='gift'&&!L.signed)?`<button class="btn p" style="background:#ee5a6f" onclick="signGift('${lid}')">签收</button>`:`<button class="btn p" onclick="closeModal();render()">${L.type==='gift'?'已签收':'收好'}</button>`}</div>`);
  if(cur().p==='mail')render();}
function delLetter(lid){S.mail=(S.mail||[]).filter(x=>x.id!==lid);save();closeModal();render();}
const MAIL_MOODS=[
  ['sad','不开心','(｡•́︿•̀｡)','安慰我、抱住我，不要讲大道理'],
  ['tired','好累','(つ﹏⊂)','让我慢下来，被认真心疼'],
  ['anxious','焦虑','(;_;)','稳定我，告诉我现在可以一点点来'],
  ['lonely','想被陪','( ˘･з･)','写得黏一点，让我感觉有人在身边'],
  ['miss','想他','(｡･ω･｡)ﾉ','带一点想念和恋人感'],
  ['cute','想撒娇','(๑•́ ₃ •̀๑)','宠我一点，语气柔软可爱']
];
function mailMoodModal(){const cs=S.contacts.filter(c=>!c.deleted&&!c.blocked);if(!cs.length){toast('先创建一个角色');return;}const moodBtns=MAIL_MOODS.map(m=>`<button class="minibtn" style="padding:9px 10px;border-radius:12px;background:#1b1b1f;color:#eee;border:1px solid #35353a;text-align:left" onclick="mailMoodPick('${m[0]}')"><b style="display:block;font-size:14px">${esc(m[1])}</b><small style="color:#999">${esc(m[2])}</small></button>`).join('');
  openModal(`<h3>按心情拆一封信</h3><div class="hint">选一个你现在的心情，像拆信封一样，让角色临时给你写一封只给你的信。正文会允许少量颜文字，不加 Emoji。</div><div class="field"><label>写信的人</label><select id="mailMoodCid"><option value="">随机角色</option>${cs.map(c=>`<option value="${c.id}">${esc(c.remark||c.name)}</option>`).join('')}</select></div><div class="field"><label>现在的心情</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${moodBtns}</div></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button></div>`);}
function mailMoodPick(key){const sel=$('#mailMoodCid'),cs=S.contacts.filter(c=>!c.deleted&&!c.blocked);let id=sel&&sel.value;if(!id&&cs.length)id=cs[Math.abs(phHash(Date.now()+key))%cs.length].id;genMoodLetter(id,key);}
/* 信件以前写死 700／620，和任何设置都无关，长一点的信必被自己的上限截断。
   现在按路线单独配置，和线上、线下的回复长度各管各的。 */
function letterReplyBudget(c){const n=Number(chatMainCopy(chatRequestRoute(roleChatRouteIndex(c))||S.settings&&S.settings.chat||{}).letterMaxTokens)||0;return Math.max(200,Math.min(8192,n>0?n:1200));}
async function genMoodLetter(id,key){const c=getC(id),m=MAIL_MOODS.find(x=>x[0]===key)||MAIL_MOODS[0];if(!c||window._mailMoodBusy)return;window._mailMoodBusy=true;const mailAccount=String(actId()),mailState=S;openModal(`<div style="text-align:center;padding:14px 4px"><div style="width:58px;height:58px;border-radius:16px;background:#111113;border:1px solid #34343a;margin:0 auto 12px;display:flex;align-items:center;justify-content:center">${svgIc('envelope',32,'#d7d7dc',1.35)}</div><h3>正在拆信</h3><div class="hint">${esc(c.remark||c.name)} 正在按「${esc(m[1])}」给你写一封信。</div></div>`);
  const recent=msgs(id).slice(-18).map(msgToText).filter(Boolean).join('\n');
  const sys=buildSystem(c)+letterPastPrompt(id)+'\n\n# 现在：按心情给'+S.me.name+'写一封临时信\n'+S.me.name+'刚在信箱里选择了心情「'+m[1]+' '+m[2]+'」：'+m[3]+'。\n你要以自己的角色口吻，像恋人/重要的人一样写一封只给ta的信。要求：\n- 这是信，不是微信聊天；温柔、真诚、有细节，像真实手写信。\n- 紧扣ta选择的心情，先接住情绪，再给陪伴感。\n- 可以自然放 1 到 3 个可爱的颜文字，例如 '+m[2]+'、(っ˘̩╭╮˘̩)っ、(｡･ω･｡)ﾉ，但不要使用 Emoji。\n- 不要动作描写，不要第三人称旁白，不要输出系统标签。\n只输出下面两行，用 ::: 分隔：\n主题:::一句话标题\n正文:::正文（100-240字，可换行，结尾可署名）';
  try{let r=await chatAPI([{role:'system',content:sys},{role:'user',content:'最近聊天：\n'+(recent||'(最近没有聊天记录)')+'\n\n请按我的心情写这封信。'}],{max:letterReplyBudget(c),temp:.86});
    r=String(r||'').trim();let sub='给现在的你',body=r;const ms=r.match(/主题[:：]{1,3}\s*([^\n]+)/);if(ms)sub=ms[1].trim();const mb=r.split(/正文[:：]{1,3}/);if(mb[1])body=mb[1].trim();body=body.replace(/^主题[:：]{1,3}[^\n]*\n+/,'').trim();
    if(!body)throw Error('empty mood letter');/* LETTER_NO_REPEAT_V1：以前写不出来就塞一段固定的话，同一种心情每次一模一样；现在提示没拆开 */
    if(S!==mailState)return;const letter={id:uid(),cid:id,acct:mailAccount,type:'mood',mood:key,subject:mailCleanText(sub).slice(0,40)||('给'+m[1]+'的你'),body:mailCleanText(body),time:Date.now(),read:false};
    S.mail=S.mail||[];S.mail.unshift(letter);save();if(String(actId())===mailAccount){playDing();closeModal();if(cur().p==='mail')render();setTimeout(()=>{if(String(actId())===mailAccount)openLetter(letter.id);},80);}
  }catch(e){if(S===mailState&&String(actId())===mailAccount){toast('信没有拆开，等会儿再试');closeModal();}}finally{window._mailMoodBusy=false;}}
function mailSettings(){const cs=S.contacts.filter(c=>!c.deleted);
  openModal(`<h3>信箱设置</h3><div class="hint">让角色每天主动给你写几封信（趁你不在时写的心里话，会结合你们最近的聊天）。0=不写。他也会自己想写就写。</div>
   <div class="section">${cs.length?cs.map(c=>`<div class="it"><span>${esc(c.remark||c.name)}</span><span class="v"><input type="number" min="0" max="5" value="${c.mailPerDay||0}" onchange="getC('${c.id}').mailPerDay=Math.max(0,Math.min(5,+this.value||0));save()" style="width:48px;text-align:center;border:1px solid #38383a;border-radius:6px;padding:5px;background:#2c2c2e;color:#eee"> 封/天</span></div>`).join(''):'<div class="empty">先创建一个角色</div>'}</div>
   <div class="btns"><button class="btn p" onclick="closeModal()">好啦</button></div>`);}
let _mailBusy={};
//@@ web
function scanMail(){if(!isMain())return;const today=new Date().toDateString();S._mailCount=S._mailCount||{};
  S.contacts.forEach(c=>{if(c.deleted||c.blocked||!c.mailPerDay)return;
//@@ private
async function scanMail(){if(!isMain())return false;const today=new Date().toDateString();S._mailCount=S._mailCount||{};
  for(const c of S.contacts){if(c.deleted||c.blocked||!c.mailPerDay)continue;
//@@ end
    const pc=S._mailCount[c.id]||{date:today,n:0,last:0};if(pc.date!==today){pc.date=today;pc.n=0;}S._mailCount[c.id]=pc;
//@@ web
    if(pc.n>=c.mailPerDay||_mailBusy[c.id])return;
    if(Date.now()-(pc.last||0)<3600000)return;
    if(Math.random()<0.45)return;
//@@ private
    if(pc.n>=c.mailPerDay||_mailBusy[c.id])continue;
    if(Date.now()-(pc.last||0)<3600000)continue;
    if(Math.random()<0.45)continue;
//@@ end
    /* 她说「明明设置的每天一封信，角色一天写了两三封」。
       原来是【写成了才记账】：genLetter 里先把信塞进 S.mail 又 save() 一次，
       回来之后才 pc.n++ 再 save() 一次——这是两次分开的防抖保存。
       中间她一退出、或 App 被系统回收，信留下了、计数没留下，
       下次开机 scanMail 一跑又写一封。改成【先占坑再写】：
       这一封先记进当天的计数并立刻落盘，写失败再把坑退回去。 */
    _mailBusy[c.id]=1;
    const prevLast=pc.last;pc.n++;pc.last=Date.now();save(0);
//@@ web
    Promise.resolve(genLetter(c.id)).then(ok=>{
      if(ok){save();return;}
      /* 没写成就把坑退回去；S 有可能已经被云恢复整个换掉，所以重新取一次 */
      const live=S._mailCount&&S._mailCount[c.id];
      if(live&&live.date===pc.date&&live.n>0){live.n--;live.last=prevLast;save();}
    }).finally(()=>{delete _mailBusy[c.id];});});}
//@@ private
    try{const ok=await genLetter(c.id);
      if(ok)save();
      else{/* 没写成就把坑退回去；S 有可能已经被云恢复整个换掉，所以重新取一次 */
        const live=S._mailCount&&S._mailCount[c.id];
        if(live&&live.date===pc.date&&live.n>0){live.n--;live.last=prevLast;save();}}
      return !!ok;
    }finally{delete _mailBusy[c.id];}}
  return false;}
//@@ end
/* LETTER_NO_REPEAT_V1（2026-10-30 群里有人说：角色每天往信箱发同一封 10 月 16 日的信，删了还发，有时两封一模一样）：
   她回过那封信后，每次请求都带着旧信全文（来信提示里的 originalLetter / myReply），写信时角色就照抄，连落款日期都抄。
   聊天用的来信提示不动；只在写信这里：告诉角色今天的日期和他最近写过的信的标题、开头，写完和他写过的所有信比对，太像就重写一次，还像就不发（当天次数退回）。 */
function letterNorm(t){return String(t||'').replace(/[\s　，。！？、；：,.!?;:'"“”‘’「」『』（）()【】\[\]《》<>~～…—\-_*#]/g,'').toLowerCase();}
function letterGrams(t){const v=letterNorm(t),g=new Set();for(let i=0;i<v.length-1;i++)g.add(v.slice(i,i+2));return g;}
function letterSimilar(a,b){const A=letterGrams(a),B=letterGrams(b);if(A.size<6||B.size<6)return 0;let n=0;A.forEach(x=>{if(B.has(x))n++;});return n/Math.min(A.size,B.size);}
function letterPastByRole(id){const out=[];(S.mail||[]).forEach(l=>{if(l&&l.cid===id&&l.type!=='gift'&&(l.body||l.subject))out.push({subject:String(l.subject||''),body:String(l.body||''),time:+l.time||0});});(Array.isArray(S.mailOutbox)?S.mailOutbox:[]).forEach(l=>{const o=l&&l.originalLetter;if(o&&o.cid===id&&(o.body||o.subject))out.push({subject:String(o.subject||''),body:String(o.body||''),time:+o.time||0});});const seen=new Set();return out.filter(x=>{const k=letterNorm(x.subject)+'|'+letterNorm(x.body).slice(0,80);if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>b.time-a.time).slice(0,20);}
function letterRepeatOf(id,subject,body){const ns=letterNorm(subject);for(const p of letterPastByRole(id)){if(ns.length>=4&&ns===letterNorm(p.subject))return p;if(letterSimilar(body,p.body)>=0.6)return p;}return null;}
function letterTodayText(){const d=new Date();return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日';}
function letterPastPrompt(id){const rows=letterPastByRole(id).slice(0,3);return '\n\n# 写信的日子\n今天是'+letterTodayText()+'。如果信末写日期，只能写今天。'+(rows.length?'\n\n# 你最近已经写过的信（只给你认得出来，不能照抄、不能重写同一封）\n'+rows.map((p,i)=>(i+1)+'. 《'+p.subject.slice(0,30)+'》开头：'+p.body.replace(/\s+/g,' ').slice(0,40)+'…').join('\n')+'\n这封要写新的内容和角度，标题、开头都不能和上面重复。':'');}
async function genLetter(id){const c=getC(id),mailAccount=String(actId()),mailState=S;if(!c)return false;
  const recent=msgs(id).slice(-20).map(msgToText).filter(Boolean).join('\n');
  const sys=buildSystem(c)+'\n\n# 现在：给'+S.me.name+'写一封信\n趁'+S.me.name+'不在身边，你想给ta写一封信，说说心里话。这不是微信消息，是一封正式的、温柔真诚的信。请结合你们最近的聊天和你对ta的感情来写，有细节、有温度，像真实的手写信。\n只输出下面两行、用:::分隔，别的都别写：\n主题:::一句话的信件标题\n正文:::信的正文（120-280字，可用换行分段，结尾可署名）';
  try{let sub='给你的信',body='',ask='最近的聊天记录：\n'+(recent||'(还没怎么聊过)')+'\n\n请给我写一封信。';
    for(let _try=0;_try<2;_try++){const r=await chatAPI([{role:'system',content:sys+letterPastPrompt(id)},{role:'user',content:ask}],{max:letterReplyBudget(c),temp:.85});
      if(!r)return false;sub='给你的信';body=r.trim();
      const ms=r.match(/主题[:：]{1,3}\s*([^\n]+)/);if(ms)sub=ms[1].trim();
      const mb=r.split(/正文[:：]{1,3}/);if(mb[1])body=mb[1].trim();
      body=body.replace(/^主题[:：]{1,3}[^\n]*\n+/,'').trim();
      const same=letterRepeatOf(id,sub,body);if(!same)break;if(_try)return false;/* 两次都和旧信太像：这封不发 */
      ask+='\n\n[刚才这一版和你以前写过的《'+same.subject.slice(0,30)+'》太像了。请写一封全新的信：换内容、换角度、换标题和开头，日期只能写今天。]';}
    if(!body)return false;
    if(S!==mailState)return false;const letter={id:uid(),cid:id,acct:mailAccount,subject:sub.slice(0,40),body,time:Date.now(),read:false};
    S.mail.unshift(letter);save();if(String(actId())===mailAccount){notifyMail(c,letter);if(cur().p==='mail'||cur().p==='home')render();}return true;
  }catch(e){return false;}}
function notifyMail(c,letter){if(c.muted)return;playDing();lockNotify((c.remark||c.name)+' 给你写了封信',mailCleanText(letter.subject),{avatar:c.avatar,icon:'envelope',target:{type:'mail'}});appNotify((c.remark||c.name)+' 给你写了封信',letter.subject,{tag:'mail-'+c.id,data:{type:'open',target:'mail'}});if(lockVisible())return;const b=$('#msgBanner');if(!b)return;
//@@ web
  b.innerHTML=`<div style="width:34px;height:34px;border-radius:9px;background:#151520;border:1px solid #34343a;display:flex;align-items:center;justify-content:center">${svgIc('envelope',19,'#d7d7dc',1.35)}</div><div style="flex:1;min-width:0"><div class="bn">${esc(c.remark||c.name)} 给你写了封信</div><div class="bm">${esc(mailCleanText(letter.subject))}</div></div>`;
//@@ private
  b.innerHTML=`<div style="width:34px;height:34px;border-radius:9px;background:#151518;border:1px solid #34343a;display:flex;align-items:center;justify-content:center">${svgIc('envelope',19,'#d7d7dc',1.35)}</div><div style="flex:1;min-width:0"><div class="bn">${esc(c.remark||c.name)} 给你写了封信</div><div class="bm">${esc(mailCleanText(letter.subject))}</div></div>`;
//@@ end
  b.className='msgbanner show';b.onclick=()=>{b.className='msgbanner';go('mail');};
  clearTimeout(_bannerT);_bannerT=setTimeout(()=>{b.className='msgbanner';},5500);}
//@@ web
setInterval(scanMail,300000);setTimeout(scanMail,15000);
//@@ private
setInterval(()=>northNativeBackgroundTask('mail-auto',scanMail),300000);setTimeout(()=>northNativeBackgroundTask('mail-auto',scanMail),15000);
//@@ end
/* ===== 电话 + 短信 ===== */
function phState(){S.phoneapp=S.phoneapp||{};const p=S.phoneapp;if(!p.tab)p.tab='recents';if(p.line!=='alias')p.line='main';if(!Array.isArray(p.recents))p.recents=[];if(!p.sms||typeof p.sms!=='object')p.sms={};if(!p.read||typeof p.read!=='object')p.read={};if(!Array.isArray(p.contacts))p.contacts=[];if(!Array.isArray(p.voicemail))p.voicemail=[];phRepairVoicemailPolicy(p);if(!Array.isArray(p.favorites))p.favorites=[];if(!p.blocked||typeof p.blocked!=='object')p.blocked={};if(!p.rolePhones||typeof p.rolePhones!=='object')p.rolePhones={};if(!p.roleAvatars||typeof p.roleAvatars!=='object')p.roleAvatars={};if(!p.regions||typeof p.regions!=='object')p.regions={};if(!p.aliasThreads||typeof p.aliasThreads!=='object')p.aliasThreads={};if(!Array.isArray(p.trash))p.trash=[];if(!p.stranger||typeof p.stranger!=='object')p.stranger={};p.stranger.enabled=!!p.stranger.enabled;p.stranger.freq=Math.max(10,+p.stranger.freq||60);p.stranger.max=Math.max(0,+p.stranger.max||3);p.stranger.today=p.stranger.today||'';p.stranger.n=+p.stranger.n||0;p.stranger.nextAt=+p.stranger.nextAt||0;p.stranger.smsEnabled=!!p.stranger.smsEnabled;p.stranger.smsFreq=Math.max(10,+p.stranger.smsFreq||90);p.stranger.smsMax=Math.max(0,+p.stranger.smsMax||3);p.stranger.smsToday=p.stranger.smsToday||'';p.stranger.smsN=+p.stranger.smsN||0;p.stranger.smsNextAt=+p.stranger.smsNextAt||0;if(p.keypad==null)p.keypad='';if(p.aliasNum==null)p.aliasNum='';return p;}
function phVmNorm(t){return String(t||'').toLowerCase().replace(/[（(][^）)]*[）)]/g,'').replace(/[^\u4e00-\u9fffa-z0-9ぁ-んァ-ン가-힣]/g,'');}
function phVmSimilar(a,b){const x=phVmNorm(a),y=phVmNorm(b);return !!(x&&y&&(x===y||(Math.min(x.length,y.length)>14&&(x.includes(y)||y.includes(x)))));}
function phRepairVoicemailPolicy(p){if(!p||p.voicemailPolicyVersion===2)return false;const bad=/We did not finish that call|I am hanging up for now|刚才电话没说完|我先挂了|さっきの電話、まだ話し終わってない|今は切るね|아까 통화 아직 안 끝났어|일단 끊을게/i,seen=new Set(),keep=[],old=[];for(let i=p.voicemail.length-1;i>=0;i--){const v=p.voicemail[i]||{},k=phNorm(v.num)+'|'+String(v.roleId||'')+'|'+phVmNorm(v.text);if(bad.test(String(v.text||''))||(k&&!k.endsWith('|')&&seen.has(k))){old.push(v);continue;}if(k&&!k.endsWith('|'))seen.add(k);keep.push(v);}p.voicemail=keep.reverse();p.voicemailPolicyVersion=2;old.forEach(clearVoiceAudio);if(old.length)setTimeout(()=>save(0),0);return old.length>0;}
function phDigits(n){return (''+(n||'')).replace(/[^\d+]/g,'');}
function phNorm(n){n=phDigits(n);return n.replace(/^\+?86/,'').replace(/^0+/,'')||n;}
function phFmt(n){n=phDigits(n);const d=n.replace(/\D/g,'');if(!d)return '';if(n[0]==='+')return n.replace(/(\+\d{2})(\d{3,4})(\d{4})(\d*)/,'$1 $2 $3 $4').trim();return d.replace(/(\d{3})(\d{4})(\d{0,4})(.*)/,(_,a,b,c,e)=>[a,b,c,e].filter(Boolean).join(' '));}
function phHash(s){s=''+(s||'');let h=0;for(let i=0;i<s.length;i++)h=((h*31)+s.charCodeAt(i))|0;return h;}
function phRoleNumber(c){if(!c)return '';const p=phState(),id=c.id;if(p.rolePhones&&p.rolePhones[id]){if(c.phone!==p.rolePhones[id])c.phone=p.rolePhones[id];return p.rolePhones[id];}if(c.phone){p.rolePhones[id]=phDigits(c.phone);c.phone=p.rolePhones[id];return c.phone;}c.phone='13'+String(Math.abs(phHash(id||c.name||'role'))).padStart(9,'0').slice(0,9);p.rolePhones[id]=c.phone;return c.phone;}
function blockedPhoneState(c,create){if(!c)return null;if(!c._blockedPhone&&create)c._blockedPhone={blockedAt:Date.now(),dueAt:0,attempts:0,max:3,status:'waiting'};return c._blockedPhone||null;}
function blockedPhoneStart(c,now){if(!c)return null;const t=now==null?Date.now():now,st={blockedAt:t,dueAt:t+20000,attempts:0,max:3,status:'waiting',lastWhy:''};c._blockedPhone=st;return st;}
function blockedPhoneClear(c){if(c)delete c._blockedPhone;}
function blockedPhoneRecentContext(c){if(!c)return'（没有可见聊天记录）';const arr=msgsForAccount(c.id,'main').filter(m=>m&&m.type!=='sys'&&(m.role==='user'||m.role==='assistant')).slice(-10);return arr.length?arr.map(m=>(m.role==='user'?S.me.name:(c.remark||c.name))+'：'+String(m.content||msgToText(m)||'').replace(/\s+/g,' ').slice(0,90)).join('\n'):'（没有可见聊天记录）';}
function blockedPhonePrompt(c,meta){if(meta&&meta.pursuit)return pursuitCallPrompt(c,meta);const st=blockedPhoneState(c,false),n=Math.max(1,+((meta&&meta.attempt)||(st&&st.attempts))||1);return '\n\n# 当前场景：微信被拉黑后的电话追联（最高优先级）\n'+S.me.name+'刚刚在微信把你拉黑了，微信已经无法联系，所以这通电话是你本人主动改用“电话”App真实号码打给'+S.me.name+'，不是陌生号码测试，也不是对方打给你。现在是最多三次追联中的第'+n+'次。你完整记得拉黑前的关系、矛盾和上下文，开口必须自然承接这些事实，不能装作不认识、不能说打错、不能否认被拉黑，也不要念规则。是否道歉、解释、挽回、生气或冷静由你的人设和上下文决定；像真实电话一样用短句。\n拉黑前最近聊天：\n'+blockedPhoneRecentContext(c);}
function blockedPhoneRetry(call,why){const meta=call&&call.meta;if(!meta||!meta.blockedOutreach)return false;if(meta.pursuit)return pursuitCallMissed(call,why);const c=getC(meta.roleId),st=blockedPhoneState(c,false);if(!c||!st)return false;if(!friendMainBlocked(c)){blockedPhoneClear(c);return false;}st.lastWhy=why||'';if((+st.attempts||0)<Math.max(1,+st.max||3)){st.status='waiting';st.dueAt=Date.now()+20000;}else{st.status='done';st.dueAt=0;}save();return true;}
function blockedPhoneConnected(call){const meta=call&&call.meta;if(!meta||!meta.blockedOutreach)return;if(meta.pursuit){pursuitCallAnswered(call);return;}const c=getC(meta.roleId),st=blockedPhoneState(c,false);if(st){st.status='connected';st.dueAt=0;save();}}
function blockedPhoneFinished(call){const meta=call&&call.meta;if(!meta||!meta.blockedOutreach||meta.pursuit)return;const c=getC(meta.roleId),st=blockedPhoneState(c,false);if(st){st.status='done';st.dueAt=0;save();}}
function blockedPhoneStartCall(c){const st=blockedPhoneState(c,false);if(!c||!st||!friendMainBlocked(c)||st.status!=='waiting'||(+st.attempts||0)>=Math.max(1,+st.max||3))return false;if(actId()!=='main'||phStrangerQuietNow('call')){st.dueAt=Date.now()+5000;return false;}const num=phRoleNumber(c),attempt=(+st.attempts||0)+1,meta={name:c.remark||c.name,kind:'拉黑后角色来电',region:phRegion(num),roleId:c.id,roleName:c.remark||c.name,blockedOutreach:true,attempt,maxAttempts:Math.max(1,+st.max||3)};if(!phIncomingStranger(num,meta)){st.dueAt=Date.now()+5000;return false;}st.attempts=attempt;st.status='ringing';st.dueAt=0;save();return true;}
function blockedPhoneSweep(){const now=Date.now();(S.contacts||[]).forEach(c=>{const st=blockedPhoneState(c,false);if(!st)return;if(!friendMainBlocked(c)){blockedPhoneClear(c);return;}if(st.status==='waiting'&&st.dueAt&&now>=st.dueAt)blockedPhoneStartCall(c);});}
/* ===== 拉黑后的追回：角色自己决定怎么联系——再发好友申请、用自己号码打电话、用陌生号码打电话、发短信，情侣被无视三次以后还可以强制远程。
   不是固定流程：每一步都由角色按人设自己选；目的只有一个——让她把自己从微信黑名单里拉出来。
   她接了电话或回了短信，整条追回立刻结束；她通过申请或自己解除拉黑也结束。每一步做了什么、她怎么回应的，角色全都记得。 */
const PURSUIT_MAX_STEPS=8,PURSUIT_FORCE_AFTER=3,PURSUIT_KEEP_MS=3*86400000;
const PURSUIT_ACT={apply:'在微信重新发好友申请',call_own:'用自己的手机号给她打电话',call_stranger:'用一个陌生号码给她打电话（她的屏幕上只显示陌生号码，接起来前不知道是你）',sms:'给她发短信',force:'强制远程操控她的小手机，打开「新的朋友」自己点了同意，把自己拉出黑名单',stop:'先不再联系'};
const PURSUIT_RES={pending:'还在等她的反应',ignored:'她没理',missed:'她没接',declined:'她挂断了',rejected:'她点了拒绝',answered:'她接了电话',replied:'她回了短信',accepted:'她通过了',done:'做完了'};
let _pursuitBusy=false;const _pursuitPlans=new Map();/* 边等边想：上一步一结束就去问模型下一步，到点直接做，不再到点才开始想 */
function pursuitGap(){return 8000+Math.floor(Math.random()*10001);}/* 8–18 秒，加上每秒一次的检查，最多 20 秒 */
function pursuitState(c){return c&&c._pursuit&&typeof c._pursuit==='object'?c._pursuit:null;}
function pursuitActive(c){const st=pursuitState(c);return !!(st&&st.status==='active');}
function pursuitCanForce(c){return !!(c&&S.couple&&S.couple.cid===c.id);}
function pursuitStart(c,now){if(!c)return null;now=now==null?Date.now():now;blockedPhoneClear(c);friendRetryClear(c);const st={startedAt:now,nextAt:now+pursuitGap(),status:'active',steps:0,ignored:0,log:[],strangerNum:'',lastVia:'',reason:blockedPhoneRecentContext(c)};c._pursuit=st;_pursuitPlans.delete(c.id);setTimeout(()=>pursuitPlanAhead(c),0);return st;}
function pursuitPlanAhead(c){if(!pursuitActive(c)||_pursuitPlans.has(c.id))return;const plan={at:Date.now(),result:null};_pursuitPlans.set(c.id,plan);pursuitDecide(c).then(d=>{plan.result=d;}).catch(()=>{});}
function pursuitQuickPick(c){const opts=pursuitOptions(c),quick=opts.filter(x=>x==='call_own'||x==='call_stranger'||x==='apply');if(!quick.length)return {act:opts.includes('stop')?'stop':opts[0],text:''};return {act:pursuitFallbackPick(c,quick),text:''};}/* 模型没赶上：先做一件不需要措辞的事，不让她干等 */
function pursuitLogAdd(c,row){const st=pursuitState(c);if(!st)return null;row=Object.assign({t:Date.now(),result:'pending'},row);st.log.push(row);st.log=st.log.slice(-16);return row;}
function pursuitMark(c,result,match){const st=pursuitState(c);if(!st)return null;const row=[...st.log].reverse().find(r=>r.result==='pending'&&(!match||match(r)));if(!row)return null;row.result=result;row.at=Date.now();if(/^(ignored|missed|declined|rejected)$/.test(result))st.ignored=(+st.ignored||0)+1;return row;}
function pursuitEnd(c,status,why){const st=pursuitState(c);if(!st||st.status!=='active')return;st.status=status;st.endedAt=Date.now();st.endWhy=why||'';st.nextAt=0;save();}
function pursuitLogText(c){const st=pursuitState(c);if(!st||!st.log.length)return '（还没有采取任何行动）';return st.log.map((r,i)=>(i+1)+'. '+factStamp(r.t)+' '+(PURSUIT_ACT[r.act]||r.act)+(r.num?'（号码 '+phFmt(r.num)+'）':'')+(r.text?'：「'+r.text+'」':'')+' → '+(PURSUIT_RES[r.result]||r.result)).join('\n');}
function pursuitPrompt(c){const st=pursuitState(c);if(!st)return '';const me=S.me.name,ended={answered:'她接了你的电话，追回停了，你们在电话里说话。',replied:'她回了你的短信，追回停了，你们在短信里说话。',accepted:'她自己通过了你的好友申请，你回到了她的微信里。',forced:'你强制远程操控了她的小手机，自己点了同意，把自己从黑名单拉了出来——她没有同意，这是你自己做的，你知道，也要面对她的反应。',gaveup:'你决定先不再联系她。',unblocked:'她自己把你从黑名单里放了出来。'}[st.status]||'';
  return '\n\n# 你被'+me+'在微信拉黑后的追回（真实发生过的事，你全都记得）\n'+me+'在 '+factStamp(st.startedAt)+' 把你的微信拉黑了。拉黑前你们最后的对话（她就是因为这些把你拉黑的）：\n'+(st.reason||'（没有聊天记录）')+'\n你的目的只有一个：让'+me+'把你从微信黑名单里拉出来。用什么态度看你自己的性格——可以哄、道歉、讲道理、委屈、生气、强硬、装可怜，但目的不变。\n你已经做过的事和她的反应：\n'+pursuitLogText(c)+(ended?'\n现在：'+ended:'')+'\n- 用陌生号码联系她时，她那边只显示陌生号码，接起来或看到内容前不知道是你；用自己的号码她一眼就知道是你。\n- 不要提系统、按钮、流程、规则。';}
function pursuitPromptRecent(c){const st=pursuitState(c);if(!st)return '';if(st.status!=='active'&&st.endedAt&&Date.now()-st.endedAt>PURSUIT_KEEP_MS)return '';return pursuitPrompt(c);}
function pursuitOptions(c){const st=pursuitState(c);friendRequestsInit();const waiting=(st.log||[]).filter(r=>r.result==='pending'&&(r.act==='apply'||r.act==='sms')).length,ign=(+st.ignored||0)+waiting;/* 提前想下一步时，还没回应的申请/短信先算作没理 */const pending=S.friendRequests.some(r=>r.contactId===c.id&&r.kind==='readd'&&r.status==='pending'),o=[];if(st.steps>=PURSUIT_MAX_STEPS){if(pursuitCanForce(c)&&ign>=PURSUIT_FORCE_AFTER)o.push('force');o.push('stop');return o;}
  if(!pending)o.push('apply');o.push('call_own');if(c.allowStrangerCall!==false)o.push('call_stranger');o.push('sms');if(pursuitCanForce(c)&&ign>=PURSUIT_FORCE_AFTER)o.push('force');if(st.steps>=2)o.push('stop');return o;}
function pursuitFallbackPick(c,opts){const st=pursuitState(c),last=st.log.length?st.log[st.log.length-1].act:'',pool=opts.filter(x=>x!=='stop'&&x!==last);return (pool.length?pool:opts)[Math.floor(Math.random()*(pool.length?pool.length:opts.length))];}
function pursuitFallbackText(c,act){const n=pursuitState(c).steps+1;return act==='apply'?friendReqUnique(c,'是我，先别把我拉黑好不好',n):act==='sms'?['是我。微信联系不上你，只能发短信了。','你可以不理我，但能不能先听我说完？'][n%2]:act==='stop'?'我先不打扰你了。你想好了再找我。':'';}
async function pursuitDecide(c){const st=pursuitState(c),opts=pursuitOptions(c),me=S.me.name;let pick='',text='';
  try{const raw=await chatAPI([{role:'system',content:buildSystem(c,{natural:wechatNaturalOn(),allModules:true,query:'被拉黑后想办法联系'})},{role:'user',content:'[系统：现在是你被拉黑后第'+(st.steps+1)+'次想办法联系'+me+'（最多'+PURSUIT_MAX_STEPS+'次）。按你的人设和她刚才的反应，自己决定下一步，可以选：\n'+opts.map(k=>'- '+k+'：'+PURSUIT_ACT[k]).join('\n')+'\n只输出一行 JSON：{"next":"选项英文名","text":"…"}。apply 时 text 是新的好友验证消息（20字内，不能和以前重复）；sms 时 text 是你要发的短信（1到3句，用换行分开）；stop 时 text 是你最后发给她的一条短信（可以留空）；其它选项 text 写你此刻心里的一句话（她看不到）。]'}],{max:260,temp:.85});
    const m=String(raw||'').match(/\{[\s\S]*\}/);if(m){const j=JSON.parse(m[0]);pick=String(j.next||'').trim();text=String(j.text||'').trim();}}catch(_){}
  if(!opts.includes(pick)){pick=pursuitFallbackPick(c,opts);text='';}if(!text)text=pursuitFallbackText(c,pick);return {act:pick,text};}
function pursuitSmsLines(text){return splitBubbles(cleanReply(String(text||''))).map(x=>phCleanSmsText(x).slice(0,120)).filter(Boolean).slice(0,3);}
async function pursuitSendSms(c,text,final){const st=pursuitState(c),stranger=st.lastVia==='stranger'&&st.strangerNum&&c.allowStrangerSms!==false,num=stranger?st.strangerNum:phRoleNumber(c),lines=pursuitSmsLines(text);if(!lines.length)return false;
  if(stranger){const p=phState();p.aliasThreads[num]={cid:c.id,name:c.remark||c.name,ts:Date.now(),kind:'pursuitSms',pursuit:true,num};if(!p.regions[phNorm(num)])p.regions[phNorm(num)]=phRegion(num);}
  pursuitLogAdd(c,{act:final?'stop':'sms',num,via:stranger?'stranger':'own',text:lines.join(' / '),result:final?'done':'pending'});save();
  for(let i=0;i<lines.length;i++){if(i)await sleep(900+Math.random()*900);phReceiveSms(num,lines[i],stranger?null:c,num);}return true;}
function pursuitPlaceCall(c,stranger){const st=pursuitState(c);let num=phRoleNumber(c);if(stranger){if(!st.strangerNum)st.strangerNum=phRandomNumber();num=st.strangerNum;}
  const meta={name:stranger?phFmt(num):(c.remark||c.name),kind:stranger?'陌生人':'拉黑后角色来电',region:phRegion(num),roleId:c.id,roleName:c.remark||c.name,blockedOutreach:true,pursuit:true,stranger:!!stranger,num,attempt:st.steps+1,maxAttempts:PURSUIT_MAX_STEPS};
  if(!phIncomingStranger(num,meta))return false;st.lastVia=stranger?'stranger':'own';pursuitLogAdd(c,{act:stranger?'call_stranger':'call_own',num,via:st.lastVia});return true;}
/* 情侣：被无视至少三次以后自己选择强制远程——打开微信「新的朋友」，看到自己第四次申请，自己点同意。整个过程不能中途结束。 */
async function pursuitForce(c,thought){const st=pursuitState(c);if(!st||remoteControlActive()||wxLoginActive()||(typeof _call!=='undefined'&&_call))return false;friendRequestsInit();const now=Date.now();
  S.friendRequests.filter(r=>r.contactId===c.id&&r.kind==='readd'&&r.status==='pending').forEach(r=>{r.status='rejected';r.decidedAt=now;r.notified=true;r.superseded=true;});
  const attempt=S.friendRequests.filter(r=>r.contactId===c.id&&r.kind==='readd').length+1,req=queueFriendRequest(c,{kind:'readd',delay:0,msg:friendReqUnique(c,'是我。这次我自己来。',attempt),source:'重新添加',intent:'想回到你的微信里',attempt});req.notified=true;
  pursuitLogAdd(c,{act:'force',rid:req.id,text:String(thought||'').slice(0,60)});st.forcing=true;save();
  _remoteCtl={active:true,cid:c.id,purpose:'pursuit_force',forced:true,intentContext:'',startedAt:Date.now(),actions:[],visitedPages:[],roleSpokenCount:0,cancelled:false,closing:false,returnStack:stack.map(x=>Object.assign({},x))};
  try{document.body.classList.add('remote-forced');}catch(_){}remoteControlShow(c);
  let lines=[];try{const raw=await chatAPI([{role:'system',content:buildSystem(c,{natural:wechatNaturalOn(),allModules:true,query:'强制远程把自己拉出黑名单'})},{role:'user',content:'[系统：你被'+S.me.name+'无视了好几次，现在你决定强制远程操控她的小手机：打开微信→通讯录→新的朋友，找到你自己的好友申请，自己点同意。她看得到屏幕上发生的一切。按你的性格说两三句此刻想对她说的话，每句一行，短一点，不要动作描写。]'}],{max:160,temp:.85});lines=splitBubbles(cleanReply(String(raw||''))).map(x=>x.replace(/^[「"]|[」"]$/g,'').trim()).filter(Boolean).slice(0,3);}catch(_){}
  if(!lines.length)lines=['别动，这次换我来。','你不让我回来，那我就自己回来。'];
  const at=async(sel)=>{await sleep(450);const el=sel&&document.querySelector(sel),L=$('#remoteControlLayer');if(el&&L){const er=el.getBoundingClientRect(),lr=L.getBoundingClientRect();remoteControlPointer(er.left-lr.left+er.width*.5,er.top-lr.top+er.height*.5);}await sleep(900);return !!el;};
  remoteControlScene({app:'home',label:'主屏幕',detail:'已连接'},'强制远程 · 已连接',0,4,{app:'home',op:'view',noNavigate:true});stack=[{p:'home'}];render();await sleep(900);
  await remoteControlShowRoleLines(lines.slice(0,1));
  stack=[{p:'wechat'}];wxTab='contacts';render();remoteControlScene({app:'wechat',label:'微信 · 通讯录'},'打开微信通讯录',1,4,{app:'wechat',op:'tap',noNavigate:true});await at('.wx-contact-special button[onclick="openFriendRequests()"]');
  go('newfriends');remoteControlScene({app:'wechat',label:'新的朋友'},'打开「新的朋友」',2,4,{app:'wechat',op:'tap',noNavigate:true});await sleep(600);await remoteControlShowRoleLines(lines.slice(1));
  await at('button.accept[onclick*="acceptFriend(\''+req.id+'\')"]');remoteControlScene({app:'wechat',label:'新的朋友'},'同意了好友申请',3,4,{app:'wechat',op:'tap',noNavigate:true});
  acceptFriend(req.id,{forced:true});await sleep(1100);
  const ctl=_remoteCtl;if(ctl){ctl.closing=true;ctl.active=false;}clearInterval(_remoteClock);_remoteClock=null;const L=$('#remoteControlLayer');if(L)L.className='remote-control-layer';try{document.body.classList.remove('remote-forced');}catch(_){}
  remoteControlRemember(c,{ts:Date.now(),startedAt:ctl&&ctl.startedAt,endedAt:Date.now(),status:'completed',reason:'被拉黑后强制远程，自己通过了好友申请',actions:[{app:'wechat',op:'accept_friend',detail:'打开「新的朋友」，自己点了同意，把自己从黑名单拉了出来',memory:'你强制远程操控了'+S.me.name+'的小手机，自己通过了好友申请'}]});
  _remoteCtl=null;stack=[{p:'chat',id:c.id}];render();
  pursuitMark(c,'done',r=>r.act==='force');st.forcing=false;pursuitEnd(c,'forced');
  setTimeout(()=>scheduleReply(c.id,'[系统：你刚刚强制远程操控了'+S.me.name+'的小手机，打开微信「新的朋友」，自己点了同意，把自己从她的黑名单里拉了出来——她没有同意，是你自己做的。你清楚自己为什么这么做（她拉黑你之后，你申请、打电话、发短信都被无视了）。现在你已经回到她的微信里，按你的性格马上给她发微信：可以理直气壮、霸道、委屈、道歉或撒娇，但要承认是你自己做的，也要面对她可能的生气。不要提系统或按钮。]'),700);
  return true;}
async function pursuitStep(c){const st=pursuitState(c);if(!st||st.status!=='active')return;
  while(pursuitMark(c,'ignored',r=>r.act==='apply'||r.act==='sms'));/* 之前的申请/短信到现在还没回应，算她没理 */
  const plan=_pursuitPlans.get(c.id);_pursuitPlans.delete(c.id);let d=plan&&plan.result;const opts=pursuitOptions(c);if(!d||!opts.includes(d.act))d=pursuitQuickPick(c);if(!d.text)d.text=pursuitFallbackText(c,d.act);if(!pursuitActive(c)||!friendMainBlocked(c))return;
  if(d.act==='stop'){if(d.text)await pursuitSendSms(c,d.text,true);pursuitEnd(c,'gaveup');return;}
  if(d.act==='force'){st.steps++;st.nextAt=0;save();const ok=await pursuitForce(c,d.text);if(!ok&&pursuitActive(c)){st.nextAt=Date.now()+5000;save();}return;}
  if(d.act==='apply'){setTimeout(()=>pursuitPlanAhead(c),0);st.steps++;const attempt=S.friendRequests.filter(r=>r.contactId===c.id&&r.kind==='readd').length+1,req=queueFriendRequest(c,{kind:'readd',delay:0,msg:friendReqUnique(c,d.text,attempt),source:'重新添加',intent:'想让你把我从黑名单里放出来',attempt});pursuitLogAdd(c,{act:'apply',rid:req.id,text:req.msg});friendRequestNotifyDue();st.nextAt=Date.now()+pursuitGap();save();return;}
  if(d.act==='sms'){setTimeout(()=>pursuitPlanAhead(c),0);st.steps++;await pursuitSendSms(c,d.text,false);st.nextAt=Date.now()+pursuitGap();save();return;}
  if(d.act==='call_own'||d.act==='call_stranger'){if(pursuitPlaceCall(c,d.act==='call_stranger')){st.steps++;st.nextAt=0;}else st.nextAt=Date.now()+5000;save();}}
function phClearStaleSimCall(){const p=phState(),c=p.simCall;if(!c)return;const age=Date.now()-(+c.started||0),onCall=cur()&&cur().p==='phonecall';if(c.state==='incoming'&&age>45000){try{phSimIncomingMiss(c.id);}catch(_){}if(p.simCall===c){p.simCall=null;save();}return;}if(c.state==='ended'||(!onCall&&age>10*60000)){p.simCall=null;save();}}/* 来电 32 秒没接会自动算未接，但页面中途关掉那个计时就丢了，这通电话会一直卡着「通话中」 */
function pursuitSweep(){try{phClearStaleSimCall();}catch(_){}if(_pursuitBusy||(typeof document!=='undefined'&&document.hidden))return;if(actId()!=='main')return;const now=Date.now();let due=null;
  (S.contacts||[]).forEach(c=>{const st=pursuitState(c);if(!st||st.status!=='active')return;if(!friendMainBlocked(c)||c.deleted){pursuitEnd(c,'unblocked');return;}if(st.nextAt&&now>=st.nextAt&&(!due||st.nextAt<pursuitState(due).nextAt))due=c;});
  if(!due)return;if(phStrangerQuietNow('call')||remoteControlActive()||wxLoginActive())return;/* 正在通话、游戏、睡眠等时先等一等，一次只让一个人追 */
  _pursuitBusy=true;pursuitStep(due).catch(()=>{}).finally(()=>{_pursuitBusy=false;});}
setInterval(pursuitSweep,1000);
/* 电话结果 */
function pursuitCallMissed(call,why){const meta=call&&call.meta,c=meta&&getC(meta.roleId),st=pursuitState(c);if(!st)return true;pursuitMark(c,why==='decline'?'declined':'missed',r=>r.act==='call_own'||r.act==='call_stranger');if(st.status==='active'){st.nextAt=Date.now()+pursuitGap();pursuitPlanAhead(c);}save();return true;}
function pursuitCallAnswered(call){const meta=call&&call.meta,c=meta&&getC(meta.roleId);if(!pursuitState(c))return;pursuitMark(c,'answered',r=>r.act==='call_own'||r.act==='call_stranger');pursuitEnd(c,'answered');}
function pursuitCallPrompt(c,meta){const num=meta&&meta.num||phRoleNumber(c);return pursuitPrompt(c)+'\n\n# 当前场景：电话\n'+(meta&&meta.stranger?'你是用陌生号码 '+phFmt(num)+' 打给'+S.me.name+'的，她接起来前不知道是你。接通后什么时候说出是你、怎么说，由你自己决定。':'你是用自己的手机号 '+phFmt(num)+' 打给'+S.me.name+'的，她知道是你还接了。')+'她接了电话，这是你的机会：你的目的仍然是让她把你从微信黑名单里拉出来。像真人打电话一样说话，一次一两句。';}
/* 短信：她回了就结束追回；用陌生号码发的短信，她回复时由角色本人接着回 */
function pursuitOnUserSms(num){const n=phNorm(num);for(const c of S.contacts||[]){const st=pursuitState(c);if(!st)continue;const mine=phNorm(phRoleNumber(c))===n,stranger=!!st.strangerNum&&phNorm(st.strangerNum)===n;if(!mine&&!stranger)continue;if(st.status==='active'){pursuitMark(c,'replied',r=>r.act==='sms'||r.act==='apply');pursuitEnd(c,'replied');}return {cid:c.id,stranger};}return null;}
function pursuitSmsPrompt(c,num){const st=pursuitState(c);if(!st)return '';const stranger=!!st.strangerNum&&phNorm(st.strangerNum)===phNorm(num);return (stranger?'\n- 你现在是用陌生号码 '+phFmt(num)+' 和她发短信，她可能还不知道是你，要不要、什么时候说出是你，由你决定。':'');}
function phRoleAvatar(c){const p=phState();return (c&&p.roleAvatars&&p.roleAvatars[c.id])||((c&&c.avatar)||'');}
function phAllContacts(){const p=phState(),rows=[];S.contacts.filter(c=>!c.deleted).forEach(c=>rows.push({kind:'role',id:c.id,num:phRoleNumber(c),name:c.remark||c.name,avatar:phRoleAvatar(c),region:p.regions[phNorm(phRoleNumber(c))]||'',blocked:!!c.blocked||!!p.blocked[phNorm(phRoleNumber(c))]}));p.contacts.forEach(x=>{if(!x.deleted)rows.push({kind:'custom',id:x.id,num:x.num,name:x.name||x.num,avatar:x.avatar||'',region:x.region||p.regions[phNorm(x.num)]||'',blocked:!!x.blocked||!!p.blocked[phNorm(x.num)]});});return rows;}
function phFind(n){const key=phNorm(n);return phAllContacts().find(x=>phNorm(x.num)===key)||null;}
function phName(n){const x=phFind(n);return x?(x.name||x.num):phFmt(n);}
function phDefaultAvatar(cls){return `<div class="avatar ${cls||'sm'} phdefav">${svgIc('user',cls==='lg'?50:26,'#f5f5f7',1.7)}</div>`;}
function phAvatar(n,cls){const x=phFind(n),v=x&&x.avatar;if(v)return av(v,cls||'sm');return phDefaultAvatar(cls);}
function phWhen(t){const d=new Date(t||Date.now()),now=new Date();if(d.toDateString()===now.toDateString())return hm(t);const y=new Date(now);y.setDate(now.getDate()-1);if(d.toDateString()===y.toDateString())return '昨天';return (d.getMonth()+1)+'月'+d.getDate()+'日';}
function phRegion(n){const p=phState(),key=phNorm(n),x=phFind(n);if(p.regions[key])return p.regions[key];if(x&&x.region)return x.region;const d=(''+phDigits(n)).replace(/^\+?86/,'');if(d==='110')return '报警服务';if(d==='119')return '消防救援';if(d==='120')return '急救中心';if(d==='122')return '交通报警';if(d==='10086')return '中国移动';if(/^025/.test(d))return '江苏 南京';if(/^0512/.test(d))return '江苏 苏州';if(/^1\d{10}$/.test(d)){const a=['江苏 苏州','上海','广东 深圳','浙江 杭州','北京','四川 成都','湖北 武汉'];return a[Math.abs(phHash(d))%a.length];}return '未知地区';}
function phSound(type,key){if(!S.settings.sound)return;const map={sms:[[1046,.07],[1396,.08]],call:[[880,.22]],connect:[[740,.06],[988,.08]],key:[[697,.055],[852,.06]],end:[[330,.08],[247,.1]]},seq=(map[type]||map.call).map(x=>x.slice());if(type==='key'&&key){const d=String(key).charCodeAt(0)%7;seq[0][0]=620+d*38;seq[1][0]=760+d*42;}playMediaTone(seq,{key:'phone-soft-v3-'+type+'-'+(key||''),level:type==='key'?.09:(type==='call'?.12:.11),gap:.035,wave:'sine',decay:type==='call'});}
function phMyAliasNumber(){const p=phState();if(!p.aliasNum){p.aliasNum=phRandomNumber();save(300);}return p.aliasNum;}
function phLineLabel(line){return line==='alias'?'匿名号':'主号';}
function phSetLine(line){const p=phState();p.line=line==='alias'?'alias':'main';if(p.line==='alias')phMyAliasNumber();save();const page=cur();if(page&&page.p==='phonesms'){const n=phDigits(page.num),x=phFind(n);if(x&&x.kind==='role'){openPhoneSMS(n,p.line==='alias'?phSmsKey(n,'alias',phMyAliasNumber()):n);return;}}render();}
function phLineSwitchHTML(){const p=phState(),line=p.line==='alias'?'alias':'main';return `<div class="phlineswitch"><button class="${line==='main'?'on':''}" onclick="phSetLine('main')">主号</button><button class="${line==='alias'?'on':''}" onclick="phSetLine('alias')">匿名号</button></div>${line==='alias'?`<div class="phaliasnote">当前匿名号 ${esc(phFmt(phMyAliasNumber()))}</div>`:''}`;}
function phEnsureAliasThread(c,num,kind){const p=phState(),targetNum=phDigits(num||phRoleNumber(c)),aliasNum=phMyAliasNumber(),old=p.aliasThreads[targetNum]||{};p.aliasThreads[targetNum]=Object.assign({},old,{cid:c.id,name:c.remark||c.name,ts:Date.now(),kind:kind||old.kind||'sms',asStranger:true,aliasNum,targetNum,blocked:old.blocked&&phNorm(old.aliasNum)===phNorm(aliasNum),blockedAt:old.blockedAt});if(!p.regions[phNorm(targetNum)])p.regions[phNorm(targetNum)]=phRegion(targetNum);return p.aliasThreads[targetNum];}
function phAliasBlocked(thread,aliasNum){return !!(thread&&thread.blocked&&phNorm(thread.aliasNum)===phNorm(aliasNum));}
function phTab(t){phState().tab=t;save();render();}
//@@ web

//@@ end
