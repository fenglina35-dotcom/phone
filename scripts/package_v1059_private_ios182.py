from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
delivery = (ROOT / "delivery.js").read_text(encoding="utf-8")
private_delivery = (
    ROOT
    / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/delivery.js"
).read_text(encoding="utf-8")
if delivery.replace("\r\n", "\n") != private_delivery.replace("\r\n", "\n"):
    raise RuntimeError("root and private delivery.js are not content-identical")
for token in [
    "roleRequestIntent",
    "roleRequest",
    "realSearch",
    "createOrder",
    "requestRoleClarification",
    "clarificationFirstMatch",
]:
    if token not in delivery:
        raise RuntimeError(f"v1059 delivery feature missing: {token}")

template = (ROOT / "scripts/package_v1058_private_ios181.py").read_text(encoding="utf-8")
source = (
    template
    .replace("1058", "1059")
    .replace("181", "182")
    .replace("第一百八十一次安装", "第一百八十二次安装")
    .replace("CohabStorageTransferOfflineInput", "DeliveryLifeIntegration")
    .replace("共同生活存储散热转账回复与约会输入修复", "真实外卖匹配与生活功能整合修复")
    .replace("共同生活通话、存储散热、转账回复与约会输入修复版", "真实外卖匹配与生活功能整合修复版")
)
namespace = {"__file__": str(Path(__file__).resolve()), "__name__": "__main__"}
exec(compile(source, str(Path(__file__).resolve()), "exec"), namespace)
