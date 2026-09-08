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

