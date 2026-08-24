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
    "APP_VER='v1062 · 外卖澄清动作与同任务续接修复版';",
    "deliveryCaptureClarificationCandidates",
    "deliveryTryClarificationFallback",
    "replace(/^【\\s*(真实外卖|点外卖)",
]:
    if token not in app:
        raise RuntimeError(f"v1062 app feature missing: {token}")
for token in [
    "captureClarificationCandidates",
    "clarificationCandidatesFromText",
    "tryClarificationFallback",
    "roleRequestIntent",
    "realSearch",
    "createOrder",
]:
    if token not in delivery:
        raise RuntimeError(f"v1062 delivery feature missing: {token}")

template = (ROOT / "scripts/package_v1058_private_ios181.py").read_text(encoding="utf-8")
source = (
    template
    .replace("1058", "1062")
    .replace("181", "185")
    .replace("第一百八十一次安装", "第一百八十五次安装")
    .replace("CohabStorageTransferOfflineInput", "DeliveryClarificationBridge")
    .replace("共同生活存储散热转账回复与约会输入修复", "外卖澄清动作与同任务续接修复")
    .replace("共同生活通话、存储散热、转账回复与约会输入修复版", "外卖澄清动作与同任务续接修复版")
)
namespace = {"__file__": str(Path(__file__).resolve()), "__name__": "__main__"}
exec(compile(source, str(Path(__file__).resolve()), "exec"), namespace)
