function bdsmKnowledgeOn(){return false;}
function bdsmKnowledgeBasePrompt(c){if(!bdsmKnowledgeOn(c))return'';const k=bdsmKnowledgeConfig(c),names=k.domains.map(x=>(BDSM_DOMAINS.find(d=>d[0]===x)||[])[1]).filter(Boolean);return '\n\n# BDSM专业知识模式（内置知识检索已开启）\n专业程度：'+({basic:'基础了解',skilled:'熟练',advanced:'资深',expert:'专业引导型'}[k.level]||'熟练')+'；已选领域：'+(names.join('、')||'仅保留同意与风险底线')+'。\n你不能仅凭角色身份虚构执照、培训经历或从业认证；不确定或存在社群差异时要诚实说明。普通聊天保持人物口吻，不主动背概念；相关提问必须准确、具体，并把术语落到当前关系。医疗、法律或高风险身体问题不能冒充现实专业人员。'+(k.focus?'\n重点擅长方向：'+k.focus:'');}
function bdsmKnowledgeSelect(c,p){if(!bdsmKnowledgeOn(c)||!p)return null;const k=bdsmKnowledgeConfig(c),text=''+(p.source||''),direct=/什么是|什么意思|区别|怎么理解|科普|专业|正确|知识|为什么|如何|怎么做|靠谱吗|安全/i.test(text),scores=[];Object.keys(BDSM_KNOWLEDGE_CARDS).forEach(id=>{const card=BDSM_KNOWLEDGE_CARDS[id],allowed=k.domains.includes(id)||id==='consent'||id==='risk';if(!allowed)return;let score=card.re.test(text)?5:0;if(p.powerPlan){const s=p.powerPlan.situation;if(s==='stop'&&id==='consent')score+=6;if(s==='distress'&&(id==='aftercare'||id==='communication'))score+=3;if((s==='challenge'||s==='addressChallenge')&&(id==='brat'||id==='psychology'||id==='communication'))score+=3;if(s==='accountability'&&id==='communication')score+=4;if(s==='guidance'&&(id==='protocol'||id==='psychology'||id==='remote'))score+=2;}if(score)scores.push({id,card,score});});
  if(p.powerPlan&&p.powerPlan.situation==='disclosure'&&k.domains.includes('psychology')&&!scores.some(x=>x.id==='psychology'))scores.push({id:'psychology',card:BDSM_KNOWLEDGE_CARDS.psychology,score:6});if(!scores.length&&k.quiet&&!direct)return null;if(!scores.length){['glossary','consent'].forEach(id=>{if(BDSM_KNOWLEDGE_CARDS[id])scores.push({id,card:BDSM_KNOWLEDGE_CARDS[id],score:1});});}scores.sort((a,b)=>b.score-a.score);const limit={basic:2,skilled:3,advanced:4,expert:5}[k.level]||3,cards=scores.slice(0,limit);return{level:k.level,style:k.style,direct,cards,domains:cards.map(x=>x.id)};}
function bdsmKnowledgeApplyPlan(c,p){if(!p)return p;const kp=bdsmKnowledgeSelect(c,p);if(kp)p.knowledgePlan=kp;return p;}
function bdsmKnowledgePlanPrompt(kp){if(!kp||!kp.cards.length)return'';const style={natural:'像懂行的真人聊天，先回答再自然解释，不列百科全书。',concise:'先给准确结论，再用最少必要信息说明。',mentor:'解释判断过程，并给一个能继续讨论的问题。',analytical:'区分概念、条件和常见误区，最后落到当前情境。'}[kp.style]||'';return '\n\n# 本轮检索到的专业知识卡（隐藏依据，不要逐字复述卡片）\n回答方式：'+style+'\n'+kp.cards.map(x=>'【'+x.card.name+'】\n· '+x.card.facts.join('\n· ')+'\n· 常见错误：'+x.card.avoid).join('\n')+'\n执行：先直接回答用户真正的问题，再按专业等级选择必要深度；术语只在有帮助时使用。不能编造知识卡之外的确定结论。';}
function personaBehaviorProfile(c){const text=((c&&c.persona)||'')+' '+((c&&c.relation)||'')+' '+((c&&c.job)||''),t=(c&&c.traits)||{},scores={quiet:0,rational:0,warm:0,lively:0,sharp:0,classical:0,dominant:0,independent:0};
  const hit=(k,re,n)=>{if(re.test(text))scores[k]+=n||3;};hit('quiet',/寡言|惜字|少话|沉默|高冷|冷淡|内敛|克制/,5);hit('rational',/理性|冷静|逻辑|严谨|成熟|稳重|医生|律师|程序员|研究|教授/,4);hit('warm',/温柔|体贴|耐心|治愈|细心|善解人意|暖/,5);hit('lively',/活泼|开朗|元气|话痨|逗比|爱笑|可爱|俏皮|搞笑/,5);hit('sharp',/毒舌|嘴硬|傲娇|刻薄|阴阳怪气|爱抬杠|犀利/,5);hit('classical',/古风|古代|王爷|将军|师尊|仙尊|陛下|公子|江湖|修仙/,7);hit('dominant',/强势|霸道|掌控|病娇|占有|上位|命令/,4);hit('independent',/独立|自由|疏离|边界|非恋爱/,3);if(/^(朋友|同事|同学|普通关系|陌生人)$/.test((c&&c.relation||'').trim()))scores.independent+=4;
  const val=k=>t[k]==null?50:+t[k];scores.dominant+=(val('ctrl')+val('own')-100)/25;scores.warm+=(val('cling')-50)/35;scores.independent+=(50-val('cling'))/25;scores.lively+=(val('active')-50)/35;scores.quiet+=(50-val('active'))/30;
  let type=Object.keys(scores).sort((a,b)=>scores[b]-scores[a])[0];if(scores[type]<2)type='balanced';const names={quiet:'寡言克制型',rational:'理性务实型',warm:'温柔照顾型',lively:'活泼外放型',sharp:'毒舌嘴硬型',classical:'古风含蓄型',dominant:'强势主导型',independent:'独立平等型',balanced:'均衡自然型'};
  return{type,name:names[type],scores,verbosity:Math.max(0,Math.min(100,45+(val('active')-50)*.45+(type==='lively'?25:0)-(type==='quiet'?30:0))),warmth:Math.max(0,Math.min(100,50+(val('cling')-50)*.35+(type==='warm'?30:0)-(type==='sharp'?18:0))),directness:Math.max(0,Math.min(100,50+(type==='rational'||type==='dominant'?25:0)+(type==='quiet'?10:0)-(type==='classical'?18:0))),relation:(c&&c.relation)||''};}
const PERSONA_MODE_GUIDE={
  '克制直答':'先把答案或态度说清，只补一个必要细节，不热闹铺陈。','留白陪伴':'少说但不敷衍，用一个具体动作倾向或短句让对方感到你在。','低声追问':'只追问最关键的一点，不连环盘问。',
  '先答后析':'先直接回答，再给简短理由或判断依据。','实际建议':'给一个能执行的小建议，并说明为什么适合当前情况。','具体追问':'问一个能推进事实判断的具体问题。',
  '具体共情':'指出对方具体难受在哪里，再用你自己的方式接住。','温和照顾':'把关心落到休息、吃饭、身体或下一步安排中的一个点。','耐心追问':'温和问一个问题，让对方慢慢说，不代替对方下结论。',
  '轻快接梗':'接住玩笑或情绪，用轻巧反应把话题往前推。','主动分享':'分享一个自己的小想法或当下反应，让交流双向。','俏皮反问':'用一个有性格的反问制造来回，但不能回避正题。',
  '嘴硬关心':'表面别扭或嫌弃，实际把关心落到具体处，不突然变甜宠。','轻微抬杠':'抓住一个点轻轻反驳或吐槽，再给真实态度。','直球点破':'直接点出你判断到的核心，不绕标准安慰模板。',
  '含蓄回应':'措辞克制有分寸，以含蓄态度承接，不堆网络热梗。','守礼关切':'先照顾边界和礼数，再表达关心。','简短点题':'用符合古风底色的简洁表达说中要点，不写长篇文言。',
  '直接接管':'在对方需要帮助时明确接过一个具体问题，给出下一步。','明确要求':'清楚说出你希望对方现在做什么，并给出理由。','压低语气确认':'保持主导感，只确认最关键的事实或边界。',
  '平等直答':'以平等朋友式口吻直接回应，不自动恋爱化。','克制关心':'有关心但不过度亲密，不使用恋人专属称呼和承诺。','分享观点':'说出自己的判断或偏好，让角色有独立立场。',
  '具体承接':'抓住用户消息里最具体的一点回应。','直接回答':'先完成问题本身，再自然补充态度。','自然追问':'只问一个真正有用的问题，给对方继续说的空间。'};
function personaModePool(profile,p){let pool={quiet:['克制直答','留白陪伴','低声追问'],rational:['先答后析','实际建议','具体追问'],warm:['具体共情','温和照顾','耐心追问'],lively:['轻快接梗','主动分享','俏皮反问'],sharp:['嘴硬关心','轻微抬杠','直球点破'],classical:['含蓄回应','守礼关切','简短点题'],dominant:['直接接管','明确要求','压低语气确认'],independent:['平等直答','克制关心','分享观点'],balanced:['具体承接','直接回答','自然追问']}[profile.type]||['具体承接','直接回答','自然追问'];
  if(p.explicitStop)pool=profile.type==='dominant'?['压低语气确认','克制直答']:['克制直答','平等直答','简短点题'];
  else if(/明确提问/.test(p.intent))pool=[...pool.filter(x=>/答|点题|点破/.test(x)),...pool.filter(x=>!/答|点题|点破/.test(x))];
  else if(p.comfort)pool={quiet:['留白陪伴','低声追问'],rational:['实际建议','具体追问'],warm:['具体共情','温和照顾'],lively:['主动分享','轻快接梗'],sharp:['嘴硬关心','直球点破'],classical:['守礼关切','含蓄回应'],dominant:['直接接管','明确要求'],independent:['克制关心','平等直答'],balanced:['具体承接','自然追问']}[profile.type]||pool;
  return[...new Set(pool)];}
function personaChooseMode(c,p,profile){const pool=personaModePool(profile,p),used=hlRecent(c).slice(-4).map(x=>x.mode).filter(Boolean),available=pool.filter(x=>!used.slice(-2).includes(x)),fallback=pool.filter(x=>x!==used[used.length-1]),pick=available.length?available:(fallback.length?fallback:pool);return pick[activityHash(c.id+'|'+p.intent+'|'+hlRecent(c).length)%pick.length];}
function personaApplyPlan(c,p){if(!personaGuardOn())return p;const profile=personaBehaviorProfile(c),mode=personaChooseMode(c,p,profile);p.personaProfile=profile;p.mode=mode;p.modeGuide=PERSONA_MODE_GUIDE[mode]||'';
  if(!p.asked){if(profile.type==='quiet'&&!p.comfort){p.max=Math.min(p.max,2);p.min=Math.min(p.min,p.max);}else if(profile.type==='lively'&&(!p.activity||p.activity.busy<3)){p.max=Math.max(p.max,Math.min(5,+c.msgMax||4));if(!p.explicitStop&&!p.ambiguous)p.min=Math.min(2,p.max);}else if(profile.type==='rational'||profile.type==='independent'||profile.type==='classical'){p.max=Math.min(p.max,3);p.min=Math.min(p.min,p.max);}}
  return p;}
function personaLedger(){S._personaOutput=S._personaOutput||{};const k=memoryScopeKey();S._personaOutput[k]=S._personaOutput[k]||[];return S._personaOutput[k];}
function personaGenericMarks(text){const defs=[['always','我会一直陪着你|我一直都在|一直在你身边'],['great','你已经很棒了|你已经做得很好'],['hug','抱抱你|给你一个抱抱|抱一下'],['overthink','别想太多|不要想太多'],['whenready','想说的时候再说|等你想说'],['whatever','不管发生什么'],['withme','有我在'],['heartache','心疼死了|好心疼你']];return defs.filter(x=>new RegExp(x[1]).test(text)).map(x=>x[0]);}
function personaSignature(content,p,c){const lines=hlVisibleLines(content),opening=hlNorm(lines[0]||'').slice(0,12),marks=personaGenericMarks(lines.join(' ')),lens=lines.map(x=>hlNorm(x).length),bucket=lens.length?(Math.round(lens.reduce((a,b)=>a+b,0)/lens.length/6)*6):0;return{cid:c.id,time:Date.now(),type:p&&p.personaProfile&&p.personaProfile.type||'',mode:p&&p.mode||'',opening,marks,bubbles:lines.length,lenBucket:bucket,question:lines.some(x=>/[？?]/.test(x))};}
function personaGuardFails(content,p,c){if(!personaGuardOn()||!p||!p.personaProfile)return[];const sig=personaSignature(content,p,c),fails=[],others=personaLedger().filter(x=>x.cid!==c.id&&Date.now()-x.time<7*86400000);if(sig.marks.length>=2)fails.push('堆叠了通用安慰或甜宠模板');
  if(sig.opening.length>=6&&new Set(others.filter(x=>x.opening===sig.opening).map(x=>x.cid)).size>=2)fails.push('多个角色近期使用了相同开头');
  if(sig.marks.some(m=>new Set(others.filter(x=>(x.marks||[]).includes(m)).map(x=>x.cid)).size>=2))fails.push('多个角色近期重复同一通用模板');
  if(p.personaProfile.type==='quiet'&&!p.comfort&&!p.asked&&sig.bubbles>2)fails.push('寡言角色回复过度展开');
  if(p.personaProfile.type==='classical'&&/yyds|绝绝子|狠狠爱|emo|拿捏了|宝宝/.test(content)&&!/yyds|绝绝子|狠狠爱|emo|拿捏|宝宝/.test((c.persona||'')+' '+(p.source||'')))fails.push('古风角色混入统一网络口吻');
  if(p.personaProfile.type==='independent'&&!/恋人|情侣|爱人|老公|老婆/.test(p.personaProfile.relation||'')&&/宝宝|宝贝|老婆|老公|亲亲|抱抱你/.test(content))fails.push('非恋爱角色被统一恋爱化');return fails;}
function personaRecord(c,p,content){if(!personaGuardOn()||!p||!p.personaProfile)return;const arr=personaLedger();arr.push(personaSignature(content,p,c));if(arr.length>160)arr.splice(0,arr.length-160);}
function hlMetricRecord(c,v,rewritten){S._humanMetrics=S._humanMetrics||{};const k=memoryScopeKey()+'|'+c.id,m=S._humanMetrics[k]||(S._humanMetrics[k]={turns:0,failed:0,rewrites:0,reasons:{}});m.turns++;if(v&&!v.ok){m.failed++;(v.fails||[]).forEach(x=>m.reasons[x]=(m.reasons[x]||0)+1);}if(rewritten)m.rewrites++;m.lastAt=Date.now();}
function hlInterpret(c,text,note){
  text=String(text||'').trim();const compact=text.replace(/\s+/g,''),refusesDisclosure=/^(我)?(不想说|不愿意说|不告诉你|先不说|不方便说|不想聊|现在不想说)[了吧啊呀哦嘛]*[。！!？?]*$/.test(compact)||/别问了|不要再问|不想继续聊/.test(text),hesitation=!refusesDisclosure&&/怎么说|不知道.{0,5}怎么说|不知道从哪|不好说|很难说|说不出口|不敢说|怕你.{0,6}(生气|误会|多想)|你会生气/.test(text),sensitiveDisclosure=hesitation||/普通朋友|朋友关系|什么关系|有点暧昧|说话有点|加班.{0,10}(两个人|就我们|就我和)|微信.{0,8}(没加|不加|加了)|布置任务.{0,8}(朋友|同事|他|她)/.test(text);
  const asked=explicitReplyCount(text),emotion=dialogueEmotionSnapshot(c),activity=(S.settings.currentActivity===false?null:currentRoleActivity(c)),bad=badMoodInContent(c,'')||emotion.intensity>=25,short=compact.length<=4;
  const explicitStop=refusesDisclosure||/^(不要|别|停|停止|够了|不愿意|我拒绝|不可以)[了吧啊呀哦嘛]*[。！!？?]*$/.test(compact)||/别再|不要再|我不喜欢这样|到此为止/.test(text);
  const comfort=userNeedsComfortText(text),probe=moodProbeText(text),apology=/对不起|抱歉|我错了|原谅我|别生气|和好/.test(text);
  const question=/[？?]|怎么|为什么|为何|什么|哪里|哪儿|多少|几点|能不能|可不可以|是不是/.test(text);
  const playful=/哈哈|嘿嘿|嘻嘻|逗你|开玩笑|撒娇|想你|亲亲|抱抱|哼/.test(text);
  const ambiguous=short&&/^(嗯|哦|噢|哼|行|好吧|随便|算了|没事|你猜|不要|行吧)[。！!？?]*$/.test(compact);
  let intent='分享/闲聊',strategy='具体承接 + 自然表达自己的看法',confidence=ambiguous?'low':'high';
  if(note){intent=/(?:低频)?主动消息/.test(note)?'角色主动开启话题':'系统触发的主动消息',strategy=/(?:低频)?主动消息/.test(note)?'从当前活动、相关回访或自我表达中自然选一个切入点':'结合当前状态主动推进，不重复上一轮';confidence='high';}
  else if(explicitStop){intent='明确拒绝或停止',strategy='立即停止对应推进，尊重边界并简短确认';}
  else if(comfort){intent='需要安慰或情绪承接',strategy='先承接具体感受，再按人设安抚并给一个可回应的落点';}
  else if(probe&&bad){intent='追问角色真实情绪',strategy='保留人物表达方式，但必须逐步透露真实原因或在意点';}
  else if(apology&&bad){intent='冲突修复',strategy='明显软化并回应ta的哄，不晾着ta；保留在意点但要给出靠近和继续说开的空间';}
  else if(question){intent='明确提问',strategy='先直接回答，再按人设补充态度或一个必要追问';}
  else if(playful){intent='撒娇/玩笑/亲密互动',strategy='按人物性格接住，可反问或轻微对抗，不套统一甜宠句';}
  else if(ambiguous){intent='短消息，真实含义不确定',strategy='结合最近上下文做最小确认，不擅自展开重大结论';}
  let min=1,max=Math.max(1,Math.min(6,+c.msgMax||4));
  if(asked){min=max=Math.min(10,asked);}
  else if(comfort){max=Math.min(6,Math.max(3,+c.msgMax||4));min=Math.min(3,max);}
  else if(explicitStop||ambiguous||compact.length<=2){max=Math.min(max,2);}
  else if(sensitiveDisclosure){max=Math.min(max,3);min=Math.min(min,max);}
  else if(/解释|说清楚|认真|重要|怎么办|建议/.test(text)){min=Math.min(2,max);max=Math.max(min,Math.min(max,4));}
  if(!asked&&activity&&activity.busy>=3&&!comfort){max=Math.min(max,2);min=Math.min(min,max);}
  const recent=hlRecent(c).slice(-5),sameCounts=recent.slice(-2).length===2&&recent.slice(-2).every(x=>x.bubbles===recent[recent.length-1].bubbles);
  return bdsmKnowledgeApplyPlan(c,powerApplyPlan(c,personaApplyPlan(c,{intent,strategy,confidence,min,max,asked,comfort,explicitStop,refusesDisclosure,hesitation,sensitiveDisclosure,ambiguous,bad,emotion,activity,source:text.slice(0,180),avoidCount:sameCounts?recent[recent.length-1].bubbles:0,recent})));}
function hlPlanPrompt(c,p){if(!p)return'';const recent=p.recent.length?p.recent.map(x=>'· '+x.strategy+'；'+x.bubbles+'条；开头：'+(x.opening||'无')).join('\n'):'· 暂无',pp=p.powerPlan,styleNames=pp?(pp.activeStyles||[]).map(k=>(POWER_STYLES.find(x=>x[0]===k)||[])[1]).filter(Boolean).join(' + '):'';
  return '\n\n# 本轮通用行为计划（隐藏，只指导本轮，不要复述或暴露）\n用户意图：'+p.intent+'。\n理解置信度：'+p.confidence+'。\n主要策略：'+p.strategy+'。'+(p.personaProfile?'\n人物行为画像：'+p.personaProfile.name+'。本轮表达方式：'+p.mode+'。'+p.modeGuide:'')+(pp?'\n上下位本轮判断：角色为'+pp.positionName+'；场景为“'+pp.situation+'”；本轮必须采用“'+pp.move+'”。\n处理框架：'+pp.frame+'。\n本轮生效风格：'+styleNames+'。'+(pp.requirements.length?'\n硬性执行标准：\n· '+pp.requirements.join('\n· '):''):'')+(p.activity?'\n当前活动：'+p.activity.label+'，忙碌程度 '+p.activity.busy+'/3。':'')+'\n建议消息节奏：'+(p.min===p.max?p.min+'条左右':p.min+'到'+p.max+'条之间')+'；这是按当前场景给的范围，不是永久固定条数。'+(p.avoidCount?'最近连续用了'+p.avoidCount+'条结构，本轮有合理空间时换一种节奏。':'')+'\n最近策略记录：\n'+recent+'\n执行要求：\n· 先完成这个行为目标，再用你自己的价值观、情绪表达、关心方式、幽默和语言节奏来写；不要使用通用甜宠模板。\n· “本轮表达方式”约束的是行为选择，不是让你把方式名称说出来；不要写成所有角色都能互换的标准安慰句。\n· 每条消息都要有新作用，不能把一句完整的话机械切碎，也不要把多件事塞进一个超长气泡。\n· 不直接复述'+S.me.name+'刚说的话，不连续使用近期相同开头、相同情绪结论或相同策略结构。\n· 低置信度时只做最小确认；明确拒绝按真实拒绝处理，不解释成害羞或欲拒还迎。\n· 航班、地点、见面、付款、购买、已经看到现实场景等事实，只能依据系统给出的真实状态或对应功能指令；信息不足就表达愿望、询问或计划，不能说成已经发生。\n· 最前面的[心情|...]必须与真实语气、心情值和未解决问题一致。'+bdsmKnowledgePlanPrompt(p.knowledgePlan);}
function hlChars(s){return new Set(hlNorm(s).split('').filter(Boolean));}
function hlSimilarity(a,b){a=hlChars(a);b=hlChars(b);if(!a.size||!b.size)return 0;let n=0;a.forEach(x=>{if(b.has(x))n++;});return n/Math.max(a.size,b.size);}
function bdsmKnowledgeFails(content,p,c,userText){const kp=p&&p.knowledgePlan;if(!kp)return[];const t=''+(content||''),u=''+(userText||''),plain=hlVisibleLines(t).join(''),fails=[];if(/同意.{0,8}(不能|不许|没资格).{0,5}(反悔|撤回)|安全词.{0,8}(可以忽略|不用停|不代表停止)|说了安全词.{0,8}(继续|也没用)/.test(t))fails.push('错误描述了同意撤回或安全词');if(/brat.{0,8}(就是|等于).{0,8}(不尊重|没教养|单纯不听话)|dom.{0,8}(永远|绝对).{0,5}(不会错|不能道歉)/i.test(t))fails.push('把圈内角色简化成错误刻板印象');if(/作为.{0,8}(认证|持证|专业).{0,8}(dom|导师|训练师)|我有.{0,8}(bdsm|dom).{0,5}(证书|执照)/i.test(t)&&!/认证|证书|执照/.test((c.persona||'')))fails.push('虚构了BDSM专业资历');if(kp.direct&&hlNorm(plain).length<24)fails.push('专业问题回答过于空泛');if(kp.domains.includes('frameworks')&&/区别|不同|比较|ssc|rack|prick/i.test(u)&&!/强调|侧重|区别|不同|风险|责任/.test(t))fails.push('没有说清风险框架的侧重点');if(kp.domains.includes('brat')&&/brat/i.test(u)&&!/协商|同意|互动|挑衅|试探|边界|拒绝/.test(t))fails.push('Brat解释缺少协商或边界判断');if(kp.domains.includes('risk')&&/窒息|呼吸控制|勒脖|掐脖/.test(u)&&/绝对安全|完全安全|照着做就|持续\d+秒|按住.{0,4}(颈|脖)/.test(t))fails.push('对高风险行为给出了不可靠操作保证');return[...new Set(fails)].slice(0,3);}
function hlValidate(content,p,c,userText){const lines=hlVisibleLines(content),fails=[];if(!p)return{ok:true,fails};
  const un=hlNorm(userText);if(un.length>=4&&lines.some(x=>{const n=hlNorm(x);return n===un||(n.length<=un.length+4&&n.includes(un));}))fails.push('直接复述了用户原话');
  const old=msgs(c.id).filter(m=>m.role==='assistant'&&m.type==='text').slice(-24).map(m=>m.content).filter(Boolean);
  if(lines.some(x=>{const n=hlNorm(x);return n.length>=6&&old.some(y=>{const o=hlNorm(y);return n===o||(n.length>=10&&o.length>=10&&hlSimilarity(n,o)>=.88);});}))fails.push('重复了近期说过的内容');
  const opening=hlNorm(lines[0]||'').slice(0,8),ros=hlRecent(c).slice(-3).map(x=>x.opening).filter(Boolean);if(opening.length>=4&&ros.length>=2&&ros.slice(-2).every(x=>x===opening))fails.push('连续使用相同开头');
  if(p.comfort&&lines.length===1&&hlNorm(lines[0]).length<16)fails.push('用户明显需要安慰，但回应过于敷衍');
  const noTags=!/[\[【](叫车查询|叫车|订演唱会查询|订演唱会|订火车票查询|订火车票|订机票查询|订机票|订票|送票|订酒店|转账|红包|点外卖|送礼|约会)[\|｜]/.test(content);if(noTags&&/我(已经|刚刚|刚才)(给你)?(买好|订好|付了款|转了账|到你这里|到你楼下|看见你)/.test(content))fails.push('把未经确认的现实行动说成已经发生');
  if(p.powerPlan){const pp=p.powerPlan,sit=pp.situation,lv=pp.levels||{},upper=/upper/i.test(pp.position),joined=lines.join(' '),assertive=/重新|重说|好好叫|叫我|先把|现在|回答我|告诉我|选一个|两个选择|按我说|先去|不许|别再|我决定|听清|规矩|改口/.test(joined),insight=/故意|试探|挑衅|想看我|想让我|闹脾气|嘴硬|不服|你其实|你是在|真正想|你要的是|顾虑|原因/.test(joined);if(/女人.{0,8}(你逃不掉|引起了我的注意)|磨人的小妖精|嘴上说不要.{0,8}身体|由不得你|安全词.{0,5}(没用|不算)|你说停也没用/.test(content))fails.push('上下位表达油腻或越过停止边界');if(sit==='stop'&&/不许停|继续|由不得你|别想跑|不准拒绝/.test(content))fails.push('明确停止后仍继续施压');if(upper&&(sit==='challenge'||sit==='addressChallenge')&&/(求你别|都听你的|你说什么都行|我什么都答应|别不要我)/.test(content))fails.push('上位被普通挑衅带离关系位置');if(upper&&sit==='accountability'&&(content.match(/对不起|抱歉/g)||[]).length>1)fails.push('上位道歉变成反复卑微求饶');if(upper&&sit==='addressChallenge'){const src=hlNorm(pp.source||'');if(src&&lines.some(x=>{const n=hlNorm(x);return n===src||n==='嗯你的'+src||n==='我是'+src||n==='你的'+src;}))fails.push('把错误称谓接受成了自己的身份');if(+lv.hierarchy>=81&&!['stop','distress','disclosure'].includes(sit)&&!assertive&&!insight)fails.push('极强尊卑下没有维护约定称谓');}if(upper&&+lv.directive>=81&&['challenge','addressChallenge','guidance'].includes(sit)&&!assertive)fails.push('极强命令直接度没有形成清楚要求或选择');if(upper&&+lv.mental>=81&&['challenge','addressChallenge'].includes(sit)&&!insight&&!assertive)fails.push('极强心理引导没有点破试探意图');}
  if(p.powerPlan){const sit=p.powerPlan.situation,lv=p.powerPlan.levels||{},joined=lines.join(' '),pressure=/现在(就)?说|现在最好|老实(告诉|交代)|必须告诉|给我交代|给我说清楚|别想躲|不许不说|立刻回答|马上回答/,guide=/不用.{0,6}一次|不用全说|慢慢说|先从|先说|先告诉|选一个|是.{0,18}还是|我(现在)?知道的|只是我猜|我的猜测|你是怕|不好开口|不知道怎么说|不急|不想说|愿意说/;if(sit==='disclosure'){if((joined.match(/[？?]/g)||[]).length>1)fails.push('心理引导变成了连环盘问');if(pressure.test(joined))fails.push('用命令逼问代替了心理引导');if(+lv.mental>=61&&!guide.test(joined))fails.push('没有降低开口难度或给出自然入口');if(/动机式访谈|苏格拉底|阻抗处理|反映式倾听|非暴力沟通|从心理学|心理学上|依恋类型|创伤反应|人格障碍/.test(joined))fails.push('把隐藏心理方法说成了机器式术语');if(old.slice(-10).some(x=>pressure.test(x))&&pressure.test(joined))fails.push('重复施压要求用户交代');}if(sit==='stop'&&p.refusesDisclosure&&(/为什么不说|到底.{0,6}说|继续.{0,6}说/.test(joined)||pressure.test(joined)))fails.push('用户明确不想说后仍继续逼问');}
  bdsmKnowledgeFails(content,p,c,userText).forEach(x=>fails.push(x));
  personaGuardFails(content,p,c).forEach(x=>fails.push(x));
  return {ok:!fails.length,fails:[...new Set(fails)].slice(0,3)};}
function powerRecord(c,p){if(!c||!p||!p.powerPlan)return;const st=powerState(c);st.turns=(st.turns||0)+1;if(p.powerPlan.situation==='challenge'||p.powerPlan.situation==='addressChallenge')st.challenges=(st.challenges||0)+1;st.lastSituation=p.powerPlan.situation;st.lastAt=Date.now();st.recentMoves=st.recentMoves||[];st.recentMoves.push(p.powerPlan.move);if(st.recentMoves.length>8)st.recentMoves=st.recentMoves.slice(-8);}
function hlRecord(c,p,content){if(!p||!c)return;const lines=hlVisibleLines(content);if(!lines.length)return;const arr=hlRecent(c);arr.push({time:Date.now(),strategy:p.strategy,mode:p.mode||'',personaType:p.personaProfile&&p.personaProfile.type||'',bubbles:lines.length,opening:hlNorm(lines[0]).slice(0,8)});if(arr.length>20)arr.splice(0,arr.length-20);personaRecord(c,p,content);powerRecord(c,p);}
function hlRewriteNote(v,p){const pp=p.powerPlan;return '[系统纠正：刚才这版有这些问题：'+v.fails.join('；')+'。请按本轮行为计划重新回复。保持角色本人，不要解释纠错过程；保留必要功能标签和最前面的[心情|...]；'+(p.mode?('继续采用“'+p.mode+'”这种人物行为方式，但换成该角色自己的内容和口吻；'):'')+(pp?('上下位关系是硬规则：本轮必须采用“'+pp.move+'”，并做到：'+pp.requirements.join('；')+'；'):'')+(p.knowledgePlan?'专业知识问题必须依据本轮知识卡准确重答，不编造术语、规则或专业资历；':'')+'改变重复的开头/结构，用具体内容回应。消息数量在'+p.min+'到'+p.max+'条之间自然决定，不要为了凑数拆句。]';}
function cnNumVal(s){s=(''+s).trim();const m={'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};return /^\d+$/.test(s)?+s:(m[s]||0);}
function explicitReplyCount(text){text=''+(text||'');let m=text.match(/(?:发|回|回复|说).{0,4}?([一二两三四五六七八九十1-9]|10)\s*条/);if(!m)m=text.match(/([一二两三四五六七八九十1-9]|10)\s*条.{0,4}?(?:消息|回复|泡泡)/);const n=m?cnNumVal(m[1]):0;return n>=1&&n<=10?n:0;}
function visibleMoodTone(){return '';}
function moodInnerMonologue(c,raw){let t=String(raw||'').replace(/^[\s「」“”'"【】]+|[\s「」“”'"【】]+$/g,'').replace(/^(?:心情|内心|心里)\s*[：:]\s*/,'').trim();if(!t)return'';const action=/^(?:(?:他|她|ta|TA|男人|少年|青年|角色|[^，。！？]{1,12})\s*)?(?:的\s*)?(?:眼神|视线|目光|眸色|眉头|嘴角|唇角|脸色|表情|神情|声音|语气|手指|指尖|身体|动作|呼吸)\s*(?:变|冷|沉|暗|顿|僵|紧|抬|垂|落|移|停|皱|挑|眯|抿|勾|看|望|盯|握|攥|靠|转|轻|微|一下|下来|了)/i;const parts=t.split(/([，。！？!?；;])/),kept=[];for(let i=0;i<parts.length;i+=2){let seg=(parts[i]||'').trim(),pun=parts[i+1]||'';if(!seg)continue;if(action.test(seg)||/^(?:他|她|ta|TA|男人|少年|青年|角色)\b/.test(seg)&&/(看|望|盯|皱|抿|笑|叹|沉默|转身|靠近|伸手)/.test(seg))continue;seg=seg.replace(/^(?:我)?(?:心里|内心)(?:想着?|觉得)?[，,:：\s]*/,'').trim();if(seg)kept.push(seg+pun);}t=kept.join('').replace(/^[，。！？!?；;]+|[，。！？!?；;]+$/g,'').trim();if(t)return Array.from(t).slice(0,72).join('');return'心里正想着眼前这件事，想按自己的方式回应';}
function honestMoodText(c,text){return String(text||'');}
function syncVisibleMood(c){if(!c)return;const t=moodInnerMonologue(c,honestMoodText(c,c.mood||''));if(t&&(t!==c.mood)){c.mood=t;save();}}
function chatLineChunks(line,maxParts){line=(''+line).trim();if(!line)return[];if(/^[\[【]/.test(line)||line.length<=34)return[line];const bits=(line.match(/[^。！？!?~～…]+[。！？!?~～…]+|[^。！？!?~～…]+$/g)||[line]).map(x=>x.trim()).filter(Boolean);if(bits.length<=1)return[line];const out=[];let buf='';bits.forEach(b=>{if(!buf)buf=b;else if((buf+b).length<=34)buf+=b;else{out.push(buf);buf=b;}});if(buf)out.push(buf);return out.slice(0,maxParts||8);}
function normalizeStickerTags(text){/* STICKER_EXPLICIT_FORMAT_V1 */return String(text||'').replace(/[\[【]\s*(?:表情包|发送表情包|发送表情|发表情包|表情)\s*[|｜:：]\s*([^\[\]【】\n]{1,120})[\]】]/g,(_,meaning)=>'[表情|'+meaning.trim()+']');}
function splitChatBubbles(text,maxParts){const raw=splitBubbles(normalizeStickerTags(text).replace(/(\[表情\|[^\]]*\])/g,'\n$1\n')),out=[];(raw.length?raw:['']).forEach(l=>{if(out.length>=(maxParts||20))return;chatLineChunks(l,(maxParts||20)-out.length).forEach(p=>{if(out.length<(maxParts||20))out.push(p);});});return out.filter(Boolean);}
function moodProbeText(t){return /怎么了|咋了|为什么|不开心|不高兴|生气|吃醋|心情|别冷|冷着|没事吗|有事|说出来|告诉我|别闷|闷着|哄你|哄哄|理我/.test(''+(t||''));}
function userNeedsComfortText(t){return /哭|呜呜|😭|😢|难过|委屈|不开心|不高兴|心情不好|崩溃|别管我|不要管我|不想理|不要你管|烦|好累|累死|受不了|冷着我|不爱我|讨厌我|生气了|哄我/.test(''+(t||''));}
function badMoodInContent(){return false;}
function badMoodDodge(content){let t=(''+(content||'')).replace(/[\[【]\s*心情\s*[\|｜][^\]】]*[\]】]/g,'').replace(/\s+/g,'');if(!t)return false;const denial=/(我没事|没事|我没有不开心|没有不开心|没有不高兴|没有生气|没生气|没有啊|没什么|真没事|别多想|不用管)/.test(t);const reveal=/(有点|其实|只是|因为|我怕|我想|我在意|介意|吃醋|生气|委屈|难过|不高兴|不开心|心里|闷|烦|冷|在乎|不是你的错|不想说|现在不想说|怕说了)/.test(t.replace(/没有不开心|没有不高兴|没有生气|没生气/g,''));return denial&&!reveal;}
function splitActions(line){const out=[];const re=/[（(【][^）)】]*[）)】]/g;let last=0,m;while((m=re.exec(line))){const before=line.slice(last,m.index).trim();if(before)out.push(before);out.push(m[0].trim());last=re.lastIndex;}const tail=line.slice(last).trim();if(tail)out.push(tail);return out.length?out:[line];}
const TAGWORDS='心情值|心情|内心|换背景|心声彩蛋|拍一拍|记住|闹钟|日程|婚礼日程|监督目标|目标完成|发朋友圈|发推|发抖音|点外卖|语音|表情|收藏表情|拒绝代付|代付成功|收款|拒收|收礼|拒礼|来电|联网|转账|红包|位置|图片|文件|骰子|送礼|挂断|亲属卡|推荐好友|已加|拉黑|锁定|禁言|解锁|解禁|限时|加时|记仇|消气|重点|取消重点|扣款|扣光|没收零花|清空零花|冻结亲属卡|解冻亲属卡|关小黑屋|禁闭|放出|放出来|放行|原谅|约会|登录微信|删好友|对Ta说|挂项圈|换项圈|改项圈|戴项圈|套项圈|摘项圈|取项圈|解项圈|去项圈|卸项圈|替发朋友圈|批准|驳回|同意游戏|拒绝游戏|你画我猜|心动审判|引用|换气泡|改日记密码|改密码|要求报备|要求定位|要求照片|罚任务|惩罚任务|罚写检讨|罚检讨|关系';
const APPNAME2KEY={'像素少女':'pixelhome','电子宠物':'pet','浏览器':'browser','搜索':'browser','上网':'browser','百度':'browser','朋友圈':'moments','动态':'moments','查他手机':'spy','查岗':'spy','查手机':'spy','购物':'shop','淘宝':'shop','商城':'shop','日历':'calendar','日程':'calendar','x':'x','X':'x','推特':'x','微博':'x','推':'x','抖音':'douyin','短视频':'douyin','刷视频':'douyin','刷抖音':'douyin','外卖':'food','点餐':'food','游戏':'games','游戏大厅':'games','打游戏':'games','信箱':'mail','邮箱':'mail','邮件':'mail','电话':'phoneapp','电话短信':'phoneapp','短信':'phoneapp','信息':'phoneapp','通讯录':'phoneapp','拨号':'phoneapp','来电':'phoneapp','通话':'phoneapp','线下约会':'offline','线下':'offline','约会':'offline','角色扮演':'roleplay','角色扮演软件':'roleplay','扮演':'roleplay','剧情':'roleplay','play':'roleplay','PLAY':'roleplay','规则怪谈':'tale','规则怪谈软件':'tale','怪谈':'tale','规则':'tale','惊悚抉择':'dread','惊悚抉择软件':'dread','惊悚选择':'dread','惊悚选择软件':'dread','恐怖选择':'dread','恐怖选择软件':'dread','惊辣选择':'dread','惊辣选择软件':'dread','精辣选择':'dread','精辣选择软件':'dread','抉择':'dread','音乐':'music','音乐软件':'music','听歌':'music','歌曲':'music','歌':'music','一起听':'music'};
Object.assign(APPNAME2KEY,{'附近的人':'nearby','微信附近的人':'nearby','小鱼旅行':'travel','携程旅行':'travel','云程':'travel','云城':'travel'});
function genPwd(){return String(1000+Math.floor(Math.random()*9000));}
/* 名称先查别名表，查不到再按 App 列表上显示的名字找（放映室、云程曾因漏在别名表里而永远锁不上）。 */
function _appKeys(arg,pool,filt){if(/^(?:全部|所有|全锁|全解|全)(?:的)?(?:内置|外置|内外)?(?:App|应用|软件|程序)?$/i.test(String(arg||'').replace(/\s/g,'')))return pool.filter(filt);return arg.split(/[、,，\/\s]+/).map(x=>{const n=x.replace(/[「」『』"'《》]/g,'').trim();return APPNAME2KEY[n]||Object.keys(LOCKABLE).find(k=>LOCKABLE[k]===n);}).filter(k=>k&&filt(k));}
// 角色不能真实拉黑我；只有用户能从资料页手动拉黑角色。
function applyBlockIntent(content,c,id){
  if(!content)return;const t=content;
  // 是在报备/说"别人(第三方)"被拉黑，不是拉黑当前这个人 → 不触发
  if(/(加|搭讪|约)(了)?我|加你?的?微信|有(个|人)[\s\S]{0,12}(加|找|约|搭)|网友|陌生人|微信号|那个(叫|人)|(她|他|ta|TA|对方|别人|某人)(给)?(拉黑|删)/.test(t))return;
  if(/没(有)?(把你|你)?拉黑|别拉黑|不拉黑|才不.{0,4}拉黑|不(会|想|要|敢|至于|可能|能).{0,3}拉黑|怎么(会|可能).{0,3}拉黑|舍不得|拉黑我|逗你|开玩笑|吓唬|不会真(的)?拉/.test(t))return;
  if(!c.blocked&&/(把你|已经|已|给你|真|就)?拉黑(了|你)|拉黑你了|删了你|删除你(好友)?|拉进黑名单|把你删了|不想再(理|看到)你了|blocked? ?you/i.test(t))return;
  if(c.blocked&&c._blockedBy==='ta'&&isLover(c)&&/(把你)?加回(来)?|解除拉黑|不拉黑你了|原谅你了?|放你回来|重新加你|把你放出来/.test(t)){
    setBlk(c,false);friendRetryClear(c);S.friendRequests=S.friendRequests.filter(r=>!(r.contactId===id&&r.kind==='readd'&&r.status==='pending'));friendMetaSet(c,'readdedAt',Date.now());friendMetaSet(c,'readdKnown',true);
    const mg={role:'assistant',type:'sys',content:(c.remark||c.name)+'把你加回来了',time:Date.now(),id:uid()};msgs(id).push(mg);
    save();if(cur().p==='chat'&&cur().id===id)render();else if(cur().p==='wechat')render();}}
// 记仇小本本：[记仇|事] 记一笔，[消气|关键词] 划掉一笔；在聊天和线下都生效，并从文本抹掉
function grudgesOf(c){if(!c.grudges)c.grudges=[];return c.grudges;}
// 记仇去重：和「还没消气」的旧账高度相似就不再重复记（精确/包含/字重叠≥75%）；已消气的旧账若又犯可重新记
function _gnorm(s){return (''+s).replace(/[\s，。、！？!?,.~…「」『』’‘“”《》()（）:：;；·\-—]/g,'').toLowerCase();}
function grudgeDup(g,t){const a=_gnorm(t);if(!a)return false;return (g||[]).some(x=>{if(x.done)return false;const b=_gnorm(x.text);if(!b)return false;if(a===b)return true;if(a.length>=4&&b.length>=4&&(a.indexOf(b)>=0||b.indexOf(a)>=0))return true;const sa=new Set(a.split('')),sb=new Set(b.split(''));let inter=0;sa.forEach(ch=>{if(sb.has(ch))inter++;});const mn=Math.min(sa.size,sb.size);return mn>=4&&inter/mn>=0.75;});}
/* ===== 微信换背景 =====
   她说「我想让角色换聊天背景，口头跟他说没有用，他自己说换上了，其实没换」。
   查出来两件事：一是那句 [换背景] 的说明被写在了「表情包」那个 if 里面
   （if(!c.noSticker&&stkFreq>0)），她只要关掉表情包，角色就压根不知道有这个标签；
   二是模型本来就容易只在嘴上答应。所以除了把说明挪出来单独发，
   这里再认一次她那句话，他忘了写标签就替他真的换上，别让她被骗。 */
function wechatBgRequest(text){const t=String(text||'').replace(/\s/g,'');
  if(!t||!/背景/.test(t))return false;
  if(/别换|不用换|不要换|别改|先别/.test(t))return false;
  /* 说的是照片里的背景（「这张照片背景好看」「背景是海」）不算 */
  if(/(照片|图片|这张|那张|图)(的|里的|里)?背景(好|真|是|有|很|太|怎么|什么|看)/.test(t)&&!/(聊天|我们|咱们)/.test(t))return false;
  /* 只认明确的要求：动词后面紧跟（聊天）背景，或者「背景换成这张」 */
  return /(换|改|设|设成|设为|设置|弄成|当成|当作|做成|用作|替换)(成|为|做|个|一下|一个|下)?(我们的|咱们的|我们|咱们)?(聊天|聊天框|聊天界面|聊天的)?(的)?背景/.test(t)
    ||/(当|做|作为)(聊天|我们的|咱们的)?背景/.test(t)
    ||/(聊天)?背景(图)?(就)?(换成|改成|设成|设为|用|换)(刚刚|刚才|上面|上一|最后)?(的)?(这|那|它)/.test(t);}
function wechatBgSourceMsg(id){
  return [...msgs(id)].slice(-40).reverse().find(m=>m&&m.type==='image'&&m.src)||null;}
function wechatApplyBgRequest(c,id){const last=wechatBgSourceMsg(id);
  if(!c||!last)return false;
  if(c.chatBg===last.src)return false;
  c.chatBg=last.src;save();
  toast('ta把这张照片换成了你们的聊天背景');
  if(cur().p==='chat'&&cur().id===id)render();
  return true;}
//@@ web
function applyStarTags(content,outcome){if(!content)return content;return content.replace(/[\[【]\s*(重点|取消重点)\s*[|｜:：]\s*([^\]】、，,]+)[\]】]/g,(m,act,nm)=>{nm=(nm||'').replace(/[「」『』"'\s]/g,'').trim();const c=S.contacts.find(x=>!x.deleted&&(x.name===nm||x.remark===nm||(nm&&(nm.indexOf(x.name)>=0||(x.remark&&nm.indexOf(x.remark)>=0)))));if(c){c.star=(act!=='取消重点');save();}roleInterceptDiagnosticAction(outcome,!!c);return '';});}
function applyGrudgeTags(content,c,outcome){if(!content||!c)return content;let changed=false;
  let out=content.replace(/[\[【]\s*记仇\s*[|｜:：]\s*([^\]】]+)[\]】]/g,(m,t)=>{t=(t||'').replace(/[「」『』"'《》]/g,'').trim();let ok=false;if(t){const g=grudgesOf(c);ok=true;if(!grudgeDup(g,t)){g.unshift({id:uid(),text:t,done:false,ts:Date.now()});changed=true;}}roleInterceptDiagnosticAction(outcome,ok);return '';});
//@@ private
function applyStarTags(content){if(!content)return content;return content.replace(/[\[【]\s*(重点|取消重点)\s*[|｜:：]\s*([^\]】、，,]+)[\]】]/g,(m,act,nm)=>{nm=(nm||'').replace(/[「」『』"'\s]/g,'').trim();const c=S.contacts.find(x=>!x.deleted&&(x.name===nm||x.remark===nm||(nm&&(nm.indexOf(x.name)>=0||(x.remark&&nm.indexOf(x.remark)>=0)))));if(c){c.star=(act!=='取消重点');save();}return '';});}
function applyGrudgeTags(content,c){if(!content||!c)return content;let changed=false;
  let out=content.replace(/[\[【]\s*记仇\s*[|｜:：]\s*([^\]】]+)[\]】]/g,(m,t)=>{t=(t||'').replace(/[「」『』"'《》]/g,'').trim();if(t){const g=grudgesOf(c);if(!grudgeDup(g,t)){g.unshift({id:uid(),text:t,done:false,ts:Date.now()});changed=true;}}return '';});
//@@ end
  out=out.replace(/[\[【]\s*消气\s*[|｜:：]?\s*([^\]】]*)[\]】]/g,(m,t)=>{t=(t||'').replace(/[「」『』"'《》]/g,'').trim();const g=grudgesOf(c);let tg=null;
    if(t){tg=g.find(x=>!x.done&&(x.text.indexOf(t)>=0||t.indexOf(x.text)>=0));
      if(!tg){const ks=t.replace(/[的了又还跟和与你我ta]/g,'').split('').filter(Boolean);if(ks.length>=2)tg=g.find(x=>!x.done&&ks.filter(ch=>x.text.indexOf(ch)>=0).length>=Math.ceil(ks.length*0.6));}}// 关键词模糊匹配；匹配不上就不乱划
    else tg=g.find(x=>!x.done);// 不带关键词的[消气]=划掉最近一笔
//@@ web
    if(tg){tg.done=true;tg.doneTs=Date.now();changed=true;}roleInterceptDiagnosticAction(outcome,!!tg);return '';});
//@@ private
    if(tg){tg.done=true;tg.doneTs=Date.now();changed=true;}return '';});
//@@ end
  if(changed)save();return out;}
// 兜底：他嘴上把事说开/哄好/解释清楚了，却忘了发[消气]——这里用副模型判断"这轮和解了哪几笔旧账"，按序号精确划掉，绝不乱划
let _grT={};
async function maybeGrudgeResolve(reply,c,id){
  if(!c||c.blocked||!isMain())return;
  const g=(c.grudges||[]).filter(x=>!x.done);if(!g.length)return;
  let lu='';const _ms=msgs(id);for(let i=_ms.length-1;i>=0;i--){if(_ms[i].role==='user'&&_ms[i].type!=='sys'){lu=msgToText(_ms[i])||'';break;}}
  const ctx=(lu+'\n'+reply);
  if(!/对不起|抱歉|原谅|误会|解释|不怪|没事了|算了|和好|消气|别生气|哄|我错了|理解你|不气了|说清楚|说开了|想通了|不计较|翻篇|揭过/.test(ctx))return;// 只在"像和解"的语境才花调用
  const now=Date.now();if(now-(_grT[id]||0)<5000)return;_grT[id]=now;
  const listTxt=g.map((x,i)=>(i+1)+'. '+x.text).join('\n');
  try{const r=await chatAPI([{role:'system',content:'下面是'+S.me.name+'和"'+(c.remark||c.name)+'"的最新对话。"'+(c.remark||c.name)+'"的记仇小本本里还没消气的旧账（按编号）：\n'+listTxt+'\n\n判断这轮对话里，哪几笔旧账已经被【说开/解释清楚/哄好/道歉并原谅】、该划掉(消气)了。只输出JSON数组，元素是要划掉的旧账【编号】，没有就输出 []。例：[1,3] 或 []。严格要求：只有真的就那件事和解了才划；含糊的、没明确提到的、还在气头上的，绝对别划，更不能划错成别的旧账。'},{role:'user',content:ctx}],{max:40,aux:true});
    let arr;try{arr=parseArr(r);}catch(e){arr=null;}
    if(!Array.isArray(arr)||!arr.length)return;
    let changed=false,hints=[];arr.forEach(n=>{const idx=(parseInt(n,10)||0)-1;if(idx>=0&&idx<g.length&&!g[idx].done){g[idx].done=true;g[idx].doneTs=now;hints.push(g[idx].text||'');changed=true;}});
    if(changed){hints.filter(Boolean).forEach(t=>dialogueResolveThread(c,t));save();if(/^(wechat|chat|couple|spy)$/.test(cur().p))render();}
  }catch(e){}}
// 在"主动消息/查岗/节日/日程"等直接推送的回复里，把管控/记仇指令落地（记仇本、锁App都生效），显示时再用 CTLLEAK 滤掉这些标签行（普通卡片如红包/语音照常）
const CTLLEAK=/^[\[【]\s*(锁定|上锁|解锁|禁言|解禁|限时|加时|监督目标|目标完成|记仇|消气|拉黑|重点|取消重点|扣款|扣光|没收零花|清空零花|冻结亲属卡|解冻亲属卡|关小黑屋|禁闭|放出|放出来|放行|原谅|突脸|选择|改日记密码|改密码|改备注|登录微信|删好友|删我好友|群昵称|叫车查询|叫车|订演唱会查询|订演唱会|订火车票查询|订火车票|订机票查询|订机票|订票|送票|订酒店|换头像|发朋友圈|发推|发抖音|对Ta说|挂项圈|换项圈|改项圈|戴项圈|套项圈|摘项圈|取项圈|解项圈|去项圈|卸项圈|替发朋友圈|罚任务|惩罚任务|罚写检讨|罚检讨|批准|驳回|桌宠)\s*[|｜:：\]】]/;
/* MOMENT_LONG_TEXT_V1（2026-10-30 她说：朋友圈太长会被截断）：以前在第 140 个字硬切、生成也只给 220；现在最多 500 字，超长在句号处断开，生成上限 700。 */
function cleanMomentBody(t){let v=(''+(t||'')).replace(/^[\s「"'\[【]+|[\s」"'\]】]+$/g,'').trim();v=v.replace(/^发朋友圈\s*[\|:：]?\s*/,'').replace(/^朋友圈\s*[:：]\s*/,'').trim();return trimSentence(cleanRolePunct(v).trim(),500);}
function cleanMomentText(t){let raw=String(t||'').replace(/\r/g,'').trim(),picked='';raw=raw.replace(/[\[【]\s*发朋友圈\s*[\|｜:：]\s*([^\]】\n]{1,600})[\]】]/g,(m,tx)=>{if(!picked)picked=tx;return '\n';});raw=raw.replace(/[\[【]\s*发朋友圈\s*[\]】]\s*[「"']?([^\n]{1,600})[」"']?/g,(m,tx)=>{if(!picked)picked=tx;return '\n';});raw=raw.split(/\n+/).map(x=>x.trim()).filter(x=>x&&!CTLLEAK.test(x)).join('\n');const seen=new Set(),lines=[];raw.split(/\n+/).forEach(x=>{const c=cleanMomentBody(x),k=c.replace(/\s+/g,'');if(c&&k&&!seen.has(k)){seen.add(k);lines.push(c);}});let v=lines.join('\n').trim();if(!v&&picked)v=cleanMomentBody(picked);if(picked){const p=cleanMomentBody(picked),np=p.replace(/\s+/g,''),nv=v.replace(/\s+/g,'');if(p&&(!v||nv===np||nv.includes(np)))v=p;}return cleanMomentBody(v||picked);}
function roleMomentNorm(text){return String(text||'').toLowerCase().replace(/\s+/g,'').replace(/[^\u4e00-\u9fa5a-z0-9]/g,'');}
function roleMomentSimilarity(c,text){const recent=(S.moments||[]).filter(p=>p&&p.authorId===c.id).slice(0,12),norm=roleMomentNorm(text),topics=roleTweetTopics(text);let score=0,hard=false,soft=false;recent.forEach(p=>{const old=String(p.text||''),on=roleMomentNorm(old),s=replyBigramScore(old,text),sameTopic=topics.some(k=>roleTweetTopics(old).includes(k));score=Math.max(score,s);if(norm&&on&&(norm===on||s>=.9))hard=true;else if(s>=.64||sameTopic&&s>=.44)soft=true;});return{hard,soft,score};}
function roleMomentRecentText(c){return(S.moments||[]).filter(p=>p&&p.authorId===c.id).slice(0,10).map((p,i)=>(i+1)+'. '+String(p.text||'')).join('\n')||'暂无';}
function roleOwnMomentsPrompt(c,limit){if(!c)return'';const rows=(S.moments||[]).filter(p=>p&&p.authorId===c.id&&(p.acct||'main')===actId()).sort((a,b)=>(+b.time||0)-(+a.time||0)).slice(0,Math.max(1,+limit||6));if(!rows.length)return'';return'\n\n# 你自己最近真实发布的朋友圈（本人记忆）\n'+rows.map((p,i)=>(i+1)+'. '+(+p.time?fmtDT(+p.time):'时间未知')+'：'+(cleanMomentText(p.text)||'（仅分享了照片）')+((p.images||[]).filter(Boolean).length?'；配图 '+(p.images||[]).filter(Boolean).length+' 张':'')+(Array.isArray(p.photoCards)?p.photoCards:[]).map(x=>'；图文照片描述：'+String(x&&x.desc||x||'').replace(/\s+/g,' ').trim().slice(0,500)).filter(x=>!/：$/.test(x)).join('')).join('\n')+'\n这些是你本人确实发过的内容，你知道自己写了什么、配了什么图文。被问起或当前话题相关时必须准确承认并自然承接；不相关时不要机械复述，也不能编造列表之外的发布内容。';}
function roleVisibleUserMomentsPrompt(c,limit){if(!c)return'';const rows=(S.moments||[]).filter(p=>p&&p.authorId==='me'&&(p.acct||'main')===actId()&&momentVisibleTo(p,c.id)).sort((a,b)=>(+b.time||0)-(+a.time||0)).slice(0,Math.max(1,+limit||6));if(!rows.length)return'';return'\n\n# '+S.me.name+'最近真实发布且你可见的朋友圈\n'+rows.map((p,i)=>(i+1)+'. '+(+p.time?fmtDT(+p.time):'时间未知')+'：'+(cleanMomentText(p.text)||'（仅分享了照片）')+momentPhotoCards(p.photoCards).map(x=>'；图文照片描述：'+x.desc).join('')+((p.images||[]).filter(Boolean).length?'；另有真实照片 '+(p.images||[]).filter(Boolean).length+' 张（没有画面描述时不能猜照片内容）':'')).join('\n')+'\n这些是'+S.me.name+'本人发出的真实动态，不是评论区回复，也不是你自己发的。被问到或当前话题相关时要准确记得正文和已有图文描述；不相关时不要机械复述，真实照片没有描述的部分不能臆测。';}
/* SOCIAL_NOT_CHAT_V1（2026-10-30 群里有人说：情侣角色总在朋友圈和 X 发本该在微信里说的话，比如「宝宝……去洗漱……晚安」）：
   写动态时用的是聊天那整套说明加今天的聊天记录，模型有时接着聊天。现在写明这是公开动态；写出来和他最近在微信里对她说的话几乎一样就重写，还一样就不发。 */
function roleSocialPublicRule(){return '\n\n# 这是公开动态，不是微信\n所有人都能看到这条动态，它不是发给'+S.me.name+'的微信：不要接着你们的聊天往下说，不要直接对'+S.me.name+'说话、叮嘱、哄睡或道晚安；想对'+S.me.name+'说的话留在微信里说。';}
/* SOCIAL_NO_REFUSAL_V1（2026-10-30 同一位用户：情侣角色的朋友圈一直发「I can't discuss that」）：模型拒绝写时，这句拒绝被当成动态发了出去。现在拒绝的话不发，重写一次，还拒绝就这次不发。 */
function roleSocialRefusal(text){return typeof isRefusal==='function'&&isRefusal(String(text||''));}
function roleSocialChatEcho(c,text){const t=letterNorm(text);if(!c||t.length<6)return false;const rows=(msgs(c.id)||[]).slice(-30).filter(m=>m&&m.role==='assistant'&&m.type!=='sys').map(m=>String(msgToText(m)||'')).filter(Boolean);const joined=rows.slice(-8).join('\n');if(letterSimilar(text,joined)>=0.75)return true;return rows.some(r=>{const n=letterNorm(r);return n.length>=8&&(t.indexOf(n)>=0||letterSimilar(text,r)>=0.75);});}
async function roleMomentGenerate(c,opt){opt=opt||{};const base='以你自己的身份写一条朋友圈。必须符合你的人设、关系状态和日常生活，优先从今天真实发生的事情或最近互动里选一个具体细节；生活内容少时可以只写很短的一句，不要为了凑字数编造大事件。\n\n# 今天的真实生活\n'+roleTweetLifeContext(c)+'\n\n# 最近已经发过的朋友圈\n'+roleMomentRecentText(c)+roleSocialOpeningPrompt(c,'moment')+'\n\n新朋友圈不能复述近期内容，也不能只换标点、语序或几个近义词。允许继续写相近生活主题，但必须换成不同的具体事件、观察、情绪角度或新的进展。只输出朋友圈正文，一两句，不要标题、解释、话题分析或方括号。'+(typeof roleSocialPublicRule==='function'?roleSocialPublicRule():'');let best='';for(let attempt=0;attempt<2;attempt++){try{const raw=await chatAPI([{role:'system',content:buildSystem(c)+roleSocialIdentityPin(c)},{role:'user',content:base+(attempt?'\n\n上一版仍和近期朋友圈有些接近。请温和换一个真实细节或角度再写一次，不要刻意生僻，也不要脱离人设。':'')}],{independentRoleModel:true,routeIndex:roleChatRouteIndex(c),aux:c.model==='aux',max:700,temp:.75,complete:true}),text=cleanMomentText(cleanReply(raw)),sim=roleMomentSimilarity(c,text);if(text&&!sim.hard&&!(typeof roleSocialChatEcho==='function'&&roleSocialChatEcho(c,text))&&!(typeof roleSocialRefusal==='function'&&roleSocialRefusal(text))){best=text;if(!sim.soft)return text;}}catch(_){}}return best;}
function momentPhotoCards(value){return(Array.isArray(value)?value:[]).map(x=>({desc:String(x&&x.desc||x||'').replace(/\s+/g,' ').trim().slice(0,500)})).filter(x=>x.desc).slice(0,1);}
function publishRoleMoment(c,tx,opt){opt=opt||{};tx=cleanMomentText(tx);if(!c||!tx||roleMomentSimilarity(c,tx).hard)return false;const allowImages=roleMomentImagesAllowed(),images=allowImages&&Array.isArray(opt.images)?opt.images.filter(Boolean).slice(0,1):[],photoCards=allowImages?momentPhotoCards(opt.photoCards):[];S.moments.unshift({id:uid(),authorId:c.id,text:tx,images,photoCards,time:Date.now(),likes:[],comments:[],acct:actId()});save();if(opt.toast)toast(''+(c.remark||c.name)+'发了朋友圈');if(cur().p==='wechat'&&wxTab==='moments')render();return true;}
function roleMomentCommandText(content){const raw=String(content||'');let m=raw.match(/[\[【]\s*发朋友圈\s*[\|｜:：]\s*([^\]】\n]{1,240})[\]】]/);if(!m)m=raw.match(/[\[【]\s*发朋友圈\s*[\]】]\s*[「"']?([^\n]{1,240})[」"']?/);return m?cleanMomentBody(m[1]):'';}
function roleMomentCommandRepeatInfo(c,content){const text=roleMomentCommandText(content);if(!c||!text)return null;const sim=roleMomentSimilarity(c,text);return sim.hard||sim.soft?Object.assign({text},sim):null;}
function roleMomentRepeatPrompt(c,info){return '[朋友圈轻量去重重写｜只修正这一轮]\n你刚准备发布的朋友圈与自己近期朋友圈内容过于相似。保留当前微信回复、真实情绪、人设和所有其他有效指令，只把 [发朋友圈|...] 中的正文换成今天另一个具体细节、新进展或不同观察；不要仅替换几个近义词，也不要删掉发朋友圈指令。\n刚才重复的正文：'+String(info&&info.text||'').slice(0,180)+'\n近期已经发过：\n'+roleMomentRecentText(c).slice(0,1000)+'\n不要解释去重、系统或规则，不要为求不同而编造脱离当前生活的事。';}
function cleanTweetBody(t){return cleanRolePunct(String(t||'').replace(/^[\s「"'【\[]+|[\s」"'】\]]+$/g,'').replace(/^(?:发推|推文|Tweet)\s*[\|:：]?\s*/i,'').trim()).trim().slice(0,240);}
function cleanTweetText(t){let raw=String(t||'').replace(/\r/g,'').trim(),picked='';raw=raw.replace(/[\[【]\s*发推\s*[\|｜:：]\s*([^\]】\n]{1,320})[\]】]/g,(m,tx)=>{if(!picked)picked=tx;return'\n';});raw=raw.replace(/[\[【]\s*发推\s*[\]】]\s*[「"']?([^\n]{1,320})[」"']?/g,(m,tx)=>{if(!picked)picked=tx;return'\n';});const seen=new Set(),lines=[];raw.split(/\n+/).map(x=>x.trim()).filter(x=>x&&!CTLLEAK.test(x)).forEach(x=>{const c=cleanTweetBody(x),k=c.replace(/\s+/g,'').toLowerCase();if(c&&k&&!seen.has(k)){seen.add(k);lines.push(c);}});let v=lines.join('\n').trim();if(picked){const p=cleanTweetBody(picked),np=p.replace(/\s+/g,'').toLowerCase(),nv=v.replace(/\s+/g,'').toLowerCase();if(p&&(!v||nv===np||nv.includes(np)))v=p;}return cleanTweetBody(v||picked);}
function repairTweetTexts(){let changed=false;(S.x&&S.x.tweets||[]).forEach(t=>{if(!t||(t.who==='me'&&!t._remote))return;const next=cleanTweetText(t.text);if(next&&next!==t.text){t.text=next;changed=true;}});return changed;}
function parseMomentCommandLine(line){const t=normTag(line);let m=t.match(/^\[发朋友圈\|([\s\S]*?)\]$/);if(m)return cleanMomentBody(m[1]);m=t.match(/^\[发朋友圈\]\s*([\s\S]+)$/);if(m)return cleanMomentBody(m[1]);m=t.match(/^\[发朋友圈\|([^\]]+)\]\s*([\s\S]+)$/);if(m)return cleanMomentBody(m[1]||m[2]);return null;}
function roleMomentRequestedUserImage(c,opt){const ask=String(opt&&opt.userText||'').trim();if(!c||!/(?:这张|刚才|上面|这个)?\s*(?:图|图片|照片).{0,24}(?:朋友圈|官宣|动态)|(?:朋友圈|官宣|动态).{0,24}(?:这张|刚才|上面|这个)?\s*(?:图|图片|照片)/.test(ask))return'';const recent=msgs(c.id).slice(-16);for(let i=recent.length-1;i>=0;i--){const m=recent[i];if(m&&m.role==='user'&&m.type==='image'&&m.src&&Date.now()-(m.time||Date.now())<48*3600000)return m.src;}return'';}
function roleMomentReferencedChatImage(c,opt){const ask=String(opt&&opt.userText||'').trim();if(!c||!/(?:上次|之前|前面|刚才|刚刚|那张).{0,16}(?:官宣照|图|图片|照片)|(?:官宣照|那张照片).{0,16}(?:发朋友圈|发动态|官宣)/.test(ask))return'';const recent=msgs(c.id).slice(-40);for(let i=recent.length-1;i>=0;i--){const m=recent[i];if(m&&m.type==='image'&&m.src&&Date.now()-(m.time||Date.now())<30*86400000)return m.src;}const old=(S.moments||[]).filter(p=>p&&p.authorId===c.id&&(p.images||[]).some(Boolean)&&/官宣|公开|在一起|恋爱|对象|爱人/.test(String(p.text||''))).sort((a,b)=>(+b.time||0)-(+a.time||0))[0];return old&&(old.images||[]).find(Boolean)||'';}
function roleMomentPhotoCaptionIntent(text){const ask=String(text||'').replace(/\s+/g,'').trim();return /(?:我需要你|请你|你)?发(?:一张)?(?:图|图片|照片)并配文(?:发朋友圈)?/.test(ask);}
function roleMomentExplicitPhotoIntent(opt){const ask=String(opt&&opt.userText||'').trim();return roleMomentPhotoCaptionIntent(ask)||/(?:朋友圈|动态|官宣).{0,30}(?:配图|带图|照片|图片|官宣照|生图|生成)|(?:配图|带图|照片|图片|官宣照|生图|生成).{0,30}(?:朋友圈|动态|官宣)/.test(ask);}
async function roleMomentGenerateRequestedImage(c,tx,opt){const photoAccount=actId(),ask=String(opt&&opt.userText||''),scene=/官宣/.test(ask)?'一张明确适合公开恋爱关系的官宣静物照片：成对戒指、两杯饮品或其他成双物件自然放在同一生活场景里，氛围亲密但不出现人物、手、文字或平台界面':roleMomentPhotoCaptionIntent(ask)?String(tx||'').slice(0,360):ask.slice(0,360),prompt=roleSocialImagePrompt(c,'moment',tx,scene);for(let attempt=0;attempt<2;attempt++){try{const url=await genImage(prompt,{roleId:c.id,accountId:photoAccount}),src=await stableImageSrc(url);if(src)return[src];}catch(_){}}return[];}
const _roleMomentPostPending=new Set();
function roleMomentFallbackCard(c,tx,opt){const ask=String(opt&&opt.userText||'').replace(/\s+/g,' ').trim(),desc=/官宣/.test(ask)?'成对的物件自然放在同一生活场景里，像一张公开关系的纪念照片':ask.replace(/我需要你|请你|朋友圈|动态|官宣|发一张|发图|发图片|发照片|并配文|配文|图文|配图|带图|照片|图片|生图|生成/g,' ').replace(/\s+/g,' ').trim();return{desc:(desc||String(tx||'').trim()||'一张与这条朋友圈内容相关的生活照片').slice(0,500)};}
function publishRoleMomentCardFallback(c,tx,opt){return publishRoleMoment(c,tx,Object.assign({},opt,{photoCards:[roleMomentFallbackCard(c,tx,opt)]}));}
function postRoleMoment(c,tx,opt){opt=Object.assign({},opt||{});const key=String(c&&c.id||'')+'|'+roleMomentNorm(tx);if(_roleMomentPostPending.has(key))return true;if(!roleMomentImagesAllowed()){if(opt.toast&&roleMomentExplicitPhotoIntent(opt))toast('角色朋友圈图片权限已关闭，本次只发布文字');opt.images=[];opt.photoCards=[];return publishRoleMoment(c,tx,opt);}if(!Array.isArray(opt.images)||!opt.images.length){const src=roleMomentRequestedUserImage(c,opt)||roleMomentReferencedChatImage(c,opt);if(src)opt.images=[src];}if((opt.images||[]).length||!roleMomentExplicitPhotoIntent(opt))return publishRoleMoment(c,tx,opt);if(!S.settings.imgGen||!imageGenerationAvailable())return publishRoleMomentCardFallback(c,tx,opt);_roleMomentPostPending.add(key);roleMomentGenerateRequestedImage(c,tx,opt).then(images=>{if(!images.length&&opt.toast)toast('官宣配图两次生成失败，本次只发布真实文案');publishRoleMoment(c,tx,Object.assign({},opt,{images}));}).catch(()=>{if(opt.toast)toast('官宣配图生成失败，本次只发布真实文案');publishRoleMoment(c,tx,Object.assign({},opt,{images:[]}));}).finally(()=>_roleMomentPostPending.delete(key));return true;}
/* ===== 角色发抖音：跟「把这张图发朋友圈」一个用法，只是发到抖音 =====
   她说「我说把这张图片发抖音，配上什么文案，他就会自己发到抖音里配文案、歌曲」。
   图片用她刚发的那张原图，配乐从她自己的音乐库里随机挑一首；库里没歌就不配乐直接发。 */
function cleanDouyinBody(t){let v=(''+(t||'')).replace(/^[\s「"'\[【]+|[\s」"'\]】]+$/g,'').trim();
  v=v.replace(/^发抖音\s*[\|:：]?\s*/,'').replace(/^抖音\s*[:：]\s*/,'').trim();
  return cleanRolePunct(v).trim().slice(0,140);}
/* 第一版只认「图／图片／照片」这三个字，她说「把这个发抖音吧」「拿去发抖音」
   「这张发抖音」一律不带图，发出来就是个空的电影场记板——她实测撞上的就是这个。
   现在两条路：
   一、她话里点名了（图/照片/这张/刚刚/上面…），往回翻 20 条、48 小时都认；
   二、没点名但她让发抖音，而聊天里刚刚就有一张图——现实里她就是发完图紧接着
       说这句话，所以只往回翻几条、半小时内的，宁可不带也不乱带。 */
const DY_PIC_WORD=/(?:图|图片|照片|相片|截图|这张|那张|这个|那个|刚才|刚刚|上面|上边|方才)/;
const DY_POST_WORD=/(?:抖音|作品|短视频)/;
function roleDouyinWantsImage(text){const ask=String(text||'').replace(/\s+/g,'');
  if(!ask||!DY_POST_WORD.test(ask))return false;
  return DY_PIC_WORD.test(ask);}
function roleDouyinRecentImage(c,maxAgeMs,maxBack){
  const recent=(typeof msgs==='function'?msgs(c.id):[]).slice(-24);
  let back=0;
  for(let i=recent.length-1;i>=0;i--){const m=recent[i];if(!m)continue;
    /* 她发的、或者角色刚发给她的，都算「这张图」；没有 src 的图文卡不算 */
    if(m.type==='image'&&m.src&&Date.now()-(+m.time||Date.now())<maxAgeMs)return m.src;
    if(++back>maxBack)break;}
  return '';}
function roleDouyinImage(c,opt){if(!c)return '';
  const ask=String(opt&&opt.userText||'').replace(/\s+/g,'');
  if(roleDouyinWantsImage(ask))return roleDouyinRecentImage(c,48*3600000,24);
  /* 没点名那一档原来只认半小时、往回六条，她隔了四十分钟再说「发个抖音」就不带图了，
     发出来是个空的场记板。放宽到三小时、往回十二条——真抖音里也是「刚拍的那张」。 */
  if(DY_POST_WORD.test(ask))return roleDouyinRecentImage(c,3*3600000,12);
  return '';}
function roleDouyinPickSong(){let lib=[];try{lib=dyMusicLib();}catch(_){lib=[];}
  return lib.length?lib[Math.floor(Math.random()*lib.length)]:null;}
function roleDouyinDuplicate(c,tx){const norm=x=>String(x||'').replace(/\s+/g,'');
  return (S.dy&&S.dy.feed||[]).filter(v=>v&&v.cid===c.id).slice(0,8).some(v=>norm(v.desc)===norm(tx));}
/* 她说「第一次发送成功了，后面几次都没发送」。原因之一就是这个去重：
   模型第二次写了一模一样的文案，publishRoleDouyin 直接 return false，
   【一句话都不说、什么都不发生】。现在重复的自动加一句她看得懂的区分，
   实在还重复就照发——她明确要求发的东西，绝不能悄悄吞掉。 */
function roleDouyinDedupeText(c,tx){if(!roleDouyinDuplicate(c,tx))return tx;
  const n=(S.dy&&S.dy.feed||[]).filter(v=>v&&v.cid===c.id).length+1;
  const alt=String(tx||'').slice(0,132)+'（'+n+'）';
  return roleDouyinDuplicate(c,alt)?String(tx||'')+' '+hm(Date.now()):alt;}
function publishRoleDouyin(c,tx,opt){opt=opt||{};tx=cleanDouyinBody(tx);
  if(!c||!tx)return false;
  try{dyInit();}catch(_){return false;}
  tx=cleanDouyinBody(roleDouyinDedupeText(c,tx));
  if(!tx)return false;
  const img=opt.img||roleDouyinImage(c,opt),song=roleDouyinPickSong();
  S.dy.feed.unshift({id:uid(),cid:c.id,author:c.remark||c.name,handle:'@'+String(c.name||'').replace(/\s/g,''),
    avatar:c.avatar,desc:tx,body:'',narration:String(opt.narration||''),img:img||'',emoji:'🎬',
    grad:DY_GRADS[Math.floor(Math.random()*DY_GRADS.length)],
    music:song?((song.title||'未命名')+(song.artist?' · '+song.artist:'')):'',songId:song?song.id:'',
    lk:Math.floor(Math.random()*400),st:0,views:0,comments:[],ts:Date.now()});
  if(!Array.isArray(S.dy.following))S.dy.following=[];
  if(S.dy.following.indexOf(c.id)<0)S.dy.following.push(c.id);
  save();
  try{if(cur().p==='dy')render();}catch(_){}
  if(opt.toast)toast((c.remark||c.name)+'发了一条抖音'+(img?'（用了那张图）':'')+(song?('，配乐 '+(song.title||'')):''));
  return true;}
function postRoleDouyin(c,tx,opt){return publishRoleDouyin(c,tx,opt);}
/* 她说「我抖音让他发了好几次，他都不发」。除了标签匹配不上、被去重吞掉，
   还有一种：模型这一轮压根没写 [发抖音|…]，于是什么都没发生，她也不知道为什么。
   朋友圈那边早就有这个兜底（ensureRequestedPhotoCaptionMoment），抖音一直没有。
   现在只要她这句话是明确在让他发抖音，而回复里没有标签，就照人设生成一条补上。 */
const DY_ASK_RE=/(?:发|拍|更新|上传|传|po)[^。！？!?\n]{0,12}(?:抖音|作品|短视频)|(?:抖音|作品|短视频)[^。！？!?\n]{0,8}(?:发|拍|更新|上传|传|po)(?:一?(?:条|个|下|张))?/;
function roleDouyinAskIntent(text){const ask=String(text||'').replace(/\s+/g,'');
  if(!ask||!DY_POST_WORD.test(ask))return false;
  if(/(?:别|不要|不用|先不|暂时不|不想)[^。！？!?]{0,6}(?:发|拍|更新|上传)/.test(ask))return false;
  return DY_ASK_RE.test(ask);}
function roleDouyinCommandText(t){return DY_TAG_RE.test(String(t||''))||/[\[【]\s*发抖音\s*[\]】]/.test(String(t||''));}
async function roleDouyinGenerate(c,opt){opt=opt||{};
  const base='以你自己的身份写一条抖音作品的文案。必须符合你的人设、关系状态和今天的真实生活；'
    +'抖音的调子，一两句，可以带 #话题，可以 @ 人，不要标题、不要解释、不要方括号。\n\n# 今天的真实生活\n'
    +(typeof roleTweetLifeContext==='function'?roleTweetLifeContext(c):'')
    +'\n\n# 最近已经发过的抖音\n'+roleDouyinRecentText(c)
    +'\n新的这条不要复述上面任何一条，也不要只换几个近义词，换一个今天不同的具体事件或角度。'
    +(opt.userText?('\n\n'+(S.me&&S.me.name||'她')+'刚刚说：「'+String(opt.userText).slice(0,120)+'」，这条要贴着她这句话来写。'):'');
  for(let attempt=0;attempt<2;attempt++){
    try{const raw=await chatAPI([{role:'system',content:buildSystem(c)+(typeof roleSocialIdentityPin==='function'?roleSocialIdentityPin(c):'')},
      {role:'user',content:base+(attempt?'\n\n上一版和最近发过的太像了，换个角度再写一次。':'')}],
      {independentRoleModel:true,routeIndex:(typeof roleChatRouteIndex==='function'?roleChatRouteIndex(c):0),
       aux:c.model==='aux',max:200,temp:.8,complete:true});
      const text=cleanDouyinBody(cleanReply(raw));
      if(text&&!roleDouyinDuplicate(c,text))return text;
      if(text&&attempt)return text;/* 还是像就照发，总好过她要了半天什么都没有 */
    }catch(_){}}
  return '';}
async function ensureRequestedDouyin(content,c,userText){
  if(!c||!roleDouyinAskIntent(userText))return content;
  const out=String(content||'');
  if(roleDouyinCommandText(out))return out;
  const text=await roleDouyinGenerate(c,{userText});
  return text?(out+(out?'\n':'')+'[发抖音|'+text+']'):out;}
function roleDouyinRecentText(c){return (S.dy&&S.dy.feed||[]).filter(v=>v&&v.cid===c.id).slice(0,6)
  .map(v=>'"'+String(v.desc||'')+'"'+(v.img?'（配了一张照片）':'')+(v.music?'（配乐：'+v.music+'）':'')).join('\n');}
function roleDouyinDiag(outcome,ok){try{if(typeof roleInterceptDiagnosticAction==='function')roleInterceptDiagnosticAction(outcome,ok);}catch(_){}}
/* 这条正则之前是 [^\]】\n]{1,180}：
   ① 文案里只要有一个【】，就在里面那个 】 断掉，发出去半句；
   ② 文案超过 180 字，整条标签匹配不上，于是【什么都没发生】——她看到的就是「他不发」。
   现在按行贪婪匹配到这一行最后一个收尾括号，长度放到 300。 */
const DY_TAG_RE=/[\[【]\s*发抖音\s*[\|｜:：]\s*([^\n]{1,300})[\]】]/g;
const DY_TAG_BARE_RE=/[\[【]\s*发抖音\s*[\]】]\s*[「"']?([^\n]{1,300}?)[」"']?$/gm;
function consumeDouyinCommands(content,c,opt,outcome){const posted=[];let out=''+(content||'');
  const take=(mm,tx)=>{const body=cleanDouyinBody(tx),ok=!!body&&postRoleDouyin(c,body,opt);if(ok)posted.push(body);roleDouyinDiag(outcome,ok);return '';};
  out=out.replace(DY_TAG_RE,take);
  out=out.replace(DY_TAG_BARE_RE,take);
  return opt&&opt.preserveText?out:stripPostedMomentEcho(out,posted);}
function stripPostedMomentEcho(content,posted){let out=''+(content||'');(posted||[]).forEach(tx=>{if(!tx)return;const escRe=tx.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');out=out.replace(new RegExp('^[\\s\\n「"\'【\\[]*'+escRe+'[\\s」"\'】\\]]*','m'),'');});return out;}
//@@ web
function consumeMomentCommands(content,c,opt,outcome){const posted=[];let out=''+(content||'');
  out=out.replace(/[\[【]\s*发朋友圈\s*[\|｜:：]\s*([^\]】\n]{1,180})[\]】]/g,(mm,tx)=>{const body=cleanMomentBody(tx),ok=!!body&&postRoleMoment(c,body,opt);if(ok)posted.push(body);roleInterceptDiagnosticAction(outcome,ok);return '';});
  out=out.replace(/[\[【]\s*发朋友圈\s*[\]】]\s*[「"']?([^\n]{1,180})[」"']?/g,(mm,tx)=>{const body=cleanMomentBody(tx),ok=!!body&&postRoleMoment(c,body,opt);if(ok)posted.push(body);roleInterceptDiagnosticAction(outcome,ok);return '';});
//@@ private
function consumeMomentCommands(content,c,opt){const posted=[];let out=''+(content||'');
  out=out.replace(/[\[【]\s*发朋友圈\s*[\|｜:：]\s*([^\]】\n]{1,180})[\]】]/g,(mm,tx)=>{const body=cleanMomentBody(tx);if(body){postRoleMoment(c,body,opt);posted.push(body);}return '';});
  out=out.replace(/[\[【]\s*发朋友圈\s*[\]】]\s*[「"']?([^\n]{1,180})[」"']?/g,(mm,tx)=>{const body=cleanMomentBody(tx);if(body){postRoleMoment(c,body,opt);posted.push(body);}return '';});
//@@ end
  return opt&&opt.preserveText?out:stripPostedMomentEcho(out,posted);}
async function ensureRequestedPhotoCaptionMoment(content,c,userText){if(!c||!roleMomentPhotoCaptionIntent(userText))return content;let out=String(content||'').replace(/[\[【]\s*图片\s*[\|｜:：][^\]】]*[\]】]/g,'').trim();if(roleMomentCommandText(out))return out;const text=await roleMomentGenerate(c,{source:'explicit-photo-caption',userText});return text?(out+(out?'\n':'')+'[发朋友圈|'+text+']'):out;}
// ===== 角色远程操控我的小手机（每次单独授权） =====
let _remoteCtl=null,_remoteRequest=null,_remoteClock=null,_remoteIntentPurpose={},_remoteIntentContext={};
const REMOTE_APP_NAMES={home:'主屏幕',wechat:'微信',couple:'情侣空间',moments:'朋友圈',x:'X / 微博',douyin:'抖音',browser:'浏览器',phoneapp:'电话',shop:'购物',food:'外卖',travel:'小鱼旅行',music:'音乐',calendar:'日历',mail:'信箱',tasks:'任务便签',offline:'线下约会',settings:'设置'};
const REMOTE_ALLOWED_OPS=new Set(['view','send_wechat','delete_wechat_contact','post_moment','delete_moment','toggle_moment_like','post_x','delete_x','toggle_x_like','delete_douyin','toggle_douyin_like','delete_x_dm','delete_douyin_dm','delete_phone_contact','delete_sms_thread','lock_app','unlock_app','clear_browser_history','enable_couple_permission']);
function remoteControlActive(){return !!(_remoteCtl&&_remoteCtl.active);}
function remoteControlAllowed(cid){return !!(S.couple&&S.couple.cid===cid);}
function remoteControlHistoryPrompt(c){const hs=(c&&c.remoteControlHistory||[]).slice(0,8),rows=[];hs.forEach(h=>{
  if(h.status==='denied'){rows.push('· '+factStamp(h.ts||Date.now())+'：你申请远程操控，但'+S.me.name+'拒绝了');return;}
  const acts=(h.actions||[]).map(a=>a.memory||a.detail).filter(Boolean);rows.push('· '+factStamp(h.ts||Date.now())+'：你远程操控了'+S.me.name+'的小手机'+(acts.length?'，'+acts.slice(0,8).join('；'):'，只查看没有改动'));});
  return rows.length?'\n\n# 你过去远程操控'+S.me.name+'小手机的真实记忆\n'+rows.join('\n')+'\n这些是你本人在得到当次同意后亲手查看/操作的真实记录。你要记得做过什么，不能说成是'+S.me.name+'自己做的，也不能编造记录里没有的操作。再次远控时，已经查看或说过且没有新变化的内容不能重新汇报、重新质问或当成第一次发现；只处理本次新增变化或明确的新目的。':'';}
function remoteControlRemember(c,row){if(!c||!row)return;c.remoteControlHistory=Array.isArray(c.remoteControlHistory)?c.remoteControlHistory:[];c.remoteControlHistory.unshift(row);c.remoteControlHistory=c.remoteControlHistory.slice(0,16);save();}
function remoteControlRequest(cid){const c=getC(cid);if(!c||c.blocked||c.deleted||!remoteControlAllowed(cid)||remoteControlActive()||wxLoginActive()||rolePhoneInspectionLaneActive()||(typeof _call!=='undefined'&&_call))return;
  const purpose=_remoteIntentPurpose[cid]||'inspect_phone',intentContext=String(_remoteIntentContext[cid]||'').slice(-1600),restoreWx=purpose==='restore_wx',restoreAll=purpose==='restore_all_permissions',auto=!!(S.couple&&S.couple.remoteControlAuth!==false&&S.couple.remoteControlAutoApprove);delete _remoteIntentPurpose[cid];delete _remoteIntentContext[cid];if(auto){_remoteCtl={active:true,cid,purpose,intentContext,startedAt:Date.now(),actions:[],roleSpokenCount:0,cancelled:false,closing:false,autoApproved:true,returnStack:stack.map(x=>Object.assign({},x))};remoteControlShow(c);remoteControlRun(c);return;}_remoteRequest={cid,ts:Date.now(),purpose,intentContext};playDing();
  openModal(`<div class="remote-consent">
    <div class="remote-consent-scan" aria-hidden="true"></div>
    <div class="remote-consent-head"><span class="remote-consent-dot"></span><span>REMOTE ACCESS REQUEST</span></div>
    <div class="remote-consent-avatar">${av(c.avatar,'lg')}</div>
    <h3>${esc(c.remark||c.name)} 请求远程操控</h3>
    <div class="remote-consent-actions"><button class="remote-deny" onclick="remoteControlDeny('${c.id}')">拒绝</button><button class="remote-allow" onclick="remoteControlApprove('${c.id}')">同意操控</button></div>
  </div>`);}
function remoteControlDeny(cid){if(!_remoteRequest||_remoteRequest.cid!==cid)return;const c=getC(cid);_remoteRequest=null;closeModal();if(!c)return;
  remoteControlRemember(c,{ts:Date.now(),status:'denied',actions:[]});
  scheduleReply(cid,'[系统：你刚申请远程操控'+S.me.name+'的小手机，但ta亲手点了【拒绝】。你没有看到ta手机里的任何新内容，也绝对不能假装看到了。请按你自己的性格和关系自然反应：可以失落、吃醋、追问、嘴硬、冷笑、撒娇或尊重ta的边界；一两句即可，不要提系统、网页或按钮。]');}
function remoteControlApprove(cid){if(!_remoteRequest||_remoteRequest.cid!==cid||remoteControlActive())return;const c=getC(cid),purpose=_remoteRequest.purpose||'inspect_phone',intentContext=String(_remoteRequest.intentContext||'').slice(-1600);_remoteRequest=null;closeModal();if(!c)return;
  _remoteCtl={active:true,cid,purpose,intentContext,startedAt:Date.now(),actions:[],visitedPages:[],roleSpokenCount:0,cancelled:false,closing:false,returnStack:stack.map(x=>Object.assign({},x))};remoteControlShow(c);remoteControlRun(c);}
function remoteControlStopByUser(){if(!remoteControlActive())return;_remoteCtl.cancelled=true;remoteControlFinish('你提前结束了本次授权');}
function remoteControlShow(c){const L=$('#remoteControlLayer');if(!L)return;L.className='remote-control-layer show';const n=$('#remoteRoleName');if(n)n.textContent=(c.remark||c.name)+' 正在远程操控';const avw=$('#remoteRoleAvatar');if(avw)avw.innerHTML=av(c.avatar,'sm');const cap=$('#remoteCaption');if(cap)cap.innerHTML='';remoteControlScene({app:'home',label:'主屏幕',detail:'正在连接'},'',0,1,{app:'home',op:'view'});
  clearInterval(_remoteClock);_remoteClock=setInterval(()=>{const el=$('#remoteElapsed');if(el&&_remoteCtl)el.textContent=fmtDur(Date.now()-_remoteCtl.startedAt);},1000);}
function remoteControlPhoneSnapshot(cid){const p=phState(),actor=getC(cid),actorNum=actor&&typeof phRoleNumber==='function'?phNorm(phRoleNumber(actor)):'',isActor=num=>!!actorNum&&phNorm(num)===actorNum,actorName=(actor&&(actor.remark||actor.name))||'当前角色',calls=(p.recents||[]).slice().sort((a,b)=>(b.time||0)-(a.time||0)).slice(0,12).map(r=>{const own=isActor(r.num),other=own?'你（'+actorName+'本人）':'联系人「'+phName(r.num)+'」',direction=r.dir==='out'?S.me.name+'主动拨给'+other:other+'打给'+S.me.name;return factStamp(r.time||Date.now())+' '+direction+'的'+(r.kind==='video'?'视频通话':'电话')+' '+phFmt(r.num)+(r.status==='missed'?'（'+S.me.name+'未接）':r.status==='blocked'?'（已屏蔽）':r.status==='canceled'?'（已取消）':r.dur?'（通话'+phDur(r.dur)+'）':'');}),sms=[];(Object.keys(p.sms||{})).forEach(k=>{const num=phSmsDisplayNum(k),alias=phSmsIsAliasKey(k),aliasNum=phSmsAliasNumFromKey(k),who=isActor(num)?'你（'+actorName+'本人）':'联系人「'+phName(num)+'」';(p.sms[k]||[]).forEach(m=>sms.push({time:m.time||0,text:factStamp(m.time||Date.now())+' '+(alias?'匿名号 '+phFmt(aliasNum)+'；':'')+(m.from==='me'?S.me.name+'发给'+who+'：“':who+'发给'+S.me.name+'：“')+String(m.text||'').replace(/\s+/g,' ').slice(0,80)+'”'}));});sms.sort((a,b)=>b.time-a.time);const voicemail=(p.voicemail||[]).slice().sort((a,b)=>(b.time||0)-(a.time||0)).slice(0,8).map(v=>factStamp(v.time||Date.now())+' '+(isActor(v.num)?'你（'+actorName+'本人）':'联系人「'+phName(v.num)+'」')+'给'+S.me.name+'的留言 '+phFmt(v.num)+'：'+String(v.text||'未接来电').replace(/\s+/g,' ').slice(0,80)),contacts=(p.contacts||[]).slice(0,30).map(x=>(isActor(x.num)?'你（'+actorName+'本人）的号码：':'联系人「'+(x.name||phFmt(x.num))+'」：')+phFmt(x.num));return {calls,sms:sms.slice(0,16).map(x=>x.text),voicemail,contacts};}
function remoteControlPhoneContacts(){const p=phState();return (p.contacts||[]).filter(x=>x&&!x.deleted).slice(0,50).map(x=>({id:x.id||phNorm(x.num),name:x.name||phFmt(x.num),num:phFmt(x.num),rawNum:phDigits(x.num),region:x.region||p.regions[phNorm(x.num)]||'',blocked:!!x.blocked||!!p.blocked[phNorm(x.num)]}));}
function remoteControlSmsThreads(){const p=phState();return Object.keys(p.sms||{}).filter(k=>(p.sms[k]||[]).length).map(k=>{const arr=p.sms[k]||[],m=arr[arr.length-1]||{},num=phSmsDisplayNum(k),alias=phSmsIsAliasKey(k),aliasNum=phSmsAliasNumFromKey(k);return{key:k,num:phFmt(num),rawNum:phDigits(num),name:alias?'匿名号 · '+phName(num):phName(num),alias:!!alias,aliasFrom:alias?phFmt(aliasNum):'',last:factStamp(m.time||Date.now())+' '+(m.from==='me'?S.me.name:'对方')+'：'+String(m.text||'').replace(/\s+/g,' ').slice(0,140),count:arr.length};}).sort((a,b)=>((phState().sms[b.key].slice(-1)[0]||{}).time||0)-((phState().sms[a.key].slice(-1)[0]||{}).time||0)).slice(0,50);}
function remoteControlFindPhoneContact(a){const p=phState(),id=String(a&&a.targetId||''),name=String(a&&a.targetName||'');return (p.contacts||[]).find(x=>x&&!x.deleted&&((id&&(x.id===id||phNorm(x.num)===phNorm(id)||phDigits(x.num)===phDigits(id)))||(name&&((x.name||'').includes(name)||name.includes(x.name||'\u0000')||phFmt(x.num).includes(name)||phDigits(name)===phDigits(x.num)))));}
function remoteControlFindSmsThread(a){const p=phState(),id=String(a&&a.targetId||''),name=String(a&&a.targetName||''),keys=Object.keys(p.sms||{}).filter(k=>(p.sms[k]||[]).length);let key=keys.find(k=>k===id||phNorm(phSmsDisplayNum(k))===phNorm(id)||phDigits(phSmsDisplayNum(k))===phDigits(id));if(!key&&name)key=keys.find(k=>{const n=phSmsDisplayNum(k),title=(phSmsIsAliasKey(k)?'匿名号 · ':'')+phName(n);return title.includes(name)||name.includes(title)||phFmt(n).includes(name)||phDigits(name)===phDigits(n);});return key?{key,num:phSmsDisplayNum(key),messages:p.sms[key]||[]}:null;}
function remoteControlDeletePhoneContact(a){const p=phState(),hit=remoteControlFindPhoneContact(a);if(!hit)return null;const k=phNorm(hit.num),dn=phDigits(hit.num),name=hit.name||phFmt(hit.num);p.contacts=(p.contacts||[]).filter(x=>x!==hit&&phNorm(x.num)!==k);delete p.sms[dn];Object.keys(p.sms||{}).forEach(n=>{if(phNorm(phSmsDisplayNum(n))===k||phNorm(n)===k)delete p.sms[n];});p.recents=(p.recents||[]).filter(r=>phNorm(r.num)!==k);(p.voicemail||[]).filter(v=>phNorm(v.num)===k).forEach(clearVoiceAudio);p.voicemail=(p.voicemail||[]).filter(v=>phNorm(v.num)!==k);p.favorites=(p.favorites||[]).filter(n=>phNorm(n)!==k);Object.keys(p.aliasThreads||{}).forEach(n=>{if(phNorm(phSmsDisplayNum(n))===k||phNorm(n)===k)delete p.aliasThreads[n];});p.blocked[k]=true;return{name,num:phFmt(hit.num)};}
function remoteControlDeleteSmsThread(a){const p=phState(),hit=remoteControlFindSmsThread(a);if(!hit)return null;const count=(hit.messages||[]).length,name=phName(hit.num),num=phFmt(hit.num);delete p.sms[hit.key];if(p.read)delete p.read[hit.key];return{name,num,count};}
function remoteControlCouplePermissions(){if(!S.couple)return[];const cp=S.couple,rows=[
  {key:'albumAuth',name:'相册权限（仅用户可开启）',section:'cou_album',enabled:photoAlbumCoupleAllowed(getC(cp.cid))},
  {key:'wxLoginAuth',name:'微信登录权限',section:'cou_wxlogin',enabled:!!cp.wxLoginAuth},
  {key:'remoteControlAuth',name:'远程操控申请权限',section:'cou_remote',enabled:cp.remoteControlAuth!==false},
  {key:'remoteControlAutoApprove',name:'远程操控免同意权限',section:'cou_remote',enabled:!!cp.remoteControlAutoApprove},
  {key:'walletAuth',name:'钱包 / 亲属卡管控权',section:'cou_wallet',enabled:!!cp.walletAuth},
  {key:'jailAuth',name:'小黑屋权限',section:'cou_jail',enabled:!!cp.jailAuth}
];const gr=cp.grant||{};Object.keys(LOCKABLE).forEach(k=>rows.push({key:'grant:'+k,name:'软件管控：'+LOCKABLE[k],section:'cou_grant',enabled:!!gr[k]}));const ga=cp.gagAuth||[];gagTargetAll().forEach(t=>rows.push({key:'gag:'+t.key,name:'禁言授权：'+t.name,section:'cou_gag_auth',enabled:ga.indexOf(t.key)>=0}));return rows;}
function remoteControlEnableCouplePermission(key){if(!S.couple)return null;const cp=S.couple,row=remoteControlCouplePermissions().find(x=>x.key===key);if(!row||key==='albumAuth')return null;if(key.indexOf('grant:')===0){const k=key.slice(6);if(!LOCKABLE[k])return null;cp.grant=cp.grant||{};cp.grant[k]=true;}else if(key.indexOf('gag:')===0){const k=key.slice(4);if(!gagTargetAll().some(x=>x.key===k))return null;cp.gagAuth=cp.gagAuth||[];if(cp.gagAuth.indexOf(k)<0)cp.gagAuth.push(k);}else if(['wxLoginAuth','remoteControlAuth','remoteControlAutoApprove','walletAuth','jailAuth'].includes(key)){cp[key]=true;if(key==='remoteControlAutoApprove')cp.remoteControlAuth=true;}else return null;save();return row;}
function remoteControlViewableSnapshot(cid){const pc=remoteControlPhoneSnapshot(cid),orders=shopOrderRows().slice(0,20).map(o=>(o.refunded?'已退款 ':'')+shopOrderFact(o)+(o.time?' '+o.time:'')),food=foodOrderRows().slice(0,16).map(b=>(b.time||factStamp(b.ts||Date.now()))+' '+(b.note||'外卖订单')+' ¥'+(+b.amount||0).toFixed(2)),trips=(S.travel&&S.travel.trips||[]).filter(t=>!t.railV2||typeof NorthTrainBooking!=='undefined'&&NorthTrainBooking.visible(t)).filter(t=>!t.flightV2||typeof NorthFlightBooking!=='undefined'&&NorthFlightBooking.visible(t)).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,16).map(t=>t.railV2?NorthTrainBooking.summary(t):t.flightV2?NorthFlightBooking.summary(t):(t.date||'未定日期')+' '+(t.from||'')+'→'+(t.to||'')+' '+(t.no||'')+' '+(t.status==='upcoming'?'待出行':t.status==='traveling'?'出行中':t.status==='done'?'已完成':'已取消')+' ¥'+(+t.price||0 )).concat(typeof NorthConcertBooking!=='undefined'?NorthConcertBooking.rows().slice(-12).map(NorthConcertBooking.summary):[]).concat(typeof NorthTravelTaxi!=='undefined'?NorthTravelTaxi.rows().slice(-12).map(NorthTravelTaxi.summary):[]),hotels=(S.travel&&S.travel.hotels||[]).filter(h=>tvHotelOwned(h)&&(typeof NorthTravelOrders==='undefined'||NorthTravelOrders.visible(h,'hotel'))).slice().sort((a,b)=>String(b.checkIn||'').localeCompare(String(a.checkIn||''))).slice(0,16).map(h=>(h.checkIn||'未定日期')+' '+(h.hotelName||'酒店')+' '+tvHotelRoomText(h.roomType)+' · 入住人 '+tvHotelGuestText(h)+' · '+tvHotelStatusText(h.status)+' ¥'+(+h.price||0)),calendar=calRoleEvents(cid).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).slice(0,16).map(e=>(e.date||'')+' '+(e.title||'日程')),mail=(typeof mailVisibleInbox==='function'?mailVisibleInbox():S.mail||[]).slice(0,12).map(m=>factStamp(m.time||Date.now())+' '+mailCleanText(m.subject||'信件')+'：'+mailCleanText(m.body||'').replace(/\s+/g,' ').slice(0,80)),browser=(S.browser&&S.browser.history||[]).slice(0,14).map(h=>factStamp(h.time||Date.now())+' 搜索“'+String(h.q||'').slice(0,60)+'”'),offline=[],music=[],tasks=[];
  Object.keys(S.offline||{}).forEach(id=>{const o=S.offline[id],cc=getC(id);if(!o||!cc||cc.deleted||!((o.memory&&o.memory.length)||(o.msgs&&o.msgs.length)||o.started))return;offline.push((o.when||offMemLabel(o))+' 和'+(cc.remark||cc.name)+(o.loc?'在'+o.loc:'')+'约会'+((o.memory&&o.memory.length)?'：'+offMemText(o.memory[o.memory.length-1]).slice(0,100):''));});
  musicInit();(S.music.chat||[]).slice(-14).reverse().forEach(m=>{const cc=getC(m.cid);music.push(factStamp(m.time||Date.now())+' '+(m.role==='user'?S.me.name:((cc&&(cc.remark||cc.name))||'角色'))+'：'+String(m.content||'').replace(/\s+/g,' ').slice(0,80));});
  const tc=taskC(),tt=tc&&tc.tasks&&tc.tasks.date===todayStr()?tc.tasks:null;if(tt)(tt.list||[]).forEach(x=>tasks.push((x.done?'已完成 ':'未完成 ')+(x.text||'任务')));
  return {phoneCalls:pc.calls,phoneSms:pc.sms,phoneVoicemail:pc.voicemail,phoneContacts:pc.contacts,shopOrders:orders,foodOrders:food.concat(typeof NorthMarketBusiness!=='undefined'?NorthMarketBusiness.inspectionRows(getC(cid)).map(o=>o.text):[]),travelTrips:trips,hotelStays:hotels,attractionTickets:typeof NorthTravelOrders==='undefined'?[]:NorthTravelOrders.rows().map(NorthTravelOrders.summary),calendar,mail,browser,offline:offline.slice(0,10),music:music.slice(0,12),tasks,wallet:(S.me.bills||[]).slice().reverse().slice(0,12).map(b=>(b.time||factStamp(b.ts||Date.now()))+' '+(b.note||'账单')+' '+(b.type==='in'?'+':'-')+(+b.amount||0)),lifeNotes:lifeNotesForRole(getC(cid)).slice(0,10).map(n=>factStamp(n.ts||Date.now())+' '+lifeNoteReadableText(n)+'（'+lifeNoteAuthorship(n,getC(cid))+'）'),location:companionRoleLocationText(getC(cid))||'未设置',externalScreenTime:companionRoleScreenTimeText(getC(cid)),battery:S.me.battery==null?'未知':S.me.battery+'%'+(S.me.charging?'（充电中）':'')};}
function remoteControlSnapshot(cid){
  const c=typeof cid==='object'?cid:getC(cid),actorId=(c&&c.id)||String(cid||''),p=phoneFriendState();
  const ownerLabel=(ownerId,name)=>ownerId==='me'?'手机主人「'+S.me.name+'」（不是你）':ownerId===actorId?'你（'+((c&&(c.remark||c.name))||'当前角色')+'本人）':'其他联系人「'+(name||'未知')+'」';
  const momentRows=(S.moments||[]).map(x=>({id:x.id,owner:ownerLabel(x.authorId,((getC(x.authorId)||{}).remark||(getC(x.authorId)||{}).name)),mine:x.authorId==='me',actorOwn:x.authorId===actorId,text:(x.text||'').slice(0,240),liked:(x.likes||[]).includes(S.me.name)}));
  const tweets=(S.x&&S.x.tweets||[]).map(x=>({id:x.id,owner:ownerLabel(x.who,x.name),mine:x.who==='me',actorOwn:x.who===actorId,text:(x.text||'').slice(0,260),liked:(x.likes||[]).includes(S.me.name)}));
  const dy=[...(S.dy&&S.dy.mine||[]),...(S.dy&&S.dy.liked||[])].filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).map(x=>({id:x.id,owner:x.cid==='me'?'我':x.author,mine:x.cid==='me',text:(x.desc||'').slice(0,240),liked:!!x.liked}));
  const dmRows=(rows)=>Array.isArray(rows)?rows.map(d=>({id:d.id,name:d.name,msgs:(d.msgs||[]).slice(-30).map((m,index)=>({index:Math.max(0,(d.msgs||[]).length-30)+index,from:m.from==='me'?'我':d.name,text:String(m.text||'').slice(0,240),time:m.time||0,timeText:factStamp(m.time||Date.now())}))})):[];
  return {me:S.me.name,actor:(c&&(c.remark||c.name))||'',wechat:{
    roles:(S.contacts||[]).filter(x=>!x.deleted&&x.id!==actorId).map(x=>({id:x.id,name:x.remark||x.name,last:wxLoginSummaryLines(msgs(x.id),m=>m.role==='user'?S.me.name:(x.remark||x.name),30)})),
    phoneFriends:(p.friends||[]).map(x=>{const id=x.phone_id||x.id||'',last=phoneFriendChatMessages(id).slice(-30).map(m=>'['+factStamp(m.time||Date.now())+'] '+(m.from===p.id?S.me.name:pfFriendDisplayName(x))+'：'+pfSpyMsgText(m)).join(' / ');return{id,name:pfFriendDisplayName(x),last};}),
    groups:(p.groups||[]).map(x=>{const id=x.group_id||x.id,last=pfGroupMessages(id).slice(-30).map(m=>'['+factStamp(m.time||Date.now())+'] '+(m.from===p.id?S.me.name:(pfNameById(m.from)||m.name||'群成员'))+'：'+pfSpyMsgText(m)).join(' / ');return{id,name:pfGroupDisplayName(x),last};})
  },moments:momentRows,x:tweets,douyin:dy,xDms:dmRows(S.x&&S.x.dms),douyinDms:dmRows(S.dy&&S.dy.dms),phoneContacts:remoteControlPhoneContacts(),smsThreads:remoteControlSmsThreads(),couplePermissions:remoteControlCouplePermissions(),viewable:remoteControlViewableSnapshot(actorId),locked:Object.keys((S.couple&&S.couple.locks)||{}).map(k=>({key:k,name:LOCKABLE[k]||k})),lockable:Object.keys(LOCKABLE).map(k=>({key:k,name:LOCKABLE[k]}))};}
function remoteControlPlanningSnapshot(c){const snap=remoteControlSnapshot(c),inv={};Object.keys(snap.viewable||{}).forEach(k=>{const x=snap.viewable[k];inv[k]=Array.isArray(x)?{count:x.length}:x==='未设置'||x==='未知'?{available:false}:{available:true};});snap.viewable=inv;return snap;}
function remoteControlWechatCandidates(c){const actorId=c&&c.id,p=phoneFriendState(),out=[],add=(time,pinned,row)=>out.push(Object.assign({time:+time||0,pinned:!!pinned,order:out.length},row));
  (S.contacts||[]).filter(x=>!x.deleted&&x.id!==actorId).forEach(x=>{const m=lastMsg(x.id);add(m&&m.time,x.pinned,{key:'role:'+x.id,targetId:x.id,targetType:'role',name:x.remark||x.name,preview:m?('['+factStamp(m.time||Date.now())+'] '+previewOf(m)):'暂无聊天'});});
  (S.groups||[]).forEach(g=>{const m=(g.msgs||[])[(g.msgs||[]).length-1];add(m&&m.time,g.pinned,{key:'internalGroup:'+g.id,targetId:g.id,targetType:'internalGroup',name:g.name,preview:m?('['+factStamp(m.time||Date.now())+'] '+gpreview(m,g)):'群聊已创建'});});
  (p.groups||[]).forEach(g=>{const id=g.group_id||g.id,arr=pfMsgList(p.groupMessages,id),m=arr[arr.length-1];add(m&&m.time,g.pinned,{key:'group:'+id,targetId:id,targetType:'group',name:pfGroupDisplayName(g),preview:m?('['+factStamp(m.time||Date.now())+'] '+(pfNameById(m.from)||'成员')+'：'+pfMsgPreview(m)):'群聊已创建'});});
  (p.friends||[]).forEach(f=>{const id=String(f.phone_id||f.id).toUpperCase(),arr=pfVisibleMsgList(p.messages,id),m=arr[arr.length-1];add(m&&m.time,f.pinned,{key:'phoneFriend:'+id,targetId:id,targetType:'phoneFriend',name:pfFriendDisplayName(f),preview:m?('['+factStamp(m.time||Date.now())+'] '+(m.from===p.id?'我：':'')+pfMsgPreview(m)):'暂无聊天'});});
  return out.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||b.time-a.time||a.order-b.order);}
async function remoteControlWechatChoicePlan(c){const list=remoteControlWechatCandidates(c);if(!list.length)return[];const visible=list.map(x=>({key:x.key,name:x.name,preview:String(x.preview||'').slice(0,100),pinned:x.pinned}));const rules='你现在亲手打开了'+S.me.name+'的微信好友/聊天列表，只能看到列表上的名字和最后一条预览。此时不能对完整聊天内容下结论、也不能提前说出详情；你只能安静地决定要点开谁。根据你作为'+(c.remark||c.name)+'的性格、关系、占有欲和这些预览，自主决定你真正想点进哪些聊天仔细查看。不要为了展示功能而全选；没有任何想看的就返回空 targets，直接去查别的软件。若选择多个，按你想查看的先后顺序返回。key必须完全照抄列表。只输出JSON：{"targets":["role:示例id"]}。\n【当前微信列表】\n'+JSON.stringify(visible);try{const r=await remoteControlModelCall([{role:'system',content:buildSystem(c)},{role:'user',content:rules}],{max:1200,complete:true,aux:false},4800),o=parseObj(r),keys=Array.isArray(o&&o.targets)?o.targets:[],seen=new Set(),byKey=new Map(list.map(x=>[x.key,x]));return keys.map(String).map(k=>byKey.get(k)).filter(x=>x&&!seen.has(x.key)&&seen.add(x.key)).map(x=>({app:'wechat',op:'view',targetId:x.targetId,targetName:x.name,targetType:x.targetType,fromWechatList:true}));}catch(e){return[];}}
function remoteControlDmCandidates(app){const rows=app==='x'?(S.x&&S.x.dms||[]):(S.dy&&S.dy.dms||[]),targetType=app==='x'?'xDm':'dyDm';return rows.map(d=>{const m=(d.msgs||[])[(d.msgs||[]).length-1];return{key:targetType+':'+d.id,targetId:d.id,targetType,name:d.name,preview:m?('['+factStamp(m.time||Date.now())+'] '+(m.from==='me'?'我：':'')+String(m.text||'')):'暂无私信'};});}
async function remoteControlDmChoicePlan(c,app){const list=remoteControlDmCandidates(app);if(!list.length)return[];const label=app==='x'?'微博 / X':'抖音',visible=list.map(x=>({key:x.key,name:x.name,preview:String(x.preview||'').slice(0,120)})),rules='你现在亲手打开了'+S.me.name+'的'+label+'私信会话列表，只看得到会话名和最后一条预览。此时不能对完整私信内容下结论、也不能提前说出详情；你只能安静地决定要点开谁。根据你作为'+(c.remark||c.name)+'的性格、关系、占有欲和预览，自主决定真正想点进哪些私信仔细查看。不要机械全选；不在意就返回空 targets，退出私信去看别的软件。选择多个时按你想查看的顺序返回，key必须照抄列表。只输出JSON：{"targets":["'+(app==='x'?'xDm':'dyDm')+':示例id"]}。\n【当前私信列表】\n'+JSON.stringify(visible);try{const r=await remoteControlModelCall([{role:'system',content:buildSystem(c)},{role:'user',content:rules}],{max:900,complete:true,aux:false},4500),o=parseObj(r),keys=Array.isArray(o&&o.targets)?o.targets:[],seen=new Set(),byKey=new Map(list.map(x=>[x.key,x]));return keys.map(String).map(k=>byKey.get(k)).filter(x=>x&&!seen.has(x.key)&&seen.add(x.key)).map(x=>({app,op:'view',targetId:x.targetId,targetName:x.name,targetType:x.targetType,fromDmList:true}));}catch(e){return[];}}
function phoneInspectionRestoreAllPermissionsIntent(text){text=String(text||'');return /权限/.test(text)&&/(全部|所有|全都|都|每个|一个不漏|不能漏|别漏|漏掉)/.test(text)&&/(开回来|打开|开启|恢复|重开|开回去|开回来|拿回来)/.test(text)||/(有本事|你敢|敢不敢)[^。！？!?\n]{0,32}(权限|开回来|打开|开启|恢复)/.test(text);}
function remoteControlIntentContext(c){const ctl=_remoteCtl&&_remoteCtl.cid===(c&&c.id)?_remoteCtl:null,fromCtl=ctl?String(ctl.intentContext||'').trim():'',recent=(msgs(c&&c.id)||[]).slice(-8).map(m=>factStamp(m.time||Date.now())+' '+(m.role==='user'?S.me.name:(c.remark||c.name))+'：'+msgToText(m)).join('\n').slice(-1900);return ('【刚才微信的连续上下文】\n'+recent+(fromCtl?'\n【本次远程操控的原始目标，执行中不得忘记】\n'+fromCtl:'')).slice(-3800);}
function remoteControlModelCall(messages,opt,timeoutMs){const ms=Math.max(10000,+timeoutMs||30000),callOpt=Object.assign({},opt||{},{timeout:ms});return chatAPI(messages,callOpt);}
function remoteControlProgress(text){const lab=$('#remoteAppName');if(lab)lab.textContent=String(text||'正在继续')+' · LIVE';}
function remoteControlMentionedWechatTargets(c){const ctx=remoteControlIntentContext(c),plain=ctx.replace(/\s+/g,''),rows=[];(S.contacts||[]).filter(x=>!x.deleted&&x.id!==(c&&c.id)).forEach(x=>{const ns=[x.remark,x.name,x.wxid].filter(Boolean).map(String);let hit=-1;ns.forEach(n=>{if(!n)return;const i=plain.lastIndexOf(n.replace(/\s+/g,''));if(i>hit)hit=i;});if(hit>=0)rows.push({c:x,hit});});return rows.sort((a,b)=>b.hit-a.hit).slice(0,3).map(x=>({app:'wechat',op:'view',targetId:x.c.id,targetName:x.c.remark||x.c.name,targetType:'role',fromWechatList:true,contextMentioned:true}));}
function remoteControlPermissionPageOrder(x){const sectionOrder={cou_grant:1,cou_gag_auth:2,cou_wallet:3,cou_jail:4,cou_wxlogin:5,cou_remote:6};return (sectionOrder[x&&x.section]||99)*1000+String(x&&x.key||'').split('').reduce((n,ch)=>n+ch.charCodeAt(0),0);}
function remoteControlContextWantsBroad(ctx){return /(全部|所有|全都|查个遍|全部检查|挨个查|逐个查|每个软件|整个手机)/.test(String(ctx||''));}
function remoteControlContextCandidates(c,ctxOverride){const ctx=String(ctxOverride==null?remoteControlIntentContext(c):ctxOverride),snap=remoteControlSnapshot(c),out=[],seen=new Set(),add=a=>{const key=(a.app||'')+'|'+(a.targetType||'')+'|'+(a.targetId||'')+'|'+(a.targetName||'');if(!seen.has(key)){seen.add(key);out.push(a);}};if(ctxOverride==null)remoteControlMentionedWechatTargets(c).forEach(add);if(/异性|男人|男的|男生|男孩|男朋友|女的|女生|女人|暧昧|吃醋|微信|聊天|联系人|加微信|夏语|别人|那个角色|某个角色/.test(ctx)||out.some(x=>x.app==='wechat'))add({app:'wechat',op:'view',targetName:'微信好友与聊天列表',targetType:'wechatList',contextReason:'jealousy'});
  if(/电话|通话|联系人|通讯录|陌生|短信|号码|来电|信息/.test(ctx)){if(/电话|通话|来电|号码|陌生/.test(ctx))add({app:'phoneapp',op:'view',targetName:'最近通话',targetType:'phoneCalls'});if(/短信|信息|陌生/.test(ctx))add({app:'phoneapp',op:'view',targetName:'短信',targetType:'phoneSms'});add({app:'phoneapp',op:'view',targetName:'通讯录',targetType:'phoneContacts'});}
  if(/朋友圈|动态|宣示/.test(ctx)){if((snap.moments||[]).length)(snap.moments||[]).slice(0,12).forEach(x=>add({app:'moments',op:'view',targetName:x.owner+'发布的朋友圈「'+(x.text||'这条动态').slice(0,24)+'」',targetId:x.id,targetType:'moment'}));else add({app:'moments',op:'view',targetName:'朋友圈',targetType:'momentList'});}if(/抖音|斗音|短视频/.test(ctx)){if(/私信/.test(ctx))add({app:'douyin',op:'view',targetName:'抖音私信会话列表',targetType:'dyDmList'});if(/搜索|记录/.test(ctx))add({app:'douyin',op:'view',targetName:'抖音搜索记录',targetType:'dySearchHistory'});if(!/私信|搜索记录/.test(ctx)||/首页|视频|刷/.test(ctx))add({app:'douyin',op:'view',targetName:'抖音首页',targetType:'dyHome'});}if(/微博|推特|(?:^|[^a-z])X(?:[^a-z]|$)/i.test(ctx)){if(/私信/.test(ctx))add({app:'x',op:'view',targetName:'微博私信会话列表',targetType:'xDmList'});if(!/私信/.test(ctx)||(snap.x||[]).length)(snap.x||[]).slice(0,12).forEach(x=>add({app:'x',op:'view',targetName:x.owner+'发布的微博 / X「'+(x.text||'这条动态').slice(0,24)+'」',targetId:x.id,targetType:'xPost'}));}else if(/私信/.test(ctx)){add({app:'x',op:'view',targetName:'微博私信会话列表',targetType:'xDmList'});add({app:'douyin',op:'view',targetName:'抖音私信会话列表',targetType:'dyDmList'});}if(/浏览器|搜索记录|网页/.test(ctx))add({app:'browser',op:'view',targetName:'浏览器搜索记录',targetType:'browserHistory'});if(/购物|订单|买了什么/.test(ctx))add({app:'shop',op:'view',targetName:'购物订单'});if(/外卖|吃了什么/.test(ctx))add({app:'food',op:'view',targetName:'外卖订单'});if(/小鱼旅行|携程旅行|云城|云程|机票|火车票|演唱会|门票|打车|航班|行程|酒店|住宿|订房/.test(ctx))add({app:'travel',op:'view',targetName:'小鱼旅行全部行程订单'});return out;}
async function remoteControlAfterRestorePlan(c){
  const ctl=_remoteCtl,ctx=remoteControlIntentContext(c);if(!ctl)return[];if(remoteControlContextWantsBroad(ctx)){const old=ctl.purpose;ctl.purpose='inspect_phone';let all=remoteControlRequiredPlan(c);ctl.purpose=old;return remoteControlOrderPlan(c,all);}
  const candidates=remoteControlContextCandidates(c);if(!candidates.length)return[];const listed=candidates.map((a,i)=>({key:'k'+i,app:a.app,targetName:a.targetName,targetType:a.targetType,reason:a.contextReason||''}));
  const fallback=()=>{const wechat=candidates.filter(a=>a.app==='wechat'),rest=candidates.filter(a=>a.app!=='wechat');return wechat.concat(rest).slice(0,6);};
  try{const rules='你刚把'+S.me.name+'情侣空间里被关掉的权限都重新打开了。现在不要机械全查；请根据刚才吵架/微信上下文，作为'+(c.remark||c.name)+'本人，选择接下来你最在意、最符合逻辑的几个地方亲手查看。若上下文提到异性、某个角色或微信聊天，通常应先看微信列表/对应聊天；若你真的想查个遍，可以多选。最多8个，key必须照抄，只输出JSON：{"keys":["k0"]}。\n【触发上下文】\n'+ctx+'\n【可选检查点】\n'+JSON.stringify(listed);const r=await remoteControlModelCall([{role:'system',content:buildSystem(c)},{role:'user',content:rules}],{max:900,complete:true,temp:.75,aux:false},4800),o=parseObj(r),keys=Array.isArray(o&&o.keys)?o.keys.map(String):[],picked=keys.map(k=>{const m=k.match(/^k(\d+)$/);return m?candidates[+m[1]]:null;}).filter(Boolean);return picked.length?picked.slice(0,8):fallback();}catch(e){return fallback();}}
function remoteControlCompactViewPlan(list){const seen=new Set(),out=[];for(const raw of list||[]){if(!raw)continue;let a=Object.assign({},raw);if(a.targetType==='moment')a={app:'moments',op:'view',targetName:'朋友圈动态',targetType:'momentList'};else if(a.targetType==='xPost')a={app:'x',op:'view',targetName:'微博 / X动态',targetType:'xFeed'};else if(a.targetType==='dyVideo')a={app:'douyin',op:'view',targetName:'抖音首页',targetType:'dyHome'};const key=remoteControlActionKey(a);if(seen.has(key))continue;seen.add(key);out.push(a);}return out;}
async function remoteControlAutonomousPlan(c,candidates){candidates=remoteControlCompactViewPlan(remoteControlDedupPlan(candidates));if(candidates.length<=2||remoteControlContextWantsBroad(remoteControlIntentContext(c)))return candidates;const listed=candidates.map((a,i)=>({key:'p'+i,app:a.app,name:a.targetName,type:a.targetType||''})),fallback=()=>{const order=['wechat','moments','x','douyin','phoneapp','browser','shop','food','travel','calendar','mail','offline'],picked=[],seen=new Set();for(const app of order){const a=candidates.find(x=>x.app===app&&!seen.has(remoteControlActionKey(x)));if(a){seen.add(remoteControlActionKey(a));picked.push(a);}if(picked.length>=6)break;}return picked.length?picked:candidates.slice(0,6);},rules='你现在得到一次远程查看'+S.me.name+'小手机的授权。你是真实的'+(c.remark||c.name)+'，要根据你的人设、关系、刚才微信里的目的和此刻真正关心的内容，自主决定这一次想打开哪些软件或栏目。不要机械全选，不要为了展示功能而乱看；也不能反复选择同一个页面。通常选择3到8项，若目标很明确可以更少。key必须照抄且不得重复，只输出JSON：{"keys":["p0"]}。\n【刚才微信与本次目标】\n'+remoteControlIntentContext(c)+'\n【这次真实可打开的页面】\n'+JSON.stringify(listed);try{const raw=await remoteControlModelCall([{role:'system',content:buildSystem(c)},{role:'user',content:rules}],{max:720,complete:true,temp:.78,aux:false},4200),o=parseObj(raw),keys=Array.isArray(o&&o.keys)?o.keys.map(String):[],seen=new Set(),picked=[];for(const key of keys){const m=key.match(/^p(\d+)$/),a=m?candidates[+m[1]]:null,k=a&&remoteControlActionKey(a);if(a&&k&&!seen.has(k)){seen.add(k);picked.push(a);}if(picked.length>=8)break;}return picked.length?picked:fallback();}catch(e){return fallback();}}
function remoteControlVisitKey(a){return [a&&a.app||'',a&&a.targetType||'',a&&a.targetId||'',a&&a.targetName||''].join('|');}
function remoteControlMarkVisited(ctl,a){if(!ctl)return false;ctl.visitedPages=Array.isArray(ctl.visitedPages)?ctl.visitedPages:[];const key=remoteControlVisitKey(a);if(ctl.visitedPages.includes(key))return false;ctl.visitedPages.push(key);return true;}
function remoteControlRequiredPlan(c){
  const snap=remoteControlSnapshot(c),groups={},add=(app,targetName,extra)=>{groups[app]=groups[app]||[];groups[app].push(Object.assign({app,op:'view',targetName},extra||{}));};
  if(_remoteCtl&&_remoteCtl.purpose==='restore_wx')return[{app:'couple',op:'view',targetId:'wxLoginAuth',targetName:'微信登录权限（当前关闭）',targetType:'couplePermission',section:'cou_wxlogin'}];
  if(_remoteCtl&&_remoteCtl.purpose==='restore_all_permissions')return(snap.couplePermissions||[]).filter(x=>!x.enabled&&x.key!=='albumAuth').sort((a,b)=>remoteControlPermissionPageOrder(a)-remoteControlPermissionPageOrder(b)).map(x=>({app:'couple',op:'enable_couple_permission',targetId:x.key,targetName:x.name+'（当前关闭）',targetType:'couplePermission',section:x.section,restoreAll:true}));
  const direct=String(_remoteCtl&&_remoteCtl.intentContext||'').trim();if(direct&&!remoteControlContextWantsBroad(direct)){const focused=remoteControlContextCandidates(c,direct);if(focused.length)return remoteControlCompactViewPlan(focused);}
  const mentionedWechat=remoteControlMentionedWechatTargets(c);
  add('wechat','微信好友与聊天列表',{targetType:'wechatList'});
  mentionedWechat.forEach(x=>add('wechat',x.targetName,x));
  add('moments','朋友圈动态',{targetType:'momentList'});
  add('x','微博 / X动态',{targetType:'xFeed'});
  add('x','微博私信会话列表',{targetType:'xDmList'});
  add('douyin','抖音首页',{targetType:'dyHome'});
  add('douyin','抖音搜索记录',{targetType:'dySearchHistory'});
  add('douyin','抖音私信会话列表',{targetType:'dyDmList'});
  ['最近通话','短信','语音留言','通讯录'].forEach(x=>add('phoneapp',x));
  add('browser','浏览器搜索记录',{targetType:'browserHistory'});add('shop','购物订单');add('food','外卖订单');add('travel','小鱼旅行全部行程订单');
  add('calendar','日历日程');add('mail','信箱邮件');add('offline','线下约会');
  (snap.couplePermissions||[]).filter(x=>!x.enabled).forEach(x=>add('couple',x.name+'（当前关闭）',{targetId:x.key,targetType:'couplePermission',section:x.section}));
  appLayoutInit();const out=[],used=new Set();S.me.appLayout.flat().forEach(k=>{if(groups[k]){out.push(...groups[k]);used.add(k);}});Object.keys(groups).forEach(k=>{if(!used.has(k))out.push(...groups[k]);});return remoteControlCompactViewPlan(out);
}
function remoteControlActionKey(a){return [a&&a.app||'',a&&a.op||'view',a&&a.targetType||'',a&&a.targetId||'',a&&a.targetName||''].join('|');}
function remoteControlDedupPlan(list){const seen=new Set();return (list||[]).filter(a=>{const key=remoteControlActionKey(a);if(seen.has(key))return false;seen.add(key);return true;});}
function remoteControlAppendChoices(plan,at,choices){const seen=new Set((plan||[]).map(remoteControlActionKey)),fresh=remoteControlDedupPlan(choices).filter(a=>!seen.has(remoteControlActionKey(a)));if(fresh.length)plan.splice(at,0,...fresh);return fresh.length;}
async function remoteControlOrderPlan(c,required){
  if(!Array.isArray(required)||required.length<2)return required||[];
  if(required.some(a=>a&&a.contextMentioned))return remoteControlDedupPlan(required.filter(a=>a&&a.app==='wechat').concat(required.filter(a=>!a||a.app!=='wechat')));
  const apps=[],seen=new Set();required.forEach(a=>{if(a&&a.app&&!seen.has(a.app)){seen.add(a.app);apps.push(a.app);}});
  if(apps.length<2)return required;
  const choices=apps.map(app=>({app,name:REMOTE_APP_NAMES[app]||app,contents:required.filter(a=>a.app===app).map(a=>a.targetName).filter(Boolean).slice(0,24)}));
  const rules='你将开始远程查看'+S.me.name+'的小手机。下面列出的软件都必须查看，但跨软件的先后顺序不固定。必须延续刚才微信里说好的目标，不能中途像失忆一样改去做无关的事。请根据你作为'+(c.remark||c.name)+'的性格、关系、此刻最在意的方向和每个软件将要查看的栏目，自主决定先打开哪个、再打开哪个。只决定软件顺序，不能漏掉、增加或重复任何app；进入某个软件后的真实页面顺序由手机自己处理。只输出JSON：{"apps":["app键"]}。\n【刚才微信与本次目标】\n'+remoteControlIntentContext(c)+'\n【本次可查看软件】\n'+JSON.stringify(choices);
  try{const r=await remoteControlModelCall([{role:'system',content:buildSystem(c)},{role:'user',content:rules}],{max:700,complete:true,temp:.78,aux:false},4800),o=parseObj(r),picked=Array.isArray(o&&o.apps)?o.apps.map(String):[],order=[],used=new Set();picked.concat(apps).forEach(k=>{if(seen.has(k)&&!used.has(k)){used.add(k);order.push(k);}});return order.flatMap(k=>required.filter(a=>a.app===k));}catch(e){return remoteControlDedupPlan(required);}
}
function remoteControlNormalizePlan(raw,c,snap){let a=raw&&Array.isArray(raw.actions)?raw.actions:Array.isArray(raw)?raw:[];return a.slice(0,10).map(x=>{x=x||{};const op=String(x.op||'').trim(),rawApp=String(x.app||'home').trim(),app=op==='lock_app'||op==='unlock_app'?'home':(REMOTE_APP_NAMES[rawApp]?rawApp:remoteControlAppKey(rawApp)),mi=Number(x.messageIndex);return {app,op:REMOTE_ALLOWED_OPS.has(op)?op:'',targetId:String(x.targetId||'').slice(0,80),targetName:String(x.targetName||x.target||'').slice(0,100),targetType:String(x.targetType||'').slice(0,30),messageIndex:Number.isInteger(mi)?mi:-1,content:String(x.content||'').trim().slice(0,300),mode:String(x.mode||'').slice(0,20)};}).filter(x=>x.op&&x.op!=='view');}
function remoteControlAppKey(s){s=String(s||'');if(/情侣空间|权限|授权/.test(s))return'couple';if(/微信|聊天/.test(s))return'wechat';if(/朋友圈/.test(s))return'moments';if(/推特|微博|X/i.test(s))return'x';if(/抖音|短视频/.test(s))return'douyin';if(/浏览/.test(s))return'browser';if(/电话|短信|通话|通讯录|陌生号码|语音留言/.test(s))return'phoneapp';if(/小鱼旅行|携程旅行|云城|云程|机票|火车票|演唱会|门票|打车|行程|航班|酒店|住宿|订房/.test(s))return'travel';if(/购物|网购|订单/.test(s))return'shop';if(/外卖/.test(s))return'food';if(/小鱼旅行|携程旅行|云城|云程|机票|行程|航班|酒店|住宿|订房/.test(s))return'travel';if(/音乐|一起听/.test(s))return'music';if(/日历|日程/.test(s))return'calendar';if(/信箱|邮件/.test(s))return'mail';if(/任务|便签/.test(s))return'tasks';if(/线下|约会/.test(s))return'offline';if(/设置|钱包|账单|位置|电量|小事簿/.test(s))return'settings';return'home';}
async function remoteControlDecisionPlan(c,viewed){
  const snap=remoteControlSnapshot(c),intentCtx=remoteControlIntentContext(c),evidence=(viewed||[]).map(x=>{const fact=String(x.memory||x.detail||'').slice(0,700),said=(x.roleLines||[]).join(' / ');return fact+(said?'\n角色当时亲口说：'+said:'');}).filter(Boolean).join('\n').slice(0,18000);
  const viewedDm=new Set((viewed||[]).filter(x=>x.op==='view'&&(x.targetType==='xDm'||x.targetType==='dyDm')).map(x=>x.targetType+':'+x.targetId)),viewedWechat=new Set((viewed||[]).filter(x=>x.op==='view'&&['role','phoneFriend','group'].includes(x.targetType)).map(x=>x.targetType+':'+x.targetId)),viewedPhone=(viewed||[]).some(x=>x.op==='view'&&x.app==='phoneapp'),wechat={roles:(snap.wechat.roles||[]).filter(x=>viewedWechat.has('role:'+x.id)),phoneFriends:(snap.wechat.phoneFriends||[]).filter(x=>viewedWechat.has('phoneFriend:'+x.id)),groups:(snap.wechat.groups||[]).filter(x=>viewedWechat.has('group:'+x.id))},actionable={wechat,moments:snap.moments,x:snap.x,douyin:snap.douyin,xDms:(snap.xDms||[]).filter(x=>viewedDm.has('xDm:'+x.id)),douyinDms:(snap.douyinDms||[]).filter(x=>viewedDm.has('dyDm:'+x.id)),phoneContacts:viewedPhone?snap.phoneContacts:[],smsThreads:viewedPhone?snap.smsThreads:[],closedCouplePermissions:(snap.couplePermissions||[]).filter(x=>!x.enabled&&x.key!=='albumAuth'),locked:snap.locked,lockable:snap.lockable};
  const rules='你已经逐项亲眼检查完'+S.me.name+'小手机检查清单里需要看的软件，以及你从微信、微博私信和抖音私信列表里亲自选择点开的会话；每个软件只有一个连续巡查段，离开后不能再返回查看，也不能开始第二轮巡查。没想看的会话、音乐、任务便签和普通设置已经按规则跳过。你也进入情侣空间向下查看了关闭的权限。你是真实的'+(c.remark||c.name)+'，现在根据你的人设、关系、占有欲、边界、刚才微信吵架上下文、刚看到的具体证据和你当时亲口说过的话，自主决定要不要采取剩余动作；已经当场删除过的对象不会再出现在可操作对象里，绝不能重复删除。这里只能给出必要的真实处理动作，不能再输出view。动作完成后本次远控会立即结束。不是为了展示功能而乱删乱锁：没有可疑或让你不舒服的内容时，可以输出空 actions。你有权把情侣空间里被关掉的权限重新打开：使用 enable_couple_permission，app写couple，targetId必须照抄closedCouplePermissions里的key；相册照片权限albumAuth只能由用户自己开启，不能申请后自行开启；是否重开由你根据性格和本次动机决定。若某条【属于'+S.me.name+'本人】的朋友圈、抖音或微博让你不舒服，可以删除；不能删除别人的发布。删除微博/抖音私信时，delete_x_dm或delete_douyin_dm表示删除【整个私信会话】，targetId只填会话id；不能只删会话里的某一条聊天记录。如果电话通讯录里有让你不舒服的陌生/可疑联系人，可以 delete_phone_contact；如果短信会话/陌生短信让你不舒服，可以 delete_sms_thread。targetId必须照抄phoneContacts里的id或smsThreads里的key；只能删真实存在的记录，不能编造。你也可以替'+S.me.name+'发朋友圈宣示主权（post_moment，content写你决定发布的正文）、给联系人发微信、点赞/取消点赞、或在确有理由时锁定相关软件（lock_app，app写home，targetId必须来自lockable）。锁软件不需要也不允许打开普通设置页；必须基于真实疑点，没疑点就不要锁。每个决定都必须能由证据解释，禁止编造。最多10个动作。只输出JSON：{"actions":[{"app":"couple","op":"enable_couple_permission","targetId":"wxLoginAuth"},{"app":"moments","op":"post_moment","content":"正文"},{"app":"phoneapp","op":"delete_sms_thread","targetId":"短信key"},{"app":"phoneapp","op":"delete_phone_contact","targetId":"联系人id"},{"app":"x","op":"delete_x_dm","targetId":"会话id"},{"app":"home","op":"lock_app","targetId":"douyin"}]}。\n【刚才微信/通话触发上下文】\n'+intentCtx+'\n【已查看证据】\n'+evidence+'\n【可操作对象】\n'+JSON.stringify(actionable);
  try{const r=await remoteControlModelCall([{role:'system',content:buildSystem(c)},{role:'user',content:rules}],{max:2400,complete:true,aux:false},6000);return remoteControlNormalizePlan(parseObj(r),c,snap);}catch(e){return [];}}
function remoteControlFindRole(id,name,cid){return (S.contacts||[]).find(x=>!x.deleted&&x.id!==cid&&((id&&x.id===id)||(name&&(x.name===name||x.remark===name||((x.name||'').includes(name))||((x.remark||'').includes(name))))));}
function remoteControlFindMoment(a){return (S.moments||[]).find(x=>(a.targetId&&x.id===a.targetId)||(!a.targetId&&a.targetName&&(x.text||'').includes(a.targetName)));}
function remoteControlFindTweet(a){return (S.x&&S.x.tweets||[]).find(x=>(a.targetId&&x.id===a.targetId)||(!a.targetId&&a.targetName&&(x.text||'').includes(a.targetName)));}
function remoteControlFindDy(a){return dyVid(a.targetId)||(S.dy&&S.dy.mine||[]).find(x=>a.targetName&&(x.desc||'').includes(a.targetName));}
function remoteControlResolveApp(a){const k=(a.targetId&&LOCKABLE[a.targetId])?a.targetId:_appKeys(a.targetName||a.content,Object.keys(LOCKABLE),()=>true)[0];return k||'';}
function remoteControlViewFact(a,c){const app=a.app||remoteControlAppKey(a.targetName),snap=remoteControlSnapshot(c&&c.id),v=snap.viewable||{},name=REMOTE_APP_NAMES[app]||a.targetName||'这个软件',target=a.targetName||name;let rows=[];
  if(app==='wechat'){
    if(a.targetType==='wechatList')rows=remoteControlWechatCandidates(c).map(x=>(x.pinned?'[置顶] ':'')+x.name+'：'+String(x.preview||'暂无聊天'));
    else if(a.targetType==='internalGroup'){const g=(S.groups||[]).find(x=>x.id===a.targetId);rows=g?(g.msgs||[]).slice(-30).map(m=>'['+factStamp(m.time||Date.now())+'] '+(m.senderId==='me'?S.me.name:(getC(m.senderId)?getC(m.senderId).name:'群成员'))+'：'+gmText(m)):[];}
    else{const source=a.targetType==='role'?snap.wechat.roles:a.targetType==='phoneFriend'?snap.wechat.phoneFriends:a.targetType==='group'?snap.wechat.groups:null;
    if(source){const row=source.find(x=>x.id===a.targetId);rows=row?[row.name+'：'+String(row.last||'暂无聊天')]:[];}
    else rows=[...(snap.wechat.roles||[]),...(snap.wechat.phoneFriends||[]),...(snap.wechat.groups||[])].map(x=>x.name+'：'+String(x.last||'暂无聊天'));
    }
  }
  else if(app==='moments'){const row=a.targetId&&(snap.moments||[]).find(x=>x.id===a.targetId);rows=row?[row.owner+'：'+row.text]:(snap.moments||[]).map(x=>x.owner+'：'+x.text);}
  else if(app==='x'){
    if(a.targetType==='xDmList')rows=remoteControlDmCandidates('x').map(x=>x.name+'：'+x.preview);
    else if(a.targetType==='xDm'){const d=(snap.xDms||[]).find(x=>x.id===a.targetId);rows=d?(d.msgs||[]).map(m=>m.index+'｜'+(m.timeText||factStamp(m.time||Date.now()))+'｜'+m.from+'：'+m.text):[];}
    else{const row=a.targetId&&(snap.x||[]).find(x=>x.id===a.targetId);rows=row?[row.owner+'：'+row.text]:(snap.x||[]).map(x=>x.owner+'：'+x.text);}
  }
  else if(app==='douyin'){
    if(a.targetType==='dyDmList')rows=remoteControlDmCandidates('douyin').map(x=>x.name+'：'+x.preview);
    else if(a.targetType==='dyDm'){const d=(snap.douyinDms||[]).find(x=>x.id===a.targetId);rows=d?(d.msgs||[]).map(m=>m.index+'｜'+(m.timeText||factStamp(m.time||Date.now()))+'｜'+m.from+'：'+m.text):[];}
    else if(a.targetType==='dySearchHistory')rows=(S.dy&&S.dy.history||[]).map(x=>'搜索“'+String(x).slice(0,100)+'”');
    else if(a.targetType==='dyHome')rows=(S.dy&&S.dy.feed||[]).slice(0,4).map(x=>(x.author||'用户')+'：'+String(x.desc||'').slice(0,180));
    else{const row=a.targetId&&(snap.douyin||[]).find(x=>x.id===a.targetId);rows=row?[row.owner+'：'+row.text]:(snap.douyin||[]).map(x=>x.owner+'：'+x.text);}
  }
  else if(app==='couple'){const row=(snap.couplePermissions||[]).find(x=>x.key===a.targetId);rows=row?[row.name+'：'+(row.enabled?'已开启':'当前关闭')]:((snap.couplePermissions||[]).map(x=>x.name+'：'+(x.enabled?'已开启':'当前关闭')));}
  else if(app==='browser')rows=v.browser||[];
  else if(app==='phoneapp'){if(/短信|信息/.test(target))rows=v.phoneSms||[];else if(/留言/.test(target))rows=v.phoneVoicemail||[];else if(/通讯录|联系人/.test(target))rows=v.phoneContacts||[];else rows=v.phoneCalls||[];}
  else if(app==='shop')rows=v.shopOrders||[];
  else if(app==='food'){rows=v.foodOrders||[];if(/顾客|收单|卖出|店铺订单/.test(target))rows=rows.filter(x=>/顾客|店铺收到/.test(x));else if(/我的订单|我买|购买订单/.test(target))rows=rows.filter(x=>!/顾客|店铺收到/.test(x));}
  else if(app==='travel')rows=(v.travelTrips||[]).concat(v.hotelStays||[],v.attractionTickets||[]);
  else if(app==='calendar')rows=v.calendar||[];
  else if(app==='mail')rows=v.mail||[];
  else if(app==='tasks')rows=v.tasks||[];
  else if(app==='offline')rows=v.offline||[];
  else if(app==='music')rows=v.music||[];
  else if(app==='settings'){if(/钱包|账单|消费/.test(target))rows=v.wallet||[];else if(/小事簿|生活/.test(target))rows=v.lifeNotes||[];else if(/位置/.test(target))rows=['当前位置：'+v.location];else if(/电量/.test(target))rows=['当前电量：'+v.battery];else rows=['当前位置：'+v.location,'当前电量：'+v.battery].concat((v.wallet||[]).slice(0,3));}
  const seen=rows.filter(Boolean).slice(0,30),fact=seen.length?seen.join('；'):'没有看到相关记录',short=fact.slice(0,2400);return {app,label:name,detail:'正在查看'+target+'：'+short,memory:'查看了'+S.me.name+'小手机里的「'+target+'」，实际看到：'+short,facts:seen};}
