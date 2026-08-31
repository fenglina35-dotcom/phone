from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native/private-small-phone/XcodeProject"
BUNDLE_SOURCE = SOURCE / "PhoneCompanionTest/PhoneWeb.bundle"
DELIVERY = ROOT / "delivery-v1124-private245-full-final"
PACKAGE_NAME = "SmallPhone_v1124_PrivateTimerCircuitBreaker_iOS245_Full_MacReady"
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
INSTALL_GUIDE = "第二百四十五次安装_v1124_私人App定时器熔断_请先读.md"


GUIDE_TEXT = """# 第二百四十五次安装：v1124 私人 App 定时器熔断版

## 这次只改了什么

- 只改私人 iOS App 壳层，没有修改网页版正式源码。
- 私人 App 在启动安静期、后台或检测到主线程卡顿时，会暂停非关键的生活维护定时器。
- 后台角色消息、伴生数据轮询、通话、闹钟、用户点击、图片读取和远控链路不在暂停名单中。
- 原生 WebContent 异常恢复次数跨界面重建保留，避免白屏时反复无限刷新并继续发热。
- 图片缓存仍是 48MB，头像、图标、联系人、群聊和主屏图片仍属于启动保护清单，没有采用会让图片消失的 16MB/三张图方案。

## 版本

- 私人安装包：v1124
- iOS App：1.0.245（build 245）
- 内嵌网页核心：v1122（故意保持；本次禁止改网页版业务代码）
- 原生桥协议：25

## 在 Mac 上安装

1. 把本 ZIP 解压到一个全新文件夹，不要覆盖旧的解压目录。
2. 打开 `PhoneCompanionTest.xcodeproj`。
3. 为主 App 和所有扩展选择同一个开发者团队并完成签名。
4. 选择真实 iPhone 编译安装。若要保留手机里的现有数据，请直接覆盖安装，不要先删除旧 App。

## 真机先检查

1. 打开后确认主屏头像、所有 App 图标、照片墙和微信图片都能显示。
2. 连续打开微信、共同生活、设置等页面，确认点击正常。
3. 验证普通微信回复、后台主动消息入聊、伴生数据、通话和远控字幕。
4. 保持 App 前台 10 分钟，再切后台/前台数次，观察是否白屏循环、明显延迟或快速升温。
5. 若再次发生，请保留准确发生时间和同一次 Instruments 记录；不要清除 App 数据。

## 验证边界

Windows 自动测试和压缩包完整性已检查；本包尚未在 Mac 编译，也尚未替用户完成真实 iPhone 验证。真机结果以安装后的实际表现为准。
"""


def allowed(path: Path, relative: Path) -> bool:
    if relative.suffix.lower() in {".zip", ".pyc"}:
        return False
    if any(part in {".git", ".codex_tmp", "__pycache__", "xcuserdata"} for part in relative.parts):
        return False
    if relative.name == ".DS_Store":
        return False
    if len(relative.parts) == 1 and "安装" in relative.name:
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

    # PhoneWeb.bundle is ignored by Git but is the App's complete offline UI.
    # Always enumerate it directly so a release cannot silently omit assets.
    for path in BUNDLE_SOURCE.rglob("*"):
        relative = path.relative_to(SOURCE)
        if allowed(path, relative):
            selected[relative.as_posix()] = path

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
    if existing:
        raise RuntimeError(f"delivery already contains files; refusing to overwrite: {existing}")
else:
    DELIVERY.mkdir()

required = [
    SOURCE / "PhoneCompanionTest.xcodeproj/project.pbxproj",
    SOURCE / "PhoneCompanionTest/LocalPhoneWebView.swift",
    SOURCE / "PhoneCompanionTest/PhoneNativeBridge.swift",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/index.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
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

with tempfile.TemporaryDirectory(prefix="smallphone-v1124-ios245-", dir=ROOT) as temp:
    staging = Path(temp) / PACKAGE_NAME
    staging.mkdir(parents=True)
    for source, relative in source_files():
        destination = staging / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    (staging / INSTALL_GUIDE).write_text(GUIDE_TEXT, encoding="utf-8", newline="\n")

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
        changed = sorted(
            key
            for key in set(source_bundle_files) & set(staged_bundle_files)
            if source_bundle_files[key] != staged_bundle_files[key]
        )
        raise RuntimeError(
            f"PhoneWeb.bundle mismatch: missing={missing}, extra={extra}, changed={changed}"
        )

    index_bytes = (bundle / "index.html").read_bytes()
    if index_bytes != (bundle / "小手机.html").read_bytes():
        raise RuntimeError("private HTML entry files are not byte-identical")
    shell_text = index_bytes.decode("utf-8")
    if "window.__NORTH_SHELL_BUILD__='1124'" not in shell_text:
        raise RuntimeError("private shell is not v1124")

    app_text = (bundle / "app.js").read_text(encoding="utf-8")
    protected_tokens = [
        "APP_VER='v1122 · 主屏唱片与网页云备份稳定版';",
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

    project_text = (staging / "PhoneCompanionTest.xcodeproj/project.pbxproj").read_text(encoding="utf-8")
    if project_text.count("CURRENT_PROJECT_VERSION = 245;") != 12:
        raise RuntimeError("private build number is not consistently 245")
    if project_text.count("MARKETING_VERSION = 1.0.245;") != 12:
        raise RuntimeError("private marketing version is not consistently 1.0.245")

    webview_text = (staging / "PhoneCompanionTest/LocalPhoneWebView.swift").read_text(encoding="utf-8")
    native_tokens = [
        "__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.245 (245)'",
        "smallPhone.webContentTerminationTimes.v3",
        "const optionalMaintenance = new Set([",
        "const privateMaintenancePaused = () => {",
        "const guardedMaintenanceCallback = callback => function(...args)",
        "deadline: .now() + 10,",
        "deadline: .now() + 90,",
    ]
    for token in native_tokens:
        if token not in webview_text:
            raise RuntimeError(f"private native circuit breaker missing: {token}")

    bridge_text = (staging / "PhoneCompanionTest/PhoneNativeBridge.swift").read_text(encoding="utf-8")
    if "contractVersion = 25" not in bridge_text:
        raise RuntimeError("native bridge contract is not 25")

    forbidden = (
        list(staging.rglob("*.zip"))
        + list(staging.rglob("__pycache__"))
        + list(staging.rglob("*.pyc"))
        + list(staging.rglob("xcuserdata"))
    )
    if forbidden:
        raise RuntimeError(f"nested package, cache, or user Xcode state found: {forbidden}")

    staged_files = file_map(staging)
    file_count = len(staged_files)
    temporary_zip = Path(temp) / f"{PACKAGE_NAME}.zip"
    with ZipFile(temporary_zip, "w", ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(staging.rglob("*")):
            if path.is_file():
                archive.write(path, Path(PACKAGE_NAME) / path.relative_to(staging))

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
