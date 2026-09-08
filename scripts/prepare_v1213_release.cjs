// One new identity for the complete web/private release; retain native-only divergence.
const fs=require('fs'),cp=require('child_process'),path=require('path');const root=path.resolve(__dirname,'..'),bundle='native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const names=cp.execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for(const name of names){const runtime=(!name.includes('/')||name.startsWith(bundle)&&!name.slice(bundle.length).includes('/'))&&/\.(js|html|css|webmanifest)$/.test(name),native=/^native\/private-small-phone\/XcodeProject\/PhoneCompanionTest\/[^/]+\.(swift|plist)$/.test(name)||name==='native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj',test=name.startsWith('tests/')&&name.endsWith('.test.mjs');if(!runtime&&!native&&!test)continue;const file=path.join(root,name),old=fs.readFileSync(file,'utf8');let s=old;
 if(runtime||test)s=s.replaceAll('v1212','v1213').replaceAll('v=1212','v=1213').replaceAll('north-sw-reloaded-1212','north-sw-reloaded-1213').replaceAll("'1212'","'1213'").replaceAll('\\\'1212\\\'','\\\'1213\\\'');
 if(native||name.startsWith(bundle)||test)s=s.replaceAll('1.0.338','1.0.339').replaceAll('1\\.0\\.338','1\\.0\\.339').replaceAll('(338)','(339)').replaceAll('\\(338\\)','\\(339\\)').replaceAll('CURRENT_PROJECT_VERSION = 338','CURRENT_PROJECT_VERSION = 339').replace(/private-smart-lock\.(js|css)\?v=338/g,'private-smart-lock.$1?v=339');
 if(test)s=s.replaceAll('安装_v1213_iOS338_请先读','安装_v1213_iOS339_请先读').replaceAll('v=338','v=339').replaceAll('iOS 338','iOS 339');
 if(s!==old)fs.writeFileSync(file,s);
}
