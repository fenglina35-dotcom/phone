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
    if(!p||!Array.isArray(p.actions)||!p.actions.length||p.actions.length>9||p.actions.some(a=>!allowed.includes(a))||(p.looks!==undefined&&(!Array.isArray(p.looks)||p.looks.length!==7||p.looks.some(i=>i!==0&&i!==1))))throw new Error('照顾安排不完整，保留当前状态；没有自动重复请求。');
    return {actions:[...new Set(p.actions)],looks:p.looks||[]};
  }
  function snapshot(s){
    if(!s||typeof s!=='object'||s.version!==3)throw new Error('小屋存档格式不正确');
    const out={version:3};for(const k of ['mood','food','energy','health','clean']){if(!Number.isFinite(s[k]))throw new Error('小屋状态不完整');out[k]=Math.max(0,Math.min(100,s[k]));}
    out.coins=Math.round(Math.max(0,Math.min(9999,Number(s.coins)||0)));out.room=[0,1,2].includes(s.room)?s.room:0;out.sleeping=s.sleeping===true;out.lightsOff=out.sleeping;
    out.lastAt=Number.isFinite(s.lastAt)?s.lastAt:Date.now();out.inventory=Array.from({length:8},(_,i)=>Math.round(Math.max(0,Math.min(99,Number(s.inventory?.[i])||0))));
    out.look=s.look===1?1:0;out.rewards=Object.fromEntries(Object.entries(s.rewards||{}).filter(([k,v])=>/^\d{4}-\d{2}-\d{2}:[a-z]+$/.test(k)&&v===true).slice(-30));
    out.diary=(Array.isArray(s.diary)?s.diary:[]).filter(x=>typeof x?.text==='string'&&typeof x?.time==='string').slice(-8).map(x=>({text:x.text.slice(0,240),time:x.time.slice(0,40)}));
    out.photos=(Array.isArray(s.photos)?s.photos:[]).filter(x=>typeof x?.image==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x.image)&&x.image.length<300000).slice(-6).map(x=>({image:x.image,label:String(x.label||'').slice(0,80)}));
    if(s.wardrobe)out.wardrobe=wardrobe(s.wardrobe);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s.wardrobeDay||''))out.wardrobeDay=s.wardrobeDay;
    if(/^\d{4}-\d{2}-\d{2}:(morning|evening)$/.test(s.wardrobeSchedule||''))out.wardrobeSchedule=s.wardrobeSchedule;
    return out;
  }
  function wardrobe(s,nested=false){
    if(!s||s.version!=='wardrobe-p82-v1'||!/^outfit(?:[1-9]|1[01])-dress$/.test(s.dress)||!/^outfit(?:[1-9]|1[01])-shoes$/.test(s.shoes)||!/^hair[0-7]$/.test(s.hair)||!/^face(?:[0-3]|-original)$/.test(s.face)||(s.accessory!==null&&!/^outfit(?:[1-9]|1[01])-accessory$/.test(s.accessory)&&s.accessory!=='retained-pink-headband'))throw new Error('衣柜配置不完整，未覆盖原存档');
    const out={version:s.version,dress:s.dress,shoes:s.shoes,hair:s.hair,face:s.face,accessory:s.accessory,motion:s.motion!==false,body:{},adjustments:{}};
    for(const [k,lo,hi,d]of [['size',60,150,100],['legs',55,110,85],['legWidth',60,140,100]]){const v=s.body?.[k]??d;if(!Number.isFinite(v)||v<lo||v>hi)throw new Error('人物比例参数无效');out.body[k]=v;}
    const entries=Object.entries(s.adjustments||{});if(entries.length>400)throw new Error('衣柜调整项过多');
    for(const [k,a]of entries){if(!/^(?:outfit(?:[1-9]|1[01])-(?:dress|shoes|accessory)|hair[0-7]|face(?:[0-3]|-original)|retained-pink-headband)(?:@hair[0-7])?(?:\/[\w-]+)?$/.test(k)||k.length>160||!a||typeof a!=='object')throw new Error('衣柜调整项无效');const t={};for(const [name,v]of Object.entries(a)){if(!['x','y','scale','width','height','rotation','gap'].includes(name)||!Number.isFinite(v)||(['scale','width','height'].includes(name)?v<20||v>250:Math.abs(v)>1600))throw new Error('衣柜调整值无效');t[name]=v;}out.adjustments[k]=t;}
    if(s.savedOutfits!==undefined){
      if(nested||!Array.isArray(s.savedOutfits)||s.savedOutfits.length>30)throw new Error('自定义套装列表无效');
      const ids=new Set();out.savedOutfits=s.savedOutfits.map(p=>{
        if(!p||typeof p.id!=='string'||!/^set-[\w-]{1,80}$/.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>30||/[\u0000-\u001f]/.test(p.name))throw new Error('自定义套装信息无效');
        ids.add(p.id);return{id:p.id,name:p.name,look:wardrobe(p.look,true)};
      });
    }
    return out;
  }
  function applySavedLook(current,look){
    const ids=[look.dress,look.shoes,look.hair,look.face,look.accessory].filter(Boolean);
    const rest=Object.fromEntries(Object.entries(current.adjustments).filter(([k])=>!ids.some(id=>k===id||k.startsWith(id+'/')||k.startsWith(id+'@'))));
    const result={...current,...look,adjustments:{...rest,...look.adjustments}};
    if(current.savedOutfits)result.savedOutfits=current.savedOutfits;
    return wardrobe(result);
  }
  function wardrobeSlot(entry,at=Date.now()){
    const d=new Date(at),hour=d.getHours(),period=hour>=8&&hour<19?'morning':'evening';if(hour<8)d.setDate(d.getDate()-1);const day=dateKey(d);
    if(entry.dailyOutfit?.changedAt>at||String(entry.appliedDay||'')>day)return null;
    if(period==='morning'&&(String(entry.appliedDay||'')>=day||String(entry.morningOutfit?.day||'')>=day))return null;
    if(period==='evening'&&(String(entry.pajamasDay||'')>=day||String(entry.eveningOutfit?.day||'')>=day))return null;
    return{day,period,key:day+':'+period};
  }
  function roleWardrobe(entry,info,at,raw){
    const slot=wardrobeSlot(entry,at);if(!slot)return null;
    let p;try{p=JSON.parse(String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw new Error('角色穿搭格式无效，保留当前搭配。');}
    const current=wardrobe(entry.state?.wardrobe||info.approved),names=info.names;
    if(!p||!/^hair[0-7]$/.test(p.hair)||!names[p.hair]||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>180)throw new Error('角色未选好发型，保留当前搭配。');
    const preset=p.setId?(current.savedOutfits||[]).find(s=>s.id===p.setId):null;
    if(p.setId&&!preset)throw new Error('角色选择的自定义套装已不存在。');
    let look=preset?applySavedLook(current,preset.look):current;
    for(const k of ['dress','shoes','accessory']){
      if(k==='accessory'&&p[k]===null)continue;
      if(typeof p[k]!=='string'||!names[p[k]]||!(k==='accessory'?(/-accessory$/.test(p[k])||p[k]==='retained-pink-headband'):p[k].endsWith('-'+k)))throw new Error('角色选择了衣柜里不存在的单品。');
    }
    if(preset&&['dress','shoes','accessory'].some(k=>p[k]!==preset.look[k]))throw new Error('角色选择的套装和单品不一致。');
    if(slot.period==='evening'&&(p.setId||p.dress!=='outfit3-dress'||p.shoes!=='outfit3-shoes'||p.accessory!=='outfit3-accessory'))throw new Error('夜间必须穿配套的兔兔睡衣。');
    // A style choice never changes the user's facial features or body proportions.
    look=wardrobe({...look,dress:p.dress,shoes:p.shoes,accessory:p.accessory,hair:p.hair,face:current.face,body:current.body,motion:current.motion});
    const built=info.outfits.find(o=>['dress','shoes','accessory'].every(k=>o[k]===look[k]));
    return{...slot,setId:preset?.id||built?.id||'mix',setName:preset?.name||built?.name||names[look.dress]+'搭配',changedAt:at,reason:p.reason.trim(),source:'role-model',items:Object.fromEntries(['dress','shoes','hair','face','accessory'].map(k=>[k,{id:look[k],name:look[k]?names[look[k]]:'未戴发饰'}])),wardrobe:look};
  }
  return Object.freeze({dateKey,days,due,parse,snapshot,wardrobe,applySavedLook,wardrobeSlot,roleWardrobe});
});
