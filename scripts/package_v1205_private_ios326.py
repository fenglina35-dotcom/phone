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
GUIDE = '第三百二十六次安装_v1205_完整衣柜_请先读.md'
NAME = 'SmallPhone_v1205_NamedRoleWardrobe_iOS326_MacSourceCandidate'
OUTPUT = ROOT.parent / '小手机_v1205_私人版_iOS326_角色穿搭与自定义衣柜_Mac待编译源码包.zip'

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
for token in ["__NORTH_SHELL_BUILD__='1205'",'app.js?v=1205&r=v1205-couple-watch-1','private-runtime-diagnostics.js?v=326','couple-watch.js?v=1205','couple-watch-runtime.js?v=1205','html.north-native-app .phone:has(.offinput)']:
    require(shell, token)
require(shell,'cohab-model-diagnostics.js?v=1205')
require(shell,'request-size-details.js?v=1205')
require(app,'requestSizeDetailsHtml(d)')
require(app,'replyHandoffClaimLocal(_handoffTurn)')
require(app,'phone_role_background_complete_turn')
require(app,"roleInterceptPurpose:'delivery-action'")
require(files[BUNDLE+'delivery.js'].decode('utf-8'),'currentDeliveryRepairReply(replyText)')
require(files[BUNDLE+'private-reply-intercept.js'].decode('utf-8'),'这是外卖辅助请求结果，不是聊天格式错误')
require(app,"APP_VER='v1205 · 像素少女照顾版'")
require(app,'_offComposerGuardUntil=Date.now()+1600')
public_app=git('show','HEAD:app.js').decode('utf-8')
assert app[app.index('const _replyHandoffClaims='):app.index('const _roleBackgroundPending=')] == public_app[public_app.index('const _replyHandoffClaims='):public_app.index('const _roleBackgroundPending=')]
for name in ['normalizeHiddenThoughtFormats','wechatInnerThoughtValue','stripHiddenThoughtTags','naturalInnerThoughtText','rememberValidInnerThought','visibleRoleThought','refreshChatMood','setNaturalInnerThought','offlineRequestError','offlineForegroundRequest','offlineRequestVisibility','offlineReplyChatRequest','cohabRoleChat']:
    line=next(x for x in public_app.splitlines() if x.startswith(('function '+name+'(', 'async function '+name+'(')))
    require(app,line)
assert "innerThoughtMissingAt||0)>(+c.innerThoughtAt" not in app
for source in [app,public_app]:
    missing = next(x for x in source.splitlines() if 'if(_naturalOn&&S.settings.showMoodTag!==false&&String(content' in x)
    require(missing,'content=normalizeHiddenThoughtFormats(content)')
    assert 'chatAPI' not in missing and 'await ' not in missing
require(files[BUNDLE+'couple-watch.js'].decode('utf-8'),"mode:'triggers'")
require(files[BUNDLE+'couple-watch.js'].decode('utf-8'),"s.kind==='chat'?10000:20000")
for name in ['delivery.js','request-size-details.js','cohab-model-diagnostics.js','couple-watch.js','couple-watch-runtime.js','cohab-theater.js','bead-studio.js','heart-quiz.js']:
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
assert project.count('CURRENT_PROJECT_VERSION = 326;') == 12
assert project.count('MARKETING_VERSION = 1.0.326;') == 12
webview=files['PhoneCompanionTest/LocalPhoneWebView.swift'].decode('utf-8')
require(webview,'1.0.326 (326)')
assert 'KeyboardSynchronizedContainer' not in webview
# Verify all new nested game resources, not only top-level script tags.
for name in ['pixel-home.js','pixel-home-policy.js','pixel-wardrobe-info.js']:
    assert files[BUNDLE+name] == git('show','HEAD:'+name)
    require(shell,name+'?v=1205')
game_names=git('ls-files','games/pixel-home').decode('utf-8').splitlines()
assert len(game_names)>=20
for name in game_names:
    assert files[BUNDLE+name] == git('show','HEAD:'+name), name
require(app,"else if(c.p==='pixelhome')html=renderPixelHome()")
assert files[BUNDLE+'games/pixel-home/wardrobe/approved-config.json']==git('show','HEAD:games/pixel-home/wardrobe/approved-config.json')
require(files[BUNDLE+'games/pixel-home/index.html'].decode('utf-8'),'wardrobe/data.js?v=1205')
require(files[BUNDLE+'games/pixel-home/wardrobe/index.html'].decode('utf-8'),'body-legWidth')
require(files[BUNDLE+'games/pixel-home/game.js'].decode('utf-8'),'wardrobe/host.js?v=1205')
require(files[BUNDLE+'games/pixel-home/game.js'].decode('utf-8'),"['#care',2,'让他照顾']")
assert 'id="light"' not in files[BUNDLE+'games/pixel-home/index.html'].decode('utf-8')

require(files[BUNDLE+'pixel-home.js'].decode('utf-8'),'_pixelOutfitAttempted')
require(files[BUNDLE+'pixel-home-policy.js'].decode('utf-8'),'function roleWardrobe(')
require(files[BUNDLE+'pixel-home-policy.js'].decode('utf-8'),"slot.period==='evening'")
require(app,"if(_main&&typeof pixelHomeRoleContext==='function')")
require(files[BUNDLE+'games/pixel-home/wardrobe/app.js'].decode('utf-8'),'savedOutfits')
assert 'id="wardrobe-close"' not in files[BUNDLE+'games/pixel-home/index.html'].decode('utf-8')
require(files[BUNDLE+'games/pixel-home/index.html'].decode('utf-8'),'>返回</button>')

files['SOURCE_COMMIT.txt']=(f'branch=main\ncommit={head}\nworktree=clean\nscope=shared\npublic-source=v1205 (PUBLICATION AUTHORIZED; VERIFY REMOTE DEPLOYMENT SEPARATELY)\nprivate-web=v1205\nios=1.0.326 (326)\nbridge=35\nmac-compile-verified=no\nreal-iphone-verified=no\n').encode()
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
