"""Build the v1080 / private iOS 1.0.205 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1079_private_ios204.py").read_text(encoding="utf-8")
for old, new in [
    ("v1079", "v1080"),
    ("1079", "1080"),
    ("1.0.204", "1.0.205"),
    ("(204)", "(205)"),
    ("ios204", "ios205"),
    ("iOS204", "iOS205"),
    ("private204", "private205"),
    ("PhotoTextCardPointsCoupon", "RealDeliveryRoleAck"),
    ("第二百零四次安装_v1080_图文照片卡与吃货豆红包_请先读.md", "第二百零五次安装_v1080_真实外卖角色回执_请先读.md"),
    ("图文照片卡与吃货豆红包修复版", "外卖角色回执真实性修复版"),
    ("图文照片卡与吃货豆红包", "真实外卖角色回执"),
    ("CURRENT_PROJECT_VERSION = 204;", "CURRENT_PROJECT_VERSION = 205;"),
]:
    template = template.replace(old, new)

exec(compile(template, __file__, "exec"))
