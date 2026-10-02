/* 桌面宠物：像素风的虚拟小机器人，只住在手机屏幕里。
   和实体桌面机器人「小 K」完全无关，两边互不影响。
   只绑定一个角色，跟着ta的心情 / 作息变化；角色和用户都能让它做表情。
   持久状态只在 S.settings.deskPet 下：{on,cid,name,size,color,x,y}。
   形象是自己画的像素小机器人（不是任何官方素材）。 */
(function(){
'use strict';
const DP_SIZES={s:3,m:4,l:5};
const DP_COLORS={clay:['#d97757','#b8603f','#eb9a7e'],pink:['#f08aa8','#cf6286','#f9b4c8'],mint:['#6cc6a8','#4a9f84','#9ddfc7'],milk:['#efe3d0','#cbb999','#fbf4ea'],sky:['#78a8e8','#5584c4','#a7c8f2']};
const DP_COLOR_NAMES={clay:'陶土橙',pink:'草莓粉',mint:'薄荷绿',milk:'奶油白',sky:'天空蓝'};
const DP_DEFAULT_NAME='小橘';
const VB_W=16,VB_H=18,VB_Y=-5,FOOT=16/18;   /* 脚底在画布高度的 16/18 处 */
const INK='#1b1311';
const ROLE_CMD_MS=40000,USER_CMD_MS=12000,TYPE_MS=2500,NAP_MS=90000,PLACE_MS=45000;
let root=null,state={x:-1,y:-1,face:1,rot:0,mood:'idle',act:'',tx:0,ty:0,moving:false,climb:0,hop:null,perch:null,perchUntil:0,react:'',reactUntil:0,eyes:'',eyesUntil:0,annoyedUntil:0,cmd:'',cmdUntil:0,shownEyes:'',eyeSwapUntil:0,eyeTarget:'',bodyAnim:'',onGround:false,walkGround:false,placedUntil:0,out:null,napping:false},
  raf=0,last=0,legT=0,legB=false,blinkAt=0,blink2=false,nextActAt=0,fxAt=0,moodAt=0,drag=null,taps=[],pressTimer=0,microAt=0,lastTypeAt=0,settleTimer=0,lastInteract=Date.now(),msgSig=null,msgCheckAt=0,wobbleAt=0,hiddenAt=0;

function cfg(){if(typeof S==='undefined'||!S||!S.settings)return null;return S.settings.deskPet||null;}
function ensureCfg(){S.settings.deskPet=Object.assign({on:false,cid:'',name:DP_DEFAULT_NAME,size:'m',color:'clay'},S.settings.deskPet||{});return S.settings.deskPet;}
function petName(){const c=cfg();return String(c&&c.name||'').trim()||DP_DEFAULT_NAME;}
function role(){const c=cfg();if(!c||!c.on||!c.cid||typeof getC!=='function')return null;const r=getC(c.cid);return r&&!r.deleted?r:null;}
function host(){return document.querySelector('.phone')||document.body;}
function scale(){const c=cfg();return DP_SIZES[c&&c.size]||DP_SIZES.m;}
function dims(){const k=scale();return{w:VB_W*k,h:VB_H*k};}
function bounds(){const h=host(),d=dims();return{w:Math.max(80,(h.clientWidth||window.innerWidth)-d.w),h:Math.max(80,(h.clientHeight||window.innerHeight)-d.h)};}
function rname(c){return c?(c.remark||c.name||'ta'):'ta';}
function persist(){const c=cfg();if(!c||state.perch)return;c.x=Math.round(state.x);c.y=Math.round(state.y);if(typeof save==='function')save(800);}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function escH(x){return typeof esc==='function'?esc(x):String(x).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

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
  </g></svg>`;
}
/* 飘出来的小特效，同样是像素画 */
const FX={
  heart:{w:7,h:6,svg:P([[1,0],[2,0],[4,0],[5,0],[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[1,3],[2,3],[3,3],[4,3],[5,3],[2,4],[3,4],[4,4],[3,5]],'#ff5c8a')+P([[1,1]],'#ffd0de')},
  anger:{w:5,h:5,svg:P([[1,0],[3,0],[0,1],[1,1],[3,1],[4,1],[0,3],[1,3],[3,3],[4,3],[1,4],[3,4]],'#e5484d')},
  spark:{w:5,h:5,svg:P([[2,0],[2,1],[0,2],[1,2],[2,2],[3,2],[4,2],[2,3],[2,4]],'#ffd34e')+P([[2,2]],'#fff')},
  z:{w:4,h:4,svg:R(0,0,4,1,'#8f9bd8')+P([[2,1],[1,2]],'#8f9bd8')+R(0,3,4,1,'#8f9bd8')},
  note:{w:4,h:6,svg:R(3,0,1,5,'#6d8cff')+R(1,4,3,2,'#6d8cff')+R(3,0,1,1,'#6d8cff')},
  dots:{w:7,h:1,svg:P([[0,0],[3,0],[6,0]],'#a99')},
  code:{w:7,h:5,svg:P([[2,0],[1,1],[0,2],[1,3],[2,4],[4,0],[5,1],[6,2],[5,3],[4,4]],'#7ee0a1')},
};

/* 角色或用户可以让它做的表情 / 动作 */
const CMDS={
  '开心':{eyes:'happy',cls:'bob',fx:'spark'},
  '爱心眼':{eyes:'heart',cls:'bob blush',fx:'heart'},
  '星星眼':{eyes:'star',cls:'bob',fx:'spark'},
  '眨眼':{eyes:'wink',cls:''},
  '害羞':{eyes:'happy',cls:'blush',fx:'heart'},
  '难过':{eyes:'sad',cls:'droop tear',fx:'dots'},
  '生气':{eyes:'angry',cls:'shake',fx:'anger'},
  '惊讶':{eyes:'wide',cls:'sweat'},
  '晕乎乎':{eyes:'dizzy',cls:'sway'},
  '睡觉':{eyes:'closed',hat:'sleep',cls:'sit slow',fx:'z'},
  '跳舞':{eyes:'happy',cls:'dance',fx:'note'},
  '挥手':{eyes:'happy',cls:'wave'},
  '蹦跶':{eyes:'happy',cls:'hop'},
  '转圈':{eyes:'happy',cls:'spin'},
  '伸懒腰':{eyes:'closed',cls:'stretch'},
  '趴下':{eyes:'open',cls:'lie'},
  '坐下':{eyes:'open',cls:'sit'},
};
const CMD_ALIAS={'高兴':'开心','笑':'开心','爱心':'爱心眼','喜欢':'爱心眼','星星':'星星眼','哭':'难过','伤心':'难过','委屈':'难过','发火':'生气','气':'生气','吃惊':'惊讶','晕':'晕乎乎','睡':'睡觉','舞':'跳舞','招手':'挥手','跳':'蹦跶','趴':'趴下','坐':'坐下'};
function normCmd(v){v=String(v||'').trim().replace(/[。！!~～\s]/g,'');if(CMDS[v]||MOVES[v])return v;if(/^(出去|跑掉|溜走|躲起来)$/.test(v))return'跑出去';if(/^(回来|过来吧|来这里|到这来)$/.test(v))return'过来';if(/气泡/.test(v))return'跳上气泡';if(CMD_ALIAS[v])return CMD_ALIAS[v];if(/^(平静|恢复|正常|停|停下|好了)$/.test(v))return'平静';for(const k of Object.keys(CMDS))if(v.includes(k))return k;for(const [a,k] of Object.entries(CMD_ALIAS))if(v.includes(a))return k;return'';}

function css(){if(document.getElementById('dpStyle'))return;const st=document.createElement('style');st.id='dpStyle';st.textContent=`
.dp-root{position:absolute;left:0;top:0;z-index:180;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;will-change:transform}
.dp-flip{position:relative;z-index:1;width:100%;height:100%;transform-origin:50% ${FOOT*100}%;transition:transform .25s ease;filter:drop-shadow(0 1px 0 rgba(0,0,0,.18))}
.dp-svg{display:block;width:100%;height:100%;overflow:visible}
.dp-svg g{transform-box:fill-box}
.dp-shadow{position:absolute;left:22%;width:56%;top:${FOOT*100-3}%;height:7%;border-radius:50%;background:rgba(0,0,0,.22);filter:blur(1px);transition:opacity .25s,transform .25s;pointer-events:none}
.dp-root.climbing .dp-shadow,.dp-root.dangle .dp-shadow{opacity:0}
.dp-root.air .dp-shadow{opacity:.35;transform:scale(.6)}
.dp-legs-b,.dp-legs-sit,.dp-legs-air,.dp-tear,.dp-sweat,.dp-blush,.dp-hat,.dp-keys,.dp-skate,.dp-eyes>g{display:none}
${Object.keys(EYES).map(k=>`.dp-root[data-eyes=${k}] .e-${k}`).join(',')}{display:inline}
.dp-root.leg-b .dp-legs-a{display:none}.dp-root.leg-b .dp-legs-b{display:inline}
.dp-root.air .dp-legs-a,.dp-root.air .dp-legs-b{display:none}.dp-root.air .dp-legs-air{display:inline}
.dp-root .dp-body,.dp-root .dp-nub-l,.dp-root .dp-nub-r{transition:translate .28s ease}
.dp-root.sit .dp-legs-a,.dp-root.sit .dp-legs-b{display:none}.dp-root.sit .dp-legs-sit{display:inline}.dp-root.sit .dp-body{translate:0 2px}
.dp-root.lie .dp-legs-a,.dp-root.lie .dp-legs-b{display:none}.dp-root.lie .dp-body{translate:0 3px}.dp-root.lie .dp-nub-l,.dp-root.lie .dp-nub-r{translate:0 3px}
.dp-root[data-hat=work] .dp-hat-work,.dp-root[data-hat=sleep] .dp-hat-sleep,.dp-root[data-hat=party] .dp-hat-party,.dp-root[data-hat=music] .dp-hat-music{display:inline;animation:dpHatIn .32s cubic-bezier(.3,1.4,.5,1)}
.dp-root.tear .dp-tear{display:inline;animation:dpTear 1.4s infinite}
.dp-root.sweat .dp-sweat{display:inline;animation:dpSweat 1.2s ease-in-out infinite}
.dp-root.blush .dp-blush{display:inline;animation:dpFadeIn .35s ease}
.dp-root.keys .dp-keys{display:inline;animation:dpFadeIn .3s ease}.dp-root.keys .dp-key{animation:dpKey .5s steps(1) infinite}.dp-root.keys .dp-key:nth-child(odd){animation-delay:.25s}
.dp-root.type .dp-key{animation-duration:.22s}.dp-root.type .dp-key:nth-child(odd){animation-delay:.11s}
.dp-root.type .dp-nub-l{animation:dpTapL .22s steps(1) infinite}.dp-root.type .dp-nub-r{animation:dpTapL .22s steps(1) .11s infinite}
.dp-root.skate .dp-skate{display:inline}
.dp-root .dp-body{transform-origin:50% 100%}
.dp-root.breathe .dp-body{animation:dpBreathe 2.6s ease-in-out infinite}
.dp-root.breathe.slow .dp-body{animation-duration:4.2s}
.dp-root.bob .dp-body{animation:dpBob .55s ease-in-out infinite}
.dp-root.walking .dp-body{animation:dpWalk .3s ease-in-out infinite}
.dp-root.shake .dp-body{animation:dpShake .3s linear infinite}
.dp-root.droop .dp-body{animation:dpDroop 3.2s ease-in-out infinite}
.dp-root.dance .dp-body{animation:dpDance .6s ease-in-out infinite}
.dp-root.sway .dp-body{animation:dpSway 1.5s ease-in-out infinite}
.dp-root.hop .dp-body{animation:dpHop .42s cubic-bezier(.3,.7,.4,1) infinite}
.dp-root.jump .dp-body{animation:dpJump .5s cubic-bezier(.3,.7,.4,1)}
.dp-root.spin .dp-body{animation:dpSpin .9s ease-in-out infinite}
.dp-root.stretch .dp-body{animation:dpStretch 1.8s ease-in-out infinite}
.dp-root.dangle .dp-leg{animation:dpDangle .35s ease-in-out infinite alternate;transform-origin:50% 0}
.dp-root.dangle .dp-legs-a .dp-leg:nth-child(even){animation-delay:.17s}
.dp-root.wave .dp-nub-r{animation:dpWave .4s steps(1) infinite}
.dp-root.lie .dp-nub-l,.dp-root.lie .dp-nub-r{animation:dpKick 1.1s ease-in-out infinite}
.dp-root .dp-eyes{transition:transform .25s ease}
.dp-root.look-l .dp-eyes{transform:translateX(-1px)}.dp-root.look-r .dp-eyes{transform:translateX(1px)}
.dp-root.land .dp-body{animation:dpLand .32s ease-out}
.dp-fx{position:absolute;z-index:181;pointer-events:none;animation:dpFx 1.5s ease-out forwards}
.dp-fx svg{display:block;width:100%;height:100%}
.dp-fx.pop{animation:dpPop .9s ease-out forwards}
@keyframes dpBreathe{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-.6px) scaleY(.97) scaleX(1.015)}}
@keyframes dpBob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-1px) rotate(-3deg)}}
@keyframes dpWalk{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.2px)}}
@keyframes dpShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-1.2px)}75%{transform:translateX(1.2px)}}
@keyframes dpDroop{0%,100%{transform:scaleY(.92) translateY(.3px)}50%{transform:scaleY(.89) translateY(.6px)}}
@keyframes dpDance{0%,100%{transform:rotate(0)}25%{transform:rotate(-9deg) translateY(-2px)}75%{transform:rotate(9deg) translateY(-2px)}}
@keyframes dpSway{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
@keyframes dpHop{0%,100%{transform:translateY(0) scaleY(.92)}45%{transform:translateY(-3.5px) scaleY(1.05)}}
@keyframes dpJump{0%,100%{transform:translateY(0)}40%{transform:translateY(-4px) scaleY(1.06)}80%{transform:translateY(0) scaleY(.88)}}
@keyframes dpSpin{0%,100%{transform:scaleX(1)}50%{transform:scaleX(-1)}}
@keyframes dpStretch{0%,100%{transform:scale(1)}30%{transform:scaleX(1.18) scaleY(.85)}60%{transform:scaleX(.9) scaleY(1.1)}}
@keyframes dpDangle{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}
@keyframes dpWave{50%{transform:translateY(-2px)}}
@keyframes dpTapL{50%{transform:translateY(1px)}}
@keyframes dpKick{50%{transform:translateY(.8px)}}
@keyframes dpLand{0%,100%{transform:scale(1)}30%{transform:scaleY(.8) scaleX(1.12)}}
@keyframes dpTear{0%{transform:translateY(0);opacity:1}100%{transform:translateY(4px);opacity:0}}
@keyframes dpSweat{50%{transform:translateY(.8px)}}
@keyframes dpKey{50%{fill:#ffb27a}}
@keyframes dpHatIn{0%{transform:translateY(-3px) scale(.6);opacity:0}100%{transform:none;opacity:1}}
@keyframes dpFadeIn{from{opacity:0}to{opacity:1}}
@keyframes dpFx{0%{opacity:0;transform:translate(0,0) scale(.5)}15%{opacity:1;transform:translate(0,-6px) scale(1)}100%{opacity:0;transform:translate(var(--dx,0px),-40px) scale(1)}}
@keyframes dpPop{0%{opacity:0;transform:scale(.3)}25%{opacity:1;transform:scale(1.25)}45%{transform:scale(1)}100%{opacity:0;transform:scale(1)}}
.dp-page{padding:4px 16px 40px}
.dp-hero{display:flex;flex-direction:column;align-items:center;padding:14px 0 10px}
.dp-hero .dp-root{position:relative;transform:none!important;cursor:default}
.dp-hero b{margin-top:8px;font-size:20px;color:#f5f5f7}
.dp-hero small{margin-top:4px;color:#8e8e93;font-size:12px;text-align:center;line-height:1.5}
.dp-group{margin:14px 0;border-radius:12px;overflow:hidden;background:#1c1c1e}
.dp-row{min-height:50px;display:flex;align-items:center;gap:12px;padding:0 14px;border-bottom:.5px solid rgba(255,255,255,.08);color:#f5f5f7;font-size:15px}
.dp-row:last-child{border-bottom:0}
.dp-row>span:not(.sw){flex:1}
.dp-row input,.dp-row select{min-width:0;max-width:56%;background:transparent;border:0;color:#aeaeb2;font-size:15px;text-align:right;outline:0}
.dp-row select option{color:#111}
.dp-seg{display:flex;gap:6px}.dp-seg button{min-width:38px;height:28px;border:0;border-radius:8px;background:#2c2c2e;color:#d1d1d6;font-size:13px}.dp-seg button.on{background:#d97757;color:#fff}
.dp-colors{display:flex;gap:9px}.dp-colors button{width:24px;height:24px;border-radius:50%;border:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}.dp-colors button.on{box-shadow:0 0 0 2px #1c1c1e,0 0 0 4px #d97757}
.dp-label{margin:18px 4px 6px;color:#8e8e93;font-size:13px}
.dp-cmds{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px}
.dp-cmds button{height:34px;border:0;border-radius:10px;background:#2c2c2e;color:#f2f2f7;font-size:13px}
.dp-cmds button:active{background:#d97757}
.dp-note{margin:8px 4px;color:#8e8e93;font-size:12px;line-height:1.6}
.dp-home-btn{width:100%;height:46px;border:0;border-radius:12px;background:#2c2c2e;color:#f5f5f7;font-size:15px}
.white .dp-group,.wx-white .dp-group{background:#fff}
`;document.head.appendChild(st);}

/* ---------- 角色心情 → 机器人状态 ---------- */
function lastRoleText(c){try{const ms=typeof msgs==='function'?(msgs(c.id)||[]):[];for(let i=ms.length-1,n=0;i>=0&&n<12;i--,n++){const m=ms[i];if(m&&m.role==='assistant'&&typeof m.content==='string'){if(Date.now()-(+m.time||+m.ts||0)>45*60000)return'';return m.content;}}}catch(_){}return'';}
function moodOf(c){
  if(!c)return'idle';
  if(c.blocked)return'sad';
  let spec=null;try{if(c.sched&&c.sched.on&&typeof activitySpec==='function')spec=activitySpec(c);}catch(_){}
  if(spec&&/sleep$/.test(spec.key)&&spec.busy>=3)return'sleep';
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
  party:{eyes:'star',micro:['happy','wink'],hat:'party',cls:'bob',speed:50,fx:['spark','heart'],every:3200},
};
const MOOD_CN={idle:'平常',happy:'开心',love:'想你、害羞',sad:'难过',angry:'生气',sleep:'睡着了',sleepy:'犯困',work:'陪你上班',party:'过节'};
const BODY_ANIM=/\b(bob|walking|shake|droop|dance|sway|hop|jump|spin|stretch|land|breathe)\b/;

/* 现在你在干嘛：听歌 / 打字 */
function musicOn(){try{if(typeof _mPlaying!=='undefined'&&_mPlaying)return true;}catch(_){}try{const c=cfg();if(S.music&&S.music.session&&c&&S.music.session.cid===c.cid)return true;}catch(_){}return false;}
function typingOn(now){return now-lastTypeAt<TYPE_MS;}
document.addEventListener('input',e=>{const t=e.target;if(!t||t.closest&&t.closest('.dp-page'))return;if(t.matches&&t.matches('textarea,input:not([type]),input[type=text],input[type=search],[contenteditable=""],[contenteditable=true]'))lastTypeAt=Date.now();},true);

/* 当前该是什么样子：拎着 > 不耐烦 > 被吩咐 > 你在打字 > 你在听歌 > 角色心情 */
function special(now){
  if(drag&&drag.moved)return{eyes:'wide',cls:'dangle',hat:look().hat,still:true};
  if(now<state.annoyedUntil)return{eyes:'angry',cls:'shake',hat:look().hat,still:false};
  if(state.cmd&&now<state.cmdUntil){const c=CMDS[state.cmd];return Object.assign({still:true,hat:look().hat},c);}
  if(typingOn(now))return{eyes:'focus',cls:'sit keys type',hat:'',fx:'code',every:1400,still:true};
  if(musicOn())return{eyes:'closed',cls:'sway',hat:'music',fx:'note',every:1500,still:true,micro:['happy']};
  if(state.napping)return{eyes:'closed',cls:'sit slow',hat:'',fx:'z',every:1900,still:true};
  return null;
}

/* ---------- 渲染 ---------- */
function look(){return MOOD_LOOK[state.mood]||MOOD_LOOK.idle;}
/* 换动作时不硬切：先把当前姿态冻住，用 0.24 秒缓到站直，再开始新动作 */
function settleBody(next){if(!root)return;const b=root.querySelector('.dp-body');if(!b)return;
  if(state.bodyAnim===next)return;const first=!state.bodyAnim;state.bodyAnim=next;if(first)return;
  let tr='none';try{tr=getComputedStyle(b).transform;}catch(_){}
  clearTimeout(settleTimer);b.style.transition='none';b.style.animation='none';b.style.transform=tr==='none'?'':tr;void b.getBoundingClientRect();
  b.style.transition='transform .24s ease-out,translate .28s ease';b.style.transform='none';
  settleTimer=setTimeout(()=>{b.style.transition='';b.style.animation='';b.style.transform='';},240);}
function applyLook(){if(!root)return;const now=Date.now(),L=look(),c=cfg(),col=DP_COLORS[c&&c.color]||DP_COLORS.clay,sp=special(now),dragging=drag&&drag.moved;
  root.style.setProperty('--dp-c',col[0]);root.style.setProperty('--dp-d',col[1]);root.style.setProperty('--dp-l',col[2]);
  let cls,eyes,hat;
  if(sp){cls=' '+sp.cls+' ';eyes=sp.eyes;hat=sp.hat||'';if(state.hop)cls=cls.replace(/\b(sit|keys|lie|type)\b/g,'')+' air';else if(state.moving&&!sp.still)cls+=' walking'+(legB?' leg-b':'');}
  else{cls=' '+(L.cls||'')+' ';eyes=L.eyes;hat=L.hat||'';
    if(state.hop)cls=cls.replace(/\b(sit|keys|bob|shake|droop)\b/g,'')+' air';
    else if(state.moving){cls=cls.replace(/\b(sit|keys|bob|droop)\b/g,'')+' walking';if(state.act==='skate')cls+=' skate';if(legB)cls+=' leg-b';}
    else if(state.act&&['dance','stretch','wave','look-l','look-r','sit','lie','hop'].includes(state.act)){if(['lie','sit'].includes(state.act))cls=cls.replace(/\bkeys\b/,'');cls+=' '+state.act;}
    if(state.react&&now<state.reactUntil){cls=cls.replace(/\b(shake|dance|hop|bob)\b/g,'')+' '+state.react;if(state.react==='pet')cls+=' blush';if(state.react==='warn')cls+=' sweat';}
    if(state.eyes&&now<state.eyesUntil)eyes=state.eyes;}
  if(!sp&&(state.climb===2||state.climb===3))cls+=' climbing';
  if(!dragging&&sp&&state.eyes&&now<state.eyesUntil&&sp.micro&&sp.micro.includes(state.eyes))eyes=state.eyes;
  if(!dragging&&!(sp&&now<state.annoyedUntil)&&state.react==='pet'&&now<state.reactUntil){eyes='heart';cls+=' blush';}
  if(!BODY_ANIM.test(cls))cls+=' breathe';
  if(eyes==='look-l'||eyes==='look-r'){cls+=' '+eyes;eyes=(sp?sp.eyes:L.eyes);}
  /* 换表情时先轻轻闭一下眼，不让眼睛直接跳变 */
  if(eyes!=='closed'&&state.shownEyes&&state.shownEyes!=='closed'&&eyes!==state.shownEyes&&!dragging){if(state.eyeTarget!==eyes){state.eyeTarget=eyes;state.eyeSwapUntil=now+90;}}
  let shown=eyes;if(now<state.eyeSwapUntil)shown='closed';else if(eyes!=='closed'&&(now<blinkAt+130||blink2&&now>blinkAt+260&&now<blinkAt+380))shown='closed';
  if(now>=state.eyeSwapUntil){state.shownEyes=eyes;state.eyeTarget='';}
  const list=cls.split(/\s+/).filter(Boolean),anim=(list.find(x=>BODY_ANIM.test(x))||'')+'|'+list.filter(x=>/^(sit|lie)$/.test(x)).join('');
  root.className='dp-root '+list.join(' ');settleBody(anim);
  /* 设置里关掉「戴帽子」：安全帽、睡帽、派对帽都摘掉；听歌的耳机另有开关 */
  if(c&&c.hats===false&&hat&&hat!=='music')hat='';if(c&&c.phones===false&&hat==='music')hat='';
  root.dataset.eyes=shown;root.dataset.hat=hat;
  place();}
function place(){if(!root)return;const d=dims();root.style.width=d.w+'px';root.style.height=d.h+'px';
  root.style.transform=`translate(${state.x}px,${state.y}px)`;
  const f=root.querySelector('.dp-flip');if(f)f.style.transform=`rotate(${state.rot}deg) scaleX(${state.face})`;}
function fx(kind,opt){if(!root)return;const F=FX[kind];if(!F)return;opt=opt||{};const h=host(),d=dims(),k=scale()*1.05,e=document.createElement('span');
  e.className='dp-fx'+(opt.pop?' pop':'');e.innerHTML=`<svg viewBox="0 0 ${F.w} ${F.h}" shape-rendering="crispEdges">${F.svg}</svg>`;
  e.style.width=F.w*k+'px';e.style.height=F.h*k+'px';e.style.setProperty('--dx',((Math.random()-.5)*24)+'px');
  const side=state.face>0?.62:.18;e.style.left=(state.x+d.w*(opt.center?.5-F.w*k/d.w/2:side+(Math.random()-.5)*.25))+'px';e.style.top=(state.y+d.h*(opt.top!=null?opt.top:0)-F.h*k)+'px';
  h.appendChild(e);setTimeout(()=>e.remove(),1600);}

/* ---------- 地面：聊天页就是输入框上沿，别的页面是屏幕底 ---------- */
function hostRect(){return host().getBoundingClientRect();}
function groundEl(){const list=document.querySelectorAll('.chat-inputbar,.inputbar');for(const el of list){if(el.closest('.modal'))continue;const r=el.getBoundingClientRect();if(r.width>40&&r.bottom>0&&r.top<window.innerHeight)return el;}return null;}
function groundY(){const hr=hostRect(),d=dims(),el=groundEl();if(el){const r=el.getBoundingClientRect();return Math.max(0,Math.min(bounds().h,r.top-hr.top-d.h*FOOT+1));}return bounds().h;}
function hostW(){return host().clientWidth||window.innerWidth;}

/* ---------- 聊天气泡：可以跳上去趴着，从一个气泡跳到另一个 ---------- */
function bubbleOk(el){const hr=hostRect(),d=dims();if(!el||!el.isConnected||el.closest('.modal'))return false;const r=el.getBoundingClientRect();
  if(r.width<d.w*.7||r.height<12)return false;const top=r.top-hr.top,g=groundEl();if(top-d.h*FOOT<60)return false;if(g&&r.bottom>g.getBoundingClientRect().top-4)return false;return r.bottom-hr.top<hr.height-40;}
function perchSpots(){return [...document.querySelectorAll('.msg .bubble')].filter(bubbleOk);}
function perchPos(el,ox){const hr=hostRect(),r=el.getBoundingClientRect(),d=dims();return{x:r.left-hr.left+ox,y:r.top-hr.top-d.h*FOOT+1,ok:bubbleOk(el)};}
function hopTo(x,y,opt){opt=opt||{};const b=bounds();if(state.out){state.out=null;if(root)root.style.visibility='';}state.moving=false;state.climb=0;state.rot=0;state.act='';state.onGround=false;
  const tx=Math.max(0,Math.min(b.w,x)),ty=Math.max(-dims().h*.2,Math.min(b.h,y)),dist=Math.hypot(tx-state.x,ty-state.y);
  state.face=tx<state.x?-1:1;state.hop={sx:state.x,sy:state.y,tx,ty,t0:performance.now(),dur:Math.min(900,380+dist*1.4),h:Math.min(110,30+dist*.35),perch:opt.perch||null,ground:!!opt.ground};if(!raf)loop();}
function perchOn(el){if(!bubbleOk(el))return false;const d=dims(),r=el.getBoundingClientRect(),ox=Math.max(-d.w*.15,Math.min(r.width-d.w*.85,Math.random()*(r.width-d.w)));
  const p=perchPos(el,ox);if(!p.ok)return false;hopTo(p.x,p.y,{perch:{el,ox}});state.perchUntil=Date.now()+12000+Math.random()*14000;return true;}
function tryPerch(){const spots=perchSpots().filter(el=>!state.perch||el!==state.perch.el);if(!spots.length)return false;
  /* 优先跳到离自己近的气泡，看起来是一格一格蹦过去的 */
  const hr=hostRect(),near=spots.map(el=>{const r=el.getBoundingClientRect();return{el,dist:Math.hypot(r.left-hr.left-state.x,r.top-hr.top-state.y)};}).sort((a,b)=>a.dist-b.dist);
  const pool=near.slice(0,Math.min(3,near.length));return perchOn(pick(pool).el);}
function newestBubble(){const all=perchSpots();return all[all.length-1]||null;}
function toGround(){const gy=groundY();if(Math.abs(state.y-gy)>50)hopTo(state.x+(Math.random()-.5)*60,gy,{ground:true});else walkTo(state.x,gy,{ground:true});}
function leavePerch(){state.perch=null;state.act='';toGround();}

/* ---------- 行为 ---------- */
function walkTo(x,y,opt){opt=opt||{};const b=bounds(),d=dims();const free=!!opt.free;state.tx=free?x:Math.max(0,Math.min(b.w,x));state.ty=Math.max(0,Math.min(b.h,y));state.walkGround=!!opt.ground;state.onGround=false;state.moving=true;state.face=state.tx<state.x?-1:1;if(!raf)loop();}
/* 跑出屏幕外，过几秒再从某一边跑回来 */
function runAway(){const d=dims(),left=state.x<hostW()/2;state.perch=null;state.hop=null;state.climb=0;state.rot=0;state.placedUntil=0;state.cmd='';state.out={phase:'leaving'};state.act='flee';walkTo(left?-d.w-12:hostW()+12,groundY(),{free:true});}
function comeBack(){const d=dims(),fromLeft=Math.random()<.5;state.out={phase:'back'};state.x=fromLeft?-d.w-8:hostW()+8;state.y=groundY();if(root)root.style.visibility='';state.act='';walkTo(fromLeft?40+Math.random()*100:bounds().w-40-Math.random()*100,groundY(),{ground:true});}
function chooseAct(now){
  const L=look(),b=bounds(),m=state.mood;state.act='';
  if(!L.speed){nextActAt=now+6000;return;}
  const r=Math.random(),playful=['idle','happy','love','party'].includes(m);
  if(now<state.placedUntil){/* 被你放在这里了：原地玩，不乱跑 */state.act=pick(['look-l','look-r','sit','wave','stretch',playful?'dance':'sit']);nextActAt=now+3000+Math.random()*3000;return;}
  if(state.perch){/* 在气泡上：趴着、蹦跶、发呆，或者跳到下一个气泡 */
    if(now>state.perchUntil){if(Math.random()<.55&&tryPerch()){}else leavePerch();nextActAt=now+2500;return;}
    if(r<.22&&tryPerch()){nextActAt=now+2200;return;}
    state.act=pick(playful?['hop','hop','lie','lie','dance','wave','look-l','look-r','sit']:['lie','sit','look-l','look-r']);nextActAt=now+2600+Math.random()*2600;return;}
  const gy=groundY(),offGround=Math.abs(state.y-gy)>4;
  if(offGround&&r<.7){toGround();nextActAt=now+2000;return;}
  if(m==='work'){if(r<.3)walkTo(state.x+(Math.random()-.5)*140,gy,{ground:true});nextActAt=now+7000+Math.random()*6000;return;}
  if(m==='sad'||m==='sleepy'){if(r<.3)walkTo(state.x+(Math.random()-.5)*100,gy,{ground:true});else state.act=pick(['sit','lie','look-l','look-r']);nextActAt=now+5000+Math.random()*5000;return;}
  if(m==='angry'){if(r<.5)walkTo(Math.random()*b.w,gy,{ground:true});else if(r<.62)runAway();else state.act='sit';nextActAt=now+4000+Math.random()*4000;return;}
  /* 平常 / 开心 / 想你 / 过节：在输入框上来回走，偶尔跳上气泡、溜滑板、爬墙、跑出去 */
  if(r<.42)walkTo(Math.random()*b.w,gy,{ground:true});
  else if(r<.58&&tryPerch()){}
  else if(r<.65){state.act='skate';walkTo(state.x<b.w/2?b.w:0,gy,{ground:true});}
  else if(r<.70){state.climb=1;walkTo(Math.random()<.5?0:b.w,state.y);}
  else if(r<.74)runAway();
  else state.act=pick(m==='idle'?['dance','stretch','wave','look-l','look-r','sit','sit']:['dance','dance','wave','stretch','hop']);
  nextActAt=now+4500+Math.random()*6000;
}
function loop(){raf=requestAnimationFrame(tick);}
function tick(t){raf=0;if(!root||document.hidden)return;const dt=Math.min(.05,last?(t-last)/1000:0);last=t;const now=Date.now(),sp=special(now);
  watchMessages(now);
  if(state.out&&state.out.phase==='away'){if(now>state.out.until)comeBack();loop();return;}
  if(sp&&sp.still&&state.moving&&!state.climb&&!state.out){state.moving=false;persist();}
  if(state.hop&&!drag){const H=state.hop,p=Math.min(1,(t-H.t0)/H.dur);let ty=H.ty;if(H.perch){const q=perchPos(H.perch.el,H.perch.ox);if(q.ok){H.tx=q.x;ty=H.ty=q.y;}}else if(H.ground){ty=H.ty=groundY();}
    state.x=H.sx+(H.tx-H.sx)*p;state.y=H.sy+(ty-H.sy)*p-H.h*4*p*(1-p);
    if(p>=1){state.hop=null;state.perch=H.perch&&bubbleOk(H.perch.el)?H.perch:null;state.onGround=!!H.ground;react('land',320);if(!state.perch)persist();nextActAt=now+900;}}
  else if(state.perch&&!drag){const q=perchPos(state.perch.el,state.perch.ox);if(!q.ok){/* 气泡滑走了 */state.perch=null;toGround();}else{state.x=q.x;state.y=q.y;}}
  else if(state.moving&&!drag){const L=look(),spd=(L.speed||30)*(state.act==='skate'?2.4:state.act==='flee'?3:1)*scale()/3;
    if(state.walkGround)state.ty=groundY();
    const dx=state.tx-state.x,dy=state.ty-state.y,dist=Math.hypot(dx,dy);
    if(dist<1.5){state.moving=false;state.x=state.tx;state.y=state.ty;
      if(state.out&&state.out.phase==='leaving'){state.out={phase:'away',until:now+3000+Math.random()*6000};root.style.visibility='hidden';state.act='';}
      else if(state.out&&state.out.phase==='back'){state.out=null;state.onGround=true;react('land',300);fx('spark');persist();}
      else if(state.climb===1){const b=bounds();state.climb=2;state.rot=state.x<=1?90:-90;state.face=1;walkTo(state.x,Math.max(0,state.y-(80+Math.random()*Math.min(260,b.h*.6))));}
      else if(state.climb===2){state.climb=3;setTimeout(()=>{if(state.climb===3){state.climb=0;state.rot=0;toGround();}},1500+Math.random()*2500);}
      else{if(state.act==='skate'||state.act==='flee')state.act='';state.onGround=state.walkGround;persist();}
    }else{const k=Math.min(1,spd*dt/dist);state.x+=dx*k;state.y+=dy*k;legT+=dt;if(legT>(state.act==='skate'?1:.15)){legT=0;legB=!legB;}}}
  else if(state.onGround&&!drag&&!state.climb){/* 输入框跟着键盘上下动时，它也跟着站稳 */const gy=groundY(),diff=gy-state.y;if(Math.abs(diff)>70)hopTo(state.x,gy,{ground:true});else if(Math.abs(diff)>.5)state.y+=diff*Math.min(1,dt*12);}
  if(now>blinkAt+2600+Math.random()*3500){blinkAt=now;blink2=Math.random()<.25;}
  if(state.reactUntil&&now>state.reactUntil){state.react='';state.reactUntil=0;}
  if(state.cmd&&now>=state.cmdUntil){state.cmd='';nextActAt=now+1500;}
  if(!state.napping&&!sp&&now-lastInteract>NAP_MS&&state.mood!=='sleep'&&!state.out&&!state.moving&&!state.hop){state.napping=true;state.act='';}
  const L=look();
  if(!sp&&!state.moving&&!state.hop&&!drag&&!state.climb&&!state.out&&now>nextActAt)chooseAct(now);
  const micro=sp?sp.micro:L.micro;
  if(!drag&&now>microAt&&!(state.eyes&&now<state.eyesUntil)){microAt=now+6000+Math.random()*9000;if(micro&&micro.length&&!state.moving){state.eyes=pick(micro);state.eyesUntil=now+900+Math.random()*900;}}
  const fxKind=sp?sp.fx:(L.fx&&pick(L.fx)),every=sp?(sp.every||2800):(L.every||4000);
  if(fxKind&&now>fxAt&&!drag){fxAt=now+every*(.8+Math.random()*.5);if(sp||state.mood!=='idle')fx(fxKind);}
  applyLook();loop();}
function react(kind,ms){state.react=kind;state.reactUntil=Date.now()+(ms||900);applyLook();}
function setEyes(e,ms){state.eyes=e;state.eyesUntil=Date.now()+ms;}
function refreshMood(force){const c=role();const m=moodOf(c);if(force||m!==state.mood){state.mood=m;state.act='';nextActAt=Date.now()+600;if(MOOD_LOOK[m]&&!MOOD_LOOK[m].speed){state.moving=false;state.climb=0;state.rot=0;}}moodAt=Date.now();}
function wake(){lastInteract=Date.now();if(state.napping){state.napping=false;setEyes('wide',350);setTimeout(()=>react('stretch',1600),350);}}

/* ---------- 有新消息时：角色来消息会精神一下跳到新气泡上；你发出去它会替你高兴 ---------- */
function watchMessages(now){if(now<msgCheckAt)return;msgCheckAt=now+800;const c=role();if(!c||typeof msgs!=='function')return;let ms;try{ms=msgs(c.id)||[];}catch(_){return;}
  const m=ms[ms.length-1],sig=m?(m.id||'')+'|'+ms.length:'';if(msgSig===null){msgSig=sig;return;}if(sig===msgSig)return;msgSig=sig;if(!m||Date.now()-(+m.time||0)>20000)return;
  wake();if(state.out){/* 正在跑出去就让它跑完；已经在外面了就跑回来看消息 */if(state.out.phase==='away')comeBack();return;}
  const here=typeof cur==='function'&&cur()&&cur().p==='chat'&&cur().id===c.id;
  if(m.role==='assistant'){state.cmd='';setEyes('wide',450);fx(state.mood==='love'?'heart':'spark',{pop:true});
    setTimeout(()=>{setEyes(state.mood==='love'?'heart':'happy',1200);if(here&&!drag&&!state.cmd&&!state.out){const el=newestBubble();if(!(el&&perchOn(el)))react('jump',500);}else react('jump',500);},450);}
  else if(m.role==='user'){react('jump',500);fx('heart');if(here&&Math.random()<.35)setTimeout(()=>{const el=newestBubble();if(el&&!drag&&!state.out)perchOn(el);},600);}}

/* 让它做一个表情 / 动作（角色标签或用户按钮） */
function doCmd(name,ms){const k=normCmd(name);if(!k)return false;wake();if(k==='平静'){state.cmd='';state.cmdUntil=0;return true;}
  if(state.out&&k!=='跑出去')comeBack();
  if(MOVES[k]){state.cmd='';if(root)MOVES[k]();return true;}
  state.cmd=k;state.cmdUntil=Date.now()+(ms||USER_CMD_MS);state.moving=false;state.act='';state.annoyedUntil=0;
  if(root){const C=CMDS[k];if(C.fx){fx(C.fx,{pop:true});setTimeout(()=>fx(C.fx),300);}applyLook();}return true;}
const MOVES={
  '跑出去':()=>runAway(),
  '过来':()=>{state.perch=null;state.placedUntil=0;const b=bounds();hopTo(b.w/2,groundY(),{ground:true});setTimeout(()=>fx('heart',{pop:true}),700);},
  '跳上气泡':()=>{if(!tryPerch())react('jump',500);},
};

/* ---------- 交互：点、摸、拖 ---------- */
function onDown(e){if(!root)return;e.preventDefault();e.stopPropagation();wake();try{root.setPointerCapture(e.pointerId);}catch(_){}
  drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,ox:state.x,oy:state.y,moved:false,at:Date.now()};
  clearTimeout(pressTimer);pressTimer=setTimeout(()=>{if(drag&&!drag.moved){drag.pet=true;pet();}},520);}
function onMove(e){if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
  if(!drag.moved&&Math.hypot(dx,dy)>6){drag.moved=true;clearTimeout(pressTimer);state.moving=false;state.climb=0;state.rot=0;state.act='';state.hop=null;state.perch=null;state.onGround=false;state.out=null;}
  if(drag.moved){const b=bounds();state.x=Math.max(0,Math.min(b.w,drag.ox+dx));state.y=Math.max(0,Math.min(b.h,drag.oy+dy));state.face=dx<0?-1:1;applyLook();}}
/* 放下时：落在气泡上就趴在气泡上，落在输入框附近就站在输入框上，其它地方就乖乖待在你放的位置 */
function dropAt(){const d=dims(),hr=hostRect(),fx0=state.x+d.w/2+hr.left,fy=state.y+d.h*FOOT+hr.top;
  const el=perchSpots().find(b=>{const r=b.getBoundingClientRect();return fx0>=r.left&&fx0<=r.right&&fy>=r.top-14&&fy<=r.top+Math.min(26,r.height);});
  if(el){const r=el.getBoundingClientRect();state.perch={el,ox:Math.max(-d.w*.15,Math.min(r.width-d.w*.85,state.x-(r.left-hr.left)))};state.perchUntil=Date.now()+25000;return;}
  const gy=groundY();if(Math.abs(state.y-gy)<36){state.y=gy;state.onGround=true;return;}
  state.placedUntil=Date.now()+PLACE_MS;}
function onUp(e){if(!drag||e.pointerId!==drag.id)return;clearTimeout(pressTimer);const d=drag;drag=null;
  if(d.moved){dropAt();react('land',360);setEyes('dizzy',1300);persist();nextActAt=Date.now()+2500;return;}
  if(d.pet)return;tap();}
/* 点一下冒爱心；连着点太多下会不耐烦，再点就生气跑开 */
function tap(){const now=Date.now();taps=taps.filter(t=>now-t<5000);taps.push(now);const n=taps.length;
  if(now<state.annoyedUntil){state.face=-state.face;fx('anger',{pop:true});state.annoyedUntil=now+5000;
    if(n>=9){taps=[];state.hop=null;state.annoyedUntil=0;runAway();}
    return;}
  if(n>=7){state.annoyedUntil=now+6000;state.face=-state.face;fx('anger',{pop:true});setTimeout(()=>fx('anger',{pop:true}),260);return;}
  setEyes('squint',220);setTimeout(()=>{if(Date.now()>=state.annoyedUntil)setEyes(n>=5?'wide':(state.mood==='love'?'heart':'happy'),900);},220);
  react(n>=5?'warn':'jump',n>=5?1400:500);
  fx('heart',{pop:n===1});if(n<=3&&Math.random()<.6)setTimeout(()=>fx('heart'),180);}
function pet(){react('pet',1800);setEyes('heart',1800);taps=[];for(let i=0;i<4;i++)setTimeout(()=>fx('heart'),i*200);if(navigator.vibrate)try{navigator.vibrate(12);}catch(_){}}
/* 你点屏幕别处时，它会转头看过去，有时还会好奇地走过去 */
document.addEventListener('pointerdown',e=>{if(!root||root.contains(e.target))return;wake();if(drag||state.hop||state.out||state.moving||state.climb)return;const hr=hostRect(),px=e.clientX-hr.left,d=dims();
  const left=px<state.x+d.w/2;state.face=left?-1:1;setEyes(left?'look-l':'look-r',900);
  if(!special(Date.now())&&state.onGround&&Date.now()>state.placedUntil&&Math.random()<.2&&Math.abs(px-state.x)>60)setTimeout(()=>{if(!state.moving&&!drag&&!state.hop)walkTo(px-d.w/2,groundY(),{ground:true});},500);},true);
document.addEventListener('keydown',()=>wake(),true);
document.addEventListener('scroll',()=>{wake();if(root&&state.perch&&Date.now()-wobbleAt>900){wobbleAt=Date.now();react('shake',350);}},true);

/* ---------- 挂载 ---------- */
function mount(){css();const h=host();root=document.createElement('div');root.className='dp-root';root.innerHTML=`<div class="dp-flip">${spriteSVG()}</div><i class="dp-shadow"></i>`;
  root.addEventListener('pointerdown',onDown);root.addEventListener('pointermove',onMove);root.addEventListener('pointerup',onUp);root.addEventListener('pointercancel',onUp);
  root.addEventListener('contextmenu',e=>e.preventDefault());h.appendChild(root);state.bodyAnim='';state.shownEyes='';
  const c=cfg(),b=bounds();state.x=c&&c.x>=0&&c.x<=b.w?c.x:b.w*.7;state.y=groundY();state.onGround=true;state.perch=null;state.hop=null;state.out=null;state.placedUntil=0;root.style.visibility='';refreshMood(true);applyLook();last=0;loop();}
function unmount(){if(raf)cancelAnimationFrame(raf);raf=0;if(root)root.remove();root=null;}
function sync(){const c=role();if(!c){if(root)unmount();return;}if(!root||!root.isConnected){unmount();mount();}else if(Date.now()-moodAt>12000)refreshMood();if(!raf&&!document.hidden)loop();}
setInterval(sync,2000);document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();return;}last=0;sync();
  /* 隔了一会儿再回来：它会挥手冒个爱心迎接你 */if(root&&hiddenAt&&Date.now()-hiddenAt>60000){wake();state.napping=false;setTimeout(()=>{react('wave',1600);fx('heart',{pop:true});},400);}});
window.addEventListener('resize',()=>{if(!root)return;const b=bounds();state.x=Math.min(state.x,b.w);state.y=Math.min(state.y,b.h);place();});

/* ---------- 角色那边：知道它叫什么，可以用 [桌宠|动作] 控制它 ---------- */
function deskPetPrompt(c){const p=cfg();if(!p||!p.on||!c||p.cid!==c.id)return'';const me=(typeof S!=='undefined'&&S.me&&S.me.name)||'她',n=petName(),now=Date.now(),sp=special(now);
  const doing=sp?(state.cmd&&now<state.cmdUntil?'正在'+state.cmd:typingOn(now)?'在陪'+me+'打字，假装敲代码':musicOn()?'戴着耳机闭眼听歌、左右摇摆':''):MOOD_CN[state.mood]||'平常';
  return '\n\n# 你们的虚拟桌面宠物「'+n+'」\n'+me+'的手机屏幕里住着一只像素风的虚拟桌面宠物小机器人，名字叫「'+n+'」。它是'+me+'在小手机里养的、跟着你的小家伙，平时站在聊天输入框上来回走，会跳上聊天气泡、爬墙、偶尔跑出屏幕又跑回来；它会跟着你的心情变表情。它是纯虚拟的，和实体桌面机器人「小K」没有任何关系，绝不能把两者混为一谈。'+(doing?'\n它现在：'+doing+'。':'')+
    '\n你可以在微信回复里另起一行写 [桌宠|动作] 让「'+n+'」照做，这一行不会显示给'+me+'。可用表情和动作：'+Object.keys(CMDS).join('、')+'、平静（恢复正常）；还能让它移动：'+Object.keys(MOVES).join('、')+'。一轮最多一个，不必每轮都用；'+me+'让你控制它、或者你想借它表达心情时再用。被问到它叫什么、在干嘛时，按上面的事实回答。';}
function deskPetConsume(text,c){const s=String(text==null?'':text);if(!/[\[【]\s*桌宠/.test(s))return text;const p=cfg();let used=false;
  const out=s.replace(/[\[【]\s*桌宠\s*[|｜:：]\s*([^\]】\r\n]{1,16})\s*[\]】]/g,(m,v)=>{if(!used&&p&&p.on&&c&&p.cid===c.id&&doCmd(v,ROLE_CMD_MS))used=true;return'';}).replace(/\n[ \t]*\n[ \t]*\n/g,'\n\n').trim();
  return out;}

/* ---------- 设置页（设置最下面的入口） ---------- */
function miniSprite(px){return `<svg viewBox="0 ${VB_Y+3} ${VB_W} ${VB_H-3}" shape-rendering="crispEdges" style="width:${px}px;height:${px}px;stroke:none;fill:initial;filter:none" aria-hidden="true">${R(3,8,1,3,'#b8603f')+R(5,8,1,3,'#b8603f')+R(10,8,1,3,'#b8603f')+R(12,8,1,3,'#b8603f')+R(2,1,12,7,'#d97757')+R(3,1,9,1,'#eb9a7e')+R(2,7,12,1,'#b8603f')+R(0,4,2,2,'#d97757')+R(14,4,2,2,'#d97757')+EYES.open}</svg>`;}
function deskPetRow(){const p=cfg(),r=role();return `<div class="ios-settings-group"><button type="button" class="ios-settings-row" data-settings-search="桌面宠物 桌宠 小机器人 像素 ${escH(petName())}" onclick="deskPetOpen()"><i class="ios-settings-icon" style="background:#2a1d18;--icon-a:#3a2620;--icon-b:#1d1411">${miniSprite(26)}</i><span><b>桌面宠物</b><small>${p&&p.on&&r?escH(petName())+' · 陪着'+escH(rname(r)):'像素小机器人 · 未开启'}</small></span><em>›</em></button></div>`;}
if(typeof settingsHomeHTML==='function'){const original=settingsHomeHTML;settingsHomeHTML=function(){const html=original.apply(this,arguments);return html.includes('deskPetOpen()')?html:html.replace('<div class="ios-settings-version"',deskPetRow()+'<div class="ios-settings-version"');};}
function deskPetOpen(){ensureCfg();if(typeof go==='function')go('deskPet');}
function renderDeskPetPage(){css();const p=ensureCfg(),r=role(),col=DP_COLORS[p.color]||DP_COLORS.clay,
  roles=(typeof S!=='undefined'&&Array.isArray(S.contacts)?S.contacts:[]).filter(c=>c&&!c.deleted&&!c.isGroup),
  seg=(k,l)=>`<button class="${p.size===k?'on':''}" onclick="deskPetSize('${k}')">${l}</button>`;
  return `<div class="nav ios-settings-nav"><span class="l" onclick="back()">‹</span><span class="t">桌面宠物</span><span class="r"></span></div><div class="scroll ios-settings dp-page">
  <div class="dp-hero"><div class="dp-root breathe" data-eyes="open" style="width:${VB_W*6}px;height:${VB_H*6}px;--dp-c:${col[0]};--dp-d:${col[1]};--dp-l:${col[2]}"><div class="dp-flip">${spriteSVG()}</div><i class="dp-shadow"></i></div>
   <b>${escH(petName())}</b><small>屏幕里的虚拟小机器人，和实体的小 K 是分开的</small></div>
  <div class="dp-group"><div class="dp-row"><span>开启桌面宠物</span><span class="sw ${p.on&&r?'on':''}" style="flex-shrink:0" onclick="deskPetToggle()"></span></div></div>
  <div class="dp-group">
   <div class="dp-row"><span>名字</span><input id="dp_name" maxlength="10" value="${escH(petName())}" placeholder="${DP_DEFAULT_NAME}" onchange="deskPetRename(this.value)"></div>
   <div class="dp-row"><span>陪着哪个角色</span><select onchange="deskPetBind(this.value)"><option value="">选择一个角色</option>${roles.map(c=>`<option value="${c.id}" ${p.cid===c.id?'selected':''}>${escH(rname(c))}</option>`).join('')}</select></div>
   <div class="dp-row"><span>戴帽子<br><small style="color:#8e8e93;font-size:12px">上班安全帽、睡觉睡帽、过节派对帽</small></span><span class="sw ${p.hats!==false?'on':''}" style="flex-shrink:0" onclick="deskPetWear('hats')"></span></div>
   <div class="dp-row"><span>听歌戴耳机</span><span class="sw ${p.phones!==false?'on':''}" style="flex-shrink:0" onclick="deskPetWear('phones')"></span></div>
   <div class="dp-row"><span>大小</span><div class="dp-seg">${seg('s','小')}${seg('m','中')}${seg('l','大')}</div></div>
   <div class="dp-row"><span>颜色</span><div class="dp-colors">${Object.keys(DP_COLORS).map(k=>`<button class="${(p.color||'clay')===k?'on':''}" title="${DP_COLOR_NAMES[k]}" style="background:${DP_COLORS[k][0]}" onclick="deskPetColor('${k}')"></button>`).join('')}</div></div>
  </div>
  <div class="dp-label">让${escH(petName())}做个表情</div>
  <div class="dp-group"><div class="dp-cmds">${Object.keys(CMDS).concat(Object.keys(MOVES)).map(k=>`<button onclick="deskPetCmd('${k}')">${k}</button>`).join('')}<button onclick="deskPetCmd('平静')">恢复</button></div></div>
  <button class="dp-home-btn" onclick="deskPetHome()">叫它回到屏幕中间</button>
  <div class="dp-note">· 只陪一个角色，跟着ta的心情和作息变表情：开心蹦跶、想你冒爱心、生气冒火、难过掉眼泪、上班戴安全帽、睡觉戴睡帽、过节戴派对帽。<br>· 你在听歌时它会戴上耳机、闭眼左右摇摆；你在打字时它会坐下来敲键盘。<br>· 角色知道它叫「${escH(petName())}」，也能在聊天里让它做表情；你也可以在上面直接点。<br>· 平时它站在聊天输入框上来回走，会从一个气泡跳到另一个气泡，偶尔跑出屏幕又跑回来。角色来消息时它会精神一下跳到新气泡上；你太久不理它，它会打瞌睡，碰一下屏幕就醒。<br>· 点它冒小爱心，连着点太多下会生气跑开；按住不动是摸摸；按住拖动可以把它放到任何地方，放在气泡上就趴在气泡上。</div>
  </div>`;}
function rerender(){if(typeof cur==='function'&&cur()&&cur().p==='deskPet'&&typeof render==='function')render();}
function deskPetToggle(){const p=ensureCfg();if(!p.on&&!(p.cid&&getC(p.cid))){if(typeof toast==='function')toast('先选一个要陪的角色');return;}p.on=!p.on;if(p.on){p.x=-1;p.y=-1;}save();if(root)unmount();sync();rerender();if(typeof toast==='function')toast(p.on?petName()+'出来啦':petName()+'回去休息了');}
function deskPetBind(id){const p=ensureCfg();p.cid=id||'';if(!id)p.on=false;else if(!p.on){p.on=true;p.x=-1;p.y=-1;}save();if(root)unmount();sync();rerender();}
function deskPetRename(v){const p=ensureCfg();p.name=String(v||'').trim().slice(0,10)||DP_DEFAULT_NAME;save();
  /* 在输入框失焦时整页重绘会和浏览器的 blur 处理撞车，只改名字出现的几处 */
  const n=petName();document.querySelectorAll('.dp-page .dp-hero b').forEach(e=>e.textContent=n);document.querySelectorAll('.dp-page .dp-label').forEach(e=>e.textContent='让'+n+'做个表情');if(typeof toast==='function')toast('它现在叫「'+petName()+'」了');}
function deskPetSize(k){ensureCfg().size=k;save();if(root){unmount();sync();}rerender();}
function deskPetColor(k){ensureCfg().color=k;save();applyLook();rerender();}
function deskPetWear(k){const p=ensureCfg();p[k]=p[k]===false;save();applyLook();rerender();if(typeof toast==='function')toast(k==='hats'?(p.hats===false?'帽子摘下来啦':'帽子戴回去啦'):(p.phones===false?'听歌不戴耳机了':'听歌会戴耳机'));}
function deskPetCmd(k){if(!root){if(typeof toast==='function')toast('先开启桌面宠物');return;}doCmd(k,USER_CMD_MS);}
function deskPetHome(){if(!root){if(typeof toast==='function')toast('先开启桌面宠物');return;}doCmd('过来');}
Object.assign(window,{deskPetOpen,renderDeskPetPage,deskPetToggle,deskPetBind,deskPetRename,deskPetSize,deskPetColor,deskPetWear,deskPetCmd,deskPetHome,deskPetPrompt,deskPetConsume,
  __deskPet:{moodOf,state:()=>Object.assign({},state,{perch:!!state.perch,hop:!!state.hop}),refresh:()=>refreshMood(true),sync,tryPerch,tap,doCmd,runAway,groundY,newestBubble,nap:()=>{lastInteract=0;},normCmd,special:()=>special(Date.now()),typed:()=>{lastTypeAt=Date.now();},EYES:Object.keys(EYES),CMDS:Object.keys(CMDS)}});
})();
