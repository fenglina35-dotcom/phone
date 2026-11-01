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
    c.tasks={date:todayStr(),assignTs:Date.now(),list,rewarded:false,penalized:false};taskPunishFlush(c);c.taskAuto={date:todayStr(),attempts:0,nextAt:0,lastErrorAt:0};taskDailyJournalWrite(c);save();_taskBusy=false;render();if(!automatic||cur().p==='tasks'){if(typeof taskToast==='function')taskToast('今天的任务来咯');else toast('任务来咯📋');}
//@@ private
    c.tasks={date:todayStr(),assignTs:Date.now(),list,rewarded:false,penalized:false};taskPunishFlush(c);c.taskAuto={date:todayStr(),attempts:0,nextAt:0,lastErrorAt:0};save();_taskBusy=false;render();if(!automatic||cur().p==='tasks'){if(typeof taskToast==='function')taskToast('今天的任务来咯');else toast('任务来咯📋');}
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
function renderWeChat(){
  if(S.wxLogin){if(!wxLoginActive())setTimeout(wxLogout,0);else{if(!_wxLoginTimer)wxLoginStartTimer();return wxLockedScreen();}}
  let body='';
  if(wxTab==='chats')body=wxChats();
  else if(wxTab==='contacts')body=wxContacts();
  else if(wxTab==='moments')body=wxDiscover();
  else if(wxTab==='me')body=wxMe();
  const titles={chats:'微信',contacts:'通讯录',moments:'发现',me:'我'};
  const showAdd=wxTab==='chats'||wxTab==='contacts';
  if(wxTab!=='chats')_wxQuickOpen=false;
  const previewStatus=NORTH_PREVIEW?`<div class="wx-preview-status"><span><b>${hm()}</b>${wxPawIcon()}</span><span class="wx-preview-radio"><i></i><i></i><i></i><i></i>${wxWifiIcon()}<em>17</em></span></div>`:'';
  const addIcon=wxTab==='contacts'?wxContactAddIcon():wxPlusIcon();
  return `${previewStatus}<div class="nav wx-main-nav"><button class="l wx-main-exit" type="button" onclick="home()" aria-label="返回主屏"></button><span class="t wx-main-title"><b>${titles[wxTab]}</b></span><button class="r wx-main-add" type="button" onclick="${wxTab==='chats'?'toggleWxQuickMenu()':wxTab==='contacts'?'editContact()':''}" aria-label="${showAdd?'添加':''}">${showAdd?addIcon:''}</button></div>
    ${wxTab==='chats'&&_wxQuickOpen?wxQuickMenuHTML():''}
    ${wxTab==='contacts'?wxContactSearchHTML():''}
    <div class="scroll wx-main-scroll">${body}</div>
    ${wxTab==='contacts'?wxAlphabetRail():''}
    <div class="tabbar wx-main-tabbar">
      ${tb('chats',wxTabIcon('chats'),'微信')}${tb('contacts',wxTabIcon('contacts'),'通讯录')}${tb('moments',wxTabIcon('moments'),'发现')}${tb('me',wxTabIcon('me'),'我')}
    </div>`;
}
function wxPlusIcon(){return `<svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="14.5"/><line x1="17" y1="9.5" x2="17" y2="24.5"/><line x1="9.5" y1="17" x2="24.5" y2="17"/></svg>`;}
function wxContactAddIcon(){return `<svg class="wx-contact-add-icon" viewBox="0 0 34 34" aria-hidden="true"><circle cx="13" cy="10.2" r="4.7"/><path d="M4.7 27c.6-6.3 3.4-9.5 8.3-9.5s7.7 3.2 8.3 9.5"/><path d="M25.5 11.5v9M21 16h9"/></svg>`;}
function wxQuickMenuIcon(kind){if(kind==='scan')return `<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M5 14V6h8M23 6h8v8M31 22v8h-8M13 30H5v-8M9 18h18" fill="none"/></svg>`;return kind==='group'?`<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 5C10 5 4 10 4 16.3c0 3.7 2.1 6.9 5.5 9l-1.2 5 5.1-2.8c1.5.4 3 .6 4.6.6 8 0 14-5 14-11.8S26 5 18 5Z"/></svg>`:`<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="13" cy="10.5" r="5"/><path d="M3.5 29c.8-7.2 4.1-10.8 9.5-10.8s8.7 3.6 9.5 10.8H3.5Z"/><path d="M28 16.5v11M22.5 22h11" fill="none"/></svg>`;}
function wxQuickMenuHTML(){return `<div class="wx-quick-shade" onclick="_wxQuickOpen=false;render()"></div><div class="wx-quick-menu" role="menu"><button type="button" onclick="_wxQuickOpen=false;createGroup()">${wxQuickMenuIcon('group')}<span>发起群聊</span></button><button type="button" onclick="_wxQuickOpen=false;editContact()">${wxQuickMenuIcon('friend')}<span>添加朋友</span></button><button type="button" onclick="_wxQuickOpen=false;go('wxscan')">${wxQuickMenuIcon('scan')}<span>扫一扫</span></button></div>`;}
function toggleWxQuickMenu(){_wxQuickOpen=!_wxQuickOpen;render();}
function wxContactAddMenu(){openModal(`<h3>添加联系人</h3><button class="btn p" onclick="closeModal();editContact()">添加角色</button><button class="btn g" style="margin-top:8px" onclick="closeModal();openPhoneFriends()">添加小手机好友</button><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function wxPawIcon(){return `<svg class="wx-paw" viewBox="0 0 26 24" aria-hidden="true"><ellipse cx="13" cy="16" rx="6.5" ry="5.7"/><ellipse cx="5" cy="10" rx="3" ry="4"/><ellipse cx="10" cy="5.5" rx="2.8" ry="4"/><ellipse cx="16.2" cy="5.3" rx="2.8" ry="4"/><ellipse cx="21.4" cy="10.2" rx="3" ry="4"/></svg>`;}
function wxWifiIcon(){return `<svg class="wx-wifi" viewBox="0 0 26 20" aria-hidden="true"><path d="M2 6.8C8.6.8 17.4.8 24 6.8M6 11.2c4.1-3.5 9.9-3.5 14 0M10.2 15.2c1.7-1.4 3.9-1.4 5.6 0"/><circle cx="13" cy="18" r="1.2"/></svg>`;}
function wxMonitorIcon(){return `<svg viewBox="0 0 28 24" aria-hidden="true"><rect x="3" y="3" width="22" height="15" rx="1.5"/><path d="M10 22h8M14 18v4"/></svg>`;}
function wxTabIcon(k){const icons={
  chats:`<path class="wx-tab-outline" d="M16 4.9C8.6 4.9 3.1 9 3.1 14.4c0 3.1 1.7 5.9 4.7 7.7l-1.4 5.2 5.3-3c1.4.4 2.8.6 4.3.6 7.4 0 12.9-4.2 12.9-10.5S23.4 4.9 16 4.9Z"/><path class="wx-tab-solid" d="M16 3.9C8 3.9 2 8.4 2 14.4c0 3.4 1.8 6.4 5 8.4l-1.6 6 6.2-3.5c1.4.4 2.9.6 4.4.6 8 0 14-4.6 14-11.5S24 3.9 16 3.9Z"/>`,
  contacts:`<path class="wx-tab-outline" d="M14.5 4.3c3.3 0 5.3 2.6 5.3 6.1 0 4-2.2 7-5.3 7s-5.3-3-5.3-7c0-3.5 2-6.1 5.3-6.1ZM4.4 28c.9-5.3 4.4-8.2 10.1-8.2s9.2 2.9 10.1 8.2H4.4Zm20.5-14.6h5.6m-5.6 4.3h5.6m-5.6 4.3h5.6"/><path class="wx-tab-solid" d="M14.5 3.2c3.8 0 6.1 2.9 6.1 6.9 0 4.4-2.5 7.6-6.1 7.6s-6.1-3.2-6.1-7.6c0-4 2.3-6.9 6.1-6.9ZM2.9 29c.8-6 5-9.4 11.6-9.4S25.3 23 26.1 29H2.9Zm23-16.9h5.7v2.8h-5.7v-2.8Zm0 5h5.7v2.8h-5.7v-2.8Zm0 5h5.7v2.8h-5.7v-2.8Z"/>`,
  moments:`<circle class="wx-tab-outline" cx="16" cy="16" r="12.5"/><path class="wx-tab-outline" d="m10.6 21.2 3-7.7 7.8-3-3 7.8-7.8 2.9Z"/><circle class="wx-tab-solid" cx="16" cy="16" r="14"/><path class="wx-tab-solid-cut" d="m10.2 21.8 3.3-8.3 8.3-3.3-3.3 8.3-8.3 3.3Z"/>`,
  me:`<path class="wx-tab-outline" d="M16 4.4c3.2 0 5.1 2.6 5.1 6.1 0 3.9-2 6.8-5.1 6.8s-5.1-2.9-5.1-6.8c0-3.5 1.9-6.1 5.1-6.1ZM5.2 28.1c.9-5.5 4.7-8.6 10.8-8.6s9.9 3.1 10.8 8.6H5.2Z"/><path class="wx-tab-solid" d="M16 3.4c3.8 0 6.1 3 6.1 7 0 4.5-2.4 7.7-6.1 7.7s-6.1-3.2-6.1-7.7c0-4 2.3-7 6.1-7ZM3.7 29.3c.9-6.3 5.3-9.9 12.3-9.9s11.4 3.6 12.3 9.9H3.7Z"/>`};return `<svg class="wx-tab-icon wx-tab-${k}" viewBox="0 0 32 32" aria-hidden="true">${icons[k]}</svg>`;}
function tb(k,i,t){return `<button type="button" class="tb ${wxTab===k?'on':''}" onclick="_wxQuickOpen=false;wxTab='${k}';render()" aria-label="${t}"><div class="i">${i}${k==='chats'?wxUnreadBadge(wxUnreadTotal()):k==='moments'&&wxMomentUnread()?wxUnreadBadge(0,true):''}</div><span>${t}</span></button>`;}
function wxDiscoverIcon(kind){const icons={
  moments:'<path d="M16 4.5 19.4 11.6 15.5 12.8Z" stroke="#f2c94c"/><path d="M23.8 8.2 20.4 15.4 17.2 13Z" stroke="#f2994a"/><path d="M27.5 16 20.4 19.4 19.2 15.5Z" stroke="#eb5757"/><path d="M23.8 23.8 16.6 20.4 19 17.2Z" stroke="#bb6bd9"/><path d="M16 27.5 12.6 20.4 16.5 19.2Z" stroke="#2f80ed"/><path d="M8.2 23.8 11.6 16.6 14.8 19Z" stroke="#2d9cdb"/><path d="M4.5 16 11.6 12.6 12.8 16.5Z" stroke="#27ae60"/><path d="M8.2 8.2 15.4 11.6 13 14.8Z" stroke="#6fcf97"/>',
  channels:'<path d="M7 9.2c3.7-4.7 8.1-3.7 9 1.5.9-5.2 5.3-6.2 9-1.5 3.2 4.1 1.5 11.5-9 17-10.5-5.5-12.2-12.9-9-17Z"/>',
  live:'<circle cx="16" cy="16" r="10.5"/><circle cx="16" cy="16" r="4.5"/>',
  music:'<path d="M11.5 8.8v13.4M11.5 9l11-2.2v12.8M11.5 14.2l11-2.2"/><ellipse cx="8.3" cy="22.4" rx="3.5" ry="2.7" transform="rotate(-18 8.3 22.4)"/><ellipse cx="19.3" cy="19.8" rx="3.5" ry="2.7" transform="rotate(-18 19.3 19.8)"/>',
  cinema:'<path d="m16 5 3.1 5.9 6.6.8-4.8 4.7 1.2 6.6-6.1-3.1L9.9 23l1.2-6.6-4.8-4.7 6.6-.8L16 5Z"/>',
  search:'<circle cx="14" cy="14" r="7.5"/><path d="m19.6 19.6 6.4 6.4"/>',
  nearby:'<circle cx="16" cy="16" r="3.3"/><path d="M9.2 22.8a9.6 9.6 0 0 1 0-13.6M22.8 9.2a9.6 9.6 0 0 1 0 13.6M5 26.8a15.2 15.2 0 0 1 0-21.6M27 5.2a15.2 15.2 0 0 1 0 21.6"/>',
  games:'<path d="m10.5 5.5 5.5 5-5.5 5-5.5-5Z" stroke="#2f80ed"/><path d="m21.5 5.5 5.5 5-5.5 5-5.5-5Z" stroke="#27ae60"/><path d="m10.5 16.5 5.5 5-5.5 5-5.5-5Z" stroke="#eb5757"/><path d="m21.5 16.5 5.5 5-5.5 5-5.5-5Z" stroke="#9b51e0"/>'};return `<svg viewBox="0 0 32 32" aria-hidden="true">${icons[kind]||icons.moments}</svg>`;}
function wxDiscoverRow(kind,label,action,lockKey,sub){const locked=!!(lockKey&&appLocked(lockKey));return `<button type="button" class="wx-discover-row tone-${kind}${locked?' locked':''}" ${locked?'disabled':''} onclick="${locked?'':action}"><i>${wxDiscoverIcon(kind)}</i><span>${esc(label)}${kind==='moments'&&wxMomentUnread()?wxUnreadBadge(0,true):''}${sub?`<small>${esc(sub)}</small>`:''}</span><em>${locked?`<b>${svgIc('lock',14,'currentColor')}</b><small>已锁定</small>`:'›'}</em></button>`;}
function wxDiscover(){return `<div class="wx-discover-list">
  <section>${wxDiscoverRow('moments','朋友圈',"wxDiscoverOpen('moments')",'moments')}</section>
  <section>${wxDiscoverRow('channels','视频号',"wxDiscoverOpen('channels')",'douyin')}</section>
  <section>${wxDiscoverRow('music','听一听',"wxDiscoverOpen('music')",'music')}</section>
  <section>${wxDiscoverRow('cinema','看一看',"wxDiscoverOpen('cinema')",'cinema')}${wxDiscoverRow('search','搜一搜',"wxDiscoverOpen('browser')",'browser')}</section>
  <section>${wxDiscoverRow('nearby','附近的人',"wxDiscoverOpen('nearby')",'nearby', '发现匿名新朋友')}</section>
  <section>${wxDiscoverRow('games','游戏',"wxDiscoverOpen('games')",'games')}</section>
  </div>`;}
function wxDiscoverOpen(kind){if(kind==='nearby'){openApp('nearby');return;}if(kind==='channels'){if(appLocked('douyin'))return;_dyFromWx=true;if(dyInit())save(0);dyTab='feed';go('dy',{from:'wechat'});if(!S.dy.feed.length)dyGenFeed('',true);return;}const map={moments:'moments',music:'music',cinema:'cinema',browser:'browser',games:'games'};if(map[kind]){window._wxReturnToDiscover=true;openApp(map[kind]);}}
function renderWxLive(){return `<div class="wx-directory-head">${wxDirectoryNav('直播')}</div><div class="scroll wx-directory-scroll wx-live-coming"><div class="wx-live-orbit"><i>${wxDiscoverIcon('live')}</i></div><b>直播功能开发中</b><p>入口已经保留，后续会在这里接入真实直播内容。</p><button type="button" onclick="back()">返回发现</button></div>`;}
function renderWxMomentFeed(){return `<div class="wx-directory-head">${wxDirectoryNav('朋友圈',`<button type="button" class="r wx-dir-plus" onclick="momentTools()">＋</button>`)}</div><div class="scroll wx-directory-scroll wx-moment-feed" id="wxMomentScroll">${wxMoments()}</div>`;}

let _wxNearbyBusy=false;
const WX_NEARBY_FALLBACK=['雾岛来信','晚风未眠','十七码头','雨停之后','匿名旅人','旧唱片','凌晨两点','半糖气泡','海盐日落','北岸微光','纸飞机','沿途看海','只问不答','复制广告','边界试探','话痨路人'];
function wxNearbyState(){if(!S.wxNearby||typeof S.wxNearby!=='object')S.wxNearby={people:[],requests:[]};const d=S.wxNearby;d.people=Array.isArray(d.people)?d.people.filter(Boolean):[];d.requests=Array.isArray(d.requests)?d.requests.filter(Boolean):[];d.refreshSeq=Math.max(0,Number(d.refreshSeq)||0);return d;}
function wxNearbyFallbackPeople(seed){const seq=Math.max(0,Number(seed)||0),salt=Math.floor(Date.now()/60000)+seq*7,types=[
  ['友善健谈','刚搬来这附近，想找人聊聊吃喝和日常。','热情但尊重边界，会主动找话题，也会认真听对方说话。','你好，刚刚看到你在附近，方便认识一下吗？'],
  ['安静慢热','不公开照片，熟悉以后再慢慢认识。','慢热谨慎，不轻易交心，熟悉后回复认真。','你好，我不太会开场，先打个招呼。'],
  ['直接爽快','不喜欢猜来猜去，有话就直说。','说话直接、节奏快，有好感会表达，不合适也会明确说。','嗨，看你顺眼，想聊两句。'],
  ['古怪跳脱','脑回路有点怪，但没有恶意。','思维跳跃、冷幽默、偶尔答非所问，但不编造共同经历。','你相信附近的人会随机遇到有趣的人吗？'],
  ['功利社交','只聊资源和机会，没兴趣就很冷淡。','功利、现实，会先打听职业和资源；发现没有利用价值会敷衍。','你做什么工作的？也许能互相帮忙。'],
  ['广告推销','加好友只是为了推销课程和产品。','把聊天当获客渠道，会反复推销并回避私人话题；被明确拒绝后应停止。','附近新店体验券要不要了解一下？'],
  ['越界搭讪','很会搭讪，也经常试探别人底线。','轻浮、自来熟、容易说冒犯话；可以表现为令人厌烦的骚扰者，但不得威胁、仇恨或违法。被拉黑后不能绕过系统继续联系。','美女/帅哥，一个人在附近吗？'],
  ['纯骚扰','没有认真认识的打算，只想连续发无聊消息找存在感。','烦人、重复、缺乏边界，会连续搭讪和催回复；不得威胁人身安全、泄露隐私或使用仇恨内容。','在吗？怎么不回？认识一下呗。']
],start=Math.abs(salt)%types.length;return Array.from({length:12},(_,i)=>{const name=WX_NEARBY_FALLBACK[(i+salt)%WX_NEARBY_FALLBACK.length],t=types[(start+i)%types.length];return{id:'near_'+salt+'_'+seq+'_'+i,nickname:name,signature:t[1],distance:(120+(i*173+salt+seq*43)%4800)+'m',gender:(i+seq)%3===0?'女':(i+seq)%3===1?'男':'保密',persona:'你是微信附近的人里出现的匿名用户「'+name+'」，类型是「'+t[0]+'」。'+t[2]+'你和对方此前没有共同经历，关系必须从陌生人开始。',greeting:t[3]};});}
function wxNearbyFingerprint(rows){return (rows||[]).map(x=>[x&&x.nickname,x&&x.gender,x&&x.distance,x&&x.signature].join('|')).join('||');}
function wxNearbyNormalize(x,i){x=x&&typeof x==='object'?x:{};const base=WX_NEARBY_FALLBACK[i%WX_NEARBY_FALLBACK.length];return{id:'near_'+uid(),nickname:String(x.nickname||base).trim().slice(0,16)||base,signature:String(x.signature||'想认识一个聊得来的人。').trim().slice(0,54),distance:String(x.distance||((i+1)*260+'m')).trim().slice(0,12),gender:['男','女','保密'].includes(x.gender)?x.gender:'保密',persona:String(x.persona||'你是一个通过微信附近的人认识的普通匿名网友，慢热、真实、尊重边界。').trim().slice(0,500),greeting:String(x.greeting||'你好，刚刚在附近的人看到你，想认识一下。').trim().slice(0,80)};}
function wxNearbyAvatar(){return `<span class="wx-nearby-avatar"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="15" r="8"/><path d="M8 39c1-10 6-14 14-14s13 4 14 14"/></svg></span>`;}
function wxNearbyRequest(personId){return wxNearbyState().requests.slice().reverse().find(x=>x&&x.personId===personId)||null;}
function wxNearbyCard(p){const req=wxNearbyRequest(p.id),pending=req&&req.status==='pending',accepted=req&&req.status==='accepted',click=accepted&&req.contactId?`wxNearbyOpen('${req.id}')`:`wxNearbyAdd('${p.id}')`;return `<article class="wx-nearby-card${pending?' pending':accepted?' accepted':''}">${wxNearbyAvatar()}<div class="wx-nearby-copy"><b>${esc(p.nickname)}</b><span>${esc(p.gender)} · ${esc(p.distance)}</span><p>${esc(p.signature)}</p></div><button type="button" ${pending?'disabled':''} onclick="${click}">${pending?'等待通过':accepted?'发消息':'添加'}</button></article>`;}
function wxNearbyBlocked(){if(!appLocked('nearby'))return false;toast('「附近的人」已被ta锁定，去情侣空间求ta解开');return true;}
function renderWxNearby(){if(appLocked('nearby'))return `<div class="wx-directory-head">${wxDirectoryNav('附近的人','')}</div><div class="empty">附近的人已被锁定，请去情侣空间求ta解开</div>`;wxNearbySweep(true);const d=wxNearbyState();if(!d.people.length){d.people=wxNearbyFallbackPeople(d.refreshSeq);save(500);}return `<div class="wx-directory-head">${wxDirectoryNav('附近的人',`<button type="button" class="r wx-dir-text" onclick="wxNearbyRefresh()" ${_wxNearbyBusy?'disabled':''}>${_wxNearbyBusy?'刷新中':'刷新'}</button>`)}</div><div class="scroll wx-directory-scroll wx-nearby-page" id="wxNearbyScroll"><div class="wx-nearby-hero"><i>${wxDiscoverIcon('nearby')}</i><span><b>附近的新朋友</b><small>匿名资料 · 添加后约 10 秒自动通过</small></span></div><div class="wx-nearby-list">${d.people.map(wxNearbyCard).join('')}</div><p class="wx-nearby-foot">不会展示真实照片和精确位置。成为好友后会出现在微信通讯录中。</p></div>`;}
async function wxNearbyRefresh(){if(wxNearbyBlocked()||_wxNearbyBusy)return;const d=wxNearbyState(),before=wxNearbyFingerprint(d.people),seq=++d.refreshSeq;_wxNearbyBusy=true;render();let people=[];try{const arr=await aiGen([{role:'system',content:'你是微信“附近的人”匿名资料生成器。生成12个彼此不同、像真实普通网友的匿名资料：必须混合友善、慢热、直率、古怪、功利、推销、边界感差和纯骚扰等类型，不能全部温柔友好。骚扰型可以烦人、重复搭讪、催回复或试探边界，但不得出现人身威胁、仇恨、违法、精确定位或隐私泄露。不给真实姓名、电话、住址、公司，不要明星和现有角色。只输出JSON数组：[{"nickname":"匿名昵称","gender":"男/女/保密","distance":"120m到5km","signature":"一句自然个签","persona":"成为好友后会持续保持的性格、动机、说话方式和边界表现，不编共同经历","greeting":"通过好友后的第一句"}]'},{role:'user',content:'换一批附近的匿名用户。好坏混合、来意混合、性格明显不同，避免模板化。刷新批次：'+seq}],{max:2200,aux:true},parseArr);people=(arr||[]).slice(0,12).map(wxNearbyNormalize);}catch(_){}if(people.length<8||wxNearbyFingerprint(people)===before)people=wxNearbyFallbackPeople(seq);d.people=people;_wxNearbyBusy=false;save();if(cur().p==='wxnearby')render();toast('已换一批不同性格的附近的人');}
function wxNearbyAdd(id){if(wxNearbyBlocked())return;const d=wxNearbyState(),p=d.people.find(x=>x.id===id);if(!p||wxNearbyRequest(id))return;const req={id:'wnr_'+uid(),personId:id,person:Object.assign({},p),status:'pending',time:Date.now(),acceptAt:Date.now()+10000,contactId:''};d.requests.push(req);save();render();toast('好友申请已发送，等待对方通过');setTimeout(()=>wxNearbySweep(false),10050);}
function initialFriendInnerThought(c,opt){if(!c||String(c.innerThought||'').trim())return false;opt=opt||{};const readd=!!opt.readd,nearby=String(opt.kind||c.friendOrigin&&c.friendOrigin.kind||'')==='nearby';c.innerThought=readd?'终于重新加回好友，心里还有些话想慢慢说清楚。':nearby?'刚通过好友，想先认真认识你。':'刚正式加上好友，对接下来的相处有点期待。';c.innerThoughtAt=+opt.at||Date.now();return true;}
function wxNearbyContact(req){if(req.contactId){const old=getC(req.contactId);if(old)return old;}const old=(S.contacts||[]).find(c=>c&&c.friendOrigin&&c.friendOrigin.nearbyRequestId===req.id);if(old)return old;const p=req.person||{},now=Date.now(),c={id:cid(),name:String(p.nickname||'附近的人').slice(0,20),avatar:'👤',remark:'',wxid:genWxid(),signature:String(p.signature||'').slice(0,60),persona:String(p.persona||'你是通过微信附近的人认识的普通网友，真实、慢热、尊重边界。').slice(0,800),greeting:String(p.greeting||'你好，刚刚通过了你的好友申请。').slice(0,80),relation:'附近认识的朋友',gender:['男','女'].includes(p.gender)?p.gender:'',star:false,pinned:false,blocked:false,proactive:{enabled:false,start:9,end:23,times:2},chatBg:'',createdAt:now,deleted:false,_friendPending:false,_friendAcceptedAt:now};c.friendOrigin={kind:'nearby',source:'附近的人',intent:'从陌生人开始认识',requestMsg:'我想添加你为朋友',acceptedAt:now,everAdded:true,nearbyRequestId:req.id};initialFriendInnerThought(c,{kind:'nearby',at:now});S.contacts.push(c);msgs(c.id).push({role:'user',type:'sys',content:'对方通过了你从「附近的人」发出的好友申请',time:now,id:uid()});return c;}
function wxNearbySweep(silent){const d=wxNearbyState(),now=Date.now(),due=d.requests.filter(x=>x&&x.status==='pending'&&(+x.acceptAt||0)<=now);if(!due.length)return false;const accepted=[];due.forEach(req=>{const c=wxNearbyContact(req);req.status='accepted';req.acceptedAt=now;req.contactId=c.id;accepted.push(c);});save();if(!silent&&cur().p==='wxnearby')render();if(!silent){if(S.settings.sound)playDing();toast(accepted.length>1?accepted.length+' 位附近好友已通过申请':(accepted[0].remark||accepted[0].name)+' 已通过好友申请');}accepted.forEach(c=>setTimeout(()=>scheduleReply(c.id,'[系统：你刚刚通过了'+S.me.name+'从微信“附近的人”发来的好友申请。你们此前没有共同经历，从普通陌生人开始；按你的人设发一条自然、克制、能继续认识的第一句微信，不要说系统或AI，不要动作描写。]'),650));return true;}
function wxNearbyOpen(rid){if(wxNearbyBlocked())return;const req=wxNearbyState().requests.find(x=>x.id===rid);if(req&&req.contactId)openChat(req.contactId);}
//@@ web
/* ===== 搜索聊天记录：按聊天分组的结果页（微信样式），点进去跳到那条消息所在的位置 ===== */
//@@ private
/* PRIVATE_WEB_PARITY_V1769: audited shared search, translation, group limits, summary and role-WeChat repeat fixes. */
//@@ end
function openWxSearch(){go('wxsearch');setTimeout(()=>{const i=$('#wxs_in');if(i)i.focus();},80);}
function openChatSearch(id){go('wxsearch',{id});setTimeout(()=>{const i=$('#wxs_in');if(i)i.focus();},80);}
function wxSearchPage(){const page=cur();return page&&page.p==='wxsearch'?page:{};}
function wxSearchWhen(ms){if(!ms)return'';const d=new Date(ms),now=new Date(),day=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(),gap=Math.round((day(now)-day(d))/86400000);if(gap<=0)return hm(ms);if(gap<7)return'星期'+'日一二三四五六'[d.getDay()];return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}
function wxHi(t,q){t=String(t||'').replace(/\s+/g,' ');const lt=t.toLowerCase();const i=lt.indexOf(q);if(i<0)return esc(t.slice(0,42))+(t.length>42?'…':'');const s=i>14?i-10:0;return (s>0?'…':'')+esc(t.slice(s,i))+'<b>'+esc(t.slice(i,i+q.length))+'</b>'+esc(t.slice(i+q.length,i+q.length+40))+(t.length>i+q.length+40?'…':'');}
function wxSearchMsgText(m){if(!m||m.type==='sys'||m._call||m._silent)return'';return m.type==='text'||m.type==='voice'?String(m.content||''):'';}
/* 返回 [{kind,id,name,avatar,hits:[{m,t,who,avatar}]}]，每个聊天里的命中按时间从新到旧，聊天之间按最近一条命中排序。 */
function wxSearchChats(q,scopeId,scopeGid){const chats=[];
  if(!scopeGid)S.contacts.filter(c=>!c.deleted&&(!scopeId||c.id===scopeId)).forEach(c=>{const arr=msgs(c.id),hits=[];for(let i=arr.length-1;i>=0;i--){const m=arr[i],t=wxSearchMsgText(m);if(t&&t.toLowerCase().indexOf(q)>=0){if(!m.id)m.id=uid();hits.push({m,t,who:m.role==='user'?(S.me.name||'我'):(c.remark||c.name),avatar:av(m.role==='user'?S.me.avatar:c.avatar)});}}if(hits.length)chats.push({kind:'role',id:c.id,name:c.remark||c.name,avatar:av(c.avatar),hits});});
  if(!scopeId)(S.groups||[]).filter(g=>g&&Array.isArray(g.msgs)&&(!scopeGid||g.id===scopeGid)).forEach(g=>{const hits=[];for(let i=g.msgs.length-1;i>=0;i--){const m=g.msgs[i],t=wxSearchMsgText(m);if(t&&t.toLowerCase().indexOf(q)>=0){if(!m.id)m.id=uid();const sc=m.senderId==='me'?null:getC(m.senderId);hits.push({m,t,who:gnm(g,m.senderId),avatar:av(m.senderId==='me'?S.me.avatar:(sc?sc.avatar:'🙂'))});}}if(hits.length)chats.push({kind:'group',id:g.id,name:groupDisplayName(g),avatar:g.avatar?av(g.avatar):wxClassicGroupAvatarHTML(),hits});});
  chats.forEach(x=>x.hits.sort((a,b)=>(b.m.time||0)-(a.m.time||0)));chats.sort((a,b)=>(b.hits[0].m.time||0)-(a.hits[0].m.time||0));return chats;}
function wxSearchRowHTML(o){return `<div class="wxs-row" onclick="${o.click}"><span class="wxs-av">${o.avatar}</span><div class="wxs-main"><div class="wxs-line"><b>${esc(o.name)}</b><small>${esc(o.when)}</small></div><div class="wxs-snip">${o.snip}</div>${o.count>1?`<div class="wxs-count">共 <i>${o.count}</i> 条相关聊天记录</div>`:''}</div></div>`;}
function wxSearchBodyHTML(q){q=String(q||'').trim().toLowerCase();const page=wxSearchPage(),scopeId=page.id||'',scopeGid=page.gid||'',c=scopeId&&getC(scopeId),g=scopeGid&&S.groups.find(x=>x.id===scopeGid),scoped=c||g,scope=c?'你和'+(c.remark||c.name)+'的聊天记录':g?'「'+groupDisplayName(g)+'」的聊天记录':'你和所有角色、群聊的聊天记录';
  if(!q)return '<div class="wxs-empty">输入关键词<br>搜'+esc(scope)+'</div>';
  const chats=wxSearchChats(q,scopeId,scopeGid);
  const pf=!scoped&&/^sp[a-z0-9]{4,12}$/i.test(q)?`<div class="wxs-row" onclick="phoneFriendSearchFromWx('${esc(q)}')"><span class="wxs-av"><div class="avatar" style="background:#6574ff">${svgIc('users',21,'#fff')}</div></span><div class="wxs-main"><div class="wxs-line"><b>搜索小手机ID</b></div><div class="wxs-snip">查找 ${esc(q.toUpperCase())} 并申请添加</div></div></div>`:'';
  if(!chats.length)return pf+'<div class="wxs-empty">没找到包含「'+esc(q)+'」的聊天记录</div>';
  /* 进到某一个聊天里：一条命中一行，点哪条跳哪条 */
  if(scoped){const chat=chats[0];return `<div class="wxs-head">${chat.hits.length} 条与“${esc(q)}”相关的聊天记录</div>`+chat.hits.slice(0,300).map(h=>wxSearchRowHTML({click:`wxSearchJump('${chat.kind}','${chat.id}','${h.m.id}')`,avatar:h.avatar,name:h.who,when:wxSearchWhen(h.m.time),snip:wxHi(h.t,q),count:1})).join('');}
  return pf+'<div class="wxs-head">聊天记录</div>'+chats.slice(0,80).map(chat=>{const h=chat.hits[0];return wxSearchRowHTML({click:`wxSearchOpen('${chat.kind}','${chat.id}')`,avatar:chat.avatar,name:chat.name,when:wxSearchWhen(h.m.time),snip:wxHi(h.t,q),count:chat.hits.length});}).join('');}
const _wxSearchTop={};
function wxSearchTopKey(page){page=page||wxSearchPage();return page.gid?'g:'+page.gid:page.id||'all';}
function wxSearchKeepTop(){const page=wxSearchPage(),box=$('#wxs_res');if(box&&page.p)_wxSearchTop[wxSearchTopKey(page)]=box.scrollTop;}
function renderWxSearch(id){const page=wxSearchPage(),q=String(page.q||'');
  /* 从聊天返回结果页：列表回到刚才点的位置 */
  const topKey=wxSearchTopKey(page),top=_wxSearchTop[topKey];if(top)setTimeout(()=>{const box=$('#wxs_res'),now=wxSearchPage();if(box&&now.p&&wxSearchTopKey(now)===topKey)box.scrollTop=top;},0);
  return `<div class="wxs-page"><div class="wxs-top"><button type="button" class="wxs-back" aria-label="返回" onclick="back()"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M15 4.5 7.5 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button><label class="wxs-box">${svgIc('search',19,'currentColor')}<input id="wxs_in" placeholder="搜索" value="${esc(q)}" oninput="wxSearchRun(this.value)" autocomplete="off" enterkeyhint="search"><button type="button" class="wxs-clear" id="wxs_clear" aria-label="清空" onclick="wxSearchClear()"${q?'':' hidden'}>×</button></label><button type="button" class="wxs-cancel" onclick="wxSearchCancel()">取消</button></div><div class="wxs-scroll" id="wxs_res">${wxSearchBodyHTML(q)}</div></div>`;}
function wxSearchRun(q){const box=$('#wxs_res');if(!box)return;const page=cur(),scopeId=page&&page.p==='wxsearch'?page.id:'';if(page&&page.p==='wxsearch')page.q=String(q||'');const clear=$('#wxs_clear');if(clear)clear.hidden=!String(q||'');
  /* 在某个角色里搜索时只看这一个角色：S.contacts.filter(c=>!c.deleted&&(!scopeId||c.id===scopeId))，分组与排序在 wxSearchChats 里完成 */
  box.innerHTML=wxSearchBodyHTML(q);box.scrollTop=0;if(page&&page.p==='wxsearch')delete _wxSearchTop[wxSearchTopKey(page)];}
function wxSearchClear(){const i=$('#wxs_in');if(i){i.value='';try{i.focus();}catch(_){}}wxSearchRun('');}
function wxSearchCancel(){while(stack.length>1&&cur().p==='wxsearch')stack.pop();render();}
function wxSearchOpen(kind,id){const q=String(wxSearchPage().q||'').trim();if(!q)return;wxSearchKeepTop();const chat=wxSearchChats(q.toLowerCase(),kind==='group'?'':id,kind==='group'?id:'')[0];if(!chat)return;if(chat.hits.length===1){wxSearchJump(kind,id,chat.hits[0].m.id);return;}go('wxsearch',kind==='group'?{gid:id,q}:{id,q});}
/* 跳到某条消息：聊天页照常打开，只是这一次不贴底，而是把那条消息放到屏幕中间并闪一下。
   只管这一次——返回后再正常点开这个聊天，还是回到最底下。 */
let _chatJump=null;
function wxSearchJump(kind,id,mid){wxSearchKeepTop();
  if(kind==='group'){const g=S.groups.find(x=>x.id===id);if(!g||!g.msgs.some(m=>m.id===mid)){toast('这条消息已经不在了');return;}delete _scrollBottomOnce['group:'+id];_chatJump={key:'group:'+id,mid};go('group',{id});return;}
  const c=getC(id),all=c?msgs(id):[],i=all.findIndex(m=>m.id===mid);if(i<0){toast('这条消息已经不在了');return;}
  /* 聊天页默认只画最近一段，先把窗口放大到够得着那条消息 */
  _chatRenderExtra[id]=Math.max(_chatRenderExtra[id]||0,all.length-i+20-CHAT_RENDER_LIMIT,0);
  wxChatRestore('role:'+id);stack=stack.filter(x=>x.p!=='chat');delete _scrollBottomOnce['chat:'+id];_chatJump={key:'chat:'+id,mid};go('chat',{id});}
