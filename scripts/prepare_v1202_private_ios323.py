"""Prepare a private source package. This script does not commit or push."""
from pathlib import Path
import re
import shutil

ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT/'native/private-small-phone/XcodeProject'
BUNDLE=PROJECT/'PhoneCompanionTest/PhoneWeb.bundle'
def update(p,fn):
    old=p.read_text('utf-8');new=fn(old)
    if new!=old:p.write_text(new,'utf-8')
def web_version(s):
    return s.replace('v1201','v1202').replace('v=1201','v=1202').replace("'1201'","'1202'").replace("\\'1201\\'","\\'1202\\'").replace('north-sw-reloaded-1201-','north-sw-reloaded-1202-').replace('像素少女本地候选','像素少女照顾版')
def ios_version(s):
    for a,b in [('1.0.322','1.0.323'),('1\\.0\\.322','1\\.0\\.323'),('(322)','(323)'),('\\(322\\)','\\(323\\)'),('build322','build323'),('v=322','v=323'),('= 322;','= 323;'),('= 322/','= 323/'),('322-handoff-ownership-1','323-pixel-home-1')]:s=s.replace(a,b)
    return s
for base in [ROOT,BUNDLE]:
    for n in ['app.js','index.html','小手机.html','repair.html','web-hotfix.js','sw.js','pixel-home.js','pixel-home-policy.js']:
        if (base/n).exists():update(base/n,web_version)
    for p in (base/'games/pixel-home').glob('*'):
        if p.suffix in {'.js','.css','.html'}:update(p,web_version)
for p in ROOT.glob('*.html'):update(p,web_version)
for n in ['index.html','小手机.html','private-runtime-diagnostics.js']:update(BUNDLE/n,ios_version)
for n in ['PhoneCompanionTest.xcodeproj/project.pbxproj','PhoneCompanionTest/LocalPhoneWebView.swift','PhoneCompanionTest/PhoneNativeBridge.swift']:update(PROJECT/n,ios_version)
for p in (ROOT/'tests').glob('*.test.mjs'):
    update(p,lambda s:ios_version(web_version(s)))

guide='第三百二十三次安装_v1202_像素少女_请先读.md'
text='''# v1202 像素少女私人源码包

当前候选：网页源码与私人内置网页 v1202。两边共有功能；本次只打包私人源码，网页不推送、不部署。网页源码与私人内置网页均为 v1202，私人 iOS 1.0.323 (323)，原生桥 35。

在小手机游戏大厅打开“像素少女”，由情侣空间绑定角色照顾。让他照顾包含随机食物、洗澡、梳头、刷牙、洗脸、皮球、小熊和戳脸摸头；饱腹不强喂、疲倦优先休息。收藏位于原灯按钮位置，上床自动关灯，起床自动开灯。现有两套完整穿搭由角色提前选好七天，每天设备当地08:00后生效；网页关闭时下一次进入补当天，不宣称关闭网页还能运行模型。无效格式不自动重试。

不要先删除原 App，不要解压覆盖旧工程目录。将整个压缩包解压到新目录，打开其中 PhoneCompanionTest.xcodeproj。先检查各 Target 的 Apple Account、Team、Bundle ID、Automatic Signing、Provisioning Profile、Entitlements 与现有 HomeKit 等权限；所有 Target 应为 1.0.323 (323)。沿用原签名身份和Bundle ID覆盖安装，不替换成其他项目身份。

保留原有微信、共同生活、后台回复接力互斥、心情保留、请求规模详情、外卖、监管、键盘和原生功能。包内是完整项目，不是只替换某个 JS 的补丁。不要使用旧 v1200 打包脚本来重打当前源代码。

Windows 自动测试与浏览器模拟模型测试已完成；本机不能完成 Mac 编译、签名或真实 iPhone 覆盖安装。本包是 Mac 待编译源码候选，不是可直接安装的 IPA。最终请在真实 iPhone 确认可见 v1202 / 1.0.323 (323)、游戏大厅入口、绑定角色、镜子洗漱、音效、进度恢复与早上穿搭。
'''
(PROJECT/guide).write_text(text,'utf-8')
p=PROJECT/'请在Mac编译前先读.md'
old=p.read_text('utf-8')
if not old.startswith('# v1202'):p.write_text(text+'\n以下为历史记录，不是当前包的安装指令：\n\n'+old,'utf-8')
p=ROOT/'tests/private-ios295-performance-inheritance.test.mjs'
s=p.read_text('utf-8');a=s.index("test('last packaged Mac guides");b=s.index('\n});',a)+4
part=s[a:b].replace('last packaged Mac guides retain v1200; local v1202 has not been packaged','current Mac guides identify private v1202 and web not deployed').replace('第三百二十二次安装_v1200_回复接力互斥_请先读.md',guide).replace('v1200','v1202')
p.write_text(s[:a]+part+s[b:],'utf-8')

source=(ROOT/'scripts/package_v1200_private_ios322.py').read_text('utf-8')
source=source.replace('1200','1202').replace('322','323').replace('第三百二十二次安装_v1202_回复接力互斥_请先读.md',guide).replace('HandoffOwnership','PixelGirlCare').replace('回复接力互斥','像素少女照顾版')
source=source.replace('像素少女照顾版版','像素少女照顾版')
source=source.replace('public-source=v1202 (check Git push separately)','public-source=v1202 (NOT PUSHED OR DEPLOYED)')
source=source.replace("files['SOURCE_COMMIT.txt']=",'''# Verify all new nested game resources, not only top-level script tags.
for name in ['pixel-home.js','pixel-home-policy.js']:
    assert files[BUNDLE+name] == git('show','HEAD:'+name)
    require(shell,name+'?v=1202')
game_names=git('ls-files','games/pixel-home').decode('utf-8').splitlines()
assert len(game_names)>=20
for name in game_names:
    assert files[BUNDLE+name] == git('show','HEAD:'+name), name
require(app,"else if(c.p==='pixelhome')html=renderPixelHome()")
require(files[BUNDLE+'games/pixel-home/game.js'].decode('utf-8'),"['#care',2,'让他照顾']")
assert 'id="light"' not in files[BUNDLE+'games/pixel-home/index.html'].decode('utf-8')
files['SOURCE_COMMIT.txt']=''')
(ROOT/'scripts/package_v1202_private_ios323.py').write_text(source,'utf-8')
p=ROOT/'games/pixel-home/README.md';old=p.read_text('utf-8');prefix='''# v1202 / iOS323 私人源码包（2026-09-07）

最新授权：只制作私人 Mac 待编译源码包；网页不上传、不部署。允许为归档做本地提交，不推送远端。包内新增功能与网页候选相同；原生桥35不变。两边入口、本地模型替身与全仓测试通过不能代替真实模型、Mac签名编译、真实iPhone验收。十四套服装仍未完成，当前完整造型为两套。

以下 v1201/P08 是上一阶段历史记录：

'''
if not old.startswith('# v1202'):p.write_text(prefix+old,'utf-8')
shutil.copy2(p,BUNDLE/'games/pixel-home/README.md')
print('Prepared v1202 / iOS 323; no commit, push or package performed.')
