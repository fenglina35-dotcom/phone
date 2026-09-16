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
    release: 'v1249',
    name: '完整备份跳过读不出的图片，不再整份中止',
    scope: 'web',
    marker: '_fullBackupSkippedImages.add(key)',
    least: 1,
  },
  {
    release: 'v1249',
    name: '定时查岗错过当天时点后仍会补跑一次',
    scope: 'web',
    marker: 'nowMin<toMin(sp.time)',
    least: 1,
  },
  {
    release: 'v1249',
    name: '群聊撤回行能被角色感知，不再喂成空洞的[消息]',
    scope: 'web',
    marker: "m.type==='sys'?String(m.content||'')",
    least: 1,
  },
  {
    release: 'v1249',
    name: '开始新约会前先归档没结束的上一场，记录不丢',
    scope: 'web',
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
    release: 'v1251',
    name: '存档里的图片引用在显示前先还原，表情包、壁纸、朋友圈都不再破图或发黑',
    scope: 'web',
    marker: 'storedImageDisplaySource(m.img)',
    least: 2,
  },
  {
    release: 'v1251',
    name: '主屏与锁屏壁纸失效时不画无效地址，毛玻璃组件不会连带变黑',
    scope: 'web',
    marker: 'storedImageDisplaySource(S.me.homeBg)',
    least: 1,
  },
  {
    release: 'v1251',
    name: '好友申请方向按来源区分，用户加的不会说成角色加的',
    scope: 'web',
    marker: '绝不能说成你申请加ta、或你终于等到ta通过',
    least: 1,
  },
  {
    release: 'v1251',
    name: '陌生来电知道是自己拨出的，不再反问用户是谁',
    scope: 'web',
    marker: '绝对不要反问“你是谁”“你哪位”',
    least: 1,
  },
  {
    release: 'v1251',
    name: '小本子由角色自行判断要记什么，日常喜好习惯都记得下',
    scope: 'web',
    marker: '记不记、记哪一条，完全由你自己判断',
    least: 1,
  },
  {
    release: 'v1251',
    name: '原生请求有界，挂死不会让「正在备份」永远卡住',
    scope: 'web',
    marker: 'NATIVE_TIMEOUT',
    least: 1,
  },
  {
    release: 'v1251',
    name: '上游只认方图时，竖图被拒后退回方图再试一次',
    scope: 'web',
    marker: "res.status===400&&target!=='1024x1024'",
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
