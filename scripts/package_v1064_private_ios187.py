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
adapter = (
    ROOT / "services/phone-delivery-browser/src/taobao-flash-browser.mjs"
).read_text(encoding="utf-8")
edge = (ROOT / "supabase/functions/phone-delivery/index.ts").read_text(encoding="utf-8")

if app.replace("\r\n", "\n") != private_app.replace("\r\n", "\n"):
    raise RuntimeError("root and private app.js are not content-identical")
if delivery.replace("\r\n", "\n") != private_delivery.replace("\r\n", "\n"):
    raise RuntimeError("root and private delivery.js are not content-identical")
for token in [
    "APP_VER='v1064 · 外卖澄清续单与网关恢复版';",
    "deliveryTryExplicitApprovalFallback",
    "deliveryTryClarificationFallback",
    "deliveryMissingActionRepairPrompt",
]:
    if token not in app:
        raise RuntimeError(f"v1064 app feature missing: {token}")
for token in [
    "explicitApprovedOrderIntent",
    "tryExplicitApprovalFallback",
    "roleRequestIntent",
    "realSearch",
    "createOrder",
]:
    if token not in delivery:
        raise RuntimeError(f"v1064 delivery feature missing: {token}")
for token in ["followingAmounts", "explicitlyBelowMinimum", "addRequestedStandaloneItems"]:
    if token not in adapter:
        raise RuntimeError(f"v1064 browser adapter feature missing: {token}")
for token in ["transientGateway", '"create_order"', '"pay_order"']:
    if token not in edge:
        raise RuntimeError(f"v1064 gateway feature missing: {token}")

template = (ROOT / "scripts/package_v1058_private_ios181.py").read_text(encoding="utf-8")
source = (
    template
    .replace("1058", "1064")
    .replace("181", "187")
    .replace("第一百八十一次安装", "第一百八十七次安装")
    .replace("CohabStorageTransferOfflineInput", "DeliveryClarificationGateway")
    .replace("共同生活存储散热转账回复与约会输入修复", "外卖澄清续单与网关恢复")
    .replace("共同生活通话、存储散热、转账回复与约会输入修复版", "外卖澄清续单与网关恢复版")
)
namespace = {"__file__": str(Path(__file__).resolve()), "__name__": "__main__"}
exec(compile(source, str(Path(__file__).resolve()), "exec"), namespace)
