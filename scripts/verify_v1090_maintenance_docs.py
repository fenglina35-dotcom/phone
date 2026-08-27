from pathlib import Path
from zipfile import ZipFile

from docx import Document


root = Path(__file__).resolve().parents[1] / "docs" / "maintenance"
expected = {
    "AI开发项目_项目说明文档": "自然外卖承诺必须落到可执行动作",
    "AI开发项目_Bug修改规范": "自然外卖口头承诺与执行一致性规范",
    "AI开发项目_Bug记录模板": "角色答应找果茶但后台自动化无反应",
    "AI开发项目_新聊天启动说明": "v1090｜新聊天接手说明",
}
for stem, token in expected.items():
    path = root / f"{stem}.docx"
    with ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise RuntimeError(f"{path.name}: corrupt DOCX")
    text = "\n".join(p.text for p in Document(path).paragraphs)
    if "v1090｜" not in text or token not in text:
        raise RuntimeError(f"{path.name}: missing v1090 section")
    txt = path.with_suffix(".txt")
    mirror = txt.read_text(encoding="utf-8")
    if "v1090｜" not in mirror or token not in mirror:
        raise RuntimeError(f"{txt.name}: missing v1090 section")
    print(f"{path.name}: v1090 OK")

print("v1090 maintenance DOCX/TXT structure checks passed")
