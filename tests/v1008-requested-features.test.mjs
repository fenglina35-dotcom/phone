import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/phone-role-push/index.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202608200003_background_test_yield_to_chat.sql',import.meta.url),'utf8');

function functionSource(name){
  const markers=[`async function ${name}(`,`function ${name}(`];
  const start=markers.map(x=>app.indexOf(x)).filter(x=>x>=0).sort((a,b)=>a-b)[0];
  assert.notEqual(start,undefined,`missing ${name}`);
  const brace=app.indexOf('{',start);let depth=0,quote='',escaped=false;
  for(let i=brace;i<app.length;i++){
    const ch=app[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return app.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

test('shared album contains only real stored images and exposes them to the bound role',()=>{
  const items=functionSource('coupleAlbumItems');
  assert.match(items,/m\.type==='image'&&m\.src&&!m\.pending/);
  assert.match(items,/owner:m\.role==='assistant'\?'ta':'me'/);
  assert.match(functionSource('coupleAlbumUpload'),/runVisionForMessage|coupleAlbumDescribe/);
  assert.match(functionSource('coupleAlbumPrompt'),/没有描述的照片不能猜内容/);
  assert.match(app,/id="cou_album"/);
  assert.match(app,/不会生成或补造假照片/);
});

test('role model and role-WeChat login entries are moved to the requested pages',()=>{
  assert.match(functionSource('renderContactSettings'),/主模型 \/ 副模型/);
  assert.match(functionSource('accountMgr'),/登录角色微信/);
  assert.match(functionSource('accountRoleWechatOpen'),/hisLoginOpen/);
  assert.doesNotMatch(functionSource('renderRoleManagementAll'),/>聊天模型</);
  assert.doesNotMatch(functionSource('renderRoleManagementAll'),/>登录ta的微信</);
});

test('phone life notes can switch between automatic and manual-only recording without deleting history',()=>{
  assert.match(functionSource('lifeNoteOnUserMsg'),/!lifeNotesAutoOn\(\)/);
  assert.match(functionSource('spyLifeNoteSec'),/角色自动记录/);
  assert.match(functionSource('lifeNotesAutoToggle'),/现有内容保留/);
  assert.doesNotMatch(functionSource('lifeNotesAutoToggle'),/splice|length=0|lifeNotes\(\)\.length/);
});

test('background tests yield to real chat and terminate inside the claim lease',()=>{
  assert.match(edge,/decisionDeadline = Date\.now\(\) \+ 58_000/);
  assert.match(edge,/AbortController/);
  assert.match(edge,/task\.kind === "one_minute_test" \|\| task\.kind === "app_watch_test"[\s\S]*?\? 1/);
  assert.match(migration,/kind in \('app_followup', 'one_minute_test', 'app_watch_test'\)/);
  assert.match(functionSource('pushMsg'),/roleBackgroundCancel\(id,\['one_minute_test','app_watch_test'\]\)/);
});
