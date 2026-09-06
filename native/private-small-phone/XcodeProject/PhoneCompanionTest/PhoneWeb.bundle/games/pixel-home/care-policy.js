'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RoseCarePolicy=api;})(globalThis,function(){
  const actions=['feed','bath','comb','teeth','face','ball','teddy','touch','sleep'];
  function shuffle(rows,random=Math.random){const a=rows.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function food(s,random=Math.random){const available=[0,1,2].filter(i=>s.inventory[i]>0);return s.food>94?undefined:available[Math.floor(random()*available.length)];}
  function plan(s,preferred,random=Math.random){
    if(s.sleeping||s.health<=20)return [];
    const allowed=actions.filter(a=>a==='sleep'?s.energy<30:a==='feed'?food(s,()=>0)!==undefined:!(['ball','teddy'].includes(a)&&s.energy<20));
    const ordered=Array.isArray(preferred)?[...new Set(preferred)].filter(a=>allowed.includes(a)):shuffle(allowed,random);
    const list=[...ordered,...shuffle(allowed.filter(a=>!ordered.includes(a)),random)].filter(a=>a!=='sleep');
    // Urgent needs precede play. Rest is terminal, never followed by another activity.
    if(s.food<30&&list.includes('feed')){list.splice(list.indexOf('feed'),1);list.unshift('feed');}
    if(s.energy<20)return [...list.filter(a=>['feed','touch'].includes(a)), 'sleep'];
    if(s.energy<30)list.push('sleep');
    return list;
  }
  return Object.freeze({actions,shuffle,food,plan});
});
