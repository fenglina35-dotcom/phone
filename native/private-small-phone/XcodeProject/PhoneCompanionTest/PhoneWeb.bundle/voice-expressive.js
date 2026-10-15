/* 细腻情绪与 3D 贴耳（设置 → 声音与通话，一个开关 S.settings.voiceExpressive，默认关；关掉就完全走原来的语音逻辑）。

   一、细腻情绪（只对支持行内标签的模型：Fish Audio S2/S2.1、ElevenLabs v3；其他模型不加）
   以前整条语音只有一个「语气」，再被翻成固定的英文标签塞在句首；笑和叹气还会被硬加一段「[laughing] 哈哈。」「[sighing] 唉。」，
   于是笑声僵硬、笑得太勤、叹气不合时宜，强情绪标签（愤怒、兴奋、喊叫、抽泣）还会把声音拉偏、变尖或变低。
   打开开关后：
   - 角色可以在语音正文里、真正需要的位置写少量中文小提示（[温柔] [撒娇] [轻笑] [小声] [难过]……），这里换成模型认识的温和标签；
   - 只用不改音色的温和标签，不用喊叫、抽泣、狂笑这类会让声音跑偏的；
   - 一条最多两个提示；出声的（轻笑、叹气、哽咽）一条最多一个，同一个角色几分钟内只出现一次；
   - 不再自动硬加「哈哈」「唉」；没写行内提示时，只把原来的「语气」换成一个温和的句首标签。

   二、3D 贴耳（任何语音模型都可以，只处理语音条，不处理实时通话；只对耳机有效）
   照 Saekisui/binaural-voice（MIT）的做法：用 KU100 假人头近场实测数据（binaural-hrir.js，CC BY 4.0）把单声道语音渲染成双耳立体声。
   角色可写 [左耳] [右耳] [脑后] [面前]（移到那里）和 [贴近] [退开]（只改远近），声音只在出声时移动，停顿时不跳；不写就随机选一种走法。
   渲染失败时照常播放原来的语音，不会因此没有声音。 */
(function(root){'use strict';
const SOUND={轻笑:1,叹气:1,哽咽:1};
const FISH={轻笑:'[chuckling]',笑着说:'[smiling]',开心:'[happy, light]',撒娇:'[sweet, clingy]',黏糊:'[sweet, clingy, drawn out]',温柔:'[gentle, tender]',宠溺:'[doting, tender]',小声:'[soft voice]',气声:'[breathy]',难过:'[sad, quiet]',低落:'[low, sad]',委屈:'[aggrieved, soft]',哽咽:'[choked up]',叹气:'[sighing softly]',停顿:'[pause]',慢慢说:'[slowly]',害羞:'[shy]',认真:'[serious, calm]',不满:'[displeased, restrained]',惊讶:'[surprised]'};
const ELEVEN={轻笑:'[chuckles softly]',笑着说:'[smiling]',开心:'[happy]',撒娇:'[sweetly]',黏糊:'[sweetly, drawn out]',温柔:'[gently]',宠溺:'[tenderly]',小声:'[softly]',气声:'[breathy]',难过:'[sad]',低落:'[quietly sad]',委屈:'[hurt, softly]',哽咽:'[voice breaking]',叹气:'[sighs softly]',停顿:'[pause]',慢慢说:'[slowly]',害羞:'[shyly]',认真:'[seriously]',不满:'[annoyed]',惊讶:'[surprised]'};
const ALIAS={笑:'笑着说',微笑:'笑着说',高兴:'开心',耳语:'小声',悄悄:'小声',轻声:'小声',伤心:'难过',心疼:'温柔',哄:'温柔',腻:'黏糊',黏:'黏糊',粘:'黏糊',哭腔:'哽咽',叹:'叹气',顿:'停顿',慢:'慢慢说',生气:'不满',吃醋:'不满'};
const CUE_WORDS='轻笑|笑着说|微笑|笑|开心|高兴|撒娇|黏糊|腻|黏|粘|温柔|宠溺|心疼|哄|小声|耳语|悄悄|轻声|气声|难过|伤心|低落|委屈|哽咽|哭腔|叹气|叹|停顿|顿|慢慢说|慢|害羞|认真|不满|生气|吃醋|惊讶';
const cueRe=()=>new RegExp('[\\[【]\\s*('+CUE_WORDS+')\\s*[\\]】]','g');
const spatialRe=()=>/[\[【]\s*(左耳|右耳|脑后|面前|贴近|退开)\s*[\]】]/g;
const SOUND_COOLDOWN_MS=6*60000,_soundAt=new Map(),_handed=new Map();
/* warmVoiceMsg 把带小提示的念法交过来，下一次合成同一正文时取用一次（发声入口仍读 m.content，原有的语言锁照常作用在它身上） */
function handPerf(text,perf,ask,directed){const k=String(text||'').trim();if(k&&(perf||ask||directed))_handed.set(k,{perf:String(perf||''),ask:String(ask||''),directed:String(directed||''),at:Date.now()});if(_handed.size>40){const old=[..._handed.keys()].slice(0,_handed.size-40);old.forEach(x=>_handed.delete(x));}}
function takePerf(text){const k=String(text||'').trim(),v=_handed.get(k);if(!v)return null;_handed.delete(k);if(Date.now()-v.at>120000)return null;return v;}
/* 用户这一轮明确提的要求：让角色笑、凶一点、撒娇。明确要求优先于限量和温和规则（只作用在这一条语音里）。 */
const ASK_LAUGH=/笑一?笑|笑一下|笑一个|笑出声|笑给我|大笑|哈哈|\b(?:laugh|giggle|chuckle)/i,ASK_LOUD_LAUGH=/大笑|笑出声|放声|哈哈大笑|laugh out loud/i,ASK_FIERCE=/凶|严厉|生气|发火|吼|质问|骂|狠一点|大声|\b(?:angry|stern|mean)\b/i,ASK_SWEET=/撒娇|温柔|黏|软一点|甜一点/;
/* 不管语音是从哪条路生成的：正文里如果还留着小提示或方位标签，挪进 voicePerf / voiceSpatial，正文和转文字保持干净。返回是否有改动。 */
function normalize(m){if(!m||m.type!=='voice')return false;const has=t=>new RegExp(cueRe().source+'|'+spatialRe().source).test(String(t||''));let changed=false;
  if(has(m.content)){const s=split(m.content,true);if(s){if(!m.voicePerf&&s.perf!==s.text)m.voicePerf=s.perf;if(!(m.voiceSpatial&&m.voiceSpatial.length)&&s.spatial.length)m.voiceSpatial=s.spatial;m.content=s.text;if(m.text!=null)m.text=s.text;changed=true;}}
  if(has(m.trans)){const s=split(m.trans,true);if(s){m.trans=s.text;changed=true;}}
  return changed;}

/* app.js 的 S 是脚本级 let，不挂在 window 上，要直接按名字读 */
function state(){try{return typeof S!=='undefined'?S:root.S;}catch(_){return null;}}
function on(){const st=state();return !!(st&&st.settings&&st.settings.voiceExpressive===true);}
function styleKind(tts){try{return typeof ttsStyleKind==='function'?ttsStyleKind(tts):'';}catch(_){return '';}}
function roleTts(c){try{return typeof ttsCfg==='function'?ttsCfg(c):null;}catch(_){return null;}}

/* 语音正文 → 显示用的干净文字、给模型念的带提示文字、方位标签（记在干净文字的第几个字）。开关关着时不处理。 */
function split(raw,force){if(!on()&&!force)return null;raw=String(raw==null?'':raw);const re=new RegExp(cueRe().source+'|'+spatialRe().source,'g');let text='',perf='',last=0,m;const spatial=[];let hit=false;
  while((m=re.exec(raw))){const chunk=raw.slice(last,m.index);text+=chunk;perf+=chunk;last=re.lastIndex;hit=true;
    if(m[1]){perf+='['+(ALIAS[m[1]]||m[1])+']';}else if(m[2]){spatial.push({at:[...text].length,tag:m[2]});}}
  if(!hit)return null;const tail=raw.slice(last);text+=tail;perf+=tail;
  return {text:text.replace(/[ \t]{2,}/g,' ').trim(),perf:perf.trim(),spatial};}

function prompt(c){if(!on())return '';let s='';const k=styleKind(roleTts(c));
  if(k==='fish'||k==='eleven')s+='\n- 语音细节（隐藏，只用于语音条）：想让声音更细腻时，可以在语音正文里、真正需要的位置插入中文小提示：[温柔] [撒娇] [黏糊] [宠溺] [开心] [笑着说] [轻笑] [小声] [气声] [慢慢说] [停顿] [难过] [低落] [委屈] [哽咽] [叹气] [害羞] [认真] [不满] [惊讶]。写在它管的那句话前面，例如 [语音|[黏糊]你怎么才回我呀……[小声]想你了|语气:温柔]。每条最多两个；[轻笑][叹气][哽咽]这种会出声的，一条最多一个，只在情绪真的到了才用，平时不用，不要每条都笑或叹气；不要另外写“哈哈”“呵呵”“唉”来假装笑或叹气。开心就让开心听得出来，难过就让难过听得出来，但始终是你原本的声音，不要喊叫或夸张。';
  s+='\n- 耳边方位（隐藏，只用于语音条；'+((state()&&state().me&&state().me.name)||'对方')+'戴着耳机，能听到你的声音在头边移动）：可以在语音正文里写 [左耳] [右耳] [脑后] [面前] 表示声音移到那里，[贴近] [退开] 只改远近；写在说那句话的地方，例如“[右耳]别动。[脑后]我就在你后面。”不写会自动安排，不需要每条都写。';
  return s;}

function soundAllowed(o){const k=String(o&&o.id||'_');return Date.now()-(_soundAt.get(k)||0)>SOUND_COOLDOWN_MS;}
function soundMark(o){_soundAt.set(String(o&&o.id||'_'),Date.now());}
function mildCue(cue,kind){let k='';try{k=typeof ttsCueKind==='function'?ttsCueKind(cue):'';}catch(_){}
  const fish={laugh:'[happy, light]',soft:'[sad, quiet]',warm:'[gentle, tender]',sleepy:'[soft voice]',tense:'[displeased, restrained]',surprised:'[surprised]',kiss:'[sweet, clingy]',fearful:'[nervous, soft]',disgusted:'[displeased, restrained]'};
  const eleven={laugh:'[happy]',soft:'[sad]',warm:'[gently]',sleepy:'[softly]',tense:'[annoyed]',surprised:'[surprised]',kiss:'[sweetly]',fearful:'[nervously]',disgusted:'[annoyed]'};
  return (kind==='fish'?fish:eleven)[k]||'';}

/* 给模型念的文字。开关关着、或模型不支持行内标签时返回 null，由原来的逻辑处理。 */
function performance(text,o,tts,opt){if(!on())return null;const kind=styleKind(tts);if(kind!=='fish'&&kind!=='eleven')return null;
  const map=kind==='fish'?FISH:ELEVEN,marks=[];const handed=takePerf(text)||{},ask=String((opt&&opt.ask)||handed.ask||'');
  if(handed.directed&&kind==='fish'){const tags=[];let d=String(handed.directed).replace(/\[[^\]\n]{1,60}\]/g,x=>{tags.push(x);return '\uE010'+(tags.length-1)+'\uE011';});if(typeof ttsDropOffLanguage==='function')d=ttsDropOffLanguage(d,o);d=d.replace(/\uE010(\d+)\uE011/g,(_,i)=>tags[+i]||'').replace(/[ \t]{2,}/g,' ').trim();if(d){if(/chuckl|laugh|sigh/i.test(d))soundMark(o);return d;}}let src=String((opt&&opt.perf)||handed.perf||text||'').replace(spatialRe(),'');
  src=src.replace(cueRe(),(_,w)=>{marks.push(ALIAS[w]||w);return '\uE010'+(marks.length-1)+'\uE011';});
  /* 外语角色的语言锁（去掉混进外语语音里的中文）同样作用在带提示的念法上；提示已换成占位符，不会被误删 */
  if(typeof ttsDropOffLanguage==='function')src=ttsDropOffLanguage(src,o);
  let base=typeof ttsCleanBase==='function'?ttsCleanBase(src):src.trim();if(!base.replace(/\uE010\d+\uE011/g,'').trim())return '';
  const wantLaugh=ASK_LAUGH.test(ask),wantFierce=ASK_FIERCE.test(ask),wantSweet=ASK_SWEET.test(ask),allowSound=wantLaugh||soundAllowed(o);let used=0,sounds=0,last='';
  const tagFor=name=>{if(name==='轻笑'&&wantLaugh&&ASK_LOUD_LAUGH.test(ask))return kind==='fish'?'[laughing]':'[laughs]';if(wantFierce&&(name==='不满'||name==='认真'))return kind==='fish'?'[angry, firm voice]':'[angry]';return map[name];};
  base=base.replace(/\uE010(\d+)\uE011/g,(_,i)=>{const name=marks[+i];if(!name||!map[name]||name===last)return '';if(SOUND[name]){if(sounds||!allowSound)return '';}if(used>=2)return '';if(SOUND[name])sounds++;used++;last=name;return tagFor(name)+' ';});
  /* 明确要求了却没写对应提示：补一个，让这句要求真的听得出来 */
  if(wantLaugh&&!sounds){base=(kind==='fish'?(ASK_LOUD_LAUGH.test(ask)?'[laughing]':'[chuckling]'):(ASK_LOUD_LAUGH.test(ask)?'[laughs]':'[chuckles]'))+' '+base;sounds++;used++;}
  else if(wantFierce&&!/angry/.test(base)){base=(kind==='fish'?'[angry, firm voice]':'[angry]')+' '+base;used++;}
  else if(wantSweet&&!used){base=map['撒娇']+' '+base;used++;}
  base=base.replace(/\s*\[[^\]]+\]\s*$/,m=>/chuckle|sigh|choked|breaking/.test(m)?m:'');
  if(!used){const lead=mildCue(opt&&opt.cue,kind);if(lead)base=lead+' '+base;}
  if(sounds)soundMark(o);
  return base.replace(/\s+/g,' ').trim();}


/* ───────────── 语音导演（只对 Fish S2/S2.1）：角色回完话后，再专门做一次表演标注 ─────────────
   用的是这个角色自己的聊天模型（和聊天同一条路线），不是副模型：用户反馈副模型写出来的表演不够好。
   角色一边聊天一边顺手写的提示往往很随意，笑声也短得几乎听不到。这里参考了 dawnsyo-blip/ttsdirectorskill-chatting 对 Fish s2.1 的实测结论
   （稳定有效的标签、克制、改写文字比堆标签有效、命令句用软标签），用自己的话写成导演规则；中英文台词都支持。
   结果缓存在消息上（voiceDirected / voiceDirectedFor），同一条语音不会重复调用；任何失败都退回上面的行内提示逻辑。 */
const DIRECTOR_PROMPT=[
'你是语音导演。只做一件事：把一条马上要交给 Fish Audio s2.1 合成的角色语音台词，标注成听起来像真人在说话的版本。',
'1. 克制：默认少标。能靠文字本身表达的不加标签；表面意思和真实情绪一致的平铺句子几乎不用标。情绪转折、口是心非、撒娇、调情、笑、难过的地方才标。',
'2. 改写比标签更有效：可以加入自然的语气词和停顿标点（中文：嗯、唔、哈、啧、呀、嘛、……、～；英文：mm, hm, hey, oh, haha, heh, ..., —），可以拆成更口语的短句、调整语序、叠词。但不能增删事实、不能改变意思、不能添加新的内容，原有的每个意思都要保留。',
'3. 标签格式：方括号里写英文，放在它要作用的那段文字前面，和文字之间留一个空格，例如 "[soft] 过来。"、"[chuckling] You\'re ridiculous."。同一处最多叠两个（一个管音量、一个管情绪）；整条一般 1 到 4 个。',
'4. 在 Fish s2.1 上稳定有效的标签（优先从这里选）：',
'   情绪：[warm] [doting] [happy] [pleased] [teasing] [playful] [curious] [sad] [worried] [surprised] [slightly surprised] [serious] [angry]',
'   动作式，通常比情绪词更准：[comfort] [plead] [gently nudging] [to charm] [seduce] [complain] [feel sorry] [praising] [threaten]（可以是玩笑式的）',
'   声音：[soft] [whispering] [low voice] [voice softening into a low murmur]（撒娇、示弱） [voice dropping to a low, sultry tone]（调情） [draw out the final syllable]（拉长尾音） [emphasis] [forceful]（只用于真的生气） [crying] [sobbing]',
'   笑和气息：[chuckle] [laugh softly] [chuckling]（边笑边说） [with a knowing chuckle] [warmly teasing] [with a soft, fond sigh] [sigh] [pause] [long pause] [inhales]',
'   强度可以加程度词：[slightly sad] < [sad] < [very happy]。',
'5. 停顿和呼吸默认不加：模型自己会换气，标点已经给出停顿。只有真正的情绪落点才用 [pause] [long pause] [sigh] [inhales]，同一个位置只放一个；“……”“——”后面不要再接停顿标签。',
'6. 这是陪伴聊天：语气可两解时，往温柔、宠溺、心疼的方向读。命令句和道别句（去睡觉、乖、闭眼、晚安、come here、go to sleep）用 [soft] [gently nudging] [whispering] 这类软标签，不要用 [forceful] [serious]。嘴硬心软用 [chuckling] [warm] 把温度写出来，不要冷淡平板的语气。',
'7. 笑：要让人真的听到一段从容的笑，不要急。一条最多笑一次，只用一个笑的标签：想笑出声就把 [laugh softly] 单独放在一句前面，笑完用“……”或“...”留出一点空再接话（例如 "[laugh softly] ...Okay, okay. You win."、"[laugh softly] ……好啦，给你笑。"）；只是边说边带笑意才用 [chuckling]。不要把 [chuckling] [chuckle] [laugh softly] 叠在一起，也不要写 haha、hahaha、哈哈哈 这类字去凑笑声——Fish 会把它念成很快的几下，听起来急促。没有理由就不要笑。',
'8. 如果给了“用户这一轮的要求”（让你笑、凶一点、撒娇、小声等），这条语音必须明显做到：让笑就一定有一段清楚、从容的笑（[laugh softly] 加一点留白，见第 7 条）；让凶就用 [serious] [angry] [forceful] 这类，但仍然是同一个人的声音，不要尖叫；让撒娇就用 [voice softening into a low murmur] [draw out the final syllable]。',
'9. 如果给了“角色自己写的表演提示”，把它当参考，换成上面的标签放到对应位置。',
'10. 语言：台词是英文就用英文语气词改写，标签仍是英文；台词是中文就用中文语气词。不要翻译，不要换语言。',
'11. 不要使用：环境音标签（风声、雨声等）、XML 标签、中文方括号提示、任何解释。',
'输出：只输出标注后的台词本身，不加引号，不加说明。'].join('\n');
const FILLER_RE=/[嗯唔哈嘿啧呀嘛啊呢吧哦噢诶欸呃哎唉呵]|\b(?:mm+|hm+|hmm+|hey|oh|ah+|uh+|um+|haha+|heh|hah|ha|aw+|ooh|mhm)\b/gi;
function directorClean(raw){let t=String(raw==null?'':raw).trim().replace(/^```[\w-]*\s*|\s*```$/g,'').trim();t=t.replace(/^(?:输出|标注后?的?台词|台词|Output|Annotated)\s*[:：]\s*/i,'').trim();if(/^["“「](.*)["”」]$/s.test(t))t=t.replace(/^["“「]|["”」]$/g,'').trim();
  t=t.replace(/[\[【]\s*[^\]】]*[\u3400-\u9fff][^\]】]*\s*[\]】]/g,'').replace(/<(?!\|phoneme_)[^>]{1,40}>/g,'');
  t=t.replace(/\[\s*([^\]\n]{1,60}?)\s*\]\s*/g,'[$1] ').replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();return t;}
/* 一条只笑一次：保留第一个笑的标签，后面的笑标签去掉；紧跟在笑标签后的 haha/哈哈 这类字去掉，换成留白，免得被念成很快的几下。 */
function directorLaughOnce(t){t=String(t||'');const cjk=/[\u3400-\u9fff]/.test(t);let seen=false;t=t.replace(/\[([^\]\n]*\b(?:laugh\w*|chuckl\w*)\b[^\]\n]*)\]\s*((?:(?:ha){2,}h?|(?:哈){2,}|(?:呵){2,}|heh(?:eh)+)[\s,，.。!！~～…]*)?/gi,(x,tag,syl)=>{if(seen)return '';seen=true;return '['+tag+'] '+(syl?(cjk?'……':'... '):'');});return t.replace(/[ \t]{2,}/g,' ').trim();}
function directorPlain(t){return String(t||'').replace(/\[[^\]\n]{1,60}\]/g,' ').replace(/<\|phoneme_start\|>[a-z]+[1-5]<\|phoneme_end\|>/gi,'').toLowerCase().replace(FILLER_RE,'').replace(/[^\p{L}\p{N}]/gu,'');}
function lcs(a,b){a=[...a];b=[...b];if(!a.length||!b.length)return 0;let prev=new Array(b.length+1).fill(0);for(let i=1;i<=a.length;i++){const cur=new Array(b.length+1).fill(0);for(let j=1;j<=b.length;j++)cur[j]=a[i-1]===b[j-1]?prev[j-1]+1:Math.max(prev[j],cur[j-1]);prev=cur;}return prev[b.length];}
/* 导演只能改语气、加语气词和标签，不能改意思：去掉标签和语气词后，原台词的字要几乎都在，而且不能多出一大段。 */
function directorValid(out,src){if(!out)return false;const tags=(out.match(/\[[^\]\n]{1,60}\]/g)||[]);if(tags.length>8)return false;if(tags.some(x=>/rain|wind|water|thunder|music|footstep|door|环境/i.test(x)))return false;
  const a=directorPlain(src),b=directorPlain(out);if(!a)return false;const keep=lcs(a,b)/[...a].length,grow=[...b].length/[...a].length;
  return keep>=.9&&grow<=1.3;}
async function direct(m,o){if(!on()||!m||m.type!=='voice'||!m.content)return null;if(styleKind(roleTts(o))!=='fish')return null;if(m.voiceDirected&&m.voiceDirectedFor===m.content)return m.voiceDirected;if(typeof chatAPI!=='function')return null;
  const st=state()||{},me=(st.me&&st.me.name)||'对方',payload=['角色：'+String((o&&(o.name||o.remark))||'角色')+'（在和'+me+'说话）','用户这一轮的要求：'+(String(m.voiceAsk||'').trim()||'无'),'角色自己写的表演提示：'+(String(m.voicePerf||'').trim()||'无'),'台词：',String(m.content)].join('\n');
  try{const routeIndex=typeof roleChatRouteIndex==='function'?roleChatRouteIndex(o):undefined,raw=await chatAPI([{role:'system',content:DIRECTOR_PROMPT},{role:'user',content:payload}],{aux:false,independentRoleModel:true,routeIndex,temp:.4,max:Math.max(300,Math.min(1200,[...String(m.content)].length*3)),timeout:45000,complete:true,roleInterceptAudit:null,roleInterceptStage:'语音表演标注'});
    const out=directorLaughOnce(directorClean(raw));if(!directorValid(out,m.content)){m.voiceDirectError='导演结果改动了台词或格式不对，已用简单标注';return null;}
    m.voiceDirected=out;m.voiceDirectedFor=m.content;delete m.voiceDirectError;return out;}catch(e){m.voiceDirectError=String(e&&e.message||e||'').slice(0,80);return null;}}

/* ───────────── 3D 贴耳：KU100 近场 HRIR 双耳渲染（算法照 binaural_voice.py） ───────────── */
const PLACES={左耳:[90,.25],右耳:[270,.25],脑后:[180,.31],面前:[0,.42]},NEAR=.25,FAR=.5,HALF_TURN=4.5,DIST_MOVE=1.5,DRIFT_DEG=5,DRIFT_M=.015;
let _hrirRaw=null,_hrirLoading=null;const _hrirByRate=new Map();
function hrirSrc(){try{const v=String(root.__NORTH_SHELL_BUILD__||'');return 'binaural-hrir.js'+(v?'?v='+encodeURIComponent(v):'');}catch(_){return 'binaural-hrir.js';}}
function loadHrir(){if(_hrirRaw)return Promise.resolve(_hrirRaw);if(_hrirLoading)return _hrirLoading;
  _hrirLoading=new Promise((resolve,reject)=>{const done=()=>{const d=root.NORTH_BINAURAL_HRIR;if(!d||!d.data){reject(new Error('hrir missing'));return;}try{const bin=atob(d.data),n=bin.length>>1,out=new Float32Array(n);for(let i=0;i<n;i++){let v=bin.charCodeAt(2*i)|(bin.charCodeAt(2*i+1)<<8);if(v>32767)v-=65536;out[i]=v*d.scale;}_hrirRaw={fs:d.fs,taps:d.taps,dists:d.dists,ir:out};resolve(_hrirRaw);}catch(e){reject(e);}};
    if(root.NORTH_BINAURAL_HRIR){done();return;}if(typeof document==='undefined'){reject(new Error('no document'));return;}const s=document.createElement('script');s.src=hrirSrc();s.async=true;s.onload=done;s.onerror=()=>reject(new Error('hrir load failed'));document.head.appendChild(s);}).catch(e=>{_hrirLoading=null;throw e;});
  return _hrirLoading;}
/* 把 48kHz 的 HRIR 换成音频的采样率（带窗 sinc 插值）。结果按 [距离][方位][耳] 存成 Float32Array。 */
function hrirAt(raw,fs){const key=fs;if(_hrirByRate.has(key))return _hrirByRate.get(key);const L=raw.taps,r=raw.fs/fs,Lo=fs===raw.fs?L:Math.ceil(L/r),fc=Math.min(1,fs/raw.fs),W=16,set=[],kernels=new Map(),kernelFor=off=>{const key=Math.round(off*1e6);let k=kernels.get(key);if(k)return k;k=new Float32Array(2*W+1);for(let j=0;j<k.length;j++){const x=off-j,s=x===0?1:Math.sin(Math.PI*fc*x)/(Math.PI*fc*x),w=Math.abs(x)>W?0:.5+.5*Math.cos(Math.PI*x/W);k[j]=fc*s*w;}kernels.set(key,k);return k;};
  for(let d=0;d<raw.dists.length;d++){const az=[];for(let a=0;a<360;a++){const ears=[];for(let e=0;e<2;e++){const off=((d*360+a)*2+e)*L,h=raw.ir.subarray(off,off+L);if(fs===raw.fs){ears.push(Float32Array.from(h));continue;}const y=new Float32Array(Lo);
          for(let n=0;n<Lo;n++){const t=n*r,k0=Math.ceil(t-W),kern=kernelFor(t-k0);let acc=0;for(let j=0;j<kern.length;j++){const k=k0+j;if(k>=0&&k<L)acc+=h[k]*kern[j];}y[n]=acc;}ears.push(y);}az.push(ears);}set.push(az);}
  const out={L:Lo,dists:raw.dists,set};_hrirByRate.set(key,out);return out;}
function decodeAt(ab,rate){const OAC=root.OfflineAudioContext||root.webkitOfflineAudioContext;if(!OAC)return Promise.reject(new Error('no OfflineAudioContext'));
  return new Promise((resolve,reject)=>{let ctx;try{ctx=new OAC(1,1,rate);}catch(e){reject(e);return;}let settled=false;const ok=b=>{if(!settled){settled=true;resolve(b);}},bad=e=>{if(!settled){settled=true;reject(e||new Error('decode'));}};try{const p=ctx.decodeAudioData(ab.slice(0),ok,bad);if(p&&typeof p.then==='function')p.then(ok,bad);}catch(e){bad(e);}});}
function pickRandom(list,weights){let t=weights.reduce((a,b)=>a+b,0)*Math.random();for(let i=0;i<list.length;i++){t-=weights[i];if(t<=0)return list[i];}return list[list.length-1];}
function plan(spatial,textLen,T){let cues=(spatial||[]).filter(c=>c&&(PLACES[c.tag]||c.tag==='贴近'||c.tag==='退开')).map(c=>[Math.max(0,Math.min(1,textLen?c.at/textLen:0))*T,c.tag]);
  if(!cues.length){const ear=Math.random()<.5?'左耳':'右耳',other=ear==='左耳'?'右耳':'左耳',kind=pickRandom(['贴耳','绕过去','从脑后来','从面前靠过来'],[1,2,1,1]);
    if(kind==='贴耳')cues=[[0,ear]];else if(kind==='绕过去')cues=T>6?[[0,ear],[.2*T,'脑后'],[.6*T,other]]:[[0,ear],[.3*T,other]];else cues=[[0,kind==='从脑后来'?'脑后':'面前'],[.35*T,ear]];}
  cues.sort((a,b)=>a[0]-b[0]);let start;if(PLACES[cues[0][1]]&&cues[0][0]<.3)start=PLACES[cues.shift()[1]];else start=PLACES[Math.random()<.5?'左耳':'右耳'];
  const azSegs=[],dSegs=[],track=(segs,s,init)=>{let g=null;for(const x of segs)if(x[0]<=s)g=x;if(!g)return init;const [s0,s1,v0,dv]=g;return v0+dv*(1-Math.cos(Math.PI*Math.min(1,(s-s0)/(s1-s0))))/2;},pos=s=>[track(azSegs,s,start[0]),track(dSegs,s,start[1])];
  const azPath=(a0,a1)=>{a0=((a0%360)+360)%360;const short=((a1-a0+180)%360+360)%360-180;return Math.abs(short)<=150?short:a1-a0;};
  for(const [s,tag] of cues){const [az,d]=pos(s);let targetD,da,nominal;if(PLACES[tag]){targetD=PLACES[tag][1];da=azPath(az,PLACES[tag][0]);nominal=Math.abs(da)>1?Math.abs(da)/180*HALF_TURN:DIST_MOVE;}else{targetD=tag==='贴近'?NEAR:FAR;da=0;nominal=DIST_MOVE;}
    const dur=Math.max(Math.min(nominal,.9*(T-s)),.6*nominal);if(Math.abs(da)>1)azSegs.push([s,s+dur,az,da]);if(Math.abs(targetD-d)>.01)dSegs.push([s,s+dur,d,targetD-d]);}
  return pos;}
function wav16(L,R,fs){const n=L.length,buf=new ArrayBuffer(44+n*4),v=new DataView(buf),w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  w(0,'RIFF');v.setUint32(4,36+n*4,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,fs,true);v.setUint32(28,fs*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*4,true);
  let o=44;for(let i=0;i<n;i++){v.setInt16(o,Math.max(-32767,Math.min(32767,Math.round(L[i]*32767))),true);v.setInt16(o+2,Math.max(-32767,Math.min(32767,Math.round(R[i]*32767))),true);o+=4;}return buf;}
const tick=()=>new Promise(r=>setTimeout(r,0));
/* mono 采样 → 双耳。返回 {L,R}。纯计算，便于测试。 */
async function renderSamples(x,fs,raw,spatial,textLen){const H=hrirAt(raw,fs),Lh=H.L,hop=Math.max(1,Math.floor(fs/100)),rms=[];
  for(let i=0;i+hop<x.length;i+=hop){let s=0;for(let j=i;j<i+hop;j++)s+=x[j]*x[j];rms.push(Math.sqrt(s/hop));}
  let peak=1e-9;for(const v of rms)if(v>peak)peak=v;const voiced=rms.map(v=>v>peak*.05);for(let i=0;i<voiced.length;){let j=i;while(j<voiced.length&&!voiced[j])j++;if(i>0&&j<voiced.length&&j-i<40)for(let k=i;k<j;k++)voiced[k]=true;i=Math.max(j,i+1);}
  const speed=voiced.map((_,i)=>{let s=0,n=0;for(let k=i-10;k<i+10;k++){if(k>=0&&k<voiced.length&&voiced[k])s++;n++;}return s/n;}),tau=[0];for(const s of speed)tau.push(tau[tau.length-1]+s*.01);
  const T=tau[tau.length-1],speechTime=t=>{const f=t/.01,i=Math.floor(f);if(i<0)return 0;if(i>=tau.length-1)return T;return tau[i]+(tau[i+1]-tau[i])*(f-i);};
  const pos=plan(spatial,textLen,T),phase=Math.random()*2*Math.PI,position=t=>{const [az,d]=pos(speechTime(t));return [az+DRIFT_DEG*Math.sin(2*Math.PI*t/4.3+phase)+2*Math.sin(2*Math.PI*t/1.9+2*phase),d+DRIFT_M*Math.sin(2*Math.PI*t/3.7+3*phase)];};
  const N=1024,Hop=512,win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=.5-.5*Math.cos(2*Math.PI*i/N);
  const total=x.length+2*N+Lh,outL=new Float32Array(total),outR=new Float32Array(total),hl=new Float32Array(Lh),hr=new Float32Array(Lh),dists=H.dists;let frames=0;
  for(let s=-Hop;s<x.length;s+=Hop){let [az,d]=position((s+N/2)/fs);const a=((Math.round(az)%360)+360)%360;d=Math.min(Math.max(d,dists[0]),dists[dists.length-1]);let k=0;while(k<dists.length-2&&d>=dists[k+1])k++;const wgt=(d-dists[k])/(dists[k+1]-dists[k]),A=H.set[k][a],B=H.set[k+1][a];
    for(let i=0;i<Lh;i++){hl[i]=(1-wgt)*A[0][i]+wgt*B[0][i];hr[i]=(1-wgt)*A[1][i]+wgt*B[1][i];}
    const base=s+Hop;for(let n=0;n<N;n++){const idx=s+n;if(idx<0||idx>=x.length)continue;const v=x[idx]*win[n];if(!v)continue;const o=base+n;for(let i=0;i<Lh;i++){outL[o+i]+=v*hl[i];outR[o+i]+=v*hr[i];}}
    if(++frames%48===0)await tick();}
  const len=x.length+Lh,L=outL.subarray(Hop,Hop+len),R=outR.subarray(Hop,Hop+len);let ex=0,eo=0,pk=0;for(let i=0;i<x.length;i++)ex+=x[i]*x[i];for(let i=0;i<len;i++){eo+=L[i]*L[i]+R[i]*R[i];pk=Math.max(pk,Math.abs(L[i]),Math.abs(R[i]));}
  let g=eo>0?Math.sqrt((ex/x.length)*2/(eo/(2*len))):1;if(pk*g>.89)g=.89/pk;for(let i=0;i<len;i++){L[i]*=g;R[i]*=g;}
  return {L:Float32Array.from(L),R:Float32Array.from(R),fs};}
/* 语音条音频（ArrayBuffer）→ 双耳 WAV（ArrayBuffer）。开关关着或任何一步失败都返回 null，调用方照常用原来的音频。 */
async function binaural(ab,spatial,text){if(!on()||!ab)return null;try{const raw=await loadHrir();let buf=null;try{buf=await decodeAt(ab,32000);}catch(_){buf=null;}if(!buf&&typeof decodeBuf==='function')buf=await decodeBuf(ab);if(!buf||!buf.length)return null;
    const ch=buf.numberOfChannels,n=buf.length,x=new Float32Array(n);for(let c=0;c<ch;c++){const d=buf.getChannelData(c);for(let i=0;i<n;i++)x[i]+=d[i]/ch;}
    const out=await renderSamples(x,buf.sampleRate,raw,spatial,[...String(text||'')].length);return wav16(out.L,out.R,out.fs);}catch(_){return null;}}

root.NorthVoiceExpressive={on,split,normalize,prompt,performance,binaural,handPerf,direct,renderSamples,plan,_test:{DIRECTOR_PROMPT,directorClean,directorValid,directorLaughOnce,FISH,ELEVEN,SOUND,soundAllowed,soundMark,_soundAt,hrirAt,wav16,loadHrir}};
root.voiceExpressiveOn=on;
})(typeof globalThis!=='undefined'?globalThis:this);
