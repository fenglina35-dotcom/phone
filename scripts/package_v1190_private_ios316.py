"""Package only committed private sources; never overwrite a prior artifact."""
from hashlib import sha256
from io import BytesIO
from pathlib import Path, PurePosixPath
import re
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'native/private-small-phone/XcodeProject/'
BUNDLE = 'PhoneCompanionTest/PhoneWeb.bundle/'
GUIDE = '第三百一十六次安装_v1190_情侣空间监管_请先读.md'
NAME = 'SmallPhone_v1190_CoupleWatch_iOS316_MacSourceCandidate'
OUTPUT = ROOT.parent / '小手机_v1190_私人版_iOS316_情侣空间监管_Mac待编译源码包.zip'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def require(text, token):
    if token not in text:
        raise RuntimeError('Missing package contract: ' + token)

if git('status', '--porcelain').strip():
    raise RuntimeError('Worktree must be clean, including untracked files')
if git('branch', '--show-current').decode().strip() != 'main':
    raise RuntimeError('Expected main')
if OUTPUT.exists():
    raise RuntimeError('Refusing to reuse or overwrite output: ' + str(OUTPUT))
head = git('rev-parse', 'HEAD').decode().strip()
# Windows core.autocrlf can transform archive text. Preserve the committed blobs
# so byte-for-byte checks compare the exact Git source, not a checkout transform.
archive = ZipFile(BytesIO(git('-c', 'core.autocrlf=false', 'archive', '--format=zip', 'HEAD', SOURCE)))
files = {}
for item in archive.infolist():
    if item.is_dir():
        continue
    rel = item.filename.removeprefix(SOURCE)
    parts = PurePosixPath(rel).parts
    if any(x in {'.git', 'xcuserdata', '__pycache__'} for x in parts) or rel.endswith(('.zip', '.pyc')):
        continue
    if len(parts) == 1 and '安装' in rel and rel != GUIDE:
        continue
    files[rel] = archive.read(item)
assert GUIDE in files
assert files[BUNDLE+'index.html'] == files[BUNDLE+'小手机.html']
shell = files[BUNDLE+'index.html'].decode('utf-8')
app = files[BUNDLE+'app.js'].decode('utf-8')
for token in ["__NORTH_SHELL_BUILD__='1190'",'app.js?v=1190&r=v1190-couple-watch-1','private-runtime-diagnostics.js?v=316','couple-watch.js?v=1190','couple-watch-runtime.js?v=1190','html.north-native-app .phone:has(.offinput)']:
    require(shell, token)
require(app,"APP_VER='v1190 · 情侣空间聊天与软件监管版'")
require(app,'_offComposerGuardUntil=Date.now()+1600')
for name in ['couple-watch.js','couple-watch-runtime.js','cohab-theater.js','bead-studio.js','heart-quiz.js']:
    if files[BUNDLE+name] != git('show','HEAD:'+name):
        raise RuntimeError('Shared script parity failed: '+name)
# Every locally referenced script/style in the public entry must be present in
# the private bundle. web-hotfix is the existing public recovery adapter; the
# private runtime has native recovery and is covered by its established tests.
public = git('show','HEAD:小手机.html').decode('utf-8')
for resource in re.findall(r'(?:src|href)=["\']([^"\']+\.(?:js|css)(?:\?[^"\']*)?)["\']',public):
    name=resource.split('?')[0].removeprefix('./')
    if '://' in name or name=='web-hotfix.js':
        continue
    if BUNDLE+name not in files:
        raise RuntimeError('Missing public asset in private bundle: '+name)
project=files['PhoneCompanionTest.xcodeproj/project.pbxproj'].decode('utf-8')
assert project.count('CURRENT_PROJECT_VERSION = 316;') == 12
assert project.count('MARKETING_VERSION = 1.0.316;') == 12
webview=files['PhoneCompanionTest/LocalPhoneWebView.swift'].decode('utf-8')
require(webview,'1.0.316 (316)')
assert 'KeyboardSynchronizedContainer' not in webview
files['SOURCE_COMMIT.txt']=(f'branch=main\ncommit={head}\nworktree=clean\nscope=shared\npublic-source=v1190 (not pushed)\nprivate-web=v1190\nios=1.0.316 (316)\nbridge=35\nmac-compile-verified=no\nreal-iphone-verified=no\n').encode()
with ZipFile(OUTPUT,'x',ZIP_DEFLATED,compresslevel=9) as z:
    for rel,data in sorted(files.items()):
        z.writestr(NAME+'/'+rel,data)
with ZipFile(OUTPUT) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(files) == len(set(z.namelist()))
    for rel,data in files.items():
        assert z.read(NAME+'/'+rel) == data
print('ZIP='+str(OUTPUT))
print('COMMIT='+head)
print('FILES='+str(len(files)))
print('BUNDLE_FILES='+str(sum(k.startswith(BUNDLE) for k in files)))
print('SIZE='+str(OUTPUT.stat().st_size))
print('SHA256='+sha256(OUTPUT.read_bytes()).hexdigest().upper())
print('MAC_COMPILE_VERIFIED=NO\nREAL_IPHONE_VERIFIED=NO')
