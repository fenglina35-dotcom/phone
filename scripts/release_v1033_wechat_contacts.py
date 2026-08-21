from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def replace(path, old, new, expected=None):
    target = ROOT / path
    text = target.read_bytes().decode("utf-8")
    count = text.count(old)
    if expected is not None and count != expected:
        raise RuntimeError(
            f"{path}: expected {expected} occurrences of {old!r}, found {count}"
        )
    if count:
        target.write_bytes(text.replace(old, new).encode("utf-8"))


old_title = "v1032 · 微信聊天视觉升级"
new_title = "v1033 · 微信通讯录与角色管理升级"
old_hotfix = "v1032-wechat-chat-1"
new_hotfix = "v1033-wechat-contacts-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1032')", "if(window.__NORTH_SHELL_BUILD__!=='1033')", 1)
replace("app.js", f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
replace("app.js", f"sw.js?v=1032&r={old_hotfix}", f"sw.js?v=1033&r={new_hotfix}", 1)

replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1032'", "window.__NORTH_SHELL_BUILD__='1033'", 1)
replace("小手机.html", "north-sw-reloaded-1032", "north-sw-reloaded-1033", 1)
replace("小手机.html", f"sw.js?v=1032&r={old_hotfix}", f"sw.js?v=1033&r={new_hotfix}", 1)
replace("小手机.html", "?v=1032", "?v=1033", 10)

replace("index.html", "小手机.html?v=1032", "小手机.html?v=1033", 1)
replace("repair.html", "小手机.html?v=1032", "小手机.html?v=1033", 2)
replace("sw.js", "const BUILD='1032';", "const BUILD='1033';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1032';", "const SHELL_CACHE='north-shell-v1033';", 1)
replace(
    "native/private-small-phone/Resources/PhoneWebBundleInfo.plist",
    "<string>1032</string>",
    "<string>1033</string>",
    1,
)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace("north-shell-v1032", "north-shell-v1033")
    text = text.replace("v1032", "v1033")
    text = text.replace("1032", "1033")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated shared web and private web bundle identity to v1033; private iOS remains 1.0.153 (153), native bridge remains 25")
