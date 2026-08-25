from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native/private-small-phone/XcodeProject"
DELIVERY = ROOT / "delivery-v1069-private193-final"
PACKAGE_NAME = "SmallPhone_v1069_PrivateWebContentRecovery_iOS193_MacReady"
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
INSTALL_GUIDE = "第一百九十三次安装_v1069_私人App_WebContent恢复与内存边界_请先读.md"


def source_files():
    result = subprocess.run(
        ["git", "ls-files", "-z", "--", SOURCE.relative_to(ROOT).as_posix()],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    seen = set()
    for raw in result.stdout.split(b"\0"):
        if not raw:
            continue
        path = ROOT / raw.decode("utf-8")
        relative = path.relative_to(SOURCE)
        if relative.suffix.lower() in {".zip", ".pyc"}:
            continue
        if any(part in {".git", ".codex_tmp", "__pycache__"} for part in relative.parts):
            continue
        if len(relative.parts) == 1 and "安装" in relative.name and relative.name != INSTALL_GUIDE:
            continue
        seen.add(relative.as_posix())
        yield path, relative
    guide = SOURCE / INSTALL_GUIDE
    relative = guide.relative_to(SOURCE)
    if relative.as_posix() not in seen:
        yield guide, relative


if DELIVERY.exists():
    existing = list(DELIVERY.iterdir())
    if existing != [ZIP_PATH]:
        raise RuntimeError(
            f"delivery contains unexpected files; refusing to overwrite: {existing}"
        )
else:
    DELIVERY.mkdir()

required = [
    SOURCE / "PhoneCompanionTest.xcodeproj/project.pbxproj",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/index.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/app.js",
    SOURCE / "PhoneCompanionTest/LocalPhoneWebView.swift",
    SOURCE / "PhoneCompanionTest/PhoneNativeBridge.swift",
    SOURCE / "请在Mac编译前先读.md",
    SOURCE / INSTALL_GUIDE,
]
for path in required:
    if not path.is_file():
        raise RuntimeError(f"missing required package file: {path}")

with tempfile.TemporaryDirectory(prefix="smallphone-v1069-ios193-", dir=ROOT) as temp:
    staging = Path(temp) / PACKAGE_NAME
    staging.mkdir(parents=True)
    for source, relative in source_files():
        destination = staging / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    root_guides = sorted(path.name for path in staging.glob("*.md"))
    expected_guides = sorted(["请在Mac编译前先读.md", INSTALL_GUIDE])
    if root_guides != expected_guides:
        raise RuntimeError(f"unexpected package guides: {root_guides}")

    bundle = staging / "PhoneCompanionTest/PhoneWeb.bundle"
    app_text = (bundle / "app.js").read_text(encoding="utf-8")
    for token in [
        "APP_VER='v1069 · 角色外卖续触发与私人稳定整合版';",
        "const PRIVATE_IMAGE_CACHE_CHAR_LIMIT=48*1024*1024",
        "function privateAppStorageBreakdown()",
        "roleServerPushPull",
        "remoteControlRoleReaction",
    ]:
        if token not in app_text:
            raise RuntimeError(f"protected private route missing: {token}")
    trim_start = app_text.index("function privateTrimImageMemoryCache(")
    trim_end = app_text.index("function imgManyChunk(", trim_start)
    trim_body = app_text[trim_start:trim_end]
    for forbidden in ["imgDel", "indexedDB.deleteDatabase", "localStorage.clear"]:
        if forbidden in trim_body:
            raise RuntimeError(f"memory trim must not delete stored data: {forbidden}")

    shell_text = (bundle / "index.html").read_text(encoding="utf-8")
    if "window.__NORTH_SHELL_BUILD__='1069'" not in shell_text:
        raise RuntimeError("private shell is not v1069")
    if "<string>1069</string>" not in (bundle / "Info.plist").read_text(encoding="utf-8"):
        raise RuntimeError("PhoneWeb.bundle Info.plist is not v1069")

    project_text = (staging / "PhoneCompanionTest.xcodeproj/project.pbxproj").read_text(encoding="utf-8")
    if project_text.count("CURRENT_PROJECT_VERSION = 193;") != 12:
        raise RuntimeError("private build number is not consistently 193")
    if project_text.count("MARKETING_VERSION = 1.0.193;") != 12:
        raise RuntimeError("private marketing version is not consistently 1.0.193")

    webview_text = (staging / "PhoneCompanionTest/LocalPhoneWebView.swift").read_text(encoding="utf-8")
    for token in [
        "__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.193 (193)'",
        "guard attempt == 1 else",
        "deadline: .now() + 5",
        "webView.loadFileURL(",
    ]:
        if token not in webview_text:
            raise RuntimeError(f"private recovery marker missing: {token}")
    if "webView?.reload()" in webview_text:
        raise RuntimeError("unbounded current-page reload path is still present")

    bridge_text = (staging / "PhoneCompanionTest/PhoneNativeBridge.swift").read_text(encoding="utf-8")
    if "contractVersion = 25" not in bridge_text:
        raise RuntimeError("native bridge contract is not 25")
    if list(staging.rglob("*.zip")) or list(staging.rglob("__pycache__")) or list(staging.rglob("*.pyc")):
        raise RuntimeError("nested package or cache found")

    file_count = sum(1 for path in staging.rglob("*") if path.is_file())
    temporary_zip = Path(temp) / f"{PACKAGE_NAME}.zip"
    with ZipFile(temporary_zip, "w", ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(staging.rglob("*")):
            if path.is_file():
                archive.write(path, Path(PACKAGE_NAME) / path.relative_to(staging))
    temporary_zip.replace(ZIP_PATH)

if list(DELIVERY.iterdir()) != [ZIP_PATH]:
    raise RuntimeError("delivery directory must contain exactly one ZIP")

print(f"ZIP={ZIP_PATH}")
print(f"FILES={file_count}")
print(f"SIZE={ZIP_PATH.stat().st_size}")
print(f"SHA256={sha256(ZIP_PATH.read_bytes()).hexdigest()}")
