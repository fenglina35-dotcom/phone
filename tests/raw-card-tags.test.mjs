import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {read} from './_helpers.mjs';

// RAW_CARD_TAGS_V1（2026-11-03）：回复全走原文模式后，[心声彩蛋|…] 和 [要求报备|…] 只认语音/转账等几种卡片，
// 心声彩蛋被当成一大段文字发给她（用户截图）。现在原文模式也认这两种；不该发时整条不发。
test('raw output turns the thought card tag into a card and never shows the raw tag on both runtimes',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(import.meta.url),{chromium}=require('playwright'),path=require('node:path');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const priv of [false,true]){
  const label=priv?'private':'web',page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://127.0.0.1:8778')return route.abort();const f=path.resolve(decodeURIComponent(u.pathname.slice(1)));const ok=f.startsWith(process.cwd()+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile();return route.fulfill({status:ok?200:404,body:ok?(/\.(?:js|css|html)$/.test(f)?read(path.relative(process.cwd(),f)):fs.readFileSync(f)):'',contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});});
  await page.goto('http://127.0.0.1:8778/'+(priv?'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html':'小手机.html')+'?northPreview=black-home');await page.waitForFunction(()=>window.__northBootReady,{},{timeout:8000});
  const r=await page.evaluate(()=>{const thoughts=['第一次在微信找你的时候还挺紧张','看着你天天为排练喊累又心疼','不爱喝水的小毛病总改不掉','生病冲药跟要你命一样','连第一笔二十块钱都要跟我显摆','知道你其实比谁都嘴硬心软','每次查岗翻手机我都挺受用','给你买的暖宫贴记得天天贴','在学校食堂要乖乖吃正经饭','好想快点飞去把你喂胖','就算隔着屏幕也是我的小祖宗','只要你喊哥哥我就没脾气了','以后所有委屈都来找我倾诉','在一起九十四天还是只想要你','明天开幕式要漂漂亮亮的','名分早就给你整个人都是你的'];
   const line='[心声彩蛋|想对你说的话其实攒了挺久|'+thoughts.join(';')+'|乖乖听话哥哥一直在呢]',c=S.contacts[0];c.thoughtEggLastAt=0;c.thoughtEggHistory=[];
   const fresh=modelUnfilteredMessages(line,c).map(m=>m.type);
   const cooling=modelUnfilteredMessages(line.replace('攒了挺久','又攒了一些'),c).map(m=>m.type);
   const check=modelUnfilteredMessages('[要求报备|你现在在哪]',c).map(m=>m.content||m.type);
   const plain=modelUnfilteredMessages('我在呢',c).map(m=>m.content);
   return {fresh,cooling,check,plain};});
  assert.deepEqual(r.fresh,['thoughtcard'],label+': thought card tag becomes a card');
  assert.deepEqual(r.cooling,[],label+': a card that may not be sent is dropped, not shown as raw text');
  assert(!r.check.some(x=>/要求报备/.test(String(x))),label+': check request tag is never shown as raw text');
  assert.deepEqual(r.plain,['我在呢']);assert.deepEqual(errors,[]);
  await page.close();
 }}finally{await browser.close();}
});
