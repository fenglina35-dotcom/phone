"""Validate shared/private scope and package private committed source only."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED
from io import BytesIO
from hashlib import sha256
import argparse, json, re, subprocess, importlib.util
ROOT=Path(__file__).resolve().parents[1]
SOURCE='native/private-small-phone/XcodeProject/'
BUNDLE='PhoneCompanionTest/PhoneWeb.bundle/'
GUIDE='安装_v1225_iOS348_请先读.md'
PUBLIC={'native/public-north-review/PhoneCompanionTest/PhoneCompanionTest.xcodeproj/project.pbxproj','native/public-north-review/PhoneCompanionTest/PhoneCompanionTest/CompanionSyncView.swift','tests/north-public-healthkit-minimal.test.mjs','tests/north-review-portal.test.mjs','tests/public-north-screen-time-sync.test.mjs'}
EXT={'.html','.js','.css','.json','.webmanifest','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.mp3','.wav','.m4a','.mp4','.webm','.ogg','.woff','.woff2','.ttf','.otf'}
def git(*args):return subprocess.check_output(['git','-c','core.safecrlf=false',*args],cwd=ROOT)
def archive(paths):
 with ZipFile(BytesIO(git('-c','core.autocrlf=false','archive','--format=zip','HEAD','--',*paths))) as z:return {i.filename:z.read(i) for i in z.infolist() if not i.is_dir()}
def text(b):return b.decode('utf8').replace('\r\n','\n')
def validate(web,private):
 app=text(web['app.js']);papp=text(private[BUNDLE+'app.js']);html=text(web['小手机.html']);phtml=text(private[BUNDLE+'index.html'])
 assert private[BUNDLE+'index.html']==private[BUNDLE+'小手机.html']
 for s in [app,papp]:
  assert "APP_VER='v1225" in s
  for key in ['reopenCompleted:true','_replyHandoffRegenerated','modelOutputUnfilteredToggle','lifeNoteCommitReply','roleSocialIdentityPin','proactiveContinuationContext','NorthPublicRuntime']:assert key in s,key
 for s in [html,phtml]:assert "__NORTH_SHELL_BUILD__='1225'" in s and 'app.js?v=1225' in s
 assert "BUILD='1225'" in text(web['sw.js'])
 for key in ['private-smart-air','private-smart-lock','homekit.climate.command','northNativeBackgroundTask','persistWechatDrain']:
  assert key not in app and key not in html,key
 assert not any('private-smart-' in n or n.startswith('native/') for n in web)
 for key in ['notificationAvatarPreserve:true','persistWechatRequested','persistWechatDrain','native-management-batch','伴生健康刷新']:assert key in papp,key
 for n in ['private-smart-air.js','private-smart-air.css','private-smart-lock.js','private-smart-lock.css','private-runtime-diagnostics.js']:
  assert n in phtml and BUNDLE+n in private,n
 assert 'private-smart-air.js?v=1224' in phtml
 for n in ['HomeKitClimateBridge.swift','HomeKitLightBridge.swift','HomeKitLockBridge.swift','CompanionWellnessService.swift']:assert 'PhoneCompanionTest/'+n in private,n
 climate=text(private['PhoneCompanionTest/HomeKitClimateBridge.swift'])
 for key in ['linkedServices ?? []','HMCharacteristicTypeCoolingThreshold','fanControlValues','verifyReadback']:assert key in climate,key
 assert 'deviceOwnerAuthenticationWithBiometrics' in text(private['PhoneCompanionTest/HomeKitLockBridge.swift'])
 air=text(private[BUNDLE+'private-smart-air.js']);lock=text(private[BUNDLE+'private-smart-lock.js'])
 for key in ['最近读取时间','最近一次真实状态','fanControlValues','homekit.climate.command']:assert key in air,key
 for key in ["device:\\'light", "device:\\'lock", 'privateSmartAirChooserCard']:assert key in lock,key
 assert 'wechat-persist' in text(private[BUNDLE+'private-runtime-diagnostics.js'])
 project=text(private['PhoneCompanionTest.xcodeproj/project.pbxproj'])
 assert project.count('CURRENT_PROJECT_VERSION = 348;')==12 and project.count('MARKETING_VERSION = 1.0.348;')==12
 assert 'static let contractVersion = 37' in text(private['PhoneCompanionTest/PhoneNativeBridge.swift'])
 assert GUIDE in private
 assert web['daily-event-ledger.js']==private[BUNDLE+'daily-event-ledger.js']
 assert 'daily-event-ledger.js?v=1225' in html and 'daily-event-ledger.js?v=1225' in phtml
 for s in [app,papp]:
  assert 'offlineStripMoodTags' in s and "['events','日常事件簿'" in s
 assert '日常事件簿' in text(private[BUNDLE+'daily-event-ledger.js'])
 # Existing native adapters are explicitly different; every other shared entry dependency must match.
 differences=[]
 for n in re.findall(r'''(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']''',html):
  if '://' in n:continue
  n=n.removeprefix('./');assert BUNDLE+n in private,n
  if text(web[n])!=text(private[BUNDLE+n]):differences.append(n)
 assert set(differences)=={'app.js','glass-theme.css'},differences
 assert text(web['glass-theme.css']) in text(private[BUNDLE+'glass-theme.css']).replace('/* A measured private-App stall temporarily removes only decorative shadows\n   and image filters from the home screen. Layout, taps, labels, stored image\n   sources and the selected theme remain unchanged and return automatically\n   when the guard expires. */\nhtml.north-native-app.north-native-performance-guard .home .ic,\nhtml.north-native-app.north-native-performance-guard .home .hwid,\nhtml.north-native-app.north-native-performance-guard .home .dock,\nhtml.north-native-app.north-native-performance-guard .home .glass-second-portrait,\nhtml.north-native-app.north-native-performance-guard .home .glass-second-photos{box-shadow:none!important}\nhtml.north-native-app.north-native-performance-guard .home img{filter:none!important}\n',''), 'private theme must retain all shared styles'
 for n in web:
  if n.startswith('games/pixel-home/'):assert web[n]==private[BUNDLE+n],n
 for n in ['private-smart-air.js','private-smart-air.css','private-smart-lock.js','private-smart-lock.css']:
  assert text(private[BUNDLE+n])==(ROOT/'native/private-small-phone/Resources/Web'/n).read_text('utf8'),n
 print('VALIDATED shared entry dependencies, private-only boundaries, light/lock/air UI and bridge, latest climate/prompt, chat retry, persistence, avatar; native adapters='+','.join(differences),flush=True)
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
 assert git('branch','--show-current').decode().strip()=='main'
 paths=[p for p in git('ls-files','-z').decode().split('\0') if p]
 tops=[p for p in paths if '/' not in p and (PurePosixPath(p).suffix.lower() in EXT or p in {'CNAME','.nojekyll'})]
 dirs=[d for d in ['assets','games','vendor','admin','fonts'] if any(p.startswith(d+'/') for p in paths)]
 if args.check:
  web={p:(ROOT/p).read_bytes() for p in paths if p in tops or any(p.startswith(d+'/') for d in dirs)}
  private={p.removeprefix(SOURCE):(ROOT/p).read_bytes() for p in paths if p.startswith(SOURCE)}
  private[GUIDE]=(ROOT/SOURCE/GUIDE).read_bytes()
 else:
  dirty=set(git('diff','HEAD','--name-only','-z').decode().strip('\0').split('\0'))-{''}
  untracked=set(git('ls-files','--others','--exclude-standard','-z').decode().strip('\0').split('\0'))-{''}
  assert (dirty|untracked)<=PUBLIC,dirty|untracked
  web=archive([*tops,*dirs]);private={p.removeprefix(SOURCE):b for p,b in archive([SOURCE]).items()}
 validate(web,private)
 if args.check:return
 head=git('rev-parse','HEAD').decode().strip()
 private={p:b for p,b in private.items() if not (len(PurePosixPath(p).parts)==1 and '安装' in p and p!=GUIDE)}
 # Private file:// app retains SW as an explicit same-version optional resource.
 private[BUNDLE+'sw.js']=web['sw.js']
 sql='native/private-small-phone/migrations/202609090001_notification_avatar_preserve.sql'
 private['后台先行/'+Path(sql).name]=archive([sql])[sql]
 for scope,files,name,prefix in [('私人',private,'小手机_v1225_私人版_iOS348_事件簿与控制修复_Mac待编译源码包.zip','SmallPhone_v1225_iOS348_MacSource/')]:
  files['SOURCE_COMMIT.txt']=f'commit={head}\nversion=v1225\nscope={scope}\nios=1.0.348 (348)\nbridge=37\nprivate-cloud-avatar-migration=VERIFIED-2026-09-09\nmac-build-verified=no\nreal-iphone-verified=no\nkind=source-only-not-IPA\nweb-deployment=verify-separately\ndaily-event-ledger=included\n'.encode()
  files['SHA256SUMS.json']=json.dumps({p:sha256(b).hexdigest() for p,b in sorted(files.items())},ensure_ascii=False,indent=2).encode()
  out=ROOT.parent/name;assert not out.exists(),'Never overwrite old artifacts'
  with ZipFile(out,'x',ZIP_DEFLATED,compresslevel=6) as z:
   for p,b in sorted(files.items()):z.writestr(prefix+p,b)
  with ZipFile(out) as z:
   assert z.testzip() is None and len(z.namelist())==len(files)
   for p,b in files.items():assert z.read(prefix+p)==b,p
  print(json.dumps({'scope':scope,'path':str(out),'commit':head,'files':len(files),'bytes':out.stat().st_size,'sha256':sha256(out.read_bytes()).hexdigest()},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
