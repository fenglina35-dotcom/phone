from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1082-private207-final" / "SmallPhone_v1082_CohabCompanionLiveClock_iOS207_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    if len(names) != 181:
        raise RuntimeError(f"unexpected ZIP entry count: {len(names)}")
    if not any(name.endswith("第二百零七次安装_v1082_共同生活伴生畅通与真实时间复核_请先读.md") for name in names):
        raise RuntimeError("missing v1082 install readme")
    app_name = next(name for name in names if name.endswith("PhoneWeb.bundle/app.js"))
    project_name = next(name for name in names if name.endswith("PhoneCompanionTest.xcodeproj/project.pbxproj"))
    app = archive.read(app_name).decode("utf-8")
    project = archive.read(project_name).decode("utf-8")
    if "const APP_VER='v1082 · 共同生活伴生畅通与真实时间复核版'" not in app:
        raise RuntimeError("bundled app version mismatch")
    if "roleReplyClockPin" not in app or "roleServerPushDeliveryBlocked" not in app:
        raise RuntimeError("bundled v1082 fixes are missing")
    if "CURRENT_PROJECT_VERSION = 207;" not in project or "MARKETING_VERSION = 1.0.207;" not in project:
        raise RuntimeError("bundled iOS version mismatch")

digest = sha256(package.read_bytes()).hexdigest()
print(f"ZIP={package}")
print(f"FILES={len(names)}")
print(f"SIZE={package.stat().st_size}")
print(f"SHA256={digest}")
print("v1082 package structure and bundled versions passed")
