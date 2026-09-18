"""Create the private v1264 / iOS 365 Mac-source overlay package.

Unlike the earlier packaging scripts, every file is read from the committed tree
(``git cat-file`` against HEAD) instead of the working directory. The v1235/iOS356
lag repair only ever reached a device because a packaging script read the working
tree and silently carried uncommitted work into the zip; once later packages were
built from a clean checkout the repair vanished. Reading from HEAD makes a package
reproducible from the commit it names, and makes an uncommitted fix impossible to
ship by accident.

Per the user's standing request the archive carries no documentation files: it is
a single, non-nested zip whose name states its version.
"""

from hashlib import sha256
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "native/private-small-phone/XcodeProject/"
BUNDLE = "PhoneCompanionTest/PhoneWeb.bundle/"
PREFIX = "SmallPhone_v1264_iOS365_Private/"
OUTPUT = ROOT.parent / "SmallPhone_v1264_iOS365_MacSource.zip"

WEB_VERSION = "1264"
MARKETING = "1.0.365"
BUILD = "365"
BRIDGE = "38"


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.safecrlf=false", *args], cwd=ROOT)


def text(body: bytes) -> str:
    return body.decode("utf-8").replace("\r\n", "\n")


def committed_private_files() -> dict[str, bytes]:
    """Every tracked file under SOURCE, read from HEAD; documentation excluded."""
    listing = text(git("ls-tree", "-r", "-z", "--name-only", "HEAD", "--", SOURCE)).strip("\0")
    files: dict[str, bytes] = {}
    for name in listing.split("\0"):
        if not name:
            continue
        relative = name[len(SOURCE):]
        if PurePosixPath(relative).suffix.lower() in {".md", ".txt"}:
            continue
        files[relative] = git("cat-file", "blob", f"HEAD:{name}")
    return files


def validate(files: dict[str, bytes]) -> None:
    required = {
        "PhoneCompanionTest.xcodeproj/project.pbxproj",
        "PhoneCompanionTest/Info.plist",
        "PhoneCompanionTest/PhoneCompanionTest.entitlements",
        "PhoneCompanionTest/LocalPhoneWebView.swift",
        "PhoneCompanionTest/PhoneNativeBridge.swift",
        BUNDLE + "app.js",
        BUNDLE + "index.html",
        BUNDLE + "小手机.html",
        BUNDLE + "private-runtime-diagnostics.js",
        BUNDLE + "private-cloud-backup.js",
    }
    missing = sorted(required - files.keys())
    assert not missing, "missing private files: " + ", ".join(missing)
    assert not [n for n in files if n.lower().endswith((".md", ".txt"))], "package must carry no docs"

    app = text(files[BUNDLE + "app.js"])
    index = text(files[BUNDLE + "index.html"])
    alias = text(files[BUNDLE + "小手机.html"])
    pbx = text(files["PhoneCompanionTest.xcodeproj/project.pbxproj"])
    bridge = text(files["PhoneCompanionTest/PhoneNativeBridge.swift"])
    web_view = text(files["PhoneCompanionTest/LocalPhoneWebView.swift"])

    assert index == alias, "index.html and 小手机.html must stay identical"
    assert f"window.__NORTH_SHELL_BUILD__='{WEB_VERSION}'" in index
    assert f"APP_VER='v{WEB_VERSION}" in app
    assert f'window.__NORTH_SHELL_BUILD__!==\'{WEB_VERSION}\'' in app
    assert f'static let contractVersion = {BRIDGE}' in bridge
    assert f"{MARKETING} ({BUILD})" in bridge
    assert f"{MARKETING} ({BUILD})" in web_view
    assert pbx.count(f"CURRENT_PROJECT_VERSION = {BUILD};") == 12
    assert pbx.count(f"MARKETING_VERSION = {MARKETING};") == 12

    # Repairs that must ride along in every package. Keep in step with
    # tests/permanent-fix-guard.test.mjs; a package is never allowed to drop one.
    for marker, label in [
        ("const label=cohabActivityClean(spec.label)", "v1248 作息同步清洗后比较"),
        ("clearTimeout(_roleServerPushSoonTimers[key])", "v1248 角色服务器同步去抖"),
        ("else if(/^[（(【]/.test(raw)&&!/[）)】]$/.test(raw))", "v1246 截断旁白识别"),
        ("open=!closed&&line.match", "v1246 原文输出路径截断旁白"),
        ("function offlineReplyBudget(input,c)", "v1247 共同生活回复长度可调"),
        ("s_cmax_offline", "v1247 独立回复长度设置项"),
        ("backupJsonBlob", "大存档分段备份"),
        ("pfSyncMaybeYield", "好友同步让出主线程"),
        ("_fullBackupSkippedImages.add(key)", "v1249 完整备份跳过坏图"),
        ("nowMin<toMin(sp.time)", "v1249 定时查岗当天补跑"),
        ("offArchiveUnfinishedSession(o)", "v1249 未结束约会先归档"),
        ("roleOnlineProactiveBlocked(id)&&!(cohabRestricted&&opt.requestedByUser)", "v1249 共同生活期间可来电"),
        ("roleReplyDropEnglishNarration", "v1249 整段英文旁白本地丢弃"),
        ("storedImageDisplaySource(m.img)", "v1251 表情包引用先还原"),
        ("storedImageDisplaySource(S.me.homeBg)", "v1251 主屏壁纸引用先还原"),
        ("绝不能说成你申请加ta、或你终于等到ta通过", "v1251 好友申请方向按来源区分"),
        ("绝对不要反问“你是谁”“你哪位”", "v1251 陌生来电知道是自己拨出"),
        ("记不记、记哪一条，完全由你自己判断", "v1251 小本子由角色自行判断"),
        ("NATIVE_TIMEOUT", "v1251 原生请求有界"),
        ("res.status===400&&target!=='1024x1024'", "v1251 竖图被拒退回方图"),
        ("text=ttsDropOffLanguage(text,o);", "v1253 语音语言锁"),
        ("(_rawOutput&&(!_vlang||_vlang==='zh'))?u.orig:pickSpoken(u.orig,_vlang)", "v1253 原文输出不绕过通话语言过滤"),
        ("onclick=\"pfMsgMenu('${m.id}','friend'", "v1253 真人好友单聊气泡菜单"),
        ("onclick=\"pfMsgMenu('${m.id}','group'", "v1253 真人好友群聊气泡菜单"),
        ("roleServerPushHoldHandoff(c,handoffPeek(c,row))", "v1255 后台接力送不进去时停掉服务器任务"),
        ("if(handoff)replyHandoffCancelRemote(handoff);", "v1255 本地已回过时取消服务器任务"),
        ("roleInterceptPurpose:'length-continuation'", "v1255 截断续写不记入候选"),
        ("function letterReplyBudget(c)", "v1255 信件独立回复长度"),
        ("complete:true,unfilteredOutput:_rawOutput", "v1255 两边微信请求参数一致"),
        ("function modelOutputUnfiltered(){return true;}", "v1255 原文输出全局默认"),
        ("wechatReasoningLeak==='function'&&wechatReasoningLeak(t))||isRefusal(t)", "v1255 线下推理泄漏检查"),
        ("companionControlLedgerForParser()", "v1257 解析器知道当前锁定状态"),
        ("条件或威胁", "v1257 威胁不触发真锁"),
        ("opt.by==='role'&&companionExternalAlreadyInState(st,app,action)", "v1257 外置不重复下发"),
        ("这不是设备读数汇报", "v1257 手动解锁改为关系事件"),
        ("async function callChatWithRetry(messages,md,c)", "v1260 通话掉线自动重发"),
        ("complete:true,max:callReplyBudget(c)", "v1260 通话截断续写＋独立回复长度"),
        ("function callBackgroundInterrupted(e,mark,now)", "v1260 切后台说人话"),
        ("hadGap=/^\\s/.test(more)", "v1260 英文续写不粘词"),
        ("async function testCallScale()", "v1260 按通话规模测"),
        ("let _taskBusy=false;", "v1260 _taskBusy 有声明"),
        ("async function dyAuxChat(messages,opt)", "v1262 抖音副模型失败回落主模型"),
        ("function dyModelFail(what,e)", "v1262 抖音失败不再静默"),
        ("function dyProfile(){const p=S.dy.profile", "v1259 抖音「我」页"),
        ("function dyGroupInfoView()", "v1261 抖音群聊设置"),
        ("g.lastApplyDay=dyApplyDayKey();save();", "v1261 公开群每天一位陌生人"),
        ("function dyGroupSpeakerPrompt(g,m)", "v1261 群里各按人设接话"),
        ("function dyWorkCardHTML(v,opt)", "v1262 文字作品"),
        ("function dyFriendView()", "v1262 朋友页"),
        ("function dyGrowthTick()", "v1262 涨粉掉粉靠发作品"),
        ("function dyCommentResponder(v)", "v1262 评论一定有角色回"),
        ("function cohabMemoryAfterPrompt(c)", "v1259 共同生活关掉也记得"),
        ("function memoryPruneLowStars(rows,maxStar)", "v1259 清理低星保五星"),
    ]:
        assert marker in app, f"package would drop a required repair: {label}"
    assert app.count("northNativeBackgroundTask") >= 30, "private background-task wrappers missing"
    assert "north-native-performance-guard" in app, "private performance guard missing"

    assert len([n for n in files if n.startswith(BUNDLE)]) >= 350, "private web bundle looks incomplete"


def main() -> None:
    dirty = text(git("status", "--porcelain", "--", SOURCE)).strip()
    assert not dirty, "commit the private source before packaging:\n" + dirty

    files = committed_private_files()
    validate(files)

    assert not OUTPUT.exists(), "refusing to overwrite an existing package"
    with ZipFile(OUTPUT, "x", ZIP_DEFLATED, compresslevel=6) as archive:
        for name in sorted(files):
            archive.writestr(PREFIX + name, files[name])

    with ZipFile(OUTPUT) as archive:
        names = archive.namelist()
        assert len(names) == len(files)
        for name in names:
            assert archive.read(name) == files[name[len(PREFIX):]], f"round-trip mismatch: {name}"

    print(json.dumps({
        "path": str(OUTPUT),
        "sourceCommit": text(git("rev-parse", "HEAD")).strip(),
        "files": len(files),
        "bytes": OUTPUT.stat().st_size,
        "sha256": sha256(OUTPUT.read_bytes()).hexdigest(),
        "webVersion": WEB_VERSION,
        "native": f"{MARKETING} ({BUILD})",
        "bridge": BRIDGE,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
