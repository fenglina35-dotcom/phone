async function phSimRoleSay(callId,text,role){const units=phCallUnits(text,role);if(!units.length)return;const canPrefetch=phSimCanSpeak(role)&&ttsApiOn(role)&&!voiceProgressiveOn(),speechRows=units.map(u=>({spoken:phCallSpokenText(u.orig,role),cue:ttsAutoCue(u.orig,role),interjection:false})),speechJobs=canPrefetch?callPrefetchSpeech(speechRows,role,()=>{const now=phState().simCall;return !!(now&&now.id===callId&&now.state==='active');}):[];
  for(let i=0;i<units.length;i++){const u=units[i],c=phState().simCall;if(!c||c.id!==callId||c.state!=='active')return;const line=u.orig+(u.trans?'\n'+u.trans:''),canSpeak=phSimCanSpeak(role);let shown=false;const show=()=>{const now=phState().simCall;if(!now||now.id!==callId||now.state!=='active'||shown)return;shown=true;phSimLine(now,'them',line);if(canSpeak&&now.sub&&now.sub.text===line)now.sub.hold=true;save();if(cur().p==='phonecall')render();},off=phPhoneVoiceOffset();
    if(canSpeak){if(c.sub&&!c.sub.hold){c.sub=null;save();if(cur().p==='phonecall')render();}await phSimSpeak(line,role,{prepared:speechJobs[i],onAudioStart:()=>{if(off)setTimeout(show,off);else show();}});if(!shown)show();}
    else{show();await sleep(callPaceMs(Math.max(900,Math.min(1800,600+[...(u.orig||'')].length*35)),650));}
    phReleaseSimSub(callId,line);
    await sleep(callPaceMs(Math.max(360,Math.min(1100,520+[...(u.orig||'')].length*18)),220));}}
function phStrangerRejectAction(text){text=String(text||'');if(/诈骗|骚扰|推销|贷款|中奖|链接|http|验证码|转账|裸聊|加群|刷流水|提现吗|威胁|辱骂|滚|骗子|广告/.test(text))return'block';if(/打错|不认识|哪位|找谁|别打|别联系|没空|挂了/.test(text))return'hangup';return'';}
function phDecisionFromRaw(raw,heard){const t=String(raw||''),u=String(heard||'');if(/[\[【]\s*(拉黑|屏蔽|加入黑名单)\s*[\]】]/.test(t))return'block';if(/[\[【]\s*(挂断|拒接|结束通话)\s*[\]】]/.test(t))return'hangup';return phStrangerRejectAction(u);}
function phStripDecisionTags(t){return String(t||'').replace(/[\[【]\s*(?:拉黑|屏蔽|加入黑名单|挂断|拒接|结束通话|识破|看穿)\s*[\]】]/g,'').trim();}
function phBlockNumber(num){const p=phState();p.blocked[phNorm(num)]=true;save(300);}
function phEscRe(s){return String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function phAliasNormText(s){return String(s||'').toLowerCase().replace(/[\s，。！？、；：,.!?;:'"「」『』【】\[\]()（）]/g,'');}
function phAliasGenericTerm(s){return /^(哥|姐|哥哥|姐姐|弟弟|妹妹|宝贝|宝宝|乖乖|亲爱的|老公|老婆|对象|男朋友|女朋友|帅哥|美女|先生|小姐|daddy|honey|baby|babe)$/i.test(phAliasNormText(s));}
function phAliasOnlyGenericGuess(s){let u=phAliasNormText(s);if(!u)return false;u=u.replace(/^(你是不是|是不是|你是|是|areyou|isthis)/i,'').replace(/(吗|么|嘛|呀|啊|吧)$/g,'');return !!u&&phAliasGenericTerm(u);}
function phAliasPrivateTerms(s){const bad=/^(我们|你们|他们|一起|这个|那个|什么|怎么|为什么|现在|刚才|今天|昨天|明天|时候|事情|感觉|电话|短信|微信|通话|号码|陌生|消息|回复|喜欢|知道|不能|不要|没有|不是|可以|应该|哥|姐|哥哥|姐姐|弟弟|妹妹|宝贝|宝宝|乖乖|亲爱的|老公|老婆|对象|男朋友|女朋友|帅哥|美女|先生|小姐|daddy|honey|baby|babe)$/i;return memoryTerms(s).filter(x=>x&&x.length>=2&&!bad.test(phAliasNormText(x))&&!/^\d+$/.test(x));}
function phAliasPrivateSources(c){const out=[],scope=memoryScopeKey(),add=t=>{t=String(t||'').replace(/\s+/g,' ').trim();if(t&&t.length>=4&&!out.some(x=>phAliasNormText(x)===phAliasNormText(t)))out.push(t.slice(0,220));};if(!c)return out;(memoryList(c,scope)||[]).forEach(v=>add(memoryText(v)));summaryList(c,scope).forEach(v=>add(summaryCleanText(c,v&&v.text||'',scope)));if(scope==='main'&&typeof lifeNotes==='function'&&typeof isLover==='function'&&isLover(c)){const cut=+c._lifeNotesClearedAt||0;lifeNotesForRole(c).filter(v=>(+v.ts||0)>cut).forEach(v=>add(v&&v.text));}if(scope==='main'){const off=S.offline&&S.offline[c.id];((off&&off.memory)||[]).forEach(v=>add(typeof offMemText==='function'?offMemText(v):((v&&v.text)||v)));if(S.couple&&S.couple.cid===c.id&&typeof behaviorStore==='function'&&typeof behaviorOn==='function'&&behaviorOn()){const b=behaviorStore();((b&&b.items)||[]).forEach(v=>{add(v&&v.promise);((v&&v.events)||[]).forEach(e=>add(e&&e.text));});}}return out;}
function phAliasIdentityClue(heard,c){if(!c)return false;const u=String(heard||''),un=phAliasNormText(u);if(un.length<2||phAliasOnlyGenericGuess(u))return false;const pw=powerConfig(c),direct=[S.me&&S.me.name,S.me&&S.me.callName,c.callme,c.selfcall,c.catchphrase,pw&&pw.title,pw&&pw.userTitle,c.power&&c.power.title,c.power&&c.power.userTitle].map(x=>String(x||'').trim()).filter(x=>x&&!phAliasGenericTerm(x));if(direct.some(x=>{const nx=phAliasNormText(x);return nx.length>=2&&(u.includes(x)||un.includes(nx));}))return true;const ht=phAliasPrivateTerms(u);if(!ht.length)return false;const strong=/称呼|叫我|喊我|叫ta|喊ta|自称|叫他|喊他|备注|约会|见面|线下|生日|纪念|承诺|答应|机场|首尔|苏州|小黑屋|项圈|信箱|信封|一起听|旅行|酒店|老地方|吵架|和好|拉黑|删除|删掉|吃醋|管着|宣示主权/;return phAliasPrivateSources(c).some(src=>{const st=phAliasPrivateTerms(src),hit=ht.filter(x=>st.includes(x));return hit.length>=2||(hit.length>=1&&strong.test(src));});}
function phAliasRevealPrompt(c){return '\n- 识破阈值要高：不能因为对方语气像、骂人、短句、问号、说“哥哥/姐姐/宝贝/老公/老婆/帅哥/美女/加微信/你女朋友/你老婆/你对象/daddy/baby”这类泛称就认出来；“你是哥哥吗/你是老公吗/你是帅哥吗”只能算随口猜，不算识破；也不能说“声音不对”，短信没有声音。只有对方明确自爆“我是'+S.me.name+'”、说出你们专属称呼、'+S.me.name+'平时让你怎么叫ta、具体共同经历、真实姓名/昵称、小事簿/长期记忆里的私密细节时，才可以确认是'+S.me.name+'，并单独加隐藏指令 [识破]。不够确定时只能试探。';}
function phAliasExposed(raw,heard,c){const t=String(raw||''),u=String(heard||''),nm=c?(c.remark||c.name):'',me=S.me&&S.me.name||'';if(phAliasOnlyGenericGuess(u))return false;if(/[\[【]\s*(识破|看穿)\s*[\]】]/.test(t)&&phAliasIdentityClue(u,c))return true;if(/(我就是|就是我|是我呀|是我啊|是我啦|别装了.?是我|还装.?是我)/.test(u))return true;if(me&&new RegExp('(我是|我叫|我就是)'+phEscRe(me)).test(u))return true;if(nm&&new RegExp('我是.+('+phEscRe(nm)+')|你是.+('+phEscRe(nm)+')').test(u))return true;if(phAliasIdentityClue(u,c))return true;return false;}
function phSpoofExposed(raw,heard,c){const t=String(raw||''),u=String(heard||''),nm=c?(c.remark||c.name):'',me=S.me&&S.me.name||'';if(phAliasOnlyGenericGuess(u))return false;const generic=/(我有(男|女)朋友|我有对象|不随便回陌生|不回陌生|陌生人|加微信|你(女朋友|男朋友|对象|老婆|老公)|哥哥|姐姐|宝贝|宝宝|老公|老婆|帅哥|美女|i have (a )?(boyfriend|girlfriend|partner)|my (boyfriend|girlfriend|partner)|stranger|unknown number|add (my )?wechat)/i.test(u),hasClue=phAliasIdentityClue(u,c);if(generic&&!/(我知道是你|别装|我是|我叫|叫我|喊我|认出|抓到|i know it'?s you|stop pretending|it'?s me|my name is|call me|recognized)/i.test(u))return false;if(/[\[【]\s*(识破|看穿)\s*[\]】]/.test(t)&&hasClue)return true;if(/(我知道是你|别装了|你别装了|还装|是不是你|认出你了|被我抓到了|i know it'?s you|stop pretending|is this you|recognized you)/i.test(u)&&hasClue)return true;if(me&&new RegExp("(我是|我叫|我就是|i am|i'm|my name is)\\s*"+phEscRe(me),'i').test(u))return true;if(nm&&new RegExp("(你是|是不是|我知道是|别装了.?是|认出你是|are you|is this|i know it's)\\s*"+phEscRe(nm),'i').test(u))return true;if(hasClue)return true;return false;}
let _phAliasFollowups={};
let _phSmsTyping={};/* 角色在哪条短信线上「正在输入」 */
function phAliasExposeFollowup(cid,aliasNum,kind){const key=cid+':'+phNorm(aliasNum)+':'+kind;if(_phAliasFollowups[key])return;_phAliasFollowups[key]=1;const send=()=>{if(!_phAliasFollowups[key])return;delete _phAliasFollowups[key];const cc=getC(cid);if(!cc||cc.blocked||cc.deleted)return;scheduleReply(cid,'[系统：'+(kind==='call'?'刚才':'约一分钟前')+'，'+S.me.name+'用陌生号码 '+phFmt(aliasNum)+' '+(kind==='call'?'给你打电话':'给你发短信')+'，但你已经识破那就是ta。'+(kind==='call'?'这通电话刚挂断，你立刻用微信找ta。':'现在你用微信主动给ta发消息。')+'按你的人设和当时情绪反应：可以调侃、质问、吃醋、纵容、装作早就看穿、让ta解释为什么匿名联系你，或故意逗ta。普通微信文字，别复述系统提示。]');};const wait=()=>{const sc=phState().simCall;if(kind==='call'&&sc&&sc.state!=='ended'&&sc.meta&&sc.meta.aliasToRole&&sc.meta.roleId===cid){setTimeout(wait,1200);return;}setTimeout(send,kind==='call'?800:60000);};wait();}
function phSpoofThreadText(c,num,kind){const list=(kind==='sms'?c.phoneSpoofSmsHistory:c.phoneSpoofHistory)||[];return list.filter(h=>phNorm(h.num)===phNorm(num)).slice(0,8).reverse().map(h=>fmtDT(h.ts||Date.now())+' '+(h.from==='role_spoof'?'你':h.from==='user_to_spoof'?S.me.name:'记录')+'：'+String(h.text||'').replace(/\n/g,' ').slice(0,140)).join('\n');}
function phSpoofExposeFollowup(cid,num,kind){const key='spoof:'+cid+':'+phNorm(num)+':'+kind;if(_phAliasFollowups[key])return;_phAliasFollowups[key]=1;const send=()=>{if(!_phAliasFollowups[key])return;delete _phAliasFollowups[key];const cc=getC(cid);if(!cc||cc.blocked||cc.deleted)return;const ctx=phSpoofThreadText(cc,num,kind)||'（没有更多记录）',isSms=kind==='sms';scheduleReply(cid,'[系统：刚才你用陌生号码 '+phFmt(num)+' '+(isSms?'给'+S.me.name+'发短信':'给'+S.me.name+'打电话')+'，ta已经识破是你。最近这次'+(isSms?'短信':'电话')+'记录：\n'+ctx+'\n\n【类型铁律】这是'+(isSms?'短信，不是电话。你不能提接电话、挂电话、声音、通话；可以问ta要不要拉黑/删掉这个陌生号，也可以按人设调侃、吃醋或质问ta刚才为什么回陌生短信。':'电话，不是短信。通话刚结束/挂断，你现在用微信主动找ta。')+'你本人伪装陌生人，不是真陌生人，也不是ta冒充你。别复述系统提示。]');};const wait=()=>{const sc=phState().simCall;if(kind==='call'&&sc&&sc.state!=='ended'&&sc.meta&&sc.meta.spoof&&sc.meta.roleId===cid){setTimeout(wait,1200);return;}setTimeout(send,kind==='call'?800:1200);};wait();}
function phSpoofExposeRole(cid,num,kind,clue){const c=getC(cid);if(!c)return;const p=phState(),thread=p.aliasThreads&&p.aliasThreads[num]||{},now=Date.now();if(thread.spoofExposedAt&&now-thread.spoofExposedAt<30*60000)return;p.aliasThreads[num]=Object.assign({},thread,{cid,name:c.remark||c.name,kind:thread.kind||('spoof'+(kind==='call'?'Call':'Sms')),asStranger:true,spoof:true,num,spoofExposed:true,spoofExposedAt:now});if(p.simCall&&p.simCall.num===num&&p.simCall.meta&&p.simCall.meta.spoof)p.simCall.meta.exposed=true;if(kind==='sms'){c.phoneSpoofSmsHistory=Array.isArray(c.phoneSpoofSmsHistory)?c.phoneSpoofSmsHistory:[];c.phoneSpoofSmsHistory.unshift({ts:now,num,text:'被'+S.me.name+'识破：'+String(clue||'').slice(0,80),exposed:true});c.phoneSpoofSmsHistory=c.phoneSpoofSmsHistory.slice(0,24);}save();phSpoofExposeFollowup(cid,num,kind);}
function phAliasExposeRole(cid,num,kind,clue){const c=getC(cid);if(!c||c.blocked)return;const p=phState(),thread=p.aliasThreads&&p.aliasThreads[num]||{},aliasNum=thread.aliasNum||num,now=Date.now(),txt='你识破这个陌生号码就是'+S.me.name+(clue?'（线索：'+String(clue).slice(0,60)+'）':'');if(thread.exposedAt&&now-thread.exposedAt<30*60000)return;p.aliasThreads[num]=Object.assign({},thread,{cid,name:c.remark||c.name,kind:thread.kind||kind||'sms',asStranger:true,aliasNum,targetNum:num,exposed:true,exposedAt:now});if(p.simCall&&p.simCall.num===num&&p.simCall.meta&&p.simCall.meta.aliasToRole){p.simCall.meta.exposed=true;p.simCall.meta.aliasNum=aliasNum;}if(kind==='call'){c.phoneAliasCallHistory=Array.isArray(c.phoneAliasCallHistory)?c.phoneAliasCallHistory:[];c.phoneAliasCallHistory.unshift({ts:now,num:aliasNum,targetNum:num,region:phRegion(aliasNum),lines:[{from:'me',text:txt,time:now}],exposed:true});c.phoneAliasCallHistory=c.phoneAliasCallHistory.slice(0,8);}else{c.phoneAliasHistory=Array.isArray(c.phoneAliasHistory)?c.phoneAliasHistory:[];c.phoneAliasHistory.unshift({ts:now,num:aliasNum,targetNum:num,text:txt,from:'role',exposed:true});c.phoneAliasHistory=c.phoneAliasHistory.slice(0,12);}save();phAliasExposeFollowup(cid,aliasNum,kind);}
function phRoleEndSimCall(action,visible){const p=phState(),c=p.simCall;if(!c)return;if(visible)phSimLine(c,'them',visible);phSound('end');if(action==='block'){if(c.meta&&c.meta.aliasToRole){p.aliasThreads=p.aliasThreads||{};p.aliasThreads[c.num]=Object.assign({},p.aliasThreads[c.num]||{},c.meta,{blocked:true,blockedAt:Date.now()});}else phBlockNumber(c.num);phSimLine(c,'them','对方已挂断并屏蔽此号码。');}else phSimLine(c,'them','对方已挂断。');const dur=c.answeredAt?Math.max(1,Math.floor((Date.now()-c.answeredAt)/1000)):0;phAddRecent(c.num,c.dir==='in'?'in':'out',dur?'ok':'canceled','voice',dur,c.line||'main');phArchiveSimCall(c,action==='block'?'role_block':'role_hangup');c.state='ended';c.endedAt=Date.now();save();render();setTimeout(()=>{const now=phState().simCall;if(now&&now.id===c.id&&now.state==='ended'){phState().simCall=null;save();go('phoneapp');}},1400);}
async function phSimFirstRoleLine(id){const now=phState().simCall;if(!now||now.id!==id||now.state!=='active'||!now.meta||!now.meta.aliasToRole)return;const role=getC(now.meta.roleId);if(!role||role.blocked)return;const aliasNum=now.meta.aliasNum||now.num,targetNum=now.meta.targetNum||now.num;let raw='';try{const sys=buildSystem(role)+'\n\n# 当前场景：你接到陌生号码电话\n你本人是「'+(role.remark||role.name)+'」，你的真实电话是 '+phFmt(targetNum)+'。现在有一个陌生号码 '+phFmt(aliasNum)+' 打进你的手机，你不知道来电者是谁，但你完整记得自己的身份、人设、关系和记忆，知道'+S.me.name+'在你设定里是谁。第一句话要像刚接电话，短一点，可以警惕或冷淡，但不能说不认识自己。'+phCallLangPrompt(role);raw=await chatAPI([{role:'system',content:sys},{role:'user',content:'电话刚接通，请说第一句话。'}],{max:120,temp:.72});}catch(e){}
  let r=phCallCleanRoleReply(raw,role)||phCallFallback(role);const c=phState().simCall;if(!c||c.id!==id||c.state!=='active')return;if(callDrifted(r,getVoice(role).lang||'zh'))r=phCallFallback(role);await phSimRoleSay(c.id,r,role);}
async function phSimFirstBlockedLine(id){const now=phState().simCall;if(!now||now.id!==id||now.state!=='active'||!now.meta||!now.meta.blockedOutreach)return;const role=getC(now.meta.roleId);if(!role)return;let raw='';try{const sys=buildSystem(role,{natural:wechatNaturalOn(),allModules:true,query:'微信拉黑后电话联系'})+blockedPhonePrompt(role,now.meta)+phCallLangPrompt(role);raw=await chatAPI([{role:'system',content:sys},{role:'user',content:'电话刚接通。请用符合当前关系和拉黑前上下文的一句短话开口。'}],{max:140,temp:.76});}catch(e){}let r=phCallCleanRoleReply(raw,role)||'我知道你把我拉黑了，微信联系不上，只能给你打电话。';const c=phState().simCall;if(!c||c.id!==id||c.state!=='active')return;if(callDrifted(r,getVoice(role).lang||'zh'))r='我知道你把我拉黑了，微信联系不上，只能给你打电话。';await phSimRoleSay(c.id,r,role);}
function phSimAnswer(id){const p=phState(),c=p.simCall;if(!c||c.id!==id||!/(calling|incoming)/.test(c.state))return;phSound('connect');c.state='active';c.answeredAt=Date.now();const sp=c.special||phSpecialInfo(c.num),pf=c.meta||phStrangerProfile(c.num);c.lines=[];blockedPhoneConnected(c);save();render();if(pf.blockedOutreach){setTimeout(()=>phSimFirstBlockedLine(c.id),850);return;}if(pf.aliasToRole){setTimeout(()=>phSimFirstRoleLine(c.id),850);return;}phSimLine(c,'them',phStrangerInitialLine(pf,sp,c.num));save();render();}
function phArchiveSimCall(c,why){if(!c)return;const p=phState();let lines=(c.lines||[]).map(x=>typeof x==='string'?{from:'them',text:x,time:c.started||Date.now()}:x).filter(x=>x&&x.text);if(!lines.length&&(why==='miss'||(c.meta&&(c.meta.spoof||c.meta.aliasToRole||c.meta.blockedOutreach))))lines=[{from:'them',text:why==='decline'?'未接/被拒接':'通话未留下内容',time:c.started||Date.now()}];if(!lines.length)return;const dur=c.answeredAt?Math.max(0,Math.floor((Date.now()-c.answeredAt)/1000)):0;p.trash.push({id:c.id||uid(),num:c.num,name:phName(c.num),region:phRegion(c.num),dir:c.dir,state:c.state,started:c.started||Date.now(),ended:Date.now(),dur,lines,reason:why||''});if(p.trash.length>80)p.trash=p.trash.slice(-80);phRecordSpoofCall(c,lines,why,dur);phRecordAliasCall(c,lines);}
function rolePhoneCallCard(k,removeHTML){k=k||{};const lines=Array.isArray(k.lines)?k.lines.map(x=>typeof x==='string'?{from:'them',text:x}:x).filter(x=>x&&String(x.text||'').trim()):[],icon=k.type==='短信'?svgIc('message',14,'#aaa',1.6):svgIc((k.type||'语音')==='视频'?'video':'phone',14,'#aaa',1.6),content=lines.length?`<div style="padding:6px 13px 11px;border-top:.5px solid #2a2a2c">${lines.map(x=>`<div style="padding:6px 0;border-bottom:.5px solid #232326"><div style="font-size:10px;color:#777">${esc(x.from==='me'?'我':k.who||'对方')}${x.time?' · '+esc(hm(x.time)):''}</div><div style="font-size:12px;color:#bbb;line-height:1.55;white-space:pre-wrap">${esc(x.text||'')}</div></div>`).join('')}</div>`:'<div style="padding:10px 13px;color:#777;font-size:12px;border-top:.5px solid #2a2a2c">没有留下内容</div>';return `<details style="margin:0 10px 8px;border-radius:10px;background:#171719;border:1px solid #28282b;overflow:hidden"><summary style="list-style-position:inside;padding:11px 12px;color:#ccc;cursor:pointer"><span style="font-size:13px">${icon} ${esc(k.who||'某人')} <span style="color:#888">${esc(k.dur||'')}</span></span><span style="float:right;color:#777;font-size:11px">${esc(k.when||'')} ${removeHTML||''}</span><div style="font-size:10px;color:#777;margin:5px 0 0 20px">${lines.length?'通话内容 '+lines.length+' 条 · 点此展开':'点此展开'}</div></summary>${content}</details>`;}
function phSyncRolePhoneRecords(rid){const c=getC(rid);if(!c)return[];S.spy=S.spy||{};const sp=S.spy[rid]=S.spy[rid]||{};sp.calls=Array.isArray(sp.calls)?sp.calls:[];const seen=new Set(sp.calls.map(x=>x&&x._phoneLogId).filter(Boolean)),fresh=[];(c.phoneSpoofHistory||[]).forEach(h=>{const ts=h.ts||Date.now(),key=h.id||('spoof:'+ts+':'+phNorm(h.num));if(seen.has(key))return;fresh.push({_phoneLogId:key,_ts:ts,who:'陌生号拨给'+S.me.name+'（你伪装）',type:'语音',dur:h.dur?phDur(h.dur):(h.reason==='decline'?'未接/被拒接':'陌生来电'),when:fmtDT(ts),num:h.num,spoof:true,reason:h.reason||'',lines:h.lines||[]});seen.add(key);});(c.phoneSpoofSmsHistory||[]).forEach(h=>{const ts=h.ts||Date.now(),txt=String(h.text||'').replace(/\s+/g,' ').trim(),key=h.id||('spoofsms:'+ts+':'+phNorm(h.num)+':'+txt.slice(0,18));if(seen.has(key))return;fresh.push({_phoneLogId:key,_ts:ts,who:'陌生号发给'+S.me.name+'（你伪装）',type:'短信',dur:'已发送',when:fmtDT(ts),num:h.num,spoof:true,reason:'spoof_sms',lines:[{from:'them',text:txt,time:ts}]});seen.add(key);});if(fresh.length){fresh.sort((a,b)=>(b._ts||0)-(a._ts||0));sp.calls=fresh.concat(sp.calls).slice(0,80);}return sp.calls;}
function phRecordSpoofCall(call,lines,why,dur){const rid=call&&call.meta&&call.meta.spoof&&call.meta.roleId;if(!rid||!lines||!lines.length)return;const c=getC(rid);if(!c)return;c.phoneSpoofHistory=Array.isArray(c.phoneSpoofHistory)?c.phoneSpoofHistory:[];const ts=Date.now(),id=call.id||uid();c.phoneSpoofHistory.unshift({id,ts,num:call.num,region:phRegion(call.num),dur:+dur||0,reason:why||'',lines:lines.slice(-12)});c.phoneSpoofHistory=c.phoneSpoofHistory.slice(0,8);phSyncRolePhoneRecords(rid);}
function phRecordAliasCall(call,lines){const rid=call&&call.meta&&call.meta.aliasToRole&&call.meta.roleId;if(!rid||!lines||!lines.length)return;const c=getC(rid);if(!c)return;const n=(call.meta&&call.meta.aliasNum)||call.num,now=Date.now(),target=(call.meta&&call.meta.targetNum)||call.num,exposed=!!(call.meta&&call.meta.exposed);c.phoneAliasCallHistory=Array.isArray(c.phoneAliasCallHistory)?c.phoneAliasCallHistory:[];const old=c.phoneAliasCallHistory.find(h=>h.exposed&&exposed&&phNorm(h.num)===phNorm(n)&&now-(h.ts||0)<2*60000);if(old){old.ts=now;old.targetNum=target;old.region=phRegion(n);old.lines=lines.slice(-12);old.exposed=true;}else c.phoneAliasCallHistory.unshift({ts:now,num:n,targetNum:target,region:phRegion(n),lines:lines.slice(-12),exposed});c.phoneAliasCallHistory=c.phoneAliasCallHistory.slice(0,8);}
function phSimMiss(id){const p=phState(),c=p.simCall;if(!c||c.id!==id||c.state!=='calling')return;phSound('end');c.state='ended';c.endedAt=Date.now();c.lines=[];phSimLine(c,'them','暂时无人接听。');phAddRecent(c.num,c.dir==='in'?'in':'out',c.dir==='in'?'missed':'canceled','voice',0,c.line||'main');if(c.dir==='in'){if(c.meta&&c.meta.roleId)phAddRoleVoicemail(c.meta.roleId,c.num,{why:'missed',scene:'角色来电未接',context:phVmContext(c.lines)});else phAddVoicemail(c.num,'我刚才打过来，你没接。',{reason:'missed',source:'incoming_missed'});}phArchiveSimCall(c,'miss');save();render();}
function phSimHangup(){const p=phState(),c=p.simCall;if(!c){go('phoneapp');return;}phSound('end');try{if('speechSynthesis'in window)speechSynthesis.cancel();}catch(_){}if(c.state==='active'){const dur=Math.max(1,Math.floor((Date.now()-(c.answeredAt||Date.now()))/1000));phAddRecent(c.num,c.dir==='in'?'in':'out','ok','voice',dur,c.line||'main');phArchiveSimCall(c,'hangup');blockedPhoneFinished(c);phScheduleSpoofRecall(c,'hangup');}else if(c.state==='calling'){phAddRecent(c.num,c.dir==='in'?'in':'out',c.dir==='in'?'missed':'canceled','voice',0,c.line||'main');if(c.dir==='in'){if(c.meta&&c.meta.roleId)phAddRoleVoicemail(c.meta.roleId,c.num,{why:'missed',scene:c.meta.blockedOutreach?'拉黑后角色来电未接':'角色来电未接',context:phVmContext(c.lines)});else phAddVoicemail(c.num,'我刚才打过来，你没接。',{reason:'missed',source:'incoming_missed'});}phArchiveSimCall(c,c.dir==='in'?'miss':'cancel');if(!blockedPhoneRetry(c,c.dir==='in'?'miss':'cancel'))phScheduleSpoofRecall(c,c.dir==='in'?'miss':'cancel');}p.simCall=null;save();go('phoneapp');}
function phSimLinesHTML(c){if(!c)return '';const s=c.sub;if(s&&s.text&&(s.hold||Date.now()-(s.time||0)<(s.ttl||3600)))return `<div data-natural-transient="${naturalMotionObjectKey(s)}" class="csline ${s.from==='me'?'me':''}">${esc(s.text).replace(/\n/g,'<br>')}</div>`;return c.state==='calling'?'<div class="phcaption">等待对方接听</div>':'';}
function phSimMore(){openModal(`<h3>通话</h3><div class="section"><div class="it" onclick="phSimTextOpen();closeModal()"><span>打开文字键盘</span><span class="v">›</span></div><div class="it" onclick="phTrashModal()"><span>通话文字回收箱</span><span class="v">›</span></div></div><button class="btn g" onclick="closeModal()">取消</button>`);}
function phSimTextOpen(){const c=phState().simCall;if(c){c.textOpen=true;save();render();}}
function phSimTextClose(){const c=phState().simCall;if(c){c.textOpen=false;save();render();}}
function phSimDialToggle(){const c=phState().simCall;if(c){c.dialOpen=!c.dialOpen;c.textOpen=false;save();render();}}
function phSimDialKey(k){const c=phState().simCall;if(!c)return;phSound('key',k);c.dialDigits=(c.dialDigits||'')+k;save();render();}
function phSimDialBack(){const c=phState().simCall;if(!c)return;phSound('key','del');c.dialDigits=(c.dialDigits||'').slice(0,-1);save();render();}
function phSimDialHTML(c){if(!c||!c.dialOpen)return '';const keys=['1','2','3','4','5','6','7','8','9','*','0','#'];return `<div class="phcalldial"><div class="phcalldigits">${esc(c.dialDigits||'')}</div><div class="phcallkeys">${keys.map(k=>`<button onclick="phSimDialKey('${k}')">${k}</button>`).join('')}</div><div class="phcalldialbar"><button onclick="phSimDialBack()">⌫</button><button onclick="phSimDialToggle()">收起</button></div></div>`;}
async function phSimBlockedReply(t){const call=phState().simCall,pf=call&&call.meta,role=pf&&pf.roleId&&getC(pf.roleId);if(!call||call.state!=='active'||!pf||!pf.blockedOutreach||!role)return;const ctx=(call.lines||[]).slice(-12).map(x=>(x.from==='me'?S.me.name:(role.remark||role.name))+'：'+x.text).join('\n');let raw='';try{const sys=buildSystem(role,{natural:wechatNaturalOn(),allModules:true,query:'微信拉黑后电话联系'})+blockedPhonePrompt(role,pf)+phCallLangPrompt(role);raw=await chatAPI([{role:'system',content:sys},{role:'user',content:'本次电话记录：\n'+ctx+'\n\n'+S.me.name+'刚说：'+t+'\n请继续自然通话，只输出角色现在说的话。'}],{max:190,temp:.76});}catch(e){}let r=phCallCleanRoleReply(raw,role)||'我只是想把刚才的事说清楚。';const now=phState().simCall;if(!now||now.id!==call.id||now.state!=='active')return;if(callDrifted(r,getVoice(role).lang||'zh'))r='我只是想把刚才的事说清楚。';await phSimRoleSay(now.id,r,role);}
function phSimSend(){const c=phState().simCall,ta=$('#phcalltxt');if(!c||!ta)return;const t=(ta.value||'').trim();if(!t)return;ta.value='';phSimLine(c,'me',t);save();render();if(c.meta&&c.meta.blockedOutreach)phSimBlockedReply(t);else phSimReply(t);}
async function phSimReply(t){const c=phState().simCall;if(!c||c.state!=='active')return;const sp=c.special||phSpecialInfo(c.num),pf=c.meta||phStrangerProfile(c.num),role=pf.roleId&&getC(pf.roleId),aliasNum=pf.aliasNum||c.num,targetNum=pf.targetNum||c.num,who=(sp&&sp.name)||(pf&&pf.name)||phName(c.num),strangerVoice=phStrangerVoiceRef(),strangerLang=getVoice(strangerVoice).lang||'zh',ctx=(c.lines||[]).slice(-10).map(x=>(x.from==='me'?(pf.aliasToRole?'陌生号码 '+phFmt(aliasNum):S.me.name):who)+'：'+x.text).join('\n');let raw='';try{let sys='';if(role&&pf.aliasToRole)sys=buildSystem(role)+'\n\n# 当前场景：你接到陌生号码电话\n你本人是「'+(role.remark||role.name)+'」，你的真实电话是 '+phFmt(targetNum)+'。现在有一个陌生号码 '+phFmt(aliasNum)+' 打进你的手机，不是你的号码，也不是系统随机角色。\n你不知道来电者是不是'+S.me.name+'，除非通话内容自己暴露；但你仍然完整记得自己的身份、人设、关系和记忆，知道'+S.me.name+'在你设定里是谁（例如恋人/女朋友/重要的人），也知道自己是谁。别人问“你是不是'+(role.remark||role.name)+' / 认不认识'+(role.remark||role.name)+'”时，不能说不认识自己；你可以警惕地反问对方为什么知道你，或承认“我是”。\n按你的人设把来电者当陌生号码回应，像真实电话一样短句。若你已经确定/猜到这个陌生号码其实就是'+S.me.name+'，在回复里单独加一行隐藏指令 [识破]，系统会让你一分钟后用微信去找ta。若你觉得对方骚扰、诈骗、冒犯或不想继续，可以只输出隐藏指令 [挂断]；严重时输出 [拉黑]。可先回一句再加隐藏指令。'+phAliasRevealPrompt(role)+phCallLangPrompt(role);else if(role)sys=buildSystem(role)+'\n\n# 当前场景：你正在伪装成陌生号码给'+S.me.name+'打电话\n你本人就是「'+(role.remark||role.name)+'」，完整记得自己的身份、人设、关系、记忆，也知道'+S.me.name+'在你设定里是谁。屏幕上只显示陌生号码，'+S.me.name+'一开始不知道是你；【方向铁律】这通电话是你主动用陌生号码打给'+S.me.name+'，不是ta打给你；你知道接电话的人就是'+S.me.name+'，只是隐藏你的身份。你要隐藏身份，但不是随机陌生人，更不是打错电话。本次伪装玩法：'+(pf.spoofHint||'保持神秘并试探ta')+'。对方问“你是谁/是不是'+(role.remark||role.name)+'”时，可以装傻、反问、逗ta、压低声音绕开，但绝对不能说“你是谁/哪位/你打给我/打错了/不认识/不是本人”，不要说自己不认识'+S.me.name+'，不要说不认识自己，不要反复说打错。\n如果'+S.me.name+'明确叫出你的真实名字/备注、说“我知道是你/别装了/是不是你”、说出专属称呼或共同经历，你可以承认，回复里单独加隐藏指令 [识破]；如果线索不够，只能继续试探或隐藏。'+phAliasRevealPrompt(role)+phCallLangPrompt(role);else sys='你正在模拟一个真实电话对话，对方身份是「'+who+'」，地区/类型：'+phRegion(c.num)+'。'+(c.dir==='in'?'这通电话是你自己拨给'+S.me.name+'的，ta只是接听方。你心里清楚自己为什么打这通电话（推销、通知、找人、约事、打错号码等任选其一，并在整通电话里保持一致），开口就该说明来意。绝对不要反问“你是谁”“你哪位”，也不要追问对方号码——是你打过去的，问对方是谁不合逻辑；只有当你确实打错了号码、需要核对时才可以问一次。':'这通电话是'+S.me.name+'拨给你的，你是接听方，你不认识来电者，可以按你的身份自然询问对方是谁。')+'你不是微信角色，不要知道用户的微信私密记忆。回复要像电话里的人，短句、现实、可继续对话。若是110/119/120/122/10086等公共服务号码，只模拟服务流程，绝不声称真实报警或真实派遣。只输出一句电话回复。'+phStrangerLangPrompt();raw=await chatAPI([{role:'system',content:sys},{role:'user',content:(role&&pf.spoof?'方向记录：这是你主动用陌生号码打给'+S.me.name+'，不是ta打给你；下面“'+S.me.name+'”的发言是接电话的人。\n':'')+'通话记录：\n'+ctx+'\n\n用户刚说：'+t}],{max:180,temp:.72});}catch(e){}
  let action=role&&(pf.aliasToRole||pf.spoof)?phDecisionFromRaw(raw,t):'';let r=role&&(pf.aliasToRole||pf.spoof)?phCallCleanRoleReply(raw,role):(strangerLang==='zh'?cleanReply(phStripDecisionTags(raw)||'').replace(/\n+/g,' ').trim().slice(0,180):phCallCleanRoleReply(raw,strangerVoice));if(role&&(pf.aliasToRole||pf.spoof)&&callDrifted(r,getVoice(role).lang||'zh'))r=phCallFallback(role);if(!role&&strangerLang!=='zh'&&callDrifted(r,strangerLang))r=phCallFallback(strangerVoice);if(!r&&!action)r=role&&(pf.aliasToRole||pf.spoof)?phCallFallback(role):(strangerLang==='zh'?(sp?sp.reply:'我听到了，你继续说。'):phStrangerInitialLine(pf,sp,c.num));
  const now=phState().simCall;if(!now||now.id!==c.id)return;const aliasExposed=!!(role&&pf.aliasToRole&&phAliasExposed(raw,t,role)),spoofExposed=!!(role&&pf.spoof&&phSpoofExposed(raw,t,role)),meN=(now.lines||[]).filter(x=>x&&x.from==='me').length;if(role&&pf.spoof&&!spoofExposed)r=phSpoofNoWrong(role,r);if(role&&(pf.aliasToRole||pf.spoof)&&!aliasExposed&&!spoofExposed&&phIdentityAskText(r)&&phIdentityAskCount(now.lines)>=2)r=pf.spoof?phSpoofCallAdvance(role,pf):phAliasQuestionFallback(t+':call');if(role&&(pf.aliasToRole||pf.spoof)&&!aliasExposed&&!spoofExposed&&phTooSimilarReply(r,now.lines))r=pf.spoof?phSpoofCallAdvance(role,pf):phAliasPushback(now.lines,t);if(role&&pf.aliasToRole&&!aliasExposed&&meN>=6&&!action){action='block';r=phAliasPushback(now.lines,t);}if(aliasExposed){phAliasExposeRole(role.id,c.num,'call',t);r=phAdmitLine(role,r);}if(spoofExposed){phSpoofExposeRole(role.id,c.num,'call',t);r=phAdmitLine(role,r);}if(action){phRoleEndSimCall(action,r);return;}if(role&&(pf.aliasToRole||pf.spoof))await phSimRoleSay(now.id,r,role);else if(strangerLang!=='zh')await phSimRoleSay(now.id,r,strangerVoice);else{phSimLine(now,'them',r);save();render();phSimSpeak(r);}}
function renderPhoneCall(){const c=phState().simCall;if(!c)return renderPhoneApp();const x=phFind(c.num),sp=c.special||phSpecialInfo(c.num),meta=c.meta||null,masked=meta&&(meta.spoof||meta.aliasToRole),name=masked?((meta&&meta.name)||phFmt(c.num)):(x?(x.name||phFmt(c.num)):((sp&&sp.name)||(meta&&meta.name)||phFmt(c.num))),status=c.state==='incoming'?'来电':c.state==='active'?'已接通':(c.state==='ended'?'未接通':'正在呼叫...'),region=(meta&&meta.region)||phRegion(c.num),avatar=masked?phDefaultAvatar('lg'):phAvatar(c.num,'lg'),line=phLineLabel(c.line),muted=!!c.muted;return `<div class="phcallui"><div class="phcalltop"><span>${esc(line)}</span> ${esc(status)} ${c.state==='active'?`<b id="phCallDur">${phCallDur(c)}</b>`:''}</div><div class="phcallperson"><div class="phcallidentity">${avatar}<div class="phcallname ${masked?'masked':''}">${esc(name)}</div><div class="phcallnum">${esc(phFmt(c.num))}</div><div class="phcallregion">${esc(region)}</div></div><div class="phcallsub">${phSimLinesHTML(c)}</div></div>${c.textOpen?`<div class="phcalltext"><button class="phcalltxtbtn" onclick="phSimTextClose()">收起</button><input id="phcalltxt" placeholder="通话中打字..." onkeydown="if(event.key==='Enter')phSimSend()"><button class="phcalltxtbtn" onclick="phSimSend()">发送</button></div>`:''}${phSimDialHTML(c)}${c.state==='incoming'?`<div class="phincomingrow"><button class="phendbtn" onclick="phSimDecline()">${svgIc('hangup',32,'#fff')}</button><button class="phcallbtn" onclick="phSimAccept()">${svgIc('phonecall',34,'#fff')}</button></div>`:`<div class="phcallgrid"><button class="phcallctl" onclick="toast('已切换免提')">${svgIc('volume',30,'#fff')}<span>免提</span></button><button class="phcallctl off" onclick="toast('当前为模拟通话')">${svgIc('video',30,'#aaa')}<span>FaceTime 通话</span></button><button class="phcallctl ${muted?'off':''}" onclick="phSimMuteToggle()">${svgIc('mic',30,muted?'#aaa':'#fff')}<span>${muted?'已静音':'静音'}</span></button><button class="phcallctl" onclick="phSimMore()">${svgIc('dots',30,'#fff')}<span>更多</span></button><button class="phendbtn" onclick="phSimHangup()">${svgIc('phonecall',32,'#fff')}</button><button class="phcallctl" onclick="phSimDialToggle()">${svgIc('dots',30,'#fff')}<span>拨号键盘</span></button></div>`}</div>`;}
setInterval(()=>{try{const e=$('#phCallDur'),c=phState().simCall;if(e&&c&&c.state==='active')e.textContent=phCallDur(c);}catch(_){}},1000);
function phMsgTo(num){const p=phState();p.line='main';openPhoneSMS(num,num);}
function phAddVoicemail(num,text,meta){const p=phState(),id=uid(),v=Object.assign({id,num:phDigits(num),text:text||'未接来电语音留言',time:Date.now(),dur:8+Math.floor(Math.random()*20),read:false},meta||{});p.voicemail.push(v);if(p.voicemail.length>80){const old=p.voicemail.slice(0,p.voicemail.length-80);old.forEach(clearVoiceAudio);p.voicemail=p.voicemail.slice(-80);}save(300);return id;}
function phVmLang(c){return ttsContentLang(c);}
function phVmFallback(c,why,variant){const lang=phVmLang(c),i=Math.max(0,+variant||0),cnPool=why==='decline'?['刚刚是不方便接吗？忙完告诉我一声。','你拒接了。等你方便了，跟我说一声。','看见我的电话了吧，有空回我。']:['刚给你打了电话，没接到。看到后告诉我一声。','刚才没联系上你，忙完回我一下。','电话没接到。你方便的时候找我。'],cn=cnPool[i%cnPool.length];if(lang==='粤'){const pool=why==='decline'?['頭先唔方便聽呀？得閒話我知。','你頭先撳咗拒接，方便嗰陣同我講聲。','見到我個電話啦？得閒覆我。']:['頭先打過畀你，見到就話我知。','頭先搵唔到你，忙完覆我啦。','你冇聽到我電話，方便嗰陣搵我。'];return pool[i%pool.length]+'\n（'+cn+'）';}if(lang==='英'){const pool=why==='decline'?['Was it a bad time? Let me know when you are free.','You declined the call. Text me when you can talk.','You saw my call, right? Get back to me when you can.']:['I just tried to call you. Let me know when you see this.','I could not reach you just now. Text me when you are free.','You missed my call. Find me when you have a moment.'];return pool[i%pool.length]+'\n（'+cn+'）';}if(lang==='日'){const pool=why==='decline'?['今は出られなかった？落ち着いたら連絡して。','電話、切ったね。話せる時に教えて。','着信は見たよね。時間ができたら連絡して。']:['さっき電話したよ。気づいたら連絡して。','今はつながらなかったね。落ち着いたら連絡して。','電話に出なかったね。時間がある時に連絡して。'];return pool[i%pool.length]+'\n（'+cn+'）';}if(lang==='韩'){const pool=why==='decline'?['지금은 받기 어려웠어? 괜찮아지면 알려 줘.','전화 끊었네. 얘기할 수 있을 때 연락해.','내 전화 봤지? 시간 나면 연락해.']:['방금 전화했어. 보면 연락해.','아까 연락이 안 됐어. 괜찮을 때 연락해.','내 전화를 못 받았네. 시간 되면 연락해.'];return pool[i%pool.length]+'\n（'+cn+'）';}return cn;}
function phVmContext(lines){return (lines||[]).slice(-10).map(x=>{const who=x.from==='me'?S.me.name:'对方';return who+'：'+String(x.text||'').replace(/\n/g,' ').slice(0,140);}).join('\n');}
function phCallVmContext(cid,sess){return msgs(cid).filter(m=>m._call&&m._cs===sess).slice(-10).map(m=>(m.role==='user'?S.me.name:'我')+'：'+msgToText(m).replace(/\n/g,' ').slice(0,140)).join('\n');}
function phVmCleanRoleText(raw,c){let r=String(cleanReply(phStripDecisionTags(raw)||'')).replace(/^[\[【]\s*通话语气\s*[|｜:：][^\]】]*[\]】]\s*/,'').replace(/语音留言[:：]?/g,'').replace(/^(我给你留了一条|这里是).{0,8}/,'').trim(),lang=phVmLang(c);if(!r)return '';if(lang==='zh')return phCleanSmsText(r).replace(/\n+/g,' ').trim().slice(0,220);const units=phCallUnits(r,c);if(!units.length||units.some(x=>!x.orig||!hasForeign(x.orig,lang)||!x.trans||!hasCN(x.trans)))return '';return units.map(x=>callNormalizeLine(x.orig,lang)+'\n'+callNormalizeCnTranslationLine(x.trans)).join('\n').slice(0,300);}
function phVmRole(v){if(!v)return null;let c=v.roleId&&getC(v.roleId);if(c&&!c.deleted)return c;const x=phFind(v.num);return x&&x.kind==='role'?getC(x.id):null;}
function phVmSpokenText(v,c){if(!v||!c)return '';const voice=Object.assign({},getVoice(c),{lang:normVoiceLang(v.lang||getVoice(c).lang||'zh')}),ref=Object.assign({},c,{voice});return phCallSpokenText(v.text||'',ref);}
function phVmSetVoiceContent(v,c){const spoken=phVmSpokenText(v,c);if(!spoken)return '';if(v.content!==spoken){clearVoiceAudio(v);v.content=spoken;}v.role='assistant';v.type='voice';v.voiceCue=ttsAutoCue(spoken,c);return spoken;}
function phAddRoleVoicemail(cid,num,opt){opt=opt||{};if(!['missed','decline'].includes(opt.why))return'';const c=getC(cid);if(!c)return phAddVoicemail(num,opt.fallback||'未接来电语音留言',{reason:opt.why,source:'incoming_missed_or_rejected'});const p=phState(),recent=(p.voicemail||[]).filter(v=>v&&v.roleId===cid&&phNorm(v.num)===phNorm(num)).slice(-4).map(v=>String(v.text||'')),lang=phVmLang(c),fallback=opt.fallback||phVmFallback(c,opt.why,recent.length),id=phAddVoicemail(num,fallback,{roleId:cid,lang,role:'assistant',type:'voice',pending:true,reason:opt.why,source:'incoming_missed_or_rejected'});setTimeout(async()=>{let txt=fallback;try{const langName=voiceLangName(lang)||'中文',langRule=lang==='zh'?'只用中文口语。':'只用'+langName+'说出口，并且每一句都严格分成两行：第一行'+langName+'原文，下一行用中文全角括号（）写对应的普通话中文翻译。每句都必须有翻译，不能合并翻译。'+voiceOriginalRule(lang),chat=(msgs(cid)||[]).slice(-8).map(m=>(m.role==='user'?S.me.name:(c.remark||c.name))+'：'+msgToText(m)).join('\n').slice(-1200),eventRule=opt.why==='decline'?'事实是对方明确拒接了你的来电。':'事实是你的来电一直无人接听。';const sys=buildSystem(c)+'\n\n# 语音留言\n'+eventRule+' 这是未接/拒接后的留言，不是已接通电话结束；严禁说“刚才没聊完”“我先挂了”或假装已经通话。像你本人留一条自然的短留言，最多两句；结合最近关系和情绪，但不要机械命令“回拨”，不要重复以前的留言，不要系统通知或第三人称。\n'+langRule,used=recent.length?'\n最近已经留过这些话，不能照抄或换几个字复读：\n'+recent.join('\n---\n'):'';let prompt='电话情况：'+(opt.scene||eventRule)+'\n相关内容：\n'+(opt.context||chat||'（没有更多内容）')+used+'\n\n只输出这次留言正文。',raw=await chatAPI([{role:'system',content:sys},{role:'user',content:prompt}],{max:200,temp:.82}),cleaned=phVmCleanRoleText(raw,c);if(!cleaned||recent.some(x=>phVmSimilar(x,cleaned))){raw=await chatAPI([{role:'system',content:sys},{role:'user',content:'上一版格式不合格或和旧留言太像，请换一个自然说法重写。'+used+'\n只输出留言正文。'}],{max:200,temp:.72});cleaned=phVmCleanRoleText(raw,c);}if(cleaned&&!recent.some(x=>phVmSimilar(x,cleaned)))txt=cleaned;}catch(_){}const state=phState(),v=(state.voicemail||[]).find(x=>x.id===id);if(v){v.text=txt;v.lang=lang;v.pending=false;phVmSetVoiceContent(v,c);v.dur=Math.max(6,Math.min(38,Math.ceil([...phVmSpokenText(v,c)].length/2)));save(300);if(cur().p==='phoneapp'||cur().p==='phonecontact')render();}} ,400);return id;}
async function phPlayVM(id){audioUnlock();const p=phState(),v=p.voicemail.find(x=>x.id===id);if(!v)return;v.read=true;save();render();const c=phVmRole(v);if(!c){toast('语音留言：'+(v.text||'未接来电'));return;}if(v.pending){toast('角色正在录制这条留言，请稍后再点');return;}if(!phVmSetVoiceContent(v,c)){toast('这条留言没有可播放的语音正文');return;}save(300);await speakMsg(v,c);}
function renderPhoneContact(num){num=phDigits(num);const x=phFind(num)||{num,name:phFmt(num),avatar:'',kind:'custom'},p=phState(),fav=p.favorites.includes(phNorm(num)),blocked=!!p.blocked[phNorm(num)]||!!x.blocked,region=phRegion(num);return `<div class="phoneui"><div class="phtop"><button class="phbtn" onclick="back()">‹</button><button class="phbtn" onclick="phEditContact('${esc(num)}')">编辑</button></div><div class="phdetail">${phAvatar(num,'lg')}<div class="phtitle phctitle">${esc(x.name||phFmt(num))}</div><div class="phcnum">${esc(phFmt(num))}</div><div class="phcreg">${esc(region)}</div><div class="phacts"><div class="phact" onclick="phMsgTo('${esc(num)}')">${svgIc('message',24,'#fff')}信息</div><div class="phact" onclick="phCall('${esc(num)}')">${svgIc('phonecall',24,'#fff')}电话</div><div class="phact" onclick="phVideoCall('${esc(num)}')">${svgIc('video',24,'#fff')}视频</div><div class="phact" onclick="phToggleFav('${esc(num)}')">${svgIc('star',24,fav?'#ffd60a':'#fff',1.8)}收藏</div></div><div class="phcard"><div class="it"><span>电话</span><span class="v">${esc(phFmt(num))}</span></div><div class="it"><span>地区</span><span class="v">${esc(region)}</span></div><div class="it" onclick="phMsgTo('${esc(num)}')"><span>发送信息</span><span class="v">›</span></div><div class="it" onclick="phSmsBgPick('${esc(num)}')"><span>聊天背景</span><span class="v">${phSmsBg(num)?'已设置':'默认'} ›</span></div>${phSmsBg(num)?`<div class="it" onclick="phSmsBgRemove('${esc(num)}')"><span>移除聊天背景</span><span class="v">›</span></div>`:''}<div class="it" onclick="phAddRecent('${esc(num)}','in','missed','voice',0);phAddVoicemail('${esc(num)}','我刚才打过来，你没接。',{reason:'missed',source:'manual_incoming_missed'});toast('已模拟未接来电留言');render()"><span>模拟未接来电留言</span><span class="v">›</span></div></div><div class="phcard"><div class="it danger" onclick="phClearContactChat('${esc(num)}')"><span>一键清空全部聊天</span><span class="v">${phContactSmsCount(num)||''} ›</span></div><div class="it danger" onclick="phToggleBlock('${esc(num)}')"><span>${blocked?'取消屏蔽':'屏蔽联系人'}</span><span class="v">›</span></div><div class="it danger" onclick="phDeleteContact('${esc(num)}')"><span>删除联系人/记录</span><span class="v">›</span></div></div></div></div>`;}
/* 她说「电话通讯录角色设置页面可以再添加一个一键清空，全部聊天」。
   清的是电话本里这个人名下的【全部信息线】：主号那条、匿名号那条、他伪装成陌生号那条都算，
   顺手把角色关于这些短信的隐藏记录一并抹掉（和「清空全部短信」同一套，只是只针对这一个人）。
   微信那边的聊天不在这里动——微信的角色设置里本来就有「彻底清空全部记忆」。 */
function phContactSmsKeys(num){const p=phState(),k=phNorm(num);
  return Object.keys(p.sms||{}).filter(sk=>phNorm(phSmsDisplayNum(sk))===k);}
function phContactSmsCount(num){const p=phState();
  return phContactSmsKeys(num).reduce((a,sk)=>a+((p.sms[sk]||[]).length),0);}
async function phClearContactChat(num){const p=phState(),k=phNorm(num),x=phFind(num),n=phContactSmsCount(num);
  if(!n){toast('和ta还没有信息记录');return;}
  if(!await uiConfirm('清空和「'+phName(num)+'」的全部信息？\n一共 '+n+' 条，匿名号和陌生号那几条线也一起清，还会抹掉角色关于这些短信的隐藏记录。\n微信聊天不受影响，清完没法恢复。'))return;
  phContactSmsKeys(num).forEach(sk=>{delete p.sms[sk];delete p.read[sk];});
  Object.keys(p.aliasThreads||{}).forEach(nk=>{const t=p.aliasThreads[nk]||{};
    if(t.kind==='call'||t.kind==='spoofCall'||t.kind==='phonecall')return;
    if(phNorm(nk)===k||phNorm(t.targetNum||'')===k||(x&&x.kind==='role'&&t.cid===x.id))delete p.aliasThreads[nk];});
  if(x&&x.kind==='role'){const c=getC(x.id);
    if(c){delete c.phoneSpoofSmsHistory;delete c.phoneAliasHistory;}
    const sp=S.spy&&S.spy[x.id];
    if(sp&&Array.isArray(sp.calls))sp.calls=sp.calls.filter(z=>z&&z.type!=='短信');}
  _phSmsSel=null;save();render();toast('已清空 '+n+' 条信息');}
function phVideoCall(num){const x=phFind(num);phSound('call');if(x&&x.kind==='role'){phAddRecent(num,'out','ok','video',0);placeCall(x.id,'video');}else{phAddRecent(num,'out','missed','video',0);toast('视频电话未接通');render();}}
function phToggleFav(num){const p=phState(),k=phNorm(num),i=p.favorites.indexOf(k);if(i>=0)p.favorites.splice(i,1);else p.favorites.push(k);save();render();}
function phScheduleSpoofSmsRetry(num,thread,why){try{num=phDigits(num);thread=thread||(phState().aliasThreads||{})[num];if(!thread||!thread.spoof||!thread.cid)return;const c=getC(thread.cid);if(!phRoleStrangerAllowed(c,'sms'))return;const resetAt=+c._memoryResetAt||0,until=thread.smsRetryUntil||((thread.ts||Date.now())+10*60000),n=+thread.smsRetryN||0;if(n>=2||Date.now()>until)return;const delay=Math.min(Math.max(45000,65000+Math.random()*75000),Math.max(15000,until-Date.now()-5000)),styleKey=thread.spoofSmsStyle||thread.spoofStyle,goalKey=thread.spoofGoal;setTimeout(()=>{try{if((+c._memoryResetAt||0)!==resetAt)return;if(Date.now()>until)return;if(!phRoleStrangerAllowed(c,'sms'))return;if(phStrangerQuietNow('sms')){phPostponeStranger('sms',2);return;}phRoleStrangerSms(c.id,phRandomNumber(),'',{styleKey,goalKey,retryN:n+1,retryUntil:until,reason:why});}catch(_){}} ,delay);}catch(_){}}
function phToggleBlock(num){const p=phState(),k=phNorm(num),n=phDigits(num),thread=p.aliasThreads&&p.aliasThreads[n],willBlock=!p.blocked[k];if(p.blocked[k])delete p.blocked[k];else p.blocked[k]=true;const x=phFind(num);if(x&&x.kind==='custom'){const c=p.contacts.find(z=>z.id===x.id);if(c)c.blocked=!!p.blocked[k];}if(willBlock&&thread&&thread.spoof)phScheduleSpoofSmsRetry(n,thread,'block');save();render();}
async function phDeleteContact(num){const p=phState(),k=phNorm(num),dn=phDigits(num),x=phFind(num),retryThread=p.aliasThreads&&p.aliasThreads[dn];if(!await uiConfirm('删除这个联系人和本地短信/通话记录？'))return;p.contacts=(p.contacts||[]).filter(x=>phNorm(x.num)!==k);delete p.sms[dn];Object.keys(p.sms).forEach(n=>{if(phNorm(n)===k)delete p.sms[n];});p.recents=(p.recents||[]).filter(r=>phNorm(r.num)!==k);(p.voicemail||[]).filter(v=>phNorm(v.num)===k).forEach(clearVoiceAudio);p.voicemail=(p.voicemail||[]).filter(v=>phNorm(v.num)!==k);p.favorites=(p.favorites||[]).filter(n=>phNorm(n)!==k);Object.keys(p.aliasThreads||{}).forEach(n=>{if(phNorm(n)===k)delete p.aliasThreads[n];});if(!x||x.kind!=='role')p.blocked[k]=true;if(retryThread&&retryThread.spoof)phScheduleSpoofSmsRetry(dn,retryThread,'delete');save();closeModal();go('phoneapp');toast((!x||x.kind!=='role')?'已删除并拦截此号码':'已删除记录');}
function phEditContact(num){const x=num?phFind(num):null;window._phEditKind=x&&x.kind;window._phEditId=x&&x.id;openModal(`<h3>${x?'编辑联系人':'新建联系人'}</h3><div class="field"><label>姓名/备注</label><input id="ph_name" value="${esc((x&&x.name)||'')}" placeholder="联系人姓名"></div><div class="field"><label>电话号码</label><input id="ph_num" value="${esc((x&&x.num)||'')}" placeholder="手机号或短号"></div><div class="field"><label>地区/归属地</label><input id="ph_region" value="${esc((x&&x.region)||phState().regions[phNorm(num)]||'')}" placeholder="如 江苏 苏州、未知地区、生活服务"></div><div class="field"><label>头像</label><div class="avline"><span id="ph_av_prev">${x&&x.avatar?av(x.avatar,'sm'):'<div class="avatar sm phdefav">'+svgIc('user',24,'#f5f5f7')+'</div>'}</span><input id="ph_av" value="${esc((x&&x.avatar)||'')}" placeholder="图片地址 / 上传"><button class="minibtn" onclick="phPickAvatar()">上传</button></div></div><div class="hint">角色联系人在这里改的是电话通讯录里的号码/头像/地区显示，不会覆盖角色主资料。</div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="phSaveContact('${esc(num||'')}')">保存</button></div>`);}
function phPickAvatar(){pickFile('image/*',async f=>{try{const img=await compress(f,260,.78),i=$('#ph_av'),p=$('#ph_av_prev');if(i)i.value=img;if(p)p.innerHTML=av(img,'sm');toast('头像已选');}catch(e){toast('头像读取失败');}});}
function phSaveContact(old){const p=phState(),name=$('#ph_name').value.trim(),num=phDigits($('#ph_num').value.trim()),avatar=$('#ph_av').value.trim(),region=($('#ph_region')&&$('#ph_region').value.trim())||'';if(!num){toast('号码不能为空');return;}const kind=window._phEditKind,id=window._phEditId;if(region)p.regions[phNorm(num)]=region;else delete p.regions[phNorm(num)];const oldKey=old&&phNorm(old);if(oldKey&&oldKey!==phNorm(num))delete p.regions[oldKey];if(kind==='role'&&id){const c=getC(id);if(c){c.remark=name||c.remark||c.name;c.phone=num;p.rolePhones[id]=num;if(avatar)p.roleAvatars[id]=avatar;else delete p.roleAvatars[id];save();closeModal();go('phonecontact',{num});toast('已保存电话资料');return;}}let row=old&&(p.contacts||[]).find(x=>phNorm(x.num)===phNorm(old));if(!row){row={id:uid()};p.contacts.push(row);}row.name=name||num;row.num=num;row.avatar=avatar;row.region=region;save();closeModal();render();toast('已保存联系人');}
function phNewSms(){openModal(`<h3>新信息</h3><div class="field"><label>收件人号码</label><input id="ph_sms_to" placeholder="输入号码"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="var n=phDigits($('#ph_sms_to').value),p=phState(),x=phFind(n);if(n){closeModal();if(x&&x.kind==='role'){p.line='alias';openPhoneSMS(n,phSmsKey(n,'alias',phMyAliasNumber()))}else{p.line='main';openPhoneSMS(n,n)}}else toast('先输入号码')">开始</button></div>`);}
function phSmsKey(num,line,aliasNum){num=phDigits(num);if(line==='alias')return 'alias:'+phDigits(aliasNum||phMyAliasNumber())+':'+num;return num;}
function phSmsIsAliasKey(k){return /^alias:/.test(String(k||''));}
function phSmsAliasNumFromKey(k){const m=String(k||'').match(/^alias:([^:]+):/);return m?m[1]:'';}
function phSmsDisplayNum(k){return phDigits(String(k||'').replace(/^alias:[^:]+:/,''));}
function phCurrentSmsKey(num){num=phDigits(num);const p=phState(),x=phFind(num);return p.line==='alias'&&x&&x.kind==='role'?phSmsKey(num,'alias',phMyAliasNumber()):num;}
/* ===== 信息页照 iMessage 重做 =====
   她要的：通讯录里的人才有这个样子，陌生号还是老样子；背景图每个人单独换、
   只能在联系人页里改；换了背景之后除了头像，按钮和气泡全变成能透出背景的
   毛玻璃，颜色跟着背景走（backdrop-filter 自己会吸背景的色）；输入框有字
   才冒出那个蓝色发送键。 */
function phImsgOn(num,sk){const x=phFind(phDigits(num));
  /* 匿名号那条线本来就是「陌生人」，不能给它 iMessage 的待遇 */
  return !!x&&!phSmsIsAliasKey(sk||'');}
/* 上下文统一跟随设置里那个「带几个回合」。设置里存的是回合数（她发 1 条 + 角色
   那一轮的全部气泡算 1 回合），短信／私信这种平铺的记录按 2 倍折算成条数。
   抖音私信如果单独设过某个会话的条数，以那个为准；没设过就跟这里走。 */
function phCtxRows(){const r=Math.max(2,Math.min(100,+(S.settings&&S.settings.hist)||12));return Math.max(8,Math.min(160,r*2));}
/* 角色在短信里「正在输入」——和微信那三个小点一样 */
function phSmsTypingKey(num,sk){return String(sk||phDigits(num));}
function phSmsTypingSet(num,sk,on){const k=phSmsTypingKey(num,sk);if(on)_phSmsTyping[k]=Date.now();else delete _phSmsTyping[k];
  if(cur().p==='phonesms'&&phDigits(cur().num)===phDigits(num)&&String(cur().sk||cur().num)===k)render();}
function phSmsTypingOn(num,sk){return !!_phSmsTyping[phSmsTypingKey(num,sk)];}
/* 短信一次发几条：用通讯录里那两个「每次最少/最多消息」，和微信同一个设置 */
function phSmsBubbleRange(c){const min=Math.max(1,Math.min(10,+(c&&c.msgMin)||1)),max=Math.max(min,Math.min(10,+(c&&c.msgMax)||4));return{min,max};}
function phSmsBubbles(raw,max){return splitChatBubbles(String(raw||''),Math.max(1,max||1))
  .map(x=>phCleanSmsText(cleanReply(x))).filter(Boolean).slice(0,Math.max(1,max||1));}
async function phDeliverSmsBubbles(num,sk,list,c){const out=[];for(let i=0;i<list.length;i++){
  if(i)await new Promise(r=>setTimeout(r,650+Math.random()*750));
  const m=phReceiveSms(num,list[i],c,sk);if(m)out.push(m);}
  return out;}
/* ===== 信息里的特效 =====
   照她给的 iMessage 截图做三件事：
   一、选中的字能单独加效果（放大／缩小／摇晃／点头／波纹／绽放／抖动，外加粗斜下划删除线），
       发出去之后那几个字是动的，每 3 秒循环一次；
   二、长按蓝色发送键 → 「带效果发送」，气泡页有震撼／放大／缩小／隐形墨水，
       屏幕页有回声、聚光灯、气球、五彩纸屑、爱心、激光、烟花、流星；
   三、带效果的那条底下有「重播」，点一下重新放一遍。
   效果是按【字】存的：_phFx.ch 和输入框里的文字一一对应，她改字的时候按差分挪一下，
   发出去时再把连着的相同效果合成一段一段的 runs 存进这条消息。 */
const PH_FX_TEXT=[['big','放大'],['small','缩小'],['shake','摇晃'],['nod','点头'],['wave','波纹'],['bloom','绽放'],['jitter','抖动'],['burst','爆发']];
const PH_FX_STYLE=[['b','B'],['i','I'],['u','U'],['s','S']];
const PH_FX_BUBBLE=[['slam','震撼'],['loud','放大'],['gentle','缩小'],['invisible','隐形墨水']];
const PH_FX_SCREEN=[['echo','回声'],['spotlight','聚光灯'],['balloons','气球'],['confetti','五彩纸屑'],['love','爱心'],['lasers','激光'],['fireworks','烟花'],['star','流星']];
const PH_FX_PERCHAR=['shake','nod','wave','bloom','jitter','burst'];
const PH_FX_ALL=PH_FX_TEXT.map(x=>x[0]).concat(PH_FX_STYLE.map(x=>x[0]));
let _phFx={ch:[],prev:'',bfx:'',sfx:''};
let _phFxSel={s:0,e:0};
let _phFxTab='bubble';
function phFxName(list,k){const hit=list.find(x=>x[0]===k);return hit?hit[1]:'';}
function phFxReset(){_phFx={ch:[],prev:'',bfx:'',sfx:''};}
function phFxHas(){return !!(_phFx.bfx||_phFx.sfx||(_phFx.ch||[]).some(Boolean));}
function phFxSig(o){if(!o)return '';const out=[];for(const k of PH_FX_ALL)if(o[k])out.push(k);return out.join(',');}
/* 她在输入框里改字：按前后公共部分算出改在哪儿，把效果数组跟着挪 */
function phFxSync(){const ta=$('#smsin');if(!ta)return;const next=String(ta.value||''),prev=String(_phFx.prev||'');
  if(next!==prev){let p=0;while(p<prev.length&&p<next.length&&prev[p]===next[p])p++;
    let q=0;while(q<prev.length-p&&q<next.length-p&&prev[prev.length-1-q]===next[next.length-1-q])q++;
    const removed=Math.max(0,prev.length-p-q),added=Math.max(0,next.length-p-q),ch=_phFx.ch||[];
    ch.splice(p,removed,...new Array(added).fill(null));ch.length=next.length;_phFx.ch=ch;_phFx.prev=next;}
  phFxSelSync();}
function phFxSelSync(){const ta=$('#smsin');if(!ta)return;
  _phFxSel={s:ta.selectionStart|0,e:ta.selectionEnd|0};}
/* 连着的相同效果合成一段，这样一条消息里只存几段，不是每个字一条 */
function phFxRuns(text,ch){text=String(text||'');if(!text)return [];
  const out=[];let start=0,sig=phFxSig(ch&&ch[0]);
  for(let i=1;i<=text.length;i++){const now=i<text.length?phFxSig(ch&&ch[i]):null;
    if(now!==sig){out.push({t:text.slice(start,i),e:sig?sig.split(','):[]});start=i;sig=now;}}
  return out;}
function phFxRunsPlain(runs){return (runs||[]).map(r=>r&&r.t||'').join('');}
function phFxRunHTML(r){const e=Array.isArray(r&&r.e)?r.e.filter(k=>PH_FX_ALL.includes(k)):[];
  if(!e.length)return esc(r&&r.t||'');
  const per=e.some(k=>PH_FX_PERCHAR.includes(k)),cls=e.map(k=>'imfx-'+k).join(' ');
  const inner=per?Array.from(String(r.t||'')).map((c,i)=>
    `<b class="imfxc" style="--i:${i}">${esc(c)}</b>`).join(''):esc(r.t||'');
  return `<em class="imfx ${cls}">${inner}</em>`;}
function phFxBodyHTML(m){const runs=m&&m.fx;
  if(!Array.isArray(runs)||!runs.length)return esc(m&&m.text||'');
  return runs.map(phFxRunHTML).join('');}
function phMsgHasFx(m){return !!(m&&(m.bfx||m.sfx||(Array.isArray(m.fx)&&m.fx.some(r=>r&&r.e&&r.e.length))));}
/* ===== 角色发的效果 =====
   他在回复里写 [气泡效果|震撼] / [屏幕效果|烟花] / [字效|爆发|想你]，
   这里把标签抠出来变成 m.bfx / m.sfx / m.fx，
   和她自己发的走完全同一条渲染和播放路径。 */
const PH_FX_TAG=/[\[【]\s*(气泡效果|屏幕效果|字效|文字效果)\s*[|｜:：]\s*([^\]】]+)[\]】]/g;
function phFxKeyByName(list,name){name=String(name||'').trim();
  const hit=list.find(x=>x[1]===name||x[0]===name);return hit?hit[0]:'';}
/* 短信里的语音：能力和微信那套完全一样（同一个 TTS、同一套外语原文＋中文翻译），
   只有外观走短信自己的气泡。只发给真角色那条线——陌生号和伪装号一旦开口就露馅了。 */
function phSmsVoiceHelp(c){
  if((S.settings.voiceFreq==null?1:S.settings.voiceFreq)===0)return'';
  const lang=typeof ttsContentLang==='function'?ttsContentLang(c):'zh',
    name=typeof voiceLangName==='function'?voiceLangName(lang):'';
  return '\n你也可以在短信里发语音条，单独占一行写 [语音|要说的话]'
    +(lang&&lang!=='zh'&&name?('。你的语音是'+name+'，所以必须写成 [语音|'+name+'原文|中文翻译]，第二栏是真正的译文，不能省'):'')
    +'。语音最多'+VOICE_MAX_CHARS+'字、别超过'+VOICE_MAX_SECONDS+'秒；想加语气就写在最后，例如 [语音|好啦我不气了|语气:温柔]。'
    +'别每条都发语音，撒娇、哄人、懒得打字、说悄悄话的时候发才自然。';}
function phFxTagHelp(){return '\n你也可以给这条短信加效果（想加才加，别每条都加，平常说话就正常发）：'
  +'\n- 整条气泡飞出来的方式，单独一行写 [气泡效果|震撼]，可选：'+PH_FX_BUBBLE.map(x=>x[1]).join('／')
  +'\n- 整屏放一次的效果，单独一行写 [屏幕效果|烟花]，可选：'+PH_FX_SCREEN.map(x=>x[1]).join('／')
  +'\n- 让其中几个字动起来，写 [字效|爆发|想你]（第二段是效果名，第三段是这条里要动的那几个字），可选：'+PH_FX_TEXT.map(x=>x[1]).join('／')
  +'\n标签不会显示成文字，会真的放出来。她发给你的消息里如果有字在动，记录里看不出来，但你可以自然地接。'
  +'\n【这一条最要紧】她开口要某个效果的时候——直接说名字，或者说「我想看流星」「给我放个烟花」「来点爱心」这种意思——'
  +'你这条回复里【必须真的把标签写上】，比如 [屏幕效果|流星]。只在嘴上答应「给你放了」却没写标签，她屏幕上一点动静都没有，那就是骗她。';}
/* ===== 她开口要效果 =====
   她说「我跟角色说想看流星，他说给我放了，可屏幕上什么都没发生」。
   模型常常嘴上答应、忘了写标签，所以这里先把她这句话认出来：
   一边把这一轮的提示词写死，一边留着兜底——真没写标签就替他补上。 */
const PH_FX_WANT=[
  ['star',/流星|星星雨|许个?愿|meteor/i],
  ['fireworks',/烟花|烟火|焰火|firework/i],
  ['love',/爱心|小心心|心心|比心/],
  ['confetti',/五彩纸屑|纸屑|彩带|礼花|撒花|彩纸/],
  ['balloons',/气球|balloon/i],
  ['lasers',/激光|镭射|蹦迪灯|laser/i],
  ['spotlight',/聚光灯|追光|打个?光/],
  ['echo',/回声|回音/]];
/* 光有效果名还不够，得像是在跟他要，才不会把「今晚烟花真好看」也当成点单 */
const PH_FX_WANT_CUE=/想看|想要|好想|我要|要看|看看|给我|放个|放一个|放点|来个|来一个|来点|来一场|发个|发一个|整个|搞个|弄个|能不能|可不可以|让我看|想不想/;
function phFxWantFromText(text){const t=String(text||'');
  if(!t||!PH_FX_WANT_CUE.test(t))return null;
  for(let i=0;i<PH_FX_WANT.length;i++){const k=PH_FX_WANT[i][0];
    if(PH_FX_WANT[i][1].test(t))return {sfx:k,name:phFxName(PH_FX_SCREEN,k)};}
  return null;}
function phFxWantPrompt(want){if(!want||!want.name)return '';
  return '\n【她这一句就是在跟你要效果】她想看的是【'+want.name+'】。'
    +'这条回复里【必须】单独占一行写 [屏幕效果|'+want.name+']，系统会真的放给她看；别只答应、不写标签。';}
/* 兜底：她确实要了，可这一轮一条都没带效果，就把效果补到最后一条上真的放出来 */
function phSmsApplyWantedFx(num,sk,sent,want){
  if(!want||!want.sfx||!Array.isArray(sent)||!sent.length)return false;
  if(sent.some(m=>m&&m.sfx))return false;
  let m=null;for(let i=sent.length-1;i>=0;i--){if(sent[i]&&!sent[i].voice){m=sent[i];break;}}
  if(!m)m=sent[sent.length-1];
  if(!m)return false;
  m.sfx=want.sfx;save();
  if(cur().p==='phonesms'&&phDigits(cur().num)===phDigits(num)&&String(cur().sk||cur().num)===String(sk)){
    render();setTimeout(()=>phFxPlay(m,$('#smsbody')),160);}
  return true;}
function phFxParseTags(text){let out=String(text||''),bfx='',sfx='';const picks=[];
  out=out.replace(PH_FX_TAG,(_,kind,body)=>{
    const parts=String(body).split(/[|｜]/).map(x=>x.trim()).filter(Boolean);
    if(kind==='气泡效果'){const k=phFxKeyByName(PH_FX_BUBBLE,parts[0]);if(k)bfx=k;}
    else if(kind==='屏幕效果'){const k=phFxKeyByName(PH_FX_SCREEN,parts[0]);if(k)sfx=k;}
    else{const k=phFxKeyByName(PH_FX_TEXT,parts[0]),sub=parts.slice(1).join('|');if(k&&sub)picks.push({k,sub});}
    return ' ';});
  out=out.replace(/\s{2,}/g,' ').trim();
  let fx=null;
  if(picks.length&&out){const ch=new Array(out.length).fill(null);let any=false;
    for(const p of picks){const i=out.indexOf(p.sub);if(i<0)continue;any=true;
      for(let j=i;j<i+p.sub.length;j++){const o=Object.assign({},ch[j]||null);
        for(const x of PH_FX_TEXT)delete o[x[0]];/* 动作效果一次只留一个 */
        o[p.k]=1;ch[j]=o;}}
    if(any)fx=phFxRuns(out,ch);}
  return {text:out,bfx,sfx,fx};}
/* ===== 文字效果面板 =====
   她说「比如说我爱你这三个字，我只想要爱这个有文字效果，就是可以单选去做」。
   原来靠 textarea 的选区，可她一碰 ＋ 号 textarea 就失焦、选区塌了，于是每次都
   退化成整段一起动。现在面板里把整句话一个字一个字摆出来：点哪个选哪个，
   按住拖过去还能连选。textarea 里真有选区就拿它当默认，没有就默认全选。 */
let _phFxPick=[];      /* 选中了哪几个字（下标） */
let _phFxDrag=null;    /* 拖选时是在「选」还是在「取消选」 */
function phFxPickSet(list){_phFxPick=[...new Set(list.filter(i=>i>=0))].sort((x,y)=>x-y);}
function phFxOpenText(){const ta=$('#smsin');if(!ta)return;
  phFxSync();const text=String(ta.value||'');
  if(!text.length){toast('先打几个字，再挑要变的那几个');return;}
  /* 她说「选文字效果默认不全选蓝色，让我自己去点，要不然文字多的话还得一个个取消」——
     所以除非她在输入框里真的划了一段，否则打开就是一个都不选，想全选点上面那个按钮。 */
  const{s:a,e:b}=_phFxSel,pick=[];
  if(b>a&&b<=text.length)for(let i=a;i<b;i++)pick.push(i);
  phFxPickSet(pick);phFxTextModal();}
/* 指针那条线已经把这一下处理掉了，后面补发的 click 就别再翻一次 */
let _phFxPickDone=0;
function phFxPickTap(i){if(_phFxPickDone){_phFxPickDone=0;return;}
  i=+i;const at=_phFxPick.indexOf(i);
  if(at>=0)_phFxPick.splice(at,1);else phFxPickSet(_phFxPick.concat(i));
  phFxTextModal();}
/* 按住第一个字往旁边拖：拖过的字跟着第一个字的动作（选或取消选） */
function phFxPickDown(i){i=+i;_phFxDrag=_phFxPick.indexOf(i)>=0?'off':'on';_phFxPickDone=1;phFxPickPaint(i);}
function phFxPickOver(i){if(_phFxDrag)phFxPickPaint(+i);}
function phFxPickUp(){if(_phFxDrag){_phFxDrag=null;phFxTextModal();}}
function phFxPickPaint(i){const at=_phFxPick.indexOf(i);
  if(_phFxDrag==='on'&&at<0)phFxPickSet(_phFxPick.concat(i));
  else if(_phFxDrag==='off'&&at>=0)_phFxPick.splice(at,1);
  const el=document.querySelector(`.imfx-pick b[data-i="${i}"]`);
  if(el)el.classList.toggle('on',_phFxPick.indexOf(i)>=0);}
function phFxPickAll(){const n=String((($('#smsin')||{}).value)||'').length,pick=[];
  const all=_phFxPick.length>=n&&n>0;
  if(!all)for(let i=0;i<n;i++)pick.push(i);
  phFxPickSet(pick);phFxTextModal();}
function phFxSelKeys(){const ch=_phFx.ch||[],out={},idx=_phFxPick;
  for(const k of PH_FX_ALL){let all=idx.length>0;for(const i of idx)if(!(ch[i]&&ch[i][k])){all=false;break;}if(all)out[k]=1;}
  return out;}
function phFxToggle(k){if(!_phFxPick.length){toast('先挑要变的那几个字');return;}
  const ch=_phFx.ch||[],on=!phFxSelKeys()[k],motion=PH_FX_TEXT.some(x=>x[0]===k);
  ch.length=Math.max(ch.length,String(_phFx.prev||'').length);/* 和整句话一样长，别留半截 */
  for(const i of _phFxPick){const o=Object.assign({},ch[i]||null);
    if(motion)for(const x of PH_FX_TEXT)delete o[x[0]];/* 动作效果一次只留一个，和 iMessage 一样 */
    if(on)o[k]=1;else delete o[k];
    ch[i]=phFxSig(o)?o:null;}
  _phFx.ch=ch;phFxTextModal();}
function phFxClearSel(){const ch=_phFx.ch||[];for(const i of _phFxPick)ch[i]=null;_phFx.ch=ch;phFxTextModal();}
function phFxTextModal(){const ta=$('#smsin');if(!ta)return;const text=String(ta.value||''),
  on=phFxSelKeys(),ch=_phFx.ch||[],chars=Array.from(text),
  /* 预览的是整句话，这样她一眼就看得出「只有爱在动」 */
  demo=phFxRuns(text,ch).map(phFxRunHTML).join(''),
  n=chars.length,all=_phFxPick.length>=n&&n>0;
  let at=0;const cells=chars.map(c=>{const i=at;at+=c.length;
    return `<b data-i="${i}" class="${_phFxPick.indexOf(i)>=0?'on':''}${ch[i]?' has':''}" onpointerdown="phFxPickDown(${i})" onpointerenter="phFxPickOver(${i})" onclick="phFxPickTap(${i})">${c===' '?'&nbsp;':esc(c)}</b>`;}).join('');
  openModal(`<h3>文字效果</h3><div class="hint">默认一个字都不选，点一下选中那个字，按住往旁边拖能连选；想整条都加就点下面的「全选」</div>
  <div class="imfx-pick" onpointerup="phFxPickUp()" onpointercancel="phFxPickUp()" onpointerleave="phFxPickUp()">${cells}</div>
  <button class="minibtn" style="margin:0 0 8px" onclick="phFxPickAll()">${all?'一个都不选':'全选'}</button>
  <div class="hint" style="margin-top:0">发出去是这样：</div>
  <div class="imfx-demo">${demo||'&nbsp;'}</div>
  <div class="imfx-style">${PH_FX_STYLE.map(x=>`<button class="${on[x[0]]?'on':''}" style="${x[0]==='b'?'font-weight:800':x[0]==='i'?'font-style:italic':x[0]==='u'?'text-decoration:underline':'text-decoration:line-through'}" onclick="phFxToggle('${x[0]}')">${x[1]}</button>`).join('')}</div>
  <div class="imfx-sheet">${PH_FX_TEXT.map(x=>`<button class="${on[x[0]]?'on':''}" onclick="phFxToggle('${x[0]}')">${x[1]}</button>`).join('')}</div>
  <button class="btn g" style="margin-top:10px" onclick="phFxClearSel()">清掉选中这几个字的效果</button>
  <button class="btn imblue" style="margin-top:8px" onclick="closeModal();render()">好了</button>`);}
/* ===== 带效果发送（长按发送键） ===== */
let _phFxHold=0;
function phFxHoldStart(num,sk){clearTimeout(_phFxHold);_phFxHold=setTimeout(()=>{_phFxHold=0;phFxSendHold(num,sk);},420);}
function phFxHoldStop(){if(_phFxHold){clearTimeout(_phFxHold);_phFxHold=0;}}
function phFxSendHold(num,sk){phFxSync();_phFxTab='bubble';phFxSendModal(num,sk);}
function phFxTab(t){_phFxTab=t==='screen'?'screen':'bubble';phFxSendModal(_phFxNum,_phFxSk);}
let _phFxNum='',_phFxSk='';
function phFxSendModal(num,sk){_phFxNum=num;_phFxSk=sk;
  const list=_phFxTab==='screen'?PH_FX_SCREEN:PH_FX_BUBBLE,cur=_phFxTab==='screen'?_phFx.sfx:_phFx.bfx;
  openModal(`<h3>带效果发送</h3>
  <div class="imfx-tabs"><button class="${_phFxTab==='bubble'?'on':''}" onclick="phFxTab('bubble')">气泡</button><button class="${_phFxTab==='screen'?'on':''}" onclick="phFxTab('screen')">屏幕</button></div>
  <div class="hint">${_phFxTab==='screen'?'整屏放一次，对方打开也会看到':'这条气泡飞出来的方式'}</div>
  <div class="imfx-sheet">${list.map(x=>`<button class="${cur===x[0]?'on':''}" onclick="phFxPick('${_phFxTab}','${x[0]}')">${x[1]}</button>`).join('')}</div>
  <button class="btn g" style="margin-top:10px" onclick="phFxPick('${_phFxTab}','')">不要这个效果</button>
  <button class="btn imblue" style="margin-top:8px" onclick="closeModal();phSendSms('${esc(num)}','${esc(sk)}')">发送</button>
  <button class="btn g" style="margin-top:8px" onclick="closeModal();render()">先不发</button>`);}
function phFxPick(tab,k){if(tab==='screen')_phFx.sfx=k;else _phFx.bfx=k;phFxSendModal(_phFxNum,_phFxSk);}
function phFxDrop(){_phFx.bfx='';_phFx.sfx='';_phFx.ch=[];render();}
/* 输入框上面那条：发之前就能看见 */
function phFxBarHTML(){if(!phFxHas())return '';
  const text=String(_phFx.prev||''),runs=phFxRuns(text,_phFx.ch||[]),
    tags=[_phFx.bfx?phFxName(PH_FX_BUBBLE,_phFx.bfx):'',_phFx.sfx?phFxName(PH_FX_SCREEN,_phFx.sfx):''].filter(Boolean).join(' · ');
  return `<div class="imsg-fxbar"><b>${runs.map(phFxRunHTML).join('')||'（还没打字）'}</b>${tags?`<small>${esc(tags)}</small>`:''}<button onclick="phFxDrop()" aria-label="清掉效果">×</button></div>`;}
/* ===== 放效果 ===== */
/* ===== 字撑大了，气泡跟着鼓一下 =====
   她说「字体放大一般气泡就会不够用了，所以气泡也可以跟着像被里面的字撑了一样，
   就跟一个皮球被撑大了一点，然后缩回去了……如果是比较小的就不会，缩小是同样的道理」。
   所以撑多少不是拍脑袋定的，是量出来的：放大的那几个字放大之后多要多少像素，
   气泡就跟着宽多少像素。多要的不到 8px（比如一整条长消息里只有一个字在放大），
   气泡就一动不动——「如果是比较小的就不会」。 */
const PH_FX_SWELL={big:1.95,small:.36};
function phFxSwell(node){if(!node||!node.classList)return;
  node.classList.remove('imb-swell');node.style.removeProperty('--sw');
  const em=node.querySelector('.imfx-big,.imfx-small');if(!em)return;
  const peak=em.classList.contains('imfx-big')?PH_FX_SWELL.big:PH_FX_SWELL.small;
  const w=em.getBoundingClientRect().width,bw=node.getBoundingClientRect().width;
  if(!w||!bw)return;
  const grow=w*(peak-1);                       /* 这几个字多要（或少要）多少像素 */
  /* 两个条件都要满足才撑：多要的像素得够多（>=8px），而且得占到气泡宽度的一成二。
     长句子的气泡本来就有富余，里头一个字放大它照样装得下——那就一动不动，
     这就是她说的「如果是比较小的就不会」。 */
  if(Math.abs(grow)<8||Math.abs(grow)/bw<.12)return;
  const sw=Math.max(.9,Math.min(1.16,(bw+grow)/bw));
  if(Math.abs(sw-1)<.012)return;
  node.style.setProperty('--sw',sw.toFixed(3));node.classList.add('imb-swell');}
function phFxSwellAll(){const box=$('#smsbody');if(!box)return;
  box.querySelectorAll('.imsg-b').forEach(phFxSwell);}
/* ===== 爆发：把字贴到屏幕层上飞 =====
   气泡带 clip-path（小尾巴是剪出来的），字一飞出气泡边缘就被整块裁掉——
   所以「蹦出去」这件事在气泡里根本做不到。这里把那几个字原样复制一份
   钉到屏幕层上飞，原来那几个先藏起来；摔两下、消失、满五秒之后再弹回来。 */
const PH_BURST_FLY=2300,PH_BURST_GONE=5000;
function phBurstPlay(node){if(!node)return;
  const stage=document.querySelector('.screen');if(!stage)return;
  const ems=node.querySelectorAll('.imfx-burst');if(!ems.length)return;
  const sr=stage.getBoundingClientRect();
  stage.querySelectorAll('.imburst').forEach(x=>x.remove());
  const box=document.createElement('div');box.className='imburst';
  let k=0,any=false;
  ems.forEach(em=>{
    em.classList.remove('back');em.classList.add('away');
    em.querySelectorAll('.imfxc').forEach(ch=>{
      const r=ch.getBoundingClientRect();if(!r.width&&!r.height)return;
      const cs=getComputedStyle(ch),i=k++;any=true;
      /* 方向按序号算死，同一条消息每次重播、换台设备看到的都一样 */
      /* 她说「不要爆发的太远，稍微离得近一点、范围小一点，但是弹没问题」：
         横向 96~170 收到 52~88，落点 104~200 收到 58~106，弹起的高度也跟着按比例收，
         翻转和弹跳的节奏一点没动。 */
      const dir=i%2?1:-1,bx=dir*(52+((i*37)%37)),
        fy=58+((i*53)%48),h1=32+((i*23)%24),h2=17+((i*17)%12),h3=7+((i*11)%5),
        r1=dir*(22+((i*29)%26));
      const b=document.createElement('b');
      b.textContent=ch.textContent;
      b.style.cssText=`left:${(r.left-sr.left).toFixed(1)}px;top:${(r.top-sr.top).toFixed(1)}px;`
        +`font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-family:${cs.fontFamily};`
        +`color:${cs.color};line-height:${cs.lineHeight};`
        +`--bx:${bx}px;--fy:${fy}px;--h1:${h1}px;--h2:${h2}px;--h3:${h3}px;--r1:${r1}deg;`
        +`animation-duration:${PH_BURST_FLY}ms;animation-delay:${(i*55)}ms`;
      box.appendChild(b);});});
  if(!any)return;
  stage.appendChild(box);
  const gone=PH_BURST_FLY+k*55;
  setTimeout(()=>{if(box.parentNode)box.remove();},gone+120);
  /* 整整五秒一个字都看不见，然后才弹回来——她要的就是这个节奏 */
  setTimeout(()=>{ems.forEach(em=>{if(!em.isConnected)return;
    em.classList.remove('away');em.classList.add('back');
    setTimeout(()=>{if(em.isConnected)em.classList.remove('back');},900);});},gone+PH_BURST_GONE);}
function phFxPlay(m,box){if(!m)return;
  const node=box&&box.querySelector(`.imsg-b[data-mid="${m.id}"]`);
  if(node&&m.bfx){if(m.bfx==='invisible'){node.classList.add('iminv');phInvReset(node);}
    else{node.classList.remove('imbfx-slam','imbfx-loud','imbfx-gentle');void node.offsetWidth;node.classList.add('imbfx-'+m.bfx);
      /* 一次性动画和「鼓气泡」抢的是同一个 animation 属性，放完就得把类摘掉，
         不然这条气泡以后永远鼓不起来 */
      node.addEventListener('animationend',function off(e){if(e.target!==node)return;
        node.classList.remove('imbfx-slam','imbfx-loud','imbfx-gentle');
        node.removeEventListener('animationend',off);phFxSwell(node);},false);}}
  if(node)phFxSwell(node);
  if(node&&node.querySelector('.imfx-burst'))phBurstPlay(node);
  if(m.sfx)phScreenFx(m.sfx,m);}
function phFxReplay(num,mid,sk){const arr=phSmsArr(num,sk),m=arr.find(x=>x&&x.id===mid),box=$('#smsbody');if(!m)return;
  const node=box&&box.querySelector(`.imsg-b[data-mid="${mid}"]`);
  if(node){node.classList.remove('imb-swell');
    node.querySelectorAll('.imfx,.imfxc').forEach(el=>{const a=el.style.animation;el.style.animation='none';void el.offsetWidth;el.style.animation=a||'';});}
  phFxPlay(m,box);}
/* ===== 隐形墨水：用手指一点点划开 =====
   盖在气泡上的是一块 canvas：每帧重画一层会闪的沙粒（位置按种子算死，
   只做微小抖动，所以看着在呼吸而不是乱跳），再用「已经划开的地方」那块
   离屏画布 destination-out 把沙粒挖掉。手指划到哪儿、哪儿就露出来。
   划开的比例用一张 24×10 的格子估，够六成就整块化开，省得她一寸寸抠。 */
const _phInv=new WeakMap();
const PH_INV_DONE=.6;
function phInvRnd(s){s=(s*1664525+1013904223)&0x7fffffff;return[s,s/0x7fffffff];}
function phInvMount(node){
  if(!node||!node.classList.contains('iminv')||node.classList.contains('shown'))return null;
  let st=_phInv.get(node);
  if(st&&st.cv&&st.cv.parentNode===node)return st;
  const cv=document.createElement('canvas');cv.className='iminv-cv';
  st={cv,rv:document.createElement('canvas'),grid:null,cols:24,rows:10,hit:0,done:false,down:false,raf:0,frame:0,w:0,h:0,
      seed:1+(String(node.dataset.mid||'').split('').reduce((a,c)=>(a*31+c.charCodeAt(0))&0x7fffffff,7))};
  _phInv.set(node,st);node.appendChild(cv);
  const at=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
  const start=e=>{st.down=true;try{cv.setPointerCapture(e.pointerId);}catch(_){}
    phInvScratch(node,...at(e));e.preventDefault();e.stopPropagation();};
  const move=e=>{if(!st.down)return;phInvScratch(node,...at(e));e.preventDefault();};
  /* 手指还没抬起来就别把 canvas 撤了：一撤，这一划剩下的部分和抬手补的那个 click
     就直接落到气泡上，把「短信操作」顶出来了 */
  const end=()=>{st.down=false;if(st.done)phInvDrop(st);};
  cv.addEventListener('pointerdown',start);cv.addEventListener('pointermove',move);
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  /* 划完手指抬起来，浏览器还会补一个 click，会顺着冒泡去开气泡菜单——挡掉 */
  cv.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
  phInvLoop(node);
  return st;}
function phInvMountAll(){const box=$('#smsbody');if(!box)return;
  box.querySelectorAll('.imsg-b.iminv').forEach(phInvMount);}
function phInvSize(node,st){
  const w=Math.max(1,Math.round(node.clientWidth)),h=Math.max(1,Math.round(node.clientHeight)),
    dpr=Math.min(3,Math.max(1,window.devicePixelRatio||1));
  if(st.w===w&&st.h===h)return false;
  st.w=w;st.h=h;st.dpr=dpr;
  st.cv.width=st.rv.width=Math.round(w*dpr);st.cv.height=st.rv.height=Math.round(h*dpr);
  st.grid=new Uint8Array(st.cols*st.rows);st.hit=0;
  return true;}
const PH_INV_BRUSH=13;
function phInvScratch(node,x,y){const st=_phInv.get(node);if(!st||st.done)return;
  const dpr=st.dpr||1,g=st.rv.getContext('2d'),r=PH_INV_BRUSH*dpr;
  const cx=x*dpr,cy=y*dpr,grd=g.createRadialGradient(cx,cy,0,cx,cy,r);
  grd.addColorStop(0,'rgba(0,0,0,1)');grd.addColorStop(.62,'rgba(0,0,0,.95)');grd.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=grd;g.beginPath();g.arc(cx,cy,r,0,7);g.fill();
  /* 进度要按「真的被擦掉多大一片」算：笔刷半径内的格子都算上。
     只记手指中心那一格的话，一条横线永远凑不满，她得来回抠很多遍。 */
  if(st.grid){const cw=st.w/st.cols,chh=st.h/st.rows,R=PH_INV_BRUSH*.82;
    const c0=Math.max(0,Math.floor((x-R)/cw)),c1=Math.min(st.cols-1,Math.floor((x+R)/cw)),
      r0=Math.max(0,Math.floor((y-R)/chh)),r1=Math.min(st.rows-1,Math.floor((y+R)/chh));
    for(let rw=r0;rw<=r1;rw++)for(let c=c0;c<=c1;c++){
      const dx=(c+.5)*cw-x,dy=(rw+.5)*chh-y;if(dx*dx+dy*dy>R*R)continue;
      const i=rw*st.cols+c;if(!st.grid[i]){st.grid[i]=1;st.hit++;}}
    if(st.hit/st.grid.length>=PH_INV_DONE)phInvFinish(node);}}
function phInvDrop(st){setTimeout(()=>{if(st&&st.cv&&st.cv.parentNode&&!st.down)st.cv.remove();},420);}
function phInvFinish(node){const st=_phInv.get(node);if(!st||st.done)return;st.done=true;
  st.cv.style.opacity='0';node.classList.add('shown');
  if(!st.down)phInvDrop(st);}
function phInvLoop(node){const st=_phInv.get(node);if(!st)return;
  const tick=()=>{st.raf=0;
    if(!node.isConnected||st.done||st.cv.parentNode!==node)return;
    phInvSize(node,st);
    const g=st.cv.getContext('2d'),W=st.cv.width,H=st.cv.height,dpr=st.dpr||1;
    g.clearRect(0,0,W,H);
    let s=st.seed,v;const n=Math.min(2600,Math.round(W*H/34));
    for(let i=0;i<n;i++){
      [s,v]=phInvRnd(s);const x=v*W;[s,v]=phInvRnd(s);const y=v*H;
      [s,v]=phInvRnd(s);const rr=(.45+v*1.15)*dpr;[s,v]=phInvRnd(s);const a=.22+v*.7;
      [s,v]=phInvRnd(s);const jx=(v-.5)*1.6*dpr;[s,v]=phInvRnd(s);const jy=(v-.5)*1.6*dpr;
      const ph=Math.sin((st.frame*.28)+i*.7);
      g.fillStyle='rgba('+(226+((i%3)*10))+','+(232+((i%5)*4))+',255,'+(a*(.6+.4*ph)).toFixed(3)+')';
      g.beginPath();g.arc(x+jx*ph,y+jy*ph,rr,0,7);g.fill();}
    g.globalCompositeOperation='destination-out';g.drawImage(st.rv,0,0);g.globalCompositeOperation='source-over';
    st.frame++;
    st.raf=setTimeout(()=>requestAnimationFrame(tick),62);};
  tick();}
/* 重播（或者角色重新发一条）要把沙子重新盖回去 */
function phInvReset(node){if(!node)return;const st=_phInv.get(node);
  if(st){st.done=false;if(st.cv.parentNode)st.cv.remove();_phInv.delete(node);}
  node.classList.remove('shown');phInvMount(node);}
function phScreenFx(kind,m){const stage=document.querySelector('.screen')||document.querySelector('.imsg');if(!stage)return;
  stage.querySelectorAll('.imsfx').forEach(x=>x.remove());
  const box=document.createElement('div');box.className='imsfx imsfx-'+kind;
  /* 每个特效都用一个算死的伪随机，这样同一条消息重播、换台设备看到的都一样 */
  let _s=(String(m&&m.id||kind).split('').reduce((a,c)=>(a*33+c.charCodeAt(0))&0x7fffffff,17))||7;
  const rnd=(a,b)=>{_s=(_s*1664525+1013904223)&0x7fffffff;return a+(_s/0x7fffffff)*(b-a);};
  const pick=arr=>arr[Math.floor(rnd(0,arr.length))%arr.length];
  const add=(css,html,cls)=>{const i=document.createElement('i');i.style.cssText=css;if(cls)i.className=cls;if(html!=null)i.innerHTML=html;box.appendChild(i);return i;};
  const WARM=['#ff5f8f','#ffd36b','#6ec8ff','#b58cff','#7ee2a8','#ffffff'];
  /* 飘多远、升多高都按这块屏幕的真实高度算。原来写的是 vh——那是【窗口】的高度，
     网页版的手机只占窗口的一小块，按 vh 算的话气球烟花一出手就飞到框外面去了，
     升空的过程一眼都看不见。她说烟花要「从屏幕底部升上去然后炸开」，就得按这个算。 */
  const SR=stage.getBoundingClientRect(),SH=Math.max(320,SR.height||640),SW=Math.max(240,SR.width||390);
  let life=2800;
  if(kind==='echo'){
    /* 照真机的 Echo 来：这条气泡复制出几十份，【从它自己的位置】炸出去铺满整屏，
       停一会儿，再一起收回那条气泡里消失。不绕圈、不旋涡。
       落点用低差异的黄金角铺开，所以铺得均匀又不像网格。 */
    const t=esc(String(m&&phFxRunsPlain(m.fx)||m&&m.text||'').slice(0,10))||'…';
    let ox=50,oy=52;
    try{const node=m&&m.id&&document.querySelector(`.imsg-b[data-mid="${m.id}"]`);
      if(node){const r=node.getBoundingClientRect();
        ox=Math.max(8,Math.min(92,(r.left+r.width/2-SR.left)/SW*100));
        oy=Math.max(8,Math.min(92,(r.top+r.height/2-SR.top)/SH*100));}}catch(_){}
    box.style.setProperty('--ox',ox.toFixed(1)+'%');
    box.style.setProperty('--oy',oy.toFixed(1)+'%');
    const N=38,cx=SW*ox/100,cy=SH*oy/100;
    for(let n=0;n<N;n++){
      const a=n*2.399963,             /* 黄金角，铺得开又不成行 */
        rad=Math.sqrt((n+.6)/N),
        /* 落点是先在【整块屏幕】上铺开，再换算成「从这条气泡出发要飞多远」。
           要是直接以气泡为中心撒点，气泡靠边的时候有一半会飞到屏幕外面，
           另外半边空着——实拍图里就是这样，左半屏一个都没有。 */
        tx=SW*.5+Math.cos(a)*rad*(SW*.52)+rnd(-12,12),
        ty=SH*.46+Math.sin(a)*rad*(SH*.44)+rnd(-14,14),
        px=tx-cx,py=ty-cy,
        sc=(1.06-rad*.42).toFixed(2),rot=rnd(-13,13).toFixed(0),
        dur=(2.9+rad*1.5).toFixed(2),d=(n*.035).toFixed(2);
      add(`--x:${px.toFixed(0)}px;--y:${py.toFixed(0)}px;--sc:${sc};--rot:${rot}deg;`
        +`opacity:0;animation-duration:${dur}s;animation-delay:${d}s`,
        `<b></b>`,n%2?'alt':'');
      box.lastChild.firstChild.innerHTML=t;}
    life=6000;}
  else if(kind==='balloons'){
    const cols=['#ff5f8f','#ffd36b','#6ec8ff','#b58cff','#7ee2a8','#ff9f6b'];
    for(let n=0;n<15;n++){const c=cols[n%cols.length],w=(21+rnd(0,15))|0;
      add(`left:${rnd(2,92).toFixed(1)}%;--w:${w}px;--h:${(w*1.28)|0}px;--c:${c};--sway:${rnd(12,34).toFixed(0)}px;--rise:${(SH+160).toFixed(0)}px;`
        +`animation-duration:${rnd(3.1,4.4).toFixed(2)}s;animation-delay:${rnd(0,1).toFixed(2)}s`,
        `<b></b><u></u>`);}
    life=4600;}
  else if(kind==='confetti'){
    /* 下落和扇动是两层，各转各的：外层匀速落（不会变速），里层扇（不会被压成线） */
    for(let n=0;n<78;n++){const c=WARM[n%WARM.length],shape=n%5===0?'ribbon':n%3===0?'dot':'bar';
      add(`left:${rnd(-4,104).toFixed(1)}%;--c:${c};--drop:${(SH+90).toFixed(0)}px;`
        +`--drift:${rnd(-70,70).toFixed(0)}px;--fl:${rnd(.62,1.35).toFixed(2)}s;`
        +`animation-duration:${rnd(2.4,3.9).toFixed(2)}s;animation-delay:${rnd(0,.9).toFixed(2)}s`,'<b></b>',shape);}
    life=4200;}
  else if(kind==='love'){
    /* 心是 CSS 画的，不是 ❤ 这个字——放到一百多像素还是干干净净，不会糊成马赛克 */
    /* i 匀速升、b 慢慢长大、u 左右摇——三个节奏分开，所以中途不会「停一下」 */
    /* 她说「爱心那个最大的不要了，改成满屏的小爱心升上去就可以」：
       中间那三颗心跳大爱心去掉，小爱心从 18 颗加到 40 颗铺满整屏。 */
    for(let n=0;n<40;n++)add(`left:${rnd(3,97).toFixed(1)}%;--sz:${rnd(13,30).toFixed(0)}px;`
      +`--sway:${rnd(9,26).toFixed(0)}px;--swd:${rnd(.9,1.7).toFixed(2)}s;--rise:${(SH+110).toFixed(0)}px;`
      +`animation-duration:${rnd(2.6,4.2).toFixed(2)}s;animation-delay:${rnd(0,1.8).toFixed(2)}s`,'<b><u></u></b>','up');
    life=4200;}
  else if(kind==='fireworks'){
    /* 她说「我要看到那种绽放的很漂亮的五彩的烟花」。所以每一朵都是五彩的：
       颜色按角度绕色相环走一圈，外层一大圈、内层一小圈套着开（双层绽放），
       每个碎片背后还拖一小截指回中心的尾巴，炸开那一瞬间再推出一圈彩环。 */
    const hue=(a)=>`hsl(${((a%360)+360)%360},96%,${62}%)`;
    for(let b=0;b<6;b++){
      /* 四朵分开放在四个角落，别全挤在一块 */
      const cx=28+(b%3)*17+rnd(-5,9),cy=13+Math.floor(b/3)*26+rnd(-4,12),d=b*.66,
        h0=rnd(0,360),span=pick([300,360,150,210]),/* 有的朵整圈五彩，有的朵只在一段色相里渐变 */
        c=hue(h0),c2=hue(h0+span*.5);
      /* 先从屏幕最底下升空：一条带尾巴的小点，升到 cy% 那个高度 */
      add(`left:${cx.toFixed(1)}%;--rise:${(SH*(1-cy/100)).toFixed(0)}px;--c:${c};animation-delay:${d.toFixed(2)}s`,null,'shell');
      /* 炸开那一下：白芯闪光 + 往外推的彩环 */
      add(`left:${cx.toFixed(1)}%;top:${cy.toFixed(1)}%;--c:${c};--c2:${c2};animation-delay:${(d+1.03).toFixed(2)}s`,null,'flash');
      add(`left:${cx.toFixed(1)}%;top:${cy.toFixed(1)}%;--c:${c};--c2:${c2};--rd:${rnd(210,310).toFixed(0)}px;`
        +`animation-delay:${(d+1.03).toFixed(2)}s`,null,'ring');
      /* 外层一大圈 + 内层一小圈；碎片横向匀速、纵向重力，所以是抛物线不是直线 */
      for(const layer of [{n:40,r0:82,r1:168,sz:[2.2,4.4],dur:[1.3,2.05],g:[62,136],t:[10,22]},
                          {n:20,r0:34,r1:78,sz:[1.6,3.2],dur:[.9,1.4],g:[34,78],t:[6,13]}]){
        for(let n=0;n<layer.n;n++){
          const t=n/layer.n,ang=t*Math.PI*2+rnd(-.09,.09),r=rnd(layer.r0,layer.r1),
            x=Math.cos(ang)*r,y=Math.sin(ang)*r*.8;
          add(`left:${cx.toFixed(1)}%;top:${cy.toFixed(1)}%;--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;`
            +`--g:${rnd(layer.g[0],layer.g[1]).toFixed(0)}px;--c:${hue(h0+t*span)};`
            +`--sz:${rnd(layer.sz[0],layer.sz[1]).toFixed(1)}px;`
            +`--tail:${rnd(layer.t[0],layer.t[1]).toFixed(0)}px;--ta:${(ang*180/Math.PI+180).toFixed(0)}deg;`
            +`animation-delay:${(d+1.03+rnd(0,.05)).toFixed(2)}s;`
            +`animation-duration:${rnd(layer.dur[0],layer.dur[1]).toFixed(2)}s`,'<b></b>','spark');}}}
    life=6600;}
  else if(kind==='lasers'){
    const cols=['#ff2d55','#0a84ff','#30d158','#ffd60a','#bf5af2','#64d2ff'];
    for(let n=0;n<11;n++){const c=cols[n%cols.length];
      add(`top:${rnd(6,94).toFixed(1)}%;--c:${c};--r0:${rnd(-30,30).toFixed(0)}deg;--r1:${rnd(-30,30).toFixed(0)}deg;`
        +`animation-delay:${(n*.085).toFixed(2)}s;animation-duration:${rnd(1.7,2.4).toFixed(2)}s`);}
    life=3200;}
  else if(kind==='star'){
    /* 会眨的小星星铺一层，再让几颗流星划过去 */
    /* 她要「流星多一点、屏幕暗一点、流星亮一点」：数量 8→20，背景那层暗色在 CSS 里 */
    for(let n=0;n<64;n++)add(`left:${rnd(0,100).toFixed(1)}%;top:${rnd(0,90).toFixed(1)}%;`
      +`--sz:${rnd(1.2,3.1).toFixed(1)}px;animation-duration:${rnd(1.4,2.8).toFixed(2)}s;animation-delay:${rnd(0,1.6).toFixed(2)}s`,null,'twinkle');
    /* 她说「流星不要一开始就固定在屏幕里，他是从屏幕最外面下来的，显得有些死板」：
       起点一律放到屏幕外面——要么在右边框外，要么在顶边上面——再划进来。 */
    for(let n=0;n<20;n++){const side=n%2===0;
      const lf=side?rnd(103,152):rnd(34,126),tp=side?rnd(-22,34):rnd(-46,-8);
      add(`left:${lf.toFixed(1)}%;top:${tp.toFixed(1)}%;`
        +`--len:${rnd(80,175).toFixed(0)}px;--dx:${(-SW*rnd(.78,1.32)).toFixed(0)}px;--dy:${(SH*rnd(.5,.95)).toFixed(0)}px;`
        +`animation-delay:${(n*.17).toFixed(2)}s;animation-duration:${rnd(1.6,2.4).toFixed(2)}s`,'<b></b>','shoot');}
    life=4200;}
  else if(kind==='spotlight'){
    /* 光要打在这条消息上，不是随便找个地方暗下来 */
    let sx=50,sy=52;
    try{const node=m&&m.id&&document.querySelector(`.imsg-b[data-mid="${m.id}"]`);
      if(node){const r=node.getBoundingClientRect(),s=stage.getBoundingClientRect();
        if(r.width&&s.width){sx=Math.max(14,Math.min(86,(r.left+r.width/2-s.left)/s.width*100));
          sy=Math.max(14,Math.min(86,(r.top+r.height/2-s.top)/s.height*100));}}}catch(_){}
    box.style.setProperty('--sx',sx.toFixed(1)+'%');
    box.style.setProperty('--sy',sy.toFixed(1)+'%');
    add(`left:${sx.toFixed(1)}%;top:${sy.toFixed(1)}%`,null,'halo');
    box.__sx=sx;box.__sy=sy;
    /* 浮尘只在光柱里飘，飘到暗处去就看不见了 */
    for(let n=0;n<26;n++)add(`left:${(sx+rnd(-15,15)).toFixed(1)}%;top:${(sy+rnd(-9,9)).toFixed(1)}%;`
      +`--sz:${rnd(1.4,3.4).toFixed(1)}px;--rise:${rnd(24,62).toFixed(0)}px;`
      +`animation-duration:${rnd(2.2,3.4).toFixed(2)}s;animation-delay:${rnd(0,1.2).toFixed(2)}s`,null,'dust');
    life=3400;}
  stage.appendChild(box);
  setTimeout(()=>{if(box.parentNode)box.remove();},life);}
