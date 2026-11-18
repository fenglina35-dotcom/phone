function homeReferenceApplyAppSlot(item,n){if(!item)return;HOME_REFERENCE_APP_SLOTS.forEach(cls=>item.classList.remove(cls));n=Number(n);if(Number.isInteger(n)&&n>=0&&n<HOME_REFERENCE_APP_SLOTS.length){item.classList.add(HOME_REFERENCE_APP_SLOTS[n]);item.dataset.refSlot=''+n;}else delete item.dataset.refSlot;}
function homeReferencePageHtml(pg){const map=homeReferenceAppSlotMap(pg),drop=HOME_REFERENCE_APP_SLOTS.map((cls,i)=>'<i class="glass-app-drop-slot '+cls+'" data-ref-slot="'+i+'" aria-hidden="true"></i>').join('');return drop+pg.map(k=>{const widget=String(k).startsWith('w:'),n=widget?-1:map[k],slot=widget?homeReferenceSlot(k,-1):homeReferenceSlot(k,n),raw=homeTokenCell(k);if(!slot)return raw;const withClass=raw.replace('class="','class="'+slot+' ');return widget?withClass:withClass.replace(' data-token="',' data-ref-slot="'+n+'" data-token="');}).join('');}
function homeReferenceSlotsRefresh(page){if(!page||!page.classList||!page.classList.contains('glass-reference-page'))return;const pg=Array.from(page.querySelectorAll(':scope>.home-item[data-token]')).map(item=>item.dataset.token).filter(Boolean),map=homeReferenceAppSlotMap(pg);Array.from(page.querySelectorAll(':scope>.home-item[data-token]')).forEach(item=>{const token=String(item.dataset.token||'');if(token.startsWith('w:')){HOME_REFERENCE_SLOT_CLASSES.forEach(cls=>item.classList.remove(cls));const slot=homeReferenceSlot(token,-1);if(slot)item.classList.add(slot);return;}homeReferenceApplyAppSlot(item,map[token]);});}
function homeReferencePageAtPoint(x,y){const page=document.querySelector('#appswipe .glass-reference-page');if(!page)return null;const r=page.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom?page:null;}
function homeReferenceSlotAtPoint(page,x,y){if(!page)return null;let best=null,dist=Infinity;page.querySelectorAll(':scope>.glass-app-drop-slot').forEach(slot=>{const r=slot.getBoundingClientRect();if(x>=r.left-12&&x<=r.right+12&&y>=r.top-12&&y<=r.bottom+12){const d=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2));if(d<dist){dist=d;best=slot;}}});return best?Number(best.dataset.refSlot):null;}
function homeReferenceMoveToSlot(page,item,n){if(!page||!item||String(item.dataset.token||'').startsWith('w:')||!Number.isInteger(n))return false;const old=Number(item.dataset.refSlot),other=Array.from(page.querySelectorAll(':scope>.home-item[data-ref-slot="'+n+'"]')).find(el=>el!==item);if(other&&Number.isInteger(old))homeReferenceApplyAppSlot(other,old);else if(other)homeReferenceApplyAppSlot(other,null);homeReferenceApplyAppSlot(item,n);return true;}
function homeSecondPrefs(){S.me.homeSecondPage=S.me.homeSecondPage&&typeof S.me.homeSecondPage==='object'?S.me.homeSecondPage:{};if(!Array.isArray(S.me.homeSecondPage.photos))S.me.homeSecondPage.photos=[];return S.me.homeSecondPage;}
function homeSecondPhotoSources(){const p=homeSecondPrefs(),sweet=sweetiePrefs(),dash=dashboardPrefs(),c=S.couple&&S.couple.cid?getC(S.couple.cid):null,defaults=[dash.photo,sweet.me||S.me.homeAvMe||S.me.avatar,sweet.ta||S.me.homeAvTa||(c&&c.avatar),S.me.avatar].filter(Boolean),photos=[];for(let i=0;i<3;i++)photos.push(p.photos[i]||defaults[i%Math.max(1,defaults.length)]||'');return{portrait:p.portrait||sweet.ta||S.me.homeAvTa||(c&&c.avatar)||dash.photo||sweet.me||S.me.avatar||'',photos};}
//@@ web
function homeSecondPortraitHtml(){const p=homeSecondPrefs(),src=homeSecondPhotoSources().portrait,c=S.couple&&S.couple.cid?getC(S.couple.cid):null,name=p.name||(c&&(c.remark||c.name))||sweetiePrefs().taName||'promise',sub=p.line||'与你一起，收藏每一天';return `<section class="glass-second-portrait"><span class="glass-second-avatar-picker" role="button" tabindex="0" aria-label="更换第二页圆形头像" onclick="event.stopPropagation();homeSecondPick('portrait',0)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();homeSecondPick('portrait',0)}">${src?`<img src="${src}" alt="圆形头像">`:`<span class="glass-second-photo-empty">${svgIc('user',34,'#fff')}</span>`}</span><div class="glass-second-portrait-copy"${glassInnerAttrs('portrait')} role="button" tabindex="0" aria-label="编辑人物组件文字" onclick="homeSecondEdit('portrait')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();homeSecondEdit('portrait')}"><b>${esc(name)}</b><span>${esc(sub)}</span></div></section>`;}
function homeSecondPhotosHtml(){const photos=homeSecondPhotoSources().photos;return `<section class="glass-second-photos"><div class="glass-second-polaroids">${photos.map((src,i)=>`<figure class="glass-second-polaroid p${i+1}"${glassInnerAttrs('photo'+(i+1))} role="button" tabindex="0" aria-label="更换第 ${i+1} 张照片" onclick="event.stopPropagation();homeSecondPick('photo',${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();homeSecondPick('photo',${i})}">${src?`<img src="${src}" alt="照片 ${i+1}">`:`<span class="glass-second-photo-empty">${svgIc('image',28,'#aaa')}</span>`}<i></i></figure>`).join('')}</div></section>`;}
//@@ private
function homeSecondPortraitHtml(){const p=homeSecondPrefs(),src=homeSecondPhotoSources().portrait,c=S.couple&&S.couple.cid?getC(S.couple.cid):null,name=p.name||(c&&(c.remark||c.name))||sweetiePrefs().taName||'promise',sub=p.line||'与你一起，收藏每一天';return `<section class="glass-second-portrait"><span class="glass-second-avatar-picker" role="button" tabindex="0" aria-label="更换第二页圆形头像" onclick="event.stopPropagation();homeSecondPick('portrait',0)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();homeSecondPick('portrait',0)}">${src?`<img src="${src}" alt="圆形头像" decoding="async">`:`<span class="glass-second-photo-empty">${svgIc('user',34,'#fff')}</span>`}</span><div class="glass-second-portrait-copy"${glassInnerAttrs('portrait')} role="button" tabindex="0" aria-label="编辑人物组件文字" onclick="homeSecondEdit('portrait')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();homeSecondEdit('portrait')}"><b>${esc(name)}</b><span>${esc(sub)}</span></div></section>`;}
function homeSecondPhotosHtml(){const photos=homeSecondPhotoSources().photos;return `<section class="glass-second-photos"><div class="glass-second-polaroids">${photos.map((src,i)=>`<figure class="glass-second-polaroid p${i+1}"${glassInnerAttrs('photo'+(i+1))} role="button" tabindex="0" aria-label="更换第 ${i+1} 张照片" onclick="event.stopPropagation();homeSecondPick('photo',${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();homeSecondPick('photo',${i})}">${src?`<img src="${src}" alt="照片 ${i+1}" decoding="async">`:`<span class="glass-second-photo-empty">${svgIc('image',28,'#aaa')}</span>`}<i></i></figure>`).join('')}</div></section>`;}
//@@ end
function homeSecondPageHtml(pg){return homeSecondPortraitHtml()+homeSecondPhotosHtml()+pg.map((k,i)=>{const raw=homeTokenCell(k);return raw.replace('class="','class="glass-second-app glass-second-slot-'+i+' ').replace(' data-token="',' data-second-slot="'+i+'" data-token="');}).join('');}
function homeSecondSlotsRefresh(page){if(!page||!page.classList||!page.classList.contains('glass-second-page'))return;Array.from(page.querySelectorAll(':scope>.home-item[data-token]')).forEach((item,i)=>{Array.from(item.classList).filter(c=>c.startsWith('glass-second-slot-')).forEach(c=>item.classList.remove(c));item.classList.add('glass-second-app','glass-second-slot-'+i);item.dataset.secondSlot=''+i;});}
function homeSecondEdit(kind){const p=homeSecondPrefs(),photos=homeSecondPhotoSources().photos;if(kind==='portrait'){openModal(`<h3>第二页头像文字</h3><div class="hint">圆形头像直接点头像更换；这里编辑卡片里的称呼和一句话，不会修改微信头像或第一页。</div><div class="field"><label>人物称呼</label><input class="second-page-text-input" id="second_name" value="${esc(p.name||'')}"></div><div class="field"><label>下面一句话</label><input class="second-page-text-input" id="second_line" value="${esc(p.line||'')}"></div><div class="btns"><button class="btn g" onclick="homeSecondPick('portrait',0)">更换圆形头像</button><button class="btn p" onclick="homeSecondPortraitSave()">保存文字</button></div>`);return;}openModal(`<h3>第二页三照片组件</h3><div class="hint">分别点按更换三张照片；只影响第二页。</div><div class="btns">${photos.map((_,i)=>`<button class="btn g" onclick="homeSecondPick('photo',${i})">第 ${i+1} 张</button>`).join('')}</div><div class="btns" style="margin-top:10px"><button class="btn p" onclick="closeModal()">完成</button></div>`);}
function homeSecondPortraitSave(){const p=homeSecondPrefs(),name=$('#second_name'),line=$('#second_line');p.name=name?name.value.trim():'';p.line=line?line.value.trim():'';save();closeModal();render();}
function homeSecondPick(kind,index){pickFile('image/*',async f=>{const p=homeSecondPrefs(),src=await compress(f,900,.86);if(kind==='portrait')p.portrait=src;else p.photos[Math.max(0,Math.min(2,+index||0))]=src;save();closeModal();render();toast(kind==='portrait'?'人物照片已更换':'照片已更换');});}
function homeAppsHtml(){homeLayoutInit();return S.me.homeLayout.map((pg,pi)=>'<div class="apppage home-dropzone'+(pi===0?' glass-reference-page':pi===1?' glass-second-page':'')+'" data-zone="page" data-pg="'+pi+'">'+(pi===0?homeReferencePageHtml(pg):pi===1?homeSecondPageHtml(pg):pg.map(homeTokenCell).join(''))+'</div>').join('');}
function homeDockHtml(){homeLayoutInit();return S.me.appDock.map(homeTokenCell).join('');}
const APP_TAP_MOVE=26,APP_TAP_MS=650,APP_DRAG_MS=620;
let _aPend=null,_aDrag=null,_aTimer=null,_aFlip=null,_aFlipDir=0,_aNoClick=0,_aTouchGuardBound=false;
function appTap(e,k){try{if(e)e.stopPropagation();}catch(_){}
  if(Date.now()<_aNoClick)return;
  if(appLocked(k)){toast('「'+(LOCKABLE[k]||k)+'」已被ta锁定'+(typeof lockUntilToast==='function'?lockUntilToast(k):'')+'，暂时无法打开');return;}
  const f=APPRUN[k];if(f)f();}
function appLaunch(k){_aNoClick=Date.now()+900;if(appLocked(k)){toast('「'+(LOCKABLE[k]||k)+'」已被ta锁定'+(typeof lockUntilToast==='function'?lockUntilToast(k):'')+'，暂时无法打开');return;}try{if(typeof shellMotionLaunch==='function')shellMotionLaunch(k);}catch(_){}const f=APPRUN[k];if(privateNativeAppOn()&&typeof queueMicrotask==='function')queueMicrotask(f);else setTimeout(f,0);}
function appDown(e,k){if(e.pointerType==='mouse'&&e.button!==0)return;
  _aPend={k,x:e.clientX,y:e.clientY,t:Date.now(),el:e.currentTarget,pid:e.pointerId};clearTimeout(_aTimer);
  _aTimer=setTimeout(()=>{if(_aPend&&!_aDrag)appBeginDrag();},APP_DRAG_MS);}
function appBeginDrag(){const p=_aPend;if(!p)return;const desktop=$('#homeDesktop'),sw=$('#appswipe');if(!desktop||!sw)return;
  const cell=p.el&&p.el.isConnected?p.el:desktop.querySelector('.home-item[data-token="'+p.k+'"]');if(!cell)return;
  const r=cell.getBoundingClientRect();const g=cell.cloneNode(true);g.classList.add('appghost');
  g.style.cssText='position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;margin:0;z-index:9999;pointer-events:none;opacity:.94;transform:none;';
  document.body.appendChild(g);
  _aDrag={k:p.k,ghost:g,item:cell,offx:p.x-r.left,offy:p.y-r.top};
  appTouchGuardAttach();
  cell.style.opacity='.22';cell.style.pointerEvents='none';sw.classList.add('aedit');document.body.classList.add('home-drag-active');homeEditStart();
  try{if(p.el&&p.el.setPointerCapture)p.el.setPointerCapture(p.pid);}catch(_){}
  if(navigator.vibrate)try{navigator.vibrate(15);}catch(_){}
  appGhostMove(p.x,p.y);}
function appGhostMove(x,y){if(!_aDrag)return;const g=_aDrag.ghost;g.style.left=(x-_aDrag.offx)+'px';g.style.top=(y-_aDrag.offy)+'px';
  appLiveReorder(x,y);
  const sw=$('#appswipe');if(!sw)return;const r=sw.getBoundingClientRect();
  let dir=0;if(x>r.right-40)dir=1;else if(x<r.left+40)dir=-1;
  if(dir!==_aFlipDir){_aFlipDir=dir;clearTimeout(_aFlip);if(dir)_aFlip=setTimeout(()=>appFlip(dir),430);}}
function appSwapNodes(a,b){if(!a||!b||a===b)return;const ap=a.parentNode,bp=b.parentNode;if(!ap||!bp)return;const am=document.createComment('home-a'),bm=document.createComment('home-b');ap.replaceChild(am,a);bp.replaceChild(bm,b);ap.replaceChild(b,am);bp.replaceChild(a,bm);}
function appLiveReorder(x,y){const d=_aDrag;if(!d||!d.item)return;const hit=document.elementFromPoint(x,y),target=hit&&hit.closest?hit.closest('.home-item'):null,zone=hit&&hit.closest?hit.closest('.home-dropzone'):null,refresh=()=>{homeReferenceSlotsRefresh(document.querySelector('#appswipe .glass-reference-page'));homeSecondSlotsRefresh(document.querySelector('#appswipe .glass-second-page'));},ref=homeReferencePageAtPoint(x,y)||(zone&&zone.classList&&zone.classList.contains('glass-reference-page')?zone:null),refSlot=ref&&APPDEFS[d.item.dataset.token]?homeReferenceSlotAtPoint(ref,x,y):null;if(ref&&refSlot!=null){const source=d.item.parentElement,occupant=Array.from(ref.querySelectorAll(':scope>.home-item[data-ref-slot="'+refSlot+'"]')).find(el=>el!==d.item);if(source!==ref){if(source&&source.dataset.zone==='dock'&&!occupant)return;if(occupant)appSwapNodes(d.item,occupant);else ref.appendChild(d.item);}homeReferenceMoveToSlot(ref,d.item,refSlot);return;}if(target&&target!==d.item){const sp=d.item.parentElement,tp=target.parentElement,sd=sp&&sp.dataset.zone==='dock',td=tp&&tp.dataset.zone==='dock';if(sd!==td){appSwapNodes(d.item,target);refresh();return;}const r=target.getBoundingClientRect(),after=y>r.top+r.height*.58||(Math.abs(y-(r.top+r.height/2))<r.height*.28&&x>r.left+r.width/2);tp.insertBefore(d.item,after?target.nextSibling:target);refresh();return;}if(zone&&zone.dataset.zone==='page'&&d.item.parentElement&&d.item.parentElement.dataset.zone!=='dock'&&d.item.parentElement!==zone){if(zone.classList.contains('glass-second-page')&&zone.querySelectorAll(':scope>.home-item[data-token]').length>=12)return;zone.appendChild(d.item);refresh();}}
function appFlip(dir){const sw=$('#appswipe');if(!sw||!_aDrag)return;const w=sw.clientWidth;let pg=Math.max(0,Math.min(APP_PAGES-1,Math.round(sw.scrollLeft/w)+dir));
  sw.scrollLeft=pg*w;homePgScroll(sw);
  _aFlip=setTimeout(()=>{if(_aDrag&&_aFlipDir===dir)appFlip(dir);},700);}
function appPendingMove(x,y){const p=_aPend;if(!p)return;const dx=x-p.x,dy=y-p.y;if(Math.max(Math.abs(dx),Math.abs(dy))<=APP_TAP_MOVE)return;clearTimeout(_aTimer);_aPend=null;_aNoClick=Date.now()+300;}
function appMove(e){if(_aDrag){if(e.cancelable)e.preventDefault();appGhostMove(e.clientX,e.clientY);return;}appPendingMove(e.clientX,e.clientY);}
function appUp(e){clearTimeout(_aTimer);clearTimeout(_aFlip);_aFlipDir=0;
  if(_aDrag){appDrop(e.clientX,e.clientY);return;}
  const p=_aPend;_aPend=null;if(p&&Date.now()-p.t<=APP_TAP_MS&&Math.abs(e.clientX-p.x)<=APP_TAP_MOVE&&Math.abs(e.clientY-p.y)<=APP_TAP_MOVE&&!String(p.k).startsWith('w:')){if(HOME_SHORTCUTS[p.k])homeShortcutTap(null,p.k);else appLaunch(p.k);}}
function appTouchMove(e){const t=e.touches&&e.touches[0];if(!t)return;if(_aDrag){if(e.cancelable)e.preventDefault();appGhostMove(t.clientX,t.clientY);return;}appPendingMove(t.clientX,t.clientY);}
function appTouchDragGuard(e){if(_aDrag&&e.cancelable)e.preventDefault();}
function appTouchGuardAttach(){if(_aTouchGuardBound||!('PointerEvent' in window))return;document.addEventListener('touchmove',appTouchDragGuard,{passive:false});_aTouchGuardBound=true;}
function appTouchGuardDetach(){if(!_aTouchGuardBound)return;document.removeEventListener('touchmove',appTouchDragGuard);_aTouchGuardBound=false;}
function appTouchEnd(e){if(!_aDrag&&!_aPend)return;const t=e.changedTouches&&e.changedTouches[0];if(!t){appCancel();return;}if(e.cancelable)e.preventDefault();if(_aDrag){appDrop(t.clientX,t.clientY);return;}appUp({clientX:t.clientX,clientY:t.clientY});}
function appCancel(){clearTimeout(_aTimer);clearTimeout(_aFlip);appTouchGuardDetach();_aFlipDir=0;_aPend=null;const d=_aDrag;if(d)_aNoClick=Date.now()+450;_aDrag=null;const sw=$('#appswipe');if(typeof document!=='undefined'&&document.body)document.body.classList.remove('home-drag-active');if(d&&d.ghost)try{d.ghost.remove();}catch(_){}if(d&&d.item){d.item.style.opacity='';d.item.style.pointerEvents='';}if(sw)sw.classList.remove('aedit');if(d){const h=$('#homeDesktop');if(h)h.classList.remove('home-editing');if(typeof render==='function')render();}}
function homeLayoutReadDom(){const pageEls=Array.from(document.querySelectorAll('#appswipe .apppage')),pages=pageEls.map(pg=>Array.from(pg.children).map(el=>el.dataset.token).filter(Boolean)),dock=$('#homeDesktop .dock');if(pages.length!==APP_PAGES||!dock)return false;const dockTokens=Array.from(dock.children).map(el=>el.dataset.token).filter(Boolean);if(dockTokens.length>4||dockTokens.some(k=>!APPDEFS[k]))return false;const before=(Array.isArray(S.me.homeLayout)?S.me.homeLayout.flat():[]).concat(Array.isArray(S.me.appDock)?S.me.appDock:[]).filter(homeTokenValid),after=pages.flat().concat(dockTokens),beforeSet=new Set(before),afterSet=new Set(after);if(before.length!==beforeSet.size||after.length!==afterSet.size||beforeSet.size!==afterSet.size||Array.from(beforeSet).some(k=>!afterSet.has(k)))return false;const ref=pageEls[0],map={};if(ref)ref.querySelectorAll(':scope>.home-item[data-ref-slot]').forEach(el=>{const token=el.dataset.token,n=Number(el.dataset.refSlot);if(APPDEFS[token]&&Number.isInteger(n))map[token]=n;});S.me.homeLayout=pages;S.me.appDock=dockTokens;S.me.homeReferenceAppSlots=map;homeLayoutSyncLegacy();return true;}
function appDrop(x,y){const d=_aDrag;if(d&&Number.isFinite(x)&&Number.isFinite(y))appLiveReorder(x,y);appTouchGuardDetach();_aDrag=null;_aPend=null;clearTimeout(_aTimer);const sw=$('#appswipe');
  _aNoClick=Date.now()+900;
  if(d.ghost)d.ghost.remove();if(d.item){d.item.style.opacity='';d.item.style.pointerEvents='';}
  document.body.classList.remove('home-drag-active');if(sw)sw.classList.remove('aedit');
  if(!homeLayoutReadDom()){render();requestAnimationFrame(homeEditStart);return;}
  save();render();requestAnimationFrame(homeEditStart);}
function initAppDrag(){if(window._aDragInit)return;window._aDragInit=1;
  if('PointerEvent' in window){document.addEventListener('pointermove',appMove,{passive:false});document.addEventListener('pointerup',appUp);document.addEventListener('pointercancel',appCancel);}
  else{document.addEventListener('touchmove',appTouchMove,{passive:false});document.addEventListener('touchend',appTouchEnd,{passive:false});document.addEventListener('touchcancel',appCancel);}
  window.addEventListener('blur',appCancel);window.addEventListener('pagehide',appCancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)appCancel();});
  document.addEventListener('click',e=>{if(Date.now()<_aNoClick&&e.target.closest('.home-item')){e.preventDefault();e.stopImmediatePropagation();}},true);}
initAppDrag();
function homeEditStart(){const h=$('#homeDesktop');if(h)h.classList.add('home-editing');}
function homeEditFinish(){appCancel();homeWidgetDragCancel();const h=$('#homeDesktop');if(h)h.classList.remove('home-editing');}
// 用点按方式整理桌面（不用长按拖拽，苹果安卓都稳）：每个应用选放第几页 + 上下调顺序
function appLayoutEditor(){homeLayoutInit();const L=S.me.homeLayout.map(pg=>pg.filter(k=>APPDEFS[k]));
  openModal('<h3>桌面应用布局</h3><div class="hint">点按钮把应用放到第几页、调上下顺序，不用拖拽。改完点完成。</div>'
   +L.map((pg,pi)=>'<div class="section" style="margin-bottom:10px"><div style="padding:8px 12px;font-weight:600;color:#b8a4e3">第 '+(pi+1)+' 页（'+pg.length+'个）</div>'
     +(pg.length?pg.map((k,j)=>{const a=APPDEFS[k]||{};
        const up=j>0?'onclick="appMoveOrder(\''+k+'\',-1)" style="cursor:pointer;padding:5px 10px;color:#9ec5fe;font-size:17px"':'style="padding:5px 10px;color:#555;font-size:17px"';
        const dn=j<pg.length-1?'onclick="appMoveOrder(\''+k+'\',1)" style="cursor:pointer;padding:5px 10px;color:#9ec5fe;font-size:17px"':'style="padding:5px 10px;color:#555;font-size:17px"';
        let pages='';for(let tp=0;tp<APP_PAGES;tp++){if(tp!==pi)pages+='<span onclick="appMovePage(\''+k+'\','+tp+')" style="cursor:pointer;padding:3px 8px;margin-left:4px;background:#2c2c2e;border-radius:10px;font-size:12px;color:#cdd">第'+(tp+1)+'页</span>';}
        return '<div class="it" style="align-items:center"><span style="flex:1;font-size:14px">'+esc(a.t||k)+'</span><span style="white-space:nowrap;display:flex;align-items:center"><span '+up+'>↑</span><span '+dn+'>↓</span>'+pages+'</span></div>';
       }).join(''):'<div class="empty" style="padding:12px">这页是空的</div>')
     +'</div>').join('')
   +'<button class="btn p" style="margin-top:6px" onclick="closeModal();render()">完成</button>');}
function appMoveOrder(k,dir){homeLayoutInit();for(const pg of S.me.homeLayout){const j=pg.indexOf(k);if(j<0)continue;const apps=pg.map((v,i)=>APPDEFS[v]?i:-1).filter(i=>i>=0),pos=apps.indexOf(j),np=pos+dir;if(np<0||np>=apps.length)return;const ni=apps[np],tmp=pg[ni];pg[ni]=k;pg[j]=tmp;homeLayoutSyncLegacy();save();appLayoutEditor();return;}}
function appMovePage(k,tp){homeLayoutInit();S.me.homeLayout.forEach(pg=>{const i=pg.indexOf(k);if(i>=0)pg.splice(i,1);});if(!S.me.homeLayout[tp])tp=0;S.me.homeLayout[tp].push(k);homeLayoutSyncLegacy();save();appLayoutEditor();}
// ===== 主屏小组件 =====
function widInit(){const m=S.me,allowed=['dashboard','vinyl','sweetie'],seen={};
  if(!m._glassWidgetsOnlyV1){const kept=(Array.isArray(m.widgets)?m.widgets:[]).filter(k=>allowed.includes(k)&&!seen[k]&&(seen[k]=1));m.widgets=kept.length?kept:allowed.slice();m._glassWidgetsOnlyV1=1;delete m.widgetPages;}
  else m.widgets=(Array.isArray(m.widgets)?m.widgets:[]).filter(k=>allowed.includes(k)&&!seen[k]&&(seen[k]=1));}
function wToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
const WIDS=[['dashboard','综合信息组件','心率、日期、电量、天气、真实存储和自定义照片'],['vinyl','音乐唱片组件','点唱片播放或暂停当前歌曲'],['sweetie','双人头像组件','两个圆头像、双方称呼和一句可编辑的话']];
const MOODS={happy:['开心','<circle cx="12" cy="12" r="8.4"/><path d="M8.6 10h.01M15.4 10h.01M8.6 14.4c1.5 1.7 5.3 1.7 6.8 0"/>'],love:['想ta','<path d="M12 20s-7-4.3-9.2-8.3A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9.2 5.7C19 15.7 12 20 12 20z"/>'],calm:['平静','<circle cx="12" cy="12" r="8.4"/><path d="M8.6 10h.01M15.4 10h.01M9 14.6h6"/>'],tired:['累了','<circle cx="12" cy="12" r="8.4"/><path d="M8 9.6c.8.6 2 .6 2.8 0M13.2 9.6c.8.6 2 .6 2.8 0M9 15c1.5-1.2 4.5-1.2 6 0"/>'],sad:['难过','<circle cx="12" cy="12" r="8.4"/><path d="M8.6 10h.01M15.4 10h.01M8.6 15.4c1.5-1.7 5.3-1.7 6.8 0"/>'],angry:['气鼓鼓','<circle cx="12" cy="12" r="8.4"/><path d="M7.6 9.4l2.4 1M16.4 9.4l-2.4 1M8.6 15.4c1.5-1.2 5.3-1.2 6.8 0"/>'],
  neutral:['平淡','<circle cx="12" cy="12" r="8.4"/><path d="M8.6 10h.01M15.4 10h.01M8.8 14.7h6.4"/>'],
  distress:['烦躁','<circle cx="12" cy="12" r="8.4"/><path d="M8 9.2l2.4 1.3M16 9.2l-2.4 1.3M9.2 15.4c.9-1.4 4.7-1.4 5.6 0"/>'],
  cry:['大哭','<circle cx="12" cy="12" r="8.4"/><path d="M8.6 10h.01M15.4 10h.01"/><path d="M8.7 15.6c1.4-1.6 5.2-1.6 6.6 0"/><path d="M9 12.4v2.3M15 12.4v2.3"/>'],
  sick:['生病','<circle cx="12" cy="12" r="8.4"/><path d="M8.6 10h.01M15.4 10h.01M9 15h6"/><path d="M6.4 16l5 1.3"/>']};
const MOODK=['happy','love','calm','neutral','sad','distress','angry','cry','tired','sick'];
const EMOJI2MOOD={'😊':'happy','🙂':'happy','😄':'happy','🥰':'love','❤':'love','😍':'love','😌':'calm','😐':'neutral','😑':'neutral','😔':'sad','😢':'sad','😞':'sad','😣':'distress','😖':'distress','😩':'distress','😤':'distress','😡':'angry','😠':'angry','😭':'cry','😴':'tired','😪':'tired','🤒':'sick','🤧':'sick','😷':'sick'};
function moodIc(k,size,color){const m=MOODS[k];if(!m)return '';return '<svg viewBox="0 0 24 24" width="'+(size||22)+'" height="'+(size||22)+'" fill="none" stroke="'+(color||'currentColor')+'" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">'+m[1]+'</svg>';}
function moodKeyOf(v){if(!v)return '';if(MOODS[v])return v;if(EMOJI2MOOD[v])return EMOJI2MOOD[v];return 'calm';}
function moodGlyph(v,size,color){const k=moodKeyOf(v);return k?moodIc(k,size,color):'';}
function moodLabel(v){const k=moodKeyOf(v);return k&&MOODS[k]?MOODS[k][0]:'';}
function wcol(){const t=S.me.theme,def=(!S.me.wColor||S.me.wColor==='#ffffff');if(def&&t==='pink')return '#b85c81';if(def&&t==='white')return '#555a66';return S.me.wColor||'#fff';}
function widgetHex(v,fallback){v=String(v||'').trim();return /^#[0-9a-f]{6}$/i.test(v)?v:(fallback||'#ffffff');}
function widgetOpacityValue(){if(S.me.wOpacity!=null&&isFinite(+S.me.wOpacity))return Math.max(0,Math.min(100,Math.round(+S.me.wOpacity)));return S.me.theme==='pink'?82:S.me.theme==='white'?92:13;}
function widgetCardColor(){return widgetHex(S.me.wCardColor,S.me.theme==='pink'?'#fff8fb':'#ffffff');}
function widgetRgba(hex,alpha){hex=widgetHex(hex,'#ffffff');const n=parseInt(hex.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+Math.max(0,Math.min(1,alpha)).toFixed(3)+')';}
function widgetStyleVars(){if(!S.me.wCardColor&&S.me.wOpacity==null){if(S.me.theme==='pink')return '--widget-bg:rgba(255,248,251,.82);--widget-border:rgba(255,255,255,.65);--widget-icon-bg:rgba(255,182,201,.5)';if(S.me.theme==='white')return '--widget-bg:rgba(255,255,255,.92);--widget-border:rgba(0,0,0,.05);--widget-icon-bg:rgba(120,128,150,.12)';return '--widget-bg:rgba(34,30,36,.74);--widget-border:rgba(255,255,255,.09);--widget-icon-bg:rgba(255,255,255,.08)';}const col=widgetCardColor(),a=widgetOpacityValue()/100;return '--widget-bg:'+widgetRgba(col,a)+';--widget-border:'+widgetRgba(col,Math.min(.72,a*.72+.04))+';--widget-icon-bg:'+widgetRgba(col,Math.min(.5,a*.42+.1));}
function petcol(){return widgetHex(S.me.petColor,wcol());}
function widgetAppearanceSet(key,value){widInit();if(key==='wOpacity'){S.me.wOpacity=Math.max(0,Math.min(100,Math.round(+value||0)));const n=$('#wopacityVal');if(n)n.textContent=S.me.wOpacity+'%';}else if(key==='wCardColor')S.me.wCardColor=widgetHex(value,'#ffffff');else if(key==='wColor')S.me.wColor=widgetHex(value,'#ffffff');else if(key==='petColor')S.me.petColor=widgetHex(value,'#ffffff');save(350);render();}
function glassWidgetDefaultTint(){return appIconPack()==='pink'?'#ffdbe9':appIconPack()==='blue'?'#dcecff':appIconPack()==='gray'?'#ffffff':'#16171b';}
function glassWidgetDefaultOpacity(){return appIconPack()==='black'?18:14;}
function glassWidgetAppearanceEnsure(){S.me=S.me||{};if(S.me._glassAppearanceSchema!==3){delete S.me.glassWidgetTint;delete S.me.glassWidgetOpacity;S.me.glassWidgetAppearances={};S.me._glassAppearanceSchema=3;}if(!S.me.glassWidgetAppearances||typeof S.me.glassWidgetAppearances!=='object'||Array.isArray(S.me.glassWidgetAppearances))S.me.glassWidgetAppearances={};return S.me.glassWidgetAppearances;}
function glassWidgetAppearance(){const map=glassWidgetAppearanceEnsure(),pack=appIconPack();return map[pack]&&typeof map[pack]==='object'?map[pack]:{};}
function glassWidgetTint(){return widgetHex(glassWidgetAppearance().tint,glassWidgetDefaultTint());}
function glassWidgetOpacity(){const n=Number(glassWidgetAppearance().opacity);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):glassWidgetDefaultOpacity();}
function glassWidgetCustomOn(){const a=glassWidgetAppearance();return !!(a.tint||Number.isFinite(Number(a.opacity)));}
const GLASS_INNER_PARTS={heart:'心率小块',time:'时间日期小块',battery:'电量小块',weather:'天气小块',storage:'存储小块',photo:'信息组件照片底块',vinyl:'唱片中心底块',sweetie:'双人头像整体底块',sweetieMe:'左边头像底块',sweetieTa:'右边头像底块',sweetieLine:'双人组件文字底块',portrait:'人物组件文字底块',photo1:'照片组件第1张底框',photo2:'照片组件第2张底框',photo3:'照片组件第3张底框'};
function glassInnerAppearance(key){const inner=glassWidgetAppearance().inner;return inner&&typeof inner==='object'&&inner[key]&&typeof inner[key]==='object'?inner[key]:{};}
function glassInnerOpacity(key){const a=glassInnerAppearance(key);return a.opacity!=null&&Number.isFinite(+a.opacity)?Math.max(0,Math.min(100,Math.round(+a.opacity))):35;}
function glassInnerTint(key){return widgetHex(glassInnerAppearance(key).tint,glassWidgetDefaultTint());}
function glassInnerAttrs(key){const a=glassInnerAppearance(key),custom=a.tint||a.opacity!=null;return ' data-glass-inner="'+key+'"'+(custom?' style="background-color:'+widgetRgba(glassInnerTint(key),glassInnerOpacity(key)/100)+'!important;background-image:none!important"':'');}
function glassInnerSet(key,field,value){if(!GLASS_INNER_PARTS[key]||!['tint','opacity','reset'].includes(field))return;const map=glassWidgetAppearanceEnsure(),pack=appIconPack(),a=map[pack]||(map[pack]={});a.inner=a.inner&&typeof a.inner==='object'?a.inner:{};if(field==='reset')delete a.inner[key];else{const item=a.inner[key]||(a.inner[key]={});if(field==='tint')item.tint=widgetHex(value,glassWidgetDefaultTint());else{item.opacity=Math.max(0,Math.min(100,Math.round(+value||0)));const n=$('#glassInner-'+key);if(n)n.textContent=item.opacity+'%';}}save(250);render();}
function glassInnerControls(){return '<details style="margin-top:12px"><summary style="padding:8px 0">组件内部小块颜色与透明度</summary><div class="hint">每块单独设置，0% 只去掉底色，保留照片、头像、文字与功能。设置按当前图标主题分别保存。</div>'+Object.entries(GLASS_INNER_PARTS).map(([k,name])=>`<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.08)"><div class="waprow"><span>${name}</span><input type="color" aria-label="${name}颜色" value="${glassInnerTint(k)}" oninput="glassInnerSet('${k}','tint',this.value)"></div><div class="waprow"><input type="range" aria-label="${name}透明度" min="0" max="100" value="${glassInnerOpacity(k)}" oninput="glassInnerSet('${k}','opacity',this.value)"><b id="glassInner-${k}">${glassInnerOpacity(k)}%</b><button class="minibtn" onclick="glassInnerSet('${k}','reset')">复位</button></div></div>`).join('')+'</details>';}
function glassWidgetStyleVars(){const h=glassWidgetTint(),n=parseInt(h.slice(1),16),rgb=((n>>16)&255)+','+((n>>8)&255)+','+(n&255),a=glassWidgetOpacity()/100;return `--ng-widget-rgb:${rgb};--ng-widget-alpha:${a.toFixed(2)};--ng-widget-alpha-soft:${Math.max(0,a*.55).toFixed(2)};`;}
//@@ private
/* NORTH_WIDGET_FOREGROUND_V1: account and icon-pack scoped; foreground independent of material. */
//@@ end
function glassWidgetTextColor(){return widgetHex(glassWidgetAppearance().textColor,'#ffffff');}
function glassWidgetTextOpacity(){const v=glassWidgetAppearance().textOpacity;return v!=null&&Number.isFinite(+v)?Math.max(0,Math.min(100,Math.round(+v))):100;}
function glassWidgetTextPaint(){const ink=widgetRgba(glassWidgetTextColor(),glassWidgetTextOpacity()/100);document.querySelectorAll('#homeDesktop').forEach(el=>{if(el.style.getPropertyValue('--north-widget-ink')!==ink)el.style.setProperty('--north-widget-ink',ink);});}
function glassWidgetTextSet(key,value){if(!['color','opacity','reset'].includes(key))return;const map=glassWidgetAppearanceEnsure(),pack=appIconPack(),a=map[pack]||(map[pack]={});if(key==='reset'){delete a.textColor;delete a.textOpacity;}else if(key==='color')a.textColor=widgetHex(value,'#ffffff');else a.textOpacity=Math.max(0,Math.min(100,Math.round(+value||0)));glassWidgetTextPaint();document.querySelectorAll('[data-widget-text-color]').forEach(el=>el.value=glassWidgetTextColor());document.querySelectorAll('[data-widget-text-opacity]').forEach(el=>el.value=String(glassWidgetTextOpacity()));const label=$('#glassWidgetTextOpacityVal');if(label)label.textContent=glassWidgetTextOpacity()+'%';save(250);}
function glassWidgetAppearanceSet(key,value){const map=glassWidgetAppearanceEnsure(),pack=appIconPack(),a=map[pack]&&typeof map[pack]==='object'?map[pack]:(map[pack]={});if(key==='tint')a.tint=widgetHex(value,glassWidgetDefaultTint());else if(key==='opacity'){a.opacity=Math.max(0,Math.min(100,Math.round(+value||0)));const n=$('#glassWidgetOpacityVal');if(n)n.textContent=a.opacity+'%';}save(250);applyLockAppearance($('#lockScreen'));render();}
function glassWidgetAppearanceReset(){const map=glassWidgetAppearanceEnsure(),lockPull=glassWidgetAppearance().lockPull;delete map[appIconPack()];if(lockPull)map[appIconPack()]={lockPull};save();render();widgetManager();toast('已恢复当前玻璃主题的默认透明度和色调');}
function lockPullAppearance(){const a=glassWidgetAppearance().lockPull;return a&&typeof a==='object'?a:{};}
function lockPullDefaultColor(){return appIconPack()==='pink'?'#a45374':appIconPack()==='blue'?'#45638b':appIconPack()==='gray'?'#fafbfd':'#1c1d22';}
function lockPullColor(){return widgetHex(lockPullAppearance().color,lockPullDefaultColor());}
function lockPullOpacity(){const value=lockPullAppearance().opacity;return value!=null&&Number.isFinite(+value)?Math.max(0,Math.min(100,Math.round(+value))):100;}
function lockPullAppearancePaint(element){const e=element||$('#lockPull');if(!e)return;const a=lockPullAppearance(),color=lockPullColor(),rgb=parseInt(color.slice(1),16),light=.299*((rgb>>16)&255)+.587*((rgb>>8)&255)+.114*(rgb&255)>=140;e.classList.toggle('north-lockpull-color',!!a.color);e.classList.toggle('north-lockpull-opacity',a.opacity!=null);e.style.setProperty('--north-lockpull-color',color);e.style.setProperty('--north-lockpull-arrow',light?'#42464e':'#ffffff');e.style.setProperty('--north-lockpull-opacity',String(lockPullOpacity()/100));}
function lockPullAppearanceSet(key,value){if(!['color','opacity','reset'].includes(key))return;const map=glassWidgetAppearanceEnsure(),pack=appIconPack(),a=map[pack]&&typeof map[pack]==='object'?map[pack]:(map[pack]={});if(key==='reset')delete a.lockPull;else{a.lockPull=a.lockPull&&typeof a.lockPull==='object'?a.lockPull:{};if(key==='color')a.lockPull.color=widgetHex(value,lockPullDefaultColor());else a.lockPull.opacity=Math.max(0,Math.min(100,Math.round(+value||0)));}lockPullAppearancePaint();document.querySelectorAll('[data-lockpull-color]').forEach(input=>{input.value=lockPullColor();});document.querySelectorAll('[data-lockpull-opacity]').forEach(input=>{input.value=String(lockPullOpacity());});const label=$('#lockPullOpacityVal');if(label)label.textContent=lockPullOpacity()+'%';save(250);}
function homeVinylOpacity(){const value=glassWidgetAppearance().vinylOpacity;return value!=null&&Number.isFinite(+value)?Math.max(0,Math.min(100,Math.round(+value))):100;}
function homeVinylOpacitySet(value){const map=glassWidgetAppearanceEnsure(),pack=appIconPack(),a=map[pack]&&typeof map[pack]==='object'?map[pack]:(map[pack]={});if(value==null)delete a.vinylOpacity;else a.vinylOpacity=Math.max(0,Math.min(100,Math.round(+value||0)));const opacity=homeVinylOpacity();document.querySelectorAll('.home-vinyl-card').forEach(card=>card.style.setProperty('--home-vinyl-opacity',String(opacity/100)));document.querySelectorAll('[data-home-vinyl-opacity]').forEach(input=>{input.value=String(opacity);});const label=$('#homeVinylOpacityVal');if(label)label.textContent=opacity+'%';save(250);}
function homeVinylThemeColor(){return appIconPack()==='pink'?'#c37a96':appIconPack()==='blue'?'#7892bd':appIconPack()==='gray'?'#b7b8b5':'#858683';}
function homeVinylCustomColor(){const raw=String(S.me&&S.me.homeVinylColor||'').trim();return /^#[0-9a-f]{6}$/i.test(raw)?raw.toLowerCase():'';}
function homeVinylPickerColor(){return homeVinylCustomColor()||homeVinylThemeColor();}
function homeVinylSurface(){const color=homeVinylCustomColor();if(!color)return{className:'',style:''};return{className:' home-vinyl-custom',style:` style="--home-vinyl-color:${color};--home-vinyl-light:${musicDiscColorBlend(color,'#ffffff',.58)};--home-vinyl-soft:${musicDiscColorBlend(color,'#ffffff',.24)};--home-vinyl-dark:${musicDiscColorBlend(color,'#000000',.42)};--home-vinyl-deep:${musicDiscColorBlend(color,'#000000',.68)}"`};}
function homeVinylColorPaint(value){if(typeof document==='undefined')return;const color=widgetHex(value,homeVinylThemeColor()),light=musicDiscColorBlend(color,'#ffffff',.58),soft=musicDiscColorBlend(color,'#ffffff',.24),dark=musicDiscColorBlend(color,'#000000',.42),deep=musicDiscColorBlend(color,'#000000',.68);document.querySelectorAll('.home-vinyl-card .vinyl-record').forEach(record=>{record.classList.add('home-vinyl-custom');record.style.setProperty('--home-vinyl-color',color);record.style.setProperty('--home-vinyl-light',light);record.style.setProperty('--home-vinyl-soft',soft);record.style.setProperty('--home-vinyl-dark',dark);record.style.setProperty('--home-vinyl-deep',deep);});document.querySelectorAll('[data-home-vinyl-color]').forEach(input=>{if(input.value!==color)input.value=color;});}
function homeVinylColorSet(value){S.me=S.me||{};S.me.homeVinylColor=widgetHex(value,homeVinylThemeColor());homeVinylColorPaint(S.me.homeVinylColor);save(250);return true;}
function homeVinylColorReset(){if(S.me)delete S.me.homeVinylColor;save();render();widgetManager();toast('主屏唱片已恢复跟随主题');}
function widgetAppearanceReset(){delete S.me.wCardColor;delete S.me.wOpacity;delete S.me.petColor;S.me.wColor='#ffffff';save();render();widgetManager();toast('已恢复当前主题的组件默认样式');}
function _wCard(ic,top,main,onclick){const col=wcol();return `<div class="hwid" style="color:${col}" onclick="${onclick}"><div class="wic">${ic}</div><div class="wbd"><div class="wt">${top}</div>${main}</div></div>`;}
function wDays(){if(!(S.couple&&S.couple.cid&&S.couple.startDate))return '';const c=getC(S.couple.cid);if(!c)return '';const col=wcol();
  const days=coupleDays(S.couple.startDate);
  return _wCard(svgIc('heart',23,col),'和 '+esc(c.remark||c.name)+' 在一起','<div class="wbig">第 '+days+' <small>天</small></div>','openCouple()');}
function wAnniv(){if(!(S.couple&&S.couple.cid))return '';const col=wcol();
  const list=(S.couple.anniversaries||[]).filter(a=>a&&a.date);if(!list.length)return '';
  const now=new Date();now.setHours(0,0,0,0);let best=null;
  list.forEach(a=>{const md=a.date.slice(5).split('-');const mo=+md[0],da=+md[1];if(!mo||!da)return;
    for(let yr=0;yr<2;yr++){const d=new Date(now.getFullYear()+yr,mo-1,da);if(d>=now){const diff=Math.round((d-now)/86400000);if(!best||diff<best.diff)best={diff,title:a.title||'纪念日'};break;}}});
  if(!best)return '';const main=best.diff===0?'<div class="wbig">就是今天</div>':'<div class="wbig">'+best.diff+' <small>天后</small></div>';
  return _wCard(svgIc('calendar',22,col),'距 '+esc(best.title),main,'openCouple()');}
function wTanow(){if(!(S.couple&&S.couple.cid))return '';const c=getC(S.couple.cid);if(!c)return '';const col=wcol();
  const wn=whereNow(c);if(!wn)return '';return _wCard(svgIc('location',22,col),esc(c.remark||c.name)+' 此刻','<div class="wm">'+esc(wn)+'</div>','openCouple()');}
function wDisc(){const col=wcol(),songs=S.music&&Array.isArray(S.music.songs)?S.music.songs.filter(s=>!s.mcpAccount||s.mcpAccount===String(actId())):[],wanted=_mCur||(S.music&&S.music.lastSongId),s=songs.find(x=>x.id===wanted)||songs[0]||null;
  const cover=s&&s.cover?`<i class="home-record-cover" style="background-image:url(${s.cover})"></i>`:`<i class="home-record-cover home-record-empty">${esc(Array.from((s&&s.title)||'音')[0]||'音')}</i>`;
  const disc=`<span class="home-record${s&&_mPlaying?' wdisc':''}" aria-hidden="true">${cover}</span>`;
  const main=s?'<b>'+esc(s.title)+'</b><span>'+esc(s.artist||'私人收藏')+'</span>':'<b>音乐</b><span>还没在听 · 去挑一首</span>';
  return `<div class="hwid home-music-card" style="color:${col}" onclick="openMusic()"><div class="wic">${disc}</div><div class="home-music-meta">${main}</div><button class="home-music-play" onclick="event.stopPropagation();musicToggle()" aria-label="播放或暂停">${_mPlaying?'Ⅱ':'▶'}</button></div>`;}
function dashboardPrefs(){S.me.homeDashboard=S.me.homeDashboard&&typeof S.me.homeDashboard==='object'?S.me.homeDashboard:{};const p=S.me.homeDashboard;if(!Number.isFinite(+p.battery))p.battery=88;if(!Number.isFinite(+p.heartRate))p.heartRate=72;return p;}
function dashboardRealBattery(){try{const st=typeof companionState==='function'&&S.couple?companionState():null,b=st&&st.linked&&!st.demo&&st.battery;if(b&&Number.isFinite(+b.level))return Math.round(+b.level*100);}catch(_){}return null;}
function dashboardBattery(){const real=dashboardRealBattery();return real==null?Math.max(0,Math.min(100,Math.round(+dashboardPrefs().battery||0))):real;}
function dashboardHeartRate(){try{const st=typeof companionState==='function'&&S.couple?companionState():null,h=st&&st.linked&&!st.demo&&st.health,n=h&&+h.heartRateBpm;if(Number.isFinite(n)&&n>0)return Math.round(n);}catch(_){}return Math.max(30,Math.min(240,Math.round(+dashboardPrefs().heartRate||72)));}
function dashboardStorage(){refreshStorageEstimate();const s=storageInfo(),webUsed=s.hasDevice?s.deviceMb*1048576:0,used=s.native?Math.max(0,s.nativeBytes)+webUsed:webUsed||s.logicalBytes,total=s.native&&s.nativeTotal?s.nativeTotal:s.hasDevice?s.deviceCapMb*1048576:0,pct=total?Math.max(1,Math.min(100,Math.round(used/total*100))):Math.max(1,Math.min(100,s.pct||0));return {pct,label:storageSizeLabel(used)};}
function dashboardPhoto(){return dashboardPrefs().photo||'';}
function dashboardWeatherIcon(desc){desc=String(desc||'');let body;if(/雷|电/.test(desc))body='<path d="M6.5 15.5h10.7a3.3 3.3 0 0 0 .4-6.5 5.8 5.8 0 0 0-10.8 1.7 2.4 2.4 0 0 0-.3 4.8z"/><path d="m12.8 15-2.7 4h2.2l-1.2 3 4-5h-2.3z"/>';else if(/雪|冰|冻/.test(desc))body='<path d="M6.5 14.5h10.7a3.3 3.3 0 0 0 .4-6.5 5.8 5.8 0 0 0-10.8 1.7 2.4 2.4 0 0 0-.3 4.8z"/><path d="M8 18h.01M12 20h.01M16 18h.01"/>';else if(/雨|阵雨/.test(desc))body='<path d="M6.5 14.5h10.7a3.3 3.3 0 0 0 .4-6.5 5.8 5.8 0 0 0-10.8 1.7 2.4 2.4 0 0 0-.3 4.8z"/><path d="m8.5 17-1 2M12.5 17l-1 2M16.5 17l-1 2"/>';else if(/雾|霾|沙|尘/.test(desc))body='<path d="M5 9h14M3.5 13h13M7 17h13"/>';else if(/云|阴/.test(desc))body='<circle cx="8" cy="8" r="3"/><path d="M8 2.5v1.4M2.5 8h1.4M4.1 4.1l1 1"/><path d="M6.5 18h10.7a3.3 3.3 0 0 0 .4-6.5 5.8 5.8 0 0 0-10.8 1.7A2.4 2.4 0 0 0 6.5 18z"/>';else body='<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>';return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-label="${esc(desc||'天气')}">${body}</svg>`;}
function dashboardWeatherLabel(desc){desc=String(desc||'');if(/雷|电/.test(desc))return'雷雨';if(/雪|冰|冻/.test(desc))return'雪天';if(/雨/.test(desc))return'雨天';if(/雾|霾|沙|尘/.test(desc))return'雾天';if(/多云/.test(desc))return'多云';if(/阴/.test(desc))return'阴天';if(/晴/.test(desc))return'晴天';return'天气';}
function wDashboard(){const p=dashboardPrefs(),d=new Date(),bat=dashboardBattery(),heart=dashboardHeartRate(),store=dashboardStorage(),photo=dashboardPhoto(),weather=S.weather&&S.weather.desc?S.weather:null,weatherLabel=dashboardWeatherLabel(weather&&weather.desc),pic=isImg(storedImageDisplaySource(photo))?`<img src="${storedImageDisplaySource(photo)}" alt="自定义照片">`:`<div class="home-dashboard-photo-empty">${svgIc('image',34,'#aaa')}<small>点按上传照片</small></div>`,batteryIcon='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="16" height="12" rx="3"></rect><path d="M21 10v4"></path></svg>';return `<div class="hwid home-dashboard-card" onclick="dashboardEdit()"><div class="home-dashboard-grid"><div class="dash-heart"${glassInnerAttrs('heart')}>${svgIc('heart',19,'#fff',1.7)}<small>${heart}<i>BPM</i></small></div><div class="dash-time"${glassInnerAttrs('time')}><b>${hm()}</b><small>${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}</small></div><div class="dash-battery"${glassInnerAttrs('battery')}>${batteryIcon}<b>${bat}%</b></div><div class="dash-device dash-weather"${glassInnerAttrs('weather')} onclick="event.stopPropagation();fetchWeather(true)">${dashboardWeatherIcon(weather&&weather.desc)}<b>${esc(weatherLabel)}</b></div><div class="dash-storage"${glassInnerAttrs('storage')}><i style="--dash-store:${store.pct}%"><em>存储</em></i><small>${store.label}</small></div></div><div class="home-dashboard-photo"${glassInnerAttrs('photo')} role="button" tabindex="0" onclick="event.stopPropagation();dashboardPickPhotoHome()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();dashboardPickPhotoHome()}">${pic}</div></div>`;}
function dashboardEdit(){const p=dashboardPrefs(),real=dashboardRealBattery()!=null;openModal(`<h3>黑色信息面板</h3><div class="hint">私人版取得真机数据时优先显示真实电量和心率；网页版使用下面的虚拟数值。存储始终读取小手机当前实际占用。</div><div class="field"><label>虚拟电量（0-100）</label><input id="dash_battery" type="number" min="0" max="100" value="${Math.round(+p.battery||0)}" ${real?'disabled':''}></div><div class="field"><label>虚拟心率 BPM（30-240）</label><input id="dash_heart" type="number" min="30" max="240" value="${Math.round(+p.heartRate||72)}"></div><div class="it"><span>右侧大图</span><span class="v"><button class="minibtn" onclick="dashboardPickPhoto()">${p.photo?'更换':'上传'}</button>${p.photo?'<button class="minibtn" style="margin-left:5px" onclick="dashboardRemovePhoto()">恢复默认</button>':''}</span></div><div class="btns" style="margin-top:14px"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="dashboardSave()">保存</button></div>`);}
function dashboardSave(){const p=dashboardPrefs(),b=$('#dash_battery'),h=$('#dash_heart');if(b&&!b.disabled)p.battery=Math.max(0,Math.min(100,Math.round(+b.value||0)));p.heartRate=Math.max(30,Math.min(240,Math.round(+h.value||72)));save();closeModal();render();toast('信息面板已更新');}
function dashboardPickPhoto(){pickFile('image/*',async f=>{dashboardPrefs().photo=await compress(f,900,.86);save();closeModal();render();setTimeout(dashboardEdit,40);toast('右侧照片已更换');});}
function dashboardPickPhotoHome(){pickFile('image/*',async f=>{dashboardPrefs().photo=await compress(f,900,.86);save();render();toast('右侧照片已更换');});}
function dashboardRemovePhoto(){delete dashboardPrefs().photo;save();closeModal();render();setTimeout(dashboardEdit,40);}
function wVinyl(){const songs=S.music&&Array.isArray(S.music.songs)?S.music.songs:[],wanted=_mCur||(S.music&&S.music.lastSongId),s=songs.find(x=>x.id===wanted)||songs[0]||null,cover=s&&s.cover?`<img class="vinyl-cover"${glassInnerAttrs('vinyl')} src="${s.cover}" alt="当前音乐封面">`:`<i class="vinyl-cover empty"${glassInnerAttrs('vinyl')}>♪</i>`,toggle=s?`event.stopPropagation();musicToggle()`:`event.stopPropagation();openMusic()`,surface=homeVinylSurface();return `<div class="hwid home-vinyl-card" style="--home-vinyl-opacity:${homeVinylOpacity()/100}" onclick="openMusic()"><span class="vinyl-label">Vinyl</span><div class="vinyl-record${surface.className}${s&&_mPlaying?' wdisc':''}"${surface.style} role="button" tabindex="0" aria-label="${s&&_mPlaying?'暂停音乐':s?'播放音乐':'选择音乐'}" aria-pressed="${s&&_mPlaying?'true':'false'}" onclick="${toggle}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${toggle}}">${cover}</div><svg class="vinyl-arm" viewBox="0 0 62 172" aria-hidden="true"><circle cx="45" cy="17" r="12"></circle><path d="M45 30 C47 65 45 91 35 120 C31 132 27 142 21 151"></path><rect x="14" y="146" width="15" height="24" rx="5"></rect></svg></div>`;}
function sweetiePrefs(){S.me.homeSweetie=S.me.homeSweetie&&typeof S.me.homeSweetie==='object'?S.me.homeSweetie:{};return S.me.homeSweetie;}
function wSweetie(){const p=sweetiePrefs(),c=S.couple&&S.couple.cid?getC(S.couple.cid):null,me=p.me||S.me.homeAvMe||S.me.avatar,ta=p.ta||S.me.homeAvTa||(c&&c.avatar),meName=p.meName||S.me.name||'Sweetie',taName=p.taName||(c&&(c.remark||c.name))||'Cutie',line=p.line||'♡ 想你，也想和你认真生活',loveDays=S.couple&&S.couple.startDate?coupleDays(S.couple.startDate):0,loveLine=loveDays?`<div class="sweetie-days">相恋 ${loveDays} 天</div>`:'';const av=(src,which,label)=>`<span class="sweetie-avatar-picker"${glassInnerAttrs(which==='me'?'sweetieMe':'sweetieTa')} role="button" tabindex="0" aria-label="更换${label}" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation();sweetiePickAvatar('${which}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();sweetiePickAvatar('${which}')}" title="点头像可更换">${src?`<img src="${src}">`:svgIc('user',24,'#fff')}</span>`;return `<div class="hwid home-sweetie-card" onclick="sweetieEdit()"><div class="sweetie-people"${glassInnerAttrs('sweetie')}><div>${av(me,'me','左边头像')}<b>${esc(meName)}</b></div><div>${av(ta,'ta','右边头像')}<b>${esc(taName)}</b></div></div>${loveLine}<p${glassInnerAttrs('sweetieLine')}>${esc(line)}</p></div>`;}
function sweetiePickAvatar(which){pickFile('image/*',async f=>{const p=sweetiePrefs();p[which==='ta'?'ta':'me']=await compress(f,420,.84);save();render();toast(which==='ta'?'右边头像已更换':'左边头像已更换');});}
function sweetieEdit(){const p=sweetiePrefs(),c=S.couple&&S.couple.cid?getC(S.couple.cid):null;openModal(`<h3>双人头像卡</h3><div class="btns"><button class="btn g" onclick="sweetiePickAvatar('me');closeModal()">更换左边头像</button><button class="btn g" onclick="sweetiePickAvatar('ta');closeModal()">更换右边头像</button></div><div class="field"><label>左边称呼</label><input id="sweet_me" value="${esc(p.meName||S.me.name||'Sweetie')}"></div><div class="field"><label>右边称呼</label><input id="sweet_ta" value="${esc(p.taName||(c&&(c.remark||c.name))||'Cutie')}"></div><div class="field"><label>下面的一句话</label><input id="sweet_line" value="${esc(p.line||'♡ 想你，也想和你认真生活')}"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="sweetieSave()">保存</button></div>`);}
function sweetieSave(){const p=sweetiePrefs();p.meName=$('#sweet_me').value.trim();p.taName=$('#sweet_ta').value.trim();p.line=$('#sweet_line').value.trim();save();closeModal();render();}
function wMood(){const col=wcol();const md=S.me.mood;const has=md.k&&md.date===wToday();
  const ic=has?moodIc(md.k,34,col):moodIc('happy',34,col);
  const main=has?(MOODS[md.k]?MOODS[md.k][0]:''):'点一下记录今天';
  return `<div class="hwid home-mood-card" style="color:${col}" onclick="wMoodPick()"><div class="home-mood-copy"><b>今日心情</b><span>${main}</span></div><div class="home-mood-face">${ic}</div></div>`;}
function wNote(){const n=S.me.note;const paper=n.paper||'#fff7d6',ink=n.ink||'#5b4a2f';
  const txt=n.text&&n.text.trim()?esc(n.text):'<span style="opacity:.5">点这里写点什么…</span>';
  return `<div class="hnote" style="background:${paper};color:${ink}" onclick="wNoteEdit()"><div class="nt">${svgIc('notebook',13,ink)} 便签</div><div class="nx">${txt}</div></div>`;}
function wCouple2(){if(!(S.couple&&S.couple.cid&&S.couple.startDate))return '';const c=getC(S.couple.cid);if(!c)return '';const col=wcol();
  const days=coupleDays(S.couple.startDate);
  const me=S.me.homeAvMe||S.me.avatar,ta=S.me.homeAvTa||c.avatar;
  const cir=(src)=>'<div class="cir">'+(src?'<img src="'+src+'">':svgIc('user',20,col))+'</div>';
  return `<div class="hwid wcp2" style="color:${col}" onclick="cp2Edit()"><div class="av2">${cir(me)}${cir(ta)}</div><div class="wcp2-copy"><b>我们</b><div class="d2">${days} <small>天</small></div></div></div>`;}
function cp2Edit(){const col='#ff8fab';const me=S.me.homeAvMe||S.me.avatar,c=S.couple&&S.couple.cid?getC(S.couple.cid):null,ta=S.me.homeAvTa||(c&&c.avatar);
  const pv=(src,who)=>`<div onclick="cp2Pic('${who}')" style="width:62px;height:62px;border-radius:50%;border:2.5px solid #ff8fab;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#3a2a3a;cursor:pointer;margin:0 auto">${src?`<img src="${src}" style="width:100%;height:100%;object-fit:cover">`:svgIc('user',26,'#ff8fab')}</div>`;
  openModal(`<h3>主屏头像</h3><div class="hint">只改主屏这个小组件的头像，不会动到微信头像。</div>
   <div style="display:flex;gap:24px;justify-content:center;margin:16px 0 6px">
     <div style="text-align:center">${pv(me,'me')}<div style="color:#ccc;font-size:13px;margin-top:7px">我</div><button class="minibtn" style="margin-top:5px" onclick="cp2Reset('me')">用微信头像</button></div>
     <div style="text-align:center">${pv(ta,'ta')}<div style="color:#ccc;font-size:13px;margin-top:7px">${esc((c&&(c.remark||c.name))||'ta')}</div><button class="minibtn" style="margin-top:5px" onclick="cp2Reset('ta')">用微信头像</button></div>
   </div>
   <div class="btns" style="margin-top:14px"><button class="btn g" onclick="closeModal();openCouple()">进入情侣空间</button><button class="btn p" onclick="closeModal()">完成</button></div>`);}
function cp2Pic(who){pickFile('image/*',async f=>{const d=await compress(f,300,.82);if(who==='me')S.me.homeAvMe=d;else S.me.homeAvTa=d;save();render();cp2Edit();toast('主屏头像已换 🌸');});}
function cp2Reset(who){if(who==='me')S.me.homeAvMe='';else S.me.homeAvTa='';save();render();cp2Edit();}
function homeWeatherIcon(desc,col){desc=String(desc||'');const rain=desc.includes('雨'),cloud=desc.includes('云')||desc.includes('阴'),body=rain||cloud?`<path d="M7 16.5h10.2a3.3 3.3 0 0 0 .4-6.5 5.8 5.8 0 0 0-10.8 1.7A2.4 2.4 0 0 0 7 16.5z"/><path d="M9.2 13h.01M14.8 13h.01M10.4 15c1 .8 2.2.8 3.2 0"/>${rain?'<path d="m8.5 19-1 2M12.5 19l-1 2M16.5 19l-1 2"/>':''}`:`<circle cx="12" cy="12" r="5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M10 11h.01M14 11h.01M10.2 13.7c1 1 2.6 1 3.6 0"/>`;return `<svg class="home-weather-icon" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="${col}" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-label="${esc(desc||'晴天')}">${body}</svg>`;}
function wClock(){const col=wcol();const d=new Date();const week=['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
  const weather=S.weather&&S.weather.place?S.weather:null,place=weather?esc(String(weather.place).split('·').pop()||weather.place):'天气',desc=weather?esc(weather.desc||'晴'):'点一下更新天气',temp=weather&&Number.isFinite(+weather.temp)?Math.round(+weather.temp)+'°':'--°';
  const pic=homeWeatherIcon(weather&&weather.desc,col);
  const hint=weather?desc+' · '+(/雨/.test(weather.desc||'')?'记得带伞':/晴/.test(weather.desc||'')?'适合出门走走':'很适合散步'):'点击获取当前位置天气';
  return `<div class="hwid home-weather-card" style="color:${col}" onclick="fetchWeather(true)"><span class="home-weather-eyebrow">TODAY · ${place}</span><div class="home-weather-art">${pic}</div><strong>${temp}</strong><div class="home-weather-copy">${hint}</div><div class="home-weather-foot">${weather?'实时天气':'点这里更新'}</div></div>`;}
const WIDR={dashboard:wDashboard,vinyl:wVinyl,sweetie:wSweetie};
function petCatDay(col){return `<svg class="petcat petday" viewBox="0 0 76 64" width="76" height="62" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path class="ptail" d="M56 52 q15 1 9 -17"/>
  <path d="M22 54 q-6 -23 16 -23 q22 0 16 23 z" fill="${col}" fill-opacity=".08"/>
  <path d="M27 22 l-4 -12 l11 6"/><path d="M49 22 l4 -12 l-11 6"/>
  <circle cx="38" cy="28" r="14" fill="${col}" fill-opacity=".07"/>
  <g class="peyes"><circle cx="32" cy="28" r="2.1" fill="${col}" stroke="none"/><circle cx="44" cy="28" r="2.1" fill="${col}" stroke="none"/></g>
  <path d="M36 33 q2 2 4 0"/>
  <path d="M21 27 l8 1M21 31 l8 -1M55 27 l-8 1M55 31 l-8 -1"/></svg>`;}
function petCatNight(col){return `<svg class="petcat petsleep" viewBox="0 0 80 58" width="80" height="58" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M16 48 q0 -24 28 -24 q26 0 26 24 z" fill="${col}" fill-opacity=".08"/>
  <path d="M22 30 l-3 -9 l9 4"/><path d="M33 26 l1 -9 l7 6"/>
  <circle cx="28" cy="36" r="12" fill="${col}" fill-opacity=".06"/>
  <path d="M22 36 q3 3 7 0"/>
  <path d="M14 38 l7 0M14 41 l7 -1.5"/>
  <path class="ptail" d="M68 48 q11 -1 5 -13"/></svg>`;}
function wPet(){const col=petcol();const hr=new Date().getHours();const night=(hr>=21||hr<7);
  const cat=night?petCatNight(col):petCatDay(col);
  const zzz=night?`<span class="pzzz" style="color:${col}">z<small>z</small></span>`:'';
  const sub=night?'呼呼…睡着了':'精神满满～';
  return `<div class="hwid wpet" style="color:${col}" onclick="petTap(this)"><div class="petbox">${cat}${zzz}</div></div>`;}
function petTap(el){const box=el.querySelector('.petbox');const c=el.querySelector('.petcat');
  if(c){c.classList.remove('petpet');void c.offsetWidth;c.classList.add('petpet');setTimeout(()=>{try{c.classList.remove('petpet');}catch(_){}},520);}
  if(box){for(let i=0;i<3;i++){const h=document.createElement('span');h.className='pheart';h.style.left=(28+i*20)+'%';h.style.animationDelay=(i*0.12)+'s';h.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="#ff8fab" stroke="none"><path d="M12 20s-7-4.3-9.2-8.3A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9.2 5.7C19 15.7 12 20 12 20z"/></svg>';box.appendChild(h);setTimeout(()=>{try{h.remove();}catch(_){}}, 1100);}}
  S.me.petPats=(S.me.petPats||0)+1;save();
  const night=(()=>{const hr=new Date().getHours();return hr>=21||hr<7;})();
  toast(night?'喵…（迷糊地蹭了蹭你）':'喵～ 蹭蹭你的手');}
function homeWidgetItem(k,inline){const raw=WIDR[k]?WIDR[k]():'';if(!raw)return `<div class="home-widget-item home-item home-widget-${k}${inline?' home-inline-widget':''}" data-wk="${k}" data-token="w:${k}" style="display:none"></div>`;return raw.replace(/class="([^"]*(?:hwid|hnote)[^"]*)"/,`class="$1 home-widget-item home-item home-widget-${k}${inline?' home-inline-widget':''}" data-wk="${k}" data-token="w:${k}" onpointerdown="appDown(event,'w:${k}')"`);}
function homeWidgets(){widInit();const top=S.me.widgets.filter(k=>['clock','disc','mood'].includes(k)).map(k=>homeWidgetItem(k,false)).filter(Boolean).join('');return top?'<div class="hwwrap" style="'+widgetStyleVars()+'">'+top+'</div>':'';}
function homeInlineWidgets(){widInit();return S.me.widgets.filter(k=>!['clock','disc','mood'].includes(k)).map(k=>homeWidgetItem(k,true)).filter(Boolean).join('');}
const HOME_WIDGET_DRAG_MS=560,HOME_WIDGET_MOVE=24;
let _hwPend=null,_hwDrag=null,_hwTimer=null,_hwNoClick=0;
function homeWidgetDown(e,k){appDown(e,'w:'+k);}
function homeWidgetDragBegin(){const p=_hwPend,desktop=$('#homeDesktop');if(!p||!desktop)return;const item=desktop.querySelector('.home-widget-item[data-wk="'+p.k+'"]');if(!item)return;const r=item.getBoundingClientRect(),ghost=item.cloneNode(true);ghost.classList.add('home-widget-ghost');ghost.style.cssText+=';position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px;z-index:9999;pointer-events:none;';document.body.appendChild(ghost);item.classList.add('home-widget-dragging');_hwDrag={k:p.k,item,ghost,dx:p.x-r.left,dy:p.y-r.top};homeEditStart();homeWidgetGhostMove(p.x,p.y);if(navigator.vibrate)try{navigator.vibrate(15);}catch(_){}}
function homeWidgetGhostMove(x,y){if(!_hwDrag)return;_hwDrag.ghost.style.left=(x-_hwDrag.dx)+'px';_hwDrag.ghost.style.top=(y-_hwDrag.dy)+'px';}
function homeWidgetMove(e){if(_hwDrag){e.preventDefault();homeWidgetGhostMove(e.clientX,e.clientY);return;}if(_hwPend&&(Math.abs(e.clientX-_hwPend.x)>HOME_WIDGET_MOVE||Math.abs(e.clientY-_hwPend.y)>HOME_WIDGET_MOVE)){clearTimeout(_hwTimer);_hwPend=null;}}
function homeWidgetUp(e){clearTimeout(_hwTimer);if(_hwDrag){homeWidgetDrop(e.clientX,e.clientY);return;}_hwPend=null;}
//@@ web
function homeWidgetDrop(x,y){const d=_hwDrag;if(!d)return;_hwDrag=null;_hwNoClick=Date.now()+900;d.ghost.style.display='none';const hit=document.elementFromPoint(x,y),target=hit&&typeof hit.closest==='function'?hit.closest('.home-widget-item'):null;d.ghost.remove();d.item.classList.remove('home-widget-dragging');const order=S.me.widgets.slice(),from=order.indexOf(d.k),targetKey=target&&target.dataset.wk;if(from>=0&&targetKey!==d.k){order.splice(from,1);let at=targetKey?order.indexOf(targetKey):-1;if(at<0)at=order.length;order.splice(at,0,d.k);}S.me.widgets=order;save();render();requestAnimationFrame(homeEditStart);}
//@@ private
function homeWidgetDrop(x,y){const d=_hwDrag;if(!d)return;_hwDrag=null;_hwNoClick=Date.now()+900;d.ghost.style.display='none';const target=document.elementFromPoint(x,y)?.closest('.home-widget-item');d.ghost.remove();d.item.classList.remove('home-widget-dragging');const order=S.me.widgets.slice(),from=order.indexOf(d.k),targetKey=target&&target.dataset.wk;if(from>=0&&targetKey!==d.k){order.splice(from,1);let at=targetKey?order.indexOf(targetKey):-1;if(at<0)at=order.length;order.splice(at,0,d.k);}S.me.widgets=order;save();render();requestAnimationFrame(homeEditStart);}
//@@ end
function homeWidgetDragCancel(){clearTimeout(_hwTimer);_hwPend=null;const d=_hwDrag;_hwDrag=null;if(d){try{d.ghost.remove();}catch(_){}try{d.item.classList.remove('home-widget-dragging');}catch(_){}}}
function initHomeWidgetDrag(){if(window._hwDragInit)return;window._hwDragInit=1;}
initHomeWidgetDrag();
function wNoteEdit(){widInit();const n=S.me.note;const papers=['#fff7d6','#ffd9e0','#d6f0ff','#e2ffd9','#efe2ff','#ffffff'];window._wnPaper=null;
  openModal(`<h3>可爱便签</h3>
    <textarea id="wn_t" rows="4" style="width:100%;box-sizing:border-box;background:#2c2c2e;border:1px solid #38383a;border-radius:10px;color:#eee;padding:10px;font-size:15px" placeholder="写点什么…文案、碎碎念、想说的话">${esc(n.text||'')}</textarea>
    <div style="margin:11px 0 6px;color:#aaa;font-size:13px">便签纸颜色</div>
    <div id="wn_papers" style="display:flex;gap:10px;flex-wrap:wrap">${papers.map(p=>`<span onclick="wnPaper('${p}')" data-p="${p}" style="width:30px;height:30px;border-radius:8px;background:${p};border:2px solid ${n.paper===p?'#ff8fab':'rgba(255,255,255,.15)'};cursor:pointer"></span>`).join('')}</div>
    <div style="margin:12px 0 6px;color:#aaa;font-size:13px">字体颜色</div>
    <input type="color" id="wn_ink" value="${n.ink||'#5b4a2f'}" style="width:46px;height:34px;background:none;border:none">
    <div class="btns" style="margin-top:14px"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="wNoteSave()">保存</button></div>`);}
function wnPaper(p){window._wnPaper=p;document.querySelectorAll('#wn_papers span').forEach(s=>s.style.border='2px solid '+(s.dataset.p===p?'#ff8fab':'rgba(255,255,255,.15)'));}
function wNoteSave(){widInit();S.me.note.text=$('#wn_t').value;if(window._wnPaper)S.me.note.paper=window._wnPaper;S.me.note.ink=$('#wn_ink').value;window._wnPaper=null;save();closeModal();render();toast('便签已贴上');}
function wMoodPick(){widInit();openModal(`<h3>今天心情如何</h3><div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:12px 0 6px">${Object.keys(MOODS).map(k=>`<div onclick="wMoodSet('${k}')" style="display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;width:62px">${moodIc(k,34,'#ffb3c8')}<small style="color:#bbb">${MOODS[k][0]}</small></div>`).join('')}</div>${S.me.mood&&S.me.mood.k&&S.me.mood.date===wToday()?'<div class="btns" style="margin-top:8px"><button class="btn g" onclick="S.me.mood={k:\'\',date:\'\'};save();closeModal();render()">清除今天</button></div>':''}`);}
function wMoodSet(k){widInit();S.me.mood={k,date:wToday()};save();closeModal();render();toast('记下啦');}
// 组件管理（开关 + 拖动排序）
//@@ private
function glassWidgetsRestoreAll(){homeLayoutInit();const order=['dashboard','vinyl','sweetie'];S.me.homeLayout=S.me.homeLayout.map(pg=>pg.filter(v=>!String(v).startsWith('w:')));for(let n=order.length-1;n>=0;n--)S.me.homeLayout[0].unshift('w:'+order[n]);S.me.widgets=order.slice();homeLayoutSyncLegacy();save();render();widgetManager();toast('三个玻璃主屏组件已恢复');}
//@@ end
function widgetManager(){widInit();const meta={};WIDS.forEach(w=>meta[w[0]]=w);
//@@ web
  if(glassThemeOn()){const fixed=['dashboard','vinyl','sweetie'],vinylPresets=['#858683','#c37a96','#7892bd','#7e6aa8','#b96e55','#3f7868'];openModal(`<h3>透明玻璃主屏组件</h3><div class="hint">旧组件已经移除，只保留以下三个组件。回到主屏后长按任意 App 或组件，就能互相穿插、自由安排位置，松手后会保存。</div><div class="wlist">${fixed.map(k=>`<div class="wrow"><div class="wnm">${meta[k][1]}<small>${meta[k][2]}</small></div><span style="color:#8fd6aa;font-size:12px">已保留</span></div>`).join('')}</div><div class="wapbox"><div class="waprow"><span>组件玻璃色调<small style="display:block;color:#777">只改变非常浅的玻璃着色</small></span><input type="color" value="${glassWidgetTint()}" oninput="glassWidgetAppearanceSet('tint',this.value)"></div><div class="waprow"><span>组件透明度<small style="display:block;color:#777">默认已降低；0 完全透明 · 100 接近实色</small></span><input type="range" min="0" max="100" step="1" value="${glassWidgetOpacity()}" oninput="glassWidgetAppearanceSet('opacity',this.value)"><b id="glassWidgetOpacityVal">${glassWidgetOpacity()}%</b></div><div class="waprow"><span>组件文字与图标颜色</span><input type="color" data-widget-text-color aria-label="组件文字与图标颜色" value="${glassWidgetTextColor()}" oninput="glassWidgetTextSet('color',this.value)"></div><div class="waprow"><span>文字与图标不透明度<small style="display:block;color:#777">0 隐藏 · 100 完全显示，照片不受影响</small></span><input type="range" data-widget-text-opacity aria-label="文字与图标不透明度" min="0" max="100" step="1" value="${glassWidgetTextOpacity()}" oninput="glassWidgetTextSet('opacity',this.value)"><b id="glassWidgetTextOpacityVal">${glassWidgetTextOpacity()}%</b></div><button class="minibtn" onclick="glassWidgetTextSet('reset')">恢复白色文字与图标</button>${glassInnerControls()}<div class="waprow"><span>圆盘与唱臂透明度<small style="display:block;color:#777">只调外围圆盘和右侧小条，中心图片保持显示</small></span><input type="range" data-home-vinyl-opacity aria-label="圆盘与唱臂透明度" min="0" max="100" step="1" value="${homeVinylOpacity()}" oninput="homeVinylOpacitySet(this.value)"><b id="homeVinylOpacityVal">${homeVinylOpacity()}%</b></div><button class="minibtn" onclick="homeVinylOpacitySet(null)">恢复圆盘与唱臂透明度</button><div class="waprow home-vinyl-color-row"><span>主屏唱片颜色<small style="display:block;color:#777">只改桌面外面的圆盘；不影响音乐 App 的唱片设置。安卓可直接点下方色块</small></span><input data-home-vinyl-color type="color" aria-label="主屏唱片颜色" value="${homeVinylPickerColor()}" oninput="homeVinylColorSet(this.value)" onchange="homeVinylColorSet(this.value)"><div class="home-vinyl-color-presets" aria-label="安卓兼容唱片颜色">${vinylPresets.map(color=>`<button type="button" style="--home-vinyl-swatch:${color}" aria-label="选择唱片颜色 ${color}" onclick="homeVinylColorSet('${color}')"></button>`).join('')}</div></div></div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"><button class="minibtn" onclick="glassWidgetAppearanceReset()">恢复玻璃组件默认</button><button class="minibtn" onclick="homeVinylColorReset()">主屏唱片恢复跟随主题</button></div><div class="btns" style="margin-top:12px"><button class="btn p" onclick="closeModal()">完成</button></div>`);return;}
//@@ private
  if(glassThemeOn()){const fixed=['dashboard','vinyl','sweetie'],vinylPresets=['#858683','#c37a96','#7892bd','#7e6aa8','#b96e55','#3f7868'];openModal(`<h3>透明玻璃主屏组件</h3><div class="hint">点右侧开关可重新启用消失的组件。回到主屏后长按任意 App 或组件，就能互相穿插、自由安排位置，松手后会保存。</div><div class="wlist">${fixed.map(k=>wManRow(k,meta[k],S.me.widgets.includes(k))).join('')}</div><div class="wapbox"><div class="waprow"><span>组件玻璃色调<small style="display:block;color:#777">只改变非常浅的玻璃着色</small></span><input type="color" value="${glassWidgetTint()}" oninput="glassWidgetAppearanceSet('tint',this.value)"></div><div class="waprow"><span>组件透明度<small style="display:block;color:#777">默认已降低；0 完全透明 · 100 接近实色</small></span><input type="range" min="0" max="100" step="1" value="${glassWidgetOpacity()}" oninput="glassWidgetAppearanceSet('opacity',this.value)"><b id="glassWidgetOpacityVal">${glassWidgetOpacity()}%</b></div><div class="waprow"><span>组件文字与图标颜色</span><input type="color" data-widget-text-color aria-label="组件文字与图标颜色" value="${glassWidgetTextColor()}" oninput="glassWidgetTextSet('color',this.value)"></div><div class="waprow"><span>文字与图标不透明度<small style="display:block;color:#777">0 隐藏 · 100 完全显示，照片不受影响</small></span><input type="range" data-widget-text-opacity aria-label="文字与图标不透明度" min="0" max="100" step="1" value="${glassWidgetTextOpacity()}" oninput="glassWidgetTextSet('opacity',this.value)"><b id="glassWidgetTextOpacityVal">${glassWidgetTextOpacity()}%</b></div><button class="minibtn" onclick="glassWidgetTextSet('reset')">恢复白色文字与图标</button>${glassInnerControls()}<div class="waprow"><span>圆盘与唱臂透明度<small style="display:block;color:#777">只调外围圆盘和右侧小条，中心图片保持显示</small></span><input type="range" data-home-vinyl-opacity aria-label="圆盘与唱臂透明度" min="0" max="100" step="1" value="${homeVinylOpacity()}" oninput="homeVinylOpacitySet(this.value)"><b id="homeVinylOpacityVal">${homeVinylOpacity()}%</b></div><button class="minibtn" onclick="homeVinylOpacitySet(null)">恢复圆盘与唱臂透明度</button><div class="waprow home-vinyl-color-row"><span>主屏唱片颜色<small style="display:block;color:#777">只改桌面外面的圆盘；不影响音乐 App 的唱片设置。安卓可直接点下方色块</small></span><input data-home-vinyl-color type="color" aria-label="主屏唱片颜色" value="${homeVinylPickerColor()}" oninput="homeVinylColorSet(this.value)" onchange="homeVinylColorSet(this.value)"><div class="home-vinyl-color-presets" aria-label="安卓兼容唱片颜色">${vinylPresets.map(color=>`<button type="button" style="--home-vinyl-swatch:${color}" aria-label="选择唱片颜色 ${color}" onclick="homeVinylColorSet('${color}')"></button>`).join('')}</div></div></div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"><button class="minibtn" onclick="glassWidgetsRestoreAll()">恢复三个主屏组件</button><button class="minibtn" onclick="glassWidgetAppearanceReset()">恢复玻璃组件默认</button><button class="minibtn" onclick="homeVinylColorReset()">主屏唱片恢复跟随主题</button></div><div class="btns" style="margin-top:12px"><button class="btn p" onclick="closeModal()">完成</button></div>`);return;}
//@@ end
  const en=S.me.widgets.filter(k=>meta[k]);const off=WIDS.map(w=>w[0]).filter(k=>!S.me.widgets.includes(k));
  openModal(`<h3>主屏组件</h3><div class="hint">拖左边手柄排序，点开关增减。组件固定在主屏第一页；颜色和透明度修改后会立即预览。</div>
   <div style="color:#aaa;font-size:13px;margin:12px 0 2px">已显示（拖动排序）</div>
   <div class="wlist" id="wlist" onpointermove="wDragMove(event)" onpointerup="wDragEnd()" onpointercancel="wDragEnd()">
   ${en.length?en.map(k=>wManRow(k,meta[k],true)).join(''):'<div style="color:#777;padding:8px">都关掉了</div>'}</div>
   ${off.length?`<div style="color:#aaa;font-size:13px;margin:14px 0 2px">已关闭（点开启）</div>${off.map(k=>wManRow(k,meta[k],false)).join('')}`:''}
   <div class="wapbox">
     <div class="waprow"><span>卡片颜色</span><input type="color" id="wcardcolor" value="${widgetCardColor()}" oninput="widgetAppearanceSet('wCardColor',this.value)"></div>
     <div class="waprow"><span>卡片透明度<small style="display:block;color:#777">0透明 · 100实色</small></span><input type="range" id="wopacity" min="0" max="100" step="1" value="${widgetOpacityValue()}" oninput="widgetAppearanceSet('wOpacity',this.value)"><b id="wopacityVal">${widgetOpacityValue()}%</b></div>
     <div class="waprow"><span>文字和图标颜色</span><input type="color" id="wcolor" value="${widgetHex(wcol(),'#ffffff')}" oninput="widgetAppearanceSet('wColor',this.value)"></div>
     <div class="waprow"><span>桌面小猫颜色</span><input type="color" id="wpetcolor" value="${petcol()}" oninput="widgetAppearanceSet('petColor',this.value)"></div>
   </div>
   <button class="minibtn" style="margin-top:10px" onclick="widgetAppearanceReset()">恢复主题默认</button>
   <div class="btns" style="margin-top:10px"><button class="btn p" onclick="closeModal()">完成</button></div>`);}
function wManRow(k,w,on){return `<div class="wrow" data-k="${k}">${on?`<span class="whandle" onpointerdown="wDragDown(event,'${k}')">${svgIc('dots',20,'#888')}</span>`:'<span style="width:26px;flex:none"></span>'}<div class="wnm">${w[1]}<small>${w[2]}</small></div><span class="sw ${on?'on':''}" onclick="wToggle('${k}')"></span></div>`;}
//@@ web
function homeWidgetOrderApply(order){homeLayoutInit();const tokens=order.map(k=>'w:'+k),slots=[];S.me.homeLayout.forEach((pg,pi)=>pg.forEach((v,i)=>{if(String(v).startsWith('w:'))slots.push([pi,i]);}));const keep=Math.min(tokens.length,slots.length);for(let n=0;n<keep;n++){const s=slots[n];S.me.homeLayout[s[0]][s[1]]=tokens[n];}for(let n=slots.length-1;n>=tokens.length;n--){const s=slots[n];S.me.homeLayout[s[0]].splice(s[1],1);}for(let n=slots.length;n<tokens.length;n++)S.me.homeLayout[0].unshift(tokens[n]);S.me.widgets=order.slice();homeLayoutSyncLegacy();}
//@@ private
function homeWidgetOrderApply(order){homeLayoutInit();const tokens=order.map(k=>'w:'+k),slots=[];S.me.homeLayout.forEach((pg,pi)=>pg.forEach((v,i)=>{if(String(v).startsWith('w:'))slots.push([pi,i]);}));const keep=Math.min(tokens.length,slots.length);for(let n=0;n<keep;n++){const s=slots[n];S.me.homeLayout[s[0]][s[1]]=tokens[n];}for(let n=slots.length-1;n>=tokens.length;n--){const s=slots[n];S.me.homeLayout[s[0]].splice(s[1],1);}for(let n=tokens.length-1;n>=slots.length;n--)S.me.homeLayout[0].unshift(tokens[n]);S.me.widgets=order.slice();homeLayoutSyncLegacy();}
//@@ end
function wToggle(k){homeLayoutInit();const order=S.me.widgets.slice(),i=order.indexOf(k);if(i>=0)order.splice(i,1);else order.push(k);homeWidgetOrderApply(order);save();render();widgetManager();}
let _wdg=null;
function wDragDown(e,k){const row=e.target.closest('.wrow');if(!row)return;_wdg={k,row};row.classList.add('wdrag');try{row.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();}
function wDragMove(e){if(!_wdg)return;e.preventDefault();const list=document.getElementById('wlist');if(!list)return;
  const rows=[...list.querySelectorAll('.wrow')];const y=e.clientY;let after=null;
  for(const r of rows){if(r===_wdg.row)continue;const b=r.getBoundingClientRect();if(y<b.top+b.height/2){after=r;break;}}
  if(after){if(after!==_wdg.row.nextSibling)list.insertBefore(_wdg.row,after);}else if(_wdg.row!==list.lastElementChild)list.appendChild(_wdg.row);}
function wDragEnd(){if(!_wdg)return;_wdg.row.classList.remove('wdrag');const list=document.getElementById('wlist');
  if(list){const order=[...list.querySelectorAll('.wrow')].map(r=>r.dataset.k).filter(k=>WIDS.some(w=>w[0]===k));
    if(order.length){homeWidgetOrderApply(order);save();render();}}
  _wdg=null;}
// 简约线条图标库（白色，替代 emoji，更高级）
const _MI=(p,f)=>'<svg viewBox="0 0 24 24" width="26" height="26" fill="'+(f?'#fff':'none')+'" stroke="'+(f?'none':'#fff')+'" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';
const MICO={
  wechat:_MI('<path d="M21 11.4a8.3 8.3 0 0 1-12 7.4L4 20.5l1.4-4A8.3 8.3 0 1 1 21 11.4z"/><path d="M8.6 11.3h.01M12 11.3h.01M15.4 11.3h.01"/>'),
  phoneapp:_MI('<path d="M7.2 4.2 9.7 6.7a1.7 1.7 0 0 1 .3 1.9l-.8 1.6a12 12 0 0 0 4.6 4.6l1.6-.8a1.7 1.7 0 0 1 1.9.3l2.5 2.5a1.7 1.7 0 0 1-.1 2.5c-1 .9-2.2 1.4-3.5 1.1C9.7 19.1 4.9 14.3 3.6 7.8c-.3-1.3.2-2.5 1.1-3.5a1.7 1.7 0 0 1 2.5-.1z"/>'),
  contacts:_MI('<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>'),
  me:_MI('<circle cx="12" cy="12" r="8.4"/><path d="M8.6 10h.01M15.4 10h.01M8.6 14.4c1.5 1.7 5.3 1.7 6.8 0"/>'),
  settings:_MI('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v3M12 18.4v3M21.4 12h-3M5.6 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6"/>'),
  worldbook:_MI('<path d="M6.5 3.5H18a1 1 0 0 1 1 1V19.5a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 19V5A1.5 1.5 0 0 1 6.5 3.5z"/><path d="M9 3.5V20.5"/>'),
  browser:_MI('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 2.6 15 0 18M12 3c-2.6 2.6-2.6 15 0 18"/>'),
  moments:_MI('<rect x="3" y="7" width="18" height="13" rx="2.6"/><circle cx="12" cy="13.5" r="3.3"/><path d="M8.3 7l1.4-2.4h4.6L15.7 7"/>'),
  spy:_MI('<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5 16 16"/>'),
  shop:_MI('<path d="M6.2 8h11.6l-.9 11.1a1 1 0 0 1-1 .9H8.1a1 1 0 0 1-1-.9z"/><path d="M9 8V6.6a3 3 0 0 1 6 0V8"/>'),
  calendar:_MI('<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 9.5h17M8.5 3v4M15.5 3v4"/>'),
  x:_MI('<path d="M17.3 3h2.9l-6.4 7.3L21.5 21h-5.7l-4.4-5.8L6.2 21H3.3l6.9-7.8L2.8 3h5.8l4 5.3zM16.2 19.3h1.6L8 4.6H6.3z"/>',true),
  douyin:_MI('<path d="M14 3h2.4a4.6 4.6 0 0 0 3.6 3.6V9a6.9 6.9 0 0 1-3.6-1v6.4A5.1 5.1 0 1 1 11 9.4v2.7a2.4 2.4 0 1 0 1.7 2.3z"/>',true),
  food:_MI('<path d="M5 3v6a2 2 0 0 0 4 0V3M7 9v12M17 3c-1.4 0-2.3 2-2.3 4.5S15.6 12 17 12s2.3-1 2.3-4.5S18.4 3 17 3zM17 12v9"/>'),
  couple:_MI('<path d="M12 20.5S3.5 15 3.5 8.9A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8.5 1.9C20.5 15 12 20.5 12 20.5z"/>',true),
  tasks:_MI('<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3.2h6v1.3M8.8 12.4l2 2 4-4"/>'),
  games:_MI('<rect x="2.5" y="7.5" width="19" height="9" rx="4.5"/><path d="M6.8 10.5v3M5.3 12h3M15.6 11h.01M18 13.5h.01"/>'),
  mail:_MI('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.6 7l8.4 5.5L20.4 7"/>'),
  offline:_MI('<path d="M8.4 3.5h7.2l-.8 5.1a2.8 2.8 0 0 1-5.6 0zM12 11.4V19M9 19h6"/>'),
  music:_MI('<path d="M19 4 9 6.1v9.4A3 3 0 1 0 11 18V9.7l6-1.2v4.8A3 3 0 1 0 19 16z"/>',true),
  cinema:_MI('<rect x="3.2" y="5.2" width="17.6" height="13.6" rx="3"/><path d="M7 2.8v2.4M17 2.8v2.4M7 18.8v2.4M17 18.8v2.4"/><path d="m10.2 9 5 3-5 3z"/>'),
  roleplay:_MI('<path d="M4.5 6.2h6.3v4.2a3.2 3.2 0 0 1-6.3 0z"/><path d="M13.2 6.2h6.3v4.2a3.2 3.2 0 0 1-6.3 0z"/><path d="M7.1 12.8c1 .8 2.2 1.2 3.7 1.2"/><path d="M17 12.8c-1 .8-2.2 1.2-3.7 1.2"/><path d="M12 13.5v6"/><path d="M8.5 19.5h7"/>'),
  album:_MI('<rect x="3" y="4" width="18" height="16" rx="4"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 6-6 4 4 3-3 4 5"/>'),
  tale:_MI('<rect x="8.5" y="9" width="7" height="11" rx="1"/><path d="M12 9V6.4"/><path d="M12 2.4c1.5 1.3 2.2 2.5 2.2 3.6a2.2 2.2 0 0 1-4.4 0c0-1.1.7-2.3 2.2-3.6z"/><path d="M6.8 20.2h10.4"/>'),
  travel:_MI('<path d="M3.5 12.2 20.5 5l-5.1 15.5-3.3-6.4-6.6-1.9z"/><path d="M12.1 14.1 20.5 5"/><path d="M5.5 12.7 3.8 18l4.6-2.8"/>'),
  dread:_MI('<path d="M12 3.2c3.2 4.2 6 7.2 6 10.6a6 6 0 0 1-12 0c0-3.4 2.8-6.4 6-10.6z"/>')
};
//@@ web
function aIco(key,emoji,bg,extra){const custom=S.me.appIcons&&S.me.appIcons[key],packed=custom?'':appIconPackAsset(key),ic=custom||packed,fallback=MICO[key]||emoji;const glyph=ic?`<span class="app-icon-fallback">${fallback}</span><img src="${storedImageDisplaySource(ic)}"${packed?' decoding="sync" loading="eager" fetchpriority="high"':''} draggable="false" onload="this.style.display='';if(this.previousElementSibling)this.previousElementSibling.hidden=true" onerror="this.style.display='none'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%">`:fallback;
//@@ private
function aIco(key,emoji,bg,extra){const custom=S.me.appIcons&&S.me.appIcons[key],packed=custom?'':appIconPackAsset(key),ic=custom||packed,fallback=MICO[key]||emoji;const glyph=ic?`<span class="app-icon-fallback">${fallback}</span><img src="${storedImageDisplaySource(ic)}"${packed?' decoding="async"':''} draggable="false" onload="this.style.display='';if(this.previousElementSibling)this.previousElementSibling.hidden=true" onerror="this.style.display='none'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%">`:fallback;
//@@ end
  return `<div class="ic${custom?' custom-app-icon':''}${packed?' glass-pack-icon glass-icon-'+key:''}" style="${custom?'background:#222;':packed?'background:transparent;':'background:'+bg+';'}color:#fff;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center">${glyph}${extra||''}</div>`;}
// 通用线条图标（UI 里替代 emoji，可指定颜色/大小，默认跟随文字色）
const ICONS={
  chat:'<path d="M21 11.4a8.3 8.3 0 0 1-12 7.4L4 20.5l1.4-4A8.3 8.3 0 1 1 21 11.4z"/><path d="M8.6 11.3h.01M12 11.3h.01M15.4 11.3h.01"/>',
  message:'<path d="M21 11.4a8.3 8.3 0 0 1-12 7.4L4 20.5l1.4-4A8.3 8.3 0 1 1 21 11.4z"/><path d="M8 11.5h8M8 14h5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  users:'<circle cx="9" cy="8" r="3.1"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M15.6 5.5a3.1 3.1 0 0 1 0 5M17.5 19a5.6 5.6 0 0 0-3-5"/>',
  cat:'<path d="M5.5 4 7 8.3M18.5 4 17 8.3"/><path d="M5.5 9.5C5.5 14 8 17.5 12 17.5s6.5-3.5 6.5-8"/><path d="M9.6 12h.01M14.4 12h.01M10.8 14.4c.7.5 1.7.5 2.4 0"/>',
  smile:'<circle cx="12" cy="12" r="8.2"/><path d="M8.8 10h.01M15.2 10h.01M8.8 14c.8 1.2 1.9 1.8 3.2 1.8s2.4-.6 3.2-1.8"/>',
  gear:'<circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v3M12 18.4v3M21.4 12h-3M5.6 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6"/>',
  flashlight:'<path d="M8 3.5h8M9 6.5h6l-.9 4.2H9.9z"/><path d="M10 10.7h4v8.1a1.7 1.7 0 0 1-1.7 1.7h-.6A1.7 1.7 0 0 1 10 18.8z"/><path d="M12 14.2v2.8"/>',
  camera:'<rect x="3" y="7" width="18" height="13" rx="2.6"/><circle cx="12" cy="13.5" r="3.3"/><path d="M8.3 7l1.4-2.4h4.6L15.7 7"/>',
  wallet:'<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H18a1 1 0 0 1 1 1v1.2"/><rect x="3" y="8" width="18" height="10.5" rx="2"/><path d="M15.5 12.5h3.5v3h-3.5a1.5 1.5 0 0 1 0-3z"/>',
  steps:'<path d="M3 13h3.5l2-7 3.5 13 2.2-6H21"/>',
  mask:'<path d="M4 5.5h16v5a8 8 0 0 1-16 0z"/><path d="M8.5 10h.01M15.5 10h.01M9 13.5c1.6 1.5 4.4 1.5 6 0"/>',
  idcard:'<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><circle cx="8.5" cy="10.8" r="2.1"/><path d="M13 9.5h5M13 12.5h4M5.6 15.4c.5-1.3 1.6-1.9 2.9-1.9s2.4.6 2.9 1.9"/>',
  image:'<rect x="3" y="4.5" width="18" height="15" rx="2.3"/><circle cx="8.5" cy="9.5" r="1.7"/><path d="M4 17l5-4 4 3 3-2.4 4 3.4"/>',
  money:'<circle cx="12" cy="12" r="8.3"/><path d="M9 9l3 3 3-3M12 12v4.2M9.6 13.4h4.8M9.6 15.4h4.8"/>',
  redpacket:'<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M5 8.6c3.2 2.1 10.8 2.1 14 0"/><circle cx="12" cy="10.4" r="1.5"/>',
  food:'<path d="M6.2 10.5h11.6l-.8 8.2a1.5 1.5 0 0 1-1.5 1.3h-7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M7 13.5h10M10 5.5l-1.5-2M14 5.5l1.5-2"/>',
  location:'<path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  phone:'<path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.1 2A16 16 0 0 1 4.5 6.1 2 2 0 0 1 6.5 4z"/>',
  video:'<rect x="3" y="6.5" width="12.5" height="11" rx="2.2"/><path d="M15.5 10.2l5.5-3v9.6l-5.5-3z"/>',
  spyphone:'<rect x="6" y="3" width="12" height="18" rx="2.5"/><circle cx="11.5" cy="11" r="2.4"/><path d="M13.4 12.9 15.6 15"/>',
  card:'<rect x="3" y="6" width="18" height="12" rx="2.2"/><path d="M3 10h18M6.5 14.5h4"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="3.2"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01"/>',
  route:'<path d="M5 7h12"/><path d="m14 4 3 3-3 3"/><path d="M19 17H7"/><path d="m10 14-3 3 3 3"/>',
  forward:'<path d="M13 5l7 7-7 7v-4.2C7 14.6 4 16.6 3.2 20 3.6 12.5 7.2 9.2 13 9.2z"/>',
  smile:'<circle cx="12" cy="12" r="8.4"/><path d="M8.6 10h.01M15.4 10h.01M8.6 14.4c1.5 1.7 5.3 1.7 6.8 0"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.6 11a6.4 6.4 0 0 0 12.8 0M12 17.4V21M8.6 21h6.8"/>',
  keyboard:'<rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="M6.5 9h.01M10 9h.01M13.5 9h.01M17 9h.01M6.5 12.5h.01M10 12.5h.01M13.5 12.5h.01M17 12.5h.01M7 16h10"/>',
  thought:'<path d="M5.5 10a5 5 0 0 1 9-3 4 4 0 0 1 4.5 4 3.4 3.4 0 0 1-3.4 3.4H8.4A3.4 3.4 0 0 1 5.5 10z"/><path d="M5 16.5h.01M7.5 19.5h.01"/>',
  home:'<path d="M4 11l8-7 8 7M6.5 9.5V20h11V9.5"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5 16 16"/>',
  envelope:'<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.6 7l8.4 5.5L20.4 7"/>',
  bank:'<path d="M3.5 9.5 12 4l8.5 5.5M5 9.5h14M3.5 20.5h17M6 10v8.5M10 10v8.5M14 10v8.5M18 10v8.5"/>',
  book:'<path d="M6.5 3.5H18a1 1 0 0 1 1 1V19.5a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 19V5A1.5 1.5 0 0 1 6.5 3.5z"/><path d="M9 3.5V20.5"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.2"/><path d="M3.5 9.5h17M8.5 3v4M15.5 3v4"/>',
  bag:'<path d="M6.2 8h11.6l-.9 11.1a1 1 0 0 1-1 .9H8.1a1 1 0 0 1-1-.9z"/><path d="M9 8V6.6a3 3 0 0 1 6 0V8"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 2.6 15 0 18M12 3c-2.6 2.6-2.6 15 0 18"/>',
  notebook:'<rect x="6" y="3.5" width="13" height="17" rx="1.6"/><path d="M9.5 3.5V20.5M5 7.5h2M5 12h2M5 16.5h2"/>',
  glass:'<path d="M8.4 3.5h7.2l-.8 5.1a2.8 2.8 0 0 1-5.6 0zM12 11.4V19.5M9 19.5h6"/>',
  gift:'<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 12.5h16M12 9v11"/><path d="M12 9C12 6.5 10.5 5 8.8 5S6 6.2 6.6 7.6C7.1 8.7 12 9 12 9zM12 9c0-2.5 1.5-4 3.2-4S18 6.2 17.4 7.6C16.9 8.7 12 9 12 9z"/>',
  moon:'<path d="M20 13.5A8 8 0 1 1 10.5 4a6.3 6.3 0 0 0 9.5 9.5z"/>',
  bell:'<path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 15 18 9z"/><path d="M10 20a2.3 2.3 0 0 0 4 0"/>',
  lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  mute:'<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M16 9.5l4.5 5M20.5 9.5l-4.5 5"/>',
  star:'<path d="M12 3.5l2.6 5.3 5.9.85-4.3 4.15 1 5.85L12 17l-5.2 2.7 1-5.85L3.5 9.65l5.9-.85z"/>',
  timer:'<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9M9.5 2.5h5"/>',
  shield:'<path d="M12 3l7 2.5v6c0 4.6-3 7.8-7 9.5-4-1.7-7-4.9-7-9.5v-6z"/>',
  link:'<path d="M9.5 14.5l5-5M8 11l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 13l2-2a3.5 3.5 0 0 0-5-5l-2 2"/>',
  heart:'<path d="M12 20s-7-4.3-9.2-8.3A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9.2 5.7C19 15.7 12 20 12 20z"/>',
  heartoff:'<path d="M12 20s-7-4.3-9.2-8.3A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9.2 5.7C19 15.7 12 20 12 20z"/><path d="M4 4l16 16"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19"/>',
  flask:'<path d="M9.5 3v6L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-4.5-9V3M8 3h8M8 13h8"/>',
  dots:'<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  snow:'<path d="M12 2.5v19M3.8 7l16.4 10M20.2 7 3.8 17M12 6l-3 2M12 6l3 2M12 18l-3-2M12 18l3-2M5.5 9.5l.4 3.5M18.5 9.5l-.4 3.5"/>',
  refresh:'<path d="M20.5 4v5h-5"/><path d="M3.5 12a8.5 8.5 0 0 1 14.3-6.2L20.5 9"/><path d="M3.5 20v-5h5"/><path d="M20.5 12A8.5 8.5 0 0 1 6.2 18.2L3.5 15"/>',
  edit:'<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4M4 20l4-1"/>',
  trash:'<path d="M4 7h16M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L18.5 7M10 11v6M14 11v6"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  hangup:'<path d="M5.4 13.7 3.8 12a1.6 1.6 0 0 1 0-2.5c4.8-3.7 11.6-3.7 16.4 0a1.6 1.6 0 0 1 0 2.5l-1.6 1.7a1.5 1.5 0 0 1-2 .2l-1.7-1.3a1.3 1.3 0 0 1-.5-1.3l.3-1.4a10.5 10.5 0 0 0-6 0l.3 1.4a1.3 1.3 0 0 1-.5 1.3l-1.7 1.3a1.5 1.5 0 0 1-2-.2z"/>',
  phonecall:'<path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.1 2A16 16 0 0 1 4.5 6.1 2 2 0 0 1 6.5 4z"/>',
  volume:'<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.5 7.5 0 0 1 0 10.4"/>',
  weather:'<circle cx="8.5" cy="8" r="3"/><path d="M8.5 1.8v1.6M8.5 12.6v1.6M2 8h1.6M13.4 8H15M4 3.5l1.1 1.1M11.9 3.5l-1.1 1.1"/><path d="M7.5 19a3.7 3.7 0 0 1 .6-7.4A5 5 0 0 1 18 13a3.3 3.3 0 0 1-.5 6z"/>',
  disk:'<path d="M5 4h10.5L19 7.5V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 4v4.5h6.5V4M8.5 20v-5.5h7V20"/>',
  check:'<path d="M4.5 12.5l4.5 4.5 10.5-11"/>',
  expand:'<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
  note:'<path d="M9 18V6l10-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="15" r="2.5"/>',
  music:'<path d="M9.2 17.5V7.2l9.1-2.1v9.2"/><path d="M9.2 10.1l9.1-2.1"/><ellipse cx="6.6" cy="17.6" rx="2.6" ry="1.9"/><ellipse cx="15.7" cy="14.4" rx="2.6" ry="1.9"/>'
};
function svgIc(name,size,color,sw){const p=ICONS[name];if(!p)return '';size=size||22;
  return '<svg viewBox="0 0 24 24" width="'+size+'" height="'+size+'" fill="none" stroke="'+(color||'currentColor')+'" stroke-width="'+(sw||1.9)+'" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">'+p+'</svg>';}
/* svgIc 写死了 fill="none"，所以「点亮」的爱心、「收藏」的星星都只是描了个边。
   点上去就该是实心的，所以这里出一个填色版本。 */
function svgIcFill(name,size,color,sw){const p=ICONS[name];if(!p)return '';size=size||22;color=color||'currentColor';
  return '<svg viewBox="0 0 24 24" width="'+size+'" height="'+size+'" fill="'+color+'" stroke="'+color+'" stroke-width="'+(sw==null?1.4:sw)+'" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">'+p+'</svg>';}
/* 抖音那个评论按钮是一整块实心白气泡，中间三个点是镂空的洞——不是描一圈边。
   洞要靠 fill-rule="evenodd"，svgIc 做不出来，所以单独写一个。
   小尾巴是另一条 path：跟气泡同色会自然合成一块，放进 evenodd 里反而会被挖掉。 */
function dyCmIcon(size,color){size=size||30;color=color||'#fff';
  return '<svg viewBox="0 0 24 24" width="'+size+'" height="'+size+'" style="vertical-align:middle">'
    +'<path fill="'+color+'" d="M8.2 17.6 5.9 21.7c-.35.62.32 1.3.93.93l5.3-3.2z"/>'
    +'<path fill="'+color+'" fill-rule="evenodd" clip-rule="evenodd" d="'
    +'M12 2.6a9.6 8.4 0 1 0 0 16.8 9.6 8.4 0 1 0 0-16.8Z'
    +'M8.1 9.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2Z'
    +'M12 9.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2Z'
    +'M15.9 9.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2Z"/></svg>';}
/* 点上了就实心，没点就还是原来的线条 */
function dyIc(name,size,on,onColor,offColor,sw){return on?svgIcFill(name,size,onColor,sw):svgIc(name,size,offColor,sw);}
const HOMEAPPS=[['wechat','💬','微信'],['phoneapp','☎','电话'],['settings','⚙️','设置'],['album','','相册'],['worldbook','📖','世界书'],['browser','🌐','浏览器'],['moments','🌸','朋友圈'],['spy','🔍','查他手机'],['shop','🛒','购物'],['calendar','📅','日历'],['x','𝕏','X'],['douyin','🎵','抖音'],['food','🍔','外卖'],['couple','💞','情侣空间'],['tasks','📋','任务便签'],['games','🎮','游戏大厅'],['mail','','信箱'],['offline','🌹','线下约会'],['music','🎵','音乐'],['cinema','','放映室'],['roleplay','','角色扮演'],['pixelhome','','像素少女'],['pet','','电子宠物'],['travel','✈','小鱼旅行'],['contacts','👤','通讯录'],['me','🐱','我']];
function appIconEditor(){S.me.appIcons=S.me.appIcons||{};
  openModal(`<h3>App 图标</h3><div class="hint">给主屏图标换成你喜欢的图片，留空恢复默认。</div>
   ${HOMEAPPS.map(a=>`<div class="it"><span>${S.me.appIcons[a[0]]?'':a[1]} ${a[2]}</span><span class="v">${S.me.appIcons[a[0]]?`<img src="${S.me.appIcons[a[0]]}" style="width:26px;height:26px;border-radius:6px;object-fit:cover;vertical-align:middle">`:''}<button class="minibtn" style="margin-left:6px" onclick="setAppIcon('${a[0]}')">${S.me.appIcons[a[0]]?'换':'上传'}</button>${S.me.appIcons[a[0]]?`<button class="minibtn" style="margin-left:4px" onclick="delete S.me.appIcons['${a[0]}'];save();appIconEditor();render()">复位</button>`:''}</span></div>`).join('')}
   <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function setAppIcon(key){pickFile('image/*',async f=>{S.me.appIcons=S.me.appIcons||{};S.me.appIcons[key]=await compressSquare(f,256,.84);defaultBeautyMark();save();appIconEditor();render();toast('图标已换 🎨');});}
const LOCKABLE={browser:'浏览器',moments:'朋友圈',spy:'查他手机',shop:'购物',calendar:'日历',x:'X',douyin:'抖音',food:'外卖',games:'游戏大厅',mail:'信箱',phoneapp:'电话',offline:'线下约会',roleplay:'角色扮演',pixelhome:'像素少女',pet:'电子宠物',music:'音乐',cinema:'放映室',travel:'小鱼旅行',album:'相册',nearby:'附近的人'};
function appLocked(key){return !!(S.couple&&S.couple.locks&&S.couple.locks[key]);}
/* ROLE_LOCK_UNTIL_V1: a role's lock always carries an unlock time and reopens on its own. The tag's
   time segment is read before the old lock code runs, so that code is unchanged; the time lives in
   S.couple.lockUntil ('int:'+app key / 'ext:'+external id). Where the time comes from, in order:
   the tag, the role's own words in that reply, a short background question to the role, and only
   then the next 07:00 at least an hour away. */
const LOCK_UNTIL_MAX=7*86400e3,LOCK_DAY_WORDS='今天|今晚|明天|明早|明晚|后天',LOCK_PART_WORDS='早上|早晨|上午|中午|下午|傍晚|晚上|夜里|凌晨',LOCK_PART_HOUR={早上:7,早晨:7,上午:9,中午:12,下午:15,傍晚:18,晚上:20,夜里:22,凌晨:5};
function lockUntilDigits(text){const d={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};return String(text||'').replace(/[一二两三四五六七八九]?十[一二三四五六七八九]?|[零一二两三四五六七八九](?=[天日小个钟分点时半])/g,w=>{if(!w.includes('十'))return String(d[w]);const [a,b]=w.split('十');return String((a?d[a]:1)*10+(b?d[b]:0));});}
function lockUntilDefault(now){const d=new Date(now);d.setHours(7,0,0,0);let at=d.getTime();while(at<=now+3600e3)at+=86400e3;return at;}
function lockUntilParse(seg,now){const s=lockUntilDigits(String(seg||'').replace(/\s+/g,''));if(!s)return 0;let m=/^(?:锁|锁定|共|一共)?(\d+(?:\.\d+)?)(天|日|个小时|小时|钟头|h|分钟|分|min)$/i.exec(s);
 if(m){const n=+m[1],u=m[2].toLowerCase(),ms=/天|日/.test(u)?n*86400e3:/分|min/.test(u)?n*60e3:n*3600e3;return ms>0?now+ms:0;}
 m=new RegExp('^(?:到|至|直到|锁到)?('+LOCK_DAY_WORDS+')?('+LOCK_PART_WORDS+')?(?:(\\d{1,2})(?:[:：点时](\\d{1,2})?分?(半)?)?)?$').exec(s);
 if(!m||!(m[1]||m[2]||m[3]))return 0;if(!m[3]&&!m[1]&&!m[2])return 0;if(m[3]&&!(m[1]||m[2]||/[:：点时]/.test(s)||/^(?:到|至|直到|锁到)/.test(s)))return 0;
 let h=m[3]?+m[3]:m[2]?LOCK_PART_HOUR[m[2]]:/晚/.test(m[1])?20:7,min=m[5]?30:+(m[4]||0);if(h>23||min>59)return 0;
 if(m[3]&&/下午|傍晚|晚上|夜里|今晚|明晚/.test((m[1]||'')+(m[2]||''))&&h<12)h+=12;if(m[3]&&m[2]==='中午'&&h<6)h+=12;
 const d=new Date(now);d.setHours(h,min,0,0);let at=d.getTime();const offset={明天:1,明早:1,明晚:1,后天:2}[m[1]]||0;
 if(offset)at+=offset*86400e3;else{while(at<=now+60e3)at+=86400e3;
  // "到十一点" said at 7 pm means 11 tonight: a bare 点 hour takes the nearer of morning and evening.
  if(m[3]&&!m[1]&&!m[2]&&h<12&&/点/.test(s)){const pm=new Date(now);pm.setHours(h+12,min,0,0);if(pm.getTime()>now+60e3&&pm.getTime()<at)at=pm.getTime();}}return at;}
// Layer 2: the role said when in its own words ("明天中午再给你开", "锁你三天", "锁到十一点").
function lockUntilFromText(text,now){const t=lockUntilDigits(String(text||'').replace(/<(think|analysis|reasoning)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi,' ').replace(/[\[【][^\]】]*[\]】]/g,' ').replace(/\s+/g,''));
 const when='(?:(?:'+LOCK_DAY_WORDS+')(?:'+LOCK_PART_WORDS+')?|(?:'+LOCK_PART_WORDS+'))?(?:\\d{1,2}(?:[:：点时]\\d{0,2}分?半?)?)?',span='\\d+(?:\\.\\d+)?(?:天|日|个小时|小时|钟头|分钟)';
 const rules=[new RegExp('(?:锁到|锁至|关到|锁你到|锁它到)('+when+')'),new RegExp('锁(?:你|它|这个|这些|一下)?('+span+')'),new RegExp('('+span+')(?:以后|之后|后)?(?:再|才)(?:给你)?(?:解|开|放)'),new RegExp('('+when+')(?:再|才)(?:给你)?(?:解开|解锁|打开|开|放)')];
 for(const re of rules){const m=re.exec(t);if(m&&m[1]){const at=lockUntilParse(m[1],now);if(at)return at;}}return 0;}
function lockUntilClamp(at,now){return Math.min(Math.max(+at||0,now+60e3),now+LOCK_UNTIL_MAX);}
function lockUntilPrepare(content){const now=Date.now(),items=[];const text=String(content||'').replace(/([\[【]\s*(?:锁定|上锁)\s*[\|｜:：]\s*)([^\]】]*)([\]】])/g,(all,head,arg,tail)=>{let at=0;const rest=[];for(const part of String(arg).split(/[\|｜]/)){const t=at?0:lockUntilParse(part,now);if(t)at=t;else rest.push(part);}const target=rest.join('|');items.push({target,at:at?lockUntilClamp(at,now):0});return head+target+tail;});return{content:text,items};}
function lockUntilExternalLocked(st,app){try{return typeof companionExternalAlreadyInState==='function'&&companionExternalAlreadyInState(st,app,'lock');}catch(_){return false;}}
function lockUntilSnapshot(){const st=typeof companionState==='function'?companionState():null,ext={};(Array.isArray(st&&st.apps)?st.apps:[]).forEach(app=>{if(app&&app.id)ext[app.id]=lockUntilExternalLocked(st,app);});return{int:Object.assign({},S.couple&&S.couple.locks||{}),ext};}
/* LOCK_TIME_RECEIPT_V1: only device-confirmed deadlines enter the active timer map. */
let _lockUntilNativeJobs=new Map();
function lockUntilNative(id,at){const couple=S.couple,account=typeof actId==='function'?actId():'',key='ext:'+id,job={at};_lockUntilNativeJobs.set(key,job);const current=()=>S.couple===couple&&(typeof actId!=='function'||actId()===account)&&_lockUntilNativeJobs.get(key)===job;
 const run=async()=>{if(!current())return false;const status=couple.lockTimeResults=couple.lockTimeResults||{};status[key]={state:'pending',at};save();try{if(typeof companionLocalNativeAvailable!=='function'||!companionLocalNativeAvailable()||!window.SmallPhoneNative)throw Error('当前设备无法确认自动解锁时间');for(let attempt=0;attempt<3;attempt++){if(!current())return false;try{const result=await window.SmallPhoneNative.request('device.autoUnlock',{externalAppId:id,unlockAt:at});if(!result||result.scheduled!==true)throw Error('手机未确认解锁定时，请检查授权或稍后重试');if(!current())return false;(couple.lockUntil=couple.lockUntil||{})[key]=at;delete status[key];save();return true;}catch(e){if(attempt===2||typeof companionNativeCommandRetryable!=='function'||!companionNativeCommandRetryable(e))throw e;await sleep(360);}}}catch(e){if(current()){status[key]={state:'failed',at};save();if(typeof toast==='function')toast('解锁时间未更新：'+String(e.message||e));}return false;}finally{if(current())_lockUntilNativeJobs.delete(key);}};
 const lane=typeof _companionNativeCommandLane!=='undefined'?_companionNativeCommandLane:Promise.resolve(),pending=lane.catch(()=>{}).then(run);if(typeof _companionNativeCommandLane!=='undefined')_companionNativeCommandLane=pending;return pending;}
function lockUntilCommit(plan,before,c,text){if(!plan||!plan.items.length||!S.couple)return false;const now=Date.now(),until=S.couple.lockUntil=S.couple.lockUntil||{},locks=S.couple.locks||{},st=typeof companionState==='function'?companionState():null;
 const spoken=lockUntilFromText(text,now),fallback=lockUntilDefault(now),asked=[],names=[];let changed=false;
 const resolve=item=>item&&item.at?item.at:spoken?lockUntilClamp(spoken,now):0;
//@@ web
 const put=(key,at,name,ext)=>{const value=at||fallback;if(until[key]!==value){if(ext&&typeof companionLocalNativeAvailable==='function'&&companionLocalNativeAvailable())lockUntilNative(ext,value);else{until[key]=value;changed=true;}}if(!at){asked.push({key,value,ext});if(name&&!names.includes(name))names.push(name);}};
//@@ private
 const put=(key,at,name,ext)=>{const value=at||fallback;if(until[key]!==value){if(ext)lockUntilNative(ext,value);else{until[key]=value;changed=true;}}if(!at){asked.push({key,value,ext});if(name&&!names.includes(name))names.push(name);}};
//@@ end
 Object.keys(locks).forEach(k=>{if(locks[k]&&locks[k].auto)return;const key='int:'+k,fresh=!before.int[k];const item=plan.items.find(it=>{try{return _appKeys(it.target,[k],()=>true).includes(k);}catch(_){return false;}});if(item)put(key,resolve(item),LOCKABLE[k]||k,'');});
 (Array.isArray(st&&st.apps)?st.apps:[]).forEach(app=>{if(!app||!app.id||!lockUntilExternalLocked(st,app))return;const key='ext:'+app.id,fresh=!before.ext[app.id];const item=plan.items.find(it=>{try{return companionExternalTargetsByText(st,it.target).some(a=>a&&a.id===app.id);}catch(_){return false;}});if(!item)return;put(key,resolve(item),app.name||'',app.id);});
 if(changed)save();if(asked.length&&c)window._lockUntilAsking=lockUntilAsk(c,asked,names);return changed;}
// Layer 3: one short background question to the role, never shown in the chat.
