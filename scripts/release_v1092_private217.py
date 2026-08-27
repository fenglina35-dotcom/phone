"""Bump the WeChat login and interaction release to v1092 / iOS 1.0.217."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1091(?!\d)", "1092", original)
    for old, new in [
        ("v1092 · 拟人忙碌时间与录屏音轨修复版", "v1092 · 微信登录回话与交互流畅修复版"),
        ("v1092-busy-time-music-1", "v1092-wechat-login-performance-1"),
        ("1.0.216 (216)", "1.0.217 (217)"),
        ("1.0.216（216）", "1.0.217（217）"),
        ("1.0.216", "1.0.217"),
        (r"1\.0\.216", r"1\.0\.217"),
        (r"1\.0\.217 \(216\)", r"1\.0\.217 \(217\)"),
        ("CURRENT_PROJECT_VERSION = 216;", "CURRENT_PROJECT_VERSION = 217;"),
        ("CURRENT_PROJECT_VERSION = 216", "CURRENT_PROJECT_VERSION = 217"),
        ("MARKETING_VERSION = 1.0.216;", "MARKETING_VERSION = 1.0.217;"),
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
