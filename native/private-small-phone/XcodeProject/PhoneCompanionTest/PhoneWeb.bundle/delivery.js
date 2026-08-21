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
  var TERMINAL={delivered:1,canceled:1,refunded:1,failed:1};
  var STATUS_TEXT={quote:'待下单',created:'订单已创建',pending_payment:'待付款',paid:'已付款',merchant_confirmed:'商家已接单',preparing:'商家备餐中',courier_assigned:'骑手已接单',picked_up:'骑手已取餐',delivering:'配送中',delivered:'已送达',canceled:'已取消',refunded:'已退款',failed:'订单失败'};

  function dayKey(ts){var d=new Date(ts||Date.now());return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function num(v){v=Number(v);return Number.isFinite(v)?Math.max(0,Math.round(v*100)/100):0;}
  function text(v,n){return String(v==null?'':v).trim().slice(0,n||300);}
  function foodState(){
    S.food=S.food&&typeof S.food==='object'?S.food:{};
    S.food.cart=Array.isArray(S.food.cart)?S.food.cart:[];
    S.food.results=Array.isArray(S.food.results)?S.food.results:[];
    S.food.orders=Array.isArray(S.food.orders)?S.food.orders:[];
    var r=S.food.real&&typeof S.food.real==='object'?S.food.real:{};
    if(typeof r.enabled!=='boolean')r.enabled=false;
    if(typeof r.autoPay!=='boolean')r.autoPay=false;
    r.connectorUrl=text(r.connectorUrl,500);
    r.addressLabel=text(r.addressLabel,80);
    r.approvedAddressFingerprint=text(r.approvedAddressFingerprint,180);
    r.lastCapability=r.lastCapability&&typeof r.lastCapability==='object'?r.lastCapability:null;
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
    return {offerId:text(x.offerId||x.id,160),provider:text(x.provider,40),merchantId:text(x.merchantId,120),merchant:text(x.merchant||x.shop,100),name:text(x.name,140),description:text(x.description||x.desc,240),price:num(x.price),deliveryFee:num(x.deliveryFee),total:num(x.total==null?num(x.price)+num(x.deliveryFee):x.total),rating:Number.isFinite(+x.rating)?Math.max(0,Math.min(5,+x.rating)):null,reviewCount:Number.isFinite(+x.reviewCount)?Math.max(0,Math.floor(+x.reviewCount)):null,monthlySales:Number.isFinite(+x.monthlySales)?Math.max(0,Math.floor(+x.monthlySales)):null,etaMinutes:Number.isFinite(+x.etaMinutes)?Math.max(0,Math.floor(+x.etaMinutes)):null,distanceKm:Number.isFinite(+x.distanceKm)?Math.max(0,+x.distanceKm):null,couponLabel:text(x.couponLabel,100),imageUrl:text(x.imageUrl,800),emoji:text(x.emoji,4)||'🍱',quoteId:text(x.quoteId,160),quoteExpiresAt:+x.quoteExpiresAt||0,addressLabel:text(x.addressLabel,80),addressFingerprint:text(x.addressFingerprint,180),rawVersion:text(x.rawVersion,80)};
  }
  async function request(action,payload,timeout){
    var url=connectorUrl();
    if(!url)throw new Error('还没有连接真实外卖服务');
    var ctl=typeof AbortController==='function'?new AbortController():null,timer=ctl?setTimeout(function(){ctl.abort();},timeout||25000):0;
    try{
      var res=await fetch(url,{method:'POST',credentials:'include',headers:{'content-type':'application/json','x-north-delivery-contract':'1'},body:JSON.stringify({action:action,payload:payload||{},client:{appVersion:String(APP_VER||''),privateApp:typeof privateNativeAppOn==='function'&&privateNativeAppOn()}}),signal:ctl&&ctl.signal});
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
    var r=foodState();if(on&&!r.enabled){toast('请先开启真实外卖');render();return;}r.autoPay=!!on;save();render();toast(r.autoPay?'已允许角色在额度内自动付款':'角色只能创建真实订单，付款由你确认');setTimeout(openSettings,0);
  }
  async function refreshCapabilities(show){
    var r=foodState();
    try{var cap=await request('capabilities',{},12000);r.lastCapability={ok:true,at:Date.now(),providers:Array.isArray(cap.providers)?cap.providers.map(String):[],payments:Array.isArray(cap.payments)?cap.payments.map(String):[],addressLabel:text(cap.addressLabel,80)};if(r.lastCapability.addressLabel)r.addressLabel=r.lastCapability.addressLabel;save();if(show)toast('真实外卖服务已连接');render();return true;}
    catch(e){r.lastCapability={ok:false,at:Date.now(),error:text(e.message,160)};save();if(show)toast(e.message||'连接失败');render();return false;}
  }
  function switchHtml(){
    var r=foodState(),cap=r.lastCapability,connected=cap&&cap.ok,sub=!r.enabled?'当前为虚拟外卖':connected?'已连接 '+((cap.providers||[]).map(providerText).join('、')||'真实服务'):'真实服务未连接';
    return '<button class="delivery-mode-pill '+(r.enabled?'real':'virtual')+'" onclick="deliveryOpenSettings()"><i></i><span>'+(r.enabled?'真实外卖':'虚拟外卖')+'</span><small>'+esc(sub)+'</small><b>›</b></button>';
  }
  function openSettings(){
    var r=foodState(),cap=r.lastCapability,roles=(S.contacts||[]).filter(function(c){return c&&!c.deleted;});roles.forEach(roleWallet);
    var capText=!r.connectorUrl?'尚未填写真实外卖服务地址':cap&&cap.ok?'已连接：'+((cap.providers||[]).map(providerText).join('、')||'真实服务')+(cap.addressLabel?' · '+cap.addressLabel:''):cap&&cap.error?'未连接：'+cap.error:'等待检测连接';
    var roleRows=roles.length?roles.map(function(c){var w=roleWallet(c);return '<button class="delivery-role-row" onclick="deliveryOpenWallet(\''+c.id+'\')"><span>'+av(c.avatar||'👤','sm')+'</span><span><b>'+esc(c.remark||c.name)+'</b><small>可用 ¥'+w.balance.toFixed(2)+' · 单笔 ¥'+w.singleLimit.toFixed(0)+' · 今日 ¥'+w.spentToday.toFixed(2)+'/'+w.dailyLimit.toFixed(0)+'</small></span><i>›</i></button>';}).join(''):'<div class="delivery-empty-mini">先创建角色，再为角色设置外卖额度</div>';
    openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>DELIVERY CONTROL</small><h3>真实外卖与角色钱包</h3></div><button onclick="closeModal()">×</button></div><div class="delivery-notice">真实模式只显示连接器返回的商家、价格、优惠与配送状态；失败时不会回退为虚拟订单。</div><label class="delivery-toggle"><span><b>开启真实外卖</b><small>默认关闭；开启后外卖软件和角色都只走真实订单</small></span><input type="checkbox" '+(r.enabled?'checked':'')+' onchange="deliverySetEnabled(this.checked)"><i></i></label><label class="delivery-toggle '+(!r.enabled?'disabled':'')+'"><span><b>允许角色自动付款</b><small>关闭时角色最多创建待付款订单；开启后仍受钱包和风控限制</small></span><input type="checkbox" '+(r.autoPay?'checked':'')+' '+(!r.enabled?'disabled':'')+' onchange="deliverySetAutoPay(this.checked)"><i></i></label><div class="delivery-field"><label>真实外卖服务地址</label><div><input id="delivery_connector_url" value="'+esc(r.connectorUrl)+'" placeholder="https://你的安全外卖连接器"><button onclick="deliverySaveConnector()">保存并检测</button></div><small>'+esc(capText)+'</small></div><div class="delivery-section-title">角色外卖钱包</div>'+roleRows+'<div class="delivery-safety">付款优先微信支付，其次支付宝。新地址、价格变化、短时重复、平台风控、余额或任一额度不足都会改为待本人付款。角色不能自行充值、改额度或打开开关。</div></div>');
  }
  function saveConnector(){
    var el=document.getElementById('delivery_connector_url'),u=text(el&&el.value,500);if(u){try{var p=new URL(u);if(p.protocol!=='https:')throw 0;u=p.href.replace(/\/$/,'');}catch(_){toast('服务地址必须是 HTTPS');return;}}
    foodState().connectorUrl=u;foodState().lastCapability=null;save();openSettings();if(u)refreshCapabilities(true);
  }
  function openWallet(cid){
    var c=getC(cid),w=roleWallet(c);if(!c||!w)return;
    openModal('<div class="delivery-settings"><div class="delivery-settings-head"><div><small>ROLE DELIVERY WALLET</small><h3>'+esc(c.remark||c.name)+'的外卖钱包</h3></div><button onclick="deliveryOpenSettings()">‹</button></div><div class="delivery-wallet-balance"><small>自动支付可用额度</small><b>¥'+w.balance.toFixed(2)+'</b><span>这是你授予角色的消费额度，不是微信或支付宝储值账户</span></div><div class="delivery-quick"><button onclick="deliveryTopUp(\''+cid+'\',50)">+50</button><button onclick="deliveryTopUp(\''+cid+'\',100)">+100</button><button onclick="deliveryTopUp(\''+cid+'\',200)">+200</button></div><div class="delivery-field"><label>自定义补充额度</label><div><input id="delivery_topup" type="number" min="0.01" step="0.01" placeholder="金额"><button onclick="deliveryTopUp(\''+cid+'\',document.getElementById(\'delivery_topup\').value)">补充</button></div></div><div class="delivery-limits"><label>单笔自动付款上限<input id="delivery_single" type="number" min="0" step="1" value="'+w.singleLimit+'"></label><label>每日自动付款总上限<input id="delivery_daily" type="number" min="0" step="1" value="'+w.dailyLimit+'"></label></div><button class="delivery-save" onclick="deliverySaveWallet(\''+cid+'\')">保存额度</button><div class="delivery-safety">默认单笔 ¥100、每日 ¥200，均可自由调整；填 0 表示不允许自动付款。已支付订单才会扣减这里的额度。</div></div>');
  }
  function topUp(cid,amount){var c=getC(cid),w=roleWallet(c);amount=num(amount);if(!w||amount<=0){toast('请输入正确金额');return;}w.balance=num(w.balance+amount);w.ledger.unshift({id:uid(),type:'topup',amount:amount,at:Date.now(),by:'user'});w.ledger=w.ledger.slice(0,80);save();openWallet(cid);}
  function saveWallet(cid){var c=getC(cid),w=roleWallet(c),a=document.getElementById('delivery_single'),b=document.getElementById('delivery_daily');if(!w)return;w.singleLimit=num(a&&a.value);w.dailyLimit=num(b&&b.value);save();toast('角色外卖额度已保存');openWallet(cid);}

  async function realSearch(query,opt){
    query=text(query,120);if(!query)throw new Error('请输入要搜索的餐品或店铺');
    var data=await request('search',{query:query,providers:['taobao_flash','meituan'],paymentPreference:['wechat','alipay'],roleId:opt&&opt.roleId||'',limit:20},30000);
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
    ctx=ctx||{};var data=await request('create_order',{offerId:offer.offerId,quoteId:offer.quoteId,quantity:Math.max(1,Math.min(20,+ctx.quantity||1)),roleId:ctx.roleId||'',source:ctx.roleId?'role':'user',paymentPreference:['wechat','alipay']},35000);
    var order={id:text(data.id||data.orderId,160)||uid(),remoteId:text(data.orderId||data.id,160),provider:text(data.provider||offer.provider,40),merchant:text(data.merchant||offer.merchant,100),merchantId:text(data.merchantId||offer.merchantId,120),items:Array.isArray(data.items)?data.items.map(function(x){return{name:text(x.name,140),quantity:Math.max(1,+x.quantity||1),price:num(x.price)};}):[{name:offer.name,quantity:Math.max(1,+ctx.quantity||1),price:offer.price}],total:num(data.total==null?offer.total:data.total),quotedTotal:num(offer.total),status:text(data.status,40)||'created',paymentMethod:text(data.paymentMethod,40),payUrl:text(data.payUrl,1000),addressLabel:text(data.addressLabel||offer.addressLabel,80),addressFingerprint:text(data.addressFingerprint||offer.addressFingerprint,180),risk:Array.isArray(data.risk)?data.risk.map(function(x){return text(x,80);}):[],roleId:ctx.roleId||'',source:ctx.roleId?'role':'user',createdAt:Date.now(),updatedAt:Date.now(),notifiedStatuses:[],walletDebited:false,real:true};
    S.food.orders.unshift(order);S.food.orders=S.food.orders.slice(0,80);save();return order;
  }
  function recentDuplicate(order){return S.food.orders.some(function(x){return x!==order&&x.real&&x.merchantId&&x.merchantId===order.merchantId&&Date.now()-(+x.createdAt||0)<20*60000&&!TERMINAL[x.status];});}
  function autoPayCheck(order,c){
    var r=foodState(),w=roleWallet(c),reasons=[];
    if(!r.enabled)reasons.push('真实外卖未开启');if(!r.autoPay)reasons.push('角色自动付款未开启');
    if(!w||w.balance<order.total)reasons.push('角色外卖钱包额度不足');if(!w||w.singleLimit<=0||order.total>w.singleLimit)reasons.push('超过单笔自动付款上限');if(!w||w.dailyLimit<=0||w.spentToday+order.total>w.dailyLimit)reasons.push('超过每日自动付款上限');
    if(!r.approvedAddressFingerprint||!order.addressFingerprint||r.approvedAddressFingerprint!==order.addressFingerprint)reasons.push('新地址需要本人确认');if(Math.abs(order.total-order.quotedTotal)>.001)reasons.push('下单价格与报价不一致');if(recentDuplicate(order))reasons.push('短时间内存在重复订单');if(order.risk&&order.risk.length)reasons.push('平台要求本人确认');
    return reasons;
  }
  async function payOrder(order,c,automatic){
    if(automatic){var reasons=autoPayCheck(order,c);if(reasons.length){order.status='pending_payment';order.pendingReason=reasons.join('；');save();return order;}}
    var data=await request('pay_order',{orderId:order.remoteId,paymentPreference:['wechat','alipay'],automatic:!!automatic,roleId:order.roleId||''},35000);
    order.status=text(data.status,40)||'pending_payment';order.paymentMethod=text(data.paymentMethod,40);order.payUrl=text(data.payUrl,1000);order.pendingReason=text(data.reason,180);order.updatedAt=Date.now();
    if(order.status==='paid'&&automatic&&c&&!order.walletDebited){var w=roleWallet(c);w.balance=num(w.balance-order.total);w.spentToday=num(w.spentToday+order.total);w.ledger.unshift({id:uid(),type:'payment',amount:order.total,orderId:order.id,at:Date.now(),by:'role'});w.ledger=w.ledger.slice(0,80);order.walletDebited=true;}
    save();return order;
  }
  async function manualOrder(offer){
    if(!enabled())return oldFoodBuy.apply(this,arguments);if(!offer||!offer.offerId)return;
    _foodBusy=true;render();try{var order=await createOrder(offer,{});await payOrder(order,null,false);S.food.cart=S.food.cart.filter(function(x){return x.offerId!==offer.offerId;});save();openOrders();if(order.status==='pending_payment')toast('真实订单已创建，请完成付款');else toast('真实订单状态：'+statusText(order.status));}catch(e){toast(e.message||'真实订单创建失败');}finally{_foodBusy=false;render();}
  }
  function buy(i){if(!enabled())return oldFoodBuy.apply(this,arguments);return manualOrder(S.food.results[i]);}
  function openCart(){
    if(!enabled())return oldOpenFoodCart.apply(this,arguments);var cart=S.food.cart||[],total=cart.reduce(function(s,p){return s+num(p.total);},0);
    openModal('<h3>真实外卖单</h3><div class="delivery-cart-list">'+(cart.length?cart.map(function(p,i){return '<div class="bill"><div>'+esc(p.name)+'<small>'+esc(p.merchant)+' · '+providerText(p.provider)+'</small></div><div>¥'+num(p.total).toFixed(2)+' <span onclick="S.food.cart.splice('+i+',1);save();openFoodCart()" class="delivery-remove">✕</span></div></div>';}).join(''):'<div class="empty">外卖单空空的</div>')+'</div>'+(cart.length?'<div class="delivery-cart-total">合计 ¥'+total.toFixed(2)+'</div><div class="delivery-notice">为避免跨店、运费和优惠变化，真实订单需要逐店确认。将从第一项开始创建订单。</div><button class="btn p" onclick="deliveryCheckoutCart()">创建真实订单</button>':'')+'<button class="btn g" style="margin-top:8px" onclick="closeModal()">关闭</button>');
  }
  async function checkoutCart(){var item=(S.food.cart||[])[0];if(!item)return;closeModal();await manualOrder(item);}
  function orderItems(order){return (order.items||[]).map(function(x){return esc(x.name)+(x.quantity>1?' ×'+x.quantity:'');}).join('、')||'外卖商品';}
  function openOrders(){
    if(!enabled())return oldOpenFoodOrders.apply(this,arguments);var rows=(S.food.orders||[]).filter(function(x){return x&&x.real;});
    openModal('<div class="delivery-orders"><div class="delivery-settings-head"><div><small>REAL-TIME ORDERS</small><h3>真实外卖订单</h3></div><button onclick="closeModal()">×</button></div><button class="delivery-refresh" onclick="deliveryPollOrders(true)">刷新真实状态</button><div class="delivery-order-list">'+(rows.length?rows.map(function(o){var pending=o.status==='pending_payment',active=!TERMINAL[o.status],progress=['created','pending_payment','paid','merchant_confirmed','preparing','courier_assigned','picked_up','delivering','delivered'].indexOf(o.status);return '<article class="delivery-order-card"><header><span>'+providerText(o.provider)+'</span><b>'+statusText(o.status)+'</b></header><h4>'+esc(o.merchant||'外卖商家')+'</h4><p>'+orderItems(o)+'</p><div class="delivery-progress"><i style="width:'+Math.max(3,Math.min(100,(progress<0?0:progress)/8*100))+'%"></i></div><div class="delivery-order-meta"><span>¥'+num(o.total).toFixed(2)+'</span><span>'+esc(o.addressLabel||'平台默认地址')+'</span></div>'+(o.pendingReason?'<small class="delivery-reason">'+esc(o.pendingReason)+'</small>':'')+'<footer>'+(pending?'<button onclick="deliveryOpenPay(\''+o.id+'\')">'+(o.payUrl?'去'+paymentText(o.paymentMethod)+'付款':'获取付款方式')+'</button>':'')+(active?'<button onclick="deliveryPollOrders(true)">刷新状态</button>':'')+'</footer></article>';}).join(''):'<div class="empty">还没有真实外卖订单</div>')+'</div></div>');
  }
  async function openPay(id){var o=(S.food.orders||[]).find(function(x){return x.id===id;});if(!o)return;try{if(!o.payUrl)await payOrder(o,null,false);if(o.payUrl){window.open(o.payUrl,'_blank','noopener');toast('已打开真实付款页面；付款后请刷新订单状态');}else toast(o.pendingReason||'平台暂未返回付款链接');openOrders();}catch(e){toast(e.message||'获取付款方式失败');}}
  function mergeStatus(order,data){var before=order.status;['status','paymentMethod','payUrl','addressLabel','addressFingerprint'].forEach(function(k){if(data[k]!=null)order[k]=text(data[k],k==='payUrl'?1000:180);});if(data.total!=null)order.total=num(data.total);order.updatedAt=Date.now();return before!==order.status?before:'';}
  function notifyStatus(order,before){
    if(!order.roleId||!before||order.notifiedStatuses.includes(order.status))return;var c=getC(order.roleId);if(!c||c.blocked)return;order.notifiedStatuses.push(order.status);save();
    var fact='[真实外卖订单状态更新]\n你亲自创建的真实外卖订单现在由平台确认处于「'+statusText(order.status)+'」。商家：'+(order.merchant||'')+'；餐品：'+(order.items||[]).map(function(x){return x.name;}).join('、')+'；实付/待付金额：¥'+num(order.total).toFixed(2)+'。这是平台刚返回的事实。请按你自己的完整人设、当前关系和说话习惯，自主决定怎样提醒'+S.me.name+'；不要照抄提示，不要添加骑手位置、送达时间或其他未提供事实。若只是中间小变化且你本人觉得不必打扰，也可以不发。';
    scheduleReply(c.id,fact);
  }
  async function pollOrders(show){
    if(pollBusy||!enabled()||!connectorUrl())return false;var rows=(S.food.orders||[]).filter(function(x){return x.real&&x.remoteId&&!TERMINAL[x.status];});if(!rows.length){if(show)toast('没有需要刷新的真实订单');return false;}pollBusy=true;try{for(var i=0;i<rows.length;i++){try{var data=await request('order_status',{orderId:rows[i].remoteId},18000),before=mergeStatus(rows[i],data);if(rows[i].status==='paid'&&rows[i].addressFingerprint&&!foodState().approvedAddressFingerprint)foodState().approvedAddressFingerprint=rows[i].addressFingerprint;notifyStatus(rows[i],before);}catch(e){rows[i].lastSyncError=text(e.message,140);}}save();if(show){openOrders();toast('已按平台回执刷新订单');}else if(cur&&cur().p==='food')render();return true;}finally{pollBusy=false;}}
  async function chooseOffer(c,query,offers){
    var compact=offers.map(function(x){return{id:x.offerId,platform:providerText(x.provider),merchant:x.merchant,name:x.name,total:x.total,rating:x.rating,reviewCount:x.reviewCount,coupon:x.couponLabel,etaMinutes:x.etaMinutes};});
    var raw=await chatAPI([{role:'system',content:'你是「'+c.name+'」本人。下面是外卖平台真实返回的候选。只做内部选择，不要对用户说话。根据你的人设、用户需求、真实价格、优惠、评价和配送信息选择一个。只返回严格 JSON：{"offerId":"候选id","quantity":1}。只能使用候选里的 id；信息不足也不要编造。'},{role:'user',content:'需求：'+query+'\n真实候选：'+JSON.stringify(compact)}],{max:180,temp:.25});
    var obj=null;try{obj=JSON.parse(String(raw||'').replace(/^```(?:json)?|```$/g,'').trim());}catch(_){}var chosen=offers.find(function(x){return obj&&x.offerId===obj.offerId;});if(!chosen)throw new Error('角色没有从真实候选中完成有效选择');return{offer:chosen,quantity:Math.max(1,Math.min(20,+obj.quantity||1))};
  }
  function resultReply(c,order,error){
    if(!c||c.blocked)return;var fact=error?'[真实外卖操作结果]\n你刚才尝试使用真实外卖，但真实服务返回失败：'+text(error,180)+'。没有创建成功订单，也没有付款。请按你自己的完整人设和说话方式自然告诉'+S.me.name+'真实结果；绝不能假装已经下单、付款、接单或配送。':'[真实外卖操作结果]\n你刚才亲自选择并创建了真实外卖订单。平台：'+providerText(order.provider)+'；商家：'+order.merchant+'；餐品：'+(order.items||[]).map(function(x){return x.name+(x.quantity>1?'×'+x.quantity:'');}).join('、')+'；金额：¥'+num(order.total).toFixed(2)+'；当前真实状态：'+statusText(order.status)+(order.pendingReason?'；需要本人处理的原因：'+order.pendingReason:'')+'。请按你自己的完整人设、关系和说话习惯自然告诉'+S.me.name+'结果，不要照抄字段，不要添加未提供的优惠、评价、骑手、时间或送达事实。';scheduleReply(c.id,fact);
  }
  async function roleRequest(cid,query){
    var c=getC(cid);if(!c)return false;if(!enabled()){return false;}var r=foodState();
    if(!connectorUrl()){resultReply(c,null,'还没有连接真实外卖服务');return true;}
    if(!query){resultReply(c,null,'没有提供可搜索的餐品或店铺');return true;}
    if((S.food.orders||[]).some(function(x){return x.real&&x.roleId===cid&&Date.now()-(+x.createdAt||0)<20*60000&&!TERMINAL[x.status];})){resultReply(c,null,'20分钟内已有一笔角色真实外卖订单仍在处理，为避免重复没有再下单');return true;}
    try{var offers=await realSearch(query,{roleId:cid}),choice=await chooseOffer(c,query,offers),order=await createOrder(choice.offer,{roleId:cid,quantity:choice.quantity});await payOrder(order,c,true);resultReply(c,order,'');return true;}
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
  window.deliveryRefreshCapabilities=refreshCapabilities;
  window.deliveryOpenWallet=openWallet;
  window.deliveryTopUp=topUp;
  window.deliverySaveWallet=saveWallet;
  window.deliveryRealFoodCart=cart;
  window.deliveryRealOrder=manualOrder;
  window.deliveryCheckoutCart=checkoutCart;
  window.deliveryOpenPay=openPay;
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
