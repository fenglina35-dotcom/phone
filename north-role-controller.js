(()=>{
  'use strict';

  const config={
    url:'https://lkhlyfpssmrjkkzhuzag.supabase.co',
    publishableKey:'sb_publishable_uKytf2Tc_FmLv15SkkJyCQ_VU8IRSt2'
  };
  const $=id=>document.getElementById(id);
  const ui={
    loginCard:$('login-card'),email:$('email'),password:$('password'),loginButton:$('login-button'),loginStatus:$('login-status'),
    controller:$('controller'),roleName:$('role-name'),deviceStatus:$('device-status'),lastSync:$('last-sync'),refreshButton:$('refresh-button'),logoutButton:$('logout-button'),
    pairButton:$('pair-button'),pairPanel:$('pair-panel'),pairTarget:$('pair-target'),pairCode:$('pair-code'),pairExpiry:$('pair-expiry'),pairStatus:$('pair-status'),
    appSelect:$('app-select'),limitMinutes:$('limit-minutes'),viewButton:$('view-button'),lockButton:$('lock-button'),unlockButton:$('unlock-button'),limitButton:$('limit-button'),commandStatus:$('command-status'),commandHistory:$('command-history')
  };
  let accessToken='';
  let currentSession=null;
  let refreshTimer=0;
  let busy=false;

  function status(node,message,kind=''){
    node.textContent=message||'';
    node.className='status'+(kind?' '+kind:'');
  }
  function formatDate(value){
    if(!value)return '—';
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'—':date.toLocaleString();
  }
  function cleanError(error){
    const raw=String(error&&error.message||error||'请求失败');
    if(/invalid login credentials/i.test(raw))return '账号或密码错误 / Invalid login credentials';
    if(/review-account-not-configured/i.test(raw))return '该账号尚未绑定审核测试角色 / Review role is not configured';
    if(/review-device-not-paired/i.test(raw))return '请先在 North 完成配对 / Pair North first';
    if(/review-app-not-in-latest-device-snapshot/i.test(raw))return '请在 North 选择 App 并上传一次最新数据 / Upload selected apps from North';
    if(/failed to fetch|networkerror/i.test(raw))return '网络连接失败，请稍后重试 / Network request failed';
    return raw.replace(/^Error:\s*/i,'').slice(0,220);
  }
  async function api(path,{body,token=accessToken}={}){
    const headers={'Content-Type':'application/json','apikey':config.publishableKey};
    if(token)headers.Authorization='Bearer '+token;
    const response=await fetch(config.url+path,{method:'POST',headers,body:JSON.stringify(body||{})});
    const text=await response.text();
    let data=null;
    try{data=text?JSON.parse(text):null;}catch(_){data=text;}
    if(!response.ok){
      const message=data&&typeof data==='object'?(data.message||data.error_description||data.error||text):text;
      throw new Error(message||('HTTP '+response.status));
    }
    return data;
  }
  function rpc(name,body){
    return api('/rest/v1/rpc/'+encodeURIComponent(name),{body});
  }
  function setBusy(value){
    busy=value;
    [ui.loginButton,ui.refreshButton,ui.pairButton,ui.viewButton,ui.lockButton,ui.unlockButton,ui.limitButton].forEach(button=>{button.disabled=value;});
    if(!value)updateCommandAvailability();
  }
  function appRows(session){
    const rows=session&&session.snapshot&&session.snapshot.screenTime&&session.snapshot.screenTime.apps;
    return Array.isArray(rows)?rows.filter(row=>row&&row.id):[];
  }
  function updateCommandAvailability(){
    const paired=!!(currentSession&&currentSession.linked);
    const hasApp=!!ui.appSelect.value;
    ui.viewButton.disabled=busy||!paired;
    ui.lockButton.disabled=busy||!paired||!hasApp;
    ui.unlockButton.disabled=busy||!paired||!hasApp;
    ui.limitButton.disabled=busy||!paired||!hasApp;
  }
  function renderApps(session){
    const selected=ui.appSelect.value;
    const rows=appRows(session);
    ui.appSelect.textContent='';
    if(!rows.length){
      const option=document.createElement('option');
      option.value='';option.textContent='等待 North 上传已选 App…';ui.appSelect.append(option);
    }else{
      rows.forEach((row,index)=>{
        const option=document.createElement('option');
        option.value=String(row.id);
        const name=String(row.name||'').trim()||('外置 App '+String(row.bindingCode||index+1).padStart(2,'0'));
        const state=row.locked?' · 已锁定':' · 未锁定';
        option.textContent=name+state;
        ui.appSelect.append(option);
      });
      if(rows.some(row=>String(row.id)===selected))ui.appSelect.value=selected;
    }
    updateCommandAvailability();
  }
  function commandLabel(command){
    const names={view:'刷新',lock:'锁定',unlock:'解锁',limit:'每日限额'};
    return names[command.action]||command.action||'命令';
  }
  function renderCommands(commands){
    ui.commandHistory.textContent='';
    const rows=Array.isArray(commands)?commands:[];
    if(!rows.length){const item=document.createElement('li');item.className='sub';item.textContent='暂无命令';ui.commandHistory.append(item);return;}
    rows.slice(0,10).forEach(command=>{
      const item=document.createElement('li');
      const title=document.createElement('strong');title.textContent=commandLabel(command);
      const pill=document.createElement('span');pill.className='pill';pill.textContent=String(command.status||'pending');
      const detail=document.createElement('div');detail.className='sub';
      const target=command.externalAppName||command.externalAppId||'设备快照';
      detail.textContent=target+' · '+formatDate(command.createdAt)+(command.acknowledgedAt?' · 回执 '+formatDate(command.acknowledgedAt):'');
      item.append(title,pill,detail);ui.commandHistory.append(item);
    });
  }
  function renderSession(session){
    currentSession=session||{};
    ui.roleName.textContent=session.roleName||'North Review Role';
    ui.deviceStatus.textContent=session.linked?(session.deviceName||'已配对'):'未配对';
    ui.lastSync.textContent=formatDate(session.lastSyncAt);
    renderApps(session);
    renderCommands(session.commands);
  }
  async function refreshSession({quiet=false}={}){
    if(!accessToken||busy&&quiet)return;
    if(!quiet)setBusy(true);
    try{
      const session=await rpc('phone_companion_review_session',{});
      renderSession(session);
      if(!quiet)status(ui.commandStatus,'状态已刷新 / Status refreshed','good');
    }catch(error){
      if(!quiet)status(ui.commandStatus,cleanError(error),'bad');
    }finally{if(!quiet)setBusy(false);}
  }
  async function login(){
    const email=ui.email.value.trim();
    const password=ui.password.value;
    if(!email||!password){status(ui.loginStatus,'请输入审核账号和密码 / Enter account and password','warn');return;}
    setBusy(true);status(ui.loginStatus,'正在登录… / Signing in…');
    try{
      const session=await api('/auth/v1/token?grant_type=password',{body:{email,password},token:''});
      if(!session||!session.access_token)throw new Error('登录未返回有效会话');
      accessToken=session.access_token;
      ui.password.value='';
      const review=await rpc('phone_companion_review_session',{});
      renderSession(review);
      ui.loginCard.hidden=true;ui.controller.hidden=false;
      status(ui.loginStatus,'');
      clearInterval(refreshTimer);refreshTimer=setInterval(()=>refreshSession({quiet:true}),2500);
    }catch(error){
      accessToken='';status(ui.loginStatus,cleanError(error),'bad');
    }finally{setBusy(false);}
  }
  function logout(){
    accessToken='';currentSession=null;clearInterval(refreshTimer);refreshTimer=0;
    ui.controller.hidden=true;ui.loginCard.hidden=false;ui.pairPanel.hidden=true;
    status(ui.commandStatus,'');status(ui.pairStatus,'');
  }
  async function beginPairing(){
    setBusy(true);status(ui.pairStatus,'正在生成… / Generating…');
    try{
      const pairing=await rpc('phone_companion_review_begin_pairing',{});
      ui.pairTarget.textContent=pairing.target||'';
      ui.pairCode.textContent=pairing.pairCode||'';
      ui.pairExpiry.textContent='有效至 / Expires: '+formatDate(pairing.expiresAt);
      ui.pairPanel.hidden=false;
      status(ui.pairStatus,'新配对码已生成 / New code generated','good');
    }catch(error){status(ui.pairStatus,cleanError(error),'bad');}
    finally{setBusy(false);}
  }
  async function sendCommand(action){
    const externalId=action==='view'?'':ui.appSelect.value;
    const minutes=Math.max(1,Math.min(1440,Number.parseInt(ui.limitMinutes.value,10)||15));
    if(action!=='view'&&!externalId){status(ui.commandStatus,'请先选择目标 App / Select an app','warn');return;}
    setBusy(true);status(ui.commandStatus,'正在排队命令… / Queueing command…');
    try{
      await rpc('phone_companion_review_enqueue_command',{p_action:action,p_external_app_id:externalId,p_minutes:action==='limit'?minutes:0});
      status(ui.commandStatus,'命令已排队；请保持 North 打开，等待设备回执 / Queued; keep North open for device receipt','warn');
      await new Promise(resolve=>setTimeout(resolve,1200));
      await refreshSession({quiet:true});
    }catch(error){status(ui.commandStatus,cleanError(error),'bad');}
    finally{setBusy(false);}
  }
  async function copyValue(id,button){
    const value=$(id).textContent.trim();
    if(!value||value==='—')return;
    try{await navigator.clipboard.writeText(value);const before=button.textContent;button.textContent='已复制';setTimeout(()=>button.textContent=before,1200);}catch(_){status(ui.pairStatus,'复制失败，请手动选择文字 / Copy failed','warn');}
  }

  ui.loginButton.addEventListener('click',login);
  ui.password.addEventListener('keydown',event=>{if(event.key==='Enter')login();});
  ui.logoutButton.addEventListener('click',logout);
  ui.refreshButton.addEventListener('click',()=>refreshSession());
  ui.pairButton.addEventListener('click',beginPairing);
  ui.viewButton.addEventListener('click',()=>sendCommand('view'));
  ui.lockButton.addEventListener('click',()=>sendCommand('lock'));
  ui.unlockButton.addEventListener('click',()=>sendCommand('unlock'));
  ui.limitButton.addEventListener('click',()=>sendCommand('limit'));
  ui.appSelect.addEventListener('change',updateCommandAvailability);
  document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',()=>copyValue(button.dataset.copy,button)));
  updateCommandAvailability();
})();
