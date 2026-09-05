from pathlib import Path


def materialize_packager(wrapper_path: Path) -> str:
    """Expand the previous release wrapper without running its packager."""
    current_path = wrapper_path.resolve()
    code = current_path.read_text(encoding="utf-8")
    while "\nruntime_globals =" in code:
        prefix = code.rsplit("\nruntime_globals =", 1)[0]
        namespace = {
            "__file__": str(current_path),
            "__name__": "__packager_expand__",
        }
        exec(compile(prefix, str(current_path), "exec"), namespace)
        code = namespace["code"]
        current_path = Path(namespace["template_path"])
    return code


template_path = Path(__file__).with_name("package_v1186_private_ios312.py")
code = materialize_packager(template_path)

baseline_tokens = [
    "delivery-v1186-private312-cohab-keyboard-isolation-release",
    "SmallPhone_v1186_CohabKeyboardIsolation_iOS312_MacReady",
    "小手机_v1186_私人版_iOS312_共同生活键盘隔离修复_Mac待编译源码包.zip",
    "第三百一十二次安装_v1186_共同生活键盘隔离修复_请先读.md",
    "ios=1.0.312 (312)",
    "312-private-v1186-cohab-keyboard-isolation-1",
    "smallPhone.webContentTerminationTimes.v21.build312",
    "smallPhoneOfflineKeyboardScope",
    "target.id === 'off_in'",
    "scrollView.isScrollEnabled = false",
]
for token in baseline_tokens:
    if token not in code:
        raise RuntimeError(f"v1186/iOS312 packaging baseline token missing: {token}")

replacements = [
    (
        "第三百一十二次安装_v1186_共同生活键盘隔离修复_请先读.md",
        "第三百一十三次安装_v1187_v1179键盘基线恢复_请先读.md",
    ),
    (
        "delivery-v1186-private312-cohab-keyboard-isolation-release",
        "delivery-v1187-private313-v1179-keyboard-baseline-release",
    ),
    (
        "SmallPhone_v1186_CohabKeyboardIsolation_iOS312_MacReady",
        "SmallPhone_v1187_V1179KeyboardBaseline_iOS313_MacReady",
    ),
    (
        "小手机_v1186_私人版_iOS312_共同生活键盘隔离修复_Mac待编译源码包.zip",
        "小手机_v1187_私人版_iOS313_v1179键盘基线恢复_Mac待编译源码包.zip",
    ),
    ("ios=1.0.312 (312)", "ios=1.0.313 (313)"),
    ("1.0.312 (312)", "1.0.313 (313)"),
    ("CURRENT_PROJECT_VERSION = 312;", "CURRENT_PROJECT_VERSION = 313;"),
    ("MARKETING_VERSION = 1.0.312;", "MARKETING_VERSION = 1.0.313;"),
    (
        "smallPhone.webContentTerminationTimes.v21.build312",
        "smallPhone.webContentTerminationTimes.v22.build313",
    ),
    (
        "312-private-v1186-cohab-keyboard-isolation-1",
        "313-private-v1187-v1179-keyboard-baseline-1",
    ),
    ("private-runtime-diagnostics.js?v=312", "private-runtime-diagnostics.js?v=313"),
    ("smallPhoneOfflineKeyboardScope", "webView.scrollView.contentInsetAdjustmentBehavior = .never"),
    ("target.id === 'off_in'", "func makeUIView(context: Context) -> WKWebView"),
    ("scrollView.isScrollEnabled = false", "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.313 (313)'"),
]

for old, new in replacements:
    if old not in code:
        raise RuntimeError(f"v1187 packaging template token missing: {old}")
    code = code.replace(old, new)

required_packager_tokens = [
    "delivery-v1187-private313-v1179-keyboard-baseline-release",
    "SmallPhone_v1187_V1179KeyboardBaseline_iOS313_MacReady",
    "public-web=v1184 (unchanged)",
    "private-web=v1184",
    "ios=1.0.313 (313)",
    "313-private-v1187-v1179-keyboard-baseline-1",
    "smallPhone.webContentTerminationTimes.v22.build313",
    "webView.scrollView.contentInsetAdjustmentBehavior = .never",
    "func makeUIView(context: Context) -> WKWebView",
    "window.__SMALL_PHONE_PRIVATE_BUILD__ = '1.0.313 (313)'",
    "public web files changed during a private-only release",
]
for token in required_packager_tokens:
    if token not in code:
        raise RuntimeError(f"materialized v1187 packager token missing: {token}")

for forbidden in [
    "final class KeyboardSynchronizedContainer: UIView",
    "keyboardLayoutGuide.usesBottomSafeArea = false",
    "equalTo: keyboardLayoutGuide.topAnchor",
    "smallPhoneOfflineKeyboardScope",
    "scrollView.isScrollEnabled = false",
    "scrollView.isScrollEnabled = true",
]:
    if forbidden in code:
        raise RuntimeError(f"failed private keyboard workaround leaked into v1187: {forbidden}")

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
if "function offComposerPinLatest(target)" not in private_app:
    raise RuntimeError("private offline last-message anchor is missing")
for entry in private_entries:
    if "interactive-widget=resizes-content" in entry:
        raise RuntimeError("private viewport still has a second keyboard resize owner")
    if ".phone:has(.offinput)" in entry:
        raise RuntimeError("private offline composer still inherits the WeChat absolute workaround")
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
