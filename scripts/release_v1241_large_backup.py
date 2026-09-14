from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle"


def replace(path: Path, old: str, new: str, minimum: int = 1) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count < minimum:
        if new in text:
            return
        raise RuntimeError(f"{path}: expected at least {minimum} occurrences of {old!r}, found {count}")
    path.write_text(text.replace(old, new), encoding="utf-8")


public_files = [
    ROOT / "app.js",
    ROOT / "index.html",
    ROOT / "小手机.html",
    ROOT / "repair.html",
    ROOT / "sw.js",
    ROOT / "web-hotfix.js",
    ROOT / "scripts/check_browser_diagnostics.cjs",
    ROOT / "scripts/check_full_backup_browser.cjs",
]
for path in public_files:
    replace(path, "1239", "1241")
    text = path.read_text(encoding="utf-8")
    text = text.replace("v1241-browser-diagnostics-1", "v1241-backup-streaming-1")
    text = text.replace("north-sw-reloaded-1241-cohab-keyboard-vinyl-1", "north-sw-reloaded-1241-backup-streaming-1")
    path.write_text(text, encoding="utf-8")
replace(ROOT / "app.js", "APP_VER='v1241 · 浏览器运行诊断'", "APP_VER='v1241 · 大存档备份流畅修复'")

private_files = [
    PRIVATE / "app.js",
    PRIVATE / "index.html",
    PRIVATE / "小手机.html",
    PRIVATE / "repair.html",
]
for path in private_files:
    replace(path, "1240", "1242")
    text = path.read_text(encoding="utf-8")
    text = text.replace("v1242-browser-diagnostics-1", "v1242-backup-streaming-1")
    text = text.replace("north-sw-reloaded-1242-cohab-request-timeout-1", "north-sw-reloaded-1242-backup-streaming-1")
    path.write_text(text, encoding="utf-8")
replace(PRIVATE / "app.js", "APP_VER='v1242 · 私人每日云备份'", "APP_VER='v1242 · 私人大存档备份流畅修复'")

for path in (ROOT / "tests").glob("*.mjs"):
    text = path.read_text(encoding="utf-8")
    updated = text.replace("1239", "1241").replace("1240", "1242")
    updated = updated.replace("v1241-browser-diagnostics-1", "v1241-backup-streaming-1")
    updated = updated.replace("v1242-browser-diagnostics-1", "v1242-backup-streaming-1")
    updated = updated.replace("v1241 · 浏览器运行诊断", "v1241 · 大存档备份流畅修复")
    updated = updated.replace("v1242 · 私人每日云备份", "v1242 · 私人大存档备份流畅修复")
    updated = updated.replace("north-sw-reloaded-1241-cohab-keyboard-vinyl-1", "north-sw-reloaded-1241-backup-streaming-1")
    updated = updated.replace("north-sw-reloaded-1242-cohab-request-timeout-1", "north-sw-reloaded-1242-backup-streaming-1")
    if updated != text:
        path.write_text(updated, encoding="utf-8")

mac = ROOT / "native/private-small-phone/XcodeProject/请在Mac编译前先读.md"
text = mac.read_text(encoding="utf-8")
prefix = (
    "# v1242 私人大存档备份流畅修复 iOS356\n\n"
    "当前私人内置源码为 v1242，私人 iOS 仍为 1.0.356 (356)，原生桥仍为 38。完整备份改为直接分段读取存档，"
    "不再为十万级数组先创建完整键表并复制整份状态；每 64 个工作单元检查 8 毫秒预算。网页同源修复为 v1241。"
    "本轮不制作私人覆盖包，Mac 编译、签名和真实 iPhone 仍待验证。\n\n"
)
if not text.startswith("# v1242 "):
    mac.write_text(prefix + text, encoding="utf-8")

print("advanced public web to v1241 and private built-in source to v1242")
