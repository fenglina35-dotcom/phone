# 真实外卖连接器契约

网页和私人 iOS 共用 `delivery.js`。真实外卖默认关闭；启用后，客户端只展示连接器返回的真实商家、报价、优惠和订单状态，不会用 AI 生成内容补位。

## 普通用户可用的淘宝闪购浏览器通道

不签商户合作也可以使用“角色选店／选规格／创建真实待付款订单／本人付款”这条链路。仓库内置的 `services/phone-delivery-browser` 使用用户本人已登录的淘宝闪购／饿了么 H5，不要求营业执照；它固定返回 `automaticPayments:false`，在支付宝官方收银台停止，并把官方链接和二维码交给本人确认。

浏览器通道不是平台开放 API。登录过期、滑块或页面改版时必须停止并人工处理，不能绕过验证码，也不能把失败回退成虚拟订单。服务需要一台常驻电脑或私有服务器保存浏览器 profile；具体部署与安全要求见 `services/phone-delivery-browser/README.md`。

项目现已内置独立伴生云连接器地址 `https://qvuahlqimcfgeoetosnl.supabase.co/functions/v1/phone-delivery`。客户端会用设备随机身份和独立密钥鉴权；私人伴生密钥只会发送给这个完全匹配的官方地址，自定义连接器只收到单独生成的外卖密钥。用户不需要手工填写默认地址。

## 上线前提

内置 Supabase Edge Function、订单数据库、付款幂等记录、签名 Webhook 和角色通知任务已经部署到独立伴生云。平台 API 的正式合作授权仍必须配置在服务器环境变量或受控的上游适配服务中；密钥、支付令牌、地址和平台 Cookie 不得写入网页、Xcode Bundle 或 Git。

连接器需要以下服务器密钥：

- `PHONE_DELIVERY_UPSTREAM_URL`：已获平台授权的 HTTPS 适配服务。
- `PHONE_DELIVERY_UPSTREAM_SECRET`：连接器与适配服务共同持有的至少 32 字节随机签名密钥。
- `PHONE_DELIVERY_ALLOWED_ORIGINS`：可选，逗号分隔的网页来源白名单；私人 App 的本地来源按实际 WebView Origin 配置。

连接器到适配服务的每个请求都带 `x-phone-delivery-timestamp` 和 `x-phone-delivery-signature`。签名内容是 `HMAC-SHA256(secret, timestamp + "." + rawBody)` 的小写十六进制结果。

正式平台 API 不可用时，可选择仓库内的浏览器通道操作用户本人已登录的公开 H5；浏览器通道不得抓包复用私有 App 接口、绕过验证码、伪造订单或宣称付款成功，也不得提供自动代扣。

## 请求

客户端对同一个 HTTPS 地址发送 `POST application/json`：

```json
{
  "action": "capabilities | confirm_address | search | create_order | pay_order | order_status",
  "payload": {},
  "client": { "appVersion": "v1030 ...", "privateApp": false }
}
```

浏览器使用 `credentials: include`。生产服务应使用 HttpOnly、Secure、SameSite 合适的短期会话或等价的强认证，并校验用户、设备、重放、金额和订单归属。不要让客户端提交或覆盖真实支付金额。

## 响应

成功：`{"ok":true,"data":{...}}`。失败：非 2xx，或 `{"ok":false,"error":"可直接展示的真实原因"}`。

- `capabilities`：返回 `providers`、`payments`、`addressLabel`；并明确返回 `automaticPayments`、`addressConfirmation`、`realtimeWebhooks`。不支持授权自动付款时应返回 `automaticPayments:false`，客户端会关闭自动付款开关。
- `confirm_address`：只能在用户主动点击“本人确认”后调用。服务端必须从已登录的平台账户读取当前默认收货地址，返回不含完整地址的 `addressLabel` 和稳定的 `addressFingerprint`；不得相信客户端自报地址。地址变化时必须返回新的指纹。
- `search`：返回 `offers`。每项至少包含 `offerId`、`provider`、`merchant`、`name`、`price`、`deliveryFee`、`total`、`quoteId`；评价、评论数、优惠、配送时间只有平台真实返回时才提供。需要选口味的商品通过 `optionGroups` 返回真实规格组，每组包含稳定 `id`、名称、是否必选／多选和真实 `choices`。
- `create_order`：服务端按 `offerId`／`quoteId` 重验库存、地址、`selectedOptions` 和价格，返回 `orderId`、真实 `total`、`status`、`addressFingerprint`、`items`、`risk`。客户端同时发送 `clientRequestId`；服务端必须把同一用户、同一请求号的重试映射到同一订单，不能重复创建。
- `pay_order`：返回 `status`、`paymentMethod`、`payUrl`、可选的 `payQrDataUrl`、`reason`。只有支付渠道最终回执才可返回 `paid`。官方合作通道优先尝试微信、其次支付宝；淘宝闪购浏览器通道当前只返回支付宝官方收银台。客户端发送稳定的 `clientRequestId` 和自动付款时的 `authorizedTotal`；服务端必须做幂等、重新读取订单应付金额，并且绝不能扣除高于授权金额的款项。
- `order_status`：返回平台当前状态，可用值为 `pending_payment`、`paid`、`merchant_confirmed`、`preparing`、`courier_assigned`、`picked_up`、`delivering`、`delivered`、`canceled`、`refunded` 或 `failed`。

## 实时状态

前台每 45 秒轮询一次，重新回到 App 或网络恢复时也会同步。连接器仍应接收平台 Webhook、验签并持久化订单状态；这样客户端下次同步时能取得真实变化。平台重复或乱序通知必须幂等处理，不能让配送状态倒退。若要在 iOS 完全退出时仍即时提醒，还需由连接器把已验签的状态变化接到现有 APNs 服务，推送中不得包含完整地址或支付令牌。

标准化适配服务向 `phone-delivery?webhook=1` 回调时，使用 `x-delivery-webhook-timestamp` 与 `x-delivery-webhook-signature`，签名算法同上。回调正文至少包含 `provider`、`eventId`、`orderId` 和 `status`。连接器会拒绝超过五分钟的回调、去重事件并防止状态倒退；重要状态随后进入现有角色后台任务，由真实角色模型按自己的人设生成提醒，不使用固定角色台词。

## 钱包结算回执

- 角色外卖钱包是客户端的“授权消费额度”，不是微信或支付宝储值账户；实际资金始终由正式支付渠道管理。
- 自动付款请求发出前，客户端会持久保存授权金额和付款幂等号。即使初始响应为处理中，后续 `order_status` 首次确认 `paid` 时仍会只扣一次授权额度。
- 后续首次确认 `refunded` 时只返还一次已经扣除的角色额度。连接器不得用 `canceled` 或 `failed` 冒充已完成退款。
- 如果平台回执的实付金额高于自动付款授权金额，客户端会关闭后续自动付款并要求人工核对；服务端仍必须在支付前阻止这种情况发生。

## 允许的付款跳转

`payUrl` 只接受 `https:`、`weixin:`、`alipays:` 或 `alipay:`。连接器不得返回脚本、文件、本地网络地址或其他自定义协议，也不得把支付令牌放入可长期保存的 URL。

## 自动付款边界

角色自动付款同时要求：真实外卖已开启、自动付款已开启、角色授权余额足够、单笔和当日上限均允许、地址已由本人确认、报价没有变化、没有短时重复、平台没有风控要求。任一条件不满足时只保留真实待付款订单。
