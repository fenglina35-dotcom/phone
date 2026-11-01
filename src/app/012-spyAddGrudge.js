function spyAddGrudge(id){spyOrganizerEditor('grudge',id,-1);}
function spyOrganizerRows(kind,id,create){if(kind==='grudge'){const c=getC(id);return c?grudgesOf(c):null;}const d=S.spy&&S.spy[id];if(!d)return null;if(create&&(!d.todo||d.todo.date!==todayStr()))d.todo={date:todayStr(),items:[]};return d.todo&&d.todo.date===todayStr()?d.todo.items:null;}
function spyOrganizerEditor(kind,id,index){if(!['todo','grudge'].includes(kind)||!getC(id))return;const rows=spyOrganizerRows(kind,id,false),row=rows&&rows[index];if(index>=0&&!row)return;_spyOrganizerDraft={kind,id,index,row,rows,state:S,account:actId(),day:todayStr()};const attr=v=>esc(String(v)).replace(/"/g,'&quot;');openModal(`<div class="so-editor"><div class="so-editor-eyebrow">${kind==='grudge'?'GRUDGE NOTE':'TODAY’S PLAN'}</div><h3>${index<0?(kind==='grudge'?'记下一笔':'添加行程'):(kind==='grudge'?'这一笔记仇':'编辑行程')}</h3><label>把事情写下来<textarea id="soText" maxlength="220" placeholder="${kind==='grudge'?'记下ta惦记的事':'今天要做什么'}">${esc(row&&row.text||'')}</textarea></label>${kind==='todo'?`<label>时间（可留空）<input id="soTime" maxlength="30" placeholder="例如 18:30" value="${attr(row&&row.time||'')}"></label>`:`<p class="so-editor-hint">${row&&row.done?'这件事已经和好，可以继续补充记录。':'记录会保留在ta的小本本里。'}</p>`}<div class="so-editor-actions"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="spyOrganizerSave()">保存${kind==='grudge'?'记录':'行程'}</button></div>${row?'<button class="so-delete" onclick="spyOrganizerDelete()">删除这'+(kind==='grudge'?'笔记录':'条行程')+'</button>':''}</div>`);const m=document.getElementById('modal');m.classList.add('spy-organizer-modal');m.classList.toggle('spy-grudge-modal',kind==='grudge');}
function spyOrganizerValid(d){return d&&d.state===S&&d.account===actId()&&(d.kind!=='todo'||d.day===todayStr())&&getC(d.id)&&(!d.row||spyOrganizerRows(d.kind,d.id,false)===d.rows&&d.rows.includes(d.row));}
function spyOrganizerSave(){const d=_spyOrganizerDraft;if(!spyOrganizerValid(d)){closeModal();toast('记录已变化，请重新打开');return;}const text=String((document.getElementById('soText')||{}).value||'').trim().slice(0,220);if(!text){toast('先写一点内容');return;}const rawTime=String((document.getElementById('soTime')||{}).value||'').trim().slice(0,30),time=d.kind==='todo'&&rawTime?spyTodoTime(rawTime):rawTime;if(d.kind==='todo'&&rawTime&&!time){toast('时间请填 11:00 或 11点这样的格式');return;}const rows=spyOrganizerRows(d.kind,d.id,true);if(!rows)return;let changed=false;if(d.row){changed=d.row.text!==text||d.row.time!==time;d.row.text=text;if(d.kind==='todo'){d.row.time=time;d.row.id=d.row.id||uid();d.row.source='owner';d.row.accountId=String(actId());if(changed){d.row.reportRevision=(+d.row.reportRevision||0)+1;delete d.row.reportedAt;}}}else rows.unshift(d.kind==='grudge'?{id:uid(),text,done:false,ts:Date.now()}:{id:uid(),source:'owner',accountId:String(actId()),reportRevision:1,text,time,done:false});if(d.kind==='todo')spyTodoChanged(d.id);closeModal();_spyOrganizerDraft=null;save();render();}
async function spyOrganizerDelete(){const d=_spyOrganizerDraft;if(!spyOrganizerValid(d)||!d.row)return;const yes=await uiConfirm('确定删除这'+(d.kind==='grudge'?'笔记仇':'条行程')+'？删除后无法恢复。',{yes:'删除',no:'保留',danger:true});if(!yes)return;if(!spyOrganizerValid(d)){closeModal();toast('记录已变化，请重新打开');return;}d.rows.splice(d.rows.indexOf(d.row),1);if(d.kind==='todo')spyTodoChanged(d.id);closeModal();_spyOrganizerDraft=null;save();render();}
// ROLE_OWNER_TODO_REPORT_V1: explicit owner plans are server events, with one delivery lane in foreground and background.
function spyTodoTime(value){const raw=String(value||'').trim(),m=raw.match(/^(\d{1,2})[:：](\d{2})$/),cn=raw.match(/^(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})[点时](?:(\d{1,2})分?|半)?$/);if(!m&&!cn)return '';let h=+(m?m[1]:cn[2]),n=m?+m[2]:cn[3]?+cn[3]:/半$/.test(raw)?30:0;if(cn&&['下午','晚上'].includes(cn[1])&&h<12)h+=12;if(cn&&cn[1]==='中午'&&h<11)h+=12;if(h>23||n>59)return '';return String(h).padStart(2,'0')+':'+String(n).padStart(2,'0');}
function spyTodoKey(day,row){return 'ownerTodo:'+day+':'+String(row.id||'')+':'+(+row.reportRevision||0);}
function spyTodoOwnerRows(c){if(!c)return [];const d=c&&S.spy&&S.spy[c.id],t=d&&d.todo;return isMain()&&S.couple&&S.couple.cid===c.id&&c&&!c.deleted&&!c.blocked&&t&&t.date===todayStr()&&Array.isArray(t.items)?t.items.filter(x=>x&&x.source==='owner'&&String(x.accountId)===String(actId())&&x.id):[];}
function spyTodoCloudConfig(c){const d=c&&S.spy&&S.spy[c.id],day=d&&d.todo&&d.todo.date,rows=spyTodoOwnerRows(c),expiresAt=day?+new Date(day+'T23:59:59.999'):0;return{schema:1,accountId:String(actId()),roleId:c&&c.id||'',timezone:deviceTimeZone(),day:day||'',expiresAt,items:rows.filter(x=>!x.done&&!x.reportedAt&&spyTodoTime(x.time)).slice(0,24).map(x=>({id:x.id,key:spyTodoKey(day,x),revision:+x.reportRevision||0,text:String(x.text||'').slice(0,220),time:spyTodoTime(x.time),dueAt:+new Date(day+'T'+spyTodoTime(x.time)+':00')}))};}
function spyTodoPrompt(c){const rows=spyTodoOwnerRows(c);if(!rows.length)return '';return '\n\n# 对方为你本人安排的今日日程（不是让对方去做的任务）\n'+rows.map(x=>(spyTodoTime(x.time)||'未定时间')+' '+x.text+'；'+(x.done?'已确认完成':x.reportedAt?'你已发过到点报备，尚未确认完成':'尚未到点报备')).join('\n')+'\n这些是你自己的安排，不要把执行人说反。只有到点事件交给你时才主动报备一次；普通聊天记得安排，但不要反复提醒、提前声称完成，也不把报备当成完成。称呼、语气与具体表达由你按人设和当前关系决定。';}
const _spyTodoSyncChains=Object.create(null),_spyTodoSyncBusy=Object.create(null);
function spyTodoSyncSerialize(c,work){if(!c)return Promise.resolve(false);const state=S,owner=actId(),target=cloudId(),key=owner+'|'+target+'|'+c.id,previous=_spyTodoSyncChains[key]||Promise.resolve();const next=previous.catch(()=>{}).then(()=>S===state&&actId()===owner&&cloudId()===target&&getC(c.id)===c?work():false);_spyTodoSyncChains[key]=next;return next.finally(()=>{if(_spyTodoSyncChains[key]===next)delete _spyTodoSyncChains[key];});}
function spyTodoChanged(id){const d=S.spy&&S.spy[id],t=d&&d.todo;if(!t)return; t.reportSyncToken=uid();t.reportSyncPending=true;save();spyTodoSyncPending(id);}
async function spyTodoSyncPending(id){const state=S,owner=actId(),c=getC(id),t=S.spy&&S.spy[id]&&S.spy[id].todo;if(!isMain()||!c||!t||!t.reportSyncPending||!c.proactive||!c.proactive.enabled||!c.proactive.serverPush||!gateOK())return false;const token=t.reportSyncToken,key=owner+'|'+id;if(_spyTodoSyncBusy[key])return false;_spyTodoSyncBusy[key]=true;let ok=false;try{ok=await roleServerPushSync(c,true);if(S===state&&actId()===owner&&S.spy[id]&&S.spy[id].todo===t&&t.reportSyncToken===token){t.reportSyncPending=!ok;if(ok)t.reportSyncedAt=Date.now();save();}}finally{delete _spyTodoSyncBusy[key];}return ok;}
function spyTodoServerRow(c,row){const kind=String(row&&row.triggerKind||'');if(!kind.startsWith('automation:ownerTodo:'))return undefined;const key=kind.slice('automation:'.length);return spyTodoOwnerRows(c).find(x=>!x.done&&spyTodoKey(todayStr(),x)===key)||null;}
function spyTodoReportTick(){if(typeof document!=='undefined'&&document.hidden||!isMain())return;const id=S.couple&&S.couple.cid,c=id&&getC(id);if(!c)return;spyTodoSyncPending(id).catch(()=>{});const config=spyTodoCloudConfig(c);if(c.proactive&&c.proactive.serverPush&&c.proactive.enabled&&config.items.some(x=>x.dueAt<=Date.now())&&typeof roleServerPushPull==='function')roleServerPushPull(true).catch(()=>{});}
setInterval(spyTodoReportTick,15000);document.addEventListener('visibilitychange',spyTodoReportTick);window.addEventListener('pageshow',spyTodoReportTick);
// END_ROLE_OWNER_TODO_REPORT_V1
function previewOrganizer(mode){if(!NORTH_PREVIEW)return;const c=S.contacts[0],now=Date.now();c.name=c.remark='克劳德先生';S.couple={cid:c.id};c.spy={granted:true};S.spy=S.spy||{};S.spy[c.id]={todo:{date:todayStr(),items:[{text:'一起去超市，补充冰箱里的食材',time:'17:30',done:false},{text:'把答应借你的书带回家',time:'18:00',done:false},{text:'晚饭后一起散步',time:'20:30',done:false},{text:'给阳台的花浇水',time:'09:00',done:true}]}};c.grudges=[{id:'demo_g1',text:'答应到家告诉我，结果忘了报平安。',done:false,ts:now-3600000},{id:'demo_g2',text:'说好一起看电影，临时跑去打游戏。',done:false,ts:now-86400000},{id:'demo_g3',text:'抢走了最后一口布丁，还假装没看见。',done:true,ts:now-172800000,doneTs:now-86400000}];_spyUnlock[c.id]=true;_spyApp=mode==='roleschedule'?'todo':'grudge';stack=[{p:'spy',id:c.id}];}
function spyToggleGrudge(id,i){const c=getC(id);const g=c&&c.grudges;if(!g||!g[i])return;g[i].done=!g[i].done;g[i].doneTs=g[i].done?Date.now():0;save();render();}
function spyDelGrudge(id,i){const c=getC(id);const g=c&&c.grudges;if(!g||!g[i])return;g.splice(i,1);save();render();}
// SPY_LIFE_STUDIO_V1: real role/account-scoped notes; presentation never changes automatic model recording.
const _spyLifeViews=Object.create(null);let _spyLifeDraft=null;
function spyLifeNoteView(id){const key=memoryScopeKey()+':'+id;return _spyLifeViews[key]||(_spyLifeViews[key]={query:'',tag:'all',limit:4});}
function spyLifeNoteRows(id){const allowed=new Set(lifeNotesForRole(getC(id)));return lifeNotes().map((n,index)=>({n,index})).filter(r=>r.n&&allowed.has(r.n)).sort((a,b)=>(+b.n.ts||0)-(+a.n.ts||0)||a.index-b.index);}
function spyLifeNoteCategory(tag){return lifeNoteCategoryKey(tag);}
function spyLifeNoteCategoryName(tag){return lifeTagName(tag);}
function spyLifeNoteCategories(n){return [...new Set(lifeNoteTags(n).map(spyLifeNoteCategory))];}
function spyLifeNoteAttr(v){return esc(String(v||'')).replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function spyLifeNoteSearch(id,value){const view=spyLifeNoteView(id),old=document.getElementById('slSearch'),pos=old&&old.selectionStart;view.query=String(value||'').slice(0,100);view.limit=4;render();const e=document.getElementById('slSearch');if(e){e.focus();if(pos!=null)e.setSelectionRange(pos,pos);}}
function spyLifeNoteFilter(id,tag){const view=spyLifeNoteView(id);view.tag=tag;view.limit=4;render();}
function spyLifeNoteMore(id){spyLifeNoteView(id).limit+=8;render();}
function spyLifeNoteRefresh(){render();toast('小事簿已更新');}
function spyLifeNoteSec(id){const rows=spyLifeNoteRows(id),view=spyLifeNoteView(id),c=getC(id),j=spyOrganizerArg(id),today=rows.filter(({n})=>spyDateDay(+n.ts)===todayStr()).length,tags=['emotion','promise','preference'];rows.forEach(({n})=>spyLifeNoteCategories(n).forEach(t=>{if(!tags.includes(t))tags.push(t);}));const search=view.query.toLocaleLowerCase(),filtered=rows.filter(({n})=>(view.tag==='all'||spyLifeNoteCategories(n).includes(view.tag))&&(!search||[lifeNoteReadableText(n),...lifeNoteTags(n).map(lifeTagName)].join(' ').toLocaleLowerCase().includes(search))),shown=filtered.slice(0,view.limit);let lastDay=null;
 const cards=shown.map(({n,index})=>{const day=spyDateDay(+n.ts),stamp=day?`${+day.slice(5,7)}月${+day.slice(8)}日`:'日期未记录',heading=lastDay!==day?`<h3 class="sl-day">${stamp}</h3>`:'';lastDay=day;const category=spyLifeNoteCategories(n)[0]||'life';return `${heading}<article class="sl-card"><header><span class="sl-chip" title="${spyLifeNoteAttr(lifeNoteTags(n).map(lifeTagName).join('、')||'生活')}">${esc(category==='life'?'生活':spyLifeNoteCategoryName(category))}</span><time>${day?stamp+' '+esc(hm(+n.ts)):stamp}</time><button aria-label="小事更多操作" onclick="spyLifeNoteActions(${index},${j})">···</button></header><p>${esc(lifeNoteReadableText(n))}</p><small>${esc(lifeNoteAuthorship(n,c))}</small></article>`;}).join('');
 return `<header class="sl-overview"><div><h1>关于 <em>${esc(S.me.name||'你')}</em> 的小事簿</h1><button onclick="spyLifeNoteEditor(-1,${j})"><span aria-hidden="true">＋</span> 添加</button></div><div class="sl-stats"><span>共 <b>${rows.length}</b> 条</span><span>今日新增 <b>${today}</b></span><span>自动记录 <strong>${lifeNotesAutoOn()?'已开启':'已关闭'}</strong></span></div></header><section class="sl-auto"><div><h2>角色自动记录</h2><p>由角色总结值得记住的情绪变化和已答应的约定</p></div><button class="sw ${lifeNotesAutoOn()?'on':''}" role="switch" aria-checked="${lifeNotesAutoOn()?'true':'false'}" aria-label="角色自动记录" onclick="lifeNotesAutoToggle()"></button></section><p class="sl-hint">关闭自动记录不会删除已有内容。</p><label class="sl-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg><input id="slSearch" type="search" maxlength="100" aria-label="搜索小事内容" placeholder="搜索记忆内容" value="${spyLifeNoteAttr(view.query)}" oninput="spyLifeNoteSearch(${j},this.value)"></label><div class="sl-tabs">${[['all','全部',rows.length],...tags.map(t=>[t,spyLifeNoteCategoryName(t),rows.filter(({n})=>spyLifeNoteCategories(n).includes(t)).length])].map(([tag,label,n])=>`<button class="${tag===view.tag?'active':''}" onclick="spyLifeNoteFilter(${j},${spyOrganizerArg(tag)})">${esc(label)} <span>${n}</span></button>`).join('')}</div>${shown.length?`<section class="sl-timeline">${cards}</section>`:`<div class="sl-empty"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="10" y="6" width="29" height="37" rx="5"/><path d="M7 15h7M7 24h7M7 33h7M21 16h11M21 23h11M21 30h7"/></svg><h3>${rows.length?'没有找到相符的小事':'小事簿还在等第一条记录'}</h3><p>${rows.length?'换个关键词或分类看看。':'可以手动补充，也可以让角色在相处中慢慢记下。'}</p></div>`}${filtered.length>shown.length?`<button class="sl-more" onclick="spyLifeNoteMore(${j})">查看更多记录 <span>›</span><small>还有 ${filtered.length-shown.length} 条</small></button>`:shown.length?'<div class="sl-end">这些小事，都留在这里了</div>':''}`;}
function lifeTagName(k){const names={work:'工作',sleep:'睡眠',health:'身体',family:'家里',friend:'朋友',money:'钱',emotion:'情绪',promise:'约定',preference:'偏好',habit:'习惯',anniversary:'纪念日',care:'在意',wish:'愿望',life:'生活'};return Object.prototype.hasOwnProperty.call(names,k)?names[k]:k==='custom:all'?'all':String(k);}
function spyLifeNoteActions(i,id){const row=spyLifeNoteRows(id).find(r=>r.index===i);if(!row)return;const j=spyOrganizerArg(id);openModal(`<div class="sl-dialog"><small>ONE LITTLE MOMENT</small><h3>这一条小事</h3><div class="sl-note-preview">${esc(lifeNoteReadableText(row.n))}</div><p class="sl-dialog-hint">${esc(lifeNoteAuthorship(row.n,getC(id)))}</p><button class="btn p" onclick="spyLifeNoteEditor(${i},${j})">编辑内容与分类</button><button class="btn g" onclick="spyDelLifeNote(${i},${j})">删除这条小事</button><button class="btn g" onclick="closeModal()">取消</button></div>`);}
function spyLifeNoteEditor(i){const id=arguments[1]||(cur().p==='spy'&&cur().id)||S.couple&&S.couple.cid,c=getC(id),arr=lifeNotes(),editing=Number.isInteger(i)&&i>=0,n=editing?arr[i]:null;if(!c||editing&&(!n||!spyLifeNoteRows(id).some(r=>r.n===n)))return;_spyLifeDraft={state:S,account:actId(),scope:memoryScopeKey(),id,owner:c,row:n,rows:arr};const category=n?spyLifeNoteCategories(n)[0]||'auto':'auto',categories=['auto','emotion','promise','preference','habit','anniversary','care','friend','wish','work','sleep','health','family','money'];if(!categories.includes(category))categories.push(category);openModal(`<div class="sl-dialog"><small>LITTLE THINGS ABOUT YOU</small><h3>${editing?'修改这条小事':'添加一条小事'}</h3><p class="sl-dialog-hint">手动补充的内容会保留来源标记，最多 220 字。</p><label>记忆内容<textarea id="spy_life_note_edit" maxlength="220" rows="6" placeholder="记一件想留下的小事">${esc(n&&n.text||'')}</textarea></label><label>分类<select id="slCategory">${categories.map(t=>`<option value="${spyLifeNoteAttr(t)}" ${t===category?'selected':''}>${esc(t==='auto'?'根据内容分类':spyLifeNoteCategoryName(t))}</option>`).join('')}</select></label><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="spySaveLifeNote(${editing?i:-1})">${editing?'保存修改':'记进小事簿'}</button></div></div>`);}
function spyAddLifeNote(){spyLifeNoteEditor(-1);}
function spyEditLifeNote(i){spyLifeNoteEditor(i);}
function spyLifeNoteDraftValid(d){return d&&d.state===S&&d.account===actId()&&d.scope===memoryScopeKey()&&getC(d.id)===d.owner&&lifeNotes()===d.rows&&(!d.row||d.rows.includes(d.row)&&spyLifeNoteRows(d.id).some(r=>r.n===d.row));}
function spySaveLifeNote(i){const d=_spyLifeDraft;if(!spyLifeNoteDraftValid(d)){closeModal();toast('记录或账号已变化，请重新打开');return false;}const e=document.getElementById('spy_life_note_edit'),v=String(e&&e.value||'').trim().slice(0,220);if(!v){toast('先写下一件小事');return false;}const chosen=String((document.getElementById('slCategory')||{}).value||'auto'),tags=chosen==='auto'?lifeTopicOf(v):[chosen],n=d.row;if(n){const previous=spyLifeNoteCategories(n)[0];n.text=v;n.source='manual';n.rolePerspective=false;if(chosen!==previous||!lifeNoteTags(n).length)n.tags=tags;n.ts=n.ts||Date.now();}else{if(spyLifeNoteRows(d.id).some(({n})=>String(n.text||'').trim()===v&&Date.now()-(+n.ts||0)<3*86400000)){toast('这条小事已经记过了');return false;}d.rows.unshift({id:uid(),text:v,source:'manual',rolePerspective:false,tags,ts:Date.now(),roleId:d.id,accountId:d.scope});}save();closeModal();_spyLifeDraft=null;render();toast(n?'小事已修改':'已记进小事簿');return true;}
async function spyDelLifeNote(i,id){id=id||(cur().p==='spy'&&cur().id)||S.couple&&S.couple.cid;const arr=lifeNotes(),row=arr[i],state=S,account=actId();if(!row||!spyLifeNoteRows(id).some(r=>r.n===row))return;if(!await uiConfirm('删除这条小事？删除后无法恢复。',{danger:true,yes:'删除',no:'保留'}))return;if(S!==state||actId()!==account||lifeNotes()!==arr||!spyLifeNoteRows(id).some(r=>r.n===row)){closeModal();toast('记录或账号已变化，请重新打开');return;}arr.splice(arr.indexOf(row),1);save();closeModal();render();}
function previewLifeStudio(){if(!NORTH_PREVIEW)return;previewOrganizer('roleschedule');S.me.name='North';S.me.lifeNotesAuto=true;S.me.lifeNotes=[];const c=S.contacts[0],today=new Date(todayStr()+'T12:00:00').getTime(),scenarios=[
 ['情绪','我因为同事把我的努力说成运气，感到很委屈。','她觉得同事把自己的努力说成运气，很委屈。'],
 ['心情','下雨天听着雨声看书，会让我觉得很安心。','她听着雨声看书，会觉得很安心。'],
 ['约定','我答应周末一起去江边散步，出门前先看天气。','她答应周末一起去江边散步，出门前先看天气。'],
 ['喜好','我喜欢微甜的热可可，糖不用放太多。','她喜欢微甜的热可可，糖放少一点就好。'],
 ['习惯','我习惯每天睡前看十分钟书。','她习惯睡前看十分钟书，之后再休息。'],
 ['纪念日','十月三日是我的生日，我每年都会和家人吃蛋糕。','她的生日在十月三日，习惯和家人一起吃蛋糕。']
 ];scenarios.forEach(([kind,evidence,text],i)=>{const before=lifeNotes().length;lifeNoteConsumeModelTags('我记住了。\n[小事簿|'+kind+'|'+evidence+'|'+text+']',c,evidence,'wechat');if(lifeNotes().length>before){const n=lifeNotes()[0];n.id='demo_life_'+i;n.ts=Math.min(Date.now(),today)-i*86400000;}});_spyApp='lifelog';}
// 他手机里：和你的线下约会记录（让他清楚约会对象是你）
function offMemText(m){return (typeof m==='string')?m:((m.label?m.label+' ':'')+(m.loc?'@'+m.loc+'：':'')+(m.text||''));}
function offMemLabel(o){const w=o.when||'';let d='';const md=w.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);if(md)d=(+md[2])+'月'+(+md[3])+'日';else if(w)d=w;else d=ymd(Date.now());const tm=w.match(/(\d{1,2}:\d{2})/);return d+(o.daypart?' '+o.daypart:(tm?' '+tm[1]:''));}
// SPY_DATE_STUDIO_V1: role-phone projection of real offline sessions, memories and current-account invitations.
const _spyDateViews=Object.create(null);let _spyDateDraft=null,_spyDateClock=0;
function spyDateDay(value){const v=String(value||''),m=v.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})/);if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');const n=typeof value==='number'?value:0;if(!n||!Number.isFinite(n))return '';const d=new Date(n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function spyDateState(id){return _spyDateViews[id]||(_spyDateViews[id]={day:todayStr(),filter:'active'});}
function spyDateData(id){const o=S.offline&&S.offline[id]||{},c=getC(id),groups=[],byKey=new Map(),memory=Array.isArray(o.memory)?o.memory:[],history=Array.isArray(o.history)?o.history:[];
 const group=(h,key)=>{if(byKey.has(key))return byKey.get(key);const row={key,loc:h.loc||'',when:h.when||h.label||'',day:spyDateDay(h.when)||spyDateDay(h.date)||spyDateDay(h.label)||spyDateDay(h.startedAt)||spyDateDay(h.ts),memories:[],history:[],ts:+h.startedAt||+h.ts||0};byKey.set(key,row);groups.push(row);return row;};
 const keyOf=h=>h.startedAt?'start:'+h.startedAt+':'+(h.loc||''):'day:'+(spyDateDay(h.when)||spyDateDay(h.date)||spyDateDay(h.label)||spyDateDay(h.ts)||'unknown')+':'+(h.loc||'');
 history.forEach(h=>{if(!h||typeof h!=='object')return;const row=group(h,keyOf(h));row.history.push(h);});
 memory.forEach((m,i)=>{const obj=m&&typeof m==='object'?m:{text:String(m||'')},h=history.find(h=>h&&offHistoryHasMemory(h,obj.id));const row=group(h||obj,keyOf(h||obj));row.memories.push({m:obj,index:i});});
 const last=offLastSession(o);if(last)group(last,keyOf(last));
 groups.sort((a,b)=>b.ts-a.ts);
 const invitations=(S.messages&&S.messages[accountMessageKey(id,actId())]||[]).filter(m=>m&&m.type==='dateinvite'&&!m.accepted&&!m.declined&&m.role==='assistant').map(m=>({message:m,day:spyDateDay(m.when),loc:m.loc||'老地方',when:m.when||'时间待商量'}));
 return{o,c,groups,invitations};}
function spyDateIcon(kind){const paths={calendar:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v5m8-5v5M4 11h16m-8 3v4m-2-2h4"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',heart:'<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 3 11 8 15 5-4 13-10 8-15Z"/>'};return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[kind]+'</svg>';}
function spyDateSelect(id,day){const v=spyDateState(id);v.day=day;render();}
function spyDateFilter(id,filter){if(!['active','pending','memory'].includes(filter))return;spyDateState(id).filter=filter;render();}
function spyDateRefresh(){render();toast('约会记录已更新');}
function spyDateClockStart(id){clearInterval(_spyDateClock);const account=actId();_spyDateClock=setInterval(()=>{if(cur().p!=='spy'||cur().id!==id||_spyApp!=='date'||actId()!==account){clearInterval(_spyDateClock);_spyDateClock=0;return;}const o=S.offline&&S.offline[id],e=document.querySelector('.sd-elapsed');if(e&&o&&o.started)e.textContent=o.startedAt?'已经见面 '+offElapsed(o.startedAt,Date.now()):'约会进行中';},30000);}
function spyDateCardHTML(id,row,kind){const j=spyOrganizerArg(id),o=row.o||{},isActive=kind==='active',isPending=kind==='pending',status=isActive?'正在约会':isPending?'待你确认':'约会回忆',title=isActive?'和你的约会':isPending?'ta约你见面':(row.loc?row.loc+'的约会':'珍藏的约会'),when=isActive?o.when||'本次见面':row.when||row.day||'日期未记录',loc=isActive?o.loc:row.loc;
 return `<article class="sd-card ${isActive?'sd-live':''}"><header><span class="sd-badge">${status}</span>${!isActive&&!isPending?`<small>${row.memories.length} 条重点</small>`:''}</header><h2>${esc(title)}</h2><div class="sd-meta">${spyDateIcon('calendar')}<span>${esc(when.replace(/(\d{4})-(\d{2})-(\d{2})/g,(_,y,m,d)=>(+m)+'月'+(+d)+'日'))}</span></div><div class="sd-meta">${spyDateIcon('pin')}<span>${esc(loc||'地点未记录')}</span></div>${isActive?`<div class="sd-meta">${spyDateIcon('heart')}<span>和 ${esc(S.me.name||'你')}</span></div><footer><b class="sd-elapsed">${o.startedAt?'已经见面 '+esc(offElapsed(o.startedAt,Date.now())):'约会进行中'}</b><span>持续见面中</span></footer><div class="sd-live-line" aria-hidden="true"></div>`:''}${isPending?'<p class="sd-note">这是一份邀请，确认后才会进入约会。</p>':''}${!isActive?`<button class="sd-card-link" onclick="${isPending?'spyDateInvitation('+j+','+spyOrganizerArg(row.message.id)+')':'spyDateDetails('+j+','+spyOrganizerArg(row.key)+')'}">${isPending?'查看邀请':'查看约会重点'} <span>›</span></button>`:''}</article>`;}
function spyOfflineSec(id){const {o,groups,invitations}=spyDateData(id),state=spyDateState(id),j=spyOrganizerArg(id),base=new Date(state.day+'T12:00:00'),dates=[];for(let n=-2;n<=2;n++){const d=new Date(+base+n*86400000),key=spyDateDay(+d);dates.push(`<button class="${key===state.day?'selected':''}" aria-pressed="${key===state.day}" onclick="spyDateSelect(${j},'${key}')"><b>${d.getDate()}</b><span>${'日一二三四五六'[d.getDay()]}</span></button>`);}
 const active=!!o.started,activeDay=spyDateDay(o.startedAt)||spyDateDay(o.when),showActive=active&&(!activeDay||state.day>=activeDay&&state.day<=todayStr()),shownMemory=groups.filter(r=>!r.day||r.day===state.day),shownInvites=invitations.filter(r=>!r.day||r.day===state.day),filter=state.filter;
 let main=filter==='active'?(showActive?spyDateCardHTML(id,{o},'active'):''):filter==='pending'?shownInvites.map(r=>spyDateCardHTML(id,r,'pending')).join(''):shownMemory.map(r=>spyDateCardHTML(id,r,'memory')).join('');
 if(!main)main=`<div class="sd-empty">${spyDateIcon('heart')}<h3>${filter==='active'?'这一天没有正在进行的约会':filter==='pending'?'这一天没有待确认邀请':'这一天还没有约会回忆'}</h3><p>${filter==='active'?'见面的每一刻，都值得留在这里。':'换个日期看看，或查看全部约会记录。'}</p></div>`;
 spyDateClockStart(id);return `<div class="sd-days"><button class="sd-month" onclick="spyDateCalendar(${j})">${+state.day.slice(5,7)}月 <span>⌄</span></button><div>${dates.join('')}</div></div><div class="sd-tabs">${[['active','正在约会',active?1:0],['pending','待确认',invitations.length],['memory','约会回忆',groups.length]].map(([key,label,n])=>`<button class="${filter===key?'active':''}" onclick="spyDateFilter(${j},'${key}')">${label} <span>${n}</span></button>`).join('')}</div><section class="sd-records"><h1>约会记录 <small>${+state.day.slice(5,7)}月${+state.day.slice(8)}日</small></h1>${main}</section><button class="sd-all" onclick="spyDateAll(${j})">查看全部约会记录 <span>›</span></button><button class="sd-invite" onclick="offlineInvite(${j})">${spyDateIcon('heart')} 约ta见面</button>`;}
function spyDateCalendar(id){const j=spyOrganizerArg(id);openModal(`<div class="sd-dialog"><small>OUR DATES</small><h3>选择日期</h3><label>想看哪一天<input id="sdDay" type="date" value="${spyDateState(id).day}"></label><div class="btns"><button class="btn g" onclick="spyDateSelect(${j},todayStr());closeModal()">回到今天</button><button class="btn p" onclick="spyDateCalendarSave(${j})">查看这一天</button></div></div>`);}
function spyDateCalendarSave(id){const e=document.getElementById('sdDay'),v=e&&e.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')){toast('先选择日期');return;}closeModal();spyDateSelect(id,v);}
function spyDateAll(id){const d=spyDateData(id),j=spyOrganizerArg(id);openModal(`<div class="sd-dialog"><small>OUR DATE ARCHIVE</small><h3>全部约会记录</h3>${d.o.started?spyDateCardHTML(id,{o:d.o},'active'):''}${d.groups.map(r=>spyDateCardHTML(id,r,'memory')).join('')||'<p class="sd-quiet">还没有已保存的约会回忆。</p>'}${d.invitations.length?'<h4>待确认的邀约</h4>'+d.invitations.map(r=>spyDateCardHTML(id,r,'pending')).join(''):''}<button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function spyDateInvitation(id,mid){const row=spyDateData(id).invitations.find(r=>r.message.id===mid),j=spyOrganizerArg(id);if(!row)return;openModal(`<div class="sd-dialog"><small>AN INVITATION FOR YOU</small><h3>ta约你见面</h3><div class="sd-meta">${spyDateIcon('calendar')}<span>${esc(row.when)}</span></div><div class="sd-meta">${spyDateIcon('pin')}<span>${esc(row.loc)}</span></div><p class="sd-note">去微信查看原始邀请，再决定是否赴约。</p><button class="btn p" onclick="closeModal();openChat(${j})">去微信查看邀请</button><button class="btn g" onclick="spyDateAll(${j})">返回约会记录</button></div>`);}
function spyDateDetails(id,key){const row=spyDateData(id).groups.find(r=>r.key===key),j=spyOrganizerArg(id);if(!row)return;openModal(`<div class="sd-dialog"><small>MEMORIES WITH YOU</small><h3>${esc(row.loc||'这一次见面')}</h3><p class="sd-note">${esc(row.when||row.day||'日期未记录')}</p>${row.memories.map(({m,index})=>`<article class="sd-memory"><div class="sd-memory-stars">${offSummaryStars(m.imp||3)}</div><p>${esc(m.text||'')}</p><button onclick="spyDateEdit(${j},${index})">编辑这条重点 ›</button></article>`).join('')||'<p class="sd-quiet">这场原始记录已归档，尚未生成约会重点。</p>'}<button class="btn g" onclick="offMemory(${j})">管理记忆与原记录</button><button class="btn g" onclick="spyDateAll(${j})">返回全部记录</button></div>`);}
function spyDateEdit(id,index){const o=S.offline&&S.offline[id],m=o&&o.memory&&o.memory[index];if(m==null)return;_spyDateDraft={id,row:m,rows:o.memory,index,state:S,account:actId()};openModal(`<div class="sd-dialog"><small>KEEP THIS MOMENT</small><h3>编辑约会重点</h3><label>记忆内容<textarea id="sdMemory" rows="8">${esc(typeof m==='object'?m.text||'':String(m))}</textarea></label>${typeof m==='object'?`<label>重要程度<select id="sdImportance">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===(m.imp||3)?'selected':''}>${offSummaryStars(n)}</option>`).join('')}</select></label>`:''}<div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="spyDateSave()">保存重点</button></div><button class="sd-delete" onclick="spyDateDelete()">删除这条重点</button></div>`);}
function spyDateDraftValid(d){return d&&d.state===S&&d.account===actId()&&S.offline&&S.offline[d.id]&&S.offline[d.id].memory===d.rows&&d.rows[d.index]===d.row;}
function spyDateSave(){const d=_spyDateDraft;if(!spyDateDraftValid(d)){closeModal();toast('记录已变化，请重新打开');return;}const text=String((document.getElementById('sdMemory')||{}).value||'').trim();if(!text){toast('内容不能为空');return;}if(typeof d.row==='object'){d.row.text=text;d.row.imp=Math.max(1,Math.min(5,+(document.getElementById('sdImportance')||{}).value||3));offMemorySyncEdit(d.id,d.row);}else d.rows[d.index]=text;save();closeModal();render();spyDateAll(d.id);_spyDateDraft=null;}
async function spyDateDelete(){const d=_spyDateDraft;if(!spyDateDraftValid(d))return;if(!await uiConfirm('删除这条约会重点？微信长期记忆里的对应副本也会一起删除。',{danger:true,yes:'删除',no:'保留'}))return;if(!spyDateDraftValid(d)){closeModal();toast('记录已变化，请重新打开');return;}offMemoryRemoveAt(d.id,d.index);save();closeModal();render();spyDateAll(d.id);_spyDateDraft=null;}
function previewDateStudio(){if(!NORTH_PREVIEW)return;previewOrganizer('roleschedule');S.me.name='North';const c=S.contacts[0],now=Date.now(),day=n=>spyDateDay(now+n*86400000);S.offline=S.offline||{};S.offline[c.id]={started:true,startedAt:now-42*60000,session:'demo_date_live',loc:'苏州中心',when:todayStr()+' 18:30',msgs:[],history:[{id:'demo_date_past',startedAt:now-86400000,ts:now-82000000,when:day(-1)+' 19:00',loc:'江边咖啡馆',memoryIds:['demo_date_memory'],msgs:[{who:'me',text:'下次还来这里。'}],summaryStatus:'done'}],memory:[{id:'demo_date_memory',historyId:'demo_date_past',date:day(-1),label:day(-1)+' · 晚上',loc:'江边咖啡馆',text:'我们在江边的咖啡馆坐了很久，一起挑了喜欢的甜点。回家前约好，下次再沿着江边散步。',imp:4,ts:now-82000000}]};S.messages[accountMessageKey(c.id,actId())]=(S.messages[accountMessageKey(c.id,actId())]||[]).concat([{id:'demo_date_invite',role:'assistant',type:'dateinvite',when:day(2)+' 19:00',loc:'电影院',time:now}]);_spyApp='date';_spyDateViews[c.id]={day:todayStr(),filter:'active'};}
function spyEditOffMem(id,i){const o=S.offline&&S.offline[id];if(!o||!o.memory||o.memory[i]==null)return;const m=o.memory[i],cur=(typeof m==='object')?(m.text||''):String(m||'');openModal(`<h3>修改这条约会重点</h3><div class="hint" style="margin-bottom:8px">内容已全部展开，可上下滚动，也可以拖动右下角继续放大。</div><textarea id="off_mem_edit" rows="14" style="width:100%;min-height:42vh;max-height:62vh;resize:vertical;box-sizing:border-box;background:#171717;color:#eee;border:1px solid #4a4540;border-radius:9px;padding:12px;line-height:1.65;font-size:14px">${esc(cur)}</textarea><div class="btns" style="margin-top:10px"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="spySaveOffMem('${id}',${i})">保存修改</button></div>`);setTimeout(()=>{const e=$('#off_mem_edit');if(e){e.focus();e.selectionStart=e.selectionEnd=e.value.length;}},50);}
function spySaveOffMem(id,i){const o=S.offline&&S.offline[id],e=$('#off_mem_edit');if(!o||!o.memory||o.memory[i]==null||!e)return;const v=String(e.value||'').trim();if(!v){toast('内容不能为空；要删除请点删除按钮');return;}const m=o.memory[i];if(typeof m==='object'){m.text=v;offMemorySyncEdit(id,m);}else o.memory[i]=v;save();offMemory(id);toast('约会重点已修改');}
async function spyDelOffMem(id,i){const o=S.offline&&S.offline[id];if(!o||!o.memory)return;if(!await uiConfirm('删除这条约会重点？'))return;offMemoryRemoveAt(id,i);save();render();}
// 查手机：你在抖音点赞过的视频（取消点赞就没记录了）
function spyDouyinSec(id){const data=spyMonitorData(id);return data?spyMonitorLikeRows(id,'dy',12):'';}
async function spyReset(id){if(!await uiConfirm('重置他手机内容？\n会清掉这份查手机的旧存档，下次刷新重新生成全新的（不影响聊天/记忆）。'))return;delete S.spy[id];save();render();toast('已重置，点右上角刷新重新生成');}
// 情侣空间监控到的「你今日各App使用时长」——查手机里也能看到（只显示授权的软件）
function spyUsageSec(id){const data=spyMonitorData(id);return data?spyMonitorUsageRows(data,0):'';}
function stripJSON(t){t=(t||'').trim();const m=t.match(/```(?:json)?\s*([\s\S]*?)```/);if(m)t=m[1];const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>=0&&b>a)t=t.slice(a,b+1);return t;}
let _spyBusy=false;
let _rolePhoneInspectionLane=null;
let _rolePhoneInspectionEpoch=0;
function rolePhoneInspectionLaneActive(){return !!_rolePhoneInspectionLane;}
function rolePhoneInspectionEpoch(){return _rolePhoneInspectionEpoch;}
function rolePhoneInspectionBump(){_rolePhoneInspectionEpoch=(_rolePhoneInspectionEpoch+1)%Number.MAX_SAFE_INTEGER;return _rolePhoneInspectionEpoch;}
function rolePhoneInspectionAcquire(channel,id,label){if(_rolePhoneInspectionLane||typeof wxLoginActive==='function'&&wxLoginActive()||typeof remoteControlActive==='function'&&remoteControlActive())return'';const token=uid();rolePhoneInspectionBump();_rolePhoneInspectionLane={token,channel:channel==='cohab'?'cohab':'online',id,label:String(label||'手机').slice(0,40),at:Date.now()};return token;}
function rolePhoneInspectionRelease(token){if(_rolePhoneInspectionLane&&(!token||_rolePhoneInspectionLane.token===token)){const id=_rolePhoneInspectionLane.id;_rolePhoneInspectionLane=null;if(id&&typeof resumeFeatureEvents==='function')resumeFeatureEvents(id);}}
/* Persistent per-record phone inspection ledger. */
function rolePhoneRecordHash(value){const s=String(value);let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return(a>>>0).toString(36)+'.'+(b>>>0).toString(36);}
function rolePhoneLocalScope(focus){const f=String(focus||'');if(/iPhone|外置|屏幕|步数|睡眠|心率|电量|定位|位置|全部数据/i.test(f))return'';if(/朋友圈/.test(f))return'moments';if(/抖音/.test(f))return'douyin';if(/推特|微博|\bx\b/i.test(f))return'x';if(/微信|聊天|跟谁|消息|谁聊|谁说|联系人/.test(f))return'wechat';if(/携程|旅游|旅行|门票|景点|游乐园|迪士尼|酒店|住宿|订房/.test(f))return'travel';if(/美团|梅团|外卖|店铺订单|顾客订单|我的订单|补货/.test(f))return'food';if(/钱包|账单|花钱|消费|买/.test(f))return'wallet';if(/云程|机票|旅行|行程|酒店|住宿|订房/.test(f))return'travel';if(/电话|短信|通话|通讯录|号码|来电|语音留言/.test(f))return'phone';if(/浏览|百度|网页/.test(f))return'browser';return'';}
function rolePhoneLocalRead(id,scope){
  const c=getC(id),account=String(actId()),ledger=c&&c._phoneInspectionSeen&&c._phoneInspectionSeen[account]||{},seen=ledger.seen||{},records=[],all=scope==='overview',me=S.me.name||'我';let chars=0;
  const has=key=>all||scope===key,names=rid=>{const x=getC(rid);return x&&(x.remark||x.name)||'未知联系人';};
  const add=(kind,owner,row,identity,text,revision)=>{if(!text)return;const stamp=Number(row&&(row.time||row.ts||row.t))||0,payload=String(text).replace(/\s+/g,' ').trim().slice(0,700),recordId=row&&(row.id||row.message_id)||(typeof identity==='number'?'unidentified':identity),key=rolePhoneRecordHash(JSON.stringify([kind,owner,recordId,stamp,revision==null?payload:revision]));if(seen[key]||chars+payload.length>8000)return;records.push({key,text:'· '+payload});chars+=payload.length+3;};
  // Per-message identities stop a new reply from reintroducing the entire old conversation.
  if(has('wechat')){
    (S.contacts||[]).filter(x=>!x.deleted&&x.id!==id).forEach(x=>{const nm=x.remark||x.name;msgs(x.id).slice(-12).forEach((m,i)=>{if(m.type==='sys'||m._callTranslationOf)return;const text=msgToText(m);if(text)add('wechat',x.id,m,m.id||m.time||m.text||m.content||i,'【微信角色 '+nm+'】'+(m.time?'['+factStamp(m.time)+'] ':'')+(m.role==='user'?me:nm)+'：'+text,text);});});
    (S.groups||[]).forEach(g=>(g.msgs||[]).slice(-12).forEach((m,i)=>{const text=typeof gmText==='function'?gmText(m):m.text||m.content||'';add('wechat-group',g.id,m,m.id||m.time||m.text||m.content||i,'【角色群聊 '+g.name+'】'+(m.senderId==='me'?me:names(m.senderId))+'：'+text,text);}));
    if(typeof phoneFriendState==='function'){const p=phoneFriendState();(p.friends||[]).forEach(f=>{const fid=String(f.phone_id||f.id||'').toUpperCase(),nm=pfFriendDisplayName(f);pfMsgList(p.messages,fid).slice(-12).forEach((m,i)=>add('real-friend',fid,m,m.id||m.message_id||i,'【真人好友 '+nm+'】'+pfSpyLine(m,nm),[String(m.text||'').slice(0,700),m.from,m.type]));});(p.groups||[]).forEach(g=>{const gid=g.group_id||g.id;pfMsgList(p.groupMessages,gid).slice(-12).forEach((m,i)=>add('real-group',gid,m,m.id||m.message_id||i,'【真人群聊 '+pfGroupDisplayName(g)+'】'+pfSpyLine(m,pfNameById(m.from)||'成员'),[String(m.text||'').slice(0,700),m.from,m.type]));});}
    (S.friendRequests||[]).filter(r=>r.contactId!==id).slice(-8).forEach((r,i)=>add('friend-request',r.contactId,r,r.id||i,'好友申请 '+names(r.contactId)+'：'+(r.status||'待处理')+' '+(r.intent||r.msg||'')));
  }
  if(has('moments'))(S.moments||[]).filter(p=>(p.acct||'main')===account).forEach((p,pi)=>{
    const owner=p.id||rolePhoneRecordHash([p.authorId,p.time||0,p.text||''].join(':')),author=p.authorId==='me'?me:names(p.authorId),title=String(p.text||'图片动态').slice(0,100);
    if(p.authorId==='me')add('moment-post',owner,p,owner,'【朋友圈】'+me+'发布：'+title,p.text||'图片动态');
    if((p.likes||[]).includes(me))add('moment-like',owner,{time:p._myLikeAt||0},'me','【朋友圈点赞】'+me+'给'+author+'的「'+title+'」点了赞','like');
    (p.comments||[]).forEach((cm,ci)=>{if(cm.cid==='me'||!cm.cid&&cm.name===me)add('moment-comment',owner,cm,cm.id||cm.time||cm.text||ci,'【朋友圈评论】'+me+'在'+author+'的「'+title+'」下'+(cm.replyToName?'回复 @'+cm.replyToName:'评论')+'：'+cm.text,[cm.text,cm.replyToName||'']);});
  });
  for(const kind of ['douyin','x'])if(has(kind)){
    const d=kind==='douyin'?S.dy||{}:S.x||{},label=kind==='douyin'?'抖音':'X';
    (d.history||[]).slice(0,12).forEach((h,i)=>add(kind+'-search','',h,typeof h==='string'?h:h.id||i,'【'+label+'搜索】'+(typeof h==='string'?h:h.q||h.text||'')));
    (d.liked||[]).slice(0,12).forEach((v,i)=>add(kind+'-like','',v,v.id||v.author+':'+v.desc||i,'【'+label+'点赞】@'+(v.author||'')+' '+(v.desc||'')));
    (d.dms||[]).forEach(dm=>(dm.msgs||[]).slice(-8).forEach((m,i)=>add(kind+'-dm',dm.id||dm.name,m,m.id||m.time||m.text||m.content||i,'【'+label+'私信 '+dm.name+'】'+(m.from==='me'?me:dm.name)+'：'+(m.text||''),[m.text,m.from])));
    (d.tweets||[]).filter(t=>(t.acct||'main')===account).forEach((t,i)=>{const tid=t.id||rolePhoneRecordHash([t.who,t.time||0,t.text||''].join(':'));if(t.who==='me')add('x-post',tid,t,tid,'【X动态】'+me+'发布：'+t.text,t.text);if((t.likes||[]).includes(me))add('x-like',tid,{time:t._myLikeAt||0},'me','【X点赞】'+me+'给'+(t.name||t.who)+'的「'+String(t.text||'').slice(0,100)+'」点赞','like');(t.comments||[]).forEach((cm,ci)=>{if(cm.who==='me'||cm.name===me)add('x-comment',tid,cm,cm.id||cm.time||cm.text||ci,'【X评论】'+me+'给'+(t.name||t.who)+'评论：'+cm.text,cm.text);});});
  }
  if(has('wallet'))(S.me.bills||[]).slice(-20).forEach((b,i)=>add('bill','',b,b.id||i,'【钱包】'+b.note+' '+(b.type==='in'?'+':'-')+b.amount));
  if(has('browser'))(S.browser&&S.browser.history||[]).slice(0,20).forEach((h,i)=>add('browser','',h,h.id||h.time||i,'【浏览器搜索】'+h.q));
  if(has('phone')&&typeof phState==='function'){
    const p=phState();(p.recents||[]).slice(-12).forEach((r,i)=>add('phone-call',r.num,r,r.id||i,'【电话】'+(r.dir==='out'?'拨给':'接到')+phName(r.num)+' '+(r.kind||'语音')+' '+(r.status||'')+' '+(r.dur||0)+'秒'));
    Object.keys(p.sms||{}).forEach(k=>(p.sms[k]||[]).slice(-12).forEach((m,i)=>add('sms',k,m,m.id||m.time||m.text||m.content||i,'【短信 '+k+'】'+(m.from==='me'?me:k)+'：'+m.text,m.text)));
    (p.voicemail||[]).slice(-8).forEach((v,i)=>add('voicemail',v.num,v,v.id||i,'【语音留言】'+phName(v.num)+'：'+(v.text||'未接来电')));
  }
  if(has('food')&&typeof NorthMarketBusiness!=='undefined')NorthMarketBusiness.inspectionRows(c).forEach(o=>add('food-'+o.kind,account,{id:o.id,time:o.time},o.id,o.text,o.text));
  if(has('travel')){
    if(typeof NorthTravelTaxi!=='undefined')NorthTravelTaxi.rows().slice(-10).forEach(o=>add('taxi-order','',o,o.id,'【携程打车】'+NorthTravelTaxi.summary(o)));
    if(typeof NorthConcertBooking!=='undefined')NorthConcertBooking.rows().slice(-10).forEach(o=>add('concert-ticket','',o,o.id,'【携程演唱会】'+NorthConcertBooking.summary(o)));
    if(typeof NorthTrainBooking!=='undefined')NorthTrainBooking.rows().slice(-10).forEach(o=>add('train-ticket','',o,o.id,'【携程火车票】'+NorthTrainBooking.summary(o)));
    if(typeof NorthFlightBooking!=='undefined')NorthFlightBooking.rows().slice(-10).forEach(o=>add('flight-ticket','',o,o.id,'【携程机票】'+NorthFlightBooking.summary(o)));
    if(typeof NorthTravelOrders!=='undefined')NorthTravelOrders.rows().forEach(o=>add('attraction-ticket','',o,o.id,'【携程景点门票】'+NorthTravelOrders.summary(o)));
    (S.travel&&S.travel.trips||[]).filter(t=>!t.flightV2&&!t.railV2).slice(-10).forEach((t,i)=>add('trip','',t,t.id||i,'【小鱼旅行行程】'+t.date+' '+t.from+'→'+t.to+' '+(t.status||'')));
    (S.travel&&S.travel.hotels||[]).filter(h=>tvHotelOwned(h)&&(typeof NorthTravelOrders==='undefined'||NorthTravelOrders.visible(h,'hotel'))).slice(-10).forEach((h,i)=>add('hotel','',h,h.id||i,'【小鱼旅行酒店】'+h.checkIn+'入住 '+h.hotelName+' '+h.nights+'晚，'+tvHotelRoomText(h.roomType)+'，入住人'+tvHotelGuestText(h)+'，'+tvHotelStatusText(h.status)));
  }
  if(all){
    if(S.me.status)add('status','',{},'status','她自己写的动态：'+S.me.status);
    if(typeof lifeNotesForRole==='function')lifeNotesForRole(c).slice(0,5).forEach((n,i)=>add('life-note','',n,n.id||n.ts||n.text||i,'【情绪与约定】'+lifeNoteReadableText(n)+'（'+lifeNoteAuthorship(n,c)+'）'));
    if(typeof shopOrderRows==='function')shopOrderRows().filter(o=>!o.refunded).slice(0,8).forEach((o,i)=>add('order','',o,o.id||i,'【购物订单】'+shopOrderFact(o)));
    Object.keys(S.offline||{}).forEach(cid=>{const o=S.offline[cid],cc=getC(cid);if(!cc||cc.deleted||!o||!(o.started||(o.memory||[]).length||(o.msgs||[]).length))return;const last=(o.memory||[]).slice(-1)[0];add('offline',cid,{},'latest','【线下约会】和'+(cc.remark||cc.name)+' '+(o.when||'')+' '+(o.loc||'')+(last?' '+offMemText(last):''));});
  }
  return {label:({wechat:'微信聊天',moments:'朋友圈',douyin:'抖音',x:'X动态',wallet:'钱包账单',food:'美团购买与店铺顾客订单',phone:'电话/短信',browser:'浏览器搜索',travel:'小鱼旅行行程与酒店',overview:'手机动态'})[scope]||scope,data:records.length?records.map(r=>r.text).join('\n'):'本次没有新的内容。以前看过的记录不再列出，不得当成新发现重复提起。',records,account,scope,localRecords:true};
}
function rolePhoneLocalCommit(c,fact){if(!c||!fact||!Array.isArray(fact.records)||String(actId())!==fact.account)return false;c._phoneInspectionSeen=c._phoneInspectionSeen||{};const st=c._phoneInspectionSeen[fact.account]=c._phoneInspectionSeen[fact.account]||{seen:{}};st.seen=st.seen||{};fact.records.forEach(r=>{st.seen[r.key]=1;});st.checkedAt=Date.now();st.lastScope=fact.scope||fact.key;st.lastCount=fact.records.length;return true;}
function rolePhoneLocalStatus(c){const st=c&&c._phoneInspectionSeen&&c._phoneInspectionSeen[String(actId())];return st?'\n最近一次实际查看'+(st.lastCount?'已处理 '+st.lastCount+' 条当时未看过的记录。这些已经是旧内容。':'结果：没有新的内容。')+'不要从聊天历史找旧事冒充本次新发现。':'';}
/* End phone inspection ledger. */

function rolePhoneInspectionKey(focus,fd){const f=String(focus||fd&&fd.label||'').toLowerCase();if(/微信|聊天|联系人/.test(f))return'wechat';if(/睡眠|睡了多久|几点睡|睡觉时间|步数|走了多少步/.test(f))return'sleep-steps';if(/心率|心跳/.test(f))return'heart-rate';if(/屏幕|使用时长|使用时间|逐\s*app|应用时长/.test(f))return'screen-time';if(/电量|充电/.test(f))return'battery';if(/抖音/.test(f))return'douyin';if(/朋友圈/.test(f))return'moments';if(/电话|短信|通话|通讯录|来电|号码/.test(f))return'phone';if(/钱包|账单|消费|花钱/.test(f))return'wallet';if(/浏览|百度|网页/.test(f))return'browser';if(/定位|位置|在哪/.test(f))return'location';if(/推特|微博|\bx\b/.test(f))return'x';if(/云程|机票|旅行|行程|酒店|住宿|订房/.test(f))return'travel';return replyDedupNorm(f).slice(0,36)||'overview';}
function rolePhoneUsageSnapshotFromInspection(key,raw,label){if(key!=='screen-time'&&key!=='overview'&&!/(?:屏幕总使用|总屏幕使用|逐\s*App|实际使用|今日使用|使用时长|使用时间)/i.test(String(raw||'')+' '+String(label||'')))return null;const st=typeof companionRoleDataState==='function'?companionRoleDataState():null,day=String(st&&st.usageDay||''),zone=String(st&&st.usageTimeZone||'');if(!st||st.screenTimeAvailable!==true||!day||typeof companionUsageDayAt!=='function'||day!==companionUsageDayAt(Date.now(),zone))return null;const apps=(Array.isArray(st.apps)?st.apps:[]).map(x=>({name:String(x&&x.name||'').trim().slice(0,80),usedSec:Math.max(0,Number(x&&x.usedSec)||0)})).filter(x=>x.name&&Number.isFinite(x.usedSec)).slice(0,40),totalSec=Math.max(0,Number(st.screenTimeSec)||0);if(!totalSec&&!apps.length)return null;return{day,timeZone:zone,revision:Math.max(0,Number(st.usageRevision)||0),generatedAt:Math.max(0,Number(st.usageGeneratedAt)||0),totalSec,apps};}
function rolePhoneUsageAppsKey(apps){return(Array.isArray(apps)?apps:[]).map(x=>String(x&&x.name||'')+':'+Math.max(0,Number(x&&x.usedSec)||0)).join('|');}
function rolePhoneInspectionSignature(c,focus,fd){if(fd&&fd.localRecords)return{key:fd.scope,hash:rolePhoneRecordHash(fd.records.map(r=>r.key).join('|')),snapshot:fd.data,empty:!fd.records.length,records:fd.records,account:fd.account,localRecords:true};const key=rolePhoneInspectionKey(focus,fd),raw=String(fd&&fd.data||'').trim(),usage=rolePhoneUsageSnapshotFromInspection(key,raw,fd&&fd.label);let data=raw;if(key==='wechat'&&c&&typeof wxLoginWechatSummary==='function'&&!/完整微信/.test(String(fd&&fd.label||'')))data=wxLoginWechatSummary(c.id);const volatile=usage?/\d{1,2}:\d{2}(?::\d{2})?|(?:19|20)\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?/g:/\d{1,2}:\d{2}(?::\d{2})?|\d+\s*(?:秒|分钟|小时|天)前|(?:19|20)\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?/g;const snapshot=data.replace(volatile,'').split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n').slice(0,9000);data=snapshot.replace(/\s+/g,' ').trim();let hash=2166136261;for(let i=0;i<data.length;i++){hash^=data.charCodeAt(i);hash=Math.imul(hash,16777619);}return{key,hash:(hash>>>0).toString(36),empty:!data,usage,snapshot};}
function rolePhoneInspectionUnchanged(c,fact){const old=c&&c._phoneInspectionFacts&&c._phoneInspectionFacts[fact.key];if(!old||old.hash!==fact.hash)return false;if(!fact.usage)return true;const a=old.usage,b=fact.usage;return !!(a&&a.day===b.day&&+a.revision===+b.revision&&+a.generatedAt===+b.generatedAt&&+a.totalSec===+b.totalSec&&rolePhoneUsageAppsKey(a.apps)===rolePhoneUsageAppsKey(b.apps));}
function rolePhoneInspectionNovelText(c,fact){if(fact&&fact.localRecords)return fact.snapshot;const current=String(fact&&fact.snapshot||'').trim(),old=c&&c._phoneInspectionFacts&&fact&&c._phoneInspectionFacts[fact.key];if(!current||!old||!old.snapshot)return current;const seen=new Set(String(old.snapshot).split(/\n+/).map(x=>x.trim()).filter(Boolean)),fresh=current.split(/\n+/).map(x=>x.trim()).filter(x=>x&&!seen.has(x)&&!/^(?:【最近两天微信上下文摘要】|说明：)/.test(x));return fresh.join('\n').slice(0,6000);}
function rolePhoneInspectionCommit(c,fact,channel){if(!c||!fact)return;if(fact.localRecords&&!rolePhoneLocalCommit(c,fact))return;c._phoneInspectionFacts=c._phoneInspectionFacts&&typeof c._phoneInspectionFacts==='object'?c._phoneInspectionFacts:{};const row={hash:fact.hash,channel:channel==='cohab'?'cohab':'online',ts:Date.now(),snapshot:String(fact.snapshot||'').slice(0,9000)};if(fact.usage)row.usage={day:String(fact.usage.day||''),timeZone:String(fact.usage.timeZone||''),revision:+fact.usage.revision||0,generatedAt:+fact.usage.generatedAt||0,totalSec:+fact.usage.totalSec||0,apps:(fact.usage.apps||[]).map(x=>({name:String(x.name||'').slice(0,80),usedSec:+x.usedSec||0})).slice(0,40)};c._phoneInspectionFacts[fact.key]=row;save(500);if(row.usage&&typeof roleServerPushSyncSoon==='function')roleServerPushSyncSoon(c.id);}
function rolePhoneAuthoritativeUsage(c,now){now=Number.isFinite(+now)?+now:Date.now();const rows=Object.values(c&&c._phoneInspectionFacts&&typeof c._phoneInspectionFacts==='object'?c._phoneInspectionFacts:{}).filter(x=>x&&x.usage),today=typeof companionUsageDayAt==='function'?companionUsageDayAt(now,''):'';return rows.map(x=>({row:x,usage:x.usage})).filter(x=>x.usage&&x.usage.day&&x.usage.day===(typeof companionUsageDayAt==='function'?companionUsageDayAt(now,x.usage.timeZone||''):today)).sort((a,b)=>(+b.usage.generatedAt||+b.row.ts||0)-(+a.usage.generatedAt||+a.row.ts||0)||(+b.usage.revision||0)-(+a.usage.revision||0))[0]||null;}
function rolePhoneAuthoritativeUsageContext(c){const hit=rolePhoneAuthoritativeUsage(c),u=hit&&hit.usage;if(!u)return'';const apps=(u.apps||[]).filter(x=>x&&x.name&&Number.isFinite(+x.usedSec)).sort((a,b)=>+b.usedSec-+a.usedSec).slice(0,16),parts=[];if(+u.totalSec>0)parts.push('今日屏幕总使用 '+companionDuration(+u.totalSec));if(apps.length)parts.push('逐 App 今日实际使用：'+apps.map(x=>x.name+' '+companionDuration(+x.usedSec)).join('、'));if(!parts.length)return'';return '\n\n# 角色最近亲自读取的真实 iPhone 当日使用事实（当前值，优先于聊天旧数字）\n数据日期 '+u.day+'；'+parts.join('；')+'。\n你刚才已经亲自读到这些值。聊天记录里同一项目不同的分钟数只表示更早数据，不是当前值；本轮若谈及当前使用时长必须以这里为准。只在话题相关时按人设自然说，不要机械汇报，不要提系统、规则、快照或读取编号。';}
function rolePhoneUsageClaimMinutes(text){const h=String(text||'').match(/(\d+)\s*小时(?:\s*(\d+)\s*分钟)?/);if(h)return Math.max(0,+h[1]*60+(+h[2]||0));const m=String(text||'').match(/(\d+)\s*分钟/);return m?Math.max(0,+m[1]):null;}
//@@ web
function rolePhoneUsageConflict(c,text){const hit=rolePhoneAuthoritativeUsage(c),u=hit&&hit.usage;if(!u)return false;const apps=(u.apps||[]).filter(x=>x&&x.name&&Number.isFinite(+x.usedSec)),sentences=String(text||'').match(/[^。！？!?\n]*[。！？!?\n]+|[^。！？!?\n]+$/g)||[];return sentences.some(s=>{if(/(?:之前|先前|此前|当时|原来|旧数据|较早|上次|昨晚)/.test(s))return false;for(const app of apps){const name=String(app.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),r1=new RegExp(name+'[^。！？!?\\n]{0,18}?(\\d+\\s*小时(?:\\s*\\d+\\s*分钟)?|\\d+\\s*分钟)','i'),r2=new RegExp('(\\d+\\s*小时(?:\\s*\\d+\\s*分钟)?|\\d+\\s*分钟)[^。！？!?\\n]{0,18}?'+name,'i'),m=s.match(r1)||s.match(r2);if(m){const claimed=rolePhoneUsageClaimMinutes(m[1]),actual=Math.floor((+app.usedSec||0)/60);if(claimed!=null&&Math.abs(claimed-actual)>1)return true;}}if(+u.totalSec>0&&/(?:屏幕|总使用)/.test(s)){const claimed=rolePhoneUsageClaimMinutes(s),actual=Math.floor(+u.totalSec/60);if(claimed!=null&&Math.abs(claimed-actual)>1)return true;}return false;});}
//@@ private
function rolePhoneUsageConflict(c,text){const hit=rolePhoneAuthoritativeUsage(c),u=hit&&hit.usage;if(!u)return false;const apps=(u.apps||[]).filter(x=>x&&x.name&&Number.isFinite(+x.usedSec)),sentences=String(text||'').split(/(?<=[。！？!?\n])/);return sentences.some(s=>{if(/(?:之前|先前|此前|当时|原来|旧数据|较早|上次|昨晚)/.test(s))return false;for(const app of apps){const name=String(app.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),r1=new RegExp(name+'[^。！？!?\\n]{0,18}?(\\d+\\s*小时(?:\\s*\\d+\\s*分钟)?|\\d+\\s*分钟)','i'),r2=new RegExp('(\\d+\\s*小时(?:\\s*\\d+\\s*分钟)?|\\d+\\s*分钟)[^。！？!?\\n]{0,18}?'+name,'i'),m=s.match(r1)||s.match(r2);if(m){const claimed=rolePhoneUsageClaimMinutes(m[1]),actual=Math.floor((+app.usedSec||0)/60);if(claimed!=null&&Math.abs(claimed-actual)>1)return true;}}if(+u.totalSec>0&&/(?:屏幕|总使用)/.test(s)){const claimed=rolePhoneUsageClaimMinutes(s),actual=Math.floor(+u.totalSec/60);if(claimed!=null&&Math.abs(claimed-actual)>1)return true;}return false;});}
//@@ end
function rolePhoneUsageStripConflicts(c,text){return String(text||'').split(/\n+/).filter(line=>!rolePhoneUsageConflict(c,line)).join('\n').trim();}
let _roleDiaryBusy=false;
function roleDiaryDayStart(t){const d=new Date(t||Date.now());d.setHours(0,0,0,0);return d.getTime();}
function roleDiaryDateKey(t){const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function roleDiaryDisplayDate(t){return ymd(roleDiaryDayStart(t)+12*3600000);}
function roleDiaryHasDay(sp,t){const key=roleDiaryDateKey(t),label=roleDiaryDisplayDate(t);return !!(sp&&Array.isArray(sp.diaryLog)&&sp.diaryLog.some(x=>x&&(x.dayKey===key||x.date===label)));}
function roleDiaryTodayIndex(sp){const key=roleDiaryDateKey(Date.now()),label=roleDiaryDisplayDate(Date.now());return sp&&Array.isArray(sp.diaryLog)?sp.diaryLog.findIndex(x=>x&&(x.dayKey===key||x.date===label)):-1;}
function roleDiaryPrune(sp,now){if(!sp)return false;now=+now||Date.now();sp.diaryLog=Array.isArray(sp.diaryLog)?sp.diaryLog:[];let changed=false;if(!sp._diaryLegacyMigrated){if(sp.diary&&!sp.diaryLog.length)sp.diaryLog.push({id:uid(),date:ymd(sp.time||now),time:sp.time?hm(sp.time):'',text:String(sp.diary),favorite:true,legacy:true});sp._diaryLegacyMigrated=true;changed=true;}const kept=sp.diaryLog.filter(e=>e&&String(e.text||'').trim()&&(e.favorite||!e.expiresAt||+e.expiresAt>now));if(kept.length!==sp.diaryLog.length){sp.diaryLog=kept;changed=true;}sp.diaryLog.forEach(e=>{if(!e.id){e.id=uid();changed=true;}});if(changed)save(0);return changed;}
function roleDiaryRecentFacts(c,start,end){const rows=[];(msgs(c.id)||[]).forEach(m=>{const at=+m.time||+m.ts||0;if(!m||at<start||at>=end||m.type==='sys'||m._callTranslationOf)return;const text=String(msgToText(m)||'').replace(/\s+/g,' ').trim();if(!text)return;const source=m._call?(m._ck==='video'?'视频通话':'语音通话'):'微信',who=m.role==='user'?S.me.name:(c.remark||c.name);rows.push({at,text:'['+source+']['+who+'] '+text.slice(0,260)});});const home=S.cohabitation&&S.cohabitation.homes&&S.cohabitation.homes[c.id];(home&&home.msgs||[]).forEach(m=>{const at=+m.time||0;if(!m||at<start||at>=end||m.who==='日期')return;const text=String(m.text||'').replace(/\s+/g,' ').trim();if(!text)return;const who=m.who==='me'?S.me.name:m.who==='旁白'?'共同生活现场':(c.remark||c.name);rows.push({at,text:'[共同生活]['+who+'] '+text.slice(0,260)});});return rows.sort((a,b)=>a.at-b.at).slice(-36).map(x=>fmtDT(x.at)+' '+x.text).join('\n');}
async function roleDiaryGenerateDay(c,sp,dayStart,rewrite){roleDiaryPrune(sp,Date.now());if(!rewrite&&roleDiaryHasDay(sp,dayStart))return true;const end=Math.min(dayStart+86400000,Date.now()),facts=roleDiaryRecentFacts(c,dayStart,end),previous=(sp.diaryLog||[]).filter(x=>x.favorite||!x.expiresAt).slice(0,3).map(x=>x.date+(x.time?' '+x.time:'')+'：'+x.text).join('\n'),dayKey=roleDiaryDateKey(dayStart),label=roleDiaryDisplayDate(dayStart),prompt='请替你自己写 '+label+' 的一篇私人日记。\n\n# 当天真实发生的事\n'+(facts||'当天没有留下新的微信、通话或共同生活记录。')+(previous?'\n\n# 最近保留的旧日记（只保持人物连续性，不得重复抄写）\n'+previous:'')+(rewrite&&rewrite.text?'\n\n# 今天已经写过的一版（这次是重写：换一种写法和侧重点，不要照抄）\n'+String(rewrite.text).slice(0,600):'')+'\n\n只写第一人称中文日记正文，记录当天真正值得写的事和你真实的心情。篇幅完全跟随当天内容：事情很少时可以只有一句或很短；事情多时可以写得更完整，但不要凑字数、不要流水账。只能依据上面的真实记录；没有记录时可以写这一天很安静以及符合人设的感受，但不能虚构新的见面、争吵、礼物、承诺或对话。不要写标题、日期、时间、JSON、系统说明、字幕提示或括号动作。';let text='';for(let attempt=0;attempt<2&&!text;attempt++){try{let raw=await chatAPI([{role:'system',content:buildSystem(c)+'\n你现在是在自己的手机里写私人日记，不是在给'+S.me.name+'发消息。'},{role:'user',content:prompt+(attempt?'\n\n上一版不是自然的日记正文。现在只重写一次正文，仍然使用同一天的真实内容。':'')}],Object.assign({max:letterReplyBudget(c),temp:.55,complete:true},typeof spyRouteOpt==='function'?spyRouteOpt(c,!!(S.settings&&S.settings.spyAux)):{aux:!!(S.settings&&S.settings.spyAux)}));raw=cleanReply(roleVisibleEnvelopeText(raw)).replace(/^\s*(?:日记|正文)\s*[：:]\s*/,'').trim();if(raw&&Array.from(raw).length>=2&&!isRefusal(raw)&&!splitBubbles(raw).some(isOOCLine)&&!/^(?:正在|已为你|以下是|系统|字幕)/.test(raw))text=raw.slice(0,8000);}catch(_){}}
  if(!text)return false;const openedAt=Date.now(),d=new Date(),latestMinute=dayKey===roleDiaryDateKey(openedAt)?Math.max(0,d.getHours()*60+d.getMinutes()):1439,minute=Math.floor(Math.random()*(latestMinute+1)),time=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0'),entry={id:uid(),date:label,dayKey,time,text,generatedAt:openedAt,openedAt,favorite:false,expiresAt:openedAt+86400000,automatic:true};if(rewrite){const old=sp.diaryLog.indexOf(rewrite);if(old>=0){Object.assign(rewrite,{text,generatedAt:openedAt,rewrittenAt:openedAt});if(dayKey===roleDiaryDateKey(Date.now()))sp.diary=text;save(0);return true;}}if(roleDiaryHasDay(sp,dayStart))return true;sp._diaryLegacyMigrated=true;sp.diaryLog.push(entry);sp.diaryLog.sort((a,b)=>String(b.dayKey||'').localeCompare(String(a.dayKey||''))||String(b.time||'').localeCompare(String(a.time||'')));if(dayKey===roleDiaryDateKey(Date.now()))sp.diary=text;save(0);return true;}
/* SPY_PARSE_LENIENT_V1（2026-10-30 别人用网页版刷新查他手机一直报「模型没有按格式写完」，加了自动续写也没好，4 次重试全失败）：
   去掉模型夹带的思考和多余的话；被截断时再接着写最多两次；还是不完整就把前面写完的部分先用上；仍失败就说清是哪一种，并留下模型原话给她看。 */
let _spyLastRaw=null;
function spyJsonText(t){t=String(t||'').replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi,'').replace(/^[\s\S]*?<\/think(?:ing)?>/i,'');const fb=t.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);if(fb&&fb[1].indexOf('{')>=0)t=fb[1];const a=t.indexOf('{');return a>=0?t.slice(a):'';}
function spyJsonOpen(t){const st=[];let q=false,e=false;for(const ch of String(t||'')){if(q){if(e)e=false;else if(ch==='\\')e=true;else if(ch==='"')q=false;continue;}if(ch==='"')q=true;else if(ch==='{'||ch==='[')st.push(ch);else if(ch==='}'||ch===']'){st.pop();if(!st.length)return false;}}return st.length>0;}
function spyJsonRepair(t){t=String(t||'');let st=[],q=false,e=false,cut=-1,snap=null;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(e)e=false;else if(ch==='\\')e=true;else if(ch==='"')q=false;continue;}if(ch==='"'){q=true;continue;}if(ch==='{'||ch==='['){st.push(ch);continue;}if(ch==='}'||ch===']'){st.pop();if(!st.length)return t.slice(0,i+1);cut=i+1;snap=st.slice();continue;}if(ch===','){cut=i;snap=st.slice();}}if(cut<0||!snap)return '';return t.slice(0,cut)+snap.reverse().map(x=>x==='{'?'}':']').join('');}
function spyParseLoose(content){const t=spyJsonText(content);if(!t)return null;try{const o=parseObj(t);if(o&&typeof o==='object'&&!Array.isArray(o))return o;}catch(_){}try{const r=spyJsonRepair(t);if(r){const o=parseObj(r);if(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length)return o;}}catch(_){}return null;}
/* SPY_ROLE_ROUTE_V1（2026-10-30 群里有人说：查他手机设了副模型，站子记录却是主模型；她定的规则：角色配的是哪条线路就用哪条，打开「查他手机·刷新用副模型」就用那条线路的副模型，没填副模型就用它的主模型）：
   以前刷新和日记不传线路，用的是设置里当前选中的那条线路和它的副模型，角色单独配了线路时就对不上。 */
function spyRouteOpt(c,useAux){const o={aux:!!useAux};if(c&&typeof roleChatRouteIndex==='function'){const i=roleChatRouteIndex(c);if(i!==undefined&&i!==null&&i!==''){o.routeIndex=i;o.independentRoleModel=true;}}return o;}
async function spyContinueJson(msgs,content,aux){for(let k=0;k<2;k++){const t=spyJsonText(content);if(!t||!spyJsonOpen(t))break;let more='';try{more=await chatAPI([...msgs,{role:'assistant',content:String(content)},{role:'user',content:'[系统：上面的 JSON 被长度上限截断了。从断掉的那个字符直接接着写，一直写到整个 JSON 结束；不要重头写，不要加说明，不要加代码块符号。]'}],Object.assign({max:3000},aux&&typeof aux==='object'?aux:{aux:!!aux}));}catch(_){break;}more=String(more||'').replace(/^\s*```(?:json)?\s*/i,'');if(!more.trim())break;content=joinAIContinuation(content,more);}return content;}
function spyFailWhy(content){const raw=String(content||'').trim();if(!raw)return '模型返回了空内容';const t=spyJsonText(raw);if(!t){const vis=raw.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi,'').trim();return vis?'模型没有写 JSON，直接说了别的话（开头是：'+vis.replace(/\s+/g,' ').slice(0,24)+'…）':'模型只写了思考，没写正文（可能思考把长度用完了）';}if(spyJsonOpen(t))return '模型写到一半就断了，接着写了两次也没写完';return '模型写的 JSON 格式不对，读不出来';}
function spyRawKeep(id,content,why){_spyLastRaw={id,at:Date.now(),why:String(why||''),text:String(content||'').slice(0,6000)};}
function spyRawShow(){const r=_spyLastRaw;if(!r){toast('没有失败记录');return;}openModal(`<h3>模型原话</h3><div style="font-size:12px;color:#888;margin-bottom:6px">${esc(r.why)}（共 ${String(r.text||'').length} 字，最多显示 6000 字）</div><pre style="white-space:pre-wrap;word-break:break-all;max-height:55vh;overflow:auto;font-size:12px;background:rgba(0,0,0,.04);padding:8px;border-radius:8px">${esc(r.text||'（空）')}</pre><div class="btns"><button class="btn p" onclick="closeModal()">关闭</button></div>`);}
async function spyRefresh(id){if(_spyBusy){toast('正在刷新，别急~');return;}const c=getC(id);if(!c)return;hisSeed(id);_spyBusy=true;if(cur().p==='spy')render();
  try{/* 转账回执不能以 system 身份夹在对话中间：部分接口会直接拒绝整次请求。 */const hist=msgs(id).slice(-16).map(m=>({role:m.role==='assistant'&&!m._transferReceipt?'assistant':'user',content:msgToText(m)})).filter(x=>x.content!=null);
    const wn=whereNow(c);const tnote='现在是'+hm()+'。'+(wn?'按你的作息，你此刻应该：'+wn+'。location 必须符合这个时间点，别老是在公司/开会——上班才在单位，午休在吃饭，下班后到处跑、晚上回家。':'');
    const prev=S.spy[id];const pnote=prev?('\n上次偷看时你手机里的状态：地点「'+(prev.location||'')+'」；日记「'+(prev.diary||'')+'」；'+(prev.friends&&prev.friends.length?'最近加的人「'+prev.friends.join('、')+'」。':'')+'\n这次在上次基础上自然往前推进、有连续性，别整个推翻重来。'):'';
    const intro=(c._gotFromMe||[]).filter(Boolean);const inote=intro.length?('\n你微信里有'+S.me.name+'介绍你加的这些好友：'+intro.join('、')+'，wechat 里【一定要包含】你和其中一两个人的真实聊天（who 用ta们的名字），再加一两个别的人。'):'';
    const prompt=tnote+pnote+inote+(typeof relSpyNote==='function'?relSpyNote(id):'')+'\n你来扮演'+(c.remark||c.name)+'，根据你们最近的聊天、你的人设和此刻作息，生成此刻"你自己手机里"的真实私密内容，要具体、有生活气息、像真手机，能和聊天呼应，可带点没告诉对方的小心思。\n注意：微信里【不要】生成你和'+S.me.name+'的对话（那个系统会自动显示你们真实的聊天）；wechat 只写你和【别人】的聊天。只输出 JSON，不要解释：\n{'
      +'"location":"你此刻在哪(符合上面时间作息)",'
      +'"mood":"你此刻的心情/状态，一句",'
      +'"messageToYou":"你今天想对'+S.me.name+'说的一句简短的话，第一人称，自然符合人设，15至35字，不写标签或旁白",'
      +'"balance":你钱包当前的余额总数(一个合理的数字，符合你身份),'
      +'"todo":[{"text":"今天的一项安排","time":"如 08:00-09:00 或 16:30","done":true或false}],'
      +'"calls":[{"who":"谁(如 妈妈/同事/陌生号码)","type":"语音或视频","dur":"如3分12秒","when":"如 刚刚/上午10点"}],'
      +'"sms":[{"num":"陌生短信号码","text":"最近收到的短信正文","from":"them","when":"如 刚刚/上午10点"}],'
      +'"album":["相册里最近的一张照片是什么画面","另一张"],'
      +'"browser":["最近搜索或浏览的1","2","3"],'
      +'"orders":[{"item":"网购/外卖买了啥","amount":数字,"when":"今天/昨天"}],'
      +'"wallet":[{"item":"支出/收入名目","amount":正数或负数}],'
      +'"wechat":[{"who":"别人(如 同事老张/前任/妈妈，别写'+S.me.name+')","relation":"这个人是你的什么关系，亲属用准确称谓如妹妹/妈妈；不是亲属写朋友或同事","lines":["他：你自己说的话(一律用「他：」开头)","对方：那个人回的话(一律用「对方：」开头)"]}]（lines里你自己说的必须用"他："开头、对方的用"对方："开头，别用"我："也别写名字）,'
      +'"groups":[{"name":"你在的一个微信群名(如 家族群/兄弟局/公司部门群)","lines":["某成员：说的话","另一成员：回的话","他：你说的话"]}],'
      +'"contacts":[{"name":"通讯录里的人","note":"关系如 同事/家人","added":"如 3天前/上周/很久了"}],'
      +'"friends":["新加的好友及原因"]}';
    let ng=null,_sys='',_spyWhy='';try{_sys=buildSystem(c);}catch(_be){_sys=(c.persona||'')+'（你是'+(c.remark||c.name)+'）';}
    for(let _i=0;_i<4&&!ng;_i++){if(_i>0)await new Promise(r=>setTimeout(r,_i*500));
      try{/* 这份 JSON 很长，会先思考的模型也把思考算进额度；1200 常写到一半被截断。 *//* SPY_REFRESH_COMPLETE_V1（2026-10-30 她截图：网页版查他手机刷新总报「模型没有按格式写完」，私人版正常）：这份手机数据很长，模型写满上限就被截成半段；这里以前没开写不完自动续写。 */const _spyMsgs=[{role:'system',content:_sys},...hist,{role:'user',content:prompt}],_spyAuxOn=!!(S.settings&&S.settings.spyAux),_spyRoute=spyRouteOpt(c,_spyAuxOn);let content=await chatAPI(_spyMsgs,Object.assign({max:4000,complete:true},_spyRoute));content=await spyContinueJson(_spyMsgs,content,_spyRoute);
        try{ng=parseObj(content);}catch(_p){try{ng=JSON.parse(stripJSON(content));}catch(_p2){ng=null;}}if(!ng||typeof ng!=='object')ng=spyParseLoose(content);if(!ng||typeof ng!=='object'){ng=null;_spyWhy=spyFailWhy(content);spyRawKeep(id,content,_spyWhy);}}catch(_e){ng=null;_spyWhy=String(_e&&_e.message||_e||'请求失败').slice(0,120);}}
    if(!ng){_spyBusy=false;if(cur().p==='spy')render();toast('生成失败：'+(_spyWhy||'原因未知')+(_spyLastRaw&&_spyLastRaw.id===id?'。到查手机的设置里点「看模型原话」能看到它写了什么':'，再点一次刷新试试'),6500);return;}if(_spyLastRaw&&_spyLastRaw.id===id)_spyLastRaw=null;
    // 合并：刷新【不清掉】已有的——余额/通讯录/日记历史/今日日程/他看到的我的动态都保留
    const data=Object.assign({},prev||{},ng);data.time=Date.now();data.messageToYou=String((typeof ng.messageToYou==='string'?ng.messageToYou:'')||(prev&&prev.messageToYou)||'').replace(/\s+/g,' ').trim().slice(0,60);
    if(Array.isArray(ng.calls))data.calls=ng.calls.map(x=>Object.assign({},x,{_snapshotAt:data.time}));
    if(Array.isArray(ng.sms))data.sms=ng.sms.map(x=>Object.assign({},x,{_snapshotAt:data.time}));
    data.balance=(ng.balance!=null)?+ng.balance:((prev&&prev.balance!=null)?prev.balance:(2000+Math.floor(Math.random()*9000)));
    // 日记只在独立日记 App 解锁并打开时准备；普通手机刷新不得生成或覆盖
    data.diaryLog=(prev&&prev.diaryLog)?prev.diaryLog.slice():[];
    data.diary=(prev&&prev.diary)||'';data._diaryLegacyMigrated=!!(prev&&prev._diaryLegacyMigrated);
    // 今日日程：当天只生成一次，保留已勾选的状态
    if(prev&&prev.todo&&prev.todo.date===todayStr())data.todo=prev.todo;// 同一天保留已勾选状态
    else data.todo={date:todayStr(),items:(ng.todo&&ng.todo.length?ng.todo:[]).map(x=>({text:''+(x.text||''),time:''+(x.time||''),done:!!x.done}))};
    // 通讯录：合并去重保留旧的添加历史
    {const old=(prev&&prev.contacts)||[];const add=(ng.contacts||[]).filter(n=>n&&n.name&&!old.some(o=>o.name===n.name));data.contacts=old.concat(add).slice(0,40);}
    // 他看到的我的动态：保留你删过的，不刷新覆盖（有单独的刷新按钮）
    data.watched=(prev&&prev.watched)||[];
    // 真实的马甲聊天(别人用自己号来找他聊的)并进微信,让查岗能看到真实的、和他记得的一致
    {const _ak=Object.keys(S.alter||{}).filter(k=>k.split('@')[1]===id&&(S.alter[k]||[]).length);
      const _real=_ak.map(k=>{const xId=k.split('@')[0];const xc=getC(xId);const nm=xc?(xc.remark||xc.name):'某人';return {who:nm,lines:(S.alter[k]||[]).slice(-8).map(m=>(m.role==='user'?nm:'他')+'：'+(m.content||'').replace(/\n/g,' ').slice(0,60))};});
      if(_real.length)data.wechat=_real.concat(data.wechat||[]);}
    S.spy[id]=data;hisSeed(id);if(typeof phSyncRolePhoneRecords==='function')phSyncRolePhoneRecords(id);save();_spyBusy=false;
    if(cur().p==='spy')render();toast('刷新好了 👀');
  }catch(e){_spyBusy=false;if(cur().p==='spy')render();toast('生成失败了，再点一次刷新试试');}}

/* ---------- 购物 ---------- */
let _shopBusy=false;
function shopOrderIsDirectGift(order){return !!(order&&(order.kind==='gift'||(order.parcel&&order.shop==='礼物'&&order.kind!=='pay'&&order.kind!=='self')));}
function shopOrderRows(){return (S.shop&&S.shop.orders||[]).filter(order=>!shopOrderIsDirectGift(order));}
function shopOrderPayerName(order){if(!order||order.kind!=='pay')return'';if(order.payerName)return order.payerName;const parcel=(S.giftbox||[]).find(g=>g&&g.id===order.id),cid=order.cid||(parcel&&parcel.cid),c=cid&&getC(cid);return c?(c.remark||c.name):'TA';}
function shopOrderTag(order){return order&&order.kind==='pay'?shopOrderPayerName(order)+'代付':order&&order.kind==='self'?'自购':'';}
function shopOrderFact(order){const tag=shopOrderTag(order);return (order.item||order.name||'商品')+' ¥'+(+order.price||0).toFixed(2)+(tag?'（'+tag+'）':'');}
function renderShop(){coInit();const r=S.shop.results||[];const cartN=(S.shop.cart||[]).length;
  const orderN=shopOrderRows().filter(o=>!o.refunded).length;const co=S.shop.co;
  return `<div class="nav shop-nav"><span class="l" onclick="back()">‹</span><span class="t">购物</span><span class="r" onclick="openOrders()">${svgIc('bag',20,'#fff')}${orderN?'<span class="badge" style="margin-left:2px">'+orderN+'</span>':''}</span></div>
    <div style="padding:6px 12px;text-align:right;background:#111;border-bottom:.5px solid #2a2a2c">${co.on?'':'<button class="minibtn" style="background:#ff8fab;color:#fff" onclick="coInvite()">👫 邀他一起逛</button> '}<button class="minibtn" onclick="openCart()">购物车${cartN?'('+cartN+')':''}</button> <button class="minibtn" onclick="openOrders()">我的订单${orderN?'('+orderN+')':''}</button> <button class="minibtn" style="background:#ff6b6b;color:#fff" onclick="go('shopcs')">客服</button></div>
    ${co.on?coPanel():''}
    <div style="padding:10px 12px;background:#1c1c1e;display:flex;gap:8px;border-bottom:.5px solid #2a2a2c">
      <input id="shop_q" value="${esc(S.shop.q||'')}" placeholder="搜索想要的东西…" style="flex:1;border:1px solid #38383a;border-radius:18px;padding:8px 14px;background:#2c2c2e;color:#eee;outline:none">
      <button class="send" onclick="shopSearch()" ${_shopBusy?'disabled':''}>${_shopBusy?'…':'搜'}</button></div>
    <div class="scroll shop-scroll" data-render-scroll-key="shop:${esc(String(actId()))}:${esc(S.shop.q||'')}" style="background:#000">${_shopBusy?'<div class="empty">🔎 正在搜索…</div>':(r.length?r.map(shopCard).join(''):'<div class="empty">搜点你想要的吧～<br>比如「香薰」「小裙子」「盲盒」</div>')}<div style="height:20px"></div></div>`;}
function shopCard(p,i){return `<div class="mpost" style="align-items:center">
    <div class="avatar" style="width:64px;height:64px;flex-basis:64px;font-size:34px;border-radius:10px;background:linear-gradient(135deg,#ffd6e8,#d6e4ff)">${p.emoji||'🛍️'}</div>
    <div class="body"><div style="font-size:15px;color:#eee">${esc(p.name)}</div>
      <div style="font-size:12px;color:#888;margin:3px 0">${esc(p.shop||'好物商城')} · ${esc(p.desc||'')}</div>
      <div style="color:#ff6b6b;font-size:17px;font-weight:600">¥${(+p.price).toFixed(2)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        ${(S.shop.co&&S.shop.co.on)?`<button class="minibtn" style="background:#ff8fab;color:#fff" onclick="coAskHim(${i})">想要·问他</button>`:''}
        <button class="minibtn" onclick="addCart(${i})">加购物车</button>
        <button class="minibtn" onclick="buyNow(${i})">立即购买</button>
        <button class="minibtn" onclick="giftFlow(${i})">送给TA</button>
        <button class="minibtn" onclick="payFlow(${i})">让TA代付</button>
        ${familyContacts().length?`<button class="minibtn" style="background:#e8527f;color:#fff" onclick="familyPayFlow([S.shop.results[${i}]])">用亲属卡付</button>`:''}
      </div></div></div>`;}
async function shopSearch(){if(_shopBusy)return;const q=($('#shop_q')?$('#shop_q').value:'').trim();if(!q){toast('搜点啥呢');return;}
  S.shop.q=q;_shopBusy=true;render();
  try{const arr=await aiGen([{role:'system',content:'你是购物App的搜索引擎。根据关键词生成6件相关商品，价格合理（人民币）。只输出JSON数组，不要解释：[{"name":"商品名","price":数字,"shop":"店铺名","desc":"一句卖点","emoji":"一个相关emoji"}]'},{role:'user',content:'搜索：'+q}],{max:700,aux:true},parseArr);
    _shopBusy=false;
    if(!arr||!arr.length){render();toast('搜索失败了，再试一次');return;}
    S.shop.results=arr;render();
  }catch(e){_shopBusy=false;render();toast('搜索失败，再试一次');}}
function addCart(i){const p=S.shop.results[i];if(!p)return;S.shop.cart.push(p);save();render();toast('已加入购物车 🛒');}
function buyNow(i){const p=S.shop.results[i];if(!p)return;doBuy([p],'self');}
function openCart(){const cart=S.shop.cart||[];const total=cart.reduce((s,p)=>s+(+p.price),0);
  openModal(`<h3>购物车</h3>${cart.length?cart.map((p,i)=>`<div class="bill"><div>${p.emoji||'🛍️'} ${esc(p.name)}${p._coBy==='ta'?'<span style="color:#ff8fab;font-size:10px;margin-left:4px">他挑·你同意</span>':p._coBy==='me'?'<span style="color:#8fb7ff;font-size:10px;margin-left:4px">你挑·他同意</span>':''}<small>${esc(p.shop||'')}</small></div><div>¥${(+p.price).toFixed(2)} <span onclick="S.shop.cart.splice(${i},1);save();openCart()" style="color:#fa5151;cursor:pointer;margin-left:6px">✕</span></div></div>`).join('')+`<div style="text-align:right;padding:10px 4px;font-size:16px;color:#ff6b6b">合计 ¥${total.toFixed(2)}</div><div class="btns"><button class="btn p" onclick="cartBuySelf()">自己买单</button><button class="btn g" onclick="closeModal();cartPayFlow()">让TA代付</button></div>${familyContacts().length?`<button class="btn g" style="margin-top:8px;background:#e8527f;color:#fff" onclick="closeModal();familyPayFlow(S.shop.cart.slice())">用亲属卡付</button>`:''}`:'<div class="empty">购物车空空的</div>'}<button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function doBuy(items,who){if(!items.length)return;const total=items.reduce((s,p)=>s+(+p.price),0);
  if(who==='self'){if(total>S.me.balance){toast('余额不够啦（去钱包改余额）');return;}
    items.forEach(p=>{addBill('out',+p.price,'在'+(p.shop||'商城')+'买了'+p.name);parcelDeliver(null,p.name,+p.price,'self',{emoji:p.emoji||'🛒',shop:p.shop||'商城'});});
    S.shop.cart=S.shop.cart.filter(c=>!items.includes(c));save();closeModal();render();toast('下单成功 ¥'+total.toFixed(2)+'，已发货，预计明天到信箱');return true;}}
// 购物车「自己买单」：买成功后如果在一起逛,记进记忆并自动退出
function cartBuySelf(){const items=(S.shop.cart||[]).slice();if(doBuy(items,'self'))coFinalize(items,'me');}
function orderEta(ts){const ms=ts-Date.now();if(ms<=0)return '即将到达';const h=Math.floor(ms/3600000);const m=Math.floor((ms%3600000)/60000);return h>0?('还有约 '+h+' 小时'+(m?m+'分':'')+' 到货'):('还有约 '+Math.max(1,m)+' 分钟到货');}
function spyShopOrderRows(id){const legacy=((S.spy&&S.spy[id]&&S.spy[id].orders)||[]).map(o=>Object.assign({},o,{name:o.item||o.name||'商品',price:Math.abs(Number(o.amount!=null?o.amount:o.price)||0),when:o.when||'',status:o.status||'购买记录'}));
  const actual=((S.roleFamily&&S.roleFamily.orders)||[]).filter(o=>o.account===String(actId()||'main')&&o.cid===id).map(o=>Object.assign({},o,{name:o.item,price:o.cents/100,when:o.time?northLocaleDate(o.time):'',status:'已下单'}));return actual.concat(legacy.filter(o=>!o.id||!actual.some(a=>a.id===o.id)));}
function spyShopOrders(id){const rows=spyShopOrderRows(id);openModal(`<h3>我的订单</h3><div style="max-height:60vh;overflow:auto">${rows.length?rows.map(o=>shopOrderRowHTML(o,true)).join(''):'<div class="empty">还没有订单</div>'}</div><button class="btn p" style="margin-top:8px;background:#ff6b6b" onclick="hisWxSimulatedButton()">联系商城客服</button><button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function shopOrderRowHTML(o,inspection){if(inspection){const actions=['咨询客服','退款','删除'].map(label=>`<button class="minibtn" onclick="hisWxSimulatedButton()">${label}</button>`).join('');return `<div class="bill orderrow"><div class="orderinfo">${o.emoji||'🛍️'} ${esc(o.name)}<small style="display:block;color:#888">¥${(+o.price||0).toFixed(2)} · ${esc(o.status||'购买记录')}</small>${o.when?`<small style="display:block;color:#888">${esc(o.when)}</small>`:''}${o.source?`<small style="display:block;color:#888">${esc(o.source)}</small>`:''}</div><div class="orderactions">${actions}</div></div>`;}const arrived=Date.now()>=o.arriveTs,tag=shopOrderTag(o),refundable=(!o.parcel||o.kind==='self')&&!o.refunded;
    const st=o.refunded?'<span style="color:#888">已退款</span>':(arrived?(o.parcel?'<span style="color:#19a463">已到信箱 · 去签收</span>':'<span style="color:#19a463">已签收</span>'):'<span style="color:#ffb83b">已发货 · 运输中 · '+orderEta(o.arriveTs)+'</span>');
    return `<div class="bill orderrow" style="${o.refunded?'opacity:.55':''}"><div class="orderinfo">${o.emoji||'🛍️'} ${esc(o.name)}${tag?'<span style="color:#ff8fab;font-size:11px;margin-left:4px">'+tag+'</span>':''}<small style="display:block;color:#888">¥${(+o.price).toFixed(2)} · ${st}</small></div><div class="orderactions"><button class="minibtn" onclick="csConsultOrder('${o.id}')">咨询客服</button>${o.parcel&&arrived?'<button class="minibtn" style="background:#ff6fa5;color:#fff" onclick="closeModal();go(\'mail\')">去信箱签收</button>':''}${refundable?`<button class="minibtn" style="color:#fa5151" onclick="refundOrder('${o.id}')">退款</button>`:(o.refunded?'<span style="color:#888;font-size:12px">已退</span>':'')}<button class="minibtn" style="color:#fa5151" onclick="delOrder('${o.id}')">删除</button></div></div>`;}
function openOrders(){const os=shopOrderRows(),refN=os.filter(o=>o.refunded).length;
  openModal(`<h3>我的订单</h3><div style="max-height:60vh;overflow:auto">${os.length?os.map(o=>shopOrderRowHTML(o)).join(''):'<div class="empty">还没有订单～买点东西吧</div>'}</div>
  <button class="btn p" style="margin-top:8px;background:#ff6b6b" onclick="closeModal();go('shopcs')">联系商城客服</button>
  ${refN?`<button class="btn g" style="margin-top:8px" onclick="clearRefundedOrders()">清除已退款订单（${refN}）</button>`:''}
  <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
async function clearRefundedOrders(){const n=(S.shop.orders||[]).filter(o=>o.refunded).length;if(!n){toast('没有已退款订单');return;}if(!await uiConfirm('清除 '+n+' 笔已退款订单记录？'))return;S.shop.orders=(S.shop.orders||[]).filter(o=>!o.refunded);save();openOrders();toast('已清除');}
async function delOrder(id){const o=(S.shop.orders||[]).find(x=>x.id===id);if(!o)return;if(!await uiConfirm('删除订单「'+o.name+'」？\n（只删这条订单记录，不影响已签收的东西/已退的钱）'))return;S.shop.orders=(S.shop.orders||[]).filter(x=>x.id!==id);save();openOrders();toast('已删除订单');}
async function refundOrder(id){const o=(S.shop.orders||[]).find(x=>x.id===id);if(!o||o.refunded)return;if(!await uiConfirm('退款「'+o.name+'」¥'+(+o.price).toFixed(2)+'？钱退回你钱包。'))return;
  o.refunded=true;o.refundTs=Date.now();addBill('in',+o.price,'退款：'+o.name);save();openOrders();toast('已退款 ¥'+(+o.price).toFixed(2)+'，回到钱包 💰');}
/* ---------- 商城客服（副模型，和购物商城连着）---------- */
function csList(){S.shop.cs=S.shop.cs||{msgs:[]};return S.shop.cs.msgs;}
function renderShopCS(){const cs=csList();
  return `<div class="nav"><span class="l" onclick="back()">‹</span><span class="t">商城客服 · 小蜜</span><span class="r">${cs.length?`<span onclick="csForward()" style="margin-right:12px">↗转角色</span><span onclick="csClear()" style="color:#fa5151">🗑</span>`:''}</span></div>
    <div class="scroll" id="csbox" style="background:#0e0e10;padding:10px 12px">${cs.length?cs.map(csMsgRow).join(''):'<div class="empty">在线客服小蜜为您服务～<br>订单问题、质量、退换货尽管问我💗<br><small style="color:#888">在「我的订单」点"咨询客服"把订单发给我；或点右上角发到角色那。<br>点下面＋自己加个订单咨询也行</small></div>'}<div style="height:8px"></div></div>
    <div class="inputbar"><button class="send" style="background:#3a3a3c" onclick="csAddOrder()">＋单</button><textarea id="cs_in" rows="1" placeholder="问问客服…质量/退货/啥时候到"></textarea><button class="send" style="background:#ff6b6b" onclick="shopCSSend()">发送</button></div>`;}
function csMsgRow(m){const me=m.from==='me';const wrap=i=>`<div data-chat-motion-row="${esc(naturalMotionRowKey(m))}" style="display:flex;margin:6px 0;${me?'justify-content:flex-end':''}">${i}</div>`;
  if(m.type==='order'){const o=m.order||{};return wrap(`<div style="max-width:80%;background:#1b1b1d;border:1px solid #333;border-radius:12px;padding:8px 10px;display:flex;gap:9px;align-items:center"><div style="font-size:26px">${o.emoji||'🛍️'}</div><div><div style="color:#eee;font-size:14px">${esc(o.name||'商品')}</div><div style="color:#ff6b6b;font-size:13px">¥${(+o.price||0).toFixed(2)}</div><div style="color:#888;font-size:11px">${esc(o.shop||'好物商城')}${o.status?' · '+esc(o.status):''}</div></div></div>`);}
  return wrap(`<div style="max-width:78%;background:${me?'#3a6df0':'#26262a'};color:#fff;border-radius:14px;padding:8px 12px;font-size:15px;line-height:1.45">${esc(m.text||'').replace(/\n/g,'<br>')}</div>`);}
function shopCSSend(){const inp=$('#cs_in');const v=inp?inp.value.trim():'';if(!v)return;csList().push({from:'me',text:v,time:Date.now()});save();render();shopCSReply();}
async function shopCSReply(note){const cs=csList();
  const sys='你是「好物商城」的在线客服小蜜🛍️，热情嘴甜、像真人客服那样会唠、不死板。你负责解答顾客的订单/商品问题：质量做工材质怎么样、尺码、啥时候送到、怎么保养搭配、有没有优惠券。【本商城支持7天无理由退款】——顾客在「我的订单」里点"退款"随时能退、钱原路退回ta钱包，你要爽快痛快地告诉ta、别推三阻四。顾客可能把某个订单转给你咨询，你就针对那个商品热情解答。语气活泼可爱、带点emoji和语气词，但别啰嗦，一般一两句、最多三四句。绝不提你是AI/模型/程序，你就是商城客服本人。';
  try{const hist=cs.slice(-14).map(m=>({role:m.from==='me'?'user':'assistant',content:m.type==='order'?('【顾客咨询的订单】'+(m.order&&m.order.name||'商品')+' ¥'+((m.order&&+m.order.price||0)).toFixed(2)+(m.order&&m.order.status?'（'+m.order.status+'）':'')):m.text}));
    if(note)hist.push({role:'user',content:note});
    const r=await chatAPI([{role:'system',content:sys},...hist],{max:240,aux:true});
    cs.push({from:'cs',text:cleanReply(r),time:Date.now()});if(cs.length>120)S.shop.cs.msgs=cs.slice(-120);save();if(cur().p==='shopcs')render();
  }catch(e){cs.push({from:'cs',text:'客服小蜜开小差了，再发一次试试～',time:Date.now()});save();if(cur().p==='shopcs')render();}}
function csConsultOrder(id){const o=(S.shop.orders||[]).find(x=>x.id===id);if(!o)return;
  const arrived=Date.now()>=o.arriveTs;const status=o.refunded?'已退款':(arrived?'已签收':'运送中');
  csList().push({from:'me',type:'order',order:{name:o.name,price:o.price,shop:o.shop,emoji:o.emoji,status},time:Date.now()});save();closeModal();go('shopcs');
  shopCSReply('[顾客把ta的订单「'+o.name+'」（¥'+(+o.price).toFixed(2)+'，'+status+'）转给你咨询。热情打招呼、主动问ta想了解这商品啥/有啥能帮ta的，一两句。]');}
function csAddOrder(){openModal(`<h3>加个订单咨询</h3><div class="hint">随便编辑一个商品发给客服问问～</div>
  <div class="field"><label>商品名</label><input id="co_n" placeholder="例：碎花连衣裙"></div>
  <div class="two"><div class="field"><label>价格</label><input id="co_p" type="number" value="0"></div><div class="field"><label>emoji</label><input id="co_e" value="🛍️"></div></div>
  <div class="field"><label>店铺</label><input id="co_s" value="好物商城"></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="csAddOrderDo()">发给客服</button></div>`);}
function csAddOrderDo(){const n=($('#co_n').value||'').trim();if(!n){toast('填个商品名');return;}
  const o={name:n,price:+$('#co_p').value||0,emoji:($('#co_e').value||'🛍️').slice(0,2),shop:($('#co_s').value||'').trim()||'好物商城',status:'咨询中'};
  csList().push({from:'me',type:'order',order:o,time:Date.now()});save();closeModal();go('shopcs');
  shopCSReply('[顾客拿来一个商品「'+o.name+'」（¥'+o.price.toFixed(2)+'）想咨询，热情接待、主动问ta想了解啥，一两句。]');}
async function csClear(){if(!csList().length){toast('没有聊天记录');return;}if(!await uiConfirm('清空和客服小蜜的全部聊天记录？'))return;S.shop.cs.msgs=[];save();render();toast('已清空');}
function csForward(){if(!csList().length){toast('还没有聊天内容');return;}pickTarget(csForwardTo);}
function csForwardTo(id){const c=getC(id);if(!c)return;const picked=csList().slice(-20);
  const lines=picked.map(m=>({who:m.from==='me'?S.me.name:'商城客服',text:m.type==='order'?('🛍️ '+(m.order&&m.order.name||'商品')+' ¥'+((m.order&&+m.order.price||0)).toFixed(2)):m.text}));
  if(!lines.length){toast('没有可转发的内容');return;}
  msgs(id).push({role:'user',type:'chatlog',title:S.me.name+'和商城客服的聊天记录',lines,time:Date.now(),id:uid()});
  save();toast('已转发给 '+(c.remark||c.name));openChat(id);scheduleReply(id);}
function pickTarget(cb){const cs=S.contacts.filter(c=>!c.deleted);if(!cs.length){toast('先创建一个角色');return;}
  if(cs.length===1){cb(cs[0].id);return;}
  openModal(`<h3>选择TA</h3>${cs.map(c=>`<div class="section"><div class="it" onclick="closeModal();(${cb.name})('${c.id}')">${esc(c.remark||c.name)}<span class="v">›</span></div></div>`).join('')}<button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function giftFlow(i){const p=S.shop.results[i];if(!p)return;window._gp=p;pickTarget(giftTo);}
function giftTo(id){const p=window._gp;if(!p)return;if(+p.price>S.me.balance){toast('余额不够');return;}
  addBill('out',+p.price,'送'+(getC(id).remark||getC(id).name)+'：'+p.name);
  pushMsg(id,{role:'user',type:'gift',name:p.name,price:+p.price,shop:p.shop||'',from:'me',received:false,id:uid()});
  adjMood(id,8);closeModal();toast('已送出，等对方收下');scheduleReply(id);}
function lastGift(id){return [...msgs(id)].reverse().find(x=>x.role==='user'&&x.type==='gift'&&x.from==='me'&&!x.received&&!x.declined);}
function payFlow(i){const p=S.shop.results[i];if(!p)return;window._pp=p;pickTarget(payTo);}
function payTo(id){const p=window._pp;if(!p)return;
  pushMsg(id,{role:'user',type:'paycard',name:p.name,price:+p.price,shop:p.shop||'',kind:p.kind||'',id:uid()});
  closeModal();toast('已请ta代付 💳');scheduleReply(id);}
function cartPayFlow(){const cart=S.shop.cart||[];if(!cart.length)return;window._pp={name:cart.map(p=>p.name).join('、'),price:cart.reduce((s,p)=>s+(+p.price),0),shop:'购物车'};pickTarget(payCartTo);}
function payCartTo(id){const items=(S.shop.cart||[]).slice();payTo(id);S.shop.cart=[];save();coFinalize(items,id);}
function receiveGift(mid){let found;for(const k in S.messages){const m=S.messages[k].find(x=>x.id===mid);if(m){found={m,k};break;}}
  if(!found||found.m.received)return;found.m.received=true;msgs(found.k).push({role:'user',type:'sys',content:'你领取了礼物：'+found.m.name,time:Date.now(),id:uid()});adjMood(found.k,8);save();render();toast('收下了 '+found.m.name);
  const c=getC(found.k);if(c&&!c.blocked)delayedAccountReply(found.k,'[系统：'+S.me.name+'收下了你送的礼物「'+found.m.name+'」，回应一下。]',1500);}
function rejectGift(mid){let found;for(const k in S.messages){const m=S.messages[k].find(x=>x.id===mid);if(m){found={m,k};break;}}
  if(!found||found.m.received||found.m.declined)return;found.m.declined=true;msgs(found.k).push({role:'user',type:'sys',content:'你拒收了礼物：'+found.m.name,time:Date.now(),id:uid()});adjMood(found.k,-12);save();render();toast('已拒收');
  const c=getC(found.k);if(c&&!c.blocked)delayedAccountReply(found.k,'[系统：'+S.me.name+'拒收了你送的礼物「'+found.m.name+'」，你有点失落或不甘，回应一下。]',1500);}

/* ---------- 和角色「一起逛街」 ---------- */
let _coBusy=false;
function coInit(){if(!S.shop.co||typeof S.shop.co!=='object')S.shop.co={on:false,cid:null,pace:'slow',feed:[],hisPending:[],myPending:[],lastActTs:0};
  const co=S.shop.co;co.feed=co.feed||[];co.hisPending=co.hisPending||[];co.myPending=co.myPending||[];co.doneNames=co.doneNames||[];if(!co.pace)co.pace='slow';
  if(co.on){const c=getC(co.cid);if(!c||c.deleted)co.on=false;}}
function coClip(s,n){s=(''+(s||'')).trim().replace(/^["'「」]+|["'「」]+$/g,'');return s.length>n?s.slice(0,n)+'…':s;}
function coNormItem(it){if(!it||!it.name)return null;return {name:(''+it.name).slice(0,40),price:+(''+it.price).replace(/[^0-9.]/g,'')||(20+Math.floor(Math.random()*180)),shop:(''+(it.shop||'好物商城')).slice(0,20),desc:(''+(it.desc||'')).slice(0,40),emoji:(''+(it.emoji||'🛍️')).slice(0,2)};}
function coFeed(k,text){const co=S.shop.co;if(!co)return;co.feed.push({id:uid(),k,text,ts:Date.now()});if(co.feed.length>40)co.feed=co.feed.slice(-40);}
function coInvite(){coInit();pickTarget(coStart);}
function coStart(id){coInit();const c=getC(id);if(!c){toast('先创建一个角色');return;}
  S.shop.co={on:true,cid:id,pace:'slow',feed:[],hisPending:[],myPending:[],doneNames:[],lastActTs:0};
  coFeed('sys','💌 你拉着 '+(c.remark||c.name)+' 一起来逛街啦~');save();render();toast('和 '+(c.remark||c.name)+' 一起逛街咯 👫');
  setTimeout(()=>coHisAuto(false),1500);}
function coPickedSummary(items,payerId){const co=S.shop.co||{};const c=getC(co.cid);const nm=c?(c.remark||c.name):'ta';
  const picks=(items||[]).filter(x=>x&&x._coBy);
  const mine=picks.filter(p=>p._coBy==='me').map(p=>p.name);
  const his=picks.filter(p=>p._coBy==='ta').map(p=>p.name);
  const payer=payerId==='me'?S.me.name:(getC(payerId)?(getC(payerId).remark||getC(payerId).name):(payerId||'未付款'));
  const parts=[];if(his.length)parts.push(nm+'自己想买、'+S.me.name+'同意买下：'+his.join('、'));
  if(mine.length)parts.push(S.me.name+'想买、'+nm+'同意买下：'+mine.join('、'));
  if(picks.length)parts.push('付款/下单：'+payer);
  return {text:parts.join('；'),names:picks.map(p=>p.name).join('、'),mine,his,payer,nm,picks};}
function coExit(){const co=S.shop.co;if(co){const cid=co.cid,c=getC(cid);if(co.on){const cart=(S.shop.cart||[]).filter(x=>x&&x._coBy);const sum=coPickedSummary(cart,cart.length?cid:'未付款');co.endedAt=Date.now();co.endedCid=cid;co.endedItems=sum.names||'';co.endedDetail=sum.text||(cart.length?'':'没有真正买下东西');
    if(cart.length){cart.forEach(p=>parcelDeliver(cid,p.name,+p.price,'pay',{emoji:p.emoji||'🛍️',shop:p.shop||'购物车'}));S.shop.cart=S.shop.cart.filter(x=>!cart.includes(x));}
    if(c&&!c.blocked)scheduleReply(cid,'[系统：你和'+S.me.name+'刚刚结束了一起逛购物App。'+(cart.length?'你已经替ta买单/下单，刚才敲定的小票是：'+sum.text+'。':'这次没有真正买下东西。')+'这只是刚发生的短期购物上下文，不是长期记忆。你第一时间自然发消息承接一下。必须分清谁想买、谁同意、谁付款；不要说成都是'+S.me.name+'买的，也不要把隐藏系统说明原样复述。]');}
  co.on=false;co.hisPending=[];co.myPending=[];}save();if(cur().p==='shop')render();toast('结束一起逛街~ '+((S.shop.co&&S.shop.co.endedItems)?'对方已买单，订单在我的订单里':'这次没有下单'));}
/* 结算完：只留下本次购物短期上下文，不写进长期记忆/总结 */
function coFinalize(items,payerId){const co=S.shop.co;if(!co)return;
  const sum=coPickedSummary(items,payerId||'me'),picks=sum.picks;
  if(picks.length){const c=getC(co.cid);co.endedItems=sum.names;co.endedDetail=sum.text;
    if(c&&!c.blocked)scheduleReply(co.cid,'[系统：你和'+S.me.name+'刚一起逛完购物App并结算了：'+sum.text+'。这是刚发生的短期购物上下文，不是长期记忆。你第一时间自然发消息承接一下，明确分清：哪些是你自己想买、哪些是'+S.me.name+'想买、谁同意、谁付款。不要把所有东西都说成'+S.me.name+'买的，也不要装作不知道刚才一起逛过。]');}
  co.endedAt=Date.now();co.endedCid=co.cid;
  if(co.on){co.on=false;co.hisPending=[];co.myPending=[];}
  save();if(cur().p==='shop')render();
  if(picks.length)toast('一起逛结束啦，敲定的都下单了~ 想再逛就重新邀他 👫');}
function coSetPace(p){const co=S.shop.co;if(!co)return;co.pace=p;co.lastActTs=Date.now();save();render();}
function coNudge(){coHisAuto(true);}
function coHeartbeat(){try{const co=S.shop&&S.shop.co;if(!co||!co.on||co.pace==='off'||_coBusy)return;if(cur().p!=='shop')return;const gap={slow:45000,mid:22000,fast:11000}[co.pace]||45000;if(Date.now()-(co.lastActTs||0)<gap)return;coHisAuto(false);}catch(e){}}
setInterval(coHeartbeat,5000);
async function coGen(kind,c){const ctx=(S.shop.co.feed||[]).slice(-2).map(f=>f.text).join('；');
  const sys='【沉浸式角色扮演】你就是「'+(c.remark||c.name)+'」本人：'+((c.persona||'').slice(0,500))+'\n你正在和恋人'+S.me.name+'一起用购物App逛街。全程中文、口语、贴合你的人设和喜好，绝不提AI/程序。只输出JSON，不要多余文字。'+(ctx?'\n刚刚的动态：'+ctx:'');
  let u;
  if(kind==='search')u='你想自己搜点你（按人设/喜好）想买的东西。输出JSON：{"keyword":"想搜的关键词(2-8字)","say":"像和恋人逛街时随口说的一句(≤18字)"}';
  else if(kind==='look')u='你在商城里看中一件你自己想要的商品（贴合你人设喜好）。输出JSON：{"item":{"name":"商品名","price":数字,"shop":"店铺名","desc":"一句卖点","emoji":"1个emoji"},"say":"一句感想(≤18字)"}';
  else if(kind==='want')u='你看中一件很想买的东西，想让恋人同意你买。输出JSON：{"item":{"name":"商品名","price":数字,"shop":"店铺名","desc":"一句卖点","emoji":"1个emoji"},"say":"跟ta请求/撒娇想买它的一句(≤22字)"}';
  else u='你和恋人一起逛街，随口说一句话（调情/嫌ta乱买/催ta/分享心情都行）。输出JSON：{"say":"一句话(≤22字)"}';
  return await aiGen([{role:'system',content:sys},{role:'user',content:u}],{max:200,aux:true},parseObj,2);}
async function coHisAuto(manual){const co=S.shop.co;if(!co||!co.on)return;
  if(_coBusy){if(manual)toast('他正在逛…等一下');return;}
  const c=getC(co.cid);if(!c||c.blocked||c.deleted){co.on=false;save();if(cur().p==='shop')render();return;}
  _coBusy=true;co.lastActTs=Date.now();if(cur().p==='shop')render();
  const kinds=co.hisPending.length>=2?['look','look','search','chat']:['want','want','want','look','look','look','search','search','chat'];
  const kind=kinds[Math.floor(Math.random()*kinds.length)];const nm=c.remark||c.name;
  try{const o=await coGen(kind,c)||{};
    if(kind==='search'){const kw=(''+(o.keyword||'')).slice(0,20)||'喜欢的东西';coFeed('search','🔎 '+nm+' 在搜「'+kw+'」'+(o.say?' — '+coClip(o.say,24):''));}
    else if(kind==='chat'){coFeed('chat','💬 '+nm+'：'+(coClip(o.say,30)||'一起逛真开心~'));}
    else{const it=coNormItem(o.item);
      if(!it){coFeed('chat','💬 '+nm+'：'+(coClip(o.say,30)||'嗯…再看看'));}
      else if(kind==='look'){coFeed('look','👀 '+nm+' 在看「'+it.name+'」¥'+it.price.toFixed(2)+(o.say?' — '+coClip(o.say,22):''));}
      else{// want：同一样东西不重复想买/重复下单
        const dup=(co.doneNames||[]).includes(it.name)||co.hisPending.some(h=>h.item&&h.item.name===it.name)||(S.shop.cart||[]).some(x=>x.name===it.name);
        if(dup){coFeed('look','👀 '+nm+' 又瞄了眼「'+it.name+'」'+(o.say?' — '+coClip(o.say,20):''));}
        else{co.doneNames=co.doneNames||[];co.doneNames.push(it.name);if(co.doneNames.length>60)co.doneNames=co.doneNames.slice(-60);
          co.hisPending.push({id:uid(),item:it,say:coClip(o.say,40)||'我想要这个~',ts:Date.now()});coFeed('want','🛍️ '+nm+' 想买「'+it.name+'」，等你同意');if(S.settings.sound&&typeof playDing==='function'){try{playDing();}catch(_){}}}}
    }
  }catch(e){}
  co.lastActTs=Date.now();_coBusy=false;save();if(cur().p==='shop')render();}
async function coAskHim(i){const co=S.shop.co;if(!co||!co.on)return;const p=S.shop.results[i];if(!p)return;const c=getC(co.cid);if(!c){toast('对方不在了');return;}
  if(_coBusy){toast('等他一下下~');return;}
  const it=coNormItem(p);
  if((S.shop.cart||[]).some(x=>x.name===it.name)){toast('「'+it.name+'」已经在购物车啦，别重复买~');return;}
  if(co.myPending.some(r=>r.item&&r.item.name===it.name&&r.status==='wait')){toast('这个正在问他，等他回~');return;}
  const req={id:uid(),item:it,status:'wait',say:'',ts:Date.now()};co.myPending.push(req);
  coFeed('ask','🙋 你想买「'+it.name+'」，问了问 '+(c.remark||c.name)+'…');_coBusy=true;save();render();
  try{const sys='【沉浸式角色扮演】你就是「'+(c.remark||c.name)+'」本人：'+((c.persona||'').slice(0,500))+'\n你在和恋人'+S.me.name+'一起逛街。ta想买一样东西，来问你同不同意ta买。按你的人设和此刻心情决定（可爽快答应/宠溺答应/嫌贵逗ta/心疼钱不许ta乱买/趁机撒娇提条件）。中文口语，绝不提AI。只输出JSON。';
    const u='恋人'+S.me.name+'想买「'+it.name+'」（¥'+it.price.toFixed(2)+(it.shop?'，'+it.shop:'')+'）。你同不同意ta买？输出JSON：{"ok":true或false,"say":"你的回应一句(≤26字)"}';
    const o=await aiGen([{role:'system',content:sys},{role:'user',content:u}],{max:180,aux:true},parseObj,2)||{};
    req.status=o.ok?'ok':'no';req.say=coClip(o.say,40)||(o.ok?'嗯，买吧~':'不许，太贵了');
    if(o.ok){S.shop.cart.push(Object.assign({},it,{_coBy:'me'}));coFeed('okme','✅ '+(c.remark||c.name)+' 同意了：「'+it.name+'」已进购物车');adjMood(co.cid,4);}
    else coFeed('nome','❌ '+(c.remark||c.name)+' 没同意你买「'+it.name+'」');
  }catch(e){req.status='no';req.say='（他没回应）';}
  _coBusy=false;save();render();}
async function coApproveHis(pid){const co=S.shop.co;if(!co)return;const idx=co.hisPending.findIndex(x=>x.id===pid);if(idx<0)return;const req=co.hisPending.splice(idx,1)[0];const c=getC(co.cid);const nm=c?(c.remark||c.name):'ta';
  S.shop.cart.push(Object.assign({},req.item,{_coBy:'ta'}));coFeed('okhis','💝 你同意 '+nm+' 买「'+req.item.name+'」，已进购物车');adjMood(co.cid,6);save();render();
  if(c&&!_coBusy){_coBusy=true;try{const o=await aiGen([{role:'system',content:'【沉浸式角色扮演】你就是「'+nm+'」本人：'+((c.persona||'').slice(0,400))+'\n你在和恋人'+S.me.name+'一起逛街。只输出JSON，中文口语，别提AI。'},{role:'user',content:'恋人'+S.me.name+'同意了你买「'+req.item.name+'」。开心地谢谢ta/得意/撒娇一句。输出JSON：{"say":"(≤22字)"}'}],{max:120,aux:true},parseObj,2)||{};if(o.say)coFeed('chat','💬 '+nm+'：'+coClip(o.say,30));}catch(e){}_coBusy=false;save();if(cur().p==='shop')render();}}
async function coRejectHis(pid){const co=S.shop.co;if(!co)return;const idx=co.hisPending.findIndex(x=>x.id===pid);if(idx<0)return;const req=co.hisPending.splice(idx,1)[0];const c=getC(co.cid);const nm=c?(c.remark||c.name):'ta';
  coFeed('nohis','🙅 你拒绝了 '+nm+' 买「'+req.item.name+'」');adjMood(co.cid,-5);save();render();
  if(c&&!_coBusy){_coBusy=true;try{const o=await aiGen([{role:'system',content:'【沉浸式角色扮演】你就是「'+nm+'」本人：'+((c.persona||'').slice(0,400))+'\n你在和恋人'+S.me.name+'一起逛街。只输出JSON，中文口语，别提AI。'},{role:'user',content:'恋人'+S.me.name+'不同意你买「'+req.item.name+'」（不让你买/嫌贵）。按你的人设自然反应（失落/耍赖继续求/撒娇/懂事作罢/闹点小情绪都行）。输出JSON：{"say":"(≤26字)"}'}],{max:130,aux:true},parseObj,2)||{};if(o.say)coFeed('chat','💬 '+nm+'：'+coClip(o.say,32));}catch(e){}_coBusy=false;save();if(cur().p==='shop')render();}}
function coAvatar(c){if(c&&isImg(c.avatar))return `<img src="${c.avatar}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex:none">`;return `<div style="width:34px;height:34px;border-radius:50%;background:#3a2f36;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none">${c?esc(c.avatar||'👤'):'👤'}</div>`;}
function coPanel(){const co=S.shop.co;const c=getC(co.cid);const name=c?(c.remark||c.name):'ta';
  const last=(co.feed[co.feed.length-1]||{}).text||'一起逛街中~';
  const paceBtn=(p,t)=>`<span onclick="coSetPace('${p}')" style="cursor:pointer;padding:3px 9px;border-radius:11px;font-size:12px;${co.pace===p?'background:#ff8fab;color:#fff':'color:#999;background:#2a2a2c'}">${t}</span>`;
  const hisCards=co.hisPending.map(r=>`<div style="background:#211b1f;border:1px solid #4a2f3a;border-radius:11px;padding:8px 10px;margin:6px 0;display:flex;gap:8px;align-items:center">
    <div style="font-size:24px">${r.item.emoji||'🛍️'}</div>
    <div style="flex:1;min-width:0"><div style="color:#eee;font-size:13.5px">${esc(r.item.name)} <span style="color:#ff6b6b">¥${(+r.item.price).toFixed(2)}</span></div>${r.say?`<div style="color:#ff9ec2;font-size:12px;margin-top:2px">${esc(name)}：${esc(r.say)}</div>`:''}</div>
    <div style="white-space:nowrap;display:flex;flex-direction:column;gap:4px"><button class="minibtn" style="background:#07c160;color:#fff" onclick="coApproveHis('${r.id}')">同意</button><button class="minibtn" style="background:#3a3a3c;color:#ddd" onclick="coRejectHis('${r.id}')">拒绝</button></div></div>`).join('');
  const myCards=co.myPending.slice(-4).map(r=>`<div style="font-size:12px;color:#aaa;padding:2px 0">🙋 你想买「${esc(r.item.name)}」— ${r.status==='wait'?'<span style="color:#ffb83b">等他回复…</span>':r.status==='ok'?`<span style="color:#19a463">他同意了✓</span>${r.say?' <span style="color:#ff9ec2">'+esc(r.say)+'</span>':''}`:`<span style="color:#fa5151">他拒绝了✗</span>${r.say?' <span style="color:#ff9ec2">'+esc(r.say)+'</span>':''}`}</div>`).join('');
  const feedLog=co.feed.slice(-8).map(f=>`<div style="font-size:11.5px;color:#8a8a90;padding:1px 0">${esc(f.text)}</div>`).join('');
  return `<div style="background:linear-gradient(135deg,#2a1e26,#1c1c1e);border-bottom:1px solid #3a2a32;padding:10px 12px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">${coAvatar(c)}<div style="flex:1;min-width:0"><div style="color:#ff9ec2;font-size:14px;font-weight:600">和 ${esc(name)} 一起逛街</div><div style="color:#ccc;font-size:12.5px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_coBusy?'✨ '+esc(name)+' 正在逛…':esc(last)}</div></div><button class="minibtn" style="background:#3a3a3c;color:#ddd" onclick="coExit()">退出</button></div>
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:11.5px;color:#888">他逛的频率</span>${paceBtn('off','关')}${paceBtn('slow','慢')}${paceBtn('mid','中')}${paceBtn('fast','快')}<button class="minibtn" style="margin-left:auto" onclick="coNudge()" ${_coBusy?'disabled':''}>${_coBusy?'…':'催他逛一下'}</button></div>
    ${hisCards?`<div style="margin-top:5px">${hisCards}</div>`:''}
    ${myCards?`<div style="margin-top:5px">${myCards}</div>`:''}
    ${feedLog?`<details style="margin-top:6px"><summary style="font-size:11.5px;color:#777;cursor:pointer">逛街动态</summary>${feedLog}</details>`:''}
  </div>`;}

/* ---------- 外卖 ---------- */
let _foodBusy=false;
var _northCommerceLoad={attempts:0,busy:false,error:false};
function northCommerceLoadFailed(){_northCommerceLoad.error=true;if(typeof cur==='function'&&cur().p==='food')render();}
function northCommerceRetry(){if(window.__NORTH_COMMERCE_READY__===window.__NORTH_SHELL_BUILD__||_northCommerceLoad.busy||_northCommerceLoad.attempts>=2||window.__NORTH_COMMERCE_STARTED__)return;_northCommerceLoad.busy=true;_northCommerceLoad.attempts++;var script=document.createElement('script');script.src='commerce-ui.js?v='+encodeURIComponent(window.__NORTH_SHELL_BUILD__)+'&componentRetry='+_northCommerceLoad.attempts;script.onload=function(){_northCommerceLoad.busy=false;_northCommerceLoad.error=window.__NORTH_COMMERCE_READY__!==window.__NORTH_SHELL_BUILD__;if(typeof cur==='function'&&cur().p==='food')render();};script.onerror=function(){_northCommerceLoad.busy=false;_northCommerceLoad.error=true;if(typeof cur==='function'&&cur().p==='food')render();};document.head.appendChild(script);}
function northCommerceUnavailableHTML(){if(!_northCommerceLoad.busy&&_northCommerceLoad.attempts===0&&!window.__NORTH_COMMERCE_STARTED__)setTimeout(northCommerceRetry,0);var busy=_northCommerceLoad.busy||!_northCommerceLoad.attempts&&!window.__NORTH_COMMERCE_STARTED__;return '<div class="nav food-nav"><span class="l" onclick="back()">‹</span><span class="t">美团</span></div><div class="empty" style="padding:36px 22px"><h3>'+ (busy?'正在加载新版美团…':'新版美团未能加载')+'</h3><p style="margin:14px 0;line-height:1.8">'+(busy?'聊天和店铺数据保留，请稍候。':'请重试组件加载；聊天、店铺、订单和密钥不会删除。')+'</p>'+(!busy&&_northCommerceLoad.attempts<2&&!window.__NORTH_COMMERCE_STARTED__?'<button class="btn" style="background:#ffe238;color:#222" onclick="northCommerceRetry();render()">重试加载美团</button>':'')+(!busy?'<button class="btn" style="margin-top:12px" onclick="location.reload()">重新加载页面</button>':'')+'</div>';}
function renderFood(){return northCommerceUnavailableHTML();}

function foodCard(p,i){return `<div class="mpost" style="align-items:center">
    <div class="avatar" style="width:64px;height:64px;flex-basis:64px;font-size:34px;border-radius:14px;background:linear-gradient(135deg,#ffe7b3,#ffd6a0)">${p.emoji||'🍱'}</div>
    <div class="body"><div style="font-size:15px;color:#eee">${esc(p.name)}</div>
      <div style="font-size:12px;color:#888;margin:3px 0">${esc(p.shop||'好吃外卖')} · ${esc(p.desc||'')}</div>
      <div style="color:#ffb83b;font-size:17px;font-weight:600">¥${(+p.price).toFixed(2)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <button class="minibtn" onclick="foodCart(${i})">加购物车</button>
        <button class="minibtn" onclick="foodBuy(${i})">自己下单</button>
        <button class="minibtn" onclick="foodGiftFlow(${i})">请TA吃</button>
        <button class="minibtn" onclick="foodPayFlow(${i})">让TA代付</button>
        ${familyContacts().length?`<button class="minibtn" style="background:#e8527f;color:#fff" onclick="familyPayFlow([S.food.results[${i}]])">用亲属卡付</button>`:''}
      </div></div></div>`;}
