from hashlib import sha256
from pathlib import Path
import shutil
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native/private-small-phone/XcodeProject"
DELIVERY = ROOT / "delivery-v1048"
PACKAGE_NAME = "SmallPhone_v1048_DeliveryAvatarSync_iOS166_MacReady"
STAGING = DELIVERY / PACKAGE_NAME
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
INSTALL_GUIDE = "第一百六十六次安装_v1048_外卖换店与聊天头像同步_请先读.md"


def should_skip(relative: Path) -> bool:
    if any(part in {".git", ".codex_tmp", "__pycache__"} for part in relative.parts):
        return True
    if relative.suffix.lower() in {".pyc", ".zip"}:
        return True
    if len(relative.parts) == 1 and "安装" in relative.name and relative.name != INSTALL_GUIDE:
        return True
    return False


if DELIVERY.exists():
    resolved = DELIVERY.resolve()
    if resolved.parent != ROOT.resolve() or resolved.name != "delivery-v1048":
        raise RuntimeError(f"unsafe delivery path: {resolved}")
    shutil.rmtree(resolved)

required = [
    SOURCE / "PhoneCompanionTest.xcodeproj/project.pbxproj",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/index.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/app.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/delivery.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/glass-theme.css",
    SOURCE / "请在Mac编译前先读.md",
    SOURCE / INSTALL_GUIDE,
]
for path in required:
    if not path.is_file():
        raise RuntimeError(f"missing required package file: {path}")

STAGING.mkdir(parents=True)
for source in sorted(SOURCE.rglob("*")):
    relative = source.relative_to(SOURCE)
    if should_skip(relative):
        continue
    destination = STAGING / relative
    if source.is_dir():
        destination.mkdir(parents=True, exist_ok=True)
    else:
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
    "APP_VER='v1048 · 外卖换店与聊天头像同步版';",
    "renderWxSteps",
    "remoteControlRoleReaction",
    "off-date-nav",
    "PRIVATE_MIRROR_MODE='private-primary'",
    "privatePrimaryMirrorUpload",
    "privateMirrorRestoreRollback",
]:
    if token not in app_text:
        raise RuntimeError(f"v1048 bundled app repair missing: {token}")
delivery_text = (bundle / "delivery.js").read_text(encoding="utf-8")
for token in ["PREF_CONFIG", "roleGlobalSearch", "allowGlobalSearch", "最多检查三家匹配门店"]:
    if token not in delivery_text:
        raise RuntimeError(f"v1048 bundled delivery repair missing: {token}")
shell_text = (bundle / "小手机.html").read_text(encoding="utf-8")
for token in ["align-items:center", "width:42px;height:42px", "window.__NORTH_SHELL_BUILD__='1048'"]:
    if token not in shell_text:
        raise RuntimeError(f"v1048 bundled avatar repair missing: {token}")
if "<string>1048</string>" not in (bundle / "Info.plist").read_text(encoding="utf-8"):
    raise RuntimeError("PhoneWeb.bundle Info.plist is not v1048")

project_text = (STAGING / "PhoneCompanionTest.xcodeproj/project.pbxproj").read_text(encoding="utf-8")
if project_text.count("CURRENT_PROJECT_VERSION = 166;") != 12 or project_text.count("MARKETING_VERSION = 1.0.166;") != 12:
    raise RuntimeError("private iOS version is not consistently 1.0.166 (166)")
webview_text = (STAGING / "PhoneCompanionTest/LocalPhoneWebView.swift").read_text(encoding="utf-8")
if "__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.166 (166)'" not in webview_text:
    raise RuntimeError("private build marker is not 1.0.166 (166)")
if "contractVersion = 25" not in (STAGING / "PhoneCompanionTest/PhoneNativeBridge.swift").read_text(encoding="utf-8"):
    raise RuntimeError("native bridge contract is not 25")
if list(STAGING.rglob("*.zip")) or list(STAGING.rglob("__pycache__")) or list(STAGING.rglob("*.pyc")):
    raise RuntimeError("nested package or Python cache found")

file_count = sum(1 for path in STAGING.rglob("*") if path.is_file())
with ZipFile(ZIP_PATH, "w", ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(STAGING.rglob("*")):
        if path.is_file():
            archive.write(path, Path(PACKAGE_NAME) / path.relative_to(STAGING))
shutil.rmtree(STAGING)
if list(DELIVERY.glob("*.zip")) != [ZIP_PATH]:
    raise RuntimeError("delivery-v1048 must contain exactly one ZIP")
print(f"ZIP={ZIP_PATH}")
print(f"FILES={file_count}")
print(f"SHA256={sha256(ZIP_PATH.read_bytes()).hexdigest()}")
