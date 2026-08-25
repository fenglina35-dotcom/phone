"""Build the v1075 / private iOS 1.0.200 role-wardrobe hard-lock package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1075"),
    ("1071", "1075"),
    ("1.0.195", "1.0.200"),
    ("(195)", "(200)"),
    ("ios195", "ios200"),
    ("iOS195", "iOS200"),
    ("PRIVATE195", "PRIVATE200"),
    ("private195", "private200"),
    ("构建 195", "构建 200"),
    ("第一百九十五", "第二百"),
    ("私人App完整微信Bundle修复版", "角色衣柜强制锁定版"),
    ("完整微信Bundle", "角色衣柜强制锁定"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 200;"),
]:
    template = template.replace(old, new)

template = template.replace("if existing != [ZIP_PATH]:", "if existing and existing != [ZIP_PATH]:")

exec(compile(template, __file__, "exec"))
