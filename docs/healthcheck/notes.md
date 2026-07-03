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

## 死路 / 意外發現

- （隨做補）

## sub-agent 結果摘要

### Agent A（合規掃描，sonnet）— 已回
- **Rule 3 Animated：最大發現** — `react-native-reanimated` 完全不在 apps/mobile 依賴裡；20 檔 / 244 處 `Animated.*` 全是 legacy RN Animated；`GlowPrimaryButton.tsx` JSDoc 自書「Pure RN Animated — no Skia/Reanimated」。對照 MEMORY 2026-06-10：這是 mock 階段刻意決策（INTEGRATION 標記等原生階段升級）→ 屬「規則寫的是目標態、現實是過渡態」的規則-現實脫節，不是偷懶違規。需要裁決（見 decisions.md）。
- **Rule 1 TEI：packages/scan/src 有活的違規** — 匯出常數 `TEI_BUCKET_BOUNDARIES`、公開函式 `getTeiBucket()`、session 欄位 `teiAtStart/End/Event`（types/events/constants/analytics + 3 個測試檔）；`packages/engine/__tests__/tei.test.ts` 在 src 白名單外；`apps/preview/v6/` 整套 `.tl-tei` / `tlTlTlTeiScore` 原型殘留（~90 行）+ stardust-scan-takeover.{js,css} 5 處。domain/ 與 apps/mobile 乾淨。
- **Rule 4 SVG**：一處 — `PrecisionArc.web.tsx:38` 用 raw `<svg>` 畫環（web 平台 fallback）。
- **Rule 2 any / Rule 5 Redux / Rule 6 隱私網路呼叫：全乾淨**（engine/scan/mobile 零網路 primitive — local-first 承諾成立）。
