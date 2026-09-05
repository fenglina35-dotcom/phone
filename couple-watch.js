/* Foreground-only couple permissions. This module never reads message bodies. */
(function(root){
  'use strict';
  function localDay(at){const d=new Date(at);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
  function create(options){
    const now=options.now||Date.now,random=options.random||Math.random;
    let visit=null,session=null,lastTick=0;
    function reset(){visit=null;session=null;lastTick=0;}
    function tick(){
      const at=now(),s=options.read(),day=localDay(at);
      if(!s){reset();return;}
      let ledger=s.owner.watchDaily;
      if(!ledger||ledger.day!==day){s.owner.watchDaily={day,counts:{}};ledger=s.owner.watchDaily;options.save();visit=null;session=null;}
      const key=s.account+'|'+s.cid+'|'+s.kind+'|'+s.key;
      // A media/render stall is not a page exit. Visibility/pagehide already
      // reset the session; only a wholly unobserved minute or clock reversal
      // discards elapsed foreground time here.
      const gap=lastTick&&(at<lastTick||at-lastTick>60000);lastTick=at;
      if(!visit||visit.owner!==s.owner||visit.key!==key){
        const countKey=s.kind+':'+s.key;
        ledger.counts=ledger.counts||{};
        const count=Math.max(0,Number(ledger.counts[countKey])||0)+1;
        ledger.counts[countKey]=count;options.save();
        visit={owner:s.owner,key,count};session=null;
      }
      const context=s.context||s.key;
      if(s.exempt){session=null;return;}
      if(gap||!session||session.context!==context){
        const min=s.kind==='chat'?30000:20000;
        session={context,at,due:at+min+Math.min(1,Math.max(0,random()))*(60000-min),attempted:false,visit};
      }
      if(visit.attempted||at<session.due)return;
      if(options.ready&&!options.ready(s))return;
      const current=session;visit.attempted=true;
      const event=Object.assign({},s,{count:visit.count,at,day});
      const valid=()=>{
        if(options.authorized)return localDay(now())===day&&options.authorized(event);
        const next=options.read();
        return session===current&&visit===current.visit&&localDay(now())===day&&!!next&&next.owner===s.owner&&!next.exempt&&next.account===s.account&&next.cid===s.cid&&next.kind===s.kind&&next.key===s.key&&(next.context||next.key)===context;
      };
      if(valid())Promise.resolve(options.react(event,valid)).catch(()=>{});
    }
    function inspect(){return{active:!!session,dueAt:session?session.due:0,attempted:!!(visit&&visit.attempted),count:visit?visit.count:0};}
    return{tick,reset,inspect};
  }
  const api={create,localDay};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CoupleWatch=api;
})(typeof window!=='undefined'?window:globalThis);
