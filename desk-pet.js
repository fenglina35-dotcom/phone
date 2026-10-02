/* 桌面小机器人：像素风桌宠，绑定一个角色，跟着ta的心情 / 作息变化。
   持久状态只在 S.settings.deskPet 下：{on,cid,size,color,x,y}。
   形象是自己画的像素小机器人（不是任何官方素材）。 */
(function(){
'use strict';
const DP_SIZES={s:3,m:4,l:5};
const DP_COLORS={clay:['#d97757','#b8603f','#eb9a7e'],pink:['#f08aa8','#cf6286','#f9b4c8'],mint:['#6cc6a8','#4a9f84','#9ddfc7'],milk:['#efe3d0','#cbb999','#fbf4ea'],sky:['#78a8e8','#5584c4','#a7c8f2']};
const DP_COLOR_NAMES={clay:'陶土橙',pink:'草莓粉',mint:'薄荷绿',milk:'奶油白',sky:'天空蓝'};
const VB_W=16,VB_H=18,VB_Y=-5,FOOT=16/18;   /* 脚底在画布高度的 16/18 处 */
const INK='#1b1311';
let root=null,state={x:-1,y:-1,face:1,rot:0,mood:'idle',act:'',tx:0,ty:0,moving:false,climb:0,hop:null,perch:null,perchUntil:0,react:'',reactUntil:0,eyes:'',eyesUntil:0,annoyedUntil:0},
  raf=0,last=0,legT=0,legB=false,blinkAt=0,blink2=false,nextActAt=0,fxAt=0,moodAt=0,drag=null,taps=[],pressTimer=0,microAt=0;

function cfg(){if(typeof S==='undefined'||!S||!S.settings)return null;return S.settings.deskPet||null;}
function role(){const c=cfg();if(!c||!c.on||!c.cid||typeof getC!=='function')return null;const r=getC(c.cid);return r&&!r.deleted?r:null;}
function host(){return document.querySelector('.phone')||document.body;}
function scale(){const c=cfg();return DP_SIZES[c&&c.size]||DP_SIZES.m;}
function dims(){const k=scale();return{w:VB_W*k,h:VB_H*k};}
function bounds(){const h=host(),d=dims();return{w:Math.max(80,(h.clientWidth||window.innerWidth)-d.w),h:Math.max(80,(h.clientHeight||window.innerHeight)-d.h)};}
function rname(c){return c?(c.remark||c.name||'ta'):'ta';}
function persist(){const c=cfg();if(!c||state.perch)return;c.x=Math.round(state.x);c.y=Math.round(state.y);if(typeof save==='function')save(800);}
function pick(a){return a[Math.floor(Math.random()*a.length)];}

/* ---------- 像素画 ---------- */
const R=(x,y,w,h,fill,cls)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${cls?` class="${cls}"`:''}/>`;
const P=(pts,fill)=>pts.map(([x,y])=>R(x,y,1,1,fill)).join('');
const mirror=(pts,cx)=>pts.map(([x,y])=>[x+cx,y]);
/* 左眼以 x=4 为中心画，右眼平移到 x=12（对称轴 8） */
const pair=(pts,fill)=>P(pts,fill)+P(mirror(pts,8),fill);
const EYES={
  open:R(4,4,1,2,INK)+R(11,4,1,2,INK),
  closed:R(3,5,2,1,INK)+R(11,5,2,1,INK),
  happy:pair([[3,5],[4,4],[5,5]],INK),
  wide:R(3,3,2,3,INK)+R(11,3,2,3,INK)+R(3,3,1,1,'#fff')+R(11,3,1,1,'#fff'),
  angry:R(4,4,1,2,INK)+R(11,4,1,2,INK)+P([[3,2],[4,3],[12,2],[11,3]],INK),
  sad:R(3,4,3,1,INK)+R(4,5,1,1,INK)+R(10,4,3,1,INK)+R(11,5,1,1,INK),
  heart:pair([[3,3],[5,3],[3,4],[4,4],[5,4],[4,5]],'#ff4f86'),
  star:pair([[4,3],[3,4],[4,4],[5,4],[4,5]],'#ffe066')+pair([[4,4]],'#fff8c8'),
  dizzy:pair([[3,3],[5,3],[4,4],[3,5],[5,5]],INK),
  wink:R(4,4,1,2,INK)+P([[11,5],[12,4],[13,5]],INK),
  squint:P([[3,3],[4,4],[3,5],[13,3],[12,4],[13,5]],INK),
  focus:R(4,4,1,2,INK)+R(11,4,1,2,INK)+R(3,3,2,1,INK)+R(11,3,2,1,INK),
};
function spriteSVG(){
  const legs=(h,cls)=>`<g class="${cls}">${[3,5,10,12].map((x,i)=>R(x,8,1,typeof h==='function'?h(i):h,'var(--dp-d)','dp-leg')).join('')}</g>`;
  return `<svg class="dp-svg" viewBox="0 ${VB_Y} ${VB_W} ${VB_H}" shape-rendering="crispEdges" aria-hidden="true">
  <g class="dp-skate">${R(1,11,14,1,'#4b3a5a')}${R(3,12,1,1,'#f3c14b')}${R(12,12,1,1,'#f3c14b')}</g>
  <g class="dp-body">
    ${legs(3,'dp-legs-a')}${legs(i=>i%2?3:2,'dp-legs-b')}${legs(1,'dp-legs-sit')}${legs(i=>i%3?2:3,'dp-legs-air')}
    ${R(2,1,12,7,'var(--dp-c)')}${R(3,1,9,1,'var(--dp-l)')}${R(2,2,1,2,'var(--dp-l)')}${R(2,7,12,1,'var(--dp-d)')}${R(13,2,1,5,'var(--dp-d)','dp-side')}
    <g class="dp-nub-l">${R(0,4,2,2,'var(--dp-c)')}${R(0,5,2,1,'var(--dp-d)')}</g>
    <g class="dp-nub-r">${R(14,4,2,2,'var(--dp-c)')}${R(14,5,2,1,'var(--dp-d)')}</g>
    <g class="dp-eyes">${Object.entries(EYES).map(([k,v])=>`<g class="e-${k}">${v}</g>`).join('')}</g>
    <g class="dp-tear">${R(4,6,1,1,'#7cc4ff')}${R(11,6,1,1,'#7cc4ff')}</g>
    <g class="dp-sweat">${R(14,1,1,1,'#9fd8ff')}${R(14,2,2,2,'#9fd8ff')}${R(14,2,1,1,'#fff')}</g>
    <g class="dp-blush">${R(2,6,2,1,'#ff9fb5')}${R(12,6,2,1,'#ff9fb5')}</g>
    <g class="dp-hat dp-hat-work">${R(4,-2,8,1,'#f2b632')}${R(3,-1,10,2,'#f2b632')}${R(1,0,14,1,'#d9971c')}${R(7,-2,2,2,'#fff3c4')}</g>
    <g class="dp-hat dp-hat-sleep">${R(4,0,8,1,'#6d7fd6')}${R(5,-1,6,1,'#6d7fd6')}${R(7,-2,5,1,'#6d7fd6')}${R(10,-3,3,1,'#6d7fd6')}${R(13,-4,2,2,'#fff')}${R(4,0,8,1,'#fff')}</g>
    <g class="dp-hat dp-hat-party">${R(4,0,8,1,'#ff7aa8')}${R(5,-1,6,1,'#ffd34e')}${R(6,-2,4,1,'#ff7aa8')}${R(7,-3,2,1,'#ffd34e')}${R(7,-5,2,2,'#7ad7ff')}</g>
    <g class="dp-hat dp-hat-music">${R(3,-2,10,1,'#3b5ba5')}${R(2,-1,1,2,'#3b5ba5')}${R(13,-1,1,2,'#3b5ba5')}${R(1,1,2,3,'#2d4787')}${R(13,1,2,3,'#2d4787')}${R(1,1,1,1,'#5b7bc5')}${R(14,1,1,1,'#5b7bc5')}</g>
    <g class="dp-keys">${R(0,8,16,3,'#3a3d46')}${R(0,8,16,1,'#4a4e59')}${[1,3,5,7,9,11,13].map(x=>R(x,9,1,1,'#cfd3dc','dp-key')).join('')}</g>
  </g></svg><i class="dp-shadow"></i>`;
}
/* 飘出来的小特效，同样是像素画 */
const FX={
  heart:{w:7,h:6,svg:P([[1,0],[2,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[1,3],[2,3],[3,3],[4,3],[5,3],[2,4],[3,4],[4,4],[3,5]],'#ff5c8a')+P([[1,1]],'#ffd0de')},
  anger:{w:5,h:5,svg:P([[1,0],[3,0],[0,1],[1,1],[3,1],[4,1],[0,3],[1,3],[3,3],[4,3],[1,4],[3,4]],'#e5484d')},
  spark:{w:5,h:5,svg:P([[2,0],[2,1],[0,2],[1,2],[2,2],[3,2],[4,2],[2,3],[2,4]],'#ffd34e')+P([[2,2]],'#fff')},
  z:{w:4,h:4,svg:R(0,0,4,1,'#8f9bd8')+P([[2,1],[1,2]],'#8f9bd8')+R(0,3,4,1,'#8f9bd8')},
  note:{w:4,h:6,svg:R(3,0,1,5,'#6d8cff')+R(1,4,3,2,'#6d8cff')+R(3,0,1,1,'#6d8cff')},
  drop:{w:2,h:3,svg:R(0,1,2,2,'#7cc4ff')+R(0,0,1,1,'#7cc4ff')},
  dots:{w:7,h:1,svg:P([[0,0],[3,0],[6,0]],'#a99')},
};

function css(){if(document.getElementById('dpStyle'))return;const st=document.createElement('style');st.id='dpStyle';st.textContent=`
.dp-root{position:absolute;left:0;top:0;z-index:180;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;will-change:transform}
.dp-flip{position:relative;z-index:1;transform-origin:50% ${FOOT*100}%;transition:transform .18s;filter:drop-shadow(0 1px 0 rgba(0,0,0,.18))}
.dp-svg{display:block;width:100%;height:100%;overflow:visible}
.dp-svg g{transform-box:fill-box}
.dp-shadow{position:absolute;left:22%;width:56%;top:${FOOT*100-3}%;height:7%;border-radius:50%;background:rgba(0,0,0,.22);filter:blur(1px);transition:opacity .2s,transform .2s;pointer-events:none}
.dp-root.climbing .dp-shadow,.dp-root.dangle .dp-shadow{opacity:0}
.dp-root.air .dp-shadow{opacity:.35;transform:scale(.6)}
.dp-legs-b,.dp-legs-sit,.dp-legs-air,.dp-tear,.dp-sweat,.dp-blush,.dp-hat,.dp-keys,.dp-skate,.dp-eyes>g{display:none}
${Object.keys(EYES).map(k=>`.dp-root[data-eyes=${k}] .e-${k}`).join(',')}{display:inline}
.dp-root.leg-b .dp-legs-a{display:none}.dp-root.leg-b .dp-legs-b{display:inline}
.dp-root.air .dp-legs-a,.dp-root.air .dp-legs-b{display:none}.dp-root.air .dp-legs-air{display:inline}
.dp-root.sit .dp-legs-a,.dp-root.sit .dp-legs-b{display:none}.dp-root.sit .dp-legs-sit{display:inline}.dp-root.sit .dp-body{translate:0 2px}
.dp-root.lie .dp-legs-a,.dp-root.lie .dp-legs-b{display:none}.dp-root.lie .dp-body{translate:0 3px}.dp-root.lie .dp-nub-l,.dp-root.lie .dp-nub-r{translate:0 3px}
.dp-root[data-hat=work] .dp-hat-work,.dp-root[data-hat=sleep] .dp-hat-sleep,.dp-root[data-hat=party] .dp-hat-party,.dp-root[data-hat=music] .dp-hat-music{display:inline}
.dp-root.tear .dp-tear{display:inline;animation:dpTear 1.4s infinite}
.dp-root.sweat .dp-sweat{display:inline;animation:dpSweat 1.2s ease-in-out infinite}
.dp-root.blush .dp-blush{display:inline}
.dp-root.keys .dp-keys{display:inline}.dp-root.keys .dp-key{animation:dpKey .5s steps(1) infinite}.dp-root.keys .dp-key:nth-child(odd){animation-delay:.25s}
.dp-root.skate .dp-skate{display:inline}
.dp-root .dp-body{transform-origin:50% 100%}
.dp-root.breathe .dp-body{animation:dpBreathe 2.6s ease-in-out infinite}
.dp-root.breathe.slow .dp-body{animation-duration:4.2s}
.dp-root.bob .dp-body{animation:dpBob .55s ease-in-out infinite}
.dp-root.walking .dp-body{animation:dpWalk .3s ease-in-out infinite}
.dp-root.shake .dp-body{animation:dpShake .3s linear infinite}
.dp-root.droop .dp-body{animation:dpDroop 3.2s ease-in-out infinite}
.dp-root.dance .dp-body{animation:dpDance .6s ease-in-out infinite}
.dp-root.hop .dp-body{animation:dpHop .42s cubic-bezier(.3,.7,.4,1) infinite}
.dp-root.jump .dp-body{animation:dpJump .5s cubic-bezier(.3,.7,.4,1)}
.dp-root.stretch .dp-body{animation:dpStretch 1.6s ease-in-out}
.dp-root.dangle .dp-leg{animation:dpDangle .35s ease-in-out infinite alternate;transform-origin:50% 0}
.dp-root.dangle .dp-legs-a .dp-leg:nth-child(even){animation-delay:.17s}
.dp-root.wave .dp-nub-r{animation:dpWave .4s steps(1) infinite}
.dp-root.lie .dp-nub-l,.dp-root.lie .dp-nub-r{animation:dpKick 1.1s ease-in-out infinite}
.dp-root.look-l .dp-eyes{transform:translateX(-1px)}.dp-root.look-r .dp-eyes{transform:translateX(1px)}
.dp-root.land .dp-body{animation:dpLand .32s ease-out}
.dp-fx{position:absolute;z-index:181;pointer-events:none;animation:dpFx 1.5s ease-out forwards;image-rendering:pixelated}
.dp-fx svg{display:block;width:100%;height:100%}
.dp-fx.pop{animation:dpPop .9s ease-out forwards}
@keyframes dpBreathe{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-.6px) scaleY(.97) scaleX(1.015)}}
@keyframes dpBob{50%{transform:translateY(-1px) rotate(-3deg)}}
@keyframes dpWalk{50%{transform:translateY(-1.2px)}}
@keyframes dpShake{25%{transform:translateX(-1.2px)}75%{transform:translateX(1.2px)}}
@keyframes dpDroop{0%,100%{transform:scaleY(.92) translateY(.3px)}50%{transform:scaleY(.89) translateY(.6px)}}
@keyframes dpDance{25%{transform:rotate(-9deg) translateY(-2px)}75%{transform:rotate(9deg) translateY(-2px)}}
@keyframes dpHop{0%,100%{transform:translateY(0) scaleY(.92)}45%{transform:translateY(-3.5px) scaleY(1.05)}}
@keyframes dpJump{40%{transform:translateY(-4px) scaleY(1.06)}80%{transform:translateY(0) scaleY(.88)}}
@keyframes dpStretch{30%{transform:scaleX(1.18) scaleY(.85)}60%{transform:scaleX(.9) scaleY(1.1)}}
@keyframes dpDangle{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}
@keyframes dpWave{50%{transform:translateY(-2px)}}
@keyframes dpKick{50%{transform:translateY(.8px)}}
@keyframes dpLand{30%{transform:scaleY(.8) scaleX(1.12)}}
@keyframes dpTear{0%{transform:translateY(0);opacity:1}100%{transform:translateY(4px);opacity:0}}
@keyframes dpSweat{50%{transform:translateY(.8px)}}
@keyframes dpKey{50%{fill:#ffb27a}}
@keyframes dpFx{0%{opacity:0;transform:translate(0,0) scale(.5)}15%{opacity:1;transform:translate(0,-6px) scale(1)}100%{opacity:0;transform:translate(var(--dx,0px),-40px) scale(1)}}
@keyframes dpPop{0%{opacity:0;transform:scale(.3)}25%{opacity:1;transform:scale(1.25)}45%{transform:scale(1)}100%{opacity:0;transform:scale(1)}}
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
/* eyes：平时的眼睛；micro：发呆时偶尔换的小表情 */
const MOOD_LOOK={
  idle:{eyes:'open',micro:['wink','star','look-l','look-r','happy'],hat:'',cls:'',speed:38},
  happy:{eyes:'happy',micro:['star','wink'],hat:'',cls:'bob',speed:55,fx:['spark','note'],every:5000},
  love:{eyes:'heart',micro:['happy','wink'],hat:'',cls:'blush',speed:45,fx:['heart'],every:2600},
  sad:{eyes:'sad',micro:['closed'],hat:'',cls:'droop tear',speed:16,fx:['dots'],every:7000},
  angry:{eyes:'angry',micro:['squint'],hat:'',cls:'shake',speed:60,fx:['anger'],every:3500},
  sleep:{eyes:'closed',micro:[],hat:'sleep',cls:'sit slow',speed:0,fx:['z'],every:1700},
  sleepy:{eyes:'closed',micro:['open','dizzy'],hat:'',cls:'slow',speed:18,fx:['z'],every:5000},
  work:{eyes:'focus',micro:['open','squint'],hat:'work',cls:'sit keys',speed:30,fx:['dots','spark'],every:8000},
  music:{eyes:'happy',micro:['wink','closed'],hat:'music',cls:'bob',speed:40,fx:['note'],every:2200},
  party:{eyes:'star',micro:['happy','wink'],hat:'party',cls:'bob',speed:50,fx:['spark','heart'],every:3200},
};
const BODY_ANIM=/\b(bob|walking|shake|droop|dance|hop|jump|stretch|land)\b/;

/* ---------- 渲染 ---------- */
function look(){return MOOD_LOOK[state.mood]||MOOD_LOOK.idle;}
function applyLook(){if(!root)return;const now=Date.now(),L=look(),c=cfg(),col=DP_COLORS[c&&c.color]||DP_COLORS.clay,dragging=drag&&drag.moved,annoyed=now<state.annoyedUntil;
  root.style.setProperty('--dp-c',col[0]);root.style.setProperty('--dp-d',col[1]);root.style.setProperty('--dp-l',col[2]);
  let cls=' '+(L.cls||'')+' ';
  if(state.hop)cls=cls.replace(/\b(sit|keys|bob|shake|droop)\b/g,'')+' air';
  else if(state.moving){cls=cls.replace(/\b(sit|keys|bob|droop)\b/g,'')+' walking';if(state.act==='skate')cls+=' skate';if(legB)cls+=' leg-b';}
  else if(state.act&&['dance','stretch','wave','look-l','look-r','sit','lie','hop'].includes(state.act)){if(['lie','sit'].includes(state.act))cls=cls.replace(/\bkeys\b/,'');cls+=' '+state.act;}
  if(state.climb===2||state.climb===3)cls+=' climbing';
  if(state.react&&now<state.reactUntil)cls=cls.replace(/\b(shake|dance|hop|bob)\b/g,'')+' '+state.react;
  if(annoyed)cls=cls.replace(/\b(bob|dance|hop|blush|warn|wave)\b/g,'')+' shake';
  if(state.react==='pet'&&now<state.reactUntil)cls+=' blush';
  if(state.react==='warn'&&now<state.reactUntil&&!annoyed)cls+=' sweat';
  if(dragging)cls=cls.replace(/\b(sit|lie|keys|walking|leg-b|air|shake|hop)\b/g,'')+' dangle';
  if(!BODY_ANIM.test(cls))cls+=' breathe';
  root.className='dp-root '+cls.split(/\s+/).filter(Boolean).join(' ');
  let eyes=L.eyes;
  if(dragging)eyes='wide';else if(annoyed)eyes='angry';else if(state.eyes&&now<state.eyesUntil)eyes=state.eyes;
  else if(now<blinkAt+130||blink2&&now>blinkAt+260&&now<blinkAt+380)eyes='closed';
  if(eyes==='look-l'||eyes==='look-r'){root.classList.add(eyes);eyes=L.eyes;}
  root.dataset.eyes=eyes;root.dataset.hat=L.hat||'';
  place();}
function place(){if(!root)return;const d=dims();root.style.width=d.w+'px';root.style.height=d.h+'px';
  root.style.transform=`translate(${state.x}px,${state.y}px)`;
  const f=root.querySelector('.dp-flip');if(f)f.style.transform=`rotate(${state.rot}deg) scaleX(${state.face})`;}
function fx(kind,opt){if(!root)return;const F=FX[kind];if(!F)return;opt=opt||{};const h=host(),d=dims(),k=scale()*1.05,e=document.createElement('span');
  e.className='dp-fx'+(opt.pop?' pop':'');e.innerHTML=`<svg viewBox="0 0 ${F.w} ${F.h}" shape-rendering="crispEdges">${F.svg}</svg>`;
  e.style.width=F.w*k+'px';e.style.height=F.h*k+'px';e.style.setProperty('--dx',((Math.random()-.5)*24)+'px');
  const side=state.face>0?.62:.18;e.style.left=(state.x+d.w*(opt.center?.5-F.w*k/d.w/2:side+(Math.random()-.5)*.25))+'px';e.style.top=(state.y+d.h*(opt.top!=null?opt.top:0)-F.h*k)+'px';
  h.appendChild(e);setTimeout(()=>e.remove(),1600);}

/* ---------- 聊天气泡：可以跳上去趴着 ---------- */
function hostRect(){return host().getBoundingClientRect();}
function perchSpots(){const hr=hostRect(),d=dims(),out=[];
  document.querySelectorAll('.msg .bubble').forEach(el=>{if(!el.isConnected||el.closest('.modal'))return;const r=el.getBoundingClientRect();
    if(r.width<d.w*.7||r.height<12)return;const top=r.top-hr.top;if(top-d.h*FOOT<70||r.bottom-hr.top>hr.height-60)return;out.push(el);});
  return out;}
function perchPos(el,ox){const hr=hostRect(),r=el.getBoundingClientRect(),d=dims();return{x:r.left-hr.left+ox,y:r.top-hr.top-d.h*FOOT+1,ok:el.isConnected&&r.width>0&&r.top-hr.top-d.h*FOOT>40&&r.bottom-hr.top<hr.height-30};}
function hopTo(x,y,opt){opt=opt||{};const b=bounds();state.moving=false;state.climb=0;state.rot=0;state.act='';
  const tx=Math.max(0,Math.min(b.w,x)),ty=Math.max(-dims().h*.2,Math.min(b.h,y)),dist=Math.hypot(tx-state.x,ty-state.y);
  state.face=tx<state.x?-1:1;state.hop={sx:state.x,sy:state.y,tx,ty,t0:performance.now(),dur:Math.min(900,380+dist*1.4),h:Math.min(110,30+dist*.35),perch:opt.perch||null};if(!raf)loop();}
function tryPerch(){const spots=perchSpots();if(!spots.length)return false;const d=dims(),el=pick(spots),r=el.getBoundingClientRect(),ox=Math.max(-d.w*.15,Math.min(r.width-d.w*.85,Math.random()*(r.width-d.w)));
  const p=perchPos(el,ox);if(!p.ok)return false;hopTo(p.x,p.y,{perch:{el,ox}});return true;}
function leavePerch(down){state.perch=null;state.act='';const b=bounds();if(down)hopTo(state.x+(Math.random()-.5)*80,b.h);}

/* ---------- 行为 ---------- */
function walkTo(x,y){const b=bounds();state.tx=Math.max(0,Math.min(b.w,x));state.ty=Math.max(0,Math.min(b.h,y));state.moving=true;state.face=state.tx<state.x?-1:1;if(!raf)loop();}
function chooseAct(now){
  const L=look(),b=bounds(),m=state.mood;state.act='';
  if(!L.speed){nextActAt=now+6000;return;}
  const r=Math.random(),playful=['idle','happy','love','party','music'].includes(m);
  if(state.perch){/* 在气泡上：趴着、蹦跶、发呆，过一会儿换个气泡或者跳下来 */
    if(now>state.perchUntil){if(Math.random()<.5&&tryPerch()){state.perchUntil=now+12000+Math.random()*14000;}else leavePerch(true);nextActAt=now+2500;return;}
    state.act=pick(playful?['hop','hop','lie','lie','dance','wave','look-l','look-r','sit']:['lie','sit','look-l','look-r']);nextActAt=now+2200+Math.random()*2600;return;}
  if(playful&&r<.3&&tryPerch()){state.perchUntil=now+12000+Math.random()*14000;nextActAt=now+1500;return;}
  if(m==='work'){if(r<.25)walkTo(state.x+(Math.random()-.5)*120,state.y);nextActAt=now+7000+Math.random()*6000;return;}
  if(m==='idle'){
    if(r<.5)walkTo(Math.random()*b.w,Math.random()*b.h);
    else if(r<.6){state.act='skate';walkTo(state.x<b.w/2?b.w:0,state.y);}
    else if(r<.68){state.climb=1;walkTo(Math.random()<.5?0:b.w,state.y);}
    else if(r<.74)hopTo(state.x+(Math.random()-.5)*160,state.y+(Math.random()-.5)*120);
    else state.act=pick(['dance','stretch','wave','look-l','look-r','sit','sit']);
  }else if(playful){
    if(r<.55)walkTo(Math.random()*b.w,Math.random()*b.h);else if(r<.7)hopTo(state.x+(Math.random()-.5)*160,state.y+(Math.random()-.5)*100);else state.act=pick(['dance','dance','wave','stretch','hop']);
  }else if(m==='sad'||m==='sleepy'){
    if(r<.3)walkTo(state.x+(Math.random()-.5)*90,state.y+(Math.random()-.5)*60);else state.act=pick(['sit','lie','look-l','look-r']);
  }else if(m==='angry'){
    if(r<.6)walkTo(Math.random()*b.w,state.y+(Math.random()-.5)*80);else state.act='sit';
  }
  nextActAt=now+4000+Math.random()*6000;
}
function loop(){raf=requestAnimationFrame(tick);}
function tick(t){raf=0;if(!root||document.hidden)return;const dt=Math.min(.05,last?(t-last)/1000:0);last=t;const now=Date.now();
  if(state.hop&&!drag){const H=state.hop,p=Math.min(1,(t-H.t0)/H.dur);let ty=H.ty;if(H.perch){const q=perchPos(H.perch.el,H.perch.ox);if(q.ok){H.tx=q.x;ty=H.ty=q.y;}}
    state.x=H.sx+(H.tx-H.sx)*p;state.y=H.sy+(ty-H.sy)*p-H.h*4*p*(1-p);
    if(p>=1){state.hop=null;state.perch=H.perch;react('land',320);if(!state.perch)persist();nextActAt=now+900;}}
  else if(state.perch&&!drag){const q=perchPos(state.perch.el,state.perch.ox);if(!q.ok){/* 气泡滑走了 */state.perch=null;const b=bounds();state.y=Math.max(0,Math.min(b.h,state.y));hopTo(state.x,b.h);}else{state.x=q.x;state.y=q.y;}}
  else if(state.moving&&!drag){const L=look(),sp=(L.speed||30)*(state.act==='skate'?2.4:state.act==='flee'?3:1)*scale()/3,
      dx=state.tx-state.x,dy=state.ty-state.y,dist=Math.hypot(dx,dy);
    if(dist<1.5){state.moving=false;state.x=state.tx;state.y=state.ty;
      if(state.climb===1){const b=bounds();state.climb=2;state.rot=state.x<=1?90:-90;state.face=1;walkTo(state.x,Math.max(0,state.y-(80+Math.random()*Math.min(260,b.h*.6))));}
      else if(state.climb===2){state.climb=3;setTimeout(()=>{if(state.climb===3){const b=bounds();state.climb=0;state.rot=0;walkTo(state.x<=1?40+Math.random()*80:b.w-40-Math.random()*80,state.y);}},1500+Math.random()*2500);}
      else{if(state.act==='skate'||state.act==='flee')state.act='';persist();}
    }else{const k=Math.min(1,sp*dt/dist);state.x+=dx*k;state.y+=dy*k;legT+=dt;if(legT>(state.act==='skate'?1:.15)){legT=0;legB=!legB;}}}
  if(now>blinkAt+2600+Math.random()*3500){blinkAt=now;blink2=Math.random()<.25;}
  if(state.reactUntil&&now>state.reactUntil){state.react='';state.reactUntil=0;}
  const L=look();
  if(!state.moving&&!state.hop&&!drag&&!state.climb&&now>nextActAt)chooseAct(now);
  if(!drag&&now>microAt&&!(state.eyes&&now<state.eyesUntil)){microAt=now+6000+Math.random()*9000;if(L.micro&&L.micro.length&&!state.moving){state.eyes=pick(L.micro);state.eyesUntil=now+900+Math.random()*900;}}
  if(L.fx&&now>fxAt&&!drag){fxAt=now+(L.every||4000)*(.8+Math.random()*.5);if(state.mood!=='idle')fx(pick(L.fx));}
  applyLook();loop();}
function react(kind,ms){state.react=kind;state.reactUntil=Date.now()+(ms||900);applyLook();}
function setEyes(e,ms){state.eyes=e;state.eyesUntil=Date.now()+ms;}
function refreshMood(force){const c=role();const m=moodOf(c);if(force||m!==state.mood){state.mood=m;state.act='';nextActAt=0;if(MOOD_LOOK[m]&&!MOOD_LOOK[m].speed){state.moving=false;state.climb=0;state.rot=0;}}moodAt=Date.now();}

/* ---------- 交互：点、摸、拖 ---------- */
function onDown(e){if(!root)return;e.preventDefault();e.stopPropagation();try{root.setPointerCapture(e.pointerId);}catch(_){}
  drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,ox:state.x,oy:state.y,moved:false,at:Date.now()};
  clearTimeout(pressTimer);pressTimer=setTimeout(()=>{if(drag&&!drag.moved){drag.pet=true;pet();}},520);}
function onMove(e){if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
  if(!drag.moved&&Math.hypot(dx,dy)>6){drag.moved=true;clearTimeout(pressTimer);state.moving=false;state.climb=0;state.rot=0;state.act='';state.hop=null;state.perch=null;}
  if(drag.moved){const b=bounds();state.x=Math.max(0,Math.min(b.w,drag.ox+dx));state.y=Math.max(0,Math.min(b.h,drag.oy+dy));state.face=dx<0?-1:1;applyLook();}}
function onUp(e){if(!drag||e.pointerId!==drag.id)return;clearTimeout(pressTimer);const d=drag;drag=null;
  if(d.moved){react('land',360);setEyes('dizzy',1300);persist();nextActAt=Date.now()+2500;return;}
  if(d.pet)return;tap();}
/* 点一下冒爱心；连着点太多下会不耐烦，再点就生气跑开 */
function tap(){const now=Date.now();taps=taps.filter(t=>now-t<5000);taps.push(now);const n=taps.length;
  if(now<state.annoyedUntil){state.face=-state.face;fx('anger',{pop:true});state.annoyedUntil=now+5000;
    if(n>=9){const b=bounds();state.perch=null;state.hop=null;state.act='flee';walkTo(state.x<b.w/2?b.w:0,Math.random()*b.h);taps=[];}
    return;}
  if(n>=7){state.annoyedUntil=now+6000;state.face=-state.face;fx('anger',{pop:true});setTimeout(()=>fx('anger',{pop:true}),260);return;}
  setEyes('squint',220);setTimeout(()=>{if(Date.now()>=state.annoyedUntil)setEyes(n>=5?'wide':(state.mood==='love'?'heart':'happy'),900);},220);
  react(n>=5?'warn':'jump',n>=5?1400:500);
  fx('heart',{pop:n===1});if(n<=3&&Math.random()<.6)setTimeout(()=>fx('heart'),180);}
function pet(){react('pet',1800);setEyes('heart',1800);taps=[];for(let i=0;i<4;i++)setTimeout(()=>fx('heart'),i*200);if(navigator.vibrate)try{navigator.vibrate(12);}catch(_){}}

/* ---------- 挂载 ---------- */
function mount(){css();const h=host();root=document.createElement('div');root.className='dp-root';root.innerHTML=`<div class="dp-flip" style="width:100%;height:100%">${spriteSVG()}</div>`;
  const shadow=root.querySelector('.dp-shadow');if(shadow)root.appendChild(shadow);
  root.addEventListener('pointerdown',onDown);root.addEventListener('pointermove',onMove);root.addEventListener('pointerup',onUp);root.addEventListener('pointercancel',onUp);
  root.addEventListener('contextmenu',e=>e.preventDefault());h.appendChild(root);
  const c=cfg(),b=bounds();state.x=c&&c.x>=0&&c.x<=b.w?c.x:b.w*.7;state.y=c&&c.y>=0&&c.y<=b.h?c.y:b.h*.72;state.perch=null;state.hop=null;refreshMood(true);applyLook();last=0;loop();}
function unmount(){if(raf)cancelAnimationFrame(raf);raf=0;if(root)root.remove();root=null;}
function sync(){const c=role();if(!c){if(root)unmount();return;}if(!root||!root.isConnected){unmount();mount();}else if(Date.now()-moodAt>12000)refreshMood();if(!raf&&!document.hidden)loop();}
setInterval(sync,2000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;sync();}});
window.addEventListener('resize',()=>{if(!root)return;const b=bounds();state.x=Math.min(state.x,b.w);state.y=Math.min(state.y,b.h);place();});

/* ---------- 设置面板（从角色资料页进入） ---------- */
function deskPetSet(id){if(typeof getC!=='function'||typeof openModal!=='function')return;const r=getC(id);if(!r)return;S.settings.deskPet=S.settings.deskPet||{on:false,cid:'',size:'m',color:'clay'};const c=S.settings.deskPet,mine=c.on&&c.cid===id,other=c.on&&c.cid&&c.cid!==id?getC(c.cid):null,e=typeof esc==='function'?esc:(x=>String(x));
  const sizeBtn=(k,l)=>`<button class="minibtn" style="${c.size===k?'background:#d97757;color:#fff':''}" onclick="deskPetSize('${id}','${k}')">${l}</button>`;
  const colorBtn=k=>`<button title="${DP_COLOR_NAMES[k]}" onclick="deskPetColor('${id}','${k}')" style="width:30px;height:30px;border-radius:9px;border:${(c.color||'clay')===k?'2px solid #fff;box-shadow:0 0 0 2px #d97757':'1px solid rgba(128,128,128,.35)'};background:${DP_COLORS[k][0]};margin-right:8px"></button>`;
  openModal(`<h3>${e(rname(r))} 的桌面小机器人</h3>
   <div class="hint">打开后，一只像素小机器人会在屏幕上走来走去、爬墙、发呆，停下来也会轻轻呼吸。在聊天页它还会跳到气泡上趴着、蹦跶。它跟着${e(rname(r))}的心情和作息变化：开心会蹦跶、想你会冒爱心、生气会冒火、难过会掉眼泪、上班戴安全帽、睡觉戴睡帽、一起听歌戴耳机、放假戴派对帽。<br>点它会冒小爱心；连着点太多下它会不耐烦，再点就生气跑开。按住不动是摸摸，按住拖动可以把它拎走。</div>
   <div class="section"><div class="it"><span style="flex:1">显示小机器人${other?`<br><small style="color:#888">现在跟着 ${e(rname(other))}，打开会换成跟着${e(rname(r))}</small>`:''}</span><span class="sw ${mine?'on':''}" style="flex-shrink:0" onclick="deskPetToggle('${id}')"></span></div></div>
   <div class="field"><label>大小</label><div style="display:flex;gap:8px">${sizeBtn('s','小')}${sizeBtn('m','中')}${sizeBtn('l','大')}</div></div>
   <div class="field"><label>颜色</label><div style="display:flex">${Object.keys(DP_COLORS).map(colorBtn).join('')}</div></div>
   <div class="btns"><button class="btn g" onclick="deskPetHome()">叫它回到屏幕中间</button><button class="btn p" onclick="closeModal()">好了</button></div>`);}
function deskPetToggle(id){const c=S.settings.deskPet;const on=!(c.on&&c.cid===id);c.on=on;c.cid=id;if(on){c.x=-1;c.y=-1;}save();if(root)unmount();sync();deskPetSet(id);if(typeof render==='function')render();if(typeof toast==='function')toast(on?'小机器人出来啦':'小机器人回去休息了');}
function deskPetSize(id,k){S.settings.deskPet.size=k;save();if(root){unmount();sync();}deskPetSet(id);}
function deskPetColor(id,k){S.settings.deskPet.color=k;save();applyLook();deskPetSet(id);}
function deskPetHome(){if(!root){if(typeof toast==='function')toast('先打开小机器人');return;}const b=bounds();state.perch=null;hopTo(b.w/2,b.h/2);fx('heart',{pop:true});}
function deskPetLabel(id){const c=cfg();return c&&c.on&&c.cid===id?'在屏幕上 ›':'未开启 ›';}
Object.assign(window,{deskPetSet,deskPetToggle,deskPetSize,deskPetColor,deskPetHome,deskPetLabel,__deskPet:{moodOf,state:()=>Object.assign({},state,{perch:!!state.perch,hop:!!state.hop}),refresh:()=>refreshMood(true),sync,tryPerch,tap,EYES:Object.keys(EYES)}});
})();
