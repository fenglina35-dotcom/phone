from pathlib import Path


template_path = Path(__file__).with_name("package_v1179_private_ios305.py")
code = template_path.read_text(encoding="utf-8")

replacements = [
    (
        "# v1179 is the reviewed shared release. This command packages the matching private source archive.",
        "# v1180 is the reviewed shared release. This command packages the matching private source archive.",
    ),
    (
        '"第二百九十五次安装_v1168_私人性能链继承修复_请先读.md", "第三百零五次安装_v1179_格式与拼图修复_请先读.md"',
        '"第二百九十五次安装_v1168_私人性能链继承修复_请先读.md", "第三百零六次安装_v1180_综合稳定像素外卖修复_请先读.md"',
    ),
    (
        '"delivery-v1168-private295-performance-inheritance-candidate", "delivery-v1179-private305-format-bead-release"',
        '"delivery-v1168-private295-performance-inheritance-candidate", "delivery-v1180-private306-stability-pixel-delivery-release"',
    ),
    (
        '"SmallPhone_v1168_PrivatePerformanceInheritance_iOS295_MacReady", "SmallPhone_v1179_FormatPixelFix_iOS305_MacReady"',
        '"SmallPhone_v1168_PrivatePerformanceInheritance_iOS295_MacReady", "SmallPhone_v1180_StabilityPixelDelivery_iOS306_MacReady"',
    ),
    (
        '"小手机_v1168_私人版_iOS295_私人性能链继承修复_Mac待编译源码包.zip", "小手机_v1179_私人版_iOS305_格式与拼图修复_Mac待编译源码包.zip"',
        '"小手机_v1168_私人版_iOS295_私人性能链继承修复_Mac待编译源码包.zip", "小手机_v1180_私人版_iOS306_综合稳定像素外卖修复_Mac待编译源码包.zip"',
    ),
    (
        '"APP_VER=\'v1167 · 心动审判共同生活记忆修复版\'", "APP_VER=\'v1179 · 格式与拼图修正版\'"',
        '"APP_VER=\'v1167 · 心动审判共同生活记忆修复版\'", "APP_VER=\'v1180 · 综合稳定、像素与外卖修正版\'"',
    ),
    (
        '"public web baseline is no longer v1167", "public web release is no longer v1179"',
        '"public web baseline is no longer v1167", "public web release is no longer v1180"',
    ),
    ('"smallphone-v1168-ios295-", "smallphone-v1179-ios305-"', '"smallphone-v1168-ios295-", "smallphone-v1180-ios306-"'),
    ('"public-web=v1167 (unchanged)", "public-web=v1179 (shared-release)"', '"public-web=v1167 (unchanged)", "public-web=v1180 (shared-release)"'),
    ('"private-web=v1168", "private-web=v1179"', '"private-web=v1168", "private-web=v1180"'),
    ('"ios=1.0.295 (295)", "ios=1.0.305 (305)"', '"ios=1.0.295 (295)", "ios=1.0.306 (306)"'),
    ('"window.__NORTH_SHELL_BUILD__=\'1168\'", "window.__NORTH_SHELL_BUILD__=\'1179\'"', '"window.__NORTH_SHELL_BUILD__=\'1168\'", "window.__NORTH_SHELL_BUILD__=\'1180\'"'),
    (
        '"app.js?v=1168&r=v1168-private-performance-inheritance-1", "app.js?v=1179&r=v1179-format-bead-fix-1"',
        '"app.js?v=1168&r=v1168-private-performance-inheritance-1", "app.js?v=1180&r=v1180-summary-call-offline-1"',
    ),
    ('"private-runtime-diagnostics.js?v=295", "private-runtime-diagnostics.js?v=305"', '"private-runtime-diagnostics.js?v=295", "private-runtime-diagnostics.js?v=306"'),
    ('"index.html?repair=1&v=1168", "index.html?repair=1&v=1179"', '"index.html?repair=1&v=1168", "index.html?repair=1&v=1180"'),
    (
        '"APP_VER=\'v1168 · 私人性能链继承修复版\';", "APP_VER=\'v1179 · 格式与拼图修正版\';"',
        '"APP_VER=\'v1168 · 私人性能链继承修复版\';", "APP_VER=\'v1180 · 综合稳定、像素与外卖修正版\';"',
    ),
    ('            "private-runtime-diagnostics.js?v=305",', '            "private-runtime-diagnostics.js?v=306",'),
    (
        '            "private-reply-intercept.js?v=1179&r=v1178-private-intercept-parity-1",',
        '            "private-reply-intercept.js?v=1180&r=v1178-private-intercept-parity-1",',
    ),
    (
        '            "cohab-theater.js?v=1179&r=v1179-format-bead-fix-1",',
        '            "cohab-theater.js?v=1180&r=v1180-summary-call-offline-1",',
    ),
    (
        '            "bead-studio.js?v=1179&r=v1179-pixel-puzzle-2",',
        '            "bead-studio.js?v=1180&r=v1180-pixel-puzzle-3",',
    ),
    ('            "delivery.js?v=1179",', '            "delivery.js?v=1180",'),
    (
        'require_tokens(theater, ["v1179-format-bead-fix-1", "_theaterTurnTargets"',
        'require_tokens(theater, ["v1180-summary-call-offline-1", "_theaterTurnTargets"',
    ),
    (
        'require_tokens(bead, ["v1179-pixel-puzzle-2", "像素拼拼乐", "function beadRolePlan", "_beadSourceCache", "保存进度", "archivedView"], "pixel puzzle")',
        'require_tokens(bead, ["v1180-pixel-puzzle-3", "像素拼拼乐", "function beadRolePlan", "_beadSourceCache", "保存进度", "beadRoleFinishAll", "completionMessaged", "labelPx/scale"], "pixel puzzle")',
    ),
    ('"295-private-performance-inheritance-v1", "305-format-bead-v1"', '"295-private-performance-inheritance-v1", "306-release-v1180-v1"'),
    ('"CURRENT_PROJECT_VERSION = 295;", "CURRENT_PROJECT_VERSION = 305;"', '"CURRENT_PROJECT_VERSION = 295;", "CURRENT_PROJECT_VERSION = 306;"'),
    ('"private build 295", "private build 305"', '"private build 295", "private build 306"'),
    ('"MARKETING_VERSION = 1.0.295;", "MARKETING_VERSION = 1.0.305;"', '"MARKETING_VERSION = 1.0.295;", "MARKETING_VERSION = 1.0.306;"'),
    ('"private version 1.0.295", "private version 1.0.305"', '"private version 1.0.295", "private version 1.0.306"'),
    (
        '\'private static let build = "1.0.295 (295)"\', \'private static let build = "1.0.305 (305)"\'',
        '\'private static let build = "1.0.295 (295)"\', \'private static let build = "1.0.306 (306)"\'',
    ),
    (
        '\'            "1.0.295 (295)",\', \'            "1.0.305 (305)",\'',
        '\'            "1.0.295 (295)",\', \'            "1.0.306 (306)",\'',
    ),
    (
        '"smallPhone.webContentTerminationTimes.v6.build295", "smallPhone.webContentTerminationTimes.v14.build305"',
        '"smallPhone.webContentTerminationTimes.v6.build295", "smallPhone.webContentTerminationTimes.v15.build306"',
    ),
    (
        '\'["v1168", "1.0.295 (295)",\', \'["v1179", "1.0.305 (305)",\'',
        '\'["v1168", "1.0.295 (295)",\', \'["v1180", "1.0.306 (306)",\'',
    ),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1180 packaging template token missing: {old}")
    code = code.replace(old, new)

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
