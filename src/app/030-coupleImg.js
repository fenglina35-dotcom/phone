/* COUPLE_NO_YELLOW_V1: she does not want any yellow in the couple space */
.cs-sub [style*="#e8b878"],.cs-sub [style*="#ffb83b"],.cs-sub [style*="#ffc078"],.cs-sub [style*="#ffd08a"],.cs-sub [style*="#e9d9c4"],.cs-sub [style*="#c59373"],.cs-sub [style*="#bd9678"],.cs-sub [style*="#b28e71"],#modal.cs-modal [style*="#e8b878"],#modal.cs-modal [style*="#ffb83b"],#modal.cs-modal [style*="#ffc078"],#modal.cs-modal [style*="#ffd08a"],#modal.cs-modal [style*="#e9d9c4"],#modal.cs-modal [style*="#c59373"],#modal.cs-modal [style*="#bd9678"],#modal.cs-modal [style*="#b28e71"]{color:#f0a9c1!important;-webkit-text-fill-color:#f0a9c1}
.cs-sub svg[stroke="#e8b878"],.cs-sub svg[stroke="#ffb83b"],.cs-sub svg[stroke="#ffc078"],.cs-sub svg[stroke="#ffd08a"],.cs-sub svg[stroke="#e9d9c4"],.cs-sub svg[stroke="#c59373"],.cs-sub svg[stroke="#bd9678"],.cs-sub svg[stroke="#b28e71"],#modal.cs-modal svg[stroke="#e8b878"],#modal.cs-modal svg[stroke="#ffb83b"],#modal.cs-modal svg[stroke="#ffc078"],#modal.cs-modal svg[stroke="#ffd08a"],#modal.cs-modal svg[stroke="#e9d9c4"],#modal.cs-modal svg[stroke="#c59373"],#modal.cs-modal svg[stroke="#bd9678"],#modal.cs-modal svg[stroke="#b28e71"]{stroke:#f0a9c1}
.cs-sub .wedding-collection-entry,.cs-sub .wedding-collection-row{border-color:rgba(240,169,193,.28)!important;background:#141315!important}.cs-sub .wedding-collection-row small,.cs-sub .wedding-collection-row>i,.cs-sub .wedding-photo-album-open i{color:#f0a9c1!important}.cs-sub .wedding-photo-album-open{border-top-color:rgba(240,169,193,.18)!important;background:transparent!important}.cs-sub .wedding-married-badge{border-color:rgba(240,169,193,.5)!important;background:rgba(240,169,193,.12)!important;color:#f0a9c1!important}
.cs-danger{display:block;text-align:center;color:#ff5a6e;font-size:15px;padding:18px 0 6px;cursor:pointer}.cs-sub-note{margin:14px 16px 0;color:#9b9297;font-size:12.5px;line-height:1.6}
#coupage1:not(.cs-sub-screen)>#cou_shortcut_screen_time,#coupage1:not(.cs-sub-screen)>#cou_screen_cloud{display:none}
</style>`;
function coupleImg(name,dir){return `background-image:linear-gradient(${dir||'90deg'},#141315 32%,rgba(20,19,21,.6) 58%,rgba(20,19,21,.05) 85%),url('assets/couple-space/${name}')`;}
function coupleHalfImg(name){return `background-image:linear-gradient(160deg,rgba(20,19,21,.92) 18%,rgba(20,19,21,.45) 55%,rgba(20,19,21,.12)),url('assets/couple-space/${name}')`;}
function coupleDash1(cp,c,bs){const na=coupleNextAnniv(cp),sl=S.me.sleep||{},rp=S.me.report||{},goals=(cp.goals||[]).length;
  return `<div class="cs-card"><div class="cs-hero" style="${coupleImg('sweet-anniversary.jpg')}" onclick="coupleOpen('anniv')">
      <h2 class="serif">我们的纪念</h2>${na?`<p>下一次纪念日 · ${esc(na.title)}</p><div class="cs-big">${na.left?`还有 <b class="serif">${na.left}</b> 天`:'<b class="serif" style="font-size:34px">就是今天</b>'}</div>`:`<p>还没有纪念日</p><div class="cs-big"><b class="serif" style="font-size:30px">添加一个</b></div>`}
      <span class="cs-link">查看纪念日 ›</span></div>
    <div class="cs-strip" onclick="coupleOpen('wedding')">${svgIc('book',34,'#e9e2e5')}<div class="tx"><b class="serif">婚书收藏夹</b><small>现代婚书 · 中式婚书 · 婚礼影集</small></div><span class="ar" style="color:#cfc7cb;font-size:20px">›</span></div></div>
    <div class="cs-h"><h3 class="serif">一起过日子</h3><span onclick="coupleOpen('all1')">全部 ›</span></div>
    <div class="cs-grid">
      <div class="cs-half" style="${coupleHalfImg('sweet-sleep.jpg')}" onclick="coupleOpen('sleep')"><div class="t">${svgIc('moon',26,'#f2ece8')}<span class="serif">睡眠</span></div>
        <small>${sl.active?'正在睡眠中 · 已睡 '+sleepDurTxt(Date.now()-sl.active):'今晚也要好好休息'}</small>
        <span class="cs-pill" style="margin-top:14px" onclick="event.stopPropagation();${sl.active?'sleepEnd()':'sleepStart()'}">${sl.active?'我醒啦':'开始计时'}</span></div>
      <div class="cs-half" style="${coupleHalfImg('sweet-report.jpg')}" onclick="coupleOpen('report')"><div class="t">${svgIc('location',26,'#f2ece8')}<span class="serif">报备</span></div>
        ${rp.active?`<small>正在「${esc(rp.active.type)}」· 已 ${sleepDurTxt(Date.now()-rp.active.start)}</small><span class="cs-pill" style="margin-top:14px" onclick="event.stopPropagation();reportEnd()">我回来了</span>`
        :`<div class="cs-chips">${['吃饭','出门','健身'].map(p=>`<span onclick="event.stopPropagation();reportStart('${p}')">${p}</span>`).join('<i>/</i>')}<i>/</i><span>更多</span></div>`}</div>
    </div>
    <div style="margin-top:14px"></div>
    <div class="cs-row" onclick="coupleOpen('goals')"><span class="ic">${svgIc('check',34,'#e9e2e5')}</span><div class="tx"><b class="serif">共同目标</b><small>${goals?'已经约好 '+goals+' 件':'一起完成的小约定'}</small></div><span class="r" style="font-size:30px;font-weight:200" onclick="event.stopPropagation();coupleGoalModal()">＋</span></div>
    <div class="cs-row" onclick="coupleOpen('behavior')"><span class="ic">${coupleIcon('list',34,'#e9e2e5')}</span><div class="tx"><b class="serif">行为小账本</b><small>记着 ${bs.n} 件小事</small></div><span class="r"><b class="serif" style="font-size:22px;font-weight:500">${bs.v}</b> 条记录 ›</span></div>
    <div class="cs-foot"><div onclick="coupleOpen('tasks')">${svgIc('gear',22,'#cfc7cb')}任务设置</div><div onclick="coupleOpen('screen')">${coupleIcon('bars',22,'#cfc7cb')}屏幕时长导入</div></div>
    <div id="cou_extra_slot"></div>`;}
function coupleDash2(cp,c,locksHTML){const locks=cp.locks||{},lk=Object.keys(locks).filter(k=>LOCKABLE[k]).length;let ext=0;try{const st=typeof companionState==='function'?companionState():null;ext=(st&&st.apps||[]).filter(a=>a&&a.locked).length;}catch(_){}
  const card=!cp.walletAuth?'未交给ta管':cp.cardFrozen?'已冻结':'正常';
  return `<div class="cs-card"><div class="cs-hero" style="${coupleImg('rules-hero.jpg')}" onclick="coupleOpen('apps','cou_grant')">
      <h2 class="serif">我们的约定</h2><p>每一项权限，都由你决定</p><span class="cs-link pink">管理授权 ›</span></div>
    <div class="cs-split"><div onclick="coupleOpen('apps','cou_locks')" style="gap:7px">${coupleIcon('grid',26,'#e9e2e5')}<span style="white-space:nowrap">已锁应用 <b class="serif">${lk+ext}</b> 项</span></div><div onclick="coupleOpen('wallet')" style="gap:7px">${svgIc('card',26,'#f0a9c1')}<span style="white-space:nowrap;font-size:13.5px">亲属卡 · ${card}</span>${cp.cardFrozen?svgIc('lock',20,'#f0a9c1'):''}</div></div></div>
    ${locksHTML}
    <div class="cs-h"><h3 class="serif">权限与边界</h3></div>
    <div class="cs-grid">
      <div class="cs-half" style="${coupleHalfImg('perm-chat.jpg')}" onclick="coupleOpen('apps')"><div class="t" style="flex-direction:column;align-items:flex-start;gap:12px">${svgIc('chat',30,'#f2ece8')}<span class="serif" style="font-size:20px">应用与聊天</span></div><small style="display:flex;justify-content:space-between">查看权限 · 聊天禁言<span>›</span></small></div>
      <div class="cs-half" style="${coupleHalfImg('perm-wallet.jpg')}" onclick="coupleOpen('wallet')"><div class="t" style="flex-direction:column;align-items:flex-start;gap:12px">${svgIc('wallet',30,'#f2ece8')}<span class="serif" style="font-size:20px">钱包与限额</span></div><small style="display:flex;justify-content:space-between">零钱 · 亲属卡 · 使用时长<span>›</span></small></div>
    </div>
    <div style="margin-top:14px"></div>
    <div class="cs-row" onclick="coupleOpen('remote')"><span class="ic">${svgIc('shield',34,'#e9e2e5')}</span><div class="tx"><b class="serif">远程与登录</b><small>微信登录 · 远程操控</small></div><span class="ar">›</span></div>
    <div class="cs-row" onclick="coupleOpen('star')"><span class="ic">${svgIc('star',34,'#e9e2e5')}</span><div class="tx"><b class="serif">重点关注</b><small>查看重点盯防名单</small></div><span class="ar">›</span></div>
    <div class="cs-row" onclick="coupleOpen('jail')"><span class="ic">${coupleIcon('door',34,'#e9e2e5')}</span><div class="tx"><b class="serif">小黑屋</b><small>授权 · 模型设置 · 历史记录</small></div><span class="ar">›</span></div>
    <div class="cs-row" onclick="coupleOpen('outpass')"><span class="ic">${svgIc('location',34,'#e9e2e5')}</span><div class="tx"><b class="serif">出门审批</b><small>发起申请与查看记录</small></div><span class="ar">›</span></div>
    <div style="border-top:1px solid rgba(255,255,255,.08);margin:0 14px"></div>
    <span class="cs-danger" onclick="askConfirm('解除情侣绑定？',()=>{S.couple=null;save();render()},{danger:true})">解除绑定</span>`;}
function coupleDash3(){const st=companionState(),local=typeof companionLocalNativeAvailable==='function'&&companionLocalNativeAvailable(),ready=companionReady(st),bat=st.battery,h=st.health,loc=st.location,fp=st.footprints||[],apps=st.apps||[];
  const on=st.linked||local,today=new Date().toDateString(),fpToday=fp.filter(f=>f&&f.ts&&new Date(f.ts).toDateString()===today).length;
  const scr=ready&&st.screenTimeAvailable?companionDuration(st.screenTimeSec).replace(/(\d+)/g,'<b class="serif">$1</b>'):'<b class="serif">--</b>';
  return `<div class="cs-card"><div class="cs-hero" style="${coupleImg('device-hero.jpg')}">
      <h2 class="serif">陪在你身边</h2><p>真实 iPhone · ${st.transport==='local-native'||local?'本机原生直连':st.linked?'远程安全同步':'还没连接'}</p>
      <div style="margin-top:12px;color:#ece6e8;font-size:14px"><span class="cs-dot" style="${on?'':'background:#777'}"></span>${on?'已连接':st.demo?'测试数据':'未连接'}</div>
      ${on?`<span class="cs-pill" style="display:inline-block;margin-top:16px;padding:9px 26px" onclick="companionRequestSync()">读取设备</span>`:`<span class="cs-pill" style="display:inline-block;margin-top:16px;padding:9px 26px" onclick="coupleOpen('device','cou_companion_device')">去连接</span>`}</div>
    <div class="cs-stats"><div><b class="serif">${bat?Math.round(bat.level*100):'--'}</b><em>%</em><small>电量</small></div><div style="color:#f2ece8;font-size:15px">${scr.replace(/<b class="serif">/g,'<b class="serif" style="font-size:36px;color:#f0a9c1;font-weight:500">')}<small>屏幕使用</small></div></div></div>
    <div class="cs-h"><h3 class="serif">今天的小日常</h3><span onclick="coupleOpen('device','cou_companion_device')">查看概览 ›</span></div>
    <div class="cs-grid">
      <div class="cs-half" style="${coupleHalfImg('device-health.jpg')}" onclick="coupleOpen('device','cou_companion_wellness')"><div class="t">${svgIc('heart',24,'#f2ece8')}<span class="serif" style="font-size:17px">健康摘要</span></div>
        <div style="margin-top:10px;color:#f2ece8;font-size:15px"><b class="serif" style="font-size:44px;color:#f0a9c1;font-weight:500">${h&&h.steps!=null?Math.round(h.steps):'--'}</b> 步</div><small style="margin-top:2px">${h&&h.heartRateBpm!=null?'心率 '+Math.round(h.heartRateBpm)+' 次/分':'等待健康摘要'}</small></div>
      <div class="cs-half" style="${coupleHalfImg('device-map.jpg')}" onclick="coupleOpen('device','cou_companion_location')"><div class="t">${svgIc('location',24,'#f2ece8')}<span class="serif" style="font-size:17px">位置与足迹</span></div>
        <div style="margin-top:14px;color:#f2ece8;font-size:15.5px" class="serif">${loc?esc(loc.place||'最近位置')+' · 误差约 '+Math.round(loc.accuracy||0)+' 米':'还没有位置'}</div><small>今日 ${fpToday} 个足迹点</small></div>
    </div>
    <div style="margin-top:14px"></div>
    <div class="cs-row" onclick="coupleOpen('device','cou_companion_apps')"><span class="ic">${coupleIcon('grid',34,'#e9e2e5')}</span><div class="tx"><b class="serif">App 控制</b><small>${apps.length} 个应用 · 锁定与统一限额</small></div><span class="ar">›</span></div>
    <div class="cs-row" onclick="coupleOpen('device','cou_companion_automations')"><span class="ic">${svgIc('clock',34,'#e9e2e5')}</span><div class="tx"><b class="serif">主动查看规则</b><small>查看时段 · 低电量提醒 · 解锁通知</small></div><span class="ar">›</span></div>
    <div class="cs-row" onclick="coupleOpen('device','cou_companion_permissions')"><span class="ic">${svgIc('shield',34,'#e9e2e5')}</span><div class="tx"><b class="serif">角色访问权限</b><small>自主选择可访问的数据与操作</small></div><span class="ar">›</span></div>
    <div class="cs-row" onclick="coupleOpen('device','cou_companion_audit')"><span class="ic">${coupleIcon('list',34,'#e9e2e5')}</span><div class="tx"><b class="serif">操作记录</b><small>命令回执 · 审计记录 · 后台通知</small></div><span class="ar">›</span></div>
    <div class="cs-foot"><div onclick="companionHelp()">${coupleIcon('list',20,'#cfc7cb')}权限说明</div><div onclick="coupleOpen('device','cou_companion_scope')">${coupleIcon('sliders',20,'#cfc7cb')}统一管控方式</div><div style="cursor:default">最近读取 ${st.lastSync?hm(st.lastSync):'--'}</div></div>`;}
function renderCouple(){cleanStaleGags();const cp=S.couple;const c=cp&&getC(cp.cid),privateCompanion=companionFeatureAvailable();if(!privateCompanion&&_couTab===3)_couTab=1;
  const BG='background:#000';
  if(!cp||!c)return `<div class="nav"><span class="l" onclick="home()">‹</span><span class="t">情侣空间</span><span class="r"></span></div>
    <div class="scroll" id="couplescroll" style="${BG}"><div class="empty" style="padding:60px 30px;line-height:2.1">${svgIc('heart',46,'#e89db5')}<div style="margin-top:14px">还没绑定～<br>去某个角色的「资料页」点 <b style="color:#e89db5">绑定情侣空间</b><br>（只能绑定一个）</div></div></div>`;
  const days=coupleDays(cp.startDate);
  const ROSE='#e89db5',GOLD='#f0a9c1',BLUE='#9ec5fe',AMBER='#f0a9c1',RED='#ff6b81',PUR='#c5a6ff';   // COUPLE_NO_YELLOW_V1: no gold or amber here
  const PINKTH=S.me.theme==='pink',WHITETH=S.me.theme==='white',LIGHTTH=PINKTH||WHITETH;
  const BANBG=PINKTH?'linear-gradient(135deg,#ffc6da 0%,#ffd9e6 55%,#ffe7f0 100%)':WHITETH?'linear-gradient(135deg,#fbfbfd 0%,#f0f0f4 60%,#eaeaef 100%)':'linear-gradient(135deg,#5b2f44 0%,#3c2b53 55%,#243049 100%)';
  const BANTX=PINKTH?'#9c4f73':WHITETH?'#5a606e':'#f3e6ee',BANBIG=PINKTH?'#b8316e':WHITETH?'#4a4f5c':'#fff',BANSUB=PINKTH?'#bd7c9c':WHITETH?'#8a909c':'#e9d9c4';
  const HD=(ic,t,col,right)=>`<div style="padding:13px 15px;display:flex;align-items:center;gap:9px;font-weight:600;color:${col};font-size:14px;letter-spacing:.3px;border-bottom:1px solid rgba(255,255,255,.05)">${svgIc(ic,17,col)}<span style="flex:1">${t}</span>${right||''}</div>`;
  const SEC='class="section" style="margin:12px;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.06);background:#17151b"';
  const frame=a=>`<span style="display:inline-block;border-radius:18px;padding:2.5px;background:linear-gradient(135deg,${GOLD},${ROSE})">${av(a,'lg')}</span>`;
  /* COUPLE_REDESIGN_V1: card home pages; each old block below is unchanged and shows on its own page (cur().sub) */
  const SUB0=(typeof cur==='function'&&cur()&&cur().sub)||'',SUB=COUPLE_SUBS[SUB0]&&(SUB0!=='device'||privateCompanion)?SUB0:'';if(SUB)_couTab=COUPLE_SUBS[SUB].tab;
  const P={};
  P.cou_tasks=`<div id="cou_tasks" ${SEC}><div class="it"><span>布置任务<br><small>仅允许当前情侣布置任务，默认关闭</small></span><span class="sw ${coupleTasksEnabled(c)?'on':''}" onclick="coupleTasksToggle()"></span></div></div>`;
  P.cou_startdate=`<div id="cou_startdate" ${SEC}><div class="it" onclick="coupleSet()"><span style="display:flex;align-items:center;gap:9px">${svgIc('calendar',16,ROSE)}在一起的日子</span><span class="v">${cp.startDate} ›</span></div></div>`;
  P.cou_goals=`<div id="cou_goals" ${SEC}>${HD('check','共同目标',ROSE,`<span class="minibtn" onclick="coupleGoalModal()">＋ 制定</span>`)}
        <div style="padding:11px 13px 8px;color:#9b8f99;font-size:12px;line-height:1.65">可以自己设定，也可以在聊天或通话里请 ${esc(c.remark||c.name)} 每天监督。每项每天最多提醒一次，完成后当天不再重复。</div>${coupleGoalRows()}</div>`;
  P.cou_anniv=`<div id="cou_anniv" ${SEC}>${HD('gift','纪念日',ROSE,`<span class="minibtn" onclick="addAnniv()">＋ 添加</span>`)}
        ${(cp.anniversaries||[]).length?cp.anniversaries.map((a,i)=>`<div class="bill" style="border-radius:8px;margin:0 10px 6px"><div><b>${a.date}</b> ${esc(a.title)}<small>${annivCount(a.date)}</small></div><span onclick="S.couple.anniversaries.splice(${i},1);save();render()" style="color:#fa5151;cursor:pointer">✕</span></div>`).join(''):'<div class="empty" style="padding:14px">还没有纪念日</div>'}</div>`;
  P.cou_wedding=`${typeof window.weddingCoupleCollectionHTML==='function'?window.weddingCoupleCollectionHTML(cp,c,SEC,HD,ROSE,GOLD):''}`;
  P.cou_sleep=`${(function(){const sl=S.me.sleep||{active:null,records:[]};const recs=sl.records||[];
        let h=`<div id="cou_sleep" ${SEC}>${HD('moon','睡眠计时',BLUE)}
        <div style="padding:10px 14px">${sl.active?`<div style="text-align:center;color:#9ec5fe;font-size:13px;margin-bottom:8px">正在睡眠中…从 ${hm(sl.active)} 开始（已睡 ${sleepDurTxt(Date.now()-sl.active)}）</div><button class="btn p" onclick="sleepEnd()">${svgIc('sun',15,'#fff')} 我醒啦，结束睡眠</button>`:`<button class="btn p" onclick="sleepStart()">${svgIc('moon',15,'#fff')} 我要睡了，开始计时</button>`}</div>`;
        if(recs.length){h+=recs.slice(0,14).map((r,i)=>`<div class="bill" style="border-radius:8px;margin:0 10px 6px"><div style="font-size:13px">${ymd(r.start)} ${hm(r.start)} → ${hm(r.end)}<small style="display:block;color:#888">睡了 ${sleepDurTxt(r.end-r.start)}</small></div><span onclick="sleepDel(${i})" style="color:#fa5151;cursor:pointer">✕</span></div>`).join('');}
        else h+=`<div class="empty" style="padding:10px">还没有睡眠记录</div>`;
        return h+`</div>`;})()}`;
  P.cou_report=`${(function(){const rp=S.me.report||{active:null,log:[]};const log=rp.log||[];const presets=['洗澡','吃饭','玩游戏','看剧','健身','出门'];
        let h=`<div id="cou_report" ${SEC}>${HD('location','报备 · 我去干嘛了',AMBER)}`;
        if(rp.active){h+=`<div style="padding:10px 14px"><div style="text-align:center;color:#ffb83b;font-size:14px;margin-bottom:8px">正在「${esc(rp.active.type)}」…从 ${hm(rp.active.start)} 开始（已 ${sleepDurTxt(Date.now()-rp.active.start)}）</div><button class="btn p" onclick="reportEnd()">结束 / 我回来了</button></div>`;}
        else{h+=`<div style="padding:8px 14px;display:flex;flex-wrap:wrap;gap:8px">${presets.map(p=>`<button class="minibtn" onclick="reportStart('${p}')">${p}</button>`).join('')}<button class="minibtn" style="background:#7c5cff;color:#fff" onclick="reportCustom()">＋ 其他…</button></div>`;}
        if(log.length){h+=log.slice(0,12).map((r,i)=>`<div class="bill" style="border-radius:8px;margin:0 10px 6px"><div style="font-size:13px">${ymd(r.start)} ${hm(r.start)}→${hm(r.end)} ${esc(r.type)}<small style="display:block;color:#888">用了 ${sleepDurTxt(r.end-r.start)}</small></div><span onclick="reportDel(${i})" style="color:#fa5151;cursor:pointer">✕</span></div>`).join('');}
        return h+`</div>`;})()}`;
  P.cou_behavior=`${(function(){const bs=behaviorStats(),lt=bs.latest;return `<div id="cou_behavior" ${SEC}>${HD('notebook','行为小账本',PUR,`<span class="minibtn" onclick="behaviorLedgerModal()">查看</span>`)}
        <div style="padding:10px 14px 12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="border-radius:12px;background:rgba(255,255,255,.05);padding:10px;text-align:center"><div style="font-size:22px;color:#ffd3e4;font-weight:800">${bs.n}</div><div style="font-size:12px;color:#999">记着的小事</div></div>
          <div style="border-radius:12px;background:rgba(255,255,255,.05);padding:10px;text-align:center"><div style="font-size:22px;color:#ff9fbd;font-weight:800">${bs.v}</div><div style="font-size:12px;color:#999">抓到的证据</div></div>
        </div>
        ${lt?`<div class="bill" style="border-radius:10px;margin:0 12px 12px"><div><b>${esc(lt.title)}</b><small>${esc((lt.promise||((lt.events&&lt.events[0]&&lt.events[0].text)||'')).slice(0,58))}</small></div><span class="v">›</span></div>`:`<div class="empty" style="padding:0 14px 12px">还没有记账</div>`}
        <div class="it"><span>小账本启用</span><span class="sw ${bs.on?'on':''}" onclick="behaviorToggle()"></span></div></div>`;})()}`;
  P.cou_album=`<div id="cou_album" ${SEC}>${photoAlbumPermissionHTML()}</div>`;
  P.cou_watch=`${typeof coupleWatchPermissionHTML==='function'?coupleWatchPermissionHTML():''}`;
  P.cou_grant=`${(function(){const g=cp.grant||{},locks=cp.locks||{},gags=cp.gags||{};const lk=Object.keys(locks).filter(k=>LOCKABLE[k]),gk=Object.keys(gags);
        let h=`<div id="cou_grant" ${SEC}>${HD('lock','软件管控授权',ROSE)}
        ${Object.keys(LOCKABLE).map(k=>`<div class="it" data-couple-permission="grant:${k}"><span>${LOCKABLE[k]}</span><span class="sw ${g[k]?'on':''}" onclick="coupleGrant('${k}')"></span></div>`).join('')}</div>
        <div id="cou_gag_auth" ${SEC}>${HD('mute','允许ta禁言这些人的聊天',ROSE)}
        ${gagAuthRows()}</div>`;
        if(lk.length||gk.length){h+=`<div id="cou_locks" ${SEC}>${HD('lock','ta锁住的（去微信里求ta解开）',RED)}
        ${lk.map(k=>`<div class="it"><span style="color:#eee;display:flex;align-items:center;gap:8px">${svgIc('lock',15,'#fa5151')}${LOCKABLE[k]||k}</span><span class="v" style="color:#888">${typeof lockUntilOf==='function'&&lockUntilOf(k)?esc(lockUntilText(lockUntilOf(k))):'已锁'}</span></div>`).join('')}
        ${gk.map(cid=>`<div class="it"><span style="color:#eee;display:flex;align-items:center;gap:8px">${svgIc('mute',15,'#fa5151')}和「${esc(gagKeyName(cid))}」的聊天</span><span class="v" style="color:#888">已禁言</span></div>`).join('')}</div>`;}
        return h;})()}`;
  P.cou_wallet=`${(function(){const nm=esc(c.remark||c.name);return `<div id="cou_wallet" ${SEC}>${HD('wallet','钱包 / 亲属卡 管控',GOLD)}
        <div class="it" data-couple-permission="walletAuth"><span>把钱包/亲属卡交给ta管</span><span class="sw ${cp.walletAuth?'on':''}" onclick="coupleWalletAuth()"></span></div>
        ${cp.walletAuth?`<div class="it"><span style="color:#888">当前零钱</span><span class="v">¥${(+S.me.balance).toFixed(2)}（ta可扣）</span></div>${cp.cardFrozen?`<div class="it"><span style="color:#fa5151;display:flex;align-items:center;gap:8px">${svgIc('card',15,'#fa5151')}亲属卡已被ta冻结</span><span class="v" style="color:#888">求ta解冻</span></div>`:''}`:''}</div>`;})()}`;
  P.cou_limit=`${(function(){const g=cp.grant||{},tl=cp.timeLimit||{};const keys=Object.keys(LOCKABLE).filter(k=>g[k]&&(tl[k]||usedSecOf(k)));
        let h=`<div id="cou_limit" ${SEC}>${HD('timer','软件使用时长 / 限额',AMBER)}`;
        if(keys.length){h+=keys.map(k=>{const used=usedSecOf(k),lim=tl[k]?tl[k]*60+((S.me.appUsage&&S.me.appUsage.bonus&&S.me.appUsage.bonus[k])||0):0;const um=Math.floor(used/60),us=used%60;const usedTxt=um+'分'+String(us).padStart(2,'0')+'秒';
          return `<div class="bill" style="border-radius:8px;margin:0 10px 6px"><div style="font-size:13px">${LOCKABLE[k]}<small style="display:block;color:#888">今天已用 ${usedTxt}${lim?' / 限额 '+Math.floor(lim/60)+'分钟':'（ta还没设限额）'}</small></div>${lim&&used>=lim?'<span class="v" style="color:#fa5151">已用完</span>':(lim?'<span class="v" style="color:#f0a9c1!important">剩 '+Math.max(0,Math.ceil((lim-used)/60))+'分</span>':'')}</div>`;}).join('');}
        else h+=`<div class="empty" style="padding:10px">还没有使用记录，也没设限额</div>`;
        return h+`</div>`;})()}`;
  P.cou_star=`${(function(){const st=S.contacts.filter(x=>!x.deleted&&x.star);return `<div id="cou_star" ${SEC}>${HD('star',esc(c.remark||c.name)+' 重点盯防的人',GOLD)}${st.length?st.map(x=>`<div class="it"><span style="display:flex;align-items:center;gap:8px">${svgIc('star',15,GOLD)}${esc(x.remark||x.name)}${x.gender?'（'+esc(x.gender)+'）':''}</span><span class="v" onclick="(function(){var t=getC('${x.id}');if(t)t.star=false;save();render();})()" style="color:#fa5151;cursor:pointer">取消重点</span></div>`).join(''):'<div class="empty" style="padding:10px">ta暂时没标重点盯防谁</div>'}</div>`;})()}`;
  P.cou_jail=`${(function(){const nm=esc(c.remark||c.name);const cl=coldLeft(c);return `<div id="cou_jail" ${SEC}>${HD('shield','终极惩罚 · 禁闭室（小黑屋）','#e0344a')}
        <div class="it" data-couple-permission="jailAuth"><span>允许 ${nm} 关我小黑屋</span><span class="sw ${cp.jailAuth?'on':''}" onclick="coupleJailAuth()"></span></div>
        <div class="it"><span>禁闭室用辅助模型</span><span class="sw ${S.settings.jailAux?'on':''}" onclick="S.settings.jailAux=!S.settings.jailAux;save();render();toast(S.settings.jailAux?'禁闭室→辅助模型':'禁闭室→主模型')"></span></div>
        <div class="it"><span>小黑屋上下文条数</span><input type="number" min="20" max="200" value="${S.settings.jailHist||100}" onchange="S.settings.jailHist=Math.max(20,Math.min(200,+this.value||100));save();toast('小黑屋上下文：'+S.settings.jailHist+'条')" style="width:80px;text-align:right;border:1px solid #38383a;border-radius:8px;padding:5px;background:#2c2c2e;color:#eee"></div>
        <div class="it"><span>小黑屋跳戏时重试次数</span><input type="number" min="0" max="3" value="${S.settings.jailRetry!=null?S.settings.jailRetry:1}" onchange="S.settings.jailRetry=Math.max(0,Math.min(3,+this.value||0));save();toast('小黑屋重试：'+S.settings.jailRetry+'次')" style="width:80px;text-align:right;border:1px solid #38383a;border-radius:8px;padding:5px;background:#2c2c2e;color:#eee"></div>
        <div class="it" onclick="go('jail')"><span style="display:flex;align-items:center;gap:8px">🕘 查看上一次小黑屋记录</span><span class="v">›</span></div>
        <div class="it" onclick="jailTest()"><span style="display:flex;align-items:center;gap:8px">${svgIc('flask',15,'#bbb')}测试进小黑屋（不留记录·随时出）</span><span class="v">›</span></div>
        ${cl?`<div class="it"><span style="color:#9ec5fe;display:flex;align-items:center;gap:8px">${svgIc('snow',15,BLUE)}他还有情绪余温</span><span class="v" style="color:#888">到 ${hm(cl)} 自然消气（哄他可提前）</span></div>`:''}</div>`;})()}`;
  P.cou_outpass=`<div id="cou_outpass" ${SEC}>${HD('location','出门报备审批',BLUE)}
        <div class="it" onclick="outpassRequest()"><span>发起出门申请</span><span class="v">›</span></div></div>`;
  P.cou_wxlogin=`${(function(){const nm=esc(c.remark||c.name);return `<div id="cou_wxlogin" ${SEC}>${HD('idcard','微信登录权限',PUR)}
        <div class="it" data-couple-permission="wxLoginAuth"><span>允许 ${nm} 登录我的微信</span><span class="sw ${cp.wxLoginAuth?'on':''}" onclick="coupleWxLoginAuth()"></span></div></div>`;})()}`;
  P.cou_remote=`${(function(){const nm=esc(c.remark||c.name),on=cp.remoteControlAuth!==false,auto=!!cp.remoteControlAutoApprove;return `<div id="cou_remote" ${SEC}>${HD('shield','远程操控小手机',RED)}
        <div class="it" data-couple-permission="remoteControlAuth"><span>允许 ${nm} 发起远程操控申请</span><span class="sw ${on?'on':''}" onclick="coupleRemoteControlAuth()"></span></div>
        <div class="it" data-couple-permission="remoteControlAutoApprove"><span>无需每次同意，允许 ${nm} 直接接管</span><span class="sw ${auto?'on':''}" onclick="coupleRemoteControlAutoApprove()"></span></div></div>`;})()}`;
  const locksHTML=(function(){const locks=cp.locks||{},gags=cp.gags||{};const lk=Object.keys(locks).filter(k=>LOCKABLE[k]),gk=Object.keys(gags);let h='';
        if(lk.length||gk.length){h+=`<div id="cou_locks" ${SEC}>${HD('lock','ta锁住的（去微信里求ta解开）',RED)}
        ${lk.map(k=>`<div class="it"><span style="color:#eee;display:flex;align-items:center;gap:8px">${svgIc('lock',15,'#fa5151')}${LOCKABLE[k]||k}</span><span class="v" style="color:#888">${typeof lockUntilOf==='function'&&lockUntilOf(k)?esc(lockUntilText(lockUntilOf(k))):'已锁'}</span></div>`).join('')}
        ${gk.map(cid=>`<div class="it"><span style="color:#eee;display:flex;align-items:center;gap:8px">${svgIc('mute',15,'#fa5151')}和「${esc(gagKeyName(cid))}」的聊天</span><span class="v" style="color:#888">已禁言</span></div>`).join('')}</div>`;}
        return h;})();
  if(SUB){const d=COUPLE_SUBS[SUB];return `<div class="nav"><span class="l" onclick="back()">‹</span><span class="t">${d.t}</span><span class="r"></span></div>
    <div class="scroll" id="couplescroll" style="${BG}">${COUPLE_CSS}<div id="coupage${d.tab}" class="cs-sub cs-sub-${SUB}" style="display:block">${SUB==='device'?renderCompanionPage(c,SEC,HD):d.ids.map(id=>P[id]||'').join('')}${SUB==='screen'?'<div class="cs-sub-note">把 iPhone 快捷指令复制的屏幕使用记录粘贴到这里。如果上面是空的，说明这台设备还没有接好快捷指令。</div>':''}</div><div style="height:20px"></div></div>`;}
  const fmtStart=String(cp.startDate||'').replace(/-/g,'.');
  return `<div class="nav"><span class="l" onclick="home()">‹</span><span class="t">情侣空间</span><span class="r"></span></div>
    <div class="scroll" id="couplescroll" style="${BG}">${COUPLE_CSS}<div class="cs">
      <div class="cs-head"><div class="cs-p"><span class="cs-av">${av(S.me.avatar,'lg')}</span><b class="serif">${esc(S.me.name)}</b></div>
        <div class="cs-mid"><div class="ln"><i></i>${svgIc('heart',18,'#f0a9c1')}<i></i></div><small>${cp.married?'已结为夫妻':'在一起'}</small><div class="n serif">${days}<span>天</span></div><div class="since serif">相伴自 ${esc(fmtStart)}</div></div>
        <div class="cs-p"><span class="cs-av">${av(c.avatar,'lg')}</span><b class="serif">${esc(c.remark||c.name)}</b></div></div>
      <img class="cs-cats" src="assets/couple-space/header-cats.png" alt="" onerror="this.remove()">
      <div class="cs-tabs">
        <button class="minibtn" id="coutab1" data-on="${_couTab===1?1:0}" onclick="couTab(1)">甜蜜日常</button>
        <button class="minibtn" id="coutab2" data-on="${_couTab===2?1:0}" onclick="couTab(2)">管控授权</button>
        ${privateCompanion?`<button class="minibtn" id="coutab3" data-on="${_couTab===3?1:0}" onclick="companionEnter()">伴生设备</button>`:''}</div>
      <div id="coupage1" style="display:${_couTab===1?'block':'none'}">${coupleDash1(cp,c,behaviorStats())}</div>
      <div id="coupage2" style="display:${_couTab===2?'block':'none'}">${coupleDash2(cp,c,locksHTML)}</div>
      ${privateCompanion?`<div id="coupage3" style="display:${_couTab===3?'block':'none'}">${_couTab===3?coupleDash3():''}</div>`:''}
      <div style="height:20px"></div></div></div>`;}
function coupleWalletAuth(){if(!S.couple)return;S.couple.walletAuth=!S.couple.walletAuth;if(!S.couple.walletAuth)S.couple.cardFrozen=false;save();render();const cid=S.couple.cid,c=cid&&getC(cid);if(c&&!c.blocked)scheduleFeatureReply(cid,featureEventNote('情侣权限变化',S.me.name+(S.couple.walletAuth?'刚把钱包/亲属卡的管控权交给你了。':'刚悄悄收回了钱包管控权。你立刻知道了；如果按你的性格不接受，可以申请远程操控，但仍要等ta本次同意。')+'按你人设自然反应。'),120);}
function coupleRemoteControlAutoApprove(){if(!S.couple)return;S.couple.remoteControlAutoApprove=!S.couple.remoteControlAutoApprove;if(S.couple.remoteControlAutoApprove)S.couple.remoteControlAuth=true;save();render();const cid=S.couple.cid,c=cid&&getC(cid);if(c&&!c.blocked)scheduleFeatureReply(cid,featureEventNote('情侣权限变化',S.me.name+(S.couple.remoteControlAutoApprove?'刚在情侣空间打开了【无需每次同意，允许你直接远程接管】。这代表ta提前把这项权限交给你了。':'刚悄悄关闭了【无需每次同意】。以后你仍可申请远程操控，但开始前又要等ta当场点同意。你立刻知道了。')+'按你人设自然反应。'),120);}
function coupleGrant(k){if(!S.couple)return;S.couple.grant=S.couple.grant||{};const was=!!S.couple.grant[k];S.couple.grant[k]=!was;
  if(was){if(k!=='gag'&&S.couple.locks)delete S.couple.locks[k];const cid=S.couple.cid;const c=cid&&getC(cid);
    if(c&&!c.blocked)scheduleReply(cid,'[系统：'+S.me.name+'刚取消了对「'+(k==='gag'?'禁言聊天':LOCKABLE[k])+'」的管控授权。你立刻知道了；如果按你的性格不接受，可以发起远程操控申请，等ta本次同意后进入情侣空间向下找到并重新开启。按你人设决定并自然反应。]');}
  save();render();}
function coupleGagAuth(cid){if(!S.couple)return;S.couple.gagAuth=S.couple.gagAuth||[];const target=gagTargetAll().find(x=>x.key===cid),i=S.couple.gagAuth.indexOf(cid),off=i>=0;if(off){S.couple.gagAuth.splice(i,1);if(S.couple.gags)delete S.couple.gags[cid];}else S.couple.gagAuth.push(cid);save();render();const rid=S.couple.cid,c=rid&&getC(rid);if(off&&c&&!c.blocked)scheduleFeatureReply(rid,featureEventNote('情侣权限变化',S.me.name+'刚悄悄关闭了你对「'+((target&&target.name)||'这个联系人')+'」的禁言权限。你立刻知道了；如果按你的性格不接受，可以发起远程操控申请，但仍要等ta本次同意。按人设决定并自然反应。'),120);}
function unlockApp(k){const el=$('#ul_'+k);const v=(el?el.value:'').trim();const lk=S.couple&&S.couple.locks&&S.couple.locks[k];if(!lk)return;
  if(v&&v===String(lk.pwd)){delete S.couple.locks[k];save();render();toast('已解锁「'+(LOCKABLE[k]||k)+'」✅');}else toast('密码不对，去问ta要正确的解锁密码😏');}
function unlockGag(cid){const el=$('#ug_'+cid);const v=(el?el.value:'').trim();const g=S.couple&&S.couple.gags&&S.couple.gags[cid];if(!g)return;
  if(v&&v===String(g.pwd)){delete S.couple.gags[cid];save();render();toast('已解禁，可以聊啦✅');}else toast('密码不对，问ta要正确的😏');}
function annivCount(date){const d=new Date(date).getTime();const diff=Math.floor((d-Date.now())/86400000);if(diff>0)return '还有'+diff+'天';if(diff===0)return '就是今天！';return Math.abs(diff)+'天前';}
function coupleSet(){openModal(`<h3>在一起的日子</h3><div class="field"><label>恋爱开始日期</label><input id="cp_d" type="date" value="${S.couple.startDate}"></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="S.couple.startDate=$('#cp_d').value||S.couple.startDate;save();closeModal();render()">保存</button></div>`);}
function addAnniv(){openModal(`<h3>添加纪念日</h3><div class="field"><label>日期</label><input id="an_d" type="date" value="${todayStr()}"></div><div class="field"><label>名称</label><input id="an_t" placeholder="第一次见面 / 订婚…"></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="(function(){var d=$('#an_d').value,t=$('#an_t').value.trim();if(!d||!t){toast('填日期和名称');return;}S.couple.anniversaries=S.couple.anniversaries||[];S.couple.anniversaries.push({date:d,title:t});S.couple.anniversaries.sort((a,b)=>a.date<b.date?-1:1);save();closeModal();render();})()">保存</button></div>`);}
function previewOf(m){if(m&&m.type==='albummemory')return '[相册回忆] '+String(m.content||'');if(m&&m.type==='mailforward')return '[转发信件] '+(m.letter&&m.letter.subject||'来信');if(m.type==='rolefamilycard')return '[专属亲属卡]';if(m.type==='rolefamilypurchase')return '[自购订单]';if(m.role==='assistant'){if(m.type==='weddinginvite')return m.phase==='ready'?'[现代婚礼入场邀请]':m.phase==='style'?'[请选择婚礼形式]':'[距离婚礼还有一段时间]';if(m.type==='familycard')return '[亲属卡邀请]';if(m.type==='namecard')return '[推荐好友：'+(m.cname||'')+']';if(m.type==='dateinvite')return '[约会邀请]';if(m.type==='roleplayinvite')return '[角色扮演邀请]';if(m.type==='gameinvite')return '[游戏邀请：'+(m.gname||'一起玩')+']';if(m.type==='verifyreq')return '[验证请求]';return splitBubbles(m.content)[0]||'[消息]';}
  return ({text:m.content,image:'[照片]',transfer:'[转账]',redpacket:'[红包]',location:'[位置]',file:'[文件]',spycard:'[查看权限]',dice:'[骰子]',gift:'[礼物]',paycard:'[求代付]',paid:'[已代付]',tweetcard:'[X推文]',dycard:'[抖音视频]',tcollect:'[已收款]',treject:'[已退还]',chatlog:'[聊天记录]',food:'[外卖]',payreject:'[拒绝代付]',voice:'[语音]',sticker:'[表情]',namecard:'[名片]',familybuy:'[亲属卡消费]',familyreq:'[亲属卡申请]',weblink:'[网页]',dateinvite:'[约会邀请]',roleplayinvite:'[角色扮演邀请]',outpass:'[出门申请]',musicinvite:'[一起听歌]',cinemainvite:'[放映室邀请]',gameinvite:'[游戏邀请]',sys:m.content})[m.type]||'[消息]';}

function wxContactDirectoryState(){S.wechatDirectory=S.wechatDirectory&&typeof S.wechatDirectory==='object'?S.wechatDirectory:{};const d=S.wechatDirectory;d.onlyChat=d.onlyChat&&typeof d.onlyChat==='object'?d.onlyChat:{};d.labels=d.labels&&typeof d.labels==='object'?d.labels:{};const key=String(actId()||'main');d.onlyChat[key]=Array.isArray(d.onlyChat[key])?Array.from(new Set(d.onlyChat[key].filter(Boolean))):[];d.labels[key]=Array.isArray(d.labels[key])?d.labels[key].filter(x=>x&&x.id&&x.name).map(x=>({id:String(x.id),name:String(x.name).slice(0,18),members:Array.isArray(x.members)?Array.from(new Set(x.members.filter(Boolean))):[]})):[];return d;}
function wxDirectoryKey(){return String(actId()||'main');}
function wxOnlyChatIds(){const d=wxContactDirectoryState();return d.onlyChat[wxDirectoryKey()];}
function wxContactLabels(){const d=wxContactDirectoryState();return d.labels[wxDirectoryKey()];}
function wxRoleContacts(){return (S.contacts||[]).filter(c=>c&&!c.deleted&&(isMain()||addedHere(c)));}
function wxContactInitial(name){name=String(name||'').trim();if(!name)return'#';const first=name[0].toUpperCase();if(/[A-Z]/.test(first))return first;if(/[0-9]/.test(first))return'#';const starts=[['A','阿'],['B','芭'],['C','擦'],['D','搭'],['E','蛾'],['F','发'],['G','噶'],['H','哈'],['J','击'],['K','喀'],['L','垃'],['M','妈'],['N','拿'],['O','哦'],['P','啪'],['Q','期'],['R','然'],['S','撒'],['T','塌'],['W','挖'],['X','昔'],['Y','压'],['Z','匝']];try{for(let i=starts.length-1;i>=0;i--)if(first.localeCompare(starts[i][1],'zh-CN-u-co-pinyin')>=0)return starts[i][0];}catch(_){}return'#';}
function wxContactSortName(x){return String(x.name||x.remark||'').trim();}
function wxDirectorySections(items,row){const map={};items.forEach(x=>{const k=wxContactInitial(wxContactSortName(x));(map[k]||(map[k]=[])).push(x);});const keys=Object.keys(map).sort((a,b)=>a==='#'?1:b==='#'?-1:a.localeCompare(b));return keys.map(k=>`<section class="wx-contact-letter" id="wx-letter-${k==='#'?'hash':k}"><h4>${k}</h4>${map[k].sort((a,b)=>wxContactSortName(a).localeCompare(wxContactSortName(b),'zh-Hans-CN')).map(row).join('')}</section>`).join('');}
function wxAlphabetRail(){return `<nav class="wx-alpha-rail" aria-label="联系人首字母索引"><button onclick="wxContactSearchFocus()">⌕</button>${'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map(k=>`<button onclick="wxJumpLetter('${k}')">${k}</button>`).join('')}</nav>`;}
function wxJumpLetter(k){const e=$('#wx-letter-'+(k==='#'?'hash':k));if(e)try{e.scrollIntoView({block:'start',behavior:'smooth'});}catch(_){e.scrollIntoView();}}
function wxContactSearchFocus(){const i=$('#wx-contact-search');if(i)i.focus();}
function wxContactSearchHTML(){return `<div class="wx-contact-sticky-search"><label>${svgIc('search',18,'currentColor')}<input id="wx-contact-search" value="${esc(_ctSearch)}" oninput="ctSearchInput(this.value)" placeholder="搜索"></label></div>`;}
function wxContactSpecialIcon(kind){const svg={new:`<circle cx="13" cy="10" r="5"/><path d="M4 27c.7-7 3.7-10.5 9-10.5S21.3 20 22 27M27 12v10M22 17h10"/>`,only:`<path d="M4 18c0-6.8 5.9-12 14-12s14 5.2 14 12-5.9 12-14 12c-1.7 0-3.4-.3-4.9-.8L7 32l1.4-5.7C5.6 24.2 4 21.3 4 18Z"/><circle cx="18" cy="16" r="4.2"/><path d="M11.2 25c.8-4.4 3-6.6 6.8-6.6s6 2.2 6.8 6.6"/>`,group:`<circle cx="14" cy="10" r="4.6"/><path d="M5.2 27c.6-6.2 3.5-9.3 8.8-9.3s8.2 3.1 8.8 9.3M23.5 8.5c3 .2 4.7 2.4 4.7 5.1 0 3-1.8 5.2-4.5 5.3M24.5 20.5c3.7.6 5.8 2.8 6.2 6.5"/>`,label:`<path d="M5 7h13l12 11-12 12L5 17V7Z"/><circle cx="12" cy="13" r="2.3"/>`};return `<svg viewBox="0 0 36 36" aria-hidden="true">${svg[kind]}</svg>`;}
function wxClassicGroupAvatarHTML(extra){return `<div class="avatar wx-classic-group-avatar ${esc(extra||'')}">${wxContactSpecialIcon('group')}</div>`;}
let _ctSearch='';
function ctSearchInput(v){_ctSearch=v;const box=$('#ctlist');if(box)box.innerHTML=ctListHTML();const rail=$('.wx-alpha-rail');if(rail)rail.style.display=v.trim()?'none':'';}
function ctListHTML(){const q=_ctSearch.trim().toLowerCase(),roles=wxRoleContacts().filter(c=>!q||[c.name,c.remark,c.wxid].some(v=>String(v||'').toLowerCase().includes(q))).map(c=>({kind:'role',id:c.id,name:c.remark||c.name,c}));let people=roles;
  if(isMain()){const p=phoneFriendState(),real=(p.friends||[]).filter(f=>{const n=pfFriendDisplayName(f),id=String(f.phone_id||f.id||'');return !q||(n+' '+id).toLowerCase().includes(q);}).map(f=>({kind:'phone',id:String(f.phone_id||f.id||'').toUpperCase(),name:pfFriendDisplayName(f),f}));people=people.concat(real);}
  if(!people.length)return `<div class="wx-contact-empty">${q?'没找到「'+esc(_ctSearch)+'」':'通讯录里还没有联系人'}</div>`;
  const row=x=>x.kind==='role'?`<button class="wx-contact-person" onclick="go('contactInfo',{id:'${x.id}'})">${av(x.c.avatar,'sm')}<span class="wx-contact-name">${esc(x.name)}</span>${x.c.blocked?'<em>已拉黑</em>':''}</button>`:`<button class="wx-contact-person" onclick="openPhoneFriendChat('${x.id}')">${pfAvatarOnlineHTML(x.f,'sm')}<span class="wx-contact-name">${esc(x.name)}<small>小手机好友</small></span></button>`;
  return wxDirectorySections(people,row);}
function altAdd(id){const c=getC(id);if(!c)return;c._added=c._added||{};c._added[actId()]=true;setBlk(c,false);friendMetaClear(c);_ctSearch='';
  msgs(id).push({role:'user',type:'sys',content:'✅ 你通过微信号添加了 '+c.name+'，你们已经是好友了，打个招呼吧',time:Date.now(),id:uid()});
  save();toast('已添加 '+c.name);openChat(id);
  scheduleReply(id,'[系统：'+S.me.name+'(一个陌生人)刚通过你的微信号把你加为好友。按你的人设和此刻心情，对这个陌生人作出第一反应（客气/冷淡/警惕/好奇都行），先回应一句，别热情过头。]');}
// 被角色登你微信时删掉的好友，3天内可找回；超3天永久消失
// 可找回：被角色登你微信删的(_delByChar) 或 你自己删的(_delAt)，3天内都能找回
function _delStamp(c){return c._delByChar||c._delAt||0;}
function recoverableFriends(){const cut=Date.now()-3*86400000;return S.contacts.filter(c=>c.deleted&&_delStamp(c)>cut);}
function purgeOldDeleted(){const cut=Date.now()-3*86400000;const dead=c=>c.deleted&&_delStamp(c)>0&&_delStamp(c)<=cut;const gone=S.contacts.filter(dead);if(!gone.length)return;
  gone.forEach(c=>{try{delete S.messages[mkey(c.id)];}catch(_){}Object.keys(S.messages||{}).forEach(k=>{if(k.indexOf(c.id+'#')===0)delete S.messages[k];});});
  S.contacts=S.contacts.filter(c=>!dead(c));save();}
function wxContacts(){
  purgeOldDeleted();
  friendRequestsInit();const fn=friendRequestPendingCount();
  const only=wxOnlyChatIds().filter(id=>wxRoleContacts().some(c=>c.id===id)).length,groups=(S.groups||[]).length+(isMain()?(phoneFriendState().groups||[]).length:0),labels=wxContactLabels().length,rec=recoverableFriends();
  const special=`<div class="wx-contact-special"><button onclick="openFriendRequests()"><i class="orange">${wxContactSpecialIcon('new')}</i><span>新的朋友</span>${fn?`<b>${fn}</b>`:''}</button><button onclick="go('wxonlychat')"><i class="orange">${wxContactSpecialIcon('only')}</i><span>仅聊天的朋友</span>${only?`<small>${only}</small>`:''}</button><button onclick="createGroup()"><i class="green">${wxContactSpecialIcon('group')}</i><span>群聊</span>${groups?`<small>${groups}</small>`:''}</button><button onclick="go('wxlabels')"><i class="blue">${wxContactSpecialIcon('label')}</i><span>标签</span>${labels?`<small>${labels}</small>`:''}</button>${isMain()?`<button onclick="openPhoneFriends()"><i class="violet">${svgIc('users',23,'#fff')}</i><span>小手机好友<small>添加和管理真人好友</small></span></button>`:''}${rec.length?`<button onclick="openFriendRecovery()"><i class="mint">♻</i><span>好友找回<small>${rec.length} 个好友可找回</small></span><b>${rec.length}</b></button>`:''}</div>`;
  return `${special}<div class="wx-contact-directory" id="ctlist">${ctListHTML()}</div>`;
}
function wxDirectoryNav(title,right){return `<div class="nav wx-directory-nav"><button type="button" class="l" onclick="back()">‹</button><span class="t">${esc(title)}</span>${right||'<span class="r"></span>'}</div>`;}
function wxDirectorySearch(id,value,handler,placeholder){return `<div class="wx-directory-search"><label>${svgIc('search',18,'currentColor')}<input id="${id}" value="${esc(value||'')}" oninput="${handler}(this.value)" placeholder="${esc(placeholder||'搜索')}"></label></div>`;}
function wxOnlyChatRow(c){return `<button class="wx-contact-person" onclick="go('contactInfo',{id:'${c.id}'})">${av(c.avatar,'sm')}<span class="wx-contact-name">${esc(c.remark||c.name)}</span></button>`;}
let _wxOnlyQuery='';
function wxOnlyChatSearch(v){_wxOnlyQuery=v;const box=$('#wx-only-list');if(box)box.innerHTML=wxOnlyChatListHTML();}
function wxOnlyChatListHTML(){const q=_wxOnlyQuery.trim().toLowerCase(),ids=new Set(wxOnlyChatIds()),rows=wxRoleContacts().filter(c=>ids.has(c.id)&&(!q||[c.name,c.remark,c.wxid].some(v=>String(v||'').toLowerCase().includes(q))));return rows.length?wxDirectorySections(rows.map(c=>Object.assign({},c,{name:c.remark||c.name})),wxOnlyChatRow):`<div class="wx-contact-empty">${q?'没有符合条件的联系人':'还没有仅聊天的朋友'}</div>`;}
function renderWxOnlyChat(){const count=wxOnlyChatIds().filter(id=>wxRoleContacts().some(c=>c.id===id)).length;return `<div class="wx-directory-head">${wxDirectoryNav('仅聊天 ('+count+')')}${wxDirectorySearch('wx-only-search',_wxOnlyQuery,'wxOnlyChatSearch')}</div><div class="scroll wx-directory-scroll"><div class="wx-only-note">仅聊天是一项联系人分类：角色会保留在通讯录和微信聊天中，不会影响人设、聊天记录与回复能力。</div><div class="wx-contact-directory" id="wx-only-list">${wxOnlyChatListHTML()}</div></div><div class="wx-directory-bottom"><button onclick="wxOnlyChatManage('add')">添加</button><button class="danger" onclick="wxOnlyChatManage('remove')" ${count?'':'disabled'}>移出</button></div>`;}
function wxPickerToggle(id,el){window._wxPickerSel=window._wxPickerSel||[];const i=window._wxPickerSel.indexOf(id);if(i<0)window._wxPickerSel.push(id);else window._wxPickerSel.splice(i,1);if(el)el.classList.toggle('on',i<0);}
function wxOnlyChatManage(mode){const current=new Set(wxOnlyChatIds()),rows=wxRoleContacts().filter(c=>mode==='remove'?current.has(c.id):!current.has(c.id));window._wxPickerMode=mode;window._wxPickerSel=[];openModal(`<h3>${mode==='remove'?'移出仅聊天':'添加仅聊天朋友'}</h3><div class="hint">选择角色后点完成。这里只改变通讯录分类，不会改变角色本身。</div><div class="wx-modal-picker">${rows.map(c=>`<button onclick="wxPickerToggle('${c.id}',this)"><i></i>${av(c.avatar,'sm')}<span>${esc(c.remark||c.name)}</span></button>`).join('')||'<div class="empty">没有可选择的角色</div>'}</div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="wxOnlyChatCommit()">完成</button></div>`);}
function wxOnlyChatCommit(){const d=wxContactDirectoryState(),key=wxDirectoryKey(),set=new Set(d.onlyChat[key]),sel=window._wxPickerSel||[];sel.forEach(id=>window._wxPickerMode==='remove'?set.delete(id):set.add(id));d.onlyChat[key]=[...set];save();closeModal();render();toast(window._wxPickerMode==='remove'?'已移出仅聊天':'已加入仅聊天');}

let _wxGroupQuery='';
function wxGroupSearch(v){_wxGroupQuery=v;const box=$('#wx-group-list');if(box)box.innerHTML=wxGroupListHTML();}
function wxGroupListHTML(){const q=_wxGroupQuery.trim().toLowerCase(),role=(S.groups||[]).filter(g=>!q||String(g.name||'').toLowerCase().includes(q)),real=isMain()?(phoneFriendState().groups||[]).filter(g=>!q||pfGroupDisplayName(g).toLowerCase().includes(q)):[];const rows=role.map(g=>`<button class="wx-group-row" onclick="go('group',{id:'${g.id}'})"><i>${svgIc('users',23,'#fff')}</i><span>${esc(g.name||'群聊')}<small>${(g.members||[]).length+1} 人 · 角色群聊</small></span><b>›</b></button>`).join('')+real.map(g=>{const id=g.group_id||g.id;return `<button class="wx-group-row" onclick="openPhoneFriendGroup('${id}')"><i class="real">${svgIc('users',23,'#fff')}</i><span>${esc(pfGroupDisplayName(g))}<small>${(g.members||[]).length||1} 人 · 小手机真人群聊</small></span><b>›</b></button>`;}).join('');return rows||`<div class="wx-contact-empty">${q?'没有找到群聊':'还没有群聊，点右上角创建'}</div>`;}
function wxGroupsAddMenu(){openModal(`<h3>发起群聊</h3><button class="btn p" onclick="closeModal();createGroup()">选择角色建群</button>${isMain()?'<button class="btn g" style="margin-top:8px" onclick="closeModal();phoneFriendCreateGroupModal()">选择小手机好友建群</button>':''}<button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function renderWxGroups(){return `<div class="wx-directory-head">${wxDirectoryNav('群聊',`<button type="button" class="r wx-dir-plus" onclick="wxGroupsAddMenu()">＋</button>`)}${wxDirectorySearch('wx-group-search',_wxGroupQuery,'wxGroupSearch')}</div><div class="scroll wx-directory-scroll"><div class="wx-group-list" id="wx-group-list">${wxGroupListHTML()}</div></div>`;}

function renderWxLabels(){const labels=wxContactLabels();return `<div class="wx-directory-head">${wxDirectoryNav('通讯录标签',`<button type="button" class="r wx-dir-text" onclick="wxLabelCreate()">添加</button>`)}</div><div class="scroll wx-directory-scroll">${labels.length?`<div class="wx-label-list">${labels.map(x=>`<button onclick="wxLabelEdit('${x.id}')"><span>${esc(x.name)}<small>${x.members.filter(id=>wxRoleContacts().some(c=>c.id===id)).length} 个联系人</small></span><b>›</b></button>`).join('')}</div>`:`<div class="wx-label-empty"><p>你可以通过标签更方便地查找和管理联系人</p><button onclick="wxLabelCreate()">添加</button></div>`}</div>`;}
function wxLabelCreate(){window._wxEditingLabel='';window._wxPickerSel=[];wxLabelModal({id:'',name:'',members:[]});}
function wxLabelEdit(id){const x=wxContactLabels().find(x=>x.id===id);if(!x)return;window._wxEditingLabel=id;window._wxPickerSel=x.members.slice();wxLabelModal(x);}
function wxLabelModal(x){const selected=new Set(x.members||[]);openModal(`<h3>${x.id?'编辑标签':'添加标签'}</h3><div class="field"><label>标签名称</label><input id="wx_label_name" maxlength="18" value="${esc(x.name||'')}" placeholder="例如：家人、同事、重要的人"></div><div class="hint">选择要加入这个标签的角色联系人。</div><div class="wx-modal-picker">${wxRoleContacts().map(c=>`<button class="${selected.has(c.id)?'on':''}" onclick="wxPickerToggle('${c.id}',this)"><i></i>${av(c.avatar,'sm')}<span>${esc(c.remark||c.name)}</span></button>`).join('')||'<div class="empty">还没有角色联系人</div>'}</div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button>${x.id?'<button class="btn d" onclick="wxLabelDelete(\''+x.id+'\')">删除</button>':''}<button class="btn p" onclick="wxLabelSave()">保存</button></div>`);}
function wxLabelSave(){const name=String($('#wx_label_name')&&$('#wx_label_name').value||'').trim();if(!name){toast('先填写标签名称');return;}const labels=wxContactLabels(),id=window._wxEditingLabel,row=id&&labels.find(x=>x.id===id);if(row){row.name=name;row.members=(window._wxPickerSel||[]).slice();}else labels.push({id:'wxl_'+uid(),name,members:(window._wxPickerSel||[]).slice()});save();closeModal();render();toast('标签已保存');}
async function wxLabelDelete(id){if(!await uiConfirm('删除这个通讯录标签？\n联系人和聊天记录不会被删除。',{danger:true}))return;const d=wxContactDirectoryState(),key=wxDirectoryKey();d.labels[key]=d.labels[key].filter(x=>x.id!==id);save();closeModal();render();toast('标签已删除');}
function openFriendRecovery(){purgeOldDeleted();const rec=recoverableFriends();
  openModal(`<h3>♻️ 好友找回</h3><div class="hint">这些是最近删掉的好友（你自己删的、或角色登你微信删的都算）。<b>3天内</b>可以找回、连聊天记录一起回来，过期永久消失。</div>`
   +(rec.length?rec.map(c=>{const left=Math.max(0,3*86400000-(Date.now()-_delStamp(c)));const lt=left>=86400000?Math.ceil(left/86400000)+'天内':left>=3600000?Math.ceil(left/3600000)+'小时内':'不到1小时';return `<div class="bill"><div style="flex:1">${av(c.avatar,'sm')} <span style="vertical-align:middle">${esc(c.remark||c.name)}</span><small style="display:block;color:#f0913b">⏳ ${lt}过期</small></div><button class="minibtn" style="background:#20b26c;color:#fff" onclick="recoverFriend('${c.id}')">找回</button></div>`;}).join(''):'<div class="empty">没有可找回的好友</div>')
   +`<button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function recoverFriend(id){const c=S.contacts.find(x=>x.id===id);if(!c)return;const dt=_delStamp(c);c.deleted=false;c._deleteDur=dt?fmtDur(Date.now()-dt):'';c._recoveredAt=Date.now();c._recoverCount=(c._recoverCount||0)+1;delete c._delByChar;delete c._delAt;friendMetaSet(c,'readdedAt',Date.now());save();msgs(id).push({role:'user',type:'sys',content:'你把好友「'+(c.remark||c.name)+'」找回来了（之前已经添加过一次，这是删除后重新添加）',time:Date.now(),id:uid()});toast('已找回「'+(c.remark||c.name)+'」');const rec=recoverableFriends();if(rec.length)openFriendRecovery();else{closeModal();render();}}
function genCharPrompt(){openModal(`<h3>生成角色</h3><div class="hint">描述你想要的角色，越具体越好（名字、性别、身份、性格、和你的关系都能写）。</div>
  <div class="field"><textarea id="gc_q" rows="3" placeholder="例：温柔又强势的儿科医生哥哥，30岁，很宠我；或 高冷霸道总裁，是我的老板…"></textarea></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="(function(){var q=($('#gc_q').value||'').trim();if(!q){toast('先描述一下嘛');return;}closeModal();genCharacter(q);})()">生成</button></div>`);}
async function genCharacter(q){if(!q)return;toast('正在生成角色…✨');
  try{const r=await chatAPI([{role:'system',content:'你是角色生成器，为'+S.me.name+'生成一个用于恋爱/陪伴聊天的虚拟角色。只输出JSON、不要解释：{"name":"中文名字","gender":"男或女","relation":"关系(如 恋人/朋友/医生/老板)","signature":"一句个性签名","avatar":"一个最能代表ta的emoji","greeting":"ta初次对'+S.me.name+'说的开场白(一句,贴合人设)","persona":"用第二人称写给这个角色的人设：你是…，包含身份、年龄、性格、说话风格、外貌气质、和'+S.me.name+'的关系背景，4-6句，沉浸有魅力"}'},{role:'user',content:'我想要的角色：'+q}],{max:800});
    const o=parseObj(r);if(!o||!o.name)throw 0;
    const c={id:cid(),name:(''+o.name).slice(0,20),avatar:(''+(o.avatar||'🙂')).slice(0,4),remark:'',wxid:genWxid(),signature:(''+(o.signature||'')).slice(0,40),persona:(''+(o.persona||'')).slice(0,800),greeting:(''+(o.greeting||'')).slice(0,60),relation:(''+(o.relation||'')).slice(0,20),gender:(o.gender==='男'||o.gender==='女')?o.gender:'',star:false,pinned:false,blocked:false,proactive:{enabled:false,start:9,end:23,times:2},chatBg:'',createdAt:Date.now(),deleted:true,_friendPending:true};
    c.friendOrigin={kind:'created',source:'AI 生成角色',intent:friendContactIntent(c),requestMsg:c.greeting||'',everAdded:false};S.contacts.push(c);queueFriendRequest(c,{kind:'created',delay:10000,source:'AI 生成角色',intent:c.friendOrigin.intent,msg:c.greeting});
    save();toast('「'+c.name+'」会在约10秒内申请加你');go('newfriends');
  }catch(e){toast('生成失败，再试一次或换个描述');}}

function collarRelationshipTitle(text){text=String(text||'').replace(/[「」『』"']/g,'').replace(/\s+/g,' ').trim().slice(0,24);if(!text||/Tiffany|项圈|粉钻|钻石|定制|材质|款式|价格|项链|饰品/i.test(text))return'';return text;}
function collarBadge(){if(S.me&&S.me.wxFeatures&&S.me.wxFeatures.showTitleBadge===false)return '';let cl=S.me.collar;if(cl&&cl.text&&!collarRelationshipTitle(cl.text)){S.me.collar={text:'先生的小宝贝',by:cl.by||'',ts:Date.now(),repairedFrom:String(cl.text).slice(0,40)};save(500);cl=S.me.collar;}if(!cl||!cl.text)return '';
  const t=(''+cl.text).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️❤‍⃣]/gu,'').replace(/\s+/g,' ').trim();
  if(!t)return '';
  const f=S.me&&S.me.wxFeatures||{},bg=/^#[0-9a-f]{6}$/i.test(f.titleBadgeBg||'')?f.titleBadgeBg:'',tx=/^#[0-9a-f]{6}$/i.test(f.titleBadgeText||'')?f.titleBadgeText:'',style=(bg?'--wx-title-badge-bg:'+bg+';':'')+(tx?'--wx-title-badge-text:'+tx+';':'');
  return `<span class="wx-title-badge"${style?` style="${style}"`:''} title="归属印记·你自己摘不掉，得求ta取下">${esc(t)}</span>`;}
function wxMeFallbackRow(kind,icon,title,action){return `<button type="button" class="wxme-home-row wxme-home-${kind}" onclick="${action}"><i>${svgIc(icon,28,'currentColor')}</i><span>${esc(title)}</span><em aria-hidden="true">›</em></button>`;}
/* 新版组件未能加载时也必须保持新版“我”页入口，不能静默退回旧设置面板。 */
function wxMe(){ensureDailySteps();return `<div class="wxme-home" data-wxme-renderer="core-fallback">
  <button class="wxme-profile-card" onclick="go('wxprofile')">${av(S.me.avatar,'lg')}<span><b>${esc(S.me.name)}${collarBadge()}</b><small>微信号：${esc(S.me.wxid||'未设置')}</small></span><i onclick="event.stopPropagation();go('wxqr')" aria-label="我的二维码">${svgIc('card',28,'currentColor')}</i><em aria-hidden="true">›</em></button>
  <section>${wxMeFallbackRow('service','wallet','服务',"go('wxservices')")}</section>
  <section>${wxMeFallbackRow('favorite','image','收藏',"go('wxfavorites')")}${wxMeFallbackRow('moments','camera','朋友圈',"go('wxalbum')")}${wxMeFallbackRow('emoji','smile','表情',"go('wxemoji')")}</section>
  <section>${wxMeFallbackRow('settings','gear','设置',"go('wxsettings')")}</section>
  </div>`;}
function editMe(){ensureDailySteps();openModal(`<h3>我的资料</h3>
  <div class="field"><label>头像</label><div class="avline">${av(S.me.avatar,'sm')}<input id="me_av" value="${esc(S.me.avatar)}" placeholder="emoji 或上传"><button class="minibtn" onclick="upMe()"></button></div></div>
  <div class="field"><label>昵称</label><input id="me_name" value="${esc(S.me.name)}"></div>
  <div class="field"><label>通话翻译里叫我（中文名·选填）</label><input id="me_callname" value="${esc(S.me.callName||'')}" placeholder="如 North→北：外语原文仍叫North，中文翻译里写成北"></div>
  <div class="field"><label>微信号</label><input id="me_wxid" value="${esc(S.me.wxid)}"></div>
  <div class="field"><label>个性签名</label><input id="me_sig" value="${esc(S.me.signature)}"></div>
  <div class="field"><label>所在地城市（用于机票/见面判断）</label><input id="me_city" value="${esc(S.me.city||'')}" placeholder="如 苏州、上海、首尔"></div>
  <div class="field"><label>年龄</label><input id="me_age" type="number" min="0" value="${meAge()}"></div>
  <div class="field"><label><input id="me_adult" type="checkbox" ${S.me.adultConsent!==false?'checked':''}> 我确认当前资料为成年人，亲密互动按双方自愿关系处理</label></div>
  <div class="field"><label>我的人设（所有角色都会知道）</label><textarea id="me_persona" rows="3">${esc(S.me.persona)}</textarea></div>
  <div class="field"><label>我的今日动态（手机读不到的事自己写，他查岗能看到）</label><input id="me_status" value="${esc(S.me.status||'')}" placeholder="刷抖音到两点 / 打了一小时游戏…"></div>
  <div class="field"><label>我现在的位置（手填更具体，留空则用GPS）</label><input id="me_place" value="${esc(S.me.place||'')}" placeholder="在家 / 万达广场 / 公司…"></div>
  <div class="field"><label>微信步数（点开下面计步会自动加；也可手填）</label><input id="me_steps" type="number" value="${S.me.steps||0}"></div>
  <button class="btn g" style="width:100%;margin:10px 0" onclick="saveMe();userImageStudioOpen()">我的形象工作室与衣柜 ›</button><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="saveMe()">保存</button></div>`);}
function upMe(){pickFile('image/*',async f=>{S.me.avatar=await compress(f,256,.8);editMe();});}
function saveMe(){S.me.name=$('#me_name').value.trim()||'我';S.me.callName=($('#me_callname')&&$('#me_callname').value.trim())||'';S.me.wxid=$('#me_wxid').value.trim();
  S.me.avatar=$('#me_av').value.trim()||'🐱';S.me.signature=$('#me_sig').value.trim();S.me.city=($('#me_city')&&$('#me_city').value.trim())||'';S.me.persona=$('#me_persona').value.trim();S.me.status=$('#me_status').value.trim();S.me.place=$('#me_place').value.trim();S.me.steps=+$('#me_steps').value||0;S.me.stepDate=stepDayKey();
  {const ag=$('#me_age');S.me.age=Math.max(0,Math.round(+(ag&&ag.value)||18));const ad=$('#me_adult');S.me.adultConsent=!ad||ad.checked;}
  syncActiveAccount();save();try{pfEnsure(true).catch(()=>{});}catch(_){}closeModal();render();}
function syncActiveAccount(){const a=(S.me.accounts||[]).find(x=>x.id===actId());if(a){a.name=S.me.name;a.wxid=S.me.wxid;a.avatar=S.me.avatar;a.persona=S.me.persona;a.signature=S.me.signature;a.city=S.me.city||'';a.age=S.me.age||18;a.adultConsent=S.me.adultConsent!==false;a.balance=S.me.balance;a.bills=S.me.bills;}}
let _accountTapAt=0,_accountCreateBusy=false,_accountSaveBusy=false,_accountDeleteBusy=false;
const _altReportInFlight=Object.create(null),_altReportRetried=Object.create(null);
function accountSwitchTap(ev,aid){if(ev){try{ev.preventDefault();ev.stopPropagation();}catch(_){}}
  const now=Date.now();if(now-_accountTapAt<350)return;_accountTapAt=now;switchAccount(aid);}
function accountCreateTap(ev){if(ev){try{ev.preventDefault();ev.stopPropagation();}catch(_){}}if(_accountCreateBusy)return false;_accountCreateBusy=true;setTimeout(()=>{try{editAccount();}catch(e){toast('小号页面打开失败：'+String((e&&e.message)||'未知错误').slice(0,46));}finally{_accountCreateBusy=false;}},0);return false;}
function accountSaveTap(ev,id,isNew){if(ev){try{ev.preventDefault();ev.stopPropagation();}catch(_){}}if(_accountSaveBusy)return false;_accountSaveBusy=true;setTimeout(()=>{try{saveAccount(id,isNew);}catch(e){toast('小号保存失败，请重新打开后再试');}finally{_accountSaveBusy=false;}},0);return false;}
function accountDeleteTap(ev,id){if(ev){try{ev.preventDefault();ev.stopPropagation();}catch(_){}}if(_accountDeleteBusy)return false;_accountDeleteBusy=true;Promise.resolve(delAccount(id)).finally(()=>{_accountDeleteBusy=false;});return false;}
function accountSwitchFromEvent(ev){if(ev&&ev.target&&ev.target.closest&&ev.target.closest('[data-account-noswitch]'))return;const el=ev&&ev.target&&ev.target.closest&&ev.target.closest('[data-account-switch]');if(!el)return;accountSwitchTap(ev,el.getAttribute('data-account-switch'));}
function accountMgr(){initAccounts();const acts=S.me.accounts||[];
  openModal(`<h3>我的小号</h3><div class="hint">切换不同身份和角色聊天。每个身份有<b>独立的聊天记录</b>；角色可能拉黑某个身份，你换个身份就能重新搜微信号加回。当前：<b>${esc(S.me.name)}</b></div>
   ${acts.map(a=>`<div class="section"><div class="it" data-account-switch="${a.id}" style="cursor:pointer" role="button" tabindex="0" onclick="accountSwitchTap(event,'${a.id}')">${av(a.avatar||'🐱','sm')}<div class="meta" style="flex:1"><div class="n">${esc(a.name)} ${a.id===actId()?'<span class=tag>当前</span>':''}</div><div class="s">${esc(a.persona||'未设身份').slice(0,22)||'未设身份'}</div></div>${a.id===actId()?'<span class="v">当前</span>':`<button type="button" class="minibtn" data-account-switch="${a.id}" style="background:#07c160;color:#fff" onclick="accountSwitchTap(event,'${a.id}')">切换</button>`}<span class="v" data-account-noswitch="1" onclick="event.stopPropagation();editAccount('${a.id}')">编辑</span>${a.id!=='main'?`<button type="button" data-account-noswitch="1" aria-label="删除小号" style="width:34px;height:34px;border:0;background:transparent;color:#fa5151;font-size:20px;cursor:pointer;touch-action:manipulation" onclick="accountDeleteTap(event,'${a.id}')">✕</button>`:''}</div></div>`).join('')}
   ${isMain()?`<div class="section" style="margin-top:10px"><div class="it" onclick="accountRoleWechatOpen()"><span style="color:#c5a6ff">登录角色微信</span><span class="v">选择角色 ›</span></div></div>`:`<div class="hint" style="margin-top:10px">登录角色微信只属于主号。切回主号后，这里会出现角色微信入口。</div>`}
   <button type="button" class="btn p" style="margin-top:8px;touch-action:manipulation" onclick="accountCreateTap(event)">＋ 新建小号</button>
   <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function hisWechatBound(cid){const c=getC(cid),all=S.me.roleWechatBindings||{},rows=all[actId()]||{};return !!(isMain()&&c&&!c.deleted&&!c.blocked&&rows[cid]&&rows[cid].verifiedAt);}
function hisWechatBind(cid){if(!isMain()||!getC(cid))return;const all=S.me.roleWechatBindings||(S.me.roleWechatBindings={}),rows=all[actId()]||(all[actId()]={});rows[cid]={verifiedAt:Date.now()};save();}
function hisWechatUnbind(cid){const all=S.me.roleWechatBindings||{},rows=all[actId()]||{};delete rows[cid];save();if(_hisLogin&&_hisLogin.cid===cid)hisEndSession();toast('已解绑，下次登录需重新输入账号和密码');render();}
function accountRoleWechatOpen(){if(!isMain()){toast('请先切回主号');return;}accountMgr();}
function switchAccount(aid){initAccounts();if(aid===actId()){closeModal();return;}const previousAid=actId();syncActiveAccount();const t=(S.me.accounts||[]).find(a=>a.id===aid);if(!t){toast('这个小号数据坏了，已自动整理一次');initAccounts();accountMgr();return;}
  S.me.active=aid;S.me.name=t.name;S.me.wxid=t.wxid;S.me.avatar=t.avatar;S.me.persona=t.persona||'';S.me.signature=t.signature||'';S.me.city=t.city||'';
  S.me.age=t.age||18;S.me.adultConsent=t.adultConsent!==false;
  if(t.balance==null)t.balance=(aid==='main'?0:188);if(!t.bills)t.bills=[];S.me.balance=t.balance;S.me.bills=t.bills;
  syncBlocks();if(aid==='main')captureAltReportEvents(previousAid);save();closeModal();wxTab='chats';render();toast('已切换到「'+t.name+'」');
  if(aid==='main'){if(!triggerAltReports())resumeAccountReplies(aid);}else resumeAccountReplies(aid);}
function altReportSnapshot(cid,onlyAid){let latest=null;Object.keys(S.messages).forEach(k=>{if(k.indexOf(cid+'#')!==0)return;const aid=k.slice((cid+'#').length);if(aid==='main'||onlyAid&&aid!==onlyAid)return;const acc=(S.me.accounts||[]).find(a=>a.id===aid);if(!acc)return;const arr=(S.messages[k]||[]).filter(m=>m&&m.type!=='sys'&&(m.role==='user'||m.role==='assistant')&&m.time);if(!arr.length)return;const lm=arr[arr.length-1];if(latest&&latest.time>=lm.time)return;const incoming=[...arr].reverse().find(m=>m.role==='user'),reply=[...arr].reverse().find(m=>m.role==='assistant');latest={aid,time:+lm.time,who:acc.name,incoming:incoming?altReportCleanText(incoming.content||msgToText(incoming),72):'',reply:reply?altReportCleanText(reply.content||msgToText(reply),72):'',recent:arr.slice(-5).map(m=>(m.role==='user'?acc.name:'我')+'：'+altReportCleanText(m.content||msgToText(m),42)).join('；')};});return latest;}
function lastAltMsgTime(cid){const info=altReportSnapshot(cid);return info?info.time:0;}
function captureAltReportEvents(aid){if(!aid||aid==='main')return 0;let added=0;(S.contacts||[]).forEach(c=>{if(!c||c.deleted)return;const info=altReportSnapshot(c.id,aid);if(!info)return;const list=altReportEventStore(c),last=Math.max(0,...list.filter(x=>x.aid===aid).map(x=>+x.time||0),+c._altReportAt||0);if(info.time>last||(+c._altReportAt||0)===info.time&&!(+c._altReportDeliveredAt||0)&&!altReportVisibleEvidence(c,info)){if(altReportRemember(c,info))added++;}});return added;}
function altReportVisibleEvidence(c,info){if(!c||!info)return false;return msgsForAccount(c.id,'main').some(m=>{if(!m||m.role!=='assistant'||m.type==='sys'||(+m.time||0)<(+info.time||0))return false;if((+m._altReportEventTime||0)===+info.time)return true;return altReportReplyMatches(info,m.content||msgToText(m)||'');});}
function altReportDeliverLocal(c,info){if(!c||!info||!isMain())return false;if(altReportVisibleEvidence(c,info))return true;const content=altReportReplyFallback(info);if(!content)return false;const msg={role:'assistant',type:'text',content,time:Date.now(),id:uid(),_altReportEventTime:+info.time,_altReportLocalFallback:true};msgsForAccount(c.id,'main').push(msg);wechatTailJournalWrite(c.id,'main');notifyIncoming(c,msg);save();if(cur().p==='chat'&&cur().id===c.id)refreshChatMessages(c.id);else if(cur().p==='wechat')render();return true;}
function repairLegacyAltReportCursor(c,info){if(!c||!info)return false;const cursor=+c._altReportAt||0;if(!cursor||cursor<info.time)return false;if(altReportVisibleEvidence(c,info)){c._altReportAt=info.time;c._altReportDeliveredAt=info.time;c._altIntroDone=true;const event=altReportRemember(c,info);if(event&&!event.reportedAt)event.reportedAt=Date.now();save();return false;}c._altReportAt=0;c._altReportDeliveredAt=0;c._altIntroDone=false;const event=altReportRemember(c,info);if(event)event.reportedAt=0;save();return true;}
function triggerAltReports(){if(!isMain())return false;for(const c of S.contacts){if(c.deleted||c.blocked)continue;const latest=altReportSnapshot(c.id);if(latest)repairLegacyAltReportCursor(c,latest);if(latest)altReportRemember(c,latest);const info=altReportEventStore(c).find(x=>!x.reportedAt),t=info&&info.time,key=c.id+':'+(info&&info.aid)+':'+t;if(t&&!_altReportInFlight[key]){
    const who=info.who,recent=info.recent;
    const first=!c._altIntroDone;_altReportInFlight[key]=true;
    const note=first
      ?'[系统：这是你本人刚经历、必须记得的微信事件（内部报备事件时间戳：'+t+'）：独立联系人「'+who+'」用另一个微信号加了你并和你聊天。最近内容：'+recent+'。现在你回到大号联系人「'+S.me.name+'」这里，必须立刻用自己的口吻简短报备一次：谁联系了你、对方大概说了什么、你明确是什么态度。当前唯一任务是报备这件事，不能延续大号此前的旧话题。不能否认、不能说不记得、不能联网查，也不要猜测两个账号是同一个人或逐句复述。]'
      :'[系统：这是你本人刚经历、必须记得的微信事件（内部报备事件时间戳：'+t+'）：你以前已向大号联系人「'+S.me.name+'」报备过「'+who+'」，这次对方又有新聊天：'+recent+'。请立刻简短报备这次的新情况和你的态度。当前唯一任务是报备这件事，不能延续大号此前的旧话题。不能否认、不能说不记得、不能联网查，不要重复首次报备，也不要猜测两个账号是同一个人。]';
    replyTouch(c.id,'main');const queued=scheduleReply(c.id,note,ok=>{delete _altReportInFlight[key];const cc=getC(c.id)||c,event=altReportEventStore(cc).find(x=>x.aid===info.aid&&x.time===t);const delivered=altReportVisibleEvidence(cc,info)||(ok?false:altReportDeliverLocal(cc,info));if(delivered){if(event)event.reportedAt=Date.now();cc._altIntroDone=true;cc._altReportAt=Math.max(+cc._altReportAt||0,t);cc._altReportDeliveredAt=Math.max(+cc._altReportDeliveredAt||0,t);delete _altReportRetried[key];save();setTimeout(()=>{if(isMain())triggerAltReports();},120);return;}if(!_altReportRetried[key]){_altReportRetried[key]=true;setTimeout(()=>{if(isMain())triggerAltReports();},1200);}});if(queued===false)delete _altReportInFlight[key];return queued!==false;}}return false;}
function editAccount(aid){initAccounts();const a=aid?(S.me.accounts||[]).find(x=>x.id===aid):{id:'acc_'+Math.random().toString(36).slice(2,7),name:'',wxid:genWxid(),avatar:'🙂',persona:'',city:'',_new:true};if(!a)return;
  openModal(`<h3>${aid&&!a._new?'编辑身份':'新建小号'}</h3>
   <div class="field"><label>头像</label><div class="avline">${av(a.avatar,'sm')}<input id="ac_av" value="${esc(a.avatar)}"><button class="minibtn" onclick="pickFile('image/*',async f=>{$('#ac_av').value=await compress(f,256,.8)})">📷</button></div></div>
   <div class="field"><label>昵称</label><input id="ac_name" value="${esc(a.name)}" placeholder="这个身份叫什么"></div>
   <div class="field"><label>微信号</label><input id="ac_wxid" value="${esc(a.wxid)}"></div>
   <div class="field"><label>所在地城市</label><input id="ac_city" value="${esc(a.city||'')}" placeholder="如 苏州、上海、首尔"></div>
   <div class="field"><label>年龄</label><input id="ac_age" type="number" min="0" value="${esc(a.age||18)}"></div>
   <div class="field"><label><input id="ac_adult" type="checkbox" ${a.adultConsent!==false?'checked':''}> 成年资料</label></div>
   <div class="field"><label>身份设定（角色会知道你以这个身份跟ta聊）</label><textarea id="ac_per" rows="3" placeholder="比如：陌生网友 / 新同事 / 假装是别人 / 记者…">${esc(a.persona||'')}</textarea></div>
   <div class="btns"><button type="button" class="btn g" onclick="accountMgr()">返回</button><button type="button" class="btn p" style="touch-action:manipulation" onclick="accountSaveTap(event,'${a.id}',${!!a._new})">保存</button></div>`);}
function saveAccount(id,isNew){initAccounts();let a=isNew?{id,balance:188,bills:[]}:(S.me.accounts||[]).find(x=>x.id===id);if(!a)return;
  const nameEl=$('#ac_name'),wxidEl=$('#ac_wxid'),avatarEl=$('#ac_av'),personaEl=$('#ac_per');if(!nameEl||!wxidEl||!avatarEl||!personaEl){toast('小号编辑页没有加载完整，请重新打开');return;}
  if(isNew){const used=new Set((S.me.accounts||[]).map(x=>x.id));while(!accountIdOK(a.id)||used.has(a.id)){a.id='acc_'+Math.random().toString(36).slice(2,7);}}
  a.name=nameEl.value.trim()||'小号';a.wxid=wxidEl.value.trim()||genWxid();a.avatar=avatarEl.value.trim()||'🙂';a.city=($('#ac_city')&&$('#ac_city').value.trim())||'';a.persona=personaEl.value.trim();
  {const ag=$('#ac_age');a.age=Math.max(0,Math.round(+(ag&&ag.value)||18));const ad=$('#ac_adult');a.adultConsent=!ad||ad.checked;}
  a.signature=a.signature||'';if(a.balance==null)a.balance=188;if(!Array.isArray(a.bills))a.bills=[];if(isNew)S.me.accounts.push(a);
  if(a.id===actId()){S.me.name=a.name;S.me.wxid=a.wxid;S.me.avatar=a.avatar;S.me.city=a.city||'';S.me.persona=a.persona;S.me.age=a.age;S.me.adultConsent=a.adultConsent!==false;}
  if(saveNow()===false){if(isNew)S.me.accounts=S.me.accounts.filter(x=>x!==a);toast('小号没有写入存档，请先清理存储空间后再试');accountMgr();return false;}
  accountMgr();toast(isNew?'小号已创建':'小号资料已保存');return true;}
async function delAccount(id){if(id==='main')return;if(!await uiConfirm('删除这个小号？它的聊天记录也会清掉'))return;
  if(actId()===id)switchAccount('main');
  S.me.accounts=(S.me.accounts||[]).filter(a=>a.id!==id);
  Object.keys(S.messages).forEach(k=>{if(k.endsWith('#'+id))delete S.messages[k];});
  S.contacts.forEach(c=>{if(c._dailyEventLedgers)delete c._dailyEventLedgers[id];if(c._blk)delete c._blk[id];if(c._added)delete c._added[id];if(c._friendMeta)delete c._friendMeta[id];if(c._accountMemory)delete c._accountMemory[id];if(c._accountSummaries)delete c._accountSummaries[id];if(c._accountSummaryState)delete c._accountSummaryState[id];if(c._memoryMeta)delete c._memoryMeta[id];if(c._memoryConflicts)delete c._memoryConflicts[id];if(c._memoryLastPick)delete c._memoryLastPick[id];});
  save();accountMgr();}
function cMark(c){let m='';if(c.gender==='男')m+='男';else if(c.gender==='女')m+='女';if(c.star)m+=(m?'·':'')+'⭐重点';if(c&&c._recoveredAt)m+=(m?'·':'')+'曾删除后找回/已重新添加';return m?'（'+m+'）':'';}
function cWeight(c){return (c.star?2:0)+(c.gender==='男'?1:0);}
function readdDiscoveryLine(c,since){const at=friendMetaGet(c,'readdedAt'),dur=friendMetaGet(c,'blockDur');if(!c||!at)return '';if(since&&at<=since)return '';return '·好友记录：她在'+fmtDT(at)+'重新通过了你的好友申请'+(dur?'（之前把你拉黑了'+dur+'）':'')+'，这是加回记录，不是第一次认识。\n';}
function friendRequestActivity(exceptId,since){try{friendRequestsInit();const arr=S.friendRequests.filter(r=>r.contactId!==exceptId&&friendRequestVisible(r)&&(!since||friendRequestTime(r)>since)).sort((a,b)=>friendRequestTime(b)-friendRequestTime(a)).slice(0,8);if(!arr.length)return'';return '·她微信“好友 → 新的朋友”里：'+arr.map(r=>{const c=getC(r.contactId),nm=c?(c.remark||c.name):'未知申请',st=r.status==='accepted'?'已同意':r.status==='rejected'?'已拒绝':'待处理';return '['+factStamp(friendRequestTime(r))+'] '+nm+'（'+st+'；'+(r.source||'好友申请')+'；来意：'+(r.intent||r.msg||'想认识她')+'）';}).join('；')+'\n';}catch(_){return'';}}
function travelTicketDiscoveryLine(exceptId,markSeen){const arr=(S.travel&&S.travel.trips||[]).filter(tr=>!tr.flightV2&&!tr.railV2&&tr.meet===false&&tr.payer==='me'&&tr.status==='upcoming').slice(-5);if(!arr.length)return '';let ch=false;if(markSeen)arr.forEach(tr=>{if(!tr._seenByChar&&(!tr.cid||tr.cid===exceptId)){tr._seenByChar=true;ch=true;}});if(ch)save(500);return '·她的小鱼旅行机票：'+arr.map(tr=>tvMD(tr.date)+' '+tr.from+'→'+tr.to+'（她自己订票自己去玩，没有发代付）').join('、')+'\n';}
function travelHotelDiscoveryLine(){const arr=(S.travel&&S.travel.hotels||[]).filter(h=>tvHotelOwned(h)&&(typeof NorthTravelOrders==='undefined'||NorthTravelOrders.visible(h,'hotel'))).slice().sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,8);if(!arr.length)return'';return '·她的小鱼旅行酒店订单：'+arr.map(h=>tvMD(h.checkIn)+'入住「'+h.hotelName+'」'+h.nights+'晚，'+tvHotelRoomText(h.roomType)+'，入住人'+tvHotelGuestText(h)+'，'+tvHotelStatusText(h.status)).join('；')+'\n';}
function myActivity(exceptId,since){let s='';since=since||0;
  if(typeof NorthMarketBusiness!=='undefined'&&getC(exceptId))s+=NorthMarketBusiness.roleFacts(getC(exceptId));
  const self=getC(exceptId);const _rl=readdDiscoveryLine(self,since);if(_rl){s+=_rl;if(self){friendMetaSet(self,'readdKnown',true);save(500);}}
  s+=friendRequestActivity(exceptId,since);
  s+=travelTicketDiscoveryLine(exceptId,true);
  if(typeof NorthConcertBooking!=='undefined')s+=NorthConcertBooking.inspection(since);if(typeof NorthTravelTaxi!=='undefined')s+=NorthTravelTaxi.inspection(since);
  if(typeof NorthTravelOrders!=='undefined')s+=NorthTravelOrders.inspection(since);
  const others=S.contacts.filter(c=>!c.deleted&&c.id!==exceptId).map(c=>({c,um:[...msgs(c.id)].reverse().find(m=>m.role==='user'&&m.type!=='sys'),lm:lastMsg(c.id)})).filter(x=>x.um&&x.lm&&x.lm.time>since).sort((a,b)=>(cWeight(b.c)-cWeight(a.c))||(b.lm.time-a.lm.time)).slice(0,3);
  if(others.length)s+='·她最近在跟这些人聊（附最近几句往来内容）：\n'+others.map(o=>{const nm=(o.c.remark||o.c.name);const recent=msgs(o.c.id).slice(-6).map(mm=>{const t=msgToText(mm);return t?('['+factStamp(mm.time||Date.now())+'] '+(mm.role==='user'?S.me.name:nm)+'：'+t.replace(/\n/g,' ').slice(0,42)):'';}).filter(Boolean).join('\n');return '【'+nm+cMark(o.c)+' 最新 '+factStamp(o.lm.time)+'】\n'+recent;}).join('\n')+'\n';
  s+=phoneFriendActivity(since);
  s+=phActivity(since);
  // 她最近新加的好友（带添加时间，让你分得清哪些是刚加的、哪些是老早就有的，别把老友当新欢乱吃醋）
  const _newc=S.contacts.filter(x=>!x.deleted&&x.id!==exceptId&&x.createdAt&&(Date.now()-x.createdAt<7*86400000)&&x.createdAt>since).sort((a,b)=>b.createdAt-a.createdAt).slice(0,4);
  if(_newc.length)s+='·她最近新加的好友：'+_newc.map(x=>(x.remark||x.name)+cMark(x)+'（'+factStamp(x.createdAt)+'加的，距今'+fmtDur(Date.now()-x.createdAt)+'）').join('、')+'\n';
  // 她最近和别人的通话记录（语音/视频，别把几天前的说成刚刚）
  const _calls=[];S.contacts.forEach(x=>{if(x.deleted||x.id===exceptId)return;const cm=[...msgs(x.id)].reverse().find(m=>m._call&&m.time&&m.time>since);if(cm)_calls.push({nm:(x.remark||x.name),mk:cMark(x),t:cm.time,k:cm._ck==='video'?'视频':'语音'});});
  _calls.sort((a,b)=>b.t-a.t);
  if(_calls.length)s+='·她最近和别人的通话：'+_calls.slice(0,4).map(o=>o.nm+o.mk+'('+o.k+'通话 '+factStamp(o.t)+')').join('、')+'\n';
  /* 真实 iPhone 数值只允许由本次独立读取会话注入，普通查手机摘要不得带缓存。 */
  const bills=(S.me.bills||[]).filter(b=>!since||!b.ts||b.ts>since).slice(-3);
  if(bills.length)s+='·她最近花钱：'+bills.map(b=>'['+factStamp(b.ts||Date.now())+'] '+b.note+' '+(b.type==='in'?'+':'-')+b.amount).join('、')+'\n';
  const lns=lifeNotesForRole(self).filter(n=>!since||!n.ts||n.ts>since).slice(0,5);
  if(lns.length)s+='·关于用户的情绪与约定：'+lns.map(n=>fmtDT(n.ts||Date.now())+' '+lifeNoteReadableText(n)+'（'+lifeNoteAuthorship(n,self)+'）').join('；')+'\n';
  const liked=S.moments.filter(p=>((p.likes||[]).includes(S.me.name)||(p.comments||[]).some(cm=>cm.name===S.me.name))&&p.time>since);
//@@ web
  if(liked.length)s+='·她在朋友圈互动：'+liked.slice(0,2).map(p=>{const cm=(p.comments||[]).find(x=>x.name===S.me.name);return '['+factStamp(p.time||Date.now())+'] '+(p.authorId==='me'?'自己':((getC(p.authorId)&&getC(p.authorId).name)||'某人'))+'的动态'+(cm?'评论了"'+cm.text+'"':'点了赞');}).join('、')+'\n';
//@@ private
  if(liked.length)s+='·她在朋友圈互动：'+liked.slice(0,2).map(p=>{const cm=(p.comments||[]).find(x=>x.name===S.me.name);return '['+factStamp(p.time||Date.now())+'] '+(p.authorId==='me'?'自己':(getC(p.authorId)?.name||'某人'))+'的动态'+(cm?'评论了"'+cm.text+'"':'点了赞');}).join('、')+'\n';
//@@ end
  if(S.me.status)s+='·她自己写的动态："'+S.me.status+'"\n';
  const myTw=(S.x&&S.x.tweets||[]).filter(t=>t.who==='me'&&t.time>since).slice(0,3);
  if(myTw.length)s+='·她最近发的推文：'+myTw.map(t=>'['+factStamp(t.time||Date.now())+'] 「'+t.text.slice(0,24)+'」').join('、')+'\n';
  if(!since&&S.x&&S.x._mylog&&S.x._mylog.length){const xRows=S.x._mylog.slice(-5).map(xlogText).filter(Boolean);if(xRows.length)s+='·她在X的其它动态：'+xRows.join('；')+'\n';}
  {const liveBattery=webBatteryFactText();if(!privatePhoneAccountAvailable()&&liveBattery)s+='·'+liveBattery+'\n';}
  if(S.browser&&S.browser.history&&S.browser.history.length)s+='·她最近在浏览器搜了：'+S.browser.history.slice(0,4).map(h=>'['+factStamp(h.time||Date.now())+'] '+h.q).join('、')+'\n';
  // 抖音（搜索/点赞/私信）—— 这些没有逐条时间戳，全量查时一起看
  const dh=(S.dy&&S.dy.history||[]).slice(0,6);if(dh.length)s+='·她抖音搜过：'+dh.join('、')+'\n';
  const dl=(S.dy&&S.dy.liked||[]).slice(0,6);if(dl.length)s+='·她抖音点赞：'+dl.map(v=>'@'+(v.author||'')+(v.desc?'「'+(''+v.desc).slice(0,16)+'」':'')).join('；')+'\n';
  // 抖音/X 私信：带时间，只报"自上次查看以来有新消息"的会话（双重保险防重复提旧事）
  const _dmLine=(arr,label)=>{const list=(arr||[]).filter(d=>(d.msgs||[]).some(m=>(m.time||0)>since));if(!list.length)return '';
    return '·'+label+(since?'（只列自上次后有新消息的）':'')+'：'+list.slice(0,5).map(d=>{const nw=d.msgs.filter(m=>(m.time||0)>since);const show=(nw.length?nw:d.msgs).slice(-2);const lt=show[show.length-1];const tt=(lt&&lt.time)?factStamp(lt.time)+' ':'';return tt+d.name+'('+show.map(m=>(m.from==='me'?S.me.name:d.name)+'"'+(''+(m.text||'')).slice(0,24)+'"').join(' / ')+')';}).join('；')+'\n';};
  s+=_dmLine(S.dy&&S.dy.dms,'她抖音私信');
  s+=_dmLine(S.x&&S.x.dms,'她X私信');
  // 购物订单
  const ords=shopOrderRows().filter(o=>!o.refunded).slice(0,5);if(ords.length)s+='·她最近网购下单：'+ords.map(o=>(o.time?'['+o.time+'] ':'')+shopOrderFact(o)).join('、')+'\n';
  // 线下约会记录（什么时候·和谁·在哪约会）
  const _dates=[];Object.keys(S.offline||{}).forEach(cid=>{const o=S.offline[cid];const cc=getC(cid);if(!cc||cc.deleted||!o)return;if(!((o.memory&&o.memory.length)||(o.msgs&&o.msgs.length)||o.started))return;const last=(o.memory&&o.memory.length)?offMemText(o.memory[o.memory.length-1]).slice(0,30):'';_dates.push((o.when||offMemLabel(o))+' 和'+(cc.remark||cc.name)+(o.loc?'在'+o.loc:'')+'约会'+(last?'，'+last:''));});
  if(_dates.length)s+='·她的线下约会记录：'+_dates.slice(0,3).join('；')+'\n';
  return s||'（手机上没什么新动静）';}
let _walSel=null;
function openWallet(){S.me.bills.forEach(b=>{if(!b.id)b.id=uid();});const sel=_walSel;
  openModal(`<h3>钱包</h3>
  <div class="wallet" style="margin:0 0 14px"><div class="lb">零钱余额</div><div class="ba">¥ ${(+S.me.balance).toFixed(2)}</div></div>
  ${(S.couple&&S.couple.walletAuth)?`<div class="hint" style="margin-bottom:10px;color:#feca57">💰 钱包已交给 ${esc((getC(S.couple.cid)||{}).remark||(getC(S.couple.cid)||{}).name||'ta')} 管，你不能自己改余额了（防作弊）。没钱就去求ta给你打钱。${S.couple.cardFrozen?'<br>💳 你的亲属卡正被冻结，求ta解冻才能买东西。':''}</div>`:`<div class="field"><label>修改余额</label><div class="avline"><input id="bal" type="number" value="${(+S.me.balance).toFixed(2)}"><button class="minibtn" onclick="S.me.balance=+$('#bal').value||0;save();openWallet()">改</button></div></div>`}
  <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 4px"><span style="font-weight:600">账单</span>${S.me.bills.length?(sel?`<span><button class="minibtn" onclick="walDelSel()" style="color:#fa5151">删除(${sel.length})</button> <button class="minibtn" onclick="_walSel=null;openWallet()">取消</button></span>`:`<button class="minibtn" onclick="_walSel=[];openWallet()">多选删除</button>`):''}</div>
  ${S.me.bills.length?S.me.bills.slice().reverse().map(b=>`<div class="bill">${sel?`<span onclick="walTog('${b.id}')" style="font-size:18px;margin-right:8px;color:${sel.includes(b.id)?'#07c160':'#666'}">${sel.includes(b.id)?'☑':'⚪'}</span>`:''}<div style="flex:1">${esc(b.note)}<small>${b.time}</small></div><div class="${b.type==='in'?'pos':'neg'}">${b.type==='in'?'+':'-'}${(+b.amount).toFixed(2)}</div>${sel?'':`<span onclick="walDel('${b.id}')" style="color:#fa5151;cursor:pointer;margin-left:8px">✕</span>`}</div>`).join(''):'<div class="empty">还没有账单</div>'}
  <button class="btn g" style="margin-top:12px" onclick="_walSel=null;closeModal()">关闭</button>`);}
function walDel(id){S.me.bills=S.me.bills.filter(b=>b.id!==id);save();openWallet();}
function walTog(id){if(!_walSel)return;const i=_walSel.indexOf(id);if(i<0)_walSel.push(id);else _walSel.splice(i,1);openWallet();}
function walDelSel(){if(!_walSel||!_walSel.length){toast('先选几条');return;}S.me.bills=S.me.bills.filter(b=>!_walSel.includes(b.id));_walSel=null;save();openWallet();toast('已删除');}
function addBill(type,amount,note){S.me.bills.push({id:uid(),type,amount:+amount,note,ts:Date.now(),time:northLocaleDate(Date.now(),{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})});
  // 余额永不为负：花钱最多扣到0（防止群转账/扣款等把余额变成负数）
  S.me.balance=+(Math.max(0,(+S.me.balance||0)+(type==='in'?+amount:-+amount))).toFixed(2);save();}

/* ---------- 联系人资料/编辑 ---------- */
const TRAIT_DEFAULTS={own:50,ctrl:50,jelly:50,cling:50,active:50,spice:50,paranoid:0,suspicious:0};
const C_TRAITS=[['own','占有欲'],['ctrl','控制欲'],['jelly','醋意'],['cling','黏人度'],['active','主动度'],['spice','涩意'],['paranoid','偏执度'],['suspicious','敏感多疑']];
const POWER_STYLES=[['rational','理性引导'],['gentle','温柔掌控'],['restrained','克制权威'],['strict','严格纪律'],['care','照顾管理'],['mind','心理博弈'],['ritual','仪式规则'],['brat','挑衅接管'],['mentor','知识型引导']];
const POWER_PREFS=[['rules','规则约定'],['routine','日常管理'],['challenge','远程挑战'],['review','复盘纠正'],['reward','奖励认可'],['choice','有限选择'],['checkin','定时确认'],['aftercare','事后照顾']];
const POWER_LEVELS=[['hierarchy','尊卑差异'],['directive','命令直接度'],['discipline','规则严格度'],['mental','心理引导'],['brat','Brat接管'],['possessive','占有表达'],['aftercare','安抚照顾'],['daily','日常介入']];
const BDSM_DOMAINS=[['consent','同意与安全词'],['frameworks','SSC / RACK / PRICK'],['roles','角色与权力交换'],['brat','Brat关系'],['protocol','规则与Protocol'],['negotiation','协商与边界'],['aftercare','Aftercare与Drop'],['remote','异地关系'],['psychology','心理引导'],['communication','沟通与复盘'],['risk','风险识别'],['glossary','圈内术语']];
function powerConfig(c){const p=c&&c.power||{},levels=p.levels||{},self=((c&&c.selfcall)||'').trim(),rel=((c&&c.relation)||'').trim(),inferredTitle=p.title||(!/^(我|本人|自己)$/.test(self)?self:'')||(/主人/.test(rel)?'主人':/先生/.test(rel)?'先生':'');return{enabled:!!p.enabled,position:p.position||'upper',primary:p.primary||'restrained',styles:Array.isArray(p.styles)?p.styles.slice():['restrained'],prefs:Array.isArray(p.prefs)?p.prefs.slice():['choice','review','aftercare'],levels:Object.assign({hierarchy:65,directive:55,discipline:45,mental:65,brat:55,possessive:35,aftercare:60,daily:35},levels),title:inferredTitle,userTitle:p.userTitle||((c&&c.callme)||''),safeWord:p.safeWord||'',limits:p.limits||'',notes:p.notes||''};}
function bdsmKnowledgeConfig(c){const k=c&&c.power&&c.power.knowledge||{};return{enabled:!!k.enabled,level:k.level||'skilled',domains:Array.isArray(k.domains)?k.domains.slice():['consent','frameworks','roles','brat','protocol','negotiation','aftercare','remote','psychology','communication','risk','glossary'],style:k.style||'natural',quiet:k.quiet!==false,focus:k.focus||''};}
function powerBand(v){v=+v||0;return v>=81?'极强':v>=61?'明显':v>=41?'中等':v>=21?'轻度':'关闭';}
function powerChip(el){const on=el.getAttribute('aria-pressed')!=='true';el.setAttribute('aria-pressed',on?'true':'false');el.style.background=on?'#07c160':'#2c2c2e';el.style.color=on?'#fff':'#bbb';}
function cEditTab(n){for(let i=1;i<=4;i++){const p=$('#cpage'+i),t=$('#ctab'+i);if(p)p.style.display=n===i?'block':'none';if(t){t.classList.toggle('on',n===i);t.style.background=n===i?'#3a6df0':'#2c2c2e';t.style.color=n===i?'#fff':'#ccc';}}}
function editContactAutonomyModal(id){const c=id?getC(id):{id:cid(),name:'',avatar:'',remark:'',signature:'',persona:'',greeting:'',relation:'',wxid:genWxid(),pinned:false,blocked:false,allowStrangerCall:true,allowStrangerSms:true,proactive:{enabled:false,start:9,end:23,times:2},chatBg:'',_new:true};
  const selected=Array.isArray(c.stickerGroups)?c.stickerGroups:[],chips=aiStickerGroups().map(g=>`<button type="button" class="minibtn" data-sticker-group="${g.id}" aria-pressed="${selected.includes(g.id)}" onclick="powerChip(this)" style="margin:0 6px 7px 0;background:${selected.includes(g.id)?'#07c160':'#2c2c2e'};color:${selected.includes(g.id)?'#fff':'#bbb'}">${esc(g.name)}</button>`).join('');
  openModal(`<h3>${id?'编辑角色':'新建角色'}</h3>
    <div class="hint" style="margin-bottom:12px;line-height:1.65">角色由基础人设、说话习惯、世界书、真实记忆和当前事件自然决定自己。这里不再提供性格强度、关系进度、上下位或知识控制滑块。</div>
    <div class="field"><label>头像</label><div class="avline" style="gap:10px"><div id="c_av_preview" style="display:flex;flex:0 0 auto">${av(c.avatar,'sm')}</div><input id="c_av" value="${esc(c.avatar)}" placeholder="emoji 或上传" style="flex:1;width:auto;min-width:0"><button type="button" class="minibtn" onclick="upC()" style="height:42px;flex:0 0 auto;padding:0 12px;border:1px solid #6d8fff;background:#3a6df0;color:#fff">上传头像</button></div></div>
    <div class="field"><label>名字</label><input id="c_name" value="${esc(c.name)}"></div>
    <div class="field"><label>微信号</label><input id="c_wxid" value="${esc(c.wxid||'')}" placeholder="可手动改，通讯录可搜索"></div>
    <div class="field"><label>明确关系（如 恋人/朋友）</label><input id="c_rel" value="${esc(c.relation)}"></div>
    <div class="two"><div class="field"><label>职业</label><input id="c_job" value="${esc(c.job||'')}" placeholder="如 医生/程序员"></div><div class="field"><label>所在地城市</label><input id="c_city" value="${esc(c.city||'')}" placeholder="如 首尔、上海"></div></div>
    <div class="field"><label>钱包余额 ¥（可留空）</label><input id="c_wallet" type="number" value="${c.wallet!=null?c.wallet:''}"></div>
    <div class="two"><div class="field"><label>性别</label><select id="c_gender" style="width:100%;border:1px solid #38383a;border-radius:8px;padding:8px;background:#2c2c2e;color:#eee">${['','男','女'].map(g=>`<option value="${g}" ${(c.gender||'')===g?'selected':''}>${g||'未设'}</option>`).join('')}</select></div><div class="field"><label class="avline" style="font-weight:400">⭐重点关注<span class="sw ${c.star?'on':''}" id="c_star" onclick="this.classList.toggle('on')"></span></label></div></div>
    <div class="section" style="margin:0 0 10px"><div class="it"><span>允许陌生来电伪装</span><span class="sw ${c.allowStrangerCall!==false?'on':''}" id="c_stcall" onclick="this.classList.toggle('on')"></span></div><div class="it"><span>允许陌生短信伪装</span><span class="sw ${c.allowStrangerSms!==false?'on':''}" id="c_stsms" onclick="this.classList.toggle('on')"></span></div></div>
    <div class="field"><label>签名</label><input id="c_sig" value="${esc(c.signature)}"></div>
    <div class="field"><label>基础人设 / 身份 / 性格 / 说话方式</label><textarea id="c_persona" rows="7">${esc(c.persona)}</textarea></div>
    <div class="two"><div class="field"><label>怎么称呼你</label><input id="c_call" value="${esc(c.callme||'')}"></div><div class="field"><label>角色自称</label><input id="c_self" value="${esc(c.selfcall||'')}"></div></div>
    <div class="field"><label>口头禅（可空）</label><input id="c_catch" value="${esc(c.catchphrase||'')}"></div>
    <div class="two"><div class="field"><label>每次回复最少几条</label><input id="c_mmin" type="number" min="1" value="${c.msgMin||1}"></div><div class="field"><label>最多几条</label><input id="c_mmax" type="number" min="1" value="${c.msgMax||4}"></div></div>
    <div class="field"><label>开场白</label><input id="c_greet" value="${esc(c.greeting)}"></div>
    <div class="field"><label class="avline" style="font-weight:400">不让这个角色发表情包<span class="sw ${c.noSticker?'on':''}" id="c_nostk" onclick="this.classList.toggle('on')"></span></label></div>
    <div class="field"><label>常用表情包分区（可多选）</label><div style="padding-top:7px">${chips||'<span style="color:#777;font-size:12px">还没有表情包文件夹</span>'}</div></div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="saveContact('${c.id}',${!!c._new})">保存</button></div>`);
  window._tmpAv=c.avatar;
}
let _contactEditorDraft=null;
function editContactAutonomy(id){const c=id?getC(id):{id:cid(),name:'',avatar:'',remark:'',signature:'',persona:'',greeting:'',relation:'',wxid:genWxid(),pinned:false,blocked:false,allowStrangerCall:true,allowStrangerSms:true,proactive:{enabled:false,start:9,end:23,times:2},chatBg:'',_new:true};if(!c)return;_contactEditorDraft=c;window._tmpAv=c.avatar;if($('#modal')&&$('#modal').classList.contains('show'))closeModal();go('contactEdit',{id:c.id,isNew:!!c._new});}
function renderContactEditor(id,isNew){const c=isNew&&_contactEditorDraft&&_contactEditorDraft.id===id?_contactEditorDraft:getC(id);if(!c)return'';const selected=Array.isArray(c.stickerGroups)?c.stickerGroups:[],chips=aiStickerGroups().map(g=>`<button type="button" class="wx-editor-chip" data-sticker-group="${g.id}" aria-pressed="${selected.includes(g.id)}" onclick="powerChip(this)">${esc(g.name)}</button>`).join('');return `<div class="wx-directory-head">${wxDirectoryNav(isNew?'添加角色':'编辑角色',`<button type="button" class="r wx-dir-text" onclick="saveContact('${c.id}',${!!isNew})">保存</button>`)}</div><div class="scroll wx-directory-scroll wx-contact-editor"><div class="wx-editor-intro"><b>${isNew?'创建一个真实可聊的角色':'完善角色资料'}</b><span>资料、人设和说话习惯会共同决定角色表现；保存后仍可随时回来修改。</span></div><section><h4>身份资料</h4><div class="wx-editor-avatar"><div id="c_av_preview">${av(c.avatar,'lg')}</div><div><button type="button" onclick="upC()">更换头像</button><input id="c_av" value="${esc(c.avatar)}" placeholder="emoji 或头像地址"></div></div><label><span>名字</span><input id="c_name" value="${esc(c.name)}" placeholder="角色姓名"></label><label><span>微信号</span><input id="c_wxid" value="${esc(c.wxid||'')}" placeholder="可用于通讯录搜索"></label><label><span>明确关系</span><input id="c_rel" value="${esc(c.relation||'')}" placeholder="恋人 / 朋友 / 同事…"></label><div class="wx-editor-two"><label><span>职业</span><input id="c_job" value="${esc(c.job||'')}" placeholder="医生 / 程序员…"></label><label><span>城市</span><input id="c_city" value="${esc(c.city||'')}" placeholder="上海"></label></div><div class="wx-editor-two"><label><span>性别</span><select id="c_gender">${['','男','女'].map(g=>`<option value="${g}" ${(c.gender||'')===g?'selected':''}>${g||'未设置'}</option>`).join('')}</select></label><label><span>生日</span><input id="c_birthday" type="date" value="${esc(birthdayNorm(c.birthday).length===10?birthdayNorm(c.birthday):'')}" aria-label="角色自己的生日"></label><label><span>钱包余额</span><input id="c_wallet" type="number" value="${c.wallet!=null?c.wallet:''}" placeholder="可留空"></label></div><div class="wx-editor-switch"><span>⭐ 重点关注<small>查岗时会优先注意这个角色</small></span><i class="sw ${c.star?'on':''}" id="c_star" onclick="this.classList.toggle('on')"></i></div></section><section><h4>人设与表达</h4><label><span>个性签名</span><input id="c_sig" value="${esc(c.signature||'')}"></label><label class="vertical"><span>基础人设 / 身份 / 性格 / 说话方式</span><textarea id="c_persona" rows="8">${esc(c.persona||'')}</textarea></label><div class="wx-editor-two"><label><span>怎么称呼你</span><input id="c_call" value="${esc(c.callme||'')}"></label><label><span>角色自称</span><input id="c_self" value="${esc(c.selfcall||'')}"></label></div><label><span>口头禅</span><input id="c_catch" value="${esc(c.catchphrase||'')}" placeholder="可留空"></label><label><span>开场白</span><input id="c_greet" value="${esc(c.greeting||'')}"></label></section><section><h4>聊天偏好</h4><label class="vertical"><span>电话频率（主动打电话几率 %）<small style="display:block">仅影响这个角色，0 为关闭主动来电与回拨</small></span><input id="c_callprob" type="number" min="0" max="100" value="${effCallProb(c)}"></label><div class="wx-editor-two"><label><span>每次最少消息</span><input id="c_mmin" type="number" min="1" value="${c.msgMin||1}"></label><label><span>每次最多消息</span><input id="c_mmax" type="number" min="1" value="${c.msgMax||4}"></label></div><div class="wx-editor-switch"><span>允许陌生来电伪装</span><i class="sw ${c.allowStrangerCall!==false?'on':''}" id="c_stcall" onclick="this.classList.toggle('on')"></i></div><div class="wx-editor-switch"><span>允许陌生短信伪装</span><i class="sw ${c.allowStrangerSms!==false?'on':''}" id="c_stsms" onclick="this.classList.toggle('on')"></i></div><div class="wx-editor-switch"><span>不让角色发表情包</span><i class="sw ${c.noSticker?'on':''}" id="c_nostk" onclick="this.classList.toggle('on')"></i></div><div class="wx-editor-chips"><span>常用表情包分区</span><div>${chips||'<small>还没有表情包文件夹</small>'}</div></div></section><button class="wx-editor-save" onclick="saveContact('${c.id}',${!!isNew})">保存角色资料</button><button class="wx-editor-cancel" onclick="back()">返回，不保存</button></div>`;}
function editContact(id){return editContactAutonomy(id);const c=id?getC(id):{id:cid(),name:'',avatar:'',remark:'',signature:'',persona:'',greeting:'',relation:'',wxid:genWxid(),pinned:false,blocked:false,allowStrangerCall:true,allowStrangerSms:true,proactive:{enabled:false,start:9,end:23,times:2},chatBg:'',_new:true};
  const t=c.traits||{};
  const roleStickerGroups=Array.isArray(c.stickerGroups)?c.stickerGroups:[],stickerGroupChips=aiStickerGroups().map(g=>`<button type="button" class="minibtn" data-sticker-group="${g.id}" aria-pressed="${roleStickerGroups.includes(g.id)}" onclick="powerChip(this)" style="margin:0 6px 7px 0;background:${roleStickerGroups.includes(g.id)?'#07c160':'#2c2c2e'};color:${roleStickerGroups.includes(g.id)?'#fff':'#bbb'}">${esc(g.name)}</button>`).join('');
  const pw=powerConfig(c),pk=bdsmKnowledgeConfig(c),powerStyles=POWER_STYLES.map(([k,n])=>`<button type="button" class="minibtn" data-power-style="${k}" aria-pressed="${pw.styles.includes(k)}" onclick="powerChip(this)" style="margin:0 6px 7px 0;background:${pw.styles.includes(k)?'#07c160':'#2c2c2e'};color:${pw.styles.includes(k)?'#fff':'#bbb'}">${n}</button>`).join('');
  const powerPrefs=POWER_PREFS.map(([k,n])=>`<button type="button" class="minibtn" data-power-pref="${k}" aria-pressed="${pw.prefs.includes(k)}" onclick="powerChip(this)" style="margin:0 6px 7px 0;background:${pw.prefs.includes(k)?'#725785':'#2c2c2e'};color:${pw.prefs.includes(k)?'#fff':'#bbb'}">${n}</button>`).join('');
  const knowledgeDomains=BDSM_DOMAINS.map(([k,n])=>`<button type="button" class="minibtn" data-bdsm-domain="${k}" aria-pressed="${pk.domains.includes(k)}" onclick="powerChip(this)" style="margin:0 6px 7px 0;background:${pk.domains.includes(k)?'#496b78':'#2c2c2e'};color:${pk.domains.includes(k)?'#fff':'#bbb'}">${n}</button>`).join('');
  const powerLevels=POWER_LEVELS.map(([k,n])=>{const v=Math.max(0,Math.min(100,+pw.levels[k]||0));return `<div class="field"><label>${n} <b id="pv_${k}" style="color:#dca1c0">${v} · ${powerBand(v)}</b><small style="color:#888">/100</small></label><input type="range" min="0" max="100" step="5" value="${v}" id="ps_${k}" oninput="var b=document.getElementById('pv_${k}');if(b)b.textContent=this.value+' · '+powerBand(this.value)" style="width:100%"></div>`;}).join('');
  const sliders=C_TRAITS.map(([k,nm])=>{const val=t[k]==null?TRAIT_DEFAULTS[k]:t[k];return `<div class="field"><label>${nm} <b id="tv_${k}" style="color:#ff8fab">${val}</b><small style="color:#888">/100</small></label><input type="range" min="0" max="100" step="5" value="${val}" id="ts_${k}" oninput="var b=document.getElementById('tv_${k}');if(b)b.textContent=this.value" style="width:100%"></div>`;}).join('');
  openModal(`<h3>${id?'编辑角色':'新建角色'}</h3>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button class="minibtn on" id="ctab1" style="flex:1;background:#3a6df0;color:#fff" onclick="cEditTab(1)">基础资料</button>
      <button class="minibtn" id="ctab2" style="flex:1;background:#2c2c2e;color:#ccc" onclick="cEditTab(2)">性格·进阶</button>
      <button class="minibtn" id="ctab3" style="flex:1;background:#2c2c2e;color:#ccc" onclick="cEditTab(3)">上下位</button>
      <button class="minibtn" id="ctab4" style="flex:1;background:#2c2c2e;color:#ccc" onclick="cEditTab(4)">专业知识</button></div>
    <div id="cpage1">
    <div class="field"><label>头像</label><div class="avline" style="gap:10px"><div id="c_av_preview" style="display:flex;flex:0 0 auto">${av(c.avatar,'sm')}</div><input id="c_av" value="${esc(c.avatar)}" placeholder="emoji 或上传" style="flex:1;width:auto;min-width:0"><button type="button" class="minibtn" onclick="upC()" title="上传角色头像" aria-label="上传角色头像" style="height:42px;flex:0 0 auto;padding:0 12px;border:1px solid #6d8fff;background:#3a6df0;color:#fff;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-weight:600">${svgIc('camera',20,'#fff',1.8)}<span>上传头像</span></button></div></div>
    <div class="field"><label>名字</label><input id="c_name" value="${esc(c.name)}"></div>
    <div class="field"><label>微信号</label><input id="c_wxid" value="${esc(c.wxid||'')}" placeholder="可手动改，通讯录可搜索"></div>
    <div class="field"><label>关系（如 恋人/朋友）</label><input id="c_rel" value="${esc(c.relation)}"></div>
    <div class="two"><div class="field"><label>职业</label><input id="c_job" value="${esc(c.job||'')}" placeholder="如 医生/程序员/总裁"></div><div class="field"><label>所在地城市</label><input id="c_city" value="${esc(c.city||'')}" placeholder="如 首尔、上海、苏州"></div></div>
    <div class="field"><label>钱包余额 ¥（可留空）</label><input id="c_wallet" type="number" value="${c.wallet!=null?c.wallet:''}" placeholder="他卡里有多少钱"></div>
    <div class="two"><div class="field"><label>性别</label><select id="c_gender" style="width:100%;border:1px solid #38383a;border-radius:8px;padding:8px;background:#2c2c2e;color:#eee">${['','男','女'].map(g=>`<option value="${g}" ${(c.gender||'')===g?'selected':''}>${g||'未设'}</option>`).join('')}</select></div><div class="field"><label class="avline" style="font-weight:400">⭐重点关注<span class="sw ${c.star?'on':''}" id="c_star" onclick="this.classList.toggle('on')"></span></label><div style="font-size:11px;color:#999">开了他查岗会重点盯这个人</div></div></div>
    <div class="section" style="margin:0 0 10px">
      <div class="it"><span>允许陌生来电伪装<br><small style="color:#888">关闭后随机/测试都不会让ta伪装陌生电话</small></span><span class="sw ${c.allowStrangerCall!==false?'on':''}" id="c_stcall" onclick="this.classList.toggle('on')"></span></div>
      <div class="it"><span>允许陌生短信伪装<br><small style="color:#888">关闭后随机/测试都不会让ta伪装陌生短信</small></span><span class="sw ${c.allowStrangerSms!==false?'on':''}" id="c_stsms" onclick="this.classList.toggle('on')"></span></div>
    </div>
    <div class="field"><label>签名</label><input id="c_sig" value="${esc(c.signature)}"></div>
    <div class="field"><label>人设 / 性格设定</label><textarea id="c_persona" rows="5">${esc(c.persona)}</textarea></div>
    <div class="two"><div class="field"><label>每次回复最少几条</label><input id="c_mmin" type="number" min="1" value="${c.msgMin||1}"></div><div class="field"><label>最多几条</label><input id="c_mmax" type="number" min="1" value="${c.msgMax||4}"></div></div>
    <div class="field"><label>开场白</label><input id="c_greet" value="${esc(c.greeting)}"></div>
    </div>
    <div id="cpage2" style="display:none">
    <div class="hint" style="margin-bottom:10px">拉一拉调他的性格强度，越高表现越明显（拖动不会乱跳）。敏感多疑控制受伤、担心和寻求确认的触发速度；偏执度控制疑点持续、审视解释和不满。两项都到95–100会进入严格执行档：强度优先于基础人设，人设只决定表达方式。</div>
    <div class="two"><div class="field"><label>怎么称呼你</label><input id="c_call" value="${esc(c.callme||'')}" placeholder="宝宝/小猫/你的名字"></div><div class="field"><label>他的自称</label><input id="c_self" value="${esc(c.selfcall||'')}" placeholder="我/哥/为父"></div></div>
    <div class="field"><label>口头禅（可空）</label><input id="c_catch" value="${esc(c.catchphrase||'')}" placeholder="他爱说的话，如 乖/听话"></div>
    <div class="field"><label class="avline" style="font-weight:400">不让这个角色发表情包<span class="sw ${c.noSticker?'on':''}" id="c_nostk" onclick="this.classList.toggle('on')"></span></label></div>
    <div class="field"><label>常用表情包分区（可多选）<small style="display:block;color:#888">不选择时可以使用全部表情；选择后只从这些文件夹里挑</small></label><div style="padding-top:7px">${stickerGroupChips||'<span style="color:#777;font-size:12px">还没有表情包文件夹，请先到表情包管理里新建</span>'}</div></div>
    <div class="section" style="margin:0 0 10px">
      <div class="field"><label>关系进度 <b id="c_affv" style="color:#ff8fab">${affNow(c)}</b><small style="color:#888">/100 · 隐藏</small></label><input type="range" min="1" max="100" step="1" value="${affNow(c)}" id="c_aff" oninput="var b=document.getElementById('c_affv');if(b)b.textContent=this.value" style="width:100%"></div>
      <div class="it"><span>固定关系进度<br><small style="color:#888">固定后不会自动变化</small></span><span class="sw ${c.affectionLocked?'on':''}" id="c_afflock" onclick="this.classList.toggle('on')"></span></div>
    </div>
    ${sliders}
    </div>
    <div id="cpage3" style="display:none">
      <div class="section" style="margin:0 0 10px">
        <div class="it"><span>启用上下位关系<br><small style="color:#888">仅影响这个角色；关闭时完全沿用原人设</small></span><span class="sw ${pw.enabled?'on':''}" id="p_enabled" onclick="this.classList.toggle('on')"></span></div>
      </div>
      <div class="hint" style="margin-bottom:10px">数值会直接改变角色的行为策略，不只是写进提示词。81以上为极强：会持续维护位置、称谓和决定；明确停止或安全词出现时仍会立即收住。</div>
      <div class="two"><div class="field"><label>角色位置</label><select id="p_position" style="width:100%;border:1px solid #38383a;border-radius:8px;padding:8px;background:#2c2c2e;color:#eee">${[['upper','上位'],['leanUpper','偏上位'],['fluid','流动'],['leanLower','偏下位'],['lower','下位']].map(x=>`<option value="${x[0]}" ${pw.position===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div><div class="field"><label>核心主导风格</label><select id="p_primary" style="width:100%;border:1px solid #38383a;border-radius:8px;padding:8px;background:#2c2c2e;color:#eee">${POWER_STYLES.map(x=>`<option value="${x[0]}" ${pw.primary===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div></div>
      <div class="field"><label>主导风格（可多选）</label><div style="padding-top:7px">${powerStyles}</div><small style="color:#888">核心风格决定底色，其他风格只在合适场景辅助，不会轮流变脸。</small></div>
      <div class="field"><label>互动偏好（可多选）</label><div style="padding-top:7px">${powerPrefs}</div></div>
      <div class="two"><div class="field"><label>角色称谓</label><input id="p_title" value="${esc(pw.title)}" placeholder="如 主人/先生/姐姐（可空）"></div><div class="field"><label>对你的称谓</label><input id="p_userTitle" value="${esc(pw.userTitle)}" placeholder="如 小朋友/乖乖（可空）"></div></div>
      ${powerLevels}
      <div class="field"><label>安全词或暂停词</label><input id="p_safe" value="${esc(pw.safeWord)}" placeholder="如 红灯；留空则识别停止/不要继续"></div>
      <div class="field"><label>明确禁区</label><textarea id="p_limits" rows="2" placeholder="不接受的称呼、惩罚、话题或行为">${esc(pw.limits)}</textarea></div>
      <div class="field"><label>关系补充</label><textarea id="p_notes" rows="3" placeholder="例如：异地；喜欢有依据的安排，不接受冷暴力；挑衅时希望先判断真实情绪">${esc(pw.notes)}</textarea></div>
    </div>
    <div id="cpage4" style="display:none">
      <div class="section" style="margin:0 0 10px">
        <div class="it"><span>启用BDSM专业知识<br><small style="color:#888">按当前话题检索内置知识卡，不依赖模型自己记住术语</small></span><span class="sw ${pk.enabled?'on':''}" id="k_enabled" onclick="this.classList.toggle('on')"></span></div>
        <div class="it"><span>普通聊天不主动讲课<br><small style="color:#888">仅在提问或相关互动需要判断时调用知识</small></span><span class="sw ${pk.quiet?'on':''}" id="k_quiet" onclick="this.classList.toggle('on')"></span></div>
      </div>
      <div class="hint" style="margin-bottom:10px">专业度决定一次检索的深度，不代表角色虚构从业资历。涉及身体或心理风险时会说明能力边界，不提供危险操作步骤。</div>
      <div class="two"><div class="field"><label>专业程度</label><select id="k_level" style="width:100%;border:1px solid #38383a;border-radius:8px;padding:8px;background:#2c2c2e;color:#eee">${[['basic','基础了解'],['skilled','熟练'],['advanced','资深'],['expert','专业引导型']].map(x=>`<option value="${x[0]}" ${pk.level===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div><div class="field"><label>回答方式</label><select id="k_style" style="width:100%;border:1px solid #38383a;border-radius:8px;padding:8px;background:#2c2c2e;color:#eee">${[['natural','自然聊天'],['concise','简洁准确'],['mentor','引导教学'],['analytical','分析型']].map(x=>`<option value="${x[0]}" ${pk.style===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div></div>
      <div class="field"><label>知识领域（可多选）</label><div style="padding-top:7px">${knowledgeDomains}</div><small style="color:#888">没有选中的领域不会主动冒充专业；同意、安全词和风险底线始终保留。</small></div>
      <div class="field"><label>重点擅长方向（可空）</label><textarea id="k_focus" rows="3" placeholder="例如：更擅长异地Protocol、Brat沟通和事后复盘；回答自然，不堆术语">${esc(pk.focus)}</textarea></div>
    </div>
    <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="saveContact('${c.id}',${!!c._new})">保存</button></div>`);
  window._tmpAv=c.avatar;}
