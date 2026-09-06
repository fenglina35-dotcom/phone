'use strict';
// Isolated game adapter. Model credentials and the rest of the phone state stay here.
let _pixelHome=null;
function pixelHomeIdentity(){const cid=S.couple&&S.couple.cid,c=cid&&getC(cid);return c&&!c.deleted?{cid,account:actId(),me:S.me,c}:null;}
function pixelHomeValid(s){const i=pixelHomeIdentity();return !!(s&&s===_pixelHome&&i&&s.cid===i.cid&&s.account===i.account&&s.me===i.me&&cur().p==='pixelhome');}
function pixelHomeEntry(s){s.me.pixelHomes=s.me.pixelHomes||{};const key=JSON.stringify([s.account,s.cid]);return s.me.pixelHomes[key]||(s.me.pixelHomes[key]={plan:{},look:0,appliedDay:''});}
function openPixelHome(){if(!pixelHomeIdentity()){toast('先在情侣空间绑定照顾你的角色');return;}closeModal();if(typeof _ma!=='undefined'&&_ma&&!_ma.paused){_mWantPlay=false;_ma.pause();}if(cur().p!=='pixelhome')go('pixelhome');else render();}
function renderPixelHome(){
  const i=pixelHomeIdentity();if(!i)return '<div class="nav"><button class="l" onclick="back()">‹</button><span class="t">先在情侣空间绑定角色</span></div>';
  const token=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('');_pixelHome={...i,token,revision:0};
  return '<iframe id="pixel-home-frame" title="像素少女" allow="autoplay; fullscreen" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#eee3d5" src="games/pixel-home/index.html?v=1203&amp;session='+token+'"></iframe>';
}
function pixelHomeKeepFrame(){if(cur().p!=='pixelhome'){_pixelHome=null;return false;}if(document.getElementById('pixel-home-frame')&&pixelHomeValid(_pixelHome))return true;return false;}
function pixelHomeReply(s,id,data,error){const f=document.getElementById('pixel-home-frame');if(!pixelHomeValid(s)||!f)return;f.contentWindow.postMessage({type:'pixel-home-response',token:s.token,id,data,error},location.protocol==='file:'?'*':location.origin);}
// Persist in the existing phone queue without making animation/model delivery wait for it.
function pixelHomePersist(s){Promise.resolve().then(()=>saveNowAsync()).then(ok=>{if(ok===false)throw new Error('手机存储空间不足，安排尚未保存。');}).catch(e=>pixelHomeReply(s,'storage',null,String(e.message||e)));}
async function pixelHomePlan(s,manual=false,stats){
  if(!pixelHomeValid(s))throw new Error('情侣绑定已改变，请重新进入小屋。');
  if(s.pending){const value=await s.pending;if(manual&&s.recent)s.recent.used=true;return value;}
  if(manual&&s.recent&&Date.now()-s.recent.at<30000&&!s.recent.used){s.recent.used=true;return s.recent.value;}
  const entry=pixelHomeEntry(s),today=PixelHomePolicy.dateKey(new Date()),dates=PixelHomePolicy.days();
  if(!manual&&(dates.every(d=>entry.plan?.[d]===0||entry.plan?.[d]===1)||entry.attemptDay===today))return null;
  entry.attemptDay=today;
  if(!pixelHomeValid(s))throw new Error('情侣绑定已改变，请重新进入小屋。');
  let expired=false;
  const task=(async()=>{
    pixelHomePersist(s);if(!pixelHomeValid(s))throw new Error('照顾已停止。');
    const c=getC(s.cid),state=stats||entry.state||{mood:82,food:58,energy:65,health:94,clean:68};
    const prompt='你是'+String(c.remark||c.name||'伴侣')+'，正在照顾代表玩家的小屋少女。角色设定：'+String(c.persona||'温柔地照顾伴侣').slice(0,8000)+'\n玩家：'+String(s.me.name||'我').slice(0,80)+'。这是独立小游戏的动作安排，不回复微信旧消息，不下订单。按人设选择照顾顺序，适度变化，饥饿先吃饭，疲倦最后休息。动作包括 feed 喂食、bath 洗澡、comb 梳头、teeth 刷牙、face 洗脸、ball 皮球、teddy 小熊、touch 戳脸摸头、sleep 睡觉。前八项可各安排一次，只有精神低于30才加sleep。食物由执行端从现有库存随机选择，洗脸必须先洗面奶后毛巾。\n同时提前为未来七天选择每天早上8点的完整穿搭，0草莓奶油裙，1蓝莓来信学院裙。发型发饰已经成套，不拆开搭配。只输出JSON，无内心或记忆标签：{"actions":["feed","touch","bath","teeth","face","comb","ball","teddy"],"looks":[0,1,0,1,1,0,1]}。';
    const raw=await chatAPI([{role:'system',content:prompt},{role:'user',content:JSON.stringify({dates,state:Object.fromEntries(['mood','food','energy','health','clean','sleeping'].map(k=>[k,state[k]]))})}],{routeIndex:roleChatRouteIndex(c),aux:c.model==='aux',independentRoleModel:true,complete:false,max:1000,timeout:60000});
    if(expired)throw new Error('安排已超时，未应用迟到结果。');
    const result=PixelHomePolicy.parse(raw);if(!pixelHomeValid(s))throw new Error('照顾已停止，未应用旧安排。');
    entry.plan=entry.plan||{};dates.forEach((d,i)=>{if(entry.plan[d]!==0&&entry.plan[d]!==1)entry.plan[d]=result.looks[i];});
    entry.plan=Object.fromEntries(Object.entries(entry.plan).filter(([d])=>d>=today).slice(0,14));entry.planError='';pixelHomePersist(s);
    s.recent={value:result,at:Date.now(),used:manual};return result;
  })();
  // A response body can stall after HTTP headers. Keep the request latch until the
  // actual task settles so another click cannot start a second model request.
  let timer;const bounded=Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(new Error('角色安排等待超时，未重复请求；请检查模型线路后再进入小屋。'));},65000);})]);s.pending=bounded;
  task.then(()=>{clearTimeout(timer);if(s.pending===bounded)s.pending=null;},()=>{clearTimeout(timer);if(s.pending===bounded)s.pending=null;});
  try{return await bounded;}catch(e){if(pixelHomeValid(s)){entry.planError=dates.every(d=>entry.plan?.[d]===0||entry.plan?.[d]===1)?'':String(e.message||e).slice(0,160);pixelHomePersist(s);}throw e;}
}
async function pixelHomeMorning(s){
  const entry=pixelHomeEntry(s),due=PixelHomePolicy.due(entry);if(due){entry.appliedDay=due.day;entry.look=due.look;if(entry.state)entry.state.look=due.look;pixelHomePersist(s);}
  return {look:entry.look===1?1:0,day:entry.appliedDay||'',error:entry.planError||''};
}
window.addEventListener('message',async event=>{
  const s=_pixelHome,m=event.data,f=document.getElementById('pixel-home-frame');
  if(!pixelHomeValid(s)||!f||event.source!==f.contentWindow||event.origin!==(location.protocol==='file:'?'null':location.origin)||!m||m.type!=='pixel-home-request'||m.token!==s.token||typeof m.id!=='string')return;
  try{
    let data;
    if(m.method==='hello'){
      const e=pixelHomeEntry(s);data={state:e.state||null,scope:JSON.stringify([s.account,s.cid]),name:String(s.c.remark||s.c.name||'伴侣'),morning:await pixelHomeMorning(s)};
      pixelHomeReply(s,m.id,data);pixelHomePlan(s).then(()=>pixelHomeMorning(s)).then(info=>pixelHomeReply(s,'morning',info)).catch(e=>pixelHomeReply(s,'morning',{error:e.message}));return;
    }else if(m.method==='save'){
      if(!Number.isInteger(m.revision)||m.revision<=s.revision)return pixelHomeReply(s,m.id,{saved:true});
      const state=PixelHomePolicy.snapshot(m.data);state.look=pixelHomeEntry(s).look===1?1:0;s.revision=m.revision;pixelHomeEntry(s).state=state;
      if(!await saveNowAsync())throw new Error('手机存储空间不足，进度尚未保存。');data={saved:true};
    }else if(m.method==='care'){
      const result=await pixelHomePlan(s,true,PixelHomePolicy.snapshot(m.data));data={actions:result.actions};
    }else if(m.method==='morning'){data=await pixelHomeMorning(s);pixelHomePlan(s).catch(()=>{});
    }else if(m.method==='exit'){pixelHomeReply(s,m.id,{ok:true});back();return;
    }else return;
    pixelHomeReply(s,m.id,data);
  }catch(e){pixelHomeReply(s,m.id,null,String(e.message||e).slice(0,200));}
});

setInterval(()=>{
  if(!_pixelHome)return;
  if(!pixelHomeValid(_pixelHome)){
    const f=document.getElementById('pixel-home-frame');if(f)f.contentWindow.postMessage({type:'pixel-home-response',token:_pixelHome.token,id:'invalid'},location.protocol==='file:'?'*':location.origin);
    _pixelHome=null;
    if(cur().p==='pixelhome'){back();toast('情侣绑定或账号已改变，已停止照顾。');}
  }
},1000);
