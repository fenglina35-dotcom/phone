"""Bump the selective private-App performance rollback release to v1086 / iOS 1.0.211."""

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = re.sub(r"(?<!\d)1085(?!\d)", "1086", original)
    for old, new in [
        ("v1086 · WebContent降载与微信手动总结版", "v1086 · 私人App降载回退与图片引用修复版"),
        ("v1086-webcontent-memory-wechat-summary-1", "v1086-private-performance-rollback-image-quote-1"),
        ("1.0.210 (210)", "1.0.211 (211)"),
        ("1.0.210（210）", "1.0.211（211）"),
        ("1.0.210", "1.0.211"),
        (r"1\.0\.210", r"1\.0\.211"),
        (r"1\.0\.211 \(210\)", r"1\.0\.211 \(211\)"),
        ("CURRENT_PROJECT_VERSION = 210;", "CURRENT_PROJECT_VERSION = 211;"),
        ("CURRENT_PROJECT_VERSION = 210", "CURRENT_PROJECT_VERSION = 211"),
        ("MARKETING_VERSION = 1.0.210;", "MARKETING_VERSION = 1.0.211;"),
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
