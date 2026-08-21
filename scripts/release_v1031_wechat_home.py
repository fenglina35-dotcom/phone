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


old_title = "v1029 · 真实外卖与角色钱包"
new_title = "v1031 · 微信首页视觉升级"
old_hotfix = "v1029-wechat-home-1"
new_hotfix = "v1031-wechat-home-1"

replace("app.js", "if(window.__NORTH_SHELL_BUILD__!=='1029')", "if(window.__NORTH_SHELL_BUILD__!=='1031')", 1)
replace("app.js", f"const APP_VER='{old_title}';", f"const APP_VER='{new_title}';", 1)
replace("app.js", f"sw.js?v=1029&r={old_hotfix}", f"sw.js?v=1031&r={new_hotfix}", 1)

replace("小手机.html", "window.__NORTH_SHELL_BUILD__='1029'", "window.__NORTH_SHELL_BUILD__='1031'", 1)
replace("小手机.html", "north-sw-reloaded-1029", "north-sw-reloaded-1031", 1)
replace("小手机.html", f"sw.js?v=1029&r={old_hotfix}", f"sw.js?v=1031&r={new_hotfix}", 1)
replace("小手机.html", "?v=1029", "?v=1031", 10)

replace("index.html", "小手机.html?v=1029", "小手机.html?v=1031", 1)
replace("repair.html", "小手机.html?v=1029", "小手机.html?v=1031", 2)
replace("sw.js", "const BUILD='1029';", "const BUILD='1031';", 1)
replace("sw.js", f"const HOTFIX='{old_hotfix}';", f"const HOTFIX='{new_hotfix}';", 1)
replace("sw.js", "const SHELL_CACHE='north-shell-v1029-wechat-home-1';", "const SHELL_CACHE='north-shell-v1031';", 1)
replace("native/private-small-phone/Resources/PhoneWebBundleInfo.plist", "<string>1029</string>", "<string>1031</string>", 1)

for test_path in sorted((ROOT / "tests").glob("*.test.mjs")):
    text = test_path.read_bytes().decode("utf-8")
    original = text
    text = text.replace(old_title, new_title)
    text = text.replace(old_hotfix, new_hotfix)
    text = text.replace("north-shell-v1029-wechat-home-1", "north-shell-v1031")
    text = text.replace("north-shell-v1029", "north-shell-v1031")
    text = text.replace("v1029", "v1031")
    text = text.replace("1029", "1031")
    if text != original:
        test_path.write_bytes(text.encode("utf-8"))

print("Updated shared web to v1031; private iOS remains 1.0.150 (150)")
