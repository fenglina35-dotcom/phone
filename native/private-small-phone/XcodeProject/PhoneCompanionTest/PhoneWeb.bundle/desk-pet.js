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
  /* ROLE_BODY_V1：打瞌睡——眼皮耷拉，只剩一条缝 */
  drowsy:R(3,4,3,1,'var(--dp-d)')+R(3,5,3,1,INK)+R(10,4,3,1,'var(--dp-d)')+R(10,5,3,1,INK),
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
    <g class="dp-hat dp-hat-fever">${R(5,1,6,2,'#eef6ff')}${R(5,1,6,1,'#cfe8ff')}${R(6,2,4,1,'#9fd0ff')}${R(5,3,6,0,'#fff')}</g>
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
  /* 想你：冒一个白色思念泡泡，里面一颗粉心；亲亲：飞出一个像素红唇（DESK_PET_MISS_KISS_HUG_V1） */
  miss:{w:9,h:7,svg:R(1,0,7,6,'#d9d2e4')+R(0,1,9,4,'#d9d2e4')+R(1,1,7,4,'#fff')+R(2,0,5,1,'#fff')+R(2,5,5,1,'#fff')+P([[3,1],[5,1],[2,2],[3,2],[4,2],[5,2],[6,2],[3,3],[4,3],[5,3],[4,4]],'#ff5c8a')+R(0,6,1,1,'#fff')},
  /* ROLE_BODY_V1：饿了——头上冒一朵云，里面一块电池 */
  hungry:{w:13,h:10,svg:R(2,0,9,7,'#d9d2e4')+R(1,1,11,5,'#d9d2e4')+R(0,2,13,3,'#d9d2e4')+R(2,1,9,5,'#fff')+R(1,2,11,3,'#fff')+R(3,0,7,1,'#fff')+R(3,6,7,1,'#fff')+R(3,2,6,3,'#3a3f4c')+R(9,3,1,1,'#3a3f4c')+R(4,3,1,1,'#7ee0a1')+R(6,3,1,1,'#7ee0a1')+R(1,8,2,1,'#fff')+R(0,9,1,1,'#fff')},
  kiss:{w:7,h:3,svg:R(1,0,2,1,'#e8334f')+R(4,0,2,1,'#e8334f')+R(0,1,7,1,'#e8334f')+R(1,2,5,1,'#c81f3d')+R(2,1,3,1,'#ff7a90')},
};

/* 角色或用户可以让它做的表情 / 动作 */
const CMDS={
  '开心':{eyes:'happy',cls:'bob',fx:'spark'},
  '爱心眼':{eyes:'heart',cls:'bob blush',fx:'heart'},
  '星星眼':{eyes:'star',cls:'bob',fx:'spark'},
  '平静':{eyes:'open',cls:''},
  '醒来':{eyes:'open',hat:'',cls:''},
  '戴帽子':{eyes:'open',hat:'party',cls:''},
  '戴耳机':{eyes:'closed',hat:'music',cls:'sway',fx:'note'},
  '眨眼':{eyes:'wink',cls:''},
  '害羞':{eyes:'happy',cls:'blush',fx:'heart'},
  '难过':{eyes:'sad',cls:'droop tear',fx:'dots'},
  '生气':{eyes:'angry',cls:'shake',fx:'anger'},
  '惊讶':{eyes:'wide',cls:'sweat'},
  '晕乎乎':{eyes:'dizzy',cls:'sway'},
  '睡觉':{eyes:'closed',hat:'sleep',cls:'sit slow',fx:'z'},
  '打瞌睡':{eyes:'drowsy',cls:'nod slow',fx:'z'},
  '跳舞':{eyes:'happy',cls:'dance',fx:'note'},
  '挥手':{eyes:'happy',cls:'wave'},
  '蹦跶':{eyes:'happy',cls:'hop'},
  '转圈':{eyes:'happy',cls:'spin'},
  '伸懒腰':{eyes:'closed',cls:'stretch'},
  '趴下':{eyes:'open',cls:'lie'},
  '坐下':{eyes:'open',cls:'sit'},
  '想你':{eyes:'happy',cls:'bob blush',fx:'miss'},
  '亲亲':{eyes:'wink',cls:'bob',fx:'kiss'},
  '抱抱':{eyes:'wide',cls:'hug',fx:'heart'},
};
const CMD_ALIAS={'想你了':'想你','好想你':'想你','么么哒':'亲亲','亲一个':'亲亲','亲一下':'亲亲','求抱抱':'抱抱','抱一下':'抱抱','抱一个':'抱抱','醒醒':'醒来','醒过来':'醒来','起床':'醒来','醒':'醒来','笑一笑':'开心','笑起来':'开心','笑一个':'开心','回来':'过来','高兴':'开心','笑':'开心','爱心':'爱心眼','喜欢':'爱心眼','星星':'星星眼','哭':'难过','伤心':'难过','委屈':'难过','发火':'生气','气':'生气','吃惊':'惊讶','晕':'晕乎乎','睡':'睡觉','舞':'跳舞','招手':'挥手','跳':'蹦跶','趴':'趴下','坐':'坐下'};
function normPetSetting(v){const aliases={'摘帽子':'摘帽子','脱帽子':'摘帽子','摘耳机':'摘耳机','取下耳机':'摘耳机','戴上帽子':'戴帽子','戴上耳机':'戴耳机'};if(aliases[v])return aliases[v];const color=String(v||'').match(/^(?:颜色|换颜色)[|｜:：](.+)$/);if(color){const key=Object.keys(DP_COLORS).find(k=>k===color[1]||DP_COLOR_NAMES[k]===color[1]);return key?'颜色:'+key:'';}const size=String(v||'').match(/^(?:大小|尺寸)[|｜:：](小|中|大|s|m|l)$/);if(size)return'大小:'+({小:'s',中:'m',大:'l'}[size[1]]||size[1]);const name=String(v||'').match(/^(?:名字|改名)[|｜:：]([^\[\]【】|｜<>]{1,10})$/);return name?'名字:'+name[1]:'';}
function applyPetSetting(k){const p=cfg();if(!p)return false;if(k==='摘帽子')p.hats=false;else if(k==='摘耳机')p.phones=false;else if(k.startsWith('颜色:'))p.color=k.slice(3);else if(k.startsWith('大小:'))p.size=k.slice(3);else if(k.startsWith('名字:'))p.name=k.slice(3);else return false;if(root&&k.startsWith('大小:')){unmount();sync();}else applyLook();save();rerender();return true;}
function normCmd(v){v=String(v||'').trim().replace(/[。！!~～\s]/g,'');const setting=normPetSetting(v);if(setting)return setting;if(CMDS[v]||MOVES[v])return v;if(/^(出去|跑掉|溜走|躲起来)$/.test(v))return'跑出去';if(/^(回来|过来吧|来这里|到这来)$/.test(v))return'过来';if(/气泡/.test(v))return'跳上气泡';if(CMD_ALIAS[v])return CMD_ALIAS[v];if(/^(恢复|正常|停|停下|好了|别闹了)$/.test(v))return'恢复';for(const k of Object.keys(CMDS))if(v.includes(k))return k;for(const [a,k] of Object.entries(CMD_ALIAS))if(v.includes(a))return k;return'';}

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
.dp-root[data-hat=work] .dp-hat-work,.dp-root[data-hat=sleep] .dp-hat-sleep,.dp-root[data-hat=party] .dp-hat-party,.dp-root[data-hat=music] .dp-hat-music,.dp-root[data-hat=fever] .dp-hat-fever{display:inline;animation:dpHatIn .32s cubic-bezier(.3,1.4,.5,1)}
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
.dp-root.nod .dp-body{animation:dpNod 2.6s ease-in-out infinite;transform-origin:50% 90%}
@keyframes dpNod{0%,55%,100%{transform:translateY(0) rotate(0)}70%{transform:translateY(1px) rotate(-7deg)}80%{transform:translateY(0) rotate(-2deg)}88%{transform:translateY(1px) rotate(-8deg)}}
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
.dp-root.hug .dp-nub-l,.dp-root.hug .dp-nub-r{animation:dpHug .5s steps(1) infinite} @keyframes dpHug{0%{transform:translateY(1px)}50%{transform:translateY(-1px)}} .dp-fx{position:absolute;z-index:181;pointer-events:none;animation:dpFx 1.5s ease-out forwards}
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
.dp-tabs{display:flex;gap:6px;margin:4px 0 2px;padding:3px;border-radius:12px;background:rgba(120,120,128,.24)}
.dp-tabs button{flex:1;height:32px;border:0;border-radius:9px;background:transparent;color:inherit;font-size:14px;opacity:.75}
.dp-tabs button.on{background:#d97757;color:#fff;opacity:1;font-weight:600}
.dp-hero-wrap{position:relative;padding-top:34px}
.dp-hero-cloud{position:absolute;left:62%;top:0;width:62px;height:48px;animation:dpCloud 2.4s ease-in-out infinite}
@keyframes dpCloud{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.dp-status{margin:14px 4px 0;font-size:15px}
.dp-status b{color:#d97757}
.dp-stats{padding:6px 14px}
.dp-stat{display:grid;grid-template-columns:44px 1fr 34px;align-items:center;gap:10px;min-height:38px;font-size:14px}
.dp-stat i{display:block;height:10px;border-radius:5px;background:rgba(120,120,128,.25);overflow:hidden}
.dp-stat i b{display:block;height:100%;border-radius:5px;transition:width .4s ease}
.dp-stat em{font-style:normal;text-align:right;font-variant-numeric:tabular-nums;opacity:.8}
.dp-stat small{grid-column:2/4;margin-top:-6px;font-size:11px;opacity:.6}
.dp-items{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
.dp-items button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;border:0;border-radius:14px;background:rgba(120,120,128,.2);color:inherit;font-size:14px}
.dp-items button svg{width:52px;height:42px}
.dp-items button small{font-size:11px;opacity:.6}
.dp-items button:active{transform:scale(.96)}
.dp-log{padding:8px 14px;font-size:13px;line-height:1.9}
.dp-log h5{margin:6px 0 2px;font-size:12px;font-weight:600;opacity:.55}
.dp-log h5:first-child{margin-top:0}
.dp-log time{display:inline-block;width:46px;opacity:.55;font-variant-numeric:tabular-nums}
.dp-link{width:100%;background:transparent;border:0;text-align:left;color:inherit;font:inherit}
.dp-link em{font-style:normal;opacity:.5}
.dp-row b{font-weight:500;opacity:.85}
.dp-page input[type=time]{color:#f5f5f7;color-scheme:dark;font-variant-numeric:tabular-nums}
.dp-page input[type=time]::-webkit-calendar-picker-indicator{opacity:.9}
.dp-page .sw.on{background:#d97757!important;border-color:#d97757!important}
.dp-page .dp-link em,.dp-page .dp-row select{color:#d97757}
.dp-items button.on{box-shadow:inset 0 0 0 2px #d97757}
.dp-items button small{color:#d97757;opacity:.9}
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
  const _body=typeof bodyOn==='function'&&bodyOn(c);let _bm='';if(_body){const b=bodyTick(c);if(b.asleep)return'sleep';if(b.eating)return'eat';_bm=bodyLookOf(b);}
  if(_bm){/* 有心情时先显示几秒心情，再切回身体（每 14 秒：5 秒心情、9 秒身体） */const emo=emotionOf(c,true);return emo&&!['idle','sleepy','work','party'].includes(emo)&&Math.floor(Date.now()/1000)%14<5?emo:_bm;}
  const e=emotionOf(c,_body);return _body&&e==='sleepy'?'idle':e;/* 开着身体状态时，困不困只看精力 */}
function bodyLookOf(b){if(b.sick)return'sick';if(b.full<50)return'hungry';if(b.energy<50)return'doze';if(b.health<50)return'weak';return'';}
function emotionOf(c,_body){
  let spec=null;try{if(c.sched&&c.sched.on&&typeof activitySpec==='function')spec=activitySpec(c);}catch(_){}
  if(!_body&&spec&&/sleep$/.test(spec.key)&&spec.busy>=3)return'sleep';
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
  idle:{eyes:'open',micro:['wink','look-l','look-r','happy','look-l','star'],hat:'',cls:'',speed:38},
  happy:{eyes:'open',micro:['happy','happy','star','wink'],hat:'',cls:'bob',speed:55,fx:['spark','note'],every:5000},
  love:{eyes:'open',micro:['heart','heart','happy','wink'],hat:'',cls:'blush',speed:45,fx:['heart'],every:2600},
  sad:{eyes:'sad',micro:['closed'],hat:'',cls:'droop tear',speed:16,fx:['dots'],every:7000},
  angry:{eyes:'angry',micro:['squint'],hat:'',cls:'shake',speed:60,fx:['anger'],every:3500},
  sleep:{eyes:'closed',micro:[],hat:'sleep',cls:'sit slow',speed:0,fx:['z'],every:1700},
  sleepy:{eyes:'closed',micro:['open','dizzy'],hat:'',cls:'slow',speed:18,fx:['z'],every:5000},
  work:{eyes:'focus',micro:['open','squint'],hat:'work',cls:'sit keys',speed:30,fx:['dots','spark'],every:8000},
  party:{eyes:'open',micro:['star','happy','happy','wink'],hat:'party',cls:'bob',speed:50,fx:['spark','heart'],every:3200},
  /* ROLE_BODY_V1：生病——额头贴退烧贴、有气无力，不跳不跑，只在下面待着；饿了——慢吞吞，头上冒电池云 */
  sick:{eyes:'sad',micro:['closed','closed'],hat:'fever',cls:'droop slow',speed:0,fx:['dots'],every:6500},
  hungry:{eyes:'sad',micro:['open','closed'],hat:'',cls:'slow',speed:14,fx:['hungry'],every:4200},
  eat:{eyes:'happy',micro:['closed','happy'],hat:'',cls:'sit bob',speed:0,fx:['spark'],every:6000},
  doze:{eyes:'drowsy',micro:['closed','closed','open'],hat:'',cls:'nod slow',speed:8,fx:['z'],every:4600},
  weak:{eyes:'sad',micro:['closed'],hat:'',cls:'droop sweat slow',speed:12,fx:['dots'],every:7500},
};
const MOOD_CN={eat:'在吃饭',sick:'生病了，有气无力',hungry:'饿了',doze:'困得打瞌睡',weak:'身体虚，没精神',idle:'平常',happy:'开心',love:'想你、害羞',sad:'难过',angry:'生气',sleep:'睡着了',sleepy:'犯困',work:'陪你上班',party:'过节'};
const BODY_ANIM=/\b(nod|bob|walking|shake|droop|dance|sway|hop|jump|spin|stretch|land|breathe)\b/;

/* 现在你在干嘛：听歌 / 打字 */
function musicOn(){try{if(typeof _mPlaying!=='undefined'&&_mPlaying)return true;}catch(_){}try{const c=cfg();if(S.music&&S.music.session&&c&&S.music.session.cid===c.cid)return true;}catch(_){}return false;}
function typingOn(now){return now-lastTypeAt<TYPE_MS;}
document.addEventListener('input',e=>{const t=e.target;if(!t||t.closest&&t.closest('.dp-page'))return;if(t.matches&&t.matches('textarea,input:not([type]),input[type=text],input[type=search],[contenteditable=""],[contenteditable=true]'))lastTypeAt=Date.now();},true);

/* 当前该是什么样子：拎着 > 不耐烦 > 被吩咐 > 你在打字 > 你在听歌 > 角色心情 */
function special(now){
  if(drag&&drag.moved)return{eyes:'wide',cls:'dangle',hat:look().hat,still:true};
  if(now<state.annoyedUntil)return{eyes:'angry',cls:'shake',hat:look().hat,still:false};
  if(state.cmd&&now<state.cmdUntil){const c=CMDS[state.cmd]||{eyes:'open',cls:'',hat:'',still:false};return Object.assign({still:true,hat:look().hat},c);}
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
  if(!dragging&&!(sp&&now<state.annoyedUntil)&&!(state.cmd&&now<state.cmdUntil)&&state.react==='pet'&&now<state.reactUntil){eyes='heart';cls+=' blush';}
  if(!BODY_ANIM.test(cls))cls+=' breathe';
  if(eyes==='look-l'||eyes==='look-r'){cls+=' '+eyes;eyes=(sp?sp.eyes:L.eyes);}
  /* 换表情时先轻轻闭一下眼，不让眼睛直接跳变 */
  if(eyes!=='closed'&&state.shownEyes&&state.shownEyes!=='closed'&&eyes!==state.shownEyes&&!dragging){if(state.eyeTarget!==eyes){state.eyeTarget=eyes;state.eyeSwapUntil=now+90;}}
  let shown=eyes;if(now<state.eyeSwapUntil)shown='closed';else if(eyes!=='closed'&&(now<blinkAt+130||blink2&&now>blinkAt+260&&now<blinkAt+380))shown='closed';
  if(now>=state.eyeSwapUntil){state.shownEyes=eyes;state.eyeTarget='';}
  const list=cls.split(/\s+/).filter(Boolean),anim=(list.find(x=>BODY_ANIM.test(x))||'')+'|'+list.filter(x=>/^(sit|lie)$/.test(x)).join('');
  root.className='dp-root '+list.join(' ');settleBody(anim);
  /* 设置里关掉「戴帽子」：安全帽、睡帽、派对帽都摘掉；听歌的耳机另有开关 */
  const _fever=hat==='fever';if(c&&c.hats===false&&hat&&hat!=='music')hat='';if(c&&c.phones===false&&hat==='music')hat='';if(_fever)hat='fever';/* 退烧贴不算帽子，关掉戴帽子也照样贴 */
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
function runAway(){const d=dims(),left=state.x<hostW()/2;state.perch=null;state.hop=null;state.climb=0;state.rot=0;state.placedUntil=0;if(state.cmd!=='跑出去')state.cmd='';state.out={phase:'leaving'};state.act='flee';walkTo(left?-d.w-12:hostW()+12,groundY(),{free:true});}
function comeBack(){const d=dims(),fromLeft=Math.random()<.5;state.out={phase:'back'};state.x=fromLeft?-d.w-8:hostW()+8;state.y=groundY();if(root)root.style.visibility='';state.act='';walkTo(fromLeft?40+Math.random()*100:bounds().w-40-Math.random()*100,groundY(),{ground:true});}
function chooseAct(now){
  const L=look(),b=bounds(),m=state.mood;state.act='';
  if(m==='sick'||m==='sleep'||m==='eat'){/* ROLE_BODY_V1：生病、睡着就待在下面，不跳不爬 */if(state.perch)leavePerch();else if(Math.abs(state.y-groundY())>4&&!state.moving)toGround();else if(m==='sick')state.act=pick(['lie','sit','lie']);nextActAt=now+6000;return;}
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
  if(m==='sad'||m==='sleepy'||m==='doze'||m==='weak'||m==='hungry'){if(r<.3)walkTo(state.x+(Math.random()-.5)*100,gy,{ground:true});else state.act=pick(['sit','lie','look-l','look-r']);nextActAt=now+5000+Math.random()*5000;return;}
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
  watchMessages(now);if(now-moodAt>2000){const _c=role();if(_c&&bodyOn(_c))refreshMood();}
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
  if(!drag&&now>microAt&&!(state.eyes&&now<state.eyesUntil)){/* 平时是黑色小竖条眼睛，开心 / 想你 / 过节时隔一会儿换成笑眼、爱心眼、星星眼，过一两秒再回到平静 */microAt=now+(state.mood==='idle'?6000+Math.random()*9000:3500+Math.random()*5000);if(micro&&micro.length&&!state.moving){state.eyes=pick(micro);state.eyesUntil=now+1200+Math.random()*1300;}}
  const fxKind=sp?sp.fx:(L.fx&&pick(L.fx)),every=sp?(sp.every||2800):(L.every||4000);
  if(fxKind&&now>fxAt&&!drag){fxAt=now+every*(.8+Math.random()*.5);if(sp||state.mood!=='idle')fx(fxKind,fxKind==='hungry'?{center:true,pop:true}:undefined);}
  applyLook();loop();}
function react(kind,ms){state.react=kind;state.reactUntil=Date.now()+(ms||900);applyLook();}
function setEyes(e,ms){state.eyes=e;state.eyesUntil=Date.now()+ms;}
function refreshMood(force){const c=role();const m=moodOf(c);if(force||m!==state.mood){state.mood=m;state.act='';nextActAt=Date.now()+600;if(!(state.cmd&&Date.now()<state.cmdUntil)&&MOOD_LOOK[m]&&!MOOD_LOOK[m].speed){state.moving=false;state.climb=0;state.rot=0;}}moodAt=Date.now();}
function wake(){lastInteract=Date.now();if(state.napping){state.napping=false;setEyes('wide',350);setTimeout(()=>react('stretch',1600),350);}}

/* ---------- 有新消息时：角色来消息会精神一下跳到新气泡上；你发出去它会替你高兴 ---------- */
function watchMessages(now){if(now<msgCheckAt)return;msgCheckAt=now+800;const c=role();if(!c||typeof msgs!=='function')return;let ms;try{ms=msgs(c.id)||[];}catch(_){return;}
  const m=ms[ms.length-1],sig=m?(m.id||'')+'|'+ms.length:'';if(msgSig===null){msgSig=sig;return;}if(sig===msgSig)return;msgSig=sig;if(!m||Date.now()-(+m.time||0)>20000)return;
  wake();if(state.cmd&&now<state.cmdUntil){applyLook();return;}if(['sick','sleep','doze','weak'].includes(state.mood)){applyLook();return;}if(state.out){/* 正在跑出去就让它跑完；已经在外面了就跑回来看消息 */if(state.out.phase==='away')comeBack();return;}
  const here=typeof cur==='function'&&cur()&&cur().p==='chat'&&cur().id===c.id;
  if(m.role==='assistant'){setEyes('wide',450);fx(state.mood==='love'?'heart':'spark',{pop:true});
    setTimeout(()=>{setEyes(state.mood==='love'?'heart':'happy',1200);if(here&&!drag&&!state.cmd&&!state.out){const el=newestBubble();if(!(el&&perchOn(el)))react('jump',500);}else react('jump',500);},450);}
  else if(m.role==='user'){react('jump',500);fx('heart');if(here&&Math.random()<.35)setTimeout(()=>{const el=newestBubble();if(el&&!drag&&!state.out)perchOn(el);},600);}}

/* 让它做一个表情 / 动作（角色标签或用户按钮） */
function doCmd(name,ms){const k=normCmd(name);if(!k)return false;if(applyPetSetting(k))return true;if(k==='戴帽子')ensureCfg().hats=true;if(k==='戴耳机')ensureCfg().phones=true;if(k==='戴帽子'||k==='戴耳机')save();wake();
  state.react='';state.reactUntil=0;state.eyes='';state.eyesUntil=0;state.annoyedUntil=0;state.napping=false;
  state.climb=0;state.rot=0;state.hop=null;state.moving=false;state.act='';state.cmd=k==='恢复'?'':k;state.cmdUntil=k==='恢复'?0:Date.now()+(ms||USER_CMD_MS);
  if(k==='恢复'){applyLook();return true;}
  if(state.out&&k!=='跑出去'){state.out=null;if(root)root.style.visibility='';state.x=Math.max(0,Math.min(bounds().w,state.x));state.y=groundY();}
  if((MOVES[k]||['跳舞','蹦跶','转圈'].includes(k))&&(state.mood==='sleep'||state.mood==='sick')){/* ROLE_BODY_V1：睡着、生病时不乱跑，指令照收但不动 */state.cmd='';state.cmdUntil=0;applyLook();return true;}
  if(MOVES[k]){if(root)MOVES[k]();applyLook();return true;}
  if(root){const C=CMDS[k];if(C.fx){fx(C.fx,{pop:true});setTimeout(()=>{if(state.cmd===k)fx(C.fx);},300);}applyLook();}return true;
}
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
function deskPetRequestedCommand(text,c){const p=cfg();if(!p||!p.on||!c||p.cid!==c.id||typeof actId==='function'&&actId()!=='main')return'';
  const t=String(text||'').trim();if(/如果|假如|要是|昨天|之前|曾经|别让|不要让|不想|不希望|不需要|不用|不能|不可以|别叫|不要叫/.test(t))return'';
  if(/实体|硬件|真实机器人|桌面机器人|小K/.test(t)&&!/虚拟|桌宠|桌面宠物/.test(t))return'';
  const names=[petName(),'桌面虚拟宠物','虚拟桌面宠物','桌面小宠物','桌面宠物','小宠物','桌宠'],name=names.find(n=>n&&t.includes(n));if(!name)return'';
  const at=t.indexOf(name),before=t.slice(0,at),after=t.slice(at+name.length).replace(/^[，,：:\s]+/,'');
  if(!/想|希望|请|帮我|让|叫|把|给|能不能|可不可以/.test(before)&&!new RegExp('^(?:请|你)?'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(t))return'';
  if(/^(?:会|能|可以|为什么|怎么).*[吗？?]$/.test(after)||/^(?:不|别|不要)/.test(after.trim()))return'';
  return normCmd(after);
}
function deskPetApplyUserRequest(c,text){const k=deskPetRequestedCommand(text,c);return k&&doCmd(k,ROLE_CMD_MS)?k:'';}
if(typeof pushMsg==='function'){const original=pushMsg;pushMsg=function(id,m){const result=original.apply(this,arguments),page=typeof cur==='function'&&cur();if(page&&page.p==='chat'&&page.id===id&&m&&m.role==='user'&&(m.type==='text'||m.type==='voice')&&!m._call)deskPetApplyUserRequest(getC(id),m.content||m.text||'');return result;};}
function deskPetPrompt(c){const body=roleBodyPrompt(c);return deskPetPromptBase(c)+body;}
function deskPetPromptBase(c){const p=cfg();if(!p||!p.on||!c||p.cid!==c.id)return'';const me=(typeof S!=='undefined'&&S.me&&S.me.name)||'她',n=petName(),now=Date.now(),sp=special(now);
  const doing=sp?(state.cmd&&now<state.cmdUntil?'正在'+state.cmd:typingOn(now)?'在陪'+me+'打字，假装敲代码':musicOn()?'戴着耳机闭眼听歌、左右摇摆':''):MOOD_CN[state.mood]||'平常';
  return '\n\n# 你们的虚拟桌面宠物「'+n+'」\n'+me+'的手机屏幕里住着一只像素风的虚拟桌面宠物小机器人，名字叫「'+n+'」。它是'+me+'在小手机里养的、跟着你的小家伙，平时站在聊天输入框上来回走，会跳上聊天气泡、爬墙、偶尔跑出屏幕又跑回来；它会跟着你的心情变表情。它是纯虚拟的，和实体桌面机器人「小K」没有任何关系，绝不能把两者混为一谈。'+(doing?'\n它现在：'+doing+'。':'')+
    '\n你可以在微信回复里另起一行写 [桌宠|动作] 让「'+n+'」照做，这一行不会显示给'+me+'。可用表情和动作：'+Object.keys(CMDS).join('、')+'、恢复（回到跟着你心情的样子）；还能让它移动：'+Object.keys(MOVES).join('、')+'。也可以设置[桌宠|摘帽子]、[桌宠|摘耳机]、[桌宠|颜色:陶土橙/草莓粉/薄荷绿/奶油白/天空蓝]（只选择一种）、[桌宠|大小:小/中/大]（只选择一种）、[桌宠|名字:新名字]；改名、改颜色和大小只在用户明确要求时执行。用户明确要求它笑、醒来或做动作时，必须使用有效桌宠指令，不能只在嘴上说已完成；醒来用[桌宠|醒来]，笑用[桌宠|开心]。不要用它操控实体小K。一轮最多一个，不必每轮都用；'+me+'让你控制它、或者你想借它表达心情时再用。被问到它叫什么、在干嘛时，按上面的事实回答。';}
function deskPetConsume(text,c){text=typeof roleBodyConsume==='function'?roleBodyConsume(text,c):text;const s=String(text==null?'':text);if(!/[\[【]\s*桌宠/.test(s))return text;const p=cfg();let used=false;
  const out=s.replace(/[\[【]\s*桌宠\s*(?:[|｜:：]\s*)?([^\]】\r\n]{1,16})\s*[\]】]/g,(m,v)=>{if(!used&&p&&p.on&&c&&p.cid===c.id&&doCmd(v,ROLE_CMD_MS))used=true;return'';}).replace(/\n[ \t]*\n[ \t]*\n/g,'\n\n').trim();
  return out;}

/* ---------- 设置页（设置最下面的入口） ---------- */
function miniSprite(px){return `<svg viewBox="0 ${VB_Y+3} ${VB_W} ${VB_H-3}" shape-rendering="crispEdges" style="width:${px}px;height:${px}px;stroke:none;fill:initial;filter:none" aria-hidden="true">${R(3,8,1,3,'#b8603f')+R(5,8,1,3,'#b8603f')+R(10,8,1,3,'#b8603f')+R(12,8,1,3,'#b8603f')+R(2,1,12,7,'#d97757')+R(3,1,9,1,'#eb9a7e')+R(2,7,12,1,'#b8603f')+R(0,4,2,2,'#d97757')+R(14,4,2,2,'#d97757')+EYES.open}</svg>`;}
function deskPetRow(){const p=cfg(),r=role();return `<div class="ios-settings-group"><button type="button" class="ios-settings-row" data-settings-search="桌面宠物 桌宠 小机器人 像素 ${escH(petName())}" onclick="deskPetOpen()"><i class="ios-settings-icon" style="background:#2a1d18;--icon-a:#3a2620;--icon-b:#1d1411">${miniSprite(26)}</i><span><b>桌面宠物</b><small>${p&&p.on&&r?escH(petName())+' · 陪着'+escH(rname(r)):'像素小机器人 · 未开启'}</small></span><em>›</em></button></div>`;}
/* ---------- 他的身体（ROLE_BODY_V1，2026-11-05 她要求） ----------
   只管身体，不管情绪：精力（困不困）、饱腹、健康、生病、睡觉，按真实时间自己走；告诉角色的只是身体事实，怎么反应由他按人设决定。
   只用在桌宠陪着的那个角色身上。她可以喂电池（一块＝一顿）、给药（马上好）、戴睡帽（睡）/摘睡帽（醒）；他也能自己吃饭、睡觉、起床、去看病。
   到点不会硬睡：过了睡觉点、而且 15 分钟没人说话才睡着；她发消息会把他吵醒。状态存在 S.roleBody[角色id]，不改记忆、不额外调用模型。 */
const BODY_MEAL=35,BODY_SICK=[['感冒',3,['嗓子有点疼，鼻子不通','发烧、嗓子疼，身上没力气','好多了，还有点咳嗽']],['发烧',2,['发烧，头昏沉沉的','烧退了些，还是没什么力气']],['胃不舒服',1,['胃不太舒服，没什么胃口']],['头疼',1,['头一直隐隐作痛']]];
function clamp01(v,max){return Math.max(0,Math.min(max||100,+v||0));}
function hm(v,d){const m=String(v||d).match(/^(\d{1,2}):(\d{2})$/);return m?(+m[1])*60+(+m[2]):hm(d,'00:00');}
function minsOf(t){const d=new Date(t);return d.getHours()*60+d.getMinutes();}
function dayKey(t){const d=new Date(t-4*3600000);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function atMins(t,m){const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()+m*60000;}
function fmtHM(t){const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function bodyCfg(){const p=ensureCfg();p.body=Object.assign({on:true,sleepAt:'23:30',wakeAt:'07:30',sick:'some'},p.body||{});p.body.meals=Object.assign({b:'',l:'',d:''},p.body.meals||{});return p.body;}
function bodyOn(c){const p=cfg();return !!(p&&p.on&&c&&p.cid===c.id&&bodyCfg().on);}
function bodyState(c){S.roleBody=S.roleBody||{};const now=Date.now();let b=S.roleBody[c.id];if(!b)b=S.roleBody[c.id]={energy:80,full:70,health:80,asleep:false,sleepBy:'',sleptAt:0,wokeAt:now,lastSleepH:0,lastMealAt:now-3*3600000,meals:0,day:dayKey(now),dayLate:false,mealWin:{},sick:null,log:[],events:[],lastTick:now};return b;}
function bodyLog(b,text,t){/* 照顾记录保留最近 3 天（按天显示），更早的自动清掉 */const cut=atMins(Date.now(),0)-2*86400000;b.log=(b.log||[]).concat({t:t||Date.now(),text}).filter(x=>x.t>=cut).slice(-80);}
function bodyEvent(b,text,t,kind){b.events=(b.events||[]).filter(e=>!kind||e.kind!==kind).concat({t:t||Date.now(),text,kind:kind||''}).slice(-8);}
function bodyNight(m){const cf=bodyCfg(),S0=hm(cf.sleepAt,'23:30'),W=hm(cf.wakeAt,'07:30');return S0>W?(m>=S0||m<W):(m>=S0&&m<W);}
function lastChatAt(c){let t=0;try{const ms=msgs(c.id)||[];const m=ms[ms.length-1];t=+(m&&m.time)||0;}catch(_){}try{const h=S.cohabitation&&S.cohabitation.homes&&S.cohabitation.homes[c.id],m=h&&h.msgs&&h.msgs[h.msgs.length-1];t=Math.max(t,+(m&&m.time)||0);}catch(_){}return t;}
function lastUserAt(c){let t=0;try{const ms=msgs(c.id)||[];for(let i=ms.length-1;i>=0&&i>ms.length-20;i--){if(ms[i]&&ms[i].role==='user'&&ms[i].type!=='sys'){t=+ms[i].time||0;break;}}}catch(_){}try{const h=S.cohabitation&&S.cohabitation.homes&&S.cohabitation.homes[c.id],a=h&&h.msgs||[];for(let i=a.length-1;i>=0&&i>a.length-20;i--){if(a[i]&&a[i].who==='me'){t=Math.max(t,+a[i].time||0);break;}}}catch(_){}return t;}
function bodySleep(b,by,t){if(b.asleep)return;b.asleep=true;b.sleepBy=by;b.sleptAt=t;const m=minsOf(t),S0=hm(bodyCfg().sleepAt,'23:30');if(bodyNight(m)&&((m-S0+1440)%1440)>60)b.dayLate=true;}
function bodyWake(b,t,why){if(!b.asleep)return;b.asleep=false;b.sleepBy='';b.wokeAt=t;b.lastSleepH=Math.max(0,(t-(b.sleptAt||t))/3600000);if(why)b.wakeWhy=why;}
function bodyMeal(b,t,who,name){b.full=clamp01(b.full+BODY_MEAL,130);b.lastMealAt=t;b.meals=(b.meals||0)+1;if(b.full>100){b.stuffed=t;if(b.full>115)b.health=clamp01(b.health-2);}bodyLog(b,(who==='me'?'你喂了一块电池':'他自己去吃了'+(name||'饭'))+(b.full>100?'（吃撑了）':''),t);}
function bodyRollDay(b,t){/* 健康慢慢变（她说：不会掉得那么快）：一天最多掉 6 左右，好好过一天涨 4 左右 */const n=b.meals||0;let d=n>=3?2:n===2?-1:-3;d+=b.dayLate?-3:b.sleptOnTime?2:0;if(b.sick)d-=1;b.health=clamp01(b.health+d);
  /* BODY_RISK_V1（她说：生病不该按次数抽，要看他有没有好好吃饭、好好睡觉，还有天气；照顾得细心就不会生病）：
     每天结算「生病苗头」0~120：吃不够、熬夜、天气差、健康低、咖啡太多会涨，按时三顿和早睡会消；到 100 才病，越高病得越重。 */
  const cf=bodyCfg();let w=0;try{const W=S.weather;if(W&&(W.rain||+W.temp<8||+W.temp>33))w=15;}catch(_){}
  let r=(n>=3?-4:n===2?3:8)+(b.dayLate?8:b.sleptOnTime?-4:1)+(w?4:0)+(b.health<50?4:0)+((b.coffeeN||0)>=3?3:0);/* 长期累积：吃一顿加熬夜，大约连着一个星期才会病 */
  b.risk=Math.max(0,Math.min(120,(+b.risk||0)+r));
  if(!b.sick&&cf.sick!=='off'&&b.risk>=100){bodySick(b,t,'',b.risk>=118?'high':b.risk>=108?'mid':'low');b.risk=30;}
  b.day=dayKey(t);b.coffeeN=0;b.meals=0;b.dayLate=false;b.sleptOnTime=false;b.mealWin={};}
/* BODY_TEMP_V1：生病分轻重——低烧（约37.5℃）、中度（约38.3℃）、高烧（约39℃），轻的多重的少；越重病得越久。胃不舒服、头疼不发烧。 */
const BODY_FEVER={感冒:1,发烧:1},BODY_SEV={low:{name:'低烧',peak:37.6,days:.7},mid:{name:'中度发烧',peak:38.3,days:1},high:{name:'高烧',peak:39.1,days:1.4}};
function bodySick(b,t,kind,sev){const k=BODY_SICK.find(x=>x[0]===kind)||BODY_SICK[Math.floor(Math.random()*BODY_SICK.length)],r=Math.random();sev=BODY_SEV[sev]?sev:(r<.45?'low':r<.8?'mid':'high');const S0=BODY_SEV[sev],days=Math.max(1,Math.round(k[1]*S0.days)),fever=!!BODY_FEVER[k[0]];
  b.sick={kind:k[0],sev,fever,peak:fever?+(S0.peak+(Math.random()-.5)*.3).toFixed(1):37.1,start:t,until:atMins(t,0)+days*86400000+4*3600000,cared:''};bodyLog(b,'他'+k[0]+'了'+(fever?'（'+S0.name+'）':''),t);}
function bodyTemp(b,t){const h=new Date(t).getHours(),base=36.5+(h>=17&&h<23?.2:h<6?-.1:0);if(!b.sick)return base;const s=b.sick,p=Math.max(0,Math.min(1,(t-s.start)/Math.max(1,s.until-s.start)));let v;if(!s.fever)v=base+.3*(p<.6?1:1-(p-.6)/.4);else if(p<.25)v=37.2+(s.peak-37.2)*(p/.25);else if(p<.5)v=s.peak;else v=s.peak-(s.peak-37.1)*((p-.5)/.5);return Math.max(base,v);}
function bodyTempLabel(v){return v<37.3?'正常':v<38?'低烧':v<39?'中度发烧':'高烧';}
function bodySickDay(b,t){return b.sick?Math.floor((atMins(t,0)-atMins(b.sick.start,0))/86400000)+1:0;}
function bodySickText(b,t){if(!b.sick)return'';const k=BODY_SICK.find(x=>x[0]===b.sick.kind)||BODY_SICK[0],d=bodySickDay(b,t),sv=b.sick.fever&&BODY_SEV[b.sick.sev]?'（'+BODY_SEV[b.sick.sev].name+'）':'';return b.sick.kind+sv+'第'+d+'天：'+(k[2][Math.min(d,k[2].length)-1]||k[2][0]);}
function bodyMealTimes(c){const cf=bodyCfg(),m=cf.meals||{};let amE=12*60,pmE=18*60;try{const sc=c.sched;if(sc&&sc.on){amE=hm(sc.amE,'12:00');pmE=hm(sc.pmE,'18:00');}}catch(_){}const W=hm(cf.wakeAt,'07:30');return{b:m.b?hm(m.b,'08:00'):W+30,l:m.l?hm(m.l,'12:00'):amE,d:m.d?hm(m.d,'18:30'):pmE+30};}
function mmHM(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
/* 三个饭点：到点先「该吃饭了」，他跟她说一声再去吃（或者没人说话时自己去）；饭点过了 90 分钟还没吃就算没顾上 */
function bodyMealWindows(c,t){const T=bodyMealTimes(c);return[['早饭',T.b,T.b+90],['午饭',T.l,T.l+90],['晚饭',T.d,T.d+90]];}
function bodyStartEat(b,name,t,why){if(b.eating||b.asleep)return false;b.eating={name:name||'饭',since:t,until:t+30*60000,extra:0,lastUser:t};b.due=null;bodyLog(b,why==='her-wait'?'他先去吃'+(name||'饭')+'了':'他去吃'+(name||'饭')+'了',t);return true;}
function bodyTick(c,now){const b=bodyState(c);if(!bodyOn(c))return b;now=now||Date.now();let t=Math.max(b.lastTick||now,now-72*3600000);const userAt=lastUserAt(c);
  while(t<now){const step=Math.min(now-t,10*60000),h=step/3600000,t2=t+step;
    if(dayKey(t2)!==b.day)bodyRollDay(b,t2);
    const m=minsOf(t2),night=bodyNight(m),chat=lastChatAt(c);
    if(b.asleep&&userAt>b.sleptAt+60000&&userAt<=t2){bodyWake(b,userAt,'her');bodyEvent(b,'你睡着时她发消息把你吵醒了',userAt);}
    if(!b.asleep&&night&&t2-chat>=15*60000&&t2>(b.wokeAt||0)+3600000&&!(b.coffeeUntil>t2)){const st=Math.max(atMins(t2,hm(bodyCfg().sleepAt,'23:30'))-(m<hm(bodyCfg().wakeAt,'07:30')?86400000:0),chat+15*60000,t);bodySleep(b,'self',Math.min(st,t2));if(!b.dayLate)b.sleptOnTime=true;bodyLog(b,'他睡着了',b.sleptAt);}
    if(b.asleep&&!night&&(b.sleepBy!=='hat'||b.energy>=95)){bodyWake(b,t2,'morning');bodyLog(b,'他醒了',t2);}
    if(b.asleep){b.energy=clamp01(b.energy+14*h);b.full=clamp01(b.full-2.5*h,130);}else{b.energy=clamp01(b.energy-(b.sick?(b.sick.sev==='high'?9:7.8):6)*h);b.full=clamp01(b.full-5*h,130);}
    if(b.eating){if(userAt>b.eating.lastUser&&userAt<=t2){b.eating.lastUser=userAt;if(b.eating.extra<30){b.eating.extra+=3;b.eating.until+=3*60000;}}if(t2>=b.eating.until){const nm=b.eating.name;b.mealWin[nm]=1;b.eating=null;bodyMeal(b,t2,'self',nm);}}
    bodyMealWindows(c,t2).forEach(([name,a,z])=>{const start=atMins(t2,a),end=atMins(t2,z);if(b.mealWin[name])return;if(b.lastMealAt>=start-30*60000){b.mealWin[name]=1;if(b.due&&b.due.name===name)b.due=null;return;}
      if(t2>=start&&t2<end&&!b.asleep&&!b.eating){if(!b.due||b.due.name!==name)b.due={kind:'meal',name,at:start};if(t2-chat>=15*60000)bodyStartEat(b,name,Math.max(start,chat+15*60000,t),'self');}
      else if(t2>=end&&end>t2-step-1&&!b.eating){b.mealWin[name]=1;if(b.due&&b.due.name===name)b.due=null;bodyLog(b,'他没顾上吃'+name,end);}});
    if(b.sick&&t2>=b.sick.until){bodyLog(b,'他的'+b.sick.kind+'好了',t2);bodyEvent(b,'你的'+b.sick.kind+'好了',t2);b.sick=null;}
    t=t2;}
  b.lastTick=now;return b;}
function bodyBar(v,max){return Math.round(Math.max(0,Math.min(max||100,v)));}
/* 给角色看的：只有事实，有变化或明显时才说；最近两轮他已经提过身体，就叫他这几轮别再主动提 */
function roleBodyPrompt(c){if(!bodyOn(c))return'';const now=Date.now(),b=bodyTick(c,now),cf=bodyCfg(),me=(typeof S!=='undefined'&&S.me&&S.me.name)||'她',f=[];
  if(b.asleep)f.push('你'+fmtHM(b.sleptAt)+'睡着了，现在还在睡'+(b.sleepBy==='hat'?'（是'+me+'给你戴上睡帽让你睡的）':''));
  else{const awakeH=(now-(b.wokeAt||now))/3600000,m=minsOf(now);if(b.wakeWhy==='her'&&now-b.wokeAt<10*60000)f.push('你刚才在睡觉，被'+me+'的消息吵醒了（睡了大约'+Math.max(0,b.lastSleepH).toFixed(1)+'小时）');
    if(bodyNight(m)&&now-b.wokeAt>3600000)f.push('到你平时睡觉的点了（'+cf.sleepAt+'），你醒了大约'+Math.round(awakeH)+'小时'+(b.energy<30?'，很困了':'')+'。要睡的话先跟'+me+'道个晚安再睡，不要聊着聊着突然消失；睡的时候另起一行写 [身体|睡觉]。她再找你，你照样会被叫醒回她');else if(b.energy<25)f.push('你醒了大约'+Math.round(awakeH)+'小时，很困');
    if(b.coffeeUntil>now)f.push('你喝了咖啡，现在很精神'+((b.coffeeN||0)>=3?'，今天喝太多了，有点心慌':'')+(bodyNight(minsOf(now))?'，一时半会儿睡不着':''));
    if(b.eating)f.push('你正在吃'+b.eating.name+'（大约还要'+Math.max(1,Math.round((b.eating.until-now)/60000))+'分钟）；'+me+'发消息你照样回，可以边吃边回，只是会吃得慢一点');
    else if(b.due&&b.due.kind==='meal')f.push('到饭点了（'+b.due.name+' '+fmtHM(b.due.at)+'），你该去吃'+b.due.name+'了：先跟'+me+'说一声（比如“我先去吃饭了”）再去，不要说着说着突然消失；去的时候另起一行写 [身体|吃饭]。她找你你照样可以回');}
  if(b.full>100)f.push('你吃撑了，肚子胀');else if(b.full<30){const h=Math.round((now-(b.lastMealAt||now))/3600000);f.push('你上一顿是'+fmtHM(b.lastMealAt)+'左右，已经'+h+'小时没吃东西，'+(b.full<10?'饿得厉害':'有点饿'));}
  if(b.sick)f.push('你'+bodySickText(b,now)+(b.sick.cared?'（'+b.sick.cared+'）':''));else if((+b.risk||0)>=70)f.push('你这几天没怎么好好吃饭睡觉，身体有点不对劲（嗓子发干、有点乏），再这样下去可能要生病');
  (b.events||[]).filter(e=>now-e.t<30*60000).forEach(e=>f.push(e.text));
  if(!f.length)return'';
  let quiet=false;try{const ms=(msgs(c.id)||[]).filter(m=>m&&m.role==='assistant').slice(-2).map(m=>String(m.content||''));quiet=ms.length===2&&ms.every(x=>/困|睡|饿|吃饭|吃撑|生病|感冒|发烧|头疼|胃|药|医院|身体/.test(x));}catch(_){}
  return '\n\n# 你的身体现在（只是事实，不规定你的情绪和语气）\n'+f.map(x=>'· '+x).join('\n')+'\n怎么反应由你按人设决定。日常聊天为主，身体最多偶尔自然带一句，不要每轮都提，也不要拿来卖惨'+(quiet?'；你最近两轮已经提过身体了，这轮别再主动提，除非'+me+'问起':'')+'。你自己去吃饭、睡觉、起床或去医院看病时，可以另起一行写 [身体|吃饭]、[身体|睡觉]、[身体|起床]、[身体|看病]，这一行不会显示给'+me+'。';}
function roleBodyConsume(text,c){const s=String(text==null?'':text);if(!/[\[【]\s*身体/.test(s))return text;const on=bodyOn(c);
  return s.replace(/[\[【]\s*身体\s*[|｜:：]\s*([^\]】\r\n]{1,12})\s*[\]】]/g,(m,v)=>{if(on){const b=bodyTick(c),t=Date.now();v=String(v).trim();
      if(/吃/.test(v)){if(!b.eating)bodyStartEat(b,b.due&&b.due.name||'饭',t,'her-wait');}else if(/睡/.test(v)){bodySleep(b,'self',t);bodyLog(b,'他自己去睡了',t);}else if(/起|醒/.test(v)){bodyWake(b,t,'self');bodyLog(b,'他起床了',t);}else if(/看病|医院|医生/.test(v)&&b.sick){b.sick.until=Math.min(b.sick.until,t+2*3600000);b.sick.cared='你去医院看过医生了';bodyLog(b,'他自己去医院看了病',t);}
      if(typeof save==='function')save();refreshMood(true);}return'';}).replace(/\n[ \t]*\n[ \t]*\n/g,'\n\n').trim();}
/* 她照顾他：喂电池、给药、戴睡帽 / 摘睡帽 */
function deskPetBodyUse(kind){const c=role();if(!c||!bodyOn(c)){if(typeof toast==='function')toast('先开启桌面宠物，并在「他的身体」里打开身体状态');return;}const b=bodyTick(c),t=Date.now(),n=rname(c),me=(S.me&&S.me.name)||'她';
  if(kind==='battery'){if(b.asleep){toast(n+'睡着呢，等他醒了再喂');return;}if(b.eating){b.mealWin[b.eating.name]=1;b.eating=null;}if(b.due&&b.due.kind==='meal'){b.mealWin[b.due.name]=1;b.due=null;}bodyMeal(b,t,'me');bodyEvent(b,me+'刚喂你吃了一顿（一块电池）'+(b.full>100?'，你吃撑了':''),t);toast(b.full>100?n+'吃撑了':n+'吃饱一点了');if(root)doCmd(b.full>100?'晕乎乎':'开心',USER_CMD_MS);}
  else if(kind==='pill'){if(!b.sick){toast(n+'没生病，药先收着');return;}const k=b.sick.kind;b.sick=null;bodyLog(b,'你喂他吃了药，'+k+'好了',t);bodyEvent(b,me+'喂你吃了药，你的'+k+'好了',t);toast(n+'的'+k+'好了');if(root)doCmd('开心',USER_CMD_MS);}
  else if(kind==='hat'){if(b.asleep&&b.sleepBy==='hat'){bodyWake(b,t,'hat');bodyLog(b,'你摘下了他的睡帽，他醒了',t);bodyEvent(b,me+'摘下了你的睡帽，你醒了',t);toast(n+'醒了');if(root)doCmd('伸懒腰',USER_CMD_MS);}else{if(b.asleep)bodyWake(b,t);bodySleep(b,'hat',t);bodyLog(b,'你给他戴上睡帽，他睡了',t);bodyEvent(b,me+'给你戴上了睡帽，让你去睡觉',t);toast(n+'戴上睡帽睡了');}}
  else if(kind==='coffee'){if(b.asleep){toast(n+'睡着呢，等他醒了再喝');return;}b.coffeeN=(b.coffeeN||0)+1;b.energy=clamp01(b.energy+30);b.coffeeUntil=t+5*3600000;if(b.coffeeN>=3)b.health=clamp01(b.health-3);bodyLog(b,'你给他冲了一杯咖啡'+(b.coffeeN>=3?'（今天第'+b.coffeeN+'杯，有点多）':''),t);bodyEvent(b,me+'给你冲了一杯咖啡'+(b.coffeeN>=3?'，今天第'+b.coffeeN+'杯了':''),t);toast(n+'精神了'+(b.coffeeN>=3?'，但喝太多会心慌':''));if(root)doCmd(b.coffeeN>=3?'晕乎乎':'星星眼',USER_CMD_MS);}
  else if(kind==='temp'){const v=+(bodyTemp(b,t)+(Math.random()-.5)*.2).toFixed(1),lb=bodyTempLabel(v);b.lastTemp={v,t,label:lb};const vs=v.toFixed(1);bodyLog(b,'你给他量了体温：'+vs+'℃（'+lb+'）',t);bodyEvent(b,me+'刚给你量了体温，'+vs+'℃（'+lb+'）',t,'temp');toast(vs+'℃ · '+lb);}
  else if(kind==='sick'){bodySick(b,t);toast(n+b.sick.kind+'了');}
  if(typeof save==='function')save();refreshMood(true);rerender();}
function bodyCfgSickToggle(){return bodyCfg().sick==='off'?'some':'off';}
function deskPetBodySet(k,v){const cf=bodyCfg();if(k==='on')cf.on=!cf.on;else if(k==='sleepAt'||k==='wakeAt'){if(/^\d{1,2}:\d{2}$/.test(v))cf[k]=v;}else if(k==='sick')cf.sick=['off','rare','some'].includes(v)?v:'some';else if(/^meal_[bld]$/.test(k)){if(/^\d{1,2}:\d{2}$/.test(v))cf.meals[k.slice(5)]=v;}if(typeof save==='function')save();refreshMood(true);rerender();}
let _dpTab='pet';
function deskPetTab(k){_dpTab=k==='body'?'body':'pet';rerender();}
function bodyItemSVG(k){if(k==='battery')return R(1,3,11,7,'#2b2f3a')+R(12,5,2,3,'#2b2f3a')+R(2,4,9,5,'#3a3f4c')+R(3,5,2,3,'#7ee0a1')+R(6,5,2,3,'#7ee0a1')+R(9,5,1,3,'#7ee0a1')+R(2,4,9,1,'#525a6b');
  if(k==='pill')return R(2,5,6,4,'#ff7a90')+R(8,5,5,4,'#fff')+R(1,6,1,2,'#ff7a90')+R(13,6,1,2,'#fff')+R(3,5,3,1,'#ffb3c1')+R(8,4,0,0,'#fff')+R(2,9,11,1,'#d9d2e4');
  if(k==='coffee')return R(3,4,8,6,'#f2ede4')+R(4,5,6,4,'#6b4226')+R(4,5,6,1,'#8a5a36')+R(11,5,2,1,'#f2ede4')+R(12,6,1,2,'#f2ede4')+R(11,8,2,1,'#f2ede4')+R(2,10,10,1,'#d9d2e4')+R(5,1,1,2,'#cfd3dc')+R(7,0,1,2,'#cfd3dc')+R(9,1,1,2,'#cfd3dc');
  if(k==='temp')return R(6,0,3,8,'#e9eef5')+R(7,1,1,7,'#ff5c6c')+R(5,8,5,3,'#e9eef5')+R(6,9,3,1,'#ff5c6c')+R(7,8,1,3,'#ff5c6c')+R(9,2,1,1,'#9aa3b2')+R(9,4,1,1,'#9aa3b2')+R(9,6,1,1,'#9aa3b2');
  return R(3,6,9,2,'#6d7fd6')+R(4,5,7,1,'#6d7fd6')+R(6,4,5,1,'#6d7fd6')+R(9,3,3,1,'#6d7fd6')+R(12,2,2,2,'#fff')+R(3,8,9,1,'#fff');}
/* 上班作息搬到这里（SCHEDULE_IN_PET_V1）：和原来的作息窗口存的是同一份 c.sched，改了立刻生效；请假、节假日仍用原来那部分（按钮打开） */
function schedSectionHTML(c){const sc=c.sched||{},on=!!sc.on,row=(l,k,v,type,ph)=>`<div class="dp-row"><span>${l}</span><input ${type?`type="${type}"`:''} value="${escH(v)}" ${ph?`placeholder="${escH(ph)}"`:''} onchange="deskPetSchedSet('${c.id}','${k}',this.value)"></div>`;
  return `<div class="dp-group"><div class="dp-row"><span>按作息上班<br><small style="color:#8e8e93;font-size:12px">周一到周五上班，周末休息</small></span><span class="sw ${on?'on':''}" style="flex-shrink:0" onclick="deskPetSchedSet('${c.id}','on')"></span></div>${on?row('工作地点','work',sc.work||'','','公司 / 医院 / 工作室…')+row('家','home',sc.home||'家','')+row('上午上班','amS',sc.amS||'08:00','time')+row('上午下班','amE',sc.amE||'12:00','time')+row('下午上班','pmS',sc.pmS||'14:00','time')+row('下午下班','pmE',sc.pmE||'18:00','time')+`<button type="button" class="dp-row dp-link" onclick="deskPetLeaves('${c.id}')"><span>请假与节假日</span><em>›</em></button>`:''}</div>`;}
function deskPetSchedSet(id,k,v){const c=typeof getC==='function'&&getC(id);if(!c)return;const old=c.sched||{};const sc=c.sched=Object.assign({on:false,work:'',home:'家',amS:'08:00',amE:'12:00',pmS:'14:00',pmE:'18:00',holidays:true,leaves:[]},old);
  if(k==='on')sc.on=!sc.on;else if(['amS','amE','pmS','pmE'].includes(k)){if(/^\d{1,2}:\d{2}$/.test(v))sc[k]=v;}else if(k==='work'||k==='home')sc[k]=String(v||'').trim().slice(0,30)||(k==='home'?'家':'公司');
  delete c._currentActivity;try{const d=typeof cohabData==='function'&&cohabData(id);if(d){delete d.scheduleSlotKey;if(d.stateSource==='owner-manual')d.stateSource='schedule-auto';if(typeof cohabAdvance==='function')cohabAdvance(id);}}catch(_){}
  if(typeof save==='function')save();refreshMood(true);rerender();}
function deskPetLeaves(id){if(typeof _schedModal==='function')_schedModal(id);}
function bodyPageHTML(c){if(!c)return'<div class="dp-note">先在「宠物」那页选一个要陪的角色，并打开桌面宠物。</div>';const cf=bodyCfg(),n=escH(rname(c));
  if(!cf.on)return `<div class="dp-group"><div class="dp-row"><span>身体状态<br><small style="color:#8e8e93;font-size:12px">会困、会饿、会生病，不是 24 小时永动机</small></span><span class="sw" style="flex-shrink:0" onclick="deskPetBodySet('on')"></span></div></div>`;
  const now=Date.now(),b=bodyTick(c,now),bar=(label,v,max,col,tip)=>`<div class="dp-stat"><span>${label}</span><i><b style="width:${Math.min(100,bodyBar(v,max)/(max||100)*100)}%;background:${col}"></b></i><em>${bodyBar(v,max)}</em>${tip?`<small>${tip}</small>`:''}</div>`;
  const status=b.eating?'正在吃'+b.eating.name:b.due&&b.due.kind==='meal'?'到饭点了，该吃'+b.due.name:b.asleep?'睡着了（'+fmtHM(b.sleptAt)+' 睡的'+(b.sleepBy==='hat'?'，戴着睡帽':'')+'）':b.sick?bodySickText(b,now):b.full<50?'饿了':b.full>100?'吃撑了':b.energy<50?'困了':b.health<50?'身体有点虚':'精神还行';
  const last=b.lastMealAt?fmtHM(b.lastMealAt):'—',slept=b.lastSleepH?b.lastSleepH.toFixed(1)+' 小时':'—',hatOn=b.asleep&&b.sleepBy==='hat';
  const cut=atMins(now,0)-2*86400000,dayName=t=>{const d=Math.round((atMins(now,0)-atMins(t,0))/86400000);return d<=0?'今天':d===1?'昨天':'前天';};let lastDay='';const log=(b.log||[]).filter(x=>x.t>=cut).reverse().map(x=>{const dn=dayName(x.t),head=dn!==lastDay?`<h5>${dn}</h5>`:'';lastDay=dn;return head+`<div><time>${fmtHM(x.t)}</time>${escH(x.text)}</div>`;}).join('')||'<div>还没有记录</div>';
  return `<div class="dp-status">${n}现在：<b>${escH(status)}</b></div>
  <div class="dp-group dp-stats">${bar('精力',b.energy,100,'#7ad7ff',b.energy<50?'困':'')}${bar('饱腹',b.full,130,b.full>100?'#ffb35c':'#7ee0a1',b.full>100?'撑':b.full<50?'饿':'')}${bar('健康',b.health,100,'#ff8fab',b.health<50?'虚':'')}</div>
  <div class="dp-items">${[['battery','电池','喂一顿'],['coffee','咖啡',b.coffeeUntil>now?'劲儿还没过':'提提神'],['pill','药丸',b.sick?'治好他':'没生病'],['temp','体温计',b.lastTemp&&now-b.lastTemp.t<6*3600000?(+b.lastTemp.v).toFixed(1)+'℃':'量一量'],['hat','睡帽',hatOn?'摘下叫醒':'戴上去睡']].map(([k,l,sub])=>`<button class="${k==='hat'&&hatOn?'on':''}" onclick="deskPetBodyUse('${k}')"><svg viewBox="0 0 15 12" shape-rendering="crispEdges">${bodyItemSVG(k)}</svg><b>${l}</b><small>${escH(sub)}</small></button>`).join('')}</div>
  <div class="dp-group"><div class="dp-row"><span>生病苗头</span><b style="color:${(+b.risk||0)>=70?'#ff6b6b':(+b.risk||0)>=40?'#d97757':'inherit'}">${(+b.risk||0)>=70?'很危险，快照顾他':(+b.risk||0)>=40?'有一点':'没有'}</b></div><div class="dp-row"><span>今天吃了</span><b>${b.meals||0} 顿</b></div><div class="dp-row"><span>上一顿</span><b>${last}</b></div><div class="dp-row"><span>上次睡了</span><b>${slept}</b></div>${b.lastTemp&&now-b.lastTemp.t<12*3600000?`<div class="dp-row"><span>体温</span><b>${(+b.lastTemp.v).toFixed(1)}℃ · ${escH(b.lastTemp.label)}（${fmtHM(b.lastTemp.t)} 量的）</b></div>`:''}</div>
  <div class="dp-label">睡觉</div>
  <div class="dp-group"><div class="dp-row"><span>平时几点睡</span><input type="time" value="${escH(cf.sleepAt)}" onchange="deskPetBodySet('sleepAt',this.value)"></div><div class="dp-row"><span>平时几点起</span><input type="time" value="${escH(cf.wakeAt)}" onchange="deskPetBodySet('wakeAt',this.value)"></div></div>
  <div class="dp-label">三餐</div>
  <div class="dp-group">${[['b','早饭'],['l','午饭'],['d','晚饭']].map(([k,l])=>`<div class="dp-row"><span>${l}</span><input type="time" value="${mmHM(bodyMealTimes(c)[k])}" onchange="deskPetBodySet('meal_${k}',this.value)"></div>`).join('')}</div>
  <div class="dp-label">上班</div>
  ${schedSectionHTML(c)}
  <div class="dp-group"><div class="dp-row"><span>身体状态</span><span class="sw on" style="flex-shrink:0" onclick="deskPetBodySet('on')"></span></div><div class="dp-row"><span>会生病<br><small style="color:#8e8e93;font-size:12px">看他吃饭、睡觉和天气，照顾得好就不会病</small></span><span class="sw ${cf.sick!=='off'?'on':''}" style="flex-shrink:0" onclick="deskPetBodySet('sick',bodyCfgSickToggle())"></span></div><button type="button" class="dp-row dp-link" onclick="deskPetBodyUse('sick')"><span>试试：让他生病</span><em>›</em></button></div>
  <div class="dp-note">· 一天三块电池正好；吃太多会撑，只吃一顿会有点饿、健康慢慢往下掉。<br>· 每天按时吃三顿、按时睡，健康会慢慢涨；到点不睡、饿着，健康会往下掉。<br>· 生病不靠运气：没吃够、熬夜、天气不好、健康低、咖啡喝太多，「生病苗头」就会慢慢涨，要长期这样（比如连着一个星期左右）才会病，越严重病得越重；偶尔一天没照顾好没关系，你照顾得好他就不会生病。苗头大了他自己会觉得不对劲。<br>· 生病分低烧、中度发烧、高烧，越重好得越慢；体温计随时量，看他烧到多少度。咖啡提神，但劲儿没过（约 5 小时）睡不着，一天别超过两杯。<br>· 到饭点、睡觉点，他会先跟你说一声（比如“我先去吃饭了”“晚安”）再去，不会聊着聊着突然消失；你找他他照样回，只是吃得慢一点、或者被你叫醒。上班照常回你。<br>· 你们没在聊的时候，到点他就自己去吃、自己去睡。戴上睡帽马上睡，摘下来就醒。<br>· 照顾记录保留最近 3 天。<br>· 他知道是你在照顾他；身体只当事实告诉他，怎么反应是他自己的事。</div>
  <div class="dp-label">照顾记录</div><div class="dp-group dp-log">${log}</div>`;}
/* 桌宠陪着的角色：角色资料页、共同生活设置里的「作息时间表」直接跳到这一页；别的角色仍用原来的作息窗口 */
let _schedModal=null;
if(typeof schedSet==='function'){_schedModal=schedSet;schedSet=function(id){const p=cfg();if(p&&p.on&&p.cid===id&&bodyCfg().on){_dpTab='body';if(typeof closeModal==='function')closeModal();if(typeof cur==='function'&&cur()&&cur().p==='deskPet')rerender();else if(typeof go==='function')go('deskPet');return;}return _schedModal.apply(this,arguments);};}
if(typeof settingsHomeHTML==='function'){const original=settingsHomeHTML;settingsHomeHTML=function(){const html=original.apply(this,arguments);return html.includes('deskPetOpen()')?html:html.replace('<div class="ios-settings-version"',deskPetRow()+'<div class="ios-settings-version"');};}
function deskPetOpen(){ensureCfg();if(typeof go==='function')go('deskPet');}
/* 设置页顶上的形象：跟着他的身体变（睡着戴睡帽、生病贴退烧贴、饿了冒电池云） */
function heroHTML(p,col){const r=role();let eyes='open',hat='',cls='breathe',cloud='',sub='';
  if(r&&bodyOn(r)){const b=bodyTick(r),lk=bodyLookOf(b);if(b.asleep){eyes='closed';hat='sleep';cls='sit slow';sub='睡着了';}else if(b.eating){eyes='happy';cls='sit bob';sub='在吃'+b.eating.name;}else if(lk==='sick'){eyes='sad';hat='fever';cls='droop slow';sub=bodySickText(b,Date.now());}else if(lk==='doze'){eyes='drowsy';cls='nod slow';sub='困了，在打瞌睡';}else if(lk==='weak'){eyes='sad';cls='droop sweat slow';sub='身体有点虚';}else if(lk==='hungry'){eyes='sad';cls='slow';cloud=`<svg class="dp-hero-cloud" viewBox="0 0 13 10" shape-rendering="crispEdges" style="fill:initial;stroke:none;filter:none" aria-hidden="true">${FX.hungry.svg}</svg>`;sub='饿了';}else if(b.full>100){eyes='dizzy';sub='吃撑了';}}
  if(p.hats===false&&hat==='sleep')hat='';
  return `<div class="dp-hero"><div class="dp-hero-wrap"><div class="dp-root ${cls}" data-eyes="${eyes}" data-hat="${hat}" style="width:${VB_W*6}px;height:${VB_H*6}px;--dp-c:${col[0]};--dp-d:${col[1]};--dp-l:${col[2]}"><div class="dp-flip">${spriteSVG()}</div><i class="dp-shadow"></i></div>${cloud}</div>
   <b>${escH(petName())}</b>${sub?`<small>${escH(sub)}</small>`:''}</div>`;}
function renderDeskPetPage(){css();const p=ensureCfg(),r=role(),col=DP_COLORS[p.color]||DP_COLORS.clay,
  roles=(typeof S!=='undefined'&&Array.isArray(S.contacts)?S.contacts:[]).filter(c=>c&&!c.deleted&&!c.isGroup),
  seg=(k,l)=>`<button class="${p.size===k?'on':''}" onclick="deskPetSize('${k}')">${l}</button>`;
  return `<div class="nav ios-settings-nav"><span class="l" onclick="back()">‹</span><span class="t">桌面宠物</span><span class="r"></span></div><div class="scroll ios-settings dp-page">
  ${heroHTML(p,col)}
  <div class="dp-tabs"><button class="${_dpTab==='pet'?'on':''}" onclick="deskPetTab('pet')">宠物</button><button class="${_dpTab==='body'?'on':''}" onclick="deskPetTab('body')">他的身体</button></div>
  ${_dpTab==='body'?bodyPageHTML(r)+'</div>':''}
${_dpTab==='body'?'':`<div class="dp-group"><div class="dp-row"><span>开启桌面宠物</span><span class="sw ${p.on&&r?'on':''}" style="flex-shrink:0" onclick="deskPetToggle()"></span></div></div>
  <div class="dp-group">
   <div class="dp-row"><span>名字</span><input id="dp_name" maxlength="10" value="${escH(petName())}" placeholder="${DP_DEFAULT_NAME}" onchange="deskPetRename(this.value)"></div>
   <div class="dp-row"><span>陪着哪个角色</span><select onchange="deskPetBind(this.value)"><option value="">选择一个角色</option>${roles.map(c=>`<option value="${c.id}" ${p.cid===c.id?'selected':''}>${escH(rname(c))}</option>`).join('')}</select></div>
   <div class="dp-row"><span>戴帽子<br><small style="color:#8e8e93;font-size:12px">上班安全帽、睡觉睡帽、过节派对帽</small></span><span class="sw ${p.hats!==false?'on':''}" style="flex-shrink:0" onclick="deskPetWear('hats')"></span></div>
   <div class="dp-row"><span>听歌戴耳机</span><span class="sw ${p.phones!==false?'on':''}" style="flex-shrink:0" onclick="deskPetWear('phones')"></span></div>
   <div class="dp-row"><span>大小</span><div class="dp-seg">${seg('s','小')}${seg('m','中')}${seg('l','大')}</div></div>
   <div class="dp-row"><span>颜色</span><div class="dp-colors">${Object.keys(DP_COLORS).map(k=>`<button class="${(p.color||'clay')===k?'on':''}" title="${DP_COLOR_NAMES[k]}" style="background:${DP_COLORS[k][0]}" onclick="deskPetColor('${k}')"></button>`).join('')}</div></div>
  </div>
  <div class="dp-label">让${escH(petName())}做个表情</div>
  <div class="dp-group"><div class="dp-cmds">${Object.keys(CMDS).concat(Object.keys(MOVES)).map(k=>`<button onclick="deskPetCmd('${k}')">${k}</button>`).join('')}<button onclick="deskPetCmd('恢复')">恢复</button></div></div>
  <button class="dp-home-btn" onclick="deskPetHome()">叫它回到屏幕中间</button>
  <div class="dp-note">· 只陪一个角色，跟着ta的心情和作息变表情：开心蹦跶、想你冒爱心、生气冒火、难过掉眼泪、上班戴安全帽、睡觉戴睡帽、过节戴派对帽。<br>· 你在听歌时它会戴上耳机、闭眼左右摇摆；你在打字时它会坐下来敲键盘。<br>· 角色知道它叫「${escH(petName())}」，也能在聊天里让它做表情；你也可以在上面直接点。<br>· 平时它站在聊天输入框上来回走，会从一个气泡跳到另一个气泡，偶尔跑出屏幕又跑回来。角色来消息时它会精神一下跳到新气泡上；你太久不理它，它会打瞌睡，碰一下屏幕就醒。<br>· 点它冒小爱心，连着点太多下会生气跑开；按住不动是摸摸；按住拖动可以把它放到任何地方，放在气泡上就趴在气泡上。</div>
  </div>`}`;}
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
Object.assign(window,{roleBodyPrompt,roleBodyConsume,deskPetBodyUse,deskPetBodySet,bodyCfgSickToggle,deskPetTab,deskPetSchedSet,deskPetLeaves,roleBodyTick:(c,t)=>bodyTick(c,t),deskPetOpen,renderDeskPetPage,deskPetToggle,deskPetBind,deskPetRename,deskPetSize,deskPetColor,deskPetWear,deskPetCmd,deskPetHome,deskPetPrompt,deskPetConsume,deskPetRequestedCommand,deskPetApplyUserRequest,
  __deskPet:{moodOf,state:()=>Object.assign({},state,{perch:!!state.perch,hop:!!state.hop}),refresh:()=>refreshMood(true),sync,tryPerch,tap,doCmd,runAway,groundY,newestBubble,nap:()=>{lastInteract=0;},normCmd,special:()=>special(Date.now()),typed:()=>{lastTypeAt=Date.now();},EYES:Object.keys(EYES),CMDS:Object.keys(CMDS)}});
})();
