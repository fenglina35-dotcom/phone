// Bounded, local graphics diagnostics. Never include dialogue, layouts or saves.
export function installRenderDiagnostics(cozy){
 const button=document.createElement('button');button.textContent='复制画面诊断';button.type='button';
 const dialog=document.createElement('dialog'),area=document.createElement('textarea'),close=document.createElement('button');
 area.readOnly=true;area.style.cssText='width:min(70vw,600px);height:40vh';area.setAttribute('aria-label','画面诊断');
 close.textContent='关闭';close.onclick=()=>dialog.close();dialog.append(area,close);document.body.append(dialog);
 const panel=document.querySelector('#home-settings')||document.querySelector('header nav');
 const arm=document.createElement('button'),copy=document.createElement('button'),download=document.createElement('button'),status=document.createElement('p');
 arm.type=copy.type=download.type='button';arm.textContent='准备记录切回卡顿';copy.textContent='复制切回记录';download.textContent='下载切回记录';
 status.setAttribute('role','status');status.style.cssText='font-size:12px;max-width:280px;line-height:1.6';
 const traceText=()=>JSON.stringify({revision:cozy.revision,browser:navigator.userAgent,screen:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},resumeTrace:cozy.resumeTrace.read()},null,2);
 cozy.resumeTrace.subscribe(state=>{
  arm.disabled=state==='armed'||state==='recording';copy.disabled=download.disabled=!cozy.resumeTrace.read()||state==='recording';button.disabled=state==='recording';
  status.textContent=({idle:'可自动记录切回前台后的20秒。',armed:'已准备：关闭设置，切到后台，再回到小家。',recording:'正在记录20秒，请正常走动和转动镜头。',done:'记录已停止。请复制或下载切回记录，刷新网页前先保存。'})[state];
 });
 arm.onclick=()=>cozy.resumeTrace.arm();
 copy.onclick=async()=>{const text=traceText();try{await navigator.clipboard.writeText(text);status.textContent='切回记录已复制，可以发给我了。';}catch{area.value=text;dialog.showModal();area.select();}};
 download.onclick=()=>{const url=URL.createObjectURL(new Blob([traceText()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='cozy-resume-recording.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
 panel.append(arm,status,copy,download);
 button.onclick=async()=>{
  button.disabled=true;button.textContent='正在读取画面诊断…';
  let completion;
  try{completion=await cozy.frameProbe?.capture();}catch(e){completion={status:'probe-error',message:String(e)};}finally{button.disabled=false;button.textContent='复制画面诊断';}
  const text=JSON.stringify({revision:cozy.revision,browser:navigator.userAgent,screen:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},timing:cozy.frameTiming.read(),work:cozy.frameCosts?.read(),completion,clock:cozy.frameClock?.snapshot(),loop:cozy.frameLoop?.snapshot(),passes:cozy.renderPasses?.read(),viewport:cozy.viewportSizer?.snapshot(),draw:cozy.renderer.info.render,graphics:cozy.residency.report(),loader:cozy.sharedImageStats,compressedTextures:cozy.gpuImageStats},null,2);
  try{await navigator.clipboard.writeText(text);button.textContent='画面诊断已复制';setTimeout(()=>button.textContent='复制画面诊断',2000);}
  catch{area.value=text;dialog.showModal();area.select();}
 };
 panel.append(button);
}
