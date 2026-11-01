/* 转发：微信、抖音私信、抖音群聊都能选 */
/* 右边栏第五格照她给的真抖音截图换回「转发」，原来「···更多」里的事情
   全挪进这张单子的下半截——转发在上、这条作品的操作在下，一样都没少。 */
function dyFwd(id){const v=dyVid(id);if(!v)return;window._fwDy=v;const mine=v.cid==='me';
  openModal(`<h3>转发这条作品</h3><div class="btns" style="flex-direction:column;gap:8px">
    <button class="dybtn out" onclick="closeModal();dyFwdPick('wx')">转发到微信</button>
    <button class="dybtn out" onclick="closeModal();dyFwdPick('dm')">转发到抖音私信</button>
    <button class="dybtn out" onclick="closeModal();dyFwdPick('g')">转发到抖音群聊</button>
    <div class="hint" style="margin:6px 0 0;text-align:left">这条作品</div>
    <button class="dybtn out" onclick="closeModal();dyGenComments('${id}')">✨ 生成网友评论</button>
    ${v.img?`<button class="dybtn out" onclick="closeModal();dyWorkDescEdit('${id}')">${v.imgDesc?'改画面描述':'补一句画面描述'}</button>`:''}
    ${mine?`<button class="dybtn out" onclick="closeModal();dyWorkTopToggle('${id}')">${v.top?'取消置顶':'置顶作品'}</button><button class="dybtn out" onclick="dyTogglePrivate('${id}')">${v.priv?'取消私密':'设为私密 🔒'}</button>`:`<button class="dybtn out" onclick="closeModal();dyTapVideo('${id}')">📖 看画面描写</button>`}
    ${/* 她说「我无法删除他的作品」——原来删除只给自己的作品留了入口。
         这是她的手机，刷到谁的都该能从自己这儿删掉。 */''}
    <button class="btn d" onclick="${mine?`dyWorkDelete('${id}')`:`closeModal();dyDelVideo('${id}')`}">删除作品</button>
    <button class="btn g" onclick="closeModal()">取消</button></div>`);}
function dyFwdPick(where){const v=window._fwDy;if(!v)return;
  if(where==='wx'){const cs=(S.contacts||[]).filter(c=>c&&!c.deleted);
    if(!cs.length)return toast('先创建角色');
    if(cs.length===1)return doDyFwd(cs[0].id);
    return openModal(`<h3>转发给</h3><div style="max-height:46vh;overflow:auto">${cs.map(c=>`<div class="row dymu-row" onclick="doDyFwd('${c.id}')"><b style="flex:1;font-size:14px">${esc(c.remark||c.name)}</b><span style="color:#888">›</span></div>`).join('')}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
  if(where==='dm'){const ds=(S.dy.dms||[]);
    if(!ds.length)return toast('还没有私信，先去找个人聊');
    return openModal(`<h3>转发到私信</h3><div style="max-height:46vh;overflow:auto">${ds.map(d=>`<div class="row dymu-row" onclick="dyFwdTo('d','${d.id}')"><b style="flex:1;font-size:14px">${esc(d.name)}</b><span style="color:#888">›</span></div>`).join('')}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
  const gs=dyGroups();
  if(!gs.length)return toast('还没有群聊');
  openModal(`<h3>转发到群聊</h3><div style="max-height:46vh;overflow:auto">${gs.map(g=>`<div class="row dymu-row" onclick="dyFwdTo('g','${g.id}')"><b style="flex:1;font-size:14px">${esc(g.name)}</b><span style="color:#888">${dyGCount(g)} 人</span></div>`).join('')}</div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function dyFwdCount(v){if(!v)return;v.fw=(+v.fw||0)+1;
  const f=(S.dy.feed||[]).find(x=>x.id===v.id);if(f&&f!==v)f.fw=v.fw;
  const m=(S.dy.mine||[]).find(x=>x.id===v.id);if(m&&m!==v)m.fw=v.fw;save();}
function dyFwdTo(scope,id){const v=window._fwDy;if(!v)return;
  const card=dyWorkCardMsg(v);dyFwdCount(v);
  if(scope==='g'){const g=dyGroup(id);if(!g)return;
    if(dyGMeMuted(g))return toast('你被禁言了，发不出去');
    dyGMsgs(g).push(Object.assign({id:uid(),k:'me',time:Date.now()},card));
    save();closeModal();toast('已转发到群聊');dyOpenGroup(id);
    dyGroupReply(id,'[转发了一条抖音作品：'+(v.desc||v.body||'').slice(0,40)+']');return;}
  const d=(S.dy.dms||[]).find(x=>x.id===id);if(!d)return;
  d.msgs.push(Object.assign({from:'me',time:Date.now(),id:uid()},card));
  dySparkTick(d);save();closeModal();toast('已转发到私信');go('dydm',{id:d.id});dyDMReply(d);}
function doDyFwd(cid){const v=window._fwDy;if(!v)return;pushMsg(cid,{role:'user',type:'dycard',author:v.cid==='me'?dyNick():v.author,desc:v.desc,narration:v.narration,emoji:v.emoji,mine:v.cid==='me',id:uid()});dyFwdCount(v);closeModal();toast('已转发到微信');scheduleReply(cid);}
/* 发抖音 */
/* ===== 发作品：文字卡片 / 拍摄或相册 =====
   图是真的存下来的，角色评论前会先真的看一眼（走设置里的视觉模型）；
   没配视觉模型就让她自己写一句画面，绝不让模型假装看过。 */
let _dyPostTab='camera',_dyPostStage='make';
const DY_CARD_BG=[['夜','linear-gradient(160deg,#2b2f3a,#12141a 60%,#0a0b0f)'],['暮','linear-gradient(160deg,#4a3b46,#241c26 60%,#120e14)'],
  ['海','linear-gradient(160deg,#25404e,#12232c 60%,#0a1319)'],['林','linear-gradient(160deg,#2c4034,#16241b 60%,#0b120e)'],
  ['砂','linear-gradient(160deg,#4a4038,#26201b 60%,#14100d)'],['霞','linear-gradient(160deg,#4e3340,#2a1a24 60%,#150d12)'],
  ['雪','linear-gradient(160deg,#e9ecf1,#c9d0da 60%,#aeb7c4)'],['纸','linear-gradient(160deg,#f5efe4,#e3dac9 60%,#cdc2ad)']];
const DY_CARD_FG=[['白','#f4f4f6'],['米','#efe6d6'],['橙','#ff9f68'],['粉','#ff9db8'],['青','#8fd6cf'],['墨','#20222a']];
let _dyPost=null;
function dyCompose(){_dyPost=null;_dyPostTab='camera';_dyPostStage='make';dyPostOpen('camera');}
function dyPostOpen(tab){_dyPost=_dyPost&&_dyPost.kind?_dyPost:{kind:'text',bg:0,fg:0,card:'',desc:'',at:[],songId:'',music:''};
  _dyPostTab=tab||'camera';_dyPostStage='make';
  try{closeModal();}catch(_){}
  if(cur().p==='dypost')return render();
  go('dypost',{});}
function dyPostClose(){_dyPost=null;_dyPostStage='make';back();}
function dyPostSetTab(t){const el=$('#dyp_card');if(el&&_dyPost)_dyPost.card=el.value;
  _dyPostTab=t;if(t==='text'&&_dyPost)_dyPost.kind='text';render();}
function renderDyPost(){const p=_dyPost||{};
  if(_dyPostStage==='publish')return dyPostPublishPage();
  return _dyPostTab==='text'?dyPostTextPage():dyPostCameraPage();}
/* —— 相机页 —— */
function dyPostCameraPage(){const p=_dyPost||{};
  return `<div class="dypg">
    <div class="dypg-top dy-safe-nav2">
      <i onclick="dyPostClose()">✕</i>
      <span class="dypg-music" onclick="dyPostMusicPick()">♫ ${p.music?esc(p.music):'选择音乐'}</span>
      <em></em>
    </div>
    <div class="dypg-stage">${p.kind==='img'&&p.src
      ?`<img class="dypg-shot" src="${storedImageDisplaySource(p.src)}" alt="">`
      :`<div class="dypg-hint">${svgIc('camera',46,'#4a4a52',1.6)}<span>点下面的白圈拍一张<br>或者从相册里选</span></div>`}</div>
    <div class="dypg-shutter">
      <span class="dypg-side" onclick="dyPostAlbum()">${svgIc('image',26,'#f2f2f4',1.8)}<small>相册</small></span>
      <button class="dypg-snap" onclick="dyPostShoot()"><i></i></button>
      <span class="dypg-side ${p.kind==='img'&&p.src?'on':''}" onclick="dyPostNext()">${svgIc('forward',26,p.kind==='img'&&p.src?'#fe2c55':'#4a4a52',2)}<small>下一步</small></span>
    </div>
    <div class="dypg-tabs dy-safe-bar"><span onclick="dyPostSetTab('text')">文字</span><span class="on">相机</span></div>
  </div>`;}
/* —— 写文字页 —— */
function dyPostTextPage(){const p=_dyPost||{};
  return `<div class="dypg">
    <div class="dypg-top dy-safe-nav2">
      <i onclick="dyPostClose()">‹</i>
      <span class="dypg-title">写文字</span>
      <em class="dypg-next ${String(p.card||'').trim()?'on':''}" onclick="dyPostNext()">下一步</em>
    </div>
    <div class="dypg-card" style="background:${DY_CARD_BG[p.bg||0][1]};color:${DY_CARD_FG[p.fg||0][1]}">
      <b class="dypg-quote">“</b>
      <textarea id="dyp_card" maxlength="200" placeholder="分享你的想法" oninput="dyPostCardLive(this.value)" style="color:${DY_CARD_FG[p.fg||0][1]}">${esc(p.card||'')}</textarea>
    </div>
    <div class="dypg-pal">
      <div class="dysw">${DY_CARD_BG.map((b,i)=>`<i class="${i===(p.bg||0)?'on':''}" style="background:${b[1]}" onclick="dyPostPick('bg',${i})"></i>`).join('')}</div>
      <div class="dysw sm">${DY_CARD_FG.map((f,i)=>`<i class="${i===(p.fg||0)?'on':''}" style="background:${f[1]}" onclick="dyPostPick('fg',${i})"></i>`).join('')}</div>
    </div>
    <div class="dypg-tool"><span onclick="dyPostMusicPick()">♫</span><span onclick="dyPostPutTag('#')">#</span><span onclick="dyPostPutTag('@')">@</span>
      <em>${String(p.card||'').length}/200</em></div>
    <div class="dypg-tabs dy-safe-bar"><span class="on">文字</span><span onclick="dyPostSetTab('camera')">相机</span></div>
  </div>`;}
function dyPostPutTag(ch){const el=$('#dyp_card');if(!el)return;el.value=(el.value||'')+ch;if(_dyPost)_dyPost.card=el.value;el.focus();}
/* —— 发布页 —— */
function dyPostPublishPage(){const p=_dyPost||{};const people=dyAtCandidates();
  const cover=p.kind==='img'&&p.src
    ?`<img src="${storedImageDisplaySource(p.src)}" alt="">`
    :`<div class="dypub-card" style="background:${DY_CARD_BG[p.bg||0][1]};color:${DY_CARD_FG[p.fg||0][1]}"><span>${esc(String(p.card||'').slice(0,60))}</span></div>`;
  return `<div class="dypg pub">
    <div class="dypg-top dy-safe-nav2"><i onclick="dyPostBack()">‹</i><span class="dypg-title"></span><em class="dypg-next on" onclick="dyPostPreview()">预览</em></div>
    <div class="dypub-body">
      <div class="dypub-cover">${cover}</div>
      <textarea id="dyp_title" maxlength="30" rows="1" placeholder="添加标题" oninput="dyPostFieldLive()">${esc(p.title||'')}</textarea>
      <textarea id="dyp_desc" maxlength="300" rows="4" placeholder="添加作品描述…" oninput="dyPostFieldLive()">${esc(p.desc||'')}</textarea>
      <div class="dypub-chips">
        <i onclick="dyPostPutDesc('#')"># 话题</i>
        <i onclick="dyPostAtSheet()">@ 朋友</i>
        <i class="${p.songId?'on':''}" onclick="dyPostMusicPick()">♫ ${p.music?esc(p.music):'选择音乐'}</i>
      </div>
      ${visionConfigured()||p.kind!=='img'?'':'<div class="hint" style="color:#e0a54a">你还没配视觉模型，角色看不见这张图。发布后可以在作品的「··· 更多」里自己补一句画面描述。</div>'}
      <div style="height:20px"></div>
    </div>
    <div class="dypub-bar dy-safe-bar"><span onclick="dyPostBack()">${svgIc('forward',20,'#c8c8d0',2)}<small>返回</small></span>
      <button class="dypub-go" onclick="dyPostPublish()">发作品</button></div>
  </div>`;}
function dyPostFieldLive(){const p=_dyPost;if(!p)return;
  const t=$('#dyp_title'),d=$('#dyp_desc');
  if(t)p.title=t.value;if(d)p.desc=d.value;}
function dyPostPutDesc(ch){dyPostInsertDesc(ch);}
/* @ 和 # 都插在光标那儿，写进描述正文里——她说「@ 应该出现在我输入文字的上方，
   不应该在这个下面」，指的就是这个：@ 是文案的一部分，不是底下一排小标签。 */
function dyPostInsertDesc(text){const p=_dyPost,el=$('#dyp_desc');
  if(!el){if(p)p.desc=String(p.desc||'')+text;render();return;}
  const v=el.value||'';let a=el.selectionStart,b=el.selectionEnd;
  if(a==null||b==null||a<0||b<a){a=v.length;b=v.length;}
  el.value=v.slice(0,a)+text+v.slice(b);
  const pos=a+text.length;try{el.setSelectionRange(pos,pos);}catch(_){}
  dyPostFieldLive();el.focus();}
/* 发布时按描述里真正还留着的 @ 定名单：她删掉了那几个字，就不该再算 @ 过 */
function dyPostAtSync(p){if(!p)return [];const text=String(p.title||'')+' '+String(p.desc||'');
  return (p.at||[]).filter(k=>{const q=dyPersonFind(k);return !!(q&&text.indexOf('@'+q.name)>=0);});}
function dyPostBack(){dyPostFieldLive();_dyPostStage='make';render();}
function dyPostPreview(){const p=_dyPost;if(!p)return;dyPostFieldLive();
  toast(p.kind==='img'?'这就是发出去的样子':'卡片就是这个颜色，发出去一模一样');}
function dyPostAtSheet(){dyPostFieldLive();const people=dyAtCandidates();
  if(!people.length)return toast('还没有可以 @ 的人');
  openModal(`<h3>@ 朋友</h3><div class="hint">选谁就把「@名字」写进你的作品描述里。被 @ 的人粉丝多的话，他的粉丝会来评论区看热闹。</div>
    <div class="dyat" style="padding-top:4px">${people.map(x=>`<i onclick="dyPostAt('${esc(x.k)}')">@${esc(x.name)}</i>`).join('')}</div>
    <button class="btn g" style="margin-top:10px" onclick="closeModal()">好了</button>`);}
function dyPostText(){_dyPost={kind:'text',bg:0,fg:0,card:'',desc:'',at:[],songId:'',music:''};dyPostOpen('text');}
function dyPostCardLive(v){const p=_dyPost;if(!p)return;p.card=String(v||'');const el=$('#dypv_t');if(el)el.textContent=p.card||'分享你的想法';}
function dyPostPick(what,i){const p=_dyPost;if(!p)return;const el=$('#dyp_card');if(el)p.card=el.value;p[what]=i;render();}
function dyPostShoot(){dyPostImage(true);}
function dyPostAlbum(){dyPostImage(false);}
function dyPostHasContent(p){return p&&(p.kind==='img'?!!p.src:!!String(p.card||'').trim());}
function dyPostImage(shoot){
  try{if(window._dyPickEl)window._dyPickEl.remove();}catch(_){}
  const i=document.createElement('input');i.type='file';i.accept='image/*';
  if(shoot)i.setAttribute('capture','environment');/* 手机上直接调后置摄像头拍 */
  i.style.cssText='position:fixed;left:-9999px;top:0;opacity:0;width:1px;height:1px';
  i.onchange=async()=>{const f=i.files&&i.files[0];
    setTimeout(()=>{try{i.remove();}catch(_){}},500);
    if(!f)return;
    toast('正在处理照片…');
    let src=null;try{src=await compress(f,1400,.78);}catch(_){}
    if(!src){try{src=await readAsDataURL(f);}catch(_){toast('图片读不出来，再试一次');return;}}
    const keep=_dyPost&&_dyPost.kind==='img'?_dyPost:null;
    _dyPost={kind:'img',src,desc:(keep&&keep.desc)||'',at:(keep&&keep.at)||[],songId:(keep&&keep.songId)||'',music:(keep&&keep.music)||''};
    dyPostNext();};
  document.body.appendChild(i);window._dyPickEl=i;i.click();}
function dyPostNext(){const p=_dyPost;if(!p)return;
  if(p.kind==='text'){const el=$('#dyp_card');if(el)p.card=el.value;
    if(!String(p.card||'').trim())return toast('写点什么吧');}
  if(p.kind==='img'&&!p.src)return toast('先拍一张，或者从相册选一张');
  _dyPostStage='publish';
  if(cur().p==='dypost')return render();
  dyPostOpen(p.kind==='img'?'camera':'text');}
function dyPostPublishForm(){_dyPostStage='publish';if(cur().p==='dypost')return render();dyPostOpen(_dyPost&&_dyPost.kind==='img'?'camera':'text');}
function dyAtCandidates(){dyInit();const out=[],seen=new Set();
  (S.contacts||[]).filter(c=>c&&!c.deleted).forEach(c=>{const k='c:'+c.id;if(seen.has(k))return;seen.add(k);
    out.push({k,name:c.remark||c.name});});
  (S.dy.fans||[]).forEach(x=>{if(!x||x.cid||seen.has(x.k))return;seen.add(x.k);out.push({k:x.k,name:x.name});});
  return out.slice(0,12);}
function dyPostAt(k){const p=_dyPost;if(!p)return;const q=dyPersonFind(k);if(!q)return toast('找不到这个人');
  if(typeof dyPostFieldLive==='function')dyPostFieldLive();
  closeModal();
  p.at=p.at||[];if(p.at.indexOf(k)<0)p.at.push(k);
  dyPostInsertDesc('@'+q.name+' ');
  toast('已 @ '+q.name);}
/* 发作品可以配一首你音乐库里真有的歌——不是填一行字，是真的从库里挑，
   作品页上点那张唱片就能放出来。 */
function dyMusicLib(){try{if(typeof musicInit==='function')musicInit();}catch(_){}
  return (S.music&&S.music.songs||[]).filter(s=>s&&s.id);}
/* 没封面的歌就用歌名第一个字顶上，别留一个空框 */
function dyMusicCoverHTML(s,cls){const src=s&&s.cover?storedImageDisplaySource(s.cover):'';
  return `<i class="dymu-cover${cls?' '+cls:''}"${src?` style="background-image:url(${src})"`:''}>${src?'':esc(Array.from((s&&s.title)||'音')[0]||'音')}</i>`;}
function dyPostMusicPick(){if(typeof dyPostFieldLive==='function')dyPostFieldLive();
  {const el=$('#dyp_card');if(el&&_dyPost)_dyPost.card=el.value;}
  const songs=dyMusicLib();
  if(!songs.length)return toast('音乐库里还没有歌～先去音乐里添加');
  openModal(`<h3>选音乐</h3><div class="hint">从你的音乐库里挑一首，作品页上点唱片就能放。</div>
    <div style="max-height:46vh;overflow:auto">
      ${_dyPost&&_dyPost.songId?`<div class="row dymu-row" onclick="dyPostMusicSet('')"><b style="flex:1;font-size:14px">不配音乐</b><span style="color:#888;font-size:13px">取消</span></div>`:''}
      ${/* 她说「选择的音乐图片也没有加载出来」——这张单子原来只有歌名和歌手，
           根本没画封面。歌本身是有 cover 的，音乐页早就在用。 */''}
      ${songs.map(s=>`<div class="row dymu-row" onclick="dyPostMusicSet('${esc(s.id)}')">${dyMusicCoverHTML(s)}<b style="flex:1;font-size:14px;font-weight:500">${esc(s.title||'未命名')}</b><span style="color:#888;font-size:12px">${esc(s.artist||'')}</span></div>`).join('')}
    </div><button class="btn g" style="margin-top:8px" onclick="closeModal()">返回</button>`);}
function dyPostMusicSet(sid){if(!_dyPost)return;closeModal();
  const s=sid?dyMusicLib().find(x=>x.id===sid):null;
  _dyPost.songId=s?s.id:'';_dyPost.music=s?((s.title||'未命名')+(s.artist?' · '+s.artist:'')):'';
  render();toast(s?('配乐：'+_dyPost.music):'已取消配乐');}
/* ===== 抖音配乐：每条作品底下都有一条，滑到哪条就放哪条的歌（跟真抖音一样） ===== */
function dyMusicSongOf(v){if(!v||!v.songId)return null;return dyMusicLib().find(x=>x.id===v.songId)||null;}
/* 没配歌的作品，真抖音底下也写着「@某某 创作的原声」，不会空着 */
function dyMusicLabel(v){if(v&&v.music)return String(v.music);
  return '@'+(v&&v.cid==='me'?dyNick():((v&&v.author)||'用户'))+' 创作的原声';}
function dyMusicIsOn(v){const s=dyMusicSongOf(v);return !!(s&&typeof _mCur!=='undefined'&&_mCur===s.id&&_mPlaying);}
function dyWorkMusicHTML(v){if(!v)return '';
  const s=dyMusicSongOf(v),on=dyMusicIsOn(v);
  /* 配了库里真有的歌就把封面贴出来，没配就还是那个小音符 */
  return `<div class="dymu${s?' live':''}${on?' on':''}" onclick="event.stopPropagation();dyWorkMusicPlay('${esc(v.id)}')">${s?dyMusicCoverHTML(s,'sm'):`<i>${on?'♬':'♪'}</i>`}<span>${esc(dyMusicLabel(v))}</span></div>`;}
function dyWorkMusicPlay(id){const v=dyVid(id);if(!v)return;
  if(!v.songId)return toast(v.music?'这首歌只是标注，库里没有对应的歌':'这条作品没有配乐');
  const s=dyMusicLib().find(x=>x.id===v.songId);
  if(!s)return toast('这首歌已经不在音乐库里了');
  if(typeof musicPlay!=='function')return toast('放不了，音乐模块没就绪');
  _dyGestured=true;
  if(_mCur===s.id&&_mPlaying){dyMusicPause();_dyMusicWant='';render();return toast('暂停了');}
  _dyMusicOwned=true;_dyMusicWant=s.id;_dyMusicAskAt=Date.now();
  const r=musicPlay(s.id);if(r&&r.catch)r.catch(()=>{});
  toast('正在放：'+(s.title||'这首歌'));}
let _dyMusicOwned=false,_dyMusicWant='',_dyMusicAskAt=0,_dyMusicTimer=0,_dyGestured=false;
/* 现在屏幕上正在看的是哪条作品 */
function dyCurrentWork(){let c=null;try{c=cur();}catch(_){return null;}
  if(!c)return null;
  if(c.p==='dywork')return dyVid(dyWorkCurId());
  if(c.p!=='dy')return null;
  if(_dySub==='work')return dyVid(_dyWorkId);
  if(_dySub)return null;
  if(dyTab!=='feed'&&dyTab!=='friend')return null;
  try{const box=document.getElementById('dyfeed');if(!box)return null;
    const mid=box.getBoundingClientRect().top+box.clientHeight/2;let best=null,bd=1e9;
    box.querySelectorAll('.dyvideo[data-dy-video-id]').forEach(el=>{
      const r=el.getBoundingClientRect(),d=Math.abs(r.top+r.height/2-mid);
      if(d<bd){bd=d;best=el;}});
    return best?dyVid(best.getAttribute('data-dy-video-id')):null;
  }catch(_){return null;}}
function dyMusicPause(){try{if(typeof _mWantPlay!=='undefined')_mWantPlay=false;if(_ma&&!_ma.paused)_ma.pause();}catch(_){}}
function dyMusicSoon(){clearTimeout(_dyMusicTimer);_dyMusicTimer=setTimeout(dyMusicSync,150);}
function dyMusicSync(){
  if(typeof musicPlay!=='function')return;
  let v=null;try{v=dyCurrentWork();}catch(_){}
  const s=v?dyMusicSongOf(v):null,want=s?s.id:'';
  if(!want){if(_dyMusicOwned){_dyMusicOwned=false;_dyMusicWant='';dyMusicPause();}return;}
  if(_mCur===want&&_mPlaying){_dyMusicOwned=true;_dyMusicWant=want;return;}
  if(!_dyGestured)return;/* 浏览器不许没点过就出声，等她在抖音里点一下 */
  const now=Date.now();
  if(_dyMusicWant===want&&now-_dyMusicAskAt<2600)return;/* 刚催过一次，别连着催 */
  _dyMusicWant=want;_dyMusicAskAt=now;_dyMusicOwned=true;
  try{const r=musicPlay(want,{silent:true});if(r&&r.catch)r.catch(()=>{});}catch(_){}}
try{document.addEventListener('pointerdown',()=>{_dyGestured=true;},{capture:true});
  document.addEventListener('scroll',()=>{dyMusicSoon();},{capture:true,passive:true});
  setInterval(dyMusicSoon,1100);}catch(_){}
/* ===== 双击点赞：屏幕上蹦一颗爱心，跟真抖音一样 ===== */
let _dyTapAt=0,_dyTapId='',_dyTapTimer=0;
/* openOnSingle：首页那张铺满全屏的图，轻触一下是点开作品，双击才是点赞。
   图改成铺满以后这张卡盖住了整块屏幕，它原来直接 dyOpenWork，
   所以她在首页双击想点赞，结果被带进了作品详情页。 */
function dyCardTap(id,ev,openOnSingle){const now=Date.now();
  if(_dyTapId===id&&now-_dyTapAt<300){clearTimeout(_dyTapTimer);_dyTapAt=0;_dyTapId='';return dyDoubleLike(id,ev);}
  _dyTapAt=now;_dyTapId=id;clearTimeout(_dyTapTimer);
  _dyTapTimer=setTimeout(()=>{_dyTapAt=0;_dyTapId='';if(openOnSingle)dyOpenWork(id);else dyTapVideo(id);},300);}
function dyDoubleLike(id,ev){const v=dyVid(id);if(!v)return;
  dyHeartBurst(ev);
  if(!v.liked)dyLike(id);/* 真抖音双击只点亮，再双击不会取消 */}
function dyHeartBurst(ev){try{
  const t=ev&&ev.touches&&ev.touches[0],ct=ev&&ev.changedTouches&&ev.changedTouches[0];
  const x=(ev&&ev.clientX)||(t&&t.clientX)||(ct&&ct.clientX)||(window.innerWidth/2);
  const y=(ev&&ev.clientY)||(t&&t.clientY)||(ct&&ct.clientY)||(window.innerHeight/2);
  const d=document.createElement('div');d.className='dyheart';
  d.style.left=x+'px';d.style.top=y+'px';
  d.style.setProperty('--dyrot',(Math.random()*44-22)+'deg');
  d.innerHTML=svgIcFill('heart',98,'#f5243d',1.2);
  document.body.appendChild(d);
  setTimeout(()=>{try{d.remove();}catch(_){}},1000);
}catch(_){}}
function dyPostPublish(){const p=_dyPost;if(!p)return;
  if(typeof dyPostFieldLive==='function')dyPostFieldLive();
  p.desc=String(p.desc||'').trim();p.title=String(p.title||'').trim();
  if(!dyPostHasContent(p))return toast(p.kind==='img'?'还没有照片':'写点什么吧');
  dyInit();const id=uid(),at=dyPostAtSync(p);
  const v={id,cid:'me',author:dyNick(),avatar:dyAvatar(),desc:[p.title,p.desc].filter(Boolean).join(' ').trim()||'',body:p.kind==='text'?p.card:'',title:p.title||'',
    narration:'',lk:0,st:0,ts:Date.now(),comments:[],at,
    grad:p.kind==='text'?DY_CARD_BG[p.bg][1]:'',cardFg:p.kind==='text'?DY_CARD_FG[p.fg][1]:'',
    music:p.music||'',songId:p.songId||'',
    img:p.kind==='img'?p.src:'',imgDesc:'',visionState:p.kind==='img'?(visionConfigured()?'pending':'off'):''};
  S.dy.mine.unshift(v);S.dy.feed.unshift(v);save();closeModal();_dyPost=null;_dyPostStage='make';
  try{while(cur().p==='dypost')back();}catch(_){}
  dyTab='me';_dySub='';render();
  const gained=typeof dyWorkSettle==='function'?dyWorkSettle(v):0;
  toast(gained?('发布成功，涨了 '+gained+' 个粉丝'):'发布成功');
  if(v.img&&visionConfigured())dyPostVision(id);
  else setTimeout(()=>dyPostAfter(id),600);}
/* 先真的看一眼这张图，再让角色评论——看不见就不评论，不许瞎编 */
function dyPostVision(id){const v=dyVid(id);if(!v||!v.img)return;
  visionAPI(storedImageDisplaySource(v.img),'用一段中文客观描述这张照片里有什么：人物、动作、表情、穿着、场景、光线、氛围。只写看得见的，不要猜测也不要评价。')
    .then(d=>{const w=dyVid(id);if(!w)return;w.imgDesc=String(d||'').slice(0,400);w.visionState='success';save();dyPostAfter(id);})
    .catch(e=>{const w=dyVid(id);if(!w)return;w.visionState='fail';w.visionError=String(e&&e.message||'').slice(0,80);save();
      toast('这张图没看成：'+(w.visionError||'未知原因')+'，可以自己补一句画面描述');dyPostAfter(id);});}
/* 没配视觉模型、或者那张图没看成，她可以自己补一句画面，角色就按这句来评论。 */
function dyWorkDescEdit(id){const v=dyVid(id);if(!v||!v.img)return;
  openModal(`<h3>这张图里是什么</h3><div class="hint">${visionConfigured()?'角色看图失败时可以自己补一句。':'你还没配视觉模型，角色看不见图。写一句在这儿，他们就按这句来评论。'}</div>
    <div class="field"><textarea id="dyp_imgd" rows="3" maxlength="300" placeholder="例如：夜里的江边，我穿红裙子背对着镜头">${esc(v.imgDesc||'')}</textarea></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dyWorkDescSave('${id}')">保存</button></div>`);}
function dyWorkDescSave(id){const v=dyVid(id),el=$('#dyp_imgd');if(!v)return;
  v.imgDesc=String(el?el.value:'').trim().slice(0,300);v.visionState=v.imgDesc?'manual':(v.visionState||'off');
  save();closeModal();render();toast(v.imgDesc?'记下了，角色会按这句来看':'已清空');}
function dyWorkSceneText(v){if(!v)return '';
  if(v.img)return v.imgDesc?('她发的是一张照片，画面是：'+v.imgDesc):'她发的是一张照片，但你看不到画面内容——不要编造图里有什么，只能就文案本身说话。';
  return v.body?('她发的是一张文字卡片，上面写着：'+v.body):'';}
/* 被 @ 的人粉丝多，他的粉丝会过来看热闹，猜这两个人什么关系 */
function dyAtFanThreshold(){return 500;}
async function dyPostAfter(id){const v=dyVid(id);if(!v)return;
  try{await dyGenComments(v);}catch(_){}
  for(const k of (v.at||[])){
    const p=dyPersonFind(k);if(!p)continue;
    const fans=dyPersonStat(p,'fan',20,900);
    if(fans<dyAtFanThreshold())continue;
    try{await dyAtFansShow(v,p,fans);}catch(e){dyModelFail('粉丝来捧场',e);}}
  if(cur().p==='dy'||_dySub==='work')render();}
async function dyAtFansShow(v,p,fans){
  const n=1+Math.floor(Math.random()*3);
  const rows=await dyAuxGen([{role:'system',content:'你在写抖音评论区。'+dyNick()+'发了一条作品，@ 了「'+p.name+'」，这个人有 '+dyNum(fans)+' 粉丝。'
      +'现在他的粉丝闻讯赶来围观，一边捧场一边猜这两个人什么关系（是不是在一起了、是不是姐弟、是不是合作），语气要有那种磕到了的兴奋劲，也可以有酸的。'
      +'\n作品文案：'+(v.desc||'（没写文案）')+'\n'+dyWorkSceneText(v)
      +'\n\n写 '+n+' 条不同网友的评论，每行一条，格式「昵称：评论」。口语、短、有网感，别带方括号，别写编号。'},
    {role:'user',content:'开始。'}],{max:220},r=>{
      const out=[];String(cleanReply(r)||'').split(/\n+/).forEach(line=>{
        const t=line.replace(/^[\d.、\-\s]*/,'').trim();if(!t)return;
        const m=t.match(/^([^：:]{1,16})[：:]\s*(.+)$/);if(!m)return;
        out.push({name:m[1].trim(),text:m[2].trim().slice(0,60)});});
      return out.length?out:null;},2);
  const w=dyVid(v.id);if(!w)return;
  rows.forEach(r=>{w.comments.push({name:r.name,avatar:'',text:r.text,lk:Math.floor(Math.random()*40),d:dyToday(),fromAt:p.k});});
  save();}
function dyCommentResponder(v){const alive=c=>c&&!c.deleted&&!c.blocked;
  const lover=S.couple&&S.couple.cid?getC(S.couple.cid):null;
  if(v&&v.cid&&v.cid!=='me'){const owner=getC(v.cid);if(alive(owner))return [owner];}
  if(alive(lover))return [lover];
  const fol=(S.dy.following||[]).map(getC).filter(alive);
  if(fol.length)return [fol[Math.floor(Math.random()*fol.length)]];
  const any=(S.contacts||[]).filter(alive);
  return any.length?[any[0]]:[];}
async function dyCharReplyComment(v,c,t,toName){try{dyTypingOn('cm:'+v.id);const r=await dyAuxChat([{role:'system',content:buildSystem(c)},{role:'user',content:(toName||S.me.name)+'在抖音作品"'+(v.desc||'')+'"下评论/@了你："'+t+'"。'+dyWorkSceneText(v)+'，回ta一句（口语，别带方括号，不要自己写@，系统会替你加上）。'}],{max:120});
  const said=cleanReply(r).replace(/^@\S+\s*/,'').slice(0,50);if(!said)return;
  /* 回谁就先 @ 谁，评论区里才看得出这句是接着哪一条说的。 */
  v.comments.push({name:c.remark||c.name,avatar:c.avatar,cid:c.id,text:'@'+(toName||S.me.name)+' '+said,lk:0,d:dyToday()});save();dyCmRefresh(v);}catch(e){dyModelFail('角色回评论',e);}finally{dyTypingOff('cm:'+v.id);}}
function dyGenComments(id){const v=dyVid(id);if(!v)return;aiLoad('正在生成评论…');dyGenCommentsCore(v,{net:3+Math.floor(Math.random()*6),chars:1+Math.floor(Math.random()*2),mine:v.cid==='me'}).then(()=>dyCmRefresh(v)).finally(aiDone);}
async function dyGenCommentsCore(v,opts){opts=opts||{};v.comments=v.comments||[];
  try{const r=await dyAuxChat([{role:'system',content:'你是抖音评论区生成器。针对一条短视频生成'+(opts.net||5)+'条不同网友的简短评论（搞笑/共鸣/夸赞/玩梗/抬杠都行，符合抖音风格，'+(opts.mine?'这是个漂亮女生发的，可以有夸她好看、搭讪的':'')+'）。每行一条，格式：昵称:::评论内容。不要别的话。'},{role:'user',content:'作品文案："'+(v.desc||'')+'"\n'+(dyWorkSceneText(v)||('画面："'+(v.narration||'')+'"'))}],{max:700});
    (r||'').split('\n').map(l=>l.trim()).filter(Boolean).forEach(l=>{const p=l.replace(/^[\d.、\-\s]+/,'').split(/:::|：：：|\|\||：|:/);const nm=clean(p[0]);if(!nm||/^http/.test(nm))return;const tx=(p.slice(1).join('：')||p[0]||'').trim();if(tx)v.comments.push({name:nm,avatar:'',text:tx.slice(0,60),lk:Math.floor(Math.random()*30),d:dyToday(),loc:DY_LOCS[Math.floor(Math.random()*DY_LOCS.length)]});});save();dyCmRefresh(v);
  }catch(e){dyModelFail('生成网友评论',e);}
  // 关注的角色（及恋人）也来评论
  let cs=S.contacts.filter(c=>!c.deleted&&!c.blocked&&S.dy.following.includes(c.id));
  if(opts.mine&&S.couple&&S.couple.cid){const lover=getC(S.couple.cid);if(lover&&!lover.blocked&&!cs.find(x=>x.id===lover.id))cs.unshift(lover);}
  for(const c of cs.slice(0,opts.chars||2)){try{const rr=await dyAuxChat([{role:'system',content:buildSystem(c)},{role:'user',content:'你在抖音刷到'+(opts.mine?S.me.name+'（你恋人）':'一个人')+'发的作品，文案："'+(v.desc||'')+'"。'+(dyWorkSceneText(v)||('画面："'+(v.narration||'')+'"'))+'。以你的身份评论一句'+(opts.mine?'（可以宠溺/吃醋/占有欲，毕竟是你对象发的）':'')+'（口语，别带方括号）。'}],{max:120});
    v.comments.push({name:c.remark||c.name,avatar:c.avatar,cid:c.id,text:cleanReply(rr).slice(0,50),lk:0,d:dyToday()});save();dyCmRefresh(v);}catch(e){}}}
/* 关注 */
function dyFollowList(){const fl=S.dy.following.map(getC).filter(Boolean);
  openModal(`<h3>我的关注（${fl.length}）</h3><div style="max-height:60vh;overflow:auto">
    ${fl.length?fl.map(c=>`<div class="section"><div class="it">${av(c.avatar,'sm')}<div class="meta" style="flex:1"><div class="n">${esc(c.remark||c.name)}</div><div class="s">${esc(c.signature||'')}</div></div><button class="minibtn" onclick="dyGenContactVideo('${c.id}')">看TA视频</button> <button class="minibtn" onclick="dyUnfollow('${c.id}')">取关</button></div></div>`).join(''):'<div class="empty">还没关注谁</div>'}
  </div><button class="btn p" style="margin-top:8px" onclick="closeModal();dyAddFollow()">＋ 添加角色的抖音</button><button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function dyAddFollow(){const cs=S.contacts.filter(c=>!c.deleted&&!S.dy.following.includes(c.id));
  openModal(`<h3>添加角色抖音</h3>${cs.length?cs.map(c=>`<div class="section"><div class="it" onclick="dyDoFollow('${c.id}')">${esc(c.remark||c.name)}<span class="v">＋ 关注</span></div></div>`).join(''):'<div class="empty">没有可添加的角色了</div>'}<button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function dyDoFollow(cid){if(!S.dy.following.includes(cid))S.dy.following.push(cid);save();closeModal();toast('已关注，去刷TA的视频吧');dyGenContactVideo(cid);}
function dyUnfollow(cid){S.dy.following=S.dy.following.filter(x=>x!==cid);save();closeModal();render();}
async function dyGenContactVideo(cid){const c=getC(cid);if(!c)return;if(!S.dy.following.includes(cid))S.dy.following.push(cid);closeModal();aiLoad('正在生成…');
  try{const o=await dyAuxGen([{role:'system',content:buildSystem(c)},{role:'user',content:'你在抖音发了一条短视频。只输出JSON：{"desc":"文案(一句，可带#话题)","body":"正文：你在这条作品里写的话，2-3段，段与段之间空一行","narration":"旁白：这条视频里你拍了什么画面、在做什么(2-4句)","music":"配乐名","emoji":"代表画面的emoji"}'}],{max:400},parseObj);
    if(!o||!o.desc){toast('生成失败了，再点一次');return;}
    S.dy.feed.unshift({id:uid(),author:c.remark||c.name,handle:'@'+(c.name||'').replace(/\s/g,''),avatar:c.avatar,cid:cid,desc:o.desc||'',narration:o.narration||'',music:o.music||'原创音乐',emoji:(o.emoji||'🎬').slice(0,2),grad:DY_GRADS[Math.floor(Math.random()*DY_GRADS.length)],lk:Math.floor(Math.random()*5000),comments:[],ts:Date.now()});
    save();dyTab='feed';_dyMode='follow';if(cur().p==='dy')render();else go('dy');const f=$('#dyfeed');if(f)f.scrollTop=0;
  }catch(e){dyModelFail('角色发作品',e);}finally{aiDone();}}
/* 私信 */
function dyDMPick(){const cs=S.contacts.filter(c=>!c.deleted);if(!cs.length){toast('先创建角色');return;}
  openModal(`<h3>私信谁</h3>${cs.map(c=>`<div class="section"><div class="it" onclick="openDyDM('${c.id}')">${esc(c.remark||c.name)}<span class="v">›</span></div></div>`).join('')}<button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function openDyDM(cid){const c=getC(cid);if(!c)return;closeModal();openDyDMName(c.remark||c.name,cid,c.avatar);}
function openDyDMName(name,cid,avatar){let d=cid?S.dy.dms.find(x=>x.cid===cid):S.dy.dms.find(x=>!x.cid&&x.name===name);if(!d){d={id:uid(),cid:cid||null,name,avatar:avatar||'',msgs:[]};S.dy.dms.unshift(d);save();}
  try{if(cur().p==='dydm'&&cur().id===d.id)return render();}catch(_){}
  go('dydm',{id:d.id});}

const DY_STRANGER_STYLES=['慢热谨慎，话少，先聊一个具体兴趣，尊重边界','爽快直白，句子短，有好感会说但不油腻','幽默跳脱，喜欢有趣的问题，不用同款撩人套话','细心温和，关注日常小细节，提问自然','好奇健谈，兴趣广泛，分享自己的想法','安静理性，聊作品或观点，不急着交朋友','活泼热情，表达鲜活，句式有变化','随性慵懒，有自己的生活节奏，不催回复','嘴硬但友善，调侃有分寸，不冒犯','认真真诚，目的明确但不急着要联系方式','古怪内敛，冷幽默，独立的审美偏好','爱音乐和美食，从自己的兴趣自然展开'];
function dyStrangerPersona(d){if(d.persona)return String(d.persona);const name=String(d.name||''),hash=Array.from(name).reduce((n,c)=>n+c.charCodeAt(0),0);d.persona=DY_STRANGER_STYLES[hash%DY_STRANGER_STYLES.length];return d.persona;}
function dyStrangerOpeningKey(text){return String(text||'').replace(/[\s，。！？、,.!?…：:;"'（）()【】<>《》—_-]/g,'').slice(0,10);}
function dyStrangerArrivalOpening(text){return /^(?:刚?[看刷]了|刚?从|在.{0,24}视频|从.{0,24}(?:那边|视频)|刷到.{0,24}视频)/.test(String(text||'').trim());}
function dyStrangerParse(raw,styles,recent){let rows;try{rows=JSON.parse(String(raw||'').replace(/^```(?:json)?\s*|\s*```$/g,''));}catch(_){return null;}if(!Array.isArray(rows)||rows.length!==3)return null;const names=new Set(),keys=new Set((recent||[]).map(dyStrangerOpeningKey));const out=[];for(let i=0;i<rows.length;i++){const x=rows[i]||{},name=String(x.name||'').trim().slice(0,20),text=String(x.text||'').trim(),key=dyStrangerOpeningKey(text);if(!name||!text||text.length>180||names.has(name)||keys.has(key)||dyStrangerArrivalOpening(text)||roleInternalControlLine(text))return null;names.add(name);keys.add(key);out.push({name,text,persona:styles[i]});}return out;}
async function dyGenDMs(){if(_dyStrangerBusy)return;_dyStrangerBusy=true;dyInit();aiLoad('正在刷新私信…');const recent=(S.dy.mine||[]).slice(0,3).map(v=>v.desc).filter(Boolean).join('；'),openings=(S.dy.dms||[]).filter(d=>!d.cid).slice(0,24).map(d=>(d.msgs||[]).find(m=>m.from==='them')).filter(Boolean).map(m=>m.text),styles=DY_STRANGER_STYLES.slice().sort(()=>Math.random()-.5).slice(0,3);try{const messages=[{role:'system',content:'生成3个独立的抖音陌生网友，各自有不同性格、生活、兴趣和说话节奏。可以聊天、交流作品、问具体问题、分享兴趣或表达好感，不要求人人撩人、夸外貌、加微信或约见。每个人只发一句自然的开场，长短和句式各不相同。直接说想聊的具体内容；不要解释是看了谁的视频、从谁那边过来、顺藤摸瓜，也不要套同一开头、改几个词复用句子。只能使用给出的公开信息，不能假装与对方有共同经历或知道私人聊天。性格按顺序：'+styles.join('；')+'。只输出JSON数组，每项{"name":"独立昵称","text":"开场正文"}。'},{role:'user',content:(recent?'最近公开作品：'+recent+'\n':'')+'近期已经出现的开场（避免重复）：'+JSON.stringify(openings)}];const rows=await dyAuxGen(messages,{max:900,temp:.95},raw=>dyStrangerParse(raw,styles,openings),2);rows.forEach(x=>S.dy.dms.unshift({id:uid(),cid:null,name:x.name,avatar:'',persona:x.persona,msgs:[{from:'them',text:x.text,time:Date.now()}],unread:1}));save();render();toast('有'+rows.length+'条新私信');}catch(e){dyModelFail('刷新私信',e);}finally{_dyStrangerBusy=false;aiDone();}}
let _dyStrangerBusy=false;
/* Read-only route probe before writes. Never replay an uncertain send/transfer. */
const PF_RELAY_BASE='https://license.smallphoneapp.com';
let _pfTransportProbe=null,_pfTransportRoute='',_pfTransportAt=0;
async function pfTransportRoute(ms){if(_pfTransportRoute&&Date.now()-_pfTransportAt<(typeof pfRealtime==='function'&&!pfRealtime()?1800000:60000))return _pfTransportRoute;if(_pfTransportProbe)return _pfTransportProbe;_pfTransportProbe=new Promise((resolve,reject)=>{const opt={method:'POST',headers:pfHeaders(),body:JSON.stringify({p_query:''})},wait=Math.min(ms||15000,15000);let pending=2,settled=false;[GATE_URL,PF_RELAY_BASE].forEach(base=>{const start=Date.now();Promise.resolve().then(()=>fetchT(base+'/rest/v1/rpc/phone_friend_search',opt,wait)).then(r=>{if(typeof pfTransportRecord==='function')pfTransportRecord('phone_friend_search','probe',base,r.status,start);if(!settled&&(r.ok||(base===GATE_URL&&(r.status===401||r.status===404)))){settled=true;_pfTransportRoute=base;_pfTransportAt=Date.now();resolve(base);}},e=>{if(typeof pfTransportRecord==='function')pfTransportRecord('phone_friend_search','probe',base,0,start,e);}).then(()=>{if(--pending===0&&!settled)reject(new Error('真人好友连接暂时未成功，请稍后重试；好友和聊天记录已保留。'));});});});try{return await _pfTransportProbe;}finally{_pfTransportProbe=null;}}
/* ===== 抖音群聊：建群、拉角色、公开群每天一位陌生人来申请、私密群只能邀请、管理员 ===== */
let _dyGid='';let _dyGTab='聊天';let _dyGSel=[];let _dyGBusy={};
function dyGroups(){dyInit();if(!Array.isArray(S.dy.groups))S.dy.groups=[];return S.dy.groups;}
function dyGroup(id){return dyGroups().find(g=>g.id===id)||null;}
/* 这个本来也叫 dyGNum，和下面那个夹取范围的 dyGNum(v,dflt,lo,hi) 重名了。
   后声明的覆盖先声明的，所以建群时拿到的其实是那个夹取函数，无参调用
   parseInt(undefined) 是 NaN，返回的是 dflt（undefined）——新建的群，
   群号码一直是空的。改个名字。 */
function dyGNewNum(){return String(Math.floor(1e11+Math.random()*9e11));}
function dyGMsgs(g){if(!Array.isArray(g.msgs))g.msgs=[];return g.msgs;}
function dyGMemberList(g){if(!Array.isArray(g.members))g.members=[];return g.members;}
function dyGFind(g,k){return dyGMemberList(g).find(m=>m.k===k)||null;}
function dyGMemberName(m){if(!m)return '已退出的成员';if(m.k==='me')return S.me.name||'我';
  if(m.cid){const c=getC(m.cid);if(c)return c.remark||c.name;}return m.name||'群成员';}
function dyGMemberAvatar(m){if(!m)return '';if(m.k==='me')return dyAvatar();
  if(m.cid){const c=getC(m.cid);if(c)return c.dyAvatar||c.avatar;}return m.avatar||'';}
function dyGMemberPersona(m){if(!m)return '';if(m.cid){const c=getC(m.cid);return c?String(c.persona||''):'';}return String(m.persona||'');}
function dyGRole(g,k){const m=dyGFind(g,k);return m?(m.role||'member'):'member';}
function dyGCanManage(g,k){const r=dyGRole(g,k);return r==='owner'||r==='admin';}
function dyGBadge(role){return role==='owner'?'<em class="dyg-badge owner">群主</em>':role==='admin'?'<em class="dyg-badge admin">管理员</em>':'';}
function dyGCount(g){return dyGMemberList(g).length;}
function dyGroupPreview(g){const rows=dyGMsgs(g),last=rows[rows.length-1];if(!last)return '群聊建好了，说句话吧～';
  if(last.type==='sys')return String(last.text||'');
  return dyGMemberName(dyGFind(g,last.k))+'：'+String(last.text||'').replace(/\s+/g,' ').slice(0,36);}
/* ===== 建群 ===== */
function dyGroupCreate(){const cs=(S.contacts||[]).filter(c=>c&&!c.deleted);if(!cs.length)return toast('先去微信建一个角色');
  _dyGSel=[];openModal(dyGroupCreateHTML());}
function dyGroupCreateHTML(){const cs=(S.contacts||[]).filter(c=>c&&!c.deleted);
  return `<h3>建一个抖音群聊</h3><div class="hint">先把角色拉进来。公开群每天会有一位陌生人来申请加入，私密群只能你自己邀请。</div>
  <div class="field"><label>群名称</label><input id="dyg_name" placeholder="例如：深夜弹吉他的人"></div>
  <div class="field"><label>群简介<small style="color:#888">选填</small></label><input id="dyg_intro" placeholder="例如：禁男，禁二传，需16+"></div>
  <div style="max-height:34vh;overflow:auto;margin-top:6px">${cs.map(c=>`<div class="row" onclick="dyGroupCreateToggle('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:.5px solid #eee"><span style="width:20px">${_dyGSel.includes(c.id)?'✅':'⬜️'}</span>${av(dyRA(c.id,c.avatar),'sm')}<b style="flex:1;font-size:14px;font-weight:500">${esc(c.remark||c.name)}</b></div>`).join('')}</div>
  <div class="btns" style="margin-top:10px"><button class="btn g" onclick="dyGroupCreateDone(false)">建私密群</button><button class="btn p" onclick="dyGroupCreateDone(true)">建公开群</button></div>
  <button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`;}
function dyGroupCreateToggle(cid){const i=_dyGSel.indexOf(cid);if(i<0)_dyGSel.push(cid);else _dyGSel.splice(i,1);
  const name=($('#dyg_name')||{}).value||'',intro=($('#dyg_intro')||{}).value||'';
  openModal(dyGroupCreateHTML());const n=$('#dyg_name'),t=$('#dyg_intro');if(n)n.value=name;if(t)t.value=intro;}
function dyGroupCreateDone(open){const cs=_dyGSel.map(getC).filter(Boolean);if(!cs.length)return toast('至少拉一个角色进来');
  const name=String((($('#dyg_name')||{}).value||'').trim())||((cs.map(c=>c.remark||c.name).slice(0,2).join('、'))+'的群'),intro=String((($('#dyg_intro')||{}).value||'').trim());
  const g={id:'dg'+uid(),name:name.slice(0,30),avatar:'',gnum:dyGNewNum(),intro:intro.slice(0,60),notice:'',open:!!open,aiOn:true,mute:false,fold:false,top:false,myNick:'',lastApplyDay:'',
    members:[{k:'me',role:'owner',joinedAt:Date.now()},...cs.map(c=>({k:'c:'+c.id,cid:c.id,role:'member',joinedAt:Date.now()}))],
    msgs:[{id:uid(),type:'sys',text:'你创建了群聊「'+name.slice(0,30)+'」，'+cs.map(c=>c.remark||c.name).join('、')+' 加入了群聊',time:Date.now()}]};
  dyGroups().unshift(g);_dyGSel=[];save();closeModal();dyOpenGroup(g.id);toast(open?'公开群建好了，等人来申请吧～':'私密群建好了');}
/* ===== 每天一位陌生人来申请 ===== */
function dyApplies(){dyInit();if(!Array.isArray(S.dy.applies))S.dy.applies=[];return S.dy.applies;}
function dyApplyDayKey(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function dyApplyPending(gid){return dyApplies().filter(a=>a.state==='pending'&&(!gid||a.gid===gid));}
function dyApplyRows(){const all=dyApplies().slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
  return _dyActOnly==='待审批'?all.filter(a=>a.state==='pending'):all;}
function dyApplyUnseen(){return dyApplies().filter(a=>!a.seen).length;}
function dyApplyDueGroup(){return dyGroups().find(g=>g.open&&g.lastApplyDay!==dyApplyDayKey())||null;}
async function dyApplyCheck(){const g=dyApplyDueGroup();if(!g||_dyGBusy.apply)return;_dyGBusy.apply=true;
  g.lastApplyDay=dyApplyDayKey();save();/* 先占住今天，失败也不要一天里反复调模型 */
  try{const person=await dyApplyGenerate(g);if(!person)return;
    dyApplies().unshift(Object.assign({id:'da'+uid(),gid:g.id,ts:Date.now(),state:'pending'},person));save();
    if(cur().p==='dy')render();}catch(e){}finally{_dyGBusy.apply=false;}}
async function dyApplyGenerate(g){
  const r=await dyAuxChat([{role:'system',content:'你生成一个抖音用户，他想申请加入一个公开群聊。只输出四行，不要任何别的话：\n昵称：一个真实的抖音网名，可以带符号或 emoji，别太长\n人设：一句话 20-40 字，说清他是个什么样的人、说话什么风格，性格要有辨识度\n回答：群主设了入群问题，这是他的回答，一句话，符合他的人设\n关注：一个 1 到 400 之间的数字，表示他关注群主多少天了'},
    {role:'user',content:'群名：「'+g.name+'」。群简介：'+(g.intro||'（没写）')+'。生成一个想进这个群的人。性格不要都是乖巧懂事的，可以有社恐、话痨、阴阳怪气、装熟、真诚、抬杠各种类型。'}],{max:220});
  const txt=String(r||''),pick=k=>{const m=txt.match(new RegExp(k+'[:：]\\s*(.+)'));return m?m[1].trim():'';};
  const name=pick('昵称').slice(0,20),persona=pick('人设').slice(0,80),answer=pick('回答').slice(0,60),days=Math.max(1,Math.min(400,parseInt(pick('关注'),10)||1));
  if(!name)return null;
  return {k:'s'+uid(),name,avatar:'',persona,answer,followDays:days};}
function dyApplyPass(id){const a=dyApplies().find(x=>x.id===id);if(!a||a.state!=='pending')return;const g=dyGroup(a.gid);
  if(!g){a.state='expired';save();render();return toast('这个群已经不在了');}
  a.state='passed';dyGMemberList(g).push({k:a.k,name:a.name,avatar:a.avatar,persona:a.persona,role:'member',joinedAt:Date.now()});
  dyGMsgs(g).push({id:uid(),type:'sys',text:a.name+' 通过申请加入了群聊，新成员可查看历史消息',time:Date.now()});
  save();render();toast(a.name+' 进群了');}
function dyApplyReject(id){const a=dyApplies().find(x=>x.id===id);if(!a)return;a.state='expired';save();render();toast('已忽略');}
function dyApplyRow(a){const g=dyGroup(a.gid),pass=a.state==='passed',pend=a.state==='pending';
  return `<div class="dygn-row"><div class="dygn-av" onclick="dyOpenUser('${esc(a.k)}')">${dyFace(a.avatar,'sm')}</div>
    <div class="dygn-main"><div class="dygn-name">${esc(a.name)}<em class="dygn-days">关注 ${a.followDays||1} 天</em></div>
      ${a.answer?`<div class="dygn-ans">回答：${esc(a.answer)}</div>`:''}
      <div class="dygn-say">申请加入「${esc(g?g.name:'已解散的群')}」</div>
      ${a.persona?`<div class="dygn-persona">${esc(a.persona)}</div>`:''}</div>
    ${pend?`<button class="dygn-pass" onclick="dyApplyPass('${a.id}')">通过</button><i class="dygn-x" onclick="dyApplyReject('${a.id}')">✕</i>`
      :`<button class="dygn-done">${pass?'已通过':'已失效'}</button><i class="dygn-x" onclick="dyApplyForget('${a.id}')">✕</i>`}</div>`;}
function dyApplyForget(id){S.dy.applies=dyApplies().filter(x=>x.id!==id);save();render();}
function dyGroupNoticeBody(){const rows=dyApplyRows(),groups=dyGroups();
  if(!groups.length)return `<div class="dyvi-empty">还没有群聊～<br><button class="dybtn" style="margin-top:12px" onclick="dyGroupCreate()">建一个抖音群聊</button></div>`;
  if(!rows.length)return `<div class="dyvi-empty">${_dyActOnly==='待审批'?'没有待审批的申请':'还没有人申请加入～<br>公开群每天会有一位陌生人来敲门。'}</div>`;
  return rows.map(dyApplyRow).join('');}
/* ===== 群聊页 ===== */
function dyOpenGroup(id){const g=dyGroup(id);if(!g)return;_dyGid=id;_dyGTab='聊天';_dySub='group';g.unread=0;save(0);render();
  /* 冷场太久就让群自己活起来，一天有次数上限，不会一直烧 */
  setTimeout(()=>{dyGroupIdleChat(id);},900);}
function dyGSetTab(t){_dyGTab=t;if(t==='设置'){_dySub='ginfo';}render();}
/* 被禁言时这条替掉输入框：自己解不开，只能去私信求他。 */
function dyGMutedBarHTML(g){const left=dyGMeMuted(g),by=dyGMemberName(dyGFind(g,dyGMeMutedBy(g)))||'管理员';
  const who=dyGFind(g,dyGMeMutedBy(g));
  return `<div class="dyg-muted"><b>你被 ${esc(by)} 禁言了，还剩 ${esc(dyGMuteText(left))}</b>
    <span>自己解不开，去私信求他放你出来${who&&who.cid?`　<em onclick="dyGMutedBeg('${g.id}')">去私信他</em>`:''}</span></div>`;}
function dyGMutedBeg(gid){const g=dyGroup(gid);if(!g)return;
  const m=dyGFind(g,dyGMeMutedBy(g));if(!m||!m.cid)return toast('这个人没法私信');
  const c=getC(m.cid);if(!c)return toast('这个人没法私信');
  openDyDMName(c.remark||c.name,c.id,c.avatar);}
/* 群里说话时 @ 到的名字高亮，跟真实抖音一样 */
function dyGAtHTML(g,text){return esc(String(text||'')).replace(/@\s*([^\s，,。！!？?：:@<]{1,16})/g,(whole,n)=>{
  return dyGFindByName(g,n)?('<em class="dyg-at">@'+n+'</em>'):whole;});}
