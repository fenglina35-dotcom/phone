from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native/private-small-phone/XcodeProject"
DELIVERY = ROOT / "delivery-v1054-private177-final"
PACKAGE_NAME = "SmallPhone_v1054_PrivateComplete_iOS177_MacReady"
STAGING = DELIVERY / PACKAGE_NAME
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
INSTALL_GUIDE = "第一百七十七次安装_v1054_外卖授权与全流程稳定_请先读.md"


def tracked_source_files():
    result = subprocess.run(
        ["git", "ls-files", "-z", "--", SOURCE.relative_to(ROOT).as_posix()],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
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
        yield path, relative


if DELIVERY.exists():
    resolved = DELIVERY.resolve()
    if resolved.parent != ROOT.resolve() or resolved.name != "delivery-v1054-private177-final":
        raise RuntimeError(f"unsafe delivery path: {resolved}")
    shutil.rmtree(resolved)

required = [
    SOURCE / "PhoneCompanionTest.xcodeproj/project.pbxproj",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/index.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/app.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/delivery.js",
    SOURCE / "请在Mac编译前先读.md",
    SOURCE / INSTALL_GUIDE,
]
for path in required:
    if not path.is_file():
        raise RuntimeError(f"missing required package file: {path}")

STAGING.mkdir(parents=True)
for source, relative in tracked_source_files():
    destination = STAGING / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

root_guides = sorted(path.name for path in STAGING.glob("*.md"))
if root_guides != sorted(["请在Mac编译前先读.md", INSTALL_GUIDE]):
    raise RuntimeError(f"unexpected package guides: {root_guides}")
if len(list(STAGING.rglob("PhoneWeb.bundle/index.html"))) != 1:
    raise RuntimeError("package must contain exactly one PhoneWeb.bundle/index.html")

bundle = STAGING / "PhoneCompanionTest/PhoneWeb.bundle"
app_text = (bundle / "app.js").read_text(encoding="utf-8")
for token in [
    "APP_VER='v1054 · 外卖授权与流程稳定修正版';",
    "PRIVATE_MIRROR_MODE='private-primary'",
    "privatePrimaryMirrorUpload",
    "remoteControlRoleReaction",
]:
    if token not in app_text:
        raise RuntimeError(f"v1054 bundled app feature missing: {token}")

delivery_text = (bundle / "delivery.js").read_text(encoding="utf-8")
for token in [
    "roleRequestIntent", "roleRequest", "realSearch", "createOrder",
    "requestRoleClarification", "roleTasks", "structuredModelAction",
    "麦满分单人餐随心选", "couponLabel",
]:
    if token not in delivery_text:
        raise RuntimeError(f"v1054 bundled delivery feature missing: {token}")
if sha256((bundle / "delivery.js").read_bytes()).digest() != sha256((ROOT / "delivery.js").read_bytes()).digest():
    raise RuntimeError("root and private delivery.js are not byte-identical")

shell_text = (bundle / "index.html").read_text(encoding="utf-8")
if "window.__NORTH_SHELL_BUILD__='1054'" not in shell_text or "delivery.js?v=1054" not in shell_text:
    raise RuntimeError("private shell is not v1054")
if "<string>1054</string>" not in (bundle / "Info.plist").read_text(encoding="utf-8"):
    raise RuntimeError("PhoneWeb.bundle Info.plist is not v1054")

project_text = (STAGING / "PhoneCompanionTest.xcodeproj/project.pbxproj").read_text(encoding="utf-8")
if project_text.count("CURRENT_PROJECT_VERSION = 177;") != 12 or project_text.count("MARKETING_VERSION = 1.0.177;") != 12:
    raise RuntimeError("private iOS version is not consistently 1.0.177 (177)")
webview_text = (STAGING / "PhoneCompanionTest/LocalPhoneWebView.swift").read_text(encoding="utf-8")
if "__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.177 (177)'" not in webview_text:
    raise RuntimeError("private build marker is not 1.0.177 (177)")
if "contractVersion = 25" not in (STAGING / "PhoneCompanionTest/PhoneNativeBridge.swift").read_text(encoding="utf-8"):
    raise RuntimeError("native bridge contract is not 25")
if list(STAGING.rglob("*.zip")) or list(STAGING.rglob("__pycache__")) or list(STAGING.rglob("*.pyc")):
    raise RuntimeError("nested package or cache found")

file_count = sum(1 for path in STAGING.rglob("*") if path.is_file())
with ZipFile(ZIP_PATH, "w", ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(STAGING.rglob("*")):
        if path.is_file():
            archive.write(path, Path(PACKAGE_NAME) / path.relative_to(STAGING))
shutil.rmtree(STAGING)
if list(DELIVERY.glob("*.zip")) != [ZIP_PATH] or list(DELIVERY.iterdir()) != [ZIP_PATH]:
    raise RuntimeError("delivery directory must contain exactly one ZIP")

print(f"ZIP={ZIP_PATH}")
print(f"FILES={file_count}")
print(f"SHA256={sha256(ZIP_PATH.read_bytes()).hexdigest()}")
