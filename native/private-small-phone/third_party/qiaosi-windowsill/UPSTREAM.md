# 赴约 · 窗台（第三方）

- 作者：唐幡（GitHub TangfanOVO）
- 来源：https://github.com/TangfanOVO/qiaosi ，`scenes/windowsill`
- 取用的版本：提交 `309508f1ce637269638810d9b1e43cb5d1aeb7bd`（2026-10-17）
- 协议：AGPL-3.0（见本目录 `LICENSE`），商用另行授权见 `COMMERCIAL.md`
- 用户（North）说明已征得作者同意接入小手机。目前只用于私人版（只装在她自己的手机上）；网页版接入前需要作者的书面授权。

## 本目录里有什么

- `src/`、`models/`、`blender/`、`build.mjs`、`README.md`、`CHANGELOG.md`、`LICENSE`、`COMMERCIAL.md`：原样从上游复制，**一字未改**。
- `smallphone/`：小手机加的一层（同样按 AGPL-3.0 提供），不改上游文件：
  - `shell.js`：本地文件环境下从打包数据读模型、画质与省电、深色底、小箭头返回、桌上手机进入小手机、画面被回收时通知重载。
- 打包时对上游脚本的两处替换（只在生成的 windowsill.js 里，源码不动；见 `scripts/build_couple_windowsill.mjs`）：
  - `00-setup.js` 清晰度上限 1.6 → 读 `window.__WS_DPR_MAX`（正常 2、省电 1.25）；
  - `19-frame-api.js` 降一档门槛每秒 34 帧 → 读 `window.__WS_LOWQ_FPS`（正常 22、省电 16）。
  - `09-left-writing-corner.js` 把桌上手机屏幕的贴图交给 `window.__WS_PHONE_SCREEN`（shell.js 在上面画她的锁屏）；
  - `17-tags-camera-glass.js` 景深虚化乘 `window.__WS_DOF`（0.45）；
  - `19-frame-api.js` 降档后的清晰度用 `window.__WS_LOWQ_PR`（1.5）；凑近手机提前在镜头推到六成时变清楚；
  - `18-input-sliders.js` 手机已经亮着时再点一下它，调用 `window.__WS_PHONE_ENTER`（进入小手机），没亮时照上游翻过来。

  - `17-tags-camera-glass.js` 有 `window.__WS_NO_SILL_PET` 时去掉窗台上的透卡（标注、模型和它的彩色影子），只留桌上的流麻牌；
  - `13-desk-pet.js` 桌宠的 tick / next 先问 `window.__WS_PET`（shell.js 用 pet.js 里小橘的帧图画透卡和流麻牌；没加载好时照上游颜文字）。
- `pet.js`：小手机自己画的 20 个小橘动态表情拆成的帧图，由 `scripts/build_couple_windowsill_pet.cjs` 生成（要先生成它，再运行下面的打包）。
- shell.js 还接了「一起听」：电脑屏幕显示小手机音乐里正在放的歌，卡片上可以上一首 / 播放暂停 / 下一首。

## 怎么生成 App 里用的页面

```bash
node scripts/build_couple_windowsill.mjs --tools <装了 esbuild@0.24.0 和 three@0.170.0 的 node_modules 所在文件夹>
```

输出到 `native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/couple-windowsill/`：
`index.html`（上游页面骨架，去掉了 CDN 引用）、`windowsill.js`（three.js + 场景脚本打成一个普通脚本）、`models.js`（四件模型）、`shell.js`。
three.js 是 MIT 协议。
