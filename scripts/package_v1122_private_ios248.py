from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native/private-small-phone/XcodeProject"
BUNDLE_SOURCE = SOURCE / "PhoneCompanionTest/PhoneWeb.bundle"
INSTALL_GUIDE_SOURCE = (
    SOURCE / "第二百四十八次安装_v1122_私人App宿主隔离与存档恢复_请先读.md"
)
DELIVERY = ROOT / "delivery-v1122-private248-host-isolation-recovery"
PACKAGE_NAME = "SmallPhone_v1122_PrivateHostIsolationRecovery_iOS248_MacReady"
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
USER_ZIP = ROOT.parent / "小手机_v1122_私人版_iOS248_宿主隔离与存档恢复.zip"
EXPECTED_BUNDLE_FILES = 146
EXPECTED_PACKAGE_FILES = 185


def run_git(*args: str) -> bytes:
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
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


if run_git("status", "--porcelain=v1", "--untracked-files=no").strip():
    raise RuntimeError("tracked working tree is dirty; commit private iOS 248 first")

branch = run_git("symbolic-ref", "--short", "HEAD").decode("utf-8").strip()
if branch != "main":
    raise RuntimeError(f"expected main branch, found {branch}")
head = run_git("rev-parse", "HEAD").decode("ascii").strip()
if run_git("rev-list", "--left-right", "--count", "HEAD...origin/main").strip() != b"0\t0":
    raise RuntimeError("HEAD and origin/main must match before packaging")

tracked_bundle = tracked_files_under(BUNDLE_SOURCE)
actual_bundle = file_map(BUNDLE_SOURCE)
untracked_bundle = sorted(set(actual_bundle) - set(tracked_bundle))
missing_bundle = sorted(set(tracked_bundle) - set(actual_bundle))
if untracked_bundle or missing_bundle:
    raise RuntimeError(
        "private PhoneWeb.bundle is incomplete or contains untracked files: "
        f"untracked={untracked_bundle}, missing={missing_bundle}"
    )
if len(actual_bundle) != EXPECTED_BUNDLE_FILES:
    raise RuntimeError(
        f"expected {EXPECTED_BUNDLE_FILES} private bundle files, "
        f"found {len(actual_bundle)}"
    )

source_files = tracked_files_under(SOURCE)
for path in [
    SOURCE / "PhoneCompanionTest.xcodeproj/project.pbxproj",
    SOURCE / "PhoneCompanionTest/LocalPhoneWebView.swift",
    SOURCE / "PhoneCompanionTest/PhoneNativeBridge.swift",
    SOURCE / "PhoneCompanionTest/SmallPhonePrivateRootView.swift",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/index.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/app.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/ai-account.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/delivery.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/commerce-ui.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/pet-game.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/glass-theme.css",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/private-runtime-diagnostics.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/repair.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/vendor/qr/jsQR.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/vendor/qr/qrcode.js",
    SOURCE / "请在Mac编译前先读.md",
    INSTALL_GUIDE_SOURCE,
]:
    if not path.is_file():
        raise RuntimeError(f"missing required private package file: {path}")
    if not run_git("ls-files", "--error-unmatch", "--", path.relative_to(ROOT).as_posix()):
        raise RuntimeError(f"required private package file is untracked: {path}")

if DELIVERY.exists() and any(DELIVERY.iterdir()):
    raise RuntimeError(f"refusing to overwrite non-empty delivery: {DELIVERY}")
DELIVERY.mkdir(exist_ok=True)

with tempfile.TemporaryDirectory(prefix="smallphone-v1122-ios248-", dir=ROOT) as temp:
    staging = Path(temp) / PACKAGE_NAME
    staging.mkdir(parents=True)
    for relative, source in sorted(source_files.items()):
        destination = staging / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    shutil.copy2(INSTALL_GUIDE_SOURCE, staging / INSTALL_GUIDE_SOURCE.name)
    (staging / "SOURCE_COMMIT.txt").write_text(
        f"branch=main\ncommit={head}\nweb=v1122\nios=1.0.248 (248)\nbridge=25\n",
        encoding="utf-8",
        newline="\n",
    )

    bundle = staging / "PhoneCompanionTest/PhoneWeb.bundle"
    if file_map(bundle) != actual_bundle:
        raise RuntimeError("staged private PhoneWeb.bundle differs from source")

    index_bytes = (bundle / "index.html").read_bytes()
    alias_bytes = (bundle / "小手机.html").read_bytes()
    if index_bytes != alias_bytes:
        raise RuntimeError("private index.html and 小手机.html are not identical")
    shell = index_bytes.decode("utf-8")
    for token in [
        "window.__NORTH_SHELL_BUILD__='1122'",
        'private-runtime-diagnostics.js?v=248',
        "app.js?v=1122",
    ]:
        if token not in shell:
            raise RuntimeError(f"private shell token missing: {token}")

    repair = (bundle / "repair.html").read_text(encoding="utf-8")
    if "index.html?repair=1&v=1122" not in repair:
        raise RuntimeError("private repair page does not return to v1122")
    for destructive in [
        "localStorage.clear",
        "localStorage.removeItem",
        "indexedDB.deleteDatabase",
    ]:
        if destructive in repair:
            raise RuntimeError(f"private repair page is destructive: {destructive}")

    app = (bundle / "app.js").read_text(encoding="utf-8")
    for token in [
        "APP_VER='v1122 · 主屏唱片与网页云备份稳定版';",
        "function glassWidgetsRestoreAll()",
        "function emergencyRestorePreview(index)",
        "function recoveryRollbackState()",
        "function recoveryRollbackArchive(blob,live,label)",
        "opt.backup===true&&r.backup!==true",
        "opt.primaryOnly===true&&r.primaryOnly!==true",
        "snapshotSaved=false,stateMutated=false",
        "recoveryHydrateCandidate(raw,{mergeArchive:false})",
        "privateNativeCoreGet(row[0],{primaryOnly:true})",
        "privateNativeCoreGet(row[0],{backup:true})",
        "原生保护副本",
        "async function roleServerPushPull",
        "async function companionPollSnapshot",
        "async function remoteControlRoleReaction",
        "async function cohabPhoneDeliverFact",
        "function licenseSyncAiIdentity",
        "function testTTS",
        "function aiCoreUrl",
    ]:
        if token not in app:
            raise RuntimeError(f"protected private app token missing: {token}")

    overlay = (bundle / "private-runtime-diagnostics.js").read_text(encoding="utf-8")
    if "248-report-host-diagnostics-v1" not in overlay:
        raise RuntimeError("private 248 diagnostics marker missing")

    project = (
        staging / "PhoneCompanionTest.xcodeproj/project.pbxproj"
    ).read_text(encoding="utf-8")
    if project.count("CURRENT_PROJECT_VERSION = 248;") != 12:
        raise RuntimeError("private build 248 is not set on all targets/configurations")
    if project.count("MARKETING_VERSION = 1.0.248;") != 12:
        raise RuntimeError("private version 1.0.248 is not set consistently")
    if "CURRENT_PROJECT_VERSION = 247;" in project:
        raise RuntimeError("private project still contains build 247")
    if "MARKETING_VERSION = 1.0.247;" in project:
        raise RuntimeError("private project still contains version 1.0.247")

    root_view = (
        staging / "PhoneCompanionTest/SmallPhonePrivateRootView.swift"
    ).read_text(encoding="utf-8")
    for token in [
        "SmallPhoneUsageReportMountController",
        "SmallPhoneUsageReportMountView",
        "native.usageReport.mount",
        "native.usageReport.unmount",
        "Task.sleep(nanoseconds: 12_000_000_000)",
        "@State private var statusBarTheme = SmallPhoneStatusBarTheme.persisted",
    ]:
        if token not in root_view:
            raise RuntimeError(f"private report-host token missing: {token}")
    if "@State private var reportMounted" in root_view:
        raise RuntimeError("old root-level DeviceActivityReport toggle is still present")

    webview = (staging / "PhoneCompanionTest/LocalPhoneWebView.swift").read_text(
        encoding="utf-8"
    )
    for token in [
        "1.0.248 (248)",
        "smallPhone.webContentTerminationTimes.v4.build248",
        "native.webview.make",
        "native.webview.dismantle",
        "native.coordinator.deinit",
        "processSessionID",
    ]:
        if token not in webview:
            raise RuntimeError(f"private lifecycle token missing: {token}")

    bridge = (staging / "PhoneCompanionTest/PhoneNativeBridge.swift").read_text(
        encoding="utf-8"
    )
    for token in [
        "contractVersion = 25",
        'private static let build = "1.0.248 (248)"',
        'case "diagnostics.read"',
        'case "diagnostics.clear"',
        "maximumBytes = 256 * 1_024",
        'let readBackup = arguments["backup"] as? Bool ?? false',
        'let readPrimaryOnly = arguments["primaryOnly"] as? Bool ?? false',
        "nativeStorageBackupURL(for: url)",
        "if previous != theme",
    ]:
        if token not in bridge:
            raise RuntimeError(f"private bridge/recovery token missing: {token}")

    main_guide = (staging / "请在Mac编译前先读.md").read_text(encoding="utf-8")
    if "私人 iOS 1.0.248 (248)" not in main_guide:
        raise RuntimeError("Mac guide does not identify private iOS 248")

    root_files = sorted(path.name for path in staging.iterdir() if path.is_file())
    expected_root_files = sorted([
        "SOURCE_COMMIT.txt",
        "请在Mac编译前先读.md",
        INSTALL_GUIDE_SOURCE.name,
    ])
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
    if len(staged) != EXPECTED_PACKAGE_FILES:
        raise RuntimeError(
            f"expected {EXPECTED_PACKAGE_FILES} package files, found {len(staged)}"
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
            if name not in names:
                raise RuntimeError(f"ZIP omitted private file: {relative}")
            if archive.read(name) != expected:
                raise RuntimeError(f"ZIP changed private file: {relative}")
    temporary_zip.replace(ZIP_PATH)

if list(DELIVERY.iterdir()) != [ZIP_PATH]:
    raise RuntimeError("delivery directory must contain exactly one ZIP")

digest = sha256(ZIP_PATH.read_bytes()).hexdigest().upper()
if USER_ZIP.exists() and sha256(USER_ZIP.read_bytes()).hexdigest().upper() != digest:
    raise RuntimeError(f"refusing to overwrite different user package: {USER_ZIP}")
shutil.copy2(ZIP_PATH, USER_ZIP)
if sha256(USER_ZIP.read_bytes()).hexdigest().upper() != digest:
    raise RuntimeError("user-facing ZIP copy hash mismatch")

print(f"ZIP={ZIP_PATH}")
print(f"USER_ZIP={USER_ZIP}")
print(f"FILES={len(staged)}")
print(f"BUNDLE_FILES={len(actual_bundle)}")
print(f"SIZE={ZIP_PATH.stat().st_size}")
print(f"SHA256={digest}")
print("MAC_COMPILE_VERIFIED=NO")
print("REAL_IPHONE_VERIFIED=NO")
