"""Bump the per-role voice-route release to v1115 / private iOS 1.0.236."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = original
    for old, new in [
        ("v1114", "v1115"),
        ("?v=1114", "?v=1115"),
        ("BUILD='1114'", "BUILD='1115'"),
        ("BUILD__='1114'", "BUILD__='1115'"),
        ("BUILD__!=='1114'", "BUILD__!=='1115'"),
        ("<string>1114</string>", "<string>1115</string>"),
        (r"<string>1114<\/string>", r"<string>1115<\/string>"),
        ("north-shell-v1114", "north-shell-v1115"),
        ("north-sw-reloaded-1114", "north-sw-reloaded-1115"),
        ("v1115 · 朋友圈评论与角色独立路线版", "v1115 · 角色独立语音路线版"),
        ("v1115-moment-role-route-1", "v1115-role-voice-route-1"),
        ("1.0.235 (235)", "1.0.236 (236)"),
        ("1.0.235（235）", "1.0.236（236）"),
        (r"1\.0\.235 \(235\)", r"1\.0\.236 \(236\)"),
        ("1.0.235", "1.0.236"),
        (r"1\.0\.235", r"1\.0\.236"),
        ("CURRENT_PROJECT_VERSION = 235;", "CURRENT_PROJECT_VERSION = 236;"),
        ("CURRENT_PROJECT_VERSION = 235", "CURRENT_PROJECT_VERSION = 236"),
        ("MARKETING_VERSION = 1.0.235;", "MARKETING_VERSION = 1.0.236;"),
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
    ROOT / "services/phone-delivery-agent/维护者发布说明.md",
    ROOT / "docs/maintenance/README.md",
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
