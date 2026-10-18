# North 公开审核工程

此目录保存从被拒构建所对应源码恢复出的公开 North 工程，并只用于公开 App Store 审核修正。

- 产品边界：公开 North 仅提供用户授权后的本机管理与角色远程管理，不包含私人“小手机”网页界面。
- Bundle ID、App Group、Family Controls、DeviceActivity、ManagedSettings、HealthKit、定位和 APNs 能力保持原工程边界。
- 审核修正：把“真实同步”明确改名为“角色远程管理”，公开说明配对和角色命令，并提供需登录的角色控制台。
- 安全边界：审核账号密码只填写到 App Store Connect Review Notes，不得写入此目录或任何前端文件。
- 私人 App：`native/private-small-phone` 不得用此工程覆盖，也不得让公开 North 与私人“小手机”同时控制同一台本人设备。

Mac 上应打开 `PhoneCompanionTest/PhoneCompanionTest.xcodeproj`。提交新构建前，先按本目录 `审核提交说明.md` 完成服务端、账号、真机和 Review Notes 检查。

## 手动与远程锁态（核对到2026-10-19）

`CompanionSyncService`和本机`ContentView`共用默认`ManagedSettingsStore`及`savedLockedApplicationTokens`。页面的`@State`只是显示缓存，不能代表最新锁态。`PUBLIC_MANUAL_LOCK_STATE_V1`要求页面加载、回前台、收到远程变更通知时只调用`reloadManualLocksFromStore`读取配置，不写回屏蔽设置。用户主动单项/批量操作及选择变更先读最新状态，再执行原有操作；每日限额仍使用独立的dailyLimit store。

曾有风险：页面初始化时读到空锁态，远程锁定后页面task把旧空集合写回，清除远程锁定；反方向也可能复活已解锁状态。不得用反复配对、页面出现时重写旧锁态或持续强制补锁处理。远程命令等待读回期间可能发生本机操作，回执前持久化当前store，不写回等待前的旧集合，也不回滚覆盖期间的新操作。通知只刷新显示，不自动再次执行命令。

回归位于`tests/public-north-screen-time-sync.test.mjs`及`tests/permanent-fix-guard.test.mjs`。Windows集合操作重放仅验证状态覆盖路径，不是Swift编译或iPhone系统拦截证明。Mac需编译并验证远程锁定后切换本机管理/回前台/同步仍保持锁定、远程解锁后不复锁、单项操作不改其他App及每日限额。实际拦截仍以打开目标App的系统屏蔽页为准。此修复只属于公开工程，私人版仅作只读对照，不能自动同步修改或打包。

## 本次交付候选

2026-10-19交付候选为1.0.1 / Build14（五个target的十份配置一致）。与既有Build13源码包逐项比对后，保留其定位授权解释与中性“继续”按钮，以及NSHealthUpdateUsageDescription上传校验字段；字段说明不写入健康数据，实际仍只读取步数。保留主线已授权的公开版屏幕时长撤除，不从旧包恢复屏幕报告采集。Team、Bundle ID、App Group、扩展和原生权限范围保持。

当前只具备Windows源码/受控浏览器验证；没有Mac构建、签名、IPA或送审完成证据。编译前先核对Mac未提交内容、App Store Connect当前版本和最大build；Build14仅为本地候选，若已被占用须递增，若1.0.1已发布须使用可提交的新版本号，并同步所有target，不能覆盖Mac现场或用此候选冒充已安装版本。仅在真机配对、锁定保持、解锁及限额验证通过后上传并提交审核；已有账号和审核演示资料需在真实后台核对，不能把旧说明当当前已完成。
