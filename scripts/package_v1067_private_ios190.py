from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / "app.js").read_text(encoding="utf-8")
private_app = (
    ROOT
    / "native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/app.js"
).read_text(encoding="utf-8")

if app.replace("\r\n", "\n") != private_app.replace("\r\n", "\n"):
    raise RuntimeError("root and private app.js are not content-identical")
for token in [
    "APP_VER='v1067 · 私人 App Intl 热点隔离与白屏恢复版';",
    "window.__SMALL_PHONE_NATIVE_ENV__",
    "function northLocaleNumber",
    "function northLocaleDate",
    "webViewWebContentProcessDidTerminate",
    "deliveryTryExplicitApprovalFallback",
    "remoteControlRoleReaction",
]:
    sources = app + "\n" + (
        ROOT
        / "native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift"
    ).read_text(encoding="utf-8")
    if token not in sources:
        raise RuntimeError(f"v1067 feature or protected route missing: {token}")

template = (ROOT / "scripts/package_v1058_private_ios181.py").read_text(encoding="utf-8")
source = (
    template
    .replace("1058", "1067")
    .replace("181", "190")
    .replace("第一百八十一次安装", "第一百九十次安装")
    .replace("CohabStorageTransferOfflineInput", "PrivateIntlWebContentRecovery")
    .replace("共同生活存储散热转账回复与约会输入修复", "私人 App Intl 热点隔离与白屏恢复")
    .replace("共同生活通话、存储散热、转账回复与约会输入修复版", "私人 App Intl 热点隔离与白屏恢复版")
)
namespace = {"__file__": str(Path(__file__).resolve()), "__name__": "__main__"}
exec(compile(source, str(Path(__file__).resolve()), "exec"), namespace)
