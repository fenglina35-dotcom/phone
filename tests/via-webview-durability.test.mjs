import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');

function functionSource(name){
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,`missing ${name}`);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch===quote)quote='';continue;}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

function storage(){
  const values=new Map();
  return {values,api:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value))}};
}

test('today task journal restores generated tasks and completion after a core rollback',()=>{
  const st=storage(),role={id:'role',tasks:null};
  const context=vm.createContext({
    TASK_DAILY_JOURNAL_KEY:'tasks',localStorage:st.api,Date,JSON,
    S:{_persistedAt:100,contacts:[role]},todayStr:()=> '2026-09-03',getC:id=>id==='role'?role:null,
    _coreBootRef:null,_androidOrphanCoreProbe:false,_appBootFinished:true,
  });
  for(const name of ['taskDailyJournalRead','taskDailyJournalWrite','taskDailyJournalMerge'])vm.runInContext(functionSource(name),context);

  role.tasks={date:'2026-09-03',assignTs:200,list:[{id:'a',text:'新的任务',done:false}],rewarded:false};
  assert.equal(context.taskDailyJournalWrite(role),true);
  role.tasks=null;
  assert.equal(context.taskDailyJournalMerge(role),true);
  assert.equal(role.tasks.list[0].text,'新的任务');

  role.tasks.list[0].done=true;
  role.tasks.list[0].doneTs=300;
  assert.equal(context.taskDailyJournalWrite(role),true);
  role.tasks={date:'2026-09-03',assignTs:200,list:[{id:'a',text:'新的任务',done:false}],rewarded:false};
  assert.equal(context.taskDailyJournalMerge(role),true);
  assert.equal(role.tasks.list[0].done,true,'a completed task must not become incomplete after restart');
});

test('today social journal restores missing posts and preserves a later deletion',()=>{
  const st=storage(),now=Date.now(),date=(()=>{const d=new Date(now);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
  const moment={id:'m1',authorId:'me',text:'今天的朋友圈',images:['data:image/jpeg;base64,large'],time:now,likes:[],comments:[]};
  const tweet={id:'t1',who:'me',text:'今天的推文',images:[],time:now,likes:[],comments:[]};
  const oldMoment={id:'old',authorId:'me',text:'昨天',images:[],time:now-86400000,likes:[],comments:[]};
  const context=vm.createContext({
    SOCIAL_DAILY_JOURNAL_KEY:'social',localStorage:st.api,Date,JSON,
    S:{_persistedAt:100,moments:[moment,oldMoment],x:{tweets:[tweet]}},todayStr:()=>date,
    _socialDailyJournalStamp:'',_coreBootRef:null,_androidOrphanCoreProbe:false,_appBootFinished:true,
  });
  for(const name of ['socialDailyDate','socialDailySafeRow','socialDailyPayload','socialDailyJournalWrite','socialDailyJournalMerge'])vm.runInContext(functionSource(name),context);

  assert.equal(context.socialDailyJournalWrite(),true);
  const journal=JSON.parse(st.values.get('social'));
  assert.deepEqual(journal.moments[0].images,[],'large image bytes must not fill localStorage');
  context.S.moments=[oldMoment];context.S.x.tweets=[];
  assert.equal(context.socialDailyJournalMerge(),true);
  assert.equal(context.S.moments[0].text,'今天的朋友圈');
  assert.equal(context.S.x.tweets[0].text,'今天的推文');

  context.S.moments=context.S.moments.filter(p=>p.id!=='m1');
  assert.equal(context.socialDailyJournalWrite(),true);
  context.S.moments=[moment,oldMoment];
  context._socialDailyJournalStamp='';
  assert.equal(context.socialDailyJournalMerge(),true);
  assert.equal(context.S.moments.some(p=>p.id==='m1'),false,'a post deliberately deleted after the old core must stay deleted');
});

test('Android web saves are moved to an idle slice when the WebView supports it',()=>{
  assert.match(functionSource('save'),/idle=\(native\|\|NORTH_ANDROID\)&&d>0&&typeof requestIdleCallback==='function'/);
});
