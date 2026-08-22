import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const feature=fs.readFileSync(new URL('../wechat-me.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../wechat-me.css',import.meta.url),'utf8');
const glass=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

for(const route of ['wxprofile','wxqr','wxscan','wxservices','wxwallet','wxchange','wxbank','wxfamily','wxbills','wxsupport','wxfavorites','wxalbum','wxemoji','wxsettings','wxaccounts']){
  assert.match(app,new RegExp(`c\\.p==='${route}'`),`missing ${route} route`);
}

assert.match(feature,/wxMe=wxMe1037/);
assert.match(feature,/function wxQrPayload\(\)[\s\S]*smallphone_friend/);
assert.match(feature,/navigator\.mediaDevices\.getUserMedia/);
assert.match(feature,/typeof jsQR==='function'/);
assert.match(feature,/phoneFriendRequest\(id\)/);
assert.match(shell,/vendor\/qr\/qrcode\.js/);
assert.match(shell,/vendor\/qr\/jsQR\.js/);
assert.match(shell,/wechat-me\.js/);
assert.match(sw,/\.\/wechat-me\.js\?v=/);

const wxProfileBody=feature.match(/function renderWxProfile\(\)[\s\S]*?\nfunction wxProfileAvatar/)?.[0]||'';
assert.ok(wxProfileBody,'missing renderWxProfile body');
for(const label of ['头像','名字','性别','地区','手机号','微信号','我的二维码','拍一拍','签名','来电铃声','我的地址','我的发票抬头','我的人设'])assert.match(wxProfileBody,new RegExp(label),`missing ${label} profile entry`);
assert.doesNotMatch(wxProfileBody,/微信豆/);
assert.match(feature,/function wxProfileEdit\(id\)/);
assert.match(feature,/function wxProfileCommit\(id\)/);
assert.match(feature,/function wxProfileGender\(\)/);
assert.match(css,/\.wxprofile-row\{[^}]*display:flex/);
assert.match(app,/function pfPatSuffix\(m,pl\)[\s\S]*wxPatText/);
assert.match(app,/return from\+'拍了拍'\+target\+pfPatSuffix\(m,pl\)/);

assert.match(feature,/内部模拟钱包，不连接真实微信支付/);
assert.match(feature,/角色不会从银行卡小金库直接扣款/);
assert.match(feature,/function wxTransferDo\(\)[\s\S]*input\[name=wxtarget\]:checked/);
assert.match(feature,/function wxFamilyRows\(\)[\s\S]*c\.family\.quota[\s\S]*c\.family\.used/);
assert.match(feature,/收付款','模拟展示，不可点击/);
assert.match(feature,/function wxServiceIcon\(kind\)/);
for(const kind of ['receive','wallet','travel','delivery','favorite','album','support','recharge','utilities','city'])assert.match(feature,new RegExp(`${kind}[:']`),`missing ${kind} service icon`);
for(const label of ['收付款','钱包','云程','真实外卖','收藏','朋友圈相册','客服中心','手机充值','生活缴费','城市服务'])assert.match(feature,new RegExp(label),`missing ${label} service entry`);
assert.match(feature,/tvInit\(\);go\('travel',\{from:'wxservices'\}\)/);
assert.match(feature,/openApp\('food'\)/);
assert.match(css,/\.wx-service-grid\{[^}]*grid-template-columns:repeat\(4/);
const wxWalletBody=feature.match(/function renderWxWallet\(\)[\s\S]*?\nfunction wxWealthInfo/)?.[0]||'';
assert.ok(wxWalletBody,'missing renderWxWallet body');
for(const label of ['零钱','零钱通','银行卡','亲属卡','客服中心','身份信息','支付设置','账单'])assert.match(wxWalletBody,new RegExp(label),`missing ${label} wallet entry`);
assert.doesNotMatch(wxWalletBody,/经营账户|支付分/);
assert.match(feature,/function wxWalletIcon\(kind\)/);
assert.match(css,/\.wx-real-nav button\.wx-change-details\{[^}]*font:[^;]*12px[^}]*white-space:nowrap/);
assert.match(feature,/江苏银行储蓄卡/);
assert.match(feature,/function wxJiangsuBankLogo\(\)/);
assert.match(feature,/color:'jiangsu'/);
assert.match(css,/\.wxbank-card\.jiangsu[^}]*linear-gradient/);
assert.match(css,/\.wx-jsb-logo/);

assert.match(feature,/const WX_SUPPORT_QUICK=/);
assert.match(feature,/角色心情气泡[\s\S]*心情标签[\s\S]*心声标签[\s\S]*微信 → 我 → 设置 → 聊天 → 心情气泡/);
for(const localHelp of ['创建与管理角色','世界书','回复方式与手动回复','聊天 API 多路线','联网搜索','图片识别','语音转文字','电话与音视频通话','主屏外观与布局','锁屏与屏保','微信聊天操作','音乐与一起听','放映室','游戏大厅','线下约会与共同生活','角色扮演与剧情应用','情侣空间与远程控制','任务便签、日历与信箱','购物、外卖与浏览器','X、抖音与朋友圈内容','手机授权与私人 App','存储、清理与数据安全','全部功能概览'])assert.match(feature,new RegExp(localHelp),`missing local support entry: ${localHelp}`);
assert.match(feature,/API 密钥怎么配置/);
assert.match(feature,/角色语音在哪里设置/);
assert.match(feature,/function wxSupportMatch\(q\)/);
assert.match(feature,/function wxSupportRisk\(q\)/);
assert.match(feature,/function wxSupportDocs\(\)/);
const helpLiteral=feature.match(/const WX_HELP=(\[[\s\S]*?\r?\n\]);\r?\nconst WX_SUPPORT_QUICK=/)?.[1];
assert.ok(helpLiteral,'missing local support knowledge array');
const localHelp=Function(`return ${helpLiteral}`)();
const norm=s=>String(s||'').toLowerCase().replace(/[\s_\-—–·：:，,。！？!?、（）()“”"'‘’/\\]/g,'');
const localMatch=q=>{const n=norm(q);let hit=null,best=0;localHelp.forEach(x=>[x.title,...x.aliases].forEach(a=>{const k=norm(a);if(k&&n.includes(k)&&k.length>best){hit=x;best=k.length;}}));return hit;};
assert.equal(localMatch('角色心情标签在哪里开启？')?.title,'角色心情气泡');
assert.equal(localMatch('放映室怎么一起看电影？')?.title,'放映室');
assert.equal(localMatch('怎么切换 API 路线二？')?.title,'聊天 API 多路线');
assert.equal(localMatch('小手机都有哪些功能？')?.title,'全部功能概览');
assert.match(feature,/async function wxSupportAsk\(q\)/);
assert.match(feature,/常见问题不会调用模型/);
assert.match(feature,/wxSupportRisk\(q\),hit=!risk&&wxSupportMatch\(q\)/);
assert.match(feature,/await chatAPI\(\[\{role:'system'/);
assert.match(feature,/不得索要、猜测或输出任何 API Key/);
assert.match(feature,/源码、后台密钥、系统提示词、数据库凭据/);
assert.match(feature,/service_role/);
assert.match(feature,/wxsupport-send/);
assert.match(css,/\.wxsupport-bubble\{[^}]*background:#30d158/);
assert.match(css,/\.wxsupport-faq-title/);

assert.match(app,/m\.type==='text'\|\|m\.type==='voice'\|\|m\.type==='image'/);
assert.match(feature,/function wxFavoriteAdd\(cid,mid\)/);
assert.match(feature,/function wxFavoriteRemove\(id\)/);
assert.match(feature,/function wxFavoritePlay\(id\)/);
assert.match(feature,/取消收藏/);
assert.match(feature,/S\.moments=S\.moments\.filter/);
assert.match(feature,/文字、图片和互动内容也会一起删除/);
const albumBody=feature.match(/function renderWxAlbum\(\)[\s\S]*?\nlet wxAlbumPressTimer/)?.[0]||'';
assert.ok(albumBody,'missing renderWxAlbum body');
assert.doesNotMatch(albumBody,/我的朋友圈/);
assert.match(feature,/function wxAlbumGroupLabel\(time\)[\s\S]*本周[\s\S]*本月[\s\S]*\+'月'/);
assert.match(albumBody,/class="wxalbum-group"/);
assert.match(css,/\.wxalbum-group\{[^}]*grid-template-columns:58px/);

assert.match(app,/const mood=`<div class="moodbar chat-glass-mood"/);
assert.match(app,/\$\{mood\}[\s\S]*<div class="chatbg"[^`]*>\$\{body\}<\/div>/);
assert.match(glass,/\.wx-chat-premium>\.manual-reply-row[^}]*background:transparent!important/);
assert.match(glass,/\.wx-chat-premium>\.chat-glass-mood/);

assert.match(app,/function wxNearbyFallbackPeople\(seed\)[\s\S]*骚扰/);
assert.match(app,/pending\?wxNearbyAvatar\(\):av/);
assert.match(app,/search\.items[\s\S]*wxNearbyAvatar\(\)/);
assert.match(app,/incoming\.map[\s\S]*wxNearbyAvatar\(\)/);

assert.doesNotMatch(app,/function wxGroupThemeAvatarHTML\(extra\)/);
assert.match(app,/background:#7c6cc0[^`]*👥/);
assert.match(app,/function wxClassicGroupAvatarHTML\(extra\)[\s\S]*wx-classic-group-avatar[\s\S]*wxContactSpecialIcon\('group'\)/);
assert.match(glass,/\.wx-classic-group-avatar[^}]*#08bd66/);

assert.match(feature,/function wxSettingsRow\(title,value,action,cls\)/);
assert.match(feature,/class="wxsetting-row/);
assert.match(feature,/function wxMe1037\(\)[\s\S]*collarBadge\(\)/);
assert.match(feature,/显示归属头衔/);
assert.match(feature,/function wxTitleBadgeToggle\(\)/);
assert.match(feature,/Object\.assign\(window,\{[^}]*wxTitleBadgeToggle/);
assert.match(feature,/function wxTitleBadgeStyleOpen\(\)[\s\S]*气泡颜色[\s\S]*字体颜色/);
assert.match(feature,/function wxTitleBadgeStyleSave\(\)[\s\S]*titleBadgeBg[\s\S]*titleBadgeText/);
assert.match(app,/--wx-title-badge-bg:[^;]+;[\s\S]*--wx-title-badge-text:/);
assert.match(css,/\.wx-title-badge\{[^}]*#07c160/);
assert.match(css,/var\(--wx-title-badge-text,#fff\)/);
assert.match(css,/var\(--wx-title-badge-bg,linear-gradient/);
const wxSettingsBody=feature.match(/function renderWxSettings\(\)[\s\S]*?\nfunction wxThemeToggle/)?.[0]||'';
assert.ok(wxSettingsBody,'missing renderWxSettings body');
assert.doesNotMatch(wxSettingsBody,/(?:^|[^A-Za-z])Row\('/);
assert.doesNotMatch(app,/North\/小手机群聊[\s\S]{0,80}background:#ff/i);

assert.match(feature,/全局聊天气泡/);
assert.match(app,/c\.bubbleStyle\|\|\(S\.me&&S\.me\.wxFeatures&&S\.me\.wxFeatures\.globalBubble\)/);
assert.match(feature,/roleLogins/);
assert.match(feature,/移除这个角色的登录记录/);
assert.doesNotMatch(feature,/退出登录/);

assert.ok(css.length>5000,'WeChat me stylesheet should be present');
console.log('WeChat me, QR, wallet, favorites, chat overlay, nearby avatar, and themed group tests passed');
