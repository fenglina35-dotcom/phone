from pathlib import Path


template_path = Path(__file__).with_name("package_v1168_private_ios295.py")
code = template_path.read_text(encoding="utf-8")

replacements = [
    (
        "第二百九十五次安装_v1168_私人性能链继承修复_请先读.md",
        "第二百九十七次安装_v1170_真人好友入口解耦修复_请先读.md",
    ),
    (
        "delivery-v1168-private295-performance-inheritance-candidate",
        "delivery-v1170-private297-phone-friend-entry-decouple-candidate",
    ),
    (
        "SmallPhone_v1168_PrivatePerformanceInheritance_iOS295_MacReady",
        "SmallPhone_v1170_PhoneFriendEntryDecouple_iOS297_MacReady",
    ),
    (
        "小手机_v1168_私人版_iOS295_私人性能链继承修复_Mac待编译源码包.zip",
        "小手机_v1170_私人版_iOS297_真人好友入口解耦修复_Mac待编译源码包.zip",
    ),
    (
        "APP_VER='v1167 · 心动审判共同生活记忆修复版'",
        "APP_VER='v1169 · 心动审判逐题补齐版'",
    ),
    ("public web baseline is no longer v1167", "public web baseline is no longer v1169"),
    ("smallphone-v1168-ios295-", "smallphone-v1170-ios297-"),
    ("public-web=v1167 (unchanged)", "public-web=v1169 (unchanged)"),
    ("private-web=v1168\\nios=1.0.295 (295)", "private-web=v1170\\nios=1.0.297 (297)"),
    ("window.__NORTH_SHELL_BUILD__='1168'", "window.__NORTH_SHELL_BUILD__='1170'"),
    (
        "app.js?v=1168&r=v1168-private-performance-inheritance-1",
        "app.js?v=1170&r=v1170-phone-friend-entry-decouple-1",
    ),
    ("private-runtime-diagnostics.js?v=295", "private-runtime-diagnostics.js?v=297"),
    ("index.html?repair=1&v=1168", "index.html?repair=1&v=1170"),
    (
        "APP_VER='v1168 · 私人性能链继承修复版';",
        "APP_VER='v1170 · 真人好友入口解耦修复版';",
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
    ("295-private-performance-inheritance-v1", "297-phone-friend-entry-decouple-v1"),
    ("CURRENT_PROJECT_VERSION = 295;", "CURRENT_PROJECT_VERSION = 297;"),
    ("private build 295", "private build 297"),
    ("MARKETING_VERSION = 1.0.295;", "MARKETING_VERSION = 1.0.297;"),
    ("private version 1.0.295", "private version 1.0.297"),
    ('private static let build = "1.0.295 (295)"', 'private static let build = "1.0.297 (297)"'),
    ('            "1.0.295 (295)",', '            "1.0.297 (297)",'),
    ("smallPhone.webContentTerminationTimes.v6.build295", "smallPhone.webContentTerminationTimes.v8.build297"),
    ('["v1168", "1.0.295 (295)",', '["v1170", "1.0.297 (297)",'),
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
