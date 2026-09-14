"""Create one verified private v1240 / iOS 356 Mac-source overlay package."""

from hashlib import sha256
from pathlib import Path, PurePosixPath
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile
import json
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SOURCE = "native/private-small-phone/XcodeProject/"
BUNDLE = "PhoneCompanionTest/PhoneWeb.bundle/"
PREFIX = "SmallPhone_v1240_iOS356_Private/"
OUTPUT = ROOT.parent / "小手机_v1240_私人版_iOS356_每日分块云备份_最新覆盖包.zip"
GUIDE = "安装_v1240_iOS356_请先读.md"


def git(*args: str) -> bytes:
    return subprocess.check_output(
        ["git", "-c", "core.safecrlf=false", *args], cwd=ROOT
    )


def text(body: bytes) -> str:
    return body.decode("utf-8").replace("\r\n", "\n")


def tracked_private_files() -> dict[str, bytes]:
    names = [
        name
        for name in git("ls-files", "-z", "--", SOURCE)
        .decode("utf-8")
        .strip("\0")
        .split("\0")
        if name
    ]
    files: dict[str, bytes] = {}
    for repository_name in names:
        relative = repository_name.removeprefix(SOURCE)
        relative_path = PurePosixPath(relative)
        if (
            len(relative_path.parts) == 1
            and relative_path.suffix.lower() in {".md", ".txt"}
            and relative != GUIDE
        ):
            continue
        files[relative] = (ROOT / repository_name).read_bytes()
    return files


def validate(files: dict[str, bytes]) -> None:
    required = {
        "PhoneCompanionTest.xcodeproj/project.pbxproj",
        "PhoneCompanionTest/Info.plist",
        "PhoneCompanionTest/LocalPhoneWebView.swift",
        "PhoneCompanionTest/PhoneNativeBridge.swift",
        BUNDLE + "app.js",
        BUNDLE + "index.html",
        BUNDLE + "小手机.html",
        BUNDLE + "private-runtime-diagnostics.js",
        BUNDLE + "private-cloud-backup.js",
        GUIDE,
    }
    missing = sorted(required - files.keys())
    assert not missing, "missing private files: " + ", ".join(missing)
    assert files[BUNDLE + "index.html"] == files[BUNDLE + "小手机.html"]

    app = text(files[BUNDLE + "app.js"])
    html = text(files[BUNDLE + "index.html"])
    diagnostics = text(files[BUNDLE + "private-runtime-diagnostics.js"])
    backup = text(files[BUNDLE + "private-cloud-backup.js"])
    bridge = text(files["PhoneCompanionTest/PhoneNativeBridge.swift"])
    web_view = text(files["PhoneCompanionTest/LocalPhoneWebView.swift"])
    project = text(files["PhoneCompanionTest.xcodeproj/project.pbxproj"])
    guide = text(files[GUIDE])

    assert "APP_VER='v1240 · 私人每日云备份'" in app
    assert "window.__NORTH_SHELL_BUILD__!=='1240'" in app
    assert "window.__NORTH_SHELL_BUILD__='1240'" in html
    assert "app.js?v=1240&r=v1240-browser-diagnostics-1" in html
    assert "private-runtime-diagnostics.js?v=336" in html
    assert "private-cloud-backup.js?v=1240" in html
    assert "OVERLAY_VERSION='336-daily-file-backup'" in diagnostics
    assert "__SMALL_PHONE_DISABLE_AUTO_FULL_BACKUP__=false" in diagnostics
    assert "const CHUNK=192*1024" in backup
    for action in ("begin", "chunk", "commit", "abort"):
        assert f"account.backup.file.{action}" in backup
        assert f'"account.backup.file.{action}"' in bridge
    assert "URLSession(configuration: config)" in bridge
    assert "upload(for: request, fromFile: file.url)" in bridge
    assert "timeoutIntervalForResource = 600" in bridge
    assert "1.0.356 (356)" in web_view
    assert 'private static let build = "1.0.356 (356)"' in bridge
    assert "static let contractVersion = 38" in bridge
    assert project.count("CURRENT_PROJECT_VERSION = 356;") == 12
    assert project.count("MARKETING_VERSION = 1.0.356;") == 12
    assert "Mac 待编译" in guide and "不是 IPA" in guide

    for asset in re.findall(
        r'''(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']''', html
    ):
        if "://" in asset:
            continue
        asset = asset.removeprefix("./")
        assert BUNDLE + asset in files, "missing entry dependency: " + asset

    public_app = (ROOT / "app.js").read_text("utf-8")
    public_entry = (ROOT / "小手机.html").read_text("utf-8")
    public_worker = (ROOT / "sw.js").read_text("utf-8")
    assert "APP_VER='v1239 · 浏览器运行诊断'" in public_app
    assert "window.__NORTH_SHELL_BUILD__='1239'" in public_entry
    assert "const BUILD='1239'" in public_worker


def main() -> None:
    assert git("branch", "--show-current").decode().strip() == "main"
    assert not git("status", "--porcelain").strip(), "package only from a clean commit"
    assert not OUTPUT.exists(), "refusing to overwrite an existing package"

    files = tracked_private_files()
    validate(files)
    source_state = {
        "sourceCommit": git("rev-parse", "HEAD").decode().strip(),
        "scope": "private-only",
        "privateWeb": "v1240",
        "privateIOS": "1.0.356 (356)",
        "nativeBridge": 38,
        "diagnostics": "336-daily-file-backup",
        "publicWeb": "v1239-unchanged",
        "macBuildVerified": False,
        "realIPhoneVerified": False,
        "kind": "Mac-source-overwrite-package-not-IPA",
    }
    files["SOURCE_STATE.json"] = json.dumps(
        source_state, ensure_ascii=False, indent=2
    ).encode("utf-8")
    files["SHA256SUMS.json"] = json.dumps(
        {name: sha256(body).hexdigest() for name, body in sorted(files.items())},
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

    with TemporaryDirectory(prefix="small-phone-v1240-verify-") as folder:
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
        validate(
            {
                name: body
                for name, body in extracted_files.items()
                if name not in {"SOURCE_STATE.json", "SHA256SUMS.json"}
            }
        )

    print(
        json.dumps(
            {
                "path": str(OUTPUT),
                "sourceCommit": source_state["sourceCommit"],
                "files": len(files),
                "bytes": OUTPUT.stat().st_size,
                "sha256": sha256(OUTPUT.read_bytes()).hexdigest(),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
