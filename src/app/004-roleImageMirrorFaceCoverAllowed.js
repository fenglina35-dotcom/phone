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
  const starts=[];let curCall=null;
  for(let i=0;i<arr.length;i++){const m=arr[i];if(!m)continue;
    if(m._call){const cs='cs'+(m._cs||'x');if(cs!==curCall){curCall=cs;starts.push(i);}}
    else{curCall=null;if(m.role==='user')starts.push(i);}}
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
  const body={model:opt.model||a.model,max_tokens:budget+answer,thinking:{type:'enabled',budget_tokens:budget,display:'summarized'},messages:rows};if(system.length)body.system=system;
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
  const choice=data&&data.choices&&data.choices[0],message=choice&&choice.message||{},value=typeof message.reasoning_content==='string'?message.reasoning_content:typeof message.reasoning==='string'?message.reasoning:'';
  const summary=value.replace(/\b(?:sk|key)-[A-Za-z0-9_.-]{8,}\b/gi,'[密钥已隐藏]').replace(/Bearer\s+[A-Za-z0-9._~+\/-]{8,}/gi,'Bearer [已隐藏]');
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
async function chatResultText(messages,opt,data){const ch=data&&data.choices&&data.choices[0],reason=''+(ch&&ch.finish_reason||'');const rawText=roleMoodScopeText(String(ch&&ch.message&&ch.message.content||''),opt);let text=rawText.trim();if(opt.roleReplyLanguageGuard&&!(opt.roleVoiceFormatRepair&&voiceReplyCanRepairCandidate(text,opt))){text=roleReplyDropEnglishNarration(text);roleReplyAssertLanguage(text,opt.roleInterceptAudit);}/* 续写这一段不再跑「纯英文拦截」：它是同一条回复被截断的后半截，不是一条独立回复；前半截已经过了语言检查，中文就在里面，拿整段的标准去卡一个句子碎片，只会让外语通话在续写时整轮失败，弹出一句莫名其妙的提示。   续写必须排在原文直通之前：回复被长度上限截断时，原文同样需要补完，否则把线上/线下的回复长度设短一点，   回复就会随随便便断在半句。续写调用不记入候选，它是同一条回复的后半段，不是第二份候选。 */if(opt.complete&&text&&/length|max_tokens/i.test(reason)){const base=opt.unfilteredOutput?rawText:text,follow=await chatAPI([...messages,{role:'assistant',content:base},{role:'user',content:'[系统：你刚才因为输出长度上限，最后一句被截断了。请从断掉的位置直接接着写完，只补全没说完的内容；不要重头重复，不要解释原因。]'}],Object.assign({},opt,{complete:false,max:Math.max(400,Math.min(900,+opt.max||600)),roleInterceptAudit:null,roleReplyLanguageGuard:false,roleInterceptPurpose:'length-continuation'}));return joinAIContinuation(base,follow);}if(opt.unfilteredOutput)return rawText;if(opt.rejectRefusal&&/content[_ -]?filter|refusal/i.test(reason)){const e=new Error('模型拒绝了本轮回复');e.code='model-refusal';e.modelRefusal=true;e.finishReason=reason;throw e;}return text;}
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
 ['wechat','微信聊天','聊天与通话',0,'在角色资料「主模型 / 副模型」切换','aiReply','wechatPrimaryReply','wechatRoleRepair'],
 ['call','通话','聊天与通话',0,'跟角色资料「主模型 / 副模型」','callChatWithRetry'],
 ['cohab','共同生活','聊天与通话',0,'在共同生活设置「对话模型」切换','cohabRoleChat'],
 ['offline','单次约会','聊天与通话',0,'在单次约会「约会设定」的「对话模型」切换','offAI'],
 ['wechat_group','微信群聊','微信',0,1,'groupRoleReplyItems','groupBatchReplyItems'],
 ['wx_nearby','附近的人','微信',1,1,'wxNearbyRefresh'],
 ['friend_request','新好友申请','微信',0,1,'createFriendRequest'],
 ['translate','角色消息翻译','微信',1,1,'roleTextTranslationRun','app.js:ask'],
 ['alter','角色小号回复','微信',0,1,'alterReply'],
 ['pursuit','被拉黑后想办法联系','微信',0,1,'pursuitDecide','pursuitForce'],
 ['pf_group','真人好友群里的角色','微信',0,1,'pf-group-role.js:reply'],
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
 ['tasks','任务便签·布置任务','信箱与任务',0,1,'genTasks'],
 ['task_notes','任务便签·小猫和水晶球的信','信箱与任务',0,1,'task-notes.js:writeLine','task-notes.js:writeLetter'],
 ['jail','小黑屋·对话','线下与剧情',0,'在情侣空间「禁闭室用辅助模型」切换','jailAI'],
 ['jail_summary','小黑屋·结束总结','线下与剧情',0,1,'summarizeJail'],
 ['rp','角色扮演·对话','线下与剧情',0,'在单次约会设置「角色扮演软件使用副模型」切换','rpAI'],
 ['rp_setup','角色扮演·开局和结束存档','线下与剧情',0,1,'rpCreateInviteFromAI','rpEnd'],
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
const MODEL_FEATURE_SKIP=new Set(['chatAPI','aiGen','dyAuxChat','offlineReplyChatRequest','offlineForegroundRequest','request','chatResultText','modelFeatureOf','modelFeatureFrames','Promise','anonymous','eval','global code','module code','asyncFunctionResume','promiseReactionJob','']);
let _modelFeatureIndex=null,_modelFeatureSeenMap=null,_modelLedgerFilter={feature:'',route:'',failed:false};
function modelFeatureIndex(){if(_modelFeatureIndex)return _modelFeatureIndex;const byFn={},byKey={};MODEL_FEATURES.forEach(r=>{const info={key:r[0],label:r[1],group:r[2],def:r[3],toggle:r[4]===1,where:typeof r[4]==='string'?r[4]:''};byKey[r[0]]=info;r.slice(5).forEach(n=>{byFn[n]=info;});});return _modelFeatureIndex={byFn,byKey};}
function modelFeatureFrames(stack){return String(stack||'').split('\n').map(line=>{line=line.trim();let name='',file='',m=line.match(/^at\s+(?:async\s+)?([^\s(]+)\s+\((.*)\)$/);if(m){name=m[1];file=m[2];}else if((m=line.match(/^at\s+(.*)$/)))file=m[1];else if((m=line.match(/^([^@]*)@(.*)$/))){name=m[1];file=m[2];}name=String(name||'').replace(/^async\*/,'').replace(/^.*[.\/]/,'');file=String(file||'').replace(/[?#].*$/,'').replace(/:\d+(?::\d+)?\)?$/,'').replace(/^.*\//,'');return{name,file};}).filter(f=>f.name||f.file);}
function modelFeatureOf(opt){opt=opt||{};const idx=modelFeatureIndex();
 if(opt.roleInterceptPurpose==='length-continuation'&&opt.diagnosticFeatureKey){const info=idx.byKey[opt.diagnosticFeatureKey],base=info?info.label:String(opt.diagnosticFeature||'其他').replace(/（接着写）$/,'');return Object.assign({key:opt.diagnosticFeatureKey,group:'其他',def:0,toggle:false},info||{},{label:base+'（接着写）'});}
 let frames=[];try{frames=modelFeatureFrames(new Error().stack);}catch(_){}
 const cont=frames.some(f=>f.name==='chatResultText'||f.name==='spyContinueJson');let first='';
 for(const f of frames){if(MODEL_FEATURE_SKIP.has(f.name))continue;const hit=idx.byFn[f.file+':'+f.name]||idx.byFn[f.name];if(hit)return Object.assign({},hit,{label:hit.label+(cont?'（接着写）':'')});if(!first&&f.name)first=f.name;}
 return{key:first?'fn:'+first:'',label:first?'其他（'+first+'）':'其他',group:'其他',def:0,toggle:false};}
function modelFeatureOverride(key){const m=S.settings&&S.settings.modelFeatureAux;return m&&Object.prototype.hasOwnProperty.call(m,key)?(m[key]?'aux':'main'):'';}
function modelFeatureSeenMap(){if(!_modelFeatureSeenMap){try{_modelFeatureSeenMap=JSON.parse(localStorage.getItem('north-model-feature-seen')||'{}')||{};}catch(_){_modelFeatureSeenMap={};}}return _modelFeatureSeenMap;}
/* 记下这个功能原来（没拨开关时）用的是主还是副；见过一次主模型就算主模型（有的功能只在主模型失败后才用副模型补救）。 */
function modelFeatureSeen(key,aux){const m=modelFeatureSeenMap(),next=m[key]===false?false:!!aux;if(m[key]===next)return;m[key]=next;try{localStorage.setItem('north-model-feature-seen',JSON.stringify(m));}catch(_){}}
function modelFeatureDefaultAux(info){if(!info)return false;if(info.def==='spy')return !!(S.settings&&S.settings.spyAux);if(info.def==='game')return typeof gameModelUseAux==='function'&&!!gameModelUseAux();const seen=modelFeatureSeenMap();return Object.prototype.hasOwnProperty.call(seen,info.key)?!!seen[info.key]:!!info.def;}
function modelFeatureUsesAux(info){const ov=info&&modelFeatureOverride(info.key);return ov?ov==='aux':modelFeatureDefaultAux(info);}
function modelFeatureApply(feature,opt){if(!feature||!feature.toggle||!feature.key)return;modelFeatureSeen(feature.key,!!opt.aux);const ov=modelFeatureOverride(feature.key);if(ov)opt.aux=ov==='aux';}
function modelFeatureChangedCount(){const m=S.settings&&S.settings.modelFeatureAux;return m?Object.keys(m).length:0;}
function modelFeatureToggle(key,el){const info=modelFeatureIndex().byKey[key];if(!info||!info.toggle)return;const next=!modelFeatureUsesAux(info);S.settings.modelFeatureAux=S.settings.modelFeatureAux||{};if(next===modelFeatureDefaultAux(info))delete S.settings.modelFeatureAux[key];else S.settings.modelFeatureAux[key]=next;save();if(el){el.classList.toggle('on',modelFeatureUsesAux(info));const tag=el.parentNode&&el.parentNode.querySelector('[data-mf-tag]');if(tag)tag.textContent=modelFeatureOverride(key)?'已改':'';}const n=document.getElementById('mfChanged');if(n)n.textContent=modelFeatureChangedCount()?'已改 '+modelFeatureChangedCount()+' 项':'全部是原来的做法';}
function modelFeatureReset(){if(S.settings)delete S.settings.modelFeatureAux;save();modelFeatureListOpen();toast('已全部恢复成原来的做法');}
function modelFeatureListOpen(){const idx=modelFeatureIndex(),groups=[],seen={};MODEL_FEATURES.forEach(r=>{const info=idx.byKey[r[0]];if(!seen[info.group]){seen[info.group]=[];groups.push([info.group,seen[info.group]]);}seen[info.group].push(info);});
 const html=groups.map(([g,items])=>'<div style="margin:14px 0 6px;font-size:12px;color:#8e8e93">'+esc(g)+'</div>'+items.map(info=>{if(!info.toggle)return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 12px;border-bottom:1px solid rgba(127,127,127,.18)"><span style="flex:1;min-width:0">'+esc(info.label)+'</span><span style="font-size:12px;color:#8e8e93;text-align:right;max-width:52%">'+esc(info.where||'不能切换')+'</span></div>';const on=modelFeatureUsesAux(info),hint='';return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 12px;border-bottom:1px solid rgba(127,127,127,.18)"><span style="flex:1;min-width:0">'+esc(info.label)+(hint?'<small style="display:block;color:#8e8e93;font-weight:400">'+esc(hint)+'</small>':'')+'</span><span style="display:flex;align-items:center;gap:8px;flex:none"><small data-mf-tag style="color:#ff9f0a">'+(modelFeatureOverride(info.key)?'已改':'')+'</small><span class="sw '+(on?'on':'')+'" onclick="modelFeatureToggle(\''+info.key+'\',this)"></span></span></div>';}).join('')).join('');
 const n=modelFeatureChangedCount();
 openModal('<h3>副模型使用清单</h3><div class="hint">打开＝这个功能用副模型，关掉＝用主模型。开关一开始的位置就是原来的做法，没拨过的功能和以前完全一样。这条线路没填副模型时，打开了也用主模型。功能里本来就有主/副切换的（比如游戏大厅、查他手机、角色扮演、小黑屋、各种总结），不在这里放开关，右边写着去哪里切换；主模型失败后改用副模型再试一次的补救照旧保留。</div><div id="mfChanged" style="font-size:12px;color:#ff9f0a;margin-top:6px">'+(n?'已改 '+n+' 项':'全部是原来的做法')+'</div><div style="max-height:46vh;overflow:auto;margin-top:4px">'+html+'</div><div class="btns"><button class="btn g" onclick="modelFeatureReset()">全部恢复默认</button><button class="btn p" onclick="closeModal()">好了</button></div>');}
function modelLedgerRows(){return typeof NorthRequestDiagnostics!=='undefined'&&typeof NorthRequestDiagnostics.listAll==='function'?NorthRequestDiagnostics.listAll().filter(r=>r&&r.kind==='request'):[];}
function modelLedgerRouteName(i){i=parseInt(i,10);return Number.isInteger(i)&&typeof CHAT_ROUTE_NAMES!=='undefined'&&CHAT_ROUTE_NAMES[i]?CHAT_ROUTE_NAMES[i]:'线路未记录';}
function modelLedgerRoleName(id){const c=id&&typeof getC==='function'?getC(id):null;return c?(c.remark||c.name||''):'';}
function modelLedgerSeconds(ms){ms=+ms||0;return ms<1000?'不到 1 秒':(Math.round(ms/100)/10)+' 秒';}
function modelLedgerState(r){return r.state==='returned'?['成功','#30d158']:r.state==='failed'?['失败','#ff453a']:r.state==='empty'?['没有正文','#ff9f0a']:['还在等','#8e8e93'];}
function modelLedgerRoutesHTML(){const rs=chatRoutesInit(),act=Math.max(0,parseInt(S.settings.chatRouteActive,10)||0);return rs.map((r,i)=>{if(!r||!(r.base||r.model))return '';const users=(S.contacts||[]).filter(c=>c&&!c.deleted&&!c.isPhoneFriend&&roleChatRouteIndex(c)===i).map(c=>c.remark||c.name).filter(Boolean);return '<div style="background:rgba(127,127,127,.12);border-radius:12px;padding:10px 12px;margin:8px 0;font-size:13px;line-height:1.6"><b>'+esc(modelLedgerRouteName(i))+(i===act?' · 默认线路':'')+'</b><div>主模型：'+esc(r.model||'没填')+'</div><div>副模型：'+esc(r.aux&&r.aux.model?r.aux.model:'没填（用主模型）')+'</div><div style="color:#8e8e93">'+(users.length?'用这条线路的角色：'+esc(users.join('、')):'没有角色在用这条线路')+'</div></div>';}).join('')||'<p class="hint">还没有填好的线路。</p>';}
function modelLedgerFilterSet(k,v){_modelLedgerFilter[k]=k==='failed'?!!v:String(v||'');modelLedgerOpen();}
function modelLedgerOpen(){const all=modelLedgerRows(),f=_modelLedgerFilter,feats=[...new Set(all.map(r=>(r.feature||'其他').replace(/（接着写）$/,'')))],routes=[...new Set(all.map(r=>r.routeIndex).filter(x=>x!=null))];
 const list=all.filter(r=>(!f.feature||(r.feature||'其他').replace(/（接着写）$/,'')===f.feature)&&(f.route===''||String(r.routeIndex)===f.route)&&(!f.failed||r.state==='failed'));
 const sel='padding:6px 8px;border-radius:8px;font-size:13px;max-width:48%';
 const filters='<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><select style="'+sel+'" onchange="modelLedgerFilterSet(\'feature\',this.value)"><option value="">全部功能</option>'+feats.map(x=>'<option value="'+esc(x)+'"'+(f.feature===x?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select><select style="'+sel+'" onchange="modelLedgerFilterSet(\'route\',this.value)"><option value="">全部线路</option>'+routes.map(x=>'<option value="'+esc(String(x))+'"'+(f.route===String(x)?' selected':'')+'>'+esc(modelLedgerRouteName(x))+'</option>').join('')+'</select><label style="font-size:13px;display:flex;align-items:center;gap:4px"><input type="checkbox"'+(f.failed?' checked':'')+' onchange="modelLedgerFilterSet(\'failed\',this.checked)">只看失败</label></div>';
 const rows=list.slice(0,150).map(r=>{const st=modelLedgerState(r),role=modelLedgerRoleName(r.roleId);return '<div onclick="modelLedgerDetail(\''+esc(r.id)+'\')" style="cursor:pointer;border-bottom:1px solid rgba(127,127,127,.2);padding:9px 2px"><div style="display:flex;justify-content:space-between;gap:8px"><b style="font-size:14px">'+esc(r.feature||'其他')+'</b><span style="color:'+st[1]+';font-size:13px;white-space:nowrap">'+st[0]+'</span></div><div style="font-size:12px;color:#8e8e93;line-height:1.5;overflow-wrap:anywhere">'+esc(fmtDT(r.at))+(role?' · '+esc(role):'')+' · '+esc(modelLedgerRouteName(r.routeIndex))+' · '+esc(r.slot||'')+' · '+esc(r.model||'模型未记录')+(r.duration!=null&&r.state!=='started'?' · '+modelLedgerSeconds(r.duration):'')+'</div>'+(r.state==='failed'?'<div style="font-size:12px;color:#ff453a;overflow-wrap:anywhere">'+esc(r.rawError||r.error||r.reason||'')+'</div>':'')+'</div>';}).join('');
 openModal('<h3>全部调用记录</h3><div class="hint">只在这台手机上记最近 200 次模型调用，不上传，密钥自动隐藏。点一条看明细。</div>'+filters+'<div style="max-height:56vh;overflow:auto"><details style="margin:4px 0 8px"><summary style="font-weight:600">当前线路配置</summary>'+modelLedgerRoutesHTML()+'</details>'+(rows||'<p class="hint">'+(all.length?'没有符合筛选的记录。':'还没有记录。更新后下一次调用模型就会出现在这里。')+'</p>')+'</div><div class="btns"><button class="btn g" onclick="modelFeatureListOpen()">副模型使用清单</button><button class="btn p" onclick="closeModal()">关闭</button></div>');}
function modelLedgerDetail(id){const r=modelLedgerRows().find(x=>x.id===id);if(!r)return;const st=modelLedgerState(r),role=modelLedgerRoleName(r.roleId),line=(k,v)=>v===''||v==null?'':'<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid rgba(127,127,127,.15);font-size:13px"><span style="color:#8e8e93;min-width:5.5em">'+esc(k)+'</span><span style="overflow-wrap:anywhere">'+esc(String(v))+'</span></div>',prev=typeof NorthRequestDiagnostics!=='undefined'&&typeof NorthRequestDiagnostics.preview==='function'?NorthRequestDiagnostics.preview(r.id):'';
 openModal('<h3>'+esc(r.feature||'其他')+'</h3>'+line('时间',fmtDT(r.at))+line('结果',st[0]+(r.state==='failed'&&r.reason?'：'+r.reason:''))+line('角色',role)+line('线路',modelLedgerRouteName(r.routeIndex))+line('主/副',r.slot)+line('请求的模型',r.model)+line('实际回复的模型',r.responseModel)+line('接口域名',r.endpointOrigin)+line('HTTP',r.status||'')+line('耗时',r.duration!=null?modelLedgerSeconds(r.duration):'')+line('输入/输出',(r.inputTokens!=null||r.outputTokens!=null)?(r.inputTokens!=null?r.inputTokens:'?')+' / '+(r.outputTokens!=null?r.outputTokens:'?')+' token':'')+line('请求长度',r.requestChars?r.requestChars+' 字符':'')+line('返回正文',r.bodyChars!=null?r.bodyChars+' 字符':'')+line('结束原因',r.finishReason)+line('原始错误',r.rawError||r.error)+line('第几次',r.attempt)+line('小手机版本',r.version)+(prev?'<details style="margin-top:8px"><summary>本机响应片段</summary><pre style="white-space:pre-wrap;font-size:12px">'+esc(prev)+'</pre></details>':'')+'<div class="btns"><button class="btn g" onclick="modelLedgerOpen()">返回列表</button><button class="btn p" onclick="closeModal()">关闭</button></div>');}
//@@ web
async function chatAPI(messages,opt){opt=opt||{};const _modelFeature=typeof modelFeatureOf==='function'?modelFeatureOf(opt):null;if(_modelFeature){opt.diagnosticFeatureKey=_modelFeature.key;opt.diagnosticFeature=_modelFeature.label;}messages=roleMoodScopeMessages(messages,opt);const _requestDiag=chatRequestDiagnostic('begin',messages,opt);try{const startedAt=Date.now();if(!opt.independentRoleModel&&gameModelSessionPage())opt.aux=gameModelUseAux();else if(!opt.independentRoleModel&&chatRouteSessionPage()&&!opt.allowSessionModel)opt.aux=false;if(_modelFeature&&typeof modelFeatureApply==='function')modelFeatureApply(_modelFeature,opt);const fixedRoute=chatRequestRoute(opt.routeIndex);opt._diagRoute=fixedRoute?parseInt(opt.routeIndex,10):Math.max(0,parseInt(S.settings&&S.settings.chatRouteActive,10)||0);let a=fixedRoute?chatMainCopy(fixedRoute):S.settings.chat;
//@@ private
async function chatAPI(messages,opt){opt=opt||{};const _modelFeature=typeof modelFeatureOf==='function'?modelFeatureOf(opt):null;if(_modelFeature){opt.diagnosticFeatureKey=_modelFeature.key;opt.diagnosticFeature=_modelFeature.label;}messages=roleMoodScopeMessages(messages,opt);const _requestDiag=chatRequestDiagnostic('begin',messages,opt);try{if(!opt.independentRoleModel&&gameModelSessionPage())opt.aux=gameModelUseAux();else if(!opt.independentRoleModel&&chatRouteSessionPage()&&!opt.allowSessionModel)opt.aux=false;if(_modelFeature&&typeof modelFeatureApply==='function')modelFeatureApply(_modelFeature,opt);const fixedRoute=chatRequestRoute(opt.routeIndex);opt._diagRoute=fixedRoute?parseInt(opt.routeIndex,10):Math.max(0,parseInt(S.settings&&S.settings.chatRouteActive,10)||0);let a=fixedRoute?chatMainCopy(fixedRoute):S.settings.chat;
//@@ end
  const pendingAux=opt.aux?(fixedRoute?fixedRoute.aux:S.settings.aux):null,guardModel=opt.model||((pendingAux&&pendingAux.model)||a.model);chatModelAssertText(guardModel,opt.aux?'辅助模型':'聊天模型');

  if(opt.aux){const x=fixedRoute?fixedRoute.aux:S.settings.aux;if(x&&x.model)a=Object.assign({},a,{base:x.base||a.base,key:x.key||a.key,model:x.model});else opt._auxMissing=true;}
//@@ web
  if(!a.base||!a.key)throw annotateChatRequestError(new Error('还没设置聊天 API（去 设置→API）'),opt,fixedRoute,a,startedAt);
//@@ private
  if(!a.base||!a.key)throw new Error('还没设置聊天 API（去 设置→API）');
//@@ end
  const _thinkingPlan=typeof roleThinkingRequest==='function'?roleThinkingRequest(messages,opt,a):null;
  chatRequestDiagnostic('configured',_requestDiag,_thinkingPlan?Object.assign({},opt,{max:_thinkingPlan.body.max_tokens}):opt,a,false);
  const stream=opt.stream==null?S.settings.chatStreaming===true:opt.stream===true;const request=async()=>{let res;try{res=await fetchT(_thinkingPlan?_thinkingPlan.url:a.base.replace(/\/+$/,'')+'/chat/completions',{method:'POST',
    headers:_thinkingPlan?_thinkingPlan.headers:{'Content-Type':'application/json','Authorization':'Bearer '+a.key},
//@@ web
    body:JSON.stringify(_thinkingPlan?_thinkingPlan.body:{model:opt.model||a.model,temperature:(opt.temp!=null?opt.temp:Number(a.temp))||0.8,max_tokens:opt.max||Number(a.maxTokens)||900,messages,...(a.reasoningEnabled===true?{reasoning_effort:['low','high','max'].includes(a.reasoningEffort)?a.reasoningEffort:'high'}:{}),...(stream?{stream:true}:{})})},Math.max(10000,Math.min(190000,+opt.timeout||190000)));}catch(cause){const e=new Error(apiCaughtCN(cause));e.transportRaw=String(cause&&cause.message||cause||'').slice(0,500);e.transportName=String(cause&&cause.transportName||cause&&cause.name||'');e.transportTimedOut=!!(cause&&cause.transportTimedOut);e.transportTimeoutMs=Number(cause&&cause.transportTimeoutMs)||Math.max(10000,Math.min(190000,+opt.timeout||190000));throw annotateChatRequestError(e,opt,fixedRoute,a,startedAt);}
//@@ private
    body:JSON.stringify(_thinkingPlan?_thinkingPlan.body:{model:opt.model||a.model,temperature:(opt.temp!=null?opt.temp:Number(a.temp))||0.8,max_tokens:opt.max||Number(a.maxTokens)||900,messages,...(a.reasoningEnabled===true?{reasoning_effort:['low','high','max'].includes(a.reasoningEffort)?a.reasoningEffort:'high'}:{}),...(stream?{stream:true}:{})})},Math.max(10000,Math.min(190000,+opt.timeout||190000)));}catch(cause){const e=new Error(apiCaughtCN(cause));e.transportRaw=String(cause&&cause.message||cause||'').slice(0,500);e.transportName=String(cause&&cause.transportName||cause&&cause.name||'');e.transportTimedOut=!!(cause&&cause.transportTimedOut);e.transportTimeoutMs=Number(cause&&cause.transportTimeoutMs)||Math.max(10000,Math.min(190000,+opt.timeout||190000));e.elapsedMs=Math.max(0,Date.now()-(_requestDiag&&_requestDiag.at||Date.now()));throw e;}
//@@ end
  let d=await chatReadDiagnosticResponse(res,_requestDiag,_thinkingPlan?false:stream,Math.max(10000,Math.min(190000,+opt.timeout||190000)));if(_thinkingPlan&&res.ok)d=roleThinkingNativeResult(d);return{res,d};};
  const {res,d}=opt.offlineForeground?await offlineForegroundRequest(request,opt):await request();
//@@ web
  if(!res.ok){const raw=String((d&&d.error&&(d.error.message||JSON.stringify(d.error)))||(d&&JSON.stringify(d))||'');const e=new Error(apiErrorCN(res.status,raw));e.status=res.status;e.data=d||null;e.raw=raw;e.source='external-chat';throw annotateChatRequestError(e,opt,fixedRoute,a,startedAt);}
  try{const out=await chatResultText(messages,opt,d);roleInterceptDiagnosticTurnCandidate(opt.roleInterceptAudit,out,opt.roleInterceptStage);if(typeof roleThinkingCapture==='function')roleThinkingCapture(opt,d,out);chatRequestDiagnostic('result',_requestDiag,out);return out;}catch(e){throw annotateChatRequestError(e,opt,fixedRoute,a,startedAt);}
//@@ private
  if(!res.ok){const raw=String((d&&d.error&&(d.error.message||JSON.stringify(d.error)))||(d&&JSON.stringify(d))||'');const e=new Error(apiErrorCN(res.status,raw));e.status=res.status;e.data=d||null;e.raw=raw;e.source='external-chat';throw e;}
  const out=await chatResultText(messages,opt,d);if(typeof roleThinkingCapture==='function')roleThinkingCapture(opt,d,out);chatRequestDiagnostic('result',_requestDiag,out);return out;
//@@ end
}catch(e){chatRequestDiagnostic('error',_requestDiag,e);throw e;}
}
function uniq(arr){const out=[];(arr||[]).forEach(x=>{x=(x||'').trim();if(x&&!out.includes(x))out.push(x);});return out;}
let _visionLast={},_visionModelCache={};
function visionModels(a,extra){return uniq([a&&a.model,a&&a.fallbackModel,a&&a.lastGoodModel,...(extra||[])]);}
function visionImagePart(dataURL,detail){return {type:'image_url',image_url:detail===false?{url:dataURL}:{url:dataURL,detail:'auto'}};}
function visionNoImageText(t){return /没有.{0,8}(附带|附上|收到|提供|看到).{0,6}(图片|图像|照片)|未.{0,6}(附带|收到|提供).{0,6}(图片|图像|照片)|没.{0,6}(附图|图片|图像|照片)|看不到.{0,5}(图片|图像|照片)|no image|image.{0,12}not (provided|attached|found)|without an image/i.test(''+(t||''));}
function roleImageFailureText(t){return visionNoImageText(t)||/(图片|照片|图像).{0,10}(没显示|显示不出|识别失败|解析失败|看不清|看不到|没出来)|没.{0,5}(显示|识别|解析).{0,5}(图片|照片|图像)/i.test(''+(t||''));}
function visionText(d){let c=d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content;
  if(Array.isArray(c))c=c.map(x=>x&&((x.type==='text'&&x.text)||x.text)||'').join('\n');
  if(typeof c==='string'&&c.trim())return c.trim();
  if(Array.isArray(d&&d.content)){const t=d.content.map(x=>x&&x.type==='text'?(x.text||''):'').join('\n').trim();if(t)return t;}
  return typeof(d&&d.output_text)==='string'?d.output_text.trim():'';}
function visionData(dataURL){const m=(''+dataURL).match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/i);return m?{media:m[1].toLowerCase(),data:m[2]}:null;}
function visionNativeURL(base){let b=(''+base).replace(/\/+$/,'').replace(/\/chat\/completions$/i,'');return /\/v1$/i.test(b)?b+'/messages':b+'/v1/messages';}
function visionIsClaude(model){return /^claude(?:-|\.|$)/i.test(''+model);}
/* VISION_NO_SUPPORT_MSG_V1（2026-10-30 她要求）：模型本身看不了图时直说「没有识图功能」，不再报成请求格式错误误导人。 */
function visionNoSupportText(text){return /(does\s*n[o']?t|do\s*not|not|no|un)\s*support\w*.{0,30}(image|vision|multimodal|multi-modal|picture|img)|(image|vision|multimodal|image_url|image input|images?).{0,30}(not|un)\s*(supported|support|allowed|available)|text[- ]only|only supports? text|不支持.{0,10}(图片|图像|识图|视觉|多模态|image)|(图片|图像|多模态|视觉).{0,6}(不支持|不可用)|纯文本模型/i.test(String(text||''));}
function visionPlainError(e){const info=e&&e.visionInfo||{},msg=String(e&&e.message||'识图失败').replace(/^vision-fail:\s*/,'');if(info.kind==='no_vision'||info.kind==='no_image'||visionNoSupportText(msg))return'这个模型没有识图功能（看不了图片）。请在 设置 → 识图 里换一个能看图的模型';return msg.slice(0,180);}
function visionErrKind(status,text){if(status>=400&&status<500&&status!==401&&status!==402&&status!==429&&typeof visionNoSupportText==='function'&&visionNoSupportText(text))return'no_vision';text=(''+text).toLowerCase();if(status===401)return'auth';if(status===402)return'balance';if(status===403)return'permission';if(status===404||status===405)return'endpoint';if(status===413||/(too large|payload|body.{0,12}large|image.{0,12}size|pixels)/.test(text))return'too_large';if(status===400||status===422)return/schema|image_url|content|source|invalid type|unsupported/.test(text)?'schema':'request';if(status===408||status===504)return'timeout';if(status===429)return'rate';if(status>=500)return'server';return'http';}
function visionConfigured(){const a=S.settings&&S.settings.vision||{},ch=S.settings&&S.settings.chat||{};return !!(aiCoreOn()||(ch.base&&ch.key&&ch.model)||(a.base&&a.key&&a.model));}
function visionRouteKey(base,model){return String(base||'').replace(/\/+$/,'').toLowerCase()+'|'+String(model||'').trim().toLowerCase();}
function visionChatRouteKey(ch){return aiCoreOn()?'relay|'+String(ch&&ch.model||'default').trim().toLowerCase():visionRouteKey(ch&&ch.base,ch&&ch.model);}
function visionBackupSameAsChat(a,ch){return !aiCoreOn()&&!!(a&&a.base&&a.key&&a.model&&ch&&ch.base&&ch.key&&ch.model)&&visionRouteKey(a.base,a.model)===visionRouteKey(ch.base,ch.model)&&String(a.key)===String(ch.key);}
function visionFailure(kind,message,status,protocol){const e=new Error(message||'识图失败');e.visionInfo={kind:kind||'unknown',message:message||'识图失败',status:status||0,protocol:protocol||''};return e;}
function visionRelayFailure(e){const status=Number(e&&e.status)||0,message=String(e&&e.message||'内置聊天模型识图失败');let kind=visionErrKind(status,message);if(/unsupported|not support|image_url|图片.{0,8}(不支持|无法)|不支持.{0,8}(图片|图像)/i.test(message))kind='schema';return visionFailure(kind==='http'?(status?'http':'network'):kind,message,status,'relay-chat');}
function visionCacheableFailure(kind){return ['no_image','no_vision','endpoint','schema','empty'].includes(kind);}
function visionMarkChatFailure(a,key,info){if(!visionCacheableFailure(info&&info.kind))return;a.chatImageFailedKey=key;a.chatImageFailedAt=Date.now();}
function visionClearChatFailure(a){delete a.chatImageFailedKey;delete a.chatImageFailedAt;}
function visionChatSkipped(a,key,opt){return !opt.forceChat&&a.chatImageFailedKey===key&&Date.now()-(+a.chatImageFailedAt||0)<43200000;}
function visionRelayMessages(dataURL,prompt){return [{role:'user',content:[{type:'text',text:prompt||'仔细具体地用中文描述这张图片的内容，2到3句，抓住最有特点的细节，别太笼统。'},visionImagePart(dataURL,true)]}];}
async function visionPostOpenAI(base,key,model,dataURL,prompt,detail){
  const res=await fetchT(base+'/chat/completions',{method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({model,max_tokens:420,messages:[{role:'user',content:[
      visionImagePart(dataURL,detail),
      {type:'text',text:prompt||'仔细具体地用中文描述这张图片的内容，2到3句，抓住最有特点的细节，别太笼统。'}]}]})},70000);
  const d=await res.json().catch(()=>null);
  return {res,d,protocol:'openai'};
}
async function visionPostAnthropic(base,key,model,dataURL,prompt){const im=visionData(dataURL);if(!im)throw new Error('图片不是 Claude 支持的 JPG、PNG、GIF 或 WebP');
  const url=visionNativeURL(base),official=/^api\.anthropic\.com$/i.test((()=>{try{return new URL(url).hostname;}catch(_){return'';}})());
  const headers={'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'};if(!official)headers.Authorization='Bearer '+key;
  const res=await fetchT(url,{method:'POST',headers,body:JSON.stringify({model,max_tokens:420,messages:[{role:'user',content:[
    {type:'image',source:{type:'base64',media_type:im.media,data:im.data}},
    {type:'text',text:prompt||'仔细具体地用中文描述这张图片的内容，2到3句，抓住最有特点的细节，别太笼统。'}]}]})},70000);
  const d=await res.json().catch(()=>null);return {res,d,protocol:'anthropic'};
}
async function visionAvailableModels(base,key){const ck=base,old=_visionModelCache[ck];if(old&&Date.now()-old.time<300000)return old.ids;
  try{const r=await fetchT(base+'/models',{headers:{'Authorization':'Bearer '+key}},18000);if(!r.ok)return[];const d=await r.json(),ids=((d&&(d.data||d.models||d))||[]).map(x=>(x&&(x.id||x.name))||x).filter(x=>typeof x==='string');_visionModelCache[ck]={time:Date.now(),ids};return ids;}catch(_){return[];}}
async function visionFallbackModels(a,base,key,primary){return uniq([a&&a.fallbackModel,a&&a.lastGoodModel]).filter(x=>x!==primary);}
async function visionTryModel(base,key,model,dataURL,prompt,preferred){const claude=visionIsClaude(model),protocols=preferred?[preferred,(preferred==='anthropic'?'openai':'anthropic')]:claude?['anthropic','openai']:['openai'];let last=null;
  for(const protocol of uniq(protocols)){if(protocol==='anthropic'&&!claude)continue;let out;
    try{out=protocol==='anthropic'?await visionPostAnthropic(base,key,model,dataURL,prompt):await visionPostOpenAI(base,key,model,dataURL,prompt,true);}catch(e){last={kind:e&&e.name==='AbortError'?'timeout':'network',message:(e&&e.message)||'网络失败',protocol};if(preferred||protocol==='openai')break;continue;}
    let txt=visionText(out.d),detail=((out.d&&out.d.error&&(out.d.error.message||JSON.stringify(out.d.error)))||'').slice(0,180),kind=out.res.ok?(txt?(visionNoImageText(txt)?'no_image':''):'empty'):visionErrKind(out.res.status,detail);
    if(out.res.ok&&txt&&!kind)return {text:txt,model,protocol};
    last={kind:kind||'empty',message:out.res.ok?(txt?'模型回复：'+txt.slice(0,110):'模型没有返回文字'):'HTTP '+out.res.status+(detail?' '+detail:''),status:out.res.status,protocol};
    if(protocol==='openai'&&kind==='schema'){try{out=await visionPostOpenAI(base,key,model,dataURL,prompt,false);txt=visionText(out.d);detail=((out.d&&out.d.error&&(out.d.error.message||JSON.stringify(out.d.error)))||'').slice(0,180);kind=out.res.ok?(txt?(visionNoImageText(txt)?'no_image':''):'empty'):visionErrKind(out.res.status,detail);if(out.res.ok&&txt&&!kind)return{text:txt,model,protocol};last={kind:kind||'empty',message:out.res.ok?(txt?'模型回复：'+txt.slice(0,110):'模型没有返回文字'):'HTTP '+out.res.status+(detail?' '+detail:''),status:out.res.status,protocol};}catch(e){last={kind:'network',message:(e&&e.message)||'网络失败',protocol};}}
    const thirdPartyNativeAuth=protocol==='anthropic'&&last.kind==='auth'&&!/^https:\/\/api\.anthropic\.com(?:\/|$)/i.test(base);if(['auth','balance','permission','timeout','rate','server','too_large'].includes(last.kind)&&!thirdPartyNativeAuth)break;
  }
  const e=new Error(last&&last.message||'识图失败');e.visionInfo=last||{kind:'unknown'};throw e;
}
async function visionTryChat(dataURL,prompt){const ch=S.settings.chat||{};

  const base=String(ch.base||'').replace(/\/+$/,''),key=String(ch.key||''),model=String(ch.model||'').trim();if(!base||!key||!model)throw visionFailure('missing','聊天模型线路还没有配置完整');return visionTryModel(base,key,model,dataURL,prompt,null);
}
async function visionTryBackup(dataURL,prompt,primary){const a=S.settings.vision||{},ch=S.settings.chat||{};let last=null;
  const external=!!(a.base&&a.key&&a.model)&&!visionBackupSameAsChat(a,ch);if(external){const base=String(a.base).replace(/\/+$/,''),key=String(a.key),model=String(a.model).trim(),models=uniq([model,...await visionFallbackModels(a,base,key,model)]);for(const candidate of models){try{const r=await visionTryModel(base,key,candidate,dataURL,prompt,a.protocols&&a.protocols[candidate]);a.protocols=Object.assign({},a.protocols||{},{[candidate]:r.protocol});a.lastGoodModel=candidate;_visionLast={model:r.model,protocol:r.protocol,route:'backup',fallback:true,primary};return r.text;}catch(e){last=e;if(['auth','balance','permission','too_large'].includes(e.visionInfo&&e.visionInfo.kind))break;}}}

  if(!external&&visionBackupSameAsChat(a,ch))last=visionFailure('duplicate','备用识图与聊天模型完全相同，已阻止重复识别');
  throw last||visionFailure('missing','没有配置可用的备用识图线路');
}
async function visionAPI(dataURL,prompt,opt){opt=opt||{};const a=S.settings.vision||{},ch=S.settings.chat||{},chatKey=visionChatRouteKey(ch),primary=String(ch.model||'当前聊天模型');let firstError=null;
  if(/正在进行的通话中[\s\S]{0,80}屏幕共享/.test(String(prompt||'')))prompt=String(prompt||'')+'\n如果画面中有影视对白字幕、短视频字幕或其他与当前内容直接相关的台词文字，请在客观描述中逐字写出当前清晰可见的字幕；只抄本帧真正看得清的字，不猜被遮挡、已经消失或尚未出现的台词。这样角色可以实时理解当前一句，但这不等于提取整部视频的字幕文件。';
  if(!opt.backupOnly&&!visionChatSkipped(a,chatKey,opt)){try{const r=await visionTryChat(dataURL,prompt);visionClearChatFailure(a);_visionLast={model:r.model,protocol:r.protocol,route:'chat',fallback:false};return r.text;}catch(e){firstError=e;visionMarkChatFailure(a,chatKey,e&&e.visionInfo);if(opt.primaryOnly)throw e;}}
  if(opt.primaryOnly)throw firstError||visionFailure('cached','当前聊天模型已被记为不支持图片；可用“自动路线”验证备用识图');
  try{return await visionTryBackup(dataURL,prompt,primary);}catch(e){const last=e||firstError,z=new Error('vision-fail: '+((last&&last.message)||(firstError&&firstError.message)||'模型没有收到图片'));z.visionInfo=(last&&last.visionInfo)||(firstError&&firstError.visionInfo)||null;throw z;}
}
/* AI 真图：走 /images/generations 真生成一张图，返回图片URL（可单独配接口/Key，留空则用聊天模型的）*/
function imageApiUrls(base,path){const b=(''+base).replace(/\/+$/,'');const urls=/\/v1$/i.test(b)?[b+path]:[b+'/v1'+path,b+path];return urls.filter((x,i,a)=>x&&a.indexOf(x)===i);}
function imageRespErr(d){const msg=d&&d.choices&&d.choices[0]&&d.choices[0].message,txt=msg&&msg.content;return ((d&&d.error&&(d.error.message||JSON.stringify(d.error)))||(d&&d.message)||(typeof txt==='string'&&txt)||'').slice(0,260);}
function imageShouldRetryChat(status,msg){return status===400||status===404||status===405||status===422||status===501||/html|doctype|网页|unsupported|not support|not found|does not exist|images\/generations|image.*endpoint|渠道不存在|可用渠道不存在|available.*channel/i.test(''+msg);}
function imageCollectValues(v,out){if(!v||out.length>40)return;if(typeof v==='string'){out.push(v);return;}if(Array.isArray(v)){v.forEach(x=>imageCollectValues(x,out));return;}if(typeof v!=='object')return;
  if(v.url)out.push(v.url);if(v.b64_json)out.push(v.b64_json);if(v.data&&/image\//i.test(v.mime_type||v.mimeType||''))out.push('data:'+(v.mime_type||v.mimeType)+';base64,'+v.data);
  if(v.inlineData&&v.inlineData.data)out.push('data:'+(v.inlineData.mimeType||'image/png')+';base64,'+v.inlineData.data);
  if(v.inline_data&&v.inline_data.data)out.push('data:'+(v.inline_data.mime_type||'image/png')+';base64,'+v.inline_data.data);
  if(v.fileData&&v.fileData.fileUri)out.push(v.fileData.fileUri);if(v.file_data&&v.file_data.file_uri)out.push(v.file_data.file_uri);
  Object.keys(v).forEach(k=>{if(!/token|key|authorization/i.test(k))imageCollectValues(v[k],out);});
}
function imageResultURL(d){const direct=d&&d.data&&d.data[0];if(direct&&(direct.url||direct.b64_json))return direct.url||('data:image/jpeg;base64,'+direct.b64_json);
  const msg=d&&d.choices&&d.choices[0]&&d.choices[0].message,cands=[],add=v=>{v=String(v||'').trim();if(v)cands.push(v);};
  add(msg&&(msg.image_url&&msg.image_url.url||msg.image_url));(Array.isArray(msg&&msg.images)?msg.images:[]).forEach(x=>add(x&&(x.image_url&&x.image_url.url||x.image_url||x.url||x.b64_json)));
  if(Array.isArray(msg&&msg.content))msg.content.forEach(p=>add(p&&(p.image_url&&p.image_url.url||p.image_url||p.url||p.text)));else add(msg&&msg.content);
  imageCollectValues(d,cands);
  for(const raw of cands){const data=(''+raw).match(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+/i);if(data)return data[0].replace(/\s+/g,'');const md=(''+raw).match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i),plain=(''+raw).match(/https?:\/\/[^\s<>"')\]]+/i);if(md||plain)return (md&&md[1])||(plain&&plain[0]);}
  return '';
}
function imageSizeRatio(size){return size==='1024x1536'?'2:3':size==='1536x1024'?'3:2':'1:1';}
async function imagePostCompat(base,key,path,body,ms){let last=null;for(const url of imageApiUrls(base,path)){try{const res=await fetchT(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify(body)},ms||180000),ct=(res.headers.get('content-type')||'').toLowerCase();const txt=await res.text(),html=/html/.test(ct)||/^\s*<!doctype\s+html|^\s*<html[\s>]/i.test(txt);let d=null;try{d=txt&&!html?JSON.parse(txt):null;}catch(_){d={message:txt.slice(0,180)};}if(html)d={message:'接口返回网页HTML，不是API JSON；已继续尝试 /v1 路径',html:true};if(res.ok&&!html)return {res,d,url};last={res,d,url};if(!html&&![404,405,501].includes(res.status))break;}catch(e){last={err:e,url};if(/abort|timeout/i.test(String((e&&e.name)||e)))throw e;}}if(last&&last.err)throw last.err;return last;}
async function imageGenerateExternal(base,key,model,prompt,size,quality){const p=(prompt||'一张生活照').slice(0,3200),opt=arguments[6]||{},target=size||'1024x1536',q=quality==='low'?'low':quality==='high'?'high':'medium',requestTimeout=Math.max(30000,Math.min(360000,+opt.timeoutMs||180000));
  if(Array.isArray(opt.references)&&opt.references.length){const edited=await imageGenerateReferenceEdit(base,key,model,p,target,q,opt.references,requestTimeout,opt.requireReferences===true);if(edited)return edited;if(opt.requireReferences){const parts=[{type:'text',text:p+'\n按参考图人物绑定生成一张图片并返回图片，不能只回复文字。'}].concat(opt.references.slice(0,4).map(src=>({type:'image_url',image_url:{url:src}}))),reply=await imagePostCompat(base,key,'/chat/completions',{model,messages:[{role:'user',content:parts}],max_tokens:1200},requestTimeout),url=reply&&reply.res&&reply.res.ok?imageResultURL(reply.d):'';if(url)return{url,endpoint:'chat-reference-images',model};throw Error('当前绘图接口没有完成参考图生成，请使用支持参考图的模型；本次未退回随机形象');}}
  const geminiImage=/gemini.*image/i.test(model),gptImage=/^gpt-image(?:-|$)/i.test(model),rich={model,prompt:p,n:1,size:target,quality:q,output_format:'jpeg',output_compression:q==='low'?84:88,...(gptImage?{}:{response_format:geminiImage?'b64_json':'url'}),...(geminiImage?{aspect_ratio:imageSizeRatio(target)}:{})};
  let out=await imagePostCompat(base,key,'/images/generations',rich,requestTimeout),res=out&&out.res,d=out&&out.d,err=imageRespErr(d).toLowerCase();
  if(res&&!res.ok&&res.status<500&&/(unknown|unsupported|invalid).{0,24}(quality|output|compression|response_format|size)|extra inputs are not permitted|not allowed/.test(err)){out=await imagePostCompat(base,key,'/images/generations',{model,prompt:p,n:1,size:target},requestTimeout);res=out&&out.res;d=out&&out.d;err=imageRespErr(d).toLowerCase();}
  if(res&&!res.ok&&res.status<500&&model==='gpt-image-2'&&/(model|not found|unsupported|does not exist)/.test(err)){out=await imagePostCompat(base,key,'/images/generations',{model:'gpt-4o-image',prompt:p,n:1,size:target},requestTimeout);res=out&&out.res;d=out&&out.d;err=imageRespErr(d).toLowerCase();}
//@@ web
  /* 上游只认方图时，竖图会一直 400：既有的降级重试只去掉画质等参数，尺寸始终没退过，所以救不回来。
     「测试出图」用的就是 1024x1024，它能过说明模型本身可用，只是这个竖尺寸没开通。 */
//@@ private
  /* 上游只认方图时，竖图会一直 400；审核拦截同样是 400，但换尺寸照样被拦，不再白花一次生图调用。 */
//@@ end
  if(res&&!res.ok&&res.status===400&&target!=='1024x1024'&&!imageModerationBlocked(err)){out=await imagePostCompat(base,key,'/images/generations',{model,prompt:p,n:1,size:'1024x1024'},requestTimeout);res=out&&out.res;d=out&&out.d;err=imageRespErr(d).toLowerCase();}
  let url=res&&res.ok?imageResultURL(d):'';
  if(url)return {url,endpoint:'images-generations',model};
  if(opt.allowChatFallback!==false&&(!res||!res.ok&&imageShouldRetryChat(res.status,err))){out=await imagePostCompat(base,key,'/chat/completions',{model,messages:[{role:'user',content:p+'\n\n请直接生成一张图片并返回图片。必须保持画布尺寸 '+target+'（'+imageSizeRatio(target)+' 比例），不要改成方图。'}],max_tokens:1200},210000);res=out&&out.res;d=out&&out.d;url=res&&res.ok?imageResultURL(d):'';if(url)return {url,endpoint:'chat-completions',model};err=imageRespErr(d)||err;}
  if(res&&!res.ok)throw new Error(apiErrorCN(res.status,err||'生图失败'));
  throw new Error('没拿到图片：'+(imageRespErr(d)||'接口返回成功但没有图片字段，可能这个模型在该站未开通生图渠道'));
}
