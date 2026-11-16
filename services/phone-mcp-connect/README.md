# 小手机 Gmail 连接后端

复用现有 Cloudflare 账号和套餐包含额度，独立 Worker + 一个 KV。仅把获得授权的 Gmail 查询、会话读取、标签读取及草稿请求转给 Google 官方 Gmail MCP，不开放发送、删除工具。其他应用和既有授权、语音服务分别维护。

## 授权和存储

使用 Cloudflare 官方 @cloudflare/workers-oauth-provider 1.2.4 处理 MCP 客户端 PKCE、逐客户端同意、浏览器绑定、单次上游回执和加密令牌。Google 上游也使用 PKCE；客户端只收到本服务的独立 opaque token。Google 应用密钥与上游刷新令牌不交给网页，不写 Git、日志或聊天。

ALLOWED_EMAILS 必须非空，Google 验证后的邮箱必须在列表内。读取与草稿分别检查 mcp:read、mcp:write。拒绝同意不发工具请求。Google 撤销会撤销对应 MCP grant；临时失败保留可恢复状态，不重试已提交的操作。

Google 官方 MCP：https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server

库的上游授权说明：https://github.com/cloudflare/workers-oauth-provider/blob/main/docs/upstream-sign-in.md

## 配置

wrangler.toml 只包含公开服务 URL、KV 标识、10ms 单请求 CPU 上限和关闭的观测日志。以下值通过 Worker Secrets 配置，禁止写入本文件：

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- ALLOWED_EMAILS
- SETUP_KEY：仅供兼容旧客户端时临时注册，正常小手机连接无需配置。

在 Google Cloud 的同一专用项目启用 Gmail API 与 Gmail MCP API。OAuth 同意屏幕给自己的账号添加测试用户，申请 openid、email、gmail.readonly；需要草稿时再申请 gmail.compose。OAuth Web 客户端选择「用于 AI 代理」，唯一 Google 回调为 PUBLIC_URL 加 /oauth/google/callback。服务条款、创建凭据和最终邮箱授权须由本人确认。

正常连接采用官方库支持的公开客户端描述（CIMD）：MCP 客户端 ID 固定为 PUBLIC_URL 加 /client-metadata.json，唯一回调为 /client-callback。描述文档没有密钥；PKCE 与 Google 账号校验继续生效。动态注册默认关闭，不需要把管理密钥交给网页。旧客户端确有需要时，管理者可临时设置 SETUP_KEY，在 /register 注册 none 公共客户端后删除此密钥。

小手机连接设置：

- 地址为 PUBLIC_URL 加 /mcp，授权方式 OAuth。
- 选择「使用此服务自己的回执页」，MCP 客户端 ID 填 PUBLIC_URL 加 /client-metadata.json。
- 授权范围：只读用 mcp:read offline_access；读信加草稿用 mcp:read mcp:write offline_access。
- 从小手机发起 Google 登录，把服务回执页完整链接粘贴回小手机，再验证真实工具目录。
- 角色权限在小手机内单独勾选，默认不会授权给全部角色。

/health 只显示配置是否齐全，不显示邮箱、凭据或原始错误。配置齐全不等于实际 Google 授权和工具调用已经通过。

## 检查与部署

在此目录执行 npm ci --ignore-scripts、npm test。测试包含实际 workerd + 官方 OAuth 库；Google 网络由本地模拟服务代替，不请求真实邮箱或收费模型。部署兼容日期与测试读取同一配置。Workers 不支持 redirect: error，这里使用 manual 并拒绝跳转，保持不转发凭据的约束。

浏览器还须验证真实表单的跨站跳转。Chromium 会把 form-action 检查应用到 302 目标；只写 self 会拦住 Google，随后重复提交则因一次性事务已消费而失败。仅授权页额外允许固定 https://accounts.google.com，回执和错误页仍只允许 self。复用根目录 tests/fish-mcp-v1756.test.mjs 的 browser consent 回归，通过 scripts/run_tests_mac.sh 运行；Google 测试请求在 Chromium 层阻断，只观察跳转意图，陌生目标仍必须由 CSP 拦截。FIX_TEST_OLD=1 对照旧实现必须失败。

先执行 Wrangler 的 deploy --dry-run。仅从已提交的本服务源码部署，核对服务目录无未提交差异；小手机其他未提交候选的发布状态单独记录。实际部署后只读核验服务地址、CPU 上限与 KV 绑定，Google 登录和工具目录在本人完成授权后核验。

Workers 用量与账号内其他项目共享，套餐内额度有限。不得为此升级套餐或新开订阅；现有包含额度不够时先停下说明，不自动购买。
