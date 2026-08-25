from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "app.js").read_text(encoding="utf-8")
private_app = (
    ROOT
    / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js"
).read_text(encoding="utf-8")

if app.replace("\r\n", "\n") != private_app.replace("\r\n", "\n"):
    raise RuntimeError("root and private app.js are not content-identical")
for token in [
    "APP_VER='v1066 · 伴生轮询日期格式化卡顿发热修复版';",
    "const _companionUsageDayFormatters=new Map();",
    "privateNativeAppOn())return local",
    "_companionUsageDayFormatters.get(zone)",
    "deliveryTryExplicitApprovalFallback",
    "remoteControlRoleReaction",
]:
    if token not in app:
        raise RuntimeError(f"v1066 feature or protected route missing: {token}")

template = (ROOT / "scripts/package_v1058_private_ios181.py").read_text(encoding="utf-8")
source = (
    template
    .replace("1058", "1066")
    .replace("181", "189")
    .replace("第一百八十一次安装", "第一百八十九次安装")
    .replace("CohabStorageTransferOfflineInput", "CompanionDateFormatterThermal")
    .replace("共同生活存储散热转账回复与约会输入修复", "伴生轮询日期格式化卡顿发热修复")
    .replace("共同生活通话、存储散热、转账回复与约会输入修复版", "伴生轮询日期格式化卡顿发热修复版")
)
namespace = {"__file__": str(Path(__file__).resolve()), "__name__": "__main__"}
exec(compile(source, str(Path(__file__).resolve()), "exec"), namespace)
