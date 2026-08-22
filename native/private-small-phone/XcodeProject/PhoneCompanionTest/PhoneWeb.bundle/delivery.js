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
  var roleRequests={};
  var TERMINAL={delivered:1,canceled:1,refunded:1,failed:1};
  var STATUS_RANK={quote:0,created:1,pending_payment:1,paid:2,merchant_confirmed:3,preparing:4,courier_assigned:5,picked_up:6,delivering:7,delivered:8};
  var STATUS_TEXT={quote:'待下单',created:'订单已创建',pending_payment:'待付款',paid:'已付款',merchant_confirmed:'商家已接单',preparing:'商家备餐中',courier_assigned:'骑手已接单',picked_up:'骑手已取餐',delivering:'配送中',delivered:'已送达',canceled:'已取消',refunded:'已退款',failed:'订单失败'};

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
    r.roleGlobalSearch=true;
    r.autoPay=false;
    r.connectorUrl=builtInConnectorUrl();
    r.addressLabel=text(r.addressLabel,80);
    r.approvedAddressFingerprint=text(r.approvedAddressFingerprint,180);
    r.lastCapability=r.lastCapability&&typeof r.lastCapability==='object'?r.lastCapability:null;
    r.lastRoleNotice=r.lastRoleNotice&&typeof r.lastRoleNotice==='object'?{message:text(r.lastRoleNotice.message,180),kind:text(r.lastRoleNotice.kind,20)||'info',at:+r.lastRoleNotice.at||0}:null;
    r.pendingCreates=Array.isArray(r.pendingCreates)?r.pendingCreates.filter(function(x){return x&&Date.now()-(+x.at||0)<10*60000;}).slice(0,12):[];
    r.roleAttempts=r.roleAttempts&&typeof r.roleAttempts==='object'?r.roleAttempts:{};Object.keys(r.roleAttempts).forEach(function(cid){var a=r.roleAttempts[cid];if(!a||typeof a!=='object'){delete r.roleAttempts[cid];return;}if(!a.endedAt&&a.startedAt&&Date.now()-a.startedAt>180000){a.status='failed';a.endedAt=a.startedAt+180000;a.error='真实外卖操作超过3分钟，已结束本轮';}});
    r.roleClarifications=r.roleClarifications&&typeof r.roleClarifications==='object'?r.roleClarifications:{};Object.keys(r.roleClarifications).forEach(function(cid){var x=r.roleClarifications[cid];if(!x||typeof x!=='object'||Date.now()-(+x.at||0)>30*60000)delete r.roleClarifications[cid];});
    S.food.real=r;
    return r;
  }
  var PREF_CONFIG={
    milkTea:{title:'奶茶偏好',icon:'🥤',eyebrow:'MILK TEA',fields:[['brands','常喝品牌或门店','例如：喜茶、霸王茶姬、奈雪'],['favorites','常喝饮品和口味','例如：果茶、茉莉、葡萄、奶香重'],['sweetnessIce','默认糖度和冰度','例如：无糖、少冰；没有无糖就不下单'],['toppings','小料偏好','例如：珍珠、脆啵啵，小料多一点'],['avoid','不喜欢或需要避开','例如：不要椰果；对花生过敏']]},
    staple:{title:'主食偏好',icon:'🍚',eyebrow:'MAIN MEAL',fields:[['cuisines','常吃菜系或品类','例如：中餐、面食、盖饭、轻食'],['favorites','喜欢的主食和菜品','例如：牛肉饭、鸡腿饭、番茄鸡蛋面'],['spicePortion','辣度和份量','例如：微辣、正常份；晚上少一点'],['staple','主食搭配','例如：米饭多一点、不要香菜、喜欢汤'],['avoid','不喜欢、过敏或忌口','例如：不吃肥肉；海鲜过敏']]},
    coffee:{title:'咖啡偏好',icon:'☕',eyebrow:'COFFEE',fields:[['brands','常喝品牌或门店','例如：瑞幸、库迪、Manner'],['favorites','常喝咖啡和风味','例如：生椰拿铁、拿铁、厚乳、坚果香'],['sweetnessTemperature','默认糖度和温度','例如：少少甜、少冰；冬天热饮'],['milkSize','奶类、杯型和加料','例如：椰乳、大杯、不加奶油'],['avoid','不喜欢或需要避开','例如：不要太苦；乳糖不耐受']]},
    kfc:{title:'KFC 偏好',icon:'🍗',eyebrow:'KFC',fields:[['favorites','喜欢的套餐或单品','例如：香辣鸡腿堡、原味鸡、蛋挞'],['sides','小食偏好','例如：薯条、鸡米花，不要玉米杯'],['drinks','饮料偏好','例如：无糖可乐、热牛奶'],['custom','份量和定制','例如：两块原味鸡、汉堡不要酱'],['avoid','不喜欢、过敏或忌口','例如：不吃辣；不要花生碎']]}
  };
  function deliveryPreferences(){
    var r=foodState(),raw=r.preferences&&typeof r.preferences==='object'?r.preferences:{},p={};
    Object.keys(PREF_CONFIG).forEach(function(kind){var source=raw[kind]&&typeof raw[kind]==='object'?raw[kind]:{};p[kind]={};PREF_CONFIG[kind].fields.forEach(function(field){var key=field[0],legacy=kind==='milkTea'?(key==='favorites'?raw.flavors:raw[key]):'';p[kind][key]=text(source[key]!=null?source[key]:legacy,300);});});
    r.preferences=p;return p;
  }
  function preferenceCategoryText(kind){var cfg=PREF_CONFIG[kind],p=deliveryPreferences()[kind],rows=[];if(!cfg||!p)return'未填写';cfg.fields.forEach(function(field){if(p[field[0]])rows.push(field[1]+'：'+p[field[0]]);});return rows.join('；')||'未填写';}
  function preferenceText(){var rows=[];Object.keys(PREF_CONFIG).forEach(function(kind){var value=preferenceCategoryText(kind);if(value!=='未填写')rows.push(PREF_CONFIG[kind].title+'：'+value);});return rows.join('\n')||'四类偏好均未填写';}
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
    return {offerId:text(x.offerId||x.id,160),provider:text(x.provider,40),merchantId:text(x.merchantId,120),merchant:text(x.merchant||x.shop,100),name:text(x.name,140),description:text(x.description||x.desc,240),price:num(x.price),deliveryFee:num(x.deliveryFee),total:num(x.total==null?num(x.price)+num(x.deliveryFee):x.total),rating:Number.isFinite(+x.rating)?Math.max(0,Math.min(5,+x.rating)):null,reviewCount:Number.isFinite(+x.reviewCount)?Math.max(0,Math.floor(+x.reviewCount)):null,monthlySales:Number.isFinite(+x.monthlySales)?Math.max(0,Math.floor(+x.monthlySales)):null,etaMinutes:Number.isFinite(+x.etaMinutes)?Math.max(0,Math.floor(+x.etaMinutes)):null,distanceKm:Number.isFinite(+x.distanceKm)?Math.max(0,+x.distanceKm):null,couponLabel:text(x.couponLabel,100),imageUrl:safeUrl(x.imageUrl,['https:'],800),emoji:text(x.emoji,4)||'🍱',quoteId:text(x.quoteId,160),quoteExpiresAt:+x.quoteExpiresAt||0,addressLabel:text(x.addressLabel,80),addressFingerprint:text(x.addressFingerprint,180),rawVersion:text(x.rawVersion,80),optionGroups:safeOptionGroups(x.optionGroups||x.options),optionsLoaded:x.optionsLoaded===true};
  }
  function normalizeSelectedOptions(offer,input){
    var source=input&&typeof input==='object'?input:{},out={};
    (offer.optionGroups||[]).forEach(function(g){var raw=source[g.id],ids=g.multiple?(Array.isArray(raw)?raw:[raw]).map(String):[String(Array.isArray(raw)?raw[0]:raw==null?'':raw)],allowed={},selectionCount=+(String(g.name||'').match(/(?:请选|请选择|任选)\s*(\d+)\s*份/)||[])[1]||0;g.choices.forEach(function(c){allowed[c.id]=1;});ids=ids.filter(function(id,i,a){return allowed[id]&&a.indexOf(id)===i;});if(g.required&&!ids.length)throw new Error('请选择'+g.name);if(selectionCount>1&&ids.length!==selectionCount)throw new Error(g.name+'需要准确选择'+selectionCount+'份');if(ids.length)out[g.id]=g.multiple?ids:ids[0];});
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
    var r=foodState();r.enabled=!!on;r.autoPay=false;
    S.food.results=[];S.food.cart=[];save();render();toast(r.enabled?'已切换为真实外卖；不会使用虚拟结果':'已关闭真实外卖，恢复虚拟外卖');setTimeout(openSettings,0);
    if(r.enabled)refreshCapabilities(false);
  }
  async function refreshCapabilities(show){
    var r=foodState();
    try{var cap=await request('capabilities',{},15000);r.lastCapability={ok:true,at:Date.now(),providers:Array.isArray(cap.providers)?cap.providers.map(String):[],payments:Array.isArray(cap.payments)?cap.payments.map(String):[],addressLabel:text(cap.addressLabel,80),addressConfirmation:cap.addressConfirmation!==false};if(r.lastCapability.addressLabel)r.addressLabel=r.lastCapability.addressLabel;r.autoPay=false;save();if(show)toast('淘宝闪购真实服务已连接');render();return true;}
    catch(e){r.lastCapability={ok:false,at:Date.now(),error:text(e.message,160)};save();if(show)toast(e.message||'连接失败');render();return false;}
  }
  function switchHtml(){
    var r=foodState(),cap=r.lastCapability,connected=cap&&cap.ok,sub=!r.enabled?'当前为虚拟外卖':connected?'已连接 '+((cap.providers||[]).map(providerText).join('、')||'真实服务'):'真实服务未连接';
    return '<button class="delivery-mode-pill '+(r.enabled?'real':'virtual')+'" onclick="deliveryOpenSettings()"><i></i><span>'+(r.enabled?'真实外卖':'虚拟外卖')+'</span><small>'+esc(sub)+'</small><b>›</b></button>';
  }
  function openSettings(){
    var r=foodState(),cap=r.lastCapability,connected=cap&&cap.ok,capText=connected?'淘宝闪购已连接 · 支付宝由本人确认':cap&&cap.error?'未连接：'+cap.error:'尚未检测真实服务',notice=r.lastRoleNotice,noticeHtml=notice&&notice.message?'<div class="delivery-notice"><b>最近系统提示</b><br>'+esc(notice.message)+'</div>':'';
    var prefRows=Object.keys(PREF_CONFIG).map(function(kind){var cfg=PREF_CONFIG[kind];return'<button class="delivery-role-row" onclick="deliveryOpenPreferences(\''+kind+'\')"><span>'+cfg.icon+'</span><span><b>'+cfg.title+'</b><small>'+esc(preferenceCategoryText(kind))+'</small></span><i>›</i></button>';}).join('');
    openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>DELIVERY CONTROL</small><h3>淘宝闪购真实外卖</h3></div><button onclick="closeModal()">×</button></div><div class="delivery-notice">只显示淘宝闪购真实返回的商家、商品、价格和平台状态；失败时不会用虚拟订单代替。</div>'+noticeHtml+'<label class="delivery-toggle"><span><b>开启真实外卖</b><small>开启后角色可自动搜索、换店、选规格并进入付款页</small></span><input type="checkbox" '+(r.enabled?'checked':'')+' onchange="deliverySetEnabled(this.checked)"><i></i></label><div class="delivery-notice"><b>付款方式：支付宝本人确认</b><br>搜索、换店、商品、真实规格、购物车和结算由角色自动完成；支付密码或生物识别只由你本人完成。</div><div class="delivery-section-title">我的外卖偏好</div>'+prefRows+'<button class="delivery-role-row" onclick="deliveryOpenSavedRoutes()"><span>📍</span><span><b>常用直达路线</b><small>同款优先直达；没有路线时自动进行一次受限搜索</small></span><i>›</i></button><div class="delivery-field"><label>真实服务状态</label><div><input value="'+esc(capText)+'" disabled><button onclick="deliveryRefreshCapabilities(true)" '+(!r.enabled?'disabled':'')+'>重新检测</button></div></div><div class="delivery-field"><label>当前收货地址</label><div><input value="'+esc(r.addressLabel||'尚未确认')+'" disabled><button onclick="deliveryConfirmAddress()" '+(!r.enabled||!connected||(cap&&cap.addressConfirmation===false)?'disabled':'')+'>本人确认</button></div><small>'+(cap&&cap.addressConfirmation===false?'当前真实外卖服务不支持地址确认':r.approvedAddressFingerprint?'已确认当前平台默认地址':'连接成功后，请在创建订单前确认平台默认地址')+'</small></div><div class="delivery-safety">角色优先使用常用直达路线；路线打烊或失效时会自动换店，并最多检查三家匹配门店。只有平台强制验证时才暂停，验证消失后继续原步骤；支付确认始终由你本人完成。</div></div>');
  }
  async function confirmAddress(){
    var r=foodState();if(!r.enabled||!connectorUrl()){toast('请先连接真实外卖服务');return;}if(r.lastCapability&&r.lastCapability.addressConfirmation===false){toast('当前真实外卖服务不支持地址确认');return;}
    try{var data=await request('confirm_address',{confirmedByUser:true},165000),fingerprint=text(data.addressFingerprint,180),label=text(data.addressLabel,80);if(!fingerprint)throw new Error('平台没有返回可验证的地址标识');r.approvedAddressFingerprint=fingerprint;if(label)r.addressLabel=label;save();toast('已确认当前收货地址');openSettings();}
    catch(e){toast(e.message||'收货地址确认失败');}
  }
  function openPreferences(kind){kind=PREF_CONFIG[kind]?kind:'milkTea';var cfg=PREF_CONFIG[kind],p=deliveryPreferences()[kind],fields=cfg.fields.map(function(field){return'<div class="delivery-field"><label>'+field[1]+'</label><input id="delivery_pref_'+kind+'_'+field[0]+'" value="'+esc(p[field[0]])+'" placeholder="'+esc(field[2])+'"></div>';}).join('');openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>'+cfg.eyebrow+' PREFERENCES</small><h3>'+cfg.title+'</h3></div><button onclick="deliveryOpenSettings()">‹</button></div><div class="delivery-notice">本次口头要求永远优先；只有你没说清的部分，角色才参考这里。角色获得自主决定权时，会结合全部四类偏好和自己的人设选择。</div>'+fields+'<button class="delivery-save" onclick="deliverySavePreferences(\''+kind+'\')">保存'+cfg.title+'</button></div>');}
  function savePreferences(kind){kind=PREF_CONFIG[kind]?kind:'milkTea';var p=deliveryPreferences()[kind];PREF_CONFIG[kind].fields.forEach(function(field){p[field[0]]=text((document.getElementById('delivery_pref_'+kind+'_'+field[0])||{}).value,300);});save();toast(PREF_CONFIG[kind].title+'已保存');openSettings();}
  async function openSavedRoutes(){
    openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>DIRECT ROUTES</small><h3>常用直达路线</h3></div><button onclick="deliveryOpenSettings()">‹</button></div><div class="delivery-empty-mini">正在读取角色可用的真实路线…</div></div>');
    try{var data=await request('saved_routes',{},15000),rows=Array.isArray(data&&data.routes)?data.routes:[],html=rows.map(function(row){var closed=row.closedUntil>Date.now();return'<div class="delivery-route-card '+(closed?'closed':'')+'"><b>'+esc(row.merchant||'已登记门店')+'</b><span>'+esc(row.itemName||row.query||'已登记商品')+'</span><small>'+(closed?'暂不可用：'+esc(row.closedReason||'门店休息'):'角色可直达并重新核对营业、价格和规格')+'</small></div>';}).join('');openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>DIRECT ROUTES</small><h3>常用直达路线</h3></div><button onclick="deliveryOpenSettings()">‹</button></div><div class="delivery-notice">这里保存成功点过的同款入口，下一次优先直达并重新核对营业、价格和规格；没有对应路线时，角色会自动进行一次受限搜索。</div><div class="delivery-route-list">'+(html||'<div class="delivery-empty-mini">还没有登记过可用路线</div>')+'</div></div>');}
    catch(e){openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>DIRECT ROUTES</small><h3>常用直达路线</h3></div><button onclick="deliveryOpenSettings()">‹</button></div><div class="delivery-notice">'+esc(e.message||'读取常用路线失败')+'</div></div>');}
  }

  async function realSearch(query,opt){
    query=text(query,120);if(!query)throw new Error('请输入要搜索的餐品或店铺');
    var r=foodState(),data=await request('search',{query:query,providers:['taobao_flash'],paymentPreference:['alipay'],roleId:opt&&opt.roleId||'',addressLabel:r.addressLabel||'',addressFingerprint:r.approvedAddressFingerprint||'',allowGlobalSearch:!!(opt&&opt.roleId&&r.roleGlobalSearch),limit:opt&&opt.roleId?3:4},165000);
    var offers=(Array.isArray(data)?data:data.offers||[]).map(safeOffer).filter(function(x){return x.offerId&&x.name&&x.total>0;});
    var r=foodState();if(data&&data.addressLabel)r.addressLabel=text(data.addressLabel,80);if(!offers.length)throw new Error('真实平台没有返回可下单商品');
    return offers;
  }
  async function loadOfferOptions(offer){
    if(offer.optionsLoaded)return offer;
    var data=await request('offer_options',{offerId:offer.offerId,quoteId:offer.quoteId},165000);
    offer.optionGroups=safeOptionGroups(data.optionGroups);offer.optionsLoaded=true;save();return offer;
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
    ctx=ctx||{};var selected=normalizeSelectedOptions(offer,ctx.selectedOptions),r=foodState(),pending=r.pendingCreates.find(function(x){return x.offerId===offer.offerId&&x.roleId===(ctx.roleId||'');}),requestId=pending&&pending.requestId||uid();if(!pending){r.pendingCreates.unshift({offerId:offer.offerId,roleId:ctx.roleId||'',requestId:requestId,at:Date.now()});r.pendingCreates=r.pendingCreates.slice(0,12);save();}var data=await request('create_order',{offerId:offer.offerId,quoteId:offer.quoteId,quantity:Math.max(1,Math.min(20,+ctx.quantity||1)),selectedOptions:selected,roleId:ctx.roleId||'',source:ctx.roleId?'role':'user',paymentPreference:['alipay'],clientRequestId:requestId},165000);
    var fallbackOptions=optionSummary(offer,selected),order={id:text(data.id||data.orderId,160)||uid(),remoteId:text(data.orderId||data.id,160),clientRequestId:requestId,provider:text(data.provider||offer.provider,40),merchant:text(data.merchant||offer.merchant,100),merchantId:text(data.merchantId||offer.merchantId,120),items:Array.isArray(data.items)?data.items.map(function(x){return{name:text(x.name,140),options:text(x.options||x.specification,240),quantity:Math.max(1,+x.quantity||1),price:num(x.price)};}):[{name:offer.name,options:fallbackOptions,quantity:Math.max(1,+ctx.quantity||1),price:offer.price}],total:num(data.total==null?offer.total:data.total),discount:num(data.discount),couponLabel:text(data.couponLabel,100),quotedTotal:num(offer.total),status:text(data.status,40)||'created',paymentMethod:text(data.paymentMethod,40),payUrl:safePayUrl(data.payUrl),payQrDataUrl:safePayQr(data.payQrDataUrl),addressLabel:text(data.addressLabel||offer.addressLabel,80),addressFingerprint:text(data.addressFingerprint||offer.addressFingerprint,180),imageUrl:safeUrl(data.imageUrl||offer.imageUrl,['https:'],800),etaMinutes:Number.isFinite(+data.etaMinutes)?Math.max(0,Math.floor(+data.etaMinutes)):(Number.isFinite(+offer.etaMinutes)?Math.max(0,Math.floor(+offer.etaMinutes)):null),risk:Array.isArray(data.risk)?data.risk.map(function(x){return text(x,80);}):[],roleId:ctx.roleId||'',source:ctx.roleId?'role':'user',createdAt:Date.now(),updatedAt:Date.now(),notifiedStatuses:[],real:true};
    r.pendingCreates=r.pendingCreates.filter(function(x){return x.requestId!==requestId;});S.food.orders.unshift(order);S.food.orders=S.food.orders.slice(0,80);save();return order;
  }
  async function payOrder(order){
    order.paymentAttemptId=order.paymentAttemptId||uid();save();
    var data=await request('pay_order',{orderId:order.remoteId,paymentPreference:['alipay'],automatic:false,roleId:order.roleId||'',clientRequestId:order.paymentAttemptId},165000);
    order.status=text(data.status,40)||'pending_payment';order.paymentMethod=text(data.paymentMethod,40);order.payUrl=safePayUrl(data.payUrl);order.payQrDataUrl=safePayQr(data.payQrDataUrl);order.pendingReason=text(data.reason,180);order.updatedAt=Date.now();
    syncRoleOrderCard(order);save();return order;
  }
  function openOptionPicker(offer){
    manualOptionOffer=offer;var groups=offer.optionGroups||[],body=groups.map(function(g,gi){var fields=g.multiple?g.choices.map(function(c){return '<label class="delivery-option-check"><input class="delivery-option-multi" data-group="'+gi+'" type="checkbox" value="'+esc(c.id)+'">'+esc(c.label)+(c.priceDelta?' +¥'+num(c.priceDelta).toFixed(2):'')+'</label>';}).join(''):'<select class="delivery-option-single" data-group="'+gi+'"><option value="">请选择</option>'+g.choices.map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.label)+(c.priceDelta?' +¥'+num(c.priceDelta).toFixed(2):'')+'</option>';}).join('')+'</select>';return '<div class="delivery-option-group"><b>'+esc(g.name)+(g.required?' *':'')+'</b>'+fields+'</div>';}).join('');openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>ORDER OPTIONS</small><h3>'+esc(offer.name)+'</h3></div><button onclick="closeModal()">×</button></div>'+body+'<label class="delivery-option-qty">数量<input id="delivery_option_qty" type="number" min="1" max="20" value="1"></label><button class="delivery-save" onclick="deliveryConfirmOptions()">按这些口味创建订单</button></div>');
  }
  function confirmOptions(){var offer=manualOptionOffer;if(!offer)return;var selected={};try{(offer.optionGroups||[]).forEach(function(g,gi){if(g.multiple){selected[g.id]=Array.from(document.querySelectorAll('.delivery-option-multi[data-group="'+gi+'"]:checked')).map(function(el){return el.value;});}else{var el=document.querySelector('.delivery-option-single[data-group="'+gi+'"]');selected[g.id]=el&&el.value||'';}});selected=normalizeSelectedOptions(offer,selected);}catch(e){toast(e.message);return;}var qty=Math.max(1,Math.min(20,+((document.getElementById('delivery_option_qty')||{}).value)||1));manualOptionOffer=null;closeModal();manualOrder(offer,{selectedOptions:selected,quantity:qty});}
  async function manualOrder(offer,opt){
    if(!enabled())return oldFoodBuy.apply(this,arguments);if(!offer||!offer.offerId)return;
    if(!opt&&!offer.optionsLoaded){_foodBusy=true;render();try{await loadOfferOptions(offer);}catch(e){toast(e.message||'读取真实规格失败');return;}finally{_foodBusy=false;render();}}
    if((offer.optionGroups||[]).length&&!opt){openOptionPicker(offer);return;}
    _foodBusy=true;render();try{var order=await createOrder(offer,opt||{});await payOrder(order);S.food.cart=S.food.cart.filter(function(x){return x.offerId!==offer.offerId;});save();openOrders();if(order.status==='pending_payment')toast('真实订单已创建，请完成付款');else toast('真实订单状态：'+statusText(order.status));}catch(e){toast(e.message||'真实订单创建失败');}finally{_foodBusy=false;render();}
  }
  function buy(i){if(!enabled())return oldFoodBuy.apply(this,arguments);return manualOrder(S.food.results[i]);}
  function openCart(){
    if(!enabled())return oldOpenFoodCart.apply(this,arguments);var cart=S.food.cart||[],total=cart.reduce(function(s,p){return s+num(p.total);},0);
    openModal('<h3>真实外卖单</h3><div class="delivery-cart-list">'+(cart.length?cart.map(function(p,i){return '<div class="bill"><div>'+esc(p.name)+'<small>'+esc(p.merchant)+' · '+providerText(p.provider)+'</small></div><div>¥'+num(p.total).toFixed(2)+' <span onclick="S.food.cart.splice('+i+',1);save();openFoodCart()" class="delivery-remove">✕</span></div></div>';}).join(''):'<div class="empty">外卖单空空的</div>')+'</div>'+(cart.length?'<div class="delivery-cart-total">合计 ¥'+total.toFixed(2)+'</div><div class="delivery-notice">为避免跨店、运费和优惠变化，真实订单需要逐店确认。将从第一项开始创建订单。</div><button class="btn p" onclick="deliveryCheckoutCart()">创建真实订单</button>':'')+'<button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>');
  }
  async function checkoutCart(){var item=(S.food.cart||[])[0];if(!item)return;closeModal();await manualOrder(item);}
  function orderItems(order){return (order.items||[]).map(function(x){return esc(x.name)+(x.options?'（'+esc(x.options)+'）':'')+(x.quantity>1?' ×'+x.quantity:'');}).join('、')||'外卖商品';}
  function orderEtaText(order,withClock){var minutes=Number(order&&order.etaMinutes);if(!Number.isFinite(minutes)||minutes<=0)return'平台暂未给出预计送达时间';minutes=Math.floor(minutes);if(!withClock)return'约'+minutes+'分钟送到';var base=+order.createdAt||Date.now(),d=new Date(base+minutes*60000),clock=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');return'约'+minutes+'分钟 · 预计'+clock+'送到';}
  function orderCardSnapshot(order){return{id:text(order.id,160),remoteId:text(order.remoteId,160),provider:text(order.provider,40),merchant:text(order.merchant,100),items:(Array.isArray(order.items)?order.items:[]).slice(0,20).map(function(x){return{name:text(x.name,140),options:text(x.options,240),quantity:Math.max(1,+x.quantity||1),price:num(x.price)};}),total:num(order.total),discount:num(order.discount),couponLabel:text(order.couponLabel,100),status:text(order.status,40)||'created',paymentMethod:text(order.paymentMethod,40),addressLabel:text(order.addressLabel,80),imageUrl:safeUrl(order.imageUrl,['https:'],800),etaMinutes:Number.isFinite(+order.etaMinutes)?Math.max(0,Math.floor(+order.etaMinutes)):null,createdAt:+order.createdAt||Date.now(),updatedAt:+order.updatedAt||Date.now()};}
  function syncRoleOrderCard(order){if(!order||!order.roleId||typeof msgs!=='function')return null;var list=msgs(order.roleId),card=list.find(function(m){return m&&m.type==='deliveryorder'&&(m.orderId===order.id||m.remoteId&&m.remoteId===order.remoteId);});if(card){card.order=orderCardSnapshot(order);card.orderId=order.id;card.remoteId=order.remoteId;return card;}return null;}
  function pushRoleOrderCard(c,order){if(!c||!order||typeof msgs!=='function')return null;var card=syncRoleOrderCard(order);if(card)return card;card={role:'assistant',type:'deliveryorder',orderId:order.id,remoteId:order.remoteId,order:orderCardSnapshot(order),id:uid(),time:Date.now()};msgs(c.id).push(card);if(typeof notifyIncoming==='function')notifyIncoming(c,card);save();if(typeof refreshChatMessages==='function')refreshChatMessages(c.id);return card;}
  function chatOrderData(cid,message){var snap=message&&message.order&&typeof message.order==='object'?message.order:{},live=(S.food.orders||[]).find(function(o){return o&&((message.orderId&&o.id===message.orderId)||(message.remoteId&&o.remoteId===message.remoteId));});return Object.assign({},snap,live||{});}
  function chatOrderCardHTML(c,m){var o=chatOrderData(c.id,m),items=Array.isArray(o.items)?o.items:[],names=items.map(function(x){return text(x.name,70);}).filter(Boolean).join('、')||'真实外卖',specs=items.map(function(x){return text(x.options,100);}).filter(Boolean).join('；')||'平台标准规格',img=safeUrl(o.imageUrl,['https:'],800),thumb=img?'<img src="'+esc(img)+'" alt="'+esc(names)+'" loading="lazy" onerror="this.parentNode.classList.add(\'fallback\');this.remove()">':'',eta=orderEtaText(o,false),state=text(o.status,40),onclick="event.stopPropagation();deliveryOpenChatOrder('"+String(c.id).replace(/'/g,'')+"','"+String(m.id).replace(/'/g,'')+"')";return '<article class="wx-real-delivery-card state-'+esc(state)+'" role="button" tabindex="0" aria-label="查看真实外卖订单详情" onclick="'+onclick+'" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();'+onclick+'}"><div class="wx-real-delivery-hero"><div class="wx-real-delivery-thumb '+(img?'':'fallback')+'">'+thumb+'<span>🥤</span></div><div class="wx-real-delivery-copy"><small>'+esc(providerText(o.provider))+' · REAL DELIVERY</small><h4>'+esc(o.merchant||'外卖商家')+'</h4><p>'+esc(names)+'</p></div></div><div class="wx-real-delivery-spec">'+esc(specs)+'</div><div class="wx-real-delivery-meta"><b>¥'+num(o.total).toFixed(2)+'</b><span>'+esc(eta)+'</span></div><footer><span>'+esc(statusText(state))+'</span><i>查看详情 ›</i></footer></article>';
  }
  function openChatOrder(cid,mid){var message=(msgs(cid)||[]).find(function(m){return m&&m.id===mid&&m.type==='deliveryorder';});if(!message)return;var o=chatOrderData(cid,message),items=Array.isArray(o.items)?o.items:[],img=safeUrl(o.imageUrl,['https:'],800),live=(S.food.orders||[]).find(function(x){return x&&((message.orderId&&x.id===message.orderId)||(message.remoteId&&x.remoteId===message.remoteId));}),qr=live&&safePayQr(live.payQrDataUrl),pay=live&&safePayUrl(live.payUrl),pending=o.status==='pending_payment'||o.status==='created',itemHtml=items.map(function(x){return '<div class="wx-real-delivery-detail-item"><div><b>'+esc(x.name||'外卖商品')+'</b><small>'+esc(x.options||'平台标准规格')+(x.quantity>1?' · ×'+Math.max(1,+x.quantity||1):'')+'</small></div>'+(num(x.price)>0?'<span>¥'+num(x.price).toFixed(2)+'</span>':'')+'</div>';}).join(''),media=img?'<img class="wx-real-delivery-detail-image" src="'+esc(img)+'" alt="真实商品图片">':'<div class="wx-real-delivery-detail-placeholder">🥤</div>',payment='';if(pending){payment=qr?'<div class="wx-real-delivery-qr"><img src="'+qr+'" alt="支付宝官方付款二维码"><b>支付宝官方付款二维码</b><small>可以截图后，在支付宝“扫一扫”中从相册选择</small></div>':'';if(pay&&live)payment+='<button class="delivery-save" onclick="deliveryLaunchPay(\''+String(live.id).replace(/'/g,'')+'\')">直接打开支付宝付款</button>';else if(live&&!qr)payment+='<button class="delivery-save" onclick="deliveryOpenPay(\''+String(live.id).replace(/'/g,'')+'\')">获取官方付款入口</button>';if(!pay&&!qr)payment+='<div class="delivery-notice">平台没有返回可外发链接时，需要在这台电脑的受保护淘宝闪购窗口完成付款。</div>';}openModal('<div class="delivery-settings wx-real-delivery-detail"><div class="delivery-settings-head"><div><small>REAL ORDER DETAIL</small><h3>真实外卖订单</h3></div><button onclick="closeModal()">×</button></div>'+media+'<div class="wx-real-delivery-detail-shop"><small>'+esc(providerText(o.provider))+'</small><h4>'+esc(o.merchant||'外卖商家')+'</h4></div><div class="wx-real-delivery-detail-list">'+(itemHtml||'<div class="empty">平台没有返回商品明细</div>')+'</div><div class="wx-real-delivery-detail-facts"><span><small>平台状态</small><b>'+esc(statusText(o.status))+'</b></span><span><small>预计送达</small><b>'+esc(orderEtaText(o,true))+'</b></span><span><small>真实金额</small><b>¥'+num(o.total).toFixed(2)+'</b></span></div>'+(o.couponLabel?'<div class="delivery-notice">平台优惠：'+esc(o.couponLabel)+(num(o.discount)>0?' · 已优惠 ¥'+num(o.discount).toFixed(2):'')+'</div>':'')+payment+'</div>');}
  function openOrders(){
    if(!enabled())return oldOpenFoodOrders.apply(this,arguments);var rows=(S.food.orders||[]).filter(function(x){return x&&x.real;});
    openModal('<div class="delivery-orders"><div class="delivery-settings-head"><div><small>PLATFORM ORDER STATUS</small><h3>淘宝闪购订单</h3></div><button onclick="closeModal()">×</button></div><button class="delivery-refresh" onclick="deliveryPollOrders(true)">刷新平台状态</button><div class="delivery-order-list">'+(rows.length?rows.map(function(o){var pending=o.status==='pending_payment',active=!TERMINAL[o.status],progress=['created','pending_payment','paid','merchant_confirmed','preparing','courier_assigned','picked_up','delivering','delivered'].indexOf(o.status);return '<article class="delivery-order-card"><header><span>'+providerText(o.provider)+'</span><b>'+statusText(o.status)+'</b></header><h4>'+esc(o.merchant||'外卖商家')+'</h4><p>'+orderItems(o)+'</p><div class="delivery-progress"><i style="width:'+Math.max(3,Math.min(100,(progress<0?0:progress)/8*100))+'%"></i></div><div class="delivery-order-meta"><span>¥'+num(o.total).toFixed(2)+'</span><span>'+esc(o.addressLabel||'平台默认地址')+'</span></div>'+(o.pendingReason?'<small class="delivery-reason">'+esc(o.pendingReason)+'</small>':'')+'<footer>'+(pending?'<button onclick="deliveryOpenPay(\''+o.id+'\')">'+((o.payUrl||o.payQrDataUrl)?'查看付款码':'获取付款方式')+'</button>':'')+(active?'<button onclick="deliveryPollOrders(true)">刷新平台状态</button>':'')+'</footer></article>';}).join(''):'<div class="empty">还没有淘宝闪购订单</div>')+'</div></div>');
  }
  function showPayment(o){var qr=o.payQrDataUrl?'<img class="delivery-pay-qr" src="'+o.payQrDataUrl+'" alt="官方付款二维码">':'',button=o.payUrl?'<button class="delivery-save" onclick="deliveryLaunchPay(\''+o.id+'\')">在本机打开'+paymentText(o.paymentMethod)+'</button>':'',discount=o.discount>0?'<small>平台结算页已自动优惠 ¥'+num(o.discount).toFixed(2)+(o.couponLabel?' · '+esc(o.couponLabel):'')+'</small>':'';openModal('<div class="delivery-settings delivery-payment"><div class="delivery-settings-head"><div><small>OFFICIAL CHECKOUT</small><h3>支付宝待付款订单</h3></div><button onclick="deliveryOpenOrders()">×</button></div><div class="delivery-notice">已按你的要求选择淘宝闪购真实商品和平台真实规格；优惠只显示结算页已经确认的金额，付款由你本人完成。</div><h4>'+esc(o.merchant||'外卖商家')+'</h4><p>'+orderItems(o)+'</p><b class="delivery-pay-total">¥'+num(o.total).toFixed(2)+'</b>'+discount+qr+button+'<button class="btn g" onclick="deliveryOpenOrders()">稍后付款</button></div>');}
  function launchPay(id){var o=(S.food.orders||[]).find(function(x){return x.id===id;});if(!o||!o.payUrl)return;window.open(o.payUrl,'_blank','noopener');toast('已打开官方付款页面；付款后刷新订单状态');}
  async function openPay(id){var o=(S.food.orders||[]).find(function(x){return x.id===id;});if(!o)return;try{if(!o.payUrl&&!o.payQrDataUrl&&o.status!=='paid')await payOrder(o);if(o.status==='paid')toast('平台已确认付款成功');else if(o.payUrl||o.payQrDataUrl)showPayment(o);else{toast(o.pendingReason||'平台暂未返回付款链接');openOrders();}}catch(e){toast(e.message||'获取付款方式失败');}}
  function mergeStatus(order,data){var before=order.status,next=text(data.status,40);if(next&&STATUS_TEXT[next]){var beforeRank=STATUS_RANK[before],nextRank=STATUS_RANK[next],allowed=!TERMINAL[before]&&(TERMINAL[next]||beforeRank==null||nextRank==null||nextRank>=beforeRank);if(allowed)order.status=next;}['paymentMethod','addressLabel','addressFingerprint'].forEach(function(k){if(data[k]!=null)order[k]=text(data[k],180);});if(data.payUrl!=null)order.payUrl=safePayUrl(data.payUrl);if(data.payQrDataUrl!=null)order.payQrDataUrl=safePayQr(data.payQrDataUrl);if(data.total!=null)order.total=num(data.total);order.updatedAt=Date.now();syncRoleOrderCard(order);return before!==order.status?before:'';}
  function notifyStatus(order,before){
    if(!order.roleId||!before||order.notifiedStatuses.includes(order.status))return;var c=getC(order.roleId);if(!c||c.blocked)return;order.notifiedStatuses.push(order.status);save();
    var fact='[真实外卖订单状态更新]\n你亲自创建的真实外卖订单现在由平台确认处于「'+statusText(order.status)+'」。商家：'+(order.merchant||'')+'；餐品：'+(order.items||[]).map(function(x){return x.name;}).join('、')+'；实付/待付金额：¥'+num(order.total).toFixed(2)+'。这是平台刚返回的事实。请按你自己的完整人设、当前关系和说话习惯，自主决定怎样提醒'+S.me.name+'；不要照抄提示，不要添加骑手位置、送达时间或其他未提供事实。若只是中间小变化且你本人觉得不必打扰，也可以不发。';
    scheduleReply(c.id,fact);
  }
  async function pollOrders(show){
    if(pollBusy||!enabled()||!connectorUrl())return false;var rows=(S.food.orders||[]).filter(function(x){return x.real&&x.remoteId&&!TERMINAL[x.status];});if(!rows.length){if(show)toast('没有需要刷新的真实订单');return false;}pollBusy=true;try{for(var i=0;i<rows.length;i++){try{var data=await request('order_status',{orderId:rows[i].remoteId},18000),before=mergeStatus(rows[i],data);if(rows[i].status==='paid'&&rows[i].addressFingerprint&&!foodState().approvedAddressFingerprint)foodState().approvedAddressFingerprint=rows[i].addressFingerprint;notifyStatus(rows[i],before);}catch(e){rows[i].lastSyncError=text(e.message,140);if(/真实订单不存在/.test(rows[i].lastSyncError)){rows[i].status='failed';rows[i].pendingReason='本机外卖服务重启后未保留这笔订单，已停止自动刷新';rows[i].updatedAt=Date.now();}}}save();if(show){openOrders();toast('已按平台回执刷新订单');}else if(cur&&cur().p==='food')render();return true;}finally{pollBusy=false;}}
  function roleRequestMessageText(m){try{return text((typeof msgToText==='function'&&msgToText(m))||m&&m.content||m&&m.text,240);}catch(_){return text(m&&m.content||m&&m.text,240);}}
  function roleRequestIntent(c,searchQuery,previousAttempt){
    var cutoff=previousAttempt&&+previousAttempt.endedAt||0,now=Date.now(),all=typeof msgs==='function'?(msgs(c.id)||[]):[],rows=all.filter(function(m){var at=+m.time||+m.ts||0;return m&&m.role==='user'&&!m._silent&&(!cutoff||at>cutoff)&&(!at||now-at<30*60000);}).slice(-10),messages=rows.map(roleRequestMessageText).filter(Boolean),joined=messages.join('\n'),autonomous=/(?:随便(?:点|挑|选|买)|你(?:自己)?(?:决定|挑|选|看着(?:点|买|办))|按你(?:自己)?想的|你来定|都可以|都行|都喜欢|听你的)/.test(joined);
    return{searchQuery:text(searchQuery,120),userMessages:messages,autonomous:autonomous};
  }
  function roleIntentPrompt(intent){return '角色生成的检索词：'+intent.searchQuery+'\n真实用户消息（只有这里才可能产生硬条件）：\n'+(intent.userMessages.join('\n')||'（没有可见用户原话）')+'\n本轮是否获得自主选择授权：'+(intent.autonomous?'是。用户允许角色自行决定，除过敏、忌口等安全限制外，不得把角色检索词、长期口味偏好或此前追问出的选项反当成用户硬条件。':'否。只把上面真实用户消息中明确说出的要求视为硬条件。');}
  async function chooseOffer(c,query,offers,intent){
    var compact=offers.map(function(x){return{id:x.offerId,merchant:x.merchant,name:x.name,total:x.total,rating:x.rating,reviewCount:x.reviewCount,coupon:x.couponLabel,etaMinutes:x.etaMinutes};});
    var raw=await chatAPI([{role:'system',content:'你是「'+c.name+'」本人，只做淘宝闪购候选选择，不要对用户说话。注意：角色生成的检索词只是找商品用的，不是用户原话，不能自行升级为硬条件。用户本次明确说出的品牌/店名和具体商品是硬条件：候选没有完全对应项时必须返回 matched:false，绝不能用相近品牌、别家门店或别的商品替代。但若本轮已获得“随便点、你选、都可以”等自主选择授权，除过敏与忌口外，不存在品牌、商品、口味或价格硬条件；你应直接按自己的人设从真实候选中选一项，不得继续要求用户决定。用户没有明确指定的部分，才参考全部长期外卖偏好、你的人设、真实价格、评价、优惠和配送信息。只返回严格 JSON：{"matched":true,"offerId":"候选id","reason":""}；不能满足时返回 {"matched":false,"offerId":"","reason":"缺少的真实品牌或商品"}。只能使用候选真实 id。'},{role:'user',content:roleIntentPrompt(intent)+'\n全部长期外卖偏好（非硬条件；过敏和忌口除外）：\n'+preferenceText()+'\n淘宝闪购真实候选：'+JSON.stringify(compact)}],{max:260,temp:.1});
    var obj=null;try{obj=JSON.parse(String(raw||'').replace(/^```(?:json)?|```$/g,'').trim());}catch(_){}if(!obj||obj.matched!==true)throw new Error(text(obj&&obj.reason,140)||'淘宝闪购候选没有严格匹配本次品牌或饮品要求');var chosen=offers.find(function(x){return x.offerId===obj.offerId;});if(!chosen)throw new Error('角色没有从真实候选中完成有效选择');return chosen;
  }
  async function chooseOptions(c,query,offer,intent){
    var groups=(offer.optionGroups||[]).map(function(g){return{id:g.id,name:g.name,required:g.required,multiple:g.multiple,choices:g.choices.map(function(x){return{id:x.id,label:x.label,priceDelta:x.priceDelta};})};});
    if(!groups.length)return{quantity:1,selectedOptions:{}};
    var raw=await chatAPI([{role:'system',content:'你是「'+c.name+'」本人，只做淘宝闪购真实规格选择，不要对用户说话。注意：角色生成的检索词不是用户原话。用户本次明确说出的杯型、份量、糖度、冰度、温度、口味、辣度、搭配和加料都是硬条件；真实选项缺少任意一项时必须返回 matched:false，绝不能擅自改规格或用相近选项替代。但若本轮已获得“随便点、你选、都可以”等自主选择授权，除过敏与忌口外，上述规格都由你按人设和可用选项自主决定，不得把角色检索词反当成硬条件，也不得因软偏好不完全匹配而追问。用户本轮没有明确说明的规格，后台保存的长期偏好就是默认选择：平台有对应真实选项时优先采用；没有完全同名选项时它仍只是软偏好。未获得自主选择授权时，如果默认偏好或你本人真正想选的温度、糖度等在平台没有对应项，并且换成现有选项会明显改变选择，可以返回 matched:false 让系统暂停询问；尤其是后台偏好或你本轮真正想选热饮、但该商品只有冰饮或冷饮时，必须返回 matched:false，不能偷偷改成冷饮。获得自主授权时则必须按人设从真实可用选项中直接选择。不喜欢、忌口和过敏项必须避开。每个 required 组必须选择；名称含“请选择N份”的组必须准确返回N个不同的真实 id；只能使用真实 id。matched:false 的 reason 必须具体写出缺少哪一项，并列出平台现有的最接近选项，不能把“已选、价格计算中、请选择N份、选规格”等平台提示文字当成真实选项。只返回严格 JSON：{"matched":true,"quantity":1,"selectedOptions":{"组选项id":"选择id"},"reason":""}；多选组用数组；不能满足时返回 {"matched":false,"quantity":1,"selectedOptions":{},"reason":"缺少的规格及现有选项"}。'},{role:'user',content:roleIntentPrompt(intent)+'\n全部长期外卖偏好（本轮未明确的规格按这里默认；过敏和忌口必须遵守）：\n'+preferenceText()+'\n已严格匹配的真实商品：'+offer.merchant+' / '+offer.name+'\n平台真实规格：'+JSON.stringify(groups)}],{max:420,temp:.1});
    var obj=null;try{obj=JSON.parse(String(raw||'').replace(/^```(?:json)?|```$/g,'').trim());}catch(_){}if(!obj||obj.matched!==true)throw new Error(text(obj&&obj.reason,140)||'淘宝闪购真实规格不能完整满足本次要求');return{quantity:Math.max(1,Math.min(20,+obj.quantity||1)),selectedOptions:normalizeSelectedOptions(offer,obj.selectedOptions)};
  }
  function roleSystemNotice(message,kind){var r=foodState(),msg=text(message,180),visible=msg;if(kind==='error'&&msg.length>72)visible='真实外卖未完成：平台规格未能安全确认，未下单；详细原因已保留在外卖设置。';r.lastRoleNotice={message:msg,kind:text(kind,20)||'info',at:Date.now()};if(kind==='error')r.lastError=msg;save();if(visible)toast(visible);}

  async function chooseOfferWithOptions(c,query,offers,intent){
    var remaining=(offers||[]).slice(),lastError=null,lastOffer=null;
    for(var attempt=0;attempt<3&&remaining.length;attempt++){
      var offer=await chooseOffer(c,query,remaining,intent);
      try{await loadOfferOptions(offer);var choice=await chooseOptions(c,query,offer,intent);return{offer:offer,choice:choice};}
      catch(e){lastError=e;lastOffer=offer;var msg=text(e&&e.message,180);if(/验证|登录|地址|网络|超时|服务|报价|购物车|打烊|休息|暂停营业/.test(msg))throw e;remaining=remaining.filter(function(x){return x.offerId!==offer.offerId;});}
    }
    var failure=lastError||new Error('真实候选商品没有可确认的规格');if(lastOffer)failure.deliveryClarification={query:query,offer:safeOffer(lastOffer),userMessages:(intent.userMessages||[]).slice(-10),reason:text(failure.message,180)};throw failure;
  }
  function clarificationOptions(offer){return(offer.optionGroups||[]).map(function(g){return g.name+'：'+g.choices.map(function(c){return c.label;}).join('、');}).join('；');}
  function requestRoleClarification(c,detail){
    var r=foodState(),offer=detail&&detail.offer;if(!c||!offer)return false;
    r.roleClarifications[c.id]={query:text(detail.query,120),offer:safeOffer(offer),userMessages:(detail.userMessages||[]).map(function(x){return text(x,240);}).filter(Boolean).slice(-10),reason:text(detail.reason,180),at:Date.now()};
    roleSystemNotice('真实外卖已暂停：需要你确认平台可选规格后再继续，尚未加购或下单。','info');save();
    if(!c.blocked){var fact='[系统：这次真实外卖已安全暂停，尚未加购、下单或付款。当前商品：'+offer.merchant+' / '+offer.name+'。平台当前真实可选规格：'+clarificationOptions(offer)+'。未能继续的真实原因：'+text(detail.reason,160)+'。请严格按你自己的完整人设和说话习惯，只向'+S.me.name+'自然说明必要事实并问一个最必要的澄清问题；句式由你自己决定，不要照抄或复述技术错误，不要声称已经选好或下单。如果你想选热饮而当前商品没有热饮，只需自然问是否换一种，不要强迫对方接受冷饮。对方回答后系统会继续同一轮；若对方说出另一种商品，系统会放弃当前商品并重新搜索一次。]';scheduleReply(c.id,fact);}return true;
  }
  function resultReply(c,order,error,failureKind){
    if(!c)return;var fact='';
    if(order)pushRoleOrderCard(c,order);
    if(error){
      roleSystemNotice((order?'外卖流程已生成订单卡片，但付款入口未完成：':'真实外卖未完成：')+text(error,150),'error');
      if(failureKind==='shop_closed'&&!c.blocked){fact='[系统：这次真实外卖没有下单。平台刚确认，与本次要求匹配的已登记门店目前全部打烊或休息中。'+S.me.name+'明确希望你不要让TA一直等；请按你自己的完整人设和当前关系，自然告诉TA这家或这些门店已经打烊了，并自主决定是询问换一种、改天再点，还是就此结束。只说你确实知道的营业事实，不要复述技术提示，不要声称已下单、已付款或已经找到别家。]';scheduleReply(c.id,fact);}
      return;
    }
    roleSystemNotice('真实外卖订单已创建，等待本人确认付款','success');
    if(c.blocked)return;
    fact='[系统：真实外卖订单卡片已经显示。当前真实状态：'+statusText(order.status)+'。只按你自己的说话习惯自然说一句让对方查看卡片，不要复述本条提示、订单字段或任何未确认事实。]';
    scheduleReply(c.id,fact);
  }
  async function roleRequest(cid,query){
    var c=getC(cid);if(!c)return false;if(!enabled()){return false;}var r=foodState();
    if(roleRequests[cid])return true;
    if(!connectorUrl()){resultReply(c,null,'还没有连接真实外卖服务');return true;}
    var clarification=r.roleClarifications[cid]||null,changeProduct=clarification&&/^(?:换品|重新搜索)\s*[:：|]/.test(query||'');if(changeProduct){query=text(String(query).replace(/^(?:换品|重新搜索)\s*[:：|]\s*/,''),120);delete r.roleClarifications[cid];clarification=null;}else if(clarification)query=clarification.query||query;
    if(!query){resultReply(c,null,'没有提供可搜索的餐品或店铺');return true;}
    if((S.food.orders||[]).some(function(x){return x.real&&x.roleId===cid&&Date.now()-(+x.createdAt||0)<20*60000&&!TERMINAL[x.status];})){resultReply(c,null,'20分钟内已有一笔角色真实外卖订单仍在处理，为避免重复没有再下单');return true;}
    var previousAttempt=r.roleAttempts[cid],intent=roleRequestIntent(c,query,previousAttempt);if(clarification){intent.userMessages=(clarification.userMessages||[]).concat(intent.userMessages||[]).slice(-12);intent.autonomous=/(?:随便(?:点|挑|选|买)|你(?:自己)?(?:决定|挑|选|看着(?:点|买|办))|按你(?:自己)?想的|你来定|都可以|都行|都喜欢|听你的)/.test((intent.userMessages||[]).join('\n'));}var attempt={query:query,userMessages:intent.userMessages,autonomous:intent.autonomous,startedAt:Date.now(),endedAt:0,status:'running',error:''};roleRequests[cid]=attempt;r.roleAttempts[cid]=attempt;save();
    var order=null;try{var picked;if(clarification&&clarification.offer&&clarification.offer.quoteExpiresAt>Date.now()+5000){var resumedOffer=safeOffer(clarification.offer),resumedChoice=await chooseOptions(c,query,resumedOffer,intent);picked={offer:resumedOffer,choice:resumedChoice};}else{var offers=await realSearch(query,{roleId:cid});picked=await chooseOfferWithOptions(c,query,offers,intent);}var offer=picked.offer,choice=picked.choice;delete r.roleClarifications[cid];order=await createOrder(offer,{roleId:cid,quantity:choice.quantity,selectedOptions:choice.selectedOptions});pushRoleOrderCard(c,order);await payOrder(order);attempt.status='completed';attempt.endedAt=Date.now();save();resultReply(c,order,'');return true;}
    catch(e){attempt.status='failed';attempt.endedAt=Date.now();attempt.error=text(e.message||'真实外卖操作失败',180);attempt.failureKind=/打烊|休息中|门店休息|暂停营业|不在营业时间/.test(attempt.error)?'shop_closed':'';if(e&&e.deliveryClarification){attempt.status='awaiting_clarification';save();requestRoleClarification(c,e.deliveryClarification);return true;}if(clarification&&!/验证|登录|地址|网络|超时|服务|报价|购物车|打烊|休息|暂停营业/.test(attempt.error)){clarification.reason=attempt.error;clarification.at=Date.now();r.roleClarifications[cid]=clarification;attempt.status='awaiting_clarification';save();requestRoleClarification(c,clarification);return true;}delete r.roleClarifications[cid];save();resultReply(c,order,attempt.error,attempt.failureKind);return true;}
    finally{delete roleRequests[cid];}
  }
  function rolePreludeAllowed(line){line=text(line,160);if(!line||/已经|订单|收银台|付款|支付|骑手|接单|配送|送到|优惠券|实付|待付|下单|点好|买好|订好|付好/.test(line))return false;return /等|稍等|等我|我来|我去|我先|给我一下|看看|找找|挑挑|选选|别急/.test(line);}
  function rolePrompt(c){
    var r=foodState(),attempt=c&&r.roleAttempts[c.id],lastUser=c&&(msgs(c.id)||[]).filter(function(m){return m&&m.role==='user'&&!m._silent;}).slice(-1)[0],lastUserAt=lastUser&&(+lastUser.time||+lastUser.ts||0)||0;
    if(!r.enabled)return '\n\n# 外卖能力\n当前真实外卖未开启。[点外卖|餐品名|价格] 只会创建虚拟小手机里的剧情外卖，不能把它说成淘宝闪购、美团、微信支付、支付宝或现实订单。';
    if(c&&r.roleClarifications[c.id])return '\n\n# 真实外卖等待规格确认\n上一轮真实外卖因为平台规格无法可靠判断而安全暂停，尚未加购、下单或付款。你已经或将要按自己的人设向'+S.me.name+'问一个必要问题。若对方这次明确回答了当前商品的选项、放宽要求，或说“都可以/你选”，先用你自己的语气简短表示会继续，紧接着单独输出 [真实外卖|继续确认规格]；系统会沿用同一商品和真实选项继续。若对方明确改要另一种商品或品牌，则先按你自己的口吻自然回应，再单独输出 [真实外卖|换品:你根据对方新回答确定的具体搜索词]，系统会放弃当前候选并重新搜索一次。若回答仍不明确，只自然追问一次，不要输出外卖标签。所有可见句式都由你按完整人设生成，不得使用固定客服话术；绝不能声称已经选好、下单或付款。其他普通聊天照常。';
    if(c&&(roleRequests[c.id]||attempt&&attempt.status==='running'&&!attempt.endedAt))return '\n\n# 真实外卖当前状态\n你刚才启动的真实外卖仍在同一轮搜索或下单中。绝对不要再次说“等一下/我再找找”，不要再次输出 [真实外卖|...] 或 [点外卖|...]，也不要重启操作；等待这一轮返回真实结果。其他普通聊天照常。';
    if(attempt&&attempt.endedAt&&lastUserAt<=attempt.endedAt){if(attempt.failureKind==='shop_closed')return '\n\n# 真实外卖门店打烊事实\n刚才平台真实确认本次匹配的已登记门店全部打烊或休息中。当前若收到系统给出的打烊事实，你可以且只需按自己的人设自然告诉'+S.me.name+'一次，并自主询问是否换一种或改天；不要复述技术错误，不要再次搜索或输出外卖标签，也绝不能声称已经下单、付款或找到可用门店。其他普通聊天照常。';return '\n\n# 真实外卖本轮已结束\n刚才那一轮真实外卖已经'+(attempt.status==='completed'?'完成':'失败或超时')+'。在'+S.me.name+'发来新的明确请求之前，绝对不要再次说“等一下/我再找找”，不要输出 [真实外卖|...] 或 [点外卖|...]，不要自动重试。'+(attempt.status==='completed'?'订单卡片已负责展示真实结果，不要复述内部操作提示。':'失败原因已经由系统在外卖控制页提示；你不要把失败原因、内部提示或“操作结果”发进聊天，也不用主动补发失败说明。')+'其他普通聊天照常。';}
    return '\n\n# 真实外卖能力与硬边界\n真实外卖已开启，但你始终保留自己的判断和意愿：可以按你的人设、关系、情绪与当下处境同意，也有权直接拒绝给'+S.me.name+'点单。拒绝时只需用你自己的口吻正常说明，不要输出任何外卖标签，也不会启动真实订单。你可以按本人判断主动使用，也可以在'+S.me.name+'明确让你点某样东西时搜索。若对方只是泛泛说“想喝奶茶”“想吃点东西”，还没说明具体品牌/门店或具体商品，也没有明确让你自行决定，就必须先按你自己的语气自然问清楚并等待回答；这一轮绝不能输出真实外卖标签。若对方明确说“随便点、你选、都可以、都喜欢、按你想的”等授权你自行决定，这就已经是完整答案：不要再追问品牌、商品、口味、糖度、温度或规格，直接结合奶茶、主食、咖啡和 KFC 的全部已保存偏好、你的人设、关系和当下处境，自主选择类别、品牌、具体商品及可用规格；偏好只供参考，过敏和忌口仍必须遵守。只有你自己同意，并且对方已经说清品牌/门店与商品，或者明确让你自行决定，才可以开始真实搜索。\n真正决定尝试时，必须先发一句符合你本人语气的简短可见消息，让'+S.me.name+'知道你正在找，例如自然表达“等我一下”“我去看看”；紧接着再单独输出一行 [真实外卖|具体搜索词]。搜索词应写你真正决定搜索的品牌/门店和具体商品；只有用户亲口明确提出的糖度、冰度、温度、口味、辣度、份量或加料才是硬条件，角色自己为了搜索补写的词不能反过来当成用户硬条件。系统会优先直达成功点过的同款；没有路线或门店打烊时，会自动进行一次受限搜索并最多检查三家匹配门店，在店内再次搜索准确商品。严格匹配用户真正明确的商品和真实规格后才进入支付宝待付款页，由用户本人完成付款。\n开始操作的可见消息只能表达“准备找/准备看看”，绝不能提前声称已经找到、用了优惠券、下单、付款、骑手接单或送达；只有收到后续真实操作结果后才能说对应事实。找不到用户真正明确的品牌、商品或规格时必须如实失败，不能换品牌、换商品或改口味，也不能改走虚拟外卖。不要再使用 [点外卖|餐品|价格]。';
  }

  foodState();deliveryPreferences();
  window.deliveryRealEnabled=enabled;
  window.deliveryRolePrompt=rolePrompt;
  window.deliveryModeSwitchHtml=switchHtml;
  window.deliveryOpenSettings=openSettings;
  window.deliverySetEnabled=setEnabled;
  window.deliveryConfirmAddress=confirmAddress;
  window.deliveryRefreshCapabilities=refreshCapabilities;
  window.deliveryOpenPreferences=openPreferences;
  window.deliverySavePreferences=savePreferences;
  window.deliveryOpenSavedRoutes=openSavedRoutes;
  window.deliveryRealFoodCart=cart;
  window.deliveryRealOrder=manualOrder;
  window.deliveryCheckoutCart=checkoutCart;
  window.deliveryConfirmOptions=confirmOptions;
  window.deliveryOpenOrders=openOrders;
  window.deliveryOpenPay=openPay;
  window.deliveryLaunchPay=launchPay;
  window.deliveryPollOrders=pollOrders;
  window.deliveryHandleRoleRequest=roleRequest;
  window.deliveryRolePreludeAllowed=rolePreludeAllowed;
  window.deliveryRealChatCardHTML=chatOrderCardHTML;
  window.deliveryOpenChatOrder=openChatOrder;
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
