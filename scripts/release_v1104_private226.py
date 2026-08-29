"""Bump the proactive-output safety release to v1104 / private iOS 1.0.226."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = original
    for old, new in [
        ("v1103", "v1104"),
        ("?v=1103", "?v=1104"),
        ("BUILD='1103'", "BUILD='1104'"),
        ("BUILD__='1103'", "BUILD__='1104'"),
        ("<string>1103</string>", "<string>1104</string>"),
        ("north-shell-v1103", "north-shell-v1104"),
        ("north-sw-reloaded-1103", "north-sw-reloaded-1104"),
        ("v1104 · 安卓缓存解锁与存档保护版", "v1104 · 后台主动消息安全版"),
        ("v1104-android-cache-unlock-store-1", "v1104-role-push-output-safety-1"),
        ("1.0.225 (225)", "1.0.226 (226)"),
        ("1.0.225（225）", "1.0.226（226）"),
        ("1.0.225", "1.0.226"),
        (r"1\.0\.225", r"1\.0\.226"),
        ("CURRENT_PROJECT_VERSION = 225;", "CURRENT_PROJECT_VERSION = 226;"),
        ("CURRENT_PROJECT_VERSION = 225", "CURRENT_PROJECT_VERSION = 226"),
        ("MARKETING_VERSION = 1.0.225;", "MARKETING_VERSION = 1.0.226;"),
    ]:
        updated = updated.replace(old, new)
    if updated == original:
        return False
    path.write_text(updated, encoding="utf-8", newline="")
    return True


web_files = [
    ROOT / "app.js",
    ROOT / "index.html",
    ROOT / "repair.html",
    ROOT / "sw.js",
    ROOT / "小手机.html",
    ROOT / "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]
result = subprocess.run(
    ["git", "ls-files", "-z", "--", "tests/*.test.mjs"],
    cwd=ROOT,
    check=True,
    capture_output=True,
)
test_files = [ROOT / raw.decode("utf-8") for raw in result.stdout.split(b"\0") if raw]
changed = [path for path in web_files + test_files if update_text(path)]
for path in [
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
]:
    if update_text(path):
        changed.append(path)
print(f"Updated {len(changed)} versioned files")
