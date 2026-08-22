from pathlib import Path
from zipfile import ZipFile
from docx import Document


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "maintenance"
EXPECTED = {
    "AI开发项目_项目说明文档.docx": "v1045／私人 1.0.165（165）微信运动与外卖精准直达整合",
    "AI开发项目_Bug记录模板.docx": "v1045 Bug记录：微信运动、通话图片、布局与外卖精准路线",
    "AI开发项目_Bug修改规范.docx": "v1045 维护规范补充：真实设备数据、本地图片与外卖路线",
    "AI开发项目_新聊天启动说明.docx": "v1045 新聊天交接补充",
}

for name, marker in EXPECTED.items():
    path = DOCS / name
    with ZipFile(path) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError(f"corrupt DOCX member in {name}: {bad}")
    doc = Document(path)
    text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
    if marker not in text:
        raise RuntimeError(f"missing v1045 marker in {name}")
    print(f"verified {name}")
