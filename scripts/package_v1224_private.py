"""Package only the committed v1224 private iOS source; never include worktree edits."""
from hashlib import sha256
from io import BytesIO
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile
import argparse
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = "6075a4c172774cc1c81ff5304ae850058d67ed09"
SOURCE = "native/private-small-phone/XcodeProject/"
BUNDLE = "PhoneCompanionTest/PhoneWeb.bundle/"
GUIDE = "安装_v1224_iOS347_请先读.md"
PACKAGE_NAME = "小手机_v1224_私人版_iOS347_空调目标温度修复_Mac待编译源码包.zip"
PREFIX = "SmallPhone_v1224_iOS347_MacSource/"

EXPECTED_DELTA = {
    "docs/maintenance/2026-09-09_私人空调真实能力修复_待真机.md",
    "native/private-small-phone/Resources/Web/private-smart-air.js",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/HomeKitClimateBridge.swift",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/private-smart-air.js",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/repair.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "native/private-small-phone/XcodeProject/安装_v1224_iOS347_请先读.md",
    "native/private-small-phone/XcodeProject/请在Mac编译前先读.md",
    "scripts/package_v1224_private.py",
    "tests/cohabitation-theater-v1171.test.mjs",
    "tests/private-device-report-lifecycle.test.mjs",
    "tests/private-climate-optional-services.test.mjs",
    "tests/private-homekit-air.test.mjs",
    "tests/private-homekit-lock.test.mjs",
    "tests/private-intl-webcontent-recovery.test.mjs",
    "tests/private-reply-intercept-v1177.test.mjs",
    "tests/private-ios247-auto-backup-diagnostics.test.mjs",
    "tests/private-ios253-chat-continuity-alarm.test.mjs",
    "tests/private-ios295-performance-inheritance.test.mjs",
    "tests/private-ios331-background-task-lane.test.mjs",
    "tests/private-ios343-wechat-persist-coalescing.test.mjs",
    "tests/private-small-phone-foundation.test.mjs",
    "tests/v907-release.test.mjs",
    "tests/v910-screen-share.test.mjs",
    "tests/v911-background-screen-share.test.mjs",
    "tests/v912-background-vision-subtitle.test.mjs",
    "tests/v914-music-pip-ui.test.mjs",
    "tests/v916-autonomous-share.test.mjs",
    "tests/v917-release.test.mjs",
    "tests/v927-ios-pwa-beauty.test.mjs",
    "tests/v945-release.test.mjs",
    "tests/v948-private-app-cleanup.test.mjs",
    "tests/v953-wechat-unified-system.test.mjs",
    "tests/v966-home-interaction-stability.test.mjs",
    "tests/v969-native-build-regression.test.mjs",
    "tests/video-call-camera.test.mjs",
}


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.safecrlf=false", *args], cwd=ROOT)


def archive(paths: list[str]) -> dict[str, bytes]:
    raw = git("-c", "core.autocrlf=false", "archive", "--format=zip", "HEAD", "--", *paths)
    with ZipFile(BytesIO(raw)) as source_zip:
        return {
            item.filename: source_zip.read(item)
            for item in source_zip.infolist()
            if not item.is_dir()
        }


def text(value: bytes) -> str:
    return value.decode("utf-8").replace("\r\n", "\n")


def validate(files: dict[str, bytes], public_sw: bytes, public_app: bytes) -> None:
    app = text(files[BUNDLE + "app.js"])
    index = text(files[BUNDLE + "index.html"])
    air = text(files[BUNDLE + "private-smart-air.js"])
    repair = text(files[BUNDLE + "repair.html"])
    climate = text(files["PhoneCompanionTest/HomeKitClimateBridge.swift"])
    project = text(files["PhoneCompanionTest.xcodeproj/project.pbxproj"])
    local_view = text(files["PhoneCompanionTest/LocalPhoneWebView.swift"])
    native_bridge = text(files["PhoneCompanionTest/PhoneNativeBridge.swift"])

    assert files[BUNDLE + "index.html"] == files[BUNDLE + "小手机.html"]
    assert "APP_VER='v1224 · 私人空调温度修复版'" in app
    assert "window.__NORTH_SHELL_BUILD__='1224'" in index
    assert "app.js?v=1224&r=v1224-private-ac-temperature-1" in index
    assert "private-smart-air.js?v=1224" in index
    assert "index.html?repair=1&v=1224" in repair
    assert "APP_VER='v1223 · 聊天重新生成修复版'" in text(public_app)

    assert "1224-mode-specific-temperature-v3" in air
    assert "effectiveTargetTemperature" in air
    assert "coolingTargetTemperature" in air and "heatingTargetTemperature" in air
    assert "let thermostatTargetTemperature = target.serviceKind == \"thermostat\"" in climate
    selector = climate.split("private func temperatureCharacteristic(", 1)[1].split(
        "private func cachedModeName(", 1
    )[0]
    assert selector.index('target.serviceKind == "heaterCooler"') < selector.index(
        "HMCharacteristicTypeTargetTemperature"
    )
    assert project.count("CURRENT_PROJECT_VERSION = 347;") == 12
    assert project.count("MARKETING_VERSION = 1.0.347;") == 12
    assert local_view.count("1.0.347 (347)") == 2
    assert 'private static let build = "1.0.347 (347)"' in native_bridge
    assert "static let contractVersion = 37" in native_bridge
    assert "deviceOwnerAuthenticationWithBiometrics" in text(
        files["PhoneCompanionTest/HomeKitLockBridge.swift"]
    )
    assert GUIDE in files

    for name in [
        "private-smart-air.js",
        "private-smart-air.css",
        "private-smart-lock.js",
        "private-smart-lock.css",
        "private-runtime-diagnostics.js",
    ]:
        assert BUNDLE + name in files and name in index, name

    committed_air = (ROOT / "native/private-small-phone/Resources/Web/private-smart-air.js").read_bytes()
    assert text(files[BUNDLE + "private-smart-air.js"]) == text(committed_air)

    packaged_sw = text(public_sw).replace("BUILD='1223'", "BUILD='1224'").replace(
        "v1223", "v1224"
    ).encode("utf-8")
    files[BUNDLE + "sw.js"] = packaged_sw
    assert "const BUILD='1224'" in text(files[BUNDLE + "sw.js"])
    assert "north-shell-v1224" in text(files[BUNDLE + "sw.js"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    dirty = set(git("diff", "HEAD", "--name-only", "-z").decode().strip("\0").split("\0")) - {""}
    untracked = set(
        git("ls-files", "--others", "--exclude-standard", "-z").decode().strip("\0").split("\0")
    ) - {""}
    assert not dirty and not untracked, f"Package worktree must be clean: {sorted(dirty | untracked)}"

    delta = set(git("diff", "--name-only", "-z", f"{BASE}..HEAD").decode().strip("\0").split("\0")) - {""}
    assert delta == EXPECTED_DELTA, {
        "unexpected": sorted(delta - EXPECTED_DELTA),
        "missing": sorted(EXPECTED_DELTA - delta),
    }

    archived = archive([SOURCE, "sw.js", "app.js", "native/private-small-phone/migrations"])
    files = {
        path.removeprefix(SOURCE): value
        for path, value in archived.items()
        if path.startswith(SOURCE)
    }
    files = {
        path: value
        for path, value in files.items()
        if not (len(PurePosixPath(path).parts) == 1 and "安装" in path and path != GUIDE)
    }
    validate(files, archived["sw.js"], archived["app.js"])

    if args.check:
        print(f"v1224 private package precheck passed: {len(files)} files")
        return

    head = git("rev-parse", "HEAD").decode().strip()
    migration = "native/private-small-phone/migrations/202609090001_notification_avatar_preserve.sql"
    files["后台先行/202609090001_notification_avatar_preserve.sql"] = archived[migration]
    files["SOURCE_COMMIT.txt"] = (
        f"commit={head}\n"
        "private-web=v1224\n"
        "ios=1.0.347 (347)\n"
        "bridge=37\n"
        "base-release=6075a4c172774cc1c81ff5304ae850058d67ed09-v1223\n"
        "included-change=ACN1-AIR-mode-specific-target-temperature\n"
        "public-web=unchanged-v1223\n"
        "other-worktree-edits=excluded\n"
        "private-cloud-avatar-migration=VERIFIED-2026-09-09\n"
        "mac-build-verified=no\n"
        "real-iphone-verified=no\n"
        "kind=source-only-not-IPA\n"
    ).encode("utf-8")
    files["SHA256SUMS.json"] = json.dumps(
        {path: sha256(value).hexdigest() for path, value in sorted(files.items())},
        ensure_ascii=False,
        indent=2,
    ).encode("utf-8")

    output = ROOT.parent / PACKAGE_NAME
    assert not output.exists(), "Never overwrite an existing package"
    with ZipFile(output, "x", ZIP_DEFLATED, compresslevel=6) as target_zip:
        for path, value in sorted(files.items()):
            target_zip.writestr(PREFIX + path, value)

    with ZipFile(output) as target_zip:
        assert target_zip.testzip() is None
        assert len(target_zip.namelist()) == len(files)
        for path, value in files.items():
            assert target_zip.read(PREFIX + path) == value, path

    print(
        json.dumps(
            {
                "path": str(output),
                "commit": head,
                "files": len(files),
                "bytes": output.stat().st_size,
                "sha256": sha256(output.read_bytes()).hexdigest(),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
