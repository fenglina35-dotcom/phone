from pathlib import Path


template_path = Path(__file__).with_name("package_v1178_private_ios304.py")
code = template_path.read_text(encoding="utf-8")

replacements = [
    (
        "# v1178 is a reviewed shared candidate. This command packages only the private source archive.",
        "# v1179 is the reviewed shared release. This command packages the matching private source archive.",
    ),
    (
        '"第二百九十五次安装_v1168_私人性能链继承修复_请先读.md", "第三百零四次安装_v1178_像素拼拼乐_请先读.md"',
        '"第二百九十五次安装_v1168_私人性能链继承修复_请先读.md", "第三百零五次安装_v1179_格式与拼图修复_请先读.md"',
    ),
    (
        '"delivery-v1168-private295-performance-inheritance-candidate", "delivery-v1178-private304-pixel-puzzle-candidate"',
        '"delivery-v1168-private295-performance-inheritance-candidate", "delivery-v1179-private305-format-bead-release"',
    ),
    (
        '"SmallPhone_v1168_PrivatePerformanceInheritance_iOS295_MacReady", "SmallPhone_v1178_PixelPuzzle_iOS304_MacReady"',
        '"SmallPhone_v1168_PrivatePerformanceInheritance_iOS295_MacReady", "SmallPhone_v1179_FormatPixelFix_iOS305_MacReady"',
    ),
    (
        '"小手机_v1168_私人版_iOS295_私人性能链继承修复_Mac待编译源码包.zip", "小手机_v1178_私人版_iOS304_像素拼拼乐_Mac待编译源码包.zip"',
        '"小手机_v1168_私人版_iOS295_私人性能链继承修复_Mac待编译源码包.zip", "小手机_v1179_私人版_iOS305_格式与拼图修复_Mac待编译源码包.zip"',
    ),
    (
        '"EXPECTED_PACKAGE_FILES = 188", "EXPECTED_PACKAGE_FILES = 191"',
        '"EXPECTED_PACKAGE_FILES = 188", "EXPECTED_PACKAGE_FILES = 191"',
    ),
    (
        '"APP_VER=\'v1167 · 心动审判共同生活记忆修复版\'", "APP_VER=\'v1178 · 像素拼拼乐版\'"',
        '"APP_VER=\'v1167 · 心动审判共同生活记忆修复版\'", "APP_VER=\'v1179 · 格式与拼图修正版\'"',
    ),
    (
        '"public web baseline is no longer v1167", "public web candidate is no longer v1178"',
        '"public web baseline is no longer v1167", "public web release is no longer v1179"',
    ),
    (
        '"smallphone-v1168-ios295-", "smallphone-v1178-ios304-"',
        '"smallphone-v1168-ios295-", "smallphone-v1179-ios305-"',
    ),
    (
        '"public-web=v1167 (unchanged)", "public-web=v1178 (not-uploaded)"',
        '"public-web=v1167 (unchanged)", "public-web=v1179 (shared-release)"',
    ),
    ('"private-web=v1168", "private-web=v1178"', '"private-web=v1168", "private-web=v1179"'),
    ('"ios=1.0.295 (295)", "ios=1.0.304 (304)"', '"ios=1.0.295 (295)", "ios=1.0.305 (305)"'),
    (
        '"window.__NORTH_SHELL_BUILD__=\'1168\'", "window.__NORTH_SHELL_BUILD__=\'1178\'"',
        '"window.__NORTH_SHELL_BUILD__=\'1168\'", "window.__NORTH_SHELL_BUILD__=\'1179\'"',
    ),
    (
        '"app.js?v=1168&r=v1168-private-performance-inheritance-1", "app.js?v=1178&r=v1178-pixel-puzzle-1"',
        '"app.js?v=1168&r=v1168-private-performance-inheritance-1", "app.js?v=1179&r=v1179-format-bead-fix-1"',
    ),
    (
        '"private-runtime-diagnostics.js?v=295", "private-runtime-diagnostics.js?v=304"',
        '"private-runtime-diagnostics.js?v=295", "private-runtime-diagnostics.js?v=305"',
    ),
    ('"index.html?repair=1&v=1168", "index.html?repair=1&v=1178"', '"index.html?repair=1&v=1168", "index.html?repair=1&v=1179"'),
    (
        '"APP_VER=\'v1168 · 私人性能链继承修复版\';", "APP_VER=\'v1178 · 像素拼拼乐版\';"',
        '"APP_VER=\'v1168 · 私人性能链继承修复版\';", "APP_VER=\'v1179 · 格式与拼图修正版\';"',
    ),
    (
        '            "private-runtime-diagnostics.js?v=304",',
        '            "private-runtime-diagnostics.js?v=305",',
    ),
    (
        '            "private-reply-intercept.js?v=1178&r=v1178-private-intercept-parity-1",',
        '            "private-reply-intercept.js?v=1179&r=v1178-private-intercept-parity-1",',
    ),
    (
        '            "cohab-theater.js?v=1178&r=v1178-pixel-puzzle-1",',
        '            "cohab-theater.js?v=1179&r=v1179-format-bead-fix-1",',
    ),
    (
        '            "bead-studio.js?v=1178&r=v1178-pixel-puzzle-1",',
        '            "bead-studio.js?v=1179&r=v1179-pixel-puzzle-2",',
    ),
    ('            "delivery.js?v=1178",', '            "delivery.js?v=1179",'),
    (
        'require_tokens(theater, ["v1178-pixel-puzzle-1", "_theaterTurnTargets"',
        'require_tokens(theater, ["v1179-format-bead-fix-1", "_theaterTurnTargets"',
    ),
    (
        'require_tokens(bead, ["v1178-pixel-puzzle-1", "像素拼拼乐", "function beadRolePlan", "主体＋背景", "1–100 格"], "pixel puzzle")',
        'require_tokens(bead, ["v1179-pixel-puzzle-2", "像素拼拼乐", "function beadRolePlan", "_beadSourceCache", "保存进度", "archivedView"], "pixel puzzle")',
    ),
    ('"295-private-performance-inheritance-v1", "304-pixel-puzzle-v1"', '"295-private-performance-inheritance-v1", "305-format-bead-v1"'),
    ('"CURRENT_PROJECT_VERSION = 295;", "CURRENT_PROJECT_VERSION = 304;"', '"CURRENT_PROJECT_VERSION = 295;", "CURRENT_PROJECT_VERSION = 305;"'),
    ('"private build 295", "private build 304"', '"private build 295", "private build 305"'),
    ('"MARKETING_VERSION = 1.0.295;", "MARKETING_VERSION = 1.0.304;"', '"MARKETING_VERSION = 1.0.295;", "MARKETING_VERSION = 1.0.305;"'),
    ('"private version 1.0.295", "private version 1.0.304"', '"private version 1.0.295", "private version 1.0.305"'),
    (
        '\'private static let build = "1.0.295 (295)"\', \'private static let build = "1.0.304 (304)"\'',
        '\'private static let build = "1.0.295 (295)"\', \'private static let build = "1.0.305 (305)"\'',
    ),
    (
        '\'            "1.0.295 (295)",\', \'            "1.0.304 (304)",\'',
        '\'            "1.0.295 (295)",\', \'            "1.0.305 (305)",\'',
    ),
    (
        '"smallPhone.webContentTerminationTimes.v6.build295", "smallPhone.webContentTerminationTimes.v13.build304"',
        '"smallPhone.webContentTerminationTimes.v6.build295", "smallPhone.webContentTerminationTimes.v14.build305"',
    ),
    (
        '\'["v1168", "1.0.295 (295)",\', \'["v1178", "1.0.304 (304)",\'',
        '\'["v1168", "1.0.295 (295)",\', \'["v1179", "1.0.305 (305)",\'',
    ),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1179 packaging template token missing: {old}")
    code = code.replace(old, new)

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
