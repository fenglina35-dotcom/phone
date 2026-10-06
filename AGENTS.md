# Project Agent Notes

## Long-term maintenance documents

- Before analyzing or changing code, read `docs/maintenance/README.md` and the four DOCX files it lists. Treat them as maintained project records, not temporary references.
- Check the Bug record before proposing a fix. Do not repeat a previously failed approach unless new evidence or a material new variable is documented.
- Record new features, design changes, and important decisions in `docs/maintenance/AI开发项目_项目说明文档.docx`.
- Record every Bug, root cause, solution, test result, and failed attempt in `docs/maintenance/AI开发项目_Bug记录模板.docx`. Append history; do not erase it.
- Record newly discovered engineering rules and recurring pitfalls in `docs/maintenance/AI开发项目_Bug修改规范.docx`.
- After any core-function change, explicitly check whether all three maintained documents need updates.
- If the same Bug remains unresolved after two implementation attempts, stop editing, reassess the diagnosis and rollback risk, and choose a materially different plan before continuing.
- `PROJECT_RULES.md` contains historical task notes. If it conflicts with the current maintenance documents or the latest user instruction, treat the current maintenance documents and latest instruction as authoritative.

## Liquid glass (frosted body + one fine highlight ring)

- Before touching the glass look of bubbles, buttons, or input fields, read
  `docs/maintenance/液态玻璃_磨砂加细高光_做法.md`. It is the recipe the user signed off on
  ("这次做的高光美化非常好，是我想要的效果"). Do not re-derive it; three rounds of rework
  are already recorded there, including the two approaches she rejected.
- The one rule that caused all of that rework: **any white painted across the whole shape,
  sitting beneath a `backdrop-filter` layer, becomes a milky wash.** The rim must be a true
  ring (clipped, or masked out) and must sit above the blur, never below it.
- Bubble ring geometry is generated, not hand-written. Change the constants in
  `scripts/glass_ring_polygon.py`, rerun it, and paste the four `clip-path` values into all
  three shells. `python3 scripts/glass_ring_polygon.py --check` verifies the shipped CSS
  matches the script; `tests/glass-ring-recipe.test.mjs` runs that check in the suite.

## Core rule

- Stability is the first priority. Keep changes narrowly scoped and do not alter unrelated systems.
- Never store API keys, access tokens, payment details, or other credentials in the repository.
- Before changing or diagnosing MiniMax voice cloning, read `MINIMAX_VOICE_CLONE_RUNBOOK.md`.

## Release rule

- Check the branch and worktree before committing.
- Do not commit local Supabase CLI binaries or generated configuration files.
- Commit completed changes and push with `git push origin HEAD:main`.
- If the first push fails, stop retrying and leave the commit ready for the user to push manually.
- Report the resulting version or documentation revision after every push.

## Core chat release gate after the v1209 incident

- Before any code release, run `node scripts/check_chat_authorized_phone.cjs` with the bundled Playwright dependencies, in addition to scoped regressions and the full Node test suite. Do not replace `buildSystem` or `myActivity` with mocks. Verify both web and private entrypoints with existing phone permission, populated notes, output-mode toggles, visible replies, busy-state release, automatic inspection, and persistence reload.
- A bug regression must fail on the affected old implementation before it can justify the fix. Syntax checks, source regex assertions, empty/default-state fixtures, and a high passing-test count do not establish core-chat safety.
- Enumerate every consumer of changed shared logic and verify unrelated working paths. Preserve user data, model settings, role/account boundaries, private-native differences, and historical artifacts. Report unverified real-model, native-build, and real-device paths honestly; never promise absolute absence of bugs.

## Never ship a release that drops an earlier fix (after the v1235 incident)

Every release must carry all previously delivered repairs. The user must never have to
ask whether a past fix is still included.

- `tests/permanent-fix-guard.test.mjs` is the registry of repairs that must be present in
  every build, for the web core and the private bundle. It runs with the normal suite. A
  failure there is a release blocker, not a follow-up item.
- When you ship a user-visible fix, add its marker to that registry in the same commit.
  Only remove an entry when the feature it guards is genuinely gone. If a refactor moves a
  marker, update the marker in the commit that moves the code and say so in the commit body.
- Never hand the user a package built from uncommitted work. Packaging scripts must read
  from the committed tree (see `scripts/package_private_v1248_ios359.py`, which uses
  `git cat-file` against HEAD and refuses to run with a dirty private source). Older
  scripts read the working directory with `(ROOT / name).read_bytes()`; do not copy that.
- Background: the v1235/iOS356 cohabitation schedule-sync repair was never committed. It
  reached the user's device only because `scripts/package_private_v1240_ios356.py` read the
  working tree, then vanished from v1246 onward once packages were built from a clean
  checkout. The user experienced a fixed bug returning, and a diff of committed history
  showed nothing, because the fix had never been in that history. Assume any repair that is
  not committed and not guarded by a test will be lost.
- Private cloud backup is part of that permanent inheritance. Every private release must
  keep `private-cloud-backup.js`, both private HTML entry references, the native
  `account.backup.file.begin/chunk/commit/abort` handlers, file-backed upload, Xcode target
  membership, and an outer web timeout that does not expire before the native commit.
  `tests/permanent-fix-guard.test.mjs` must block the release if any layer is missing.

## 工作区域复用与修复后清理（用户长期规则，2026-10-04）

- 每次新聊天先完整阅读父目录的 00_新聊天先读_精简交接.txt，再核对指定工作树；不默认通读全部历史，不自动切换到旧的 phone-work/main。
- 默认禁止创建新的工作树、源码副本、临时目录、备份目录或按版本重复的脚本/说明/日志/截图文件。先查已有文件及对应用途，复用当前合适的工作树、维护文档、测试脚本和固定预览位置；不得为复用覆盖仍有独有内容的文件。现有文件确实无法满足要求时，先向用户说明原因，获得明确同意再新增。用户明确要求的新交付包等属于该次授权范围。
- 每次修复完成后，把安全清理作为收尾必做项：核对本轮新增/修改文件，清理已确认无用的本轮临时产物、可重建缓存、重复文件和已结束的工作树。不得每次另建一份归档而继续累积；如需留证据，复用已有记录位置并保留必要的一份。
- 清理不是强行让 Git 状态变空。保护源码、未提交/未推送/未合并改动、其他聊天工作树、用户存档、配置与签名、唯一交付包和不可重建的证据；不得使用 reset、stash、广泛 git clean 或强制工作树删除来掩盖未完成内容。
- 删除重复文件前核对内容并确认保留副本；移除工作树前核对提交继承/恢复位置、未跟踪及忽略文件、任务是否已结束，并使用 git worktree remove。Windows 删除/移动前核对绝对路径和目录边界。
- 如安全清理被自动审批阻止，或仍有无法确定用途的内容，明确报告具体保留项与原因，不绕过限制，不声称已经清理干净。最终回复说明本轮清理结果。


## 私人伴生功能保护（用户明确规则，2026-10-06）
- 网页/公开 North 伴生功能与私人伴生功能不同是正常且有意的设计，不得以功能一致或版本同步为由覆盖私人版。
- 未经用户单独明确允许，不得修改私人伴生功能、原生桥或私人后台，不得把网页伴生改动复制进 PhoneWeb.bundle 或打入私人覆盖包。
- 后续私人打包必须核对这项差异；公开版移除的屏幕总时长/逐 App 回传，以及网页对应入口的撤除，不得迁移到私人版。私人原有时长采集、管控、共享屏幕及其他伴生功能保持。

- 本轮唯一私人伴生例外授权：只移除新增“屏幕使用时间 · 自动上传”快捷指令云端卡片及读取定时器，原有私人伴生时长同步/管控/共享屏幕继续保留。不得扩大为其他私人改动。
