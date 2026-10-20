import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(new URL('../package.json',import.meta.url)));
const privateRoot=path.join(root,'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle');
const publicShell=fs.readFileSync(path.join(root,'小手机.html'),'utf8');
const privateShell=fs.readFileSync(path.join(privateRoot,'小手机.html'),'utf8');

function localAssets(shell,tag,attr){
  const re=new RegExp(`<${tag}[^>]*\\b${attr}="([^"?#]+)(?:[?#][^"]*)?"`,'g');
  return [...shell.matchAll(re)].map(match=>match[1]).filter(value=>!/^https?:|^data:|^blob:/.test(value));
}

// couple-windowsill.js is the web's own windowsill wrapper (COUPLE_WINDOWSILL_WEB_V1); the private app has its own
// private-couple-windowsill.js (her name, private features), so it must not be copied over.
const deploymentOnly=new Set(['web-hotfix.js','couple-windowsill.js']);

test('private shell contains every public runtime and stylesheet',()=>{
  for(const [tag,attr] of [['script','src'],['link','href']]){
    const publicAssets=localAssets(publicShell,tag,attr).filter(asset=>!deploymentOnly.has(asset));
    const privateAssets=new Set(localAssets(privateShell,tag,attr));
    for(const asset of publicAssets){
      assert.ok(privateAssets.has(asset),`private shell omitted public asset ${asset}`);
      assert.ok(fs.existsSync(path.join(privateRoot,asset)),`private package omitted public file ${asset}`);
    }
  }
});

// Compare behavior-bearing code, not merely whether both shells list the same filenames.
const webCore=fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/\r\n/g,'\n');
const privateCore=fs.readFileSync(path.join(privateRoot,'app.js'),'utf8').replace(/\r\n/g,'\n');
function sharedFunction(source,name){const m=new RegExp('^(?:async )?function '+name+'\\(','m').exec(source);assert(m,'missing '+name);const tail=source.slice(m.index+1),next=/^(?:(?:async )?function |(?:const|let|var) )/m.exec(tail);return source.slice(m.index,next?m.index+1+next.index:undefined).trim();}
for(const name of ['wxSearchChats','wxSearchBodyHTML','wxSearchOpen','wxSearchJump','chatJumpToMessage','restoreRenderScroll','gsearchRows','gsearchResultHTML','groupReplyPlan','groupTotalCap','aiGroupReplyRun','gsettingsSave','renderGroupSettingsPage','bubbleSingleLook','summaryPerspectiveIssue','summaryPerspectiveValid','manualWechatSummary','hisSeed','hisMsgKey','hisCollapseRepeats','roleTextTranslationRun','roleTextTranslationFlush','roleTextTranslationSchedule','retryRoleTextTranslation']){
 test('private inherits the audited web behavior: '+name,()=>assert.equal(sharedFunction(privateCore,name),sharedFunction(webCore,name),name));
}
test('both private entrypoints include search theme, highlight and the CSS retry definition',()=>{for(const entry of ['index.html','小手机.html']){const s=fs.readFileSync(path.join(privateRoot,entry),'utf8');for(const marker of ['.wxs-page{','.wxlight .wxs-page{','.wxs-count i{','@keyframes msgJumpHit','window.__northCssRetry=function'])assert(s.includes(marker),entry+' missing '+marker);}});
