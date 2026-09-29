/* Private aggregate quota display. No provider credentials or model calls. */
'use strict';
var _cloudUsageData=null,_cloudUsageAt=0,_cloudUsageScope='',_cloudUsageTask=null;
var CLOUD_USAGE_SNAPSHOT={provider:'Supabase',metric:'云函数调用',unit:'次',used:758981,limit:500000,remaining:0,start:'2026-09-05T00:00:00Z',end:'2026-10-05T00:00:00Z',checkedAt:'2026-09-27T00:00:00Z',mode:'manual',details:[{name:'出站流量',used:3.261,limit:5,unit:'GB'},{name:'数据库',used:.126,limit:.5,unit:'GB'},{name:'文件存储',used:.07,limit:1,unit:'GB'}]};
function cloudUsageLevel(used,limit){if(!Number.isFinite(used)||!Number.isFinite(limit)||limit<=0)return 0;return used>=limit?100:used>=limit*.95?95:used>=limit*.8?80:0;}
function cloudUsageView(row,now=Date.now()){
 const valid=row&&Number.isFinite(row.used)&&row.used>=0&&Number.isFinite(row.limit)&&row.limit>0&&Number.isFinite(Date.parse(row.checkedAt))&&Number.isFinite(Date.parse(row.end));
 if(!valid)return {known:false};const expired=now>=Date.parse(row.end),stale=now-Date.parse(row.checkedAt)>3600000;
 return {known:true,expired,stale,level:expired?0:cloudUsageLevel(row.used,row.limit),remaining:expired?null:Math.max(0,row.limit-row.used),pct:Math.min(100,Math.max(0,row.used/row.limit*100))};
}
function cloudUsageNumber(v){return Number(v).toLocaleString('zh-CN',{maximumFractionDigits:3});}
function cloudUsageCard(row,name){
 const v=cloudUsageView(row),e=typeof esc==='function'?esc:x=>String(x);
 if(!v.known)return '<section class="rk-card"><h2>'+e(name)+'</h2><p class="rk-note">总额：100,000 次／日（账户共享）<br>已用与剩余尚未核实；不是 0。每日北京时间 08:00 重置。</p></section>';
 const manual=row.mode==='manual',date=new Date(row.checkedAt).toLocaleString('zh-CN',{hour12:false});
 return '<section class="rk-card"><h2>'+e(name)+' · '+(manual?'最近核实':'缓存统计')+'</h2><p class="rk-note">'+(name==='Supabase'?'角色后台、智能家居、K 共用':'全部 Workers 共用，包含 K 与邀请码服务')+'</p><p>已用约 <b>'+cloudUsageNumber(row.used)+'</b> / '+cloudUsageNumber(row.limit)+' '+e(row.unit)+'</p><progress max="100" value="'+v.pct+'" style="display:block;width:100%;accent-color:'+(v.level>=95?'#f19696':'#79dea0')+'"></progress><p class="rk-note">'+(v.expired?'这是上一周期记录，本周期剩余未知。':'核实时剩余约 '+cloudUsageNumber(v.remaining)+' '+e(row.unit)+(v.level===100?'；免费额度已用完。':v.level>=80?'；额度接近用完。':'。'))+'<br>周期：'+e(row.start.slice(0,10))+' → '+e(row.end.slice(0,10))+'<br>核实时间：'+e(date)+'<br>'+(manual?'人工核实快照，不会随使用自动递增。':v.stale?'缓存已过期，请更新；当前显示旧值。':'供应商统计可能延迟，并非实时计费余额。')+'</p>'+(row.details||[]).map(d=>'<p class="rk-note">'+e(d.name)+'：约 '+cloudUsageNumber(d.used)+' / '+cloudUsageNumber(d.limit)+' '+e(d.unit)+'</p>').join('')+(name==='Supabase'?'<p class="rk-note">持续超额可能限制云端服务；此提醒不会自动升级付费。不同指标不相加。</p>':'')+'</section>';
}
function cloudUsageHTML(standalone=false){return (standalone?'':'<div class="rk-card"><h2>云端额度</h2><p class="rk-note">查看两个云端的大概用量，智能家居已包含在共享统计中。仅在你点击时更新，不后台轮询。</p><button onclick="cloudUsageOpen()" class="rk-secondary">查看用量与提醒</button></div>')+'<div id="cloud-usage-panel" hidden></div>';}
function cloudUsagePaint(message=''){
 const panel=document.getElementById('cloud-usage-panel');if(!panel)return;
 const d=_cloudUsageScope===robotFaceScope()?_cloudUsageData:null;
 panel.innerHTML=cloudUsageCard(d?.supabase||CLOUD_USAGE_SNAPSHOT,'Supabase')+cloudUsageCard(d?.cloudflare,'Cloudflare')+'<div class="rk-card"><p id="cloud-usage-status" class="rk-note" role="status"></p><div class="rk-actions"><button onclick="cloudUsageRefresh()" class="rk-secondary" '+(_cloudUsageTask?'disabled':'')+'>更新缓存</button><button onclick="cloudUsageCopy()" class="rk-copy">复制用量</button></div><p class="rk-note"><a href="https://supabase.com/dashboard/org/lwjvjiuwlxkgqewmhqbw/usage" target="_blank" rel="noopener noreferrer">Supabase 控制台</a> · <a href="https://dash.cloudflare.com/b027959e9b84821b92e89b52b734543a/workers-and-pages" target="_blank" rel="noopener noreferrer">Cloudflare 控制台</a></p></div>';
 document.getElementById('cloud-usage-status').textContent=message||'80%、95%、100% 分级提醒；同一周期同一等级只提醒一次。';
}
function cloudUsageNotice(data){
 try{S.settings.cloudUsageNotices=S.settings.cloudUsageNotices||{};const map=S.settings.cloudUsageNotices;for(const row of [data?.supabase||CLOUD_USAGE_SNAPSHOT,data?.cloudflare]){const v=cloudUsageView(row);if(!v.known||!v.level)continue;const key=robotFaceScope()+':'+row.provider+':'+row.start;if((map[key]||0)>=v.level)continue;map[key]=v.level;toast(row.provider+' 最近核实用量'+(v.level===100?'已超过免费额度':'达到 '+v.level+'%'));}const keys=Object.keys(map);keys.slice(0,Math.max(0,keys.length-24)).forEach(k=>delete map[k]);save(250);}catch(_){}
}
function cloudUsageOpen(){if(!robotFaceAvailable())return;const panel=document.getElementById('cloud-usage-panel');if(!panel)return;panel.hidden=false;cloudUsagePaint();cloudUsageNotice(_cloudUsageScope===robotFaceScope()?_cloudUsageData:null);void cloudUsageRefresh();}
async function cloudUsageRefresh(){
 if(!robotFaceAvailable()||_cloudUsageTask)return;
 const scope=robotFaceScope();if(_cloudUsageScope===scope&&Date.now()-_cloudUsageAt<3600000){cloudUsagePaint('已显示最近缓存；一小时内不重复请求云端。');return;}
 if(_cloudUsageScope!==scope){_cloudUsageData=null;_cloudUsageAt=0;_cloudUsageScope=scope;}
 let failed=false;_cloudUsageTask=true;cloudUsagePaint('正在更新统计…');
 try{const r=await fetchT(companionCloudURL()+'/functions/v1/phone-cloud-usage',{method:'POST',headers:{apikey:COMPANION_KEY,Authorization:'Bearer '+COMPANION_KEY,'Content-Type':'application/json'},body:JSON.stringify({target:scope,ownerSecret:companionOwnerSecret()})},15000);if(!r.ok)throw Error('unavailable');const d=await r.json();if(!d?.ok||!cloudUsageView(d.supabase).known||d.cloudflare&&!cloudUsageView(d.cloudflare).known)throw Error('invalid');if(robotFaceScope()!==scope)return;_cloudUsageData=d;_cloudUsageScope=scope;_cloudUsageAt=Date.now();cloudUsageNotice(d);}
 catch(_){failed=true;if(robotFaceScope()===scope){_cloudUsageScope=scope;_cloudUsageAt=Date.now();}}
 finally{_cloudUsageTask=null;if(robotFaceScope()===scope)cloudUsagePaint(failed?'更新未成功，保留上次核实值；一小时内不自动重试。':_cloudUsageData?.warning||(_cloudUsageData?'已更新可获取的统计；Supabase 保留人工核实快照。':'暂未取得云端统计，保留快照；一小时内不自动重试。'));}
}
async function cloudUsageCopy(){const panel=document.getElementById('cloud-usage-panel');if(!panel)return;const ok=await copyTextCompat(panel.innerText);const status=document.getElementById('cloud-usage-status');if(status)status.textContent=ok?'已复制用量概览':'复制未成功，请重试';}
