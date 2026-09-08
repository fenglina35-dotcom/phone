"""Build both release artifacts from a clean committed tree, then reverse-check bytes."""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile, ZIP_DEFLATED
from hashlib import sha256
from io import BytesIO
from urllib.parse import urlsplit, unquote
import subprocess, json, re, posixpath, argparse

ROOT=Path(__file__).resolve().parents[1]
SOURCE='native/private-small-phone/XcodeProject/'
BUNDLE='PhoneCompanionTest/PhoneWeb.bundle/'
GUIDE='安装_v1213_iOS339_请先读.md'
EXT={'.html','.js','.css','.json','.webmanifest','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.mp3','.wav','.m4a','.mp4','.webm','.ogg','.woff','.woff2','.ttf','.otf'}
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def files_at_head(paths):
    with ZipFile(BytesIO(git('-c','core.autocrlf=false','archive','--format=zip','HEAD','--',*paths))) as z:
        return {i.filename:z.read(i) for i in z.infolist() if not i.is_dir()}
def refs(files,name):
    for link in re.findall(r'''(?:src|href)=["']([^"']+)["']''',files[name].decode('utf8')):
        u=urlsplit(link)
        if u.scheme or u.netloc or not u.path.endswith(('.js','.css')):continue
        target=posixpath.normpath(posixpath.join(str(PurePosixPath(name).parent),unquote(u.path)))
        assert target in files,f'{name}: missing {target}'
def validate(web,private):
    app=web['app.js'].decode('utf8');papp=private[BUNDLE+'app.js'].decode('utf8')
    shell=web['小手机.html'].decode('utf8');pshell=private[BUNDLE+'index.html'].decode('utf8')
    assert private[BUNDLE+'index.html']==private[BUNDLE+'小手机.html']
    for token in ["APP_VER='v1213",'modelOutputUnfilteredToggle','lifeNoteCommitReply','roleSocialIdentityPin','proactiveContinuationContext']:
        assert token in app and token in papp,token
    for token in ['northNativeBackgroundTask','__smallPhoneBackgroundTaskSnapshot','private-smart-lock','homekit.lock.command']:
        assert token not in app and token not in shell,token
    assert 'northNativeBackgroundTask' in papp
    assert 'private-smart-lock.js?v=339' in pshell and 'private-smart-lock.css?v=339' in pshell
    for name,data in web.items():
        assert not name.startswith(('native/','scripts/','tests/','docs/','supabase/','services/'))
        if name.endswith('.html'):refs(web,name)
    refs(private,BUNDLE+'index.html');refs(private,BUNDLE+'小手机.html')
    for name in ['request-diagnostics.js','message-beijing-time.js','cohab-theater.js','pixel-home.js','pixel-home-policy.js','pixel-wardrobe-info.js']:
        assert web[name]==private[BUNDLE+name],name
    for name in web:
        if name.startswith('games/pixel-home/'):assert web[name]==private[BUNDLE+name],name
    # No shared script/style may vanish at the private entry, even with native adapters.
    for name in re.findall(r'''(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']''',shell):
        if '://' not in name:assert BUNDLE+name.removeprefix('./') in private,name
    assert 'homekit.lock.command' in private[BUNDLE+'private-smart-lock.js'].decode('utf8')
    assert 'request-diagnostics.js?v=1213' in shell and 'request-diagnostics.js?v=1213' in pshell
    assert 'roleReplyEnglishOnly' in app and 'roleReplyEnglishOnly' in papp
    assert 'date.getUTCFullYear()' not in web['message-beijing-time.js'].decode('utf8')
    assert 'deviceOwnerAuthenticationWithBiometrics' in private['PhoneCompanionTest/HomeKitLockBridge.swift'].decode('utf8')
    project=private['PhoneCompanionTest.xcodeproj/project.pbxproj'].decode('utf8')
    assert project.count('CURRENT_PROJECT_VERSION = 339;')==12
    assert project.count('MARKETING_VERSION = 1.0.339;')==12
    assert 'static let contractVersion = 36' in private['PhoneCompanionTest/PhoneNativeBridge.swift'].decode('utf8')
    assert "const BUILD='1213'" in web['sw.js'].decode('utf8')
    assert "__NORTH_SHELL_BUILD__='1213'" in shell and "__NORTH_SHELL_BUILD__='1213'" in pshell
    assert GUIDE in private
    assert 'privateBackgroundModelErrorGuard:true' in papp and 'privateBackgroundModelErrorGuard' not in app
    assert 'message-beijing-time.js?v=1213' in shell and 'message-beijing-time.js?v=1213' in pshell
    for name in ['public-north-policy.js','public-north-runtime.js','phone-shortcuts.js']:
        assert web[name]==private[BUNDLE+name],name
        assert name+'?v=1213' in shell and name+'?v=1213' in pshell
    assert 'NorthPublicRuntime' in app and 'NorthPublicRuntime' in papp
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    assert git('branch','--show-current').decode().strip()=='main'
    if not args.check:
        assert not git('diff','HEAD','--name-only').strip(),'Commit all selected release changes first'
        untracked=set(git('ls-files','--others','--exclude-standard','-z').decode('utf8').strip('\0').split('\0'))-{''}
        allowed=set()
        assert untracked<=allowed,f'Unexpected untracked files: {untracked-allowed}'
    tracked=[x for x in git('ls-files','-z').decode('utf8').split('\0') if x]
    top=[s for s in tracked if '/' not in s and (PurePosixPath(s).suffix.lower() in EXT or s in {'CNAME','.nojekyll'})]
    dirs=[d for d in ['assets','games','vendor','admin','fonts'] if any(s.startswith(d+'/') for s in tracked)]
    if args.check:
        web={s:(ROOT/s).read_bytes() for s in tracked if s in top or any(s.startswith(d+'/') for d in dirs)}
        private={s.removeprefix(SOURCE):(ROOT/s).read_bytes() for s in tracked if s.startswith(SOURCE)}
    else:
        web=files_at_head([*top,*dirs]);private={s.removeprefix(SOURCE):data for s,data in files_at_head([SOURCE]).items()}
    validate(web,private)
    if args.check:print(f'PRECHECK web={len(web)} private={len(private)}');return
    head=git('rev-parse','HEAD').decode().strip()
    results=[]
    for kind,files,title in [('网页',web,'SmallPhone_v1213_Web'),('私人',private,'SmallPhone_v1213_iOS339_MacSource')]:
        if kind=='私人':files={p:b for p,b in files.items() if not (len(PurePosixPath(p).parts)==1 and '安装' in p and p!=GUIDE)}
        name='小手机_v1213_网页版_公开伴生与快捷指令.zip' if kind=='网页' else '小手机_v1213_私人版_iOS339_公开伴生与快捷指令_Mac待编译源码包.zip'
        output=ROOT.parent/name;assert not output.exists(),'Never overwrite an existing package'
        files['SOURCE_COMMIT.txt']=f'commit={head}\nversion=v1213\nscope={kind}\ntracked-worktree=clean\nshortcuts=cloud-worker-deployed\nprivate-ios=339\nbridge=36\nmac-build-verified=no\nreal-iphone-verified=no\nweb-deployment=verify-separately\n'.encode('utf8')
        files['SHA256SUMS.json']=json.dumps({p:sha256(b).hexdigest() for p,b in sorted(files.items())},ensure_ascii=False,indent=2).encode('utf8')
        with ZipFile(output,'x',ZIP_DEFLATED,compresslevel=6) as z:
            for p,b in sorted(files.items()):z.writestr(title+'/'+p,b)
        with ZipFile(output) as z:
            assert z.testzip() is None
            assert len(z.namelist())==len(files)
            for p,b in files.items():assert z.read(title+'/'+p)==b,p
        result={'scope':kind,'path':str(output),'commit':head,'files':len(files),'bytes':output.stat().st_size,'sha256':sha256(output.read_bytes()).hexdigest()}
        results.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
