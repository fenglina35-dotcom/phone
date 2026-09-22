const params=new URLSearchParams(location.search),token=params.get('session');
if(params.get('private')==='1'&&token&&window.parent!==window){
 let ready=false,sequence=0,lastState='',lastSent=0;
 const send=(kind,data={})=>parent.postMessage({type:'cozy-house',token,kind,...data},'*');
 const status=text=>{const el=document.querySelector('.voice-status');if(el)el.textContent=text;};
 function scene(force=false){const a=window.cozyCharacter,h=window.cozy;if(!a||!h)return;const snap=a.snapshot(),ob=a.observe(),targets=a.targets();const player=h.player||{};const current={references:a.references?.(),companion:a.companionState?.(),character:ob,player:{x:player.x,y:player.y,z:player.z,room:h.world.room(player),seated:h.state().seated,posture:h.state().posture},targets:{locations:targets.locations,controls:targets.controls,furniture:targets.furniture.map(x=>({id:x.id,label:x.label})),doors:targets.doors},lastEvents:snap.events.slice(-4).map(e=>({type:e.type,state:e.state,reason:e.reason,door:e.door,command:e.command}))};const text=JSON.stringify(current);if(force||text!==lastState||Date.now()-lastSent>4000){send('scene',{scene:{...current,observedAt:new Date().toISOString()}});lastState=text;lastSent=Date.now();}}
 function connect(){if(ready||!window.cozyCharacter||!document.querySelector('#home-microphone'))return;ready=true;const mic=document.querySelector('#home-microphone');mic.onclick=()=>send('mic');mic.setAttribute('aria-label','开启持续识别');
 const voice=document.querySelector('#voice-controls');voice.querySelector('select').hidden=true;voice.querySelector('[data-demo]').hidden=true;voice.querySelector('[data-stop]').onclick=()=>send('stop-audio');voice.querySelector('small').textContent='沿用私人小手机已绑定角色的音色与记忆。点击话筒开启，再点一次关闭；角色说话期间暂停识别。';const button=voice.querySelector('[data-text]'),input=voice.querySelector('input');button.textContent='发送给角色';button.onclick=()=>{const text=input.value.trim();if(!text)return;scene(true);send('say',{id:'text-'+(++sequence),text});input.value='';};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();button.click();}};
 const exit=document.createElement('button');exit.type='button';exit.textContent='返回小手机';exit.onclick=()=>send('exit');document.querySelector('#home-settings').prepend(exit);send('hello');scene(true);}
 const interval=setInterval(()=>{connect();if(ready)scene();},1000);
 window.addEventListener('message',e=>{const d=e.data;if(e.source!==parent||!d||d.type!=='cozy-phone'||d.token!==token)return;const a=window.cozyCharacter;
 if(d.kind==='connected'){window.cozyPrivateConnected=true;status('已连接：'+d.name+'，字幕固定中文');}
 if(d.kind==='status')status(d.text);
 if(d.kind==='mic-state'){const m=document.querySelector('#home-microphone'),label=m?.querySelector('.mic-label');if(label)label.textContent=d.enabled?'结束麦克风说话':'开启麦克风说话';m?.classList.toggle('listening',!!d.enabled);m?.setAttribute('aria-label',d.enabled?'关闭持续识别':'开启持续识别');status(d.text);}
 if(d.kind==='reply'){const result=a.command({type:'speak',external:true,text:d.text,id:d.id});if(!result.ok){send('speech-ready',{id:d.id,failed:true});status(result.error);}}
 if(d.kind==='audio-start')a.externalSpeech('start');
 if(d.kind==='audio-end')a.cancelExternalSpeech(d.id);
 if(d.kind==='user-subtitle'){try{a.userSubtitle(d.text);}catch{}}
 if(d.kind==='action'){const result=a.command(d.action);send('action-result',{result});scene(true);}
 });
 window.addEventListener('cozy-speech-ready',e=>send('speech-ready',{id:e.detail.id}));
 window.addEventListener('pagehide',()=>{clearInterval(interval);send('suspend');});
}
