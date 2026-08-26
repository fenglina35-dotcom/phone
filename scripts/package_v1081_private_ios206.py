"""Build the v1081 / private iOS 1.0.206 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1080_private_ios205.py").read_text(encoding="utf-8")
for old, new in [
    ("v1080", "v1081"),
    ("1080", "1081"),
    ("1.0.205", "1.0.206"),
    ("(205)", "(206)"),
    ("ios205", "ios206"),
    ("iOS205", "iOS206"),
    ("private205", "private206"),
    ("RealDeliveryRoleAck", "NaturalDeliveryKfcHomepage"),
    ("第二百零五次安装_v1081_真实外卖角色回执_请先读.md", "第二百零六次安装_v1081_自然点单与KFC首页套餐_请先读.md"),
    ("外卖角色回执真实性修复版", "自然点单解析与KFC首页套餐修复版"),
    ("真实外卖角色回执", "自然点单与KFC首页套餐"),
    ("CURRENT_PROJECT_VERSION = 205;", "CURRENT_PROJECT_VERSION = 206;"),
]:
    template = template.replace(old, new)

exec(compile(template, __file__, "exec"))
