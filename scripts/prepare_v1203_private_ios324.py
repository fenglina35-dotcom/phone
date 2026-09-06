"""Prepare the v1203 private fix candidate. No commit or push."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT/'native/private-small-phone/XcodeProject'
BUNDLE=PROJECT/'PhoneCompanionTest/PhoneWeb.bundle'
def update(p,fn):
    old=p.read_text('utf-8');new=fn(old)
    if new!=old:p.write_text(new,'utf-8')
def web(s):
    for a,b in [('v1202','v1203'),('v=1202','v=1203'),("'1202'","'1203'"),("\\'1202\\'","\\'1203\\'"),('north-sw-reloaded-1202-','north-sw-reloaded-1203-')]:s=s.replace(a,b)
    return s
def ios(s):
    for a,b in [('1.0.323','1.0.324'),('1\\.0\\.323','1\\.0\\.324'),('(323)','(324)'),('\\(323\\)','\\(324\\)'),('build323','build324'),('v=323','v=324'),('= 323;','= 324;'),('= 323/','= 324/'),('323-pixel-home-1','324-pixel-home-2')]:s=s.replace(a,b)
    return s
for base in [ROOT,BUNDLE]:
    for n in ['app.js','index.html','小手机.html','repair.html','web-hotfix.js','sw.js','pixel-home.js','pixel-home-policy.js']:
        if (base/n).exists():update(base/n,web)
    for p in (base/'games/pixel-home').glob('*'):
        if p.suffix in {'.js','.css','.html'}:update(p,web)
for p in ROOT.glob('*.html'):update(p,web)
for n in ['index.html','小手机.html','private-runtime-diagnostics.js']:update(BUNDLE/n,ios)
for n in ['PhoneCompanionTest.xcodeproj/project.pbxproj','PhoneCompanionTest/LocalPhoneWebView.swift','PhoneCompanionTest/PhoneNativeBridge.swift']:update(PROJECT/n,ios)
for p in (ROOT/'tests').glob('*.test.mjs'):
    update(p,lambda s:ios(web(s)).replace('第三百二十三次安装_v1203','第三百二十四次安装_v1203'))
guide='第三百二十四次安装_v1203_像素少女_请先读.md'
text='''# v1203 像素少女交互修复私人源码候选

网页源码与私人内置网页 v1203，私人 iOS 1.0.324 (324)，原生桥 35。网页不推送、不上传、不部署。此次修复两边共有，仅交付私人 Mac 待编译源码候选。

照顾安排不再等待全手机存档队列，不因输出截断自动续写；等待有秒数，整轮超时停止等待，同一未结束请求不重复发出，迟到结果不执行。仍使用情侣空间绑定角色的模型安排，不编造模型回复；实际线路故障仍需处理。
相机使用不改变原图的本地编码素材规避 file 图片污染画布，拍后打开收藏，导出失败有反馈。全屏图标改为玩法，删除重复玩法气泡。左右切换只显示箭头，保留透明点击区域。睡姿遵循原图比例，收窄显示；上床自动关灯保留。用户撤回蓝色选取框修改，拖动事件与选择规则保持。

不要先删除原 App，不要解压覆盖旧工程目录。将整个压缩包解压到新目录，打开 PhoneCompanionTest.xcodeproj。先检查各 Target 的 Apple Account、Team、Bundle ID、Automatic Signing、Provisioning Profile、Entitlements 与现有 HomeKit 等权限；所有 Target 应为 1.0.324 (324)。沿用原签名身份和 Bundle ID 覆盖安装，不替换成其他项目身份。

保留原有微信、共同生活、后台回复接力、心情、请求规模详情、外卖、监管、键盘及原生桥功能。测试状态详见包内验收记录；Windows 和浏览器模拟不等于 Mac 编译、签名或真实 iPhone 验收。本包不是可直接安装的 IPA。请在真机确认 v1203 / 1.0.324 (324)，照顾、三场景拍照收藏、睡姿、玩法入口与箭头。
'''
(PROJECT/guide).write_text(text,'utf-8')
p=PROJECT/'请在Mac编译前先读.md';old=p.read_text('utf-8')
if not old.startswith('# v1203'):p.write_text(text+'\n以下为历史记录，不是当前包指令：\n\n'+old,'utf-8')
source=(ROOT/'scripts/package_v1202_private_ios323.py').read_text('utf-8').replace('1202','1203').replace('323','324').replace('第三百二十三次','第三百二十四次')
source=source.replace('PixelGirlCare','PixelGirlInteractionFix').replace('iOS324_像素少女照顾版','iOS324_像素少女交互修复')
(ROOT/'scripts/package_v1203_private_ios324.py').write_text(source,'utf-8')
p=ROOT/'games/pixel-home/README.md';old=p.read_text('utf-8')
prefix=text+'\n以下为历史记录：\n\n'
if not old.startswith('# v1203'):p.write_text(prefix+old,'utf-8')
shutil.copy2(p,BUNDLE/'games/pixel-home/README.md')
print('Prepared v1203 / iOS324. No commit, package or push.')
