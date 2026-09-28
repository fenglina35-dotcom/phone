# 免费授权代理（正式代理已部署）

## 外置语音固定厂商通道（v1340 已部署）

`POST /functions/v1/external-tts` 为 MiniMax 海螺、Fish、Mossland、ElevenLabs、Hume 提供固定官方主机转发，供小手机外置语音绕过已耗尽免费调用额度的 Supabase `phone-ai`。它只使用用户提交的厂商 Key，不读取小手机 AI 账号或点数，不扣点，不缓存，不重试，源代码不记录正文。通用兼容语音仍由客户端直连用户填写的地址，不接入公开代理。

生产版本 `9981d623` 已部署，继续包含此前的固定外置语音通道。Worker 19/19、全仓 Node 2634/2634，以及网页/私人内置页的语音隔离和授权状态核心聊天回归通过。线上无效占位 Key 已分别到达 Fish、MiniMax 两个官方域名、Mossland、ElevenLabs、Hume，并返回各厂商自己的鉴权错误；这只证明独立通道与固定上游生效，不代表真实 Key 已成功生成音频。功能提交 `5a465303564a63cd7702b375dd3f3dff02b8ec27` 的 Pages 工作流 `36392947531` 成功，四个线上核心资源与本地逐文件一致。

当前：OPPO 真机已由用户截图确认 GET /health 返回 ok:true。2026-09-28 原 Supabase 组织超额并进入 `Services restricted` 后，备用 phone-license v34 已把授权、会话和邀请码固定回备用项目自己的数据库；Cloudflare 活跃版本 `9981d623` 继续转发到该备用函数。线上 GET /health 返回 200；官方网页 Origin 的预检允许 `content-type, x-admin-token`；管理员无凭证返回 401 `admin-token-required`，伪凭证返回 401 `admin-unauthorized`，任意未允许动作返回 403，空普通 session_check 仍返回原业务 400。网页 v1338、私人内置源码 v1339 已接入备用入口；管理员前端版本 v637 已发布。

- 固定上游是 lkhlyfpssmrjkkzhuzag 项目的备用 phone-license。授权、邀请码、licenseId、sessionId 和 `phone_license_admin_page` 全部使用该备用项目自己的数据库，避免原 lovbzibismsjqvjujilz 组织超额时连带中断。2026-09-28 只读核对显示备用库已有 1,088 条授权记录和 1,313 条邀请码，分页函数可正常返回；原受限库为 828 条授权记录和 242 条购买记录。付款管理仍通过 `PHONE_SUPABASE_URL` / `PHONE_SERVICE_ROLE_KEY` 读取旧库，因此旧组织保持受限期间付款列表仍可能不可用，不能把授权后台恢复写成付款后台也已恢复。
- 普通用户动作继续使用固定白名单；管理员只允许 `ADMIN_ACTIONS` 中的固定动作，并且必须显式提供 `x-admin-token`。管理员凭证只转发给固定备用 phone-license，普通用户动作绝不会携带管理员凭证。仍拒绝任意上游、查询参数、非 JSON 和大于 64 KiB 的请求；保留原业务响应、设备标签与 UA，不转发 Cookie；无缓存、无自动重试、代码不记录请求正文。
- 网页仅在原 license-failover 项目使用此传输；其他项目和私人 file 原生桥保持原地址。通行密钥 Origin/RP 保持正式网页域名。
- 进入前不再等待可选真人好友注册网络；进入成功后继续原注册及身份同步。管理员封禁仍由原服务器决定，临时网络错误不能被当作撤销授权。
- 本地代理专项 19/19、本次管理员与授权专项 26/26、全仓 2634/2634；旧 84d63859 代码在阻断 Supabase 场景及可选服务卡住场景明确失败，新代码通过。实际网页/私人内置入口的模拟授权、一次核销、刷新后会话保留通过；两端核心聊天回归通过。
- 线上空会话 POST 返回原后台 HTTP400 / license-request-failed / permanent:false；官方 Origin CORS 正常；无凭证和伪凭证均被 401 拒绝，未允许动作被 403 拒绝。没有使用任何真实邀请码或真实管理员凭证，真实管理员登录、真实首次激活后管理员列表登记仍待实际用户验收。
- 套餐保持 Free，复用现有域名，无新增付费。控制台默认 Workers Logs 保持开启；源代码不打印敏感数据。
- 回退：服务可回退控制台版本 `0e4fab66`（不含管理员动作恢复）或 `546dd57f`（仅健康检查），但客户端不可在真实激活提交后自动换路重试。回退客户端须发新版本并保留原会话、存档及后台记录。

## 首阶段记录（历史，不代表当前尚未部署）

# 免费授权入口连通性探测（已部署，待受影响手机验证）

状态：2026-09-27 已通过用户登录的 Cloudflare 控制台部署，未接入线上小手机。用户要求零新增付费服务。控制台确认 Workers Free $0，复用账号原有 smallphoneapp.com 域名，没有购买或升级套餐。

入口：https://license.smallphoneapp.com/health
Worker：north-license-connectivity；默认地址：https://north-license-connectivity.fenglina35.workers.dev/health
已确认生产代码版本：546dd57f。新增专用子域名 license.smallphoneapp.com，没有覆盖根域名或其他既有域名。

用户证据：vivo 自带浏览器，Wi-Fi/流量均不能访问原授权接口；浏览器详情 ERR_CONNECTION_RESET (-101)。同项目 functions.supabase.co 地址仍一直加载。不能确定重置发起方。

第一阶段只部署 worker.mjs 的 GET /health。它固定向原项目发送空 session_check，只验证后端响应，不接收/兑换邀请码，不接受用户提供的上游地址，不转发 Cookie 或 Authorization，不记录请求内容，不重试。

本地：node --test services/phone-license-relay/worker.test.mjs，7/7 通过。跨域、固定上游、拒绝邀请码输入、超时、错误脱敏和不跟随重定向已覆盖。

线上验证：两个域名 GET /health 均 HTTP 200，ok=true，code=license-backend-reachable。自定义域名官方 Origin 预检 204，外来 Origin 403，POST 405。仅空 session_check，没有兑换任何邀请码、创建任何用户或修改后台记录。

部署中发现实际 Worker 运行时拒绝 redirect:error，已改为 redirect:manual 并增加拒绝重定向测试；最终代码不回传临时详细异常。控制台代码与本地版本按逐行忽略缩进核对一致（网页编辑器自动缩进不同）。部署通过控制台完成，wrangler.toml 尚未用于发布；控制台默认 Workers Logs 为 Enabled，代码本身不写日志。

待办：用户表示太晚，受影响 vivo/OPPO 明天再测。本轮停在这里，不将本地成功当作受影响手机成功。免费入口经受影响手机验证可达后，再继续正式授权代理和客户端接入，不能直接把本探测地址用作激活地址。本轮没有修改小手机版本、重新打包或推送。

正式接入注意：保持原 license-failover 后台身份和数据库；激活响应丢失时不能盲目重试核销；通行密钥 RP 与网页 origin 保持原值；网页/私人兼容和既有授权回归通过后再发布。

管理员登记是用户明确要求：supabase/functions/phone-license/index.ts 的 activateInvite 调用 redeem_invite_license；管理员 adminLicenseUsers 调用 phone_license_admin_page，读取同一套 phone_licenses。正式代理固定转发到 lkhlyfpssmrjkkzhuzag 的备用 phone-license，备用函数必须使用原项目 lovbzibismsjqvjujilz 的 PHONE_SUPABASE_URL 与 PHONE_SERVICE_ROLE_KEY，保留原始业务响应和设备信息，不另建邀请码或用户数据库。当前已核对两项备用函数密钥的 SHA-256 指纹均指向原项目，尚未使用真实新邀请码完成管理员页面登记验收，不能写成已完成真实登记测试。
