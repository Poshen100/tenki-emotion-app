# TENKI Harness 索引（給任何 AI：Cursor / Claude Code / Antigravity / 其他）

> 這套 Harness 的 01–04 層**不在本資料夾** — 它們以既有檔案存在（本 repo 鐵律：同一規則只有一個 canonical，
> 重複文件會互相矛盾，2026-07-03 健檢已清過一輪）。本資料夾只放 05（維護協議）與 06（交接信）。

| 層 | 職責 | 實體檔案（canonical） |
|----|------|----------------------|
| 01 憲法（硬規則） | 禁止事項、技術選型、commit 紀律 | `CLAUDE.md`（+ `SYSTEM.md` 產品定位語言） |
| 02 法典（陷阱手冊） | 文件優先序裁決、任務路由、已知坑「情境→規則」 | `docs/PLAYBOOK.md` |
| 03 日誌（session 記憶） | 斷點交接、事件紀錄（最新在最上） | `MEMORY.md`（協議置頂） |
| 04 機械護欄（不靠自覺） | 一鍵 merge gate、禁用詞 CI、檔案保護 hooks、截圖驗證 | `scripts/verify.sh`、`scripts/check-vocab.sh`、`scripts/preview-shot.mjs`、`.claude/hooks/*`、`.github/workflows/ci.yml` |
| 05 維護協議 | 弱模型如何**安全地**自我更新上述檔案 | `.cursor/harness/05_maintenance.md`（本資料夾） |
| 06 交接信 | Fable 5 的關鍵判斷、退化模式預警、能力極限 | `.cursor/harness/06_manifesto.md`（本資料夾） |

**啟動順序（每個新 session）**：`CLAUDE.md` → `MEMORY.md` 最上條 → `docs/PLAYBOOK.md` 對應段落 →（要改規則文件時）`05_maintenance.md`。
文件互相矛盾時的裁決順序**只認 `docs/PLAYBOOK.md` §0**（其領域文件級已列入本資料夾）— 本檔不另行宣告排位。
