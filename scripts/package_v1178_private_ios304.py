from pathlib import Path


template_path = Path(__file__).with_name("package_v1168_private_ios295.py")
code = template_path.read_text(encoding="utf-8")

public_guard = '''public_paths = ["app.js", "index.html", "小手机.html", "sw.js", "manifest.webmanifest"]
if git("diff", "--quiet", "--", *public_paths, check=False).returncode != 0:
    raise RuntimeError("public web files changed during a private-only release")
'''
shared_guard = '''public_paths = ["app.js", "index.html", "小手机.html", "sw.js", "manifest.webmanifest"]
# v1178 is a reviewed shared candidate. This command packages only the private source archive.
'''

replacements = [
    (public_guard, shared_guard),
    ("第二百九十五次安装_v1168_私人性能链继承修复_请先读.md", "第三百零四次安装_v1178_像素拼拼乐_请先读.md"),
    ("delivery-v1168-private295-performance-inheritance-candidate", "delivery-v1178-private304-pixel-puzzle-candidate"),
    ("SmallPhone_v1168_PrivatePerformanceInheritance_iOS295_MacReady", "SmallPhone_v1178_PixelPuzzle_iOS304_MacReady"),
    ("小手机_v1168_私人版_iOS295_私人性能链继承修复_Mac待编译源码包.zip", "小手机_v1178_私人版_iOS304_像素拼拼乐_Mac待编译源码包.zip"),
    ("EXPECTED_BUNDLE_FILES = 148", "EXPECTED_BUNDLE_FILES = 151"),
    ("EXPECTED_PACKAGE_FILES = 188", "EXPECTED_PACKAGE_FILES = 191"),
    ("APP_VER='v1167 · 心动审判共同生活记忆修复版'", "APP_VER='v1178 · 像素拼拼乐版'"),
    ("public web baseline is no longer v1167", "public web candidate is no longer v1178"),
    ("smallphone-v1168-ios295-", "smallphone-v1178-ios304-"),
    ("scope=private-only", "scope=shared-private-package"),
    ("public-web=v1167 (unchanged)", "public-web=v1178 (not-uploaded)"),
    ("private-web=v1168", "private-web=v1178"),
    ("ios=1.0.295 (295)", "ios=1.0.304 (304)"),
    ("window.__NORTH_SHELL_BUILD__='1168'", "window.__NORTH_SHELL_BUILD__='1178'"),
    ("app.js?v=1168&r=v1168-private-performance-inheritance-1", "app.js?v=1178&r=v1178-pixel-puzzle-1"),
    ("private-runtime-diagnostics.js?v=295", "private-runtime-diagnostics.js?v=304"),
    ("index.html?repair=1&v=1168", "index.html?repair=1&v=1178"),
    ("APP_VER='v1168 · 私人性能链继承修复版';", "APP_VER='v1178 · 像素拼拼乐版';"),
    (
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/heart-quiz.js",\n',
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/heart-quiz.js",\n'
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/private-reply-intercept.js",\n'
        '    SOURCE / "PhoneCompanionTest/PhoneWeb.bundle/cohab-theater.js",\n',
    ),
    (
        '            "private-runtime-diagnostics.js?v=304",\n',
        '            "private-runtime-diagnostics.js?v=304",\n'
        '            "private-reply-intercept.js?v=1178&r=v1178-private-intercept-parity-1",\n'
        '            "cohab-theater.js?v=1178&r=v1178-pixel-puzzle-1",\n'
        '            "bead-studio.js?v=1178&r=v1178-pixel-puzzle-1",\n'
        '            "delivery.js?v=1178",\n',
    ),
    (
        '            "function northNativeMaintenancePaused()",\n',
        '            "function northNativeMaintenancePaused()",\n'
        '            "function pfEnsureForSync",\n'
        '            "function pfProfileRefreshSoon",\n'
        '            "function pfReadAckDrain",\n'
        '            "const _pfFriendRenderLimit",\n'
        '            "function phoneFriendChatShowEarlier",\n'
        '            "function roleServerConversationSnapshot",\n',
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
        '    require_tokens(intercept, ["v1178-private-intercept-parity-1", "查看上一轮拦截内容", "function turnCandidate"], "private reply intercept")\n\n'
        '    theater = (bundle / "cohab-theater.js").read_text(encoding="utf-8")\n'
        '    require_tokens(theater, ["v1178-pixel-puzzle-1", "_theaterTurnTargets", "addressNameSnapshot", "cohabTheaterGuestWechat", "_cohabGuestExitEpisodeId"], "cohab theater")\n\n'
        '    bead = (bundle / "bead-studio.js").read_text(encoding="utf-8")\n'
        '    require_tokens(bead, ["v1178-pixel-puzzle-1", "像素拼拼乐", "function beadRolePlan", "主体＋背景", "1–100 格"], "pixel puzzle")\n'
        '    planner = bead[bead.index("function beadRolePlan"):bead.index("function beadRoleTurn")]\n'
        '    if "chatAPI" in planner:\n'
        '        raise RuntimeError("pixel puzzle local role planner unexpectedly calls the model")\n\n'
        '    delivery = (bundle / "delivery.js").read_text(encoding="utf-8")\n'
        '    require_tokens(delivery, ["用户明确要求的每一件商品都是不可遗漏的清单项", "如果用户没有说套餐而是逐项点名多个单品"], "delivery explicit list")\n\n'
        '    overlay = (bundle / "private-runtime-diagnostics.js").read_text(encoding="utf-8")\n',
    ),
    ("295-private-performance-inheritance-v1", "304-pixel-puzzle-v1"),
    ("CURRENT_PROJECT_VERSION = 295;", "CURRENT_PROJECT_VERSION = 304;"),
    ("private build 295", "private build 304"),
    ("MARKETING_VERSION = 1.0.295;", "MARKETING_VERSION = 1.0.304;"),
    ("private version 1.0.295", "private version 1.0.304"),
    ('private static let build = "1.0.295 (295)"', 'private static let build = "1.0.304 (304)"'),
    ('            "1.0.295 (295)",', '            "1.0.304 (304)",'),
    ("smallPhone.webContentTerminationTimes.v6.build295", "smallPhone.webContentTerminationTimes.v13.build304"),
    ('["v1168", "1.0.295 (295)",', '["v1178", "1.0.304 (304)",'),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"packaging template token missing: {old}")
    code = code.replace(old, new)

# The new shared component is intentionally untracked until the user accepts it,
# so include only this exact reviewed file without staging unrelated work.
code = code.replace(
    "tracked_bundle = tracked_files_under(BUNDLE_SOURCE)\n",
    "tracked_bundle = tracked_files_under(BUNDLE_SOURCE)\n"
    "tracked_bundle['bead-studio.js'] = BUNDLE_SOURCE / 'bead-studio.js'\n",
)
code = code.replace(
    "source_files = tracked_files_under(SOURCE)\n",
    "source_files = tracked_files_under(SOURCE)\n"
    "source_files['PhoneCompanionTest/PhoneWeb.bundle/bead-studio.js'] = "
    "BUNDLE_SOURCE / 'bead-studio.js'\n",
)

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
