/* TASK_NOTES_V2: the 任务便签 app redrawn from the owner's design (cream paper, calico cats).
   Page 1 of 4: 今日. The owner's own tasks live in S.taskNotes; the role's daily tasks keep their
   original data (c.tasks), verification (completeTask) and reward/penalty rules unchanged.
   Pictures sit in assets/task-notes/ under fixed names so new artwork replaces them in place. */
(()=>{
 'use strict';
 if(typeof window==='undefined'||typeof renderTasks!=='function')return;
 const IMG='assets/task-notes/';
 const CATS={
  water:{label:'喝水',img:'item-water.png',tone:'pink',icon:'drop'},
  message:{label:'消息',img:'cat-phone.png',tone:'yellow',icon:'chat'},
  sport:{label:'运动',img:'cat-run.png',tone:'blue',icon:'shoe'},
  study:{label:'学习',img:'cat-study.png',fallback:'cat-book.png',tone:'blue',icon:'book'},
  work:{label:'工作',img:'cat-book.png',tone:'yellow',icon:'list'},
  eat:{label:'吃饭',img:'cat-eat.png',fallback:'cat-phone.png',tone:'yellow',icon:'bowl'},
  sleep:{label:'睡觉',img:'cat-sleep.png',fallback:'cat-book.png',tone:'blue',icon:'moon'},
  other:{label:'其他',img:'cat-default.png',fallback:'cat-run.png',tone:'pink',icon:'paw'}
 };
 const TONE={pink:['#fce9e5','#ffe5e1'],yellow:['#feefda','#f9e2c0'],blue:['#e0edf5','#d3e4f0']};
 let tab='today';
 const pad=n=>String(n).padStart(2,'0');
 const dayKey=t=>{const d=new Date(t||Date.now());return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
 const attr=v=>esc(String(v==null?'':v)).replace(/"/g,'&quot;');
 function store(){S.taskNotes=S.taskNotes&&typeof S.taskNotes==='object'?S.taskNotes:{};const s=S.taskNotes;s.items=Array.isArray(s.items)?s.items:[];s.stars=Math.max(0,+s.stars||0);s.stats=s.stats&&typeof s.stats==='object'?s.stats:{};s.stats.days=s.stats.days&&typeof s.stats.days==='object'?s.stats.days:{};s.roleStarred=s.roleStarred&&typeof s.roleStarred==='object'?s.roleStarred:{};return s;}
 function dayStat(key){const d=store().stats.days;return d[key]=d[key]&&typeof d[key]==='object'?d[key]:{done:0,total:0,ownStars:0,praise:0,nudge:0};}
 // Old cards do not pile up: an unfinished task disappears 3 days after its date, a finished one after 35.
 function prune(){const s=store(),k3=dayKey(Date.now()-3*86400e3),k35=dayKey(Date.now()-35*86400e3),k7=dayKey(Date.now()-7*86400e3),k400=dayKey(Date.now()-400*86400e3),n=s.items.length;s.items=s.items.filter(x=>x&&(x.date>=k3||x.done&&x.date>=k35));let changed=s.items.length!==n;
  for(const key of Object.keys(s.roleStarred))if(key.slice(0,10)<k7){delete s.roleStarred[key];changed=true;}for(const key of Object.keys(s.stats.days))if(key<k400){delete s.stats.days[key];changed=true;}return changed;}
 function atOf(x){if(!x||!x.time||!/^\d{2}:\d{2}$/.test(x.time))return 0;const [y,m,d]=String(x.date).split('-').map(Number),[h,mi]=x.time.split(':').map(Number);return new Date(y,m-1,d,h,mi,0,0).getTime();}
 function roleTasks(){let c=null,t=null;try{c=taskC();t=c&&tasksToday(c);}catch(_){}return{c,t,list:t&&Array.isArray(t.list)?t.list:[]};}
 function roleCat(x){if(x.verify==='essay')return 'study';if(['moment','tweet','douyin','truth'].includes(x.verify))return 'message';return 'other';}
 function ownRow(x,now,key){return{own:true,id:x.id,text:x.text,time:x.time||'',date:x.date,cat:CATS[x.cat]?x.cat:'other',done:!!x.done,past:!x.done&&x.date<key,late:!x.done&&(x.date<key||x.date===key&&atOf(x)>0&&now>atOf(x))};}
 function roleRows(){const {c,list}=roleTasks(),key=dayKey();return list.map(x=>({own:false,id:x.id,text:x.text,time:'',date:key,cat:roleCat(x),done:!!x.done,by:c&&(c.remark||c.name)||'ta',label:typeof taskVerifyLabel==='function'?taskVerifyLabel(x):'完成'}));}
 function todayRows(){const key=dayKey(),now=Date.now(),own=store().items.filter(x=>x&&x.date===key).map(x=>ownRow(x,now,key));
  const role=roleRows();
  const rows=own.concat(role);rows.sort((a,b)=>(a.done-b.done)||String(a.time||'99:99').localeCompare(String(b.time||'99:99')));return rows;}
 function icon(name,color){const c=color||'currentColor',s='width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  return {drop:'<svg '+s+'><path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z" fill="'+c+'" fill-opacity=".85" stroke="none"/></svg>',
   chat:'<svg '+s+'><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V16h0a2.5 2.5 0 0 1-2-2.5z" fill="'+c+'" fill-opacity=".85" stroke="none"/><circle cx="9" cy="10" r="1" fill="#fff" stroke="none"/><circle cx="12" cy="10" r="1" fill="#fff" stroke="none"/><circle cx="15" cy="10" r="1" fill="#fff" stroke="none"/></svg>',
   shoe:'<svg '+s+'><path d="M3.5 15.5c2.5 0 4.5-1 6-3.5l1.5 1.5c1.5 1 3 1 5 1.3 2.4.3 4.5 1.4 4.5 3.2H4.5a1 1 0 0 1-1-1z"/><path d="M9.5 12 11 9.5"/></svg>',
   book:'<svg '+s+'><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V18c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v12.5"/></svg>',
   list:'<svg '+s+'><rect x="5" y="4" width="14" height="16" rx="2.5"/><path d="M9 9h6M9 12.5h6M9 16h4"/></svg>',
   bowl:'<svg '+s+'><path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M9 4c0 2 2 2 2 4M13 4c0 2 2 2 2 4"/></svg>',
   moon:'<svg '+s+'><path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z" fill="'+c+'" fill-opacity=".8" stroke="none"/></svg>',
   paw:'<svg '+s+'><ellipse cx="12" cy="15.5" rx="4.2" ry="3.4" fill="'+c+'" stroke="none"/><circle cx="7" cy="10" r="1.8" fill="'+c+'" stroke="none"/><circle cx="10.2" cy="7" r="1.8" fill="'+c+'" stroke="none"/><circle cx="13.8" cy="7" r="1.8" fill="'+c+'" stroke="none"/><circle cx="17" cy="10" r="1.8" fill="'+c+'" stroke="none"/></svg>',
   heart:'<svg '+s+'><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="'+c+'" stroke="none"/></svg>'}[name]||'';}
 const ICON_COLOR={drop:'#5d8fc7',chat:'#a07b56',shoe:'#5f7fa5',book:'#6f7fa0',list:'#8d7a63',bowl:'#a07b56',moon:'#6b84b0',paw:'#e89a9a',heart:'#e78c9a'};
 function picture(cat){const m=CATS[cat]||CATS.other;return '<img class="tn-art" src="'+IMG+m.img+'" alt=""'+(m.fallback?' onerror="this.onerror=null;this.src=\''+IMG+m.fallback+'\'"':'')+'>';}
 function card(r){const m=CATS[r.cat],tone=TONE[m.tone],ic=r.own?m.icon:'heart',chip=r.own?(r.past?'已逾期':r.late?'已过 '+r.time:(r.time||'全天')):esc(r.by)+' 布置';
  const press=r.own?'TaskNotes.toggle(\''+r.id+'\')':'TaskNotes.roleDone(\''+r.id+'\')',open=r.own?' onclick="TaskNotes.edit(\''+r.id+'\')"':'';
  return '<article class="tn-card'+(r.done?' done':'')+'" data-id="'+attr(r.id)+'" style="--tn-bg:'+tone[0]+';--tn-chip:'+tone[1]+'"><button class="tn-check" aria-label="'+(r.done?'已完成':'完成')+'" onclick="event.stopPropagation();'+(r.done&&!r.own?'':press)+'">'+(r.done?'<svg width="20" height="20" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':'')+'</button><div class="tn-main"'+open+'><div class="tn-text">'+esc(r.text)+'</div><span class="tn-chip'+(r.late?' late':'')+'">'+icon(ic,r.late?'#cf6d68':ICON_COLOR[ic])+'<span>'+chip+'</span></span>'+(!r.own&&!r.done?'<span class="tn-hint">点圆圈：'+esc(r.label)+'</span>':'')+'</div>'+picture(r.cat)+'</article>';}
 function tabs(){const item=(k,label,svg)=>'<button class="tn-tab'+(tab===k?' on':'')+'" onclick="TaskNotes.tab(\''+k+'\')">'+svg+'<span>'+label+'</span>'+(tab===k?'<i></i>':'')+'</button>',st='width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  return '<nav class="tn-tabbar">'+item('today','今日','<svg '+st+'><path d="M4 11 12 4.5 20 11v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"'+(tab==='today'?' fill="currentColor" fill-opacity=".9"':'')+'/><path d="M10 20.5v-5h4v5" stroke="'+(tab==='today'?'#fff':'currentColor')+'"/></svg>')
   +item('all','全部','<svg '+st+'><rect x="4.5" y="4.5" width="15" height="15" rx="4"'+(tab==='all'?' fill="currentColor"':'')+'/><path d="M9 10h6M9 14h6" stroke="'+(tab==='all'?'#fff':'currentColor')+'"/></svg>')
   +item('calendar','日历','<svg '+st+'><rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>')
   +item('me','我的','<svg '+st+'><path d="M5 9.5 6 4.5l4 3a8 8 0 0 1 4 0l4-3 1 5c.7 1.2 1 2.4 1 3.7C20 17.5 16.4 20 12 20s-8-2.5-8-6.8c0-1.3.3-2.5 1-3.7z"/><circle cx="9.5" cy="13" r=".9" fill="currentColor"/><circle cx="14.5" cy="13" r=".9" fill="currentColor"/></svg>')+'</nav>';}
 function settle(rows){const s=store(),key=dayKey(),st=dayStat(key);let changed=false;const burst=[];
  for(const r of rows){if(r.own||!r.done)continue;const mark=key+'|'+r.id;if(s.roleStarred[mark])continue;s.roleStarred[mark]=3;s.stars+=3;burst.push([r.id,3]);changed=true;}
  const done=rows.filter(r=>r.done).length;if(st.done!==done||st.total!==rows.length){st.done=done;st.total=rows.length;changed=true;}if(changed)save();if(burst.length)setTimeout(()=>burst.forEach(b=>celebrate(b[0],b[1])),60);}
 function celebrate(id,n){const card=[...document.querySelectorAll('.tn-card')].find(el=>el.getAttribute('data-id')===String(id));if(!card)return;card.classList.remove('pop');void card.offsetWidth;card.classList.add('pop');if(n>0){const star=document.createElement('span');star.className='tn-star';star.textContent='+'+n+' ★';card.appendChild(star);setTimeout(()=>star.remove(),1200);}}
 function todayPage(){const now=new Date(),week='日一二三四五六'[now.getDay()],rows=todayRows(),{c,t}=roleTasks();settle(rows);
  let roleAsk='';if(c&&!t)roleAsk='<button class="tn-ask" '+(typeof _taskBusy!=='undefined'&&_taskBusy?'disabled':'')+' onclick="genTasks()">'+icon('heart','#e78c9a')+'<span>'+(typeof _taskBusy!=='undefined'&&_taskBusy?esc(c.remark||c.name)+' 正在安排…':'让 '+esc(c.remark||c.name)+' 布置今天的任务')+'</span></button>';
  const list=rows.length?rows.map(card).join(''):'<div class="tn-empty">'+picture('other')+'<b>今天还没有小事</b><span>点下面的猫爪，加一件想做的事吧</span></div>';
  return '<header class="tn-head"><button class="tn-back" onclick="home()" aria-label="返回">‹</button><div class="tn-date">'+(now.getMonth()+1)+'月'+now.getDate()+'日&nbsp;&nbsp;星期'+week+' '+icon('paw','#f0aaa6')+'</div>'
   +'<h1 class="tn-title">今天的<span>小事<svg viewBox="0 0 120 14" preserveAspectRatio="none"><path d="M3 9c20-6 40 4 60-1s36-3 54-2" fill="none" stroke="#f2a7a7" stroke-width="5" stroke-linecap="round"/></svg></span><svg class="tn-heart" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="#f2a7a7" stroke-width="2"/></svg></h1>'
   +'<div class="tn-sub">慢慢来，也算前进</div><svg class="tn-wave" viewBox="0 0 60 12"><path d="M3 8c8-6 14 4 22-1s14-3 22-2" fill="none" stroke="#f2b0a8" stroke-width="3" stroke-linecap="round"/></svg>'
   +'<div class="tn-cal"><img src="'+IMG+'cat-on-calendar.png" alt=""><div class="tn-cal-card"><small>'+(now.getMonth()+1)+'月</small><b>'+now.getDate()+'</b><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="#f2a7a7"/></svg></div></div></header>'
   +'<section class="tn-list">'+roleAsk+list+'</section>';}
 const FILTERS=[['all','全部'],['today','今天'],['todo','待完成'],['late','已逾期'],['done','已完成']];let filter='all';
 function weekday(key){const [y,m,d]=key.split('-').map(Number),t=new Date(y,m-1,d);return (m)+'月'+d+'日&nbsp;&nbsp;星期'+'日一二三四五六'[t.getDay()];}
 function allRows(){const key=dayKey(),now=Date.now();let rows=store().items.filter(x=>x&&x.date).map(x=>ownRow(x,now,key)).concat(roleRows());
  rows=rows.filter(r=>filter==='all'||filter==='today'&&r.date===key||filter==='todo'&&!r.done&&!r.late||filter==='late'&&r.late||filter==='done'&&r.done);return rows;}
 function allPage(){const key=dayKey(),rows=allRows(),days=[...new Set(rows.map(r=>r.date))];
  // Today first, then the days ahead, then earlier days (newest first).
  days.sort((a,b)=>{const ga=a===key?0:a>key?1:2,gb=b===key?0:b>key?1:2;return ga-gb||(ga===2?b.localeCompare(a):a.localeCompare(b));});
  const groups=days.map(d=>{const list=rows.filter(r=>r.date===d).sort((a,b)=>(a.done-b.done)||String(a.time||'99:99').localeCompare(String(b.time||'99:99')));return '<div class="tn-day">'+weekday(d)+(d===key?'<em>今天</em>':'')+' '+icon('paw','#f0aaa6')+'</div>'+list.map(card).join('');}).join('');
  const empty={all:'还没有记下的小事，点猫爪加一件吧',today:'今天还没有小事',todo:'没有待完成的小事，真棒',late:'没有逾期的小事',done:'还没有完成的小事'}[filter];
  return '<header class="tn-head tn-head-all"><button class="tn-back" onclick="home()" aria-label="返回">‹</button>'
   +'<h1 class="tn-title">全部<span>任务<svg viewBox="0 0 120 14" preserveAspectRatio="none"><path d="M3 9c20-6 40 4 60-1s36-3 54-2" fill="none" stroke="#f2a7a7" stroke-width="5" stroke-linecap="round"/></svg></span><svg class="tn-heart" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="#f2a7a7" stroke-width="2"/></svg></h1>'
   +'<div class="tn-sub">每件小事，都有好好记住</div><svg class="tn-wave" viewBox="0 0 60 12"><path d="M3 8c8-6 14 4 22-1s14-3 22-2" fill="none" stroke="#f2b0a8" stroke-width="3" stroke-linecap="round"/></svg>'
   +'<img class="tn-head-art" src="'+IMG+'cat-box.png" alt=""></header>'
   +'<nav class="tn-filters">'+FILTERS.map(([k,l])=>'<button class="'+(filter===k?'on':'')+'" onclick="TaskNotes.filter(\''+k+'\')">'+l+'</button>').join('')+'</nav>'
   +'<section class="tn-list">'+(groups||'<div class="tn-empty"><b>'+empty+'</b></div>')+'</section>';}
 function soonPage(title){return '<header class="tn-head tn-head-plain"><button class="tn-back" onclick="TaskNotes.tab(\'today\')" aria-label="返回">‹</button><h1 class="tn-title">'+title+'</h1><div class="tn-sub">这一页正在做，很快就好</div></header>';}
 const CSS='<style>#tn-page{position:absolute;inset:0;overflow:hidden;background:#f9f6f1;color:#3f3832;font-family:-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif}#tn-page .tn-scroll{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:150px;background:radial-gradient(circle at 15% 85%,rgba(226,214,200,.35),transparent 30%),radial-gradient(circle at 85% 92%,rgba(226,214,200,.3),transparent 28%),#f9f6f1}'
  +'.tn-bg{position:absolute;left:-10px;right:-10px;bottom:70px;width:calc(100% + 20px);opacity:.28;pointer-events:none;z-index:0}#tn-page .tn-scroll{z-index:1}.tn-head{position:relative;padding:calc(env(safe-area-inset-top,0px) + 34px) 22px 8px;min-height:190px}.tn-head-plain{min-height:0}.tn-back{position:absolute;left:10px;top:calc(env(safe-area-inset-top,0px) + 6px);width:30px;height:30px;border:0;border-radius:50%;background:rgba(255,255,255,.65);color:#8a7a6c;font-size:22px;line-height:28px;padding:0}'
  +'.tn-date{display:flex;align-items:center;gap:6px;font-size:15px;color:#5b5047;letter-spacing:.5px}.tn-title{position:relative;margin:12px 0 0;font-size:35px;font-weight:900;letter-spacing:1px;color:#3b342e;display:inline-flex;align-items:center}.tn-title span{position:relative}.tn-title span svg{position:absolute;left:-2px;right:-4px;bottom:-6px;width:calc(100% + 6px);height:12px}.tn-heart{width:22px;height:22px;margin-left:4px;transform:translateY(-4px) rotate(12deg)}'
  +'.tn-sub{margin-top:12px;font-size:15.5px;letter-spacing:4px;color:#665b52}.tn-wave{display:block;width:44px;height:10px;margin:6px 0 0 30px}'
  +'.tn-cal{position:absolute;right:16px;top:calc(env(safe-area-inset-top,0px) + 18px);width:148px}.tn-cal img{position:relative;z-index:2;display:block;width:150px;margin:0 0 0 2px}.tn-cal-card{position:relative;z-index:1;margin:-24px 14px 0 18px;height:112px;border-radius:16px;background:linear-gradient(180deg,#fdf8ee,#f7eedd);box-shadow:0 8px 18px rgba(150,120,90,.18),inset 0 -3px 0 rgba(210,190,160,.35);text-align:center;padding-top:34px}.tn-cal-card small{display:block;font-size:13px;color:#4c443d}.tn-cal-card b{display:block;font-size:40px;line-height:1;font-weight:900;color:#3b342e;margin-top:2px}.tn-cal-card svg{position:absolute;right:12px;bottom:14px;width:14px;height:14px}'
  +'.tn-list{padding:6px 18px 0}.tn-card{position:relative;display:flex;align-items:center;gap:14px;min-height:112px;margin:0 0 14px;padding:16px 10px 16px 20px;border-radius:26px;background:var(--tn-bg);box-shadow:0 7px 16px rgba(170,140,115,.13),inset 0 1px 0 rgba(255,255,255,.7)}.tn-check{flex:0 0 auto;width:36px;height:36px;border-radius:50%;border:2.2px solid #cbb8b3;background:rgba(255,255,255,.45);padding:0;display:flex;align-items:center;justify-content:center}'
  +'.tn-main{flex:1;min-width:0}.tn-text{font-size:19px;font-weight:800;color:#3a332d;line-height:1.35;word-break:break-word}.tn-chip{display:inline-flex;align-items:center;gap:6px;margin-top:9px;padding:4px 12px 4px 9px;border-radius:14px;background:var(--tn-chip);font-size:14px;color:#5d5249}.tn-hint{display:block;margin-top:6px;font-size:11px;color:#a08f82}.tn-chip.late{background:#fbd9d5;color:#c4625d}.tn-card.pop .tn-check{animation:tnPop .45s ease}@keyframes tnPop{0%{transform:scale(1)}40%{transform:scale(1.28)}100%{transform:scale(1)}}.tn-star{position:absolute;left:30px;top:16px;z-index:3;color:#f2b33d;font-size:17px;font-weight:800;text-shadow:0 1px 0 #fff;pointer-events:none;animation:tnStar 1.1s ease-out forwards}@keyframes tnStar{0%{opacity:0;transform:translateY(8px) scale(.7)}20%{opacity:1;transform:translateY(0) scale(1.1)}100%{opacity:0;transform:translateY(-42px) scale(1)}}.tn-art{flex:0 0 auto;width:108px;height:88px;object-fit:contain;filter:drop-shadow(0 3px 4px rgba(150,115,90,.12))}'
  +'.tn-card.done{background:#eceae7}.tn-card.done .tn-check{background:#9b9693;border-color:#9b9693}.tn-card.done .tn-text{color:#a19c98;text-decoration:line-through}.tn-card.done .tn-chip{background:#e2dfdb;color:#a19c98}.tn-card.done .tn-art{filter:grayscale(.75);opacity:.75}'
  +'.tn-ask{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin:0 0 14px;padding:13px;border:1.5px dashed #ecc4bf;border-radius:20px;background:rgba(255,255,255,.55);color:#b07a78;font-size:14px}.tn-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:26px 10px;color:#8e8076;font-size:13px}.tn-empty .tn-art{width:150px;height:110px}.tn-empty b{font-size:17px;color:#5b5047}'
  +'.tn-fab{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);z-index:5;width:86px;height:86px;margin-left:-43px;border:0;border-radius:50%;background:radial-gradient(circle at 40% 30%,#f6b9b5,#ec9b98 70%);box-shadow:0 10px 22px rgba(225,130,125,.35),inset 0 -4px 0 rgba(200,100,100,.15)}.tn-fab i{position:absolute;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(200,100,100,.18)}.tn-fab i.s{width:13px;height:14px}.tn-fab i.l{width:17px;height:19px}.tn-fab b{position:absolute;left:50%;top:62%;transform:translate(-50%,-50%);color:#fff;font-size:44px;font-weight:300;line-height:1}'
  +'.tn-tabbar{position:absolute;left:0;right:0;bottom:0;z-index:4;display:flex;justify-content:space-around;padding:14px 8px calc(env(safe-area-inset-bottom,0px) + 10px);border-radius:28px 28px 0 0;background:#fbf7f1;box-shadow:0 -6px 18px rgba(160,130,110,.1)}.tn-tab{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;color:#7c6f66;font-size:12.5px;padding:0 12px}.tn-tab.on{color:#ec8b8c}.tn-tab i{width:5px;height:5px;border-radius:50%;background:#ec8b8c;margin-top:1px}'
  +'.tn-form label{display:block;margin:12px 0 6px;font-size:13px;color:#8a7a6c}.tn-head-all{min-height:178px}.tn-head-art{position:absolute;right:12px;top:calc(env(safe-area-inset-top,0px) + 30px);width:132px}.tn-filters{display:flex;gap:7px;padding:4px 16px 6px}.tn-filters::-webkit-scrollbar{display:none}.tn-filters button{flex:1 1 0;min-width:0;padding:9px 0;border:0;border-radius:20px;background:#fdf6f0;color:#5e544c;font-size:14.5px;white-space:nowrap;box-shadow:0 3px 8px rgba(170,140,115,.12)}.tn-filters button.on{background:linear-gradient(135deg,#f0a7a8,#e99597);color:#fff;font-weight:700;box-shadow:0 5px 12px rgba(225,130,125,.3)}.tn-day{display:flex;align-items:center;gap:6px;margin:14px 4px 10px;font-size:15px;color:#5b5047}.tn-day em{font-style:normal;font-size:11px;padding:2px 8px;border-radius:10px;background:#fde4e2;color:#d27a79}.tn-form input{display:block;width:100%;max-width:100%;min-width:0;-webkit-appearance:none;appearance:none;text-align:left;min-height:44px;box-sizing:border-box;padding:11px 12px;border:1px solid #eadfd6;border-radius:12px;background:#fffaf5;color:#3f3832;font-size:15px}.tn-form input::-webkit-date-and-time-value{text-align:left}.tn-form input:focus{outline:none;border-color:#f0a7a8;box-shadow:0 0 0 3px rgba(240,167,168,.22)}.tn-cats{display:flex;flex-wrap:wrap;gap:8px}.tn-cats button{padding:7px 12px;border-radius:14px;border:1px solid #eadfd6;background:#fffaf5;color:#6b5f56;font-size:13px}.tn-cats button.on{background:#f3b0ad;border-color:#f3b0ad;color:#fff}</style>';
 const SHEET_CSS='<style>#modalSheet:has(.tn-form){background:#fbf6ef;color:#3f3832;border:1px solid #eee2d6;box-shadow:0 18px 40px rgba(120,90,70,.25)}#modalSheet:has(.tn-form) h3{color:#3b342e;font-weight:800}#modalSheet:has(.tn-form) .btn.p{background:linear-gradient(135deg,#f5b3b0,#ec9592);color:#fff;box-shadow:0 6px 14px rgba(225,130,125,.3)}#modalSheet:has(.tn-form) .btn.g{background:#f1e8df;color:#7a6b60}.tn-sheet-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}.tn-sheet-head h3{margin:0}.tn-close{flex:0 0 auto;width:30px;height:30px;border-radius:50%;border:1.5px solid #f3c2bf;background:#fff4f2;padding:0;display:flex;align-items:center;justify-content:center}.tn-del{display:block;width:100%;margin-top:10px;border:0;background:none;color:#c28b88;font-size:13px;padding:6px}</style>';
 renderTasks=function(){const s=store();void s;if(tab==='today')paintedSig=rowSig();const body=tab==='today'?todayPage():tab==='all'?allPage():soonPage({all:'全部任务',calendar:'日历',me:'我的小事簿'}[tab]||'');
  return '<div id="tn-page">'+CSS+'<img class="tn-bg" src="'+IMG+'cat-bg.png" alt="">'+'<div class="tn-scroll" data-render-scroll-key="tasks:'+tab+'">'+body+'</div>'+(tab==='today'||tab==='all'?'<button class="tn-fab" onclick="TaskNotes.add()" aria-label="添加任务"><i class="s" style="left:13px;top:24px;transform:rotate(-24deg)"></i><i class="l" style="left:25px;top:10px;transform:rotate(-10deg)"></i><i class="l" style="left:44px;top:10px;transform:rotate(10deg)"></i><i class="s" style="left:60px;top:24px;transform:rotate(24deg)"></i><b>+</b></button>':'')+tabs()+'</div>';};
 let draftCat='other';
 function form(x){draftCat=x&&CATS[x.cat]?x.cat:'other';const cats=Object.keys(CATS).map(k=>'<button type="button" class="'+(k===draftCat?'on':'')+'" data-cat="'+k+'" onclick="TaskNotes.pick(\''+k+'\')">'+CATS[k].label+'</button>').join('');
  openModal(SHEET_CSS+'<div class="tn-sheet-head"><h3>'+(x?'修改这件小事':'加一件小事')+'</h3><button class="tn-close" aria-label="取消" onclick="closeModal()"><svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="#ee8f8c" stroke-width="3" stroke-linecap="round"/></svg></button></div><div class="tn-form"><label for="tn_text">要做什么</label><input id="tn_text" maxlength="40" placeholder="比如：喝一杯水" value="'+attr(x&&x.text)+'"><label for="tn_date">哪一天</label><input id="tn_date" type="date" min="'+dayKey()+'" value="'+attr(x&&x.date||dayKey())+'"><label for="tn_time">什么时候（可不填）</label><input id="tn_time" type="time" value="'+attr(x&&x.time||'')+'"><label>类型（决定卡片的颜色和小猫）</label><div class="tn-cats" id="tn_cats">'+cats+'</div></div><button class="btn p" style="margin-top:16px" onclick="TaskNotes.save(\''+(x?x.id:'')+'\')">保存</button>'+(x?'<button class="tn-del" onclick="TaskNotes.remove(\''+x.id+'\')">删除这件小事</button>':''));}
 const api={
  tab(k){tab=['today','all','calendar','me'].includes(k)?k:'today';render();},
  filter(k){filter=FILTERS.some(f=>f[0]===k)?k:'all';render();},
  add(){form(null);setTimeout(()=>{const el=document.getElementById('tn_text');if(el)el.focus();},60);},
  edit(id){const x=store().items.find(i=>i.id===id);if(x)form(x);},
  pick(k){draftCat=CATS[k]?k:'other';document.querySelectorAll('#tn_cats button').forEach(b=>b.classList.toggle('on',b.getAttribute('data-cat')===draftCat));},
  save(id){syncSoon();const text=String((document.getElementById('tn_text')||{}).value||'').trim().slice(0,40),time=String((document.getElementById('tn_time')||{}).value||''),picked=String((document.getElementById('tn_date')||{}).value||''),date=/^\d{4}-\d{2}-\d{2}$/.test(picked)?picked:dayKey();if(!text){toast('先写一下要做什么');return;}const s=store();let x=id&&s.items.find(i=>i.id===id);if(x){if(x.date!==date||x.time!==time){x.reminded=false;x.nudgeChecked=false;x.lineDelivered=false;}Object.assign(x,{text,time,cat:draftCat,date});}else{x={id:uid(),text,time,cat:draftCat,date,done:false,createdAt:Date.now()};s.items.push(x);}save();closeModal();render();syncSoon();writeLine(x);},
  remove(id){const s=store();s.items=s.items.filter(i=>i.id!==id);save();closeModal();render();syncReminders();},
  toggle(id){const s=store(),x=s.items.find(i=>i.id===id);if(!x)return;x.done=!x.done;x.doneAt=x.done?Date.now():0;let gained=0;const st=dayStat(x.date);
   if(x.done&&!x.star&&x.date===dayKey()&&st.ownStars<5){x.star=1;st.ownStars++;s.stars++;gained=1;}else if(!x.done&&x.star){s.stars=Math.max(0,s.stars-x.star);st.ownStars=Math.max(0,st.ownStars-x.star);x.star=0;}
   save();render();if(x.done){setTimeout(()=>celebrate(id,gained),40);praise(x);}syncReminders();},
  roleDone(id){if(typeof completeTask==='function')completeTask(id);},
  rows:todayRows,
  prune,
  writeLine:id=>writeLine(store().items.find(i=>i.id===id)),
  deliverDue,
  reminders:()=>reminderRows(),
  syncReminders:()=>syncReminders(),
  stars:()=>store().stars,
  cats:CATS
 };
 // The bound role knows the owner's own list for today, and only mentions it now and then.
 function role(){try{const c=S.couple&&getC(S.couple.cid);return c&&!c.deleted&&!c.blocked?c:null;}catch(_){return null;}}
 const systemCore=buildSystem;
 buildSystem=function(c,opt){const base=systemCore(c,opt);try{if(!c||!S.couple||S.couple.cid!==c.id)return base;const key=dayKey(),rows=store().items.filter(x=>x&&x.date===key);if(!rows.length)return base;const who=S.me&&S.me.name||'对方';
  return base+'\n\n# '+who+'今天自己记的小事（任务便签）\n'+rows.slice(0,12).map(x=>'· '+(x.time?x.time+' ':'')+x.text+'：'+(x.done?'已完成':atOf(x)&&Date.now()>atOf(x)?'过了时间还没做':'还没做')).join('\n')+'\n这是'+who+'自己写给自己的待办，不是你布置的任务。你知道就好，可以偶尔自然地关心或夸一句，不要每次都提，也不要把没做的说成做了。';}catch(_){return base;}};
 function note(kind,text){const c=role();if(!c||typeof scheduleFeatureReply!=='function'||typeof featureEventNote!=='function')return false;scheduleFeatureReply(c.id,featureEventNote(kind,text));return true;}
 function praise(x){const c=role(),st=dayStat(dayKey());if(!c||x.date!==dayKey()||st.praise>=3||Math.random()>=.4)return;st.praise++;save();const who=S.me&&S.me.name||'对方';note('任务便签完成',who+'刚刚在任务便签里完成了自己记的小事「'+x.text+'」。按你的人设自然回应一句，可以夸也可以逗，一两句就好，不要说教。');}
 function nudge(){const c=role();if(!c||document.hidden)return;const key=dayKey(),st=dayStat(key),now=Date.now();if(st.nudge>=2)return;
  for(const x of store().items){if(!x||x.date!==key||x.done||x.nudgeChecked)continue;const at=atOf(x);if(!at||now<at+10*60e3||now>at+90*60e3)continue;x.nudgeChecked=true;if(Math.random()<.5){st.nudge++;const who=S.me&&S.me.name||'对方';note('任务便签提醒',who+'在任务便签里记的小事「'+x.text+'」定在 '+x.time+'，现在过了还没完成。按你的人设自然提醒一句，不要催得太凶。');}save();break;}}
 // A banner at the task's time: native while the app is closed, an in-page notice while it is open.
 // The role writes its reminder when the task is saved and nobody sees it until the time comes.
 // Without a line (no role, no network, a model error) the reminder is a plain notice instead.
 const lineSig=(x,c)=>[x.text,x.date,x.time,c&&c.id||''].join('|');
 function lineFor(x,c){return c&&x&&x.roleLine&&x.lineFor===lineSig(x,c)?x.roleLine:'';}
 const writing=new Set();
 async function writeLine(x){const c=role();if(!c||!x||x.done||!atOf(x)||atOf(x)<=Date.now()+60e3||typeof chatAPI!=='function')return false;const sig=lineSig(x,c);if(lineFor(x,c)||writing.has(x.id)||x.lineTried===sig)return false;writing.add(x.id);x.lineTried=sig;
  try{const who=S.me&&S.me.name||'对方',[y,m,d]=x.date.split('-').map(Number),day=x.date===dayKey()?'今天':x.date===dayKey(Date.now()+86400e3)?'明天':m+'月'+d+'日';
   const rows=[{role:'system',content:buildSystem(c,{natural:typeof wechatNaturalOn==='function'&&wechatNaturalOn()})},{role:'user',content:who+'在任务便签里记了一件小事：「'+x.text+'」，定在'+day+' '+x.time+'。到那个时间你会给'+who+'发一句微信提醒。按你的人设和你们的关系，现在先把这句话写好：一到两句，口语，像你平时会发的消息。不要提系统、提醒功能或任务便签，不写动作标签；只输出这句话。'}];
   // First the role's own route; if that fails or comes back empty, one more try on the auxiliary model.
   let raw='';for(const aux of [c.model==='aux',true]){try{raw=await chatAPI(rows,{routeIndex:typeof roleChatRouteIndex==='function'?roleChatRouteIndex(c):undefined,aux,independentRoleModel:!aux||c.model==='aux',allowSessionModel:true,allowWechatThought:false,max:220,diagnosticRoleId:c.id,roleInterceptStage:'任务便签提醒'});}catch(_){raw='';}if(String(raw||'').replace(/<(think|analysis|reasoning)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi,'').replace(/[\[【][^\]】]*[\]】]/g,'').trim())break;}
   const line=String(raw||'').replace(/<(think|analysis|reasoning)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi,'').replace(/[\[【][^\]】]*[\]】]/g,'').split('\n').map(t=>t.trim()).filter(Boolean).slice(0,2).join(' ').replace(/^["“「]+|["”」]+$/g,'').slice(0,120);
   const now=store().items.find(i=>i.id===x.id);if(!line||!now||now.done||lineSig(now,role())!==sig)return false;now.roleLine=line;now.lineFor=sig;save();syncReminders();return true;
  }catch(_){return false;}finally{writing.delete(x.id);}}
 function reminderRows(){const key=dayKey(),c=role(),now=Date.now();return store().items.filter(x=>x&&!x.done&&x.date>=key&&atOf(x)>now).map(x=>{const line=lineFor(x,c);return{id:x.id,at:atOf(x),title:line?(c.remark||c.name):'任务便签',body:line||'到时间啦：'+x.text};});}
 // Once the time has come the line also lands in the chat at that moment (on next open if the app was closed).
 function deliverDue(){const c=role(),now=Date.now();if(!c||typeof msgs!=='function')return false;let changed=false,shown=null;
  for(const x of store().items){if(!x||x.lineDelivered)continue;const line=lineFor(x,c),at=atOf(x);if(!line||!at||now<at)continue;x.lineDelivered=true;changed=true;if(x.done&&(+x.doneAt||0)<=at||now-at>36*3600e3)continue;
   const list=msgs(c.id),msg={role:'assistant',type:'text',content:line,time:at,id:'tasknote_'+x.id+'_'+at,_taskReminder:true};let i=list.length;while(i>0&&(+list[i-1].time||0)>at)i--;list.splice(i,0,msg);if(now-at<5*60e3)shown=msg;}
  if(changed){save();try{if(cur().p==='chat'&&cur().id===c.id&&typeof refreshChatMessages==='function')refreshChatMessages(c.id);}catch(_){}if(shown){if(typeof showMsgBanner==='function'&&!(cur().p==='chat'&&cur().id===c.id))showMsgBanner(c,shown);}}return changed;}
 function catchUpLines(){const key=dayKey();store().items.filter(x=>x&&!x.done&&x.date>=key).slice(0,10).forEach(x=>writeLine(x));}
 let syncTimer=0;
 function syncReminders(){try{if(typeof privateNativeAppOn==='function'&&privateNativeAppOn()&&window.SmallPhoneNative)window.SmallPhoneNative.request('tasknotes.reminders',{items:reminderRows()}).catch(()=>{});}catch(_){}}
 function syncSoon(){clearTimeout(syncTimer);syncTimer=setTimeout(syncReminders,400);}
 function tick(){if(typeof S==='undefined'||!S||document.hidden)return;if(prune())save();const key=dayKey(),now=Date.now();let changed=false;
  deliverDue();const c=role();for(const x of store().items){if(!x||x.date!==key||x.done||x.reminded)continue;const at=atOf(x);if(at&&now>=at&&now-at<5*60e3){x.reminded=true;changed=true;if(!lineFor(x,c))toast('到时间啦：'+x.text);}}
  if(changed)save();nudge();if(cur().p==='tasks'&&tab==='today'&&!document.querySelector('.modal.show')&&rowSig()!==paintedSig)render();}
 function rowSig(){return todayRows().map(r=>r.id+(r.late?'L':'')+(r.done?'D':'')).join(',');}
 let paintedSig='';
 setInterval(tick,30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){setTimeout(tick,600);syncSoon();}});
 setTimeout(()=>{if(typeof S!=='undefined'&&S){if(prune())save();deliverDue();syncReminders();setTimeout(catchUpLines,4000);}},2500);
 window.TaskNotes=api;
})();
