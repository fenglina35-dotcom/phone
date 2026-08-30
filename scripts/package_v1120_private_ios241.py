"""Build and verify the v1120 / private iOS 1.0.241 unified Mac source package."""

from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


template = Path(__file__).with_name("package_v1119_private_ios240.py").read_text(encoding="utf-8")
for old, new in [
    ("v1119", "v1120"),
    ("1119", "1120"),
    ("1.0.240", "1.0.241"),
    ("(240)", "(241)"),
    ("ios240", "ios241"),
    ("iOS240", "iOS241"),
    ("private240", "private241"),
    ("AppIconUpload", "CinemaMicPlayback"),
    ("第二百四十次安装_v1119_图标美化补全_请先读.md", "第二百四十一次安装_v1120_影院开麦连续播放_请先读.md"),
    ("第二百四十次安装", "第二百四十一次安装"),
    ("v1120 · 图标美化补全版", "v1120 · 影院开麦连续播放版"),
    ("CURRENT_PROJECT_VERSION = 240;", "CURRENT_PROJECT_VERSION = 241;"),
]:
    template = template.replace(old, new)
template = template.replace(
    "第二百四十一次安装_v1120_图标美化补全_请先读.md",
    "第二百四十一次安装_v1120_影院开麦连续播放_请先读.md",
)
exec(compile(template, __file__, "exec"))


root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1120-private241-full-final" / "SmallPhone_v1120_CinemaMicPlayback_iOS241_Full_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    guide = next(name for name in names if name.endswith("第二百四十一次安装_v1120_影院开麦连续播放_请先读.md"))
    prefix = guide.split("第二百四十一次安装", 1)[0]
    app = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/app.js").decode("utf-8")
    private_html = archive.read(prefix + "PhoneCompanionTest/PhoneWeb.bundle/小手机.html").decode("utf-8")
    project = archive.read(prefix + "PhoneCompanionTest.xcodeproj/project.pbxproj").decode("utf-8")
    for token in [
        "const APP_VER='v1120 · 影院开麦连续播放版'",
        "function cinemaMicProtectVideo()",
        "micKeepVideoPlaying",
        "v.addEventListener('pause',()=>{sync();cinemaMicProtectVideo();})",
    ]:
        if token not in app:
            raise RuntimeError(f"v1120 cinema microphone playback guard missing: {token}")
    if "window.__NORTH_SHELL_BUILD__='1120'" not in private_html or "app.js?v=1120" not in private_html:
        raise RuntimeError("private HTML build identity is stale")
    if project.count("CURRENT_PROJECT_VERSION = 241;") != 12 or project.count("MARKETING_VERSION = 1.0.241;") != 12:
        raise RuntimeError("private Xcode build identity is stale")

print(f"FINAL_VERIFIED_ZIP={package}")
print(f"FINAL_SIZE={package.stat().st_size}")
print(f"FINAL_SHA256={sha256(package.read_bytes()).hexdigest()}")
