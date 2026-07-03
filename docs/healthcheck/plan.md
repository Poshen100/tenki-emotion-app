# plan.md — 健檢修復執行計畫（2026-07-03）

> **給執行者（任何模型）**：每步 = 一個 commit（`<type>(<scope>): <描述>`）。步與步獨立，可跨 session 分批做；標 **[待 founder 拍板]** 的沒有同意不准動。每步做完跑該步「驗收」，全部完成跑 `npm run verify`。改 `apps/preview/**` 的步驟 CI 驗不到 — 一律請 founder 手機實走。
> **進度（2026-07-03）**：Phase 1 全部完成；2.5、4.2 已拍板完成；D5 已裁決（保留+掛牌）。剩：2.1–2.4、Phase 3 全部、4.1、4.3。
> 執行前重讀：`CLAUDE.md`、`docs/PLAYBOOK.md` §1/§6、本目錄 `decisions.md`（每步的 why 在那裡）。

## Phase 1 — P0 紅線（半天內可完成，全部雲端可做）

### 1.1 ✅ 完成（b451f81）— 刪 vite 死設定與違規文案（decisions.md D3 前半）
- 刪檔：`vite.config.js`、`dev-dist/`（整目錄）。
- `package.json` devDependencies 移除 `vite`、`vite-plugin-pwa`；跑 `npm install` 更新 lockfile。
- **驗收**：`grep -ri "bio-risk\|pro traders" . --exclude-dir=node_modules --exclude-dir=.git` 零命中；`npm run verify` 綠。

### 1.2 ✅ 完成（da00d0c，待 founder 手機驗色）— 修 scan-result.css 廢棄 zone 色（REPORT P0-2）
- `apps/preview/scan-result.css:25-27`：`--zone-neutral: #E5E5EA` → `#64748B`；`--zone-strain: #5E3A87` → `#C2703D`（clear 已正確）。只改這兩值，不動其他。
- **驗收**：`node --check` 無關（純 CSS）；grep 該檔無 `#E5E5EA`/`#5E3A87`；**founder 手機看 `/preview/scan-result.html`** 三 zone 色正確。

### 1.3 ✅ 完成（10fa4ef）— 給兩份 TEI 文件加橫幅（REPORT P0-3）
- `docs/TEI-SPEC.md`、`docs/progressive-tei-api.md` 檔案最頂加（沿用 RULES.md 的格式）：
  ```markdown
  > ⛔ **SUPERSEDED — DO NOT FOLLOW THIS FILE.**
  > TEI/PR99 是 v2 已廢棄並禁用的概念（見 CLAUDE.md 禁止事項）。現行 spec：Edge Score，見 `packages/engine/src/scoring/`。保留僅供考古。
  ```
- **驗收**：兩檔第一行可見 ⛔；`npm run verify` 綠。

## Phase 2 — P1 gate 完整性（各步獨立）

### 2.1 biome 排除 coverage（REPORT P1-1）
- `biome.json` 的 `files.includes` 陣列加一項：`"!**/coverage"`。⚠️ biome.json 不能寫註解（PLAYBOOK §5）。
- **驗收**：`cd packages/engine && npx jest --coverage --silent && cd ../.. && npm run lint` 綠；然後 `rm -rf packages/engine/coverage` 清理。

### 2.2 engine 覆蓋率補到 ≥90%（REPORT P1-2）
- 對 `packages/engine/src/biometric/rr.ts`（現 25%）補單元測試：先讀該檔，對每個 export 的正常路徑 + 邊界（空輸入、極值）寫案例，放 `packages/engine/src/biometric/__tests__/rr.test.ts`（若該路徑慣例不同，跟隨鄰近測試檔的位置慣例）。
- **驗收**：`cd packages/engine && npx jest --coverage --silent` 總 Stmts ≥ 90%；清理 coverage 目錄。

### 2.3 部署文件三處同步（REPORT P1-5）
- `docs/DEPLOYMENT_MAP.json`：`/` 條目改為 redirect→`/story/`（對照 .md 的寫法）；補 `/brand/*` 條目。
- `docs/DEPLOYMENT_MAP.md`：補 `/brand/*` 一列；檔頭加「⚠️ 改本檔必須同步 DEPLOYMENT_MAP.json」。.json 檔內（若格式允許）加同樣提醒欄位。
- `CLAUDE.md:170` 那一行改為：「根網址 `/` 會 307 redirect 到 `/story/`（#152 起）；`/v3/` 看最新 v3 UI、`/preview/` 看 onboarding」。
- **驗收**：對照 `vercel.json` 逐路徑檢查兩份地圖一致；`npm run verify` 綠。

### 2.4 品牌文件收斂（REPORT P1-6 + P2-6，decisions.md D7）
- 給根 `BRAND.md`、`docs/BRAND.md`、`DEPLOYMENTS.md`、`TENKI-ULTRA-SPEC.md` 加 SUPERSEDED/HISTORICAL 橫幅，指向現行 canonical（品牌語言 → `docs/brand.md` + `SYSTEM.md`；部署 → `docs/DEPLOYMENT_MAP.md`；Ultra spec → 標 HISTORICAL 無現行對應）。內容全保留。
- **驗收**：`grep -l "Canonical" BRAND.md docs/BRAND.md` 兩檔第一屏都有 ⛔/⚠️ 橫幅；PLAYBOOK §0 的過時清單同步加上這幾檔。

### 2.5 ✅ 完成（a20d0da，founder 已拍板）— CLAUDE.md Reanimated 規則措辭修正（decisions.md D1）
- 禁止事項表「用 legacy Animated」一列的說明改為：「目標 Reanimated 3；現有 core-RN Animated 是 mock 階段已知過渡債（等原生整合一併遷移），**不得新增**新的 legacy Animated 元件」。
- **驗收**：founder 看過措辭 OK；`npm run verify` 綠。

## Phase 3 — TEI 退場（decisions.md D2，逐級做、每級一 commit）

### 3.1 級①：刪檢疫區外死代碼
- 刪 `packages/engine/src/tei.ts` + `packages/engine/__tests__/tei.test.ts`（證據：src/tei.ts 僅被該測試引用；`legacy/index.ts:4` 用的是 `legacy/tei.ts` 副本）。
- **驗收**：`npx tsc --noEmit -p packages/engine` 0 error；root `npm test` 全綠（少一個 suite 是預期）。

### 3.2 級②：legacy-only 檔案搬進檢疫區 **[建議，可跳過]**
- 先驗證：`grep -rn "from './ewma'\|from '../ewma'" packages/engine/src --include='*.ts' | grep -v legacy` 應只剩 legacy 引用 — 對 `ewma.ts`、`hrv.ts`、`sqi.ts`、`stress.ts` 逐檔重複此驗證，**只搬驗證通過的檔**，同步改 `legacy/index.ts` 的 import 路徑。⚠️ `types.ts`、`baseline.ts`、`rr.ts`、`fusion.ts` 被 active v3 引用，**不搬**。
- **驗收**：engine tsc + 測試全綠。

### 3.3 級③：scan 套件 TEI 識別字改名
- 先盤點消費者：`grep -rn "TEI_BUCKET_BOUNDARIES\|getTeiBucket\|teiAtStart\|teiAtEnd\|teiAtEvent" --include='*.ts' packages domain apps/mobile`（預期只在 packages/scan 內 + 測試）。
- 改名對照：`TEI_BUCKET_BOUNDARIES`→`EDGE_BUCKET_BOUNDARIES`、`getTeiBucket`→`getEdgeBucket`、`teiAtStart/End/Event`→`edgeScoreAtStart/End/Event`；JSDoc 內 "TEI PR99" 措辭同步改 "Edge Score"。測試檔同步。
- **驗收**：`bash scripts/check-vocab.sh` 乾淨 + 全量 grep `\bTEI\b` 在 packages/scan 零命中；scan 111+ 測試全綠。

### 3.4 級④：preview v6 `tlTlTlTeiScore` 命名債 **[排最後，可延期]**
- `apps/preview/v6/index.html`（~90 行）+ `stardust-scan-takeover.{js,css}` 5 處：`tlTlTlTeiScore*`→`edgeScoreReveal*`、`.tl-tei*`→`.tl-edge*`、`.tei-secured`→`.edge-secured`。⚠️ id/class 是 JS-CSS-HTML 三方契約，用全案 grep 逐一替換，別漏 querySelector 字串。
- **驗收**：`node --check` 過每個改動 js；grep 該三檔 `tei` 零命中（大小寫敏感）；**founder 手機實走 `/v3/` 揭曉流程**（CI 盲區）。

## Phase 4 — 整潔（各步獨立）

### 4.1 mobile 孤兒清理（decisions.md D4）
- 刪：`apps/mobile/components/QualityMeter.tsx`、`ReadinessChecklist.tsx`、`StatusPill.tsx`、`apps/mobile/lib/mock-scan.ts`。刪前最後驗證：對每檔 `grep -rn "<basename>" apps/mobile --include='*.ts*' | grep -v node_modules` 只剩自身。
- 掛牌（檔頭 JSDoc 加一行 `DORMANT: awaiting native wiring — see MEMORY.md <日期條目>，勿當孤兒刪`）：`stores/pulse-profile-store.ts`、`features/finger-precision/utils/{qualityGates,precisionProgress,recoveryClassifier,confidence}.ts`、`app/face-baseline/recovery.tsx`。
- **驗收**：`cd apps/mobile && npx tsc --noEmit && npm test` 全綠。

### 4.2 ✅ 完成（b451f81，founder 已拍板，與 1.1 同 commit）— 根目錄考古層刪除（decisions.md D3 後半）
- 拍板後刪：`src/`、`ui/`、`tests/`、`integration/`、`templates/` 五目錄（git 可復原）。
- **驗收**：`npm run verify` 綠；`vercel.json`/`package.json` 無殘留引用（本來就沒有，再確認一次）。

### 4.3 maturityStage 掛牌（decisions.md D6）
- `apps/mobile/features/face-baseline/utils/maturityStage.ts` 檔頭 JSDoc 補：「Mirror of engine BASELINE_THRESHOLDS (1/5/15) — keep in sync. ⚠️ Simplification: engine canonical additionally requires ≥3 distinct days for 'mature' (BASELINE_THRESHOLDS.MATURE_DAYS); this mirror gates on scan count only. Wire distinct-days when scan history is persisted (native phase).」
- **驗收**：mobile tsc + 測試綠（純註解）。

## 完成定義（整個計畫）
- `npm run verify` 全綠 + `bash scripts/check-vocab.sh` 全量乾淨。
- REPORT.md 的每個 P0/P1 項有對應 commit 或明確的 [待拍板] 狀態。
- preview 相關步驟有 founder 手機實走回報。
- MEMORY.md 最上方新增執行紀錄條目。
