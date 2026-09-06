'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PixelHomePolicy=api;})(globalThis,function(){
  function dateKey(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function days(at=Date.now()){const d=new Date(at);return Array.from({length:7},(_,i)=>dateKey(new Date(d.getFullYear(),d.getMonth(),d.getDate()+i)));}
  function due(entry,at=Date.now()){
    const d=new Date(at),key=dateKey(d);if(d.getHours()<8||String(entry.appliedDay||'')>=key)return null;
    const look=entry.plan&&entry.plan[key];return look===0||look===1?{day:key,look}:null;
  }
  function parse(raw){
    const text=String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    let p;try{p=JSON.parse(text);}catch{throw new Error('照顾安排未能读取，保留当前状态；没有自动重复请求。');}
    const allowed=['feed','bath','comb','teeth','face','ball','teddy','touch','sleep'];
    if(!p||!Array.isArray(p.actions)||!p.actions.length||p.actions.length>9||p.actions.some(a=>!allowed.includes(a))||!Array.isArray(p.looks)||p.looks.length!==7||p.looks.some(i=>i!==0&&i!==1))throw new Error('照顾安排不完整，保留当前状态；没有自动重复请求。');
    return {actions:[...new Set(p.actions)],looks:p.looks};
  }
  function snapshot(s){
    if(!s||typeof s!=='object'||s.version!==3)throw new Error('小屋存档格式不正确');
    const out={version:3};for(const k of ['mood','food','energy','health','clean']){if(!Number.isFinite(s[k]))throw new Error('小屋状态不完整');out[k]=Math.max(0,Math.min(100,s[k]));}
    out.coins=Math.round(Math.max(0,Math.min(9999,Number(s.coins)||0)));out.room=[0,1,2].includes(s.room)?s.room:0;out.sleeping=s.sleeping===true;out.lightsOff=out.sleeping;
    out.lastAt=Number.isFinite(s.lastAt)?s.lastAt:Date.now();out.inventory=Array.from({length:8},(_,i)=>Math.round(Math.max(0,Math.min(99,Number(s.inventory?.[i])||0))));
    out.look=s.look===1?1:0;out.rewards=Object.fromEntries(Object.entries(s.rewards||{}).filter(([k,v])=>/^\d{4}-\d{2}-\d{2}:[a-z]+$/.test(k)&&v===true).slice(-30));
    out.diary=(Array.isArray(s.diary)?s.diary:[]).filter(x=>typeof x?.text==='string'&&typeof x?.time==='string').slice(-8).map(x=>({text:x.text.slice(0,240),time:x.time.slice(0,40)}));
    out.photos=(Array.isArray(s.photos)?s.photos:[]).filter(x=>typeof x?.image==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x.image)&&x.image.length<300000).slice(-6).map(x=>({image:x.image,label:String(x.label||'').slice(0,80)}));return out;
  }
  return Object.freeze({dateKey,days,due,parse,snapshot});
});
