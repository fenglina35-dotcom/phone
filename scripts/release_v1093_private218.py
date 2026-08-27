"""Bump the WeChat login return-path release to v1093 / iOS 1.0.218."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1092(?!\d)", "1093", original)
    for old, new in [
        ("v1093 · 微信登录回话与交互流畅修复版", "v1093 · 微信登录退出回话修复版"),
        ("v1093-wechat-login-performance-1", "v1093-wechat-login-return-1"),
        ("1.0.217 (217)", "1.0.218 (218)"),
        ("1.0.217（217）", "1.0.218（218）"),
        ("1.0.217", "1.0.218"),
        (r"1\.0\.217", r"1\.0\.218"),
        (r"1\.0\.218 \(217\)", r"1\.0\.218 \(218\)"),
        ("CURRENT_PROJECT_VERSION = 217;", "CURRENT_PROJECT_VERSION = 218;"),
        ("CURRENT_PROJECT_VERSION = 217", "CURRENT_PROJECT_VERSION = 218"),
        ("MARKETING_VERSION = 1.0.217;", "MARKETING_VERSION = 1.0.218;"),
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
