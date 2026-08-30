"""Advance the synchronized web/private release to v1120 / iOS 1.0.241."""

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
    replace(path, "window.__NORTH_SHELL_BUILD__!=='1119'", "window.__NORTH_SHELL_BUILD__!=='1120'", 1)
    replace(path, "v1119 · 图标美化补全版", "v1120 · 影院开麦连续播放版", 1)
    replace(
        path,
        "sw.js?v=1119&r=v1119-cinema-mp4-file-hotfix-1",
        "sw.js?v=1120&r=v1120-cinema-mic-playback-hotfix-1",
        1,
    )

replace("sw.js", "v1119-cinema-mp4-file-hotfix-1", "v1120-cinema-mic-playback-hotfix-1", 1)
replace("sw.js", "north-shell-v1119-cinema-mp4-file-1", "north-shell-v1120-cinema-mic-playback-1", 1)
replace("sw.js", "const BUILD='1119';", "const BUILD='1120';", 1)
replace(
    "小手机.html",
    "sw.js?v=1119&r=v1119-cinema-mp4-file-hotfix-1",
    "sw.js?v=1120&r=v1120-cinema-mic-playback-hotfix-1",
    1,
)
replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1119'", "window.__NORTH_SHELL_BUILD__='1120'", 1)
replace("小手机.html", "?v=1119", "?v=1120", 12)
replace("小手机.html", "north-sw-reloaded-1119", "north-sw-reloaded-1120", 1)
replace("index.html", "小手机.html?v=1119", "小手机.html?v=1120", 1)
replace("repair.html", "小手机.html?v=1119", "小手机.html?v=1120", 2)

for path in [
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]:
    replace(path, "window.__NORTH_SHELL_BUILD__='1119'", "window.__NORTH_SHELL_BUILD__='1120'", 1)
    replace(path, "?v=1119", "?v=1120", 13)
    replace(path, "north-sw-reloaded-1119", "north-sw-reloaded-1120", 1)

replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist",
    "<string>1119</string>",
    "<string>1120</string>",
    1,
)
replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1119</string>",
    "<string>1120</string>",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
    "1.0.240 (240)",
    "1.0.241 (241)",
    1,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "CURRENT_PROJECT_VERSION = 240;",
    "CURRENT_PROJECT_VERSION = 241;",
    12,
)
replace(
    "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    "MARKETING_VERSION = 1.0.240;",
    "MARKETING_VERSION = 1.0.241;",
    12,
)

for target in sorted((ROOT / "tests").glob("*.mjs")):
    text = target.read_text(encoding="utf-8")
    if "1119" not in text and "240" not in text:
        continue
    updated = (
        text.replace("v1119 · 图标美化补全版", "v1120 · 影院开麦连续播放版")
        .replace("v1119-cinema-mp4-file-hotfix-1", "v1120-cinema-mic-playback-hotfix-1")
        .replace("north-shell-v1119-cinema-mp4-file-1", "north-shell-v1120-cinema-mic-playback-1")
        .replace("north-shell-v1119", "north-shell-v1120")
        .replace("?v=1119", "?v=1120")
        .replace("reloaded-1119", "reloaded-1120")
        .replace("__NORTH_SHELL_BUILD__='1119'", "__NORTH_SHELL_BUILD__='1120'")
        .replace("BUILD='1119'", "BUILD='1120'")
        .replace("<string>1119", "<string>1120")
        .replace("v1119", "v1120")
        .replace("1.0.240", "1.0.241")
        .replace(r"1\.0\.240", r"1\.0\.241")
        .replace("VERSION = 240;", "VERSION = 241;")
        .replace("VERSION = 240", "VERSION = 241")
        .replace("(240)", "(241)")
        .replace(r"\(240\)", r"\(241\)")
    )
    if updated != text:
        target.write_text(updated, encoding="utf-8", newline="")

print("advanced synchronized release markers to v1120 / iOS 1.0.241")
