function dyGCastSave(gid){const g=dyGroup(gid);if(!g)return;
  const v=id=>{const el=$('#'+id);return el?el.value:'';};
  g.maxSpeak=dyGNum(v('dyg_max'),3,1,6);g.maxAdmin=dyGNum(v('dyg_adm'),2,1,6);
  g.idleHours=dyGNum(v('dyg_idle'),3,1,24);
  const n=parseInt(v('dyg_idlen'),10);g.idleMax=Number.isFinite(n)&&n>=0?Math.min(20,n):3;
  g.bubAdmin=dyGNum(v('dyg_buba'),4,1,8);g.bubMember=dyGNum(v('dyg_bubm'),1,1,8);
  save();closeModal();render();toast('改好了');}
/* 单个人的话痨度和他在意的词 */
function dyGMemberTune(gid,k){const g=dyGroup(gid),m=g&&dyGFind(g,k);if(!g||!m||k==='me')return;
  openModal(`<h3>${esc(dyGMemberName(m))}</h3><div class="hint">话痨度决定他多爱冒泡：活泼的人高，内向的人低。在意的词踩中了，平时不说话的人也会出来接一句，用顿号或逗号隔开。</div>
    <div class="field"><label>话痨度（0～100，现在 ${dyGTalk(m)}）</label><input id="dyg_talk" type="number" min="0" max="100" value="${dyGTalk(m)}"></div>
    <div class="field"><label>在意的词</label><input id="dyg_care" maxlength="120" placeholder="例如：饿、外卖、好吃" value="${esc(dyGCare(m).join('、'))}"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dyGMemberTuneSave('${gid}','${esc(k)}')">保存</button></div>`);}
function dyGMemberTuneSave(gid,k){const g=dyGroup(gid),m=g&&dyGFind(g,k);if(!g||!m)return;
  const t=$('#dyg_talk'),c=$('#dyg_care');
  const n=parseInt(t?t.value:'',10);m.talk=Number.isFinite(n)?Math.max(0,Math.min(100,n)):dyGGuessTalk(dyGPersonaText(m));
  m.care=String(c?c.value:'').split(/[、,，\s]+/).map(x=>x.trim()).filter(Boolean).slice(0,12);
  save();closeModal();render();toast('改好了');}
function dyGRemoveMember(gid){const g=dyGroup(gid);if(!g||!dyGCanManage(g,'me'))return toast('只有群主和管理员可以移除成员');
  const ms=dyGMemberList(g).filter(m=>m.k!=='me'&&dyGRole(g,m.k)!=='owner');if(!ms.length)return toast('群里没有可以移除的人');
  openModal(`<h3>移除群成员</h3><div style="max-height:46vh;overflow:auto">${ms.map(m=>`<div class="row" onclick="dyGRemoveDo('${gid}','${esc(m.k)}')" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee">${dyFace(dyGMemberAvatar(m),'sm')}<b style="flex:1;font-size:14px;font-weight:500">${esc(dyGMemberName(m))}</b><span style="color:#fa5151;font-size:13px">移除</span></div>`).join('')}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function dyGRemoveDo(gid,k){const g=dyGroup(gid),m=g&&dyGFind(g,k);if(!g||!m)return;const nm=dyGMemberName(m);
  g.members=dyGMemberList(g).filter(x=>x.k!==k);
  dyGMsgs(g).push({id:uid(),type:'sys',text:nm+' 被移出了群聊',time:Date.now()});
  save();closeModal();render();toast('已移除 '+nm);}
function dyGAdmins(gid){const g=dyGroup(gid);if(!g||dyGRole(g,'me')!=='owner')return toast('只有群主可以设置管理员');
  const ms=dyGMemberList(g).filter(m=>m.k!=='me');if(!ms.length)return toast('群里还没有别人');
  openModal(`<h3>设置管理员</h3><div class="hint">管理员可以移除成员、审批加群申请。</div><div style="max-height:44vh;overflow:auto">${ms.map(m=>{const isAdmin=dyGRole(g,m.k)==='admin';
    return `<div class="row" onclick="dyGAdminToggle('${gid}','${esc(m.k)}')" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee">${dyFace(dyGMemberAvatar(m),'sm')}<b style="flex:1;font-size:14px;font-weight:500">${esc(dyGMemberName(m))}</b><span style="font-size:13px;color:${isAdmin?'#f1c40f':'#888'}">${isAdmin?'管理员 · 点击取消':'设为管理员'}</span></div>`;}).join('')}</div>
    <button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}
function dyGAdminToggle(gid,k){const g=dyGroup(gid),m=g&&dyGFind(g,k);if(!m)return;
  m.role=m.role==='admin'?'member':'admin';
  dyGMsgs(g).push({id:uid(),type:'sys',text:dyGMemberName(m)+(m.role==='admin'?' 被设为管理员':' 不再是管理员'),time:Date.now()});
  save();closeModal();render();toast(m.role==='admin'?'已设为管理员':'已取消管理员');}
function dyGOpenToggle(gid){const g=dyGroup(gid);if(!g)return;g.open=!g.open;if(g.open)g.lastApplyDay='';save();render();
  toast(g.open?'已转为公开群，每天会有一位陌生人来申请':'已转为私密群，只能你自己邀请');}
function dyGToggle(gid,key){const g=dyGroup(gid);if(!g)return;g[key]=key==='aiOn'?(g.aiOn===false):!g[key];save();render();
  if(key==='aiOn')toast(g.aiOn===false?'群里的人不再自动说话':'群聊 AI 已开启');}
function dyGField(gid,key,title,ph,max){const g=dyGroup(gid);if(!g)return;
  openModal(`<h3>${esc(title)}</h3><div class="field"><textarea id="dyg_f" rows="${key==='name'||key==='myNick'?1:4}" placeholder="${esc(ph)}">${esc(String(g[key]||''))}</textarea></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dyGFieldSave('${gid}','${key}',${max})">保存</button></div>`);}
function dyGFieldSave(gid,key,max){const g=dyGroup(gid),el=$('#dyg_f');if(!g)return;
  g[key]=String(el?el.value:'').trim().slice(0,max||60);save();closeModal();render();toast('已保存');}
function changeDyGroupAvatar(gid){const g=dyGroup(gid);if(!g)return;pickFile('image/*',async f=>{g.avatar=await compress(f,300,.8);save();render();toast('群头像已换 🎨');});}
function dyGRename(gid){dyGField(gid,'name','群名称','给这个群起个名字',30);}
function dyGIntro(gid){dyGField(gid,'intro','群简介','例如：禁男，禁二传，需16+',60);}
function dyGNotice(gid){dyGField(gid,'notice','群公告','写点群里都要看到的话',200);}
function dyGMyNick(gid){dyGField(gid,'myNick','我在本群的昵称','留空就用你的名字',20);}
function dyGSearch(gid){const g=dyGroup(gid);if(!g)return;
  openModal(`<h3>查找聊天内容</h3><div class="field"><input id="dyg_q" placeholder="搜群里说过的话"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dyGSearchRun('${gid}')">搜索</button></div>`);}
function dyGSearchRun(gid){const g=dyGroup(gid),q=String((($('#dyg_q')||{}).value||'')).trim().toLowerCase();if(!g||!q)return toast('写点什么再搜');
  const hits=dyGMsgs(g).filter(m=>String(m.text||'').toLowerCase().includes(q));
  openModal(`<h3>找到 ${hits.length} 条</h3><div style="max-height:48vh;overflow:auto">${hits.length?hits.slice(-40).reverse().map(m=>`<div style="padding:9px 2px;border-bottom:.5px solid #eee"><b style="font-size:13px">${esc(m.type==='sys'?'群通知':dyGMemberName(dyGFind(g,m.k)))}</b><div style="font-size:13px;color:#555;margin-top:3px">${esc(m.text)}</div></div>`).join(''):'<div class="empty" style="padding:22px">没有找到</div>'}</div><button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}
async function dyGClear(gid){const g=dyGroup(gid);if(!g)return;if(!await uiConfirm('清空「'+g.name+'」的聊天记录？'))return;g.msgs=[];save();render();toast('已清空');}
async function dyGDisband(gid){const g=dyGroup(gid);if(!g)return;
  if(dyGRole(g,'me')!=='owner')return toast('只有群主可以解散群聊');
  if(!await uiConfirm('解散「'+g.name+'」？群聊和里面的消息都会消失。',{danger:true}))return;
  S.dy.groups=dyGroups().filter(x=>x.id!==gid);S.dy.applies=dyApplies().filter(a=>a.gid!==gid);
  _dyGid='';_dySub='';save();render();toast('群聊已解散');}
/* ===== 任何一个人的抖音主页：角色、群里的陌生人、评论区的网友，都点得进去 ===== */
let _dyUserKey='';let _dyUserTab='作品';let _dyGMTab='全部';let _dyGMSort='最早进群';let _dyGMQ='';
function dyKeyHash(str){let h=0;str=String(str||'');for(let i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))>>>0;return h;}
function dyPersonKey(p){return p&&p.cid?('c:'+p.cid):p&&p.k?p.k:('n:'+((p&&p.name)||''));}
function dyPersonFind(key){key=String(key||'');
  if(key.indexOf('c:')===0){const c=getC(key.slice(2));if(c)return {k:key,cid:c.id,name:((S.dy&&S.dy.users&&S.dy.users[key]||{}).nick)||c.remark||c.name,avatar:c.dyAvatar||c.avatar,persona:String(c.persona||'')};}
  for(const g of dyGroups()){const m=dyGFind(g,key);if(m&&m.k!=='me')return {k:key,cid:m.cid||'',name:dyGMemberName(m),avatar:dyGMemberAvatar(m),persona:dyGMemberPersona(m)};}
  const v=(S.dy.visitors||[]).find(x=>x.k===key);if(v)return {k:key,cid:v.cid||'',name:v.name,avatar:v.avatar,persona:''};
  const f=(S.dy.fans||[]).find(x=>x.k===key);if(f)return {k:key,cid:f.cid||'',name:f.name,avatar:f.avatar,persona:''};
  const a=dyApplies().find(x=>x.k===key);if(a)return {k:key,cid:'',name:a.name,avatar:a.avatar,persona:a.persona||''};
  if(key.indexOf('n:')===0)return {k:key,cid:'',name:key.slice(2),avatar:'',persona:''};
  return null;}
/* 每个人的数字要稳定：同一个人每次进来都一样，不能刷一次变一次。 */
function dyPersonStat(p,salt,lo,hi){const h=dyKeyHash(dyPersonKey(p)+'|'+salt);return lo+h%(Math.max(1,hi-lo));}
function dyPersonDyid(p){const r=p&&S.dy&&S.dy.users&&S.dy.users[dyPersonKey(p)];if(r&&r.dyid)return String(r.dyid);return String(2e10+dyKeyHash(dyPersonKey(p)+'|id')%8e10);}
function dyPersonWorks(p){const key=dyPersonKey(p);
  return (S.dy.feed||[]).filter(v=>v.cid&&v.cid!=='me'&&('c:'+v.cid)===key).sort((a,b)=>(b.ts||0)-(a.ts||0));}
function dyPersonFollowsMe(p){if(p.cid)return true;
  const v=(S.dy.visitors||[]).find(x=>x.k===p.k);if(v)return !!v.follows;
  return (S.dy.fans||[]).some(x=>x.k===p.k);}
function dyPersonIFollow(p){if(p.cid)return (S.dy.following||[]).includes(p.cid);
  const v=(S.dy.visitors||[]).find(x=>x.k===p.k);return !!(v&&v.iFollow);}
/* 主页是独立的一页，不是抖音里的一个子状态。以前它挂在 _dySub 上，
   而私聊自己是一页，所以在私聊里点头像 render() 画的还是私聊——点了没反应。 */
function dyUserKey(){try{const c=cur();if(c&&c.p==='dyuser'&&c.key)return c.key;}catch(_){}return _dyUserKey;}
function dyOpenUser(key){const p=dyPersonFind(key);if(!p)return toast('找不到这个人');
  _dyUserKey=p.k;_dyUserTab='作品';_dyUserEdit=false;
  try{if(cur().p==='dyuser')return render();}catch(_){}
  _dySub='';go('dyuser',{key:p.k});}
function dyUserToggleFollow(){const p=dyPersonFind(dyUserKey());if(!p)return;
  if(p.cid){const i=S.dy.following.indexOf(p.cid);if(i<0)S.dy.following.push(p.cid);else S.dy.following.splice(i,1);save();render();return toast(i<0?'已关注':'已取关');}
  const v=(S.dy.visitors||[]).find(x=>x.k===p.k);
  if(v){v.iFollow=!v.iFollow;save();render();return toast(v.iFollow?'已关注':'已取关');}
  (S.dy.visitors||[]).push({k:p.k,name:p.name,avatar:p.avatar,ts:Date.now(),seen:true,follows:true,iFollow:true});save();render();toast('已关注');}
function dyUserBack(){try{if(cur().p==='dyuser')return back();}catch(_){}dySubClose();}
function dyUserDM(){const p=dyPersonFind(dyUserKey());if(!p)return;
  try{if(cur().p==='dyuser')back();}catch(_){}
  _dySub='';openDyDMName(p.name,p.cid||null,p.avatar||'');}
function dyRoleAvatarPick(cid){pickFile('image/*',async f=>{const c=getC(cid);if(!c)return;try{c.dyAvatar=await compress(f,300,.8);save();render();toast('抖音头像已换 🎨');}catch(_){toast('这张图片读不了，换一张试试');}});}
function dyRoleAvatarReset(cid){const c=getC(cid);if(!c)return;delete c.dyAvatar;save();render();toast('已恢复用微信头像');}
/* DY_USER_EDIT_V1（2026-10-18 她说：角色主页也要有「编辑主页」，点开直接复用我的那个主页；三个点不要菜单，直接进编辑主页，原来菜单里的功能都放进去，我主页里有的它都有）：
   和「我」的编辑主页同一套样子（dyed-*），改的是这个人自己的抖音资料（存在 S.dy.users[人]），不动微信里的名字和人设。 */
let _dyUserEdit=false;
function dyUserEditOpen(){_dyUserEdit=true;render();}
function dyUserEditClose(){_dyUserEdit=false;render();}
function dyUserRecOf(p){return p?dyUserRec(dyPersonKey(p),false)||{}:{};}
function dyUserNum(p,k,auto){const r=dyUserRecOf(p),v=r[k];return v===undefined||v===null||v===''?auto:Math.max(0,+v||0);}
function dyUserAge(p){const b=dyUserRecOf(p).birth;return b&&typeof dyAgeFromBirth==='function'?dyAgeFromBirth(b):'';}
function dyUserEditRows(p){const r=dyUserRecOf(p),age=dyUserAge(p);return [['nick','名字',p.name],['bio','简介',dyPersonBio(p)],['gender','性别',dyPersonGender(p)],['birth','生日',r.birth?(r.birth+(age!==''?' · '+age+'岁':'')):''],['ip','所在地',dyPersonIP(p)],['dyid','抖音号',dyPersonDyid(p)]];}
function dyUserEditView(p){const cover=storedImageDisplaySource(dyPersonCover(p)||''),rows=dyUserEditRows(p),done=Math.round((rows.filter(x=>String(x[2]||'').trim()).length+(p.avatar?1:0)+(cover?1:0))/8*100),role=p.cid&&getC(p.cid),works=dyPersonWorks(p),iFollow=dyPersonIFollow(p);
  const likes=dyUserNum(p,'likes',dyPersonStat(p,'like',60,9000)+works.reduce((n,v)=>n+(+v.lk||0),0)),fans=dyUserNum(p,'fans',dyPersonStat(p,'fan',20,900)),follows=dyUserNum(p,'follows',dyPersonStat(p,'fol',1,60)),lv=dyUserRecOf(p).level||'';
  const row=(k,label,v)=>`<div class="dyed-row" onclick="dyUserEditField('${k}')"><label>${esc(label)}</label><div class="v${v?'':' dim'}">${v?esc(String(v)):'暂不设置'}</div><i>›</i></div>`;
  const act=(label,js,danger)=>`<div class="dyed-row" onclick="${js}"><label style="width:auto;flex:1;white-space:nowrap${danger?';color:#ff6b81':''}">${esc(label)}</label><div class="v"></div><i>›</i></div>`;
  return `<div class="dyed" id="dyed">
    <div class="dyed-cover" style="${isImg(cover)?`background-image:url(${cover})`:''}">
      <div class="dyed-top"><i class="dyed-back" onclick="dyUserEditClose()">‹</i><button class="dyed-coverbtn" onclick="dyUserCoverChange()">${svgIc('camera',19,'#fff',2)}更换封面</button></div>
      <div class="dyed-avwrap" onclick="${role?`dyRoleAvatarPick('${p.cid}')`:`toast('只有角色能换抖音头像')`}">${dyFace(dyRA(p.cid,p.avatar),'lg')}<span class="dyed-avmask">${svgIc('camera',26,'#fff',2)}更换头像</span></div>
    </div>
    <div class="dyed-sheet">
      <div class="dyed-prog"><i><b style="width:${done}%"></b></i><span>资料完成度 <b>${done}%</b></span></div>
      <div class="dyed-rows">${rows.map(r=>row(r[0],r[1],r[2])).join('')}</div>
    </div>
    <div class="dyed-gap"></div>
    <div class="dyed-cap">下面这几项真实抖音不让改，小手机让你自己写（留空就恢复自动）</div>
    <div class="dyed-sheet">${row('likes','获赞',dyNum(likes))}${row('follows','关注',dyNum(follows))}${row('fans','粉丝',dyNum(fans))}${row('level','等级牌',lv)}</div>
    <div class="dyed-gap"></div>
    <div class="dyed-cap">原来右上角「…」里的功能</div>
    <div class="dyed-sheet">
      ${act('发私信',"dyUserEditClose();dyUserDM()")}
      ${act(iFollow?'取消关注':'关注 TA',"dyUserToggleFollow()")}
      ${act('让 TA 自己写简介',"dyUserBioGen()")}
      ${p.cid?act('让 TA 发一条作品',`dyGenContactVideo('${p.cid}')`):''}
      ${dyPersonCover(p)?act('恢复默认背景',"dyUserCoverReset()"):''}
      ${role&&getC(p.cid).dyAvatar?act('恢复用微信头像',`dyRoleAvatarReset('${p.cid}')`):''}
    </div>
    <div style="height:26px"></div>
  </div>`;}
function dyUserEditField(k){const p=dyPersonFind(dyUserKey());if(!p)return;
  if(k==='bio')return dyUserBioEdit();
  if(k==='ip')return dyUserIPEdit();
  if(k==='gender'){const g0=(dyUserRecOf(p).gender)||'';return openModal(`<h3>性别</h3><div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">${[['女','女'],['男','男'],['自动（跟着人设）','']].map(([l,v])=>`<button class="btn ${g0===v?'p':'g'}" onclick="dyUserEditSet('gender','${v}')">${l}</button>`).join('')}</div><button class="btn g" style="margin-top:10px" onclick="closeModal()">取消</button>`);}
  const L={nick:'名字',birth:'生日',dyid:'抖音号',likes:'获赞',follows:'关注',fans:'粉丝',level:'等级牌'},r=dyUserRecOf(p),num=['likes','follows','fans'].includes(k);
  const cur=k==='nick'?(r.nick||''):String(r[k]===undefined||r[k]===null?'':r[k]);
  const ph=k==='nick'?esc(p.name):k==='dyid'?esc(dyPersonDyid(p)):k==='level'?'例如 15，留空不显示':num?'留空就是自动的数':'';
  openModal(`<h3>${esc(p.name)} 的${L[k]||''}</h3>${k==='nick'?'<div class="hint">只改抖音上显示的名字，微信里的名字不变。留空恢复用微信名字。</div>':''}<div class="field"><input id="dyued_v" ${k==='birth'?'type="date"':num?'type="number" min="0"':''} value="${esc(cur)}" placeholder="${ph}"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dyUserEditSave('${k}')">保存</button></div>`);}
function dyUserEditSet(k,v){const p=dyPersonFind(dyUserKey());if(!p)return;const r=dyUserRec(dyPersonKey(p),true);if(!r)return;r[k]=v;save();closeModal();render();toast('已保存');}
function dyUserEditSave(k){const p=dyPersonFind(dyUserKey()),el=$('#dyued_v');if(!p)return;const r=dyUserRec(dyPersonKey(p),true);if(!r)return;const raw=el?String(el.value||'').trim():'';
  if(['likes','follows','fans'].includes(k)){if(raw==='')delete r[k];else r[k]=Math.max(0,parseInt(raw,10)||0);}
  else if(k==='level')r.level=raw.slice(0,4);
  else if(k==='dyid')r.dyid=raw.replace(/\s+/g,'').slice(0,24);
  else if(k==='nick')r.nick=raw.slice(0,24);
  else r[k]=raw.slice(0,40);
  save();closeModal();render();toast('已保存');}
function dyUserView(){const p=dyPersonFind(dyUserKey());
  if(p&&_dyUserEdit)return dyUserEditView(p);
  if(!p)return `<div class="dyvi"><div class="dyvi-nav dy-safe-nav2"><i onclick="dyUserBack()">‹</i><b>主页</b><em style="width:21px"></em></div><div class="dyvi-empty">找不到这个人了</div></div>`;
  const works=dyPersonWorks(p),iFollow=dyPersonIFollow(p),followsMe=dyPersonFollowsMe(p);
  const likes=dyUserNum(p,'likes',dyPersonStat(p,'like',60,9000)+works.reduce((n,v)=>n+(+v.lk||0),0));
  const fans=dyUserNum(p,'fans',dyPersonStat(p,'fan',20,900)),follows=dyUserNum(p,'follows',dyPersonStat(p,'fol',1,60)),lv=dyUserRecOf(p).level||'',age=dyUserAge(p);
  const lover=S.couple&&S.couple.cid&&p.cid===S.couple.cid;
  const tags=[['IP：'+dyPersonIP(p),''],[p.cid?'角色':'网友',''],[dyPersonGender(p),'']].concat(age!==''?[[age+'岁','']]:[]);
  const grid=works.length?`<div class="dyme-grid" style="margin:2px 0 0">${works.map((v,i)=>`<div class="dyme-cell" onclick="dyOpenWork('${v.id}')" style="background:${v.grad||DY_GRADS[i%DY_GRADS.length]}">${dyWorkThumbHTML(v)}<span class="dyme-play">${svgIc('heart',11,'#fff',2.4)} ${dyNum(v.lk||0)}</span></div>`).join('')}</div><div class="dyus-end">暂时没有更多了</div>`
    :`<div class="dyvi-empty">${_dyUserTab==='作品'?'TA 还没发过作品～':'这里还是空的'}</div>`;
  /* 她自己换过的背景要原样显示，不蒙那层白雾；没换过时还是拿头像当底、糊一层 */
  const own=storedImageDisplaySource(dyPersonCover(p)||''),ownImg=isImg(own);
  const bg=ownImg?own:storedImageDisplaySource(p.avatar||'');
  const ink=ownImg?'#fff':'#111';
  return `<div class="dyus">
    <div class="dyus-cover${ownImg?' has-img':''}" style="${isImg(bg)?`background-image:url(${bg})`:''}">
      <div class="dyus-top dy-safe-nav2"><i onclick="dyUserBack()">‹</i><span class="dyus-poke" onclick="dyOpenUpdate()">☞ 求更新</span><i onclick="dyOpenMeSearch()">${svgIc('search',19,ink,2)}</i><i onclick="dyUserEditOpen()">${svgIc('dots',19,ink,2)}</i></div>
      <div class="dyus-id">${dyFace(dyRA(p.cid,p.avatar),'lg')}<div class="dyus-name"><b>${esc(p.name)}${lv?`<em class="dyme-lv" style="margin-left:6px">${esc(lv)}</em>`:''}</b><span onclick="dyUserCopyId()">抖音号：${esc(dyPersonDyid(p))} ⧉</span></div></div>
    </div>
    <div class="dyus-body">
      <div class="dyus-stats"><b>${dyNum(likes)}</b><span>获赞</span><b>${dyNum(follows)}</b><span>关注</span><b>${dyNum(fans)}</b><span>粉丝</span><button class="dyme-edit" style="align-self:center;flex-shrink:0;padding:8px 13px;font-size:14px" onclick="dyUserEditOpen()">编辑主页</button></div>
      ${followsMe?`<div class="dyus-line">${svgIc('user',15,'#c4c4cb',2)} TA 关注了你</div>`:''}
      ${lover?`<div class="dyus-line">恋人：<em onclick="dyGoMyProfile()">@${esc(dyNick())}</em></div>`:''}
      ${dyPersonBio(p)?`<div class="dyus-bio">${esc(dyPersonBio(p))}</div>`:'<div class="dyus-bio dyus-nobio" onclick="dyUserBioEdit()">这个人还没写简介</div>'}
      <div class="dyus-tags">${tags.map(t=>`<span>${esc(t[0])}</span>`).join('')}</div>
      <div class="dyus-acts"><button class="dyus-follow${iFollow?' on':''}" onclick="dyUserToggleFollow()">${svgIc('user',17,iFollow?'#c4c4cb':'#fff',2)} ${iFollow&&followsMe?'互相关注':iFollow?'已关注':'关注'}</button>
        <button class="dyus-dm" onclick="dyUserDM()">${svgIc('forward',17,'#f2f2f4',2)} 发私信</button></div>
      <div class="dyus-tabs"><span class="${_dyUserTab==='作品'?'on':''}" onclick="_dyUserTab='作品';render()">作品 ${works.length}</span><span class="${_dyUserTab==='收藏'?'on':''}" onclick="_dyUserTab='收藏';render()">收藏</span></div>
      ${_dyUserTab==='作品'?grid:'<div class="dyvi-empty">TA 的收藏不公开</div>'}
      <div style="height:18px"></div>
    </div></div>`;}
/* 抖音简介就是简介，不是人设。人设是给模型看的一大段，简介是这个人挂在主页上的
   一两句话，跟 X 的简介一个意思。所以单独存一份，绝不拿 persona 顶替。 */
function dyUserRec(key,make){key=String(key||'');if(!key)return null;
  S.dy.users=S.dy.users||{};
  if(!S.dy.users[key]&&make)S.dy.users[key]={bio:''};
  return S.dy.users[key]||null;}
function dyPersonCover(p){if(!p)return '';const r=dyUserRec(dyPersonKey(p),false);return r?String(r.cover||''):'';}
function dyUserCoverChange(){const p=dyPersonFind(dyUserKey());if(!p)return;
  pickFile('image/*',async f=>{const r=dyUserRec(dyPersonKey(p),true);if(!r)return;
    r.cover=await compressBackground(f);save();render();toast('主页背景已更换');});}
function dyUserCoverReset(){const p=dyPersonFind(dyUserKey());if(!p)return;
  const r=dyUserRec(dyPersonKey(p),false);
  if(!r||!r.cover)return toast('现在就是默认背景');
  r.cover='';save();render();toast('已恢复默认背景');}
function dyPersonBio(p){if(!p)return '';const r=dyUserRec(dyPersonKey(p),false);return r?String(r.bio||'').slice(0,80):'';}
function dyPersonBioSet(p,v){if(!p)return;const r=dyUserRec(dyPersonKey(p),true);if(!r)return;
  r.bio=String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,80);save();}
/* IP 属地跟着人设走：人设、签名、职业里写了城市就换算成省份，什么都没写就按这个人
   随机但固定一个（同一个人每次进来都一样）。你也可以手动改，改了就以你改的为准。 */
const DY_CITY_PROV=[['北京','北京'],['上海','上海'],['天津','天津'],['重庆','重庆'],
  ['广州','广东'],['深圳','广东'],['东莞','广东'],['佛山','广东'],['珠海','广东'],['汕头','广东'],
  ['杭州','浙江'],['宁波','浙江'],['温州','浙江'],['嘉兴','浙江'],['金华','浙江'],['绍兴','浙江'],
  ['南京','江苏'],['苏州','江苏'],['无锡','江苏'],['常州','江苏'],['南通','江苏'],['徐州','江苏'],
  ['成都','四川'],['绵阳','四川'],['武汉','湖北'],['宜昌','湖北'],['长沙','湖南'],['株洲','湖南'],
  ['西安','陕西'],['郑州','河南'],['洛阳','河南'],['济南','山东'],['青岛','山东'],['烟台','山东'],
  ['合肥','安徽'],['福州','福建'],['厦门','福建'],['泉州','福建'],['南昌','江西'],['昆明','云南'],
  ['贵阳','贵州'],['南宁','广西'],['桂林','广西'],['哈尔滨','黑龙江'],['长春','吉林'],['沈阳','辽宁'],
  ['大连','辽宁'],['石家庄','河北'],['太原','山西'],['兰州','甘肃'],['银川','宁夏'],['西宁','青海'],
  ['乌鲁木齐','新疆'],['呼和浩特','内蒙古'],['拉萨','西藏'],['海口','海南'],['三亚','海南'],
  ['香港','香港'],['澳门','澳门'],['台北','台湾']];
const DY_PROVS=['北京','上海','广东','江苏','浙江','四川','湖北','湖南','山东','福建','河南','重庆','陕西','辽宁','安徽','江西','云南','广西','河北','山西','天津','黑龙江','吉林','贵州','新疆','海南'];
function dyProvinceOfCity(city){city=String(city||'').trim();if(!city)return '';
  for(const [c,p] of DY_CITY_PROV)if(city.indexOf(c)>=0)return p;
  for(const p of DY_PROVS)if(city.indexOf(p)>=0)return p;
  return '';}
function dyPersonIP(p){if(!p)return '';
  const rec=dyUserRec(dyPersonKey(p),false);
  if(rec&&rec.ip)return String(rec.ip).slice(0,12);/* 你手动改过，以你的为准 */
  if(p.cid){const c=getC(p.cid);const prov=dyProvinceOfCity(charHomeCity(c))||dyProvinceOfCity(String((c&&c.persona)||''));if(prov)return prov;}
  const prov=dyProvinceOfCity(String(p.persona||''));if(prov)return prov;
  return DY_PROVS[dyKeyHash(dyPersonKey(p)+'|ip2')%DY_PROVS.length];}
function dyPersonGender(p){if(!p)return '';
  const rec=dyUserRec(dyPersonKey(p),false);
  if(rec&&rec.gender)return rec.gender;
  const text=(p.cid?String((getC(p.cid)||{}).persona||''):String(p.persona||''));
  if(/\b(男生|男孩|男人|男性|他是个男|先生|哥哥|弟弟|爸爸)\b|男/.test(text)&&!/女/.test(text))return '男';
  if(/女生|女孩|女人|女性|姐姐|妹妹|妈妈/.test(text))return '女';
  return dyKeyHash(dyPersonKey(p)+'|g')%2?'男':'女';}
function dyUserIPEdit(){const p=dyPersonFind(dyUserKey());if(!p)return;
  openModal(`<h3>${esc(p.name)} 的资料</h3><div class="hint">IP 属地平时跟着人设走——人设里写了城市就自动换算成省份，没写就按这个人固定一个。这里改了就以你改的为准，留空恢复自动。</div>
    <div class="field"><label>IP 属地</label><input id="dy_ip" maxlength="12" placeholder="例如：浙江" value="${esc(dyPersonIP(p))}"></div>
    <div class="field"><label>性别</label><select id="dy_gd"><option value="">自动</option><option value="男"${dyPersonGender(p)==='男'?' selected':''}>男</option><option value="女"${dyPersonGender(p)==='女'?' selected':''}>女</option></select></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dyUserIPSave()">保存</button></div>`);}
function dyUserIPSave(){const p=dyPersonFind(dyUserKey());if(!p)return;
  const rec=dyUserRec(dyPersonKey(p),true);if(!rec)return;
  const ip=$('#dy_ip'),gd=$('#dy_gd');
  rec.ip=String(ip?ip.value:'').replace(/\s+/g,'').slice(0,12);
  rec.gender=(gd&&(gd.value==='男'||gd.value==='女'))?gd.value:'';
  save();closeModal();render();toast('资料改好了');}
function dyUserBioEdit(){const p=dyPersonFind(dyUserKey());if(!p)return;
  openModal(`<h3>${esc(p.name)} 的简介</h3><div class="hint">主页上挂的那一两句话，跟 X 的简介一样。这里不是人设，写一句就够。留空就什么都不显示。</div>
    <div class="field"><input id="dy_bio" maxlength="80" placeholder="例如：不太会说话，但都记得。" value="${esc(dyPersonBio(p))}"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dyUserBioSave()">保存</button></div>`);}
function dyUserBioSave(){const p=dyPersonFind(dyUserKey()),el=$('#dy_bio');if(!p)return;
  dyPersonBioSet(p,el?el.value:'');closeModal();render();toast('简介改好了');}
async function dyUserBioGen(){const p=dyPersonFind(dyUserKey());if(!p)return;
  const c=p.cid?getC(p.cid):null;
  toast('让 TA 自己写一句…');
  try{const sys=c?buildSystem(c):('你在扮演一个叫「'+p.name+'」的抖音用户。'+(p.persona?'设定：'+p.persona:''));
    const r=await dyAuxGen([{role:'system',content:sys},
      {role:'user',content:'给你自己的抖音主页写一句简介，就一句，不超过 25 个字。口语、有网感、像真人写的。不要写你的人设，不要方括号，不要引号，只输出这一句。'}],
      {max:60},t=>{const s=cleanReply(t).replace(/^[「"'“]|[」"'”]$/g,'').replace(/\s+/g,' ').trim().slice(0,40);return s||null;});
    dyPersonBioSet(p,r);render();toast('简介写好了');}
  catch(e){dyModelFail('写简介',e);}}
function dyUserCopyId(){const p=dyPersonFind(dyUserKey());if(!p)return;copyTextCompat(dyPersonDyid(p)).then(()=>toast('抖音号已复制'));}
function dyUserMenu(){const p=dyPersonFind(dyUserKey());if(!p)return;
  openModal(`<h3>${esc(p.name)}</h3><div class="btns" style="flex-direction:column;gap:8px">
    <button class="dybtn out" onclick="closeModal();dyUserDM()">发私信</button>
    <button class="dybtn out" onclick="closeModal();dyUserToggleFollow()">${dyPersonIFollow(p)?'取消关注':'关注 TA'}</button>
    <button class="dybtn out" onclick="closeModal();dyUserBioEdit()">编辑简介</button>
    <button class="dybtn out" onclick="closeModal();dyUserBioGen()">让 TA 自己写简介</button>
    <button class="dybtn out" onclick="closeModal();dyUserIPEdit()">改 IP 属地 / 性别</button>
    <button class="dybtn out" onclick="closeModal();dyUserCoverChange()">更换主页背景</button>
    ${dyPersonCover(p)?'<button class="dybtn out" onclick="closeModal();dyUserCoverReset()">恢复默认背景</button>':''}
    ${p.cid&&getC(p.cid)?`<button class="dybtn out" onclick="closeModal();dyRoleAvatarPick('${p.cid}')">更换抖音头像（微信头像不变）</button>${getC(p.cid).dyAvatar?`<button class="dybtn out" onclick="closeModal();dyRoleAvatarReset('${p.cid}')">恢复用微信头像</button>`:''}`:''}
    ${p.cid?`<button class="dybtn out" onclick="closeModal();dyGenContactVideo('${p.cid}')">让 TA 发一条作品</button>`:''}
    <button class="btn g" onclick="closeModal()">关闭</button></div>`);}
/* ===== 群成员：独立一页 ===== */
function dyOpenGMembers(gid){_dyGid=gid;_dyGMTab='全部';_dyGMSort='最早进群';_dyGMQ='';_dySub='gmembers';render();}
function dyGMSetTab(t){_dyGMTab=t;render();}
function dyGMSetSort(t){_dyGMSort=t;render();}
function dyGMSearch(){const el=$('#dygm_q');_dyGMQ=el?el.value:'';render();const i=$('#dygm_q');if(i)i.focus();}
function dyGMRows(g){const q=String(_dyGMQ||'').trim().toLowerCase();let ms=dyGMemberList(g).slice();
  if(_dyGMTab==='加群')ms=ms.filter(m=>!m.cid&&m.k!=='me');
  else if(_dyGMTab==='发言')ms=ms.filter(m=>dyGMsgs(g).some(x=>x.k===m.k));
  else if(_dyGMTab==='访问')ms=ms.filter(m=>m.k!=='me');
  if(q)ms=ms.filter(m=>dyGMemberName(m).toLowerCase().includes(q));
  ms.sort((a,b)=>_dyGMSort==='最近活跃'
    ?(dyGLastSaid(g,b)-dyGLastSaid(g,a))
    :((a.joinedAt||0)-(b.joinedAt||0)));
  return ms;}
function dyGLastSaid(g,m){for(let i=dyGMsgs(g).length-1;i>=0;i--)if(dyGMsgs(g)[i].k===m.k)return dyGMsgs(g)[i].time||0;return 0;}
function dyGMRow(g,m){const role=dyGRole(g,m.k),me=m.k==='me',mutual=m.cid&&(S.dy.following||[]).includes(m.cid);
  return `<div class="dygm-row" onclick="${me?"dyTab='me';_dySub='';render()":`dyOpenUser('${esc(m.k)}')`}">${me?av(dyAvatar(),'sm'):dyFace(dyGMemberAvatar(m),'sm')}
    <div class="dygm-name">${esc(dyGMemberName(m))}${mutual?'<em class="dygm-mut">互相关注</em>':''}${dyGBadge(role)}${dyGMuteLeft(g,m.k)>0?'<em class="dyg-badge muted">禁言 '+esc(dyGMuteText(dyGMuteLeft(g,m.k)))+'</em>':''}</div>
    ${me?'':`<em class="dygm-tune" onclick="event.stopPropagation();dyGMemberTune('${g.id}','${esc(m.k)}')">话痨度 ${dyGTalk(m)}</em>`}</div>`;}
function dyGMembersView(){const g=dyGroup(_dyGid);
  if(!g)return `<div class="dyvi"><div class="dyvi-nav dy-safe-nav2"><i onclick="dySubClose()">‹</i><b>群成员</b><em style="width:21px"></em></div><div class="dyvi-empty">这个群已经不在了</div></div>`;
  const rows=dyGMRows(g),tabs=['全部','访问','加群','发言'];
  const lead=rows.filter(m=>dyGRole(g,m.k)!=='member'),rest=rows.filter(m=>dyGRole(g,m.k)==='member');
  return `<div class="dyvi" style="background:#0e0e0f">
    <div class="dygm-nav dy-safe-nav2"><i onclick="dyGInfoBack()">‹</i>${tabs.map(t=>`<span class="${_dyGMTab===t?'on':''}" onclick="dyGMSetTab('${t}')">${t}</span>`).join('')}</div>
    <div class="dyrel-search" style="margin:8px 14px 0">${svgIc('search',17,'#8a8a92',2)}<input id="dygm_q" value="${esc(_dyGMQ)}" placeholder="搜索" onchange="dyGMSearch()"></div>
    <div class="dyh-chips" style="padding:12px 14px 6px">${['最早进群','最近活跃'].map(t=>`<span class="${_dyGMSort===t?'on':''}" onclick="dyGMSetSort('${t}')">${t}</span>`).join('')}</div>
    <div class="dyvi-list" data-render-scroll-key="dy:gm:${esc(g.id)}:${esc(_dyGMTab)}">
      ${lead.length?`<div class="dygm-sec">群主 / 管理员（${lead.length} 人）</div>${lead.map(m=>dyGMRow(g,m)).join('')}`:''}
      ${rest.length?`<div class="dygm-sec">群成员（${rest.length} 人）</div>${rest.map(m=>dyGMRow(g,m)).join('')}`:''}
      ${rows.length?'':'<div class="dyvi-empty">这一栏没有人</div>'}
    </div></div>`;}
/* ===== 抖音里发生的事情，角色是知道的 ===== */
function dyChatCtxBox(kind,id){return kind==='group'?dyGroup(id):((S.dy.dms||[]).find(d=>d.id===id)||null);}
function dyChatCtxEdit(kind,id){const box=dyChatCtxBox(kind,id);if(!box)return;
  openModal(`<h3>上下文条数</h3><div class="hint">这段聊天每次让角色看到最近多少条。条数越多越记得住，也越费 token。4–60，留空用默认 16。</div>
    <div class="field"><input id="dy_ctx" type="number" value="${dyChatCtxRows(box)}"></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dyChatCtxSave('${kind}','${id}')">保存</button></div>`);}
function dyChatCtxSave(kind,id){const box=dyChatCtxBox(kind,id),el=$('#dy_ctx');if(!box)return;
  const n=parseInt(el?el.value:'',10);box.ctx=Number.isFinite(n)&&n>0?Math.max(4,Math.min(60,n)):0;
  save();closeModal();render();toast('这段聊天现在看最近 '+dyChatCtxRows(box)+' 条');}
/* 单独给这个会话设过条数就按它的；没设过就跟随设置里那个「带几个回合」 */
function dyChatCtxRows(box){const n=parseInt(box&&box.ctx,10);return Math.max(4,Math.min(60,Number.isFinite(n)&&n>0?n:Math.min(60,phCtxRows())));}
function dyReplyBudget(){const route=chatMainCopy(chatRequestRoute(null)||S.settings&&S.settings.chat||{});
  return Math.max(120,Math.min(2048,Number(route.maxTokens)||900));}
function dyMemoryLines(cid,limit){const out=[];
  (S.dy.dms||[]).forEach(d=>{if(d.cid!==cid)return;(d.msgs||[]).slice(-10).forEach(m=>out.push({t:m.time||0,s:'【抖音私信】'+(m.from==='me'?S.me.name:d.name)+'：'+String(m.text||'').slice(0,80)}));});
  dyGroups().forEach(g=>{if(!dyGFind(g,'c:'+cid))return;
    dyGMsgs(g).slice(-12).forEach(m=>{if(m.type==='sys')return;const who=dyGMemberName(dyGFind(g,m.k));
      out.push({t:m.time||0,s:'【抖音群聊·'+g.name+'】'+who+'：'+String(m.text||'').slice(0,80)});});});
  (S.dy.mine||[]).slice(0,4).forEach(v=>{out.push({t:v.ts||0,s:'【'+S.me.name+'发的抖音作品】'+String(v.desc||'').slice(0,40)+(dyWorkBody(v)?'｜'+dyWorkBody(v).replace(/\s+/g,' ').slice(0,70):'')});
    (v.comments||[]).filter(cm=>cm.cid===cid||cm.me).slice(-3).forEach(cm=>out.push({t:v.ts||0,s:'【这条作品下的评论】'+(cm.me?S.me.name:cm.name)+'：'+String(cm.text||'').slice(0,60)}));});
  /* 带上多久以前：没有时间，角色分不清是刚发的还是早就聊过的，会隔几轮又问一遍（2026-10-16 实机） */
  return out.sort((a,b)=>a.t-b.t).slice(-(limit||24)).map(x=>(x.t&&typeof dyTimeAgo==='function'?'（'+dyTimeAgo(x.t)+'）':'')+x.s);}
function dyMemoryPrompt(c){if(!c||!c.id)return'';
  try{if(S.dy&&S.dy.memoryOff)return'';const lines=dyMemoryLines(c.id,24);if(!lines.length)return'';
    return '\n\n# 抖音上最近发生的事（你都经历过，可以自然提起）\n'+lines.join('\n')
      +'\n这些是你和'+(S.me.name||'她')+'在抖音里真实发生过的互动：私信、群聊、她发的作品和评论。你记得它们，聊天时可以自然提到，但不要逐条复述，也不要说"根据记录"。\n这些是背景，不是每轮都要提的新话题：微信聊天记录里你已经问过、夸过、聊过的作品或事情，不要再问一遍或重复提起，除非'+(S.me.name||'她')+'自己又说起，或者出现了新的作品、评论、私信。';
  }catch(e){return'';}}
/* ===== 抖音消息页：粉丝、互动消息、群通知、私聊 ===== */
let _dyActTab='赞与其他';let _dyActOnly='全部';
function dyTimeAgo(ts){const d=Math.max(0,Date.now()-(+ts||0));
  if(d<60000)return '刚刚';if(d<36e5)return Math.floor(d/60000)+'分钟前';if(d<864e5)return Math.floor(d/36e5)+'小时前';
  if(d<7*864e5)return Math.floor(d/864e5)+'天前';const t=new Date(+ts||0);return (t.getMonth()+1)+'-'+t.getDate();}
function dyListTime(ts){if(!ts)return '';const t=new Date(+ts),now=new Date(),day=864e5;
  if(t.toDateString()===now.toDateString())return String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
  if(t.toDateString()===new Date(now.getTime()-day).toDateString())return '昨天';
  if(t.toDateString()===new Date(now.getTime()-2*day).toDateString())return '前天';
  if(now-t<7*day)return '周'+'日一二三四五六'[t.getDay()];
  return (t.getMonth()+1)+'/'+t.getDate();}
/* ===== 粉丝 ===== */
function dyFanSync(){dyInit();const d=S.dy;if(!Array.isArray(d.fans))d.fans=[];const seen=new Set(d.fans.map(x=>x.k));let added=0;
  (d.following||[]).forEach(cid=>{const c=getC(cid);if(!c||c.deleted)return;const k='c:'+cid;if(seen.has(k))return;seen.add(k);
    d.fans.unshift({k,cid,name:c.remark||c.name,avatar:c.avatar,ts:Date.now()-(added++)*9e5,seen:false});});
  (d.visitors||[]).forEach(x=>{if(x.cid||!x.follows||seen.has(x.k))return;seen.add(x.k);
    d.fans.unshift({k:x.k,name:x.name,avatar:x.avatar,ts:Date.now()-(added++)*9e5,seen:false});});
  if(d.fans.length>200)d.fans=d.fans.slice(0,200);
  return added>0;}
function dyFanRows(){dyInit();return (S.dy.fans||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0));}
/* 红点：进一次页面就全清，不用一个个点。清掉的同时把「这次进来时哪些是新的」
   记在内存里，所以这一趟你还看得见哪几条是新的；退出去再进来就干净了。 */
let _dyFreshMark={};
function dyMarkAllSeen(kind,rows){const fresh=new Set();let changed=false;
  (rows||[]).forEach(x=>{if(x&&!x.seen){fresh.add(x.k);x.seen=true;changed=true;}});
  _dyFreshMark[kind]=fresh;if(changed)save();return changed;}
function dyWasFresh(kind,k){const s=_dyFreshMark[kind];return !!(s&&s.has(k));}
function dyFanUnseen(){return dyFanRows().filter(x=>!x.seen).length;}
function dyOpenFans(){if(dyFanSync())save(0);dyMarkAllSeen('fans',dyFanRows());_dySub='fans';render();}
function dyFanFollowed(x){return x.cid?(S.dy.following||[]).includes(x.cid):!!((S.dy.visitors||[]).find(v=>v.k===x.k)||{}).iFollow;}
function dyFanFollow(k){const x=(S.dy.fans||[]).find(v=>v.k===k);if(!x)return;x.seen=true;
  if(x.cid){const i=S.dy.following.indexOf(x.cid);if(i<0)S.dy.following.push(x.cid);else S.dy.following.splice(i,1);save();render();return toast(i<0?'已回关':'已取关');}
  const v=(S.dy.visitors||[]).find(v=>v.k===k);if(v){v.iFollow=!v.iFollow;save();render();toast(v.iFollow?'已回关':'已取关');}}
function dyFanTap(k){const x=(S.dy.fans||[]).find(v=>v.k===k);if(!x)return;if(!x.seen){x.seen=true;save();}
  if(x.cid)return dyVisitorOpenChar(x.cid);render();toast('这是网友，点不进去主页～');}
function dyFanRow(x){const fol=dyFanFollowed(x);
  return `<div class="dyfan-row" onclick="dyOpenUser('${esc(x.k)}')"><i class="dyvi-dot${dyWasFresh('fans',x.k)?'':' off'}"></i>${dyFace(dyRA(x.cid,x.avatar),'sm')}
    <div class="dyfan-main"><div class="dyfan-name">${esc(x.name)}</div><div class="dyfan-sub">${esc(dyTimeAgo(x.ts))} 关注了你</div></div>
    <button class="dyvi-btn${fol?' on':''}" onclick="event.stopPropagation();dyFanFollow('${esc(x.k)}')">${fol?'相互关注':'回关'}</button><b class="dyvi-go">›</b></div>`;}
function dyFansView(){const rows=dyFanRows(),n=dyFanUnseen();
  return `<div class="dyvi">
    <div class="dyvi-nav dy-safe-nav2"><i onclick="dySubClose()">‹</i>${n?`<em class="dyfan-count">${n>99?'99+':n}</em>`:''}<b>粉丝</b><em onclick="dyFansSettings()">${svgIc('gear',21,'#f2f2f4',1.8)}</em></div>
    <div class="dyvi-list" data-render-scroll-key="dy:fans">${rows.length?rows.map(dyFanRow).join(''):'<div class="dyvi-empty">还没有人关注你～<br>发条作品，或者去关注几个角色。</div>'}</div>
  </div>`;}
function dyFansSettings(){openModal(`<h3>粉丝</h3><div class="btns" style="flex-direction:column;gap:8px">
  <button class="dybtn out" onclick="dyFansMarkAll()">全部标为已读</button>
  <button class="btn d" onclick="dyFansClear()">清空粉丝提醒</button>
  <button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function dyFansMarkAll(){(S.dy.fans||[]).forEach(x=>{x.seen=true;});save();closeModal();render();toast('已全部标为已读');}
function dyFansClear(){S.dy.fans=[];save();closeModal();render();toast('已清空');}
/* ===== 互动消息：赞与其他 / 评论与弹幕 / 群通知 ===== */
function dyActWorks(){dyInit();return (S.dy.mine||[]);}
function dyActSync(){dyInit();const d=S.dy;if(!Array.isArray(d.acts))d.acts=[];const seen=new Set(d.acts.map(x=>x.k));let added=0;
  dyActWorks().forEach(v=>{(v.comments||[]).forEach((cm,ci)=>{if(cm.me)return;
    const base=(cm.cid?'c:'+cm.cid:'n:'+cm.name)+'|'+v.id+'|'+ci;
    const kc='cm|'+base;if(!seen.has(kc)){seen.add(kc);d.acts.unshift({k:kc,kind:'comment',name:cm.name,avatar:cm.avatar||'',cid:cm.cid||'',vid:v.id,text:String(cm.text||'').slice(0,60),ts:(v.ts||Date.now())+ci*6e4,seen:false});added++;}
    /* 评论过的人多半也点了赞：不额外调模型，就用这条现成的关系生成一条「赞了你的作品」。 */
    const kl='lk|'+base;if(!seen.has(kl)&&((String(cm.name||'').length+ci)%3)!==0){seen.add(kl);d.acts.unshift({k:kl,kind:((String(cm.name||'').length+ci)%5===0)?'rec':'like',name:cm.name,avatar:cm.avatar,cid:cm.cid||'',vid:v.id,text:'',ts:(v.ts||Date.now())+ci*6e4+3e4,seen:false});added++;}});});
  if(d.acts.length>200)d.acts=d.acts.slice(0,200);
  return added>0;}
function dyActRows(tab){dyInit();const all=(S.dy.acts||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
  return tab==='评论与弹幕'?all.filter(x=>x.kind==='comment'):all.filter(x=>x.kind!=='comment');}
function dyActUnseen(tab){return dyActRows(tab).filter(x=>!x.seen).length;}
function dyOpenActs(tab){if(dyActSync())save(0);_dyActTab=['赞与其他','评论与弹幕','群通知'].includes(tab)?tab:'赞与其他';_dyActOnly='全部';_dySub='acts';
  dyActSeeTab(_dyActTab);render();}
/* 群通知的红点也按「看没看过」算——待审批的申请仍然留在列表里等你处理，
   只是不再一直顶着一个红点。 */
function dyActSeeTab(tab){dyMarkAllSeen('act:'+tab,dyActRows(tab));
  if(tab==='群通知')dyMarkAllSeen('apply',dyApplies());}
function dyActSetTab(t){_dyActTab=t;dyActSeeTab(t);render();}
function dyActVerb(x){return x.kind==='comment'?'评论了你的作品':x.kind==='rec'?'推荐了你的作品':'赞了你的作品';}
function dyActThumb(vid){const v=dyVid(vid);if(!v)return '<div class="dyact-thumb"></div>';
  return `<div class="dyact-thumb" onclick="event.stopPropagation();dyOpenWork('${esc(vid)}')" style="background:${v.grad||DY_GRADS[0]}">${esc(v.emoji||'🎬')}</div>`;}
function dyActRow(x){const fan=(S.dy.fans||[]).some(f=>f.k===(x.cid?'c:'+x.cid:'n:'+x.name));
  const badge=x.kind==='comment'?'':`<i class="dyact-badge ${x.kind==='rec'?'rec':''}">${svgIc(x.kind==='rec'?'check':'heart',12,'#fff',x.kind==='rec'?2.6:0)}</i>`;
  return `<div class="dyact-row" onclick="dyOpenWork('${esc(x.vid)}')"><i class="dyvi-dot${x.seen?' off':''}"></i>
    <div class="dyact-av">${dyFace(dyRA(x.cid,x.avatar),'sm')}${badge}</div>
    <div class="dyact-main"><div class="dyact-name">${esc(x.name)}${x.cid?'<em class="dyact-tag">角色</em>':fan?'<em class="dyact-tag">粉丝</em>':''}</div>
      <div class="dyact-say">${x.kind==='comment'?dyHash(x.text):esc(dyActVerb(x))} <span>${esc(dyTimeAgo(x.ts))}</span></div></div>
    ${dyActThumb(x.vid)}</div>`;}
function dyActsView(){const tabs=['赞与其他','评论与弹幕','群通知'],n=dyActUnseen('评论与弹幕');
  const body=_dyActTab==='群通知'?dyGroupNoticeBody():(()=>{const rows=dyActRows(_dyActTab);
    return rows.length?rows.map(dyActRow).join(''):`<div class="dyvi-empty">${_dyActTab==='评论与弹幕'?'还没有人评论你的作品～':'还没有人赞过你的作品～'}<br>发一条，或者去评论区点「✨ 生成网友评论」。</div>`;})();
  return `<div class="dyvi">
    <div class="dyvi-nav dy-safe-nav2"><i onclick="dySubClose()">‹</i>${dyActUnseen('赞与其他')+n?`<em class="dyfan-count">${Math.min(99,dyActUnseen('赞与其他')+n)}</em>`:''}<b>互动消息</b><em style="width:21px"></em></div>
    <div class="dyact-tabs">${tabs.map(t=>`<span class="${_dyActTab===t?'on':''}" onclick="dyActSetTab('${t}')">${t}${t==='评论与弹幕'&&n?`<b>${n>99?'99+':n}</b>`:''}${t==='群通知'?' ▾':''}</span>`).join('')}</div>
    ${_dyActTab==='群通知'?`<div class="dyh-chips" style="padding:10px 16px"><span class="${_dyActOnly==='全部'?'on':''}" onclick="dyActSetOnly('全部')">全部</span><span class="${_dyActOnly==='待审批'?'on':''}" onclick="dyActSetOnly('待审批')">待审批</span><b class="dyact-multi" onclick="toast('多选还没做～')">多选</b></div>`:''}
    <div class="dyvi-list" data-render-scroll-key="dy:acts:${esc(_dyActTab)}">${body}</div>
  </div>`;}
function dyActSetOnly(v){_dyActOnly=v;render();}
/* ===== 消息主页 ===== */
function dyDMUnread(d){return Math.max(0,+((d||{}).unread)||0);}
function dyDMPreview(d){const last=(d.msgs||[])[d.msgs.length-1];if(!last)return '打个招呼吧～';
  return (last.from==='me'?'我：':'')+String(last.text||'').replace(/\s+/g,' ').slice(0,40);}
function dyPreviewHTML(t){return esc(String(t||'')).replace(/^(\[[^\]]{1,8}\])/,'<b class="dymsg-hl">$1</b>');}
function dyDMSpark(d){if(!d||!d.cid)return 0;return dySparkTick(d);}
function dyMsgEntry(key,label,count,act,inner){return `<div class="dymsg-ent" onclick="${act}"><div class="dymsg-ico ${key}">${inner}${count?`<b class="dymsg-badge">${count>99?'99+':count}</b>`:''}</div><span>${esc(label)}</span></div>`;}
function dyDMRows(){dyInit();const ds=(S.dy.dms||[]).slice();
  return ds.sort((a,b)=>{const la=(a.msgs||[])[a.msgs.length-1],lb=(b.msgs||[])[b.msgs.length-1];return ((lb&&lb.time)||0)-((la&&la.time)||0);});}
function dyDMRow(d){const spark=dyDMSpark(d),un=dyDMUnread(d),last=(d.msgs||[])[d.msgs.length-1];
  return `<div class="dymsg-row" onclick="go('dydm',{id:'${d.id}'})"><span class="dymsg-face" onclick="event.stopPropagation();dyOpenDMUser('${d.id}')">${dyFace(dyRA(d.cid,d.avatar),'sm')}</span>
    <div class="dymsg-main"><div class="dymsg-top"><span class="dymsg-name">${esc(d.name)}</span>${spark?`<em class="dymsg-spark">🔥${spark}</em>`:''}${d.mute?`<i class="dymsg-mute">${svgIc('mute',14,'#6c6c74',2)}</i>`:''}<span class="dymsg-time">${esc(dyListTime(last&&last.time))}</span></div>
    <div class="dymsg-sub"><span>${dyPreviewHTML(dyDMPreview(d))}</span>${un?`<b class="dymsg-un">${un>99?'99+':un}</b>`:''}</div></div></div>`;}
/* 真实抖音把没互关的陌生人收进一个「陌生人消息」文件夹，不让他们挤在角色前面。 */
function dyStrangerRows(){dyInit();return dyDMRows().filter(d=>!d.cid);}
function dyStrangerUnread(){return dyStrangerRows().reduce((n,d)=>n+dyDMUnread(d),0);}
function dyOpenStrangers(){_dySub='strangers';render();}
function dyStrangerFolderRow(){const rows=dyStrangerRows();if(!rows.length)return '';
  const last=(rows[0].msgs||[])[rows[0].msgs.length-1],un=dyStrangerUnread();
  return `<div class="dymsg-row" onclick="dyOpenStrangers()"><div class="dymsg-fold">${dyFace(rows[0].avatar,'sm')}<i>${rows.length}</i></div>
    <div class="dymsg-main"><div class="dymsg-top"><span class="dymsg-name">陌生人消息</span><span class="dymsg-time">${esc(dyListTime(last&&last.time))}</span></div>
    <div class="dymsg-sub"><span>${esc(rows[0].name)}：${esc(dyDMPreview(rows[0]).replace(/^我：/,''))}</span>${un?`<b class="dymsg-un">${un>99?'99+':un}</b>`:''}</div></div></div>`;}
function dyStrangersView(){const rows=dyStrangerRows();
  return `<div class="dyvi">
    <div class="dyvi-nav dy-safe-nav2"><i onclick="dySubClose()">‹</i><b>陌生人消息</b><em onclick="dyGenDMs()">${svgIc('refresh',20,'#f2f2f4',2)}</em></div>
    <div class="dyvi-tip">没有互关的人发来的私信都收在这里</div>
    <div class="dyvi-list" data-render-scroll-key="dy:strangers">${rows.length?rows.map(dyDMRow).join(''):'<div class="dyvi-empty">还没有陌生人来私信～</div>'}</div>
  </div>`;}
function dyMsgNew(){openModal(`<h3>发起</h3><div class="btns" style="flex-direction:column;gap:8px">
  <button class="dybtn out" onclick="closeModal();dyGroupCreate()">建一个群聊</button>
  <button class="dybtn out" onclick="closeModal();dyDMPick()">给角色发私信</button>
  <button class="btn g" onclick="closeModal()">取消</button></div>`);}
function dyGroupRowsHTML(){return dyGroups().slice().sort((a,b)=>((b.top?1:0)-(a.top?1:0))||((dyGMsgs(b)[dyGMsgs(b).length-1]||{}).time||0)-((dyGMsgs(a)[dyGMsgs(a).length-1]||{}).time||0)).map(g=>{
  const last=dyGMsgs(g)[dyGMsgs(g).length-1],un=Math.max(0,+g.unread||0);
  return `<div class="dymsg-row" onclick="dyOpenGroup('${g.id}')">${av(g.avatar||'\u{1F465}','sm')}
    <div class="dymsg-main"><div class="dymsg-top"><span class="dymsg-name">${esc(g.name)}</span><em class="dymsg-gtag">${g.open?'公开群':'私密群'}</em>${g.mute?`<i class="dymsg-mute">${svgIc('mute',14,'#6c6c74',2)}</i>`:''}<span class="dymsg-time">${esc(dyListTime(last&&last.time))}</span></div>
    <div class="dymsg-sub"><span>${dyPreviewHTML(dyGroupPreview(g))}</span>${un&&!g.mute?`<b class="dymsg-un">${un>99?'99+':un}</b>`:un?'<b class="dymsg-dot"></b>':''}</div></div></div>`;}).join('');}
function dyDMList(){dyInit();dyFanSync();dyActSync();
  const rows=dyDMRows(),me=dyAvatar(),fol=(S.dy.following||[]).map(getC).filter(Boolean).slice(0,6);
  const daily=`<div class="dymsg-ent"><div class="dymsg-ico daily" onclick="dyCompose()">${av(me,'sm')}<b class="dymsg-plus">＋</b></div><span>限时日常</span></div>`
    +fol.map(c=>`<div class="dymsg-ent" onclick="openDyDMName('${esc((c.remark||c.name).replace(/'/g,"\\'"))}','${c.id}','')"><div class="dymsg-ico plain">${av(dyRA(c.id,c.avatar),'sm')}</div><span>${esc(c.remark||c.name)}</span></div>`).join('');
  return `<div class="dymsg">
    <div class="dymsg-nav dy-safe-nav2"><i onclick="dyGenDMs()">${svgIc('refresh',22,'#f2f2f4',2)}</i><i onclick="dyMsgNew()">${svgIc('edit',21,'#f2f2f4',2)}</i><b>消息</b><i onclick="dyOpenMeSearch()">${svgIc('search',22,'#f2f2f4',2)}</i><i onclick="dyDMPick()">${svgIc('chat',22,'#f2f2f4',2)}</i></div>
    <div class="dymsg-ents">
      ${dyMsgEntry('fans','粉丝',dyFanUnseen(),"dyOpenFans()",svgIc('users',26,'#fff',2))}
      ${dyMsgEntry('likes','赞与其他',dyActUnseen('赞与其他'),"dyOpenActs('赞与其他')",svgIc('heart',26,'#fff',0))}
      ${dyMsgEntry('cmts','评论弹幕',dyActUnseen('评论与弹幕'),"dyOpenActs('评论与弹幕')",svgIc('chat',26,'#fff',2))}
      ${dyMsgEntry('grp','群通知',dyApplyUnseen(),"dyOpenActs('群通知')",svgIc('check',26,'#fff',2.6))}
      ${daily}
    </div>
    <div class="dymsg-list" data-render-scroll-key="dy:dms">${(rows.length||dyGroups().length)?dyGroupRowsHTML()+dyStrangerFolderRow()+rows.filter(d=>d.cid).map(dyDMRow).join(''):'<div class="dyvi-empty">还没有私信～<br>点右上角的 ✎ 找个角色聊聊。</div>'}</div>
  </div>`;}
/* ===== 和角色的私聊 ===== */
/* 火花挂在顶部名字旁边，像真实抖音那样：🔥7。点一下才说清今天续没续上。 */
function dySparkBadge(d){if(!d||!d.cid)return '';const n=dyDMSpark(d);if(!n)return '';
  const done=dySparkState(d).day===dySparkDayKey();
  return `<em class="dydm-spark-badge${done?' on':''}" onclick="dySparkTip('${d.id}')">🔥${n}</em>`;}
function dySparkTip(id){const d=(S.dy.dms||[]).find(x=>x.id===id);if(!d)return;
  const n=dyDMSpark(d),done=dySparkState(d).day===dySparkDayKey();
  toast(done?('火花 '+n+' 天 · 今天已经续上了'):('火花 '+n+' 天 · 今天还没续，你和他各发一条就 +1'));}
/* ===== 抖音输入栏：表情、表情包、语音，全都用微信那一套 =====
   表情包直接读 S.me.stickers（跟微信同一份），语音是「打字发出来变成语音条」，
   跟微信的做法一致，不录音。 */
let _dyPanel={},_dyVoice={};
function dyCompKey(scope,id){return scope+':'+id;}
function dyPanelOpen(scope,id){return _dyPanel[dyCompKey(scope,id)]||'';}
function dyPanelToggle(scope,id,page){const k=dyCompKey(scope,id);
  _dyPanel[k]=_dyPanel[k]===page?'':page;render();}
function dyPanelClose(scope,id){delete _dyPanel[dyCompKey(scope,id)];}
function dyVoiceOn(scope,id){return !!_dyVoice[dyCompKey(scope,id)];}
function dyVoiceToggle(scope,id){const k=dyCompKey(scope,id);_dyVoice[k]=!_dyVoice[k];render();
  toast(_dyVoice[k]?'打字发出来会变成语音条':'回到文字消息');}
function dyEmojiPanelHTML(scope,id){const open=dyPanelOpen(scope,id);if(!open)return '';
  const stk=S.me.stickers||[],inputId=scope==='g'?'dyg_in':'dydm_in';
  const body=open==='stk'
    ?`<div class="dycp-stk">${stk.length?stk.map((s,i)=>`<div class="dycp-s" onclick="dySendSticker('${scope}','${id}',${i})">${stickerImageHTML(s.img)}</div>`).join(''):'<div class="dycp-empty">还没有表情包～去 设置 → 角色的表情包 里添加，这边和微信共用一份。</div>'}</div>`
    :`<div class="dycp-emo">${EMOJIS.map(e=>`<span onclick="dyPutEmoji('${inputId}','${esc(e)}')">${e}</span>`).join('')}</div>`;
  return `<div class="dycp">
    <div class="dycp-tabs"><span class="${open==='emo'?'on':''}" onclick="dyPanelToggle('${scope}','${id}','emo')">表情</span><span class="${open==='stk'?'on':''}" onclick="dyPanelToggle('${scope}','${id}','stk')">表情包</span></div>
    ${body}</div>`;}
