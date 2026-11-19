# 小手机 Gmail 连接后端

复用现有 Cloudflare 账号和套餐包含额度，独立 Worker + 一个 KV。把获得授权的 Gmail 查询、会话读取、标签读取、草稿及明确授权的发送请求转给 Google 正式 Gmail REST API，不开放删除工具。其他应用和既有授权、语音服务分别维护。

## 授权和存储

使用 Cloudflare 官方 @cloudflare/workers-oauth-provider 1.2.4 处理 MCP 客户端 PKCE、逐客户端同意、浏览器绑定、单次上游回执和加密令牌。Google 上游也使用 PKCE；客户端只收到本服务的独立 opaque token。Google 应用密钥与上游刷新令牌不交给网页，不写 Git、日志或聊天。

ALLOWED_EMAILS 必须非空，Google 验证后的邮箱必须在列表内。读取与草稿分别检查 mcp:read、mcp:write。拒绝同意不发工具请求。Google 撤销会撤销对应 MCP grant；临时失败保留可恢复状态，不重试已提交的操作。

Google 正式 API：https://developers.google.com/workspace/gmail/api/reference/rest

库的上游授权说明：https://github.com/cloudflare/workers-oauth-provider/blob/main/docs/upstream-sign-in.md

## 配置

wrangler.toml 只包含公开服务 URL、KV 标识、10ms 单请求 CPU 上限和关闭的观测日志。以下值通过 Worker Secrets 配置，禁止写入本文件：

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- ALLOWED_EMAILS
- SETUP_KEY：仅供兼容旧客户端时临时注册，正常小手机连接无需配置。

在 Google Cloud 的同一专用项目启用 Gmail API；现已不再依赖 Gmail MCP API 的开发者预览资格。OAuth 同意屏幕给自己的账号添加测试用户，申请 openid、email、gmail.readonly；需要草稿时再申请 gmail.compose。OAuth Web 客户端选择「用于 AI 代理」，唯一 Google 回调为 PUBLIC_URL 加 /oauth/google/callback。服务条款、创建凭据和最终邮箱授权须由本人确认。

正常连接采用官方库支持的公开客户端描述（CIMD）：MCP 客户端 ID 固定为 PUBLIC_URL 加 /client-metadata.json，唯一回调为 /client-callback。描述文档没有密钥；PKCE 与 Google 账号校验继续生效。动态注册默认关闭，不需要把管理密钥交给网页。旧客户端确有需要时，管理者可临时设置 SETUP_KEY，在 /register 注册 none 公共客户端后删除此密钥。

小手机连接设置：

- 地址为 PUBLIC_URL 加 /mcp，授权方式 OAuth。
- 选择「使用此服务自己的回执页」，MCP 客户端 ID 填 PUBLIC_URL 加 /client-metadata.json。
- 授权范围：只读用 mcp:read offline_access；读信加草稿用 mcp:read mcp:write offline_access。
- 从小手机发起 Google 登录，把服务回执页完整链接粘贴回小手机，再验证真实工具目录。
- 角色权限在小手机内单独勾选，默认不会授权给全部角色。

/health 只显示配置是否齐全，不显示邮箱、凭据或原始错误。配置齐全不等于实际 Google 授权和工具调用已经通过。

授权错误只显示固定阶段：GMAIL_CLIENT_CONFIG 为 Google 拒绝应用凭据，GMAIL_CODE_REJECTED 为授权码未被接受，GMAIL_TOKEN_UNAVAILABLE 为换取凭据暂未完成，GMAIL_AUTH_TRANSACTION 为浏览器授权事务未完成。绝不输出 Google 原始错误描述、授权码或密钥。测试状态必须把本人加入测试用户名单；未经公开验证提示与测试人员无权限是不同阶段。Google 外部测试应用的 Gmail 刷新令牌会在7天到期，之后需要重新授权，见 https://developers.google.com/identity/protocols/oauth2#expiration 。正式 API 路径不要求 MCP 开发者预览资格；本地工具目录不证明真实邮箱已可用，必须核验实际 API 只读结果。

## 检查与部署

在此目录执行 npm ci --ignore-scripts、npm test。测试包含实际 workerd + 官方 OAuth 库；Google 网络由本地模拟服务代替，不请求真实邮箱或收费模型。部署兼容日期与测试读取同一配置。Workers 不支持 redirect: error，这里使用 manual 并拒绝跳转，保持不转发凭据的约束。

浏览器还须验证真实表单的跨站跳转。Chromium 会把 form-action 检查应用到 302 目标；只写 self 会拦住 Google，随后重复提交则因一次性事务已消费而失败。仅授权页额外允许固定 https://accounts.google.com，回执和错误页仍只允许 self。复用根目录 tests/fish-mcp-v1756.test.mjs 的 browser consent 回归，通过 scripts/run_tests_mac.sh 运行；Google 测试请求在 Chromium 层阻断，只观察跳转意图，陌生目标仍必须由 CSP 拦截。FIX_TEST_OLD=1 对照旧实现必须失败。

先执行 Wrangler 的 deploy --dry-run。仅从已提交的本服务源码部署，核对服务目录无未提交差异；小手机其他未提交候选的发布状态单独记录。实际部署后只读核验服务地址、CPU 上限与 KV 绑定，Google 登录和工具目录在本人完成授权后核验。

Workers 用量与账号内其他项目共享，套餐内额度有限。不得为此升级套餐或新开订阅；现有包含额度不够时先停下说明，不自动购买。

2026-11-19 正式 API 迁移：本人明确选择保留同账号、同网关和现有 OAuth 权限。五工具名继续使用 list_labels、search_threads、get_thread、list_drafts、create_draft；查询/草稿默认只列标识或摘要，显式 view 才读取更多元数据/正文。支持 Unicode、MIME 附件与绑定真实原邮件的回复草稿；不申请签名设置权限，签名写在正文。固定 users/me 路径，拒绝注入式 ID/头部、未知字段、发送/删除和无 ID 写通知。草稿仅 POST 一次，不自动重试；模糊回执交由既有托管防重放。现代请求 CORS 允许方法/名称头。23项含真实 workerd OAuth/PKCE/刷新和受控 REST 回归通过；未创建真实草稿，线上只读验收另记。锁文件15个可选平台包缺少版本，原 npm ci 失败；补齐元数据后原有已解析版本全部保留，安装及实际运行时测试成功。

2026-11-19 MCP_GMAIL_SEND_V1：本人要求角色直接发测试邮件到指定邮箱，不再创建草稿。原网关只有查询/草稿而无发送工具，是角色无法发信的确定缺口。新增send_email，沿用已授权gmail.compose和mcp:write，to/subject/body必填，限制1至10个普通邮箱，固定messages/send一次POST；禁止头部注入、未知字段及自动重试，不开放删除。Google接受发送不代表收件人已收到。两项旧实现失败，25项服务测试通过。实际C调用/确认/发送及投递仍待验。工具说明重复读取已复现但代码根因未证实，未放松循环保护。网页代发不算角色测试通过。已有三个维护DOCX XML不可解析，当前在对应TXT保留记录，原件保留待无损处理。

2026-11-19 发信链路继续核验：全量5481/5481通过，MCP/永久保护1393通过，Gmail服务25通过。提交3deba734已部署现有Worker，版本85688e66-08c1-494f-af27-3838ed504588，原KV与10ms配置不变。发现客户端仍缓存旧Google预览目录：草稿schema约4001字节、搜索约7399字节。正式API迁移后未刷新目录，标签读取成功不能证明写操作签名一致。现已通过验证连接刷新，云修订5保存6个正式工具，草稿schema610字节，发送259字节；仍connected及ask，先生和C原授权保留。同账号手机应拉取该云修订，不重建登录。旧网页邮件地址核对正确，发件箱有记录且当时未发现退信，不代表收件人已收到。Mac在进入C实际发送前锁屏，已请本人解锁；C尚未发送，不能称测试通过，iPhone仍585，未推送网页。八个本轮可重建测试/Worker缓存文件已按明确路径清理，用户备份与恢复证据保留。


## Spotify 公开搜歌（2026-11-19）

MCP_SPOTIFY_PUBLIC_SEARCH_V1：本人优先个人账号；现有 Free 登录不满足自建开发应用拥有者 Premium 要求，因此按本人已批准的退路接入公开曲库。保留个人 Spotify 浏览器登录，不购买会员，不声称已连接个人歌单。独立 `/spotify/mcp` 使用独立 `SPOTIFY_CATALOG_TOKEN_SHA256` Worker Secret（仅保存随机 Bearer 的 SHA-256 摘要，原文仅在小手机安全存储）；该凭据不能用于 Gmail。设置连接名称为“Spotify 公开曲库（仅搜歌）”，地址 PUBLIC_URL + /spotify/mcp，Bearer 授权，只勾选 C、执行前确认。

唯一工具 spotify_search：只搜索公开 track 元数据，不开放播放、收藏、歌单、共享目录或 Pipeworx 的其他工具。固定上游 https://gateway.pipeworx.io/v1/tools/spotify_search （上游项目 https://github.com/pipeworx-io/mcp-spotify）。不转发客户端 Authorization、Cookie、会话、角色提示词或聊天全文；只发本次获批的 query/market/limit/offset。初始化声明与任意上游指令不传给角色；结果仅取歌曲/歌手/专辑名、时长、校验后的官方曲目ID链接。每次最多10项、25秒共用超时，单次JSON响应限1MB；失败不自动重试。上游目前匿名额度有限，不保证长期免费或可用，额度不足时如实失败，不自动订阅。原 Gmail OAuth、KV、CPU和套餐不改。

新增服务直接回归旧实现失败，涵盖认证隔离、参数拒绝、固定Host、不转发凭据、结果来源、重定向/错ID/失败不重放；实际 workerd 覆盖独立路由、Origin/CORS、Gmail令牌边界。角色实际验收另记，不以HTTP直测冒充。

线上排查补充：小手机native目录验证成功，C已显示并批准spotify_search，但实际调用未获有效回执；直接网关同查询502，故尚不算角色搜歌通过。新增error.data仅报告固定stage与上游HTTP状态，不含上游原文、查询、凭据或异常堆栈，客户端仍显示原简短错误。原始Bearer仅在小手机安全存储；本轮诊断以RSA-OAEP密封移交到临时进程内使用，不写文件或打印。

公开HTTP迁移：脱敏诊断读回search-request/401，说明原MCP目录可读不等于匿名工具可调用。上游README明确提供 POST /v1/tools/spotify_search；直接公开HTTP真实返回Adele Hello，1.5秒。改为只发一次固定HTTP查询，不再对上游做MCP握手/通知，不读取其目录或instructions；小手机对外MCP协议、连接凭据、ask与角色权限不变。原实现模拟MCP401/HTTP200场景返回502，新30项测试通过；线上角色结果仍待验。

当前实测：a176c112已部署63bc65b5-80ee-43f4-8161-bdb57262bf3c；同查询服务器端HTTP429，而本机直连公开端200。匿名额度按IP，不能保证服务器稳定查询。停止继续修改匿名链路，改为准备注册官方免费账号的独立额度，需本人同意新账号条款及GitHub基本资料传输；未注册、未授权仓库/Spotify私有数据，未订阅/充值。C在588已出现真实spotify_search参数确认，批准后仅一次外部请求、失败未重试；无真实曲目返回，所以不算角色搜歌通过。原个人Spotify Free登录保留。
