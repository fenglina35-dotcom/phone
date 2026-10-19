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

时间段截止（TASK_DUE_SLOT_V1，2026-10-18）：角色布置的任务如果写了早上/上午/中午/下午/傍晚/晚上/睡前，必须带 due（"HH:MM"）。genTasks 提示里要求角色自己给，并告诉它现在几点、过去的时间段不要布置；角色没给就由 taskDueFor 按关键词补默认值（早上10:00、上午12:00、中午14:00、下午18:00、傍晚19:30、晚上23:30）；布置时离截止不到20分钟的那条直接丢掉，用备用任务补数。taskOverdue 判逾期：今日页显示「早上 · 已逾期」，圆圈变虚线，completeTask、交作业/真心话、交照片都会拒收并提示。

完成卡片（TASK_DONE_CARD_V1）：交作业和真心话不再是纯文字，消息仍是 type:'text'、content 和以前一字不差（角色和所有读取的地方看到的一样），多一个 tnTask:{kind,id,title}；task-notes.js 包装 buildPart，只在自己发的这种消息上画奶油粉卡片（交作业用写字小猫 cat-study，真心话用趴着的 cat-lying）。任务名只显示一行；回答最多5行（裁剪放在内层 span 上，否则被折掉的一行会从内边距里露出来），超出出现「点开看全部」，打开的是自己挂在 body 上的卡片风格浮层（tn-dfull-ov），不用 openModal——微信页的实色弹窗样式优先级更高，会把它涂成黑底。

没做完的惩罚（TASK_PUNISH_V1）：第二天 checkTaskPenalty 发现昨天有没做完的，让角色自己想一个小惩罚并必须真的执行：扣零花钱 [扣款|金额]（要钱包授权）、锁软件 [锁定|App|时长]（要授权的App）、罚任务 [罚任务|内容|字数|截止时间]（applyControlTags 开头处理，加进今天的任务便签，超出每日条数上限也保留，每天最多2条；还没布置今天任务时先排队，布置时并入）。taskPunishSnap 记下执行前的余额/锁/原生锁命令/小黑屋/罚任务数，taskPunishSweep（checkTasksDaily 每5分钟）对比判断是否真的罚了；3分钟后还没罚就再催一次，还没有就系统以角色名义补一条罚写检讨并插一行灰字。连续3天没做完（taskMiss.streak，相邻日期才累加，做完的一天清零）且情侣空间授权了小黑屋：让角色先用自己的口吻说要关，再 [关小黑屋|…]（原有 roleJailAnnounced 要求先说出口才关）；关不成就改成普通惩罚。罚的任务都有截止时间（taskPunishDue：角色定，不写为4小时后，最晚23:30，至少留1小时，太晚了就是23:59）；taskPunishDeadline 发现过点没做完：授权了小黑屋就先通知再关，没授权就再罚一次；这条记 missed，第二天不再重复算账。

任务提醒（做法一）：保存带时间的小事时 writeLine 让角色悄悄写好提醒话（失败换副模型一次），到点通知用角色的话，并插入聊天；做法二（服务器到点当场写、带语音）待做。

验证：核心聊天门禁 taskNotes（星星上限、礼盒、主题解锁、贴纸包每天一次且三选一、每张都是新的、第5包必有稀有、礼盒稀有、贴纸进双方表情且删掉不回来、聊天里图片能显示且文字隐藏、水晶球只出现一次、信第一次失败换副模型且收尾完整、提醒等）。未真机验证：真模型写信与挑礼物、通知横幅、字体在 iPhone 上的观感。核对到：2026-10-18（网页v1832/私人v1835/iOS484）。

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
第四轮（2026-10-18 实机：「很多按钮只有灰色的色块」「液态玻璃其实没有颜色，是根据背景来换颜色的，你不需要去固定它的颜色」）：COHAB_GLASS_NO_COLOR_V1——共同生活页、点开的页面、删除确认框（#cfm，另一种弹窗，以前漏了）、缩小小条里的块一律不涂底色（background 透明），只用 backdrop-filter 把后面的背景磨砂、压暗（brightness .74，页面 .6，小条 .58）、提饱和，加一条高光环；开着的按钮不填色，改成描亮边（outline）。气泡仍用外观里的颜色。点开的页面不再用 :before 画环（页面会滚，环跟着内容走，屏幕中间会留一条白线），改用 border。核对方法：逐个打开共同生活页、＋、多选、设置、外观、测试控制、记忆、作息、删除聊天记录、语音记录（长到要滚动）、拦截内容、多人剧场、模型诊断、确认框、语音页、小条，读每个可见块的实际底色，涂了颜色的一个都不能有；门禁 cvNoPaint 守住其中设置、记忆页和确认框。小条没拖过时默认放在共同生活顶上几条的下面，不挡标题和时间。语音页 TA 的话改回像微信一样整句弹出（@keyframes cvrPop），不再逐字。笑声第三次没修好，按规矩先不再加规则：VOICE_SEND_DIAG_V1 在 ttsArr 里记下最近 12 句真正交给语音的文字（语音服务、模型、是否中转、细腻情绪开关、语气、她这一轮的话），共同生活语音记录最下面「语音诊断」能看，等她试一次截图再定。
踩坑（实机：文字会闪、上下跳两下）：旧 refresh 每次字幕或翻译一变就整段 innerHTML 重写，最后一句的进场动画跟着重播。现在按每句 id 增量更新（已经在的不动，只改 now/变淡），TA 的话等字幕对上这一句（声音开始）才用 offglyph 一个字一个字出来，等待时 visibility:hidden 占位不顶内容。门禁 cvNoReplay 数每句 animationstart 必须正好一次（旧实现最后一句播 3 次）。
笑声（COHAB_VOICE_ASK_V1）：语音条会把用户这一轮的要求（笑一下…）经 handPerf 交给 performance，通话以前没有；现在共同生活语音把用户这一句作为 ask 交给这一轮第一句会出声的话（prefetch 和 speakWait 都带）。仍然只在「细腻情绪」开着且语音是 Fish/ElevenLabs 时生效，其他语音模型听不到行内笑声。
验证：核心聊天门禁 cvNoReplay/cvTray/cvNoTapMenu/cvMic，以及 cvPrompt（含不出现“[视频通话]/[电话]”）/cvHistory/cvNoCamera（阅读页、结束、无头像无计时）/cvLiveLog/cvStored/cvMoved/cvNoWechatLog/cvMemory/cvNotice（结束后无提示）/cvRestore/cvPaused。未真机验证：真实语音合成和语音输入在共同生活里的体验。核对到：2026-10-18。

## 聊天搜索与网页功能继承核对

角色私聊与角色群的关键词搜索使用 wxSearchChats 按会话分组，wxSearchOpen 展开匹配项；wxSearchJump 设置一次性 _chatJump，扩大旧消息渲染窗口，restoreRenderScroll 消费定位并阻止置底覆盖。返回搜索页保留关键词与列表位置。gsearchRows/gsearchResultHTML 负责群内分类结果的点击定位；私人两个 HTML 入口必须包含 .wxs-page、明暗主题及 msgJumpHit 样式。

已审查并同步的共享行为：聊天翻译批量排队及限流退避；groupReplyPlan 的角色条数覆盖与 aiGroupReplyRun 每轮总预算；手动总结的 summaryPerspectiveIssue；登录角色微信 hisMsgKey/hisCollapseRepeats 防重复；他人群气泡透明边框；私人 CSS 加载失败自动重试定义。

审计不能只比较脚本文件名或打包完整性：旧 v1767 的文件齐全，但 app.js 里仍是旧功能。v1738、v1742 的行为回归现在必须同时跑网页和私人源码，已有旧实现19项失败证据。private-web-feature-parity 对上述关键函数比较实际代码；永久门禁双端守住函数标记。真实 HTML 搜索检查需覆盖超过默认窗口的旧消息、关键词与群命中、返回结果及浅色样式。

刻意保留的差异：私人原生时长/管控/共享屏幕和 HomeKit；角色收件窄入口、后台任务、真人好友分段减负、文件备份与安全恢复合并；私人诊断扩展独立实现。网页 web-hotfix、网页云端额度/停用入口和 webRecovery* 不照抄进私人包。delivery.js 的私人肯德基上下文补判比网页多，保留；phone-shortcuts.js 两端保留各自已有入口并共享查岗追加模块。公共策略脚本和原生桥不为消除差异而覆盖。核对到2026-10-16。

## 抖音：角色编辑主页与纯黑框（DY_USER_EDIT_V1 / DY_SOLID_MODAL_V1）

现在：角色（和别的网友）的抖音主页数字那一行右边有「编辑主页」，右上角「…」也直接进编辑页，不再弹菜单。编辑页 dyUserEditView 用和「我」的编辑主页同一套 dyed-* 样子：换封面、换头像（只有角色能换）、资料完成度、名字/简介/性别/生日/所在地/抖音号、可以自己写的获赞/关注/粉丝/等级牌（留空恢复自动），最下面是原来「…」菜单里的功能（发私信、关注/取消关注、让 TA 自己写简介、让 TA 发一条作品、恢复默认背景、恢复用微信头像）。资料存在 S.dy.users[人]（nick、birth、dyid、likes、follows、fans、level，和原来的 bio、ip、gender、cover 放一起）；抖音名字只改抖音上显示的，微信名字不变（dyPersonFind 读 nick）；dyPersonDyid 优先用自己填的。进别人主页（dyOpenUser）时关掉编辑页。

纯黑框：openModal 在抖音页面（DY_SOLID_PAGES：dy、dydm、dygroup、dypost、dyuser、dywork、dycard）给 #modal 加 dy-solid-modal，uiConfirm 同样给 #cfm 加；dySolidStyle 注入的样式让页面纯黑、里面的块实心灰 #2c2c2e、不磨砂；开着的/主要按钮用抖音粉 #fe2c55，删除类按钮红字。灰色块那条规则用 :where() 降低优先级，否则会盖住粉色（踩过：隐私设置「已开启」变成灰的）。抖音页面上浮在封面上的小框（添加好友、换背景、右上圆钮、创作 AI 作品、别人主页的返回/求更新/搜索/…、编辑页的返回/更换封面）也改成实心灰、图标和字改白。

踩坑：隐私设置每行的按钮是 .btn（默认 width:100%），把左边的字挤成一个字宽的竖排；现在按钮 width:auto。核对方法：脚本逐个打开抖音我的主页、全部功能、我的关注（弹窗和关注页）、消息页、发起、建群聊、私信谁、隐私设置、我的编辑页和改字段、角色主页、角色编辑页上下、改名字、性别、确认框，读每个可见块：半透明底色或磨砂的为 0（只剩自动消失的提示条），字被挤成竖排的为 0（这项检查用旧的隐私设置排版验证过能抓到）。还没查的抖音页面：评论区、群聊、搜索、发作品、作品详情等。核对到：2026-10-18。

微信聊天页名字下面的共同生活状态（COHAB_WX_STATE_BW_V1，样式在 cohab-theater.js）：夜间主题字、圆点、边线白，白色主题（.wxlight）黑，不再是偏黄的灰字和金色圆点。

## 各软件点开的框改成实心（APP_SOLID_MODAL_V1）

现在：微信、电话、音乐、放映室、购物、X、世界书、游戏大厅（含里面各个游戏）、浏览器、抖音里，从 #modal 打开的框和 uiConfirm 的 #cfm 确认框，不再是玻璃主题留下的透明框。appSolidMark 在 openModal / uiConfirm 里判断属于哪个软件（solidAppOf：先看 curAppKey，微信和世界书看导航栈第一页 stack[1]，共同生活 off、线下约会 offline 一律不算），加 dy-solid-modal；白还是黑：微信看 S.me.wxTheme，抖音一律黑，其他软件看弹窗后面那一页实际的底色（solidPageIsLight，取屏幕左边一点往上找第一个不透明底色，亮度>0.6 算浅色，加 dy-solid-light）。黑：纯黑底、实心灰 #2c2c2e；白：白底、浅灰 #f2f2f7、黑字。主要按钮：抖音粉、微信绿、其他蓝；删除类红字。样式都在 dySolidStyle 里，灰色块规则用 :where() 让更具体的颜色盖过它。

核对方法：脚本打开这些软件的页面、能直接打开的弹框（微信加号/群聊/聊天加号/API 路线，电话更多/新信息/回收箱/陌生设置/副卡，音乐菜单/添加/歌单/搜索/唱片颜色，放映室在线/搜索/陪伴/声音/回复数，购物邀请/购物车，X 发推，世界书分类，游戏大厅、浏览器搜索记录）和每个软件的确认框，共 40 多个全部变成实心、没有透明和竖排；微信白色主题也查了；从共同生活点开的框不受影响。门禁 solidApps（上一版在这项失败）。没覆盖到的：页面本身上的框（第二步，一个软件一个软件做）、软件自己画的弹出层（不是 #modal 的，比如朋友圈编辑页、通话里的菜单、音乐播放页面板）、要特定情况才出现的框。补充（v1814/v1817）：设置、查他手机也算（导航栈第一页 settings / spy）；电子宠物不用黑框，用宠物页自己的配色（dy-solid-pet：奶白 #fffaf5 底、浅米色 #f4e9e1 框、咖啡色 #4a3a36 字、粉色 #e98ca8 主要按钮）。踩坑：白色主题的灰框规则漏了 .it 和 .bill，不在 .section 里的列表行（真人好友右上角那个小框）和订单行（购物「我的订单」）还是黑块、深灰字看不清；行里的按钮再深一档。表情包网格空着时那句提示占满一整行。这一轮打开核对了 49 个框（12 个软件，含微信白色主题和各软件的确认框）。刻意保留：微信 API 路线里正在用的那条、音乐「正在播放」那行和小图标的淡色底，是选中提示，底下是实心黑框，看起来不透。核对到：2026-10-18。

## 单次约会：结束后还能看上次记录（OFF_LAST_SESSION_V1）

现在：offEnd 结束时把这一次完整的现场另存为 o.lastSession（场景、时间、结束时间、全部消息的副本），o.msgs 照旧清空，所以记忆总结、「上次没结束」归档都和以前一样。上次约会是一整页（offlast，renderOffLast，和约会现场同一套 offstage 样子、只读，底部只有「再次开启」走 offlineInvite）：首页点这个角色（offlineEnter：没在约会、也没有能继续的，就进这一页）或点「查看上次约会」都进来。她要的是能直接点开的大屏，不是小框。offBeginSession 开始新的一次时才 delete o.lastSession，所以只有点了再次开启、真正开始下一次约会，上次的记录才被换掉。lastSession 不进任何提示词，只给她看。验证：浏览器里结束一次约会后 msgs 为 0、lastSession 4 条、首页出现「查看上次约会」、原文都在；再次开启后 lastSession 没了，也没有被当成「上次没结束」再归档一遍（网页和私人版都跑过）。另：朋友资料里的照片每张右上角有 ✕，确认后删掉这一张（CONTACT_PHOTO_DEL_V1）。核对到：2026-10-18。


## 记仇满八条与小黑屋进入顺序

未解决条数达到8（含8）时，当前情侣角色已获小黑屋授权且尚未进入，buildSystem调用roleGrudgeJailPrompt，要求当轮主动提出进小黑屋逐项处理；自然/原始输出共用规则。已消气的不计入，不由条数直接调用enterJail。角色台词、情绪和指令原因根据人设与真实旧账自己生成，没有固定台词。

GRUDGE_JAIL_ANNOUNCE_V1：roleJailTakeTags将关小黑屋/关禁闭/禁闭指令从提前执行阶段暂存；微信全部气泡送达并persistWechatMessagesNow成功后才执行。通话等本轮台词展示/播放结束后处理，直接主动推送等新消息保存后处理。roleJailAnnounced只认可可见的明确进入表达，排除内心/推理/引用、否定、条件威胁和未来意图；识别表达而非要求逐字匹配台词。未通过则不进入，不合成台词、不因满八条直接兜底关人；下一次真实回复仍带待处理规则。

执行仍需角色输出动作指令，并在延迟执行前复查账号、角色、授权、删除/拉黑和当前禁闭状态。保留原小黑屋测试入口、五分钟放出冷却与原谅逻辑。禁止恢复旧600毫秒抢先执行或自然模式跳过门槛；只改提示词不解决送达时序。

验证：tests/app-control-role-decides.test.mjs对两端执行真实管控函数，旧实现4项失败；scripts/check_chat_authorized_phone.cjs的NORTH_GRUDGE_JAIL=1使用真实buildSystem和回复流程检验先显示后进入；上游模型HTTP为受控，不证明真实模型每次遵从及真机听感。永久门禁收录本标记。核对到：2026-10-18。


## 后台角色通知的苹果环境纠错

APNS_ENV_FALLBACK_V1：phone-role-push的apnsFetch先使用设备登记环境。只有HTTP400且苹果JSON原因为BadDeviceToken时，才向另一个固定官方APNs环境验证同一payload一次；仅alternate.ok替换为成功响应。已接受、网络结果不明、鉴权/限流/其他400或服务端错误不跨环境重发，两边拒绝不循环、不伪造成功。通知先保存outbox再发APNs，前台持久化后ACK仍独立；不重放已确认旧消息、不更新token或全局APNS配置。

部署须只补线上该函数片段，线上可能落后本地其他功能，不得整份部署夹带。开发签名设备用Release构建仍可能持有sandbox token，不能把Release等同生产签名；本方案不依赖旧App再次打包即可纠正明确环境拒绝，token在两个环境均无效仍会保留失败。

验证：tests/apns-key-normalization.test.mjs对真实apnsFetch模拟两个官方端点，旧实现3项失败；覆盖双向恢复、相同payload、成功不重发、其他HTTP不换环境、网络未知不换环境、两边拒绝最多一次。核对到2026-10-18。


## 设置黑底与蓝色操作

SETTINGS_BLACK_BLUE_V1：render仅在settings/shortcutSettings路由为body添加data-settings-appearance、当前page添加settings-appearance；离开后清除。glass-theme.css在该范围把首页/七个分类页/查岗页的底片、滚动区、导航设为#000且background-image:none，分组保留中性深灰；原粉色.btn.p和.sw.on改#0a84ff，表单accent-color同步，设置内弹层底色黑、主按钮蓝。分组图标各自色彩、危险操作红色、其他软件和用户壁纸不变，两包独立追加同一限定规则，不覆盖私人既有CSS差异。

原玻璃settings-glass渐变优先级覆盖黑底；#settingsscroll原透明important含ID，覆盖时需带同一ID的限定选择器。不要用全局.btn.p或全局背景替换波及其他App，也不修改主题/路由保存逻辑。scripts/check_chat_authorized_phone.cjs的NORTH_SETTINGS_BLUE=1实际打开两端首页、七类及私人查岗，检查黑底/蓝按钮/弹层/离开后清除标记并保存截图；其余核心聊天检查继续用正常模式运行。核对到2026-10-18。

## 游戏大厅参考图重排（GAMEHUB_REFERENCE_V1）

2026-10-18 本地候选，网页与私人同时实现。用户要求参照新图重排，不改变游戏规则、邀请同意流程或存档格式。顶部去掉重复中文标题；横幅显示“游戏大厅”，保留PLAY TOGETHER与GAME STUDIO；真实继续存档、四分类、01/04通栏、其他两列、我的画作。原有13项全保留，参考图没有的“你说我猜”排13。筛选只改变展示，随机从当前分类选一个原入口；多人仍走原多人房流程。像素续玩进度来自filled/total，不造假存档、角色或进度；预览截图中的克劳德先生与0/505为隔离测试数据。

用户连续修正细节：第一版横幅只用文字描述生成，出现原图没有的城堡、复杂装饰、背对猫，用户明确说不像，已替换。最终横幅直接以用户原截图为参考生成，恢复短圆朝前猫棋子、简洁棋盘、骰子、旗子、月亮与星/心方块。画笔、透视门、立体骰子等12图标用同一参考生成透明4×3图集，不再用普通线稿冒充。多人按钮统一实心粉色渐变，取消绿色。用户要求心动审判爱心中心为心跳电波，整张横向入口卡片重新生图（HEART_CARD_ECG_V1），左爱心内ECG、右像素心与椭圆虚线轨道；文字、04/热门、点击仍是真实HTML。用户再要求骰子去包边并放大，单独生成透明dice.png，在随机一局与真心话大冒险两处使用（DICE_NO_FRAME_V1），不再套图标方框。

样式限定.page .gamehub-reference，不影响设置黑蓝、其他软件、游戏内页和原生伴生。原私人CSS/app.js周围差异保留，新增区域两包一致。素材四张，根目录assets/game-hub与PhoneWeb.bundle/assets/game-hub逐字节相同：hero-board.png（2053×766 RGB）、game-icons.png（1448×1086 RGBA）、heart-card.png（2200×715 RGB，cover只裁掉上下空白，不拉扁爱心）、dice.png（透明独立骰子）。原图经内置image_gen生成，运行素材均在仓库路径，不依赖.codex/generated_images。私人assets默认忽略，.gitignore仅放行game-hub及这四文件；未来发布须核对已提交树，不能以本机有图代替包内有图。旧唯一包不覆盖，未用未提交内容打包。

复用scripts/check_chat_authorized_phone.cjs的NORTH_GAMEHUB_REFERENCE=1，两端实际页面检查：13项、四分类、随机一局、主副模型切换、设置、邀请、多人数房、真实续玩与画作入口，四图成功加载，骰子无边/无阴影且放大，多人计算颜色为粉色，430/375宽无横溢出和标题越界，pageErrors=0。固定截图gamehub-{private,web}-full.png、gamehub-{private,web}-375.png与gamehub-private-heart.png；多余900高度首屏截图已删。已有全量4348/4348与定向893/893通过，后续纯视觉细调再跑上述实际浏览器，未声称iPhone已安装。

生图均使用内置image_gen，最终提示词以用户原截图为reference，具体如下（首轮被拒绝的无参考生成不再用于页面）：

1. 横幅：The attached full mobile UI screenshot is the authoritative REFERENCE. Produce ONLY the background artwork of its top banner, faithfully matching that specific artwork and geometry; do NOT redesign it. Output a clean wide 2.68:1 landscape production image. Remove all UI, all text, the pink random button and the rounded border, leaving their background intact and the LEFT HALF quiet and nearly black/plum for real HTML to overlay. In the RIGHT HALF reproduce the exact miniature scene seen in the reference banner: a SIMPLE flat black squared board with straight thin grid grooves, a thin white/pale pink dashed path around it. Two SHORT ROUND CHUBBY CAT PAWNS without tails/collars, both facing the viewer, pale ivory cat on the left and charcoal black cat on the right, standing on low pink metallic circular bases. A small blush pink pennant flag just behind and to the left of ivory cat. One upright matte dark dice with pale pink pips in back, upper middle-right. A small pale pink crescent moon lying vertically at upper far right. Simple thick black square game tiles bearing a pink star bottom-left of the board and pink hearts top-middle and bottom-right. Subdued charcoal/plum tones and delicate rose highlights. NO castles, fantasy skyline, ornate carvings, elaborate pedestals, landscape scenery, treasure, planets, necklaces or rear-facing cats.

2. 图标：Authoritative reference: the attached game lobby UI screenshot. Generate a production ICON SPRITE SHEET, not a UI mockup. Reconstruct its 12 small game icons faithfully, in a perfectly regular 4 COLUMN by 3 ROW grid. Overall aspect 4:3, each cell equal square. One centered dark charcoal beveled rounded-square tile per cell with generous equal transparent padding. Muted blush-pink/ivory narrow raised metallic line symbols and subtle pink glow, no text/numbers/letters. Row 1: lit candle in oval holder with tiny stars; bifurcating upward arrows; pink paintbrush with loose paint flourish, not pencil; pink outlined heart. Row 2: steaming shallow soup bowl; 3×3 grid with top-center pink cell; slightly open perspective door emitting lilac threshold light; isometric dark die with pips on three faces. Row 3: circled question mark; open book; spy in rounded hat; slanted lightning bolt. Exact uniform spacing suitable for CSS background-position, transparent between tiles. Note: atlas heart and die cells superseded in final page by the separate ECG card and frameless die.

3. 心动卡片：Generate ONLY a new wide horizontal BACKGROUND ART asset for the featured 心动审判 entry card from the attached authoritative screenshot, not a whole screen. Dark charcoal/plum black, subtle soft pink haze. Leftmost17%: softly beveled dark square with a fine blush-pink outline HEART and clearly recognizable ECG HEARTBEAT WAVE horizontally THROUGH ITS CENTER, sharp up-down-up pulse and flat connecting segments kept INSIDE the outer heart; NO nested smaller heart. Center19–62%: empty near-black/plum for live title and labels. Right66–92%: small pink pixel mosaic heart with a fine dotted elliptical orbital ring tilted up right, tiny hearts and understated four-point sparkles. No text, badges, arrows or outer frame; HTML/CSS provides these. No red or massive bloom.

4. 骰子：Production transparent app icon: ONE isolated three-dimensional black game die, styled exactly like the dark dice in the pink random-game button of the attached reference screenshot. Compact matte charcoal cube with softly rounded edges, three faces visible in elevated3/4 isometric perspective; pale blush-pink inset circular pips and subtle rose rim highlights. Large centered die occupying approximately88% of square canvas, tiny soft contact shadow. Completely transparent background. NO enclosing rounded square tile, badge, frame, overall outline, circular base, pedestal, outer border, text or sparkles. Only cube and natural edges/pips, elegant subdued charcoal and muted pink, legible at32–48px.

本地交互查看：previewRoute新增仅NORTH_PREVIEW生效的northPreview=gamehub直达入口；不改变普通启动或真实数据。2026-10-18已在可见内置浏览器打开http://127.0.0.1:18921/native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/index.html?northPreview=gamehub，示例资料、无真实存档时不造续玩卡。8765地址被旧Service Worker返回旧失败页，改为独立18921后刷新确认新大厅可见；已停止本轮8765服务器，只保留供用户浏览的18921服务。

## 游戏弹框跟随大厅风格（GAMEHUB_MODAL_V1）

2026-10-18 用户要求游戏大厅里面所有小弹框跟随新大厅。#modal/#cfm增加gamehub-modal，限当前gameshub/gs/drawguess/heartquiz/beadstudio/uc/wg/mgroom/tale/dread；离开后下一次打开清除。gameHubModal用于明确属于游戏的设置/选人/多人/画画/画作/游戏配置，即使从微信邀请打开也保留游戏风格；bead-studio同样调用该两包均定义的入口。可见游戏弹框上的二次确认继承样式，普通微信框和设置蓝按钮保持；不按旧导航栈第二项直接给所有后续页面套粉色，避免跳设置后样式泄漏。

实心黑紫底与粉细边、22px圆角、标题浅粉、输入深紫、主按钮粉渐变、取消深紫、删除淡红、选中开关粉、禁用与键盘焦点明确。覆盖动态dySolidStyle的通用黑/蓝important规则时限定html body与gamehub-modal，保留不透明、不磨砂，不改全局主题。色板本身的实际颜色不替换，游戏逻辑和数据格式未改。多人label.avline原被表单label规则压成block，头像名字开关竖排，补游戏限定display:flex/行高/头像与开关不收缩，逐张截图核对。sw有transition，测试等待计算色到最终值，不把动画中间色当故障。

复用NORTH_GAMEHUB_MODALS=1，旧实现先在settings marker失败；最终双端各16项实际弹框/确认/嵌套微信来源/375宽检查通过，页错0。包括12类入口、普通确认、来自微信游戏设置、该框二次确认及窄屏；核对粉色主按钮与开关、实心材质、横向行和不溢出，普通微信与设置蓝隔离通过。相关游戏/助手漂移/永久门禁909/909通过。截图gamehub-modal-settings/drawing/multiplayer-soup/confirm.png已复用固定目录，预览18921已刷新并打开新设置框。未提交推送打包，其他26项dirty不动。


## 世界书猫猫档案库（WORLDBOOK_ARCHIVE_V1）

2026-10-18 按用户黑底粉色参考重排世界书，网页和私人包同步。世界书/LORE ARCHIVE、猫猫档案库、真实数量、说明、猫鼻搜索、猫爪分类、常用/其他档案、猫耳图标、尾巴开关、新建与睡猫底线。数字按真实数据计算，系统共享设置不算世界书；不硬写参考图9本6启用。所有已有内容仍来自S.worldbook，分类不改变提示词生效规则。

常用档案是pinned展示标记，与always常驻生效分离；编辑保留原enabled/pinned，复制生成新id且默认停用，避免重复注入。开关、编辑、角色范围/关键词、新建、TXT/MD/JSON追加导入、JSON下载、复制、置顶和删除确认均接真实操作；分类改名/删除保留原内容。共享总开关暂停六应用并保存之前范围，再开启恢复；单应用仍独立设置。worldbookModal与appSolidMark将编辑、分类、范围、说明、更多及二次确认统一实心黑灰/粉边/粉主按钮，离开后清除，不覆盖游戏及设置蓝主题。

首次浏览器操作抓到onclick使用普通esc(JSON.stringify(id))而双引号未转义，导致点击无效；增加worldbookAttr/ActionId，列表/菜单/编辑保存删除/分类操作及属性值使用属性转义，并用带引号id/名称真实操作验证。普通esc只处理文本，不应用于HTML属性。预览load/save有保护，不能用load()在northPreview里判断持久化；QA调用实际saveNowAsync后去掉预览参数真正重开，从启动后的S检查保存内容和置顶。

复用scripts/check_chat_authorized_phone.cjs的NORTH_WORLDBOOK_ARCHIVE=1：双端真实搜索/分类/共享暂停恢复/单档开关/常用/新建编辑/复制默认停用/删除取消确认/分类新增改名删除/真实FileReader导入/真实JSON下载/特殊字符/375无横溢出/重开保存，页错0。固定证据worldbook-preview.log、worldbook-{web,private}-{full,375}.png、worldbook-menu/scope/editor.png。northPreview=worldbook只提供隔离可操作入口，不会读取手机真实存档，不自动造世界书。

必要生图运行素材在两端assets/worldbook-archive：archive-icons.png（1774×887 RGBA，4列2行）、footer-cat.png（2172×724 RGBA），字节一致，真透明；private .gitignore仅放行这两图。通过内置imagegen并使用用户参考生成，未用Python绘图。提示词核心：严格遵循参考的透明银白细线手绘猫档案，4×2等距网格，第一格打开的书与猫，随后猫耳黑色档案袋分别含聊天气泡/电话/面具/爱心/锁/游戏手柄/猫；无文字、无额外装饰；页脚单独超宽透明图，细象牙线、最右侧蜷睡猫与Z、贯穿底部平缓波浪线。CSS按图集格子定位，不把整张参考截图当功能页。

本轮为本地候选，未获世界书发布授权，不提交推送打包；原生伴生/签名/iOS480/桥42与既有世界书注入、导入兼容保持。Mac/iPhone观感与真机下载另需实际验收。

2026-10-18 世界书细节V2：用户反馈开关尾巴、右上角加号形状和统计重叠。两端仅CSS调整：移除尾巴伪元素，29px粉圆按钮采用两条14px细线居中组成加号；档案库改图标/可收缩文案/独立统计三列网格，副标题允许换行并限制在文案列，统计两列不挤压。双端世界书完整实际操作门禁再次通过，375/430截图更新，内置390宽实测尾巴none、加号29px/14px及文案不越界，已刷新用户可见页面。未提交推送打包。

2026-10-18 用户明确不要无用按钮：删除共享设置行中仅装饰的“常驻/系统”标签，不把它们改成另一组假按钮。保留总开关、整行/更多打开六项真实范围设置。普通档案的常驻/关键词与分类仍可点击进入实际编辑。双端世界书完整浏览器门禁再次通过，页错0，截图和可见预览已刷新；未发布。

2026-10-18 世界书发布授权：用户明确“推送”。本轮网页v1822、私人源码v1825，发布世界书猫猫档案库和实际操作/统一弹框，包含去尾巴、参考粉圆细线加号、统计独立布局及删除共享设置假标签的最终修正。仅版本上下文更新APP_VER/入口/SW/缓存标记及现有版本断言，已自动逆变换核对测试改动全为版本身份，没有删功能断言。原生iOS1.0.480/build480/桥42/签名不变；不生成新ZIP，不声称Mac/iPhone已更新。源码素材两端一致，其他工作区26项dirty不带入。最终测试与推送/线上状态以精简交接和固定日志为准；此前未发布描述仅为历史。


## 角色扮演猫咪剧情工作室（ROLEPLAY_STUDIO_V1）

2026-10-18 用户要求参考黑粉猫咪剧场重排，明确按钮有实际用途，全部小窗口同风格。两端renderRPHub改为角色扮演/CAT STORY STUDIO、双猫说明、最近开启的真实进行中剧情、猫耳头像、幕布卡片、搜索、全部/进行中/未开局及真实角色列表。计数来自未删除联系人与rpData.active，不复制示例数字、不捏造幕数；卡片使用真实消息条数和本局时间。多个进行中按startedAt最近一局置顶，其余保留列表。搜索匹配名字/备注/剧情标题，过滤不改存档。

继续/配置均复用rpOpen/rpSaveSetup原路由；角色行、粉按钮和箭头真正进入剧情，存档打开现有memory，更多提供配置/查看存档/进行中结束并存档，刷新重新读取内存状态、不调用模型。独立剧情的人设/成员/日期/开局卡与实际rpAI模型路由、busy/权限/存档边界保留，不更改微信原人设。rpArchiveDelete在删除前确认，捕获记录引用避免异步时索引误删。提示词、多人参演和原有红包redpOpen命名隔离未改。

剧情配置页、rpstage色彩与所有相关框统一黑灰粉色。rpStudioModal和appSolidMark覆盖帮助/更多/存档/动作/消息编辑/结束确认与嵌套删除确认，限rphub/rpset/rp及明确剧情框；从微信打开同样风格，下一次打开其他软件清标记，设置蓝色保持。头像helper实际产物class为avatar，初稿误写av造成图不撑满，已按真实DOM修正；刷新按钮补最小尺寸/box-sizing摆脱通用nav.r约束。原匿名普通esc不作属性转义，新入口使用rpStudioAttr/Id。

内置imagegen生成一张assets/roleplay-studio/theatre-card.png，两端文件逐字节相同，private .gitignore精确放行。无文字/头像/按钮的黑色宽幕布背景，左55%留白，右侧细粉灰幕帘/猫耳拱门和少量吊星；实际内容由HTML叠加。提示词要求2.4:1、近黑#101010、极细粉灰线、没有UI文字/人物/边框/水印/明亮辉光，右半装饰，左侧净空。生图源exec-7620b08b-88ed-448a-acaf-9eb9678e2a2f.png留在当前generated_images会话目录。页面不依赖生成目录。临时代码幕布已从渲染移除。

复用check_chat_authorized_phone.cjs的NORTH_ROLEPLAY_STUDIO=1：双端六角色隔离示例、真实搜索/筛选/继续/帮助/更多/存档删除取消与确认/消息编辑/动作框/结束取消与成功归档/配置直接开局/原微信人设不变/重开保存/375无横溢出及设置蓝隔离通过，pageErrors=0。仅开场模型和结束摘要的HTTP返回受控，实际rpAI正常/失败/账户切换仍由roleplay-open-v1384测试验证，不声称实模或iPhone已验。原角色回复专项及helper漂移8项通过。永久继承门禁已登记标记。固定roleplay-preview.log、roleplay-{web,private}-{full,375}.png和roleplay-help/more/archive/setup.png。northPreview=roleplay明确为六角色隔离预览，带“预览”标题，不读取覆盖用户真实联系人/存档，不把示例计数当手机状态。

本轮本地候选：基于da59146e（网页v1822、私人v1825），未改版本、未提交推送打包。世界书和游戏大厅已发布内容保留；原生/签名/桥/后台不动。后续打包需将这张必要新图纳入准确提交树及既有打包载荷白名单，不直接复跑历史包脚本。

角色扮演最终验收：全量4350/4350、0失败（含新增双端永久标记），双端完整实际UI门禁和真实角色回复/失败/账户边界专项通过，页错0。必要幕布图1942×809、1421380字节，两端一致。可见18921 northPreview=roleplay已打开六位隔离示例并带“预览”剧情标题；非用户手机当前状态。本轮未生成新的脚本/工作树/源码副本，固定日志截图保留作必要证据；原生、其他工作区和旧唯一包未动。

2026-10-18 用户否定首版全部线条和生成图：ROLEPLAY_PINK_LINE_V2。双猫改互不重叠的独立轮廓与圆角端点；头像耳朵不再用旋转/倾斜CSS边框拼接，改完整SVG猫耳外框；猫形搜索图标、卡片/搜索/存档边界及分隔线统一粉色#eca8cc。首版写实灰褐PNG被否定；imagegen以原asset和用户参考图重生简洁粉色线稿PNG，但在手机尺寸实查仍有细线断点，最终改为800×340独立theatre-card.svg连续Bezier曲线/固定线宽，删除台阶/流苏/杂褶，仅两侧幕帘、猫耳拱门和3星。SVG按100%100%适配，避免cover裁切后干扰文字。两版PNG不再是运行素材，已确认与generated_images源一致后仅移除本轮repo副本，源图保留；private .gitignore改精确放行SVG。原PNG说明仅历史，不得恢复。
最终双端实际UI全链路/375截图/新矢量图加载/计算粉色rgb236,168,204/无旧CSS耳伪元素检查通过，角色回复与helper专项8/8通过。没有重跑全量，上一轮4350是功能基线，本次为外观与矢量素材修正。已刷新可见预览、复用固定截图和日志，未提交推送打包。

2026-10-18 角色扮演最终选图以本条为准：用户明确“就使用这个图片”，已将附件codex-clipboard-5547da7d-ed67-4b0b-b98a-dc80392b0afd.png原字节复制为两端theatre-card.png，不再使用SVG幕布替代；CSS用user-choice-4刷新缓存，private精确放行PNG。此前SVG选择仅过程历史，拒绝版SVG两端已确认一致后移除。放大镜猫耳按x=14镜像，耳尖同y=2，端点同y=9。右上刷新图标偏右的实因是通用nav.r的justify-content:flex-end，角色扮演局部显式justify-content:center/align-content:center修正；实际390宽测图标中心与圆按钮中心X/Y偏差均0，双端430实际UI新增圆心误差<0.15px断言通过。搜索/筛选/配置/存档/确认/重开保存/375不溢出继续通过，页错0。浏览器与固定截图已刷新，仍未提交推送打包。

2026-10-18 角色扮演发布授权：用户明确“推送”。网页v1824、私人源码v1827，发布ROLEPLAY_STUDIO_V1与最终用户选定PNG（附件原字节SHA256 e69a60671450f61da9a1154ce40a0eb900661ab3044a4dc956079f5b79de8996）、粉色双猫/猫耳边框、镜像放大镜耳、刷新圆心对齐、全部实际入口和同风格窗口。不要恢复被否定灰褐PNG或临时代码幕布SVG。两个运行PNG完全相同并精确放行private Git；版本更新只动发布上下文，逆变换已核对其余测试变更均为版本身份，永久门禁新增双端标记不移除旧项。原生iOS480/桥42/签名未改；本次不新建ZIP、不声称Mac/iPhone安装。最终全量/核心聊天和线上核验以固定日志与精简交接为准，旧未发布描述均为历史。


## 2026-10-18 银行钱包与亲属卡页面（本地候选）
基线9ea110e5，网页v1824/私人v1827未升版。本轮修改两端app.js、role-family-card.js/css、wechat-me.js；银行钱包改黑绿余额卡、显隐/转入/转给自己/账单、实际近期流水，原黄色情侣云银行卡commerce-ui.js未改。转入复用聊天转账tfSend，不绕过确认直接改余额；转给自己复用原角色微信流程。我的服务银行卡用共用黑金芯片/波纹卡面，最后按用户要求整页与导航纯黑。亲属卡列表、玩家赠角色聊天卡及角色赠玩家月额度邀请用玫瑰卡面，充值/管理/申请弹框同风格。
预付自购卡S.roleFamily整数分账本与角色给玩家的c.family月额度完全独立；未改变事务锁、持久化失败回滚、角色/账户/收款人检查。撤回卡仅列表隐藏，不删除退款/历史/消息。新增撤回回归先在旧实现复现列表仍显示，再修复过滤。未使用参考图的虚构余额、卡号或有效期，显示真实模拟存档金额与标识。
验证复用scripts/check_role_family_card.cjs和eight-chat固定证据，双端实际HTML检查赠送/模型指令收下与自购/重复扣款阻止/跨角色与透支阻止/拒绝退款一次/充值/保存重开；角色赠玩家邀请实际接受和拒绝、个人银行卡充值与转零钱、转入原路径均通过。320/390/430与黑白主题卡片不溢出，页错0。过程中修复卡片footer被aspect-ratio裁切及银行卡标题受通用导航挤压；原购物UI测试旧rf-order选择器改为实际spyShopOrders弹框orderrow，没有修改购物业务。定向检查发现月额度显示接线误放food回退分支，已移至familycard分支并实际接受/拒绝验证。纯黑底首轮受全局重要样式覆盖，增加页面局部精确选择器，浏览器计算色rgb(0,0,0)验证。
隔离预览northPreview=bankwallet/familycards/mybankcards仅示例数据，不读取用户手机实账。未提交/推送/打包，不改原生/签名/后台；其他聊天26项dirty保留。整体回归结果见下方追加。

银行候选测试维护补充：首轮全量4352通过/1失败，失败为four-fixes-v1534旧测试只抽取familyRoleBank，未包含新共用卡面函数且有效卡fixture缺id；补入真实芯片/波纹/卡面函数和稳定fixture id，原旧实现复现及撤回/拒绝/有效卡/历史支出断言全部保留，专项3/3通过。私人新预览在虚拟native-unavailable桥下重新载入触发旧原生图片恢复失败页，撤销该不适用的预览测试方式；无原生桥的实际预览页面wxbank与卡面正常，生产原生恢复逻辑未改。双端原HTML操作门禁及实际保存重开仍在原测试步骤完成并通过。核心聊天发布门禁双端通过：真实提示词/回复投递、授权撤权、自动查看与重开持久化，页错0。

银行钱包/亲属卡候选最终验收：全量4353/4353通过、0失败；双端实际亲属卡/银行操作与320/390/430布局门禁通过、页面错误0；双端核心聊天发布门禁通过。我的银行卡导航和画布纯黑，截图family-private-my-banks.png已更新。情侣云银行卡commerce-ui.js两端逐字节仍等于HEAD；没有修改原生、签名、后台、唯一旧包或其他聊天26项dirty。仍是本地未提交/未推送/未打包，不称已安装iPhone。

2026-10-18 用户纠正亲属卡设计，以此为准：用户要求所有入口使用黑金银行卡，否定粉色旧卡和尺寸不一致。FAMILY_GOLD_UNIFIED_V2删除先前玫瑰色覆盖规则，亲属卡我赠出/我收到、玩家送角色聊天卡、角色送玩家月额度邀请均调用familyBankCardHTML同一真实模板，统一芯片/波纹/细金边/黑底/金字/1.8:1比例。聊天两方向固定相同260px上限，在可用空间内等比缩放；列表按页面宽度等比显示。寄语单行截断保留title全文，金额/状态/管理/接受拒绝仍保留，拒绝卡不改变尺寸，撤回隐藏不删账。亲属卡页面及导航纯黑，标签/新增/弹框改黑金；原黄色情侣云银行卡未动。固定浏览器门禁增加聊天三卡实际同宽与1.8比例、金字计算色，列表320/390/430黑白主题相同比例与无溢出断言。旧玫瑰候选和旧截图仅过程记录，不应恢复。未提交推送打包，原生/签名/后台/其他聊天保持。

黑金尺寸复核：新增320/390/430、黑白微信主题下，双方聊天三张卡实际同宽、1.8:1比例、金字计算色与footer边界断言；初次320发现最小字体使footer越过固定卡高，已降低窄卡字号下限并缩小卡号行边距，保留统一比例和全部状态操作，未放宽尺寸断言。

FAMILY_GOLD_UNIFIED_V2最终验证：全量4353/4353通过、0失败；双端实际赠卡/收拒/消费/充值/退款/持久化与320/390/430黑白主题列表及聊天同宽/比例/无裁切门禁通过，页错0。最终截图已更新为黑金。未提交推送打包，上一轮粉色成品结论已被本次纠正替代。

2026-10-18 银行钱包微信图标细节纠正：用户否定空心线条双气泡。登录微信转给自己入口改独立SVG绿色/白色实心双气泡、四个眼睛、深色细分界，36px居中显示；只替换该入口图标与对齐，两端一致，转账行为和黄色云卡不变，未提交推送。

2026-10-18 微信运动图标与剧情配置头像越界修复（本地候选）：用户确认角色银行绿色/白色双气泡SVG，要求微信运动沿用；两端wxStepsAppIcon直接复用同一spyBankIcon(wechat)图形，去旧绿底和两白气泡，运动入口/聊天行/详情共享；未改变步数采集、传感器授权或启停规则。实际两端wxsteps页面计算绿/白填充色及四眼检查通过。
RP_MEMBER_LAYOUT_V2：用户截图参演角色头像越出右侧。旧页面.field input的width100%同样作用于复选框，宽复选框挤走头像/名字；新增实际UI检查在未修实现失败。配置参演行独立grid列20px/36px/minmax(0,1fr)，checkbox固定18px，头像静态36px、长名字可折行，主角色横排。配置.two改两列minmax(0,1fr)，日期/时间允许缩小，避免原生输入最小内容宽撑破页面。仅配置页局部样式，不改其他复选框/通用field或剧情业务。320/375/430真实头像边界/checkbox宽度/页面无横溢出断言通过，勾选角色直接开局保存并重开仍在成员中；角色原微信人设不变，原搜索/筛选/继续/存档删除确认/设置蓝色隔离继续通过，双端页错0。角色回复/微信运动/双端helper定向9/9通过；永久门禁新增双端CSS标记。固定roleplay-setup.png与roleplay-preview.log已更新，整体回归以随后追加为准。未提交推送打包，原生/签名/后台/旧包/其他聊天不动。

微信运动图标/剧情配置最终验收：全量4355/4355通过、0失败；两端剧情工作室完整UI、320/375/430成员头像边界与无横溢出、勾选参演角色开局保存并重开持久化通过；微信运动实际绿白填充与四眼检查通过，页错0。roleplay-setup.png展示参演列表和日期时间下半页，定向9/9。未提交推送打包；本轮无iPhone新安装验收。

2026-10-18 银行亲属卡与配置修复发布授权：用户明确“推送吧”。网页v1825/私人源码v1828；包含SPY_BANK_STUDIO_V1、FAMILY_GOLD_UNIFIED_V2、纯黑我的银行卡、撤回卡列表隐藏保留账本、两种独立亲属卡的双方聊天共用黑金卡面与同宽等比、用户确认微信标志同步运动入口、RP_MEMBER_LAYOUT_V2与日期时间防溢出。发布缓存v1825-bank-family-1，所有本轮入口资源查询和对应版本断言同步；45个其他测试文件经正向替换验证只有版本身份变动，未改旧业务断言或扩大helper KNOWN。原生iOS480/桥42/签名、情侣云银行卡commerce-ui、后台、其他聊天26项dirty不变；只提交推送仓库及网页，不新打ZIP，不声称Mac或iPhone已更新。最终版本全量/核心聊天、提交与线上文件结果随后追加。

银行亲属卡v1825/v1828发布最终验收：版本更新后全量4355/4355通过、0失败，双端核心聊天实际回复/授权撤权/自动查看/重开持久化通过，双端亲属卡赠送/收拒/消费/充值/退款/独立资金/防重与320/390/430黑白主题同宽比例门禁通过，页错0。此前剧情工作室完整操作与头像布局/微信运动图标检查继续通过。只暂存当前工作区授权源码、缓存版本、定向QA和对应版本断言/维护文档；其他工作区26项dirty保留；无新增ZIP/原生/签名/后台。

2026-10-18 用户纠正微信运动仅换内部图标，不应去绿色底板：两端glass-theme.css移除wx-steps-icon的background:transparent/box-shadow:none覆盖，恢复原#07c160绿色圆角底板和原内高光，保留已确认绿白SVG，尺寸不变。双端实际wxsteps页面计算背景rgb(7,193,96)、内高光非none及SVG绿白填充/四眼核对通过。本次仅本地修正，未提交、未推送、未升版；此前v1825线上仍是未恢复底板版本。


## 2026-10-18 角色扮演、游戏大厅、世界书原图提前准备（本地候选）
用户要求消除进入页面后再等图片加载。核实7张图均已在两端本地assets中：幕布、游戏主图/图集/心动卡/骰子、世界书图集/睡猫，共约9MB；此前CSS仅在页面使用时请求，没有专用持久缓存。保留所有原图、原始透明度与选图SHA，不生成新素材/衍生副本，不以整屏加载遮罩或人工延迟伪装变快。
PAGE_ART_PRELOAD_V1：网页小手机.html及私人两个HTML在head声明7个相同原图URL，以内容SHA前12位作为art查询版本（幕布保留user-choice-4参数），CSS使用精确相同URL。普通启动低优先级提前请求，核心脚本/启动不等这些图；视觉预览支持，常规自动化black-home等隔离预览不批量下载。PAGE_ART_MEMORY_V1：主屏先渲染，再空闲时两路Image预热与decode，保留7个Image引用；同时进行的请求合并，失败不阻塞开机/导航，进入三页可补试。明确不是首次新安装/清空缓存后无需取图，首次仍需准备一次，操作系统也可能清理缓存/解码内存。
PAGE_ART_CACHE_V1：网页SW独立north-page-art-v1仅缓存这7张固定图，跨普通外壳版本更新保留；已命中直接返回，不每次联网校验。不把用户照片/聊天图或全站图片放入该缓存。缺失时限12秒请求，并校验PNG Content-Type、3MB上限和完整SHA256再写入，过期版本和坏图不冒充新图；成功写入后清理非当前7个键。缓存被禁用/满了仍正常请求图片，不阻塞应用。后台warm消息在worker已激活后执行，不让安装/激活等待9MB图片。私人仍用原本随包本地图和解码预热，不引入SW或修改原生桥/签名。
复用cache-integrity.test.mjs：原实现先在缺少head提前准备声明断言失败；补后核对三个HTML清单/CSS URL/原图哈希/两端字节一致，真实SHA校验缓存后模拟断网、新worker/外壳更新可复用，配额失败可回源、坏图不入库、未知版本不拿当前图、旧键有界清理通过。复用check_chat_authorized_phone.cjs的NORTH_PAGE_ART=1：双端实际HTML主屏尚未导航就7张已decode，网页真实worker已缓存7张；断网依次进入rphub/gameshub/worldbook正常，网页再实际fetch七图全部命中，页错0。私人是Windows下私人HTML本地图/内存准备验证，不冒充iPhone实测。固定eight-browser.log合并图片与核心门禁结果，复用三页原固定截图；定向6/6通过，永久门禁增加双端app标记及网页SW标记。最终全量/核心结果后续追加。
本轮保留上一轮未推送的微信运动绿底恢复。版本仍网页1825/私人1828，未提交/推送/打包，不改原生/后台/签名/唯一ZIP或其他工作区；未新建脚本、源码副本或图片文件。后续发布必须同步这三个HTML、两端app/CSS与网页SW，不能只推CSS漏掉准备机制。

三页图片提前准备最终验收：全量4358/4358通过、0失败；缓存/样式/helper定向6/6再次通过，包含完整SHA、跨worker外壳复用、离线、配额失败、坏图和有界旧键清理；双端实际HTML主屏先decode7图、断网三页显示、网页真实SW取7图通过，页错0。双端核心聊天实际回复/授权撤权/自动查看/重开持久化门禁也通过，结果合并在eight-browser.log。7张原图字节未变，无新增图片/代码副本或脚本；保留微信运动绿底恢复，仍本地未提交/未推送/未升版，未打包或iPhone新安装。

## 2026-10-18 角色今日日程与鲜红记仇本（本地候选）

SPY_ORGANIZER_STUDIO_V1：两端角色手机今日日程改为纯黑底、青绿完成环/时间线，分待完成和已完成；新增、编辑、删除确认与勾选复用S.spy[id].todo，保留同日刷新合并与次日生成逻辑。记仇本鲜红#ff2838，全部/未消气/已和好筛选与真实计数，复用c.grudges，支持新增/编辑/和好恢复/删除确认；完成状态/原时间不被编辑覆盖。配套弹窗按页面青绿或鲜红配色，离开页面清除作用域，账号/日期/记录变化后拒绝旧草稿覆盖。

满八条的角色自主说明、先显示落盘再入小黑屋链路未改；没有固定角色话术。roleschedule/grudgenotes仅northPreview隔离示例，不写入真实用户记录。QA复用scripts/check_chat_authorized_phone.cjs，NORTH_ROLE_ORGANIZER=1运行两端真实交互/320～430布局/重开持久化；NORTH_GRUDGE_JAIL=1验证真实发言交付顺序。截图在既有.codex_tmp/eight-chat/role-{todo,grudge}-private.png与*-editor.png、role-grudge-confirm.png。保留此前微信运动绿底与三页图片缓存候选，本轮不提交、不推送、不升版、不打包。

验收补充：全量4360/4360通过；双端NORTH_ROLE_ORGANIZER实际增改勾选/筛选/和好恢复/删除确认/空态/旧草稿拒绝/持久化与320/390/430布局检查通过，页错0；双端NORTH_GRUDGE_JAIL实际角色发言显示后再入小黑屋检查通过，核心聊天授权及重开持久化通过。原生/桥/旧包未改，本轮未提交推送打包。

## 2026-10-18 角色手机约会页（本地候选）

SPY_DATE_STUDIO_V1：两端角色手机约会页采用纯黑/亮粉设计、五天日期条/月日选择、正在约会/待确认/约会回忆真实计数，当前场次显示真实startedAt已见面时长（30秒更新），不伪造结束时间和完成百分比。页面刷新只重读现有数据，不额外调用模型生成或改写记录。

读取S.offline[id]正在进行场次、历史/重点/lastSession，同场多条重点按真实开始时间和地点归组，未知日期的旧字符串记忆继续可见；当前账号accountMessageKey下assistant dateinvite且未同意/拒绝的邀请才显示。邀请先回微信原卡，不从查手机页直接同意或跨账号搜索接受；原offlineStart/acceptDate/共同生活/结束总结流程未改。原未结束归档/总结切片也属于约会回忆，不能称为已完成场次。

卡片展开/全部记录/日期/邀约/重点编辑/重要度/删除确认/原记录管理共用本页粉色弹窗作用域，离开清除；编辑同步原offMemorySyncEdit，删除复用offMemoryRemoveAt以清理对应微信副本；旧字符串与账号/记录变化保护均保留。原记忆管理页的星级在本页进入自定义编辑窗，其他入口不变。约ta见面复用offlineInvite，不新增假的预约流程。

隔离预览northPreview=roledates包含进行中42分钟、未来待确认邀请和昨日回忆示例，不写真实记录。NORTH_ROLE_DATES=1复用既有scripts/check_chat_authorized_phone.cjs；双端日期/筛选/原邀请导航/重点改删与旧账号保护、重开保存、320/390/430不溢出初检通过。截图在既有.codex_tmp/eight-chat/role-date-private.png及role-date-{memory,editor,create,invitation}.png。最终回归结果以后续验收为准；仍不提交推送/升版/打包，保留微信运动绿底、7图缓存及日程/鲜红记仇候选。

约会页最终本地验收：全量4362/4362通过，双端NORTH_ROLE_DATES实际日期/筛选/邀请回微信/重点编辑重要度同步/删除微信副本/账号隔离/旧草稿/持久化/320～430布局检查通过，页错0。仅本地候选，未提交推送升版打包。

约会分类修正：按用户要求移除页面底部重复的待确认邀约区块；正在约会/待确认/回忆各分类只展示本类，全部记录窗口仍用于汇总。双端NORTH_ROLE_DATES实际交互通过并断言正在约会没有待确认卡片；截图与可见预览已刷新。本次小范围修正未重跑全量，前述4362为修正前全量，未推送。

## 2026-10-18 角色手机小事簿蓝色时间线（本地候选）

SPY_LIFE_STUDIO_V1：两端小事簿采用纯黑/蓝色总览、真实总数/今日新增/自动记录状态、原lifeNotesAutoToggle开关、搜索、分类计数、按日期倒序时间线与分页。默认展示4条，查看更多每次增8条；分类保留情绪/约定/偏好并为实际出现的其他标签提供可横滑筛选，不伪造标签或数量。记录来源沿用lifeNoteAuthorship，角色观察/用户手动补充/旧版来源不混写。

页面通过lifeNotesForRole过滤角色和memoryScopeKey账号，旧无归属记录仍按原规则兼容，原数组索引只用于定位；模型用途提示、角色自由判断、原话依据校验、承诺方向/真假、回复实际送达后入库机制不改。关闭自动记录不删内容；页面刷新仅读取已有记录，不调用模型虚构新记录。

添加/编辑/分类/菜单/删除确认均为本页蓝色弹窗，离开清除作用域。spyLifeNoteEditor(i)等原函数入口保留；新手动记录完整保留界面允许的220字，带当前roleId/accountId（不走原90字截断），不裁掉其他角色/账号旧记录。编辑保留id/时间/归属，明确标记manual；删除按确认时的记录对象重新定位，防并发新增使索引变化误删。草稿校验账号、作用域、角色对象、记录引用，旧账号或已替换记录不覆盖新状态。

northPreview=lifebook为隔离6条示例（含自动来源与手动来源），不污染真实数据。复用scripts/check_chat_authorized_phone.cjs的NORTH_ROLE_LIFE=1验证两端搜索/焦点/分类/分页/自动开关保留历史/真实增改删/220字完整/并发删除/来源与角色账号边界/重开持久化、320/390/430无横溢；25项既有小事簿/角色判断/页内编辑定向测试通过。截图固定在.codex_tmp/eight-chat/role-life-private.png、role-life-{editor,actions,confirm}.png。全量与核心授权聊天最终结果以后续补充为准；本轮仍不提交推送升版打包，保留此前全部本地候选。

小事簿最终本地验收：全量4364/4364、既有定向25/25、双端NORTH_ROLE_LIFE实际UI及普通授权聊天/填充记录/双输出模式/可见送达/忙碌释放/自动查手机/重开持久化检查通过，页错0。第一次与全量并行的核心脚本在私人水晶球globeQA单项失败，未修改该功能或放宽断言；全量完成后独立完整重跑两端通过（含globeQA）。根因尚未确认，不将并发争用说成已证实原因。复用既有预览和日志目录，仅保留本轮必要截图，无新源码副本/临时目录/交付包，其他工作区26项dirty原样；未提交推送升版打包。

## 2026-10-18 小事簿角色自动分类接通（修复此前仅页面有分类）

LIFE_NOTE_CATEGORY_V2：原lifeNoteConsumeModelTags只将kind==='约定'保存为promise，其余类型一律emotion，丢掉角色自行给出的真实类型。此前SPY_LIFE_STUDIO_V1只验证展示/手动编辑，不能作为自动分类接通的证据。本次修复自动写入，两端共用lifeNoteCategoryKey：喜好/偏好等合并为preference，承诺/约定为promise，习惯/纪念日/在意等保留独立分类，其他自定义类型原样保留，不兜底塞进情绪。recordedKind另存角色原始类型，tags用于当前标准分类；界面/筛选/编辑复用同一归一化逻辑，朋友恢复显示朋友，不再人为命名社交。

历史已经丢掉原类型的记录无法可靠恢复，保持内容/来源/时间/标签不动，可由本人手动更正分类；不凭关键词批量猜测，不覆盖旧档。自动记录开关、情侣/主号门槛、原话依据/事实校验、承诺方向和真假、去重以及实际正文送达后才写入保持。新分类不是绕过这些规则的通行证，不增加模型请求，不固定角色话术。

lifebook预览不再直接塞偏好/社交等标签，6条隔离例子由真实lifeNoteConsumeModelTags解析示例文本生成，去掉了此前人为追加的朋友/愿望样例，改用确实从解析链路产生的习惯/纪念日。示例仍是受控夹具，不代表在线模型刚刚生成了记录。

回归先行：tests/reply-output-experiment.test.mjs两端12项分类用例在旧代码上失败（均错误归入emotion），修复后26/26通过；含同义词、习惯、纪念日、承诺、自定义类型与不改旧档/承诺依据拒绝。新增永久标记。NORTH_LIFE_CLASSIFY=1复用原QA脚本，在两端各跑原文/普通模式的实际aiReply（只模拟模型HTTP，不替换buildSystem/myActivity），正文可见送达→标签隐藏→分类入库→小事簿筛选→重开持久化全部通过，含自定义类型不能伪造承诺。NORTH_ROLE_LIFE页面完整交互再次通过。分类链路截图.codex_tmp/eight-chat/role-life-auto-classify.png，主页/编辑仍复用role-life-*固定截图。全量/核心门禁最终结果以后续补充为准；仍未提交推送升版打包。

自动分类最终本地验收：全量4380/4380通过；两端×原文/普通模式的实际回复→正文送达→分类入库→页面筛选→重开持久化通过；小事簿完整UI及两端独立普通授权聊天/已有记录/自动查手机/可见送达/忙碌释放/存档恢复门禁通过，页错0。预览已刷新，无新源码副本/临时目录/交付包，旧目录只保留必要截图；其他工作区26dirty保持。HEAD27372d33/网页1825/私人1828未变，未提交推送打包。

## 2026-10-18 角色手机“监控我”金红页面（本地候选）

SPY_MONITOR_STUDIO_V1：两端纯黑/金色概览与使用条、红色被查/点赞卡，页面与展开弹窗同风格。真实显示今日已落盘被查次数/累计时长（概览取整分钟，详情精确秒）、当前保留的抖音/X点赞数；明确统计口径，点赞数不冒充今日新增。被查记录取S.spy[id].viewLog，卡片说明谁查看谁；新spyLogView记录accountId，界面和角色提示词按当前账号过滤，无账号老记录仅主号兼容。

旧页spyUsageSec读取S.me.appUsage、spyDouyinSec读取S.dy.liked，却把主体写成ta；新页明确写本人昵称，避免把本人记录冒充角色行为。App时长只读当日、已授权LOCKABLE应用，沿用timeLimit和bonus额度，不改原计时/管控/私人外部采集。过期日期显示无今日记录，不能用昨天的时长或把无今日记录伪造为一组0；无额度的条形只作相对时长展示，有额度按真实比例且不溢出。

新增X点赞视图，按当前acct与likes包含当前本人姓名筛选；抖音按当前账号及liked数组中未取消的记录筛选，不编造角色点赞。条目和查看全部按钮连接真实dyOpenWork/xtweet原内容。心形只是已点赞状态，不新增假的点赞操作。无记录显示空态。

“ta可查看的手机动态”沿用rolePhoneLocalRead当前账号快照，明确不宣称角色刚刚真正看过；刷新不调用模型、也不推进角色已读账本。d.watchedAccount绑定新快照，旧无账号快照仅主号兼容。删除只清除此处快照，确认时按原数组/记录再次校验账号、权限和对象，不删聊天/原点赞/使用数据。顶部刷新仅重读，不重新生成角色手机。所有直接展开/刷新/原文入口均检查情侣绑定、已授权和解锁。

NORTH_PHONE_MONITOR=1复用既有QA，双端真实页面/来源不变/主体与账号隔离/撤销授权/当日与过期时长/进度条边界/详情全部记录/抖音X原文导航/删除保留源数据/320～430无横溢/重开持久化通过。第一轮发现过期日期仍列出限额行并显示0，修为无当日数据空态后通过，未放宽断言。northPreview=phonemonitor为隔离示例，图片和原始素材未新增；截图在旧.codex_tmp/eight-chat/role-monitor-private.png和role-monitor-{history,confirm}.png。全量与核心聊天最终结果待补充，仍未提交推送升版打包，其他聊天及之前候选保留。

监控页最终本地验收：全量4382/4382通过；双端NORTH_PHONE_MONITOR实际页面/账号归属/授权范围/旧日期/原文导航/快照删除保留源数据/320～430/重开保存通过；独立普通授权聊天/已有记录/双模式/可见送达/忙碌释放/自动查手机/持久化门禁通过，页错0。核心脚本首次直接调用刷新未准备新要求的解锁状态，导致watched未生成，已在该段夹具显式准备并恢复原解锁状态后两端完整通过，未放宽生产入口校验或替换buildSystem/myActivity。复用原目录和必要截图，无新源码副本/临时目录/交付包；其他工作区26dirty未动。HEAD27372d33/网页1825/私人1828未变，未提交推送打包。

监控页被查记录交互修正：查看全部记录与标题箭头改为原卡片内展开/收起，默认3条，超过3条才显示入口；展开状态按账号和角色隔离，仅内存保存，不弹窗、不改原日志。双端实际页面展开4条/无弹窗/收起3条与既有监控权限、账号、来源保护检查通过，页错0；本轮未重跑全量，未提交推送打包。

监控页全部查看更多入口已统一为原卡片向下展开/收起：被查、动态、App、抖音与X点赞；仅超出默认条数才显示入口。箭头改16px SVG向下折线，展开后旋转向上，不用字符箭头。双端定向UI验证各区展开/收起、无弹窗、原内容导航和既有账号授权/源数据保护通过；页错0。本轮未重跑全量，未提交推送打包。

监控概览预览差异已核实：IAB手机容器比430px QA截图窄，四列标签换行；不是另一版本或真实数据差异。统一概览标签不换行和紧凑图标间距，实际IAB已刷新核实。phonemonitor均为隔离示例，非真机事实；当前预览截图复用role-monitor-private.png。未推送。

任务拍照上传入口（PHOTO_TASK_PICKER_V2，本地未推送）：旧pickProof创建未挂载DOM的临时file input。桌面旧版实际选图可成功，因此不能把它断言为用户iPhone本次唯一根因；已确认此兼容隐患，并修为上传窗口内固定挂载的file input，由用户同步点击打开、每次清值以支持重选同图，显示读取状态、成功预览并启用检查，失败明确提示。按窗口/任务原对象/角色/账号和异步读取序号校验，防止关闭/换任务/换号/慢读取覆盖新照片；检查中禁止换图，识图返回后再次复查原窗口和任务再送聊天、完成任务。原识图退回/不可用策略、奖惩及任务数量不变，头像上传等其他消费者未改，原生签名/桥未动。
复用NORTH_TASK_PHOTO=1双端真实页面与filechooser实际选文件：挂载、解码预览、重选同图、延迟读取换任务隔离、识图退回与通过、聊天照片送达通过；识图响应受控，非真实收费服务验证。NORTH_TASK_PHOTO_BASELINE=1仅服务端内存读取HEAD旧task-notes，不改工作区，旧版挂载断言失败，新版通过。旧门禁仅setProof绕过选图，现补上遗漏链路。永久守卫/双端helper定向884通过；核心门禁结果另补，未全量/未Mac编译/未iPhone实测/未提交推送打包。不新增脚本、目录或源码副本；必要截图复用旧目录task-photo-proof.png。

任务照片上传最终本地验收：两端真实选图/预览/同图重选/慢读取换任务隔离/识图退回与通过/照片发聊天通过；884项永久守卫与跨包helper通过；独立核心授权聊天/已存记录/双输出模式/送达/忙碌释放/自动查手机/保存重开与任务奖惩原路径两端完整通过，页错0。旧版基线挂载断言失败，桌面旧版本身能上传，手机故障根因仍属兼容推断，未宣称真机已恢复。未全量/未Mac构建/未iPhone验证/未提交推送打包；无新增临时目录/脚本/源码副本，仅原目录必要截图，其他工作区未动。

2026-10-18 用户授权“现在检查没有问题，全部推送”：发布当前工作区全部已完成候选，网页v1826／私人源码v1829。含微信运动恢复原绿色（只换已认可图标）、7张页面图片内存预热/原字节校验持久缓存、今日日程/鲜红记仇本与风格窗口、约会真实状态分组/邀请入口、小事簿界面和角色自动分类完整链路、监控页真实来源/账号授权/向下展开与窄屏排版、任务照片固定选择器及异步隔离。缓存版本、升级身份与入口同步；版本断言逆变换已核对仅更新版本身份，功能断言未删。此前未推送记录是当时状态，以本次最终提交与远端确认结果为准。原生iOS480/bridge42/签名和其他工作区26dirty保持，不生成新ZIP或安装包，不声称真机已更新。全量/最终核心与定向及线上状态另补。

发布前最终检查：全量4384/4384通过；核心聊天完整独立重跑通过；NORTH_PAGE_ART、NORTH_ROLE_ORGANIZER、NORTH_ROLE_DATES、NORTH_ROLE_LIFE、NORTH_LIFE_CLASSIFY、NORTH_PHONE_MONITOR、NORTH_TASK_PHOTO两端全部通过，页错0。首轮核心私人水晶球globeQA单项失败，记录保留于eight-browser.log；只补失败诊断，不改生产水晶球或放宽断言，随后两端完整独立重跑通过，根因未确认。版本额外涉及的测试逆变换核对均只有发布身份变更。网页1826/私人源码1829，本轮只推送当前工作区66个受控路径；原生480/桥42/其他工作区26dirty/旧包保持。未做Mac/iPhone构建验证，任务照片手机症状仍需新版实测。

## 角色本人日程到点报备（ROLE_OWNER_TODO_REPORT_V1，本地前端候选）
用户要求：查他手机→今日日程，给角色本人添加带时间的安排，到点由角色自然说要去做；退出App/锁屏仍发通知，话术不固定。新建/手动编辑保存的记录附id/source owner/accountId/reportRevision，支持11:00、11点、晚上11点半；空时间仅记事。旧自动生成及无法判定来源的历史项不猜测迁移，编辑保存后才登记。日期/时间按该手机日程页本地日期，与角色作息表时区区分。buildSystem加入当前角色/当前主号的明确本人安排；不把执行人写成玩家。前后台只走同一服务器事件通道，不另在前台生成一次；沿用既有后台消息授权/连接，不默开通知或主动开关。保存/改时/删除/完成后标记同步待办，成功才清pending，失败/离线回前台重试；所有资料同步串行，并在头像解码后复查账号/对象/目标，刷新最新日程和启用状态。私人通知notificationAvatarPreserve及头像失败保留旧照片行为完整保留。
后台automation_config.ownerTodo只收当前主号绑定角色的当天手动日程，带明确dueAt/expiresAt和版本key。到点而未过当天期限、未投递才生成；最多3轮生成尝试（每轮内部模型换线沿用既有规则），失败退避3分钟。付费前、返回后各查新资料，改删/完成/版本变动则旧生成作废；沿用唯一outbox key与原APNs通道，不伪造通知成功。到时生成本人第一人称报备，按人设和情境自选称呼/说法，冲突时自然说明；不把报备当完成。前台收到automation:ownerTodo版本key再次核对本地当前记录，只标reportedAt，不勾done，过期/删改的旧卡不落入新记录。后台每分钟调度，加模型时间，不能承诺秒级准点。
实际浏览QA复用NORTH_OWNER_TODO：真实新增/时间归一→后台资料→角色上下文→真实收件落聊→只报备不完成→收件去重→改时/删除同步与旧版本丢弃，两端通过、页错0；云RPC/模型/APNs边界受控，不是iPhone实测。候选函数/模型自由台词/outbox一次推送/APNs环境保护专项50通过。首轮全量4390中12项失败源于原单函数夹具未加载新依赖，已改为加载实际新增helper而非放宽生产guard，并新增头像解码中换账号不得同步的回归；该回归揭示私人分支因保留头像true参数没有接上新复查，已补齐且52项相关专项及两端UI通过，最终全量/核心结果后补。
部署边界：线上私人46与公开42函数均早于本地其他功能，禁止整份仓库部署。已通过已登录代码编辑器仅在内存读取各自线上源，不建源码副本；以6处最小补丁添加本功能，逆变换逐字还原各自原代码。私人候选SHA256 e14175c4c06773e73293efbe9e391d4e8b608ce27a4430c23e2bb0da7ecb78d3，公开候选94ab76944bcf2b4aa122230ff8c666e46d40e884c7af92906f8954b90cea733e；均已真实TS解析通过，部署及最终状态后补。客户端未提交推送/升版打包，原HEAD ae94dc52、网页1826/私人1829/原生480/桥42不变；QA里之前他处加入的--mute-audio保留且不归本轮所有。

2026-10-19 日程本人到点报备最终状态：全量4393/4393通过；独立核心授权聊天与NORTH_OWNER_TODO双端全流程通过，页错0。旧HEAD基线在真实新增登记断言失败，新版通过；云/模型/APNs边界受控，未真实收费生成或真机锁屏验收。public-north-runtime后台授权包装器保留原授权检查，仅透传原同步函数参数，防止精确时间同步队列嵌套；两端精确时间模式和私人头像保留专项通过。git diff --check通过。
已通过Supabase现有代码编辑器部署6处最小补丁：公开phone-role-push 42→43 ACTIVE，私人46→47 ACTIVE，verify_jwt均保持false；部署前各自原代码无并发变化，逆变换完整还原，部署后重新从编辑器读取与各自候选完整匹配（SHA见上）。_shared、原通知修复、模型路由、作息和既有自动动作保留；未整份覆盖仓库Edge源。截图.codex_tmp/eight-chat/role-todo-backend.png是后台部署证明，非真实日程消息或iPhone通知证明。
前端仍本地候选，未提交/推送/升版/打包，HEAD ae94dc52、网页1826/私人源码1829/原生480/桥42保持；已安装App尚无新同步字段，待后续发布并同步当天手动日程后才能用。后台每分钟调度加模型延迟；既有后台联系/通知授权和连接需有效，不承诺秒级或物理动作执行。任务便签、自动生成日程、原随机主动联系与用户权限不改；报备不自动勾完成。原有未归属--mute-audio及其他工作区保持。


2026-10-19 用户明确授权本次推送加打包：发布网页v1827/私人源码v1830；原生iOS480/bridge42及签名配置不变。复用scripts/package_private_v1533_ios438.py从提交树读取完整私人资源，与ae94dc52基线只允许本轮日程、版本和编译指南差异，并核对上次710ed6c8的v1821覆盖包完整manifest与CRC继承。旧包不覆盖，新增唯一v1830交付包及50MiB分卷属用户本次授权。46份测试文件逆变换确认只改版本身份，没有放宽功能断言；QA脚本未归属mute-audio行留在工作区、不入本次提交。新后台已部署私人47/公开43，ZIP不重复部署后台；不能把源码包或Windows测试当作Mac编译/手机安装证明。最终检查、提交、推送和ZIP结果另补。

发布前最终检查：网页v1827/私人v1830全量4393/4393、独立核心授权聊天和NORTH_OWNER_TODO双端完整流程均通过，页错0；46份仅版本测试逆变换与git diff --cached --check通过。保存后同步/角色本人上下文/可见报备/只报备不勾完成/去重/改删旧版本作废已验证，未真实模型收费或真机锁屏验收。

## 网页版不开梯子很慢（SW_KEEP_BIG_FILES_V1，sw.js）

原因：网页版放在 GitHub Pages，国内慢。以前每次更新版本，activate 把旧的 north-shell 缓存整个删掉，像素少女（约 89MB）、美团店铺数据（约 12MB，?v=BUILD）、图片和声音也跟着删，更新一次就要重新从 GitHub 下一遍。另外点「立即更新」和从桌面图标打开（带 north_update / open）会先去网络要页面，最多等 12 秒。

现在：STATIC_CACHE（north-static-v1）不随版本删除。staticKind 分三类：games/pixel-home/** （pixel，按去掉 session/retry 的完整地址存，素材带版本号所以命中就是对的，只有页面和脚本在后台再要一次）、assets/north-*-shop.js（data）、assets 下的图片和声音（media，旅行图和图标照旧走自己的缓存）。data/media 按路径存（不管 ?v=），存的时候记下版本 x-north-build，命中但版本不同就先给旧的、后台换新。像素少女网络真失败、也没存过时照旧报错，不拿小手机外壳顶替（老测试守着）。预先下载的大文件也存进这里，已是本版本的不再下。点「立即更新」：north_update 等于本版本时直接用装新版本时已核对存好的页面；从桌面打开（open/from）网络 3.5 秒没回就先用存好的。原来的「explicit 绕过旧外壳」那句保留（旧 Service Worker 还在时仍要去网络拿新页面）。默认美颜包按需加载，不进 sw（测试要求）。

验证（浏览器模拟）：先在线打开存好文件，再发一个新版本并让 /games/pixel-home/ 和 /assets/ 全部 503：旧代码 5 个文件全部打不开，新代码全部能用。页面请求每次延迟 10 秒时，点立即更新旧 10.2 秒 → 新 0.2 秒；从桌面打开旧 10.2 秒 → 新 3.7 秒。没解决的：第一次打开还是要能从 GitHub 下载；后台云端（Supabase）照旧直连国外。私人版东西都在 App 里，不受影响。核对到：2026-10-18。

微信运动图标（WX_STEPS_NEW_ICON_V1）：wxStepsAppIcon 改用 spyBankIcon('wechat')——查他手机银行页「登录微信转给自己」旁边那个新的微信图标（绿气泡 + 黑边白气泡），底色是她自己在色板里挑的 #7EE571（夜间、白色主题都一样），图标放大到 92%（glass-theme.css 两包）。聊天列表、微信运动页、角色功能里的入口都用它。第一次误改成给旧图标描边、又误改了银行页那个图标本身，都已撤回。

## 聊天记录长库读不到时不删（MSG_ARCHIVE_NO_WIPE_V1，两包 app.js）

聊天很多时（超过 2 万字），S.messages 存进 IndexedDB 的 `__messages`（长聊天库），核心存档里只留 `{__idb:'messages'}` 记号；开机 bootImages 读长库再合并。

2026-10-18 事故：私人 App 21:46 打开后读长库卡住，21:52 网页进程崩溃；21:57 重开又等了 189 秒，imgGetIDB 出错时返回 null，旧代码把「读不到」当成「没有聊天」。22:00 角色发来消息，persistWechatDrain 看聊天不到 2 万字就 deleteMessageArchive()，把整个长库删了，16:30 之后的 110 条只剩手机数据库空闲页里的残留。不是那次版本改动造成的（1830→1832 只改版本号和图标）。

现在：开机读长库多试 3 次；还读不出来（或读出来坏了）就 msgArchiveMarkLost()：记下 _msgArchiveLost，这期间 deleteMessageArchive / writeMessageArchive 都不动长库，_imgReplacer 保存时留着 `__idb:'messages'` 记号并带上这次的新消息（下次开机 bootImages 会合并），后台每 20 秒重读一次（最多 30 次），读到就 mergeBootMessages 合并回来、清掉标记、再正常保存。她亲自在恢复页确认恢复时（recoveryPersistStateNow / webRecoveryPersistState）清掉标记，按她选的那份写。

测试：tests/message-archive-no-wipe.test.mjs 用两包真实函数复现事故，旧代码在「长库被删」这一步失败。没解决的：长库为什么读了 3 分钟（IndexedDB 约 8.5GB，大部分是空闲页和图片）还没查清；真机上「读不到→重试读到」只在测试里验证过。核对到：2026-10-18。

找回方法（以后再出事可以照做，只读手机）：`xcrun devicectl device copy from --domain-type appDataContainer --domain-identifier com.qianyi.PhoneCompanionTest` 复制 `Library/WebKit/WebsiteData/Default/<来源>/<来源>/IndexedDB/<库>/IndexedDB.sqlite3`（大的那个），数据库没开自动整理（auto_vacuum=0），被删的长库还在空闲页里：按 4KB 页扫 UTF-16 的 `"role":"`，按每页前 4 字节的下一页编号串起来，再逐个解析消息对象；只取「历史完整快照」保存时间之后的消息，更早的散落旧消息多半是她以前自己删的，不要带回来。

恢复页「安全合并」（RECOVERY_MERGE_ALLOW_NEWER_V1，私人包）：App 开着时核心存档、安全快照每十几秒自动保存，合并重读候选时允许它们变成更新的版本（变旧或换了一份仍中止）；以前每次都报「这份物理候选刚有变化」，2026-10-18 她找回聊天时卡在这里。整份恢复仍严格核对。

## 微信表情仓库（STICKER_STORE_V1）与桌宠想你/亲亲/抱抱（DESK_PET_MISS_KISS_HUG_V1）

现在：微信 → 我 → 表情 = 表情仓库，代码在 wechat-me.js（两包同一份，替换了原来的“动态表情开发中”占位页）。首页是封面卡和表情包列表；点开一个包看全部（会动的直接动），两个按钮：「添加到我的表情」（进 S.me.stickers，聊天笑脸里就能发）和「添加给角色」（进 S.aiStickers，文件夹 id 为 ss-包id；选哪几个角色记在 S.stickerStore.roleAccess[文件夹]）。没被选中的角色即使“所有文件夹都能用”也不会发：wechat-me.js 包了一层 aiPickSticker，挑图前临时去掉这些文件夹。角色只按含义挑表情（[表情|含义] → 含义里包含就算），所以每张都要有像“捂脸偷笑”这样的含义。

内置包「桌宠小橘」20 个动态表情：assets/sticker-store/pet/pet-01..20.webp（两包各一份，私人包的 .gitignore 已放行 assets/sticker-store/），透明背景、240 宽、约 12 帧/秒循环。顺序和文字在 SS_PET（第15张原“早安”按她要求改成“哦”）。制作方法：在无界面浏览器里打开小手机、开启桌宠（大号、陶土橙），把桌宠往上挪给文字留位置，所有上层（包括 html，带 !important 的黑底）清成透明，加白描边和文字，用 __deskPet.doCmd 让它做动作，逐帧截图（omitBackground），再用 ffmpeg 的 libwebp_anim（yuva420p）压成动图。生气、晚安、想你、亲亲、抱抱另外叠了一层常驻像素特效（生气符号、zzz、思念泡泡、飞吻红唇、小爱心），因为桌宠自己的特效只在动作开始时冒两次。

导入：「导入表情包」一次多选（JPG/PNG/GIF/WebP，最多120张），GIF/WebP 不超过2MB 原样保留（动图还会动），其余压到 300 宽；文件名没意义时让识图服务给每张写不超过8个字的含义（两张一起问），可以手改；保存为 S.stickerStore.packs 里的一个包（图片按大图规则自动外存）。「怎么从微信存表情」页写了方法：微信不让别的 App 读表情，用电脑版微信右键另存为再传到手机。她不喜欢普通黄脸表情；iMessage 商店的表情是别人的作品，接不了；微软 3D 表情（MIT）做过挑选页，她说先不加。

桌宠新动作：CMDS 加了 想你（眯眼脸红+白色思念泡泡里一颗粉心，FX miss）、亲亲（眨眼+飞出像素红唇，FX kiss）、抱抱（“啊？”那样的圆眼睛，两只小短手同时上下晃 .hug/dpHug，冒爱心）；别名 想你了/好想你、么么哒/亲一个、求抱抱/抱一下。角色提示里的动作清单是 Object.keys(CMDS) 自动列的，加了就会用 [桌宠|抱抱]。

v1834/v1837 改动（她看手机后提的）：
- 「添加到我的表情」不再把图片抄进笑脸里的自定义表情，而是像小猫贴纸一样在表情面板顶上多一个标签（S.stickerStore.mine 记包 id）。标签画法在 task-notes.js 的 emojiPanel 包装里：wechat-me.js 提供 window.emojiPackTabs()，图标用不带字的 assets/sticker-store/pet/icon.png，网格去掉白底（tn-egrid-clear）。v1836 抄进去的副本第一次打开时自动挪回标签（mineMoved）。
- 仓库页面里表情和封面后面的白色圆角底去掉。小橘放大：按每张所有帧的可见范围裁掉空白再做成正方形（最小画面250像素，特效很高的几张略小），见会话脚本 tight_crop 的做法：ffmpeg alphaextract+bbox 取并集。
- 角色会按关键词发：stickerStorePrompt(c) 接在角色表情说明后（app.js 两包各一行 typeof 守卫），列出它能用的包和关键词（图上的字）；给角色的含义改成“关键词：含义”（旧条目在生成提示时自动升级）；aiPickSticker 包装先去掉标点（[表情|哼！] 也能对上）。角色要先在仓库里「添加给角色」才会有这些表情。
v1835/v1838：表情频率选“关闭”时，角色仍会被告知自己有哪些表情包，她点名要就发（STICKER_OFF_ON_REQUEST_V1，app.js 两包）；stickerStorePrompt 也列出小猫贴纸、自建文件夹和未分组表情的关键词。以前频率关闭会把整段表情说明拿掉，角色说“没有表情包”、改发照片。
v1836/v1839 导入动图（她说“只看见图片”）：WKWebView 自带的文件选择从相册取图时会把动图转成静止 JPEG。私人 App 加了原生选图器（NATIVE_IMAGE_PICKER_V1，PhoneNativeBridge.swift：media.pickImages / .read / .clear，经她同意改原生桥；PHPicker 要求原始格式 .current，GIF/WebP/PNG/JPEG 原样，HEIC 转 JPEG；不需要相册读取授权；先回张数和格式，再逐张用 callAsyncJavaScript 参数传图片；可选动作，contractVersion 仍为 42，网页遇到 unsupported_action 退回系统选择）。导入页两个按钮：「从相册选」（私人 App 走原生）和「从“文件”里选」（不限类型，苹果会给“选取文件”）；按后缀也认 gif/webp/png/jpg；GIF/WebP 2MB 以内、PNG 1MB 以内原样保留（PNG 保留透明），其余压缩；每张标“动图/静图”（只在导入页，不存进表情）。未验证：真机上从相册选动图（模拟器要邀请码进不去）。
v1837/v1840（她的要求）：导入时不再用识图，每张名字她自己写（框里提示“写这张的名字”，没写的存为“表情”，角色只能随机发）。自己的表情包可设封面：导入页点任意一张设为封面（默认第一张），或「用别的图当封面」另选；存为 pack.cover，用在仓库列表、详情页和表情面板标签图标；导入后「改名字和封面」可再改。包名就是表情包总名称，角色说明里写「包名」表情包和每张名字；改包名时同步角色表情库文件夹名。
验证：tests/sticker-store.test.mjs（两包同文件、20张都在且是带透明的动图、聊天能显示这个路径、桌宠三个动作）；两包真实页面走完：仓库首页、打开小橘、添加到我的表情20个、只给选中的角色、导入两张自动写含义且动图保留、聊天里发出去能显示；桌宠 [桌宠|抱抱] 执行且不外露、别名、提示里有新动作。未验证：iPhone 上的观感、真识图服务写出的含义质量。

## 发消息时旧消息闪一下（SEND_TOUCH_DEFER_V1，2026-10-20）

现在：发消息后，「通知服务器她刚聊过」（roleServerPushTouchActivity，要整理最近聊天，只对开了服务器推送的角色——她的情侣角色）不在发送那一刻做，等约 900ms（发送和滚动画完）再做，连发合并；App 进后台或关页面时立刻补发。
之前：CHAT_SEND_KEEP_HISTORY_V1 去掉了发送时的整页重画，但闪空还在；聊天背景图已排除（她换默认背景照样闪）。临时记录器 SEND_DIAG_V1 在手机上没写出文件，已删除；真正的证据来自手机自带运行诊断和电脑上载入她设置后的性能分析。
守住它：tests/send-touch-defer.test.mjs、permanent-fix-guard 的 SEND_TOUCH_DEFER_V1。

## 角色发真实照片：五条可选路线（IMG_ROUTES_V1）

现在：设置 → 图片与识别 → AI 真图，多了路线1到路线5，每条单独填名字、接口地址、Key、模型，点选哪条就默认用哪条。实现：S.settings.imgRoutes 存五条，S.settings.imgRoute 是选中的序号；imgBase/imgKey/imgModel 始终是选中路线的值，所以所有生图的地方（聊天发照片、朋友圈配图、形象工作室、你画我猜、婚礼游戏）都不用改。切换时 imgRouteUse 先把输入框里正在填的内容存回原路线，再换进新路线；点“保存”时 imgRouteSync 把当前三项写回选中的路线。第一次打开时路线1继承原来的设置。没有失败自动换线（她只要求“选哪条默认用哪条”）。
验证：两包真实设置页：五个路线按钮、路线1继承旧值、填路线2后来回切不丢、保存写回、genImage 实际用选中路线的地址/Key/模型（截住请求核对）。未验证：真实图片平台出图。

## 微信发送后保留历史消息（CHAT_SEND_KEEP_HISTORY_V1）

2026-10-20：发送瞬间旧聊天消失，上翻消息空白约一两秒，不发送时上翻正常。scheduleReply 在手动回复和角色忙碌等待两条分支调用 render，替换整个聊天 DOM；pushMsg 已经追加新消息，无需再重建。两端改为 replyGenerationRefresh，仅更新回复按钮状态；忙碌消息队列、自动回复定时器、手动等待及回调照旧，不清理历史或减少保留消息。

验证：tests/chat-composer-preservation.test.mjs 用真实两端入口与 sendText，200 条历史及情侣角色，检查原容器、输入框和所有旧消息节点保留、新消息只加一条。覆盖手动、忙碌、自动回复；旧代码在手动分支容器被替换断言失败。未验证 iPhone 实际绘制表现，本轮先不发布安装。

补充：sendText清空引用状态后显式quoteComposerRefresh(id)，不依赖整页重画收起引用栏；测试验证引用栏消失、发送消息保留引用原文，旧消息及输入框节点不变。无新函数或原生接口。

## 情侣空间 · 赴约窗台（COUPLE_WINDOWSILL_V1，私人版）

当前状态（私人v1846 / iOS495）：按要求暂时停用3D首页，打开情侣空间直接回到原页面。private-couple-windowsill.js入口提前返回，不包装原渲染、不注册事件或计时器、不显示窗台省电项；CoupleWindowsill.paused=true。场景和第三方源码保留，以下是暂停前的历史做法。重新启用前需先完成独立网页真机测试并与她商量。

现在：私人版打开情侣空间先看到 3D「赴约 · 窗台」（唐幡 TangfanOVO 的开源作品，AGPL-3.0，她说已征得作者同意；网页版不接，接之前要作者书面授权）。上游源码原样放在 native/private-small-phone/third_party/qiaosi-windowsill（固定在 309508f1，UPSTREAM.md 写出处），我们加的只有 smallphone/shell.js。scripts/build_couple_windowsill.mjs（需要临时装 esbuild@0.24.0 和 three@0.170.0）把 three.js + 场景打成普通脚本 windowsill.js、四件模型打成 models.js，输出到 PhoneWeb.bundle/couple-windowsill/（私人 .gitignore 已放行）；App 是本地文件，不能用模块脚本和 fetch，所以 shell.js 把场景读 ./models/*.gltf.json 的请求换成打包数据。shell.js 还：省电模式（saver=1：像素密度 1、最多 30 帧）、左上角「返回」（postMessage windowsill:back）、去掉「草稿 · 演示数据」、打不开 WebGL 时通知退回旧情侣空间。
private-couple-windowsill.js（只在私人版两个入口加载）：包装 renderCouple 和 render。首页（cur().p==='couple' 且无 list）在 .screen 里挂一个 iframe（z-index 150，在弹窗 200、提示 500、远程操控 550、来电和横幅之下），不跟着小手机重画；离开或 App 进后台就拆掉省电。右上「设置与授权」下面的小玻璃条列出正在锁着的软件和「还剩…自动解锁」（ROLE_LOCK_UNTIL_V1 要求情侣空间能看到解锁时间，核心检查会查；第一次发布前就是因为窗台盖住了这行，核心检查失败后补上的）。「设置与授权」= go('couple',{list:1})，就是原来完整的情侣空间（甜蜜日常、管控授权、伴生设备），最上面多一个窗台省电开关（S.settings.windowsillSaver）。角色远程操控用自己的模拟层，不受窗台影响。
v1842（她第一次在手机上试后的要求）：
- 闪白屏：上游底色是浅米白（--bg:#e6e3dd），画面清空、调整大小、或 iOS 内存紧张回收 WebGL 时露出来；shell.js 把底色改成 #0d0b0a，webglcontextlost 时通知外面重载（最多两次，再不行退回旧情侣空间）。桌宠和图片偶尔变黑推断同因（回收后贴图没重传），重载能恢复；电脑上复现不了，未真机确认。
- 画质：上游「跑不动就降一档」门槛是每秒 34 帧，省电模式限 30 帧必然触发；打包时把它和清晰度上限换成 shell.js 的值（正常上限 2、低于 22 帧才降；省电 1.25、低于 16 帧）。
- 淡入不能等动画帧（隐藏的框不画帧，会死等），改成 load 后 400ms 计时；加载时盖「正在摆好书桌…」。
- 窗台框让出状态栏和底部横条（框里的页面拿不到 safe-area，按钮会和时间叠）。
- 右上「设置与授权」按钮和锁定条都去掉（她要求）；入口改成桌上的手机：点一下翻过来亮起她的锁屏（锁屏壁纸 S.me.lockBg||homeBg、日期、时间，画在上游手机屏幕贴图上，打包时开口 window.__WS_PHONE_SCREEN），屏幕亮着再点一下（打包时开口 window.__WS_PHONE_ENTER）或卡片「进入小手机」= go('couple',{list:1})。
- 返回只是一个小箭头；凑近东西时让位给上游「退回」。
- 核心检查里锁定解锁时间那项改到 go('couple',{list:1}) 读（解锁时间现在在「设置与授权」里，内容和判断不变）。
- 以后加任何气泡、卡片、按钮都要跟上游液态玻璃一致（她要求），照上游仓库的做法。
v1843（她第二次试后的要求）：
- 别处糊、手机刚点开糊一两秒：上游景深虚化很重，打包时乘 window.__WS_DOF（0.45）；降档后清晰度至少 1.5（__WS_LOWQ_PR，省电 1）；凑近手机时镜头推到六成就切清楚，不等停稳。
- 一起听：电脑屏幕放的是小手机「音乐」里真正在放的歌。外层每秒报一次（windowsill:np：歌名、歌手、进度、是否在放；换歌时带一次带时间的歌词），窗台调 fuyue.setNowPlaying。卡片上一首 / 播放暂停 / 下一首（#sp-mc，样式照上游 .go 那一行：无底色、细线、同样的字影，玻璃由场景画）发 windowsill:music，外层直接调 musicPrev / musicToggle / musicNext；离开窗台歌接着放。卡片「打开小手机里的音乐」走 openApp('music')（会被锁的 App 照样受锁）。
- 小橘：20 个小橘动态表情由 scripts/build_couple_windowsill_pet.cjs 在浏览器里拆帧（ImageDecoder 要在 https 页面里才有），每个最多 10 帧、160 像素，拼成一张图写进 couple-windowsill/pet.js（数据地址：App 读本地文件会让 WebGL 贴图出安全错误）。打包时在上游桌宠 tick / next 开口 window.__WS_PET；没加载好时仍是上游颜文字。外层每两秒报桌宠的指令（角色或她让它做的表情）、是否睡着、名字（windowsill:pet）；优先级：指令 > 她点卡片换的（20 秒）> 睡觉 > 放歌时戴耳机 > 场景（凑近信害羞、看书星星眼）> 难过 > 每 30 秒在开心 / 挥手 / 眨眼 / 伸懒腰里换。
- 窗台上那张透卡（上游 key 'pet'）她觉得多余，去掉：打包时在建 BYKEY 之前从 TAGS 删掉 pet、把透卡和它投在窗台上的彩色影子移出场景（window.__WS_NO_SILL_PET）。小橘只在桌上的流麻牌里。小手机里到处走的桌宠不动（她说的不是它）。
v1845：v1844 在她手机上更模糊、也更卡（当时手机本来就有点烫，没开低电量模式），她要求退回 v1843（iOS492）的画质做法，窗台代码原样取回 v1843 的。下面 v1844 那段只作记录，现在不生效。没有手机上的真实帧数之前不要再改画质；下次先做只在开关打开时显示的帧数小字，请她在手机凉的时候截图，商量后再定。

v1844（她在 iPhone 15 上试 v1843：画质和电脑上不一样、动起来明显变慢、有时闪屏）——这是画质第三轮，换思路：
- 慢的原因是 v1842 我把清晰度上限从作者的 1.6 提到 2、降档门槛从每秒 34 帧降到 22：iPhone 15 屏幕是 3 倍，硬撑在二十几帧。改回作者的 1.6 和 34（省电仍 1.25 / 16），降档后 1.25。看着清楚靠少虚化（景深 0.45），不靠加像素。**不要再把上限往上提。**
- 闪屏的原因：每次切清晰度（凑近手机提清晰、退出来降回、自动降档）整张画面重建，手机上会闪一下。现在看的过程中不切（window.__WS_NO_CRISP）；自动降档只在第一次测速时发生，加载层等测速做完（window.__WS_TIER_SET，最多 6.5 秒）才揭开，所以降档藏在加载层后面。代价：打开窗台多等约 2 秒。
- 电脑上的画面一直比手机清楚、顺：Mac 显卡强，手机多半会降档。电脑预览不能代表手机的流畅度。
窗台手机测速（2026-10-20，她同意的做法：单独的测试网页，不进小手机、不进 App）：
- scripts/windowsill_phone_test/：index.html 测试页（自动测速九段约 3～4 分钟：App 设置、清晰度 2/1.6/1.25/1、1.6 下分别关阴影细节/景深/玻璃、再测一次 App 设置看发热；自己试看各画质，顶上显示帧数，窗台小箭头返回）、serve.mjs 局域网小网站（端口 8790，收结果存 results/ 并打印）、test-overrides.js（按地址参数改画质）。
- 测试版窗台：node scripts/build_couple_windowsill.mjs --tools <工具> --test-out scripts/windowsill_phone_test/build，只写测试文件夹（不准写进 native/），额外开口 window.__WS_DEV 并加载 test-overrides.js；App 里那份不变。build/、results/ 不提交。
- 电脑上整套跑过一遍：九段都 60 帧（电脑显卡强，比较要看手机）。
- 第一轮手机结果（她的 iPhone 15，iOS 18.7，在充电）：各种清晰度都只有 10～19 帧，清晰度 1 也只有 16 帧，所以慢不在清晰度；关影子细节（gtao）最好也只 19 帧。「一起听」凑近时她明显觉得卡、「共读」很顺。她要求：充电时也要顺。
- 第二轮测试页：分全景/共读/一起听记帧数，并记每帧程序用时和画的次数（renderer.info，autoReset 关掉手动清零）；新试法：影子只画一次（shadowMap.autoUpdate=false）、去影子细节、去景深、电脑屏幕少刷新（测试版开口 __WS_NP_FOCUS_DT/__WS_NP_DT，地址 npfps）。
- 电脑上第二轮：平常每张画面要画约 5555 次，其中影子每帧重画占了约 5000 次；影子只画一次后约 580 次，程序用时 13ms→4ms。这是手机慢的最大嫌疑，等她手机结果确认。
- 手机第二、三轮（iPhone 15，在充电）：「影子只画一次＋去影子细节＋去景深」最好（全景、共读约 30 帧，App 现设置约 23），她也觉得这个最顺。从共读回来以后所有步骤一起慢 2～3 倍（画的次数不变），像是手机没人碰十来秒后自己降速；真用时有触摸，应比测试好。小橘每帧要 2～4ms（表情每秒换几次、每次重贴整张卡），可以减。iPhone 15 上这个场景到不了 60，目标是稳定 30。
- 测试页「自己试看」加了三种推荐做法（1.6、2、稳定每秒 30 张，地址参数 cap=30）；手动帧数改成数 composer.render 的次数（限 30 张时别的帧回调会被挤掉，旧数法不准）。
现在（v1850，WINDOWSILL_STEADY30_V1，2026-10-20）：窗台重新启用，用她在手机测速网页上选定的「新方案，清晰度 1.6，稳定 30 张」——开关都在 smallphone/shell.js（__WS_SHADOW_FREEZE、__WS_NO_AO、__WS_NO_DOF、__WS_PCF、__WS_NO_CANDLE_SHADOW、__WS_FAKE_AREA，清晰度 1.6/省电 1.25，降档门槛 14 帧），打包脚本把它们接进上游。改画质先在测速网页上量，别回到在电脑上猜（上面 v1842～v1844 的失败）。
- 注意：shell.js 比 pet.js 先加载，帧图要等 DOMContentLoaded 再读。

后续步骤（未做）：点桌上东西打开对应功能（对照表见聊天：手机=进入真实小手机，电脑=一起听，书=共读，挂历=纪念日，便签=报备，蜡烛=睡眠，茶=健康，千纸鹤=我在哪，透卡/流麻牌=桌宠小橘，风铃=朋友圈，信=信箱，木盒=游戏大厅，手帐=出门，星星罐=表情仓库，盆景=作者致谢），接真实数据，桌宠换小橘；以后可加开关做成整个 App 首页。
验证：tests/couple-windowsill.test.mjs；电脑上私人页面：窗台离线显示（无联网请求、无报错）、设置与授权保留原内容、返回离开并拆掉、远程操控层和弹窗盖在窗台上、网页版情侣空间不变。未验证：iPhone 上速度、发热、WebGL 表现。


## 网页版形象工作室缺失参考图循环（WEB_STUDIO_MISSING_REF_NO_LOOP_V1）

2026-10-20：个人资料入口在空白账号正常；已保存的身份/衣物参考为idb引用且图片读不到时，roleImageStudioWarm每次读取结束都render，重新安排Warm而无限循环。网页版改为仅确实回填了至少一张图片缓存且仍是原账号本人/角色工作室时重画；读不到时保留引用及页面，不删除记录。私人包不改。

回归在tests/role-image-studio.test.mjs：真实个人资料按钮、已有缺失身份参考，输入草稿后等待检查DOM和草稿保留；旧实现失败。另验正常读图仍刷新、账号切换后不刷新旧界面。仅修复已复现缺陷，不能断言已核实用户实际网页就是此原因。
