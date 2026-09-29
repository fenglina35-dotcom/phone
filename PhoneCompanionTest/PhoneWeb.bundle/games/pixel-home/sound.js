'use strict';
// User-supplied local audio. No remote URLs and no writes to the original music DB.
window.RoseDollSound=(()=>{
  const KEY='rose-doll-p07:audio';let choice='default',wanted=true,effects=true,unlocked=false,render=()=>{},error='';
  try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s){choice=s.choice==='library'?'library':'default';wanted=s.wanted!==false;effects=s.effects!==false;}}catch{}
  const bg=document.createElement('audio');bg.id='doll-bgm';bg.src='assets/bgm-user-p07.mp3';bg.loop=true;bg.preload='metadata';bg.volume=.30;bg.hidden=true;document.body.append(bg);
  // Bounded overlap: repeated taps remain responsive without accumulating players.
  const taps=Array.from({length:4},(_,i)=>{const a=document.createElement('audio');a.id='doll-tap-'+i;a.src='assets/tap-user-p07.mp3';a.preload='auto';a.volume=.65;a.hidden=true;document.body.append(a);return a;});let nextTap=0;
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({choice,wanted,effects}));}catch{}};
  async function start(){if(choice!=='default'||!wanted||document.hidden)return;try{await bg.play();error='';}catch{error='点一下播放，开启小屋背景音乐。';}render();}
  function tap(){if(!effects||document.hidden)return;const a=taps[nextTap++%taps.length];a.pause();a.currentTime=0;a.play().catch(()=>{});}
  async function playDefault(){choice='default';wanted=true;unlocked=true;window.RoseDollMusic?.stop();save();await start();}
  function pause(){wanted=false;bg.pause();save();render();}
  function suspend(){bg.pause();for(const a of taps)a.pause();}
  function mount(root){
    render=()=>{if(!root.isConnected)return;root.replaceChildren();const title=document.createElement('p');title.className='panel-copy';title.textContent='默认音乐 · 你提供的第二段音频';root.append(title);
      const row=document.createElement('div');row.className='music-controls';const play=document.createElement('button');play.id='default-music-toggle';play.textContent=!bg.paused?'暂停默认音乐':choice==='library'?'切回默认音乐':'播放默认音乐';play.onclick=()=>!bg.paused?pause():playDefault();const fx=document.createElement('button');fx.id='tap-sound-toggle';fx.textContent=effects?'点击音效：开':'点击音效：关';fx.onclick=()=>{effects=!effects;if(!effects)for(const a of taps)a.pause();save();render();};row.append(play,fx);root.append(row);if(error){const p=document.createElement('p');p.className='music-error';p.textContent=error;root.append(p);}};render();
  }
  document.addEventListener('pointerdown',()=>{if(!unlocked){unlocked=true;start();}},{capture:true});
  document.addEventListener('rose-doll:library-play',()=>{choice='library';wanted=false;bg.pause();save();render();});
  document.addEventListener('visibilitychange',()=>document.hidden?suspend():unlocked&&start());
  window.addEventListener('pagehide',suspend);window.addEventListener('pageshow',()=>{if(unlocked)start();});
  bg.addEventListener('play',()=>render());bg.addEventListener('pause',()=>render());
  bg.addEventListener('error',()=>{error='默认音乐暂时无法播放，请检查本地音频文件。';render();});
  return {tap,mount};
})();
