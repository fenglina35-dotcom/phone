from pathlib import Path
import re
R=Path(__file__).resolve().parents[1]; W=R/'games/pixel-home/wardrobe'
for name in ['app.js','host.js','engine-source.js']:
 p=W/name;s=p.read_text('utf-8');s=s.replace('function valid(s,c){','function validLook(s,c){',1)
 pos=s.index('\nfunction getAdjust')
 s=s[:pos]+'''
function valid(s,c,nested=false){
 if(!validLook(s,c))return false;
 if(s.savedOutfits===undefined)return true;
 if(nested||!Array.isArray(s.savedOutfits)||s.savedOutfits.length>30)return false;
 const ids=new Set();return s.savedOutfits.every(p=>{if(!p||typeof p.id!=='string'||!/^set-[\\w-]{1,80}$/.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>30||/[\\u0000-\\u001f]/.test(p.name)||!valid(p.look,c,true))return false;ids.add(p.id);return true;});
}
'''+s[pos:]
 # Library edits are not visual changes; exclude them from per-frame sprite keys.
 s=s.replace('const key=JSON.stringify(s);','const {savedOutfits,...visibleState}=s;const key=JSON.stringify(visibleState);')
 p.write_text(s,'utf-8')
p=W/'app.js';s=p.read_text('utf-8')
s=s.replace("const categories={outfits:'套装',", "const categories={outfits:'套装',custom:'我的套装',")
s=s.replace("function rack(){const list=", "function rack(){document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));if(category==='custom'){customRack();return;}const list=")
s=s.replace("JSON.stringify(d.assetHashes)!==JSON.stringify(catalog.files)","![catalog.files,...(catalog.compatibleAssetHashes||[])].some(h=>JSON.stringify(d.assetHashes)===JSON.stringify(h))")
s=s.replace('remember();state=d.state;targets();rack();save()',"remember();state={...d.state,savedOutfits:d.state.savedOutfits??state.savedOutfits??[]};targets();rack();save()")
s=s.replace("'我的衣柜-配置-P82.json'","'我的衣柜-配置-v1205.json'")
s=s.replace("e.preventDefault();save();parent.postMessage({type:'pixel-wardrobe-close'}", "e.preventDefault();if(!save())return;parent.postMessage({type:'pixel-wardrobe-close'}")
s=s.replace("function remember(){history.push(structuredClone(state));", "function remember(){history.push(structuredClone(state));")
custom=r'''
// Each saved set is a detached look, never a recursive copy of the library.
function setLook(){const ids=selectedIDs();return{version:state.version,dress:state.dress,shoes:state.shoes,hair:state.hair,face:state.face,accessory:state.accessory,motion:state.motion,body:structuredClone(bodyParams(state)),adjustments:structuredClone(Object.fromEntries(Object.entries(state.adjustments).filter(([k])=>ids.some(id=>k===id||k.startsWith(id+'/')||k.startsWith(id+'@'))))) };}
function saveMutation(next,message){const before=state;state=next;if(!save()){state=before;return false;}history=[];targets();rack();$('#motion').setAttribute('aria-pressed',String(state.motion));notify(message);return true;}
function wearSet(p){const ids=[p.look.dress,p.look.shoes,p.look.hair,p.look.face,p.look.accessory].filter(Boolean);const keep=Object.fromEntries(Object.entries(state.adjustments).filter(([k])=>!ids.some(id=>k===id||k.startsWith(id+'/')||k.startsWith(id+'@'))));saveMutation({...state,...structuredClone(p.look),adjustments:{...keep,...structuredClone(p.look.adjustments)},savedOutfits:state.savedOutfits},'已穿上「'+p.name+'」');}
let setAction=null;
function setDialog(mode,p){if(!ready)return;if(mode==='new'&&(state.savedOutfits||[]).length>=30){notify('最多保存30套，请先整理已有套装');return;}setAction={mode,id:p?.id};$('#set-dialog-title').textContent={new:'保存自定义套装',rename:'修改套装名称',update:'更新这套搭配',delete:'删除这套搭配'}[mode];$('#set-name-row').hidden=['update','delete'].includes(mode);$('#set-name').value=p?.name||'';$('#set-name').required=!$('#set-name-row').hidden;$('#set-message').textContent=mode==='update'?'用当前穿搭和调整参数替换「'+p.name+'」。':mode==='delete'?'删除「'+p.name+'」？当前穿搭仍会保留。':'保存衣服、鞋袜、发型、五官、发饰和当前调整参数。';$('#set-confirm').textContent={new:'保存套装',rename:'保存名称',update:'确认更新',delete:'确认删除'}[mode];$('#set-dialog').showModal();if(!$('#set-name-row').hidden)$('#set-name').focus();}
$('#save-custom').onclick=()=>setDialog('new');$('#set-cancel').onclick=()=>$('#set-dialog').close();
$('#set-form').onsubmit=e=>{e.preventDefault();if(!setAction)return;const {mode,id}=setAction;const name=$('#set-name').value.trim();if(['new','rename'].includes(mode)&&(!name||name.length>30||/[\u0000-\u001f]/.test(name))){notify('请输入1至30字的套装名称');return;}let entries=structuredClone(state.savedOutfits||[]);if(mode==='new')entries.push({id:'set-'+(crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),name,look:setLook()});else{const p=entries.find(x=>x.id===id);if(!p)return;if(mode==='rename')p.name=name;if(mode==='update')p.look=setLook();if(mode==='delete')entries=entries.filter(x=>x.id!==id);}
 const beforeCategory=category;category='custom';if(saveMutation({...state,savedOutfits:entries},mode==='delete'?'套装已删除':'套装已保存')){$('#set-dialog').close();}else category=beforeCategory;
};
function customRack(){const rack=$('#rack');rack.replaceChildren();const list=state.savedOutfits||[];if(!list.length){const empty=document.createElement('p');empty.className='empty-sets';empty.textContent='搭配好后，点击「存为套装」，就能在这里一键换装。';rack.append(empty);return;}
 for(const p of list){const card=document.createElement('article');card.className='saved-set';const wear=document.createElement('button');wear.className='card';wear.setAttribute('aria-label','穿上 '+p.name);const c=document.createElement('canvas');c.width=160;c.height=200;c.setAttribute('aria-hidden','true');const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.translate(80,2);g.scale(.125,.125);g.translate(-512,0);render(g,catalog,images,{...p.look,body:{...p.look.body,size:100}});const label=document.createElement('span');label.textContent=p.name;wear.append(c,label);wear.onclick=()=>wearSet(p);const actions=document.createElement('div');actions.className='set-actions';for(const [mode,text]of [['rename','改名'],['update','更新'],['delete','删除']]){const b=document.createElement('button');b.textContent=text;b.setAttribute('aria-label',text+' '+p.name);b.onclick=()=>setDialog(mode,p);actions.append(b);}card.append(wear,actions);rack.append(card);}
}
'''
s=s.replace("try{({catalog,images}=await loadCatalog());",custom+"\ntry{({catalog,images}=await loadCatalog());")
p.write_text(s,'utf-8')
p=W/'index.html';s=p.read_text('utf-8').replace('<button id="save">保存搭配</button>','<div class="save-buttons"><button id="save-custom">存为套装</button><button id="save">保存搭配</button></div>')
dialog='''<dialog id="set-dialog"><form id="set-form"><h2 id="set-dialog-title">保存自定义套装</h2><p id="set-message"></p><label id="set-name-row">套装名称<input id="set-name" aria-label="套装名称" maxlength="30" autocomplete="off" required placeholder="例如：周末小白裙"></label><div class="dialog-actions"><button id="set-cancel" type="button">取消</button><button id="set-confirm" type="submit">保存套装</button></div></form></dialog>'''
s=s.replace('<output id="notice"',dialog+'<output id="notice"');p.write_text(s,'utf-8')
p=W/'style.css';s=p.read_text('utf-8')+'''
.save-buttons{margin-left:auto;display:flex;gap:8px;flex-shrink:0}.save-buttons button{white-space:nowrap}.saved-set{min-width:0}.saved-set>.card{width:100%}.saved-set .card span{overflow-wrap:anywhere}.set-actions{display:flex;gap:3px;justify-content:center;padding-top:5px}.set-actions button{padding:4px 6px;font-size:11px}.empty-sets{grid-column:1/-1;text-align:center;padding:20px 12px;color:#997778}#set-dialog{width:min(360px,calc(100vw - 28px));border:1px solid var(--line);border-radius:20px;background:var(--paper);color:var(--ink);padding:22px}#set-dialog::backdrop{background:#34222260}#set-dialog h2{font-size:19px;margin:0 0 12px}#set-dialog p{font-size:13px}#set-name-row{display:grid;gap:7px}#set-name-row[hidden]{display:none}#set-name{width:100%;font:inherit;padding:10px;border:1px solid var(--line);border-radius:9px;background:white;color:var(--ink)}.dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}#set-confirm{background:#ae7080;color:white}@media(max-width:760px){header{gap:7px}header #counts{display:none}header h1{font-size:16px;letter-spacing:1px}.save-buttons{gap:5px}.save-buttons button{padding:7px 9px;font-size:12px}.set-actions{flex-wrap:wrap}.set-actions button{padding:3px 4px;font-size:10px}}
''';p.write_text(s,'utf-8')
# Remove the overlapping parent close button, which discarded unsaved iframe state.
p=R/'games/pixel-home/index.html';s=p.read_text('utf-8');s=re.sub(r'<button\b[^>]*id="wardrobe-close"[^>]*>.*?</button>','',s,flags=re.S);s=re.sub(r'#wardrobe-close\{[^}]*\}','',s);p.write_text(s,'utf-8')
p=R/'games/pixel-home/game.js';s=p.read_text('utf-8');s=re.sub(r"  \$\('#wardrobe-close'\)\.onclick=.*?;\n",'',s);p.write_text(s,'utf-8')
print('Added named sets and removed overlapping close control.')
