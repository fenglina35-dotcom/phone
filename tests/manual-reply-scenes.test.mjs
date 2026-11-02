import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const asyncStart=source.indexOf(`async function ${name}(`);
  const start=asyncStart>=0?asyncStart:source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const options=[
  {key:'wechat',label:'微信聊天'},
  {key:'games',label:'游戏大厅'},
  {key:'roleplay',label:'角色扮演'},
  {key:'offline',label:'线下约会'},
];

function sceneContext(legacy){
  const context=vm.createContext({
    S:{settings:{manualReply:legacy}},
    MANUAL_REPLY_SCENE_OPTIONS:options,
    save:()=>{context.saved=(context.saved||0)+1;},
    render:()=>{context.rendered=(context.rendered||0)+1;},
  });
  vm.runInContext(functionSource('manualReplyScenes')+'\n'+functionSource('manualReplySceneOn')+'\n'+functionSource('manualReplySceneToggle'),context);
  return context;
}

const enabled=sceneContext(true);
assert.deepEqual({...enabled.manualReplyScenes()},{wechat:true,games:true,roleplay:true,offline:true},'the old enabled preference should migrate to every requested chat scene');
enabled.manualReplySceneToggle('games');
assert.equal(enabled.manualReplySceneOn('games'),false);
assert.equal(enabled.manualReplySceneOn('wechat'),true,'each scene must be independently selectable');
assert.equal(enabled.saved,1);

const disabled=sceneContext(false);
assert.deepEqual({...disabled.manualReplyScenes()},{wechat:false,games:false,roleplay:false,offline:false},'the old disabled preference should preserve automatic replies');

assert.match(functionSource('renderSettings'),/手动回复场景（可多选）/);
assert.match(functionSource('renderSettings'),/manualReplySceneToggle/);
assert.match(functionSource('scheduleReply'),/manualReplySceneOn\('wechat'\)/);
assert.match(functionSource('renderChat'),/manualReplySceneOn\('wechat'\)/);

assert.match(functionSource('renderGS'),/manualReplySceneOn\('games'\)/);
assert.match(functionSource('renderGS'),/gsManualReply\(\)/);
assert.match(functionSource('gsSend'),/manualReplySceneOn\('games'\).*gsRender\(\).*gsReply\(\)/);
assert.match(functionSource('gsDice'),/manualReplySceneOn\('games'\).*gsRender\(\).*gsReply\(\)/);

assert.match(functionSource('renderRP'),/renderDateScene\(id,rpData\(id\),true\)/);assert.match(functionSource('renderDateScene'),/manualReplySceneOn\(story\?'roleplay':'offline'\)/);
assert.match(functionSource('rpSay'),/!manualReplySceneOn\('roleplay'\).*rpAI\(\)/);
assert.match(functionSource('rpSaveNarrate'),/goOn\|\|!manualReplySceneOn\('roleplay'\)/);

assert.match(functionSource('renderOff'),/renderDateScene\(id,o,false\)/);
assert.match(functionSource('offSay'),/!manualReplySceneOn\('offline'\).*offAI\(\)/);
assert.match(functionSource('offNarrate'),/narrateMode=!offNarrationMode\(\)/);
assert.doesNotMatch(functionSource('offNarrate'),/prompt\(/);
assert.match(functionSource('offSay'),/offNarrationMode\(\).*who:'旁白',source:'me'/);
