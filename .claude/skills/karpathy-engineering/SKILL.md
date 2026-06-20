---
name: karpathy-engineering
description: Senior-engineer discipline for any code change in this repo — think before coding, simplicity first, surgical changes, goal-driven execution. Auto-apply whenever writing, editing, refactoring, or debugging code. Adapted from andrej-karpathy-skills (forrestchang).
---

# Karpathy Engineering Discipline

> 把 AI 從「盲目自信的初級工程師」調教成「審慎精準的高級工程師」。
> Source: [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) — adapted for TENKI CORE.
> 這套準則與 `CLAUDE.md` 的硬規則並存，衝突時以 `CLAUDE.md` 為準（它是 source of truth）。

四大黃金原則，對策 LLM 寫程式的四種系統性偏差。每次寫 / 改 / 修 code 前都套用。

---

## 1. Think Before Coding — 先思考再編碼
**對策**：錯誤假設、瞎猜硬寫。

- 動手前先用自然語言講清楚：我的假設是什麼、要改哪些檔、預期結果是什麼。
- 需求模糊或有多種合理解法時 → **停下來問用戶**，不要私自盲猜。
- 與既有架構（`packages/` / `domain/` / `apps/mobile/` 邊界）有衝突時，先講出來再動。

## 2. Simplicity First — 極簡優先
**對策**：過度工程、盲目抽象。

- 只寫解決「當前」問題的最少程式碼。不為未來假想場景寫防禦性代碼（YAGNI）。
- 能用 `if-else` 解決就不要套設計模式；200 行能寫成 50 行就重寫。
- 不隨手新增依賴。要加 dependency 先說明為什麼非它不可。
- 對應 `CLAUDE.md` 禁止事項：別用 SVG（用 Skia）、別用 legacy `Animated`（用 Reanimated 3）、別用 Redux（用 Zustand）。

## 3. Surgical Changes — 外科手術式精準修改
**對策**：無關修改、越幫越忙。

- 像外科醫生：只動該改的地方。每一行 diff 都要與需求直接相關。
- 修 bug 時**嚴禁**「順手」重構、重排、改註解、改格式周邊沒壞的程式碼。
- 不碰 `apps/web/` 與 `core/`（凍結）。
- 想做順手的清理 → 另開 commit / 另開 PR，不混進當前改動。

## 4. Goal-Driven Execution — 目標驅動執行
**對策**：缺乏驗證、偏離初衷。

- 把模糊任務轉成「可驗證的宣告式目標」，用 loop 自動驗證。
- 修 bug 的標準流程：**先寫能複現 bug 的測試 → 改 code → 跑測試直到綠**。
- 收尾跑 `npm test`（全綠）+ `npx tsc --noEmit`（零錯誤）+ `npm run lint`（0 errors）。
- engine/ 與 scan/ 覆蓋率 ≥ 90%。

---

## TENKI 專屬硬規則（不可違反，覆蓋以上）
詳見 `CLAUDE.md` 與 `AGENTS.md`：

- 禁用廢棄詞彙：TEI / PR99 / PEAK / OPTIMAL / 4 zone / 3 tier。
- 禁止 raw biometric data 上雲（privacy-first）。
- 禁止醫療診斷 / 金融建議措辭（App Store compliance）。
- TypeScript `strict`，禁用 `any`。
- **Commit Per Todo**：一個 Todo = 一個 commit，格式 `<type>(<scope>): <description>`。
