# TENKI CORE v3.0 — AI Development Strategy

> 📌 此檔案是專案的 source of truth。每次糾正 AI 後都要回頭更新這份文件 — 否則下個 session 的 AI 會重犯同樣的錯。
> Compound learning rule: correction → update CLAUDE.md → next session avoids the same mistake.

## 產品定位
**TENKI CORE 是 privacy-first cognitive wellness app**，不是 trading app。輸出是 readiness/clarity 訊號，不是交易建議。

- **核心指標**：Decision Edge Score (0-100)
- **3 Zone**：Clear (70-100) / Neutral (40-69) / Strain (0-39)
- **2 Tier**：Free / Premium
- **資料策略**：Local-first + Cloud-minimal（raw biometric 不上雲）

## 🚫 禁止事項（v3 hard rules）

| ✗ 不要做 | 為什麼 |
|---------|--------|
| 使用 TEI / PR99 / PEAK / OPTIMAL / 4 zone / 3 tier | v2 已廢棄詞彙，會引起架構混淆 |
| 修改 `apps/web/` 任何檔案 | Web prototype 已凍結，新功能走 `apps/mobile/` |
| TypeScript 用 `any` | strict mode，違反就壞鏈 |
| 給醫療診斷或金融建議的措辭 | App Store compliance / 法律風險 |
| 把 raw biometric data 上傳雲端 | Privacy-first 核心承諾 |
| 把隱私控制放在付費牆後 | v3 規範 |
| 用 SVG 畫環形圖 | 用 Skia |
| 用 legacy `Animated` | 用 Reanimated 3 |
| 用 Redux | 用 Zustand |
| 累積多個 Todo 才 commit | 違反 Commit-Per-Todo |

## Monorepo 架構

```
tenki-emotion-app/
├── packages/engine/      Edge Score 引擎 (scoring, session, baseline, compliance, analytics)
├── packages/scan/        FHZ scan pipeline (原 fdcb 已改名)
├── packages/shared/      design-tokens, zone-config, subscription-tiers, feature-flags
├── domain/               Domain models, contracts, policies, schemas
├── apps/mobile/          Expo / React Native app — Phase C 主戰場
├── apps/preview/         瀏覽器驗證 UI（給 founder 看流程）
├── apps/web/             🔒 Web prototype（凍結，不可修改）
├── core/                 Legacy vanilla JS IIFE 模組（v2，僅作參考）
├── CLAUDE.md             📌 AI 開發策略（本檔）
├── MEMORY.md             📌 Session 記憶與決策紀錄
└── ANTIGRAVITY.md        📌 Antigravity AI workflow rules
```

新代碼一律進 `packages/` / `domain/` / `apps/mobile/`。**不要動 `apps/web/` 或 `core/`。**

## 核心模組（v3 active）

| 模組 | 位置 | 職責 |
|------|------|------|
| Edge Score | `packages/engine/src/scoring/` | 8 維度加權正規化 → 0-100 |
| Session Governance | `packages/engine/src/session/` | modes + templates + timer + gate + violations |
| Baseline | `packages/engine/src/baseline/` | signal-quality-gate + bootstrap (Welford) |
| Compliance | `packages/engine/src/compliance/` | user-facing copy 審查 |
| FHZ Scan | `packages/scan/src/` | Finger Heat Zone 掃描 pipeline |
| Zone Config | `packages/shared/src/zone-config.ts` | 3 zone 閾值 |
| Tiers | `packages/shared/src/subscription-tiers.ts` | Free / Premium gating |
| Feature Flags | `packages/shared/src/feature-flags/` | Dark launch 控制 |
| Contracts | `domain/src/contracts/` | 跨層型別合約 |
| Policies | `domain/src/policies/` | 商業規則 |

## Dev Strategy

### ✅ Plan Mode 優先
任何超過單檔修改的任務先寫 plan，再開工。Plan 對應到 Todo list，Todo 對應到 commit。

### ✅ Commit Per Todo（強制）
> **每個 Plan 裡的 Todo = 一個 Git Commit**

格式：
```
<type>(<scope>): <todo描述>

例：
feat(engine): add 8-dimension Edge Score normalizer
fix(scan): stabilize finger detection on low-light iOS
test(baseline): cover Welford zero-variance edge case
refactor(session): extract timer segment logic
```

規則：
1. 完成一個 Todo → 立即 `git add` + `git commit`
2. 不要累積多個 Todo 才 commit
3. commit message 對應 plan 裡的原文 Todo
4. 翻 log 就能精確找到哪個 Todo 引入 Bug

### ✅ Feedback Loop
- 先寫測試，再做整合
- 跑 benchmark 驗證效能目標
- engine/ 與 scan/ 測試覆蓋率 ≥ 90%

### ✅ 持續更新 CLAUDE.md（最核心）
這份文件是複利工具：
- 被糾正一次 → 寫進這裡 → 下次不再犯
- 架構變動 → 立刻更新 Module 表
- 廢棄詞彙 → 加進「禁止事項」

## 工作流指令

| 指令 | 作用 |
|------|------|
| `npx vitest run` | 跑所有測試（必須全綠才 merge） |
| `npx tsc --noEmit` | TypeScript 零錯誤檢查 |
| `npx vitest run tests/benchmark` | 效能 benchmark |
| `cd apps/mobile && npm start` | 啟動 Expo dev server |

## TypeScript 標準
- `strict: true`，禁用 `any`
- 常數要 export 且具名
- 每個 public function 寫 JSDoc
- 用 Zustand 管狀態

## 動畫 / 視覺
- Reanimated 3（禁用 legacy Animated）
- Skia 畫環形圖（禁用 SVG ring）
- EWMA α=0.05 極慢收斂
- 星塵動效「感覺」不能改，保持 v25.8.2 視覺體驗

## 語言慣例
- 對話 / commit message / 文件：繁體中文 OK
- 程式碼識別字、API、JSDoc：英文
- User-facing copy：經 Compliance Layer 審查，禁用醫療/金融語言

## AI 工具分工

| 工具 | 角色 |
|------|------|
| Antigravity (Opus 4.6 / Gemini 3.1 Pro) | 主力代碼生成 + 架構 |
| Claude (claude.ai) | 架構決策、code review、文件 |
| Claude Code | Terminal 任務、Expo init、Native Module（待 Mac 到手） |

## Session 結束時
更新 `MEMORY.md` 記錄：本次做了什麼、遇到的坑、下次接手點。
若有任何「我這次糾正了 AI，但 CLAUDE.md 沒寫」的情況 → 補進本檔。
