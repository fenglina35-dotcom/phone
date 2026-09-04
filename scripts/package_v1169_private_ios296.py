from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "native/private-small-phone/XcodeProject"
BUNDLE_SOURCE = SOURCE / "PhoneCompanionTest/PhoneWeb.bundle"
INSTALL_GUIDE_SOURCE = (
    SOURCE / "第二百九十六次安装_v1169_心动审判逐题补齐_请先读.md"
)
DELIVERY = ROOT / "delivery-v1169-private296-heartquiz-progressive-fill-candidate"
PACKAGE_NAME = "SmallPhone_v1169_HeartQuizProgressiveFill_iOS296_MacReady"
ZIP_PATH = DELIVERY / f"{PACKAGE_NAME}.zip"
USER_ZIP = ROOT.parent / "小手机_v1169_私人版_iOS296_心动审判逐题补齐_Mac待编译源码包.zip"
EXPECTED_BUNDLE_FILES = 148
EXPECTED_PACKAGE_FILES = 188
ALLOW_DIRTY_PACKAGE = "--allow-dirty" in sys.argv[1:]


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        ["git", *args], cwd=ROOT, check=check, capture_output=True
    )


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
    output = git(
        "ls-files", "-z", "--", base.relative_to(ROOT).as_posix()
    ).stdout
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


def require_tokens(text: str, tokens: list[str], label: str) -> None:
    for token in tokens:
        if token not in text:
            raise RuntimeError(f"{label} token missing: {token}")


tracked_status = git(
    "status", "--porcelain=v1", "--untracked-files=no"
).stdout.strip()
if tracked_status and not ALLOW_DIRTY_PACKAGE:
    raise RuntimeError(
        "tracked working tree is dirty; rerun with --allow-dirty only after review"
    )

branch = git("symbolic-ref", "--short", "HEAD").stdout.decode().strip()
if branch != "main":
    raise RuntimeError(f"expected main branch, found {branch}")
head = git("rev-parse", "HEAD").stdout.decode("ascii").strip()
ahead_behind = git(
    "rev-list", "--left-right", "--count", "HEAD...origin/main"
).stdout.decode("ascii").strip().split()
if len(ahead_behind) != 2 or ahead_behind[1] != "0":
    raise RuntimeError("local main must not be behind origin/main before packaging")

public_paths = [
    "app.js", "heart-quiz.js", "index.html", "小手机.html", "repair.html",
    "sw.js", "web-hotfix.js", "manifest.webmanifest",
]
if git("diff", "--quiet", "--", *public_paths, check=False).returncode != 0:
    raise RuntimeError("shared release files must be committed before packaging")
public_app = (ROOT / "app.js").read_text(encoding="utf-8")
if "APP_VER='v1169 · 心动审判逐题补齐版'" not in public_app:
    raise RuntimeError("public web baseline is no longer v1169")
public_shell = (ROOT / "小手机.html").read_text(encoding="utf-8")
require_tokens(
    public_shell,
    [
        "window.__NORTH_SHELL_BUILD__='1169'",
        "app.js?v=1169&r=v1169-heartquiz-progressive-fill-1",
        "heart-quiz.js?v=1169",
    ],
    "public shell",
)

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
required = [
    SOURCE / "PhoneCompanionTest.xcodeproj/project.pbxproj",
    SOURCE / "PhoneCompanionTest/LocalPhoneWebView.swift",
    SOURCE / "PhoneCompanionTest/PhoneNativeBridge.swift",
    SOURCE / "PhoneCompanionTest/HomeKitLightBridge.swift",
    SOURCE / "PhoneCompanionTest/Info.plist",
    SOURCE / "PhoneCompanionTest/PhoneCompanionTest.entitlements",
    SOURCE / "PhoneCompanionTest/SmallPhonePrivateRootView.swift",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/index.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/app.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/heart-quiz.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/private-runtime-diagnostics.js",
    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/repair.html",
    SOURCE / "请在Mac编译前先读.md",
    INSTALL_GUIDE_SOURCE,
]
for path in required:
    if not path.is_file():
        raise RuntimeError(f"missing required private package file: {path}")
    relative = path.relative_to(SOURCE).as_posix()
    if path != INSTALL_GUIDE_SOURCE and relative not in source_files:
        raise RuntimeError(f"required private package file is untracked: {path}")

if DELIVERY.exists() and any(DELIVERY.iterdir()):
    raise RuntimeError(f"refusing to overwrite non-empty delivery: {DELIVERY}")
DELIVERY.mkdir(exist_ok=True)

with tempfile.TemporaryDirectory(prefix="smallphone-v1169-ios296-", dir=ROOT) as temp:
    staging = Path(temp) / PACKAGE_NAME
    staging.mkdir(parents=True)
    for relative, source in sorted(source_files.items()):
        destination = staging / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    shutil.copy2(INSTALL_GUIDE_SOURCE, staging / INSTALL_GUIDE_SOURCE.name)
    (staging / "SOURCE_COMMIT.txt").write_text(
        f"branch=main\ncommit={head}\n"
        f"worktree={'dirty-uncommitted' if tracked_status else 'clean'}\n"
        "scope=shared-web-and-private\npublic-web=v1169\n"
        "private-web=v1169\nios=1.0.296 (296)\nbridge=35\n"
        "mac-compile-verified=no\nreal-iphone-verified=no\n",
        encoding="utf-8",
        newline="\n",
    )

    bundle = staging / "PhoneCompanionTest/PhoneWeb.bundle"
    if file_map(bundle) != actual_bundle:
        raise RuntimeError("staged private PhoneWeb.bundle differs from source")
    if (bundle / "index.html").read_bytes() != (bundle / "小手机.html").read_bytes():
        raise RuntimeError("private index.html and 小手机.html are not identical")

    shell = (bundle / "index.html").read_text(encoding="utf-8")
    require_tokens(
        shell,
        [
            "window.__NORTH_SHELL_BUILD__='1169'",
            "app.js?v=1169&r=v1169-heartquiz-progressive-fill-1",
            "private-runtime-diagnostics.js?v=296",
        ],
        "private shell",
    )
    repair = (bundle / "repair.html").read_text(encoding="utf-8")
    require_tokens(repair, ["index.html?repair=1&v=1169"], "repair page")
    for destructive in [
        "localStorage.clear", "localStorage.removeItem", "indexedDB.deleteDatabase"
    ]:
        if destructive in repair:
            raise RuntimeError(f"private repair page is destructive: {destructive}")

    app = (bundle / "app.js").read_text(encoding="utf-8")
    require_tokens(
        app,
        [
            "APP_VER='v1169 · 心动审判逐题补齐版';",
            "function cohabRepairRows",
            "function xForgetTweet",
            "function alarmPendingDuplicate",
            "function roleStaleRecentReferenceIssue",
            "function callVideoCameraVerifyAfterSpeech()",
            "function emergencyRestorePreview(index)",
            "function recoveryRollbackState()",
            "function glassWidgetsRestoreAll()",
            "function smartHomeRoleDecision",
            "function pfSyncMaybeYield(index)",
            "function pfStoreMessage(m,bulk)",
            "function pfStoreGroupMessage(m,bulk)",
            "pfReconcileReadInference(full?null:bulk.friendTouched",
            "function licenseManagedIdentitySyncPlan",
            "function licenseScheduleManagedIdentitySync",
            "LICENSE_CHECK_STARTUP_DELAY_MS=12000",
            "licenseScheduleCheck(LICENSE_CHECK_STARTUP_DELAY_MS,'boot')",
            "PRIVATE_RESUME_SYNC_SETTLE_MS=1200",
            "function northNativeMaintenancePaused()",
        ],
        "private app",
    )

    heart = (bundle / "heart-quiz.js").read_text(encoding="utf-8")
    if (bundle / "heart-quiz.js").read_bytes() != (ROOT / "heart-quiz.js").read_bytes():
        raise RuntimeError("public and private heart quiz runtimes differ")
    require_tokens(
        heart,
        [
            "async function heartQuizGenerate(c,g)",
            "function heartQuizTextRows",
            "function heartQuizNormalizeRows",
            "function heartQuizDiagText",
            "while(out.length<HEART_QUIZ_TOTAL&&batch<12)",
            "while(out.length<HEART_QUIZ_TOTAL&&single<singleLimit",
            "心动审判逐题补齐",
            "只收齐'+out.length+'/30题",
            "正在分批准备审判",
        ],
        "heart quiz",
    )

    overlay = (bundle / "private-runtime-diagnostics.js").read_text(encoding="utf-8")
    require_tokens(
        overlay,
        [
            "296-heartquiz-progressive-fill-v1",
            "window.__smallPhonePhoneFriendSyncTrace=function",
            "window.__smallPhoneLicenseIdentityTrace=function",
            "slow.'+name+'.sync",
            "lastOp:recent.lastOp",
            "recovery.launch.peek",
            "recovery.launch.ack",
        ],
        "private diagnostics",
    )

    project = (staging / "PhoneCompanionTest.xcodeproj/project.pbxproj").read_text(
        encoding="utf-8"
    )
    if project.count("CURRENT_PROJECT_VERSION = 296;") != 12:
        raise RuntimeError("private build 296 is not set on all target configurations")
    if project.count("MARKETING_VERSION = 1.0.296;") != 12:
        raise RuntimeError("private version 1.0.296 is not set consistently")

    bridge = (staging / "PhoneCompanionTest/PhoneNativeBridge.swift").read_text(
        encoding="utf-8"
    )
    require_tokens(
        bridge,
        [
            'private static let build = "1.0.296 (296)"',
            "static let contractVersion = 35",
            "URLSession.shared.dataTask(with: request)",
            "Task { @MainActor [weak self] in",
            "native.license.request.begin",
            "native.license.request.networkEnd",
            "native.license.request.decodeEnd",
            "native.license.request.replyDispatched",
            "native.license.request.replyCompleted",
            'case "diagnostics.read"',
            'case "recovery.launch.peek"',
        ],
        "private bridge",
    )
    license_start = bridge.index("private func performLicenseRequest(")
    license_end = bridge.index("private struct PrivateAccountSession", license_start)
    if license_start < 0 or license_end <= license_start:
        raise RuntimeError("could not isolate native license request")
    if "try await URLSession.shared.data(for: request)" in bridge[license_start:license_end]:
        raise RuntimeError("license request still awaits URLSession on the main actor")

    webview = (staging / "PhoneCompanionTest/LocalPhoneWebView.swift").read_text(
        encoding="utf-8"
    )
    require_tokens(
        webview,
        [
            "1.0.296 (296)",
            "smallPhone.webContentTerminationTimes.v7.build296",
            "responsivenessProbeToken += 1",
            "private func cancelAutomaticWebContentRecovery()",
            "native.webcontent.remountScheduled",
            "native.webcontent.remountDeferred",
            "native.webcontent.remountStarted",
            "onRecoveryRestartReady(false)",
            "configuration.websiteDataStore = .default()",
        ],
        "private WebView",
    )
    terminated_start = webview.index("func webViewWebContentProcessDidTerminate")
    terminated_end = webview.index("        func webView(", terminated_start + 1)
    if terminated_start < 0 or terminated_end <= terminated_start:
        raise RuntimeError("could not isolate WebContent termination handler")
    if "webView.loadFileURL" in webview[terminated_start:terminated_end]:
        raise RuntimeError("terminated WKWebView is still reused for recovery")

    main_guide = (staging / "请在Mac编译前先读.md").read_text(encoding="utf-8")
    install_guide = (staging / INSTALL_GUIDE_SOURCE.name).read_text(encoding="utf-8")
    for guide in [main_guide, install_guide]:
        require_tokens(
            guide,
            ["v1169", "1.0.296 (296)", "原生桥 35", "不要先删除"],
            "Mac guide",
        )

    root_files = sorted(path.name for path in staging.iterdir() if path.is_file())
    expected_root_files = sorted(
        ["SOURCE_COMMIT.txt", "请在Mac编译前先读.md", INSTALL_GUIDE_SOURCE.name]
    )
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
        raise RuntimeError(f"package contains cache or user state: {forbidden}")

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
            if name not in names or archive.read(name) != expected:
                raise RuntimeError(f"ZIP omitted or changed private file: {relative}")
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
