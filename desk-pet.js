/* 桌面小机器人：像素风桌宠，绑定一个角色，跟着ta的心情 / 作息变化。
   持久状态只在 S.settings.deskPet 下：{on,cid,size,color,x,y}。 */
(function(){
'use strict';
const DP_SIZES={s:3,m:4,l:5};
const DP_COLORS={clay:['#d97757','#b8603f'],pink:['#f08aa8','#cf6286'],mint:['#6cc6a8','#4a9f84'],milk:['#efe3d0','#cbb999'],sky:['#78a8e8','#5584c4']};
const DP_COLOR_NAMES={clay:'陶土橙',pink:'草莓粉',mint:'薄荷绿',milk:'奶油白',sky:'天空蓝'};
const VB_W=16,VB_H=18,VB_Y=-5;
let root=null,svg=null,bubble=null,state={x:-1,y:-1,face:1,rot:0,mode:'idle',mood:'idle',act:'',tx:0,ty:0,moving:false,climb:0,until:0,react:'',reactUntil:0},
  raf=0,last=0,legT=0,legB=false,blinkAt=0,nextActAt=0,fxAt=0,moodAt=0,drag=null,taps=[],pressTimer=0,bubbleTimer=0;

function cfg(){if(typeof S==='undefined'||!S||!S.settings)return null;return S.settings.deskPet||null;}
function role(){const c=cfg();if(!c||!c.on||!c.cid||typeof getC!=='function')return null;const r=getC(c.cid);return r&&!r.deleted?r:null;}
function host(){return document.querySelector('.phone')||document.body;}
function scale(){const c=cfg();return DP_SIZES[c&&c.size]||DP_SIZES.m;}
function dims(){const k=scale();return{w:VB_W*k,h:VB_H*k};}
function bounds(){const h=host(),d=dims();return{w:Math.max(80,(h.clientWidth||window.innerWidth)-d.w),h:Math.max(80,(h.clientHeight||window.innerHeight)-d.h)};}
function rname(c){return c?(c.remark||c.name||'ta'):'ta';}
function persist(){const c=cfg();if(!c)return;c.x=Math.round(state.x);c.y=Math.round(state.y);if(typeof save==='function')save(800);}

/* ---------- 像素画 ---------- */
const R=(x,y,w,h,cls,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}"${cls?` class="${cls}"`:''}${fill?` fill="${fill}"`:''}/>`;
function spriteSVG(){
  const legs=(h,cls)=>`<g class="${cls}">${[3,5,10,12].map((x,i)=>R(x,8,1,typeof h==='function'?h(i):h,'dp-leg','var(--dp-d)')).join('')}</g>`;
  return `<svg class="dp-svg" viewBox="0 ${VB_Y} ${VB_W} ${VB_H}" shape-rendering="crispEdges" aria-hidden="true">
  <g class="dp-skate">${R(1,11,14,1,'','#4b3a5a')}${R(3,12,1,1,'','#f3c14b')}${R(12,12,1,1,'','#f3c14b')}</g>
  <g class="dp-body">
    ${legs(3,'dp-legs-a')}${legs(i=>i%2?3:2,'dp-legs-b')}${legs(1,'dp-legs-sit')}
    ${R(2,1,12,7,'','var(--dp-c)')}${R(2,7,12,1,'','var(--dp-d)')}
    <g class="dp-nub-l">${R(0,4,2,2,'','var(--dp-c)')}</g>
    <g class="dp-nub-r">${R(14,4,2,2,'','var(--dp-c)')}</g>
    <g class="dp-eyes">
      <g class="e-open">${R(4,4,1,2,'','#1b1311')}${R(11,4,1,2,'','#1b1311')}</g>
      <g class="e-closed">${R(3,5,2,1,'','#1b1311')}${R(11,5,2,1,'','#1b1311')}</g>
      <g class="e-happy">${R(3,5,1,1,'','#1b1311')}${R(4,4,1,1,'','#1b1311')}${R(5,5,1,1,'','#1b1311')}${R(11,5,1,1,'','#1b1311')}${R(12,4,1,1,'','#1b1311')}${R(13,5,1,1,'','#1b1311')}</g>
      <g class="e-wide">${R(4,4,2,2,'','#1b1311')}${R(10,4,2,2,'','#1b1311')}${R(4,4,1,1,'','#fff')}${R(10,4,1,1,'','#fff')}</g>
      <g class="e-angry">${R(4,4,1,2,'','#1b1311')}${R(11,4,1,2,'','#1b1311')}${R(3,2,1,1,'','#1b1311')}${R(4,3,1,1,'','#1b1311')}${R(12,2,1,1,'','#1b1311')}${R(11,3,1,1,'','#1b1311')}</g>
      <g class="e-sad">${R(3,4,3,1,'','#1b1311')}${R(4,5,1,1,'','#1b1311')}${R(10,4,3,1,'','#1b1311')}${R(11,5,1,1,'','#1b1311')}</g>
    </g>
    <g class="dp-tear">${R(4,6,1,1,'','#7cc4ff')}${R(11,6,1,1,'','#7cc4ff')}</g>
    <g class="dp-blush">${R(2,6,2,1,'','#ff9fb5')}${R(12,6,2,1,'','#ff9fb5')}</g>
    <g class="dp-hat dp-hat-work">${R(4,-2,8,1,'','#f2b632')}${R(3,-1,10,2,'','#f2b632')}${R(1,0,14,1,'','#d9971c')}${R(7,-2,2,2,'','#fff3c4')}</g>
    <g class="dp-hat dp-hat-sleep">${R(4,0,8,1,'','#6d7fd6')}${R(5,-1,6,1,'','#6d7fd6')}${R(7,-2,5,1,'','#6d7fd6')}${R(10,-3,3,1,'','#6d7fd6')}${R(13,-4,2,2,'','#fff')}${R(4,0,8,1,'dp-hat-band','#fff')}</g>
    <g class="dp-hat dp-hat-party">${R(4,0,8,1,'','#ff7aa8')}${R(5,-1,6,1,'','#ffd34e')}${R(6,-2,4,1,'','#ff7aa8')}${R(7,-3,2,1,'','#ffd34e')}${R(7,-5,2,2,'','#7ad7ff')}</g>
    <g class="dp-hat dp-hat-music">${R(3,-2,10,1,'','#3b5ba5')}${R(2,-1,1,2,'','#3b5ba5')}${R(13,-1,1,2,'','#3b5ba5')}${R(1,1,2,3,'','#2d4787')}${R(13,1,2,3,'','#2d4787')}</g>
    <g class="dp-keys">${R(0,8,16,3,'','#3a3d46')}${[1,3,5,7,9,11,13].map(x=>R(x,9,1,1,'dp-key','#cfd3dc')).join('')}</g>
  </g></svg>`;
}

function css(){if(document.getElementById('dpStyle'))return;const st=document.createElement('style');st.id='dpStyle';st.textContent=`
.dp-root{position:absolute;left:0;top:0;z-index:180;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;will-change:transform;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25))}
.dp-root.hidden{display:none}
.dp-flip{transform-origin:50% 100%;transition:transform .18s}
.dp-svg{display:block;width:100%;height:100%;overflow:visible}
.dp-svg g{transform-box:fill-box}
.dp-legs-b,.dp-legs-sit,.dp-tear,.dp-blush,.dp-hat,.dp-keys,.dp-skate,.dp-eyes>g{display:none}
.dp-root[data-eyes=open] .e-open,.dp-root[data-eyes=closed] .e-closed,.dp-root[data-eyes=happy] .e-happy,.dp-root[data-eyes=wide] .e-wide,.dp-root[data-eyes=angry] .e-angry,.dp-root[data-eyes=sad] .e-sad{display:inline}
.dp-root.leg-b .dp-legs-a{display:none}.dp-root.leg-b .dp-legs-b{display:inline}
.dp-root.sit .dp-legs-a,.dp-root.sit .dp-legs-b{display:none}.dp-root.sit .dp-legs-sit{display:inline}.dp-root.sit .dp-body{transform:translateY(2px)}
.dp-root[data-hat=work] .dp-hat-work,.dp-root[data-hat=sleep] .dp-hat-sleep,.dp-root[data-hat=party] .dp-hat-party,.dp-root[data-hat=music] .dp-hat-music{display:inline}
.dp-root.tear .dp-tear{display:inline;animation:dpTear 1.4s infinite}
.dp-root.blush .dp-blush{display:inline}
.dp-root.keys .dp-keys{display:inline}.dp-root.keys .dp-key{animation:dpKey .5s steps(1) infinite}.dp-root.keys .dp-key:nth-child(odd){animation-delay:.25s}
.dp-root.skate .dp-skate{display:inline}
.dp-root .dp-body{transform-origin:50% 100%}
.dp-root.breathe .dp-body{animation:dpBreathe 2.4s ease-in-out infinite}
.dp-root.bob .dp-body{animation:dpBob .5s ease-in-out infinite}
.dp-root.walking .dp-body{animation:dpWalk .3s ease-in-out infinite}
.dp-root.shake .dp-body{animation:dpShake .32s linear infinite}
.dp-root.droop .dp-body{transform:scaleY(.9)}
.dp-root.dance .dp-body{animation:dpDance .6s ease-in-out infinite}
.dp-root.jump .dp-body{animation:dpJump .55s cubic-bezier(.3,.7,.4,1)}
.dp-root.spin .dp-body{animation:dpSpin .7s ease-in-out}
.dp-root.stretch .dp-body{animation:dpStretch 1.6s ease-in-out}
.dp-root.dangle .dp-leg{animation:dpDangle .35s ease-in-out infinite alternate;transform-origin:50% 0}
.dp-root.dangle .dp-legs-a .dp-leg:nth-child(even){animation-delay:.17s}
.dp-root.wave .dp-nub-r{animation:dpWave .4s steps(1) infinite}
.dp-root.look-l .dp-eyes{transform:translateX(-1px)}.dp-root.look-r .dp-eyes{transform:translateX(1px)}
.dp-root.land .dp-body{animation:dpLand .35s ease-out}
.dp-fx{position:absolute;z-index:181;pointer-events:none;font:700 15px/1 -apple-system,system-ui,sans-serif;animation:dpFx 1.6s ease-out forwards;text-shadow:0 1px 2px rgba(0,0,0,.25)}
.dp-bubble{position:absolute;z-index:182;max-width:190px;padding:7px 10px;border-radius:12px;background:rgba(255,255,255,.96);color:#3a2a25;font:500 12px/1.4 -apple-system,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.22);pointer-events:auto;cursor:pointer;opacity:0;transform:translateY(4px);transition:opacity .2s,transform .2s}
.dp-bubble.show{opacity:1;transform:none}
.dp-bubble small{display:block;margin-top:2px;color:#b07a6a;font-size:10px}
@keyframes dpBreathe{50%{transform:scaleY(.95) scaleX(1.02)}}
@keyframes dpBob{50%{transform:translateY(-1px) rotate(-3deg)}}
@keyframes dpWalk{50%{transform:translateY(-1.5px)}}
@keyframes dpShake{25%{transform:translateX(-1.5px)}75%{transform:translateX(1.5px)}}
@keyframes dpDance{25%{transform:rotate(-9deg) translateY(-2px)}75%{transform:rotate(9deg) translateY(-2px)}}
@keyframes dpJump{40%{transform:translateY(-16px) scaleY(1.06)}80%{transform:translateY(0) scaleY(.88)}}
@keyframes dpSpin{to{transform:rotateY(360deg)}}
@keyframes dpStretch{30%{transform:scaleX(1.18) scaleY(.85)}60%{transform:scaleX(.9) scaleY(1.1)}}
@keyframes dpDangle{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}
@keyframes dpWave{50%{transform:translateY(-2px)}}
@keyframes dpLand{30%{transform:scaleY(.8) scaleX(1.12)}}
@keyframes dpTear{0%{transform:translateY(0);opacity:1}100%{transform:translateY(4px);opacity:0}}
@keyframes dpKey{50%{fill:#ffb27a}}
@keyframes dpFx{0%{opacity:0;transform:translateY(0) scale(.6)}15%{opacity:1;transform:translateY(-6px) scale(1)}100%{opacity:0;transform:translateY(-38px) scale(1.05)}}
`;document.head.appendChild(st);}

/* ---------- 角色心情 → 机器人状态 ---------- */
function lastRoleText(c){try{const ms=typeof msgs==='function'?(msgs(c.id)||[]):[];for(let i=ms.length-1,n=0;i>=0&&n<12;i--,n++){const m=ms[i];if(m&&m.role==='assistant'&&typeof m.content==='string'){if(Date.now()-(+m.time||+m.ts||0)>45*60000)return'';return m.content;}}}catch(_){}return'';}
function moodOf(c){
  if(!c)return'idle';
  if(c.blocked)return'sad';
  let spec=null;try{if(c.sched&&c.sched.on&&typeof activitySpec==='function')spec=activitySpec(c);}catch(_){}
  if(spec&&/sleep$/.test(spec.key)&&spec.busy>=3)return'sleep';
  try{if(S.music&&S.music.session&&S.music.session.cid===c.id)return'music';}catch(_){}
  const text=[c.innerThought,c.mood,lastRoleText(c)].filter(x=>typeof x==='string').join(' ').slice(-400);
  if(/生气|气死|火大|不爽|恼火|烦死|哼|吃醋|醋意|不高兴/.test(text))return'angry';
  if(/难过|委屈|伤心|失落|想哭|哭了|低落|孤单|寂寞|不安|心酸|失望/.test(text))return'sad';
  if(/想你|爱你|喜欢你|心动|害羞|脸红|抱抱|亲亲|宝贝|好甜|心软/.test(text))return'love';
  if(/开心|高兴|哈哈|愉快|期待|兴奋|美滋滋|嘿嘿|好耶/.test(text))return'happy';
  if(/累|困|疲惫|没精神|打哈欠|想睡/.test(text))return'sleepy';
  if(spec&&/^work-/.test(spec.key))return'work';
  try{if(typeof roleHolidayOn==='function'&&roleHolidayOn(c))return'party';}catch(_){}
  const h=new Date().getHours();if(h>=1&&h<6)return'sleepy';
  return'idle';
}
const MOOD_LOOK={
  idle:{eyes:'open',hat:'',cls:'breathe',speed:38},
  happy:{eyes:'happy',hat:'',cls:'bob',speed:55,fx:['✦','♪','✧'],fxColor:'#ffb347'},
  love:{eyes:'happy',hat:'',cls:'bob blush',speed:45,fx:['♥','♡','♥'],fxColor:'#ff6f9a'},
  sad:{eyes:'sad',hat:'',cls:'droop tear',speed:16,fx:['…'],fxColor:'#8aa6c8'},
  angry:{eyes:'angry',hat:'',cls:'shake',speed:60,fx:['💢','#','!'],fxColor:'#e5484d'},
  sleep:{eyes:'closed',hat:'sleep',cls:'breathe sit',speed:0,fx:['Z','z','Z'],fxColor:'#8f9bd8'},
  sleepy:{eyes:'closed',hat:'',cls:'breathe',speed:18,fx:['z'],fxColor:'#8f9bd8'},
  work:{eyes:'open',hat:'work',cls:'sit keys',speed:30,fx:['…','!','✎'],fxColor:'#d9971c'},
  music:{eyes:'happy',hat:'music',cls:'bob',speed:40,fx:['♪','♫'],fxColor:'#6d8cff'},
  party:{eyes:'happy',hat:'party',cls:'bob',speed:50,fx:['✦','✧','★'],fxColor:'#ff7aa8'},
};
function lines(mood,n){return({
  idle:[`摸摸我～`,`${n}在忙别的，我先陪你`,`要不要去找${n}聊聊？`,`(｡･ω･｡)`,`今天也要好好喝水哦`],
  happy:[`${n}今天心情很好！`,`嘿嘿，${n}在偷偷开心`,`好耶～`],
  love:[`${n}在想你呢 ♥`,`${n}说想你了（我偷听到的）`,`好甜…我先溜了`],
  sad:[`${n}有点低落…去哄哄ta？`,`呜，${n}好像不太开心`,`抱抱${n}吧`],
  angry:[`${n}在生气，小心点…`,`哼！（${n}现在是这个表情）`,`快去哄哄${n}！`],
  sleep:[`嘘…${n}睡着了`,`Zzz…`,`${n}在做梦，梦里大概有你`],
  sleepy:[`${n}好困…`,`哈——欠`,`该睡觉啦`],
  work:[`${n}在上班，我替ta陪你`,`${n}在认真工作中`,`下班就来找你～`],
  music:[`${n}在和你一起听歌 ♪`,`这首好听！`],
  party:[`放假啦！${n}今天不上班`,`节日快乐～`],
}[mood]||['…']);}

/* ---------- 渲染 ---------- */
function applyLook(){if(!root)return;const L=MOOD_LOOK[state.react||state.mood]||MOOD_LOOK.idle,c=cfg(),col=DP_COLORS[c&&c.color]||DP_COLORS.clay;
  root.style.setProperty('--dp-c',col[0]);root.style.setProperty('--dp-d',col[1]);
  const keep=['dp-root'];if(drag&&drag.moved)keep.push('dangle');
  let cls=L.cls||'';
  if(state.moving){cls=cls.replace(/\b(sit|keys|breathe)\b/g,'')+' walking';if(state.mood==='idle'&&state.act==='skate')cls+=' skate';if(legB)cls+=' leg-b';}
  if(state.act&&!state.moving&&['dance','stretch','wave','look-l','look-r','sit'].includes(state.act))cls+=' '+state.act;
  if(state.react==='jump'||state.react==='spin')cls=cls.replace(/\b(shake|dance)\b/g,'')+' '+state.react;
  if(drag&&drag.moved)cls=cls.replace(/\b(sit|keys|walking|leg-b)\b/g,'');
  root.className=keep.concat(cls.split(/\s+/).filter(Boolean)).join(' ');
  let eyes=L.eyes;if(drag&&drag.moved)eyes='wide';else if(state.react==='pet')eyes='happy';else if(eyes==='open'&&Date.now()<blinkAt+140)eyes='closed';
  root.dataset.eyes=eyes;root.dataset.hat=state.react==='pet'?(L.hat||''):L.hat||'';
  if(state.react==='pet')root.classList.add('blush');
  place();}
function place(){if(!root)return;const d=dims();root.style.width=d.w+'px';root.style.height=d.h+'px';
  root.style.transform=`translate(${state.x}px,${state.y}px)`;
  const f=root.querySelector('.dp-flip');if(f)f.style.transform=`rotate(${state.rot}deg) scaleX(${state.face})`;}
function fx(ch,color){if(!root)return;const h=host(),d=dims(),e=document.createElement('span');e.className='dp-fx';e.textContent=ch;e.style.color=color||'#ff6f9a';
  e.style.left=(state.x+d.w*(.3+Math.random()*.4))+'px';e.style.top=(state.y+d.h*.05)+'px';h.appendChild(e);setTimeout(()=>e.remove(),1700);}
function say(text,sub){if(!root)return;const h=host();if(!bubble){bubble=document.createElement('div');bubble.className='dp-bubble';bubble.addEventListener('click',e=>{e.stopPropagation();const c=role();hideBubble();if(c&&typeof openChat==='function')openChat(c.id);});h.appendChild(bubble);}
  bubble.innerHTML='';bubble.append(document.createTextNode(text));if(sub){const s=document.createElement('small');s.textContent=sub;bubble.append(s);}
  const d=dims(),bw=Math.min(190,Math.max(80,text.length*12+22)),W=h.clientWidth||window.innerWidth;
  bubble.style.left=Math.max(6,Math.min(W-bw-6,state.x+d.w/2-bw/2))+'px';bubble.style.top=Math.max(6,state.y-44)+'px';
  requestAnimationFrame(()=>bubble&&bubble.classList.add('show'));clearTimeout(bubbleTimer);bubbleTimer=setTimeout(hideBubble,3200);}
function hideBubble(){if(bubble)bubble.classList.remove('show');}

/* ---------- 行为 ---------- */
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function walkTo(x,y){const b=bounds();state.tx=Math.max(0,Math.min(b.w,x));state.ty=Math.max(0,Math.min(b.h,y));state.moving=true;state.face=state.tx<state.x?-1:1;if(!raf)loop();}
function chooseAct(now){
  const L=MOOD_LOOK[state.mood]||MOOD_LOOK.idle,b=bounds();state.act='';state.rot=0;
  if(!L.speed){nextActAt=now+6000;return;}
  const r=Math.random();
  if(state.mood==='work'){if(r<.25)walkTo(state.x+(Math.random()-.5)*120,state.y);nextActAt=now+7000+Math.random()*6000;return;}
  if(state.mood==='idle'){
    if(r<.38)walkTo(Math.random()*b.w,Math.random()*b.h);
    else if(r<.5){state.act='skate';walkTo(state.x<b.w/2?b.w:0,state.y);}
    else if(r<.6){state.climb=1;walkTo(Math.random()<.5?0:b.w,state.y);}
    else state.act=pick(['dance','stretch','wave','look-l','look-r','sit','sit']);
  }else if(state.mood==='happy'||state.mood==='party'||state.mood==='love'||state.mood==='music'){
    if(r<.45)walkTo(Math.random()*b.w,Math.random()*b.h);else state.act=pick(['dance','dance','wave','stretch']);
  }else if(state.mood==='sad'||state.mood==='sleepy'){
    if(r<.3)walkTo(state.x+(Math.random()-.5)*90,state.y+(Math.random()-.5)*60);else state.act=pick(['sit','look-l','look-r']);
  }else if(state.mood==='angry'){
    if(r<.6)walkTo(Math.random()*b.w,state.y+(Math.random()-.5)*80);else state.act='sit';
  }
  nextActAt=now+4000+Math.random()*6000;
}
function loop(){raf=requestAnimationFrame(tick);}
function tick(t){raf=0;if(!root||document.hidden)return;const dt=Math.min(.05,last?(t-last)/1000:0);last=t;const now=Date.now();
  if(state.moving&&!drag){const L=MOOD_LOOK[state.mood]||MOOD_LOOK.idle,sp=(L.speed||30)*(state.act==='skate'?2.4:1)*scale()/3,
      dx=state.tx-state.x,dy=state.ty-state.y,dist=Math.hypot(dx,dy);
    if(dist<1.5){state.moving=false;state.x=state.tx;state.y=state.ty;
      if(state.climb===1){/* 贴到墙边，转过去往上爬 */const b=bounds();state.climb=2;state.rot=state.x<=1?90:-90;state.face=1;walkTo(state.x,Math.max(0,state.y-(80+Math.random()*Math.min(260,b.h*.6))));}
      else if(state.climb===2){state.climb=3;setTimeout(()=>{if(state.climb===3){const b=bounds();state.climb=0;state.rot=0;walkTo(state.x<=1?40+Math.random()*80:b.w-40-Math.random()*80,state.y);}},1500+Math.random()*2500);}
      else{if(state.act==='skate')state.act='';persist();}
    }else{const k=Math.min(1,sp*dt/dist);state.x+=dx*k;state.y+=dy*k;legT+=dt;if(legT>(state.act==='skate'?1:.15)){legT=0;legB=!legB;}}}
  if(now>blinkAt+3200+Math.random()*3000)blinkAt=now;
  if(state.reactUntil&&now>state.reactUntil){state.react='';state.reactUntil=0;}
  if(!state.moving&&!drag&&!state.climb&&now>nextActAt)chooseAct(now);
  const L=MOOD_LOOK[state.react&&MOOD_LOOK[state.react]?state.react:state.mood]||{};
  if(L.fx&&now>fxAt){fxAt=now+(state.mood==='sleep'?1600:state.mood==='love'?2200:4200+Math.random()*3000);if(state.mood!=='idle')fx(pick(L.fx),L.fxColor);}
  applyLook();loop();}
function react(kind,ms){state.react=kind;state.reactUntil=Date.now()+(ms||900);applyLook();}
function refreshMood(force){const c=role();const m=moodOf(c);if(force||m!==state.mood){state.mood=m;state.act='';nextActAt=0;if(MOOD_LOOK[m]&&!MOOD_LOOK[m].speed){state.moving=false;state.climb=0;state.rot=0;}}moodAt=Date.now();}

/* ---------- 交互：点、摸、拖 ---------- */
function onDown(e){if(!root)return;e.preventDefault();e.stopPropagation();try{root.setPointerCapture(e.pointerId);}catch(_){}
  const h=host().getBoundingClientRect();drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,ox:state.x,oy:state.y,hx:h.left,hy:h.top,moved:false,at:Date.now()};
  clearTimeout(pressTimer);pressTimer=setTimeout(()=>{if(drag&&!drag.moved){drag.pet=true;pet();}},520);}
function onMove(e){if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
  if(!drag.moved&&Math.hypot(dx,dy)>6){drag.moved=true;clearTimeout(pressTimer);state.moving=false;state.climb=0;state.rot=0;state.act='';hideBubble();}
  if(drag.moved){const b=bounds();state.x=Math.max(0,Math.min(b.w,drag.ox+dx));state.y=Math.max(0,Math.min(b.h,drag.oy+dy));state.face=dx<0?-1:1;applyLook();}}
function onUp(e){if(!drag||e.pointerId!==drag.id)return;clearTimeout(pressTimer);const d=drag;drag=null;
  if(d.moved){react('land',360);root.classList.add('land');persist();nextActAt=Date.now()+2500;const c=role();if(Math.random()<.5)say(pick(['放我下来啦！','哇——','这里视野不错','晕晕的…']),c?rname(c)+'的小机器人':'');return;}
  if(d.pet)return;tap();}
function tap(){const now=Date.now();taps=taps.filter(t=>now-t<700);taps.push(now);const c=role(),n=rname(c),L=MOOD_LOOK[state.mood]||{};
  if(taps.length>=3){taps=[];react('spin',700);fx('✦','#ffb347');say('转圈圈～');return;}
  if(state.mood==='sleep'){react('jump',550);say(pick(lines('sleep',n)),'点我会打扰ta睡觉哦');return;}
  if(state.mood==='angry'&&Math.random()<.5){state.face=-state.face;react('',600);fx('哼','#e5484d');say(pick(lines('angry',n)),'点这里去找'+n);return;}
  react('jump',550);if(L.fx)fx(pick(L.fx),L.fxColor);else fx('!','#ff8a5c');
  say(pick(lines(state.mood,n)),c?'点这里去找'+n:'');}
function pet(){react('pet',1800);for(let i=0;i<3;i++)setTimeout(()=>fx(pick(['♥','♡']),'#ff6f9a'),i*220);say(pick(['嘿嘿～好舒服','再摸摸！','(〃▽〃)','喜欢你！']));if(navigator.vibrate)try{navigator.vibrate(12);}catch(_){}}

/* ---------- 挂载 ---------- */
function mount(){css();const h=host();root=document.createElement('div');root.className='dp-root';root.innerHTML=`<div class="dp-flip" style="width:100%;height:100%">${spriteSVG()}</div>`;
  root.addEventListener('pointerdown',onDown);root.addEventListener('pointermove',onMove);root.addEventListener('pointerup',onUp);root.addEventListener('pointercancel',onUp);
  root.addEventListener('contextmenu',e=>e.preventDefault());h.appendChild(root);
  const c=cfg(),b=bounds();state.x=c&&c.x>=0&&c.x<=b.w?c.x:b.w*.7;state.y=c&&c.y>=0&&c.y<=b.h?c.y:b.h*.72;refreshMood(true);applyLook();last=0;loop();}
function unmount(){if(raf)cancelAnimationFrame(raf);raf=0;if(root)root.remove();root=null;if(bubble)bubble.remove();bubble=null;}
function sync(){const c=role();if(!c){if(root)unmount();return;}if(!root||!root.isConnected){unmount();mount();}else if(Date.now()-moodAt>12000)refreshMood();if(!raf&&!document.hidden)loop();}
setInterval(sync,2000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;sync();}});
window.addEventListener('resize',()=>{if(!root)return;const b=bounds();state.x=Math.min(state.x,b.w);state.y=Math.min(state.y,b.h);place();});

/* ---------- 设置面板（从角色资料页进入） ---------- */
function deskPetSet(id){if(typeof getC!=='function'||typeof openModal!=='function')return;const r=getC(id);if(!r)return;S.settings.deskPet=S.settings.deskPet||{on:false,cid:'',size:'m',color:'clay'};const c=S.settings.deskPet,mine=c.on&&c.cid===id,other=c.on&&c.cid&&c.cid!==id?getC(c.cid):null,e=typeof esc==='function'?esc:(x=>String(x));
  const sizeBtn=(k,l)=>`<button class="minibtn" style="${c.size===k?'background:#d97757;color:#fff':''}" onclick="deskPetSize('${id}','${k}')">${l}</button>`;
  const colorBtn=k=>`<button title="${DP_COLOR_NAMES[k]}" onclick="deskPetColor('${id}','${k}')" style="width:30px;height:30px;border-radius:9px;border:${(c.color||'clay')===k?'2px solid #fff;box-shadow:0 0 0 2px #d97757':'1px solid rgba(128,128,128,.35)'};background:${DP_COLORS[k][0]};margin-right:8px"></button>`;
  openModal(`<h3>${e(rname(r))} 的桌面小机器人</h3>
   <div class="hint">打开后，一只像素小机器人会在屏幕上走来走去、爬墙、发呆。它跟着${e(rname(r))}的心情和作息变化：开心会蹦跶、生气会冒火、难过会掉眼泪、上班戴安全帽、睡觉戴睡帽、一起听歌戴耳机、放假戴派对帽。<br>点它会有反应，连点三下转圈，按住不动是摸摸，按住拖动可以把它拎走；点它头上的气泡直接去找${e(rname(r))}。</div>
   <div class="section"><div class="it"><span style="flex:1">显示小机器人${other?`<br><small style="color:#888">现在跟着 ${e(rname(other))}，打开会换成跟着${e(rname(r))}</small>`:''}</span><span class="sw ${mine?'on':''}" style="flex-shrink:0" onclick="deskPetToggle('${id}')"></span></div></div>
   <div class="field"><label>大小</label><div style="display:flex;gap:8px">${sizeBtn('s','小')}${sizeBtn('m','中')}${sizeBtn('l','大')}</div></div>
   <div class="field"><label>颜色</label><div style="display:flex">${Object.keys(DP_COLORS).map(colorBtn).join('')}</div></div>
   <div class="btns"><button class="btn g" onclick="deskPetHome()">叫它回到屏幕中间</button><button class="btn p" onclick="closeModal()">好了</button></div>`);}
function deskPetToggle(id){const c=S.settings.deskPet;const on=!(c.on&&c.cid===id);c.on=on;c.cid=id;if(on){c.x=-1;c.y=-1;}save();if(root)unmount();sync();deskPetSet(id);if(typeof render==='function')render();if(typeof toast==='function')toast(on?'小机器人出来啦':'小机器人回去休息了');}
function deskPetSize(id,k){S.settings.deskPet.size=k;save();if(root){unmount();sync();}deskPetSet(id);}
function deskPetColor(id,k){S.settings.deskPet.color=k;save();applyLook();deskPetSet(id);}
function deskPetHome(){if(!root){if(typeof toast==='function')toast('先打开小机器人');return;}const b=bounds();state.moving=false;state.climb=0;state.rot=0;state.x=b.w/2;state.y=b.h/2;react('jump',550);persist();say('我回来啦～');}
function deskPetLabel(id){const c=cfg();return c&&c.on&&c.cid===id?'在屏幕上 ›':'未开启 ›';}
Object.assign(window,{deskPetSet,deskPetToggle,deskPetSize,deskPetColor,deskPetHome,deskPetLabel,__deskPet:{moodOf,state:()=>Object.assign({},state),refresh:()=>refreshMood(true),sync}});
})();
