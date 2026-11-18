function phInvMountAll(){const box=$('#smsbody');if(!box)return;
  box.querySelectorAll('.imsg-b.iminv').forEach(phInvMount);}
function phInvSize(node,st){
  const w=Math.max(1,Math.round(node.clientWidth)),h=Math.max(1,Math.round(node.clientHeight)),
    dpr=Math.min(3,Math.max(1,window.devicePixelRatio||1));
  if(st.w===w&&st.h===h)return false;
  st.w=w;st.h=h;st.dpr=dpr;
  st.cv.width=st.rv.width=Math.round(w*dpr);st.cv.height=st.rv.height=Math.round(h*dpr);
  st.grid=new Uint8Array(st.cols*st.rows);st.hit=0;
  return true;}
const PH_INV_BRUSH=13;
function phInvScratch(node,x,y){const st=_phInv.get(node);if(!st||st.done)return;
  const dpr=st.dpr||1,g=st.rv.getContext('2d'),r=PH_INV_BRUSH*dpr;
  const cx=x*dpr,cy=y*dpr,grd=g.createRadialGradient(cx,cy,0,cx,cy,r);
  grd.addColorStop(0,'rgba(0,0,0,1)');grd.addColorStop(.62,'rgba(0,0,0,.95)');grd.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=grd;g.beginPath();g.arc(cx,cy,r,0,7);g.fill();
  /* 进度要按「真的被擦掉多大一片」算：笔刷半径内的格子都算上。
     只记手指中心那一格的话，一条横线永远凑不满，她得来回抠很多遍。 */
  if(st.grid){const cw=st.w/st.cols,chh=st.h/st.rows,R=PH_INV_BRUSH*.82;
    const c0=Math.max(0,Math.floor((x-R)/cw)),c1=Math.min(st.cols-1,Math.floor((x+R)/cw)),
      r0=Math.max(0,Math.floor((y-R)/chh)),r1=Math.min(st.rows-1,Math.floor((y+R)/chh));
    for(let rw=r0;rw<=r1;rw++)for(let c=c0;c<=c1;c++){
      const dx=(c+.5)*cw-x,dy=(rw+.5)*chh-y;if(dx*dx+dy*dy>R*R)continue;
      const i=rw*st.cols+c;if(!st.grid[i]){st.grid[i]=1;st.hit++;}}
    if(st.hit/st.grid.length>=PH_INV_DONE)phInvFinish(node);}}
function phInvDrop(st){setTimeout(()=>{if(st&&st.cv&&st.cv.parentNode&&!st.down)st.cv.remove();},420);}
function phInvFinish(node){const st=_phInv.get(node);if(!st||st.done)return;st.done=true;
  st.cv.style.opacity='0';node.classList.add('shown');
  if(!st.down)phInvDrop(st);}
function phInvLoop(node){const st=_phInv.get(node);if(!st)return;
  const tick=()=>{st.raf=0;
    if(!node.isConnected||st.done||st.cv.parentNode!==node)return;
    phInvSize(node,st);
    const g=st.cv.getContext('2d'),W=st.cv.width,H=st.cv.height,dpr=st.dpr||1;
    g.clearRect(0,0,W,H);
    let s=st.seed,v;const n=Math.min(2600,Math.round(W*H/34));
    for(let i=0;i<n;i++){
      [s,v]=phInvRnd(s);const x=v*W;[s,v]=phInvRnd(s);const y=v*H;
      [s,v]=phInvRnd(s);const rr=(.45+v*1.15)*dpr;[s,v]=phInvRnd(s);const a=.22+v*.7;
      [s,v]=phInvRnd(s);const jx=(v-.5)*1.6*dpr;[s,v]=phInvRnd(s);const jy=(v-.5)*1.6*dpr;
      const ph=Math.sin((st.frame*.28)+i*.7);
      g.fillStyle='rgba('+(226+((i%3)*10))+','+(232+((i%5)*4))+',255,'+(a*(.6+.4*ph)).toFixed(3)+')';
      g.beginPath();g.arc(x+jx*ph,y+jy*ph,rr,0,7);g.fill();}
    g.globalCompositeOperation='destination-out';g.drawImage(st.rv,0,0);g.globalCompositeOperation='source-over';
    st.frame++;
    st.raf=setTimeout(()=>requestAnimationFrame(tick),62);};
  tick();}
/* 重播（或者角色重新发一条）要把沙子重新盖回去 */
function phInvReset(node){if(!node)return;const st=_phInv.get(node);
  if(st){st.done=false;if(st.cv.parentNode)st.cv.remove();_phInv.delete(node);}
  node.classList.remove('shown');phInvMount(node);}
function phScreenFx(kind,m){const stage=document.querySelector('.screen')||document.querySelector('.imsg');if(!stage)return;
  stage.querySelectorAll('.imsfx').forEach(x=>x.remove());
  const box=document.createElement('div');box.className='imsfx imsfx-'+kind;
  /* 每个特效都用一个算死的伪随机，这样同一条消息重播、换台设备看到的都一样 */
  let _s=(String(m&&m.id||kind).split('').reduce((a,c)=>(a*33+c.charCodeAt(0))&0x7fffffff,17))||7;
  const rnd=(a,b)=>{_s=(_s*1664525+1013904223)&0x7fffffff;return a+(_s/0x7fffffff)*(b-a);};
  const pick=arr=>arr[Math.floor(rnd(0,arr.length))%arr.length];
  const add=(css,html,cls)=>{const i=document.createElement('i');i.style.cssText=css;if(cls)i.className=cls;if(html!=null)i.innerHTML=html;box.appendChild(i);return i;};
  const WARM=['#ff5f8f','#ffd36b','#6ec8ff','#b58cff','#7ee2a8','#ffffff'];
  /* 飘多远、升多高都按这块屏幕的真实高度算。原来写的是 vh——那是【窗口】的高度，
     网页版的手机只占窗口的一小块，按 vh 算的话气球烟花一出手就飞到框外面去了，
     升空的过程一眼都看不见。她说烟花要「从屏幕底部升上去然后炸开」，就得按这个算。 */
  const SR=stage.getBoundingClientRect(),SH=Math.max(320,SR.height||640),SW=Math.max(240,SR.width||390);
  let life=2800;
  if(kind==='echo'){
    /* 照真机的 Echo 来：这条气泡复制出几十份，【从它自己的位置】炸出去铺满整屏，
       停一会儿，再一起收回那条气泡里消失。不绕圈、不旋涡。
       落点用低差异的黄金角铺开，所以铺得均匀又不像网格。 */
    const t=esc(String(m&&phFxRunsPlain(m.fx)||m&&m.text||'').slice(0,10))||'…';
    let ox=50,oy=52;
    try{const node=m&&m.id&&document.querySelector(`.imsg-b[data-mid="${m.id}"]`);
      if(node){const r=node.getBoundingClientRect();
        ox=Math.max(8,Math.min(92,(r.left+r.width/2-SR.left)/SW*100));
        oy=Math.max(8,Math.min(92,(r.top+r.height/2-SR.top)/SH*100));}}catch(_){}
    box.style.setProperty('--ox',ox.toFixed(1)+'%');
    box.style.setProperty('--oy',oy.toFixed(1)+'%');
    const N=38,cx=SW*ox/100,cy=SH*oy/100;
    for(let n=0;n<N;n++){
      const a=n*2.399963,             /* 黄金角，铺得开又不成行 */
        rad=Math.sqrt((n+.6)/N),
        /* 落点是先在【整块屏幕】上铺开，再换算成「从这条气泡出发要飞多远」。
           要是直接以气泡为中心撒点，气泡靠边的时候有一半会飞到屏幕外面，
           另外半边空着——实拍图里就是这样，左半屏一个都没有。 */
        tx=SW*.5+Math.cos(a)*rad*(SW*.52)+rnd(-12,12),
        ty=SH*.46+Math.sin(a)*rad*(SH*.44)+rnd(-14,14),
        px=tx-cx,py=ty-cy,
        sc=(1.06-rad*.42).toFixed(2),rot=rnd(-13,13).toFixed(0),
        dur=(2.9+rad*1.5).toFixed(2),d=(n*.035).toFixed(2);
      add(`--x:${px.toFixed(0)}px;--y:${py.toFixed(0)}px;--sc:${sc};--rot:${rot}deg;`
        +`opacity:0;animation-duration:${dur}s;animation-delay:${d}s`,
        `<b></b>`,n%2?'alt':'');
      box.lastChild.firstChild.innerHTML=t;}
    life=6000;}
  else if(kind==='balloons'){
    const cols=['#ff5f8f','#ffd36b','#6ec8ff','#b58cff','#7ee2a8','#ff9f6b'];
    for(let n=0;n<15;n++){const c=cols[n%cols.length],w=(21+rnd(0,15))|0;
      add(`left:${rnd(2,92).toFixed(1)}%;--w:${w}px;--h:${(w*1.28)|0}px;--c:${c};--sway:${rnd(12,34).toFixed(0)}px;--rise:${(SH+160).toFixed(0)}px;`
        +`animation-duration:${rnd(3.1,4.4).toFixed(2)}s;animation-delay:${rnd(0,1).toFixed(2)}s`,
        `<b></b><u></u>`);}
    life=4600;}
  else if(kind==='confetti'){
    /* 下落和扇动是两层，各转各的：外层匀速落（不会变速），里层扇（不会被压成线） */
    for(let n=0;n<78;n++){const c=WARM[n%WARM.length],shape=n%5===0?'ribbon':n%3===0?'dot':'bar';
      add(`left:${rnd(-4,104).toFixed(1)}%;--c:${c};--drop:${(SH+90).toFixed(0)}px;`
        +`--drift:${rnd(-70,70).toFixed(0)}px;--fl:${rnd(.62,1.35).toFixed(2)}s;`
        +`animation-duration:${rnd(2.4,3.9).toFixed(2)}s;animation-delay:${rnd(0,.9).toFixed(2)}s`,'<b></b>',shape);}
    life=4200;}
  else if(kind==='love'){
    /* 心是 CSS 画的，不是 ❤ 这个字——放到一百多像素还是干干净净，不会糊成马赛克 */
    /* i 匀速升、b 慢慢长大、u 左右摇——三个节奏分开，所以中途不会「停一下」 */
    /* 她说「爱心那个最大的不要了，改成满屏的小爱心升上去就可以」：
       中间那三颗心跳大爱心去掉，小爱心从 18 颗加到 40 颗铺满整屏。 */
    for(let n=0;n<40;n++)add(`left:${rnd(3,97).toFixed(1)}%;--sz:${rnd(13,30).toFixed(0)}px;`
      +`--sway:${rnd(9,26).toFixed(0)}px;--swd:${rnd(.9,1.7).toFixed(2)}s;--rise:${(SH+110).toFixed(0)}px;`
      +`animation-duration:${rnd(2.6,4.2).toFixed(2)}s;animation-delay:${rnd(0,1.8).toFixed(2)}s`,'<b><u></u></b>','up');
    life=4200;}
  else if(kind==='fireworks'){
    /* 她说「我要看到那种绽放的很漂亮的五彩的烟花」。所以每一朵都是五彩的：
       颜色按角度绕色相环走一圈，外层一大圈、内层一小圈套着开（双层绽放），
       每个碎片背后还拖一小截指回中心的尾巴，炸开那一瞬间再推出一圈彩环。 */
    const hue=(a)=>`hsl(${((a%360)+360)%360},96%,${62}%)`;
    for(let b=0;b<6;b++){
      /* 四朵分开放在四个角落，别全挤在一块 */
      const cx=28+(b%3)*17+rnd(-5,9),cy=13+Math.floor(b/3)*26+rnd(-4,12),d=b*.66,
        h0=rnd(0,360),span=pick([300,360,150,210]),/* 有的朵整圈五彩，有的朵只在一段色相里渐变 */
        c=hue(h0),c2=hue(h0+span*.5);
      /* 先从屏幕最底下升空：一条带尾巴的小点，升到 cy% 那个高度 */
      add(`left:${cx.toFixed(1)}%;--rise:${(SH*(1-cy/100)).toFixed(0)}px;--c:${c};animation-delay:${d.toFixed(2)}s`,null,'shell');
      /* 炸开那一下：白芯闪光 + 往外推的彩环 */
      add(`left:${cx.toFixed(1)}%;top:${cy.toFixed(1)}%;--c:${c};--c2:${c2};animation-delay:${(d+1.03).toFixed(2)}s`,null,'flash');
      add(`left:${cx.toFixed(1)}%;top:${cy.toFixed(1)}%;--c:${c};--c2:${c2};--rd:${rnd(210,310).toFixed(0)}px;`
        +`animation-delay:${(d+1.03).toFixed(2)}s`,null,'ring');
      /* 外层一大圈 + 内层一小圈；碎片横向匀速、纵向重力，所以是抛物线不是直线 */
      for(const layer of [{n:40,r0:82,r1:168,sz:[2.2,4.4],dur:[1.3,2.05],g:[62,136],t:[10,22]},
                          {n:20,r0:34,r1:78,sz:[1.6,3.2],dur:[.9,1.4],g:[34,78],t:[6,13]}]){
        for(let n=0;n<layer.n;n++){
          const t=n/layer.n,ang=t*Math.PI*2+rnd(-.09,.09),r=rnd(layer.r0,layer.r1),
            x=Math.cos(ang)*r,y=Math.sin(ang)*r*.8;
          add(`left:${cx.toFixed(1)}%;top:${cy.toFixed(1)}%;--x:${x.toFixed(0)}px;--y:${y.toFixed(0)}px;`
            +`--g:${rnd(layer.g[0],layer.g[1]).toFixed(0)}px;--c:${hue(h0+t*span)};`
            +`--sz:${rnd(layer.sz[0],layer.sz[1]).toFixed(1)}px;`
            +`--tail:${rnd(layer.t[0],layer.t[1]).toFixed(0)}px;--ta:${(ang*180/Math.PI+180).toFixed(0)}deg;`
            +`animation-delay:${(d+1.03+rnd(0,.05)).toFixed(2)}s;`
            +`animation-duration:${rnd(layer.dur[0],layer.dur[1]).toFixed(2)}s`,'<b></b>','spark');}}}
    life=6600;}
  else if(kind==='lasers'){
    const cols=['#ff2d55','#0a84ff','#30d158','#ffd60a','#bf5af2','#64d2ff'];
    for(let n=0;n<11;n++){const c=cols[n%cols.length];
      add(`top:${rnd(6,94).toFixed(1)}%;--c:${c};--r0:${rnd(-30,30).toFixed(0)}deg;--r1:${rnd(-30,30).toFixed(0)}deg;`
        +`animation-delay:${(n*.085).toFixed(2)}s;animation-duration:${rnd(1.7,2.4).toFixed(2)}s`);}
    life=3200;}
  else if(kind==='star'){
    /* 会眨的小星星铺一层，再让几颗流星划过去 */
    /* 她要「流星多一点、屏幕暗一点、流星亮一点」：数量 8→20，背景那层暗色在 CSS 里 */
    for(let n=0;n<64;n++)add(`left:${rnd(0,100).toFixed(1)}%;top:${rnd(0,90).toFixed(1)}%;`
      +`--sz:${rnd(1.2,3.1).toFixed(1)}px;animation-duration:${rnd(1.4,2.8).toFixed(2)}s;animation-delay:${rnd(0,1.6).toFixed(2)}s`,null,'twinkle');
    /* 她说「流星不要一开始就固定在屏幕里，他是从屏幕最外面下来的，显得有些死板」：
       起点一律放到屏幕外面——要么在右边框外，要么在顶边上面——再划进来。 */
    for(let n=0;n<20;n++){const side=n%2===0;
      const lf=side?rnd(103,152):rnd(34,126),tp=side?rnd(-22,34):rnd(-46,-8);
      add(`left:${lf.toFixed(1)}%;top:${tp.toFixed(1)}%;`
        +`--len:${rnd(80,175).toFixed(0)}px;--dx:${(-SW*rnd(.78,1.32)).toFixed(0)}px;--dy:${(SH*rnd(.5,.95)).toFixed(0)}px;`
        +`animation-delay:${(n*.17).toFixed(2)}s;animation-duration:${rnd(1.6,2.4).toFixed(2)}s`,'<b></b>','shoot');}
    life=4200;}
  else if(kind==='spotlight'){
    /* 光要打在这条消息上，不是随便找个地方暗下来 */
    let sx=50,sy=52;
    try{const node=m&&m.id&&document.querySelector(`.imsg-b[data-mid="${m.id}"]`);
      if(node){const r=node.getBoundingClientRect(),s=stage.getBoundingClientRect();
        if(r.width&&s.width){sx=Math.max(14,Math.min(86,(r.left+r.width/2-s.left)/s.width*100));
          sy=Math.max(14,Math.min(86,(r.top+r.height/2-s.top)/s.height*100));}}}catch(_){}
    box.style.setProperty('--sx',sx.toFixed(1)+'%');
    box.style.setProperty('--sy',sy.toFixed(1)+'%');
    add(`left:${sx.toFixed(1)}%;top:${sy.toFixed(1)}%`,null,'halo');
    box.__sx=sx;box.__sy=sy;
    /* 浮尘只在光柱里飘，飘到暗处去就看不见了 */
    for(let n=0;n<26;n++)add(`left:${(sx+rnd(-15,15)).toFixed(1)}%;top:${(sy+rnd(-9,9)).toFixed(1)}%;`
      +`--sz:${rnd(1.4,3.4).toFixed(1)}px;--rise:${rnd(24,62).toFixed(0)}px;`
      +`animation-duration:${rnd(2.2,3.4).toFixed(2)}s;animation-delay:${rnd(0,1.2).toFixed(2)}s`,null,'dust');
    life=3400;}
  stage.appendChild(box);
  setTimeout(()=>{if(box.parentNode)box.remove();},life);}

function phSmsBgMap(){const p=phState();if(!p.smsBg||typeof p.smsBg!=='object')p.smsBg={};return p.smsBg;}
function phSmsBg(num){return phSmsBgMap()[phNorm(phDigits(num))]||'';}
function phSmsBgSet(num,src){phSmsBgMap()[phNorm(phDigits(num))]=src;save();}
function phSmsBgClear(num){delete phSmsBgMap()[phNorm(phDigits(num))];save();}
function phSmsBgPick(num){pickFile('image/*',async f=>{
  let src='';try{src=await compressChatBackground(f);}catch(_){}
  if(!src){toast('这张图读不出来，换一张');return;}
  phSmsBgSet(num,src);render();toast('聊天背景换好了');});}
function phSmsBgRemove(num){if(!phSmsBg(num))return toast('本来就没有背景');
  phSmsBgClear(num);render();toast('已恢复默认背景');}
/* 输入框有字才冒出蓝色发送键 */
function phSmsTyping(){const ta=$('#smsin');if(!ta)return;const bar=ta.closest('.imsg-bar');if(!bar)return;
  bar.classList.toggle('typing',!!String(ta.value||'').trim());}
function phImsgDate(t){const d=new Date(t||Date.now()),n=new Date();
  const same=d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()&&d.getDate()===n.getDate();
  return (same?'今天':(d.getMonth()+1)+'月'+d.getDate()+'日')+' '+hm(t);}
function renderPhoneIMsg(num,sk,arr,x){
  const bg=phSmsBg(num),name=phName(num),sel=phSmsSelOn(sk);
  const rows=arr.map(m=>{const pic=m.img?storedImageDisplaySource(m.img):'',fx=phMsgHasFx(m),
      inv=m.bfx==='invisible'?' iminv':'',
      tick=sel?`<span class="imsg-tick${phSmsSelHas(m.id)?' on':''}" id="phtk_${m.id}" onclick="event.stopPropagation();phSmsSelToggle('${m.id}')">✓</span>`:'',
      tap=sel?`phSmsSelToggle('${m.id}')`:`phSmsMenu('${esc(num)}','${m.id}','${esc(sk)}')`;
    if(m.voice){
      /* 语音条：气泡还是短信这一套（磨砂＋细高光），只是里面换成波形和秒数。
         点气泡＝播放，点下面那行转文字＝短信操作菜单（删除等）。 */
      const dur=Math.min(VOICE_MAX_SECONDS,m.dur||voiceEstimatedSeconds(m.text||'')),
        loading=typeof voiceTtsPending==='function'&&voiceTtsPending(m);
      return `<div class="imsg-row ${m.from==='me'?'me':'them'}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}">${tick}<div class="imsg-col">`
        +`<div class="imsg-b imsgv${loading?' loading':''}${m._playWhenReady?' queued':''}${voiceBarActive(m.id)?' playing':''}" data-mid="${m.id}" data-vid="${m.id}"`
        +` aria-busy="${loading?'true':'false'}" onclick="${sel?tap:`phVoiceTap('${esc(num)}','${m.id}','${esc(sk)}')`}">`
        +`<i><span class="imsgv-wave"><i></i><i></i><i></i><i></i></span><span class="imsgv-dur">${dur}″</span></i></div>`
        +(m.showText?`<div class="imsg-vtext" onclick="${tap}">${esc(m.text||'')}`
          +(m.trans?`<span class="tr">${esc(m.trans)}</span>`:'')+`</div>`:'')
        +`</div></div>`;}
    return `<div class="imsg-row ${m.from==='me'?'me':'them'}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}">${tick}<div class="imsg-col"><div class="imsg-b${pic?' pic':''}${inv}" data-mid="${m.id}" onclick="${tap}">`
      +`<i>${pic?`<img src="${pic}" alt="">`:phFxBodyHTML(m)}</i></div>`
      +(fx&&!sel?`<span class="imsg-fxrp" onclick="phFxReplay('${esc(num)}','${m.id}','${esc(sk)}')">↺ 重播</span>`:'')
      +`</div></div>`;}).join('');
  return `<div class="imsg${bg?' hasbg':''}" style="${bg?`background-image:url(${storedImageDisplaySource(bg)})`:''}">
    <div class="imsg-head">
      <button class="imsg-rb" onclick="back()"><i>‹</i></button>
      <div class="imsg-who" onclick="go('phonecontact',{num:'${esc(num)}'})">${phAvatar(num,'lg')}<span class="imsg-name"><i>${esc(name)} ›</i></span></div>
      <button class="imsg-rb" onclick="phVideoCall('${esc(num)}')"><i>${svgIc('video',21,'#fff',1.9)}</i></button>
    </div>
    <div class="imsg-body${sel?' selmode':''}" id="smsbody">
      <div class="imsg-kind">iMessage信息<br>${svgIc('lock',12,'#8e8e93',2)} 已加密</div>
      <div class="imsg-date">${esc(phImsgDate(arr.length?arr[0].time:Date.now()))}</div>
      ${rows}
      ${phSmsTypingOn(num,sk)?`<div class="imsg-row them"><div class="imsg-b typing"><i><span></span><span></span><span></span></i></div></div>`:''}
    </div>
    ${sel?phSmsSelBarHTML():phFxBarHTML()+phSmsComposerHTML(num,sk)}
  </div>`;}
/* ===== 多选删除 =====
   她说「＋号里再添加一个多选删除我和他的信息」。进多选之后气泡前面冒出小圆圈，
   点哪条选哪条；这期间不播特效、不放语音，免得一点就跑起来。 */
let _phSmsSel=null;
function phSmsSelOn(sk){return !!(_phSmsSel&&_phSmsSel.sk===String(sk||''));}
function phSmsSelHas(mid){return !!(_phSmsSel&&_phSmsSel.ids.indexOf(mid)>=0);}
function phSmsSelEnter(num,sk){_phSmsSel={num:String(num||''),sk:String(sk||''),ids:[]};render();}
function phSmsSelExit(){_phSmsSel=null;render();}
/* 只改那一颗圆圈和计数，不整页重画——重画会把聊天滚回顶上去 */
function phSmsSelToggle(mid){if(!_phSmsSel)return;const i=_phSmsSel.ids.indexOf(mid),on=i<0;
  if(on)_phSmsSel.ids.push(mid);else _phSmsSel.ids.splice(i,1);
  const tk=$('#phtk_'+mid);if(tk)tk.classList.toggle('on',on);
  phSmsSelSync();}
function phSmsSelSync(){const n=_phSmsSel?_phSmsSel.ids.length:0,b=$('#phseldel');
  if(b){b.textContent='删除'+(n?'（'+n+'）':'');if(n)b.removeAttribute('disabled');else b.setAttribute('disabled','');}
  const a=$('#phselall');if(a)a.textContent=phSmsSelAllOn()?'取消全选':'全选';}
function phSmsSelAllOn(){if(!_phSmsSel)return false;const arr=phSmsArr(_phSmsSel.num,_phSmsSel.sk);
  return arr.length>0&&_phSmsSel.ids.length>=arr.length;}
function phSmsSelAll(){if(!_phSmsSel)return;const arr=phSmsArr(_phSmsSel.num,_phSmsSel.sk);
  _phSmsSel.ids=phSmsSelAllOn()?[]:arr.map(m=>m.id);render();}
async function phSmsSelDelete(){if(!_phSmsSel)return;const ids=_phSmsSel.ids.slice();
  if(!ids.length){toast('先选几条');return;}
  if(!await uiConfirm('删除选中的 '+ids.length+' 条信息？'))return;
  const num=_phSmsSel.num,sk=_phSmsSel.sk,arr=phSmsArr(num,sk),keep=arr.filter(m=>ids.indexOf(m.id)<0);
  arr.length=0;keep.forEach(m=>arr.push(m));
  _phSmsSel=null;save();render();toast('已删除 '+ids.length+' 条');}
function phSmsSelBarHTML(){const n=_phSmsSel?_phSmsSel.ids.length:0;
  return `<div class="imsg-selbar">`
    +`<button id="phselall" onclick="phSmsSelAll()">${phSmsSelAllOn()?'取消全选':'全选'}</button>`
    +`<button id="phseldel" class="del"${n?'':' disabled'} onclick="phSmsSelDelete()">删除${n?'（'+n+'）':''}</button>`
    +`<button onclick="phSmsSelExit()">取消</button></div>`;}
function phSmsComposerHTML(num,sk){return `<div class="imsg-bar${String(_phFx.prev||'').trim()?' typing':''}">
      <button class="imsg-plus${phFxHas()?' on':''}" onclick="phSmsPlusMenu('${esc(num)}','${esc(sk)}')"><i>＋</i></button>
      <div class="imsg-field"><textarea id="smsin" rows="1" placeholder="iMessage信息" oninput="phSmsTyping();phFxSync()" onselect="phFxSelSync()" onkeyup="phFxSelSync()" onclick="phFxSelSync()" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();phSendSms('${esc(num)}','${esc(sk)}')}">${esc(_phFx.prev||'')}</textarea><i class="imsg-wave">${svgIc('mic',17,'#8e8e93',2)}</i></div>
      <button class="imsg-send" onclick="phSendSms('${esc(num)}','${esc(sk)}')" oncontextmenu="event.preventDefault();phFxSendHold('${esc(num)}','${esc(sk)}');return false" onpointerdown="phFxHoldStart('${esc(num)}','${esc(sk)}')" onpointerup="phFxHoldStop()" onpointerleave="phFxHoldStop()"><i>↑</i></button>
    </div>`;}
/* ＋ 就是相册：点一下直接选图发出去（她说「点一下可以打开相册发送图片」）。
   原来挂在这儿的联系人资料／换背景／打电话，联系人页里本来就都有。 */
/* ＋ 发图：先把图发出去，真的识一遍图，看清了再让角色回。
   不识图的话角色只知道「她发了张照片」，根本不知道里面是什么——她实测就问到了这点。
   识图用的和微信发图完全同一条线路、同一段提示词。 */
/* 她说「不要改变下面的布局，把功能放在 ＋ 号里」——所以 ＋ 收着照片和文字效果两件事 */
function phSmsPlusMenu(num,sk){phFxSync();
  const sel=_phFxSel,text=String(_phFx.prev||''),piece=text.slice(sel.s,sel.e);
  openModal(`<h3>${esc(phName(num))}</h3>
  <button class="btn imblue" onclick="closeModal();phSmsPic('${esc(num)}','${esc(sk)}')">照片</button>
  <button class="btn imblue" style="margin-top:8px" onclick="closeModal();phFxOpenText()">文字效果${piece?'（'+esc(piece.slice(0,8))+(piece.length>8?'…':'')+'）':text?'（整条）':''}</button>
  <button class="btn g" style="margin-top:8px" onclick="closeModal();phSmsSelEnter('${esc(num)}','${esc(sk)}')">多选删除信息</button>
  ${phFxHas()?`<button class="btn g" style="margin-top:8px" onclick="closeModal();phFxDrop()">清掉这条的效果</button>`:''}
  <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function phSmsPic(num,sk){pickFile('image/*',async f=>{
  let src='';try{src=await compress(f,1400,.82);}catch(_){}
  if(!src){toast('这张图读不出来，换一张');return;}
  const sent=phSendSmsImage(num,sk,src,{hold:true});
  if(!sent)return;
  phSmsTypingSet(num,sent.sk,true);
  try{await phSmsVision(sent.m,f);}finally{phSmsTypingSet(num,sent.sk,false);}
  if(sent.m.visionState==='failed')toast('这张图没看清：'+String(sent.m.visionError||'识图失败').slice(0,60)+'（长按气泡可以重试）');
  sent.fire();});}
/* 识一张短信里的图：描述写进 imgDesc，进上下文时跟在 [图片：…] 后面 */
const PH_SMS_VISION_PROMPT='请仔细、客观地用中文描述这张图片。有人物时说清人数、年龄段、表情、发型穿着、动作和场景；是聊天截图、表情包或梗图时，读出关键文字并说明表达的意思；是物品、风景、动物或食物时，说清主体、颜色、细节和氛围。用2到3句自然白话描述，让没看过图的人也能理解，不要评价或攻击人物。';
async function phSmsVision(m,file){
  if(!m||m.visionState!=='pending')return false;
  try{
    let v;
    if(file){v=await visionPhotoSource(file,1280,.76);if(v.length>1400000)v=await visionPhotoSource(file,1000,.7);}
    else v=await visionDataURLSource(storedImageDisplaySource(m.img),1200,.74);
    const d=String(await visionAPI(v,PH_SMS_VISION_PROMPT)||'').trim().slice(0,400);
    m.imgDesc=d;m.visionState=d?'success':'failed';if(!d)m.visionError='识图没有返回内容';
  }catch(e){m.visionState='failed';m.visionError=visionPlainError(e);}
  save();return m.visionState==='success';}
/* 进上下文时这张图长什么样：识出来了就带上描述，没识出来就老老实实只写 [图片] */
function phSmsImgLine(m){const d=String(m&&m.imgDesc||'').trim();return d?('[图片：'+d+']'):'[图片]';}
function phSmsRetryVision(num,mid,sk){const m=phSmsArr(num,sk).find(x=>x&&x.id===mid);
  if(!m||!m.img)return;if(m.visionState==='pending')return toast('正在看这张图…');
  m.visionState='pending';m.imgDesc='';m.visionError='';save();closeModal();
  phSmsTypingSet(num,sk,true);
  phSmsVision(m,null).then(ok=>{phSmsTypingSet(num,sk,false);
    toast(ok?'这张图看清了':'还是没看清：'+String(m.visionError||'').slice(0,50));render();});}
/* 发一张图：和发字走同一条线，只是正文写成 [图片]、另外带上 img。
   opt.hold 表示先别让角色回——要等识图跑完，不然它回的时候还没看见图。 */
function phSendSmsImage(num,sk,src,opt){num=phDigits(num);const p=phState(),x=phFind(num),
  thread=p.aliasThreads&&p.aliasThreads[num],
  useAlias=phSmsIsAliasKey(sk)||(p.line==='alias'&&x&&x.kind==='role'),
  spoofThread=!useAlias&&thread&&thread.spoof&&thread.cid;
  let alias=null;
  if(useAlias){const c=getC(x&&x.id);alias=c&&phEnsureAliasThread(c,num,'sms');sk=sk||phSmsKey(num,'alias',alias.aliasNum);}
  else sk=sk||num;
  if(p.blocked[phNorm(num)]){toast('已屏蔽，不能发送');return null;}
  const arr=phSmsArr(num,sk),m={id:uid(),from:'me',text:'[图片]',img:src,imgDesc:'',
    visionState:(typeof visionConfigured==='function'&&visionConfigured())?'pending':'off',
    time:Date.now(),read:true,line:useAlias?'alias':'main',
    aliasTo:useAlias&&alias&&alias.cid,aliasNum:useAlias&&alias&&alias.aliasNum,spoofTo:spoofThread&&thread.cid};
  arr.push(m);
  if(arr.length>300)arr.splice(0,arr.length-300);
  save();render();
  const fire=()=>{const line=phSmsImgLine(m);
    if(!useAlias&&!spoofThread)phMirrorSMS(num,'me','（发了一张照片）'+(m.imgDesc?'：'+m.imgDesc:''));
    if(useAlias&&alias&&alias.cid)setTimeout(()=>phRoleAliasReply(alias.cid,num,line,alias.aliasNum,sk),500+Math.random()*500);
    else if(spoofThread)setTimeout(()=>phRoleSpoofSmsReply(thread.cid,num,line),450+Math.random()*450);
    else if(x&&x.kind==='role')setTimeout(()=>phRoleSmsReply(x.id,num,line,sk),650+Math.random()*650);
    else setTimeout(()=>phAutoSmsReply(num,line),700+Math.random()*900);};
  if(!(opt&&opt.hold))fire();
  return {m,sk,fire};}
/* 她说「把这张换成背景」，角色回一行 [换背景]，就真的拿最近那张图换上去 */
function phRoleSetSmsBg(num,sk){const arr=phSmsArr(num,sk).slice(-24).reverse(),hit=arr.find(m=>m&&m.img);
  if(!hit)return false;phSmsBgSet(num,hit.img);render();toast('ta把这张照片换成了聊天背景');return true;}
function openPhoneSMS(num,sk){num=phDigits(num);phFxReset();_phSmsSel=null;const p=phState();sk=sk||phCurrentSmsKey(num);p.line=phSmsIsAliasKey(sk)?'alias':'main';(p.sms[sk]||[]).forEach(m=>{if(m.from==='them')m.read=true;});p.read[sk]=Date.now();save();go('phonesms',{num,sk});}
function renderPhoneSMS(num,sk,inspection){num=inspection?String(num):phDigits(num);sk=inspection?'spy:'+inspection.id+':'+num:(sk||phCurrentSmsKey(num));
  if(!inspection){if(phImsgOn(num,sk))return renderPhoneIMsg(num,sk,(phState().sms[sk]||[]),phFind(phDigits(num)));}
  const arr=inspection?inspection.arr:(phState().sms[sk]||[]),alias=inspection?true:phSmsIsAliasKey(sk),aliasNum=phSmsAliasNumFromKey(sk),x=inspection?null:phFind(num),roleChat=x&&x.kind==='role',headAv=alias?phDefaultAvatar('lg'):phAvatar(num,'lg'),headName=inspection?inspection.name:alias?'匿名号':phName(num),meta=inspection?('信息 · 短信<br>'+esc(phFmt(num))):alias?('匿名号 '+phFmt(aliasNum)+'<br>发给 '+phName(num)+' · '+phFmt(num)):('信息 · 短信<br>'+phFmt(num));const html=`<div class="smschat"><div class="smshead"><button class="phbtn back" onclick="back()">‹</button>${headAv}<div class="smsname" onclick="go('phonecontact',{num:'${esc(num)}'})">${esc(headName)} ›</div><div class="smsmeta">${meta}</div></div><div class="smsbody" id="smsbody"><div class="smsdate">${arr.length?fmtDT(arr[0].time):fmtDT(Date.now())}</div>${arr.map(m=>`<div class="smsmsg ${m.from==='me'?'me':'them'}" data-chat-motion-row="${esc(naturalMotionRowKey(m))}"><div class="smsbubble" onclick="phSmsMenu('${esc(num)}','${m.id}','${esc(sk)}')">${m.img?`<img src="${storedImageDisplaySource(m.img)}" alt="" style="display:block;max-width:100%;width:180px;border-radius:10px">`:esc(m.text)}</div></div>`).join('')}${!inspection&&phSmsTypingOn(num,sk)?'<div class="smsmsg them"><div class="smsbubble typing"><span></span><span></span><span></span></div></div>':''}</div><div class="smslinebar">${roleChat&&alias?phLineSwitchHTML():''}</div><div class="smsbar"><button onclick="go('phonecontact',{num:'${esc(num)}'})">+</button><textarea id="smsin" placeholder="信息 · 短信" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();phSendSms('${esc(num)}','${esc(sk)}')}"></textarea><button onclick="phSendSms('${esc(num)}','${esc(sk)}')">↑</button></div></div>`;return inspection?spyPhoneSanitize(html,inspection.id):html;}
function phSmsArr(num,sk){const p=phState();sk=sk||phCurrentSmsKey(num);return p.sms[sk]||(p.sms[sk]=[]);}
function phMirrorSMS(num,from,text){const x=phFind(num);if(!x||x.kind!=='role')return;const c=getC(x.id);if(!c)return;const who=from==='me'?S.me.name:(c.remark||c.name),line='[电话短信记录] '+fmtDT(Date.now())+'，'+who+'在短信里说：'+String(text||'').replace(/\n/g,' ').slice(0,180);msgs(c.id).push({role:from==='me'?'user':'assistant',type:'sys',content:line,time:Date.now(),id:uid(),_silent:true,_phoneCtx:true});save(500);}
function phPushSpoofSmsCtx(c,num,from,text){if(!c||!text)return;const who=from==='me'?S.me.name:'你',to=from==='me'?'你':S.me.name,line='[陌生短信记录] '+fmtDT(Date.now())+'，你用陌生号码 '+phFmt(num)+' 和 '+S.me.name+' 发短信。'+who+' 对 '+to+' 说：'+String(text||'').replace(/\n/g,' ').slice(0,180)+'。这是短信，不是电话。';msgs(c.id).push({role:from==='me'?'user':'assistant',type:'sys',content:line,time:Date.now(),id:uid(),_silent:true,_phoneCtx:true});save(500);}
function phSendSms(num,sk){const ta=$('#smsin'),text=(ta&&ta.value||'').trim();if(!text)return;num=phDigits(num);const p=phState(),x=phFind(num),thread=p.aliasThreads&&p.aliasThreads[num],useAlias=phSmsIsAliasKey(sk)||(p.line==='alias'&&x&&x.kind==='role'),spoofThread=!useAlias&&thread&&thread.spoof&&thread.cid;let alias=null;if(useAlias){const c=getC(x&&x.id);alias=c&&phEnsureAliasThread(c,num,'sms');sk=sk||phSmsKey(num,'alias',alias.aliasNum);}else sk=sk||num;if(p.blocked[phNorm(num)]){toast('已屏蔽，不能发送');return;}if(useAlias&&phAliasBlocked(alias,alias&&alias.aliasNum)){toast('对方已拉黑这个陌生身份');return;}phFxSync();const _fxRuns=phFxRuns(text,(_phFx.ch||[]).slice(0,text.length)),
    _fxOn=_fxRuns.some(r=>r&&r.e&&r.e.length),_bfx=_phFx.bfx,_sfx=_phFx.sfx;
  ta.value='';phSmsTyping();phFxReset();const arr=phSmsArr(num,sk),_m={id:uid(),from:'me',text,time:Date.now(),read:true,line:useAlias?'alias':'main',aliasTo:useAlias&&alias&&alias.cid,aliasNum:useAlias&&alias&&alias.aliasNum,spoofTo:spoofThread&&thread.cid};
  if(_fxOn)_m.fx=_fxRuns;if(_bfx)_m.bfx=_bfx;if(_sfx)_m.sfx=_sfx;
  arr.push(_m);if(arr.length>300)arr.splice(0,arr.length-300);const _pz=!useAlias&&typeof pursuitOnUserSms==='function'?pursuitOnUserSms(num):null;if(!useAlias&&!spoofThread&&!(_pz&&_pz.stranger))phMirrorSMS(num,'me',text);save();render();
  if(_bfx||_sfx||_fxOn)setTimeout(()=>phFxPlay(_m,$('#smsbody')),40);
  if(_pz&&_pz.stranger)setTimeout(()=>phRoleSmsReply(_pz.cid,num,text,num),650+Math.random()*650);else if(useAlias&&alias&&alias.cid)setTimeout(()=>phRoleAliasReply(alias.cid,num,text,alias.aliasNum,sk),500+Math.random()*500);else if(spoofThread)setTimeout(()=>phRoleSpoofSmsReply(thread.cid,num,text),450+Math.random()*450);else if(x&&x.kind==='role')setTimeout(()=>phRoleSmsReply(x.id,num,text,num),650+Math.random()*650);else setTimeout(()=>phAutoSmsReply(num,text),700+Math.random()*900);}
async function phRoleSmsReply(id,num,userText,sk){const c=getC(id);if(!c||(c.blocked&&!pursuitState(c))||phState().blocked[phNorm(num)])return;sk=sk||num;/* 微信被拉黑不等于短信不能回：追回里她回了短信，他要接得上 */
  const range=phSmsBubbleRange(c),rows=phCtxRows(),_want=phFxWantFromText(userText);
  phSmsTypingSet(num,sk,true);
  try{const arr=phSmsArr(num,sk).slice(-rows).map(m=>(m.from==='me'?S.me.name:(c.remark||c.name))+'：'+phSmsLineText(m)).join('\n'),wx=msgs(id).filter(m=>!m._call).slice(-Math.max(6,Math.round(rows*.6))).map(m=>msgToText(m)).filter(Boolean).join('\n');const sys=buildSystem(c)+(typeof pursuitSmsPrompt==='function'?pursuitSmsPrompt(c,num):'')+'\n\n# 当前场景：手机短信\n你正在和'+S.me.name+'发短信，不是微信。短信和微信是同一个人、同一段关系，要记得最近微信里的情绪和话题，但短信回复要像真实短信一样短一点、自然口语。\n一次回复可以发 '+range.min+' 到 '+range.max+' 条短信，这是【可浮动范围】不是固定任务：随口应一句就一条，情绪多、想解释、想哄人时才多发几条。每条【单独占一行】，用换行分开，不要写成一大段。\n只输出短信正文，不要方括号指令，不要输出[心情]、[心情值]、[语气]等隐藏标签。\n她发来的照片在记录里写成 [图片：画面描述]，那段描述是系统真的看过这张图之后写下来的，你可以直接当成你亲眼看到的画面来回应。如果只写着 [图片] 没有描述，说明这次没看清，就别编造里面有什么，可以问她。如果她让你把某张照片换成你们短信的聊天背景（比如「把这张换成背景」「拿这张当背景」），就在回复最后【单独一行】写 [换背景]，系统会真的替她换上去；她没提这件事就不要写这个标签。'+phSmsVoiceHelp(c)+phFxTagHelp()+phFxWantPrompt(_want);let r=await chatAPI([{role:'system',content:sys},{role:'user',content:'最近微信上下文：\n'+(wx||'（无）')+'\n\n短信记录：\n'+arr+'\n\n'+S.me.name+'刚发来：'+userText}],{temp:.8});
  r=String(r||'');const wantBg=/[\[【]\s*换背景\s*[\]】]/.test(r);r=r.replace(/[\[【]\s*换背景\s*[\]】]/g,' ');
  let parts=phSmsBubbles(r,range.max);
  if(wantBg&&!phRoleSetSmsBg(num,sk)&&!parts.length)parts=['我没找到你说的那张照片，你再发我一次？'];
  if(!parts.length)return;
  phSmsTypingSet(num,sk,false);
  const _sent=await phDeliverSmsBubbles(num,sk,parts,c);
  phSmsApplyWantedFx(num,sk,_sent,_want);}catch(e){}finally{phSmsTypingSet(num,sk,false);}}
function phStrangerProfile(num){const d=phNorm(num),sp=phSpecialInfo(num);if(sp)return {name:sp.name,kind:'公共服务',region:phRegion(num)};if(/^10\d{4,}/.test(d))return {name:'验证码平台',kind:'验证码/平台通知',region:'平台短信'};if(/^95/.test(d)||/^400/.test(d))return {name:'生活服务',kind:'客服/营销',region:'服务号码'};if(/^1\d{10}$/.test(d)){const pool=['陌生人','快递外卖','生活服务','营销号码','旧联系人','暧昧错发','装熟骚扰','奇怪通知'];return {name:phFmt(num),kind:pool[Math.abs(phHash(d))%pool.length],region:phRegion(num)};}return {name:phFmt(num),kind:'陌生号码',region:phRegion(num)};}
function phRandomSmsText(num,pf,now){pf=pf||phStrangerProfile(num);now=now||Date.now();const code=String(Math.abs(phHash(now+':'+num))).slice(0,6).padStart(6,'0'),pool={
  '验证码/平台通知':['验证码 '+code+'，5分钟内有效。不是本人操作请忽略。','你的动态安全码是 '+code+'，别告诉任何人。','登录确认码 '+code+'。如果不是你，可能是有人手滑填错号码。'],
  '客服/营销':['尊贵用户，今晚的神秘权益已为你点亮，回复1领取空气礼包。','您有一份过期三年的好运待签收，回复“我信了”查看。','系统检测到你最近魅力值偏高，客服建议适当低调。'],
  '生活服务':['您好，你预约的“情绪回收服务”已排队，今晚有人负责听你叹气。','小区温馨提示：今晚风很大，适合把想说的话发出去。','你的云端心事包裹正在派送，签收人需要保持可爱。'],
  '快递外卖':['你的包裹备注写着“别让她自己扛”，请问放门口还是放在心上？','外卖小哥迷路了，他说地址像是写到了某个人心里。','快件异常：收件人太让人惦记，系统无法冷静派送。'],
  '营销号码':['限时活动：回复“想你”可获得一份不值钱但很暧昧的关心。','恭喜你被抽中成为今晚第一个被打扰的人，奖品是这条短信。','本号码只负责随机出现，不负责解释为什么想找你。'],
  '旧联系人':['这么久没联系，你是不是把我从记忆里删了？','我换号码了，猜猜我是谁。猜错也没关系，我会继续装神秘。','刚刚路过一个地方，突然想起你。别问我是谁，问就是不太方便说。'],
  '暧昧错发':['睡了吗？算了，当我没问。可我确实想知道。','你今天是不是心情不好？别问我怎么知道的。','如果这条发错了，那也挺好，至少我终于有理由跟你说话。'],
  '装熟骚扰':['别装不认识我，你上次也是这么说的。','我知道现在打扰你不合适，但我偏偏就是想试一下。','你再不回，我就默认你在认真想我是谁。'],
  '奇怪通知':['月亮客服提醒：今晚有人偷偷想你，工单无法关闭。','系统提示：你有一条未读心动，来源不明，风险等级：微妙。','匿名广播：请保持手机畅通，可能会有奇怪的人想靠近你。'],
  '陌生人':['冒昧问一句，你相信号码也会认错人吗？','我好像发错人了，不过你的号码看起来挺有缘。','别紧张，我只是一个路过的陌生号码。可能路过得有点刻意。']
};const arr=pool[pf.kind]||pool['陌生人'];return arr[Math.abs(phHash(num+':'+now+':sms'))%arr.length];}
async function phAutoSmsReply(num,userText){const x=phFind(num);if(x&&x.kind==='role')return;if(phState().blocked[phNorm(num)])return;const pf=phStrangerProfile(num),arr=phSmsArr(num,num).slice(-phCtxRows()).map(m=>(m.from==='me'?S.me.name:pf.name)+'：'+(m.img?phSmsImgLine(m):m.text)).join('\n');let r='';try{const sys='你在小手机里模拟真实短信对话。号码身份：'+pf.name+'；类型：'+pf.kind+'；地区：'+pf.region+'。你不是任何恋爱角色，不能知道用户微信隐私或角色记忆。回复要像真实短信，短一点，但可以更有趣：装熟、撩人、嘴欠、奇怪生活服务、花里胡哨的骚扰短信、暧昧错发都可以。禁止真实诈骗、真实链接、真实转账/加群/贷款引导；可以做成明显玩笑或虚构服务。只输出短信正文。';r=await chatAPI([{role:'system',content:sys},{role:'user',content:'短信记录：\n'+arr+'\n\n用户刚发：'+userText}],{max:160,temp:.86});}catch(e){}
  r=phCleanSmsText(cleanReply(r||'')).slice(0,180);if(!r)r=phRandomSmsText(num,pf);phReceiveSms(num,r,null);}
//@@ web
function phSmsNotify(num,text,c){const title=(c&&(c.remark||c.name))||phName(num)||phFmt(num),body=String(text||'').replace(/\s+/g,' ').slice(0,80),target={type:'phonesms',id:num};lockNotify(title,body,{avatar:c&&c.avatar,icon:c&&c.avatar?'':'message',target});appNotify(title,body,{tag:'sms-'+phNorm(num),data:{type:'open',target:'phonesms',id:num}});if(lockVisible()||_call)return;const b=$('#msgBanner');if(!b)return;b.innerHTML=`${c&&c.avatar?av(c.avatar,'sm'):`<div class="avatar sm" style="background:#151520;border:1px solid #34343a">${svgIc('message',19,'#d7d7dc',1.55)}</div>`}<div style="flex:1;min-width:0"><div class="bn">${esc(title)}</div><div class="bm">${esc(body)}</div></div>`;b.className='msgbanner show';b.onclick=()=>{b.className='msgbanner';openPhoneSMS(num);};clearTimeout(_bannerT);_bannerT=setTimeout(()=>{b.className='msgbanner';},4800);}
//@@ private
function phSmsNotify(num,text,c){const title=(c&&(c.remark||c.name))||phName(num)||phFmt(num),body=String(text||'').replace(/\s+/g,' ').slice(0,80),target={type:'phonesms',id:num};lockNotify(title,body,{avatar:c&&c.avatar,icon:c&&c.avatar?'':'message',target});appNotify(title,body,{tag:'sms-'+phNorm(num),data:{type:'open',target:'phonesms',id:num}});if(lockVisible()||_call)return;const b=$('#msgBanner');if(!b)return;b.innerHTML=`${c&&c.avatar?av(c.avatar,'sm'):`<div class="avatar sm" style="background:#151518;border:1px solid #34343a">${svgIc('message',19,'#d7d7dc',1.55)}</div>`}<div style="flex:1;min-width:0"><div class="bn">${esc(title)}</div><div class="bm">${esc(body)}</div></div>`;b.className='msgbanner show';b.onclick=()=>{b.className='msgbanner';openPhoneSMS(num);};clearTimeout(_bannerT);_bannerT=setTimeout(()=>{b.className='msgbanner';},4800);}
//@@ end
/* 语音条在上下文和列表预览里怎么写：把原文和译文都带上，
   不然下一轮角色就不知道自己刚才用语音说了什么 */
function phSmsVoiceLine(m){const t=String((m&&m.text)||'');
  return '[语音]'+t+(m&&m.trans?'（中文：'+m.trans+'）':'');}
function phSmsLineText(m){return m&&m.voice?phSmsVoiceLine(m):(m&&m.img?phSmsImgLine(m):(m&&m.text)||'');}
function phReceiveSms(num,text,c,sk){if(phState().blocked[phNorm(num)])return;num=phDigits(num);sk=sk||num;
  /* 只有真角色那条线认语音标签：陌生号那边压根没拿到这个用法 */
  const vt=c&&typeof parseVoiceTagLine==='function'?parseVoiceTagLine(phCleanSmsText(text)):null;
  const tag=vt?null:phFxParseTags(phCleanSmsText(text));
  if(!vt){text=tag.text.slice(0,240);if(!text)return;}
  const viewing=cur().p==='phonesms'&&cur().num===num&&(cur().sk||num)===sk,arr=phSmsArr(num,sk);
  const m={id:uid(),from:'them',text,time:Date.now(),read:viewing};
  if(vt){
    const say=[...String(vt.text||'')].slice(0,VOICE_MAX_CHARS).join('').trim();
    if(!say)return;
    /* 复用微信那一套：type/role/content 都按微信语音消息的形状存，
       warmVoiceMsg、speakMsg、refreshVoiceBubble 就能原样拿来用 */
    m.voice=1;m.type='voice';m.role='assistant';m.content=say;m.text=say;
    const _vx=typeof NorthVoiceExpressive!=='undefined'?NorthVoiceExpressive.split(say):null,_say=_vx?_vx.text:say;if(_vx){m.content=_say;m.text=_say;m.voicePerf=_vx.perf;m.voiceSpatial=_vx.spatial;}
    m.trans=String(vt.trans||'').trim();
    if(vt.cue)m.voiceCue=vt.cue;
    m.dur=voiceEstimatedSeconds(say);if(_vx)m.dur=voiceEstimatedSeconds(_say);
    m.showText=false;
  }
  else{if(tag.fx)m.fx=tag.fx;if(tag.bfx)m.bfx=tag.bfx;if(tag.sfx)m.sfx=tag.sfx;}
  arr.push(m);if(arr.length>300)arr.splice(0,arr.length-300);
  /* 镜像进微信的还是干净正文，标签和效果都不带过去 */
  phMirrorSMS(num,'them',m.voice?(m.text+(m.trans?'（'+m.trans+'）':'')):text);save();phSound('sms');
  if(m.voice&&c&&ttsApiOn(c)){m._ttsLoading=true;scheduleVoiceWarm(m,c,voiceProgressiveOn());}
  if(!viewing)phSmsNotify(num,m.voice?'给你发来一条语音':text,c);
  if(viewing){render();if(phMsgHasFx(m))setTimeout(()=>phFxPlay(m,$('#smsbody')),140);}
  return m;}
/* 点一下语音条就放；放过一次就把文字（和外语的中文翻译）留在下面 */
function phVoiceTap(num,mid,sk){const arr=phSmsArr(num,sk),m=arr.find(x=>x&&x.id===mid);if(!m||!m.voice)return;
  const x=phFind(num),c=x&&x.kind==='role'?getC(x.id):null;
  try{audioUnlock();}catch(_){}
  if(typeof voiceTtsPending==='function'&&voiceTtsPending(m)){m._playWhenReady=true;refreshVoiceBubble(m);warmVoiceMsg(m,c);return;}
  voiceBarWant(mid);speakMsg(m,c);
  if(!m.showText){m.showText=true;save();render();}}
function phSmsMenu(num,mid,sk){const m=phSmsArr(num,sk).find(x=>x&&x.id===mid),bad=m&&m.img&&m.visionState!=='success';
  openModal(`<h3>短信操作</h3>${m&&m.img&&m.imgDesc?`<div class="hint" style="text-align:left">ta看到的画面：${esc(m.imgDesc)}</div>`:''}<div class="btns">${bad?`<button class="btn imblue" onclick="phSmsRetryVision('${esc(num)}','${mid}','${esc(sk||'')}')">重新看这张图</button>`:''}<button class="btn d" onclick="phDeleteSms('${esc(num)}','${mid}','${esc(sk||'')}')">删除这条</button><button class="btn g" onclick="closeModal()">取消</button></div>`);}
function phDeleteSms(num,mid,sk){const a=phSmsArr(num,sk),i=a.findIndex(m=>m.id===mid);if(i>=0)a.splice(i,1);save();closeModal();render();}
function phClearHiddenCallMemory(){const p=phState();p.trash=[];(p.voicemail||[]).forEach(clearVoiceAudio);p.voicemail=[];_phAliasFollowups={};Object.keys(p.aliasThreads||{}).forEach(k=>{const t=p.aliasThreads[k]||{};if(t.kind==='call'||t.kind==='spoofCall'||t.kind==='phonecall')delete p.aliasThreads[k];});(S.contacts||[]).forEach(c=>{delete c.phoneSpoofHistory;delete c.phoneAliasCallHistory;});if(S.spy)Object.keys(S.spy).forEach(id=>{const sp=S.spy[id];if(sp&&Array.isArray(sp.calls))sp.calls=sp.calls.filter(x=>x&&x.type==='短信');});}
function phClearHiddenSmsMemory(){const p=phState();_phAliasFollowups={};Object.keys(p.aliasThreads||{}).forEach(k=>{const t=p.aliasThreads[k]||{};if(t.kind==='sms'||t.kind==='spoofSms'||t.kind==='spoofCall'||t.asStranger)delete p.aliasThreads[k];});(S.contacts||[]).forEach(c=>{delete c.phoneSpoofSmsHistory;delete c.phoneAliasHistory;});if(S.spy)Object.keys(S.spy).forEach(id=>{const sp=S.spy[id];if(sp&&Array.isArray(sp.calls))sp.calls=sp.calls.filter(x=>x&&x.type!=='短信');});}
async function phClearAll(kind){const p=phState();if(kind==='recents'){if(await uiConfirm('清空全部通话记录？\n会同时清除电话文字回收箱、语音留言，以及角色关于这些电话的隐藏记忆。')){p.recents=[];phClearHiddenCallMemory();save();render();toast('通话记录和通话记忆已清空');}}else if(kind==='sms'){if(await uiConfirm('清空全部短信？\n会同时清除陌生短信线程和角色关于这些短信的隐藏记录。')){p.sms={};p.read={};phClearHiddenSmsMemory();save();render();toast('短信和陌生短信记忆已清空');}}else if(kind==='vm'){if(await uiConfirm('清空全部语音留言？')){(p.voicemail||[]).forEach(clearVoiceAudio);p.voicemail=[];save();render();}}}
function phTrashPreview(r){return (r.lines||[]).slice(-2).map(x=>(x.from==='me'?S.me.name:(r.name||'对方'))+'：'+String(x.text||'').replace(/\n/g,' ').slice(0,64)).join(' / ');}
function phTrashModal(){const p=phState(),arr=(p.trash||[]).slice().reverse();openModal(`<h3>电话文字回收箱</h3><div class="hint">通话全文会收进这里，像电话档案一样保存。点开卡片可以看完整逐句内容。</div><div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">${arr.length?arr.map(r=>`<div onclick="phTrashOpen('${r.id}')" style="position:relative;padding:14px 14px 13px;border:1px solid #34343a;background:linear-gradient(145deg,#202024,#121214);border-radius:12px;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);cursor:pointer;overflow:hidden"><div style="position:absolute;right:12px;top:10px;color:#5a5a61;font-size:10px;letter-spacing:.18em">CALL ARCHIVE</div><div style="display:flex;gap:12px;align-items:flex-start"><div style="width:42px;height:42px;border-radius:11px;border:1px solid #4a4a52;background:#17171a;display:flex;align-items:center;justify-content:center;flex:0 0 auto">${svgIc('phonecall',21,'#d8d8df',1.55)}</div><div style="flex:1;min-width:0;padding-right:18px"><div style="font-size:15px;font-weight:700;color:#f2f2f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name||phFmt(r.num))}</div><div style="margin-top:4px;color:#8d8d95;font-size:11px;line-height:1.45">${fmtDT(r.started)} · ${r.dur?phDur(r.dur):'未接通'} · ${esc(r.region||'未知')}</div><div style="margin-top:8px;color:#c9c9cf;font-size:12px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(phTrashPreview(r)||'没有文字内容')}</div></div><button onclick="event.stopPropagation();phTrashDel('${r.id}')" style="border:0;background:transparent;color:#fa5151;font-size:18px;line-height:1;padding:2px 0;cursor:pointer">×</button></div></div>`).join(''):'<div class="empty">还没有电话文字记录</div>'}</div><div class="btns"><button class="btn d" onclick="phTrashClear()">清空</button><button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function phTrashOpen(id){const p=phState(),r=(p.trash||[]).find(x=>x.id===id);if(!r){phTrashModal();return;}const lines=(r.lines||[]).map(x=>{const me=x.from==='me',who=me?S.me.name:(r.name||'对方');return `<div style="padding:11px 0;border-bottom:1px solid rgba(255,255,255,.06)"><div style="display:flex;justify-content:space-between;gap:10px;color:${me?'#8fbaff':'#d8d8df'};font-size:12px;font-weight:700"><span>${esc(who)}</span><span style="color:#777;font-weight:400">${x.time?hm(x.time):''}</span></div><div style="margin-top:6px;color:#f1f1f4;font-size:14px;line-height:1.65;white-space:pre-wrap">${esc(x.text||'')}</div></div>`;}).join('');openModal(`<h3>通话档案</h3><div style="border:1px solid #34343a;background:linear-gradient(145deg,#1f1f24,#111113);border-radius:14px;padding:16px;margin-top:8px"><div style="display:flex;align-items:center;gap:12px">${svgIc('phonecall',24,'#d8d8df',1.6)}<div style="flex:1;min-width:0"><div style="font-size:18px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name||phFmt(r.num))}</div><div style="color:#8f8f98;font-size:12px;margin-top:4px">${esc(phFmt(r.num))} · ${esc(r.region||'未知')} · ${fmtDT(r.started)}</div></div></div><div style="display:flex;gap:8px;margin-top:14px;color:#aaa;font-size:11px"><span style="border:1px solid #3b3b42;border-radius:999px;padding:4px 9px">${r.dir==='in'?'接入':'拨出'}</span><span style="border:1px solid #3b3b42;border-radius:999px;padding:4px 9px">${r.dur?phDur(r.dur):'未接通'}</span><span style="border:1px solid #3b3b42;border-radius:999px;padding:4px 9px">${esc(r.reason||'archive')}</span></div><div style="margin-top:14px">${lines||'<div class="empty">没有文字内容</div>'}</div></div><div class="btns"><button class="btn g" onclick="phTrashModal()">返回</button><button class="btn d" onclick="phTrashDel('${r.id}')">删除</button><button class="btn p" onclick="closeModal()">收好</button></div>`);}
async function phTrashDel(id){const p=phState();p.trash=(p.trash||[]).filter(x=>x.id!==id);save();phTrashModal();}
async function phTrashClear(){if(!await uiConfirm('清空电话文字回收箱？'))return;phState().trash=[];save();phTrashModal();}
function phMore(){const tab=phState().tab;openModal(`<h3>电话</h3><div class="section"><div class="it" onclick="phEditContact('')"><span>新建联系人</span><span class="v">›</span></div><div class="it" onclick="closeModal();phNewSms()"><span>新信息</span><span class="v">›</span></div><div class="it" onclick="phAliasModal()"><span>匿名号设置</span><span class="v">${esc(phFmt(phMyAliasNumber()))} ›</span></div><div class="it" onclick="phStrangerSettings()"><span>陌生互动设置</span><span class="v">›</span></div><div class="it" onclick="phTrashModal()"><span>电话文字回收箱</span><span class="v">${(phState().trash||[]).length} ›</span></div><div class="it danger" onclick="phClearAll('recents');closeModal()"><span>清空通话记录</span><span class="v">›</span></div><div class="it danger" onclick="phClearAll('sms');closeModal()"><span>清空全部短信</span><span class="v">›</span></div><div class="it danger" onclick="phClearAll('vm');closeModal()"><span>清空语音留言</span><span class="v">›</span></div></div>`);}
function phAliasModal(){const p=phState(),line=p.line==='alias'?'alias':'main',num=phMyAliasNumber();openModal(`<h3>匿名号</h3><div class="hint">切到匿名号后，回到拨号键盘手动输入角色的真实电话，或在短信里用匿名号发给角色。角色只会看到下面这个陌生号码，除非你自己暴露。</div><div class="section"><div class="it"><span>当前身份</span><span class="v">${phLineLabel(line)}</span></div><div class="it"><span>匿名号码</span><span class="v">${esc(phFmt(num))}</span></div><div class="it" onclick="phSetLine('alias');closeModal()"><span>切换到匿名号</span><span class="v">›</span></div><div class="it" onclick="phSetLine('main');closeModal()"><span>切换到主号</span><span class="v">›</span></div><div class="it" onclick="phAliasReset()"><span>换一个匿名号</span><span class="v">›</span></div></div><div class="btns"><button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function phAliasReset(){const p=phState();p.aliasNum=phRandomNumber();save();phAliasModal();toast('匿名号已更换');}
function phAliasNumber(cid){let n=phRandomNumber(),p=phState();const used=()=>Object.keys(p.aliasThreads||{}).some(k=>k===n||((p.aliasThreads[k]||{}).aliasNum===n));for(let i=0;i<8&&used();i++)n=phRandomNumber();return n;}
async function phRoleAliasReply(cid,num,text,aliasNum,sk){const c=getC(cid);if(!c||c.blocked)return;const p=phState(),thread=p.aliasThreads&&p.aliasThreads[num];aliasNum=phDigits(aliasNum||(thread&&thread.aliasNum)||phAliasNumber(cid));sk=sk||phSmsKey(num,'alias',aliasNum);if(phAliasBlocked(thread,aliasNum)){toast('对方已拉黑这个陌生身份');return;}c.phoneAliasHistory=Array.isArray(c.phoneAliasHistory)?c.phoneAliasHistory:[];c.phoneAliasHistory.unshift({ts:Date.now(),num:aliasNum,targetNum:num,text:text.slice(0,180),from:'stranger'});c.phoneAliasHistory=c.phoneAliasHistory.slice(0,10);let raw='';try{const sys=buildSystem(c)+'\n\n# 当前场景：陌生号码短信\n你本人是「'+(c.remark||c.name)+'」，你的真实电话是 '+phFmt(num)+'。现在有一个陌生号码 '+phFmt(aliasNum)+' 给你的手机发短信；这个陌生号码不是你的号码，也不是系统随机角色。\n你不知道发短信的人是不是'+S.me.name+'，除非短信内容自己暴露；但你仍然完整记得自己的身份、人设、关系和记忆，知道'+S.me.name+'在你设定里是谁（例如恋人/女朋友/重要的人），也知道自己是谁。别人问“你是不是'+(c.remark||c.name)+' / 认不认识'+(c.remark||c.name)+'”时，不能说不认识自己；你可以警惕地反问对方为什么知道你，或承认“我是”。\n按你的人设把对方当陌生号码回应，短句，真实短信感。若你已经确定/猜到这个陌生号码其实就是'+S.me.name+'，在回复里单独加一行隐藏指令 [识破]，系统会让你一分钟后用微信去找ta。若你觉得对方骚扰、诈骗、冒犯或不想继续，可以只输出隐藏指令 [拉黑]；想结束但不拉黑可输出 [挂断]。可先回一句再加隐藏指令。'+phAliasRevealPrompt(c)+phFxTagHelp();raw=await chatAPI([{role:'system',content:sys},{role:'user',content:'陌生号码 '+phFmt(aliasNum)+' 说：'+text}],{max:200,temp:.8});}catch(e){}
  let action=phDecisionFromRaw(raw,text);let r=phCleanSmsText(cleanReply(phStripDecisionTags(raw)||'')).slice(0,180);const arr=phSmsArr(num,sk),viewing=cur().p==='phonesms'&&cur().num===num&&(cur().sk||num)===sk,exposed=phAliasExposed(raw,text,c),meN=arr.filter(m=>m&&m.from==='me').length;if(exposed)r=phSmsAdmitLine(r,c);if(!exposed&&phIdentityAskText(r)&&phIdentityAskCount(arr)>=2)r=phAliasQuestionFallback(text+':sms');if(!exposed&&phTooSimilarReply(r,arr))r=phAliasPushback(arr,text);if(!exposed&&meN>=6&&!action){action='block';r=phAliasPushback(arr,text);}if(!r&&!action)r=exposed?phAdmitFallback(c,'sms'):phAliasQuestionFallback(text);r=phCleanSmsText(r).slice(0,180);if(r){arr.push({id:uid(),from:'them',text:r,time:Date.now(),read:viewing,aliasFrom:cid,aliasNum});c.phoneAliasHistory.unshift({ts:Date.now(),num:aliasNum,targetNum:num,text:r.slice(0,180),from:'role',exposed});}if(exposed)phAliasExposeRole(cid,num,'sms',text);if(action==='block'){p.aliasThreads[num]=Object.assign({},thread||{}, {cid,name:c.remark||c.name,kind:'sms',asStranger:true,aliasNum,targetNum:num,blocked:true,blockedAt:Date.now()});arr.push({id:uid(),from:'them',text:'对方已拉黑此陌生号码。',time:Date.now(),read:viewing,aliasFrom:cid,aliasNum,sys:true});c.phoneAliasHistory.unshift({ts:Date.now(),num:aliasNum,targetNum:num,text:'已拉黑此陌生号码',from:'role'});}else if(action==='hangup'){arr.push({id:uid(),from:'them',text:'对方已结束陌生短信对话。',time:Date.now(),read:viewing,aliasFrom:cid,aliasNum,sys:true});}c.phoneAliasHistory=c.phoneAliasHistory.slice(0,12);save();if(r)phSound('sms');if(viewing)render();}
async function phRoleSpoofSmsReply(cid,num,text){const c=getC(cid);if(!c||c.blocked)return;num=phDigits(num);const p=phState(),thread=p.aliasThreads&&p.aliasThreads[num]||{},goal=phSpoofGoal(num+':'+cid,thread.spoofGoal);c.phoneSpoofSmsHistory=Array.isArray(c.phoneSpoofSmsHistory)?c.phoneSpoofSmsHistory:[];c.phoneSpoofSmsHistory.unshift({ts:Date.now(),num,text:text.slice(0,180),from:'user_to_spoof'});phPushSpoofSmsCtx(c,num,'me',text);let raw='';try{const hist=phSmsArr(num,num).slice(-phCtxRows()).map(m=>(m.from==='me'?S.me.name:'陌生号码')+'：'+(m.img?phSmsImgLine(m):m.text)).join('\n'),stage=phSpoofStage(phSmsArr(num,num)),sys=buildSystem(c)+'\n\n# 当前场景：你用陌生号码给'+S.me.name+'发短信\n你本人就是「'+(c.remark||c.name)+'」，完整记得自己的身份、人设、关系和记忆。【方向铁律】这条陌生短信线是你主动用陌生号码发给'+S.me.name+'，不是ta先发给你；你知道收信人就是'+S.me.name+'，只是隐藏你的身份。你清楚这是你在伪装成陌生号码，不是真陌生人，不是系统随机短信。'+S.me.name+'一开始不知道是你；你要隐藏身份，但短信里只能看文字，绝对不要说“声音不对/听起来/语音/声线”，也绝对不要说“你是谁/哪位/你发给我/发错了/认错人/找错人/弄错人/误会了/不认识/不是本人”。\n本次隐藏目的：'+(thread.spoofGoalHint||goal.hint)+'\n当前推进：'+stage+'\n每次回复都要沿隐藏目的向前推进一点，像真实短信一样一步步来；前两轮不能直说目的，不能突然摊牌。对方反问、拒绝或试探时，不要没头没尾重复问是谁，要换角度推进；不要因为轮数多就自动结束，除非对方持续辱骂、诈骗、真实骚扰或你明确决定拉黑。\n对方问“你是谁”时不要反复说打错、认错人或找错人；可以装傻、反问、逗ta、试探。只有当对方明确叫出你的真实名字/备注、直接说“我知道是你/别装了/是不是你”并带身份线索、说出专属称呼或共同经历时，才可以承认并单独加隐藏指令 [识破]；普通拒绝、说有男朋友、说不回陌生人、要求你先回答，都不算识破，必须继续隐藏。'+phAliasRevealPrompt(c)+phFxTagHelp();raw=await chatAPI([{role:'system',content:sys},{role:'user',content:'方向记录：这是你主动用陌生号码发给'+S.me.name+'，不是ta先发给你；下面“'+S.me.name+'”的发言是收信人回复。\n短信记录：\n'+hist+'\n\n'+S.me.name+'刚发：'+text}],{max:230,temp:.86});}catch(e){}
  let action=phDecisionFromRaw(raw,text);const arr=phSmsArr(num,num),style=phSpoofSmsStyle(num+':'+cid,thread.spoofSmsStyle||thread.spoofStyle);let r=phSpoofSmsPolish(phStripDecisionTags(raw)||'',style,num+':reply:'+Date.now(),'reply');const exposed=phSpoofExposed(raw,text,c);if(exposed)r=phSmsAdmitLine(r,c);if(!exposed&&phIdentityAskText(r)&&phIdentityAskCount(arr)>=2)r=phSpoofSmsAdvance(style,num+':ask:'+Date.now());if(!exposed&&phTooSimilarReply(r,arr))r=phSpoofSmsAdvance(style,num+':repeat:'+Date.now());if(!r&&!action)r=exposed?phAdmitFallback(c,'sms'):phSpoofSmsAdvance(style,num+':empty');r=phCleanSmsText(r).slice(0,180);if(action==='block'){p.aliasThreads[num]=Object.assign({},thread,{cid,name:c.remark||c.name,kind:'spoofSms',asStranger:true,spoof:true,blocked:true,blockedAt:Date.now(),spoofSmsStyle:style.key});r=r||'这个号码先停一下。';}c.phoneSpoofSmsHistory.unshift({ts:Date.now(),num,text:r.slice(0,180),from:'role_spoof',exposed});c.phoneSpoofSmsHistory=c.phoneSpoofSmsHistory.slice(0,24);if(r)phPushSpoofSmsCtx(c,num,'them',r);if(exposed)phSpoofExposeRole(cid,num,'sms',text);save();if(r)phReceiveSms(num,r,null);}
async function phRoleStrangerSms(cid,num,text,opt){const c=getC(cid);if(!phRoleStrangerAllowed(c,'sms'))return;opt=opt||{};num=phDigits(num||phRandomNumber());const seed=Date.now()+':'+Math.random()+':'+cid+':'+num,style=phRoleSpoofSmsStyle(c,seed,opt.styleKey),goal=phSpoofGoal(seed+':goal',opt.goalKey),p=phState();p.aliasThreads[num]={cid,name:c.remark||c.name,ts:Date.now(),kind:'spoofSms',asStranger:true,spoof:true,num,spoofSmsStyle:style.key,spoofGoal:goal.key,spoofGoalHint:goal.hint,smsRetryN:+opt.retryN||0,smsRetryUntil:opt.retryUntil||Date.now()+10*60000};if(!p.regions[phNorm(num)])p.regions[phNorm(num)]=phRegion(num);let r=(text||'').trim();if(!r)r=phRoleSpoofSmsOpen(c,style,goal,num);r=phCleanSmsText(r).slice(0,180);if(!r)r=phSpoofSmsFallback(style,seed,'open');c.phoneSpoofSmsHistory=Array.isArray(c.phoneSpoofSmsHistory)?c.phoneSpoofSmsHistory:[];c.phoneSpoofSmsHistory.unshift({ts:Date.now(),num,text:r.slice(0,180),from:'role_spoof',spoofGoal:goal.key});c.phoneSpoofSmsHistory=c.phoneSpoofSmsHistory.slice(0,24);phPushSpoofSmsCtx(c,num,'them',r);save();phReceiveSms(num,r,null);}
function phPickRole(kind){const list=phAllowedStrangerRoles(kind||'call');return list.length?list[Math.abs(phHash(Date.now()))%list.length]:null;}
function phChooseRoleForStranger(kind){const list=phAllowedStrangerRoles(kind==='sms'?'sms':'call');if(!list.length){toast('没有开启这个陌生互动的角色');return;}openModal(`<h3>${kind==='call'?'测试角色陌生来电':'测试角色陌生短信'}</h3><div class="hint">只会显示在角色资料里允许此类陌生互动的角色。</div><div class="section">${list.map(c=>`<div class="it" onclick="${kind==='call'?'phTestRoleStrangerCall':'phTestRoleStrangerSms'}('${c.id}')"><span>${esc(c.remark||c.name)}</span><span class="v">›</span></div>`).join('')}</div><button class="btn g" onclick="phStrangerSettings()">返回</button>`);}
function phTestRoleStrangerCall(id){const c=getC(id)||phPickRole('call');if(!c){toast('先添加角色');return;}if(!phRoleStrangerAllowed(c,'call')){toast('这个角色未开启陌生来电');return;}const num=phRandomNumber();closeModal();phIncomingStranger(num,phSpoofMetaForRole(c,num));}
function phTestRoleStrangerSms(id){const c=getC(id)||phPickRole('sms');if(!c){toast('先添加角色');return;}if(!phRoleStrangerAllowed(c,'sms')){toast('这个角色未开启陌生短信');return;}closeModal();toast('约5秒后发来陌生短信');setTimeout(()=>{try{const cc=getC(c.id);if(cc&&phRoleStrangerAllowed(cc,'sms'))phRoleStrangerSms(cc.id);}catch(_){}},4800+Math.random()*700);}
function phStrangerSettings(){const s=phState().stranger;openModal(`<h3>陌生互动</h3><div class="hint">陌生来电会使用小手机自己的铃声；微信/电话通话、游戏、角色扮演、线下约会、小黑屋、睡眠或报备中不会打扰。</div><div class="section"><div class="it"><span>开启陌生来电</span><span class="sw ${s.enabled?'on':''}" onclick="phStrangerToggle()"></span></div><div class="it"><span>来电间隔分钟<br><small style="color:#888">最低 10 分钟</small></span><input id="phsfreq" type="number" min="10" value="${s.freq||60}" style="width:78px;text-align:right;border:1px solid #38383a;border-radius:8px;padding:5px;background:#2c2c2e;color:#eee"></div><div class="it"><span>每天最多来电</span><input id="phsmax" type="number" min="0" max="12" value="${s.max==null?3:s.max}" style="width:78px;text-align:right;border:1px solid #38383a;border-radius:8px;padding:5px;background:#2c2c2e;color:#eee"></div><div class="it"><span>开启陌生短信</span><span class="sw ${s.smsEnabled?'on':''}" onclick="phStrangerSmsToggle()"></span></div><div class="it"><span>短信间隔分钟</span><input id="phssfreq" type="number" min="10" value="${s.smsFreq||90}" style="width:78px;text-align:right;border:1px solid #38383a;border-radius:8px;padding:5px;background:#2c2c2e;color:#eee"></div><div class="it"><span>每天最多短信</span><input id="phssmax" type="number" min="0" max="12" value="${s.smsMax==null?3:s.smsMax}" style="width:78px;text-align:right;border:1px solid #38383a;border-radius:8px;padding:5px;background:#2c2c2e;color:#eee"></div><div class="it" onclick="phIncomingStranger()"><span>模拟普通陌生来电</span><span class="v">›</span></div><div class="it" onclick="phChooseRoleForStranger('call')"><span>测试角色陌生来电</span><span class="v">›</span></div><div class="it" onclick="phChooseRoleForStranger('sms')"><span>测试角色陌生短信</span><span class="v">›</span></div></div><div class="btns"><button class="btn p" onclick="phStrangerSave()">保存</button><button class="btn g" onclick="closeModal()">关闭</button></div>`);}
function phStrangerToggle(){const s=phState().stranger;s.enabled=!s.enabled;if(s.enabled&&!s.nextAt)s.nextAt=Date.now()+Math.max(10,+s.freq||60)*60000;save();phStrangerSettings();}
function phStrangerSmsToggle(){const s=phState().stranger;s.smsEnabled=!s.smsEnabled;if(s.smsEnabled&&!s.smsNextAt)s.smsNextAt=Date.now()+Math.max(10,+s.smsFreq||90)*60000;save();phStrangerSettings();}
function phStrangerSave(){const s=phState().stranger;s.freq=Math.max(10,+($('#phsfreq')&&$('#phsfreq').value)||60);s.max=Math.max(0,Math.min(12,+($('#phsmax')&&$('#phsmax').value)||3));s.smsFreq=Math.max(10,+($('#phssfreq')&&$('#phssfreq').value)||90);s.smsMax=Math.max(0,Math.min(12,+($('#phssmax')&&$('#phssmax').value)||3));if(s.enabled)s.nextAt=Date.now()+s.freq*60000;if(s.smsEnabled)s.smsNextAt=Date.now()+s.smsFreq*60000;save();closeModal();toast('已保存陌生互动设置');}
function phCheckStranger(){try{if(!isMain())return;const p=phState(),s=p.stranger;if(!s.enabled)return;if(phStrangerQuietNow('call')){phPostponeStranger('call',2);return;}const today=new Date().toDateString();if(s.today!==today){s.today=today;s.n=0;}if((+s.max||0)<=0||s.n>=s.max)return;const now=Date.now();if(!s.nextAt)s.nextAt=now+Math.max(10,+s.freq||60)*60000;if(now<s.nextAt)return;s.n++;s.nextAt=now+Math.max(10,+s.freq||60)*60000*(.75+Math.random()*.7);save();const num=phRandomNumber(),pf=phMaybeSpoofMeta(num)||phStrangerProfile(num);phIncomingStranger(num,pf);}catch(_){}}
function phCheckStrangerSms(){try{if(!isMain())return;const p=phState(),s=p.stranger;if(!s.smsEnabled)return;if(phStrangerQuietNow('sms')){phPostponeStranger('sms',2);return;}const today=new Date().toDateString();if(s.smsToday!==today){s.smsToday=today;s.smsN=0;}if((+s.smsMax||0)<=0||s.smsN>=s.smsMax)return;const now=Date.now();if(!s.smsNextAt)s.smsNextAt=now+Math.max(10,+s.smsFreq||90)*60000;if(now<s.smsNextAt)return;s.smsN++;s.smsNextAt=now+Math.max(10,+s.smsFreq||90)*60000*(.75+Math.random()*.7);save();const role=phPickRole('sms');if(role&&Math.random()<.35)phRoleStrangerSms(role.id);else{const num=phRandomNumber(),pf=phStrangerProfile(num),text=phRandomSmsText(num,pf,now);phReceiveSms(num,text,null);}}catch(_){}}
//@@ web
setInterval(()=>{phCheckStranger();phCheckStrangerSms();},60000);setTimeout(()=>{phCheckStranger();phCheckStrangerSms();},15000);
//@@ private
setInterval(()=>northNativeBackgroundTask('phone-stranger',()=>{phCheckStranger();phCheckStrangerSms();}),60000);setTimeout(()=>northNativeBackgroundTask('phone-stranger',()=>{phCheckStranger();phCheckStrangerSms();}),15000);
//@@ end
function phActivity(since){const p=phState();since=since||0;let rows=[];(p.recents||[]).filter(r=>(r.time||0)>since).slice(-8).forEach(r=>{rows.push({t:r.time||0,text:factStamp(r.time||Date.now())+' '+(r.dir==='out'?'拨出给':'接到')+'「'+phName(r.num)+'」'+(r.kind==='video'?'视频':'电话')+(r.status==='missed'?'（未接）':r.status==='blocked'?'（已屏蔽）':r.status==='canceled'?'（已取消）':(r.dur?'（'+phDur(r.dur)+'）':''))+'，使用'+phLineLabel(r.line)+'，号码 '+phFmt(r.num)+'，地区 '+phRegion(r.num)});});Object.keys(p.sms||{}).forEach(k=>{const n=phSmsDisplayNum(k),ak=phSmsAliasNumFromKey(k),isA=phSmsIsAliasKey(k);(p.sms[k]||[]).filter(m=>(m.time||0)>since).slice(-6).forEach(m=>rows.push({t:m.time||0,text:factStamp(m.time||Date.now())+' 短信 '+(m.from==='me'?(isA?'匿名号('+phFmt(m.aliasNum||ak||p.aliasNum)+')':S.me.name):(isA?phName(n):phName(n)))+' 对 '+(m.from==='me'?phName(n):(isA?'匿名号('+phFmt(ak)+')':S.me.name))+'：'+(''+m.text).replace(/\n/g,' ').slice(0,60)}));});(p.voicemail||[]).filter(v=>(v.time||0)>since).slice(-5).forEach(v=>rows.push({t:v.time||0,text:factStamp(v.time||Date.now())+' 语音留言来自「'+phName(v.num)+'」：'+(''+(v.text||'未接来电')).slice(0,60)}));rows=rows.sort((a,b)=>(b.t||0)-(a.t||0)).slice(0,14).map(x=>x.text);return rows.length?'·她电话/短信里的真实记录：\n'+rows.map(x=>'  - '+x).join('\n')+'\n':'';}
function soupCfg(cid){gameHubModal(`<h3>海龟汤设置</h3>
  <div class="field"><label>类别</label><select id="sc_cat"><option>悬疑</option><option>恐怖</option><option>搞笑</option><option>温情</option><option>脑洞</option></select></div>
  <div class="field"><label>难度</label><select id="sc_dif"><option>简单</option><option selected>中等</option><option>烧脑</option></select></div>
  <div class="hint">玩的时候：说「公布答案」揭晓汤底，「换一题」换题，「结束」收工。</div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="soupStart('${cid}')">开始</button></div>`);}
function soupStart(cid){const cat=$('#sc_cat').value,dif=$('#sc_dif').value;closeModal();
  openGameSpace('soup',cid,'我们玩海龟汤：你出一个'+cat+'类、难度'+dif+'的谜题，先只描述表面情境（汤面），我用是非题来猜，你只回答「是 / 不是 / 无关」。我说「公布答案」你就揭晓汤底，「换一题」就换一道。先出题吧～','🐢 海龟汤·'+cat);}
function escapeCfg(cid){gameHubModal(`<h3>小黑屋</h3><div class="hint">你被困在上锁的小黑屋，达成你定的条件才能开门通关。规则你自己写～</div>
  <div class="field"><label>密室设定 / 开门规则</label><textarea id="esc_r" rows="4" placeholder="例如：屋里有一盏灯、一个保险箱、一张纸条。要找到密码打开保险箱拿到钥匙才能开门；密码藏在纸条的谜语里。"></textarea></div>
  <div class="btns"><button class="btn g" onclick="closeModal()">取消</button><button class="btn p" onclick="escStart('${cid}')">进入小黑屋</button></div>`);}
function escStart(cid){const r=$('#esc_r').value.trim()||'屋里有线索，需要解开谜题找到钥匙才能开门。';closeModal();
  openGameSpace('escape',cid,'你来当游戏主持人（GM）：我被困在一间上锁的小黑屋，'+r+' 门一开就通关。你描述场景、根据我每一步行动推进剧情，只有我真正达成开门条件时才宣布「🔓门开了，通关！」，否则不能放我出去。先描述一下场景吧～','🚪 小黑屋');}
/* ===== 你说我猜 ===== */
let _wg=null;
function wgCurrentRows(){if(!_wg)return[];const rows=[];if(_wg.desc)rows.push({who:'ta',name:(getC(_wg.cid)||{}).name||'角色',text:_wg.desc});if(_wg.myDesc)rows.push({who:'me',text:_wg.myDesc});(_wg.guesses||[]).forEach(g=>rows.push({who:g&&g.who==='ta'?'ta':'me',text:wgItemText(g)}));return rows;}
function wgArchiveRound(){if(!_wg||!_wg.word)return;const rows=wgCurrentRows();if(!rows.length)return;_wg.history=(_wg.history||[]).concat(rows).slice(-160);}
function startWG(cid){_wg={cid,round:1,score:{me:0,ta:0},phase:'idle',word:'',desc:'',myDesc:'',guesses:[],history:[],t:0,showWord:false};go('wg');wgRound('ai');}
async function wgRound(who){if(!_wg)return;wgArchiveRound();const c=getC(_wg.cid);_wg.phase='loading';_wg.who=who;_wg.guesses=[];_wg.word='';_wg.desc='';_wg.myDesc='';wgRender();
  try{if(who==='ai'){const r=await chatAPI([{role:'system',content:'你在玩"你描述我猜词"。请你选一个常见、好描述的中文词语(2到4个字)，然后用一两句话描述它但绝对不能出现这个词或它包含的任何一个字。严格用格式：词语:::字数:::描述。只输出这一行。'},{role:'user',content:'出一个词来描述'}],{max:200});
    const p=(r||'').split(/:::|：：：/).map(x=>x.trim());_wg.word=p[0]||'苹果';_wg.len=_wg.word.length;_wg.desc=p[2]||p[1]||'一种东西';
  }else{const r=await chatAPI([{role:'system',content:'给我一个适合"描述猜词"游戏的常见中文词语(2到4个字)，只输出这个词，别的不要。'},{role:'user',content:'出一个词'}],{max:30});_wg.word=(r||'').replace(/[^一-龥A-Za-z]/g,'').slice(0,4)||'西瓜';_wg.len=_wg.word.length;}
  if(!_wg||cur().p!=='wg')return;
  _wg.phase=who==='ai'?'meGuess':'meDesc';_wg.showWord=false;wgStartTimer(40);wgRender();
  }catch(e){if(_wg)_wg.phase='error';wgRender();}}
function wgRetry(){if(_wg)wgRound(_wg.who||'ai');}
function wgStartTimer(sec){if(!_wg)return;clearInterval(_wg._tm);_wg.t=sec;const tm=setInterval(()=>{if(!_wg||cur().p!=='wg'){clearInterval(tm);return;}_wg.t--;const e=document.getElementById('wgtime');if(e)e.textContent=_wg.t+'s';if(_wg.t<=0){clearInterval(tm);wgTimeout();}},1000);_wg._tm=tm;}
function wgTimeout(){if(!_wg)return;const c=getC(_wg.cid);if(_wg.who==='ai'){_wg.score.ta++;toast('超时，没猜出来！答案：'+_wg.word);}else{_wg.score.me++;toast('超时，ta没猜出来');}_wg.round++;wgRound(_wg.who==='ai'?'me':'ai');}
function wgItemText(x){return typeof x==='string'?x:String(x&&x.text||'');}
function wgItemId(x,i){return typeof x==='object'&&x&&x.id?x.id:'wg_'+i;}
function wgMsgMenu(kind,id){if(!_wg)return;let text='';if(kind==='desc')text=_wg.desc||'';else if(kind==='mydesc')text=_wg.myDesc||'';else{const i=(_wg.guesses||[]).findIndex((x,n)=>wgItemId(x,n)===id);if(i>=0)text=wgItemText(_wg.guesses[i]);}if(!text)return;openModal(`<h3>编辑 / 删除</h3><div class="field"><textarea id="wg_e" rows="3">${esc(text)}</textarea></div><div class="btns"><button class="btn d" onclick="wgDelMsg('${kind}','${id}')">删除</button><button class="btn p" onclick="wgEditMsg('${kind}','${id}')">保存</button></div><button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function wgEditMsg(kind,id){if(!_wg)return;const v=(($('#wg_e')||{}).value||'').trim();if(!v)return;if(kind==='desc')_wg.desc=v;else if(kind==='mydesc')_wg.myDesc=v;else{const i=(_wg.guesses||[]).findIndex((x,n)=>wgItemId(x,n)===id);if(i>=0)_wg.guesses[i]={id,who:_wg.guesses[i]&&_wg.guesses[i].who||'',text:v};}closeModal();wgRender();}
function wgDelMsg(kind,id){if(!_wg)return;if(kind==='desc')_wg.desc='';else if(kind==='mydesc')_wg.myDesc='';else _wg.guesses=(_wg.guesses||[]).filter((x,n)=>wgItemId(x,n)!==id);closeModal();wgRender();}
function renderWG(){if(!_wg)return '';const c=getC(_wg.cid);
  let mid='';
  if(_wg.phase==='loading')mid='<div class="empty" style="padding:40px">出题中…</div>';
  else if(_wg.phase==='error')mid=`<div class="empty" style="padding:36px;line-height:1.8">出题失败了😣<br>可能是网络或接口不稳<div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="btn p" style="max-width:120px" onclick="wgRetry()">重新出题</button><button class="btn g" style="max-width:120px" onclick="wgQuit()">退出</button></div></div>`;
  else if(_wg.phase==='meGuess')mid=`<div style="text-align:center;padding:14px"><div style="color:#888;font-size:13px">${esc(c?c.name:'ta')} 描述（${_wg.len}个字）</div><div onclick="wgMsgMenu('desc','desc')" style="font-size:17px;color:#eee;margin:10px 0;line-height:1.6;cursor:pointer">「${esc(_wg.desc)}」</div><div style="font-size:13px;color:#888">你来猜👇</div></div>${_wg.guesses.map((g,i)=>`<div onclick="wgMsgMenu('guess','${wgItemId(g,i)}')" style="text-align:center;color:#aaa;font-size:14px;cursor:pointer">${esc(wgItemText(g))} ❌</div>`).join('')}`;
  else if(_wg.phase==='meDesc'){const show=!!_wg.showWord;mid=`<div style="text-align:center;padding:14px"><div style="color:#888;font-size:13px">轮到你描述这个词（${esc(c?c.name:'ta')}来猜）：</div><div onclick="wgToggleWord()" style="display:inline-block;min-width:120px;margin:10px 0;padding:10px 16px;border-radius:14px;background:#20242d;color:${show?'#ffd6e8':'#bfc6d2'};font-size:${show?'24':'18'}px;font-weight:800;letter-spacing:${show?'0':'4px'};cursor:pointer">${show?esc(_wg.word):'••••'}</div><div style="font-size:12px;color:#888">点词卡查看/隐藏，描述时别说出这个字～</div>${_wg.myDesc?`<div onclick="wgMsgMenu('mydesc','mydesc')" style="font-size:14px;color:#d9dce3;margin-top:10px;cursor:pointer">我描述：${esc(_wg.myDesc)}</div>`:''}</div>${_wg.guesses.map((g,i)=>`<div onclick="wgMsgMenu('guess','${wgItemId(g,i)}')" style="text-align:center;color:#9ec5fe;font-size:14px;cursor:pointer">ta猜：${esc(wgItemText(g))} <span onclick="event.stopPropagation();wgJudge(true)" style="color:#2bd66a;cursor:pointer">对✓</span> <span onclick="event.stopPropagation();wgJudge(false)" style="color:#fa5151;cursor:pointer">错✗</span></div>`).join('')}`;}
  return `<div class="nav"><span class="l" onclick="wgQuit()">‹</span><span class="t">🤐 你说我猜 <span id="wgtime" style="color:#fa5151">${_wg.t}s</span></span><span class="r">你${_wg.score.me}:${_wg.score.ta}ta</span></div>
    <div class="scroll" style="background:#000">${mid}</div>
    <div class="inputbar"><textarea id="wg_in" rows="1" placeholder="${_wg.phase==='meGuess'?'输入你猜的词…':_wg.phase==='meDesc'?'描述这个词…':'…'}"></textarea><button class="send" onclick="wgInput()">${_wg.phase==='meGuess'?'猜':'发'}</button></div>`;}
