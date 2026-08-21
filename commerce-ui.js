/* Commerce and Douyin presentation layer.
   Loaded after app.js so the existing data/payment/chat flows stay untouched. */
(function(){
  'use strict';

  function seedOf(value){
    var text=String(value||''),n=17;
    for(var i=0;i<text.length;i++)n=(n*33+text.charCodeAt(i))>>>0;
    return n;
  }
  function money(value){return (+value||0).toFixed(2);}
  function shopQuick(keyword){
    var input=document.getElementById('shop_q');
    if(input)input.value=keyword;
    window.shopSearch();
  }
  function foodQuick(keyword){
    var input=document.getElementById('food_q');
    if(input)input.value=keyword;
    window.foodSearch();
  }
  window.shopQuick=shopQuick;
  window.foodQuick=foodQuick;

  window.renderShop=function(){
    coInit();
    var rows=S.shop.results||[],cartN=(S.shop.cart||[]).length;
    var orderRows=typeof shopOrderRows==='function'?shopOrderRows():(S.shop.orders||[]).filter(function(order){return order.kind!=='gift';});
    var orderN=orderRows.filter(function(order){return !order.refunded;}).length;
    var co=S.shop.co||{};
    var categories=[['✨','今日上新'],['💄','美妆'],['👗','穿搭'],['🏠','家居'],['🎁','礼物']];
    return '<div class="commerce-top">'+
      '<button class="back" onclick="back()" aria-label="返回">‹</button><div class="title">NORTH SELECT <span class="sub">精选商城</span></div>'+
      '<div class="tools"><button class="commerce-icon" onclick="go(\'shopcs\')" aria-label="客服">'+svgIc('chat',21,'#222')+'</button>'+
      '<button class="commerce-icon" onclick="openOrders()" aria-label="订单">'+svgIc('bag',22,'#222')+(orderN?'<i class="badge">'+orderN+'</i>':'')+'</button>'+
      '<button class="commerce-icon" onclick="openCart()" aria-label="购物车">'+svgIc('bag',22,'#222')+(cartN?'<i class="badge">'+cartN+'</i>':'')+'</button></div></div>'+
      '<div class="scroll shop-scroll">'+
        '<section class="shop-hero"><div class="shop-kicker">DAILY CURATION</div><h2>把喜欢的生活带回家</h2><p>好物、心意和日常，都值得认真挑选</p>'+
          '<div class="shop-search"><span>'+svgIc('search',17,'#777')+'</span><input id="shop_q" value="'+esc(S.shop.q||'')+'" placeholder="搜商品、品牌或礼物" onkeydown="if(event.key===\'Enter\')shopSearch()"><button onclick="shopSearch()" '+(_shopBusy?'disabled':'')+'>'+(_shopBusy?'搜索中':'搜索')+'</button></div></section>'+
        '<div class="quick-grid">'+categories.map(function(c){return '<button class="quick-item" onclick="shopQuick(\''+c[1]+'\')"><b>'+c[0]+'</b>'+c[1]+'</button>';}).join('')+'</div>'+
        '<div class="shop-benefits"><span><b>✓</b>品质严选</span><span><b>✓</b>安心售后</span><span><b>✓</b>次日达</span></div>'+
        (co.on?coPanel():'<button class="shop-primary" style="margin:0 0 9px" onclick="coInvite()">👫 邀请角色一起逛</button>')+
        '<div class="section-head"><strong>'+(_shopBusy?'正在为你挑选':rows.length?'猜你喜欢':'逛逛精选')+'</strong><small>'+(_shopBusy?'请稍等…':rows.length?rows.length+' 件好物':'从分类开始发现')+'</small><button class="more" onclick="openOrders()">订单 ›</button></div>'+
        '<div class="shop-grid">'+(_shopBusy?'<div class="commerce-empty"><span class="big">🔎</span>正在全网挑选好物…</div>':rows.length?rows.map(window.shopCard).join(''):'<div class="commerce-empty"><span class="big">🛍️</span>搜索你想买的东西<br><small>试试「香薰」「小裙子」或「盲盒」</small></div>')+'</div>'+
      '</div>';
  };

  window.shopCard=function(p,i){
    p=p||{};
    var n=seedOf((p.name||'')+(p.shop||'')+i),sold=320+n%9700,rate=96+n%4;
    var backgrounds=['linear-gradient(145deg,#ffe5ee,#f5c9df)','linear-gradient(145deg,#e6edff,#cdd9ff)','linear-gradient(145deg,#fff0cf,#ffdaa7)','linear-gradient(145deg,#dff7ee,#bde7d6)'];
    var together=S.shop.co&&S.shop.co.on;
    return '<article class="shop-card"><div class="shop-thumb" style="background:'+backgrounds[n%backgrounds.length]+'" onclick="shopProductDetail('+i+')"><span class="corner">'+rate+'% 好评</span><span class="emoji">'+(p.emoji||'🛍️')+'</span></div>'+
      '<div class="shop-info"><div class="shop-name" onclick="shopProductDetail('+i+')">'+esc(p.name||'精选商品')+'</div><div class="shop-desc">'+esc(p.shop||'NORTH精选')+' · '+esc(p.desc||'品质好物，放心选购')+'</div>'+
      '<div class="shop-price-row"><span class="shop-price"><small>¥</small>'+money(p.price)+'</span><span class="shop-sold">已售 '+sold+'</span></div>'+
      '<button class="shop-primary" onclick="buyNow('+i+')">立即购买</button><div class="shop-mini-actions">'+
        '<button onclick="addCart('+i+')">加入购物车</button><button class="hot" onclick="giftFlow('+i+')">送给TA</button>'+
        (together?'<button class="hot" onclick="coAskHim('+i+')">问问TA</button>':'')+'<button onclick="payFlow('+i+')">让TA代付</button>'+
        (familyContacts().length?'<button onclick="familyPayFlow([S.shop.results['+i+']])">亲属卡</button>':'')+'</div></div></article>';
  };

  window.shopProductDetail=function(i){
    var p=(S.shop.results||[])[i];if(!p)return;
    var n=seedOf(p.name),sold=320+n%9700;
    openModal('<div style="margin:-20px -20px 16px;height:210px;background:linear-gradient(145deg,#ffe4ee,#dce4ff);display:flex;align-items:center;justify-content:center;font-size:92px;position:relative">'+(p.emoji||'🛍️')+'<button onclick="closeModal()" style="position:absolute;right:12px;top:12px;border:0;border-radius:50%;width:32px;height:32px;background:rgba(0,0,0,.48);color:#fff;font-size:18px">×</button></div>'+
      '<h3 style="margin-bottom:5px">'+esc(p.name||'精选商品')+'</h3><div style="font-size:22px;font-weight:800;color:#ff3158">¥'+money(p.price)+'</div><div class="hint" style="margin:7px 0">'+esc(p.shop||'NORTH精选')+' · 已售 '+sold+'<br>'+esc(p.desc||'品质好物，放心选购')+'</div>'+
      '<div style="background:#f6f6f8;border-radius:12px;padding:10px;font-size:12px;color:#666;line-height:1.7">✓ 品质严选　✓ 极速发货　✓ 售后无忧</div>'+
      '<div class="btns" style="margin-top:12px"><button class="btn g" onclick="closeModal();addCart('+i+')">加入购物车</button><button class="btn p" onclick="closeModal();buyNow('+i+')">立即购买</button></div>');
  };

  window.renderFood=function(){
    var rows=S.food.results||[],cartN=(S.food.cart||[]).length,real=typeof deliveryRealEnabled==='function'&&deliveryRealEnabled(),r=S.food.real||{};
    var cats=[['🍱','品质套餐'],['🥤','奶茶果汁'],['🍗','炸鸡汉堡'],['🍜','面食粥点'],['🍲','火锅冒菜'],['🥗','轻食沙拉'],['🍰','甜品蛋糕'],['🌙','夜宵']];
    return '<div class="commerce-top mt-top"><button class="back" onclick="back()" aria-label="返回">‹</button><div class="mt-location"><small>外卖送到</small><b>'+esc(real?(r.addressLabel||'平台默认地址'):'我的位置⌄')+'</b></div><div class="tools"><button class="commerce-icon" onclick="openFoodOrders()">订单</button><button class="commerce-icon" onclick="openFoodCart()">'+svgIc('bag',22,'#222')+(cartN?'<i class="badge">'+cartN+'</i>':'')+'</button></div></div>'+
      '<div class="scroll mt-scroll">'+(typeof deliveryModeSwitchHtml==='function'?deliveryModeSwitchHtml():'')+'<section class="mt-hero"><div class="mt-hello"><b>'+(real?'淘宝闪购真实外卖':'美团外卖')+'</b> '+(real?'真实商家 · 支付宝本人付款':'美好生活小帮手')+'</div><div class="mt-search"><span>'+svgIc('search',17,'#555')+'</span><input id="food_q" value="'+esc(S.food.q||'')+'" placeholder="'+(real?'搜索淘宝闪购店铺、品牌或餐品':'搜美食、饮品或店铺')+'" onkeydown="if(event.key===\'Enter\')foodSearch()"><button onclick="foodSearch()" '+(_foodBusy?'disabled':'')+'>'+(_foodBusy?'寻找中':'搜索')+'</button></div></section>'+
      '<div class="mt-cats">'+cats.map(function(c){return '<button class="mt-cat" onclick="foodQuick(\''+c[1]+'\')"><b>'+c[0]+'</b>'+c[1]+'</button>';}).join('')+'</div>'+
      (real?'<div class="mt-real-trust"><span>淘宝闪购商家</span><span>平台结算价格</span><span>手动刷新状态</span></div>':'<div class="mt-promise"><span><b>准</b> 超时赔付</span><span><b>快</b> 30分钟达</span><span><b>省</b> 天天神券</span></div>')+
      '<div class="section-head"><strong>'+(_foodBusy?(real?'正在连接真实平台':'正在搜索附近美食'):rows.length?(real?'真实搜索结果':'附近推荐'):'今天想吃什么')+'</strong><small>'+(_foodBusy?(real?'不会生成虚拟候选':'骑手和商家都在准备'):rows.length?(real?'仅展示平台实际返回':'综合排序 · 配送优先'):'选个分类看看')+'</small><button class="more" onclick="openFoodOrders()">全部订单 ›</button></div>'+
      '<div class="mt-list">'+(_foodBusy?'<div class="commerce-empty"><span class="big">🛵</span>'+(real?'正在读取淘宝闪购真实结果…':'正在寻找附近好店…')+'</div>':rows.length?rows.map(window.foodCard).join(''):'<div class="commerce-empty"><span class="big">🍜</span>'+(real?'搜索后才会显示淘宝闪购真实结果<br><small>未连接或失败时不会用虚拟商家代替</small>':'搜一搜附近的好吃的<br><small>奶茶、炸鸡、火锅都可以</small>')+'</div>')+'</div></div>';
  };

  window.foodCard=function(p,i){
    p=p||{};
    var real=typeof deliveryRealEnabled==='function'&&deliveryRealEnabled();
    if(real){
      var facts=[];
      if(p.rating!=null)facts.push('<span class="star">★ '+Number(p.rating).toFixed(1)+'</span>');
      if(p.reviewCount!=null)facts.push(Number(p.reviewCount)+'条评价');
      if(p.monthlySales!=null)facts.push('月售'+Number(p.monthlySales));
      var delivery=[];if(p.etaMinutes!=null)delivery.push(Number(p.etaMinutes)+'分钟');if(p.distanceKm!=null)delivery.push(Number(p.distanceKm).toFixed(1)+'km');
      var media=p.imageUrl?'<img src="'+esc(p.imageUrl)+'" alt="" loading="lazy">':esc(p.emoji||'🍱');
      return '<article class="mt-card real"><div class="mt-logo">'+media+'</div><div class="mt-body"><div class="mt-provider">'+(typeof deliveryProviderText==='function'?deliveryProviderText(p.provider):esc(p.provider||'真实平台'))+'</div><div class="mt-shopname">'+esc(p.merchant||p.shop||'真实商家')+'</div>'+
        (facts.length||delivery.length?'<div class="mt-rating">'+facts.join(' · ')+(delivery.length?'<span class="mt-delivery">'+delivery.join(' · ')+'</span>':'')+'</div>':'')+'<div class="mt-dish">'+esc(p.name||'商品')+(p.description?' · '+esc(p.description):'')+'</div>'+(p.couponLabel?'<span class="mt-discount">'+esc(p.couponLabel)+'</span>':'')+
        '<div class="mt-bottom"><span class="mt-price"><small>¥</small>'+money(p.total)+'</span><div class="mt-actions"><button onclick="deliveryRealFoodCart('+i+')">加购</button><button class="order" onclick="foodBuy('+i+')">创建订单</button></div></div><div class="mt-real-foot">商品 ¥'+money(p.price)+' · 配送 ¥'+money(p.deliveryFee)+' · 以创建订单回执为准</div></div></article>';
    }
    var n=seedOf((p.shop||'')+(p.name||'')+i),rating=(4.5+(n%5)/10).toFixed(1),mins=22+n%19,km=(.6+(n%28)/10).toFixed(1),sales=300+n%1800;
    var backgrounds=['linear-gradient(145deg,#fff1bd,#ffd861)','linear-gradient(145deg,#ffe2d0,#ffc4a0)','linear-gradient(145deg,#e4f7d6,#bfeaa8)'];
    return '<article class="mt-card"><div class="mt-logo" style="background:'+backgrounds[n%backgrounds.length]+'">'+(p.emoji||'🍱')+'</div><div class="mt-body"><div class="mt-shopname">'+esc(p.shop||'附近好店')+'</div>'+
      '<div class="mt-rating"><span class="star">★ '+rating+'</span> 月售'+sales+'<span class="mt-delivery">'+mins+'分钟 · '+km+'km</span></div><div class="mt-dish">招牌：'+esc(p.name||'精选套餐')+' · '+esc(p.desc||'现点现做')+'</div><span class="mt-discount">满25减6 · 新客再减3元</span>'+
      '<div class="mt-bottom"><span class="mt-price"><small>¥</small>'+money(p.price)+'</span><div class="mt-actions"><button onclick="foodCart('+i+')">加购</button><button class="order" onclick="foodBuy('+i+')">去结算</button></div></div>'+
      '<div class="mt-extra"><button onclick="foodGiftFlow('+i+')">请TA吃</button><button onclick="foodPayFlow('+i+')">让TA代付</button>'+(familyContacts().length?'<button onclick="familyPayFlow([S.food.results['+i+']])">亲属卡</button>':'')+'</div></div></article>';
  };

  function dySceneTag(v){
    var text=(v&&v.desc||'')+' '+(v&&v.music||'');
    if(/吃|餐|咖啡|奶茶|甜品/.test(text))return '今日美食 · FOOD';
    if(/夜|星|月|风|雨/.test(text))return '城市片刻 · NIGHT';
    if(/旅行|海|山|街|景/.test(text))return '生活记录 · VLOG';
    if(/猫|狗|宠物/.test(text))return '萌宠日常 · PET';
    return '为你推荐 · FOR YOU';
  }

  window.renderDouyin=function(){
    var body;
    if(dyTab==='feed')body=dyFeedView();else if(dyTab==='search')body=dySearchView();else if(dyTab==='dm')body=dyDMList();else body=dyProfile();
    var nav=dyTab==='feed'?'':'<div class="dynav"><span class="l" onclick="home()" style="cursor:pointer;font-size:26px">‹</span><span style="font-weight:800">'+(dyTab==='search'?'搜索发现':dyTab==='dm'?'消息':'个人主页')+'</span><span class="r" style="width:18px"></span></div>';
    return nav+'<div class="dy-shell">'+body+'</div><div class="dytab">'+dytb('feed',svgIc('home',21),'首页')+dytb('search',svgIc('search',21),'发现')+'<div class="dycreate-wrap" onclick="dyCompose()"><div class="dycreate" aria-label="发布"></div></div>'+dytb('dm',svgIc('envelope',21),'消息')+dytb('me',svgIc('user',21),'我')+'</div>';
  };

  window.dyFeedView=function(){
    var list=_dyMode==='follow'?S.dy.feed.filter(function(v){return v.cid&&v.cid!=='me'&&S.dy.following.includes(v.cid);}):S.dy.feed;
    var top='<div class="dy-topbar"><span class="dy-live" onclick="toast(\'直播频道准备中\')"><b>●</b> LIVE</span><div class="dytopt"><span class="'+(_dyMode==='follow'?'on':'')+'" onclick="_dyMode=\'follow\';render()">关注</span><span class="'+(_dyMode==='rec'?'on':'')+'" onclick="_dyMode=\'rec\';render()">推荐</span></div><span class="dy-search-top" onclick="dyTab=\'search\';render()">'+svgIc('search',22,'#fff')+'</span></div>';
    if(!list.length)return '<div style="position:relative;flex:1;background:#050507;color:#888;display:flex;align-items:center;justify-content:center;text-align:center;line-height:2;padding:20px">'+top+(_dyMode==='follow'?'关注的人还没发视频～<br>去「我的关注」添加角色的抖音<br><br><button class="dybtn out" onclick="dyFollowList()">我的关注</button>':'还没有视频<br><button class="dybtn" onclick="dyGenFeed(\'\',true)">刷新推荐</button>')+'</div>';
    var more=_dyMode==='rec'?'<div class="dyvideo dy-refresh-card"><div><div class="ring">↻</div><button class="dybtn" onclick="dyGenFeed(\'\',false)">换一批推荐</button></div></div>':'';
    return '<div class="dyfeed" id="dyfeed">'+top+list.map(window.dyVideoCard).join('')+more+'</div>';
  };

  window.dyVideoCard=function(v,i){
    var liked=!!v.liked,lc=(v.lk||0)+(liked?1:0),grad=v.grad||DY_GRADS[i%DY_GRADS.length],paused=_dyPaused[v.id];
    var isChar=v.cid&&v.cid!=='me',mine=v.cid==='me',fol=isChar&&S.dy.following.includes(v.cid);
    return '<article class="dyvideo'+(paused?' paused':'')+'" data-dy-video-id="'+v.id+'"><div class="dybg" style="background-image:'+grad+'"></div><div class="dy-scene"><div class="dy-orbit"></div><div class="dyemoji">'+(v.emoji||'🎬')+'</div><div class="dy-scene-tag">'+dySceneTag(v)+'</div><div class="dy-playnote">轻触画面 · 查看视频内容</div></div><div class="dyplay">▶</div>'+
      '<div onclick="dyTapVideo(\''+v.id+'\')" style="position:absolute;inset:0;z-index:2"></div><div class="dyrail"><div class="ra" onclick="dyVideoAuthor(\''+v.id+'\')" style="margin-bottom:5px"><div style="position:relative">'+av(v.avatar||'🎵','sm')+(isChar&&!fol?'<span style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:#fe2c55;color:#fff;font-size:13px;line-height:18px;text-align:center">+</span>':'')+'</div></div>'+
      '<div class="ra" onclick="dyLike(\''+v.id+'\')"><span class="ic">'+svgIc('heart',27,liked?'#fe2c55':'#fff')+'</span>'+lc+'</div><div class="ra" onclick="dyComments(\''+v.id+'\')"><span class="ic">'+svgIc('chat',27,'#fff')+'</span>'+((v.comments||[]).length)+'</div><div class="ra" onclick="dyTapVideo(\''+v.id+'\')"><span class="ic">'+svgIc('book',26,'#fff')+'</span>内容</div><div class="ra" onclick="dyFwd(\''+v.id+'\')"><span class="ic">'+svgIc('forward',26,'#fff')+'</span>分享</div><div class="ra"><div class="dydisc">'+(v.emoji||'🎵')+'</div></div></div>'+
      '<div class="dymeta"><div style="font-weight:800;font-size:16px;margin-bottom:6px;cursor:pointer" onclick="dyAuthorMenu(\''+v.id+'\')">@'+esc(mine?dyNick():(v.author||'用户'))+(isChar?'<span style="font-size:9px;background:#fe2c55;border-radius:5px;padding:2px 5px;margin-left:6px">角色</span>':mine?'<span style="font-size:9px;background:#555;border-radius:5px;padding:2px 5px;margin-left:6px">我</span>':'')+'</div><div style="font-size:13px;line-height:1.5">'+esc(v.desc||'')+'</div><div style="font-size:11px;color:#eee;margin-top:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">♫ '+esc(v.music||'原创音乐')+'　·　正在播放</div></div><div class="dy-progress"><i></i></div>'+
      '<div class="dynarr" id="narr_'+v.id+'" onclick="dyTapVideo(\''+v.id+'\')" style="display:'+(_dyNarr[v.id]?'block':'none')+'"><div style="font-weight:800;color:#fff;margin-bottom:7px">视频内容</div>'+esc(v.narration||v.desc||'（这条还没有内容描写）')+'<div style="text-align:center;color:#777;margin-top:10px;font-size:11px">轻触收起</div></div></article>';
  };

  var dyProfilePane='mine';
  window.dyProfileSwitch=function(pane){dyProfilePane=pane==='liked'?'liked':'mine';render();};
  window.dyProfile=function(){
    var liked=S.dy.liked||[],mine=S.dy.mine||[],profile=S.dy.profile||{},following=(S.dy.following||[]).length;
    var totalLikes=mine.reduce(function(sum,v){return sum+(+v.lk||0)+(v.liked?1:0);},0);
    var fans=Number.isFinite(+profile.fans)?Math.max(0,+profile.fans):Math.max(0,Math.round(totalLikes*.18)+mine.length*23);
    var handle=String(profile.handle||dyNick()||'north').replace(/^@/,'').replace(/\s+/g,'_').replace(/[^A-Za-z0-9_\u3400-\u9fff]/g,'').slice(0,24)||'north';
    var active=dyProfilePane==='liked'?liked:mine;
    var grid=active.length?'<div class="dy-profile-grid">'+active.map(function(v){return '<button class="dy-profile-tile" onclick="dyOpenLiked(\''+v.id+'\')" style="background:'+(v.grad||DY_GRADS[0])+'"><span class="media">'+(v.emoji||'🎬')+'</span><span class="dy-tile-likes">'+svgIc('heart',13,'#fff',2.2)+' '+((+v.lk||0)+(v.liked?1:0))+'</span></button>';}).join('')+'</div>':'<div class="dy-profile-empty">'+svgIc(dyProfilePane==='liked'?'heart':'video',34,'#85868c')+(dyProfilePane==='liked'?'还没有喜欢的视频<br><small>点赞过的作品会收藏在这里</small>':'还没有发布作品<br><small>点击上方「发布作品」记录生活</small>')+'</div>';
    return '<div class="dy-profile-scroll"><div class="dy-profile-cover"></div><section class="dy-profile-card"><div class="dy-profile-head"><div class="dy-profile-avatar" onclick="changeDyAvatar()">'+av(dyAvatar(),'lg')+'<span class="camera">'+svgIc('camera',12,'#fff',2)+'</span></div><div class="dy-profile-actions"><button class="primary" onclick="dyCompose()">发布作品</button><button onclick="editDyProfile()">编辑资料</button></div></div>'+
      '<div class="dy-profile-name">'+esc(dyNick())+'</div><div class="dy-profile-id">抖音号：'+esc(handle)+'</div><div class="dy-profile-bio">'+esc(profile.bio||'记录生活，也记录喜欢。')+'</div><div class="dy-profile-stats"><button class="dy-profile-stat" onclick="dyFollowList()"><b>'+following+'</b>关注</button><button class="dy-profile-stat"><b>'+fans+'</b>粉丝</button><button class="dy-profile-stat"><b>'+totalLikes+'</b>获赞</button></div></section>'+
      '<div class="dy-profile-tabs"><button class="dy-profile-tab '+(dyProfilePane==='mine'?'on':'')+'" onclick="dyProfileSwitch(\'mine\')">'+svgIc('video',16,'currentColor')+' 作品 '+mine.length+'</button><button class="dy-profile-tab '+(dyProfilePane==='liked'?'on':'')+'" onclick="dyProfileSwitch(\'liked\')">'+svgIc('heart',16,'currentColor')+' 喜欢 '+liked.length+'</button></div>'+grid+'</div>';
  };
  var dyFeedViewWithHomeButton=window.dyFeedView;
  window.dyFeedView=function(){
    return dyFeedViewWithHomeButton.apply(this,arguments).replace('<div class="dy-topbar">','<div class="dy-topbar"><button class="dy-home-back" onclick="home()" aria-label="返回主屏幕"><svg viewBox="0 0 24 24" width="22" height="22"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>');
  };
})();
