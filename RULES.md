> ⛔ **SUPERSEDED (2026-07-02) — DO NOT FOLLOW THIS FILE.**
> 本檔是 v2 規則（保護 TEI/PEAK/OPTIMAL/舊 FDCB — 全部是 v3 已廢棄並禁用的概念）。
> 現行規則：`CLAUDE.md` + `SYSTEM.md` + `docs/PLAYBOOK.md`（優先序見其 §0）；v3 版行為規則見 `RULES-v3.md`。
> 保留此檔僅供考古。

# RULES.md — Tenki Core Development Rules

> 所有 AI 工具（Antigravity / Claude / Claude Code）必須遵守此檔案。
> 這些規則由 Founder (Poshen) 制定，AI 不可自行修改或覆蓋。
> 如果規則之間有衝突，以 ANTIGRAVITY.md 為最終依據。

---

## 一、啟動規則（每次 Session 開始時）

1. **先讀三份文件**，依序：ANTIGRAVITY.md → MEMORY.md → RULES.md
2. 讀完後報告「上次 Session 結束點」和「建議下一步」
3. **永遠先問「我接下來要做什麼？」**，不要自行假設任務
4. 如果是新 session 且上次任務未完成，從 MEMORY.md 記載的斷點繼續

## 二、結束規則（每次 Session 結束時）

1. 輸出更新後的 MEMORY.md 內容（至少更新「上次 Session 結束點」段落）
2. 列出本次 session 完成的項目
3. 列出下次 session 的建議起點

## 三、絕對禁止（違反 = 立即停止）

1. ❌ 不動 `apps/web/` 目錄 — 現有 prototype 保留原樣
2. ❌ 不改 TEI 狀態區間定義 — PEAK/OPTIMAL/NEUTRAL/DEGRADED 已驗證
3. ❌ 不改 FDCB 6 個模板規則 — ANTIGRAVITY.md Section 5.4 已定案
4. ❌ 不改星塵動效的視覺「感覺」— 重建時保持 v25.8.2 體驗
5. ❌ 不用 `any` type — 用 `unknown` + type guard
6. ❌ 不自行決定架構級變更 — 必須先跟 Founder 確認
7. ❌ 不輸出看似合理但品質差的數字 — 品質差時必須降級提示

## 四、代碼標準

### 4.1 TypeScript
- `strict: true` 全開
- 不允許 `any`，用 `unknown` + type guard
- 所有 magic number 必須命名為常數並導出
- 每個 function 必須有 JSDoc（包含 @param 和 @returns）

### 4.2 命名規範
- Components: `PascalCase.tsx`（例：`FloatingBar.tsx`）
- Hooks: `useCamelCase.ts`（例：`useFdcbTimer.ts`）
- Utils/Engine: `camelCase.ts`（例：`tei.ts`）
- Tests: `*.test.ts`（與 source 同目錄層級）
- Constants: `SCREAMING_SNAKE`（例：`TEI_WEIGHTS`）
- Config objects: `camelCase`

### 4.3 測試
- engine/ 覆蓋率 ≥ 90%
- fdcb/ 覆蓋率 ≥ 90%
- UI components 覆蓋率 ≥ 70%
- 必須測試邊界條件（空陣列、零值、極端值）
- PR 一致性測試用隨機擾動分布，不用同樣輸入重複跑

### 4.4 Git
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Branch: `main`（production）, `dev`（development）, `feat/*`（features）

## 五、狀態管理
- **Zustand** — 全域狀態（scan, user, subscription, fdcb）
- **React Query** — 伺服器狀態（Supabase 資料）
- **Local state** — 純 UI 狀態
- FDCB 有獨立 Zustand store（`fdcbStore.ts`）

## 六、設計原則

1. **品質差時降級，不輸出假數字** — rPPG 產品化的關鍵
2. **Fusion 決策每次都能被 log 解釋** — source / confidence / fallback_reason
3. **BLE RR 存在時永遠優先** — 信任度 Tier 1
4. **EWMA 極慢過渡** — α=0.05，分數不跳動
5. **「極致」用可驗證條件定義** — Done = Go criteria 達標即上線
6. **FDCB 永遠可見** — 它是 OS Layer，不是隱藏功能
7. **Garmin 數據對齊** — HRV 用 RMSSD，Stress 用 0-100 刻度

## 七、Review 流程

```
Gemini/Antigravity 寫代碼
        ↓
Claude 做 review（檢查型別、邊界、邏輯、測試覆蓋）
        ↓
   通過 → 進下一個模組
   不通過 → Claude 輸出修正指令 → Gemini 修正 → 再 review
```

## 八、文件層級

```
ANTIGRAVITY.md  ← 最高權威（專案 spec + 技術架構 + FDCB spec）
RULES.md        ← 硬性規則（不可被 AI 覆蓋）
MEMORY.md       ← AI 學習筆記（可被 AI 更新，人類可隨時修改）
```

如果三份文件有衝突，優先級：**ANTIGRAVITY.md > RULES.md > MEMORY.md**

---

*Created: 2026-02-28*
*Maintained by: Poshen (Founder)*
*AI 不可修改此檔案，只有 Founder 有權修改。*
