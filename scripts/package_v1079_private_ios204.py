"""Build the v1079 / private iOS 1.0.204 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1071_private_ios195.py").read_text(encoding="utf-8")
for old, new in [
    ("v1071", "v1079"),
    ("1071", "1079"),
    ("1.0.195", "1.0.204"),
    ("(195)", "(204)"),
    ("ios195", "ios204"),
    ("iOS195", "iOS204"),
    ("private195", "private204"),
    ("CompleteWeChatBundle", "PhotoTextCardPointsCoupon"),
    ("第一百九十五次安装_v1079_私人App_完整微信Bundle_请先读.md", "第二百零四次安装_v1079_图文照片卡与吃货豆红包_请先读.md"),
    ("私人App完整微信Bundle修复版", "图文照片卡与吃货豆红包修复版"),
    ("完整微信Bundle", "图文照片卡与吃货豆红包"),
    ("CURRENT_PROJECT_VERSION = 195;", "CURRENT_PROJECT_VERSION = 204;"),
]:
    template = template.replace(old, new)

exec(compile(template, __file__, "exec"))
