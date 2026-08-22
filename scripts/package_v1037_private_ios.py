from hashlib import sha256
from pathlib import Path
import shutil
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native" / "private-small-phone" / "XcodeProject"
DELIVERY = ROOT / "delivery-v1037"
PACKAGE_NAME = "SmallPhone_v1037_WeChatMeFriends_iOS157"
STAGING = DELIVERY / PACKAGE_NAME
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
INSTALL_GUIDE = "第一百五十七次安装_v1037_微信个人页与好友交互完善_请先读.md"


def should_skip(relative: Path) -> bool:
    if any(part in {".git", ".codex_tmp", "__pycache__", "preview", "review-v1037"} for part in relative.parts):
        return True
    if relative.suffix.lower() in {".pyc", ".zip"}:
        return True
    if len(relative.parts) == 1 and "安装" in relative.name and relative.name != INSTALL_GUIDE:
        return True
    return False


if DELIVERY.exists():
    resolved = DELIVERY.resolve()
    if resolved.parent != ROOT.resolve() or resolved.name != "delivery-v1037":
        raise RuntimeError(f"unsafe delivery path: {resolved}")
    shutil.rmtree(resolved)

required = [
    SOURCE / "PhoneCompanionTest.xcodeproj" / "project.pbxproj",
    SOURCE / "PhoneCompanionTest" / "PhoneWeb.bundle" / "index.html",
    SOURCE / "PhoneCompanionTest" / "PhoneWeb.bundle" / "app.js",
    SOURCE / "PhoneCompanionTest" / "PhoneWeb.bundle" / "delivery.js",
    SOURCE / "PhoneCompanionTest" / "PhoneWeb.bundle" / "wechat-me.js",
    SOURCE / "PhoneCompanionTest" / "PhoneWeb.bundle" / "wechat-me.css",
    SOURCE / "PhoneCompanionTest" / "PhoneWeb.bundle" / "vendor" / "qr" / "qrcode.js",
    SOURCE / "PhoneCompanionTest" / "PhoneWeb.bundle" / "vendor" / "qr" / "jsQR.js",
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
expected_guides = sorted(["请在Mac编译前先读.md", INSTALL_GUIDE])
if root_guides != expected_guides:
    raise RuntimeError(f"unexpected package guides: {root_guides}")
if len(list(STAGING.rglob("PhoneWeb.bundle/index.html"))) != 1:
    raise RuntimeError("package must contain exactly one PhoneWeb.bundle/index.html")
app_files = list(STAGING.rglob("PhoneWeb.bundle/app.js"))
if len(app_files) != 1:
    raise RuntimeError("package must contain exactly one PhoneWeb.bundle/app.js")
app_text = app_files[0].read_text(encoding="utf-8")
if "APP_VER='v1037 · 微信个人页与好友交互完善版';" not in app_text:
    raise RuntimeError("bundled web version is not v1037")
for marker in ["wxQuickMenuHTML", "wxNearbyRefresh", "chat-glass-mood", "renderWxSettings"]:
    sources = app_text + (STAGING / "PhoneCompanionTest" / "PhoneWeb.bundle" / "wechat-me.js").read_text(encoding="utf-8")
    if marker not in sources:
        raise RuntimeError(f"bundled WeChat feature is missing: {marker}")
if "<textarea id=\"off_in\"" not in app_text or "offInputMount" in app_text:
    raise RuntimeError("bundled common-life native textarea repair is missing")
delivery_text = (STAGING / "PhoneCompanionTest" / "PhoneWeb.bundle" / "delivery.js").read_text(encoding="utf-8")
for marker in ["type:'deliveryorder'", "deliveryRealChatCardHTML", "支付宝官方付款二维码"]:
    if marker not in delivery_text:
        raise RuntimeError(f"bundled real delivery order card is missing: {marker}")
project_text = (STAGING / "PhoneCompanionTest.xcodeproj" / "project.pbxproj").read_text(encoding="utf-8")
if project_text.count("CURRENT_PROJECT_VERSION = 157;") != 12:
    raise RuntimeError("private iOS build number is not consistently 157")
if project_text.count("MARKETING_VERSION = 1.0.157;") != 12:
    raise RuntimeError("private iOS marketing version is not consistently 1.0.157")
if list(STAGING.rglob("*.zip")):
    raise RuntimeError("nested ZIP found in package")
if list(STAGING.rglob("__pycache__")) or list(STAGING.rglob("*.pyc")):
    raise RuntimeError("temporary Python cache found in package")

file_count = sum(1 for path in STAGING.rglob("*") if path.is_file())
with ZipFile(ZIP_PATH, "w", ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(STAGING.rglob("*")):
        if path.is_file():
            archive.write(path, Path(PACKAGE_NAME) / path.relative_to(STAGING))

shutil.rmtree(STAGING)
zip_files = list(DELIVERY.glob("*.zip"))
if zip_files != [ZIP_PATH]:
    raise RuntimeError(f"delivery directory must contain one ZIP: {zip_files}")

digest = sha256(ZIP_PATH.read_bytes()).hexdigest()
print(f"ZIP={ZIP_PATH}")
print(f"FILES={file_count}")
print(f"SHA256={digest}")
