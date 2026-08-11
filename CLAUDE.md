# TENKI CORE v3.0 — AI Development Strategy

> 📌 此檔案是專案的 source of truth。每次糾正 AI 後都要回頭更新這份文件 — 否則下個 session 的 AI 會重犯同樣的錯。
> Compound learning rule: correction → update CLAUDE.md → next session avoids the same mistake.

## 產品定位
**TENKI CORE 是 privacy-first cognitive wellness app**，不是 trading app。輸出是 readiness/clarity 訊號，不是交易建議。

也可定義為：**Decision Infrastructure / Human State Calibration System**。對外溝通與 AI 協作的完整語言系統
（Emotional Radar / Baseline / Calibration / Turning Point）定義在 `SYSTEM.md`（所有 AI 必讀）與
`docs/brand.md`（內部語言系統，含 dopamine state 內部模型，禁止外流到 user-facing copy）。任何 AI 描述本產品時，
**不要**用 "trading tool" / "signal system" / "meditation app"。

- **核心指標**：Decision Edge Score (0-100)
- **掃描主入口**：Soul Scan（臉部基線）— 方向定調見 `docs/SOUL-SCAN-NORTH-STAR.md`（必讀）；finger PPG 退為校準/補強層，不要把臉部流程塞進 `(tabs)/scan.tsx`
- **3 Zone**：Clear (70-100) / Neutral (40-69) / Strain (0-39)
  - ⚠️ 長期方向是改用 Baseline 語言（Above/At/Below Baseline），但 mapping 尚未定案（Strain 對應「過度刺激」還是
    「耗竭」不明確），**不要**自行猜測重新命名 `zone-config.ts` / `EdgeZone`。詳見 `docs/brand.md` § 7 Naming Migration。
- **2 Tier**：Free / Premium
- **資料策略**：Local-first + Cloud-minimal（raw biometric 不上雲）

## 文件優先序與陷阱手冊

- **文件互相矛盾時的裁決順序**定義在 `docs/PLAYBOOK.md` §0（本檔 > SYSTEM.md > PLAYBOOK > MEMORY.md 最上條 > 領域文件 > ANTIGRAVITY.md 本文）。`AI_INSTRUCTIONS.md`、`RULES.md`、`task.md` 已過時，不得遵循。
- **`docs/PLAYBOOK.md` 是已知陷阱手冊**（歷次 session 教訓的蒸餾版）：動工前按其 §1 路由表找到任務類型；遇到怪症狀先 grep 它再 debug。MEMORY.md 是日誌、PLAYBOOK 是法典。

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
| **新增** legacy `Animated` 用法 | 動畫目標是 Reanimated 3。現有 core-RN Animated（20 檔）是 mock 階段已知過渡債（`INTEGRATION` 標記，原生整合階段一併遷移，2026-07-03 拍板）— 舊的先不動，但不得再寫新的 |
| 用 Redux | 用 Zustand |
| 累積多個 Todo 才 commit | 違反 Commit-Per-Todo |
| 把產品框定為 "trading tool" / "signal system" / "meditation app" | 違反 `SYSTEM.md` 核心定位（Decision Infrastructure / Human State Calibration System） |
| 把 `docs/brand.md` 內部 dopamine/withdrawal/craving 措辭用在 user-facing copy | 違反 compliance 規則，見 `docs/brand.md` § 5 |

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
├── CLAUDE.md             📌 AI 開發策略（本檔，Claude Code 硬規則）
├── SYSTEM.md             📌 跨 AI 產品定位與語言系統（所有 AI 協作者必讀）
├── docs/PLAYBOOK.md      📌 已知陷阱手冊 + 文件優先序（動工前查）
├── scripts/verify.sh     📌 一鍵 merge gate（npm run verify）
├── docs/brand.md         📌 內部品牌語言系統全文（含 dopamine 內部模型）
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

### ✅ Karpathy 四大黃金原則（所有寫 code 任務的底層心法）
> 完整版見 `.claude/skills/karpathy-engineering/SKILL.md`（Claude Code 會自動套用；其他 AI 請手動閱讀）。

1. **Think Before Coding** — 動手前先講清楚假設；需求模糊就問用戶，不盲猜。
2. **Simplicity First** — 只寫解當前問題的最少 code；不過度抽象、不亂加依賴。
3. **Surgical Changes** — 只動該改的地方，修 bug 不順手重構/改格式。
4. **Goal-Driven Execution** — 把任務轉成可驗證目標；修 bug 先寫複現測試再改到綠。

衝突時本檔（CLAUDE.md）的硬規則優先。

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
- ⚠️ 更新規則文件的權限分級（誰可自行改、什麼要先問 founder）與精簡協議見 `.cursor/harness/05_maintenance.md`；本檔硬規則屬 🔴 級 — AI 不得未經 founder 同意修改

## 工作流指令

| 指令 | 作用 |
|------|------|
| `npm run verify` | **一鍵跑完整個 merge gate**（lint + 4 套件 tsc + root/mobile 測試 + preview 語法 + 禁用詞彙）。沒有它的綠燈不算完成；`--quick` 可跳過 mobile |
| `npm test` | 跑 packages + domain 所有測試（Jest，必須全綠才 merge） |
| `cd apps/mobile && npm test` | 跑 mobile 測試（apps/mobile 不在 root workspaces，要分開跑） |
| `npm run lint` | Biome lint（0 errors 才 merge；formatter 未啟用） |
| `npx tsc --noEmit -p <pkg>` | TypeScript 零錯誤檢查（engine / scan / shared / domain 各自跑） |
| `cd apps/mobile && npx tsc --noEmit` | Mobile TypeScript 檢查 |
| `cd apps/mobile && npm start` | 啟動 Expo dev server |

> ⚠️ 測試框架是 **Jest + ts-jest**，不是 vitest（舊文件寫錯已糾正，root 的 vitest 設定已移除）。
> CI：`.github/workflows/ci.yml` 會在 PR 與 push main 時自動跑 lint + typecheck + 全部測試。

## TypeScript 標準
- `strict: true`，禁用 `any`
- 常數要 export 且具名
- 每個 public function 寫 JSDoc
- 用 Zustand 管狀態

## 動畫 / 視覺
- **任何動效先讀 `docs/MOTION-DIRECTION.md`**（動效語言 canonical：tokens、四大語彙、每 surface 引擎、GSAP skill 包路由）
- Reanimated 3 是目標態（新動畫不得用 legacy Animated；既有 core-RN Animated 屬過渡債，原生階段遷移）
- Skia 畫環形圖（禁用 SVG ring）
- EWMA α=0.05 極慢收斂
- 星塵動效「感覺」不能改，保持 v25.8.2 視覺體驗
  - ⚠️ **例外（founder 2026-08-10 兩次授權，範圍就是這麼大，不得外推）**：
    **掃描期間**星塵可以隨實測值變化 —— 色彩（`setTone()`）與**收散**（`setReadout()`）。
    做法是旋轉整條 cyan→purple→pink 漸層並往當下的色收，**不換調色盤**；
    收散只調漂移倍率與整體尺度。⚠️ **粒子數量與 Fibonacci 分布、entrance
    仍然不在授權內**；其他頁面（story / soul-enroll / v6 takeover）也不在。
  - 🔴 **鎖定資產靠「預設值 = 恆等變換」這個結構性質守住，不是靠小心**：
    `setTone` / `setReadout` 沒被呼叫時完全 inert，沒呼叫的頁面逐位元組不變，
    而且 harness 直接驗那件事。新增任何會動到星塵的通道都要照這個做法。
  - 🔴 **訊號正規化成 0..1，不代表它會走遍 0..1** —— 動手前查真實分布。
    2026-08-10 實例：色調第一版吃 `browTension`（兩眉的解剖學距離比值），
    用力皺眉只讓色相動 **0.69°**，founder 實走一句「顏色好像沒變化？」。
    現在吃 `stillness`（每幀、真 0..1、**而且正是畫面要求使用者控制的那個量**）。
  - 🔴 顏色也會宣稱事實：`gold = SECURED`、`cyan = ACTIVE`（`docs/VISUAL-DIRECTION.md` §3）。
    **沒有讀數就不准上 gold** —— 跟文案同一條紅線。
  - 🔴 **產生新顏色之前，先問「這個顏色在這個產品裡是不是已經有主人」**。
    2026-08-10 實例：我擋住了自己要用的 gold，卻讓色相旋轉把 cyan 轉成綠 ——
    而 v6 的 `--good` 就是綠 `#34C759`，等於還沒有結果就亮起「good」。
  - 🔴 **但守的是「整顆球的主色」，不是每一顆粒子**（founder 2026-08-10 裁決）。
    星塵是大面積、流動的多色場，不是一顆訊號燈 —— 單顆粒子是綠的不會被讀成
    「good」。⚠️ 把每顆粒子都擋在語意色外面，會讓可用色域只剩青紫粉一小段弧，
    那正是 founder 連三次說「顏色變化很少」的根源。
    ⚠️ 新守則自己的陷阱：**色相散太開，整顆的平均色會趨近灰 —— 而灰就是
    `--zone-neutral`（Neutral 帶位色）**。`scripts/preview-scan-stardust.mjs`
    有一條主色 ΔE 掃描守著，改任何色彩上下限前先看它。
  - 🔴 顏色吃的是**量得到的東西**（landmark 幾何、位移穩定度、該次 band）。
    **不得宣稱偵測情緒**，也不得有任何 user-facing 文案往那個方向講。

## 語言慣例
- 對話 / commit message / 文件：繁體中文 OK
- 程式碼識別字、API、JSDoc：英文
- User-facing copy：經 Compliance Layer 審查，禁用醫療/金融語言

## AI 工具分工

| 工具 | 角色 |
|------|------|
| Antigravity (Opus 4.6 / Gemini 3.1 Pro) | 桌機主力：功能與畫面實作（`feat/*` 分支） |
| Claude (claude.ai) | 架構決策、code review、文件 |
| Claude Code | 雲端/手機：repo 改進、補邏輯、開 PR、CI & 驗證收尾（Native Module 待 Mac 到手） |

## 部署與手機檢視（詳見 docs/DEPLOYMENT_MAP.md 白話版）

- **固定網址只反映 `main`**：`/v3/` 看最新 v3 UI、`/preview/` 看 onboarding；根網址 `/` 會 307 redirect 到 `/story/`（#152 起，Hero 正式門面）。
- 想在手機瀏覽器看到的東西做在 `apps/preview/`；`apps/mobile` 沒有公開網址，不要編造 Expo/TestFlight 連結。
- merge 前預覽：GitHub PR 頁的 Vercel bot 留言有分支 preview 連結。
  **推了 preview 改動就必須主動附上可直接點的實走網址**（含路徑，founder 2026-08-07 指示）——
  沒附等於沒做完。取得法與備援（`list_deployments` 的 `meta.branchAlias`）見 `docs/PLAYBOOK.md` §4。
- 新增 route 時要同步更新 `docs/DEPLOYMENT_MAP.md` + `.json`。

## Session 結束時
更新 `MEMORY.md` 記錄：本次做了什麼、遇到的坑、下次接手點。
規則（見 MEMORY.md 頂部協議）：**新條目一律加在檔案最上方**；同類教訓第二次出現 → 提煉成 `docs/PLAYBOOK.md` 一條「情境 → 規則」。
若有任何「我這次糾正了 AI，但 CLAUDE.md 沒寫」的情況 → 補進本檔。
