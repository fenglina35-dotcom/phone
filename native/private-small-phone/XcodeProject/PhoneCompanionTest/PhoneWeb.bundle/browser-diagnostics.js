/* Bounded local evidence only. Never serialize application state or error messages. */
(function(root){
 'use strict';
 var KEY='north-browser-diagnostics-v1',LIMIT=64,rows=[],previous=null,persistTimer=0,writing=false,lastHome=null;
 var run=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),started=Date.now(),stage={name:'boot',at:started},lastTick=started,wasVisible=!document.hidden;
 function safeName(v){return String(v||'').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,72);}
 function category(e){var m=String(e&&e.message||e||'').slice(0,2048);return /call stack|recursion/i.test(m)?'stack-overflow':/invalid string length/i.test(m)?'string-length':/quota/i.test(m)?'storage-quota':/memory/i.test(m)?'memory-error':/not defined/i.test(m)?'undefined-reference':/not a function/i.test(m)?'not-callable':/syntax|unexpected token/i.test(m)?'syntax-error':/network|fetch/i.test(m)?'network-error':'other-error';}
 function frames(e){return String(e&&e.stack||'').slice(0,16000).split('\n').slice(0,45).map(function(line){var m=line.match(/(?:\/|\\)((?:app|web-hotfix|cohab-theater|browser-diagnostics|license-gate|daily-event-ledger|request-diagnostics|cohab-model-diagnostics)\.js)(?:\?[^\s):]*)?:(\d+):(\d+)/);if(!m)return null;var fn=line.match(/^\s*(?:at )?([A-Za-z_$][\w.$]*)\s*(?:@|\()/);return {file:m[1],line:+m[2],column:+m[3],fn:fn?safeName(fn[1]):''};}).filter(Boolean).slice(0,24);}
 try{var raw=localStorage.getItem(KEY);if(raw&&raw.length<60000){var old=JSON.parse(raw);if(old&&old.schema===1&&Array.isArray(old.events))previous=old;}}catch(_){}
 function base(){return {schema:1,run:run,started:started,at:Date.now(),shell:safeName(root.__NORTH_SHELL_BUILD__),stage:stage,visible:!document.hidden,lastHome:lastHome,events:rows};}
 function persist(){clearTimeout(persistTimer);persistTimer=0;if(writing)return;writing=true;try{var text=JSON.stringify(base());while(text.length>48000&&rows.length>1){rows.shift();text=JSON.stringify(base());}localStorage.setItem(KEY,text);}catch(_){}writing=false;}
 function record(kind,data,urgent){rows.push({at:Date.now(),kind:kind,data:data||{}});if(rows.length>LIMIT)rows.splice(0,rows.length-LIMIT);if(urgent)persist();else if(!persistTimer)persistTimer=setTimeout(persist,2000);}
 function error(where,e){try{record('error',{where:safeName(where),type:safeName(e&&e.name),category:category(e),frames:frames(e)},true);}catch(_){} }
 function mark(name,count){try{var next=safeName(name);if(next===stage.name){if(Number.isFinite(count))stage.count=count;return;}stage={name:next,at:Date.now()};if(Number.isFinite(count))stage.count=count;record('stage',Object.assign({},stage),/^cohab-enter$/.test(next));}catch(_){} }
 function resourceType(src){var s=String(src||'');return /^idb:/.test(s)?'unresolved-idb':/^data:/.test(s)?'data':/^blob:/.test(s)?'blob':/assets\/app-icons\//.test(s)?'app-icon-asset':/^https?:/.test(s)?'http':'relative-or-empty';}
 root.addEventListener('error',function(e){var t=e.target;if(t&&t!==root&&t.tagName){record('resource-error',{tag:safeName(t.tagName),source:resourceType(t.currentSrc||t.src||t.href)},false);}else error('window',e.error||{message:e.message});},true);
 root.addEventListener('unhandledrejection',function(e){error('unhandled-rejection',e.reason);});
 document.addEventListener('visibilitychange',function(){wasVisible=!document.hidden;lastTick=Date.now();record('visibility',{visible:wasVisible},true);});
 root.addEventListener('pagehide',function(e){record('pagehide',{persisted:!!e.persisted},true);});
 root.addEventListener('pageshow',function(e){lastTick=Date.now();record('pageshow',{persisted:!!e.persisted},true);});
 // Capture before the settings click replaces the home DOM; never read labels or image URLs.
 document.addEventListener('click',function(){try{var home=document.getElementById('homeDesktop');if(!home)return;var nodes=home.querySelectorAll('.home-item'),items=[];for(var i=0;i<Math.min(nodes.length,60);i++){var el=nodes[i],rect=el.getBoundingClientRect(),style=getComputedStyle(el),img=el.querySelector('img');items.push({box:[Math.round(rect.x),Math.round(rect.y),Math.round(rect.width),Math.round(rect.height)],display:style.display,visibility:style.visibility,opacity:style.opacity,image:img?{complete:img.complete,width:img.naturalWidth,source:resourceType(img.getAttribute('src'))}:null});}lastHome={at:Date.now(),total:nodes.length,items:items};record('home-observed',{items:items.length},false);}catch(_){}},true);
 setInterval(function(){var now=Date.now(),gap=now-lastTick;lastTick=now;if(wasVisible&&!document.hidden&&gap>1800)record('event-loop-gap',{ms:gap},true);wasVisible=!document.hidden;},1000);
 try{if(root.PerformanceObserver&&PerformanceObserver.supportedEntryTypes&&PerformanceObserver.supportedEntryTypes.indexOf('longtask')>=0){var observer=new PerformanceObserver(function(list){var entries=list.getEntries(),max=0;entries.forEach(function(e){max=Math.max(max,e.duration);});if(max>=100)record('long-task',{count:entries.length,maxMs:Math.round(max)},false);});observer.observe({entryTypes:['longtask']});}}catch(_){}
 function snapshot(){
  var images={examined:0,total:document.images.length,broken:0,pending:0,unresolvedIdb:0},scripts=[];
  for(var i=0;i<Math.min(document.images.length,500);i++){var img=document.images[i];images.examined++;if(!img.complete)images.pending++;else if(!img.naturalWidth)images.broken++;if(resourceType(img.getAttribute('src'))==='unresolved-idb')images.unresolvedIdb++;}
  for(var j=0;j<document.scripts.length;j++){var src=String(document.scripts[j].src||''),m=src.match(/\/([a-zA-Z0-9_-]+\.js)\?v=(\d+)/);if(m)scripts.push({file:m[1],version:m[2]});}
  var context={};try{if(typeof root.northBrowserDiagnosticContext==='function')context=root.northBrowserDiagnosticContext();}catch(e){error('diagnostic-context',e);}
  var mem=root.performance&&performance.memory;
  return {schema:1,note:'仅本机运行元数据，不含聊天、角色姓名、密钥、图片和完整网址。上次记录未结束或定时器延迟不等于已证实崩溃或内存不足。多标签页可能覆盖上次记录。',current:base(),previous:previous,environment:{userAgent:String(navigator.userAgent||'').slice(0,320),platform:String(navigator.platform||'').slice(0,40),standalone:!!navigator.standalone,online:navigator.onLine,viewport:[root.innerWidth,root.innerHeight,root.devicePixelRatio],serviceWorkerControlled:!!(navigator.serviceWorker&&navigator.serviceWorker.controller),memory:mem?{used:mem.usedJSHeapSize,limit:mem.jsHeapSizeLimit}:null},scripts:scripts.slice(0,60),images:images,context:context};
 }
 function report(){return JSON.stringify(snapshot(),null,2);}
 function open(){
  var prior=document.getElementById('north-browser-report');if(prior)prior.remove();
  var panel=document.createElement('section');panel.id='north-browser-report';panel.style.cssText='position:fixed;inset:12px;z-index:2147483647;background:#17171e;color:#fff;border:1px solid #777;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px;font:14px/1.5 sans-serif';
  var title=document.createElement('b');title.textContent='浏览器运行诊断';var hint=document.createElement('div');hint.textContent='在出问题的原浏览器复制。若复制失败，请长按下方文字全选复制。突然关闭的原因可能需要设备日志才能确认。';
  var area=document.createElement('textarea');area.readOnly=true;area.setAttribute('aria-label','浏览器运行诊断报告');area.style.cssText='flex:1;min-height:120px;width:100%;box-sizing:border-box;background:#222;color:#eee;font:12px monospace;user-select:text;-webkit-user-select:text';area.value=report();
  var copy=document.createElement('button');copy.textContent='复制诊断';copy.onclick=function(){area.value=report();var text=area.value;try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){copy.textContent='已复制';},function(){area.focus();area.select();copy.textContent='请长按文本复制';});}else{area.focus();area.select();copy.textContent=document.execCommand('copy')?'已复制':'请长按文本复制';}}catch(_){area.focus();area.select();copy.textContent='请长按文本复制';}};
  var close=document.createElement('button');close.textContent='关闭';close.onclick=function(){panel.remove();};[copy,close].forEach(function(button){button.style.cssText='min-height:44px;flex-shrink:0;border:1px solid #777;border-radius:9px;background:#333;color:#fff;font:15px sans-serif';});panel.append(title,hint,area,copy,close);document.body.appendChild(panel);
 }
 root.NorthBrowserDiagnostics={error:error,mark:mark,report:report,open:open};
 record('boot',{previousAvailable:!!previous},true);
})(window);
