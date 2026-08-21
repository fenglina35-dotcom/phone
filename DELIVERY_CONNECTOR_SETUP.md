# 真实外卖连接器契约

网页和私人 iOS 共用 `delivery.js`。真实外卖默认关闭；启用后，客户端只展示连接器返回的真实商家、报价、优惠和订单状态，不会用 AI 生成内容补位。

## 上线前提

需要由安装方部署一个 HTTPS 服务，并在外卖软件的“真实外卖与角色钱包”中填写地址。该服务负责持有淘宝闪购、美团外卖、微信支付、支付宝的商户／平台代理授权以及用户授权；密钥、支付令牌、地址和平台 Cookie 不得写入网页、Xcode Bundle 或 Git。

若平台暂未向当前主体开放搜索、下单或代扣资质，连接器必须返回明确错误，不能抓取消费者 App、模拟点击、绕过验证码、伪造订单或宣称付款成功。

## 请求

客户端对同一个 HTTPS 地址发送 `POST application/json`：

```json
{
  "action": "capabilities | search | create_order | pay_order | order_status",
  "payload": {},
  "client": { "appVersion": "v1029 ...", "privateApp": false }
}
```

浏览器使用 `credentials: include`。生产服务应使用 HttpOnly、Secure、SameSite 合适的短期会话或等价的强认证，并校验用户、设备、重放、金额和订单归属。不要让客户端提交或覆盖真实支付金额。

## 响应

成功：`{"ok":true,"data":{...}}`。失败：非 2xx，或 `{"ok":false,"error":"可直接展示的真实原因"}`。

- `capabilities`：返回 `providers`、`payments`、`addressLabel`。
- `search`：返回 `offers`。每项至少包含 `offerId`、`provider`、`merchant`、`name`、`price`、`deliveryFee`、`total`、`quoteId`；评价、评论数、优惠、配送时间只有平台真实返回时才提供。
- `create_order`：服务端按 `offerId`／`quoteId` 重验库存、地址和价格，返回 `orderId`、真实 `total`、`status`、`addressFingerprint`、`items`、`risk`。
- `pay_order`：返回 `status`、`paymentMethod`、`payUrl`、`reason`。只有支付渠道最终回执才可返回 `paid`。优先尝试 `wechat`，其次 `alipay`。
- `order_status`：返回平台当前状态，可用值为 `pending_payment`、`paid`、`merchant_confirmed`、`preparing`、`courier_assigned`、`picked_up`、`delivering`、`delivered`、`canceled`、`refunded` 或 `failed`。

## 实时状态

前台每 45 秒轮询一次，重新回到 App 或网络恢复时也会同步。连接器仍应接收平台 Webhook 并持久化订单状态；这样客户端下次同步时能取得真实变化。若要在 iOS 完全退出时仍即时提醒，还需由连接器把已验签的状态变化接到现有 APNs 服务，推送中不得包含完整地址或支付令牌。

## 自动付款边界

角色自动付款同时要求：真实外卖已开启、自动付款已开启、角色授权余额足够、单笔和当日上限均允许、地址已由本人确认、报价没有变化、没有短时重复、平台没有风控要求。任一条件不满足时只保留真实待付款订单。
