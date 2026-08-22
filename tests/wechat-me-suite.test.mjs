import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const feature=fs.readFileSync(new URL('../wechat-me.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../wechat-me.css',import.meta.url),'utf8');
const glass=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../native/private-small-phone/Resources/private-phone-web.manifest.json',import.meta.url),'utf8'));

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
assert.ok(manifest.files.includes('wechat-me.js'));
assert.ok(manifest.files.includes('wechat-me.css'));

assert.match(feature,/内部模拟钱包，不连接真实微信支付/);
assert.match(feature,/角色不会从银行卡小金库直接扣款/);
assert.match(feature,/function wxTransferDo\(\)[\s\S]*input\[name=wxtarget\]:checked/);
assert.match(feature,/function wxFamilyRows\(\)[\s\S]*c\.family\.quota[\s\S]*c\.family\.used/);
assert.match(feature,/收付款','模拟展示，不可点击/);

assert.match(app,/m\.type==='text'\|\|m\.type==='voice'\|\|m\.type==='image'/);
assert.match(feature,/function wxFavoriteAdd\(cid,mid\)/);
assert.match(feature,/function wxFavoriteRemove\(id\)/);
assert.match(feature,/function wxFavoritePlay\(id\)/);
assert.match(feature,/取消收藏/);
assert.match(feature,/S\.moments=S\.moments\.filter/);
assert.match(feature,/文字、图片和互动内容也会一起删除/);

assert.match(app,/const mood=`<div class="moodbar chat-glass-mood"/);
assert.match(app,/<div class="chatbg"[^`]*>\$\{mood\}\$\{body\}<\/div>/);
assert.match(glass,/\.wx-chat-premium>\.manual-reply-row[^}]*background:transparent!important/);
assert.match(glass,/\.wx-chat-premium \.chatbg>\.chat-glass-mood/);

assert.match(app,/function wxNearbyFallbackPeople\(seed\)[\s\S]*骚扰/);
assert.match(app,/pending\?wxNearbyAvatar\(\):av/);
assert.match(app,/search\.items[\s\S]*wxNearbyAvatar\(\)/);
assert.match(app,/incoming\.map[\s\S]*wxNearbyAvatar\(\)/);

assert.match(app,/function wxGroupThemeAvatarHTML\(extra\)/);
assert.match(glass,/\.wxlight \.wx-group-theme-avatar[^}]*#f3f4f6[^}]*#dfe1e5/);
assert.match(glass,/\.wxlight \.wx-group-theme-avatar[^}]*border-color:rgba\(31,34,40,\.18\)[^}]*box-shadow/);
assert.doesNotMatch(app,/North\/小手机群聊[\s\S]{0,80}background:#ff/i);

assert.match(feature,/全局聊天气泡/);
assert.match(app,/c\.bubbleStyle\|\|\(S\.me&&S\.me\.wxFeatures&&S\.me\.wxFeatures\.globalBubble\)/);
assert.match(feature,/roleLogins/);
assert.match(feature,/移除这个角色的登录记录/);
assert.doesNotMatch(feature,/退出登录/);

assert.ok(css.length>5000,'WeChat me stylesheet should be present');
console.log('WeChat me, QR, wallet, favorites, chat overlay, nearby avatar, and themed group tests passed');
