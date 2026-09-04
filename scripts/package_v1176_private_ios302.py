from pathlib import Path


template_path = Path(__file__).with_name("package_v1168_private_ios295.py")
code = template_path.read_text(encoding="utf-8")

public_guard = '''public_paths = ["app.js", "index.html", "小手机.html", "sw.js", "manifest.webmanifest"]
if git("diff", "--quiet", "--", *public_paths, check=False).returncode != 0:
    raise RuntimeError("public web files changed during a private-only release")
'''
shared_guard = '''public_paths = ["app.js", "index.html", "小手机.html", "sw.js", "manifest.webmanifest"]
# v1176 is a reviewed shared release. The same web tree is published separately.
'''

replacements = [
    (public_guard, shared_guard),
    ("第二百九十五次安装_v1168_私人性能链继承修复_请先读.md", "第三百零二次安装_v1176_多人剧场退场署名保留_请先读.md"),
    ("delivery-v1168-private295-performance-inheritance-candidate", "delivery-v1176-private302-cohab-history-names-release"),
    ("SmallPhone_v1168_PrivatePerformanceInheritance_iOS295_MacReady", "SmallPhone_v1176_CohabHistoryNames_iOS302_MacReady"),
    ("小手机_v1168_私人版_iOS295_私人性能链继承修复_Mac待编译源码包.zip", "小手机_v1176_私人版_iOS302_多人剧场退场署名保留_Mac待编译源码包.zip"),
    ("EXPECTED_BUNDLE_FILES = 148", "EXPECTED_BUNDLE_FILES = 150"),
    ("EXPECTED_PACKAGE_FILES = 188", "EXPECTED_PACKAGE_FILES = 190"),
    ("APP_VER='v1167 · 心动审判共同生活记忆修复版'", "APP_VER='v1176 · 多人剧场退场署名保留版'"),
    ("public web baseline is no longer v1167", "public web candidate is no longer v1176"),
    ("smallphone-v1168-ios295-", "smallphone-v1176-ios302-"),
    ("scope=private-only", "scope=shared-release"),
    ("public-web=v1167 (unchanged)", "public-web=v1176 (release-source)"),
    ("private-web=v1168", "private-web=v1176"),
    ("ios=1.0.295 (295)", "ios=1.0.302 (302)"),
    ("window.__NORTH_SHELL_BUILD__='1168'", "window.__NORTH_SHELL_BUILD__='1176'"),
    ("app.js?v=1168&r=v1168-private-performance-inheritance-1", "app.js?v=1176&r=v1176-cohab-theater-history-names-1"),
    ("private-runtime-diagnostics.js?v=295", "private-runtime-diagnostics.js?v=302"),
    ("index.html?repair=1&v=1168", "index.html?repair=1&v=1176"),
    ("APP_VER='v1168 · 私人性能链继承修复版';", "APP_VER='v1176 · 多人剧场退场署名保留版';"),
    (
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/heart-quiz.js",\n',
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/heart-quiz.js",\n'
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/private-reply-intercept.js",\n'
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/cohab-theater.js",\n',
    ),
    (
        '            "private-runtime-diagnostics.js?v=302",\n',
        '            "private-runtime-diagnostics.js?v=302",\n'
        '            "private-reply-intercept.js?v=1176&r=v1176-private-intercept-parity-1",\n'
        '            "cohab-theater.js?v=1176&r=v1176-cohab-theater-history-names-1",\n',
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
        '    intercept = (bundle / "private-reply-intercept.js").read_text(encoding="utf-8")\n'
        '    require_tokens(intercept, ["v1176-private-intercept-parity-1", "查看上一轮拦截内容", "function turnCandidate"], "private reply intercept")\n\n'
        '    theater = (bundle / "cohab-theater.js").read_text(encoding="utf-8")\n'
        '    require_tokens(theater, ["v1176-cohab-theater-history-names-1", "castHistory", "keepCastName", "cohabTheaterGuestWechat", "_cohabGuestExitEpisodeId"], "cohab theater")\n\n'
        '    overlay = (bundle / "private-runtime-diagnostics.js").read_text(encoding="utf-8")\n',
    ),
    ("295-private-performance-inheritance-v1", "302-cohab-history-names-v1"),
    ("CURRENT_PROJECT_VERSION = 295;", "CURRENT_PROJECT_VERSION = 302;"),
    ("private build 295", "private build 302"),
    ("MARKETING_VERSION = 1.0.295;", "MARKETING_VERSION = 1.0.302;"),
    ("private version 1.0.295", "private version 1.0.302"),
    ('private static let build = "1.0.295 (295)"', 'private static let build = "1.0.302 (302)"'),
    ('            "1.0.295 (295)",', '            "1.0.302 (302)",'),
    ("smallPhone.webContentTerminationTimes.v6.build295", "smallPhone.webContentTerminationTimes.v12.build302"),
    ('["v1168", "1.0.295 (295)",', '["v1176", "1.0.302 (302)",'),
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
