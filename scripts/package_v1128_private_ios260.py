from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native/private-small-phone/XcodeProject"
BUNDLE_SOURCE = SOURCE / "PhoneCompanionTest/PhoneWeb.bundle"
INSTALL_GUIDE = SOURCE / "第二百六十次安装_v1128_备份与线下回复失败依据修复_请先读.md"
DELIVERY = ROOT.parent / "delivery-v1128-private260-backup-offline-reply-final"
PACKAGE_NAME = "SmallPhone_v1128_PrivateBackupOfflineReply_iOS260_MacReady"
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
USER_ZIP = ROOT.parent / "小手机_v1128_私人版_iOS260_备份分块_线下回复失败依据_安装包.zip"
EXPECTED_BUNDLE_FILES = 146


def run_git(*args: str) -> bytes:
    return subprocess.run(
        ["git", *args], cwd=ROOT, check=True, capture_output=True
    ).stdout


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
    output = run_git("ls-files", "-z", "--", base.relative_to(ROOT).as_posix())
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


def require_tokens(label: str, text: str, tokens: list[str]) -> None:
    for token in tokens:
        if token not in text:
            raise RuntimeError(f"{label} marker missing: {token}")


if run_git("status", "--porcelain=v1").strip():
    raise RuntimeError("private iOS260 package requires a clean source commit")

branch = run_git("symbolic-ref", "--short", "HEAD").decode().strip()
if branch != "codex/v1128-private260-package":
    raise RuntimeError(f"unexpected packaging branch: {branch}")
head = run_git("rev-parse", "HEAD").decode("ascii").strip()
origin_main = run_git("rev-parse", "origin/main").decode("ascii").strip()
merge_base = run_git("merge-base", "HEAD", "origin/main").decode("ascii").strip()
if merge_base != origin_main:
    raise RuntimeError("private packaging commit is not based on current origin/main")

tracked_bundle = tracked_files_under(BUNDLE_SOURCE)
actual_bundle = file_map(BUNDLE_SOURCE)
if set(tracked_bundle) != set(actual_bundle):
    raise RuntimeError(
        "private PhoneWeb.bundle has missing or untracked files: "
        f"tracked={len(tracked_bundle)} actual={len(actual_bundle)}"
    )
if len(actual_bundle) != EXPECTED_BUNDLE_FILES:
    raise RuntimeError(
        f"expected {EXPECTED_BUNDLE_FILES} private bundle files, found {len(actual_bundle)}"
    )

source_files = tracked_files_under(SOURCE)
for required in [
    SOURCE / "PhoneCompanionTest.xcodeproj/project.pbxproj",
    SOURCE / "PhoneCompanionTest/LocalPhoneWebView.swift",
    SOURCE / "PhoneCompanionTest/PhoneCompanionTestApp.swift",
    SOURCE / "PhoneCompanionTest/PhoneNativeBridge.swift",
    SOURCE / "PhoneCompanionTest/SmallPhonePrivateRootView.swift",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/index.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/app.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/private-runtime-diagnostics.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/repair.html",
    SOURCE / "请在Mac编译前先读.md",
    INSTALL_GUIDE,
]:
    if not required.is_file():
        raise RuntimeError(f"missing required package file: {required}")

guide_relative = INSTALL_GUIDE.relative_to(SOURCE).as_posix()
if not run_git("ls-files", "--error-unmatch", INSTALL_GUIDE.relative_to(ROOT).as_posix()):
    raise RuntimeError("iOS260 install guide is not tracked")
source_files[guide_relative] = INSTALL_GUIDE

if DELIVERY.exists() and any(DELIVERY.iterdir()):
    raise RuntimeError(f"refusing to overwrite non-empty delivery: {DELIVERY}")
DELIVERY.mkdir(exist_ok=True)

with tempfile.TemporaryDirectory(prefix="smallphone-v1128-ios260-", dir=ROOT) as temp:
    staging = Path(temp) / PACKAGE_NAME
    staging.mkdir(parents=True)
    for relative, source in sorted(source_files.items()):
        destination = staging / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    (staging / "SOURCE_COMMIT.txt").write_text(
        f"branch={branch}\n"
        f"commit={head}\n"
        f"origin_main={origin_main}\n"
        "worktree=clean\n"
        "web=v1128\n"
        "ios=1.0.260 (260)\n"
        "bridge=25\n"
        "diagnostics=backup-chunking+offline-failure-evidence-v2\n",
        encoding="utf-8",
        newline="\n",
    )

    bundle = staging / "PhoneCompanionTest/PhoneWeb.bundle"
    if file_map(bundle) != actual_bundle:
        raise RuntimeError("staged private PhoneWeb.bundle differs from committed source")

    index_bytes = (bundle / "index.html").read_bytes()
    alias_bytes = (bundle / "小手机.html").read_bytes()
    if index_bytes != alias_bytes:
        raise RuntimeError("private index.html and 小手机.html are not identical")
    shell = index_bytes.decode("utf-8")
    require_tokens("private shell", shell, [
        "window.__NORTH_SHELL_BUILD__='1128'",
        "app.js?v=1128&r=v1128-backup-offline-failure-evidence-1",
        "private-runtime-diagnostics.js?v=260",
    ])
    if "1127" in shell or "private-runtime-diagnostics.js?v=259" in shell:
        raise RuntimeError("private shell still contains the superseded identity")

    repair = (bundle / "repair.html").read_text(encoding="utf-8")
    require_tokens("private repair", repair, ["index.html?repair=1&v=1128"])
    for destructive in ["localStorage.clear", "localStorage.removeItem", "indexedDB.deleteDatabase"]:
        if destructive in repair:
            raise RuntimeError(f"private repair page is destructive: {destructive}")

    app = (bundle / "app.js").read_text(encoding="utf-8")
    require_tokens("private app", app, [
        "APP_VER='v1128 · 备份与线下回复修复版';",
        "async function privatePhoneAccountBackupUpload(",
        "privatePhoneAccountCall('account.backup.begin'",
        "privatePhoneAccountCall('account.backup.chunk'",
        "privatePhoneAccountCall('account.backup.commit'",
        "function offlineReplyTransportRetryable(",
        "async function offlineReplyChatRequest(",
        "routeIndex=roleChatRouteIndex(c)",
        "kind:'request-failure'",
        "上一轮回复失败依据",
        "立即备份本机",
        "roleInterceptDiagnosticTurnFailure",
    ])
    public_app = (ROOT / "app.js").read_text(encoding="utf-8")
    require_tokens("public v1128 app", public_app, [
        "APP_VER='v1128 · 备份与线下回复修复版';",
        "async function privatePhoneAccountBackupUpload(",
        "async function offlineReplyChatRequest(",
        "roleInterceptDiagnosticTurnFailure",
    ])

    project = (staging / "PhoneCompanionTest.xcodeproj/project.pbxproj").read_text(encoding="utf-8")
    if project.count("CURRENT_PROJECT_VERSION = 260;") != 12:
        raise RuntimeError("private build 260 is not set on all configurations")
    if project.count("MARKETING_VERSION = 1.0.260;") != 12:
        raise RuntimeError("private version 1.0.260 is not set on all configurations")
    if "CURRENT_PROJECT_VERSION = 259;" in project or "MARKETING_VERSION = 1.0.259;" in project:
        raise RuntimeError("private project still contains iOS259 identity")

    bridge = (staging / "PhoneCompanionTest/PhoneNativeBridge.swift").read_text(encoding="utf-8")
    require_tokens("native bridge", bridge, [
        "contractVersion = 25",
        'private static let build = "1.0.260 (260)"',
        '"account.backup.begin", "account.backup.chunk"',
        '"account.backup.commit", "account.backup.cancel"',
        'case "account.backup.upload", "account.backup.commit":',
        "preparePrivateBackupUpload(",
        "timeoutInterval: 120",
    ])

    webview = (staging / "PhoneCompanionTest/LocalPhoneWebView.swift").read_text(encoding="utf-8")
    require_tokens("private WebView", webview, [
        "smallPhone.webContentTerminationTimes.v5.build260",
        "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.260 (260)'",
        "action === 'account.backup.commit' ? 150000 : 60000",
        "native.webcontent.reloadSucceeded",
        "automaticWebContentRecoveryToken == recoveryToken",
    ])

    overlay = (bundle / "private-runtime-diagnostics.js").read_text(encoding="utf-8")
    require_tokens("private performance protection", overlay, [
        "258-post-render-protection-v1",
        "composition.ab.auto",
        "render-raf1-slow",
        "render-raf2-slow",
    ])

    main_guide = (staging / "请在Mac编译前先读.md").read_text(encoding="utf-8")
    require_tokens("Mac guide", main_guide, [
        "私人完整页面 v1128；私人 iOS 1.0.260 (260)",
        "App 内显示 `1.0.260 (260)`",
    ])
    install_guide = (staging / INSTALL_GUIDE.name).read_text(encoding="utf-8")
    require_tokens("iOS260 guide", install_guide, [
        "v1128／iOS 1.0.260",
        "立即备份本机",
        "上一轮回复失败依据",
        "不要先删除手机上的小手机 App",
        "Mac 编译、签名、覆盖安装和真实 iPhone 验收仍待完成",
    ])

    root_files = sorted(path.name for path in staging.iterdir() if path.is_file())
    expected_root_files = sorted(["SOURCE_COMMIT.txt", "请在Mac编译前先读.md", INSTALL_GUIDE.name])
    if root_files != expected_root_files:
        raise RuntimeError(f"unexpected package root files: {root_files}")

    forbidden = (
        list(staging.rglob("*.zip"))
        + list(staging.rglob("*.pyc"))
        + list(staging.rglob("__pycache__"))
        + list(staging.rglob("xcuserdata"))
        + list(staging.rglob(".DS_Store"))
    )
    if forbidden:
        raise RuntimeError(f"package contains cache, nested ZIP or Xcode user state: {forbidden}")

    staged = file_map(staging)
    expected_package_files = len(source_files) + 1
    if len(staged) != expected_package_files:
        raise RuntimeError(
            f"expected {expected_package_files} package files, found {len(staged)}"
        )

    temporary_zip = Path(temp) / f"{PACKAGE_NAME}.zip"
    with ZipFile(temporary_zip, "w", ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(staging.rglob("*")):
            if path.is_file():
                archive.write(path, Path(PACKAGE_NAME) / path.relative_to(staging))

    with ZipFile(temporary_zip) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("ZIP integrity test failed")
        names = archive.namelist()
        if len(names) != len(staged) or len(names) != len(set(names)):
            raise RuntimeError("ZIP has missing or duplicate entries")
        prefix = f"{PACKAGE_NAME}/"
        for relative, expected in staged.items():
            name = prefix + relative
            if name not in names or archive.read(name) != expected:
                raise RuntimeError(f"ZIP changed or omitted private file: {relative}")
    temporary_zip.replace(ZIP_PATH)

if list(DELIVERY.iterdir()) != [ZIP_PATH]:
    raise RuntimeError("delivery directory must contain exactly one ZIP")

digest = sha256(ZIP_PATH.read_bytes()).hexdigest().upper()
if USER_ZIP.exists() and sha256(USER_ZIP.read_bytes()).hexdigest().upper() != digest:
    raise RuntimeError(f"refusing to overwrite different user package: {USER_ZIP}")
shutil.copy2(ZIP_PATH, USER_ZIP)
if sha256(USER_ZIP.read_bytes()).hexdigest().upper() != digest:
    raise RuntimeError("user-facing ZIP copy hash mismatch")

print(f"SOURCE_COMMIT={head}")
print(f"ORIGIN_MAIN={origin_main}")
print(f"ZIP={ZIP_PATH}")
print(f"USER_ZIP={USER_ZIP}")
print(f"FILES={len(staged)}")
print(f"BUNDLE_FILES={len(actual_bundle)}")
print(f"SIZE={ZIP_PATH.stat().st_size}")
print(f"SHA256={digest}")
print("MAC_COMPILE_VERIFIED=NO")
print("REAL_IPHONE_VERIFIED=NO")
