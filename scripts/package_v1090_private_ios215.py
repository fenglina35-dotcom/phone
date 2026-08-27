"""Build the v1090 / private iOS 1.0.215 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1090"),
    ("1071", "1090"),
    ("1.0.195", "1.0.215"),
    ("(195)", "(215)"),
    ("ios195", "ios215"),
    ("iOS195", "iOS215"),
    ("private195", "private215"),
    ("CompleteWeChatBundle", "NaturalDeliveryCommitment"),
    (
        "第一百九十五次安装_v1090_私人App_完整微信Bundle_请先读.md",
        "第二百一十五次安装_v1090_自然外卖承诺执行修复_请先读.md",
    ),
    ("v1090 · 私人App完整微信Bundle修复版", "v1090 · 自然外卖承诺执行修复版"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 215;"),
]:
    template = template.replace(old, new)
template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")
template = template.replace(
    '"remoteControlRoleReaction",',
    '"remoteControlRoleReaction",\n        "deliveryMissingActionRetryPrompt(id,_userText,content,_deliveryRepair,_deliveryActionMeta)",\n        "deliveryReportActionRepairFailure(id,_userText,content,_deliveryActionMeta)",',
)
template = template.replace(
    '    shell_text = (bundle / "index.html").read_text(encoding="utf-8")',
    '    delivery_text = (bundle / "delivery.js").read_text(encoding="utf-8")\n'
    '    for token in ["function delegatedChoiceIntent", "function roleCommittedToDelivery", "function missingActionRetryPrompt", "window.deliveryReportActionRepairFailure=reportActionRepairFailure"]:\n'
    '        if token not in delivery_text:\n'
    '            raise RuntimeError(f"protected delivery route missing: {token}")\n\n'
    '    shell_text = (bundle / "index.html").read_text(encoding="utf-8")',
)
exec(compile(template, __file__, "exec"))
