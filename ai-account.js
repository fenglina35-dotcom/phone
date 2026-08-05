/* ---------- AI账户 / 内置AI ---------- */
let _aiAcct=null,_aiAcctBusy=false,_aiAutoTried=false,_aiAcctFetchedAt=0,_aiVoiceList=[],_aiVoiceQ='',_aiVoiceTestBusy=false,_aiVoiceTestStatus='',_aiAsrTestBusy=false,_aiAsrTestStatus='',_aiPayBusy=false,_aiClaimFile=null,_aiClaimBusy=false,_aiLowBalanceTimer=0,_aiAccountPollTimer=0,_aiArrivalTimer=0;
const AI_VOICE_PRESETS=[
  {id:'qingshouyin20260726',name:'青受音',clone:true,preset:true},
  {id:'xiayizhou20260725',name:'夏以昼',clone:true,preset:true},
  {id:'phonevoice20260709b',name:'月岛萤',clone:true,preset:true},
  {id:'phonevoice20260709a',name:'御叔',clone:true,preset:true}
];
const AI_DEFAULT_TTS_VOICE='male-qn-qingse';
const AI_RECHARGE_FALLBACK=[
  {id:'p_990',name:'轻量体验',amount_cny:9.9,points:250,tag:'初次尝试'},
  {id:'p_2990',name:'日常畅聊',amount_cny:29.9,points:850,tag:'推荐'},
  {id:'p_5990',name:'深度陪伴',amount_cny:59.9,points:1800,tag:'更耐用'},
  {id:'p_9990',name:'长期相伴',amount_cny:99.9,points:3200,tag:'单点更省'},
  {id:'svc_clone_1990',name:'快速音色克隆',amount_cny:19.9,points:0,kind:'service',tag:'一次性服务'}
];
const AI_PAYMENT_CHANNELS=[
  {id:'alipay',name:'支付宝',qr:'./pay-assets/alipay-receive.jpg',url:'https://qr.alipay.com/fkx10690k51wzfzjiusi25e'},
  {id:'wechat',name:'微信支付',qr:'./pay-assets/wechat-receive.jpg',url:''}
];
const AI_CLONE_CONTACT_QR='./pay-assets/wechat-contact.jpg';
function aiPageScroll(){const sc=typeof $==='function'?$('.scroll'):null;return sc?sc.scrollTop:0;}
function aiBalanceCacheKey(){return'yibei_ai_balance_'+aiUserId();}
function aiCachedBalance(){try{const raw=localStorage.getItem(aiBalanceCacheKey());if(raw==null||raw==='')return null;const n=Number(raw);return Number.isFinite(n)&&n>=0?n:null;}catch(_){return null;}}
function aiRememberBalance(value){const n=Number(value);if(!Number.isFinite(n)||n<0)return null;try{localStorage.setItem(aiBalanceCacheKey(),String(n));}catch(_){}return n;}
function aiVisibleBalance(){const raw=_aiAcct&&_aiAcct.account&&_aiAcct.account.points,n=Number(raw);if(raw!=null&&raw!==''&&Number.isFinite(n)&&n>=0)return aiRememberBalance(n);return aiCachedBalance();}
function aiRenderStable(){const top=aiPageScroll(),page=typeof $==='function'?$('#app .page'):null;if(page&&typeof cur==='function'&&cur().p==='aiaccount')page.innerHTML=renderAIAccount();else render();requestAnimationFrame(()=>{const n=typeof $==='function'?$('.scroll'):null;if(n)n.scrollTop=top;});}
function aiHiddenPurchases(){const ac=aiCoreInit();if(!Array.isArray(ac.hiddenPurchases))ac.hiddenPurchases=[];return ac.hiddenPurchases;}
function aiVisiblePurchases(){const hidden=new Set(aiHiddenPurchases().map(String));return (_aiAcct&&Array.isArray(_aiAcct.purchases)?_aiAcct.purchases:[]).filter(x=>!hidden.has(String(x&&x.id||'')));}
function aiHidePurchase(id){if(!id)return;const arr=aiHiddenPurchases(),sid=String(id);if(!arr.map(String).includes(sid))arr.unshift(sid);aiCoreInit().hiddenPurchases=arr.slice(0,80);save();aiRenderStable();toast('订单已从本机列表移除');}
function aiMergeVoicePresets(list){const out=Array.isArray(list)?list.slice():[],seen=new Set(out.map(v=>String(v&&v.id||'')));AI_VOICE_PRESETS.forEach(v=>{if(!seen.has(v.id))out.unshift(v);});return out;}
function aiPrivateVoices(){return _aiAcct&&Array.isArray(_aiAcct.private_voices)?_aiAcct.private_voices.filter(v=>v&&v.voice_id):[];}
function aiVoiceLabel(id){id=String(id||'');if(!id)return'系统默认';const own=aiPrivateVoices().find(v=>String(v.voice_id)===id);if(own)return own.display_name||'我的专属音色';const preset=AI_VOICE_PRESETS.find(v=>v.id===id);return preset?preset.name:'已设置音色';}
function aiRelayVoiceAudio(d){const rows=[d&&d.data,d&&d.data&&d.data.data,d&&d.data&&d.data.raw&&d.data.raw.data,d];for(const row of rows){if(!row)continue;const audio=row.audio||row.audio_file||row.audio_url;if(audio)return audio;}return'';}
function aiPrivateVoiceRows(){const current=String((S.settings.tts||{}).voice||''),voices=aiPrivateVoices();return voices.length?voices.map(v=>`<div class="it"><span><b style="color:#ffb7d2">${esc(v.display_name||'我的专属音色')}</b><small>仅当前AI账户可用 · 云端已绑定</small></span><span class="v"><button class="minibtn" ${current===String(v.voice_id)?'disabled':''} onclick="aiUsePrivateVoice('${esc(v.voice_id)}')">${current===String(v.voice_id)?'使用中':'使用'}</button></span></div>`).join(''):'<div class="hint" style="padding:0 14px 10px">还没有专属音色。购买克隆服务并办理完成后，管理员会直接绑定到这里，不需要拉取或填写 ID。</div>';}
function aiUsePrivateVoice(id){const voice=aiPrivateVoices().find(v=>String(v.voice_id)===String(id));if(!voice){toast('这个专属音色不属于当前AI账户，请刷新后重试');return;}S.settings.tts=S.settings.tts||{};S.settings.tts.voice=voice.voice_id;save();toast('已使用专属音色：'+(voice.display_name||'我的音色'));aiRenderStable();}

function openAIAccount(){go('aiaccount');}
function aiCoreInit(){S.settings.aiCore=S.settings.aiCore||{enabled:false,url:GATE_URL+'/functions/v1/phone-ai'};S.settings.aiCore.enabled=false;if(!S.settings.aiCore.url)S.settings.aiCore.url=GATE_URL+'/functions/v1/phone-ai';return S.settings.aiCore;}
function aiLowBalanceCfg(){const ac=aiCoreInit();if(typeof ac.lowBalanceAlertOn!=='boolean')ac.lowBalanceAlertOn=true;let n=Number(ac.lowBalanceThreshold);if(!Number.isFinite(n))n=20;ac.lowBalanceThreshold=Math.max(1,Math.min(99999,Math.round(n)));return ac;}
function aiToggleLowBalance(){const ac=aiLowBalanceCfg();ac.lowBalanceAlertOn=!ac.lowBalanceAlertOn;ac.lowBalanceAlerted=false;save();aiRenderStable();toast(ac.lowBalanceAlertOn?'点数提醒已开启':'点数提醒已关闭');}
function aiSetLowBalance(v){const ac=aiLowBalanceCfg(),n=Math.max(1,Math.min(99999,Math.round(Number(v)||20)));ac.lowBalanceThreshold=n;ac.lowBalanceAlerted=false;save();aiRenderStable();const balance=_aiAcct&&_aiAcct.account&&Number(_aiAcct.account.points);if(Number.isFinite(balance))aiCheckLowBalance(balance);toast('低于 '+n+' 点时提醒');}
function aiShowLowBalance(balance,tries){const modal=typeof $==='function'&&$('#modal');if(modal&&modal.classList.contains('show')&&tries<4){_aiLowBalanceTimer=setTimeout(()=>aiShowLowBalance(balance,tries+1),1200);return;}if(modal&&modal.classList.contains('show')){toast('AI点数快用完了，当前剩余 '+balance+' 点');return;}openModal(`<h3>AI点数快用完了</h3><div class="hint">当前剩余 <b style="color:#ffb7d2">${balance}</b> 点。可以先查看最近流水，按需少量充值，避免语音或影院字幕服务中断。</div><button class="btn p" style="margin-top:12px" onclick="closeModal();go('aiaccount')">查看AI账户</button><button class="btn g" style="margin-top:8px" onclick="closeModal()">稍后再说</button>`);}
function aiCheckLowBalance(balance){const ac=aiLowBalanceCfg(),n=Number(balance),limit=ac.lowBalanceThreshold;if(!Number.isFinite(n)||!ac.lowBalanceAlertOn)return;if(n>=limit){if(ac.lowBalanceAlerted){ac.lowBalanceAlerted=false;save();}return;}if(ac.lowBalanceAlerted)return;ac.lowBalanceAlerted=true;save();clearTimeout(_aiLowBalanceTimer);_aiLowBalanceTimer=setTimeout(()=>aiShowLowBalance(n,0),350);}
function aiPaidNoticeKey(){return'yibei_ai_paid_notified_'+aiUserId();}
function aiPaidNotifiedIds(){try{const a=JSON.parse(localStorage.getItem(aiPaidNoticeKey())||'[]');return Array.isArray(a)?a.map(String):[];}catch(_){return[];}}
function aiPlayArrivalSound(){if(S.settings&&S.settings.sound===false)return;try{const a=typeof ensureAudio==='function'?ensureAudio():null;if(!a)return;[659,880,1175].forEach((hz,i)=>{const o=a.createOscillator(),g=a.createGain(),t=a.currentTime+i*.15;o.connect(g);g.connect(a.destination);o.frequency.value=hz;o.type='sine';g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(Math.min(1,.3*(typeof volMul==='function'?volMul():1)),t+.025);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.start(t);o.stop(t+.27);});}catch(_){if(typeof playDing==='function')playDing();}}
function aiShowPointsArrival(points,balance,tries){if(!tries)aiPlayArrivalSound();const modal=typeof $==='function'&&$('#modal');if(modal&&modal.classList.contains('show')&&tries<5){clearTimeout(_aiArrivalTimer);_aiArrivalTimer=setTimeout(()=>aiShowPointsArrival(points,balance,tries+1),1000);return;}if(modal&&modal.classList.contains('show')){toast('✅ '+points+' 点已经到账，当前余额 '+balance+' 点');return;}openModal(`<h3 style="color:#71e69f;text-align:center">✅ AI点数已到账</h3><div style="margin:12px 0;border:1px solid rgba(66,220,128,.55);background:linear-gradient(135deg,#123321,#10271c);border-radius:14px;padding:20px;text-align:center"><div style="font-size:36px;font-weight:800;color:#82f0aa">+${Number(points||0).toLocaleString()} 点</div><div style="color:#b7d9c3;margin-top:8px">当前余额：${Number(balance||0).toLocaleString()} 点</div></div><div class="hint" style="text-align:center">订单已经核对完成，无需再次付款。</div><button class="btn p" style="margin-top:10px;background:#19a463" onclick="closeModal();go('aiaccount')">知道了，查看AI账户</button>`);}
function aiDetectPointsArrival(d){if(!d||!Array.isArray(d.purchases))return;const paid=d.purchases.filter(x=>x&&x.status==='paid'&&Number(x.points)>0),known=new Set(aiPaidNotifiedIds()),fresh=paid.filter(x=>!known.has(String(x.id||'')));paid.forEach(x=>known.add(String(x.id||'')));try{localStorage.setItem(aiPaidNoticeKey(),JSON.stringify([...known].slice(-80)));}catch(_){}if(!fresh.length)return;const points=fresh.reduce((n,x)=>n+Number(x.points||0),0),balance=Number(d.account&&d.account.points);clearTimeout(_aiArrivalTimer);_aiArrivalTimer=setTimeout(()=>aiShowPointsArrival(points,Number.isFinite(balance)?balance:aiVisibleBalance()||0,0),250);}
function aiHasPendingPointOrder(){return !!(_aiAcct&&Array.isArray(_aiAcct.purchases)&&_aiAcct.purchases.some(x=>x&&Number(x.points)>0&&x.status==='pending'&&String(x.review_status||'')==='submitted'));}
function aiScheduleAccountPoll(){clearTimeout(_aiAccountPollTimer);if(typeof cur!=='function'||cur().p!=='aiaccount'||!aiHasPendingPointOrder())return;_aiAccountPollTimer=setTimeout(()=>{if(cur().p==='aiaccount')aiAccountRefresh(true,true);},15000);}
function aiVoiceEnabled(){return typeof ttsEnabled==='function'?ttsEnabled(S.settings.tts||{}):!!((S.settings.tts||{}).enabled);}
function aiVoiceRelayOn(){return !!((S.settings.tts||{}).relay&&aiCoreUrl());}
function aiAsrRelayOn(){return typeof sttRelayOn==='function'?sttRelayOn():!!((S.settings.stt||{}).relay&&aiCoreUrl());}
function aiAsrReady(){return !_aiAcct||!_aiAcct.capabilities?null:_aiAcct.capabilities.asr!==false;}
function aiAsrRouteCount(){const n=Number(_aiAcct&&_aiAcct.capabilities&&_aiAcct.capabilities.asr_routes);return Number.isFinite(n)&&n>0?Math.round(n):1;}
function aiExternalTts(){const t=(typeof ttsCfg==='function'?ttsCfg():(S.settings.tts||{}));return t&&t.base&&t.key?t:null;}
function aiPrice(k){const p=(_aiAcct&&_aiAcct.pricing)||{chat:10,vision:25,image:6,tts:1,tts_chars_per_point:50,tts_max_chars:300,asr:1,asr_seconds_per_point:15,summary:2};return p[k]||0;}
function aiTtsCharsPerPoint(){const n=Number(aiPrice('tts_chars_per_point'));return Number.isFinite(n)&&n>0?Math.round(n):50;}
function aiTtsPointCost(chars){return Math.max(1,Math.ceil(Math.max(1,Number(chars)||1)/aiTtsCharsPerPoint()));}
function aiTtsEstimatedCount(points,chars){return Math.floor(Math.max(0,Number(points)||0)/aiTtsPointCost(chars||100));}
function aiLedgerTime(v){if(!v)return '';const d=new Date(v);if(isNaN(d))return String(v).replace('T',' ').slice(0,16);return d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}
function aiLedgerRows(){const rows=((_aiAcct&&_aiAcct.ledger)||[]).slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)),names={chat:'聊天',vision:'识图',image:'生图',tts:'语音',asr:'语音识别',asr_discount:'长片字幕优惠',summary:'总结',manual:'手动加点',free:'赠送'};return rows.length?rows.map(x=>{const meta=x.meta||{},failed=x.status==='failed',billed=failed&&(meta.charged||x.billed),title=(names[x.feature]||x.feature)+(failed?(billed?' · 失败已计费':' · 失败未计费'):'');const note=meta.note||x.note||(failed?(meta.reason||'模型返回失败'):'');return `<div class="bill"><div><b>${esc(title)}</b><small>${esc(aiLedgerTime(x.created_at))}${note?' · '+esc(String(note).slice(0,80)):''}</small></div><div class="${x.points>=0?'pos':'neg'}">${x.points>0?'+':''}${x.points}</div></div>`;}).join(''):'<div class="empty">还没有流水</div>';}
function aiRechargePlans(){return _aiAcct&&Array.isArray(_aiAcct.plans)&&_aiAcct.plans.length?_aiAcct.plans:AI_RECHARGE_FALLBACK;}
function aiPlanById(id){return aiRechargePlans().find(x=>String(x.id)===String(id));}
function aiPaymentChannel(id){return AI_PAYMENT_CHANNELS.find(x=>x.id===id);}
function aiPurchaseIsService(x){return Number(x&&x.points||0)===0&&Math.abs(Number(x&&x.amount_cny||0)-19.9)<.01;}
function aiPurchaseNote(x){const id=String(x&&x.id||'').replace(/-/g,'').slice(0,10).toUpperCase();return `${aiPurchaseIsService(x)?'CLONE':'AI'}-${id}`;}
function aiPurchaseRows(){const rows=aiVisiblePurchases().slice(0,20);
  return rows.length?rows.map(x=>{const service=aiPurchaseIsService(x),review=String(x.review_status||'unsubmitted');let label=x.status==='paid'?'已确认到账':x.status==='refunded'?'已退款':x.status==='cancelled'?(review==='rejected'?'未通过核对':'已取消'):(review==='submitted'?'等待人工核对':'等待上传凭证');const claim=x.status==='pending'&&review!=='submitted'?`<button class="minibtn" onclick="aiOpenPurchaseClaim('${esc(x.id)}')">上传截图</button>`:'';const open=service?`<button class="minibtn" style="border-color:rgba(7,193,96,.55);color:#83e6ad" onclick="aiOpenPurchaseOrder('${esc(x.id)}')">打开订单</button>`:'';const actions=claim||open?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:7px">${claim}${open}</div>`:'';return `<div class="bill"><div style="flex:1;min-width:0"><b>${esc(label)} · ${esc(x.provider==='wechat'?'微信':'支付宝')}</b><small>${esc(aiLedgerTime(x.created_at))} · 订单 ${esc(String(x.id||'').slice(0,8).toUpperCase())}</small>${x.review_note?`<small style="color:#e7a0a8">${esc(x.review_note)}</small>`:''}${actions}</div><div style="display:flex;align-items:center;gap:8px"><div class="${x.status==='paid'?'pos':''}" style="white-space:nowrap">${service?'音色克隆':Number(x.points||0).toLocaleString()+'点'}</div><button class="minibtn" style="width:28px;height:28px;padding:0;border-radius:50%;font-size:15px;color:#c8cbd2;background:#2a2c33" onclick="aiHidePurchase('${esc(x.id)}')" title="从本机列表删除">×</button></div></div>`;}).join(''):'<div class="hint" style="padding:0 14px 12px">还没有充值或服务订单</div>';}
function aiRechargeCards(){return aiRechargePlans().filter(p=>p.kind!=='service').map((p,i)=>`<button onclick="aiOpenRecharge('${esc(p.id)}')" style="min-width:0;text-align:left;border:1px solid ${i===1?'rgba(255,183,210,.7)':'rgba(255,255,255,.1)'};background:${i===1?'#24212a':'#1c1d22'};color:#f5f5f7;border-radius:8px;padding:13px 12px;cursor:pointer">
    <span style="display:block;font-size:12px;color:${i===1?'#ffb7d2':'#9297a1'}">${esc(p.tag||p.name||'充值套餐')}</span>
    <b style="display:block;font-size:23px;margin:5px 0 2px;letter-spacing:0">${Number(p.points||0).toLocaleString()}<small style="font-size:12px;font-weight:500;color:#a8adb6;margin-left:3px">点</small></b>
    <span style="font-size:14px;color:#e1e2e6">¥${Number(p.amount_cny||0).toFixed(1)}</span>
    <small style="display:block;color:#747985;margin-top:5px">约 ${aiTtsEstimatedCount(p.points,100)} 条100字普通语音</small>
    <small style="display:block;color:#747985;margin-top:2px">每50字1点，向上取整</small>
  </button>`).join('');}
function aiServiceCards(){return aiRechargePlans().filter(p=>p.kind==='service').map(p=>`<button onclick="aiOpenRecharge('${esc(p.id)}')" style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;border:1px solid rgba(255,255,255,.12);background:#1c1d22;color:#f5f5f7;border-radius:8px;padding:14px;cursor:pointer">
    <span><b style="display:block;font-size:16px">${esc(p.name)}</b><small style="display:block;color:#ff9aa8;margin-top:5px;font-weight:700">必须先添加办理微信，才能办理</small><small style="display:block;color:#8f949d;margin-top:3px">一次克隆、试听并接入小手机</small></span>
    <b style="font-size:20px;white-space:nowrap">¥${Number(p.amount_cny||0).toFixed(1)}</b>
  </button>`).join('');}

function renderAIAccount(){const ac=aiCoreInit();const id=aiUserId();S.settings.tts=S.settings.tts||{};S.settings.stt=S.settings.stt||{};const tts=S.settings.tts;setTimeout(()=>{if(cur().p!=='aiaccount')return;if(typeof maybePhoneNotice==='function')maybePhoneNotice();if(!_aiAcctBusy&&(!_aiAcct||Date.now()-Number(_aiAcctFetchedAt||0)>5000))aiAccountRefresh(true,true);aiScheduleAccountPoll();},80);
  const knownBalance=aiVisibleBalance(),bal=knownBalance==null?'读取中…':knownBalance;
  const low=aiLowBalanceCfg();
  const voice=aiVoiceLabel(tts.voice);
  const relayLang=tts.relayLang||'';
  return `<div class="nav"><span class="l" onclick="back()">‹</span><span class="t">AI账户</span><span class="r" style="display:flex;justify-content:flex-end;gap:10px;font-size:12px"><b onclick="showPhoneNotice(false)" style="font-weight:500;color:#aaa;cursor:pointer">使用须知</b><b onclick="aiAccountRefresh()" style="font-weight:500;cursor:pointer">刷新</b></span></div>
  <div class="scroll" style="background:#0f1117;color:#e8eaf0;padding:12px">
    <div style="background:#17191f;border-radius:8px;padding:18px 16px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 28px rgba(0,0,0,.2)">
      <div style="font-size:12px;color:#aeb4bf">小手机内置AI点数</div>
      <div style="font-size:38px;font-weight:700;margin:6px 0">${bal}</div>
      <div style="font-size:12px;color:#cbd5e1;word-break:break-all">用户ID：${esc(id)} <button class="minibtn" onclick="aiCopyId()" style="margin-left:6px">复制</button></div>
    </div>
    <div style="margin:0 0 12px;padding:12px 14px;border:1px solid rgba(255,72,92,.62);border-radius:9px;background:rgba(255,72,92,.11);color:#ff5b6f;font-size:14px;font-weight:800;line-height:1.65">充值需要人工审核，如未及时到账，请联系管理员处理。</div>
    <button onclick="showManual('ai')" style="width:100%;margin:0 0 12px;padding:11px 12px;border:1px solid rgba(165,180,252,.3);background:#171a24;color:#cdd5ff;border-radius:8px;font-size:13px;text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between"><span>AI账户使用说明与常见问题</span><b style="font-size:16px">›</b></button>
    <div class="section">
      <div class="it"><span>点数不足提醒<br><small style="color:#888">余额低于设定值时在小手机屏幕弹窗提醒</small></span><span class="sw ${low.lowBalanceAlertOn?'on':''}" onclick="aiToggleLowBalance()"></span></div>
      <div class="it"><span>提醒额度</span><span class="v"><input type="number" min="1" max="99999" inputmode="numeric" value="${low.lowBalanceThreshold}" onchange="aiSetLowBalance(this.value)" style="width:82px;text-align:right"> 点</span></div>
    </div>
    <div style="display:flex;align-items:end;justify-content:space-between;padding:5px 2px 9px">
      <div><b style="font-size:17px">充值点数</b><small style="display:block;color:#777;margin-top:3px">付款后按订单核对到账</small></div>
      <button class="minibtn" onclick="aiAccountRefresh()">刷新到账</button>
    </div>
    <div style="margin:0 0 10px;padding:10px 12px;border:1px solid rgba(255,91,111,.5);background:#271419;color:#ff9aa8;border-radius:8px;font-size:12px;font-weight:700;line-height:1.65">付款并上传凭证后请等待核对。页面会每15秒自动查询；也可以点“刷新到账”。到账后会响起专属提示音，并弹出绿色到账提醒。</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px">${aiRechargeCards()}</div>
    <div style="padding:5px 2px 9px"><b style="font-size:17px">音色服务</b><small style="display:block;color:#ff9aa8;margin-top:3px;font-weight:700">克隆音色必须先添加办理微信，未添加无法办理</small><small style="display:block;color:#777;margin-top:3px">请确认拥有声音授权，再提交干净音频</small></div>
    <div style="margin-bottom:12px">${aiServiceCards()}</div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#d8dbe2">充值与服务订单</div>
      ${aiPurchaseRows()}
    </div>
    <div class="section">
      <div class="it"><span>内置语音<br><small style="color:#888">开：角色语音条和语音电话走部署后台；关：若设置里填了外置海螺，则走外置海螺。</small></span><span class="sw ${aiVoiceRelayOn()?'on':''}" onclick="aiToggleVoiceApi()"></span></div>
      <div style="margin:0 14px 10px;padding:10px 12px;border:1px solid rgba(255,72,92,.48);border-radius:10px;background:rgba(255,72,92,.08);color:#ff5b6f;font-size:13px;font-weight:700;line-height:1.7">语音扣点明码标价<br>1～50字：1点<br>51～100字：2点<br>101～150字：3点<br>最多300字：6点<br>生成失败：不扣点</div>
      <div class="it"><span>内置语音语言<br><small style="color:#888">只影响内置AI语音；外置语音仍使用角色里的语言。</small></span><span class="v"><select onchange="aiSetVoiceLanguage(this.value)" style="background:#24262d;color:#eee;border:1px solid #3b3e48;border-radius:6px;padding:6px"><option value="" ${!relayLang?'selected':''}>暂未设置（沿用角色）</option><option value="zh" ${relayLang==='zh'?'selected':''}>中文</option><option value="粤" ${relayLang==='粤'?'selected':''}>粤语</option><option value="英" ${relayLang==='英'?'selected':''}>英语</option><option value="日" ${relayLang==='日'?'selected':''}>日语</option><option value="韩" ${relayLang==='韩'?'selected':''}>韩语</option></select></span></div>
    </div>
    <div class="section">
      <div class="it"><span>影院字幕识别<br><small style="color:${aiAsrReady()===false?'#e6a0a8':'#888'}">${aiAsrReady()===false?'后台尚未配置识别渠道，暂时不能开启。':(aiAsrRouteCount()>1?'阿里主路线 + 腾讯备用路线；只用于影院提取字幕。':'只用于影院提取字幕。')}</small></span><span class="sw ${aiAsrRelayOn()?'on':''}" onclick="aiToggleAsrApi()"></span></div>
      <div style="margin:0 14px 10px;padding:10px 12px;border:1px solid rgba(126,184,255,.45);border-radius:10px;background:rgba(83,142,220,.08);color:#b9d6ff;font-size:13px;line-height:1.7">开启：放映室“智能分段提取”走内置识别。<br>微信长按语音不会调用这个接口，也不会扣识别点数。<br>影院字幕每 ${aiPrice('asr_seconds_per_point')||15} 秒 1 点，向上取整；30 分钟 120 点、60 分钟 240 点、120 分钟 480 点。累计成功达到 30 / 60 / 120 分钟后，服务器分别返还约 5% / 8% / 10% 长片优惠；失败段全额退点。</div>
      <div class="btns" style="padding:0 14px 10px"><button class="btn p" ${_aiAsrTestBusy?'disabled':''} onclick="aiTestAsr()">${_aiAsrTestBusy?'测试中…':'影院字幕接口测试（5秒）'}</button></div>
      ${_aiAsrTestStatus?`<div class="hint" style="padding:0 14px 12px;color:${_aiAsrTestBusy?'#9dc7ff':(/^✅/.test(_aiAsrTestStatus)?'#71e69f':'#ff9aa8')}">${esc(_aiAsrTestStatus)}</div>`:''}
    </div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#a5b4fc">语音音色</div>
      <div class="hint" style="padding:0 14px 8px">系统免费音色和尚未绑定的克隆音色，所有账户都可以拉取使用；已经绑定的克隆音色只对绑定账户显示。</div>
      <div class="it"><span>可用公共音色<br><small style="color:#888">包含系统音色与未绑定克隆</small></span><span class="v"><button class="minibtn" onclick="aiPullVoices()">拉取音色</button></span></div>
      ${aiPrivateVoiceRows()}
      <div class="it"><span>当前使用<small>${esc(voice)}</small></span><span class="v">自动校验权限</span></div>
      <div class="btns" style="padding:0 14px 6px"><button class="btn g" onclick="aiClearVoice()">清空音色</button><button class="btn p" ${_aiVoiceTestBusy?'disabled':''} onclick="aiTestVoice()">${_aiVoiceTestBusy?'生成中…':'测试语音'}</button></div>
      ${_aiVoiceTestBusy||_aiVoiceTestStatus?`<div class="hint" style="padding:0 14px 10px;color:${_aiVoiceTestBusy?'#ffb7d2':'#9aa0aa'}">${_aiVoiceTestBusy?'<span class="spin" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.25);border-top-color:#ff8fab;border-radius:50%;animation:aispin .8s linear infinite;vertical-align:-2px;margin-right:6px"></span>':''}${esc(_aiVoiceTestStatus||'语音生成中，请稍等，不要重复点击')}</div>`:''}
    </div>
    <div class="section">
      <div style="padding:12px 14px;font-weight:600;color:#a5b4fc">最近流水<small style="display:block;color:#777;font-weight:400;margin-top:3px">按本地时间显示，最多保留80条</small></div>
      <div id="ai_ledger">${aiLedgerRows()}</div>
    </div>
    <div class="hint">个人收款码暂不支持自动支付回调。付款后上传付款截图；管理员核对真实账单并确认后，点数才会进入本账户。</div>
  </div>`;}

function aiOpenRecharge(planId){const p=aiPlanById(planId);if(!p)return;
  openModal(`<h3>${esc(p.name||'充值点数')}</h3>
    <div style="text-align:center;padding:6px 0 14px"><b style="font-size:30px">${p.kind==='service'?'1 个音色':Number(p.points||0).toLocaleString()+'点'}</b><div style="color:#999;margin-top:4px">应付 ¥${Number(p.amount_cny||0).toFixed(1)}</div></div>
    ${p.kind==='service'?`<div style="border:1px solid rgba(255,91,111,.65);background:#2a151b;color:#ff9aa8;border-radius:8px;padding:10px 12px;font-size:14px;line-height:1.7;font-weight:700">重要：必须先添加办理微信，才能办理音色克隆。<br><span style="font-weight:400">付款后请回到“充值与服务订单”，重新打开这笔订单，微信二维码会自动弹出。</span></div>`:`<div class="hint">选择付款方式后会创建专属订单，并尝试打开对应收款页。付款金额必须与套餐一致。</div>`}
    <div class="btns" style="margin-top:12px">
      <button class="btn" style="background:#1677ff;color:#fff" ${_aiPayBusy?'disabled':''} onclick="aiCreatePurchase('${esc(p.id)}','alipay')">支付宝</button>
      <button class="btn" style="background:#07c160;color:#fff" ${_aiPayBusy?'disabled':''} onclick="aiCreatePurchase('${esc(p.id)}','wechat')">微信支付</button>
    </div>
    <button class="btn g" style="margin-top:10px" onclick="closeModal()">暂不充值</button>`);}

async function aiCreatePurchase(planId,provider){if(_aiPayBusy)return;const p=aiPlanById(planId),channel=aiPaymentChannel(provider);if(!p||!channel)return;_aiPayBusy=true;
  try{const d=await aiRelay('purchase_create',{plan_id:planId,provider});if(!_aiAcct)_aiAcct={};if(d.purchase){_aiAcct.purchases=_aiAcct.purchases||[];_aiAcct.purchases.unshift(d.purchase);_aiAcct.purchases=_aiAcct.purchases.slice(0,12);}aiShowPayment(d.purchase,p,d.payment_note,channel);setTimeout(()=>aiLaunchPayment(provider,true),550);}
  catch(e){toast('创建订单失败：'+String((e&&e.message)||e).replace(/^内置AI失败：/,''));}
  finally{_aiPayBusy=false;}}

function aiShowPayment(purchase,plan,note,channel){if(!purchase||!plan||!channel)return;const oid=String(purchase.id||'');
  openModal(`<h3>${esc(channel.name)}收款码</h3>
    <div style="text-align:center;color:#999;font-size:13px;margin-bottom:8px">支付 ¥${Number(plan.amount_cny||0).toFixed(1)} · ${plan.kind==='service'?'快速音色克隆 1 个':'到账 '+Number(plan.points||0).toLocaleString()+'点'}</div>
    <img src="${esc(channel.qr)}" alt="${esc(channel.name)}收款码" onclick="viewImg('${esc(channel.qr)}')" style="display:block;width:min(72vw,280px);max-height:44vh;object-fit:contain;margin:0 auto;border-radius:8px;background:#fff">
    <div style="margin:12px 0 0;border:1px solid rgba(255,91,111,.55);background:#2a151b;color:#ff9aa8;border-radius:8px;padding:9px 11px;font-size:13px;line-height:1.6">付款完成后一定要回到这里上传付款截图，并填写付款昵称/尾号和付款时间。没有截图不会进入后台核对，也不会自动加点。</div>
    <div style="margin:12px 0;background:#202126;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 12px;color:#ddd;font-size:13px;line-height:1.7">
      订单号：<b>${esc(oid.slice(0,8).toUpperCase())}</b><br>付款备注：<b>${esc(note||'')}</b><br>
      <small style="color:${plan.kind==='service'?'#ff9aa8':'#888'}">${plan.kind==='service'?'付款并上传截图后，请关闭这里，再从“充值与服务订单”重新打开本订单；届时会自动显示办理微信二维码。必须添加微信后才能办理。':'付款后上传付款截图，等待管理员核对真实账单。'}</small>
    </div>
    <div class="btns"><button class="btn g" onclick="aiCopyPayment('${esc(note||oid)}')">复制备注</button><button class="btn p" onclick="aiLaunchPayment('${esc(channel.id)}')">打开${esc(channel.name)}</button></div>
    <button class="btn g" style="margin-top:10px" onclick="aiOpenPurchaseClaim('${esc(oid)}')">上传付款截图，提交核对</button>`);}

function aiClaimPurchase(id){return _aiAcct&&Array.isArray(_aiAcct.purchases)?_aiAcct.purchases.find(x=>String(x.id)===String(id)):null;}
function aiOpenPurchaseOrder(id){const p=aiClaimPurchase(id);if(!p){toast('订单信息已过期，请先刷新 AI 账户');return;}if(aiPurchaseIsService(p)){aiShowCloneContact(aiPurchaseNote(p));return;}if(p.status==='pending'&&String(p.review_status||'unsubmitted')!=='submitted')aiOpenPurchaseClaim(id);else toast('这笔订单正在核对或已处理');}
function aiClaimLocalTime(){const d=new Date(),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function aiOpenPurchaseClaim(purchaseId){const p=aiClaimPurchase(purchaseId);if(!p){toast('订单信息已过期，请先刷新 AI 账户');return;}_aiClaimFile=null;openModal(`<h3>提交付款核对</h3>
  <div class="hint" style="margin-bottom:10px">订单 ${esc(String(p.id||'').slice(0,8).toUpperCase())} · ${p.provider==='wechat'?'微信':'支付宝'} ¥${Number(p.amount_cny||0).toFixed(2)}<br>请上传本订单的真实付款截图。截图只用于申请核对，不代表已经到账；管理员仍会核对收款账单。</div>
  <label class="field" style="display:block"><span>付款截图</span><input id="ai_claim_file" type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif" onchange="aiClaimPick(this)"></label>
  <div id="ai_claim_preview" style="display:none;margin:8px 0;text-align:center"></div>
  <label class="field" style="display:block"><span>付款账号昵称或尾号（必填）</span><input id="ai_claim_hint" maxlength="80" placeholder="必须填写，方便在账单里核对"></label>
  <label class="field" style="display:block"><span>付款时间</span><input id="ai_claim_time" type="datetime-local" value="${esc(aiClaimLocalTime())}"></label>
  <button class="btn p" id="ai_claim_submit" style="margin-top:10px" onclick="aiSubmitPurchaseClaim('${esc(p.id)}')">提交给管理员核对</button>
  <button class="btn g" style="margin-top:8px" onclick="closeModal()">取消</button>`);}
function aiClaimPick(input){const file=input&&input.files&&input.files[0];if(!file)return;const name=String(file.name||''),ok=/^image\//i.test(file.type||'')||/\.(?:jpe?g|png|webp|heic|heif)$/i.test(name);if(!ok){input.value='';toast('请选择手机相册里的图片文件');return;}if(file.size>12*1024*1024){input.value='';toast('原图不能超过 12MB');return;}_aiClaimFile=file;const box=document.getElementById('ai_claim_preview'),url=URL.createObjectURL(file);if(box){box.style.display='block';box.innerHTML=`<img src="${url}" alt="付款截图预览" style="max-width:100%;max-height:34vh;object-fit:contain;border-radius:8px" onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div style=&quot;color:#999;padding:12px&quot;>已选择图片，提交时会转换兼容格式</div>')">`;setTimeout(()=>URL.revokeObjectURL(url),30000);}}
function aiClaimCanvasData(source,width,height){let w=+width||0,h=+height||0;if(!w||!h)throw new Error('截图尺寸无法读取');const scale=Math.min(1,1600/Math.max(w,h));w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器无法处理这张截图');ctx.drawImage(source,0,0,w,h);let data=canvas.toDataURL('image/jpeg',.82);if(data.length>2.65*1024*1024)data=canvas.toDataURL('image/jpeg',.68);if(data.length>2.8*1024*1024)throw new Error('截图压缩后仍过大，请裁剪后重试');return data;}
async function aiClaimImageData(file){if(typeof createImageBitmap==='function'){try{const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});try{return aiClaimCanvasData(bitmap,bitmap.width,bitmap.height);}finally{try{bitmap.close();}catch(_){}}}catch(_){}}return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('读取截图失败'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error(/\.hei[cf]$/i.test(file&&file.name||'')?'当前浏览器不能读取 HEIC/HEIF，请在相册中转存为 JPG 后重试':'截图格式无法读取，请换 JPG 或 PNG 重试'));img.onload=()=>{try{resolve(aiClaimCanvasData(img,img.naturalWidth||img.width,img.naturalHeight||img.height));}catch(e){reject(e);}};img.src=String(reader.result||'');};reader.readAsDataURL(file);});}
async function aiSubmitPurchaseClaim(purchaseId){if(_aiClaimBusy)return;const btn=document.getElementById('ai_claim_submit'),hint=document.getElementById('ai_claim_hint'),time=document.getElementById('ai_claim_time'),payer=(hint&&hint.value||'').trim(),paidAt=(time&&time.value||'').trim(),service=aiPurchaseIsService(aiClaimPurchase(purchaseId));if(!_aiClaimFile){toast('请先选择付款截图');return;}if(payer.length<2){toast('请填写付款昵称或付款尾号');if(hint)hint.focus();return;}if(!paidAt){toast('请填写付款时间');if(time)time.focus();return;}_aiClaimBusy=true;if(btn){btn.disabled=true;btn.textContent='正在安全上传…';}
  try{const proof=await aiClaimImageData(_aiClaimFile);const d=await aiRelay('purchase_submit',{purchase_id:purchaseId,proof_image:proof,payer_hint:payer,claimed_paid_at:paidAt});if(!_aiAcct)_aiAcct={};_aiAcct.purchases=_aiAcct.purchases||[];const i=_aiAcct.purchases.findIndex(x=>String(x.id)===String(purchaseId));if(i>=0)_aiAcct.purchases[i]=Object.assign({},_aiAcct.purchases[i],d.purchase||{},{review_status:'submitted'});closeModal();render();toast(service?'已提交，请重新打开音色订单添加微信':'已提交，页面会自动查询；也可点“刷新到账”');}
  catch(e){toast('提交失败：'+String((e&&e.message)||e).replace(/^内置AI失败：/,''));}
  finally{_aiClaimBusy=false;if(btn){btn.disabled=false;btn.textContent='提交给管理员核对';}}}

function aiShowCloneContact(note){openModal(`<h3>添加微信办理音色克隆</h3>
  <div style="border:1px solid rgba(255,91,111,.65);background:#2a151b;color:#ff9aa8;border-radius:8px;padding:9px 11px;font-size:14px;line-height:1.65;font-weight:700;margin-bottom:10px">必须先添加下面的办理微信，才能办理音色克隆。</div>
  <div class="hint" style="margin-bottom:10px">添加后请发送：<b>${esc(note||'克隆订单号')}</b>、付款截图、已获授权的干净音频和角色名称。请勿提交未经本人许可的真人声音。</div>
  <img src="${esc(AI_CLONE_CONTACT_QR)}" alt="音色克隆联系方式" onclick="viewImg('${esc(AI_CLONE_CONTACT_QR)}')" style="display:block;width:min(76vw,300px);max-height:58vh;object-fit:contain;margin:0 auto;border-radius:8px;background:#fff">
  <div class="btns" style="margin-top:12px"><button class="btn g" onclick="aiCopyPayment('${esc(note||'')}')">复制订单号</button><button class="btn p" onclick="viewImg('${esc(AI_CLONE_CONTACT_QR)}')">查看大图</button></div>
  <button class="btn g" style="margin-top:10px" onclick="closeModal()">关闭</button>`);}

function aiCopyPayment(text){try{navigator.clipboard&&navigator.clipboard.writeText(text);}catch(_){}toast('已复制付款备注');}
function aiLaunchPayment(provider,automatic){const c=aiPaymentChannel(provider);if(!c)return;if(!c.url){if(!automatic)toast('请长按保存收款码，付款后上传截图核对');return;}if(!automatic)toast('正在打开'+c.name+'…');try{window.open(c.url,'_blank','noopener');}catch(_){try{location.href=c.url;}catch(__){if(!automatic)toast('没有自动打开，请长按保存收款码后扫码');}}}

function aiToggleCore(){const ac=aiCoreInit();ac.enabled=false;save();aiRenderStable();toast('内置 AI 主通道已固定关闭');}
function aiToggleVoiceApi(){S.settings.tts=S.settings.tts||{};S.settings.tts.relay=!aiVoiceRelayOn();if(S.settings.tts.relay)S.settings.tts.enabled=true;save();aiRenderStable();toast(S.settings.tts.relay?'内置语音已开启':'内置语音已关闭');}
function aiToggleAsrApi(){if(aiAsrReady()===false){toast('影院字幕识别后台还没有配置好，暂时不能开启');return;}S.settings.stt=S.settings.stt||{};S.settings.stt.relay=!aiAsrRelayOn();save();aiRenderStable();toast(S.settings.stt.relay?'影院字幕识别已开启':'影院字幕识别已关闭，将使用外置配置');}
function aiAsrTestFinish(status){_aiAsrTestBusy=false;_aiAsrTestStatus=status;aiRenderStable();setTimeout(()=>aiAccountRefresh(true,true),500);}
function aiAsrTestError(error){const raw=String(error||'').replace(/^内置AI失败：/,'').replace(/^asr-failed-refunded:\s*/,'');if(/unsupported-format-webm|format.*webm/i.test(raw))return '❌ 手机录音格式不兼容；请刷新到最新版后重试。本次点数已退回。';if(/empty/i.test(raw))return '❌ 接口没有听清文字，请靠近话筒清楚说一句再试。本次点数已退回。';if(/401|403|unauthor|forbidden|invalid.*key/i.test(raw))return '❌ 后台密钥或语音识别权限不正确，本次点数已退回。';if(/timeout|timed out|aborted/i.test(raw))return '❌ 识别接口超时，本次点数已退回，请稍后重试。';if(/network|fetch|load failed/i.test(raw))return '❌ 网络连接失败，录音没有识别成功。';return '❌ '+(raw||'语音识别失败；失败不会扣点').slice(0,220);}
async function aiTestAsr(){
  if(_aiAsrTestBusy)return;
  if(!aiAsrRelayOn()){toast('请先打开「影院字幕识别」开关');return;}
  if(aiAsrReady()===false){toast('后台尚未配置影院字幕识别渠道');return;}
  if(_rec){toast('已有录音正在进行，请先结束');return;}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||typeof MediaRecorder==='undefined'){_aiAsrTestStatus='❌ 当前浏览器不能录音，请用 Safari 或 Chrome 并允许麦克风权限';aiRenderStable();return;}
  _aiAsrTestBusy=true;_aiAsrTestStatus='正在打开麦克风…';aiRenderStable();let started=false;
  await startRec(()=>{
    started=true;_aiAsrTestStatus='正在录音，请清楚说一句话（5秒）…';aiRenderStable();
    setTimeout(()=>{
      if(!_rec){aiAsrTestFinish('❌ 录音意外停止，请重新测试');return;}
      stopRec(false,async m=>{
        if(!m||!m.blob){aiAsrTestFinish('❌ 没有录到声音，请检查麦克风权限');return;}
        try{
          const upload=await sttRecordedWav(m.blob,m.dur),j=await sttRequest(upload,{durationSeconds:m.dur,purpose:'diagnostic'}),text=String(j&&j.text||'').replace(/\s+/g,' ').trim();
          if(!text)throw new Error('接口已响应，但没有听清文字');
          aiAsrTestFinish('✅ 影院字幕接口可用，识别到：“'+text.slice(0,80)+'”'+(text.length>80?'…':'')+'（本次约扣1点）');
        }catch(e){aiAsrTestFinish(aiAsrTestError((e&&e.message)||e));}
      });
    },5000);
  },{hint:'影院字幕接口测试录音中'});
  if(!started)aiAsrTestFinish('❌ 麦克风没有启动，请检查浏览器录音权限');
}
function aiSetVoiceLanguage(lang){S.settings.tts=S.settings.tts||{};S.settings.tts.relayLang=['zh','粤','英','日','韩'].includes(lang)?lang:'';save();aiRenderStable();toast(lang?'内置语音已设为'+({zh:'中文','粤':'粤语','英':'英语','日':'日语','韩':'韩语'}[lang]||lang):'内置语音暂时沿用角色语言');}
function aiCopyId(){try{navigator.clipboard&&navigator.clipboard.writeText(aiUserId());}catch(_){}toast('已复制用户ID');}

async function aiPullVoices(){toast('正在拉取可用音色…');
  try{const d=await aiRelay('tts_voices',{});_aiVoiceList=Array.isArray(d&&d.voices)?d.voices:[];_aiVoiceQ='';
    if(!_aiVoiceList.length){toast('暂时没有可用音色，请稍后重试');return;}
    aiShowVoicePicker();
  }catch(e){toast('拉取失败：'+String((e&&e.message)||e).replace(/^内置AI失败：/,''));}}
function aiShowVoicePicker(){const q=(_aiVoiceQ||'').toLowerCase(),curVoice=((S.settings.tts||{}).voice)||'';
  const list=_aiVoiceList.filter(v=>!q||String(v.id||'').toLowerCase().includes(q)||String(v.name||'').toLowerCase().includes(q));
  openModal(`<h3>选择默认语音</h3>
    <div class="hint">当前默认：${esc(curVoice||'未选择')}</div>
    <div class="field"><input id="ai_vq" placeholder="搜名字或ID" value="${esc(_aiVoiceQ)}" oninput="_aiVoiceQ=this.value;aiShowVoicePicker();setTimeout(()=>{var e=document.getElementById('ai_vq');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length);}},0)"></div>
    <div style="max-height:52vh;overflow:auto">${list.slice(0,160).map(v=>`<div class="it" onclick="aiPickVoice('${esc(v.id)}')" style="cursor:pointer"><span>${v.private?'<b style="color:#ffb7d2">专属 · </b>':v.unbound?'<b style="color:#ffb83b">未绑定克隆 · </b>':'<b style="color:#71e69f">免费 · </b>'}${esc(v.name||v.id)}<small>${esc(v.id)}</small></span><span class="v">${v.id===curVoice?'已选':'选'}</span></div>`).join('')||'<div class="empty" style="padding:18px">没有匹配的音色</div>'}${list.length>160?'<div class="hint" style="padding:8px">只显示前160个，用搜索更快</div>':''}</div>
    <button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>`);}
function aiPickVoice(id){S.settings.tts=S.settings.tts||{};S.settings.tts.voice=id;save();closeModal();toast('已设为默认音色');if(cur().p==='aiaccount')render();}
function aiClearVoice(){S.settings.tts=S.settings.tts||{};S.settings.tts.voice='';save();toast('已清空默认音色');render();}
function aiVoiceTestText(){const lang=aiVoiceRelayOn()?((S.settings.tts||{}).relayLang||'zh'):'zh';return {zh:'我在测试这条语音的花销和声音效果。','粤':'我而家試緊呢把聲嘅效果同埋收費。','英':'Hi, I am testing the cost and sound of this voice.','日':'こんにちは、この音声の費用と聞こえ方をテストしています。','韩':'안녕하세요, 이 음성의 비용과 소리를 테스트하고 있어요.'}[lang]||'我在测试这条语音的花销和声音效果。';}
async function aiTestVoice(){const text=aiVoiceTestText();
  if(_aiVoiceTestBusy){toast('语音还在生成中，请稍等');return;}
  if(!aiVoiceEnabled()){toast('先打开语音API');return;}
  _aiVoiceTestBusy=true;_aiVoiceTestStatus='语音生成中，请稍等，不要重复点击';if(cur().p==='aiaccount')aiRenderStable();
  try{initAudio();
    if(!aiVoiceRelayOn()&&typeof ttsArr==='function'){
      const ab=await Promise.race([ttsArr(text,{voice:{engine:'api',ttsVoice:((S.settings.tts||{}).voice)||''}}),new Promise(res=>setTimeout(()=>res('__T_O__'),25000))]);
      if(ab==='__T_O__'){_aiVoiceTestStatus='语音测试超时，未完成生成';toast('语音测试超时');return;}
      if(!ab){_aiVoiceTestStatus='没有拿到语音，请检查音色或接口';toast('没有拿到语音');return;}
      const buf=await decodeBuf(ab);if(buf){playBuf(buf);_aiVoiceTestStatus='外置语音测试成功';toast('外置语音测试成功');}else{_aiVoiceTestStatus='拿到语音数据，但播放失败';toast('拿到语音数据，但播放失败');}return;
    }
    const d=await Promise.race([aiRelay('tts',{text,voice_id:((S.settings.tts||{}).voice)||AI_DEFAULT_TTS_VOICE,model:'speech-02-turbo',language_boost:typeof ttsLanguageBoost==='function'?ttsLanguageBoost(null):'auto'}),new Promise(res=>setTimeout(()=>res('__T_O__'),25000))]);
    if(d==='__T_O__'){_aiVoiceTestStatus='语音测试超时，未完成生成';toast('语音测试超时');return;}
    const ledger=d&&(d.ledger_id||d.ledgerId||d.request_id),audio=aiRelayVoiceAudio(d);if(!audio){if(typeof ttsRefundLedger==='function')await ttsRefundLedger(ledger,'tts-test-no-audio');_aiVoiceTestStatus='音色绑定仍在，但后台没有返回音频，已退回本次AI点数';toast('后台没有返回音频，绑定没有丢失');setTimeout(()=>aiAccountRefresh(true,true),600);return;}
    let raw;try{raw=typeof audioDataToBuf==='function'?await audioDataToBuf(audio):await fetch(audio).then(x=>{if(!x.ok)throw new Error('HTTP '+x.status);return x.arrayBuffer();});if(!raw)throw new Error('empty-audio');}catch(_){if(typeof ttsRefundLedger==='function')await ttsRefundLedger(ledger,'tts-test-fetch-failed');_aiVoiceTestStatus='语音文件读取失败，已退回本次AI点数；音色绑定没有丢失';toast('语音读取失败，已退回本次AI点数');setTimeout(()=>aiAccountRefresh(true,true),800);return;}
    const ab=typeof ttsLedgerSet==='function'?ttsLedgerSet(raw,ledger):raw;const buf=await decodeBuf(ab);
    if(buf){playBuf(buf);_aiVoiceTestStatus='语音测试成功';toast('语音测试成功');setTimeout(()=>aiAccountRefresh(true,true),800);}
    else{if(typeof ttsRefundAudio==='function')await ttsRefundAudio(ab,'tts-test-decode-failed');_aiVoiceTestStatus='拿到语音数据，但播放失败，已退回本次AI点数';toast('播放失败，已退回本次AI点数');setTimeout(()=>aiAccountRefresh(true,true),800);}
  }catch(e){let refunded=false;if(typeof ttsRefundError==='function')refunded=await ttsRefundError(e,'tts-test-client-error');_aiVoiceTestStatus='语音测试失败：'+String((e&&e.message)||e).replace(/^内置AI失败：/,'')+(refunded?'，已退回本次AI点数':'');toast(_aiVoiceTestStatus);setTimeout(()=>aiAccountRefresh(true,true),800);}
  finally{_aiVoiceTestBusy=false;if(cur().p==='aiaccount')aiRenderStable();}}

function aiAccountApplyResult(d,action){if(!d)return;if(!_aiAcct)_aiAcct={account:{user_id:aiUserId()},pricing:null,plans:null,ledger:[]};
  if(action==='account')_aiAcctFetchedAt=Date.now();
  if(d.pricing)_aiAcct.pricing=d.pricing;if(d.plans)_aiAcct.plans=d.plans;if(d.capabilities)_aiAcct.capabilities=d.capabilities;if(d.ledger)_aiAcct.ledger=d.ledger;if(d.purchases)_aiAcct.purchases=d.purchases;if(Array.isArray(d.private_voices)){_aiAcct.private_voices=d.private_voices;const first=d.private_voices.find(v=>v&&v.voice_id),core=aiCoreInit();if(first&&!(S.settings.tts||{}).voice&&core.privateVoiceAutoSet!==first.voice_id){S.settings.tts=S.settings.tts||{};S.settings.tts.voice=first.voice_id;core.privateVoiceAutoSet=first.voice_id;save();}}if(d.account){_aiAcct.account=d.account;if(d.account.points!=null)aiRememberBalance(d.account.points);}
  if(d.balance!=null){_aiAcct.account=_aiAcct.account||{user_id:aiUserId()};_aiAcct.account.points=d.balance;aiRememberBalance(d.balance);}
  if(d.charged){const feature=action||'chat';_aiAcct.ledger=_aiAcct.ledger||[];_aiAcct.ledger.unshift({kind:'charge',feature,points:-d.charged,balance_after:d.balance,status:d.ok===false?'failed':'done',billed:!!d.billed,note:d.note||d.error||'',created_at:new Date().toISOString()});_aiAcct.ledger=_aiAcct.ledger.slice(0,80);}
  if(_aiAcct.account&&_aiAcct.account.points!=null)aiCheckLowBalance(Number(_aiAcct.account.points));if(d.purchases)aiDetectPointsArrival(d);
  if(cur().p==='aiaccount')setTimeout(()=>{if(cur().p==='aiaccount')aiRenderStable();},30);}
async function aiAccountRefresh(silent,preserveScroll){if(_aiAcctBusy)return;_aiAcctBusy=true;if(silent)_aiAutoTried=true;let ok=false;try{const d=await aiRelay('account',{});ok=!!d;if(d&&d.account&&d.account.points!=null){aiRememberBalance(d.account.points);aiCheckLowBalance(Number(d.account.points));}if(!silent)toast('AI账户已刷新');}catch(e){if(!silent)toast('连接失败：'+e.message);}finally{_aiAcctBusy=false;if(ok&&cur().p==='aiaccount'){const sc=$('.scroll'),top=sc?sc.scrollTop:0;render();if(preserveScroll)setTimeout(()=>{const n=$('.scroll');if(n)n.scrollTop=top;},0);}}}
