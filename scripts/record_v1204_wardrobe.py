from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from xml.sax.saxutils import escape
from xml.etree import ElementTree as ET
R=Path(__file__).resolve().parents[1];D=R/'docs/maintenance';P=R/'native/private-small-phone/XcodeProject'
title='2026年9月7日 v1204 私人衣柜整体试玩'
shared='两边共有的本地源码候选 v1204，私人 iOS1.0.325 (325)，原生桥35。按既有授权制作私人 Mac 待编译工程包；本地归档提交，不推送网页。11套衣服及鞋袜、8款棕发、5套五官、10组发饰从P82接入正式小游戏。用户通过页面导出参数：人物118%、腿长94%、腿宽100%，小白裙、双麻花辫、下垂温柔眼；闭眼双眼y5、宽93%、旋转-1.5、间距-3.5。全部沿用。'
rows={
'AI开发项目_项目说明文档.docx':[shared,'正式角色照顾/绑定校验/存档/护理/拍照函数保留，只接入人物渲染和衣柜。衣柜在当前小屋内打开，按账号与绑定角色隔离参数，保存后回写正式手机存档。file模式采用原PNG的data URI及普通脚本，避免module/fetch与画布污染。保留呼吸、独立腿宽腿长、睡觉散发与被子、玩法按钮、无气泡箭头。原晨间角色计划继续映射草莓和校园两套，其余新服装支持手动搭配。','Windows全仓1580/1580通过；网页与私人正式入口各20项本地替身模型检查通过；两份file页面衣柜保存返回、重进、拍照、睡醒及320px通过。没有真实模型/Mac编译/签名/iPhone运行证据，不称IPA或真机交付完成。'],
'AI开发项目_Bug记录模板.docx':[shared,'P81闭眼导入错误：几乎透明的杂点撑大边界，整体缩小后实际眼线约8px且偏心。用户澄清只要去线头，最终P82恢复P78长弧线47px素材画布与原锚点，仅6至8像素alpha清理。睁眼半闭眼和已有布局不改。包内采用用户后来保存的P82微调值，不再重置。','打包前发现正式小游戏仍旧版，不能整份覆盖正式game.js为演示版。移植渲染、资源和衣柜，保留真实角色请求与file拍照。新增衣柜schema白名单、账号隔离、参数回写和离线文件测试。初始全仓检查发现新PNG包装脚本引号/尾换行不符旧字节契约及安装说明路径旧名；统一包装格式、更新当前说明路径后1580项全通过。浏览器全流程通过不等于真机通过。'],
'AI开发项目_Bug修改规范.docx':['像素素材的透明杂点不能作为可见轮廓边界；先量实际alpha可见范围，修局部线头时禁止整体缩短眼线。独立预览接入正式小游戏必须逐项保留角色桥、账号隔离、持久化和file素材读取，不能用演示入口替换正式逻辑。必须从用户页面实际导出的配置生成默认值，并在包内核对每份素材和入口字节。']}
for name,paragraphs in rows.items():
 p=D/name
 with ZipFile(p) as z:infos=z.infolist();files={i.filename:z.read(i.filename) for i in infos}
 xml=files['word/document.xml'].decode('utf-8')
 if title in xml:continue
 extra=''.join('<w:p><w:r><w:t xml:space="preserve">'+escape(t)+'</w:t></w:r></w:p>' for t in [title]+paragraphs)
 mark=xml.rfind('<w:sectPr');mark=mark if mark>=0 else xml.rfind('</w:body>')
 new=xml[:mark]+extra+xml[mark:];ET.fromstring(new)
 files['word/document.xml']=new.encode('utf-8')
 with ZipFile(p,'w',ZIP_DEFLATED) as z:
  for info in infos:z.writestr(info,files[info.filename])
 with ZipFile(p) as z:assert z.testzip() is None;assert z.read('word/document.xml').decode('utf-8').replace(extra,'')==xml

matrix='''# v1204 与 iOS325 核对记录

本包为私人 Mac 待编译工程包，尚未 Mac 编译签名及真实 iPhone 验收。没有网页推送或部署。既有 Team 与 Bundle ID 只读核对，未更改。

| 用户要求 | 代码位置 | 网页入口 | 私人包入口 | 可见结果与测试 |
|---|---|---|---|---|
| 全部衣柜 | games/pixel-home/wardrobe | 游戏大厅→像素少女→衣柜 | PhoneWeb.bundle同路径 | 11套、11鞋袜、8棕发、5五官、10发饰；两边file测试通过 |
| 保留微调 | wardrobe/approved-config.json、pixel-home-policy.js | 衣柜保存 | 相同入口 | 导出P82参数原样收录，返回与重进通过 |
| 闭眼只去线头 | wardrobe/assets/face*-closed.png | 原版棕色、下垂温柔眼 | 同路径同字节 | 保留P78弧线与P82用户微调，未用废弃P81生图 |
| 呼吸、大小、腿长腿宽 | wardrobe/host.js、game.js | 比例按钮 | 同路径 | 保存重进通过；真实iPhone流畅度待验证 |
| 睡姿与被子 | assets/sleep-overlay-p80.png | 上床睡觉 | 同路径 | file画面加载及睡醒通过 |
| 玩法、无气泡箭头 | index.html、immersive.css | 小屋主页面 | 同路径 | 正式两入口检查通过 |
| 不丢原有功能 | game.js、bridge.js及原生工程 | 角色照顾、拍照、游戏大厅 | 同入口原桥35 | 各20项浏览器替身测试；全仓1580通过，非真实模型/真机验收 |

脚本：scripts/check_pixel_home.cjs，scripts/check_v1204_wardrobe.cjs，tests/pixel-wardrobe.test.mjs。file测试使用隔离存档，没有触碰用户真实聊天或模型。

文档记录为追加，原文XML及其他包成员保留；本机没有LibreOffice，DOCX未做渲染验收，未把文档排版检查作为运行验收证据。
'''
(P/'验收记录_v1204.md').write_text(matrix,'utf-8')
(R/'.qa/v1204/release-matrix.md').write_text(matrix,'utf-8')
print('Appended maintenance history and explicit package acceptance matrix.')
