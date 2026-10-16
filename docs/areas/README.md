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


## 情侣空间锁定到点自动解锁

现在：角色锁 App（小手机内置 App 与伴生的真实 iPhone App）必须带解锁时间：[锁定|App名|到07:00]、[锁定|App名|3天]、2小时、30分钟、明晚10点；标签没写时间时依次：lockUntilFromText 从角色这条回复的可见话里找（锁到…/锁你N天/N小时后再给你开/明天中午再给你开，支持中文数字，内心块不算），再 lockUntilAsk 后台问角色一句（不进聊天，roleInterceptStage「锁定解锁时间」，账号或绑定变化则作废，只覆盖仍是默认值的记录），都失败才用下一个至少一小时后的 07:00；最长7天。无上下午词的「N点」取更近的上午或晚上（晚7点说「到十一点」是23点），补零写法 07:00 仍是早上。教角色的四处锁定说明都写了这条。applyControlTags 在执行任何锁定标签前用 lockUntilPrepare 取出时间段并还原标签，原锁定代码不变；执行完 lockUntilCommit 按前后快照只给新锁上（或已有时间的再次锁定）的目标记 S.couple.lockUntil（'int:'+内置键 / 'ext:'+外置ID），外置同时发 device.autoUnlock 给原生。lockUntilSweep 每30秒和回前台检查：到点内置删锁、外置发角色解锁命令；目标已被提前解锁就删记录。情侣空间「管控授权」页「ta锁住的」和打开被锁 App 的提示显示「还剩…·几月几日 HH:MM 自动解锁」。自动限额锁（auto）不受影响。

原生：CompanionSyncService.scheduleAutoUnlock 把 externalID→解锁秒数和 token 存进 App Group（companion.lock.autoUnlock.v1 / .token.），启动一次性 DeviceActivity「autoUnlock.*」（至少15分钟）。PhoneCompanionMonitor 在该活动 intervalDidEnd 时把 token 从默认屏蔽库和 persistentLockLedger 库及账本移除，记录保留；主 App 在 effectiveLockedTokens 开头 applyDueAutoUnlocks，先把到点条目从 UserDefaults 保存的锁定名单和账本删掉，避免重新补锁。提前解锁（unlock 命令）会 forgetAutoUnlock。屏蔽页只在有未到点的解锁时间时显示一行浅白剩余时间（每次显示屏蔽页时计算，不是实时跳动）。

踩坑：主 App 会用保存的锁定名单（UserDefaults.standard，扩展读不到）把屏蔽补回去，只靠扩展清屏蔽会被重新锁上，所以必须在补锁前清名单。Monitor 原本任何活动开始/结束都清每日限额，新活动必须按前缀跳过。旧测试只抽取 applyControlTags 片段运行，接入点要用 typeof 守卫。旧屏蔽页灰色解释小字（v1113 移除）不能加回，只允许剩余时间一行。升版本号脚本只能改版本号上下文，16进制哈希里可能含有版本号数字（v1777 发布时误改过一次测试里的图片哈希，已撤回）。

验证：tests/role-lock-until.test.mjs（时间解析、默认7点、7天上限、标签还原、双端说明与接入点、原生源码）；核心聊天门禁 roleLockUntil 用真实 applyControlTags 锁「附近的人」2小时、管控授权页显示、到点自动解开、无时间默认7点（旧实现失败已验证）。未真机验证：超过一天的一次性 DeviceActivity 能否按时触发、App 关闭时屏蔽是否真的解开、屏蔽页文字。核对到：2026-10-16（v1779/iOS458）。

## 聊天搜索与网页功能继承核对

角色私聊与角色群的关键词搜索使用 wxSearchChats 按会话分组，wxSearchOpen 展开匹配项；wxSearchJump 设置一次性 _chatJump，扩大旧消息渲染窗口，restoreRenderScroll 消费定位并阻止置底覆盖。返回搜索页保留关键词与列表位置。gsearchRows/gsearchResultHTML 负责群内分类结果的点击定位；私人两个 HTML 入口必须包含 .wxs-page、明暗主题及 msgJumpHit 样式。

已审查并同步的共享行为：聊天翻译批量排队及限流退避；groupReplyPlan 的角色条数覆盖与 aiGroupReplyRun 每轮总预算；手动总结的 summaryPerspectiveIssue；登录角色微信 hisMsgKey/hisCollapseRepeats 防重复；他人群气泡透明边框；私人 CSS 加载失败自动重试定义。

审计不能只比较脚本文件名或打包完整性：旧 v1767 的文件齐全，但 app.js 里仍是旧功能。v1738、v1742 的行为回归现在必须同时跑网页和私人源码，已有旧实现19项失败证据。private-web-feature-parity 对上述关键函数比较实际代码；永久门禁双端守住函数标记。真实 HTML 搜索检查需覆盖超过默认窗口的旧消息、关键词与群命中、返回结果及浅色样式。

刻意保留的差异：私人原生时长/管控/共享屏幕和 HomeKit；角色收件窄入口、后台任务、真人好友分段减负、文件备份与安全恢复合并；私人诊断扩展独立实现。网页 web-hotfix、网页云端额度/停用入口和 webRecovery* 不照抄进私人包。delivery.js 的私人肯德基上下文补判比网页多，保留；phone-shortcuts.js 两端保留各自已有入口并共享查岗追加模块。公共策略脚本和原生桥不为消除差异而覆盖。核对到2026-10-16。
