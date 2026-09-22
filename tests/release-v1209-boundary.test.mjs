import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const b='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
test('v1274 keeps new lock and background scheduling code out of the website',()=>{
 const web=read('app.js'),html=read('小手机.html'),privateApp=read(b+'app.js');
 for(const marker of ['northNativeBackgroundTask','__smallPhoneBackgroundTaskSnapshot','private-smart-lock','homekit.lock.command']){assert(!web.includes(marker),marker);assert(!html.includes(marker),marker);}
 assert(privateApp.includes('northNativeBackgroundTask'));
 assert(read(b+'index.html').includes('private-smart-lock.js?v=339'));
 assert(read(b+'private-smart-lock.js').includes('homekit.lock.command'));
 const smartHome=read('smart-home.js');
 assert(smartHome.includes('WEB_QUOTA_GUARD=true'),'website relay must use the zero-automatic-call quota guard');
 assert(!/WEB_PAGE_POLL_MS|WEB_IDLE_POLL_MS|scheduleWebPoll/.test(smartHome),'website relay must not retain automatic polling');
 for(const marker of ['private-smart-lock','homekit.lock.command'])assert(!smartHome.includes(marker),'public smart-home must exclude '+marker);
});
test('shared reply changes and game assets are retained by the private entry',()=>{
 for(const path of ['app.js',b+'app.js']){const s=read(path);for(const token of ['lifeNoteReplyDraft','lifeNoteCommitReply','roleSocialIdentityPin','proactiveContinuationContext'])assert(s.includes(token),path+': '+token);}
 /* 模型原文输出已升为全局默认，开关按用户要求移除；两侧都不能再留下切换入口。 */
 for(const path of ['app.js',b+'app.js'])assert(!read(path).includes('modelOutputUnfilteredToggle'),path+': 开关应已移除');
 for(const p of ['pixel-home.js','pixel-home-policy.js','pixel-wardrobe-info.js'])assert.equal(read(p),read(b+p),p);
 const webCohab=read('cohab-theater.js'),privateCohab=read(b+'cohab-theater.js');
 assert(webCohab.includes('ct_wechat_enabled'),'website keeps the optional WeChat guest switch');
 assert(webCohab.includes("guest2"),'website supports a second independent WeChat guest');
 assert(privateCohab.includes('ct_wechat_enabled'),'private bundle must retain the current optional WeChat guest switch');
 assert(privateCohab.includes("guest2"),'private bundle must retain the second independent WeChat guest');
 assert.equal(privateCohab,webCohab,'the private v1289 superset must carry the current shared theater source');
 assert.equal(read(b+'index.html'),read(b+'小手机.html'));
 assert.equal(read(b+'private-smart-lock.js'),read('native/private-small-phone/Resources/Web/private-smart-lock.js'));
 assert.equal(read(b+'private-smart-lock.css'),read('native/private-small-phone/Resources/Web/private-smart-lock.css'));
});
