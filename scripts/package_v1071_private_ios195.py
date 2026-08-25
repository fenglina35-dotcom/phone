from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native/private-small-phone/XcodeProject"
BUNDLE_SOURCE = SOURCE / "PhoneCompanionTest/PhoneWeb.bundle"
DELIVERY = ROOT / "delivery-v1071-private195-final"
PACKAGE_NAME = "SmallPhone_v1071_CompleteWeChatBundle_iOS195_MacReady"
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
INSTALL_GUIDE = "第一百九十五次安装_v1071_私人App_完整微信Bundle_请先读.md"


def allowed(path: Path, relative: Path) -> bool:
    if relative.suffix.lower() in {".zip", ".pyc"}:
        return False
    if any(part in {".git", ".codex_tmp", "__pycache__"} for part in relative.parts):
        return False
    if len(relative.parts) == 1 and "安装" in relative.name and relative.name != INSTALL_GUIDE:
        return False
    return path.is_file()


def source_files():
    result = subprocess.run(
        ["git", "ls-files", "-z", "--", SOURCE.relative_to(ROOT).as_posix()],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    selected: dict[str, Path] = {}
    for raw in result.stdout.split(b"\0"):
        if not raw:
            continue
        path = ROOT / raw.decode("utf-8")
        relative = path.relative_to(SOURCE)
        if allowed(path, relative):
            selected[relative.as_posix()] = path

    # PhoneWeb.bundle is intentionally ignored by Git. It is nevertheless a
    # required runtime resource, so package every real file from it explicitly.
    for path in BUNDLE_SOURCE.rglob("*"):
        relative = path.relative_to(SOURCE)
        if allowed(path, relative):
            selected[relative.as_posix()] = path

    guide = SOURCE / INSTALL_GUIDE
    selected[guide.relative_to(SOURCE).as_posix()] = guide
    for key in sorted(selected):
        yield selected[key], Path(key)


def file_map(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }


if DELIVERY.exists():
    existing = list(DELIVERY.iterdir())
    if existing != [ZIP_PATH]:
        raise RuntimeError(f"delivery contains unexpected files; refusing to overwrite: {existing}")
else:
    DELIVERY.mkdir()

required = [
    SOURCE / "PhoneCompanionTest.xcodeproj/project.pbxproj",
    BUNDLE_SOURCE / "index.html",
    BUNDLE_SOURCE / "app.js",
    BUNDLE_SOURCE / "wechat-me.js",
    BUNDLE_SOURCE / "wechat-me.css",
    BUNDLE_SOURCE / "vendor/qr/jsQR.js",
    BUNDLE_SOURCE / "vendor/qr/qrcode.js",
    SOURCE / "PhoneCompanionTest/LocalPhoneWebView.swift",
    SOURCE / "PhoneCompanionTest/PhoneNativeBridge.swift",
    SOURCE / "请在Mac编译前先读.md",
    SOURCE / INSTALL_GUIDE,
]
for path in required:
    if not path.is_file():
        raise RuntimeError(f"missing required package file: {path}")

with tempfile.TemporaryDirectory(prefix="smallphone-v1071-ios195-", dir=ROOT) as temp:
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
    source_bundle_files = file_map(BUNDLE_SOURCE)
    staged_bundle_files = file_map(bundle)
    if source_bundle_files != staged_bundle_files:
        missing = sorted(set(source_bundle_files) - set(staged_bundle_files))
        extra = sorted(set(staged_bundle_files) - set(source_bundle_files))
        changed = sorted(k for k in set(source_bundle_files) & set(staged_bundle_files) if source_bundle_files[k] != staged_bundle_files[k])
        raise RuntimeError(f"PhoneWeb.bundle mismatch: missing={missing}, extra={extra}, changed={changed}")

    app_text = (bundle / "app.js").read_text(encoding="utf-8")
    for token in [
        "APP_VER='v1071 · 私人App完整微信Bundle修复版';",
        "const PRIVATE_IMAGE_CACHE_CHAR_LIMIT=48*1024*1024",
        "function privateAppStorageBreakdown()",
        "roleServerPushPull",
        "remoteControlRoleReaction",
    ]:
        if token not in app_text:
            raise RuntimeError(f"protected private route missing: {token}")

    shell_text = (bundle / "index.html").read_text(encoding="utf-8")
    if "window.__NORTH_SHELL_BUILD__='1071'" not in shell_text:
        raise RuntimeError("private shell is not v1071")
    if "<string>1071</string>" not in (bundle / "Info.plist").read_text(encoding="utf-8"):
        raise RuntimeError("PhoneWeb.bundle Info.plist is not v1071")

    project_text = (staging / "PhoneCompanionTest.xcodeproj/project.pbxproj").read_text(encoding="utf-8")
    if project_text.count("CURRENT_PROJECT_VERSION = 195;") != 12:
        raise RuntimeError("private build number is not consistently 195")
    if project_text.count("MARKETING_VERSION = 1.0.195;") != 12:
        raise RuntimeError("private marketing version is not consistently 1.0.195")

    webview_text = (staging / "PhoneCompanionTest/LocalPhoneWebView.swift").read_text(encoding="utf-8")
    if "__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.195 (195)'" not in webview_text:
        raise RuntimeError("private build marker is not 1.0.195 (195)")
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

    with ZipFile(temporary_zip) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP integrity test failed")
        prefix = f"{PACKAGE_NAME}/PhoneCompanionTest/PhoneWeb.bundle/"
        for relative, expected in source_bundle_files.items():
            name = prefix + relative
            if name not in archive.namelist():
                raise RuntimeError(f"ZIP omitted Bundle file: {relative}")
            if archive.read(name) != expected:
                raise RuntimeError(f"ZIP changed Bundle file: {relative}")
    temporary_zip.replace(ZIP_PATH)

if list(DELIVERY.iterdir()) != [ZIP_PATH]:
    raise RuntimeError("delivery directory must contain exactly one ZIP")

print(f"ZIP={ZIP_PATH}")
print(f"FILES={file_count}")
print(f"BUNDLE_FILES={len(source_bundle_files)}")
print(f"SIZE={ZIP_PATH.stat().st_size}")
print(f"SHA256={sha256(ZIP_PATH.read_bytes()).hexdigest()}")
