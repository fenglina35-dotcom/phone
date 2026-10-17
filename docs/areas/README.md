# 按功能分的小册子

改某一块之前，只读这一块的小册子就够了。每份一两页，只写三样：

1. **现在是怎么工作的**（带文件和函数名，方便直接跳过去）
2. **踩过的坑**（做什么、别做什么，以及为什么）
3. **试过但失败的办法**（别再走一遍）

规矩：

- 写的是**现在仍然成立的事**。某一天的进度（"未提交、未推送、未打包"）不写在这里。
- 每条教训尽量指向守住它的测试；没有测试的，写明"靠人记"。
- 改了这一块的行为，就在同一次提交里改这份小册子，并更新文末的"核对到"。
- 事故的完整经过仍然追加到 `docs/maintenance/AI开发项目_Bug记录模板.txt`，那是档案，
  需要时按关键词搜，不必通读。

| 功能 | 小册子 |
|---|---|
| 屏幕共享（含画面识别、角色自主观察） | [屏幕共享.md](屏幕共享.md) |
| 登录角色微信（以角色身份看/发 ta 的微信、和查他手机互通） | [登录角色微信.md](登录角色微信.md) |
| 语音情绪与 3D 贴耳（声音与通话里的一个开关） | [语音情绪与3D贴耳.md](语音情绪与3D贴耳.md) |
| 温馨小家（私人版 3D 小家、线下/线上场景、性能） | [温馨小家.md](温馨小家.md) |

其余功能还没有小册子，仍按 `AGENTS.md` 和 `docs/maintenance/` 里的记录来。改到哪一块，
就顺手给哪一块写一份。

## 心声与思考摘要

现在：微信角色私聊的顶部心声通过 toggleChatThought 在原圆角小气泡内部撑开/收起，refreshChatMood 不得改回中央弹窗。普通心声始终独立显示。设置→聊天与媒体的 roleThinkingPreview 默认关闭；关闭时保留原请求协议。开启时仅捕获微信角色私聊本轮被接受的回复摘要；Claude 使用当前角色所选路线 /messages、thinking enabled、默认预算2048（1024～32768），max_tokens 为思考预算加原正文额度。其他模型仅展示接口实际返回的 reasoning_content/reasoning。接口摘要不代表完整内部思维链，不显示签名，不将摘要交给动作解析器。

边界：roleThinkingCapture 暂存候选；roleThinkingCommit 校验当前账号、角色、生成令牌和最终采用文本，空摘要覆盖旧摘要，阻止修复候选、旧账号和过期回复串入。角色后台档案推送使用原字段白名单，不增加摘要上传。预算不是保证长度，平台上限与接口支持决定是否可用；开启遇到接口不支持时可以关闭恢复原协议。

踩坑：仅修改 renderChat 的点击动作会被 refreshChatMood 在新回复后覆盖；两者必须一致。气泡内部按钮阻止冒泡，正文点击仍可收起，避免嵌套按钮误触。仅修改 settings.chat 的测试会漏掉已初始化的角色路线，实际测试必须配置 chatRoutes。不要以元素存在代替可见弹窗检查。不要把 API 返回签名存入心声。自动自适应思考在该线路短测未返回摘要，明确 enabled + budget 才返回；不伪造完整链，不以 prompt 索要隐藏推理替代协议。

验证：tests/wechat-translation-reasoning-queue.test.mjs 覆盖双端开关、预算、路线、历史图片、正文隔离与过期/账号隔离；scripts/check_chat_authorized_phone.cjs 设置 NORTH_THINKING_PREVIEW=1，执行双端真实HTML回复与原地切换，模型HTTP为明确标注的界面测试摘要。私人iPhone和不同中转平台仍需实际验证。核对到：2026-10-14。

视觉补充（2026-10-14）：气泡内部右上角放小尺寸摘要展开/收起和“关闭”按钮；关闭只收起整颗心声气泡，不关闭设置开关。正文与思考摘要之间使用细分界线，避免中间大按钮打断阅读。

显示补充（2026-10-14）：摘要区域仅展示接口实际返回的思考文字，不显示时间、模型名、解释、截断说明或空内容提示；未返回摘要时保持空白，不伪造内容。相关接口限制与预算说明保留在设置和本小册子中。

## Fish 会员登录（MCP 模式）

现在：设置 → 声音与通话 → 语音平台多了「Fish 会员登录（用套餐点数）」（provider `fishmcp`），原「Fish Audio（API Key）」不动。会员登录不填 Key：fish-mcp.js（两包字节一致）用 OAuth 2.1 + PKCE（S256，自带 SHA-256，因为 iOS 本地页面不一定有 crypto.subtle）、动态注册公开客户端，登录时在 Fish 官方页选团队；之后用 JSON-RPC 调 Fish MCP 的 text_to_speech（参数只有 text、voice_id、language，不能选模型，由 Fish 决定），计费走会员套餐点数（1 点/UTF-8 字节，标签也算；别的团队的专业克隆音色双倍），返回永久音频地址。设置面板用 get_credit_balance 显示套餐和剩余点数。_ttsOnce 里 `provider==='fishmcp'` 直接调 NorthFishMcp.speak，返回值仍是 {buf}/{err}；ttsExternalOn 对 fishmcp 不要求 Key。接口地址仍填 https://api.fish.audio，因此细腻情绪（Drama 3 识别、导演标注、3D）照常生效。

隐私边界：凭证只在本机 localStorage `north_fish_mcp_v1`，不写进 S，所以云备份、导出、分享、推荐角色都带不走；app.js 里不得出现这个键名（测试锁住）。「退出 Fish 登录」清除本机凭证。Fish 的 MCP 服务拒绝一切浏览器来源（2026-10-16 实测：无 Origin 200，github.io 与 `null` 都 403 Origin is not allowed，尽管 CORS 预检放行），所以 MCP 请求和音频下载走自己的中转 license.smallphoneapp.com 的 /fish-mcp 与 /fish-mcp-audio（services/phone-license-relay/worker.mjs）：固定上游、不带 Origin、只放行 initialize/notifications/initialized/tools/list/tools/call 和 text_to_speech/get_credit_balance/search_voices 三个工具，音频只取 https 的 *.fish.audio（实测 platform.r2.fish.audio）且不把凭证发给音频主机；凭证只随请求转发，不存不记。OAuth 登录（注册、授权、换码）仍直连 Fish。

登录流程：网页版同页跳转回来自动完成并清掉地址栏的 code。私人 App 的 WKWebView 会把外链交给 Safari（LocalPhoneWebView.swift），所以回调是 github.io 上的 fish-oauth.html，只显示授权码让用户复制，回小手机「粘贴授权码」（可贴码或整段网址）；不改原生代码。授权码一次有效且离不开本机的 PKCE 校验串。

踩坑：fish-oauth.html 在 /phone/ 下，访问过网页版的 Safari 会被 sw.js 用缓存外壳顶替（实机看到小手机登录页、没有授权码），sw.js 必须对它直接走网络（v1758）。踩坑：直连 Fish MCP 会被 Origin 拦下，CORS 预检通过不代表请求能用，必须带真实凭证实测。挑语音工具时曾把 speech_to_text 误当成生成工具，现在排除 to_text/stt/asr/transcri/clone/list。MCP 回包可能是 JSON 也可能是 SSE，两种都解析；会话号 Mcp-Session-Id 失效（404）时重新 initialize。

验证：2026-10-16 用户 Plus 团队（My Team，250000 点）经中转实测：余额查询成功，「你好呀」生成扣 9 点、音频 11KB 下载成功。services/phone-license-relay/worker.test.mjs 锁中转白名单；tests/fish-mcp-v1756.test.mjs（PKCE 对照 Node crypto、粘贴登录、MCP 会话与 SSE、音频提取、两包一致、app 钩子与 Key 模式不变）；permanent-fix-guard v1756 条目。真实账号登录与生成需在有会员的 Fish 团队上实测。核对到：2026-10-16。

## 角色订票进聊天记忆

现在：角色输出 [订机票|…]/[订火车票|…]/[订演唱会|…]/打车指令时，consume 会把指令从角色原话里删掉，订单由各 travel-*-booking.js 的 notify 以 type:'ticket'、role:'assistant'（角色付款时）推进聊天。msgToText 的角色分支对 ticket 复用通用分支的摘要（NorthFlightBooking.summary 等），包成「[我订好并发给你的订单卡：…]」交给角色。

踩坑（2026-10-16 实机）：角色分支以前没有 ticket，直接 return m.content||''，卡片没有 content，于是角色在历史里只看到自己说「我先试试帮你订」、看不到订成功，几轮后坚称没订过；人设、记忆都很短，与上下文长短无关。系统提示里的「新版模拟机票订单」清单虽有这张票，但与历史里的空白矛盾，模型会信历史。新增卡片类型时，必须同时检查 msgToText 的用户分支和角色分支。

v1762 补查全部卡片类型：角色发出的真人店铺外卖（marketfood）、代付成功（paid）、拒绝代付（payreject）、骰子（dice）、一起听歌邀请（musicinvite）同样只在通用分支有文字，角色分支返回空，已一并补上；普通外卖 food/deliveryorder、红包、转账、礼物、酒店本来就有。

验证：tests/role-booked-ticket-history-v1760.test.mjs（两包，旧实现返回空串而失败；含 v1762 补查的五种卡片）。核对到：2026-10-16。

## 抖音记忆不重复追问

现在：dyMemoryPrompt 每轮把抖音私信、群聊、她最近 4 条作品与评论放进角色系统提示（「抖音上最近发生的事」）。v1762 起每条前面带「（多久以前）」，并明确：微信里已经问过、夸过、聊过的作品不要再问，除非她自己又提起或有新作品、评论、私信。

踩坑（2026-10-16 实机）：以前没有时间、标题又写「可以自然提起」，角色问过一次后隔几轮看到同样的提示又问一遍。这是提示词层面的修正，真实模型是否完全不再重复需实机观察。

验证：tests/douyin-memory-no-repeat-v1762.test.mjs（旧实现失败）。核对到：2026-10-16。

## 快捷指令查岗截屏

现在：app.js 只有 NorthExtraPages 的受保护路由扩展；phone-shortcuts.js 的 CHECKIN_SHORTCUTS_V1 在双端追加同一组件，PhoneShortcuts.open 进入独立 shortcutSettings，原函数保留为 cloudOpen。开启前明确说明识图服务、额度和聊天图片保留，网页截屏开关禁用；原有云端动作、私人时长导入均保持。角色按当前微信路线写开场白，池按账号/角色隔离、支持删/重写；不使用预设台词，不将生成任务放入聊天。生成时带最近16条聊天和当前时间，角色同时给出想查程度 want 0-3（JSON 对象 {want,lines}，旧数组仍可解析）；超过3小时，或聊了新内容且距上次40分钟，前台自动重写，每天最多8次。「什么时候查」两档：试用（每次都查）/让TA自己决定（默认）。让TA自己决定时，角色同时悄悄定下次查岗时间 next（"HH:MM"，24小时内，离现在不足10分钟顺延到明天），存 planAt，不进聊天也不进角色提示；已有未过期（到点后2小时内）的时间不被新一批覆盖。页面只显示「TA心里已经有打算了」，点「偷看一眼」才显示，离开页面重新藏起。

原生 CheckInStore actor：配置、确认凭据、图片串行处理；小手机·查岗开场清旧凭据，先由 roleWantsNow 决定这次查不查（want 概率 0/10%/30%/65%，want 超过12小时最多按1算，23-5点×1.5封顶90%，45分钟冷却，每天最多5次；有角色定的 planAt 时，没到时间一律不查，到点后2小时内、且上次查岗早于该时间的第一次触发必查；上次查岗时间跨午夜保留，防止同一个时间查两次），不查就返回空、不弹窗；查才请求系统确认，确认后120秒单张有效。交给小手机查岗以 supportedModes [.background,.foreground(.dynamic)] 后台运行，没有确认凭据的截图直接丢弃不写盘；保存成功才 continueInForeground(alwaysConfirm:false) 打开小手机，失败改发本地通知。交给小手机查岗只接受已确认图片，1440像素JPEG、20MB输入上限、6张队列、24小时过期下次使用清理、临时目录不进备份。scope/账号/cid随图片保存，take不删除，ACK须匹配scope。Xcode主App是同步文件夹目标，新Swift自动纳入，不加到扩展。

接收：仅私人前台且App自身已解锁、设置有效时轮询本地队列（15秒及启动/回前台检查，不是夜巡、不对空队列发模型请求）。先imgPut，并像相册选图一样让消息 src 直接是图片本身（登记 _imgCache/_imgRev/_imgReady，存档层写成同一 idb 键），持久化后再ACK；不在该角色聊天就 openChat；receipt防重复与删除后重建。visionAPI只看已保存原图，成功后以本次明确分享事件交给原scheduleReply，遵循占用与角色限制。失败不伪造台词，已中断识图由聊天图片重试；账户/角色/开关/记忆重置变更后不写入新上下文。ACK后仅删除原生临时副本，聊天记录和正常备份保留。

踩坑：交给角色的说明曾只写「本人同意分享的一张截图」，角色不知道是自己发起的查岗，以为她把角色的话抄进了快捷指令（v1777 实机）；现在 Metadata.line 记下弹出的开场白，featureEventNote「你发起的查岗」写明是角色自己的查岗和那句话。点继续后弹窗还没收起就截屏，截图里带着弹窗；开场动作确认后等0.9秒再返回。消息 src 只写 idb: 短引用时，识图后 refreshChatMessages 局部重画直接用原始 src，不走懒加载回填，自己看到空白图（v1771 实机）。只在 cur().p!=='chat' 时跳转，停在别人聊天里不会进入。普通scheduleReply不带note会被默认手动回复挡住，实际只出现生成与识图请求；不要改全局手动开关，应使用featureEventNote表示这一次已确认分享。不能把临时图片“取到”当作已保存，ACK必须晚于持久化。不能把截图仅存本机当真，真实识图会发给设置的服务。不能用全局未分账号的开场白或固定兜底。Windows的文件URL必须fileURLToPath，不能直接.pathname；漂移守护的KNOWN不能放宽。

验证：tests/phone-shortcuts.test.mjs；scripts/check_chat_authorized_phone.cjs 使用 NORTH_CHECKIN_PREVIEW=1，模型HTTP和原生接口受控，prompt/myActivity/visionAPI/普通回复/图片库不替换；NORTH_CHECKIN_BASELINE=1复现原缺模块独立入口失败。门禁会核对截图在角色聊天中真实显示、停在别人聊天也会跳转。原生编译和真实iPhone系统确认/截屏/冷启动仍须Mac验收，不以Windows绿灯代替；continueInForeground 在自动化中是否额外询问、不查时是否完全无感须真机确认。核对到：2026-10-16（v1775/iOS456）。



私人版每天三次（DAILY_CHECKIN_V1，用户 2026-10-17 明确要求，只改私人包 phone-shortcuts.js 与原生）：不再按最近聊天重写、不再有「什么时候查」两档和想查程度。每天第一次打开（autoDue 只看 planDay 是否今天，失败当天最多再试3次）角色写一次：三个不同的查岗时间 times（JSON {times,lines}，提示里不带聊天记录，间隔不足45分钟的只算一个）和8句开场白；存 cfg.plans/planDay，同步给原生 mode:'daily3'、plans。原生 dailyPlanDue：到了某个时间后2小时内、且上次查岗早于它的第一次触发必查，每个时间只查一次，没有随机。页面显示「TA今天打算查你 N 次」，点偷看才出现三个时间框（可直接改，改完立刻同步）；开场白每句可改、可删、可自己加（不超过40字，不能带方括号指令）。手动「让TA重新写今天的」仍可用。快捷指令里必须用「如果 查岗开场 有任何值」把截屏和交给小手机查岗包起来：不查岗时开场返回「没有值」（nil；空文字会被快捷指令当成有值，iOS467 实机仍闪屏），后面的截屏就不执行，屏幕不会闪（用户反馈每次打开 App 都闪一下）。App 不能自己到点运行，必须有「特定时间」或「App 打开时」自动化去触发。网页包 phone-shortcuts.js 保持原来的想查程度逻辑（测试按前缀分开）。

网页版（v1780 起）：查岗截屏只有私人 iPhone App 能做。网页的设置行小字改为「替你发消息、向角色报告事件」，PhoneShortcuts.open 在非私人原生时直接进入云端动作（未连接 North 时显示教程），云端动作窗口与生成结果窗口有「详细教程」（PhoneShortcuts.guide，只在网页 phone-shortcuts.js）。私人版不改。
## 情侣空间锁定到点自动解锁

现在：角色锁 App（小手机内置 App 与伴生的真实 iPhone App）必须带解锁时间：[锁定|App名|到07:00]、[锁定|App名|3天]、2小时、30分钟、明晚10点；标签没写时间时依次：lockUntilFromText 从角色这条回复的可见话里找（锁到…/锁你N天/N小时后再给你开/明天中午再给你开，支持中文数字，内心块不算），再 lockUntilAsk 后台问角色一句（不进聊天，roleInterceptStage「锁定解锁时间」，账号或绑定变化则作废，只覆盖仍是默认值的记录），都失败才用下一个至少一小时后的 07:00；最长7天。无上下午词的「N点」取更近的上午或晚上（晚7点说「到十一点」是23点），补零写法 07:00 仍是早上。教角色的四处锁定说明都写了这条。applyControlTags 在执行任何锁定标签前用 lockUntilPrepare 取出时间段并还原标签，原锁定代码不变；执行完 lockUntilCommit 按前后快照只给新锁上（或已有时间的再次锁定）的目标记 S.couple.lockUntil（'int:'+内置键 / 'ext:'+外置ID），外置同时发 device.autoUnlock 给原生。lockUntilSweep 每30秒和回前台检查：到点内置删锁、外置发角色解锁命令；目标已被提前解锁就删记录。情侣空间「管控授权」页「ta锁住的」和打开被锁 App 的提示显示「还剩…·几月几日 HH:MM 自动解锁」。角色看到的锁定状态（buildSystem 内置控制台账与「你现在锁着ta的」、伴生外置状态、companionControlLedgerForParser）都附 lockUntilRoleNote「你定的解锁时间：…，还剩…」，否则角色被问锁到几点会说没设时间（v1779 实机）。「你现在锁着ta的」整段要求授权过内置 App，只用伴生锁真实 iPhone 时根本不出现，外置时间又埋在伴生设备长段里，角色仍说没设（v1781 实机）；现在 buildSystem 在授权判断之前单独加「# 你自己定的自动解锁时间」（lockUntilRoleRows，内置与外置都列）。自动限额锁（auto）不受影响。

原生：CompanionSyncService.scheduleAutoUnlock 把 externalID→解锁秒数和 token 存进 App Group（companion.lock.autoUnlock.v1 / .token.），启动一次性 DeviceActivity「autoUnlock.*」（至少15分钟）。PhoneCompanionMonitor 在该活动 intervalDidEnd 时把 token 从默认屏蔽库和 persistentLockLedger 库及账本移除，记录保留；主 App 在 effectiveLockedTokens 开头 applyDueAutoUnlocks，先把到点条目从 UserDefaults 保存的锁定名单和账本删掉，避免重新补锁。提前解锁（unlock 命令）会 forgetAutoUnlock。屏蔽页只在有未到点的解锁时间时显示一行浅白剩余时间（每次显示屏蔽页时计算，不是实时跳动）。

踩坑：主 App 会用保存的锁定名单（UserDefaults.standard，扩展读不到）把屏蔽补回去，只靠扩展清屏蔽会被重新锁上，所以必须在补锁前清名单。Monitor 原本任何活动开始/结束都清每日限额，新活动必须按前缀跳过。旧测试只抽取 applyControlTags 片段运行，接入点要用 typeof 守卫。旧屏蔽页灰色解释小字（v1113 移除）不能加回，只允许剩余时间一行。升版本号脚本只能改版本号上下文，16进制哈希里可能含有版本号数字（v1777 发布时误改过一次测试里的图片哈希，已撤回）。

验证：tests/role-lock-until.test.mjs（时间解析、默认7点、7天上限、标签还原、双端说明与接入点、原生源码）；核心聊天门禁 roleLockUntil 用真实 applyControlTags 锁「附近的人」2小时、管控授权页显示、到点自动解开、无时间默认7点（旧实现失败已验证）。未真机验证：超过一天的一次性 DeviceActivity 能否按时触发、App 关闭时屏蔽是否真的解开、屏蔽页文字。核对到：2026-10-16（v1783/iOS460）。

## 微信文字自动翻译

现在：角色外语文字消息由 roleTextTranslationHTML 在渲染时标记待翻译，roleTextTranslationSchedule/Flush 把同一聊天的气泡合并成一次编号请求（辅助模型、429 退避、漏号只补问漏掉的）。译文到达或进入“正在翻译”时用 roleTextTranslationPatch 只替换那条气泡（data-message-id）里的 .role-text-trans，并在原本贴底时保持贴底；找不到那一行才整页 refreshChatMessages。

踩坑：以前译文到达和标记“正在翻译”都会整页 refreshChatMessages，正好撞在新气泡出现的动画上，带翻译的消息出来时明显顿一下（v1783 实机）。旧测试只抽取翻译片段运行，调用处要 typeof 守卫。

验证：tests/wechat-translation-reasoning-queue.test.mjs；核心聊天门禁 diaryAndTranslation.translationPatched（译文出现期间整页刷新次数为0，旧实现失败）。核对到：2026-10-17（v1785/iOS461）。

## 查他手机 · 私人日记

现在：日记只在日记 App 解锁并打开时生成（roleDiaryGenerateDay，当天一篇），长度用 letterReplyBudget(c)，与「回复长度（信件）」同一设置，正文上限8000字。日记页顶栏单独为棕色（.spy-diary-nav，#6f5243→#5d4437，浅色文字），右上角刷新调用 spyDiaryRewriteToday：用当天真实记录重写今天这篇，保留收藏和时间，提示里附上上一版让角色换写法；手机整体刷新 spyRefresh 仍不碰日记。

踩坑：生成时 max 写死500、正文截1000，长一点就被截断（v1783 实机）。日记页原来共用“查他手机”的黑色顶栏和 spyRefresh，刷新显示成功但日记不变。

验证：核心聊天门禁 diaryAndTranslation（长度等于信件长度、棕色顶栏且刷新指向重写、重写后今天只有一篇且内容更新；旧实现失败）。未真机验证：顶栏上方安全区颜色。核对到：2026-10-17（v1785/iOS461）。

## 任务便签（按设计图重做：今日、全部、奖励、我的）

现在：task-notes.js（网页与私人共用同一份，TASK_NOTES_V2）覆盖 renderTasks，进入 go('tasks')。底部四个标签：今日、全部、奖励、我的。日历不放进任务便签（用户明确：日历有单独的 App）。自己加的小事存 S.taskNotes.items（text/time/cat/date/done），角色布置的任务仍是 c.tasks（completeTask 与奖惩不变）。旧卡片：未完成3天后、已完成30天后自动删除（prune，k30）。

星星：自己记的小事每天最多2颗（取消完成退回）；角色任务每项3颗（roleStarred 只记一次），三项全完成再 +3（roleBonus）。今日礼盒：当天至少3件且全部完成可领，70% 得2–4颗，否则1颗加角色一句悄悄话。

奖励屋（v1791）：小猫贴纸包10★、每天一包（packDay），一包最多三张未拥有的贴纸，三选一（packOffer 存着，中途关掉不丢）；稀有约两成机会出现，连续4包没拿到稀有则下一包必有一张稀有；集齐后显示“已集齐”。樱花主题60★、蝴蝶结80★（解锁后在「我的→主题装扮」开关）；神秘礼盒100★：必出一张未拥有的稀有贴纸（稀有全有则退10★），并让情侣角色通过普通 [送礼|…] 亲自挑礼物（boxGift）。兑换后35%机会角色自然回应一句。

聊天表情（v1791）：集到的贴纸自动进双方表情——用户聊天表情面板顶上多一个「小猫贴纸」页（包装 emojiPanel，4列带名字）；角色表情库多「小猫贴纸」文件夹（S.aiStickers，groupId tn-cats），角色只用部分文件夹时自动加上。每张贴纸、每个角色只加一次（chatPack/chatPackRole），用户删掉的不会再被加回。随包贴纸是相对路径，app.js 的 isImg 只放行 assets/task-notes/stickers/*.png，聊天、群聊、查手机都能显示。聊天里发出的表情有图时下面的含义文字隐藏（三个 HTML 外壳 .stickermsg img~.stkm），含义仍交给角色。

樱花主题与蝴蝶结：#tn-page.tn-sakura 换粉色底、卡片粉色并贴和纸胶带、右上角樱花枝（在小猫图后面）、9片花瓣飘落；今日页小猫换成 sakura-cat-calendar。蝴蝶结位置 BOW_AT 由用户在调整页亲手摆好（2026-10-17）；「我的」那只按用户第二次调整戴在右上角趴着的大猫身上（标题区，从右边定位）。「我的」资料卡头像默认用微信头像（是图片时），点头像可从相册换一张或用回微信头像（prefs.avatar）。

喵喵水晶球（SNOW_GLOBE_V1）：集齐30张且累计30天完成过任务（stats.days 里 done>0 的天数）才出现，只出现一次（S.taskNotes.globe）。情侣角色在聊天里发一张礼物卡片（type gift、tnGlobe，包装 buildPart 画成「喵喵水晶球」卡片），并让角色说一两句。点开：礼盒漂浮→点一下摇晃、冒星星→水晶球放大铺满屏幕（光芒旋转、1100粒细沙雪、拖动倾斜、点一下雪飞起来），下方日期；点底座改名字（最多16字，字号自动缩放）；“读 ta 的信”。之后在「我的」顶部卡片和贴纸册最后一格都能再打开。

拍照任务（PHOTO_TASK_PROOF_V1）：布置任务时多了 verify:'photo'（自拍、拍饭、拍手边的东西等），旧的 real 任务里带「拍/照片/自拍/合照/镜头」也算。completeTask 遇到拍照任务交给 openPhotoProof：必须在任务里上传照片才能点「交给 TA 检查」；识图服务看照片并判断是否符合任务，明显无关（风景代替自拍、截图、表情包、网图）会退回并说明原因；符合（或识图不可用）才把照片发进聊天并完成，角色收到“ta 把内容发到聊天里了”。完成提示统一为粉色小提示 taskToast（finishTask、自己的小事、全部完成奖励、今日礼盒）。真心话/交作业回答框也是奶油样式（覆盖 openTruth/openEssay）。

角色的信：writeLetter 先走角色线路，失败、为空或断在半句就换副模型再试一次（complete:true 会自动续写被长度截断的部分，max 1400）；两次都不行就下次打开再试，三轮后用内置信。信存 globe.letter 永久保留；信纸上字号自动缩小到整封放得下。

标题字体：.tn-date/.tn-title/.tn-sub 用 assets/task-notes/tn-title.woff2（站酷快乐体 ZCOOL KuaiLe，OFL，按 task-notes.js 里出现的字做的子集，约52KB）。改了标题文案、加了新字时要重新做子集（pyftsubset，字表取 task-notes.js 全部汉字），否则新字会用系统字体显示。

踩坑：preserve-3d 的翻牌卡片上加 filter/opacity 会压平3D，背面露出来——变暗要加在两个面上。注释里写“某词 (”会被 cross-bundle-helper-drift 当成函数调用。版本号批量替换不要扫素材和 base64 文件。

图片：assets/task-notes/ 与 stickers/（两包各一份），贴纸裁边缩到最长边300；globe-design.jpg 是水晶球设计图。新增文件随 assets/task-notes 目录进私人打包清单；sw.js 有 tasks 校验规则。

任务提醒（做法一）：保存带时间的小事时 writeLine 让角色悄悄写好提醒话（失败换副模型一次），到点通知用角色的话，并插入聊天；做法二（服务器到点当场写、带语音）待做。

验证：核心聊天门禁 taskNotes（星星上限、礼盒、主题解锁、贴纸包每天一次且三选一、每张都是新的、第5包必有稀有、礼盒稀有、贴纸进双方表情且删掉不回来、聊天里图片能显示且文字隐藏、水晶球只出现一次、信第一次失败换副模型且收尾完整、提醒等）。未真机验证：真模型写信与挑礼物、通知横幅、字体在 iPhone 上的观感。核对到：2026-10-17（v1791/iOS464）。

## 共同生活语音模式（COHAB_VOICE_V1）

现在：在 cohab-theater.js 末尾的独立段落（两包同一份）。共同生活输入框没字时「记下」变成 ＋，点开下方是两块玻璃按钮「语音模式」和「多选删除」（顶上原来的「多选」去掉了；共同生活里点消息不再弹出编辑/删除，线下约会照旧）；一输入文字就变回「记下」。只有两人在一起（在家/一起外出）时才有输入框，所以 TA 不在家时看不到入口。进入后 _call.cohab=true（kind 为 video，直接是接通状态，不响铃、不拒接、不主动开口、没有静默续聊）。

界面（COHAB_VOICE_READER_V1，2026-10-18 用户要求“像阅读文章”）：接管 renderCall，换成阅读式页面：顶部「共同生活 · 语音」和名字，左边缩小，右边「结束」；中间旁白（斜体宋体、偏暗）和台词（大号宋体、外语角色带一行翻译）、自己的话靠右小气泡，旧的变淡、正在说的最亮；停在最底下时 TA 每说一句自动往下走，往上翻就停住并出现「回到最新 ↓」，新话不会把人拉回去；等 TA 回话时有三个点。不显示头像、不显示时长，没有摄像头和屏幕共享。缩小后的小条：不显示头像、不计时，按钮写「结束」。原来的 #callSub 字幕保留但隐藏（引擎照常写），updateCallSub 之后刷新阅读页，另有 0.6 秒的轻量检查兜底。颜色跟共同生活页一致：读 offStageAttrs（外观里的气泡色、旁白色、背景图），黑底；玻璃皮肤时自己的话是深色描白边，经典皮肤用外观里的颜色。输入栏左边有「旁白」开关（同共同生活打字时的旁白）：打开后写的是自己的动作，存成【…】，阅读页右侧斜体显示，角色当成你的动作；「说/写」上方有「让TA回」：共同生活开了手动回复时，说的话只记下，点它才回；没开时说完自动回，它用来让 TA 接着说。角色的格式（【】旁白 + 台词，外语角色原文加翻译）不变；线上电话的格式完全不受影响（所有改动只在 _call.cohab 时生效）。

角色那边：callAI 在 _call.cohab 时用 CohabVoice.system（cohabSystem + 共同生活记忆）、CohabVoice.history（共同生活历史 + 这一段语音）和 CohabVoice.frame（当面相处：没有谁打给谁，不说“你打过来了/打电话/挂了”，不提镜头，【】是第三人称旁白，外语角色仍原文一行加翻译一行），不补“看着镜头”的默认动作。踩坑（2026-10-18 实机：角色说“你打过来了”）：这一段在进行中暂存在微信消息里（带 _call），cohabSystem 里的跨渠道统一时间线和连续性锚点把它标成“[视频通话]/[电话]”。现在生成提示前 CohabVoice.hideSession 先把这一段从微信消息里拿出来、建完提示再放回，连续性锚点改用 cohab 渠道。

不串台：结束（含角色写了 [挂断]）不发微信“通话结束”消息、不进电话最近记录、不让角色在微信里对挂断作反应，共同生活聊天里也不加任何提示（用户要求不显示聊了多久）。这一段从微信消息里整段移走：存进共同生活的 voiceLog，并以隐藏条目（_voice）写进共同生活历史（每句记下 hid 对应隐藏条目），页面不显示，但继续文字时角色记得；开了同步时微信看到的是「最近共同生活现场」，不是通话。结束后单独总结一次，写进同一份长期记忆，标【共同生活语音】（线上也记得），共同生活自己的总结不再重复算这段。

语音记录：共同生活设置 →「共同生活语音记录」（在「查看共同生活记忆」旁边），进行中的这一段也在（“正在进行”），每一句都能 ✎改、✕删（进行中改的是暂存消息，结束后改的是记录和对应的隐藏条目），整次也能删除。

期间暂停：cohabAdvance 不推进（作息出门、回家等）、共同生活手机自主行为/每日必做/补查暂停，结束后照常继续；语音模式中不能在共同生活打字（提示先点结束）。后台恢复时 S._activeCall.cohab 保留，恢复后仍是语音模式。

玻璃与防闪（COHAB_VOICE_GLASS_V1，2026-10-18 用户要求“和共同生活一模一样的材质”“现在现有的直接复制过去就可以”）：材质就是共同生活气泡实际生效的那一套（glass-theme.css 把 .offbubble 等压成 7% 白、不磨砂，再加 .offbubble:before 那条细高光环），cohab-theater.js 里 GLASS_BODY/RING 原样复制，不另做。用在：语音页的缩小、结束、回到最新、让TA回、旁白、话筒、说；自己的话是 .offmsg.me .offbubble；共同生活页的旁白/＋、＋ 里两块、设置里的小方块和下面几行、多人剧场卡片和按钮、多选栏的取消、让TA回、右上状态；从共同生活点开的页面（openModal 包一层：_off.mode 为 cohab、在 off 页、皮肤不是经典时给 #modal 加 cohab-glass-modal，closeModal 去掉）：页面本身、里面的分组和按钮；输入框和选择框用 7% 白加细白边（它们画不了高光环）。开着的按钮（旁白、话筒、主按钮）是更亮的白玻璃（30% 白），不用黄色。只有两处多了磨砂：缩小后的小条（浮在别的页面上，不糊字看不清）和点开页面后面那层遮罩。经典皮肤全部不动。踩坑：给「让TA回」加 position:relative 会把它从右上角挤到左边（它本来是 absolute），只给本来不定位的块加。门禁 cvTray 还检查从共同生活点开的页面是 7% 白、关掉后标记去掉。
液态玻璃（私人版玻璃主题、换了背景时，app.js 的 LG_SCENES 用 WebGL 画的镜片，就是她手机上看到的共同生活气泡）：语音页在 cohab-theater.js 里也登记成一页（root .callscreen.cvr-mode .cvr-stage.hasbg，放在共同生活前面），气泡、顶栏、按钮、输入栏和共同生活是同一块镜片；上面那层 CSS 材质加了 :not(.lg-ready)，只在没有镜片时兜底；镜片上开着的按钮用 brightness 整块提亮（底色会被镜片盖住）。白雾（COHAB_SETTINGS_NO_FOG_V1，2026-10-18 实机）：LG_OFF_HOSTS 里原来有整个 .cohab-settings，展开后是一块很高的镜片，边上的高光被拉长成上下两片白雾；现在只让标题行 .cohab-settings>summary 和里面每个小方块各自是一块镜片。tests/liquid-glass-home.test.mjs 守住。
第三轮（2026-10-18 实机：「太透了，字都看不清」「玻璃会掉材质，要重新进页面才出来」「旁白有的大有的小」）：①掉材质的原因：镜片块被 lgStyle 设成全透明，只靠小画布上画好的镜片撑着；手机切后台系统可能清掉画布、局部更新的新块也可能还没画，于是露出全透明。现在共同生活和语音页的每个镜片块底下都垫同样颜色的磨砂（气泡用外观里的颜色、按钮和小方块用深一点的磨砂、顶栏输入栏用条状磨砂），镜片盖在上面；另有 COHAB_GLASS_KEEP_V1：回到前台、pageshow、focus 时清掉「已画」标记整页重画，共同生活/语音页里的块有变化时也重画。②点开的页面和缩小小条改成磨砂（30,30,36,.62 + blur 26px/22px），里面的分组、输入框仍是 7% 白；标记改成看着 #modal 出现（MutationObserver），私人版「查看上一轮拦截内容」用的是原始 openModal，以前包函数套不到。③旁白大小不一：callIsActionLine 只认 80 字以内的【】，长旁白被当成台词（大字、带【】、还可能被念）；共同生活语音里放宽到 800 字（COHAB_VOICE_LONG_NARRATION_V1），线上电话不变。④「让TA回」（和多人剧场的「对谁说」）挪进输入栏，浮在 ＋ 正上方（COHAB_REPLY_ABOVE_PLUS_V1）。⑤外观只剩磨砂玻璃（OFF_GLASS_ONLY_V1）：offTheme 一律 glass，外观里去掉主题选择；没换背景时共同生活和语音页是纯黑。线下约会用同一个外观，一起变。
⑥没换背景时（OFF_BLACK_BG_V1）用一张纯黑的小图当背景，而不是“没有背景”：液态玻璃要有背景图（.hasbg）才画，以前默认背景下玻璃整个不出现，材质明显不一样。⑦我的气泡默认和 ta 一样（OFF_ME_LIKE_TA_V1：#26262a、白字）；还是以前默认浅黄 #d2c9ba/#181614 的迁一次，自己挑过颜色的不动。
踩坑（实机：文字会闪、上下跳两下）：旧 refresh 每次字幕或翻译一变就整段 innerHTML 重写，最后一句的进场动画跟着重播。现在按每句 id 增量更新（已经在的不动，只改 now/变淡），TA 的话等字幕对上这一句（声音开始）才用 offglyph 一个字一个字出来，等待时 visibility:hidden 占位不顶内容。门禁 cvNoReplay 数每句 animationstart 必须正好一次（旧实现最后一句播 3 次）。
笑声（COHAB_VOICE_ASK_V1）：语音条会把用户这一轮的要求（笑一下…）经 handPerf 交给 performance，通话以前没有；现在共同生活语音把用户这一句作为 ask 交给这一轮第一句会出声的话（prefetch 和 speakWait 都带）。仍然只在「细腻情绪」开着且语音是 Fish/ElevenLabs 时生效，其他语音模型听不到行内笑声。
验证：核心聊天门禁 cvNoReplay/cvTray/cvNoTapMenu/cvMic，以及 cvPrompt（含不出现“[视频通话]/[电话]”）/cvHistory/cvNoCamera（阅读页、结束、无头像无计时）/cvLiveLog/cvStored/cvMoved/cvNoWechatLog/cvMemory/cvNotice（结束后无提示）/cvRestore/cvPaused。未真机验证：真实语音合成和语音输入在共同生活里的体验。核对到：2026-10-18。

## 聊天搜索与网页功能继承核对

角色私聊与角色群的关键词搜索使用 wxSearchChats 按会话分组，wxSearchOpen 展开匹配项；wxSearchJump 设置一次性 _chatJump，扩大旧消息渲染窗口，restoreRenderScroll 消费定位并阻止置底覆盖。返回搜索页保留关键词与列表位置。gsearchRows/gsearchResultHTML 负责群内分类结果的点击定位；私人两个 HTML 入口必须包含 .wxs-page、明暗主题及 msgJumpHit 样式。

已审查并同步的共享行为：聊天翻译批量排队及限流退避；groupReplyPlan 的角色条数覆盖与 aiGroupReplyRun 每轮总预算；手动总结的 summaryPerspectiveIssue；登录角色微信 hisMsgKey/hisCollapseRepeats 防重复；他人群气泡透明边框；私人 CSS 加载失败自动重试定义。

审计不能只比较脚本文件名或打包完整性：旧 v1767 的文件齐全，但 app.js 里仍是旧功能。v1738、v1742 的行为回归现在必须同时跑网页和私人源码，已有旧实现19项失败证据。private-web-feature-parity 对上述关键函数比较实际代码；永久门禁双端守住函数标记。真实 HTML 搜索检查需覆盖超过默认窗口的旧消息、关键词与群命中、返回结果及浅色样式。

刻意保留的差异：私人原生时长/管控/共享屏幕和 HomeKit；角色收件窄入口、后台任务、真人好友分段减负、文件备份与安全恢复合并；私人诊断扩展独立实现。网页 web-hotfix、网页云端额度/停用入口和 webRecovery* 不照抄进私人包。delivery.js 的私人肯德基上下文补判比网页多，保留；phone-shortcuts.js 两端保留各自已有入口并共享查岗追加模块。公共策略脚本和原生桥不为消除差异而覆盖。核对到2026-10-16。
