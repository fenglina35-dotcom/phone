"""Bump the natural-delivery and KFC homepage release to v1081 / iOS 1.0.206."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1080(?!\d)", "1081", original)
    for old, new in [
        ("v1081 · 外卖角色回执真实性修复版", "v1081 · 自然点单解析与KFC首页套餐修复版"),
        ("v1081-real-delivery-role-ack-1", "v1081-natural-delivery-kfc-home-1"),
        ("1.0.205 (205)", "1.0.206 (206)"),
        ("1.0.205（205）", "1.0.206（206）"),
        ("1.0.205", "1.0.206"),
        (r"1\.0\.205", r"1\.0\.206"),
        (r"1\.0\.206 \(205\)", r"1\.0\.206 \(206\)"),
        ("CURRENT_PROJECT_VERSION = 205;", "CURRENT_PROJECT_VERSION = 206;"),
        ("CURRENT_PROJECT_VERSION = 205", "CURRENT_PROJECT_VERSION = 206"),
        ("MARKETING_VERSION = 1.0.205;", "MARKETING_VERSION = 1.0.206;"),
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

project = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj"
webview = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift"
for path in [project, webview]:
    if update_text(path):
        changed.append(path)

print(f"Updated {len(changed)} versioned files")
