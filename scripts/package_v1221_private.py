"""Private-only source package; no public deployment, no IPA claims."""
from pathlib import Path,PurePosixPath
from zipfile import ZipFile,ZIP_DEFLATED
from io import BytesIO
from hashlib import sha256
import subprocess,json,re,argparse,importlib.util
ROOT=Path(__file__).resolve().parents[1]
SOURCE='native/private-small-phone/XcodeProject/'
BUNDLE='PhoneCompanionTest/PhoneWeb.bundle/'
GUIDE='安装_v1221_iOS345_请先读.md'
PUBLIC={'native/public-north-review/PhoneCompanionTest/PhoneCompanionTest.xcodeproj/project.pbxproj','native/public-north-review/PhoneCompanionTest/PhoneCompanionTest/CompanionSyncView.swift','tests/north-public-healthkit-minimal.test.mjs','tests/north-review-portal.test.mjs','tests/public-north-screen-time-sync.test.mjs'}
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def archive(paths):
 with ZipFile(BytesIO(git('archive','--format=zip','HEAD','--',*paths))) as z:return {i.filename:z.read(i) for i in z.infolist() if not i.is_dir()}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
 paths=[p for p in git('ls-files','-z').decode().split('\0') if p]
 if not args.check:
  dirty=set(git('diff','HEAD','--name-only','-z').decode().strip('\0').split('\0'))-{''}
  untracked=set(git('ls-files','--others','--exclude-standard','-z').decode().strip('\0').split('\0'))-{''}
  assert (dirty|untracked)<=PUBLIC,dirty|untracked
  data=archive([SOURCE,'native/private-small-phone/migrations','app.js','小手机.html','sw.js','delivery.js','web-hotfix.js'])
 else:data={p:(ROOT/p).read_bytes() for p in paths if p.startswith(SOURCE) or p in ['app.js','小手机.html','sw.js','delivery.js','web-hotfix.js']}
 files={p.removeprefix(SOURCE):b for p,b in data.items() if p.startswith(SOURCE)}
 if args.check:
  files[GUIDE]=(ROOT/SOURCE/GUIDE).read_bytes()
 app=files[BUNDLE+'app.js'].decode();html=files[BUNDLE+'index.html'].decode()
 assert files[BUNDLE+'index.html']==files[BUNDLE+'小手机.html']
 assert "APP_VER='v1221 · 私人整合修复版'" in app and "__NORTH_SHELL_BUILD__='1221'" in html
 assert "APP_VER='v1216" in data['app.js'].decode()
 for token in ['notificationAvatarPreserve:true','rolePushAvatarData(c,true)','persistWechatRequested','persistWechatDrain','native-management-batch','伴生健康刷新','NorthPublicRuntime','modelOutputUnfilteredToggle']:
  assert token in app,token
 for n in ['private-smart-air.js','private-smart-air.css','private-smart-lock.js','private-smart-lock.css','private-runtime-diagnostics.js','phone-shortcuts.js','public-north-runtime.js','pixel-home.js','message-beijing-time.js','delivery.js']:
  assert BUNDLE+n in files and n in html,n
 assert 'wechat-persist' in files[BUNDLE+'private-runtime-diagnostics.js'].decode()
 for n in ['HomeKitClimateBridge.swift','HomeKitLockBridge.swift','HomeKitLightBridge.swift','CompanionWellnessService.swift']:
  assert 'PhoneCompanionTest/'+n in files,n
 assert 'deviceOwnerAuthenticationWithBiometrics' in files['PhoneCompanionTest/HomeKitLockBridge.swift'].decode()
 assert 'native-management-batch' in files['PhoneCompanionTest/CompanionSyncView.swift'].decode()
 assert 'by: by' in files['PhoneCompanionTest/PhoneNativeBridge.swift'].decode()
 assert 'static let contractVersion = 37' in files['PhoneCompanionTest/PhoneNativeBridge.swift'].decode()
 pbx=files['PhoneCompanionTest.xcodeproj/project.pbxproj'].decode()
 assert pbx.count('CURRENT_PROJECT_VERSION = 345;')==12 and pbx.count('MARKETING_VERSION = 1.0.345;')==12
 assert 'for linked in target.service.linkedServices ?? [] {' in files['PhoneCompanionTest/HomeKitClimateBridge.swift'].decode()
 assert 'RoleNotificationService.appex' in pbx and 'INPerson(' in files['RoleNotificationService/NotificationService.swift'].decode()
 for n in ['delivery.js','web-hotfix.js']:assert files[BUNDLE+n]==data[n],n
 for n in re.findall(r'''(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']''',data['小手机.html'].decode()):
  if '://' not in n:assert BUNDLE+n.removeprefix('./') in files,n
 # Keep the actual private scripts, never regenerate app.js from the public source.
 files[BUNDLE+'sw.js']=data['sw.js'].decode().replace("BUILD='1216'","BUILD='1221'").replace('v1216','v1221').encode()
 sql='native/private-small-phone/migrations/202609090001_notification_avatar_preserve.sql'
 files['后台先行/'+Path(sql).name]=(ROOT/sql).read_bytes() if args.check else data[sql]
 assert GUIDE in files
 if args.check:print('Private source precheck passed:',len(files));return
 files={p:b for p,b in files.items() if not (len(PurePosixPath(p).parts)==1 and '安装' in p and p!=GUIDE)}
 head=git('rev-parse','HEAD').decode().strip()
 files['SOURCE_COMMIT.txt']=f'commit={head}\nweb=v1221\nios=1.0.345 (345)\nbridge=37\npublic-web=unchanged-v1216\nprivate-cloud-avatar-migration=NOT-APPLIED-REQUIRED-BEFORE-INSTALL\nmac-signed=no\niphone-verified=no\nkind=source-only-not-IPA\n'.encode()
 files['SHA256SUMS.json']=json.dumps({p:sha256(b).hexdigest() for p,b in sorted(files.items())},ensure_ascii=False,indent=2).encode()
 out=ROOT.parent/'小手机_v1221_私人版_iOS345_空调编译修复_后台待更新_Mac待编译源码包.zip'
 assert not out.exists(),'Never overwrite old packages'
 prefix='SmallPhone_v1221_iOS345_MacSource/'
 with ZipFile(out,'x',ZIP_DEFLATED,compresslevel=6) as z:
  for p,b in sorted(files.items()):z.writestr(prefix+p,b)
 with ZipFile(out) as z:
  assert z.testzip() is None and len(z.namelist())==len(files)
  for p,b in files.items():assert z.read(prefix+p)==b,p
 print(json.dumps({'path':str(out),'commit':head,'files':len(files),'bytes':out.stat().st_size,'sha256':sha256(out.read_bytes()).hexdigest()},ensure_ascii=False))
if __name__=='__main__':main()
