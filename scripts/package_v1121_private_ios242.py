"""Build and verify the v1121 / private iOS 1.0.242 unified Mac source package."""

from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


template = Path(__file__).with_name("package_v1120_private_ios241.py").read_text(encoding="utf-8")
for old, new in [
    ("v1120", "v1121"),
    ("1120", "1121"),
    ("1.0.241", "1.0.242"),
    ("(241)", "(242)"),
    ("ios241", "ios242"),
    ("iOS241", "iOS242"),
    ("private241", "private242"),
    ("CinemaMicPlayback", "CloudStatusReliability"),
    ("第二百四十一次安装_v1120_影院开麦连续播放_请先读.md", "第二百四十二次安装_v1121_云状态可信显示_请先读.md"),
    ("第二百四十一次安装", "第二百四十二次安装"),
    ("v1121 · 影院开麦连续播放版", "v1121 · 云状态可信显示版"),
    ("CURRENT_PROJECT_VERSION = 241;", "CURRENT_PROJECT_VERSION = 242;"),
]:
    template = template.replace(old, new)
template = template.replace(
    "第二百四十二次安装_v1121_影院开麦连续播放_请先读.md",
    "第二百四十二次安装_v1121_云状态可信显示_请先读.md",
)
exec(compile(template, __file__, "exec"))


root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1121-private242-full-final" / "SmallPhone_v1121_CloudStatusReliability_iOS242_Full_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    guide = next(name for name in names if name.endswith("第二百四十二次安装_v1121_云状态可信显示_请先读.md"))
    prefix = guide.split("第二百四十二次安装", 1)[0]
    app = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/app.js").decode("utf-8")
    private_html = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/小手机.html").decode("utf-8")
    project = archive.read(prefix + "PhoneCompanionTest.xcodeproj/project.pbxproj").decode("utf-8")
    for token in [
        "const APP_VER='v1121 · 云状态可信显示版'",
        "backupLabel=a.error?'暂时无法确认'",
        "['contact','contactInfo','roleFeatures'].includes(page.p)",
        "onclick=\"privatePhoneCloudBackup(false)\">立即备份本机",
        "网页版不会反向覆盖私人 App",
    ]:
        if token not in app:
            raise RuntimeError(f"v1121 cloud status safety guard missing: {token}")
    if "window.__NORTH_SHELL_BUILD__='1121'" not in private_html or "app.js?v=1121" not in private_html:
        raise RuntimeError("private HTML build identity is stale")
    if project.count("CURRENT_PROJECT_VERSION = 242;") != 12 or project.count("MARKETING_VERSION = 1.0.242;") != 12:
        raise RuntimeError("private Xcode build identity is stale")

print(f"FINAL_VERIFIED_ZIP={package}")
print(f"FINAL_SIZE={package.stat().st_size}")
print(f"FINAL_SHA256={sha256(package.read_bytes()).hexdigest()}")
