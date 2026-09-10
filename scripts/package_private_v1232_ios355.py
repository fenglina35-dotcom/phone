"""Create one verified private v1232 / iOS 355 Mac-source overwrite package."""

from hashlib import sha256
from io import BytesIO
import argparse
from pathlib import Path, PurePosixPath
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile
import json
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SOURCE = "native/private-small-phone/XcodeProject/"
BUNDLE = "PhoneCompanionTest/PhoneWeb.bundle/"
PREFIX = "SmallPhone_v1232_iOS355_Private/"
COMMIT = "HEAD"
OUTPUT = ROOT.parent / "小手机_v1232_私人版_iOS355_共同生活回复等待修复_最新覆盖包.zip"


def git(*args: str) -> bytes:
    return subprocess.check_output(
        ["git", "-c", "core.safecrlf=false", *args],
        cwd=ROOT,
    )


def text(body: bytes) -> str:
    return body.decode("utf-8").replace("\r\n", "\n")


def tracked_private_files() -> dict[str, bytes]:
    # Use Git objects, never the mutable checkout, for every delivered byte.
    archive_bytes = git("archive", "--format=zip", COMMIT, SOURCE)
    files: dict[str, bytes] = {}
    with ZipFile(BytesIO(archive_bytes)) as archive:
        for info in archive.infolist():
            name = info.filename
            if info.is_dir() or not name.startswith(SOURCE):
                continue
            relative = name.removeprefix(SOURCE)
            relative_path = PurePosixPath(relative)
            assert not relative_path.is_absolute() and ".." not in relative_path.parts
            if len(relative_path.parts) == 1 and relative_path.suffix.lower() in {".md", ".txt"}:
                continue
            files[relative] = archive.read(info)
    return files


def validate(files: dict[str, bytes]) -> None:
    required = {
        "PhoneCompanionTest.xcodeproj/project.pbxproj",
        "PhoneCompanionTest/Info.plist",
        "PhoneCompanionTest/CompanionSyncView.swift",
        "PhoneCompanionTest/CompanionWellnessService.swift",
        "PhoneCompanionTest/LocalPhoneWebView.swift",
        "PhoneCompanionTest/PhoneNativeBridge.swift",
        BUNDLE + "app.js",
        BUNDLE + "index.html",
        BUNDLE + "小手机.html",
        BUNDLE + "private-runtime-diagnostics.js",
        BUNDLE + "private-smart-air.js",
        BUNDLE + "private-smart-lock.js",
    }
    missing = sorted(required - files.keys())
    assert not missing, "missing required private files: " + ", ".join(missing)
    assert files[BUNDLE + "index.html"] == files[BUNDLE + "小手机.html"]

    app = text(files[BUNDLE + "app.js"])
    html = text(files[BUNDLE + "index.html"])
    diagnostics = text(files[BUNDLE + "private-runtime-diagnostics.js"])
    sync = text(files["PhoneCompanionTest/CompanionSyncView.swift"])
    bridge = text(files["PhoneCompanionTest/PhoneNativeBridge.swift"])
    web_view = text(files["PhoneCompanionTest/LocalPhoneWebView.swift"])
    project = text(files["PhoneCompanionTest.xcodeproj/project.pbxproj"])

    assert "APP_VER='v1232 · 共同生活回复等待修复'" in app
    assert "window.__NORTH_SHELL_BUILD__!=='1232'" in app
    assert "window.__NORTH_SHELL_BUILD__='1232'" in html
    assert "app.js?v=1232&r=v1232-cohab-request-timeout-1" in html
    assert "private-runtime-diagnostics.js?v=335" in html
    assert "OVERLAY_VERSION='335-resume-status-lane'" in diagnostics
    assert "1.0.355 (355)" in web_view
    assert 'private static let build = "1.0.355 (355)"' in bridge
    assert "static let contractVersion = 37" in bridge
    assert project.count("CURRENT_PROJECT_VERSION = 355;") == 12
    assert project.count("MARKETING_VERSION = 1.0.355;") == 12

    for marker in ("offlineForeground:true", "OFFLINE_REPLY_TIMEOUT", "offlineRequestTimeoutError(timeoutMs)"):
        assert marker in app, marker
    for name in ("offlineRequestTimeoutError", "offlineForegroundRequest", "offlineRequestVisibility", "offlineReplyChatRequest", "cohabRoleChat"):
        public = text(git("show", COMMIT + ":app.js"))
        def function_line(source):
            return next(line for line in source.splitlines() if line.startswith("function " + name + "(") or line.startswith("async function " + name + "("))
        assert function_line(app) == function_line(public), name
    diagnostic = text(files[BUNDLE + "cohab-model-diagnostics.js"])
    assert diagnostic == text(git("show", COMMIT + ":cohab-model-diagnostics.js"))
    assert "单次请求超时" in diagnostic and "本轮已用时间" in diagnostic

    # The fix must be present and explicit owner/role reads must retain the
    # complete path instead of silently losing phone-check functionality.
    assert 'if focus == "状态"' in sync
    assert "return makePassiveStatusSnapshot(" in sync
    passive_start = sync.index("private func makePassiveStatusSnapshot(")
    passive_end = sync.index("\n    private func ", passive_start + 20)
    passive = sync[passive_start:passive_end]
    for marker in ('"controlOnly": true', '"deviceTelemetry": telemetry'):
        assert marker in passive, marker
    for forbidden in (
        "loadSelection(",
        "loadLimitSettings(",
        "stableExternalID(",
        "loadFreshTodayPoints(",
        "makeSnapshot(",
    ):
        assert forbidden not in passive, forbidden
    for marker in (
        "native.deviceSnapshot.begin",
        "native.deviceSnapshot.end",
        'focusKind = "passive-status"',
        'focusKind = "control-status"',
    ):
        assert marker in bridge, marker

    for marker in (
        "explicitVoiceReplyRequest",
        "forceRequestedVoiceReply",
        "privatePhoneAccountCall",
        "persistWechatDrain",
        "notificationAvatarPreserve:true",
        "northNativeBackgroundTask",
        "伴生健康刷新",
        "控制状态",
    ):
        assert marker in app, marker

    for asset in re.findall(
        r'''(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']''',
        html,
    ):
        if "://" in asset:
            continue
        asset = asset.removeprefix("./")
        assert BUNDLE + asset in files, "missing private entry dependency: " + asset

    public_html = text(git("show", COMMIT + ":小手机.html"))
    for asset in re.findall(
        r'''(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']''',
        public_html,
    ):
        if "://" in asset:
            continue
        asset = asset.removeprefix("./")
        assert BUNDLE + asset in files, "missing public feature dependency: " + asset

    for resource_name in (
        "private-smart-air.js",
        "private-smart-air.css",
        "private-smart-lock.js",
        "private-smart-lock.css",
    ):
        canonical = text(git("show", COMMIT + ":native/private-small-phone/Resources/Web/" + resource_name))
        assert text(files[BUNDLE + resource_name]) == canonical, resource_name

    public_app = text(git("show", COMMIT + ":app.js"))
    public_entry = text(git("show", COMMIT + ":小手机.html"))
    assert "APP_VER='v1232 · 共同生活回复等待修复'" in public_app
    assert "window.__NORTH_SHELL_BUILD__='1232'" in public_entry
    assert not any(name.startswith("native/public-north-review/") for name in files)


def main() -> None:
    global COMMIT, OUTPUT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", default="HEAD")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--extract-to", type=Path)
    args = parser.parse_args()
    COMMIT = git("rev-parse", "--verify", args.commit + "^{commit}").decode().strip()
    OUTPUT = args.output.resolve()
    assert not OUTPUT.exists(), "refusing to overwrite an existing private package"

    files = tracked_private_files()
    validate(files)
    source_state = {
        "baseCommit": COMMIT,
        "source": "verified-git-commit",
        "scope": "private-only",
        "privateWeb": "v1232",
        "privateIOS": "1.0.355 (355)",
        "nativeBridge": 37,
        "diagnostics": "335-resume-status-lane",
        "publicWebChanged": True,
        "macBuildVerified": False,
        "realIPhoneVerified": False,
        "kind": "Mac-source-overwrite-package-not-IPA",
    }
    files["SOURCE_STATE.json"] = json.dumps(
        source_state,
        ensure_ascii=False,
        indent=2,
    ).encode("utf-8")
    checksums = {
        name: sha256(body).hexdigest()
        for name, body in sorted(files.items())
    }
    files["SHA256SUMS.json"] = json.dumps(
        checksums,
        ensure_ascii=False,
        indent=2,
    ).encode("utf-8")

    with ZipFile(OUTPUT, "x", ZIP_DEFLATED, compresslevel=6) as archive:
        for name, body in sorted(files.items()):
            archive.writestr(PREFIX + name, body)

    with ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(files)
        for name, body in files.items():
            assert archive.read(PREFIX + name) == body, name

    with TemporaryDirectory(prefix="small-phone-v1232-verify-") as folder:
        destination = Path(folder)
        with ZipFile(OUTPUT) as archive:
            archive.extractall(destination)
        extracted = destination / PREFIX
        extracted_files = {
            item.relative_to(extracted).as_posix(): item.read_bytes()
            for item in extracted.rglob("*")
            if item.is_file()
        }
        assert extracted_files == files
        validate({
            name: body
            for name, body in extracted_files.items()
            if name not in {"SOURCE_STATE.json", "SHA256SUMS.json"}
        })

    if args.extract_to:
        destination = args.extract_to.resolve()
        assert not destination.exists(), "refusing to overwrite extraction evidence"
        destination.mkdir(parents=True)
        with ZipFile(OUTPUT) as archive:
            archive.extractall(destination)
        for name, body in files.items():
            assert (destination / PREFIX / name).read_bytes() == body

    print(json.dumps({
        "path": str(OUTPUT),
        "baseCommit": source_state["baseCommit"],
        "files": len(files),
        "bytes": OUTPUT.stat().st_size,
        "sha256": sha256(OUTPUT.read_bytes()).hexdigest(),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
