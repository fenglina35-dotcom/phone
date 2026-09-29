(function(global){
'use strict';

const EFFECT_VERSION='gift-bouquet-preview-2';
const FLORAL_GIFT_RE=/(?:花束|鲜花|玫瑰|百合|郁金香|向日葵|满天星|雏菊|牡丹|芍药|铃兰|桔梗|康乃馨|蝴蝶兰|永生花|花礼|手捧花)/i;
const PALETTES=[
  {name:'暮光玫瑰',petals:['#ff6f91','#ff9eb5','#ffd0d9','#fff1f3'],core:'#ffe7a7',leaf:['#275d4d','#43816c'],glow:'#ff6d9f',wrap:'#4a273d'},
  {name:'月光蓝',petals:['#5cc8ff','#7f8dff','#a7c8ff','#e8f7ff'],core:'#d8fbff',leaf:['#174c54','#2f7c78'],glow:'#56cfff',wrap:'#1e315d'},
  {name:'香槟日落',petals:['#ff9e6d','#ffc18e','#ffe0b7','#fff5df'],core:'#fff0a8',leaf:['#3b6544','#628b58'],glow:'#ffb36b',wrap:'#624337'},
  {name:'紫雾花园',petals:['#a979ff','#d19cff','#efc8ff','#fff0ff'],core:'#ffe7a8',leaf:['#2f5d58','#4d8274'],glow:'#bd7cff',wrap:'#43305f'},
  {name:'奶油雏菊',petals:['#fff9df','#fff4bd','#f9d8a2','#ffffff'],core:'#ffc85a',leaf:['#2b6542','#4a8c58'],glow:'#ffe49a',wrap:'#5c493a'}
];
const FLOWER_RECIPES=[
  {id:'red-rose',name:'红玫瑰',enName:'RED ROSE',meaning:'热烈、唯一而坚定的爱',palette:'暮光玫瑰',match:/红玫瑰|玫瑰/},
  {id:'blue-babys-breath',name:'蓝色满天星',enName:"BLUE BABY'S BREATH",meaning:'真心喜欢与长久陪伴',palette:'月光蓝',match:/蓝色满天星|满天星/},
  {id:'champagne-rose',name:'香槟玫瑰',enName:'CHAMPAGNE ROSE',meaning:'爱上你是此生的幸运',palette:'香槟日落',match:/香槟玫瑰|香槟花/},
  {id:'purple-lisianthus',name:'紫色桔梗',enName:'PURPLE LISIANTHUS',meaning:'永恒的爱与无悔的守候',palette:'紫雾花园',match:/紫色桔梗|桔梗/},
  {id:'white-daisy',name:'白色雏菊',enName:'WHITE DAISY',meaning:'藏在心底的爱与希望',palette:'奶油雏菊',match:/白色雏菊|雏菊/}
];
const TEDDY_RECIPES=[
  {id:'caramel-bear',species:'bear',name:'焦糖拥抱熊',enName:'CARAMEL EMBRACE BEAR',color:'#d89b6b',accent:'#ffe1bb',words:'想把所有柔软的拥抱都留给你'},
  {id:'cream-rabbit',species:'rabbit',name:'奶油垂耳兔',enName:'CREAM LOP-EARED RABBIT',color:'#ead9cc',accent:'#ffb6c8',words:'不在你身边的时候，让它替我陪着你'},
  {id:'cocoa-puppy',species:'puppy',name:'可可守护犬',enName:'COCOA GUARDIAN PUPPY',color:'#ad795f',accent:'#b9d8ff',words:'希望你每一天都被温柔接住'},
  {id:'moon-kitten',species:'kitten',name:'月光软绒猫',enName:'MOONLIGHT PLUSH KITTEN',color:'#b9b8c8',accent:'#d8c5ff',words:'把它放在枕边，就像我一直没有走远'}
];
const RING_RECIPES=[
  {id:'starlight-ring',style:'round',name:'星芒圆钻戒',enName:'STARLIGHT SOLITAIRE',metal:'#f3dbc1',gem:'#d8f6ff',words:'从这一刻起，想认真参与我们的每一个以后'},
  {id:'moon-ring',style:'halo',name:'月光光环戒',enName:'MOONLIGHT HALO RING',metal:'#d8d9e8',gem:'#b9caff',words:'想把未来写成我们两个人的名字'},
  {id:'rose-ring',style:'heart',name:'玫瑰心钻戒',enName:'ROSE HEART RING',metal:'#efc6bd',gem:'#ffd1e2',words:'不是一时心动，是想和你走很久很久'},
  {id:'dewdrop-ring',style:'pear',name:'晨露梨形钻戒',enName:'DEWDROP PEAR RING',metal:'#eee2d5',gem:'#c8f0eb',words:'想把每一个普通日子，都和你过成值得纪念的以后'}
];
const FLOWER_TYPES=['rose','daisy','peony'];
let activeEffect=null,activeBoxStage=null;
const lastCollectibleId={teddy:'',ring:''};

function giftEffectIsFloral(name){return FLORAL_GIFT_RE.test(String(name||''));}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function mix(a,b,t){return a+(b-a)*t;}
function easeOutCubic(t){return 1-Math.pow(1-t,3);}
function easeInOut(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
function hashSeed(input){
  const s=String(input||Date.now());let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function seededRandom(seed){
  let a=hashSeed(seed);
  return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}
function pick(rng,list){return list[Math.floor(rng()*list.length)];}
function rgba(hex,alpha){
  const raw=String(hex||'#ffffff').replace('#','');
  const full=raw.length===3?raw.split('').map(x=>x+x).join(''):raw;
  const n=parseInt(full,16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+alpha+')';
}
function safeLabel(value,fallback){const s=String(value||'').replace(/[<>]/g,'').trim();return (s||fallback).slice(0,36);}
function giftDate(value){const d=new Date(value||Date.now());return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0');}
function createBouquetRecipe(options){
  options=options||{};const seed=String(options.seed||Date.now()+'-'+Math.random()),rng=seededRandom(seed),giftName=String(options.giftName||'');
  const matched=FLOWER_RECIPES.find(x=>x.match.test(giftName)),chosen=matched||pick(rng,FLOWER_RECIPES);
  return {type:'bouquet',id:chosen.id,flowerName:chosen.name,enName:chosen.enName,flowerMeaning:chosen.meaning,palette:chosen.palette,seed,date:giftDate(options.time)};
}
function normalizeBouquetRecipe(recipe,options){
  const fallback=createBouquetRecipe(options),raw=recipe&&typeof recipe==='object'?recipe:{};
  return {type:'bouquet',id:safeLabel(raw.id,fallback.id),flowerName:safeLabel(raw.flowerName,fallback.flowerName),enName:safeLabel(raw.enName,fallback.enName),flowerMeaning:safeLabel(raw.flowerMeaning,fallback.flowerMeaning),palette:PALETTES.some(x=>x.name===raw.palette)?raw.palette:fallback.palette,seed:String(raw.seed||fallback.seed),date:safeLabel(raw.date,fallback.date)};
}
function createCollectibleRecipe(kind,options){
  options=options||{};const seed=String(options.seed||Date.now()+'-'+Math.random()),rng=seededRandom(seed),source=kind==='ring'?RING_RECIPES:TEDDY_RECIPES,chosen=pick(rng,source);
  return Object.assign({type:kind,seed,date:giftDate(options.time)},chosen,{words:safeLabel(options.words,chosen.words)});
}

function ensureStyles(){
  if(document.getElementById('northGiftEffectStyle'))return;
  const style=document.createElement('style');
  style.id='northGiftEffectStyle';
  style.textContent=`
.giftcard-effect{position:relative;cursor:pointer;border:0!important;box-shadow:0 12px 30px rgba(20,14,22,.24),inset 0 0 28px rgba(255,220,194,.025);-webkit-tap-highlight-color:transparent}
.giftcard-simple{width:210px;min-height:138px;padding:8px 13px 11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;background:linear-gradient(180deg,rgba(22,22,27,.97),rgba(13,13,17,.98));border-radius:15px}.giftbox-mini{width:106px;height:84px;overflow:visible;filter:drop-shadow(0 0 7px currentColor)}.giftbox-mini path,.giftbox-mini rect{vector-effect:non-scaling-stroke}.gift-simple-copy{display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:-1px}.gift-simple-copy strong{font-family:"Songti SC","STSong","Times New Roman",serif;font-size:14px;font-weight:400;letter-spacing:3.4px;text-indent:3.4px;color:#f3ece7}.gift-simple-copy small{margin-top:4px;font-family:"Bodoni 72 Smallcaps","Didot","Times New Roman",serif;font-size:6px;font-weight:500;letter-spacing:2px;color:rgba(238,222,212,.52)}
.giftcard-effect.pressed{animation:giftCardPress .2s ease both}
.gift-box-stage{--gift-line:#8fbce8;position:fixed;inset:0;z-index:2147482990;overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 50% 48%,color-mix(in srgb,var(--gift-line) 11%,transparent),transparent 34%),linear-gradient(180deg,#090a10,#07070c 72%);isolation:isolate;opacity:1;touch-action:manipulation}
.gift-box-stage.show{opacity:1}.gift-box-stage.closing{opacity:0;transition:opacity .2s ease}.gift-box-stage-box,.gift-box-stage-cue,.gift-box-stage-close{opacity:0;transition:opacity .24s ease}.gift-box-stage.show .gift-box-stage-box,.gift-box-stage.show .gift-box-stage-cue,.gift-box-stage.show .gift-box-stage-close{opacity:1}.gift-box-stage-box{appearance:none;position:relative;width:min(82vw,320px);height:360px;border:0;padding:0;background:transparent;color:var(--gift-line);cursor:pointer;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 0 22px color-mix(in srgb,var(--gift-line) 18%,transparent))}.gift-box-stage-box:focus-visible{outline:0;filter:drop-shadow(0 0 32px color-mix(in srgb,var(--gift-line) 34%,transparent))}.gift-box-stage-box:before{content:"";position:absolute;left:50%;top:43%;width:250px;height:250px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--gift-line) 13%,transparent),color-mix(in srgb,var(--gift-line) 3%,transparent) 45%,transparent 72%);animation:giftStageBreathe 3.2s ease-in-out infinite}.gift-box-stage-art{position:absolute;left:50%;top:43%;width:min(80vw,310px);height:min(80vw,310px);transform:translate(-50%,-50%);overflow:visible}.gift-box-stage-art .gift-stage-shape{fill:color-mix(in srgb,var(--gift-line) 2.5%,transparent);stroke:var(--gift-line);stroke-width:1.28;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--gift-line) 42%,transparent))}.gift-box-stage-art .gift-stage-soft{fill:color-mix(in srgb,var(--gift-line) 4%,transparent);stroke:color-mix(in srgb,var(--gift-line) 78%,transparent);stroke-width:1.08;stroke-linecap:round;stroke-linejoin:round}.gift-box-stage-art .gift-stage-knot{fill:#111116;stroke:var(--gift-line);stroke-width:1.28;stroke-linecap:round;stroke-linejoin:round}.gift-box-stage-name{position:absolute;left:0;right:0;bottom:22px;display:flex;flex-direction:column;align-items:center;text-align:center;text-shadow:0 0 18px color-mix(in srgb,var(--gift-line) 28%,transparent)}.gift-box-stage-name strong{font-family:"Songti SC","STSong","Times New Roman",serif;font-size:24px;font-weight:400;letter-spacing:7px;text-indent:7px;color:color-mix(in srgb,var(--gift-line) 78%,white)}.gift-box-stage-name small{margin-top:7px;font-family:"Bodoni 72 Smallcaps","Didot","Times New Roman",serif;font-size:8px;font-weight:500;letter-spacing:3px;color:color-mix(in srgb,var(--gift-line) 66%,transparent)}.gift-box-stage-cue{position:absolute;left:0;right:0;bottom:max(28px,calc(env(safe-area-inset-bottom) + 18px));text-align:center;font-size:10px;letter-spacing:2.2px;color:rgba(255,255,255,.36)}.gift-box-stage.ready .gift-box-stage-cue{color:color-mix(in srgb,var(--gift-line) 68%,white)}.gift-box-stage-box.shaking{pointer-events:none;animation:giftCardShake .88s cubic-bezier(.36,.07,.19,.97) both;filter:drop-shadow(0 0 34px color-mix(in srgb,var(--gift-line) 42%,transparent))}.gift-box-stage.opening .gift-box-stage-box{pointer-events:none;animation:giftStageOpen .7s cubic-bezier(.2,.82,.2,1) both}.gift-box-stage-close{position:absolute;right:max(14px,env(safe-area-inset-right));top:max(14px,env(safe-area-inset-top));width:38px;height:38px;border:0;border-radius:50%;background:rgba(12,12,18,.46);color:rgba(255,255,255,.82);font:300 25px/34px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
.gift-bouquet-overlay{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:radial-gradient(circle at 50% 52%,rgba(66,24,53,.42),transparent 38%),linear-gradient(180deg,#07080f,#0c0912);isolation:isolate;touch-action:manipulation;opacity:1}
.gift-bouquet-overlay.show{opacity:1}
.gift-bouquet-overlay.closing{opacity:0;transition:opacity .28s ease}
.gift-bouquet-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.gift-bouquet-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 46%,transparent 22%,rgba(0,0,0,.13) 62%,rgba(0,0,0,.54) 100%)}
.gift-bouquet-copy{position:absolute;left:18px;right:18px;bottom:max(8px,calc(env(safe-area-inset-bottom) + 4px));display:flex;flex-direction:column;align-items:center;text-align:center;color:#fff;text-shadow:0 2px 18px rgba(0,0,0,.8);pointer-events:none;opacity:0;transform:translateY(16px);transition:opacity .8s ease 1.35s,transform .8s cubic-bezier(.2,.8,.2,1) 1.35s}
.gift-bouquet-overlay.show .gift-bouquet-copy{opacity:1;transform:translateY(0)}
.gift-bouquet-copy span{font-size:10px;letter-spacing:4px;color:rgba(255,226,236,.72);margin-bottom:8px}
.gift-bouquet-copy strong{font-family:"Songti SC","STSong","Times New Roman",serif;font-size:clamp(21px,6vw,30px);font-weight:500;letter-spacing:3px;line-height:1.2}
.gift-bouquet-copy b{font-family:"Bodoni 72 Smallcaps","Didot","Times New Roman",serif;font-size:8px;font-weight:500;letter-spacing:3px;color:rgba(255,233,218,.58);margin-top:4px}
.gift-bouquet-copy small{font-size:12px;color:rgba(255,255,255,.63);margin-top:7px;letter-spacing:.4px}
.gift-bouquet-copy em{font-style:normal;font-size:12px;color:rgba(255,230,209,.88);margin-top:8px;letter-spacing:.6px}
.gift-bouquet-close{position:absolute;right:max(14px,env(safe-area-inset-right));top:max(14px,env(safe-area-inset-top));width:38px;height:38px;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:rgba(12,12,18,.32);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:rgba(255,255,255,.82);font:300 25px/34px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;z-index:2;cursor:pointer;-webkit-tap-highlight-color:transparent}
.gift-bouquet-close:active{transform:scale(.94)}
.gift-bouquet-hint{position:absolute;left:50%;top:max(18px,env(safe-area-inset-top));transform:translateX(-50%);font-size:9px;letter-spacing:2.6px;color:rgba(255,255,255,.38);white-space:nowrap;pointer-events:none}
.gift-collectible-overlay{background:radial-gradient(circle at 50% 45%,rgba(55,36,63,.46),transparent 38%),linear-gradient(180deg,#07080f,#0b0910)}
@keyframes giftCardShake{0%,100%{transform:translateX(0) rotate(0)}16%{transform:translateX(-3px) rotate(-3deg)}32%{transform:translateX(3px) rotate(3deg)}48%{transform:translateX(-4px) rotate(-4deg)}64%{transform:translateX(4px) rotate(4deg)}82%{transform:translateX(-2px) rotate(-1.5deg)}}
@keyframes giftCardGlow{50%{border-color:rgba(246,218,193,.72);box-shadow:0 0 30px rgba(232,198,165,.2),inset 0 0 22px rgba(255,226,206,.08)}}
@keyframes giftCardPress{50%{transform:scale(.975);filter:brightness(1.12)}}@keyframes giftStageBreathe{50%{opacity:.55;transform:translate(-50%,-50%) scale(1.08)}}@keyframes giftStageOpen{0%{transform:scale(1)}55%{transform:scale(.94)}100%{transform:scale(1.12);opacity:0;filter:brightness(1.65)}}
@media(prefers-reduced-motion:reduce){.gift-bouquet-overlay,.gift-bouquet-copy,.gift-box-stage{transition-duration:.12s!important;transition-delay:0s!important}.gift-box-stage-box:before{animation:none}.gift-box-stage-box.shaking,.gift-box-stage.opening .gift-box-stage-box{animation-duration:.12s!important}}
`;
  document.head.appendChild(style);
}

const GIFT_STAGE_COLORS={blue:'#8fbce8',pink:'#f2adc7',white:'#f2efe8',red:'#ef6b6f'};
function playGiftBoxReveal(options){
  options=options||{};ensureStyles();if(activeBoxStage)activeBoxStage.stop(true);if(activeEffect)activeEffect.stop(true);
  const color=GIFT_STAGE_COLORS[options.boxColor]||GIFT_STAGE_COLORS.blue,overlay=document.createElement('div');overlay.className='gift-box-stage';overlay.style.setProperty('--gift-line',color);overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','拆开'+safeLabel(options.giftName,'礼物'));
  const box=document.createElement('button');box.type='button';box.className='gift-box-stage-box';box.setAttribute('aria-label','轻触唤醒礼物');box.innerHTML='<svg class="gift-box-stage-art" viewBox="0 0 300 300" aria-hidden="true"><g fill="none"><rect class="gift-stage-shape" x="50" y="99" width="200" height="150" rx="16"></rect><path class="gift-stage-shape" d="M39 91h222v34H39zM134 91h32v158M50 171h200"></path><path class="gift-stage-soft" d="M144 83c-30-35-75-36-81-10-5 21 31 27 77 22M156 83c30-35 75-36 81-10 5 21-31 27-77 22"></path><path class="gift-stage-knot" d="M136 81q14-13 28 0l-4 22h-20z"></path><path class="gift-stage-soft" d="M27 55v21M17 65h21M273 61v17M264 69h18M271 219v14M264 226h15M29 212v13M23 218h13"></path></g></svg>';
  const name=document.createElement('span');name.className='gift-box-stage-name';const title=document.createElement('strong');title.textContent=safeLabel(options.giftName,'礼物');const english=document.createElement('small');english.textContent=safeLabel(options.english,'PRIVATE GIFT');name.append(title,english);box.appendChild(name);
  const cue=document.createElement('div');cue.className='gift-box-stage-cue';cue.textContent='轻触礼盒';const close=document.createElement('button');close.type='button';close.className='gift-box-stage-close';close.setAttribute('aria-label','关闭礼盒');close.textContent='×';overlay.append(box,cue,close);document.body.appendChild(overlay);
  let step=0,busy=false,stopped=false,timer=0;
  function stop(immediate){if(stopped)return;stopped=true;clearTimeout(timer);document.removeEventListener('keydown',onKey);if(immediate){overlay.remove();if(activeBoxStage&&activeBoxStage.overlay===overlay)activeBoxStage=null;return;}overlay.classList.add('closing');timer=setTimeout(()=>{overlay.remove();if(activeBoxStage&&activeBoxStage.overlay===overlay)activeBoxStage=null;},280);}
  function tap(){if(busy||stopped)return;busy=true;if(step===0){box.classList.add('shaking');timer=setTimeout(()=>{box.classList.remove('shaking');overlay.classList.add('ready');cue.textContent='再次轻触，打开礼物';box.setAttribute('aria-label','再次轻触，打开礼物');step=1;busy=false;},880);return;}overlay.classList.add('opening');timer=setTimeout(()=>{const open=typeof options.onOpen==='function'?options.onOpen:null;if(open)open();stop(true);},700);}
  function onKey(e){if(e.key==='Escape')stop(false);}
  box.addEventListener('click',tap);close.addEventListener('click',()=>stop(false));document.addEventListener('keydown',onKey);requestAnimationFrame(()=>overlay.classList.add('show'));activeBoxStage={overlay,box,stop};return activeBoxStage;
}

function edgeStart(rng,w,h){
  const edge=Math.floor(rng()*4);
  if(edge===0)return {x:rng()*w,y:h+30+rng()*h*.18};
  if(edge===1)return {x:-30-rng()*w*.14,y:rng()*h};
  if(edge===2)return {x:w+30+rng()*w*.14,y:rng()*h};
  return {x:rng()*w,y:-30-rng()*h*.12};
}
function particle(list,rng,w,h,tx,ty,color,size,kind,delay){
  const s=edgeStart(rng,w,h);
  list.push({sx:s.x,sy:s.y,tx,ty,color,size,kind,delay:delay||rng()*500,tw:rng()*Math.PI*2,drift:(rng()-.5)*18,spin:(rng()-.5)*2.4});
}
function flowerPoint(type,rng,radius){
  const a=rng()*Math.PI*2;
  const u=Math.sqrt(rng());
  if(type==='rose'){
    const spiral=a+u*8.8;
    const rr=radius*u*(.68+.19*Math.sin(5*spiral));
    return {x:Math.cos(spiral)*rr,y:Math.sin(spiral)*rr*.84};
  }
  if(type==='daisy'){
    const petals=10+Math.floor(rng()*4);
    const bloom=.28+.72*Math.pow(Math.abs(Math.cos(a*petals/2)),.42);
    const rr=radius*(.18+u*.82)*bloom;
    return {x:Math.cos(a)*rr,y:Math.sin(a)*rr*.94};
  }
  const rr=radius*u*(.78+.18*Math.sin(a*7+u*10));
  return {x:Math.cos(a)*rr,y:Math.sin(a)*rr*.88};
}
function addLeaf(list,rng,w,h,cx,cy,angle,len,width,colors){
  const count=24+Math.floor(rng()*10),ca=Math.cos(angle),sa=Math.sin(angle);
  for(let i=0;i<count;i++){
    const t=rng(),side=rng()<.5?-1:1;
    const localX=(t-.5)*len,localY=side*Math.sin(Math.PI*t)*width*(.35+rng()*.65);
    const x=cx+localX*ca-localY*sa,y=cy+localX*sa+localY*ca;
    particle(list,rng,w,h,x,y,pick(rng,colors),.8+rng()*1.25,'leaf',220+rng()*650);
  }
}
function buildBouquet(rng,w,h,palette,reduced){
  const particles=[],blossoms=[],petals=[];
  const cx=w*.5,baseY=h*.59,scale=Math.min(w/390,h/760,1.28),bouquetW=Math.min(w*.82,430)*scale;
  const anchors=[
    [0,-.39],[-.2,-.32],[.2,-.32],[-.39,-.19],[.39,-.19],[-.08,-.18],[.12,-.13],[-.28,-.02],[.29,-.01],[0,.03],[-.14,.13],[.16,.14]
  ];
  const flowerCount=(reduced?7:9)+Math.floor(rng()*(reduced?2:4));
  for(let i=0;i<flowerCount;i++){
    const a=anchors[i],jitter=bouquetW*.028;
    const fx=cx+a[0]*bouquetW+(rng()-.5)*jitter;
    const fy=baseY+a[1]*bouquetW*1.18+(rng()-.5)*jitter;
    const radius=bouquetW*(.075+rng()*.035)*(i===0?1.12:1);
    const type=pick(rng,FLOWER_TYPES),colors=palette.petals.slice();
    blossoms.push({x:fx,y:fy,r:radius,type,color:pick(rng,colors),core:palette.core,rot:rng()*Math.PI*2});
    const count=(reduced?34:58)+Math.floor(rng()*(reduced?18:32));
    for(let p=0;p<count;p++){
      const fp=flowerPoint(type,rng,radius),edge=clamp(Math.hypot(fp.x,fp.y)/radius,0,1);
      const color=edge>.66?colors[Math.min(colors.length-1,1+Math.floor(rng()*(colors.length-1)))]:pick(rng,colors);
      particle(particles,rng,w,h,fx+fp.x,fy+fp.y,color,.7+rng()*1.75,'flower',rng()*680+i*22);
    }
    const stemParts=16;
    for(let s=0;s<stemParts;s++){
      const t=s/(stemParts-1),bend=Math.sin(t*Math.PI)*(fx-cx)*.08;
      particle(particles,rng,w,h,mix(cx,fx,t)+bend,mix(baseY+58*scale,fy,t),pick(rng,palette.leaf),.8+rng()*.8,'stem',260+rng()*520);
    }
  }
  const leafCount=reduced?7:11;
  for(let i=0;i<leafCount;i++){
    const side=i%2?-1:1,t=i/(leafCount-1||1),lx=cx+side*bouquetW*(.13+.26*rng()),ly=baseY-bouquetW*(.05+.32*t);
    addLeaf(particles,rng,w,h,lx,ly,(side<0?Math.PI:.0)+(rng()-.5)*.65,bouquetW*(.15+.08*rng()),bouquetW*(.035+.025*rng()),palette.leaf);
  }
  const wrapTop=baseY+bouquetW*.015,wrapTieY=baseY+bouquetW*.335,wrapBottom=Math.min(h*.82,baseY+bouquetW*.47);
  for(let i=0;i<(reduced?92:156);i++){
    const t=rng(),half=mix(bouquetW*.245,bouquetW*.06,t),x=cx+(rng()*2-1)*half,y=mix(wrapTop,wrapBottom,t);
    particle(particles,rng,w,h,x,y,rng()<.22?palette.petals[2]:palette.wrap,.7+rng()*1.2,'wrap',420+rng()*650);
  }
  for(let i=0;i<(reduced?34:92);i++){
    const start=260+rng()*2900,side=rng()<.5?-1:1;
    petals.push({x:rng()*w,y:-24-rng()*h*.2,start,speed:44+rng()*78,drift:side*(18+rng()*42),size:2.2+rng()*4.8,rot:rng()*Math.PI,spin:(rng()-.5)*2.8,color:pick(rng,palette.petals),phase:rng()*6.28});
  }
  return {particles,blossoms,petals,cx,baseY,scale,bouquetW,wrapTop,wrapTieY,wrapBottom,palette};
}

function drawBouquetBase(ctx,bouquet,alpha){
  const x=bouquet.cx,y=bouquet.baseY,w=bouquet.bouquetW;
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.lineCap='round';
  for(const b of bouquet.blossoms){ctx.strokeStyle=rgba(pick(seededRandom(b.x+'-'+b.y),bouquet.palette.leaf),alpha*.32);ctx.lineWidth=1.15*bouquet.scale;ctx.beginPath();ctx.moveTo(x,y+51*bouquet.scale);ctx.quadraticCurveTo(mix(x,b.x,.46),mix(y,b.y,.48),b.x,b.y);ctx.stroke();}
  const top=bouquet.wrapTop||y+w*.015,tie=bouquet.wrapTieY||y+w*.335,bottom=bouquet.wrapBottom||y+w*.47;
  const back=ctx.createLinearGradient(x-w*.31,top,x+w*.28,bottom);back.addColorStop(0,rgba(bouquet.palette.petals[2],alpha*.22));back.addColorStop(.5,rgba(bouquet.palette.wrap,alpha*.48));back.addColorStop(1,rgba(bouquet.palette.petals[0],alpha*.18));ctx.strokeStyle=rgba(bouquet.palette.petals[2],alpha*.38);ctx.lineWidth=1.1;
  ctx.fillStyle=back;ctx.beginPath();ctx.moveTo(x,top+w*.08);ctx.lineTo(x-w*.31,top-w*.02);ctx.quadraticCurveTo(x-w*.2,tie-w*.02,x-w*.072,bottom);ctx.lineTo(x+ w*.012,tie);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(x,top+w*.08);ctx.lineTo(x+w*.31,top-w*.015);ctx.quadraticCurveTo(x+w*.2,tie-w*.015,x+w*.072,bottom);ctx.lineTo(x-w*.012,tie);ctx.closePath();ctx.fill();ctx.stroke();
  const front=ctx.createLinearGradient(x-w*.24,top,x+w*.08,bottom);front.addColorStop(0,rgba(bouquet.palette.petals[2],alpha*.28));front.addColorStop(.42,rgba(bouquet.palette.wrap,alpha*.7));front.addColorStop(1,rgba(bouquet.palette.petals[0],alpha*.3));ctx.fillStyle=front;ctx.strokeStyle=rgba(bouquet.palette.petals[2],alpha*.5);ctx.lineWidth=1.25;
  ctx.beginPath();ctx.moveTo(x-w*.245,top);ctx.quadraticCurveTo(x-w*.16,tie-w*.035,x-w*.065,bottom);ctx.quadraticCurveTo(x,bottom+w*.018,x+w*.065,bottom);ctx.quadraticCurveTo(x+w*.16,tie-w*.035,x+w*.245,top);ctx.quadraticCurveTo(x,top+w*.115,x-w*.245,top);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle=rgba(bouquet.palette.petals[3],alpha*.25);ctx.beginPath();ctx.moveTo(x-w*.215,top+w*.025);ctx.quadraticCurveTo(x-w*.12,tie,x-w*.048,bottom-w*.012);ctx.moveTo(x+w*.215,top+w*.025);ctx.quadraticCurveTo(x+w*.12,tie,x+w*.048,bottom-w*.012);ctx.moveTo(x-w*.078,tie);ctx.quadraticCurveTo(x,tie+w*.024,x+w*.078,tie);ctx.stroke();ctx.restore();
}

function drawSoftBloom(ctx,b,time,alpha){
  const pulse=1+Math.sin(time*.0018+b.rot)*.025,r=b.r*pulse;
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rot+Math.sin(time*.00035+b.rot)*.08);
  const petals=b.type==='daisy'?11:b.type==='rose'?9:13;
  ctx.globalCompositeOperation='screen';
  for(let i=0;i<petals;i++){
    const a=i/petals*Math.PI*2,layer=b.type==='peony'?(i%2?.72:1):1;
    ctx.save();ctx.rotate(a);ctx.fillStyle=rgba(b.color,alpha*(b.type==='daisy'?.13:.095));ctx.beginPath();ctx.ellipse(r*.35,0,r*.62*layer,r*(b.type==='daisy'?.17:.27),0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  const glow=ctx.createRadialGradient(0,0,0,0,0,r*.62);glow.addColorStop(0,rgba(b.core,alpha*.48));glow.addColorStop(.22,rgba(b.color,alpha*.22));glow.addColorStop(1,rgba(b.color,0));ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,r*.72,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawRibbon(ctx,bouquet,time,alpha){
  const x=bouquet.cx,y=bouquet.wrapTieY||bouquet.baseY+bouquet.bouquetW*.335;
  ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='screen';ctx.strokeStyle=rgba(bouquet.palette.petals[1],alpha*.48);ctx.lineWidth=2.2*bouquet.scale;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-52*bouquet.scale,-31*bouquet.scale,-72*bouquet.scale,20*bouquet.scale,-10*bouquet.scale,7*bouquet.scale);ctx.bezierCurveTo(49*bouquet.scale,-25*bouquet.scale,69*bouquet.scale,23*bouquet.scale,7*bouquet.scale,10*bouquet.scale);ctx.stroke();
  ctx.strokeStyle=rgba(bouquet.palette.petals[2],alpha*.34);ctx.beginPath();ctx.moveTo(-6*bouquet.scale,6*bouquet.scale);ctx.bezierCurveTo(-18*bouquet.scale,27*bouquet.scale,-31*bouquet.scale,43*bouquet.scale,-24*bouquet.scale,67*bouquet.scale);ctx.moveTo(6*bouquet.scale,8*bouquet.scale);ctx.bezierCurveTo(18*bouquet.scale,28*bouquet.scale,31*bouquet.scale,46*bouquet.scale,21*bouquet.scale,70*bouquet.scale);ctx.stroke();ctx.restore();
}
function drawPetal(ctx,p,elapsed,w,h,fade){
  if(elapsed<p.start)return;
  const t=(elapsed-p.start)/1000,y=p.y+p.speed*t+t*t*12,x=p.x+p.drift*t+Math.sin(t*1.7+p.phase)*24;
  if(y>h+30||x<-60||x>w+60)return;
  ctx.save();ctx.translate(x,y);ctx.rotate(p.rot+p.spin*t);ctx.globalCompositeOperation='screen';ctx.fillStyle=rgba(p.color,.62*fade);ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*.45,0,0,Math.PI*2);ctx.fill();ctx.restore();
}

function addEllipseTargets(list,rng,w,h,cx,cy,rx,ry,count,color,size){
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2+(rng()-.5)*.035,edge=.94+rng()*.12;particle(list,rng,w,h,cx+Math.cos(a)*rx*edge,cy+Math.sin(a)*ry*edge,color,size*(.72+rng()*.58),'collectible',rng()*780);}
}
function addLineTargets(list,rng,w,h,x1,y1,x2,y2,count,color,size){
  for(let i=0;i<count;i++){const t=i/(count-1||1);particle(list,rng,w,h,mix(x1,x2,t)+(rng()-.5)*1.3,mix(y1,y2,t)+(rng()-.5)*1.3,color,size*(.72+rng()*.58),'collectible',rng()*780);}
}
function addFilledEllipse(list,rng,w,h,cx,cy,rx,ry,count,color,size){
  for(let i=0;i<count;i++){const a=rng()*Math.PI*2,r=Math.sqrt(rng());particle(list,rng,w,h,cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r,color,size*(.58+rng()*.72),'collectible',160+rng()*900);}
}
function buildTeddyTargets(rng,w,h,recipe,reduced){
  const list=[],s=Math.min(w/390,h/780,1.18),cx=w*.5,cy=h*.385,main=recipe.color,light=recipe.accent,dark='#4f3634',species=recipe.species||'bear';
  if(species==='rabbit'){
    addFilledEllipse(list,rng,w,h,cx-39*s,cy-132*s,23*s,64*s,reduced?48:82,main,1.08*s);addFilledEllipse(list,rng,w,h,cx+39*s,cy-132*s,23*s,64*s,reduced?48:82,main,1.08*s);addEllipseTargets(list,rng,w,h,cx-39*s,cy-132*s,13*s,47*s,48,light,1.25*s);addEllipseTargets(list,rng,w,h,cx+39*s,cy-132*s,13*s,47*s,48,light,1.25*s);
  }else if(species==='puppy'){
    addFilledEllipse(list,rng,w,h,cx-78*s,cy-48*s,31*s,62*s,reduced?52:88,main,1.08*s);addFilledEllipse(list,rng,w,h,cx+78*s,cy-48*s,31*s,62*s,reduced?52:88,main,1.08*s);addEllipseTargets(list,rng,w,h,cx-78*s,cy-48*s,31*s,62*s,64,light,1.2*s);addEllipseTargets(list,rng,w,h,cx+78*s,cy-48*s,31*s,62*s,64,light,1.2*s);
  }else if(species==='kitten'){
    addLineTargets(list,rng,w,h,cx-78*s,cy-73*s,cx-54*s,cy-132*s,46,light,1.35*s);addLineTargets(list,rng,w,h,cx-54*s,cy-132*s,cx-19*s,cy-89*s,42,light,1.35*s);addLineTargets(list,rng,w,h,cx+78*s,cy-73*s,cx+54*s,cy-132*s,46,light,1.35*s);addLineTargets(list,rng,w,h,cx+54*s,cy-132*s,cx+19*s,cy-89*s,42,light,1.35*s);addFilledEllipse(list,rng,w,h,cx-52*s,cy-101*s,19*s,25*s,reduced?24:42,main,1.05*s);addFilledEllipse(list,rng,w,h,cx+52*s,cy-101*s,19*s,25*s,reduced?24:42,main,1.05*s);
  }else{
    addFilledEllipse(list,rng,w,h,cx-67*s,cy-80*s,39*s,39*s,reduced?45:72,main,1.15*s);addFilledEllipse(list,rng,w,h,cx+67*s,cy-80*s,39*s,39*s,reduced?45:72,main,1.15*s);addEllipseTargets(list,rng,w,h,cx-67*s,cy-80*s,39*s,39*s,46,light,1.35*s);addEllipseTargets(list,rng,w,h,cx+67*s,cy-80*s,39*s,39*s,46,light,1.35*s);
  }
  addFilledEllipse(list,rng,w,h,cx,cy-29*s,91*s,79*s,reduced?180:290,main,1.12*s);addEllipseTargets(list,rng,w,h,cx,cy-29*s,91*s,79*s,130,light,1.38*s);
  addFilledEllipse(list,rng,w,h,cx,cy+111*s,77*s,96*s,reduced?175:285,main,1.1*s);addEllipseTargets(list,rng,w,h,cx,cy+111*s,77*s,96*s,134,light,1.35*s);
  addFilledEllipse(list,rng,w,h,cx,cy+115*s,45*s,61*s,reduced?58:96,light,1.0*s);addEllipseTargets(list,rng,w,h,cx,cy+115*s,45*s,61*s,64,light,1.15*s);
  const muzzleY=species==='rabbit'?cy+1*s:cy-2*s,muzzleRX=species==='kitten'?32:42,muzzleRY=species==='kitten'?23:31;
  addFilledEllipse(list,rng,w,h,cx,muzzleY,muzzleRX*s,muzzleRY*s,reduced?42:72,light,1.02*s);addEllipseTargets(list,rng,w,h,cx,muzzleY,muzzleRX*s,muzzleRY*s,58,light,1.18*s);
  addFilledEllipse(list,rng,w,h,cx-32*s,cy-39*s,5*s,7*s,12,dark,1.55*s);addFilledEllipse(list,rng,w,h,cx+32*s,cy-39*s,5*s,7*s,12,dark,1.55*s);addFilledEllipse(list,rng,w,h,cx,cy-9*s,8*s,6*s,18,dark,1.55*s);
  addLineTargets(list,rng,w,h,cx-9*s,cy+3*s,cx,cy+10*s,13,dark,1.15*s);addLineTargets(list,rng,w,h,cx,cy+10*s,cx+9*s,cy+3*s,13,dark,1.15*s);
  if(species==='rabbit'){addLineTargets(list,rng,w,h,cx-6*s,cy+12*s,cx-6*s,cy+24*s,10,light,1.1*s);addLineTargets(list,rng,w,h,cx+6*s,cy+12*s,cx+6*s,cy+24*s,10,light,1.1*s);}
  if(species==='kitten'){for(const side of [-1,1]){addLineTargets(list,rng,w,h,cx+side*16*s,cy+2*s,cx+side*65*s,cy-5*s,24,light,1.05*s);addLineTargets(list,rng,w,h,cx+side*17*s,cy+9*s,cx+side*67*s,cy+17*s,24,light,1.05*s);}}
  if(species==='puppy')addFilledEllipse(list,rng,w,h,cx-46*s,cy-35*s,21*s,28*s,reduced?20:36,dark,1.02*s);
  addFilledEllipse(list,rng,w,h,cx-77*s,cy+99*s,29*s,65*s,reduced?46:78,main,1.08*s);addFilledEllipse(list,rng,w,h,cx+77*s,cy+99*s,29*s,65*s,reduced?46:78,main,1.08*s);addEllipseTargets(list,rng,w,h,cx-77*s,cy+99*s,29*s,65*s,68,light,1.15*s);addEllipseTargets(list,rng,w,h,cx+77*s,cy+99*s,29*s,65*s,68,light,1.15*s);
  addFilledEllipse(list,rng,w,h,cx-47*s,cy+195*s,34*s,28*s,reduced?34:58,main,1.08*s);addFilledEllipse(list,rng,w,h,cx+47*s,cy+195*s,34*s,28*s,reduced?34:58,main,1.08*s);addEllipseTargets(list,rng,w,h,cx-47*s,cy+195*s,34*s,28*s,52,light,1.25*s);addEllipseTargets(list,rng,w,h,cx+47*s,cy+195*s,34*s,28*s,52,light,1.25*s);
  for(const side of [-1,1]){addEllipseTargets(list,rng,w,h,cx+side*47*s,cy+196*s,5*s,4*s,14,dark,1.0*s);addEllipseTargets(list,rng,w,h,cx+side*58*s,cy+190*s,4*s,3*s,12,dark,.95*s);}
  addLineTargets(list,rng,w,h,cx-40*s,cy+49*s,cx+40*s,cy+49*s,50,light,1.38*s);addEllipseTargets(list,rng,w,h,cx,cy+48*s,14*s,11*s,36,recipe.accent,1.48*s);addLineTargets(list,rng,w,h,cx,cy+57*s,cx,cy+175*s,52,light,.95*s);
  return {list,cx,cy,s,glow:recipe.accent};
}
function buildRingTargets(rng,w,h,recipe,reduced){
  const list=[],s=Math.min(w/390,h/780,1.18),cx=w*.5,cy=h*.445,metal=recipe.metal,gem=recipe.gem,style=recipe.style||'round',stoneY=cy-72*s;
  addEllipseTargets(list,rng,w,h,cx,cy+25*s,74*s,74*s,reduced?150:245,metal,1.2*s);addEllipseTargets(list,rng,w,h,cx,cy+25*s,62*s,62*s,reduced?115:190,metal,.8*s);
  addLineTargets(list,rng,w,h,cx-48*s,cy-24*s,cx-30*s,stoneY+20*s,30,metal,1.08*s);addLineTargets(list,rng,w,h,cx+48*s,cy-24*s,cx+30*s,stoneY+20*s,30,metal,1.08*s);
  if(style==='heart'){
    const heart=[];for(let i=0;i<=96;i++){const t=i/96*Math.PI*2,x=16*Math.pow(Math.sin(t),3),y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);heart.push([cx+x*2.05*s,stoneY-y*1.82*s]);}for(let i=0;i<heart.length-1;i++)addLineTargets(list,rng,w,h,...heart[i],...heart[i+1],4,gem,1.28*s);addLineTargets(list,rng,w,h,cx,stoneY-26*s,cx,stoneY+31*s,38,gem,.92*s);addLineTargets(list,rng,w,h,cx-30*s,stoneY-1*s,cx+30*s,stoneY-1*s,42,gem,.92*s);
  }else if(style==='pear'){
    const pear=[[cx,stoneY-43*s],[cx-30*s,stoneY-7*s],[cx-31*s,stoneY+17*s],[cx-18*s,stoneY+35*s],[cx,stoneY+42*s],[cx+18*s,stoneY+35*s],[cx+31*s,stoneY+17*s],[cx+30*s,stoneY-7*s],[cx,stoneY-43*s]];for(let i=0;i<pear.length-1;i++)addLineTargets(list,rng,w,h,...pear[i],...pear[i+1],26,gem,1.3*s);addLineTargets(list,rng,w,h,cx,stoneY-43*s,cx,stoneY+42*s,46,gem,.9*s);addLineTargets(list,rng,w,h,cx-30*s,stoneY-7*s,cx+30*s,stoneY-7*s,40,gem,.9*s);addLineTargets(list,rng,w,h,cx-18*s,stoneY+35*s,cx,stoneY-43*s,42,gem,.86*s);addLineTargets(list,rng,w,h,cx+18*s,stoneY+35*s,cx,stoneY-43*s,42,gem,.86*s);
  }else{
    const rx=style==='halo'?31:28,ry=style==='halo'?25:28;addEllipseTargets(list,rng,w,h,cx,stoneY,rx*s,ry*s,reduced?72:118,gem,1.3*s);if(style==='halo')addEllipseTargets(list,rng,w,h,cx,stoneY,41*s,35*s,reduced?82:138,metal,.95*s);addLineTargets(list,rng,w,h,cx-rx*s,stoneY,cx+rx*s,stoneY,40,gem,.86*s);addLineTargets(list,rng,w,h,cx,stoneY-ry*s,cx,stoneY+ry*s,40,gem,.86*s);addLineTargets(list,rng,w,h,cx-rx*.72*s,stoneY-ry*.72*s,cx+rx*.72*s,stoneY+ry*.72*s,38,gem,.82*s);addLineTargets(list,rng,w,h,cx+rx*.72*s,stoneY-ry*.72*s,cx-rx*.72*s,stoneY+ry*.72*s,38,gem,.82*s);
  }
  if(style==='halo'||style==='round')for(let side=-1;side<=1;side+=2)for(let i=0;i<5;i++)addEllipseTargets(list,rng,w,h,cx+side*(38+i*6)*s,cy-24*s+i*3*s,2.2*s,2.2*s,9,gem,.9*s);
  for(let i=0;i<(reduced?48:88);i++){const a=rng()*Math.PI*2,r=13*s*Math.sqrt(rng());particle(list,rng,w,h,cx+Math.cos(a)*r,stoneY+Math.sin(a)*r,gem,.8+rng()*1.25,'collectible',250+rng()*800);}
  return {list,cx,cy,s,glow:gem};
}
function playCollectibleGiftEffect(kind,options){
  options=options||{};ensureStyles();if(activeEffect)activeEffect.stop(true);kind=kind==='ring'?'ring':'teddy';
  const reduced=options.fullMotion!==true&&!!(global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches);let recipe=options.recipe&&options.recipe.type===kind?options.recipe:createCollectibleRecipe(kind,options);if(!options.recipe&&recipe.id===lastCollectibleId[kind]){const source=kind==='ring'?RING_RECIPES:TEDDY_RECIPES,current=source.findIndex(x=>x.id===recipe.id),next=source[(current+1)%source.length];recipe=Object.assign({type:kind,seed:recipe.seed,date:recipe.date},next,{words:safeLabel(options.words,next.words)});}lastCollectibleId[kind]=recipe.id;const rng=seededRandom(recipe.seed);
  const overlay=document.createElement('div');overlay.className='gift-bouquet-overlay gift-collectible-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label',kind==='ring'?'订婚戒指礼物特效':'玩偶礼物特效');overlay.dataset.effectVersion=EFFECT_VERSION;
  const canvas=document.createElement('canvas');canvas.className='gift-bouquet-canvas';const vignette=document.createElement('div');vignette.className='gift-bouquet-vignette';const close=document.createElement('button');close.type='button';close.className='gift-bouquet-close';close.setAttribute('aria-label','关闭礼物特效');close.textContent='×';
  const hint=document.createElement('div');hint.className='gift-bouquet-hint';hint.textContent=kind==='ring'?'PROMISE IN LIGHT':'SOFT COMPANION';const copy=document.createElement('div');copy.className='gift-bouquet-copy';const kicker=document.createElement('span');kicker.textContent='JUST FOR YOU';const title=document.createElement('strong');title.textContent=recipe.name;const english=document.createElement('b');english.textContent=recipe.enName;const words=document.createElement('em');words.textContent=safeLabel(options.words,recipe.words);const detail=document.createElement('small');detail.textContent=safeLabel(options.sender,'TA')+' 赠予 · '+recipe.date;copy.append(kicker,title,english,words,detail);overlay.append(canvas,vignette,hint,copy,close);document.body.appendChild(overlay);
  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});let frame=0,start=performance.now(),stopped=false,figure,w,h,dpr;const duration=reduced?4200:6800;
  function size(){w=Math.max(280,global.innerWidth||390);h=Math.max(420,global.innerHeight||760);dpr=Math.min(global.devicePixelRatio||1,1.75);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);figure=kind==='ring'?buildRingTargets(rng,w,h,recipe,reduced):buildTeddyTargets(rng,w,h,recipe,reduced);}
  function stop(immediate){if(stopped)return;stopped=true;if(frame)cancelAnimationFrame(frame);global.removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisibility);if(immediate){overlay.remove();if(activeEffect&&activeEffect.overlay===overlay)activeEffect=null;return;}overlay.classList.add('closing');setTimeout(()=>{overlay.remove();if(activeEffect&&activeEffect.overlay===overlay)activeEffect=null;},300);}
  function onResize(){size();start=performance.now()-Math.min(performance.now()-start,1600);}function onVisibility(){if(document.hidden)stop(true);}
  function draw(now){if(stopped)return;const elapsed=now-start,fade=elapsed>duration-700?clamp((duration-elapsed)/700,0,1):1,form=clamp((elapsed-320)/1700,0,1);ctx.clearRect(0,0,w,h);const halo=ctx.createRadialGradient(figure.cx,figure.cy,0,figure.cx,figure.cy,Math.min(w,h)*.38);halo.addColorStop(0,rgba(figure.glow,.12*form*fade));halo.addColorStop(1,rgba(figure.glow,0));ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
    for(const p of figure.list){const progress=clamp((elapsed-p.delay)/(reduced?650:1550),0,1);if(progress<=0)continue;const e=easeOutCubic(progress),x=mix(p.sx,p.tx,e)+Math.sin(elapsed*.002+p.tw)*p.drift*(progress>.9?.06:0),y=mix(p.sy,p.ty,e);ctx.globalCompositeOperation='lighter';ctx.fillStyle=rgba(p.color,fade*(.62+.38*Math.sin(elapsed*.004+p.tw)));ctx.beginPath();ctx.arc(x,y,p.size*(.7+.3*e),0,Math.PI*2);ctx.fill();}
    if(elapsed<duration)frame=requestAnimationFrame(draw);else stop(false);
  }
  close.addEventListener('click',()=>stop(false));overlay.addEventListener('pointerup',e=>{if((e.target===overlay||e.target===canvas||e.target===vignette)&&performance.now()-start>1100)stop(false);});size();global.addEventListener('resize',onResize,{passive:true});document.addEventListener('visibilitychange',onVisibility);requestAnimationFrame(()=>overlay.classList.add('show'));frame=requestAnimationFrame(draw);activeEffect={overlay,stop,seed:recipe.seed,recipe};return activeEffect;
}

function playBouquetGiftEffect(options){
  options=options||{};ensureStyles();
  if(activeEffect)activeEffect.stop(true);
  const reduced=options.fullMotion!==true&&!!(global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const recipe=normalizeBouquetRecipe(options.recipe,Object.assign({},options,{seed:options.seed||(options.recipe&&options.recipe.seed)})),seed=recipe.seed,rng=seededRandom(seed),palette=PALETTES.find(p=>p.name===recipe.palette)||pick(rng,PALETTES);
  const overlay=document.createElement('div');overlay.className='gift-bouquet-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','花束礼物特效');overlay.dataset.effectVersion=EFFECT_VERSION;
  const canvas=document.createElement('canvas');canvas.className='gift-bouquet-canvas';
  const vignette=document.createElement('div');vignette.className='gift-bouquet-vignette';
  const close=document.createElement('button');close.type='button';close.className='gift-bouquet-close';close.setAttribute('aria-label','关闭花束特效');close.textContent='×';
  const hint=document.createElement('div');hint.className='gift-bouquet-hint';hint.textContent='PARTICLE BLOOM';
  const copy=document.createElement('div');copy.className='gift-bouquet-copy';
  const kicker=document.createElement('span');kicker.textContent='JUST FOR YOU';
  const title=document.createElement('strong');title.textContent=recipe.flowerName;
  const english=document.createElement('b');english.textContent=recipe.enName;
  const meaning=document.createElement('em');meaning.textContent='花语 · '+recipe.flowerMeaning;
  const detail=document.createElement('small');detail.textContent=safeLabel(options.sender,'TA')+' 赠予 · '+recipe.date;
  copy.append(kicker,title,english,meaning,detail);overlay.append(canvas,vignette,hint,copy,close);document.body.appendChild(overlay);
  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  let frame=0,start=performance.now(),stopped=false,bouquet,w,h,dpr;
  const duration=reduced?4200:7000;
  function size(){
    w=Math.max(280,global.innerWidth||document.documentElement.clientWidth||390);h=Math.max(420,global.innerHeight||document.documentElement.clientHeight||760);dpr=Math.min(global.devicePixelRatio||1,1.75);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);bouquet=buildBouquet(rng,w,h,palette,reduced);
  }
  function stop(immediate){
    if(stopped)return;stopped=true;if(frame)cancelAnimationFrame(frame);global.removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVisibility);
    if(immediate){overlay.remove();if(activeEffect&&activeEffect.overlay===overlay)activeEffect=null;return;}
    overlay.classList.add('closing');setTimeout(()=>{overlay.remove();if(activeEffect&&activeEffect.overlay===overlay)activeEffect=null;},300);
  }
  function onResize(){size();start=performance.now()-Math.min(performance.now()-start,1800);}
  function onVisibility(){if(document.hidden)stop(true);}
  function draw(now){
    if(stopped)return;const elapsed=now-start,fade=elapsed>duration-800?clamp((duration-elapsed)/800,0,1):1;ctx.clearRect(0,0,w,h);
    const bloomAlpha=clamp((elapsed-850)/1250,0,1)*fade;
    if(bloomAlpha>0){drawBouquetBase(ctx,bouquet,bloomAlpha);for(const b of bouquet.blossoms)drawSoftBloom(ctx,b,elapsed,bloomAlpha);drawRibbon(ctx,bouquet,elapsed,bloomAlpha);}
    for(const p of bouquet.particles){
      const progress=clamp((elapsed-p.delay)/(reduced?700:1750),0,1),e=easeOutCubic(progress);if(progress<=0)continue;
      let x=mix(p.sx,p.tx,e),y=mix(p.sy,p.ty,e),alpha=clamp(progress*1.7,0,1)*fade;
      if(progress>.88){x+=Math.sin(elapsed*.0024+p.tw)*p.drift*.08;y+=Math.cos(elapsed*.002+p.tw)*1.4;}
      const sparkle=.76+.24*Math.sin(elapsed*.004+p.tw),size=p.size*(.72+.28*e);
      ctx.globalCompositeOperation=p.kind==='stem'||p.kind==='leaf'?'source-over':'lighter';ctx.fillStyle=rgba(p.color,alpha*sparkle*(p.kind==='wrap'?.66:.9));ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
    }
    for(const p of bouquet.petals)drawPetal(ctx,p,elapsed,w,h,fade);
    if(elapsed<duration){frame=requestAnimationFrame(draw);}else stop(false);
  }
  close.addEventListener('click',()=>stop(false));
  overlay.addEventListener('pointerup',e=>{if(e.target===overlay||e.target===canvas||e.target===vignette){if(performance.now()-start>1100)stop(false);}});
  size();global.addEventListener('resize',onResize,{passive:true});document.addEventListener('visibilitychange',onVisibility);requestAnimationFrame(()=>overlay.classList.add('show'));frame=requestAnimationFrame(draw);
  activeEffect={overlay,stop,seed,palette:palette.name,recipe};return activeEffect;
}

function stopBouquetGiftEffect(){if(activeEffect)activeEffect.stop(false);}
if(global.document)ensureStyles();
global.giftEffectIsFloral=giftEffectIsFloral;
global.playBouquetGiftEffect=playBouquetGiftEffect;
global.playTeddyGiftEffect=options=>playCollectibleGiftEffect('teddy',options);
global.playRingGiftEffect=options=>playCollectibleGiftEffect('ring',options);
global.playGiftBoxReveal=playGiftBoxReveal;
global.stopBouquetGiftEffect=stopBouquetGiftEffect;
global.NorthGiftEffects={version:EFFECT_VERSION,isFloral:giftEffectIsFloral,createBouquetRecipe,createTeddyRecipe:options=>createCollectibleRecipe('teddy',options),createRingRecipe:options=>createCollectibleRecipe('ring',options),play:playBouquetGiftEffect,playTeddy:global.playTeddyGiftEffect,playRing:global.playRingGiftEffect,playBox:playGiftBoxReveal,stop:stopBouquetGiftEffect,palettes:PALETTES.map(p=>p.name),flowers:FLOWER_RECIPES.map(x=>({id:x.id,name:x.name,meaning:x.meaning,palette:x.palette}))};
})(window);
