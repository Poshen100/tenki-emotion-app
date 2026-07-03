# notes.md — 2026-07-03 健檢工作筆記（隨做隨寫）

> 規則：只記有 tool 結果佐證的事；未驗證的標「未驗證」。
> 分工：4 個 sub-agent（合規掃描 sonnet / 重複漂移 sonnet / 覆蓋率 haiku / 孤兒路由 sonnet）跑機械掃描；本體只做架構判讀。

## 本體驗證的發現（時序）

1. **vercel.json redirects vs rewrites**：`redirects` 有 `/ → /story/`（#152），`rewrites` 仍留 `/ → /apps/web/index.html`。Vercel redirects 先於 rewrites 生效 → 根網址實際進 /story/，`/` 的 rewrite 是死設定（`/(.*) → apps/web` catch-all 仍活著，服務散路徑）。非 bug，但是混淆點。
2. **CLAUDE.md:170 已過時**：「根網址 `/` 是凍結舊版不會更新」— 與 #152 後的現實矛盾（/ 已 redirect 到 /story/）。→ 需修一行。
3. **vite.config.js 是 v1 殘留 + 合規地雷**：PWA manifest `description: 'Bio-Risk SaaS for Pro Traders'` = 被禁的 trading 定位原文。build input 指向根 `index.html`（根目錄無此檔 → build 必失敗 = 死設定）。runtime 無影響（Vercel 是純靜態 rewrites，不跑 vite build），但字串本身是品牌/合規髒點。
4. **root tests/ 不被任何 runner 跑**：root `npm test` 只跑 workspaces（packages/* + domain）；tests/ 裡是 v2 檔（progressive-tei.test.js 等）→ 死測試。
5. **dev-dist/ 是 committed build 產物**（sw.js/workbox）→ repo 垃圾。
6. **tsconfig 健康**：strict 全開、四套件繼承 base；engine/scan 的 `tsc -p` exclude 掉 `*.test.ts`（測試型檢靠 ts-jest，可接受）。packages/shared/tsconfig 有註解（tsc 吃 JSONC，OK — 別學到 biome.json 上，那個不行）。
7. **biome.json**：includes 只含 packages/domain/apps/mobile，排除 packages/shared/src/components（reference-only stardust）— 與 PLAYBOOK 認知一致。

8. **engine 的 v2/v3 邊界不乾淨（退場計畫的關鍵輸入）**：import 追蹤結果 —
   - 只被 `legacy/index.ts` 引用（安全退場層）：`tei.ts`、`ewma.ts`、`hrv.ts`、`sqi.ts`、`stress.ts`
   - **被 active v3 代碼引用（不能直接刪）**：`types.ts` ←（pipeline/scan-pipeline、progressive-pipeline、fusion）；`baseline.ts` ←（baseline/bootstrap、multi-modal-blend）；`rr.ts` ←（biometric/finger-ppg）；`fusion.ts` ←（pipeline/*）
   - barrel `index.ts` 宣稱 v3-only，但 export `teiToEdgeScoreApprox`（轉換 adapter，屬刻意過渡 API）。
   - 結論：TEI 退場要分兩級 — 先搬「legacy-only」五檔進 `legacy/`，再對 Tier 2 做「抽出 v3 仍在用的型別/函式 → 收殘殼」。

### Agent C（覆蓋率量測，haiku）— 已回
- **engine 89.02% stmts，差 0.98% 沒達 ≥90% 規則**；元兇 `src/biometric/rr.ts` 只有 25%（293 tests / 22 suites 全綠）。
- scan 93.91% ✓、shared 93.61、domain 84.56（無規則要求）、mobile 93.59（最低 `fingerPrecisionStore.ts` 70.73%）。
- ⚠️ agent 回報「verify lint 紅」→ 本體查證：是它自己跑 `jest --coverage` 產生的 `coverage/` 目錄被 Biome 掃到（20 個 errors 全來自 coverage/lcov-report/*.html）。**coverage/ 在 .gitignore:34，但 biome.json 未開 vcs 整合、includes 也沒排除** → 任何人跑 coverage 就弄破 lint gate。已 `rm -rf` 還原，lint 回 0 errors（71 warnings 非阻斷）。→ 修法一行：biome includes 加 `"!**/coverage"`。
- 教訓（agent 使用）：便宜模型的異常回報要本體覆核 — 它把自己污染環境的結果當成 repo 現況回報了。

### Agent D（孤兒與路由，sonnet）— 已回
- **高信心孤兒（零引用，可刪）**：`components/QualityMeter.tsx`、`ReadinessChecklist.tsx`、`StatusPill.tsx`、`stores/pulse-profile-store.ts`、`lib/mock-scan.ts`（= 6/23 scan tab 重構的遺留）、face-baseline hooks `useFaceBaselineMachine.ts` + `useReducedMotion.ts`（barrel 從未被消費）、`GhostButton` export（檔案留著，`TextLink` 活躍）。
- **TEST-ONLY 群**：finger-precision utils 四檔（qualityGates/precisionProgress/recoveryClassifier/confidence）— 根因是 feature barrel `finger-precision/index.ts` 沒人 import（screen 走 deep path）。可能是等 multi-modal-blend 接線的預留 → 留 founder 裁決，勿自動刪。
- **不可達路由**：`face-baseline/recovery.tsx`（FaceDetectionRecoveryScreen 完整蓋好）— `FB_ROUTES.recovery` 零呼叫；等原生 face-lost 事件接線。留著，標記 dormant。
- **部署地圖漂移**：`docs/DEPLOYMENT_MAP.json` 停在 #152 之前（`/` 仍寫 apps/web，漏 /story/ redirect）— commit f21bcd2 只改了 .md 沒改 .json；頂層 `/brand/*` 路由兩份地圖都沒記；`baseline-3d.html`、`finger-demo.html` 是可直達的活頁但不在地圖（未驗證是否刻意內部 demo）。
- pulse-profile-store 孤兒 = 2026-06-14 TENKI Pulse 引擎做完但「最後一哩接線」一直沒做（MEMORY 有記，等 Mac）— 屬「預留」而非垃圾，決策歸 founder。

### Agent B（重複與漂移，sonnet）— 已回
- **鏡像好消息**：haptics 引擎↔mobile pulse.ts 逐值 IN-SYNC；zone 三色六檔全一致（design-tokens 單源機制運作中）。
- **maturityStage 語意缺口**：mobile 缺 engine 的 distinct-days(≥3天) mature 條件，且無 mirror 標記無 caveat（engine haptics 鏡像有自書，mobile 沒有）→ decisions.md D6。
- **兩處調色盤漂移**：scan-result.css 還是遷移前 neutral 近白/strain 紫（P0-2）；styles.css:2138 第二套 --tenki-accent-*（#c97b2f 金）被 v6 P2 流程消費 — 但此金色出自 founder 截圖（task.md Screen C），屬設計裁決非 bug → D5。
- **文件**：三檔自稱品牌 canonical；TEI-SPEC/progressive-tei-api 無橫幅（P0-3）；DEPLOYMENTS.md 被靜默取代；TENKI-ULTRA-SPEC 無主。
- **根目錄考古層**：src/ ui/ tests/ integration/ templates/ dev-dist/ 全零外部引用（tests↔integration↔core 只互相引用的封閉迴圈）；vite.config 死設定 + "Bio-Risk SaaS for Pro Traders" 文案（P0-1）。
- engine/src/tei.ts「零引用」宣稱與 Agent A 矛盾 → 本體裁決：`legacy/index.ts:4` 是 `export * from './tei'`（legacy 自己的副本），src/tei.ts 只被 `__tests__/tei.test.ts` 引用 = 檢疫區外死代碼。Agent B 對。

## 死路 / 意外發現

- 我最初的 import 追蹤 grep（`'\.\./tei'\|'./tei'`）有 pattern 歧義，把 legacy 內部引用誤讀成對 src/tei.ts 的引用 — 兩個 agent 矛盾時本體親跑指令才裁對。已提煉進 PLAYBOOK §9.5。
- haiku agent 把自己 `jest --coverage` 產生的 lint 紅回報成 repo 現況 — 已提煉進 PLAYBOOK §9.5。

## sub-agent 結果摘要

### Agent A（合規掃描，sonnet）— 已回
- **Rule 3 Animated：最大發現** — `react-native-reanimated` 完全不在 apps/mobile 依賴裡；20 檔 / 244 處 `Animated.*` 全是 legacy RN Animated；`GlowPrimaryButton.tsx` JSDoc 自書「Pure RN Animated — no Skia/Reanimated」。對照 MEMORY 2026-06-10：這是 mock 階段刻意決策（INTEGRATION 標記等原生階段升級）→ 屬「規則寫的是目標態、現實是過渡態」的規則-現實脫節，不是偷懶違規。需要裁決（見 decisions.md）。
- **Rule 1 TEI：packages/scan/src 有活的違規** — 匯出常數 `TEI_BUCKET_BOUNDARIES`、公開函式 `getTeiBucket()`、session 欄位 `teiAtStart/End/Event`（types/events/constants/analytics + 3 個測試檔）；`packages/engine/__tests__/tei.test.ts` 在 src 白名單外；`apps/preview/v6/` 整套 `.tl-tei` / `tlTlTlTeiScore` 原型殘留（~90 行）+ stardust-scan-takeover.{js,css} 5 處。domain/ 與 apps/mobile 乾淨。
- **Rule 4 SVG**：一處 — `PrecisionArc.web.tsx:38` 用 raw `<svg>` 畫環（web 平台 fallback）。
- **Rule 2 any / Rule 5 Redux / Rule 6 隱私網路呼叫：全乾淨**（engine/scan/mobile 零網路 primitive — local-first 承諾成立）。
