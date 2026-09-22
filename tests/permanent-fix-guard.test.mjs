import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Every release must carry these repairs. They are user-visible fixes that were
// paid for with real debugging, and at least one of them has already been lost
// once: the v1235/iOS356 cohab schedule-sync repair was never committed, reached
// a device only because a packaging script read the working tree, and silently
// disappeared from v1246 onward when packages were built from a clean checkout.
// Losing a fix looks exactly like a new bug to the user, so a missing marker here
// is a release blocker, never something to "fix later".
//
// Adding to this list is expected. Removing an entry is only correct when the
// feature it guards is genuinely gone; if a refactor moves a marker, update the
// marker in the same commit that moves the code, and say so in the commit body.

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const WEB = 'app.js';
const PRIVATE_DIR = 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/';
const PRIVATE = PRIVATE_DIR + 'app.js';

const count = (source, marker) => source.split(marker).length - 1;

// scope: 'both' must hold in the web core and the private bundle; 'private' only
// applies to the private bundle, where the native shell needs the extra guard;
// 'web' is a repair released to the browser ahead of the private bundle. When a
// 'web' entry is later synced into the private bundle, move it to 'both' in the
// same commit that syncs it.
const PERMANENT_FIXES = [
  {
    release: 'v1282/v1283',
    name: '朋友圈封面 IDB 冷缓存保留图片节点并重新取图',
    scope: 'both',
    marker: 'function storedImageElementSource(v)',
    least: 1,
  },
  {
    release: 'v1282/v1283',
    name: '应用处理内部协议在前台原文、普通输出和后台回拉三处隐藏',
    scope: 'both',
    marker: '应用处理\\s*[|｜]\\s*(?:提醒|锁定)',
    least: 3,
  },
  {
    release: 'v1248',
    name: '共同生活作息同步：清洗后再比较，上班时段不再每 15 秒空转',
    scope: 'both',
    marker: 'const label=cohabActivityClean(spec.label)',
    least: 1,
  },
  {
    release: 'v1248',
    name: '角色服务器资料同步去抖：短时间重复触发合并为最后一次',
    scope: 'both',
    marker: 'clearTimeout(_roleServerPushSoonTimers[key])',
    least: 1,
  },
  {
    release: 'v1246',
    name: '共同生活截断旁白：未闭合的【（( 开头仍按旁白显示',
    scope: 'both',
    marker: "else if(/^[（(【]/.test(raw)&&!/[）)】]$/.test(raw))",
    least: 1,
  },
  {
    release: 'v1246',
    name: '原文输出实验路径同样识别截断旁白',
    scope: 'both',
    marker: 'open=!closed&&line.match',
    least: 1,
  },
  {
    release: 'v1247',
    name: '共同生活/线下回复长度可由路线设置抬高上限',
    scope: 'both',
    marker: 'function offlineReplyBudget(input,c)',
    least: 1,
  },
  {
    release: 'v1247',
    name: '设置页保留独立的“回复长度（共同生活/线下）”输入项',
    scope: 'both',
    marker: 's_cmax_offline',
    least: 4,
  },
  {
    release: 'v1237-v1242',
    name: '大存档完整备份分段序列化，不再整份复制状态',
    scope: 'both',
    marker: 'backupJsonBlob',
    least: 2,
  },
  {
    release: '私人既有',
    name: '私人 App 周期任务统一走后台任务包装，避免占用主线程',
    scope: 'private',
    marker: 'northNativeBackgroundTask',
    least: 30,
  },
  {
    release: '私人既有',
    name: '私人 App 性能守卫（启动安静期与性能保护态）',
    scope: 'private',
    marker: 'north-native-performance-guard',
    least: 2,
  },
  {
    release: '私人既有',
    name: '好友消息同步分批让出主线程',
    scope: 'private',
    marker: 'pfSyncMaybeYield',
    least: 1,
  },
  {
    release: 'v1249（v1258 同步私人）',
    name: '完整备份跳过读不出的图片，不再整份中止',
    scope: 'both',
    marker: '_fullBackupSkippedImages.add(key)',
    least: 1,
  },
  {
    release: 'v1249（v1258 同步私人）',
    name: '定时查岗错过当天时点后仍会补跑一次',
    scope: 'both',
    marker: 'nowMin<toMin(sp.time)',
    least: 1,
  },
  {
    release: 'v1249（v1258 同步私人）',
    name: '群聊撤回行能被角色感知，不再喂成空洞的[消息]',
    scope: 'both',
    marker: "m.type==='sys'?String(m.content||'')",
    least: 1,
  },
  {
    release: 'v1249（v1258 同步私人）',
    name: '开始新约会前先归档没结束的上一场，记录不丢',
    scope: 'both',
    marker: 'offArchiveUnfinishedSession(o)',
    least: 1,
  },
  {
    release: 'v1249（v1250 同步私人）',
    name: '共同生活期间角色不在身边时可以来电',
    scope: 'both',
    marker: 'roleOnlineProactiveBlocked(id)&&!(cohabRestricted&&opt.requestedByUser)',
    least: 1,
  },
  {
    release: 'v1249（v1250 同步私人）',
    name: '整段英文旁白本地丢弃，不触发重新生成',
    scope: 'both',
    marker: 'roleReplyDropEnglishNarration',
    least: 2,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '存档里的图片引用在显示前先还原，表情包、壁纸、朋友圈都不再破图或发黑',
    scope: 'both',
    marker: 'storedImageDisplaySource(m.img)',
    least: 2,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '主屏与锁屏壁纸失效时不画无效地址，毛玻璃组件不会连带变黑',
    scope: 'both',
    marker: 'storedImageDisplaySource(S.me.homeBg)',
    least: 1,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '好友申请方向按来源区分，用户加的不会说成角色加的',
    scope: 'both',
    marker: '绝不能说成你申请加ta、或你终于等到ta通过',
    least: 1,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '陌生来电知道是自己拨出的，不再反问用户是谁',
    scope: 'both',
    marker: '绝对不要反问“你是谁”“你哪位”',
    least: 1,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '小本子由角色自行判断要记什么，日常喜好习惯都记得下',
    scope: 'both',
    marker: '记不记、记哪一条，完全由你自己判断',
    least: 1,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '原生请求有界，挂死不会让「正在备份」永远卡住',
    scope: 'both',
    marker: 'NATIVE_TIMEOUT',
    least: 1,
  },
  {
    release: 'v1257（v1258 同步私人）',
    name: '上游只认方图时，竖图被拒后退回方图再试一次',
    scope: 'both',
    marker: "res.status===400&&target!=='1024x1024'",
    least: 1,
  },
  {
    release: 'v1257',
    name: '语音语言锁：选了外语时混进来的中文绝不会被念出口',
    scope: 'both',
    marker: 'text=ttsDropOffLanguage(text,o);',
    least: 1,
  },
  {
    release: 'v1257',
    name: '「模型原文输出」不再绕过通话发声的外语过滤',
    scope: 'both',
    marker: "(_rawOutput&&(!_vlang||_vlang==='zh'))?u.orig:pickSpoken(u.orig,_vlang)",
    least: 1,
  },
  {
    release: 'v1257',
    name: '真人好友点气泡弹出消息操作，撤回有可见入口',
    scope: 'both',
    marker: "onclick=\"pfMsgMenu('${m.id}'",
    least: 2,
  },
  {
    release: 'v1257',
    name: '后台接力：本地已回过时同时取消服务器任务，不再每两分钟重调一次模型',
    scope: 'both',
    marker: "if(handoff)replyHandoffCancelRemote(handoff);else roleBackgroundCancel(c.id,['reply_handoff']);",
    least: 1,
  },
  {
    release: 'v1257',
    name: '后台接力：消息送不进去时先停掉服务器那一侧，内容仍留着补送',
    scope: 'both',
    marker: 'roleServerPushHoldHandoff(c,handoffPeek(c,row))',
    least: 1,
  },
  {
    release: 'v1257',
    name: '[保持安静] 是要执行的决定，推送路径不再当成一句话发出去',
    scope: 'both',
    marker: '(?:保持安静|不说话)\\s*[\\]】]\\s*(?=\\n|$)',
    least: 1,
  },
  {
    release: 'v1257',
    name: '语音条只显示中文翻译，发声仍用外语原文',
    scope: 'both',
    marker: 'esc(m.trans||m.content)',
    least: 1,
  },
  {
    release: 'v1257',
    name: '模型原文输出为全局默认，开关已移除',
    scope: 'both',
    marker: 'function modelOutputUnfiltered(){return true;}',
    least: 1,
  },
  {
    release: 'v1257',
    name: '截断续写排在原文直通之前，回复长度设短也不会断在半句',
    scope: 'both',
    marker: "roleInterceptPurpose:'length-continuation'",
    least: 1,
  },
  {
    release: 'v1257',
    name: '信件有自己的回复长度，不再写死 700／620',
    scope: 'both',
    marker: 'function letterReplyBudget(c)',
    least: 1,
  },
  {
    release: 'v1257',
    name: '两边微信请求参数一致：私人版也走原文直通，不再各跑各的',
    scope: 'both',
    marker: 'complete:true,unfilteredOutput:_rawOutput',
    least: 1,
  },
  {
    release: 'v1257',
    name: '指令解析器知道当前哪些 App 锁着，不会把陈述现状再解析成一次操作',
    scope: 'both',
    marker: 'companionControlLedgerForParser()',
    least: 2,
  },
  {
    release: 'v1257',
    name: '威胁与未来时不再触发真锁真解：只认当下已成事实的说法',
    scope: 'both',
    marker: '条件或威胁',
    least: 1,
  },
  {
    release: 'v1257',
    name: '外置 App 不重复下发同一个状态，角色不再反复锁已经锁着的',
    scope: 'both',
    marker: "opt.by==='role'&&companionExternalAlreadyInState(st,app,action)",
    least: 1,
  },
  {
    release: 'v1257',
    name: '用户自己解锁时角色的话不再被收据式模板顶替',
    scope: 'both',
    marker: '这不是设备读数汇报',
    least: 1,
  },
  {
    release: 'v1259',
    name: '共同生活关闭后，一起生活过的记忆仍然记得',
    scope: 'both',
    marker: 'function cohabMemoryAfterPrompt(c)',
    least: 1,
  },
  {
    release: 'v1259',
    name: '共同生活记忆上限可调，0 表示不限',
    scope: 'both',
    marker: 'cohabMemoryPrune(d,cohabMemoryCap(d))',
    least: 1,
  },
  {
    release: 'v1259',
    name: '主动清理低星，5 星永远保留',
    scope: 'both',
    marker: 'function memoryPruneLowStars(rows,maxStar)',
    least: 1,
  },
  {
    release: 'v1259',
    name: '微信记忆清理按钮不再空转（自动清理关着也能手动清）',
    scope: 'both',
    marker: 'pruneSummaries(cc,null,{force:true})',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音「我」页不再被 commerce-ui 的外壳覆盖，四个新页面才看得见',
    scope: 'both',
    marker: 'function renderDouyin(){dyInit();',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音编辑资料页（封面／头像／资料完成度／逐项修改）',
    scope: 'both',
    marker: 'function dyEditView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音主页访客页（红点、回关、清空记录）',
    scope: 'both',
    marker: 'function dyVisitorsView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音作品详情页（漂浮弹幕、右侧操作栏、视频分析）',
    scope: 'both',
    marker: 'function dyWorkView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音评论区从屏幕下方弹出，可回复、可展开子回复',
    scope: 'both',
    marker: 'function dyCmSheet(v)',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音「我」页不留死按钮：互关／关注／粉丝列表页',
    scope: 'both',
    marker: 'function dyRelView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音观看历史（看过就记一笔，可筛可清）',
    scope: 'both',
    marker: 'function dyHistoryView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音主页搜索：先搜自己的主页，再给全网入口',
    scope: 'both',
    marker: 'function dyMeSearchView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音求更新页（近 7 天催更／催开播）',
    scope: 'both',
    marker: 'function dyUpdateView()',
    least: 1,
  },
  {
    release: 'v1259',
    name: '抖音全部功能九宫格，次要入口全部有去处',
    scope: 'both',
    marker: 'function dyAllGroups()',
    least: 1,
  },
  {
    release: 'v1260',
    name: '通话掉一次连接自己重发，不再把「网络连接中断」甩给她',
    scope: 'both',
    marker: 'async function callChatWithRetry(messages,md,c)',
    least: 1,
  },
  {
    release: 'v1260',
    name: '通话被长度上限截断时会补完，不再断在半句',
    scope: 'both',
    marker: "complete:true,max:callReplyBudget(c)",
    least: 1,
  },
  {
    release: 'v1260',
    name: '通话有自己的回复长度，留空跟线上聊天一样',
    scope: 'both',
    marker: 'function callReplyBudget(c)',
    least: 1,
  },
  {
    release: 'v1260',
    name: '切后台被掐断的请求说人话，不再赖网络',
    scope: 'both',
    marker: 'function callBackgroundInterrupted(e,mark,now)',
    least: 1,
  },
  {
    release: 'v1260',
    name: '续写碎片不再跑整段的纯英文拦截',
    scope: 'both',
    marker: 'roleReplyLanguageGuard:false,roleInterceptPurpose',
    least: 1,
  },
  {
    release: 'v1260',
    name: '英文续写不再把两个词粘成一个',
    scope: 'both',
    marker: 'hadGap=/^\\s/.test(more)',
    least: 1,
  },
  {
    release: 'v1260',
    name: '设置页能按通话的真实规模测一次',
    scope: 'both',
    marker: 'async function testCallScale()',
    least: 1,
  },
  {
    release: 'v1260',
    name: '_taskBusy 有声明，任务页不会没布置过就抛错',
    scope: 'both',
    marker: 'let _taskBusy=false;',
    least: 1,
  },
  {
    release: 'v1261',
    name: '抖音消息页：五个圆入口＋陌生人文件夹',
    scope: 'both',
    marker: 'function dyStrangerFolderRow()',
    least: 1,
  },
  {
    release: 'v1261',
    name: '抖音粉丝页（谁什么时候关注了你，可回关）',
    scope: 'both',
    marker: 'function dyFansView()',
    least: 1,
  },
  {
    release: 'v1261',
    name: '抖音互动消息（赞与其他／评论与弹幕／群通知）',
    scope: 'both',
    marker: 'function dyActsView()',
    least: 1,
  },
  {
    release: 'v1261',
    name: '抖音私聊页：火花、已读、快捷回复、时间只在间隔后标一次',
    scope: 'both',
    marker: 'function dyDMStamp(rows,mi)',
    least: 1,
  },
  {
    release: 'v1261',
    name: '抖音群聊：建群、拉角色、群主与管理员',
    scope: 'both',
    marker: 'function dyGroupInfoView()',
    least: 1,
  },
  {
    release: 'v1261',
    name: '公开群每天只来一位陌生人，且先占住当天再调模型',
    scope: 'both',
    marker: "g.lastApplyDay=dyApplyDayKey();save();",
    least: 1,
  },
  {
    release: 'v1261',
    name: '进群的陌生人带着自己的人设说话',
    scope: 'both',
    marker: 'function dyGroupSpeakerPrompt(g,m)',
    least: 1,
  },
  {
    release: 'v1261',
    name: '群聊按性格出场，关掉群聊 AI 就没人自动说话',
    scope: 'both',
    marker: 'async function dyGroupReplyRun(gid,fromText,forceKeys)',
    least: 1,
  },
  {
    release: 'v1262',
    name: '抖音全部走副模型，失败要回落主模型而不是静默',
    scope: 'both',
    marker: 'async function dyAuxChat(messages,opt)',
    least: 1,
  },
  {
    release: 'v1262',
    name: '抖音作品是「正文＋旁白」的文字作品，不再是一个 emoji',
    scope: 'both',
    marker: 'function dyWorkCardHTML(v,opt)',
    least: 1,
  },
  {
    release: 'v1262',
    name: '抖音朋友页，底部第二格从「发现」换成「朋友」',
    scope: 'both',
    marker: 'function dyFriendView()',
    least: 1,
  },
  {
    release: 'v1262',
    name: '涨粉掉粉靠发作品挣，一天只结算一次',
    scope: 'both',
    marker: 'function dyGrowthTick()',
    least: 1,
  },
  {
    release: 'v1262',
    name: '她评论之后一定有角色回她',
    scope: 'both',
    marker: 'function dyCommentResponder(v)',
    least: 1,
  },
  {
    release: 'v1265',
    name: '抖音里每个人都有独立主页，群成员页也独立成一页',
    scope: 'both',
    marker: 'function dyUserView()',
    least: 1,
  },
  {
    release: 'v1265',
    name: '私聊和群聊各自能调上下文条数',
    scope: 'both',
    marker: 'function dyChatCtxRows(box)',
    least: 1,
  },
  {
    release: 'v1265',
    name: '抖音里发生的事进角色记忆，跟共同生活一样',
    scope: 'both',
    marker: 'function dyMemoryPrompt(c)',
    least: 1,
  },
  {
    release: 'v1265',
    name: '等角色回消息时有三个点',
    scope: 'both',
    marker: 'function dyTypingHTML(face)',
    least: 1,
  },
  {
    release: 'v1265',
    name: '陌生人统一用灰底线条小人头像',
    scope: 'both',
    marker: 'function dyFace(v,cls)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '她发的文件角色真的读得到正文',
    scope: 'both',
    marker: 'function chatFileContextBody(m)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '角色能写多行文件，正文不会散成聊天气泡',
    scope: 'both',
    marker: 'function roleFileExtract(content)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '文件卡点得开，能复制能保存',
    scope: 'both',
    marker: 'function chatFileOpen(cid,mid)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '骰子回到微信功能面板第二页',
    scope: 'both',
    marker: "chatFunctionItem('骰子','dice'",
    least: 1,
  },
  {
    release: 'v1271',
    name: '红点进页面就全清',
    scope: 'both',
    marker: 'function dyMarkAllSeen(kind,rows)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '火花只涨不清零，双方当天都发过才 +1',
    scope: 'both',
    marker: 'function dySparkTick(d)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '抖音私聊能连发 1～4 条',
    scope: 'both',
    marker: 'function dyDMBubbles(raw)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '群聊按性格出场，主角＋配角，可以冷场',
    scope: 'both',
    marker: 'function dyGCast(g,fromText,forceKeys)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '网友合并一次调用，角色各自调用',
    scope: 'both',
    marker: 'function dyGCrowdPrompt(g,crowd)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '禁言踢人的规矩由代码硬卡，不信任模型',
    scope: 'both',
    marker: 'function dyGCmdDeny(g,actorKey,kind,target)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '她被禁言只能私信求解，私聊和群聊打通',
    scope: 'both',
    marker: 'function dyDMRunUnmute(cid,text)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '群里冷场太久会自己聊起来，一天有次数上限',
    scope: 'both',
    marker: 'async function dyGroupIdleChat(gid)',
    least: 1,
  },
  {
    release: 'v1271',
    name: 'IP 跟人设走，没写就固定随机，可手动改',
    scope: 'both',
    marker: 'function dyPersonIP(p)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '群聊气泡一条条出，管理员 1～4 条，配角 1 条',
    scope: 'both',
    marker: 'function dyGBubbles(g,m,raw)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '一个气泡里不能同时 @ 两个人',
    scope: 'both',
    marker: 'function dyGSplitAt(line)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '收到消息有柔和提示音，现合成不占体积',
    scope: 'both',
    marker: 'function dyDing()',
    least: 1,
  },
  {
    release: 'v1271',
    name: '火花挂在私聊顶部名字旁边',
    scope: 'both',
    marker: 'function dySparkBadge(d)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '抖音输入框复用微信的表情与表情包',
    scope: 'both',
    marker: 'function dyEmojiPanelHTML(scope,id)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '抖音转账红包走微信账本，群红包能抢',
    scope: 'both',
    marker: 'function dyMoneySend(scope,id,kind)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '抢红包的手速看性格',
    scope: 'both',
    marker: 'function dyGreed(m)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '发作品：文字卡片可选颜色，相机能拍能选',
    scope: 'both',
    marker: 'function dyPostImage(shoot)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '角色真的看图再评论，看不见绝不编',
    scope: 'both',
    marker: 'function dyWorkSceneText(v)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '被 @ 的人粉丝多就有他的粉丝来捧场',
    scope: 'both',
    marker: 'async function dyAtFansShow(v,p,fans)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '群聊不再被弹回顶部',
    scope: 'both',
    marker: "sub==='group')return{id:'.dyg-box',stick:true}",
    least: 1,
  },
  {
    release: 'v1271',
    name: '被踢出去的人不能再说话',
    scope: 'both',
    marker: 'if(!dyGFind(g,m.k))continue;',
    least: 1,
  },
  {
    release: 'v1271',
    name: '发作品能选音乐库里真有的歌',
    scope: 'both',
    marker: 'function dyWorkMusicPlay(id)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '云程护照头像兼容 IndexedDB 图片引用',
    scope: 'web',
    marker: 'function tvPassportPhoto(v)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '查手机小事簿改用页内编辑器，移动浏览器不会拦截按钮',
    scope: 'web',
    marker: 'function spyLifeNoteEditor(i)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '朋友圈情侣必点赞并请求真实评论，失败可见重试',
    scope: 'web',
    marker: 'function momentRetryRequiredReactions(pid)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '朋友圈角色可按兴趣互相艾特，最多两回合',
    scope: 'web',
    marker: 'function momentRunRoleExchange(p)',
    least: 1,
  },
  {
    release: 'v1271',
    name: '像素少女网页端按小目录分图加载，不再解析整份内嵌大脚本',
    scope: 'web',
    file: 'games/pixel-home/assets.js',
    marker: "fetch(new URL('wardrobe/catalog.json',base).href",
    least: 1,
  },
  {
    release: 'v1272',
    name: 'iOS 主屏网页同步状态栏颜色且不覆盖解锁后的页面',
    scope: 'web',
    file: '小手机.html',
    marker: 'html.north-ios-standalone-status{background-color:var(--north-shell-status-color,#000)}',
    least: 1,
  },
  {
    release: 'v1271',
    name: '多人剧场支持两名微信来客且关闭开关时不强制加入',
    scope: 'web',
    file: 'cohab-theater.js',
    marker: 'ct_wechat_enabled',
    least: 1,
  },
  {
    release: 'v1271',
    name: '云程酒店支持网页预订、紧凑聊天卡与角色知情边界',
    scope: 'web',
    marker: 'function tvHotelBook(i)',
    least: 1,
  },
  {
    release: 'v1274',
    name: '温馨小家移动端使用隔离材质预热，正式材质不参与整屋启动预绘制',
    scope: 'private',
    file: PRIVATE_DIR + 'games/cozy-home/app.mjs',
    marker: 'const warmDraw=()=>{const warmMaps=new Map(),materialClones=new Map(),objectSwaps=[]',
    least: 1,
  },
  {
    release: 'v1274',
    name: '温馨小家进入前释放预热几何和镜面缓冲',
    scope: 'private',
    file: PRIVATE_DIR + 'games/cozy-home/app.mjs',
    marker: 'mirrors.releaseGPU();const geometries=new Set()',
    least: 1,
  },
  {
    release: 'v1274',
    name: '温馨小家女性角色静止姿态仍执行固定手臂旋转',
    scope: 'private',
    file: PRIVATE_DIR + 'games/cozy-home/female-avatar001.mjs',
    marker: 'proceduralDeltas=',
    least: 1,
  },
  {
    release: 'v1274',
    name: '线上长期记忆与对话总结按独立上限和每轮合计上限引用',
    scope: 'both',
    marker: 'function onlineMemoryRecallLimits()',
    least: 1,
  },
  {
    release: 'v1274',
    name: '线下记忆删除后恢复原来的列表滚动位置',
    scope: 'both',
    marker: 'function offMemoryRestoreScroll(top)',
    least: 1,
  },
  {
    release: 'v1280/v1278',
    name: '已有网页云备份继续按周期更新并保持私人镜像只读',
    scope: 'both',
    marker: 'await cloudBackup({current,onProgress:',
    least: 1,
  },
  {
    release: 'v1280/v1278',
    name: '网页手动云备份显示持续进度并阻止重复点击',
    scope: 'both',
    marker: 'function cloudSyncProgress(text,kind,busy)',
    least: 1,
  },
  {
    release: 'v1278',
    name: '私人手机号备份成功后不再重复生成整份网页镜像',
    scope: 'private',
    file: PRIVATE_DIR + 'private-cloud-backup.js',
    marker: '手机号私人备份和网页镜像是两个入口',
    least: 1,
  },
  {
    release: 'v1284/v1285',
    name: '抖音转账红包用微信那张卡',
    scope: 'both',
    marker: 'function dyTransferCopy(m,me)',
    least: 1,
  },
  {
    release: 'v1284/v1285',
    name: '[收款][拒收] 被执行掉，不当文字显示',
    scope: 'both',
    marker: 'function dyRunPayCommands(rows,text)',
    least: 1,
  },
  {
    release: 'v1284/v1285',
    name: '相册 input 挂进 DOM，否则 iOS 点不动',
    scope: 'both',
    marker: 'document.body.appendChild(i);window._dyPickEl=i;',
    least: 1,
  },
  {
    release: 'v1284/v1285',
    name: '发作品是三个真页面',
    scope: 'both',
    marker: 'function dyPostCameraPage()',
    least: 1,
  },
  {
    release: 'v1284/v1285',
    name: '作品能转发到抖音私信和群聊',
    scope: 'both',
    marker: 'function dyFwdTo(scope,id)',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '配乐条在 stage 外面，不会跑到左上角',
    scope: 'both',
    marker: '<div class="dywk-music">${dyWorkMusicHTML(v)}</div>',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '滑到哪条放哪条，没点过屏幕不硬出声',
    scope: 'both',
    marker: 'if(!_dyGestured)return;',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '@ 写进作品描述，发布时按文字里还剩下的定名单',
    scope: 'both',
    marker: 'function dyPostAtSync(p)',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '角色能把图真的发到抖音',
    scope: 'both',
    marker: 'function publishRoleDouyin(c,tx,opt)',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '作品详情是独立一页，角色主页点得开',
    scope: 'both',
    marker: "else if(c.p==='dywork')html=dyWorkView()+dyCmLayer();",
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '建群的号码函数不再和夹取范围的 dyGNum 重名',
    scope: 'both',
    marker: 'function dyGNewNum()',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '不是作者就不挂作者牌',
    scope: 'both',
    marker: 'function dyCmIsAuthor(v,cm)',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '点亮的爱心和收藏的星星是实心的',
    scope: 'both',
    marker: 'function dyIc(name,size,on,onColor,offColor,sw)',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '评论按钮是实心白气泡，三个点是镂空的洞',
    scope: 'both',
    marker: 'fill-rule="evenodd" clip-rule="evenodd"',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '信息页里通讯录的人才走 iMessage，陌生号原样',
    scope: 'both',
    marker: 'if(phImsgOn(num,sk))return renderPhoneIMsg(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '聊天背景一人一张，按号码存',
    scope: 'both',
    marker: 'function phSmsBgMap()',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '输入框有字才冒出蓝色发送键',
    scope: 'both',
    marker: "bar.classList.toggle('typing',!!String(ta.value||'').trim());",
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '首页和作品详情共用同一条右边栏',
    scope: 'both',
    marker: 'function dyWorkRail(v){return dyRailHTML(v);}',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '首页双击是点赞，不会被带进作品详情',
    scope: 'both',
    marker: "dyCardTap('${v.id}',event,1)",
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '网页外壳：气泡连同小尾巴是一整块剪出来的，换背景不会露拼接缝',
    scope: 'web',
    file: '小手机.html',
    marker: '.imsg-row.them .imsg-b{padding:8px 14px 8px 21px;clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '网页外壳：高光是沿着轮廓描的一条细线（内轮廓缩 1.15px）',
    scope: 'web',
    file: '小手机.html',
    marker: '.imsg-row.them .imsg-b:before{clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '网页外壳：高光跟着背景变颜色，不是只有白',
    scope: 'web',
    file: '小手机.html',
    marker: 'backdrop-filter:brightness(1.62) saturate(1.75)',
    least: 2,
  },
  {
    release: 'v1294/v1295',
    name: '私人外壳：气泡连同小尾巴是一整块剪出来的，换背景不会露拼接缝',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',
    marker: '.imsg-row.them .imsg-b{padding:8px 14px 8px 21px;clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '私人外壳：高光是沿着轮廓描的一条细线（内轮廓缩 1.15px）',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',
    marker: '.imsg-row.them .imsg-b:before{clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '私人外壳：高光跟着背景变颜色，不是只有白',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/小手机.html',
    marker: 'backdrop-filter:brightness(1.62) saturate(1.75)',
    least: 2,
  },
  {
    release: 'v1294/v1295',
    name: '私人入口：气泡连同小尾巴是一整块剪出来的，换背景不会露拼接缝',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html',
    marker: '.imsg-row.them .imsg-b{padding:8px 14px 8px 21px;clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '私人入口：高光是沿着轮廓描的一条细线（内轮廓缩 1.15px）',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html',
    marker: '.imsg-row.them .imsg-b:before{clip-path:polygon(',
    least: 1,
  },
  {
    release: 'v1294/v1295',
    name: '私人入口：高光跟着背景变颜色，不是只有白',
    scope: 'web',
    file: 'native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html',
    marker: 'backdrop-filter:brightness(1.62) saturate(1.75)',
    least: 2,
  },
  {
    release: 'v1294/v1295',
    name: '图片作品铺满整屏，底下不再垫一张模糊的自己',
    scope: 'both',
    marker: `\${photo?'<div class="dybg dybg-photo"></div>':\`<div class="dybg" style="background-image:\${grad}"></div>\`}`,
    least: 1,
  },
];

const sources = { web: read(WEB), private: read(PRIVATE) };

for (const fix of PERMANENT_FIXES) {
  const targets = fix.scope === 'both' ? ['web', 'private'] : [fix.scope];
  for (const target of targets) {
    test(`${target} keeps ${fix.release} — ${fix.name}`, () => {
      const source = fix.file ? read(fix.file) : sources[target];
      const found = count(source, fix.marker);
      assert.ok(
        found >= fix.least,
        `${target} 源码缺少 ${fix.release} 的修复「${fix.name}」：\n` +
        `  期望标记出现至少 ${fix.least} 次，实际 ${found} 次\n` +
        `  标记：${fix.marker}\n` +
        '  这是必须随每个版本一起发布的修复，缺失即为发布阻断项。',
      );
    });
  }
}

test('the private bundle still ships its performance protection component', () => {
  const index = read(PRIVATE_DIR + 'index.html');
  assert.ok(
    fs.existsSync(new URL('../' + PRIVATE_DIR + 'private-runtime-diagnostics.js', import.meta.url)),
    '私人性能保护组件文件缺失',
  );
  assert.match(index, /private-runtime-diagnostics\.js\?v=\d+/, '私人入口没有引用性能保护组件');
});

test('every private release keeps the complete streamed daily cloud-backup chain', () => {
  const index = read(PRIVATE_DIR + 'index.html');
  const alias = read(PRIVATE_DIR + '小手机.html');
  const backupPath = PRIVATE_DIR + 'private-cloud-backup.js';
  const backup = read(backupPath);
  const bridge = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneNativeBridge.swift');
  const webView = read('native/private-small-phone/XcodeProject/PhoneCompanionTest/LocalPhoneWebView.swift');
  const project = read('native/private-small-phone/XcodeProject/PhoneCompanionTest.xcodeproj/project.pbxproj');

  assert.equal(index, alias, '私人两个入口必须一起携带云备份组件');
  assert.match(index, /private-cloud-backup\.js\?v=\d+/, '私人入口漏掉每日云备份组件');
  for (const action of ['begin', 'chunk', 'commit', 'progress', 'abort']) {
    assert.match(backup, new RegExp(`account\\.backup\\.file\\.${action}`), `网页分片备份漏掉 ${action}`);
    assert.match(bridge, new RegExp(`account\\.backup\\.file\\.${action}`), `原生桥漏掉 ${action}`);
  }
  assert.match(backup, /const CHUNK=192\*1024/, '私人备份不得退回整份大对象跨桥传输');
  assert.match(backup, /account\.backup\.file\.commit',\{token\},1920000/, '网页成功确认必须覆盖完整原生分块上传时限');
  assert.match(bridge, /private actor PrivateBackupFileStore/, '原生临时备份文件存储缺失');
  assert.match(bridge, /privateBackupChunkBytes = 4 \* 1_024 \* 1_024/, '原生端必须把云备份切成安全大小的对象存储分块');
  assert.match(bridge, /\/storage\/v1\/object\//, '私人云备份不得退回整份 jsonb 数据库写入');
  assert.match(bridge, /save_private_phone_backup_manifest/, '全部分块上传后必须提交小型原子清单');
  assert.match(bridge, /restorePrivateBackupFile/, '对象存储备份必须保留完整恢复路径');
  assert.match(bridge, /actualChecksum == expectedChecksum/, '恢复前必须校验整份备份散列');
  assert.match(backup, /正在上传私人云备份/, '私人备份必须向用户显示真实云端上传百分比');
  assert.match(bridge, /backup_upload_timeout/, '原生上传超时不得伪装成账号认证超时');
  assert.match(webView, /action === 'account\.backup\.file\.commit' \? 1800000 : 60000/, 'WKWebView 桥不得提前中断完整分块上传');
  assert.match(project, /isa = PBXFileSystemSynchronizedRootGroup;[\s\S]*?path = PhoneCompanionTest;/, '主 App 资源目录没有纳入 Xcode 文件夹同步');
  assert.doesNotMatch(project, /membershipExceptions = \([^)]*private-cloud-backup\.js/, '私人云备份组件被排除出 Xcode Target');
});

test('the private bundle and web core stay in lockstep on shared repairs', () => {
  for (const fix of PERMANENT_FIXES.filter(x => x.scope === 'both')) {
    assert.equal(
      count(sources.web, fix.marker) > 0,
      count(sources.private, fix.marker) > 0,
      `共有修复「${fix.name}」只存在于其中一侧，两边必须同步`,
    );
  }
});

test('the private cozy bundle rejects the two mobile material regressions', () => {
  const app = read(PRIVATE_DIR + 'games/cozy-home/app.mjs');
  const female = read(PRIVATE_DIR + 'games/cozy-home/female-avatar001.mjs');
  assert.doesNotMatch(app, /renderer\.setSize\(96,96,false\)/, '不得恢复用真实房间资源做 96×96 整屋预绘制');
  assert.doesNotMatch(female, /if\(Math\.abs\(amount\)<1e-7\)return/, '不得在静止时跳过女性角色站姿');
});
