# TENKI CORE 全面健檢報告 — 2026-07-03

> **方法**：4 個並行 sub-agent 機械掃描（合規詞彙+API 違規 / 重複與漂移 / 覆蓋率量測 / 孤兒代碼與路由）+ 本體架構判讀與矛盾裁決。每條發現附證據（file:line 或指令輸出）與驗證方式。**本次為 audit-only：除本報告與交接文件外，未改任何產品代碼**。
> **相關文件**：裁決理由 → `decisions.md`；修復步驟 → `plan.md`；風險與未解 → `risks.md`；過程紀錄 → `notes.md`。

## 總體結論

體質**中上**：核心引擎/隱私/型別紀律非常乾淨（`any` 0、Redux 0、**生理數據網路呼叫 0 — local-first 承諾在代碼層成立**），測試量健康（root 505 + mobile 112 全綠）。主要病灶集中在四類：**①規則與現實脫節**（Reanimated 規則 vs 全 app 用 legacy Animated）、**②v2 殘留超出檢疫區**（scan 套件的 TEI 識別字、無警示的 TEI 文件）、**③品牌色多源漂移**（兩處 preview 調色盤未跟上收斂）、**④根目錄考古層**（6 個無主 legacy 目錄 + 帶違規文案的死設定檔）。

## P0 — 合規/品牌紅線（建議最先修）

| # | 發現 | 證據 | 驗證方式 |
|---|------|------|---------|
| P0-1 | **`vite.config.js` PWA manifest 寫著 `description: 'Bio-Risk SaaS for Pro Traders'`** — 被禁的 v1 trading 定位原文。該 config 已死（build input 指向不存在的根 `index.html`、無 npm script 呼叫 vite），但字串本身是品牌/合規髒點 | vite.config.js:13；根目錄無 index.html（ls 驗證） | 刪檔或改字後 grep 全 repo 無 "Bio-Risk"/"Pro Traders" |
| P0-2 | **`apps/preview/scan-result.css:25-27` 仍是遷移前 zone 調色盤**（neutral `#E5E5EA` 近白、strain `#5E3A87` 紫）— canonical 已是 slate `#64748B` / ember `#C2703D`。這是活頁面（scan-result.html 有連結），正在對外顯示錯誤 zone 色 | agent B 色彩比對表；design-tokens.ts:16-19 明文記載此為已廢棄配色 | 改 3 值後 founder 手機看 `/preview/scan-result.html`（CI 盲區） |
| P0-3 | **`docs/TEI-SPEC.md` 與 `docs/progressive-tei-api.md` 零警示橫幅** — 通篇 TEI/PEAK 詞彙的完整規格書，AI 冷讀會當成活規格（RULES.md 等同類檔已有 ⛔ 橫幅，獨漏這兩份） | agent B 文件盤點表：TEI-SPEC 12 處違規詞、無 banner | 加橫幅後冷讀第一屏可見 SUPERSEDED |

## P1 — 制度與 gate 完整性

| # | 發現 | 證據 | 驗證方式 |
|---|------|------|---------|
| P1-1 | **跑 `jest --coverage` 會弄破 lint gate**：`coverage/` 在 .gitignore:34，但 biome 未開 vcs 整合、includes 沒排除 → 產物被掃出 20+ errors（本次健檢實測踩中，已還原） | 本體實測：coverage 目錄存在時 `npm run lint` 紅、rm 後綠 | biome.json 加 `"!**/coverage"` 後重演 coverage→lint 仍綠 |
| P1-2 | **engine 覆蓋率 89.02% < 規則要求的 90%**；元兇 `src/biometric/rr.ts` 僅 25%（scan 93.91% ✓、mobile 93.59、shared 93.61、domain 84.56） | agent C 實測 jest --coverage | rr.ts 補測試後重測 ≥90% |
| P1-3 | **Reanimated 3 硬規則 vs 現實全面脫節**：`react-native-reanimated` 不在 mobile 依賴；20 檔 / 244 處用 legacy `Animated`；`GlowPrimaryButton.tsx:13` JSDoc 自書 "Pure RN Animated — no Skia/Reanimated"。追根：2026-06-10 mock 階段刻意決策（INTEGRATION 標記等原生升級），規則寫的是目標態 | agent A 全清單；MEMORY.md 2026-06-10 條目 | 見 decisions.md D1 — 規則措辭修正 + 原生階段遷移計畫 |
| P1-4 | **`packages/scan/src` 有活的 TEI 識別字**：匯出常數 `TEI_BUCKET_BOUNDARIES`、公開函式 `getTeiBucket()`、欄位 `teiAtStart/End/Event`（types/events/constants/analytics + 3 測試檔）；另 `engine/src/tei.ts` 是檢疫區外死代碼（僅被自己的 `__tests__/tei.test.ts` 引用 — 本體裁決確認，`legacy/index.ts:4` 用的是自己的副本 `./tei`） | agent A 清單 + 本體 grep 裁決 | 改名/刪除後 `scripts/check-vocab.sh` 對全量掃描（非 diff）乾淨 |
| P1-5 | **部署文件三處漂移**：`docs/DEPLOYMENT_MAP.json` 停在 #152 前（`/` 仍寫 apps/web，commit f21bcd2 只改了 .md）；`CLAUDE.md:170`「根網址 / 是凍結舊版」已與現實矛盾；頂層 `/brand/*` 路由兩份地圖都沒記 | agent D 路由比對表；本體讀 vercel.json 確認 redirects 先於 rewrites | 三檔修正後與 vercel.json 逐路徑比對一致 |
| P1-6 | **三份文件同時自稱品牌 canonical**：根 `BRAND.md`、`docs/BRAND.md`（還自訂與 PLAYBOOK §0 矛盾的優先序）、`docs/brand.md`（真 canonical）。前兩份無 superseded 橫幅 | agent B 文件盤點 | 加橫幅後只剩 docs/brand.md 自稱 canonical |

## P2 — 整潔與技術債

| # | 發現 | 證據 |
|---|------|------|
| P2-1 | **根目錄 6 個無主 legacy 目錄**：`src/`（4 檔，零引用）、`ui/`（12 檔，零引用）、`tests/`（7 檔，不被任何 runner 跑）、`integration/`（7 檔，僅被死 tests/ 引用）、`templates/`（4 檔，零引用）、`dev-dist/`（3 檔 build 產物）— 形成只互相引用的封閉迴圈，全部不在 CLAUDE.md 架構圖上（`core/` 是唯一有文件記載的凍結區） | agent B 目錄盤點 + 引用追蹤 |
| P2-2 | **mobile 高信心孤兒**：`components/QualityMeter.tsx`、`ReadinessChecklist.tsx`、`StatusPill.tsx`、`lib/mock-scan.ts`（6/23 重構遺留）— 零引用可刪。**刻意保留勿刪**：`stores/pulse-profile-store.ts` + finger-precision utils 四檔（TENKI Pulse / blend 接線等 Mac，MEMORY 有案）、`face-baseline/recovery.tsx`（完整蓋好、等原生 face-lost 事件，目前不可達） | agent D 引用計數表 |
| P2-3 | **`apps/preview/v6/` 整套 `tlTlTlTeiScore`/`.tl-tei` 殘留命名**（~90 行 + stardust-scan-takeover.{js,css} 5 處）— 對外呈現已是 v3，純內部命名債 | agent A 清單 |
| P2-4 | **mobile `maturityStage.ts` 靜默缺 distinct-days 條件**：engine canonical 要 15 掃 + ≥3 天才 mature；mobile 一天刷 15 次就 mature，且該檔無 mirror 標記、無 caveat 註解（engine 的 haptics 鏡像有自書此簡化，mobile 沒有）。門檻數值本身同步（1/5/15）✓ | agent B 逐行比對 |
| P2-5 | **`apps/preview/styles.css:2138` 第二套調色盤**（`--tenki-accent-gold:#c97b2f` 等）被 v6 掃描流程消費，繞過 tokens.css 單一真相源。⚠️ 但此金色出自 founder 參考截圖（task.md Screen C 明載 `#c97b2f`）→ **屬設計決策非機械修復**，見 decisions.md D5 | agent B + task.md:32 對照 |
| P2-6 | `TENKI-ULTRA-SPEC.md`（186 行 Decision Timer 規格）無橫幅、無任何文件引用它 — 無警示地雷 | agent B |
| P2-7 | 鏡像健康度（好消息）：haptics 引擎↔mobile pulse.ts **逐值 IN-SYNC**；zone 三色在 design-tokens/zone-config/mobile theme/tokens.css/v6/styles.css 首塊 **全一致** — 收斂機制運作中 | agent B 比對表 |

## 驗收對照（本健檢自身）

1. **滿足原先規則**：audit-only 未動 apps/web/core/main；commit-per-todo；`npm run verify` 全綠（見 notes.md；coverage 污染已還原並實測 lint 0 errors）。
2. **可驗證報告**：本檔每條附 file:line 證據與驗證方式；agent 原始輸出摘要在 notes.md。
3. **測試/實測方式**：每個 P 項的「驗證方式」欄 + plan.md 每步附驗收指令。
