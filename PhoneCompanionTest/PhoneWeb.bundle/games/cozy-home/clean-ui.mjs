export function installCleanUI(){
 const settings=document.createElement('button');settings.id='home-settings-toggle';settings.type='button';settings.setAttribute('aria-label','设置');settings.setAttribute('aria-expanded','false');
 settings.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.6 3-.7 2-2 .9-2-.5-2.2 3.8 1.4 1.5v2.4l-1.4 1.5 2.2 3.8 2-.5 2 .9.7 2h4.8l.7-2 2-.9 2 .5 2.2-3.8-1.4-1.5v-2.4l1.4-1.5-2.2-3.8-2 .5-2-.9-.7-2Z"/><circle cx="12" cy="12" r="3.3"/></svg>';
 const drawer=document.createElement('aside');drawer.id='home-settings';drawer.hidden=true;drawer.setAttribute('aria-label','小家设置');
 const heading=document.createElement('h2');heading.textContent='小家设置';drawer.append(heading);
 const nav=document.querySelector('header nav');if(nav){const group=document.createElement('details');group.innerHTML='<summary>画面与观察位置</summary>';group.append(nav);drawer.append(group);}
 const character=document.querySelector('#character-test');if(character){character.open=false;character.querySelector('summary').textContent='人物动作与互动';drawer.append(character);}
 const voice=document.querySelector('#voice-controls'),mic=voice?.querySelector('[data-mic]');
 if(voice){voice.open=false;voice.querySelector('summary').textContent='声音与字幕';drawer.append(voice);}
 if(mic){
  const icon=document.createElement('span');icon.className='mic-art';icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="2.5" width="8" height="13" rx="4"/><path d="M5 10.5v1a7 7 0 0 0 14 0v-1M12 18.5v3M8.5 21.5h7"/><path class="mic-lines" d="M10 6h4M10 8.5h4"/></svg>';
  // Keep the original text in a clipped label so recognition can update it safely.
  const label=document.createElement('span');label.className='mic-label';label.textContent=mic.textContent;mic.replaceChildren(icon,label);
  mic.id='home-microphone';mic.setAttribute('aria-label','开启麦克风说话');mic.title='开启麦克风说话';document.body.append(mic);
  const refresh=()=>{const text=mic.textContent;mic.setAttribute('aria-label',text);mic.title=text;mic.classList.toggle('listening',text.includes('结束'));};
  new MutationObserver(()=>{if(!mic.querySelector('.mic-art')){const text=mic.textContent;label.textContent=text;mic.replaceChildren(icon,label);}refresh();}).observe(mic,{childList:true});
 }
 settings.onclick=()=>{drawer.hidden=!drawer.hidden;settings.setAttribute('aria-expanded',String(!drawer.hidden));};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){drawer.hidden=true;settings.setAttribute('aria-expanded','false');}});
 document.body.append(settings,drawer);document.body.classList.add('clean-home');
 const css=document.createElement('style');css.textContent=`
 .clean-home>header,.clean-home>#room,.clean-home>.room,.clean-home>#hint,.clean-home>#frameRatePanel{display:none!important}
 #home-settings-toggle,#home-microphone{position:fixed;z-index:45;width:44px;height:44px;box-sizing:border-box;padding:11px;border:0;border-radius:50%;background:transparent;color:#7c6c62;cursor:pointer;touch-action:manipulation}
 #home-settings-toggle{right:calc(env(safe-area-inset-right) + 2px);top:calc(env(safe-area-inset-top) + 2px)}
 #home-microphone{right:calc(env(safe-area-inset-right) + 2px);bottom:calc(env(safe-area-inset-bottom) + 2px);color:#956782}
 #home-settings-toggle::before,#home-microphone::before{content:"";position:absolute;inset:3px;z-index:-1;border:1px solid #ffffffb0;border-radius:50%;background:linear-gradient(145deg,#fffaf0ed,#e9ded0e6);box-shadow:0 2px 8px #36251d20}
 #home-settings-toggle svg,#home-microphone svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
 #home-microphone rect{fill:#edd4e2}#home-microphone.listening{color:#bc4279;box-shadow:0 0 0 6px #edb6d34d,0 3px 16px #36251d20}#home-microphone.listening rect{fill:#ffbadb}
 .mic-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.mic-art{display:block;width:100%;height:100%}
 #home-settings{position:fixed;z-index:44;right:16px;top:78px;width:min(360px,calc(100vw - 32px));max-height:calc(100dvh - 100px);overflow:auto;padding:18px;box-sizing:border-box;border:1px solid #fff9;border-radius:20px;background:#fff7ecf2;backdrop-filter:blur(18px);box-shadow:0 12px 40px #352a282b;color:#50463e;font:14px/1.6 sans-serif}
 #home-settings h2{font-size:17px;margin:0 0 12px}#home-settings details{margin:8px 0}#home-settings summary{cursor:pointer;padding:7px 0}
 #home-settings nav{display:flex;flex-wrap:wrap;gap:5px}#home-settings button,#home-settings select,#home-settings input{max-width:100%;font:inherit}
 #home-settings #character-test,#home-settings #voice-controls{position:static;max-width:none;max-height:none;overflow:visible;padding:0;background:transparent;border-radius:0;font:inherit}
 #home-settings #character-test>p:not(.status){display:none}#home-settings #character-test .status{position:static}
 .clean-home #interact{bottom:calc(env(safe-area-inset-bottom) + 76px)}
 .clean-home #notice{pointer-events:none}.clean-home #joystick{bottom:88px}
 `;document.head.append(css);
}
