# App Store Connect Review Notes 模板

下面英文可直接粘贴到 App Review Information → Notes。提交前只替换方括号中的审核账号与密码；不要把替换后的文件提交到 Git。

---

North has two visible tabs: **Local Management** and **Role Remote Management**. No feature is hidden behind a gesture, region, date, device type, or review-only switch.

The Role Remote Management feature lets a user-authorized role controller send refresh, lock, unlock, and daily-limit commands for apps that the user explicitly selected through Apple's FamilyActivityPicker. A server-queued command is not shown as completed until North executes it and uploads a device receipt.

Ordinary users can open the same public Role Controller page, create an independent controller in their own browser without registration, export its recovery file, and pair it with North using a 10-minute one-time code. The separate demo login below is provided only so App Review does not need to create or preserve a controller during testing.

Permanent demo access:

- Role Controller: https://fenglina35-dotcom.github.io/phone/north-support.html?role-controller=1
- Email: [REVIEW_ACCOUNT_EMAIL]
- Password: [REVIEW_ACCOUNT_PASSWORD]
- The test role is already created. No registration or role creation is required.

Review steps:

1. Open the Role Controller, choose **Review sign in**, sign in with the credentials above, and select **Generate new pairing code**. The page displays a controller ID and an 8-digit code. The login is permanent; each pairing code intentionally expires after 10 minutes for security.
2. On the review iPhone, open North → **Local Management**, authorize Screen Time, and select at least one test app. Then open **Role Remote Management**, enter the controller ID and pairing code, connect, and tap **Upload real data now** once.
3. Keep North open during the first review test. In the Role Controller, select the uploaded app and test **Refresh data**, **Lock**, **Unlock**, and **Set 15-minute daily limit**. The recent-command list changes from pending to the device-reported final status.

North does not read messages, private content, photos, or pages inside WeChat, TikTok, or any other third-party app. Optional HealthKit access is limited to step count only. HealthKit and location access are not required to test role remote management.

Support: https://fenglina35-dotcom.github.io/phone/north-support.html

Privacy Policy: https://fenglina35-dotcom.github.io/phone/north-privacy.html

If helpful, we have also attached a screen recording showing the complete sign-in, pairing, lock, unlock, daily-limit, and device-receipt flow.

---
