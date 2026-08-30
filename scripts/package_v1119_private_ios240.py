"""Build and verify the v1119 / private iOS 1.0.240 unified Mac source package."""

from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


template = Path(__file__).with_name("package_v1118_private_ios239.py").read_text(encoding="utf-8")
for old, new in [
    ("v1118", "v1119"),
    ("1118", "1119"),
    ("1.0.239", "1.0.240"),
    ("(239)", "(240)"),
    ("ios239", "ios240"),
    ("iOS239", "iOS240"),
    ("private239", "private240"),
    ("InteractionRoleLock", "AppIconUpload"),
    ("第二百三十九次安装_v1118_交互与角色锁定稳定_请先读.md", "第二百四十次安装_v1119_图标美化补全_请先读.md"),
    ("第二百三十九次安装", "第二百四十次安装"),
    ("v1119 · 交互与角色锁定稳定版", "v1119 · 图标美化补全版"),
    ("CURRENT_PROJECT_VERSION = 239;", "CURRENT_PROJECT_VERSION = 240;"),
]:
    template = template.replace(old, new)
template = template.replace(
    "第二百四十次安装_v1119_交互与角色锁定稳定_请先读.md",
    "第二百四十次安装_v1119_图标美化补全_请先读.md",
)
exec(compile(template, __file__, "exec"))


root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1119-private240-full-final" / "SmallPhone_v1119_AppIconUpload_iOS240_Full_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    guide = next(name for name in names if name.endswith("第二百四十次安装_v1119_图标美化补全_请先读.md"))
    prefix = guide.split("第二百四十次安装", 1)[0]
    app = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/app.js").decode("utf-8")
    private_html = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/小手机.html").decode("utf-8")
    project = archive.read(prefix + "PhoneCompanionTest.xcodeproj/project.pbxproj").decode("utf-8")
    for token in [
        "const APP_VER='v1119 · 图标美化补全版'",
        "['tale','🕯️','规则怪谈']",
        "['dread','🩸','惊悚抉择']",
        "function appIconEditor()",
        "function setAppIcon(key)",
    ]:
        if token not in app:
            raise RuntimeError(f"v1119 icon upload feature missing: {token}")
    if "window.__NORTH_SHELL_BUILD__='1119'" not in private_html or "app.js?v=1119" not in private_html:
        raise RuntimeError("private HTML build identity is stale")
    if project.count("CURRENT_PROJECT_VERSION = 240;") != 12 or project.count("MARKETING_VERSION = 1.0.240;") != 12:
        raise RuntimeError("private Xcode build identity is stale")

print(f"FINAL_VERIFIED_ZIP={package}")
print(f"FINAL_SIZE={package.stat().st_size}")
print(f"FINAL_SHA256={sha256(package.read_bytes()).hexdigest()}")
