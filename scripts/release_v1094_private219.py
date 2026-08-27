"""Bump the co-living location synchronization release to v1094 / iOS 1.0.219."""

from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1093(?!\d)", "1094", original)
    for old, new in [
        ("v1094 · 微信登录退出回话修复版", "v1094 · 共同生活位置同步修复版"),
        ("v1094-wechat-login-return-1", "v1094-cohab-location-sync-1"),
        ("1.0.218 (218)", "1.0.219 (219)"),
        ("1.0.218（218）", "1.0.219（219）"),
        ("1.0.218", "1.0.219"),
        (r"1\.0\.218", r"1\.0\.219"),
        (r"1\.0\.219 \(218\)", r"1\.0\.219 \(219\)"),
        ("CURRENT_PROJECT_VERSION = 218;", "CURRENT_PROJECT_VERSION = 219;"),
        ("CURRENT_PROJECT_VERSION = 218", "CURRENT_PROJECT_VERSION = 219"),
        ("MARKETING_VERSION = 1.0.218;", "MARKETING_VERSION = 1.0.219;"),
    ]:
        updated = updated.replace(old, new)
    if updated == original:
        return False
    path.write_text(updated, encoding="utf-8", newline="")
    return True


web_files = [
    ROOT / "app.js", ROOT / "index.html", ROOT / "repair.html", ROOT / "sw.js", ROOT / "小手机.html",
    ROOT / "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/Info.plist",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html",
]
result = subprocess.run(["git", "ls-files", "-z", "--", "tests/*.test.mjs"], cwd=ROOT, check=True, capture_output=True)
test_files = [ROOT / raw.decode("utf-8") for raw in result.stdout.split(b"\0") if raw]
changed = [path for path in web_files + test_files if update_text(path)]
for path in [
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj",
    ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift",
]:
    if update_text(path):
        changed.append(path)
print(f"Updated {len(changed)} versioned files")
