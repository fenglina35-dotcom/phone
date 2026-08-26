"""Build the v1082 / private iOS 1.0.207 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1081_private_ios206.py").read_text(encoding="utf-8")
for old, new in [
    ("v1081", "v1082"),
    ("1081", "1082"),
    ("1.0.206", "1.0.207"),
    ("(206)", "(207)"),
    ("ios206", "ios207"),
    ("iOS206", "iOS207"),
    ("private206", "private207"),
    ("NaturalDeliveryKfcHomepage", "CohabCompanionLiveClock"),
    ("第二百零六次安装_v1082_自然点单与KFC首页套餐_请先读.md", "第二百零七次安装_v1082_共同生活伴生畅通与真实时间复核_请先读.md"),
    ("自然点单解析与KFC首页套餐修复版", "共同生活伴生畅通与真实时间复核版"),
    ("自然点单与KFC首页套餐", "共同生活伴生畅通与真实时间复核"),
    ("CURRENT_PROJECT_VERSION = 206;", "CURRENT_PROJECT_VERSION = 207;"),
]:
    template = template.replace(old, new)

exec(compile(template, __file__, "exec"))
