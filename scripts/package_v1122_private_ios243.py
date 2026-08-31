"""Build and verify the v1122 / private iOS 1.0.243 unified Mac source package."""

from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


template = Path(__file__).with_name("package_v1121_private_ios242.py").read_text(encoding="utf-8")
for old, new in [
    ("v1121", "v1122"),
    ("1121", "1122"),
    ("1.0.242", "1.0.243"),
    ("(242)", "(243)"),
    ("ios242", "ios243"),
    ("iOS242", "iOS243"),
    ("private242", "private243"),
    ("CloudStatusReliability", "HomeVinylWebBackup"),
    ("第二百四十二次安装_v1121_云状态可信显示_请先读.md", "第二百四十三次安装_v1122_主屏唱片与网页云备份_请先读.md"),
    ("第二百四十二次安装", "第二百四十三次安装"),
    ("v1122 · 云状态可信显示版", "v1122 · 主屏唱片与网页云备份稳定版"),
    ("CURRENT_PROJECT_VERSION = 242;", "CURRENT_PROJECT_VERSION = 243;"),
]:
    template = template.replace(old, new)
template = template.replace(
    "第二百四十三次安装_v1122_云状态可信显示_请先读.md",
    "第二百四十三次安装_v1122_主屏唱片与网页云备份_请先读.md",
)
exec(compile(template, __file__, "exec"))


root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1122-private243-full-final" / "SmallPhone_v1122_HomeVinylWebBackup_iOS243_Full_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    guide = next(name for name in names if name.endswith("第二百四十三次安装_v1122_主屏唱片与网页云备份_请先读.md"))
    prefix = guide.split("第二百四十三次安装", 1)[0]
    app = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/app.js").decode("utf-8")
    css = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/glass-theme.css").decode("utf-8")
    private_html = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/小手机.html").decode("utf-8")
    bridge = archive.read(prefix + "PhoneCompanionTest/PhoneNativeBridge.swift").decode("utf-8")
    webview = archive.read(prefix + "PhoneCompanionTest/LocalPhoneWebView.swift").decode("utf-8")
    project = archive.read(prefix + "PhoneCompanionTest.xcodeproj/project.pbxproj").decode("utf-8")
    for token in [
        "const APP_VER='v1122 · 主屏唱片与网页云备份稳定版'",
        "主屏唱片颜色",
        "立即备份当前网页版",
        "cloudDoBackup()",
        "手机号登录仍保留在本机",
        "cloud-sync-auto-row",
    ]:
        if token not in app:
            raise RuntimeError(f"v1122 visible behavior missing: {token}")
    if "home-vinyl-custom" not in css or "--home-vinyl-color" not in css:
        raise RuntimeError("main-screen vinyl custom color CSS is missing")
    if "privateAccountFailureResult" not in bridge or "account_auth_timeout" not in bridge:
        raise RuntimeError("private phone account timeout classification is missing")
    if "callback.name === 'imgGC'" not in webview or "Number(delay) === 60000" not in webview:
        raise RuntimeError("private automatic image sweep suppression is missing")
    if "window.__NORTH_SHELL_BUILD__='1122'" not in private_html or "app.js?v=1122" not in private_html:
        raise RuntimeError("private HTML build identity is stale")
    if project.count("CURRENT_PROJECT_VERSION = 243;") != 12 or project.count("MARKETING_VERSION = 1.0.243;") != 12:
        raise RuntimeError("private Xcode build identity is stale")

print(f"FINAL_VERIFIED_ZIP={package}")
print(f"FINAL_SIZE={package.stat().st_size}")
print(f"FINAL_SHA256={sha256(package.read_bytes()).hexdigest()}")
