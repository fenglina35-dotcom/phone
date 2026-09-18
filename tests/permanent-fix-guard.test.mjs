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
    name: '群聊一轮最多三个人开口，关掉群聊 AI 就没人自动说话',
    scope: 'both',
    marker: 'async function dyGroupReplyRun(gid,fromText)',
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
];

const sources = { web: read(WEB), private: read(PRIVATE) };

for (const fix of PERMANENT_FIXES) {
  const targets = fix.scope === 'both' ? ['web', 'private'] : [fix.scope];
  for (const target of targets) {
    test(`${target} keeps ${fix.release} — ${fix.name}`, () => {
      const found = count(sources[target], fix.marker);
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

test('the private bundle and web core stay in lockstep on shared repairs', () => {
  for (const fix of PERMANENT_FIXES.filter(x => x.scope === 'both')) {
    assert.equal(
      count(sources.web, fix.marker) > 0,
      count(sources.private, fix.marker) > 0,
      `共有修复「${fix.name}」只存在于其中一侧，两边必须同步`,
    );
  }
});
