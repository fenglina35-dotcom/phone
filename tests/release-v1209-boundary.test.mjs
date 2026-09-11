import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const b='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
test('v1237 keeps new lock and background scheduling code out of the website',()=>{
 const web=read('app.js'),html=read('小手机.html'),privateApp=read(b+'app.js');
 for(const marker of ['northNativeBackgroundTask','__smallPhoneBackgroundTaskSnapshot','private-smart-lock','homekit.lock.command']){assert(!web.includes(marker),marker);assert(!html.includes(marker),marker);}
 assert(privateApp.includes('northNativeBackgroundTask'));
 assert(read(b+'index.html').includes('private-smart-lock.js?v=339'));
 assert(read(b+'private-smart-lock.js').includes('homekit.lock.command'));
 const old=execFileSync('git',['show','afe3b4cbf96a3e42f5f4d39a1f2c8a9dd971f5de:smart-home.js'],{encoding:'utf8'});
 assert.equal(read('smart-home.js').replace(/\r\n/g,'\n'),old.replace(/\r\n/g,'\n'),'public smart-home implementation must be unchanged');
});
test('shared reply changes and game assets are retained by the private entry',()=>{
 for(const path of ['app.js',b+'app.js']){const s=read(path);for(const token of ['modelOutputUnfilteredToggle','lifeNoteReplyDraft','lifeNoteCommitReply','roleSocialIdentityPin','proactiveContinuationContext'])assert(s.includes(token),path+': '+token);}
 for(const p of ['cohab-theater.js','pixel-home.js','pixel-home-policy.js','pixel-wardrobe-info.js'])assert.equal(read(p),read(b+p),p);
 assert.equal(read(b+'index.html'),read(b+'小手机.html'));
 assert.equal(read(b+'private-smart-lock.js'),read('native/private-small-phone/Resources/Web/private-smart-lock.js'));
 assert.equal(read(b+'private-smart-lock.css'),read('native/private-small-phone/Resources/Web/private-smart-lock.css'));
});
