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
server = (ROOT / "services/phone-delivery-browser/src/server.mjs").read_text(encoding="utf-8")
edge = (ROOT / "supabase/functions/phone-delivery/index.ts").read_text(encoding="utf-8")

if app.replace("\r\n", "\n") != private_app.replace("\r\n", "\n"):
    raise RuntimeError("root and private app.js are not content-identical")
if delivery.replace("\r\n", "\n") != private_delivery.replace("\r\n", "\n"):
    raise RuntimeError("root and private delivery.js are not content-identical")
for token in [
    "APP_VER='v1065 · 外卖澄清修订连续性修复版';",
    "deliveryTryExplicitApprovalFallback",
    "deliveryTryClarificationFallback",
    "deliveryMissingActionRepairPrompt",
]:
    if token not in app:
        raise RuntimeError(f"v1065 app feature missing: {token}")
for token in [
    "roleRequestIntent",
    "roleRequest",
    "realSearch",
    "createOrder",
    "requestRoleClarification",
    "task.revision=Math.max(1,+task.revision||1);task.orderIntent=nextIntent",
]:
    if token not in delivery:
        raise RuntimeError(f"v1065 delivery feature missing: {token}")
if "/任务|修订|澄清|约束|状态/" not in edge:
    raise RuntimeError("v1065 Edge task-state conflict mapping missing")
if "付款|任务|修订|澄清|约束|状态/" not in server:
    raise RuntimeError("v1065 local server task-state conflict mapping missing")

template = (ROOT / "scripts/package_v1058_private_ios181.py").read_text(encoding="utf-8")
source = (
    template
    .replace("1058", "1065")
    .replace("181", "188")
    .replace("第一百八十一次安装", "第一百八十八次安装")
    .replace("CohabStorageTransferOfflineInput", "DeliveryClarificationRevision")
    .replace("共同生活存储散热转账回复与约会输入修复", "外卖澄清修订连续性修复")
    .replace("共同生活通话、存储散热、转账回复与约会输入修复版", "外卖澄清修订连续性修复版")
)
namespace = {"__file__": str(Path(__file__).resolve()), "__name__": "__main__"}
exec(compile(source, str(Path(__file__).resolve()), "exec"), namespace)
