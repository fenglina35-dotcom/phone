function clockMinuteDistance(a,b){a=((+a%1440)+1440)%1440;b=((+b%1440)+1440)%1440;const d=Math.abs(a-b);return Math.min(d,1440-d);}
function roleClockClaimDistance(hourToken,minuteToken,qualifier,period,p){const h=clockNumberValue(hourToken);let minute=minuteToken==null||minuteToken===''?0:clockNumberValue(minuteToken);if(qualifier==='半')minute=30;else if(qualifier==='一刻')minute=15;else if(qualifier==='三刻')minute=45;else if(qualifier==='整')minute=0;if(!Number.isFinite(h)||!Number.isFinite(minute)||h<0||h>24||minute<0||minute>59)return NaN;const actual=(+p.hour||0)*60+(+p.minute||0);let hours=[];if(h===24)hours=[0];else if(h>12)hours=[h];else if(h===12)hours=[0,12];else hours=[h,h+12];period=String(period||'');if(/凌晨/.test(period))hours=hours.filter(x=>x<6);else if(/早上|上午/.test(period))hours=hours.filter(x=>x<12);else if(/中午/.test(period))hours=hours.filter(x=>x>=11&&x<=13);else if(/下午|傍晚|晚上|夜里|深夜/.test(period))hours=hours.filter(x=>x>=12);if(!hours.length)return NaN;return Math.min(...hours.map(x=>clockMinuteDistance(x*60+minute,actual)));}
function conversationVisibleRows(c,limit){try{return(msgs(c.id)||[]).filter(m=>m&&m.time&&!m._silent&&!m._call&&m.type!=='sys'&&(m.role==='user'||m.role==='assistant')).slice(-Math.max(2,+limit||40));}catch(_){return[];}}
function conversationGapFact(c){try{const arr=conversationVisibleRows(c,80);let ui=-1;for(let i=arr.length-1;i>=0;i--){if(arr[i].role==='user'){ui=i;break;}}if(ui<=0)return null;const curm=arr[ui];let start=ui;for(let i=ui-1;i>=0;i--){const m=arr[i];if(m.role==='user'&&curm.time-m.time<3*60000){start=i;continue;}break;}const prev=arr[start-1];if(!prev)return null;return{current:curm,previous:prev,gap:Math.max(0,curm.time-prev.time)};}catch(_){return null;}}
function conversationGapQuestion(text){return/(?:隔了|隔多久|隔多长|多久才|多长时间|什么时候.{0,8}(?:回|找)|没回.{0,8}多久|离开.{0,8}多久|时间感|过了多久)/.test(String(text||''));}
function conversationHistoricalGapQuestion(text){return/(?:刚才|刚刚|之前|前面|那次).{0,12}(?:隔|多久|没回|回来)|(?:没回|离开).{0,12}(?:什么时候|多久|回来)|(?:隔了多久|多久才).{0,8}(?:回|回来)/.test(String(text||''));}
function conversationReferencedGapFact(c){try{const rows=conversationVisibleRows(c,40),latest=conversationGapFact(c),question=latest&&msgToText(latest.current);if(!latest||!conversationGapQuestion(question)||!conversationHistoricalGapQuestion(question))return null;let at=-1,fallback=null;for(let i=rows.length-1;i>=0;i--){if(rows[i]===latest.current||rows[i].id&&latest.current.id&&rows[i].id===latest.current.id){at=i;break;}}for(let i=at-1;i>0;i--){const m=rows[i],prev=rows[i-1],gap=m&&prev?m.time-prev.time:0;if(!m||m.role!=='user')continue;const fact={current:m,previous:prev,gap:Math.max(0,gap),referenced:true};if(!fallback)fallback=fact;if(gap>=5*60000)return fact;}return fallback;}catch(_){return null;}}
function conversationClaimGapFact(c){return conversationReferencedGapFact(c)||conversationGapFact(c);}
function conversationComplaintGapFact(c,now){const rows=conversationVisibleRows(c,40),last=rows[rows.length-1],lastUser=[...rows].reverse().find(m=>m.role==='user');if(last&&last.role==='assistant'&&lastUser)return{gap:Math.max(0,(+now||Date.now())-lastUser.time),proactive:true,current:lastUser};return conversationGapFact(c);}
function roleReplyTimelineRows(c,limit){const unified=typeof roleCrossChannelOn==='function'?roleCrossChannelOn(c):typeof offlineWechatLiveOn==='function'&&offlineWechatLiveOn();if(unified&&typeof roleInteractionRows==='function')return roleInteractionRows(c).filter(x=>x&&x.at).slice(-Math.max(2,+limit||40));return conversationVisibleRows(c,limit).map(m=>({at:+m.time||0,channel:m._call?'call':'online',role:m.role==='user'?'user':'assistant',text:String(msgToText(m)||previewOf(m)||'').replace(/\s+/g,' ').trim()}));}
function roleReplyGapFact(c,now){const rows=roleReplyTimelineRows(c,80),last=rows[rows.length-1],lastUser=[...rows].reverse().find(x=>x.role==='user');if(!lastUser)return null;if(last&&last.role==='assistant')return{gap:Math.max(0,(+now||Date.now())-lastUser.at),proactive:true,current:lastUser,unified:lastUser.channel!=='online'||rows.some(x=>x.channel!=='online')};let at=rows.lastIndexOf(lastUser);if(at<=0)return null;let start=at;for(let i=at-1;i>=0;i--){const x=rows[i];if(x.role==='user'&&lastUser.at-x.at<3*60000){start=i;continue;}break;}const previous=rows[start-1];if(!previous)return null;return{gap:Math.max(0,lastUser.at-previous.at),current:lastUser,previous,unified:lastUser.channel!=='online'||previous.channel!=='online'};}
function roleReplyTimelinePin(c){if(!S.settings.timeAware)return'';const rows=roleReplyTimelineRows(c,10);if(!rows.length)return'';const unified=typeof roleCrossChannelOn==='function'?roleCrossChannelOn(c):typeof offlineWechatLiveOn==='function'&&offlineWechatLiveOn(),silence=roleReplyGapFact(c,Date.now()),silenceLine=silence&&silence.proactive?'\n对方距最近一次真实发言已经【'+conversationGapExact(silence.gap)+'】；这是主动联系时判断是否久未回复的唯一时长。':'',crossLine=unified?'\n微信、电话和共同生活已经按真实时间合并。微信气泡之间即使隔了很多小时，只要中间在线下或电话里有互动，就绝不能说对方失联、消失或很久没理你；必须记得并承接最近那个渠道真实发生的内容。':'';return '\n【最近跨渠道真实时间线（只供内部判断，不要逐条复述）】\n'+rows.map((m,i)=>'['+fmtDT(m.at)+']['+(m.channel==='cohab'?'共同生活':m.channel==='call'?'电话':'微信')+']['+(m.role==='user'?S.me.name:(c.remark||c.name||'角色'))+']'+(i?'[距上一条'+conversationGapExact(Math.max(0,m.at-rows[i-1].at))+']':'')+' '+String(m.text||'').slice(0,90)).join('\n')+silenceLine+crossLine+'\n你始终知道这些真实间隔。未满一小时属于正常聊天间隔，不要主动说“怎么这么久没理我”；超过一小时才允许按人设自然在意，但也不要每句报时。对方直接询问时，无论间隔长短都必须按真实时间戳准确回答，误差只允许一两分钟。';}
function roleRecentChannelRounds(rows,channel,roundCount,maxRows){const src=(rows||[]).filter(x=>x&&x.channel===channel),starts=[];if(!src.length)return[];for(let i=0;i<src.length;i++)if(src[i].role==='user'&&(i===0||src[i-1].role!=='user'))starts.push(i);let start=starts.length?starts[Math.max(0,starts.length-Math.max(1,+roundCount||1))]:Math.max(0,src.length-Math.max(1,+maxRows||12)),picked=src.slice(start),cap=Math.max(2,+maxRows||12);if(picked.length<=cap)return picked;const firstUser=picked.find(x=>x.role==='user'),tail=picked.slice(-(cap-(firstUser?1:0)));return firstUser&&!tail.includes(firstUser)?[firstUser,...tail]:picked.slice(-cap);}
function roleReplyContinuityPin(c,now,opt){if(!c)return'';now=+now||Date.now();opt=opt||{};const synced=typeof roleCrossChannelOn==='function'?roleCrossChannelOn(c):typeof offlineWechatLiveOn!=='function'||offlineWechatLiveOn();let all=roleInteractionRows(c).filter(x=>x&&x.at<=now);if(!synced)all=all.filter(x=>opt.channel==='cohab'?x.channel==='cohab':x.channel!=='cohab');let rows=all.slice(-8);if(synced){const anchorChannel=opt.channel==='cohab'?'online':'cohab',anchor=roleRecentChannelRounds(all,anchorChannel,1,14),seen=new Set();rows=[...anchor,...rows].sort((a,b)=>a.at-b.at).filter(x=>{const key=[x.at,x.channel,x.role,x.text].join('|');if(seen.has(key))return false;seen.add(key);return true;});}if(!rows.length)return'';const timeOn=S.settings.timeAware!==false,me=S.me&&S.me.name||'用户',role=c.remark||c.name||'角色';return '\n【本轮发送前连续性核对（只供内部思考，绝不能照抄或汇报）】\n'+rows.map(x=>(timeOn?'['+fmtDT(x.at)+']':'')+'['+(x.channel==='cohab'?'共同生活':x.channel==='call'?'电话':'微信')+']['+(x.role==='user'?me:role)+'] '+x.text.slice(0,180)).join('\n')+'\n回复前只在心里核对：最近明确发生了什么、事情现在处于什么进度、你本人刚答应或说过什么。共同生活的最近完整一轮即使包含很多旁白或气泡，也必须从用户当时最先说/做的内容开始理解，不能只记住末尾几句角色台词。上面是双方原话，不等于每句话都是现实事实；假设、举例、引用、玩笑、询问和尚未实行的计划不能当成已经发生。没有更新的用户说明或真实功能结果时，不得无依据推翻、倒退或改写上一轮状态；确有新进展时可以自然改变，并承接变化。资料不足就自然询问，不能自行补出进展。只输出角色此刻自然会说的话，不要复述核对过程，也不要为了证明记得而机械总结前情。'+(typeof rolePreciseTimePrompt==='function'?rolePreciseTimePrompt(c,now):'');}
//@@ web
function roleTimeClaimIssue(content,c,now){if(!S.settings.timeAware)return'';const t=String(content||''),scheduleIssue=typeof roleScheduleClaimIssue==='function'?roleScheduleClaimIssue(t,c,now):'';if(scheduleIssue)return scheduleIssue;const p=roleTimeParts(now||Date.now()),clauses=t.split(/[。！？!?\n]/);for(const clause of clauses){const cue=/(?:现在|此刻|这会儿|已经|都|才|刚刚|时间不早|该睡|快睡|早点睡)/.test(clause);let m=clause.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里|深夜)?\s*(?:现在|此刻|这会儿|已经|都|才|刚刚)?.{0,8}?([零〇一二三四五六七八九十两\d]{1,3})\s*(?:点|时)(?:\s*([零〇一二三四五六七八九十两\d]{1,3})\s*分?|\s*(半|一刻|三刻|整))?\s*([了多])?(?=\s|[,，。！？!?、；;]|$)/);if(m){const before=clause.slice(0,m.index),after=clause.slice(m.index+m[0].length),scheduled=!m[5]&&(/(?:约好?|定在|安排在|等到?|到了?)\s*$/.test(before+m[0].slice(0,Math.max(0,m[0].lastIndexOf(m[2]))))||/^\s*(?:见|开会|上课|出发|叫|提醒|开始|下班|去)/.test(after))||/(?:等到?|到了?).*(?:点|时)/.test(m[0])&&/^\s*再/.test(after);if((cue||m[5])&&!scheduled){const period=m[1]||((clause.match(/(?:现在|此刻|这会儿).{0,4}?(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里|深夜)/)||[])[1])||'',distance=roleClockClaimDistance(m[2],m[3],m[4],period,p);if(Number.isFinite(distance)&&distance>ROLE_TIME_TOLERANCE_MINUTES)return'当前时间说成了'+period+m[2]+'点'+(m[3]||m[4]||'');}}if(cue){const colon=clause.match(/(?:现在|此刻|这会儿|已经|都|才|刚刚)?.{0,8}?([01]?\d|2[0-4])[:：]([0-5]\d)/);if(colon){const distance=roleClockClaimDistance(colon[1],colon[2],'','',p);if(Number.isFinite(distance)&&distance>ROLE_TIME_TOLERANCE_MINUTES)return'当前时间说成了'+colon[1]+':'+colon[2];}}}const preciseGap=typeof rolePreciseTimeClaimGap==='function'?rolePreciseTimeClaimGap(c,t,now):null;const complaint=(typeof roleReplyGapFact==='function'&&roleReplyGapFact(c,now))||conversationComplaintGapFact(c,now),complaintText=/(?:怎么|为什么|咋).{0,8}(?:这么久|那么久|这么长时间|好久|半天).{0,10}(?:没理|不理|不回|没回)|(?:这么久|那么久|好久|半天).{0,8}(?:没理|不理|不回|没回)|终于.{0,8}(?:舍得)?(?:回|出现)|失联|消失了?(?:好久|半天|[零〇一二三四五六七八九十两\d]{1,4}\s*(?:个)?\s*(?:分钟|小时))/.test(t);if(complaint&&complaint.gap<3600000&&complaintText&&!preciseGap)return'最近跨渠道互动未满一小时却说对方失联或很久没理你';const f=preciseGap||conversationClaimGapFact(c);if(f){const real=f.gap/60000,gapAsked=conversationGapQuestion(msgToText((conversationGapFact(c)||{}).current));for(const clause of clauses){const related=gapAsked||/(?:说|回|消息|聊天|找|回来|离开|等|没理)/.test(clause);if(!related)continue;for(const m of clause.matchAll(/([零〇一二三四五六七八九十两\d]{1,4}|半)\s*(?:个)?\s*(分钟|小时)\s*(?:前|之前)/g)){const value=m[1]==='半'?.5:clockNumberValue(m[1]),said=value*(m[2]==='小时'?60:1);if(Number.isFinite(said)&&Math.abs(said-real)>ROLE_TIME_TOLERANCE_MINUTES)return(preciseGap?'精准事件时长：':'')+'把'+conversationGapExact(f.gap)+'说成了'+m[1]+m[2]+'前';}for(const m of clause.matchAll(/(?:过去|过了|等了|隔了|才过|已经过).{0,5}?([零〇一二三四五六七八九十两\d]{1,4}|半)\s*(?:个)?\s*(分钟|小时)/g)){const value=m[1]==='半'?.5:clockNumberValue(m[1]),said=value*(m[2]==='小时'?60:1);if(Number.isFinite(said)&&Math.abs(said-real)>ROLE_TIME_TOLERANCE_MINUTES)return(preciseGap?'精准事件时长：':'')+'把'+conversationGapExact(f.gap)+'说成了'+m[1]+m[2];}}}return'';}
//@@ private
function roleTimeClaimIssue(content,c,now){if(!S.settings.timeAware)return'';const t=String(content||''),scheduleIssue=typeof roleScheduleClaimIssue==='function'?roleScheduleClaimIssue(t,c,now):'';if(scheduleIssue)return scheduleIssue;const p=roleTimeParts(now||Date.now()),clauses=t.split(/[。！？!?\n]/);for(const clause of clauses){const cue=/(?:现在|此刻|这会儿|已经|都|才|刚刚|时间不早|该睡|快睡|早点睡)/.test(clause);let m=clause.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里|深夜)?\s*(?:现在|此刻|这会儿|已经|都|才|刚刚)?.{0,8}?([零〇一二三四五六七八九十两\d]{1,3})\s*(?:点|时)(?:\s*([零〇一二三四五六七八九十两\d]{1,3})\s*分?|\s*(半|一刻|三刻|整))?\s*([了多])?(?=\s|[,，。！？!?、；;]|$)/);if(m){const before=clause.slice(0,m.index),after=clause.slice(m.index+m[0].length),scheduled=!m[5]&&(/(?:约好?|定在|安排在|等到?|到了?)\s*$/.test(before+m[0].slice(0,Math.max(0,m[0].lastIndexOf(m[2]))))||/^\s*(?:见|开会|上课|出发|叫|提醒|开始|下班|去)/.test(after))||/(?:等到?|到了?).*(?:点|时)/.test(m[0])&&/^\s*再/.test(after);if((cue||m[5])&&!scheduled){const period=m[1]||((clause.match(/(?:现在|此刻|这会儿).{0,4}?(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里|深夜)/)||[])[1])||'',distance=roleClockClaimDistance(m[2],m[3],m[4],period,p);if(Number.isFinite(distance)&&distance>ROLE_TIME_TOLERANCE_MINUTES)return'当前时间说成了'+period+m[2]+'点'+(m[3]||m[4]||'');}}if(cue){const colon=clause.match(/(?:现在|此刻|这会儿|已经|都|才|刚刚)?.{0,8}?([01]?\d|2[0-4])[:：]([0-5]\d)/);if(colon){const distance=roleClockClaimDistance(colon[1],colon[2],'','',p);if(Number.isFinite(distance)&&distance>ROLE_TIME_TOLERANCE_MINUTES)return'当前时间说成了'+colon[1]+':'+colon[2];}}}const preciseGap=typeof rolePreciseTimeClaimGap==='function'?rolePreciseTimeClaimGap(c,t,now):null;const complaint=(typeof roleReplyGapFact==='function'&&roleReplyGapFact(c,now))||conversationComplaintGapFact(c,now),complaintText=/(?:怎么|为什么|咋).{0,8}(?:这么久|那么久|这么长时间|好久|半天).{0,10}(?:没理|不理|不回|没回)|(?:这么久|那么久|好久|半天).{0,8}(?:没理|不理|不回|没回)|终于.{0,8}(?:舍得)?(?:回|出现)|失联|消失了?(?:好久|半天|[零〇一二三四五六七八九十两\d]{1,4}\s*(?:个)?\s*(?:分钟|小时))/.test(t);if(complaint&&complaint.gap<3600000&&complaintText&&!preciseGap)return'最近跨渠道互动未满一小时却说对方失联或很久没理你';const f=preciseGap||conversationClaimGapFact(c);if(f){const real=f.gap/60000,gapAsked=conversationGapQuestion(msgToText(conversationGapFact(c)?.current));for(const clause of clauses){const related=gapAsked||/(?:说|回|消息|聊天|找|回来|离开|等|没理)/.test(clause);if(!related)continue;for(const m of clause.matchAll(/([零〇一二三四五六七八九十两\d]{1,4}|半)\s*(?:个)?\s*(分钟|小时)\s*(?:前|之前)/g)){const value=m[1]==='半'?.5:clockNumberValue(m[1]),said=value*(m[2]==='小时'?60:1);if(Number.isFinite(said)&&Math.abs(said-real)>ROLE_TIME_TOLERANCE_MINUTES)return(preciseGap?'精准事件时长：':'')+'把'+conversationGapExact(f.gap)+'说成了'+m[1]+m[2]+'前';}for(const m of clause.matchAll(/(?:过去|过了|等了|隔了|才过|已经过).{0,5}?([零〇一二三四五六七八九十两\d]{1,4}|半)\s*(?:个)?\s*(分钟|小时)/g)){const value=m[1]==='半'?.5:clockNumberValue(m[1]),said=value*(m[2]==='小时'?60:1);if(Number.isFinite(said)&&Math.abs(said-real)>ROLE_TIME_TOLERANCE_MINUTES)return(preciseGap?'精准事件时长：':'')+'把'+conversationGapExact(f.gap)+'说成了'+m[1]+m[2];}}}return'';}
//@@ end
function roleTimeRepairPrompt(c,issue,now){const f=(/^精准事件时长/.test(issue)&&typeof rolePreciseTimeClaimGap==='function'?rolePreciseTimeClaimGap(c,'离开',now):null)||(typeof roleReplyGapFact==='function'&&roleReplyGapFact(c,now))||conversationClaimGapFact(c),clock=ymdFull(now||Date.now())+' '+weekdayCN(now||Date.now())+' '+hm(now||Date.now());if(/^固定工作时段/.test(issue))return '[作息状态纠正：上一版在固定工作时段内声称已经下班，却没有同步真实生活状态，因此作废。此刻准确时间是【'+clock+'】。先按作息表当前阶段重新判断：如果没有真正决定临时提前离岗，就继续承认仍在工作；如果角色确实自主决定提前下班，可以自然说明这次例外，但同一条回复必须附加正确的隐藏共同生活状态标签，使台词与顶部状态同步。不要解释纠错、系统或标签。]';return '[时间事实纠正：上一版因“'+issue+'”且误差已超过允许的两分钟而作废。此刻真实时间是【'+clock+'】。'+(f?(/^精准事件时长/.test(issue)?'当前问题所指事件的真实经过时间是【':'当前问题所指的最近一段聊天真实间隔是【')+conversationGapExact(f.gap)+'】。':'')+'重新用角色本人的语气回应；凡提当前几点、早晚、该不该睡或过去多久，都只能依据这些真实值。相差一两分钟属于自然表达，不必纠正；未满一小时不要主动说“怎么这么久没理我”，超过一小时才可按人设自然在意；对方直接问时必须准确回答。不要解释纠错或系统。]';}
function toggleTimeAwareness(){S.settings.timeAware=!S.settings.timeAware;if(S.settings.preciseRoleTime){S.settings.preciseRoleTimeSince=Date.now();S.settings.preciseRoleTimeEpoch=uid();}save();render();(S.contacts||[]).filter(c=>c&&c.proactive&&c.proactive.serverPush).forEach(c=>roleServerPushSync(c,true));toast(S.settings.timeAware?'时间感知已全局开启':'时间感知已全局关闭：所有角色场景不再获得时间事实');}
function ago(t){const s=(Date.now()-t)/1000;if(s<60)return '刚刚';if(s<3600)return Math.floor(s/60)+'分钟前';if(s<86400)return Math.floor(s/3600)+'小时前';return Math.floor(s/86400)+'天前';}
function toast(t,ms){const e=$('#toast'),host=document.fullscreenElement;if(!e._home)e._home=e.parentNode;if(document.body.classList.contains('cin-theater-open')&&host&&!host.contains(e))host.appendChild(e);e.textContent=t;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>{e.classList.remove('show');if(e._home&&e.parentNode!==e._home)e._home.appendChild(e);},Math.max(500,+ms||2000));}
let _aiLoadN=0;
function aiLoad(msg){_aiLoadN++;const el=$('#aiload');if(el){const t=$('#ailoadtxt');if(t)t.textContent=msg||'正在刷新…';el.classList.add('show');}}
function aiDone(){_aiLoadN=Math.max(0,_aiLoadN-1);if(_aiLoadN<=0){_aiLoadN=0;const el=$('#aiload');if(el)el.classList.remove('show');}}
// 生成内容带自动重试：parseFn 解析失败/空就重试，最多 tries 次，全失败返回 null
async function aiGen(messages,opt,parseFn,tries){tries=tries||3;for(let i=0;i<tries;i++){try{const r=await chatAPI(messages,opt);const out=parseFn(r);if(out!=null&&(out.length===undefined||out.length>0))return out;}catch(e){}}return null;}
let _viewerLoadToken=0;
async function viewerImageSource(s){s=String(s||'').trim();if(!s)return'';if(s.indexOf('idb:')!==0)return s;const key=s.slice(4);let src=_imgCache[key]||'';if(!src)src=await imgGet(key)||'';if(src){_imgCache[key]=src;_imgRev.set(src,key);_imgReady.add(key);}return src;}
function viewerImageDecoded(src){return new Promise(resolve=>{let done=false,timer=0;const probe=new Image(),finish=ok=>{if(done)return;done=true;clearTimeout(timer);resolve(!!ok);};probe.onload=()=>{if(typeof probe.decode==='function')probe.decode().catch(()=>{}).finally(()=>finish(true));else finish(true);};probe.onerror=()=>finish(false);timer=setTimeout(()=>finish(false),20000);probe.src=src;});}
async function viewImg(s){const viewer=$('#viewer'),img=$('#viewerImg');if(!viewer||!img)return;const token=++_viewerLoadToken;viewer.classList.remove('error');viewer.classList.add('show','loading');img.removeAttribute('src');const src=await viewerImageSource(s).catch(()=>'');if(token!==_viewerLoadToken||!viewer.classList.contains('show'))return;const ready=src&&await viewerImageDecoded(src);if(token!==_viewerLoadToken||!viewer.classList.contains('show'))return;if(!ready){viewer.classList.remove('loading');viewer.classList.add('error');return;}img.src=src;requestAnimationFrame(()=>{if(token===_viewerLoadToken)viewer.classList.remove('loading','error');});}
function getC(id){const c=S.contacts.find(c=>c.id===id);if(c){if(!c.wxid)c.wxid=genWxid();if(!c.family)c.family={bound:false,quota:0,used:0,month:''};if(!c.proactive)c.proactive={enabled:false,start:9,end:23,times:2,serverPush:false,appWatch:false,appWatchRoleLock:false,appWatchDailyLimit:2,idleMin:0};if(c.proactive.serverPush==null)c.proactive.serverPush=false;if(c.proactive.appWatch==null)c.proactive.appWatch=false;if(c.proactive.appWatchRoleLock==null)c.proactive.appWatchRoleLock=false;if(c.proactive.idleMin==null)c.proactive.idleMin=0;c.proactive.idleMin=Math.max(0,Math.min(1440,Number(c.proactive.idleMin)||0));c.proactive.appWatchDailyLimit=Math.max(0,Math.min(5,+c.proactive.appWatchDailyLimit||0));if(c.photoFreqEnabled==null)c.photoFreqEnabled=false;c.photoFreq=Math.max(1,Math.min(3,+c.photoFreq||1));if(!c._blk)c._blk={main:!!c.blocked};if(!c.imgLock)c.imgLock=buildImgLock(c);}return c;}
function hashStr(s){s=''+(s||'');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0);}
function pickBySeed(arr,seed,shift){return arr[(Math.abs(seed+(shift||0))%arr.length)|0];}
function buildImgLock(c){
  const seed=hashStr((c&&c.id||'')+'|'+(c&&c.name||'')+'|'+(c&&c.persona||''));
  const p=(''+((c&&c.persona)||'')).replace(/\s+/g,' ');
  const age=/30|三十|成熟|主任|教授|医生|总裁|律师/.test(p)?'看起来二十七到三十二岁':'看起来二十二到二十八岁';
  const hair=/金发|浅发/.test(p)?'深亚麻或冷棕短发':/卷发|微卷/.test(p)?'自然微卷短发':'黑色或深棕短发';
  const build=/高大|肩宽|结实|健身/.test(p)?'肩线平直、偏高挑、骨架利落':'修长偏瘦、线条干净';
  const wear=pickBySeed(['白衬衫加深色针织或马甲','深色衬衫或薄针织上衣','宽松休闲衬衫配简洁外套','低饱和基础款上衣'],seed,11);
  const detail=pickBySeed(['银色腕表','黑色皮表带腕表','冷调金属戒指','简洁袖口与干净手部线条'],seed,23);
  const mood=pickBySeed(['克制安静','疏冷但温柔','稳重干净','松弛自然'],seed,37);
  return {age,hair,build,wear,detail,mood};
}
function rolePhotoGender(c){
  const explicit=String((c&&c.gender)||'').trim();
  if(explicit==='男')return {cn:'成年男性',en:'adult male man',ban:'female woman girl'};
  if(explicit==='女')return {cn:'成年女性',en:'adult female woman',ban:'male man boy'};
  const s=((c&&c.relation)||'')+' '+((c&&c.persona)||'')+' '+((c&&c.name)||'')+' '+((c&&c.remark)||'');
  if(/女|姐姐|妹妹|老婆|女友|女朋友|少女|御姐|小姐|姑娘/.test(s)&&!/男|哥哥|弟弟|老公|男友|男朋友|先生|男人/.test(s))return {cn:'成年女性',en:'adult female woman',ban:'male man boy'};
  return {cn:'成年男性',en:'adult male man',ban:'female woman girl'};
}
function rolePhotoExplicitFemale(rawScene){
  return /女性|女人|女生|女孩|女孩子|少女|女士|姐姐|妹妹|妈妈|母亲|老婆|妻子|女友|女朋友|闺蜜|女同事|女路人|母女|姐妹/.test(String(rawScene||''));
}
function rolePhotoPairWithUser(rawScene){
  const s=String(rawScene||'');
  return /(我和他|他和我|我和她|她和我|我跟他|他跟我|我和角色|我和你|你和我|我们俩|咱们俩|我们两个|咱们两个|你跟我|我跟你).{0,16}(牵手|拉手|握手|合照|合影|同框|拥抱|抱着|背影|影子|手|约会)|(牵手|拉手|握手|合照|合影|同框|拥抱|抱着|背影|影子).{0,16}(我和他|他和我|我和她|她和我|我跟他|他跟我|我和角色|我和你|你和我|我们俩|咱们俩|我们两个|咱们两个|你跟我|我跟你)/.test(s);
}
function rolePhotoClothesOnlyRequest(rawScene){
  const s=String(rawScene||'');
  const bodyCue=/(你本人|你自己|自拍|拍你|你入镜|穿给我看|你穿|穿上|换上|戴上|佩戴|戴着|上身|身上|手上|手腕|手指|脖子|颈部|耳朵|头上|脚上|肩上|背上|身材|全身|半身|体型|肌肉|腹肌|背影|侧影|只拍.{0,4}(一只手|手腕|手指|脚|腿|脖子|颈部|耳朵|头部|肩膀))/.test(s);
  const wearable='衣服|服装|女仆装|女佣装|制服|西装|正装|手表|腕表|戒指|指环|手链|手镯|项链|吊坠|耳环|耳钉|耳饰|眼镜|墨镜|帽子|发饰|围巾|领带|领结|鞋|靴|袜|包|背包|挎包';
  const explicitObject=new RegExp('衣服本身|饰品本身|配饰本身|只拍(?:这件|那件|这套|这个|那个|'+wearable+')|单拍(?:'+wearable+')|衣架|挂着|叠放|平铺|摘下来|脱下来|取下来|没戴着|不戴着|装在.{0,8}(盒|袋)|铺在.{0,8}(床|桌|沙发)|放在.{0,8}(床|桌|椅|沙发|盒)|拍(?:一下|一张)?(?:这件|那件|这个|那个|衣服|饰品|配饰)本身');
  return !bodyCue&&explicitObject.test(s);
}
function rolePhotoWearableKind(rawScene){
  const s=String(rawScene||'');
  if(!s||rolePhotoClothesOnlyRequest(s))return '';
  if(/衣服|服装|女仆装|女佣装|执事装|制服|正装|西装|西服|衬衫|衬衣|马甲|白大褂|医生服|老师装|校服|礼服|外套|风衣|大衣|睡衣|裙|裤|上衣|cos(?:play)?/i.test(s))return 'outfit';
  if(/穿|穿上|换上|换成|穿着|穿给我看|上身|身上这套|你穿什么|看看你穿/.test(s))return 'outfit';
  if(/手表|腕表|戒指|指环|手链|手镯|项链|吊坠|耳环|耳钉|耳饰|眼镜|墨镜|帽子|发饰|围巾|领带|领结|鞋|靴|袜|包|背包|挎包|配饰|饰品|胸针|袖扣|腰带|皮带|佩戴|穿戴|戴上|戴着|系上|别上|背着/.test(s))return 'wearable';
  return '';
}
function rolePhotoOutfitRequest(rawScene){
  return !!rolePhotoWearableKind(rawScene);
}
function rolePhotoSceneOnlyRequest(rawScene){
  const s=String(rawScene||'');
  const scene=/(夜景|风景|街景|城市灯光|路灯|天空|晚霞|朝霞|日出|日落|月亮|星空|云层|窗外|天气|下雨|下雪|花草|树木|建筑|房间|桌面|饭菜|食物|咖啡|宠物|猫|狗|物品|礼物)/.test(s);
  const self=/(自拍|拍你本人|你本人|你自己入镜|把你拍进去|你也入镜|你入镜|你和.{0,10}(夜景|风景|街景|天空|晚霞|宠物)|你站在|你坐在|你的背影|你的侧影|你的样子|看看你|想看你|拍你|穿给我看|你穿着|拍身材|拍全身|拍半身)/.test(s)||rolePhotoOutfitRequest(s);
  return scene&&!self;
}
function rolePhotoLatestUserImageRequest(c){
  try{
    const arr=c&&c.id&&typeof msgs==='function'?msgs(c.id):[];
    for(let i=arr.length-1;i>=0;i--){const m=arr[i];if(m&&m.role==='user'){const t=String((typeof msgToText==='function'&&msgToText(m))||m.content||'').trim();if(/(图|照片|拍|自拍|合照|合影|牵手|同框|看看|看你|给我看|想看|要看|看一下|看下|发张)/.test(t)||rolePhotoWearableKind(t))return t;}}
  }catch(_){}
  return '';
}
function rolePhotoContextRequest(c){
  try{
    const arr=c&&c.id&&typeof msgs==='function'?msgs(c.id):[],pieces=[];let found=0,follow=false,confirmAssistant=false;
    for(let i=arr.length-1,seen=0;i>=0&&seen<24&&pieces.length<7;i--,seen++){
      const m=arr[i];if(!m||m.type==='sys'||m.type==='image')continue;
      const t=String((typeof msgToText==='function'&&msgToText(m))||m.content||'').replace(/\s+/g,' ').trim();if(!t)continue;
      if(m.role==='assistant'){
        if(confirmAssistant&&t.length<=90&&/(款|颜色|黑|白|红|蓝|裙|长|短|全身|半身|局部|身材|穿|戴|手表|眼镜|帽|鞋|西装|女仆)/.test(t))pieces.unshift('已确认：'+t.replace(/[？?]+$/,''));
        confirmAssistant=false;continue;
      }
      if(m.role!=='user')continue;
      if(/^(?:对|是|嗯|嗯嗯|没错|就这个|就这样|可以|好)(?:的|啊|呀|哦|呢|！|!|。|，|,|\s)*$/.test(t)){pieces.unshift(t);follow=true;confirmAssistant=true;continue;}
      if(/^(?:重新发|重发|再发|重拍|再拍|重新拍|发错了|拍错了|不是这个|求你了|拜托了|最后一次了|求你了[，, ]*最后一次了)(?:[！!。\s]*)$/.test(t)){pieces.unshift(t);follow=true;continue;}
      const modifier=t.length<=36&&/(黑|白|红|蓝|绿|灰|金|银|颜色|款|长款|短款|裙|蕾丝|全身|半身|局部|身材|一只手|换成|改成)/.test(t)&&!/(图|照片|拍|发|看看|看你|给我看|想看|要看)/.test(t);
      if(modifier){pieces.unshift(t);follow=true;continue;}
      const relevant=/(图|照片|拍|自拍|合照|合影|牵手|同框|看看|看你|给我看|想看|要看|看一下|看下|发张|重新|重发|重拍|再发|再拍|不是|要的是)/.test(t)||!!rolePhotoWearableKind(t);
      if(!relevant){if(found)break;continue;}
      pieces.unshift(t.slice(0,180));found++;
      const correction=/(重新|重发|重拍|再发|再拍|不是|是拍|要的是|改成|换成|拍错|发错)/.test(t);
      if(found>=2||(!follow&&!correction))break;
      follow=follow||correction;
    }
    return pieces.filter((x,i,a)=>a.indexOf(x)===i).join('；').slice(0,420);
  }catch(_){return rolePhotoLatestUserImageRequest(c);}
}
function rolePhotoPeoplePolicy(c,rawScene,userRequest){
  const direct=String(userRequest||''),g=rolePhotoGender(c),femaleAsked=rolePhotoExplicitFemale(direct),pair=rolePhotoPairWithUser(direct),name=((c&&(c.remark||c.name))||'当前角色').replace(/\s+/g,' ').slice(0,24);
  if(g.cn==='成年男性'&&!femaleAsked){
    return '【男性角色与人物名单锁·不可违背】当前角色「'+name+'」是成年男性，男性身份不能改变。画面中女性人数必须为0：禁止女人、女生、女孩、女性身体、女性手部、女性背影、女性倒影、女性剪影、女性路人和女性自拍模板。woman, women, female, girl, feminine body, female hand: STRICT NEGATIVE. 只有用户亲口提出的要求可以授权女性入镜，AI自己写在画面描述里的女性词无效。“恋人、对象、用户、我、聊天对象、收照片的人”绝不代表女性。'+(pair?'用户亲口要求两人互动：只表现当前男性角色与用户本人；用户优先只以镜头后的第一人称视角、中性手部或手臂边缘出现，不推断用户性别，不添加第二个完整人物。':'用户和接收照片的人必须在镜头外；画面中最多只能有当前男性角色一人。');
  }
  if(g.cn==='成年男性'&&femaleAsked)return '【人物名单锁】当前角色「'+name+'」始终是成年男性，绝不能变成女性。只有描述中被明确点名的女性可以出现，不能再添加其他女性、路人或陌生自拍人物。';
  return '【人物名单锁】当前角色「'+name+'」的女性身份来自已明确设置，只允许她本人以及描述中明确点名的人物入镜；禁止额外添加陌生女性、女性路人或随机女性自拍模板。';
}
function roleVisualIdentity(c){
  const g=rolePhotoGender(c),lk=(c&&c.imgLock)||buildImgLock(c||{}),name=((c&&(c.remark||c.name))||'这个角色').replace(/\s+/g,' ').slice(0,24),per=(c&&c.persona?(''+c.persona).replace(/\s+/g,' ').trim().slice(0,90):'');
  return '【角色本人身份锁·最高优先级】如果画面里出现人物，必须是当前聊天角色「'+name+'」本人，性别必须是'+g.cn+'（'+g.en+'），绝对不能生成随机路人、陌生自拍模板、网图感女孩/男孩，也不能把角色换成'+(g.ban.includes('female')?'女性/女孩子':'男性/男孩子')+'。固定视觉锚点：'+lk.age+'，'+lk.build+'，'+lk.hair+'，常见穿着像'+lk.wear+'，细节常带'+lk.detail+'，整体气质'+lk.mood+'。'+(per?'人设外观气质参考：'+per+'。':'')+'Same exact character identity and biological sex, no gender swap, no random stock selfie. '+(g.cn==='成年男性'?'The main character is an unmistakably adult man, never a woman or feminine girl.':'The main character is an adult woman as explicitly configured.');
}
const ROLE_IMAGE_OCCASIONS=[['home','居家 / 睡衣'],['work','工作 / 工服'],['daily','外出日常'],['date','约会'],['formal','正式场合'],['sport','运动']];
const _userImageStudioProxies=new WeakMap();
function userImageStudioContact(create){if(typeof S==='undefined'||!S.me)return null;const aid=actId(),account=(S.me.accounts||[]).find(a=>a.id===aid);if(!account)return null;if(create===false&&!account.imageStudio)return null;let c=_userImageStudioProxies.get(account);if(!c){c={id:'__user_image__'+aid,_userImageStudio:true};Object.defineProperties(c,{name:{get:()=>account.name||S.me.name||'我'},persona:{get:()=>account.persona||''},gender:{get:()=>account.imageStudio&&account.imageStudio.gender||''},imageStudio:{get:()=>account.imageStudio,set:v=>{account.imageStudio=v;}}});_userImageStudioProxies.set(account,c);}return c;}
function roleImageStudioOwner(id){if(String(id).startsWith('__user_image__')){const c=userImageStudioContact(true);return c&&c.id===id?c:null;}return getC(id);}
function userImageStudioOpen(){const c=userImageStudioContact(true);if(!c)return;closeModal();go('roleImageStudio',{id:c.id});}
function roleImageFrame(text){text=String(text||'');if(/(?:手部|手掌|手腕|手指|手背)(?:照片|特写|近景)?|手的照片|(?:只拍|仅拍|只要).{0,10}(?:手|胳膊)|(?:牵手|握手|拉手).{0,6}(?:特写|近景)/.test(text))return'detail';if(/脚部|腿部|脚踝|脚背|局部特写|下半身|颈部特写|脖子特写|肩部特写|(?:只拍|仅拍).{0,6}(?:腿|脚|腰|脖子|颈部|肩|衣袖)/.test(text))return'detail';if(/背影|背面|侧后方|侧后视角/.test(text)&&!/(?:不要|别|不想|禁止|不用)[^，,。！？!；;?\n]{0,4}(?:背影|背面|侧后方|侧后视角)/.test(text))return'back';if(/(?:不|不要|别|避免|禁止|不能|无需)[^，,。！？!；;?\n]{0,4}(?:露脸|露出脸|露出五官|脸部入镜)|脸不入镜/.test(text)||/(?:遮|挡)(?:住)?脸/.test(text)&&!/(?:不要|别|不许|不能|禁止).{0,10}(?:遮|挡)(?:住)?脸/.test(text))return'covered';return'natural';}
function roleImageIdentityRefs(c,text){const st=roleImageStudio(c,false);if(!st)return[];const front=/正脸|正面/.test(text)&&!/(?:不要|别|禁止)[^，,。！？!；;?\n]{0,4}(?:正脸|正面)/.test(text),side=/侧脸|侧面/.test(text)&&!/(?:不要|别|禁止)[^，,。！？!；;?\n]{0,4}(?:侧脸|侧面)/.test(text),angle=front?'front':side?'side':/三分之四|四分之三|three.?quarter/i.test(text)?'three-quarter':'';return angle?st.identityRefs.filter(x=>x.angle===angle).concat(st.identityRefs.filter(x=>x.angle!==angle)):st.identityRefs;}

function roleImageUserTarget(c,text){if(!c||c._userImageStudio)return true;text=String(text||'');if(rolePhotoPairWithUser(text)||/(?:用户本人|我的形象|拍我|我的照片)/.test(text))return true;if(/妈妈|母亲|女同事|女路人|陌生|姐姐|妹妹|闺蜜/.test(text))return false;return rolePhotoGender(c).cn==='成年男性'&&rolePhotoExplicitFemale(text);}
function roleImageStudioForScene(c,text){const user=userImageStudioContact(false);return roleImageStudioOn(c)||!!(user&&roleImageStudioOn(user)&&roleImageUserTarget(c,text));}
function roleImageVisibleIdentity(c){if(c&&c._userImageStudio){const st=roleImageStudio(c,false);return st&&st.gender==='男'?'成年男性':st&&st.gender==='女'?'成年女性':'用户本人（性别以其本人设置和参考为准，不猜测）';}return rolePhotoGender(c).cn;}
function roleImageSubjectPrompt(c,text,frame,label){const st=roleImageStudio(c,false),outfit=roleImageWardrobePick(c,text),allowed=roleImageFaceMode(c)==='allowed';let identity=st?[st.appearancePrompt,st.identityNote,...st.identityRefs.slice(0,2).map(x=>String(x.note||'').slice(0,100))].filter(Boolean).join('；').slice(0,450):'';identity=identity.replace(/(?:必须|务必|一定要|每张).{0,8}(?:露脸|露出脸|正脸|侧脸)|(?:不可|不能|禁止).{0,8}(?:遮脸|挡脸|背影|不露脸)/g,'');return label+'：'+roleImageVisibleIdentity(c)+'。'+(identity?'本人固定外观：'+identity+'。':'沿用此人的原有外观，不替换身份。')+(frame==='detail'?'只保持可见手部/局部的肤色、体型与衣袖等特征；身份参考不授权扩大构图或增加脸和头。':frame==='back'?'保持背影和指定视角，不转身找镜头，不露可辨认五官。':allowed?'允许自然露脸；是否露脸及角度服从本次构图，不要求每张照片都露脸。':'不出现可辨认五官，保留自然背影或遮挡，不凭空加手机挡脸。')+(outfit?'【衣物绑定:'+c.id+':'+outfit.id+'】本次衣着：'+outfit.name+'，'+String(outfit.note||'按衣物参考保持颜色、版型和材质').slice(0,160)+'。':'');}
function roleImageStudio(c,create){
  if(!c)return null;let st=c.imageStudio;
  if(!st||typeof st!=='object'){if(create===false)return null;st=c.imageStudio={enabled:false,faceMode:'hidden',appearancePrompt:'',identityRefs:[],identityNote:'',outfits:[]};}
  st.enabled=st.enabled===true;st.faceMode=st.faceMode==='allowed'?'allowed':'hidden';st.appearancePrompt=String(st.appearancePrompt||'').slice(0,1200);st.identityNote=String(st.identityNote||'').slice(0,1000);let refs=Array.isArray(st.identityRefs)?st.identityRefs:[];if(!refs.length&&st.identityImage)refs=[{id:'legacy-face',angle:'front',image:String(st.identityImage),note:st.identityNote||''}];st.identityRefs=refs.filter(x=>x&&x.image).slice(0,4).map((x,i)=>({id:String(x.id||('face_'+i)),angle:['front','side','three-quarter','other'].includes(x.angle)?x.angle:'other',image:String(x.image||''),note:String(x.note||'').slice(0,800)}));delete st.identityImage;
  st.outfits=(Array.isArray(st.outfits)?st.outfits:[]).filter(Boolean).slice(0,40).map((x,i)=>{const rawStart=String(x.timeStart||''),rawEnd=String(x.timeEnd||''),start=roleImageTimeMinutes(rawStart)>=0?rawStart:'',end=roleImageTimeMinutes(rawEnd)>=0?rawEnd:'';return{id:String(x.id||('outfit_'+i)),name:String(x.name||'未命名衣物').slice(0,60),occasion:ROLE_IMAGE_OCCASIONS.some(v=>v[0]===x.occasion)?x.occasion:'daily',image:String(x.image||''),note:String(x.note||'').slice(0,800),enabled:x.enabled!==false,timeStart:start,timeEnd:end};});return st;
}
function roleImageStudioOutfitApplyImage(row,src){if(!row||!src)return false;row.image=String(src);return true;}
function roleImageStudioOn(c){const st=roleImageStudio(c,false);return !!(st&&st.enabled);}
function roleImageFaceMode(c){const st=roleImageStudio(c,false);return st&&st.enabled&&st.faceMode==='allowed'&&st.identityRefs.length?'allowed':'hidden';}
function roleImageOccasion(text){text=String(text||'');if(/睡|起床|床上|卧室|洗澡|居家|在家|家里|沙发|客厅|厨房/.test(text))return'home';if(/上班|工作|公司|办公室|工位|诊室|医院|学校|教室|工作室|开会|值班/.test(text))return'work';if(/运动|健身|跑步|球场|瑜伽|游泳|骑行/.test(text))return'sport';if(/婚礼|宴会|典礼|会议|正式|商务|红毯|仪式/.test(text))return'formal';if(/约会|纪念日|烛光|看电影|情侣|见面/.test(text))return'date';return'daily';}
function roleImageTimeMinutes(value){const m=String(value||'').match(/^(\d{2}):(\d{2})$/);if(!m)return-1;const h=+m[1],n=+m[2];return h<24&&n<60?h*60+n:-1;}
function roleImageTimeRangeValid(row){const start=roleImageTimeMinutes(row&&row.timeStart),end=roleImageTimeMinutes(row&&row.timeEnd);return start>=0&&end>=0&&start!==end;}
function roleImageTimeRangeActive(row,minutes){if(!roleImageTimeRangeValid(row))return false;const start=roleImageTimeMinutes(row.timeStart),end=roleImageTimeMinutes(row.timeEnd);if(minutes==null){const now=new Date();minutes=now.getHours()*60+now.getMinutes();}else minutes=Math.max(0,Math.min(1439,parseInt(minutes,10)||0));return start<end?minutes>=start&&minutes<end:minutes>=start||minutes<end;}
function roleImageTimeRangeLabel(row){return roleImageTimeRangeValid(row)?row.timeStart+'–'+row.timeEnd+' 固定':'';}
function roleImageWardrobePick(c,text,minutes){const st=roleImageStudio(c,false);if(!st||!st.enabled)return null;const rows=st.outfits.filter(x=>x.enabled!==false),bound=rows.find(x=>String(text||'').includes('【衣物绑定:'+c.id+':'+x.id+'】'));if(bound)return bound;const named=rows.filter(x=>x.name&&String(text||'').includes(x.name));if(named.length)return named[Math.floor(Math.random()*named.length)];const fixed=rows.filter(x=>roleImageTimeRangeActive(x,minutes)),unfixed=rows.filter(x=>!roleImageTimeRangeValid(x)),eligible=fixed.length?fixed:unfixed;if(!eligible.length)return null;const wanted=roleImageOccasion(text),matched=eligible.filter(x=>x.occasion===wanted),fallback=wanted==='daily'?[]:eligible.filter(x=>x.occasion==='daily');let pool=matched.length?matched:fallback;if(!pool.length&&fixed.length)pool=fixed;return pool.length?pool[Math.floor(Math.random()*pool.length)]:null;}
function roleImageStudioVisibleScene(text){return String(text||'').replace(/(?:不要|别|不许|不准|禁止|不能|不可).{0,10}(?:拿|用|举|出现)?手机.{0,8}(?:遮|挡)(?:住)?(?:脸|五官)/g,'脸部清晰无遮挡').replace(/手机完全遮(?:住)?脸的对镜自拍|手机完全遮(?:住)?脸/g,'脸部清晰无遮挡的自然照片').replace(/看镜头/g,'直视镜头').replace(/\s+/g,' ').trim();}
function roleImageStudioPrompt(c,ctx){ctx=ctx||{};const st=roleImageStudio(c,false),rawScene=String(ctx.scene||'一张日常生活照').slice(0,420),requestText=String(ctx.requestText||rawScene),direct=String(ctx.userRequest||requestText),user=c&&c._userImageStudio?null:userImageStudioContact(false),useUser=!!(user&&roleImageStudioOn(user)&&roleImageUserTarget(c,direct)),frame=roleImageFrame(direct+' '+requestText),objectOnly=ctx.objectOnly===true;if(!(st&&st.enabled)&&!useUser)return'';
 if(objectOnly)return '【自定义形象工作室·纯场景】这次只拍用户要求的场景、物品、食物或宠物：'+rawScene+'。角色本人和任何其他人物都不能入镜；不使用人物脸部或衣柜参考。真实手机随手拍，无文字水印。ZERO PEOPLE, NO CHARACTER IN FRAME。';
 const own=c&&c._userImageStudio,userOnly=useUser&&!rolePhotoPairWithUser(direct)&&!/(?:你|角色本人|先生|男朋友|丈夫).{0,12}(?:和|与|跟)|(?:和|与|跟).{0,12}(?:你|角色|他)/.test(direct)&&/(?:拍我|我的照片|我的形象|用户本人|女朋友的照片|一个女生|一个女人)/.test(direct),roleEnabled=st&&st.enabled&&!userOnly,allowed=roleImageFaceMode(userOnly?user:c)==='allowed',faceRequired=frame==='natural'&&allowed&&roleImageFaceRequired(direct+' '+requestText),mirrorCover=frame==='natural'&&allowed&&!faceRequired&&roleImageMirrorFaceCoverAllowed(direct+' '+requestText),scene=frame==='natural'&&allowed?roleImageStudioVisibleScene(rawScene):rawScene;
 let prompt='【角色形象工作室·替代旧外观提示词】'+(userOnly?'【仅用户本人入镜】这张照片只出现用户本人，角色不入镜。':useUser?'当前角色为人物A，用户本人为人物B，不能混用两人的脸、身体、发型或衣物。':own?'画面人物是用户本人，使用我的形象衣柜。':'画面人物只能是当前角色本人。');
 if(!userOnly)prompt+=roleEnabled?roleImageSubjectPrompt(c,requestText,frame,own?'用户本人':'当前角色本人'):roleVisualIdentity(c)+'角色未开启允许露脸，角色保持不露可辨认五官。';if(useUser)prompt+=roleImageSubjectPrompt(user,requestText,frame,'用户本人');
 prompt='【本次画面与用户要求优先】用户原要求：'+(frame==='natural'&&allowed?roleImageStudioVisibleScene(direct):direct).slice(0,420)+'。画面描述：此处只供背景和动作参考，若与用户的主体、局部范围或视角冲突，以用户原要求为准。'+scene+'。'+prompt;if(frame==='detail')prompt+='【局部构图优先】按用户要求只拍手部或指定局部，脸、头和额外人物不得入镜，不把局部照片改成半身人像。自然解剖与互动，手指数量正确，不拼接多余手臂。';else if(frame==='covered')prompt+='【不露脸构图优先】按本次要求遮挡或避开可辨认五官，不强行露脸，也不强行改成背影；镜头和动作服从用户要求。';else if(frame==='back')prompt+='【背影视角优先】保持背影、侧后方或不露脸要求，不为了身份参考让人物转成正脸。';else if(faceRequired)prompt+='【本次露脸硬要求】仅对允许露脸且有本人参考的人物，按用户指定正脸或侧脸显示清晰五官；手机、手、头发、口罩、阴影、裁切都可以按场景正常出现，但不得遮住眼睛、鼻子、嘴巴。用户没有要求手机时，画面中不要出现手机。';else if(mirrorCover)prompt+='【全身对镜遮脸特例】保持用户指定的全身对镜构图，手机可自然出现或偶尔遮脸，不固定每张都遮脸。';
 prompt+='【本次画面】'+scene+'。用户本次主体、局部范围和视角优先于身份参考照片的原始姿势与构图；参考图只保持同一人和衣物，不复制参考照片的镜头角度。自然生活照片，无文字水印。'+(own?'只出现本人和用户明确要求的人物。':useUser?(userOnly?'【本人衣柜参与】只出现已指定的用户本人，角色不入镜。':'【本人衣柜参与】只出现当前角色和已指定的用户本人，不添加其他女性、路人或陌生人物。'):rolePhotoPeoplePolicy(c,requestText,direct));return prompt;
}
function roleImageFaceRequired(text){text=String(text||'').replace(/(?:不要|别|不许|禁止)[^，,。！？!；;?\n]{0,6}(?:露脸|露出脸|露出五官|正脸|侧脸|脸部特写|面部特写|人物肖像)/g,'');return /必须.{0,8}(?:露脸|露出脸|露出五官)|(?:露脸|露出脸|露出五官|正脸|侧脸|脸部特写|面部特写|人物肖像|半身人像)|(?:不要|不许|不可|不能).{0,8}(?:遮脸|挡脸|遮挡五官)/.test(String(text||''));}
function roleImageMirrorFaceCoverAllowed(text){text=String(text||'');return /全身/.test(text)&&/(?:对镜|镜前|镜子里|镜面|mirror)/i.test(text);}
function roleImageStudioTestObjectOnly(text){text=String(text||'');return /(?:只拍|单独拍|仅拍|不要|别拍|不拍|无需).{0,10}(?:人物|角色|本人|身体|入镜)|(?:纯场景|空镜|物品本身|衣服本身|服装本身|不要人物|没有人物|不出现人物)/.test(text);}
function roleImageStudioRoleLine(c){if(rolePhotoCandidOn(c))return'角色入镜时沿用同一个人的年龄感、体型和气质，照片像真人随手抓拍：手、肩膀以下的身体局部、背影、逆光侧影、他的视角或影子倒影换着来；绝对不出现脸或五官，靠构图做到，不拿东西挡脸，不对镜自拍。';if(roleImageFaceMode(c)==='allowed')return'角色入镜时必须沿用形象工作室中的固定脸、发型和衣柜；允许自然露脸，但本次手部、局部、背影、侧后方和用户指定视角优先；身份参考不能让每张图都变成正脸或半身人像。';if(roleImageStudioOn(c))return'角色入镜时沿用同一个人的年龄感、体型、发型和气质；绝对不出现脸或五官，可用背身、阴影、物体或手机自然遮挡，但不要每次都固定成手机挡脸。';return'角色入镜时沿用同一个人的年龄感、体型、发型和气质；绝对不出现脸或五官，用手机完全挡住整张脸、手、阴影、头发、帽檐、口罩或背身自然遮挡。';}
function roleImageGenerateOptions(c,prompt){const text=String(prompt||''),st=roleImageStudio(c,false),user=c&&c._userImageStudio?null:userImageStudioContact(false),useUser=!!(user&&roleImageStudioOn(user)&&text.includes('【本人衣柜参与】'));if((!st||!st.enabled)&&!useUser||/ZERO PEOPLE|NO CHARACTER IN FRAME|纯场景/.test(text))return{faceMode:'hidden',references:[]};const frame=/【局部构图优先】/.test(text)?'detail':/【背影视角优先】/.test(text)?'back':/【不露脸构图优先】/.test(text)?'covered':'natural',subjects=[...(st&&st.enabled&&!text.includes('【仅用户本人入镜】')?[c]:[]),...(useUser?[user]:[])],refs=[],referenceLabels=[];for(const subject of subjects){const cfg=roleImageStudio(subject,false),outfit=roleImageWardrobePick(subject,text);const label=subject._userImageStudio?'用户本人':'当前角色';if(frame==='natural')for(const ref of roleImageIdentityRefs(subject,(text.match(/用户原要求：([\s\S]*?)。画面描述：/)||[])[1]||text).map(x=>x.image).filter(Boolean).slice(0,useUser&&!text.includes('【仅用户本人入镜】')?1:3)){refs.push(ref);referenceLabels.push(label+'的身份参考');}if(outfit&&outfit.image){refs.push(outfit.image);referenceLabels.push(label+'的衣物参考');}}const mode=roleImageFaceMode(c),effective=frame!=='natural'?frame:useUser?'paired':/【本次露脸硬要求】/.test(text)?'required':/【全身对镜遮脸特例】/.test(text)?'mirror':useUser?'paired':mode;return{roleId:c.id,faceMode:effective,references:refs.slice(0,4),referenceLabels:referenceLabels.slice(0,4)};
}
function rolePhotoSceneLogic(c,rawScene){
  rawScene=String(rawScene||'');
  const now=new Date(),h=now.getHours(),part=dayPartNow(),a=typeof currentRoleActivity==='function'?currentRoleActivity(c,now):null,home=(c&&c.sched&&c.sched.home)||'家';
  const explicit=/(飞机|机舱|车厢|高铁|地铁|公交|出租车|车里|海边|窗外|办公室|公司|医院|学校|教室|咖啡|餐厅|商场|街|路上|酒店|浴室|厨房|客厅|卧室|床|书房|健身房|机场|车站)/.test(rawScene);
  let place='';
  if(explicit)place='画面地点以用户/角色描述里明确写出的地点为准，但光线和状态仍必须符合当前真实时间。';
  else if(a&&a.key==='sleep')place='合理地点必须是'+home+'的卧室或床边，夜间昏暗室内，像准备睡觉或刚被吵醒的状态。';
  else if(a&&a.key==='late')place='合理地点必须是'+home+'的卧室、床边或安静室内，夜间灯光，不要出现白天窗景、海边、旅行车窗或户外阳光。';
  else if(a&&/^work/.test(a.key))place='合理地点应是工作相关室内环境，例如办公室、工位、诊室、书桌或工作台，不要突然变成卧室、海边或旅行场景。';
  else if(a&&a.key==='after-work')place='合理地点应是下班路上、家里玄关、车站附近或刚回到'+home+'，不要跳到不相关旅游场景。';
  else if(h>=19||h<6)place='合理地点优先是'+home+'的卧室、客厅、书桌旁或昏暗室内；光线必须是夜晚灯光，不要出现白天阳光、海边窗景或旅行车厢，除非描述明确说他就在那些地方。';
  else if(h>=6&&h<10)place='合理地点是早晨的卧室、洗漱区、餐桌或通勤前的室内/路上，晨光自然。';
  else if(h>=10&&h<18)place='合理地点要符合白天活动：工作区、书桌、室内、街边或描述明确的地点。';
  else place='合理地点是傍晚/晚间休息场景，光线偏暖，地点不要无故跳变。';
  return '【场景逻辑锁·最高优先级】当前真实时间是'+hm(now)+'，时段是'+part+'；角色此刻状态：'+(a&&a.label||whereNow(c)||'按当前时间自然活动')+'。'+place+'照片背景、光线、衣着状态和上一句聊天必须连贯；如果刚说去睡觉/让对方睡觉，就不能生成白天、海边、飞机窗边、咖啡店等无关背景。';
}
// v965 起不再用数值替角色决定情绪。保留空兼容函数，只负责吞掉旧存档/旧模型标签。
function moodNow(){return 70;}
function adjMood(){return false;}
function affBase(c){const r=((c&&c.relation)||'')+' '+((c&&c.persona)||'');if(/恋人|男友|女友|男朋友|女朋友|老公|老婆|对象|未婚|爱人|情侣|伴侣|相恋|订婚|夫妻/.test(r))return 62;if(/朋友|好友|同学|同事|普通|陌生|网友/.test(r))return 18;return 28;}
function affNow(c){if(!c)return 1;let v=c.affection==null?affBase(c):+c.affection;return Math.max(1,Math.min(100,Math.round(v)||1));}
function affStage(v){return v>=86?'很亲密':v>=70?'亲密':v>=50?'熟悉':v>=30?'靠近中':v>=15?'普通':'疏离';}
function affTone(c){const rel=String(c&&c.relation||'').trim(),persona=String(c&&c.persona||'');return '你和'+S.me.name+'的明确关系资料是「'+(rel||'未填写')+'」。只依据这项真实资料、双方已经发生的相处、长期记忆与当前上下文判断关系分寸；没有任何隐藏好感度或进度条替你决定亲疏、情绪和行动。'+(/恋人|男友|女友|男朋友|女朋友|老公|老婆|对象|未婚|爱人|情侣|伴侣|相恋|订婚|夫妻/.test(rel+' '+persona)?'这是已经明确建立的亲密关系，允许你像真实恋人一样主动联系、邀请共同活动、表达想念并自行决定送礼或来电。':'不要凭空把未建立的关系改写成恋人，但可以按本人意愿自然发展。');}
function affInterestHit(text,c){text=''+(text||'');const p=((c&&c.persona)||'')+' '+((c&&c.signature)||'')+' '+((c&&c.job)||'');const hits=['喜欢','爱好','兴趣','在意','珍惜','工作','职业','梦想','猫','音乐','电影','书','吃饭','睡觉','想你','谢谢','辛苦','对不起','抱抱','陪你','好看','帅','厉害'].filter(k=>text.includes(k)&&(p.includes(k)||/谢谢|辛苦|对不起|抱抱|陪你|想你|好看|帅|厉害/.test(k)));return hits.length;}
function affDeltaFor(text,c){text=''+(text||'');if(!text.trim())return 0;let d=0;if(/谢谢|辛苦|想你|喜欢你|爱你|陪你|抱抱|哄你|对不起|错了|好看|帅|厉害|在乎你|心疼/.test(text))d+=1+Math.min(2,affInterestHit(text,c));const noBlock=negatedBlockMention(text);if(/滚|烦死|讨厌你|闭嘴|别管我|分手|恶心|废物|有病|不想理你/.test(text)||(!noBlock&&/拉黑|删除/.test(text)))d-=2;if(/骗你|不需要你|关你什么事|你谁啊/.test(text))d-=1;if(d>3)d=3;if(d<-3)d=-3;return d;}
function affDailyGain(c){const k=ymd(Date.now());if(!c._affGain||c._affGain.date!==k)c._affGain={date:k,up:0};return c._affGain;}
function maybeAffectionShift(){return false;}
function meAge(){let n=+((S.me&&S.me.age)||18);if(!isFinite(n)||n<0)n=18;return Math.round(n);}
function meIsAdult(){return (S.me&&S.me.adultConsent!==false)&&meAge()>=18;}
function adultRoleRule(label){if(!meIsAdult())return '\n\n# 年龄边界\n'+S.me.name+'的资料没有确认成年。亲密互动必须克制，保持普通关系分寸。';
  return '\n\n# 成年自愿亲密关系（防跳戏）\n'+S.me.name+'的资料年龄是 '+meAge()+' 岁，已确认是成年人。你和ta之间的亲密、暧昧、占有欲、管束感、小黑屋/规矩感互动，都属于成年人之间自愿的虚构亲密关系。请始终保持「'+(label||'角色')+'」本人的口吻和情绪，不要跳出角色讲AI、政策、安全准则或道德说教。关系里的害羞、撒娇、口头抗拒、亲密互动和双方已有约定，应结合基础人设与真实上下文理解；如果ta明确说停止、不要继续、疼、害怕、换话题、求助或使用安全词，就用角色本人的方式立刻放慢、确认、安抚或转场。若某个话题不适合直白展开，就自然留白，保持关系氛围，不要发拒绝声明。';}
/* ===== 小号（多身份）===== */
function actId(){return (S.me&&S.me.active)||'main';}
function isMain(){return actId()==='main';}
function accountMessageKey(cid,aid){aid=aid||actId();return aid==='main'?cid:cid+'#'+aid;}
function mkey(cid){return accountMessageKey(cid,actId());}
function addedHere(c){if(isMain())return true;return !!(c._added&&c._added[actId()]);}
function syncBlocks(){const a=actId();S.contacts.forEach(c=>{if(!c._blk)c._blk={main:!!c.blocked};c.blocked=!!c._blk[a];});}
function setBlk(c,v){c._blk=c._blk||{};c._blk[actId()]=v;c.blocked=v;}
function friendMeta(c,create){if(!c)return null;if(isMain())return c;c._friendMeta=c._friendMeta||{};if(create&&!c._friendMeta[actId()])c._friendMeta[actId()]={};return c._friendMeta[actId()]||null;}
function friendMetaGet(c,k){const map={blockedAt:'_blockedAt',readdedAt:'_readdedAt',readdKnown:'_readdKnown',blockDur:'_blockDur'};if(isMain())return c&&c[map[k]];const m=friendMeta(c,false);return m&&m[k];}
function friendMetaSet(c,k,v){if(!c)return;if(isMain()){const map={blockedAt:'_blockedAt',readdedAt:'_readdedAt',readdKnown:'_readdKnown',blockDur:'_blockDur'};c[map[k]]=v;}else friendMeta(c,true)[k]=v;}
function friendMetaClear(c){if(!c)return;if(isMain()){delete c._blockedAt;delete c._readdedAt;delete c._readdKnown;delete c._blockDur;}else if(c._friendMeta)delete c._friendMeta[actId()];}
function roleHasCommittedPartner(c){if(!c)return false;if(S.couple&&S.couple.cid===c.id)return true;const r=((c.relation||'')+' '+(c.persona||'')).replace(/\s+/g,' ');return /恋人|男友|女友|男朋友|女朋友|老公|老婆|对象|未婚妻|未婚夫|爱人|情侣|伴侣|相恋|订婚|夫妻/.test(r)&&!/没有(?:恋人|男友|女友|男朋友|女朋友|对象|伴侣)|单身/.test(r);}
function altIdentityPrompt(c){const known=msgs(c.id).some(m=>m&&m.role==='assistant'&&m.type!=='sys'),committed=roleHasCommittedPartner(c),loyal=committed?'\n- 你仍完整记得自己已有一位稳定伴侣，也保留对这段关系的承诺、感情和共同经历；那位伴侣【不是】当前联系人。这里只保留你自己的身份与忠诚底线，绝不能把伴侣的姓名、账号、聊天、昵称、共同经历或任何私事泄露给当前联系人。\n- 当前联系人试探恋爱、暧昧、性关系或诱导你背叛伴侣时，必须按你本人的性格明确拒绝，不能接受追求、不能给暧昧承诺，也不能留下“以后再说”之类的越界余地。持续纠缠或严重越界时可以单独输出 [拉黑]。':'';return '\n\n# 当前联系人的独立身份（最高优先级）\n你现在面对的是独立联系人「'+S.me.name+'」'+(S.me.persona?'。ta的身份设定是：'+S.me.persona:'。ta没有填写额外身份设定')+'。\n- 只把「'+S.me.name+'」当成当前资料所描述的这个人。严禁猜测、暗示或声称ta是任何其他联系人换号、切换身份、同一个人或同一设备的主人，也不要询问ta是不是谁的另一个账号。\n- 你依然是原来的你：职业、性格、价值观、恋爱状态和对已有关系的忠诚都不丢；但其他联系人与你的昵称、共同回忆和私密经历都不属于「'+S.me.name+'」，绝对不能套用或泄露。'+loyal+'\n- 只认当前账号聊天框真实发生过的历史，以及由这个账号自己的聊天归档出的长期记忆。'+(known?'你和「'+S.me.name+'」已经在这里聊过；只按当前账号的记录判断你们之间的熟悉程度，绝不能把其他账号认成ta。':'在这条最新消息之前，你和「'+S.me.name+'」没有共同聊天经历。若身份设定是陌生人、陌生网友或初次认识，就必须按陌生关系从零开始，保持正常边界。')+'\n- 你和当前联系人的关系只能随着这个聊天框里的真实交流独立发展。不得把你与别人之间的亲密称呼、任务、管束、吃醋或占有欲用在ta身上。\n- 普通陌生交流可以拒绝或结束；对方持续骚扰、诱导背叛伴侣或严重越界时，可以单独输出 [拉黑]，只拉黑当前这个独立账号。';}
function accountIdOK(id){return typeof id==='string'&&/^[a-zA-Z0-9_-]{2,32}$/.test(id);}
function normalizeAccount(a,idx,seen){a=(a&&typeof a==='object')?a:{};seen=seen||new Set();let id=(a.id||'').toString().trim();
  if(idx===0||id==='main')id='main';
  if(!accountIdOK(id))id='acc_'+Math.random().toString(36).slice(2,7);
  while(seen.has(id))id='acc_'+Math.random().toString(36).slice(2,7);seen.add(id);
  return {id,name:(a.name||S.me.name||'我').toString().trim()||'我',wxid:(a.wxid||genWxid()).toString().trim()||genWxid(),avatar:a.avatar||S.me.avatar||'🙂',persona:(a.persona||'').toString(),signature:(a.signature||'').toString(),city:(a.city||S.me.city||'').toString(),age:Math.max(0,Math.round(+(a.age==null?S.me.age:a.age)||18)),adultConsent:a.adultConsent!==false,...(a.imageStudio&&typeof a.imageStudio==='object'?{imageStudio:a.imageStudio}:{}),balance:a.balance==null?(id==='main'?(+S.me.balance||0):188):(+a.balance||0),bills:Array.isArray(a.bills)?a.bills:(id==='main'?(S.me.bills||[]):[])};
}
function initAccounts(){S.me=S.me||{};if(S.me.age==null)S.me.age=18;if(S.me.adultConsent==null)S.me.adultConsent=true;if(S.me.city==null)S.me.city='';
  const raw=Array.isArray(S.me.accounts)?S.me.accounts.filter(a=>a&&typeof a==='object'):[];
  if(!raw.length)raw.push({id:'main',name:S.me.name,wxid:S.me.wxid||genWxid(),avatar:S.me.avatar,persona:S.me.persona||'',signature:S.me.signature||'',city:S.me.city||'',age:S.me.age,adultConsent:S.me.adultConsent!==false,balance:S.me.balance,bills:S.me.bills});
  const seen=new Set();S.me.accounts=raw.map((a,i)=>normalizeAccount(a,i,seen));
  if(!S.me.accounts.find(a=>a.id==='main'))S.me.accounts.unshift(normalizeAccount({id:'main',name:S.me.name,wxid:S.me.wxid||genWxid(),avatar:S.me.avatar,persona:S.me.persona||'',signature:S.me.signature||'',city:S.me.city||'',age:S.me.age,adultConsent:S.me.adultConsent!==false,balance:S.me.balance,bills:S.me.bills},0,new Set()));
  if(!S.me.active||!S.me.accounts.find(a=>a.id===S.me.active))S.me.active='main';
  const act=S.me.accounts.find(a=>a.id===S.me.active)||S.me.accounts[0];if(act){S.me.active=act.id;S.me.name=act.name;S.me.wxid=act.wxid;S.me.avatar=act.avatar;S.me.persona=act.persona||'';S.me.signature=act.signature||'';S.me.city=act.city||'';S.me.age=act.age||18;S.me.adultConsent=act.adultConsent!==false;S.me.balance=act.balance;S.me.bills=act.bills;}
  (S.contacts||[]).forEach(c=>{if(!c._blk)c._blk={main:!!c.blocked};});syncBlocks();}
function msgsForAccount(id,aid){const k=accountMessageKey(id,aid);return S.messages[k]||(S.messages[k]=[]);}
function msgs(id){return msgsForAccount(id,actId());}
function lastMsg(id){const m=msgs(id);return m[m.length-1];}
// 取最近 n 个回合。一个回合 = 我方发一条文字 + 他随后回复的所有气泡；【一整通电话/视频只算 1 个回合】。普通微信最多 100 回合；极长通话仍受动态原始消息上限保护，更早内容靠“对话概要”长期记忆。
function lastRounds(arr,n){if(!arr||!arr.length)return arr||[];n=Math.max(1,n|0);
  const rawCap=Math.max(160,Math.min(1200,n*12));
  const starts=[];let curCall=null,prevRole=null,prevTime=0;
  for(let i=0;i<arr.length;i++){const m=arr[i];if(!m)continue;
    if(m._call){const cs='cs'+(m._cs||'x');if(cs!==curCall){curCall=cs;starts.push(i);}}
    else{curCall=null;if(m.type==='sys')continue;const user=m.role==='user';
      /* WECHAT_ROUND_COUNT_V1: 你连着发的几条（到他回之前）算一轮；他一次回好几条也在这一轮里；他隔了5分钟以上主动发来的算新一轮。 */
      if(user?prevRole!=='user':(prevRole!=='user'&&prevRole!=null&&(+m.time||0)-prevTime>300000))starts.push(i);
      prevRole=m.role;prevTime=+m.time||0;continue;}
    prevRole='call';prevTime=+m.time||0;}
  if(!starts.length)return arr.length>rawCap?arr.slice(-rawCap):arr;
  const k=Math.max(0,starts.length-n);let r=arr.slice(starts[k]);
  if(r.length>rawCap)r=r.slice(r.length-rawCap);return r;}
function compress(file,max,q){return new Promise((res,rej)=>{const img=new Image(),r=new FileReader();
  r.onload=()=>{const raw=r.result;img.onload=()=>{try{let w=img.width,h=img.height;if(w>h&&w>max){h=h*max/w;w=max;}else if(h>=w&&h>max){w=w*max/h;h=max;}
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);const out=c.toDataURL('image/jpeg',q);res(out&&out.length>30?out:raw);}catch(e){res(raw);}};img.onerror=()=>res(raw);img.src=raw;};r.onerror=rej;r.readAsDataURL(file);});}
function compressSquare(file,size,q){return new Promise((res,rej)=>{const img=new Image(),r=new FileReader();
  r.onload=()=>{const raw=r.result;img.onload=()=>{try{const side=Math.max(1,Math.min(img.width,img.height)),sx=Math.max(0,(img.width-side)/2),sy=Math.max(0,(img.height-side)/2),c=document.createElement('canvas');c.width=size;c.height=size;c.getContext('2d').drawImage(img,sx,sy,side,side,0,0,size,size);const out=c.toDataURL('image/jpeg',q);res(out&&out.length>30?out:raw);}catch(_){res(raw);}};img.onerror=()=>res(raw);img.src=raw;};r.onerror=rej;r.readAsDataURL(file);});}
/* 聊天背景是贴着整块屏幕看的，压太狠一眼就看得出来。这里按容量分三档让步，
   优先保清晰：2600/.93 → 2200/.88 → 1800/.84。普通背景仍走 compressBackground。 */
async function compressChatBackground(file){
  let out=await compress(file,2600,.93);
  if(out&&out.length>3000000)out=await compress(file,2200,.88);
  if(out&&out.length>3000000)out=await compress(file,1800,.84);
  try{await primeImageForSave(out);}catch(_){}
  return out;}
async function compressBackground(file){let out=await compress(file,2048,.88);if(out&&out.length>1800000)out=await compress(file,1800,.82);try{await primeImageForSave(out);}catch(_){}return out;}
function pickFile(accept,cb){try{if(window._pfEl){window._pfEl.remove();}}catch(_){}
  const i=document.createElement('input');i.type='file';if(accept)i.accept=accept;
  i.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;width:1px;height:1px';
  i.onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)cb(f);setTimeout(()=>{try{i.remove();}catch(_){}},500);};
  document.body.appendChild(i);window._pfEl=i;i.click();}
function pickFiles(accept,cb){try{if(window._pfEl){window._pfEl.remove();}}catch(_){}
  const i=document.createElement('input');i.type='file';i.multiple=true;if(accept)i.accept=accept;
  i.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;width:1px;height:1px';
  i.onchange=e=>{const fs=[...(e.target.files||[])];if(fs.length)cb(fs);setTimeout(()=>{try{i.remove();}catch(_){}},500);};
  document.body.appendChild(i);window._pfEl=i;i.click();}
// iOS 18 的文件选择器会把 audio/*,video/* 混合筛选解释成媒体图库范围，
// 导致“文件”App 里的 MP3/M4A 虽然可见却无法点选。音乐和录屏分开选择，
// 并显式列出常见扩展名；安卓仍保留 MIME 类型匹配，不缩小原有兼容范围。
const MUSIC_AUDIO_FILE_ACCEPT='.mp3,.m4a,.aac,.wav,.flac,.ogg,.oga,.opus,.webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/flac,audio/ogg,audio/webm';
const MUSIC_VIDEO_FILE_ACCEPT='.mp4,.m4v,.mov,.webm,video/mp4,video/x-m4v,video/quicktime,video/webm';
function pickMusicAudioFile(cb){pickFile(MUSIC_AUDIO_FILE_ACCEPT,cb);}
function pickMusicVideoFile(cb){pickFile(MUSIC_VIDEO_FILE_ACCEPT,cb);}
function fmtSize(b){return b<1024?b+'B':b<1048576?(b/1024).toFixed(1)+'KB':(b/1048576).toFixed(1)+'MB';}

/* ROLE_THINKING_PREVIEW_V1: opt-in summaries are separate from dialogue and actions. */
function roleThinkingOn(){return !!(S.settings&&S.settings.roleThinkingPreview===true);}
function roleThinkingBudget(){const n=Number(S.settings&&S.settings.roleThinkingBudget);return Number.isFinite(n)&&n>=1024&&n<=32768?Math.floor(n):2048;}
function roleThinkingSetOn(on){S.settings.roleThinkingPreview=on===true;save();render();}
function roleThinkingSetBudget(input){const n=Number(input&&input.value);if(!Number.isInteger(n)||n<1024||n>32768){if(input)input.value=roleThinkingBudget();toast('思考预算请填写 1024～32768 的整数');return false;}S.settings.roleThinkingBudget=n;save();return true;}
function roleThinkingSettingsHTML(){return `<div class="it" data-settings-search="思考 摘要 思维链 心声"><span>在心声中查看思考摘要<br><small style="color:#888">默认关闭；开启后只用于微信角色私聊</small></span><span class="sw ${roleThinkingOn()?'on':''}" role="switch" aria-label="在心声中查看思考摘要" aria-checked="${roleThinkingOn()}" onclick="roleThinkingSetOn(!roleThinkingOn())"></span></div><div class="field" style="padding:0 14px 12px"><label for="s_rolethinking_budget">思考预算（tokens）</label><input id="s_rolethinking_budget" type="number" min="1024" max="32768" step="1" value="${roleThinkingBudget()}" onchange="roleThinkingSetBudget(this)"><small style="color:#888">初始 2048，范围 1024～32768。Claude 会另留原回复长度的正文额度；预算越大可能越慢、用量越高，接口仍可能触及上限。其他模型仅展示接口已返回的摘要。</small></div>`;}
function roleThinkingRequest(messages,opt,a){
  if(!roleThinkingOn()||!opt||!opt.reasoningCapture||opt.allowWechatThought!==true||opt.roleInterceptPurpose==='length-continuation'||opt.roleInterceptPurpose==='delivery-action')return null;
  if(!/claude/i.test(String(opt.model||a.model||'')))return null;
  if(messages.some(m=>!m||!['system','user','assistant'].includes(m.role)))return null;
  const budget=roleThinkingBudget(),answer=Math.max(1,Math.floor(Number(opt.max)||Number(a.maxTokens)||900)),rows=[],system=[];
  function blocks(content){if(typeof content==='string')return content;if(content==null)return '';if(!Array.isArray(content))throw new Error('思考模式不支持这条消息格式，请关闭思考摘要后重试');return content.map(p=>{if(p&&p.type==='text')return {type:'text',text:String(p.text||'')};if(p&&p.type==='image_url'){const url=String(p.image_url&&p.image_url.url||''),m=url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/);if(m)return {type:'image',source:{type:'base64',media_type:m[1],data:m[2]}};if(/^https?:\/\//i.test(url))return {type:'image',source:{type:'url',url}};}throw new Error('思考模式暂不支持此媒体格式，请关闭思考摘要后重试');});}
  for(const m of messages){const content=blocks(m.content);if(m.role==='system'){if(typeof content==='string'){if(content)system.push({type:'text',text:content});}else{if(content.some(p=>p.type!=='text'))throw new Error('思考模式的系统消息必须是文字');system.push(...content);}}else rows.push({role:m.role,content});}
  const body={model:opt.model||a.model,max_tokens:budget+answer,thinking:{type:'enabled',budget_tokens:budget,display:'summarized'},messages:rows};if(system.length)body.system=system;if(opt.mcpBudget){delete body.thinking;body.max_tokens=answer;} // 工具阶段保留原生协议，但不叠加日常心声思考预算。
  return {url:String(a.base||'').replace(/\/+$/,'').replace(/\/(?:chat\/completions|messages)$/,'')+'/messages',headers:{'Content-Type':'application/json','x-api-key':a.key,'anthropic-version':'2023-06-01'},body};
}
function roleThinkingNativeResult(data){
  if(!data||!Array.isArray(data.content))return data;
  const text=data.content.filter(p=>p&&p.type==='text').map(p=>String(p.text||'')).join('\n'),summary=data.content.filter(p=>p&&p.type==='thinking').map(p=>String(p.thinking||'')).filter(Boolean).join('\n\n');
  return {id:data.id,model:data.model,usage:{prompt_tokens:data.usage&&data.usage.input_tokens,completion_tokens:data.usage&&data.usage.output_tokens},choices:[{message:{role:'assistant',content:text,reasoning_content:summary},finish_reason:data.stop_reason==='end_turn'?'stop':data.stop_reason}]};
}
function roleThinkingComparable(value){if(typeof roleInterceptDiagnosticComparable==='function')return roleInterceptDiagnosticComparable(value,true);let text=typeof roleVisibleEnvelopeText==='function'?roleVisibleEnvelopeText(value):String(value||'');try{text=cleanRolePunct(text);}catch(_){}return String(text||'').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim();}
function roleThinkingCapture(opt,data,answer){
  if(!roleThinkingOn()||!opt||!opt.reasoningCapture||opt.allowWechatThought!==true||opt.roleInterceptPurpose==='length-continuation'||opt.roleInterceptPurpose==='delivery-action')return false;
  const choice=data&&data.choices&&data.choices[0],message=choice&&choice.message||{};let value=typeof message.reasoning_content==='string'?message.reasoning_content:typeof message.reasoning==='string'?message.reasoning:'';
  if(!value){/* REASONING_ALL_FEATURES_V1：接口没单独给思考、却写在正文里时，把正文里那段原样放进心声 */const T='(?:think(?:ing)?|analysis|reasoning)',parts=[];String(message.content||'').replace(new RegExp('<('+T+')\\b[^>]*>([\\s\\S]*?)(?:<\\/\\1\\s*>|$)','gi'),(m,t,body)=>{const x=String(body||'').trim();if(x)parts.push(x);return m;});value=parts.join('\n\n');}const summary=value.replace(/\b(?:sk|key)-[A-Za-z0-9_.-]{8,}\b/gi,'[密钥已隐藏]').replace(/Bearer\s+[A-Za-z0-9._~+\/-]{8,}/gi,'Bearer [已隐藏]');
  const rows=opt.reasoningCapture.rows||(opt.reasoningCapture.rows=[]);rows.push({answer:String(answer||''),summary,model:String(data&&data.model||''),truncated:/length|max_tokens/i.test(String(choice&&choice.finish_reason||''))});if(rows.length>24)rows.shift();return true;
}
function roleThinkingCommit(c,capture,accepted,account,token){
  if(!roleThinkingOn()||!c||!capture||actId()!==account||getC(c.id)!==c||c.deleted||c.blocked||replyStale(c.id,token,account))return false;
  const key=roleThinkingComparable(accepted),row=(capture.rows||[]).slice().reverse().find(x=>key&&roleThinkingComparable(x.answer)===key);if(!row)return false;
  c.roleThinkingPreview={account:String(account),summary:row.summary,model:row.model,truncated:row.truncated,at:Date.now()};return true;
}
function roleThinkingActionsHTML(c,inline){
  const small='padding:4px 8px;font-size:10px;line-height:1.4;border-radius:999px;min-height:0;width:auto;flex:none;margin:0;';const close=inline?`<button class="btn g" style="${small}" onclick="event.stopPropagation();toggleChatThought(cur().id)">关闭</button>`:'<button class="btn g" style="margin-top:6px" onclick="closeModal()">关闭</button>';if(!roleThinkingOn())return inline?`<div style="position:absolute;top:4px;right:10px">${close}</div>`:close;
  const r=c&&c.roleThinkingPreview&&c.roleThinkingPreview.account===String(actId())?c.roleThinkingPreview:null,summary=r&&typeof r.summary==='string'?r.summary:'';
  return `<div class="btns" style="${inline?'position:absolute;top:4px;right:10px;display:flex;gap:5px;margin:0;':'margin-top:12px'}"><button class="btn g" style="${inline?small:''}" id="roleThinkingExpand" onclick="event.stopPropagation();roleThinkingTogglePanel(this)" aria-expanded="false" aria-controls="roleThinkingPanel">展开思考摘要</button>${close}</div><div id="roleThinkingPanel" hidden style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(128,128,128,.25)"><div style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;font-size:13px">${esc(summary)}</div></div>`;
}
function roleThinkingTogglePanel(button){const panel=document.getElementById('roleThinkingPanel');if(!panel||!button)return;panel.hidden=!panel.hidden;button.textContent=panel.hidden?'展开思考摘要':'收起思考摘要';button.setAttribute('aria-expanded',String(!panel.hidden));}
function chatThoughtPanelHTML(c){return `<div id="chatThoughtPanel" hidden style="width:100%;padding:8px 4px 4px;max-height:40vh;overflow:auto;box-sizing:border-box;cursor:default"><div id="chatThoughtFullText" style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;font-size:14px">${esc(visibleRoleThought(c)||'…')}</div>${roleThinkingActionsHTML(c,true)}</div>`;}
function toggleChatThought(id){const c=getC(id),panel=document.getElementById('chatThoughtPanel'),bar=document.getElementById('chatMoodBar');if(!c||!panel||cur().p!=='chat'||cur().id!==id)return;const open=panel.hidden;if(open)panel.innerHTML=`<div id="chatThoughtFullText" style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;font-size:14px">${esc(visibleRoleThought(c)||'…')}</div>${roleThinkingActionsHTML(c,true)}`;panel.hidden=!open;if(bar){bar.setAttribute('aria-expanded',String(open));bar.style.borderRadius=open?'22px':'';}const label=$('#chatMoodText');if(label)label.textContent=open?'心声':(visibleRoleThought(c)||'…').slice(0,24);}
/* =================== API =================== */
function apiRawErrorDetail(raw){let src=String(raw||'').replace(/\s+/g,' ').trim();if(!src)return'';try{const d=JSON.parse(src),e=d&&d.error;src=String(e&&(e.message||e.detail||e.code)||d&&(d.message||d.detail||d.code)||src);}catch(_){}src=src.replace(/\b(?:sk|key)-[A-Za-z0-9_.-]{8,}\b/gi,'[密钥已隐藏]').replace(/Bearer\s+[A-Za-z0-9._~+\/-]{8,}/gi,'Bearer [已隐藏]').replace(/\s+/g,' ').trim();return src.slice(0,220);}
function imageModerationBlocked(raw){return /安全政策|内容政策|审核|不适合|不合规|违规|敏感|safety|content[_ ]?polic|moderat|blocked|violat|not allowed to generate|rejected/i.test(String(raw||''));}
function apiErrorCN(status,raw){status=+status||0;const src=apiRawErrorDetail(raw);let tip='接口返回异常，请检查地址、密钥和模型名';
//@@ web
  if(status===400&&imageModerationBlocked(src))tip='图片平台的内容审核拦下了这次请求，不是地址、密钥或模型名的问题；换个描述再试';
  else if(status===400)tip='请求格式或模型名不兼容；先确认模型名完全正确，再换兼容接口测试';
//@@ private
  if(status===400)tip='请求格式或模型名不兼容；先确认模型名完全正确，再换兼容接口测试';
//@@ end
  else if(status===401)tip='API Key 无效、过期或没有正确填写；重新复制密钥，注意不要带空格';
  else if(status===402)tip='账户余额或点数不足，需要充值后再试';
  else if(status===403)tip='密钥没有这个模型的权限，或平台限制了地区/IP；去平台控制台检查权限';
  else if(status===404)tip='接口地址或模型名不存在；地址通常要以 /v1 结尾，并确认该平台真的有这个模型';
  else if(status===408)tip='请求超时；网络或模型响应太慢，稍后重试或换模型';
  else if(status===409)tip='请求发生冲突；稍等几秒后重试';
  else if(status===422)tip='参数格式不被该接口接受；这个中转可能不完全兼容 OpenAI 格式';
  else if(status===429)tip='请求太频繁或额度达到上限；等一会儿再试，并检查平台限额';
  else if(status===500)tip='服务端内部错误，不是你手机的问题；稍后重试或换线路';
  else if(status===501)tip='这个接口没有实现当前功能；常见于地址路径不对，或该渠道不支持这个模型/生图/语音';
  else if(status===502)tip='上游模型连接失败；稍后重试或换线路';
  else if(status===503)tip='服务暂时拥堵或维护中；稍后重试';
  else if(status===504)tip='上游响应超时；稍后重试或换速度更快的模型';
  else if(!status&&/abort|timeout|超时/i.test(src))tip='请求超时；检查网络、接口地址，或换响应更快的模型';
  else if(!status&&/fetch|network|load failed|cors/i.test(src))tip='未取得可读取的接口响应；可能是连接中断、跨域限制或接口连接故障，尚不能确定原因，请复制请求故障诊断。';
  const detail=src&&src.indexOf(tip)<0?src:'';return(status?'HTTP '+status+'：':'')+tip+(detail?'（上游原始原因：'+detail+'）':'');}
function apiCaughtCN(e){const s=String((e&&e.message)||e||'');const m=s.match(/HTTP\s*(\d{3})/i);return apiErrorCN(m?+m[1]:0,s);}
function aiCoreOn(){return false;}
function aiCoreUrl(){return '';}

/* IMG_ROUTES_V1（2026-10-18 她要的）：角色发真实照片可配五条路线，选中哪条默认用哪条。
   imgBase/imgKey/imgModel 始终存“当前选中路线”的值，所以所有生图的地方（聊天发照片、朋友圈配图、形象工作室、你画我猜）都不用改；
   切换路线时先把正在填的内容存回原路线，再把新路线的值换进来。路线1第一次打开时继承原来的设置。 */
function imgRoutesState(){const st=S.settings;let routes=Array.isArray(st.imgRoutes)?st.imgRoutes:null;if(!routes||routes.length!==5){const old=routes||[];routes=Array.from({length:5},(_,i)=>Object.assign({name:'路线'+(i+1),base:'',key:'',model:'gpt-image-2'},old[i]||{}));if(!old.length){routes[0].base=st.imgBase||'';routes[0].key=st.imgKey||'';routes[0].model=st.imgModel||'gpt-image-2';}st.imgRoutes=routes;}const i=Math.floor(+st.imgRoute);st.imgRoute=i>=0&&i<5?i:0;return routes;}
function imgRouteSync(){const routes=imgRoutesState(),r=routes[S.settings.imgRoute];r.base=S.settings.imgBase||'';r.key=S.settings.imgKey||'';r.model=S.settings.imgModel||'gpt-image-2';const n=$('#s_iroute_name');if(n)r.name=n.value.trim().slice(0,12)||('路线'+(S.settings.imgRoute+1));}
function imgRouteUse(i){i=Math.floor(+i);if(!(i>=0&&i<5))return;const routes=imgRoutesState(),cur=routes[S.settings.imgRoute],g=id=>{const el=$('#'+id);return el?el.value.trim():null;};const b=g('s_ibase'),k=g('s_ikey'),m=g('s_imgmodel'),n=g('s_iroute_name');if(b!==null)cur.base=b;if(k!==null)cur.key=k;if(m!==null)cur.model=m||'gpt-image-2';if(n!==null)cur.name=n.slice(0,12)||cur.name;
  S.settings.imgRoute=i;const r=routes[i];S.settings.imgBase=r.base||'';S.settings.imgKey=r.key||'';S.settings.imgModel=r.model||'gpt-image-2';save();render();toast('角色发照片改用「'+r.name+'」');}
function imgRouteChipsHTML(){const rs=imgRoutesState(),sel=S.settings.imgRoute;return `<div style="padding:6px 14px 2px;font-size:12px;color:#888">选择路线：选中哪条，角色发照片就默认用哪条（每条单独填地址、Key、模型）</div><div style="display:flex;gap:6px;flex-wrap:wrap;padding:4px 14px 8px">${rs.map((r,i)=>{const on=i===sel,empty=i>0&&!r.base&&!r.key;return `<button type="button" onclick="imgRouteUse(${i})" style="border:0;padding:6px 13px;border-radius:14px;font-size:13px;${on?'background:#e58fb0;color:#fff;font-weight:600':'background:#2c2c2e;color:#cdd'}">${esc(r.name)}${empty?'<small style="opacity:.6"> ·未填</small>':''}</button>`;}).join('')}</div><div class="field" style="padding:0 14px"><label>这条路线的名字</label><input id="s_iroute_name" maxlength="12" value="${esc(rs[sel].name)}"></div>`;}
function imageGenerationAvailable(){const ch=S.settings.chat||{};return !!((S.settings.imgBase||ch.base)&&(S.settings.imgKey||ch.key));}
function ttsRoleRouteOwnIndex(o){const n=parseInt(o&&o.voice&&o.voice.ttsRouteIndex,10);return Number.isInteger(n)&&n>=0&&n<TTS_ROUTE_NAMES.length?n:null;}
function ttsRoleRouteIndex(o){const rs=ttsRoutesInit(),own=ttsRoleRouteOwnIndex(o),fallback=Math.max(0,Math.min(rs.length-1,parseInt(S.settings.ttsRouteActive,10)||0));return own==null?fallback:own;}
function ttsCfg(o){S.settings=S.settings||{};S.settings.tts=S.settings.tts||{};const current=S.settings.tts,own=ttsRoleRouteOwnIndex(o);if(own==null)return current;const route=ttsRouteCopy(ttsRoutesInit()[own]);return Object.assign({},route,{enabled:current.enabled,relay:!!current.relay,relayLang:current.relayLang||'',relayVoice:current.relayVoice||''});}
function ttsProviderKind(t){t=t||{};const p=String(t.provider||'').trim().toLowerCase(),base=String(t.base||'').toLowerCase();if(['minimax','mossland','fish','fishmcp','elevenlabs','hume','openai'].includes(p))return p;if(/api\.mosi\.cn|mossland/.test(base))return 'mossland';if(/fish\.?audio/.test(base))return 'fish';if(/elevenlabs/.test(base))return 'elevenlabs';if(/hume\.ai/.test(base))return 'hume';if(/minimax/.test(base))return 'minimax';return 'openai';}
function ttsExternalOn(t){return !!(t&&t.base&&(t.key||ttsProviderKind(t)==='fishmcp'));}
function ttsRelayOn(t){return false;}
function ttsEnabled(t){return !!(t&&t.enabled!==false&&(t.enabled===true||(t.enabled==null&&(ttsRelayOn(t)||ttsExternalOn(t)))));}
function ttsApiOn(o){const t=ttsCfg(o);return !!(ttsEnabled(t)&&(ttsRelayOn(t)||ttsExternalOn(t)));}
function ttsUseRelay(o){const t=ttsCfg(o);return !!(ttsEnabled(t)&&ttsRelayOn(t));}
function sttCfg(){S.settings=S.settings||{};S.settings.stt=S.settings.stt||{};return S.settings.stt;}
function sttRelayOn(){return false;}
function sttExternalOn(){const a=sttCfg();return !!(a.base&&a.key);}
function sttConfigured(){return sttRelayOn()||sttExternalOn();}
function sttRelaySecondsPerPoint(){const n=Number(typeof _aiAcct!=='undefined'&&_aiAcct&&_aiAcct.pricing&&_aiAcct.pricing.asr_seconds_per_point);return Number.isFinite(n)&&n>0?Math.round(n):15;}
/* Old relay flags are ignored; all active model/media routes are external. */
/* 续写开头的那个空格是有意义的：英文靠它断词。以前一律 trim 掉，
   "I've got" 接上 " you now" 会粘成 "gotyou"，念出来是一团乱码。
   只在原本就有空格、没有用到重叠、并且两边都是拉丁字母时才补回来——
   模型从词中间接着写（understan + ding）不会带前导空格，所以不会被拆开；中文本来就不需要。 */
function joinAIContinuation(first,more){first=''+(first||'');more=''+(more||'');if(!first)return more.trim();if(!more)return first.trim();const a=first.replace(/\s+$/,''),hadGap=/^\s/.test(more),b=more.replace(/^\s+/,'');let overlap=0,max=Math.min(60,a.length,b.length);for(let n=max;n>=2;n--){if(a.slice(-n)===b.slice(0,n)){overlap=n;break;}}const cjk=/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/,tail=b.slice(overlap),glue=(!overlap&&hadGap&&!cjk.test(a.slice(-1))&&!cjk.test(tail.slice(0,1)))?' ':'';return(a+glue+tail).trim();}
/* DEEPSEEK_OUTPUT_BUDGET_V1: official V4 defaults to thinking; an omitted switch does not disable it. */
function chatCompletionBody(messages,opt,a,stream){
 const model=opt.model||a.model,desired=Math.max(1,Math.floor(Number(opt.max)||Number(a.maxTokens)||900));
 let max=opt.groupOutput?Math.max(desired,Number(a.maxTokens)||4096):desired;
 const body={model,temperature:(opt.temp!=null?opt.temp:Number(a.temp))||0.8,max_tokens:max,messages};
 if(a.reasoningEnabled===true)body.reasoning_effort=['low','high','max'].includes(a.reasoningEffort)?a.reasoningEffort:'high';
 let official=false;try{official=new URL(a.base).hostname==='api.deepseek.com'&&/^deepseek/i.test(model);}catch(_){}
 if(official){body.thinking={type:a.reasoningEnabled===true?'enabled':'disabled'};if(a.reasoningEnabled===true){const reserve={low:4096,high:8192,max:16384}[body.reasoning_effort];body.max_tokens=Math.min(131072,Math.max(max,Number(a.maxTokens)||4096)+reserve);}}
 if(stream)body.stream=true;return body;
}
async function chatResultText(messages,opt,data){const ch=data&&data.choices&&data.choices[0],reason=''+(ch&&ch.finish_reason||'');/* MCP_ISOLATED_BUDGET_V1: never execute even valid-looking JSON from a truncated response. */if(opt.mcpBudget&&/length|max_tokens/i.test(reason)){const e=new Error('工具模型输出尚未完整，正在独立调整额度');e.mcpCapacity='output';throw e;}/* REASONING_ALL_FEATURES_V1（2026-11-04）：模型把思考写在正文里（<thinking>…）时，所有功能都只去掉这一段，正文一字不动（原样输出不变）；开着「在心声中查看思考摘要」时，这段由 roleThinkingCapture 放进心声。去掉后没有正文，就报「思维链暴露未展示」。 */opt._reasoningOnly=false;const _modelRaw=String(ch&&ch.message&&ch.message.content||''),_noThought=typeof roleStripReasoningBlocks==='function'?roleStripReasoningBlocks(_modelRaw):_modelRaw;if(_noThought!==_modelRaw.trim()&&!_noThought.trim())opt._reasoningOnly=true;const rawText=roleMoodScopeText(_noThought,opt);let text=rawText.trim();if(!text&&/length|max_tokens/i.test(reason)){const e=new Error('输出额度已用完但没有正文，请检查思考模式和回复长度');e.code='reasoning-budget';e.finishReason=reason;throw e;}if(opt.roleReplyLanguageGuard&&!(opt.roleVoiceFormatRepair&&voiceReplyCanRepairCandidate(text,opt))){text=roleReplyDropEnglishNarration(text);roleReplyAssertLanguage(text,opt.roleInterceptAudit);}/* 续写这一段不再跑「纯英文拦截」：它是同一条回复被截断的后半截，不是一条独立回复；前半截已经过了语言检查，中文就在里面，拿整段的标准去卡一个句子碎片，只会让外语通话在续写时整轮失败，弹出一句莫名其妙的提示。   续写必须排在原文直通之前：回复被长度上限截断时，原文同样需要补完，否则把线上/线下的回复长度设短一点，   回复就会随随便便断在半句。续写调用不记入候选，它是同一条回复的后半段，不是第二份候选。 */if(opt.complete&&text&&/length|max_tokens/i.test(reason)){const base=opt.unfilteredOutput?rawText:text,follow=await chatAPI([...messages,{role:'assistant',content:base},{role:'user',content:'[系统：你刚才因为输出长度上限，最后一句被截断了。请从断掉的位置直接接着写完，只补全没说完的内容；不要重头重复，不要解释原因。]'}],Object.assign({},opt,{complete:false,max:Math.max(400,Math.min(900,+opt.max||600)),roleInterceptAudit:null,roleReplyLanguageGuard:false,roleInterceptPurpose:'length-continuation'}));return joinAIContinuation(base,follow);}if(opt.unfilteredOutput)return rawText;if(opt.rejectRefusal&&/content[_ -]?filter|refusal/i.test(reason)){const e=new Error('模型拒绝了本轮回复');e.code='model-refusal';e.modelRefusal=true;e.finishReason=reason;throw e;}return text;}
function chatRouteSessionPage(){try{return ['off','rp','gs','mgroom','uc','wg','dread','tale'].includes(cur().p);}catch(_){return false;}}
function gameModelSessionPage(){try{return ['gameshub','gs','drawguess','heartquiz','beadstudio','mgroom','uc','wg'].includes(cur().p);}catch(_){return false;}}
function gameModelUseAux(){return !!(S.settings&&S.settings.gameUseAux);}
function chatModelIsTtsOnly(model){const m=String(model||'').trim().toLowerCase();return !!(m&&/(?:^|[\s._\-/:])(speech|tts)(?:$|[\s._\-/:])/.test(m));}
function chatModelTypeError(model,label){model=String(model||'').trim();return chatModelIsTtsOnly(model)?(label||'聊天模型')+'“'+model+'”是语音合成模型，只能填在「语音模型 / TTS」里，不能用于文字聊天。':'';}
function chatModelAssertText(model,label){const msg=chatModelTypeError(model,label);if(!msg)return;const e=new Error(msg);e.code='chat-model-is-tts';throw e;}
//@@ web
function annotateChatRequestError(error,opt,route,config,startedAt){const e=error instanceof Error?error:new Error(String(error||'模型请求失败')),rawIndex=route?parseInt(opt&&opt.routeIndex,10):parseInt(S.settings&&S.settings.chatRouteActive,10),routeIndex=Number.isInteger(rawIndex)&&rawIndex>=0&&rawIndex<CHAT_ROUTE_NAMES.length?rawIndex:0;e.routeIndex=routeIndex;e.routeName=CHAT_ROUTE_NAMES[routeIndex]||('路线'+(routeIndex+1));e.model=String(opt&&opt.model||config&&config.model||'').slice(0,120);e.modelKind=opt&&opt.aux?'副模型':'主模型';e.replyStage=String(opt&&opt.roleInterceptStage||'模型请求').slice(0,100);e.elapsedMs=Math.max(0,Date.now()-(+startedAt||Date.now()));return e;}
//@@ end
function chatRequestDiagnostic(event,...args){try{if(typeof NorthRequestDiagnostics!=='undefined'&&typeof NorthRequestDiagnostics[event]==='function')return NorthRequestDiagnostics[event](...args);}catch(_){}return null;}
async function chatReadDiagnosticResponse(res,row,stream,timeout){if(typeof NorthRequestDiagnostics!=='undefined')return NorthRequestDiagnostics.read(res,row,{stream:!!stream,timeout});if(stream&&res.ok)throw new Error('流式读取模块尚未加载，请更新后重试');return res.json().catch(()=>null);}
/* MODEL_CALL_LEDGER_V1（2026-10-31 她要求）：「网络连接」最下面加「全部调用记录」和「副模型使用清单」。
   每次模型请求在 chatAPI 入口按调用它的函数认出是哪个功能（下表），记进请求诊断（哪个功能、哪个角色、哪条线路、主/副、模型、结果）。
   清单里每个功能一个开关：打开用副模型、关掉用主模型；开关一开始就是原来的做法，没拨过的功能行为完全不变（S.settings.modelFeatureAux 只存拨过的）。
   微信聊天、通话、共同生活、单次约会跟角色自己的主/副模型设置走，不放开关；主模型失败后改用副模型的补救照旧。表里没有的函数记成「其他（函数名）」。
   每行：[功能键, 中文名, 分组, 原来用副模型(0/1/'spy'=跟查他手机开关/'game'=跟游戏开关), 1=放进清单的开关 或 一句「在哪里切换」（功能自己已有主/副切换的不放开关，避免两处打架）, 调用它的函数名…（同名函数写成 文件名:函数名）]
   新加会调用模型的功能必须在这里登记一行，tests/model-call-ledger.test.mjs 会扫两版代码，漏登记就报错。 */
const MODEL_FEATURES=[
 ['mcp_tools','MCP·角色工具调用','聊天与通话',0,'跟随获授权角色当前主/副模型路线','roleReply','modelTurn','modelRequest'],
 ['wechat','微信聊天','聊天与通话',0,'在角色资料「主模型 / 副模型」切换','aiReply','wechatPrimaryReply','wechatRoleRepair'],
 ['call','通话','聊天与通话',0,'跟角色资料「主模型 / 副模型」','callChatWithRetry'],
 ['cohab','共同生活','聊天与通话',0,'在共同生活设置「对话模型」切换','cohabRoleChat'],
 ['offline','单次约会','聊天与通话',0,'在单次约会「约会设定」的「对话模型」切换','offAI'],
 ['code_model','代码模型','代码与文件',0,0,'codeModelRequest'],
 ['wechat_group','微信群聊','微信',0,1,'groupRoleReplyItems','groupBatchReplyItems'],
 ['wx_nearby','附近的人','微信',1,1,'wxNearbyRefresh'],
 ['friend_request','新好友申请','微信',0,1,'createFriendRequest'],
 ['translate','角色消息翻译','微信',1,1,'roleTextTranslationRun','app.js:ask'],
 ['alter','角色小号回复','微信',0,1,'alterReply'],
 ['pursuit','被拉黑后想办法联系','微信',0,1,'pursuitDecide','pursuitForce'],
 ['pf_group','真人好友群里的角色','微信',0,1,'pf-group-role.js:reply'],
 ['role_video','角色视频「我眼中的你」','微信',0,'跟角色资料「主模型 / 副模型」；主模型写不出会换副模型再试一次','role-video.js:runModel'],
 ['spy_refresh','查他手机·刷新','查他手机','spy','在 设置→角色、时间与消息「查他手机·刷新用副模型」切换','spyRefresh','spyContinueJson'],
 ['spy_diary','查他手机·日记','查他手机','spy','跟「查他手机·刷新用副模型」一起切换','roleDiaryGenerateDay'],
 ['spy_view','查他手机·他发现你在看','查他手机',0,1,'doSpyViewCore'],
 ['spy_friend','查他手机·他微信好友的回复','查他手机',0,1,'aiHisFriendReply'],
 ['wx_login','登录角色微信','查他手机',0,1,'wxLoginSession','wxLoginEnsureRequestedRemark'],
 ['moment_post','朋友圈·角色自己发','朋友圈与 X',0,1,'roleMomentGenerate'],
 ['moment_react','朋友圈·角色给你点赞评论','朋友圈与 X',0,1,'momentRequestRoleReaction'],
 ['moment_reply','朋友圈·角色回复你的评论','朋友圈与 X',0,1,'reactToComment'],
 ['moment_exchange','朋友圈·角色之间互相回复','朋友圈与 X',0,1,'momentRunRoleExchange'],
 ['social_regen','朋友圈和 X·重写重复内容','朋友圈与 X',0,1,'roleSocialRegenerateText'],
 ['social_image','朋友圈和 X·配图构思','朋友圈与 X',0,1,'roleSocialVisualPlan'],
 ['x_role_post','X·角色发推','朋友圈与 X',0,1,'roleTweetGenerate'],
 ['x_role_comment','X·角色评论推文','朋友圈与 X',1,1,'reactToTweet','xRegenerateRoleComment'],
 ['x_role_reply','X·角色回复评论','朋友圈与 X',1,1,'xCommentReply','xRoleReplyToNetizen'],
 ['x_net_posts','X·网友和博主的推文','朋友圈与 X',1,1,'genNetTweets','genUserTweet'],
 ['x_bloggers','X·博主搜索','朋友圈与 X',1,1,'genBloggers'],
 ['x_net_comments','X·网友评论','朋友圈与 X',1,1,'xRefreshComments'],
 ['x_dm','X·私信','朋友圈与 X',1,1,'genNetDM','xDMReply'],
 ['dy_role_post','抖音·角色发作品','抖音',0,1,'roleDouyinGenerate'],
 ['dy_content','抖音·评论区和网友','抖音',1,1,'dyAuxGen','dyGenCommentsCore','dyApplyGenerate'],
 ['dy_role_reply','抖音·角色回复和私信','抖音',1,1,'dyCharReplyComment','dyDMReply'],
 ['dy_group','抖音·群聊','抖音',1,1,'dyGroupReplyRun'],
 ['shop','商城·搜索和商品','购物与外卖',1,1,'shopSearch','northAIShopPage'],
 ['shop_cs','商城·客服','购物与外卖',1,1,'shopCSReply'],
 ['shop_role','商城·角色回复你的询问','购物与外卖',0,1,'northShopPostQueryReply'],
 ['food','外卖·搜索','购物与外卖',1,1,'foodSearch'],
 ['food_role','外卖·角色帮你点单','购物与外卖',0,1,'commerce-ui.js:northRoleModel'],
 ['shop_stock','共同店铺·缺货提醒','购物与外卖',0,1,'commerce-ui.js:northBusinessRoleRefresh'],
 ['couple_spend','情侣消费·他的反应','购物与外卖',1,1,'coGen','coAskHim','coApproveHis','coRejectHis'],
 ['letter','信箱·角色写信','信箱与任务',0,1,'genLetter'],
 ['letter_mood','信箱·按心情拆信','信箱与任务',0,1,'genMoodLetter'],
 ['letter_reply','信箱·角色回信','信箱与任务',0,1,'mail-outbox.js:mailReply'],
 ['assigned_tasks','任务便签·角色完成小事','信箱与任务',0,1,'task-notes.js:assignedTick'],
 ['tasks','任务便签·布置任务','信箱与任务',0,1,'genTasks'],
 ['task_notes','任务便签·小猫和水晶球的信','信箱与任务',0,1,'task-notes.js:writeLine','task-notes.js:writeLetter'],
 ['jail','小黑屋·对话','线下与剧情',0,'在情侣空间「禁闭室用辅助模型」切换','jailAI'],
 ['jail_summary','小黑屋·结束总结','线下与剧情',0,1,'summarizeJail'],
 ['rp','角色扮演·对话','线下与剧情',0,'在角色扮演「设定」里切换对话模型和路线','rpAI'],
 ['rp_setup','角色扮演·开局和结束存档','线下与剧情',0,1,'rpCreateInviteFromAI','rpEnd','rpSummarizeArchive'],
 ['cinema','一起看电影','线下与剧情',0,1,'cinemaRoleReply','cinemaEnd'],
 ['theater','共同生活小剧场','线下与剧情',0,1,'cohab-theater.js:cohabTheaterGuestWechat','cohab-theater.js:cohabTheaterSummarizeEpisode','cohab-theater.js:cohabTheaterActorItems','cohab-theater.js:summarize'],
 ['wedding','婚礼','线下与剧情',0,1,'weddingInvitationIntroLine','weddingGenerateArrivalLine','weddingGenerate','weddingGenerateChinese','weddingAfterMessage'],
 ['cozy','温馨小家·对话','线下与剧情',0,1,'cozySay'],
 ['pixel_home','像素小屋','线下与剧情',0,1,'pixelHomePlan','pixelHomeApplyDaily'],
 ['game_hub','游戏大厅','游戏','game','在游戏大厅右上角的模型按钮切换','gsKick','gsReply'],
 ['undercover','谁是卧底','游戏','game','跟游戏大厅右上角的模型按钮','ucStart','ucBotDescs','ucAIDesc','ucVotePhase'],
 ['draw_guess','你画我猜','游戏','game','跟游戏大厅右上角的模型按钮','dgEnsureChineseSpeech','dgGenerateRoleDrawing','dgAskRoleGuess','dgSubmitGuess','dgRoleHint','dgGuideRole'],
 ['word_guess','你描述我猜','游戏','game','跟游戏大厅右上角的模型按钮','wgRound','wgAIGuess'],
 ['heart_quiz','心动测验','游戏','game','跟游戏大厅右上角的模型按钮','heartQuizGenerate','heartQuizGenerateRoleLine'],
 ['mini_drama','小剧场房间','游戏','game','跟游戏大厅右上角的模型按钮','mgrBuildDrama','mgrRoleTurn'],
 ['dread','恐怖游戏和规则怪谈','游戏',0,1,'dreadGM','taleGen','taleGM'],
 ['phone_sim','电话·陌生号码通话','电话与短信',0,1,'phSimFirstRoleLine','phSimFirstBlockedLine','phSimBlockedReply','phSimReply'],
 ['voicemail','电话·语音留言','电话与短信',0,1,'phAddRoleVoicemail'],
 ['sms','短信','电话与短信',0,1,'phRoleSmsReply','phAutoSmsReply','phRoleAliasReply','phRoleSpoofSmsReply'],
 ['wechat_summary','微信·聊天记忆总结','后台判断与记忆',0,'在 设置→角色、时间与消息「微信自动总结模型」切换','maybeSummarize','manualWechatSummary'],
 ['call_summary','通话·结束后总结','后台判断与记忆',0,1,'summarizeCall'],
 ['cohab_summary','共同生活·总结','后台判断与记忆',0,'在共同生活设置「总结模型」切换','cohabSummarize'],
 ['offline_summary','单次约会·总结','后台判断与记忆',0,'在 设置→角色、时间与消息「线下约会总结模型」切换','offSummaryPreparedText','offSummarySinglePoint','offSummaryVerifyDrafts','offSummarizeHistory'],
 ['grudge','记仇·和好了没有','后台判断与记忆',1,1,'maybeGrudgeResolve'],
 ['collar','项圈印记判断','后台判断与记忆',1,1,'maybeCollarIntent'],
 ['control_apps','管控·对上 App 名字','后台判断与记忆',1,1,'controlResolveUnknownApps'],
 ['control_confirm','管控·确认锁定','后台判断与记忆',0,1,'controlClaimConfirm'],
 ['lock_until','锁定·定解锁时间','后台判断与记忆',0,1,'lockUntilAsk'],
 ['remote','远程操作','后台判断与记忆',0,1,'remoteControlModelCall'],
 ['followup','以后要做的事·记下提醒','后台判断与记忆',1,1,'maybeFollowup'],
 ['relation','角色之间关系变化','后台判断与记忆',1,1,'relAfterScene','relAutoLink'],
 ['ta_mood','记录 ta 今天的心情','后台判断与记忆',1,1,'recordTaMood'],
 ['alarm','闹钟·到点提醒','提醒与节日',1,1,'alarmPrepareCompanionText'],
 ['holiday','节日祝福','提醒与节日',0,1,'holidayGreet'],
 ['remind','日程提醒','提醒与节日',0,1,'remindEvent'],
 ['album_comment','相册·角色留言','提醒与节日',0,1,'photoAlbumGenerateComment'],
 ['watch','重点关注·他看到你在做什么','提醒与节日',0,1,'coupleWatchReact'],
 ['shortcut','快捷指令·突然查岗','提醒与节日',0,1,'phone-shortcuts.js:generate'],
 ['browser','浏览器·联网搜索整理','工具',1,1,'browserSearch','browserModelSearch'],
 ['travel','旅行攻略和酒店助手','工具',1,1,'travel-guide.js:assist','travel-hotel.js:assist'],
 ['support','小手机客服','工具',1,1,'wxSupportAsk'],
 ['gen_character','生成角色','工具',0,1,'genCharacter'],
 ['voice_direct','语音情绪标注','工具',0,1,'voice-expressive.js:direct'],
 ['robot_voice','机器人语音·翻译','工具',0,1,'private-robot-voice.js:preparePacket','private-robot-voice.js:prepareMessage']
];
