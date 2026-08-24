from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native/private-small-phone/XcodeProject"
DELIVERY = ROOT / "delivery-v1058-private181-final"
PACKAGE_NAME = "SmallPhone_v1058_CohabStorageTransferOfflineInput_iOS181_MacReady"
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
INSTALL_GUIDE = "第一百八十一次安装_v1058_共同生活存储散热转账回复与约会输入修复_请先读.md"


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
    resolved = DELIVERY.resolve()
    if resolved.parent != ROOT.resolve() or resolved.name != "delivery-v1058-private181-final":
        raise RuntimeError(f"unsafe delivery path: {resolved}")
    existing = list(DELIVERY.iterdir())
    if existing != [ZIP_PATH]:
        raise RuntimeError(f"delivery path contains unexpected files: {existing}")

required = [
    SOURCE / "PhoneCompanionTest.xcodeproj/project.pbxproj",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/index.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/app.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/delivery.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/pet-game.js",
    SOURCE / "请在Mac编译前先读.md",
    SOURCE / INSTALL_GUIDE,
]
for path in required:
    if not path.is_file():
        raise RuntimeError(f"missing required package file: {path}")

with tempfile.TemporaryDirectory(prefix="smallphone-v1058-", dir=ROOT) as temp:
    staging = Path(temp) / PACKAGE_NAME
    staging.mkdir(parents=True)
    for source, relative in source_files():
        destination = staging / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    root_guides = sorted(path.name for path in staging.glob("*.md"))
    if root_guides != sorted(["请在Mac编译前先读.md", INSTALL_GUIDE]):
        raise RuntimeError(f"unexpected package guides: {root_guides}")
    if len(list(staging.rglob("PhoneWeb.bundle/index.html"))) != 1:
        raise RuntimeError("package must contain exactly one PhoneWeb.bundle/index.html")

    bundle = staging / "PhoneCompanionTest/PhoneWeb.bundle"
    app_text = (bundle / "app.js").read_text(encoding="utf-8")
    for token in [
        "APP_VER='v1058 · 共同生活通话、存储散热、转账回复与约会输入修复版';",
        "cohabActionTap", "cohabCallRestricted", "explicitIncomingCallRequest",
        "hydrateVisibleStoredImages", "refreshNativeStorageEstimate",
        "transferCounterpartyReaction", "offInputAutoSize",
        "PRIVATE_MIRROR_MODE='private-primary'", "remoteControlRoleReaction",
    ]:
        if token not in app_text:
            raise RuntimeError(f"v1058 bundled app feature missing: {token}")
    pet_text = (bundle / "pet-game.js").read_text(encoding="utf-8")
    for token in ["_petSceneTapBlockUntil", "blockSceneTap", "petBowl"]:
        if token not in pet_text:
            raise RuntimeError(f"v1058 bundled pet feature missing: {token}")
    for name in ["app.js", "glass-theme.css", "pet-game.js"]:
        root_text = (ROOT / name).read_text(encoding="utf-8").replace("\r\n", "\n")
        bundle_text = (bundle / name).read_text(encoding="utf-8").replace("\r\n", "\n")
        if root_text != bundle_text:
            raise RuntimeError(f"root and private {name} are not content-identical")
    delivery_text = (bundle / "delivery.js").read_text(encoding="utf-8")
    for token in [
        "roleRequestIntent", "roleRequest", "realSearch", "createOrder",
        "requestRoleClarification", "roleTasks", "structuredModelAction",
        "allowNewTask", "roleTurnKey", "chooseOffer", "chooseOptions",
        "麦满分单人餐随心选", "招牌汉堡4件套", "套餐已经包含的商品不得重复",
        "requestRoleUnavailable", "couponLabel",
    ]:
        if token not in delivery_text:
            raise RuntimeError(f"bundled delivery feature missing: {token}")
    if sha256((bundle / "delivery.js").read_bytes()).digest() != sha256((ROOT / "delivery.js").read_bytes()).digest():
        raise RuntimeError("root and private delivery.js are not byte-identical")
    shell_text = (bundle / "index.html").read_text(encoding="utf-8")
    if "window.__NORTH_SHELL_BUILD__='1058'" not in shell_text or "delivery.js?v=1058" not in shell_text:
        raise RuntimeError("private shell is not v1058")
    if "<string>1058</string>" not in (bundle / "Info.plist").read_text(encoding="utf-8"):
        raise RuntimeError("PhoneWeb.bundle Info.plist is not v1058")

    project_text = (staging / "PhoneCompanionTest.xcodeproj/project.pbxproj").read_text(encoding="utf-8")
    if project_text.count("CURRENT_PROJECT_VERSION = 181;") != 12 or project_text.count("MARKETING_VERSION = 1.0.181;") != 12:
        raise RuntimeError("private iOS version is not consistently 1.0.181 (181)")
    webview_text = (staging / "PhoneCompanionTest/LocalPhoneWebView.swift").read_text(encoding="utf-8")
    if "__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.181 (181)'" not in webview_text:
        raise RuntimeError("private build marker is not 1.0.181 (181)")
    if "contractVersion = 25" not in (staging / "PhoneCompanionTest/PhoneNativeBridge.swift").read_text(encoding="utf-8"):
        raise RuntimeError("native bridge contract is not 25")
    if list(staging.rglob("*.zip")) or list(staging.rglob("__pycache__")) or list(staging.rglob("*.pyc")):
        raise RuntimeError("nested package or cache found")

    file_count = sum(1 for path in staging.rglob("*") if path.is_file())
    DELIVERY.mkdir(exist_ok=True)
    with ZipFile(ZIP_PATH, "w", ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(staging.rglob("*")):
            if path.is_file():
                archive.write(path, Path(PACKAGE_NAME) / path.relative_to(staging))

if list(DELIVERY.glob("*.zip")) != [ZIP_PATH] or list(DELIVERY.iterdir()) != [ZIP_PATH]:
    raise RuntimeError("delivery directory must contain exactly one ZIP")

print(f"ZIP={ZIP_PATH}")
print(f"FILES={file_count}")
print(f"SHA256={sha256(ZIP_PATH.read_bytes()).hexdigest()}")
