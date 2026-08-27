"""Build the v1084 / private iOS 1.0.209 unified Mac source package."""

from pathlib import Path


template = Path(__file__).with_name("package_v1083_private_ios208.py").read_text(encoding="utf-8")
for old, new in [
    ("v1083", "v1084"),
    ("1083", "1084"),
    ("1.0.208", "1.0.209"),
    ("(208)", "(209)"),
    ("ios208", "ios209"),
    ("iOS208", "iOS209"),
    ("private208", "private209"),
    ("CallBackgroundQuiet", "SleepLimitClarity"),
    ("第二百零八次安装_v1084_通话后台静默与挂断重计时_请先读.md", "第二百零九次安装_v1084_睡眠来源与限额锁标识_请先读.md"),
    ("通话后台静默与挂断重计时版", "睡眠来源与限额锁标识版"),
    ("通话后台静默与挂断重计时", "睡眠来源与限额锁标识"),
    ("CURRENT_PROJECT_VERSION = 208;", "CURRENT_PROJECT_VERSION = 209;"),
]:
    template = template.replace(old, new)

exec(compile(template, __file__, "exec"))
