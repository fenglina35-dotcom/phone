"""Bump the Moment awareness and per-role route release to v1114 / private iOS 1.0.235."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def update_text(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    updated = original
    for old, new in [
        ("v1113", "v1114"),
        ("?v=1113", "?v=1114"),
        ("BUILD='1113'", "BUILD='1114'"),
        ("BUILD__='1113'", "BUILD__='1114'"),
        ("BUILD__!=='1113'", "BUILD__!=='1114'"),
        ("<string>1113</string>", "<string>1114</string>"),
        (r"<string>1113<\/string>", r"<string>1114<\/string>"),
        ("north-shell-v1113", "north-shell-v1114"),
        ("north-sw-reloaded-1113", "north-sw-reloaded-1114"),
        ("v1114 · 角色软件锁定与共同生活入口版", "v1114 · 朋友圈评论与角色独立路线版"),
        ("v1114-role-app-lock-cohab-entry-1", "v1114-moment-role-route-1"),
        ("1.0.234 (234)", "1.0.235 (235)"),
        ("1.0.234（234）", "1.0.235（235）"),
        (r"1\.0\.234 \(234\)", r"1\.0\.235 \(235\)"),
        ("1.0.234", "1.0.235"),
        (r"1\.0\.234", r"1\.0\.235"),
        ("CURRENT_PROJECT_VERSION = 234;", "CURRENT_PROJECT_VERSION = 235;"),
        ("CURRENT_PROJECT_VERSION = 234", "CURRENT_PROJECT_VERSION = 235"),
        ("MARKETING_VERSION = 1.0.234;", "MARKETING_VERSION = 1.0.235;"),
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
