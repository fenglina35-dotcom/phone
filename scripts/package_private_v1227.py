"""Build one verified v1227 private overwrite package from the committed tree."""
from hashlib import sha256
from io import BytesIO
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "native/private-small-phone/XcodeProject/"
BUNDLE = "PhoneCompanionTest/PhoneWeb.bundle/"
PREFIX = "SmallPhone_v1227_iOS350_Private/"
OUTPUT = ROOT.parent / "小手机_v1227_私人版_iOS350_覆盖包.zip"
ALLOWED_WORKTREE = {
    "native/public-north-review/PhoneCompanionTest/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "native/public-north-review/PhoneCompanionTest/PhoneCompanionTest/CompanionSyncView.swift",
    "tests/north-public-healthkit-minimal.test.mjs",
    "tests/north-review-portal.test.mjs",
    "tests/public-north-screen-time-sync.test.mjs",
}


def git(*args):
    return subprocess.check_output(["git", "-c", "core.safecrlf=false", *args], cwd=ROOT)


def committed_private_files():
    raw = BytesIO(git("-c", "core.autocrlf=false", "archive", "--format=zip", "HEAD", "--", SOURCE))
    with ZipFile(raw) as archive:
        files = {
            item.filename.removeprefix(SOURCE): archive.read(item)
            for item in archive.infolist()
            if not item.is_dir()
        }
    # Delivery contains only the buildable private project, not release/install notes.
    return {
        name: body
        for name, body in files.items()
        if not (len(PurePosixPath(name).parts) == 1 and PurePosixPath(name).suffix.lower() in {".md", ".txt"})
    }


def text(body):
    return body.decode("utf-8").replace("\r\n", "\n")


def function_source(source, name):
    start = source.index("function " + name)
    end = source.find("\nfunction ", start + 9)
    return source[start:] if end < 0 else source[start:end]


def validate(files):
    required = {
        "PhoneCompanionTest.xcodeproj/project.pbxproj",
        "PhoneCompanionTest/Info.plist",
        "PhoneCompanionTest/LocalPhoneWebView.swift",
        "PhoneCompanionTest/PhoneNativeBridge.swift",
        BUNDLE + "app.js",
        BUNDLE + "index.html",
        BUNDLE + "小手机.html",
        BUNDLE + "private-smart-air.js",
        BUNDLE + "private-smart-lock.js",
        BUNDLE + "private-runtime-diagnostics.js",
    }
    missing = sorted(required - files.keys())
    assert not missing, "missing required private files: " + ", ".join(missing)
    assert files[BUNDLE + "index.html"] == files[BUNDLE + "小手机.html"]
    app = text(files[BUNDLE + "app.js"])
    html = text(files[BUNDLE + "index.html"])
    assert "APP_VER='v1227 · 私人明确语音请求修复版'" in app
    assert "window.__NORTH_SHELL_BUILD__!=='1227'" in app
    assert "window.__NORTH_SHELL_BUILD__='1227'" in html
    assert "app.js?v=1227" in html
    for key in (
        "explicitVoiceReplyRequest",
        "requestedVoiceNeedsFix",
        "voiceReplyBlocked",
        "forceRequestedVoiceReply",
        "这条明确请求优先于“平时不主动发语音”的频率设置",
        "northNativeBackgroundTask",
        "persistWechatDrain",
        "privatePhoneAccountCall",
    ):
        assert key in app, key
    root_app = (ROOT / "app.js").read_text("utf-8").replace("\r\n", "\n")
    for name in ("explicitVoiceReplyRequest", "requestedVoiceNeedsFix", "voiceReplyBlocked", "forceRequestedVoiceReply"):
        assert function_source(app, name) == function_source(root_app, name), name
    for asset in re.findall(r'''(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']''', html):
        if "://" in asset:
            continue
        asset = asset.removeprefix("./")
        assert BUNDLE + asset in files, "missing entry dependency: " + asset
    project = text(files["PhoneCompanionTest.xcodeproj/project.pbxproj"])
    assert project.count("CURRENT_PROJECT_VERSION = 350;") == 12
    assert project.count("MARKETING_VERSION = 1.0.350;") == 12
    assert "1.0.350 (350)" in text(files["PhoneCompanionTest/LocalPhoneWebView.swift"])
    bridge = text(files["PhoneCompanionTest/PhoneNativeBridge.swift"])
    assert 'private static let build = "1.0.350 (350)"' in bridge
    assert "static let contractVersion = 37" in bridge
    air = text(files[BUNDLE + "private-smart-air.js"])
    assert "homekit.climate.command" in air
    assert 'case "homekit.climate.command"' in bridge
    for name in ("private-smart-air.js", "private-smart-air.css", "private-smart-lock.js", "private-smart-lock.css"):
        resource = ROOT / "native/private-small-phone/Resources/Web" / name
        assert text(files[BUNDLE + name]) == resource.read_text("utf-8").replace("\r\n", "\n"), name
    assert not any(name.startswith("native/public-north-review/") for name in files)


def main():
    assert git("branch", "--show-current").decode().strip() == "main"
    dirty = set(git("diff", "HEAD", "--name-only", "-z").decode().strip("\0").split("\0")) - {""}
    untracked = set(git("ls-files", "--others", "--exclude-standard", "-z").decode().strip("\0").split("\0")) - {""}
    unexpected = (dirty | untracked) - ALLOWED_WORKTREE
    assert not unexpected, "unexpected worktree files: " + ", ".join(sorted(unexpected))
    files = committed_private_files()
    # The private file:// app normally skips SW; include a matching fallback because the entry references it.
    files[BUNDLE + "sw.js"] = git("show", "HEAD:sw.js").replace(b"1226", b"1227")
    validate(files)
    assert not OUTPUT.exists(), "refusing to overwrite an existing v1227 package"
    with ZipFile(OUTPUT, "x", ZIP_DEFLATED, compresslevel=6) as archive:
        for name, body in sorted(files.items()):
            archive.writestr(PREFIX + name, body)
    with ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(files)
        for name, body in files.items():
            assert archive.read(PREFIX + name) == body, name
    print(json.dumps({
        "path": str(OUTPUT),
        "commit": git("rev-parse", "HEAD").decode().strip(),
        "files": len(files),
        "bytes": OUTPUT.stat().st_size,
        "sha256": sha256(OUTPUT.read_bytes()).hexdigest(),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
