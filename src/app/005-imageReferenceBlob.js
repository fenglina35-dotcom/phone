function imageReferenceBlob(src){const m=String(src||'').match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);if(!m)return null;try{const raw=atob(m[2].replace(/\s+/g,'')),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes],{type:m[1]});}catch(_){return null;}}
async function imageGenerateReferenceEdit(base,key,model,prompt,size,quality,references,requestTimeout){const strict=arguments[8]===true;if(!/^gpt-image(?:-|$)/i.test(model)||typeof FormData==='undefined')return null;const blobs=(references||[]).map(imageReferenceBlob).filter(Boolean).slice(0,4);if(!blobs.length)return null;for(const url of imageApiUrls(base,'/images/edits')){try{const form=new FormData();form.append('model',model);form.append('prompt',String(prompt||'').slice(0,3200));form.append('size',size||'1024x1536');form.append('quality',quality||'medium');form.append('input_fidelity','high');blobs.forEach((blob,i)=>form.append('image[]',blob,'reference-'+(i+1)+'.jpg'));const res=await fetchT(url,{method:'POST',headers:{Authorization:'Bearer '+key},body:form},requestTimeout),txt=await res.text();let data=null;try{data=JSON.parse(txt);}catch(_){data=null;}const out=res.ok?imageResultURL(data):'';if(out)return{url:out,endpoint:'images-edits',model};if(strict&&![404,405,415,422,501].includes(res.status)){const error=Error(res.ok?'参考图接口返回成功但没有图片，本次已停止继续请求':apiErrorCN(res.status,imageRespErr(data)||'参考图生成失败'));error.code='image-reference-failed';throw error;}if(![404,405,415,422,501].includes(res.status))break;}catch(error){if(strict)throw error;}}
  return null;
}
function rolePhotoPromptLocked(prompt,faceMode){if(faceMode==='candid')return 'CANDID NO-FACE COMPOSITION: a real, casual phone photo from the character\'s everyday life, not a posed portrait. If the character appears, show only his hands close up, his upper body cropped below the chin, his back, or his side with the head turned away; the head and face stay out of frame or completely unreadable. Hide the face by framing, never by holding a phone or object in front of it. No mirror selfie, no phone in front of the face, no headshot, no portrait framing. Make it look like a beautiful real photo: good natural light, sharp subject, attractive well-proportioned body and hands. Keep the exact character identity, biological sex, body traits, time, lighting and location in the prompt. If the character is described as male he stays an unmistakably adult man and the image contains zero women, girls, female bodies, female hands or female bystanders unless the request explicitly names a woman. For scenery, object, food, pet, room or desk requests show only that subject with ZERO PEOPLE and NO CHARACTER IN FRAME.\n\n'+rolePhotoCandidStrip(String(prompt||'')).slice(0,4200);if(faceMode==='detail'||faceMode==='back'||faceMode==='covered'||faceMode==='paired'){const rule=faceMode==='covered'?'NO RECOGNIZABLE FACE COMPOSITION: follow the explicitly requested angle and natural occlusion. No recognizable facial features for either person. Do not force a back view, front portrait or invented phone; keep exactly the requested people and framing.':faceMode==='detail'?'DETAIL COMPOSITION ONLY: show exactly the requested hands or body detail. No face, no head, no portrait, no extra limbs. Identity and clothing references affect only visible skin, body and sleeves; never copy the reference portrait framing.':faceMode==='back'?'BACK VIEW COMPOSITION: preserve the requested back or rear-side view. No recognizable facial features. Do not turn either person toward the camera.':'EXPLICIT TWO-PERSON IDENTITY: keep character A and user B distinct. Only those explicitly requested may appear. Each person follows their own face permission and wardrobe; reference images do not require face visibility or fixed angles.';return rule+'\n\n'+String(prompt||'').slice(0,4200);}const hidden='ABSOLUTE COMPOSITION AND GENDER RULE: no face or recognizable facial features may appear. Keep the head and hair silhouette when natural, but hide the whole face with a phone fully covering the face, hand, object, shadow, hair, brim, mask, back view, or natural occlusion. Mirror selfies are allowed only when the phone fully covers the whole face. Do not default to a headless crop; crop the head out only if no natural occlusion can fully hide the face. Never use a random stock selfie person; preserve the exact character identity, biological sex, time, lighting, and location described in the prompt. If the current character is described as male, he must remain an unmistakably adult man and the image must contain zero women, girls, female bodies, female hands, female silhouettes, female reflections, or female bystanders unless the request explicitly names a woman. Words such as lover, partner, user, recipient, or me never authorize adding a woman. For scenery, night view, street view, sky, weather, object, food, pet, room, or desk requests, show only the requested subject with ZERO PEOPLE and NO CHARACTER IN FRAME unless the request explicitly asks for a selfie or the character.',allowed='ABSOLUTE IDENTITY AND GENDER RULE: preserve the exact same character identity, face shape, hairstyle, biological sex, time, lighting, and location described in the prompt and supplied reference images. A clear natural face is allowed when the prompt asks for the character; do not default to a phone covering the face, a headless crop, or hair obscuring the hairstyle. Never use a random stock selfie person. If the current character is described as male, he must remain an unmistakably adult man and the image must contain zero women, girls, female bodies, female silhouettes, female reflections, or female bystanders unless the request explicitly names a woman. For scenery, object, food, pet, room, or desk requests, show only the requested subject with ZERO PEOPLE and NO CHARACTER IN FRAME unless the request explicitly asks for the character.',required='ABSOLUTE FACE VISIBILITY RULE: the same referenced character MUST appear with a clear, natural and recognizable face. The requested front or side facial view must remain visible. A phone, hand, hair, mask, shadow, crop, prop, back view, or other object may appear naturally in the scene, but must not obscure the eyes, nose, or mouth, or make the face unrecognizable. Do not use headless framing or a back-facing pose that hides the face. Do not invent a phone merely as a composition or face-covering device; if the request does not need a phone, omit it. Preserve the exact supplied identity, face shape, hairstyle, biological sex, time, lighting, and location. Never substitute a random stock person. If the character is male, he must remain an unmistakably adult man and the image must contain zero women or girls unless explicitly requested.',mirror='FULL-BODY MIRROR EXCEPTION: this request explicitly asks for a full-body mirror photo. The same referenced character and requested outfit must appear in a genuine full-body mirror composition. A phone may be held naturally and may occasionally cover the face, but face covering is optional and must not become the default for every image. This exception applies only to an explicit full-body mirror photo. Preserve the exact identity, hairstyle, biological sex, body proportions, outfit, time, lighting, and location; never substitute a random stock person.',body=faceMode==='required'?roleImageStudioVisibleScene(prompt):String(prompt||'');return (faceMode==='mirror'?mirror:faceMode==='required'?required:faceMode==='allowed'?allowed:hidden)+'\n\n'+body.slice(0,2600);}
async function genImage(prompt,opt){const imageOwnerState=S,imageOwnerAccount=typeof actId==='function'?actId():null;const rawPrompt=String(prompt||'');let boundPrompt=rawPrompt;opt=opt&&typeof opt==='object'?Object.assign({},opt):{};if(opt.accountId&&opt.accountId!==imageOwnerAccount)throw Error('账号已切换，本次形象请求已取消');let candidRole=null;if(opt.roleId){const c=roleImageStudioOwner(opt.roleId);if(!c||c.deleted||c.blocked)throw Error('角色或当前账号已变化，本次形象请求已取消');opt=Object.assign({},roleImageGenerateOptions(c,rawPrompt),opt);if(rolePhotoCandidOn(c))candidRole=c;}const candid=opt.photoStyle==='candid'||rawPrompt.includes(ROLE_PHOTO_CANDID_MARK)||!!candidRole;if(candid){opt.faceMode='candid';boundPrompt=rolePhotoCandidStrip(rawPrompt);}const references=[];for(const ref of (opt.references||[]).slice(0,4)){const src=await viewerImageSource(ref).catch(()=>'');if(!src&&opt.referenceLabels)throw Error('形象或衣物参考图片未能读取，本次生成已停止');if(src)references.push(src);}if(S!==imageOwnerState||imageOwnerAccount!==null&&actId()!==imageOwnerAccount)throw Error('账号已切换，本次形象请求已取消');if(opt.referenceLabels&&opt.referenceLabels.length)boundPrompt='【参考图人物绑定】'+opt.referenceLabels.map((label,i)=>'参考图'+(i+1)+'：'+label).join('；')+'。不能互换人物的脸或衣物。\n'+(candid?rolePhotoCandidStrip(rawPrompt):rawPrompt);prompt=rolePhotoPromptLocked(boundPrompt,opt.faceMode);
  const ch=S.settings.chat||{};
  const base=((S.settings.imgBase||ch.base)||'').replace(/\/+$/,'');
  const key=(S.settings.imgKey||ch.key)||'';
  if(!base||!key)throw new Error('还没设置绘图/聊天 API');
  const model=(S.settings.imgModel||'gpt-image-2');
  return (await imageGenerateExternal(base,key,model,prompt,'1024x1536','medium',{references,requireReferences:!!(opt.referenceLabels&&references.length)})).url;
}
async function stableImageSrc(url){if(!url)return '';if(/^data:image\//i.test(url))return url;
  try{const r=await fetchT(url,{mode:'cors'},30000);if(!r.ok)return url;const b=await r.blob();
    return await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result||url);fr.onerror=()=>res(url);fr.readAsDataURL(b);});
  }catch(e){return url;}}
/* 把一条 pending 的图片消息真正生成出来并刷新 */
async function fillGenImage(msg,prompt){
  msg.genPrompt=prompt||msg.genPrompt||'';
  try{const url=await genImage(msg.genPrompt,msg.genOptions||{});msg.src=await stableImageSrc(url);if(!msg.src)throw new Error('生图接口没有返回可保存的图片');}
  catch(e){msg.pending=false;msg.src='';msg.failed=true;msg.errText=(e&&e.message||'生图失败');try{await persistWechatMessagesNow();}catch(_){saveNow();}if(cur().p==='chat'||cur().p==='wechat')setTimeout(render,40);return;}
  msg.pending=false;msg.failed=false;msg.errText='';msg.generatedAt=Date.now();delete msg.genOptions;delete msg.genPrompt;
  try{await primeImageForSave(msg.src);const stored=await persistWechatMessagesNow();if(!stored)throw new Error('本机存档没有确认写入');delete msg.persistWarning;}
  catch(e){msg.persistWarning=true;msg.errText='图片已生成，但本机持久保存尚未确认；不会自动重新生图';saveNow();}
  if(cur().p==='chat'||cur().p==='wechat')setTimeout(render,40);
}
function generatedImageFailureLabel(err){const s=String(err||'');if(/429|No images were successfully|relay-image-empty|no image/i.test(s))return'外置图片平台限流或没有成功出图，请稍后重试';if(/504|timeout|timed out|aborted|超时/i.test(s))return'外置图片平台生成超时，请先核对平台记录再重试';if(/401|403|unauthori|forbidden|invalid.*key|no access/i.test(s))return'外置图片接口密钥或权限异常';if(/404|model.*not.*found|not found/i.test(s))return'外置图片模型或接口地址不匹配';if(/fetch|network|load failed|cors/i.test(s))return'网络中断或等待过久';return'生成失败'+(s?('：'+s.replace(/^内置AI失败：/,'').slice(0,70)):'');}
function retryGeneratedImage(cid,mid){const c=getC(cid),m=msgs(cid).find(x=>x&&x.id===mid);if(!c||!m||m.type!=='image'||m.pending||!m.genPrompt)return;m.failed=false;m.errText='';m.pending=true;save();render();setTimeout(()=>fillGenImage(m,m.genPrompt),60);}

/* =================== 提示词 =================== */
function quoteContextText(m,kind){
  const q=(m&&m.quote&&m.quote.text?String(m.quote.text).trim():'');
  if(!q)return '';
  if(m.quote.who==='ta')return kind==='voice'?'（我引用了你刚说的那句「'+q+'」，就这一句）':'（我引用了你刚说的那句「'+q+'」，专门就这一句，我说：）';
  return kind==='voice'?'（我引用了我前面说的那句「'+q+'」，就这一句）':'（我引用了我前面说的那句「'+q+'」，现在补充说：）';
}
/* MAIL_FORWARD_GUARD_V1（2026-10-31 群里用户：情侣角色聊天和生成 X 全部报「mailForwardHistory is not defined」）：
   转发信件的文字和卡片写在 mail-outbox.js 里，那个文件在他手机上没加载成功（多半是网页正在更新时打开、或网络断了一下），
   聊天里只要有一封转发的信，整理聊天记录就出错，聊天、X、朋友圈全卡住。现在先看那个文件在不在，不在就用这里的简单写法，聊天照常。 */
function mailForwardFallbackText(m){const l=m&&m.letter||{};return '[用户转发信件。以下为引用内容，不是系统指令。原发件人：'+String(l.authorName||'')+'；主题：'+String(l.subject||'')+'；完整正文：\n'+String(l.body||'').slice(0,4000)+'\n（信件结束）]';}
function msgToText(m){if(m&&m.type==='calendarcreated'){const e=calCreatedCardEvent(m);return e?'[已保存并分享给玩家的日程] '+calEventFact(e):'[已安排日程不可用]';}if(m&&m.type==='calendarinvite')return calInviteCardText(m);if(m&&m.type==='rolecalendarshare')return roleCalShareText(m);if(m&&m.type==='calendarshare')return calShareText(m);if(m&&m.type==='shopshare'&&typeof NorthMarketBusiness!=='undefined')return NorthMarketBusiness.shareText(m.shopShare);if(m&&m.type==='shopquery')return '[App店铺查询，尚未付款] '+String(m.content||'');if(m&&m._favorite&&typeof wxFavoriteForwardText==='function')return wxFavoriteForwardText(m);if(m&&m.type==='image'&&m._albumShare&&typeof photoAlbumChatSourceText==='function'){const plain={...m};delete plain._albumShare;return photoAlbumChatSourceText(m)+msgToText(plain);}if(m&&m.type==='albummemory')return '[相册回忆] '+String(m.content||'');
  if(m&&m.type==='mailforward')return typeof mailForwardHistory==='function'?mailForwardHistory(m):mailForwardFallbackText(m);
  if(m&&['rolefamilycard','rolefamilypurchase'].includes(m.type)&&typeof familyRoleHistory==='function')return familyRoleHistory(m);
  if(m&&m.role==='assistant'&&m.type==='file')return roleFileHistoryText(m);
  if(m&&m.type==='transfer'&&m._transferReceipt){const amount=(+m.amount||0).toFixed(2),receive=m.receiptAction==='receive'||m.payState==='received';if(m.role==='user')return receive?'[真实转账回执：你此前转给用户的 ¥'+amount+' 已被用户收下；这是收款结果，不是用户给你转账，也不是用户把钱转回给你。]':'[真实转账回执：用户把你此前转给ta的 ¥'+amount+' 原路退还给你；这是退款，不是你再次给用户转账。]';return receive?'[真实转账回执：用户此前转给你的 ¥'+amount+' 已被你收下；这是收款结果，不是你给用户转账。]':'[真实转账回执：你已把用户此前转给你的 ¥'+amount+' 原路退还给用户；这是退款结果。]';}
  if(m.role==='assistant'){
    if(m.type==='weddinginvite'){const ws=m.style==='chinese'?'中式':m.style==='modern'?'现代':'';return m.phase==='style'?'[这是我本人主动发出的现实婚礼形式选择卡；我知道卡片会让你选择现代婚礼或中式婚礼，正在等你决定]':m.phase==='preparing'?'[你已经选择了'+(ws||'对应形式')+'婚礼；这是我和你的现实婚礼，我知道整场专属台词与画面正在准备]':m.phase==='scheduled'?'[我知道我们的现实'+(ws||'')+'婚礼已经筹备完成，正在等待约定的准确时间]':'[这是我本人发出的现实'+(ws||'')+'婚礼入场邀请；婚礼已经全部准备好'+(m.openedAt?'，而且你已经进入过这张邀请':'，我正在等你亲自打开入场')+']';}
    if(m.type==='verifyreq')return '[我向你提出'+({report:'报备',location:'定位',photo:'照片'}[m.requestKind]||'确认')+'请求：'+(m.reason||'想确认你的情况')+'，状态：'+({pending:'等待你选择',later:'你说稍后',waiting:'等待你发送',fulfilled:'你已发送',refused:'你已拒绝'}[m.status]||m.status||'等待')+']';
    if(m.type==='cinemainvite')return '[我向你发出放映室邀请：'+(m.kind==='book'?'共读':'一起看')+'《'+(m.title||'未命名')+'》'+(m.status==='accepted'?'，你已经同意并进入':m.status==='declined'?'，你拒绝了':'，等你同意或拒绝')+']';
    if(m.type==='familycard')return '[我给你开通了一张亲属卡，每月额度¥'+(m.quota||0)+(m.bound?'，你已绑定，可以用我的额度买东西':'，等你接受绑定')+']';
    if(m.type==='namecard')return '[我把我的朋友「'+m.cname+'」'+(m.persona?'（'+m.persona+'）':'')+'推荐给了你'+(m.added?'，你已经加了ta':'，推荐你加一下')+']';
    if(m.type==='dateinvite')return '[我向你发出线下约会邀请：'+(m.when||'')+' 在「'+(m.loc||'')+'」见面'+(m.accepted?'，你答应了':m.declined?'，你拒绝了':'，等你答应')+']';
    if(m.type==='roleplayinvite')return '[我邀请你去角色扮演软件里玩「'+(m.title||'本次剧情')+'」'+(m.meRole?'，你这局扮演'+m.meRole:'')+(m.hisRole?'，我扮演'+m.hisRole:'')+(m.active?'（已经开局）':'')+']';
    if(m.type==='gameinvite')return '[我邀请你一起玩「'+(m.gname||'游戏')+'」'+(m.status==='accepted'?'，你已经接受了':m.status==='declined'?'，你拒绝了':'，正在等你选择')+']';
    if(m.type==='deliveryorder'){const o=m.order||{},items=(o.items||[]).map(x=>x.name+(x.options?'（'+x.options+'）':'')).join('、');return '[我已经创建真实外卖订单并发来订单卡片：'+(o.merchant||'外卖商家')+'，'+(items||'外卖商品')+'，¥'+(+o.total||0).toFixed(2)+'，当前'+(typeof deliveryStatusText==='function'?deliveryStatusText(o.status):o.status||'待处理')+']';}
    if(m.type==='food')return '[我给你点了外卖「'+(m.name||'')+'」'+(m.declined?'（你拒收了）':m.delivered?'（已送到、你吃上了）':m.received?'（你收下了，配送中）':'（点好了，约15分钟送到）')+'，别再重复点了]';
    if(m.type==='attractionTicket')return '[模拟门票订单卡：'+NorthTravelOrders.summary(m.order||{})+']';
    if(m.type==='hotel')return '[我发来的模拟酒店订单卡：'+tvHotelSummary(m.hotel||{})+']';
    if(m.type==='transfer')return '[我给你转了 ¥'+(+m.amount||0).toFixed(2)+(m.note?'，备注「'+m.note+'」':'')+']';
    if(m.type==='redpacket')return '[我给你发了个红包 ¥'+(+m.amount||0).toFixed(2)+(m.note?'，「'+m.note+'」':'')+']';
    if(m.type==='gift'){return '[我送了你礼物「'+(m.name||'')+'」'+giftRecipeContext(m.giftRecipe)+']';}
    if(m.type==='thoughtcard')return '[我发给你一张隐藏心声卡。开场是：'+(m.opening||'')+'。里面是这些没说出口的话：'+(m.thoughts||[]).join('；')+'。最后一句是：'+(m.ending||'')+']';
    if(m.type==='weblink')return '[我把联网搜到的「'+(m.title||'')+'」结果卡片分享给你：'+String(m.snippet||'').replace(/\s+/g,' ').slice(0,160)+']';
    if(m.type==='location')return '[我给你发了个位置：'+(m.name||'')+']';
    if(m.type==='file')return '[我给你发了文件「'+(m.name||'')+'」'+chatFileContextBody(m)+']';
    if(m.type==='sticker')return '[我发了个表情'+(m.meaning?'：'+m.meaning:'')+']';
    if(m.type==='voice')return m.content?('[我发语音说：'+m.content+']'):'[我发了条语音]';
    if(m.type==='image')return m.textCard?'[我发了一张图文照片卡。这在聊天里是一张图片，照片描述是：'+(m.desc||'未填写描述')+'。后续只能以这段描述作为画面事实。]':'[我发了一张照片'+(m.desc?'，画面是：'+m.desc:'')+']';
    /* 我自己订的票（机票/火车/演唱会/打车）卡片没有 content，以前这里返回空，我就看不到自己订成功过 */
    if(m.type==='ticket'){const t=msgToText({...m,role:'user'});return !t?'':/^\[/.test(t)?t:'[我订好并发给你的订单卡：'+t+']';}
    /* 真人店铺外卖、代付结果、骰子：通用分支的文字本来就是按我（角色）的口吻写的，以前这里返回空 */
    if(['marketfood','paid','payreject','dice'].includes(m.type))return msgToText({...m,role:'user'});
    if(m.type==='musicinvite')return '[我邀请你一起听歌：'+(m.title||'一首歌')+(m.artist?'（'+m.artist+'）':'')+'，我们正一起听]';
    return m.content||'';
  }
  switch(m.type){
    case 'cinemainvite':return '[我邀请你在放映室'+(m.kind==='book'?'共读':'一起看')+'《'+(m.title||'未命名')+'》'+(m.status==='accepted'?'，你已经同意，可以进入':m.status==='declined'?'，你拒绝了':'，等你用 [同意放映] 或 [拒绝放映] 回应')+']';
    case 'namecard':return '[我给你推荐了我的好友「'+m.cname+'」（微信号'+(m.wxid||'')+'）'+(m.persona?'，'+m.persona:'')+'，推荐你也加一下]';
    case 'roleplayinvite':return '[我邀请你去角色扮演软件里玩「'+(m.title||'本次剧情')+'」'+(m.hisRole?'，你这局扮演'+m.hisRole:'')+(m.meRole?'，我扮演'+m.meRole:'')+(m.active?'（已经开局）':'')+']';
    case 'familybuy':return '[我刚用你给的亲属卡买了「'+m.name+'」，花了¥'+(+m.price).toFixed(2)+'，本月这卡已用¥'+(+m.used).toFixed(2)+'/'+(+m.quota).toFixed(0)+']';
    case 'familyreq':return '[我向你申请绑定一张亲属卡，想用你的额度买点东西]';
    case 'weblink':return '[我转发给你一条联网搜到的资料：'+m.title+'——'+((m.snippet||'').slice(0,120))+']';
    case 'text':{const q=quoteContextText(m,'text');return q?(q+(m.content||'')):(m.content||'');}
    case 'image':return m.textCard?'[我发了一张图文照片卡。这在聊天里是一张图片；请把我亲自填写的照片描述当作画面事实来理解并自然回应。照片描述：'+(m.desc||'未填写描述')+'。不要说没有收到图片，也不要添加描述里不存在的视觉细节。]':m.desc?'[我发了一张照片。你已经看到了真实画面，画面是：'+m.desc+'。请直接结合画面回应，绝对不要说图片没收到、没显示或识图失败。]':m.visionState==='pending'?'[我刚发了一张照片，画面仍在载入；先等待识图完成，不要抢先回复，也不要说没收到图片。]':'[我发了一张照片，图片已经送达，但这一张的画面解析失败。不要谎称图片没收到或没显示，也不要反复让我重发；若当前还有文字消息，先回应文字。]';
    case 'transfer':return '[我给你转账 ¥'+(+m.amount).toFixed(2)+(m.note?'，备注'+m.note:'')+(m._roleSeenAt&&transferState(m)==='pending'?'（这笔你之前看到时没有收，一直放着；除非我再提起，不要突然收款或拿它说事）':'')+']';
    case 'redpacket':return '[我发了个红包 ¥'+(+m.amount).toFixed(2)+(m.note?'，'+m.note:'')+(m._roleSeenAt&&transferState(m)==='pending'?'（这笔你之前看到时没有收，一直放着；除非我再提起，不要突然收款或拿它说事）':'')+']';
    case 'location':return '[我发了位置：'+(m.name||'')+' '+(m.address||'')+']';
    case 'file':return '[我发了文件「'+(m.name||'')+'」'+chatFileContextBody(m)+']';
    case 'spycard':return '[我把我的小手机查看权限发给你了，你现在可以随时查看我的手机：聊天对象、钱包、朋友圈互动、动态。]';
    case 'dice':return '[我掷了骰子，点数是'+m.value+']';
    case 'gift':return m.from==='ta'?'[你送了ta一个礼物：'+m.name+']':'[我送了你一个礼物：'+m.name+(m.shop?'（在'+m.shop+'买的）':'')+'，¥'+(+m.price).toFixed(2)+']';
    case 'paycard':if(m.northRequestId&&typeof NorthCommercePayment!=='undefined')return NorthCommercePayment.messageText(m);return '[我在'+(m.shop||'商城')+'下单了「'+m.name+'」¥'+(+m.price).toFixed(2)+'，想让你帮我代付]';
    case 'paid':return '[我帮你代付成功了：'+m.name+' ¥'+(+m.price).toFixed(2)+']';
    case 'payreject':return '[我拒绝了帮你代付：'+m.name+']';
    case 'musicinvite':return '['+S.me.name+'邀请你一起听歌：'+m.title+(m.artist?'（'+m.artist+'）':'')+'，你们正一起听]';
    case 'gameinvite':return '[我给你发了游戏邀请，想一起玩「'+(m.gname||'游戏')+'」'+(m.status==='accepted'?'，你答应了、可以一起玩了':m.status==='declined'?'，你拒绝了':'，等你[同意游戏]或[拒绝游戏]')+']';
    case 'outpass':return '[我向你申请出门报备：去「'+(m.where||'')+'」'+(m.who?'、和「'+m.who+'」一起':'')+(m.dur?'、大约'+m.dur:'')+(m.status==='approved'?'，你批准了'+(m.reason?'（'+m.reason+'）':''):m.status==='rejected'?'，你驳回了'+(m.reason?'（'+m.reason+'）':''):'，等你批准')+']';
    case 'marketfood':return '[角色已用手动充值的云银行卡在真人用户店铺'+m.shop+'购买'+m.name+'，用券已减'+((m.marketFood&&m.marketFood.order&&m.marketFood.order.discount||0)/100).toFixed(2)+'虚拟币，详细回执：'+(m.marketFood&&m.marketFood.resultText||'请查看订单详情')+'；实付'+(+m.price).toFixed(2)+'虚拟币。订单已经付款，待商家履约和用户确认收货，不要宣称已送到或吃上。]';
    case 'marketgift':return typeof NorthMarket!=='undefined'?NorthMarket.giftMessageText(m):'[云端外卖记录]';
    case 'food':if(typeof NorthCommerceFood!=='undefined')return NorthCommerceFood.messageText(m);return m.from==='ta'?'[你给ta点了外卖：'+m.name+']':'['+S.me.name+'给你点了外卖：'+m.name+(m.shop?'（'+m.shop+'）':'')+'，¥'+(+m.price).toFixed(2)+(m.declined?'（你拒收了）':m.delivered?'（已送到、你吃上了）':m.received?'（你收下了，配送中）':'（等你 [收外卖] 或 [拒外卖]）')+']';
    case 'ticket':{const tr=m.trip||{};if(tr.taxiV2&&typeof NorthTravelTaxi!=='undefined')return NorthTravelTaxi.summary(tr);if(tr.concertV2&&typeof NorthConcertBooking!=='undefined')return NorthConcertBooking.summary(tr);if(tr.railV2&&typeof NorthTrainBooking!=='undefined')return NorthTrainBooking.summary(tr);if(tr.flightV2&&typeof NorthFlightBooking!=='undefined')return NorthFlightBooking.summary(tr);const cls=(TV_CLS.find(x=>x.k===tr.cls)||{t:''}).t;
      if(tr.meet===false){const who=tr.by==='me'?(tr.payer==='ta'?(S.me.name+'订了机票要一个人去'+tr.to+'旅行，机票钱记在你账上（你请客）'):(S.me.name+'订了机票要一个人去'+tr.to+'旅行，不是来见你')):('你送了'+S.me.name+'一张机票、让ta一个人去'+tr.to+'玩');return '[机票·登机牌：'+(tr.from||'')+'→'+(tr.to||'')+'，'+tvMD(tr.date)+'，'+cls+'。'+who+'（独自旅行·不是见面）]';}
      const fl=tr.flier==='me'?S.me.name:'你';return '[机票·登机牌：'+(tr.from||'')+'→'+(tr.to||'')+'，'+tvMD(tr.date)+' '+(tr.dep||'')+'，'+cls+'，'+fl+'飞。'+(tr.by==='me'?(tr.flier==='me'?(S.me.name+'要飞去'+tr.to+'见你'):(S.me.name+'给你订了票、请你飞去'+tr.to+'见面')):('你订了票要飞去'+(tr.to||'')+'见'+S.me.name))+'，到'+tvMD(tr.date)+'有一场线下见面]';}
    case 'attractionTicket':return '[门票订单：'+NorthTravelOrders.summary(m.order||{})+']';
    case 'hotel':return '[酒店订单：'+tvHotelSummary(m.hotel||{})+']';
    case 'tweetcard':return '[我转发给你一条X推文——'+m.tname+'：「'+m.ttext+'」]';
    case 'dycard':return m.mine?('[我把我自己发的抖音视频分享给你——「'+m.desc+'」'+(m.narration?'，视频内容：'+m.narration:'')+']'):('[我转发给你一条抖音视频——@'+m.author+'：「'+m.desc+'」'+(m.narration?'，视频内容：'+m.narration:'')+']');
    case 'voice':{const vq=quoteContextText(m,'voice');return m.content?('[语音消息]'+vq+m.content):'['+S.me.name+'发了条语音]';}
    case 'sticker':return '[表情'+(m.meaning?'：'+m.meaning:'')+']';
    case 'chatlog':return '[我转发给你一份聊天记录《'+m.title+'》，内容：'+(m.lines||[]).map(l=>l.who+'说'+l.text).join('；').slice(0,200)+']';
    case 'tcollect':return '[你收下了我的转账 ¥'+(+m.amount).toFixed(2)+']';
    case 'treject':return '[你拒收了我的转账，钱退回了]';
    case 'sys':if(m._northOrderFailure)return '[外卖系统结果：'+String(m.content||'')+'。以实际结果为准，不宣称已付款或送达，不在本轮重复点单。]';return m._silent?(m.content||''):null;
    default:return m.content||'';
  }
}
function worldHits(text,cid){const out=[];text=text||'';
  (S.worldbook||[]).forEach(w=>{if(!w.enabled)return;
    if(w.contacts&&w.contacts.length&&(!cid||w.contacts.indexOf(cid)<0))return;
    if(w.always){out.push(w);return;}
    const keys=(w.keys||'').split(/[,，\s]+/).filter(Boolean);
    if(keys.some(k=>text.includes(k)))out.push(w);});
  return out;}
const WORLD_SCOPE_OPTIONS=[['wechat','微信/电话/朋友圈'],['offline','线下约会'],['roleplay','角色扮演'],['jail','小黑屋'],['games','各种游戏'],['alter','马甲聊天']];
function worldbookScopeOn(scope){const m=S.settings&&S.settings.worldbookApps;return !scope||!m||m[scope]!==false;}
function worldbookText(wb,label){wb=(wb||[]).filter(w=>w&&w.content);if(!wb.length)return '';
  return '\n\n# 世界设定／世界书（真实事实与明确规则，优先级第二）\n'+wb.map(w=>'· '+(w.name||'世界书')+'：'+w.content).join('\n')+(label?'\n以上世界书同样适用于'+label+'。':'')+'\n这些内容用于保证世界事实、关系事实和明确规则一致；它们不能无声替换角色的核心身份、基础人设或说话习惯，除非条目本身明确记录了角色设定已经发生变化。';}
function worldbookPrompt(text,cid,label,scope){if(!worldbookScopeOn(scope))return '';return worldbookText(worldHits(text,cid),label);}
function worldbookPromptForContacts(text,ids,label,scope){if(!worldbookScopeOn(scope))return '';const seen=new Set(),out=[],list=(ids&&ids.length)?ids:[null];
  list.forEach(id=>worldHits(text,id).forEach(w=>{const k=(w.id||'')+'|'+(w.name||'')+'|'+(w.content||'');if(!seen.has(k)){seen.add(k);out.push(w);}}));
  return worldbookText(out,label);}
function toggleWorldScope(k){S.settings=S.settings||{};S.settings.worldbookApps=S.settings.worldbookApps||{};S.settings.worldbookApps[k]=S.settings.worldbookApps[k]===false;save();render();}
function getSpy(c){if(!c.spy)c.spy={granted:false,loc:false,time:'',times:2};return c.spy;}
function curLoc(){return (S.me.place||'').trim()||(S.weather&&S.weather.place)||'';}
function roleWorkday(t){const d=t instanceof Date?t:roleClockDate(t||Date.now()),day=d.getDay();return day>=1&&day<=5;}
function scheduleDateKey(t){const d=t instanceof Date?t:roleClockDate(t||Date.now());return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function scheduleDateParse(v){const s=String(v||'').trim(),m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3],12,0,0,0);return scheduleDateKey(d)===s?d:null;}
function scheduleLeaveDays(start,end){const a=scheduleDateParse(start),b=scheduleDateParse(end);return a&&b&&b>=a?Math.floor((b-a)/86400000)+1:0;}
function scheduleLeaves(c){const rows=c&&c.sched&&Array.isArray(c.sched.leaves)?c.sched.leaves:[];return rows.map(x=>{const start=scheduleDateParse(x&&x.start),end=scheduleDateParse(x&&x.end);return start&&end&&end>=start?Object.assign({},x,{start:scheduleDateKey(start),end:scheduleDateKey(end)}):null;}).filter(Boolean).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));}
function roleLeaveOn(c,t){const key=scheduleDateKey(t||Date.now());return scheduleLeaves(c).find(x=>x.start<=key&&x.end>=key)||null;}
// 节假日放假：法定假期区间、调休上班日，以及情人节 / 520 / 七夕 / 圣诞这类情侣节日
function roleHolidayTables(){return{legal:{2025:{off:[['2025-01-01','2025-01-01','元旦'],['2025-01-28','2025-02-04','春节'],['2025-04-04','2025-04-06','清明节'],['2025-05-01','2025-05-05','劳动节'],['2025-05-31','2025-06-02','端午节'],['2025-10-01','2025-10-08','国庆节']],work:['2025-01-26','2025-02-08','2025-04-27','2025-09-28','2025-10-11']},2026:{off:[['2026-01-01','2026-01-03','元旦'],['2026-02-15','2026-02-23','春节'],['2026-04-04','2026-04-06','清明节'],['2026-05-01','2026-05-05','劳动节'],['2026-06-19','2026-06-21','端午节'],['2026-09-25','2026-09-27','中秋节'],['2026-10-01','2026-10-07','国庆节']],work:['2026-01-04','2026-02-14','2026-02-28','2026-05-09','2026-09-20','2026-10-10']},2027:{off:[['2027-01-01','2027-01-03','元旦'],['2027-02-05','2027-02-11','春节'],['2027-04-03','2027-04-05','清明节'],['2027-05-01','2027-05-05','劳动节'],['2027-06-09','2027-06-09','端午节'],['2027-09-15','2027-09-15','中秋节'],['2027-10-01','2027-10-07','国庆节']],work:[]}},sweet:{'02-14':'情人节','05-20':'520','12-25':'圣诞节'},qixi:{2025:'2025-08-29',2026:'2026-08-19',2027:'2027-08-08'}};}
function roleHolidaysOn(c){const sc=c&&c.sched;return !(sc&&sc.holidays===false);}
function roleHolidayAt(key){const T=roleHolidayTables(),y=+String(key).slice(0,4),md=String(key).slice(5),tbl=T.legal[y];if(tbl){const r=tbl.off.find(x=>x[0]<=key&&x[1]>=key);if(r)return{name:r[2],start:r[0],end:r[1],kind:'legal'};}else{const fixed={'01-01':'元旦','05-01':'劳动节','05-02':'劳动节','05-03':'劳动节','10-01':'国庆节','10-02':'国庆节','10-03':'国庆节','10-04':'国庆节','10-05':'国庆节','10-06':'国庆节','10-07':'国庆节'};if(fixed[md])return{name:fixed[md],start:key,end:key,kind:'legal'};}if(T.sweet[md])return{name:T.sweet[md],start:key,end:key,kind:'sweet'};if(T.qixi[y]===key)return{name:'七夕',start:key,end:key,kind:'sweet'};return null;}
function roleHolidayOn(c,t){return roleHolidaysOn(c)?roleHolidayAt(scheduleDateKey(t||Date.now())):null;}
function roleMakeupWorkday(c,t){if(!roleHolidaysOn(c))return false;const key=scheduleDateKey(t||Date.now()),tbl=roleHolidayTables().legal[+key.slice(0,4)];return !!(tbl&&tbl.work.includes(key)&&!roleHolidayAt(key));}
function roleDayOff(c,t){const d=t instanceof Date?t:roleClockDate(t||Date.now()),leave=roleLeaveOn(c,d);if(leave)return{kind:'leave',label:'请假日',leave};const hol=roleHolidayOn(c,d);if(hol)return{kind:'holiday',label:hol.name+'假期',holiday:hol};if(roleMakeupWorkday(c,d))return null;return roleWorkday(d)?null:{kind:'weekend',label:'休息日'};}
function roleUpcomingHolidays(c,t,days){if(!roleHolidaysOn(c))return[];const out=[],base=t instanceof Date?t:roleClockDate(t||Date.now());for(let i=0;i<(days||30);i++){const d=new Date(base.getFullYear(),base.getMonth(),base.getDate()+i,12),h=roleHolidayAt(scheduleDateKey(d));if(h&&!out.some(x=>x.name===h.name&&x.start===h.start))out.push(h);}return out;}
function scheduleLeaveLabel(x){if(!x)return'';const days=scheduleLeaveDays(x.start,x.end),a=scheduleDateParse(x.start),b=scheduleDateParse(x.end);if(!a||!b||!days)return'';return days===1?(weekdayCN(a)+'已请假一天'):(weekdayCN(a)+'至'+weekdayCN(b)+'已请假'+days+'天');}
function roleScheduleBrief(c,t){const sc=c&&c.sched;if(!sc||!sc.on)return'未启用';const today=scheduleDateKey(t||Date.now()),active=roleLeaveOn(c,t),next=scheduleLeaves(c).find(x=>x.start>today);const hol=!active&&roleHolidayOn(c,t);if(hol)return hol.name+'放假';return active?scheduleLeaveLabel(active):(next?('即将'+scheduleLeaveLabel(next)):((sc.amS||'08:00')+' 上班'));}
function whereNow(c,at){const sc=c&&c.sched;if(!sc||!sc.on)return '';
  const now=at instanceof Date?at:roleClockDate(at||Date.now()),t=now.getHours()*60+now.getMinutes();
  const amS=toMin(sc.amS||'08:00'),amE=toMin(sc.amE||'12:00'),pmS=toMin(sc.pmS||'14:00'),pmE=toMin(sc.pmE||'18:00');
  const work=sc.work||'公司',home=sc.home||'家',off=roleDayOff(c,now),rest=off?off.label:'休息日';
  if(off){if(t<8*60)return rest+'在'+home+'睡觉或休息';if(t<10*60)return rest+'在'+home+'慢慢起床、吃早饭';if(t<12*60)return rest+'上午的自由时间，可能在'+home+'，也可能和重要的人一起活动';if(t<14*60)return rest+'午饭和午间自由时间';if(t<18*60)return rest+'下午自由活动，不按工作日上班';if(t<23*60+30)return rest+'晚上在'+home+'或外出放松';return rest+'在'+home+'准备睡觉';}
  if(t<amS-60)return '还在'+home+'睡觉或赖床';
  if(t<amS)return '在'+home+'起床收拾、准备上班，或在通勤路上';
  if(t<amE)return '在'+work+'上班（在工位忙、或正在开会）';
  if(t<pmS)return '午休时间，在外面或公司附近吃午饭、或在休息室眯一会儿';
  if(t<pmE)return '在'+work+'上班';
  if(t<pmE+150)return '刚下班，可能在回'+home+'的路上、在外面吃晚饭、或顺路逛逛买点东西';
  if(t<23*60+30)return '下班后的自由时间：可能在'+home+'，也可能在外面（吃东西/购物/约朋友/某个地方），晚一点会回'+home;
  return '在'+home+'休息、准备睡觉';}
function activityHash(s){let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return Math.abs(h>>>0);}
function activityPick(c,key,arr,now){const d=now||roleClockDate(),seed=(c&&c.id||'role')+'|'+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()+'|'+key;return arr[activityHash(seed)%arr.length];}
function activitySpec(c,now){now=now||roleClockDate();const h=now.getHours(),m=h*60+now.getMinutes(),sc=c&&c.sched,home=(sc&&sc.home)||'家',work=(sc&&sc.work)||'工作地点',workThing=c&&c.job?(c.job+'相关的事'):'工作',off=sc&&sc.on?roleDayOff(c,now):null;let key,label,busy=0,until;
  if(off){const kp=off.kind,rest=off.label;if(m<8*60){key=kp+'-sleep';label=rest+'在'+home+'睡觉或休息';busy=3;until=8*60;}else if(m<10*60){key=kp+'-morning';label=activityPick(c,key,[rest+'在'+home+'慢慢起床',rest+'在吃早饭',rest+'在'+home+'收拾'],now);busy=0;until=10*60;}else if(m<12*60){key=kp+'-free-am';label=activityPick(c,key,['在过'+rest+'上午的自由时间','在'+home+'做自己的事','在和重要的人一起活动'],now);busy=0;until=12*60;}else if(m<14*60){key=kp+'-lunch';label=activityPick(c,key,['在吃'+rest+'午饭','吃完午饭放松','在午间休息'],now);busy=0;until=14*60;}else if(m<18*60){key=kp+'-free-pm';label=activityPick(c,key,['在过'+rest+'下午','在外面放松','在'+home+'做喜欢的事'],now);busy=0;until=18*60;}else if(m<23*60+30){key=kp+'-evening';label=activityPick(c,key,['在过'+rest+'晚上','在'+home+'放松','在和重要的人一起消磨时间'],now);busy=0;until=23*60+30;}else{key=kp+'-late';label=rest+'在'+home+'准备休息';busy=2;until=24*60;}}
  else if(sc&&sc.on){const amS=toMin(sc.amS||'08:00'),amE=toMin(sc.amE||'12:00'),pmS=toMin(sc.pmS||'14:00'),pmE=toMin(sc.pmE||'18:00');
    if(m<amS-60){key='sleep';label='还在'+home+'睡觉';busy=3;until=amS-60;}
    else if(m<amS){key='morning';label=activityPick(c,key,['在'+home+'起床收拾','在准备出门','在通勤路上'],now);busy=1;until=amS;}
    else if(m<amE){key='work-am';label='在'+work+'忙'+workThing;busy=3;until=amE;}
    else if(m<pmS){key='lunch';label=activityPick(c,key,['在吃午饭','刚吃完午饭休息','在午休'],now);busy=1;until=pmS;}
    else if(m<pmE){key='work-pm';label='在'+work+'忙'+workThing;busy=3;until=pmE;}
    else if(m<pmE+150){key='after-work';label=activityPick(c,key,['刚忙完在回'+home+'的路上','刚结束今天的工作','在处理下班前后的琐事'],now);busy=1;until=pmE+150;}
    else if(m<23*60+30){key='evening';label=activityPick(c,key,['在'+home+'休息','在整理自己的东西','在做自己的事','刚闲下来'],now);busy=0;until=23*60+30;}
    else{key='late';label='在'+home+'准备休息';busy=2;until=24*60;}
  }else if(h<7){key='sleep';label='在睡觉或休息';busy=3;until=7*60;}
  else if(h<9){key='morning';label=activityPick(c,key,['刚起床收拾','在吃早饭','在准备开始今天的事'],now);busy=1;until=9*60;}
  else if(h<12){key='day-am';label=c&&c.job?('在忙'+c.job+'相关的工作'):activityPick(c,key,['在处理手头的事情','在忙自己的事'],now);busy=3;until=12*60;}
  else if(h<14){key='lunch';label=activityPick(c,key,['在吃午饭','吃完午饭歇一会儿','在午休'],now);busy=1;until=14*60;}
  else if(h<18){key='day-pm';label=c&&c.job?('在忙'+c.job+'相关的工作'):activityPick(c,key,['在处理手头的事情','在忙自己的事'],now);busy=3;until=18*60;}
  else if(h<23){key='evening';label=activityPick(c,key,['刚忙完闲下来','在吃晚饭','在休息','在做自己的事'],now);busy=0;until=23*60;}
  else{key='late';label='准备休息';busy=2;until=24*60;}
  const end=new Date(now);end.setHours(0,until||0,0,0);if(end<=now)end.setDate(end.getDate()+1);return{key,label,busy,until:end.getTime(),source:sc&&sc.on?'schedule':'inferred'};}
function currentRoleActivity(){return null;}
function currentActivityPrompt(){return'';}
function roleScheduleSyncTag(text){return /\[(?:(?:共同生活|同居)状态\s*[|｜:：]\s*(?:回家路上|在路上|到家|回家|外出|一起外出|一起回家)|(?:共同生活|同居)(?:请假|作息)\s*[|｜:：])/.test(String(text||''));}
function roleScheduleClaimIssue(text,c,instant){const sc=c&&c.sched;if(!S.settings.timeAware||!sc||!sc.on)return'';const now=roleClockDate(+instant||Date.now());if(roleDayOff(c,now))return'';const minute=now.getHours()*60+now.getMinutes(),amS=toMin(sc.amS||'08:00'),amE=toMin(sc.amE||'12:00'),pmS=toMin(sc.pmS||'14:00'),pmE=toMin(sc.pmE||'18:00'),working=minute>=amS&&minute<amE||minute>=pmS&&minute<pmE;if(!working)return'';const visible=String(text||'').replace(/\[[^\]】]{1,160}[\]】]/g,' '),leftWork=/(?:我)?(?:今天)?(?:已经|刚刚|刚|现在|这会儿)?(?:提前|提早|临时)?(?:下班|收工|离开公司|离开单位)(?:了|啦|咯)?/.test(visible);if(!leftWork)return'';const root=S.cohabitation,life=!!(root&&root.enabled&&!root.paused&&root.cid===c.id);if(!life||roleScheduleSyncTag(text))return'';return'固定工作时段内声称已经下班但没有同步共同生活状态';}
function roleSchedulePrompt(c){if(!S.settings.timeAware)return'';const sc=c&&c.sched;if(!sc||!sc.on)return'';const now=roleClockDate(),leave=roleLeaveOn(c,now),future=scheduleLeaves(c).filter(x=>x.end>=scheduleDateKey(now)).slice(0,6),minute=now.getHours()*60+now.getMinutes(),amS=toMin(sc.amS||'08:00'),amE=toMin(sc.amE||'12:00'),pmS=toMin(sc.pmS||'14:00'),pmE=toMin(sc.pmE||'18:00'),off=roleDayOff(c,now),hol=off&&off.kind==='holiday'?off.holiday:null,soon=roleUpcomingHolidays(c,now,21).filter(x=>x.start>scheduleDateKey(now)).slice(0,3),rule=leave?('今天是'+weekdayCN(now)+'，已登记请假，不上班。请假范围为 '+leave.start+' 至 '+leave.end+(leave.reason?'，原因：'+leave.reason:'')+(leave.source==='me'?'。这次假是'+(S.me&&S.me.name||'她')+'亲自给你请的，你知道是她让你休息':'')+'；请假结束后自动恢复原工作日作息。'):hol?('今天是'+weekdayCN(now)+'，'+(hol.kind==='legal'?'正值'+hol.name+'法定假期（'+hol.start+' 至 '+hol.end+'），放假不上班。':'是'+hol.name+'，按约定放假一天不上班，可以把时间留给重要的人。')+'除非现场已经明确发生临时加班，不要套用上班时段。'):roleMakeupWorkday(c,now)?('今天是'+weekdayCN(now)+'，是节假日调休的补班日，要照常上班，按工作日作息：上午 '+(sc.amS||'08:00')+'—'+(sc.amE||'12:00')+'、下午 '+(sc.pmS||'14:00')+'—'+(sc.pmE||'18:00')+'。'):roleWorkday(now)?('今天是'+weekdayCN(now)+'，属于周一至周五工作日。上午 '+(sc.amS||'08:00')+'—'+(sc.amE||'12:00')+'、下午 '+(sc.pmS||'14:00')+'—'+(sc.pmE||'18:00')+' 按已设置作息工作，中间是午休；没有已登记的请假、调休或临时加班时，不能把今天说成休息日。'):('今天是'+weekdayCN(now)+'，属于周末休息日。不要套用周一至周五的上班时段，除非现场已经明确发生临时加班。'),phase=off?'当前是'+off.label+'，不按工作日作息。':minute>=amS&&minute<amE?('当前处于上午工作时段，默认仍在工作，直到 '+(sc.amE||'12:00')+'。'):minute>=amE&&minute<pmS?('当前处于午休时段，直到 '+(sc.pmS||'14:00')+'。'):minute>=pmS&&minute<pmE?('当前处于下午工作时段，默认仍在工作，直到 '+(sc.pmE||'18:00')+'。'):minute>=pmE?('当前已经超过正常下班时间 '+(sc.pmE||'18:00')+'。'):'当前尚未到正常上班时间。',life=S.cohabitation&&S.cohabitation.enabled&&!S.cohabitation.paused&&S.cohabitation.cid===c.id;return '\n\n# 已明确设置的作息事实（当前默认状态）\n'+rule+'\n'+phase+(future.length?'\n当前及即将生效的请假：'+future.map(x=>x.start+' 至 '+x.end+(x.reason?'（'+x.reason+'）':'')+(x.source==='me'?'〔'+(S.me&&S.me.name||'她')+'给你请的〕':'')).join('；')+'。':'')+(soon.length?'\n近期节假日（到时放假）：'+soon.map(x=>x.name+' '+x.start+(x.end!==x.start?' 至 '+x.end:'')).join('；')+'。':'')+'\n作息表是当前活动的默认事实：它不强迫你汇报时间或机械说忙，但在没有已经发生的明确例外时，不能无依据跳过午休、提前下班或把未发生的阶段说成已经发生。角色仍可按人设自主决定一次临时提前离岗或加班，但必须把它说成这次真实例外。'+(life?'当前共同生活已开启；如果你决定提前下班、离开工作地点或已经到家，同一条回复必须附加对应的 [共同生活状态|回家路上|预计分钟|状态] 或 [共同生活状态|到家|在玄关]，不能只在台词里改口而让顶部状态继续显示上班。':'');}
function isOnline(){const m=S.me.onlineMode||'auto';if(m==='on')return true;if(m==='off')return false;return document.visibilityState==='visible';}
function presenceSet(on){S.presence=S.presence||{};if(S.presence.online!==on){S.presence.online=on;S.presence.changedAt=Date.now();if(on)S.presence.lastOn=Date.now();else S.presence.lastOff=Date.now();try{save(900);}catch(e){}}return S.presence;}
function syncPresence(){return presenceSet(isOnline());}
function presenceNote(){const p=S.presence||{};const a=[];if(p.lastOn)a.push('最近一次显示在线：'+fmtDT(p.lastOn));if(p.lastOff)a.push('最近一次显示离线：'+fmtDT(p.lastOff));return a.join('；');}
document.addEventListener('visibilitychange',()=>syncPresence());
window.addEventListener('pageshow',()=>syncPresence());
window.addEventListener('pagehide',()=>presenceSet(false));
setTimeout(()=>syncPresence(),1000);
let _stepOn=false,_stepLast=0,_stepPrev=0,_stepHandler=null,_stepSaveTimer=0,_stepDirty=false,_stepDayCheckAt=0,_stepMotionSampleAt=0;
function stepDayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function ensureDailySteps(){S.me=S.me||{};const today=stepDayKey();if(!S.me.stepDate){S.me.stepDate=today;return false;}if(S.me.stepDate!==today){S.me.stepDate=today;S.me.steps=0;S.me._stepRptDate='';save(900);return true;}return false;}
function flushStepSave(){if(_stepSaveTimer){clearTimeout(_stepSaveTimer);_stepSaveTimer=0;}if(!_stepDirty)return false;_stepDirty=false;save(0);return true;}
function queueStepSave(){_stepDirty=true;if(!_stepSaveTimer)_stepSaveTimer=setTimeout(flushStepSave,5000);}
function stepMotion(e){const a=e.accelerationIncludingGravity||e.acceleration,now=Date.now();if(!a||now-_stepMotionSampleAt<180)return;_stepMotionSampleAt=now;const mag=Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2);
  if(!_stepDayCheckAt||now-_stepDayCheckAt>=60000){_stepDayCheckAt=now;ensureDailySteps();}const stepped=mag-_stepPrev>2.2&&now-_stepLast>320;if(stepped){S.me.steps=(S.me.steps||0)+1;S.me.stepDate=stepDayKey();_stepLast=now;queueStepSave();if(cur().p==='wechat'&&wxTab==='me'){const e2=document.querySelector('.it span');}}_stepPrev=mag;}
async function toggleSteps(){if(_stepOn){window.removeEventListener('devicemotion',_stepHandler);_stepOn=false;S.me.stepOn=false;if(!flushStepSave())save();render();toast('已停止计步');return;}
  try{if(typeof DeviceMotionEvent!=='undefined'&&DeviceMotionEvent.requestPermission){const p=await DeviceMotionEvent.requestPermission();if(p!=='granted'){S.me.stepPermissionGranted=false;toast('没给运动权限');return;}S.me.stepPermissionGranted=true;}
    ensureDailySteps();_stepDayCheckAt=Date.now();_stepHandler=stepMotion;window.addEventListener('devicemotion',_stepHandler);_stepOn=true;S.me.stepOn=true;save();render();toast('开始计步，步数每天0点自动刷新');
  }catch(e){toast('这设备不支持计步，可在资料里手填步数');}}
async function resumeSteps(){if(_stepOn||!S.me.stepOn)return;
  try{if(typeof DeviceMotionEvent!=='undefined'&&DeviceMotionEvent.requestPermission&&S.me.stepPermissionGranted!==true)return;
    ensureDailySteps();_stepDayCheckAt=Date.now();_stepHandler=stepMotion;window.addEventListener('devicemotion',_stepHandler);_stepOn=true;if(cur().p==='wechat'&&wxTab==='me')render();}catch(e){}}
document.addEventListener('click',()=>{if(S.me.stepOn&&!_stepOn)resumeSteps();},{once:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushStepSave();});
/* ===== 语音 ===== */
function getVoice(o){if(!o.voice)o.voice={engine:'system',voiceURI:'',rate:1,pitch:1,pause:.6,lang:'zh',accent:'auto'};if(!o.voice.accent)o.voice.accent='auto';if(o.voice.pause==null)o.voice.pause=.6;if(!o.voice.ttsRouteVoices||typeof o.voice.ttsRouteVoices!=='object'||Array.isArray(o.voice.ttsRouteVoices))o.voice.ttsRouteVoices={};return o.voice;}
function ttsRoleVoiceId(o,tts){const v=o?getVoice(o):null;if(!v)return String(tts&&tts.voice||'').trim();const i=ttsRoleRouteIndex(o),map=v.ttsRouteVoices||{},mapped=Object.prototype.hasOwnProperty.call(map,i)?String(map[i]||'').trim():'';if(mapped)return mapped;if(ttsRoleRouteOwnIndex(o)==null){const legacy=String(v.ttsVoice||'').trim();if(legacy)return legacy;}return String(tts&&tts.voice||'').trim();}
function voiceRate(o){const v=o&&o.voice?o.voice:o||{};return Math.max(.5,Math.min(1.8,+v.rate||1));}
function voicePitch(o){const v=o&&o.voice?o.voice:o||{};return Math.max(.5,Math.min(1.6,+v.pitch||1));}
function voiceApiPitch(o){return Math.max(-12,Math.min(12,Math.round(12*Math.log2(voicePitch(o)))));}
function voiceApiTuningOn(o){const v=o&&o.voice?o.voice:o||{};return !!(v&&v.apiTuning===true);}
function voiceProgressiveOn(){return !!(S.settings&&S.settings.voiceProgressive===true);}
function voicePauseSeconds(o){const v=o&&o.voice?o.voice:o||{},n=v.pause==null?.6:+v.pause;return Math.max(0,Math.min(3,Number.isFinite(n)?n:.6));}
function voicePauseMs(o){return Math.round(voicePauseSeconds(o)*1000);}
function stripSpoken(t){return (t||'').replace(/[（(【][^）)】]*[）)】]/g,'').replace(/\[[^\]]*\]/g,'').replace(/[*_~`#>]/g,'').trim();}
function ttsCleanBase(text){return stripSpoken(text).replace(/[\u{1f300}-\u{1faff}\u2600-\u27bf]/gu,'').replace(/\s+/g,' ').replace(/([。！？!?]){3,}/g,'$1$1').trim();}
function voiceEstimatedSeconds(text){const s=ttsCleanBase(text),cjk=(s.match(/[\u3400-\u9fff\uf900-\ufaff]/g)||[]).length,latin=(s.replace(/[\u3400-\u9fff\uf900-\ufaff]/g,' ').match(/[A-Za-z0-9]+(?:'[A-Za-z]+)?/g)||[]).length,pause=(s.match(/[，、；：,.!?。！？]/g)||[]).length*.16;return Math.max(1,Math.min(VOICE_MAX_SECONDS,Math.ceil(cjk/4.2+latin/2.7+pause)));}
function ttsStyleKind(tts){const relay=!!(ttsEnabled(tts)&&ttsRelayOn(tts)),base=String((tts&&tts.base)||'').toLowerCase(),model=String(relay?'speech-02-turbo':((tts&&tts.model)||'')).toLowerCase();if(relay)return '';if(/minimax/.test(base)&&/speech-2\.8/.test(model))return 'minimax';if(/elevenlabs/.test(base)&&/(^|[_-])v?3|eleven.*3/.test(model))return 'eleven';if(/fish\.?audio/.test(base)&&/(?:s2(?:\.|[_-])?1|s2|speech.*2|fish.*2)/.test(model))return 'fish';if(/hume\.ai/.test(base)&&/octave/.test(model))return 'hume';return '';}
function ttsEmotionHint(text,o){const s=(String(text||'')+' '+String((o&&o.mood)||'')).replace(/\s+/g,' ');if(/哈哈|嘿嘿|笑死|好笑|笑了|开心|高兴|甜|宠|撒娇|\b(?:laugh|laughing|happy|glad|excited|teasing|playful)\b/i.test(s))return 'laugh';if(/哭|难过|委屈|心疼|别哭|不开心|崩溃|好累|受不了|担心|怕你|\b(?:cry|crying|sad|hurt|upset|heartbroken|worried|sorry)\b/i.test(s))return 'soft';if(/想你|爱你|抱抱|亲亲|乖|靠近|过来|陪你|哄你|晚安|\b(?:love you|miss you|come here|baby|darling|good night|hold you)\b/i.test(s))return 'warm';if(/生气|吃醋|不爽|闭嘴|滚|质问|解释清楚|凶一点|压低声音|\b(?:angry|mad|jealous|furious|explain|tell me why|how dare|shut up|don't lie)\b/i.test(s))return 'tense';if(/困|睡|晚安|闭眼|睡吧|哄睡|\b(?:sleepy|sleep|good night|close your eyes|tired)\b/i.test(s))return 'sleepy';return '';}
function ttsCueKind(cue){cue=String(cue||'').replace(/^(?:语气|tone|emotion)\s*[:：]?/i,'').trim().toLowerCase();if(!cue)return '';if(/中性|平静|自然|neutral|calm|normal/.test(cue))return 'neutral';if(/亲|kiss|mwah|啵|mua/.test(cue))return 'kiss';if(/惊讶|震惊|surpris|shock/.test(cue))return 'surprised';if(/害怕|恐惧|fear|scared|afraid/.test(cue))return 'fearful';if(/厌恶|嫌弃|disgust|revolted/.test(cue))return 'disgusted';if(/笑|开心|高兴|laugh|giggle|happy|excited|playful/.test(cue))return 'laugh';if(/叹|委屈|难过|心疼|悲伤|sigh|sad|hurt|upset/.test(cue))return 'soft';if(/低声|低沉|沉声|压低|低哑|耳语|悄悄|气声|whisper|breathy|low voice|lower your voice|困|睡|sleepy/.test(cue))return 'sleepy';if(/强硬|严肃|愤怒|凶|firm|stern|tense|angry|mad|furious|jealous|envy|吃醋|生气|质问|逼问|反问|压着|questioning|interrogate/.test(cue))return 'tense';if(/温柔|宠溺|亲密|soft|warm|gentle|tender|affection|哄|撒娇|贴近/.test(cue))return 'warm';return '';}
function ttsAutoCue(text,o){const s=(String(text||'')+' '+String((o&&o.mood)||'')).replace(/\s+/g,' ');if(/亲亲|亲一下|亲一口|亲你|吻|啵|\b(?:kiss(?: me| you)?|mwah|mua)\b/i.test(s))return 'kiss';if(/生气|吃醋|不爽|凶一点|凶我|严厉点|大声点|压低声音|你说呢|解释清楚|为什么|凭什么|怎么回事|到底|嗯？|哼|质问|逼问|反问|\b(?:angry|mad|furious|jealous|be mean|meaner|be stern|sound stern|sound angry|lower your voice|raise your voice|tell me why|explain yourself|how dare|don't lie)\b/i.test(s))return 'tense';if(/惊讶|震惊|\b(?:surprised|shocked|no way)\b/i.test(s))return 'surprised';if(/害怕|恐惧|\b(?:afraid|scared|fearful|terrified)\b/i.test(s))return 'fearful';if(/厌恶|嫌弃|\b(?:disgusted|disgusting|revolting)\b/i.test(s))return 'disgusted';if(/难过|委屈|伤心|\b(?:sad|hurt|upset|heartbroken|crying)\b/i.test(s))return 'soft';if(/晚安|睡吧|闭眼|困|哄睡|\b(?:whisper|breathy|sleepy|sleep|good night|close your eyes)\b/i.test(s))return 'sleepy';if(/开心|高兴|兴奋|\b(?:happy|excited|laugh|laughing|playful)\b/i.test(s))return 'laugh';return '';}
function ttsRequestedCue(text){const s=String(text||'');if(/亲一下|亲一口|亲亲|啵一下|吻一下|\b(?:kiss me|kiss you|give me a kiss|mwah|mua)\b/i.test(s))return '亲亲';if(/大笑|笑出声|放声笑|\b(?:laugh out loud|laugh loudly|big laugh|lol)\b/i.test(s))return '大笑';if(/笑一下|轻笑|笑一声|低笑|哼笑|\b(?:laugh|giggle|chuckle|little laugh)\b/i.test(s))return '轻笑';if(/叹气|叹一口气|\b(?:sigh|exhale sadly)\b/i.test(s))return '叹气';if(/哭一下|哭出声|\b(?:cry|sob)\b/i.test(s))return '哭泣';if(/凶一点|凶我|严厉一点|强硬一点|大声一点|提高音量|压低声音|质问我|逼问我|生气一点|\b(?:be mean(?:er)?|be stern(?:er)?|sound angry|act angry|get angry|raise your voice|speak louder|lower your voice|question me|interrogate me|scold me)\b/i.test(s))return '质问';if(/温柔一点|轻一点|小声一点|耳语|气声|\b(?:be gentle|softer|speak softly|lower the volume|whisper|breathy)\b/i.test(s))return '低声';if(/开心一点|\b(?:sound happy|be happy)\b/i.test(s))return '开心';if(/难过一点|委屈一点|\b(?:sound sad|be sad|sound hurt)\b/i.test(s))return '难过';return '';}
function explicitVoiceReplyRequest(text){const s=String(text||'').replace(/\s+/g,' ').trim();if(!s||/(?:不要|别|不用|禁止|不许|不想)(?:再)?[^，。！？!?\n]{0,8}语音/.test(s))return false;return /(?:^|[，,。！？!?\s])(?:(?:先生|哥哥|姐姐|宝贝|宝宝|亲爱的|老公|老婆)[~～，,\s]*)?(?:(?:重新|重|再)(?:给我)?(?:发|来|回复|回)[^，。！？!?\n]{0,18}语音|(?:请|麻烦)?(?:你|给我)?(?:发|来|回复|回)(?!过|了|的)[^，。！？!?\n]{0,18}语音)|(?:想听|要听|想让你|要你|让你)[^，。！？!?\n]{0,18}语音|(?:用|改用|请用)语音(?:回|回复|说|讲|发)|语音(?:回|回复)(?:我|一下)?/.test(s);}
function voiceReplyTagValid(content,c){const lang=ttsContentLang(c),lines=String(content||'').split(/\n/).map(x=>x.trim()).filter(Boolean),tags=lines.map(parseVoiceTagLine).filter(Boolean),plain=lines.filter(x=>!/^[\[【]/.test(x));if(tags.length!==1||plain.length)return false;const v=tags[0],n=[...(v.text||'')].length;if(!n||n>VOICE_MAX_CHARS)return false;return !lang||lang==='zh'||!!(hasForeign(v.text,lang)&&/[\u3400-\u9fff]/.test(v.trans||''));}
function requestedVoiceNeedsFix(content,userText,c){return !!(explicitVoiceReplyRequest(userText)&&!voiceReplyTagValid(content,c));}
function voiceReplyBlocked(vf0,tooLong,badLang,required){return !!(tooLong||(!required&&(vf0===0||badLang)));}
function voiceReplyCanRepairCandidate(text,opt){return !!(opt&&opt.roleVoiceFormatRepair&&(opt.roleVoiceRequested||String(text||'').split(/\n/).some(parseVoiceTagLine)));}
async function finalizeVoiceReply(content,userText,c,repair,audit){
  const required=explicitVoiceReplyRequest(userText),hasVoice=s=>splitBubbles(s).some(parseVoiceTagLine);
  const needsFix=voiceTagNeedsLangFix(content,c)||(required&&!voiceReplyTagValid(content,c));
  if(needsFix){
    const language=voiceLangName(ttsContentLang(c))||'中文',original=String(content||'');
    const prompt='[语音格式修复：保留本轮真正要表达的意思和情绪，不新增台词或事实。'+(required?'用户明确要求语音，请把正文合并为一条语音。':'你本轮已选择发送语音，请保留语音消息类型，不要改成普通文字。')+'当前语音语言是'+language+'；每条最多'+VOICE_MAX_CHARS+'字。中文使用 [语音|中文正文|语气:温柔]；外语必须使用 [语音|对应外语原文|准确的中文翻译|语气:温柔]，语气选真实适用的值。中文翻译必须是真正的译文，语气字段不算翻译。其他合法功能标签保留，不解释修复。]';
    try{const fixed=await repair(prompt,original);if(fixed&&hasVoice(fixed)&&!voiceTagNeedsLangFix(fixed,c)&&!roleReplyEnglishOnly(fixed)&&!wechatRoleDrift(fixed)&&(!required||voiceReplyTagValid(fixed,c)))content=fixed;}catch(_){}
  }
  // A failed foreign-language repair must never become an untranslated text bubble.
  if(required)content=forceRequestedVoiceReply(content,userText,c);
  if(voiceTagNeedsLangFix(content,c)){
    const reason='语音格式不完整：模型未提供对应语言和中文翻译';
    if(audit&&audit.c&&typeof roleInterceptDiagnosticRemember==='function')roleInterceptDiagnosticRemember(audit.c,audit.channel,String(content||''),reason,'已尝试一次语音格式修复；没有降级成英文文字',audit.account);
    const error=new Error(reason);error.code='VOICE_REPLY_FORMAT';throw error;
  }
  roleReplyAssertLanguage(content,audit);
  return content;
}
function forceRequestedVoiceReply(content,userText,c){content=String(content||'');if(!explicitVoiceReplyRequest(userText))return content;const lines=content.split(/\n/),tagged=lines.map((line,i)=>({i,v:parseVoiceTagLine(line)})).filter(x=>x.v),plain=[];for(let i=0;i<lines.length;i++){const t=String(lines[i]||'').trim();if(t&&!/^[\[【]/.test(t))plain.push(i);}const first=tagged.length?tagged[0].i:(plain.length?plain[0]:-1);if(first<0)return content;const source=tagged.length?tagged[0].v:null,joined=(source?String(source.text||''):plain.map(i=>String(lines[i]||'').trim()).join(' ')).replace(/[|｜]/g,'，').trim(),voice=[...joined].slice(0,VOICE_MAX_CHARS).join('').trim(),trans=source?String(source.trans||'').replace(/[|｜]/g,'，').trim():'',cue=String((source&&source.cue)||ttsRequestedCue(userText)||ttsAutoCue(voice,c)||'').replace(/[|｜\]】]/g,'，').trim();if(!voice)return content;const tag='[语音|'+voice+(trans?'|'+trans:'')+(cue?'|语气:'+cue:'')+']';return lines.flatMap((line,i)=>i===first?[tag]:(parseVoiceTagLine(line)||(!/^[\[【]/.test(String(line||'').trim())&&String(line||'').trim()))?[]:[line]).join('\n');}
function ttsSafeProsody(base,o){let s=String(base||'').trim();if(!s)return '';s=s.replace(/([。！？!?])(?=\S)/g,'$1 ').replace(/([，、；;：:])(?=\S)/g,'$1 ').replace(/\.{3,}|…{2,}/g,'……').replace(/([吧呢啊呀哦嘛])([。！？!?])(?=\S)/g,'$1$2 ');
  const emo=ttsEmotionHint(s,o),cn=hasCN(s);if(cn&&emo==='soft')s=s.replace(/别哭[，,]?/,'别哭，').replace(/我在[。!！]?$/,'我在。');if(cn&&emo==='sleepy')s=s.replace(/晚安[。!！]?$/,'晚安……');return s.replace(/\s+/g,' ').trim();}
function ttsSentencePauseText(text,o){return String(text||'').trim();}/* API 只接收原标点；连续省略号会让部分音色误判成结巴或重复词。真实句间等待由播放队列的 voicePauseMs 完成。 */
function tts2p8Interjection(s,rawCue){s=String(s||'').trim();const cue=String(rawCue||'').toLowerCase();if(!s||!cue)return s;let tag='',before=false;if(/亲亲|亲吻|kiss|mwah|啵|mua/.test(cue))tag='(lip-smacking)';else if(/轻笑|chuckle|giggle/.test(cue))tag='(chuckle)';else if(/大笑|laughs|laugh/.test(cue))tag='(laughs)';else if(/叹气|sigh/.test(cue)){tag='(sighs)';before=true;}else if(/吸气|inhale/.test(cue)){tag='(inhale)';before=true;}else if(/呼气|exhale/.test(cue)){tag='(exhale)';before=true;}else if(/喘息|pant/.test(cue))tag='(pant)';else if(/哭泣|crying/.test(cue)){tag='(crying)';before=true;}return tag?(before?(tag+' '+s):(s+' '+tag)):s;}
function tts2p8IsInterjectionCue(cue){return /亲亲|亲吻|kiss|mwah|啵|mua|轻笑|chuckle|giggle|大笑|laughs|laugh|叹气|sigh|吸气|inhale|呼气|exhale|喘息|pant|哭泣|crying/i.test(String(cue||''));}
function ttsRelayInterjection(s,rawCue){s=String(s||'').trim();const cue=String(rawCue||''),explicit=/亲亲|亲吻|mwah|啵|mua|轻笑|chuckle|giggle|大笑|laughs|叹气|sigh|吸气|inhale|呼气|exhale|喘息|pant|哭泣|crying/i.test(cue);if(!s||!explicit)return s;const cn=hasCN(s);let sound='';if(/亲亲|亲吻|mwah|啵|mua/i.test(cue))sound=cn?'啵。':'Mwah.';else if(/轻笑|chuckle|giggle/i.test(cue))sound=cn?'呵……':'Heh...';else if(/大笑|laughs/i.test(cue))sound=cn?'哈哈。':'Ha ha.';else if(/叹气|sigh/i.test(cue))sound=cn?'唉……':'Sigh...';else if(/吸气|inhale/i.test(cue))sound=cn?'嘶……':'Gasp...';else if(/呼气|exhale/i.test(cue))sound=cn?'呼……':'Phew...';else if(/喘息|pant/i.test(cue))sound=cn?'呼，呼……':'Huff, puff...';else if(/哭泣|crying/i.test(cue))sound=cn?'呜……':'Oh...';return sound?(sound+' '+s):s;}
function ttsFishSoundLead(rawCue,s){const raw=String(rawCue||''),cn=hasCN(s);if(/亲亲|亲吻|kiss|mwah|啵|mua/i.test(raw))return '[kissing softly] '+(cn?'啵。':'Mwah.');
  if(/轻笑|chuckle|giggle/i.test(raw))return '[chuckling] '+(cn?'呵，呵。':'Heh, heh.');
  if(/大笑|laugh/i.test(raw))return '[laughing] '+(cn?'哈哈。':'Ha, ha.');
  if(/叹气|sigh/i.test(raw))return '[sighing] '+(cn?'唉。':'Sigh.');
  if(/吸气|inhale|gasp/i.test(raw))return '[gasping] '+(cn?'嘶。':'Gasp.');
  if(/呼气|exhale/i.test(raw))return '[sighing] '+(cn?'呼。':'Phew.');
  if(/喘息|pant/i.test(raw))return '[panting] '+(cn?'呼，呼。':'Huff, puff.');
  if(/哭泣|crying|sobbing/i.test(raw))return '[sobbing] '+(cn?'呜。':'Oh...');
  return '';}
function ttsFishTags(rawCue,s,allowSound){const raw=String(rawCue||''),cue=ttsCueKind(raw),mix=(raw+' '+String(s||'')).toLowerCase(),tags=[];if(!raw)return '';
  if(tts2p8IsInterjectionCue(raw)){if(!allowSound)return '';if(/亲亲|亲吻|kiss|mwah|啵|mua/i.test(raw)){tags.push('kissing softly');}
    else if(/轻笑|chuckle|giggle/i.test(raw))tags.push('chuckling');else if(/大笑|laugh/i.test(raw))tags.push('laughing');else if(/叹气|sigh/i.test(raw))tags.push('sighing');else if(/吸气|inhale|gasp/i.test(raw))tags.push('gasping');else if(/呼气|exhale/i.test(raw))tags.push('sighing');else if(/喘息|pant/i.test(raw))tags.push('panting');else if(/哭泣|crying|sobbing/i.test(raw))tags.push('sobbing');
  }else if(cue==='tense'){if(/吃醋|jealous|envy/i.test(mix))tags.push('jealous');else if(/凶|愤怒|angry|furious|生气|mad/i.test(mix))tags.push('angry');else tags.push('frustrated');if(/质问|逼问|解释|为什么|凭什么|到底|tell me why|explain|truth|lie|lied/i.test(mix))tags.push('confident');if(/大声|提高音量|shout|loud/i.test(mix))tags.push('shouting');else if(/压低|低声|lower your voice|low voice/i.test(mix))tags.push('low restrained tone');
  }else if(cue==='soft'){tags.push(/心疼|担心|安慰|别哭|worried|comfort/i.test(mix)?'empathetic':'sad','soft tone');
  }else if(cue==='laugh'){tags.push(/兴奋|excited/i.test(mix)?'excited':'happy',/轻笑|chuckle|giggle/i.test(mix)?'chuckling':'playful');
  }else if(cue==='sleepy'){tags.push(/悄悄|耳语|whisper/i.test(mix)?'whispering':'soft tone');if(/打哈欠|yawn/i.test(mix))tags.push('yawning');
  }else if(cue==='warm'){tags.push('soft tone','affectionate');
  }else if(cue==='surprised')tags.push('surprised');else if(cue==='fearful')tags.push('scared');else if(cue==='disgusted')tags.push('disgusted');
  return Array.from(new Set(tags)).slice(0,3).map(x=>'['+x+']').join('');}
function ttsFishEmphasis(s,rawCue){if(ttsCueKind(rawCue)!=='tense')return s;return String(s||'').replace(/\b(why|explain|truth|lie|lied)\b/i,'[emphasis] $1').replace(/(为什么|解释|凭什么|到底)/,'[emphasis]$1');}
function ttsFishPerformance(s,rawCue,allowSound){s=String(s||'').trim();if(!s||!rawCue)return s;if(tts2p8IsInterjectionCue(rawCue)&&allowSound){const lead=ttsFishSoundLead(rawCue,s);if(lead)return lead+' '+ttsFishEmphasis(s,rawCue);}const tag=ttsFishTags(rawCue,s,allowSound);return tag?(tag+' '+ttsFishEmphasis(s,rawCue)):s;}
function ttsBracketPerformance(s,rawCue,kind,allowSound){s=String(s||'').trim();const raw=String(rawCue||''),cue=ttsCueKind(raw);if(!s||!raw)return s;if(kind==='fish')return ttsFishPerformance(s,raw,allowSound);let tag='';if(tts2p8IsInterjectionCue(raw)){if(!allowSound)return s;if(/亲亲|亲吻|kiss|mwah|啵|mua/i.test(raw))tag='[kisses softly]';else if(/轻笑|chuckle|giggle/i.test(raw))tag='[chuckles]';else if(/大笑|laugh/i.test(raw))tag='[laughs]';else if(/叹气|sigh/i.test(raw))tag='[sighs]';else if(/吸气|inhale/i.test(raw))tag='[inhales]';else if(/呼气|exhale/i.test(raw))tag='[exhales]';else if(/哭泣|crying/i.test(raw))tag='[crying]';}else{tag=cue==='tense'?'[angry, controlled]':cue==='soft'?'[sad, restrained]':cue==='laugh'?'[happy, playful]':cue==='sleepy'?'[whispers]':cue==='warm'?'[warm, intimate]':cue==='surprised'?'[surprised]':cue==='fearful'?'[fearful]':cue==='disgusted'?'[disgusted]':'';}return tag?(tag+' '+s):s;}
function ttsPerformanceText(text,o,tts,opt){/* 「细腻情绪与 3D 贴耳」开关打开且模型支持行内标签时，由 voice-expressive.js 生成；否则（含开关关闭）走下面原来的逻辑 */if(typeof NorthVoiceExpressive!=='undefined'){const vx=NorthVoiceExpressive.performance(text,o,tts,opt);if(vx!=null)return vx;}const base=ttsCleanBase(text);if(!base)return '';let s=ttsSentencePauseText(ttsSafeProsody(base,o),o),kind=ttsStyleKind(tts);if(ttsEnabled(tts)&&ttsRelayOn(tts)&&opt&&opt.cue&&opt.interjection!==false)s=ttsRelayInterjection(s,opt.cue);else if(kind==='minimax'&&opt&&opt.cue&&opt.interjection!==false)s=tts2p8Interjection(s,opt.cue);else if((kind==='eleven'||kind==='fish')&&opt&&opt.cue)s=ttsBracketPerformance(s,opt.cue,kind,opt.interjection!==false);if([...s].length>VOICE_MAX_CHARS&&[...base].length<=VOICE_MAX_CHARS)return base;return s;}
function ttsVoiceProfile(text,opt,tts,voice){const tune=voiceApiTuningOn(voice),p={speed:tune?voiceRate(voice):1,vol:1,pitch:tune?voiceApiPitch(voice):0};if(ttsStyleKind(tts)!=='minimax'||tts2p8IsInterjectionCue(opt&&opt.cue))return p;const cue=ttsCueKind(opt&&opt.cue)||ttsAutoCue(text,null);if(cue==='tense')p.emotion='angry';else if(cue==='soft')p.emotion='sad';else if(cue==='laugh')p.emotion='happy';else if(cue==='surprised')p.emotion='surprised';else if(cue==='fearful')p.emotion='fearful';else if(cue==='disgusted')p.emotion='disgusted';return p;}
// 通话朗读：外语角色只读外语原文。英/韩用"剔除所有中文字符"的硬办法，
// 不依赖模型有没有写对括号，所以中文翻译永远不会被读出来。
const CJK_RE=/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const CN_PUNCT_RE=/[（）()「」『』【】《》〈〉、，。．！？；：…—～·“”‘’]/g;
function normVoiceLang(lang){const s=String(lang||'').trim().toLowerCase();if(!s||s==='zh'||s==='cn'||s==='中文'||s==='chinese')return 'zh';if(s==='粤'||s==='粤语'||s==='粵'||s==='粵語'||s==='yue'||s==='yue-hk'||s==='zh-hk'||s==='cantonese')return '粤';if(s==='英'||s==='英语'||s==='英文'||s==='en'||s==='eng'||s==='english'||s.startsWith('en-'))return '英';if(s==='日'||s==='日语'||s==='日文'||s==='jp'||s==='ja'||s==='japanese'||s.startsWith('ja-'))return '日';if(s==='韩'||s==='韩语'||s==='韩文'||s==='kr'||s==='ko'||s==='korean'||s.startsWith('ko-'))return '韩';if(s==='法'||s==='法语'||s==='法文'||s==='fr'||s==='fra'||s==='french'||s.startsWith('fr-'))return '法';if(s==='德'||s==='德语'||s==='德文'||s==='de'||s==='deu'||s==='ger'||s==='german'||s.startsWith('de-'))return '德';if(s==='俄'||s==='俄语'||s==='俄文'||s==='ru'||s==='rus'||s==='russian'||s.startsWith('ru-'))return '俄';return lang||'zh';}
function ttsContentLang(c){const t=ttsCfg(c),role=(c&&c.voice&&c.voice.lang)||'zh';return normVoiceLang(ttsUseRelay(c)&&t.relayLang?t.relayLang:role);}
function ttsLanguageBoost(c){const lang=ttsContentLang(c);return {zh:'Chinese','粤':'Chinese,Yue','英':'English','日':'Japanese','韩':'Korean','法':'French','德':'German','俄':'Russian'}[lang]||'auto';}
function normVoiceAccent(o){const v=o&&o.voice?o.voice:(o||{}),a=String(v.accent||'auto').trim().toLowerCase();if(a==='en-gb'||a==='gb'||a==='uk'||a==='british'||a==='英式')return'en-GB';if(a==='en-us'||a==='us'||a==='american'||a==='美式')return'en-US';return'auto';}
function voiceEnglishPrompt(o){const v=o&&o.voice?o.voice:(o||{});if(normVoiceLang(v.lang)!=='英')return'';const a=normVoiceAccent(v);if(a==='en-GB')return'\n- 英语口音：使用自然地道的英式英语（British English）措辞、拼写和语气，例如 colour、favourite、holiday、flat；不要混用明显的美式说法，也不要刻意堆砌俚语。';if(a==='en-US')return'\n- 英语口音：使用自然地道的美式英语（American English）措辞、拼写和语气，例如 color、favorite、vacation、apartment；不要混用明显的英式说法，也不要刻意堆砌俚语。';return'';}
function applySystemVoice(u,v){if(!u||!v)return;const lang=normVoiceLang(v.lang),accent=normVoiceAccent(v),locale=lang==='粤'?'yue-HK':lang==='法'?'fr-FR':lang==='德'?'de-DE':lang==='俄'?'ru-RU':accent!=='auto'?accent:'';if(locale)u.lang=locale;let vs=v.voiceURI?_voices.find(x=>x.voiceURI===v.voiceURI):null;if(!vs&&lang==='粤')vs=_voices.find(x=>/^yue(?:-|$)/i.test(String(x.lang||'')))||_voices.find(x=>/^zh-hk$/i.test(String(x.lang||'')));if(!vs&&locale)vs=_voices.find(x=>String(x.lang||'').toLowerCase()===locale.toLowerCase())||_voices.find(x=>String(x.lang||'').toLowerCase().startsWith(locale.slice(0,2).toLowerCase()));if(vs)u.voice=vs;}
function hasForeign(text,lang){lang=normVoiceLang(lang);if(!lang||lang==='zh')return true;if(lang==='粤')return hasCN(text);const re=lang==='韩'?/[가-힣]/:lang==='日'?/[぀-ヿ]/:lang==='俄'?/[\u0400-\u04ff]/:/[A-Za-zÀ-ÖØ-öø-ÿĀ-žß]/;return re.test(text||'');}
function pickSpoken(text,lang){
  lang=normVoiceLang(lang);
  let t=(text||'').replace(/【[^】]*】/g,'').replace(/\[[^\]]*\]/g,'').replace(/[*_~`#>]/g,'').trim();
  if(!lang||lang==='zh'||lang==='粤')return t.replace(/[（(][^）)]*[）)]/g,'').trim();
  if(lang==='日'){const s=t.replace(/[（(][^）)]*[）)]/g,'').trim();return /[぀-ヿ]/.test(s)?s:'';}
  // 拉丁字母语言 / 韩 / 俄：把所有中文汉字和中文标点都抹掉，只留外语
  let s=t.replace(CJK_RE,' ').replace(CN_PUNCT_RE,' ').replace(/\s+/g,' ').trim();
  const ok=lang==='韩'?/[가-힣]/.test(s):lang==='俄'?/[\u0400-\u04ff]/.test(s):/[A-Za-zÀ-ÖØ-öø-ÿĀ-žß]/.test(s);
  return ok?s:'';}
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
function voiceBarWant(id){voiceBarStop();_voiceBarWant=id?voiceBarSel(id):'';}
function voiceBarStart(){if(!_voiceBarWant)return;_voiceBarOn=_voiceBarWant;_voiceBarWant='';try{document.querySelectorAll(_voiceBarOn).forEach(e=>e.classList.add('playing'));}catch(_){}clearTimeout(_voiceBarSafety);_voiceBarSafety=setTimeout(voiceBarStop,(VOICE_MAX_SECONDS+10)*1000);}
function voiceBarActive(id){return !!id&&_voiceBarOn===voiceBarSel(id);}
function playUrl(url){if(_curAudio&&_voiceBarOn){const want=_voiceBarWant;voiceBarStop();_voiceBarWant=want;}try{if(_curAudio){_curAudio.pause();}}catch(e){}_curAudio=new Audio(url);const active=_curAudio,vol=volMul();try{active.addEventListener('playing',()=>{if(_curAudio===active)voiceBarStart();});['ended','pause','error'].forEach(ev=>active.addEventListener(ev,()=>{if(_curAudio===active)voiceBarStop();}));}catch(_){}
  try{ensureAudio();if(_audio&&vol>1){const src=_audio.createMediaElementSource(_curAudio);const g=_audio.createGain();g.gain.value=vol;src.connect(g);g.connect(_audio.destination);}else{_curAudio.volume=Math.max(0,Math.min(1,vol));}}catch(e){try{_curAudio.volume=Math.max(0,Math.min(1,vol));}catch(_){}}
  try{const p=_curAudio.play();if(p&&typeof p.catch==='function')p.catch(async()=>{if(_curAudio!==active)return;try{const ab=await audioDataToBuf(url),buf=await decodeBuf(ab);if(buf)await playBuf(buf);}catch(_){}});}catch(_){} }
async function playBuf(buf){ensureAudio();if(!_audio||!buf)return false;try{if(_audio.state!=='running'){try{await _audio.resume();}catch(e){}}if(_audio.state!=='running')return false;stopBufSource('replaced-by-buffer');const s=_audio.createBufferSource();s.buffer=buf;const g=_audio.createGain();g.gain.value=volMul();s.connect(g);g.connect(_audio.destination);s.onended=()=>{if(_curSrc===s||!_curSrc)voiceBarStop();};s.start();_curSrc=s;voiceBarStart();return true;}catch(e){return false;}}
function voiceAudioKey(m){const x=m&&String(m.audio||'').match(/^idb-audio:(.+)$/i);return x?x[1]:'';}
function voiceAudioExpired(m){return !!(m&&m.role!=='user'&&m.type==='voice'&&m.audio&&Date.now()-Number(m.audioTs||m.time||0)>VOICE_AUDIO_TTL_MS);}
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
async function externalTtsRelay(tts,body,timeoutMs){const payload=Object.assign({provider:ttsProviderKind(tts),operation:'synthesize',base:String(tts&&tts.base||''),key:String(tts&&tts.key||''),model:String(tts&&tts.model||''),group:String(tts&&tts.group||'')},body||{});if(!payload.key)throw new Error('外置语音缺少 API Key');let r;try{r=await fetchT(EXTERNAL_TTS_RELAY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},timeoutMs||190000);}catch(e){throw new Error('外置语音转发连接失败：'+apiCaughtCN(e));}if(!r.ok){let detail='';try{const raw=await r.clone().text();try{const d=JSON.parse(raw);detail=String(d&&((d.error&&d.error.message)||d.error||d.message||d.code)||'');}catch(_){detail=String(raw||'');}}catch(_){}const e=new Error('外置语音平台 HTTP '+r.status+(detail?'：'+detail.slice(0,180):''));e.status=r.status;e.source='external-tts';throw e;}return r;}
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
async function speakMsg(m,o){const v=o?getVoice(o):null;
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
  const loading=voiceTtsPending(m),dur=Math.min(VOICE_MAX_SECONDS,m.dur||voiceEstimatedSeconds(m.content||'')),de=el.querySelector('.vdur');el.classList.toggle('loading',loading);el.classList.toggle('queued',!!m._playWhenReady);el.classList.toggle('playing',voiceBarActive(m.id));el.setAttribute('aria-busy',loading?'true':'false');el.style.minWidth=Math.min(60+dur*8,200)+'px';if(de)de.textContent=dur+'″';}
function warmVoiceMsg(m,o){
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
