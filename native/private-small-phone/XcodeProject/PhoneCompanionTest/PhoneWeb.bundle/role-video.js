/* ROLE_VIDEO_V1（2026-11-02 她要的彩蛋）：她在微信里说「我在你眼中是什么样子的」「拍一个我在你眼中的样子」这类话，
   角色就给她拍一部「我眼中的你」竖屏小视频，1～3 分钟，长短角色自己定。片名五个字固定，其余全由角色写：
   程序先把从认识第一天到今天的聊天按月份整理好、准确数字数好（谁说了多少条、在一起多少天、说了几次「我爱你」），
   角色照着「镜头清单」写剧本（JSON），程序检查（只能用真实数字、她的原话），再用角色的声音配旁白，
   聊天里出现一张没有包边的视频卡片，显示做到百分之几；做不成就在卡片上写原因、给一个重试。点开全屏播放。
   镜头、音效、配乐都是代码画出来、合成出来的，没有素材文件。网页版和私人版用同一份文件。
   视角：角色自称「我」；画面里角色的消息在右边，她的在左边。 */
(function(){'use strict';
if(typeof window==='undefined'||window.RoleVideo)return;
const TAU=Math.PI*2, cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)), eo=x=>1-Math.pow(1-cl(x),3), eio=x=>{x=cl(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2};
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const SERIF='"Songti SC","STSong","Noto Serif SC",serif', SANS='"PingFang SC","Hiragino Sans GB","Noto Sans SC",sans-serif';
function sky(c,w,h,stops){const g=c.createLinearGradient(0,0,0,h);stops.forEach((s,i)=>g.addColorStop(i/(stops.length-1),s));c.fillStyle=g;c.fillRect(0,0,w,h)}
function glow(c,x,y,r,col,a){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col.replace('A',a));g.addColorStop(1,col.replace('A',0));c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,TAU);c.fill()}
function parts(n,seed,f){const R=rng(seed);return Array.from({length:n},()=>f(R))}
function txt(c,s,x,y,size,o={}){c.save();c.globalAlpha=o.a??1;c.fillStyle=o.color||'#fff';c.font=(o.weight||400)+' '+size+'px '+(o.font||SANS);c.textAlign=o.align||'center';c.textBaseline='middle';if(o.ls)c.letterSpacing=o.ls+'px';if(o.shadow){c.shadowColor='rgba(0,0,0,.6)';c.shadowBlur=size*.4}c.fillText(s,x,y);c.restore()}
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h)}
const night=(c,w,h)=>sky(c,w,h,['#0d0f1c','#141629','#0a0a12']);

/* ---------- 氛围特效：draw(c,w,h,t)，u = h/1000 是尺寸单位 ---------- */
const A=[
 {n:'细雪',d:'细小的雪粒慢慢落，安静。',p:parts(160,1,R=>({x:R(),y:R(),s:.4+R()*.9,r:.6+R()*1.6,ph:R()*TAU})),
  draw(c,w,h,t,o){o=o||{};const u=h/1000;sky(c,w,h,['#1a2030','#2a3142','#151821']);this.p.forEach(p=>{const y=((p.y+t*.03*p.s)%1)*h,x=(p.x+Math.sin(t*.6+p.ph)*.015)*w;c.globalAlpha=.4+.5*p.s;c.fillStyle='#fff';c.beginPath();c.arc(x,y,p.r*u,0,TAU);c.fill()});c.globalAlpha=1}},
 {n:'大雪慢落',d:'近处的雪花大而虚，远处的小而清，有景深。',p:parts(70,2,R=>({x:R(),y:R(),z:R(),ph:R()*TAU})),
  draw(c,w,h,t,o){o=o||{};const u=h/1000;sky(c,w,h,['#20283a','#39435a','#1b2130']);[...this.p].sort((a,b)=>a.z-b.z).forEach(p=>{const r=(1.2+p.z*p.z*9)*u,y=((p.y+t*(.01+p.z*.035))%1.1-.05)*h,x=(p.x+Math.sin(t*.4+p.ph)*.03*p.z)*w;glow(c,x,y,r*(p.z>.7?2.2:1.3),'rgba(255,255,255,A)',p.z>.7?.35:.85)})}},
 {n:'细雨',d:'远近三层细雨，近的粗而快，落到地面溅起小水花。',p:parts(240,3,R=>({x:R(),y:R(),z:R()})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#0d1219','#17202b','#0b0f14']);const u=h/1000;this.p.forEach(p=>{const sp=.55+p.z*.9,yy=(p.y+t*sp)%1.08,y=yy*h,x=((p.x+yy*.07)%1)*w,l=(.012+p.z*.035)*h;c.strokeStyle='rgba(190,212,240,'+(.12+p.z*.35)+')';c.lineWidth=(.5+p.z*1.3)*u;c.beginPath();c.moveTo(x,y);c.lineTo(x-l*.22,y-l);c.stroke();if(p.z>.6&&yy>1.0){const k=(yy-1)/.08;c.strokeStyle='rgba(200,220,245,'+(1-k)*.5+')';c.beginPath();c.ellipse(x,h*.985,k*9*u*p.z,k*2.5*u,0,Math.PI,TAU);c.stroke()}});const g=c.createLinearGradient(0,h*.88,0,h);g.addColorStop(0,'rgba(120,140,170,0)');g.addColorStop(1,'rgba(120,140,170,.12)');c.fillStyle=g;c.fillRect(0,h*.88,w,h*.12)}},
 {n:'雨打玻璃',d:'玻璃上大大小小的水珠，有的慢慢滑下来留下水痕；后面是虚掉的冷色灯光。',L:parts(9,4,R=>({x:R(),y:R(),r:.02+R()*.045,a:.06+R()*.08})),D:parts(110,5,R=>({x:R(),y:R(),r:R(),v:R()<.22?.015+R()*.04:0,ph:R()})),M:parts(500,41,R=>({x:R(),y:R(),r:R()})),
  draw(c,w,h,t,o){o=o||{};const u=h/1000;sky(c,w,h,['#0a0d13','#121823','#090b10']);c.save();c.globalCompositeOperation='lighter';this.L.forEach(l=>glow(c,l.x*w,(.3+l.y*.65)*h,l.r*h,'rgba(190,210,240,A)',l.a));c.restore();
  c.fillStyle='rgba(255,255,255,.05)';this.M.forEach(m=>{c.beginPath();c.arc(m.x*w,m.y*h,(.4+m.r*.9)*u,0,TAU);c.fill()});
  this.D.forEach(d=>{const r=(1.5+d.r*d.r*7)*u,y=d.v?(((d.y+t*d.v+d.ph)%1.1)-.05)*h:d.y*h,x=d.x*w+(d.v?Math.sin(y/h*20+d.ph*9)*2*u:0);if(d.v){const g=c.createLinearGradient(0,y-r*14,0,y);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(220,230,250,.1)');c.fillStyle=g;c.fillRect(x-r*.35,y-r*14,r*.7,r*14)}
   const g=c.createRadialGradient(x,y+r*.25,r*.1,x,y,r);g.addColorStop(0,'rgba(210,225,248,.22)');g.addColorStop(.7,'rgba(150,170,200,.1)');g.addColorStop(.92,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(230,240,255,.25)');c.fillStyle=g;c.beginPath();c.ellipse(x,y,r,r*1.12,0,0,TAU);c.fill();c.fillStyle='rgba(255,255,255,.65)';c.beginPath();c.ellipse(x-r*.32,y-r*.38,r*.22,r*.14,-.6,0,TAU);c.fill();c.fillStyle='rgba(220,232,255,.22)';c.beginPath();c.ellipse(x+r*.1,y+r*.55,r*.5,r*.18,0,0,TAU);c.fill()})}},
 {n:'树影摇曳',d:'午后的光从窗户斜照在墙上，边缘柔和，树叶的影子在光里轻轻晃，安静不刺眼。',p:parts(60,51,R=>({x:.18+R()*.64,y:.25+R()*.45,r:.02+R()*.04,ph:R()*TAU,s:.5+R()})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#1c1815','#16130f','#0e0c0a']);const u=h/1000;c.save();c.globalCompositeOperation='lighter';for(let k=0;k<4;k++){const sh=k*6*u;c.save();c.translate(w*.5,h*.47);c.rotate(-.08);c.beginPath();c.rect(-w*.34-sh,-h*.22-sh,w*.68+sh*2,h*.44+sh*2);c.restore();c.fillStyle='rgba(255,210,150,'+(.05-k*.008)+')';c.fill()}c.restore();
  const g=c.createRadialGradient(w*.5,h*.47,h*.05,w*.5,h*.47,h*.38);g.addColorStop(0,'rgba(255,214,160,.10)');g.addColorStop(1,'rgba(255,214,160,0)');c.fillStyle=g;c.fillRect(0,0,w,h);
  const gust=Math.sin(t*.45)*.6+Math.sin(t*1.3)*.25;this.p.forEach(p=>{const x=(p.x+gust*.035*(.6+p.y)+Math.sin(t*1.1*p.s+p.ph)*.018)*w,y=(p.y+Math.cos(t*.9*p.s+p.ph)*.014+gust*.008)*h;c.save();c.translate(x,y);c.rotate(p.ph+Math.sin(t*.8+p.ph)*.5+gust*.3);c.scale(1.6,1);glow(c,0,0,p.r*h,'rgba(8,6,4,A)',.45);c.restore()});
  c.save();c.translate(w*.5,h*.47);c.rotate(-.08);c.fillStyle='rgba(10,8,6,.28)';c.fillRect(-w*.006,-h*.24,w*.012,h*.48);c.fillRect(-w*.36,-h*.004,w*.72,h*.008);c.restore();
  const v=c.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,h*.75);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.65)');c.fillStyle=v;c.fillRect(0,0,w,h)}},
 {n:'丁达尔光束',d:'光从左上的窗口斜照进暗房间，光柱边缘柔和、慢慢呼吸，浮尘只在光里看得见。',p:parts(140,7,R=>({x:R(),y:R(),z:R(),ph:R()*TAU})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#17130f','#100d0b','#0a0908']);const ox=-w*.15,oy=-h*.08,len=h*1.35,rays=[[.78,.07,0],[.9,.05,1.3],[1.0,.08,2.1],[1.13,.045,3.4],[1.24,.06,4.6]];c.save();c.globalCompositeOperation='lighter';
  rays.forEach(([a,wd,ph])=>{const br=.55+.45*Math.sin(t*.35+ph);for(let k=0;k<7;k++){const ww=wd*(.35+k*.22),g=c.createRadialGradient(ox,oy,0,ox,oy,len);g.addColorStop(0,'rgba(255,226,180,'+.06*br+')');g.addColorStop(.55,'rgba(255,214,160,'+.03*br+')');g.addColorStop(1,'rgba(255,214,160,0)');c.fillStyle=g;c.beginPath();c.moveTo(ox,oy);c.lineTo(ox+Math.cos(a-ww)*len,oy+Math.sin(a-ww)*len);c.lineTo(ox+Math.cos(a+ww)*len,oy+Math.sin(a+ww)*len);c.fill()}});
  this.p.forEach(p=>{const x=(p.x+Math.sin(t*.07+p.ph)*.05)*w,y=((p.y+t*.006*(p.z+.3))%1)*h,ang=Math.atan2(y-oy,x-ox);let lit=0;rays.forEach(([a,wd,ph])=>{lit=Math.max(lit,(1-cl(Math.abs(ang-a)/(wd*1.4)))*(.55+.45*Math.sin(t*.35+ph)))});if(lit<.05)return;c.fillStyle='rgba(255,236,200,'+lit*(.35+.4*Math.sin(t*1.7+p.ph))+')';c.beginPath();c.arc(x,y,(.6+p.z*1.4)*h/1000,0,TAU);c.fill()});c.restore()}},
 {n:'星空',d:'满天星星一闪一闪，斜着一条淡淡的银河，整片天慢慢转。',p:parts(320,8,R=>({a:R()*TAU,r:Math.sqrt(R())*1.2,s:R(),ph:R()*TAU})),M:parts(900,42,R=>({k:R(),o:(R()+R()+R()-1.5)*.09,s:R()})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#03040a','#080d1c','#10132a']);const rot=t*.006;c.save();c.translate(w/2,h/2);c.rotate(-.6+rot);for(let i=0;i<6;i++)glow(c,(i/5-.5)*h*1.1,0,h*.16,'rgba(150,170,230,A)',.05);this.M.forEach(m=>{c.fillStyle='rgba(220,230,255,'+(.15+m.s*.35)+')';c.fillRect((m.k-.5)*h*1.4,m.o*h,h/1500+m.s*h/1600,h/1500+m.s*h/1600)});c.restore();
  const cx=w*.5,cy=h*1.05;this.p.forEach(p=>{const a=p.a+t*.012,x=cx+Math.cos(a)*p.r*h,y=cy+Math.sin(a)*p.r*h;if(x<0||x>w||y<0||y>h)return;const tw=.55+.45*Math.sin(t*(1+p.s*2)+p.ph);c.globalAlpha=(.3+.7*p.s)*tw;c.fillStyle=p.s>.93?'#cfe0ff':'#fff';c.beginPath();c.arc(x,y,(.4+p.s*1.3)*h/900,0,TAU);c.fill();if(p.s>.95)glow(c,x,y,h/120,'rgba(200,220,255,A)',.4*tw)});c.globalAlpha=1}},
 {n:'流星',d:'安静的星空，隔一会儿划过一颗流星。',p:parts(140,9,R=>({x:R(),y:R()*.8,s:R(),ph:R()*TAU})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#04050b','#0b0f20','#16152a']);this.p.forEach(p=>{c.globalAlpha=(.25+.6*p.s)*(.6+.4*Math.sin(t*1.5+p.ph));c.fillStyle='#fff';c.beginPath();c.arc(p.x*w,p.y*h,(.4+p.s)*h/900,0,TAU);c.fill()});c.globalAlpha=1;for(let k=0;k<2;k++){const cyc=(t+k*2.7)%5.5,R=rng(Math.floor((t+k*2.7)/5.5)*7+k),x0=(.3+R()*.7)*w,y0=R()*.35*h;if(cyc<1.1){const p=cyc/1.1,len=h*.22,x=x0-p*w*.55,y=y0+p*w*.32,g=c.createLinearGradient(x,y,x+len*.86,y-len*.5);g.addColorStop(0,'rgba(255,255,255,'+(1-p)+')');g.addColorStop(1,'rgba(255,255,255,0)');c.strokeStyle=g;c.lineWidth=h/450;c.beginPath();c.moveTo(x,y);c.lineTo(x+len*.86,y-len*.5);c.stroke()}}}},
 {n:'萤火虫',d:'黑夜的草丛和远处树影，几点暖光忽明忽暗地游。',p:parts(28,10,R=>({x:R(),y:.35+R()*.55,ph:R()*TAU,f:.5+R()})),G:parts(140,52,R=>({x:R(),h:.04+R()*.1,b:(R()-.5)*.6,ph:R()*TAU})),
  draw(c,w,h,t,o){o=o||{};const u=h/1000;sky(c,w,h,['#000','#03060a','#020302']);c.fillStyle='#05080a';c.beginPath();c.moveTo(0,h*.62);for(let x=0;x<=w;x+=w/18)c.lineTo(x,h*(.58-.06*Math.abs(Math.sin(x/w*7))-.03*Math.sin(x/w*19)));c.lineTo(w,h);c.lineTo(0,h);c.fill();
  this.p.forEach(p=>{const x=(p.x+Math.sin(t*.25*p.f+p.ph)*.08)*w,y=(p.y+Math.cos(t*.2*p.f+p.ph*2)*.05)*h,a=.5+.5*Math.sin(t*1.6*p.f+p.ph);glow(c,x,y,h*.032,'rgba(220,255,140,A)',.55*a);c.fillStyle='rgba(240,255,190,'+a+')';c.beginPath();c.arc(x,y,h/450,0,TAU);c.fill()});
  c.strokeStyle='#020403';c.lineWidth=2.2*u;this.G.forEach(g=>{const x=g.x*w,top=h*(1-g.h),sw=Math.sin(t*.8+g.ph)*8*u;c.beginPath();c.moveTo(x,h);c.quadraticCurveTo(x+g.b*20*u,h-(h-top)*.5,x+g.b*40*u+sw,top);c.stroke()})}},
 {n:'樱花',d:'左上角伸出一枝樱花，花瓣带缺口打着转飘下来，远的小而虚。',p:parts(46,11,R=>({x:R(),y:R(),s:.5+R(),ph:R()*TAU,z:R()})),F:parts(60,53,R=>({k:R(),o:(R()-.5),r:R()})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#1d1419','#2a1c24','#120d10']);const u=h/1000,sw=Math.sin(t*.4)*.01;c.save();c.translate(0,0);c.rotate(sw);c.strokeStyle='#120a0d';c.lineCap='round';const br=(x0,y0,x1,y1,wd)=>{c.lineWidth=wd*u;c.beginPath();c.moveTo(x0,y0);c.quadraticCurveTo((x0+x1)/2,(y0+y1)/2+h*.03,x1,y1);c.stroke()};br(-w*.05,h*.02,w*.62,h*.2,12);br(w*.25,h*.1,w*.45,h*.28,6);br(w*.45,h*.17,w*.78,h*.12,5);br(w*.12,h*.06,w*.2,h*.22,5);
  this.F.forEach(f=>{const x=-w*.05+f.k*w*.8,y=h*.02+f.k*h*.17+f.o*h*.08+h*.03,r=(3+f.r*6)*u;c.fillStyle='rgba(255,'+(170+f.r*50)+','+(195+f.r*30)+','+(.55+f.r*.35)+')';c.beginPath();c.arc(x,y,r,0,TAU);c.fill()});c.restore();
  [...this.p].sort((a,b)=>a.z-b.z).forEach(p=>{const y=((p.y+t*(.03+p.z*.05))%1.1-.05)*h,x=(p.x+Math.sin(t*.5+p.ph)*.06+t*.012*(1+p.z))%1*w,sz=(4+p.z*10)*u;c.save();c.translate(x,y);c.rotate(t*p.s+p.ph);c.scale(1,Math.abs(Math.cos(t*1.1*p.s+p.ph))*.75+.25);c.globalAlpha=.35+p.z*.6;const g=c.createLinearGradient(0,-sz,0,sz);g.addColorStop(0,'#ffe6ee');g.addColorStop(1,'#f59ab8');c.fillStyle=g;c.beginPath();c.moveTo(0,sz);c.bezierCurveTo(sz*1.1,sz*.3,sz*.7,-sz*.9,sz*.22,-sz);c.lineTo(0,-sz*.7);c.lineTo(-sz*.22,-sz);c.bezierCurveTo(-sz*.7,-sz*.9,-sz*1.1,sz*.3,0,sz);c.fill();c.restore()})}},
 {n:'落叶',d:'右边一棵树的剪影，叶子带着叶脉慢慢翻着落下，地上已经积了一层。',p:parts(24,12,R=>({x:R()*.85,y:R(),s:.5+R(),ph:R()*TAU,z:R(),c:[['#e0a14a','#b8652a'],['#d77a3a','#9c3f22'],['#e8c060','#b88a2a'],['#b8502e','#7a2c1a']][Math.floor(R()*4)]})),P:parts(60,54,R=>({x:R(),r:R(),c:['#7a3d1c','#9c5a24','#6b3017','#a8702a'][Math.floor(R()*4)]})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#1e1610','#2c2018','#120d0a']);const u=h/1000;drawTree(c,w*.86,h*.94,h*.3,-Math.PI/2-.06,7,u,t);glow(c,w*.82,h*.15,h*.18,'rgba(160,80,30,A)',.35);c.fillStyle='#120c09';c.fillRect(0,h*.93,w,h*.07);this.P.forEach(q=>{c.fillStyle=q.c;c.beginPath();c.ellipse(q.x*w,h*.935+q.r*h*.02,(4+q.r*5)*u,(2+q.r*2)*u,q.r*3,0,TAU);c.fill()});
  [...this.p].sort((a,b)=>a.z-b.z).forEach(p=>{const y=((p.y+t*(.03+p.z*.04))%1.0)*h*.95,x=(p.x+Math.sin(t*.6+p.ph)*.07)*w,sz=(7+p.z*10)*u;c.save();c.translate(x,y);c.rotate(Math.sin(t*.9+p.ph)*1.3);c.scale(1,Math.abs(Math.cos(t*.8+p.ph))*.7+.3);c.globalAlpha=.45+p.z*.55;const g=c.createLinearGradient(-sz,0,sz,0);g.addColorStop(0,p.c[0]);g.addColorStop(1,p.c[1]);c.fillStyle=g;c.beginPath();c.moveTo(0,-sz*1.2);c.bezierCurveTo(sz*.9,-sz*.6,sz*.8,sz*.6,0,sz*1.2);c.bezierCurveTo(-sz*.8,sz*.6,-sz*.9,-sz*.6,0,-sz*1.2);c.fill();c.strokeStyle='rgba(60,25,10,.45)';c.lineWidth=.8*u;c.beginPath();c.moveTo(0,-sz*1.1);c.lineTo(0,sz*1.5);for(let i=-2;i<=2;i++){if(!i)continue;c.moveTo(0,i*sz*.3);c.lineTo(Math.sign(i)*sz*.5,i*sz*.3-sz*.3)}c.stroke();c.restore()})}},
 {n:'极光',d:'一片片竖着的光帘在天上飘动、变亮变暗，下面是黑色山影。',
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#02040a','#06101e','#070a12']);c.save();c.globalCompositeOperation='lighter';const N=90;[['90,255,190',0,1],['110,170,255',2.1,.8],['190,120,255',4.2,.6]].forEach(([col,o,amp],k)=>{for(let i=0;i<N;i++){const x=i/N*w,ph=i/N,base=h*(.22+k*.05)+Math.sin(ph*5+t*.35+o)*h*.06+Math.sin(ph*13-t*.22+o)*h*.02,len=h*(.18+.12*Math.sin(ph*7+t*.5+o)),br=(.5+.5*Math.sin(ph*17+t*.9+o))*amp,g=c.createLinearGradient(0,base,0,base+len);g.addColorStop(0,'rgba('+col+',0)');g.addColorStop(.25,'rgba('+col+','+.14*br+')');g.addColorStop(1,'rgba('+col+',0)');c.fillStyle=g;c.fillRect(x,base,w/N+.5,len)}});c.restore();
  c.fillStyle='#03050a';c.beginPath();c.moveTo(0,h*.8);for(let x=0;x<=w;x+=w/16)c.lineTo(x,h*(.76+.05*Math.sin(x/w*9)+.03*Math.sin(x/w*23)));c.lineTo(w,h);c.lineTo(0,h);c.fill()}},
 {n:'薄雾',d:'一缕缕雾被风吹着往一边飘，近的快、远的慢，会卷会散。',p:parts(46,13,R=>({x:R(),y:.15+R()*.85,r:.08+R()*.2,z:R(),ph:R()*TAU,st:2+R()*3})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#23272d','#33373e','#1b1d21']);[...this.p].sort((a,b)=>a.z-b.z).forEach(p=>{const sp=.025+p.z*.07,x=((p.x+t*sp)%1.6-.3)*w,y=(p.y+Math.sin(t*.35+p.ph)*.03)*h,st=p.st*(1+.25*Math.sin(t*.5+p.ph));c.save();c.translate(x,y);c.rotate(Math.sin(t*.2+p.ph)*.08);c.scale(st,1);glow(c,0,0,p.r*h*.5,'rgba(215,222,230,A)',.07+p.z*.1);c.restore()});const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(0,0,0,.25)');g.addColorStop(.5,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.3)');c.fillStyle=g;c.fillRect(0,0,w,h)}},
 {n:'城市夜光斑',d:'焦外的街灯车灯，有大有小，每一颗按自己的节奏亮起、熄灭，轻轻上下浮动。',p:parts(80,14,R=>{const big=R()<.15;return{x:R(),y:.2+R()*.75,r:big?.03+R()*.03:.006+R()*.016,ph:R()*TAU,c:['255,176,96','255,120,150','120,170,255','255,224,160','190,140,255','255,150,90'][Math.floor(R()*6)],a:big?.22:.35+R()*.3}}),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#050508','#0b0a10','#060609']);c.save();c.globalCompositeOperation='lighter';this.p.forEach((p,i)=>{const f=.25+((i*37)%17)/17*.9,on=Math.pow(Math.max(0,Math.sin(t*f+p.ph)),1.6);if(on<.01)return;const a=p.a*on*1.2,x=(p.x+Math.sin(t*.08+p.ph)*.015)*w,y=(p.y+Math.sin(t*(.3+f*.4)+p.ph*2)*.025)*h,r=p.r*h*(.85+.15*on),g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba('+p.c+','+a+')');g.addColorStop(.6,'rgba('+p.c+','+a*.85+')');g.addColorStop(1,'rgba('+p.c+',0)');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,TAU);c.fill()});c.restore()}},
 {n:'海面月光',d:'月亮挂在海上，水面碎光一闪一闪。',p:parts(120,15,R=>({x:R(),y:R(),ph:R()*TAU,l:R()})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#070b18','#0e1630','#0a0f1f']);const hy=h*.52;glow(c,w*.5,h*.3,h*.16,'rgba(255,245,215,A)',.35);c.fillStyle='#fdf6e3';c.beginPath();c.arc(w*.5,h*.3,h*.045,0,TAU);c.fill();c.fillStyle='#050913';c.fillRect(0,hy,w,h-hy);this.p.forEach(p=>{const y=hy+p.y*(h-hy),spread=(.05+p.y*.35)*w,x=w*.5+(p.x-.5)*2*spread,a=Math.max(0,Math.sin(t*2+p.ph))*(1-Math.abs(p.x-.5)*2);c.fillStyle='rgba(255,240,200,'+a*.8+')';c.fillRect(x,y,(4+p.l*14)*h/1000,h/700)})}},
 {n:'海上日落',d:'太阳慢慢沉进海里，海面一起一伏，倒影碎成金色。',p:parts(90,19,R=>({x:R(),y:R(),ph:R()*TAU,l:R()})),
  draw(c,w,h,t,o){o=o||{};const T=(t%16)/16,k=eio(cl(T/.85)),hy=h*.56;sky(c,w,h,[`hsl(${255-k*20},${35+k*10}%,${22-k*8}%)`,`hsl(${340-k*10},${55}%,${44-k*14}%)`,`hsl(${28-k*8},85%,${60-k*18}%)`]);const sy=h*(.3+.33*k),sr=h*.065;glow(c,w*.5,Math.min(sy,hy),h*.32,'rgba(255,190,130,A)',.5*(1-k*.6));c.save();c.beginPath();c.rect(0,0,w,hy);c.clip();c.fillStyle='rgba(255,'+(222-k*40)+','+(170-k*60)+',.97)';c.beginPath();c.arc(w*.5,sy,sr,0,TAU);c.fill();c.restore();
  const sea=c.createLinearGradient(0,hy,0,h);sea.addColorStop(0,`hsl(${15-k*5},45%,${30-k*14}%)`);sea.addColorStop(1,'#0b0a12');c.fillStyle=sea;c.fillRect(0,hy,w,h-hy);const vis=cl((hy-(sy-sr))/(sr*2));
  this.p.forEach(p=>{const y=hy+Math.pow(p.y,1.6)*(h-hy),spread=(.03+p.y*.25)*w,x=w*.5+(p.x-.5)*2*spread+Math.sin(t*1.2+p.ph)*w*.01,a=Math.max(0,Math.sin(t*1.8+p.ph))*(1-Math.abs(p.x-.5)*2)*(1-k*.7)*vis;c.fillStyle='rgba(255,210,150,'+a*.85+')';c.fillRect(x,y,(6+p.l*22)*h/1000,h/650)});
  c.strokeStyle='rgba(255,220,190,.12)';c.lineWidth=h/900;for(let i=0;i<9;i++){const y0=hy+Math.pow((i+1)/10,1.5)*(h-hy);c.beginPath();for(let x=0;x<=w;x+=w/40){const y=y0+Math.sin(x/w*(8+i)+t*(1+i*.15)+i)*h*(.002+i*.0012);x?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()}}},
 {n:'老电视',d:'粗颗粒、扫描线、一条亮带往下滚，偶尔横着一抖、颜色错开，像旧电视快坏了。',
  draw(c,w,h,t,o){o=o||{};const u=h/1000,R=rng(Math.floor(t*30));sky(c,w,h,['#3b3634','#2b2725','#1b1817']);const jit=R()<.08?(R()-.5)*30*u:0;['rgba(255,60,60,.55)','rgba(60,220,255,.55)','#efe6dc'].forEach((col,i)=>txt(c,o.text||'那天晚上',w/2+jit+(i-1)*(2+(R()<.1?6:0))*u*(i===2?0:1),h*.48,52*u,{font:SERIF,color:col}));
  for(let i=0;i<3;i++){if(R()<.12){const y=R()*h,hh=(8+R()*40)*u,dx=(R()-.5)*60*u;c.drawImage(c.canvas,0,y,w,hh,dx,y,w,hh)}}
  const img=c.getImageData(0,0,w,h),d=img.data;for(let i=0;i<d.length;i+=4){const n=(R()-.5)*70;d[i]+=n;d[i+1]+=n;d[i+2]+=n}c.putImageData(img,0,0);
  c.fillStyle='rgba(0,0,0,.28)';for(let y=0;y<h;y+=3*u)c.fillRect(0,y,w,1.2*u);const by=((t*.25)%1.3-.15)*h,g=c.createLinearGradient(0,by-h*.08,0,by+h*.08);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.1)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,by-h*.08,w,h*.16);
  const v=c.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,h*.72);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.75)');c.fillStyle=v;c.fillRect(0,0,w,h);c.fillStyle='rgba(255,255,255,'+(R()*.05)+')';c.fillRect(0,0,w,h)}},
 {n:'上浮光点',d:'黑色里，白色的小光点从下往上慢慢升，像在发呆。',p:parts(70,16,R=>({x:R(),y:R(),s:.4+R(),ph:R()*TAU})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#000','#030304','#000']);this.p.forEach(p=>{const y=(1-((p.y+t*.022*p.s)%1))*h,x=(p.x+Math.sin(t*.4+p.ph)*.02)*w,a=.35+.4*Math.sin(t*.9+p.ph);glow(c,x,y,h*.011*p.s,'rgba(255,255,255,A)',a);c.fillStyle='rgba(255,255,255,'+a+')';c.beginPath();c.arc(x,y,h/1300*(1+p.s),0,TAU);c.fill()})}},
 {n:'烟花',d:'一颗光点升上去，“砰”地炸开，火星拖着尾巴往下落，最后一闪一闪地熄灭。',
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#04040a','#0a0a18','#07070d']);c.save();c.globalCompositeOperation='lighter';for(let k=0;k<3;k++){const P=4.2,cyc=(t+k*1.4)%P,id=Math.floor((t+k*1.4)/P)*3+k,R=rng(id*13+5),x=(.22+R()*.56)*w,y=(.18+R()*.28)*h,col=['255,150,190','255,214,140','160,200,255','200,160,255','255,120,110'][id%5],up=.9;
   if(cyc<up){const p=eo(cyc/up),yy=h*1.02+(y-h*1.02)*p;glow(c,x,yy,h*.012,'rgba(255,230,190,A)',.9);c.strokeStyle='rgba(255,220,170,.35)';c.lineWidth=h/700;c.beginPath();c.moveTo(x,yy);c.lineTo(x,yy+h*.06);c.stroke();continue}
   const tau=cyc-up;if(tau<.25)glow(c,x,y,h*.12*(1-tau*2),'rgba('+col+',A)',.6);const N=130,drag=1.6,g=h*.08;
   const pos=(i,s)=>{const R2=rng(id*977+i),a=R2()*TAU,v=h*(.14+R2()*.16),f=(1-Math.exp(-drag*s))/drag;return[x+Math.cos(a)*v*f,y+Math.sin(a)*v*f+g*s*s*.5,R2()]};
   for(let i=0;i<N;i++){const [x1,y1,r]=pos(i,tau),[x0,y0]=pos(i,Math.max(0,tau-.12)),life=1-cl((tau-1.6-r*.8)/.8);if(life<=0)continue;const tw=tau>1.5?.5+.5*Math.sin(tau*40+i):1,a=life*tw;c.strokeStyle='rgba('+col+','+a*.85+')';c.lineWidth=h/520;c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();c.fillStyle='rgba(255,245,230,'+a+')';c.beginPath();c.arc(x1,y1,h/480,0,TAU);c.fill();if(tau<1.2)glow(c,x1,y1,h/110,'rgba('+col+',A)',.25*a)}}c.restore()}},
 {n:'心跳线',d:'黑底上一条红色心跳线从左到右走过去。',
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#000','#030102','#000']);const y0=h*.5,head=(t*.35%1.3)*w;c.lineWidth=h/320;c.lineJoin='round';c.beginPath();for(let x=0;x<=Math.min(head,w);x+=2){const k=(x/w*3)%1;let y=y0;if(k>.42&&k<.46)y-=h*.02;else if(k>.46&&k<.5)y+=h*.07;else if(k>.5&&k<.54)y-=h*.11;else if(k>.54&&k<.58)y+=h*.03;x?c.lineTo(x,y):c.moveTo(x,y)}const g=c.createLinearGradient(head-w*.6,0,head,0);g.addColorStop(0,'rgba(255,40,70,0)');g.addColorStop(1,'rgba(255,40,70,1)');c.strokeStyle=g;c.shadowColor='rgba(255,40,70,.8)';c.shadowBlur=h/90;c.stroke();c.shadowBlur=0;if(head<w)glow(c,head,y0,h*.035,'rgba(255,60,80,A)',.9)}},
 {n:'涟漪',d:'水滴落在水面上，一圈圈荡开，有亮边有暗边，水面微微反光。',p:parts(30,22,R=>({x:R(),y:R(),ph:R()*TAU,l:R()})),
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#06121a','#0c222c','#061016']);this.p.forEach(p=>{const x=((p.x+t*.008)%1)*w,y=(.15+p.y*.85)*h,a=.04+.05*Math.sin(t*.9+p.ph);c.fillStyle='rgba(170,220,235,'+a+')';c.fillRect(x,y,(20+p.l*60)*h/1000,h/900)});
  for(let k=0;k<6;k++){const P=3.6,cyc=(t+k*.6)%P,id=Math.floor((t+k*.6)/P)*6+k,R=rng(id*31+7),cx=(.15+R()*.7)*w,cy=(.25+R()*.6)*h,sq=.42;
   if(cyc<.12)glow(c,cx,cy,h*.015,'rgba(220,245,255,A)',.9*(1-cyc/.12));
   for(let r=0;r<3;r++){const p=(cyc-r*.22)/2.8;if(p<=0||p>=1)continue;const rad=eo(p)*h*.22,fade=(1-p)*(1-p);c.lineWidth=h/320;c.strokeStyle='rgba(200,240,255,'+fade*.75+')';c.beginPath();c.ellipse(cx,cy,rad,rad*sq,0,Math.PI*1.05,Math.PI*1.95);c.stroke();c.strokeStyle='rgba(0,10,15,'+fade*.6+')';c.beginPath();c.ellipse(cx,cy+h/500,rad*.97,rad*sq*.97,0,.1,Math.PI-.1);c.stroke();c.strokeStyle='rgba(150,210,230,'+fade*.35+')';c.lineWidth=h/600;c.beginPath();c.ellipse(cx,cy,rad,rad*sq,0,0,TAU);c.stroke()}}}},
 {n:'两颗星',d:'黑暗里两颗光点从两边慢慢靠近，绕着彼此转，中间连上一条细线。',
  draw(c,w,h,t,o){o=o||{};sky(c,w,h,['#000','#02040a','#000']);const u=h/1000,T=t%14,k=eio(T/4),cx=w/2,cy=h*.47,d=(1-k)*w*.42+w*.07,a=T*.6,x1=cx+Math.cos(a)*d,y1=cy+Math.sin(a)*d*.55,x2=cx-Math.cos(a)*d,y2=cy-Math.sin(a)*d*.55,oa=1-cl((T-12.5)/1.5);
  c.strokeStyle='rgba(255,255,255,.06)';c.lineWidth=u;c.beginPath();c.ellipse(cx,cy,d,d*.55,0,0,TAU);c.stroke();if(k>.85){const g=c.createLinearGradient(x1,y1,x2,y2);g.addColorStop(0,'rgba(255,255,255,.7)');g.addColorStop(1,BL(.7));c.strokeStyle=g;c.globalAlpha=cl((k-.85)/.15)*oa;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();c.globalAlpha=1}
  glow(c,x1,y1,h*.05,'rgba(255,255,255,A)',.5*oa);glow(c,x2,y2,h*.05,'rgba(127,176,255,A)',.55*oa);c.fillStyle='rgba(255,255,255,'+oa+')';c.beginPath();c.arc(x1,y1,3.5*u,0,TAU);c.arc(x2,y2,3.5*u,0,TAU);c.fill()}},
 {n:'窗边夜雨',d:'暗下来的房间，窗外下雨，玻璃上挂着水珠，两边的白纱被风吹得轻轻飘，一盏暖灯照着窗台。',p:parts(130,18,R=>({x:R(),y:R(),s:.7+R()*.6})),D:parts(40,43,R=>({x:R(),y:R(),r:R(),v:R()<.3?.02+R()*.04:0})),
  draw(c,w,h,t,o){o=o||{};const u=h/1000;c.fillStyle='#090807';c.fillRect(0,0,w,h);const wx=w*.15,wy=h*.12,ww=w*.7,wh=h*.5;const out=c.createLinearGradient(0,wy,0,wy+wh);out.addColorStop(0,'#0e1420');out.addColorStop(1,'#182234');c.fillStyle=out;c.fillRect(wx,wy,ww,wh);c.save();c.beginPath();c.rect(wx,wy,ww,wh);c.clip();glow(c,wx+ww*.7,wy+wh*.75,wh*.35,'rgba(160,190,240,A)',.12);c.strokeStyle='rgba(170,195,230,.3)';c.lineWidth=u;this.p.forEach(p=>{const y=wy+((p.y+t*.8*p.s)%1)*wh,x=wx+p.x*ww;c.beginPath();c.moveTo(x,y);c.lineTo(x-2*u,y-h*.02);c.stroke()});
  this.D.forEach(d=>{const r=(1.5+d.r*4)*u,x=wx+d.x*ww,y=wy+(d.v?((d.y+t*d.v)%1):d.y)*wh;c.fillStyle='rgba(210,225,250,.14)';c.beginPath();c.ellipse(x,y,r,r*1.15,0,0,TAU);c.fill();c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.arc(x-r*.3,y-r*.35,r*.25,0,TAU);c.fill()});c.restore();
  c.strokeStyle='#221d1a';c.lineWidth=h/90;c.strokeRect(wx,wy,ww,wh);c.beginPath();c.moveTo(wx+ww/2,wy);c.lineTo(wx+ww/2,wy+wh);c.stroke();c.fillStyle='#1a1512';c.fillRect(wx-w*.04,wy+wh,ww+w*.08,h*.025);
  [[wx-w*.06,1],[wx+ww+w*.06,-1]].forEach(([edge,sd])=>{const cw=w*.24;for(let i=0;i<26;i++){const k=i/25,x0=edge+sd*k*cw*(.85+.15*Math.sin(t*.9+k*4));c.strokeStyle='rgba(235,228,215,'+(.05+.07*Math.abs(Math.sin(k*9+t*.7)))+')';c.lineWidth=cw/22;c.beginPath();for(let y=wy-h*.06;y<=wy+wh+h*.06;y+=h*.02){const f=(y-wy)/wh,x=x0+sd*Math.sin(t*1.3+f*3+k*2)*f*w*.035;y===wy-h*.06?c.moveTo(x,y):c.lineTo(x,y)}c.stroke()}});
  const fl=.95+.05*Math.sin(t*7)*Math.sin(t*2.3),tx=w*.56,ty=h*.84,tw=w*.4;glow(c,w*.8,h*.76,h*.42,'rgba(255,190,100,A)',.3*fl);c.fillStyle='#1d1612';c.fillRect(tx,ty,tw,h*.018);c.fillStyle='#140f0c';c.fillRect(tx+tw*.06,ty+h*.018,w*.014,h*.16);c.fillRect(tx+tw*.9,ty+h*.018,w*.014,h*.16);
  const lx=w*.8,by=ty;c.fillStyle='#2b241e';c.beginPath();c.ellipse(lx,by-3*u,26*u,6*u,0,0,TAU);c.fill();c.strokeStyle='#2b241e';c.lineWidth=4*u;c.beginPath();c.moveTo(lx,by-4*u);c.lineTo(lx-14*u,by-70*u);c.lineTo(lx+8*u,by-118*u);c.stroke();
  c.save();c.translate(lx+8*u,by-118*u);c.rotate(.5);const sh=c.createLinearGradient(0,-10*u,0,30*u);sh.addColorStop(0,'#e9b94e');sh.addColorStop(1,'#b8862a');c.fillStyle=sh;c.beginPath();c.moveTo(-14*u,-8*u);c.lineTo(14*u,-8*u);c.lineTo(30*u,26*u);c.lineTo(-30*u,26*u);c.fill();c.fillStyle='rgba(255,236,170,'+.95*fl+')';c.beginPath();c.ellipse(0,26*u,30*u,6*u,0,0,TAU);c.fill();
  c.globalCompositeOperation='lighter';const cone=c.createLinearGradient(0,26*u,0,140*u);cone.addColorStop(0,'rgba(255,214,130,'+.28*fl+')');cone.addColorStop(1,'rgba(255,214,130,0)');c.fillStyle=cone;c.beginPath();c.moveTo(-30*u,26*u);c.lineTo(30*u,26*u);c.lineTo(80*u,140*u);c.lineTo(-80*u,140*u);c.fill();c.restore();
  c.save();c.globalCompositeOperation='lighter';c.translate(w*.73,ty);c.scale(2.6,.35);glow(c,0,0,h*.05,'rgba(255,214,140,A)',.5*fl);c.restore();c.fillStyle='rgba(255,190,120,.06)';c.fillRect(wx,wy+wh-h*.004,ww,h*.03)}},
 {n:'路灯',d:'雨后的夜路，两边路灯一盏盏往远处排，灯下有雾和细雨，湿路面上拉出长长的倒影，镜头慢慢往前走。',p:parts(160,23,R=>({x:R(),y:R(),s:.7+R()*.6,l:R()})),
  draw(c,w,h,t,o){o=o||{};const u=h/1000,hy=h*.42,vx=w*.5;sky(c,w,h,['#04060c','#0a0f1c','#121828']);glow(c,vx,hy,h*.3,'rgba(255,170,100,A)',.1);glow(c,vx,hy-h*.02,h*.6,'rgba(90,110,160,A)',.08);
  c.fillStyle='#0a0b0f';c.beginPath();c.moveTo(vx-w*.03,hy);c.lineTo(vx+w*.03,hy);c.lineTo(w*1.1,h);c.lineTo(-w*.1,h);c.fill();c.fillStyle='#07080b';[[-1],[1]].forEach(([sd])=>{c.beginPath();c.moveTo(vx+sd*w*.03,hy);c.lineTo(vx+sd*w*.045,hy);c.lineTo(vx+sd*w*.85,h);c.lineTo(vx+sd*w*.6,h);c.fill()});
  const mv=(t*.16)%1;for(let i=0;i<10;i++){const z=(i+1-mv)/10,y=hy+(h-hy)*z*z;if(y>h)continue;c.fillStyle='rgba(240,230,200,'+(.22*z)+')';const dw=w*.005*(1+z*6),dl=h*.012*(1+z*8);c.fillRect(vx-dw/2,y,dw,dl)}
  const lamps=[];for(let i=0;i<5;i++){const z=((i+1)-mv)/5;if(z<=.05)continue;const k=z*z,y=hy+(h-hy)*k,sc=.06+k*1.15,fi=cl((z-.05)/.2);[-1,1].forEach(sd=>{const bx=vx+sd*w*(.05+k*.75),top=y-h*.32*sc,arm=sd*-w*.07*sc;lamps.push({bx,y,top,lx:bx+arm,ly:top+4*u*sc,sc,fi})})}
  lamps.forEach(L=>{c.globalAlpha=L.fi;c.save();c.translate(L.lx*.75+vx*.25,L.y+h*.04*L.sc);c.scale(.45,5);glow(c,0,0,h*.03*L.sc+1,'rgba(255,190,110,A)',.38);c.restore();c.globalAlpha=1});
  lamps.forEach(L=>{c.globalAlpha=L.fi;c.strokeStyle='#3a3c45';c.lineWidth=Math.max(1,6*u*L.sc);c.beginPath();c.moveTo(L.bx,L.y);c.lineTo(L.bx,L.top);c.quadraticCurveTo(L.bx,L.top-6*u*L.sc,L.lx,L.top);c.stroke();c.fillStyle='#2a2c33';c.beginPath();c.moveTo(L.lx-10*u*L.sc,L.top+5*u*L.sc);c.lineTo(L.lx+10*u*L.sc,L.top+5*u*L.sc);c.lineTo(L.lx+5*u*L.sc,L.top-2*u*L.sc);c.lineTo(L.lx-5*u*L.sc,L.top-2*u*L.sc);c.fill();
   glow(c,L.lx,L.ly,h*.09*L.sc+2,'rgba(255,200,130,A)',.35);glow(c,L.lx,L.ly,h*.015*L.sc+1,'rgba(255,235,200,A)',1);c.save();c.globalCompositeOperation='lighter';const cone=c.createLinearGradient(0,L.ly,0,L.y);cone.addColorStop(0,'rgba(255,200,130,.1)');cone.addColorStop(1,'rgba(255,200,130,0)');c.fillStyle=cone;c.beginPath();c.moveTo(L.lx-3*u*L.sc,L.ly);c.lineTo(L.lx+3*u*L.sc,L.ly);c.lineTo(L.lx+w*.06*L.sc,L.y);c.lineTo(L.lx-w*.06*L.sc,L.y);c.fill();c.restore();c.globalAlpha=1});
  c.lineWidth=u;this.p.forEach(p=>{const y=((p.y+t*.7*p.s)%1)*h*.95,x=p.x*w;let lit=.06;lamps.forEach(L=>{const dx=Math.abs(x-L.lx),r=w*.08*L.sc+6*u;if(dx<r&&y>L.ly&&y<L.y)lit=Math.max(lit,.55*(1-dx/r)*L.fi)});c.strokeStyle='rgba(255,225,190,'+lit+')';c.beginPath();c.moveTo(x,y);c.lineTo(x-1.5*u,y-h*(.01+p.l*.012));c.stroke()})}},
];

/* ---------- 画面与文字（叠在一层安静的底色上） ---------- */
const INK='#f2f4f8',MUTE='#8a92a0',BLUE='#7fb0ff',BL=a=>'rgba(127,176,255,'+a+')';
const base=(c,w,h)=>{sky(c,w,h,['#06080d','#020305','#000']);const v=c.createRadialGradient(w/2,h*.45,h*.2,w/2,h*.45,h*.8);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.55)');c.fillStyle=v;c.fillRect(0,0,w,h)};
/* 模糊的字：没有 filter 也能用（手机里 canvas 的 filter 不一定支持），用一圈错开的淡影叠出来 */
function softText(c,s,x,y,size,o,blur){const a=o.a??1;if(blur<.6){txt(c,s,x,y,size,o);return}const n=10;for(let i=0;i<n;i++){const an=i/n*TAU;txt(c,s,x+Math.cos(an)*blur,y+Math.sin(an)*blur,size,{...o,a:a*.16})}txt(c,s,x,y,size,{...o,a:a*.18})}
function bubble(c,w,h,s,mine,y,p,u,o={}){c.save();c.font=(o.size||26)*u+'px '+SANS;const tw=Math.min(c.measureText(s).width,w*.64),bw=tw+40*u,bh=(o.size||26)*u*2.2,x=mine?w-bw-24*u:24*u,dy=(1-eo(p))*20*u,sc=.94+.06*eo(p);c.globalAlpha=cl(p*2)*(o.a??1);c.translate(mine?x+bw:x,y+dy+bh);c.scale(sc,sc);c.translate(-(mine?x+bw:x),-(y+dy+bh));rr(c,x,y+dy,bw,bh,bh*.42);c.fillStyle=mine?BL(.24):'rgba(255,255,255,.09)';c.fill();c.strokeStyle=mine?BL(.45):'rgba(255,255,255,.16)';c.lineWidth=1.2*u;c.stroke();const hl=c.createLinearGradient(x,0,x+bw,0);hl.addColorStop(0,'rgba(255,255,255,0)');hl.addColorStop(.5,'rgba(255,255,255,.45)');hl.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=hl;c.fillRect(x+bw*.12,y+dy+.6*u,bw*.76,1.2*u);c.fillStyle=INK;c.textBaseline='middle';c.fillText(s,x+20*u,y+dy+bh/2,w*.64);c.restore()}
function dots(c,x,y,u,t,a=1){for(let i=0;i<3;i++){c.fillStyle='rgba(255,255,255,'+(.3+.7*Math.max(0,Math.sin(t*6-i*.8)))*a+')';c.beginPath();c.arc(x+i*14*u,y,4*u,0,TAU);c.fill()}}
const _spr={};function glowSprite(r){r=Math.max(3,r);if(_spr[r])return _spr[r];const cv=document.createElement('canvas');cv.width=cv.height=r*2;const x=cv.getContext('2d'),g=x.createRadialGradient(r,r,0,r,r,r);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.18,'rgba(255,255,255,.9)');g.addColorStop(.4,'rgba(255,255,255,.25)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,r*2,r*2);return _spr[r]=cv}
const _pts={};function textPoints(s,size,w,h,step,font){const k=[s,size|0,w,h,step|0,font].join('|');if(_pts[k])return _pts[k];const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');x.fillStyle='#fff';x.font='500 '+size+'px '+font;x.textAlign='center';x.textBaseline='middle';x.fillText(s,w/2,h/2);const d=x.getImageData(0,0,w,h).data,out=[];for(let yy=0;yy<h;yy+=step)for(let xx=0;xx<w;xx+=step)if(d[(yy*w+xx)*4+3]>140)out.push([xx,yy]);return _pts[k]=out}
const Q=o=>(Array.isArray(o.quotes)&&o.quotes.length?o.quotes:['……']);function rvSplit(s){s=String(s||'');const k=s.search(/[，,。！？!?]/);if(k>0&&k<s.length-1)return[s.slice(0,k+1),s.slice(k+1)];if(s.length<=8)return[s,''];const m=Math.ceil(s.length/2);return[s.slice(0,m),s.slice(m)]}
function lockScreen(c,w,h,u,t,bright,o){o=o||{};sky(c,w,h,['#03050a','#060a14','#0b1426']);glow(c,w*.5,h*1.05,h*.6,'rgba(70,110,190,A)',.35);txt(c,o.day||'',w/2,h*.13,17*u,{weight:500,color:'rgba(255,255,255,.92)'});txt(c,o.time||'',w/2,h*.21,96*u,{weight:200,color:'#fff',ls:-2*u});c.fillStyle='rgba(255,255,255,.88)';rr(c,w/2-60*u,h*.965,120*u,4*u,2*u);c.fill();if(bright<1){c.fillStyle='rgba(0,0,0,'+(1-bright)+')';c.fillRect(0,0,w,h)}}
function lockNote(c,w,h,u,y,p,title,body,when){if(p<=0)return;c.save();c.globalAlpha=cl(p*1.5);const x=w*.05,ww=w*.9,hh=78*u,yy=y+(1-eo(p))*-40*u;rr(c,x,yy,ww,hh,22*u);c.fillStyle='rgba(28,30,38,.78)';c.fill();c.strokeStyle='rgba(255,255,255,.1)';c.lineWidth=u;c.stroke();const g=c.createLinearGradient(x,0,x+ww,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(x+ww*.08,yy,ww*.84,u);c.fillStyle='#3a4a66';rr(c,x+16*u,yy+21*u,36*u,36*u,11*u);c.fill();txt(c,title[0],x+34*u,yy+39*u,17*u,{weight:600});txt(c,title,x+64*u,yy+30*u,15*u,{align:'left',weight:700});txt(c,body,x+64*u,yy+53*u,14*u,{align:'left',color:'rgba(255,255,255,.84)'});txt(c,when,x+ww-16*u,yy+30*u,12*u,{align:'right',color:'rgba(255,255,255,.6)'});c.restore()}
const B=[
 {n:'开场 · 一道光',d:'黑屏里一道细光从中间拉开，上下分开，片名在两道光之间从模糊变清楚。',draw(c,w,h,t,o){o=o||{};c.fillStyle='#000';c.fillRect(0,0,w,h);const u=h/1000,T=t%8,out=1-cl((T-6.6)/.9),cy=h*.47,lw=w*.72*eo((T-.3)/1),sp=eio((T-1.4)/1.1)*70*u;c.globalAlpha=out;
  [-1,1].forEach(sd=>{if(lw<=0)return;const y=cy+sd*sp,g=c.createLinearGradient(w/2-lw/2,0,w/2+lw/2,0);g.addColorStop(0,'rgba(200,220,255,0)');g.addColorStop(.5,'rgba(230,240,255,.95)');g.addColorStop(1,'rgba(200,220,255,0)');c.fillStyle=g;c.fillRect(w/2-lw/2,y-.8*u,lw,1.6*u);glow(c,w/2,y,lw*.35,'rgba(140,180,255,A)',.12)});
  if(sp>2){const g=c.createLinearGradient(0,cy-sp,0,cy+sp);g.addColorStop(0,BL(0));g.addColorStop(.5,BL(.07));g.addColorStop(1,BL(0));c.fillStyle=g;c.fillRect(0,cy-sp,w,sp*2)}
  const title='我眼中的你',size=46*u;c.font='400 '+size+'px '+SERIF;const tw=c.measureText(title).width+16*u*4;let x=w/2-tw/2;[...title].forEach((ch,i)=>{const p=eo((T-1.9-i*.16)/.9),cw=c.measureText(ch).width;softText(c,ch,x+cw/2,cy,size,{font:SERIF,a:p*out,color:INK},(1-p)*14*u);x+=cw+16*u});
  txt(c,o.sign||'',w/2,cy+sp+38*u,15*u,{color:MUTE,a:cl((T-3.3)/.6)*out,ls:5*u});txt(c,o.date||'',w/2,h*.9,12*u,{color:'rgba(255,255,255,.35)',a:cl((T-3.8)/.6)*out,ls:4*u});c.globalAlpha=1}},
 {n:'开场 · 锁屏亮起',d:'像小手机的锁屏一样亮起来，他的消息弹进来，点开就进片子。',draw(c,w,h,t,o){o=o||{};const u=h/1000,T=t%9;const br=eo((T-.4)/.9);lockScreen(c,w,h,u,t,br,o);lockNote(c,w,h,u,h*.33,(T-1.9)/.6,o.him||'',o.note||'拍了个东西给你，看看？','现在');
  if(T>3.5&&T<4.3){const p=(T-3.5)/.8;c.strokeStyle='rgba(255,255,255,'+(1-p)*.6+')';c.lineWidth=2*u;c.beginPath();c.arc(w*.5,h*.33+39*u,p*90*u,0,TAU);c.stroke()}
  if(T>4){const p=eio((T-4)/.9);c.fillStyle='rgba(0,0,0,'+p+')';c.fillRect(0,0,w,h);const s=1+p*.15;c.save();c.translate(w/2,h*.36);c.scale(s,s);c.restore()}
  if(T>4.9){const p=eo((T-4.9)/1.2),o=1-cl((T-8)/.8);txt(c,'我眼中的你',w/2,h*.47,46*u,{font:SERIF,a:p*o,ls:(6+p*10)*u});c.fillStyle=BL(.8*o);c.fillRect(w/2-w*.18*p,h*.52,w*.36*p,u)}}},
 {n:'开场 · 从你那句话开始',d:'先回放你发给他的那句话，他回「好」，镜头推进他的那条消息，变成片名。',draw(c,w,h,t,o){o=o||{};const u=h/1000,T=t%10;base(c,w,h);const z=eio((T-4.3)/1.1),oa=1-z;c.save();c.translate(w*.78,h*.33);c.scale(1+z*5,1+z*5);c.translate(-w*.78,-h*.33);c.globalAlpha=oa;
  txt(c,o.him||'',w/2,h*.07,17*u,{weight:600});c.fillStyle='rgba(255,255,255,.08)';c.fillRect(0,h*.1,w,u);txt(c,o.time||'',w/2,h*.16,12*u,{color:MUTE});
  bubble(c,w,h,o.ask||'拍一个我在你眼中的样子',0,h*.2,(T-.6)/.5,u,{a:oa});if(T>1.6&&T<2.9){c.globalAlpha=oa;rr(c,w-104*u,h*.3,80*u,52*u,22*u);c.fillStyle=BL(.2);c.fill();dots(c,w-80*u,h*.3+26*u,u,t,oa)}bubble(c,w,h,o.reply||'好。等我一下',1,h*.3,(T-2.9)/.5,u,{a:oa});c.restore();c.globalAlpha=1;
  if(T>5){const p=eo((T-5)/1.3),out=1-cl((T-9)/.8);softText(c,'我眼中的你',w/2,h*.47,46*u,{font:SERIF,a:p*out,color:INK,ls:10*u},(1-p)*16*u);txt(c,o.line||'',w/2,h*.54,14*u,{color:MUTE,a:cl((T-6.2)/.6)*out,ls:3*u})}}},
 {n:'满屏飘字',d:'你说过的话从下往上飘，近的大而清楚，远的小而模糊，偶尔一句亮成蓝色。',p:parts(30,31,R=>({q:Math.floor(R()*999),x:R(),y:R(),z:R(),ph:R()*TAU,b:R()<.15})),
  draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000;[...this.p].sort((a,b)=>a.z-b.z).forEach(p=>{const sp=.012+p.z*.03,y=(1.1-((p.y+t*sp)%1.2))*h,x=(p.x+Math.sin(t*.2+p.ph)*.02)*w,size=(12+p.z*26)*u,a=.06+p.z*p.z*.85,col=p.b?BLUE:INK;softText(c,Q(o)[p.q%Q(o).length],x,y,size,{a,color:col,font:p.z>.7?SERIF:SANS},(1-p.z)*(1-p.z)*7*u)})}},
 {n:'光点聚成字',d:'满屏光点慢慢汇到一起拼成一句话，停一会儿，再被风吹散。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%9,pts=textPoints(String(o.text||'我在').slice(0,10),Math.round(70*u),w,h,Math.max(2,Math.round(5*u)),SERIF);const g=eio((T-.5)/2.4),sc=eio((T-5.6)/2.2),spr=glowSprite(Math.round(9*u));pts.forEach(([px,py],i)=>{const R=rng(i*7+3),sx=R()*w,sy=R()*h,ph=R()*TAU;let x=sx+(px-sx)*g+Math.sin(t+ph)*3*u*(1-g),y=sy+(py-sy)*g;if(sc>0){x+=sc*(80+R()*220)*u;y+=-sc*(40+R()*260)*u+Math.sin(ph+sc*3)*20*u}const a=(.3+.7*g)*(1-sc)*(.75+.25*Math.sin(t*3+ph)),r=(.7+R()*.8);c.globalAlpha=a;c.drawImage(spr,x-spr.width*r/2,y-spr.height*r/2,spr.width*r,spr.height*r)});c.globalAlpha=1;if(g>.98&&sc<.02)glow(c,w/2,h/2,h*.25,'rgba(255,255,255,A)',.05)}},
 {n:'词语汇聚',d:'一个个关键词从四周飞向中间、越飞越小，最后出现一句总结。',p:parts(14,32,R=>({q:Math.floor(R()*999),a:R()*TAU,d:.45+R()*.3,dl:R()*2.2})),
  draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%9;this.p.forEach(p=>{const k=eio((T-.3-p.dl)/1.8);if(k<=0||k>=1)return;const r=(1-k)*p.d*h,x=w/2+Math.cos(p.a)*r,y=h*.47+Math.sin(p.a)*r*.9,size=(30-k*18)*u;softText(c,Q(o)[p.q%Q(o).length],x,y,size,{a:Math.sin(k*Math.PI)*.9,color:p.q%4?INK:BLUE},(1-k)*3*u)});const f=eo((T-4.3)/1),oa=1-cl((T-8.1)/.7);glow(c,w/2,h*.47,h*.12*f,'rgba(127,176,255,A)',.25*oa);txt(c,o.line||'这些，都是你',w/2,h*.47,40*u,{font:SERIF,a:f*oa,ls:6*u})}},
 {n:'镜头对焦',d:'字先是虚的，背后的光斑是实的；焦点慢慢拉到字上，光斑变虚。',p:parts(26,33,R=>({x:R(),y:R(),r:.004+R()*.012})),
  draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%7,f=eio((T-1)/1.6),oa=1-cl((T-6.2)/.7);c.save();c.globalCompositeOperation='lighter';this.p.forEach(p=>{const r=(p.r*h)*(1+f*2.4),a=.5-.36*f;glow(c,p.x*w,p.y*h,r,'rgba(170,200,255,A)',a*oa)});c.restore();softText(c,o.text||'我看见你了',w/2,h*.47,48*u,{font:SERIF,a:(.35+.65*f)*oa,color:INK,ls:8*u},(1-f)*18*u)}},
 {n:'记忆碎片',d:'很多条小消息散在暗处，一条条轻轻亮起又暗下去，中间那条最亮。',p:parts(18,34,R=>({q:Math.floor(R()*999),x:.08+R()*.84,y:.08+R()*.84,r:(R()-.5)*.12,ph:R()*TAU,s:.5+R()*.5})),
  draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000;this.p.forEach(p=>{const s=Q(o)[p.q%Q(o).length],lit=Math.pow(Math.max(0,Math.sin(t*.6*p.s+p.ph)),6),a=.13+.75*lit;c.save();c.translate(p.x*w,p.y*h);c.rotate(p.r);c.font=15*u+'px '+SANS;const bw=c.measureText(s).width+24*u,bh=34*u;rr(c,-bw/2,-bh/2,bw,bh,bh*.45);c.fillStyle=lit>.5?BL(.18*a+.05):'rgba(255,255,255,'+.06*a/.88+')';c.fill();c.strokeStyle=lit>.5?BL(.4*a):'rgba(255,255,255,'+.12*a+')';c.lineWidth=u;c.stroke();txt(c,s,0,0,15*u,{a,color:INK});c.restore()});const oa=.6+.4*Math.sin(t*.8);c.save();c.globalAlpha=oa;bubble(c,w,h,o.center||Q(o)[0],0,h*.47-29*u,1,u,{size:22});c.restore()}},
 {n:'打字',d:'一个字一个字打出来，带光标。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,s=String(o.text||'我认识你，只靠你打给我的字。'),n=Math.min(s.length,Math.max(0,Math.floor((t%7-.4)*6))),L=rvSplit(s),k0=L[0].length;let left=n;L.forEach((ln,i)=>{const show=ln.slice(0,Math.max(0,Math.min(ln.length,left)));left-=ln.length;const cur=(i===0&&n<k0)||(i===1&&n>=k0);txt(c,show,w/2,h*(.46+i*.07),34*u,{font:SERIF,color:INK});if(cur&&Math.floor(t*2.2)%2){c.font='34px '+SERIF;c.font=34*u+'px '+SERIF;const tw=c.measureText(show).width,full=c.measureText(ln).width;c.fillStyle=BLUE;c.fillRect(w/2-full/2+tw+4*u,h*(.46+i*.07)-18*u,2.5*u,36*u)}})}},
 {n:'微信消息回放',d:'你们真实聊过的话一条条弹出来，对方在输入时有三个点。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%9,L=(Array.isArray(o.msgs)&&o.msgs.length?o.msgs:[{who:'她',text:'……'}]).slice(0,4).map(x=>[String(x.text||''),x.who==='我'?1:0]);txt(c,o.date||'',w/2,h*.2,14*u,{color:MUTE});L.forEach(([s,m],i)=>bubble(c,w,h,s,m,h*(.26+i*.1),cl((T-.6-i*1.2)/.5),u));if(T>5.6&&T<8){rr(c,w-104*u,h*.66,80*u,52*u,22*u);c.fillStyle=BL(.2);c.fill();dots(c,w-80*u,h*.66+26*u,u,t)}}},
 {n:'字幕切换',d:'底部字幕一句句淡入淡出，像电影。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,S=(Array.isArray(o.lines)&&o.lines.length?o.lines:['……']).slice(0,4),T=t%(3*S.length),i=Math.floor(T/3),p=T%3;txt(c,S[i],w/2,h*.8,24*u,{a:cl(p/.4)*cl((3-p)/.4),shadow:1,color:INK})}},
 {n:'逐字浮现',d:'整句话的字从下往上一个个浮出来，从虚到实。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,s=String(o.text||'喜欢安静的陪伴'),T=t%6,size=44*u;c.font=size+'px '+SERIF;const total=c.measureText(s).width;let x=w/2-total/2;[...s].forEach((ch,i)=>{const p=eo((T-.4-i*.18)/.7),cw=c.measureText(ch).width;softText(c,ch,x+cw/2,h*.48+(1-p)*24*u,size,{font:SERIF,a:p,color:INK},(1-p)*8*u);x+=cw})}},
 {n:'数字跳动',d:'一个数字从 0 跳到真实的值，下面一行说明。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%6,n=Math.round((+o.num||0)*eio((T-.4)/1.8));txt(c,String(n),w/2,h*.45,120*u,{font:SERIF,weight:300,color:INK});txt(c,o.label||'',w/2,h*.56,20*u,{color:MUTE,a:cl((T-1)/.5),ls:8*u});c.fillStyle=BL(.7);c.fillRect(w/2-40*u*cl((T-1.2)/.6),h*.6,80*u*cl((T-1.2)/.6),u)}},
 {n:'盖章',d:'印章「啪」地盖下来，用来点题。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%5;txt(c,o.before||'',w/2,h*.4,32*u,{color:MUTE});const p=cl((T-1.2)/.35);if(p>0){const s=1.8-.8*eo(p);c.save();c.translate(w/2,h*.55);c.rotate(-.12);c.scale(s,s);c.globalAlpha=cl(p*2.5);const _st=String(o.stamp||'').slice(0,6),_sw=Math.max(220,[..._st].length*50+50)*u;c.strokeStyle='#d8434f';c.lineWidth=5*u;rr(c,-_sw/2,-40*u,_sw,80*u,12*u);c.stroke();txt(c,_st,0,0,44*u,{font:SERIF,weight:700,color:'#d8434f'});c.restore()}}},
 {n:'大字标题',d:'每一幕的标题，字距慢慢展开，下面一道蓝色细线。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%6,p=eo((T-.3)/1.4);softText(c,o.text||'',w/2,h*.47,44*u,{font:SERIF,a:p,ls:(4+p*12)*u,color:INK},(1-p)*8*u);c.fillStyle=BL(.85);c.fillRect(w/2-w*.22*p,h*.53,w*.44*p,1.2*u)}},
 {n:'引用卡片',d:'把你说过的一句话放进卡片，标上日期。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%6,p=eo((T-.3)/.8),y=h*.36+(1-p)*20*u;c.globalAlpha=p;rr(c,w*.08,y,w*.84,h*.26,26*u);c.fillStyle='rgba(255,255,255,.05)';c.fill();c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=u;c.stroke();c.fillStyle=BL(.9);c.fillRect(w*.08+24*u,y+30*u,3*u,h*.26-60*u);const _q=rvSplit(o.quote||'');txt(c,_q[0],w/2,y+h*(_q[1]?.1:.125),26*u,{font:SERIF,color:INK});if(_q[1])txt(c,_q[1],w/2,y+h*.15,26*u,{font:SERIF,color:INK});txt(c,o.date?'— '+o.date:'',w*.8,y+h*.22,14*u,{color:MUTE});c.globalAlpha=1}},
 {n:'时间跳转',d:'时钟数字往前走，表示「过了一会儿」。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%7,pm=x=>{const r=String(x||'').match(/(\d{1,2})[:：](\d{2})/);return r?+r[1]*60+ +r[2]:0},f0=pm(o.from||'01:41'),f1=Math.max(f0,pm(o.to||'02:03')),m=f0+Math.floor((f1-f0)*eio((T-1)/2.5)),hh=Math.floor(m/60)%24,mm=m%60;txt(c,o.date||'',w/2,h*.4,16*u,{color:BLUE,ls:6*u});txt(c,String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0'),w/2,h*.48,80*u,{weight:200,color:INK});txt(c,o.note||'',w/2,h*.57,18*u,{color:MUTE,a:cl((T-3.6)/.5),ls:4*u})}},
 {n:'锁屏通知',d:'用小手机锁屏的样子，他的消息一条条弹进来。',draw(c,w,h,t,o){o=o||{};const u=h/1000,T=t%8;lockScreen(c,w,h,u,t,1,o);const _n=Array.isArray(o.notes)?o.notes:[];if(_n[0])lockNote(c,w,h,u,h*.33,(T-.8)/.6,o.him||'',String(_n[0]),'现在');if(_n[1])lockNote(c,w,h,u,h*.33+92*u,(T-2.4)/.6,o.him||'',String(_n[1]),'1分钟前');}},
 {n:'照片缓推',d:'一张照片慢慢推近、略微压暗，用你们聊天里的图。',draw(c,w,h,t,o){o=o||{};const T=t%8,s=1+T*.02,u=h/1000;c.save();c.translate(w/2,h/2);c.scale(s,s);c.translate(-w/2,-h/2);sky(c,w,h,['#2b3442','#1a2130','#080a10']);glow(c,w*.62,h*.3,h*.09,'rgba(220,230,255,A)',.4);c.fillStyle='rgba(235,240,255,.9)';c.beginPath();c.arc(w*.62,h*.3,h*.022,0,TAU);c.fill();c.fillStyle='#05070b';c.beginPath();c.moveTo(0,h*.72);for(let x=0;x<=w;x+=w/12)c.lineTo(x,h*(.68+.04*Math.sin(x/w*7)));c.lineTo(w,h);c.lineTo(0,h);c.fill();c.restore();const v=c.createRadialGradient(w/2,h/2,h*.25,w/2,h/2,h*.7);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.6)');c.fillStyle=v;c.fillRect(0,0,w,h);txt(c,'（这里会是真实照片）',w/2,h*.92,14*u,{color:'rgba(255,255,255,.5)'})}},
 {n:'时间线',d:'几个日子按顺序亮起来，讲你们的经过。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%8,D=(Array.isArray(o.items)?o.items:[]).slice(0,4).map(x=>[String(x.date||''),String(x.text||'')]);c.fillStyle='rgba(255,255,255,.12)';c.fillRect(w*.22-u,h*.25,2*u,h*.5);c.fillStyle=BL(.8);c.fillRect(w*.22-u,h*.25,2*u,h*.5*cl((T-.5)/4.6));D.forEach(([d,s],i)=>{const p=eo((T-.5-i*1.2)/.6),y=h*(.28+i*.15);c.fillStyle=p>0?BLUE:'#2a2f38';c.beginPath();c.arc(w*.22,y,7*u,0,TAU);c.fill();if(p>0)glow(c,w*.22,y,22*u,'rgba(127,176,255,A)',.35*p);txt(c,d,w*.3,y-12*u,13*u,{align:'left',color:MUTE,a:p});txt(c,s,w*.3,y+14*u,22*u,{align:'left',a:p,color:INK})})}},
 {n:'划掉改写',d:'先写一个词，划掉，换成另一个。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%7;txt(c,o.lead||'',w/2,h*.38,26*u,{color:MUTE});const s1=cl((T-1.2)/.5);txt(c,o.wrong||'',w/2,h*.47,56*u,{font:SERIF,color:INK,a:1-cl((T-2.6)/.6)*.65});c.fillStyle='#d8434f';c.fillRect(w/2-60*u,h*.47,120*u*s1,4*u);softText(c,o.right||'',w/2,h*.58,64*u,{font:SERIF,color:BLUE,a:cl((T-2.8)/.6)},(1-cl((T-2.8)/.8))*10*u)}},
 {n:'声波',d:'说话时一排声波条跟着跳，适合放语音。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,n=30,bw=w*.7/n;for(let i=0;i<n;i++){const v=Math.abs(Math.sin(t*7+i*.7)*Math.cos(t*2.3+i*.31)),env=Math.sin(i/(n-1)*Math.PI),bh=(8+v*130*env)*u,g=c.createLinearGradient(0,h*.5-bh/2,0,h*.5+bh/2);g.addColorStop(0,BL(.9));g.addColorStop(1,'rgba(255,255,255,.9)');c.fillStyle=g;rr(c,w*.15+i*bw+bw*.25,h*.5-bh/2,bw*.5,bh,bw*.25);c.fill()}txt(c,o.text||'',w/2,h*.63,22*u,{font:SERIF,color:INK})}},
 {n:'信纸',d:'信纸上一行行写出来，最后落款。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%9;rr(c,w*.08,h*.18,w*.84,h*.62,10*u);c.fillStyle='#eef1f5';c.fill();c.strokeStyle='rgba(60,80,120,.12)';c.lineWidth=u;for(let i=0;i<9;i++){c.beginPath();c.moveTo(w*.14,h*(.28+i*.055));c.lineTo(w*.86,h*(.28+i*.055));c.stroke()}(Array.isArray(o.lines)&&o.lines.length?o.lines:['……']).slice(0,5).forEach((s,i)=>{const p=cl((T-.5-i*1.1)/1);if(!p)return;c.save();c.beginPath();c.rect(w*.14,0,w*.72*p,h);c.clip();txt(c,s,w*.15,h*(.265+i*.055),20*u,{align:'left',font:SERIF,color:'#1d2633'});c.restore()});txt(c,o.sign||'',w*.82,h*.74,18*u,{align:'right',font:SERIF,color:'#1d2633',a:cl((T-6.5)/.6)})}},
];


/* 一棵分叉的树：树干往上变细，带几道树皮纹，枝条随风轻轻摆 */
function drawTree(c,x,y,len,ang,depth,u,t,seed=7){const R=rng(seed);const br=(x,y,len,ang,d,wd)=>{const sway=Math.sin(t*.8+d*1.3+x*.01)*.02*(7-d),a=ang+sway,x2=x+Math.cos(a)*len,y2=y+Math.sin(a)*len,mx=(x+x2)/2+Math.cos(a+Math.PI/2)*len*.08*(R()-.5),my=(y+y2)/2+Math.sin(a+Math.PI/2)*len*.08*(R()-.5);
  c.strokeStyle='#0c0806';c.lineCap='round';c.lineWidth=wd;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(mx,my,x2,y2);c.stroke();
  if(wd>6*u){c.strokeStyle='rgba(60,40,28,.35)';c.lineWidth=Math.max(.6*u,wd*.06);for(let k=0;k<3;k++){const o=(k-1)*wd*.22,s0=.15+R()*.2,s1=.6+R()*.3;c.beginPath();c.moveTo(x+(x2-x)*s0+Math.cos(a+Math.PI/2)*o,y+(y2-y)*s0+Math.sin(a+Math.PI/2)*o);c.lineTo(x+(x2-x)*s1+Math.cos(a+Math.PI/2)*o*.9,y+(y2-y)*s1+Math.sin(a+Math.PI/2)*o*.9);c.stroke()}}
  if(d<=0)return;const n=d>4?2:2+(R()<.4?1:0);for(let i=0;i<n;i++){const sp=(i-(n-1)/2)*(.45+R()*.25)+(R()-.5)*.25;br(x2,y2,len*(.68+R()*.12),a+sp,d-1,wd*.66)}};
  c.fillStyle='#0c0806';c.beginPath();c.moveTo(x-22*u,y);c.quadraticCurveTo(x-10*u,y-len*.2,x-7*u,y-len*.35);c.lineTo(x+7*u,y-len*.35);c.quadraticCurveTo(x+12*u,y-len*.2,x+26*u,y);c.fill();br(x,y-len*.3,len*.75,ang,depth,16*u)}
/* ---------- 生活片段：细白线条，黑白蓝，角色自称「我」 ---------- */
const LINE='rgba(242,244,248,.9)';
function ln(c,u,wd=1.6){c.strokeStyle=LINE;c.lineWidth=wd*u;c.lineCap='round';c.lineJoin='round'}
/* 线条一笔笔画出来：p 从 0 到 1 */
function drawOn(c,p,L,fn){if(p<=0)return;c.save();c.setLineDash([L*cl(p),L*2]);fn();c.restore()}
function steam(c,x,y,u,t,n=3,hgt=120,col='rgba(255,255,255,'){for(let i=0;i<n;i++){const ph=t*.9+i*1.7;for(let k=0;k<3;k++){const q=((t*.35+i*.33+k*.33)%1);c.strokeStyle=col+(Math.sin(q*Math.PI)*.45)+')';c.lineWidth=2*u;c.beginPath();for(let s=0;s<=20;s++){const f=s/20,yy=y-(q*.6+f*.4)*hgt*u,xx=x+(i-(n-1)/2)*22*u+Math.sin(f*5+ph+k)*8*u;s?c.lineTo(xx,yy):c.moveTo(xx,yy)}c.stroke()}}}
function caption(c,w,h,u,s,a,sub){txt(c,s,w/2,h*.8,24*u,{font:SERIF,color:INK,a,ls:3*u});if(sub)txt(c,sub,w/2,h*.85,13*u,{color:MUTE,a:a*.9,ls:3*u})}
const C=[
 {n:'生病',d:'体温一点点往上跳，床头一杯水冒着热气。我说的话在下面。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%9,v=(36.8+(Math.min(41,Math.max(37,+o.temp||38.6))-36.8)*eio((T-.5)/2.5)).toFixed(1);txt(c,v+'°',w/2,h*.3,86*u,{weight:200,color:v>=38?'#a9c8ff':INK});txt(c,'体温',w/2,h*.38,13*u,{color:MUTE,ls:6*u});
  const cx=w/2,cy=h*.6;ln(c,u);drawOn(c,(T-1.2)/1.2,900*u,()=>{c.beginPath();c.moveTo(cx-38*u,cy-40*u);c.lineTo(cx-30*u,cy+50*u);c.quadraticCurveTo(cx,cy+58*u,cx+30*u,cy+50*u);c.lineTo(cx+38*u,cy-40*u);c.stroke();c.beginPath();c.ellipse(cx,cy-40*u,38*u,8*u,0,0,TAU);c.stroke()});if(T>2.3)steam(c,cx,cy-52*u,u,t,2,90);
  caption(c,w,h,u,o.line||'',cl((T-3.2)/.8)*(1-cl((T-8.2)/.6)),o.sub||'')}},
 {n:'吃饭',d:'一碗热汤和一双筷子，热气慢慢往上冒。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%9,cx=w/2,cy=h*.5;ln(c,u);drawOn(c,(T-.4)/1.4,1200*u,()=>{c.beginPath();c.moveTo(cx-90*u,cy);c.quadraticCurveTo(cx-86*u,cy+80*u,cx,cy+86*u);c.quadraticCurveTo(cx+86*u,cy+80*u,cx+90*u,cy);c.stroke();c.beginPath();c.ellipse(cx,cy,90*u,14*u,0,0,TAU);c.stroke();c.beginPath();c.moveTo(cx-24*u,cy+86*u);c.lineTo(cx-20*u,cy+98*u);c.lineTo(cx+20*u,cy+98*u);c.lineTo(cx+24*u,cy+86*u);c.stroke()});
  drawOn(c,(T-1.6)/.8,400*u,()=>{c.strokeStyle=BL(.9);c.beginPath();c.moveTo(cx+40*u,cy-110*u);c.lineTo(cx+130*u,cy+20*u);c.moveTo(cx+56*u,cy-116*u);c.lineTo(cx+142*u,cy+12*u);c.stroke()});if(T>2)steam(c,cx,cy-18*u,u,t,3,130);
  caption(c,w,h,u,o.line||'',cl((T-3)/.8)*(1-cl((T-8.2)/.6)),o.sub||'')}},
 {n:'礼物',d:'一个线条画的礼盒，丝带松开，盖子掀起来，里面冒出一点光。',p:parts(40,61,R=>({a:-Math.PI/2+(R()-.5)*1.4,v:.5+R(),r:R()})),draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%9,cx=w/2,cy=h*.52,bw=120*u,bh=90*u,lift=eo((T-2.6)/1);ln(c,u);drawOn(c,(T-.4)/1.4,1400*u,()=>{c.strokeRect(cx-bw/2,cy,bw,bh);c.beginPath();c.moveTo(cx,cy);c.lineTo(cx,cy+bh);c.stroke()});
  c.save();c.translate(cx-bw/2-6*u,cy);c.rotate(-lift*.5);c.translate(0,-lift*30*u);drawOn(c,(T-1)/1,600*u,()=>{ln(c,u);c.strokeRect(0,-22*u,bw+12*u,22*u);c.strokeStyle=BL(.95);c.beginPath();c.moveTo(bw/2+6*u,-22*u);c.bezierCurveTo(bw/2-30*u,-60*u,bw/2-40*u,-20*u,bw/2+6*u,-22*u);c.bezierCurveTo(bw/2+40*u,-60*u,bw/2+50*u,-20*u,bw/2+6*u,-22*u);c.stroke()});c.restore();
  if(lift>.3){glow(c,cx,cy,h*.12*lift,'rgba(170,200,255,A)',.35*lift);this.p.forEach((p,i)=>{const q=((T-3)*.4*p.v+p.r)%1;if(T<3)return;const d=q*h*.25;c.fillStyle='rgba(255,255,255,'+(1-q)*.8+')';c.beginPath();c.arc(cx+Math.cos(p.a)*d,cy+Math.sin(p.a)*d,1.6*u,0,TAU);c.fill()})}
  caption(c,w,h,u,o.line||'',cl((T-4)/.8)*(1-cl((T-8.2)/.6)))}},
 {n:'契约',d:'一张约定书，两个名字一笔笔签上去，最后盖一个蓝色的印。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%10,x=w*.12,y=h*.22,pw=w*.76,ph=h*.5;c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=u;c.strokeRect(x,y,pw,ph);c.strokeRect(x+8*u,y+8*u,pw-16*u,ph-16*u);txt(c,o.title||'约 定 书',w/2,y+50*u,26*u,{font:SERIF,color:INK,ls:6*u});
  (Array.isArray(o.rules)&&o.rules.length?o.rules:['……']).slice(0,3).forEach((s,i)=>{const p=cl((T-.6-i*.7)/.6);c.save();c.beginPath();c.rect(x+30*u,0,(pw-60*u)*p,h);c.clip();txt(c,s,x+36*u,y+110*u+i*40*u,17*u,{align:'left',font:SERIF,color:INK});c.restore()});
  [[o.her||'',x+pw*.28,3],[o.him||'',x+pw*.72,4.3]].forEach(([n,sx,st])=>{const p=cl((T-st)/1.1);c.fillStyle='rgba(255,255,255,.3)';c.fillRect(sx-60*u,y+ph-60*u,120*u,u);c.save();c.beginPath();c.rect(sx-60*u,0,120*u*p,h);c.clip();txt(c,n,sx,y+ph-76*u,24*u,{font:SERIF,color:INK});c.restore()});
  const sp=cl((T-5.8)/.3);if(sp>0){const s=1.6-.6*eo(sp);c.save();c.translate(x+pw*.82,y+ph-90*u);c.scale(s,s);c.rotate(-.2);c.globalAlpha=cl(sp*2.5)*.9;c.strokeStyle=BLUE;c.lineWidth=3*u;c.beginPath();c.arc(0,0,34*u,0,TAU);c.stroke();c.beginPath();c.arc(0,0,28*u,0,TAU);c.stroke();txt(c,String(o.seal||'永久').slice(0,2),0,0,18*u,{font:SERIF,weight:700,color:BLUE});c.restore()}
  caption(c,w,h,u,o.line||'',cl((T-6.6)/.8)*(1-cl((T-9.3)/.6)))}},
 {n:'约定',d:'一页日历，其中一天被笔圈起来，旁边写着「说好了」。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%9,x0=w*.12,y0=h*.3,cw=w*.76/7,ch=40*u;const _d=String(o.date||'').match(/(\d{4})-(\d{1,2})-(\d{1,2})/),_Y=_d?+_d[1]:2026,_M=_d?+_d[2]:11,_D=_d?+_d[3]:15,_off=new Date(_Y,_M-1,1).getDay(),_n=new Date(_Y,_M,0).getDate();txt(c,_M+' 月',w/2,y0-50*u,24*u,{font:SERIF,color:INK,ls:8*u});['日','一','二','三','四','五','六'].forEach((d,i)=>txt(c,d,x0+cw*(i+.5),y0-14*u,12*u,{color:MUTE}));
  for(let d=1;d<=_n;d++){const k=d+_off-1,col=k%7,row=Math.floor(k/7),x=x0+cw*(col+.5),y=y0+ch*(row+.5);txt(c,String(d),x,y,15*u,{color:d===_D?INK:'rgba(255,255,255,.45)',a:cl((T-.2-d*.02)/.4)})}
  const k=_D+_off-1,cx=x0+cw*(k%7+.5),cy=y0+ch*(Math.floor(k/7)+.5);c.strokeStyle=BLUE;c.lineWidth=2.4*u;drawOn(c,(T-1.5)/1,400*u,()=>{c.beginPath();for(let a=0;a<=TAU*1.08;a+=.1){const r=1+.08*Math.sin(a*3);const xx=cx+Math.cos(a-1)*22*u*r,yy=cy+Math.sin(a-1)*16*u*r;a?c.lineTo(xx,yy):c.moveTo(xx,yy)}c.stroke()});
  const p=cl((T-2.7)/.8);c.save();c.beginPath();c.rect(cx+26*u,0,110*u*p,h);c.clip();txt(c,o.note||'说好了',cx+30*u,cy-26*u,16*u,{align:'left',font:SERIF,color:BLUE});c.restore();caption(c,w,h,u,o.line||'',cl((T-3.6)/.8)*(1-cl((T-8.2)/.6)))}},
 {n:'记住',d:'像按下快门：屏幕一黑一闪，画面被定格进取景框，写着「已记住」。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%8;softText(c,o.text||'',w/2,h*.47,32*u,{font:SERIF,color:INK},T<1.6?(1-cl(T/1.2))*10*u:0);
  if(T>1.6&&T<2.1){const p=(T-1.6)/.5,cl2=Math.sin(p*Math.PI);c.fillStyle='#000';c.fillRect(0,0,w,h*.5*cl2);c.fillRect(0,h-h*.5*cl2,w,h*.5*cl2)}if(T>2.05&&T<2.4){c.fillStyle='rgba(255,255,255,'+(1-(T-2.05)/.35)*.8+')';c.fillRect(0,0,w,h)}
  if(T>2.1){const m=24*u,L=40*u,x0=w*.12,y0=h*.36,x1=w*.88,y1=h*.58;c.strokeStyle=INK;c.lineWidth=2*u;[[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]].forEach(([x,y,sx,sy])=>{c.beginPath();c.moveTo(x,y+sy*L);c.lineTo(x,y);c.lineTo(x+sx*L,y);c.stroke()});c.fillStyle='#d8434f';c.beginPath();c.arc(x0+18*u,y0-24*u,4*u,0,TAU);c.fill();txt(c,'REC',x0+30*u,y0-24*u,11*u,{align:'left',color:INK});txt(c,o.stamp||'',x1,y1+22*u,11*u,{align:'right',color:MUTE});txt(c,'已记住',w/2,h*.66,18*u,{color:BLUE,a:cl((T-2.8)/.6),ls:8*u})}
  caption(c,w,h,u,o.line||'',cl((T-3.4)/.8)*(1-cl((T-7.3)/.6)))}},
];
/* ---------- 有情绪的文字 ---------- */
function charsLine(c,s,size,font){c.font=size+'px '+font;const ws=[...s].map(ch=>c.measureText(ch).width);return{ws,total:ws.reduce((a,b)=>a+b,0)}}
const E=[
 {n:'呼吸',d:'字像在呼吸：慢慢吸气变亮、变大一点，再慢慢呼出去。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,b=(1-Math.cos(t*TAU/4.2))/2;glow(c,w/2,h*.47,h*(.12+.05*b),'rgba(127,176,255,A)',.08+.1*b);txt(c,o.text||'我在',w/2,h*.47,(54+5*b)*u,{font:SERIF,color:INK,a:.55+.45*b,ls:(10+4*b)*u});txt(c,o.sub||'',w/2,h*.55,15*u,{color:MUTE,a:.3+.4*b,ls:6*u})}},
 {n:'难过',d:'字一个个往下坠、变淡，像眼泪滑下去，留下一道细痕。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%9,s=String(o.text||'……'),size=Math.min(40,520/Math.max(1,[...String(o.text||'')].length))*u,{ws,total}=charsLine(c,s,size,SERIF);let x=w/2-total/2;[...s].forEach((ch,i)=>{const R=rng(i*5+1),d=eio((T-2.2-R()*2.2)/2.6),a=cl((T-.3-i*.12)/.6)*(1-d*.85),y=h*.46+d*h*.18;if(d>0){c.strokeStyle=BL(.25*(1-d));c.lineWidth=1.2*u;c.beginPath();c.moveTo(x+ws[i]/2,h*.47);c.lineTo(x+ws[i]/2,y);c.stroke()}softText(c,ch,x+ws[i]/2,y,size,{font:SERIF,a,color:d>.2?'#b9cbe6':INK},d*6*u);x+=ws[i]})}},
 {n:'生气',d:'字一个个重重砸下来，屏幕跟着一震。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%7,s=String(o.text||'……'),size=Math.min(58,560/Math.max(1,[...String(o.text||'')].length))*u,{ws,total}=charsLine(c,s,size,SERIF);let shake=0;[...s].forEach((ch,i)=>{const q=T-.6-i*.35;if(q>0&&q<.18)shake=Math.max(shake,(1-q/.18)*7*u)});c.save();c.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);let x=w/2-total/2;[...s].forEach((ch,i)=>{const p=cl((T-.6-i*.35)/.14);if(p<=0){x+=ws[i];return}const sc=2.2-1.2*p;c.save();c.translate(x+ws[i]/2,h*.47);c.scale(sc,sc);txt(c,ch,0,0,size,{font:SERIF,weight:700,color:INK,a:p});c.restore();if(p>=1&&T-.6-i*.35<.35){const k=(T-.74-i*.35)/.2;c.strokeStyle='rgba(255,255,255,'+(1-k)*.5+')';c.lineWidth=1.5*u;for(let j=-1;j<=1;j+=2){c.beginPath();c.moveTo(x+ws[i]/2+j*ws[i]*.55,h*.47+size*.45);c.lineTo(x+ws[i]/2+j*ws[i]*(.75+k*.3),h*.47+size*.6);c.stroke()}}x+=ws[i]});c.restore();txt(c,o.sub||'',w/2,h*.57,16*u,{color:MUTE,a:cl((T-3)/.6),ls:4*u})}},
 {n:'开心',d:'字一个个蹦起来，像在笑，旁边冒出小星星。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,s=String(o.text||'……'),size=Math.min(50,540/Math.max(1,[...String(o.text||'')].length))*u,{ws,total}=charsLine(c,s,size,SERIF);let x=w/2-total/2;[...s].forEach((ch,i)=>{const ph=t*4.2-i*.55,j=Math.max(0,Math.sin(ph))*22*u,sq=1+Math.max(0,-Math.sin(ph))*.08;c.save();c.translate(x+ws[i]/2,h*.47-j);c.scale(1+(sq-1),1/sq);txt(c,ch,0,0,size,{font:SERIF,color:i===[...s].length-1?BLUE:INK});c.restore();x+=ws[i]});for(let k=0;k<6;k++){const q=(t*.7+k/6)%1,R=rng(k*3+Math.floor(t*.7+k/6)),sx=w*(.2+R()*.6),sy=h*(.38+R()*.2)-q*30*u,a=Math.sin(q*Math.PI);c.strokeStyle=BL(a*.9);c.lineWidth=1.4*u;const r=5*u;c.beginPath();c.moveTo(sx-r,sy);c.lineTo(sx+r,sy);c.moveTo(sx,sy-r);c.lineTo(sx,sy+r);c.stroke()}}},
 {n:'心动',d:'一个「你」字像心跳一样怦怦跳两下，一圈光荡开。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,q=t%1.3,beat=Math.exp(-Math.pow((q-.12)/.06,2))+.7*Math.exp(-Math.pow((q-.36)/.06,2));glow(c,w/2,h*.46,h*(.1+.05*beat),'rgba(127,176,255,A)',.12+.25*beat);const r=(q/1.3)*h*.3;c.strokeStyle=BL(.35*(1-q/1.3));c.lineWidth=1.5*u;c.beginPath();c.arc(w/2,h*.46,r,0,TAU);c.stroke();txt(c,String(o.text||'你').slice(0,3),w/2,h*.46,(96+16*beat)*u/Math.max(1,[...String(o.text||'你').slice(0,3)].length*.7),{font:SERIF,color:INK});txt(c,o.sub||'',w/2,h*.6,16*u,{color:MUTE,ls:6*u})}},
 {n:'想说又删掉',d:'打了一句话，停住，一个字一个字删掉，换成另一句。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%12,a=String(o.typed||'……'),b=String(o.sent||'……'),ta=Math.floor(cl((T-.5)/2.4)*a.length),del=Math.floor(cl((T-4.2)/1.6)*a.length),tb=Math.floor(cl((T-6.6)/1.2)*b.length);const show=T<6.6?a.slice(0,Math.max(0,ta-del)):b.slice(0,tb);rr(c,w*.08,h*.44,w*.84,58*u,29*u);c.fillStyle='rgba(255,255,255,.06)';c.fill();c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=u;c.stroke();c.font=22*u+'px '+SANS;const tw=c.measureText(show).width;txt(c,show,w*.12,h*.44+29*u,22*u,{align:'left',color:INK});if(Math.floor(t*2.2)%2){c.fillStyle=BLUE;c.fillRect(w*.12+tw+3*u,h*.44+16*u,2.4*u,26*u)}if(T>3&&T<4.2)txt(c,'……',w/2,h*.4,16*u,{color:MUTE,a:.6});if(T>8.6){const p=eo((T-8.6)/.6);c.save();c.globalAlpha=p;bubble(c,w,h,b,1,h*.3,1,u);c.restore()}txt(c,o.line||'',w/2,h*.62,15*u,{color:MUTE,a:cl((T-9.4)/.6)*(1-cl((T-11.4)/.5)),ls:4*u})}},
 {n:'低语',d:'很小、很淡的字慢慢浮出来，像凑在耳边说的。',draw(c,w,h,t,o){o=o||{};base(c,w,h);const u=h/1000,T=t%9;softText(c,(o.lines||[])[0]||'',w/2,h*.42,13*u,{color:MUTE,a:cl((T-.6)/1.5)*.8},(1-cl((T-.6)/1.5))*3*u);softText(c,(o.lines||[])[1]||'',w/2,h*.48,17*u,{color:INK,a:cl((T-2)/2.2)*.85,ls:3*u},(1-cl((T-2)/2))*5*u);softText(c,(o.lines||[])[2]||'',w/2,h*.535,12*u,{color:BLUE,a:cl((T-4.6)/1.6)*.7},(1-cl((T-4.6)/1.6))*3*u)}},
];

/* ---------- 声音：全部用代码合成，跟着画面的时间点响 ---------- */
const SND={ac:null,master:null,bufs:{},on:null,nodes:[],gains:{}};
function sndInit(){if(SND.ac)return SND.ac;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;SND.ac=new AC();SND.master=SND.ac.createGain();SND.master.gain.value=.9;const comp=SND.ac.createDynamicsCompressor();SND.master.connect(comp);comp.connect(SND.ac.destination);return SND.ac}
function noiseBuf(kind){if(SND.bufs[kind])return SND.bufs[kind];const ac=SND.ac,n=ac.sampleRate*4,b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);let l=0,b0=0,b1=0,b2=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;if(kind==='brown'){l=(l+.02*w)/1.02;d[i]=l*3.5}else if(kind==='pink'){b0=.997*b0+w*.029;b1=.985*b1+w*.032;b2=.95*b2+w*.048;d[i]=(b0+b1+b2+w*.02)*.9}else d[i]=w*.5}return SND.bufs[kind]=b}
function keep(n){SND.nodes.push(n);return n}
/* 一直响的底：噪声 → 滤波 → 音量 */
function bed(kind,filters,vol,key){const ac=SND.ac,src=keep(ac.createBufferSource());src.buffer=noiseBuf(kind);src.loop=true;let node=src;filters.forEach(([type,f,q])=>{const bq=keep(ac.createBiquadFilter());bq.type=type;bq.frequency.value=f;if(q)bq.Q.value=q;node.connect(bq);node=bq});const g=keep(ac.createGain());g.gain.value=0;g.gain.linearRampToValueAtTime(vol,ac.currentTime+1.2);node.connect(g);g.connect(SND.master);src.start();if(key)SND.gains[key]=g;return g}
function drone(freqs,vol){/* 现在没有特效用它：她不要嗡嗡的底 */const ac=SND.ac,g=keep(ac.createGain());g.gain.value=0;g.gain.linearRampToValueAtTime(vol,ac.currentTime+2);g.connect(SND.master);freqs.forEach((f,i)=>{const o=keep(ac.createOscillator());o.type='sine';o.frequency.value=f;o.detune.value=(i%2?6:-6);o.connect(g);o.start()});return g}
function env(dur,vol,attack=.005){const ac=SND.ac,g=ac.createGain(),t=ac.currentTime;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);g.connect(SND.master);return g}
function tone(f,dur,vol,type='sine',f2){const ac=SND.ac,o=ac.createOscillator(),g=env(dur,vol);o.type=type;o.frequency.setValueAtTime(f,ac.currentTime);if(f2)o.frequency.exponentialRampToValueAtTime(f2,ac.currentTime+dur);o.connect(g);o.start();o.stop(ac.currentTime+dur+.05)}
function burst(dur,vol,type,f,q,kind='white',attack=.002){const ac=SND.ac,s=ac.createBufferSource();s.buffer=noiseBuf(kind);const bq=ac.createBiquadFilter();bq.type=type;bq.frequency.value=f;if(q)bq.Q.value=q;const g=env(dur,vol,attack);s.connect(bq);bq.connect(g);s.start(0,Math.random()*3);s.stop(ac.currentTime+dur+.05)}
const S_={
 beep:()=>{tone(1046,.14,.22,'sine')},
 click:()=>{burst(.03,.35,'highpass',2500,0);tone(1800,.02,.05,'square')},
 back:()=>{burst(.03,.25,'bandpass',1200,2)},
 pop:()=>{tone(420,.12,.25,'sine',880)},
 ding:()=>{tone(1318,.6,.18,'sine');setTimeout(()=>SND.ac&&tone(1760,.8,.14,'sine'),110)},
 chime:()=>{[1568,2093,2637].forEach((f,i)=>setTimeout(()=>SND.ac&&tone(f,1.4,.07,'sine'),i*70))},
 thump:(v=.6)=>{tone(120,.35,v,'sine',45);burst(.08,.25,'lowpass',900,0)},
 heart:()=>{tone(70,.18,.7,'sine',40);setTimeout(()=>SND.ac&&tone(62,.2,.5,'sine',38),230)},
 drip:()=>{tone(900+Math.random()*500,.18,.16,'sine',300+Math.random()*200)},
 plip:()=>{const ac=SND.ac,o=ac.createOscillator(),lp=ac.createBiquadFilter(),g=env(.35,.07,.015);o.frequency.setValueAtTime(620,ac.currentTime);o.frequency.exponentialRampToValueAtTime(260,ac.currentTime+.18);lp.type='lowpass';lp.frequency.value=1200;o.connect(lp);lp.connect(g);o.start();o.stop(ac.currentTime+.4)},
 shutter:()=>{burst(.04,.5,'highpass',1800,0);setTimeout(()=>SND.ac&&burst(.05,.4,'bandpass',1500,1),90)},
 whoosh:(d=1.2,v=.25)=>{const ac=SND.ac,s=ac.createBufferSource();s.buffer=noiseBuf('pink');const bq=ac.createBiquadFilter();bq.type='bandpass';bq.Q.value=1.2;bq.frequency.setValueAtTime(300,ac.currentTime);bq.frequency.exponentialRampToValueAtTime(2400,ac.currentTime+d);const g=env(d,v,d*.6);s.connect(bq);bq.connect(g);s.start();s.stop(ac.currentTime+d+.1)},
 boom:()=>{tone(80,1.2,.6,'sine',30);burst(.9,.35,'lowpass',500,0,'brown',.01)},
 crackle:()=>{for(let i=0;i<12;i++)setTimeout(()=>SND.ac&&burst(.02,.18+Math.random()*.2,'highpass',3000+Math.random()*3000,0),Math.random()*900)},
 whistle:()=>{tone(700,.9,.06,'sine',1700);burst(.9,.06,'bandpass',2500,4,'white',.3)},
 scratch:(d=.8)=>{const ac=SND.ac,t=ac.currentTime,s=ac.createBufferSource();s.buffer=noiseBuf('white');const bp=ac.createBiquadFilter();bp.type='bandpass';bp.frequency.value=3000;bp.Q.value=.9;const g=ac.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.09,t+.04);for(let k=1;k<d*10;k++)g.gain.linearRampToValueAtTime(.05+Math.random()*.06,t+k*.1);g.gain.linearRampToValueAtTime(0,t+d);s.connect(bp);bp.connect(g);g.connect(SND.master);s.start(t,Math.random()*2);s.stop(t+d+.05)},
 pencil:(d=.35)=>{const ac=SND.ac,t=ac.currentTime,s=ac.createBufferSource();s.buffer=noiseBuf('white');const bp=ac.createBiquadFilter();bp.type='bandpass';bp.Q.value=1.1;bp.frequency.setValueAtTime(2200,t);bp.frequency.linearRampToValueAtTime(4200,t+d);const g=ac.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.16,t+d*.25);g.gain.linearRampToValueAtTime(.1,t+d*.8);g.gain.linearRampToValueAtTime(0,t+d);s.connect(bp);bp.connect(g);g.connect(SND.master);s.start(t,Math.random()*2);s.stop(t+d+.05)},
 chirp:()=>{const ac=SND.ac;for(let k=0;k<2+Math.floor(Math.random()*2);k++)setTimeout(()=>{if(!SND.ac)return;const o=ac.createOscillator(),g=env(.12,.06);o.frequency.setValueAtTime(3200,ac.currentTime);o.frequency.exponentialRampToValueAtTime(4800,ac.currentTime+.08);o.connect(g);o.start();o.stop(ac.currentTime+.15)},k*140)},
 cricket:()=>{for(let k=0;k<3;k++)setTimeout(()=>SND.ac&&tone(4600,.04,.04,'sine'),k*55)},
 tick:()=>{burst(.015,.2,'highpass',4000,0)},
 note:(f=220)=>{tone(f,2.4,.18,'triangle');tone(f*2,1.8,.05,'sine')},
 bloop:(i=0)=>{tone(520+i*90,.13,.18,'sine',780+i*120)},
 sparkle:()=>{for(let i=0;i<6;i++)setTimeout(()=>SND.ac&&tone(2000+Math.random()*2500,.25,.04,'sine'),i*60)},
 rustle:()=>{burst(.5,.12,'bandpass',1800,.8,'pink',.12)},
 car:()=>{const ac=SND.ac,t=ac.currentTime,d=2+Math.random()*1.5,s=ac.createBufferSource();s.buffer=noiseBuf('pink');const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(400,t);lp.frequency.linearRampToValueAtTime(1800,t+d*.5);lp.frequency.linearRampToValueAtTime(500,t+d);const g=ac.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.16+Math.random()*.1,t+d*.5);g.gain.linearRampToValueAtTime(0,t+d);s.connect(lp);lp.connect(g);g.connect(SND.master);s.start(t,Math.random()*2);s.stop(t+d+.05)},
 horn:()=>{const ac=SND.ac,g=env(.35,.025,.02);[392,494].forEach(f=>{const o=ac.createOscillator(),lp=ac.createBiquadFilter();o.type='square';o.frequency.value=f*(.9+Math.random()*.2);lp.type='lowpass';lp.frequency.value=900;o.connect(lp);lp.connect(g);o.start();o.stop(ac.currentTime+.4)})},
};
/* 某个时间点在 (t0,t1] 之间就响：period 是画面循环的长度，at 是画面里对应的时刻 */
function cross(t0,t1,period,at){const a=Math.floor((t0-at)/period),b=Math.floor((t1-at)/period);return b>a}
const rain=(lp=6000,v=.22)=>()=>bed('pink',[['highpass',500],['lowpass',lp]],v);
const wind=(v=.18,f=500)=>()=>{bed('brown',[['lowpass',f]],v,'wind')};
const AU={
 '细雪':{bed:[wind(.12,400)]},'大雪慢落':{bed:[wind(.2,500)]},
 '细雨':{bed:[rain(7000,.26)]},
 '雨打玻璃':{bed:[rain(1800,.2)],ev:(t0,t1)=>{if(Math.random()<.04)S_.drip()}},
 '窗边夜雨':{bed:[rain(1300,.2),()=>bed('pink',[['bandpass',700,.7]],0,'curtain')],ev:(t0,t1)=>{const g=SND.gains.curtain;if(g)g.gain.setTargetAtTime(.05+.12*Math.max(0,Math.sin(t1*1.3)),SND.ac.currentTime,.1)}},
 '树影摇曳':{bed:[()=>bed('pink',[['bandpass',1400,.6]],0,'leaves')],ev:(t0,t1)=>{const g=SND.gains.leaves,gust=Math.sin(t1*.45)*.6+Math.sin(t1*1.3)*.25;if(g)g.gain.setTargetAtTime(.05+.1*Math.max(0,gust+.4),SND.ac.currentTime,.2);if(Math.random()<.006)S_.chirp()}},
 '星空':{ev:()=>{if(Math.random()<.006)S_.sparkle()}},
 '流星':{ev:(t0,t1)=>{for(let k=0;k<2;k++)if(cross(t0,t1,5.5,(5.5-k*2.7%5.5)%5.5))S_.whoosh(1,.12)}},
 '萤火虫':{bed:[wind(.06,300)],ev:()=>{if(Math.random()<.05)S_.cricket()}},
 '樱花':{bed:[wind(.1,600)],ev:()=>{if(Math.random()<.004)S_.chime()}},
 '落叶':{bed:[wind(.16,700)],ev:()=>{if(Math.random()<.02)S_.rustle()}},
 '极光':{bed:[wind(.06,300)]},'薄雾':{bed:[wind(.16,350)]},
 '城市夜光斑':{bed:[()=>bed('pink',[['highpass',250],['lowpass',1100]],.07)],ev:()=>{if(Math.random()<.018)S_.car();if(Math.random()<.0015)S_.horn()}},
 '海面月光':{bed:[()=>bed('pink',[['highpass',180],['lowpass',1400]],0,'sea')],ev:(t0,t1)=>{const g=SND.gains.sea;if(g)g.gain.setTargetAtTime(.03+.3*Math.pow((Math.sin(t1*TAU/7)+1)/2,3),SND.ac.currentTime,.3)}},
 '海上日落':{bed:[()=>bed('pink',[['highpass',180],['lowpass',1400]],0,'sea')],ev:(t0,t1)=>{const g=SND.gains.sea;if(g)g.gain.setTargetAtTime(.03+.3*Math.pow((Math.sin(t1*TAU/8)+1)/2,3),SND.ac.currentTime,.3)}},
 '老电视':{bed:[()=>bed('white',[['bandpass',3200,.5]],.09)],ev:()=>{if(Math.random()<.05)S_.tick()}},
 '上浮光点':{},
 '烟花':{ev:(t0,t1)=>{for(let k=0;k<3;k++){const off=(4.2-k*1.4%4.2)%4.2;if(cross(t0,t1,4.2,off))S_.whistle();if(cross(t0,t1,4.2,(off+.9)%4.2))S_.boom();if(cross(t0,t1,4.2,(off+2.3)%4.2))S_.crackle()}}},
 '心跳线':{ev:(t0,t1)=>{const P=1.3/.35;[.5/3,1.5/3,2.5/3].forEach(v=>{if(cross(t0,t1,P,v/.35))S_.beep()})}},
 '涟漪':{bed:[wind(.05,300)],ev:(t0,t1)=>{for(let k=0;k<6;k++)if(cross(t0,t1,3.6,(3.6-k*.6%3.6)%3.6))S_.plip()}},
 '两颗星':{ev:(t0,t1)=>{if(cross(t0,t1,14,3.1))S_.chime()}},
 '路灯':{bed:[rain(3000,.14)]},
 '丁达尔光束':{},
 '晴天光斑':{},
 '生病':{ev:(t0,t1)=>{if(cross(t0,t1,9,3.0)){S_.beep();setTimeout(()=>SND.ac&&S_.beep(),220)}}},
 '吃饭':{bed:[()=>bed('pink',[['bandpass',900,.5]],.025)],ev:(t0,t1)=>{if(cross(t0,t1,9,2.4))S_.tick()}},
 '礼物':{ev:(t0,t1)=>{if(cross(t0,t1,9,2.6))S_.rustle();if(cross(t0,t1,9,3.1))S_.sparkle()}},
 '契约':{ev:(t0,t1)=>{[.6,1.3,2].forEach(a=>{if(cross(t0,t1,10,a))S_.scratch(.6)});if(cross(t0,t1,10,3))S_.scratch(1.1);if(cross(t0,t1,10,4.3))S_.scratch(1.1);if(cross(t0,t1,10,5.8))S_.thump(.5)}},
 '约定':{ev:(t0,t1)=>{if(cross(t0,t1,9,1.5))S_.pencil(1);if(cross(t0,t1,9,2.7))S_.scratch(.7)}},
 '记住':{ev:(t0,t1)=>{if(cross(t0,t1,8,1.6))S_.shutter()}},
 '开场 · 一道光':{ev:(t0,t1)=>{if(cross(t0,t1,8,.3))S_.whoosh(1.1,.22);if(cross(t0,t1,8,1.4))S_.boom();if(cross(t0,t1,8,1.9))S_.chime()}},
 '开场 · 锁屏亮起':{ev:(t0,t1)=>{if(cross(t0,t1,9,1.9))S_.ding();if(cross(t0,t1,9,3.5))S_.click();if(cross(t0,t1,9,4))S_.whoosh(.9,.18);if(cross(t0,t1,9,4.9))S_.chime()}},
 '开场 · 从你那句话开始':{ev:(t0,t1)=>{if(cross(t0,t1,10,.6))S_.pop();if(cross(t0,t1,10,2.9))S_.pop();if(cross(t0,t1,10,4.3))S_.whoosh(1.1,.2);if(cross(t0,t1,10,5))S_.chime()}},
 '满屏飘字':{},
 '光点聚成字':{ev:(t0,t1)=>{if(cross(t0,t1,9,.5))S_.whoosh(2.3,.14);if(cross(t0,t1,9,2.9))S_.chime();if(cross(t0,t1,9,5.6))S_.whoosh(1.6,.16)}},
 '词语汇聚':{ev:(t0,t1)=>{if(cross(t0,t1,9,.4))S_.whoosh(3,.12);if(cross(t0,t1,9,4.3))S_.chime()}},
 '镜头对焦':{ev:(t0,t1)=>{if(cross(t0,t1,7,1))S_.whoosh(1.4,.08);if(cross(t0,t1,7,2.5))S_.tick()}},
 '记忆碎片':{ev:()=>{if(Math.random()<.01)S_.sparkle()}},
 '打字':{ev:(t0,t1)=>{for(let n=1;n<=14;n++)if(cross(t0,t1,7,.4+n/6))S_.click()}},
 '微信消息回放':{ev:(t0,t1)=>{for(let i=0;i<4;i++)if(cross(t0,t1,9,.6+i*1.2))S_.pop()}},
 '数字跳动':{ev:(t0,t1)=>{const T=t1%6;if(T>.4&&T<2.2&&Math.random()<.5)S_.tick();if(cross(t0,t1,6,2.2))S_.ding()}},
 '盖章':{ev:(t0,t1)=>{if(cross(t0,t1,5,1.2))S_.thump()}},
 '时间跳转':{ev:(t0,t1)=>{const T=t1%7;if(T>1&&T<3.5&&Math.floor(t1*6)!==Math.floor(t0*6))S_.tick()}},
 '锁屏通知':{ev:(t0,t1)=>{if(cross(t0,t1,8,.8)||cross(t0,t1,8,2.4))S_.ding()}},
 '划掉改写':{ev:(t0,t1)=>{if(cross(t0,t1,7,1.2))S_.pencil(.4);if(cross(t0,t1,7,2.8))S_.chime()}},
 '信纸':{ev:(t0,t1)=>{for(let i=0;i<5;i++)if(i!==3&&cross(t0,t1,9,.5+i*1.1))S_.scratch(.9)}},
 '呼吸':{bed:[()=>bed('pink',[['bandpass',600,.6]],0,'breath')],ev:(t0,t1)=>{const g=SND.gains.breath,b=(1-Math.cos(t1*TAU/4.2))/2;if(g)g.gain.setTargetAtTime(.02+.13*Math.sin(b*Math.PI)*(Math.sin(t1*TAU/4.2)>0?1:.7),SND.ac.currentTime,.15)}},
 '难过':{bed:[rain(1500,.08)],ev:(t0,t1)=>{if(cross(t0,t1,9,.3))S_.note(220);if(cross(t0,t1,9,2.2))S_.note(196);if(cross(t0,t1,9,4))S_.note(165)}},
 '生气':{ev:(t0,t1)=>{for(let i=0;i<5;i++)if(cross(t0,t1,7,.6+i*.35))S_.thump(.55)}},
 '开心':{ev:(t0,t1)=>{const P=TAU/4.2;for(let i=0;i<5;i++)if(cross(t0,t1,P,(i*.55/4.2)%P))S_.bloop(i)}},
 '心动':{ev:(t0,t1)=>{if(cross(t0,t1,1.3,.1))S_.heart()}},
 '想说又删掉':{ev:(t0,t1)=>{for(let n=1;n<=8;n++){if(cross(t0,t1,12,.5+n*2.4/8))S_.click();if(cross(t0,t1,12,4.2+n*1.6/8))S_.back()}for(let n=1;n<=4;n++)if(cross(t0,t1,12,6.6+n*1.2/4))S_.click();if(cross(t0,t1,12,8.6))S_.pop()}},
 '低语':{bed:[()=>bed('pink',[['bandpass',2500,1.5]],.015)]},
};
function sndStop(){SND.nodes.forEach(n=>{try{n.stop&&n.stop()}catch(_){}try{n.disconnect()}catch(_){}});SND.nodes=[];SND.gains={};SND.on=null}
function sndStart(name){sndStop();const a=AU[name];if(!a||!sndInit())return;if(SND.ac.state==='suspended')SND.ac.resume();(a.bed||[]).forEach(f=>f());SND.on=name}
let _sndPrev=null;function sndFrame(name,t){if(!SND.on||SND.on!==name){_sndPrev=t;return}const a=AU[name];if(a&&a.ev&&_sndPrev!=null&&t>_sndPrev&&t-_sndPrev<.5)a.ev(_sndPrev,t);_sndPrev=t}

/* ---------- 背景音乐：代码现场弹，不用音频文件 ---------- */
const MUS={out:null,rev:null,lp:null,timer:0,next:0,step:0,mood:null,nodes:[]};
const mf=m=>440*Math.pow(2,(m-69)/12);
function musInit(){const ac=sndInit();if(!ac)return null;if(MUS.out)return ac;MUS.out=ac.createGain();MUS.out.gain.value=.55;MUS.lp=ac.createBiquadFilter();MUS.lp.type='lowpass';MUS.lp.frequency.value=12000;MUS.rev=ac.createConvolver();
  const len=ac.sampleRate*3.2,ir=ac.createBuffer(2,len,ac.sampleRate);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}MUS.rev.buffer=ir;const wet=ac.createGain();wet.gain.value=.34;
  MUS.out.connect(MUS.lp);MUS.lp.connect(SND.master);MUS.lp.connect(MUS.rev);MUS.rev.connect(wet);wet.connect(SND.master);return ac}
function vEnv(t,a,peak,dec,dest){const g=SND.ac.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+dec);g.connect(dest||MUS.out);return g}
const INST={
 piano(m,t,v=.18,dec=2.6){const ac=SND.ac,f=mf(m),g=vEnv(t,.004,v,dec);[[1,1],[2,.42],[3,.16],[4,.07]].forEach(([k,a],i)=>{const o=ac.createOscillator(),gg=ac.createGain();o.frequency.value=f*k*(1+(i?.0008*i:0));gg.gain.value=a;gg.gain.setTargetAtTime(a*.2,t,.4/(k));o.connect(gg);gg.connect(g);o.start(t);o.stop(t+dec+.1)})},
 epiano(m,t,v=.14,dec=2){const ac=SND.ac,f=mf(m),g=vEnv(t,.006,v,dec),car=ac.createOscillator(),mod=ac.createOscillator(),mg=ac.createGain();car.frequency.value=f;mod.frequency.value=f*1;mg.gain.setValueAtTime(f*2.2,t);mg.gain.exponentialRampToValueAtTime(f*.15,t+.5);mod.connect(mg);mg.connect(car.frequency);car.connect(g);car.start(t);mod.start(t);car.stop(t+dec+.1);mod.stop(t+dec+.1)},
 bell(m,t,v=.09,dec=1.8){const ac=SND.ac,f=mf(m),g=vEnv(t,.002,v,dec);[[1,1],[2.76,.35],[5.4,.12]].forEach(([k,a])=>{const o=ac.createOscillator(),gg=ac.createGain();o.frequency.value=f*k;gg.gain.setValueAtTime(a,t);gg.gain.exponentialRampToValueAtTime(.001,t+dec/k);o.connect(gg);gg.connect(g);o.start(t);o.stop(t+dec+.1)})},
 pluck(m,t,v=.12,dec=.5){const ac=SND.ac,o=ac.createOscillator(),lp=ac.createBiquadFilter(),g=vEnv(t,.002,v,dec);o.type='triangle';o.frequency.value=mf(m);lp.type='lowpass';lp.frequency.setValueAtTime(3500,t);lp.frequency.exponentialRampToValueAtTime(600,t+dec);o.connect(lp);lp.connect(g);o.start(t);o.stop(t+dec+.1)},
 pad(ms,t,dur,v=.05,bright=1200){const ac=SND.ac,g=ac.createGain(),lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=bright;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+dur*.35);g.gain.linearRampToValueAtTime(v*.8,t+dur*.8);g.gain.linearRampToValueAtTime(0,t+dur+.6);lp.connect(g);g.connect(MUS.out);ms.forEach(m=>[-7,7].forEach(dt=>{const o=ac.createOscillator();o.type='sawtooth';o.frequency.value=mf(m);o.detune.value=dt;o.connect(lp);o.start(t);o.stop(t+dur+.8)}))},
 bass(m,t,v=.2,dec=.9){const ac=SND.ac,o=ac.createOscillator(),g=vEnv(t,.01,v,dec);o.type='sine';o.frequency.value=mf(m);o.connect(g);o.start(t);o.stop(t+dec+.1)},
 kick(t,v=.5){const ac=SND.ac,o=ac.createOscillator(),g=vEnv(t,.002,v,.32);o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(42,t+.2);o.connect(g);o.start(t);o.stop(t+.4)},
 snare(t,v=.12){const ac=SND.ac,s=ac.createBufferSource(),bp=ac.createBiquadFilter(),g=vEnv(t,.002,v,.18);s.buffer=noiseBuf('white');bp.type='bandpass';bp.frequency.value=1800;bp.Q.value=.7;s.connect(bp);bp.connect(g);s.start(t,Math.random()*2);s.stop(t+.25)},
 hat(t,v=.04){const ac=SND.ac,s=ac.createBufferSource(),hp=ac.createBiquadFilter(),g=vEnv(t,.001,v,.05);s.buffer=noiseBuf('white');hp.type='highpass';hp.frequency.value=7000;s.connect(hp);hp.connect(g);s.start(t,Math.random()*2);s.stop(t+.08)},
};
/* 和弦写成 MIDI 音高（低音, 和弦音…） */
const MOODS=[
 {id:'gentle',n:'温柔钢琴',d:'慢慢的琶音，像他在旁边轻轻说话。适合大部分片段。',bpm:72,div:2,bars:[[48,60,64,67,71],[47,59,62,67,74],[45,57,60,64,67],[41,57,60,64,69]],
  play(s,t,ch,bar,st){const i=s%8;if(i===0)INST.piano(ch[0],t,.2,3.4);const arp=[1,2,3,4,3,2,4,3];INST.piano(ch[arp[i]]+12,t,.09,2.2);if(i===4&&bar%2===1)INST.piano(ch[4]+12+(bar%4===1?2:0),t,.1,2.6)}},
 {id:'night',n:'深夜',d:'很稀的低音钢琴和一层薄薄的底，适合凌晨、安静、说心里话。',bpm:56,div:2,bars:[[45,57,60,64,71],[41,57,60,64,67],[48,55,59,64,67],[40,55,59,62,67]],
  play(s,t,ch,bar,st){const i=s%8;if(i===0){INST.pad(ch.slice(1,4).map(m=>m-12),t,st*8,.025,700);INST.piano(ch[0],t,.14,4)}const R=rng(s*7+3);if(i%2===0&&R()<.42)INST.piano(ch[1+Math.floor(R()*4)]+12,t,.07,3.5)}},
 {id:'sad',n:'难过',d:'小调，弦乐铺着，钢琴一个音一个音往下走，适合道歉、想念、难过。',bpm:58,div:2,bars:[[45,57,60,64],[41,57,60,65],[48,55,60,64],[40,56,59,64]],
  play(s,t,ch,bar,st){const i=s%8;if(i===0){INST.pad(ch.slice(1),t,st*8,.04,900);INST.piano(ch[0],t,.15,4)}const mel=[[76,74,72],[77,76,72],[79,76,74],[76,75,71]][bar%4];if(i===0||i===3||i===6)INST.piano(mel[i/3|0]-(bar%8>=4?12:0),t,.11,3)}},
 {id:'musicbox',n:'心动 · 音乐盒',d:'三拍子的音乐盒，叮叮咚咚，适合心动、礼物、约定。',bpm:84,div:1,beats:3,bars:[[48,60,64,67],[45,57,60,64],[41,57,60,65],[43,55,59,62]],
  play(s,t,ch,bar,st){const i=s%3,mel=[[76,79,84],[76,72,76],[77,81,79],[74,71,74]][bar%4];if(i===0)INST.bell(ch[0]+12,t,.06,2.2);INST.bell(mel[i]+(bar%8>=4?2:0)*(i===2?1:0),t,.07,1.6);if(i===1)INST.bell(ch[2]+12,t+st*.5,.03,1)}},
 {id:'lofi',n:'回忆 · 旧唱片',d:'温暖的电钢琴、轻轻的鼓和唱片底噪，适合回忆、翻聊天记录。',bpm:76,div:2,swing:.12,bars:[[50,60,65,69,72],[43,59,65,69,71],[48,59,64,67,71],[45,61,64,67,70]],crackle:true,
  play(s,t,ch,bar,st){const i=s%8;if(i===0||i===3)ch.slice(1).forEach((m,j)=>INST.epiano(m,t+j*.01,.06,i?1.2:2.2));if(i===0||i===5)INST.kick(t,.32);if(i===2||i===6)INST.snare(t,.07);INST.hat(t,i%2?.018:.03);if(i===0)INST.bass(ch[0]-12,t,.17,1.4)}},
 {id:'hope',n:'约定 · 慢慢变亮',d:'从很轻开始，一层层加进来，越来越满，适合结尾、约定、表白。',bpm:88,div:4,bars:[[48,60,64,67],[43,59,62,67],[45,57,60,64],[41,57,60,65]],
  play(s,t,ch,bar,st){const i=s%16,lv=Math.floor((bar%16)/4);if(i===0){INST.pad(ch.slice(1),t,st*16,.03+lv*.008,900+lv*500);INST.piano(ch[0],t,.16,3)}if(lv>=1&&i%2===0)INST.piano(ch[1+(i/2)%3]+12+(i>=8?12:0),t,.05+lv*.01,1.4);if(lv>=2&&i%4===0)INST.kick(t,.22);if(lv>=3){INST.hat(t,.02);if(i===4||i===12)INST.snare(t,.06)}}},
 {id:'quiet',n:'安静陪伴',d:'没有旋律，只有很轻、慢慢起伏的和声，适合配旁白、不想打扰。',bpm:50,div:1,bars:[[48,55,64,71],[45,52,60,67],[41,48,57,64],[43,50,59,62]],
  play(s,t,ch,bar,st){if(s%4===0)INST.pad(ch,t,st*4,.035,800)}},
];
function musStop(){clearInterval(MUS.timer);MUS.timer=0;MUS.mood=null;if(MUS.out&&SND.ac){const g=MUS.out.gain,now=SND.ac.currentTime;g.cancelScheduledValues(now);g.setValueAtTime(g.value,now);g.linearRampToValueAtTime(0,now+.6);setTimeout(()=>{if(!MUS.mood&&MUS.out)MUS.out.gain.value=.55},700)}if(MUS.crk){try{MUS.crk.stop()}catch(_){}MUS.crk=null}}
function musStart(id){const mood=MOODS.find(x=>x.id===id);if(!mood)return;musStop();const ac=musInit();if(!ac)return;if(ac.state==='suspended')ac.resume();setTimeout(()=>{MUS.out.gain.cancelScheduledValues(ac.currentTime);MUS.out.gain.value=.55;MUS.mood=mood;MUS.step=0;MUS.next=ac.currentTime+.1;
  if(mood.crackle){const s=ac.createBufferSource(),b=ac.createBuffer(1,ac.sampleRate*3,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()<.0009?(Math.random()-.5)*.8:(Math.random()-.5)*.012;s.buffer=b;s.loop=true;const g=ac.createGain();g.gain.value=.5;s.connect(g);g.connect(SND.master);s.start();MUS.crk=s}
  const st=60/mood.bpm/mood.div,per=(mood.beats||4)*mood.div;MUS.timer=setInterval(()=>{while(MUS.mood===mood&&MUS.next<ac.currentTime+.25){const s=MUS.step,bar=Math.floor(s/per),ch=mood.bars[bar%mood.bars.length],sw=mood.swing&&s%2===1?mood.swing*st*2:0;try{mood.play(s,MUS.next+sw,ch,bar,st)}catch(e){console.warn(e)}MUS.next+=st;MUS.step++}},40)},MUS.timer?0:30)}


/* ================= 角色视频：素材、提示词、剧本、制作、卡片、播放 ================= */
const TITLE='我眼中的你';
const SHOTS={};[[A,'A'],[C,'C'],[B,'B'],[E,'E']].forEach(([list,g])=>list.forEach(fx=>{SHOTS[fx.n]={fx,g}}));
/* 每个镜头：cyc 一轮多长；hold 播到这里就停住（null 表示一直循环）；slots 给角色看的填空说明 */
const META={
 '开场 · 一道光':[8,5.5,'黑屏里一道细光拉开，片名在光里变清楚。','sign：片名下面的一行落款（≤14字，比如「—— 某某，拍给你」）'],
 '开场 · 锁屏亮起':[9,7,'像手机锁屏亮起，你的一条通知弹进来，点开进入片名。','note：通知里你说的那句话（≤16字）'],
 '开场 · 从你那句话开始':[10,8,'先回放她刚才让你拍视频的那句话（程序自动填她的原话），你回一句，镜头推进你的消息变成片名。','reply：你回她的那句（≤10字）；line：片名下面的小字（≤12字）'],
 '满屏飘字':[0,null,'她说过的话从下往上飘，近的大远的小。','quotes：她的原话 8～16 句，每句≤14字'],
 '光点聚成字':[9,4.5,'满屏光点汇成一句话，再被吹散。','text：≤8字'],
 '词语汇聚':[9,6,'一个个词从四周飞向中间，最后出现一句总结。','quotes：词或短句 6～12 个，每个≤8字；line：最后那句（≤10字）'],
 '镜头对焦':[7,4.5,'字从模糊慢慢对上焦。','text：≤8字'],
 '记忆碎片':[0,null,'很多条她的小消息散在暗处，轮流亮起，中间一条最亮。','quotes：她的原话 8～16 句，每句≤10字；center：中间最亮那句（她的原话，≤12字）'],
 '打字':[7,5.5,'一个字一个字打出来。','text：≤24字'],
 '微信消息回放':[9,6.5,'回放你们真实聊过的几条微信，她在左，你在右。','date：那天的日期时间（如「10月8日 凌晨 02:14」）；msgs：2～4 条，{"who":"她"或"我","text":"原话，≤14字"}'],
 '字幕切换':[0,null,'电影字幕一样一句句淡入淡出。','lines：2～4 句，每句≤16字'],
 '逐字浮现':[6,4,'一句话的字从下往上一个个浮出来。','text：≤12字'],
 '数字跳动':[6,3.5,'一个数字从 0 跳到真实的值。','num：只能用「准确数字」里给的数；label：下面一行说明（≤12字）'],
 '盖章':[5,3,'先出现一行字，再「啪」地盖一个红章。','before：上面那行（≤10字）；stamp：章上的字（≤6字）'],
 '大字标题':[6,3,'一幕的标题，字距慢慢展开。','text：≤10字（比如「第一幕 · 凌晨」）'],
 '引用卡片':[6,3,'把她说过的一句话放进卡片，标上日期。','quote：她的原话（≤24字）；date：那天的日期'],
 '时间跳转':[7,4.5,'时钟数字往前走，表示过了一会儿。','date：日期那行（≤10字）；from、to：起止时间「HH:MM」；note：下面一行（≤10字）'],
 '锁屏通知':[8,4,'锁屏上弹进你发给她的通知。','notes：1～2 条你会发的消息，每条≤16字'],
 '时间线':[8,5.6,'几个日子按顺序亮起来。','items：2～4 个，{"date":"10月2日","text":"≤8字"}，日期要真实'],
 '划掉改写':[7,4.5,'先写一个词，划掉，换成另一个。','lead：前面的小字（≤6字）；wrong：被划掉的词（≤4字）；right：换上的词（≤4字）'],
 '声波':[0,null,'一排声波跟着跳。','text：≤14字'],
 '信纸':[9,7.6,'信纸上一行行写出来，最后落款。','lines：3～5 行，每行≤14字（可以留一行空）；sign：落款（≤8字）'],
 '生病':[9,7.5,'体温往上跳，床头一杯水冒热气。','temp：体温（37.5～40）；line：你说的话（≤16字）；sub：小字（≤10字）'],
 '吃饭':[9,7.5,'一碗热汤和一双筷子，冒着热气。','line：≤16字；sub：≤10字'],
 '礼物':[9,7.5,'礼盒的丝带松开、盖子掀起、冒出一点光。','line：≤18字'],
 '契约':[10,8.8,'一张约定书写着几条约定，两个名字签上去，盖一个蓝色印。','title：≤6字；rules：1～3 条，每条≤12字；seal：印上的字（≤2字）；line：≤14字'],
 '约定':[9,7.5,'一页日历，某一天被圈起来。','date：被圈的日子「YYYY-MM-DD」，要真实；note：圈旁边的字（≤4字）；line：≤14字'],
 '记住':[8,6.5,'像按下快门，一个画面被定格。','text：被定格的那个画面（≤10字）；stamp：时间（如「2026.10.15 20:45」）；line：≤14字'],
 '呼吸':[0,null,'字像在呼吸，慢慢变亮又暗下去。','text：≤4字；sub：≤8字'],
 '难过':[9,7,'字一个个往下坠、变淡，像眼泪。','text：≤12字'],
 '生气':[7,4.5,'字一个个重重砸下来，屏幕一震。','text：≤8字；sub：≤8字'],
 '开心':[0,null,'字一个个蹦起来，旁边冒小星星。','text：≤8字'],
 '心动':[0,null,'一个字像心跳一样怦怦跳。','text：1～2字；sub：≤8字'],
 '想说又删掉':[12,10.6,'打了一句话，一个字一个字删掉，换成另一句发出去。','typed：打了又删的那句（≤12字）；sent：最后发出去的（≤8字）；line：下面的小字（≤10字）'],
 '低语':[9,7,'很小很淡的字慢慢浮出来，像在耳边说。','lines：3 句，每句≤8字'],
};
const ATMOS=A.map(x=>x.n);
const OPENERS=['开场 · 一道光','开场 · 锁屏亮起','开场 · 从你那句话开始'];
/* 结尾只能从这些里选（她说：要告诉角色开头结尾用什么，不然他不会选） */
const ENDINGS=['两颗星','光点聚成字','信纸','心动','呼吸','低语','烟花','星空','上浮光点'];
const MUSICS=MOODS.map(m=>m.n);
function shotMeta(n){const m=META[n];if(m)return{cyc:m[0],hold:m[1],desc:m[2],slots:m[3]};const s=SHOTS[n];return s&&s.g==='A'?{cyc:0,hold:null,desc:s.fx.d,slots:n==='老电视'?'text：画面里那行字（≤6字）':''}:null}
function allowedShots(){return OPENERS.concat(ATMOS,Object.keys(META).filter(n=>!OPENERS.includes(n)))}

/* ---------- 素材包：从认识第一天到今天，程序先数好、按月份挑好 ---------- */
const clean=s=>String(s==null?'':s).replace(/[\[【][^\]】]{0,40}[\]】]/g,'').replace(/\s+/g,' ').trim();
const EMO=/爱|想你|想他|累|难过|生气|开心|哭|怕|谢谢|晚安|对不起|喜欢|抱|陪|笑|疼|委屈|担心|吃饭|睡|梦|别走|在吗|讨厌|心|乖|宝/;
function dayKey(t){const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function monthKey(t){const d=new Date(t);return d.getFullYear()+'年'+(d.getMonth()+1)+'月'}
function fmtDay(t){const d=new Date(t);return (d.getMonth()+1)+'月'+d.getDate()+'日'}
function pickSpread(list,n,score){if(list.length<=n)return list.slice();const out=[],step=list.length/n;for(let k=0;k<n;k++){const seg=list.slice(Math.floor(k*step),Math.floor((k+1)*step));let best=seg[0],bs=-1;seg.forEach(x=>{const v=score(x);if(v>bs){bs=v;best=x}});out.push(best)}return out}
const quoteScore=m=>{const t=clean(m.content),L=[...t].length;return (L>=4&&L<=40?2:0)+(EMO.test(t)?3:0)+Math.min(L,30)/30};
function collect(c){
  const all=(typeof msgs==='function'?msgs(c.id):[]).filter(m=>m&&m.time);
  const said=m=>(m.type==='text'||m.type==='voice')&&clean(m.content);
  const her=all.filter(m=>m.role==='user'&&said(m)),him=all.filter(m=>m.role==='assistant'&&said(m));
  const cnt=(arr,re)=>arr.reduce((n,m)=>n+(clean(m.content).match(re)||[]).length,0);
  const first=all.length?all[0].time:Date.now(),days=Math.max(1,Math.round((Date.now()-first)/86400000)+1);
  const active=new Set(all.filter(m=>m.role!=='system').map(m=>dayKey(m.time))).size;
  const late=her.filter(m=>{const h=new Date(m.time).getHours();return h<5}).length;
  const calls=all.filter(m=>m.type==='sys'&&/^通话结束/.test(String(m.content||'')));
  let callSec=0;calls.forEach(m=>{const r=String(m.content).match(/(\d+):(\d{2})(?::(\d{2}))?\s*$/);if(r)callSec+=r[3]?(+r[1]*3600+ +r[2]*60+ +r[3]):(+r[1]*60+ +r[2])});
  const together=(S.couple&&S.couple.cid===c.id&&S.couple.startDate&&typeof coupleDays==='function')?coupleDays(S.couple.startDate):0;
  const stats=[['她对你说的话（条）',her.length],['你对她说的话（条）',him.length],['认识的天数（从第一条消息算）',days],['真正聊过天的日子（天）',active]];
  if(together)stats.push(['在一起的天数',together]);
  [['她说「我爱你」',/我爱你/g,her],['你说「我爱你」',/我爱你/g,him],['她说「想你」',/想你/g,her],['你说「想你」',/想你/g,him],['她说「晚安」',/晚安/g,her],['她说「谢谢」',/谢谢/g,her],['她说自己「好累」「我累了」',/好累|我累了|累死了|累坏了/g,her]].forEach(([k,re,arr])=>stats.push([k+'（次）',cnt(arr,re)]));
  stats.push(['她凌晨 0～5 点发的消息（条）',late]);if(calls.length)stats.push(['打过的电话/视频（通）',calls.length],['通话一共（分钟）',Math.round(callSec/60)]);
  stats.push(['她发的图片（张）',all.filter(m=>m.role==='user'&&m.type==='image').length],['你们互相转账和红包（次）',all.filter(m=>m.type==='transfer'||m.type==='redpacket').length]);
  const freq={};her.forEach(m=>{const t=clean(m.content).replace(/[。！？!?~～，,\s]+$/,'');if([...t].length>=2&&[...t].length<=6)freq[t]=(freq[t]||0)+1});
  const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8);
  /* 按月份分时期 */
  const months={};all.forEach(m=>{const k=monthKey(m.time);(months[k]=months[k]||{her:[],him:[],days:{}});const mo=months[k];if(m.role==='user'&&said(m))mo.her.push(m);if(m.role==='assistant'&&said(m))mo.him.push(m);mo.days[dayKey(m.time)]=(mo.days[dayKey(m.time)]||0)+1});
  const mkeys=Object.keys(months),perHer=Math.max(3,Math.min(10,Math.floor(80/Math.max(1,mkeys.length)))),perHim=Math.max(1,Math.min(4,Math.floor(30/Math.max(1,mkeys.length))));
  const sums=(typeof summaryList==='function'?summaryList(c):[]).filter(x=>x&&x.text);
  const periods=mkeys.map(k=>{const mo=months[k],busy=Object.entries(mo.days).sort((a,b)=>b[1]-a[1])[0];
    const sm=sums.filter(x=>{const r=String(x.time||'').match(/(\d{4})[-/年](\d{1,2})/);return r&&(+r[1]+'年'+(+r[2])+'月')===k});
    return{k,her:mo.her.length,him:mo.him.length,busy:busy?(+busy[0].slice(5,7))+'月'+(+busy[0].slice(8,10))+'日（'+busy[1]+'条）':'',
      herQ:pickSpread(mo.her,perHer,quoteScore).map(m=>fmtDay(m.time)+' 她：'+clean(m.content).slice(0,60)),
      himQ:pickSpread(mo.him,perHim,quoteScore).map(m=>fmtDay(m.time)+' 你：'+clean(m.content).slice(0,60)),
      sum:pickSpread(sm,4,x=>+x.imp||3).map(x=>clean(typeof summaryCleanText==='function'?summaryCleanText(c,x.text):x.text).slice(0,140))}});
  const early=sums.filter(x=>!/\d{4}[-/年]\d{1,2}/.test(String(x.time||''))).slice(0,4).map(x=>clean(x.text).slice(0,140));
  const mem=(typeof memoryList==='function'?memoryList(c):[]).map(x=>clean(typeof x==='object'?x.text:x)).filter(Boolean);
  const notes=(typeof lifeNotesForRole==='function'?lifeNotesForRole(c):[]).map(n=>clean(n.text)).filter(Boolean);
  const anni=(S.couple&&S.couple.cid===c.id&&Array.isArray(S.couple.anniversaries))?S.couple.anniversaries.map(a=>(a.date||'')+' '+(a.title||'')):[];
  const herText='\n'+her.map(m=>clean(m.content)).join('\n')+'\n',himText='\n'+him.map(m=>clean(m.content)).join('\n')+'\n';
  return{stats,top,periods,early,mem:pickSpread(mem,40,x=>x.length),notes:pickSpread(notes,30,x=>x.length),anni,first:her[0]?fmtDay(her[0].time)+' 她：'+clean(her[0].content).slice(0,60):'',firstAt:first,herText,himText,numbers:new Set(stats.map(s=>+s[1]).concat(top.map(t=>t[1])))};
}
function materialText(c,M){
  const L=[];L.push('## 准确数字（程序数好的，只能用这些数，不能自己编）');M.stats.forEach(([k,v])=>L.push('- '+k+'：'+v));
  if(M.top.length)L.push('- 她最常说的短句：'+M.top.map(([t,n])=>'「'+t+'」'+n+'次').join('，'));
  if(M.first)L.push('\n## 她对你说的第一句话\n'+M.first);
  if(M.anni.length)L.push('\n## 纪念日\n'+M.anni.map(x=>'- '+x).join('\n'));
  if(M.mem.length)L.push('\n## 你的记忆\n'+M.mem.map(x=>'- '+x.slice(0,120)).join('\n'));
  if(M.notes.length)L.push('\n## 你给她记的小事簿\n'+M.notes.map(x=>'- '+x.slice(0,120)).join('\n'));
  if(M.early.length)L.push('\n## 很早以前的事\n'+M.early.map(x=>'- '+x).join('\n'));
  L.push('\n## 按时间分的时期（从第一个月到这个月，每个时期都要看）');
  M.periods.forEach(p=>{L.push('\n### '+p.k+'：她说了 '+p.her+' 条，你说了 '+p.him+' 条'+(p.busy?'；聊得最多的一天是 '+p.busy:''));if(p.sum.length)L.push('这个时期发生的事：\n'+p.sum.map(x=>'- '+x).join('\n'));if(p.herQ.length)L.push('她的原话：\n'+p.herQ.map(x=>'- '+x).join('\n'));if(p.himQ.length)L.push('你说过的：\n'+p.himQ.map(x=>'- '+x).join('\n'))});
  return L.join('\n');
}
function shotList(){return allowedShots().map(n=>{const m=shotMeta(n);return '- 「'+n+'」'+m.desc+(m.slots?'  要填：'+m.slots:'')}).join('\n')}
function voiceLang(c){try{if(typeof ttsContentLang==='function'){const l=ttsContentLang(c);return l&&l!=='zh'?l:''}}catch(_){}return ''}
function voiceLangLabel(l){return typeof voiceLangName==='function'&&voiceLangName(l)||({'英':'英语','日':'日语','韩':'韩语','粤':'粤语','法':'法语','德':'德语','俄':'俄语'})[l]||'外语'}
function promptText(c,M,ask){
  const her=(S.me&&S.me.name)||'她',me=c.name||'我',lang=voiceLang(c),ln=lang?voiceLangLabel(lang):'';
  return ['# 这次要做的事',
'「'+her+'」刚刚对你说：「'+ask+'」。她想知道：在你眼里，她是什么样的人。',
'你要像导演一样，用下面「镜头清单」里的镜头，拍一部竖屏小视频送给她。长度由你自己决定：最短一分钟左右，两分钟、三分钟都可以，看你想说多少。片名固定是「'+TITLE+'」，程序会放在开场镜头里，你不用写片名。除此以外，讲什么、怎么排、每个镜头上写什么、旁白怎么说、配什么音乐，全部由你决定。',
'',
'# 你是谁',
'你就是'+me+'本人。整部片子都是你在对她说话：自称「我」，叫她用你平时怎么叫她。旁白是你亲口说给她听的话，程序会用你的声音念出来，同时当字幕。',
'',
'# 一定要做到',
'1. 从你们认识的第一天到今天，每个时期都要挑到。不要只写最近几天的事，也不要敷衍几句空话。下面的素材已经按月份分好了。',
'2. 数字只能用「准确数字」里给的，一个都不能自己编。比如她说了多少次「我爱你」、你们在一起多少天，这些都很重要，可以用「数字跳动」镜头放出来。',
'3. 引用她说过的话时，只能用素材里出现过的原话，可以截短，不能改意思，不能编她没说过的话。',
'4. 要有情绪起伏：心疼、开心、难过、生气、在意都可以，按你们真实发生过的事来，不要一直一个调子。最后落在你最想对她说的那句话上。',
'5. 写具体的小事和细节，不写空泛的大道理，不写「你是我的全世界」这种套话。',
(lang?'6. 你的配音说的是'+ln+'。所以每个镜头的旁白（say）用'+ln+'写，一两句话，像在她耳边说的；同时写一个 zh：这句旁白的中文翻译（直接写译文，不要加括号）。镜头画面上的字（sign、text、quote 这些）照样写中文。也可以不写旁白，让画面自己说话。':'6. 每个镜头的旁白（say）是一两句话，不超过 40 个字，像在她耳边说的。也可以不写旁白，让画面自己说话。'),
'7. 一个镜头大约 5～10 秒。一分钟左右大概 8～12 个镜头，三分钟左右大概 20～30 个。',
'8. 镜头上的字很短，每个镜头的字数限制写在清单里，不要超。',
'',
'# 开头和结尾（一定要照这个来）',
'开头：第一个镜头只能从下面三个开场里选一个，片名「'+TITLE+'」会自动出现在开场里：',
'- 「开场 · 一道光」黑屏里一道细光拉开，片名在光里慢慢变清楚，下面一行是你的落款。适合安静、郑重地开始。要填 sign。',
'- 「开场 · 锁屏亮起」她的手机锁屏亮起，弹进你发来的一条通知，点开就是片名。适合像给她一个惊喜。要填 note。',
'- 「开场 · 从你那句话开始」先回放她刚才让你拍视频的那句原话，你回她一句，镜头推进你的消息变成片名。适合接着她的话开始。要填 reply、line。',
'结尾：最后一个镜头只能从下面这些里选一个，旁白（say）写你最想对她说的那一句，可以落款：',
'- 「两颗星」两颗光点从两边靠近、绕着彼此转、连上一条线。',
'- 「光点聚成字」满屏光点汇成你写的一句短话（text），再被吹散。',
'- 「信纸」信纸上一行行写出你的话，最后落款（lines、sign）。',
'- 「心动」一个字像心跳一样怦怦跳（text、sub）。',
'- 「呼吸」两三个字像在呼吸一样亮起又暗下（text、sub）。',
'- 「低语」很小很淡的三句话，像在她耳边说（lines）。',
'- 「烟花」「星空」「上浮光点」安静的画面，只靠旁白收尾。',
'',
'# 镜头清单（只能用这里的名字，一字不差）',
'带「要填」的镜头，要把那些空填好；氛围镜头（下雪、下雨、星空这类）没有字，只靠旁白。',
shotList(),
'',
'# 背景音乐（选一首，写名字）',
MOODS.map(m=>'- 「'+m.n+'」'+m.d).join('\n'),
'',
'# 素材',
materialText(c,M),
'',
'# 输出格式',
'只输出一个 JSON，不要任何别的文字、不要代码块标记。格式：',
'{"music":"温柔钢琴","scenes":[',
'  {"shot":"开场 · 一道光","sign":"—— '+me+'，拍给你"},',
'  {"shot":"数字跳动","num":1234,"label":"你对我说过的话","say":"你跟我说过的每一句，我都留着。"},',
(lang?'  {"shot":"细雨","say":"（这里用'+ln+'写）","zh":"那天下雨，你一直等我回消息。"},':'  {"shot":"细雨","say":"那天下雨，你一直等我回消息。"},'),
'  {"shot":"引用卡片","quote":"她的一句原话","date":"10月30日","say":"……"}',
']}',
'上面只是格式示范，内容要换成你们自己的。'].join('\n');
}

/* ---------- 剧本：解析、检查 ---------- */
function parseJSON(raw){let t=String(raw||'').replace(/<(think|thinking|analysis|reasoning)>[\s\S]*?<\/\1>/gi,'').replace(/```(?:json)?/gi,'').trim();const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)return null;t=t.slice(a,b+1);try{return JSON.parse(t)}catch(_){}try{return JSON.parse(t.replace(/,\s*([}\]])/g,'$1').replace(/[“”]/g,'"'))}catch(_){return null}}
const norm=s=>String(s||'').replace(/\s+/g,'').replace(/[·•・]/g,'·');
function findShot(n){const k=norm(n);return allowedShots().find(x=>norm(x)===k)||allowedShots().find(x=>norm(x).replace(/^开场·/,'')===k.replace(/^开场·/,''))||null}
const cut=(s,n)=>[...String(s==null?'':s)].slice(0,n).join('');
const qkey=s=>String(s||'').replace(/[\s。！？!?~～，,、…\.\-—]+/g,'');
function isOrig(text,pool){const k=qkey(text);if([...k].length<2)return false;return pool.replace(/[\s。！？!?~～，,、…\.\-—]+/g,'').includes(k)}
function checkScript(obj,c,M,ask){const foreign=!!voiceLang(c);
  if(!obj||!Array.isArray(obj.scenes))return{error:'模型没有按格式给出剧本（没有 scenes）'};
  const out=[],herPool=M.herText,himPool=M.himText,her=(S.me&&S.me.name)||'',him=c.name||'';
  obj.scenes.slice(0,32).forEach(sc=>{if(!sc||typeof sc!=='object')return;const n=findShot(sc.shot);if(!n)return;const o={shot:n,say:cut(clean(sc.say),foreign?220:60)};if(foreign&&o.say)o.zh=cut(clean(sc.zh),80);const m=shotMeta(n);
    const S1=k=>cut(clean(sc[k]),40),arr=(k,max,len)=>(Array.isArray(sc[k])?sc[k]:[]).map(x=>cut(clean(x),len)).filter(Boolean).slice(0,max);
    switch(n){
      case '开场 · 一道光':o.sign=S1('sign');break;
      case '开场 · 锁屏亮起':o.note=cut(S1('note'),16);break;
      case '开场 · 从你那句话开始':o.reply=cut(S1('reply'),10);o.line=cut(S1('line'),12);break;
      case '满屏飘字':case '记忆碎片':o.quotes=arr('quotes',16,14).filter(q=>isOrig(q,herPool));if(o.quotes.length<4)return;if(n==='记忆碎片'){o.center=cut(S1('center'),12);if(!isOrig(o.center,herPool))o.center=o.quotes[0]}break;
      case '词语汇聚':o.quotes=arr('quotes',12,8);if(o.quotes.length<4)return;o.line=cut(S1('line'),10);break;
      case '光点聚成字':case '镜头对焦':o.text=cut(S1('text'),8);if(!o.text)return;break;
      case '打字':o.text=cut(S1('text'),24);if(!o.text)return;break;
      case '逐字浮现':o.text=cut(S1('text'),12);if(!o.text)return;break;
      case '大字标题':o.text=cut(S1('text'),10);if(!o.text)return;break;
      case '声波':o.text=cut(S1('text'),14);break;
      case '微信消息回放':o.date=cut(S1('date'),16);o.msgs=(Array.isArray(sc.msgs)?sc.msgs:[]).slice(0,4).map(x=>({who:/我/.test(String(x&&x.who||''))?'我':'她',text:cut(clean(x&&x.text),14)})).filter(x=>x.text&&isOrig(x.text,x.who==='我'?himPool:herPool));if(o.msgs.length<2)return;break;
      case '字幕切换':o.lines=arr('lines',4,16);if(!o.lines.length)return;break;
      case '数字跳动':o.num=Math.round(+sc.num);o.label=cut(S1('label'),12);if(!Number.isFinite(o.num)||!M.numbers.has(o.num))return;break;
      case '盖章':o.before=cut(S1('before'),10);o.stamp=cut(S1('stamp'),6);if(!o.stamp)return;break;
      case '引用卡片':o.quote=cut(S1('quote'),24);o.date=cut(S1('date'),10);if(!isOrig(o.quote,herPool))return;break;
      case '时间跳转':o.date=cut(S1('date'),10);o.from=S1('from');o.to=S1('to');o.note=cut(S1('note'),10);break;
      case '锁屏通知':o.notes=arr('notes',2,16);if(!o.notes.length)return;break;
      case '时间线':o.items=(Array.isArray(sc.items)?sc.items:[]).slice(0,4).map(x=>({date:cut(clean(x&&x.date),8),text:cut(clean(x&&x.text),8)})).filter(x=>x.date&&x.text);if(o.items.length<2)return;break;
      case '划掉改写':o.lead=cut(S1('lead'),6);o.wrong=cut(S1('wrong'),4);o.right=cut(S1('right'),4);if(!o.wrong||!o.right)return;break;
      case '信纸':o.lines=(Array.isArray(sc.lines)?sc.lines:[]).slice(0,5).map(x=>cut(clean(x),14));if(!o.lines.filter(Boolean).length)return;o.sign=cut(S1('sign'),8);break;
      case '生病':o.temp=+sc.temp||38.5;o.line=cut(S1('line'),16);o.sub=cut(S1('sub'),10);break;
      case '吃饭':o.line=cut(S1('line'),16);o.sub=cut(S1('sub'),10);break;
      case '礼物':o.line=cut(S1('line'),18);break;
      case '契约':o.title=cut(S1('title'),6);o.rules=arr('rules',3,12);o.seal=cut(S1('seal'),2);o.line=cut(S1('line'),14);break;
      case '约定':o.date=/^\d{4}-\d{1,2}-\d{1,2}$/.test(S1('date'))?S1('date'):'';if(!o.date)return;o.note=cut(S1('note'),4);o.line=cut(S1('line'),14);break;
      case '记住':o.text=cut(S1('text'),10);o.stamp=cut(S1('stamp'),18);o.line=cut(S1('line'),14);break;
      case '呼吸':o.text=cut(S1('text'),4);o.sub=cut(S1('sub'),8);break;
      case '难过':o.text=cut(S1('text'),12);if(!o.text)return;break;
      case '生气':o.text=cut(S1('text'),8);o.sub=cut(S1('sub'),8);if(!o.text)return;break;
      case '开心':o.text=cut(S1('text'),8);if(!o.text)return;break;
      case '心动':o.text=cut(S1('text'),2);o.sub=cut(S1('sub'),8);break;
      case '想说又删掉':o.typed=cut(S1('typed'),12);o.sent=cut(S1('sent'),8);o.line=cut(S1('line'),10);if(!o.typed||!o.sent)return;break;
      case '低语':o.lines=arr('lines',3,8);if(!o.lines.length)return;break;
      case '老电视':o.text=cut(S1('text'),6);break;
    }
    if(!m.slots&&!o.say&&SHOTS[n].g==='A')return;/* 氛围镜头没有旁白就什么都没说，丢掉 */
    out.push(o)});
  if(!out.length||!OPENERS.includes(out[0].shot)){const k=out.findIndex(x=>OPENERS.includes(x.shot));if(k>0)out.unshift(out.splice(k,1)[0]);else out.unshift({shot:'开场 · 一道光',say:'',sign:'—— '+him})}
  const rest=out.slice(1).filter(x=>!OPENERS.includes(x.shot));const scenes=[out[0]].concat(rest);
  /* 最后一个镜头要是收尾镜头：不是的话，把最后出现的收尾镜头挪到最后；一个都没有就补一个「两颗星」 */
  if(!ENDINGS.includes(scenes[scenes.length-1].shot)){let k=-1;for(let i=scenes.length-1;i>0;i--)if(ENDINGS.includes(scenes[i].shot)){k=i;break}if(k>0)scenes.push(scenes.splice(k,1)[0]);else scenes.push({shot:'两颗星',say:''})}
  if(scenes.length<6)return{error:'剧本里能用的镜头太少（只有 '+scenes.length+' 个），模型可能没按要求写'};
  const now=new Date(),wk=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][now.getDay()],hh=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  scenes.forEach(o=>{o.her=her;o.him=him;o.time=hh;o.day=(now.getMonth()+1)+'月'+now.getDate()+'日 '+wk;if(o.shot==='开场 · 一道光'){o.date=now.getFullYear()+' · '+String(now.getMonth()+1).padStart(2,'0')+' · '+String(now.getDate()).padStart(2,'0');if(!o.sign)o.sign='—— '+him}if(o.shot==='开场 · 从你那句话开始')o.ask=cut(ask,16)});
  const music=MOODS.find(m=>norm(m.n)===norm(obj.music))||MOODS[0];
  return{scenes,music:music.id};
}

/* ---------- 时间轴 ---------- */
function sceneDur(o,voice){const m=shotMeta(o.shot),base=m.hold!=null?m.hold+1:5.5;return Math.min(18,Math.max(base,voice?voice+1.6:0))}
function timeline(v){let t=0;const rows=v.script.scenes.map((o,i)=>{const d=sceneDur(o,v.voice&&v.voice[i]&&v.voice[i].dur);const r={o,start:t,dur:d};t+=d;return r});return{rows,total:t+1}}
/* 按宽度换行：中文按字，英文按词 */
function wrapText(c,s,maxW,size){c.save();c.font=size+'px '+SANS;const words=String(s||'').match(/[A-Za-z0-9'’\-]+[,.!?;:]*\s*|\s+|./gu)||[],lines=[];let cur='';words.forEach(w=>{const t=cur+w;if(c.measureText(t.trim()).width>maxW&&cur.trim()){lines.push(cur.trim());cur=w.trimStart()}else cur=t});if(cur.trim())lines.push(cur.trim());c.restore();return lines.slice(0,3)}
const fmtT=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');

/* ---------- 制作 ---------- */
const JOBS=new Map();
const TRIGGER_A=/你眼[里中裡]|眼[里中裡]的我|在你眼[里中裡]/,TRIGGER_B=/样子|樣子|视频|視頻|拍|什么样|怎样|怎么样|甚麼樣/;
function matches(t){t=String(t||'');return TRIGGER_A.test(t)&&TRIGGER_B.test(t)}
function msgOf(cid,mid){return (typeof msgs==='function'?msgs(cid):[]).find(m=>m&&m.id===mid)}
function setState(cid,m,patch){Object.assign(m.video,patch);paintCard(cid,m);if(patch.status&&typeof save==='function')save()}
async function runModel(c,messages,useAux){return await chatAPI(messages,{independentRoleModel:true,routeIndex:typeof roleChatRouteIndex==='function'?roleChatRouteIndex(c):undefined,aux:useAux,max:12000,temp:.85,complete:true})}
async function make(cid,mid){const c=getC(cid),m=msgOf(cid,mid);if(!c||!m||!m.video)return;if(JOBS.has(mid))return;JOBS.set(mid,true);
  const v=m.video;let tick=0;try{
   if(!v.script){setState(cid,m,{status:'making',stage:'script',pct:2,error:''});const t0=Date.now();tick=setInterval(()=>{const s=(Date.now()-t0)/1000;v.pct=Math.min(38,Math.round(2+36*(1-Math.exp(-s/45))));paintCard(cid,m)},700);
    const M=collect(c),ask=v.ask||'',msgsIn=[{role:'system',content:buildSystem(c)},{role:'user',content:promptText(c,M,ask)}];const main=c.model==='aux',reasons=[];let got=null;
    for(const aux of [main,!main]){try{const raw=await runModel(c,msgsIn,aux),r=checkScript(parseJSON(raw),c,M,ask);if(r.error){reasons.push((aux?'副模型':'主模型')+'：'+r.error);continue}got=r;break}catch(e){reasons.push((aux?'副模型':'主模型')+'：'+String(e&&e.message||e||'请求失败').slice(0,120))}}
    clearInterval(tick);tick=0;if(!got)throw new Error(reasons.join('\n')||'剧本没有写出来');v.script=got;v.voice=null;v.pct=40;if(typeof save==='function')save()}
   /* 配音：私人版是角色自己的音色，网页版用你配好的声音；没配声音就只有字幕和音乐 */
   const lines=v.script.scenes.map(o=>o.say||'');v.voice=Array.isArray(v.voice)&&v.voice.length===lines.length?v.voice:lines.map(()=>null);
   const canVoice=typeof ttsApiOn==='function'&&ttsApiOn(c)&&typeof ttsArr==='function';if(!canVoice)v.noVoice='没有配置语音（设置里的声音），这次只有字幕和音乐';
   const todo=lines.map((s,i)=>s&&!v.voice[i]?i:-1).filter(i=>i>=0);let done=lines.filter((s,i)=>s&&v.voice[i]).length;const totalV=lines.filter(Boolean).length;
   if(canVoice){setState(cid,m,{status:'making',stage:'voice',pct:40,done,totalV});for(const i of todo){let ok=false,err='';for(let k=0;k<2&&!ok;k++){try{const ab=await ttsArr(lines[i],c,{quiet:true});if(!ab)throw new Error('语音服务没有返回声音');const buf=await decodeBuf(ab);if(!buf)throw new Error('声音解不开');const key='__rolevideo_'+mid+'_'+i;await imgPut(key,audioBufToDataUrl(ab,'audio/mpeg'));v.voice[i]={key,dur:buf.duration};ok=true}catch(e){err=String(e&&e.message||e).slice(0,120)}}
      if(!ok){v.noVoice='第 '+(i+1)+' 句配音失败：'+err+'。这次剩下的只有字幕';break}done++;setState(cid,m,{pct:Math.round(40+58*done/Math.max(1,totalV)),done})}}
   const tl=timeline(v);setState(cid,m,{status:'done',stage:'',pct:100,dur:Math.round(tl.total),error:''});
  }catch(e){if(tick)clearInterval(tick);setState(cid,m,{status:'failed',stage:'',error:String(e&&e.message||e||'未知原因')})}finally{JOBS.delete(mid)}}
function maybeStart(c,text){if(!c||!matches(text))return false;const list=msgs(c.id);if(list.some(m=>m&&m.type==='rolevideo'&&m.video&&m.video.status==='making'&&JOBS.has(m.id)))return false;
  const m={id:uid(),role:'assistant',type:'rolevideo',time:Date.now()+1500,video:{status:'making',stage:'script',pct:1,ask:String(text||'').slice(0,60)}};
  setTimeout(()=>{list.push(m);if(typeof save==='function')save();if(typeof render==='function'&&typeof cur==='function'&&cur().p==='chat'&&cur().id===c.id)render();make(c.id,m.id)},1200);return true}
function replyNote(){return '[程序提示｜只给你看] 她刚让你拍一个「'+TITLE+'」的小视频。你已经开始做了，做好会自动发给她。这条回复自然地回应一句就好（比如答应、让她等一下），不要说你不会拍视频，也不要提前讲视频内容。'}
function retry(cid,mid){const m=msgOf(cid,mid);if(!m||!m.video||JOBS.has(mid))return;m.video.status='making';m.video.error='';paintCard(cid,m);make(cid,mid)}
function text(m){const v=m&&m.video||{};return '[视频]「'+TITLE+'」'+(v.status==='done'?'（你拍给她的，'+(v.dur||0)+'秒）':v.status==='failed'?'（没做成）':'（你正在做）')}

/* ---------- 聊天里的视频卡片（没有气泡包边） ---------- */
function styleOnce(){if(document.getElementById('rvStyle'))return;const st=document.createElement('style');st.id='rvStyle';st.textContent=`
.rv-card{position:relative;width:148px;aspect-ratio:9/16;border-radius:10px;overflow:hidden;background:radial-gradient(120% 80% at 50% 30%,#141a26 0%,#05070b 60%,#000 100%);color:#f2f4f8;cursor:pointer;box-shadow:0 0 0 1px rgba(255,255,255,.08)}
.rv-card .rv-t{position:absolute;left:0;right:0;top:38%;text-align:center;font:500 17px "Songti SC","STSong",serif;letter-spacing:4px}
.rv-card .rv-line{position:absolute;left:24%;right:24%;top:47%;height:1px;background:rgba(127,176,255,.8)}
.rv-card .rv-play{position:absolute;left:50%;top:66%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:1.5px solid rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center}
.rv-card .rv-play:after{content:"";margin-left:3px;border-left:12px solid #fff;border-top:7px solid transparent;border-bottom:7px solid transparent}
.rv-card .rv-dur{position:absolute;right:8px;bottom:6px;font-size:11px;color:rgba(255,255,255,.85)}
.rv-card .rv-ring{position:absolute;left:50%;top:64%;width:52px;height:52px;margin:-26px 0 0 -26px}
.rv-card .rv-pct{position:absolute;left:0;right:0;top:64%;margin-top:-7px;text-align:center;font-size:12px;font-variant-numeric:tabular-nums}
.rv-card .rv-stage{position:absolute;left:6px;right:6px;bottom:8px;text-align:center;font-size:11px;color:rgba(255,255,255,.72)}
.rv-card .rv-err{position:absolute;left:8px;right:8px;top:52%;bottom:44px;overflow:auto;font-size:11px;line-height:1.45;color:#ff9aa5;white-space:pre-wrap;word-break:break-all}
.rv-card .rv-retry{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);font:inherit;font-size:12px;color:#fff;background:rgba(127,176,255,.25);border:1px solid rgba(127,176,255,.6);border-radius:999px;padding:4px 14px}
.rv-card .rv-note{position:absolute;left:6px;right:6px;bottom:22px;text-align:center;font-size:10px;color:rgba(255,255,255,.55)}
#rvPlayer{position:fixed;inset:0;z-index:2147483000;background:#000;display:flex;align-items:center;justify-content:center;touch-action:manipulation}
#rvPlayer canvas{max-width:100vw;max-height:100vh;aspect-ratio:9/16;height:100vh;width:auto;display:block}
#rvPlayer .rv-mic,#rvPlayer .rv-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);width:28px;height:28px;padding:0;border:0;background:none;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 1px 3px rgba(0,0,0,.7));transition:opacity .3s}
#rvPlayer .rv-mic{left:12px}#rvPlayer .rv-x{right:12px}
#rvPlayer .rv-replay{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:inherit;font-size:15px;color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:10px 22px}
/* 右上角关闭：只有线条 */
#rvPlayer .rv-bar{position:absolute;left:14px;right:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);display:flex;align-items:center;gap:10px;color:#fff;font-size:12px;font-variant-numeric:tabular-nums;transition:opacity .3s}
#rvPlayer .rv-bar.hide{opacity:0}
#rvPlayer .rv-pp{width:32px;height:32px;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:13px}
#rvPlayer input[type=range]{flex:1;accent-color:#7fb0ff}
`;document.head.appendChild(st)}
function cardInner(cid,m){const v=m.video||{},id=String(m.id).replace(/[^\w-]/g,'');
  if(v.status==='done')return `<div class="rv-t">${TITLE}</div><div class="rv-line"></div><div class="rv-play"></div>${v.noVoice?'<div class="rv-note">只有字幕</div>':''}<div class="rv-dur">${fmtT(v.dur||0)}</div>`;
  if(v.status==='failed'||(v.status==='making'&&!JOBS.has(m.id)&&Date.now()-(+m.time||0)>8000)){const why=v.status==='failed'?v.error:'制作到一半被打断了（小手机被关掉或刷新了）';return `<div class="rv-t" style="top:22%">${TITLE}</div><div class="rv-err">没做成：${esc(why||'')}</div><button class="rv-retry" onclick="event.stopPropagation();RoleVideo.retry('${cid}','${id}')">重试</button>`}
  const p=Math.max(0,Math.min(100,v.pct|0)),C2=2*Math.PI*22,stage=v.stage==='voice'?'正在配音 '+(v.done||0)+'/'+(v.totalV||0):'正在写剧本';
  return `<div class="rv-t">${TITLE}</div><div class="rv-line"></div><svg class="rv-ring" viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="3"/><circle cx="26" cy="26" r="22" fill="none" stroke="#7fb0ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(C2*p/100).toFixed(1)} ${C2.toFixed(1)}" transform="rotate(-90 26 26)"/></svg><div class="rv-pct">${p}%</div><div class="rv-stage">${stage}</div>`}
function cardHTML(c,m){styleOnce();const id=String(m.id).replace(/[^\w-]/g,'');return `<div class="rv-card" data-rv="${id}" role="button" aria-label="视频：${TITLE}" onclick="event.stopPropagation();RoleVideo.tap('${c.id}','${id}')">${cardInner(c.id,m)}</div>`}
function paintCard(cid,m){try{const el=document.querySelector('.rv-card[data-rv="'+String(m.id).replace(/[^\w-]/g,'')+'"]');if(el)el.innerHTML=cardInner(cid,m)}catch(_){}}
function tap(cid,mid){const m=msgOf(cid,mid);if(!m||!m.video)return;if(m.video.status==='done')open(cid,mid);else if(typeof toast==='function'&&m.video.status==='making'&&JOBS.has(mid))toast('还在做，等一下');}

/* ---------- 全屏播放 ---------- */
let P=null;
async function open(cid,mid){const m=msgOf(cid,mid);if(!m||!m.video||m.video.status!=='done')return;close();styleOnce();const ac=sndInit();if(!ac&&typeof toast==='function')toast('这台设备放不了声音');
  const v=m.video,tl=timeline(v),wrap=document.createElement('div');wrap.id='rvPlayer';wrap.innerHTML='<canvas></canvas><button class="rv-mic" aria-label="背景音乐" aria-pressed="true"></button><button class="rv-x" aria-label="关闭"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg></button><button class="rv-replay" hidden>重新播放</button><div class="rv-bar"><button class="rv-pp" aria-label="暂停">❚❚</button><span class="rv-cur">0:00</span><input type="range" min="0" max="'+tl.total.toFixed(2)+'" step="0.05" value="0" aria-label="进度"><span>'+fmtT(tl.total)+'</span></div>';document.body.appendChild(wrap);
  const cv=wrap.querySelector('canvas'),bar=wrap.querySelector('.rv-bar'),pp=wrap.querySelector('.rv-pp'),rg=wrap.querySelector('input'),curT=wrap.querySelector('.rv-cur');
  const H=Math.round(Math.min(1920,window.innerHeight*(window.devicePixelRatio||1))),W=Math.round(H*9/16);cv.width=W;cv.height=H;
  const bufs=[];let musicOn=true;try{musicOn=localStorage.getItem('rvMusicOff')!=='1'}catch(_){}
  P={wrap,ac,musicOn,ended:false,t0:ac?ac.currentTime:performance.now()/1000,cur:-1,prev:0,src:null,raf:0,paused:false,hideAt:Date.now()+3000,tl,v,bufs,music:v.script.music};
  if(ac){await ac.resume();for(let i=0;i<v.voice.length;i++){const x=v.voice[i];if(!x){bufs[i]=null;continue}try{const du=await imgGet(x.key),ab=await fetch(du).then(r=>r.arrayBuffer());bufs[i]=await ac.decodeAudioData(ab)}catch(_){bufs[i]=null}}if(!P||P.wrap!==wrap)return;P.t0=ac.currentTime;if(P.musicOn)musStart(P.music)}
  const now=()=>P.ac?P.ac.currentTime-P.t0:performance.now()/1000-P.t0;
  const seek=T=>{if(P.ac)P.t0=P.ac.currentTime-T;else P.t0=performance.now()/1000-T;stopVoice();P.cur=-1};
  const stopVoice=()=>{if(P.src){try{P.src.stop()}catch(_){}P.src=null}};
  wrap.querySelector('.rv-x').onclick=e=>{e.stopPropagation();close()};
  const mic=wrap.querySelector('.rv-mic'),rp=wrap.querySelector('.rv-replay');
  /* 左上角话筒：关上就不放背景音乐，特效的声音和旁白照常 */
  const micPaint=()=>{mic.classList.toggle('off',!P.musicOn);mic.setAttribute('aria-pressed',String(P.musicOn));mic.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'+(P.musicOn?'':'<path d="M4 4l16 16" stroke="#ff8a8a"/>')+'</svg>'};micPaint();
  mic.onclick=e=>{e.stopPropagation();P.musicOn=!P.musicOn;try{localStorage.setItem('rvMusicOff',P.musicOn?'0':'1')}catch(_){}if(P.musicOn){if(!P.ended&&!P.paused)musStart(P.music)}else musStop();micPaint();P.hideAt=Date.now()+3000};
  /* 放完了：停在最后，点画面、点▶、点「重新播放」都从头再放（以前放完再点只会马上又停住） */
  const replay=()=>{P.ended=false;P.paused=false;rp.hidden=true;seek(0);pp.textContent='❚❚';if(P.ac)P.ac.resume();if(P.musicOn)musStart(P.music);P.hideAt=Date.now()+3000};
  const toggle=()=>{if(!P.ac)return;if(P.ended){replay();return}P.paused=!P.paused;pp.textContent=P.paused?'▶':'❚❚';P.paused?P.ac.suspend():P.ac.resume();P.hideAt=Date.now()+3000};
  pp.onclick=e=>{e.stopPropagation();toggle()};rp.onclick=e=>{e.stopPropagation();replay()};
  cv.onclick=()=>{toggle();bar.classList.remove('hide')};rg.oninput=e=>{e.stopPropagation();const v=+rg.value;seek(v);if(P.ended&&v<tl.total-.3){P.ended=false;rp.hidden=true;pp.textContent='❚❚';if(P.ac)P.ac.resume();if(P.musicOn)musStart(P.music)}P.hideAt=Date.now()+3000};
  const c=cv.getContext('2d');
  function frame(){if(!P||P.wrap!==wrap)return;let T=now();if(T>=tl.total){if(!P.ended){P.ended=true;stopVoice();sndStop();musStop();if(P.ac)P.ac.suspend();pp.textContent='↺';rp.hidden=false;bar.classList.remove('hide')}T=tl.total}
    let i=tl.rows.findIndex(r=>T>=r.start&&T<r.start+r.dur);if(i<0)i=tl.rows.length-1;const r=tl.rows[i],m2=shotMeta(r.o.shot),lt=T-r.start,ft=m2.hold!=null?Math.min(lt,m2.hold):lt,sh=SHOTS[r.o.shot];
    if(i!==P.cur){P.cur=i;sndStop();stopVoice();const a=AU[r.o.shot];(a&&a.bed||[]).forEach(f=>{try{f()}catch(_){}});P.prev=ft;
      const b=bufs[i];if(b&&P.ac&&lt<.4+b.duration){const s=P.ac.createBufferSource();s.buffer=b;const g=P.ac.createGain();g.gain.value=1;s.connect(g);g.connect(SND.master);const off=Math.max(0,lt-.4);s.start(P.ac.currentTime+Math.max(0,.4-lt),off);P.src=s;P.voiceEnd=T+Math.max(0,.4-lt)+b.duration-off}else P.voiceEnd=0}
    else{const a=AU[r.o.shot];if(a&&a.ev&&ft>P.prev){try{a.ev(P.prev,ft)}catch(_){}}P.prev=ft}
    if(MUS.out&&P.ac&&P.musicOn){const talking=P.voiceEnd&&T<P.voiceEnd+.2,end=Math.max(0,Math.min(1,(tl.total-T)/2.5));MUS.out.gain.setTargetAtTime((talking?.22:.5)*end,P.ac.currentTime,.25)}
    c.save();try{sh.fx.draw(c,W,H,ft,r.o)}catch(e){c.fillStyle='#000';c.fillRect(0,0,W,H)}c.restore();
    if(r.o.say){const u=H/1000,a=cl((lt-.3)/.5)*cl((r.dur-.4-lt)/.4);const g=c.createLinearGradient(0,H*.7,0,H);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,'+.6*a+')');c.fillStyle=g;c.fillRect(0,H*.7,W,H*.3);
      const main=wrapText(c,r.o.say,W*.86,21*u),zh=r.o.zh?wrapText(c,r.o.zh,W*.86,15*u):[],lh=21*u*1.45,zl=15*u*1.5,base=H*.865-zh.length*zl-(main.length-1)*lh;/* 留出下面进度条的位置 */
      main.forEach((t,k)=>txt(c,t,W/2,base+k*lh,21*u,{a,color:'#fff',shadow:1}));zh.forEach((t,k)=>txt(c,t,W/2,base+(main.length-1)*lh+zl*(k+1),15*u,{a,color:'#9cc2ff',shadow:1}))}
    const edge=Math.min(lt,r.dur-lt);if(edge<.4){c.fillStyle='rgba(0,0,0,'+(1-edge/.4)+')';c.fillRect(0,0,W,H)}if(T>=tl.total-1){c.fillStyle='rgba(0,0,0,'+cl(T-(tl.total-1))+')';c.fillRect(0,0,W,H)}
    if(document.activeElement!==rg)rg.value=T.toFixed(2);curT.textContent=fmtT(T);bar.classList.toggle('hide',!P.paused&&!P.ended&&Date.now()>P.hideAt);const _dim=bar.classList.contains('hide')?'.35':'1';mic.style.opacity=_dim;wrap.querySelector('.rv-x').style.opacity=_dim;
    P.raf=requestAnimationFrame(frame)}
  P.raf=requestAnimationFrame(frame)}
function close(){if(!P)return;cancelAnimationFrame(P.raf);try{P.src&&P.src.stop()}catch(_){}sndStop();musStop();if(P.ac&&P.ac.state==='suspended')P.ac.resume();P.wrap.remove();P=null}
window.RoleVideo={matches,maybeStart,replyNote,cardHTML,text,tap,retry,open,close,_collect:collect,_prompt:promptText,_check:checkScript,_parse:parseJSON,_shots:allowedShots,_meta:shotMeta,_timeline:timeline,_draw:(n,c,w,h,t,o)=>SHOTS[n].fx.draw(c,w,h,t,o),_player:()=>P?{ended:P.ended,paused:P.paused,music:P.musicOn,playing:!!(MUS.mood),t:P.ac?P.ac.currentTime-P.t0:0,total:P.tl.total}:null};

})();
