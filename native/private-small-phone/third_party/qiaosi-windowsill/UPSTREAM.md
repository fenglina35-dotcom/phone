# 赴约 · 窗台（第三方）

- 作者：唐幡（GitHub TangfanOVO）
- 来源：https://github.com/TangfanOVO/qiaosi ，`scenes/windowsill`
- 取用的版本：提交 `309508f1ce637269638810d9b1e43cb5d1aeb7bd`（2026-10-17）
- 协议：AGPL-3.0（见本目录 `LICENSE`），商用另行授权见 `COMMERCIAL.md`
- 用户（North）说明已征得作者同意接入小手机。目前只用于私人版（只装在她自己的手机上）；网页版接入前需要作者的书面授权。

## 本目录里有什么

- `src/`、`models/`、`blender/`、`build.mjs`、`README.md`、`CHANGELOG.md`、`LICENSE`、`COMMERCIAL.md`：原样从上游复制，**一字未改**。
- `smallphone/`：小手机加的一层（同样按 AGPL-3.0 提供），不改上游文件：
  - `shell.js`：本地文件环境下从打包数据读模型、省电模式、左上角「返回」。

## 怎么生成 App 里用的页面

```bash
node scripts/build_couple_windowsill.mjs --tools <装了 esbuild@0.24.0 和 three@0.170.0 的 node_modules 所在文件夹>
```

输出到 `native/private-small-phone/XcodeProject/PhoneCompanionTest/PhoneWeb.bundle/couple-windowsill/`：
`index.html`（上游页面骨架，去掉了 CDN 引用）、`windowsill.js`（three.js + 场景脚本打成一个普通脚本）、`models.js`（四件模型）、`shell.js`。
three.js 是 MIT 协议。
