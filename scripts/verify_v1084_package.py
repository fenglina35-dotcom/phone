from hashlib import sha256
from pathlib import Path
from zipfile import ZipFile


root = Path(__file__).resolve().parents[1]
package = root / "delivery-v1084-private209-final" / "SmallPhone_v1084_SleepLimitClarity_iOS209_MacReady.zip"
with ZipFile(package) as archive:
    names = archive.namelist()
    if len(names) != 181:
        raise RuntimeError(f"unexpected ZIP entry count: {len(names)}")
    if archive.testzip() is not None:
        raise RuntimeError("ZIP integrity test failed")
    if not any(name.endswith("第二百零九次安装_v1084_睡眠来源与限额锁标识_请先读.md") for name in names):
        raise RuntimeError("missing v1084 install readme")
    app_name = next(name for name in names if name.endswith("PhoneWeb.bundle/app.js"))
    project_name = next(name for name in names if name.endswith("PhoneCompanionTest.xcodeproj/project.pbxproj"))
    wellness_name = next(name for name in names if name.endswith("PhoneCompanionTest/CompanionWellnessService.swift"))
    sync_name = next(name for name in names if name.endswith("PhoneCompanionTest/CompanionSyncView.swift"))
    app = archive.read(app_name).decode("utf-8")
    project = archive.read(project_name).decode("utf-8")
    wellness = archive.read(wellness_name).decode("utf-8")
    sync = archive.read(sync_name).decode("utf-8")
    required_app = [
        "const APP_VER='v1084 · 睡眠来源与限额锁标识版'",
        "今日限额已达到",
        "通话陪睡间隔，不等于设备测得的真实睡眠",
        "绝不能说“你睡了这么久”",
        "function roleServerPushCallLeaseRenew",
        "function roleServerPushHandoffAlreadyVisible",
        "kind!=='reply_handoff'",
        "function roleBackgroundLocalReplyActive",
        "!roleBackgroundLocalReplyActive(id,row)",
        "function roleBackgroundResumeForeground",
        "function callVisualHistoryRemember",
        "function roleReplyClockPin",
    ]
    for token in required_app:
        if token not in app:
            raise RuntimeError(f"bundled app fix missing: {token}")
    for token in [
        "latestSleepSession",
        "maximumSessionGap: TimeInterval = 30 * 60",
        "interval.start <= last.end",
    ]:
        if token not in wellness:
            raise RuntimeError(f"bundled sleep fix missing: {token}")
    for token in [
        '"manualLocked": manualLockedTokens.contains(token)',
        '"limitReached": limitLockedTokens.contains(token)',
        "reconcileReachedDailyLimits",
        "usageDay(for: report.generatedAt) == usageDay(for: Date())",
        "usedSeconds >= Double(minutes * 60)",
    ]:
        if token not in sync:
            raise RuntimeError(f"bundled limit fix missing: {token}")
    if "CURRENT_PROJECT_VERSION = 209;" not in project or "MARKETING_VERSION = 1.0.209;" not in project:
        raise RuntimeError("bundled iOS version mismatch")

digest = sha256(package.read_bytes()).hexdigest()
print(f"ZIP={package}")
print(f"FILES={len(names)}")
print(f"SIZE={package.stat().st_size}")
print(f"SHA256={digest}")
print("v1084 package structure, bundled versions, sleep and limit-lock fixes passed")
