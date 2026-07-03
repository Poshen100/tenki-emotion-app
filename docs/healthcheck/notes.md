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

## 死路 / 意外發現

- （隨做補）

## sub-agent 結果摘要

- （回來後補）
