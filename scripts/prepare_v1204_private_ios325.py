from pathlib import Path
import shutil
R=Path(__file__).resolve().parents[1];P=R/'native/private-small-phone/XcodeProject';B=P/'PhoneCompanionTest/PhoneWeb.bundle'
def web(s):
 for a,b in [('v1203','v1204'),('v=1203','v=1204'),("'1203'","'1204'"),("\\'1203\\'","\\'1204\\'"),('north-sw-reloaded-1203-','north-sw-reloaded-1204-')]:s=s.replace(a,b)
 return s
def ios(s):
 for a,b in [('1.0.324','1.0.325'),('1\\.0\\.324','1\\.0\\.325'),('(324)','(325)'),('\\(324\\)','\\(325\\)'),('build324','build325'),('v=324','v=325'),('= 324;','= 325;'),('= 324/','= 325/'),('324-pixel-home-2','325-wardrobe-p82')]:s=s.replace(a,b)
 return s
def update(p,fn):
 if not p.exists():return
 old=p.read_text('utf-8');new=fn(old)
 if new!=old:p.write_text(new,'utf-8')
for base in [R,B]:
 for name in ['app.js','index.html','小手机.html','repair.html','web-hotfix.js','sw.js','pixel-home.js','pixel-home-policy.js']:update(base/name,web)
for p in R.glob('*.html'):update(p,web)
for name in ['index.html','小手机.html','private-runtime-diagnostics.js']:update(B/name,ios)
for name in ['PhoneCompanionTest.xcodeproj/project.pbxproj','PhoneCompanionTest/LocalPhoneWebView.swift','PhoneCompanionTest/PhoneNativeBridge.swift']:update(P/name,ios)
for p in (R/'tests').glob('*.test.mjs'):update(p,lambda s:ios(web(s)).replace('第三百二十四次安装_v1204','第三百二十五次安装_v1204'))
shutil.copy2(R/'pixel-home-policy.js',B/'pixel-home-policy.js')
shutil.copy2(R/'pixel-home.js',B/'pixel-home.js')
shutil.copytree(R/'games/pixel-home',B/'games/pixel-home',dirs_exist_ok=True)
text='''# v1204 私人衣柜整体试玩工程包

网页候选 v1204，私人内置网页 v1204，iOS 1.0.325 (325)，原生桥35。按既有私人 Mac 工程包流程交付；网页不推送、不上传、不部署。功能两边共有。这个 ZIP 是 Xcode 工程，不是可直接安装的 IPA。Windows 检查不等于 Mac 编译、签名或 iPhone 运行通过。

解压到新目录，打开 PhoneCompanionTest.xcodeproj，沿用现有 Apple Account、Team 和 Bundle ID，选择你的 iPhone 编译安装。不要先删除原 App，也不要解压覆盖旧工程目录。所有 Target 版本为 1.0.325 (325)。HomeKit、Screen Time、通知及原有扩展配置保留。

进入游戏大厅的像素少女：11套服装、11双鞋袜、8款棕发、5套五官、10组发饰；发型、五官、发饰的微调保留。闭眼恢复P78原弧线，只修线头；默认配置来自你本次导出的P82：人物118%、腿长94%、腿宽100%，小白裙、双麻花辫及下垂温柔眼。衣柜可保存、导出、导入；人物大小、腿长和腿宽可调。包含轻微呼吸、散发睡姿及新被子。玩法按钮和无气泡箭头保持。

角色照顾、计时、食品消耗、镜子护理、拍照收藏和后台取消沿用正式版处理，不采用独立预览的演示替身。既有角色早晨计划仍映射到草莓/校园两套，新衣柜的11套均可手动搭配。角色自动规划全衣柜不在本次扩展范围。

需在你的 iPhone 检查：版本标识、游戏进入、衣柜保存返回与重新进入、闭眼和呼吸、腿部比例、拍照收藏、睡醒、角色照顾、原有微信和共同生活入口。实际签名与真机结果尚未验证。
'''
(P/'第三百二十五次安装_v1204_完整衣柜_请先读.md').write_text(text,'utf-8')
update(P/'请在Mac编译前先读.md',lambda s:text+'\n以下为历史记录：\n\n'+s)
for p in [R/'games/pixel-home/README.md',B/'games/pixel-home/README.md']:update(p,lambda s:text+'\n以下为历史记录：\n\n'+s)
source=(R/'scripts/package_v1203_private_ios324.py').read_text('utf-8').replace('1203','1204').replace('324','325').replace('第三百二十四次','第三百二十五次').replace('PixelGirlInteractionFix','WardrobeP82').replace('像素少女交互修复','完整衣柜').replace('第三百二十五次安装_v1204_像素少女_请先读.md','第三百二十五次安装_v1204_完整衣柜_请先读.md')
# Include exact current approved wardrobe and test the offline (file URL) asset path.
source=source.replace("require(app,\"else if(c.p==='pixelhome')html=renderPixelHome()\")", "require(app,\"else if(c.p==='pixelhome')html=renderPixelHome()\")\nassert files[BUNDLE+'games/pixel-home/wardrobe/approved-config.json']==git('show','HEAD:games/pixel-home/wardrobe/approved-config.json')\nrequire(files[BUNDLE+'games/pixel-home/index.html'].decode('utf-8'),'wardrobe/data.js?v=1204')\nrequire(files[BUNDLE+'games/pixel-home/wardrobe/app.js'].decode('utf-8'),'body-legWidth')\nrequire(files[BUNDLE+'games/pixel-home/game.js'].decode('utf-8'),'wardrobe/host.js?v=1204')")
# The app constructs this control ID; verify its actual markup rather than a generated selector.
source=source.replace("require(files[BUNDLE+'games/pixel-home/wardrobe/app.js'].decode('utf-8'),'body-legWidth')", "require(files[BUNDLE+'games/pixel-home/wardrobe/index.html'].decode('utf-8'),'body-legWidth')")
(R/'scripts/package_v1204_private_ios325.py').write_text(source,'utf-8')
print('Prepared v1204 / iOS325; not committed, packaged or pushed.')
