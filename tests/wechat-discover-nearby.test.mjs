import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../glass-theme.css',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');

function functionSource(name){
  const start=app.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  let brace=app.indexOf('{',start),depth=0,quote='',escape=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote='';continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const discover=functionSource('wxDiscover');
for(const label of ['朋友圈','视频号','听一听','看一看','搜一搜','附近的人','游戏'])assert.match(discover,new RegExp(label));
assert.doesNotMatch(discover,/直播|扫一扫|小程序/);
assert.match(functionSource('wxDiscoverRow'),/appLocked\(lockKey\)[\s\S]*disabled[\s\S]*locked/);

const discoverIcons=functionSource('wxDiscoverIcon');
assert.match(discoverIcons,/moments:[\s\S]*#f2c94c[\s\S]*#eb5757[\s\S]*#2f80ed[\s\S]*#27ae60/);
assert.match(discoverIcons,/music:[\s\S]*ellipse[\s\S]*ellipse/);
assert.match(discoverIcons,/search:'<circle[\s\S]*6\.4 6\.4/);
assert.match(discoverIcons,/games:[\s\S]*#2f80ed[\s\S]*#27ae60[\s\S]*#eb5757[\s\S]*#9b51e0/);

const open=functionSource('wxDiscoverOpen');
for(const key of ['moments','music','cinema','browser','games'])assert.match(open,new RegExp(`${key}:'${key}'`));
assert.doesNotMatch(open,/kind==='live'/);
assert.match(open,/_dyFromWx=true[\s\S]*dyTab='feed'[\s\S]*go\('dy',\{from:'wechat'\}\)/);
assert.match(functionSource('dyBack'),/_dyFromWx[\s\S]*back\(\)/);

assert.match(functionSource('renderWeChat'),/wxTab==='moments'\)body=wxDiscover\(\)/);
assert.match(functionSource('renderWxMomentFeed'),/momentTools\(\)[\s\S]*wxMoments\(\)/);
assert.match(functionSource('renderWxLive'),/直播功能开发中/);

assert.match(functionSource('wxNearbyRefresh'),/aiGen\([\s\S]*生成12个[\s\S]*wxNearbyFallbackPeople/);
assert.match(functionSource('wxNearbyAdd'),/acceptAt:Date\.now\(\)\+10000[\s\S]*setTimeout\(\(\)=>wxNearbySweep\(false\),10050\)/);
assert.match(functionSource('wxNearbyContact'),/S\.contacts\.push\(c\)[\s\S]*附近的人/);
assert.match(functionSource('wxNearbySweep'),/status='accepted'[\s\S]*scheduleReply/);
assert.match(functionSource('friendRequestSweep'),/wxNearbySweep\(false\)/);

assert.match(css,/\.wx-discover-row\.locked\{[^}]*opacity:[^}]*filter:grayscale\(1\)[^}]*pointer-events:none/);
assert.match(css,/\.wx-nearby-avatar/);
for(const removed of ['offInputStabilize','offInputPointerDown','offInputMount']){
  assert.equal(app.includes(`function ${removed}(`),false,`${removed} must stay removed so the native textarea and keyboard keep working`);
}
assert.doesNotMatch(app,/if\(c\.p==='off'\)offInputMount\(\)/);
assert.match(shell,/\.offinput #off_in\{[^}]*height:42px!important[^}]*line-height:42px!important[^}]*touch-action:manipulation/);
assert.match(app,/cohabSettingsPanelBase[\s\S]*cohab-settings-wrap/);
assert.match(shell,/\.cohab-settings\[open\]\+\.cohab-debug-reply\{display:none\}/);
assert.match(shell,/\.cohab-nav \.off-nav-actions \.cohab-status-chip\{[^}]*min-width:70px[^}]*max-width:142px/);

console.log('wechat discover, nearby people, lock state, and offline input focus tests passed');
