import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const files=[
  'app.js',
  'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js'
];

function autoFixture(source,{fetchError=false,mirrorResult=null}={}){
  const line=source.split('\n').find(x=>x.startsWith('let _cloudAutoT=0;async function cloudAutoTick()'));
  assert.ok(line,'cloudAutoTick must remain independently testable');
  const existing={id:'legacy-web-backup',data:{settings:{}}};
  const uploads=[],errors=[];
  const c={
    S:{settings:{cloudAuto:true}},document:{hidden:false},_cloudBackupBusy:false,
    _privatePhoneLastInteractionAt:0,_cloudSyncStatus:{},
    privateNativeAppOn:()=>false,privatePhoneCloudWake(){},
    cloudFetchRow:async()=>{if(fetchError)throw new Error('network down');return existing;},
    privatePrimaryMirrorCheck:async opt=>{assert.equal(opt.row,existing);return mirrorResult;},
    cloudBackup:async opt=>{uploads.push(opt);return 12;},
    northBrowserDiagnosticError:(kind,error)=>errors.push({kind,error:String(error)}),
    Date,Math,String,Promise
  };
  vm.createContext(c);vm.runInContext(line,c);
  return {c,existing,uploads,errors};
}

for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  test(`${file}: an existing legacy cloud row is updated instead of disabling auto backup`,async()=>{
    const f=autoFixture(source);await f.c.cloudAutoTick();
    assert.equal(f.uploads.length,1);
    assert.equal(f.uploads[0].current,f.existing);
  });
  test(`${file}: a private primary mirror stays read-only and is never overwritten`,async()=>{
    const f=autoFixture(source,{mirrorResult:{current:true}});await f.c.cloudAutoTick();
    assert.equal(f.uploads.length,0);
  });
  test(`${file}: a failed cloud read cannot be mistaken for an empty backup slot`,async()=>{
    const f=autoFixture(source,{fetchError:true});await f.c.cloudAutoTick();
    assert.equal(f.uploads.length,0);
    assert.equal(f.errors.length,1);
    assert.equal(f.errors[0].kind,'web-cloud-auto');
  });
  test(`${file}: backup UI exposes persistent progress, duplicate-click protection, and the real cadence`,()=>{
    assert.match(source,/id="cloud_backup_now"/);
    assert.match(source,/上一份云备份仍在进行/);
    assert.match(source,/前台空闲时约每10分钟更新/);
    assert.doesNotMatch(source,/if\(current\)return;cloudBackup/);
  });
}
