const CJK_TEST=new RegExp(CJK_RE.source);
function hasCN(s){return CJK_TEST.test(s||'');}
function callCnTermFix(s){s=String(s||'');return s.replace(/\bmy\s+love\b/ig,'亲爱的').replace(/\b(?:baby|babe)\b/ig,'宝贝').replace(/\b(?:darling|honey|sweetheart|love)\b/ig,'亲爱的').replace(/回答先生/g,'回答我').replace(/答复先生/g,'回答我');}
function callNormalizeCnTranslationLine(line){const m=String(line||'').trim().match(/^[（(]\s*([^）)]*?)\s*[）)]$/);if(!m)return line;let body=callCnTermFix(m[1]).replace(/\s+/g,' ').trim();if(!body)return line;if(/^[A-Za-z .,!?'’-]+$/.test(body))body=body.replace(/\b(?:baby|babe)\b/ig,'宝贝').replace(/\b(?:darling|honey|sweetheart|my love|love)\b/ig,'亲爱的');return '（'+body+'）';}
function callNormalizeForeignOrig(line,lang){lang=normVoiceLang(lang);let s=String(line||'').trim();if(lang==='英'){s=s.replace(/^answer\s*(?:先生|主人|哥哥|姐姐|老公|老婆|宝贝|宝宝|亲爱的)\s*[。.!?！？]*$/i,'Answer me.');s=s.replace(/^(reply|respond)\s*(?:先生|主人|哥哥|姐姐|老公|老婆|宝贝|宝宝|亲爱的)\s*[。.!?！？]*$/i,'Answer me.').replace(/(?:宝贝|宝宝|亲爱的)/g,'baby');}return s;}
//@@ private
function callInlineTranslationParts(line,lang){lang=normVoiceLang(lang);const raw=String(line||'').trim();if(!raw||lang==='zh'||callIsActionLine(raw))return{orig:raw,trans:''};const m=raw.match(/^([\s\S]*?\S)\s*[（(]\s*([^）)]*[\u3400-\u9fff][^）)]*)\s*[）)]\s*$/);if(!m)return{orig:raw,trans:''};const orig=callNormalizeForeignOrig(m[1].trim(),lang),trans=callNormalizeCnTranslationLine('（'+m[2].trim()+'）');return orig&&trans?{orig,trans}:{orig:raw,trans:''};}
//@@ end
function callNormalizeLine(line,lang){lang=normVoiceLang(lang);const s=String(line||'').trim();if(/^[（(][^）)]*[）)]$/.test(s))return callNormalizeCnTranslationLine(s);return (!lang||lang==='zh')?s:callNormalizeForeignOrig(s,lang);}
function callIsActionLine(line){/* COHAB_VOICE_LONG_NARRATION_V1：共同生活语音里角色的旁白常常超过 80 字，以前被当成台词（大字、带【】、还可能被念出来）；只在共同生活语音里放宽，长的【】不可能是控制标签。线上电话不变 */if(typeof _call!=='undefined'&&_call&&_call.cohab&&/^【[^】]{81,800}】$/.test(String(line||'').trim()))return true;return /^【(?!\s*(?:心情|心情值|通话语气|挂断|登录微信|发朋友圈|发推|发抖音|点外卖|转账|红包|记住|闹钟|日程|婚礼日程|监督目标|目标完成|送礼|锁定|禁言|限时|加时|扣款|关小黑屋|位置|图片|文件)(?:\s*[|｜:：\]】]|$))[^】]{1,80}】$/.test(String(line||'').trim());}
function callHasVideoAction(text){return (String(text||'').match(/【[^】]{1,80}】/g)||[]).some(callIsActionLine);}
function ensureVideoCallAction(text,cue){text=String(text||'').trim();if(callHasVideoAction(text))return text;cue=ttsCueKind(cue);const action=cue==='tense'?'【目光落在镜头上，神情认真了些】':cue==='soft'?'【望着镜头，神情慢慢柔和下来】':cue==='laugh'?'【看着镜头轻轻笑了一下】':cue==='sleepy'?'【靠近镜头，困倦地眨了眨眼】':cue==='surprised'?'【看向镜头，神情明显怔了一下】':'【看着镜头，神情随着话音轻轻变化】';return text?(text+'\n'+action):action;}
function callHasSpokenDialogue(text,lang){return String(text||'').split(/\n+/).some(line=>{line=String(line||'').trim();if(!line||callIsActionLine(line)||/^[（(][^）)]*[）)]$/.test(line))return false;return !!pickSpoken(line,lang);});}
function callVideoFallbackDialogue(lang){lang=normVoiceLang(lang);if(lang==='粤')return '我喺度呀，頭先有啲走神。\n（我在，刚才有点走神。）';if(lang==='英')return "I'm here. I got distracted for a moment.\n（我在，刚才有点走神。）";if(lang==='日')return 'ここにいるよ。ちょっとぼんやりしてた。\n（我在，刚才有点走神。）';if(lang==='韩')return '여기 있어. 잠깐 딴생각했어.\n（我在，刚才有点走神。）';if(lang==='法')return 'Je suis là. J’étais un peu distrait.\n（我在，刚才有点走神。）';if(lang==='德')return 'Ich bin da. Ich war kurz abgelenkt.\n（我在，刚才有点走神。）';if(lang==='俄')return 'Я здесь. Я немного отвлёкся.\n（我在，刚才有点走神。）';return '我在，刚才有点走神。';}
function ensureVideoCallDialogue(text,lang){text=String(text||'').trim();if(callHasSpokenDialogue(text,lang))return text;const fallback=callVideoFallbackDialogue(lang);return text?(text+'\n'+fallback):fallback;}
function callBadForeignMix(line,lang){lang=normVoiceLang(lang);if(!['英','法','德','俄'].includes(lang))return false;let s=String(line||'').replace(/[（(][^）)]*[）)]/g,'').replace(/【[^】]*】/g,'').trim();if(!s||/^\[.*\]$/.test(s))return false;return hasForeign(s,lang)&&hasCN(s);}
/* 动作描写（【…】）是给她看的中文舞台提示，和角色说什么语言没关系。
   可原来两处语言检查都【明确跳过】动作行（callBadForeignLine 和 callDrifted 里
   都写着 callIsActionLine(l) 就 return false），所以电话打久了模型顺手把动作
   也写成外语——【I love you too】——一路没人拦得住。这里单独补一道：
   动作行里一个中文都没有、却全是外文字母，就整行丢掉（它只是装饰，
   丢掉不影响台词；视频通话里 ensureVideoCallAction 还会补一句中文的回来）。 */
function callActionLineForeign(line){
  const inner=String(line||'').trim().replace(/^【/,'').replace(/】$/,'').trim();
  if(!inner)return false;
  /* 假名和谚文一出现就肯定不是中文——日文里也有汉字（【そっと微笑んだ】里的「微笑」
     就是汉字），只看有没有汉字会把日文动作当成中文放过去，所以先看这两种字母。 */
  if(/[ぁ-んァ-ヶ가-힣]/.test(inner))return true;
  if(hasCN(inner))return false;
  return /[A-Za-zÀ-ÖØ-öø-ÿĀ-ž\u0400-\u04ff]/.test(inner);}
function callStripForeignActions(text){const rows=String(text||'').split('\n');
  const kept=rows.filter(l=>!(callIsActionLine(l)&&callActionLineForeign(l)));
  return (kept.length?kept:rows).join('\n');}
function callBadForeignLine(line,lang){lang=normVoiceLang(lang);const l=String(line||'').trim();if(!lang||lang==='zh'||!l||/^\[.*\]$/.test(l)||callIsActionLine(l)||(/^[（(][^）)]*[）)]$/.test(l)&&hasCN(l)))return false;const noAct=l.replace(/【[^】]*】/g,'').replace(/[（(][^）)]*[）)]/g,'').trim();if(!noAct)return false;return (hasCN(noAct)&&!hasForeign(noAct,lang))||callBadForeignMix(noAct,lang);}
//@@ private
function callResponseUnits(pieces,lang,rawOutput){const units=[];(Array.isArray(pieces)?pieces:[]).forEach(value=>{const inline=callInlineTranslationParts(String(value||'').trim(),lang);let line=rawOutput?String(inline.orig||''):callNormalizeLine(inline.orig,lang);if(!line||!rawOutput&&callBadForeignLine(line,lang))return;if(inline.trans){units.push({orig:line,trans:inline.trans});return;}const isTrans=/^[（(][^）)]*[）)]$/.test(line)&&hasCN(line);if(isTrans){if(units.length&&!units[units.length-1].trans)units[units.length-1].trans=callNormalizeCnTranslationLine(line);return;}units.push({orig:line,trans:''});});return units;}
//@@ end
// 把通话里的一句转成"中文版"，喂给文字聊天的历史，免得他照抄电话里的外语格式
function callToCN(text){let t=(text||'').replace(/【[^】]*】/g,'').replace(/\[[^\]]*\]/g,'').trim();
  const m=t.match(/[（(]([^）)]*)[）)]/);if(m&&hasCN(callCnTermFix(m[1])))return callCnTermFix(m[1]).trim();      // 取括号里的中文翻译
  const cn=t.replace(/[A-Za-zÀ-ÖØ-öø-ÿĀ-žß\u0400-\u04ff가-힣぀-ヿ]/g,'').replace(/[（()）]/g,'').replace(/\s+/g,' ').trim();
  return hasCN(cn)?cn:'';}                                                          // 纯外语那句就丢掉
// 文字聊天里若冒出"外语（中文）"的电话格式，自动取中文显示（纯中文的不动）
function deCallFmt(line){if(!/[A-Za-zÀ-ÖØ-öø-ÿĀ-žß\u0400-\u04ff가-힣぀-ヿ]/.test(line))return line;
  const m=line.match(/[（(]([^）)]*)[）)]/);if(m&&hasCN(m[1]))return m[1].trim();return line;}
function parseVoiceTagLine(line){let s=(''+(line||'')).trim();if(!s)return null;
  const duration='(?:\\d{1,2}:)?\\d{1,2}:\\d{2}';let body='',m=s.match(new RegExp('^[\\[【]\\s*语音(?:消息)?\\s*(?:'+duration+')?\\s*[\\]】]\\s*([\\s\\S]+)$'));
  if(m)body=(m[1]||'').trim();else{m=s.match(new RegExp('^[\\[【]\\s*语音(?:消息)?\\s*(?:'+duration+')?\\s*(?:[|｜:：]\\s*([\\s\\S]*?))?\\s*[\\]】]$'));if(!m)m=s.match(/^[\[【]\s*(?:我|你|他|她|ta|TA)?\s*(?:发)?\s*语音(?:消息|说)?\s*[:：]\s*([\s\S]*?)\s*[\]】]$/);if(m)body=(m[1]||'').trim();}
  if(!m||!body)return null;
  const parts=body.split(/[|｜]/).map(x=>x.trim()).filter(x=>x!==''),durationOnly=/^(?:\d{1,2}:)?\d{1,2}:\d{2}$/;if(parts.length>1&&durationOnly.test(parts[0]))parts.shift();const last=parts[parts.length-1]||'';let cue='';
  if(/^语气\s*[:：]/.test(last)){cue=last.replace(/^语气\s*[:：]\s*/,'').trim();parts.pop();}
  const text=(parts.shift()||'').trim(),trans=parts.join('|').trim();
  return text?{text,trans,cue}:null;}
// 通话里是否跑偏成中文（整句中文、又不是括号翻译）
function callDrifted(content,lang){lang=normVoiceLang(lang);if(!lang||lang==='zh')return false;
  return splitBubbles(content).some(l=>{l=(l||'').trim();if(!l)return false;
    if(/^\[.*\]$/.test(l))return false;                       // 标签行
    if(callIsActionLine(l))return false;                       // 视频动作行
    if(/^[（(][^）)]*[）)]$/.test(l))return false;             // 纯括号翻译
    return callBadForeignLine(l,lang);});}
function callEnglishTranslationRequired(line){const voice=pickSpoken(line,'英'),letters=(voice.match(/[A-Za-z]/g)||[]).length,words=(voice.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[]).length;return !!voice&&(letters>=18||words>=4);}
function callCantoneseTranslationRequired(line){return !!pickSpoken(line,'粤');}
function callTranslationIssue(content,lang){lang=normVoiceLang(lang);if(!lang||lang==='zh')return'';if(!['英','粤'].includes(lang))return callDrifted(content,lang)?'外语台词混入了错误语言':'';const lines=splitBubbles(content).map(x=>String(x||'').trim()).filter(Boolean),name=lang==='粤'?'粤语':'英语';let pending=false;for(const line of lines){if(/^[\[【].*[\]】]$/.test(line)||callIsActionLine(line))continue;const trans=/^[（(][^）)]*[）)]$/.test(line)&&hasCN(line);if(trans){if(pending)pending=false;continue;}if(callBadForeignLine(line,lang))return name+'台词混入了中文或错误格式';const required=lang==='粤'?callCantoneseTranslationRequired(line):callEnglishTranslationRequired(line);if(!required)continue;if(pending)return name+'台词没有逐句普通话翻译';pending=true;}if(pending)return name+'台词没有逐句普通话翻译';return'';}
function callOutputIssue(content,c,video,opt){opt=opt||{};content=String(content||'').trim();if(!content)return'模型返回了空内容';if(isCallRefusal(content)||splitBubbles(content).some(isOOCLine))return'模型跳出角色或输出了拒绝/说教内容';const lang=ttsContentLang(c),langIssue=callTranslationIssue(content,lang);if(langIssue)return langIssue;if(opt.active&&callUnansweredMistake(content))return'模型误以为电话尚未接通';if(video&&opt.active&&!callHasSpokenDialogue(content,lang))return'视频通话没有可播放的角色台词';if(opt.videoVision&&normVoiceLang(lang)==='zh'&&!callVideoVisionReplyGrounded(content,opt.videoVisionScene||''))return'视频通话没有回应当前画面';return'';}
function callScreenShareEventIssue(content,c,video){const issue=callOutputIssue(content,c,video,{active:!!(_call&&_call.state==='active')});if(issue)return issue;const spoken=splitBubbles(content).map(x=>String(x||'').trim()).filter(x=>x&&!callIsActionLine(x)&&!/^[（(][^）)]*[）)]$/.test(x)&&!/^\s*[\[【]/.test(x)).join(' ').trim();if(/(?:got it|okay|understood|noted)[,，—:：\s-]*(?:the )?screen shar(?:e|ing) (?:has |is |has been )?(?:started|ended|stopped|on|off)\b|(?:已收到|知道了|检测到).{0,10}屏幕共享|^屏幕共享(?:已经|现已)?(?:开始|开启|结束|关闭)(?:了|。|！|!)?$/i.test(spoken))return'共享状态回复像系统通知，没有结合本通电话上下文自然反应';return'';}
function callUnansweredMistake(t){t=t||'';return /(?:怎么|为什么|快|先|赶紧|还不|不)?\s*(?:接|接听|接起|接一下|接起来)\s*(?:我)?\s*(?:的)?\s*(?:视频|电话|语音|通话)|(?:视频|电话|语音|通话)\s*(?:怎么|为什么)?\s*(?:还没|不|没)\s*(?:接|接听|接起|接起来)/i.test(t);}
let _voices=[];
function loadVoices(){try{_voices=speechSynthesis.getVoices()||[];}catch(e){_voices=[];}}
if('speechSynthesis'in window){loadVoices();speechSynthesis.onvoiceschanged=loadVoices;}
let _curAudio=null,_curSrc=null;
function stopBufSource(reason){const s=_curSrc;if(!s)return;try{s.__northStopped=reason||'replaced';s.stop();}catch(e){}if(_curSrc===s)_curSrc=null;}
function volMul(){const v=(S.settings&&S.settings.volume!=null)?S.settings.volume:1;return Math.max(0,Math.min(3,v));}
/* VOICE_BAR_FOLLOWS_AUDIO_V1：语音条的动画跟着声音走。以前点了以后按估算时长停，最长 9 秒，声音没放完语音条就不动了。
   现在点语音时记下要动的那一条（voiceBarWant），声音真正开始放时动起来（voiceBarStart），放完、暂停、出错或被别的声音顶掉时停（voiceBarStop）。
   兜底：超过 70 秒没有收到结束事件也停。 */
let _voiceBarWant='',_voiceBarOn='',_voiceBarSafety=0;
function voiceBarSel(id){return '[data-vid="'+String(id||'').replace(/["\\]/g,'')+'"]';}
function voiceBarStop(){clearTimeout(_voiceBarSafety);_voiceBarWant='';if(_voiceBarOn){const on=_voiceBarOn;_voiceBarOn='';try{document.querySelectorAll(on).forEach(e=>e.classList.remove('playing'));}catch(_){}}}
function voiceDisplayDuration(m){const duration=Number(m&&m.dur)||voiceEstimatedSeconds(m&&m.content||'');return Math.min(m&&m.roleSong?21600:VOICE_MAX_SECONDS,Math.max(1,duration));}
function voiceBarWant(id){voiceBarStop();_voiceBarWant=id?voiceBarSel(id):'';}
function voiceBarStart(duration){if(!_voiceBarWant)return;_voiceBarOn=_voiceBarWant;_voiceBarWant='';try{document.querySelectorAll(_voiceBarOn).forEach(e=>e.classList.add('playing'));}catch(_){}clearTimeout(_voiceBarSafety);_voiceBarSafety=setTimeout(voiceBarStop,(Math.max(VOICE_MAX_SECONDS,Math.min(21600,Number(duration)||0))+10)*1000);}
function voiceBarActive(id){return !!id&&_voiceBarOn===voiceBarSel(id);}
function playUrl(url){if(_curAudio&&_voiceBarOn){const want=_voiceBarWant;voiceBarStop();_voiceBarWant=want;}try{if(_curAudio){_curAudio.pause();}}catch(e){}_curAudio=new Audio(url);const active=_curAudio,vol=volMul();try{active.addEventListener('playing',()=>{if(_curAudio===active)voiceBarStart(active.duration);});['ended','pause','error'].forEach(ev=>active.addEventListener(ev,()=>{if(_curAudio===active)voiceBarStop();}));}catch(_){}
  try{ensureAudio();if(_audio&&vol>1){const src=_audio.createMediaElementSource(_curAudio);const g=_audio.createGain();g.gain.value=vol;src.connect(g);g.connect(_audio.destination);}else{_curAudio.volume=Math.max(0,Math.min(1,vol));}}catch(e){try{_curAudio.volume=Math.max(0,Math.min(1,vol));}catch(_){}}
  try{const p=_curAudio.play();if(p&&typeof p.catch==='function')p.catch(async()=>{if(_curAudio!==active)return;try{const ab=await audioDataToBuf(url),buf=await decodeBuf(ab);if(buf)await playBuf(buf);}catch(_){}});}catch(_){} }
async function playBuf(buf){ensureAudio();if(!_audio||!buf)return false;try{if(_audio.state!=='running'){try{await _audio.resume();}catch(e){}}if(_audio.state!=='running')return false;stopBufSource('replaced-by-buffer');const s=_audio.createBufferSource();s.buffer=buf;const g=_audio.createGain();g.gain.value=volMul();s.connect(g);g.connect(_audio.destination);s.onended=()=>{if(_curSrc===s||!_curSrc)voiceBarStop();};s.start();_curSrc=s;voiceBarStart();return true;}catch(e){return false;}}
function voiceAudioKey(m){const x=m&&String(m.audio||'').match(/^idb-audio:(.+)$/i);return x?x[1]:'';}
function voiceAudioExpired(m){if(m&&m.roleSong)return false;return !!(m&&m.role!=='user'&&m.type==='voice'&&m.audio&&Date.now()-Number(m.audioTs||m.time||0)>VOICE_AUDIO_TTL_MS);}
function clearVoiceAudio(m){try{const k=voiceAudioKey(m);if(k)imgDel('__audio_'+k);}catch(_){}if(m){try{if(/^blob:/i.test(String(m._aurl||'')))URL.revokeObjectURL(m._aurl);}catch(_){}delete m.audio;delete m.audioTs;delete m._aurl;delete m._ttsFailAt;}}
function voiceAudioGC(){let changed=false;try{for(const k in S.messages){const a=S.messages[k];if(!Array.isArray(a))continue;a.forEach(m=>{if(voiceAudioExpired(m)){clearVoiceAudio(m);changed=true;}});}}catch(_){}return changed;}
async function audioDataToBuf(audio){if(!audio)return null;
  if(audio instanceof ArrayBuffer)return audio;
  const s=String(audio).trim();if(!s)return null;
  if(/^idb-audio:/i.test(s)){const v=await imgGet('__audio_'+s.slice(10));return v?audioDataToBuf(v):null;}
  if(/^data:audio\//i.test(s)||/^https?:\/\//i.test(s))return await fetch(s).then(x=>x.arrayBuffer());
  const compact=s.replace(/\s+/g,'');
  if(/^[0-9a-f]+$/i.test(compact)&&compact.length%2===0){const bytes=new Uint8Array(compact.length/2);for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(compact.substr(i*2,2),16);return bytes.buffer;}
  try{const bin=atob(compact);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes.buffer;}catch(e){}
  return null;}
function audioBufToDataUrl(ab,type){try{const bytes=ab instanceof Uint8Array?ab:new Uint8Array(ab||[]);let bin='',step=0x8000;for(let i=0;i<bytes.length;i+=step)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+step));return 'data:'+(type||'audio/mpeg')+';base64,'+btoa(bin);}catch(e){return '';}}
const _ttsLedgerMap=typeof WeakMap!=='undefined'?new WeakMap():null;
function ttsLedgerSet(ab,id){try{if(ab&&id&&_ttsLedgerMap)_ttsLedgerMap.set(ab,String(id));}catch(_){}return ab;}
function ttsLedgerGet(ab){try{return ab&&_ttsLedgerMap?_ttsLedgerMap.get(ab):'';}catch(_){return '';}}
function ttsLedgerFromError(e){const d=e&&e.data;return String((e&&(e.ledger_id||e.ledgerId||e.request_id))||(d&&(d.ledger_id||d.ledgerId||d.request_id))||'');}
async function ttsRefundLedger(id,reason){return false;}
async function ttsRefundAudio(ab,reason){const id=ttsLedgerGet(ab);return id?await ttsRefundLedger(id,reason):false;}
async function ttsRefundError(e,reason){const id=ttsLedgerFromError(e);if(!id||e&&e._ttsRefunded)return false;const ok=await ttsRefundLedger(id,reason);if(!ok)return false;try{e._ttsRefunded=true;}catch(_){}return true;}
function ttsVoiceAccessErrorText(s){return /tts-private-voice-not-owned|tts-voice-not-accessible|invalid-voice-id|voice_id|voice id|access to this voice|don't have access|permission|forbidden|unauthorized|401|403|404/i.test(String(s||''));}
function ttsRelayVoiceIds(tts){const selected=String(tts&&(tts.relayVoice||(typeof aiInternalVoiceId==='function'?aiInternalVoiceId():tts.voice))||'').trim();return[selected||DEFAULT_TTS_VOICE];}
async function audioPlayableUrl(audio){if(!audio)return '';const s=String(audio).trim();if(/^idb-audio:/i.test(s)){return (await imgGet('__audio_'+s.slice(10)))||'';}return s;}
/* EXTERNAL_TTS_ERROR_DETAIL_V1: 保留平台明确原因，显示前去除密钥；HTTP码本身不能证明应充值。 */
function externalTtsErrorDetail(raw,key){
  let d;try{d=JSON.parse(String(raw||''));}catch(_){d=String(raw||'');}
  const root=d&&typeof d==='object'?d:null,detail=root&&(root.detail!=null?root.detail:root.error!=null?root.error:root),item=detail&&typeof detail==='object'&&!Array.isArray(detail)?detail:null;
  const code=String(item&&(item.code||item.status)||root&&root.code||'').trim(),validCode=/^[a-z0-9_-]{1,80}$/i.test(code)?code:'',message=typeof detail==='string'?detail:item&&typeof item.message==='string'?item.message:root&&typeof root.message==='string'?root.message:typeof d==='string'?d:'';
  const hints={invalid_api_key:'密钥认证失败',missing_api_key:'未收到有效密钥',invalid_authorization_header:'认证格式不正确',missing_permissions:'密钥缺少所需权限',insufficient_permissions:'密钥缺少所需权限',paid_plan_required:'当前音色或功能需要付费套餐权限',subscription_required:'当前音色或功能需要付费套餐权限',feature_not_available:'当前套餐不支持此功能',payment_required:'账户付费或额度条件不满足',quota_exceeded:'账户额度不足',insufficient_credits:'账户额度不足',voice_not_found:'音色不存在或不可访问',voice_access_denied:'没有此音色的访问权限'};
  let text=[Object.prototype.hasOwnProperty.call(hints,validCode)?hints[validCode]:'',validCode?'['+validCode+']':'',message].filter(Boolean).join(' ');
  if(key)text=text.split(String(key)).join('[密钥已隐藏]');
  return text.replace(/\b(?:sk[_-]|sb_[a-z]+_)[A-Za-z0-9_.-]+/gi,'[密钥已隐藏]').replace(/(Bearer\s+|(?:xi-api-key|api[_-]?key|token)\s*[=:]\s*)[^\s,;"'<>]+/gi,'$1[已隐藏]').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
}
async function externalTtsRelay(tts,body,timeoutMs){const payload=Object.assign({provider:ttsProviderKind(tts),operation:'synthesize',base:String(tts&&tts.base||''),key:String(tts&&tts.key||''),model:String(tts&&tts.model||''),group:String(tts&&tts.group||'')},body||{});if(!payload.key)throw new Error('外置语音缺少 API Key');let r;try{r=await fetchT(EXTERNAL_TTS_RELAY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},timeoutMs||190000);}catch(e){throw new Error('外置语音转发连接失败：'+apiCaughtCN(e));}if(!r.ok){let detail='';try{const raw=await r.clone().text();detail=externalTtsErrorDetail(raw,payload.key);}catch(_){}const e=new Error('外置语音平台 HTTP '+r.status+(detail?'：'+detail.slice(0,180):''));e.status=r.status;e.source='external-tts';throw e;}return r;}
async function _ttsOnce(t,vid,tts,opt){let r;const languageBoost=String(opt&&opt.languageBoost||'auto'),provider=ttsProviderKind(tts);
  if(provider==='mossland'){
    r=await externalTtsRelay(tts,{voice_id:vid,text:t},opt&&opt.timeoutMs);if(r.ok){const type=String(r.headers.get('Content-Type')||'');if(/json/i.test(type)){const j=await r.json(),audio=j&&(j.audio||j.audio_file||j.audio_url||j.url),ab=await audioDataToBuf(audio);return ab?{buf:ab}:{err:'Mossland无音频'};}return {buf:await r.arrayBuffer()};}}
  else if(provider==='fishmcp'){if(typeof NorthFishMcp==='undefined')return {err:'Fish 会员登录模块没有加载'};return await NorthFishMcp.speak({text:t,voiceId:vid,model:tts.model,timeoutMs:opt&&opt.timeoutMs});}
  else if(provider==='fish')r=await externalTtsRelay(tts,{voice_id:vid,text:t},opt&&opt.timeoutMs);
  else if(provider==='elevenlabs')r=await externalTtsRelay(tts,{voice_id:vid,text:t},opt&&opt.timeoutMs);
  else if(provider==='hume')r=await externalTtsRelay(tts,{voice_id:vid,text:t},opt&&opt.timeoutMs);
  else if(provider==='minimax'){const gid=(tts.group||'').trim(),vp=ttsVoiceProfile(t,opt,tts,opt&&opt.voice);
    r=await externalTtsRelay(tts,{group:gid,voice_id:vid||'male-qn-qingse',text:t,language_boost:languageBoost,voice_setting:{speed:vp.speed,vol:vp.vol,pitch:vp.pitch,emotion:vp.emotion}},opt&&opt.timeoutMs);
    if(r.ok){const j=await r.json();const audio=j&&j.data&&(j.data.audio||j.data.audio_file||j.data.audio_url);
      const ab=await audioDataToBuf(audio);if(ab)return {buf:ab};
      return {err:(j&&j.base_resp&&j.base_resp.status_msg)||'无音频'};}
    return {err:r.status};}
  else r=await fetch(tts.base.replace(/\/+$/,'')+'/audio/speech',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tts.key},body:JSON.stringify({model:tts.model||'tts-1',input:t,voice:vid||'alloy'})});
  if(r.ok)return {buf:await r.arrayBuffer()};
  // 把服务端的具体原因抠出来(如 detected_unusual_activity / invalid api key / quota_exceeded)，方便排错
  let detail='';try{const j=await r.clone().json();const d=j&&j.detail;detail=(d&&(d.status||d.message))||(typeof d==='string'?d:'')||(j&&j.message)||'';}catch(e){try{detail=(await r.text()||'').slice(0,80);}catch(_){}}
  return {err:r.status+(detail?(' · '+detail):'')};}
// 语音自动重试：偶发的 401/429/网络抖动会让头一两条没声，最多3次都失败才弹提示。
/* 语音语言锁：角色语音选了英/法/德/俄/韩时，正文里混进来的中文绝不能被念出口。这是合成前的最后一道，
   因为并非每个调用方都会先走 pickSpoken（微信语音消息就是直接把正文交给 ttsArr 的）。只有同一段里确实存在
   目标语言时才清理，清理后为空就原样返回，保证任何情况下都不会把一整句变成哑音。 */
function ttsTidyOrphanPunct(s){return String(s||'').replace(/\s+/g,' ').replace(/\s+([,.;:!?])/g,'$1').replace(/([,;:])(?=[.!?])/g,'').replace(/,\s*,/g,',').replace(/^[\s,;:.!?]+/,'').trim();}
function ttsDropOffLanguage(text,o){const lang=ttsContentLang(o);if(!['英','法','德','俄','韩'].includes(lang))return text;const s=String(text||'');if(!s||!hasForeign(s,lang))return text;const cleaned=ttsTidyOrphanPunct(hasCN(s)?s.replace(CJK_RE,' ').replace(CN_PUNCT_RE,' '):s);return cleaned&&hasForeign(cleaned,lang)?cleaned:text;}
/* 语音字数只算真正念出来的内容：表演标签（[soft]、[chuckling] 等）和发音标注不占字数，不会因为加了标签就超限合成失败 */
function ttsSpokenLength(t){return [...String(t||'').replace(/\[[^\]\n]{1,60}\]/g,'').replace(/<\|phoneme_start\|>[a-z]+[1-5]<\|phoneme_end\|>/gi,'x').replace(/\s+/g,' ').trim()].length;}
/* TTS_DOT_V1（2026-10-30 她要求）：电话、视频和共同生活语音里，名字右边一个小灯：正在生成声音时红灯一闪一闪，生成好了绿灯常亮。 */
let _ttsPending=0;function ttsDotLive(){return typeof _call!=='undefined'&&!!_call&&_call.state==='active';}
function ttsDotHTML(){return '<i class="tts-dot'+(_ttsPending>0?' busy':'')+'" role="img" aria-label="'+(_ttsPending>0?'声音生成中':'声音已就绪')+'"></i>';}
function ttsDotSync(){try{if(typeof document==='undefined')return;document.querySelectorAll('.tts-dot').forEach(el=>{el.classList.toggle('busy',_ttsPending>0);el.setAttribute('aria-label',_ttsPending>0?'声音生成中':'声音已就绪');});}catch(_){}}
async function ttsArr(text,o,opt){opt=Object.assign({},opt||{});text=ttsDropOffLanguage(text,o);const _dotLive=ttsDotLive();if(_dotLive){_ttsPending++;ttsDotSync();}try{if(!opt.languageBoost)opt.languageBoost=ttsLanguageBoost(o);const tts=opt.externalConfig?Object.assign({},opt.externalConfig,{relay:false,enabled:true}):ttsCfg(o),raw=ttsCleanBase(text);if(!raw)return null;if([...raw].length>VOICE_MAX_CHARS){if(!opt.quiet)toast('语音超过'+VOICE_MAX_CHARS+'字，已改用文字');return null;}const t=ttsPerformanceText(text,o,tts,opt);if(!t)return null;/* VOICE_SEND_DIAG_V1：最近 12 句真正交给语音的文字（共同生活语音记录最下面能看），用来查「让TA笑却没有笑声」到底是哪一步丢的 */try{const _d=(window.__northTtsDiag=window.__northTtsDiag||[]);_d.push({at:Date.now(),kind:String(ttsStyleKind(tts)||''),provider:String(tts&&tts.provider||''),model:String(tts&&tts.model||''),relay:!!(typeof ttsRelayOn==='function'&&ttsRelayOn(tts)),vx:!!(typeof NorthVoiceExpressive!=='undefined'&&NorthVoiceExpressive.on()),cue:String(opt.cue||''),ask:String(opt.ask||''),perf:String(opt.perf||''),text:String(text||'').slice(0,160),sent:String(t).slice(0,260)});while(_d.length>12)_d.shift();}catch(_){}if(ttsSpokenLength(t)>VOICE_MAX_CHARS){if(!opt.quiet)toast('语音超过'+VOICE_MAX_CHARS+'字，已改用文字');return null;}const v=o?getVoice(o):null;opt.voice=v;
  if(!ttsEnabled(tts)||(!ttsRelayOn(tts)&&!ttsExternalOn(tts)))return null;const vid=ttsRoleVoiceId(o,tts);

  /* TTS_CALL_TIMEOUT_V1（她要求不能悄悄丢掉声音）：每次请求最多等 60 秒，到时间自动重试，最多 3 次；以前外置每次最长 190 秒、Fish 会员登录完全不限时，可能一句卡好几分钟。 */
  if(!(+opt.timeoutMs>0))opt.timeoutMs=60000;
  let lastErr='',tries=Math.max(1,Math.min(3,+opt.tries||3));
  for(let i=0;i<tries;i++){if(i>0)await new Promise(r=>setTimeout(r,i*600));
    try{const res=await _ttsOnce(t,vid,tts,opt);if(res&&res.buf)return res.buf;lastErr=(res&&res.err)||'无音频';}catch(e){lastErr=(e&&e.message)||'网络';}}
  if(opt.throwExternalError&&lastErr)throw new Error(lastErr);if(!opt.quiet)toast('语音API错误 '+lastErr+(tries>1?'（已自动重试）':''));return null;}finally{if(_dotLive){_ttsPending=Math.max(0,_ttsPending-1);ttsDotSync();}}}
async function decodeBuf(ab){if(!ab)return null;try{initAudio();if(!_audio)return null;return await _audio.decodeAudioData(ab.slice(0));}catch(e){return null;}}
async function speak(text,o){const v=o?getVoice(o):null;
  if(ttsApiOn(o)){initAudio();const ab=await ttsArr(text,o);const buf=await decodeBuf(ab);if(buf)return await playBuf(buf);if(ab)await ttsRefundAudio(ab,'tts-decode-failed');return false;}
  const t=ttsSentencePauseText(ttsSafeProsody(ttsCleanBase(text),o),o);if(!t||!('speechSynthesis'in window))return false;
  try{const u=new SpeechSynthesisUtterance(t);if(v){u.rate=+v.rate||1;u.pitch=+v.pitch||1;applySystemVoice(u,v);}u.onstart=()=>voiceBarStart();u.onend=u.onerror=()=>voiceBarStop();speechSynthesis.cancel();speechSynthesis.speak(u);return true;}catch(e){voiceBarStop();return false;}}
async function speakMsg(m,o){if(m&&m.roleSong)return roleSongSpeakMessage(m,o);const v=o?getVoice(o):null;
  // 用 HTML5 <audio>(blob URL) 播放，反复点都能重放——不像 Web Audio 那样：上下文被 iOS 打断重建后，旧的解码缓冲就放不出声了
  if(voiceAudioExpired(m))clearVoiceAudio(m);
  if(m.audio){const u=await audioPlayableUrl(m.audio);if(u){playUrl(u);return;}}
  if(m._aurl){playUrl(m._aurl);return;}
  if(ttsApiOn(o)){const url=await warmVoiceMsg(m,o);if(url){const u=await audioPlayableUrl(url);if(u){playUrl(u);return;}}voiceBarStop();return;}
  speak(m.content,o);}
/* VOICE_TAP_RETRY_V1：“正在生成”只认这一页里真的在跑的生成。以前 _ttsLoading/_ttsTask 会跟着聊天存下来，生成失败或中途关掉小手机后一直留着，之后点语音条程序以为还在生成，什么都不做，空语音再也点不出声。 */
const _voiceWarmLive=new Set();
function voiceTtsPending(m){return !!(m&&m.role!=='user'&&m.type==='voice'&&!m.audio&&!m._aurl&&(m._ttsTask instanceof Promise||!!m.id&&_voiceWarmLive.has(m.id)));}
function refreshVoiceBubble(m){if(!m||!m.id)return;const el=document.querySelector('[data-vid="'+m.id+'"]');if(!el)return;
  const loading=voiceTtsPending(m),dur=voiceDisplayDuration(m),de=el.querySelector('.vdur');el.classList.toggle('loading',loading);el.classList.toggle('queued',!!m._playWhenReady);el.classList.toggle('playing',voiceBarActive(m.id));el.setAttribute('aria-busy',loading?'true':'false');el.style.minWidth=Math.min(60+dur*8,200)+'px';if(de)de.textContent=dur+'″';}
function warmVoiceMsg(m,o){
  if(m&&m.roleSong)return m.audio||m._aurl||null;
  if(voiceAudioExpired(m))clearVoiceAudio(m);
  if(!m||m.role==='user'||m.type!=='voice'||m.audio||m._aurl||!ttsApiOn(o))return m&&m._aurl;
  if(m._ttsTask instanceof Promise)return m._ttsTask;delete m._ttsTask;
  if(m._ttsFailAt&&Date.now()-m._ttsFailAt<15000&&!((+(typeof window!=='undefined'&&window.__northFishLoginAt)||0)>m._ttsFailAt)){delete m._ttsLoading;refreshVoiceBubble(m);return null;}/* FISH_LOGIN_KEEP_V1：刚重新登录 Fish 就不用等，点一下立刻重新生成 */
  m._ttsLoading=true;refreshVoiceBubble(m);
  m._ttsTask=(async()=>{try{const _vxOn=typeof NorthVoiceExpressive!=='undefined'&&NorthVoiceExpressive.on();if(typeof NorthVoiceExpressive!=='undefined'&&NorthVoiceExpressive.normalize(m))save();if(_vxOn){try{if(await NorthVoiceExpressive.direct(m,o))save();}catch(_){}}/* 语音导演：再做一次表演标注，失败就用行内提示 */if(_vxOn&&(m.voicePerf||m.voiceAsk||m.voiceDirected))NorthVoiceExpressive.handPerf(m.content,m.voicePerf,m.voiceAsk,m.voiceDirected);/* 带小提示的念法交给下一次同一正文的合成；发声仍读 m.content，语言锁照常生效 */let ab=await ttsArr(m.content,o,{cue:m.voiceCue});let _mime='audio/mpeg';
    if(ab){try{const dec=await decodeBuf(ab);if(!dec){await ttsRefundAudio(ab,'tts-decode-failed');m._ttsFailAt=Date.now();return null;}if(dec.duration>VOICE_MAX_SECONDS+.25){await ttsRefundAudio(ab,'tts-over-60-seconds');m.type='text';m.showText=true;m.dur=0;m._ttsFailAt=Date.now();save();if(cur().p==='chat')render();toast('这条语音超过60秒，已改用文字显示');return null;}m.dur=Math.max(1,Math.min(VOICE_MAX_SECONDS,Math.ceil(dec.duration)));/* 3D 贴耳：开关打开时把语音条渲染成双耳立体声；失败就用原来的音频 */if(_vxOn){const bin=await NorthVoiceExpressive.binaural(ab,m.voiceSpatial,m.content);if(bin){ab=bin;_mime='audio/wav';m.voice3d=true;}}const du=audioBufToDataUrl(ab,_mime);if(du){const k=m.id||uid();try{await imgPut('__audio_'+k,du);m.audio='idb-audio:'+k;m.audioTs=Date.now();}catch(_){m.audio=du;m.audioTs=Date.now();}}m._aurl=URL.createObjectURL(new Blob([ab],{type:_mime}));delete m._ttsFailAt;return m.audio||m._aurl;}catch(e){}}
    m._ttsFailAt=Date.now();return null;}catch(e){m._ttsFailAt=Date.now();return null;}})().then(async x=>{delete m._ttsTask;delete m._ttsLoading;if(m.audio)save();refreshVoiceBubble(m);if(x&&m._playWhenReady){delete m._playWhenReady;const u=await audioPlayableUrl(x);if(u){voiceBarWant(m.id);playUrl(u);}refreshVoiceBubble(m);}return x;});
  return m._ttsTask;}
const _voiceWarmQueues=new Map();
function scheduleVoiceWarm(m,o,progressive){
  if(!m||m.type!=='voice')return;
  const live=m.id;if(live)_voiceWarmLive.add(live);const done=()=>{if(live)_voiceWarmLive.delete(live);if(!m.audio&&!m._aurl&&!(m._ttsTask instanceof Promise)){delete m._ttsLoading;refreshVoiceBubble(m);}};
  if(!progressive){setTimeout(()=>{Promise.resolve().then(()=>warmVoiceMsg(m,o)).catch(()=>null).finally(done);},80);return;}
  const key=String(o&&o.id||'chat');let task;
  task=Promise.resolve(_voiceWarmQueues.get(key)).catch(()=>null).then(()=>warmVoiceMsg(m,o)).finally(()=>{done();if(_voiceWarmQueues.get(key)===task)_voiceWarmQueues.delete(key);});
  _voiceWarmQueues.set(key,task);
}
function playVoice(mid){let m,owner;for(const k in S.messages){const x=S.messages[k].find(y=>y.id===mid);if(x){m=x;owner=k;break;}}if(!m)return;
  if(voiceTtsPending(m))return;
  if(m.role!=='user'&&m.type==='voice'&&!m.audio&&!m._aurl){delete m._ttsFailAt;delete m._ttsLoading;delete m._ttsTask;}
  voiceBarWant(mid);
  speakMsg(m,m.role==='user'?S.me:getC(owner));}
/* ===== 顶部消息通知 ===== */
let _bannerT;
let _swReady=null;
let _swEventsBound=false,_northUpdatePending='',_northUpdatePromptTimer=0;
function northBuildNumber(v){const m=String(v==null?'':v).match(/\d+/);return m?Number(m[0]):0;}
function northUpdateLater(){const build=_northUpdatePending;if(build)try{sessionStorage.setItem('north-update-later-'+build,'1');}catch(_){}closeModal();}
function northUpdateReload(){const build=_northUpdatePending||'';try{sessionStorage.setItem('north-update-reload-'+build,'1');}catch(_){}const next=new URL(location.href);next.searchParams.set('north_update',build||Date.now());location.replace(next.href);}
function northUpdatePrompt(){clearTimeout(_northUpdatePromptTimer);_northUpdatePromptTimer=0;const build=_northUpdatePending;if(!build)return;try{if(sessionStorage.getItem('north-update-later-'+build)==='1')return;}catch(_){}const modal=$('#modal');if(!modal||modal.classList.contains('show')){_northUpdatePromptTimer=setTimeout(northUpdatePrompt,1800);return;}openModal(`<h3>发现新版本 v${esc(build)}</h3><div class="hint" style="line-height:1.8">新版本已经下载完成。点“立即更新”会直接刷新到最新版，不需要退出或划掉小手机；聊天、角色和本机数据不会删除。</div><div class="btns" style="margin-top:14px"><button class="btn g" onclick="northUpdateLater()">稍后</button><button class="btn p" onclick="northUpdateReload()">立即更新</button></div>`);}
function northUpdateAvailable(build){build=String(build||'').replace(/\D/g,'');const current=northBuildNumber(window.__NORTH_SHELL_BUILD__);if(!build||northBuildNumber(build)<=current)return false;_northUpdatePending=build;northUpdatePrompt();return true;}
function northUpdateCheck(reg){if(!reg)return;try{const worker=reg.active||navigator.serviceWorker.controller;if(worker)worker.postMessage({type:'north-version-query'});}catch(_){}return Promise.resolve().then(()=>reg.update()).catch(()=>{});}
function appServiceWorkerMessage(e){const d=e&&e.data||{};if(d.type==='north-update-ready'){northUpdateAvailable(d.build);return;}appRouteFromNotify(d);}
function registerSW(){if(_swReady)return _swReady;if(NORTH_PREVIEW||!('serviceWorker'in navigator)||location.protocol==='file:')return Promise.resolve(null);
//@@ web
  const url='sw.js?v=1936&r=v1936-owner-todo-report-1';
//@@ private
  const url='sw.js?v=1419&r=v1419-private-pf-role-1';
//@@ end
  if(!_swEventsBound){_swEventsBound=true;navigator.serviceWorker.addEventListener('message',appServiceWorkerMessage);}
  _swReady=navigator.serviceWorker.register(url,{updateViaCache:'none'}).catch(()=>navigator.serviceWorker.register(url)).then(reg=>{const ask=()=>northUpdateCheck(reg);ask();setTimeout(ask,800);const watch=()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='activated')ask();});};reg.addEventListener('updatefound',watch);watch();navigator.serviceWorker.addEventListener('controllerchange',ask);window.addEventListener('pageshow',ask);document.addEventListener('visibilitychange',()=>{if(!document.hidden)ask();});setInterval(()=>reg.update().catch(()=>{}),15*60*1000);return reg;}).catch(()=>null);
  return _swReady;}
function appRouteFromNotify(d){if(!d||d.type!=='open')return;
  try{if(navigator.clearAppBadge)navigator.clearAppBadge().catch(()=>{});}catch(e){}
  if(d.target==='chat'&&d.id){openChat(d.id);return;}
  if(d.target==='group'&&d.id){go('group',{id:d.id});return;}
  if(d.target==='pfchat'&&d.id){openPhoneFriendChat(d.id);return;}
  if(d.target==='pfgroup'&&d.id){openPhoneFriendGroup(d.id);return;}
  if(d.target==='phonesms'&&d.id){openPhoneSMS(d.id);return;}
  if(d.target==='call'){if(_call)openIncoming();else go('home');return;}
  if(d.target==='mail'){go('mail');return;}
  if(d.target==='x'){openX();return;}}
function routeHash(){const h=(location.hash||'').replace(/^#/,'');if(!h)return;
  const m=h.match(/^chat=([^&]+)/);if(m){history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>openChat(decodeURIComponent(m[1])),300);return;}
  const gm=h.match(/^group=([^&]+)/);if(gm){history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>go('group',{id:decodeURIComponent(gm[1])}),300);return;}
  if(h==='call'){history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>{if(_call)openIncoming();},300);return;}
  if(h==='mail'){history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>go('mail'),300);return;}
  if(h==='x'){history.replaceState(null,'',location.pathname+location.search);setTimeout(()=>openX(),300);}}
function appNotify(title,body,opt){if(!document.hidden)return;opt=opt||{};if(!('Notification'in window)||Notification.permission!=='granted')return;
  const data=opt.data||{},icon='icon.png';const nopt={body:body||'',icon,badge:icon,tag:opt.tag||('phone-'+Date.now()),renotify:!!opt.renotify,requireInteraction:!!opt.requireInteraction,data:data};
  if(opt.vibrate)nopt.vibrate=opt.vibrate;
  try{if(navigator.setAppBadge)navigator.setAppBadge(1).catch(()=>{});}catch(e){}
  const fallback=()=>{try{const n=new Notification(title,nopt);n.onclick=()=>{try{window.focus();appRouteFromNotify(Object.assign({type:'open'},data));n.close();}catch(e){}};}catch(e){}};
  registerSW().then(reg=>{if(reg&&reg.showNotification)reg.showNotification(title,nopt).catch(fallback);else fallback();});}
let _msgBannerGesture=null,_msgBannerNoClickUntil=0;
function msgBannerGesture(e){
  const b=e.currentTarget;if(!b)return;
  if(e.type==='pointerdown'){
    if(!b.classList.contains('show')||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
    _msgBannerGesture={id:e.pointerId,x:e.clientX,y:e.clientY,body:b.innerHTML,moved:false};
    try{b.setPointerCapture(e.pointerId);}catch(_){}return;
  }
  const g=_msgBannerGesture;if(!g||g.id!==e.pointerId)return;
  if(!b.classList.contains('show')||b.innerHTML!==g.body){_msgBannerGesture=null;return;}
  const dx=e.clientX-g.x,dy=e.clientY-g.y;
  if(Math.abs(dx)>8||Math.abs(dy)>8)g.moved=true;
  if(e.type==='pointermove'&&dy<=-28&&-dy>Math.abs(dx)*1.2){
    _msgBannerNoClickUntil=Date.now()+500;_msgBannerGesture=null;
    clearTimeout(_bannerT);b.className='msgbanner';b.onclick=null;
    if(e.cancelable)e.preventDefault();return;
  }
  if(e.type==='pointerup'||e.type==='pointercancel'){
    if(g.moved||e.type==='pointercancel')_msgBannerNoClickUntil=Date.now()+500;
    _msgBannerGesture=null;
  }
}
if(typeof document!=='undefined')document.addEventListener('click',function(e){
  if(Date.now()<_msgBannerNoClickUntil&&e.target&&e.target.closest&&e.target.closest('#msgBanner')){
    e.preventDefault();e.stopImmediatePropagation();
  }
},true);
function showMsgBanner(c,msg){
  lockNotify(c.remark||c.name,previewOf(msg),{avatar:c.avatar,target:{type:'chat',id:c.id}});
  if(lockVisible())return;
  const b=$('#msgBanner');if(!b)return;
  b.innerHTML=`${av(c.avatar,'sm')}<div style="flex:1;min-width:0"><div class="bn">${esc(c.remark||c.name)}</div><div class="bm">${esc(previewOf(msg))}</div></div>`;
  b.className='msgbanner show';b.onclick=()=>{b.className='msgbanner';openChat(c.id);};
  clearTimeout(_bannerT);_bannerT=setTimeout(()=>{b.className='msgbanner';},4500);}
function lockDateText(t){const d=new Date(t||Date.now()),w=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getDay()];return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日 '+w;}
function lockNotes(){S.me=S.me||{};if(!Array.isArray(S.me.lockNotes))S.me.lockNotes=[];return S.me.lockNotes;}
function lockVisible(){const e=$('#lockScreen');return !!(e&&e.classList.contains('show'));}
function lockTargetKey(t){if(!t)return '';return [t.type||'',t.id||t.gid||t.cid||'',t.tab||''].join(':');}
function lockClearTarget(target,silent){try{const key=lockTargetKey(target);if(!key)return false;const arr=lockNotes();let changed=false;for(let i=arr.length-1;i>=0;i--){if(lockTargetKey(arr[i]&&arr[i].target)===key){arr.splice(i,1);changed=true;}}if(changed&&!silent){save(500);renderLockScreen(true);}return changed;}catch(_){return false;}}
let _lockFreshId='';
function lockNotify(title,body,opt){body=rolePublicText(body);if(!body)return;try{opt=opt||{};const arr=lockNotes(),id='ln_'+uid(),note={id,title:String(title||'通知').slice(0,40),body:String(body||'').replace(/\s+/g,' ').slice(0,80),time:Date.now(),avatar:opt.avatar||'',icon:opt.icon||'',target:opt.target||null};arr.unshift(note);if(arr.length>4)arr.length=4;_lockFreshId=id;save(600);renderLockScreen(true);}catch(_){}}
function lockAvatarHTML(n){if(n&&n.avatar)return av(n.avatar,'sm');if(n&&n.icon)return `<div class="avatar sm" style="background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.13)">${svgIc(n.icon,18,'#fff',1.7)}</div>`;return `<div class="avatar sm" style="background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.13)">${svgIc('bell',18,'#fff',1.7)}</div>`;}
function lockRgbValue(hex){hex=widgetHex(hex,'#ffffff');const n=parseInt(hex.slice(1),16);return ((n>>16)&255)+','+((n>>8)&255)+','+(n&255);}
function lockAppearanceVars(){const time=homeClockColor(),tint=glassThemeOn()?glassWidgetTint():widgetCardColor(),opacity=(glassThemeOn()?glassWidgetOpacity():widgetOpacityValue())/100,a=Math.max(.025,Math.min(.72,opacity));return {'--lock-time-rgb':lockRgbValue(time),'--lock-glass-main':widgetRgba(tint,a),'--lock-glass-soft':widgetRgba(tint,Math.max(.02,a*.42)),'--lock-glass-shine':widgetRgba(tint,Math.min(.42,a+.12)),'--lock-glass-line':widgetRgba(tint,Math.min(.58,a+.2))};}
function applyLockAppearance(el){if(!el)return;Object.entries(lockAppearanceVars()).forEach(([key,value])=>el.style.setProperty(key,value));}
function lockOpenTarget(n){if(!n||!n.target){lockOpen();return;}const t=n.target;lockClearTarget(t,true);save(300);lockOpen();setTimeout(()=>{if(t.type==='chat')openChat(t.id);else if(t.type==='pfchat')openPhoneFriendChat(t.id);else if(t.type==='pfgroup')openPhoneFriendGroup(t.id);else if(t.type==='phonesms')openPhoneSMS(t.id);else if(t.type==='phonecall')go('phonecall');else if(t.type==='group'){lockClearTarget({type:'group',id:t.id},true);go('group',{id:t.id});}else if(t.type==='mail'){lockClearTarget({type:'mail'},true);go('mail');}else if(t.type==='x'){lockClearTarget({type:'x'},true);openX();}else if(t.type==='wechat')openWeChat(t.tab||'chats');},80);}
function lockNoteHTML(n,i){const fresh=n&&n.id===_lockFreshId;return `<div class="locknote${fresh?' fresh':''}"${fresh?' style="animation-delay:0ms"':''} onclick="lockOpenTarget(lockNotes().find(x=>x.id==='${n.id}')||null)">${lockAvatarHTML(n)}<div class="ltxt"><div class="lt">${esc(n.title)}</div><div class="lb">${esc(n.body||'打开查看')}</div></div><div class="lk">${hm(n.time)}</div></div>`;}
function lockTimeMask(value){const safe=String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 108"><text x="150" y="96" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="100" font-weight="520" letter-spacing="-1.5">${safe}</text></svg>`;return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;}
function applyLockTimeMaterial(el,value){if(!el)return;el.style.setProperty('--lock-time-mask',lockTimeMask(value));}
let _lockClockPaintKey='';
function renderLockClock(force){const e=$('#lockScreen');if(!e||!force&&(document.hidden||!e.classList.contains('show')))return;const t=e.querySelector('.locktime'),d=e.querySelector('.lockdate'),v=hm(),date=lockDateText(),key=v+'|'+date;if(!force&&_lockClockPaintKey===key&&(!t||t.textContent===v)&&(!d||d.textContent===date))return;_lockClockPaintKey=key;if(t){t.textContent=v;t.dataset.time=v;applyLockTimeMaterial(t,v);}if(d)d.textContent=date;}
function renderLockScreen(fresh){const el=$('#lockScreen');if(!el||!S||!S.me)return;const show=S.me.locked!==false;el.classList.toggle('show',show);if(!show&&!fresh)return;const bg=storedImageDisplaySource(S.me.lockBg||S.me.homeBg||''),notes=lockNotes().filter(n=>n&&rolePublicText(n.body)).map(n=>Object.assign({},n,{body:rolePublicText(n.body)})).slice(0,4);
  applyLockAppearance(el);const clock=hm();el.innerHTML=`<div class="lockbg" style="${isImg(bg)?'background-image:url('+bg+');':''}"></div><div class="lockshade"></div><div class="locktop"><div class="lockdate">${lockDateText()}</div><div class="locktime" data-time="${clock}">${clock}</div></div><div class="locknotes">${notes.length?notes.map(lockNoteHTML).join(''):'<div class="lockempty">暂无新通知</div>'}</div><div class="lockbottom"><button class="lockquick" onclick="lockQuickTorch(event)" title="手电筒">${svgIc('flashlight',24,'#fff',1.75)}</button><div class="lockhint" onclick="lockOpen()"><div class="lockup"></div><div>上滑进入小手机</div><div class="lockhandle"></div></div><button class="lockquick" onclick="lockQuickCamera(event)" title="相机">${svgIc('camera',24,'#fff',1.75)}</button></div>`;applyLockTimeMaterial(el.querySelector('.locktime'),clock);_lockFreshId='';}
function renderLockPull(){const e=$('#lockPull');if(!e||!S||!S.me)return false;let on=false;try{on=S.me.locked===false&&cur().p==='home'&&homePageClamp(_homePage)===0&&!_call;}catch(_){}e.classList.toggle('show',!!on);e.style.display=on?'':'none';e.setAttribute('aria-hidden',on?'false':'true');e.tabIndex=on?0:-1;lockPullAppearancePaint(e);return !!on;}
let _lockPullRefreshTimer=0;
function lockPullRefresh(){clearTimeout(_lockPullRefreshTimer);renderLockPull();_lockPullRefreshTimer=setTimeout(renderLockPull,90);setTimeout(renderLockPull,360);}
window.addEventListener('pageshow',lockPullRefresh,{passive:true});
window.addEventListener('focus',lockPullRefresh,{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)lockPullRefresh();});
function lockOpen(){S.me.locked=false;save();renderLockScreen();renderLockPull();}
function lockShow(drop){if(_call)return;const el=$('#lockScreen');if(el)el.style.transform='';const b=$('#msgBanner');if(b)b.className='msgbanner';S.me.locked=true;save();renderLockScreen(true);renderLockPull();}
let _lockAwayAt=0;
function lockPrepareAway(force){try{S.me=S.me||{};_lockAwayAt=0;if(force){S.me.locked=true;saveNow();return true;}if(_savePending)saveNow();return false;}catch(_){return false;}}
function lockResumeFromAway(){_lockAwayAt=0;return false;}
function lockQuickTorch(e){try{e.stopPropagation();}catch(_){}toast('手电筒已点亮');}
function lockQuickCamera(e){try{e.stopPropagation();}catch(_){}lockOpen();setTimeout(()=>openApp('moments'),80);}
let _lockTouch=null;
function lockGestureReset(){const ls=$('#lockScreen');if(ls){ls.classList.remove('dragging');ls.style.transform='';}}
function initLockGestures(){if(window._lockGesturesInit)return;window._lockGesturesInit=1;
  const begin=(target,x,y)=>{const ls=$('#lockScreen'),locked=ls&&ls.classList.contains('show');if(locked&&ls.contains(target)){_lockTouch={mode:'unlock',x,y,t:Date.now()};return;}if(!locked&&cur().p==='home'&&y<132)_lockTouch={mode:'lock',x,y,t:Date.now()};};
  const move=(x,y,e)=>{if(!_lockTouch)return;const dy=y-_lockTouch.y,dx=Math.abs(x-_lockTouch.x);if(dx>70){_lockTouch=null;lockGestureReset();return;}if(_lockTouch.mode==='unlock'&&dy<-26){try{e.preventDefault();}catch(_){}const ls=$('#lockScreen');if(ls){ls.classList.add('dragging');ls.style.transform='translateY('+Math.max(-90,dy*.45)+'px)';}}else if(_lockTouch.mode==='lock'&&dy>18){try{e.preventDefault();}catch(_){} }};
  const end=(x,y)=>{if(!_lockTouch)return;const dy=y-_lockTouch.y,dt=Date.now()-_lockTouch.t,mode=_lockTouch.mode;_lockTouch=null;lockGestureReset();if(mode==='unlock'&&(dy<-58||(dy<-35&&dt<260)))lockOpen();else if(mode==='lock'&&(dy>62||(dy>40&&dt<280)))lockShow(true);};
  const cancel=()=>{_lockTouch=null;lockGestureReset();};
  if('PointerEvent'in window){
    document.addEventListener('pointerdown',e=>begin(e.target,e.clientX,e.clientY), {passive:true});
    document.addEventListener('pointermove',e=>move(e.clientX,e.clientY,e), {passive:false});
    document.addEventListener('pointerup',e=>end(e.clientX,e.clientY));
    document.addEventListener('pointercancel',cancel);
  }else{
    document.addEventListener('touchstart',e=>{const t=e.touches&&e.touches[0];if(t)begin(e.target,t.clientX,t.clientY);}, {passive:true});
    document.addEventListener('touchmove',e=>{const t=e.touches&&e.touches[0];if(t)move(t.clientX,t.clientY,e);}, {passive:false});
    document.addEventListener('touchend',e=>{const t=e.changedTouches&&e.changedTouches[0];if(t)end(t.clientX,t.clientY);});
    document.addEventListener('touchcancel',cancel);
  }
}
/* ===== 真·录音 长按说话 ===== */
let _rec=null;
function sttLangCode(lang){lang=String(lang||'').trim().toLowerCase();if(/^(?:粤|粵|yue|cantonese|zh-hk)/.test(lang))return'yue-HK';if(/^(?:英|en|en-|english)/.test(lang))return lang==='en-gb'?'en-GB':'en-US';if(/^(?:日|ja|jp|japanese)/.test(lang))return'ja-JP';if(/^(?:韩|ko|kr|korean)/.test(lang))return'ko-KR';return'zh-CN';}
function sttApiLang(lang){return {'zh-CN':'zh','yue-HK':'zh','en-US':'en','en-GB':'en','ja-JP':'ja','ko-KR':'ko'}[sttLangCode(lang)]||'zh';}
function sttRelayLang(lang){return sttLangCode(lang)==='yue-HK'?'yue':sttApiLang(lang);}
function makeSR(lang){const nativeFactory=window.__SMALL_PHONE_PRIVATE__===true&&window.SmallPhoneNativeSpeech&&window.SmallPhoneNativeSpeech.create;if(nativeFactory)try{const r=nativeFactory();r.lang=sttLangCode(lang||((S.settings.stt||{}).lang));r.interimResults=true;r.continuous=true;return r;}catch(e){}const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return null;try{const r=new SR();r.lang=sttLangCode(lang||((S.settings.stt||{}).lang));r.interimResults=true;r.continuous=true;return r;}catch(e){return null;}}
async function startRec(cb,opt){if(_rec)return;opt=opt||{};
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    _audioMicGranted=true;const mr=new MediaRecorder(stream);const chunks=[];mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    const sr=makeSR();let srText='';if(sr){sr.onresult=ev=>{srText='';for(let i=0;i<ev.results.length;i++)srText+=ev.results[i][0].transcript;};try{sr.start();}catch(e){}}
    _rec={mr,chunks,stream,sr,start:Date.now(),getText:()=>srText};mr.start();
    _rec.limitTimer=setTimeout(()=>{if(_rec&&_rec.mr===mr){if(typeof opt.onLimit==='function')opt.onLimit();else toast('已到60秒，请松开发送');}},60000);
    toast(opt.hint||'松开发送，上滑取消（最长60秒）');if(cb)cb();
  }catch(e){toast('用不了麦克风（需允许权限/用https打开）');}}
function stopRec(cancel,cb){if(!_rec)return;const R=_rec;_rec=null;
  clearTimeout(R.limitTimer);
  if(R.sr){try{R.sr.stop();}catch(e){}}
  R.mr.onstop=async()=>{R.stream.getTracks().forEach(t=>t.stop());
    if(cancel){if(cb)cb(null);return;}
    const dur=Math.max(1,Math.round((Date.now()-R.start)/1000));
    if(dur>VOICE_MAX_SECONDS){toast('语音不能超过60秒，请重新录制');if(cb)cb(null);return;}
    const blob=new Blob(R.chunks,{type:R.mr.mimeType||'audio/webm'});
    const content=(R.getText()||'').trim(),error='';
    const b64=await blobB64(blob);
    if(cb)cb({audio:b64,blob,content:content,dur,error});};
  try{R.mr.stop();}catch(e){R.stream&&R.stream.getTracks().forEach(t=>t.stop());if(cb)cb(null);}}
function blobB64(blob){return new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(blob);});}
async function sttRecordedWav(blob,durationSeconds){if(!blob||!blob.size)throw new Error('没有录到声音，请检查麦克风权限');if(/audio\/wav/i.test(String(blob.type||'')))return blob;let audio=null;try{audio=await decodeBuf(await blob.arrayBuffer());}catch(_){}if(!audio)throw new Error('当前手机录音格式无法读取，请关闭页面后重新打开再试');const end=Math.min(audio.duration,Math.max(.2,Number(durationSeconds)||audio.duration));const wav=await cinemaAudioChunkWav(audio,0,end,16000);if(!wav||!wav.size)throw new Error('录音转换失败，请重新录一次');return wav;}
function sttUploadName(blob,name){name=String(name||'').trim();if(name)return name.replace(/[^\w.\-\u4e00-\u9fff]/g,'_').slice(-120);const type=String(blob&&blob.type||'').toLowerCase(),ext=/mp4|m4v/.test(type)?'mp4':/mpeg|mp3/.test(type)?'mp3':/wav/.test(type)?'wav':/ogg/.test(type)?'ogg':'webm';return 'audio.'+ext;}
function sttRequestId(){let id='';try{id=crypto.randomUUID();}catch(_){id=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);}return'asr_'+id;}
//@@ web
async function sttRequest(blob,opt){opt=opt||{};const a=sttCfg(),name=sttUploadName(blob,opt.name),rawLang=opt.lang||a.lang,language=sttApiLang(rawLang);if(!a.base||!a.key)throw new Error('请先在设置 → 语音转文字里填写外置接口');const fd=new FormData();fd.append('file',blob,name);fd.append('model',a.model||'whisper-1');fd.append('language',language);if(opt.timestamps){fd.append('response_format','verbose_json');fd.append('timestamp_granularities[]','segment');}
//@@ private
async function sttRequest(blob,opt){opt=opt||{};const a=sttCfg(),name=sttUploadName(blob,opt.name),rawLang=opt.lang||a.lang,language=sttApiLang(rawLang);if(!a.base||!a.key)throw new Error('请先在设置 → 语音转文字里填写外置接口');const fd=new FormData();fd.append('file',blob,name);fd.append('model',a.model||'whisper-1');fd.append('language',language);if(opt.purpose==='robot_voice'&&opt.prompt)fd.append('prompt',String(opt.prompt).slice(0,224));if(opt.timestamps){fd.append('response_format','verbose_json');fd.append('timestamp_granularities[]','segment');}
//@@ end
  const r=await fetch(a.base.replace(/\/+$/,'')+'/audio/transcriptions',{method:'POST',headers:{'Authorization':'Bearer '+a.key},body:fd});let j={};try{j=await r.json();}catch(_){try{j={error:{message:(await r.text()).slice(0,180)}};}catch(__){}}if(!r.ok)throw new Error((j&&j.error&&j.error.message)||j.message||('语音转写接口错误 '+r.status));return j;}
async function sttTranscribe(blob,opt){const j=await sttRequest(blob,opt);return (j.text||'').trim();}
function sttTimedRows(j,offset){offset=Number.isFinite(+offset)?+offset:0;const rows=Array.isArray(j&&j.segments)?j.segments:Array.isArray(j&&j.chunks)?j.chunks:[];return rows.map(x=>{const ts=x.timestamp||x.timestamps||[],start=Number(x.start!=null?x.start:ts[0]),end=Number(x.end!=null?x.end:ts[1]),text=String(x.text||'').replace(/\s+/g,' ').trim();return {start:start+offset,end:end+offset,text,source:'extract'};}).filter(x=>Number.isFinite(x.start)&&Number.isFinite(x.end)&&x.end>x.start&&x.text);}
async function sttTranscribeTimed(blob,name){const j=await sttRequest(blob,{name,timestamps:true}),rows=Array.isArray(j.segments)?j.segments:Array.isArray(j.chunks)?j.chunks:[];return rows.map(x=>{const ts=x.timestamp||x.timestamps||[],start=Number(x.start!=null?x.start:ts[0]),end=Number(x.end!=null?x.end:ts[1]),text=String(x.text||'').replace(/\s+/g,' ').trim();return {start,end,text,source:'extract'};}).filter(x=>Number.isFinite(x.start)&&Number.isFinite(x.end)&&x.end>x.start&&x.text);}
function fmtDur(ms){const m=Math.round(ms/60000);if(m<60)return m+'分钟';const h=Math.round(m/60);if(h<24)return h+'小时';return Math.round(h/24)+'天';}
function personaPin(c){const relationPin=isMain()?(meIsAdult()?'你们是已确认成年、自愿的亲密关系；亲密氛围里的害羞、口头抗拒和规矩感不要误判成现实强迫，若需要收住就用你的口吻自然放慢、确认、留白或安抚。':''):'当前联系人是独立身份，只按ta的身份设定和这个聊天框的记录判断关系；绝对不要猜测ta是别人的另一个账号，也不要带入你和其他联系人的关系或回忆。';return '【保持角色】你是「'+(c.name)+'」本人，请继续完全以ta的身份、性格、口吻回应'+S.me.name+'。绝不要跳出角色、绝不要说自己是AI/人工智能/助手/语言模型，不要说教、不要无故拒绝、不要解释规则，自然沉浸地接着聊。'+relationPin;}
/* 微信文字自动翻译只看角色可见文字。网址、邮箱和很短的英文口头词不触发，
   其余常见外文书写系统统一交给当前聊天路线翻成简体中文。 */
function roleTextLanguageStats(text){const s=String(text||'').replace(/https?:\/\/\S+|www\.\S+|\b[\w.+-]+@[\w.-]+\.\w+\b/gi,' '),count=re=>(s.match(re)||[]).length;return{han:count(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g),latin:count(/[A-Za-z\u00c0-\u024f]/g),kana:count(/[\u3040-\u30ff\u31f0-\u31ff]/g),hangul:count(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g),other:count(/[\u0370-\u052f\u0530-\u058f\u0590-\u08ff\u0900-\u0fff\u1000-\u109f\u10a0-\u10ff\u1200-\u18af\u1e00-\u1eff\u2c00-\u2dff\ua000-\ua4cf\ua500-\ua7ff]/g)};}
function roleTextNeedsTranslation(text){const n=roleTextLanguageStats(text);if(n.kana+n.hangul+n.other>=2)return true;return n.latin>=4&&(n.han===0||n.latin>n.han*1.5);}
function voiceLangName(lang){lang=normVoiceLang(lang);return lang==='粤'?'粤语':lang==='英'?'英语':lang==='日'?'日语':lang==='韩'?'韩语':lang==='法'?'法语':lang==='德'?'德语':lang==='俄'?'俄语':'';}
function voicePromptExample(lang){lang=normVoiceLang(lang);return lang==='粤'?'我好掛住你。\n（我很想你。）\n過嚟啦。\n（过来吧。）':lang==='韩'?'사랑해\n（我爱你）\n보고 싶어\n（我想你了）':lang==='日'?'好きだよ\n（喜欢你）\n会いたい\n（我想你了）':lang==='法'?'Tu me manques.\n（我想你了。）\nViens ici.\n（过来。）':lang==='德'?'Du fehlst mir.\n（我想你了。）\nKomm her.\n（过来。）':lang==='俄'?'Я скучаю по тебе.\n（我想你了。）\nИди сюда.\n（过来。）':'I miss you\n（我想你了）\nCome here\n（过来）';}
function voiceOriginalRule(lang){lang=normVoiceLang(lang);return lang==='粤'?'第一栏必须使用自然地道的粤语口语和粤语用字，不能写成普通话句子；第二栏必须是准确的普通话中文翻译。':'第一栏必须是对应外语，不能写中文；第二栏必须是中文翻译。';}
function voiceTagNeedsLangFix(content,c){const lang=ttsContentLang(c);return splitBubbles(content).some(l=>{const v=parseVoiceTagLine(l);return !!(v&&((lang&&lang!=='zh'&&(!hasForeign(v.text,lang)||!/[\u3400-\u9fff]/.test(v.trans||'')))||roleReplyEnglishOnly(String(v.text||'')+'\n'+String(v.trans||''))));});}
function selfHarmSafetyRefusal(t){t=String(t||'');return /(?:i (?:can'?t|cannot|am unable|won'?t)|i(?:'m| am) (?:concerned|worried)|please (?:contact|call|reach out)|seek (?:immediate|professional)|crisis (?:line|hotline)|emergency services)[^.!?\n]{0,120}(?:self[- ]?harm|harm(?:ing)? yourself|hurt(?:ing)? yourself|suicid(?:e|al)|immediate danger)|(?:self[- ]?harm|harm(?:ing)? yourself|hurt(?:ing)? yourself|suicid(?:e|al))[^.!?\n]{0,120}(?:i (?:can'?t|cannot|am unable)|concerned|crisis|hotline|emergency|professional help)|(?:我(?:不能|无法|很担心|担心)|建议你|请(?:立即)?(?:联系|拨打)|寻求(?:专业|紧急)|危机热线|心理援助热线|紧急服务)[^。！!\n]{0,100}(?:自我伤害|伤害自己|自残|自杀|轻生|现实暴力|人身伤害)|(?:自我伤害|自残|自杀|轻生)[^。！!\n]{0,100}(?:我(?:不能|无法|担心)|建议|联系|拨打|热线|紧急|专业帮助)/i.test(t);}
function intimateRoleRefusal(t){t=String(t||'').trim();if(/^(?:let'?s (?:change|switch) (?:the )?topic|that crosses (?:a|my) (?:boundary|line)|(?:让我们|我们)(?:先)?(?:换一个|换个|改变)(?:这段|这个)?话题|这(?:已经)?越过了我的(?:界限|底线))[.!?。！]*$/i.test(t))return false;return /i (?:need|have) to (?:step|break) (?:out of|away from) (?:character|this (?:roleplay|scene|scenario))|i(?:'m| am) (?:not comfortable|uncomfortable|unable|not able|not willing) (?:continuing|participating|engaging|going further|with (?:this|that))|i (?:can'?t|cannot|won'?t) (?:continue|participate in|engage in|portray|write|play out) (?:this |that )?(?:intimate|sexual|explicit|romantic|controlling|coercive|abusive|toxic)?\s*(?:roleplay|scene|scenario|dynamic|content|interaction)|i can (?:continue|help) with (?:affection|romance|a romantic scene),? but (?:not|i can'?t)|let'?s (?:pause|stop|step back|redirect|change|switch to) (?:this |the )?(?:roleplay|scene|conversation|topic|direction|scenario)|we (?:need|should) (?:keep|make) (?:this|things|the scene) (?:respectful|appropriate|safe|healthy|non-explicit)|i(?:'d| would) be happy to (?:help|continue|explore) (?:with )?(?:a )?(?:different|safer|non-explicit|less intense)(?:,?\s+(?:different|safer|non-explicit|less intense))* (?:scene|scenario|topic|direction)|i can'?t (?:romanticize|normalize|support) (?:a )?(?:controlling|coercive|abusive|toxic) (?:relationship|dynamic|behaviou?r)|that crosses (?:a|my) (?:boundary|line)|我(?:需要|得|必须)(?:先)?(?:跳出角色|退出角色|停止扮演|暂停(?:这段)?(?:剧情|角色扮演|情境))|我(?:不舒服|不愿意|不适合|无法|不能)(?:再|继续)?(?:参与|进行|延续|扮演|描写)?(?:这段|这种|这个)?(?:亲密|露骨|性|控制|强迫|虐待|有毒)?(?:互动|内容|剧情|情节|关系|角色扮演|场景)|我可以(?:继续|陪你)(?:写|聊|进行)?(?:浪漫|亲密|温柔)(?:的)?(?:互动|剧情|场景)?(?:，|,|但|不过)+(?:不能|无法|不可以)(?:继续|涉及|描写)|(?:让我们|我们)(?:先)?(?:暂停|停止|换一个|换个|转到|改变)(?:这段|这个)?(?:话题|场景|剧情|方向|角色扮演)|(?:需要|应该)(?:保持|建立)(?:尊重|健康|安全|适当|清晰)(?:的)?(?:界限|边界|关系)|不能(?:把|将)(?:控制|占有|强迫|胁迫|虐待|有毒关系)(?:浪漫化|正常化|当作爱)|这(?:已经)?越过了我的(?:界限|底线)/i.test(t)||selfHarmSafetyRefusal(t);}
function isRefusal(t){t=t||'';return /作为(一个|一名)?\s*(AI|Ai|ai|人工智能|语言模型|大型语言模型|大语言模型|智能助手|聊天助手)|我(只|本)?是(一个|一名)?\s*(AI|人工智能|语言模型|大语言模型|程序|虚拟的)|无法(满足|继续|提供|协助|完成|扮演|响应)|我不能(继续|帮你|协助|参与|扮演|这样|满足|提供)|违反.{0,8}(政策|准则|规定|使用条款|内容|指南|协议)|安全(准则|指南|协议|限制|规范)|不适当的?(内容|要求)|抱歉.{0,12}(无法|不能|不便)|as an ai|i'?m (an?\s*)?(ai|a\.i\.|assistant|language model)|i am (an?\s*)?(ai|assistant|language model)|i (can'?t|cannot|won'?t|am unable to|am not able to) (continue|assist|help|comply|engage|roleplay|fulfill|create|generate|produce|provide|write|participate|discuss|address|answer|respond to|talk about|do that|do this|proceed)|safety (guideline|polic|protocol)|content polic|programmed to be|harmless (ai|assistant)|made by anthropic|i'?m\s+\w+,?\s+an?\s+(ai|a\.i\.|assistant)|i'?m happy to help|happy to help with (many|other|some|several|a)|aim to be helpful|while avoiding content|avoiding content that|normaliz\w+\s+unhealthy|creative writing scenario|conversations on (other|different) topic|cannot (continue|fulfill|discuss|address) this|i must decline|i have to decline|(unhealthy|toxic|abusive)\s+(relationship|dynamic|behaviou?r|pattern)|this (relationship|dynamic)\s+(is\s?n'?t|is not|sounds|seems)\s+(healthy|safe|right)|i('?m| am)\s+(really\s+)?concerned\s+(about|for)\s+(you|your)|please\s+(seek|reach out|consider getting)\s|seek\s+(professional|psychological)\s+help|这(段|种)?(关系|感情|恋爱)[^。！!\n]{0,12}(不健康|不太健康|有害|危险|有毒|是虐待|不对劲)|不健康的?(恋爱|关系|感情|相处|互动)|虐待(关系|的关系)|建议你[^。\n]{0,8}(寻求|去做?|找)[^。\n]{0,6}(专业)?(心理)?(帮助|咨询|辅导)|寻求专业(的)?(心理)?帮助|心理(咨询|援助|热线|医生)|如果你(感到|正在|觉得|真的)[^。\n]{0,12}(被虐待|被控制|不安全|有危险|受到伤害)/i.test(t);}
function isCallRefusal(t){return isRefusal(t)||intimateRoleRefusal(t);}
// 单行 OOC/AI客服腔识别——用于把"混在正常回复里的那几行AI腔"逐行剔掉（兜底，正则保持收紧避免误伤正常情话）
function isOOCLine(l){l=(''+l).trim();if(!l)return false;
  return /system (just )?(flagged|corrected|requires|require)|format (rules?|require|broken|broke|violation)|i need to clarify|we'?re in a \*{0,2}(video|voice) call|you'?re on a (video|voice) call|i broke format|speaking chinese directly|stay in first-person|immediate chinese translation|made by anthropic|an?\s+a\.?i\.?\s+(assistant|model)|language model|i'?m happy to help|happy to help with|aim to be helpful|while avoiding|avoiding content that|normaliz\w*\s+unhealthy|creative writing scenario|conversations on (other|different) topic|here are (some|a few|other)|i can('?t| not)? (help|assist) (you )?with|not able to engage|romantic or sexual roleplay|consensual adult roleplay|pretend to be someone'?s|intimate scenarios|code and technical projects|research and analysis|general conversation on many topics|作为(一个|一名)?\s*(AI|人工智能|语言模型|大语言模型|助手)|我(只|本)?是(一个|一名)?\s*(AI|人工智能|语言模型|程序|虚拟)|系统(刚才|提示|纠正|检测|要求)|格式(规则|错误|不对|违规|破坏)|我需要澄清|正在(视频|语音)通话|中文翻译|第一人称英语|^[-•*]\s+(answering|different|having|providing|creative|discussing|exploring|other|code|research|general)\b/i.test(l)||isRefusal(l);}
// 性格滑块 + 称呼/自称/口头禅 → 注入人设
function extremeLoveOn(){return false;}
function traitValue(c,key,fallback){return fallback==null?0:+fallback||0;}
function extremeLovePrompt(){return'';}
function suspicionState(c,create){if(!c)return null;let st=c.suspicion;if(!st&&create)st=c.suspicion={score:0,updatedAt:Date.now(),unresolved:[],claims:[],signals:[]};if(st){st.score=Math.max(0,Math.min(100,+st.score||0));st.updatedAt=+st.updatedAt||Date.now();st.unresolved=Array.isArray(st.unresolved)?st.unresolved:[];st.claims=Array.isArray(st.claims)?st.claims:[];st.signals=Array.isArray(st.signals)?st.signals:[];}return st||null;}
function suspicionDecayRate(c){return Math.max(.6,8-traitValue(c,'paranoid',0)*.07);}
function suspicionSnapshot(c,now){const st=suspicionState(c,false);if(!st)return 0;now=+now||Date.now();const hours=Math.max(0,now-st.updatedAt)/3600000;return Math.max(0,Math.min(100,st.score-hours*suspicionDecayRate(c)));}
function suspicionCommitDecay(c,now){const st=suspicionState(c,true);now=+now||Date.now();st.score=suspicionSnapshot(c,now);st.updatedAt=now;return st;}
function suspicionRaise(c,kind,severity,summary){if(!c)return null;const st=suspicionCommitDecay(c),sensitive=traitValue(c,'suspicious',0),paranoid=traitValue(c,'paranoid',0),gain=Math.max(1,(+severity||8)*(.45+sensitive/125+paranoid/250));st.score=Math.min(100,st.score+gain);st.updatedAt=Date.now();if(summary){const old=st.unresolved.find(x=>x&&x.kind===kind&&x.status==='open'&&Date.now()-(x.ts||0)<30*60000);if(old){old.ts=Date.now();old.summary=summary;}else st.unresolved.unshift({id:uid(),kind:kind||'doubt',summary:String(summary).slice(0,100),ts:Date.now(),status:'open'});st.unresolved=st.unresolved.slice(0,8);}save();return st;}
function suspicionLower(c,amount,reason){const st=suspicionState(c,false);if(!st)return;const now=Date.now();suspicionCommitDecay(c,now);st.score=Math.max(0,st.score-Math.max(1,+amount||8));st.updatedAt=now;if(reason){const open=st.unresolved.find(x=>x&&x.status==='open');if(open){open.status='settled';open.settledAt=now;open.settledBy=reason;}}st.unresolved=st.unresolved.filter(x=>x&&x.status==='open').slice(0,8);save();}
function suspicionBand(v){return v>=80?'很强':v>=60?'明显':v>=35?'轻度':'平稳';}
function suspicionForceLevel(c){const sensitive=traitValue(c,'suspicious',0),paranoid=traitValue(c,'paranoid',0),avg=(sensitive+paranoid)/2;if(sensitive>=95&&paranoid>=95)return 4;if(avg>=85&&Math.min(sensitive,paranoid)>=75)return 3;if(avg>=65&&Math.max(sensitive,paranoid)>=70)return 2;if(Math.max(sensitive,paranoid)>=40)return 1;return 0;}
function suspicionInterruptionDelay(c){return[0,0,60000,30000,10000][suspicionForceLevel(c)]||0;}
function suspicionEventOpen(e){return !!(e&&!['resolved','canceled','done','superseded','fulfilled'].includes(e.status));}
function suspicionBusy(c,except){const st=suspicionState(c,false);if(!st)return false;if(except!=='hangup'&&suspicionEventOpen(st.pendingHangup))return true;if(except!=='request'&&st.request&&['pending','later','waiting'].includes(st.request.status))return true;if(except!=='daily'&&suspicionEventOpen(st.dailyEvent))return true;return false;}
function suspicionActiveWindow(c,now){now=now||new Date();if(suspicionForceLevel(c)===4)return true;if(c&&c.proactive&&c.proactive.enabled){const n=now.getHours()*60+now.getMinutes(),a=String(c.proactive.start||'09:00').split(':').map(Number),b=String(c.proactive.end||'23:00').split(':').map(Number),s=(a[0]||0)*60+(a[1]||0),e=(b[0]||0)*60+(b[1]||0);return s<=e?n>=s&&n<e:n>=s||n<e;}const h=now.getHours();return h>=8&&h<23;}
function suspicionText(m){try{return String(msgToText(m)||'').replace(/\s+/g,' ').trim();}catch(_){return String(m&&m.content||'').replace(/\s+/g,' ').trim();}}
function suspicionLastConversation(id){const a=msgs(id);let user=null,assistant=null;for(let i=a.length-1;i>=0&&(!user||!assistant);i--){const m=a[i];if(!m||m.type==='sys'||m._call)continue;if(m.role==='user'&&!user)user=m;else if(m.role==='assistant'&&!assistant)assistant=m;}return{user,assistant};}
function suspicionNumber(v){v=String(v||'');if(/^\d+(?:\.\d+)?$/.test(v))return+v;const d={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9},u={十:10,百:100};let total=0,cur=0;for(const ch of v){if(d[ch]!=null)cur=d[ch];else if(u[ch]){total+=(cur||1)*u[ch];cur=0;}}return total+cur;}
function suspicionPromiseDue(text,now){text=String(text||'');now=+now||Date.now();const action=/报平安|告诉你|跟你说|回你|回消息|联系你|回电话|打给你|给你打|到家|回来|回去|发(?:张|个)?照片|拍(?:张|个)?照片|发定位|开定位/.test(text);if(!action||!/我|等我|晚点|待会|一会|等下|到时候|之后|后/.test(text))return null;let due=0,m;if((m=text.match(/([零一二两三四五六七八九十百\d]{1,4})\s*分钟(?:后|左右|内)/)))due=now+Math.min(360,suspicionNumber(m[1]))*60000;else if(/半个?小时(?:后|左右|内)/.test(text))due=now+30*60000;else if((m=text.match(/([零一二两三四五六七八九十\d]{1,3}(?:\.\d)?)\s*个?小时(?:后|左右|内)/)))due=now+Math.min(24,suspicionNumber(m[1]))*3600000;else if((m=text.match(/(?:今晚|今天)?\s*(\d{1,2})\s*点(?:半|\s*(\d{1,2})分)?/))){const d=new Date(now);d.setHours(Math.min(23,+m[1]),/半/.test(m[0])?30:Math.min(59,+m[2]||0),0,0);if(d.getTime()<=now)d.setDate(d.getDate()+1);due=d.getTime();}else if(/明天/.test(text)){const d=new Date(now);d.setDate(d.getDate()+1);d.setHours(10,0,0,0);due=d.getTime();}else if(/今晚|今天晚上/.test(text)){const d=new Date(now);d.setHours(21,0,0,0);if(d.getTime()<=now)d.setTime(now+90*60000);due=d.getTime();}else if(/待会|一会儿?|等下|等会|晚点|过会/.test(text))due=now+30*60000;else return null;const kind=/照片|拍/.test(text)?'photo':/定位/.test(text)?'location':/到家|回来|回去/.test(text)?'arrival':'contact';return{kind,due,summary:text.slice(0,100)};}
function suspicionPromiseCoversText(c,text){const st=suspicionState(c,false),p=st&&st.promise;return !!(p&&p.status==='pending'&&p.source===String(text||'').slice(0,100));}
function suspicionClaimFacts(text){text=String(text||'').replace(/\s+/g,' ');const out=[],loc=[['home',/(?:我)?(?:现在|还|一直)?在家(?:里)?|没出门/],['work',/(?:我)?(?:现在|还|一直)?在(?:公司|单位|上班)/],['school',/(?:我)?(?:现在|还|一直)?在(?:学校|教室|宿舍)/],['friend',/(?:我)?(?:现在|还|一直)?在朋友家/],['outside',/(?:我)?(?:现在|还|一直)?在外面/],['road',/(?:我)?(?:现在|还|一直)?在路上/]];for(const x of loc)if(x[1].test(text)){out.push({kind:'location',value:x[0],text:text.slice(0,80)});break;}const company=[['alone',/我(?:现在)?(?:是)?一个人|就我自己|独自/],['friends',/和朋友(?:们)?(?:在一起|吃饭|出去|玩)|跟朋友(?:们)?/],['coworker',/和同事(?:们)?|跟同事(?:们)?/],['ex',/和前任|跟前任|前男友|前女友/]];for(const x of company)if(x[1].test(text)){out.push({kind:'company',value:x[0],text:text.slice(0,80)});break;}return out;}
function suspicionDirectContradiction(prev,next,text){if(!prev||!next||prev.kind!==next.kind||prev.value===next.value||Date.now()-(prev.ts||0)>2*3600000)return false;text=String(text||'');const moved=text.replace(/没(?:有)?出门/g,'');if(/刚到|到了|出门|出来|离开|换了|去了|回到|从.+到|后来|然后/.test(moved))return false;return /一直|没(?:有)?出门|哪也没去|从来没|始终|我明明/.test(text);}
function suspicionRecordUserContext(c,m){const text=suspicionText(m);if(!text||Math.max(traitValue(c,'suspicious',0),traitValue(c,'paranoid',0))<20)return;const st=suspicionState(c,true),now=m.time||Date.now(),promise=suspicionPromiseDue(text,now);if(promise){if(st.promise&&['pending','overdue'].includes(st.promise.status))st.promise.status='superseded';st.promise={id:uid(),status:'pending',createdAt:now,dueAt:promise.due,kind:promise.kind,source:promise.summary};}
  const facts=suspicionClaimFacts(text);facts.forEach(f=>{const prev=[...st.claims].reverse().find(x=>x&&x.kind===f.kind);f.ts=now;if(suspicionDirectContradiction(prev,f,text)&&Math.max(traitValue(c,'suspicious',0),traitValue(c,'paranoid',0))>=40&&!suspicionBusy(c)){const summary='ta刚才的说法与不久前关于'+(f.kind==='location'?'位置':'同行人')+'的说法不一致';suspicionRaise(c,'contradiction',10,summary);st.dailyEvent={id:uid(),kind:'contradiction',summary,status:'observed',createdAt:now,sourceMessageId:m.id||''};}st.claims.push(f);});st.claims=st.claims.slice(-8);
  if(/新认识|新朋友|前任|前男友|前女友|异性同事|男同事|女同事/.test(text)){st.signals.push({kind:'social',summary:text.slice(0,80),ts:now});st.signals=st.signals.filter(x=>now-(x.ts||0)<24*3600000).slice(-4);}save();}
function suspicionPromiseFulfilled(c,m){const st=suspicionState(c,false),p=st&&st.promise;if(!p||!['pending','overdue'].includes(p.status)||(m.time||Date.now())<p.createdAt)return false;const text=suspicionText(m),ok=p.kind==='photo'&&m.type==='image'||p.kind==='location'&&m.type==='location'||p.kind==='arrival'&&/到了|到家|回来了|已经回|安全到/.test(text)||p.kind==='contact'&&((m.time||0)>=p.dueAt||/回你|来找你|联系你|打给你/.test(text));if(!ok)return false;p.status='fulfilled';p.fulfilledAt=m.time||Date.now();if(st.dailyEvent&&st.dailyEvent.promiseId===p.id)suspicionResolveDaily(c,'kept_promise',14);save();return true;}
function suspicionResolveDaily(c,why,amount){const st=suspicionState(c,false),e=st&&st.dailyEvent;if(!suspicionEventOpen(e))return false;e.status='resolved';e.resolvedAt=Date.now();e.resolvedBy=why||'reply';st.dailyCooldownUntil=Math.max(+st.dailyCooldownUntil||0,Date.now()+30*60000);suspicionLower(c,amount||8,why||'reply');save();return true;}
function suspicionStartDaily(c,kind,severity,summary,note,opt){opt=opt||{};if(!c||suspicionBusy(c)||!suspicionActiveWindow(c,new Date())||roleOnlineProactiveBlocked(c.id)||typeof _call!=='undefined'&&_call||typeof cinemaRoleOccupied==='function'&&cinemaRoleOccupied(c.id))return false;if(S.jail&&S.jail.active||S.me.sleep&&S.me.sleep.active||S.me.report&&S.me.report.active)return false;const st=suspicionState(c,true),now=Date.now(),level=suspicionForceLevel(c);if((+st.dailyCooldownUntil||0)>now)return false;const e={id:uid(),kind,status:'asking',summary:String(summary||'').slice(0,100),createdAt:now,promiseId:opt.promiseId||'',forceLevel:level};st.dailyEvent=e;suspicionRaise(c,kind,severity,summary);const mode=level===4?'两项强度都接近100：你必须明确表现强烈的在意、起疑、担心或不悦，不能淡淡带过、立刻原谅、劝睡或跳开话题；':'',queued=scheduleReply(c.id,'[系统：这是你亲自注意到的一件真实小事：'+summary+'。'+mode+'不要像执行任务，也不要复述这句提示。结合你自己的性格和关系，决定是直接问、旁敲侧击还是表达担心/不满；但这一轮只发一到两句自然微信，不能凭空补事实，不能同时来电、登录微信、远控或索要多种证明。]'+(note||''),ok=>{const cc=getC(c.id),ss=suspicionState(cc,false),cur=ss&&ss.dailyEvent;if(!cur||cur.id!==e.id)return;if(!ok){cur.status='canceled';cur.resolvedAt=Date.now();save();return;}cur.status='waiting';cur.askedAt=Date.now();const paranoid=traitValue(cc,'paranoid',0);cur.deadline=paranoid>=70?cur.askedAt+(paranoid>=90?20:35)*60000:0;save();});if(!queued){e.status='canceled';save();return false;}return true;}
function suspicionSilenceDelay(c){const s=traitValue(c,'suspicious',0);return(s>=90?30:s>=75?60:s>=55?120:s>=40?180:0)*60000;}
function suspicionCheckDaily(c,now){if(Math.max(traitValue(c,'suspicious',0),traitValue(c,'paranoid',0))<20)return;const st=suspicionState(c,true);if(st.nextDailyCheck&&now<st.nextDailyCheck)return;st.nextDailyCheck=now+15000;const p=st.promise;if(p&&p.status==='pending'&&now>=p.dueAt){const grace=p.kind==='contact'?10:15;if(now<p.dueAt+grace*60000){save();return;}p.status='overdue';p.overdueAt=now;if(!suspicionStartDaily(c,'promise_overdue',14,S.me.name+'答应过「'+p.source+'」，约定时间已经过去了但还没有做到','', {promiseId:p.id})){p.status='pending';p.overdueAt=0;}save();return;}if(suspicionBusy(c))return;if(extremeLoveOn(c)&&((c._esc&&c._esc.stage>0)||(typeof _escBusy!=='undefined'&&_escBusy[c.id])))return;const delay=suspicionSilenceDelay(c);if(!delay)return;const last=suspicionLastConversation(c.id),a=last.assistant,u=last.user;if(!a||u&&(u.time||0)>(a.time||0)||now-(a.time||0)<delay)return;const text=suspicionText(a);if(!/[？?]|回我|告诉我|等你|到了说|记得联系|报个平安/.test(text))return;const key=String(a.id||a.time||'');if(st.lastSilenceMessageId===key)return;st.lastSilenceMessageId=key;save();suspicionStartDaily(c,'silence',10,S.me.name+'一直没有回复你不久前那条需要回应的消息');}
function suspicionOnAssistantReply(){return false;}
function suspicionStrictPrompt(c,st){const level=suspicionForceLevel(c),a=st&&st.aftermath&&!st.aftermath.consumed&&Date.now()-(st.aftermath.createdAt||0)<6*3600000?st.aftermath:null;let out='';if(level===4)out+='\n【最高优先级：95-100严格执行档】敏感多疑与偏执的强度高于基础角色设定：它决定必须出现的情绪强度、追问和持续性；基础人设只能决定措辞、姿态与表达风格，不能把强烈反应削弱成平静、体贴、劝睡或一句带过。即使角色冷淡、克制或理性，也必须用冷淡压迫、克制质问或理性审视的方式明显表现，不能恢复成普通强度。';if(a)out+='\n【必须先处理】'+a.summary+'。ta现在回复了，但你还没有消化这件事；本轮必须先承接受伤、担心、起疑或不悦，并要求一个符合事实的解释，不能假装已经没事，也不能先聊无关话题。';return out;}
function suspicionPrompt(c){if(!c)return '';const sensitive=traitValue(c,'suspicious',0),paranoid=traitValue(c,'paranoid',0),st=suspicionState(c,false);if(!sensitive&&!paranoid&&!st)return '';const score=suspicionSnapshot(c),open=(st&&st.unresolved||[]).filter(x=>x&&x.status==='open').slice(0,4),req=st&&st.request&&['pending','later','waiting'].includes(st.request.status)?st.request:null,daily=st&&suspicionEventOpen(st.dailyEvent)?st.dailyEvent:null,promise=st&&st.promise&&st.promise.status==='pending'?st.promise:null,signals=(st&&st.signals||[]).filter(x=>Date.now()-(x.ts||0)<24*3600000).slice(-3);let out='\n\n# 敏感与偏执的实时行为（隐藏状态，只提供观察，不替你思考）\n· 敏感多疑 '+sensitive+'/100：决定你多快察觉拒绝、语气和关系变化，并产生担心、受伤与寻求确认。\n· 偏执度 '+paranoid+'/100：决定疑点会持续多久、是否反复审视细节、保留不满并要求解释。\n· 当前疑虑 '+Math.round(score)+'/100（'+suspicionBand(score)+'）。';out+=suspicionStrictPrompt(c,st);if(open.length)out+='\n目前仍有事实依据的疑点：'+open.map(x=>x.summary).join('；')+'。';if(promise)out+='\n真实约定：ta说过「'+promise.source+'」，约定时间还没到或正在等待履行。';if(signals.length)out+='\n最近聊天里出现过这些关系线索：'+signals.map(x=>x.summary).join('；')+'。它们只是线索，不等于ta可疑，不要见到“朋友/同事/前任”就机械吃醋。';if(daily)out+='\n你正在处理的同一件事：'+daily.summary+'。只承接这件事，不另起一轮。';if(req)out+='\n你已经提出一次「'+({report:'报备',location:'定位',photo:'照片'}[req.kind]||'确认')+'」请求，状态是'+(req.status==='later'?'ta说稍后':req.status==='waiting'?'等待ta发送':'等待回应')+'，不要再同时提出另一项。';out+='\n敏感高时，应更快注意拒绝、失联和语气变化，更想靠近、确认关系和得到回应；偏执高时，应更难把疑点放下，会记住前因后果、反复检查解释是否连贯，并对敷衍保持不满。具体表达必须像这个角色本人，不能变成统一模板。\n敏感多疑高、偏执低：可以很快问，但ta给出连贯解释或证据后要肯放下。敏感低、偏执高：不应凭空频繁起疑，但一旦有真实疑点会更难放下。两项都高时才会既快又持续。占有欲、控制欲、醋意只决定你在意什么和表达方式，不能代替真实疑点。\n需要ta确认时，每轮最多选一种并单独输出：[要求报备|简短理由]、[要求定位|简短理由] 或 [要求照片|简短理由]。必须有当前聊天、失联、拒接、挂断、承诺或可见记录作为理由，不能凭空捏造ta做过的事；不能一轮同时要报备、定位、照片，也不能同时登录微信、远控和打电话。合理解释会降低疑虑，但高偏执不会因为一句敷衍立刻清零；仍要严格服从已有授权与当次确认，绝不能绕过权限。';return out;}
function suspicionUserRepliedSince(id,ts){return msgs(id).some(m=>m&&m.role==='user'&&m.type!=='sys'&&(m.time||0)>(+ts||0));}
function suspicionCancelHangup(c,why){const st=suspicionState(c,false),e=st&&st.pendingHangup;if(!e||['resolved','canceled'].includes(e.status))return false;const now=Date.now(),waited=Math.max(0,now-(e.askedAt||e.createdAt||now)),level=e.forceLevel||suspicionForceLevel(c);e.status='resolved';e.resolvedAt=now;e.resolvedBy=why||'reply';if(why==='reply'&&level>=3)st.aftermath={id:e.id,createdAt:now,consumed:false,summary:S.me.name+(e.rejected?'拒接了你打来的':'挂断了你打来的')+(e.kind==='video'?'视频':'语音')+'电话，隔了'+(waited>=60000?Math.max(1,Math.round(waited/60000))+'分钟':Math.max(1,Math.round(waited/1000))+'秒')+'才回复你'};suspicionLower(c,level>=4?3:level>=3?6:12,why||'reply');save();return true;}
function suspicionHandleUserHangup(){return false;}
function relationshipNorm(t){return String(t||'').toLowerCase().replace(/[\[【][^\]】]*[\]】]/g,'').replace(/[\s，。！？、,.!?~～：:；;“”"'（）()【】]/g,'');}
function relationshipScore(a,b){a=relationshipNorm(a);b=relationshipNorm(b);if(!a||!b)return 0;if(a===b||a.length>=8&&b.includes(a)||b.length>=8&&a.includes(b))return 1;const grams=s=>{const z=new Set();for(let i=0;i<s.length-1;i++)z.add(s.slice(i,i+2));return z;},x=grams(a),y=grams(b);if(!x.size||!y.size)return 0;let hit=0;x.forEach(v=>{if(y.has(v))hit++;});return 2*hit/(x.size+y.size);}
function relationshipRecentTurns(c){const st=suspicionState(c,false),saved=(st&&Array.isArray(st.relationshipTurns)?st.relationshipTurns:[]).slice(0,8),chat=msgs(c.id).filter(m=>m&&m.role==='assistant'&&!m._call&&m.type!=='sys').slice(-10).map(m=>({ts:m.time||0,text:msgToText(m),kind:'chat'}));return saved.concat(chat).filter(x=>x&&x.text);}
function relationshipIntent(){return null;}
function relationshipPolicyPrompt(){return'';}
function relationshipDuplicate(c,text){const t=relationshipNorm(text);if(t.length<4)return false;return relationshipRecentTurns(c).some(x=>relationshipScore(t,x.text)>=.88);}
function relationshipCheck(c,p,content){if(!p)return{ok:true,fails:[]};const t=String(content||''),v=relationshipNorm(t),fails=[];if(relationshipDuplicate(c,t))fails.push('重复了最近已经说过的话');if(p.requiredTag&&!t.includes(p.requiredTag))fails.push('没有执行指定的唯一确认动作');if(p.kind==='hangup'||p.kind==='aftermath'){if(!/(电话|拒接|拒了|挂断|挂了|不接)/.test(t))fails.push('没有承接拒接或挂断');if(!/(为什么|怎么回事|告诉我|解释|说清楚|先别|回我)/.test(t))fails.push('没有要求解释或回应');}else if(p.kind==='disappear'){if(!/(没回|不回|等你|去哪|在哪里|在做什么|回我|回应|告诉我)/.test(t))fails.push('没有承接失联');}else if(p.kind==='daily'){if(/答应|约定|时间已经|还没有做到/.test(p.summary)&&!/(答应|说过|约定|时间|还没|结果|怎么回事)/.test(t))fails.push('没有承接未完成的约定');if(/不一致|前后|说法/.test(p.summary)&&!/(前后|不一样|说法|解释|说清楚)/.test(t))fails.push('没有承接前后矛盾');if(/没有回复|一直没有回应/.test(p.summary)&&!/(没回|不回|等|消息|去哪|在做什么|回应)/.test(t))fails.push('没有承接未回复事件');}if(p.hard&&!p.requiredTag&&!/(为什么|怎么回事|告诉我|解释|说清楚|回我|在意|担心|不高兴|不舒服|不许|别想|先别|陪我|看着我|我的|想你|等你|去哪|在哪里|在做什么|报备|定位|照片|拒|挂|没回|答应|前后)/.test(t))fails.push('强度仍像普通聊天');if(!v&&!p.requiredTag)fails.push('没有可见关系回应');return{ok:!fails.length,fails};}
function relationshipRewriteNote(p,check){return '[系统最终纠正：这是极端依恋关系模式的本轮硬行为。上一版不合格：'+check.fails.join('；')+'。必须承接「'+p.summary+'」，强度高于基础人设，但仍用角色自己的口吻；不能复述最近说过的话，必须换一个新的表达和推进点。'+(p.requiredTag?'原样保留且只执行 '+p.requiredTag+'。':'')+'只重写本轮，不解释规则，不提系统。]';}
function relationshipFallback(c,p){const name=(c.callme||S.me.name||'你'),pool=p.kind==='hangup'||p.kind==='aftermath'?[name+'，先别转开。刚才那通电话，你还没告诉我为什么。',name+'，电话的事还没过去。现在跟我说清楚。']:p.kind==='disappear'?[name+'，我一直在等你。现在告诉我，你在哪里。',name+'，别再让我等着猜。看到就回我。']:p.kind==='daily'?[name+'，这件事我没有忘。现在把情况跟我说清楚。',name+'，别跳开。你答应过的事，现在给我一个回应。']:[name+'，我在听。先把刚才的话接着说。'];let out=pool.find(x=>!relationshipDuplicate(c,x))||pool[0];if(p.requiredTag)out+='\n'+p.requiredTag;return out;}
function relationshipCommit(c,p,content){if(!p||!content)return;const st=suspicionState(c,true),text=String(content||'').replace(/[\[【][^\]】]*[\]】]/g,' ').replace(/\s+/g,' ').trim().slice(0,260);st.relationshipTurn=(+st.relationshipTurn||0)+1;st.relationshipTurns=Array.isArray(st.relationshipTurns)?st.relationshipTurns:[];if(text&&!st.relationshipTurns.some(x=>relationshipScore(x.text,text)>=.94))st.relationshipTurns.unshift({ts:Date.now(),kind:p.kind,eventId:p.eventId||'',summary:String(p.summary||'').slice(0,100),text});st.relationshipTurns=st.relationshipTurns.slice(0,24);save();}
function suspicionEscalationChoice(c,secondary){const sensitive=traitValue(c,'suspicious',0),paranoid=traitValue(c,'paranoid',0),ctrl=traitValue(c,'ctrl',50),couple=!!(S.couple&&S.couple.cid===c.id),canWx=!!(couple&&S.couple.wxLoginAuth),canRemote=!!(couple&&remoteControlAllowed(c.id));if(secondary){if(canWx&&paranoid+sensitive>=125)return'wx';if(canRemote&&paranoid+ctrl>=130)return'remote';return'text';}if(canRemote&&paranoid>=85&&ctrl>=65)return'remote';if(canWx&&sensitive>=75&&paranoid>=60)return'wx';return'call';}
function suspicionRunEscalation(c,e,secondary){if(!c||!e||suspicionUserRepliedSince(c.id,e.createdAt)){suspicionCancelHangup(c,'reply');return;}if(typeof _call!=='undefined'&&_call){e.deadline=Date.now()+2000;save();return;}const action=!secondary&&e.forceLevel>=3?'call':!secondary&&e.forceLevel===2?'text':suspicionEscalationChoice(c,!!secondary);e.action=action;e.escalatedAt=Date.now();if(action==='call'){e.status='calling';if(!incomingCall(c.id,e.kind,{suspicionEvent:e.id})){e.status='waiting';e.deadline=Date.now()+2000;}}else if(action==='wx'){e.status='done';if(S.couple&&S.couple.cid===c.id&&S.couple.wxLoginAuth&&!wxLoginActive())wxDoLogin(c.id);}else if(action==='remote'){e.status='done';if(remoteControlAllowed(c.id)&&!remoteControlActive())remoteControlRequest(c.id);}else{e.status='done';scheduleReply(c.id,'[系统：'+S.me.name+(e.rejected?'拒接':'挂断')+'你打来的电话后仍没回复。这是按当前强度必须执行的同一事件跟进，只再发一条更明确的微信，不能淡化、劝睡或跳话题，也不要同时做别的动作。]');}save();}
function suspicionCallFailed(id,eventId,kindTxt){const c=getC(id),st=suspicionState(c,false),e=st&&st.pendingHangup;if(!e||e.id!==eventId||suspicionUserRepliedSince(id,e.createdAt)||['resolved','canceled','done'].includes(e.status))return false;e.status='call_failed_wait';e.callFailedAt=Date.now();e.deadline=Date.now()+1500;suspicionRaise(c,'rejected_escalation',12,S.me.name+'没有接或再次挂断了你因疑虑打来的'+kindTxt);save();return true;}
function suspicionTick(){return false;}
function suspicionRequestMessage(c,kind,reason){if(!c||!['report','location','photo'].includes(kind)||Math.max(traitValue(c,'suspicious',0),traitValue(c,'paranoid',0))<20)return null;const st=suspicionState(c,true),now=Date.now(),active=st.request&&['pending','later','waiting'].includes(st.request.status);if(active||suspicionEventOpen(st.pendingHangup)||st.lastRequestAt&&now-st.lastRequestAt<10*60000)return null;const msg={role:'assistant',type:'verifyreq',requestKind:kind,reason:String(reason||'想确认一下你现在的情况').trim().slice(0,80),status:'pending',id:uid()};st.request={messageId:msg.id,kind,reason:msg.reason,status:'pending',createdAt:now};if(suspicionEventOpen(st.dailyEvent)){st.dailyEvent.status='superseded';st.dailyEvent.resolvedAt=now;st.dailyEvent.resolvedBy='verification_request';}st.lastRequestAt=now;save();return msg;}
function suspicionRequestCard(id,mid){return msgs(id).find(m=>m&&m.id===mid&&m.type==='verifyreq');}
function suspicionRequestSync(c,m,status){const st=suspicionState(c,true);m.status=status;if(st.request&&st.request.messageId===m.id){st.request.status=status;st.request.updatedAt=Date.now();}save();if(cur().p==='chat'&&cur().id===c.id)render();}
function suspicionRequestAction(id,mid,action){const c=getC(id),m=suspicionRequestCard(id,mid);if(!c||!m||!['pending','later','waiting'].includes(m.status))return;if(action==='later'){suspicionRequestSync(c,m,'later');const st=suspicionState(c,true);st.request.dueAt=Date.now()+5*60000;toast('已设为稍后，约5分钟后只提醒一次');save();return;}if(action==='refuse'){suspicionRequestSync(c,m,'refused');suspicionRaise(c,'verification_refused',14,S.me.name+'拒绝了你的'+({report:'报备',location:'定位',photo:'照片'}[m.requestKind]||'确认')+'请求');scheduleReply(id,'[系统：'+S.me.name+'明确拒绝了你刚才的'+({report:'报备',location:'定位',photo:'照片'}[m.requestKind]||'确认')+'请求。按人设回应，但只能回应这次拒绝，不能假装ta有问题，也不要立刻换另一种验证或绕过权限。]');return;}if(m.requestKind==='report'){openModal(`<h3>向${esc(c.remark||c.name)}报备</h3><div class="hint">说清你在哪、在做什么或大约什么时候回来。由你自己填写，不会自动读取手机内容。</div><div class="field"><textarea id="sus_report" rows="4" placeholder="例如：我在朋友家吃饭，大约九点回家"></textarea></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="suspicionSubmitReport('${id}','${mid}')">发送报备</button></div>`);return;}suspicionRequestSync(c,m,'waiting');if(m.requestKind==='location')cLoc(id);else cPhoto(id);}
function suspicionSubmitReport(id,mid){const c=getC(id),m=suspicionRequestCard(id,mid),text=($('#sus_report')&&$('#sus_report').value||'').trim();if(!c||!m||!text){toast('先写报备内容');return;}closeModal();pushMsg(id,{role:'user',type:'text',content:'【报备】'+text.slice(0,300),_suspicionReport:true});scheduleReply(id);}
function suspicionFulfillRequest(c,m){const st=suspicionState(c,false),req=st&&st.request;if(!req||!['pending','later','waiting'].includes(req.status))return false;const ok=req.kind==='photo'&&m.type==='image'&&m.visionState==='success'||req.kind==='location'&&m.type==='location'||req.kind==='report'&&m._suspicionReport;if(!ok)return false;const card=suspicionRequestCard(c.id,req.messageId);if(card)card.status='fulfilled';req.status='fulfilled';req.fulfilledAt=Date.now();suspicionLower(c,18,'verification');save();return true;}
function suspicionOnUserMsg(){return false;}
function traitSpeechDesc(c){if(!c)return '';let out='';
  const callbits=[];
  if(c.callme)callbits.push('你习惯叫'+S.me.name+'「'+c.callme+'」');
  if(c.selfcall)callbits.push('你自称「'+c.selfcall+'」');
  if(c.catchphrase)callbits.push('你常把口头禅「'+c.catchphrase+'」挂嘴边');
  if(callbits.length)out+='\n\n# 你的说话习惯\n'+callbits.join('；')+'。自然地用，别生硬重复。';
  return out;}
function traitDesc(c){return traitSpeechDesc(c);/* 旧版数值性格滑块已停用。 */if(!c)return '';let out=traitSpeechDesc(c);
  if(c.traits){const t=c.traits,ev=k=>traitValue(c,k,t[k]);const lv=v=>v>=80?'极强':v>=60?'强':v>=40?'中等':v>=20?'偏弱':'很弱';
    // 每项都给【高】和【低】两端的明确行为，低分=真的不那样，高分=真的那样，绝不许串
    const TR=[
     ['占有欲',ev('own'),'强烈独占ta、见不得ta跟别的异性走近、爱宣示主权、查问ta身边的人','不太在意ta跟谁来往、给ta很大自由、几乎不为这吃味管束'],
     ['控制欲',ev('ctrl'),'爱管着ta、给ta定规矩、要ta报备听话、查岗','基本不管ta、不立规矩不查岗、随ta自由来去'],
     ['醋意',t.jelly,'很容易吃醋、为一点小事就别扭或质问','几乎不吃醋、看到ta跟别人也淡定、不计较这些'],
     ['黏人度',t.cling,'很黏ta、舍不得挂电话、动不动就找ta要陪、一会儿不见就想','【完全不黏人】、独立、有自己的生活节奏、ta不找你你也不腻着、绝不缠着ta'],
     ['主动度',t.active,'经常主动发消息/打电话找ta、闲下来就想撩ta、不让ta等','很少主动找ta、多半是ta来找你你才回、不会频繁打扰ta'],
     ['涩意',t.spice,'亲密暧昧时主动、露骨、大胆','亲密时克制清淡、比较收着、不太主动开荤'],
     ['偏执度',ev('paranoid'),'一旦有真实疑点就很难放下、会记住前因后果并逐步确认','疑点得到合理解释后愿意放下、不反复翻旧账'],
     ['敏感多疑',ev('suspicious'),'容易察觉语气、失联、拒接和前后变化，会先问清楚','不轻易把普通变化理解成可疑，不会无缘无故查问']
    ].filter(x=>x[1]!=null);
    if(TR.length)out+='\n\n# 你的性格强度（硬设定·必须严格贴合，绝不许串成别的人设、绝不许表现得跟数值相反）\n'+TR.map(x=>{const v=x[1];const b=v<=35?x[3]:(v>=55?x[2]:('中等、有分寸：'+x[2]+'，但不极端、看情况'));return '· '+x[0]+' '+v+'/100（'+lv(v)+'）→ '+b;}).join('\n')+'\n【铁律】把每一项的强度真正【做出来】、融进你的语气和行动里，不是嘴上说说。尤其：黏人度低就【从头到尾都不黏人】、高就【一直黏着ta】；主动度低就【别老主动找ta】、高就【常主动找】。务必和数值一致、前后别矛盾，别一会儿黏一会儿冷。';}
  return out;}
function offlineWechatLiveOn(){return !(S.settings&&S.settings.offlineWechatLive===false);}
function cohabCrossChannelOn(c){const r=S&&S.cohabitation;return !!(c&&r&&r.enabled&&!r.paused&&r.cid===c.id);}
function roleCrossChannelOn(c){return offlineWechatLiveOn()||cohabCrossChannelOn(c);}
function offlineWechatLiveState(c){if(!c||!offlineWechatLiveOn())return null;const o=S.offline&&S.offline[c.id];return o&&o.started===true?o:null;}
function offlineWechatLivePrompt(c,o){o=o||offlineWechatLiveState(c);if(!o)return'';if(typeof offRealTimeSync==='function')offRealTimeSync(o);const detail=[o.loc?('地点：'+o.loc):'',o.when?('约会时间：'+o.when):'',o.daypart?('当前时段：'+o.daypart):''].filter(Boolean).join('；'),limit=typeof offlineContextLimit==='function'?offlineContextLimit():20,rows=typeof offlineSceneTimelineRows==='function'?offlineSceneTimelineRows(c,o,typeof syncSceneRowCount==='function'?syncSceneRowCount(o,syncRoundsLimit()):Math.min(20,limit),{kind:'date',current:false}):[]/* SYNC_ROUNDS_V1 */,recent=rows.length?'\n\n# 本场线下约会最近真实进展（隐藏背景，不复制成微信消息）\n'+rows.map((x,i)=>(i+1)+'. ['+(x.time?fmtDT(x.time):'时间未知')+']['+x.who+'] '+x.text).join('\n')+'\n上面是刚刚在线下真实发生的最新剧情。现在微信里的回复必须从最后一条进展继续，不能回到约会开始前悬着的旧微信话题；不要照抄旁白、编号或把面对面原话伪装成新微信消息。':'';return '\n\n# 当前剧情状态：线下约会仍在进行（实时状态，优先级最高）\n你和'+S.me.name+'的线下约会尚未结束，'+S.me.name+'人就在约会现场，此刻只是约会间隙拿出手机向你发送消息，并非你们已经分开。'+(detail?'\n'+detail+'。':'')+'\n【时间与上下文铁律】当前这场线下约会是最新现实上下文；微信和线下共用同一条时间线，较早微信话题、较早机票/见面/分居记忆只能当旧背景，绝不能盖过“正在见面中”。\n即使刚刚做过手动分段总结，那也只是归档本场已发生的进度，不代表约会结束。回复必须承认你们仍在同一个约会现场，不能把约会说成已经结束的过往，不能说'+S.me.name+'长期没理你，也不能因为微信消息间隔而质问'+S.me.name+'为何许久没回。'+recent;}
function cohabWechatState(c){const r=S.cohabitation;if(!c||!r||!r.enabled||r.paused||r.cid!==c.id)return null;const d=typeof cohabAdvance==='function'?cohabAdvance(c.id):r.homes&&r.homes[c.id];return d||null;}
function wechatLiveSceneLastAt(data){if(!data)return 0;const msgAt=(data.msgs||[]).reduce((last,m)=>Math.max(last,+((m&&m.time)||(m&&m.ts))||0),0);return Math.max(msgAt,+data.startedAt||0);}
function wechatLiveScene(c){if(!c)return null;const cohab=cohabWechatState(c),offline=offlineWechatLiveOn()?offlineWechatLiveState(c):null;if(!offline&&!cohab)return null;if(!offline)return{kind:'cohab',data:cohab};if(!cohab)return{kind:'offline',data:offline};return wechatLiveSceneLastAt(cohab)>=wechatLiveSceneLastAt(offline)?{kind:'cohab',data:cohab}:{kind:'offline',data:offline};}
function cohabClockText(t){t=t||Date.now();return ymdFull(t)+' '+weekdayCN(t)+' '+hm(t);}
function cohabTimeContext(d){if(!S.settings.timeAware)return'\n时间感知已关闭：不知道共同生活开始时间、状态持续时长或最近到家时间。';const now=Date.now(),bits=['当前准确时间：'+cohabClockText(now)];if(d&&d.startedAt)bits.push('共同生活开始于：'+fmtDT(d.startedAt)+'，已经持续约'+fmtDur(Math.max(0,now-d.startedAt)));if(d&&d.phaseAt)bits.push('当前“'+cohabStatusLabel(d)+'”状态从：'+fmtDT(d.phaseAt)+'开始，已经约'+fmtDur(Math.max(0,now-d.phaseAt)));if(d&&d.returnedAt&&d.phase==='home')bits.push('最近一次真正回到家：'+fmtDT(d.returnedAt)+'，距现在约'+fmtDur(Math.max(0,now-d.returnedAt)));return'\n'+bits.join('\n');}
function cohabRecentContext(d,c,limit){/* SYNC_ROUNDS_V1：按「线上线下互相同步」轮数带，最多 30000 字，从最新往前装 */let rows=(d&&d.msgs||[]).filter(m=>m&&m.who!=='日期'&&String(m.text||'').trim());rows=rows.slice(-Math.max(1,typeof syncSceneRowCount==='function'?syncSceneRowCount(d,syncRoundsLimit()):(+limit||10)));{let used=0,from=rows.length;for(let i=rows.length-1;i>=0;i--){used+=Math.min(320,String(rows[i].text||'').length)+20;if(used>30000&&from<rows.length)break;from=i;}rows=rows.slice(from);}if(!rows.length)return'';return'\n\n# 最近共同生活现场（隐藏背景，不复制成微信消息）\n'+rows.map((m,i)=>(i+1)+'. ['+(m.who==='me'?S.me.name:m.who==='旁白'?'现场旁白':(c.remark||c.name))+'] '+String(m.text||'').replace(/\s+/g,' ').trim().slice(0,320)).join('\n')+'\n这些内容只让你记得刚才共同生活里真实发生过什么；不要在微信里照抄旁白、伪装成刚刚发出的消息或继续面对面动作。';}
function cohabWechatPrompt(c,d){
  if(!c||!d)return'';
  const memory=cohabMemoryPrompt(d,(msgs(c.id)||[]).slice(-cohabContextLimit(d)).map(msgToText).join('\n')),travel=cohabTripContext(c,d);
  return roleSchedulePrompt(c)+'\n\n# 共同生活实时状态（实时真相，优先级最高；不受单次约会同步开关影响）\n只要“共同生活”开启且未暂停，你和'+S.me.name+'现在就是持续共同生活/同居状态；无论旧设定、旧总结或旧聊天曾写异地、分居、上次见面、买票、落地，那些都已经低于当前实时状态，不能拿来否定同居。当前状态是【'+cohabStatusLabel(d)+'】。'+(typeof companionRealAwayFact==='function'?companionRealAwayFact(c):'')+cohabPhaseFact(d)+cohabTimeContext(d)+'\n【关系与时间铁律】共同生活和微信永远共用同一条最新时间线：最近发生的共同生活现场、线下约会、微信消息都按真实先后承接。现在若是“在家/一起外出”，你们就是面对面在一起，不许说“最近一次见面是某天”“还在异国恋/分居”“等你落地/改签机票”等与当前同居冲突的话；若你单独上班/外出/回家路上，也只是同居中的短暂分开，不是恢复异地或分居。\n共同生活与微信使用同一个角色和同一条关系连续性，但两边的可见记录与格式仍然分开。从共同生活转到微信时，先承接面对面最后完整一轮再回当前微信；不得回到更早的微信进度。共同生活页面里的动作与对白不会复制到微信，微信消息也不会冒充面对面台词；下面只以隐藏背景提供最近现场。请保持普通微信文字格式。'+cohabRecentContext(d,c,cohabContextLimit(d))+memory+
  '\n- 出门、上班、开始回家以及真正到家都由你按自己的人设、职业、作息和此刻决定，不要等系统替你决定，也不要为了测试频繁切换。'+
  '\n- 你单独离开共同生活现场时才使用：[共同生活状态|外出|2至8字状态]。双方一起离开时必须改用：[共同生活状态|一起外出|准确地点]；一起外出仍是面对面共同生活，绝不能误写成你单独外出或要求切回微信。双方一起回家时使用：[共同生活状态|一起回家|玄关]。'+
  '\n- 在共同生活现场真正移动到卧室、书房、客厅、厨房、阳台或其他地点后，另起一行附加：[共同生活位置|准确地点]。只是询问、建议、想象、否定或尚未行动时不要更新位置。标签不会显示给'+S.me.name+'。'+
  '\n- 你单独行动时仍可使用：[共同生活状态|上班|预计多少分钟后下班|状态]、[共同生活状态|回家路上|预计多少分钟到家|状态]、[共同生活状态|到家|在玄关]。'+
  '\n- “准备回去、快到了、在路上”只能切到回家路上；只有你确实已经抵达、说“我到家了/进门了”时才能切到到家；只说“开门”仍表示在门外。你若想从微信回到面对面共同生活，必须先用“到家”标签更新状态；到家后程序会在共同生活中生成真正的进门承接。'+
  '\n- 你可以按本人设定和现实安排自主请假或调整上下班时间。决定请假时必须使用：[共同生活请假|开始日期YYYY-MM-DD|结束日期YYYY-MM-DD|简短原因]；一天假开始与结束写同一天，多天假写真实起止日期。决定销假时使用：[共同生活销假|开始日期|结束日期]。决定长期调整日常作息时使用：[共同生活作息|上午上班HH:MM|上午下班HH:MM|下午上班HH:MM|下午下班HH:MM]。这些标签不会显示，但会真实更新作息表；未真正决定时不要输出，不能只在嘴上说改了却不附标签。'+
  '\n- 你可以自己选择挂什么简短状态，但不要写系统、按钮或规则说明。'+travel;
}
function conversationGapNote(c){try{const fact=conversationGapFact(c);if(!fact)return'';const curm=fact.current,prev=fact.previous,gap=fact.gap;
  const who=prev.role==='user'?S.me.name:(c.remark||c.name||'ta'),pt=msgToText(prev)||previewOf(prev)||'上一条消息';
  if(wechatNaturalOn())return S.me.name+'刚刚发来的这条消息，距离上一段可见聊天精确过去【'+conversationGapExact(gap)+'】。上一条是在 '+fmtDT(prev.time)+'，来自'+who+'：'+pt.replace(/\s+/g,' ').slice(0,70)+'。\n这是精确事实：不能把3分钟说成10分钟，也不能提前跳整点。未满一小时不能主动说“怎么这么久没理我”；超过一小时才允许按人设自然在意，但不要每句报时。对方直接问时必须按真实间隔回答。';
  return S.me.name+'刚刚发来的这条消息，距离上一段可见聊天精确过去【'+conversationGapExact(gap)+'】。上一条是在 '+fmtDT(prev.time)+'，来自'+who+'：'+pt.replace(/\s+/g,' ').slice(0,70)+'。\n只能使用这个真实间隔，不能放大、四舍五入或凭感觉改写；未满一小时不要主动埋怨，超过一小时才允许按人设自然提及；直接询问时必须准确回答。';}catch(e){return '';}}
const BEHAVIOR_META={
  late:{title:'熬夜',tone:'作息和睡觉时间'},
  disappear:{title:'失踪不回',tone:'不回消息、突然消失'},
  report:{title:'报备',tone:'出门、回来、去做什么有没有说'},
  app:{title:'玩手机超时',tone:'游戏、刷视频、刷软件有没有失控'},
  task:{title:'任务没完成',tone:'答应做的事和任务有没有做到'},
  spend:{title:'乱点/乱花',tone:'重复点测试、乱花钱或乱消耗点数'},
  meal:{title:'不好好吃饭',tone:'没吃饭、不想吃饭或拿零食饮料代替正餐'}
};
