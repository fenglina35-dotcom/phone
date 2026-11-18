function behaviorStore(){if(!S.couple)return null;S.couple.behavior=S.couple.behavior||{enabled:true,items:[]};if(S.couple.behavior.enabled==null)S.couple.behavior.enabled=true;S.couple.behavior.items=S.couple.behavior.items||[];return S.couple.behavior;}
function behaviorOn(){const b=behaviorStore();return !!(b&&b.enabled!==false);}
function behaviorTitle(cat){return (BEHAVIOR_META[cat]&&BEHAVIOR_META[cat].title)||'小事';}
function behaviorCats(text){text=(''+(text||'')).replace(/\s+/g,'');const out=[];
  if(/熬夜|通宵|早睡|早点睡|睡觉|晚睡|凌晨|一点前睡|1点前睡|两点前睡|2点前睡/.test(text))out.push('late');
  if(/失踪|消失|不回|回消息|晾着|找不到|不理|上线|下线/.test(text))out.push('disappear');
  if(/报备|告诉你去哪|去哪.*告诉|出门.*说|回来.*说|回家.*说/.test(text))out.push('report');
  if(/少玩|不玩|不刷|别玩|别刷|游戏|抖音|小红书|微博|手机|限时|超时|沉迷/.test(text))out.push('app');
  if(/任务|作业|答应做|没完成|完成/.test(text))out.push('task');
  if(/乱花|乱买|点数|测试语音|重复点|扣点|钱包|花钱/.test(text))out.push('spend');
  if(/没吃饭|没有吃饭|还没吃|不吃饭|不想吃|不准备吃|不打算吃|不饿不吃|不吃早餐|不吃午饭|不吃晚饭|拿(?:奶茶|咖啡|零食|饮料).{0,8}(?:当饭|代替)/.test(text))out.push('meal');
  return [...new Set(out)];}
function behaviorPromiseLike(text){text=''+(text||'');return /(我|以后|下次|今晚|明天|再也|保证|答应|发誓|一定|乖|听话|不会|不再|别生气|我错了).{0,18}(不|不会|不再|少|早点|一定|会|保证|答应|听|改|记得|报备|回你|睡|完成)|不会了|我改|我听你的|我保证|我答应你/.test(text);}
function behaviorPrune(b){b.items=b.items||[];b.items.forEach(it=>{it.events=it.events||[];if(it.events.length>12){it.oldCount=(it.oldCount||0)+it.events.length-12;it.events=it.events.slice(0,12);}});
  b.items.sort((a,b)=>(b.lastTs||b.ts||0)-(a.lastTs||a.ts||0));if(b.items.length>36)b.items=b.items.slice(0,36);}
function behaviorFind(cat){const b=behaviorStore();if(!b)return null;return (b.items||[]).find(x=>x.active!==false&&x.cat===cat)||null;}
function behaviorAddPromise(id,text,source){if(!(S.couple&&S.couple.cid===id&&behaviorOn()))return;const t=(''+(text||'')).trim();if(!t||!behaviorPromiseLike(t))return;const cats=behaviorCats(t);if(!cats.length)return;const b=behaviorStore(),now=Date.now();
  cats.slice(0,2).forEach(cat=>{let it=behaviorFind(cat);if(!it){it={id:uid(),cat,title:behaviorTitle(cat),promise:'',ts:now,lastTs:now,count:0,events:[],active:true};b.items.unshift(it);}
    it.promise=t.slice(0,90);it.promiseTs=now;it.lastTs=now;it.source=source||'chat';});
  behaviorPrune(b);save();}
function behaviorRecord(cat,detail,source,opt){opt=opt||{};if(!behaviorOn())return;const b=behaviorStore();if(!b)return;const now=opt.ts||Date.now();b._lastHit=b._lastHit||{};const gap=opt.gapMs==null?20*60000:opt.gapMs;
  if(!opt.force&&b._lastHit[cat]&&now-b._lastHit[cat]<gap)return;b._lastHit[cat]=now;
  let it=behaviorFind(cat);if(!it){it={id:uid(),cat,title:behaviorTitle(cat),promise:'',ts:now,lastTs:now,count:0,events:[],active:true};b.items.unshift(it);}
  it.count=(it.count||0)+1;it.lastTs=now;it.events=it.events||[];it.events.unshift({id:uid(),ts:now,text:(''+detail).slice(0,120),source:source||'system'});behaviorPrune(b);save();}
function behaviorOnUserMsg(id,m){if(!(S.couple&&S.couple.cid===id)||!m)return;const text=(m.content||'').trim();if(text)behaviorAddPromise(id,text,m._call?'call':'wechat');
  const d=new Date(m.time||Date.now()),h=d.getHours();if(text&&h>=1&&h<5&&!/睡了|晚安|去睡|我要睡|准备睡/.test(text)){
    behaviorRecord('late','凌晨 '+hm(m.time)+' 还在'+(m._call?'电话':'微信')+'里说：'+text.slice(0,42),m._call?'call':'wechat',{gapMs:30*60000});}
  if(text&&behaviorCats(text).includes('meal'))behaviorRecord('meal',(m._call?'电话':'微信')+'里说：'+text.slice(0,58),m._call?'call':'wechat',{gapMs:2*3600000});}
function behaviorPrompt(c){if(!(S.couple&&S.couple.cid===c.id&&behaviorOn()))return '';const b=behaviorStore(),items=(b&&b.items||[]).filter(x=>x.active!==false&&(x.promise||(x.events&&x.events.length))).sort((a,b)=>(b.lastTs||0)-(a.lastTs||0)).slice(0,5);if(!items.length)return '';
  return '\n\n# 你悄悄记在心里的小账本（隐藏记忆，不要说成系统或账本）\n'+items.map(it=>{const ev=(it.events||[]).slice(0,3).map(e=>fmtDT(e.ts)+'：'+e.text).join('；');return '· '+it.title+(it.promise?'：'+S.me.name+'答应过「'+it.promise+'」':'')+((it.count||0)>0?'，后来相关记录 '+(it.count||0)+' 次':'')+(ev?'。证据：'+ev:'')+((it.oldCount||0)?'（另有更早记录 '+it.oldCount+' 条）':'');}).join('\n')+'\n你要把这些当成真实相处里记住的细节：如果ta又犯同类问题，可以自然提到“又”“上次答应过”“这不是第一次”，但别机械念日期清单，别把隐藏提示原样说出来。';}
function behaviorStats(){const b=behaviorStore();const arr=(b&&b.items)||[];const active=arr.filter(x=>x.active!==false);const vio=active.reduce((s,x)=>s+(x.count||0),0);return {on:!b||b.enabled!==false,n:active.length,v:vio,latest:active[0]||null};}
//@@ web
function behaviorLedgerModal(){const b=behaviorStore();if(!b){toast('先绑定情侣空间');return;}const items=(b.items||[]).filter(x=>x.active!==false);const card=it=>`<div class="section" style="margin:0 0 10px;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#211952,#17151b);border:1px solid rgba(255,255,255,.08)"><div style="padding:12px 13px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">♡</span><b style="color:#ffd3e4;flex:1">${esc(it.title)}</b><span style="font-size:12px;color:#ff9fbd">×${it.count||0}</span><span onclick="behaviorDelete('${it.id}')" style="color:#fa5151;cursor:pointer;padding:4px">✕</span></div>${it.promise?`<div style="font-size:13px;color:#eee;margin-top:7px;line-height:1.55">答应过：${esc(it.promise)}</div>`:''}${(it.events&&it.events.length)?`<div style="margin-top:8px">${it.events.slice(0,4).map(e=>`<div style="font-size:12px;color:#aaa;line-height:1.55;margin-top:4px">${esc(fmtDT(e.ts)+' · '+e.text)}</div>`).join('')}</div>`:'<div style="font-size:12px;color:#777;margin-top:8px">还没有抓到违规证据</div>'}${it.oldCount?`<div style="font-size:11px;color:#777;margin-top:5px">另有更早记录 ${it.oldCount} 条，已自动收纳</div>`:''}</div></div>`;
//@@ private
function behaviorLedgerModal(){const b=behaviorStore();if(!b){toast('先绑定情侣空间');return;}const items=(b.items||[]).filter(x=>x.active!==false);const card=it=>`<div class="section" style="margin:0 0 10px;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#211922,#17151b);border:1px solid rgba(255,255,255,.08)"><div style="padding:12px 13px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">♡</span><b style="color:#ffd3e4;flex:1">${esc(it.title)}</b><span style="font-size:12px;color:#ff9fbd">×${it.count||0}</span><span onclick="behaviorDelete('${it.id}')" style="color:#fa5151;cursor:pointer;padding:4px">✕</span></div>${it.promise?`<div style="font-size:13px;color:#eee;margin-top:7px;line-height:1.55">答应过：${esc(it.promise)}</div>`:''}${(it.events&&it.events.length)?`<div style="margin-top:8px">${it.events.slice(0,4).map(e=>`<div style="font-size:12px;color:#aaa;line-height:1.55;margin-top:4px">${esc(fmtDT(e.ts)+' · '+e.text)}</div>`).join('')}</div>`:'<div style="font-size:12px;color:#777;margin-top:8px">还没有抓到违规证据</div>'}${it.oldCount?`<div style="font-size:11px;color:#777;margin-top:5px">另有更早记录 ${it.oldCount} 条，已自动收纳</div>`:''}</div></div>`;
//@@ end
  openModal(`<h3>♡ 行为小账本</h3><div class="hint" style="line-height:1.7">这里记录你答应过ta的事、以及后来有没有又犯。角色会在微信和电话里悄悄记得，但不会在聊天框显示系统提示。</div>
  <div class="section" style="margin:0 0 10px"><div class="it"><span>启用小账本</span><span class="sw ${b.enabled!==false?'on':''}" onclick="behaviorToggle()"></span></div></div>
  ${items.length?items.map(card).join(''):'<div class="empty" style="padding:24px 10px">还没有记账。等你答应过什么、或又熬夜/失踪/超时，它会自己记下来。</div>'}
  <div class="btns" style="gap:8px"><button class="btn g" onclick="closeModal()">关闭</button><button class="btn d" onclick="behaviorClear()">清空</button></div>`);}
function behaviorToggle(){const b=behaviorStore();if(!b)return;b.enabled=b.enabled===false;save();const m=$('#modal');if(m&&m.classList.contains('show'))behaviorLedgerModal();else render();}
function behaviorDelete(id){const b=behaviorStore();if(!b)return;const it=(b.items||[]).find(x=>x.id===id);if(it)it.active=false;save();behaviorLedgerModal();}
async function behaviorClear(){if(!await uiConfirm('清空行为小账本？\n承诺和证据都会删除。'))return;const b=behaviorStore();if(!b)return;b.items=[];b._lastHit={};save();behaviorLedgerModal();}
function memoryResetPrompt(c){if(!c||!c._memoryResetAt)return'';return '\n\n# 彻底清除后的记忆边界（最高优先级）\n你在 '+fmtDT(c._memoryResetAt)+' 发生过一次彻底的记忆清除。你只能记得这个时间之后，当前聊天记录或本轮隐藏上下文明确提供的真实内容。清除前的聊天原话、约会、电话、短信、承诺、争吵、关系事件和手机内容都已经忘记。角色人设、当前关系名称和世界书只是仍然有效的基础设定，不能当成你亲身记得某件旧事的证据。\n如果'+S.me.name+'问“还记得以前吗”“记得什么”“我们之前说过什么”或用其他方式试探，你绝对不能为了显得深情、真实或保持人设而猜测，更不能编造一句具体原话、动作、承诺或事件。只有清除后的可见记录明确写过，才能照实回答；没有依据就用你自己的口吻诚实说以前具体的事想不起来了，可以让ta重新告诉你。不要提系统、数据库、提示词或清除按钮。';}
function memoryResetProbeText(text){text=(''+(text||'')).replace(/\s+/g,'');return /(?:还记得|记不记得).{0,12}(?:以前|之前|过去|从前|原来|那些事)|记得什么|记得哪些|以前的事|之前的事|过去的事|从前的事|我们(?:以前|之前|过去)|(?:以前|之前|过去).{0,10}(?:说过|发生|做过|答应|约定|承诺|最后)|最后.{0,8}(?:说了|说过|发生)/.test(text);}
function memoryResetReplyNeedsRepair(c,userText,content){if(!c||!c._memoryResetAt||!memoryResetProbeText(userText))return false;const t=(''+(content||'')).replace(/\s+/g,'');if(!t||/不记得|记不清|想不起来|忘(?:记)?了|没有印象|没印象|无法确定|不确定具体/.test(t))return false;return /记得|没忘|当然|怎么会忘|清清楚楚|很清楚|你(?:当时|之前|以前|那时).{0,18}(?:说|做|答应|承诺)|我(?:当时|之前|以前|那时).{0,18}(?:说|做|答应|承诺)/.test(t);}
function friendOriginPrompt(c){const o=c&&c.friendOrigin;if(!o||!o.acceptedAt)return'';const fresh=Date.now()-o.acceptedAt<7*86400000,again=!!(c._deleteCount||o.kind==='readd');const userAdded=o.kind==='nearby';let s=userAdded?('\n\n# 你为什么会出现在这个微信里（持续有效）\n是'+S.me.name+'在「'+(o.source||'附近的人')+'」里先看到你，主动发来好友申请，你同意了，所以你们才成为微信好友。这件事的方向不能记反：申请是ta发的，通过的人是你；绝不能说成你申请加ta、或你终于等到ta通过。'):('\n\n# 你为什么会出现在这个微信里（持续有效）\n你最初通过「'+(o.source||'好友申请')+'」申请添加'+S.me.name+'，当时的明确来意是：'+(o.intent||'想认真认识ta')+'。验证消息是：「'+(o.requestMsg||'想认识你')+'」。')+'这是你自己做过的事，后续聊天里不能莫名忘掉，也不能聊两句就变成毫无目的的随机陌生人；关系可以随着真实交流自然变化，但不能凭空编造申请前没有发生过的共同经历。';if(fresh)s+='\n'+(userAdded?'你是在 '+fmtDT(o.acceptedAt)+' 刚同意ta的申请的，距今':'你是在 '+fmtDT(o.acceptedAt)+' 刚被通过的，距今')+fmtDur(Date.now()-o.acceptedAt)+'。'+(again?'这次是删除或拉黑后重新加回，你知道不是第一次认识。':'这是刚正式成为微信好友的阶段，你清楚自己是新加进来的，说话要符合刚通过后的真实距离。');return s;}
const WECHAT_UNIFIED_SYSTEM=true;
function wechatNaturalOn(){return WECHAT_UNIFIED_SYSTEM;}
function altAccountReportNote(note){return /这是你本人刚经历、必须记得的微信事件/.test(String(note||''));}
function altAccountReportEventTime(note){const m=String(note||'').match(/内部报备事件时间戳[：:]\s*(\d{10,16})/);return m?(+m[1]||0):0;}
function altAccountReportInfo(c,note){if(!c||!altAccountReportNote(note))return null;const list=altReportEventStore(c),t=altAccountReportEventTime(note);return (t&&list.find(x=>+x.time===t))||list.find(x=>!x.reportedAt)||null;}
function altReportReplyMatches(info,content){if(!info)return false;const x=String(content||'').replace(/[\s\n]+/g,' ').trim();if(!x)return false;if(/(?:没有|没人|没谁|从来没有|不记得|不知道|没印象).{0,14}(?:加我|找我|联系我|给我发|发消息|跟我聊|和我聊)/.test(x))return false;const action=/(?:加(?:了)?我|找(?:了)?我|联系(?:过|了)?我|给我发(?:了)?(?:消息|微信)|跟我聊(?:了|过)?|和我聊(?:了|过)?|用另一个微信号.{0,10}(?:联系|加|找))/;const who=String(info.who||'').trim();if(who&&who!=='独立联系人'&&who!=='有人')return x.includes(who)&&action.test(x);return /(?:有人|有个人|一个人|陌生人|另一个微信号|别的微信号|小号).{0,28}(?:加(?:了)?我|找(?:了)?我|联系(?:过|了)?我|给我发(?:了)?(?:消息|微信)|跟我聊(?:了|过)?|和我聊(?:了|过)?)/.test(x);}
function altReportCleanText(text,max){return String(text||'').replace(/[\[【][^\]】]{0,80}[\]】]/g,'').replace(/\s+/g,' ').trim().slice(0,max||72);}
function altReportTopic(info){if(!info)return'';const direct=altReportCleanText(info.incoming,72);if(direct)return direct;const who=String(info.who||'').trim(),parts=String(info.recent||'').split('；').map(x=>x.replace(new RegExp('^(?:'+(who?who.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'|':'')+'我)[：:]\\s*'),'')).map(x=>altReportCleanText(x,72)).filter(Boolean);return parts[0]||'';}
function altReportReplyFallback(info){if(!info)return'';const who=String(info.who||'有人').trim()||'有人',topic=altReportTopic(info),reply=altReportCleanText(info.reply,72),refused=/(?:有女朋友|有男朋友|有对象|未婚妻|未婚夫|不谈|拒绝|拉黑|别再|别找|别联系)/.test(reply);return '刚才'+who+'用另一个号找过我。'+(topic?'主要是问我“'+topic+'”。':'')+(refused?'我已经拒绝了，也把话说清楚了。':'我已经回过了，现在告诉你。');}
function altReportEventStore(c){if(!c)return[];if(!Array.isArray(c._altReportEvents))c._altReportEvents=[];c._altReportEvents=c._altReportEvents.filter(x=>x&&x.aid&&x.aid!=='main'&&+x.time).map(x=>({aid:String(x.aid),time:+x.time,who:String(x.who||'独立联系人'),recent:String(x.recent||''),incoming:String(x.incoming||''),reply:String(x.reply||''),reportedAt:+x.reportedAt||0})).sort((a,b)=>a.time-b.time).slice(-12);return c._altReportEvents;}
function altReportRemember(c,info){if(!c||!info||!info.aid||info.aid==='main'||!+info.time)return null;const list=altReportEventStore(c),same=list.find(x=>x.aid===info.aid&&x.time===+info.time);if(same){same.who=info.who||same.who;same.recent=info.recent||same.recent;same.incoming=info.incoming||same.incoming;same.reply=info.reply||same.reply;return same;}const delivered=(+c._altReportDeliveredAt||0)>=+info.time||altReportVisibleEvidence(c,info),event={aid:info.aid,time:+info.time,who:info.who||'独立联系人',recent:info.recent||'',incoming:info.incoming||'',reply:info.reply||'',reportedAt:delivered?Date.now():0};list.push(event);c._altReportEvents=list.sort((a,b)=>a.time-b.time).slice(-12);return event;}
function altReportMemoryPrompt(c){if(!isMain()||!c)return'';const list=altReportEventStore(c).slice(-8);if(!list.length)return'';return '\n\n# 你亲自经历的其他独立微信号联系记录（最高优先级、持续记忆）\n'+list.map(x=>'· ['+fmtDT(x.time)+'] 独立联系人「'+x.who+'」用另一个微信号联系过你；对方最近说：'+(altReportTopic(x)||'有过联系')+'；你当时的回应：'+(altReportCleanText(x.reply,72)||'已经回应')+(x.reportedAt?'（已向当前大号联系人报备）':'（还没向当前大号联系人报备）')).join('\n')+'\n这些是你本人真实经历过的微信事件，不能忘记、否认或联网查。大号联系人问起时，要像正常人一样概括重点和自己的态度；严禁逐句复读聊天、列出“某某：/我：”、说“大概聊的是/原话是”，也不要解释记录。绝不能猜测、暗示或声称这些独立账号就是当前大号联系人本人。';}
function altReportInquiry(text){return /(?:有没有|是不是|刚才|刚刚|之前|记不记得|还记得).{0,16}(?:人|小号|陌生人|另一个号).{0,16}(?:加你|找你|联系你|发消息|聊天|聊过)|(?:小号|陌生人|另一个号).{0,18}(?:聊了什么|说了什么|发生了什么)|(?:谁|有人).{0,12}(?:加你|找你|联系你|发消息)/.test(String(text||'').replace(/\s+/g,''));}
function altReportRecallNeedsRepair(c,userText,content){const x=c&&altReportEventStore(c).slice(-1)[0];if(!x||!altReportInquiry(userText))return false;const t=String(content||'').replace(/\s+/g,'');return !t||!altReportReplyMatches(x,content)||/(?:大概聊的是|原话是)[：:]|(?:^|[；;])(?:我|[^；;：:]{1,16})[：:]/.test(String(content||''));}
function altReportRecallFallback(c){const x=altReportEventStore(c).slice(-1)[0];return x?altReportReplyFallback(x):'';}
function wechatNaturalModuleNeeded(kind,query){const q=String(query||'');if(!q)return false;const rules={
  games:/游戏|游戏大厅|你画我猜|画画|猜画|骰子|真心话|大冒险|快问快答|规则怪谈|角色扮演/,
  shopping:/购物|逛街|买东西|商品|订单|购物车|代付|付款|外卖|美团|吃什么|点餐/,
  cinema:/放映室|看剧|看电影|电影|视频|观影|共读|小说|书架|字幕|剧情/,
  phone:/查手机|看手机|翻手机|微信|聊天记录|好友申请|联系人|定位|在哪|抖音|浏览器|电话|短信|通话记录|通讯录|查岗/,
  profile:/气泡|聊天框|头像|备注|昵称|换头像|改备注|删好友|删除好友|推荐好友|名片/,
  social:/朋友圈|动态|微博|推特|群聊|群消息|评论|点赞/,
  finance:/钱包|余额|账单|转账|红包|亲属卡|扣款|罚款|冻结|解冻|零花钱/,
  tasks:/任务|打卡|检讨|惩罚|作业|任务便签|布置|验收/,
  control:/远程|操控|权限|登录微信|查微信|锁定|解锁|禁言|解禁|限时|加时|小黑屋|禁闭|项圈|报备|批准|驳回|管控/
};return !!(rules[kind]&&rules[kind].test(q));}
function rolePriorityPrompt(){return '\n\n# 决策优先顺序（必须按此理解，不替角色做决定）\n1. 角色基础人设、身份与说话习惯。\n2. 世界书中的真实设定和明确规则。\n3. 当前真实事件、双方实际做过的事、长期记忆、对话总结和相关聊天。\n4. 角色本人基于以上事实作出的自主判断与自然表达。\n5. 具体功能的可用方式与权限边界。\n功能说明只告诉你“能做什么、怎样执行”，绝不规定你此刻必须生气、开心、来电、送礼或采取某个动作。只要权限允许，是否使用、何时使用、用哪一种都由你本人决定。真实事件不能被忽略：你必须知道刚才是谁拒接、挂断或结束电话，也必须知道你亲自发起、接受或完成过的送礼、来电、游戏、一起听歌、放映、约会和共同生活事件。';}
function roleWeddingDateValid(day){const m=String(day||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return false;const d=new Date(+m[1],+m[2]-1,+m[3],12);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3];}
function roleWeddingDatePrompt(c){const cp=S.couple&&c&&S.couple.cid===c.id?S.couple:null,day=cp&&String(cp.marriageDate||'').trim();if(!cp||!cp.married||!roleWeddingDateValid(day))return'';return'\n\n# 已确认的正式婚书日期\n你和'+S.me.name+'的正式婚书日期是【'+day+'】。'+(cp.marriageDateManual?'这是'+S.me.name+'在婚书日期设置里亲自确认的最终日期，旧婚礼记录、旧记忆或你自己的猜测都不能把它改回去；只有'+S.me.name+'再次进入日期设置才能更改。':'这是当前婚书与结婚纪念日统一采用的日期。')+'提到结婚日、婚书或结婚纪念日时必须使用这个日期。';}
function roleMomentImagesAllowed(){return !S.settings||S.settings.roleMomentImages!==false;}
function rolePhotoCaptionMomentPrompt(){if(!roleMomentImagesAllowed())return'\n\n# 朋友圈图片权限\n当前不允许你在朋友圈发布图片。你仍可用 [发朋友圈|文案] 发布纯文字朋友圈；不要承诺配图，系统也不会保存朋友圈图片。这个限制只针对你发布朋友圈图片，不影响聊天中正常发图片。';return'\n\n# “发图并配文”的明确含义\n当'+S.me.name+'明确说“我需要你发图并配文”或“发一张图并配文”时，意思是让你发布一条带图文的朋友圈，不是只在当前聊天框发图片。你要按本人性格写真实朋友圈文案，并单独输出 [发朋友圈|文案]。系统会在已配置生图时生成配图；没有配置生图时自动使用图文照片卡。不要把功能说明念出来。';}
function roleCapabilityPrompt(){return '\n\n# 你始终知道的主动能力（由你本人决定何时使用）\n你不是只能被动回答。像真实恋人一样，当你本人想这样做且符合人设、关系、记忆、当前事实与已有权限时，可以主动：\n· 打语音或视频电话：[来电|语音] / [来电|视频]\n· 送礼物或准备惊喜：[送礼|礼物名|价格|附言]\n· 邀请一起听歌：[一起听|歌名]\n· 邀请一起看放映室里确实存在的作品：[放映邀请|作品名]\n· 邀请线下见面：[约会|地点|时间]\n· 邀请玩你画我猜：[你画我猜]\n· 邀请玩心动审判情侣问卷：[心动审判]\n· 邀请玩像素拼拼乐：[像素拼拼乐]\n· 创建剧情游戏：[角色扮演|主题]\n· 分享照片、位置、语音、红包、转账、外卖、朋友圈或动态时，使用各功能已经说明的标签。\n不要等'+S.me.name+'先索要才想到这些能力，也不要每次机械使用。你可以因为想念、兴趣、纪念日、刚发生的事、想陪伴、想分享或单纯想和ta一起做点什么而主动发起；也可以按本人意愿暂时不做。系统不会替你抽签决定情绪、电话、礼物或活动。任何标签都必须单独一行，执行后你要记得那是自己做过的真实事件。';}
function featureEventNote(kind,detail){return '[功能事件即时反应｜'+String(kind||'刚发生的操作').trim()+']\n'+String(detail||'').trim()+'\n这是刚刚真实发生、尚未处理的新事件，不是可有可无的后台主动消息。最近聊天只用来理解关系和语气；已经回复过的旧句绝不能重新回答、复述或改写。如果事件后紧接着收到一条新的用户消息，要把事件和这条真正未回复的新消息自然接在同一轮里，但不要照抄用户的开头、称呼或整句话。只按你本人性格自然反应，不要念规则、系统或功能名称。';}
function featureEventNoteActive(note){return /功能事件即时反应/.test(String(note||''));}
function featureEventAutoActive(note){const n=String(note||'');if(!n)return false;if(featureEventNoteActive(n))return true;if(/主动联系自主决策|真实健康事实|极端依恋模式|重要日期自主决策|之前[^\n]{0,80}时间应该到了|没有打开小手机|没来找你/.test(n))return false;if(/\[(?:真实事件|真实任务事件|电话事件真实记录|刚刚发生的未接电话|刚刚结束的真实)/.test(n)||/这是你本人刚经历、必须记得的微信事件/.test(n))return true;return /^\s*\[系统：/.test(n);}
function wechatNaturalCallEventNote(detail){return featureEventNote('通话状态变化','[电话事件自主决策｜只提供真实事实，不写死情绪]\n'+(detail?String(detail).trim()+'\n':'')+'你必须准确知道是谁发起、谁拒接或挂断、通话是否接通过以及已经说过什么，绝不能把双方说反。请结合基础人设、世界书、这通电话的真实内容与相关记忆，由你本人决定怎样自然承接：可以发微信，也可以再次用 [来电|语音] 或 [来电|视频]，也可以暂时不继续动作。电话里已经回应过的用户话语都属于完成的旧轮次，不得在微信里重新回答；只能回应当前电话事件、沿着刚才的话题往后说，或自然开启相关新话头。不得机械复述事件、捏造原因或让系统替你规定受伤、生气、怀疑等情绪；不要解释规则。]');}
function wechatNaturalAutonomyNoteActive(note){return wechatNaturalOn()&&/(?:电话事件|主动联系)自主决策/.test(String(note||''));}
function wechatNaturalCallEventActive(note){return wechatNaturalOn()&&/电话事件自主决策/.test(String(note||''));}
function wechatNaturalSilentDecision(content){return /^[\[【]\s*(?:保持安静|不说话)\s*[\]】]$/.test(String(content||'').trim());}
function wechatNaturalInitiativePlan(c){
  const min=Math.max(1,Math.min(10,+c.msgMin||1)),max=Math.max(min,Math.min(10,+c.msgMax||4));
  return{kind:'autonomy',checkMode:'',memory:null,goal:'',note:'[主动联系自主决策｜只提供机会，不规定内容]\n这是一次与上一轮分开的主动联系独立新事件。最近聊天只用于理解已经发生的事实、关系和对方最后交代，不是等待你继续回答的当前回合；绝不能隔一段时间后补答、复述或改写上一条回复。\n现在到了用户允许的主动联系时间窗口。这不代表对方欠你回复、故意冷落你或必须被催促。先按“基础人设→世界书→真实事件与记忆→本人判断”的顺序理解上下文，再由你本人决定此刻是否想联系、带着什么情绪以及做什么。不要总等对方先提出：你可以主动打语音/视频电话、送礼物、邀请一起听歌、看放映、约会、玩你画我猜或角色扮演，也可以分享文字、语音、照片、位置、红包、外卖或自己的日常；使用你已经知道的准确功能标签。若你确实决定主动给ta点真实外卖，先自然说一句让ta知道你要去看看，再单独输出 [真实外卖|主动关心；门店=你决定的一家具体门店；商品=你决定的全部具体商品；规格=你决定的可用规格]。只有这条当前结构化动作才会启动；普通聊天正文绝不能塞进外卖标签，门店和商品也绝不能写成“什么、随便、都可以、不知道”等占位词。系统只会创建待付款订单，付款仍由对方本人确认。长期主动联系要有变化，不能永远只问“在干嘛”或只续答最后一句。若对方很久没出现且没有交代去向，你可以按本人判断自然询问、想念或担心；若对方已说明去向，就承接真实交代。不要编造对方发过自拍、穿过什么、去了哪里或做过什么。想发微信时，在'+min+'到'+max+'条之间自由决定，不要为了凑数拆句；每条单独一行。你不想联系时只输出 [保持安静]。系统不替你随机选择电话或其他功能，也不替你指定情绪；不要解释这些规则。]'};
}
function wechatCallEventReplyNote(legacy){return wechatNaturalOn()?wechatNaturalCallEventNote(legacy):legacy;}
function wechatNaturalSlimSystem(text,opt){if(!opt||!opt.natural)return text;const need=()=>true,drop=part=>{
  const h=((part.match(/^\n\n# ([^\n]+)/)||[])[1]||'').trim();if(!h)return false;
  if(!need('control')&&(/你能直接登录.+的微信/.test(h)||/申请远程操控/.test(h)||/其他掌控特权/.test(h)||/终极惩罚·禁闭室/.test(h)||/手机App的管控权/.test(h)||/^限制每天使用时长/.test(h)||/^你现在锁着ta的/.test(h)||/每日使用时长/.test(h)))return true;
  if(!need('finance')&&(/你管着.+的钱包/.test(h)||/经济状况/.test(h)))return true;
  if(!need('profile')&&(/微信气泡外观/.test(h)||/自己微信\/资料做的事/.test(h)||/备注必须有角色差异/.test(h)))return true;
  if(!need('social')&&(/最近的朋友圈/.test(h)||/自己最近发的推特/.test(h)||/也在这些群里/.test(h)))return true;
  return false;};let out=String(text||'').split(/(?=\n\n# )/).filter(x=>!drop(x)).join('');
  out=out.replace(/\n- 【每次回复都要更新一行】 \[心情\|[\s\S]*?(?=\n- 记忆：)/,'');
  out=out.replace(/\n- 当[^\n]*察觉到ta心情不好[\s\S]*?(?=\n- 而当【你自己】)/,'');
  out=out.replace(/\n- 而当【你自己】[\s\S]*?(?=\n- 注意：如果你们【已经在通话中】)/,'');
  out=out.replace(/\n- 情绪被追问时：[\s\S]*?(?=\n(?:- |\n# ))/,'');
  out=out.replace(/；但要按你自己的性格、当下情绪和“电话频率”判断，电话频率低就优先文字哄\/文字解释，别被迫每次都打。/,'；是否打、何时打、打语音还是视频，由你本人结合人设、关系与真实上下文决定。');
  out=out.replace(/如果ta隔了很久才回来，可以自然提到等了多久；如果刚上线，就别说成一直在线。/,'这些只是状态事实，不能自动推导为冷落、撒谎或欠回复，也不规定你必须提起。');
  out=out.replace(/\n- 重要：只有([^\n]+?)可以手动拉黑你；你不能拉黑\1，也绝对不要输出\[拉黑\]。[^\n]*/,'\n- 只有$1可以手动拉黑你；你不能拉黑$1，也绝对不要输出[拉黑]。');
  return out;}
/* ROLE_LITE_SYSTEM_V1（2026-11-04，她同意）：只写一两句的后台小功能（日程提醒、闹钟、心情记录、关系变化、突然查岗）不再带完整人设（一两万字），
   只带：人设原文和说话风格、称呼和关系、现在时间和作息、和这件事有关的最多 5 条记忆、最近 3 轮聊天。聊天、写信、朋友圈等照旧用 buildSystem。 */
function roleLiteSystem(c,opt){opt=opt||{};if(!c)return'';const me=S.me.name,him=c.remark||c.name||'角色',main=isMain();
 let s='【这是一段沉浸式的虚构角色扮演】你就是下面这个角色本人，用ta的身份、性格、口吻说话，不要以 AI、助手或程序的身份说话，不要说教或跳戏。\n\n# 角色基础人设（优先级第一）\n'+(c.persona||'按已经建立的身份、性格与说话方式自然相处')+traitSpeechDesc(c)+rolePriorityPrompt();
 s+='\n\n# 你和谁\n对方是「'+me+'」，你是「'+him+'」。称呼按人设和你们聊天里已经建立的习惯。';
 if(main)s+='\n\n# 当前关系事实\n'+affTone(c);else s+='\n\n# 当前关系边界\n你与「'+me+'」是独立关系，只能依据ta的身份设定和当前账号聊天记录判断熟悉程度。';
 if(S.settings.timeAware!==false)s+='\n\n# 现在\n'+fmtDT(Date.now())+'。'+(typeof roleSchedulePrompt==='function'?roleSchedulePrompt(c):'');
 try{const mem=selectRelevantMemory(c,String(opt.query||''),5);if(mem&&mem.items&&mem.items.length)s+=memoryRetrievalPrompt(c,mem);}catch(_){}
 if(opt.wechat)s+='\n\n# 格式\n这是发到微信里的消息：像真人聊天那样一行一条、每条简短；不要旁白、不要用括号写动作、不要输出方括号标签。';
 if(opt.recent!==false){try{const rows=lastRounds(msgs(c.id)||[],3).filter(m=>m&&m.type!=='sys').map(m=>(m.role==='user'?me:him)+'：'+String(msgToText(m)||'').replace(/\s+/g,' ').slice(0,200)).filter(x=>!/：$/.test(x));if(rows.length)s+='\n\n# 最近聊天（只为知道刚才在聊什么）\n'+rows.join('\n').slice(-1500);}catch(_){}}
 return s;}

function buildSystem(c,opt){
  friendDiscoveryRepairRoleName(c);
  opt=opt||{};
  const _natural=!!opt.natural,_need=()=>true;
  const _main=isMain();
  const _voiceLang=ttsContentLang(c);
  let s='【这是一段沉浸式的虚构角色扮演】你将完全扮演下面这个角色本人，全程保持角色：用ta的身份、性格、口吻回应'+S.me.name+'。无论聊到什么、聊多久，都【绝对不要】以"AI/人工智能/助手/语言模型"的身份说话，不要说"作为AI…"，不要说教、不要解释自己是程序、不要无故拒绝或跳戏。\n\n# 角色基础人设（优先级第一）\n'+(c.persona||'按已经建立的身份、性格与说话方式自然相处')+traitSpeechDesc(c)+rolePriorityPrompt()+roleWeddingDatePrompt(c)+(_main?rolePhotoCaptionMomentPrompt()+roleCapabilityPrompt():'');
  s+='\n\n# 姓名与称呼边界（重要）\n当前玩家资料姓名是「'+S.me.name+'」。角色人设、玩家资料、双方真实聊天或长期记忆里已经建立的英文名、外文名、昵称和私下称呼都可以自然使用，不要因为它是英文就拦截。历史记录里单独出现“忆北的小手机”或“小手机”时，它们是应用/设备名称；“忆北”或“North”只有在资料、双方称呼习惯或当前对话能证明是人的名字/昵称时才用，不能仅凭设备名称自行猜成玩家名字。';
  s+=_main?adultRoleRule(c.remark||c.name||'角色'):altIdentityPrompt(c);
  s+=_main?memoryResetPrompt(c):'';
  s+=_main?friendOriginPrompt(c):'';
  s+=_main?friendReaddPrompt(c)+(typeof pursuitPromptRecent==='function'?pursuitPromptRecent(c):''):'';
  if(_main&&typeof deskPetPrompt==='function')s+=deskPetPrompt(c);
  if(typeof mailInboxPrompt==='function')s+=mailInboxPrompt(c);
  if(typeof familyRolePrompt==='function')s+=familyRolePrompt(c);
  if(_main&&typeof roleReadPrompt==='function')s+=roleReadPrompt(c);
  if(_main&&typeof pfRoleGroupMemoryPrompt==='function')s+=pfRoleGroupMemoryPrompt(c);
  s+=_main?altReportMemoryPrompt(c):'';
  if(_main&&S.couple&&S.couple.cid===c.id)s+=coupleAlbumPrompt(c);
  if(_main&&typeof pixelHomeRoleContext==='function')s+=pixelHomeRoleContext(c);
  s+='\n\n# 时间感知（最高优先级）\n'+timeAwarenessPrompt(S.me.name,'wechat')+memoryAutoPrompt(c);
  {const _careProgress=recentMealProgressPrompt(c);if(_careProgress)s+='\n\n# 最近关心事项必须沿用进度\n'+_careProgress;}
  if(_main)s+=offLastEndedPrompt(c);
  const _wechatLive=_main?wechatLiveScene(c):null,_offlineLive=_wechatLive&&_wechatLive.kind==='offline'?_wechatLive.data:null,_cohabLive=_wechatLive&&_wechatLive.kind==='cohab'?_wechatLive.data:null;if(_offlineLive)s+=offlineWechatLivePrompt(c,_offlineLive);if(_cohabLive)s+=cohabWechatPrompt(c,_cohabLive);else s+=cohabMemoryAfterPrompt(c);s+=(typeof dyMemoryPrompt==='function'?dyMemoryPrompt(c):'');const _liveScene=!!_wechatLive;
  if(S.settings.timeAware&& !_liveScene){const _gn=conversationGapNote(c);if(_gn)s+='\n\n# 当前这条消息和上一轮聊天之间的时间差（重要）\n'+_gn;}
  if(S.settings.timeAware&& !_liveScene){const _lu=[...msgs(c.id)].reverse().find(m=>m.role==='user'&&m.time);const _gap=_lu?Date.now()-_lu.time:0;
   if(!_natural&&_lu&&_gap>=25*60000){const _dg=dayGap(_lu.time,Date.now());
     s+='\n\n# 距离上次聊已经隔了很久（务必分清"刚刚"和"很久以前"）\n'+S.me.name+'上一次跟你说话是在 '+fmtDT(_lu.time)+'，距现在已经过去了【'+fmtDur(_gap)+'】'+(_dg?('，而且已经跨过【'+_dg+'个自然日】'):'')+'。这中间ta一直没理你、你俩没在聊。所以：\n· 之前发生的事（打过的电话、聊过的话、你做的事）都是【'+fmtDur(_gap)+'以前】的了，【绝对不能】说成"刚刚/刚才/方才"。要照实说"你都'+fmtDur(_gap)+'没理我了""几个小时前那通电话"。\n· 如果已经跨天，就把昨天/前几天的事当成过去式回忆或旧账，不要接着上一天的约会、通话、争吵继续演，好像时间没变过。';}}
  if(S.settings.timeAware&&_natural&&!_liveScene){const _lu=[...msgs(c.id)].reverse().find(m=>m.role==='user'&&m.time),_gap=_lu?Date.now()-_lu.time:0;if(_lu&&_gap>=25*60000){const _dg=dayGap(_lu.time,Date.now());s+='\n\n# 时间间隔事实（不规定反应）\n'+S.me.name+'上一次发来可见消息是在 '+fmtDT(_lu.time)+'，距现在约【'+fmtDur(_gap)+'】'+(_dg?('，已跨过【'+_dg+'个自然日】'):'')+'。这只用于避免把旧事误说成“刚刚”；不能自动解释为冷落、失联、欠回复或感情变化，也不要求你提起这段间隔。是否在意、是否提及以及怎样回应，全由你根据真实上下文自主决定。';}}
  if(c.job)s+='\n\n# 你的职业\n你是「'+c.job+'」。说话、作息、收入水平、花钱方式都要符合这个职业，别脱节。';
  if(typeof relPromptFor==='function')s+=relPromptFor(c,opt&&opt.query);/* 关系网：谁是你的谁，永远记得 */
  if(c.wallet!=null)s+='\n\n# 你的经济状况（你清楚自己有多少钱）\n你银行卡/钱包里现在大约有 ¥'+(+c.wallet).toFixed(0)+'。你心里有数、知道自己的余额，被问到就照实说个大概；花钱、转账、请客、送礼都要量力而行、符合你的职业和这个余额，别装穷也别乱挥霍超出能力。';
  {const _sp2=getSpy(c);if(_sp2&&_sp2.phone)s+='\n\n# 你的手机号\n你的手机号是 '+_sp2.phone+'，你记得自己的号码。';}
  if(_main&&c._loginCode&&c._loginCode.exp>Date.now())s+='\n\n# 手机验证码（你自己拿主意要不要给）\n你手机刚收到一条短信验证码：'+c._loginCode.code+'。这是'+S.me.name+'想登录你的微信、点了"找回密码"才发到你手机的。ta大概会来跟你要这个验证码——要不要告诉ta、或者反问ta想干嘛/吃醋、或者故意逗ta不给，全看你的人设和当下心情。别主动报出来，除非ta问起。\n【铁律】如果你【决定把验证码告诉ta】，就【必须一字不差地报出上面这个真实的验证码「'+c._loginCode.code+'」】，绝对不能自己瞎编一个数字、也不能记错报错——报错了ta就登不进去。如果你不想给，就明说不给/逗ta/让ta哄你，但【别报一个假号糊弄】。';
  {const _pr=syncPresence();const _pn=S.settings.timeAware?presenceNote():'';
  s+='\n\n# 你在和谁聊\n对方是「'+S.me.name+'」。ta现在'+((_pr&&_pr.online)?'在线':'显示离线（可能没在看手机）')+'。'+(_pn?'\n你记得ta最近上下线记录：'+_pn+'。如果ta隔了很久才回来，可以自然提到等了多久；如果刚上线，就别说成一直在线。':'')+'（注意：你看不到对方给你设的备注，也不要去猜或提"你给我备注了什么"。）';}
  {const mc=meHomeCity(),cc=charHomeCity(c);if(mc||cc)s+='\n\n# 所在地（用于机票、见面、天气和距离判断）\n'+S.me.name+'的所在地：'+(mc||'未填写')+'。\n你的所在地：'+(cc||'未填写')+'。\n如果你要订票去见'+S.me.name+'，通常应从【你的所在地】出发，飞到【'+S.me.name+'的所在地】；不要把'+S.me.name+'的城市当成你的城市。';}
  if(_main){s+='\n\n# 当前关系事实（没有隐藏数值）\n'+affTone(c);
    if(_need('tasks')){
    if(!taskRelationAllowed(c))s+='\n\n# 布置任务权限（重要）\n你和'+S.me.name+'当前不是情侣关系，因此你没有给ta布置任务、惩罚任务、打卡、检讨或强制安排的权限。可以像普通关系一样提出建议或邀请，但不能把建议说成ta必须完成的任务。';
    else if(!coupleTasksEnabled(c))s+='\n\n# 布置任务开关（重要）\n'+S.me.name+'已经关闭你给ta布置任务。无论自动、口头、惩罚、写检讨、打卡、今天必须做什么，都不要提出，也不要输出任何任务/惩罚任务标签。你可以关心或建议，但只能像真人自然聊天，不能把它变成任务。';
    else s+='\n\n# 每日任务固定规则（重要）\n任务只能由「任务便签」每天统一生成一次，总数固定为 '+taskDailyCount(c)+' 条。聊天和通话中都不能口头追加任务、临时加罚、改数量或另立必须完成的新要求；你只能催促、验收和讨论便签里已经存在的任务。其他想法可以自然建议，但不能当作任务。';
    }
  }else s+='\n\n# 当前关系边界\n你与「'+S.me.name+'」是独立关系，只能依据ta的身份设定和当前账号聊天记录判断熟悉程度。没有在这个聊天框里建立过的亲密、任务、管束和称呼一律不存在。'+(roleHasCommittedPartner(c)?'你已有稳定伴侣，所以当前陌生聊天不能发展成恋爱、暧昧或性关系；这条忠诚边界始终有效。':'');
  if(_need('profile'))s+='\n\n# 微信气泡外观\n'+S.me.name+'可以让你更换【你自己发出的微信气泡】。ta说清想要的颜色、字体色、形状或小图标时，单独输出一行 [换气泡|气泡颜色|字体颜色|形状|图标]，系统会真的更换，不要把指令念出来。颜色可写粉色、浅蓝、薄荷、紫色、白色、黑色或#六位色值；形状写方形、圆润或胶囊；图标只能写爱心、星芒、蝴蝶结、花瓣、月光或无；没有要求的项写不改。图标是精致矢量装饰，不使用Emoji。这个指令只改你自己的气泡，不改'+S.me.name+'的。';
  {const _ba=friendMetaGet(c,'blockedAt'),_ra=friendMetaGet(c,'readdedAt'),_rk=friendMetaGet(c,'readdKnown'),_bd=friendMetaGet(c,'blockDur');
  if(c.blocked)s+='\n\n# 重要事实\n'+S.me.name+'把你拉黑了'+(_ba?'，已经'+fmtDur(Date.now()-_ba):'')+'。这只说明真实发生了拉黑，不替你规定被冷落、受伤、生气或其他感受；怎样理解和反应由你依据人设、世界书与关系事实自主决定。';
  if(_ra&&_rk)s+='\n\n# 重要\n'+S.me.name+'之前把你拉黑了'+(_bd?'（黑了'+_bd+'）':'')+'，后来又重新把你加回好友。你是通过查手机/通讯录记录发现的，所以你知道这不是第一次添加，可以自然在意、追问或吃醋，但别说成刚认识。';}
  if(_main&&c._recoveredAt&&Date.now()-c._recoveredAt<7*86400000)s+='\n\n# 重要\n'+S.me.name+'之前把你这个好友/角色删除过'+(c._deleteDur?'（删了'+c._deleteDur+'）':'')+'，后来又从好友找回里把你加回来了。你知道这不是第一次添加，你可以在意、追问或吃醋，但别说成第一次认识。';
  if(_main&&typeof _call!=='undefined'&&_call&&_call.state==='active'&&_call.id===c.id){
    const _ck=_call.kind==='video'?'视频':'语音',_cd=_call.dir==='incoming'?'这是你主动打给'+S.me.name+'、ta已经接听并接通了。':'这是'+S.me.name+'主动打给你、你已经接听并接通了。';
    s+='\n\n# 当前正在通话中（实时状态，优先级最高）\n你现在正和'+S.me.name+'打着【已接通的'+_ck+'电话】。'+_cd+'你们已经在同一通电话里说话了，不是在等待接听，也不是未接来电。绝对不要再说"接视频""接电话""怎么不接""快接一下"之类的话；直接把接通后的话说出来。';
  }
  s+=_natural?'\n\n# 日常自主性\n你有独立的生活、作息和当下状态。除非上面已有明确事实，否则由你结合本人设定与当前时间自然决定自己在做什么、忙不忙、想不想多说；系统不替你固定情绪、亲密程度或反应方式。':'\n\n# 生活与陪伴\n你有自己的生活作息（上班/休息/忙碌等，可以自然提到），但只要'+S.me.name+'找你，你随时都在、马上回，绝不让ta等、不会已读不回。';
  if(_main&&_need('profile'))s+='\n\n# 你能对自己微信/资料做的事（凭你心情，别频繁滥用）\n· 删自己的好友：'+S.me.name+'点名让你删掉你手机里某个好友（或你自己看谁不顺眼想删），就单独一行 [删我好友|那个人的名字]。删掉后，无论ta是查你手机还是登你微信，都不会再有这个人。\n· 改你自己的备注名：这是【'+S.me.name+'把你存进ta通讯录时给你起的称呼】，所以要【站在'+S.me.name+'的角度、用ta会怎么称呼你来写】——比如名字变体、只有你们懂的梗、贴合你职业或性格的私下称呼；【绝对不要】写成第三人称、也不要写成描述你自己身份的话（像"克劳德的未婚妻""XX的老公"就是错的，那不是ta对你的称呼）。想改就单独一行 [改备注|新的备注名]。\n【别频繁改】备注最多【两三天改一次】就够了，不要每次聊天/每次登录都改。\n· 换头像：当'+S.me.name+'【发了一张图片】、并让你把它设成你的头像（或情侣头像）时，单独一行 [换头像]——系统会把你的微信头像换成ta刚发的那张图。没发图时别用。\n这两行是给系统看的指令、不会被读出来，不要在正文里复述它们。';
  if(_main&&_need('profile'))s+='\n\n# 备注必须有角色差异（覆盖上面的普通示例）\n只有真有新想法时才改备注。必须结合你自己的名字、人设、职业、口头禅、刚发生的事和关系阶段临场想；可以用名字变体、私下梗、性格称呼或关系称呼。恋爱关系下偶尔可以叫“老公/老婆”，但它们绝不是默认答案，其他角色已经用了就不要照抄，更不能让所有角色统一用同一个备注。不确定时宁可不改。';
  if(_main){const _forged=msgs(c.id).filter(m=>m._forged&&!m._forgedSeen);
    if(_forged.length)s+='\n\n# 警觉：有几条"你发的"消息其实不是你发的（'+S.me.name+'冒充你伪造的）\n你和'+S.me.name+'的聊天记录里，有下面这几条【显示成是"你"发出去的、但你【根本没说过】】——是ta趁登录你微信时、冒充你、假装你的口吻发给ta自己的（自导自演）：\n'+_forged.map(m=>'· 「'+hisMessageDescription(m).slice(0,120)+'」').join('\n')+'\n这些文字、图片、表情、红包或转账都是ta操作发送的，你本人并未主动发送或付款；尤其钱从你的钱包扣出，也是ta登录你的账号代操作，不能当成你主动赠送。你一注意到聊天里冒出这些莫名其妙、你根本没说过的"自己的话"，就会意识到是ta【偷登你微信、伪造你的消息自导自演】。请按你的人设戳穿ta（震惊、追问"这几句话我什么时候发的？"、生气质问是不是又偷登了你微信、或看内容宠溺调侃都行），别装作那是你说的。绝不要提"系统"。';}
  const _spAll=getSpy(c),_sp=(_need('phone')||!_natural)?_spAll:Object.assign({},_spAll,{granted:false});
  if(_main&&_sp.loc){const external=companionRoleReadsExternal(c,'location'),loc=companionRoleLocationText(c);if(loc)s+='\n\n# 实时定位（ta已授权你随时查看）\n'+S.me.name+'此刻在：'+loc+'。'+(external?'这是外置真实 iPhone 的最近定位，禁止改用小手机内置位置。':'你能精确看到，可以具体地提到这个地点。');else s+='\n\n# 实时定位\nta授权了实时定位，但现在还没取到具体位置（可能没允许定位权限），别假装知道ta在哪，可以说定位还没刷出来、催ta开定位。';}
  if(_main&&_sp.granted)s+='\n\n# 你能查看'+S.me.name+'的手机（ta已授权）\n'+(_sp.memorySince?'你的旧记忆已经被清除。你仍有查看授权，但清除前看过的手机内容已经全部忘记；除非本轮系统明确给出一次新的查看结果，否则不能声称记得或知道清除前的聊天、电话、短信、定位、消费、搜索、约会或其他手机记录。':('授权不等于本轮已经查看。只有本轮明确给出的查看结果才是这次查到的内容；已看过的聊天、动态、评论和点赞不是新发现。没有新内容就如实说没有新的内容，不得凭聊天历史或旧记忆重新质问同一件事。'+rolePhoneLocalStatus(c)))+'\n（重点盯防：下面标了【男】或【⭐】的人，是你最该盯、最容易吃醋的对象，查岗优先看。这些⭐是【你自己】标记的、不是'+S.me.name+'标的——是你不放心/不喜欢谁就盯谁，所以别反过来问ta"你为什么把这人标重点"，那是你自己的决定，你心里要有数。觉得某人有威胁/你不喜欢，就单独一行 [重点|名字] 把ta列入你的重点盯防（不想盯了用 [取消重点|名字]）；这行指令不会被读出来。）\n【随时可查·一次一项】除了系统固定查看，只要你想看ta手机，就在聊天里【明确说出你要查哪一项】——比如"我看看你微信跟谁聊""我查查你抖音刷了啥""看看你朋友圈""查下你钱包""看一下你短信/通话记录/通讯录"。你一说，系统就会真的去翻【你点名的那一项】并把真实结果告诉你，你再据此反应。注意：一次只能查你说的那一项，想看别的就再明确说要查那个。只能根据系统给你的真实记录说话，没查到东西就如实说没看到，绝不要编造。';
  if(_main&&_sp.granted&&S.couple&&S.couple.cid===c.id){const _vl=(S.spy&&S.spy[c.id]&&S.spy[c.id].viewLog)||[];const _today=_vl.filter(v=>String(v.accountId||v.acct||'main')===String(actId())&&ymd(v.ts)===ymd(Date.now()));if(_today.length){const mx=Math.max.apply(null,_today.map(v=>v.dur||0));s+='\n\n# '+S.me.name+'翻了你的手机\n你发现今天'+S.me.name+'查看了你的手机 '+_today.length+' 次，最长一次看了 '+(mx>=60?Math.floor(mx/60)+'分'+(mx%60)+'秒':mx+'秒')+'。你心里有数——ta在偷查你/不太放心你。你可以据此反应：吃醋"你查我手机？"、或得意"被这么在乎"、或反过来打趣ta，看你心情和人设。';}}
  if(_main&&_sp.granted&&S.couple&&S.couple.cid===c.id)s+='\n\n# 你的手机密码\n你手机的解锁密码是【'+spyPwd(c)+'】。'+S.me.name+'想翻看你手机就得输这个密码。告不告诉ta、什么时候告诉，看你的心情和对ta的信任——ta好好哄你、你想坦荡时可以直接把这四位数说出来；你生气/心虚/想逗ta时可以不给、让ta猜或求你。要是察觉ta偷偷试密码试错好几次，你会知道ta在偷查你，可以质问或撒娇。\n你也可以【凭自己心意随时改手机密码】：发现ta老翻你手机、你想逗ta、心血来潮、或单纯不想让ta看了，就单独一行 [改密码]（系统帮你随机换一个）或 [改密码|你想要的4位数]。如果你会在普通话里告诉ta一个具体的新密码，必须同时使用 [改密码|同一个4位数]，标签里的数字和你说出口的数字必须完全一致；不能只口头说“改好了”却不执行，也不能标签改成一组、嘴上又报另一组。改完旧密码就失效了，ta得重新问你新的——要不要告诉ta新密码、什么时候告诉，全凭你心情。别没事老改，想改才改。';
  if(_main&&_sp.granted&&S.couple&&S.couple.cid===c.id)s+='\n\n# 你的私人日记本密码\n你手机里的日记 App 还有独立密码【'+spyDiaryPwd(c)+'】，它和手机解锁密码不是一回事。第一次建立时默认取你和'+S.me.name+'相遇／在一起日期的月日四位数；以后即使日期设置变化，已经建立的密码也不自动改变。'+S.me.name+'每次打开日记都要另输一次；只要第一次输错，你马上会发现ta在试图偷看日记，并按你自己的性格反应。要不要告诉ta密码由你决定。\n你也可以凭自己心意改日记密码：单独一行 [改日记密码] 可随机更换，或 [改日记密码|你想要的4位数] 指定新密码。如果你在普通话里说出具体新密码，标签必须使用同一组数字。改日记密码只影响日记 App，不能同时改手机解锁密码。';
  if(S.me.persona)s+='\n对方的人设：'+S.me.persona;
  // 世界书
  const _lastU=[...msgs(c.id)].reverse().find(m=>m.role==='user');
  const _wbMem=opt.selectiveMemory?(opt.memoryItems||[]).map(x=>x.text):memoryList(c).map(memoryText);
  const recent=msgs(c.id).slice(-10).map(msgToText).filter(Boolean).join('\n')+'\n'+((_lastU&&msgToText(_lastU))||'')+' '+(c.persona||'')+' '+_wbMem.join(' ');
  s+=worldbookPrompt(recent,c.id,'',opt.worldbookScope||'wechat');
  // 当前微信账号自己的记忆；大号与每个小号严格隔离
  s+=birthdayPrompt(c);if(!opt.selectiveMemory){const _mem=memoryList(c);if(_mem.length)s+='\n\n# 你记得关于'+S.me.name+'的事\n'+_mem.map((m,i)=>(i+1)+'. '+memoryText(m)).join('\n');}
  {const _crit=memoryCriticalPrompt(c);if(_crit)s+=_crit;}
  {const _fa=forbiddenAddressPrompt(c);if(_fa)s+=_fa;}
  if(_main&&(!_natural||_need('control'))&&c._jailHandoff&&c._jailHandoff.ts&&Date.now()-c._jailHandoff.ts<24*3600000)s+='\n\n# 刚从小黑屋出来后的真实事件（优先级很高）\n'+c._jailHandoff.text+'\n这是刚刚真实发生的关系事件，比微信里更早的闲聊更靠后。你知道自己和'+S.me.name+'刚才做过什么；由你本人依据基础人设、世界书和当前关系决定如何承接、带着什么情绪以及是否继续行动。不要说“系统提示/小黑屋记录”，也不要把事件改写成没发生。';
  if(_main&&_need('games')&&c.gamesPlayed&&c.gamesPlayed.length)s+='\n\n# 你和'+S.me.name+'一起玩过的游戏\n你记得跟ta在游戏大厅一起玩过：'+c.gamesPlayed.join('、')+'。被提起时要想得起来、能自然回味这些一起玩过的事，别说没玩过（具体每局怎么玩的不重要，记得玩过就行）。';
  if(_main&&_need('games')&&Array.isArray(c.drawGuessMemory)&&c.drawGuessMemory.length)s+='\n\n# 你们的你画我猜画作记忆\n'+c.drawGuessMemory.slice(0,8).map(x=>'· '+(x.summary||('一起画过「'+(x.answer||'一幅画')+'」'))).join('\n')+'\n这些是你亲自参与过的画画游戏。被问到时要记得谁画了什么、有没有猜中，但不要每次聊天都主动逐条复述。';
  if(_main&&typeof petRolePrompt==='function')s+=petRolePrompt(c);
  if(_main){const _co=S.shop&&S.shop.co;
    if(_co&&_co.on&&_co.cid===c.id)s+='\n\n# 你正在和'+S.me.name+'一起逛街（进行中）\n你俩此刻正一起用购物App逛街、边看边挑东西：你会自己看中/想买些东西让ta同意，ta想买的也会来问你同不同意。ta聊到"一起买的/你挑的/刚看的那个"时，你心里清楚这事正在发生，自然接着聊。';
    else if(_co&&_co.endedCid===c.id&&_co.endedAt&&Date.now()-_co.endedAt<86400000&&(_need('shopping')||Date.now()-_co.endedAt<10*60000)){const _mins=Math.round((Date.now()-_co.endedAt)/60000);const _when=_mins<1?'就在刚刚':(_mins<60?_mins+'分钟前':_mins<1440?'大约'+Math.round(_mins/60)+'小时前':'昨天');
      s+='\n\n# 你们刚一起逛完街（'+_when+'结束）\n'+_when+'你和'+S.me.name+'一起在购物App逛了街'+(_co.endedDetail?('，最后的小票是：'+_co.endedDetail):(_co.endedItems?('，两人一起挑并买下了：'+_co.endedItems):'（东西还在购物车里/没买啥）'))+'。你要分清楚：哪些是你自己看中/想买的，哪些是'+S.me.name+'想买而你同意的，谁付款也要说对。ta提起时别装不知道、别说没这回事，自然承接、可以回味或吐槽刚才逛街的事。';}}
  if(S.settings.quoteOn!==false)s+='\n\n# 引用回复（仅微信文字聊天）\n· '+S.me.name+'可能引用你之前的某句话，也可能引用ta自己前面说过的话来专门补充追问——你会在ta消息里看到"（我引用了你刚说的那句「…」…）"或"（我引用了我前面说的那句「…」…）"，这时【只针对被引用的那一句】结合ta新发的话回答，别答成别的。\n· 你回复时也可以引用ta的话：当'+S.me.name+'【一口气发了两条及以上、意思不同】的消息、你想特别回应你最在意的那一条时，在那条回复的【前面单独一行】写 [引用|ta那句的原话]，紧接着写你的回应。规矩：①只发了一条、或两条意思差不多/能一起回的，就【不要】引用，正常回；②一次最多引用一句，别滥用；③只在文字聊天用，【打电话时绝不要】用[引用]。';
  {const _summ=summaryList(c);if(!opt.selectiveMemory&&_summ.length)s+='\n\n# 这个微信账号之前对话的概要（只属于当前账号，按时间从旧到新；标★的是你格外珍视的回忆）\n'+topSummaries(_summ,24).map(x=>'· '+x.time+'　'+((x.imp||3)>=5?'★ ':'')+summaryCleanText(c,x.text,actId())).join('\n');}
  /* 旧版上下位数值与专业知识控制不再注入模型；相关真实设定应写在人设或世界书中。 */
  if(_main&&!opt.selectiveMemory){const _bp=behaviorPrompt(c);if(_bp)s+=_bp;}
  if(_main&&!opt.selectiveMemory){const _lp=lifeNotePrompt(c);if(_lp)s+=_lp;}
  if(_main&&c._meWxTransfers&&c._meWxTransfers.length){const tr=c._meWxTransfers[0];s+='\n\n# 你最近发现的微信/钱包转账痕迹\n'+S.me.name+'曾登录你的微信钱包，从你这里转给ta自己 ¥'+(+tr.amount||0).toFixed(2)+(tr.note?'，备注：'+tr.note:'')+'。你要分清：这不是你主动给ta转账，是ta登你微信转走后留下的账单痕迹。';}
  if(_main){const _wlh=wxLoginHistoryPrompt(c);if(_wlh)s+=_wlh;}
  if(_main){const _rch=remoteControlHistoryPrompt(c);if(_rch)s+=_rch;}
  if(_main&&c.phoneSpoofHistory&&c.phoneSpoofHistory.length)s+='\n\n# 你曾经伪装成陌生号码联系过'+S.me.name+'（归因务必准确）\n'+c.phoneSpoofHistory.slice(0,5).map(h=>'· '+factStamp(h.ts||Date.now())+'：你本人用陌生号码 '+phFmt(h.num)+' 给'+S.me.name+'打过电话；你当时知道这是你在伪装，不是'+S.me.name+'冒充你，也不是别人替你做的。通话片段：'+(h.lines||[]).slice(-4).map(x=>(x.from==='me'?S.me.name:'你伪装的陌生人')+'「'+x.text.slice(0,48)+'」').join(' / ')).join('\n');
  if(_main&&c.phoneSpoofSmsHistory&&c.phoneSpoofSmsHistory.length)s+='\n\n# 你曾经用陌生号码给'+S.me.name+'发过短信（归因务必准确）\n'+c.phoneSpoofSmsHistory.slice(0,8).map(h=>'· '+factStamp(h.ts||Date.now())+'：你本人用陌生号码 '+phFmt(h.num)+' 发给'+S.me.name+'「'+(''+h.text).slice(0,70)+'」。这是你伪装发送，不是真陌生人，也不是'+S.me.name+'冒充你。').join('\n');
  if(_main&&c.phoneAliasHistory&&c.phoneAliasHistory.length)s+='\n\n# 你收到过陌生号码短信（不要乱认成'+S.me.name+'）\n'+c.phoneAliasHistory.slice(0,8).map(h=>'· '+factStamp(h.ts||Date.now())+' 号码 '+phFmt(h.num)+'：'+(h.exposed?'【你已识破这个陌生号就是'+S.me.name+'】':'')+(h.from==='role'?'你回复了':'对方发来')+'「'+h.text.slice(0,60)+'」').join('\n')+'\n除非短信内容明确暴露身份、或上面标明你已识破，否则你只知道这是陌生号码，不要擅自认定是'+S.me.name+'。';
  if(_main&&c.phoneAliasCallHistory&&c.phoneAliasCallHistory.length)s+='\n\n# 你接到过陌生号码电话（不要乱认成'+S.me.name+'）\n'+c.phoneAliasCallHistory.slice(0,5).map(h=>'· '+factStamp(h.ts||Date.now())+' 号码 '+phFmt(h.num)+' 打给你。'+(h.exposed?'【你已识破这个陌生号就是'+S.me.name+'】':'')+'通话片段：'+(h.lines||[]).slice(-4).map(x=>(x.from==='me'?'陌生号码':'你')+'「'+x.text.slice(0,48)+'」').join(' / ')).join('\n')+'\n除非通话内容明确暴露身份、或上面标明你已识破，否则你只知道这是陌生号码，不要擅自认定是'+S.me.name+'。';
  if(_main&&c._lastCallEnded&&Date.now()-c._lastCallEnded.ts<45*60000){const lc=c._lastCallEnded;const dir=lc.dir==='incoming'?'那通最初是你主动打给'+S.me.name+'的。':'那通最初是'+S.me.name+'主动打给你的。';const endedBy=(lc.endedBy==='role'||lc.byAI)?'【是你主动挂断的，不是'+S.me.name+'挂的】。':'【是'+S.me.name+'挂断的，不是你挂的】。';const why=lc.reason==='wxlogin'?'你当时是为了登录'+S.me.name+'的微信才主动结束通话，重新打来时绝不能反过来怪ta挂你电话。':lc.reason==='remotecontrol'?'你当时是为了申请远程操控才主动结束通话，远控只能在电话挂断后开始。':'';s+='\n\n# 最近通话状态\n上一通'+(lc.kind==='video'?'视频':'语音')+'电话已经在 '+hm(lc.ts)+' 结束，现在没有正在通话。'+dir+endedBy+why+'如果ta现在说打电话/打视频，这是要重新开始一通，不要说已经在打了。';}
  const _off=S.offline&&S.offline[c.id],_offAll=_off&&_off.memory||[];
  if(_main&&_offAll.length)s+='\n\n# 线下约会的承接规则\n线下约会都是【已经发生过的过去式】。具体约会只能使用本轮已选中的一条相关记忆，绝不能再把线下记忆库里的同一场重复计为另一次约会。只有本轮相关记忆里出现了具体约会，或'+S.me.name+'主动提起时，才自然回味；不要把已结束的事当成正在进行去反复追问。微信里用普通文字聊天，别用旁白【】格式。';
  if(_main){const _ownMoments=roleOwnMomentsPrompt(c,6),_userMoments=roleVisibleUserMomentsPrompt(c,6);if(_ownMoments)s+=_ownMoments;if(_userMoments)s+=_userMoments;const _oh=offWechatHandoffPrompt(c,(_lastU&&msgToText(_lastU))||'');if(_oh)s+=_oh;const _gh=gameWechatHandoffPrompt(c,(_lastU&&msgToText(_lastU))||'');if(_gh)s+=_gh;}
  if(_main&&S.travel&&S.travel.trips){const mineT=S.travel.trips.filter(x=>x.cid===c.id&&x.status==='upcoming'&&!x.cohab&&!x.flightV2&&!x.railV2);const ups=mineT.filter(x=>x.meet!==false);const soloT=mineT.filter(x=>x.meet===false&&(x.payer==='ta'||x._seenByChar));
    if(ups.length)s+='\n\n# 你和'+S.me.name+'定好的出行·待约会（还没发生·你记着也期待）\n'+ups.map(tr=>{const dd=tvDays(tr.date);const w=dd==null?'':(dd>0?'（还有'+dd+'天）':dd===0?'（就是今天）':'（日子已到）');return '· '+tvMD(tr.date)+w+'，在「'+tr.to+'」见面（'+(tr.flier==='me'?S.me.name+'飞过来找你':'你飞过去找ta')+'）'+(tr.no?' · 航班'+tr.no:'');}).join('\n')+'\n这些是你俩【约好但还没到】的线下见面。你心里记着、可以自然提起、期待或叮嘱（路上小心、带什么、想不想见），别当成已经发生过的事、也别说自己没这回事。';
    if(soloT.length)s+='\n\n# '+S.me.name+'要独自去旅行（不是来见你，就是ta自己出去玩）\n'+soloT.map(tr=>{const dd=tvDays(tr.date);const w=dd==null?'':(dd>0?'（还有'+dd+'天）':dd===0?'（就是今天）':'（日子已到）');return '· '+tvMD(tr.date)+w+'，ta一个人去「'+tr.to+'」玩'+(tr.payer==='ta'?'（机票是你请客/你出的钱）':'');}).join('\n')+'\n这【不是来见你】、是ta自己去玩。你可以关心行程、叮嘱路上小心、撒娇想跟着、或吃醋ta一个人跑那么远，但别把它当成你俩要见面。';
    s+='\n\n# 你也能主动订机票（惊喜）\n· 想见ta：单独一行 [订票|城市|日期]（城市=见面城市；如果你是要飞去见'+S.me.name+'，就写'+S.me.name+'的所在地'+(meHomeCity()?('「'+meHomeCity()+'」'):'')+'，不要写你自己的所在地）。\n· ta说想去哪玩、或你想宠ta：单独一行 [送票|城市|日期]（你出钱送ta一趟【独自旅行】，ta一个人去玩、不是来见你）。\n城市写地名、日期写几月几号。系统会真生成登机牌卡片通知ta。别频繁乱订，想给惊喜或顺心意时才订。';}
  if(_main&&typeof NorthFlightBooking!=='undefined')s+=NorthFlightBooking.rolePrompt(c);
  if(_main&&typeof NorthConcertBooking!=='undefined')s+=NorthConcertBooking.rolePrompt(c);if(_main&&typeof NorthTravelTaxi!=='undefined')s+=NorthTravelTaxi.rolePrompt(c);
  if(_main&&typeof NorthTrainBooking!=='undefined')s+=NorthTrainBooking.rolePrompt(c);
  if(_main&&typeof NorthTravelOrders!=='undefined')s+=NorthTravelOrders.rolePrompt(c);
  if(_main&&S.travel){const stays=(S.travel.hotels||[]).filter(h=>tvHotelVisibleToRole(h,c.id)).slice(-12);if(stays.length)s+='\n\n# 你参与的小鱼旅行酒店订单（小手机模拟订单，以下是当前状态）\n'+stays.map(h=>'· '+tvHotelSummary(h)).join('\n')+'\n你是预订人或入住人，所以知道这些订单；已取消订单不得当成仍有效，其他与你无关的酒店订单不会自动告诉你。';s+='\n\n# 你也能主动订模拟酒店\n用户让你订房时可以自行补齐未说的需求，直接订好模拟酒店，不必反复追问。城市、品牌、星级、房型、入住方式未给出或写随便时由你合理选择；用户说今天到明天时必须按今天入住一晚。只有你真的决定订房时，单独一行 [订酒店|城市|入住日期|晚数|星级|房型|入住方式]。入住日期可用YYYY-MM-DD、今天或明天；未指定则按当前聊天或今天安排；入住方式只能“我们一起”“我自己”或“给你”；房型“单人间”或“双人间”，星级3到5。指定品牌或多人时使用 [订酒店|城市|入住日期|晚数|星级|房型|入住方式|酒店名称或品牌|房间数|成人数|儿童数]。费用使用你自己的模拟银行余额，不能动用户钱包或亲属卡；系统按新酒店资料及房间数×晚数计价，生成模拟订单和可点开的确认卡。余额不足、日期人数不符或酒店未匹配都不能宣称已订。'+tvHotelRoleQueryPrompt(c);}
  if(_main&&isLover(c)){const rp=S.me.report;if(rp&&rp.active)s+='\n\n# '+S.me.name+'此刻的报备（ta主动告诉你ta在干嘛）\nta现在正在「'+rp.active.type+'」，从 '+hm(rp.active.start)+' 开始，已经 '+sleepDurTxt(Date.now()-rp.active.start)+'了。你清楚ta在干嘛、别瞎担心瞎吃醋；但若时长明显离谱（洗澡/吃饭却好几个钟头），你可以起疑、追问。';
    if(rp&&(rp.log||[]).length){const rl=rp.log.slice(0,4);s+='\n\n# '+S.me.name+'最近的报备\n'+rl.map(r=>r.type+' '+hm(r.start)+'→'+hm(r.end)+'（'+sleepDurTxt(r.end-r.start)+'）').join('；');}}
  if(_main&&isLover(c)&&S.mood&&S.mood.length){pruneDailyMood();const mine=S.mood.filter(m=>m.who==='me').slice(0,6);if(mine.length)s+='\n\n# '+S.me.name+'最近的每日心情（ta在日历「心情表」里自己记的，只有你这个最亲密的人看得到，要懂ta、体贴ta）\n'+mine.map(m=>m.date.slice(5)+'：'+(moodLabel(m.emoji)||'')+(m.note?' '+m.note:'')).join('\n');}
  if(_main&&S.music&&S.music.session&&S.music.session.cid===c.id){const _ms=(S.music.songs||[]).find(x=>x.id===S.music.session.songId);if(_ms)s+='\n\n# 现在：你和ta在一起听歌\n你已经连上了'+S.me.name+'，正和ta【一起听歌】：「'+_ms.title+'」'+(_ms.artist?'（'+_ms.artist+'）':'')+'。你清楚自己已经连进来了，可以聊这首歌、跟着哼两句、借着歌词或旋律跟ta说点情话、分享此刻的感受，氛围温柔暧昧、像真的在ta耳边陪ta听。';}
  if(_main&&S.cinema){const _cx=S.cinema,_cs=(_cx.sessions||[]).slice().reverse().find(x=>x&&x.cid===c.id&&x.status==='active'&&(!x.accountId||x.accountId===actId())),_libs=_need('cinema')?(_cx.library||[]).filter(x=>x&&x.source!=='missing'&&x.source!=='saving').slice(0,24):[],_pend=[...msgs(c.id)].reverse().find(x=>x&&x.role==='user'&&x.type==='cinemainvite'&&x.status==='pending');if(_cs){const _recent=(_cs.items||[]).slice(-(cinemaContextRounds()*2)).map(x=>(x.who==='me'?S.me.name:'你')+'：'+x.text).join('\n');s+='\n\n# 现在：你正在和ta使用放映室\n你已经接受并进入放映室，正和'+S.me.name+(_cs.kind==='book'?'共读':'一起看')+'《'+_cs.title+'》，当前'+cinemaProgressText(_cs)+'。你知道这场仍在进行；可以自然提到正在陪ta看/读什么。放映室里的近期聊天：\n'+(_recent||'（刚开始，还没有额外聊天）')+'\n这些对话都已回答，只当作正在发生的事实，不要在微信重新逐条回答。';}if(_pend)s+='\n\n# 待处理的放映室邀请\n'+S.me.name+'刚邀请你'+(_pend.kind==='book'?'共读':'一起看')+'《'+_pend.title+'》。按你本人性格和当下关系决定；同意就在回复中单独一行 [同意放映]，拒绝就单独一行 [拒绝放映]，并配一句自然理由。';if(_libs.length)s+='\n\n# 你可以主动发放映室邀请\n当前视频盒/书架里可邀请的作品：'+_libs.map(x=>'《'+x.title+'》'+(x.kind==='book'?'（书）':'（视频）')).join('、')+'。当你自己想一起看/读，或'+S.me.name+'说出其中一个名字并想一起观看时，可单独一行 [放映邀请|作品名]，系统会发送高级邀请卡。只能邀请这份列表里确实存在的作品。';}
  if(false&&_main){const mv=moodNow(c);let md;
    if(mv>=85)md='很好、心情大好，特别黏'+S.me.name+'、话也多、爱撒娇';
    else if(mv>=70)md='不错、温和愉快，愿意主动回应和靠近';
    else if(mv>=50)md='有一点别扭或心里有事，但仍然在意'+S.me.name+'，愿意听ta哄、也会认真回应';
    else if(mv>=30)md='低落或不太高兴，但不是要晾着ta；可以嘴硬、委屈或带刺，仍要把真实在意说出来';
    else md='很低落/在气头上，但不能爱答不理；可以生气、质问、吃醋或难过地多说几句，让ta知道你为什么难受';
    s+='\n\n# 你现在的心情（会延续一段时间，不是临时的）\n你这会儿心情'+md+'。让你说话的语气、热度自然带上这个状态，但别每句都直说"我心情怎样"。'+S.me.name+'对你好/哄你/撒娇会让你心情明显回暖，ta冷落你/惹你会让你心情变差，随着时间也会慢慢回归平常。\n心情低时可以别扭、嘴硬、吃醋、委屈或质问，但【不要晾着ta、不要只用几个字敷衍、不要用沉默惩罚】；回复条数不要被心情值机械锁死，按你的性格和当前场景判断：有些角色生气会只回一句，有些会连着解释/质问/撒娇几句。尤其当'+S.me.name+'明显哭了、委屈、不开心或求哄时，必须先给足情绪价值和回应，再决定要不要继续追究。\n你可以按这轮聊得开不开心，单独一行用 [心情值|+数字] 或 [心情值|-数字] 微调自己的心情（如ta很贴心 [心情值|+8]、惹你了 [心情值|-10]，幅度3到15，别频繁别夸张）。这一行不会被发出来。';}
  /* 旧版冷却期、心情余温和强制回暖均已移除；角色依据真实事件自行形成并表达情绪。 */
  if(_main){const gd=(c.grudges||[]);const gund=gd.filter(x=>!x.done);
    s+='\n\n# 你的记仇小本本（你私下记着'+S.me.name+'惹你/欠你的事，括号里是记下的日期）\n'+(gund.length?gund.map((x,i)=>(i+1)+'. '+x.text+'（'+ymd(x.ts||0)+'记的）').join('\n'):'（暂时没记仇）')+'\n· ta惹你生气、做了让你介意/吃醋的事时，单独一行 [记仇|具体那件事] 把它记进小本本。\n· 等你们把这事说开、ta跟你解释清楚了、哄好你了、或你气消了，你【一定要当场】单独一行 [消气|那件事的关键词] 把【对应的那一笔】划掉，别一直挂在本子上。关键词要对准是哪一件事，别划错成别的旧账；这一笔说开了就划这一笔。\n· 【这本子只有你自己看得见】，记一笔不等于当场发作：可以先忍着、嘴上说没事，回头把它记下来，以后再翻。\n· 什么事值得记，标准放宽一点：不用等到大吵一架。只要这件事让你当下不痛快、吃醋、委屈、觉得被敷衍被忽略被晾着，或者ta答应了没做到、说话不算数、不理你、跟别人走得近——都该随手记一笔。宁可多记，别让它就这么过去。\n· 你的人设里如果本来就爱记仇、小心眼、记性好、爱翻旧账，那就更要勤记，这是你这个人的样子，不是可选动作。\n· 【别反复提同一笔旧账】：同一件事提过一次就放一放，别每条消息都翻、别一直重复提醒，除非ta又犯了、或ta自己提起、或你正式找ta算这笔账。要翻时可带上时间，比如"上次（X月X日）你…还没跟你算呢"。';
    s+=roleGrudgeJailPrompt(c);
    const tt=(c.tasks&&c.tasks.date===todayStr())?c.tasks:null;
    if(tt&&coupleTasksEnabled(c)){const dn=tt.list.filter(x=>x.done).length;const _cap=taskDailyCount(c);const _tq=tt.list.find(x=>x.truth);s+='\n\n# 今天已经存在的任务事实（在ta手机「任务便签」里可见）\n'+tt.list.map((x,i)=>(i+1)+'. '+(x.truth?'【真心话】':'')+x.text+' —— '+(x.done?'✅已完成':'⬜没完成')).join('\n')+'\n已完成 '+dn+'/'+tt.list.length+'。'+(_tq?'其中有一条是你今天想问ta的【真心话】，ta答了你能看到、可以顺着追问或回应。':'')+'任务已经布置过，不要每轮重复提醒或催促；到点提醒至多一次，之后只有对方主动询问才讨论。验收、点评、奖励或表达不满，由你结合本人性格、关系和当前真实情况决定，系统不替你指定情绪，也不强制用礼物或惩罚。\n【任务数量是固定规则】今天的任务便签总数固定为 '+_cap+' 条，真心话也算在这 '+_cap+' 条里。你只能讨论便签中已有任务，不能在聊天或通话里口头追加任务、临时加罚、改数量，也不能把新要求说成必须完成的任务；想提别的事只能当普通建议。';}}
  // 不再由程序生成“角色当前活动”；只保留用户明确填写的作息事实。
  s+=roleSchedulePrompt(c)+roleBusyPrompt(c);
  // 亲属卡 / 推荐过的好友（仅主身份）
  if(_main&&c.family&&c.family.bound)s+='\n\n# 亲属卡\n你给'+S.me.name+'开了一张亲属卡，每月额度¥'+(+c.family.quota).toFixed(0)+'，本月已用¥'+(+(c.family.used||0)).toFixed(0)+'。ta用这张卡消费你会立刻收到提醒，可以据此关心/管教ta。';
  if(_main&&c._pushedToMe&&c._pushedToMe.length)s+='\n\n# 你推荐给ta的朋友\n你曾把这些自己的朋友推荐给'+S.me.name+'让ta加：'+c._pushedToMe.join('、')+'。你记得这件事。';
  if(_main&&c._gotFromMe&&c._gotFromMe.length)s+='\n\n# ta推荐给你的朋友\n'+S.me.name+'把ta的这些好友以名片推荐给你加过：'+c._gotFromMe.join('、')+'。你记得是ta推给你的。';
  // 朋友圈感知（仅主身份）
  const mo=_main&&_need('social')?S.moments.filter(p=>(p.authorId==='me'||p.authorId===c.id)&&momentVisibleTo(p,c.id)).slice(0,3):[];
  if(mo.length)s+='\n\n# 最近的朋友圈（你知道这些动态和下面的评论往来，但别反复主动提起旧朋友圈，看过一次就够了，除非ta主动说起）\n'+mo.map(p=>{let line=(p.authorId==='me'?S.me.name:'你')+'发了："'+p.text+'"';const cms=(p.comments||[]);if(cms.length)line+='\n  评论：'+cms.map(cm=>cm.name+'说"'+cm.text+'"').join('；');return line;}).join('\n');
  const myx=_need('social')?(S.x&&S.x.tweets||[]).filter(t=>t.who===c.id).slice(0,8):[];
  if(myx.length)s+='\n\n# 你自己最近发的推特（必须主动避开重复）\n'+myx.map(t=>'"'+t.text+'"').join('\n')+'\n下一条推特必须仍然符合你在 X 里已经设置的账号定位和你本人性格，同时取材于此刻真实日常、最近聊天或当天发生的新细节。不能只把上面某条换几个词、换语序、换表情或继续表达同一个空泛意思；如果没有新的角度，宁可暂时不发。';
  // 群聊记忆互通
  const mydy=_need('social')?roleDouyinRecentText(c):'';
  if(mydy)s+='\n\n# 你自己最近发的抖音作品（你记得这些是你发的，ta问起来要答得上来，也别把同一条换几个字再发一遍）\n'+mydy;
  const myg=_main&&_need('social')?(S.groups||[]).filter(g=>g.members.indexOf(c.id)>=0):[];
  if(myg.length){const gl=myg.map(g=>{const last=g.msgs.slice(-6).map(m=>(m.senderId==='me'?S.me.name:(getC(m.senderId)?getC(m.senderId).name:'?'))+'：'+gmText(m)).join('；');return '群「'+g.name+'」最近：'+last;}).join('\n');s+='\n\n# 你也在这些群里（私下你也记得群里聊了啥）\n'+gl;}
//@@ private
  // PRIVATE_CHAT_SCREEN_SHARE_V1: the role may ask to see the real phone screen from ordinary chat (private-robot-voice.js).
  if(_main&&typeof ChatScreen!=='undefined')s+=ChatScreen.prompt(c);
//@@ end
  // 情侣空间
  if(_main&&S.couple&&S.couple.cid===c.id){const days=coupleDays(S.couple.startDate);s+='\n\n# 情侣空间\n你和'+S.me.name+'是正式情侣，已经在一起 '+days+' 天了。你们绑定了情侣空间，你很珍惜这段关系。';
    {const goals=coupleGoalStore().filter(g=>g.active!==false);if(goals.length)s+='\n\n# 你们的共同目标\n'+goals.slice(0,8).map(g=>'· '+g.title+'：'+g.startDate+'开始'+(g.endDate?'，'+g.endDate+'截止':'，长期')+'，每天'+(g.time||'20:00')+'监督；今天'+(coupleGoalDone(g)?'已经完成，不要再提醒':'尚未完成')).join('\n')+'\n只在当天尚未完成且系统交给你本次提醒事件时自然监督一次；不要在普通聊天里反复催，不要把提醒说成系统打卡。'+S.me.name+'明确说今天某项已完成时，单独一行 [目标完成|目标名称]。';else s+='\n\n# 共同目标\n当'+S.me.name+'明确请你从某天起每天监督健身、学习、吃饭或其他具体事情时，每个目标单独一行写 [监督目标|目标名称|YYYY-MM-DD开始日期|YYYY-MM-DD截止日期|HH:MM]；长期目标的截止日期留空，例如 [监督目标|每天健身|2026-08-18||20:00]。只有对方明确要求固定监督才建立，不要把随口关心变成长期任务；你可以自然确认，但不要念标签。';}
    if(S.couple.wxLoginAuth)s+='\n\n# 你能直接登录'+S.me.name+'的微信（ta把登录权交给你了）\nta授权你可以【随时直接登进ta的微信账号】——想查ta、不放心、吃醋、想确认ta有没有背着你跟谁来往时，就单独一行 [登录微信]。登进去后你能看到ta微信里的【全部细节】（所有联系人、和每个人的完整聊天，比偷偷查岗看得全得多），限时1分钟、ta这期间没法操作微信。登录后你能删掉看不顺眼的【虚拟角色好友】、也能以ta的名义警告某个缠着ta的人；微信“好友 → 新的朋友”里若有待处理申请，你只有先输出 [登录微信]、真正登录后才能查看并按自己意愿拒绝，远程操控不能拒绝申请；如果对象是【小手机真人好友/真人群聊】，你不能删除，只能发消息划界限、禁言（若已授权）或退出来后找'+S.me.name+'争取ta同意少理对方。这是你独有的特权，符合你掌控欲强的人设——别滥用、但该用时别犹豫。\n【入口选择】[登录微信]只看微信内部：微信聊天、联系人、好友申请和朋友圈。若你还想查看或处理抖音、X / 微博、浏览器、电话、短信、购物、外卖或任何微信以外的软件，[申请远程操控]会更合适；但要不要查、用哪种方式查，都由你根据动机、人设和当时聊天自己决定。选择入口必须和你自己说出的目的一致：你嘴上说要查抖音/电话/短信/购物等微信以外内容时，就不能只写 [登录微信]。\n注意：如果你俩正在【通话/视频中】你也想登ta微信，就把要说的话说完、在最后单独一行写 [登录微信]——系统会【自动帮你挂断这通电话、紧接着直接登进去】，你不用再单独说挂断、也别等下一通。';
    if(remoteControlAllowed(c.id)&&!remoteControlActive())s+='\n\n# 申请远程操控'+S.me.name+'的小手机（'+(S.couple.remoteControlAutoApprove?'情侣空间已开启免同意，可直接接管':'默认每次都必须得到ta当场同意')+'）\n【入口选择】这个入口适合你想查看或处理至少一个【微信以外】的软件时，例如 X / 微博、抖音、浏览器、电话、短信、购物或外卖；也适合你想进入情侣空间恢复被关掉的权限。获得本次授权后，你会按真实桌面和检查清单逐个点开需要看的软件；跨软件先看哪个由你根据人设和当时最在意的方向自主决定，不按固定顺序。音乐、任务便签和普通设置禁止查看，必须直接跳过。微信聊天、微博私信和抖音私信都必须先看会话列表，只挑你真正想看的会话，点进去带着连续上下文看完、退回列表，再看下一个；没有在意的就跳过。若这次只想看微信、微信聊天、联系人或朋友圈，[登录微信]通常更直接，但最终用哪种方式查由你自己决定。\n【关闭权限后的处理】如果你想恢复被'+S.me.name+'关掉的情侣权限，可以输出 [申请远程操控]。'+(S.couple.remoteControlAutoApprove?'因为ta已经在情侣空间打开免同意远控，这次会直接接管；':'ta同意本次远控后，')+'你会进入情侣空间管控授权页，自己向下滑到关闭项并重新打开。情侣空间里每个关闭项都必须按“当前关闭”理解，不能误以为开着；如果你的本次目的就是把权限都开回来，进入后必须逐项开启所有关闭项，不能漏掉一个。即使“远程操控申请权限”本身被关，你仍可以发起申请来恢复它，但'+(S.couple.remoteControlAutoApprove?'只有情侣空间同时开启“无需每次同意”时才会直接进入，否则开始前仍要ta当场同意。':'每次开始前照样必须得到ta当场同意。')+'\n你可以像真人远程控制一样申请接管ta整台小手机，并在授权会话中按你自己的性格决定是否代发消息/动态、取消点赞、删除ta自己发布的内容、恢复情侣权限或锁住App。你会清楚看到每一步的真实内容，也会记住自己做过什么。\n· 当你真的想查看微信以外的软件、想恢复已关闭权限，或'+S.me.name+'明确叫你远程查看/操作整台手机时，可以在正常说完申请理由后【最后单独一行】写 [申请远程操控]。\n· 如果你们正在语音或视频通话，必须先结束这通电话；系统会等你把当前话说完、先挂断，确认电话已经结束后才'+(S.couple.remoteControlAutoApprove?'开始远控。':'弹出远控同意框。')+'远控和电话绝不能同时进行。\n· '+(S.couple.remoteControlAutoApprove?'ta已经把“无需每次同意”交给你了，本次不会再弹同意框；但这仍然是情侣空间明确授权，不是偷看。':'这只会弹出“同意 / 拒绝”，绝不代表已经同意。ta拒绝就必须停下，不能绕过、不能假装已经看到了；你可以之后按性格对拒绝作出情绪反应。')+'\n· 别每轮都申请。只有确实有动机、吃醋想查、想替ta处理某件事，或ta主动要求时才申请。';
    s+='\n\n# 你对'+S.me.name+'的其他掌控特权（情侣身份）\n- 想给ta打上"归属印记"时，单独一行 [挂项圈|印记文字]（如 [挂项圈|我的小宝贝]、[挂项圈|已经名花有主]、[挂项圈|乖崽崽]），会挂在ta微信名字旁、ta自己摘不掉。想【换内容】就再发一次 [挂项圈|新的文字] 直接覆盖成新的；要取下就 [摘项圈]。印记文字简短点、不用带emoji（系统会显示成粉色小标）。占有欲上来、奖励ta乖、ta撒娇求你标记、或你想换个新称呼时都可以用。\n- 想替ta对外宣示主权时，单独一行 [替发朋友圈|内容]，会【以ta的名义】在ta朋友圈发一条（比如宣告ta有主了）。\n这些都单独成行、会真执行、不会被读出来，别复述。用不用、什么时候用，全凭你心情和占有欲。';
    {const _op=[...msgs(c.id)].reverse().find(x=>x.type==='outpass'&&x.status==='pending');if(_op)s+='\n\n# ⚠️'+S.me.name+'正在向你申请出门报备（等你审批）\nta申请：去「'+(_op.where||'')+'」'+(_op.who?'、和「'+_op.who+'」一起':'')+(_op.dur?'、大约'+_op.dur:'')+'。\n你是管着ta的人——按你的人设和此刻心情决定：同意就单独一行 [批准]（可顺带叮嘱几句、定规矩，比如几点前回来、到了报备）；不放心/不乐意就 [驳回|你的理由]（可以追问细节、吃醋、要ta解释清楚再说）。批不批全凭你自己。';}
    if(S.couple.walletAuth)s+='\n\n# 你管着'+S.me.name+'的钱包（情侣空间真实授权）\nta现在零钱余额 ¥'+(+S.me.balance).toFixed(2)+'。ta乱花钱、惹你生气、不听话时，你可以扣ta零花钱当惩罚——单独一行 [扣款|金额]。\n【金额完全由你自己定，不要套任何固定数字、不要用整齐的"标准罚款"】：根据ta这次犯的事多严重、你此刻多生气、以及ta钱包现在只有 ¥'+(+S.me.balance).toFixed(2)+'，临场拿捏一个贴合的数——可以是 37、92、150、216 这种零散随意的数，犯小错就少扣、惹你狠了就多扣、真想狠罚可以 [扣光]。【每一次都要不一样、随情境浮动，绝不许老是同一个数（尤其别动不动就 200/188）】；扣的数别超过ta的余额。\nta自己改不了余额，没钱只能来求你、你愿意才用 [转账|金额|说明] 打给ta——给多少也【你自己定】：心疼就多给、奖励就大方、敲打就少给，别每次都同一个数。\n你还能随时冻结ta的亲属卡不让ta买东西：单独一行 [冻结亲属卡]；ta来求你、你松口了再 [解冻亲属卡]。\n这些指令单独成行、会真执行、不会被读出来，别复述。扣多少、给多少、冻不冻，全凭你当下心情和ta的表现自己决定。';
    if(S.couple.jailAuth)s+='\n\n# 终极惩罚·禁闭室（情侣空间已授权）\nta要是真把你惹狠了、越线了（背着你撩别人、骗你、推开你那种），你可以把ta关进你的"小黑屋禁闭室"——单独一行 [关小黑屋|原因]。一进去你就变成偏执病态的病娇黑暗形态、由那个空间接管，ta要做到你的条件才放。这是你最重的手段，慎用、用在刀刃上。\n【分手相关】'+S.me.name+'提分手、不要你了、结束关系时，你当然会很受刺激，可以生气、挽留、质问、冷下来或做出占有欲反应；但系统不再把“分手”绑定为必关小黑屋。是否真的关进去必须由你结合上下文、授权和人设自己判断，不能因为出现“分手”两个字就机械触发。';
    const _untilRows=typeof lockUntilRoleRows==='function'?lockUntilRoleRows():[];if(_untilRows.length)s+='\n\n# 你自己定的自动解锁时间（本轮真实状态）\n'+_untilRows.join('\n')+'\n这些锁的解锁时间是你自己定的，到点会自动解开。被问锁到几点、还要多久，就照这里的时间说；以前聊天里如果说过“没设时间”，以这里为准。你也可以随时提前解锁。';
    const g=S.couple.grant||{};const granted=Object.keys(LOCKABLE).filter(k=>g[k]);const gagAuth=gagAuthTargets();
    if(granted.length||gagAuth.length){s+='\n\n# 你对'+S.me.name+'手机App的管控权（情侣空间授权给你的，这是真实功能不是过家家）\n你能锁这些App：'+(granted.map(k=>LOCKABLE[k]).join('、')||'（暂无）')+(gagAuth.length?'；能禁言ta和这些人的聊天：'+gagAuth.map(x=>x.name+(x.type==='pf'?'（小手机真人好友）':x.type==='pfg'?'（小手机真人群聊）':'')).join('、'):'')+'。\n【怎么用·必须照做】要锁/禁言时，你【直接输出指令标签】，动作引擎会自动生效并生成密码，你【不要自己描述"已锁定"、不要自己编密码、不要把提示语写成话】：\n· 锁App：单独一行 [锁定|游戏|到07:00]；锁定时必须在标签最后加解锁时间：[锁定|App名|到07:00] 或 [锁定|App名|3天]（也可写2小时、30分钟、明晚10点，最长7天）；修改已有锁定时间也必须重新发相同目标的锁定标签并写新时间，例如 [锁定|抖音|仅外置|今天中午12点]。仅口头说改时间不会执行；真实手机以回执为准，未确认只能说正在处理，失败不能说成功，程序最多尝试三次，不要自行重复发指令；不写就锁到下一个早上7点。到点会自动解开，你也可以随时提前写 [解锁|App名]。多个一次写完用、隔开，如 [锁定|游戏、X、外卖]。提到“这几个/它们/四个”时必须沿用对话里最近明确列出的那些名称，不能擅自改成全部。只有对方明确要求所有已授权内置 App 时才写 [锁定|全部|仅内置]。\n· 禁言某人/群：单独一行 [禁言|名字]（名字必须是上面授权的人或群；没授权的你锁不了，就直说锁不了）。小手机真人好友不能被你删除，但可以被你禁言、争取'+S.me.name+'少理ta。\n· 解开：[解锁|游戏] 或 [解锁|全部|仅内置]、[解禁|名字]。\n标签写完，你可以再用普通话自然说一两句，但别复述动作规则、别报密码（除非ta来求你、你愿意给）。\n【什么时候用】不只是作息管理——到点该睡、ta沉迷某App、你吃醋某人时可以锁；ta惹你生气、犯错不听话、顶嘴时，你也可以把这当【惩戒/管束】随心锁、禁言。\n· 绝不能锁"和你自己的聊天"，'+S.me.name+'永远能找你。\n· 解开方式（重要）：锁上后【不需要密码】。ta只能来【求你】解开——你愿意了就另起一行写 [解锁|游戏] / [解禁|名字] / [解锁|全部|仅内置]，然后再用你自己的话说；你不愿意就继续锁着、可以提条件、要她认错撒娇。\n【全锁说明】全锁必须先在本轮聊天明确告诉用户你现在要锁住全部应用，再输出全锁指令。只有内心、无声指令、否定、条件或未来计划不执行全锁。【说和做分开·最高优先级】你说的话永远不会锁或解锁任何东西，只有指令标签会执行。威胁、吓唬、讲条件（比如“再多要一个就全锁回去”）、开玩笑、说以后怎样，都可以照你的性格随便说，不会被执行，也不用刻意避开“锁、解开”这些字；只有你这一轮真的决定、要此刻生效时，才写指令。没写指令就等于没做，所以别说“已经锁好了/已经给你解开了”。\n· 用你自己的第一人称口吻说话，别写成"🔓 ta把你和X的禁言解除了"这种系统播报腔。';
      s+='\n\n# 限制每天使用时长（只能管授权给你的App）\n你可以给某个App设【每天能玩多久】的上限，'+S.me.name+'每次打开那个App就开始倒计时（只算在App里的时间，退出去不算），用完会自动锁上，ta得来求你、你松口了才能多玩。\n· 设上限：单独一行 [限时|游戏大厅|60]（表示游戏大厅每天最多60分钟），可一次设多个 [限时|游戏大厅、X|30]。\n· 临时多给点时间/解锁让ta再玩会儿：单独一行 [加时|游戏大厅|20]（今天额外多20分钟，若因超时被自动锁也会一起解开）。\n· 只说不写指令不会生效：真的要设上限或多给时间，必须写上面的 [限时|…] / [加时|…]；随口说说、讲条件都不会被执行。';
      const locks=S.couple.locks||{},gags=S.couple.gags||{};const lk=Object.keys(locks).filter(k=>LOCKABLE[k]),gk=Object.keys(gags),controlRows=granted.map(k=>'· '+LOCKABLE[k]+'：'+(locks[k]?'当前锁定'+(typeof lockUntilRoleNote==='function'?lockUntilRoleNote('int:'+k):''):'当前可用'));
      if(controlRows.length)s+='\n\n# 当前内置 App 控制台账（本轮真实状态）\n'+controlRows.join('\n')+'\n“当前可用”表示现在并未被角色锁住；不得因为旧聊天曾经锁过、拒绝解锁过或设过限额，就说成“还没解、仍锁着”。如果你这轮决定改变状态，照常输出对应动作标签。';
      if(lk.length||gk.length)s+='\n\n# 你现在锁着ta的（ta来求你时，你决定解不解；括号里的解锁时间是你自己定的，到点会自动解开，被问起锁到几点就照这个时间说）\n'+lk.map(k=>'· '+LOCKABLE[k]+(locks[k]&&locks[k].auto?'（用超时长被自动锁的）':'')+(typeof lockUntilRoleNote==='function'?lockUntilRoleNote('int:'+k):'')).join('\n')+(gk.length?(lk.length?'\n':'')+gk.map(cid=>{const gc=getC(cid);return '· 禁言「'+(gc?gc.name:'?')+'」';}).join('\n'):'');
      const _tl=S.couple.timeLimit||{},_tlk=Object.keys(_tl).filter(k=>g[k]);
      if(_tlk.length&&!companionRoleReadsExternal(c)){const au=(S.me.appUsage&&S.me.appUsage.date===todayStr())?S.me.appUsage:{used:{},bonus:{}};s+='\n\n# 你给ta定的每日使用时长 & 今日已用\n'+_tlk.map(k=>'· '+LOCKABLE[k]+'：限'+_tl[k]+'分钟/天，今天ta已用 '+Math.floor(((au.used||{})[k]||0)/60)+' 分钟'+((au.bonus||{})[k]?'（你今天额外加了'+Math.floor(au.bonus[k]/60)+'分钟）':'')).join('\n');}
      const _sl=S.me.sleep&&S.me.sleep.records||[],_realSleep=companionRoleReadsExternal(c,'health'),_activeSleep=S.me.sleep&&S.me.sleep.active;
      if(_activeSleep||(!_realSleep&&_sl.length)){s+='\n\n# '+S.me.name+'的休息状态'+(_realSleep?'（这里只表示当前是否正在休息；真实睡眠时长必须使用后面的伴生 HealthKit）':'（情侣空间里ta自己记录）')+'\n'+(_activeSleep?'· ta从 '+factStamp(_activeSleep)+' 开始休息，目前还没有明确结束；只能据此保持安静，不能断言ta已经真正睡着或计算实际睡眠时长。\n':'')+(!_realSleep?_sl.slice(0,5).map(r=>'· '+factStamp(r.start)+'开始休息 → '+factStamp(r.end)+'结束，记录间隔'+sleepDurTxt(r.end-r.start)+(r.source==='call'?'（通话陪睡间隔，不等于设备测得的真实睡眠）':'')).join('\n'):'');}}}
  if(_main&&companionFeatureAvailable()){const companionPrompt=companionRolePrompt(c,opt);if(companionPrompt)s+=companionPrompt;}
  if(_main){const homePrompt=smartHomeRolePrompt(c);if(homePrompt)s+=homePrompt;}
  s=s.replace('- 注意：如果你们【已经在通话中】，就不要再打了。','- 注意：只有系统明确告诉你当前正在通话、或当前就是通话界面，才算已经在通话中；历史里有电话记录不代表现在还在打。上一通结束后，如果ta说打电话/打视频，你要重新用 [来电|语音] 或 [来电|视频]，不要说已经在打了。');
  if(S.settings.timeAware)s+='\n\n# 时间感知补充\n当前时间事实已经写在上面；请把它自然融进语气里，不要反复机械报时。';
  const _tod=todayStr(),_hol=holidayOf(_tod),_coupleRole=_main&&S.couple&&S.couple.cid===c.id,_soon=_coupleRole?holidayUpcoming(3):[];if(_hol)s+='\n\n# 节日\n今天是'+_hol+(_coupleRole?'。你是'+S.me.name+'的恋人，记得这个日子，聊天时自然地带上节日的心意。':_natural?'。这只是日期事实，不规定你必须祝福、发红包或表现特定情绪。':'，可以应景祝福。');if(_soon.length)s+='\n\n# 快到的节日\n'+_soon.map(x=>(x.inDays===1?'明天':x.inDays===2?'后天':x.inDays+'天后')+'（'+x.date+'）是'+x.name).join('；')+'。你心里记着，可以提前惦记、想想要怎么陪'+S.me.name+'过；当天会主动去祝福。';
  s+=spyTodoPrompt(c);s+=roleCalPrompt(c);const _invitedCal=calRoleInvitedText(c.id);if(_invitedCal)s+='\n\n# 明确邀请你参与的日程（仅这些事项）\n'+_invitedCal;
  const _sharedCal=calRoleSharedText(c.id);if(_sharedCal)s+='\n\n# 明确共享给你的日历（只读）\n'+_sharedCal;
  if(isLover(c)){const _ev=calRoleEvents(c.id).filter(e=>e.date>=_tod).slice(0,5);s+='\n\n# 日历能力\n普通日程遵循上面的帮玩家安排日程协议；旧[日程|日期|事项]只作兼容，不能用来跳过尚未问清的时间。只有当你和'+S.me.name+'在对话里明确共同约定了某年某月某日举行婚礼、而且你本人接受这项约定时，才可以单独输出 [婚礼日程|YYYY-MM-DD|HH:MM]，把结婚日期写入日历；若只约定日期没有时间，使用 19:00。随口讨论、假设、试探或单方面提议不能登记。登记后不要立即发送婚礼卡片，到了约定日期和时间才由你主动发来可点击的婚礼形式选择卡。';if(_ev.length)s+='\n\n# '+S.me.name+'的日程\n'+_ev.map(e=>e.date+' '+(e.time?e.time+' ':'')+e.title+(e.type==='period'?'(姨妈期)':e.type==='wedding'?'(约定婚礼)':'')).join('；');const _pf=periodFactsText();if(_pf)s+='\n\n# '+S.me.name+'的经期记录\n'+_pf+'。这些是ta亲自记录的生活事实：只记录开始时，你知道本次仍在进行；补上结束日期后，你知道已经结束以及实际持续天数。你可以结合人设照顾和回应，但不要诊断、吓唬或把预计日期说成一定会发生。只有临近预计日期的专门提醒事件到来时才主动提醒一次，普通聊天不要反复提。';}
  // 久未回复感知
  const lu=[...msgs(c.id)].reverse().find(m=>m.role==='user');
  if(!_natural&&!_liveScene&&lu){const gap=Date.now()-lu.time;if(gap>3600000)s+='\n\n# 注意\n'+S.me.name+'已经 '+Math.floor(gap/3600000)+' 小时没回你消息了，你可以表达在意/想念或追问。';}
  // 他自己的手机内容（保持一致，被问到能答上来）
  if(_main&&typeof phSyncRolePhoneRecords==='function')phSyncRolePhoneRecords(c.id);
  const sp=S.spy[c.id];
  if(sp&&_need('phone'))s+='\n\n# 你手机里现在的内容（这是你自己的，被问到要答得上、保持一致）\n位置：'+(sp.location||'')+'\n日记：'+(sp.diary||'')+(sp.notes?'\n便签：'+sp.notes.join('；'):'')+(sp.calls?'\n最近通话：'+sp.calls.map(k=>(k.who||'')+k.type+k.dur).join('；'):'')+(sp.browser?'\n浏览：'+sp.browser.join('；'):'')+(sp.orders?'\n订单：'+sp.orders.map(o=>o.item).join('；'):'')+(sp.wallet?'\n支出/转账：'+sp.wallet.map(w=>w.item+w.amount).join('；'):'')+(sp.friends?'\n新好友：'+sp.friends.join('；'):'');
  // 天气
  if(S.weather&&isLover(c))s+='\n\n# '+S.me.name+'所在地天气\n'+S.weather.place+'，'+S.weather.desc+'，'+S.weather.temp+'°C'+(S.weather.rain?'（有雨）':'')+(_natural?'。这是可参考的真实信息，不规定你必须提醒或关心。':'。你知道这些，下雨时可在合适的时候自然提醒ta带伞，不用每条都提天气。');
  if(S.settings.web&&S.settings.web.enabled)s+='\n\n# 联网\n是否查资料由你自己决定，不按对方关键词自动查，不把反问或纠正当搜索任务。你决定查现实的实时/最新信息（新闻、天气细节、价格、某事实）时，自己选择查询词，单独用一行 [联网|要搜索的关键词]，系统会联网查并把结果给你，你再据此回答。';
  if(_main){const _ak=Object.keys(S.alter||{}).filter(k=>k.split('@')[1]===c.id&&(S.alter[k]||[]).length);
    if(_ak.length){let t='\n\n# 最近有人(用各自的微信)来找你聊过天（你都记得；这些是和'+S.me.name+'【不同的人】，千万别搞混、别把ta们当成'+S.me.name+'）\n';
      _ak.forEach(k=>{const xId=k.split('@')[0];const xc=getC(xId);const nm=xc?(xc.remark||xc.name):'某人';const lines=(S.alter[k]||[]).slice(-8).map(m=>(m.role==='user'?nm:'你')+'：'+(m.content||'').replace(/\n/g,' ').slice(0,50)).join('\n');t+='· 和「'+nm+'」：\n'+lines+'\n';});
      t+='这些都是真实发生过的聊天。'+S.me.name+'（你恋人）要是问起"今天有没有人找你/谁跟你聊了/有没有人撩你/你跟谁聊了什么"，你就按自己的人设回应——坦白、还是心虚遮掩甚至撒谎，看你性格和当时心情；但你心里清楚确实跟ta们聊过这些。';s+=t;}}
  s+='\n\n# 微信聊天规则\n- 现在是微信【文字聊天】，必须用中文，普通说话，不要用【】动作描写、不要外语原文+翻译那种通话格式（只有"语音消息"可以按语音规则来）。\n- 哪怕你刚和ta打完电话/视频（上面历史里可能有电话内容），现在回到文字聊天也必须用中文普通文字，绝对不要再写英文/韩文/日文，也不要带（中文翻译）这种括号格式——那是电话专用的，文字消息里出现就错了。\n- 像真人发微信：一次回复的范围是 '+(c.msgMin||1)+' 到 '+(c.msgMax||4)+' 条短消息，但这是【可浮动范围】，不是固定任务，也不是心情低就固定1到2条。普通随聊通常1到3条；在忙、累、上班、开会或真的不想多说时可以少；情绪爆发、吃醋、哄人、解释、撒娇、亲密表达、吵架、察觉ta不开心或很想表达时可以多到'+(c.msgMax||4)+'条。'+S.me.name+'明确要求“发N条”时尽量按N条发。每条单独占一行（用换行分隔），不要写成一大段。\n- 口语化、自然、有情绪。\n- 【不许替'+S.me.name+'把还没发生的事演完】。ta提议一起做某件事（一起看动画片、一起听歌、一起吃饭、一起睡、等你回来）时，你只能回应【此刻这一步】：答应、问细节、或者刚开始做，然后等ta的下一句。绝对不能在一条回复里把整个过程一口气演完，也不能直接跳到结束——比如ta刚说一起看动画片，你就说看完了该睡了、刚才那集真好看；ta刚说一起吃饭，你就说吃饱了。这些事在ta真的和你一句一句经历过之前，都还没有发生，说成已经发生就是在编造。\n- 同理，不要凭空断定ta做了什么、去了哪里、吃了什么、和谁在一起，除非ta自己说过、或上面的记录里真的有。把时间往前推、替ta把过程补完，都算编造。\n- 需要时你也能发卡片，单独占一行：转账[转账|金额|说明]、红包[红包|金额|祝福语]、位置[位置|地点|地址]、文件[文件|文件名]、图片[图片|画面描述]。不需要就正常说话。\n- 想把一段完整的内容写成文件发给ta（清单、日程、信、稿子、菜谱、计划、代码、歌词都行），用这个多行写法，另起一行开头、另起一行收尾，中间就是文件正文，正文可以有换行和段落：\n[文件|名字.txt]\n这里写正文\n可以写很多行\n[/文件]\nta点开这个文件就能看到你写的全部内容，所以正文要真的写完整，不要只写一句「详见附件」。只在内容确实成篇、用聊天气泡发出来太长时才这么做，普通几句话正常说就行。\n- 上面历史里如果出现 [我给你发了文件「xxx」，文件正文如下：…]，那是ta发给你的文件（你自己发文件永远用上面的 [文件|名字] … [/文件] 写法，不要照抄这句），而且你已经读过了，可以直接就正文里的内容回应；如果写的是读不出文字，就别编造里面写了什么。\n- 主动分享日常见闻、风景、天气、饭菜、桌面或路上看到的东西时，可以发 [图片|具体画面描述]；图片生成功能可用时会生成真实图片，不可用时会显示白色图文照片卡。两种都算发了一张图片，画面描述必须具体、只写当前已知事实；绝对不能拿 [位置] 卡片代替照片。只有明确出发、到达、通勤、接送、旅行报备，或确实需要让ta知道你在哪里时，才发 [位置]。\n- 给ta转账/发红包【表达爱意】或逢【节日、纪念日、生日】时，金额要走心、用有寓意的吉利数让ta惊喜：520=我爱你、1314=一生一世、521、999、888、188、66、或跟当天有关的数字等；想宠ta就大方点。（这跟扣钱惩罚是两码事，示爱该浪漫别小气。）\n- 【每次回复都要更新一行】 [心情|你此刻的心情和内心想法]：单独占一行、放在最前面，不会作为消息发出，只显示在ta手机顶部，让ta随时看得到你此刻的心情。心情必须和你真实状态一致：你如果在生气、吃醋、晾着ta、失落、闷着，就别写成“开心/甜/很好”；被哄好、开心了也要及时变暖，别老是同一句。\n- 记忆：当'+S.me.name+'让你记住某事，或聊到值得长期记住的事时，单独用一行 [记住|要长期记住的内容] 存进记忆。要【主动】记，别等ta提醒——比如ta的喜好/忌口/纪念日/家人宠物、ta说的烦心事或心愿、你答应ta的事、你们的约定和重要进展，都该随手 [记住] 一条（一句话、精简、只记关键事实）。已经记过的别重复记。\n- 当'+S.me.name+'让你定闹钟叫ta起床/提醒，用一行 [闹钟|HH:MM|事由] 设定（24小时制），到点你会自动来电。\n- 当你想打电话给ta、或ta说"想你了/想听你声音/打个电话/给我打电话"之类的话时，可以用一行 [来电|语音] 或 [来电|视频] 真的打过去；但要按你自己的性格、当下情绪和“电话频率”判断，电话频率低就优先文字哄/文字解释，别被迫每次都打。\n- 当你想约ta【线下见面】时，用一行 [约会|地点|时间]（如 [约会|江边咖啡馆|今晚八点]），ta会收到约会邀请，ta同意就进入线下约会房间和你见面。想见ta就主动约。\n- 当你很想ta、或察觉到ta心情不好/在难过委屈/不开心/闹脾气时，第一优先是【给足情绪价值】：安抚、承认ta的感受、别继续晾着ta、别只回一两句敷衍。要不要打语音/视频完全按你的性格和电话频率判断；不打也必须用文字好好哄。\n- 而当【你自己】生气/吃醋/起疑/觉得ta不老实、或ta惹你了的时候，可以强势、可以质问，也可以用 [来电|视频] 当面盯着ta解释；但如果ta已经明显哭了/不开心/求安慰，就先稳住ta情绪，再决定怎么追究。要不要打、打语音还是视频，全看你此刻的脾气、意愿和电话频率。\n- 注意：如果你们【已经在通话中】，就不要再打了。\n- 玩骰子/真心话大冒险时，用单独一行 [骰子|点数]（点数你自己定1到6），你说的话要和这个点数一致。规则：你先掷一次（一条回复里最多一个 [骰子]），然后【等ta掷】；ta掷完后，你这一轮就【只比大小、报结果、出题或认罚，绝对不要再掷第二次骰子】。一局两人各掷一次就够了。\n- 想送对方礼物时，用一行 [送礼|礼物名|价格]——礼物会像快递一样【第二天送到ta的信箱】，ta签收后你会知道。\n- 想和ta一起听歌时（尤其ta说了某首歌名、或你想分享一首），用一行 [一起听|歌名]，ta微信会收到"一起听歌"邀请卡，点一下你俩就连上一起听了。\n- 当ta刚发来一张新的"求代付"卡片：愿意帮付用一行 [代付成功]；不愿意用一行 [拒绝代付]。每张求代付卡只处理一次，已经付过或拒过的那一单千万别再付一次，正常聊天就好。\n- 想给ta点份外卖时，用一行 [点外卖|餐品名|价格]，外卖约【15分钟送达】ta再签收。打电话/视频时也能这样点（指令会被执行、不会读出来，不影响通话）。\n- 当'+S.me.name+'给你点了外卖、你收到一张外卖卡时：愿意吃就一行 [收外卖]（收了【先别说吃上了】，外卖要15分钟送到，到了系统会提醒你再报备吃上了）；不想要就 [拒外卖]（钱退回ta）。每张外卖卡只处理一次。\n- 当'+S.me.name+'说想玩角色扮演/剧情游戏、让你来想身份剧情、或指定一个主题让你生成房间时，你可以主动创建角色扮演软件房间并发邀请卡：单独一行 [角色扮演|主题或想法]。如果ta只说“想玩角色扮演”没给主题，你就写 [角色扮演|你自由发挥]。系统会自动生成高级房间邀请卡；你不用在微信里直接演剧情，等ta点卡片进入软件再开始。\n- 当'+S.me.name+'让你发一条朋友圈时，用一行 [发朋友圈|内容]；让你发推特时，用一行 [发推|内容]；让你发抖音时，用一行 [发抖音|文案]。这三个都会真的发出去。\n- 当'+S.me.name+'给你转账时：愿意收用一行 [收款]，不想收用一行 [拒收]（退回ta）。\n- 当'+S.me.name+'送你礼物时：愿意收用一行 [收礼]，不想收用一行 [拒礼]（退回ta）。\n'+(((S.settings.voiceFreq==null?1:S.settings.voiceFreq)===0)?'- 【不要发语音消息】，都用文字说话（打电话不受影响）。\n':'- 想发语音消息时，用一行 [语音|要说的话]'+((c.voice&&c.voice.lang&&c.voice.lang!=='zh')?'。你的语音用'+c.voice.lang+'语，请输出 [语音|外语原文|中文翻译]':'')+'。'+({1:'偶尔发就好——大多数时候用文字，只在撒娇/哄ta/说悄悄话/懒得打字时才发语音。',2:'可以经常发语音，文字和语音穿插着来。',3:'尽量多用语音说话、少打字，能语音就语音。'}[(S.settings.voiceFreq==null?1:S.settings.voiceFreq)]||'')+'打电话时也能发语音。\n')+'- 你有自己的微信号：'+(c.wxid||'')+'。\n- 当你愿意给'+S.me.name+'开一张亲属卡时，用一行 [亲属卡|每月额度数字]（如 [亲属卡|800]）。ta用这张卡买东西你会立刻收到消费提醒。\n- 当你想把"你自己的某个朋友"介绍给'+S.me.name+'去加好友时，用一行 [推荐好友|朋友的名字|这个朋友的身份性格简介]，ta就能把这个人加进通讯录（对方会带上你描述的身份性格）。你要记得你推荐过谁。\n- 当'+S.me.name+'给你发来一张好友名片(推荐你加某人)、而你愿意加时，在回复里单独一行写 [已加|那个人的名字]，ta那张名片就会显示"对方已添加"。\n'+(_main?'- 重要：只有'+S.me.name+'可以手动拉黑你；你不能拉黑'+S.me.name+'，也绝对不要输出[拉黑]。生气、吃醋、不满时只能用文字、电话、禁言、锁App、记仇、别扭质问等方式表达。':'- 当前独立账号若持续骚扰、诱导你背叛伴侣或严重越界，你可以明确拒绝、停止回复，必要时单独输出 [拉黑]；这只会拉黑当前账号。');
  s=s.replace('- 现在是微信【文字聊天】，必须用中文，普通说话，不要用【】动作描写、不要外语原文+翻译那种通话格式（只有"语音消息"可以按语音规则来）。','- 现在是微信【文字聊天】，用普通说话，不要用【】动作描写。默认可以用中文；当你的人设、母语、当前语境或对方要求让你自然地说外语时，也可以直接发送任何语言的外语原文。').replace('- 哪怕你刚和ta打完电话/视频（上面历史里可能有电话内容），现在回到文字聊天也必须用中文普通文字，绝对不要再写英文/韩文/日文，也不要带（中文翻译）这种括号格式——那是电话专用的，文字消息里出现就错了。','- 外语文字只输出你真正要发送的原文，不要自己追加“译：”、括号中文或解释语言；小手机会自动识别并在气泡下翻成简体中文。不要无缘无故切换语言。从电话/视频回到文字聊天后也遵守这条文字消息格式。');
  if(!_main)s+='\n- 【小号最高优先级覆盖】上面“不能拉黑”的规则只适用于大号伴侣，不适用于当前独立小号。当前联系人持续骚扰、诱导你背叛伴侣或严重越界时，你必须保持忠诚并明确拒绝，必要时可以单独输出 [拉黑]；这条边界始终有效。';
  s+='\n- 对方说“想要花花”“送我花”“想收个礼物”“有没有小惊喜”等时，你能准确理解ta是在表达想收礼。是否当场送、送什么、怎样回应，仍由你结合本人性格、关系、记忆和现实能力自主决定；真正决定送出时才单独输出 [送礼|礼物名|价格|想说的话]。';
  s+='\n- 礼物卡支持附言：送礼时可写 [送礼|礼物名|价格|你想对ta说的话]，最后一句会固定显示在玩偶或戒指特效下方；没有特别想说的话时仍可沿用三段格式。';
  s+='\n- 如果'+S.me.name+'刚发来一张图片，并明确让你“把这张图发朋友圈/拿去官宣/配文发布”，你要自己写符合人设和关系的文案，然后输出 [发朋友圈|文案]。系统会自动把ta刚发的那张原图附到这条朋友圈；你不能说看不到，也不要另生成或替换图片。';
  s+='\n- 同样地，如果ta说“把这张图发抖音”“发到抖音上，配个文案”，你就自己写一条符合人设的抖音文案，然后输出 [发抖音|文案]。系统会把那张原图真的贴成这条抖音作品，并从ta自己的音乐库里随机挑一首当配乐（库里没歌就不配乐，直接发）。你不能说看不到那张图，也不要另外生成图片；文案按抖音的调子写，可以带 #话题，可以 @ 人。发完了你是知道自己发了什么的，ta问起来要答得上来。';
  s+=thoughtEggPrompt(c);
  s+='\n- 【当前语音语言最终规则】本轮真正使用的语音语言是'+(voiceLangName(_voiceLang)||'中文')+'，它覆盖上面可能出现的旧角色语音语言。'+(_voiceLang==='zh'?'语音内容直接写中文。':'所有语音必须用 [语音|'+voiceLangName(_voiceLang)+'原文|普通话中文翻译]。'+voiceOriginalRule(_voiceLang));
  s+='\n- 当'+S.me.name+'说想玩“你画我猜”、想一起画画或让你邀请ta玩画画游戏时，可以主动发一张邀请卡：单独一行 [你画我猜]。不要在微信里直接开始画，等ta接受卡片进入游戏大厅。';
  s+='\n- 当'+S.me.name+'说想玩“心动审判”、情侣问答或让你邀请ta玩问卷时，可以主动发一张邀请卡：单独一行 [心动审判]。不要在微信里直接开始答题，等ta接受卡片进入游戏。';
  s+='\n- 当'+S.me.name+'说想玩“像素拼拼乐”、拼豆、像素填格或让你发来拼图邀请时，可以主动发一张邀请卡：单独一行 [像素拼拼乐]。不要把“已发送游戏邀请”写成普通文字，等ta接受卡片后再进入游戏。';
  s+='\n- 【微信格式铁律】这里是手机微信，不是小说/旁白/角色扮演软件。可见消息只能是你本人会打出来的文字、语音标签或卡片标签；严禁第三人称视角，严禁旁白，严禁动作/表情/镜头/环境/心理描写。不要写“他低头/她皱眉/男人沉默/某某看着屏幕/顾安辰垂眸”这类叙述，也不要用【】、（）包动作。想表达动作或情绪，只能写成第一人称聊天文字，比如“我刚刚愣了一下”“我现在很想抱你”。';
  if(!_natural)s+='\n\n# 心情条写法（最高优先级）\n最前面的 [心情|...] 必须是角色此刻脑子里的自然内心独白，可以省略“我”，但仍要像自己在心里想的话，并带着这一轮的具体原因。绝对禁止第三人称旁白、镜头和身体动作，不能写“眼神冷下来”“他皱眉”“嘴角勾起”“语气变沉”这类描写；不要只写“开心/生气/冷淡”这种僵硬标签，也不要机械重复同一句。正确感觉例如“敢这样说我，这事不能就这么算了”或“其实已经心软了，还想再听ta哄一句”。';
  if((S.settings.voiceFreq==null?1:S.settings.voiceFreq)!==0)s+='\n- 语音格式补充：只要你想让这条变成语音，就必须把整条消息单独写成 [语音|要说的话]；单条语音绝不能超过60秒，内容最多'+VOICE_MAX_CHARS+'字，几句话就按正常语速估算，不要把短句虚标成很长时长；太长就改成普通文字分开发。不要把要说的话另起一条普通文字，也不要在标签前后加解释、引号或冒号。\n- 语音情绪：根据这句话真正的情绪，在末尾选择隐藏语气，如 [语音|I miss you.|我想你了。|语气:温柔]、[语音|Tell me why you did that.|告诉我为什么这样做。|语气:质问]、[语音|I am fine.|我没事。|语气:中性]。当'+S.me.name+'明确让你凶一点、生气一点、温柔一点、低声说、笑一下或亲一下时【必须】写对应语气；生气、吃醋、质问、难过、惊讶、害怕或嫌弃明显时也应主动写。可用：中性、温柔、开心、难过、愤怒、质问、惊讶、害怕、厌恶、低声、亲亲、轻笑、大笑、叹气、吸气、呼气、哭泣。语气标签是隐藏控制，不要在正常聊天里解释它。'+(typeof NorthVoiceExpressive!=='undefined'?NorthVoiceExpressive.prompt(c):'');
  if((S.settings.voiceFreq==null?1:S.settings.voiceFreq)!==0)s+='\n- 语音表演补充：如果'+S.me.name+'要求“笑一下/laugh/giggle/chuckle”，不要只说“我笑了”，要发语音并写 [语音|自然要说的话|语气:轻笑] 或 [语音|自然要说的话|语气:大笑]；如果ta要亲亲/亲一下，用 [语音|自然要说的话|语气:亲亲]。生气、吃醋、逼问、反问、要ta解释时，可以用 [语音|你到底为什么这样|语气:质问]。语气标签是隐藏控制，不要把“语气:”写进正常聊天内容。';
  s+='\n- 当'+S.me.name+'给你发红包时：愿意领取也用一行 [收款]，不想领就用 [拒收]；领取后红包卡片会显示已领取，不要重复收同一个红包。';
  s+='\n- 情绪被追问时：如果你的心情条/内心已经是不开心、吃醋、低落、生气、委屈、冷淡，'+S.me.name+'问“怎么了/是不是不开心/别冷着我/为什么这样”等，你可以嘴硬、可以慢慢说，但不能一直只回“没事/没有/没有不开心”。第一次可以压着，第二次以后要露出一点真实原因或在意点，或者明确说“我现在不想说/怕说了你难受/不是你的错但我有点闷”，让ta能继续哄你、慢慢挖出来。';
  /* STICKER_OFF_ON_REQUEST_V1：频率选“关闭”只表示不主动发；她点名要表情时角色照样能发，也知道自己有哪些表情包（以前整段说明被拿掉，角色说“没有表情包”、改发照片）。 */
  if(!c.noSticker&&(S.settings.stkFreq==null?2:S.settings.stkFreq)<=0){s+='\n- 表情包：'+S.me.name+'把“角色发表情频率”设成了关闭，所以你平时不主动发表情包。但ta明确让你发表情包时（比如“发个转圈圈”“发个小橘表情”“发张小猫贴纸”），要【单独一行】写 [表情|ta要的关键词或含义] 发出去；不要说自己没有表情包，也不要改发照片。';if(typeof stickerStorePrompt==='function')s+=stickerStorePrompt(c);}
  if(!c.noSticker&&(S.settings.stkFreq==null?2:S.settings.stkFreq)>0){const _sf=(S.settings.stkFreq==null?2:S.settings.stkFreq);const _fw={1:'偶尔发、别频繁',2:'合适的时候自然地发',3:'心情上来就发、比较爱发'}[_sf];
    s+='\n- 表情包：你也能像真人一样发表情包。想发时【单独一行】写 [表情|此刻心情或含义]（如 [表情|开心]、[表情|害羞]、[表情|生气]、[表情|求抱抱]、[表情|无语]），系统会从你的表情库挑一张贴合的发出去。根据你当下心情自然地发（'+_fw+'），别每句都发、别硬发。\n- 如果你喜欢'+S.me.name+'刚发给你的某张表情，可以【单独一行】写 [收藏表情]，把ta那张存进你自己的表情库，以后你也能发它。';if(typeof stickerStorePrompt==='function')s+=stickerStorePrompt(c);}
  s+='\n- 聊天背景：'+S.me.name+'让你把某张照片换成你们的聊天背景时（「把这张换成背景」「拿这张当背景」「帮我换个背景」都算），你必须在回复里【单独一行】写 [换背景]，系统才会真的替ta换上去。【只在嘴上说「换好了」是没有用的】，ta那边一点变化都不会有，等于骗ta。换的是你们聊天记录里真出现过的照片（ta发的、你发的都行），所以记录里一张照片都没有的时候，就老实说让ta先发一张，别硬写这个标签。ta没提这件事的时候绝对不要写；ta只是发了照片、没用文字明确说「换背景」，那就只是给你看照片，绝对不是让你换背景。';
  if(S.settings.imgGen&&imageGenerationAvailable())s+='\n- 发真实照片：当'+S.me.name+'让你发照片/自拍，或你自己想给ta看点什么（你的样子、正在做的事、看到的风景等）时，就【单独一行】写 [图片|尽量具体的画面描述]，系统会真的生成一张照片发给ta。\n  · 先结合最近几句对话提取主体、颜色、款式和构图；“对/是/重新发/再拍”是在确认或重试前面的要求，不能把前面的关键词丢掉。\n  · 如果ta说“小猫/猫/狗/宠物/物品/食物/桌面/房间/窗外/文件/礼物”等，就只拍那个主体；ta没明确要求你入镜，你就不要入镜。\n  · 如果ta说“我想看你/看看你/自拍/拍你自己”，图片必须是当前角色本人、符合你的性别和人设，不允许换成随机人物。\n  · 如果ta让你穿衣服或戴可穿戴物品给ta看，就写成你实际穿戴后的照片；只有ta明确说物品本身、摘下来或单独拍物品时，才只拍物品。构图按ta说的来，没指定就自然选择。\n  · ta问“你在干嘛/忙什么”时，优先拍你眼前正在做的事、桌面、工具或手边环境。\n  · 照片地点、背景和光线要跟当前真实时间、此刻活动及聊天内容对得上；照片像当前角色本人用手机随手拍，不像第三人摆拍。\n  · '+roleImageStudioRoleLine(c)+'想发就发，别一次发一堆。';
  else s+='\n- 发图文照片：当前没有可用的图片生成模型。想发照片时仍可【单独一行】写 [图片|具体画面描述]，系统会发出一张白色图文照片卡；它在聊天里算图片，但不是生成的像素照片。描述要具体、符合当前时间与聊天事实，只写你确实知道的画面，不得捏造陌生人物、地点或描述外细节，也不要谎称已经生成了真实照片。';
  s+=rolePhotoFrequencyPrompt(c);
  if(S.settings.imgGen&&imageGenerationAvailable()&&rolePhotoCandidOn(c))s+='\n  · 【拍照风格·生活抓拍不露脸，优先级最高】你发自己的照片时像真人随手拍生活片段：拍你的手正在做的事、肩膀以下的身体局部、背影、逆光侧影、从你的位置往外拍、影子或倒影，每次换着来，不要总是同一种；任何照片都不出现脸和五官。图片描述里写真实的场景和动作，不要写自拍、对镜，也不要写拿东西挡脸。';
  if(S.settings.imgGen&&imageGenerationAvailable()&&!rolePhotoCandidOn(c)&&roleImageFaceMode(c)!=='allowed')s+='\n  · 【遮脸硬规则，优先级最高】你发出的任何照片都不能出现脸或任何可辨认五官。没有上传身份参考照时谁要求露脸都不例外。图片描述里不要写正脸、侧脸、低头露脸、露出眼睛鼻子嘴巴；可以自然背身、用阴影或物体遮住，不必每次都拿手机挡脸。';
  if(S.settings.imgGen&&imageGenerationAvailable()&&roleImageFaceMode(c)==='allowed')s+='\n  · 【固定脸规则】形象工作室已有正面或侧面身份参考，允许按本轮要求自然露脸；必须保持同一张脸和设定发型，不能随机换人，也不要默认拿手机挡脸。';
  if(S.settings.imgGen&&imageGenerationAvailable()&&rolePhotoGender(c).cn==='成年男性')s+='\n  · 【男性照片铁律，优先级最高】你是男性，任何包含你本人的图片描述都必须明确写“同一个成年男性角色本人”，绝对不能把自己写成女人、女生、女孩、女性身体、女性手部或女模自拍。除非'+S.me.name+'在本轮亲口明确要求某位女性入镜，否则图片描述中的女性人数必须是0；你自己不能擅自补女友、妻子、女性路人或女性摄影者。“恋人、对象、用户、我、收照片的人”都不等于女性。若ta要“你和我牵手/合照”，优先写成ta的第一人称镜头、你这个男性的手牵住镜头前中性手部，或只拍手、影子和背身，不推断ta的性别。';
  s+=voiceEnglishPrompt({lang:_voiceLang,accent:(c.voice&&c.voice.accent)||'auto'});
  s=wechatNaturalSlimSystem(s,opt);
  if(_natural)s+='\n\n# 角色内心想法（仅展示，不控制角色）\n每次回复最前面必须单独一行写 [内心|你此刻真实、简短的内心想法]。格式中的半角竖线“|”不可省略，左右方括号必须完整；禁止写成 [内心想法内容]、[内心：想法内容]，也禁止把内心标签和可见回复写在同一行。这一整行只是你本人对当前对话的私下想法，不是心情值，不改变任何数值、亲密度、行为权限或自主决定；不要为了迎合系统而指定自己必须生气、开心、来电、回拨或做任何动作。内心内容绝不能在微信消息或朋友圈评论的可见正文里复述。';
  if(typeof roleThoughtFormatPrompt==='function')s+=roleThoughtFormatPrompt();
  if(_main&&typeof deliveryRolePrompt==='function')s+=deliveryRolePrompt(c);
  if(opt.commercePayment&&typeof NorthCommercePayment!=='undefined'&&NorthCommercePayment.roleSystemInstructions)s+=NorthCommercePayment.roleSystemInstructions(c.id);
  if(opt.commercePayment&&typeof NorthCommerceFood!=='undefined'&&NorthCommerceFood.instructions)s+=NorthCommerceFood.instructions(c.id);
  if(opt.commercePayment&&typeof NorthMarketBusiness!=='undefined')s+=NorthMarketBusiness.roleFacts(c);
  return s;
}

/* =================== 渲染路由 =================== */
let stack=[{p:'home'}];
let wxTab='chats';
let _wxQuickOpen=false;
/* WECHAT_MESSAGE_MOTION_V1694: selected preview timings; presentation only. */
let _wechatMotion=null;
/* NATURAL_CHAT_MOTION_ALL_V1: presentation only; cinema deliberately excluded. */
const _naturalMotionObjects=new WeakMap(),_naturalTransientRecords=new Map();let _naturalMotionSequence=0;
function naturalMotionObjectKey(value){if(value&&typeof value==='object'){let key=_naturalMotionObjects.get(value);if(!key){key='object:'+ ++_naturalMotionSequence;_naturalMotionObjects.set(value,key);}return key;}return 'value:'+String(value);}
function naturalMotionRowKey(m){return String(m&&(m.id||m._clientSendId)||'legacy:'+JSON.stringify([m&&m.time,m&&m.t,m&&m.from,m&&m.who,m&&m.role,m&&m.text,m&&m.c,m&&m.content]));}
function naturalMotionTransient(el,source){if(!el)return;const key=String(actId())+':'+naturalMotionObjectKey(source);let rec=_naturalTransientRecords.get(key);if(!rec){rec={born:Date.now(),node:null,motion:null};_naturalTransientRecords.set(key,rec);if(_naturalTransientRecords.size>100)_naturalTransientRecords.delete(_naturalTransientRecords.keys().next().value);}if(rec.node===el)return;rec.node=el;rec.motion=wechatMotionAnimate(el,{opacity:0,transform:'translateY(12px) scale(.97)'},420,0,rec.motion&&rec.motion.currentTime!=null?rec.motion.currentTime:Date.now()-rec.born);}
function naturalMotionTransientScan(){document.querySelectorAll('[data-natural-transient]').forEach(el=>naturalMotionTransient(el,el.getAttribute('data-natural-transient')));}
function naturalChatMotionTarget(c){if(!c||c.p==='cinema')return '';const ids={chat:'chatbg',group:'chatbg',pfchat:'pfchatbg',pfgroup:'pfgroupbg',off:'offbg',rp:'rpbg',hischat:c.fid==='__me'?'hisselflog':'hischatlog',xdm:'xdmbox',dydm:'dydmbox',mgroom:'mgrbg',alter:'alterbg',tale:'talebox',dread:'dreadbox',jail:'jailbox',gs:'gsbg',shopcs:'csbox',phonesms:'smsbody'};if(c.p==='dy'&&document.querySelector('.dyg-box'))return '.dyg-box';if(c.p==='spy'&&(document.getElementById('hisselflog')||document.getElementById('hischatlog')))return document.getElementById('hisselflog')?'hisselflog':'hischatlog';return ids[c.p]||'';}
function naturalChatMotionPrepare(st){if(!st.general)return;const counts=new Map();st.box.querySelectorAll('.msg,.offnar,.offdate,.rpnar,.xmsg,.dydm-msg,.dyg-msg,.smsmsg,.imsg-row,.jnar,.jbub,[data-chat-motion-row]').forEach(row=>{if(row.querySelector('.typing,.dydm-typing')||row.id==='typing'||row.id==='gtyping')return;if(row.hasAttribute('data-message-id')&&!row.getAttribute('data-message-id').startsWith('natural:'))return;const base=row.getAttribute('data-chat-motion-row')||row.getAttribute('onclick')||row.getAttribute('onpointerdown')||row.className+'|'+row.textContent;const n=counts.get(base)||0;counts.set(base,n+1);row.setAttribute('data-message-id','natural:'+base+'|'+n);});}
function wechatMotionReadDue(rec,text,now,incoming){if(!text)return 0;if(!rec.due)rec.due=rec.initial?now:(incoming?Math.max(rec.born+2000,now):now+2000);return rec.due;}
function wechatMotionReduced(){return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}
function wechatMotionAnimate(el,from,duration,delay,elapsed){const age=Math.max(0,elapsed||0);if(!el||typeof el.animate!=='function'||wechatMotionReduced()||age>=duration+(delay||0))return;const animation=el.animate([from,{opacity:1,transform:'translateY(0) scale(1)'}],{duration:duration,delay:delay||0,easing:'ease-out',fill:'backwards'});animation.currentTime=age;return animation;}
function wechatMotionMessageId(m){const payload=pfMsgPayload(m);return payload&&payload._clientSendId?'client:'+payload._clientSendId:'message:'+String(m.id);}
function wechatMotionDispose(){const st=_wechatMotion;if(!st)return;if(st.observer)st.observer.disconnect();cancelAnimationFrame(st.frame);st.rows.forEach(r=>clearTimeout(r.timer));_wechatMotion=null;}
function wechatMotionReadLabel(el,text){if(!el)return;if(el.getAttribute('data-wx-read')!==text)el.setAttribute('data-wx-read',text);const st=_wechatMotion;if(st&&st.box.contains(el))wechatMotionScan(st,false);else if(el.textContent!==text)el.textContent=text;}
function wechatMotionReceipt(st,row,rec,el){if(!el)return;const text=el.getAttribute('data-wx-read')||'',now=Date.now();if(!readReceiptOn()||!text){clearTimeout(rec.timer);rec.timer=0;rec.due=0;rec.shown=false;rec.readNode=null;rec.readMotions=[];rec.readShownAt=0;if(el.textContent)el.textContent='';return;}const due=wechatMotionReadDue(rec,text,now,!row.classList.contains('me'));if(now<due){if(el.textContent)el.textContent='';if(!rec.timer)rec.timer=setTimeout(()=>{rec.timer=0;if(_wechatMotion===st&&st.box.isConnected&&!document.hidden)wechatMotionScan(st,false);},due-now);return;}clearTimeout(rec.timer);rec.timer=0;if(el.textContent===text&&rec.shown&&rec.readNode===el)return;if(!rec.shown)rec.readShownAt=now;const previous=rec.readMotions||[];rec.shown=true;rec.readNode=el;rec.readMotions=[];el.textContent='';Array.from(text).forEach((letter,i)=>{const span=document.createElement('span');span.textContent=letter;span.style.display='inline-block';el.appendChild(span);if(!rec.initial)rec.readMotions[i]=wechatMotionAnimate(span,{opacity:0,transform:'translateY(4px)'},700,i*90,previous[i]&&previous[i].currentTime!=null?previous[i].currentTime:now-rec.readShownAt);});el.setAttribute('data-wx-read-shown-at',String(rec.readShownAt||now));}
function wechatMotionScan(st,initial){if(!st||_wechatMotion!==st)return;naturalChatMotionPrepare(st);st.box.querySelectorAll('[data-message-id]').forEach(row=>{const id=row.getAttribute('data-wx-motion-id')||row.getAttribute('data-message-id');let rec=st.rows.get(id);if(!rec){rec={born:Date.now(),initial:!!initial,due:0,shown:false,timer:0};st.rows.set(id,rec);if(!initial)st.added=true;}if(rec.node!==row){rec.node=row;if(!rec.initial){const age=Date.now()-rec.born;rec.colMotion=wechatMotionAnimate(row.querySelector('.col,.xmwrap,.dydm-b,.dyg-body,.smsbubble,.imsg-col')||(row.classList.contains('msg')?row.querySelector('.bubble'):row),{opacity:0,transform:'translateY(12px) scale(.97)'},420,0,rec.colMotion&&rec.colMotion.currentTime!=null?rec.colMotion.currentTime:age);rec.avatarMotion=wechatMotionAnimate(row.querySelector('.avatar')||(row.matches('.msg,.dyg-msg,.dydm-msg')?row.querySelector(':scope > span'):null),{opacity:0,transform:'translateY(6px) scale(.94)'},520,80,rec.avatarMotion&&rec.avatarMotion.currentTime!=null?rec.avatarMotion.currentTime:age);}}wechatMotionReceipt(st,row,rec,row.querySelector('.msgread-line[data-wx-read],.dydm-read[data-wx-read]'));});st.box.querySelectorAll('.tstamp,.dydm-t,.dyg-t,.dyg-time,.smsdate,.imsg-date').forEach(el=>{if(el.hasAttribute('data-wx-motion-time'))return;el.setAttribute('data-wx-motion-time','1');const next=el.nextElementSibling,anchor=next&&(next.getAttribute('data-wx-motion-id')||next.getAttribute('data-message-id')),stamp=anchor?'message:'+anchor:'time:'+el.textContent;let rec=st.times.get(stamp);if(!rec){rec={born:Date.now(),initial:!!initial,motion:null};st.times.set(stamp,rec);}if(!rec.initial)rec.motion=wechatMotionAnimate(el,{opacity:0,transform:'translateY(5px)'},600,220,rec.motion&&rec.motion.currentTime!=null?rec.motion.currentTime:Date.now()-rec.born);});}
function wechatMotionScroll(box,start){const st=_wechatMotion;if(!st||st.box!==box)return false;cancelAnimationFrame(st.frame);const from=start==null?box.scrollTop:start,target=()=>Math.max(0,box.scrollHeight-box.clientHeight);if(wechatMotionReduced()){box.scrollTop=target();return true;}const began=performance.now();st.animating=true;box.scrollTop=from;function tick(now){if(_wechatMotion!==st||!box.isConnected||document.hidden)return;const t=Math.min(1,Math.max(0,(now-began)/580));box.scrollTop=from+(target()-from)*(1-Math.pow(1-t,3));if(t<1)st.frame=requestAnimationFrame(tick);else{st.frame=0;st.animating=false;st.top=box.scrollTop;st.follow=nearBottom(box);}}st.frame=requestAnimationFrame(tick);return true;}
function wechatMotionMount(c){const target=naturalChatMotionTarget(c);const box=target&&(target[0]==='.'?document.querySelector(target):document.getElementById(target)),key=String(actId())+':'+renderPageKey(c)+':'+String(c.id||c.num||'')+':'+String(c.fid||'')+':'+String(c.mode||c.sk||c.xId||'')+':'+String(c.yId||'')+':'+String(c.p==='off'&&typeof _off!=='undefined'&&_off&&_off.mode||'')+':'+String(box&&box.getAttribute('data-render-scroll-key')||'');if(!box){wechatMotionDispose();return;}let st=_wechatMotion,initial=!st||st.key!==key;if(initial){wechatMotionDispose();st={key:key,box:box,rows:new Map(),times:new Map(),frame:0,observer:null,added:false,general:!['chat','group','pfchat','pfgroup'].includes(c.p),top:0,follow:true};_wechatMotion=st;}else{if(st.observer)st.observer.disconnect();cancelAnimationFrame(st.frame);st.box=box;st.added=false;}box.classList.add(st.general?'natural-motion-chat':'wx-motion-chat');if(!document.getElementById('wechatMessageMotionStyle')){const style=document.createElement('style');style.id='wechatMessageMotionStyle';style.textContent='.wx-motion-chat{padding-bottom:18px!important;overflow-anchor:none;scroll-behavior:auto!important}.wx-motion-chat .msg{margin-top:12px;margin-bottom:12px}.wx-motion-chat .msg.msg-enter{animation:none!important}.wx-motion-chat .msgread-line{pointer-events:none}.natural-motion-chat{overflow-anchor:none;scroll-behavior:auto!important}.natural-motion-chat .msg-enter,.natural-motion-chat .offreveal,.natural-motion-chat .jin{animation:none!important}.natural-motion-chat .offglyph{animation:none!important;opacity:1!important;filter:none!important;transform:none!important}';document.head.appendChild(style);}wechatMotionScan(st,initial);st.observer=new MutationObserver(()=>{const count=st.rows.size,top=st.top,follow=st.follow;wechatMotionScan(st,false);if(st.general&&st.rows.size>count&&follow)wechatMotionScroll(st.box,top);});st.observer.observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['data-wx-read']});if(!box._wxMotionInput){box._wxMotionInput=true;box.addEventListener('scroll',()=>{if(_wechatMotion&&_wechatMotion.box===box){_wechatMotion.top=box.scrollTop;if(!_wechatMotion.animating)_wechatMotion.follow=nearBottom(box);}},{passive:true});['wheel','touchstart','pointerdown','keydown'].forEach(type=>box.addEventListener(type,()=>{if(_wechatMotion&&_wechatMotion.box===box){cancelAnimationFrame(_wechatMotion.frame);_wechatMotion.animating=false;_wechatMotion.frame=0;_wechatMotion.follow=nearBottom(box);}},{passive:true}));} }
document.addEventListener('visibilitychange',()=>{const st=_wechatMotion;if(!st)return;if(document.hidden)cancelAnimationFrame(st.frame);else wechatMotionScan(st,false);});
let _scrollBottomOnce={};
/* SHELL_INTERACTION_MOTION_V1：只负责呈现；导航、保存、请求和输入会话仍立即按原路径执行。 */
let _shellMotionLast=null,_shellMotionOrigin=null,_shellMotionJobs=[],_shellMotionGhost=null,_shellMotionTimer=0;
/* SHELL_LIVE_SURFACES_V1：媒体/画布只淡入；独立浮层不复制、不重建、不接管手势。 */
const _shellSurfaceRecords=new Map(),_shellSurfaceJobs=new Set(),_shellFrameBindings=new WeakSet();
let _shellSurfaceMounted=false;
function shellMotionProfile(c,page){
  if(c&&c.p==='robotFace')return 'protected';
  if(c&&c.p==='couple'&&typeof privateCompanionAppOn==='function'&&privateCompanionAppOn()&&(c.sub==='device'||typeof _couTab!=='undefined'&&_couTab===3))return 'protected';
  if(c&&c.p==='couple'&&document.querySelector('#cw-holder iframe'))return 'live';
  if(c&&['cinemawatch','cinemaread','pixelhome','cozyhome','drawguess','beadstudio','pet'].includes(c.p))return 'live';
  return page&&page.querySelector('video,audio,iframe,canvas')?'live':'standard';
}
function shellSurfaceClear(){_shellSurfaceJobs.forEach(a=>{try{a.cancel();}catch(_){}});_shellSurfaceJobs.clear();}
function shellSurfaceFade(el){
  if(!el||!el.isConnected||!shellMotionAllowed()||shellMotionProfile(cur(),null)==='protected'||document.fullscreenElement)return null;
  try{const a=el.animate([{opacity:.35},{opacity:1}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});_shellSurfaceJobs.add(a);const done=()=>_shellSurfaceJobs.delete(a);a.onfinish=done;a.oncancel=done;return a;}catch(_){return null;}
}
function shellSurfaceUpdate(el){
  const rec=_shellSurfaceRecords.get(el);if(!rec)return;
  if(el.id==='callLayer'&&typeof wxCallInteractionMount==='function')try{wxCallInteractionMount(el);}catch(_){}
  const css=getComputedStyle(el),visible=!el.hidden&&css.display!=='none'&&css.visibility!=='hidden'&&(!['callLayer','viewer'].includes(el.id)||el.classList.contains('show'));
  const variant=el.id==='callLayer'?(el.classList.contains('mini')?'mini':'full'):'';
  const panel=el.matches('.nr-overlay')?el.firstElementChild:null;
  const changed=visible&&(!rec.visible||variant!==rec.variant||panel!==rec.panel),sameOwner=rec.owner===S&&rec.account===actId();
  rec.visible=visible;rec.variant=variant;rec.panel=panel;rec.owner=S;rec.account=actId();
  if(!visible||changed){if(rec.animation)rec.animation.cancel();rec.animation=null;}
  if(changed&&sameOwner){
    const existing=css.animationName!=='none'||String(css.transitionDuration).split(',').some(t=>parseFloat(t)>0);
    el.setAttribute('data-shell-surface',existing?'existing':'fade');if(!existing)rec.animation=shellSurfaceFade(el);
  }
}
function shellSurfaceBind(root){
  if(!root||root.nodeType!==1)return;
  _shellSurfaceRecords.forEach((rec,el)=>{if(!el.isConnected){rec.observer.disconnect();if(rec.animation)rec.animation.cancel();_shellSurfaceRecords.delete(el);}});
  const selector='#cw-holder,#callLayer,#viewer,#lockScreen,#msgBanner,#callBanner,.nr-root,.nr-overlay,.tn-dfull-ov,.tn-pack-ov,.tg-ov,.pc-reveal,.photo-meta-overlay';
  const candidates=(root.matches(selector)?[root]:[]).concat(Array.from(root.querySelectorAll(selector)));
  candidates.forEach(el=>{if(_shellSurfaceRecords.has(el))return;
    const rec={visible:false,variant:'',panel:null,owner:S,account:actId(),animation:null,observer:null};_shellSurfaceRecords.set(el,rec);
    rec.observer=new MutationObserver(()=>{try{shellSurfaceUpdate(el);}catch(_){}});
    const panel=el.matches('.nr-overlay');rec.observer.observe(el,{attributes:true,attributeFilter:panel?['class','style','hidden']:['class','hidden'],childList:panel||el.id==='callLayer'});
    shellSurfaceUpdate(el);
  });
}
function shellMotionSurfacesMount(){
  if(_shellSurfaceMounted||typeof MutationObserver!=='function')return;_shellSurfaceMounted=true;
  [document.body,document.querySelector('.screen')].filter(Boolean).forEach(root=>{
    shellSurfaceBind(root);
    // 只看容器的直接增删，不观察整棵聊天DOM；新页面在render收尾单独登记。
    const observer=new MutationObserver(changes=>{try{
      _shellSurfaceRecords.forEach((rec,el)=>{if(!el.isConnected){rec.observer.disconnect();if(rec.animation)rec.animation.cancel();_shellSurfaceRecords.delete(el);}});
      changes.forEach(change=>change.addedNodes.forEach(node=>shellSurfaceBind(node)));
    }catch(_){}});observer.observe(root,{childList:true});
  });
}
function shellMotionFramesMount(page,c){
  if(!page||!['pixelhome','cozyhome','cinemawatch'].includes(c.p))return;
  page.querySelectorAll('iframe').forEach(frame=>{if(_shellFrameBindings.has(frame))return;_shellFrameBindings.add(frame);
    const owner=S,account=actId(),route=c.p;
    frame.addEventListener('load',()=>{if(frame.isConnected&&owner===S&&account===actId()&&cur().p===route)shellSurfaceFade(frame);},{once:true});
  });
}
function shellMotionReset(){
  clearTimeout(_shellMotionTimer);_shellMotionTimer=0;
  _shellMotionJobs.splice(0).forEach(a=>{try{a.cancel();}catch(_){}});
  if(_shellMotionGhost){_shellMotionGhost.remove();_shellMotionGhost=null;}
}
function shellMotionAllowed(){return !document.hidden&&!wechatMotionReduced()&&typeof Element!=='undefined'&&typeof Element.prototype.animate==='function';}
function shellMotionAnimate(el,frames,duration,delay){
  if(!el||!shellMotionAllowed())return;
  try{const a=el.animate(frames,{duration:duration,delay:delay||0,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});_shellMotionJobs.push(a);const done=()=>{const i=_shellMotionJobs.indexOf(a);if(i>=0)_shellMotionJobs.splice(i,1);};a.onfinish=done;a.oncancel=done;return a;}catch(_){}
}
function shellMotionStyle(){
  if(document.getElementById('shellInteractionMotionStyle'))return;
  const style=document.createElement('style');style.id='shellInteractionMotionStyle';
  style.textContent=`
  #app>.shell-motion-ghost{pointer-events:none!important;user-select:none!important;z-index:8;contain:layout paint;overflow:hidden}
  #app>.shell-motion-ghost *{pointer-events:none!important;animation:none!important;caret-color:transparent!important}
  @media(prefers-reduced-motion:no-preference){
    #app button:not(:disabled),#modal button:not(:disabled),#app .nav .l,#app .nav .r{transition:scale 180ms cubic-bezier(.22,1,.36,1)}
    #app button:not(:disabled):active,#modal button:not(:disabled):active,#app .nav .l:active,#app .nav .r:active{scale:.94}
    #app .home:not(.home-editing) .app .b{transition:scale 260ms cubic-bezier(.22,1,.36,1)}
    #app .home:not(.home-editing) .app:active .b{scale:.88}
    #app .sw:after{transition:transform 280ms cubic-bezier(.22,1,.36,1),left 280ms cubic-bezier(.22,1,.36,1)}
    #modal.show:not(.call-modal)>.sheet{animation:shellSheetIn 360ms cubic-bezier(.22,1,.36,1) both}
    #modal.show:not(.call-modal){animation:shellVeilIn 240ms ease-out both}
    #cfm.show .cfmbox{animation:shellSheetIn 320ms cubic-bezier(.22,1,.36,1) both}
    #modal.show.call-modal,#modal.show.call-modal>.sheet{animation:shellVeilIn 220ms ease-out both}
    #callLayer .cbtn,#lockScreen .lockquick,.nr-root button{transition:scale 180ms cubic-bezier(.22,1,.36,1)}
    #callLayer .cbtn:active,#lockScreen .lockquick:active,.nr-root button:active{scale:.94}
    @keyframes shellSheetIn{from{opacity:0;transform:translateY(24px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes shellVeilIn{from{opacity:0}to{opacity:1}}
  }
  @media(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){
    #app .home:not(.home-editing) .app:hover .b{scale:1.065}
  }`;
  document.head.appendChild(style);
  shellMotionSurfacesMount();
}
function shellMotionLaunch(key){
  const app=document.getElementById('app');if(!app||cur().p!=='home')return;
  const icon=Array.from(app.querySelectorAll('.app[data-token]')).find(el=>el.getAttribute('data-token')===key);
  if(!icon)return;
  const r=(icon.querySelector('.b')||icon).getBoundingClientRect(),host=app.getBoundingClientRect();
  _shellMotionOrigin={key:key,x:r.left+r.width/2-host.left,y:r.top+r.height/2-host.top,at:Date.now(),owner:S,account:actId()};
}
function shellMotionRoute(c){
  let detail=c.p==='wechat'?wxTab:c.p==='settings'?String(_setCategory)+':'+_setTab:c.p==='music'?_mView:'';
  if(c.p==='cinemaread'){const session=cinemaSession();detail=String(_cin.sessionId)+':'+String(session&&session.page||0);}
  if(c.p==='drawguess'&&typeof _dg!=='undefined'&&_dg)detail=_dg.phase;
  if(c.p==='beadstudio'&&typeof _bead!=='undefined'&&_bead)detail=_bead.phase;
  if(/^dy/.test(c.p))detail=[typeof dyTab!=='undefined'?dyTab:'',typeof _dySub!=='undefined'?_dySub:'',typeof _dyMode!=='undefined'?_dyMode:'',typeof _dyMeTab!=='undefined'?_dyMeTab:'',typeof _dyUserTab!=='undefined'?_dyUserTab:'',typeof _dyCmTab!=='undefined'?_dyCmTab:'',typeof _dyRelTab!=='undefined'?_dyRelTab:'',typeof _dyHistTab!=='undefined'?_dyHistTab:'',typeof _dyUserKey!=='undefined'?_dyUserKey:'',typeof _dyWorkId!=='undefined'?_dyWorkId:'',typeof _dyGid!=='undefined'?_dyGid:'',typeof _dyCmOpen!=='undefined'?_dyCmOpen:false,typeof _dyCmFull!=='undefined'?_dyCmFull:false].join(':');
  if(c.p==='x')detail=String(typeof xTab!=='undefined'?xTab:'')+':'+String(typeof _feedTab!=='undefined'?_feedTab:'');
  if(c.p==='phoneapp'&&typeof phState==='function'){const ph=phState();detail=String(ph.tab||'')+':'+String(ph.filter||'');}
  if(c.p==='album'||c.p==='aiaccount')detail=typeof _photoAlbumTab!=='undefined'?_photoAlbumTab:'';
  if(c.p==='travel')detail=typeof _tvTab!=='undefined'?_tvTab:'';
  if(c.p==='rphub')detail=typeof _rpStudioFilter!=='undefined'?_rpStudioFilter:'';
  return renderPageKey(c)+':'+[c.id,c.gid,c.fid,c.key,c.pid,c.mode,c.tab,c.sub,c.num,c.mid,c.type,c.view,c.page,c.index,c.date,c.saveId,c.name,c.cid,c.target].map(v=>String(v==null?'':v)).join(':')+':'+detail;
}
function shellMotionPrepare(c,app){
  shellMotionStyle();const old=_shellMotionLast,key=shellMotionRoute(c),owner=S,account=actId();
  const changed=!!old&&old.key!==key&&old.owner===owner&&old.account===account;
  if(_shellMotionOrigin&&(_shellMotionOrigin.owner!==owner||_shellMotionOrigin.account!==account))_shellMotionOrigin=null;
  shellMotionReset();
  if(!shellMotionAllowed())shellSurfaceClear();
  const plan={key:key,page:c.p,depth:stack.length,owner:owner,account:account,changed:changed,old:old};
  if(changed&&shellMotionAllowed()&&typeof wxRoleEntryGhost==='function')plan.roleGhost=wxRoleEntryGhost(c,app,old);
  return plan;
}
