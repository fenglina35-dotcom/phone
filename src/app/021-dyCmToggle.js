function dyCmToggle(ci){_dyCmExpand[ci]=!_dyCmExpand[ci];render();}
function dyCmReplyTo(ci){_dyCmReply=_dyCmReply===ci?-1:ci;render();const i=$('#dycm_in');if(i)i.focus();}
function dyCmLike(id,ci){const v=dyVid(id);if(!v||!v.comments||!v.comments[ci])return;const cm=v.comments[ci];cm.liked=!cm.liked;cm.lk=Math.max(0,(cm.lk||0)+(cm.liked?1:-1));save();render();}
function dyCmDelete(id,ci){const v=dyVid(id);if(!v||!v.comments)return;v.comments.splice(ci,1);save();_dyCmReply=-1;_dyCmExpand={};render();toast('已删除');}
function dyCmIsAuthor(v,cm){if(!v||!cm)return false;
  if(cm.me)return v.cid==='me';/* 我只有在自己的作品下才是作者 */
  return !!(cm.cid&&v.cid&&cm.cid===v.cid);}
function dyCmMeta(cm){const bits=[];if(cm.d)bits.push(esc(cm.d));if(cm.loc)bits.push('·&nbsp;'+esc(cm.loc));return bits.join(' ');}
function dyCmRow(v,cm,ci){const reps=cm.replies||[],open=!!_dyCmExpand[ci],author=dyCmIsAuthor(v,cm);
  const sub=reps.length?(open?reps.map(r=>`<div class="dycm-sub">${dyFace(r.avatar,'sm')}<div class="dycm-main"><div class="dycm-name">${esc(r.name)}${r.me?'<em class="dycm-author">我</em>':''}</div><div class="dycm-text">${dyHash(r.text)}</div><div class="dycm-meta">${dyCmMeta(r)}</div></div></div>`).join('')+`<div class="dycm-more" onclick="dyCmToggle(${ci})">收起 ⌃</div>`:`<div class="dycm-more" onclick="dyCmToggle(${ci})">展开 ${reps.length} 条回复 ⌄</div>`):'';
  return `<div class="dycm-row"><span onclick="dyOpenUser('${cm.cid?'c:'+cm.cid:'n:'+esc(String(cm.name||''))}')">${dyFace(dyRA(cm.cid,cm.avatar),'sm')}</span>
    <div class="dycm-main">
      <div class="dycm-name">${esc(cm.name)}${author?'<em class="dycm-author">作者</em>':cm.me?'<em class="dycm-author" style="background:#2c2c30;color:#b9b9c1">我</em>':cm.cid?'<em class="dycm-author" style="background:#2c2c30;color:#b9b9c1">角色</em>':''}</div>
      <div class="dycm-text">${dyHash(cm.text)}</div>
      <div class="dycm-meta">${dyCmMeta(cm)}<span class="a" onclick="dyCmReplyTo(${ci})">回复</span>${cm.me?`<span class="a" onclick="dyCmDelete('${v.id}',${ci})">删除</span>`:''}</div>
      ${sub}
    </div>
    <div class="dycm-like${cm.liked?' on':''}" onclick="dyCmLike('${v.id}',${ci})">${dyIc('heart',19,cm.liked,'#f5243d','#7b7b83',1.8)}${cm.lk||0}</div>
  </div>`;}
function dyCmCaptionRow(v){const mine=v.cid==='me';return `<div class="dycm-row">${mine?av(dyAvatar(),'sm'):dyFace(dyRA(v.cid,v.avatar),'sm')}<div class="dycm-main"><div class="dycm-name">${esc(mine?dyNick():(v.author||'用户'))}<em class="dycm-author">作者</em></div><div class="dycm-text">${dyHash(v.desc||'')}</div><div class="dycm-meta">${esc(dyWorkDate(v))}</div></div></div>`;}
function dyCmFanRows(v,kind){const names=[];const push=(n,a)=>{if(n&&!names.some(x=>x[0]===n))names.push([n,a]);};
  if(kind==='赞'&&v.liked)push(dyNick(),dyAvatar());if(kind==='收藏'&&v.starred)push(dyNick(),dyAvatar());
  (v.comments||[]).forEach(cm=>{if(cm.me)return;push(cm.name,cm.avatar||'');});
  const cut=kind==='收藏'?Math.ceil(names.length/2):names.length,rows=names.slice(0,cut);
  if(!rows.length)return `<div class="dycm-empty">还没有人${kind==='赞'?'点赞':'收藏'}～</div>`;
  return rows.map(r=>`<div class="dycm-row">${dyFace(r[1],'sm')}<div class="dycm-main"><div class="dycm-text" style="margin-top:0">${esc(r[0])}</div><div class="dycm-meta">${kind==='赞'?'赞过这条作品':'收藏了这条作品'}</div></div></div>`).join('');}
function dyCmSheet(v){const cs=v.comments||[],lk=(v.lk||0)+(v.liked?1:0),st=(v.st||0)+(v.starred?1:0);
  const tab=(k,n)=>`<span class="${_dyCmTab===k?'on':''}" onclick="dyCmSetTab('${k}')">${k} ${dyNum(n)}</span>`;
  const list=_dyCmTab==='评论'?(cs.length?dyCmCaptionRow(v)+cs.map((cm,ci)=>dyCmRow(v,cm,ci)).join(''):dyCmCaptionRow(v)+'<div class="dycm-empty">还没有评论，自己评一条，<br>或者点右边的 ✨ 让网友来热闹一下。</div>'):dyCmFanRows(v,_dyCmTab);
  const rep=_dyCmReply>=0&&cs[_dyCmReply]?('回复 @'+cs[_dyCmReply].name+'：'):'有爱评论，说点儿好听的';
  return `<div class="dycm-mask" onclick="dyCmClose()"></div>
  <div class="dycm${_dyCmFull?' full':''}">
    <div class="dycm-head">${tab('评论',cs.length)}${tab('赞',lk)}${tab('收藏',st)}<span class="sp"></span><i onclick="dyCmToggleFull()">${_dyCmFull?'⤡':'⤢'}</i><i onclick="dyCmClose()">✕</i></div>
    <div class="dycm-list" data-render-scroll-key="dycm:${esc(v.id)}:${esc(_dyCmTab)}">${list}</div>
    <div class="dycm-bar">${av(dyAvatar(),'sm')}<input id="dycm_in" placeholder="${esc(rep)}" onkeydown="if(event.key==='Enter')dyCmSend('${v.id}')"><i onclick="dyGenComments('${v.id}')">✨</i><i onclick="dyCmAt('${v.id}')">@</i><i class="send" onclick="dyCmSend('${v.id}')">${svgIc('forward',19,'#fff',2.2)}</i></div>
  </div>`;}
/* ===== 「我」页上原先点不动的地方，这一批全部接上 ===== */
let _dyRelTab='互关';let _dyRelQ='';let _dyHistTab='视频';let _dyHistOnly='';let _dyHistQ='';let _dyHistSearch=false;let _dyMeQ='';let _dyMeQRan=false;let _dyWorkSort='new';
function dyDayLabel(ts){if(!ts)return '';const d=new Date(ts),t=new Date(),y=new Date(t.getTime()-864e5);
  if(d.toDateString()===t.toDateString())return '今天';if(d.toDateString()===y.toDateString())return '昨天';
  return (d.getMonth()+1)+'-'+d.getDate();}
function dyWeekLabel(ts){if(!ts)return '';const d=new Date(ts),t=new Date();
  if(d.toDateString()===t.toDateString())return '今天';
  if(t-d<6*864e5)return '周'+'日一二三四五六'[d.getDay()];
  return (d.getMonth()+1)+'-'+d.getDate();}
function dyCopyDyid(){const id=S.dy.profile.dyid||'';if(!id)return toast('还没有抖音号');copyTextCompat(id).then(()=>toast('抖音号已复制'));}
/* ===== 关注 / 互关 / 粉丝 / 朋友 ===== */
/* 火花：你和他【当天都】在抖音发过消息才算续上，一天最多涨一次。
   有一方没发就定格不动，不清零——隔多久回来都还在，接着往上长。
   以前是从今天往回数连续天数，漏一天直接归零，跟她要的完全不是一回事。 */
function dySparkState(d){if(!d)return null;
  if(!d.spark||typeof d.spark!=='object')d.spark={days:0,day:''};
  if(typeof d.spark.days!=='number')d.spark.days=0;
  if(typeof d.spark.day!=='string')d.spark.day='';
  return d.spark;}
function dySparkDayKey(t){const d=new Date(t==null?Date.now():t);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function dySparkBothToday(d){const today=dySparkDayKey();let me=false,them=false;
  (d&&d.msgs||[]).forEach(m=>{if(!m||!m.time||dySparkDayKey(m.time)!==today)return;
    if(m.from==='me')me=true;else them=true;});
  return me&&them;}
function dySparkTick(d){const st=dySparkState(d);if(!st)return 0;
  const today=dySparkDayKey();
  if(st.day===today)return st.days;/* 今天已经续过了，一天只涨一次 */
  if(!dySparkBothToday(d))return st.days;/* 有一方今天没发，定格 */
  st.days=(+st.days||0)+1;st.day=today;save();return st.days;}
function dySparkDays(cid){const d=(S.dy&&S.dy.dms||[]).find(x=>x&&x.cid===cid);return d?(dySparkState(d).days||0):0;}
function dyCloseList(){dyInit();if(!Array.isArray(S.dy.closeFriends))S.dy.closeFriends=[];return S.dy.closeFriends;}
function dyRelClose(p){const l=dyCloseList();if(p.cid&&S.couple&&S.couple.cid===p.cid)return true;return l.includes(p.k);}
function dyRelPeople(){dyInit();const out=[],seen=new Set();
  (S.contacts||[]).filter(c=>c&&!c.deleted).forEach(c=>{const k='c:'+c.id;seen.add(k);
    out.push({k,cid:c.id,name:c.remark||c.name,avatar:c.avatar,bio:dyPersonBio({k,cid:c.id}).slice(0,38),
      spark:dySparkDays(c.id),iFollow:(S.dy.following||[]).includes(c.id),follows:true,friend:true});});
  (S.dy.visitors||[]).forEach(x=>{if(x.cid||seen.has(x.k))return;seen.add(x.k);
    out.push({k:x.k,name:x.name,avatar:x.avatar,bio:'',spark:0,iFollow:!!x.iFollow,follows:!!x.follows,friend:false});});
  return out;}
function dyRelTabs(){return ['互关','关注','粉丝指数','朋友'];}
function dyRelFilter(rows,tab){if(tab==='互关')return rows.filter(p=>p.iFollow&&p.follows);
  if(tab==='关注')return rows.filter(p=>p.iFollow);
  if(tab==='粉丝指数')return rows.filter(p=>p.follows).slice().sort((a,b)=>(b.spark||0)-(a.spark||0));
  return rows.filter(p=>p.friend);}
function dyRelRows(){const q=String(_dyRelQ||'').trim().toLowerCase();let rows=dyRelFilter(dyRelPeople(),_dyRelTab);
  if(q)rows=rows.filter(p=>String(p.name||'').toLowerCase().includes(q));return rows;}
function dyOpenRel(tab){_dyRelTab=dyRelTabs().includes(tab)?tab:'互关';_dyRelQ='';_dySub='rel';render();}
function dyRelSetTab(t){_dyRelTab=t;render();}
function dyRelSearch(){const el=$('#dyrel_q');_dyRelQ=el?el.value:'';render();const i=$('#dyrel_q');if(i){i.focus();try{i.setSelectionRange(i.value.length,i.value.length);}catch(e){}}}
function dyRelRow(p){const close=dyRelClose(p),idx=_dyRelTab==='粉丝指数'&&p.spark?`<b class="dyrel-idx">互动 ${p.spark} 天</b>`:'';
  return `<div class="dyrel-row" onclick="dyOpenUser('${esc(p.k)}')">${dyFace(p.avatar,'sm')}
    <div class="dyrel-main"><div class="dyrel-name">${esc(p.name)}${close?'<em class="dyrel-close">密友</em>':''}${p.spark?`<em class="dyrel-spark">🔥${p.spark>99?'99+':p.spark}</em>`:''}</div>${p.bio?`<div class="dyrel-bio">${esc(p.bio)}</div>`:''}</div>${idx}</div>`;}
function dyRelView(){const rows=dyRelRows(),label={'互关':'我的互关','关注':'我的关注','粉丝指数':'我的粉丝','朋友':'我的朋友'}[_dyRelTab];
  return `<div class="dyrel">
    <div class="dyrel-nav dy-safe-nav2"><i onclick="dySubClose()">‹</i>${dyRelTabs().map(t=>`<span class="${_dyRelTab===t?'on':''}" onclick="dyRelSetTab('${t}')">${t}</span>`).join('')}<em onclick="dyRelSettings()">${svgIc('gear',21,'#f2f2f4',1.8)}</em></div>
    <div class="dyrel-search">${svgIc('search',17,'#8a8a92',2)}<input id="dyrel_q" value="${esc(_dyRelQ)}" placeholder="搜索用户备注或名字" onchange="dyRelSearch()"></div>
    <div class="dyrel-count">${label} (${rows.length} 人)</div>
    <div class="dyrel-list" data-render-scroll-key="dy:rel:${esc(_dyRelTab)}">${rows.length?rows.map(dyRelRow).join(''):`<div class="dyvi-empty">${_dyRelTab==='朋友'?'还没有角色～去微信里建一个':_dyRelTab==='关注'?'还没关注谁～首页刷到喜欢的点个关注':'这一栏还是空的'}</div>`}</div>
  </div>`;}
function dyRelMenu(k){const p=dyRelPeople().find(x=>x.k===k);if(!p)return;const close=dyRelClose(p);
  openModal(`<h3>${esc(p.name)}</h3><div class="btns" style="flex-direction:column;gap:8px">
    ${p.cid?`<button class="dybtn out" onclick="closeModal();dyVisitorOpenChar('${p.cid}')">私信 TA</button>`:''}
    <button class="dybtn out" onclick="dyRelToggleClose('${esc(k)}')">${close?'取消密友':'设为密友'}</button>
    <button class="dybtn out" onclick="dyRelToggleFollow('${esc(k)}')">${p.iFollow?'取消关注':'关注 TA'}</button>
    <button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function dyRelToggleClose(k){const l=dyCloseList(),i=l.indexOf(k);if(i<0)l.push(k);else l.splice(i,1);save();closeModal();render();toast(i<0?'已设为密友':'已取消密友');}
function dyRelToggleFollow(k){const p=dyRelPeople().find(x=>x.k===k);if(!p)return;closeModal();
  if(p.cid){const i=S.dy.following.indexOf(p.cid);if(i<0)S.dy.following.push(p.cid);else S.dy.following.splice(i,1);save();render();return toast(i<0?'已关注':'已取关');}
  const x=(S.dy.visitors||[]).find(v=>v.k===k);if(x){x.iFollow=!x.iFollow;save();render();toast(x.iFollow?'已关注':'已取关');}}
function dyRelSettings(){const on=!S.dy.relHide;openModal(`<h3>关注列表</h3>
  <div style="display:flex;align-items:center;gap:10px;padding:8px 0"><div style="flex:1"><b style="font-size:14px">关注列表对外可见</b><div style="font-size:12px;color:#888;margin-top:3px">关掉之后，别人点不开你的关注和互关</div></div><button class="btn ${on?'p':'g'}" onclick="S.dy.relHide=${on?'true':'false'};save();dyRelSettings()">${on?'已开启':'已关闭'}</button></div>
  <div class="btns" style="margin-top:8px"><button class="dybtn out" onclick="dyRelClearClose()">清空密友标记</button><button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function dyRelClearClose(){S.dy.closeFriends=[];save();closeModal();render();toast('密友标记已清空');}
/* ===== 观看历史 ===== */
function dyWatchRecord(v){if(!v)return;dyInit();const d=S.dy;if(!Array.isArray(d.watched))d.watched=[];
  const old=d.watched.find(x=>x.id===v.id),done=!!(old&&old.done);
  d.watched=d.watched.filter(x=>x.id!==v.id);
  d.watched.unshift({id:v.id,emoji:v.emoji||'🎬',grad:v.grad||DY_GRADS[0],lk:v.lk||0,desc:String(v.desc||'').slice(0,40),ts:Date.now(),done});
  if(d.watched.length>120)d.watched=d.watched.slice(0,120);save();}
function dyWatchFinish(id){const r=(S.dy.watched||[]).find(x=>x.id===id);if(r&&!r.done){r.done=true;save();}}
function dyOpenHistory(){dyInit();_dyHistTab='视频';_dyHistOnly='';_dyHistQ='';_dyHistSearch=false;_dySub='history';render();}
function dyHistSetTab(t){_dyHistTab=t;render();}
function dyHistSetOnly(v){_dyHistOnly=_dyHistOnly===v?'':v;render();}
function dyHistToggleSearch(){_dyHistSearch=!_dyHistSearch;if(!_dyHistSearch)_dyHistQ='';render();}
function dyHistSearch(){const el=$('#dyhist_q');_dyHistQ=el?el.value:'';render();const i=$('#dyhist_q');if(i)i.focus();}
function dyHistRows(){const q=String(_dyHistQ||'').trim().toLowerCase();let rows=(S.dy.watched||[]).slice();
  if(_dyHistOnly==='未看完')rows=rows.filter(r=>!r.done);else if(_dyHistOnly==='已看完')rows=rows.filter(r=>r.done);
  if(q)rows=rows.filter(r=>String(r.desc||'').toLowerCase().includes(q));return rows;}
async function dyHistClear(){if(!(S.dy.watched||[]).length)return toast('历史本来就是空的');
  if(!await uiConfirm('清空观看历史？'))return;S.dy.watched=[];save();render();toast('已清空');}
function dyHistCell(r,prev){const tag=(!prev||dyDayLabel(prev.ts)!==dyDayLabel(r.ts))?`<span class="dyh-day">${esc(dyDayLabel(r.ts))}</span>`:'';
  return `<div class="dyme-cell" onclick="dyOpenWork('${esc(r.id)}')" style="background:${r.grad}"><div class="dyme-emo">${esc(r.emoji)}</div>${tag}${r.done?'':'<span class="dyh-undone">未看完</span>'}<span class="dyme-play">${svgIc('heart',11,'#fff',2.4)} ${dyNum(r.lk||0)}</span></div>`;}
function dyHistoryView(){const rows=dyHistRows();
  const body=_dyHistTab!=='视频'?`<div class="dyvi-empty">${_dyHistTab==='用户'?'还没有看过谁的主页':_dyHistTab==='影视综'?'小手机里还没有影视综':'小手机里还没有直播'}</div>`
    :(rows.length?`<div class="dyme-grid" style="margin:0">${rows.map((r,i)=>dyHistCell(r,rows[i-1])).join('')}</div>`:'<div class="dyvi-empty">还没有看过视频～<br>去首页刷两条，或者点开自己的作品。</div>');
  return `<div class="dyh">
    <div class="dyvi-nav dy-safe-nav2"><i onclick="dySubClose()">‹</i><b>观看历史</b><em onclick="dyHistToggleSearch()">${svgIc('search',21,'#f2f2f4',2)}</em><em onclick="dyHistClear()">${svgIc('trash',21,'#f2f2f4',2)}</em></div>
    <div class="dyh-tabs">${['用户','视频','影视综','直播'].map(t=>`<span class="${_dyHistTab===t?'on':''}" onclick="dyHistSetTab('${t}')">${t}</span>`).join('')}</div>
    ${_dyHistSearch?`<div class="dyrel-search" style="margin:0 14px 10px">${svgIc('search',17,'#8a8a92',2)}<input id="dyhist_q" value="${esc(_dyHistQ)}" placeholder="搜索看过的视频" onchange="dyHistSearch()"></div>`:''}
    ${_dyHistTab==='视频'?`<div class="dyh-chips">${['未看完','已看完'].map(c=>`<span class="${_dyHistOnly===c?'on':''}" onclick="dyHistSetOnly('${c}')">${c}</span>`).join('')}</div>`:''}
    <div class="dyh-body" data-render-scroll-key="dy:hist:${esc(_dyHistTab)}:${esc(_dyHistOnly)}">${body}</div>
  </div>`;}
/* ===== 主页搜索（「我」页右上角那个放大镜） ===== */
function dyOpenMeSearch(){_dyMeQ='';_dyMeQRan=false;_dySub='mesearch';render();}
function dyMeSearchRun(){const el=$('#dyme_q'),q=el?String(el.value||'').trim():'';if(!q)return toast('写点什么再搜');
  S.dy.history=(S.dy.history||[]).filter(x=>x!==q);S.dy.history.unshift(q);if(S.dy.history.length>20)S.dy.history=S.dy.history.slice(0,20);
  _dyMeQ=q;_dyMeQRan=true;save();render();}
function dyMeSearchPick(q){const el=$('#dyme_q');if(el)el.value=q;_dyMeQ=q;_dyMeQRan=true;render();}
function dyMeSearchReset(){_dyMeQ='';_dyMeQRan=false;render();}
function dyMeSearchWorks(q){const s=q.toLowerCase();return (S.dy.mine||[]).filter(v=>((v.desc||'')+' '+(v.narration||'')).toLowerCase().includes(s));}
function dyMeSearchPeople(q){const s=q.toLowerCase();return dyRelPeople().filter(p=>String(p.name||'').toLowerCase().includes(s));}
function dyMeSearchResults(){const q=_dyMeQ,works=dyMeSearchWorks(q),people=dyMeSearchPeople(q);
  const w=works.length?`<div class="dys-sec">我的作品 (${works.length})</div><div class="dyme-grid" style="margin:0">${works.map((v,i)=>`<div class="dyme-cell" onclick="dyOpenWork('${v.id}')" style="background:${v.grad||DY_GRADS[i%DY_GRADS.length]}"><div class="dyme-emo">${v.emoji||'🎬'}</div><span class="dyme-play">${svgIc('heart',11,'#fff',2.4)} ${dyNum(v.lk||0)}</span></div>`).join('')}</div>`:'';
  const pp=people.length?`<div class="dys-sec">用户 (${people.length})</div>${people.map(dyRelRow).join('')}`:'';
  const none=(!works.length&&!people.length)?'<div class="dyvi-empty">主页里没有找到相关内容</div>':'';
  return `${w}${pp}${none}<div class="dys-all" onclick="dySubClose();dyDoSearch('${esc(q).replace(/'/g,"\\'")}')">${svgIc('search',17,'#4f8cff',2)}在全网搜「${esc(q)}」</div>`;}
function dyMeSearchView(){const his=S.dy.history||[];
  return `<div class="dys">
    <div class="dys-nav dy-safe-nav2"><i onclick="dySubClose()">‹</i><div class="dys-box">${svgIc('search',17,'#8a8a92',2)}<input id="dyme_q" value="${esc(_dyMeQ)}" placeholder="搜索主页或全网内容" onchange="dyMeSearchRun()"></div><span onclick="dyMeSearchRun()">搜索</span></div>
    <div class="dys-body" data-render-scroll-key="dy:mesearch">${_dyMeQRan&&_dyMeQ?dyMeSearchResults()
      :(his.length?his.map((h,i)=>`<div class="dys-row"><i onclick="dyMeSearchPick('${esc(h).replace(/'/g,"\\'")}')">${svgIc('clock',18,'#9a9aa2',2)}</i><span onclick="dyMeSearchPick('${esc(h).replace(/'/g,"\\'")}')">${esc(h)}</span><b onclick="dyDelHistory(${i})">✕</b></div>`).join('')+'<div class="dys-clear" onclick="dyClearHistory()">清除全部搜索记录</div>'
      :'<div class="dyvi-empty">还没有搜过什么～</div>')}</div>
    ${_dyMeQRan?`<div class="dys-back" onclick="dyMeSearchReset()">↺</div>`:`<div class="dys-mic" onclick="toast('语音搜索还没做～先打字吧')">${svgIc('mic',22,'#e6e6ea',2)}</div>`}
  </div>`;}
async function dyClearHistory(){if(!(S.dy.history||[]).length)return;if(!await uiConfirm('清除全部搜索记录？'))return;S.dy.history=[];save();render();toast('已清除');}
/* ===== 求更新 ===== */
function dyUpdateSync(){dyInit();const d=S.dy;if(!Array.isArray(d.updates))d.updates=[];const seen=new Set(d.updates.map(x=>x.k));let added=0;
  (d.following||[]).forEach(cid=>{const c=getC(cid);if(!c||c.deleted)return;const k='u:c:'+cid;if(seen.has(k))return;seen.add(k);
    d.updates.unshift({k,cid,name:c.remark||c.name,avatar:c.avatar,ts:Date.now()-(added++)*864e5,live:false});});
  (d.visitors||[]).forEach(x=>{if(x.cid)return;const k='u:'+x.k;if(seen.has(k))return;seen.add(k);
    d.updates.unshift({k,name:x.name,avatar:x.avatar,ts:Date.now()-(added++)*864e5,live:((x.name||'').length%4)===0});});
  if(d.updates.length>40)d.updates=d.updates.slice(0,40);return added>0;}
function dyUpdateRows(){return (S.dy.updates||[]).filter(x=>Date.now()-(x.ts||0)<7*864e5);}
function dyOpenUpdate(){if(dyUpdateSync())save(0);_dySub='update';render();}
function dyLastPostLabel(){const m=(S.dy.mine||[])[0];return m&&m.ts?dyWeekLabel(m.ts):'还没发过';}
function dyUpdateView(){const rows=dyUpdateRows(),live=rows.filter(x=>x.live).length;
  return `<div class="dyu">
    <div class="dyvi-nav dy-safe-nav2"><i onclick="dySubClose()">‹</i><b>求更新</b><em onclick="dyUpdateMenu()">···</em></div>
    <div class="dyu-head"><b>近 7 天收到 ${rows.length-live} 次求更新，${live} 次求开播</b><span>上次发布作品：${esc(dyLastPostLabel())}</span></div>
    <div class="dyu-list" data-render-scroll-key="dy:update">${rows.length?rows.map(x=>`<div class="dyu-row" onclick="${x.cid?`dyVisitorOpenChar('${x.cid}')`:`toast('这是网友，点不进去主页～')`}">${dyFace(dyRA(x.cid,x.avatar),'sm')}<div class="dyu-main"><div class="dyu-name">${esc(x.name)}</div>${x.live?'<div class="dyu-sub">求开播</div>':''}</div><span class="dyu-time">${esc(dyWeekLabel(x.ts))}</span></div>`).join(''):'<div class="dyvi-empty">这 7 天还没有人催你更新～</div>'}</div>
    <div class="dyu-foot"><button class="dyu-post" onclick="dyCompose()">发布作品</button><button class="dyu-live" onclick="toast('直播还没做～先发条作品吧')">去直播</button></div>
  </div>`;}
function dyUpdateMenu(){openModal(`<h3>求更新</h3><div class="btns" style="flex-direction:column;gap:8px">
  <button class="dybtn out" onclick="dyUpdateClear()">清空这些提醒</button>
  <button class="dybtn out" onclick="S.dy.updateOff=!S.dy.updateOff;save();closeModal();render();toast(S.dy.updateOff?'以后不再收到求更新':'已恢复接收')">${S.dy.updateOff?'恢复接收求更新':'不再接收求更新'}</button>
  <button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function dyUpdateClear(){S.dy.updates=[];save();closeModal();render();toast('已清空');}
/* ===== 全部功能 ===== */
/* 只留真能用的。点了只会弹一句「还没做」的，留着就是骗人。 */
function dyAllGroups(){return [
  ['创作',[['note','发布作品',"dyCompose()"],['image','我的作品',"dyMeSetTab('作品')"],['lock','私密作品',"dyPrivateWorks()"],['star','我的收藏',"dyMeSetTab('收藏')"]]],
  ['互动',[['users','主页访客',"dyOpenVisitors()"],['refresh','求更新',"dyOpenUpdate()"],['heart','我的关注',"dyOpenRel('关注')"],['clock','观看历史',"dyOpenHistory()"]]],
  ['我的',[['bag','我的订单',"dyGoOrders()"],['wallet','我的钱包',"dyGoWallet()"],['edit','编辑资料',"editDyProfile()"],['shield','隐私设置',"dyPrivacy()"]]]];}
function dyAllFeatures(){openModal(`<h3>全部功能</h3>${dyAllGroups().map(g=>`<div class="dyall-t">${esc(g[0])}</div><div class="dyall">${g[1].map(x=>`<div class="dyall-i" onclick="closeModal();${x[2]}">${svgIc(x[0],22,'#8a8a92',1.9)}<span>${esc(x[1])}</span></div>`).join('')}</div>`).join('')}<button class="btn g" style="margin-top:12px" onclick="closeModal()">关闭</button>`);}
function dyGoOrders(){if(typeof openOrders==='function'){closeModal();return openOrders();}toast('订单在淘宝里～');}
function dyGoWallet(){if(typeof openWallet==='function'){closeModal();return openWallet();}toast('钱包在设置里～');}
function dyPrivacy(){const vis=!S.dy.visitorHide,rel=!S.dy.relHide,upd=!S.dy.updateOff;
  openModal(`<h3>隐私设置</h3>${[['向他人展示我的访客记录',vis,"S.dy.visitorHide=!S.dy.visitorHide"],['关注列表对外可见',rel,"S.dy.relHide=!S.dy.relHide"],['接收求更新提醒',upd,"S.dy.updateOff=!S.dy.updateOff"]].map(r=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:.5px solid #2c2c2e"><b style="flex:1;min-width:0;font-size:14px;font-weight:500">${r[0]}</b><button class="btn ${r[1]?'p':'g'}" style="width:auto;flex:0 0 auto;padding:8px 16px" onclick="${r[2]};save();dyPrivacy()">${r[1]?'已开启':'已关闭'}</button></div>`).join('')}<button class="btn g" style="margin-top:12px" onclick="closeModal()">关闭</button>`);}
/* ===== 私密作品 / 作品排序 ===== */
function dyPrivateRows(){return (S.dy.mine||[]).filter(v=>v.priv);}
function dyPrivateWorks(){const rows=dyPrivateRows();
  openModal(`<h3>🔒 私密作品（${rows.length}）</h3><div style="font-size:12px;color:#888;margin:-4px 0 8px">只有你看得见，别人刷不到，也不出现在主页网格里</div>
    <div style="max-height:44vh;overflow:auto">${rows.length?rows.map(v=>`<div class="row" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee"><span style="font-size:22px">${esc(v.emoji||'🎬')}</span><b style="flex:1;font-size:14px;font-weight:500">${esc(v.desc||'（没有文案）')}</b><button class="dybtn out" onclick="dyTogglePrivate('${v.id}')">公开</button></div>`).join(''):'<div class="empty" style="padding:22px">还没有私密作品～在作品里点「更多 · 设为私密」</div>'}</div>
    <button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}
function dyTogglePrivate(id){const v=dyVid(id);if(!v)return;v.priv=!v.priv;save();closeModal();render();toast(v.priv?'已设为私密 🔒':'已公开');}
function dyWorkSortMenu(){openModal(`<h3>作品排序</h3><div class="btns" style="flex-direction:column;gap:8px">
  ${[['new','最新发布'],['hot','最多点赞']].map(s=>`<button class="btn ${_dyWorkSort===s[0]?'p':'g'}" onclick="_dyWorkSort='${s[0]}';closeModal();render()">${s[1]}</button>`).join('')}
  <button class="btn g" onclick="closeModal()">取消</button></div>`);}
function dyCmAt(id){const cs=S.contacts.filter(c=>!c.deleted&&!c.blocked);if(!cs.length)return toast('还没有角色可以 @');
  openModal(`<h3>@ 谁</h3><div style="max-height:46vh;overflow:auto">${cs.map(c=>`<div class="row" onclick="dyCmAtPick('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee">${av(c.avatar,'sm')}<b style="font-size:14px">${esc(c.remark||c.name)}</b></div>`).join('')}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function dyCmAtPick(cid){const c=getC(cid);closeModal();if(!c)return;const i=$('#dycm_in');if(i){i.value=(i.value||'')+'@'+(c.remark||c.name)+' ';i.focus();}}
function dyCmSend(id){const v=dyVid(id);if(!v)return;const inp=$('#dycm_in'),t=inp?String(inp.value||'').trim():'';if(!t)return;v.comments=v.comments||[];
  const row={name:dyNick(),avatar:dyAvatar(),me:true,text:t.slice(0,300),lk:0,d:dyToday()};
  if(_dyCmReply>=0&&v.comments[_dyCmReply]){const host=v.comments[_dyCmReply];host.replies=host.replies||[];host.replies.push(row);_dyCmExpand[_dyCmReply]=true;}
  else v.comments.push(row);
  save();
  /* 她评论了，角色一定要有人回她——被 @ 到的优先，没点名就让恋人或关注的角色来接。 */
  const ats=S.contacts.filter(c=>!c.deleted&&!c.blocked&&t.includes(c.remark||c.name));
  const who=ats.length?ats.slice(0,2):dyCommentResponder(v);
  who.forEach(c=>dyCharReplyComment(v,c,t));
  _dyCmReply=-1;render();if(inp)inp.value='';}
function dyToday(){const d=new Date();return (d.getMonth()+1)+'-'+d.getDate();}
function dyPostComment(id){dyCmSend(id);}
function dyDelComment(id,ci){dyCmDelete(id,ci);}
/* 编辑入口补全：昵称、简介（多行）、抖音号、性别年龄、等级牌、以及三项展示数据。
   这些都是这个页面上唯一会出现"我的文字"的地方，全部由用户自己填，代码里不预置任何人的内容。 */
function coupleTasksEnabled(c){return !!(taskRelationAllowed(c)&&S.couple.tasksEnabled===true);}
function coupleTasksToggle(){if(!S.couple)return;S.couple.tasksEnabled=S.couple.tasksEnabled!==true;save();render();}
function taskRelationAllowed(c){return !!(c&&S.couple&&S.couple.cid===c.id&&!c.deleted);}
function taskC(){const cc=S.couple&&getC(S.couple.cid);return cc&&!cc.deleted&&!cc.blocked&&coupleTasksEnabled(cc)&&taskRelationAllowed(cc)?cc:null;}
//@@ web
function taskDailyJournalRead(){try{const raw=localStorage.getItem(TASK_DAILY_JOURNAL_KEY),j=raw&&JSON.parse(raw);return j&&j.ver===1&&j.date===todayStr()&&j.roleId&&j.tasks&&j.tasks.date===j.date?j:null;}catch(_){return null;}}
function taskDailyJournalWrite(c){try{if((_coreBootRef||_androidOrphanCoreProbe)&&!_appBootFinished)return true;const t=c&&c.tasks;if(!c||!t||t.date!==todayStr()||!Array.isArray(t.list))return false;const tasks=JSON.parse(JSON.stringify(t)),at=Math.max(Date.now(),(+S._persistedAt||0)+1,+tasks.assignTs||0,...tasks.list.map(x=>+x.doneTs||0));localStorage.setItem(TASK_DAILY_JOURNAL_KEY,JSON.stringify({ver:1,at,date:t.date,roleId:String(c.id||''),tasks}));return true;}catch(_){return false;}}
function taskDailyJournalMerge(c){try{const j=taskDailyJournalRead();if(!j)return false;c=c||getC(j.roleId);if(!c||String(c.id||'')!==j.roleId)return false;const persisted=+S._persistedAt||0;if((+j.at||0)<=persisted)return false;const live=c.tasks&&c.tasks.date===j.date?c.tasks:null;if(live&&(+live.assignTs||0)>(+j.tasks.assignTs||0))return false;const next=JSON.stringify(j.tasks);if(live&&JSON.stringify(live)===next)return false;c.tasks=JSON.parse(next);return true;}catch(_){return false;}}
//@@ end
function taskDailyCount(c){return Math.max(1,Math.min(8,+((c&&c.taskN)||3)));}
function taskAutoState(c){if(!c)return null;const day=todayStr(),old=c.taskAuto&&typeof c.taskAuto==='object'?c.taskAuto:null;if(!old||old.date!==day)c.taskAuto={date:day,attempts:0,nextAt:0,lastErrorAt:0};return c.taskAuto;}
//@@ web
function tasksToday(c){if(taskDailyJournalMerge(c))save(0);const t=c&&c.tasks;if(!t||t.date!==todayStr())return null;
//@@ private
function tasksToday(c){const t=c&&c.tasks;if(!t||t.date!==todayStr())return null;
//@@ end
  const cap=taskDailyCount(c),old=Array.isArray(t.list)?t.list:[],clean=old.filter(x=>x&&!x.extra).filter((x,i,a)=>x.punish||a.slice(0,i+1).filter(y=>!y.punish).length<=cap);
  if(clean.length!==old.length){t.list=clean;save();}
  return t;}
function _taskNorm(s){return (''+s).replace(/[\s，。、！!？?.~…：:；;「」『』""''（）()]/g,'');}
// 判断 text 是否和 list 里已有任务重复：一模一样 / 子串 / 共享强关键字(检讨等) / 关键字高度重合
const _TASK_KW=['检讨','保证书','小作文','作文','情书','彩虹屁','道歉信','认错书'];
function taskDup(list,text){const nt=_taskNorm(text);if(!nt)return true;const setT=new Set(nt);
  const kwT=_TASK_KW.filter(k=>nt.includes(k));
  return (list||[]).some(x=>{const nx=_taskNorm(x.text);if(!nx)return false;
    if(nx===nt)return true;
    if(Math.min(nx.length,nt.length)>=3&&(nx.includes(nt)||nt.includes(nx)))return true;
    if(kwT.some(k=>nx.includes(k)))return true;/* 都是"写检讨/作文/保证书"这类同义任务 */
    const setX=new Set(nx);let inter=0;setT.forEach(ch=>{if(setX.has(ch))inter++;});
    const shorter=Math.min(setT.size,setX.size);
    return shorter>=3&&inter/shorter>=0.8;/* 短任务的字几乎都在另一条里→重复 */});}
/* 任务限定了时间段（早上拍照、中午吃饭…）就带最晚完成时间 due（"HH:MM"），过了还没做就是逾期，不能再点完成（TASK_DUE_SLOT_V1）。
   角色布置时自己给 due；没给但任务里写了时间段，按默认时间补上。 */
const TASK_SLOTS=[[/早上|早晨|清晨|一早|起床/,'早上','10:00'],[/上午/,'上午','12:00'],[/中午|午饭|午餐|午休/,'中午','14:00'],[/下午/,'下午','18:00'],[/傍晚|黄昏/,'傍晚','19:30'],[/晚上|今晚|晚饭|晚餐|睡前|夜里/,'晚上','23:30']];
function taskDueFor(o,text){const s=String(text||'');let slot=null,at=1e9;for(const z of TASK_SLOTS){const m=s.match(z[0]);if(m&&m.index<at){at=m.index;slot=z;}}
  const raw=String(o&&o.due||'').trim().replace('：',':'),m=raw.match(/^(\d{1,2}):(\d{2})$/);let due='';if(m&&+m[1]>=5&&+m[1]<=23&&+m[2]<=59)due=String(+m[1]).padStart(2,'0')+':'+m[2];
  if(!due&&slot)due=slot[2];return due?{due,slot:slot?slot[1]:''}:null;}
function taskDueAt(t,x){if(!t||!x||!x.due||!/^\d{2}:\d{2}$/.test(x.due))return 0;const [y,mo,d]=String(t.date||'').split('-').map(Number),[h,mi]=x.due.split(':').map(Number);return y?new Date(y,mo-1,d,h,mi,0,0).getTime():0;}
function taskOverdue(x,t,now){const at=taskDueAt(t,x);return !!at&&!(x&&x.done)&&(now==null?Date.now():now)>at;}
function taskVerifyLabel(x){if(typeof taskNeedsPhoto==='function'&&taskNeedsPhoto(x))return '上传照片给ta看';return {steps:'我走够了',essay:'写好交给ta',moment:'我发朋友圈了',tweet:'我发推了',douyin:'我发抖音了',real:'完成了',truth:'老实回答ta',photo:'上传照片给ta看'}[x.verify]||'完成';}
function postedSince(kind,since){since=since||0;
  if(kind==='moment')return S.moments.some(p=>p.authorId==='me'&&(p.time||0)>since);
  if(kind==='tweet')return (S.x&&S.x.tweets||[]).some(t=>t.who==='me'&&(t.time||0)>since);
  if(kind==='douyin')return (S.dy&&S.dy.mine||[]).some(v=>(v.ts||0)>since);
  return false;}
function renderTasks(){const c=taskC();
  if(!c){const off=S.contacts.some(x=>!x.deleted&&!x.blocked&&!coupleTasksEnabled(x));return `<div class="nav"><span class="l" onclick="home()">‹</span><span class="t">任务便签</span><span class="r"></span></div><div class="scroll" style="background:#000"><div class="empty" style="padding:50px 24px;line-height:2">${off?'已关闭布置任务的角色不会再给你安排任务。':'还没有恋人角色～<br>先创建一个角色（最好在情侣空间绑定），ta就能给你布置任务啦'}</div></div>`;}
  checkTaskPenalty(c);const t=tasksToday(c);const n=taskDailyCount(c);
  let body;
  if(!t){body=`<div style="margin:14px;padding:20px;border-radius:16px;background:linear-gradient(145deg,#f59e0b,#b45309);color:#fff;text-align:center">
      <div style="font-size:15px">${esc(c.remark||c.name)} 还没布置今天的任务</div>
      <div style="font-size:12px;opacity:.9;margin:6px 0 14px">每天打开自动收到 · 当天23:59前完成<br>全部完成有奖励🎁，没完成会被记仇、线下受罚哦</div>
      <button class="btn" style="background:#fff;color:#b45309;font-weight:700" ${_taskBusy?'disabled':''} onclick="genTasks()">${_taskBusy?'ta在安排…':'📋 让ta布置今天的任务'}</button></div>
    <div class="section" style="margin:12px"><div class="it"><span>每天任务条数</span><span class="v"><input id="tk_n" type="number" min="1" max="8" value="${n}" style="width:46px;text-align:center;border:1px solid #38383a;border-radius:6px;padding:4px;background:#2c2c2e;color:#eee"> <button class="minibtn" onclick="(function(){var v=Math.max(1,Math.min(8,+$('#tk_n').value||3));taskC().taskN=v;save();toast('每天'+v+'条');})()">存</button></span></div>
      <div class="it"><span>每天布置时间</span><span class="v"><input id="tk_time" type="time" value="${c.taskTime||'09:00'}" style="border:1px solid #38383a;border-radius:6px;padding:4px;background:#2c2c2e;color:#eee"> <button class="minibtn" onclick="(function(){taskC().taskTime=$('#tk_time').value||'09:00';save();toast('每天'+taskC().taskTime+'布置');})()">存</button></span></div>
      <div class="hint" style="padding:0 14px">到这个点之后、你打开 North 就会收到当天任务（不会再凌晨发）。也能随时点上面的按钮手动让ta布置。</div></div>`;}
  else{const done=t.list.filter(x=>x.done).length,total=t.list.length,all=total&&done===total;
    body=`<div style="margin:14px;padding:16px;border-radius:16px;background:linear-gradient(145deg,${all?'#19a463,#0c6b3f':'#f59e0b,#b45309'});color:#fff;text-align:center">
      <div style="font-size:14px">今天的任务 · ${esc(c.remark||c.name)} 布置</div>
      <div style="font-size:30px;font-weight:700;margin:4px 0">${done}/${total}</div>
      <div style="font-size:12px;opacity:.95">${all?'全部完成啦！等ta的奖励🎁':'今天23:59前完成，全做完有奖励～'}</div></div>
      ${t.list.map((x,i)=>`<div class="section" style="margin:10px 12px"><div style="padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="tag">${x.truth?'真心话':(x.kind==='real'?'现实':'手机')}</span>${x.done?'<span style="color:#19a463;font-size:13px">已完成</span>':''}</div>
        <div style="margin:8px 0;font-size:15px;line-height:1.5;${x.done?'color:#888;text-decoration:line-through':'color:#eee'}">${esc(x.text)}</div>
        ${x.done?'':`<button class="btn p" onclick="completeTask('${x.id}')">${taskVerifyLabel(x)}</button>`}
      </div></div>`).join('')}
      <div class="hint" style="padding:6px 16px">手机任务会真的验证（作文要交给ta看、发布类要真发了、步数要够），别糊弄~ 现实任务靠你自觉，骗ta的话线下要罚的</div>`;}
  return `<div class="nav"><span class="l" onclick="home()">‹</span><span class="t">任务便签</span><span class="r"></span></div>
    <div class="scroll" style="background:#000">${body}<div style="height:20px"></div></div>`;}
async function genTasks(opt){opt=opt||{};const automatic=opt.automatic===true,c=taskC();if(!c){if(!automatic)toast('没有可布置任务的角色');return;}if(!coupleTasksEnabled(c)){if(!automatic)toast('这个角色已关闭布置任务');return;}if(tasksToday(c)){if(!automatic)toast('今天的任务ta已经布置过啦');return;}if(_taskBusy)return;
  checkTaskPenalty(c);const _penalty=_taskPenaltyNote[c.id]||'';delete _taskPenaltyNote[c.id];_taskBusy=true;if(!automatic||cur().p==='tasks')render();if(!automatic){if(typeof taskToast==='function')taskToast('ta在琢磨今天怎么安排你…');else toast('ta在琢磨今天怎么安排你…');}
  const n=taskDailyCount(c),normalN=Math.max(0,n-1);
  const hist=(c.taskHist||[]).map(s=>({text:s}));// 最近几天布置过的任务，用来防止重复
  const avoidTxt=hist.length?'\n· 【最近这些任务你已经布置过了，今天务必换着花样来，别再重复、也别换汤不换药地重复同类】：'+hist.map(h=>h.text).join('；'):'';
  try{const allowed='essay（写小作文/检讨/彩虹屁/想你的话/保证书，target填字数上限如100）、moment（发一条朋友圈）、tweet（发一条推特X）、douyin（发一条抖音）、real（现实里的小事或暧昧亲密小任务，靠她自觉打卡，比如：喝杯水、好好吃饭、敷面膜、早点睡、睡前跟你撒娇道晚安、乖乖只想你一个、今天不准跟别的男生聊天等）、photo（要她拍照片给你看的：给你拍张自拍、拍正在吃的饭、拍手边最喜欢的东西、穿你喜欢的小裙子拍给你等；她必须在任务里上传照片、你看过才算完成）';
    const _tm=[{role:'system',content:buildSystem(c)},{role:'user',content:'[系统：现在你来给'+S.me.name+'布置今天总共恰好 '+n+' 条小任务。你是ta的恋人/掌控者，按你的人设、此刻心情、ta最近的表现来布置。\n· 任务一定要【有趣、有创意、好玩】，别死板、别像打卡清单、别每天千篇一律——可以整点花活、玩梗、设小情境。'+avoidTxt+'\n· 多来点【暧昧、撩人、亲密】的，而且要以【Dom的姿态】来布置：命令式、强势、掌控欲拉满，把ta当你的小sub来调教，语气笃定带点危险又宠溺，要ta乖乖服从听话。可以大胆放得开、带点涩，越让ta脸红心跳、心甘情愿被你拿捏越好（保持是两个相爱的人之间有掌控有宠爱的情趣，不用拘谨）。\n· 现实任务一定要轻松，别累人：绝对不要罚跑步/暴走/喝很多杯水那种。\n大部分任务要是【在手机上就能完成的】(essay/moment/tweet/douyin)，可以有一两条现实任务(real)。每条必须从这些可验证类型里选一个：'+allowed+'。\n· 这 '+n+' 条里必须有且只有一条 verify 为 truth 的任务，内容是你【今天最想问'+S.me.name+'的一个真心话问题】（一句问句就好，可以暧昧、走心或是你好奇/在意的事），target填0、kind填real。真心话算在总数里，除此之外只能再给 '+normalN+' 条，绝不能额外追加。\n· 现在是'+hm(Date.now())+'。如果某条任务限定了时间段（早上/上午/中午/下午/傍晚/晚上/睡前），必须给它加 due，写最晚完成时间"HH:MM"（一般早上10:00、上午12:00、中午14:00、下午18:00、傍晚19:30、晚上23:30，你也可以按人设定得更严），过了这个时间没做就算逾期；已经过去的时间段不要再布置。没限定时间段的任务不写 due，当天23:59前完成即可。\n只输出JSON数组、不要任何解释：[{"text":"任务描述(用你的第一人称口吻，强势Dom的命令语气，像在调教/撩/宠你的小sub，可以霸道也可以俏皮有梗)","kind":"app或real","verify":"类型代码","target":数字(没有填0),"due":"HH:MM(只有限定了时间段才写)"}]'}];
    let arr=await aiGen(_tm,{max:760},parseArr);
    if(!arr||!arr.length)arr=await aiGen(_tm,{max:760,aux:true},parseArr);/* 主模型不行就用副模型兜底 */
    if(!Array.isArray(arr))arr=[];
    let truthQ='';
    const list=[];for(const o of arr){const text=(o.text||'').toString().slice(0,140);if(!text)continue;
      if(o.verify==='truth'){if(!truthQ)truthQ=text;continue;}/* 真心话算在每日总数里 */
      if(list.length>=normalN)continue;if(taskDup(list,text)||taskDup(hist,text))continue;/* 跳过重复/最近布置过的 */
      const due=taskDueFor(o,text);if(due&&taskDueAt({date:todayStr()},due)<=Date.now()+20*60000)continue;/* 时间段已经过了的不布置 */
      list.push({id:uid(),text,kind:o.kind==='real'?'real':'app',verify:['essay','moment','tweet','douyin','real','photo'].indexOf(o.verify)>=0?o.verify:'real',target:+o.target||0,done:false,...(due||{})});}
    const fallback=[
      {text:'睡前认真来跟我说一句只属于今天的晚安。',kind:'real',verify:'real',target:0},
      {text:'写三句今天为什么喜欢我，别敷衍。',kind:'app',verify:'essay',target:80},
      {text:'拍下你现在手边最喜欢的东西给我看。',kind:'real',verify:'real',target:0},
      {text:'发一条只有我能看懂的朋友圈。',kind:'app',verify:'moment',target:0},
      {text:'挑一个时刻主动来跟我撒一次娇。',kind:'real',verify:'real',target:0},
      {text:'写一小段今天最想让我夸你的地方。',kind:'app',verify:'essay',target:100},
      {text:'今天找一件让自己开心的小事，做完告诉我。',kind:'real',verify:'real',target:0},
      {text:'认真想一句只想对我说的话，今晚交给我。',kind:'app',verify:'essay',target:80}
    ];
    for(const f of fallback){if(list.length>=normalN)break;if(taskDup(list,f.text)||taskDup(hist,f.text))continue;list.push({id:uid(),...f,done:false});}
    for(const f of fallback){if(list.length>=normalN)break;if(taskDup(list,f.text))continue;list.push({id:uid(),...f,done:false});}
    if(list.length!==normalN)throw 0;
    list.push({id:uid(),text:truthQ||'今天，你最想跟我说、却一直没说出口的一句话是什么？',kind:'truth',verify:'truth',target:0,done:false,truth:true});// 固定的"他想问我的真心话"
    c.taskHist=[...list.map(x=>x.text),...(c.taskHist||[])].slice(0,30);// 记下今天布置的，往后几天别重复
//@@ web
    c.tasks={date:todayStr(),assignTs:Date.now(),list,dailyRewardTaskIds:list.filter(x=>!x.punish&&!x.extra).slice(0,3).map(x=>x.id),rewarded:false,penalized:false};taskPunishFlush(c);c.taskAuto={date:todayStr(),attempts:0,nextAt:0,lastErrorAt:0};taskDailyJournalWrite(c);save();_taskBusy=false;render();if(!automatic||cur().p==='tasks'){if(typeof taskToast==='function')taskToast('今天的任务来咯');else toast('任务来咯📋');}
//@@ private
    c.tasks={date:todayStr(),assignTs:Date.now(),list,dailyRewardTaskIds:list.filter(x=>!x.punish&&!x.extra).slice(0,3).map(x=>x.id),rewarded:false,penalized:false};taskPunishFlush(c);c.taskAuto={date:todayStr(),attempts:0,nextAt:0,lastErrorAt:0};save();_taskBusy=false;render();if(!automatic||cur().p==='tasks'){if(typeof taskToast==='function')taskToast('今天的任务来咯');else toast('任务来咯📋');}
//@@ end
    if(!c.blocked)scheduleReply(c.id,'[系统：'+(_penalty?'两件事合在这一次回复里说，每件只说一遍：①'+_penalty+'②':'')+'你刚在'+S.me.name+'手机的任务便签里给ta布置了今天的任务，跟ta说一声、催ta按时完成（限定了时间段的要在你定的时间前，其余【今天23:59之前】）、说说不完成的后果，一两句，符合你人设。别逐条复述任务。]');
  }catch(e){const st=taskAutoState(c),attempts=Math.min(8,(+st.attempts||0)+1);st.attempts=attempts;st.lastErrorAt=Date.now();st.lastError='generation_failed';st.nextAt=Date.now()+Math.min(6*3600000,15*60000*Math.pow(2,attempts-1));save();_taskBusy=false;if(_penalty&&!c.blocked)scheduleReply(c.id,'[系统：'+_penalty+']');if(!automatic||cur().p==='tasks')render();/* 自动布置失败只留内部退避记录，打开小手机时绝不弹失败提示。 */if(!automatic)toast('没布置成功，再点一次');}}
async function completeTask(id){const c=taskC();const t=tasksToday(c);if(!t)return;const x=t.list.find(z=>z.id===id);if(!x||x.done)return;
  if(taskOverdue(x,t)){const tip='这条要在'+(x.slot?x.slot+' ':'')+x.due+'前做完，已经逾期啦';if(typeof taskToast==='function')taskToast(tip);else toast(tip);return;}
  if(x.verify==='truth'){openTruth(id);return;}
  if(x.verify==='essay'){openEssay(id);return;}
  /* 要拍照片的任务：必须在任务里上传照片、经角色看过才算完成，不能直接点完成（防止糊弄） */
  if(typeof taskNeedsPhoto==='function'&&taskNeedsPhoto(x)&&typeof openPhotoProof==='function'){openPhotoProof(id);return;}
  if(x.verify==='steps'){if(!await uiConfirm('完成这条了吗？（步数任务已取消，点确定即可完成）'))return;}
  if(x.verify==='moment'&&!postedSince('moment',t.assignTs)){toast('布置任务后还没发朋友圈哦，发一条再来点完成');return;}
  if(x.verify==='tweet'&&!postedSince('tweet',t.assignTs)){toast('布置任务后还没发推哦，发一条再来');return;}
  if(x.verify==='douyin'&&!postedSince('douyin',t.assignTs)){toast('布置任务后还没发抖音哦，去发一条');return;}
  if(x.verify==='real'&&!await uiConfirm('确定真的完成了这条现实任务吗？\n骗ta的话…线下见面要受罚的哦')){return;}
  finishTask(c,x);}
//@@ web
function finishTask(c,x,proof){x.done=true;x.doneTs=Date.now();taskDailyJournalWrite(c);save();render();if(typeof taskToast==='function')taskToast('完成啦');else toast('完成啦 ✅');
//@@ private
function finishTask(c,x,proof){x.done=true;x.doneTs=Date.now();save();render();if(typeof taskToast==='function')taskToast('完成啦');else toast('完成啦 ✅');
//@@ end
  if(!c.blocked)scheduleReply(c.id,'[系统：'+S.me.name+'完成了你今天布置的任务「'+x.text+'」'+(proof?'，ta把内容发到你们聊天里了，先看一眼':'')+'。简短回应一句（夸ta/调侃/继续端着都行，符合你人设）。]');
  checkAllDone(c);}
//@@ web
function checkAllDone(c){const t=tasksToday(c);if(!t||t.rewarded)return;if(t.list.length&&t.list.every(x=>x.done)){t.rewarded=true;taskDailyJournalWrite(c);save();
//@@ private
function checkAllDone(c){const t=tasksToday(c);if(!t||t.rewarded)return;if(t.list.length&&t.list.every(x=>x.done)){t.rewarded=true;save();
//@@ end
    if(!c.blocked)scheduleReply(c.id,'[真实任务事件：'+S.me.name+'把你今天布置的 '+t.list.length+' 条任务全部完成了。你知道每项任务和完成结果。请按基础人设、世界书、相关记忆和你本人的判断，自主决定是否回应、带着什么情绪以及要不要使用奖励、送礼或其他可用功能；系统不替你规定必须夸奖或送礼。不要解释规则。]');}}
function openEssay(id){const c=taskC();const t=tasksToday(c);const x=t&&t.list.find(z=>z.id===id);if(!x)return;const max=x.target||100;
  openModal(`<h3>交作业</h3><div class="hint">${esc(x.text)}<br>（${max}字以内，至少10字，认真写，ta会看的~）</div>
    <div class="field"><textarea id="essay_t" rows="5" placeholder="在这里写…" oninput="var e=$('#essay_c');if(e)e.textContent=this.value.trim().length+'/'+${max}"></textarea><div id="essay_c" style="text-align:right;font-size:12px;color:#999">0/${max}</div></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="submitEssay('${id}',${max})">交给ta</button></div>`);}
function submitEssay(id,max){const ta=$('#essay_t');const v=(ta?ta.value:'').trim();if(v.length<10){toast('至少写10个字啦，别糊弄~');return;}if(v.length>max){toast('超字数了，'+max+'字以内');return;}
  const c=taskC();const t=tasksToday(c);const x=t&&t.list.find(z=>z.id===id);if(!x)return;
  pushMsg(c.id,{role:'user',type:'text',content:'【作业·'+x.text+'】\n'+v,id:uid()});closeModal();finishTask(c,x,v);}
function openTruth(id){const c=taskC();const t=tasksToday(c);const x=t&&t.list.find(z=>z.id===id);if(!x)return;
  openModal(`<h3>真心话</h3><div class="hint" style="color:#ddd;font-size:14px;line-height:1.6">ta想问你：<br><b style="color:#ff8fab">${esc(x.text)}</b><br><span style="color:#999">老实回答ta哦，会发到你们的聊天里～</span></div>
    <div class="field"><textarea id="truth_t" rows="4" placeholder="如实回答…"></textarea></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">先不答</button><button class="btn p" onclick="submitTruth('${id}')">告诉ta</button></div>`);}
function submitTruth(id){const ta=$('#truth_t');const v=(ta?ta.value:'').trim();if(v.length<2){toast('好歹答一句嘛~');return;}
  const c=taskC();const t=tasksToday(c);const x=t&&t.list.find(z=>z.id===id);if(!x)return;
  pushMsg(c.id,{role:'user',type:'text',content:'【真心话·'+x.text+'】\n'+v,id:uid()});closeModal();finishTask(c,x,v);}
/* 没完成的旧任务：只追究最近3天内的（两个月前的旧账不再翻）。提醒不立刻发：先留4秒，若紧接着要布置今天的任务，
   就和“今天的任务布置好了”合成一条回复，免得两条系统提示挤在一起，第二条把第一条的话又说一遍。 */
const _taskPenaltyNote={};
function checkTaskPenalty(c){const t=c&&c.tasks;if(!t||t.date===todayStr()||t.penalized)return;
  const undone=t.list.filter(x=>!x.done&&!x.missed);t.penalized=true;const ageDays=Math.round((Date.parse(todayStr())-Date.parse(t.date))/864e5);
  /* 连续几天没做完（TASK_PUNISH_V1）：只有相邻两天都有没做完的才接着数，做完的一天清零 */
  const ms=c.taskMiss||{},gap=ms.date?Math.round((Date.parse(t.date)-Date.parse(ms.date))/864e5):0;ms.streak=undone.length?(gap===1?(+ms.streak||0)+1:1):0;ms.date=t.date;c.taskMiss=ms;
  if(undone.length&&!(ageDays>3)){grudgesOf(c).unshift({id:uid(),text:t.date+' 没完成我布置的任务（差'+undone.length+'条：'+undone.map(x=>x.text).join('、').slice(0,36)+'）',done:false,ts:Date.now()});
    behaviorRecord('task',t.date+' 有 '+undone.length+' 条任务没完成：'+undone.map(x=>x.text).join('、').slice(0,50),'task',{force:true});
    if(!c.blocked){const jail=ms.streak>=3&&!!(S.couple&&S.couple.cid===c.id&&S.couple.jailAuth)&&!(S.jail&&S.jail.active);
      c.taskPunish={date:t.date,status:'pending',jail,at:Date.now(),tries:0,before:taskPunishSnap(c)};
      _taskPenaltyNote[c.id]=taskPunishNote(c,t,undone,ms.streak,jail);setTimeout(()=>{const n=_taskPenaltyNote[c.id];if(!n)return;delete _taskPenaltyNote[c.id];scheduleReply(c.id,'[系统：'+n+']');},4000);}}
  save();}
/* 任务没做完必须受一个小惩罚（TASK_PUNISH_V1）：第二天由角色自己想、用真实功能执行——扣零花钱、锁软件、罚写检讨/罚任务；
   连续三天没做完且情侣空间授权了小黑屋，角色先用自己的口吻通知，再关进去（关小黑屋本身就要求先说出口）。
   角色没真正执行就再催一次；还没有，系统按角色的名义补一条罚写检讨，保证“没做完必有惩罚”。 */
function taskPunishTools(c){const rows=[];if(S.couple&&S.couple.cid===c.id){
    if(S.couple.walletAuth&&(+S.me.balance||0)>0)rows.push('扣零花钱：单独一行 [扣款|金额]（ta现在余额 ¥'+(+S.me.balance).toFixed(2)+'，金额你自己拿捏，别超过余额）');
    const g=S.couple.grant||{},apps=Object.keys(LOCKABLE).filter(k=>g[k]).map(k=>LOCKABLE[k]);if(apps.length)rows.push('锁ta的软件：单独一行 [锁定|App名|时长]（能锁：'+apps.join('、')+'；时长你定，比如 3小时、到明早8点，最长7天）');}
  const jailOk=!!(S.couple&&S.couple.cid===c.id&&S.couple.jailAuth);
  rows.push('罚写检讨或加一条罚的任务：单独一行 [罚任务|内容|字数|截止时间]，比如 [罚任务|写一份检讨，说清楚昨天为什么没做完|150|21:00]；不用写字的现实小惩罚字数填0；截止时间你自己定（今天之内的"HH:MM"），不写就是4小时后。它会出现在ta今天的任务便签里，ta也得完成'+(jailOk?'，到点没做完你就把ta关进小黑屋':''));
  return rows;}
function taskPunishNote(c,t,undone,streak,jail){const who=S.me.name,list=undone.map(x=>x.text).join('、').slice(0,60);
  if(jail)return t.date+'你给'+who+'布置的任务，ta又有 '+undone.length+' 条没完成（'+list+'），这已经是连续第 '+streak+' 天没做完了。你决定把ta关进小黑屋：先用你自己的口吻明明白白告诉ta，你现在就要把ta关进小黑屋、为什么（一两句，让ta知道要被关了，不要说“如果/再这样”），然后单独一行 [关小黑屋|连续'+streak+'天没完成任务]。这是真实执行的。';
  return t.date+'你给'+who+'布置的任务，ta有 '+undone.length+' 条没完成（'+list+'）'+(streak>=2?'，已经连续 '+streak+' 天没做完了，罚得重一点':'')+'。规则：任务没做完就必须受一个小惩罚，罚什么由你自己想，按你的人设和此刻心情来。可以用的方式：\n· '+taskPunishTools(c).join('\n· ')+'\n先用你的口吻说一两句（冷淡、生气、失望、坏笑都行），然后必须输出一个惩罚指令，真的执行，不能只是口头威胁，也别说“下次再罚”。';}
function taskPunishSnap(c){const st=typeof companionState==='function'&&S.couple&&S.couple.cid===c.id?companionState():null,t=c.tasks;
  return {bal:+S.me.balance||0,locks:Object.keys(S.couple&&S.couple.locks||{}).length,cmds:(st&&st.commands||[]).filter(x=>x&&(x.action==='lock'||x.action==='limit')).length,jail:!!(S.jail&&S.jail.active),pt:(c.taskPunishQueue||[]).length+(t&&t.date===todayStr()?t.list.filter(x=>x&&x.punish).length:0)};}
function taskPunishFired(c){const p=c&&c.taskPunish,b=p&&p.before;if(!b)return false;const n=taskPunishSnap(c);return n.bal<b.bal-.001||n.locks>b.locks||n.cmds>b.cmds||n.jail&&!b.jail||n.pt>b.pt;}
function taskPunishAddTask(c,arg){if(!c)return false;const parts=String(arg||'').split(/[|｜]/),text=(parts[0]||'').replace(/[「」『』\x22]/g,'').trim().slice(0,80);if(text.length<2)return false;
  const n=parseInt(String(parts[1]||'').replace(/[^\d]/g,''),10),due=taskPunishDue(parts[2]),write=n>0||/检讨|保证书|写|字/.test(text)&&!(parts.length>1&&n===0),target=write?Math.max(30,Math.min(500,n||100)):0;
  const x={id:uid(),text,kind:write?'app':'real',verify:write?'essay':'real',target,done:false,punish:true,date:todayStr(),due},t=c.tasks&&c.tasks.date===todayStr()?c.tasks:null;
  if(t){if(t.list.filter(z=>z&&z.punish).length>=2)return false;t.list.push(x);t.rewarded=false;}else{c.taskPunishQueue=(c.taskPunishQueue||[]).slice(0,1);c.taskPunishQueue.push(x);}
  save();if(cur().p==='tasks')render();return true;}
function taskPunishFlush(c){const q=c&&c.taskPunishQueue;if(!q||!q.length||!c.tasks||c.tasks.date!==todayStr())return;c.tasks.list.push(...q.splice(0).filter(x=>!x.date||x.date===todayStr()).map(x=>({...x,id:x.id||uid()})));delete c.taskPunishQueue;}
/* 罚的任务都有截止时间（角色定，没定就是4小时后，最晚23:30，至少留1小时）；到点没做完：授权了小黑屋就让角色先开口通知再关进去，没授权就再罚一次 */
function taskPunishDue(raw){const m=String(raw||'').trim().replace('：',':').match(/^(\d{1,2}):(\d{2})$/),now=new Date(),pad=n=>String(n).padStart(2,'0'),hm=d=>pad(d.getHours())+':'+pad(d.getMinutes());let due=m&&+m[1]<=23&&+m[2]<=59?pad(+m[1])+':'+m[2]:'';
  const min=new Date(Date.now()+60*60000),dflt=new Date(Math.min(Date.now()+4*3600000,new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,30).getTime()));if(min.getDate()!==now.getDate())return '23:59';if(!due||due<hm(min))due=hm(dflt<min?min:dflt);return due;}
function taskPunishDeadline(c){const t=c&&c.tasks;if(!t||t.date!==todayStr()||c.blocked||c.taskPunish&&c.taskPunish.status==='pending')return;const x=t.list.find(z=>z&&z.punish&&!z.done&&!z.missed&&taskOverdue(z,t));if(!x)return;x.missed=true;
  const jail=!!(S.couple&&S.couple.cid===c.id&&S.couple.jailAuth)&&!(S.jail&&S.jail.active),who=S.me.name;c.taskPunish={date:t.date,status:'pending',jail,at:Date.now(),tries:0,before:taskPunishSnap(c),source:'punish-overdue'};save();
  scheduleReply(c.id,'[系统：你罚'+who+'的「'+x.text+'」要求 '+x.due+' 前完成，ta到点了还没做。'+(jail?'说好的，你现在就把ta关进小黑屋：先用你自己的口吻明明白白告诉ta，你现在就要把ta关进小黑屋、为什么（一两句，不要说“如果/再这样”），然后单独一行 [关小黑屋|罚的任务没按时完成]。这是真实执行的。':'再给ta一个小惩罚，必须真的执行。可以用的方式：\n· '+taskPunishTools(c).join('\n· ')+'\n先用你的口吻说一两句，然后输出一个惩罚指令。')+']');}
function taskPunishSweep(c){const p=c&&c.taskPunish;if(!p||p.status!=='pending')return;
  if(taskPunishFired(c)){p.status='done';p.doneAt=Date.now();if(p.jail&&S.jail&&S.jail.active&&c.taskMiss)c.taskMiss.streak=0;save();return;}
  if(Date.now()-p.at<3*60000||_taskPenaltyNote[c.id]||c.blocked)return;
  if((+p.tries||0)<1){p.tries=1;p.at=Date.now();save();scheduleReply(c.id,'[系统：你刚才说要罚'+S.me.name+'（昨天的任务没做完），但还没有真正执行。现在就执行：'+(p.jail?'先用一句话告诉ta你要把ta关进小黑屋，然后单独一行 [关小黑屋|连续没完成任务]':'从这些里挑一个，单独一行输出指令：\n· '+taskPunishTools(c).join('\n· '))+'。不要解释规则。]');return;}
  if(p.jail&&(+p.tries||0)<2){p.tries=2;p.jail=false;p.at=Date.now();save();scheduleReply(c.id,'[系统：小黑屋这次没能关成。改成给'+S.me.name+'一个小惩罚，单独一行输出指令：\n· '+taskPunishTools(c).join('\n· ')+'。不要解释规则。]');return;}
  p.status='done';p.fallback=true;p.doneAt=Date.now();taskPunishAddTask(c,'写一份检讨，说清楚'+p.date.slice(5).replace('-','月')+'日的任务为什么没做完|100');
  pushMsg(c.id,{role:'assistant',type:'sys',content:(c.remark||c.name)+' 罚你写一份检讨，已经放进今天的任务便签',id:uid()});save();}

/* ---------- 微信主界面 ---------- */
/* WECHAT_INTERACTION_STUDIO_V1：微信专属手感；事件只观察，不取消、延迟或重放业务点击。 */
let _wxUiLast=null,_wxUiPress=null,_wxUiBloom=null,_wxUiReady=false;
let _shellControlLast=null,_shellSwitchPending=null;
const _wxUiJobs=new Set(),_wxUiMovingPanels=new Set();let _wxUiPanels=[],_wxUiPanelStates={};
function wxInteractionPage(c){return !!c&&(/^wx/.test(c.p)||['wechat','chat','group','pfchat','pfgroup','pffriends','chatDetails','contactInfo','friendInfo','contactSettings','contactEdit','roleMoments','roleMomentDetail','roleFeatures','roleImageStudio','newfriends','transferDetail','groupTransferDetail','grpSend','rpSend','tfSend','rpDetail','ginfo','gpick','gqr','gsearch','gmanage','gsettings','relnet','reledit','relperson'].includes(c.p));}
function wxUiAnimate(el,frames,duration,delay,done){
  if(!el||!el.isConnected||!shellMotionAllowed())return null;
  try{const a=el.animate(frames,{duration:duration||280,delay:delay||0,easing:'cubic-bezier(.2,.85,.25,1)',fill:'backwards'});_wxUiJobs.add(a);const finish=()=>{_wxUiJobs.delete(a);if(done)done();};a.onfinish=finish;a.oncancel=finish;return a;}catch(_){if(done)done();return null;}
}
function wxUiRelease(){if(_wxUiPress&&_wxUiPress.el)_wxUiPress.el.removeAttribute('data-wx-ui-pressed');_wxUiPress=null;}
function wxUiClear(){wxRoleEntryClear();wxUiRelease();_shellSwitchPending=null;document.querySelectorAll('[data-shell-switch]').forEach(el=>el.removeAttribute('data-shell-switch'));if(typeof wxCallUiClear==='function')wxCallUiClear();_wxUiMovingPanels.forEach(panel=>{panel.removeAttribute('data-wx-ui-closing');panel._wxUiMotion=null;});_wxUiMovingPanels.clear();_wxUiJobs.forEach(a=>{try{a.cancel();}catch(_){}});_wxUiJobs.clear();if(_wxUiBloom){_wxUiBloom.remove();_wxUiBloom=null;}}
function wxUiTarget(target){
  if(!target||!target.closest)return null;
  const c=cur(),page=document.querySelector('#app>.page');
  const floating='#modal.show,#cfm.show,#callLayer.show,.nr-root,.nr-overlay,.tn-dfull-ov,.tn-pack-ov,.tg-ov,.pc-reveal,.photo-meta-overlay';
  if(c.p==='home'&&!target.closest(floating)||shellMotionProfile(c,page)==='protected')return null;
  if(target.closest('.dyme-tabs,.dyus-tabs'))return null;
  if(target.closest('input,textarea,select,[contenteditable="true"],canvas,video,iframe'))return null;
  if(!target.closest('#app>.shell-ui-scope,#app>.wx-ui-scope,'+floating))return null;
  const el=target.closest('button,[role="button"],a[href],[onclick]');
  if(!el||el.disabled||el.getAttribute('aria-disabled')==='true'||el.closest('[disabled],[inert],.shell-motion-ghost'))return null;
  if(el.matches('label,input,textarea,select')||el.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"]'))return null;
  if(el.matches('[onpointerdown],[ontouchstart],[onmousedown]')&&!el.hasAttribute('onclick'))return null;
  const r=el.getBoundingClientRect(),host=page&&page.getBoundingClientRect();
  if(!el.matches('button,[role="button"],.sw')&&host&&r.width*r.height>host.width*host.height*.55)return null;
  return el;
}
function wxUiPressStart(e){
  wxUiRelease();if(!shellMotionAllowed()||e.isPrimary===false||e.button>0||e.touches&&e.touches.length!==1)return;
  const bloom=_wxUiBloom;if(bloom){_wxUiBloom=null;if(typeof bloom.getAnimations==='function')bloom.getAnimations().forEach(a=>a.cancel());bloom.remove();}
  const el=wxUiTarget(e.target);if(!el)return;const point=e.touches?e.touches[0]:e;
  _wxUiPress={el:el,x:point.clientX,y:point.clientY,id:e.pointerId,owner:S,account:actId(),at:Date.now()};el.setAttribute('data-wx-ui-pressed','true');
}
function wxUiPressMove(e){const p=_wxUiPress;if(!p)return;const point=e.touches?e.touches[0]:e;if(e.pointerId!=null&&p.id!=null&&e.pointerId!==p.id)return;if(Math.hypot(point.clientX-p.x,point.clientY-p.y)>9)wxUiRelease();}
function wxUiBloom(el,x,y){
  if(!shellMotionAllowed())return;
  if(_wxUiBloom)_wxUiBloom.remove();const r=el.getBoundingClientRect(),size=Math.min(92,Math.max(32,Math.min(r.width,r.height)*1.6));
  const node=document.createElement('i');node.className='wx-ui-touch-bloom';node.setAttribute('aria-hidden','true');
  node.style.cssText='--shell-touch-rgb:'+(wxInteractionPage(cur())?'7,193,96':cur().p==='settings'?'90,160,255':'154,170,224')+';opacity:0;left:'+(Math.max(r.left,Math.min(r.right,x))-size/2)+'px;top:'+(Math.max(r.top,Math.min(r.bottom,y))-size/2)+'px;width:'+size+'px;height:'+size+'px;';document.body.appendChild(node);_wxUiBloom=node;
  wxUiAnimate(node,[{opacity:.55,transform:'scale(.35)'},{opacity:0,transform:'scale(1.12)'}],360,0,()=>{node.remove();if(_wxUiBloom===node)_wxUiBloom=null;});
}
function wxUiPressEnd(e){
  const p=_wxUiPress;if(!p||e.pointerId!=null&&p.id!=null&&e.pointerId!==p.id)return;wxUiRelease();
  if(!p.el.isConnected||p.owner!==S||p.account!==actId()||Date.now()-p.at>650||!shellMotionAllowed())return;
  wxUiBloom(p.el,p.x,p.y);const icon=p.el.querySelector('.wx-tab-icon,.chat-composer-icon svg,.wx-steps-icon')||p.el.querySelector('svg');
  if(icon&&!p.el.matches('.wx-main-add,.tb'))wxUiAnimate(icon,[{scale:'.88'},{scale:'1.06',offset:.58},{scale:'1'}],280);
}
function wxInteractionStyle(){
  if(_wxUiReady)return;_wxUiReady=true;const style=document.createElement('style');style.id='wechatInteractionStudioStyle';
  style.textContent=`
    .wx-ui-touch-bloom{position:fixed;z-index:20050;border-radius:50%;pointer-events:none!important;user-select:none;background:radial-gradient(circle,rgba(var(--shell-touch-rgb,7,193,96),.3),rgba(var(--shell-touch-rgb,7,193,96),.1) 48%,transparent 72%)}
    @media(prefers-reduced-motion:no-preference){
      #app>.shell-ui-scope button:not(:disabled),#app>.shell-ui-scope [role="button"],#app>.shell-ui-scope [onclick],body[data-shell-control-scope] #modal.show button,body[data-shell-control-scope] #modal.show .sw,body[data-shell-control-scope] #cfm.show button{transition:scale 190ms cubic-bezier(.2,.85,.25,1)}
      #app>.shell-ui-scope [data-wx-ui-pressed],body[data-shell-control-scope] #modal.show [data-wx-ui-pressed],body[data-shell-control-scope] #cfm.show [data-wx-ui-pressed],#callLayer.show [data-wx-ui-pressed]{scale:.955}
      #app>.shell-ui-scope .sw[data-wx-ui-pressed]{scale:.9}
      body[data-shell-control-scope] [data-wx-ui-pressed]{scale:.955}
      #app>.shell-ui-scope .sw[data-shell-switch="on"]::after{animation:shellSwitchOn 300ms cubic-bezier(.2,.85,.25,1)}
      #app>.shell-ui-scope .sw[data-shell-switch="off"]::after{animation:shellSwitchOff 300ms cubic-bezier(.2,.85,.25,1)}
      @keyframes shellSwitchOn{from{transform:translateX(-19px)}to{transform:translateX(0)}}
      @keyframes shellSwitchOff{from{transform:translateX(19px)}to{transform:translateX(0)}}
    }
    #app>[data-wx-role-entry]{z-index:9}
    .wx-ui-tab-glide{position:absolute;top:3px;bottom:11px;width:calc(25% - 22px);border-radius:17px;background:linear-gradient(160deg,rgba(7,193,96,.13),rgba(7,193,96,.025));border:1px solid rgba(7,193,96,.11);box-sizing:border-box;pointer-events:none;z-index:0}
    .wx-ui-scope.wxlight .wx-ui-tab-glide{background:linear-gradient(160deg,rgba(7,193,96,.085),rgba(7,193,96,.015));border-color:rgba(7,193,96,.085)}
    #app>.wx-ui-scope .wx-main-tabbar{position:relative;isolation:isolate}
    #app>.wx-ui-scope .wx-main-tabbar>.tb{z-index:1}
    @media(prefers-reduced-motion:no-preference){
      #app>.wx-ui-scope button:not(:disabled),#app>.wx-ui-scope .nav .l,#app>.wx-ui-scope .nav .r,#app>.wx-ui-scope .row[onclick],#app>.wx-ui-scope .it[onclick],body[data-wechat-switches] #modal button,body[data-wechat-switches] #cfm button{transition:scale 190ms cubic-bezier(.2,.85,.25,1)}
      #app>.wx-ui-scope button:not(:disabled):active,#app>.wx-ui-scope [data-wx-ui-pressed],body[data-wechat-switches] #modal button:active{scale:.955}
      #app>.wx-ui-scope .wx-conversation-front>.row:active{scale:.985}
      .wx-ui-scope .wx-tab-icon{transition:color 200ms ease}
      .wx-ui-scope .wx-main-add>svg{transition:transform 250ms cubic-bezier(.2,.85,.25,1)}
      .wx-ui-scope .wx-main-add[aria-expanded="true"]>svg{transform:rotate(45deg)}
      .wx-ui-scope .chat-function-toggle>span{transform:rotate(0deg)}
      .wx-ui-scope .chat-function-toggle[aria-expanded="true"]>span{transform:rotate(45deg)}
    }
    .wx-ui-scope .chat-tools-panel[data-wx-ui-closing]{display:block!important;pointer-events:none}
    @media(prefers-reduced-motion:no-preference){
      #callLayer>.cav[data-wx-call-waiting]{animation:wxCallWaitingRing 1500ms ease-out 2}
      #callLayer .callbtns .cbtn{transition:scale 180ms cubic-bezier(.2,.85,.25,1)}
      #callLayer .callbtns .cbtn:active{scale:.88}
      @keyframes wxCallWaitingRing{0%{box-shadow:0 0 0 0 rgba(164,210,186,.05)}24%{box-shadow:0 0 0 9px rgba(164,210,186,.25)}100%{box-shadow:0 0 0 25px rgba(164,210,186,0)}}
    }
    #app>.wx-ui-scope button:focus-visible{outline:2px solid #07c160;outline-offset:3px}
  `;document.head.appendChild(style);
  const passive={capture:true,passive:true};
  if(typeof PointerEvent!=='undefined'){document.addEventListener('pointerdown',wxUiPressStart,passive);document.addEventListener('pointermove',wxUiPressMove,passive);document.addEventListener('pointerup',wxUiPressEnd,passive);document.addEventListener('pointercancel',wxUiRelease,passive);}
  else{document.addEventListener('touchstart',wxUiPressStart,passive);document.addEventListener('touchmove',wxUiPressMove,passive);document.addEventListener('touchend',wxUiPressEnd,passive);document.addEventListener('touchcancel',wxUiRelease,passive);}
  document.addEventListener('scroll',wxUiRelease,passive);window.addEventListener('blur',wxUiClear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)wxUiClear();});
  if(typeof matchMedia==='function'){const pref=matchMedia('(prefers-reduced-motion: reduce)');if(pref.addEventListener)pref.addEventListener('change',()=>{if(pref.matches)wxUiClear();});}
  document.addEventListener('click',e=>{if(!shellMotionAllowed())return;const el=wxUiTarget(e.target);if(!el)return;shellControlClick(el);if(e.detail!==0)return;const r=el.getBoundingClientRect();wxUiBloom(el,r.left+r.width/2,r.top+r.height/2);},passive);
}
