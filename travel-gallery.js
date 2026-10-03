/* Bounded travel imagery. No image bytes or catalogue are stored in user archives. */
(function(root){
 'use strict';
 const MAX_ITEMS=240,MAX_ROWS=6;
 const defaults=[
  {id:'zurich',kind:'photo',skin:'zurich',src:'assets/travel-home/zurich.jpg',alt:'苏黎世城市与河岸',title:'下一站，去看世界',description:'城市漫游 · 湖畔慢生活',action:'guide'},
  {id:'suzhou',kind:'photo',skin:'suzhou',src:'assets/travel-home/suzhou.jpg',alt:'苏州运河与游船',title:'苏州漫游｜把日子过慢一点',description:'旅行灵感 · 城市攻略',action:'guide'},
  {id:'event',kind:'art',skin:'event',title:'演出 / 演唱会',description:'和喜欢的人，一起赴约',action:'concert'},
  {id:'park',kind:'art',skin:'park',title:'景点 / 游乐园门票',description:'给下一次出游留点期待',action:'park'}
 ];
 let items=defaults.slice(),host=null,scroller=null,observer=null,resizeObserver=null,frame=0,range='';
 const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function source(value){try{const u=new URL(String(value||''),location.href);return u.origin===location.origin&&/\/assets\/travel-home\/[^/]+\.(?:jpg|webp|png)$/.test(u.pathname)?u.href:'';}catch(_){return '';}}
 function normalize(v,i){return {id:String(v.id||i).slice(0,80),kind:v.kind==='art'?'art':'photo',skin:['zurich','suzhou','event','park'].includes(v.skin)?v.skin:'plain',src:source(v.src),alt:String(v.alt||v.title||'旅行图片').slice(0,120),title:String(v.title||'旅行灵感').slice(0,100),description:String(v.description||'').slice(0,160),action:['guide','concert','park','attraction'].includes(v.action)?v.action:'guide'};}
 function card(v){const key=v.skin,photo=v.kind==='photo';let media='';
  if(photo){media='<div class="ctr-photo"><img src="'+esc(source(v.src))+'" data-travel-src="'+esc(source(v.src))+'" alt="'+esc(v.alt)+'" width="480" height="640" loading="lazy" decoding="async" onload="NorthTravelGallery.loaded(this)" onerror="NorthTravelGallery.failed(this)"><span class="ctr-img-error" hidden>照片暂时无法显示<br><span role="button" tabindex="0" onclick="NorthTravelGallery.retry(event,this)" onkeydown="if(event.key===\'Enter\')NorthTravelGallery.retry(event,this)">重试</span></span>';
   if(key==='zurich')media+='<span class="ctr-ribbon">小鱼旅行 · 灵感精选</span><span class="ctr-photo-caption">把风景，装进行程</span>';
   if(key==='suzhou')media+='<div class="ctr-poster"><b>周末去江南</b><strong>沿着水巷<br>慢慢走</strong><span>收藏一座心动的城市</span></div>';
   media+='</div>';
  }else{const event=key==='event';media='<div class="'+(event?'ctr-event-art':'ctr-park-art')+'">'+NorthTravelHome.icon(event?'note':'wheel')+'<span>'+(event?'奔赴一场<br><b>喜欢的演唱会</b>':'快乐没有<br><b>年龄限制</b>')+'</span><i>'+(event?'LIVE & MUSIC':"LET'S GO PLAY")+'</i></div>';}
  return '<button class="ctr-story ctr-story-'+key+'" data-travel-card="'+esc(v.id)+'" onclick="NorthTravelHome.entry(\''+v.action+'\')">'+media+'<div class="ctr-story-copy"><b>'+esc(v.title)+'</b><p>'+esc(v.description)+(key==='zurich'?'<span>›</span>':'')+'</p></div></button>';
 }
 function heights(){const narrow=host&&host.clientWidth<326,out=[0];for(let i=0;i<items.length;i+=2){const photo=items[i].kind==='photo'||items[i+1]&&items[i+1].kind==='photo';out.push(out[out.length-1]+(photo?(narrow?295:318):230)+8);}return out;}
 function clearImages(node){node.querySelectorAll('img').forEach(img=>{img.onload=null;img.onerror=null;img.removeAttribute('src');img.removeAttribute('data-travel-src');});}
 function update(){frame=0;if(!host||!host.isConnected||!scroller)return;const pos=heights(),count=pos.length-1,top=scroller.scrollTop-host.offsetTop,bottom=top+scroller.clientHeight;let first=0,last=0;while(first<count-1&&pos[first+1]<top)first++;first=Math.max(0,first-1);last=first;while(last<count&&pos[last]<bottom)last++;last=Math.min(count,Math.max(first+1,last+1),first+MAX_ROWS);const key=first+':'+last+':'+host.clientWidth;if(range===key)return;range=key;
  const rows=['<div class="ctr-feed-space" aria-hidden="true" style="height:'+pos[first]+'px"></div>'];for(let row=first;row<last;row++){rows.push('<div class="ctr-feed-row" style="height:'+(pos[row+1]-pos[row]-8)+'px">'+items.slice(row*2,row*2+2).map(card).join('')+'</div>');}rows.push('<div class="ctr-feed-space" aria-hidden="true" style="height:'+(pos[count]-pos[last])+'px"></div>');clearImages(host);host.innerHTML=rows.join('');
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 function dispose(){if(scroller)scroller.removeEventListener('scroll',schedule);if(resizeObserver)resizeObserver.disconnect();if(host)clearImages(host);host=scroller=resizeObserver=null;range='';if(frame)cancelAnimationFrame(frame);frame=0;}
 function mount(){const next=document.querySelector('.ctr-feed');if(next===host)return;dispose();if(!next)return;host=next;scroller=next.closest('.ctr-scroll');if(!scroller)return;scroller.addEventListener('scroll',schedule,{passive:true});if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(schedule);resizeObserver.observe(host);}update();}
 function watch(){if(observer)return;const app=document.getElementById('app');if(!app)return;observer=new MutationObserver(mount);observer.observe(app,{childList:true,subtree:true});mount();}
 function render(){if(!observer)queueMicrotask(watch);return '<section class="ctr-feed" aria-label="旅行推荐"></section>';}
 function loaded(img){img.hidden=false;const p=img.parentElement;if(p)p.classList.remove('ctr-photo-failed');const hint=p&&p.querySelector('.ctr-img-error');if(hint)hint.hidden=true;}
 function failed(img){if(!img.isConnected||!img.getAttribute('src'))return;img.hidden=true;const p=img.parentElement;p.classList.add('ctr-photo-failed');const hint=p.querySelector('.ctr-img-error');if(hint)hint.hidden=false;}
 function retry(event,control){event.preventDefault();event.stopPropagation();const img=control.closest('.ctr-photo').querySelector('img'),url=img&&img.dataset.travelSrc;if(!url)return;const now=Date.now();if(now-(+img.dataset.retryAt||0)<1000)return;img.dataset.retryAt=String(now);loaded(img);img.src=url;}
 function setItems(values){items=(Array.isArray(values)?values:defaults).slice(0,MAX_ITEMS).map(normalize);range='';if(scroller)scroller.scrollTop=0;update();}
 root.NorthTravelGallery={render,setItems,reset:()=>setItems(defaults),loaded,failed,retry,limits:{items:MAX_ITEMS,cards:MAX_ROWS*2}};
})(globalThis);
