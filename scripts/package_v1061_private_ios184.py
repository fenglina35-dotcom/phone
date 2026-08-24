from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "app.js").read_text(encoding="utf-8")
private_app = (
    ROOT
    / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js"
).read_text(encoding="utf-8")
delivery = (ROOT / "delivery.js").read_text(encoding="utf-8")
private_delivery = (
    ROOT
    / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/delivery.js"
).read_text(encoding="utf-8")
if app.replace("\r\n", "\n") != private_app.replace("\r\n", "\n"):
    raise RuntimeError("root and private app.js are not content-identical")
if delivery.replace("\r\n", "\n") != private_delivery.replace("\r\n", "\n"):
    raise RuntimeError("root and private delivery.js are not content-identical")
for token in [
    "_deliveryActionMeta",
    "deliveryTryClarificationFallback",
    "deliveryMissingActionRepairPrompt",
    "外卖同意直传与角色自主发起修复版",
]:
    if token not in app:
        raise RuntimeError(f"v1061 app feature missing: {token}")
for token in [
    "roleActionRepairTurns",
    "missingActionRepairPrompt",
    "tryClarificationFallback",
    "roleRequestIntent",
    "realSearch",
    "createOrder",
]:
    if token not in delivery:
        raise RuntimeError(f"v1061 delivery feature missing: {token}")

template = (ROOT / "scripts/package_v1058_private_ios181.py").read_text(encoding="utf-8")
source = (
    template
    .replace("1058", "1061")
    .replace("181", "184")
    .replace("第一百八十一次安装", "第一百八十四次安装")
    .replace("CohabStorageTransferOfflineInput", "DeliveryConsentAutonomy")
    .replace("共同生活存储散热转账回复与约会输入修复", "外卖同意直传与角色自主发起修复")
    .replace("共同生活通话、存储散热、转账回复与约会输入修复版", "外卖同意直传与角色自主发起修复版")
)
namespace = {"__file__": str(Path(__file__).resolve()), "__name__": "__main__"}
exec(compile(source, str(Path(__file__).resolve()), "exec"), namespace)
