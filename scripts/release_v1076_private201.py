"""Bump the pose-first wardrobe fix to web v1076 / private iOS 1.0.201 (201)."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1075(?!\d)", "1076", original)
    for old, new in [
        ("v1076 · 角色衣柜强制锁定版", "v1076 · 用户动作优先衣柜版"),
        ("v1076-role-wardrobe-hard-lock-1", "v1076-user-pose-first-1"),
        (r"1\.0\.200 \(200\)", r"1\.0\.201 \(201\)"),
        ("1.0.200 (200)", "1.0.201 (201)"),
        ("1.0.200（200）", "1.0.201（201）"),
        ("1.0.200", "1.0.201"),
        (r"1\.0\.200", r"1\.0\.201"),
        ("CURRENT_PROJECT_VERSION = 200;", "CURRENT_PROJECT_VERSION = 201;"),
        ("CURRENT_PROJECT_VERSION = 200", "CURRENT_PROJECT_VERSION = 201"),
        ("MARKETING_VERSION = 1.0.200;", "MARKETING_VERSION = 1.0.201;"),
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
    ["git", "grep", "-l", "-E", r"v1075|1075|1\.0\.200|VERSION = 200", "--", "tests"],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
    encoding="utf-8",
)
test_files = [ROOT / line for line in result.stdout.splitlines() if line]

changed = [path for path in web_files + test_files if update_text(path)]

project = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj"
webview = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift"
for path in [project, webview]:
    if update_text(path):
        changed.append(path)

print(f"Updated {len(changed)} versioned files")
