"""Create the private v1591 / iOS 439 Mac-source overlay package (all travel and role-card changes, protected private inheritance).

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
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "native/private-small-phone/XcodeProject/"
BUNDLE = "PhoneCompanionTest/PhoneWeb.bundle/"
PREFIX = "SmallPhone_v1591_iOS439_Private/"
OUTPUT = ROOT.parent / "最新私人版本覆盖包_v1591_iOS439.zip"

WEB_VERSION = "1591"
MARKETING = "1.0.439"
BUILD = "439"
BRIDGE = "42"


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
            cozy_doc = relative.startswith(BUNDLE + "games/cozy-home/") or relative.startswith(BUNDLE + "assets/travel-home/")
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
        BUNDLE + "desk-pet.js",
        BUNDLE + "pf-group-role.js",
        "请在Mac编译前先读.md",
    }
    missing = sorted(required - files.keys())
    assert not missing, "missing private files: " + ", ".join(missing)
    assert not [n for n in files if n.lower().endswith((".md", ".txt")) and n != "请在Mac编译前先读.md" and not n.startswith((BUNDLE + "games/cozy-home/", BUNDLE + "assets/travel-home/"))], "only the current Mac guide and cozy-home documentation are retained"

    license_gate = text(files[BUNDLE + "license-gate.js"])
    assert "https://license.smallphoneapp.com" in license_gate
    assert "function browserLicenseBase(endpoint)" in license_gate
    app = text(files[BUNDLE + "app.js"])
    index = text(files[BUNDLE + "index.html"])
    alias = text(files[BUNDLE + "小手机.html"])
    pbx = text(files["PhoneCompanionTest.xcodeproj/project.pbxproj"])
    bridge = text(files["PhoneCompanionTest/PhoneNativeBridge.swift"])
    web_view = text(files["PhoneCompanionTest/LocalPhoneWebView.swift"])
    backup = text(files[BUNDLE + "private-cloud-backup.js"])
    delivery = text(files[BUNDLE + "delivery.js"])

    assert '.lockscreen{touch-action:none;overscroll-behavior:none;' in index
    assert '.lockscreen.dragging{transition:none;}' in index
    assert 'function lockGestureReset()' in app
    for marker, label in [
        ("async function controlClaimConfirm(reply,c,id,opt)", "v1349 说的话不执行，只回头确认"),
        ("【说和做分开·最高优先级】你说的话永远不会锁或解锁任何东西", "v1349 管控提示词说和做分开"),
        ("只有真的锁上或解锁时弹一下系统提示，自动消失，不写进聊天。", "v1355 锁定提示改为弹窗"),
        ("function transferMarkRoleSeen(list)", "v1349 旧转账不再突然收款"),
        ("function webShareCardMsg(q,raw)", "v1349 联网结果卡片"),
        ("原文模式也要执行控制指令", "v1349 原文模式整行指令执行"),
    ]:
        assert marker in app, f"package would drop a required repair: {label}"
    assert "function extractControl(" not in app, "package restored speech-driven control"
    for marker, label in [
        ("function rpOpen(", "v1356 红包点开是「開」"),
        ("function renderRpSend(", "v1356 发红包页"),
        ("function renderTfSend(", "v1356 转账键盘页"),
        ("<b>${RP_DEFAULT_NOTE}</b>${line?`<em>${esc(line)}</em>`:''}", "v1356 红包标题固定、祝福语第二行"),
        ("line=st==='pending'?(memo||copy):(memo?copy+' · '+memo:copy)", "v1356 转账卡片显示备注"),
        ("【本轮是从'+where+'回到微信后你主动发的第一条（最高优先级）】", "v1356 共同生活后主动消息接着共同生活说"),
        ("|吃过(?:饭|早饭|早餐|午饭|晚饭|晚餐|午餐|夜宵|东西)?(?:了|啦|咯|喽)|", "v1356 认得「吃过饭了」"),
        ("return top.concat(kept,tail).join('\\n').slice(-8000);", "v1356 后台上下文保住状态行"),
    ]:
        assert marker in app, f"package would drop a required repair: {label}"
    for marker, label in [
        ("function gqPressStart(gid,mid)", "v1363 群聊长按引用"),
        ("function rpSplitCents(total,count,rand)", "v1363 群红包拼手气"),
        ("if(pfIsRpGrabTransport(kept)){pfAbsorbRpGrab(gid,from,kept);return false;}", "v1363 真人群抢红包同步"),
        ("function renderGroupRpSend(c)", "v1363 群发红包页"),
        ("function groupPayPick(kind,id)", "v1363 群转账选择收款方"),
        ("function gmCanActOn(kind,id,actor,target,action)", "v1363 群管理规则"),
        ("function renderGroupInfoPage(", "v1363 聊天信息页"),
        ("if(!spoke&&why.length){", "v1363 群里没人回说原因"),
        ("function gCallSolo(g,cid)", "v1363 单独/合并调用"),
        ("async function groupBatchReplyItems(g,batch,recent,why)", "v1363 合并调用拆回每个人"),
        ("function applyGroupUnmuteTag(content,c)", "v1363 禁言后私聊能解禁"),
        ("content=applyControlTags(content,c,id,_statedPwd,_userText);content=applyGroupUnmuteTag(content,c);", "v1363 私聊回复处理 [群解禁]"),
    ]:
        assert marker in app, f"package would drop a required repair: {label}"
    assert ".msg.them.gnamed>span:first-child{margin-top:2px}" in index, "group bubble position missing"
    assert ".msg.them>.col>.bubble{align-self:flex-start}" in index, "v1365 quote box stretches bubble again"
    assert "function dyGCallSolo(g,m)" in app, "v1365 douyin solo/merged calls missing"
    assert "function cohabTapWait(id,item,timing)" in app and "cohabTapOn(o))cohabTapWait(c.id,item,timing).then(res)" in app, "v1369 common life tap-for-next-line missing"
    assert "mentioned.forEach(c=>plan.push(pick(c,true)));if(couple&&mentioned.indexOf(couple)<0)plan.push(pick(couple,true));" in app, "v1369 named roles first missing"
    assert "if(got.failed){" in app, "v1369 merged call fallback missing"
    assert ".cohab-tap-hint{" in index, "v1369 tap hint style missing"
    assert "function relPromptFor(c,focus,opt)" in app and "function relFriendSys(cid,f)" in app and "function relKinGroup(title)" in app, "v1381 relationship network missing"
    assert "function renderHisCard(c)" in app and ".hcard-page{" in index, "v1381 name card page missing"
    assert "if(typeof relConsumeTags==='function')r=relConsumeTags(r,c);" in app, "v1381 offline relation tags missing"
    assert "function redpOpen(scope,key,mid){" in app and "function relSelfText(k){" in app, "v1389 role play open / own birthday missing"
    assert "function pursuitPlanAhead(c){" in app and "function phClearStaleSimCall(){" in app and "setInterval(pursuitSweep,1000);" in app, "v1401 pursuit timing missing"
    assert "function dyRA(cid,fallback){" in app and "function pursuitOnUserSms(num){" in app and "body.remote-forced .remote-stop{display:none!important}" in index and ".nf-action .accept{background:#07c160" in index, "v1399 features missing"
    desk = text(files[BUNDLE + "desk-pet.js"])
    assert "function renderDeskPetPage(){" in desk and "function deskPetWear(k){" in desk and "function watchMessages(now)" in desk, "v1407 desk pet missing"
    assert f'desk-pet.js?v={WEB_VERSION}' in index, "private entry does not load desk-pet.js"
    assert "else if(c.p==='deskPet')html=" in app and "deskPetConsume(line,c);continue;" in app and "s+=deskPetPrompt(c);" in app, "v1407 desk pet wiring missing"
    assert "桌面伙伴 · 表情联动" not in text(files[BUNDLE + "private-robot-face.js"]), "duplicate 小 K settings row came back"
    pfr = text(files[BUNDLE + "pf-group-role.js"])
    assert "function pfRoleRow(m,pl,gid,g){" in pfr and "function quietByRule(gid){" in pfr and f'pf-group-role.js?v={WEB_VERSION}' in index and "pfRoleRow(m,pl,gid,g)" in app, "v1419 roles in real groups missing"
    assert "return bubbleSingleHTML(m.text,'',bstyle,me);}" in app, "v1419 grey @ bubble missing"
    assert "function roleMarkRead(id){" in app and "function roleSeenTick(){" in app and "function pfReadInPlace(id){" in app and ".msgread-line{position:absolute" in index, "v1413 read receipts missing"
    assert "'平静':{eyes:'open',cls:''}" in text(files[BUNDLE + "desk-pet.js"]), "v1413 calm desk pet eyes missing"
    assert "function holidayCare(id,name,date,opt){" in app and "LUNAR_FESTIVALS" in app and "if(!_wantBg)continue;" in app, "v1409 holiday care / explicit background missing"
    assert "function schedAddLeave(id){" in app and "function roleDayOff(c,t){" in app, "v1407 manual leave / holidays missing"
    assert "async function audioOrphanGC(){" in app and "storage.clearTemp" in app and 'case "storage.clearTemp":' in bridge, "v1391 cleanup missing"
    assert "countIDBKeys(imgDB,'img'," in app and "storage.clearWebCache" in app and ".hcard-head>div:not(.avatar)" in index, "v1389 storage detail / card avatar missing"
    assert "function groupQrParse(" in text(files[BUNDLE + "wechat-me.js"]) or "groupQrParse" in text(files[BUNDLE + "wechat-me.js"]), "group QR scan hook missing"
    assert "连不上配对服务器" in text(files[BUNDLE + "public-north-runtime.js"]), "pairing retry missing"
    theme = text(files[BUNDLE + "glass-theme.css"])
    assert ".wxlight .wx-tfs-panel{background:#fff}" in theme and ".wx-rp-main{min-height:60px;padding:12px 14px 6px;" in theme, "red packet styles missing"
    for name in ["robot-face-protocol.js","private-robot-face.js","private-robot-voice.js","private-device-history.js","private-cloud-usage.js","assets/k-default-face.png"]:
        assert BUNDLE + name in files, "robot K component missing: " + name
        assert f'{name}?v={WEB_VERSION}' in index or name.startswith("assets/"), "private entry does not load " + name
    assert "return APPNAME2KEY[n]||Object.keys(LOCKABLE).find(k=>LOCKABLE[k]===n);" in app, "cinema/travel lock names would fail again"
    assert "toast((c.remark||c.name)+notices.join('，'),2600);" in app and "content:'🔐 '" not in app, "lock notices must be a transient toast, not a chat line"
    assert "RobotVoice.roleActive(id)" in app and "robotFaceFirstVisible(" in app, "robot K reply hooks missing"
    assert 'case "robot.speech.transcribe":' in bridge, "native robot speech bridge missing"
    assert "function wechatStripReasoningEnvelope(value)" in app, "package restored the pre-v1338 reasoning leak handling"
    assert "function browserLicenseBase(endpoint)" in text(files[BUNDLE + "license-gate.js"]), "package restored the pre-v1332 license gate"
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
    for action in ("begin", "chunk", "commit", "progress", "abort"):
        assert f"account.backup.file.{action}" in backup, f"private backup action missing: {action}"
        assert f'"account.backup.file.{action}"' in bridge, f"native backup action missing: {action}"
    assert "const CHUNK=192*1024" in backup, "private backup fell back to an oversized whole-object bridge"
    assert "account.backup.file.commit',{token},1920000" in backup, "web backup timeout does not cover the complete multi-part native upload"
    assert "手机号私人备份和网页镜像是两个入口" in backup, "private account backup still starts a second full web mirror"
    assert "privatePrimaryMirrorUpload(await fullBackupState())" not in backup, "private account backup regenerates the full archive"
    assert "await cloudBackup({current,onProgress:" in app, "existing web cloud backups are no longer updated"
    assert "id=\"cloud_backup_now\"" in app and "上一份云备份仍在进行" in app, "web cloud progress or duplicate-click guard missing"
    assert "private actor PrivateBackupFileStore" in bridge
    assert "privateBackupChunkBytes = 4 * 1_024 * 1_024" in bridge
    assert "privateBackupStorageURL" in bridge and "uploader.upload(" in bridge
    assert "from: part" in bridge, "backup is not uploaded as bounded object chunks"
    assert "/rest/v1/rpc/save_private_phone_backup_manifest" in bridge
    assert "privateBackupFileMetadata" in bridge and "restorePrivateBackupFile" in bridge
    assert "SHA256.hash(data: archive)" in bridge, "restore checksum guard missing"
    assert '"backup_storage_failed"' in bridge, "storage failures are mislabeled as account failures"
    assert "action === 'account.backup.file.commit' ? 1800000 : 60000" in web_view
    assert "PrivateBackupUploadProgressDelegate" in bridge
    assert "正在上传私人云备份" in backup
    assert "backup_upload_timeout" in bridge
    assert "isa = PBXFileSystemSynchronizedRootGroup;" in pbx and "path = PhoneCompanionTest;" in pbx
    assert not re.search(r"membershipExceptions = \([^)]*private-cloud-backup\.js", pbx, re.S), "private backup component was excluded from the Xcode target"
    for marker, label in [
        ("function explicitMemoryFromUserText(", "v1333 明确长期外卖偏好直接保存"),
        ("function contextualKfcAction(", "v1333 KFC 随便点和四件套续接"),
        ("function brandOnlyDeliveryRequest(", "v1333 只说品牌时自然追问"),
    ]:
        assert marker in delivery, f"package would drop a required delivery repair: {label}"

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
        ("function controlClaimCandidates(reply)", "v1257 威胁不触发真锁（v1348 起说的话一律不执行）"),
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
        ("m.from==='me'?av(dyAvatar(),'sm'):dyFace(dyRA(d.cid,d.avatar),'sm')", "v1265 私信我这边也有头像"),
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
        ("function callResponseUnits(pieces,lang,rawOutput)", "v1281 通话内嵌翻译拆分与去重"),
        ("m._call&&!m._callTranslationOf", "v1281 通话记录隐藏翻译辅助行"),
        ("\\s*[^|｜:：\\]】]+\\s*[|｜:：][^\\]】]+", "v1281 所有智能家居标签最终隐藏"),
        ("function phImsgOn(num,sk)", "v1294 信息页照 iMessage 重做"),
        ("function phSmsBgMap()", "v1294 聊天背景一人一张"),
        ("function phSmsPic(num,sk)", "v1294 ＋ 点一下开相册"),
        ("function phSendSmsImage(num,sk,src,opt)", "v1294 短信能发图片"),
        ("function phRoleSetSmsBg(num,sk)", "v1294 角色把照片换成短信背景"),
        ("c.chatBg=last.src;save();", "v1294 角色把照片换成微信背景"),
        ("function phCtxRows()", "v1294 上下文统一跟随全局"),
        ("function phSmsBubbleRange(c)", "v1294 短信条数跟通讯录设置"),
        ("function phDeliverSmsBubbles(num,sk,list,c)", "v1294 短信一条条出"),
        ("function phSmsTypingSet(num,sk,on)", "v1294 短信正在输入的三个点"),
        ("function phSmsTyping()", "v1294 有字才出现蓝色发送键"),
        ("const bg=phSmsBg(num),name=phName(num),sel=phSmsSelOn(sk);", "v1296 主号／匿名号那条不压在输入框上面（v1313 起这行还带多选开关）"),
        ("async function phSmsVision(m,file)", "v1298 短信里的照片真的识图"),
        ("function phSmsImgLine(m)", "v1298 识出来的画面进上下文"),
        ("function phSmsRetryVision(num,mid,sk)", "v1298 没识出来的能重试"),
        ("else setTimeout(()=>phAutoSmsReply(num,line),700+Math.random()*900);", "v1298 发完图非角色联系人也有人回"),
        ("d.msgs.slice(-phCtxRows())", "v1294 X 私信跟随全局上下文"),
        ("Number.isFinite(n)&&n>0?n:Math.min(60,phCtxRows())", "v1294 抖音私信没单独设就跟随全局"),
        # ——— v1300 这一轮 ———
        ("async function compressChatBackground(file)", "v1300 聊天背景不再压画质"),
        ("compress(file,2600,.93)", "v1300 聊天背景第一档 2600/.93"),
        ("chatBg=await compressChatBackground(f)", "v1300 微信换背景走高清那档"),
        ("src=await compressChatBackground(f);", "v1300 短信换背景走高清那档"),
        ("compress(f,1400,.82)", "v1300 短信发图不再压到 900"),
        ("activitySpec(c,roleClockDate(d.phaseAt))", "v1300 共同生活手动保存用角色的钟"),
        ("if(d.phase==='home')return ['在家',place?'在'+place:'',extra]", "v1300 在家也显示正在做什么"),
        ("placeHint=opt.placeSet?(opt.place||'')", "v1300 手动清空地点就是清空"),
        ("source:'owner-manual'});closeModal();render();", "v1300 手动改完一定重绘"),
        ("const PH_FX_TEXT=[", "v1300 文字特效"),
        ("function phFxRuns(text,ch)", "v1300 效果按字存、连着的合成一段"),
        ("function phFxSync()", "v1300 改字时效果跟着那几个字走"),
        ("function phFxSendHold(", "v1300 长按发送键带效果发送"),
        ("function phScreenFx(kind,m)", "v1300 整屏特效"),
        ("function phSmsPlusMenu(", "v1300 文字效果收进 ＋ 里"),
        # ——— v1302 这一轮：抖音发作品四处修复 ———
        ("function roleDouyinDedupeText(c,tx)", "v1302 重复文案自动编号，绝不静默吞掉"),
        ("const DY_TAG_RE=", "v1302 发抖音标签按行贪婪匹配"),
        ("const DY_TAG_BARE_RE=", "v1302 光秃秃的 [发抖音] 也认"),
        ("async function ensureRequestedDouyin(content,c,userText)", "v1302 她明确让发就兜底补一条"),
        ("function roleDouyinAskIntent(text)", "v1302 分得清「发个抖音」和「先别发抖音」"),
        ("return roleDouyinRecentImage(c,3*3600000,12)", "v1302 没点名也往回看三小时十二条"),
        ("function dyMusicCoverHTML(s,cls)", "v1302 歌的封面从图库里取"),
        ("dyDelVideo('${id}')", "v1302 别人的作品也删得掉"),
        # ——— v1300 这一轮的特效返工也在这一包里 ———
        ("function phFxOpenText(", "v1300/1302 一个字一个字地挑"),
        ("function phFxParseTags(", "v1302 角色自己也能发特效"),
        ("function phFxTagHelp(", "v1302 提示词里把特效标签讲给他听"),
        ("const PH_INV_DONE=", "v1302 隐形墨水刮开六成就散"),
        ("function phInvScratch(", "v1302 隐形墨水是手指刮的"),
        ("groupComposerHTML('pffriend'", "v1302 真人好友用和角色一样的聊天框"),
        # ——— v1305 这一轮：特效按她的反馈返工 ———
        ("function phFxSwell(node)", "v1305 字撑大了气泡跟着鼓"),
        ("if(Math.abs(grow)<8||Math.abs(grow)/bw<.12)return;", "v1305 撑不动就不撑（「比较小的就不会」）"),
        ("function phFxSwellAll()", "v1305 重绘之后重新量气泡"),
        ("const SR=stage.getBoundingClientRect(),SH=", "v1305 按屏幕真实高度算，不再用 vh"),
        ("--rise:${(SH*(1-cy/100)).toFixed(0)}px", "v1305 烟花真的从屏幕底部升空"),
        # ——— v1307 这一轮：短信语音 + 特效再返工 ———
        ("function phSmsVoiceHelp(c)", "v1307 告诉角色短信也能发语音"),
        ("m.voice=1;m.type='voice';m.role='assistant';m.content=say;m.text=say;", "v1307 语音存成和微信一样的形状"),
        ("function phVoiceTap(num,mid,sk)", "v1307 点一下播放并转文字"),
        ("function phSmsVoiceLine(m)", "v1307 语音进上下文时带上原文和翻译"),
        ("function phSmsLineText(m)", "v1307 图片和语音都要让模型看见"),
        ("scheduleVoiceWarm(m,c,voiceProgressiveOn())", "v1307 收到语音就预热 TTS"),
        ("const PH_BURST_FLY=2300,PH_BURST_GONE=5000;", "v1307 爆发摔两下、消失整整五秒"),
        ("function phBurstPlay(node)", "v1307 爆发贴到屏幕层上飞（气泡会裁掉）"),
        ("const dir=i%2?1:-1,bx=dir*(52+((i*37)%37))", "v1307/1309 爆发方向按序号算死，范围已收小"),
        ("const a=n*2.399963", "v1307 回声落点用黄金角铺满整屏"),
        ("if(b>a&&b<=text.length)for(let i=a;i<b;i++)pick.push(i);", "v1307 选字默认一个都不选"),
        # ——— v1309 这一轮 ———
        ("async function pfStickerImage(s)", "v1309 真人好友表情包先把真图读出来"),
        ("async function pfStickerBody(s)", "v1309 表情包打包（读出真图之后再判大小）"),
        ("const r=await pfStickerBody(s);if(!r.body){toast(r.why);return;}", "v1309 读不出来要吭一声"),
        ("const stk=storedImageDisplaySource(p.img);", "v1309 以前发坏的表情包也能显示"),
        ("function dyGMuteWechatFollowup(g,actorKey,mins)", "v1309 抖音群禁言之后来微信找她"),
        ("function dyGMuteContext(g,n)", "v1309 把当时群里真的发生了什么带过去"),
        ("if(target.k==='me'&&actorKey!=='me')wx=dyGMuteWechatFollowup(g,actorKey,mins);", "v1309 只有她被别人禁才触发"),
        ("function dyGUngagFromWechat(cid)", "v1309 他写 [解禁] 真的解掉"),
        ("function consumeDouyinUngag(content,c,audit)", "v1309 [解禁] 标签不显示出来"),
        # ——— v1311 这一轮 ———
        ("const prevLast=pc.last;pc.n++;pc.last=Date.now();save(0);", "v1311 每日一封信先占坑再写"),
        ("live.n--;live.last=prevLast;save();", "v1311 信写失败要退坑"),
        ("不许替'+S.me.name+'把还没发生的事演完", "v1311 不许角色预演没发生的事"),
        ("function callActionLineForeign(line)", "v1311 通话动作描写必须中文"),
        ("function callStripForeignActions(text)", "v1311 外文动作整行丢掉"),
        ("content=callStripForeignActions(content);", "v1311 挂在通话处理链上"),
        ("if(typeof document!=='undefined'&&document.hidden)return true;", "v1311 后台说话不误报网络"),
        ("function liveLocMatch(text)", "v1311 只认城市、不兜底"),
        ("liveLocMatch(hint)||liveLocMatch(c.city)||liveLocMatch(charHomeCity(c))", "v1311 地图跟资料里的城市走"),
        ("<span class=\"cmt-re\">回复</span>", "v1311 朋友圈去掉 @"),
        # ——— v1313 这一轮 ———
        ("function phFxWantFromText(text)", "v1313 认出她在短信里要哪个效果"),
        ("const PH_FX_WANT_CUE=", "v1313 得像在要才算点单，随口感叹不算"),
        ("function phFxWantPrompt(want)", "v1313 把「必须写这个标签」钉进这一轮"),
        ("function phSmsApplyWantedFx(num,sk,sent,want)", "v1313 他忘了写标签就兜底补上"),
        ("phFxTagHelp()+phFxWantPrompt(_want)", "v1313 挂在短信那一轮的系统提示上"),
        ("phSmsApplyWantedFx(num,sk,_sent,_want)", "v1313 发完真的兜底"),
        ("function phSmsSelEnter(num,sk)", "v1313 短信多选删除"),
        ("function phSmsSelBarHTML()", "v1313 多选时底栏换成删除条"),
        ("function phSmsComposerHTML(num,sk)", "v1313 输入框抽出来了"),
        ("多选删除信息", "v1313 ＋ 号里的入口"),
        ("function phClearContactChat(num)", "v1313 联系人页一键清空全部聊天"),
        ("function phContactSmsKeys(num)", "v1313 只清这个人名下的几条线"),
        ("if(_main){const gd=(c.grudges||[]);", "v1313 统一模式下也把记仇本发给角色"),
        ("if(!_natural&&_gn>=8&&S.couple", "v1313 满 8 笔关小黑屋保留原样，没顺手打开"),
        ("这本子只有你自己看得见", "v1313 什么事值得记，写清楚了"),
        # ——— v1325 这一轮 ———
        ("s+='\\n- 聊天背景：'+S.me.name+'让你把某张照片换成你们的聊天背景", "v1325 换背景说明单独发，不再挂在表情包的 if 里"),
        ("只在嘴上说「换好了」是没有用的", "v1325 光说没用，写死在提示词里"),
        ("function wechatBgRequest(text)", "v1325 认出她在要换背景"),
        ("function wechatApplyBgRequest(c,id)", "v1325 他忘了写标签就替他换上"),
        ("if(_wantBg&&!_bgApplied)wechatApplyBgRequest(c,id);", "v1325 收尾兜底"),
        ("const OFF_THEME_DEF=", "v1325 线下配色"),
        ("function offStageAttrs(c)", "v1325 线下主题＋背景挂到舞台上"),
        ("function offAppearance(id)", "v1325 线下外观面板"),
        ("function offSkinSet(id,skin)", "v1325 两套主题切换"),
        ("t.skin=t.skin==='classic'?'classic':'glass';", "v1325 主题只认这两个"),
        ("function offBgPick(id)", "v1325 线下换背景（不压画质）"),
        ("function offFieldHTML(placeholder)", "v1325 线下输入框包了一层玻璃"),
        ("const PF_CID_PREFIX='pf:'", "v1325 真人好友转账走角色那一套"),
        ("function pfTransferView(m)", "v1325 pf 转账翻成角色转账的形状"),
        ("function pfTransferDetailAction(fid,mid,action)", "v1325 pf 收款/退还"),
        ("function pfHandleTransferRefund(m)", "v1325 对方退还之后钱退回来"),
        ("p.type==='style_update'||p.type==='transfer_refund'", "v1325 退还消息不当气泡显示"),
        ("c.p==='pfchat'?'pf_input':'ginput'", "v1325 真人好友 1v1 的输入框终于被绑上"),
        ("else if(c.p==='pfchat')sendPhoneFriend(c.id)", "v1325 回车也能发"),
        ("||c.p==='pfchat')afterGroupComposer(c);", "v1325 渲染完要去绑"),
        ("${pfPanelHTML(id)}`;}", "v1325 真人好友功能面板在输入框下面"),
        ("${pfGroupPanelHTML(gid)}`;}", "v1325 群聊功能面板也在下面"),
        ("onclick=\"genCharPrompt()\">✨ 一键生成", "v1325 新的朋友里的一键生成入口"),
        # ——— v1329 这一轮 ———
        ("function deliveryStructuredActionTags(value)", "v1329 外卖动作支持商品名内部嵌套中文方括号"),
        ("function deliveryIsolateStructuredActions(value)", "v1329 外卖动作与角色正文可靠分行"),
        ("function deliveryReplaceStructuredActions(value,replacer)", "v1329 通话路径同样完整消费嵌套外卖动作"),
        ("任何未完整消费的外卖控制标签都必须静默拦截", "v1329 畸形外卖标签不会显示成角色气泡"),
        ("function storedImageElementSource(v)", "role cover cache-miss hydration"),
        ("应用处理\\s*[|｜]", "internal app decision visibility"),
    ]:
        assert marker in app, f"package would drop a required repair: {label}"
    # 这一轮的外壳样式同样不许漏（信息页整页都靠它们）
    for marker, label in [
        (".imsg-row.them .imsg-b{padding:8px 14px 8px 21px;clip-path:polygon(", "v1294 气泡连尾巴一整块剪出来"),
        (".imsg-row.them .imsg-b:before{clip-path:polygon(", "v1294 高光是沿轮廓描的细线"),
        ("backdrop-filter:brightness(1.72) saturate(1.68)", "v1300 高光跟着背景变颜色"),
        (".imsg-row .imsg-b.pic{padding:0!important;background:none!important;", "v1294 图片是原模原样的"),
        (".imsg-b.typing>i span{", "v1294 短信正在输入的三个点"),
        (".imsg-tick{", "v1313 多选的小圆圈"),
        (".offmsg.them .offbubble{padding:9px 15px 9px 22px;background:var(--offc-them);", "v1325 线下气泡走同一套轮廓"),
        (".offstage .offmsg .offbubble:before{", "v1325 线下那条细高光环"),
        (".offstage{--offc-me:#0a84ff;", "v1325 线下配色变量"),
        (".off-field:before,.offinput .send:before{", "v1325 输入框和按钮那圈挖空的环"),
        (".off-date-nav>.t{position:absolute!important;left:50%!important;", "v1325 线下昵称按整条栏居中"),
        (".off-reply-top{position:relative;height:27px;", "v1325 让TA回改成灰玻璃"),
        (".offstage.off-classic .offmsg .offbubble{clip-path:none!important;", "v1325 原来那套主题原样留着"),
        (".offstage.hasbg{background-size:cover;background-position:center;background-repeat:no-repeat;}", "v1325 壁纸真的铺满全屏"),
        (".offstage.hasbg:not(.off-classic) .cohab-settings{", "v1325 共同生活设置也变玻璃"),
        (".offstage.hasbg:not(.off-classic) .cohab-status-chip{position:relative;", "v1325 在家的状态也变玻璃"),
        (".offstage.hasbg:not(.off-classic) .cohab-debug-reply{", "v1325 共同生活的让TA回也变玻璃"),
        (".imsg-selbar{", "v1313 多选底栏"),
        (".imsg-body.selmode .imsg-row.me .imsg-col{margin-left:auto;}", "v1313 多选时我的气泡照样靠右"),
        (".dyfd-card.photo .dyimg img{width:100%;height:100%;max-height:none;object-fit:contain;}", "v1313 抖音首页图按原比例"),
        (".dywk-frame.photo .dyimg img{width:100%;height:100%;max-height:none;object-fit:contain;}", "v1313 作品详情页图按原比例"),
        # v1300 的玻璃：身子磨砂在父元素上，描边剪成一个环压在上面。
        # 做法见 docs/maintenance/液态玻璃_磨砂加细高光_做法.md，环由
        # scripts/glass_ring_polygon.py 生成，别手改。
        (".imsg-b{position:relative;max-width:74%", "v1300 气泡身子是磨砂的"),
        ("backdrop-filter:blur(14px) saturate(1.32)", "v1300 磨砂在身子那一层"),
        ("mask-composite:exclude;", "v1300 按钮那圈是挖空的细边"),
        ("padding:.8px;box-sizing:border-box;", "v1300 按钮描边只有 .8px"),
        # v1307 起爆发不在气泡里循环了（气泡的 clip-path 会把飞出去的字整块裁掉），
        # 改成贴屏幕层飞，所以这里盯的是 .imburst 那一套，见下面

        (".imsfx{position:absolute;inset:0", "v1300 整屏特效盖满全屏"),
        (".btn.imblue{", "v1300 信息里的弹窗用气泡那个蓝"),
        # ——— v1302 这一轮的特效返工 ———
        (".imfx{display:inline-block;font-style:inherit;font-weight:inherit;font-family:inherit;}",
         "v1302 加特效不许改字体"),
        ("-webkit-mask:url(\"data:image/svg+xml,", "v1302 爱心是一整条 SVG 路径，没有拼接线"),
        ("@keyframes imsfx-ring{", "v1302 烟花的冲击波环"),
        (".imsfx-balloons i>u{", "v1302 气球的线插在中间"),
        (".iminv-cv{", "v1302 隐形墨水那层刮开的画布"),
        (".imfx-pick b.on{", "v1302 选字面板"),
        (".dymu-cover{", "v1302 抖音选音乐的封面"),
        # ——— v1305 ———
        (".imsg-b.imb-swell{animation:imb-swell 4.2s infinite;}", "v1305 气泡被字撑大"),
        ("@keyframes imfx-jitter{0%,62%,100%", "v1305 抖动提频到 11.4Hz"),
        ("@keyframes imsfx-flutter{", "v1305 纸屑扇动那一层（不会被压成线）"),
        ("@keyframes imsfx-hsway{", "v1305 爱心左右摇那一层"),
        ("@keyframes imsfx-night{", "v1305 把屏幕压暗"),
        (".imsfx-fireworks i.spark{width:0;height:0;opacity:0;", "v1305 碎片炸开前不许亮"),
        # ——— v1307 ———
        (".imburst{position:absolute;inset:0;", "v1307 爆发的屏幕层"),
        ("@keyframes imburst-fly{", "v1307 爆发摔两下的轨迹"),
        (".imfx-burst.away .imfxc{visibility:hidden;}", "v1307 飞的时候原字藏起来"),
        ("@keyframes imsfx-echo{", "v1307 回声照真机重做"),
        (".imsfx-echo i{left:var(--ox);top:var(--oy)", "v1307 回声从这条气泡出发"),
        (".imsfx-fireworks{animation:imsfx-night", "v1307 放烟花时屏幕也压暗"),
        (".imsg-b.imsgv{cursor:pointer;align-self:flex-start;}", "v1307 短信语音条"),
        (".imsgv-wave i{", "v1307 语音条的波形"),
        (".imsg-vtext .tr:before{content:'译 '", "v1307 外语语音底下的中文翻译"),
        (".imsfx i{position:absolute;display:block;font-style:normal;}", "v1307 粒子里的字不许变斜体"),
    ]:
        assert marker in index, f"package would drop a required style: {label}"
    for marker in ("function rolePhoneLocalRead(", "function rolePhoneLocalCommit(", "function coupleTasksEnabled(", "function pfTransferReceiptMessage(", "function effCallProb(c)", "function roleCallPreferenceOpen(id)", "function roleCallPreferenceSave(id)"):
        assert marker in app, "missing inherited/current repair: " + marker
    assert app.count("northNativeBackgroundTask") >= 30, "private background-task wrappers missing"
    assert "north-native-performance-guard" in app, "private performance guard missing"

    for resource in ("travel-home.js", "travel-hotel.js", "travel-hotel-data.js", "travel-guide.js", "travel-ticket-data.js", "travel-flight.js", "travel-flight-booking.js", "travel-train.js", "travel-train-booking.js", "travel-concert.js", "travel-concert-booking.js", "travel-taxi.js", "travel-regions.js", "destination-photos.js", "travel-gallery.js", "travel-payment.js"):
        assert BUNDLE + resource in files, "missing travel module: " + resource
        assert resource + "?v=" + WEB_VERSION in index, "unloaded travel module: " + resource
    assert app.count("NorthTravelPayment.currentRequest(id)") == 2
    assert "NorthTravelPayment.pending(id)" not in app
    assert "name(c)+'代付成功'" in text(files[BUNDLE + "travel-payment.js"])
    assert "rf-bank-expenses" in text(files[BUNDLE + "role-family-card.js"])
    for entry in (index, alias):
        for resource in re.findall(r'(?:src|href)=["\']([^"\'?#]+\.(?:js|css))', entry):
            if "://" not in resource:
                assert BUNDLE + resource in files, "missing loaded asset: " + resource
    previous = ROOT.parent / "最新私人版本覆盖包_v1525_iOS437.zip"
    assert sha256(previous.read_bytes()).hexdigest() == "8f3bc3f9c07662989a9643eda4a054193e40fcd470977af0989b0b26f7ff1e91"
    with ZipFile(previous) as archive:
        prefix = next(n for n in archive.namelist() if n.endswith("/SOURCE_STATE.json"))[:-len("SOURCE_STATE.json")]
        prior = [n[len(prefix):] for n in archive.namelist() if n.startswith(prefix) and not n.endswith("/") and not n.endswith(("SOURCE_STATE.json", "SHA256SUMS.json"))]
        assert set(prior) - files.keys() == {BUNDLE + "daily-event-ledger.js", BUNDLE + "ai-account.js"}, "unexpected previous delivery files missing"

    # Both the v1420 inheritance and this release must be in the actual archive.
    for marker in ("function roleInternalControlLine(", "function gRpRecipient(", "function groupTransferDetailAction(", "function wxUnreadTotal(", "function dyStrangerParse(", "async function pfTransportRoute(", "function offDelHistory(", "_offNarrateById", "function roleTextTranslationHTML(", "function roleChatRouteSet(", "function roleMomentImagesAllowed("):
        assert marker in app, "missing v1420/v1422 repair: " + marker
    theater = text(files[BUNDLE + "cohab-theater.js"])
    for marker in ("function theaterTurnOrder(", "function theaterSyncAddressFromUI(", "t.addressAway", "roleInternalControlLine"):
        assert marker in theater, "missing inherited theater repair: " + marker
    assert ".wx-unread-badge" in text(files[BUNDLE + "glass-theme.css"])
    assert int(WEB_VERSION) % 2 == 1, "private release must be odd"

    for name in ("mail-outbox.js", "mail-outbox.css", "role-family-card.js", "role-family-card.css"):
        assert BUNDLE + name in files, "missing new shared feature: " + name
        assert f'{name}?v={WEB_VERSION}' in index, "new component not loaded: " + name
    assert "function familyRoleBuy(" in text(files[BUNDLE+"role-family-card.js"])
    assert "function familyRoleDecide(" in text(files[BUNDLE+"role-family-card.js"])
    assert "function mailCommitReply(" in text(files[BUNDLE+"mail-outbox.js"])
    assert "function requestedCommand(" in text(files[BUNDLE+"desk-pet.js"]) or "deskPetRequestedCommand" in text(files[BUNDLE+"desk-pet.js"])
    mail = text(files[BUNDLE + "mail-outbox.js"])
    for marker in ("function mailSender(", "function mailForwardHistory(", "function mailForwardCard(", "function mailCommitReply(", "l.inReplyTo=source.id", "mail-home-back", "S.me.wxTheme==='white'"):
        assert marker in mail, "missing latest mailbox behavior: " + marker
    for shared in ("mail-outbox.js", "mail-outbox.css", "travel-hotel-data.js", "travel-payment.js", "travel-flight-booking.js", "travel-train-booking.js", "travel-concert-booking.js", "travel-taxi.js", "travel-guide.js", "role-family-card.js", "role-family-card.css"):
        assert files[BUNDLE + shared] == git("show", "HEAD:" + shared), "shared feature differs: " + shared
    assert "mailRead" in app and "mailWrite" in app
    assert app.count("await familyRoleConsume(content,c)") == 4
    assert "familyRoleBank(id)" in app and "spyShopOrderRows(id)" in app
    assert "mailInboxPrompt(c)" in app
    assert "chat-glass-nav" in app
    assert len([n for n in files if n.startswith(BUNDLE)]) >= 350, "private web bundle looks incomplete"


def main() -> None:
    dirty = text(git("diff", "HEAD", "--name-only", "--", SOURCE)).strip()
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
    assert 'function wxUnreadRestore()' in text(files[BUNDLE + 'app.js'])
    assert 'wxUnreadJournalWrite();save(durable?' in text(files[BUNDLE + 'app.js'])
    # Compare the entire last delivered package, including its verified manifest.
    previous = ROOT.parent / "最新私人版本覆盖包_v1549_iOS439.zip"
    previous_sha = "bad2885137bed1972d21853c1728b3b755098217a343887fed179250a4b63ca2"
    assert sha256(previous.read_bytes()).hexdigest() == previous_sha
    with ZipFile(previous) as old:
        old_prefix = "SmallPhone_v1549_iOS439_Private/"
        previous_files = {n[len(old_prefix):]: old.read(n) for n in old.namelist() if n.startswith(old_prefix) and not n.endswith("/")}
    prior_manifest = json.loads(previous_files["SHA256SUMS.json"])
    assert set(prior_manifest) == previous_files.keys() - {"SHA256SUMS.json"}
    for name, digest in prior_manifest.items():
        assert sha256(previous_files[name]).hexdigest() == digest, "previous package checksum mismatch: " + name
    # This component was explicitly retired in v1554; retaining it would restore a removed feature.
    retired = {BUNDLE + "daily-event-ledger.js", BUNDLE + "ai-account.js"}
    assert previous_files.keys() - files.keys() - {"SOURCE_STATE.json", "SHA256SUMS.json"} == retired
    for name, body in previous_files.items():
        if name not in {"SOURCE_STATE.json", "SHA256SUMS.json", "请在Mac编译前先读.md"} and not name.startswith(BUNDLE):
            assert files[name] == body, "unexpected native or signing change: " + name
    state = json.loads(previous_files["SOURCE_STATE.json"])
    assert state["sourceCommit"] == "beb14a18c8a1f163dd9b6afc2d48c8dc3d8f66bd"
    additions = [
        "v1552-role-real-image-display-and-context", "v1552-pixel-game-collision-and-zoom",
        "v1552-friend-send-and-call-recovery", "v1554-role-wechat-switch-account-password-and-unbind",
        "v1566-role-wechat-four-pages-theme-and-relationship-avatars",
        "v1566-role-moments-own-avatar-cover-and-album", "v1566-role-services-wallet-and-independent-favorites",
        "v1566-role-chat-image-sticker-sync-and-multiselect-delete",
        "v1566-role-wallet-redpacket-transfer-shared-receipt-refund-ledger",
        "v1566-forged-message-visible-hint-hidden-metadata-preserved",
        "v1566-role-phone-all-apps-independent-appearance-and-reset",
        "v1568-role-phone-inline-name-and-location-alignment",
        "v1570-role-wechat-author-bound-bubble-configuration",
        "v1570-role-phone-transparent-glass-pin-pad-and-independent-lock-wallpaper",
        "v1572-role-aware-photo-album-phone-inspection-and-moments",
        "v1574-favorites-role-likes-metadata-classification-flicker-share-return",
        "v1576-notification-swipe-dismiss-and-nearby-couple-permission",
    ]
    state["preserved"] = sorted((set(state["preserved"]) - {"v1344-daily-ledger-turn-evidence"}) | set(additions))
    state["retired"] = [{"file": BUNDLE+"daily-event-ledger.js", "commit": "a804f37a", "reason": "User requested removal; independent notes and existing data preserved."}, {"file": BUNDLE+"ai-account.js", "commit": "3708d8e1", "reason": "User requested AI account and internal speech/subtitle retirement, replaced by photo album; external interfaces retained."}]
    state["sourceCommit"] = text(git("rev-parse", "HEAD")).strip()
    state["webSourceCommit"] = state["sourceCommit"]
    state["webVersion"] = "v1589"
    state["privateWeb"] = "v" + WEB_VERSION
    state["privateIOS"] = f"{MARKETING} ({BUILD})"
    state["lastDeliveredPackage"] = {"name": previous.name, "sha256": previous_sha, "sourceCommit": "beb14a18c8a1f163dd9b6afc2d48c8dc3d8f66bd"}
    state["knownUnresolved"] = [x for x in state["knownUnresolved"] if not re.match(r"v\d+-mac-build", x)] + ["v1591-mac-build-signing-and-iphone-not-verified"]
    state["validation"] = {"macBuildVerified": False, "realIPhoneVerified": False, "models": "HTTP simulated in browser gates", "nodeTests": {"passed": 3384, "failed": 0, "sourceCommit": state["webSourceCommit"]}, "authorizedChatBothRuntimes": True, "inheritedPreviousOverlay": True, "priorPackageManifestVerified": True, "nativePayloadUnchanged": True, "houseResourceFiles": len(cozy_files), "retiredFiles": sorted(retired)}
    app = text(files[BUNDLE + "app.js"])
    for marker in ("function hisChatMessageHTML(", "bubbleLook(c,!mine)", "bubbleIconFor(c,!mine)", "bubbleAvatarClass(c,!mine)", "function hisWxUtilityOpen(", "function hisWxFriendAvatar(", "function spyLockScreen(", "lockWallpaper", "_hisPaymentId", "_forged"):
        assert marker in app, "latest role WeChat/phone repair missing: " + marker
    wxme = text(files[BUNDLE + "wechat-me.js"])
    assert "window.wxRoleUtilityAppearance=" in wxme and "window.wxRoleMeAppearance=" in wxme
    assert files[BUNDLE + "wechat-me.js"] == git("show", "HEAD:wechat-me.js"), "shared WeChat appearance differs"
    css = text(files[BUNDLE + "glass-theme.css"])
    prior_css = text(previous_files[BUNDLE + "glass-theme.css"])
    guard_start = prior_css.index("/* A measured private-App stall")
    guard_end = prior_css.index("html.north-native-app.north-native-performance-guard .home img{filter:none!important}", guard_start) + len("html.north-native-app.north-native-performance-guard .home img{filter:none!important}\n")
    private_guard = prior_css[guard_start:guard_end]
    assert css.count(private_guard) == 1, "inherited private performance guard missing"
    assert [line for line in css.replace(private_guard, "").splitlines() if line.strip()] == [line for line in text(git("show", "HEAD:glass-theme.css")).splitlines() if line.strip()], "shared appearance differs beyond inherited private guard"
    css = text(files[BUNDLE + "glass-theme.css"])
    for marker in ("function statusBarColorSet(", "function homeVinylOpacitySet(", "function lockPullAppearanceSet(", ".vinyl-record:before{content:", "north-shell-custom", "function glassInnerAppearance(", "function appIconRimSet("):
        assert marker in css + text(files[BUNDLE + "app.js"]), "latest appearance fix missing: " + marker
    recent = ROOT.parent / "最新私人版本覆盖包_v1587_iOS439.zip"
    recent_sha = "1cb1df4108b71db9aa6a01107041e08c9eb9757c5c62dc9ea77c0ce825b1da65"
    assert sha256(recent.read_bytes()).hexdigest() == recent_sha
    with ZipFile(recent) as old:
        recent_prefix = next(n for n in old.namelist() if n.endswith("/SOURCE_STATE.json"))[:-len("SOURCE_STATE.json")]
        recent_files = {n[len(recent_prefix):]: old.read(n) for n in old.namelist() if n.startswith(recent_prefix) and not n.endswith("/")}
    recent_manifest = json.loads(recent_files["SHA256SUMS.json"])
    assert set(recent_manifest) == recent_files.keys() - {"SHA256SUMS.json"}
    for name, digest in recent_manifest.items():
        assert sha256(recent_files[name]).hexdigest() == digest, name
    assert not (recent_files.keys() - files.keys() - {"SOURCE_STATE.json", "SHA256SUMS.json"}), "latest delivered files missing"
    for name, body in recent_files.items():
        if name not in {"SOURCE_STATE.json", "SHA256SUMS.json", "请在Mac编译前先读.md"} and not name.startswith(BUNDLE):
            assert files[name] == body, "unexpected native/signing change: " + name
    assert files[BUNDLE + "photo-album.js"] == git("show", "HEAD:photo-album.js")
    for marker in ("photoAlbumHasLikes", "photoAlbumConsumeLikes", "photoAlbumCategorySave", "photoAlbumEditOpen", "likedByMe", "roleLikes", "PHOTO_ALBUM_TRASH_MS", "photoAlbumTrashRestore", "photoAlbumTrashExpire"):
        assert marker in text(files[BUNDLE + "photo-album.js"]), marker
    state["lastDeliveredPackage"] = {"name": recent.name, "sha256": recent_sha, "sourceCommit": json.loads(recent_files["SOURCE_STATE.json"])["sourceCommit"]}
    for marker in ("function msgBannerGesture(e)", "_msgBannerNoClickUntil", "nearby:()=>go('wxnearby')", "wxnearby:'nearby'", "function wxNearbyBlocked()", "if(wxNearbyBlocked())return;"):
        assert marker in text(files[BUNDLE + "app.js"]), marker
    assert 'onpointermove="msgBannerGesture(event)"' in text(files[BUNDLE + "index.html"])
    state["preserved"] = sorted(set(state["preserved"]) | {"v1582-single-photo-deletion", "v1584-delete-photo-facts", "v1586-recently-deleted-72h-restore"})
    recent_state = json.loads(recent_files["SOURCE_STATE.json"])
    state["preserved"] = sorted(set(state["preserved"]) | set(recent_state["preserved"]) | {"v1589-wechat-original-audio-favorites-and-provenance-forward", "v1589-wechat-green-controls", "v1589-role-family-capped-sync-edit-delete-tombstones", "v1589-real-friend-read-only-failover-single-write"})
    for marker in ("function relFamilyState(", "function relFamilyConsume(", "q.created.length>=q.cap||q.created.some", "path.some(p=>p==='favorites'||p==='_favorite')", "attempt<(write?1:2)", "[GATE_URL,PF_RELAY_BASE].forEach", "backendCode:"):
        assert marker in text(files[BUNDLE + "app.js"]), marker
    for marker in ("wxFavoriteAudioCopy", "wxFavoriteForwardText", "wxFavoritePlay"):
        assert marker in text(files[BUNDLE + "wechat-me.js"]), marker
    state["validation"]["mostRecentOverlayManifestVerified"] = True
    files["SOURCE_STATE.json"] = json.dumps(state, ensure_ascii=False, indent=2).encode("utf-8")
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

    # Decompress and validate every member in memory; do not create another temporary directory.
    with ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        actual={name[len(PREFIX):]:archive.read(name) for name in archive.namelist()}
        assert actual == files, "decompressed file mismatch"
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
