function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
//@@ web
function roleMessageGap(text){return 1050+Math.min(1350,[...String(text||'')].length*22)+Math.random()*520;}
//@@ private
function roleMessageGap(text,id){if(id&&typeof RobotVoice!=='undefined'&&RobotVoice.roleActive(id))return 0;return 1050+Math.min(1350,[...String(text||'')].length*22)+Math.random()*520;}
//@@ end
// ===== 记忆总结·重要度(1-5) + 自动清理 =====
const IMP_INSTR='\n最后，请在【最前面单独一行】用「重要度：N」给这段记忆打个分：N是1到5的整数——1=普通日常闲聊、2=有点小事、3=一般值得记、4=重要、5=刻骨铭心的大事(比如表白/订婚/纪念日/ta哭了/重大承诺/大吵又和好)。第一行只写「重要度：N」，第二行起再写日记正文。';
function rateAndText(raw){let imp=3,text=(raw||'').trim();const m=text.match(/^\s*重要度\s*[:：]?\s*([1-5])[^\n]*\n?/);if(m){imp=+m[1];text=text.slice(m[0].length).trim();}return {imp:imp,text:text};}
// 按句子边界截断，别把最后一句砍掉一半（记忆总结不再"突然断掉"）
function trimSentence(t,max){t=(''+t).trim();if(t.length<=max)return t;const stops=['。','！','？','…','!','?','.','~','～','；',';'],s=t.slice(0,max);let last=-1;for(const ch of stops){const k=s.lastIndexOf(ch);if(k>last)last=k;}if(last>max*.4)return s.slice(0,last+1);const tail=t.slice(max,Math.min(t.length,max+120));let next=-1;for(const ch of stops){const k=tail.indexOf(ch);if(k>=0&&(next<0||k<next))next=k;}return next>=0?t.slice(0,max+next+1):s.trim()+'…';}
// 总结要用角色平常叫用户的称呼，不能泛称“对方/ta”，否则长期记忆会变冷、变散。
function summaryAccountProfile(aid){aid=memoryScopeKey(aid);const a=S.me&&Array.isArray(S.me.accounts)&&S.me.accounts.find(x=>x&&x.id===aid);if(a)return a;if(aid===actId())return S.me||{};return{id:aid,name:'你',callName:''};}
function summaryUserLabel(c,aid){aid=memoryScopeKey(aid);const a=summaryAccountProfile(aid);return ((aid==='main'&&c&&c.callme)||(aid==='main'&&S.me&&S.me.callName)||(aid==='main'&&a.callName)||a.name||'你').trim();}
function summaryReplaceAliasStable(text,source,label){text=String(text||'');source=String(source||'').trim();label=String(label||'').trim();if(!source||!label||source===label)return text;let token='\uE000\uE001\uE002\uE003';while(text.includes(token))token+='\uE004';const escaped=source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');text=text.split(label).join(token);text=text.replace(new RegExp(escaped,/^[A-Za-z0-9 _.-]+$/.test(source)?'gi':'g'),label);return text.split(token).join(label);}
function summaryCollapseAliasRuns(text,c,aid){let t=String(text||''),label=summaryUserLabel(c,aid),a=summaryAccountProfile(aid),tokens=[label,a&&a.name,a&&a.callName,'North'].map(x=>String(x||'').trim()).filter((x,i,all)=>x&&all.indexOf(x)===i);for(const token of tokens){const q=token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');t=t.replace(new RegExp('(?:'+q+'){3,}','g'),label||token);}if(label){const q=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');t=t.replace(new RegExp('(?:'+q+'){2,}','g'),label);}return t;}
function summaryRepairStoredText(c,item,aid){if(!item)return'';const max=item.offlineId?1900:700;let t=summaryCollapseAliasRuns(item.text,c,aid);t=summaryCleanText(c,t,aid);t=summaryCollapseAliasRuns(t,c,aid);return Array.from(t).length>max?trimSentence(t,max):t;}
function repairRunawaySummaries(){let changed=false;(S.contacts||[]).forEach(c=>{if(!c)return;const repair=(arr,aid)=>{if(!Array.isArray(arr))return;arr.forEach(x=>{if(!x||!x.text)return;const before=x.text,after=summaryRepairStoredText(c,x,aid);if(after!==before){x.text=after;changed=true;}});};repair(c.summaries,'main');Object.keys(c._accountSummaries||{}).forEach(aid=>repair(c._accountSummaries[aid],aid));});if(changed)S._summaryRepairPendingV848=true;return changed;}
function summaryStripModelNoise(t){t=(''+(t||'')).replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim();
  t=t.replace(/^重要度\s*[:：]?\s*[1-5][^\u4e00-\u9fa5A-Za-z0-9【[]*/,'').trim();
  let prefix='',m=t.match(/^(【(?:语音通话|视频通话|小黑屋|线下约会[^】]*|电话短信|陌生短信|陌生来电)】)\s*/);if(m){prefix=m[1];t=t.slice(m[0].length).trim();}
  const meta='(?:语气|情绪|心情|称呼|叫法|昵称|身份|角色扮演|可能会叫|会叫|喊|叫|生气|吃醋|撒娇|委屈|难过|低沉|温柔|冷淡|强硬|安慰|质问)';
  for(let i=0;i<4;i++){
    t=t.replace(new RegExp('^\\s*[\\[【(（]\\s*'+meta+'[^\\]】)）]{0,80}[\\]】)）]\\s*[:：、,，；;]?\\s*'),'').trim();
    t=t.replace(new RegExp('^\\s*'+meta+'\\s*[:：]\\s*[^。！？!?；;]{0,50}[。！？!?；;]?\\s*'),'').trim();
  }
  t=t.replace(new RegExp('[（(][^）)]{0,120}'+meta+'[^）)]{0,120}[）)]','g'),'');
  t=t.replace(/^(?:[\u4e00-\u9fa5A-Za-z0-9^~～_·]{1,12}\s*[\/／|｜、]\s*){1,8}[\u4e00-\u9fa5A-Za-z0-9^~～_·]{1,12}\s*/,'').trim();
  t=t.replace(/(?:^|[。！？!?；;]\s*)(?:\[[^\]]{1,80}\]|【(?!语音通话|视频通话|小黑屋|线下约会)[^】]{1,80}】)\s*/g,m=>/[\[【](?:语气|情绪|心情|称呼|格式|系统|角色扮演|可能会叫|会叫)[\s\S]*[\]】]/.test(m)?m.replace(/[\[【][\s\S]*[\]】]\s*/,'') : m);
  t=t.replace(/\s+([，。！？；：,.!?;:])/g,'$1').replace(/([（(【[])\s+/g,'$1').replace(/\s+([）)】\]])/g,'$1').replace(/\s{2,}/g,' ').trim();
  return prefix?(prefix+(t?' '+t:'')):t;}
function summaryCleanText(c,text,aid){aid=memoryScopeKey(aid);let t=summaryStripModelNoise(text),label=summaryUserLabel(c,aid),a=summaryAccountProfile(aid),names=[a&&a.name,a&&a.callName,'North'];names.filter(n=>n&&n!=='我'&&n!==label).forEach(n=>{t=summaryReplaceAliasStable(t,n,label);});if(label)t=t.replace(/对方|ta|TA/g,label);return summaryStripModelNoise(t);}
function summaryNorm(text,aid){const label=summaryUserLabel(null,aid);return summaryCleanText(null,text,aid).toLowerCase().replace(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),'').replace(/今天|今晚|刚才|后来|然后|这次|我们|事情|感觉|觉得|记得|已经|还是|就是|真的|有点/g,'').replace(/[^\u4e00-\u9fa5a-z0-9]/g,'');}
function summarySimilarity(a,b,aid){a=summaryNorm(a,aid);b=summaryNorm(b,aid);if(!a||!b)return 0;if(a===b||a.includes(b)||b.includes(a))return 1;const grams=s=>{const z=new Set();for(let i=0;i<s.length-1;i++)z.add(s.slice(i,i+2));return z;},x=grams(a),y=grams(b);if(!x.size||!y.size)return 0;let hit=0;x.forEach(v=>{if(y.has(v))hit++;});return 2*hit/(x.size+y.size);}
// 视角铁律：防止总结把“他做的”和“我做的”搞反；正文不写设备主人的真实名字。
function perspRule(c,aid){const u=summaryUserLabel(c,aid);return '\n【视角铁律·绝不搞反】始终站在你自己（'+(c.name||'你')+'）的视角写："我"永远指你自己，"'+u+'"永远指和你聊天的人。原文每行开头的姓名就是说话/行动者，必须按姓名判断归属，不要被句子里的"我/你/他/她"带偏。谁做的事就写在谁头上——是你骂了/罚了/管教/审问/付款/同意，就写"我……'+u+'"；是'+u+'撒娇/认错/做错/想买/付款/同意，就照实写在'+u+'身上。【绝对不能】把你做的事写成'+u+'做的，也不能把'+u+'做的事写成你做的。涉及第三个人时必须写清姓名，别用含糊的"他/她"。';}
function sumStamp(){return northLocaleDate(Date.now(),{year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function summaryList(c,aid){if(!c)return[];aid=memoryScopeKey(aid);if(aid==='main'){if(c.summary&&!Array.isArray(c.summaries)){c.summaries=[{time:'(早期)',text:c.summary,accountId:'main'}];delete c.summary;}c.summaries=Array.isArray(c.summaries)?c.summaries:[];return c.summaries;}c._accountSummaries=c._accountSummaries||{};c._accountSummaries[aid]=Array.isArray(c._accountSummaries[aid])?c._accountSummaries[aid]:[];return c._accountSummaries[aid];}
function summaryState(c,aid){aid=memoryScopeKey(aid);c._accountSummaryState=c._accountSummaryState||{};if(!c._accountSummaryState[aid])c._accountSummaryState[aid]=aid==='main'?{count:Math.max(0,+c._sumCount||0),cursorV2:!!c._summaryCursorV2}:{count:0,cursorV2:false};return c._accountSummaryState[aid];}
function summaryStateSave(c,aid,upto,rows){aid=memoryScopeKey(aid);const st=summaryState(c,aid),all=Array.isArray(rows)?rows:(typeof msgsForAccount==='function'?msgsForAccount(c.id,aid):[]);st.count=Math.max(0,+upto||0);st.cursorV2=true;const anchor=st.count>0&&all[st.count-1];st.lastMessageId=anchor&&anchor.id?String(anchor.id):'';if(aid==='main'){c._sumCount=st.count;c._summaryCursorV2=true;}return st;}
function summaryStateDone(c,aid,all){all=Array.isArray(all)?all:[];const st=summaryState(c,aid);if(st.lastMessageId){const index=all.findIndex(m=>m&&String(m.id||'')===String(st.lastMessageId));if(index>=0){st.count=index+1;return st.count;}st.count=0;st.lastMessageId='';if(typeof save==='function')save();return 0;}if((+st.count||0)>all.length){summaryStateSave(c,aid,0,all);if(typeof save==='function')save();return 0;}return Math.max(0,Math.min(all.length,+st.count||0));}
function summaryCursorRebaseAfterMessagePrune(c,aid,before,after){if(!c)return 0;before=Array.isArray(before)?before:[];after=Array.isArray(after)?after:[];aid=memoryScopeKey(aid);const st=summaryState(c,aid),done=summaryStateDone(c,aid,before),kept=new Set(after),next=before.slice(0,done).reduce((n,m)=>n+(kept.has(m)?1:0),0);summaryStateSave(c,aid,next,after);delete c._autoSummaryError;delete c._autoSummaryErrorAt;return next;}
/* 「清理低星」是一次主动动作，和「满了才删」是两回事。用户点它的时候就是想立刻清掉不重要的，
   不该要求先超过上限。5 星永远保留，这一条在任何清理路径下都不变。 */
function memoryPruneLowStars(rows,maxStar){if(!Array.isArray(rows))return 0;const keep=Math.max(1,Math.min(4,+maxStar||2));let n=0;for(let i=rows.length-1;i>=0;i--){const imp=Math.max(1,Math.min(5,+(rows[i]&&rows[i].imp)||3));if(imp>=5||imp>keep)continue;rows.splice(i,1);n++;}return n;}
/* 两个面板共用：主动清理低星。5 星永不触及。 */
function wechatMemoryPruneLowStars(id,maxStar){const c=getC(id);if(!c)return;const arr=summaryList(c,memoryScopeKey());const n=memoryPruneLowStars(arr,maxStar);save();editSummary(id);toast(n?('已清掉 '+n+' 条 '+maxStar+' 星及以下的记忆'):'没有可清理的低星记忆（5 星永远保留）');}
async function cohabMemoryPruneLowStars(id,maxStar){const d=cohabData(id);if(!d)return;const top=typeof cohabMemoryScrollTop==='function'?cohabMemoryScrollTop():0;const rows=d.summaries||[];const n=memoryPruneLowStars(rows,maxStar);save();if(typeof cohabMemoryOpen==='function')cohabMemoryOpen(id,{top});toast(n?('已清掉 '+n+' 条 '+maxStar+' 星及以下的记忆'):'没有可清理的低星记忆（5 星永远保留）');}
/* 去重与文本修复任何时候都做；只有「超上限就删」这一步才受自动清理开关控制。
   以前这里是无条件 return，导致关掉自动清理后手动按钮完全空转。opt.force 供面板按钮主动调用。 */
function pruneSummaries(c,aid,opt){aid=memoryScopeKey(aid);let arr=summaryList(c,aid);arr.forEach(x=>{if(x&&x.text)x.text=summaryRepairStoredText(c,x,aid);});for(let i=arr.length-1;i>=0;i--){for(let j=0;j<i;j++){if(summarySimilarity(arr[i]&&arr[i].text,arr[j]&&arr[j].text,aid)>=.72){arr[j].imp=Math.max(arr[j].imp||3,arr[i].imp||3);arr.splice(i,1);break;}}}if(S.settings.memAutoClean===false&&!(opt&&opt.force))return;const cap=(+S.settings.memCap)||100;
  while(arr.length>cap){let cand=-1,candImp=99;for(let i=0;i<arr.length;i++){const im=arr[i].imp||3;if(im>=5)continue;if(im<candImp){candImp=im;cand=i;}}if(cand<0)break;/* 剩下全是5星就不再删 */arr.splice(cand,1);}}
//@@ web
/* 视角检查只拦真正写反的总结：模型没返回内容、用角色自己的名字当旁白主语、或者全篇没有「我」却用「他/她」叙述。
   以前只要没出现「我」字、或者有一句以「她说/他在…」开头就整条判不合格——可是日记里写聊天对象「她后来答应了」再正常不过，
   手动总结于是反复提示「视角不合格」。返回空串表示通过，否则是给用户看的原因。 */
//@@ end
function summaryPerspectiveIssue(c,text,aid){const t=summaryCleanText(c,text,aid),self=[c&&c.name,c&&c.remark].map(x=>String(x||'').trim()).filter(Boolean);if(!t)return'模型没有返回总结内容';for(const name of self){if(name&&new RegExp('(?:^|[。！？；]\\s*)'+wxEscRe(name)+'(?:说|想|觉得|看|问|让|把|在|正|又|没|没有|已经|后来)').test(t))return'总结用角色名字当了旁白，不是第一人称';}if(!t.includes('我')&&/(?:^|[。！？；]\s*)(?:他|她)(?:说|想|觉得|看|问|让|把|在|正|又|没|没有|已经|后来)/.test(t))return'总结是第三人称旁白，不是第一人称';return'';}
function summaryPerspectiveValid(c,text,aid){return !summaryPerspectiveIssue(c,text,aid);}
function summaryCompletedRounds(rows){let waiting=false,n=0;for(const m of rows||[]){if(!m||m._call||m.type==='sys'||!msgToText(m))continue;if(m.role==='user')waiting=true;else if(m.role==='assistant'&&waiting){n++;waiting=false;}}return n;}
function summaryStoreResult(c,text,imp,prefix,aid){if(!text)return'rejected';aid=memoryScopeKey(aid);const arr=summaryList(c,aid),now=Date.now(),importance=Math.max(1,Math.min(5,imp||3)),full=summaryCleanText(c,(prefix||'')+text,aid);if(!full||memoryOperationalEventOnly(full))return'rejected';const same=arr.find(x=>x&&x.text&&summarySimilarity(x.text,full,aid)>=.58);if(same){same.imp=Math.max(same.imp||3,importance);same.confidence=Math.max(same.confidence||.75,.8);same.ts=same.ts||now;same.accountId=aid;pruneSummaries(c,aid);save();return'duplicate';}const temporary=importance<=2&&/今天|今晚|明天|这周|最近|临时|刚才|一会儿|待会儿/.test(full);arr.push({time:sumStamp(),ts:now,text:full,imp:importance,confidence:.75,expiresAt:temporary?now+14*86400000:null,accountId:aid});pruneSummaries(c,aid);save();return'added';}
function addSummary(c,text,imp,prefix,aid){return summaryStoreResult(c,text,imp,prefix,aid)==='added';}
// 给系统提示挑总结：所有4-5星的(珍贵回忆永远在场) + 最近n条
function topSummaries(arr,n){arr=arr||[];if(arr.length<=n)return arr;const recent=arr.slice(-n);const older=arr.slice(0,arr.length-n).filter(x=>(x.imp||3)>=4);return older.concat(recent);}
function wechatSummarySystem(c,aid,prior){const ul=summaryUserLabel(c,aid);return '你就是「'+c.name+'」本人。下面只包含你和「'+ul+'」尚未总结过的新微信文字聊天。用第一人称写成一段完整日记：“我”只能指你自己，只用「'+ul+'」称呼聊天对象；禁止用角色姓名或“他/她”叙述你自己，禁止写“对方/ta/TA/那个人”。只记录新增的重要事实、约定、喜好、状态或关系变化，写80到220个中文字、2到3句完整句子；信息少可以短些，但不能是零散短句，不要重述已有总结。登录或退出微信、查看手机、屏幕共享、远程控制、同步、读取、上传和报错都只是功能操作，不能写进长期记忆；若操作中有重要人际事实，只写事实。禁止称呼候选列表、斜杠称呼、括号语气/情绪/角色扮演说明和系统格式说明。'+(prior?'\n【已有总结·禁止重复】\n'+prior:'')+perspRule(c,aid)+IMP_INSTR;}
async function maybeSummarize(id,aid){
  const c=getC(id);aid=memoryScopeKey(aid);
  const rounds=Math.max(0,Math.min(100,+S.settings.summaryRounds||0)),key=id+'#'+aid,busy=maybeSummarize._busy||(maybeSummarize._busy=new Set());
  if(!c||!rounds||busy.has(key)||c._autoSummaryErrorAt&&Date.now()-c._autoSummaryErrorAt<5*60000)return false;
  const all=msgsForAccount(id,aid),arr=summaryList(c,aid),st=summaryState(c,aid);
  if(aid==='main'&&!st.cursorV2&&(!st.count||st.count<0)&&arr.length){summaryStateSave(c,aid,all.length);pruneSummaries(c,aid);save();return false;}
  const done=summaryStateDone(c,aid,all),pending=all.slice(done);
  if(summaryCompletedRounds(pending)<rounds)return false;
//@@ web
  const chunk=pending.map(m=>{if(!m||m._call||m.type==='sys')return'';const t=msgToText(m);return t?(m.role==='user'?summaryUserLabel(c,aid):c.name)+'：'+t:'';}).filter(Boolean).join('\n');
//@@ private
  const chunk=pending.map(m=>{if(!m||m._call||m.type==='sys')return'';const raw=msgToText(m),t=typeof NorthSkyRoleSync!=='undefined'?NorthSkyRoleSync.historyContent(m,raw):raw;return t?(m.role==='user'?summaryUserLabel(c,aid):c.name)+'：'+t:'';}).filter(Boolean).join('\n');
//@@ end
  if(!chunk){summaryStateSave(c,aid,all.length);save();return false;}
  const prior=arr.slice(-8).map(x=>'· '+summaryCleanText(c,x.text,aid)).join('\n'),system=wechatSummarySystem(c,aid,prior),messages=[{role:'system',content:system},{role:'user',content:chunk}];
  busy.add(key);
  try{
    let raw=await chatAPI(messages,{aux:S.settings.summaryModel==='aux',max:460,temp:.3,complete:true}),rt=rateAndText(cleanReply(raw)),candidate=trimSentence(rt.text,220);
    if(!summaryPerspectiveValid(c,candidate,aid)||Array.from(candidate||'').length<50){
      raw=await chatAPI([...messages,{role:'assistant',content:raw||''},{role:'user',content:'上一版过短或不是角色本人第一人称。只依据原聊天重写成2到3句完整记忆：必须用“我”指角色自己，用「'+summaryUserLabel(c,aid)+'」称呼聊天对象；删除第三人称旁白，补齐重要事实但不要编造，也不要解释。'}],{aux:S.settings.summaryModel==='aux',max:460,temp:.18,complete:true});
      rt=rateAndText(cleanReply(raw));candidate=trimSentence(rt.text,220);
    }
    if(!candidate||!summaryPerspectiveValid(c,candidate,aid))throw new Error('自动总结视角不合格');
    if(summaryStoreResult(c,candidate,rt.imp,'',aid)==='rejected')throw new Error('自动总结没有可保存的人际事实');
    summaryStateSave(c,aid,all.length);delete c._autoSummaryError;delete c._autoSummaryErrorAt;save();return true;
  }catch(e){c._autoSummaryError=String(e&&e.message||e||'自动总结失败').slice(0,120);c._autoSummaryErrorAt=Date.now();save();return false;}
  finally{busy.delete(key);}
}
const _manualWechatSummaryBusy=new Set();
//@@ web
function manualWechatSummarySource(id,aid){const c=getC(id);aid=memoryScopeKey(aid);if(!c)return null;const all=msgsForAccount(id,aid),arr=summaryList(c,aid),st=summaryState(c,aid),upto=all.length,legacy=aid==='main'&&!st.cursorV2&&(!st.count||st.count<0)&&arr.length,done=summaryStateDone(c,aid,all),chunk=all.slice(done,upto).map(m=>{if(!m||m._call||m.type==='sys')return'';const t=msgToText(m);if(!t)return'';return(m.role==='user'?summaryUserLabel(c,aid):c.name)+'：'+t;}).filter(Boolean).join('\n');return{c,aid,arr,st,all,upto,done,legacy,chunk};}
//@@ private
function manualWechatSummarySource(id,aid){const c=getC(id);aid=memoryScopeKey(aid);if(!c)return null;const all=msgsForAccount(id,aid),arr=summaryList(c,aid),st=summaryState(c,aid),upto=all.length,legacy=aid==='main'&&!st.cursorV2&&(!st.count||st.count<0)&&arr.length,done=summaryStateDone(c,aid,all),chunk=all.slice(done,upto).map(m=>{if(!m||m._call||m.type==='sys')return'';const raw=msgToText(m),t=typeof NorthSkyRoleSync!=='undefined'?NorthSkyRoleSync.historyContent(m,raw):raw;if(!t)return'';return(m.role==='user'?summaryUserLabel(c,aid):c.name)+'：'+t;}).filter(Boolean).join('\n');return{c,aid,arr,st,all,upto,done,legacy,chunk};}
//@@ end
function manualWechatSummaryCanRepairClearedCursor(src){return!!(src&&src.st&&src.st.cursorV2&&!src.st.lastMessageId&&src.st.count>0&&src.done>=src.upto&&src.all.some(m=>m&&!m._call&&m.type!=='sys'&&msgToText(m)));}
async function manualWechatSummary(id){
  const aid=memoryScopeKey(),key=id+'#'+aid;
  if(_manualWechatSummaryBusy.has(key)){toast('这次微信总结还在生成');return false;}
  _manualWechatSummaryBusy.add(key);
  try{
    let src=manualWechatSummarySource(id,aid);if(!src)return false;
    if(src.legacy){summaryStateSave(src.c,aid,src.upto);pruneSummaries(src.c,aid);save();editSummary(id);toast('旧总结进度已对齐；之后的新微信可随时手动总结');return false;}
    if(!src.chunk&&manualWechatSummaryCanRepairClearedCursor(src)){
      if(!await uiConfirm('检测到旧版总结进度没有消息锚点。\n\n如果你清空过这个角色的聊天，旧进度可能把新聊天误判成已经总结。是否只把总结起点重置到当前聊天开头？已有长期记忆不会删除，重复内容保存时仍会去重。'))return false;
      summaryStateSave(src.c,aid,0,src.all);delete src.c._autoSummaryError;delete src.c._autoSummaryErrorAt;save();src=manualWechatSummarySource(id,aid);
    }
    if(!src.chunk){toast('当前没有尚未总结的新微信');return false;}
    if(!await uiConfirm('手动总结尚未整理的新微信？\n\n会使用当前选择的微信总结模型调用一次；电话、系统消息和已经总结过的内容不会重复加入。'))return false;
    src=manualWechatSummarySource(id,aid);if(!src||!src.chunk){toast('当前没有尚未总结的新微信');return false;}
    const prior=src.arr.slice(-8).map(x=>'· '+summaryCleanText(src.c,x.text,aid)).join('\n'),system=wechatSummarySystem(src.c,aid,prior),messages=[{role:'system',content:system},{role:'user',content:src.chunk}];
    let raw=await chatAPI(messages,{aux:S.settings.summaryModel==='aux',max:460,temp:.3,complete:true}),rt=rateAndText(cleanReply(raw)),candidate=trimSentence(rt.text,220);
    if(!summaryPerspectiveValid(src.c,candidate,aid)||Array.from(candidate||'').length<50){
      raw=await chatAPI([...messages,{role:'assistant',content:raw||''},{role:'user',content:'上一版过短或不是角色本人第一人称。只依据原聊天重写成2到3句完整记忆：必须用“我”指角色自己，用「'+summaryUserLabel(src.c,aid)+'」称呼聊天对象；删除第三人称旁白，不要编造或解释。'}],{aux:S.settings.summaryModel==='aux',max:460,temp:.18,complete:true});
      rt=rateAndText(cleanReply(raw));candidate=trimSentence(rt.text,220);
    }
    if(!candidate||!summaryPerspectiveValid(src.c,candidate,aid)){const why=(!candidate&&'模型没有返回总结内容')||(typeof summaryPerspectiveIssue==='function'&&summaryPerspectiveIssue(src.c,candidate,aid))||'总结视角不合格';toast('这次没总结成：'+why+'。原微信进度未改变，可以换个总结模型或再点一次',5200);return false;}
    if(summaryStoreResult(src.c,candidate,rt.imp,'',aid)==='rejected'){toast('这次没有可保存的重要内容，原微信进度未改变');return false;}
    summaryStateSave(src.c,aid,src.upto);save();editSummary(id);toast('新的微信总结已保存');return true;
  }catch(e){toast('手动总结失败：'+String(e&&e.message||'请求没有成功').slice(0,60)+'。原微信进度未改变',5200);return false;}
  finally{_manualWechatSummaryBusy.delete(key);}
}
async function summarizeCall(id,kindTxt,sess,aid){const c=getC(id);aid=memoryScopeKey(aid);if(!c)return;
  const cms=msgsForAccount(id,aid).filter(m=>m._call&&(!sess||m._cs===sess));if(!cms.length)return;
  const text=cms.map(m=>(m.role==='user'?summaryUserLabel(c,aid):c.name)+'：'+((m.content||(m.type==='voice'?(m.content||'[语音]'):''))||'')).filter(x=>x.slice(-1)!=='：').join('\n');
  if(!text.trim())return;
  try{const ul=summaryUserLabel(c,aid),sum=await chatAPI([{role:'system',content:'你就是「'+c.name+'」本人。下面是你和「'+ul+'」刚才这通'+kindTxt+'里说的话。请用第一人称【较完整地】把这通'+kindTxt+'记成一段记忆：只记这通电话新增的事情、重要的点和你的感受。用"我"指你自己('+c.name+')，只用「'+ul+'」称呼聊天对象，禁止写“对方/ta/TA/那个人”这种泛称。写3到5句（一两百字）、每句话完整，是你的口吻和视角，直接写正文，别分点别带前缀。正文禁止列称呼候选、禁止写斜杠称呼列表，禁止写括号里的语气/情绪/角色扮演说明，禁止输出系统格式说明。'+perspRule(c,aid)+IMP_INSTR},{role:'user',content:text}],{max:600,temp:.45});
    if(sum){const rt=rateAndText(cleanReply(sum));if(rt.text)addSummary(c,trimSentence(rt.text,320),rt.imp,'【'+kindTxt+'】',aid);}
  }catch(e){}}
let _replyTimers={};
let _replyDone={};
const MANUAL_REPLY_LIMIT=2;
let _replying={};
let _replyQueue=[];
let _replyEpoch={};
let _replyDeferred={};
let _replyFeaturePending={};
let _replyFeatureTimers={};
const _replyNoVisibleReasons=new Map();
function replyStateKey(id,aid){return accountMessageKey(id,aid||actId());}
function replyNoVisibleReasonKey(id,aid,token){return replyStateKey(id,aid)+'|'+String(token==null?'':token);}
function replyNoVisibleReasonSet(id,aid,token,reason){const key=replyNoVisibleReasonKey(id,aid,token);if(reason)_replyNoVisibleReasons.set(key,String(reason));else _replyNoVisibleReasons.delete(key);while(_replyNoVisibleReasons.size>40)_replyNoVisibleReasons.delete(_replyNoVisibleReasons.keys().next().value);}
function replyNoVisibleReasonGet(id,aid,token){return _replyNoVisibleReasons.get(replyNoVisibleReasonKey(id,aid,token))||'';}
function replyNoVisibleReasonFromContent(content){const text=roleVisibleEnvelopeText(content);if(!text)return'接口请求成功，但返回正文为空';const rows=splitChatBubbles(text,30).map(x=>cleanRolePunct(normalizeImageLine(normTag(x)))).filter(Boolean);if(rows.length&&rows.every(x=>isRefusal(x)))return'模型只返回了拒绝或占位内容，已被聊天安全规则过滤';if(/^\s*(?:[\[【]\s*(?:内心|心情|心情值|记住|来电|同意游戏|拒绝游戏|改备注|换头像|删我好友|叫车查询|叫车|订演唱会查询|订演唱会|订火车票查询|订火车票|订机票查询|订机票|订票|送票|订酒店|联网|放行|发朋友圈|发推|锁定|解锁|禁言|解禁|限时|加时|记仇|消气|控制)[^\]】]*[\]】]\s*)+$/i.test(text))return'模型只返回了心情、记忆或操作指令，没有可显示的聊天内容';return'模型返回的内容没有通过聊天格式或安全检查，因此未显示';}
function replyGenerationStore(){if(!_replying||typeof _replying!=='object'||Array.isArray(_replying))_replying={};return _replying;}
function replyGenerationKey(id,aid){return replyStateKey(id,aid||actId());}
function replyGenerationState(id,aid){const k=replyGenerationKey(id,aid);if(replyGenerationStore()[k])return'active';return (_replyQueue||[]).some(x=>x&&x.key===k)?'queued':'';}
function replyGenerationBusy(id,aid){return !!replyGenerationState(id,aid);}
function replyGenerationCount(){return Object.keys(replyGenerationStore()).length;}
function replyGenerationRefresh(id,aid){if((aid||actId())!==actId()||cur().p!=='chat'||cur().id!==id)return;const b=document.querySelector('.manual-reply-chip');if(!b)return;const state=replyGenerationState(id,aid),vision=hasPendingVision(id);b.disabled=!!(state||vision);b.textContent=vision?'正在识图…':state==='active'?'回复中…':state==='queued'?'排队中…':'▶ 让ta回';}
function replyGenerationDrain(){
  _replyQueue=Array.isArray(_replyQueue)?_replyQueue:[];
  while(replyGenerationCount()<MANUAL_REPLY_LIMIT){
    const i=_replyQueue.findIndex(x=>x&&x.aid===actId());if(i<0)break;
    const job=_replyQueue.splice(i,1)[0],c=getC(job.id);if(!c||c.blocked||c.deleted)continue;
    if(replyHandoffQueuedDone(job)){replyGenerationRefresh(job.id,job.aid);continue;}
    replyGenerationRun(job.id,job.aid);
  }
}
function replyEpoch(id,aid){const k=replyStateKey(id,aid);return +(_replyEpoch&&_replyEpoch[k]||0);}
function replyTouch(id,aid){const k=replyStateKey(id,aid);_replyEpoch[k]=replyEpoch(id,aid)+1;if(_replyTimers[k]){clearTimeout(_replyTimers[k]);delete _replyTimers[k];}delete _replyDeferred[k];const running=replyGenerationStore()[k];if(running){running.cancelled=true;delete replyGenerationStore()[k];}_replyQueue=(_replyQueue||[]).filter(x=>x&&x.key!==k);try{if((aid||actId())===actId()&&cur().p==='chat'&&cur().id===id){const t=$('#typing');if(t)t.remove();}}catch(_){}if(running){replyGenerationRefresh(id,aid);replyGenerationDrain();}}
function replyStale(id,token,aid){return token!=null&&+token!==replyEpoch(id,aid);}
function replyPendingUserText(id,aid){const a=msgsForAccount(id,aid||actId()),out=[];for(let i=a.length-1;i>=0;i--){const m=a[i];if(!m||m._call)continue;if(m.role==='assistant'&&m.type!=='sys')break;if(m.role==='user'&&m.type!=='sys'){const t=msgToText(m);if(t)out.unshift('· '+t.replace(/\n/g,' ').slice(0,220));}}return out.slice(-6).join('\n');}
function deliveryPendingUserTurnText(id,aid,fallback){const rows=String(replyPendingUserText(id,aid)||'').split(/\r?\n/).map(x=>x.replace(/^\s*·\s*/, '').trim()).filter(x=>x&&!/^[\s!！?？。,.，；;…~～]+$/.test(x)),pending=rows.join('，');return String(pending||fallback||'').trim().slice(0,800);}
function wxLoginCompletionFeature(note){return /功能事件即时反应｜角色退出微信登录/.test(String(note||''));}
function wxLoginCompletionVisibleContent(content){return String(content||'').replace(/[\[【]\s*(?:登录微信|申请远程操控(?:手机)?)\s*[\]】]/g,'').trim();}
function wxLoginCompletionReplyValid(content){const rows=initiativeVisibleText(content).split(/[\n。！？!?；;]+/).map(x=>x.replace(/\s+/g,'').trim()).filter(Boolean);if(!rows.length)return false;const operation=/^(?:我)?(?:已经|刚刚|刚|这就|现在)?(?:看完(?:微信)?|退出(?:微信)?|登(?:录)?完(?:微信)?|下线|改(?:好|完)?(?:了)?备注|把备注改(?:好|完)?了|处理完|弄好)(?:了)?$/;return rows.some(x=>!operation.test(x));}
function wxLoginCompletionRepairPrompt(){return '[退出微信后的最后一次纠正]\n你刚才已经真实退出登录，现在必须立刻给聊天对象发出一轮能看见的普通微信。只输出一至三条角色本人会说的话；至少有一句表达你看完后的真实想法、感受、判断或态度，不能只有“看完了/退出了/改好备注了”。禁止输出任何方括号标签、操作指令、心情标签、记忆标签、系统说明，也不能再次登录微信或申请远程操控。没有新变化时也要用你自己的口吻说一句新的此刻反应，不能保持空白。]';}
function featureEventReplyNeedsRepair(note,content){const n=String(note||''),t=String(content||'');if(/功能事件即时反应｜微信备注被修改/.test(n))return !/(备注|改成|改名|称呼|叫我|谁让|谁准|擅自|你改)/.test(t);if(/功能事件即时反应｜日记密码首次输错/.test(n))return !/(日记|密码|偷看|翻我|想看|输错)/.test(t);if(/你发出的转账被收款/.test(n))return !t||/(?:转回来|退回来|退给我|还给我|又给我转|你给我转)/.test(t)||!/(?:收下|收款|收了|拿着|收到这笔|你收)/.test(t);if(/你发出的转账被退还/.test(n))return !t||/(?:我退给你|我又转|你收下|你收款)/.test(t)||!/(?:退还|退回|不收|还给我)/.test(t);return false;}
function featureEventRepairPrompt(note){const n=String(note||''),diary=/日记密码首次输错/.test(n),received=/你发出的转账被收款/.test(n),refunded=/你发出的转账被退还/.test(n);if(received)return '[转账事实纠正：这笔钱原本是你转给用户的，用户刚点了收款并已经收下；用户没有给你转钱，也没有把钱转回来。只按这个结果，用角色本人语气自然反应，不要复述系统说明或再输出收款标签。]';if(refunded)return '[转账事实纠正：这笔钱原本是你转给用户的，用户刚点了退还，钱已原路回到你这里；不要说成你又转给用户。只按这个结果自然反应，不要复述系统说明。]';return '[轻量纠正：上一版自然语言可以保留，但漏掉了当前刚发生的关键操作。请只重写一次，用角色本人的语气'+(diary?'明确表现你发现了ta第一次输错日记密码、正在试图看日记':'明确表现你发现ta擅自改了自己在你微信里的备注')+'，再自然接住真正尚未回复的新消息。不要逐字复述提示或用户原话，不要写系统说明；一至三条即可。]';}
function featureEventQueueAdd(id,note,aid){if(!featureEventNoteActive(note))return;const k=replyStateKey(id,aid),a=_replyFeaturePending[k]||(_replyFeaturePending[k]=[]),text=String(note||'');if(!a.some(x=>x&&x.note===text))a.push({note:text,at:Date.now()});if(a.length>6)_replyFeaturePending[k]=a.slice(-6);}
function featureEventQueueEntries(id,aid){const k=replyStateKey(id,aid);return _replyFeaturePending[k]=(_replyFeaturePending[k]||[]).filter(x=>x&&x.note&&(typeof photoAlbumEventNoteValid!=='function'||photoAlbumEventNoteValid(x.note,id,aid))&&(!String(x.note||'').includes('[日程受邀提醒作用域|')||calInviteNoteValid(x.note,id,aid)));}
function featureEventQueueMerge(id,note,aid){const a=featureEventQueueEntries(id,aid),base=String(note||'').trim(),parts=a.map(x=>x.note).filter((x,i,all)=>all.indexOf(x)===i);if(base&&!parts.includes(base))parts.push(base);return parts.join('\n\n[紧接着发生的下一项真实上下文]\n');}
function featureEventQueueAck(id,aid,note,ok){if(!ok)return;const k=replyStateKey(id,aid),used=String(note||''),a=_replyFeaturePending[k]||[];_replyFeaturePending[k]=a.filter(x=>x&&x.note&&!used.includes(x.note));if(!_replyFeaturePending[k].length)delete _replyFeaturePending[k];}
function offlineReplyIntent(id,note,explicit){if(explicit==='user'||explicit==='proactive'||explicit==='companion')return explicit;if(/设备真实快照/.test(String(note||'')))return'companion';if(featureEventNoteActive(note)||/这是你本人刚经历、必须记得的微信事件/.test(String(note||'')))return'user';return !note||!!replyPendingUserText(id)?'user':'proactive';}
function offlineReplyBlocked(intent,id){if(intent==='user')return false;if(intent==='companion')return roleServerPushDeliveryBlocked(id);return roleOnlineProactiveBlocked(id);}
function replyVisibleAssistantCount(id,aid){return msgsForAccount(id,aid||actId()).filter(m=>m&&m.role==='assistant'&&m.type!=='sys').length;}
function manualUnlockReplyActive(note){const n=String(note||'');return /本轮只允许提到这一次明确的手动解锁事件/.test(n)&&/本人亲自解锁了/.test(n);}
function manualUnlockReplyVisible(content){return initiativeVisibleText(content).replace(/\s+/g,' ').trim();}
function manualUnlockReplyPerspectiveInvalid(content){const text=manualUnlockReplyVisible(content);if(!text||/[\[【]\s*(?:保持安静|不说话)\s*[\]】]/.test(String(content||'')))return false;return /(?:^|[，。！？；;\s])(?:她|他|用户|ta|当前聊天对象|聊天对象|对方)(?=刚|又|已经|亲自|自己|把|解锁|以为|没有|没|在|说|做|要|会|想|觉得|倒好|[，。！？；;\s]|$)/i.test(text);}
function manualUnlockReplyRepeated(id,aid,content,c){const fresh=manualUnlockReplyVisible(content),old=String(c&&c._manualUnlockReplyText||''),a=replyDedupNorm(fresh),b=replyDedupNorm(old),min=Math.min(a.length,b.length),same=!!(a&&b&&(a===b||min>=8&&(a.includes(b)||b.includes(a))||min>=12&&(replyLcsContainment(a,b)>=.88||replyBigramScore(a,b)>=.86)));return same||!!(fresh&&initiativeRecentlyRepeated(id,content,7*86400000));}
function manualUnlockReplyNeedsRepair(id,aid,note,content,c){if(!manualUnlockReplyActive(note))return'';const visible=manualUnlockReplyVisible(content);if(!visible||/[\[【]\s*(?:保持安静|不说话)\s*[\]】]/.test(String(content||'')))return'silent';if(manualUnlockReplyPerspectiveInvalid(content))return'perspective';/* 只有"他压根没说出可显示的话"和"写错了人称"才值得顶替。重复顶多是啰嗦，
   而兜底那句本身就是每次都一样的模板，拿它去替一句重复的话反而更死板。 */
return'';}
function manualUnlockEventApp(note){const m=String(note||'').match(/本人亲自解锁了「([^」]{1,80})」/);return m?m[1].trim():'';}
function manualUnlockReplyFallback(c,note){const app=manualUnlockEventApp(note)||'这个App',rows=['「'+app+'」你自己解开了。','你把「'+app+'」解了。','「'+app+'」是你自己动的手。','你自己把「'+app+'」解开了。'],old=replyDedupNorm(c&&c._manualUnlockReplyText||'');let at=Math.max(0,+c._manualUnlockFallbackSeq||0)%rows.length;for(let i=0;i<rows.length;i++){const pick=rows[(at+i)%rows.length];if(replyDedupNorm(pick)!==old){if(c)c._manualUnlockFallbackSeq=(at+i+1)%rows.length;return pick;}}return rows[at];}
//@@ web
function manualUnlockReplyGuard(id,aid,note,content,c){const issue=manualUnlockReplyNeedsRepair(id,aid,note,content,c);return issue?{content:manualUnlockReplyFallback(c,note),consumed:false,blocked:issue,fallback:true}:{content:String(content||''),consumed:false,blocked:'',fallback:false};}
//@@ private
function manualUnlockReplyGuard(id,aid,note,content,c){const issue=manualUnlockReplyNeedsRepair(id,aid,note,content,c);if(issue&&String(note||'').includes('本次批量解锁'))throw new Error('批量解锁已记录，但模型未生成有效回复，请稍后重试');return issue?{content:manualUnlockReplyFallback(c,note),consumed:false,blocked:issue,fallback:true}:{content:String(content||''),consumed:false,blocked:'',fallback:false};}
//@@ end
function manualUnlockReplyRemember(c,content,note){const text=manualUnlockReplyVisible(content),app=manualUnlockEventApp(note);if(!c||!text)return;c._manualUnlockReplyText=text.slice(0,700);c._manualUnlockReplyAt=Date.now();c._manualUnlockReplyApp=app;save();}
function deferAccountReply(id,note,token,aid){const k=replyStateKey(id,aid);if(replyStale(id,token,aid))return;_replyDeferred[k]={id,note,token,aid};}
function replyAccountChanged(id,note,token,aid,typingEl){if((typeof NorthTravelOrders!=='undefined'&&!NorthTravelOrders.noteValid(note)||typeof NorthConcertBooking!=='undefined'&&!NorthConcertBooking.noteValid(note)||typeof NorthTravelTaxi!=='undefined'&&!NorthTravelTaxi.noteValid(note)||typeof photoAlbumEventNoteValid==='function'&&!photoAlbumEventNoteValid(note,id,aid)||String(note||'').includes('[日程受邀提醒作用域|')&&!calInviteNoteValid(note,id,aid))){if(typingEl&&typingEl.isConnected)typingEl.remove();return true;}if(actId()===aid)return false;if(typingEl&&typingEl.isConnected)typingEl.remove();deferAccountReply(id,note,token,aid);return true;}
function resumeAccountReplies(aid){Object.keys(_replyDeferred).forEach(k=>{const d=_replyDeferred[k];if(!d||d.aid!==aid||replyStale(d.id,d.token,d.aid))return;delete _replyDeferred[k];clearTimeout(_replyTimers[k]);_replyTimers[k]=setTimeout(()=>{delete _replyTimers[k];Promise.resolve(aiReply(d.id,d.note,d.token,d.aid)).then(ok=>featureEventQueueAck(d.id,d.aid,d.note,ok===true));},120);});replyGenerationDrain();}
function delayedAccountReply(id,note,delay,aid){aid=aid||actId();if(featureEventAutoActive(note))return scheduleFeatureReply(id,note,delay,null,aid);const token=replyEpoch(id,aid);setTimeout(()=>{if(replyStale(id,token,aid))return;if(actId()!==aid){deferAccountReply(id,note,token,aid);return;}aiReply(id,note,token,aid);},Math.max(0,+delay||0));}
function scheduleFeatureReply(id,note,delay,onDone,aid){aid=aid||actId();note=featureEventNoteActive(note)?String(note):featureEventNote('刚发生的操作',note);featureEventQueueAdd(id,note,aid);const k=replyStateKey(id,aid);clearTimeout(_replyFeatureTimers[k]);_replyFeatureTimers[k]=setTimeout(()=>{delete _replyFeatureTimers[k];if(String(note||'').includes('[日程受邀提醒作用域|')&&!calInviteNoteValid(note,id,aid)){if(typeof onDone==='function')onDone(false);return;}scheduleReply(id,undefined,onDone,aid);},Math.max(0,+delay||0));return true;}
function resumeFeatureEvents(id,aid){aid=aid||actId();if(!featureEventQueueEntries(id,aid).length)return false;const k=replyStateKey(id,aid);if(_replyFeatureTimers[k]||_replyTimers[k])return true;_replyFeatureTimers[k]=setTimeout(()=>{delete _replyFeatureTimers[k];scheduleReply(id,undefined,null,aid);},120);return true;}
function friendAcceptedAutoNote(note){return /刚重新通过了你的好友申请|刚刚通过了你的好友申请|刚通过你的微信号把你加为好友/.test(String(note||''));}
function friendAcceptedLocalFallback(id,note,aid){const c=getC(id);if(!c||c.blocked||c.deleted||actId()!==(aid||actId()))return false;const n=String(note||''),text=/刚重新通过/.test(n)?friendReaddFallback(c):/刚通过你的微信号/.test(n)?altFriendOpeningFallback(c):'你好，我是'+(c.remark||c.name)+'。既然你通过了，我们就从这句话开始好好认识。';const m={role:'assistant',type:'text',content:text,time:Date.now(),id:uid(),_friendAcceptFallback:true};msgsForAccount(id,aid||actId()).push(m);save();notifyIncoming(c,m);if(cur().p==='chat'&&cur().id===id)render();return true;}
function scheduleReply(id,note,onDone,replyAid){
  const aid=replyAid||actId(),k=replyStateKey(id,aid);if(featureEventAutoActive(note)&&!featureEventNoteActive(note))note=featureEventNote('真实操作变化',note);if(featureEventNoteActive(note))featureEventQueueAdd(id,note,aid);const queuedFeature=featureEventQueueEntries(id,aid);if(queuedFeature.length){clearTimeout(_replyFeatureTimers[k]);delete _replyFeatureTimers[k];note=featureEventQueueMerge(id,note,aid);}const replyIntent=offlineReplyIntent(id,note);if(offlineReplyBlocked(replyIntent,id)){if(typeof onDone==='function')onDone(false);return false;}
  if(typeof cinemaRoleOccupied==='function'&&cinemaRoleOccupied(id)){if(typeof onDone==='function')onDone(false);return false;}
  if(wxLoginBlockReply(id,note)){if(typeof onDone==='function')onDone(false);return false;}
  /* CHAT_SEND_KEEP_HISTORY_V1：消息已由pushMsg追加，等待回复只更新按钮，保留旧消息与图片节点。 */
  if(!wxLoginCompletionFeature(note)&&typeof roleBusyDeferReply==='function'&&roleBusyDeferReply(id,note,aid)){replyGenerationRefresh(id,aid);return true;}
  if(note&&_call&&_call.state==='active'&&_call.id===id&&/任务|便签|没完成|未完成|完成|验收|奖励|惩罚|罚/.test(note)){
    callAI(String(note).replace(/\]\s*$/,'\n【重要·此刻正在通话中】你们正在通话，这件事必须在电话里直接说，绝对不要另发微信消息。]'));
    if(typeof onDone==='function')onDone(true);return true;
  }
  // 手动回复模式：回应"我发的消息"(无note)时不自动回，等我点「让ta回复」；主动找我的(带note/系统触发)照常自动
  if(!note&&manualReplySceneOn('wechat')){replyGenerationRefresh(id,aid);if(typeof onDone==='function')onDone(false);return false;}
  const token=replyEpoch(id,aid);clearTimeout(_replyTimers[k]);if(_replyDone[k]){const prev=_replyDone[k];delete _replyDone[k];try{prev(false);}catch(_){}}delete _replyDeferred[k];if(typeof onDone==='function')_replyDone[k]=onDone;_replyTimers[k]=setTimeout(async()=>{delete _replyTimers[k];const done=_replyDone[k];delete _replyDone[k];if(actId()!==aid){deferAccountReply(id,note,token,aid);if(done)done(false);return;}let success=false;try{success=(await aiReply(id,note,token,aid,replyIntent))===true;if(!success&&featureEventNoteActive(note)&&!replyStale(id,token,aid)&&actId()===aid&&!rolePhoneInspectionBlocksOrdinary(id)&&!wxLoginActive()){await sleep(180);const retryNote=note+'\n[本次仅重试一次：上一版没有形成任何用户能看到的消息。继续使用上面同一份真实事件和最新上下文，用角色本人语气自然发出一至三条内容；不要重复已回复的旧句，不要解释重试。]';success=(await aiReply(id,retryNote,token,aid,'user'))===true;}if(!success&&friendAcceptedAutoNote(note))success=friendAcceptedLocalFallback(id,note,aid);}catch(_){if(friendAcceptedAutoNote(note))success=friendAcceptedLocalFallback(id,note,aid);}featureEventQueueAck(id,aid,note,success);if(done)done(success);},queuedFeature.length?Math.min(220,(Number(S.settings.replyDelay)||0)*1000):(Number(S.settings.replyDelay)||0)*1000);return true;}
function manualReplyRetryAllowed(id,aid,token){const c=getC(id);return !!(c&&!c.blocked&&!c.deleted&&actId()===aid&&!replyStale(id,token,aid)&&!cinemaRoleOccupied(id)&&!wxLoginBlockReply(id));}
function manualReply(id){
  const aid=actId(),key=replyGenerationKey(id,aid);if(replyGenerationBusy(id,aid))return false;
  if(hasPendingVision(id)){toast('图片还在识别，等识别结束后再点');return false;}
  const c=getC(id);if(!c||c.blocked||c.deleted)return false;
  if(typeof roleBusyActive==='function'&&roleBusyActive(c,aid)){roleBusyDeferReply(id,null,aid);return false;}
  if(replyGenerationCount()>=MANUAL_REPLY_LIMIT){_replyQueue.push({id,aid,key,handoffMessageId:replyHandoffQueuedSource(id,aid)});replyGenerationRefresh(id,aid);toast('已排队，前面的回复完成后自动生成');return true;}
  replyGenerationRun(id,aid);return true;
}
async function replyGenerationRun(id,aid){
  aid=aid||actId();const key=replyGenerationKey(id,aid);if(replyGenerationStore()[key])return false;
  if(actId()!==aid){if(!replyGenerationBusy(id,aid))_replyQueue.push({id,aid,key});return false;}
  const c=getC(id);if(!c||c.blocked||c.deleted)return false;
  const running={id,aid,startedAt:Date.now(),cancelled:false};replyGenerationStore()[key]=running;replyGenerationRefresh(id,aid);
  // 判断最后一条真实对话是谁发的：若是他自己发的，这次「让ta回复」=继续多说，要明确告诉他别把自己的话当成对方说的
  let _note;{const _ms=msgs(id);for(let i=_ms.length-1;i>=0;i--){const mm=_ms[i];if(mm.type==='sys'||mm._call)continue;if(mm.role==='user')break;if(mm.role==='assistant'){_note='[系统：'+S.me.name+'这会儿还没开口、还没回你。请你接着自己刚才的话【再自然地多说几句】（补充、延续你上面说的，或换个角度再聊两句），不要重复已经说过的内容。注意：上面那几条都是【你自己】说的，不是'+S.me.name+'说的，千万别把自己说过的话当成ta说的去回应。]';break;}}}
  let _manualUser=null;{const _ms=msgs(id);for(let i=_ms.length-1;i>=0;i--){if(_ms[i]&&_ms[i].role==='user'&&_ms[i].type!=='sys'){_manualUser=_ms[i];break;}}}const inspectionPending=()=>nativeInspectionPending(_manualUser,id),shopContinuationFailed=()=>msgs(id).some(m=>(m._northShopReplyFailure||m._northOrderFailure)&&m.time>=running.startedAt&&String(m._northShopUserMessageId||m._northOrderFailureUserId||'')===String(_manualUser&&_manualUser.id||'')),token=replyEpoch(id,aid),before=replyVisibleAssistantCount(id,aid);try{await aiReply(id,_note,token,aid,'user',{reopenCompleted:true});if(replyVisibleAssistantCount(id,aid)===before&&inspectionPending())return true;if(replyVisibleAssistantCount(id,aid)===before&&shopContinuationFailed())return true;/* 只有当前用户消息自己的真实读取可以接管本轮；其他伴生任务不能阻断普通回复。 */if(replyVisibleAssistantCount(id,aid)===before&&manualReplyRetryAllowed(id,aid,token)){await sleep(180);if(inspectionPending())return true;const retryNote=(_note?_note+'\n':'')+'[系统：刚才没有形成任何用户能看到的微信消息。现在必须真正发出1到3条自然的文字或语音，接住当前聊天；不能只输出心情、记忆、操作或控制标签，不能保持空白。]';await aiReply(id,retryNote,token,aid,'user',{reopenCompleted:true});if(replyVisibleAssistantCount(id,aid)===before&&!inspectionPending()&&manualReplyRetryAllowed(id,aid,token)){const reason=replyNoVisibleReasonGet(id,aid,token)||'模型没有形成可显示的聊天内容';toast('模型未回复：'+reason+'。请检查当前模型或中转站后再试',6500);}}return true;}finally{replyNoVisibleReasonSet(id,aid,token,'');if(replyGenerationStore()[key]===running)delete replyGenerationStore()[key];replyGenerationRefresh(id,aid);replyGenerationDrain();}}
/* 提示音 + 通知 */
const MESSAGE_NOTIFICATION_URL='assets/message-notification-user-v1.mp3';
let _audio,_audioBornAt=0,_audioPulseAt=0,_audioWakeRequired=true,_audioWakeAt=0,_audioPrimeUrl='',_audioMediaPrimer=null,_messageMediaAudio=null,_ringMediaAudio=null,_callMediaAudio=null,_callMediaUrl='',_callMediaToken=0,_audioMicGranted=false,_audioMicCycling=null,_audioMicCycleStream=null,_audioMicCycleToken=0,_audioMicPermissionStatus=null;
const _uiToneUrls=new Map();
function uiToneElement(){if(_audioMediaPrimer)return _audioMediaPrimer;try{const a=new Audio();a.preload='auto';a.setAttribute('playsinline','');a.setAttribute('webkit-playsinline','');_audioMediaPrimer=a;return a;}catch(_){return null;}}
function messageToneElement(){if(_messageMediaAudio)return _messageMediaAudio;try{const a=new Audio();a.preload='auto';a.setAttribute('playsinline','');a.setAttribute('webkit-playsinline','');_messageMediaAudio=a;return a;}catch(_){return null;}}
function ringToneElement(){if(_ringMediaAudio)return _ringMediaAudio;try{const a=new Audio();a.preload='auto';a.setAttribute('playsinline','');a.setAttribute('webkit-playsinline','');_ringMediaAudio=a;return a;}catch(_){return null;}}
function callMediaElement(){if(_callMediaAudio)return _callMediaAudio;try{const a=new Audio();a.preload='auto';a.setAttribute('playsinline','');a.setAttribute('webkit-playsinline','');_callMediaAudio=a;return a;}catch(_){return null;}}
function uiToneUrl(seq,opt){opt=opt||{};seq=(seq||[]).filter(x=>x&&+x[0]>0&&+x[1]>0);if(!seq.length)return'';const gap=Math.max(0,+opt.gap||0),wave=opt.wave==='triangle'?'triangle':'sine',key=opt.key||JSON.stringify([seq,gap,!!opt.decay,wave]);if(_uiToneUrls.has(key))return _uiToneUrls.get(key);try{const rate=44100,parts=seq.map(x=>({freq:+x[0],count:Math.max(1,Math.round(+x[1]*rate)),gap:Math.max(0,Math.round(gap*rate))})),samples=parts.reduce((n,x)=>n+x.count+x.gap,0),b=new Uint8Array(44+samples*2),v=new DataView(b.buffer),w=(o,s)=>{for(let i=0;i<s.length;i++)b[o+i]=s.charCodeAt(i);};w(0,'RIFF');v.setUint32(4,36+samples*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,samples*2,true);let at=0;for(const p of parts){for(let i=0;i<p.count;i++){const t=i/rate,dur=p.count/rate,edge=Math.min(1,i/(rate*.008),(p.count-i-1)/(rate*.025)),soft=opt.decay?Math.min(1,t/.018)*Math.exp(-5.2*Math.max(0,t-.018)/Math.max(.05,dur-.018)):Math.max(0,edge),sine=Math.sin(2*Math.PI*p.freq*i/rate),tone=wave==='triangle'?(2/Math.PI)*Math.asin(sine):sine,sample=tone*Math.max(0,soft)*.58;v.setInt16(44+(at+i)*2,Math.max(-32767,Math.min(32767,Math.round(sample*32767))),true);}at+=p.count+p.gap;}const url=URL.createObjectURL(new Blob([b],{type:'audio/wav'}));_uiToneUrls.set(key,url);return url;}catch(_){return'';}}
function webToneSequence(seq,opt){opt=opt||{};ensureAudio();if(!_audio)return false;try{let at=_audio.currentTime,gap=Math.max(0,+opt.gap||0),level=Math.max(.01,Math.min(1,(+opt.level||.2)*volMul()));(seq||[]).forEach(x=>{const o=_audio.createOscillator(),g=_audio.createGain(),dur=Math.max(.03,+x[1]||.1);o.connect(g);g.connect(_audio.destination);o.frequency.value=+x[0]||660;o.type='sine';g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(level,at+.01);if(opt.sustain)g.gain.setValueAtTime(level,at+Math.max(.01,dur-.04));g.gain.exponentialRampToValueAtTime(.0001,at+dur);o.start(at);o.stop(at+dur+.02);at+=dur+gap;});return true;}catch(_){return false;}}
function playMediaTone(seq,opt){opt=opt||{};if(!S.settings.sound)return null;const a=uiToneElement(),url=uiToneUrl(seq,opt);if(!a||!url){webToneSequence(seq,opt);return null;}try{a.pause();a.loop=!!opt.loop;a.volume=Math.max(0,Math.min(1,(+opt.level||.45)*volMul()));if(a.src!==url)a.src=url;a.currentTime=0;const p=a.play();if(p&&typeof p.catch==='function')p.catch(()=>{if(typeof opt.onFail==='function')opt.onFail();else webToneSequence(seq,opt);});return a;}catch(_){webToneSequence(seq,opt);return null;}}
function ensureAudio(rebuildSuspended){try{
  const staleSuspended=rebuildSuspended&&_audio&&_audio.state==='suspended'&&Date.now()-_audioBornAt>700;
  if(_audio&&(_audio.state==='interrupted'||staleSuspended)){try{_audio.close();}catch(e){}_audio=null;_curSrc=null;}/* iOS 被打断或长期挂起后 resume 常常无效，用户再次点击时直接重建 */
  if(!_audio||_audio.state==='closed'){_audio=new (window.AudioContext||window.webkitAudioContext)();_audioBornAt=Date.now();}
  if(_audio&&_audio.state!=='running')_audio.resume().catch(()=>{});
}catch(e){}return _audio;}
function initAudio(){ensureAudio();}
// iOS/安卓 WebView 解锁：即使状态已经显示 running，也必须在用户手势里真正送出一次极低音量脉冲。
// 部分浏览器会出现“running 但输出通道仍静音”，之前的条件判断会误跳过解锁，直到开关一次听筒识别才恢复。
function audioUnlock(){try{const ac=ensureAudio(true);if(!ac)return null;try{if(ac.state!=='running')ac.resume().catch(()=>{});}catch(_){}const now=Date.now(),ua=typeof navigator!=='undefined'&&navigator.userActivation,gesture=!ua||ua.isActive;if(gesture&&now-_audioPulseAt>180){const bf=ac.createBuffer(1,32,22050),ch=bf.getChannelData?bf.getChannelData(0):null,s=ac.createBufferSource();if(ch&&ch.length)ch[0]=.00001;s.buffer=bf;s.connect(ac.destination);s.start(0);_audioPulseAt=now;}return ac;}catch(e){return null;}}
function audioRouteReset(unlockNow){if(typeof audioMicRouteCancel==='function')audioMicRouteCancel();stopBufSource('audio-route-reset');try{if(_audio&&_audio.state!=='closed')_audio.close();}catch(_){}_audio=null;_audioBornAt=0;_audioPulseAt=0;_audioWakeRequired=!unlockNow;try{if('speechSynthesis'in window)speechSynthesis.cancel();}catch(_){}return unlockNow?audioUnlock():null;}
function audioMarkWakeRequired(){_audioWakeRequired=true;}
function audioPrimeMediaUrl(){if(_audioPrimeUrl)return _audioPrimeUrl;try{const rate=8000,samples=800,b=new Uint8Array(44+samples*2),v=new DataView(b.buffer),w=(o,s)=>{for(let i=0;i<s.length;i++)b[o+i]=s.charCodeAt(i);};w(0,'RIFF');v.setUint32(4,36+samples*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,samples*2,true);v.setInt16(44,1,true);_audioPrimeUrl=URL.createObjectURL(new Blob([b],{type:'audio/wav'}));}catch(_){}return _audioPrimeUrl;}
function audioMediaWake(){try{const url=audioPrimeMediaUrl(),els=[uiToneElement(),messageToneElement(),callMediaElement()].filter(Boolean);if(!url||!els.length)return false;els.forEach(a=>{a.loop=false;a.volume=.001;if(a.src!==url)a.src=url;a.currentTime=0;const p=a.play();if(p&&typeof p.catch==='function')p.catch(()=>{});setTimeout(()=>{try{if(a.src===url)a.pause();}catch(_){}},180);});return true;}catch(_){return false;}}
function audioProbeMicPermission(){const devices=()=>{try{if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices)return Promise.resolve(false);return navigator.mediaDevices.enumerateDevices().then(ds=>{if((ds||[]).some(d=>d&&d.kind==='audioinput'&&d.label))_audioMicGranted=true;return _audioMicGranted;}).catch(()=>false);}catch(_){return Promise.resolve(false);}};try{if(_audioMicPermissionStatus){_audioMicGranted=_audioMicPermissionStatus.state==='granted'||_audioMicGranted;return _audioMicGranted?Promise.resolve(true):devices();}if(!navigator.permissions||!navigator.permissions.query)return devices();return navigator.permissions.query({name:'microphone'}).then(p=>{_audioMicPermissionStatus=p;const sync=()=>{_audioMicGranted=p.state==='granted';};sync();try{p.addEventListener('change',sync,{once:false});}catch(_){p.onchange=sync;}return _audioMicGranted||devices();}).catch(devices);}catch(_){return devices();}}
function audioMicRouteCancel(){_audioMicCycleToken++;const stream=_audioMicCycleStream;_audioMicCycleStream=null;_audioMicCycling=null;if(stream)try{stream.getTracks().forEach(t=>t.stop());}catch(_){}return !!stream;}
function audioMicRouteCycle(){if(!_audioMicGranted||_audioMicCycling||_rec||_callHF||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return Promise.resolve(false);const token=++_audioMicCycleToken,stop=stream=>{try{stream&&stream.getTracks().forEach(t=>t.stop());}catch(_){}};_audioMicCycling=navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>new Promise(res=>{if(token!==_audioMicCycleToken){stop(stream);res(false);return;}_audioMicCycleStream=stream;setTimeout(()=>{stop(stream);const ok=token===_audioMicCycleToken;if(ok){_audioMicCycleStream=null;_audioMicCycling=null;}res(ok);},90);})).catch(()=>{if(token===_audioMicCycleToken)_audioMicCycling=null;return false;});return _audioMicCycling;}
function audioHardWake(skipMic){const now=Date.now();if(now-_audioWakeAt<450)return audioUnlock();_audioWakeAt=now;const ac=audioRouteReset(true);audioMediaWake();if(!skipMic)audioMicRouteCycle().then(ok=>{if(!ok)return;try{if(ac&&ac.state!=='running')ac.resume().catch(()=>{});}catch(_){}audioMediaWake();try{if(_ma&&_mWantPlay&&_ma.paused)_ma.play().catch(()=>{});}catch(_){}});return ac;}
// iOS：切回页面只恢复 WebAudio 和本机播放器；只有明确点通话麦克风时才唤醒媒体通道，避免抢占正在播放的后台音乐。
function audioKick(e){const mic=!!(e&&e.target&&e.target.closest&&e.target.closest('[data-call-mic]'));if(_audioWakeRequired&&mic)audioHardWake(true);else audioUnlock();try{if(_ma&&_mWantPlay&&_ma.paused&&(!_ma.duration||_ma.currentTime<_ma.duration-0.3))_ma.play().catch(()=>{});}catch(e){}}
['touchend','pointerdown','click'].forEach(ev=>document.addEventListener(ev,audioKick,{passive:true}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)audioMarkWakeRequired();else audioProbeMicPermission();});
window.addEventListener('pageshow',()=>{audioMarkWakeRequired();audioProbeMicPermission();},{passive:true});
document.addEventListener('click',()=>{initAudio();const liveLoc=S.contacts.some(c=>!c.deleted&&getSpy(c).loc);if(!S.weather||Date.now()-S.weather.time>(liveLoc?600000:72000000))fetchWeather();},{once:true});
function playDing(){if(_ma&&_mWantPlay&&!_ma.paused){webToneSequence([[880,.22]],{level:.12,decay:true});setTimeout(()=>{try{if(_ma&&_mWantPlay&&_ma.paused)_ma.play().catch(()=>{});}catch(_){}},180);return;}playMediaTone([[880,.28]],{key:'message-ding-soft-v3',level:.16,decay:true});}
function playMessageDing(){if(!S.settings.sound)return null;const a=messageToneElement();if(!a){playDing();return null;}try{a.pause();a.loop=false;a.volume=Math.max(0,Math.min(1,.72*volMul()));if(!String(a.src||'').includes(MESSAGE_NOTIFICATION_URL))a.src=MESSAGE_NOTIFICATION_URL;a.currentTime=0;const p=a.play();if(p&&typeof p.catch==='function')p.catch(()=>playDing());return a;}catch(_){playDing();return null;}}
function notifyIncoming(c,msg){
  if(!msg||roleInternalControlLine(msg.content))return;
  // 语音消息：不再自动播放，改成点一下语音条才播（点开能重复听）
  if(c.muted)return;
  const viewing=cur().p==='chat'&&cur().id===c.id;
  if(!viewing&&!_call)showMsgBanner(c,msg);
  playMessageDing();
  appNotify(c.remark||c.name,previewOf(msg),{tag:'msg-'+c.id,data:{type:'open',target:'chat',id:c.id}});}
/* 撤回 / 编辑消息 */
function favoriteMsg(cid,mid){return window.wxFavoriteAdd&&window.wxFavoriteAdd(cid,mid);}
function msgMenu(cid,mid){if(_lpFired){_lpFired=false;return;}/* 刚长按过=去引用了，别再弹菜单 */
  const list=msgs(cid);const m=list.find(x=>x.id===mid);if(!m)return;
  const canEdit=m.type==='text'||(m.role==='assistant'&&m.type==='voice');
  const canTextVoice=m.role==='assistant'&&m.type==='text'&&String(m.content||'').trim();
  const canDeleteOwn=m.role==='user'&&(m.type==='text'||m.type==='image');
  const canQuote=(S.settings.quoteOn!==false)&&(m.type==='text'||m.type==='voice');
  // 重新生成：他发的(文字/语音/视频都行、不是系统提示)、且这条后面你没再说话(是最新那轮)才行
  let canRegen=(m.role==='assistant'&&m.type!=='sys'&&!m._call);
  if(canRegen){const i=list.findIndex(x=>x.id===mid);for(let j=i+1;j<list.length;j++){if(list[j].role==='user'&&list[j].type!=='sys'){canRegen=false;break;}}}
  openModal(`<h3>消息操作</h3>
    ${m.type==='image'&&m.src?`<button class="btn g" style="margin-bottom:8px" onclick="viewWechatMsgImage('${cid}','${mid}')">查看图片</button>`:''}
    ${['text','voice','image'].includes(m.type)&&typeof wxFavoriteAdd==='function'?`<button class="btn g" style="margin-bottom:8px" onclick="favoriteMsg('${cid}','${mid}')">☆ 收藏${m.type==='voice'?'原声':''}</button>`:''}
    ${canQuote?`<button class="btn g" style="margin-bottom:8px" onclick="quoteSet('${cid}','${mid}')">引用这句</button>`:''}
    ${canTextVoice?`<button class="btn g" style="margin-bottom:8px" onclick="openTextToVoice('${cid}','${mid}')">${svgIc('mic',15,'#eee')} 文字转语音</button>`:''}
    ${canEdit?`<button class="btn g" style="margin-bottom:8px" onclick="editMsg('${cid}','${mid}')">${m.type==='voice'?'编辑语音文字':'编辑'}</button>`:''}
    ${canRegen?`<button class="btn p" style="margin-bottom:8px" onclick="regenMsg('${cid}','${mid}')">${svgIc('refresh',15,'#fff')} 重新生成</button>`:''}
    ${canDeleteOwn?`<button class="btn d" style="margin-bottom:8px" onclick="deleteOwnMsg('${cid}','${mid}')">${m.type==='image'?'删除这张图片':'删除这条消息'}</button>`:''}
    ${m.role==='assistant'?`<button class="btn d" style="margin-bottom:8px" onclick="deleteRoleMsg('${cid}','${mid}')">删除这条角色消息</button>`:''}
    <button class="btn d" onclick="recallMsg('${cid}','${mid}')">撤回</button>
    <button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
const _textToVoiceBusy=new Set();
function textToVoiceInfo(text,c){const raw=ttsCleanBase(text),spoken=ttsPerformanceText(text,c,ttsCfg(c),{cue:ttsAutoCue(raw,c)}),chars=[...spoken].length,points=typeof aiTtsPointCost==='function'?aiTtsPointCost(chars):Math.max(1,Math.ceil(chars/50));return {raw,spoken,chars,points,tooLong:![...raw].length||[...raw].length>VOICE_MAX_CHARS||chars>VOICE_MAX_CHARS};}
function openTextToVoice(cid,mid){const c=getC(cid),m=msgs(cid).find(x=>x.id===mid);if(!c||!m||m.role!=='assistant'||m.type!=='text')return;const info=textToVoiceInfo(m.content,c),cost=ttsUseRelay(c)?`预计扣 ${info.points} AI点数（按实际处理后的 ${info.chars} 字计费）`:ttsApiOn(c)?'使用这个角色选择的语音路线生成，不扣内置AI点数':'使用手机系统语音，不扣AI点数';
  openModal(`<h3>文字转语音</h3><div class="hint">会用「${esc(c.remark||c.name)}」当前设置的音色，把这条文字转成语音。单条最长60秒，生成成功后会保存，重复播放不会再次扣点。</div><div class="field"><label>要转换的文字（${info.chars}/${VOICE_MAX_CHARS}字）</label><textarea rows="5" disabled>${esc(m.content||'')}</textarea></div><div class="hint" style="color:${info.tooLong?'#ff8b8b':'#aaa'}">${info.tooLong?'内容过长，暂时不能转换，请先编辑缩短。':cost}</div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" ${info.tooLong?'disabled':''} onclick="convertTextToVoice('${cid}','${mid}')">转换并播放</button></div>`);}
async function convertTextToVoice(cid,mid){const c=getC(cid),m=msgs(cid).find(x=>x.id===mid);if(!c||!m||m.role!=='assistant'||m.type!=='text'||_textToVoiceBusy.has(mid))return;const info=textToVoiceInfo(m.content,c),useRelay=ttsUseRelay(c);if(info.tooLong){toast('文字超过'+VOICE_MAX_CHARS+'字，先缩短再转换');return;}_textToVoiceBusy.add(mid);audioUnlock();closeModal();m.type='voice';m.showText=true;m.voiceCue=ttsAutoCue(m.content,c)||'';save();if(cur().p==='chat'&&cur().id===cid)render();
  if(!ttsApiOn(c)){speakMsg(m,c);_textToVoiceBusy.delete(mid);toast('已转为系统语音');return;}
  m._ttsLoading=true;m._playWhenReady=true;refreshVoiceBubble(m);const url=await warmVoiceMsg(m,c);_textToVoiceBusy.delete(mid);if(url){save();toast(useRelay?'已转为语音，本次扣除 '+info.points+' 点；重复播放不再扣点':'已用外置语音接口转换；未扣内置AI点数');return;}
  delete m._playWhenReady;delete m._ttsLoading;delete m._ttsFailAt;m.type='text';delete m.showText;delete m.voiceCue;save();if(cur().p==='chat'&&cur().id===cid)render();toast('转换失败，原文字已保留');}
function viewWechatMsgImage(cid,mid){const m=msgs(cid).find(x=>x.id===mid&&x.type==='image');if(!m||!m.src)return;closeModal();viewImg(m.src);}
function deleteOwnMsg(cid,mid){const list=msgs(cid),i=list.findIndex(x=>x.id===mid&&x.role==='user'&&(x.type==='text'||x.type==='image'));if(i<0)return;const m=list[i],isImage=m.type==='image';m._deleted=true;list.splice(i,1);if(isImage)_visionTasks.delete(mid);saveNow();persistWechatMessagesNow().catch(()=>{});if(isImage)try{imgGC();}catch(_){}closeModal();render();toast(isImage?'图片已删除':'消息已删除');}
function deleteRoleMsg(cid,mid){const list=msgs(cid),i=list.findIndex(x=>x.id===mid&&x.role==='assistant');if(i<0)return;list.splice(i,1);saveNow();persistWechatMessagesNow().catch(()=>{});closeModal();render();toast('角色消息已删除');}
function regenMsg(cid,mid){const c=getC(cid);if(!c){closeModal();return;}if(c.blocked){toast('ta把你拉黑了');closeModal();return;}
  if(replyGenerationBusy(cid,actId())){toast('上一轮回复还在处理中，请稍后重新生成');closeModal();return;}
  const list=msgs(cid);const i=list.findIndex(x=>x.id===mid);if(i<0){closeModal();return;}
  // 这条之后若有"你发的"新消息，就不能重新生成(只能重生成最新那轮)
  for(let j=i+1;j<list.length;j++){if(list[j].role==='user'&&list[j].type!=='sys'){toast('这条后面你又说话了，只能重新生成最新那一轮回复');return;}}
  // 找到他这一轮回复的起点：从这条往前，连续的"他的"消息的开头
  let start=i;while(start>0&&list[start-1].role==='assistant')start--;
  // 删掉从起点到末尾他的整段回复，重新让ta回应你上一条
  replyTouch(cid,actId());list.splice(start);save();closeModal();
  if(cur().p==='chat'&&cur().id===cid)render();
  manualReply(cid);}
function recallMsg(cid,mid){const list=msgs(cid);const i=list.findIndex(x=>x.id===mid);if(i<0)return;
  const me=list[i].role==='user';list.splice(i,1);
  list.splice(i,0,{role:me?'user':'assistant',type:'sys',content:(me?'你':'对方')+'撤回了一条消息',time:Date.now(),id:uid()});
  save();closeModal();render();}
function editMsg(cid,mid){const m=msgs(cid).find(x=>x.id===mid);if(!m)return;if(m.role==='assistant'&&m.type==='voice'){editVoiceMessage(cid,mid);return;}
  openModal(`<h3>编辑消息</h3><div class="field"><textarea id="em_t" rows="3">${esc(m.content)}</textarea></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="(function(){var v=$('#em_t').value;var mm=msgs('${cid}').find(x=>x.id==='${mid}');mm.content=v;save();closeModal();render();})()">保存</button></div>`);}
function editVoiceMessage(cid,mid){const c=getC(cid),m=msgs(cid).find(x=>x.id===mid);if(!c||!m||m.role!=='assistant'||m.type!=='voice')return;if(voiceTtsPending(m)){toast('这条语音还在生成，请稍等');return;}const info=textToVoiceInfo(m.content,c),cost=ttsUseRelay(c)?'重新生成成功后会重新扣 '+info.points+' 点；原来已生成的点数不退回。':ttsApiOn(c)?'重新生成会再次调用这个角色选择的外置语音路线。':'使用系统语音，不扣AI点数。';
  openModal(`<h3>编辑角色语音</h3><div class="hint">可以只修改文字后保存，也可以立即用当前音色重新生成。重新生成的语音按新内容重新计费，旧语音不会重复使用。</div><div class="field"><label>语音内容（最多${VOICE_MAX_CHARS}字）</label><textarea id="evm_t" rows="5">${esc(m.content||'')}</textarea></div><div class="hint" style="color:#ffb0c8">${esc(cost)}</div><div class="btns"><button class="btn g" onclick="saveVoiceMessageEdit('${cid}','${mid}',false)">只保存文字</button><button class="btn p" onclick="saveVoiceMessageEdit('${cid}','${mid}',true)">保存并重新生成</button></div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
async function saveVoiceMessageEdit(cid,mid,regenerate){const c=getC(cid),m=msgs(cid).find(x=>x.id===mid),el=$('#evm_t');if(!c||!m||!el||_textToVoiceBusy.has(mid))return;const text=String(el.value||'').trim(),info=textToVoiceInfo(text,c);if(!text){toast('语音内容不能为空');return;}if(info.tooLong){toast('语音超过'+VOICE_MAX_CHARS+'字，请缩短后再生成');return;}_textToVoiceBusy.add(mid);clearVoiceAudio(m);m.content=text;m.dur=voiceEstimatedSeconds(text);m.voiceCue=ttsAutoCue(text,c)||'';m.edited=true;delete m._ttsFailAt;save();closeModal();if(cur().p==='chat'&&cur().id===cid)render();
  if(!regenerate){_textToVoiceBusy.delete(mid);toast('文字已保存；下次点语音会按新内容重新生成');return;}
  audioUnlock();if(!ttsApiOn(c)){_textToVoiceBusy.delete(mid);speakMsg(m,c);toast('已按新文字播放系统语音');return;}m._ttsLoading=true;m._playWhenReady=true;refreshVoiceBubble(m);const url=await warmVoiceMsg(m,c);_textToVoiceBusy.delete(mid);if(url){save();toast(ttsUseRelay(c)?'新语音已生成并重新扣点':'新语音已由角色的外置路线生成');}else{delete m._playWhenReady;delete m._ttsLoading;save();refreshVoiceBubble(m);toast('重新生成失败，新文字已保留，可以再次点击语音重试');}}
function showMood(id){const c=getC(id);syncVisibleMood(c);openModal(`<h3>${esc(c.remark||c.name)} 的心情</h3>
  <div class="hint" style="font-size:14px;color:#ddd;line-height:1.7">${esc(c.mood||'…')}</div>
  ${roleThinkingActionsHTML(c)}`);}
function showInnerThought(id){const c=getC(id);if(!c)return;openModal(`<h3>${esc(c.remark||c.name)}</h3>
  <div class="hint" style="font-size:14px;color:#ddd;line-height:1.7">${esc(visibleRoleThought(c)||'…')}</div>
  ${roleThinkingActionsHTML(c)}`);}
function c_mute(id){const c=getC(id);c.muted=!c.muted;save();render();}
/* MEMORY_MANUAL_ROLE_VIEW_V1（2026-10-30 她说：「我的…」开头的记忆一保存就变成 North 的）：她手动写的角色记忆是角色自己的视角，照原文保存，不再把「我」换成她的名字。 */
function memoryManualAdd(id,text){const c=getC(id),r=rememberForChar(c,text,{rolePerspective:true});if(r!=='none')save();if(r==='conflict')toast('这条和已有记忆不同，聊天时会先向你确认');editMemory(id);}
function memoryDeleteAt(id,i){const c=getC(id),list=memoryList(c),old=list[i];if(old==null)return;list.splice(i,1);delete memoryMetaStore(c)[memoryNorm(old)];save();editMemory(id);}
function memoryEditAt(id,i,text){const c=getC(id),list=memoryList(c),old=list[i],t=roleMemoryPerspectiveText(c,text),v=t?{text:t,rolePerspective:true}:'';if(!v){toast('内容为空，未保存');return;}delete memoryMetaStore(c)[memoryNorm(old)];list[i]=v;memoryMetaStore(c)[memoryNorm(v)]={createdAt:Date.now(),lastConfirmedAt:Date.now(),confidence:1,importance:3,scope:memoryScopeKey()};saveNow();editMemory(id);toast('记忆已保存');}
function editMemory(id){const c=getC(id),list=memoryList(c);
  openModal(`<h3>${esc(c.remark||c.name)} 的记忆</h3>
    <div class="hint">这里保存长期记忆。聊天时只会取当前话题真正相关的少量内容，不会把全部旧事硬塞进回复。</div>
    <div class="field"><textarea id="mem_new" rows="2" placeholder="手动添加一条记忆…"></textarea></div>
    <button class="btn p" style="margin-bottom:12px" onclick="memoryManualAdd('${id}',$('#mem_new').value.trim())">添加</button>
    ${list.length?list.map((m,i)=>`<div class="bill" style="border-radius:8px;margin-bottom:8px"><div style="flex:1">${esc(memoryText(m))}</div><div style="display:flex;align-items:center;gap:12px;white-space:nowrap;margin-left:12px"><button type="button" aria-label="编辑记忆" onclick="editMemItem('${id}',${i})" style="width:36px;height:36px;border-radius:10px;border:1px solid rgba(84,160,255,.28);background:rgba(84,160,255,.1);color:#6eb2ff;cursor:pointer;font-size:18px">✎</button><button type="button" aria-label="删除记忆" onclick="memoryDeleteAt('${id}',${i})" style="width:36px;height:36px;border-radius:10px;border:1px solid rgba(250,81,81,.28);background:rgba(250,81,81,.09);color:#ff7474;cursor:pointer;font-size:18px">✕</button></div></div>`).join(''):'<div class="empty">还没有记忆</div>'}
    <button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}
function editMemItem(id,i){const c=getC(id),list=memoryList(c);openModal(`<h3>编辑记忆</h3><div class="field"><textarea id="mi_t" rows="3">${esc(memoryText(list[i]))}</textarea></div>
  <div class="btns"><button class="btn g" onclick="editMemory('${id}')">返回</button><button class="btn p" onclick="memoryEditAt('${id}',${i},$('#mi_t').value.trim())">保存</button></div>`);}
function circleObj(id){const v=(S.x.circle||{})[id];if(!v)return{name:'',desc:''};if(typeof v==='string')return{name:'',desc:v};return v;}
function voiceOptions(sel){loadVoices();if(!_voices.length)return '<option value="">（系统语音加载中，重开一次设置）</option>';
  return '<option value="">默认</option>'+_voices.map(v=>`<option value="${esc(v.voiceURI)}" ${sel===v.voiceURI?'selected':''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');}
function voiceRouteFieldToggle(value){const key=String(value==null?'':value);document.querySelectorAll('[data-voice-route-field]').forEach(el=>{el.style.display=el.getAttribute('data-voice-route-field')===key?'block':'none';});}
function editVoice(id){const c=getC(id);const v=getVoice(c),own=ttsRoleRouteOwnIndex(c),selected=own==null?'':String(own),routes=ttsRoutesInit(),routeVoices=v.ttsRouteVoices||{};openModal(`<h3>${esc(c.remark||c.name)} 的音色</h3>
  <div class="hint">打开外置接口设置的“内置语音”后，仍优先使用外置接口设置当前音色。关闭内置语音后，这个角色可以跟随默认语音路线，也可以固定使用路线一至四；每条路线的角色音色ID会分开保存，不会串到另一个官网。</div>
  <div class="field"><label>引擎</label><select id="v_eng"><option value="system" ${v.engine!=='api'?'selected':''}>系统音色(免费)</option><option value="api" ${v.engine==='api'?'selected':''}>语音API(可克隆)</option></select></div>
  <div class="field"><label>系统音色</label><select id="v_uri">${voiceOptions(v.voiceURI)}</select></div>
  <div class="field"><label>语速 <b id="v_rate_n">${(+v.rate||1).toFixed(1)}</b></label><input id="v_rate" type="range" min="0.5" max="1.8" step="0.1" value="${v.rate||1}" oninput="$('#v_rate_n').textContent=(+this.value).toFixed(1)" style="width:100%"></div>
  <div class="field"><label>音调 <b id="v_pitch_n">${(+v.pitch||1).toFixed(1)}</b></label><input id="v_pitch" type="range" min="0.5" max="1.6" step="0.1" value="${v.pitch||1}" oninput="$('#v_pitch_n').textContent=(+this.value).toFixed(1)" style="width:100%"></div>
  <label class="voice-tune-row" for="v_api_tuning"><span class="voice-tune-text"><b>API音色使用上面的语速和音调</b><small>默认关闭，保持克隆音色原声；只有明确需要调音时再开启，避免旧角色突然变调</small></span><input id="v_api_tuning" type="checkbox" ${v.apiTuning===true?'checked':''}></label>
  <div class="field"><label>每句之间停顿 <b id="v_pause_n">${voicePauseSeconds(v).toFixed(1)}</b> 秒<small style="display:block;color:#888">连续通话会在两句之间真实等待；单条语音保留自然标点，不再插入省略号，避免结巴和重复词</small></label><input id="v_pause" type="range" min="0" max="3" step="0.1" value="${voicePauseSeconds(v)}" oninput="$('#v_pause_n').textContent=(+this.value).toFixed(1)" style="width:100%"></div>
  <div class="field"><label>语言（非普通话会带中文翻译）</label><select id="v_lang"><option value="zh" ${v.lang==='zh'?'selected':''}>中文</option><option value="粤" ${v.lang==='粤'?'selected':''}>粤语</option><option value="英" ${v.lang==='英'?'selected':''}>英语</option><option value="日" ${v.lang==='日'?'selected':''}>日语</option><option value="韩" ${v.lang==='韩'?'selected':''}>韩语</option><option value="法" ${v.lang==='法'?'selected':''}>法语</option><option value="德" ${v.lang==='德'?'selected':''}>德语</option><option value="俄" ${v.lang==='俄'?'selected':''}>俄语</option></select></div>
  <div class="field"><label>英语口音（仅英语有效）<small style="display:block;color:#888">API克隆音色仍以原始录音口音为主</small></label><select id="v_accent"><option value="auto" ${normVoiceAccent(v)==='auto'?'selected':''}>自动 · 跟随音色</option><option value="en-GB" ${normVoiceAccent(v)==='en-GB'?'selected':''}>英式英语 · British</option><option value="en-US" ${normVoiceAccent(v)==='en-US'?'selected':''}>美式英语 · American</option></select></div>
  <div class="field"><label>角色使用的外置语音路线<small style="display:block;color:#888">默认跟随设置中当前选中的路线；固定路线只影响这个角色</small></label><select id="v_route" onchange="voiceRouteFieldToggle(this.value)"><option value="" ${selected===''?'selected':''}>跟随当前默认路线</option>${routes.map((r,i)=>`<option value="${i}" ${selected===String(i)?'selected':''}>${TTS_ROUTE_NAMES[i]} · ${esc(ttsRouteSummary(r))}</option>`).join('')}</select></div>
  <div class="field" data-voice-route-field="" style="display:${selected===''?'block':'none'}"><label>跟随路线时的原有音色ID<small style="display:block;color:#888">兼容升级前的设置；如果该路线另存了专属音色，会优先使用专属音色</small></label><input id="v_tv_default" value="${esc(v.ttsVoice||'')}" placeholder="外置接口需要时填写，如克隆ID/alloy"></div>
  ${routes.map((r,i)=>`<div class="field" data-voice-route-field="${i}" style="display:${selected===String(i)?'block':'none'}"><label>${TTS_ROUTE_NAMES[i]}的角色音色ID<small style="display:block;color:#888">${esc(ttsRouteSummary(r))}；留空时使用这条路线设置里的默认音色</small></label><input id="v_tv_${i}" value="${esc(routeVoices[i]||'')}" placeholder="只属于这个角色和这条路线的音色ID"></div>`).join('')}
  <div class="btns" style="margin-bottom:8px"><button class="btn g" onclick="previewVoice('${id}')">试听</button><button class="btn g" onclick="cloneVoiceModal('${id}')">克隆声音(国内·硅基流动)</button></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="saveVoice('${id}')">保存</button></div>`);}
function readVoiceForm(){const raw=String(($('#v_route')||{}).value||''),own=/^[0-3]$/.test(raw)?+raw:null,map={};for(let i=0;i<TTS_ROUTE_NAMES.length;i++){const el=$('#v_tv_'+i),val=String(el&&el.value||'').trim();if(val)map[i]=val;}return {engine:$('#v_eng').value,voiceURI:$('#v_uri').value,rate:+$('#v_rate').value||1,pitch:+$('#v_pitch').value||1,apiTuning:!!($('#v_api_tuning')&&$('#v_api_tuning').checked),pause:Math.max(0,Math.min(3,+$('#v_pause').value||0)),lang:$('#v_lang').value,accent:$('#v_accent').value,ttsVoice:String((($('#v_tv_default')||{}).value)||'').trim(),ttsRouteIndex:own,ttsRouteVoices:map};}
async function previewVoice(id){audioUnlock();const c=getC(id);if(!c)return false;const nv=readVoiceForm(),samp={zh:'你好呀，我是'+(c.remark||c.name)+'，这是我的声音。','粤':'你好呀，我係'+(c.remark||c.name)+'，呢把就係我把聲。','英':'Hi, this is my voice. Nice to talk with you.','日':'こんにちは、これが私の声です。よろしくね。','韩':'안녕하세요, 제 목소리예요. 잘 부탁해요.','法':'Bonjour, voici ma voix. Je suis ravi de vous parler.','德':'Hallo, das ist meine Stimme. Schön, mit dir zu sprechen.','俄':'Привет, это мой голос. Я рад с тобой поговорить.'}[nv.lang||'zh'];
  const tmp=c.voice;c.voice=nv;try{if(nv.engine==='api'&&!ttsApiOn(c)){toast(ttsRoleRouteOwnIndex(c)==null?'请先在设置里启用并保存外置语音API':'这个角色选择的语音路线还没有完整配置');return false;}const ok=await speak(samp,c);if(ok)toast('试听已按这个角色的路线播放');else toast('试听没有播放出来，请查看刚才的语音接口提示');return ok;}finally{c.voice=tmp;}}
function saveVoice(id){const c=getC(id),old=c.voice,nv=readVoiceForm();c.voice=nv;if(nv.engine==='api'&&ttsRoleRouteOwnIndex(c)!=null&&!ttsApiOn(c)){c.voice=old;toast('这个角色选择的语音路线还没有完整配置，未保存');return false;}phState().stranger.lang=c.voice.lang||'zh';save();closeModal();render();toast('音色与角色语音路线已保存');return true;}
/* 在 App 内直接克隆声音（硅基流动 CosyVoice，国内不用梯子） */
function cloneVoiceModal(id){const c=getC(id),tts=ttsCfg(c);
  if(!/siliconflow/i.test(tts.base||'')||!tts.key){
    openModal(`<h3>先填硅基流动接口</h3><div style="font-size:14px;line-height:1.9;color:#e6e6e6">克隆前先去 <b>设置 → 语音API</b> 填好这三样（一次就行）：<br><br>接口地址：<b>https://api.siliconflow.cn/v1</b><br>API Key：硅基流动控制台里新建的那串<br>模型：<b>FunAudioLLM/CosyVoice2-0.5B</b><br><br>填好保存，再回这里点「克隆声音」。</div>
    <div class="btns" style="margin-top:12px"><button class="btn g" onclick="editVoice('${id}')">返回</button><button class="btn p" onclick="closeModal();openSettings('voice')">去填接口</button></div>`);return;}
  openModal(`<h3>克隆声音 · 硅基流动</h3>
   <div style="font-size:13px;line-height:1.85;color:#cfcfcf">①传一段想克隆的人声（10~30 秒、清晰、没背景音/音乐最好）<br>②把这段录音"说了哪些字"一字不差打在下面（CosyVoice 靠这个学声音）<br>生成后会自动设成<b>这个角色</b>的音色。</div>
   <div class="field" style="margin-top:10px"><label>声音文件（mp3 / wav / m4a）</label><input id="cl_f" type="file" accept="audio/*"></div>
   <div class="field"><label>这段录音说的内容（必填，要和音频一致）</label><textarea id="cl_t" rows="3" placeholder="例：你好呀，今天天气真不错，很高兴见到你。"></textarea></div>
   <div class="btns"><button class="btn g" onclick="editVoice('${id}')">返回</button><button class="btn p" id="cl_go" onclick="doCloneVoice('${id}')">开始克隆</button></div>`);}
async function doCloneVoice(id){const c=getC(id);if(!c)return;const tts=ttsCfg(c);
  const f=(($('#cl_f')||{}).files||[])[0];const txt=(($('#cl_t')||{}).value||'').trim();
  if(!f){toast('先选一段声音文件');return;}if(!txt){toast('把录音说的内容填上');return;}
  const btn=$('#cl_go');if(btn){btn.disabled=true;btn.textContent='克隆中…';}
  try{const dataURL=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});
    const model=(/cosyvoice|fish/i.test(tts.model||'')?tts.model:'FunAudioLLM/CosyVoice2-0.5B');
    const body={model,customName:'yb'+Math.random().toString(36).slice(2,9),text:txt,audio:dataURL};
    const r=await fetch('https://api.siliconflow.cn/v1/uploads/audio/voice',{method:'POST',headers:{'Authorization':'Bearer '+tts.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>null);
    if(!r.ok||!j||!j.uri){toast('克隆失败 '+r.status+' '+((j&&(j.message||j.error||j.detail))||'')); if(btn){btn.disabled=false;btn.textContent='开始克隆';}return;}
    const routeIndex=ttsRoleRouteIndex(c),routes=ttsRoutesInit();routes[routeIndex].model=model;if(routeIndex===S.settings.ttsRouteActive)S.settings.tts.model=model;
    c.voice=c.voice||getVoice(c);c.voice.engine='api';c.voice.ttsRouteVoices=c.voice.ttsRouteVoices||{};c.voice.ttsRouteVoices[routeIndex]=j.uri;save();
    closeModal();toast('克隆成功！已保存到这个角色的'+TTS_ROUTE_NAMES[routeIndex]);setTimeout(()=>editVoice(id),250);
  }catch(e){toast('克隆出错，检查网络/接口地址');if(btn){btn.disabled=false;btn.textContent='开始克隆';}}}
function editCircle(id){S.x.circle=S.x.circle||{};const co=circleObj(id);openModal(`<h3>𝕏 圈子</h3><div class="hint">圈子名称=ta所在的圈子/标签；定位=ta发推的人设风格。</div>
  <div class="field"><label>圈子名称</label><input id="cir_n" value="${esc(co.name)}" placeholder="如：医学圈 / 摄影圈"></div>
  <div class="field"><label>圈子定位/风格</label><textarea id="cir_t" rows="3" placeholder="比如：高冷医学博主，偶尔发暗恋小作文">${esc(co.desc)}</textarea></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="(function(){S.x.circle['${id}']={name:$('#cir_n').value.trim(),desc:$('#cir_t').value.trim()};save();closeModal();render();toast('已保存');})()">保存</button></div>`);}
function editSummary(id){const c=getC(id),o=S.offline&&S.offline[id]||{},arr=summaryList(c);pruneSummaries(c);save();
  const cap=(+S.settings.memCap)||100,model=S.settings.summaryModel==='aux'?'aux':'main',manualBusy=_manualWechatSummaryBusy.has(id+'#'+memoryScopeKey());const autoOn=S.settings.memAutoClean!==false;const stars=n=>{n=n||3;return '★'.repeat(n)+'☆'.repeat(5-n);};
  openModal(`<h3>对话总结（长期记忆）</h3><div class="hint">每段聊天会自动概括成一条，ta会按重要度打 1-5 星（★越多越珍贵）。<b>自动清理只在条数超过上限时才动手</b>，从最低星开始删，<b>5星永远保留</b>；想立刻清掉不重要的，用下面的「清理低星」。点★可改星级。</div>
  <div class="section" style="margin:0 0 10px"><div class="it"><span>微信自动总结模型</span><select onchange="S.settings.summaryModel=this.value;save();editSummary('${id}')" style="background:#2c2c2e;border:1px solid #38383a;color:#eee;border-radius:6px;padding:5px"><option value="main" ${model==='main'?'selected':''}>主模型</option><option value="aux" ${model==='aux'?'selected':''}>副模型</option></select></div><div class="it"><span>手动总结<br><small style="color:#888">只整理尚未总结的新微信</small></span><button class="minibtn" ${manualBusy?'disabled':''} onclick="manualWechatSummary('${id}')">${manualBusy?'总结中…':'立即总结'}</button></div></div>
  <div class="section" style="margin:0 0 10px"><div class="it"><span>自动清理</span><span class="v"><label style="cursor:pointer"><input type="checkbox" ${autoOn?'checked':''} onclick="S.settings.memAutoClean=this.checked;save();editSummary('${id}')"> 开</label></span></div>
    <div class="it"><span>记忆上限（条）</span><span class="v"><input id="mcap" type="number" min="20" max="1000" value="${cap}" style="width:60px;text-align:center;border:1px solid #38383a;border-radius:6px;padding:4px;background:#2c2c2e;color:#eee"> <button class="minibtn" onclick="(function(){var v=Math.max(20,Math.min(1000,+$('#mcap').value||100));S.settings.memCap=v;save();var cc=getC('${id}');pruneSummaries(cc);save();editSummary('${id}');})()">存</button></span></div>
    <div class="it"><span>清理低星<br><small style="color:#888">立刻清掉不重要的，不用等到满；5星永远保留</small></span><span class="v"><button class="minibtn" onclick="wechatMemoryPruneLowStars('${id}',1)">清1星</button> <button class="minibtn" onclick="wechatMemoryPruneLowStars('${id}',2)">清2星及以下</button> <button class="minibtn" onclick="wechatMemoryPruneLowStars('${id}',3)">清3星及以下</button></span></div>
    <div class="it"><span>当前账号 ${arr.length} 条</span><span class="v"><button class="minibtn" onclick="(function(){var cc=getC('${id}');pruneSummaries(cc,null,{force:true});save();editSummary('${id}');toast('已清理当前账号低星记忆');})()">立即清理低星</button></span></div></div>
  <div class="field"><textarea id="sm_new" rows="2" placeholder="手动写一条概要…"></textarea></div>
  <button class="btn p" style="margin-bottom:12px" onclick="(function(){var v=$('#sm_new').value.trim();if(v){addSummary(getC('${id}'),v,3);editSummary('${id}');}})()">添加</button>
  ${arr.length?arr.slice().reverse().map((x,ri)=>{const i=arr.length-1-ri,oh=x&&x.offlineId&&(o.history||[]).find(h=>offHistoryHasMemory(h,x.offlineId)&&h.msgs&&h.msgs.length),head=oh&&offHistoryMemoryIds(oh)[0]===x.offlineId,clean=summaryCleanText(c,x.text),body=`<details style="margin-top:4px"><summary style="cursor:pointer;color:#8f9fb2">${oh?'查看这条约会重点':'查看这条总结'}（${Array.from(clean).length}字）</summary><div style="padding-top:6px;white-space:pre-wrap">${esc(clean)}</div></details>`;return `<div class="bill" style="border-radius:8px;margin-bottom:8px"><div style="flex:1;min-width:0"><small style="color:#888">${esc(x.time)}　<span onclick="sumSetImp('${id}',${i})" style="color:#f5b301;cursor:pointer" title="点击改重要度">${stars(x.imp)}</span></small>${body}${head?`<button class="minibtn" style="margin-top:7px" onclick="offRetrySummary('${id}','${oh.id}')">重新总结这场约会</button>`:''}</div><div style="display:flex;align-items:center;gap:12px;white-space:nowrap;margin-left:12px"><button type="button" aria-label="编辑对话总结" onclick="editSumItem('${id}',${i})" style="width:36px;height:36px;border-radius:10px;border:1px solid rgba(84,160,255,.28);background:rgba(84,160,255,.1);color:#6eb2ff;cursor:pointer;font-size:18px">✎</button><button type="button" aria-label="删除对话总结" onclick="summaryDeleteAt('${id}',${i})" style="width:36px;height:36px;border-radius:10px;border:1px solid rgba(250,81,81,.28);background:rgba(250,81,81,.09);color:#ff7474;cursor:pointer;font-size:18px">✕</button></div></div>`;}).join(''):'<div class="empty">当前账号还没有总结</div>'}
  <button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}
function sumSetImp(id,i){const c=getC(id),x=c&&summaryList(c)[i];if(!x)return;const v=prompt('这条记忆的重要度（1-5，5最珍贵·永久保留）：',x.imp||3);if(v==null)return;const n=Math.max(1,Math.min(5,parseInt(v,10)||3));x.imp=n;if(isMain()&&x.offlineId){const o=S.offline&&S.offline[id],m=o&&(o.memory||[]).find(v=>v&&typeof v==='object'&&v.id===x.offlineId);if(m)m.imp=n;}saveNow();editSummary(id);}
function summaryDeleteAt(id,i){const c=getC(id),arr=c&&summaryList(c);if(!arr||!arr[i])return;arr.splice(i,1);save();editSummary(id);}
function summaryEditAt(id,i,text){const c=getC(id),x=c&&summaryList(c)[i];if(!x)return;const v=(''+(text||'')).replace(/\s+/g,' ').trim();if(!v){toast('内容为空，未保存');return;}x.text=summaryCleanText(c,v);x.ts=Date.now();x.time=x.time||sumStamp();x.accountId=actId();saveNow();editSummary(id);toast('概要已保存');}
function editSumItem(id,i){const c=getC(id),x=c&&summaryList(c)[i];if(!x)return;openModal(`<h3>编辑这条概要</h3><div class="field"><small style="color:#888">${esc(x.time)}</small><textarea id="si_t" rows="3">${esc(x.text)}</textarea></div>
  <div class="btns"><button class="btn g" onclick="editSummary('${id}')">返回</button><button class="btn p" onclick="summaryEditAt('${id}',${i},$('#si_t').value)">保存</button></div>`);}

/* =================== 通话 =================== */
const CALL_END_TOMBSTONE_KEY='yibei_call_end_v1';
const CALL_ROLE_LOOP_VIDEO_ACCEPT='.mp4,.m4v,.mov,.webm,video/mp4,video/quicktime,video/webm,video/*';
const CALL_ROLE_LOOP_VIDEO_MAX_BYTES=512*1024*1024;
let _call=null,_ring=null,_ringPreviewTimer=null,_ringLoadToken=0,_ringOwnedUrl='',_callTimer=null,_callSilTimer=null,_callMissT=null,_callSystemNoticeTimer=null,_callSystemNoticeToken=0;
let _callRoleLoopLoadToken=0,_callRoleLoopUrl='',_callRoleLoopKey='',_callRoleLoopIdentity='',_callRoleLoopPosition=0,_callRoleLoopHiddenResume=false;
function roleCallLoopVideoMeta(c){const x=c&&c.callLoopVideo;return x&&x.key?x:null;}
function roleCallLoopVideoPick(id){pickFile(CALL_ROLE_LOOP_VIDEO_ACCEPT,f=>roleCallLoopVideoSave(id,f));}
function roleCallLoopVideoProbe(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),v=document.createElement('video');let done=false,timer=null;const finish=(ok,e)=>{if(done)return;done=true;if(timer)clearTimeout(timer);try{v.pause();v.removeAttribute('src');v.load();}catch(_){}try{URL.revokeObjectURL(url);}catch(_){}ok?resolve({duration:Number(v.duration)||0,width:+v.videoWidth||0,height:+v.videoHeight||0}):reject(e||new Error('video metadata unavailable'));};v.preload='metadata';v.muted=true;v.playsInline=true;v.onloadedmetadata=()=>finish(v.videoWidth>0&&v.videoHeight>0,new Error('not a playable video'));v.onerror=()=>finish(false,new Error('video decode failed'));timer=setTimeout(()=>finish(false,new Error('video metadata timeout')),15000);v.src=url;try{v.load();}catch(e){finish(false,e);}});}
async function roleCallLoopVideoSave(id,file){const c=getC(id);if(!c||!file)return;const name=String(file.name||'角色视频'),ext=/\.(mp4|m4v|mov|webm)$/i.test(name),mime=/^video\//i.test(String(file.type||''));if(!ext&&!mime){toast('请选择 MP4、MOV、M4V 或 WebM 视频');return;}if(!file.size){toast('这个视频文件是空的');return;}if(file.size>CALL_ROLE_LOOP_VIDEO_MAX_BYTES){toast('视频不能超过 512 MB');return;}try{if(navigator.storage&&navigator.storage.estimate){const e=await navigator.storage.estimate(),free=Math.max(0,(+e.quota||0)-(+e.usage||0));if(free&&free<file.size+32*1024*1024){toast('当前设备空间不足，请先释放存储空间');return;}}await roleCallLoopVideoProbe(file);}catch(_){toast('当前设备无法播放这个视频，请改用 MP4/H.264');return;}const key='__role_call_loop_v1_'+String(id).replace(/[^A-Za-z0-9_-]/g,'_')+'_'+Date.now()+'_'+uid(),old=roleCallLoopVideoMeta(c);try{await imgPut(key,file);const stored=await imgGet(key);if(!stored||+stored.size!==+file.size)throw new Error('video verify failed');c.callLoopVideo={key,name:name.slice(0,180),type:String(file.type||''),size:+file.size||0,updatedAt:Date.now()};if(await saveNowAsync()===false)throw new Error('state save failed');if(old&&old.key&&old.key!==key)await imgDel(old.key);if(_call&&_call.id===id){callRoleLoopRelease();renderCall();}else render();toast('视频已保存；通话中将静音循环播放');}catch(e){if(old)c.callLoopVideo=old;else delete c.callLoopVideo;await imgDel(key);try{await saveNowAsync();}catch(_){}toast('视频保存失败，原视频没有被替换');}}
async function roleCallLoopVideoRemove(id){const c=getC(id),old=roleCallLoopVideoMeta(c);if(!c||!old)return;if(!await uiConfirm('移除这个角色的视频通话循环画面？'))return;delete c.callLoopVideo;try{if(await saveNowAsync()===false)throw new Error('state save failed');await imgDel(old.key);}catch(_){c.callLoopVideo=old;try{await saveNowAsync();}catch(__){}toast('视频移除失败，原视频仍然保留');return;}if(_call&&_call.id===id){callRoleLoopRelease();renderCall();}else render();toast('已恢复为角色头像');}
function callEndTombstoneRead(){let row=S._callEndedTombstone||null;try{const local=JSON.parse(localStorage.getItem(CALL_END_TOMBSTONE_KEY)||'null');if(local&&(!row||+local.endedAt>+row.endedAt))row=local;}catch(_){}return row&&row.session?row:null;}
function callEndTombstoneWrite(session){session=String(session||'');if(!session)return null;const row={session,endedAt:Date.now()};S._callEndedTombstone=row;try{localStorage.setItem(CALL_END_TOMBSTONE_KEY,JSON.stringify(row));}catch(_){}return row;}
function callEndedBeforeRestore(p){const row=callEndTombstoneRead();return !!(row&&p&&String(row.session)===String(p.session||'')&&+row.endedAt>=+(p.start||0));}
function callPersist(){
  if(_call&&_call.state==='active'){
    S._activeCall={
      id:_call.id,accountId:_call.accountId||actId(),kind:_call.kind,dir:_call.dir||(_call.state==='incoming'?'incoming':'outgoing'),state:'active',
      start:_call.start||Date.now(),lastUserTs:_call.lastUserTs||Date.now(),silentStage:_call.silentStage||0,bgHold:!!_call._bgHold,
      lull:!!_call.lull,sleepStartedAt:+_call.sleepStartedAt||0,lastSleep:_call.lastSleep||null,afkUntil:_call.afkUntil||0,min:!!_call.min,replyVoice:_call.replyVoice!==false,roleVisualExpanded:!!_call.roleVisualExpanded,spyChecks:Array.isArray(_call.spyChecks)?_call.spyChecks.slice(-8):[],visualHistory:Array.isArray(_call.visualHistory)?_call.visualHistory.slice(-10):[],
      session:_call.session||uid(),sub:_call.sub||null,mpos:_call._mpos||null,screenSharing:!!_call.screenSharing,savedAt:Date.now()
    };
    save(0);
  }else callClearPersist();
}
function callClearPersist(endedSession){if(endedSession)callEndTombstoneWrite(endedSession);if(S._activeCall)delete S._activeCall;if(endedSession)saveNowAsync().catch(()=>{});else save(0);}
function restoreActiveCall(){
  const p=S._activeCall;if(!p||_call||p.state!=='active')return;
  if(callEndedBeforeRestore(p)){delete S._activeCall;saveNowAsync().catch(()=>{});return;}
  const c=getC(p.id);if(!c||c.blocked||Date.now()-(p.savedAt||p.start||0)>12*3600000){callClearPersist();return;}
  _call={id:p.id,accountId:p.accountId||actId(),kind:p.kind||'voice',state:'active',dir:p.dir||'outgoing',opened:true,replyVoice:p.replyVoice!==false,session:p.session||uid(),sub:p.sub||null,start:p.start||Date.now(),lastUserTs:Date.now(),silentStage:0,lull:!!p.lull,sleepStartedAt:+p.sleepStartedAt||0,lastSleep:p.lastSleep||null,afkUntil:p.afkUntil||0,min:!!p.min,screenSharing:!!p.screenSharing,roleVisualExpanded:!!p.roleVisualExpanded,spyChecks:Array.isArray(p.spyChecks)?p.spyChecks.slice(-8):[],visualHistory:Array.isArray(p.visualHistory)?p.visualHistory.slice(-10):[]};
  if(p.mpos)_call._mpos=p.mpos;
  clearInterval(_callTimer);_callTimer=setInterval(renderCallTime,1000);
  clearInterval(_callSilTimer);_callSilTimer=setInterval(checkCallSilence,15000);
  hideCallBanner();renderCall();callNativePiPStart();roleServerPushCallStarted(p.id);setTimeout(()=>toast('已恢复后台通话'),300);
}
function callBackgroundHold(){if(_call&&_call.state==='active'){_call._bgHold=true;_call.lastUserTs=Date.now();_call.silentStage=0;callPersist();}}
function callResumeHold(){if(_call&&_call.state==='active'){if(_call._bgHold){_call._bgHold=false;_call.lastUserTs=Date.now();_call.silentStage=0;callPersist();renderCallTime();}return;}restoreActiveCall();}
let _callBusy=false,_callPend=null,_callVisionPend=[],_callStatePend=null,_callStateEpoch=0;/* 通话回复串行锁；共享状态和新画面使用独立高优先队列，不能被普通话语覆盖 */
/* ===== 视频通话真实画面：摄像头与屏幕共享只在用户主动打开后取流；只保存文字描述，不保存截图 ===== */
let _callCameraStream=null,_callCameraFacing='user',_callCameraTimer=null,_callCameraVisionBusy=false,_callCameraToken=0,_callCameraVisionState='',_callCameraVisionFailureTimer=null,_callCameraVisionPend=[],_callCameraRepairToken=0,_callCameraRepairBusy=false;
let _callScreenStream=null,_callScreenNative=false,_callScreenToken=0,_callScreenStatusPollToken=0,_callScreenPending='',_callScreenRealtimeTimer=null,_callScreenRealtimeKick=null,_callScreenRealtimeBusy=false,_callScreenRealtimeSignature='',_callScreenRealtimeSequence=0,_callScreenObserveMode='off',_callScreenNextDelay=8000,_callScreenNextAt=0;
function videoVisionIntervalMin(){const current=Number(S.settings&&S.settings.videoVisionIntervalMin);if(Number.isFinite(current))return Math.max(0,Math.min(60,Math.round(current)));const legacy=Number(S.settings&&S.settings.videoVisionIntervalSec);return Number.isFinite(legacy)?(legacy<=0?0:Math.max(1,Math.min(60,Math.round(legacy/60)))):0;}
function videoVisionMaxPerCall(){const n=Number(S.settings&&S.settings.videoVisionMaxPerCall);return Number.isFinite(n)?Math.max(1,Math.min(100,Math.round(n))):6;}
function screenShareAvailable(){return privateNativeAppOn();}
function screenShareRealtimeVisionOn(){return screenShareAvailable()&&!!(S.settings&&S.settings.screenShareRealtimeVision);}
function screenShareRealtimeVisionToggle(el){S.settings.screenShareRealtimeVision=!screenShareRealtimeVisionOn();save();callScreenAutonomyReset(screenShareRealtimeVisionOn()&&callScreenShareOn());callScreenRealtimeArm();if(el){el.classList.toggle('on',screenShareRealtimeVisionOn());el.setAttribute('aria-checked',screenShareRealtimeVisionOn()?'true':'false');}else render();toast(S.settings.screenShareRealtimeVision?'实时共享理解已开启':'实时共享理解已关闭');}
function screenShareSpeechVisionOn(){return screenShareAvailable()&&!!(S.settings&&S.settings.screenShareSpeechVision);}
function screenShareSpeechVisionToggle(el){S.settings.screenShareSpeechVision=!screenShareSpeechVisionOn();save();callScreenRealtimeStop(false);callScreenAutonomyReset(screenShareRealtimeVisionOn()&&callScreenShareOn()&&!screenShareSpeechVisionOn());callVideoVisionArm();callScreenRealtimeArm();if(el){el.classList.toggle('on',screenShareSpeechVisionOn());el.setAttribute('aria-checked',screenShareSpeechVisionOn()?'true':'false');}else renderCall();toast(S.settings.screenShareSpeechVision?'已开启：每说一句看一次共享画面':'已恢复原来的共享识别逻辑');}
function callVideoVisionAsked(text){return !!(_call&&_call.state==='active'&&(_call.kind==='video'||callScreenShareOn())&&/你\s*(?:看|瞧)(?:一?下|一?眼|看)?|看\s*(?:一?下|一?眼)?\s*(?:这个|这边|这里|镜头|画面|东西)|看看\s*(?:这个|这边|这里|镜头|画面|东西)|帮我看|给你看/i.test(String(text||'')));}
function callScreenShareOn(){return !!(screenShareAvailable()&&_callScreenNative);}
function callVideoSourceOn(){return callScreenShareOn()||callVideoCameraOn();}
function callVideoVisionCanAnalyze(trigger){const manual=trigger&&trigger!=='auto';return !!(_call&&callVideoSourceOn()&&(manual||(!_callCameraVisionBusy&&!_callVisionPend.length&&Math.max(0,+_call.videoVisionCount||0)<videoVisionMaxPerCall())));}
function callVisualHistoryRemember(source,desc){if(!_call||_call.state!=='active')return false;desc=String(desc||'').replace(/\s+/g,' ').trim().slice(0,700);if(!desc)return false;const rows=Array.isArray(_call.visualHistory)?_call.visualHistory:[],kind=source==='屏幕共享'?'screen':'camera',last=rows[rows.length-1],key=desc.toLowerCase().replace(/[\s，。！？!?、；;：“”"'（）()【】\[\]]/g,'').slice(0,260);if(last&&last.kind===kind&&last.key===key){last.at=Date.now();last.desc=desc;}else rows.push({at:Date.now(),kind,desc,key});_call.visualHistory=rows.slice(-10);callPersist();return true;}
function callVisualHistoryPrompt(currentDesc){if(!_call)return'';const rows=(Array.isArray(_call.visualHistory)?_call.visualHistory:[]).filter(x=>x&&x.desc).slice(-10);if(!rows.length)return'';currentDesc=String(currentDesc||'').replace(/\s+/g,' ').trim();const lines=rows.map((x,i)=>'· '+factStamp(+x.at||Date.now())+' ['+(x.kind==='screen'?'屏幕共享':'摄像头')+(currentDesc&&i===rows.length-1&&String(x.desc)===currentDesc?'｜本轮当前画面':'｜此前画面')+'] '+String(x.desc).slice(0,700));return'\n\n# 本通电话真实视觉观察记录\n'+lines.join('\n')+'\n这些都是你在本通电话里确实看过的画面文字记录，所以用户后来提到“刚才那个页面/之前看到的内容”时你必须记得并能自然承接。只有明确标成【本轮当前画面】的一条才代表此刻仍可见；其余都只是过去看过，不能冒充当前画面，也不能补写记录之外的细节。不要向用户解释记录、识图、模型或系统。';}
function callVideoVisionStatus(state){_callCameraVisionState=state==='working'?'working':state==='failed'?'failed':'';clearTimeout(_callCameraVisionFailureTimer);_callCameraVisionFailureTimer=null;const el=$('#callVisionStatus');if(el){el.className='call-camera-vision'+(_callCameraVisionState?' '+_callCameraVisionState:'');el.textContent=_callCameraVisionState==='failed'?'失败':'';el.setAttribute('aria-label',_callCameraVisionState==='working'?'正在识别画面':_callCameraVisionState==='failed'?'画面识别失败':'');}if(_callCameraVisionState==='failed')_callCameraVisionFailureTimer=setTimeout(()=>{if(_callCameraVisionState==='failed')callVideoVisionStatus('');},2200);}
function callVideoCameraOn(){return !!(_callCameraStream&&_callCameraStream.getVideoTracks&&_callCameraStream.getVideoTracks().some(t=>t.readyState==='live'));}
function callVideoCameraAttach(){const v=$('#callCameraPreview');if(!v||!callVideoCameraOn())return false;try{if(v.srcObject!==_callCameraStream)v.srcObject=_callCameraStream;const p=v.play();if(p&&typeof p.catch==='function')p.catch(()=>{});return true;}catch(_){return false;}}
function callVideoCameraVerifyAfterSpeech(){if(!privateNativeAppOn()||!_call||_call.kind!=='video'||_call.state!=='active'||!callVideoCameraOn()||callScreenShareOn()||typeof document!=='undefined'&&document.hidden)return false;const stream=_callCameraStream,v=$('#callCameraPreview'),sess=_call.session;if(!v||v.readyState<2)return false;const before=Math.max(0,Number(v.currentTime)||0),token=++_callCameraRepairToken;setTimeout(async()=>{const live=$('#callCameraPreview');if(token!==_callCameraRepairToken||_callCameraRepairBusy||!_call||_call.session!==sess||_callCameraStream!==stream||live!==v||!callVideoCameraOn()||callScreenShareOn()||typeof document!=='undefined'&&document.hidden)return;if((Number(v.currentTime)||0)>before+.08)return;_callCameraRepairBusy=true;try{try{v.pause();v.srcObject=null;v.srcObject=stream;const play=v.play();if(play&&typeof play.catch==='function')await play.catch(()=>{});}catch(_){}await sleep(100);const retryBase=Math.max(0,Number(v.currentTime)||0);await sleep(750);if(token!==_callCameraRepairToken||!_call||_call.session!==sess||_callCameraStream!==stream||$('#callCameraPreview')!==v||!callVideoCameraOn()||callScreenShareOn())return;if((Number(v.currentTime)||0)<=retryBase+.08){const ok=await callVideoCameraStart(_callCameraFacing,{quiet:true,repair:true});if(!ok&&_call&&_call.session===sess)toast('摄像头画面自动恢复失败，请重新打开摄像头');}}finally{_callCameraRepairBusy=false;}},1250);return true;}
function callVideoVisionArm(){clearInterval(_callCameraTimer);_callCameraTimer=null;const min=videoVisionIntervalMin(),sess=_call&&_call.session;if(!min||!sess||!callVideoSourceOn()||(callScreenShareOn()&&(screenShareRealtimeVisionOn()||screenShareSpeechVisionOn())))return;_callCameraTimer=setInterval(()=>{if(!videoVisionIntervalMin()||!_call||_call.session!==sess||(_call.kind!=='video'&&!callScreenShareOn())||_call.state!=='active'||!callVideoSourceOn()||(callScreenShareOn()&&(screenShareRealtimeVisionOn()||screenShareSpeechVisionOn()))){clearInterval(_callCameraTimer);_callCameraTimer=null;return;}callVideoVisionAnalyze('auto');},min*60000);}
function callVideoCameraArm(){callVideoVisionArm();}
function callVideoCameraStop(reason){_callCameraToken++;_callCameraRepairToken++;_callCameraRepairBusy=false;if(!callScreenShareOn()){clearInterval(_callCameraTimer);_callCameraTimer=null;}_callCameraVisionBusy=false;_callCameraVisionPend=[];callVideoVisionStatus('');const stream=_callCameraStream;_callCameraStream=null;try{stream&&stream.getTracks().forEach(t=>t.stop());}catch(_){}const v=$('#callCameraPreview');if(v)try{v.srcObject=null;}catch(_){}if(_call&&reason!=='replace')renderCall();return true;}
async function callVideoCameraStart(facing,opt){opt=opt||{};if(!_call||_call.kind!=='video'||_call.state!=='active')return false;if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){if(!opt.quiet)toast('这台设备或浏览器不支持打开摄像头');return false;}const sess=_call.session,token=++_callCameraToken;callVideoCameraStop('replace');_callCameraToken=token;_callCameraFacing=facing==='environment'?'environment':'user';try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:_callCameraFacing},width:{ideal:1280},height:{ideal:720}},audio:false});if(token!==_callCameraToken||!_call||_call.session!==sess){stream.getTracks().forEach(t=>t.stop());return false;}_callCameraStream=stream;stream.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>{if(_callCameraStream===stream)callVideoCameraStop('ended');},{once:true}));renderCall();setTimeout(callVideoCameraAttach,0);callVideoCameraArm();if(!opt.quiet)toast(_callCameraFacing==='environment'?'后置摄像头已打开':'前置摄像头已打开');return true;}catch(e){if(token===_callCameraToken){_callCameraStream=null;renderCall();if(!opt.quiet){const name=String(e&&e.name||'');toast(/NotAllowed|Security/.test(name)?'没有取得摄像头权限，请在系统设置中允许':'摄像头打开失败，请检查是否被其他 App 占用');}}return false;}}
function callVideoCameraToggle(){if(callVideoCameraOn())callVideoCameraStop('user');else callVideoCameraStart(_callCameraFacing);}
function callVideoCameraFlip(){if(!_call||_call.kind!=='video'||_call.state!=='active')return;callVideoCameraStart(_callCameraFacing==='user'?'environment':'user');}
function callScreenShareAttach(){const v=$('#callScreenPreview');if(!v||!_callScreenStream)return false;try{if(v.srcObject!==_callScreenStream)v.srcObject=_callScreenStream;const p=v.play();if(p&&typeof p.catch==='function')p.catch(()=>{});return true;}catch(_){return false;}}
function callScreenRealtimeStop(reset){clearTimeout(_callScreenRealtimeTimer);clearTimeout(_callScreenRealtimeKick);_callScreenRealtimeTimer=null;_callScreenRealtimeKick=null;_callScreenRealtimeBusy=false;_callScreenNextAt=0;if(reset!==false){_callScreenRealtimeSignature='';_callScreenRealtimeSequence=0;}}
function callScreenAutonomyReset(active){callScreenRealtimeStop(true);_callScreenObserveMode=active?'observing':'off';_callScreenNextDelay=8000;}
function callScreenReadyPhrase(text){return /(?:已经)?(?:打开|切好|换好|弄好|准备好)(?:了|啦)?|给你看(?:吧|了)?|就这个(?:页面|画面)?|现在可以看/i.test(String(text||''));}
function callScreenAutonomyUserAnswered(text,meta){if(callVideoVisionAsked(text))return false;if(_callScreenObserveMode==='waiting-screen'&&callScreenReadyPhrase(text)){_callScreenObserveMode='observing';_callScreenRealtimeSignature='';_callScreenRealtimeSequence=0;callScreenRealtimeStop(false);const token=String(meta&&meta.screenFrameToken||'');if(token)setTimeout(()=>callVideoVisionAnalyze('live','',{screenFrameToken:token}),80);else callScreenRealtimeArm(false,250);return'frame';}if(_callScreenObserveMode!=='waiting')return false;_callScreenObserveMode='answering';callScreenRealtimeStop(false);return'answer';}
function callScreenAutonomyReadDecision(content){let decision='',nextSeconds=0;const text=String(content||'').replace(/[\[【]\s*共享观察\s*[|｜:：]\s*(继续|提问|等待切换|结束)(?:\s*[|｜:：]\s*(\d{1,3}))?\s*[\]】]/g,(m,d,n)=>{if(!decision){decision=d;nextSeconds=+n||0;}return '';});return{text,decision,nextSeconds};}
function callScreenAutonomyApply(value){const decision=typeof value==='string'?value:value&&value.decision,nextSeconds=typeof value==='object'&&value?+value.nextSeconds||0:0;if(decision==='提问'){_callScreenObserveMode='waiting';callScreenRealtimeStop(false);return;}if(decision==='等待切换'){_callScreenObserveMode='waiting-screen';callScreenRealtimeStop(false);return;}if(decision!=='继续'){_callScreenObserveMode='ended';callScreenRealtimeStop(false);return;}_callScreenObserveMode='observing';_callScreenNextDelay=Math.max(3000,Math.min(90000,(nextSeconds||12)*1000));if(screenShareRealtimeVisionOn()&&callScreenShareOn())callScreenRealtimeArm(false,_callScreenNextDelay);}
function callScreenRealtimeArm(reset,delayMs){callScreenRealtimeStop(reset!==false);const sess=_call&&_call.session;if(!sess||screenShareSpeechVisionOn()||!screenShareRealtimeVisionOn()||!callScreenShareOn()||!_call||_call.state!=='active'||_callScreenObserveMode!=='observing')return false;const wait=Math.max(250,Number(delayMs)||_callScreenNextDelay||8000);_callScreenNextAt=Date.now()+wait;const tick=()=>{if(!_callBusy&&!_callVisionPend.length)callScreenRealtimeTick(sess);else if(_call&&_call.session===sess)callScreenRealtimeArm(false,900);};_callScreenRealtimeTimer=setTimeout(tick,wait);return true;}
function callScreenRealtimeFrameEvent(event){if(!_call||!screenShareRealtimeVisionOn()||_callScreenObserveMode!=='observing'||!callScreenShareOn())return false;const sequence=Math.max(0,Number(event&&event.sequence)||0);if(sequence&&sequence<=_callScreenRealtimeSequence)return false;if(_callScreenNextAt&&Date.now()+100<_callScreenNextAt)return false;callScreenRealtimeArm(false,250);return true;}
async function callScreenFrameSignature(data){return await new Promise(resolve=>{const img=new Image();img.onload=()=>{try{const c=document.createElement('canvas'),w=12,h=12;c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,w,h);const p=x.getImageData(0,0,w,h).data,a=[];for(let i=0;i<p.length;i+=4)a.push(Math.round((p[i]*.299+p[i+1]*.587+p[i+2]*.114)/16).toString(16));resolve(a.join(''));}catch(_){resolve('');}};img.onerror=()=>resolve('');img.src=data;});}
function callScreenFrameChanged(next,prev){if(!next)return false;if(!prev)return true;const n=Math.min(next.length,prev.length);if(!n)return true;let diff=0;for(let i=0;i<n;i++)diff+=Math.abs(parseInt(next[i],16)-parseInt(prev[i],16));return diff/n>=1.35;}
