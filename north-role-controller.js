(()=>{
  'use strict';

  const config={
    url:'https://lkhlyfpssmrjkkzhuzag.supabase.co',
    publishableKey:'sb_publishable_uKytf2Tc_FmLv15SkkJyCQ_VU8IRSt2'
  };
  const profileStorageKey='north.role-controller.profile.v1';
  const $=id=>document.getElementById(id);
  const ui={
    startCard:$('start-card'),savedController:$('saved-controller'),savedRoleName:$('saved-role-name'),continueButton:$('continue-button'),exportButton:$('export-button'),deleteButton:$('delete-button'),
    createController:$('create-controller'),newRoleName:$('new-role-name'),createButton:$('create-button'),restoreFile:$('restore-file'),profileStatus:$('profile-status'),reviewLoginOpen:$('review-login-open'),
    loginCard:$('login-card'),email:$('email'),password:$('password'),loginButton:$('login-button'),reviewLoginCancel:$('review-login-cancel'),loginStatus:$('login-status'),
    controller:$('controller'),roleName:$('role-name'),deviceStatus:$('device-status'),lastSync:$('last-sync'),refreshButton:$('refresh-button'),logoutButton:$('logout-button'),
    pairButton:$('pair-button'),pairPanel:$('pair-panel'),pairTarget:$('pair-target'),pairCode:$('pair-code'),pairExpiry:$('pair-expiry'),pairStatus:$('pair-status'),
    appSelect:$('app-select'),limitMinutes:$('limit-minutes'),viewButton:$('view-button'),lockButton:$('lock-button'),unlockButton:$('unlock-button'),limitButton:$('limit-button'),commandStatus:$('command-status'),commandHistory:$('command-history')
  };
  let mode='';
  let ordinaryProfile=null;
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
    if(/owner-secret-mismatch|invalid-target|weak-owner-secret/i.test(raw))return '控制端恢复信息无效，请重新导入恢复文件 / Invalid controller recovery data';
    if(/failed to fetch|networkerror|network request failed/i.test(raw))return '网络连接失败，请稍后重试 / Network request failed';
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
  function rpc(name,body,token=accessToken){
    return api('/rest/v1/rpc/'+encodeURIComponent(name),{body,token});
  }
  function bytesToBase64Url(bytes){
    let binary='';
    bytes.forEach(value=>{binary+=String.fromCharCode(value);});
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function randomHex(byteCount){
    const bytes=new Uint8Array(byteCount);
    crypto.getRandomValues(bytes);
    return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  }
  function newOrdinaryProfile(roleName){
    const secretBytes=new Uint8Array(32);
    crypto.getRandomValues(secretBytes);
    return {
      schema:1,
      target:'yb_'+randomHex(20),
      ownerSecret:bytesToBase64Url(secretBytes),
      roleName:String(roleName||'我的角色').trim().slice(0,80)||'我的角色',
      createdAt:new Date().toISOString(),
      commands:[]
    };
  }
  function validProfile(value){
    return !!(value&&value.schema===1&&/^yb_[a-z0-9]{20,96}$/.test(String(value.target||''))&&String(value.ownerSecret||'').length>=32&&String(value.roleName||'').trim());
  }
  function saveProfile(){
    if(!validProfile(ordinaryProfile))return;
    ordinaryProfile.commands=Array.isArray(ordinaryProfile.commands)?ordinaryProfile.commands.slice(0,40):[];
    localStorage.setItem(profileStorageKey,JSON.stringify(ordinaryProfile));
    renderSavedProfile();
  }
  function loadProfile(){
    try{
      const value=JSON.parse(localStorage.getItem(profileStorageKey)||'null');
      return validProfile(value)?value:null;
    }catch(_){return null;}
  }
  function renderSavedProfile(){
    const saved=validProfile(ordinaryProfile);
    ui.savedController.hidden=!saved;
    ui.createController.hidden=saved;
    ui.savedRoleName.textContent=saved?ordinaryProfile.roleName:'—';
  }
  function showStart(){
    mode='';accessToken='';currentSession=null;clearInterval(refreshTimer);refreshTimer=0;
    ui.startCard.hidden=false;ui.loginCard.hidden=true;ui.controller.hidden=true;ui.pairPanel.hidden=true;
    status(ui.loginStatus,'');status(ui.commandStatus,'');status(ui.pairStatus,'');
    renderSavedProfile();
  }
  function startRefreshTimer(){
    clearInterval(refreshTimer);
    refreshTimer=setInterval(()=>refreshSession({quiet:true}),2500);
  }
  function setBusy(value){
    busy=value;
    [ui.createButton,ui.continueButton,ui.exportButton,ui.deleteButton,ui.loginButton,ui.refreshButton,ui.pairButton,ui.viewButton,ui.lockButton,ui.unlockButton,ui.limitButton].forEach(button=>{button.disabled=value;});
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
        option.textContent=name+(row.locked?' · 已锁定':' · 未锁定');
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
  function mergeOrdinaryCommands(remoteCommands){
    const metadata=Array.isArray(ordinaryProfile&&ordinaryProfile.commands)?ordinaryProfile.commands:[];
    const remoteByID=new Map((Array.isArray(remoteCommands)?remoteCommands:[]).map(row=>[String(row.id||''),row]));
    return metadata.map(command=>Object.assign({},command,remoteByID.get(String(command.id||''))||{}));
  }
  function renderCommands(commands){
    ui.commandHistory.textContent='';
    const rows=mode==='ordinary'?mergeOrdinaryCommands(commands):(Array.isArray(commands)?commands:[]);
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
    ui.roleName.textContent=mode==='ordinary'?(ordinaryProfile&&ordinaryProfile.roleName||'我的角色'):(session.roleName||'North Review Role');
    ui.deviceStatus.textContent=session.linked?(session.deviceName||'已配对'):'未配对';
    ui.lastSync.textContent=formatDate(session.lastSyncAt);
    renderApps(session);
    renderCommands(session.commands);
  }
  async function sessionRequest(){
    if(mode==='ordinary'){
      if(!validProfile(ordinaryProfile))throw new Error('控制端恢复信息无效');
      return rpc('phone_companion_pull_snapshot',{p_target:ordinaryProfile.target,p_owner_secret:ordinaryProfile.ownerSecret},'');
    }
    return rpc('phone_companion_review_session',{});
  }
  async function refreshSession({quiet=false}={}){
    if(!mode||busy&&quiet)return;
    if(!quiet)setBusy(true);
    try{
      const session=await sessionRequest();
      if(!session)throw new Error('控制端凭据已失效');
      renderSession(session);
      if(!quiet)status(ui.commandStatus,'状态已刷新 / Status refreshed','good');
    }catch(error){if(!quiet)status(ui.commandStatus,cleanError(error),'bad');}
    finally{if(!quiet)setBusy(false);}
  }
  async function enterOrdinary(profile,{pair=false}={}){
    if(!validProfile(profile)){status(ui.profileStatus,'恢复文件无效 / Invalid recovery file','bad');return;}
    ordinaryProfile=profile;saveProfile();mode='ordinary';accessToken='';
    ui.startCard.hidden=true;ui.loginCard.hidden=true;ui.controller.hidden=false;
    renderSession({linked:false,snapshot:{},commands:[]});startRefreshTimer();
    if(pair)await beginPairing();else await refreshSession({quiet:true});
  }
  async function createController(){
    setBusy(true);status(ui.profileStatus,'正在创建安全控制端…');
    try{
      const profile=newOrdinaryProfile(ui.newRoleName.value);
      ordinaryProfile=profile;saveProfile();
      status(ui.profileStatus,'控制端已创建，请立即导出恢复文件 / Controller created','good');
      await enterOrdinary(profile,{pair:true});
    }catch(error){status(ui.profileStatus,cleanError(error),'bad');}
    finally{setBusy(false);}
  }
  function exportProfile(){
    if(!validProfile(ordinaryProfile))return;
    const safeName=ordinaryProfile.roleName.replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,40)||'role';
    const blob=new Blob([JSON.stringify(ordinaryProfile,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');anchor.href=url;anchor.download='North-'+safeName+'-controller-recovery.json';
    document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status(ui.profileStatus,'恢复文件已导出，请妥善保管 / Recovery file exported','good');
  }
  async function restoreProfile(file){
    if(!file)return;
    try{
      const profile=JSON.parse(await file.text());
      if(!validProfile(profile))throw new Error('invalid');
      ordinaryProfile=profile;saveProfile();
      status(ui.profileStatus,'控制端已恢复 / Controller restored','good');
    }catch(_){status(ui.profileStatus,'恢复文件无效，请选择 North 导出的 JSON 文件 / Invalid recovery file','bad');}
    finally{ui.restoreFile.value='';}
  }
  async function deleteController(){
    if(!validProfile(ordinaryProfile))return;
    if(!confirm('删除后，这个控制端与已配对设备的服务器连接及命令记录都会被移除。确定删除吗？'))return;
    setBusy(true);status(ui.profileStatus,'正在删除…');
    try{
      const removed=await rpc('phone_companion_delete_controller',{p_target:ordinaryProfile.target,p_owner_secret:ordinaryProfile.ownerSecret},'');
      if(removed!==true)throw new Error('删除失败：控制端凭据无效');
      localStorage.removeItem(profileStorageKey);ordinaryProfile=null;showStart();
      status(ui.profileStatus,'控制端和服务器连接已删除 / Controller deleted','good');
    }catch(error){status(ui.profileStatus,cleanError(error),'bad');}
    finally{setBusy(false);}
  }
  function openReviewLogin(){
    mode='';ui.startCard.hidden=true;ui.loginCard.hidden=false;ui.controller.hidden=true;ui.email.focus();
  }
  async function login(){
    const email=ui.email.value.trim();
    const password=ui.password.value;
    if(!email||!password){status(ui.loginStatus,'请输入审核账号和密码 / Enter account and password','warn');return;}
    setBusy(true);status(ui.loginStatus,'正在登录… / Signing in…');
    try{
      const session=await api('/auth/v1/token?grant_type=password',{body:{email,password},token:''});
      if(!session||!session.access_token)throw new Error('登录未返回有效会话');
      accessToken=session.access_token;mode='review';ui.password.value='';
      const review=await rpc('phone_companion_review_session',{});
      renderSession(review);
      ui.loginCard.hidden=true;ui.controller.hidden=false;status(ui.loginStatus,'');startRefreshTimer();
    }catch(error){accessToken='';mode='';status(ui.loginStatus,cleanError(error),'bad');}
    finally{setBusy(false);}
  }
  function logout(){showStart();}
  async function beginPairing(){
    setBusy(true);status(ui.pairStatus,'正在生成… / Generating…');
    try{
      const pairing=mode==='ordinary'
        ?await rpc('phone_companion_begin_pairing',{p_target:ordinaryProfile.target,p_owner_secret:ordinaryProfile.ownerSecret},'')
        :await rpc('phone_companion_review_begin_pairing',{});
      ui.pairTarget.textContent=pairing.target||'';
      ui.pairCode.textContent=pairing.pairCode||'';
      ui.pairExpiry.textContent='有效至 / Expires: '+formatDate(pairing.expiresAt);
      ui.pairPanel.hidden=false;
      status(ui.pairStatus,'新配对码已生成 / New code generated','good');
    }catch(error){status(ui.pairStatus,cleanError(error),'bad');}
    finally{setBusy(false);}
  }
  function selectedAppName(){
    const option=ui.appSelect.options[ui.appSelect.selectedIndex];
    return option?String(option.textContent||'').replace(/ · (?:已锁定|未锁定)$/,''):'';
  }
  async function sendCommand(action){
    const externalId=action==='view'?'':ui.appSelect.value;
    const externalAppName=action==='view'?'':selectedAppName();
    const minutes=Math.max(1,Math.min(1440,Number.parseInt(ui.limitMinutes.value,10)||15));
    if(action!=='view'&&!externalId){status(ui.commandStatus,'请先选择目标 App / Select an app','warn');return;}
    setBusy(true);status(ui.commandStatus,'正在排队命令… / Queueing command…');
    try{
      if(mode==='ordinary'){
        const command={schema:1,action,externalAppId:externalId,externalAppName,internalAppId:'',minutes:action==='limit'?minutes:0,scope:'external',actor:ordinaryProfile.roleName,createdAt:new Date().toISOString()};
        const id=await rpc('phone_companion_enqueue_command',{p_target:ordinaryProfile.target,p_owner_secret:ordinaryProfile.ownerSecret,p_command:command},'');
        if(!id)throw new Error('控制端凭据已失效');
        ordinaryProfile.commands.unshift(Object.assign({id:String(id),status:'pending'},command));saveProfile();
      }else{
        await rpc('phone_companion_review_enqueue_command',{p_action:action,p_external_app_id:externalId,p_minutes:action==='limit'?minutes:0});
      }
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

  ui.createButton.addEventListener('click',createController);
  ui.continueButton.addEventListener('click',()=>enterOrdinary(ordinaryProfile));
  ui.exportButton.addEventListener('click',exportProfile);
  ui.deleteButton.addEventListener('click',deleteController);
  ui.restoreFile.addEventListener('change',()=>restoreProfile(ui.restoreFile.files&&ui.restoreFile.files[0]));
  ui.reviewLoginOpen.addEventListener('click',openReviewLogin);
  ui.reviewLoginCancel.addEventListener('click',showStart);
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
  ordinaryProfile=loadProfile();renderSavedProfile();showStart();updateCommandAvailability();
})();
