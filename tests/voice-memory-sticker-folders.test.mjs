import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);let depth=0,quote='',escaped=false,regex=false,regexClass=false,prev='';
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(regex){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='[')regexClass=true;else if(ch===']')regexClass=false;else if(ch==='/'&&!regexClass)regex=false;continue;}
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='/'&&source[i+1]!=='/'&&source[i+1]!=='*'&&/[=(,:;!&|?\[{]/.test(prev)){regex=true;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
    if(!/\s/.test(ch))prev=ch;
  }
  throw new Error(`unterminated ${name}`);
}

const sandbox={S:{me:{name:'North'},aiStickers:[],aiStickerGroups:[]}};
vm.createContext(sandbox);
for(const name of ['memoryTopics','memoryAtoms','memoryTerms','aiMemoryDocs','aiMemoryExternalScore','aiMemoryRecallProbe','aiMemoryExternalItems','aiStickerGroups','aiStickerGroupName','aiPickSticker'])vm.runInContext(functionSource(name),sandbox);

const role={aiMemoryImports:[{name:'旧AI导出',importedAt:Date.now(),chunks:['用户喜欢雨天散步，也害怕打雷。','两个人曾约定每年生日一起旅行。','普通聊天记录片段。']} ]};
assert.equal(sandbox.aiMemoryRecallProbe('你还记得我们以前的事情吗'),true);
const recalled=sandbox.aiMemoryExternalItems(role,'你还记得我们以前的事情吗',Date.now());
assert.ok(recalled.length>=2,'generic recall questions should retrieve imported memory');
assert.ok(recalled.some(x=>x.source.includes('旧AI导出')));

sandbox.S.aiStickerGroups=[{id:'daily',name:'日常'},{id:'cute',name:'撒娇'}];
sandbox.S.aiStickers=[
  {img:'daily.png',meaning:'晚安',groupId:'daily'},
  {img:'cute.png',meaning:'开心',groupId:'cute'},
  {img:'old.png',meaning:'旧表情'},
];
assert.equal(sandbox.aiPickSticker('开心',{stickerGroups:['cute']}).img,'cute.png');
assert.equal(sandbox.aiPickSticker('晚安',{stickerGroups:['cute']}),sandbox.S.aiStickers[1],'selected role folders must filter the pool before meaning matching');
assert.ok(sandbox.aiPickSticker('晚安',{stickerGroups:[]}), 'roles without a folder selection must remain backward compatible');

assert.match(source,/每句之间停顿/);
assert.match(source,/setting=ttsVoiceProfile\(t,opt,tts,opt&&opt\.voice\)/);
assert.match(source,/hasNextSpoken&&voicePauseMs\(c\)>0/);
assert.match(source,/m\.role==='assistant'&&m\.type==='voice'/);
assert.match(source,/保存并重新生成/);
assert.match(source,/开心：https:\/\/example\.com\/happy\.jpg/);
assert.match(source,/data-sticker-group/);
assert.match(source,/_memLimits=onlineMemoryRecallLimits\(\)/);
assert.match(source,/selectRelevantMemory\(c,_memQuery,_memLimits\.total,_memLimits\)/);

console.log('voice, imported memory, and sticker folder tests passed');
