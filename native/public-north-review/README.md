# North 公开审核工程

此目录保存从被拒构建所对应源码恢复出的公开 North 工程，并只用于公开 App Store 审核修正。

- 产品边界：公开 North 仅提供用户授权后的本机管理与角色远程管理，不包含私人“小手机”网页界面。
- Bundle ID、App Group、Family Controls、DeviceActivity、ManagedSettings、HealthKit、定位和 APNs 能力保持原工程边界。
- 审核修正：把“真实同步”明确改名为“角色远程管理”，公开说明配对和角色命令，并提供需登录的角色控制台。
- 安全边界：审核账号密码只填写到 App Store Connect Review Notes，不得写入此目录或任何前端文件。
- 私人 App：`native/private-small-phone` 不得用此工程覆盖，也不得让公开 North 与私人“小手机”同时控制同一台本人设备。

Mac 上应打开 `PhoneCompanionTest/PhoneCompanionTest.xcodeproj`。提交新构建前，先按本目录 `审核提交说明.md` 完成服务端、账号、真机和 Review Notes 检查。
