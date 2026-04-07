# RULES-v3.md — TENKI CORE v3.0 Development Rules

> 所有 AI 工具（Antigravity / Claude / Claude Code）必須遵守此檔案。
> 這些規則由 Founder (Poshen) 制定，AI 不可自行修改或覆蓋。
> 如果規則之間有衝突，以 ANTIGRAVITY.md v3.0 為最終依據。

> **v3.0 重大變更**：本文件取代 RULES.md v2 所有互斥規則。
> 已廢棄概念：TEI PR99、舊 FDCB (Floating Decision Control Bar)、4 zone、3 tier 訂閱。
> 生效概念：Edge Score 0-100、Session Governance、packages/scan/、3 zone、2 tier 訂閱。

---

## 一、啟動規則（每次 Session 開始時）

1. **先讀三份文件**，依序：ANTIGRAVITY.md (v3) → MEMORY.md → RULES.md (v3)
2. 讀完後報告「上次 Session 結束點」和「建議下一步」
3. **永遠先問「我接下來要做什麼？」**，不要自行假設任務
4. 如果是新 session 且上次任務未完成，從 MEMORY.md 記載的斷點繼續

## 二、結束規則（每次 Session 結束時）

1. 輸出更新後的 MEMORY.md 內容（至少更新「上次 Session 結束點」段落）
2. 列出本次 session 完成的項目
3. 列出下次 session 的建議起點

## 三、絕對禁止（違反 = 立即停止）

1. ❌ 不動 `apps/web/` 目錄 — 現有 prototype 保留原樣
2. ❌ 不用任何 prohibited vocabulary（見 ANTIGRAVITY.md Section 2）
3. ❌ 不提供醫療診斷、金融建議、交易信號
4. ❌ 不將 raw biometric data 上傳至雲端
5. ❌ 不改星塵動效的視覺「感覺」— 重建時保持 v25.8.2 體驗
6. ❌ 不用 `any` type — 用 `unknown` + type guard
7. ❌ 不自行決定架構級變更 — 必須先跟 Founder 確認
8. ❌ 不使用已廢棄概念（TEI PR99、舊 FDCB 語意、trading 導向語言）
9. ❌ 不在通知中使用 action-oriented 或 advice 語言
10. ❌ 不將隱私控制、export、deletion 放在付費牆後

## 四、代碼標準

### 4.1 TypeScript
- `strict: true` 全開
- 不允許 `any`，用 `unknown` + type guard
- 所有 magic number 必須命名為常數並導出
- 每個 function 必須有 JSDoc（包含 @param 和 @returns）

### 4.2 命名規範
- Components: `PascalCase.tsx`（例：`FloatingBar.tsx`）
- Hooks: `useCamelCase.ts`（例：`useEdgeDetector.ts`）
- Utils/Engine: `camelCase.ts`（例：`edge-score.ts`）
- Tests: `*.test.ts`（與 source 同目錄層級）
- Constants: `SCREAMING_SNAKE`（例：`EDGE_WEIGHTS`）
- Config objects: `camelCase`

### 4.3 Package 命名（v3 定案）
- `packages/engine/` — 核心引擎（含 legacy/ 子目錄）
- `packages/scan/` — 手指掃描 pipeline（原 packages/fdcb/）
- `packages/shared/` — 跨端共用
- `domain/` — Domain models, policies, schemas（原 core/ 的新替代）

### 4.4 測試
- engine/ 覆蓋率 ≥ 90%
- scan/ 覆蓋率 ≥ 90%
- UI components 覆蓋率 ≥ 70%
- 必須測試邊界條件（空陣列、零值、極端值）
- Edge Score 一致性測試用隨機擾動分布，不用同樣輸入重複跑
- Compliance engine 語言攔截測試：所有 prohibited 詞彙

### 4.5 Git
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Branch: `main`（production）, `dev`（development）, `feat/*`（features）

## 五、狀態管理
- **Zustand** — 全域狀態（scan, user, subscription, session）
- **React Query** — 伺服器狀態（minimal cloud data）
- **Local state** — 純 UI 狀態

## 六、設計原則

1. **品質差時降級，不輸出假數字** — 品質不足時明確提示
2. **Local-first** — raw biometrics、reflections、baseline 永遠留在裝置端
3. **Explain before ask** — 每個權限請求前先教育使用者
4. **Safe wording** — 所有 user-facing copy 通過 Compliance Layer
5. **Feature flags** — 未成熟功能由 flag 控制，不暴露給 reviewer
6. **Confidence transparency** — 低信心時用更軟的語言
7. **Process, not advice** — 治理決策流程，不提供決策建議

## 七、App Store 合規

1. 所有 push notification 經 Compliance Layer template 化
2. Trader mode 在 App Store metadata 中不作為核心賣點
3. Camera scan 定義為 "on-device readiness scan"，不用醫療用語
4. IAP 清楚標示功能邊界
5. Review notes 提供 demo mode、sample data、fixed reviewer path
6. Privacy labels 準確反映實際 SDK 行為

## 八、文件層級

```
ANTIGRAVITY.md v3  ← 最高權威（專案 spec + 架構）
RULES.md v3        ← 硬性規則（不可被 AI 覆蓋）
MEMORY.md          ← AI 學習筆記（可被 AI 更新，人類可隨時修改）
```

如果三份文件有衝突，優先級：**ANTIGRAVITY.md > RULES.md > MEMORY.md**

---

*Created: 2026-04-07*
*Supersedes: RULES.md v2 (2026-02-28)*
*Maintained by: Poshen (Founder)*
*AI 不可修改此檔案，只有 Founder 有權修改。*
*Founder 確認後，此文件應覆蓋 RULES.md。*
