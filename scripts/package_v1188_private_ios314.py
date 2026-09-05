from pathlib import Path


def materialize_packager(wrapper_path: Path) -> str:
    """Expand the previous release wrapper without running its packager."""
    current_path = wrapper_path.resolve()
    code = current_path.read_text(encoding="utf-8")
    while "\nruntime_globals =" in code:
        if current_path.name == "package_v1187_private_ios313.py":
            code = code.replace(
                'if "function offComposerPinLatest(target)" not in private_app:\n'
                '    raise RuntimeError("private offline last-message anchor is missing")',
                'if "function offComposerPinLatest(target)" in private_app:\n'
                '    raise RuntimeError("failed v1187 touch-time scroll anchor remains")',
            )
        prefix = code.rsplit("\nruntime_globals =", 1)[0]
        namespace = {
            "__file__": str(current_path),
            "__name__": "__packager_expand__",
        }
        exec(compile(prefix, str(current_path), "exec"), namespace)
        code = namespace["code"]
        current_path = Path(namespace["template_path"])
    return code


template_path = Path(__file__).with_name("package_v1187_private_ios313.py")
code = materialize_packager(template_path)

replacements = [
    (
        "第三百一十三次安装_v1187_v1179键盘基线恢复_请先读.md",
        "第三百一十四次安装_v1188_线下原生聚焦修复_请先读.md",
    ),
    (
        "delivery-v1187-private313-v1179-keyboard-baseline-release",
        "delivery-v1188-private314-offline-native-focus-release",
    ),
    (
        "SmallPhone_v1187_V1179KeyboardBaseline_iOS313_MacReady",
        "SmallPhone_v1188_OfflineNativeFocus_iOS314_MacReady",
    ),
    (
        "小手机_v1187_私人版_iOS313_v1179键盘基线恢复_Mac待编译源码包.zip",
        "小手机_v1188_私人版_iOS314_线下原生聚焦修复_Mac待编译源码包.zip",
    ),
    ("private-web=v1184", "private-web=v1188"),
    ("ios=1.0.313 (313)", "ios=1.0.314 (314)"),
    ("1.0.313 (313)", "1.0.314 (314)"),
    ("CURRENT_PROJECT_VERSION = 313;", "CURRENT_PROJECT_VERSION = 314;"),
    ("MARKETING_VERSION = 1.0.313;", "MARKETING_VERSION = 1.0.314;"),
    (
        "smallPhone.webContentTerminationTimes.v22.build313",
        "smallPhone.webContentTerminationTimes.v23.build314",
    ),
    (
        "313-private-v1187-v1179-keyboard-baseline-1",
        "314-private-v1188-offline-native-focus-1",
    ),
    ("private-runtime-diagnostics.js?v=313", "private-runtime-diagnostics.js?v=314"),
    ("window.__NORTH_SHELL_BUILD__='1184'", "window.__NORTH_SHELL_BUILD__='1188'"),
    (
        "app.js?v=1184&r=v1184-ios-web-crash-cohab-turn-keyboard-1",
        "app.js?v=1188&r=v1188-private-offline-native-focus-1",
    ),
    ("private-reply-intercept.js?v=1184", "private-reply-intercept.js?v=1188"),
    ("cohab-theater.js?v=1184", "cohab-theater.js?v=1188"),
    ("bead-studio.js?v=1184", "bead-studio.js?v=1188"),
    ("delivery.js?v=1184", "delivery.js?v=1188"),
    ("index.html?repair=1&v=1184", "index.html?repair=1&v=1188"),
    (
        "APP_VER='v1184 · iPhone稳定、剧场顺序与键盘修复版'",
        "APP_VER='v1188 · 私人线下原生聚焦修复版'",
    ),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1188 packaging template token missing: {old}")
    code = code.replace(old, new)

# The inherited packager validates both the frozen public source and the private
# bundle. Restore the public APP_VER assertion after updating the private one.
code = code.replace(
    'if "APP_VER=\'v1188 · 私人线下原生聚焦修复版\'" not in public_app:',
    'if "APP_VER=\'v1184 · iPhone稳定、剧场顺序与键盘修复版\'" not in public_app:',
)

required_packager_tokens = [
    "delivery-v1188-private314-offline-native-focus-release",
    "SmallPhone_v1188_OfflineNativeFocus_iOS314_MacReady",
    "public-web=v1184 (unchanged)",
    "private-web=v1188",
    "ios=1.0.314 (314)",
    "314-private-v1188-offline-native-focus-1",
    "smallPhone.webContentTerminationTimes.v23.build314",
    "app.js?v=1188&r=v1188-private-offline-native-focus-1",
    "public web files changed during a private-only release",
]
for token in required_packager_tokens:
    if token not in code:
        raise RuntimeError(f"materialized v1188 packager token missing: {token}")

source_root = Path(__file__).resolve().parents[1]
private_source = source_root / "native" / "private-small-phone" / "XcodeProject" / "PhoneCompanionTest"
private_root = (private_source / "SmallPhonePrivateRootView.swift").read_text(encoding="utf-8")
private_webview = (private_source / "LocalPhoneWebView.swift").read_text(encoding="utf-8")
private_app = (private_source / "PhoneWeb.bundle" / "app.js").read_text(encoding="utf-8")
private_entries = [
    (private_source / "PhoneWeb.bundle" / "index.html").read_text(encoding="utf-8"),
    (private_source / "PhoneWeb.bundle" / "小手机.html").read_text(encoding="utf-8"),
]
if ".ignoresSafeArea(.keyboard, edges: .bottom)" not in private_root:
    raise RuntimeError("v1179 stable private keyboard host contract is missing")
if "function offComposerPinLatest(target)" in private_app:
    raise RuntimeError("failed v1187 touch-time scroll anchor remains")
for entry in private_entries:
    if "interactive-widget=resizes-content" in entry:
        raise RuntimeError("private viewport still has a second keyboard resize owner")
    if ".phone:has(.offinput)" in entry:
        raise RuntimeError("private offline composer still inherits the WeChat absolute workaround")
    if "window.__NORTH_SHELL_BUILD__='1188'" not in entry:
        raise RuntimeError("private v1188 entry identity is missing")
for forbidden in [
    "KeyboardSynchronizedContainer",
    "keyboardLayoutGuide",
    "smallPhoneOfflineKeyboardScope",
    "keyboardWillChangeFrameNotification",
    "keyboardDidHideNotification",
    "scrollView.isScrollEnabled",
    "setContentOffset",
]:
    if forbidden in private_webview:
        raise RuntimeError(f"failed keyboard control remains in private WebView: {forbidden}")

runtime_globals = {
    "__file__": str(Path(__file__).resolve()),
    "__name__": "__main__",
}
exec(compile(code, str(template_path), "exec"), runtime_globals)
