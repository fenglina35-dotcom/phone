"""Create the private v1250 / iOS 360 Mac-source overlay package.

Unlike the earlier packaging scripts, every file is read from the committed tree
(``git cat-file`` against HEAD) instead of the working directory. The v1235/iOS356
lag repair only ever reached a device because a packaging script read the working
tree and silently carried uncommitted work into the zip; once later packages were
built from a clean checkout the repair vanished. Reading from HEAD makes a package
reproducible from the commit it names, and makes an uncommitted fix impossible to
ship by accident.

Per the user's standing request the archive carries no documentation files: it is
a single, non-nested zip whose name states its version.
"""

from hashlib import sha256
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "native/private-small-phone/XcodeProject/"
BUNDLE = "PhoneCompanionTest/PhoneWeb.bundle/"
PREFIX = "SmallPhone_v1250_iOS360_Private/"
OUTPUT = ROOT.parent / "SmallPhone_v1250_iOS360_MacSource.zip"

WEB_VERSION = "1250"
MARKETING = "1.0.360"
BUILD = "360"
BRIDGE = "38"


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.safecrlf=false", *args], cwd=ROOT)


def text(body: bytes) -> str:
    return body.decode("utf-8").replace("\r\n", "\n")


def committed_private_files() -> dict[str, bytes]:
    """Every tracked file under SOURCE, read from HEAD; documentation excluded."""
    listing = text(git("ls-tree", "-r", "-z", "--name-only", "HEAD", "--", SOURCE)).strip("\0")
    files: dict[str, bytes] = {}
    for name in listing.split("\0"):
        if not name:
            continue
        relative = name[len(SOURCE):]
        if PurePosixPath(relative).suffix.lower() in {".md", ".txt"}:
            continue
        files[relative] = git("cat-file", "blob", f"HEAD:{name}")
    return files


def validate(files: dict[str, bytes]) -> None:
    required = {
        "PhoneCompanionTest.xcodeproj/project.pbxproj",
        "PhoneCompanionTest/Info.plist",
        "PhoneCompanionTest/PhoneCompanionTest.entitlements",
        "PhoneCompanionTest/LocalPhoneWebView.swift",
        "PhoneCompanionTest/PhoneNativeBridge.swift",
        BUNDLE + "app.js",
        BUNDLE + "index.html",
        BUNDLE + "小手机.html",
        BUNDLE + "private-runtime-diagnostics.js",
        BUNDLE + "private-cloud-backup.js",
    }
    missing = sorted(required - files.keys())
    assert not missing, "missing private files: " + ", ".join(missing)
    assert not [n for n in files if n.lower().endswith((".md", ".txt"))], "package must carry no docs"

    app = text(files[BUNDLE + "app.js"])
    index = text(files[BUNDLE + "index.html"])
    alias = text(files[BUNDLE + "小手机.html"])
    pbx = text(files["PhoneCompanionTest.xcodeproj/project.pbxproj"])
    bridge = text(files["PhoneCompanionTest/PhoneNativeBridge.swift"])
    web_view = text(files["PhoneCompanionTest/LocalPhoneWebView.swift"])

    assert index == alias, "index.html and 小手机.html must stay identical"
    assert f"window.__NORTH_SHELL_BUILD__='{WEB_VERSION}'" in index
    assert f"APP_VER='v{WEB_VERSION}" in app
    assert f'window.__NORTH_SHELL_BUILD__!==\'{WEB_VERSION}\'' in app
    assert f'static let contractVersion = {BRIDGE}' in bridge
    assert f"{MARKETING} ({BUILD})" in bridge
    assert f"{MARKETING} ({BUILD})" in web_view
    assert pbx.count(f"CURRENT_PROJECT_VERSION = {BUILD};") == 12
    assert pbx.count(f"MARKETING_VERSION = {MARKETING};") == 12

    # Repairs that must ride along in every package. Keep in step with
    # tests/permanent-fix-guard.test.mjs; a package is never allowed to drop one.
    for marker, label in [
        ("const label=cohabActivityClean(spec.label)", "v1248 作息同步清洗后比较"),
        ("clearTimeout(_roleServerPushSoonTimers[key])", "v1248 角色服务器同步去抖"),
        ("else if(/^[（(【]/.test(raw)&&!/[）)】]$/.test(raw))", "v1246 截断旁白识别"),
        ("open=!closed&&line.match", "v1246 原文输出路径截断旁白"),
        ("function offlineReplyBudget(input,c)", "v1247 共同生活回复长度可调"),
        ("s_cmax_offline", "v1247 独立回复长度设置项"),
        ("backupJsonBlob", "大存档分段备份"),
        ("pfSyncMaybeYield", "好友同步让出主线程"),
    ]:
        assert marker in app, f"package would drop a required repair: {label}"
    assert app.count("northNativeBackgroundTask") >= 30, "private background-task wrappers missing"
    assert "north-native-performance-guard" in app, "private performance guard missing"

    assert len([n for n in files if n.startswith(BUNDLE)]) >= 350, "private web bundle looks incomplete"


def main() -> None:
    dirty = text(git("status", "--porcelain", "--", SOURCE)).strip()
    assert not dirty, "commit the private source before packaging:\n" + dirty

    files = committed_private_files()
    validate(files)

    assert not OUTPUT.exists(), "refusing to overwrite an existing package"
    with ZipFile(OUTPUT, "x", ZIP_DEFLATED, compresslevel=6) as archive:
        for name in sorted(files):
            archive.writestr(PREFIX + name, files[name])

    with ZipFile(OUTPUT) as archive:
        names = archive.namelist()
        assert len(names) == len(files)
        for name in names:
            assert archive.read(name) == files[name[len(PREFIX):]], f"round-trip mismatch: {name}"

    print(json.dumps({
        "path": str(OUTPUT),
        "sourceCommit": text(git("rev-parse", "HEAD")).strip(),
        "files": len(files),
        "bytes": OUTPUT.stat().st_size,
        "sha256": sha256(OUTPUT.read_bytes()).hexdigest(),
        "webVersion": WEB_VERSION,
        "native": f"{MARKETING} ({BUILD})",
        "bridge": BRIDGE,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
