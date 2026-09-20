"""Create the private v1276 / iOS 375 Mac-source overlay package.

Unlike the earlier packaging scripts, every file is read from the committed tree
(``git cat-file`` against HEAD) instead of the working directory. The v1235/iOS356
lag repair only ever reached a device because a packaging script read the working
tree and silently carried uncommitted work into the zip; once later packages were
built from a clean checkout the repair vanished. Reading from HEAD makes a package
reproducible from the commit it names, and makes an uncommitted fix impossible to
ship by accident.

The archive keeps the current Mac build guide plus the cozy-home documentation
and third-party notices. Historical installation notes remain excluded so the
single, non-nested zip contains the current release rather than old deliveries.
"""

from hashlib import sha256
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile
from tempfile import TemporaryDirectory
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "native/private-small-phone/XcodeProject/"
BUNDLE = "PhoneCompanionTest/PhoneWeb.bundle/"
PREFIX = "SmallPhone_v1276_iOS375_Private/"
OUTPUT = ROOT.parent / "SmallPhone_v1276_iOS375_MacSource.zip"

WEB_VERSION = "1276"
MARKETING = "1.0.375"
BUILD = "375"
BRIDGE = "38"


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", "-c", "core.safecrlf=false", *args], cwd=ROOT)


def text(body: bytes) -> str:
    return body.decode("utf-8").replace("\r\n", "\n")


def committed_private_files() -> dict[str, bytes]:
    """Every releasable tracked file under SOURCE, read from HEAD."""
    listing = text(git("ls-tree", "-r", "-z", "--name-only", "HEAD", "--", SOURCE)).strip("\0")
    files: dict[str, bytes] = {}
    commit = text(git("rev-parse", "HEAD")).strip()
    with subprocess.Popen(["git", "cat-file", "--batch"], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE) as process:
        for name in listing.split("\0"):
            if not name: continue
            relative = name[len(SOURCE):]
            suffix = PurePosixPath(relative).suffix.lower()
            current_guide = relative == "请在Mac编译前先读.md"
            cozy_doc = relative.startswith(BUNDLE + "games/cozy-home/")
            if suffix == ".md" and not (current_guide or cozy_doc): continue
            if suffix == ".txt" and not cozy_doc: continue
            process.stdin.write((commit + ":" + name + "\n").encode("utf-8")); process.stdin.flush()
            header = process.stdout.readline().decode().split()
            assert len(header) == 3 and header[1] == "blob", name
            files[relative] = process.stdout.read(int(header[2]))
            assert process.stdout.read(1) == b"\n"
        process.stdin.close()
        process.wait()
    return files


def validate(files: dict[str, bytes]) -> None:
    required = {
        "PhoneCompanionTest.xcodeproj/project.pbxproj",
        "PhoneCompanionTest/Info.plist",
        "PhoneCompanionTest/PhoneCompanionTest.entitlements",
        "PhoneCompanionTest/LocalPhoneWebView.swift",
        "PhoneCompanionTest/PhoneNativeBridge.swift",
        BUNDLE + "app.js",
        BUNDLE + "cozy-home.js",
        BUNDLE + "games/cozy-home/private-bridge.mjs",
        BUNDLE + "index.html",
        BUNDLE + "小手机.html",
        BUNDLE + "private-runtime-diagnostics.js",
        BUNDLE + "private-cloud-backup.js",
        "请在Mac编译前先读.md",
    }
    missing = sorted(required - files.keys())
    assert not missing, "missing private files: " + ", ".join(missing)
    assert not [n for n in files if n.lower().endswith((".md", ".txt")) and n != "请在Mac编译前先读.md" and not n.startswith(BUNDLE + "games/cozy-home/")], "only the current Mac guide and cozy-home documentation are retained"

    app = text(files[BUNDLE + "app.js"])
    index = text(files[BUNDLE + "index.html"])
    alias = text(files[BUNDLE + "小手机.html"])
    pbx = text(files["PhoneCompanionTest.xcodeproj/project.pbxproj"])
    bridge = text(files["PhoneCompanionTest/PhoneNativeBridge.swift"])
    web_view = text(files["PhoneCompanionTest/LocalPhoneWebView.swift"])
    backup = text(files[BUNDLE + "private-cloud-backup.js"])

    assert index == alias, "index.html and 小手机.html must stay identical"
    assert f"window.__NORTH_SHELL_BUILD__='{WEB_VERSION}'" in index
    assert f"APP_VER='v{WEB_VERSION}" in app
    assert f'window.__NORTH_SHELL_BUILD__!==\'{WEB_VERSION}\'' in app
    assert f'static let contractVersion = {BRIDGE}' in bridge
    assert f"{MARKETING} ({BUILD})" in bridge
    assert f"{MARKETING} ({BUILD})" in web_view
    assert pbx.count(f"CURRENT_PROJECT_VERSION = {BUILD};") == 12
    assert pbx.count(f"MARKETING_VERSION = {MARKETING};") == 12
    assert f"private-cloud-backup.js?v={WEB_VERSION}" in index, "private backup component is not loaded"
    for action in ("begin", "chunk", "commit", "abort"):
        assert f"account.backup.file.{action}" in backup, f"private backup action missing: {action}"
        assert f'"account.backup.file.{action}"' in bridge, f"native backup action missing: {action}"
    assert "const CHUNK=192*1024" in backup, "private backup fell back to an oversized whole-object bridge"
    assert "account.backup.file.commit',{token},720000" in backup, "web backup timeout is shorter than native upload"
    assert "手机号私人备份和网页镜像是两个入口" in backup, "private account backup still starts a second full web mirror"
    assert "privatePrimaryMirrorUpload(await fullBackupState())" not in backup, "private account backup regenerates the full archive"
    assert "await cloudBackup({current,onProgress:" in app, "existing web cloud backups are no longer updated"
    assert "id=\"cloud_backup_now\"" in app and "上一份云备份仍在进行" in app, "web cloud progress or duplicate-click guard missing"
    assert "private actor PrivateBackupFileStore" in bridge
    assert "uploader.upload(for: request, fromFile: file.url)" in bridge
    assert "action === 'account.backup.file.commit' ? 660000 : 60000" in web_view
    assert "isa = PBXFileSystemSynchronizedRootGroup;" in pbx and "path = PhoneCompanionTest;" in pbx
    assert not re.search(r"membershipExceptions = \([^)]*private-cloud-backup\.js", pbx, re.S), "private backup component was excluded from the Xcode target"

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
        ("function dyUserView()", "v1265 抖音里每个人都有主页"),
        ("function dyPersonFind(key)", "v1265 按各种 key 找人"),
        ("function dyGMembersView()", "v1265 群成员独立成页"),
        ("function dyMemoryPrompt(c)", "v1265 抖音的事进角色记忆"),
        ("function dyChatCtxRows(box)", "v1265 私聊群聊各自调上下文"),
        ("function dyReplyBudget()", "v1265 回复长度跟设置走"),
        ("function dyTypingHTML(face)", "v1265 等回复时三个点"),
        ("function dyFace(v,cls)", "v1265 陌生人统一灰底小人"),
        ("'@'+(toName||S.me.name)+' '+said", "v1265 角色回评论先 @ 人"),
        ("m.from==='me'?av(dyAvatar(),'sm'):dyFace(d.avatar,'sm')", "v1265 私信我这边也有头像"),
        ("function chatFileText(file)", "v1266 她发的文件真的读得到"),
        ("function chatFileContextBody(m)", "v1266 文件正文进上下文"),
        ("function roleFileExtract(content)", "v1266 角色能写多行文件"),
        ("function chatFileOpen(cid,mid)", "v1266 文件卡点得开"),
        ("chatFunctionItem('骰子','dice'", "v1266 骰子回到功能面板"),
        ("function dyPersonBio(p)", "v1267 抖音简介单独存，不是人设"),
        ("function dyUserBioGen()", "v1267 让 TA 自己写简介"),
        ("function dyUserKey()", "v1267 主页是独立的一页"),
        ("function dyOpenDMUser(id)", "v1267 私聊点头像进主页"),
        ("function dyUserBack()", "v1267 主页返回回到来的那一页"),
        ("function dyMarkAllSeen(kind,rows)", "v1268 红点进页面就全清"),
        ("function dySparkTick(d)", "v1268 火花只涨不清零"),
        ("function dyDMBubbles(raw)", "v1268 私聊能连发 1～4 条"),
        ("function dyGCast(g,fromText,forceKeys)", "v1268 群聊按性格出场"),
        ("function dyGTalk(m)", "v1268 话痨度"),
        ("function dyGCareHit(m,text)", "v1268 在意的话题会把人拽出来"),
        ("function dyGCrowdPrompt(g,crowd)", "v1268 网友合并一次调用"),
        ("function dyGCmdDeny(g,actorKey,kind,target)", "v1268 禁言踢人的规矩由代码硬卡"),
        ("function dyGMutedBarHTML(g)", "v1268 被禁言时输入框锁死"),
        ("function dyDMRunUnmute(cid,text)", "v1268 私信里能解禁"),
        ("async function dyGroupIdleChat(gid)", "v1268 群里冷场会自己聊起来"),
        ("function dyPersonIP(p)", "v1268 IP 跟人设走"),
        ("function dyGBubbles(g,m,raw)", "v1269 群聊气泡一条条出"),
        ("function dyGSplitAt(line)", "v1269 一个气泡不能 @ 两个人"),
        ("function dyDing()", "v1269 收到消息的提示音"),
        ("function dySparkBadge(d)", "v1269 火花在顶部名字旁边"),
        ("function dyEmojiPanelHTML(scope,id)", "v1269 输入栏复用微信表情"),
        ("function dyMoneySend(scope,id,kind)", "v1269 转账红包走微信账本"),
        ("function dyGreed(m)", "v1269 抢红包手速看性格"),
        ("function dyPostImage(shoot)", "v1269 拍摄或从相册"),
        ("function dyWorkSceneText(v)", "v1269 看不见图绝不编"),
        ("async function dyAtFansShow(v,p,fans)", "v1269 粉丝来捧场"),
        ("function dyDMKey(d)", "v1269 误删过的私聊 key，别再掉"),
        ("function dyDMStamp(rows,mi)", "v1269 误删过的时间戳，别再掉"),
        ("sub==='group')return{id:'.dyg-box',stick:true}", "v1271 群聊不再弹回顶部"),
        ("if(!dyGFind(g,m.k))continue;", "v1271 被踢的人不能再说话"),
        ("function dyWorkMusicPlay(id)", "v1271 作品配乐真的能放"),
        ("function onlineMemoryRecallLimits()", "v1274 线上记忆引用上限"),
        ("function offMemoryRestoreScroll(top)", "v1274 线下记忆删除保持滚动位置"),
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
    # The independent 温馨小家3D workspace may advance in parallel. A private
    # release must use the reviewed cozy-home snapshot committed in this repo;
    # reading the other workspace here would silently mix unrelated work into
    # an otherwise reproducible package.
    assert b"cozyHomeKeepFrame" in files[BUNDLE + "app.js"]
    assert b"diagnosticCopyPending" in files[BUNDLE + "private-runtime-diagnostics.js"]
    assert b"CozyHomeSchemeHandler" in files["PhoneCompanionTest/LocalPhoneWebView.swift"]
    cozy_files = [n for n in files if n.startswith(BUNDLE + "games/cozy-home/")]
    assert len(cozy_files) == 1253, "complete house resource set is missing"
    cozy_app = text(files[BUNDLE + "games/cozy-home/app.mjs"])
    cozy_player = text(files[BUNDLE + "games/cozy-home/house-player036.mjs"])
    cozy_female = text(files[BUNDLE + "games/cozy-home/female-avatar001.mjs"])
    assert "revision:52" in cozy_app, "house revision 52 missing"
    assert "const warmDraw=()=>{const warmMaps=new Map(),materialClones=new Map(),objectSwaps=[]" in cozy_app, "isolated mobile shader warmup missing"
    assert "mirrors.releaseGPU();const geometries=new Set()" in cozy_app, "warm geometry and mirror release missing"
    assert "renderer.setSize(96,96,false)" not in cozy_app, "package restored the unsafe real-room preload"
    assert "const visualYaw=!postureMotion" in cozy_player, "first-person body/head resampling missing"
    assert "camera.position.addScaledVector(viewForward,.045)" in cozy_player, "eye camera forward offset missing"
    assert "procedural(0)" in cozy_female, "female procedural reset path missing"
    assert "if(Math.abs(amount)<1e-7)return" not in cozy_female, "standing pose T-pose regression returned"
    files["SOURCE_STATE.json"] = json.dumps({"sourceCommit":text(git("rev-parse","HEAD")).strip(),"upstreamBaseline":"a3a95087cd13989a9e02d8d69b5a4273bb201ee3","houseSource":"df56e66a4f24efed42e4c37ef7d1908deb95df03","privateWeb":"v1276","privateIOS":"1.0.375 (375)","bridge":38,"macBuildVerified":False,"realIPhoneVerified":False,"kind":"Mac-source-not-IPA","preserved":["all-public-v1275-features","all-private-v1276-features","private-backup-single-upload","web-cloud-existing-row-update","web-cloud-persistent-progress","private-backup-commit-timeout-720s","online-memory-recall-controls","offline-memory-scroll-restore","cozy-private-native-bridge","diagnostic-copy-freshness","native-probe-lifecycle","house052-complete-assets","first-person-head-tracking","isolated-mobile-shader-warmup","warm-gpu-resource-release","female-standing-pose"]},ensure_ascii=False,indent=2).encode("utf-8")
    files["SHA256SUMS.json"] = json.dumps({name:sha256(body).hexdigest() for name,body in sorted(files.items())},ensure_ascii=False,indent=2).encode("utf-8")

    assert not OUTPUT.exists(), "refusing to overwrite an existing package"
    with ZipFile(OUTPUT, "x", ZIP_DEFLATED, compresslevel=6) as archive:
        for name in sorted(files):
            archive.writestr(PREFIX + name, files[name])

    with ZipFile(OUTPUT) as archive:
        names = archive.namelist()
        assert len(names) == len(files)
        for name in names:
            assert archive.read(name) == files[name[len(PREFIX):]], f"round-trip mismatch: {name}"

    with TemporaryDirectory(prefix="private1276-verify-") as folder:
        with ZipFile(OUTPUT) as archive:
            assert archive.testzip() is None
            archive.extractall(folder)
        extracted=Path(folder)/PREFIX
        actual={p.relative_to(extracted).as_posix():p.read_bytes() for p in extracted.rglob("*") if p.is_file()}
        assert actual == files, "extracted file mismatch"
        validate(actual)

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
