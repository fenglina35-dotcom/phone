'use strict';
(async () => {
  // Shared web/private game; role and phone persistence remain in the parent adapter.
  const $ = s => document.querySelector(s);
  const canvas = $('#scene'), ctx = canvas.getContext('2d'), world = $('#world');
  $('#exit-home').onclick=()=>window.PixelHomeBridge.request('exit').catch(()=>{});
  let initial;
  try{initial=await window.PixelHomeBridge.request('hello');}catch(e){$('#loading').textContent=e.message;return;}
  const KEY='pixel-home:'+initial.scope,ASSETS={};let lastSave=Promise.resolve(),hostRevision=0,hostLive=true;

  const clamp = (v,a=0,b=100) => Math.min(b,Math.max(a,Number.isFinite(v)?v:a));
  const day = () => new Date().toLocaleDateString('en-CA');
  const fresh = () => ({version:3,mood:82,food:58,energy:65,health:94,clean:68,coins:120,top:0,skirt:0,feet:0,hair:0,hairColor:'brown',necklace:-1,hairClip:-1,matchingClip:-1,bow:false,bowOwned:false,expression:'auto',room:0,inventory:[3,3,3,1,1,1,0,1],photos:[],diary:[],lastAt:Date.now(),sleeping:false,lightsOff:false,rewards:{}});
  function restore(){const base=fresh();try{const d=initial.state;if(!d||![1,2,3].includes(d.version))return base;for(const k of ['mood','food','energy','health','clean'])if(Number.isFinite(d[k]))base[k]=clamp(d[k]);if(Number.isFinite(d.coins))base.coins=Math.round(clamp(d.coins,0,9999));for(const k of ['top','skirt','feet'])base[k]=Math.round(clamp(d[k],0,13));for(const k of ['hair','room'])base[k]=Math.round(clamp(d[k],0,k==='hair'?6:2));base.look=d.look===1?1:0;base.top=base.skirt;base.hairColor=d.hairColor==='espresso'?'espresso':'brown';base.matchingClip=Number.isInteger(d.matchingClip)?Math.round(clamp(d.matchingClip,-1,13)):-1;base.necklace=Number.isInteger(d.necklace)?Math.round(clamp(d.necklace,-1,3)):-1;base.hairClip=Number.isInteger(d.hairClip)?Math.round(clamp(d.hairClip,-1,3)):-1;base.bow=d.bow===true;base.bowOwned=d.bowOwned===true;base.sleeping=d.sleeping===true;base.lightsOff=base.sleeping;base.expression=['auto','happy'].includes(d.expression)?d.expression:'auto';if(Array.isArray(d.inventory))base.inventory=base.inventory.map((n,i)=>Number.isFinite(d.inventory[i])?Math.round(clamp(d.inventory[i],0,99)):n);if(Array.isArray(d.photos))base.photos=d.photos.filter(p=>typeof p?.image==='string'&&p.image.startsWith('data:image/jpeg;base64,')&&p.image.length<300000).slice(-6);if(Array.isArray(d.diary))base.diary=d.diary.filter(x=>typeof x?.text==='string'&&typeof x?.time==='string').slice(-8);if(Number.isFinite(d.lastAt)&&d.lastAt>0)base.lastAt=d.lastAt;if(d.rewards&&typeof d.rewards==='object')base.rewards=Object.fromEntries(Object.entries(d.rewards).filter(([k,v])=>k.startsWith(day())&&v===true));return base;}catch{return base;}}
  const state=restore();state.look=initial.morning.look; let W=390,H=690,dpr=1,ready=false,raf=0,frame=0,lastFrame=0,now=0,drawer='',tab='sets';
  let action='idle',actionUntil=0,reactX=0,pokeCount=0,lastPoke=0,blinkUntil=0,nextBlink=0,gaze={x:0,y:0};
  let particles=[],drag=null,press=null,selected=null,wash=0,brush=0,ball=null,lastBallReward=0,careToken=0,careActive=false,soundOn=false,audioCtx=null,storageFailed=false;
  let speechTimer=0,feedFx=null,gestureRewardAt=0;
  let mirrorMode=false,teethProgress=0,faceFoam=0,faceReady=false,teddyUntil=0,careDriving=false,careCursor={x:0,y:0};
  const items=[{name:'草莓吐司',price:12,food:25},{name:'温温牛奶',price:10,food:18},{name:'新鲜草莓',price:8,food:14},{name:'玫瑰香皂'},{name:'丝带梳子'},{name:'星星皮球'},{name:'玫瑰发卡',price:45},{name:'健康药水',price:25},{name:'软软毛巾'},{name:'草莓牙刷'},{name:'玫瑰洗面奶'},{name:'抱抱小熊'}];
  const outfitNames=['草莓奶油','蓝莓来信','晚安格纹','海盐水手服','焦糖格纹 JK','草莓洛丽塔','紫藤长裙','海风长水手裙','黑糖水手服','蓝蔷薇长裙','复古玫瑰裙','秋日学院长裙','黑白女仆装','晴日小白裙'];
  const roomNames=['暖暖卧室','草莓餐桌','泡泡浴室'];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));const revision=++hostRevision;lastSave=window.PixelHomeBridge.request('save',JSON.parse(JSON.stringify(state))).catch(e=>{if(revision===hostRevision){storageFailed=true;$('#save-warning').hidden=false;$('#save-warning').textContent=e.message;}});storageFailed=false;$('#save-warning').hidden=true;return true;}catch{if(!storageFailed){storageFailed=true;$('#save-warning').hidden=false;}return false;}}
  function advance(){
    const changed=window.RoseDollCore.settle(state,Date.now());
    if(changed&&ready){cancelCare(false);setMirror(false,true);cancelPointers();selected=null;ball=null;wash=0;$('#wash-progress').hidden=true;closeDrawer();renderRooms();renderTray();vitals();decorate();say('健康偏低，已回床休息。可以点药水护理，或关灯慢慢恢复。',6000);}
    save();
  }
  function say(text,ms=3500){
    clearTimeout(speechTimer);$('#speech').textContent=text;
    $('#feedback').textContent=text;$('#feedback').hidden=false;$('#panel-feedback').textContent=text;
    speechTimer=setTimeout(()=>{$('#feedback').hidden=true;$('#panel-feedback').textContent='';},ms);
  }
  function log(text){state.diary.push({text,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})});state.diary=state.diary.slice(-8);renderDiary();save();}
  function renderDiary(){const list=$('#diary');list.replaceChildren();for(const entry of state.diary.slice(-4).reverse()){const li=document.createElement('li'),small=document.createElement('small');small.textContent=entry.time;li.append(small,document.createTextNode(entry.text));list.append(li);}}
  function reward(key,amount){const k=day()+':'+key;if(state.rewards[k])return;state.rewards[k]=true;state.coins=clamp(state.coins+amount,0,9999);say('今天的小奖励，收好 '+amount+' 枚星星币 ♡');}
  function tone(kind='soft'){if(!soundOn)return;try{audioCtx||=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const t=audioCtx.currentTime;[0,.1].forEach((delay,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=(kind==='eat'?523:659)*(i?1.25:1);g.gain.setValueAtTime(0,t+delay);g.gain.linearRampToValueAtTime(.035,t+delay+.015);g.gain.exponentialRampToValueAtTime(.0001,t+delay+.28);o.connect(g).connect(audioCtx.destination);o.start(t+delay);o.stop(t+delay+.3);});}catch{}}
  function iconCanvas(index,size=100){const c=document.createElement('canvas');c.width=c.height=size;c.dataset.icon=String(index);c.setAttribute('aria-hidden','true');if(ASSETS.icons){const g=c.getContext('2d'),z=ASSETS.icons.width/4;g.drawImage(ASSETS.icons,(index%4)*z,Math.floor(index/4)*z,z,z,0,0,size,size);}return c;}
  function decorate(){const specs=[['[data-panel="wardrobe"]',0,'衣柜'],['[data-panel="vanity"]',1,'梳妆台'],['#care',2,'让他照顾'],['[data-panel="shop"]',3,'小铺'],['[data-panel="album"]',4,'收藏'],['#sound',5,'音乐'],['#photo',6,'相机'],['#fullscreen',15,document.fullscreenElement?'退出全屏':'全屏'],['[data-room="0"]',12,'卧室'],['[data-room="1"]',13,'餐桌'],['[data-room="2"]',14,'浴室']];for(const [selector,index,label]of specs){const b=$(selector);if(!b)continue;b.replaceChildren(iconCanvas(index),document.createTextNode(label));}}
  function vitals(){const data=[['mood','心情',8],['food','饱腹',9],['energy','精神',10],['health','健康',11]];const root=$('#vitals');for(const[k,n,i]of data){let el=root.querySelector('[data-stat="'+k+'"]');if(!el){el=document.createElement('button');el.className='vital';el.dataset.stat=k;el.innerHTML='<span class="stat-disc"><span class="stat-fill"></span></span><span class="stat-label"></span><output></output>';el.querySelector('.stat-disc').append(iconCanvas(i));el.querySelector('.stat-label').textContent=n;el.onclick=()=>{root.querySelectorAll('.peek').forEach(b=>b.classList.remove('peek'));el.classList.add('peek');clearTimeout(el._peekTimer);el._peekTimer=setTimeout(()=>el.classList.remove('peek'),2400);};root.append(el);}const value=Math.round(state[k]);el.style.setProperty('--level',value+'%');el.dataset.value=value;el.setAttribute('aria-label',n+' '+value+'%');el.querySelector('output').textContent=value+'%';el.classList.toggle('low',value<20);}$('#coins').textContent=state.coins;document.body.classList.toggle('sleeping',state.sleeping);document.body.classList.toggle('lights-off',state.lightsOff);}
  function itemCanvas(index,size=96){const c=document.createElement('canvas');c.width=c.height=size;c.dataset.item=String(index);const g=c.getContext('2d');if(index>=9&&ASSETS[['toothbrush','cleanser','teddy'][index-9]]){g.drawImage(ASSETS[['toothbrush','cleanser','teddy'][index-9]],0,0,size,size);return c;}if(ASSETS.props){const s=ASSETS.props.width/3;g.drawImage(ASSETS.props,(index%3)*s,Math.floor(index/3)*s,s,s,0,0,size,size);}return c;}
  function prop(index,x,y,size,angle=0,alpha=1){if(index>=9){const im=ASSETS[['toothbrush','cleanser','teddy'][index-9]];ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(im,-size/2,-size/2,size,size);ctx.restore();return;}const im=ASSETS.props,s=im.width/3;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(im,(index%3)*s,Math.floor(index/3)*s,s,s,-size/2,-size/2,size,size);ctx.restore();}
  function dollMetrics(){let h=Math.min(H*.56,W*.96),x=W*.50,bottom=Math.min(H*.91,H-120);if(drawer){bottom=H-$('#drawer').offsetHeight-12;h=Math.min(H*.40,W*.70,Math.max(65,bottom-65));}if(state.sleeping&&!drawer){h=Math.min(H*.40,W*.76);x=W*.58;bottom=H*.72;}return{h,x,y:bottom-h,s:h/512,w:h*320/512};}
  function drawDoll(g,x,y,h,opts={}){
    const s=h/512;
    const closed=opts.closed??(now<blinkUntil||['pet','eat','wash','hug'].includes(action));
    g.save();g.translate(x,y);
    if(!opts.still){
      g.translate(action==='poke'?Math.sin(now/65)*2:0,reduced?0:Math.sin(now/1400));
      if(action==='play')g.rotate(Math.sin(now/130)*.025);
    }
    // One complete original character per frame, same source box and fixed scale.
    g.drawImage(ASSETS.longEspresso,(state.look===1?608:192),closed?512:0,320,512,-160*s,0,320*s,h);
    g.restore();
  }
  function drawBackground(){if(state.room===0){ctx.drawImage(ASSETS.bedroom,0,0,W,H);}else{const im=ASSETS.rooms;ctx.drawImage(im,(state.room-1)*im.width/2,0,im.width/2,im.height,0,0,W,H);} // Whole portrait panel retained; no horizontal crop.
    ctx.fillStyle='rgba(254,237,200,.035)';ctx.fillRect(0,0,W,H);
  }
  function burst(x,y,kind='heart',count=7){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*1.5,vy:-.7-Math.random()*1.4,life:1,kind,size:6+Math.random()*9});particles=particles.slice(-90);}
  function drawParticles(dt){for(const p of particles){p.x+=p.vx*dt/16;p.y+=p.vy*dt/16;p.life-=dt/(p.kind==='bubble'?2300:1500);ctx.globalAlpha=Math.max(0,p.life);if(p.kind==='bubble'){ctx.fillStyle='#fffaf0bb';ctx.strokeStyle='#ead3e2';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.fillRect(p.x-p.size*.35,p.y-p.size*.45,3,3);}else{ctx.fillStyle=p.kind==='heart'?'#b76279':'#fff1bb';ctx.font=p.size+'px Georgia';ctx.fillText(p.kind==='heart'?'♥':'✦',p.x,p.y);}}ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);}
  function updateBall(dt){if(!ball)return;if(!ball.held){ball.vy+=.0015*dt;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.vx*=Math.pow(.997,dt);const floor=H-25;if(ball.y>floor){ball.y=floor;ball.vy=-Math.abs(ball.vy)*.73;}if(ball.x<22||ball.x>W-22){ball.x=clamp(ball.x,22,W-22);ball.vx*=-.85;}if(ball.y<190){ball.y=190;ball.vy=Math.abs(ball.vy);}const m=dollMetrics();if(Math.abs(ball.x-m.x)<m.h*.16&&Math.abs(ball.y-(m.y+m.h*.45))<40&&performance.now()-lastBallReward>1800){lastBallReward=performance.now();state.mood=clamp(state.mood+4);action='play';actionUntil=now+650;ball.vx=(ball.x<m.x?-1:1)*.28;ball.vy=-.3;burst(ball.x,ball.y);say('接住啦！再来一次 ♡');reward('play',10);vitals();save();}}prop(5,ball.x,ball.y,51,ball.x/80);}
  function draw(t){raf=0;if(document.hidden||!ready)return;if(t-lastFrame<32){raf=requestAnimationFrame(draw);return;}const dt=Math.min(t-lastFrame||32,80);lastFrame=t;now=t;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);drawBackground();if(now>actionUntil){action='idle';reactX=0;}if(now>nextBlink){blinkUntil=now+140;nextBlink=now+2400+Math.random()*3000;}
    const m=dollMetrics();if(mirrorMode&&!drawer){drawMirror();}else if(state.sleeping&&!drawer){const im=ASSETS.sleepAll,dw=W*.43,dh=H*.29,dx=W*.72-dw/2,dy=H*.36;const breath=reduced?0:Math.sin(now/1900)*.65;ctx.drawImage(im,0,512,338,512,dx,dy+breath,dw,dh);ctx.fillStyle='#fff6e9';ctx.font='16px Georgia';ctx.fillText('z',W*.89,H*.37+Math.sin(now/1000)*3);ctx.font='10px Georgia';ctx.fillText('z',W*.92,H*.345+Math.sin(now/1000)*3);}else{ctx.save();ctx.fillStyle='#67402722';ctx.beginPath();ctx.ellipse(m.x,m.y+m.h-2,m.w*.30,8,0,0,Math.PI*2);ctx.fill();ctx.restore();drawDoll(ctx,m.x,m.y,m.h);}
    if(teddyUntil>now&&!mirrorMode&&!state.sleeping&&!drawer){prop(11,m.x+Math.sin(now/250)*3,m.y+m.h*.47,m.h*.36,Math.sin(now/400)*.08);}
    if(feedFx){const p=clamp((now-feedFx.start)/850,0,1);prop(feedFx.id,m.x+Math.sin(p*5)*3,m.y+m.h*.20,52*(1-p*.8),-.1,p>.85?(1-p)/.15:1);if(p>=1)feedFx=null;}
    updateBall(dt);drawParticles(dt);if(!reduced&&!state.sleeping){ctx.globalAlpha=.45;ctx.fillStyle='#fff5cb';for(let i=0;i<7;i++){const x=(i*67+now*.005)%W,y=(i*97+Math.sin(now/3400+i)*12)%H;ctx.fillRect(x,y,1.5,1.5);}ctx.globalAlpha=1;}
    frame++;raf=requestAnimationFrame(draw);
  }
  function resize(){const r=world.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ball=null;}
  function awake(){advance();if(!state.sleeping)return true;say(state.health<20?'她需要休息，睡一会儿也能慢慢恢复健康。':'她正睡得香，先轻轻叫醒她吧。');return false;}
  function feed(id){advance();if(id!==7&&!awake())return false;if(action==='eat'){say('等这一口吃完哦。');return false;}if(![0,1,2,7].includes(id))return false;if(state.inventory[id]<1){say('已经吃完啦，可以去小铺补充。');return false;}if(id!==7&&state.food>94){say('小肚子已经饱饱的，留给下一餐吧。');return false;}if(id===7&&state.health>=99){say('她很健康，这瓶药先收好。');return false;}state.inventory[id]--;if(id===7){state.health=clamp(state.health+30);}else{state.food=clamp(state.food+items[id].food);state.health=clamp(state.health+2);state.mood=clamp(state.mood+3);}action='eat';actionUntil=performance.now()+1500;feedFx={id,start:performance.now()};const m=dollMetrics();burst(m.x,m.y+m.h*.24,'heart',5);tone('eat');say(id===7?'好一点啦，接下来好好休息。':'啊呜… '+items[id].name+'，好喜欢 ♡');if(id!==7)reward('breakfast',12);log(id===7?'使用健康药水，健康恢复了。':'享用了'+items[id].name+'，小肚子暖暖的。');selected=null;renderTray();vitals();return true;}
  function poke(){if(!awake())return;const t=Date.now();pokeCount=t-lastPoke<1500?pokeCount+1:1;lastPoke=t;action='poke';actionUntil=performance.now()+650;reactX=pokeCount>=3?-5:0;blinkUntil=performance.now()+450;const m=dollMetrics();burst(m.x+(Math.random()-.5)*25,m.y+m.h*.22);if(pokeCount>=3)say('脸颊都被你戳软啦，摸摸头好不好？');else say(['欸？被你发现了 ♡','有一点点痒！','再靠近一点点嘛。'][Math.floor(Math.random()*3)]);if(t-gestureRewardAt>1200){state.mood=clamp(state.mood+2);gestureRewardAt=t;vitals();save();}tone();}
  function pet(){if(!awake())return;action='pet';actionUntil=performance.now()+1700;state.mood=clamp(state.mood+5);const m=dollMetrics();burst(m.x,m.y+12,'heart',10);say('嗯… 就这样摸摸头，好舒服。');reward('pet',8);vitals();log('摸了摸头，她开心地眯起眼睛。');tone();}
  function sleepToggle(){advance();cancelCare(false);cancelPointers();setMirror(false,true);selected=null;closeDrawer();state.room=0;ball=null;if(state.sleeping){if(state.health<25){say('健康恢复到 25% 就能起床；可以点药水，或继续关灯休息。',5000);return;}state.sleeping=false;state.lightsOff=false;say('睡醒啦，伸个懒腰，再陪我玩一会儿。');log('睡醒后，又是暖暖的一天。');}else{state.sleeping=true;state.lightsOff=true;say('已经盖好被子，灯也暗下来啦。',4500);log('上床后自动关灯，安心休息。');reward('rest',10);}renderRooms();renderTray();vitals();decorate();save();}
  function changeRoom(id,automatic=false){advance();cancelPointers();if(!automatic)cancelCare(false);if(state.sleeping&&id!==0){say('先叫醒她，再去其他房间。');return false;}closeDrawer();setMirror(false,true);state.room=id;selected=null;ball=null;wash=0;$('#wash-progress').hidden=true;renderRooms();renderTray();save();if(!automatic)say(['回到小屋，放松一下吧。','把食物拖到我的嘴边吧 ♡','拿起香皂，在身上轻轻擦一擦。'][id]);return true;}
  function renderRooms(){$('#mirror-hotspot').hidden=state.room!==2||mirrorMode||drawer!=='';$('#mirror-back').hidden=!mirrorMode;document.body.classList.toggle('mirror-open',mirrorMode);document.querySelectorAll('[data-room]').forEach(b=>b.classList.toggle('selected',+b.dataset.room===state.room));$('#room-name').textContent='0'+(state.room+1)+' / '+roomNames[state.room];$('#immersive-backdrop').style.backgroundImage=state.room===0?'url(assets/bedroom.png)':'url(assets/rooms.png)';}
  function makeItem(id){const b=document.createElement('button');b.className='item'+(selected===id?' selected':'');b.dataset.tool=id;b.setAttribute('aria-label',items[id].name);b.append(itemCanvas(id),document.createTextNode(items[id].name));if([0,1,2,7].includes(id)){const n=document.createElement('small');n.textContent='×'+state.inventory[id];b.append(n);b.disabled=state.inventory[id]<1;}b.addEventListener('pointerdown',e=>startToolDrag(e,id,b));b.addEventListener('click',()=>{if(b.dataset.dragged==='1'){b.dataset.dragged='0';return;}selectTool(id);});return b;}
  function renderTray(){
    const tray=$('#tray');tray.replaceChildren();
    const ids=mirrorMode?[9,10,8]:state.room===1?[0,1,2,7]:state.room===2?[3,4]:state.sleeping?[7]:[4,5,11];
    for(const id of ids)tray.append(makeItem(id));
    if(state.room===0){const b=document.createElement('button');b.className='item wide';b.append(iconCanvas(12),document.createTextNode(state.sleeping?'轻轻叫醒':'上床睡觉'));b.id='sleep';b.onclick=sleepToggle;tray.append(b);}
    if(state.room===2&&!mirrorMode){const b=document.createElement('button');b.className='item wide';b.append(iconCanvas(14),document.createTextNode('冲掉泡泡'));b.id='rinse';b.onclick=rinse;tray.append(b);}
  }
  function selectTool(id){advance();if(mirrorMode&&[8,9,10].includes(id)){if(!awake())return;cancelCare(false);selected=selected===id?null:id;renderTray();say(id===9?'拿牙刷在嘴边左右轻刷，进度满就刷好啦。':id===10?'把洗面奶在两颊轻轻打圈，再用毛巾洗干净。':'拿毛巾擦过脸颊，洗掉泡泡。');return;}if(id===7&&state.sleeping){feed(7);return;}if(!awake())return;cancelCare(false);selected=selected===id?null:id;if(id===5){ball={x:W*.77,y:H*.81,vx:-.12,vy:-.1};say('拖动皮球再松开，看看她能不能接住！');}else if(id===11)say('把小熊拖到她怀里，或选中后点她的身体。');else say(id===3?'按住香皂，在少女身上来回擦出泡泡。':id===4?'拿着梳子，从头顶轻轻向下梳。':'把'+items[id].name+'拖到嘴边，也可以选中后点她的脸。');renderTray();}
  function point(e){const r=world.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  function inFace(p){if(mirrorMode){const m=mirrorMetrics();return Math.abs(p.x-m.x)<45*m.s&&p.y>m.iy+47*m.s&&p.y<m.iy+116*m.s;}if(state.sleeping&&!drawer)return Math.abs(p.x-W*.72)<W*.20&&p.y>H*.36&&p.y<H*.65;const m=dollMetrics();return Math.abs(p.x-m.x)<m.h*.17&&p.y>m.y&&p.y<m.y+m.h*.29;}
  function inGirl(p){if(mirrorMode)return inFace(p);const m=dollMetrics();return Math.abs(p.x-m.x)<m.w*.51&&p.y>=m.y&&p.y<=m.y+m.h;}
  function inBody(p){const m=dollMetrics();return Math.abs(p.x-m.x)<m.w*.50&&p.y>m.y+m.h*.16&&p.y<m.y+m.h*.87;}
  function stroke(p,prev,tool){if(mirrorMode){groomStroke(p,prev,tool);return;}const distance=Math.hypot(p.x-prev.x,p.y-prev.y);if(distance<3)return;if(tool===3&&state.room===2&&inBody(p)){wash=clamp(wash+Math.min(distance,25)*.22);burst(p.x,p.y,'bubble',2);$('#wash-progress').hidden=false;$('#wash-meter').value=wash;action='wash';actionUntil=performance.now()+400;if(wash>=100)say('泡泡已经够啦，点“冲掉泡泡”吧。');}if(tool===4&&inFace(p)){brush+=Math.min(distance,25);burst(p.x,p.y,'star',1);if(brush>140){brush=0;state.mood=clamp(state.mood+4);action='pet';actionUntil=performance.now()+1200;say('头发变得顺顺的，好舒服 ♡');vitals();save();}}}
  function rinse(){if(!awake())return;if(wash<25){say('先用香皂擦出一些泡泡，再冲洗哦。');return;}state.clean=clamp(state.clean+wash*.7);state.health=clamp(state.health+wash*.035);state.mood=clamp(state.mood+5);particles=particles.filter(p=>p.kind!=='bubble');wash=0;$('#wash-progress').hidden=true;selected=null;action='wash';actionUntil=performance.now()+1400;const m=dollMetrics();burst(m.x,m.y+m.h*.40,'star',12);say('香香软软的，洗好啦！');reward('bath',12);log('洗掉了泡泡，今天也是香香的。');renderTray();vitals();tone();}
  function startToolDrag(e,id,button){if(e.button!==0||button.disabled)return;advance();if(id!==7&&!awake())return;cancelCare(false);const ghost=itemCanvas(id,144);ghost.className='floating-prop';ghost.hidden=true;document.body.append(ghost);drag={id,button,ghost,pointer:e.pointerId,start:{x:e.clientX,y:e.clientY},prev:point(e),moved:false};button.setPointerCapture(e.pointerId);}
  document.addEventListener('pointermove',e=>{const p=point(e);if(drag&&drag.pointer===e.pointerId){if(Math.hypot(e.clientX-drag.start.x,e.clientY-drag.start.y)>5)drag.moved=true;if(drag.moved){drag.ghost.hidden=false;drag.ghost.style.left=(e.clientX-36)+'px';drag.ghost.style.top=(e.clientY-45)+'px';stroke(p,drag.prev,drag.id);}drag.prev=p;e.preventDefault();return;}if(press&&press.pointer===e.pointerId){const d=Math.hypot(p.x-press.start.x,p.y-press.start.y);press.distance=Math.max(press.distance,d);if(press.ball&&ball){ball.vx=(p.x-ball.x)/32;ball.vy=(p.y-ball.y)/32;ball.x=clamp(p.x,22,W-22);ball.y=clamp(p.y,190,H-25);ball.held=true;}else if(selected===3||selected===4||(mirrorMode&&[8,9,10].includes(selected))){stroke(p,press.prev,selected);}press.prev=p;}gaze={x:clamp((p.x-W/2)/W,-.5,.5),y:clamp(p.y/H,0,1)};},{passive:false});
  function endDrag(e,cancelled=false){if(drag&&drag.pointer===e.pointerId){const d=drag;drag=null;d.ghost.remove();d.button.dataset.dragged=d.moved?'1':'0';if(!cancelled&&d.moved){const p=point(e);if([0,1,2,7].includes(d.id)){if(inFace(p))feed(d.id);else say('再靠近嘴边一点点，就能吃到啦。');}else if(d.id===11){if(inBody(p))hugTeddy();else say('把小熊再递近怀里一点。');}else if(d.id===5){ball={x:clamp(p.x,25,W-25),y:clamp(p.y,190,H-25),vx:.1,vy:-.25};}else{selected=d.id;renderTray();}}}if(press&&press.pointer===e.pointerId){const p=press;press=null;clearTimeout(p.timer);if(ball)ball.held=false;if(cancelled||p.ball)return;const end=point(e);if(p.held)return;if(p.distance>55&&!inFace(p.start)&&selected===null){changeRoom((state.room+(end.x<p.start.x?1:2))%3);return;}if(p.distance>16)return;if(selected!==null&&[0,1,2,7].includes(selected)&&inFace(end)){feed(selected);return;}if(selected===11&&inBody(end)){hugTeddy();return;}if(selected===3||selected===4||(mirrorMode&&[8,9,10].includes(selected)))return;if(inGirl(end))poke();}}
  document.addEventListener('pointerup',e=>endDrag(e));document.addEventListener('pointercancel',e=>endDrag(e,true));
  canvas.addEventListener('pointerdown',e=>{if(!ready||e.button!==0||drawer)return;cancelCare(false);const p=point(e);if(selected===null&&inGirl(p))window.RoseDollSound?.tap();press={pointer:e.pointerId,start:p,prev:p,distance:0,held:false,ball:ball&&Math.hypot(p.x-ball.x,p.y-ball.y)<40};if(press.ball)ball.held=true;canvas.setPointerCapture(e.pointerId);if(selected===null&&inFace(p)&&!press.ball){const ref=press;ref.timer=setTimeout(()=>{if(press===ref&&press.distance<24){press.held=true;pet();}},650);}});
  function thumb(opts={},part='sets'){const c=document.createElement('canvas');c.width=180;c.height=220;const g=c.getContext('2d');if(part==='hair'){g.save();g.translate(-50,-8);drawDoll(g,140,4,600,{...opts,still:true,closed:opts.closed??false});g.restore();}else if(part==='feet'){drawDoll(g,90,-275,490,{...opts,still:true,closed:opts.closed??false});}else if(part==='top'){drawDoll(g,90,-35,405,{...opts,still:true,closed:opts.closed??false});}else if(part==='skirt'){drawDoll(g,90,-155,420,{...opts,still:true,closed:opts.closed??false});}else drawDoll(g,90,0,218,{...opts,still:true,closed:opts.closed??false});return c;}
  function card(label,sub,graphic,active,onClick){const b=document.createElement('button');b.className='card'+(active?' active':'');b.append(graphic);const text=document.createElement('span');text.textContent=label;b.append(text);if(sub){const small=document.createElement('small');small.textContent=sub;b.append(small);}if(active){const tag=document.createElement('span');tag.className='tag';tag.textContent='穿着';b.append(tag);}b.onclick=onClick;return b;}

  function openPanel(name){if(!ready)return;advance();setMirror(false,true);cancelCare(false);cancelPointers();ball=null;selected=null;drawer=name;document.body.classList.add('drawer-open');tab=name==='vanity'?'hair':'sets';$('#drawer').hidden=false;renderPanel();document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));}
  function closeDrawer(){drawer='';document.body.classList.remove('drawer-open');$('#drawer').hidden=true;document.querySelectorAll('[data-panel]').forEach(b=>b.classList.remove('active'));}

  function renderPanel(){const content=$('#drawer-content');content.replaceChildren();const titles={wardrobe:['MY LITTLE WARDROBE','今天穿什么'],vanity:['A LITTLE BEAUTY RITUAL','坐到梳妆台前'],shop:['THE STRAWBERRY SHOP','小屋补给铺'],album:['COLLECT THE LITTLE DAYS','把今天收藏起来'],music:['MUSIC FROM YOUR LIBRARY','小屋音乐'],help:['HOW TO PLAY','和她玩一会儿']};const [kick,title]=titles[drawer]||titles.help;$('#drawer-kicker').textContent=kick;$('#drawer-title').textContent=title;
    if(drawer==='wardrobe'||drawer==='vanity'){
      const p=document.createElement('p');p.className='panel-copy';p.textContent='当前有两套完整穿搭。由情侣空间绑定角色提前挑选，每天早上8点换上；网页关闭时下次打开补上。发型与发饰保持成套，后续再扩充。';content.append(p,thumb({still:true,closed:false}));
    }else if(drawer==='shop'){const p=document.createElement('p');p.className='panel-copy';p.textContent='使用试玩星星币，照顾和玩耍可获得每日奖励。';content.append(p);const list=document.createElement('div');list.className='cards shop-cards';[0,1,2,7].forEach(i=>list.append(card(items[i].name,i===6&&state.bowOwned?'已经拥有':'✧ '+items[i].price,itemCanvas(i,120),false,()=>buy(i))));content.append(list);const basic=document.createElement('button');basic.id='basic-meal';basic.className='accessory-clear';basic.textContent='领取基础餐 · 免费';basic.onclick=basicMeal;content.append(basic);
    }else if(drawer==='album'){const p=document.createElement('p');p.className='panel-copy';p.textContent='点房间右侧相机，保存穿搭。最多留住最近六张。';content.append(p);const grid=document.createElement('div');grid.className='album-grid';for(const photo of [...state.photos].reverse()){const el=document.createElement('div');el.className='photo-card';const im=document.createElement('img');im.src=photo.image;im.alt='保存的少女穿搭';const t=document.createElement('span');t.textContent=photo.label;el.append(im,t);grid.append(el);}if(!state.photos.length){p.textContent='还没有照片，关掉面板，拍下第一套喜欢的穿搭吧。';}content.append(grid);
    }else if(drawer==='music'){window.RoseDollMusic.mount(content);
    }else{const el=document.createElement('div');el.className='instructions';el.innerHTML='<p><b>像素少女</b>：情侣空间绑定角色负责照顾。点让他照顾，真实请求一次角色安排；格式不对不自动重试。关闭页面会停止动作。</p><p><b>戳脸 / 摸头</b>：轻点脸颊，或按住头部片刻；反应和心情变化会直接发生。</p><p><b>餐桌</b>：拖食物到嘴边，或选中后点脸；每次只吃一份。食物全用完且没吃饱时，可在小铺免费领取基础餐。</p><p><b>浴室</b>：拖香皂在身上擦出泡泡，再点冲洗；梳子拖过头发可以梳头。点击墙上镜子放大小脸，选牙刷在嘴边左右刷；洗面奶在两颊打圈，再拖毛巾洗掉泡泡。</p><p><b>卧室</b>：选皮球，拖起再松手，碰到她会接球；上床自动关灯，醒来自动开灯；睡眠恢复精神与健康。小熊可以拖到怀里抱一抱。</p><p><b>健康护理</b>：健康降到 20% 会回床休息。睡着也能点床边药水用药，恢复至 25% 可叫醒。不买药也能通过关灯休息恢复。</p><p><b>四个状态</b>：点击查看百分比。饱腹越高表示越饱；精神越高表示越有精力。退出后的变化最多结算八小时，重复打开不重复扣减。</p><p><b>音乐</b>：使用原音乐软件的歌单。独立预览地址请打开原音乐软件导出的歌单文件。</p><p><b>让他照顾</b>：可见鼠标随机操作喂食、洗澡、梳头、刷牙洗脸、皮球、小熊和戳脸摸头。优先照顾饥饿与疲倦，可随时停止。照顾动作由绑定角色选择，细节和食物随机；不会自动购买道具。</p><p><b>进度</b>：自动保存在当前浏览器；存储失败会显示提示。角色提前选好七天穿搭，每天当地时间8点生效，关闭网页后下次进入补上。</p>' ;content.append(el);}
  }
  function basicMeal(){
    advance();if(state.food>=50){say('还没饿，先把下一餐留好。');return;}
    if([0,1,2].some(i=>state.inventory[i]>0)){say('家里还有食物，先用现有的食物吧。');return;}
    state.inventory[0]=1;save();renderTray();say('基础餐已放好：一份草莓吐司。',4500);
  }
  function buy(id){advance();if(![0,1,2,7].includes(id))return;const item=items[id];if(id===6&&state.bowOwned){say('这只发卡已经在梳妆台里啦。');return;}if(id!==6&&state.inventory[id]>=99){say('已经存了很多，先用掉一些吧。');return;}if(state.coins<item.price){say('星星币不够了，照顾和玩耍能得到每日奖励。');return;}state.coins-=item.price;if(id===6)state.bowOwned=true;else state.inventory[id]++;save();vitals();renderPanel();renderTray();say(item.name+'已经放进小屋啦。');tone();}
  function takePhoto(){if(!ready)return;advance();closeDrawer();const photo=document.createElement('canvas');photo.width=300;photo.height=Math.round(300*H/W);const g=photo.getContext('2d');g.drawImage(canvas,0,0,photo.width,photo.height);state.photos.push({image:photo.toDataURL('image/jpeg',.78),label:new Date().toLocaleDateString('zh-CN')+' · '+outfitNames[state.look===1?1:0]});state.photos=state.photos.slice(-6);save();$('#flash').classList.remove('on');void $('#flash').offsetWidth;$('#flash').classList.add('on');say('咔嚓，今天的可爱存进相册了。');log('收藏了一张小屋生活照。');tone();}
  function cancelCare(tell=true){if(careDriving)return;careToken++;if(ball)ball.held=false;$('#care-cursor').hidden=true;$('#care-held').replaceChildren();$('#care-cursor').classList.remove('pressed');if(careActive){careActive=false;$('#care-progress').hidden=true;$('#care').classList.remove('active');if(tell)say('让他照顾已停下，你可以接着陪她玩。');}}
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function mirrorMetrics(){const w=W*.82,h=Math.min(H*.62,W*1.14),s=w/180,top=H*.12;return{x:W/2,w,h,s,top,iy:top+h*.10,mouth:top+h*.10+98*s};}
  function drawMirror(){
    const m=mirrorMetrics();ctx.fillStyle='#f1e7daaa';ctx.fillRect(0,0,W,H);
    ctx.save();ctx.beginPath();ctx.ellipse(m.x,m.top+m.h/2,m.w/2,m.h/2,0,0,Math.PI*2);ctx.fillStyle='#f6eee1';ctx.fill();ctx.lineWidth=11;ctx.strokeStyle='#b89660';ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#f5dfac';ctx.stroke();ctx.clip();
    drawDoll(ctx,m.x,m.iy,512*m.s,{still:true,closed:now<blinkUntil||action==='wash'});
    if(faceFoam>0){for(let i=0;i<12;i++){const side=i%2?1:-1;const x=m.x+side*(23+i%3*6)*m.s,y=m.iy+(86+Math.floor(i/3)*5)*m.s;ctx.fillStyle='#fff9f0cc';ctx.beginPath();ctx.arc(x,y,(3+faceFoam*.045)*m.s,0,Math.PI*2);ctx.fill();}}
    ctx.restore();
  }
  function setMirror(open,automatic=false){
    if(open&&(state.room!==2||!awake()))return false;
    if(!automatic)cancelCare(false);cancelPointers();selected=null;ball=null;
    mirrorMode=open;teethProgress=0;faceFoam=0;faceReady=false;$('#groom-progress').hidden=true;
    if(ready){renderRooms();renderTray();}if(open)say('照照镜子：选牙刷轻刷嘴边，或洗面奶打圈洗脸。',5000);return true;
  }
  function groomingProgress(label,value){$('#groom-progress').hidden=false;$('#groom-label').textContent=label;$('#groom-meter').value=value;}
  function groomStroke(p,prev,tool){
    const distance=Math.min(24,Math.hypot(p.x-prev.x,p.y-prev.y));if(distance<3||!inFace(p))return;
    const m=mirrorMetrics();
    if(tool===9&&Math.abs(p.y-m.mouth)<17*m.s&&teethProgress<100){teethProgress=clamp(teethProgress+distance*.38);groomingProgress('刷牙',teethProgress);burst(p.x,p.y,'star',1);if(teethProgress>=100){state.health=clamp(state.health+1);state.mood=clamp(state.mood+3);reward('teeth',5);log('对着镜子刷好了牙。');vitals();say('牙齿刷好啦，亮晶晶的。');}}
    if(tool===10){faceFoam=clamp(faceFoam+distance*.42);if(faceFoam>=25)faceReady=true;groomingProgress('洁面泡泡',faceFoam);action='wash';actionUntil=performance.now()+350;}
    if(tool===8){if(faceFoam===0)return;faceFoam=clamp(faceFoam-distance*.65);groomingProgress('洗掉泡泡',100-faceFoam);action='wash';actionUntil=performance.now()+700;if(faceFoam===0&&faceReady){faceReady=false;state.clean=clamp(state.clean+10);state.health=clamp(state.health+1);state.mood=clamp(state.mood+3);reward('face',5);log('用洗面奶和毛巾洗好了脸。');vitals();say('小脸洗干净啦，清清爽爽。');}}
  }
  function hugTeddy(){if(!awake())return false;selected=null;teddyUntil=performance.now()+3500;action='hug';actionUntil=teddyUntil;state.mood=clamp(state.mood+5);const m=dollMetrics();burst(m.x,m.y+m.h*.4);reward('teddy',6);log('抱着小熊轻轻晃了晃。');renderTray();vitals();say('抱紧小熊，轻轻摇一摇。');return true;}
  async function care(){
    if(!ready||!hostLive)return;if(careActive){cancelCare();return;}if(!awake())return;
    closeDrawer();cancelPointers();setMirror(false,true);selected=null;ball=null;
    careActive=true;const token=++careToken,cursor=$('#care-cursor'),held=$('#care-held');
    $('#care-progress').hidden=false;$('#care').classList.add('active');cursor.hidden=false;
    const valid=()=>careActive&&token===careToken&&!document.hidden;
    const pause=async ms=>{await wait(ms);return valid();};
    const drive=fn=>{careDriving=true;try{return fn();}finally{careDriving=false;}};
    const step=text=>{$('#care-text').textContent='让他照顾 · '+text;};
    const position=(x,y)=>{careCursor={x,y};cursor.style.left=x+'px';cursor.style.top=y+'px';};
    const center=selector=>{const e=$(selector),r=e?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:careCursor;};
    const worldPoint=p=>{const r=world.getBoundingClientRect();return{x:r.left+p.x,y:r.top+p.y};};
    const move=async(p,ms=420+Math.random()*300,onMove)=>{const from={...careCursor},start=performance.now();while(valid()){const t=clamp((performance.now()-start)/ms,0,1),ease=t*t*(3-2*t);const next={x:from.x+(p.x-from.x)*ease,y:from.y+(p.y-from.y)*ease};const prev={...careCursor};position(next.x,next.y);if(onMove){const r=world.getBoundingClientRect();onMove({x:next.x-r.left,y:next.y-r.top},{x:prev.x-r.left,y:prev.y-r.top});}if(t>=1)return true;await wait(24);}return false;};
    const click=async(selector,fn)=>{if(!await move(center(selector)))return false;cursor.classList.add('pressed');if(!await pause(180))return false;drive(fn);cursor.classList.remove('pressed');return pause(220);};
    const pick=async(id)=>{if(!await move(center('[data-tool="'+id+'"]')))return false;held.replaceChildren(itemCanvas(id,100));cursor.classList.add('pressed');return pause(180);};
    const drop=()=>{held.replaceChildren();cursor.classList.remove('pressed');};
    const room=async id=>{while(state.room!==id){if(!await click('#next-room',()=>changeRoom((state.room+1)%3,true)))return false;}return true;};
    const strokes=async(id,points)=>{for(const p of points){if(!await move(worldPoint(p),150,(next,prev)=>drive(()=>stroke(next,prev,id))))return false;}return true;};
    position(center('#care').x,center('#care').y);
    try{
      step('正在请他安排这次照顾');const chosen=await window.PixelHomeBridge.request('care',state);if(!valid())return;advance();const plan=window.RoseCarePolicy.plan(state,chosen.actions);
      const completed=[];
      for(const task of plan){
        if(!valid()||state.sleeping)break;
        await pause(150+Math.random()*450);if(!valid())return;
        document.dispatchEvent(new CustomEvent('rose-doll:care-step',{detail:task}));
        if(task==='feed'){
          const food=window.RoseCarePolicy.food(state);if(food===undefined)continue;
          step('挑一份喜欢的食物');if(!await room(1)||!await pick(food))return;
          const m=dollMetrics();if(!await move(worldPoint({x:m.x,y:m.y+m.h*.20}),700+Math.random()*350))return;
          if(drive(()=>feed(food)))completed.push(items[food].name);drop();if(!await pause(1650))return;
        }else if(task==='bath'){
          step('洗个香香的澡');if(!await room(2)||!await pick(3))return;let m=dollMetrics();
          if(!await strokes(3,Array.from({length:20},(_,i)=>({x:m.x+(i%2?32:-32),y:m.y+m.h*(.36+(i%3)*.08)}))))return;drop();
          if(!await click('#rinse',rinse))return;completed.push('洗澡');
        }else if(task==='comb'){
          step('轻轻梳顺头发');if(!await room(0)||!await pick(4))return;const m=dollMetrics();
          if(!await strokes(4,Array.from({length:10},(_,i)=>({x:m.x+(i%2?15:-15),y:m.y+m.h*(i%2?.22:.04)}))))return;drop();completed.push('梳头');
        }else if(task==='teeth'||task==='face'){
          step(task==='teeth'?'照着镜子刷牙':'洗洗小脸');if(!await room(2)||!await click('#mirror-hotspot',()=>setMirror(true,true)))return;
          const f=mirrorMetrics();
          if(task==='teeth'){
            if(!await pick(9)||!await strokes(9,Array.from({length:18},(_,i)=>({x:f.x+(i%2?24:-24)*f.s,y:f.mouth}))))return;drop();completed.push('刷牙');
          }else{
            if(!await pick(10)||!await strokes(10,Array.from({length:14},(_,i)=>({x:f.x+Math.sin(i)*30*f.s,y:f.iy+(91+Math.cos(i)*12)*f.s}))))return;drop();
            if(!await pick(8)||!await strokes(8,Array.from({length:16},(_,i)=>({x:f.x+(i%2?30:-30)*f.s,y:f.iy+98*f.s}))))return;drop();completed.push('洗脸');
          }
          if(!await click('#mirror-back',()=>setMirror(false,true)))return;
        }else if(task==='teddy'){
          step('把小熊抱过来');if(!await room(0)||!await pick(11))return;const m=dollMetrics();
          if(!await move(worldPoint({x:m.x,y:m.y+m.h*.45}),800))return;drive(hugTeddy);drop();if(!await pause(1300))return;completed.push('抱小熊');
        }else if(task==='ball'){
          if(state.energy<20)continue;step('一起接皮球');if(!await room(0)||!await click('[data-tool="5"]',()=>selectTool(5)))return;
          selected=null;renderTray();
          for(let i=0;i<2+Math.floor(Math.random()*2);i++){
            if(!ball||!valid())break;
            if(!await move(worldPoint(ball)))return;
            ball.held=true;cursor.classList.add('pressed');const m=dollMetrics();
            const target={x:m.x+(i%2?-1:1)*m.w*.30,y:m.y+m.h*.38};
            if(!await move(worldPoint(target),650,(pt)=>{if(ball){ball.x=pt.x;ball.y=pt.y;}}))return;
            if(ball){ball.held=false;ball.vx=(m.x-ball.x)/350;ball.vy=-.02;}
            cursor.classList.remove('pressed');if(!await pause(1700+Math.random()*400))return;
          }
          ball=null;completed.push('玩皮球');
        }else if(task==='touch'){
          step('戳戳脸，再摸摸头');const m=dollMetrics();drop();
          for(let i=0,n=1+Math.floor(Math.random()*3);i<n;i++){
            if(!await move(worldPoint({x:m.x+(Math.random()-.5)*m.w*.24,y:m.y+m.h*.19})))return;
            cursor.classList.add('pressed');if(!await pause(100))return;drive(poke);window.RoseDollSound?.tap();cursor.classList.remove('pressed');if(!await pause(750+Math.random()*600))return;
          }
          if(!await move(worldPoint({x:m.x,y:m.y+m.h*.08})))return;cursor.classList.add('pressed');if(!await pause(600))return;drive(pet);cursor.classList.remove('pressed');if(!await pause(800))return;completed.push('戳脸摸头');
        }else if(task==='sleep'){
          if(state.energy>=30)continue;step('盖好被子，安心睡');if(!await room(0)||!await click('#sleep',sleepToggle))return;completed.push('上床休息');
        }
      }
      if(!valid())return;log('这次照顾：'+completed.join('、')+'。');say('陪伴结束，接下来交给你。',4500);
    }catch(e){if(valid())say(e.message,7000);}finally{if(token===careToken){careActive=false;$('#care-progress').hidden=true;$('#care').classList.remove('active');cursor.hidden=true;drop();}}
  }
  function cancelPointers(){if(drag){drag.ghost.remove();drag=null;}if(press)clearTimeout(press.timer);press=null;if(ball)ball.held=false;}
  $('#mirror-hotspot').onclick=()=>setMirror(true);$('#mirror-back').onclick=()=>setMirror(false);
  $('#previous-room').onclick=()=>changeRoom((state.room+2)%3);$('#next-room').onclick=()=>changeRoom((state.room+1)%3);$('#close-drawer').onclick=closeDrawer;document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>drawer===b.dataset.panel?closeDrawer():openPanel(b.dataset.panel));document.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>changeRoom(+b.dataset.room));$('#photo').onclick=takePhoto;$('#shop-short').onclick=()=>openPanel('shop');$('#help').onclick=()=>openPanel('help');$('#sound').onclick=()=>openPanel('music');$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{openPanel('help');}decorate();};$('#care').onclick=care;$('#cancel-care').onclick=()=>cancelCare();document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDrawer();cancelCare();setMirror(false,true);selected=null;renderTray();}});
  let lastMorningError='';
  function applyMorning(info){if(!info)return;if(info.look===0||info.look===1){if(state.look!==info.look){state.look=info.look;save();}if(drawer==='wardrobe')renderPanel();}if(info.error&&info.error!==lastMorningError)say('今天的穿搭安排未更新，保留现有衣服。可点让他照顾再试。',6500);lastMorningError=info.error||'';}
  document.addEventListener('pixel-home:morning',e=>applyMorning(e.detail));
  document.addEventListener('pixel-home:invalid',()=>{hostLive=false;cancelCare(false);cancelPointers();cancelAnimationFrame(raf);document.getElementById('game').inert=true;const overlay=document.createElement('div');overlay.className='loading';overlay.textContent='情侣绑定或账号已改变，请返回游戏大厅重新进入。';document.body.append(overlay);});
  $('#exit-home').onclick=async()=>{cancelCare(false);save();await lastSave;window.PixelHomeBridge.request('exit').catch(e=>say(e.message));};
  setInterval(()=>{if(ready&&hostLive&&!document.hidden)window.PixelHomeBridge.request('morning').then(applyMorning).catch(()=>{});},30000);
  function suspend(){cancelCare(false);cancelPointers();setMirror(false,true);cancelAnimationFrame(raf);raf=0;advance();}
  function resume(){if(!ready||document.hidden||!hostLive)return;advance();renderRooms();renderTray();vitals();decorate();lastFrame=performance.now();if(!raf)raf=requestAnimationFrame(draw);}
  document.addEventListener('fullscreenchange',()=>{if(ready)decorate();});
  document.addEventListener('visibilitychange',()=>document.hidden?suspend():resume());
  window.addEventListener('pagehide',suspend);
  window.addEventListener('pageshow',resume);
  $('#save-warning').onclick=()=>{if(save())say('进度已经重新保存。');};
  new ResizeObserver(resize).observe(world);
  setInterval(()=>{if(!ready||document.hidden||!hostLive)return;advance();vitals();},15000);
  async function boot(){try{await Promise.all(Object.entries({bedroom:'bedroom.png',rooms:'rooms.png',props:'props.png',icons:'icons.png',longEspresso:'doll-long-espresso.png',sleepAll:'sleep-all.png',toothbrush:'toothbrush-p07.png',cleanser:'cleanser-p07.png',teddy:'teddy-p07.png'}).map(async([key,name])=>{const im=new Image();im.src='assets/'+name;await im.decode();ASSETS[key]=im;}));advance();resize();ready=true;$('#loading').remove();$('#today').textContent=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long'}).toUpperCase()+' / LITTLE HOME';renderRooms();renderTray();vitals();decorate();renderDiary();if(!state.diary.length)log('小屋开门啦，第一套草莓奶油装准备好了。');raf=requestAnimationFrame(draw);say(state.sleeping?'正在休息，床边药水可护理；关灯也能恢复健康。':'小屋开门啦：戳脸、摸头，或去餐桌喂一口。',5500);}catch(error){$('#loading').textContent='素材暂时没打开，刷新页面再试一次。';console.error(error);}}
  boot();
})();
