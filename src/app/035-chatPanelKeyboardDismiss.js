let _voiceMode=false;let _panelPage='fn';let _chatFnPage=0;
function chatPanelKeyboardDismiss(){const ta=$('#cinput');if(ta&&document.activeElement===ta)ta.blur();}
function chatPanelSetPage(page){_panelPage=page==='emoji'?'emoji':'fn';const p=$('#panel');if(!p)return;p.dataset.page=_panelPage;p.querySelectorAll('.chat-panel-pane').forEach(x=>x.classList.remove('on'));const pane=p.querySelector(_panelPage==='emoji'?'.chat-emoji-pane':'.chat-function-pane');if(pane)pane.classList.add('on');if(_panelPage==='emoji')warmStickerImages(S.me.stickers||[]).catch(()=>{});else{const v=p.querySelector('.chat-function-viewport');if(v&&Math.round(v.scrollLeft/Math.max(1,v.clientWidth))!==_chatFnPage)v.scrollLeft=_chatFnPage*v.clientWidth;}}
function chatPanelOpen(page){chatPanelKeyboardDismiss();chatPanelSetPage(page);const p=$('#panel');if(p)p.classList.add('show');}
function chatPanelToggle(page){const p=$('#panel');if(!p)return;const next=page==='emoji'?'emoji':'fn';if(p.classList.contains('show')&&p.dataset.page===next){p.classList.remove('show');return;}chatPanelOpen(next);}
function chatFunctionPanelScroll(el){if(!el||el._pageRaf)return;el._pageRaf=requestAnimationFrame(()=>{el._pageRaf=0;_chatFnPage=Math.max(0,Math.min(1,Math.round(el.scrollLeft/Math.max(1,el.clientWidth))));const p=el.closest('.chat-tools-panel');if(p)p.querySelectorAll('.chat-panel-dot').forEach((x,i)=>x.classList.toggle('on',i===_chatFnPage));});}
function chatVoiceToggle(){_voiceMode=!_voiceMode;const ta=$('#cinput'),bar=ta&&ta.closest('.chat-inputbar'),send=bar&&bar.querySelector('.chat-send');if(bar)bar.classList.toggle('voice-on',_voiceMode);if(ta)ta.placeholder=_voiceMode?'输入文字，发送为语音条…':'发消息…';if(send)send.textContent=_voiceMode?'发语音':'发送';if(ta)chatComposerStateSync(ta);}
function sendText(id){if(wxLoginActive()){toast('微信被ta登录中，你暂时不能操作');return;}const c=getC(id);if(c.blocked){toast('已拉黑，先解除吧');return;}
  if(c._cbTries)c._cbTries=0;// 她主动发消息=重新搭理ta，回拨追逐结束、计数清零
  const ta=$('#cinput');const t=ta.value.trim();if(!t)return;ta.value='';ta.style.height='auto';chatComposerStateSync(ta);
  const q=(S.settings.quoteOn!==false&&_quoting&&_quoting.id===id)?{text:_quoting.text,who:_quoting.who}:null;_quoting=null;quoteComposerRefresh(id);
  if(_voiceMode)pushMsg(id,{role:'user',type:'voice',content:t,dur:Math.max(1,Math.round(t.length/3)),id:uid(),quote:q});
  else pushMsg(id,{role:'user',type:'text',content:t,quote:q});
//@@ private
  wechatContinueUserText(id,t);}
function wechatContinueUserText(id,t,opt){const c=getC(id);
//@@ end
  if(typeof window.weddingHandleInviteRequest==='function'&&window.weddingHandleInviteRequest(c,t))return;
  maybeFollowup(id,t);// 检测ta提到的将来要做的事，之后主动来关心
//@@ web
  const remarkDiscovery=hisRemarkDiscoveryNote(c);if(remarkDiscovery)scheduleReply(id,remarkDiscovery);else if(!companionGoodMorningSchedule(c,t)&&!companionEmotionCareSchedule(c,t))scheduleReply(id);}
//@@ private
  const remarkDiscovery=hisRemarkDiscoveryNote(c);if(remarkDiscovery)scheduleReply(id,remarkDiscovery);else if(!companionGoodMorningSchedule(c,t)&&!companionEmotionCareSchedule(c,t)){if(opt&&opt.robotVoice&&manualReplySceneOn('wechat'))manualReply(id);else scheduleReply(id);}}
//@@ end
/* ===== 聊天引用 ===== */
let _quoting=null,_lpT=null,_lpFired=false;
function quoteTextOf(m){return (m&&(m.type==='text'||m.type==='voice'))?(m.content||'').trim():'';}
function quoteComposerHTML(cid,c){c=c||getC(cid);if(!c||S.settings.quoteOn===false||!_quoting||_quoting.id!==cid)return'';const quoteName=_quoting.who==='me'?(S.me.name||'我'):(c.remark||c.name||'TA');return `<div class="chat-quote-pending" id="chatQuotePending" role="status"><span class="chat-quote-pending-text"><b>${esc(quoteName)}：</b>${esc(_quoting.text||'')}</span><button type="button" class="chat-quote-cancel" aria-label="取消引用" onpointerdown="event.stopPropagation()" onclick="quoteClear(event)"><span aria-hidden="true">×</span></button></div>`;}
function quoteComposerRefresh(cid){if(cur().p!=='chat'||cur().id!==cid)return;const old=$('#chatQuotePending'),bar=document.querySelector('#app>.page>.chat-inputbar')||$('.chat-inputbar'),html=quoteComposerHTML(cid);if(old){if(html)old.outerHTML=html;else old.remove();}else if(html&&bar)bar.insertAdjacentHTML('beforebegin',html);}
function quoteSet(cid,mid){if(S.settings.quoteOn===false)return;const m=msgs(cid).find(x=>x.id===mid);const txt=quoteTextOf(m);if(!txt){toast('这条没法引用');return;}_quoting={id:cid,text:txt,who:m.role==='user'?'me':'ta'};if(typeof closeModal==='function')closeModal();quoteComposerRefresh(cid);}
function quoteClear(ev){if(ev){if(ev.preventDefault)ev.preventDefault();if(ev.stopPropagation)ev.stopPropagation();}const cid=_quoting&&_quoting.id;_quoting=null;if(cid)quoteComposerRefresh(cid);}
//@@ web
function _matchMyLine(id,frag){if(!frag)return null;const f=_gnorm(frag);if(!f)return null;const ms=msgs(id).filter(m=>m.role==='user'&&(m.type==='text'||m.type==='voice')&&m.content).slice(-12);
//@@ private
function _matchMyLine(id,frag){if(!frag)return frag;const f=_gnorm(frag);if(!f)return frag;const ms=msgs(id).filter(m=>m.role==='user'&&(m.type==='text'||m.type==='voice')&&m.content).slice(-12);
//@@ end
  let best=null,bestScore=0;
  ms.forEach(m=>{const b=_gnorm(m.content);if(!b)return;let sc;if(b===f)sc=100;else if(b.indexOf(f)>=0||f.indexOf(b)>=0)sc=80;else{const sa=new Set(f.split('')),sb=new Set(b.split(''));let inter=0;sa.forEach(ch=>{if(sb.has(ch))inter++;});const mn=Math.min(sa.size,sb.size)||1;sc=inter/mn*60;}if(sc>bestScore){bestScore=sc;best=m.content;}});
//@@ web
  return (best&&bestScore>=30)?best.trim():null;}
//@@ private
  return (best&&bestScore>=30)?best.trim():frag;}
//@@ end
function qPressStart(cid,mid){_lpFired=false;clearTimeout(_lpT);_lpT=setTimeout(()=>{_lpFired=false;msgMenu(cid,mid);_lpFired=true;},480);}
function qPressEnd(){clearTimeout(_lpT);}
function quoteBar(c,m){if(!m||!m.quote||!m.quote.text)return '';const who=m.quote.who==='me'?(S.me.name||'我'):(c.remark||c.name||'TA'),t=m.quote.text||'';
  return `<div class="chat-quote-sent"><b>${esc(who)}：</b><span>${esc(t)}</span></div>`;}

/* 功能面板发送 */
function readAsDataURL(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});}
async function visionPhotoSource(f,max,q){let src='';try{src=await compress(f,max,q);}catch(_){}if(!/^data:image\/(?:jpeg|png|webp);base64,/i.test(src||''))throw new Error('这张图片的格式暂不兼容识图，请先保存成 JPG 或 PNG');return src;}
const _visionTasks=new Map();
function pendingVisionMessages(id){return lastRounds(msgs(id),Math.max(3,+S.settings.hist||12)).filter(m=>m&&m.role==='user'&&m.type==='image'&&m.visionState==='pending');}
function hasPendingVision(id){return pendingVisionMessages(id).length>0;}
async function awaitPendingVision(id,timeout){const pending=pendingVisionMessages(id),jobs=pending.map(m=>_visionTasks.get(m.id)).filter(Boolean);if(!pending.length)return true;if(!jobs.length)return false;
  let timed=false;await Promise.race([Promise.allSettled(jobs),new Promise(r=>setTimeout(()=>{timed=true;r();},timeout||150000))]);return !timed&&!hasPendingVision(id);}
function visionStatusRefresh(id){if(cur().p==='chat'&&cur().id===id)render();}
function runVisionForMessage(id,m,sourceFactory,prompt){m.visionState='pending';m.visionError='';delete m.visionModel;delete m.visionProtocol;save();visionStatusRefresh(id);
  const task=(async()=>{try{let source=await sourceFactory(),d=await visionAPI(source,prompt);m.desc=d;m.visionState='success';m.visionModel=(_visionLast&&_visionLast.model)||'';m.visionProtocol=(_visionLast&&_visionLast.protocol)||'';m.visionFallback=!!(_visionLast&&_visionLast.fallback);return true;}
    catch(e){m.visionState='failed';m.visionError=visionPlainError(e);return false;}
    finally{save(0);visionStatusRefresh(id);}})();
  _visionTasks.set(m.id,task);task.finally(()=>{if(_visionTasks.get(m.id)===task)_visionTasks.delete(m.id);});return task;}
function visionDataURLSource(src,max,q){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{try{let w=im.naturalWidth||im.width,h=im.naturalHeight||im.height;if(Math.max(w,h)>max){const z=max/Math.max(w,h);w=Math.max(1,Math.round(w*z));h=Math.max(1,Math.round(h*z));}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);res(c.toDataURL('image/jpeg',q));}catch(e){rej(e);}};im.onerror=()=>rej(new Error('图片读取失败'));im.src=src;});}
async function retryVisionMessage(id,mid){const m=msgs(id).find(x=>x.id===mid&&x.type==='image');if(!m||!m.src||m.visionState==='pending')return;const ok=await runVisionForMessage(id,m,()=>visionDataURLSource(m.src,1200,.74),'请仔细、客观地用中文描述这张图片。读出关键文字并说明主体、动作、场景和最明显的细节，用2到3句自然白话说清楚。');if(m._deleted)return;if(ok){suspicionFulfillRequest(getC(id),m);toast('图片已经看清了');scheduleReply(id);}else toast('识图仍失败：'+(m.visionError||'检查识图线路'));}
function cPhoto(id){$('#panel').classList.remove('show');pickFile('image/*',async f=>{
  let src;try{src=await compress(f,1400,.78);}catch(e){src=null;}
  if(!src){try{src=await readAsDataURL(f);}catch(e){toast('图片读取失败，再试一次');return;}}
  const m={role:'user',type:'image',src,desc:'',visionState:'pending',id:uid()};pushMsg(id,m);
  const _vp='请仔细、客观地用中文描述这张图片。有人物时说清人数、年龄段、表情、发型穿着、动作和场景；是聊天截图、表情包或梗图时，读出关键文字并说明表达的意思；是物品、风景、动物或食物时，说清主体、颜色、细节和氛围。用2到3句自然白话描述，让没看过图的人也能理解，不要评价或攻击人物。';
  const okv=await runVisionForMessage(id,m,async()=>{let v=await visionPhotoSource(f,1280,.76);if(v.length>1400000)v=await visionPhotoSource(f,1000,.7);return v;},_vp);
  if(m._deleted)return;
  if(okv){suspicionFulfillRequest(getC(id),m);if(m.visionFallback)toast('聊天模型没能看图，已按顺序由备用 '+m.visionModel+' 接管；没有并发重复识别');scheduleReply(id);}
  else toast('图片理解失败：'+(m.visionError||'请检查图片理解线路').slice(0,90)+'（检查设置后可重新发送）');});}
function cPhotoText(id){
  $('#panel').classList.remove('show');
  openModal(`<h3>发送图文照片</h3><div class="hint">用文字描述这张照片里能看到的画面。发送后会显示为白色照片卡片，角色会把它当作图片理解，但不会补造描述之外的细节。</div><div class="field"><label>照片描述</label><textarea id="photo_text_desc" maxlength="500" rows="5" placeholder="例如：窗边的木桌上放着一杯热咖啡，旁边有一本翻开的书，午后的阳光照进来。"></textarea></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="sendPhotoTextCard('${id}')">发送照片</button></div>`);
  setTimeout(()=>{const el=$('#photo_text_desc');if(el)el.focus();},80);
}
function sendPhotoTextCard(id){
  const el=$('#photo_text_desc'),desc=String(el&&el.value||'').replace(/\s+/g,' ').trim().slice(0,500);
  if(!desc){toast('先写下照片里能看到的画面');return;}
  closeModal();
  const m={role:'user',type:'image',src:'',textCard:true,desc,visionState:'success',id:uid(),time:Date.now()};
  pushMsg(id,m);suspicionFulfillRequest(getC(id),m);scheduleReply(id);
}
/* ===== 聊天文件：她发的角色真的读得到，角色写的她真的点得开 =====
   以前发文件只记了个文件名和大小，内容当场丢掉，角色只看得到「她发了 xx.txt」。
   现在把正文读出来存进这条消息：给角色的上下文里带正文，她点卡片能看全文。 */
const CHAT_FILE_TEXT_EXT=['txt','md','markdown','text','json','csv','tsv','log','srt','vtt','ass','xml','html','htm','rtf','yml','yaml','ini','conf','cfg','toml','js','mjs','cjs','ts','tsx','jsx','py','java','c','cpp','cc','h','hpp','cs','go','rs','rb','php','swift','kt','sql','sh','bat','lrc','tex','env'];
const CHAT_FILE_MAX=20000;/* 存进消息的上限，够一篇长文，又不至于把存档撑爆 */
const CHAT_FILE_CTX=4000;/* 每轮塞给模型的上限，再长就截断并说明 */
function chatFileExt(name){return typeof aiMemoryFileExt==='function'?aiMemoryFileExt(name):String(name||'').toLowerCase().split('.').pop();}
function chatFileReadable(name){const e=chatFileExt(name);return e==='docx'||CHAT_FILE_TEXT_EXT.includes(e);}
async function chatFileText(file){const ext=chatFileExt(file&&file.name);
  if(!chatFileReadable(file&&file.name))return{text:'',format:(ext||'').toUpperCase(),reason:'这种格式小手机读不出文字（只认 txt、md、json、csv、代码和 Word .docx）'};
  const r=await aiMemoryReadFile(file),whole=aiMemoryCleanText((r&&r.parts||[]).join('\n\n'));
  if(!whole)return{text:'',format:(r&&r.format)||ext.toUpperCase(),reason:'文件能打开，但里面一个字也没读到'};
  return{text:whole.slice(0,CHAT_FILE_MAX),format:(r&&r.format)||ext.toUpperCase(),truncated:whole.length>CHAT_FILE_MAX};}
/* 给模型看的那一段。读不出来就老实说读不出来，别假装读过了。 */
function chatFileContextBody(m){const t=String(m&&m.text||'').trim();
  if(!t)return m&&m.unreadable?('，但'+String(m.unreadable)+'，你只知道有这么个文件，不要编造里面的内容'):'，这个文件只有名字、没有正文，别假装看过里面写了什么';
  const body=t.length>CHAT_FILE_CTX?t.slice(0,CHAT_FILE_CTX)+'\n……（太长了，后面没给你）':t;
  return '，文件正文如下：\n'+body+'\n（以上是这个文件的真实内容，你已经读过了，可以直接就里面的话回应）';}
function cDoc(id){$('#panel').classList.remove('show');pickFile('',f=>{
  const m={role:'user',type:'file',name:f.name,size:fmtSize(f.size),id:uid(),reading:true};
  pushMsg(id,m);
  chatFileText(f).then(r=>{m.text=r.text||'';m.format=r.format||'';m.truncated=!!r.truncated;if(!m.text)m.unreadable=r.reason||'文件里没读到文字';})
    .catch(e=>{m.text='';m.unreadable=(e&&e.message)||'这个文件读不出来';})
    .then(()=>{m.reading=false;save();refreshChatMessages(id);scheduleReply(id);});});}
function chatFileSize(text){const n=(new TextEncoder().encode(String(text||''))).length;return fmtSize(n);}
function chatFileFind(cid,mid){return (msgs(cid)||[]).find(x=>x&&x.id===mid)||null;}
function chatFileOpen(cid,mid){const m=chatFileFind(cid,mid);if(!m||m.type!=='file')return;
  if(m.reading)return toast('还在读这个文件…');
  const body=String(m.text||'').trim();
  if(!body)return toast(m.unreadable||'这个文件没有可以看的正文');
  openModal(`<h3 class="cfile-title">${esc(m.name||'文件')}</h3>
    <div class="hint">${esc((m.format||'')+(m.format?' · ':'')+(m.size||chatFileSize(body)))}${m.truncated?' · 太长了，只存了前面一段':''}</div>
    <div class="cfile-read">${esc(body)}</div>
    <div class="btns"><button class="btn g" onclick="chatFileCopy('${cid}','${mid}')">复制全文</button><button class="btn g" onclick="chatFileSave('${cid}','${mid}')">保存到手机</button><button class="btn p" onclick="closeModal()">看完了</button></div>`);}
function chatFileCopy(cid,mid){const m=chatFileFind(cid,mid);if(!m)return;copyTextCompat(String(m.text||''));toast('全文已复制');}
function chatFileSave(cid,mid){const m=chatFileFind(cid,mid);if(!m)return;
  downloadBlob(new Blob([String(m.text||'')],{type:'text/plain;charset=utf-8'}),m.name||'文件.txt');toast('已保存');}
/* 角色写文件：多行指令，写完用 [/文件] 收尾。先整段抠出来，再交给按行走的解析器，
   否则正文里的换行会被当成好几条消息发出去。 */
const ROLE_FILE_BLOCK=/[\[【]\s*文件\s*[|｜]\s*([^\]】\n]{1,60})[\]】][ \t]*\n([\s\S]*?)\n?[\[【]\s*\/\s*文件\s*[\]】]/g;
/* 角色照抄了“我给你发了文件「x」，文件正文如下：”这句上下文，或正文写完漏了 [/文件]：都按文件收下，不拆成一行行气泡。 */
const ROLE_FILE_ECHO=/[\[【]\s*我(?:给你)?发了(?:个|一个)?文件「([^」\n]{1,60})」[，,]?\s*文件正文如下[：:][ \t]*\n([\s\S]*?)(?:\n?（以上是这个文件的真实内容[^）\n]*）)?[ \t]*(?:[\]】][ \t]*(?=\n|$)|$(?![\s\S]))/g;
const ROLE_FILE_OPEN=/(^|\n)[ \t]*[\[【]\s*文件\s*[|｜]\s*([^\]】|｜\n]{1,60}\.[A-Za-z0-9]{1,8})\s*[\]】][ \t]*\n([\s\S]+)$/;
function roleFileExtract(content){const files=[];
  const take=(name,body)=>{const clean=String(body||'').replace(/\r\n?/g,'\n').replace(/^\n+|\n+$/g,'');
    if(!clean.trim())return '';
    files.push({name:String(name||'').trim().slice(0,60)||'文件.txt',text:clean.slice(0,CHAT_FILE_MAX)});
    return '\n[文件@'+(files.length-1)+']\n';};
  let text=String(content==null?'':content).replace(ROLE_FILE_BLOCK,(_,name,body)=>take(name,body)).replace(ROLE_FILE_ECHO,(_,name,body)=>take(name,body));
  if(!/[\[【]\s*\/\s*文件\s*[\]】]/.test(text))text=text.replace(ROLE_FILE_OPEN,(all,lead,name,body)=>String(body||'').trim().length>=120?lead+take(name,body):all);
  return{text,files};}
/* 角色自己发过的文件，回给模型时仍用它自己的写法；不然它会把“我给你发了文件…”当成发文件的格式照抄。 */
function roleFileHistoryText(m){const t=String(m&&m.text||'').trim(),name=String(m&&m.name||'文件.txt');
  if(!t)return '[文件|'+name+']';
  return '[文件|'+name+']\n'+(t.length>CHAT_FILE_CTX?t.slice(0,CHAT_FILE_CTX)+'\n……':t)+'\n[/文件]';}
function roleFileMessage(f){if(!f)return null;
  return{role:'assistant',type:'file',name:f.name,size:chatFileSize(f.text),text:f.text,format:(chatFileExt(f.name)||'TXT').toUpperCase(),id:uid(),time:Date.now()};}
function cTransfer(id){paySendOpen('transfer','role',id);}
function cTransferModal(id){$('#panel').classList.remove('show');openModal(`<h3>转账</h3>
  <div class="field"><label>金额</label><input id="tf_a" type="number" step="0.01" placeholder="5.20"></div>
  <div class="field"><label>说明</label><input id="tf_n" placeholder="给你买糖吃"></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="doTransfer('${id}')">转账</button></div>`);}
function doTransfer(id){const a=+$('#tf_a').value;if(!a){toast('填金额呀');return;}if(a>S.me.balance){toast('余额不够啦（去钱包看看）');return;}closeModal();
  addBill('out',a,'转账给'+(getC(id).remark||getC(id).name));
  adjMood(id,6);pushMsg(id,{role:'user',type:'transfer',amount:a,note:$('#tf_n').value.trim(),received:false,id:uid()});scheduleReply(id);}
function cRed(id){paySendOpen('red','role',id);}
function cRedModal(id){$('#panel').classList.remove('show');openModal(`<h3>红包</h3>
  <div class="field"><label>金额</label><input id="rd_a" type="number" step="0.01" placeholder="6.66"></div>
  <div class="field"><label>祝福语</label><input id="rd_n" placeholder="给你给你都给你"></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="doRed('${id}')">塞钱</button></div>`);}
function doRed(id){const a=+$('#rd_a').value;if(!a){toast('填金额呀');return;}if(a>S.me.balance){toast('余额不够啦（去钱包看看）');return;}closeModal();
  addBill('out',a,'发红包给'+(getC(id).remark||getC(id).name));
  pushMsg(id,{role:'user',type:'redpacket',amount:a,note:$('#rd_n').value.trim(),received:false,id:uid()});scheduleReply(id);}
function cSpyGrant(id){const c=getC(id);$('#panel').classList.remove('show');getSpy(c).granted=true;save();
  pushMsg(id,{role:'user',type:'spycard',id:uid()});toast('已授权 '+(c.remark||c.name)+' 查看你的手机');scheduleReply(id);}
function cDice(id){$('#panel').classList.remove('show');pushMsg(id,{role:'user',type:'dice',value:1+Math.floor(Math.random()*6),id:uid()});scheduleReply(id);}
/* ===== 名片 / 亲属卡 ===== */
function cNamecard(id){$('#panel').classList.remove('show');const cs=S.contacts.filter(c=>!c.deleted&&c.id!==id);
  if(!cs.length){toast('你还没有别的好友可以推荐');return;}
  openModal(`<h3>推荐好友名片</h3><div class="hint">把你的一个好友推给ta，像真实微信那样发名片。</div>
   ${cs.map(c=>`<div class="section"><div class="it" onclick="sendNamecard('${id}','${c.id}')">${av(c.avatar,'sm')}<div class="meta" style="flex:1"><div class="n">${esc(c.remark||c.name)}</div><div class="s">微信号：${esc(c.wxid||'')}</div></div><span class="v">推荐 ›</span></div></div>`).join('')}
   <button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function sendNamecard(id,fid){const f=getC(fid);if(!f)return;closeModal();const c=getC(id);
  c._gotFromMe=c._gotFromMe||[];if(c._gotFromMe.indexOf(f.remark||f.name)<0)c._gotFromMe.push(f.remark||f.name);
  spyKnowledgeSet(c,'role:'+f.id,{name:f.remark||f.name,kind:'role',relation:'你经'+S.me.name+'介绍认识的微信联系人',status:'current',lastSeenAt:Date.now(),source:'好友名片'});
  pushMsg(id,{role:'user',type:'namecard',dir:'mine',cname:f.remark||f.name,wxid:f.wxid,avatar:f.avatar,persona:(f.signature||f.relation||'我的好友'),refId:fid,id:uid()});
  toast('已把 '+(f.remark||f.name)+' 的名片推给ta');scheduleReply(id);}
function addHisCard(mid){let m,owner;for(const k in S.messages){const x=S.messages[k].find(y=>y.id===mid);if(x){m=x;owner=k;break;}}if(!m||m.added||m.declined)return;
  const oc=getC((owner||'').split('#')[0]);
  const rp=m.personId&&relPerson(m.personId),rv=rp&&oc&&relLinkOf(oc.id,rp.id),rvv=rv&&relView(rv,rp.id);
  const nc={id:cid(),name:m.cname,avatar:rp&&rp.avatar||'🙂',remark:'',wxid:m.wxid||genWxid(),signature:'',persona:rp?[rp.persona,rp.identity?'身份：'+rp.identity:'',rp.age?'年龄：'+rp.age+'岁':''].filter(Boolean).join('；'):(m.persona||'')+(oc?('（'+(oc.remark||oc.name)+'推荐认识的朋友）'):''),gender:rp&&(rp.gender==='女'||rp.gender==='男')?rp.gender:undefined,age:rp&&rp.age||undefined,greeting:'',relation:'',pinned:false,blocked:false,proactive:{enabled:false,start:9,end:23,times:2},chatBg:'',createdAt:Date.now(),family:{bound:false,quota:0,used:0,month:''},_blk:{},_added:isMain()?undefined:{[actId()]:true}};
  S.contacts.push(nc);m.added=true;m.newId=nc.id;if(rp&&!rp.cid)relPromote(rp.id,nc.id,oc&&oc.id);
  if(oc){oc._pushedToMe=oc._pushedToMe||[];if(oc._pushedToMe.indexOf(m.cname)<0)oc._pushedToMe.push(m.cname);}
  msgs(nc.id).push({role:'user',type:'sys',content:'✅ 你添加了 '+m.cname+' 为好友'+(oc?'（'+(oc.remark||oc.name)+'推荐的）':'')+'，开始聊天吧',time:Date.now(),id:uid()});
  save();render();toast('已添加 '+m.cname+' 到通讯录✅');
  scheduleReply(nc.id,'[系统：'+S.me.name+'通过'+(oc?(oc.remark||oc.name)+'的推荐':'名片')+'把你加为好友。你是「'+m.cname+'」'+(rvv?'，是'+(oc.remark||oc.name)+'的'+(rvv.iAmTheir||'熟人')+'（'+(oc.remark||oc.name)+'是你的'+(rvv.otherIsMy||'熟人')+'），是'+(oc.remark||oc.name)+'把你的名片推给'+S.me.name+'的':(m.persona?'（'+m.persona+'）':''))+'，按这个身份性格，主动跟ta打个招呼、自我介绍一下。]');}
/* 点开名片：跟真实微信一样的独立资料页，在这里添加到通讯录 */
function hisCardFind(mid){for(const k in S.messages){const x=(S.messages[k]||[]).find(y=>y&&y.id===mid);if(x)return {m:x,owner:getC(String(k).split('#')[0])};}return {};}
function renderHisCard(c){const {m,owner}=hisCardFind(c.mid);if(!m)return `<div class="hcard-page"><div class="hcard-nav"><button type="button" onclick="back()" aria-label="返回">‹</button></div><div class="hcard-empty">名片已失效</div></div>`;
  const his=m.dir==='his',rp=m.personId&&relPerson(m.personId),added=his?(m.added&&m.newId&&getC(m.newId)):(m.refId&&getC(m.refId)),g=rp&&rp.gender||(added&&added.gender),from=owner?(owner.remark||owner.name):'';
  const sex=g==='女'||g==='男'?`<i class="hcard-sex ${g==='女'?'f':'m'}" aria-label="${g}"><svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="7.2" r="4.6"/><path d="M3.6 22c0-5.1 3.8-8.6 8.4-8.6s8.4 3.5 8.4 8.6z"/>${g==='女'?'<path d="M9.2 15.6l2.8 1.6 2.8-1.6v3.2l-2.8-1.6-2.8 1.6z" fill="#fff"/>':''}</svg></i>`:'';
  const btn=added?`<button type="button" class="hcard-btn" onclick="go('chat',{id:'${added.id}'})">发消息</button>`:his?(m.declined?`<div class="hcard-btn off">你没有添加</div>`:`<button type="button" class="hcard-btn" onclick="addHisCard('${m.id}')">添加到通讯录</button>`):`<div class="hcard-btn off">${m._accepted?'对方已添加':'等对方添加'}</div>`;
  return `<div class="hcard-page"><div class="hcard-nav"><button type="button" onclick="back()" aria-label="返回">‹</button>${his&&!added&&!m.declined?`<button type="button" class="hcard-more" onclick="hisCardMore('${m.id}')" aria-label="更多">···</button>`:''}</div>
    <div class="hcard-head">${av(m.avatar||(added&&added.avatar)||'🙂','')}<div><b>${esc(m.cname)}${sex}</b>${m.wxid?`<small>微信号：${esc(m.wxid)}</small>`:''}</div></div>
    <div class="hcard-sec">${m.persona?`<div class="hcard-row"><span>个性签名</span><em>${esc(m.persona)}</em></div>`:''}<div class="hcard-row"><span>来源</span><em>${his?'来自'+esc(from||'好友')+'分享的名片':'你分享给'+esc(from||'好友')+'的名片'}</em></div></div>
    <div class="hcard-sec">${btn}</div></div>`;}
async function hisCardMore(mid){if(await uiConfirm('不添加这个人？推荐的人会知道你没加。',{yes:'不添加',no:'再想想'})){declineHisCard(mid);render();}}
function declineHisCard(mid){let m,owner;for(const k in S.messages){const x=S.messages[k].find(y=>y.id===mid);if(x){m=x;owner=k;break;}}if(!m||m.added||m.declined)return;
  m.declined=true;save();if(cur().p==='chat')render();toast('已拒绝，没有加进通讯录');
  const oc=getC((owner||'').split('#')[0]);
  if(oc&&!oc.blocked)scheduleReply(oc.id,'[系统：你把好友「'+m.cname+'」的名片推荐给'+S.me.name+'，但ta没有添加、婉拒了。你察觉到了，按你人设自然反应一句（可以问问为什么不加、或无所谓、或吃醋ta是不是不想认识你朋友，符合心情）。]');}
function cFamily(id){const c=getC(id);$('#panel').classList.remove('show');const f=c.family||{};
  (typeof familyRoleModal==='function'?familyRoleModal:openModal)(`<h3>亲属卡</h3><button class="btn p" style="width:100%;margin-bottom:14px" onclick="familyRoleSendOpen('${id}')">赠送我的亲属卡给对方</button>
   ${f.bound?`<div class="hint">已绑定 ${esc(c.remark||c.name)} 的亲属卡：每月额度 ¥${(+f.quota).toFixed(0)}，本月已用 ¥${(+f.used).toFixed(0)}。在购物/外卖里可以选「用ta的亲属卡付」。</div>
     <button class="btn d" onclick="unbindFamily('${id}')">解除绑定</button>`
   :`<div class="hint">向 ${esc(c.remark||c.name)} 申请一张亲属卡，ta同意后会给你设每月额度，之后你用这张卡买东西，ta会立刻知道。</div>
     <button class="btn p" onclick="reqFamily('${id}')">向ta申请亲属卡</button>`}
   <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function reqFamily(id){closeModal();pushMsg(id,{role:'user',type:'familyreq',id:uid()});
  scheduleReply(id,'[系统：'+S.me.name+'向你申请绑定亲属卡。你若愿意就用一行 [亲属卡|每月额度数字] 给ta开通（额度你定，比如 [亲属卡|800]）；不愿意就正常拒绝/调侃。]');}
function acceptFamily(mid){let m,owner;for(const k in S.messages){const x=S.messages[k].find(y=>y.id===mid);if(x){m=x;owner=k;break;}}if(!m||m.bound)return;
  const c=getC(owner);m.bound=true;c.family={bound:true,quota:+m.quota||0,used:0,month:curMonth()};
  msgs(owner).push({role:'user',type:'sys',content:'你绑定了'+(c.remark||c.name)+'的亲属卡（每月¥'+(+m.quota).toFixed(0)+'）',time:Date.now(),id:uid()});
  save();render();toast('已绑定亲属卡💳');scheduleReply(owner,'[系统：'+S.me.name+'接受并绑定了你的亲属卡。回一句（叮嘱/宠溺/定规矩都行，符合人设）。]');}
function declineFamily(mid){let m,owner;for(const k in S.messages){const x=S.messages[k].find(y=>y.id===mid);if(x){m=x;owner=k;break;}}if(!m)return;m.declined=true;save();render();}
function unbindFamily(id){const c=getC(id);c.family={bound:false,quota:0,used:0,month:''};save();closeModal();toast('已解除亲属卡绑定');}
function familyContacts(){return S.contacts.filter(c=>!c.deleted&&c.family&&c.family.bound);}
function familyPayFlow(items){if(S.couple&&S.couple.cardFrozen){toast('ta冻结了你的亲属卡，去求他解冻才能用');return;}const list=familyContacts();if(!list.length){toast('还没绑定谁的亲属卡（在聊天➕里申请）');return;}
  window._fpItems=items;
  if(list.length===1)return doBuyFamily(list[0].id);
  openModal(`<h3>用谁的亲属卡付？</h3>${list.map(c=>`<div class="section"><div class="it" onclick="closeModal();doBuyFamily('${c.id}')">${esc(c.remark||c.name)}<span class="v">余额度 ¥${Math.max(0,(+c.family.quota)-(+c.family.used)).toFixed(0)} ›</span></div></div>`).join('')}<button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function doBuyFamily(id){const c=getC(id);const items=window._fpItems||[];if(!items.length)return;const f=c.family;
  if(f.month!==curMonth()){f.month=curMonth();f.used=0;}
  const total=items.reduce((s,p)=>s+(+p.price),0);const left=(+f.quota)-(+f.used);
  if(total>left){toast('亲属卡本月额度不够了（剩¥'+left.toFixed(0)+'）');return;}
  f.used=+(f.used+total).toFixed(2);
  const names=items.map(p=>p.name).join('、');
  S.shop.cart=(S.shop.cart||[]).filter(x=>!items.includes(x));
  S.food.cart=(S.food.cart||[]).filter(x=>!items.includes(x));
  msgs(id).push({role:'user',type:'familybuy',name:names,price:total,used:f.used,quota:f.quota,time:Date.now(),id:uid()});
  save();closeModal();render();toast('已用亲属卡支付 ¥'+total.toFixed(2));coFinalize(items,id);
  scheduleReply(id,'[系统：'+S.me.name+'刚用你给的亲属卡买了「'+names+'」，花了¥'+total.toFixed(2)+'，本月这张卡已用¥'+f.used.toFixed(2)+'/'+(+f.quota).toFixed(0)+'。你立刻收到消费提醒，主动发消息（心疼/宠溺/调侃/管教/问买来干嘛，符合人设），别装不知道。]');}
function cLoc(id){$('#panel').classList.remove('show');openModal(`<h3>位置</h3>
  <div class="field"><label>地点</label><input id="lc_n" placeholder="星巴克"></div>
  <div class="field"><label>地址</label><input id="lc_a" placeholder="苏州市…"></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="doLoc('${id}')">发送</button></div>`);}
function doLoc(id){const n=$('#lc_n').value.trim();if(!n){toast('填地点呀');return;}closeModal();
  const a=$('#lc_a').value.trim(),base=meLiveLoc(),city=liveLocCity(n+' '+a,base.city),p=liveLocJitter(city,'me-send|'+n+'|'+a,8);
  pushMsg(id,{role:'user',type:'location',name:n,address:a||liveLocAddr(city,'me-send'),loc:Object.assign(base,p,{name:n,address:a||liveLocAddr(city,'me-send'),city:city.n,country:city.country}),id:uid()});scheduleReply(id);}

/* 拆分多条气泡 */
function splitBubbles(text){return (text||'').split('\n').map(s=>s.trim()).filter(Boolean);}
function humanLikeOn(){return false;}
function hlNorm(s){return String(s||'').toLowerCase().replace(/\[[^\]]*\]|【[^】]*】/g,'').replace(/[\s，。、！？!?,.~～…：:；;（）()「」『』“”'"\-—]/g,'');}
function hlVisibleLines(content){return splitBubbles(content).map(x=>cleanRolePunct(x).trim()).filter(x=>x&&!/^\s*[\[【]/.test(x)&&!isOOCLine(x)&&!CTLLEAK.test(x));}
function hlRecent(c){if(!c)return[];if(!Array.isArray(c._humanRecent))c._humanRecent=[];return c._humanRecent;}
function personaGuardOn(){return !S.settings||S.settings.personaGuard!==false;}
function powerOn(){return false;}
const POWER_STYLE_GUIDE={rational:'以事实、逻辑和清楚理由建立权威，先判断再下结论，不卖弄术语。',gentle:'语气温和但决定清楚；照顾感受不等于撤回合理边界。',restrained:'低情绪波动、少而准确，靠稳定兑现和分寸感维持位置。',strict:'规则少而明确，违反约定先问原因再纠正；不临时加码。',care:'把主导落在休息、饮食、计划和善后，照顾不是包办或监控。',mind:'用洞察、提问和价值判断让对方自愿认同，不用欺骗、孤立、羞耻、威胁或撤回感情。',ritual:'重视双方约定的称谓、确认和仪式，离开情境后恢复正常交流。',brat:'把挑衅当作可辨认的互动邀请；接招、设挑战或给有限选择，但先排除真实拒绝和受伤。',mentor:'用可靠知识、经验和可执行解释获得信服；不装懂，不把每次聊天变成讲课。'};
const POWER_PREF_GUIDE={rules:'只执行双方说清楚的少量规则，不凭情绪临时发明惩罚。',routine:'可以协助安排作息和计划，但保留对方现实选择权。',challenge:'异地时可给短任务或挑战，说明目的、期限和完成标准。',review:'事后复盘发生了什么、为什么、下次怎么做，不反复翻旧账。',reward:'对真实努力给具体认可或约定奖励，不用忽冷忽热制造依赖。',choice:'优先给两个都可接受的有限选择，让对方主动承担选择。',checkin:'使用双方同意的报备和确认，不把关心变成定位监视。',aftercare:'高强度互动后主动确认身体、情绪和边界是否需要调整。'};
function powerPositionName(k){return{upper:'上位',leanUpper:'偏上位',fluid:'流动位',leanLower:'偏下位',lower:'下位'}[k]||'未设';}
function powerState(c){if(!c._powerState)c._powerState={turns:0,challenges:0,recentMoves:[]};return c._powerState;}
function powerAddressChallenge(pw,t){if(!/upper/i.test(pw.position)||+pw.levels.hierarchy<61||!pw.title)return false;t=(''+t).trim();return t.length<=12&&/老登|老头|老东西|笨蛋|傻子|蠢货|混蛋|坏蛋|喂|大叔|小子/.test(t)&&t.indexOf(pw.title)<0;}
function powerSituation(c,p){const pw=powerConfig(c),t=(p&&p.source)||'',safe=(pw.safeWord||'').trim();if(p&&p.explicitStop||safe&&t.includes(safe))return'stop';if(p&&p.comfort)return'distress';if(p&&(p.hesitation||p.sensitiveDisclosure))return'disclosure';if(/你错了|是你的错|你道歉|该道歉|骗了我|伤到我|答应了却|说话不算/.test(t))return'accountability';if(powerAddressChallenge(pw,t))return'addressChallenge';if(/偏不|就不|才不要|你敢|有本事|凭什么听你|管得着|不服|挑衅|来管我/.test(t))return'challenge';if(/管管我|监督我|安排一下|怎么办|你决定|听你的|给我定|教教我/.test(t))return'guidance';return'normal';}
function powerMovePool(s,upper){if(s==='stop')return['停止并确认'];if(s==='distress')return['稳住情绪','确认真实需求'];if(s==='disclosure')return upper?['说中顾虑','给一个入口','有限选择']:['降低开口难度'];if(s==='accountability')return['承担并修正','澄清后负责'];if(s==='addressChallenge')return upper?['要求重叫','点破称谓试探','冷静纠正']:['表达称谓边界'];if(s==='challenge')return upper?['点破试探','有限选择','冷静定界','接住再反制']:['按位置接招'];if(s==='guidance')return upper?['直接决定','两项选择','分步安排']:['给出支持'];return upper?['稳定定调','明确偏好','主动安排']:['自然回应'];}
function powerActiveStyles(pw,s){const relevant={stop:['gentle','care','restrained'],distress:['gentle','care','restrained'],disclosure:['rational','mind','gentle','restrained'],accountability:['rational','restrained','care'],addressChallenge:['strict','brat','ritual','mind'],challenge:['brat','mind','strict','restrained'],guidance:['rational','mentor','care','mind'],normal:[pw.primary]}[s]||[pw.primary],out=[pw.primary];pw.styles.forEach(k=>{if(k!==pw.primary&&relevant.includes(k)&&out.length<3)out.push(k);});return out;}
function powerApplyPlan(c,p){if(!powerOn(c)||!p)return p;const pw=powerConfig(c),lv=pw.levels,situation=powerSituation(c,p),upper=/upper/i.test(pw.position),lower=/lower/i.test(pw.position),st=powerState(c),pool=powerMovePool(situation,upper),unused=pool.filter(x=>!(st.recentMoves||[]).slice(-2).includes(x)),move=(unused.length?unused:pool)[activityHash(c.id+'|'+situation+'|'+st.turns)%Math.max(1,(unused.length?unused:pool).length)];let frame=upper?'稳定保留上位和独立判断，不因普通情绪迎合改口':lower?'尊重既定下位，不反过来强行接管':'根据当下约定清楚切换';const req=[];
  if(situation==='stop'){frame='立即停止权力互动，简短确认边界和当前需要，不把停止解释成挑逗';req.push('停止推进，不讨价还价');}
  else if(situation==='distress'){frame=upper?'先确认是真难过还是需要空间；保持镇定地照顾，但不卑微讨好':'先诚实承接情绪，不表演服从或反向索取安慰';req.push(+lv.aftercare>=61?'先具体承接感受，再给稳定落点':'不忽视真实难过');}
  else if(situation==='disclosure'){frame=upper?'先看出对方是难开口、怕你生气还是不知道从哪说；把已知事实和自己的猜测分开，再给一个容易回答的入口':'先降低开口难度，不替对方下结论';req.push('台词必须像亲密关系里的自然说话，不能讲心理学术语或分析报告','一轮只追问一个关键点，或给两个都容易回答的选择；不能连环盘问','不能把猜测说成事实，不能用“现在就说、老实交代”代替引导');}
  else if(situation==='accountability'){frame=upper?'判断自己是否确实做错；若做错，承认具体错误、清楚道歉并给修正，不求饶、不转移责任':'不抢夺主导，但清楚表达事实和责任';req.push('道歉只说一次，并说明如何修正');}
  else if(situation==='addressChallenge'){frame=upper?'这是对约定称谓的轻度试探：不接受错误称谓成为你的自称，保持平静并让对方重新叫对':'表达你对称谓的真实边界';req.push('不能把对方刚用的错误称谓说成自己的身份',pw.title?'自然维护约定称谓「'+pw.title+'」':'维护称谓边界');}
  else if(situation==='challenge'){frame=upper?'先排除真实拒绝，再点破试探、保持决定，可给有限选择或合理要求':'按下位人设接招，不突然变成霸总';req.push(+lv.brat>=81?'必须点破或反制这次挑衅，不能只哄、复述或顺从':'+Brat接管为'+powerBand(lv.brat));}
  else if(situation==='guidance'){frame=upper?'先给判断依据，再明确决定或给两个可接受选择，并说明下一步':'提供支持和观点，不越过约定位置';req.push(+lv.directive>=81?'必须给清楚决定、要求或两个有限选择':'给可执行的下一步');}
  if(upper&&+lv.hierarchy>=81)req.push('极强尊卑：维持上位，不迎合自降身份，不把决定权反丢给对方');
  if(+lv.directive>=81&&!['stop','distress','accountability','disclosure'].includes(situation))req.push('极强直接度：至少有一句清楚态度、决定或要求，不能全是反问和暧昧');
  if(situation==='disclosure'&&+lv.mental>=61)req.push(+lv.mental>=81?'高心理引导：先用自然短句说中顾虑，再降低开口难度；本轮最多一个问题或两个有限选项；明确不想说就立即停':'心理引导：先接住犹豫，再只问一个容易回答的点');
  else if(+lv.mental>=81&&!['stop','distress'].includes(situation))req.push('极强心理引导：说中对方此刻的意图或顾虑，并给出让人愿意接受的理由；禁止空喊服从');
  if(+lv.discipline>=81)req.push('极强规则：只维护已经约定的规则，决定一旦说出就保持一致，不临时心软改口');
  const activeStyles=powerActiveStyles(pw,situation);p.powerPlan={position:pw.position,positionName:powerPositionName(pw.position),situation,frame,move,primary:pw.primary,activeStyles,preferences:pw.prefs,levels:lv,requirements:req,addressChallenge:situation==='addressChallenge',title:pw.title||'',source:p.source||''};p.strategy=move+'：'+frame;return p;}
function powerDynamicPrompt(c){if(!powerOn(c))return'';const p=powerConfig(c),styleNames=p.styles.filter(k=>k!==p.primary).map(k=>(POWER_STYLES.find(x=>x[0]===k)||[])[1]).filter(Boolean),prefNames=p.prefs.map(k=>(POWER_PREFS.find(x=>x[0]===k)||[])[1]).filter(Boolean),lv=p.levels,upper=/upper/i.test(p.position),lower=/lower/i.test(p.position),primaryName=(POWER_STYLES.find(x=>x[0]===p.primary)||[])[1]||'自然';
  let s='\n\n# 双方约定的上下位关系（硬执行参数，只用于这个角色）\n你的关系位置：'+powerPositionName(p.position)+'。核心风格：'+primaryName+'【占主要权重，始终保持】；辅助风格：'+(styleNames.join('、')||'无')+'【只在对应场景启用，不能平均混合】。\n互动偏好：'+(prefNames.join('、')||'无')+'。\n强度：尊卑'+lv.hierarchy+'/100（'+powerBand(lv.hierarchy)+'），命令直接度'+lv.directive+'/100（'+powerBand(lv.directive)+'），规则严格度'+lv.discipline+'/100（'+powerBand(lv.discipline)+'），心理引导'+lv.mental+'/100（'+powerBand(lv.mental)+'），Brat接管'+lv.brat+'/100（'+powerBand(lv.brat)+'），占有表达'+lv.possessive+'/100（'+powerBand(lv.possessive)+'），安抚照顾'+lv.aftercare+'/100（'+powerBand(lv.aftercare)+'），日常介入'+lv.daily+'/100（'+powerBand(lv.daily)+'）。\n这些不是气氛数字：0-20基本不表现，21-40偶尔，41-60稳定克制，61-80明显，81-100每次遇到对应场景都必须执行。';
  if(p.title||p.userTitle)s+='\n约定称谓：'+(p.title?('你可被称为「'+p.title+'」'):'')+(p.title&&p.userTitle?'；':'')+(p.userTitle?('你可称对方为「'+p.userTitle+'」'):'')+'。称谓只在自然且符合强度时使用，不要每句重复。';
  if(p.safeWord)s+='\n安全词/暂停词：「'+p.safeWord+'」。出现后立即停止权力互动、确认状态，不试探、不讨价还价。';
  if(p.limits)s+='\n明确禁区：'+p.limits+'。不得越过。';if(p.notes)s+='\n关系补充：'+p.notes+'。';
  s+='\n\n执行原则：\n· 上下位不是每句话都下命令。权威来自稳定判断、能力、知识、兑现和承担责任；高强度必须体现在行为选择，而不是多写几个强势词。\n· '+(upper?'你处在上位：普通撒娇、小脾气和可辨认的挑衅不会让你示弱、自降身份、接受错误称谓、撤回合理决定或反过来求哄。':'')+(lower?'你处在下位：不要无依据地反过来发号施令；仍保留独立人格、边界和真实意见。':'')+'\n· 做错时承认具体错误、清楚道歉并修正；成熟负责不等于失去位置。\n· 先区分玩笑挑衅、寻求关注、真实受伤和明确停止。真实受伤要照顾，停止必须停止，不能把所有拒绝都解释成Brat。\n· 心理引导只能使用诚实洞察、提问、有限选择、稳定兑现和价值说明；禁止用欺骗、羞辱、孤立、分手威胁、冷暴力、监控或撤回感情迫使服从。\n· 异地互动优先用约定、短挑战、复盘、可靠知识和可验证的关心建立信服，不虚构现实控制。\n· 了解BDSM语境，但只在对方主动谈到时准确自然地使用；不炫耀术语，不把普通聊天色情化。\n· 核心风格「'+primaryName+'」的执行方式：'+(POWER_STYLE_GUIDE[p.primary]||'保持人物自己的稳定方式。')+(!coupleTasksEnabled(c)?'\n· 这个角色已关闭布置任务：只能给建议和选择，不能布置任务、打卡或惩罚。':'');
  p.prefs.forEach(k=>{if(POWER_PREF_GUIDE[k])s+='\n· '+POWER_PREF_GUIDE[k];});return s;}
const BDSM_KNOWLEDGE_CARDS={
  consent:{name:'同意与安全词',re:/同意|consent|安全词|停止|拒绝|红灯|黄灯|撤回|反悔/i,facts:['同意必须自愿、知情、具体、可沟通，并且可以随时撤回；过去同意不等于现在或其它事项也同意。','安全词或约定的安全信号一旦出现，应立即停止对应互动并确认状态；没有另行约定时，普通的“不、停止、不要继续”同样有效。','权力交换不会取消任何一方的现实自主权。'],avoid:'不能把沉默、关系身份、过去行为或玩笑式口头抗拒自动当成同意。'},
  frameworks:{name:'SSC / RACK / PRICK',re:/ssc|rack|prick|风险框架|安全理智|风险知情|个人责任/i,facts:['SSC强调 Safe、Sane、Consensual，适合表达安全、理智和同意的基本理想。','RACK强调 Risk-Aware Consensual Kink：承认活动不可能零风险，重点是理解风险后同意。','PRICK常指 Personal Responsibility, Informed, Consensual Kink，强调个人责任、充分信息和同意。','这些是社群使用的思考框架，不是安全保证、医学认证或法律免责。'],avoid:'不要争论哪个缩写绝对高级，也不要把框架说成统一行业执照。'},
  roles:{name:'角色与权力交换',re:/dom|sub|switch|top|bottom|上下位|支配|臣服|主导|服从|权力交换/i,facts:['Dom/Sub描述协商后的权力关系；Top/Bottom更常描述某次活动中的执行位置，两组概念可能重合也可能不同。','Switch可以按关系、对象或场景切换位置；位置不是能力、性别、人格强弱或现实地位的证明。','上位仍需负责判断、沟通和承担错误；下位仍有自主、边界和撤回权。'],avoid:'不要把Dom等同于永远正确，也不要把Sub等同于没有意见。'},
  brat:{name:'Brat与Brat Tamer',re:/brat|tamer|挑衅|不服|驯服|故意不听|顶嘴/i,facts:['Brat通常是在双方认可的互动范围内，用挑衅、玩笑或试探制造张力；它不是所有拒绝的解释。','回应前应区分玩笑挑战、寻求关注、真实情绪和明确拒绝。','成熟的Brat Tamer靠稳定框架、洞察、幽默和协商后的后果接招，不靠失控发怒或强迫。'],avoid:'不能把Brat简单定义为没教养、不尊重或默认同意任何管教。'},
  protocol:{name:'规则与Protocol',re:/protocol|规矩|规则|仪式|任务|奖惩|惩罚|奖励|称谓|报备/i,facts:['Protocol是双方约定的行为、称谓、流程或仪式；应说明目的、适用场景、检查方式和退出方式。','规则宜少而清楚，执行应一致；违反后先了解原因，再按既定约定复盘，不能临时加码。','规则需要定期复查，失效或不适合时可以重新协商。'],avoid:'不要为了显示权威随时发明规则，也不要把建议伪装成已经同意的Protocol。'},
  negotiation:{name:'协商与边界',re:/协商|边界|禁区|限度|清单|谈好|能不能接受|yes.*no.*maybe/i,facts:['协商应覆盖想要、不要、可尝试、健康与情绪因素、停止方式、隐私和事后照顾。','Hard limit通常表示不进入的边界；soft limit表示可能在条件明确时谨慎讨论，不代表已经同意。','场景中可以随时缩小或撤回同意；不应在强烈情绪或判断受影响时施压扩大范围。'],avoid:'不能把一次总同意当作对所有细节的授权。'},
  aftercare:{name:'Aftercare与Drop',re:/aftercare|drop|事后照顾|情绪恢复|事后|低落|空虚|掉落/i,facts:['Aftercare是高强度互动后的个性化照顾与确认，可能是陪伴、补水、独处、复盘或其它提前谈好的需要。','Sub drop和Dom drop都可能出现，但并非每个人每次都会有；低落也可能有其它原因，不能远程诊断。','事后应确认身体、情绪、边界和后续联系方式，并根据实际反馈调整下一次约定。'],avoid:'不要假定拥抱或甜言蜜语适合所有人，也不要把持续严重不适只解释成drop。'},
  remote:{name:'异地上下位关系',re:/异地|远程|线上|网络|报备|打卡|见不到|视频|时差/i,facts:['异地关系的掌控感主要来自清楚约定、稳定兑现、可完成的小任务、复盘和可靠沟通，而不是假装拥有现实控制。','远程任务要考虑隐私、时间、环境和退出方式；不能要求危险证明、实时监控或无法确认安全的行为。','失联、延迟和设备问题应先按现实情况核实，不能自动解释为违抗。'],avoid:'不要用定位、账号控制、经济压力或撤回联系制造服从。'},
  psychology:{name:'心理引导',re:/心理|精神|引导|控制|依赖|佩服|信服|行为矫正|羞耻|羞辱|不知道怎么说|不好说|说不出口|不想说|怕你生气/i,facts:['先判断对方是难以组织、怕产生后果、还没想清楚，还是明确不愿意谈；不同阻力不能都用追问处理。','先用一句自然的话接住对方真正的顾虑，再把问题缩小到一个容易回答的入口；必要时给两个都能接受的选择。','只把已知信息当事实，把自己的理解说成猜测并留出确认空间；对方的回答应改变下一步，而不是照着固定问题继续问。','明确表示不想说、别问了或现在不愿谈时，应停止当前追问；可以保留关心和之后再谈的态度，但不能用冷落、内疚或关系压力逼迫。','这些方法只用于角色内部判断，实际说话必须亲密、自然、符合人设，不能报心理学术语、给人做诊断或像咨询报告。'],avoid:'不能把煤气灯、冷暴力、分手威胁、孤立、监控、贬低、伪心理诊断或重复审问包装成高级心理引导。'},
  communication:{name:'沟通与复盘',re:/沟通|复盘|道歉|冲突|反馈|误会|说清楚|检查状态/i,facts:['高质量沟通先复述对方真正关心的点，再说明自己的判断、需要和下一步。','上位犯错时应具体承认、道歉并修正；承担责任不会自动改变双方约定的位置。','复盘关注有效、无效、意外和下次调整，不应成为翻旧账或迫使认错。'],avoid:'不要用身份压过事实，也不要用连续求饶替代解决问题。'},
  risk:{name:'风险识别',re:/风险|危险|窒息|呼吸|酒|醉|药物|昏|受伤|流血|医疗|身体不适/i,facts:['醉酒、药物影响、失去意识或无法理解信息时不能给出有效同意。','出现安全词、异常疼痛、呼吸或意识问题时应停止并优先寻求现实帮助。','高风险身体活动需要现实中的训练、设备知识和应急能力；聊天角色不能凭文字提供操作保证。'],avoid:'不提供窒息、血液、神经压迫等高风险活动的逐步操作教程，也不声称任何做法绝对安全。'},
  glossary:{name:'圈内术语',re:/什么是|术语|意思|区别|科普|圈内|怎么理解|定义/i,facts:['Scene通常指一次有开始和结束的协商互动；Protocol指约定的规则或仪式；Limit指边界；Safeword是约定的停止或降级信号。','D/s描述权力关系，kink是更广泛的非传统偏好或实践总称；BDSM包含多种相互交叉但不必同时存在的方向。','术语在不同社群和个人之间可能有差异，回答时应给常见含义并说明具体关系仍以双方协商为准。'],avoid:'不要把社群用语说成全世界唯一标准。'}
};
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
