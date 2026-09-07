from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from xml.sax.saxutils import escape
from xml.etree import ElementTree as ET
R=Path(__file__).resolve().parents[1];D=R/'docs/maintenance';P=R/'native/private-small-phone/XcodeProject';B=P/'PhoneCompanionTest/PhoneWeb.bundle'
title='2026年9月7日 v1205 自定义套装和发型白边修复'
scope='两边共有的本地候选v1205，私人iOS1.0.326 (326)，原生桥35。未推送网页，未重新制作ZIP；已有v1204/iOS325包不变。用户要求本地截图验收。尚未Mac编译签名、真实 iPhone验收，不称真机已修复。'
paragraphs={
'AI开发项目_项目说明文档.docx':[scope,'自定义套装支持名称（1至30字）、最多30套、保存当前全部装扮与选中素材微调、身体比例、动态开关；支持一键穿上、改名、更新、删除确认及配置导入导出。保存结构通过正式手机snapshot验证，按账号与情侣角色隔离，不把套装列表递归复制进每套。保留旧P82导出文件的完整素材清单兼容，修边不使已保存配置失效。','每日8点自动随机换装优先从自定义套装选择，没有自定义时从现有11套选择；有多个候选时避免与上一天重复。一次只应用当前日，不回放离线多日。App关闭不能后台准点执行，在下一次前台运行补当天。编辑衣柜期间延后到返回小屋，防止覆盖正在调整的搭配。实际日期、套装ID、名字和发生时间保存，并作为当前绑定角色的buildSystem及照顾模型上下文；区分晨间记录与后来手动穿搭，不制造固定角色回复。','返回游戏大厅缩为返回，比例移动到金币左侧，金币和星星缩小；左右四排图标统一高宽和间距。返回浴室与返回分行，移除遮挡保存搭配的衣柜外层叉号。手机调整参数使用正常文档流，避免面板遮住动态和相机按钮。衣柜预览为身体放大后的头顶留足空间，不改变用户比例参数。'],
'AI开发项目_Bug记录模板.docx':[scope,'两款发型原PNG包含实心白色底残留，非缩放或用户参数错误。按用户确认的局部透明修边方案处理初始双小辫hair0-front及月牙hair6-front：尺寸分别295×301、858×694，只有723及6794个alpha像素清透明，所有RGB不变，初始浅色发圈区域保持原样。第一次仅沿透明区域连通清理仍留下被深色细轮廓包围的白块；查看对比后增加原轮廓附近限定距离内的浅色残留，不做整圈侵蚀。保留其他142张衣柜PNG及全部定位参数。','衣柜外层关闭叉号覆盖保存搭配，旧关闭逻辑仅读取旧localStorage，误点会放弃未保存编辑。移除该控件，返回小屋先保存，存储失败不退出；自定义套装写入失败回滚列表。保存后截图不变、返回重进不丢。返回大厅与镜子返回浴室共享左上坐标，改成分行；比例占右侧第一行导致四排图标错位，改到金币旁。','验证：两边file浏览器命名保存、完整参数恢复、改名/更新/删除/取消、导出再导入、旧P82导入、存储失败保留、320px保存按钮无覆盖、两边四排对齐及镜子两个返回不重叠。两边正式角色入口原20项照顾/保存/拍照/取消回归通过。实际buildSystem纳入已换套装名，仅绑定角色获得记录，实际桥重进显示对应发型和比例。晨间纯函数覆盖8点边界、一天一次、倒退日期、离线补当天、自定义优先及11套内置候选。第一轮全仓1586/1587通过，唯一失败为Mac指南头部仍旧版本，追加新版说明后重跑。'],
'AI开发项目_Bug修改规范.docx':['修白边要区分透明边缘残底、浅色发圈和发丝高光，禁止统一删除浅色或整体缩小素材；保留原画布、锚点、RGB，记录alpha变化和保护区。自定义套装保存选中装扮的独立快照，禁止快照里嵌套整份套装列表；更新和删除必须有明确目标，不能按同名覆盖。原素材清单仅做白边修复时须显式兼容旧完整hash清单，不放开任意不匹配配置。','嵌套iframe上的关闭按钮必须检查遮挡和未保存状态。自动换装不能盖掉用户正在编辑的搭配；只存实际执行记录，不把旧固定两套计划或随机执行结果冒充角色新生成的发言。真实模型上下文仅传当前绑定账号与角色的套装名字/事实。网页8点任务必须说明关闭App时不能准点执行。']}
for name,ps in paragraphs.items():
 p=D/name
 with ZipFile(p) as z:infos=z.infolist();files={i.filename:z.read(i.filename) for i in infos}
 xml=files['word/document.xml'].decode('utf-8')
 if title in xml:continue
 extra=''.join('<w:p><w:r><w:t xml:space="preserve">'+escape(t)+'</w:t></w:r></w:p>' for t in [title]+ps)
 mark=xml.rfind('<w:sectPr');mark=mark if mark>=0 else xml.rfind('</w:body>');new=xml[:mark]+extra+xml[mark:];ET.fromstring(new);files['word/document.xml']=new.encode('utf-8')
 with ZipFile(p,'w',ZIP_DEFLATED) as z:
  for i in infos:z.writestr(i,files[i.filename])
 with ZipFile(p) as z:assert z.testzip() is None;assert z.read('word/document.xml').decode('utf-8').replace(extra,'')==xml
guide='''# v1205 私人工程包源码候选 自定义套装与发型修边

两边共有：网页源码候选 v1205，私人内置网页 v1205，私人iOS 1.0.326 (326)，原生桥35。本轮按用户要求做本地截图；未推送网页，尚未制作新ZIP。旧v1204/iOS325包保留。本地自动检查不等于Mac编译签名或真实 iPhone验收。

新增存为套装和我的套装，可以命名、一键换装、更新、改名或删除；保留衣服、鞋袜、发型、五官、发饰和微调。每天早上8点优先从自定义套装随机换装，没有自定义时使用11套内置服装；实际名字写入角色上下文。App关闭期间下次前台补当天一次，衣柜编辑时延后，不能承诺后台准点执行。

两款头发只清理局部alpha白边。去掉衣柜挡住保存按钮的叉号，两个返回不重叠；主页面返回简化为两字，比例移到金币左侧，左右四排工具对齐。旧参数和P82配置仍可使用。

后续若制作Mac源码包，解压到新目录，打开PhoneCompanionTest.xcodeproj，沿用既有签名。不要先删除原App，不要解压覆盖旧工程目录。尚未Mac编译、签名、真实 iPhone运行。
'''
(P/'第三百二十六次安装_v1205_完整衣柜_请先读.md').write_text(guide,'utf-8')
for p in [P/'请在Mac编译前先读.md',R/'games/pixel-home/README.md',B/'games/pixel-home/README.md']:
 old=p.read_text('utf-8')
 if not old.startswith('# v1205'):p.write_text(guide+'\n以下为历史记录：\n\n'+old,'utf-8')
matrix='''# v1205 本地验收

|用户要求|修改位置|网页/私人入口|检查|
|---|---|---|---|
|两款白边|wardrobe/assets/hair0-front.png及hair6-front.png|游戏大厅→像素少女→衣柜，两份相同PNG|只alpha清理，保护发圈及布局，浏览器近景截图|
|命名自定义套装|wardrobe/app.js、pixel-home-policy.js|衣柜→存为套装→我的套装|保存/重进/整套参数/更新/改名/删除/失败回滚/导入导出|
|每天8点换装及角色知道|pixel-home.js、pixel-wardrobe-info.js、buildSystem|绑定角色小游戏及微信/共用角色提示构建|时间边界、去重、离线补偿、账号隔离、实际提示与桥重进|
|遮挡与四排按钮|小游戏index.html、immersive.css，衣柜style.css|主屏、镜子、衣柜|320/430宽按钮命中及坐标检查、左右四排相同y和高度|

脚本：check_v1205_outfits.cjs、check_v1205_role_outfits.cjs、check_pixel_home.cjs、pixel-home-morning-outfits.test.mjs及全仓node测试。
本机没有LibreOffice，维护DOCX只验证追加XML及旧历史保留，未做排版渲染；不把文档检查当作真机运行证据。没有新ZIP、网页推送、Mac或iPhone结果。
'''
(P/'验收记录_v1205.md').write_text(matrix,'utf-8')
print('Maintenance records appended; current guides and acceptance matrix updated.')
