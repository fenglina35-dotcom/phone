from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native/private-small-phone/XcodeProject"
BUNDLE_SOURCE = SOURCE / "PhoneCompanionTest/PhoneWeb.bundle"
DELIVERY = ROOT / "delivery-v1122-private247-runtime-diagnostics"
PACKAGE_NAME = "SmallPhone_v1122_PrivateRuntimeDiagnostics_iOS247_MacReady"
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
INSTALL_GUIDE = "第二百四十七次安装_v1122_私人App卡顿诊断候选包_请先读.md"
EXPECTED_BUNDLE_FILES = 146
EXPECTED_PACKAGE_FILES = 184


GUIDE_TEXT = """# 第二百四十七次安装：v1122 / 私人 iOS 1.0.247（247）

## 本包边界

- 本包只包含私人 iOS App 工程与其完整本地资源，没有修改或重新生成公开网页。
- 私人完整页面继续使用 v1122，原生桥协议继续为 25。
- 新增仅供私人 App 使用的 `private-runtime-diagnostics.js`，记录有界的耗时、温度状态与 WebContent 终止信息；不记录聊天正文、图片、密钥或网址。
- 为隔离间歇性卡顿来源，自动全量云备份暂时停用；手动备份、恢复及原有本机数据仍保留。
- `repair.html` 继续随包提供，只处理页面脚本缓存，不清除聊天、角色、图片、密钥、localStorage 或 IndexedDB 存档。

## 版本

- 私人完整页面：v1122
- iOS App：1.0.247（build 247）
- 原生桥协议：25

## 在 Mac 上安装

1. 把本 ZIP 解压到全新文件夹，不要覆盖以前解压的工程。
2. 打开 `PhoneCompanionTest.xcodeproj`。
3. 为主 App 和全部扩展选择同一个开发者团队并完成签名。
4. 选择真实 iPhone 编译安装。需要保留现有数据时请直接覆盖安装，不要先删除旧 App。

## 真机检查

1. 确认设置里显示私人安装包 1.0.247（247），主屏图片、图标、照片墙和微信图片正常。
2. 连续打开微信、共同生活、设置等页面，确认点击、回复、后台消息、伴生数据、通话及远控功能没有回退。
3. 保持前台至少 10 分钟并多次切换前后台，观察卡顿、白屏跳转、延迟和升温。
4. 若问题复现，在“设置 → 授权与数据 → 私人 App 性能保护”里复制卡顿诊断记录。

## 验证边界

本 ZIP 只代表 Windows 侧源码、版本、清单与压缩完整性核对完成。尚未在 Mac 编译、签名，也尚未通过真实 iPhone 验证；不得把 MacReady 写成 Mac 编译或真机修复成功。
"""


def run_git(*args: str) -> bytes:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return result.stdout


def allowed(path: Path, relative: Path) -> bool:
    if relative.suffix.lower() in {".zip", ".pyc"}:
        return False
    if any(
        part in {".git", ".codex_tmp", "__pycache__", "xcuserdata"}
        for part in relative.parts
    ):
        return False
    if relative.name == ".DS_Store":
        return False
    if len(relative.parts) == 1 and "安装" in relative.name:
        return False
    return path.is_file()


def tracked_files_under(base: Path) -> dict[str, Path]:
    selected: dict[str, Path] = {}
    output = run_git(
        "ls-files",
        "-z",
        "--",
        base.relative_to(ROOT).as_posix(),
    )
    for raw in output.split(b"\0"):
        if not raw:
            continue
        path = ROOT / raw.decode("utf-8")
        relative = path.relative_to(base)
        if allowed(path, relative):
            selected[relative.as_posix()] = path
    return selected


def file_map(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }


tracked_dirty = run_git("status", "--porcelain=v1", "--untracked-files=no")
if tracked_dirty.strip():
    raise RuntimeError(
        "tracked working tree is dirty; commit the private iOS 247 release first"
    )

tracked_bundle = tracked_files_under(BUNDLE_SOURCE)
actual_bundle = file_map(BUNDLE_SOURCE)
untracked_bundle = sorted(set(actual_bundle) - set(tracked_bundle))
missing_bundle = sorted(set(tracked_bundle) - set(actual_bundle))
if untracked_bundle or missing_bundle:
    raise RuntimeError(
        "PhoneWeb.bundle must contain only tracked files: "
        f"untracked={untracked_bundle}, missing={missing_bundle}"
    )
if len(actual_bundle) != EXPECTED_BUNDLE_FILES:
    raise RuntimeError(
        f"expected {EXPECTED_BUNDLE_FILES} private bundle files, "
        f"found {len(actual_bundle)}"
    )

source_files = tracked_files_under(SOURCE)

required = [
    SOURCE / "PhoneCompanionTest.xcodeproj/project.pbxproj",
    SOURCE / "PhoneCompanionTest/LocalPhoneWebView.swift",
    SOURCE / "PhoneCompanionTest/PhoneNativeBridge.swift",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/index.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/repair.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/private-runtime-diagnostics.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/app.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/ai-account.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/delivery.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/pet-game.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/glass-theme.css",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/wechat-me.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/wechat-me.css",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/vendor/qr/jsQR.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/vendor/qr/qrcode.js",
    SOURCE / "请在Mac编译前先读.md",
]
for path in required:
    if not path.is_file():
        raise RuntimeError(f"missing required package file: {path}")
    relative = path.relative_to(SOURCE).as_posix()
    if relative not in source_files:
        raise RuntimeError(f"required package file is not tracked: {relative}")

if DELIVERY.exists():
    existing = list(DELIVERY.iterdir())
    if existing:
        raise RuntimeError(
            f"delivery already contains files; refusing to overwrite: {existing}"
        )
else:
    DELIVERY.mkdir()

with tempfile.TemporaryDirectory(
    prefix="smallphone-v1122-ios247-",
    dir=ROOT,
) as temp:
    staging = Path(temp) / PACKAGE_NAME
    staging.mkdir(parents=True)
    for relative, source in sorted(source_files.items()):
        destination = staging / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    (staging / INSTALL_GUIDE).write_text(
        GUIDE_TEXT,
        encoding="utf-8",
        newline="\n",
    )

    root_guides = sorted(path.name for path in staging.glob("*.md"))
    expected_guides = sorted(["请在Mac编译前先读.md", INSTALL_GUIDE])
    if root_guides != expected_guides:
        raise RuntimeError(f"unexpected package guides: {root_guides}")
    project_guide = (staging / "请在Mac编译前先读.md").read_text(
        encoding="utf-8"
    )
    if "当前候选交付：私人完整页面 v1122；私人 iOS 1.0.247 (247)" not in project_guide:
        raise RuntimeError("private Mac guide still advertises an older candidate")

    bundle = staging / "PhoneCompanionTest/PhoneWeb.bundle"
    source_bundle_files = file_map(BUNDLE_SOURCE)
    staged_bundle_files = file_map(bundle)
    if source_bundle_files != staged_bundle_files:
        missing = sorted(set(source_bundle_files) - set(staged_bundle_files))
        extra = sorted(set(staged_bundle_files) - set(source_bundle_files))
        changed = sorted(
            key
            for key in set(source_bundle_files) & set(staged_bundle_files)
            if source_bundle_files[key] != staged_bundle_files[key]
        )
        raise RuntimeError(
            "PhoneWeb.bundle mismatch: "
            f"missing={missing}, extra={extra}, changed={changed}"
        )

    index_bytes = (bundle / "index.html").read_bytes()
    alias_bytes = (bundle / "小手机.html").read_bytes()
    if index_bytes != alias_bytes:
        raise RuntimeError("private HTML entry files are not byte-identical")
    shell_text = index_bytes.decode("utf-8")
    if "window.__NORTH_SHELL_BUILD__='1122'" not in shell_text:
        raise RuntimeError("private shell is not v1122")
    diagnostic_reference = (
        '<script src="private-runtime-diagnostics.js?v=247" '
        'onerror="__northBootFail('
    )
    if diagnostic_reference not in shell_text:
        raise RuntimeError("private HTML does not load the iOS 247 diagnostics")

    repair_text = (bundle / "repair.html").read_text(encoding="utf-8")
    if "index.html?repair=1&v=1122" not in repair_text:
        raise RuntimeError("private repair page does not return to v1122")
    for destructive in [
        "localStorage.clear",
        "localStorage.removeItem",
        "indexedDB.deleteDatabase",
    ]:
        if destructive in repair_text:
            raise RuntimeError(
                "private repair page contains destructive storage action: "
                f"{destructive}"
            )

    diagnostics_text = (
        bundle / "private-runtime-diagnostics.js"
    ).read_text(encoding="utf-8")
    diagnostics_tokens = [
        "247-auto-backup-diagnostics-v1",
        "window.__SMALL_PHONE_DISABLE_AUTO_FULL_BACKUP__=true",
        "window.privatePhoneDiagnosticsOpen",
        "diagnostics.read",
        "diagnostics.clear",
    ]
    for token in diagnostics_tokens:
        if token not in diagnostics_text:
            raise RuntimeError(f"private diagnostics token missing: {token}")

    app_text = (bundle / "app.js").read_text(encoding="utf-8")
    protected_tokens = [
        "APP_VER='v1122 · 主屏唱片与网页云备份稳定版';",
        "if(window.__NORTH_SHELL_BUILD__!=='1122')",
        "const PRIVATE_IMAGE_CACHE_CHAR_LIMIT=48*1024*1024",
        "appIcons:me.appIcons",
        "contacts:(S.contacts||[]).map",
        "groups:(S.groups||[]).map",
        "function roleServerPushPull",
        "async function companionPollSnapshot",
        "async function remoteControlRoleReaction",
        "async function cohabPhoneDeliverFact",
        "function aiCoreUrl",
    ]
    for token in protected_tokens:
        if token not in app_text:
            raise RuntimeError(f"protected private route missing: {token}")

    info_text = (bundle / "Info.plist").read_text(encoding="utf-8")
    if "<string>1122</string>" not in info_text:
        raise RuntimeError("private PhoneWeb bundle metadata is not v1122")

    project_text = (
        staging / "PhoneCompanionTest.xcodeproj/project.pbxproj"
    ).read_text(encoding="utf-8")
    if project_text.count("CURRENT_PROJECT_VERSION = 247;") != 12:
        raise RuntimeError("private build number is not consistently 247")
    if project_text.count("MARKETING_VERSION = 1.0.247;") != 12:
        raise RuntimeError("private marketing version is not consistently 1.0.247")
    if "CURRENT_PROJECT_VERSION = 246;" in project_text:
        raise RuntimeError("private project still contains build 246")

    webview_text = (
        staging / "PhoneCompanionTest/LocalPhoneWebView.swift"
    ).read_text(encoding="utf-8")
    native_tokens = [
        "__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.247 (247)'",
        "smallPhone.webContentTerminationTimes.v4.build247",
        "window.__SMALL_PHONE_DISABLE_AUTO_FULL_BACKUP__ = true",
        "SmallPhoneDiagnosticsStore.append(",
        "deadline: .now() + 10,",
        "deadline: .now() + 90,",
    ]
    for token in native_tokens:
        if token not in webview_text:
            raise RuntimeError(f"private native runtime token missing: {token}")

    bridge_text = (
        staging / "PhoneCompanionTest/PhoneNativeBridge.swift"
    ).read_text(encoding="utf-8")
    bridge_tokens = [
        "contractVersion = 25",
        'action == "diagnostics.append"',
        'case "diagnostics.read"',
        'case "diagnostics.clear"',
        "maximumBytes = 256 * 1_024",
    ]
    for token in bridge_tokens:
        if token not in bridge_text:
            raise RuntimeError(f"private native bridge token missing: {token}")

    forbidden = (
        list(staging.rglob("*.zip"))
        + list(staging.rglob("__pycache__"))
        + list(staging.rglob("*.pyc"))
        + list(staging.rglob("xcuserdata"))
        + list(staging.rglob(".DS_Store"))
    )
    if forbidden:
        raise RuntimeError(
            f"nested package, cache, or user Xcode state found: {forbidden}"
        )

    staged_files = file_map(staging)
    file_count = len(staged_files)
    if file_count != EXPECTED_PACKAGE_FILES:
        raise RuntimeError(
            f"expected {EXPECTED_PACKAGE_FILES} package files, found {file_count}"
        )

    temporary_zip = Path(temp) / f"{PACKAGE_NAME}.zip"
    with ZipFile(temporary_zip, "w", ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(staging.rglob("*")):
            if path.is_file():
                archive.write(
                    path,
                    Path(PACKAGE_NAME) / path.relative_to(staging),
                )

    with ZipFile(temporary_zip) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP integrity test failed")
        names = archive.namelist()
        if len(names) != file_count or len(names) != len(set(names)):
            raise RuntimeError("ZIP file count or duplicate-name check failed")
        prefix = f"{PACKAGE_NAME}/"
        for relative, expected in staged_files.items():
            name = prefix + relative
            if name not in names:
                raise RuntimeError(f"ZIP omitted file: {relative}")
            if archive.read(name) != expected:
                raise RuntimeError(f"ZIP changed file: {relative}")
    temporary_zip.replace(ZIP_PATH)

if list(DELIVERY.iterdir()) != [ZIP_PATH]:
    raise RuntimeError("delivery directory must contain exactly one ZIP")

print(f"ZIP={ZIP_PATH}")
print(f"FILES={file_count}")
print(f"BUNDLE_FILES={len(source_bundle_files)}")
print(f"SIZE={ZIP_PATH.stat().st_size}")
print(f"SHA256={sha256(ZIP_PATH.read_bytes()).hexdigest().upper()}")
print("MAC_COMPILE_VERIFIED=NO")
print("REAL_IPHONE_VERIFIED=NO")
