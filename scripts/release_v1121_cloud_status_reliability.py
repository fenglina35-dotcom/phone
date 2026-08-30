"""Advance the synchronized web/private release to v1121 / iOS 1.0.242."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str, expected: int | None = None) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(f"{path}: expected {expected} matches for {old!r}, found {count}")
    if count == 0:
        raise RuntimeError(f"{path}: missing release marker {old!r}")
    target.write_text(text.replace(old, new), encoding="utf-8", newline="")


for path in [
    "app.js",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
]:
    replace(path, "window.__NORTH_SHELL_BUILD__!=='1120'", "window.__NORTH_SHELL_BUILD__!=='1121'", 1)
    replace(path, "v1120 · 影院开麦连续播放版", "v1121 · 云状态可信显示版", 1)
    replace(
        path,
        "sw.js?v=1120&r=v1120-cinema-mic-playback-hotfix-1",
        "sw.js?v=1121&r=v1121-cloud-status-reliability-hotfix-1",
        1,
    )
    replace(path, "mp4box.all.js?v=1120&r=file-safe-1", "mp4box.all.js?v=1121&r=file-safe-1", 1)

replace("sw.js", "v1120-cinema-mic-playback-hotfix-1", "v1121-cloud-status-reliability-hotfix-1", 1)
replace("sw.js", "north-shell-v1120-cinema-mic-playback-1", "north-shell-v1121-cloud-status-reliability-1", 1)
replace("sw.js", "const BUILD='1120';", "const BUILD='1121';", 1)
replace(
    "小手机.html",
    "sw.js?v=1120&r=v1120-cinema-mic-playback-hotfix-1",
    "sw.js?v=1121&r=v1121-cloud-status-reliability-hotfix-1",
    1,
)
replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1120'", "window.__NORTH_SHELL_BUILD__='1121'", 1)
replace("小手机.html", "?v=1120", "?v=1121", 12)
replace("小手机.html", "north-sw-reloaded-1120", "north-sw-reloaded-1121", 1)
replace("index.html", "小手机.html?v=1120", "小手机.html?v=1121", 1)
replace("repair.html", "小手机.html?v=1120", "小手机.html?v=1121", 2)

for path in [
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]:
    replace(path, "window.__NORTH_SHELL_BUILD__='1120'", "window.__NORTH_SHELL_BUILD__='1121'", 1)
    replace(path, "?v=1120", "?v=1121", 13)
    replace(path, "north-sw-reloaded-1120", "north-sw-reloaded-1121", 1)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist",
    "<string>1120</string>",
    "<string>1121</string>",
    1,
)
replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1120</string>",
    "<string>1121</string>",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.241 (241)",
    "1.0.242 (242)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 241;",
    "CURRENT_PROJECT_VERSION = 242;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.241;",
    "MARKETING_VERSION = 1.0.242;",
    12,
)

for target in sorted((ROOT / "tests").glob("*.mjs")):
    text = target.read_text(encoding="utf-8")
    if "1120" not in text and "241" not in text:
        continue
    updated = (
        text.replace("v1120 · 影院开麦连续播放版", "v1121 · 云状态可信显示版")
        .replace("v1120-cinema-mic-playback-hotfix-1", "v1121-cloud-status-reliability-hotfix-1")
        .replace("north-shell-v1120-cinema-mic-playback-1", "north-shell-v1121-cloud-status-reliability-1")
        .replace("north-shell-v1120", "north-shell-v1121")
        .replace("?v=1120", "?v=1121")
        .replace("reloaded-1120", "reloaded-1121")
        .replace("__NORTH_SHELL_BUILD__='1120'", "__NORTH_SHELL_BUILD__='1121'")
        .replace("BUILD='1120'", "BUILD='1121'")
        .replace("<string>1120", "<string>1121")
        .replace("v1120", "v1121")
        .replace("1.0.241", "1.0.242")
        .replace(r"1\.0\.241", r"1\.0\.242")
        .replace("VERSION = 241;", "VERSION = 242;")
        .replace("VERSION = 241", "VERSION = 242")
        .replace("(241)", "(242)")
        .replace(r"\(241\)", r"\(242\)")
    )
    if updated != text:
        target.write_text(updated, encoding="utf-8", newline="")

print("advanced synchronized release markers to v1121 / iOS 1.0.242")
