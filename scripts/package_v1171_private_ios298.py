from pathlib import Path


template_path = Path(__file__).with_name("package_v1168_private_ios295.py")
code = template_path.read_text(encoding="utf-8")

replacements = [
    ("第二百九十五次安装_v1168_私人性能链继承修复_请先读.md", "第二百九十八次安装_v1171_共同生活多人剧场_请先读.md"),
    ("delivery-v1168-private295-performance-inheritance-candidate", "delivery-v1171-private298-cohab-theater-candidate"),
    ("SmallPhone_v1168_PrivatePerformanceInheritance_iOS295_MacReady", "SmallPhone_v1171_CohabTheater_iOS298_MacReady"),
    ("小手机_v1168_私人版_iOS295_私人性能链继承修复_Mac待编译源码包.zip", "小手机_v1171_私人版_iOS298_共同生活多人剧场_Mac待编译源码包.zip"),
    ("EXPECTED_BUNDLE_FILES = 148", "EXPECTED_BUNDLE_FILES = 149"),
    ("EXPECTED_PACKAGE_FILES = 188", "EXPECTED_PACKAGE_FILES = 189"),
    ("APP_VER='v1167 · 心动审判共同生活记忆修复版'", "APP_VER='v1171 · 共同生活多人剧场版'"),
    ("public web baseline is no longer v1167", "public web candidate is no longer v1171"),
    ("public web files changed during a private-only release", "shared v1171 source changed after review"),
    ("smallphone-v1168-ios295-", "smallphone-v1171-ios298-"),
    ("scope=private-only", "scope=shared-candidate-private-delivery"),
    ("public-web=v1167 (unchanged)", "public-web=v1171 (candidate-not-uploaded)"),
    ("private-web=v1168", "private-web=v1171"),
    ("ios=1.0.295 (295)", "ios=1.0.298 (298)"),
    ("window.__NORTH_SHELL_BUILD__='1168'", "window.__NORTH_SHELL_BUILD__='1171'"),
    ("app.js?v=1168&r=v1168-private-performance-inheritance-1", "app.js?v=1171&r=v1171-cohab-theater-1"),
    ("private-runtime-diagnostics.js?v=295", "private-runtime-diagnostics.js?v=298"),
    ("index.html?repair=1&v=1168", "index.html?repair=1&v=1171"),
    ("APP_VER='v1168 · 私人性能链继承修复版';", "APP_VER='v1171 · 共同生活多人剧场版';"),
    (
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/heart-quiz.js",\n',
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/heart-quiz.js",\n'
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/cohab-theater.js",\n',
    ),
    (
        '            "private-runtime-diagnostics.js?v=298",\n',
        '            "private-runtime-diagnostics.js?v=298",\n'
        '            "cohab-theater.js?v=1171&r=v1171-cohab-theater-1",\n',
    ),
    (
        '            "function northNativeMaintenancePaused()",\n',
        '            "function northNativeMaintenancePaused()",\n'
        '            "function pfEnsureForSync",\n'
        '            "function pfProfileRefreshSoon",\n'
        '            "function pfReadAckDrain",\n'
        '            "const _pfFriendRenderLimit",\n'
        '            "function phoneFriendChatShowEarlier",\n',
    ),
    ("while(out.length<HEART_QUIZ_TOTAL&&calls<10)", "while(out.length<HEART_QUIZ_TOTAL&&batch<12)"),
    (
        '            "正在分批准备审判",\n',
        '            "while(out.length<HEART_QUIZ_TOTAL&&single<singleLimit",\n'
        '            "function heartQuizDiagText",\n'
        '            "心动审判逐题补齐",\n',
    ),
    (
        '    overlay = (bundle / "private-runtime-diagnostics.js").read_text(encoding="utf-8")\n',
        '    theater = (bundle / "cohab-theater.js").read_text(encoding="utf-8")\n'
        '    require_tokens(theater, ["v1171-cohab-theater-1", "cohabTheaterSummarizeEpisode", "cohab-theater-bar"], "cohab theater")\n\n'
        '    overlay = (bundle / "private-runtime-diagnostics.js").read_text(encoding="utf-8")\n',
    ),
    ("295-private-performance-inheritance-v1", "298-cohab-theater-v1"),
    ("CURRENT_PROJECT_VERSION = 295;", "CURRENT_PROJECT_VERSION = 298;"),
    ("private build 295", "private build 298"),
    ("MARKETING_VERSION = 1.0.295;", "MARKETING_VERSION = 1.0.298;"),
    ("private version 1.0.295", "private version 1.0.298"),
    ('private static let build = "1.0.295 (295)"', 'private static let build = "1.0.298 (298)"'),
    ('            "1.0.295 (295)",', '            "1.0.298 (298)",'),
    ("smallPhone.webContentTerminationTimes.v6.build295", "smallPhone.webContentTerminationTimes.v8.build298"),
    ('["v1168", "1.0.295 (295)",', '["v1171", "1.0.298 (298)",'),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"packaging template token missing: {old}")
    code = code.replace(old, new)

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
