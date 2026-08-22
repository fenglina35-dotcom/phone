import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const glass=fs.readFileSync(path.join(root,'glass-theme.css'),'utf8');
const meCss=fs.readFileSync(path.join(root,'wechat-me.css'),'utf8');
const meJs=fs.readFileSync(path.join(root,'wechat-me.js'),'utf8');
const html=fs.readFileSync(path.join(root,'小手机.html'),'utf8');

// 微信运动恢复的是原有的本机运动传感器计步，不是另造模拟数值。
assert.match(app,/function stepMotion\(e\)[\s\S]*S\.me\.steps=\(S\.me\.steps\|\|0\)\+1/);
assert.match(app,/function toggleSteps\(\)[\s\S]*addEventListener\('devicemotion',_stepHandler\)/);
assert.match(app,/function renderWxSteps\(\)[\s\S]*onclick="wxStepsToggle\(\)"/);
assert.match(app,/const firstRegular=entries\.findIndex\(x=>!x\.pinned\),motionAt=firstRegular<0\?entries\.length:firstRegular/);
assert.match(app,/entries\.slice\(0,motionAt\)[\s\S]*wxStepsChatRow\(\)[\s\S]*entries\.slice\(motionAt\)/);
assert.match(app,/function wxStepsToggle\(\)[\s\S]*await toggleSteps\(\)/);
assert.match(app,/function wxChats\(\)[\s\S]*wxStepsChatRow\(\)/);
assert.match(app,/mode\.includes\('steps-on'\)[\s\S]*S\.me\.steps=6382/);
assert.match(app,/function glassReferenceLayout\(\)\{\}/);
assert.match(app,/c\.p==='wxsteps'/);
assert.match(glass,/\.wx-steps-chat-row/);
assert.match(glass,/\.wxsteps-page/);

// 一次性线下约会的标题与右侧操作必须各占网格，不能再互相覆盖。
assert.match(app,/class="nav offnav off-date-nav"/);
assert.match(html,/\.off-date-nav\{[^}]*grid-template-columns:34px minmax\(0,1fr\) auto/);
assert.match(html,/\.off-date-nav>\.off-nav-actions\{[^}]*position:static/);

// 编辑角色的成对字段改为逐行展示，长职业、称呼和消息数量不能再被双列网格截断。
assert.match(glass,/\.wx-contact-editor\{[^}]*overflow-x:hidden/);
assert.match(glass,/\.wx-editor-two\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
assert.match(glass,/\.wx-editor-two label>span\{[^}]*flex:0 0 96px[^}]*overflow:visible/);
assert.match(glass,/\.wx-contact-editor label input[^}]*max-width:100%/);

// 通话头像支持持久化图片引用，通话层始终有不透明背景并且退出时清理。
assert.match(app,/function callStoredImageSource\(v\)/);
assert.match(app,/function callApplyBackdrop\(L,c\)/);
assert.match(app,/function callAvatarHTML\(c\)/);
assert.match(app,/function renderCall\(\)[\s\S]*callApplyBackdrop\(L,c\)/);
assert.match(app,/function renderCallReplay\(\)[\s\S]*callApplyBackdrop\(L,c\)/);
  assert.match(html,/\.callscreen\.show:not\(\.mini\)\{[^}]*background-color:#101117/);
assert.match(html,/\.call-avatar-node/);

// 亲属卡保留真实额度数据，但卡面使用独立的高级立体层次。
assert.match(meJs,/class="wxfamily-card"/);
assert.match(meJs,/c\.family\.used/);
assert.match(meJs,/c\.family\.quota/);
assert.match(meCss,/\.wxfamily-card\{/);
assert.match(meCss,/\.wxfamily-orbit/);
assert.match(meCss,/\.wxfamily-chip/);

console.log('v1045 WeChat steps, offline header, call backdrop, editor layout and family card regressions passed');
