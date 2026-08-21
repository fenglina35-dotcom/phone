/* Real delivery ordering layer.
   The default remains the existing virtual delivery experience. When real mode
   is enabled this file never falls back to generated shops, prices or statuses. */
(function(){
  'use strict';

  var oldFoodSearch=window.foodSearch;
  var oldFoodBuy=window.foodBuy;
  var oldOpenFoodCart=window.openFoodCart;
  var oldOpenFoodOrders=window.openFoodOrders;
  var pollBusy=false;
  var manualOptionOffer=null;
  var TERMINAL={delivered:1,canceled:1,refunded:1,failed:1};
  var STATUS_RANK={quote:0,created:1,pending_payment:1,paid:2,merchant_confirmed:3,preparing:4,courier_assigned:5,picked_up:6,delivering:7,delivered:8};
  var STATUS_TEXT={quote:'待下单',created:'订单已创建',pending_payment:'待付款',paid:'已付款',merchant_confirmed:'商家已接单',preparing:'商家备餐中',courier_assigned:'骑手已接单',picked_up:'骑手已取餐',delivering:'配送中',delivered:'已送达',canceled:'已取消',refunded:'已退款',failed:'订单失败'};

  function dayKey(ts){var d=new Date(ts||Date.now());return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function num(v){v=Number(v);return Number.isFinite(v)?Math.max(0,Math.round(v*100)/100):0;}
  function text(v,n){return String(v==null?'':v).trim().slice(0,n||300);}
  function safeUrl(v,schemes,n){
    v=text(v,n||1000);if(!v)return'';
    try{var u=new URL(v),scheme=u.protocol.toLowerCase();return schemes.indexOf(scheme)>=0?v:'';}catch(_){return'';}
  }
  function safePayUrl(v){return safeUrl(v,['https:','weixin:','alipays:','alipay:'],1000);}
  function safePayQr(v){v=text(v,320000);return /^data:image\/png;base64,[a-z0-9+/=]+$/i.test(v)?v:'';}
  function safeOptionGroups(v){
    return (Array.isArray(v)?v:[]).slice(0,12).map(function(g){g=g&&typeof g==='object'?g:{};var choices=(Array.isArray(g.choices)?g.choices:[]).slice(0,30).map(function(c){c=c&&typeof c==='object'?c:{label:c};return{id:text(c.id||c.value||c.label,120),label:text(c.label||c.name||c.value,80),priceDelta:num(c.priceDelta||c.extraPrice||0),available:c.available!==false};}).filter(function(c){return c.id&&c.label&&c.available;});return{id:text(g.id||g.name,120),name:text(g.name||g.label,80),required:g.required!==false,multiple:g.multiple===true,choices:choices};}).filter(function(g){return g.id&&g.name&&g.choices.length;});
  }
  function builtInConnectorUrl(){
    try{return typeof COMPANION_URL==='string'&&/^https:\/\//i.test(COMPANION_URL)?COMPANION_URL.replace(/\/+$/,'')+'/functions/v1/phone-delivery':'';}catch(_){return'';}
  }
  function deliveryConnectorSecret(){
    var key='north_delivery_connector_secret_v1',secret='';try{secret=localStorage.getItem(key)||'';}catch(_){}
    if(secret.length<24){try{var bytes=new Uint8Array(32);crypto.getRandomValues(bytes);secret='dls_'+Array.from(bytes).map(function(x){return x.toString(16).padStart(2,'0');}).join('');}catch(_){secret='dls_'+uid()+uid();}try{localStorage.setItem(key,secret);}catch(_){}}
    return secret;
  }
  function foodState(){
    S.food=S.food&&typeof S.food==='object'?S.food:{};
    S.food.cart=Array.isArray(S.food.cart)?S.food.cart:[];
    S.food.results=Array.isArray(S.food.results)?S.food.results:[];
    S.food.orders=Array.isArray(S.food.orders)?S.food.orders:[];
    var r=S.food.real&&typeof S.food.real==='object'?S.food.real:{};
    if(typeof r.enabled!=='boolean')r.enabled=false;
    if(typeof r.autoPay!=='boolean')r.autoPay=false;
    r.connectorUrl=text(r.connectorUrl,500)||builtInConnectorUrl();
    r.addressLabel=text(r.addressLabel,80);
    r.approvedAddressFingerprint=text(r.approvedAddressFingerprint,180);
    r.lastCapability=r.lastCapability&&typeof r.lastCapability==='object'?r.lastCapability:null;
    r.pendingCreates=Array.isArray(r.pendingCreates)?r.pendingCreates.filter(function(x){return x&&Date.now()-(+x.at||0)<10*60000;}).slice(0,12):[];
    S.food.real=r;
    return r;
  }
  function roleWallet(c){
    if(!c)return null;
    var w=c.deliveryWallet&&typeof c.deliveryWallet==='object'?c.deliveryWallet:{};
    w.balance=num(w.balance);
    w.singleLimit=w.singleLimit==null?100:num(w.singleLimit);
    w.dailyLimit=w.dailyLimit==null?200:num(w.dailyLimit);
    w.spentDay=text(w.spentDay,10);
    w.spentToday=num(w.spentToday);
    if(w.spentDay!==dayKey()){w.spentDay=dayKey();w.spentToday=0;}
    w.ledger=Array.isArray(w.ledger)?w.ledger.slice(0,80):[];
    c.deliveryWallet=w;
    return w;
  }
  function enabled(){return foodState().enabled===true;}
  function connectorUrl(){
    var u=foodState().connectorUrl;
    if(!u)return'';
    try{var p=new URL(u);return p.protocol==='https:'?p.href.replace(/\/$/,''):'';}catch(_){return'';}
  }
  function statusText(s){return STATUS_TEXT[s]||text(s,30)||'状态待同步';}
  function providerText(v){return v==='taobao_flash'?'淘宝闪购':v==='meituan'?'美团外卖':text(v,30)||'外卖平台';}
  function paymentText(v){return v==='wechat'?'微信支付':v==='alipay'?'支付宝':text(v,30)||'待选择';}
  function safeOffer(x){
    x=x&&typeof x==='object'?x:{};
    return {offerId:text(x.offerId||x.id,160),provider:text(x.provider,40),merchantId:text(x.merchantId,120),merchant:text(x.merchant||x.shop,100),name:text(x.name,140),description:text(x.description||x.desc,240),price:num(x.price),deliveryFee:num(x.deliveryFee),total:num(x.total==null?num(x.price)+num(x.deliveryFee):x.total),rating:Number.isFinite(+x.rating)?Math.max(0,Math.min(5,+x.rating)):null,reviewCount:Number.isFinite(+x.reviewCount)?Math.max(0,Math.floor(+x.reviewCount)):null,monthlySales:Number.isFinite(+x.monthlySales)?Math.max(0,Math.floor(+x.monthlySales)):null,etaMinutes:Number.isFinite(+x.etaMinutes)?Math.max(0,Math.floor(+x.etaMinutes)):null,distanceKm:Number.isFinite(+x.distanceKm)?Math.max(0,+x.distanceKm):null,couponLabel:text(x.couponLabel,100),imageUrl:safeUrl(x.imageUrl,['https:'],800),emoji:text(x.emoji,4)||'🍱',quoteId:text(x.quoteId,160),quoteExpiresAt:+x.quoteExpiresAt||0,addressLabel:text(x.addressLabel,80),addressFingerprint:text(x.addressFingerprint,180),rawVersion:text(x.rawVersion,80),optionGroups:safeOptionGroups(x.optionGroups||x.options)};
  }
  function normalizeSelectedOptions(offer,input){
    var source=input&&typeof input==='object'?input:{},out={};
    (offer.optionGroups||[]).forEach(function(g){var raw=source[g.id],ids=g.multiple?(Array.isArray(raw)?raw:[raw]).map(String):[String(Array.isArray(raw)?raw[0]:raw==null?'':raw)],allowed={};g.choices.forEach(function(c){allowed[c.id]=1;});ids=ids.filter(function(id,i,a){return allowed[id]&&a.indexOf(id)===i;});if(g.required&&!ids.length)throw new Error('请选择'+g.name);if(ids.length)out[g.id]=g.multiple?ids:ids[0];});
    return out;
  }
  function optionSummary(offer,selected){var labels=[];(offer.optionGroups||[]).forEach(function(g){var ids=selected&&selected[g.id],list=Array.isArray(ids)?ids:[ids];list.forEach(function(id){var c=g.choices.find(function(x){return x.id===id;});if(c)labels.push(g.name+'：'+c.label);});});return labels.join('、');}
  async function request(action,payload,timeout){
    var url=connectorUrl();
    if(!url)throw new Error('还没有连接真实外卖服务');
    var ctl=typeof AbortController==='function'?new AbortController():null,timer=ctl?setTimeout(function(){ctl.abort();},timeout||25000):0;
    try{
      var official=url===builtInConnectorUrl(),headers={'content-type':'application/json','x-north-delivery-contract':'1'};try{if(typeof COMPANION_KEY==='string'&&official){headers.apikey=COMPANION_KEY;headers.Authorization='Bearer '+COMPANION_KEY;}}catch(_){}
      var client={appVersion:String(APP_VER||''),privateApp:typeof privateNativeAppOn==='function'&&privateNativeAppOn(),target:typeof cloudId==='function'?cloudId():'',ownerSecret:official&&typeof companionOwnerSecret==='function'?companionOwnerSecret():deliveryConnectorSecret()};
      var res=await fetch(url,{method:'POST',credentials:'include',headers:headers,body:JSON.stringify({action:action,payload:payload||{},client:client}),signal:ctl&&ctl.signal});
      var body=null;try{body=await res.json();}catch(_){}
      if(!res.ok||!body||body.ok===false)throw new Error(text(body&&body.error||('真实外卖服务 HTTP '+res.status),180));
      return body.data==null?body:body.data;
    }catch(e){if(e&&e.name==='AbortError')throw new Error('真实外卖服务响应超时');throw e;}finally{if(timer)clearTimeout(timer);}
  }
  function setEnabled(on){
    var r=foodState();r.enabled=!!on;if(!r.enabled)r.autoPay=false;
    S.food.results=[];S.food.cart=[];save();render();toast(r.enabled?'已切换为真实外卖；不会使用虚拟结果':'已关闭真实外卖，恢复虚拟外卖');setTimeout(openSettings,0);
    if(r.enabled)refreshCapabilities(false);
  }
  function setAutoPay(on){
    var r=foodState();if(on&&!r.enabled){toast('请先开启真实外卖');render();return;}if(on&&r.lastCapability&&r.lastCapability.ok&&r.lastCapability.automaticPayments===false){toast('当前真实外卖服务不支持授权自动付款');setTimeout(openSettings,0);return;}r.autoPay=!!on;save();render();toast(r.autoPay?'已允许角色在额度内自动付款':'角色只能创建真实订单，付款由你确认');setTimeout(openSettings,0);
  }
  async function refreshCapabilities(show){
    var r=foodState();
    try{var cap=await request('capabilities',{},12000);r.lastCapability={ok:true,at:Date.now(),providers:Array.isArray(cap.providers)?cap.providers.map(String):[],payments:Array.isArray(cap.payments)?cap.payments.map(String):[],addressLabel:text(cap.addressLabel,80),automaticPayments:cap.automaticPayments!==false,addressConfirmation:cap.addressConfirmation!==false,realtimeWebhooks:cap.realtimeWebhooks===true};if(r.lastCapability.addressLabel)r.addressLabel=r.lastCapability.addressLabel;if(r.lastCapability.automaticPayments===false)r.autoPay=false;save();if(show)toast('真实外卖服务已连接');render();return true;}
    catch(e){r.lastCapability={ok:false,at:Date.now(),error:text(e.message,160)};save();if(show)toast(e.message||'连接失败');render();return false;}
  }
  function switchHtml(){
    var r=foodState(),cap=r.lastCapability,connected=cap&&cap.ok,sub=!r.enabled?'当前为虚拟外卖':connected?'已连接 '+((cap.providers||[]).map(providerText).join('、')||'真实服务'):'真实服务未连接';
    return '<button class="delivery-mode-pill '+(r.enabled?'real':'virtual')+'" onclick="deliveryOpenSettings()"><i></i><span>'+(r.enabled?'真实外卖':'虚拟外卖')+'</span><small>'+esc(sub)+'</small><b>›</b></button>';
  }
  function openSettings(){
    var r=foodState(),cap=r.lastCapability,canAuto=!(cap&&cap.ok&&cap.automaticPayments===false),roles=(S.contacts||[]).filter(function(c){return c&&!c.deleted;});roles.forEach(roleWallet);
    var capText=!r.connectorUrl?'尚未填写真实外卖服务地址':cap&&cap.ok?'已连接：'+((cap.providers||[]).map(providerText).join('、')||'真实服务')+(cap.addressLabel?' · '+cap.addressLabel:''):cap&&cap.error?'未连接：'+cap.error:'等待检测连接';
    var roleRows=roles.length?roles.map(function(c){var w=roleWallet(c);return '<button class="delivery-role-row" onclick="deliveryOpenWallet(\''+c.id+'\')"><span>'+av(c.avatar||'👤','sm')+'</span><span><b>'+esc(c.remark||c.name)+'</b><small>授权额度 ¥'+w.balance.toFixed(2)+' · 单笔 ¥'+w.singleLimit.toFixed(0)+' · 今日 ¥'+w.spentToday.toFixed(2)+'/'+w.dailyLimit.toFixed(0)+'</small></span><i>›</i></button>';}).join(''):'<div class="delivery-empty-mini">先创建角色，再设置自动付款额度</div>';
    var paymentControl=canAuto?'<label class="delivery-toggle '+(!r.enabled?'disabled':'')+'"><span><b>允许角色自动付款</b><small>开启后仍受授权额度和平台风控限制</small></span><input type="checkbox" '+(r.autoPay?'checked':'')+' '+(!r.enabled?'disabled':'')+' onchange="deliverySetAutoPay(this.checked)"><i></i></label>':'<div class="delivery-notice"><b>当前通道由你确认付款</b><br>角色会选好真实商品、口味和可用优惠并创建订单，再把支付宝官方收银台交给你；当前没有真实角色钱包，也不会显示无效的自动付款开关。</div>';
    var walletSection=canAuto?'<div class="delivery-section-title">角色自动付款授权</div>'+roleRows:'';
    openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>DELIVERY CONTROL</small><h3>真实外卖与付款</h3></div><button onclick="closeModal()">×</button></div><div class="delivery-notice">真实模式只显示连接器返回的商家、价格、优惠与配送状态；失败时不会回退为虚拟订单。</div><label class="delivery-toggle"><span><b>开启真实外卖</b><small>默认关闭；开启后外卖软件和角色都只走真实订单</small></span><input type="checkbox" '+(r.enabled?'checked':'')+' onchange="deliverySetEnabled(this.checked)"><i></i></label>'+paymentControl+'<div class="delivery-field"><label>真实外卖服务地址</label><div><input id="delivery_connector_url" value="'+esc(r.connectorUrl)+'" placeholder="https://你的安全外卖连接器"><button onclick="deliverySaveConnector()">保存并检测</button></div><small>'+esc(capText)+'</small></div><div class="delivery-field"><label>当前收货地址</label><div><input value="'+esc(r.addressLabel||'尚未确认')+'" disabled><button onclick="deliveryConfirmAddress()" '+(!r.enabled||!r.connectorUrl||(cap&&cap.addressConfirmation===false)?'disabled':'')+'>本人确认</button></div><small>'+(cap&&cap.addressConfirmation===false?'当前真实外卖服务不支持地址确认':r.approvedAddressFingerprint?'已确认当前平台默认地址':'创建真实订单前请确认平台默认地址')+'</small></div>'+walletSection+'<div class="delivery-safety">当前淘宝闪购通道只支持支付宝官方收银台由本人确认。MCP 或浏览器自动化不会模拟、绕过支付密码、生物识别或平台风控。</div></div>');
  }
  function saveConnector(){
    var el=document.getElementById('delivery_connector_url'),u=text(el&&el.value,500);if(u){try{var p=new URL(u);if(p.protocol!=='https:')throw 0;u=p.href.replace(/\/$/,'');}catch(_){toast('服务地址必须是 HTTPS');return;}}
    var r=foodState(),changed=r.connectorUrl!==u;r.connectorUrl=u;r.lastCapability=null;if(changed){r.approvedAddressFingerprint='';r.addressLabel='';r.autoPay=false;}save();openSettings();if(u)refreshCapabilities(true);
  }
  async function confirmAddress(){
    var r=foodState();if(!r.enabled||!connectorUrl()){toast('请先连接真实外卖服务');return;}if(r.lastCapability&&r.lastCapability.addressConfirmation===false){toast('当前真实外卖服务不支持地址确认');return;}
    try{var data=await request('confirm_address',{confirmedByUser:true},18000),fingerprint=text(data.addressFingerprint,180),label=text(data.addressLabel,80);if(!fingerprint)throw new Error('平台没有返回可验证的地址标识');r.approvedAddressFingerprint=fingerprint;if(label)r.addressLabel=label;save();toast('已确认当前收货地址');openSettings();}
    catch(e){toast(e.message||'收货地址确认失败');}
  }
  function openWallet(cid){
    var c=getC(cid),w=roleWallet(c);if(!c||!w)return;
    openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>ROLE DELIVERY WALLET</small><h3>'+esc(c.remark||c.name)+'的外卖钱包</h3></div><button onclick="deliveryOpenSettings()">‹</button></div><div class="delivery-wallet-balance"><small>自动支付可用额度</small><b>¥'+w.balance.toFixed(2)+'</b><span>这是你授予角色的消费额度，不是微信或支付宝储值账户</span></div><div class="delivery-quick"><button onclick="deliveryTopUp(\''+cid+'\',50)">+50</button><button onclick="deliveryTopUp(\''+cid+'\',100)">+100</button><button onclick="deliveryTopUp(\''+cid+'\',200)">+200</button></div><div class="delivery-field"><label>自定义补充额度</label><div><input id="delivery_topup" type="number" min="0.01" step="0.01" placeholder="金额"><button onclick="deliveryTopUp(\''+cid+'\',document.getElementById(\'delivery_topup\').value)">补充</button></div></div><div class="delivery-limits"><label>单笔自动付款上限<input id="delivery_single" type="number" min="0" step="1" value="'+w.singleLimit+'"></label><label>每日自动付款总上限<input id="delivery_daily" type="number" min="0" step="1" value="'+w.dailyLimit+'"></label></div><button class="delivery-save" onclick="deliverySaveWallet(\''+cid+'\')">保存额度</button><div class="delivery-safety">默认单笔 ¥100、每日 ¥200，均可自由调整；填 0 表示不允许自动付款。已支付订单才会扣减这里的额度。</div></div>');
  }
  function topUp(cid,amount){var c=getC(cid),w=roleWallet(c);amount=num(amount);if(!w||amount<=0){toast('请输入正确金额');return;}w.balance=num(w.balance+amount);w.ledger.unshift({id:uid(),type:'topup',amount:amount,at:Date.now(),by:'user'});w.ledger=w.ledger.slice(0,80);save();openWallet(cid);}
  function saveWallet(cid){var c=getC(cid),w=roleWallet(c),a=document.getElementById('delivery_single'),b=document.getElementById('delivery_daily');if(!w)return;w.singleLimit=num(a&&a.value);w.dailyLimit=num(b&&b.value);save();toast('角色外卖额度已保存');openWallet(cid);}

  async function realSearch(query,opt){
    query=text(query,120);if(!query)throw new Error('请输入要搜索的餐品或店铺');
    var data=await request('search',{query:query,providers:['taobao_flash','meituan'],paymentPreference:['wechat','alipay'],roleId:opt&&opt.roleId||'',limit:opt&&opt.roleId?1:4},90000);
    var offers=(Array.isArray(data)?data:data.offers||[]).map(safeOffer).filter(function(x){return x.offerId&&x.name&&x.total>0;});
    var r=foodState();if(data&&data.addressLabel)r.addressLabel=text(data.addressLabel,80);if(!offers.length)throw new Error('真实平台没有返回可下单商品');
    return offers;
  }
  async function search(){
    if(!enabled())return oldFoodSearch.apply(this,arguments);
    if(_foodBusy)return;var el=document.getElementById('food_q'),q=text(el&&el.value,120);if(!q){toast('请输入要搜索的餐品或店铺');return;}
    S.food.q=q;_foodBusy=true;render();
    try{S.food.results=await realSearch(q,{});S.food.cart=[];save();}
    catch(e){S.food.results=[];foodState().lastError=text(e.message,160);toast(e.message||'真实外卖搜索失败');}
    finally{_foodBusy=false;render();}
  }
  function cart(i){if(!enabled())return window.foodCart&&window.foodCart(i);var p=S.food.results[i];if(!p)return;if(S.food.cart.some(function(x){return x.offerId===p.offerId;})){toast('已经在外卖单里');return;}S.food.cart.push(p);save();render();toast('已加入外卖单');}
  async function createOrder(offer,ctx){
    ctx=ctx||{};var selected=normalizeSelectedOptions(offer,ctx.selectedOptions),r=foodState(),pending=r.pendingCreates.find(function(x){return x.offerId===offer.offerId&&x.roleId===(ctx.roleId||'');}),requestId=pending&&pending.requestId||uid();if(!pending){r.pendingCreates.unshift({offerId:offer.offerId,roleId:ctx.roleId||'',requestId:requestId,at:Date.now()});r.pendingCreates=r.pendingCreates.slice(0,12);save();}var data=await request('create_order',{offerId:offer.offerId,quoteId:offer.quoteId,quantity:Math.max(1,Math.min(20,+ctx.quantity||1)),selectedOptions:selected,roleId:ctx.roleId||'',source:ctx.roleId?'role':'user',paymentPreference:['wechat','alipay'],clientRequestId:requestId},35000);
    var fallbackOptions=optionSummary(offer,selected),order={id:text(data.id||data.orderId,160)||uid(),remoteId:text(data.orderId||data.id,160),clientRequestId:requestId,provider:text(data.provider||offer.provider,40),merchant:text(data.merchant||offer.merchant,100),merchantId:text(data.merchantId||offer.merchantId,120),items:Array.isArray(data.items)?data.items.map(function(x){return{name:text(x.name,140),options:text(x.options||x.specification,240),quantity:Math.max(1,+x.quantity||1),price:num(x.price)};}):[{name:offer.name,options:fallbackOptions,quantity:Math.max(1,+ctx.quantity||1),price:offer.price}],total:num(data.total==null?offer.total:data.total),discount:num(data.discount),couponLabel:text(data.couponLabel,100),quotedTotal:num(offer.total),status:text(data.status,40)||'created',paymentMethod:text(data.paymentMethod,40),payUrl:safePayUrl(data.payUrl),payQrDataUrl:safePayQr(data.payQrDataUrl),addressLabel:text(data.addressLabel||offer.addressLabel,80),addressFingerprint:text(data.addressFingerprint||offer.addressFingerprint,180),risk:Array.isArray(data.risk)?data.risk.map(function(x){return text(x,80);}):[],roleId:ctx.roleId||'',source:ctx.roleId?'role':'user',createdAt:Date.now(),updatedAt:Date.now(),notifiedStatuses:[],walletDebited:false,walletRefunded:false,real:true};
    r.pendingCreates=r.pendingCreates.filter(function(x){return x.requestId!==requestId;});S.food.orders.unshift(order);S.food.orders=S.food.orders.slice(0,80);save();return order;
  }
  function recentDuplicate(order){return S.food.orders.some(function(x){return x!==order&&x.real&&x.merchantId&&x.merchantId===order.merchantId&&Date.now()-(+x.createdAt||0)<20*60000&&!TERMINAL[x.status];});}
  function autoPayCheck(order,c){
    var r=foodState(),w=roleWallet(c),reasons=[];
    if(!r.enabled)reasons.push('真实外卖未开启');if(!r.autoPay)reasons.push('角色自动付款未开启');
    if(!w||w.balance<order.total)reasons.push('角色外卖钱包额度不足');if(!w||w.singleLimit<=0||order.total>w.singleLimit)reasons.push('超过单笔自动付款上限');if(!w||w.dailyLimit<=0||w.spentToday+order.total>w.dailyLimit)reasons.push('超过每日自动付款上限');
    if(!r.approvedAddressFingerprint||!order.addressFingerprint||r.approvedAddressFingerprint!==order.addressFingerprint)reasons.push('新地址需要本人确认');if(Math.abs(order.total-order.quotedTotal)>.001)reasons.push('下单价格与报价不一致');if(recentDuplicate(order))reasons.push('短时间内存在重复订单');if(order.risk&&order.risk.length)reasons.push('平台要求本人确认');
    return reasons;
  }
  function settleWallet(order){
    if(!order||!order.roleId||!order.autoPayAuthorized)return;var c=getC(order.roleId),w=roleWallet(c);if(!w)return;
    if(order.status==='paid'&&!order.walletDebited){var amount=num(order.total),authorized=num(order.autoPayAuthorizedTotal);if(amount>authorized+.001){foodState().autoPay=false;order.walletReviewRequired=true;order.pendingReason='实付金额与自动付款授权不一致，已自动关闭后续自动付款，请核对订单';}w.balance=Math.max(0,Math.round((w.balance-amount)*100)/100);w.spentToday=num(w.spentToday+amount);w.ledger.unshift({id:uid(),type:'payment',amount:amount,orderId:order.id,at:Date.now(),by:'role',receipt:'platform_paid'});w.ledger=w.ledger.slice(0,80);order.walletDebited=true;order.walletDebitedAmount=amount;order.walletDebitedDay=dayKey();}
    if(order.status==='refunded'&&order.walletDebited&&!order.walletRefunded){var refund=num(order.walletDebitedAmount||order.total);w.balance=num(w.balance+refund);if(order.walletDebitedDay===dayKey())w.spentToday=Math.max(0,Math.round((w.spentToday-refund)*100)/100);w.ledger.unshift({id:uid(),type:'refund',amount:refund,orderId:order.id,at:Date.now(),by:'platform'});w.ledger=w.ledger.slice(0,80);order.walletRefunded=true;}
  }
  async function payOrder(order,c,automatic){
    if(automatic){var reasons=autoPayCheck(order,c);if(reasons.length){order.status='pending_payment';order.pendingReason=reasons.join('；');save();return order;}}
    if(automatic){order.autoPayAuthorized=true;order.autoPayAuthorizedTotal=num(order.total);order.autoPayAuthorizedAt=Date.now();}order.paymentAttemptId=order.paymentAttemptId||uid();save();
    var data=await request('pay_order',{orderId:order.remoteId,paymentPreference:['wechat','alipay'],automatic:!!automatic,roleId:order.roleId||'',clientRequestId:order.paymentAttemptId,authorizedTotal:automatic?order.autoPayAuthorizedTotal:null},35000);
    order.status=text(data.status,40)||'pending_payment';order.paymentMethod=text(data.paymentMethod,40);order.payUrl=safePayUrl(data.payUrl);order.payQrDataUrl=safePayQr(data.payQrDataUrl);order.pendingReason=text(data.reason,180);order.updatedAt=Date.now();settleWallet(order);
    save();return order;
  }
  function openOptionPicker(offer){
    manualOptionOffer=offer;var groups=offer.optionGroups||[],body=groups.map(function(g,gi){var fields=g.multiple?g.choices.map(function(c){return '<label class="delivery-option-check"><input class="delivery-option-multi" data-group="'+gi+'" type="checkbox" value="'+esc(c.id)+'">'+esc(c.label)+(c.priceDelta?' +¥'+num(c.priceDelta).toFixed(2):'')+'</label>';}).join(''):'<select class="delivery-option-single" data-group="'+gi+'"><option value="">请选择</option>'+g.choices.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.label)+(c.priceDelta?' +¥'+num(c.priceDelta).toFixed(2):'')+'</option>';}).join('')+'</select>';return '<div class="delivery-option-group"><b>'+esc(g.name)+(g.required?' *':'')+'</b>'+fields+'</div>';}).join('');openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>ORDER OPTIONS</small><h3>'+esc(offer.name)+'</h3></div><button onclick="closeModal()">×</button></div>'+body+'<label class="delivery-option-qty">数量<input id="delivery_option_qty" type="number" min="1" max="20" value="1"></label><button class="delivery-save" onclick="deliveryConfirmOptions()">按这些口味创建订单</button></div>');
  }
  function confirmOptions(){var offer=manualOptionOffer;if(!offer)return;var selected={};try{(offer.optionGroups||[]).forEach(function(g,gi){if(g.multiple){selected[g.id]=Array.from(document.querySelectorAll('.delivery-option-multi[data-group="'+gi+'"]:checked')).map(function(el){return el.value;});}else{var el=document.querySelector('.delivery-option-single[data-group="'+gi+'"]');selected[g.id]=el&&el.value||'';}});selected=normalizeSelectedOptions(offer,selected);}catch(e){toast(e.message);return;}var qty=Math.max(1,Math.min(20,+((document.getElementById('delivery_option_qty')||{}).value)||1));manualOptionOffer=null;closeModal();manualOrder(offer,{selectedOptions:selected,quantity:qty});}
  async function manualOrder(offer,opt){
    if(!enabled())return oldFoodBuy.apply(this,arguments);if(!offer||!offer.offerId)return;
    if((offer.optionGroups||[]).length&&!opt){openOptionPicker(offer);return;}
    _foodBusy=true;render();try{var order=await createOrder(offer,opt||{});await payOrder(order,null,false);S.food.cart=S.food.cart.filter(function(x){return x.offerId!==offer.offerId;});save();openOrders();if(order.status==='pending_payment')toast('真实订单已创建，请完成付款');else toast('真实订单状态：'+statusText(order.status));}catch(e){toast(e.message||'真实订单创建失败');}finally{_foodBusy=false;render();}
  }
  function buy(i){if(!enabled())return oldFoodBuy.apply(this,arguments);return manualOrder(S.food.results[i]);}
  function openCart(){
    if(!enabled())return oldOpenFoodCart.apply(this,arguments);var cart=S.food.cart||[],total=cart.reduce(function(s,p){return s+num(p.total);},0);
    openModal('<h3>真实外卖单</h3><div class="delivery-cart-list">'+(cart.length?cart.map(function(p,i){return '<div class="bill"><div>'+esc(p.name)+'<small>'+esc(p.merchant)+' · '+providerText(p.provider)+'</small></div><div>¥'+num(p.total).toFixed(2)+' <span onclick="S.food.cart.splice('+i+',1);save();openFoodCart()" class="delivery-remove">✕</span></div></div>';}).join(''):'<div class="empty">外卖单空空的</div>')+'</div>'+(cart.length?'<div class="delivery-cart-total">合计 ¥'+total.toFixed(2)+'</div><div class="delivery-notice">为避免跨店、运费和优惠变化，真实订单需要逐店确认。将从第一项开始创建订单。</div><button class="btn p" onclick="deliveryCheckoutCart()">创建真实订单</button>':'')+'<button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>');
  }
  async function checkoutCart(){var item=(S.food.cart||[])[0];if(!item)return;closeModal();await manualOrder(item);}
  function orderItems(order){return (order.items||[]).map(function(x){return esc(x.name)+(x.options?'（'+esc(x.options)+'）':'')+(x.quantity>1?' ×'+x.quantity:'');}).join('、')||'外卖商品';}
  function openOrders(){
    if(!enabled())return oldOpenFoodOrders.apply(this,arguments);var rows=(S.food.orders||[]).filter(function(x){return x&&x.real;});
    openModal('<div class="delivery-orders"><div class="delivery-settings-head"><div><small>REAL-TIME ORDERS</small><h3>真实外卖订单</h3></div><button onclick="closeModal()">×</button></div><button class="delivery-refresh" onclick="deliveryPollOrders(true)">刷新真实状态</button><div class="delivery-order-list">'+(rows.length?rows.map(function(o){var pending=o.status==='pending_payment',active=!TERMINAL[o.status],progress=['created','pending_payment','paid','merchant_confirmed','preparing','courier_assigned','picked_up','delivering','delivered'].indexOf(o.status);return '<article class="delivery-order-card"><header><span>'+providerText(o.provider)+'</span><b>'+statusText(o.status)+'</b></header><h4>'+esc(o.merchant||'外卖商家')+'</h4><p>'+orderItems(o)+'</p><div class="delivery-progress"><i style="width:'+Math.max(3,Math.min(100,(progress<0?0:progress)/8*100))+'%"></i></div><div class="delivery-order-meta"><span>¥'+num(o.total).toFixed(2)+'</span><span>'+esc(o.addressLabel||'平台默认地址')+'</span></div>'+(o.pendingReason?'<small class="delivery-reason">'+esc(o.pendingReason)+'</small>':'')+'<footer>'+(pending?'<button onclick="deliveryOpenPay(\''+o.id+'\')">'+((o.payUrl||o.payQrDataUrl)?'查看付款码':'获取付款方式')+'</button>':'')+(active?'<button onclick="deliveryPollOrders(true)">刷新状态</button>':'')+'</footer></article>';}).join(''):'<div class="empty">还没有真实外卖订单</div>')+'</div></div>');
  }
  function showPayment(o){var qr=o.payQrDataUrl?'<img class="delivery-pay-qr" src="'+o.payQrDataUrl+'" alt="官方付款二维码">':'',button=o.payUrl?'<button class="delivery-save" onclick="deliveryLaunchPay(\''+o.id+'\')">在本机打开'+paymentText(o.paymentMethod)+'</button>':'',discount=o.discount>0?'<small>平台确认页已优惠 ¥'+num(o.discount).toFixed(2)+(o.couponLabel?' · '+esc(o.couponLabel):'')+'</small>':'';openModal('<div class="delivery-settings delivery-payment"><div class="delivery-settings-head"><div><small>OFFICIAL CHECKOUT</small><h3>官方待付款订单</h3></div><button onclick="deliveryOpenOrders()">×</button></div><div class="delivery-notice">角色已经选好真实商品、口味和平台实际可用优惠；付款仍由你在官方收银台确认。</div><h4>'+esc(o.merchant||'外卖商家')+'</h4><p>'+orderItems(o)+'</p><b class="delivery-pay-total">¥'+num(o.total).toFixed(2)+'</b>'+discount+qr+button+'<button class="btn g" onclick="deliveryOpenOrders()">稍后付款</button></div>');}
  function launchPay(id){var o=(S.food.orders||[]).find(function(x){return x.id===id;});if(!o||!o.payUrl)return;window.open(o.payUrl,'_blank','noopener');toast('已打开官方付款页面；付款后刷新订单状态');}
  async function openPay(id){var o=(S.food.orders||[]).find(function(x){return x.id===id;});if(!o)return;try{if(!o.payUrl&&!o.payQrDataUrl&&o.status!=='paid')await payOrder(o,null,false);if(o.status==='paid')toast('平台已确认付款成功');else if(o.payUrl||o.payQrDataUrl)showPayment(o);else{toast(o.pendingReason||'平台暂未返回付款链接');openOrders();}}catch(e){toast(e.message||'获取付款方式失败');}}
  function mergeStatus(order,data){var before=order.status,next=text(data.status,40);if(next&&STATUS_TEXT[next]){var beforeRank=STATUS_RANK[before],nextRank=STATUS_RANK[next],allowed=!TERMINAL[before]&&(TERMINAL[next]||beforeRank==null||nextRank==null||nextRank>=beforeRank);if(allowed)order.status=next;}['paymentMethod','addressLabel','addressFingerprint'].forEach(function(k){if(data[k]!=null)order[k]=text(data[k],180);});if(data.payUrl!=null)order.payUrl=safePayUrl(data.payUrl);if(data.payQrDataUrl!=null)order.payQrDataUrl=safePayQr(data.payQrDataUrl);if(data.total!=null)order.total=num(data.total);order.updatedAt=Date.now();settleWallet(order);return before!==order.status?before:'';}
  function notifyStatus(order,before){
    if(!order.roleId||!before||order.notifiedStatuses.includes(order.status))return;var c=getC(order.roleId);if(!c||c.blocked)return;order.notifiedStatuses.push(order.status);save();
    var fact='[真实外卖订单状态更新]\n你亲自创建的真实外卖订单现在由平台确认处于「'+statusText(order.status)+'」。商家：'+(order.merchant||'')+'；餐品：'+(order.items||[]).map(function(x){return x.name;}).join('、')+'；实付/待付金额：¥'+num(order.total).toFixed(2)+'。这是平台刚返回的事实。请按你自己的完整人设、当前关系和说话习惯，自主决定怎样提醒'+S.me.name+'；不要照抄提示，不要添加骑手位置、送达时间或其他未提供事实。若只是中间小变化且你本人觉得不必打扰，也可以不发。';
    scheduleReply(c.id,fact);
  }
  async function pollOrders(show){
    if(pollBusy||!enabled()||!connectorUrl())return false;var rows=(S.food.orders||[]).filter(function(x){return x.real&&x.remoteId&&!TERMINAL[x.status];});if(!rows.length){if(show)toast('没有需要刷新的真实订单');return false;}pollBusy=true;try{for(var i=0;i<rows.length;i++){try{var data=await request('order_status',{orderId:rows[i].remoteId},18000),before=mergeStatus(rows[i],data);if(rows[i].status==='paid'&&rows[i].addressFingerprint&&!foodState().approvedAddressFingerprint)foodState().approvedAddressFingerprint=rows[i].addressFingerprint;notifyStatus(rows[i],before);}catch(e){rows[i].lastSyncError=text(e.message,140);}}save();if(show){openOrders();toast('已按平台回执刷新订单');}else if(cur&&cur().p==='food')render();return true;}finally{pollBusy=false;}}
  async function chooseOffer(c,query,offers){
    var compact=offers.map(function(x){return{id:x.offerId,platform:providerText(x.provider),merchant:x.merchant,name:x.name,total:x.total,rating:x.rating,reviewCount:x.reviewCount,coupon:x.couponLabel,etaMinutes:x.etaMinutes,optionGroups:(x.optionGroups||[]).map(function(g){return{id:g.id,name:g.name,required:g.required,multiple:g.multiple,choices:g.choices.map(function(c){return{id:c.id,label:c.label,priceDelta:c.priceDelta};})};})};});
    var raw=await chatAPI([{role:'system',content:'你是「'+c.name+'」本人。下面是外卖平台真实返回的候选与可选口味。只做内部选择，不要对用户说话。必须优先严格满足用户明确说出的品牌、饮品、杯型、糖度、温度、口味和加料；没有明确指定的部分才按你的人设、真实价格、优惠、评价和配送信息自主选择。只返回严格 JSON：{"offerId":"候选id","quantity":1,"selectedOptions":{"选项组id":"选项id"}}。多选组选项值用数组。只能使用候选里真实存在的 id；每个 required 组都必须选择；平台没有的选项绝不能编造。'},{role:'user',content:'用户原话里的需求：'+query+'\n真实候选：'+JSON.stringify(compact)}],{max:420,temp:.25});
    var obj=null;try{obj=JSON.parse(String(raw||'').replace(/^```(?:json)?|```$/g,'').trim());}catch(_){}var chosen=offers.find(function(x){return obj&&x.offerId===obj.offerId;});if(!chosen)throw new Error('角色没有从真实候选中完成有效选择');var selected=normalizeSelectedOptions(chosen,obj.selectedOptions);return{offer:chosen,quantity:Math.max(1,Math.min(20,+obj.quantity||1)),selectedOptions:selected};
  }
  function resultReply(c,order,error){
    if(!c||c.blocked)return;var fact=error?'[真实外卖操作结果]\n你刚才尝试使用真实外卖，但真实服务返回失败：'+text(error,180)+'。没有创建成功订单，也没有付款。请按你自己的完整人设和说话方式自然告诉'+S.me.name+'真实结果；绝不能假装已经下单、付款、接单或配送。':'[真实外卖操作结果]\n你刚才亲自选择并创建了真实外卖订单。平台：'+providerText(order.provider)+'；商家：'+order.merchant+'；餐品与口味：'+(order.items||[]).map(function(x){return x.name+(x.options?'（'+x.options+'）':'')+(x.quantity>1?'×'+x.quantity:'');}).join('、')+'；金额：¥'+num(order.total).toFixed(2)+(order.discount>0?'；平台确认页已优惠：¥'+num(order.discount).toFixed(2):'')+(order.couponLabel?'；已用优惠：'+order.couponLabel:'')+'；当前真实状态：'+statusText(order.status)+(order.pendingReason?'；需要本人处理的原因：'+order.pendingReason:'')+'。请按你自己的完整人设、关系和说话习惯自然告诉'+S.me.name+'结果，不要照抄字段，不要添加未提供的优惠、评价、骑手、时间或送达事实。';scheduleReply(c.id,fact);
  }
  async function roleRequest(cid,query){
    var c=getC(cid);if(!c)return false;if(!enabled()){return false;}var r=foodState();
    if(!connectorUrl()){resultReply(c,null,'还没有连接真实外卖服务');return true;}
    if(!query){resultReply(c,null,'没有提供可搜索的餐品或店铺');return true;}
    if((S.food.orders||[]).some(function(x){return x.real&&x.roleId===cid&&Date.now()-(+x.createdAt||0)<20*60000&&!TERMINAL[x.status];})){resultReply(c,null,'20分钟内已有一笔角色真实外卖订单仍在处理，为避免重复没有再下单');return true;}
    try{var offers=await realSearch(query,{roleId:cid}),choice=await chooseOffer(c,query,offers),order=await createOrder(choice.offer,{roleId:cid,quantity:choice.quantity,selectedOptions:choice.selectedOptions});await payOrder(order,c,true);resultReply(c,order,'');return true;}
    catch(e){resultReply(c,null,e.message||'真实外卖操作失败');return true;}
  }
  function rolePrompt(){
    var r=foodState();
    if(!r.enabled)return '\n\n# 外卖能力\n当前真实外卖未开启。[点外卖|餐品名|价格] 只会创建虚拟小手机里的剧情外卖，不能把它说成淘宝闪购、美团、微信支付、支付宝或现实订单。';
    return '\n\n# 真实外卖能力与硬边界\n真实外卖已开启。你可以按本人判断主动使用，也可以在'+S.me.name+'口头说想喝或想吃某样东西时搜索。真正决定尝试下单时只输出一行 [真实外卖|具体搜索词]，搜索词可以包含品牌、门店、餐品、口味等，但不能虚构平台结果。系统会把淘宝闪购和美团外卖真实返回的候选交给你内部选择，再根据开关、角色钱包、地址、价格和风控决定自动付款或创建待付款订单。\n输出标签的这一轮只能自然表达“准备找/准备看看”，绝不能提前声称已经找到、用了优惠券、下单、付款、骑手接单或送达；只有收到后续真实操作结果后才能说对应事实。你无权充值角色外卖钱包、改额度或开关自动付款。真实服务失败时不能改走虚拟外卖。不要再使用 [点外卖|餐品|价格]。';
  }

  foodState();(S.contacts||[]).forEach(roleWallet);
  window.deliveryRealEnabled=enabled;
  window.deliveryRolePrompt=rolePrompt;
  window.deliveryModeSwitchHtml=switchHtml;
  window.deliveryOpenSettings=openSettings;
  window.deliverySetEnabled=setEnabled;
  window.deliverySetAutoPay=setAutoPay;
  window.deliverySaveConnector=saveConnector;
  window.deliveryConfirmAddress=confirmAddress;
  window.deliveryRefreshCapabilities=refreshCapabilities;
  window.deliveryOpenWallet=openWallet;
  window.deliveryTopUp=topUp;
  window.deliverySaveWallet=saveWallet;
  window.deliveryRealFoodCart=cart;
  window.deliveryRealOrder=manualOrder;
  window.deliveryCheckoutCart=checkoutCart;
  window.deliveryConfirmOptions=confirmOptions;
  window.deliveryOpenOrders=openOrders;
  window.deliveryOpenPay=openPay;
  window.deliveryLaunchPay=launchPay;
  window.deliveryPollOrders=pollOrders;
  window.deliveryHandleRoleRequest=roleRequest;
  window.deliveryStatusText=statusText;
  window.deliveryProviderText=providerText;
  window.foodSearch=search;
  window.foodBuy=buy;
  window.openFoodCart=openCart;
  window.openFoodOrders=openOrders;
  setInterval(function(){pollOrders(false);},45000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)pollOrders(false);});
  window.addEventListener('online',function(){pollOrders(false);});
  setTimeout(function(){pollOrders(false);},5000);
})();
