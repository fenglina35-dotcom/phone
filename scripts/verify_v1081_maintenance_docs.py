from pathlib import Path
from zipfile import ZipFile

from docx import Document


root = Path(__file__).resolve().parents[1] / "docs" / "maintenance"
for path in sorted(root.glob("AI开发项目_*.docx")):
    with ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise RuntimeError(f"{path.name}: corrupt DOCX")
    text = "\n".join(p.text for p in Document(path).paragraphs)
    if "v1081｜" not in text:
        raise RuntimeError(f"{path.name}: missing v1081 section")
    txt = path.with_suffix(".txt")
    if "v1081｜" not in txt.read_text(encoding="utf-8"):
        raise RuntimeError(f"{txt.name}: missing v1081 section")
    print(f"{path.name}: v1081 OK")

print("v1081 maintenance DOCX/TXT structure checks passed")
