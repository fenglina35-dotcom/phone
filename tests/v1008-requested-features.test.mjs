import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../小手机.html',import.meta.url),'utf8');
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
  assert.match(items,/m\.type==='image'&&m\.src&&!m\.pending&&m\._coupleAlbumSaved===true/);
  assert.match(items,/owner:m\.role==='assistant'\?'ta':'me'/);
  assert.match(functionSource('coupleAlbumUpload'),/runVisionForMessage|coupleAlbumDescribe/);
  assert.match(functionSource('coupleAlbumPrompt'),/没有描述的照片不能猜内容/);
  assert.match(functionSource('coupleAlbumConsumeSaveTag'),/存共同相册/);
  assert.match(functionSource('lineToMsg'),/_coupleAlbumSaved:albumSaved/);
  assert.match(app,/共同相册收录规则/);
  assert.match(app,/不要把每张普通照片都存进共同相册/);
  assert.match(app,/id="cou_album"/);
  assert.match(app,/不会生成或补造假照片/);
});

test('shared album deletes exactly one selected photo without deleting its original WeChat message',()=>{
  const items=functionSource('coupleAlbumItems'),remove=functionSource('coupleAlbumDelete');
  assert.match(items,/hidden=new Set\(coupleAlbumHidden\(\)\)/);
  assert.match(remove,/source==='album'/);
  assert.match(remove,/source\+':'\+id/);
  assert.match(remove,/albumHidden|coupleAlbumHidden/);
  assert.match(remove,/不会删除微信聊天里的原图或其他照片/);
  assert.doesNotMatch(remove,/msgsForAccount|S\.messages|\.messages\.splice/);
  assert.ok((app.match(/coupleAlbumDelete\(\$\{jq\(x\.source\)\},\$\{jq\(x\.id\)\}\)/g)||[]).length>=2,'both the preview and full album expose single-photo delete');
});

test('Moment replies refresh only their social slot and stored images decode before the viewer reveals them',()=>{
  const keep=functionSource('momentRenderKeepScroll'),open=functionSource('viewImg'),resolve=functionSource('viewerImageSource');
  assert.match(keep,/if\(pid&&momentSocialRefresh\(pid\)\)return/);
  assert.match(app,/data-moment-social=/);
  assert.match(app,/momentRenderKeepScroll\(live\.id\)/);
  assert.doesNotMatch(app,/delete targetComment\._roleReplyError;save\(\);momentRenderKeepScroll\(\)/);
  assert.match(resolve,/s\.indexOf\('idb:'\)!==0/);
  assert.match(resolve,/await imgGet\(key\)/);
  assert.match(open,/await viewerImageSource\(s\)/);
  assert.match(open,/await viewerImageDecoded\(src\)/);
  assert.ok(open.indexOf('await viewerImageDecoded(src)')<open.indexOf('img.src=src'),'viewer must decode before revealing the real image');
  assert.match(html,/viewer\.loading:after\{content:'正在载入照片/);
  assert.doesNotMatch(open,/img\.src=s;[^}]*classList\.add\('show'\)/);
});

test('role model and role-WeChat login entries are moved to the requested pages',()=>{
  assert.match(functionSource('renderContactSettings'),/主模型 \/ 副模型/);
  assert.match(functionSource('accountMgr'),/登录角色微信/);
  assert.match(functionSource('accountRoleWechatOpen'),/hisLoginOpen/);
  assert.doesNotMatch(functionSource('renderRoleManagementAll'),/>聊天模型</);
  assert.doesNotMatch(functionSource('renderRoleManagementAll'),/>登录ta的微信</);
});

test('phone life notes can switch between automatic and manual-only recording without deleting history',()=>{
  const page=functionSource('spyLifeNoteSec');
  assert.match(functionSource('lifeNoteOnUserMsg'),/!lifeNotesAutoOn\(\)/);
  assert.match(page,/角色自动记录/);
  assert.match(page,/lifeNoteTags\(n\)\.map/);
  assert.match(page,/class="sw \$\{lifeNotesAutoOn\(\)\?'on':''\}"/);
  assert.doesNotMatch(page,/\$\{sw\(/,'life-note page must not call an undefined switch renderer');
  assert.match(functionSource('lifeNoteTags'),/typeof raw==='string'/);
  assert.match(functionSource('lifeNotesAutoToggle'),/现有内容保留/);
  assert.doesNotMatch(functionSource('lifeNotesAutoToggle'),/splice|length=0|lifeNotes\(\)\.length/);
  const render=Function('lifeNotes','lifeNotesAutoOn','esc','aboutMeNoteText','fmtDT','lifeNoteTags','lifeTagName','S',`${page};return spyLifeNoteSec;`)(
    ()=>[],()=>true,x=>String(x),x=>String(x),()=>'',()=>[],x=>x,{me:{name:'North'}}
  );
  assert.match(render('role-1'),/role="switch" aria-checked="true"/);
});

test('the private-App spy lock screen restores stored role avatars instead of printing idb references',()=>{
  const avatar=functionSource('spyLockAvatar'),screen=functionSource('spyLockScreen');
  assert.match(avatar,/isStoredImgRef\(v\)/);
  assert.match(avatar,/data-idb-avatar=/);
  assert.match(avatar,/_imgCache\[key\]/);
  assert.match(screen,/const av2=spyLockAvatar\(c\)/);
});

test('background tests yield to real chat and terminate inside the claim lease',()=>{
  assert.match(edge,/decisionDeadline = Date\.now\(\) \+ 58_000/);
  assert.match(edge,/AbortController/);
  assert.match(edge,/task\.kind === "one_minute_test" \|\| task\.kind === "app_watch_test"[\s\S]*?\? 1/);
  assert.match(migration,/kind in \('app_followup', 'one_minute_test', 'app_watch_test'\)/);
  assert.match(functionSource('pushMsg'),/roleBackgroundCancel\(id,\['one_minute_test','app_watch_test'\]\)/);
});
