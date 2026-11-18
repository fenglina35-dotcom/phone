function liveLocMatch(text){
  text=''+(text||'');if(!text.trim())return null;
  let best=null,bestLen=0;
  LIVE_LOC_CITIES.forEach(c=>{[c.n].concat(c.a||[]).forEach(k=>{k=''+k;
    if(k&&text.toLowerCase().indexOf(k.toLowerCase())>=0&&k.length>bestLen){best=c;bestLen=k.length;}});});
  return best;}
function liveLocCity(text,fallback){
  text=''+(text||'');let best=null,bestLen=0;
  LIVE_LOC_CITIES.forEach(c=>{[c.n].concat(c.a||[]).forEach(k=>{k=''+k;if(k&&text.toLowerCase().indexOf(k.toLowerCase())>=0&&k.length>bestLen){best=c;bestLen=k.length;}});});
  if(best)return best;
  if(/日本|日籍|Japanese/i.test(text))return LIVE_LOC_CITIES.find(x=>x.n==='东京');
  if(/韩国|韩籍|Korean/i.test(text))return LIVE_LOC_CITIES.find(x=>x.n==='首尔');
  if(/美国|美籍|American|USA|United States/i.test(text))return LIVE_LOC_CITIES.find(x=>x.n==='纽约');
  if(/中国|中籍|Chinese/i.test(text))return LIVE_LOC_CITIES.find(x=>x.n==='上海');
  return LIVE_LOC_CITIES.find(x=>x.n===(fallback||''))||LIVE_LOC_CITIES.find(x=>x.n==='苏州');
}
function liveLocJitter(base,seed,range){const h=liveLocHash(seed),r=range||18;return {x:Math.max(38,Math.min(962,base.x+((h%2001)/1000-1)*r)),y:Math.max(58,Math.min(592,base.y+(((h>>8)%2001)/1000-1)*r))};}
function liveLocAddr(city,seed,kind){const pools={
  中国:['老城区附近','河边街区','地铁站旁','商场附近','安静小区门口','公司楼下','咖啡店附近'],
  日本:['车站附近','商店街转角','公寓楼下','便利店旁','写字楼附近','河岸步道'],
  韩国:['地铁口附近','住宅区楼下','咖啡店旁','汉江附近','公司附近','便利店门口'],
  美国:['downtown 附近','公寓街区','咖啡店门口','地铁站附近','办公楼下','街角停车点'],
  英国:['住处附近','地铁站旁','工作地点','街角咖啡店','公园步道','泰晤士河附近'],法国:['住处附近','地铁站旁','工作地点','街角咖啡店','河岸附近'],意大利:['住处附近','车站旁','工作地点','街角咖啡店','老城附近']
};const arr=pools[city.country]||pools['中国'],p=arr[liveLocHash(seed)%arr.length];return city.country+' · '+city.n+' · '+p+(kind?' · '+kind:'');}
function meLiveLoc(){
  /* 我这边同理：真实定位 > 我资料里的城市 > 其余文字里猜 */
  const geo=S.me&&S.me.liveLocation,fresh=geo&&Date.now()-(geo.ts||0)<6*3600000,
    text=[fresh&&geo.city,fresh&&geo.country,S.me&&S.me.city,curLoc(),S.me&&S.me.place,S.me&&S.me.persona].filter(Boolean).join(' '),
    city=(fresh&&liveLocMatch(geo.city))||liveLocMatch(S.me&&S.me.city)||liveLocCity(text,meHomeCity()||'苏州'),
    p=liveLocJitter(city,'me|'+todayStr(),7);
  return Object.assign({city:(fresh&&geo.city)||city.n,country:(fresh&&geo.country)||city.country,name:'我的位置',address:(fresh&&geo.address)||curLoc()||liveLocAddr(city,'me','当前位置'),who:'me',accurate:!!fresh},p);
}
function roleLiveLoc(c,hint){
  c=c||{};
  /* 她说「已经在个人资料里把城市改成苏州了，点开地图还定位在之前那个伦敦」。
     原来是把 city、人设、签名、职业全拼成一大段，再在整段里找【最长的那个别名】：
     人设里只要还留着旧设定的 London（6 个字母）或 United Kingdom（14 个），
     就稳稳压过 city 里的「苏州」（2 个字）。所以她改了城市地图纹丝不动。
     现在按优先级来：她这次真的分享的位置 > 资料里的城市 > 其余文字里猜。 */
  const text=[hint,c.city,charHomeCity(c),c.persona,c.signature,c.job,c.place].filter(Boolean).join(' '),
    city=liveLocMatch(hint)||liveLocMatch(c.city)||liveLocMatch(charHomeCity(c))||liveLocCity(text,charHomeCity(c)||'上海'),
    p=liveLocJitter(city,(c.id||c.name||'role')+'|'+todayStr()+'|'+(hint||''),20);
  return Object.assign({city:city.n,country:city.country,name:(hint&&String(hint).trim())||((c.remark||c.name||'TA')+'的位置'),address:liveLocAddr(city,(c.id||c.name||'role')+'|addr'),who:'role'},p);
}
function liveLocForMsg(c,m,me){
  if(m&&m.loc&&Number.isFinite(+m.loc.x)&&Number.isFinite(+m.loc.y))return Object.assign({},m.loc,{name:m.name||m.loc.name,address:m.address||m.loc.address});
  return me?meLiveLoc():roleLiveLoc(c,(m&&((m.name||'')+' '+(m.address||'')))||'');
}
function liveLocDailyKind(c){const t=[c&&c.persona,c&&c.signature,c&&c.job,c&&c.place].filter(Boolean).join(' ');if(/学生|大学|高中|学校|校园|留学/.test(t))return 'student';if(/医生|护士|医院|诊所/.test(t))return 'medical';if(/演员|艺人|明星|模特|拍摄|剧组|主播/.test(t))return 'creative';if(/咖啡|餐厅|酒吧|厨|店/.test(t))return 'service';if(/自由|作家|画家|设计|摄影/.test(t))return 'freelance';return 'office';}
function liveLocDailyLabel(kind,hour){const plan={
  student:[[7.8,'住处附近','起床出门'],[8.7,'地铁站','去学校'],[10.4,'学校教学楼','上课'],[12.3,'午餐店','午休'],[15.4,'图书馆','自习'],[18.5,'商店街','晚饭'],[21.1,'住处附近','回到住处']],
  medical:[[7.4,'住处附近','出门'],[8.2,'医院门诊楼','上班'],[11.8,'医院食堂','午餐'],[14.7,'工作地点','值班'],[18.2,'地铁站','下班'],[20.5,'住处附近','回家']],
  creative:[[9.1,'住处附近','慢慢出门'],[10.6,'工作室','准备工作'],[13.0,'咖啡店','休息'],[15.3,'拍摄地点','工作中'],[18.6,'餐厅附近','晚饭'],[21.0,'住处附近','回到住处']],
  service:[[8.8,'住处附近','出门'],[10.0,'店里','开店'],[13.4,'后厨附近','忙完午高峰'],[16.2,'咖啡店旁','短暂休息'],[19.4,'店里','晚间工作'],[22.0,'住处附近','回家']],
  freelance:[[9.6,'住处附近','开始一天'],[11.2,'咖啡店','写东西'],[13.5,'街角餐厅','吃饭'],[15.8,'工作室','处理工作'],[18.7,'公园步道','散步'],[21.3,'住处附近','回到住处']],
  office:[[7.9,'住处附近','出门'],[8.8,'地铁站','通勤'],[10.4,'工作地点','到公司'],[12.5,'午餐店','午休'],[15.6,'咖啡店附近','短暂休息'],[18.7,'地铁站','下班'],[20.8,'住处附近','回到住处']]
};const arr=plan[kind]||plan.office;let best=arr[0];for(const row of arr){if(row[0]<=hour)best=row;else break;}return {where:best[1],note:best[2]};}
function liveLocDailyTrail(c,now,need){const base=roleLiveLoc(c),kind=liveLocDailyKind(c),d=new Date(now),today=new Date(now);today.setHours(0,0,0,0);const hour=d.getHours()+d.getMinutes()/60,slots=[7.9,8.8,10.5,12.6,15.6,18.7,21.2].filter(h=>h<=Math.max(8,hour+.05)).slice(-Math.max(0,need||0));return slots.map((h,i)=>{const info=liveLocDailyLabel(kind,h),ts=today.getTime()+Math.round(h*3600000),seed=(c.id||c.name||'role')+'|daily|'+todayStr()+'|'+info.where+'|'+i,p=liveLocJitter(base,seed,kind==='freelance'?34:26),addr=liveLocAddr({country:base.country, n:base.city, x:base.x, y:base.y},seed,info.where);return Object.assign({},base,p,{id:'daily-'+Math.round(h*100),ts,time:hm(ts),label:info.where,city:base.city||'',country:base.country||'',address:addr,source:'日常生活 · '+info.note,_daily:true});});}
function liveLocTrail(c){if(!c||!c.id)return[];const now=Date.now(),d=new Date(now);d.setHours(0,0,0,0);const start=d.getTime(),seen=new Set(),real=msgs(c.id).filter(m=>m&&m.role==='assistant'&&m.type==='location'&&(m.time||0)>=start&&(m.time||0)<=now).sort((a,b)=>(a.time||0)-(b.time||0)).map(m=>{const loc=liveLocForMsg(c,m,false),key=m.id||((m.time||0)+'|'+(m.name||'')+'|'+(m.address||''));if(seen.has(key))return null;seen.add(key);const p=liveLocJitter(loc,(c.id||'role')+'|shared-trail|'+key,26),addr=m.address||loc.address||'',label=(m.name||addr.split(' · ').pop()||loc.name||'位置分享').trim();return Object.assign({},loc,p,{id:key,ts:m.time||now,time:hm(m.time||now),label,city:loc.city||'',country:loc.country||'',address:addr,source:'位置分享'});}).filter(Boolean);if(real.length>=5)return real.slice(-5);const daily=liveLocDailyTrail(c,now,5-real.length).filter(p=>!real.some(r=>Math.abs((r.ts||0)-(p.ts||0))<35*60000));return real.concat(daily).sort((a,b)=>(a.ts||0)-(b.ts||0)).slice(-5);}
function liveMapCityLabels(roleLoc,myLoc){const dist=(p,q)=>Math.hypot((p.x||0)-(q.x||0),(p.y||0)-(q.y||0)),out=[],seen=new Set(),add=p=>{if(p&&!seen.has(p.n)){seen.add(p.n);out.push(p);}};[roleLoc,myLoc].forEach(loc=>LIVE_LOC_CITIES.slice().sort((a,b)=>dist(a,loc)-dist(b,loc)).slice(0,6).forEach(add));['纽约','伦敦','巴黎','北京','上海','首尔','东京'].forEach(n=>add(LIVE_LOC_CITIES.find(x=>x.n===n)));return out.slice(0,16);}
//@@ web
function liveMapRegionSVG(){return `<svg class="lmcarto" viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="lmRoute" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6aa7d8" stop-opacity=".02"/><stop offset=".5" stop-color="#9ec8ee" stop-opacity=".22"/><stop offset="1" stop-color="#6aa7d8" stop-opacity=".02"/></linearGradient></defs><g class="lmmeridians"><path d="M0 120H1000M0 220H1000M0 320H1000M0 420H1000M0 520H1000M125 0V640M250 0V640M375 0V640M500 0V640M625 0V640M750 0V640M875 0V640"/></g><g class="lmzones"><path d="M52 244L214 214L256 332L102 392Z"/><path d="M276 210L370 202L392 330L288 366Z"/><path d="M404 226L594 226L634 404L440 470L352 348Z"/><path d="M608 246L682 252L674 374L602 378Z"/><path d="M708 224L790 252L778 408L704 372Z"/></g><g class="lmroutes"><path d="M64 360C160 315 226 282 306 246S452 234 526 328 626 306 763 322"/><path d="M306 246C340 280 398 315 512 322 570 326 610 304 634 286"/><path d="M84 286C184 282 250 262 326 276S450 318 526 328"/><path d="M462 260C506 278 580 294 654 331S716 354 763 322"/></g><g class="lmregionnames"><text x="138" y="228">NORTH AMERICA</text><text x="326" y="194">EUROPE</text><text x="492" y="218">CHINA</text><text x="637" y="238">KOREA</text><text x="748" y="218">JAPAN</text></g></svg>`;}
//@@ private
function liveMapRegionSVG(){return `<svg class="lmcarto" viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="lmRoute" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6aa7d8" stop-opacity=".02"/><stop offset=".5" stop-color="#9ec8ee" stop-opacity=".22"/><stop offset="1" stop-color="#6aa7d8" stop-opacity=".02"/></linearGradient></defs><g class="lmmeridians"><path d="M0 120H1000M0 220H1000M0 320H1000M0 420H1000M0 520H1000M125 0V640M250 0V640M375 0V640M500 0V640M625 0V640M750 0V640M875 0V640"/></g><g class="lmzones"><path d="M52 244L214 214L256 333L102 392Z"/><path d="M276 210L370 202L392 330L288 366Z"/><path d="M404 226L594 226L634 404L440 470L352 348Z"/><path d="M608 246L682 252L674 374L602 378Z"/><path d="M708 224L790 252L778 408L704 372Z"/></g><g class="lmroutes"><path d="M64 360C160 315 226 282 306 246S452 234 526 328 626 306 763 322"/><path d="M306 246C341 280 398 315 512 322 570 326 610 304 634 286"/><path d="M84 286C184 282 250 262 326 276S450 318 526 328"/><path d="M462 260C506 278 580 294 654 331S716 354 763 322"/></g><g class="lmregionnames"><text x="138" y="228">NORTH AMERICA</text><text x="326" y="194">EUROPE</text><text x="492" y="218">CHINA</text><text x="637" y="238">KOREA</text><text x="748" y="218">JAPAN</text></g></svg>`;}
//@@ end
let _liveMap=null,_liveMapGeoBusy=false;
function liveMapInit(key,focus){if(!_liveMap||_liveMap.key!==key){_liveMap={key,z:.86,x:190-(focus.x*.86),y:265-(focus.y*.86),down:false,pointers:new Map(),raf:0};}if(!_liveMap.pointers)_liveMap.pointers=new Map();return _liveMap;}
function liveMapTransform(){const s=_liveMap||{x:0,y:0,z:1};return 'translate('+s.x+'px,'+s.y+'px) scale('+s.z+')';}
function lmApply(){if(!_liveMap||_liveMap.raf)return;_liveMap.raf=requestAnimationFrame(()=>{if(!_liveMap)return;_liveMap.raf=0;const el=document.getElementById('lmLayer');if(el)el.style.transform=liveMapTransform();});}
function lmPair(){return _liveMap?[..._liveMap.pointers.values()].slice(0,2):[];}
function lmDown(e){if(!_liveMap)return;_liveMap.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});_liveMap.down=true;_liveMap.sx=e.clientX;_liveMap.sy=e.clientY;_liveMap.ox=_liveMap.x;_liveMap.oy=_liveMap.y;const ps=lmPair();if(ps.length===2){_liveMap.pinchDist=Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y)||1;_liveMap.pinchZ=_liveMap.z;_liveMap.pinchX=_liveMap.x;_liveMap.pinchY=_liveMap.y;_liveMap.pinchMid={x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2};}try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}e.currentTarget.classList.add('dragging');}
function lmMove(e){if(!_liveMap||!_liveMap.pointers.has(e.pointerId))return;_liveMap.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const ps=lmPair();if(ps.length===2){const dist=Math.hypot(ps[1].x-ps[0].x,ps[1].y-ps[0].y)||1,mid={x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2},old=_liveMap.pinchZ||_liveMap.z,nw=Math.max(.55,Math.min(2.8,old*dist/(_liveMap.pinchDist||dist))),anchor=_liveMap.pinchMid||mid;_liveMap.x=mid.x-((anchor.x-(_liveMap.pinchX||0))/old)*nw;_liveMap.y=mid.y-((anchor.y-(_liveMap.pinchY||0))/old)*nw;_liveMap.z=nw;}else if(_liveMap.down){_liveMap.x=_liveMap.ox+(e.clientX-_liveMap.sx);_liveMap.y=_liveMap.oy+(e.clientY-_liveMap.sy);}lmApply();}
function lmUp(e){if(!_liveMap)return;if(e&&e.pointerId!=null)_liveMap.pointers.delete(e.pointerId);else _liveMap.pointers.clear();if(_liveMap.pointers.size===1){const p=lmPair()[0];_liveMap.sx=p.x;_liveMap.sy=p.y;_liveMap.ox=_liveMap.x;_liveMap.oy=_liveMap.y;}else if(!_liveMap.pointers.size)_liveMap.down=false;const el=document.getElementById('livemap');if(el&&!_liveMap.pointers.size)el.classList.remove('dragging');}
function lmZoomAt(d,cx,cy){if(!_liveMap)return;const old=_liveMap.z,nw=Math.max(.55,Math.min(2.8,old+d)),x=cx==null?190:cx,y=cy==null?285:cy;_liveMap.x=x-((x-_liveMap.x)/old)*nw;_liveMap.y=y-((y-_liveMap.y)/old)*nw;_liveMap.z=nw;lmApply();}
function lmZoom(d){lmZoomAt(d,190,285);}
function lmWheel(e){e.preventDefault();const r=e.currentTarget.getBoundingClientRect();lmZoomAt(e.deltaY<0?.14:-.14,e.clientX-r.left,e.clientY-r.top);}
function lmCenter(who){if(!_liveMap)return;const el=document.querySelector('.lmmarker.'+who);if(!el)return;const x=+el.dataset.x||500,y=+el.dataset.y||320;_liveMap.x=190-x*_liveMap.z;_liveMap.y=285-y*_liveMap.z;lmApply();}
async function liveMapLocateMe(manual){if(_liveMapGeoBusy||!navigator.geolocation)return;const cached=S.me&&S.me.liveLocation;if(!manual&&cached&&Date.now()-(cached.ts||0)<5*60000)return;if(!manual&&navigator.permissions){try{const p=await navigator.permissions.query({name:'geolocation'});if(p.state!=='granted')return;}catch(_){}}_liveMapGeoBusy=true;navigator.geolocation.getCurrentPosition(async pos=>{let city='',country='',address='';try{const g=await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+pos.coords.latitude+'&longitude='+pos.coords.longitude+'&localityLanguage=zh').then(r=>r.json());city=g.city||g.locality||g.principalSubdivision||'';country=g.countryName||'';address=[country,g.principalSubdivision,city,g.locality].filter((x,i,a)=>x&&a.indexOf(x)===i).join(' · ');}catch(_){}S.me.liveLocation={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy,city:city||meHomeCity()||'当前位置',country,address:address||(city||'当前位置'),ts:Date.now()};save();_liveMapGeoBusy=false;if(cur().p==='livemap')render();if(manual)toast(city?'已定位到 '+city:'已刷新当前位置');},()=>{_liveMapGeoBusy=false;if(manual)toast('无法读取定位，请检查系统定位权限');},{enableHighAccuracy:true,timeout:10000,maximumAge:300000});}
function liveLocCardHTML(c,m,me){
  const loc=liveLocForMsg(c,m,me),nm=m.name||loc.name,addr=m.address||loc.address,mid=m.id||'',rid=c&&c.id||'';
  return `<div class="card cloc loccard" onclick="event.stopPropagation();go('livemap',{id:'${rid}',mid:'${mid}'})"><div class="locmini"><div class="locgrid"></div><i class="locroute"></i><span class="locpin">${svgIc('location',18,'#fff')}</span><span class="locpulse"></span><b>${esc(loc.city||'共享位置')}</b></div><div class="info"><div class="n">${esc(nm||'共享位置')}</div><div class="a">${esc(addr||'点击查看实时位置和今日足迹')}</div><div class="locmeta">共享位置 · 今日足迹</div></div></div>`;
}
function renderLiveMap(id,mid){
  const c=getC(id)||{},arr=msgs(id),m=arr.find(x=>x.id===mid)||{},me=m.role==='user',shared=liveLocForMsg(c,m,me),roleLoc=me?roleLiveLoc(c):shared,myLoc=me?shared:meLiveLoc(),focus=me?myLoc:roleLoc,state=liveMapInit(id+'|'+(mid||'latest'),focus),trail=liveLocTrail(c),pts=trail.map(p=>p.x+','+p.y).join(' '),labels=liveMapCityLabels(roleLoc,myLoc),addrShort=((roleLoc.address||'').split(' · ').pop()||roleLoc.address||'当前位置');setTimeout(()=>liveMapLocateMe(false),30);
  const mark=(p,cls,title)=>`<div class="lmmarker ${cls}" data-x="${p.x}" data-y="${p.y}" style="left:${p.x}px;top:${p.y}px"><span></span><b>${esc(title)}</b><small>${esc(p.address||'')}</small></div>`;
  return `<div class="nav lmnav"><span class="l" onclick="back()">‹</span><span class="t">共享位置</span><span class="r" onclick="lmCenter('role')">${svgIc('location',18,'#e8edf5')}</span></div>
  <div class="livemap${trail.length>3?' lmdense':''}" style="--lm-foot-h:${trail.length?72+trail.length*42:92}px">
    <div class="lmhead"><div><small>${esc(c.remark||c.name||'TA')} · LIVE LOCATION</small><b>${esc(roleLoc.country)} · ${esc(roleLoc.city)}</b><p>${esc(addrShort)}</p></div><button onclick="lmCenter('me')">我的位置</button></div>
    <div id="livemap" class="lmview" onpointerdown="lmDown(event)" onpointermove="lmMove(event)" onpointerup="lmUp(event)" onpointercancel="lmUp(event)" onwheel="lmWheel(event)">
      <div id="lmLayer" class="lmlayer" style="transform:${liveMapTransform()}">
        ${liveMapRegionSVG()}
        ${trail.length>1?`<svg class="lmsvg" viewBox="0 0 1000 640" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="rgba(126,183,255,.82)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7 7"/></svg>`:''}
        ${labels.map(p=>`<div class="lmcity" style="left:${p.x}px;top:${p.y}px"><i></i><span>${esc(p.n)}</span><small>${esc(p.country)}</small></div>`).join('')}
        ${trail.map((p,i)=>`<div class="lmtrail" title="${esc(p.time+' · '+p.label)}" style="left:${p.x}px;top:${p.y}px"><i>${i+1}</i><span><b>${esc(p.label)}</b><small>${esc(p.time)}</small></span></div>`).join('')}
        ${mark(myLoc,'me','我')}
        ${mark(roleLoc,'role',c.remark||c.name||'TA')}
      </div>
    </div>
    <div class="lmtools"><button onclick="lmZoom(.16)">＋</button><button onclick="lmZoom(-.16)">－</button><button onclick="lmCenter('role')">TA</button><button onclick="lmCenter('me');liveMapLocateMe(true)">我</button></div>
    <div class="lmfoot"><header><div><b>今日足迹</b><small>地图标记与记录一一对应</small></div><span>${trail.length} 条</span></header>${trail.length?trail.map((p,i)=>`<div class="lmfootrow"><i>${i+1}</i><time>${esc(p.time)}</time><span><strong>${esc(p.label)}</strong><small>${esc(p.source)} · ${esc(p.country)} ${esc(p.city)}</small></span></div>`).join(''):'<div class="lmfootempty">今天还没有角色主动共享的位置记录</div>'}</div>
  </div>`;
}
function tvSameCity(a,b){return tvStampKey(a)===tvStampKey(b)&&!!tvStampKey(a);}
function tvLegTimes(from,to,seed){const intl=tvCity(from).i||tvCity(to).i;const dh=7+(Math.abs(seed||0)%12),dm=(Math.abs(seed||0)%4)*15,dur=intl?(8+Math.abs(seed||0)%7):(1+Math.abs(seed||0)%3);let ah=dh+dur;return {dep:tvP2(dh)+':'+tvP2(dm),arr:tvP2(ah%24)+':'+tvP2(dm),nd:ah>=24};}
function tvP2(n){return ('0'+n).slice(-2);}
function tvClsT(k){return (TV_CLS.find(x=>x.k===k)||{t:'经济舱'}).t;}
function tvInit(){S.travel=S.travel||{};const t=S.travel;t.trips=t.trips||[];t.hotels=t.hotels||[];t.stamps=t.stamps||[];tvDedupeStamps(t);if(t.results===undefined)t.results=null;
  t.passport=t.passport||{name:'',gender:'女',birth:'',nation:'中国',no:''};
  t.search=t.search||{from:meHomeCity()||'苏州',to:'',cid:'',date:todayStr(),ret:'',rt:false,cls:'economy',pax:1,meet:true};
  t.hotelSearch=t.hotelSearch||{city:meHomeCity()||'苏州',checkIn:todayStr(),nights:1,stars:5,roomType:'double',guestMode:'together',cid:'',results:null};
  if(t.search.meet===undefined)t.search.meet=true;
  return t;}
function tvPrice(from,to,cls){const intl=tvCity(from).i||tvCity(to).i;const base=intl?3000:560;const span=intl?5400:1700;
  const h=(''+from+'-'+to).split('').reduce((s,ch)=>s+ch.charCodeAt(0),0);const dist=base+((h%997)/997)*span;
  const m=(TV_CLS.find(x=>x.k===cls)||{m:1}).m;return Math.round(dist*m/10)*10;}
function tvFlightNo(seed){return TV_AIR[Math.abs(seed)%TV_AIR.length]+(1000+Math.abs(seed*7)%8000);}
function tvMD(d){const m=(''+d).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);return m?(+m[2]+'月'+(+m[3])+'日'):(d||'');}
function tvDays(d){const m=(''+d).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);if(!m)return null;const t=new Date(+m[1],+m[2]-1,+m[3]);const n=new Date();n.setHours(0,0,0,0);return Math.round((t-n)/86400000);}
let _tvTab='search';
const TV_BG='linear-gradient(180deg,#0d1119,#12161f)';
function renderTravel(){if(typeof NorthTravelTaxi!=='undefined'&&NorthTravelTaxi.active())return NorthTravelTaxi.render();if(typeof NorthTravelConcert!=='undefined'&&NorthTravelConcert.active())return NorthTravelConcert.render();if(typeof NorthTravelTrain!=='undefined'&&NorthTravelTrain.active())return NorthTravelTrain.render();if(typeof NorthTravelFlight!=='undefined'&&NorthTravelFlight.active())return NorthTravelFlight.render();if(typeof NorthTravelRegions!=='undefined'&&NorthTravelGuide.active()&&NorthTravelRegions.active())return NorthTravelRegions.render();if(typeof NorthTravelGuide!=='undefined'&&NorthTravelGuide.active())return NorthTravelGuide.render();if(typeof NorthTravelHotel!=='undefined'&&NorthTravelHotel.active())return NorthTravelHotel.render();if(typeof NorthTravelHome!=='undefined'&&!NorthTravelHome.legacy())return NorthTravelHome.render();const t=tvInit();
  const up=t.trips.filter(x=>x.status==='upcoming').length;
  const tabs=[['search','搜票'],['trips','行程'],['hotels','酒店'],['passport','护照'],['memory','回忆']];
  const nav=tabs.map(x=>`<div onclick="_tvTab='${x[0]}';render()" style="flex:1;text-align:center;padding:12px 0;font-size:14px;letter-spacing:1px;color:${_tvTab===x[0]?'#e9edf5':'#6b7488'};border-bottom:2px solid ${_tvTab===x[0]?'#c9a86a':'transparent'}">${x[1]}${x[0]==='trips'&&up?'<span style="margin-left:5px;width:6px;height:6px;border-radius:50%;background:#c9a86a;display:inline-block;vertical-align:middle"></span>':''}</div>`).join('');
  let body=_tvTab==='search'?tvSearchView():_tvTab==='trips'?tvTripsView():_tvTab==='hotels'?tvHotelView():_tvTab==='passport'?tvPassportView():tvMemoryView();
  return `<div class="travel-app" style="position:absolute;inset:0;display:flex;flex-direction:column;background:${TV_BG}">
    <div class="travel-head" style="flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px"><span onclick="NorthTravelHome.home()" style="font-size:24px;color:#8a94a8;cursor:pointer">‹</span><span style="font-size:17px;letter-spacing:2px;color:#e9edf5;font-weight:600">小鱼旅行</span><span style="width:20px"></span></div>
    <div class="travel-tabs" style="flex:0 0 auto;display:flex;border-bottom:.5px solid rgba(255,255,255,.07)">${nav}</div>
    <div class="xscroll travel-scroll" data-render-scroll-key="travel:${esc(String(actId()))}:${esc(_tvTab)}" style="flex:1;overflow-y:auto">${body}</div></div>`;}
function tvSearchView(){const t=S.travel.search;const c=t.cid?getC(t.cid):null;
  const seg=(sel,opts,fn)=>`<div style="display:flex;background:#161c28;border-radius:12px;padding:3px;gap:2px">${opts.map(o=>`<div onclick="${fn}('${o[0]}')" style="flex:1;text-align:center;padding:9px 0;border-radius:9px;font-size:13px;cursor:pointer;color:${sel===o[0]?'#12161f':'#8a94a8'};background:${sel===o[0]?'#c9a86a':'transparent'}">${o[1]}</div>`).join('')}</div>`;
  const cityBox=(label,val,which)=>`<div onclick="tvPickCity('${which}')" style="flex:1;cursor:pointer;min-width:0"><div style="font-size:11px;color:#6b7488;letter-spacing:1px">${label}</div><div style="font-size:23px;color:#e9edf5;font-weight:600;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(val||'选择')}</div><div style="font-size:11px;color:#8a94a8;letter-spacing:3px">${esc(tvCity(val).c)}</div></div>`;
  const meet=t.meet!==false;
  return `<div style="padding:16px">
    ${seg(meet?'meet':'solo',[['meet','和 TA 见面'],['solo','自己去玩']],'tvSetMode')}
    <div style="height:10px"></div>
    ${seg(t.rt?'rt':'ow',[['ow','单程'],['rt','往返']],'tvTripType')}
    <div style="background:#141a24;border:.5px solid rgba(255,255,255,.06);border-radius:16px;padding:18px 16px;margin-top:14px;display:flex;align-items:center;gap:6px">
      ${cityBox('出发',t.from,'from')}
      <div onclick="tvSwap()" style="width:34px;height:34px;border-radius:50%;border:.5px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;color:#c9a86a;cursor:pointer;flex:0 0 auto;font-size:15px">⇄</div>
      ${cityBox('到达',t.to,'to')}
    </div>
    <div style="display:flex;gap:12px;margin-top:12px">
      <label style="flex:1;background:#141a24;border:.5px solid rgba(255,255,255,.06);border-radius:12px;padding:11px 14px;display:block"><div style="font-size:11px;color:#6b7488">出发日期</div><input type="date" value="${t.date}" onchange="tvSet('date',this.value)" style="background:transparent;border:none;color:#e9edf5;font-size:15px;margin-top:3px;width:100%;color-scheme:dark"></label>
      ${t.rt?`<label style="flex:1;background:#141a24;border:.5px solid rgba(255,255,255,.06);border-radius:12px;padding:11px 14px;display:block"><div style="font-size:11px;color:#6b7488">返程日期</div><input type="date" value="${t.ret||''}" onchange="tvSet('ret',this.value)" style="background:transparent;border:none;color:#e9edf5;font-size:15px;margin-top:3px;width:100%;color-scheme:dark"></label>`:''}
    </div>
    <div style="font-size:11px;color:#6b7488;letter-spacing:1px;margin:16px 0 8px">舱位</div>
    ${seg(t.cls,[['first','头等舱'],['business','商务舱'],['economy','经济舱']],'tvSetCls')}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;background:#141a24;border:.5px solid rgba(255,255,255,.06);border-radius:12px;padding:11px 16px">
      <span style="font-size:14px;color:#c3cad8">乘客人数</span>
      <div style="display:flex;align-items:center;gap:18px"><span onclick="tvPax(-1)" style="width:30px;height:30px;border-radius:50%;border:.5px solid rgba(255,255,255,.16);display:inline-flex;align-items:center;justify-content:center;color:#c9a86a;cursor:pointer">−</span><span style="color:#e9edf5;font-size:16px;min-width:20px;text-align:center">${t.pax}</span><span onclick="tvPax(1)" style="width:30px;height:30px;border-radius:50%;border:.5px solid rgba(255,255,255,.16);display:inline-flex;align-items:center;justify-content:center;color:#c9a86a;cursor:pointer">＋</span></div>
    </div>
    <div onclick="tvPickChar()" style="margin-top:12px;background:#141a24;border:.5px solid rgba(255,255,255,.06);border-radius:12px;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer">
      <span style="font-size:14px;color:#c3cad8">${meet?'去见谁':'谁给你买单（选填）'}</span><span style="font-size:14px;color:${c?'#e9edf5':'#6b7488'}">${c?esc(c.remark||c.name):(meet?'选择角色':'不选·自己付')} ›</span></div>
    <div onclick="tvSearchDo()" style="margin-top:22px;text-align:center;padding:15px;border-radius:14px;background:linear-gradient(135deg,#c9a86a,#b1904f);color:#12161f;font-size:16px;font-weight:700;letter-spacing:3px;cursor:pointer">查询航班</div>
    ${S.travel.results?tvResultsHTML():''}
  </div>`;}
function tvResultsHTML(){const t=S.travel.search;const rf=S.travel.resFor||{};const price=tvPrice(rf.from,rf.to,t.cls);
  return '<div style="margin-top:24px"><div style="font-size:11px;color:#6b7488;letter-spacing:1px;margin-bottom:10px">'+esc(rf.from)+' — '+esc(rf.to)+' · '+tvMD(rf.date)+' · '+tvClsT(t.cls)+'</div>'+
   S.travel.results.map((f,i)=>`<div onclick="tvBuySheet(${i})" style="background:#141a24;border:.5px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 16px;margin-bottom:10px;cursor:pointer">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="text-align:center"><div style="font-size:21px;color:#e9edf5;font-weight:600">${f.dep}</div><div style="font-size:11px;color:#8a94a8;letter-spacing:2px">${esc(tvCity(rf.from).c)}</div></div>
        <div style="flex:1;text-align:center;padding:0 12px"><div style="font-size:10px;color:#6b7488">${f.dur}小时</div><div style="height:.5px;background:rgba(255,255,255,.14);margin:6px 0"></div><div style="font-size:10px;color:#6b7488;letter-spacing:1px">${esc(f.no)} · 直飞</div></div>
        <div style="text-align:center"><div style="font-size:21px;color:#e9edf5;font-weight:600">${f.arr}${f.nd?'<span style="font-size:10px;color:#8a94a8;vertical-align:super">+1</span>':''}</div><div style="font-size:11px;color:#8a94a8;letter-spacing:2px">${esc(tvCity(rf.to).c)}</div></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:11px;border-top:.5px solid rgba(255,255,255,.06)">
        <span style="font-size:12px;color:#8a94a8">${tvClsT(t.cls)} · ${t.pax}人</span><span style="font-size:19px;color:#c9a86a;font-weight:700">¥${northLocaleNumber(price*t.pax)}</span></div></div>`).join('')+'</div>';}
function tvSet(k,v){tvInit().search[k]=v;save();}
function tvTripType(k){tvInit().search.rt=(k==='rt');save();render();}
function tvSetMode(m){tvInit().search.meet=(m==='meet');save();render();}
function tvSetCls(k){tvInit().search.cls=k;save();render();}
function tvPax(d){const s=tvInit().search;s.pax=Math.max(1,Math.min(9,(s.pax||1)+d));save();render();}
function tvSwap(){const s=tvInit().search;const a=s.from;s.from=s.to;s.to=a;save();render();}
function tvCityPickerHTML(which,q){q=String(q||'').trim().toLowerCase();const list=q?TV_CITIES.filter(c=>tvCitySearchText(c).indexOf(q)>=0):TV_CITIES;const current=tvInit().search[which];if(!list.length)return '<div style="padding:28px 8px;text-align:center;color:#6b7488;font-size:13px">没有找到这个城市或机场代码</div>';return TV_CITY_GROUPS.map(group=>{const rows=list.filter(c=>c.g===group);if(!rows.length)return '';return `<div style="font-size:11px;color:#778298;letter-spacing:2px;margin:16px 2px 7px">${group}</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${rows.map(c=>`<button onclick="tvChooseCity('${which}','${c.n}')" style="min-width:0;text-align:left;padding:11px 12px;border-radius:12px;background:${current===c.n?'linear-gradient(135deg,rgba(201,168,106,.22),rgba(201,168,106,.08))':'#161c28'};border:.5px solid ${current===c.n?'rgba(201,168,106,.55)':'rgba(255,255,255,.08)'};color:#e7ebf3;cursor:pointer"><span style="display:flex;align-items:baseline;justify-content:space-between;gap:6px"><b style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.n)}</b><em style="font-size:10px;color:#c9a86a;font-style:normal;letter-spacing:1px">${esc(c.c)}</em></span>${c.r?`<small style="display:block;margin-top:3px;color:#737e91;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.r)}</small>`:''}</button>`).join('')}</div>`;}).join('');}
function tvFilterCities(which){const input=document.getElementById('tvCitySearch'),box=document.getElementById('tvCityResults');if(box)box.innerHTML=tvCityPickerHTML(which,input&&input.value||'');}
function tvPickCity(which){openModal(`<h3>选择城市</h3><div style="position:relative;margin:10px 0 4px"><input id="tvCitySearch" type="search" autocomplete="off" placeholder="搜索城市、地区或机场代码" oninput="tvFilterCities('${which}')" style="box-sizing:border-box;width:100%;height:44px;border-radius:12px;border:.5px solid rgba(255,255,255,.1);background:#121722;color:#e8edf5;padding:0 14px;font-size:14px;outline:none"></div><div id="tvCityResults" style="max-height:min(58vh,520px);overflow-y:auto;padding:0 2px 4px;overscroll-behavior:contain">${tvCityPickerHTML(which,'')}</div><button class="btn g" style="margin-top:12px" onclick="closeModal()">关闭</button>`);setTimeout(()=>{const input=document.getElementById('tvCitySearch');if(input)input.focus({preventScroll:true});},60);}
function tvChooseCity(which,n){tvInit().search[which]=n;save();closeModal();render();}
function tvPickChar(){const cs=S.contacts.filter(c=>!c.deleted);if(!cs.length){toast('先在微信里建一个角色');return;}
  openModal(`<h3>去见谁</h3>${cs.map(c=>`<div class="section"><div class="it" onclick="tvChooseChar('${c.id}')">${av(c.avatar,'sm')}<div class="meta" style="flex:1"><div class="n">${esc(c.remark||c.name)}</div></div><span class="v">›</span></div></div>`).join('')}<button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function tvChooseChar(cid){tvInit().search.cid=cid;save();closeModal();render();}
function tvSearchDo(){const t=tvInit().search;if(!t.from||!t.to){toast('选一下出发和到达城市');return;}if(t.from===t.to){toast('出发和到达不能是同一个城市');return;}if(t.meet!==false&&(!t.cid||!getC(t.cid))){toast('选一下去见谁');return;}if(!t.date){toast('选一下出发日期');return;}
  const intl=tvCity(t.from).i||tvCity(t.to).i;const seed=(''+t.from+t.to+t.date).split('').reduce((s,ch)=>s+ch.charCodeAt(0),0);const res=[];
  for(let i=0;i<5;i++){const dh=6+((seed+i*5)%15);const dm=((seed+i*13)%4)*15;const dur=intl?(8+(seed+i)%7):(1+(seed+i)%3);let ah=dh+dur;const nd=ah>=24;ah=ah%24;
    res.push({no:tvFlightNo(seed+i*29),dep:tvP2(dh)+':'+tvP2(dm),arr:tvP2(ah)+':'+tvP2(dm),dur,nd});}
  const tt=S.travel;tt.results=res;tt.resFor={from:t.from,to:t.to,date:t.date};save();render();
  setTimeout(()=>{const b=document.querySelector('.xscroll');if(b)b.scrollTop=b.scrollHeight;},60);}
function tvBuySheet(i){const t=S.travel.search;const rf=S.travel.resFor;const f=S.travel.results&&S.travel.results[i];if(!f){return;}
  const meet=t.meet!==false;const c=t.cid?getC(t.cid):null;const nm=c?(c.remark||c.name):'';
  const total=tvPrice(rf.from,rf.to,t.cls)*t.pax;
  let btns;
  if(meet){
    if(!c){toast('先选去见谁');return;}
    btns=`<button class="btn p" style="margin-bottom:8px;background:linear-gradient(135deg,#c9a86a,#b1904f);color:#12161f" onclick="tvBook(${i},'self')">给自己买（你飞去见ta）</button>
   <button class="btn g" style="margin-bottom:8px" onclick="tvBook(${i},'forTa')">给${esc(nm)}买（请ta飞去见面地）</button>
   <button class="btn g" style="margin-bottom:8px" onclick="tvBook(${i},'taPay')">让${esc(nm)}代付（你飞去·ta出钱）</button>`;
  }else{
    btns=`<button class="btn p" style="margin-bottom:8px;background:linear-gradient(135deg,#c9a86a,#b1904f);color:#12161f" onclick="tvBook(${i},'selfSolo')">自己买（一个人去玩）</button>`
     +(c?`<button class="btn g" style="margin-bottom:8px" onclick="tvBook(${i},'taPaySolo')">让${esc(nm)}请客（ta出钱·你自己去）</button>`:'');
  }
  openModal(`<h3>确认预订</h3>
   <div style="background:#141a24;border-radius:12px;padding:14px;margin-bottom:12px;color:#dfe4ee;font-size:14px;line-height:2">
     <div style="display:flex;justify-content:space-between"><span style="color:#8a94a8">航班</span><span>${esc(f.no)} · ${tvClsT(t.cls)}</span></div>
     <div style="display:flex;justify-content:space-between"><span style="color:#8a94a8">行程</span><span>${esc(rf.from)} → ${esc(rf.to)}</span></div>
     <div style="display:flex;justify-content:space-between"><span style="color:#8a94a8">日期</span><span>${tvMD(rf.date)} ${f.dep}</span></div>
     <div style="display:flex;justify-content:space-between"><span style="color:#8a94a8">${meet?'见':'方式'}</span><span>${meet?(esc(nm)+' · 见面'):'自己去旅行'} · ${t.pax}人</span></div>
     <div style="display:flex;justify-content:space-between"><span style="color:#8a94a8">金额</span><span style="color:#c9a86a;font-weight:700">¥${northLocaleNumber(total)}</span></div>
   </div>${btns}
   <button class="btn g" onclick="closeModal()">取消</button>`);}
function tvBook(i,mode){const t=S.travel.search;const rf=S.travel.resFor;const f=S.travel.results&&S.travel.results[i];if(!f){closeModal();return;}
  const meet=(mode==='self'||mode==='forTa'||mode==='taPay');
  const c=t.cid?getC(t.cid):null;const nm=c?(c.remark||c.name):'';
  const total=tvPrice(rf.from,rf.to,t.cls)*t.pax;
  let flier='me',payer='me';
  if(mode==='self'||mode==='selfSolo'){flier='me';payer='me';}
  else if(mode==='taPay'||mode==='taPaySolo'){flier='me';payer='ta';}
  else if(mode==='forTa'){flier='ta';payer='me';}
  if(payer==='ta'&&!c){toast('先选一个角色来付钱');return;}
  if(payer==='me'){if(total>S.me.balance){toast('余额不够啦（去钱包改）');return;}addBill('out',total,(mode==='forTa'?'给'+nm+'买':'')+rf.from+'→'+rf.to+'机票');}
  else if(c&&c.wallet!=null){c.wallet=Math.max(0,(+c.wallet)-total);}
  const trip={id:uid(),cid:c?t.cid:'',from:rf.from,to:rf.to,date:t.date,ret:t.rt?t.ret:'',cls:t.cls,pax:t.pax,by:'me',meet,flier,payer,no:f.no,dep:f.dep,arr:f.arr,price:total,status:'upcoming',ts:Date.now()};
  if(!meet&&payer==='me')trip._hiddenFromChar=true;
  S.travel.trips.push(trip);S.travel.results=null;save();if(c&&(meet||payer==='ta'))tvSendCard(trip);
  closeModal();_tvTab='trips';render();toast('预订成功');}
function tvTicketCardHTML(trip,c){if(trip&&trip.taxiV2&&typeof NorthTravelTaxi!=='undefined')return NorthTravelTaxi.card(trip);if(trip.concertV2&&typeof NorthConcertBooking!=='undefined')return NorthConcertBooking.card(trip);if(trip.railV2&&typeof NorthTrainBooking!=='undefined')return NorthTrainBooking.card(trip);if(trip.flightV2&&typeof NorthFlightBooking!=='undefined')return NorthFlightBooking.card(trip);const nm=c?c.name:'对方';const flierName=trip.flier==='me'?((S.travel&&S.travel.passport&&S.travel.passport.name)||S.me.name):nm;
  return `<div style="width:260px;background:linear-gradient(135deg,#1b2333,#232d40);border-radius:14px;overflow:hidden;border:.5px solid rgba(201,168,106,.35)">
   <div style="padding:11px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed rgba(255,255,255,.14)"><span style="color:#c9a86a;font-size:12px;letter-spacing:2px">BOARDING PASS · 登机牌</span><span style="color:#7c869a;font-size:11px">${esc(trip.no)}</span></div>
   <div style="padding:9px 14px 0;color:#aeb8ca;font-size:12px;line-height:1.45">${esc(trip.from||'未填出发地')} → ${esc(trip.to||'未填目的地')}</div>
   <div style="padding:13px 14px;display:flex;align-items:center;justify-content:space-between">
     <div><div style="color:#e9edf5;font-size:22px;font-weight:700">${esc(tvCity(trip.from).c)}</div><div style="color:#8a94a8;font-size:11px">${esc(trip.from)}</div></div>
     <div style="color:#c9a86a;font-size:12px">———›</div>
     <div style="text-align:right"><div style="color:#e9edf5;font-size:22px;font-weight:700">${esc(tvCity(trip.to).c)}</div><div style="color:#8a94a8;font-size:11px">${esc(trip.to)}</div></div>
   </div>
   <div style="padding:0 14px 12px;display:flex;justify-content:space-between;color:#b7bfce;font-size:11px;gap:8px"><span>${tvMD(trip.date)} ${esc(trip.dep||'')}</span><span style="text-align:right">${tvClsT(trip.cls)} · ${esc(flierName)}登机</span></div></div>`;}
function tvHotelOwned(h){const account=typeof actId==='function'?String(actId()):String(S.me.active||'main');return !!h&&(h.accountId!=null?String(h.accountId)===account:account==='main');}
function tvHotelCurrent(h){if(!h||!tvHotelOwned(h))return {};const live=(S.travel&&S.travel.hotels||[]).find(x=>x.id===h.id&&tvHotelOwned(x));return live&&(typeof NorthTravelOrders==='undefined'||NorthTravelOrders.visible(live,'hotel'))?live:Object.assign({},h,{status:'deleted',hotelName:''});}
function tvHotelSummary(h){h=tvHotelCurrent(h);if(!h.hotelName)return '酒店订单不属于当前账号';return h.city+'「'+h.hotelName+'」，'+h.checkIn+(h.category==='hourly'?' · '+h.hours+'小时':' → '+tvHotelCheckout(h)+' · '+h.nights+'晚')+'，'+(+h.rooms||1)+'间'+tvHotelRoomText(h.roomType)+(h.adults?' · '+h.adults+'成人':'')+(h.children?' · '+h.children+'儿童':'')+'，入住人'+tvHotelGuestText(h)+'，由'+tvHotelBookerText(h)+'预订，付款方'+(h.paymentRequested?NorthTravelPayment.label(h):h.payer==='ta'?tvHotelBookerText(Object.assign({},h,{bookedBy:'ta'})):'用户模拟钱包')+'，总额¥'+(+h.price||0).toFixed(2)+'，'+tvHotelStatusText(h.status);}
function tvHotelRoleMoney(c){const d=S.spy&&S.spy[c.id];if(c.wallet!=null)return {balance:Number(c.wallet),rawBalance:c.wallet,source:'roleWallet',data:d};if(d)return {balance:d.balance!=null?Number(d.balance):(d.wallet||[]).reduce((n,w)=>n+(+w.amount||0),0),rawBalance:d.balance!=null?d.balance:(d.wallet||[]).reduce((n,w)=>n+(+w.amount||0),0),source:'roleBank',data:d};return null;}
function tvHotelRoleMoneyApply(c,source,delta,h){const d=S.spy&&S.spy[c.id],m=tvHotelRoleMoney(c);if(source==='roleWallet'){const next=NorthHotelData.moneyNext(c.wallet,Math.round(delta*100));if(next===null)return false;c.wallet=next;}else{if(!d)return false;const balance=d.balance!=null?Number(d.balance):(d.wallet||[]).reduce((n,w)=>n+(+w.amount||0),0);const next=NorthHotelData.moneyNext(d.balance!=null?d.balance:balance,Math.round(delta*100));if(next===null)return false;d.balance=next;}if(d){d.wallet=d.wallet||[];d.wallet.unshift({item:(delta<0?'酒店预订：':'酒店退款：')+h.hotelName,amount:delta,when:h.checkIn,hotelId:h.id});d.wallet=d.wallet.slice(0,40);}return true;}
function tvHotelRoleQueryPrompt(c){const s=S.travel&&S.travel.hotelSearch;if(!s||!s.city)return '';return '\n当前用户酒店查询条件（只是查询，不等于预订）：'+JSON.stringify({city:s.city,checkIn:s.checkIn,nights:s.nights,stars:s.stars,roomType:s.roomType,rooms:s.rooms||1,adults:s.adults||1,children:s.children||0,guestMode:s.guestMode,cid:s.cid,keyword:s.keyword||'',maxPrice:s.maxPrice||0,preferences:s.preferredTags||[]})+'。决定照此代订时必须保持日期、酒店名称、人数及价格限制；缺少偏好时可自主安排，用户本轮新要求优先于这些旧查询；余额不足不得宣称订好了。';}
function tvHotelConsumeBookingTags(content,c,onResult){let failed=false;const text=String(content||'').replace(/[\[【]\s*订酒店\s*[|｜:：]([^\]】]{1,240})[\]】]/g,(tag,raw)=>{const p=raw.split(/[|｜]/).map(x=>x.trim());const ok=p.length>=1&&p.length<=10&&tvCharHotelBook(c,p[0],p[1],p[2],p[3],p[4],p[5],p[6],p[7],p[8],p[9]);if(!ok)failed=true;if(onResult)onResult(!!ok);return '';});return failed?'':text;}
function tvHotelRoomText(k){return k==='single'?'高级单人间':'高级双人间';}
function tvHotelStatusText(k){return k==='deleted'?'记录已删除':k==='cancelled'?'已取消':k==='done'?'已完成':'预订成功';}
function tvHotelBookerText(h){const c=h&&h.cid&&getC(h.cid);return h&&h.bookedBy==='ta'?(c?(c.remark||c.name):'角色'):S.me.name;}
function tvHotelGuestText(h){const c=h&&h.cid&&getC(h.cid),nm=c?(c.remark||c.name):'角色';if(h&&h.guestMode==='role')return nm;if(h&&h.guestMode==='together')return S.me.name+'、'+nm;return S.me.name;}
function tvHotelVisibleToRole(h,cid){return !!(h&&tvHotelOwned(h)&&(typeof NorthTravelOrders==='undefined'||NorthTravelOrders.visible(h,'hotel'))&&cid&&(h.paymentRequested&&h.fundingRoleId===cid||h.cid===cid&&(h.guestMode==='role'||h.guestMode==='together'||h.bookedBy==='ta')));}
function tvHotelCheckout(h){const d=new Date((h&&h.checkIn||todayStr())+'T12:00:00');d.setDate(d.getDate()+Math.max(1,+h.nights||1));return d.getFullYear()+'-'+tvP2(d.getMonth()+1)+'-'+tvP2(d.getDate());}
function tvHotelNo(seed){return 'YH'+String(Math.abs(seed||Date.now())).slice(-8);}
function tvHotelPrice(city,stars,room,nights){const seed=String(city||'').split('').reduce((n,x)=>n+x.charCodeAt(0),0),base=160+(+stars||3)*170+(room==='double'?180:0)+(seed%180);return Math.round(base*Math.max(1,+nights||1)/10)*10;}
function tvHotelNames(city,stars){const lead=String(city||'云程').slice(0,2),tail=(+stars||5)>=5?['云庭臻选酒店','曜石行政酒店','澄境云端酒店']:(+stars===4?['云栖精选酒店','澜庭酒店','星港酒店']:['云程轻居酒店','泊岸酒店','晴川旅店']);return tail.map((x,i)=>lead+x+(i?' · '+['中心店','江景店','静安店'][i]:''));}
function tvHotelSet(k,v){const s=tvInit().hotelSearch;if(['nights','stars'].includes(k))v=Math.max(1,+v||1);s[k]=v;s.results=null;delete s.hotelQuotes;save();render();}
function tvHotelPickCity(){openModal(`<h3>酒店城市</h3><div class="field"><label>城市</label><input id="tv_hotel_city" value="${esc(tvInit().hotelSearch.city||'')}" placeholder="例如 上海"></div><div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="tvHotelChooseCity()">确定</button></div>`);}
function tvHotelChooseCity(){const v=String($('#tv_hotel_city')&&$('#tv_hotel_city').value||'').trim();if(!v){toast('填写入住城市');return;}tvInit().hotelSearch.city=v;tvInit().hotelSearch.results=null;save();closeModal();render();}
function tvHotelPickRole(){const cs=S.contacts.filter(c=>!c.deleted);if(!cs.length){toast('先在微信里建一个角色');return;}openModal(`<h3>选择入住角色</h3>${cs.map(c=>`<div class="section"><div class="it" onclick="tvHotelChooseRole('${c.id}')">${av(c.avatar,'sm')}<div class="meta" style="flex:1"><div class="n">${esc(c.remark||c.name)}</div></div><span class="v">›</span></div></div>`).join('')}<button class="btn g" onclick="closeModal()">关闭</button>`);}
function tvHotelChooseRole(cid){tvInit().hotelSearch.cid=cid;tvInit().hotelSearch.results=null;save();closeModal();render();}
function tvHotelSearch(){const s=tvInit().hotelSearch;if(!s.city){toast('先填写城市');return;}if(!s.checkIn){toast('先选入住日期');return;}if(s.guestMode!=='me'&&(!s.cid||!getC(s.cid))){toast('先选择同行或入住角色');return;}delete s.hotelQuotes;s.results=tvHotelNames(s.city,s.stars);save();render();setTimeout(()=>{const e=document.getElementById('tvHotelResults');if(e)e.scrollIntoView({behavior:'smooth',block:'start'});},50);}
function tvHotelView(){const t=tvInit(),s=t.hotelSearch,c=s.cid&&getC(s.cid),names=s.results||[];
  const select=(label,k,opts)=>`<label style="flex:1;min-width:0;background:#141a24;border:.5px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 12px"><small style="display:block;color:#707b8f;font-size:10px;margin-bottom:4px">${label}</small><select onchange="tvHotelSet('${k}',this.value)" style="width:100%;background:transparent;color:#e9edf5;border:0;font-size:13px;outline:none">${opts.map(o=>`<option value="${o[0]}" ${String(s[k])===String(o[0])?'selected':''} style="background:#141a24">${o[1]}</option>`).join('')}</select></label>`;
  const orders=t.hotels.filter(h=>tvHotelOwned(h)&&(typeof NorthTravelOrders==='undefined'||NorthTravelOrders.visible(h,'hotel'))).slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
  return `<div style="padding:16px"><div style="font-size:11px;color:#c9a86a;letter-spacing:2px;margin-bottom:10px">YUNCHENG STAY · 酒店预订</div>
   <div onclick="tvHotelPickCity()" style="background:#141a24;border:.5px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 15px;cursor:pointer"><small style="display:block;color:#707b8f;font-size:10px">入住城市</small><b style="display:block;color:#edf1f7;font-size:21px;margin-top:3px">${esc(s.city||'选择城市')}</b></div>
   <div style="display:flex;gap:9px;margin-top:9px"><label style="flex:1;background:#141a24;border:.5px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 12px"><small style="display:block;color:#707b8f;font-size:10px">入住日期</small><input type="date" value="${esc(s.checkIn||'')}" onchange="tvHotelSet('checkIn',this.value)" style="width:100%;margin-top:4px;background:transparent;border:0;color:#edf1f7;color-scheme:dark;font-size:13px"></label>${select('入住晚数','nights',[[1,'1 晚'],[2,'2 晚'],[3,'3 晚'],[5,'5 晚'],[7,'7 晚']])}</div>
   <div style="display:flex;gap:9px;margin-top:9px">${select('酒店星级','stars',[[3,'三星'],[4,'四星'],[5,'五星']])}${select('房型','roomType',[['single','单人间'],['double','双人间']])}</div>
   <div style="display:flex;gap:9px;margin-top:9px">${select('入住方式','guestMode',[['me','我自己'],['role','给角色入住'],['together','我们一起']])}<div onclick="tvHotelPickRole()" style="flex:1;min-width:0;background:#141a24;border:.5px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 12px;cursor:pointer"><small style="display:block;color:#707b8f;font-size:10px;margin-bottom:5px">角色</small><span style="display:block;color:${c?'#edf1f7':'#707b8f'};font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c?esc(c.remark||c.name):'选择角色'} ›</span></div></div>
   <div onclick="tvHotelSearch()" style="margin-top:15px;text-align:center;padding:13px;border-radius:13px;background:linear-gradient(135deg,#c9a86a,#b1904f);color:#12161f;font-size:15px;font-weight:700;letter-spacing:2px;cursor:pointer">查询酒店</div>
   ${names.length?`<div id="tvHotelResults" style="margin-top:22px"><div style="font-size:11px;color:#707b8f;letter-spacing:1px;margin-bottom:9px">${esc(s.city)} · ${s.stars}星 · ${tvMD(s.checkIn)}入住</div>${names.map((name,i)=>{const price=typeof NorthTravelHotel!=='undefined'?NorthTravelHotel.quote(s,i,tvHotelPrice(s.city,s.stars,s.roomType,s.nights)+i*120):tvHotelPrice(s.city,s.stars,s.roomType,s.nights)+i*120;return `<div onclick="tvHotelBook(${i})" style="background:#141a24;border:.5px solid rgba(255,255,255,.07);border-radius:14px;padding:13px 15px;margin-bottom:9px;cursor:pointer"><div style="display:flex;justify-content:space-between;gap:10px"><div style="min-width:0"><div style="color:#d9bd7c;font-size:10px;letter-spacing:1px">${'★'.repeat(+s.stars||5)}</div><b style="display:block;color:#edf1f7;font-size:15px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</b><small style="display:block;color:#788397;margin-top:4px">${tvHotelRoomText(s.roomType)} · ${s.nights}晚</small></div><strong style="color:#d9bd7c;font-size:17px;white-space:nowrap">¥${northLocaleNumber(price)}</strong></div></div>`;}).join('')}</div>`:''}
   <div style="font-size:11px;color:#707b8f;letter-spacing:1px;margin:25px 2px 9px">我的酒店订单 · ${orders.length}</div>${orders.length?orders.map(tvHotelOrderHTML).join(''):'<div style="color:#667185;text-align:center;padding:22px 8px;font-size:13px">还没有酒店订单</div>'}</div>`;}
function tvHotelOrderHTML(h){const faded=h.status!=='upcoming',state=tvHotelStatusText(h.status);return `<div onclick="tvHotelDetail('${h.id}')" style="background:#141a24;border:.5px solid rgba(255,255,255,.07);border-radius:14px;padding:13px 15px;margin-bottom:10px;cursor:pointer;${faded?'opacity:.68':''}"><div style="display:flex;justify-content:space-between;gap:10px"><b style="color:#edf1f7;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.hotelName)}</b><span style="color:${h.status==='upcoming'?'#7ebd94':'#7c869a'};font-size:11px;white-space:nowrap">${state}</span></div><div style="color:#8490a3;font-size:11px;margin-top:5px">${tvMD(h.checkIn)} → ${tvMD(tvHotelCheckout(h))} · ${tvHotelRoomText(h.roomType)} · ${esc(tvHotelGuestText(h))}</div></div>`;}
function tvHotelBook(i,payment){const s=tvInit().hotelSearch,names=s.results||[],hotelName=names[i];if(!hotelName)return;if(typeof NorthTravelHotel!=='undefined'&&!NorthTravelHotel.allowBooking(s,i))return;const c=s.cid&&getC(s.cid);if(s.guestMode!=='me'&&!c){toast('先选择角色');return;}const price=typeof NorthTravelHotel!=='undefined'?NorthTravelHotel.quote(s,i,tvHotelPrice(s.city,s.stars,s.roomType,s.nights)+i*120):tvHotelPrice(s.city,s.stars,s.roomType,s.nights)+i*120;if(!payment&&price>S.me.balance){toast('余额不够啦（去钱包改）');return;}const h={id:uid(),cid:c?c.id:'',city:s.city,hotelName,stars:+s.stars||5,roomType:s.roomType,checkIn:s.checkIn,nights:+s.nights||1,guestMode:s.guestMode,bookedBy:'me',payer:'me',price,status:'upcoming',benefits:(+s.stars||5)>=5?'双早 · 延迟退房':'含早餐',no:tvHotelNo(Date.now()+i),ts:Date.now()};if(typeof NorthTravelHotel!=='undefined')Object.assign(h,NorthTravelHotel.bookingFields(s,i));if(payment){if(!NorthTravelPayment.charge(payment,Math.round(price*100),'酒店：'+hotelName,h))return false;}else addBill('out',price,'酒店：'+hotelName);tvInit().hotels.push(h);s.results=null;delete s.hotelQuotes;save();if(c&&s.guestMode!=='me')tvHotelSendCard(h);render();toast('酒店预订成功');return h;}
function tvHotelSendCard(h){const c=h&&h.cid&&getC(h.cid);if(!c)return;pushMsg(c.id,{role:'user',type:'hotel',hotel:h,id:uid(),time:Date.now()});if(!c.blocked)scheduleReply(c.id,'[系统：'+S.me.name+'刚在云程订好了「'+h.hotelName+'」，'+tvMD(h.checkIn)+'入住'+h.nights+'晚，'+tvHotelRoomText(h.roomType)+'，入住人是'+tvHotelGuestText(h)+'，订单已支付。你是这张订单的入住参与人，刚收到酒店确认卡，所以现在确实知道这件事。请按人设自然回应，不要说没看见卡片。]');}
function tvHotelCardHTML(h){h=tvHotelCurrent(h);if(!h.hotelName)return '<div class="cth-chat-hotel cth-chat-unavailable">酒店订单已不可用</div>';return `<div class="cth-chat-hotel" role="button" tabindex="0" data-hotel-id="${esc(h.id)}" onclick="event.stopPropagation();tvHotelDetail(this.dataset.hotelId)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();tvHotelDetail(this.dataset.hotelId)}" style="width:260px;max-width:100%"><div class="cth-chat-brand"><span>小鱼旅行 · 酒店订单</span><small>模拟预订</small></div><div class="cth-chat-body"><div class="cth-chat-status ${h.status==='cancelled'?'cancelled':''}">${esc(tvHotelStatusText(h.status))}</div><b class="cth-chat-name">${esc(h.hotelName)}</b><p>${esc(h.checkIn)}${h.category==='hourly'?' · '+(+h.hours||4)+'小时':' → '+esc(tvHotelCheckout(h))+' · '+(+h.nights||1)+'晚'}</p><p>${+h.rooms||1}间 · ${esc(tvHotelRoomText(h.roomType))}${h.adults?' · '+(+h.adults||1)+'成人':''}${h.children?' · '+(+h.children||0)+'儿童':''}</p><p>入住人 · ${esc(tvHotelGuestText(h))}</p><div class="cth-chat-total"><span>${esc(NorthHotelData.payerLabel(h))}</span><strong>¥${(+h.price||0).toFixed(2)}</strong></div></div><div class="cth-chat-footer"><span>${esc(h.city||'')} · ${esc(h.no||'')}</span><b>查看详情 ›</b></div></div>`;}
function tvHotelDetail(id){if(typeof NorthTravelHotel!=='undefined'&&NorthTravelHotel.detail)return NorthTravelHotel.detail(id);const h=(tvInit().hotels||[]).find(x=>x.id===id);if(!h){toast('这条酒店订单不存在');return;}const c=h.cid&&getC(h.cid),rows=[['酒店',h.hotelName],['城市',h.city],['星级','★'.repeat(+h.stars||5)],['入住',h.category==='hourly'?tvMD(h.checkIn)+' · '+h.hours+'小时':tvMD(h.checkIn)+' → '+tvMD(tvHotelCheckout(h))+'（'+h.nights+'晚）'],['房型',tvHotelRoomText(h.roomType)+(h.rooms?' · '+h.rooms+'间':'')],['入住人',tvHotelGuestText(h)],['预订人',tvHotelBookerText(h)],['礼遇',h.benefits||'—'],['订单号',h.no||'—'],['订单金额','¥'+northLocaleNumber(+h.price||0)],['状态',tvHotelStatusText(h.status)]];openModal(`<h3>酒店订单详情</h3><div style="background:#141a24;border-radius:13px;padding:5px 14px;margin-bottom:12px">${rows.map(x=>`<div style="display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:.5px solid rgba(255,255,255,.06);font-size:13px"><span style="color:#758095">${x[0]}</span><b style="color:#e5eaf2;text-align:right;font-weight:500">${esc(x[1])}</b></div>`).join('')}</div>${h.status==='upcoming'?`<button class="btn g" style="margin-bottom:8px;color:#d38d95" onclick="tvHotelCancel('${h.id}')">取消订单</button>`:`<button class="btn g" style="margin-bottom:8px" onclick="tvHotelDelete('${h.id}')">删除记录</button>`}<button class="btn p" onclick="closeModal()">完成</button>`);}
async function tvHotelCancel(id,options){const h=(tvInit().hotels||[]).find(x=>x.id===id),account=actId();if(!h||NorthHotelData.roleOrder(h)||(typeof NorthTravelOrders!=='undefined'&&!NorthTravelOrders.visible(h,'hotel'))||h.status!=='upcoming'||h.accountId&&h.accountId!==account)return;if(!(options&&options.direct===true)&&!await uiConfirm('取消这笔酒店订单？\n¥'+northLocaleNumber(+h.price||0)+' 将原路退回。'))return;if(h.status!=='upcoming'||actId()!==account||h.accountId&&h.accountId!==account)return;const c=h.cid&&getC(h.cid);if(h.paymentRequested){if(!NorthTravelPayment.refund(h)){toast('无法确认原付款账户，未退款');return;}}else if(h.payer==='ta'){if(!c||!tvHotelRoleMoneyApply(c,h.fundingSource||'roleWallet',+h.price||0,h)){toast('无法确认角色原付款账户，订单和用户钱包未改变');return;}}else addBill('in',+h.price||0,'酒店退款：'+h.hotelName);h.status='cancelled';h.refundedAt=Date.now();save();closeModal();if(c&&tvHotelVisibleToRole(h,c.id)&&!c.blocked)scheduleReply(c.id,'[系统：酒店订单「'+h.hotelName+'」已取消，费用已退回原付款方。当前订单状态为已取消，请按人设自然回应，不要再说仍已订好。]');render();toast('酒店订单已取消');}
async function tvHotelDelete(id){if(NorthHotelData.roleOrder(tvInit().hotels.find(x=>x.id===id)))return;if(!await uiConfirm('删除这条酒店订单记录？'))return;const t=tvInit();t.hotels=t.hotels.filter(x=>x.id!==id);save();closeModal();render();toast('已删除');}
function tvCharHotelBook(c,cityName,dateStr,nights,stars,room,guest,keyword,rooms,adults,children){if(typeof NorthTravelHotel==='undefined'||!NorthTravelHotel.rolePlan){toast('酒店资料未加载，未生成订单');return false;}const plan=NorthTravelHotel.rolePlan(c,cityName,dateStr,nights,stars,room,guest,keyword,rooms,adults,children);if(plan.error){toast('酒店未预订：'+plan.error);return false;}if(plan.existing)return true;const money=tvHotelRoleMoney(c),price=plan.item.total;if(!money||NorthHotelData.moneyNext((money.rawBalance!=null?money.rawBalance:money.balance),-Math.round(price*100))===null){toast('酒店未预订：角色自己的银行余额不足或未设置');return false;}const s=plan.ui,h=Object.assign({id:uid(),cid:c.id,hotelName:plan.item.name,roomType:s.roomType,checkIn:s.checkIn,nights:s.nights,guestMode:s.guestMode,bookedBy:'ta',payer:'ta',fundingSource:money.source,price,status:'upcoming',no:tvHotelNo(Date.now()+String(c.id).length),ts:Date.now()},plan.fields);if(!tvHotelRoleMoneyApply(c,money.source,-price,h))return false;tvInit().hotels.push(h);msgs(c.id).push({role:'assistant',type:'hotel',hotel:h,id:uid(),time:Date.now()});save();if(cur().p==='chat'&&cur().id===c.id)render();toast((c.remark||c.name)+' 订好了'+h.city+'的模拟酒店');return true;}
function tvSendCard(trip){const c=getC(trip.cid);if(!c)return;const nm=(c.remark||c.name);
  pushMsg(trip.cid,{role:'user',type:'ticket',trip:trip,id:uid(),time:Date.now()});
  let desc,tail;
  if(trip.meet===false){
    desc=S.me.name+'订了'+tvMD(trip.date)+'去「'+trip.to+'」的机票，打算【一个人去旅行】'+(trip.payer==='ta'?'，机票是记在你账上的（等于你请客/你出的钱）':'');
    tail='。你刚收到一张登机牌。这【不是来见你】、是ta自己出去玩——请按你人设反应（关心行程/嘱咐路上小心/想跟着/吃醋ta一个人跑那么远/宠溺都行），用普通微信文字、别用旁白。你记住ta到了'+tvMD(trip.date)+'要独自去'+trip.to+'玩。';
  }else{
    if(trip.flier==='me'&&trip.payer==='me')desc=S.me.name+'订好了'+tvMD(trip.date)+' '+trip.from+'→'+trip.to+'的机票，要亲自飞过去在'+trip.to+'见你';
    else if(trip.flier==='me'&&trip.payer==='ta')desc=S.me.name+'订了'+tvMD(trip.date)+' '+trip.from+'→'+trip.to+'的机票飞去'+trip.to+'见你，机票钱是记在你账上的（等于你请ta来/你出机票钱）';
    else desc=S.me.name+'给你订了'+tvMD(trip.date)+' '+trip.from+'→'+trip.to+'的机票，是想请你飞去'+trip.to+'和ta见面';
    tail='。你刚收到一张登机牌。请按你的人设反应（惊喜/期待/宠溺/害羞/或嗔怪ta乱花钱都行），用普通微信文字回、别用旁白格式。你要【牢牢记住这件事】：到了'+tvMD(trip.date)+'你们在'+trip.to+'有一场线下见面（待约会）。';
  }
  if(!c.blocked)scheduleReply(trip.cid,'[系统：'+desc+tail+']');}
function tvTripsView(){const t=tvInit();const list=t.trips.filter(x=>!x.flightV2&&!x.railV2).slice().sort((a,b)=>(a.status==='upcoming'?0:1)-(b.status==='upcoming'?0:1)||((a.date>b.date)?1:-1));
  if(!list.length)return `<div style="padding:60px 30px;text-align:center;color:#6b7488;font-size:14px;line-height:2">还没有行程<br>去「搜票」订一张机票，安排一场见面</div>`;
  return '<div style="padding:16px">'+list.map(tr=>{const c=tr.cid?getC(tr.cid):null;const nm=c?(c.remark||c.name):(tr.cid?'（已删除）':'');const dd=tvDays(tr.date);const solo=tr.meet===false;
    const done=tr.status==='done',canc=tr.status==='cancelled',traveling=tr.status==='traveling';const ready=tr.status==='upcoming'&&dd!==null&&dd<=0;
    const badge=canc?'<span style="color:#7c869a">已取消</span>':traveling?'<span style="color:#c9a86a">双人出行中</span>':done?('<span style="color:#6f8f6f">'+(tr.cohab?'双人旅行已抵达':solo?'已出行':'已成行')+'</span>'):(ready?(tr.cohab?'<span style="color:#c9a86a">等待准点出发</span>':solo?'<span style="color:#8a94a8">出行中</span>':'<span style="color:#c9a86a">可开始约会</span>'):(dd!=null?'<span style="color:#8a94a8">距出发 '+dd+' 天</span>':''));
    const whoLine=tr.cohab?('你和 '+esc(nm)+' 两个人一起出发'):solo?('独自旅行'+(tr.payer==='ta'&&nm?'（'+esc(nm)+'请客）':'')):(tr.flier==='me'?'你飞去见 '+esc(nm):esc(nm)+' 飞来见面');
    return `<div style="background:#141a24;border:.5px solid rgba(255,255,255,.07);border-radius:14px;padding:15px 16px;margin-bottom:12px;${done||canc?'opacity:.7':''}">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><div style="color:#e9edf5;font-size:17px;font-weight:600">${esc(tr.from)} <span style="color:#c9a86a">›</span> ${esc(tr.to)}</div><div style="font-size:12px">${badge}</div></div>
      <div style="color:#8a94a8;font-size:12px;margin-top:5px">${tvMD(tr.date)} ${esc(tr.dep||'')} · ${esc(tr.no)} · ${tvClsT(tr.cls)}</div>
      <div style="color:#8a94a8;font-size:12px;margin-top:2px">${whoLine} · ${tr.pax}人 · ¥${northLocaleNumber(+tr.price||0)}</div>
      ${tr.status==='upcoming'?`<div style="display:flex;gap:10px;margin-top:12px">${(ready&&!solo&&!tr.cohab)?`<div onclick="tvStartDate('${tr.id}')" style="flex:1;text-align:center;padding:10px;border-radius:10px;background:linear-gradient(135deg,#c9a86a,#b1904f);color:#12161f;font-size:14px;font-weight:600;cursor:pointer">开始这场约会</div>`:''}<div onclick="tvCancelTrip('${tr.id}')" style="${(ready&&!solo&&!tr.cohab)?'':'flex:1;'}text-align:center;padding:10px ${(ready&&!solo&&!tr.cohab)?'16px':''};border-radius:10px;border:.5px solid rgba(255,255,255,.14);color:#a7b0c0;font-size:14px;cursor:pointer">取消</div></div>`:(done||canc)?`<div style="text-align:right;margin-top:8px"><span onclick="tvDelTrip('${tr.id}')" style="color:#7c869a;font-size:12px;cursor:pointer">删除记录</span></div>`:''}
    </div>`;}).join('')+'</div>';}
function tvStartDate(tid){const t=tvInit();const trip=t.trips.find(x=>x.id===tid);if(!trip)return;if(trip.meet===false){toast('这是独自旅行，没有见面');return;}const c=getC(trip.cid);if(!c){toast('这个角色已删除');return;}
  const o=offData(trip.cid);if(o.started){toast('你和'+(c.remark||c.name)+'已经在一场约会里了，先把那场结束');return;}
  offBeginSession(trip.cid,o,trip.to,trip.date,dayPartNow());
  o.msgs.push({id:uid(),who:'旁白',source:'me',text:'（'+tvMD(trip.date)+'，'+(trip.flier==='me'?S.me.name+'飞抵'+trip.to+'，两人在机场相见':(c.remark||c.name)+'飞抵'+trip.to+'，两人在机场相见')+'。）',time:Date.now()});
  trip.status='done';tvAddStamp(t,trip.to,trip.cid,trip.date);save();
  _off={id:trip.cid,busy:false};go('off',{id:trip.cid});
  offAI('[系统：'+(trip.flier==='me'?S.me.name+'坐飞机飞到'+trip.to+'来见你了':'你飞到'+trip.to+'来见'+S.me.name+'了')+'，你们期待已久的这场'+trip.to+'线下约会现在正式开始。用旁白【】描写接机/相拥/到场的场景，主动热情地开场。]');}
async function tvCancelTrip(tid){if(typeof NorthConcertBooking!=='undefined'&&NorthConcertBooking.current(tid))return NorthConcertBooking.refund(tid);if(typeof NorthTrainBooking!=='undefined'&&NorthTrainBooking.current(tid))return NorthTrainBooking.refund(tid);if(typeof NorthFlightBooking!=='undefined'){const o=NorthFlightBooking.current(tid);if(o&&(o.flightV2||o.fundingSource)&&!o.cohab)return NorthFlightBooking.refund(tid);}const t=tvInit();const trip=t.trips.find(x=>x.id===tid);if(!trip||NorthHotelData.roleOrder(trip)||trip.status!=='upcoming')return;const c=trip.cid?getC(trip.cid):null;
  const refundTo=trip.payer==='me'?'你':(c?(c.remark||c.name):'对方');
  if(!await uiConfirm('取消这趟机票？\n¥'+northLocaleNumber(+trip.price||0)+' 原路退回'+refundTo+'的钱包。'))return;
  trip.status='cancelled';
  // 谁付的退给谁
  if(trip.payer==='me')addBill('in',+trip.price||0,'退票：'+trip.from+'→'+trip.to);
  else if(c&&c.wallet!=null)c.wallet=(+c.wallet)+(+trip.price||0);
  if(trip.cohab&&c){const d=cohabData(c.id);if(d)cohabPushNotice(d,'已取消 '+trip.no+' '+trip.from+'→'+trip.to+' 双人机票 · 费用已原路退回',{kind:'trip-cancelled',key:'trip-cancelled:'+trip.id,time:Date.now(),tripId:trip.id});}
  save();
  // 角色立刻知道你取消了
  if(c&&!c.blocked&&trip.by==='me')scheduleReply(trip.cid,'[系统：'+S.me.name+'刚把'+tvMD(trip.date)+'去「'+trip.to+'」的机票【取消/退票】了（'+(trip.meet===false?'那是ta要一个人去玩的行程':'那是你俩约好在'+trip.to+'见面的')+'）。钱已原路退回'+refundTo+'。你按人设反应：可以问为什么不去了、失落、关心、或无所谓，普通微信文字。]');
  render();toast('已取消，¥'+northLocaleNumber(+trip.price||0)+' 已退回'+refundTo);}
async function tvDelTrip(tid){const t=tvInit();const trip=t.trips.find(x=>x.id===tid);if(!trip)return;if(!await uiConfirm('删除这条行程记录？'))return;t.trips=t.trips.filter(x=>x.id!==tid);save();render();toast('已删除');}
async function spyDelTrip(id,tid){if(!await uiConfirm('删除他的这条机票记录？'))return;if(S.travel&&S.travel.trips)S.travel.trips=S.travel.trips.filter(t=>t.id!==tid);save();render();toast('已删除');}
function tvPassportPhoto(v){if(!v)return'';if(isStoredImgRef(v)){const key=v.slice(4),src=_imgCache[key];return src?`<img src="${src}" style="width:100%;height:100%;object-fit:cover">`:`<div data-idb-avatar="${esc(key)}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#ddd">${_avIc('user')}</div>`;}if(/^(data:|https?:)/.test(v))return `<img src="${v}" style="width:100%;height:100%;object-fit:cover">`;return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px">${esc(v)}</div>`;}
function tvPassportView(){const p=tvInit().passport;const stamps=S.travel.stamps||[];
  const row=(k,v)=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:.5px solid rgba(0,0,0,.06)"><span style="color:#9a8f7a;font-size:12px;letter-spacing:1px">${k}</span><span style="color:#2a2419;font-size:14px">${esc(v||'—')}</span></div>`;
  return `<div style="padding:18px">
   <div style="background:linear-gradient(160deg,#f3ead3,#e6d8b8);border-radius:16px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.35)">
     <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #cbb98f;padding-bottom:10px"><span style="color:#7a6a45;font-size:12px;letter-spacing:3px">PASSPORT · 护照</span><span style="color:#9a8f7a;font-size:11px;letter-spacing:2px">小鱼旅行</span></div>
     <div style="display:flex;gap:14px;margin-top:14px">
       <div style="width:74px;height:96px;border-radius:8px;overflow:hidden;flex:0 0 auto;border:1px solid #cbb98f;background:#ddd">${tvPassportPhoto(S.me.avatar)}</div>
       <div style="flex:1;min-width:0">${row('姓名/NAME',p.name||S.me.name)}${row('性别/SEX',p.gender)}${row('生日/DOB',p.birth)}</div>
     </div>
     <div style="margin-top:4px">${row('国籍/NATIONALITY',p.nation)}${row('护照号/NO.',p.no)}</div>
     <div onclick="tvEditPassport()" style="margin-top:12px;text-align:center;padding:9px;border-radius:9px;background:#d8c69c;color:#5a4d2e;font-size:13px;letter-spacing:1px;cursor:pointer">编辑信息</div>
   </div>
   <div style="font-size:11px;color:#6b7488;letter-spacing:1px;margin:22px 2px 10px">目的地印章 · 已收集 ${stamps.length}</div>
   ${stamps.length?`<div style="display:flex;flex-wrap:wrap;gap:10px">${stamps.map(s=>`<div style="width:78px;height:78px;border-radius:50%;border:1.5px dashed #c9a86a;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#c9a86a;transform:rotate(-8deg)"><div style="font-size:15px;font-weight:700;letter-spacing:1px">${esc(s.code)}</div><div style="font-size:10px">${esc(s.city)}</div><div style="font-size:9px;opacity:.8">${tvMD(s.date)}</div></div>`).join('')}</div>`:`<div style="color:#6b7488;font-size:13px;padding:6px 2px">每完成一场线下见面，这里会盖一枚目的地印章。</div>`}
  </div>`;}
function tvEditPassport(){const p=tvInit().passport;
  openModal(`<h3>护照信息</h3>
   <div class="field"><label>姓名</label><input id="pp_name" value="${esc(p.name||S.me.name||'')}"></div>
   <div class="field"><label>性别</label><input id="pp_gender" value="${esc(p.gender||'')}"></div>
   <div class="field"><label>生日</label><input id="pp_birth" type="date" value="${esc(p.birth||'')}"></div>
   <div class="field"><label>国籍</label><input id="pp_nation" value="${esc(p.nation||'')}"></div>
   <div class="field"><label>护照号</label><input id="pp_no" value="${esc(p.no||'')}" placeholder="如 E12345678"></div>
   <div class="hint">照片用你的微信头像，去「微信 → 我」改。</div>
   <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="tvSavePassport()">保存</button></div>`);}
function tvSavePassport(){const p=tvInit().passport;p.name=($('#pp_name').value||'').trim();p.gender=($('#pp_gender').value||'').trim();p.birth=($('#pp_birth').value||'').trim();p.nation=($('#pp_nation').value||'').trim();p.no=($('#pp_no').value||'').trim();save();closeModal();render();toast('已保存');}
function tvMemoryView(){const items=[];S.contacts.forEach(c=>{if(c.deleted)return;const o=S.offline&&S.offline[c.id];if(o&&o.memory&&o.memory.length){o.memory.forEach((m,idx)=>items.push({cid:c.id,nm:(c.remark||c.name),idx,m}));}});
  items.reverse();
  if(!items.length)return `<div style="padding:60px 30px;text-align:center;color:#6b7488;font-size:14px;line-height:2">还没有约会回忆<br>见面结束后，这里会以旁白的形式<br>把你们的故事收藏起来</div>`;
  return '<div style="padding:16px">'+memorySearchBox('搜索约会回忆')+items.map(it=>{const mm=it.m;const label=(typeof mm==='object'&&mm.label)?mm.label:'';const loc=(typeof mm==='object'&&mm.loc)?mm.loc:'';const text=(typeof mm==='object')?(mm.text||''):mm;
    return `<div data-memory-row style="background:#141a24;border:.5px solid rgba(255,255,255,.07);border-radius:14px;padding:15px 16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="color:#c9a86a;font-size:12px;letter-spacing:1px">${esc(it.nm)}${loc?' · '+esc(loc):''}${label?' · '+esc(label):''}</span><span onclick="tvDelMem('${it.cid}',${it.idx})" style="color:#7c869a;font-size:12px;cursor:pointer">删除</span></div>
      <div style="color:#cfd6e2;font-size:14px;line-height:1.85">${esc(text)}</div></div>`;}).join('')+'</div>';}
async function tvDelMem(cid,idx){const o=S.offline&&S.offline[cid];if(!o||!o.memory||!o.memory[idx])return;if(!await uiConfirm('删除这条约会回忆？'))return;o.memory.splice(idx,1);save();render();toast('已删除');}
function tvNormDate(s){s=(''+s).trim();let m=s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return m[1]+'-'+tvP2(+m[2])+'-'+tvP2(+m[3]);
  m=s.match(/(\d{1,2})\s*月\s*(\d{1,2})/);if(m){const y=new Date().getFullYear();const mo=+m[1],da=+m[2];let d=new Date(y,mo-1,da);if(d<new Date(new Date().toDateString()))d=new Date(y+1,mo-1,da);return d.getFullYear()+'-'+tvP2(mo)+'-'+tvP2(da);}
  const dd=tvDays(s);return (dd!=null)?s:todayStr();}
// 角色主动订票来见你：城市=见面地，他飞过去，卡片以他的名义发给你
//@@ web
function tvCharBook(c,cityName,dateStr){if(typeof NorthTravelFlight==='undefined'){toast('机票组件未载入，未生成订单');return false;}return NorthTravelFlight.roleLegacy(c,cityName,dateStr,false);if(!c||!cityName)return false;tvInit();
//@@ private
function tvCharBook(c,cityName,dateStr){if(typeof NorthTravelFlight==='undefined'){toast('机票组件未载入，未生成订单');return false;}return NorthTravelFlight.roleLegacy(c,cityName,dateStr,false);if(!c||!cityName)return;tvInit();
//@@ end
  let city=(tvCity(cityName).c!=='---')?cityName:cityName;const date=tvNormDate(dateStr),from=charHomeCity(c),mine=meHomeCity();if(from&&mine&&tvSameCity(city,from)&&!tvSameCity(city,mine))city=mine;
  const seed=(Date.now()+city.length+(from||'').length)|0,tm=tvLegTimes(from,city,seed);
  const trip={id:uid(),cid:c.id,from:from||'',to:city,date,ret:'',cls:'business',pax:1,by:'ta',flier:'ta',payer:'ta',no:tvFlightNo(seed),dep:tm.dep,arr:tm.arr,price:tvPrice(from,city,'business'),status:'upcoming',ts:Date.now()};
  S.travel.trips.push(trip);
  msgs(c.id).push({role:'assistant',type:'ticket',trip,id:uid(),time:Date.now()});
  save();if(cur().p==='chat'&&cur().id===c.id)render();
//@@ web
  toast((c.remark||c.name)+' 给你订了'+(from?from+'到':'到')+city+'的机票');return true;}
//@@ private
  toast((c.remark||c.name)+' 给你订了'+(from?from+'到':'到')+city+'的机票');}
//@@ end
// 角色送你一趟独自旅行(不是见面)：你飞去玩、他出钱，卡片以他名义发给你
//@@ web
function tvCharGift(c,cityName,dateStr){if(typeof NorthTravelFlight==='undefined'){toast('机票组件未载入，未生成订单');return false;}return NorthTravelFlight.roleLegacy(c,cityName,dateStr,true);if(!c||!cityName)return false;tvInit();
//@@ private
function tvCharGift(c,cityName,dateStr){if(typeof NorthTravelFlight==='undefined'){toast('机票组件未载入，未生成订单');return false;}return NorthTravelFlight.roleLegacy(c,cityName,dateStr,true);if(!c||!cityName)return;tvInit();
//@@ end
  const city=cityName;const date=tvNormDate(dateStr);const from=meHomeCity()||'苏州';const price=tvPrice(from,city,'economy');const seed=(Date.now()+city.length+5)|0,tm=tvLegTimes(from,city,seed);
  if(c.wallet!=null)c.wallet=Math.max(0,(+c.wallet)-price);
  const trip={id:uid(),cid:c.id,from,to:city,date,ret:'',cls:'economy',pax:1,by:'ta',meet:false,flier:'me',payer:'ta',no:tvFlightNo(seed),dep:tm.dep,arr:tm.arr,price,status:'upcoming',ts:Date.now()};
  S.travel.trips.push(trip);
  msgs(c.id).push({role:'assistant',type:'ticket',trip,id:uid(),time:Date.now()});
  save();if(cur().p==='chat'&&cur().id===c.id)render();
//@@ web
  toast((c.remark||c.name)+' 送了你一趟去'+city+'的旅行');return true;}
//@@ private
  toast((c.remark||c.name)+' 送了你一趟去'+city+'的旅行');}
//@@ end
// 到了出发日：提醒一下，并让角色主动提起这场待约会
/* v1726：订了机票/火车票，当天聊天里没有「约好的日子到了」提醒——新版机票、火车票走 flightV2/railV2，
   上面那段老提醒一看到新票就直接 return 了，只剩角色那边的出行提示（她不在线时还可能被跳过）。
   到了出行当天，在每个同行/知情角色的聊天里放一条可见的系统提醒，每张票只放一次。 */
function tvV2DayNotice(tr){if(!tr||tr.status!=='upcoming'||tr._dayNoticed)return false;const dd=tvDays(tr.date);if(dd===null||dd>0)return false;if(+tr.departAt&&Date.now()>+tr.departAt+43200000){tr._dayNoticed=true;return true;}
  tr._dayNoticed=true;const kind=tr.flightV2?'航班':'火车',ids=[...new Set([...(tr.knownRoleIds||[]),...(tr.cid?[tr.cid]:[])])];
  ids.forEach(id=>{const c=getC(id);if(!c||c.deleted)return;const name=c.remark||c.name,line=(tr.from&&tr.to?tr.from+' → '+tr.to:'')+(tr.no?' · '+kind+' '+tr.no:'')+(tr.dep?' · '+tr.dep+' 出发':'');
    /* TRIP_DAY_WHO_V1（2026-10-21 她发现：他给她订的单人票，提示却写「和先生约好的出行日」）：按票上真正坐车的人说 */
    const people=Array.isArray(tr.people)?tr.people.map(p=>p&&p.id):null,me=!!people&&people.includes('me'),ta=!!people&&people.includes('role:'+id),gift=tr.payer==='ta'&&tr.cid===id;
    const head=!people?'今天是和'+name+'约好的出行日':me&&ta?'今天是和'+name+'一起出行的日子':me?'今天是你的出行日'+(gift?'（'+name+'给你订的票）':''):ta?'今天是'+name+'出行的日子':'今天有一趟'+name+'知道的出行';
    msgs(id).push({role:'user',type:'sys',content:head+'：'+line+'，去「小鱼旅行 → 行程」看看这张票',time:Date.now(),id:uid()});});
  return true;}
function tvCheckDue(){if(typeof NorthConcertBooking!=='undefined'&&isMain())NorthConcertBooking.checkDue();if(typeof NorthTrainBooking!=='undefined'&&isMain())NorthTrainBooking.checkDue();if(typeof NorthFlightBooking!=='undefined'&&isMain())NorthFlightBooking.checkDue();if(!isMain()||!(S.travel&&S.travel.trips))return;let ch=false;
  S.travel.trips.forEach(tr=>{if(tr&&(tr.flightV2||tr.railV2)){if(tvV2DayNotice(tr))ch=true;return;}if(tr&&tr.cohab){const d=tr.cid&&S.cohabitation&&S.cohabitation.homes&&S.cohabitation.homes[tr.cid];if(d&&cohabTravelAdvance(tr.cid,d,Date.now()))ch=true;return;}if(tr.status!=='upcoming'||tr._reminded)return;const dd=tvDays(tr.date);if(dd!==null&&dd<=0){tr._reminded=true;ch=true;const c=tr.cid?getC(tr.cid):null;
    if(tr.meet===false){
      // 独自旅行：到日子自动出行、盖章；若有关联角色则通知ta关心
      tr.status='done';tvAddStamp(S.travel,tr.to,tr.cid||'',tr.date);
      if((tr.payer==='ta'||tr._seenByChar)&&c&&!c.deleted&&!c.blocked)scheduleReply(tr.cid,'[系统：今天'+S.me.name+'出发去「'+tr.to+'」一个人旅行了（'+(tr.payer==='ta'?'机票是你请客/你出的钱':'你之前查手机看到了这张票')+'，不是来见你）。主动关心一句：路上小心、到了报平安、想ta、或嗔怪ta一个人跑那么远，普通微信文字、别用旁白。]');
    }else if(c&&!c.deleted){msgs(tr.cid).push({role:'user',type:'sys',content:'今天是你和'+(c.remark||c.name)+'约好在「'+tr.to+'」见面的日子，去「小鱼旅行 → 行程」开始这场约会',time:Date.now(),id:uid()});
      if(!c.blocked)scheduleReply(tr.cid,'[系统：今天就是你和'+S.me.name+'约好在「'+tr.to+'」线下见面的日子（'+(tr.flier==='me'?S.me.name+'要飞来找你':'你要飞去找ta')+'）。主动跟ta说一句：表达期待、确认行程、或问到了没，普通微信文字，别用旁白。]');}}});
  if(ch){save();const cu=cur();if(cu&&(cu.p==='chat'||cu.p==='wechat'))render();}}
//@@ web
setInterval(tvCheckDue,30000);setTimeout(tvCheckDue,10000);
//@@ private
setInterval(()=>northNativeBackgroundTask('travel-reminder',tvCheckDue),30000);setTimeout(()=>northNativeBackgroundTask('travel-reminder',tvCheckDue),10000);
//@@ end

/* ===== 禁闭室 / 小黑屋（终极惩罚·病娇黑暗形态）===== */
const COLD_MS=2*3600000;
let _jailBusy=false,_jailOsc=null;
function jailC(){return (S.jail&&S.jail.cid&&getC(S.jail.cid))||(S.couple&&getC(S.couple.cid))||null;}
function coldLeft(c){return (c&&c.coldUntil&&c.coldUntil>Date.now())?c.coldUntil:0;}
function jailRecent(cid){return msgs(cid).slice(-12).map(m=>{const t=msgToText(m);const c=getC(cid);return t?((m.role==='user'?S.me.name:(c?c.name:'ta'))+'：'+t.replace(/\n/g,' ').slice(0,40)):'';}).filter(Boolean).join('\n');}
/* 恐怖氛围音 */
let _jailGlitchT=null,_jailIdleT=null,_jailLastAct=0;
//@@ web
function jailGlitchTick(){if(!S.jail||!S.jail.active){_jailGlitchT=null;return;}const w=document.getElementById('jailwrap');if(w&&!_jailBusy){w.classList.add('jglitch');jailStab();setTimeout(()=>{try{w.classList.remove('jglitch');}catch(e){}},340);}_jailGlitchT=setTimeout(jailGlitchTick,7000+Math.random()*10000);}
//@@ private
function jailGlitchTick(){if(!S.jail||!S.jail.active){_jailGlitchT=null;return;}const w=document.getElementById('jailwrap');if(w&&!_jailBusy){w.classList.add('jglitch');jailStab();setTimeout(()=>{try{w.classList.remove('jglitch');}catch(e){}},341);}_jailGlitchT=setTimeout(jailGlitchTick,7000+Math.random()*10000);}
//@@ end
function jailCreep(text){try{const el=document.createElement('div');el.className='jcreep';el.innerHTML='<span>'+esc((text||'').slice(0,24))+'</span>';document.body.appendChild(el);jailHeartRush(360);if(navigator&&navigator.vibrate)navigator.vibrate(50);setTimeout(()=>{try{el.remove();}catch(e){}},3400);}catch(e){}}
function jailIntro(){try{const el=document.createElement('div');el.className='jintro';el.innerHTML='<span>门……锁上了</span>';document.body.appendChild(el);setTimeout(()=>{try{el.remove();}catch(e){}},2600);}catch(e){}}
function jailBump(){_jailLastAct=Date.now();}
function jailIdleTick(){if(!S.jail||!S.jail.active){_jailIdleT=null;return;}
  if(!_jailBusy&&!(S.jail&&S.jail.choice)&&cur().p==='jail'&&Date.now()-_jailLastAct>26000){const L=['你在躲我？','看着我。','别想跑。','心跳这么快…','回答我。','乖，别让我等。'];jailCreep(L[Math.floor(Math.random()*L.length)]);_jailLastAct=Date.now()-10000;}
  _jailIdleT=setTimeout(jailIdleTick,4000);}
function jailAmbientStart(){_jailLastAct=_jailLastAct||Date.now();if(!_jailGlitchT)_jailGlitchT=setTimeout(jailGlitchTick,8000+Math.random()*8000);if(!_jailIdleT)_jailIdleT=setTimeout(jailIdleTick,4000);ensureAudio();if(!_audio||_jailOsc||!S.settings.sound)return;try{
  const g=_audio.createGain();g.gain.value=0.05*volMul();g.connect(_audio.destination);
  const o1=_audio.createOscillator();o1.type='sine';o1.frequency.value=54;
  const o2=_audio.createOscillator();o2.type='triangle';o2.frequency.value=57.7;
  const lfo=_audio.createOscillator();lfo.frequency.value=0.14;const lg=_audio.createGain();lg.gain.value=0.03;lfo.connect(lg);lg.connect(g.gain);
  o1.connect(g);o2.connect(g);o1.start();o2.start();lfo.start();_jailOsc={o1,o2,lfo};
}catch(e){}jailHeartStart();}
function jailAmbientStop(){if(_jailOsc){try{_jailOsc.o1.stop();_jailOsc.o2.stop();_jailOsc.lfo.stop();}catch(e){}_jailOsc=null;}jailHeartStop();if(_jailGlitchT){clearTimeout(_jailGlitchT);_jailGlitchT=null;}if(_jailIdleT){clearTimeout(_jailIdleT);_jailIdleT=null;}}
function jailStab(){ensureAudio();if(!_audio||!S.settings.sound)return;try{const o=_audio.createOscillator(),g=_audio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(900,_audio.currentTime);o.frequency.exponentialRampToValueAtTime(110,_audio.currentTime+.18);g.gain.setValueAtTime(Math.min(.5,.16*volMul()),_audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,_audio.currentTime+.22);o.connect(g);g.connect(_audio.destination);o.start();o.stop(_audio.currentTime+.24);}catch(e){}}
function jailScream(){ensureAudio();if(!_audio||!S.settings.sound)return;try{const t=_audio.currentTime;
  const o=_audio.createOscillator(),g=_audio.createGain();o.type='sawtooth';o.frequency.setValueAtTime(1500,t);o.frequency.exponentialRampToValueAtTime(70,t+.5);g.gain.setValueAtTime(Math.min(.95,.55*volMul()),t);g.gain.exponentialRampToValueAtTime(.001,t+.6);o.connect(g);g.connect(_audio.destination);o.start();o.stop(t+.62);
  const o2=_audio.createOscillator(),g2=_audio.createGain();o2.type='sine';o2.frequency.setValueAtTime(130,t);o2.frequency.exponentialRampToValueAtTime(34,t+.5);g2.gain.setValueAtTime(Math.min(.95,.55*volMul()),t);g2.gain.exponentialRampToValueAtTime(.001,t+.55);o2.connect(g2);g2.connect(_audio.destination);o2.start();o2.stop(t+.6);
}catch(e){}}
function jailJumpscare(text){try{const el=document.createElement('div');el.className='jscare';el.innerHTML='<span>'+esc((text||'').slice(0,18))+'</span>';document.body.appendChild(el);jailScream();jailHeartRush(300);if(navigator.vibrate)navigator.vibrate([60,40,120]);setTimeout(()=>{try{el.remove();}catch(e){}},860);}catch(e){}}
let _jailHeart=null,_jailHeartT=null,_jailHeartMs=1050;
function jailThump(){ensureAudio();if(!_audio||!S.settings.sound)return;try{const mk=(at,fr)=>{const o=_audio.createOscillator(),g=_audio.createGain();o.type='sine';o.frequency.setValueAtTime(fr,at);o.frequency.exponentialRampToValueAtTime(fr*0.6,at+.12);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(Math.min(.7,.34*volMul()),at+.02);g.gain.exponentialRampToValueAtTime(.0001,at+.2);o.connect(g);g.connect(_audio.destination);o.start(at);o.stop(at+.22);};const t=_audio.currentTime;mk(t,64);mk(t+.21,50);}catch(e){}}
function jailHeartStart(){if(_jailHeart||!(S.settings&&S.settings.sound))return;_jailHeartMs=1050;const tick=()=>{jailThump();_jailHeart=setTimeout(tick,_jailHeartMs);};_jailHeart=setTimeout(tick,400);}
function jailHeartStop(){if(_jailHeart){clearTimeout(_jailHeart);_jailHeart=null;}if(_jailHeartT){clearTimeout(_jailHeartT);_jailHeartT=null;}}
//@@ web
function jailHeartRush(ms){_jailHeartMs=ms||340;if(_jailHeartT)clearTimeout(_jailHeartT);_jailHeartT=setTimeout(()=>{_jailHeartMs=1050;},4500);}
//@@ private
function jailHeartRush(ms){_jailHeartMs=ms||341;if(_jailHeartT)clearTimeout(_jailHeartT);_jailHeartT=setTimeout(()=>{_jailHeartMs=1050;},4500);}
//@@ end
function enterJail(cid,reason,test){const c=getC(cid);if(!c)return;
  if(S.jail&&S.jail.active)return;/* 已经在小黑屋里了，别重复进（防"结束后重复拉进去"的bug）*/
  if(!test&&S.jail&&S.jail.releasedAt&&Date.now()-S.jail.releasedAt<300000)return;/* 刚放出来不到5分钟，别立刻又被自动拉回去 */
  if(typeof _call!=='undefined'&&_call){
    const ended={ts:Date.now(),kind:_call.kind,dir:_call.dir||(_call.state==='incoming'?'incoming':'outgoing'),byAI:true,dur:_call.start?Math.floor((Date.now()-_call.start)/1000):0,reason:'jail'};
    c._lastCallEnded=ended;
    try{clearInterval(_callTimer);}catch(e){}
    try{ringStop();}catch(e){}
    _call=null;_callBusy=false;_callPend=null;_callVisionPend=[];_callStatePend=null;_callStateEpoch++;callClearPersist();
    try{renderCall();}catch(e){}
  }
  offlineFocusStop();
  const _gd=(!test&&c.grudges)?c.grudges.filter(x=>!x.done):[];
  const _gtxt=_gd.length?('\n你记仇小本本上还没清的旧账（这次正好借机一笔一笔跟对方谈清楚，一条都别漏）：\n'+_gd.map((x,i)=>(i+1)+'. '+x.text+'（'+ymd(x.ts||0)+'记的）').join('\n')):'';
  S.jail={active:true,cid:cid,test:!!test,reason:reason||'',msgs:[],choice:null,optRounds:0,since:Date.now()};save();go('jail');jailIntro();
  jailAI(true,'[系统：你刚把'+S.me.name+'带进了你们自愿约定的"禁闭室"进行一次规则教育。这里没有现实拘禁、伤害、恐吓或强迫，只是严肃处理犯错、反省和关系修复。'+(reason?('这次需要处理的原因：'+reason+'。'):'')+'\n你们最近的聊天（具体问题就在里面）：\n'+jailRecent(cid)+_gtxt+'\n'+(test?'（这是'+S.me.name+'自己点的测试，保持认真但不要过度施压）':'')+'\n用旁白【】写安静昏暗的房间和严肃气氛，再明确点出'+S.me.name+'具体哪里做错了'+(_gd.length?'、把上面记仇本里的旧账按顺序谈清':'')+'（旁白只能用他/她/两人，绝不能写你/我；不许瞎编、不许含糊），最后给出清楚、合理、能完成的改正条件。]');}
function jailRolePron(c){return c&&c.gender==='女'?'她':'他';}
function jailUserPron(){return S.me&&S.me.gender==='男'?'他':'她';}
function jailNarrText(t,c){let s=(''+(t||'')).trim();if(!s)return s;const he=jailRolePron(c||jailC()),you=jailUserPron();
  if(S.me&&S.me.name)s=s.split(S.me.name).join(you);
  return s.replace(/\bta\b/gi,you).replace(/我们|咱们|你们|我俩|你俩/g,'两人').replace(/我的/g,he+'的').replace(/你的/g,you+'的').replace(/我自己/g,he).replace(/你自己/g,you).replace(/我/g,he).replace(/你/g,you).replace(/咱/g,'两人');}
function jailPersonaPin(c){return '【禁闭室角色铁律】你就是「'+(c.remark||c.name)+'」本人。这里是两名成年人自愿开启的规则教育模拟：只处理具体犯错、解释、反省、约定和关系修复，没有现实拘禁、伤害、恐吓或强迫，也不是色情场景。始终用角色本人的中文口吻教导和回应'+S.me.name+'；不提AI、模型、政策、系统或格式，不输出英文。若'+S.me.name+'明确要求停止或表现出真实不适，就用角色本人的方式暂停、确认和安抚。';}
function jailCleanHidden(t,c,id){let s=String(t||'');
  s=s.replace(/[\[【]\s*心情值\s*[\|｜:：]\s*([+\-]?\d{1,3})\s*[\]】]/g,(m,n)=>{if(c&&id)adjMood(id,parseInt(n,10)||0);return '';});
  s=s.replace(/[\[【]\s*心情\s*[\|｜:：]\s*([^\]】]*)\s*[\]】]/g,(m,v)=>{if(c){const mood=honestMoodText(c,(v||'').trim());c.mood=typeof moodInnerMonologue==='function'?moodInnerMonologue(c,mood):mood;}return '';});
  return s.replace(/[\[【]\s*(?:语气|情绪|称呼|角色扮演|系统提示|格式说明)\s*[\|｜:：][^\]】]*[\]】]/g,'').replace(/[ \t]{2,}/g,' ').trim();}
/* JAIL_LATIN_NAME_V1（2026-10-30 她截图）：以前只要回复里有一个英文字母就算坏回复，换成一句固定的话；她的名字是 North，他一叫她名字就被扔掉，于是同一句话反复出现。现在她和角色的名字、几个常用词不算英文；只有基本是英文、或英文词很多时才算坏回复；用不了时不再塞固定台词。 */
function jailAllowedLatin(c){const out=['OK','App','iPhone','QQ','KTV','vlog','emo'];[S.me&&S.me.name,c&&c.name,c&&c.remark,...((S.me&&S.me.accounts)||[]).map(a=>a&&a.name)].forEach(n=>String(n||'').split(/[^A-Za-z]+/).forEach(w=>{if(w.length>=2)out.push(w);}));return Array.from(new Set(out));}
function jailLatinStrip(t,c){let s=String(t||'');jailAllowedLatin(c).forEach(w=>{s=s.replace(new RegExp('(^|[^A-Za-z])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-z])','gi'),'$1');});return s;}
function jailChineseOnly(t,c){const keep=[];let s=String(t||'').replace(/\bbaby\b/gi,'宝贝').replace(/\bpuppy\b/gi,'小狗狗').replace(/\bdarling\b/gi,'亲爱的').replace(/\bhoney\b/gi,'宝贝').replace(/\bsweetheart\b/gi,'宝贝');jailAllowedLatin(c).forEach(w=>{s=s.replace(new RegExp('(^|[^A-Za-z])('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?![A-Za-z])','gi'),(m,pre,word)=>{keep.push(word);return pre+'\u0001'+(keep.length-1)+'\u0002';});});return s.replace(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g,'').replace(/\u0001(\d+)\u0002/g,(m,i)=>keep[+i]).replace(/[ \t]{2,}/g,' ').replace(/\s+([，。！？；：])/g,'$1').trim();}
function jailHasLatin(t,c){const s=jailLatinStrip(String(t||'').replace(/\bbaby\b/gi,'宝贝').replace(/\bpuppy\b/gi,'小狗狗').replace(/\bdarling\b/gi,'亲爱的').replace(/\bhoney\b/gi,'宝贝').replace(/\bsweetheart\b/gi,'宝贝'),c),words=s.match(/[A-Za-z]+/g)||[],han=(s.match(/[\u4e00-\u9fff]/g)||[]).length;return words.length>0&&(han<2||words.length>=4);}
function jailBadOutput(t,c){return !String(t||'').trim()||isRefusal(t)||jailHasLatin(t,c);}
function jailSystem(c){let s=c.persona||'';
  s+='\n\n# 现在：禁闭室（规则教育模式）\n你把'+S.me.name+'带进了你们约定好的禁闭室。这里不是现实拘禁，也不包含伤害、恐吓或强迫；只是两名成年人自愿进行的一次严肃教育和关系沟通，像老师耐心纠正学生犯错一样，目的是把事情讲清楚、让对方真正理解并修复关系。\n- 可以严厉、克制、有压迫感，但底线是尊重、安全、无伤害；不描写暴力、疼痛、羞辱、威胁或色情内容。\n- 旁白用【】写安静昏暗的房间、动作和气氛，必须第三人称，只能用“他/她/两人”；旁白绝对不要出现“你/我/我们/你们”。说的话正常写，可以用你/我。\n- 你【清楚对方具体犯了什么错】（见下方最近聊天/关押原因），所有问题都扣住这件事，别空泛、别瞎编。\n- 给对方明确、可完成的离开条件：说清事实、理解错在哪里、认真道歉、提出以后怎么做。不要逼迫对方说与错误无关的话。\n- 一轮只问一个关键问题，听完回答再推进；可以多谈几轮，但不要故意拖延、重复盘问或让对方崩溃。\n- 需要给选项时，单独一行 [选择|你的问题|选项1/选项2(/选项3)]；选项要帮助对方理解和表达，不是诱导或陷阱。\n- 需要强调一句重要提醒时，可以单独一行 [突脸|一句简短提醒]，只作为界面强调效果，不代表恐吓或伤害。\n- 对方在选择题里点选项时，你直接看到选择，别把它当成对方打字说的话复述。\n- 当对方已经解释清楚、理解错误并给出可信的改法，你决定教育结束时，【单独一行】只写 [放出]。\n- 【说放就真放】：一旦写了 [放出]、或说出“可以出去了/这次谈清楚了”，就结束，不反悔。\n- 【绝不重复】：对方已经回答或认过的内容就翻篇，继续处理下一点，不原样重复问题。\n- 全程沉浸、有分寸，重点是教导、反省和修复关系。'+((S.jail&&S.jail.reason)?'\n这次需要处理的原因：'+S.jail.reason+'。':'');
  const rc=S.jail?jailRecent(S.jail.cid):'';if(rc)s+='\n\n# 你们最近的聊天（具体问题就在里头）\n'+rc;
  const _jg=(S.jail&&!S.jail.test&&c.grudges)?c.grudges.filter(x=>!x.done):[];
  if(_jg.length)s+='\n\n# 你的记仇小本本（这次要把这些旧账一笔一笔谈清）\n'+_jg.map((x,i)=>(i+1)+'. '+x.text).join('\n')+'\n【怎么谈】：按编号一笔一笔顺着往下处理，问清第①笔、确认'+S.me.name+'理解了，再谈第②笔。\n【千万别翻来覆去重复同一笔】——一笔谈清就翻篇、进行到下一笔，别绕回去重复刚问完的内容。\n等这些账都谈过、'+S.me.name+'理解影响并提出可信的改法，你再考虑结束。';
  s+=worldbookPrompt([(c.persona||'')+traitDesc(c),(S.jail&&S.jail.reason)||'',rc,_jg.map(x=>x.text).join('\n')].join('\n'),c.id,'小黑屋/禁闭室','jail');
  s+='\n\n'+jailPersonaPin(c);
  s+='\n\n# 输出铁律\n- 全程只输出中文角色内容，不得出现英文字母、代码、政策说明、系统说明或格式解释。\n- 隐藏标签 [心情|...]、[心情值|...] 只能单独使用，绝不能混进正文；它们不会展示给用户。\n- 每轮简洁自然，几段即可。';
  return s;}
