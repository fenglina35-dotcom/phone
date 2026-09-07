from pathlib import Path
import shutil
R=Path(__file__).resolve().parents[1];P=R/'native/private-small-phone/XcodeProject';B=P/'PhoneCompanionTest/PhoneWeb.bundle'
def web(s):
 for a,b in [('v1204','v1205'),('v=1204','v=1205'),("'1204'","'1205'"),("\\'1204\\'","\\'1205\\'"),('north-sw-reloaded-1204-','north-sw-reloaded-1205-')]:s=s.replace(a,b)
 return s
def ios(s):
 for a,b in [('1.0.325','1.0.326'),('1\\.0\\.325','1\\.0\\.326'),('(325)','(326)'),('\\(325\\)','\\(326\\)'),('build325','build326'),('v=325','v=326'),('= 325;','= 326;'),('= 325/','= 326/'),('325-wardrobe-p82','326-custom-outfits')]:s=s.replace(a,b)
 return s
def update(p,f):
 if p.exists():
  old=p.read_text('utf-8');new=f(old)
  if new!=old:p.write_text(new,'utf-8')
for base in [R,B]:
 for n in ['app.js','index.html','小手机.html','repair.html','web-hotfix.js','sw.js','pixel-home.js','pixel-home-policy.js']:update(base/n,web)
for p in R.glob('*.html'):update(p,web)
for n in ['index.html','小手机.html','private-runtime-diagnostics.js']:update(B/n,ios)
for n in ['PhoneCompanionTest.xcodeproj/project.pbxproj','PhoneCompanionTest/LocalPhoneWebView.swift','PhoneCompanionTest/PhoneNativeBridge.swift']:update(P/n,ios)
for p in (R/'tests').glob('*.test.mjs'):update(p,lambda s:ios(web(s)).replace('第三百二十五次安装_v1205','第三百二十六次安装_v1205'))
for n in ['index.html','game.js','wardrobe/index.html']:update(R/'games/pixel-home'/n,web)
shutil.copy2(R/'pixel-home-policy.js',B/'pixel-home-policy.js');shutil.copy2(R/'pixel-home.js',B/'pixel-home.js')
shutil.copytree(R/'games/pixel-home',B/'games/pixel-home',dirs_exist_ok=True)
old=P/'第三百二十五次安装_v1204_完整衣柜_请先读.md'
text=ios(web(old.read_text('utf-8')))
text=text.replace('# v1205 私人衣柜整体试玩工程包','# v1205 自定义套装与发型修边候选')
text+='\n本次新增：存为套装／我的套装（最多30套），包括当前装扮、微调、身体比例和动态开关；支持改名、更新、删除、导入导出。当前账号和角色分别保存。月牙小揪揪与初始小辫仅清理局部alpha，保留原画布与发圈。去掉遮挡保存按钮的衣柜外层叉号。尚未制作新的ZIP，旧v1204包不变；仅本地候选，未推送网页，未真机验证。\n'
(P/'第三百二十六次安装_v1205_完整衣柜_请先读.md').write_text(text,'utf-8')
print('v1205 / iOS326 source candidate mirrored; no package or push.')
