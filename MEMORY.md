# 📋 MEMORY.md 協議（永久置頂，勿刪、勿在其上方加條目）

> 1. **新條目一律加在本協議正下方**（最新在上，越下方越舊）。⚠️ 檔尾殘留少數 2026-04~06 的舊條目是歷史遺留，別學它們 append 在檔尾。
> 2. 條目格式：`# YYYY-MM-DD Session Update (一句話主題)` → What was done → 教訓/注意 → 下次接手點。
> 3. **本檔是日誌，不是法典**：記「這次發生什麼」。可長期沿用的規則要出去 —— 工程硬規則 → `CLAUDE.md`、操作陷阱/流程 → `docs/PLAYBOOK.md`。
> 4. **同類教訓第二次出現 → 必須提煉成 PLAYBOOK 一條「情境 → 規則」**（compound learning 制度）。
> 5. 讀者（AI）只需讀最上面 1~2 條當交接，其餘用 grep；不要全文讀 —— 蒸餾版在 `docs/PLAYBOOK.md`。

---

# 2026-07-03 Session Update #4 (健檢修復計畫全數執行完畢 — 10/10 步驟)

> 承 #3：founder「繼續執行 plan」→ 剩餘 2.1–2.4、Phase 3 全部、4.1、4.3 一次做完。每步一 commit，進度已標回 docs/healthcheck/plan.md。

## What was done（8 commits）
- **2.1**：biome includes 加 `!**/coverage`（跑 coverage 不再弄破 lint gate，實測驗證）。
- **2.2**：v3 `biometric/rr.ts` 25%→100% 覆蓋（新 biometric-rr.test.ts）；engine 總覆蓋 89.02%→**92.78%** 重新達標 ≥90%。
- **2.3**：DEPLOYMENT_MAP.json 補 `/`→`/story/` redirect（f21bcd2 漏改）+ `/brand/*`；.md 加雙檔同步警告；CLAUDE.md 部署節過時句修正。
- **2.4**：根 BRAND.md / docs/BRAND.md / DEPLOYMENTS.md / TENKI-ULTRA-SPEC.md 加 ⛔/⚠️ 橫幅；PLAYBOOK §0 過時清單同步九檔。
- **3.1**：刪 `engine/src/tei.ts` + 其測試（檢疫區外死代碼）。
- **3.2（實況與 plan 不同，已記回 plan）**：ewma/hrv/sqi/stress/rr 頂層檔與 legacy/ 副本 **byte-identical**（diff 驗證）→ 不是「搬進去」（會撞名）而是**刪頂層副本 + 測試 import 重指向 legacy/**（覆蓋率保留，92.57%）。
- **3.3**：scan 套件 TEI 全清（EDGE_BUCKET_BOUNDARIES/getEdgeBucket/edgeScoreAt*/edgeBucket + JSDoc/測試描述含 Peak/Optimal/Degraded 字樣）；agent 盤點漏了 timeline/types.ts 與 templates/selector.ts 的 JSDoc，執行時抓到。
- **3.4**：v6 揭曉 tei 命名債全清 — 識別字族比 plan 估的多（`tlTlTlTei{Points,Start,End,Min,Max,Area,Zone,ToY}`、`renderTlTlTeiTrace`、`sdTlTlTei*`、`current/targetTlTei`、data 欄位 `tei:`）→ 全改 edgeTrace*/edgeScore* 家族；三檔（index.html + takeover.js/css）同步；node --check + 4 段 inline script 語法全過。
- **4.1**：刪 QualityMeter/ReadinessChecklist/StatusPill/mock-scan（刪前逐檔再驗證）；6 個預留件掛 DORMANT 牌。
- **4.3**：maturityStage 加 mirror 標記 + distinct-days 缺口 caveat。

### 教訓 / 注意
- **plan 假設 vs 現場實況**：3.2 的「搬進 legacy」假設錯（legacy 已有副本）— 執行者遇到 plan 與現場矛盾時，回到決策意圖（D2：v2 退出 active tree、legacy 故事保留）選等效動作，並把實況記回 plan。
- grep 字面盤點會漏 JSDoc/測試描述字串 — 改名類任務收尾要用 case-insensitive 全檔掃殘餘再收工（`stateIdx` 這種誤中除外）。

## 待 founder 手機驗（merge 後）
1. `/preview/scan-result.html` — 三 zone 色（slate/ember）。
2. `/v3/` — 完整揭曉流程（3.4 id/class 改名後功能不變）。

---

# 2026-07-03 Session Update #3 (健檢三件拍板全過 + Phase 1 P0 執行完畢)

> Founder：「先拍板那三件待決事項 全依建議」→ 三件裁決落地 + Phase 1（P0 紅線）全部執行。

## What was done（6 commits）
1. **拍板①（D3/plan 4.2 + 1.1）**：刪根目錄考古層 — `vite.config.js`（含 "Bio-Risk SaaS for Pro Traders" 違規文案）、`dev-dist/`、`src/`、`ui/`、`tests/`、`integration/`、`templates/`（38 檔，零外部引用已驗證，git 可復原）；package.json 移除 vite/vite-plugin-pwa（-282 packages）。
2. **拍板②（D1/plan 2.5）**：CLAUDE.md Reanimated 規則改寫 —「目標 Reanimated 3；既有 20 檔 core-RN Animated 是已知過渡債原生階段遷移；不得新增」。
3. **拍板③（D5）**：preview 第二調色盤（#c97b2f 金）保留 — styles.css 掛 FOUNDER-APPROVED 註解 + PLAYBOOK §6 防守條目（防未來 AI 誤「修正」）。
4. **plan 1.2**：scan-result.css zone 色改 canonical slate/ember（**待 founder 手機看 `/preview/scan-result.html` 驗色**）。
5. **plan 1.3**：TEI-SPEC.md + progressive-tei-api.md 加 ⛔ SUPERSEDED 橫幅。
6. plan.md / decisions.md 進度標記同步更新。

## 下次接手點
- **剩餘步驟（照 docs/healthcheck/plan.md，全部無阻擋）**：2.1 biome 排除 coverage、2.2 rr.ts 補測試到 ≥90%、2.3 部署文件三處同步、2.4 品牌文件橫幅、Phase 3 TEI 退場四級、4.1 mobile 孤兒清理、4.3 maturityStage 掛牌。
- founder 手機驗：`/preview/scan-result.html` 三 zone 色（slate/ember）。

---

# 2026-07-03 Session Update #2 (全專案健檢完成 — 交接包在 docs/healthcheck/)

> Founder：對專案做完整健檢（audit-only），輸出可驗證報告 + 讓非 Fable 模型能無縫接手的交接包。4 個便宜模型 sub-agent 跑機械掃描，本體只做裁決。

## What was done
- **交接包（docs/healthcheck/，5 檔）**：`REPORT.md`（P0×3 / P1×6 / P2×7，每條附證據與驗證方式）、`decisions.md`（8 裁決含捨棄方案）、`plan.md`（4 phase 修復步驟，Sonnet/Opus 照做粒度、每步附驗收、破壞性步驟掛 [待 founder 拍板]）、`risks.md`（風險 + 未解 + 方法侷限，誠實版）、`notes.md`（過程紀錄）。
- **頭三個發現**：① vite.config.js 死設定裡藏 "Bio-Risk SaaS for Pro Traders" 違規文案；② `/preview/scan-result.html` 活頁面還在用遷移前 zone 色（近白/紫）；③ Reanimated 3 規則 vs 現實全面脫節（20 檔 244 處 legacy Animated、依賴根本沒裝 — 屬 mock 階段刻意債，規則措辭需 founder 拍板修正）。
- **好消息**：`any` 0、Redux 0、**生理數據網路呼叫 0（local-first 代碼層成立）**；haptics 鏡像與 zone 六檔色全 IN-SYNC。
- **PLAYBOOK 新增 §9.5**：sub-agent 使用紀律（副作用清理、異常回報必覆核、矛盾本體裁決）— 本次兩個實戰教訓的提煉。

### 教訓 / 注意
- haiku agent 跑 `jest --coverage` 污染工作區把 lint gate 弄假紅、且把它當 repo 現況回報 → 本體覆核抓到，coverage/ 未進 biome 排除是真發現（plan 2.1）。
- 兩個 agent 對 engine/src/tei.ts 引用狀態矛盾 → 本體親跑 grep 裁決（它是檢疫區外死代碼，legacy/ 用自己的副本）。

## 下次接手點（按 plan.md 執行，任何模型可接）
1. Phase 1（P0 三項，半天，雲端可做）→ Phase 2 起各步獨立。
2. [待 founder 拍板] 三件：根目錄考古層刪除（4.2）、Reanimated 規則措辭（2.5）、preview 第二調色盤歸屬（D5）。
3. 未解清單見 risks.md（dist 新鮮度、demo 頁是否進部署地圖等）。

---

# 2026-07-03 Session Update (日常 Soul Scan 揭曉鏈落地(mock) + Antigravity 桌機交接 — claude/fable5-system-setup-xuqbkg)

> Founder（只有手機）：「你先幫我工作，適合 Antigravity 的留給它，確保接手 AI 都懂。」接 2026-06-23 條目的 A 叉路 follow-up。

## What was done（4 commits，commit-per-todo）
1. **`utils/dailyScan.ts`（純函式 + 15 測試）**：`isDailyRefinement`（standalone + baselineEstablished 才算日常掃描）、`deriveDailyEdgeScore`（有 confidence → 線性映射 32–96；mock 流程 quality 全 0 → 走每日確定性合成分數 62±14，JSDoc 標明 MOCK STAGE）、`buildRefinementEntry`、`toScanMetrics`、`formatHistoryTime`（手動格式化不依賴 locale API）。
2. **processing 完成分流（`ProcessingBaselineScreen`）**：日常 refinement → `recordScan`（maturity/history）+ mock Edge Score 寫入 scan-store + `incrementFaceBaselineCount` → **直接 `router.replace('/scan/result')` 揭曉**（既有「今日內在天氣」頁，Today ring 同步反映）；首次基線 → established 儀式照舊。**順手修缺口**：standalone 首次基線補 `setBaselineScore`（鏡像 onboarding complete），否則站內建基線後 `hasBaseline` 永遠 false、Scan tab 一直導回 intro。
3. **maturity 畫面接真歷史**：`refinementHistory` 有條目就取代 DEMO_HISTORY（空時保留 demo）。
4. **ANTIGRAVITY.md 置頂 note 換新（2026-07-03）**：舊 note 已過時（onboarding 實際已 merge #151、/story/ 已是 front door #152）。新 note = 制度必讀 + 現況 + 桌機專屬清單（preview 真 CDN polish / mobile 揭曉實機手感 / Mac 原生 lane）。

## 分工原則（本次確立）
- **雲端（Claude Code）**：TS 邏輯、測試、CI 涵蓋的接線、文件 — 不需實機的全包。
- **桌機（Antigravity）**：真 CDN 瀏覽器的動效手感、pixel 對齊 mockups、實機 Safari/Expo 驗證、需 Mac 的原生模組。

### 教訓 / 注意
- **mock 流程從不呼叫 `updateQuality`**（quality 全 0 → `estimateConfidence` = 0）— 這就是 complete.tsx `|| 68` fallback 的根因。任何「拿 confidence 當輸入」的新功能都要處理無訊號情境；原生相機接上 `updateQuality` 後，mock fallback 自動退位。
- established 畫面文案是首次基線導向；日常掃描現在繞過它直接揭曉。若要日常專屬揭曉儀式畫面 = 設計決策，先問 founder。
- 驗證：mobile 13 suites / 112 tests 全綠、tsc 0 error、改動檔 biome clean、`npm run verify` 全綠。

## 下次接手點
1. Founder 手機看不到 mobile（無公開網址）— 揭曉鏈的實機驗證屬 Antigravity lane（見 ANTIGRAVITY.md 置頂 note）。
2. 雲端可續做：Timeline 讀 refinementHistory/lastResult 真資料、Today Stats Grid（Sessions/Avg/Streak 還是 —）、established 日常變體文案（待 founder 拍板）。
3. 真 engine scoring 待原生相機（Mac lane）。

---

# 2026-07-02 Session Update (Fable 5 制度建設：PLAYBOOK + verify.sh + 護欄修矛盾 — claude/fable5-system-setup-xuqbkg)

> Founder：把 Fable 5（一次性最強模型 session）的判斷力轉成可長期沿用的制度與檔案，讓之後較弱模型的 session 都因此變強。不做日常任務，只立制度。

## What was done（commit-per-todo，共 7 commits）
1. **`docs/PLAYBOOK.md`（新，本次核心交付）**：把 MEMORY.md 998 行日誌裡的 40+ 條教訓蒸餾成「情境 → 規則」查表手冊 —— §0 文件優先序（矛盾裁決）、§1 任務路由表、§3 CI 盲區、§4 git/多 AI 協作、§5 工具鏈、§6 preview 地雷（最厚）、§7 mobile/engine、§8 合規紅線、§9 定位表、§10 維護制度（糾正即入檔、二次即提煉）。
2. **`scripts/verify.sh` + `npm run verify`**：一鍵 merge gate（lint + 4 套件 tsc + root/mobile 測試 + preview `node --check` + 禁用詞彙），已在容器實測全綠（root 281 + mobile 96 測試）；缺依賴時給明確指令；`--quick` 跳過 mobile。
3. **`scripts/check-vocab.sh`**：diff-based 擋新增行出現 `TEI`/`PR99`（大小寫敏感，`tlTlTlTeiScore` 等既有殘留不誤報；legacy adapter 檔以 pathspec 排除）。已測正負兩向。
4. **CI `guards` job**：banned vocab + `apps/preview/*.js` 語法檢查（preview 從此至少有語法防線，免裝依賴數秒跑完）。
5. **修活矛盾（弱模型最大陷阱）**：session/compact hooks 還在教 `npx vitest run` → 改指 verify.sh + PLAYBOOK；`AI_INSTRUCTIONS.md`（v1 trading 語言）、`RULES.md`（v2 保護 PEAK/OPTIMAL）、`task.md`（停更）加 ⛔ SUPERSEDED 橫幅；RULES-v3 最終依據改指 PLAYBOOK §0。
6. **hooks 強化**：`protect-files.sh` 新增 `core/` 寫入封鎖（排除 node_modules）。
7. **入口對齊**：CLAUDE.md 加「文件優先序與陷阱手冊」節 + verify 指令 + MEMORY 協議；AGENTS.md（Antigravity 等的入口）閱讀順序/工作流/Key Files 全部對齊。

## 制度設計原則（為什麼這樣立）
- **弱模型服從短規則與機械護欄，不服從長文與判斷** → 能用 hook/CI/腳本擋的就不靠自覺；能查表的就不寫散文。
- **活矛盾比缺文件更毒**：hook 每 session 注入錯誤指令 = 系統性帶偏每個未來 session，優先修。
- **日誌（MEMORY）與法典（PLAYBOOK/CLAUDE.md）分離**：日誌可以無限長，法典必須短且無矛盾。

### 教訓 / 注意
- 本分支 `claude/fable5-system-setup-xuqbkg` 純文件+腳本+CI，無產品代碼改動；`verify.sh` 全綠實測過。
- CI `guards` job 第一次在 PR 上跑時留意 `fetch-depth: 0` 是否讓 check-vocab 正確拿到 origin/main（本地已驗，CI 理論等價）。

## 下次接手點
1. Founder review 後 merge 本分支 → 之後所有 session 自動吃到新 hooks/CI/PLAYBOOK。
2. 已知債（不急）：v6 `tlTlTlTeiScore` id 改名、`packages/engine/src/tei.ts` 等 18 檔 legacy 殘留的退場計畫、MEMORY.md 檔尾亂序舊條目擇期歸檔到 `docs/archive/`。
3. 日常開發照舊；差別只在：開工看 PLAYBOOK §1、完工跑 `npm run verify`。

---

# 2026-06-23 Session Update (Scan tab 重定位為日常 Soul Scan 路由儀表板 — feat/scan-tab-daily-soul-scan)

> 承接上一條:onboarding 接好後,做 North Star step 3 後半「Scan tab 重定位為日常 Soul Scan」。Antigravity 實作、雲端 relay 重建+驗證+推送+review。

## What was done(先收純路由 MVP 版,Edge Score 揭曉留下一輪)
- **`app/(tabs)/scan.tsx` 從 ~1020 行 mock 手指擷取頁 → ~162 行路由儀表板**:主 gold「今日星塵臉部掃描」卡 + 次 cyan「手指接觸校準」卡;沿用 face-baseline 既有元件(CosmicBackground/NavBar/GlassInfoCard/GlowPrimaryButton/PrivacyFootnote)+ tokens。
- **路由**:臉掃卡先 `setEntryContext('standalone')` 再導 —— `hasBaseline` true → `/face-baseline/maturity`(日常家)、false → `/face-baseline`(先建基線);手指卡 → `/finger-precision`。守 North Star 鐵律 1(capture 不進 scan.tsx,tab 只路由)。
- 移除 camera preview/checklist/timers/mock-scan 的「使用」,但**共享元件/store 檔案保留**(QualityMeter/scan-store/mock-scan 等只是不再被 scan.tsx 引用,沒刪檔→無 orphan-delete)。
- 驗證(雲端實跑):tsc 0 error、jest 12 suites/96 tests、Biome clean。base 乾淨(只動 scan.tsx + MEMORY,無 stale 帶入 #144 檔案)。

### 教訓 / 注意 / 待辦
- **Antigravity push 又沒上 GitHub**(同上條:圖書館那台 remote 內嵌 Google Stitch token 非 PAT)→ 再走 patch relay,但這次先要 `git log/--stat` 驗 base 乾淨,再貼 `git show HEAD:scan.tsx` 全文(比 966 行刪除 diff 可靠),雲端重建後推送。
- **A 叉路(今日 Edge Score 揭曉)本輪刻意未做** = founder 決定先收純路由版。**下一輪 follow-up**:日常臉掃走完產出今日 Edge Score/Zone 揭曉(現階段 mock,沿用既有 result/Today 揭曉;原生相機到位再接真 packages/engine scoring)+ recordScan 更新 maturity。fold-in 定稿 prompt 已備。
- **次要偏差(暫不修)**:C 原想「手指卡用 smart-trigger(faceBaselineCount<3/stress>75/daysSinceCalibration>14)才凸顯」,Antigravity 版兩卡恆顯。屬 polish,非 bug。

---

# 2026-06-23 Session Update (face-baseline 接成 onboarding 主入口 + Antigravity 協作 relay — feat/wire-face-baseline-onboarding)

> Founder 在圖書館電腦裝好 Antigravity(Opus 4.6),要分配現階段任務。雲端這邊負責出任務 prompt + 把關 review。

## What was done
- **任務分配**:挑 North Star 落地順序 step 3 的 ⬜ 待做「mobile /face-baseline 接成 onboarding 主入口」給 Antigravity(純 TS/Expo、CI 涵蓋、可在 Windows 跑、且**不碰雲端正在打磨的 apps/preview 金沙球**,零撞車)。給了帶確切檔案/行號的 prompt。
- **接線內容(branch `feat/wire-face-baseline-onboarding`)**:onboarding `ready` CTA 從假掃描 `/onboarding/scan` 改進真 ceremony `/face-baseline`;ceremony 終點 `BaselineEstablishedScreen` 依情境退場;`complete.tsx` 讀真 `baselineConfidence`(fallback 68);刪孤兒 `onboarding/scan.tsx`(317 行)。
- **關鍵 bug 攔截**:Antigravity 初版出口用 query param `?from=onboarding` 判斷,但 ceremony 是一屏 `router.push` 下一屏、**param 活不過 8 屏鏈** → 到 established 時讀不到 → 永遠 loop maturity、到不了 complete。改用 **store 旗標 `entryContext: 'onboarding' | 'standalone'`**(入口 set、出口讀、complete reset)解決。
- **出口判斷抽 pure helper**:`establishedExitRoute(entryContext)` 進 `screens/routes.ts` + 兩分支測試(不渲染 screen)。
- **驗證(雲端實跑)**:`tsc --noEmit` 0 error、jest 12 suites/96 tests 全綠、Biome 改動檔 clean。

### 教訓 / 注意
- **Antigravity push 一直上不了 GitHub**:圖書館那台 remote URL 內嵌的是 Google Stitch token(非 GitHub PAT)、GCM 無互動 → push 卡認證。**最後走 patch relay**:Antigravity 出 `git diff origin/main..HEAD`、founder 貼給雲端,雲端**從 main 重建+實跑驗證後用雲端的寫入權限推上 GitHub**。(relay 來的 diff 上下文可能不一致,別盲 `git apply`,改用 Edit 對真實檔案精準重建更穩,且順帶就是逐行 review。)
- relay 沒帶到 Antigravity commit 5 的 `ANTIGRAVITY.md` 路徑修改 → 本分支是純功能,未含該文件變更。
- **edge case(已知、暫不修)**:`entryContext` 只在 `complete.handleComplete` reset;若使用者在 established→complete 中離,旗標會停在 onboarding。現無妨(store 非持久化、重開即回 standalone);**若日後給此 store 加 persist,要把 reset 移到更早(如進 Today)**。
- 下次接手:`npm run web` 實走驗 onboarding→ceremony→complete→Today;之後做 follow-up「Scan tab 重定位為日常 Soul Scan」(North Star step 3 第二半,本次刻意未做)。

---

# 2026-06-22 Session Update (金沙球對齊 IMG_8437 + 建 headless orb-tuner 回饋迴圈 — #142)

> Founder:把 Soul Scan「Securing your unique baseline…」金沙球**調到跟目標圖 IMG_8437 一致**;確認 IMG_8437 是目標(實機還沒到位),要動三塊:①金沙軌道/拖尾 ②輝光/色調 ③玻璃殼/反光。

## What was done
- **釐清渲染來源(關鍵)**:這顆球**不是** three.js / 不是 v6 `stardust.js`,而是 `apps/preview/soul-enroll.js` 的 **`drawProcessingOrb()`**(Canvas 2D,純程式),掛在 enrollment `processing` 步驟 + 兩個結束畫面(`R:98`)。IMG_8437 一直是它的對標圖(`afcd160/5338e02/18b3635` commit 皆寫 align IMG_8437)。
- **建 headless 回饋迴圈(`scripts/orb-tuner/`)** 解決「盲調」:`harness.html`(設 `__ORB_HARNESS__` 旗標→載 soul-enroll.js→只取 `window.TENKI_ORB`、不啟動 app/相機)+ `shoot.mjs`(Playwright headless 多幀 R=76/98/150 截圖)+ `reference.png`(=IMG_8437)。`soul-enroll.js` 底部加極小 guard hook(僅旗標下生效,生產 no-op)。
- **三塊調參(只動 `drawProcessingOrb`)**:
  - 金沙/拖尾:每條軌道加螢幕旋轉 `roll` 讓環交錯成團(原本三條共面 → 扁平土星環)+ 加第 4 條軌道 + grit 加密 + comet 衰減 0.5→0.38(拖尾更長更連續)+ ribbon/sand 加亮加粗。
  - 輝光/色調:外暈 alpha 0.22→0.34、半徑 1.7R→1.85R;核 R*0.42→0.46 更熱更白金。
  - 玻璃/反光:柔化 fresnel 邊緣(0.42→0.26)+ 柔化高光(R*0.34→0.40, 0.9→0.72)讓沙主導。
- 4 commits(Commit-Per-Todo):`chore(preview): rebuild headless orb-tuner feedback loop` / `feat(preview): match gold-sand trails…` / `…bloom & tone…` / `…glass shell & reflection…`。PR #142 CI 全綠 → merge `main`(`f6be96a`)→ Vercel 部署。

### 教訓 / 注意
- **下次改「金沙球/Securing 幕」直接找 `apps/preview/soul-enroll.js` 的 `drawProcessingOrb()`**(599 起);別誤觸 v6 `stardust.js`(那是另一顆 three.js 星塵球)。
- **headless orb-tuner 可重用**:`node scripts/orb-tuner/shoot.mjs` → `scripts/orb-tuner/out/*.png`(已 gitignore)。Playwright 全域裝在 `/opt/node22/...`,chromium 本體需 `npx playwright install chromium`(本環境網路可開);ESM 用絕對路徑 import playwright。
- **扁平土星環 vs 纏繞金結** 的差別在軌道平面:只繞 X 傾斜+Y 自旋 → 投影都成水平橢圓;加 per-orbit 螢幕 `roll` 才會交錯成團。
- 渲染是 **Chromium proxy**,iOS Safari Canvas 2D 漸層/shadowBlur 可能微差 → 最終仍以 founder 實機為準(`…/preview/soul-enroll.html` 走到 processing 幕)。
- `apps/preview/**` 與 `scripts/**` 都不在 `biome.json` includes(只含 packages/domain/apps/mobile)→ 本次改動不進 CI lint/typecheck/test,靠 `node --check` 把關。

---

# 2026-06-20 Session Update (首訪滑動提示質感升級 — 指尖手勢 + chip 進場/光澤/磁吸 tug — #121)

> Founder:把首次進結果頁的 Snapshot「滑動看更多」提示**質感再提升**(像 Fable 5);選了「指尖滑動手勢」。

## What was done
- **`apps/preview/v6/index.html`(只動這檔,沿用 #112/#113 既有 controller)**:
  - **手勢提示**:把兩個對稱彈跳 chevron(‹ ›)換成**發光指尖光點**沿短軌道滑過 + 後方柔和拖尾彗星;keyframes **不對稱**(快速往左拖=滑動,再較暗抬起/重置)→ 讀作「刻意滑一下」而非彈跳。移除 `.sh-chev/.sh-l/.sh-r/shDriftL/shDriftR`。
  - **chip 進場/玻璃**:`.on` 從只切 opacity → 加 `translateY(8→0)+scale(.94→1)` 優雅升起;新增 `::after` **單次光澤橫掃**(`shSheen`);chip 加 `overflow:hidden` 夾住光澤。
  - **tug 更磁吸**:`tug(px,hold,after)` 簽名加 hold;show 內 `tug(30,440,…)+ 16px 柔和回響`,與 chip 登場同節拍。
  - **reduce-motion**:靜止光點、無光澤/位移,chip 僅淡入;不 tug。
- PR #121 CI 全綠 → squash merge(`d73b59d`)→ branch 同步。

### 教訓 / 注意
- 「質感升級」類任務:先把現有元件結構摸清(controller 的 arm-on-reveal/一次性/dismiss 邏輯別動),只換**感官層**(glyph/進場/光澤/節奏)= Surgical。
- CI 不涵蓋 `apps/preview/**` → 待 founder 手機首訪驗(指尖光點滑動、chip 升起+光澤、磁吸 peek;第二次不再出現;Reduce-Motion 靜止)。可微調方向/速度/peek 量。

---

# 2026-06-20 Session Update (神經狀態地圖解遮擋 — 波形退讓、容納之窗呼吸 — #120)

> Founder（螢幕錄影）:Autonomic snapshot「有點遮擋感」,要我像 Fable 5 一樣思考。

## What was done
- **真因**:Autonomic 卡片內容溢出 190px carousel 格(~220px 塞進 ~154px)—— 兩條 44px SNS/PNS 波形被 `flex:1` 撐高 + 完整容納之窗地圖 + #118 的「在綠色安全區」caption。底部 ~60px(區間標籤 + caption)被擠出圓角卡片、壓到下方 FDCB「START DECISION」bar 底 → 就是遮擋感。
- **修法(`apps/preview/v6/index.html` 只動這檔,地圖=主角、波形退為 context)**:SNS/PNS 波形 `height:44→26px`、`flex:1→none`(不再被撐高)、gap/margin 收緊(`.ans-card{gap:6px}`、waves `gap:8` `margin:2px 0 6px`);**拿掉純裝飾英文 Blue/Green/Red 子標籤**(顏色從色帶就看得出)→ 區間標籤改單行中文;保留動態「在綠色安全區」home caption。內容降到 ~150px,完整放進卡片留呼吸、不再裁切。
- PR #120 CI 全綠 → squash merge(`1951148`)→ branch 同步。

### 教訓 / 注意
- **carousel 卡片高度固定(snap-track 190px),塞太多會無聲溢出到 FDCB 底下** → 卡片內容要算高度預算(vhead + waves + map ≤ ~154px inner);過去 #106/#108/#113 同源於 `.snap` 高度/裁切。
- 桌機 session 又在 main 推了 #119(karpathy skills)→ 我的 PR 撞 merge conflict;`git rebase origin/main` 解 `MEMORY.md` 重疊(兩篇 #119/#118 都保留),index.html 無重疊自動併。
- 本環境**無 gh CLI**,Monitor 用 gh / 未設 token 的 curl 都會空轉 → 直接用 GitHub MCP `pull_request_read(get_check_runs)` 查 CI。
- 待 founder 手機驗 `/preview/v6/?from=baseline` Autonomic 頁:地圖 + 三標籤 + 字幕完整可見、不再被卡片底/FDCB 遮住。

---

# 2026-06-20 Session Update (套用 andrej-karpathy-skills 四大黃金原則)

> Founder:問現有專案有沒有套 andrej-karpathy-skills,沒有就裝,讓協作 AI 都讀得到。

## What was done
- **確認原本沒裝**:全 repo 無 `*karpathy*` 檔、無 `.claude/skills/`、無對應 plugin。原本只靠 CLAUDE.md/AGENTS.md/ANTIGRAVITY.md 手寫文件,四原則精神散落未正式落地。
- **新增 skill** `.claude/skills/karpathy-engineering/SKILL.md`:四大黃金原則(Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven Execution)完整版,帶 frontmatter(name+description)讓 **Claude Code 自動發現並套用**。刻意把每條原則接上既有硬規則(Simplicity↔禁 SVG/Redux/legacy Animated、Surgical↔不動 apps/web 與 core、Goal-Driven↔先寫複現測試再改綠),並標明**衝突時 CLAUDE.md 優先**。
- **接進 source of truth**:`CLAUDE.md` Dev Strategy 開頭加四原則摘要 section;`AGENTS.md` Must Do 第 2 條 + Key Files 表加參照 → Antigravity / Cursor 等非 Claude Code 的協作 AI 也讀得到。
- 2 commits(Commit-Per-Todo):`feat(skills): add karpathy-engineering skill`、`docs: wire karpathy four principles into CLAUDE.md + AGENTS.md`。已推 `claude/karpathy-skills-setup-bsyg2p`。

### 教訓 / 注意
- 安裝走「專案級設定」(copy 進 repo)而非外部 plugin/marketplace,符合 Simplicity First 且零外部依賴、零網路需求。
- 純文件變更,CI lint/typecheck/test 不受影響。

---

# 2026-06-20 Session Update (神經狀態地圖改為 The Yes Brain「容納之窗」綠=家 — #118)

> Founder 提供《The Yes Brain》pp.135–136 三色區域圖（紅色警戒區／**綠色安全區=最寬的家**／藍色陷落區），核心是 green 是「回到/擴展」的安全家園,不是分數刻度。原本 #116 的地圖把 green 畫成等寬光譜中間 1/3 → 讀起來像 grade。要讓綠色安全區明顯主導。

## What was done
- **#118 神經狀態地圖 = 容納之窗(green=home)**:`apps/preview/v6/index.html`(只動這檔)Autonomic 頁:
  - `.ns-track` 從等寬連續光譜 → **三段、綠帶主導**:藍 陷落 0–22%(窄、低飽和、退讓)·**綠 安全 22–78%(~56%,最寬最亮,加 `::before` contained「home」框)**·紅 警戒 78–100%(窄、退讓);接縫柔化。
  - 標籤:綠「安全區」放大加亮領銜(11.5px/700),藍 低能量・紅 過載 縮小退讓(opacity .62);tooltip 帶書中色區名(藍色陷落/綠色安全/紅色警戒)。
  - 新增 `.ns-status` 一行字幕,點名當下區(在綠色安全區 · Regulated;藍/紅各自字色)。
  - JS `loop`:zone 門檻改 blue<22 / green 22–78 / red>78;marker 漂移重置中(`50+sin·*12+sin·*5`≈33–67)留在綠帶內;`nsStatus` 隨 zone 換 class+文字。reduce-motion 仍尊重。
- PR #118 CI 全綠(Vercel + packages/domain + mobile)→ squash merge(`e876569`)→ branch 同步。

### 教訓 / 注意
- preview 用 `new Function()` 驗 inline script(4 個 0 error);CI 不涵蓋 `apps/preview/**` → 待 founder 手機驗 `/preview/v6/?from=baseline` Autonomic 頁(綠帶主導、marker 不離家、字幕「在綠色安全區」)。
- 本環境**無 gh CLI**,Monitor 用 gh 會空轉 → 改用 GitHub MCP `pull_request_read(get_check_runs)` 直接查 CI。
- 此環境是 undercover:被問模型身份才回 `claude-opus-4-8`,**絕不**寫進 commit/PR/程式碼。
- 後續(deferred)「擴展綠色安全區」=隨 baseline maturity 加寬綠帶,本次未做。

---

# 2026-06-19 Session Update (修桌機紅 main + 神經狀態地圖 + 金球光澤 + 手指PPG示範 — #116/#117)

> Founder:① 金球光澤(左→右)不夠自然細膩;② Snapshot 整合 The Yes Brain 三色神經狀態長條;③ 手指PPG補簡易示範動畫。期間桌機 session 又把 WIP merge 進 main 弄紅 CI。

## What was done
- **#116 修紅 main(桌機 session 的 progressive-scan/fusion WIP 沒編譯過)**:`apps/mobile` 首次出現 `@tenki/engine` **子路徑** import 卻無解析 → `apps/mobile/tsconfig.json` 加 `baseUrl`+`paths` 映射 `@tenki/engine[/ *]`→`packages/engine/src`;`AutonomicCard` 用了不存在的 `colors.cardBorder` → theme 補 `cardBorder`(= border);`useProgressiveScan` 讀 `FingerPrecisionResult.confidence`(無此欄)→ 改用既有 `signalQualityScore`;引擎 `EdgeScoreMetadata.sourceMix`(`BiometricSource[]`)被塞 `FusionSource` → 放寬為 `(BiometricSource|FusionSource)[]`(純 analytics、無消費者)。本機全綠:lint 0、tsc 全過、root 281 + mobile 93 測試。
- **#116 神經狀態地圖(The Yes Brain 三色)**:`apps/preview/v6/index.html` Autonomic 頁把舊 SNS/PNS 分隔條換成**連續光譜**(非評分條):藍(陷落)·綠(調節,最寬=理想)·紅(過載),柔色 `#5B8DEF/#5CC8A1/#F26D6D`、接縫柔化;marker 在 0–100(0–30/30–70/70–100)連續移動,綠=清晰穩定、藍=起霧、紅=微弱脈動(尊重 reduce-motion);標籤 低能量/穩定/過載 + tooltip;demo marker 在綠區內輕移(「可移動、非評價」)。保留 SNS/PNS 活波。
- **#116 金球光澤改自然**:移除 `.bb-bars::after` 扁平掃帶 + `@keyframes bbFlow` → 改在 idle rAF 用**逐根高斯行進光暈**(σ≈1.25,~3s 滑過 + ~1.3s 休息),光「穿過」長條而非掃過縫隙。
- **#117 手指PPG示範**:`apps/preview/finger-demo.html`(`/preview/finger-demo.html`)—— 指尖滑上鏡頭→輕壓→鏡頭心跳般 PPG 發光+漣漪+Cover/Still/Pressure 依序亮。純 CSS+少量 JS;當 mobile RN placement_guide 的 web 原型。

### 教訓 / 注意
- **桌機(Antigravity)session 持續把 WIP merge 進 main 弄紅 CI**:遇到時本機 tsc/lint/test 重現、做**最小**修正(別重設計他們的功能)、轉綠即可。**mobile→engine 的 runtime(Metro)alias 可能還要他們在 metro.config 補**(我只修了 tsc/CI gate)。
- **桌機已在做 fusion↔wearable HRV blend**(engine 端 progressive scan/fusion)= Garmin Phase 1 引擎方向,之後接上。
- preview 用 `new Function()` 驗 inline script;CI 不涵蓋 `apps/preview/**` → 待 founder 手機驗(Autonomic 三色地圖、Energy 光澤、`/preview/finger-demo.html`)。

---

# 2026-06-19 Session Update (Body Battery 動畫修可見 + Garmin 真串接藍圖 — #115)

> Founder(IMG_8895):能量條「還是不會動」,要我確認;另要規劃 Garmin Body Battery 真串接。

## What was done
- **#115 動畫修(`apps/preview/v6/index.html` bb IIFE)**:真因 = 我把待機呼吸做成 `scaleY(1±0.02)`(<1px,看不見),只有一次性升起會動;且若開「減少動態」整個凍結。改:idle 波動 **±2%→±10% 橫掃波**(每根相位差 `sin(ph + i*0.55)`,上限 1.10 不裁 54px row)、「當下」根 ±13% + 亮度脈動;**entrance fallback 9s→2.5s**(IO 沒觸發也準時動);reduce-motion 仍尊重(靜止)。
- **Garmin 真串接藍圖 `docs/garmin-integration.md`**(經 3 個 Explore agent 查證):**Body Battery 是 Garmin 專有指標、Apple HealthKit / Health Connect 拿不到** → 唯一來源是 **Garmin Health API**(B2B 需審核、server push 到你的後端 webhook)。repo **無後端**(靜態 Vercel + 本機 Expo,全合成)。分階段:**P0**(founder 申請 Garmin Health API + 選後端 Vercel Functions+Supabase,卡時程)/**P1 免審核**(HealthKit/Health Connect 接 HR/HRV/睡眠 → 引擎現成 `SleepRecoveryInput`+`harmonizeHrv`;Lab→Devices `lab.tsx:81` 佔位變真)/**P2 審核後**(後端 OAuth + Ping/Push webhook,只存衍生 0-100,raw 被 `scan-schema.ts` 擋)/**P3**(引擎 `BiometricSource`+`WearableReadinessInput`/9th factor;能量條綁真值)。

### 教訓 / 注意
- **動效幅度要以裝置實看為準**:「誠實細微」可能細到看不見(±2% < 1px);調動畫後要設「肉眼明顯」的下限。且**使用者開「減少動態」會凍結所有動效** → 回報時主動請對方確認該設定。
- **Garmin 關鍵現實**:Body Battery ≠ HealthKit,別誤以為接 Apple Health 就有;真值一定要 Garmin Health API + 後端,且要先過 B2B 審核(長線)。隱私:只存衍生 0-100,raw 一律不落地(domain schema 已擋)。
- 引擎落點已確認:8 因子在 `scoring/edge-score.ts`、`BiometricSource`/`SleepRecoveryInput` 在 `engine/common/types.ts`、HRV 轉換 `biometric/hrv.ts`。
- **待 founder**:① 動畫現在會動了嗎(否→確認減少動態);② 是否現在開工 Garmin **Phase 1**(HealthKit,免審核、馬上有真資料),同時他去辦 P0 申請。

---

# 2026-06-19 Session Update (Body Battery 能量條：Garmin 形狀對齊 + 誠實「活著」動效 — #114)

> Founder(IMG_8880):Energy·體能 的能量條想像音符一樣上下動、要對應 Garmin 手錶 Body Battery。問適不適合。

## 決策(AskUserQuestion)
- **動法 = 誠實版「活著」**(非跳動均衡器):Body Battery 是慢速指標、長條代表 24h 歷史 → 全跳會謊報即時波動。
- **Garmin = 預覽先做形狀對齊**(真串接 = Garmin Connect/Health API + OAuth + 後端,raw 守 local-first,屬 mobile 大功能,之後再做)。

## What was done — `apps/preview/v6/index.html`(Body Battery IIFE + `.bb-bars .bar` CSS)
- **曲線對齊 Garmin 一天**:15 根重塑成 `[56,62,70,80,88,93,89,80,69,57,46,41,52,66,78]`(夜間回充→晨峰 93→白天下滑+壓力凹→回升→**當下 78**)。**最後一根 = 當下值 = `#bbVal`**(舊版結尾 30、數字卻 78,不一致 → 修)。顏色改用 `zoneColor(v)` spectrum。
- **一次性「聲波升起」**:第一次滑到 Energy 頁時長條由左到右 staggered scaleY 進場(IntersectionObserver,root=`#snapTrack`,threshold .55;9s 安全 fallback 不卡收合)。
- **待機微動**:歷史長條 `transform:scaleY(1±0.02)` 極微呼吸(過去幾乎不動、不謊報);只有 `.bar.now`(最右=當下)較明顯充電(scaleY±0.05 + brightness 脈動 + glow)。沿用 `.bb-bars::after` 充電光澤。
- **`prefers-reduced-motion`** → 靜態長條、無進場/待機。

### 教訓 / 注意
- **慢速指標別做即時跳動**:24h 歷史長條若像均衡器全跳 = 謊報。誠實做法 = 一次性進場 + 極微呼吸 + 只有「當下」那根真的動。先用 AskUserQuestion 把「誠實 vs 好玩」「demo vs 真串接」兩個叉路跟 founder 對齊再動工。
- **效能**:每幀只寫 `transform`(GPU 友善、不觸發 layout)、`transition:none` 待機避免 smear;進場用 transition+delay,進場完才開待機 rAF。
- CI 不涵蓋 `apps/preview/**`;`new Function()` 驗 4 段 inline script。待 founder 手機驗(進場聲波、當下充電、呼吸幅度)。

---

# 2026-06-19 Session Update (結果頁首訪「滑動提示」coach hint — #112 + #113 修被裁切)

> Founder:第一次進結果頁 `/preview/v6/` 要提示 Snapshot 區可左右滑(像 Fable 5 一樣思考)。

## What was done — `apps/preview/v6/index.html`(沿用既有 snapshot 控制 IIFE)
- **首訪滑動提示(#112)**:① **磁吸 tug** —— 卡片往第 2 頁輕推 ~28px 再彈回(再一次更小的),用「動作」教學會滑;② **玻璃膠囊**「滑動看更多 · Swipe」+ 兩側 chevron 往外飄。**出手時機對兩條入口都穩**:輪詢直到頁面真的揭曉(computed `.screens` opacity > 0.9,`?from=baseline` 星塵 takeover 會壓到 ~2.9s)且 track 在畫面內,再 settle 才顯示(直接進站另保證 ≥1.95s 等卡片入場)。一碰就消失(track pointerdown/touch、點 dot、換頁);否則 ~4.8s 自動收。一次性 `localStorage`。reduced-motion → 只靜態膠囊。tug 用程式 scrollTo 觸發、消失走 pointer/互動,所以 **tug 不會自己關掉提示**。
- **#113 修「沒看到」**:膠囊原本放在 dots 下方、在 `.snap` 裡(`overflow:hidden` + #108 底部預留)→ 高螢幕手機(有 coach-card)垂直預算卡邊 → **被裁切**。改成**浮層**:`.snap` 設 `position:relative`,膠囊 `position:absolute`,JS 依 `track.offsetTop+offsetHeight` 算 `top` 浮在卡片下緣;脫離 flex 流 → 不佔高度、不被裁;`pointer-events:none` 讓滑動穿透。並補 `animation:none`(否則 `.snap > *` 的 cardEntrance 會強制顯示/打架置中)。**localStorage key 升成 `tenki.snapHintSeen2`** —— 因為被裁切的 v1 會在看不見的情況下把舊旗標設掉、壓住修正版。

### 教訓 / 注意
- **`.snap` 內的暫時性 UI 會被裁**(`overflow:hidden` + FDCB/tabbar 預留)→ 短暫 overlay 一律用 `position:absolute` 脫離 flex 流(容器 `position:relative`,`top` 由 track 幾何算),`pointer-events:none` 不擋手勢。
- **會自動關閉的提示可能在看不見時就把 seen 旗標設掉** → 修 hint 時**升 storage key**,讓先前(壞掉的)曝光不會壓住修正。
- `.snap > *` 的 cardEntrance 會套到任何新加的直接子元素 → 不想被它控的元素要 `animation:none`。
- CI 不涵蓋 `apps/preview/**`;以 `new Function()` 解析 4 段 inline script 當語法檢。待 founder 手機確認膠囊現身。

---

# 2026-06-18 Session Update (金球 3D 升級：processing 金球變有體積的玻璃球 — #111)

> Founder(IMG_8437,9:41 mockup):基線建立成功,「再幫我把金球改得更有3D感更好看一點」(像 Claude Fable 5 思考)。金球 = soul-enroll **processing**「Securing your unique baseline…」那顆。

## What was done — `apps/preview/soul-enroll.js`(`drawProcessingOrb`)
- 從「扁平玻璃片」升級成**有體積的玻璃球**,用單一虛擬光源(左上)驅動所有立體線索:受光 body 漸層 + 右下內陰影(球面體積)、左上 specular 反光點 + 細玻璃高光弧(光澤)、fresnel rim(邊緣透亮)+ 外圈 bloom。
- **三條傾斜金色軌道做深度排序**:遠端那半較暗、畫在核心**後面**;近端那半較亮、畫在核心**前面**;跑動光點依深度(by/ry)變大變亮 → 軌道真的繞著球轉。內部用球體 `clip` 包住 → 像封在玻璃球裡。
- 純 2D canvas(無 WebGL);`processing` 不在 `M3D_PHASES` → 這就是使用者實際看到的金球,所有裝置都吃得到。

### 教訓 / 注意
- **2D canvas 立體感**:單一虛擬光源 + specular + rim + 內陰影 + 深度排序(near/far arc 用 ellipse 半圈分前後 + 在 core 前後分兩趟畫)就能做出 3D 球感,不需 WebGL。
- CI 不涵蓋 `apps/preview/**` → 已請 founder 手機驗(processing 那頁金球像打了光的玻璃球、軌道繞前繞後)。可再依回饋微調亮度/金色/光點密度。

---

# 2026-06-18 Session Update (Baseline-established 畫面壓縮：first-scan CTA 不用滑就看得到 — #110)

> Founder(IMG_8851):基線建立完成那頁要**往下滑**才看得到「Start your first scan」按鈕,想讓流程更順、按鈕直接看得到(「像 Fable 5 一樣思考」)。

## What was done — `apps/preview/soul-enroll.{html,js}`
- **根因**:結尾頁堆了 300px 核心光球 + 環境圓點 + 進度 meter + **6 項快照**(#107 加了 Head position/Distance),在 iOS Safari 工具列下 overflow,CTA 掉到摺線下。
- **修法(scope 到結尾頁)**:`#stage` 加 `data-step` 屬性(在 `go()`/`restart()`/`boot()` 設定)→ 可按 FSM step scope 排版。`baseline_confirmed`+`baseline_data`:核心光球縮到 **200px**(兩頁同尺寸 → 轉場不跳)、隱藏環境圓點。`baseline_data`:隱藏進度 meter、收緊 pill margin/標題/CTA 間距。CTA 仍**錨底**(拇指友善),約省 200px → 不用滑。順手補 `restart()` 的 `state.lm` 加 `pitch:0`(對齊 #107)。
- 用 `#stage[data-step="…"]` scope,intro/權限/擷取頁不受影響。

### 教訓 / 注意
- **「Fable 5 思路」= 階段性元素取捨**:基線建立後,環境檢測點/進度條任務已完成 → 收起;光球縮成「成果徽章」;版面留給 CTA + 個人化快照。功能加東西(#107 多 2 個 checklist 項)會吃掉垂直預算,結尾頁尤其緊 → 加項目時要回頭看 end screen 是否還 fit。
- CI 不涵蓋 `apps/preview/**` → 待 founder 手機驗(結尾頁 CTA 不用滑就看得到;confirmed→data 光球大小一致)。

---

# 2026-06-18 Session Update (波形自我修復 #109 + 合併「圖書館 session」WIP 衝突 + 修 CI)

> Founder(IMG_8862):#108 後卡片有上來了,但 **Cardiac/Respiration 波形還是空的**(數字會動)。Soul Scan **點頭測試 OK**(#107 pitch 軸正確,不用換 d[9])。

## What was done
- **波形空白根因 + 修法(`apps/preview/v6/index.html`)**:hr/hrv/rr 三個 live-wave canvas 用 `offsetWidth/offsetHeight` 在 **blind `setTimeout(1800ms)`** 抓一次尺寸,之後只在 window `resize` 重抓 —— 手機不會觸發 resize → 若 1800ms 時 layout 還沒穩(splash/`?from=baseline` takeover 蓋著),bitmap = 0×0 永遠空白。**ANS canvas(page 3)用固定 `width/height` 屬性(220×44)所以一直有畫** → 正是只有 Cardiac 頁壞的鐵證。**修法**:改用 **ResizeObserver**,canvas 一拿到/改變真實尺寸就重跑 `setupCanvas`(自我修復,跟 takeover/timing 無關);loop 照跑,0-size 時 drawWave no-op。`.vwave` 加 `flex:none`(flex column 不擠壓)、`margin-top:6px`(緊貼數字下方,不再被推到會被裁的卡底);格線 alpha 0.05→0.09。
- **合併衝突(重要教訓)**:另一個「圖書館 session」用 Antigravity 把一個 WIP commit(`20c130c`,新增 `finger-precision` 功能 ~3780 行)**直接推到 main**。它是 **stale checkout**,把 #107(soul-enroll pitch)+ #108(v6 carousel)的 preview 檔案**整個還原掉了**(經 diff 證實是 byte-identical 的純還原,無真實編輯),而且它的 **CI 是紅的**。處理:把 branch reset 到 main,從 `d187788` checkout 回 3 個 preview 檔(soul-enroll.js/html + v6/index.html)恢復 #107+#108+#109,MEMORY.md 取我的超集(founder 沒加新條目),finger-precision 等功能保留不動。
- **修 CI(founder 要求一起修)**:main 紅的原因是 biome lint **2 個 error**(都在新 finger-precision):`PrecisionArc.web.tsx` 空 `<svg>` 無 title → 加 `role="img"+aria-label`+`<title>`;`FingerPrecisionScreen.tsx` `key={idx}` → 改 `key={tip}`。修完本機全綠:lint 0 error、engine/scan/shared/domain tsc 0、root 281 測試、mobile tsc 0 + 93 測試。

### 教訓 / 注意
- **平行開發 clobber**:Antigravity/桌機 session 若從舊 checkout 直接 commit 到 main,會把雲端 session 已 merge 的檔案默默還原。**通則**:跨 session 動同一檔案前先 `git pull`;發現 main 被 stale 覆蓋時,用 `git diff <pre-feature> <wip>` 確認是否純還原,再從正確 commit checkout 回檔案,別動對方真正的新功能。
- **canvas 尺寸**:依賴某個時間點的 `offsetWidth` 很脆(splash/takeover/分頁未 layout 都會 0)。用 **ResizeObserver** 自我修復才穩;固定 `width/height` 屬性的 canvas(ANS)則天生免疫。
- CI 不涵蓋 `apps/preview/**` → 波形要 founder 手機實走驗(Cardiac 頁出現 ECG+HRV 線、leading dot;滑去 Respiration/ANS/Energy 都動)。

---

# 2026-06-18 Session Update (結果頁 Snapshot 修好：圖表躲在底部 bar 後面 + 不能換組 — #108)

> Founder(IMG_8852,tall iPhone):結果頁 `/preview/v6/` Snapshot **還是**看不到圖表、也沒辦法選另外一組(同 #103/#106 那個 carousel,在高螢幕手機從沒真的修好)。

## 根因(一個,解釋兩個症狀)
- `.screen` 是 `position:absolute; inset:var(--top-safe) 0 0 0` → containing block 是 `.screens` 的 **padding box**,`bottom:0` 直接貼視窗底 → `.screens` 用來預留 FDCB+tabbar 的 `padding-bottom` **對 `.screen` 無效**。Timeline/Lab 沒事是因為 `.timeline-body/.lab-body` 各自帶 `padding-bottom`(L676/744);Today 的 `.snap` 只留 `6px` → `.snap` + `flex:1` 的 `.snap-track` 整個伸到 FDCB bar + tabbar 後面。
  - `.vwave{margin-top:auto}` 把圖表釘在卡片底 → 躲到兩條 bar 後 → **看不到**;`.snap-dots` 同樣被蓋(截圖無點)。
  - 螢幕上只剩數字那條細帶可摸,其餘 track 在 FDCB(它本身也是會滑的 carousel,有自己的點)+ tabbar 底下 → **橫滑被吃掉** → 換不了組。

## What was done — `apps/preview/v6/index.html`(純 CSS)
- **`.snap`**:底部 padding 改成 `calc(var(--tabbar-h)+var(--fdcb-h)+var(--fdcb-gap)+10px)` 預留(跟 Timeline/Lab 同款)→ carousel + 點移到兩條 bar 上方。
- **`.snap-track`**:`flex:1` → `flex:none; height:190px` 固定高。固定高**不會塌**(#103)也**不會撐到 bar 後**(#106),整張卡(數字+54px 圖表)在畫面內、可滑。
- JS 沒動 —— canvas 一直有畫(offsetWidth/Height 非 0),只是被擋住。

### 教訓
- **#103/#106 都白調了**:之前只動 `flex:1`/`min-height` 盲調,從沒處理**遮擋**這個真因 —— `.screen` 絕對定位讓 `.screens` 的底部預留對 Today 失效。**通則**:Today 的 `.snap` 要自己帶 FDCB+tabbar 底部預留(別指望 `.screens` padding),且彈性容器內的橫向 carousel 用**固定高**比 `flex:1` 穩(`flex:1` 會吃掉延伸到 bar 後的空間)。
- CI 不涵蓋 `apps/preview/**` → 連 #105→#106→#108 三輪都「綠了卻在 iOS 壞」。**手機實走才算數**;待 founder 回報(圖表/點/滑動;短螢幕圓點是否被切)。另 #107 點頭測試結論也待回報。

---

# 2026-06-18 Session Update (Guided Lock-On 誠實精準升級：真 pitch + 掙來的 confidence — #107)

> Founder 選「honest precision boost」:讓對位**真的**更嚴、讓 confidence band 是**掙來的**(非裝飾)。兩個真缺口 —— ① `level` 只看 roll(歪)+yaw(轉),**低頭/抬頭(pitch)沒抓** → pitch 歪的 neutral 也能鎖成基線;② `sampleConfidence()` 只看穩定/亮度/置中,忽略已量到的對位品質。

## What was done — `apps/preview/soul-enroll.{js,html}`
- **真 head pitch**:`loadLandmarker` 開 `outputFacialTransformationMatrixes`(只是 metadata,GPU→CPU fallback 不變);`ingestLandmarks` 從 column-major 4×4 算 `pitch(deg)=atan2(-d[6],d[10])`(正面≈0,點頭變大),矩陣缺失→0 不卡關。新 `state.lm.pitch` + `ALIGN.pitchMax=12°`;`level` gate 多要求 `|pitch|≤pitchMax`。gate 用 `|pitch|` → 分解的正負號/慣例無關緊要,只看偏離量。
- **方向化 nudge**:`pickAlignNudge` level 分支按主導偏軸給 sign-safe 子句 —— pitch 主導「Keep your chin level — not up or down.」/ yaw「Face the camera straight on.」/ roll「Keep your head upright.」(不猜上下,避免講錯方向)。
- **掙來的 confidence**(mirror 手機 `confidence.ts` 精神):MediaPipe 在跑時 `0.25 still + 0.18 brightness + 0.15 uniformity + 0.12 centering + 0.15 frontality + 0.08 eyeOpen + 0.07 distIn`(和=1)。**frontality 刻意排除 yaw** → arc 轉頭階段不被扣分(roll+pitch 全程該≈0)。Tier B/無 landmark → 回退原本 4 項(優雅退化)。baseline-data 清單誠實列出 **Head position + Distance**。

### 注意 / 待辦
- **唯一 headless 無法驗的點**:若手機上「用力點頭」`level` pip 完全沒反應,代表矩陣 layout 要換另一個 off-diagonal(`d[9]` 取代 `d[6]`)—— 一行的事。請 founder 在 iPhone Safari 特別試「下巴上抬/下壓」這個動作回報。
- 沿用 #101 Guided Lock-On 管線(`state.lm`/`alignChecks`/`pickAlignNudge`/`runAlign`),無新 FSM/overlay/pip(`level` 吸收 pitch,`ALIGN_KEYS` 仍 4)。`node --check` 過;CI 不涵蓋 `apps/preview/**` → 手機實走驗(low-light/距離/睜眼/正面 → band 高低是否合理)。

---



> Founder(IMG_8824):HR/HVR 數字變大了(好)**但圖表要滑才看的到**、**沒有磁鐵感定位反饋**、想要「滑動就清楚看到 數字+圖表 → 再滑就下一組」、目前點小點切換不爽、**Body Battery 能不能動起來**。「像 Fable5 一樣思考,幫我規劃。」

## What was done — `apps/preview/v6/index.html`(`.snap` 區整段重建)
- **一頁一組(數字+圖表同時看得到,不用滑)**:從「兩指標並排、波形被擠到要滑」改成 **4 頁、每頁一張 `.vcard`** —— ① Cardiac(HR+HVR)② Respiration(RR+Stress)③ Autonomic(交感/副交感)④ **Energy(Body Battery)**。每頁高度 fit 進垂直預算(`.vcard` min-height 168),數字(40–46px)+波形(54px)在同一張卡內全可見。
- **peeking 磁吸 carousel(切換爽感)**:頁 `flex:0 0 84vw`、track `padding:4px 8vw`、`scroll-snap-align:center` + **`scroll-snap-stop:always`**(一次只走一頁)→ 露出鄰頁邊緣暗示可滑;**鎖定反饋** = 中央頁 full opacity/scale、鄰頁 `opacity:.5 scale(.9)` 變暗縮小 + 落定瞬間 `.pulse` 彈一下 + `navigator.vibrate(10)` 震動。`centeredIndex()`(中心最近的頁)比 `scrollLeft/clientWidth` 在 peeking 版面更穩。dots 仍可點(`scrollToPage` 置中)但主要靠滑。
- **Body Battery 動起來**:① 數字 `bbVal` 跟著共享 breath phase 78±2 微浮動;② `.bb-bars::after` 一條斜向 charge-flow 光澤 `bbFlow` 3.4s 來回掃(充電感)。原本 15 根 bar 的 JS(L2977)不動。
- **沿用**:#102 的同步活訊號(共享 `ph=t*0.0011`,HR/HVR/RR/Stress 一起 tick、交感↔副交感反相 canvas 波 + bar)、#104 的監視器格線(`.live-wave/.ans-wave` repeating-linear-gradient)。score reveal 未動。

### 教訓 / 注意
- **垂直預算很緊**:hero ~38vh + `.snap` 底部保留 `calc(tabbar74+fdcb58+gap10+24)≈166px` → 只剩 ~240–293px 帶寬。舊版(carousel 206 + coach + dots + 獨立 bb-card)會 overflow → 把 Body Battery 收成第 4 頁(移除垂直競爭者)就 fit。**單卡一頁** 是讓「數字+圖表同時可見」的關鍵。
- 沿用 #103 的 collapse 修法:`.snap-track` 仍 `flex:none` + 明確 `min-height` + `overflow-y:hidden`(flex 容器內橫向 scroll carousel 必備,否則塌成 0)。
- 全合成 demo 值;CI 不涵蓋 `apps/preview/**` → **手機實走驗**(滑動磁吸感、4 頁是否都完整顯示、Body Battery 是否在動)。振幅/速度可在 script `ph` 係數調。

---

# 2026-06-16 Session Update (結果頁 Snapshot：磁吸滑動 carousel + 同步活訊號 — #102)

> Founder:結果頁(`apps/preview/v6/`)雙環數字下方 Snapshot 要更好讀、醫療級、會動;滑動像磁鐵鎖定(HR/HVR → RR/壓力),含交感/副交感同步波動;上下空間變大。

## What was done — `apps/preview/v6/index.html`(`.snap` 區)
- **磁吸滑動 carousel**:`#snapTrack`(`scroll-snap-type:x mandatory`,iOS 原生磁吸)3 頁 —— 1) Heart Rate + HVR、2) Respiratory + Stress、3) **ANS 交感/副交感**;下方 page-dots 鎖定指示(scroll 監聽算 index → active page 放大/鄰頁淡縮)。
- **同步活訊號**:一個共享 breath phase 驅動所有數字一起微浮動(HR 66–70、HVR、RR、Stress)+ **交感/副交感反相波動**(SNS 升↔PNS 降,canvas 畫 anti-phase 正弦 + bar 寬度/百分比同步)→ 醫療監視器的「活著」感。數字 ~1Hz tick、波形每幀。
- **版面放大**:每頁 `.card.metric` min-height 172、數字 46px、波形 height 74、column 排版 → 更好讀。Body Battery 保留(carousel 下方),bbBars JS 不動。
- 純前端(synthetic demo 值,合規:非醫療宣稱;raw biometric 不上雲——本來就全合成)。reveal/score(#tlTlTlTeiScore=84)未動。

### 注意
- 全合成假值;CI 不涵蓋 `apps/preview/**` → 手機實走驗。波形/浮動幅度可再依回饋微調(script 內 `ph` 係數 + 各 `Math.sin(...)` 振幅)。
- **#103 修 collapse(教訓)**:carousel 一開始整個 0 高度看不到卡片。根因 = `.snap-track` 是 `.snap`(flex column)的 flex item,給了 `overflow-x:auto` → 另一軸 `overflow-y:visible` 自動升級成 `auto` → 變成雙軸 scroll container → flex item 的 `min-height:auto` 變 0 → 被壓成 0 高並裁掉內容。**修法**:`flex:none` + 明確 `min-height` + 明確 `overflow-y:hidden`(避免自動升級)。**通則**:flex 容器裡的橫向 scroll-snap carousel,容器要 `flex:none`/明確高度,否則會塌。

---

# 2026-06-16 Session Update (Guided Lock-On：一步步精準對位 — #101)

> Founder:「一步步協助精準對位(智能提醒)、對位完成有超棒反饋、且實際提高掃描精準度/可靠性;連 10 歲小孩都會操作。」核心真理:baseline 只有在**一致、受控的條件**下量測才有意義 → 引導精準對位 = 強制**可重複性** = 真精準(非裝飾)。

## What was done — `apps/preview/soul-enroll.{html,js}`(正式流程 face_detecting 段)
- **解鎖量測**:MediaPipe 開 `outputFaceBlendshapes` → 眼開度/眨眼;從 landmark 算 **inter-ocular 距離**(遠近)、**roll**(頭歪)、cx/cy(置中)。原本只有 brightness/uniformity/motion/centerOffset/coverage/yaw。
- **Guided Lock-On**:`face_detecting` 改成一次一個目標的引導對位 —— 單一最重要提醒(優先序 present>light>distance>center>level>eyes,debounce 不閃爍)、每個子目標 hold 350ms 才鎖定(磁吸 hysteresis)、4 個 pip(Distance/Center/Level/Eyes)鎖定變綠、**「把點移進圈圈」**中央 dot+target(小孩友善,鏡像 x)、子鎖定有 haptic + flash 反饋、全鎖定→大 haptic→face_locked。
- **晶格「對焦」**:`uGlitch = max(headTurnGlitch, (1-alignProg)*0.5)` → 沒對準時粒子散亂/glitch,鎖定時收斂清晰(誠實訊號 + 美學)。
- **永不卡死**:present 達 9s 直接放行;MediaPipe 沒 active → 回退原本 2D detect 行為(零回歸)。
- 常數 `ALIGN`(distMin/Max、centerMax、rollMax、yawMax、eyeOpenMin、holdMs)集中可調。

### 注意 / 待辦
- **可調**:距離帶 distMin 0.085/distMax 0.22 等是估值,要 founder 手機實測微調(iОS Safari 無法 headless 驗證)。
- **下一步(plan 內)**:錄下 locked 對位 signature(距離/姿態/框/光)存基線 → 日後每日掃描引導對位「對齊基線」= apples-to-apples;把 alignment quality 餵進 `sampleConfidence()`/engine `ConfidenceBreakdown`;之後 mirror 進 `apps/mobile`(複用 FaceScanFrame/MotionGuideCue/QualityStatusPills + deriveQualityStatus + 測試)。

---

# 2026-06-14 Session Update (TENKI Pulse：會學習迭代的觸覺 — #95 cyberpunk / #96 引擎 / #97 原生 adapter)

> Founder:「適時的震動反應,讓 TENKI 感覺有生命、而且震動會學習迭代。」

## What was done
1. **Ghost Protocol cyberpunk restyle #95**(`apps/preview/baseline-3d.{html,js}`):把 Soul Lattice 改成特務 HUD —— 菱形資料節點 shader + 多重掃描線 + 轉頭 glitch + 更銳利 bloom + 鎖定二十面體核心/資料環/六邊形衝擊波 + DOM HUD(準星/NODES/SYNC/THREAT)。**合規:拿掉 founder 提的「HR 87 bpm」假心率讀數**(privacy-first,不暗示量測生理/醫療),改用 SYNC/NODES/THREAT。
2. **TENKI Pulse 引擎 #96**(`packages/engine/src/haptics/`,275 測試全綠):純函式、platform-neutral。`scanEventPulse`(臉鎖/tick/里程碑/鎖定)、`zonePulse`(Clear 呼吸/Neutral 穩/Strain 較銳)、`evolvePulseProfile`(依基線成熟度 new→building→ready→mature + zone EWMA 學習迭代,強度/節奏/refinement 有安全上下限)、`toWebVibration`。
3b. **Ghost Protocol 移植進正式流程 #98**(`apps/preview/soul-enroll.{html,js}`):正式 `/preview/` capture 段從 478 點雲升級成 ~6k 資料節點粒子晶格(菱形 shader + rim + 掃描線 + 轉頭 glitch + UnrealBloom);守 cyan(ACTIVE)→gold(SECURED) 法則(橙當掃描 accent);保留 FSM/chrome/processing/v6 + 2D 星塵 fallback。
3c. **Agent HUD 進正式流程 #99**(soul-enroll,founder 選 option 2):capture 段顯示特務 HUD —— 中央準星 + brand/binary + NODES(粒子數)/SYNC(captureProgress%)/THREAT:LOW/MODE:GHOST。用 cyan/gold + mono(不套原型橙重配色),只在 `M3D_PHASES` 步驟顯示,純 DOM overlay 零功能風險。ON-DEVICE 沿用既有 securedPill 不重複。
3d. **Ghost Protocol 音效 #100**(`apps/preview/baseline-3d.{html,js}`,**原型先做**):Web Audio —— scanning 時低頻 breathing hum、phase 切換 tick、locking whoosh(noise bandpass sweep + low thud)、locked confirm 雙音。**opt-in**:「▶ Ghost Protocol · Sound」toggle(預設關;tap 同時 unlock iOS AudioContext)。色彩/glitch 微調待 founder 具體方向(需他的眼睛,不盲調)。滿意再 port 進正式流程(聲音進 onboarding 是品牌決策,先原型)。
3. **原生 adapter #97**(`apps/mobile`,61 測試全綠):`utils/pulse.ts`(engine 的 mobile mirror,重用 `maturityStage`)、`utils/pulsePlayer.ts`(把 HapticPattern 播成連續 expo-haptics impacts:intensity→ImpactFeedbackStyle、gap→節奏)、`stores/pulse-profile-store.ts`(persist/AsyncStorage 的學習 profile)、`useBaselineHaptics.playPattern()`。

### ⚠️ 關鍵限制 / 注意
- **iOS Safari 網頁完全不能震**(`navigator.vibrate` 無效)→ 真震動只能原生 app;founder 要 **Mac/build** 才感受得到。這也是為何先做「引擎 + adapter」(純 TS 可測),不靠裝置驗證。
- **mobile 不在 root workspaces、不 import `packages/engine`** → 沿用既有慣例「mobile 自帶 util mirror engine」(如 `maturityStage`/`qualityThresholds`)。`apps/mobile/.../utils/pulse.ts` 是 engine TENKI Pulse 的 mirror,**改其一要兩邊同步**。
- 合規:profile 全裝置端、無生理原始資料、不上雲;震動是「感受」非醫療宣稱;`reducedMotion` 時不震。

## Next session（接手點 — 待 founder 有 Mac/build）
1. **最後一哩(會動到掃描畫面,要實機測才做)**:把 3 接線點接進實際 screens —— 臉鎖/掃描/鎖定→`playPattern(scanEventPulse(...))`、分數揭曉→`playPattern(zonePulse(zone,profile))`、掃描完成→`usePulseProfileStore.getState().recordScan(zone,score)`。
2. Ghost Protocol 手感微調(配色/glitch/掃描線);或加音效 + 「Activate Ghost Protocol」切換。
3. 把 Soul Lattice / Ghost Protocol renderer 移植進正式 soul-enroll capture 段(目前正式流程仍是 #94 發光點雲版)。

---

# 2026-06-14 Session Update (3D 視覺「飛躍」：Soul Lattice 發光粒子晶格 #94 已 merge)

> Founder 要 3D 不露臉建模有「飛躍的大升級」(看了 Fable 5 vs Opus 行銷影片受啟發 —— 那些 4M token/GTA VI 宣稱是未證實行銷,不採信,但「要大躍進」的需求照做)。

## What was done
1. **Soul Lattice 升級 PR #94**(只動獨立原型 `apps/preview/baseline-3d.{html,js}`,**不碰正式 soul-enroll**):
   - **478 點 → ~5–6k 粒子**:沿 `FACE_LANDMARKS_TESSELATION` 每條邊插值取樣(`K_PER_EDGE=2`),每幀 = 兩端 landmark 的 lerp。
   - **真 Bloom**:`EffectComposer + UnrealBloomPass`(import map 加 `three/addons/`),composer pixelRatio 降到 1.5 給手機。
   - **自訂 ShaderMaterial**(Points):depth 打光 + 移動掃描光帶 `uScanY` + 每粒子 twinkle + `uMix` cyan→gold,additive。
   - **編排**:forming 粒子**從散開球面飛入**(staggered, smoothstep);locking 收束成金核 + **擴散衝擊波環**(RingGeometry)。
   - 仍 privacy-first(無真實臉部像素)、鎖定釋放相機。先 prototype 驗收,**OK 後再移植進 soul-enroll capture 段**。

### ⚠️ LESSON(這次踩到)
- **Squash-merge 同一條分支不 rebase → 會撞合併衝突**:#94 一開 PR 就 `mergeable_state: dirty`(`MEMORY.md` 三方合併打架),因為 merge-base 還停在舊 commit、main 是 squash 出來的新樹。**解法 + 往後習慣**:每次 squash-merge 後 `git fetch origin main && git reset --hard origin/main`(force-with-lease push)把分支同步回 main,下個 PR 才乾淨。本次已用 `git reset --soft origin/main` 收成單一 commit 解掉。

## Next session（接手點）
1. **收 founder 對 Soul Lattice 的回饋**(`/preview/baseline-3d.html`):夠不夠飛躍 / 效能順不順。
2. 滿意 → **把 Soul Lattice renderer 移植進 `soul-enroll.js` 的 `m3d` 層**(取代目前正式流程的 478 點版);注意保留漸進增強 fallback。
3. 想更猛:afterimage 拖尾、虹彩漸層、真實法線受光、blendshapes 眨眼 liveness。
4. 原生(需 Mac):ARKit TrueDepth / vision-camera + MediaPipe RN。

---

# 2026-06-14 Session Update (3D 互動式臉部基線建模：MediaPipe + Three.js，#91/#92 已 merge)

> Branch `claude/face-baseline-enrollment-9cacp6`。Founder 要「第一次臉部掃描」像 Face ID 一樣超酷超專業、且**不一定要露臉**。決策:**只用在基線建立**(日常 Soul Scan 維持 v6 星塵)。

## What was done
1. **方向(model B-honest + privacy)**:不顯示鏡頭畫面,只渲染從臉推導的**抽象 3D 點雲/網格**(Face-ID 點陣投影器美學)→ 同時超專業 + 超隱私。
2. **獨立原型 PR #91**(`apps/preview/baseline-3d.html` + `.js`):MediaPipe FaceLandmarker(478 個 on-device 3D landmark)+ Three.js 點雲 + tessellation 網格。儀式 `loading→await_face→forming(掃描成型)→scanning(轉頭旋轉)→locking(青→金收束金核)→locked`。獨立網址 `/preview/baseline-3d.html`,純展示驗證手感。
3. **接進真正流程 PR #92**(`apps/preview/soul-enroll.{html,js}`):把 capture 段(`face_detecting→stability`)的 2D 星塵換成 3D 模型。真 landmark 置中取代啟發式;capture 時隱藏鏡頭預覽。**保留**環境檢查(3 燈)、金球 processing、基線數據、v6 銜接。
   - 接法:HTML 加 import map(`three`)+ module bootstrap 把 `window.THREE`/`window.TENKI_MP` 掛上;加 `#model3d` WebGL 層。soul-enroll.js 維持 classic IIFE,新增 `m3d` 場景 + `detectLandmarks`/`ingestLandmarks`;`state.mpActive` 時用 landmark 的 centerOffset/coverage 餵進 `evalGates`,gating 放寬成 `(state.mpActive || state.tierA)`。
   - **漸進增強/零回歸**:3D 是加強層,`m3d.ready` 為 false(CDN 載不到)→ 自動回退既有 2D 星塵流程。
4. **CTA 卡關 hotfix PR #93**(`soul-enroll.html` CSS):founder 回報跑到「Baseline established」頁就過不去——金色「Start your first scan」按鈕被 **iOS Safari 底部工具列蓋住**(`100vh` 比可視高度高,底部對齊內容被推到螢幕外)。改 `html/body/#stage` 用 **`100dvh`**(留 `100vh`/`100%` fallback)、`#stage overflow-y:auto` 保險、縮 `#copy` 底 padding(`58→max(20px,safe-area)`)/`#indicators`/`#baseline-extra`/`.bx-list` 間距。流程現在能一路接到 `/preview/v6/` 星塵靈魂掃描。

### 關鍵突破 / 注意
- **MediaPipe 自帶模型 → iOS Safari 也能拿到真 478 landmark**,一舉解掉之前「iOS 無 `FaceDetector` 只能啟發式」的痛點。
- **iOS Safari `100vh` 陷阱**:底部對齊的 CTA 會被工具列蓋住 → 一律用 `100dvh`(+ fallback)。preview 全屏儀式頁都要注意。
- CDN(runtime,founder 瀏覽器):`three@0.160.0`(jsdelivr)、`@mediapipe/tasks-vision@0.10.12`(jsdelivr,含 `/wasm`)、model `face_landmarker.task`(storage.googleapis.com)。容器無法 headless 驗證,靠手機實走。
- arc「轉頭」目前是**視覺旋轉**(模型即時跟著轉),進度仍走既有 handheld 計時 —— 沒硬卡 yaw,避免 dead-end。

> 上線狀態:#91/#92/#93 全 merge 進 `main`(最後 `adbf696`),Vercel 自動部署。完整流程 `/preview/` 基線(3D capture)→ processing → Baseline locked → 基線數據 →「Start your first scan」→ `/preview/v6/` 星塵靈魂掃描 + Today 84。

## Next session（接手點）
1. 收 founder 手機回饋,微調 `M3D.SCALE`/`DEPTH`/`SMOOTH`、點大小、網格 opacity(都在 `soul-enroll.js` 的 `M3D` 與 `m3d.points/lines` material)。
2. (選做進階)把 arc 改成**真 yaw 覆蓋進度**(轉頭補完背面)+ blendshapes 眨眼 liveness(MediaPipe `outputFaceBlendshapes`)。
3. 原生(需 Mac):iOS ARKit TrueDepth 真深度版當旗艦;或 vision-camera + MediaPipe RN plugin 移植進 `apps/mobile`。

---

# 2026-06-13 Session Update (上線 + 手持卡頓 hotfix：#89/#90 已 merge 進 main)

> Branch `claude/face-baseline-enrollment-9cacp6`。這次把前面兩段（門面 + Model B 旅程）開 PR、收 founder 手機回饋、修 bug、上線。

## What was done
1. **PR #89** = 門面（真鏡頭 live gates）+ Model B 全程旅程 + 金色 processing 頁 + mobile parity → squash-merge 進 `main`（CI 全綠）。
2. **Founder iPhone 回饋**：`/preview/` 卡在第二頁（環境檢查）— Lighting✓ Centering✓ 但 **Stillness 永遠灰**，三燈無法同時亮 → 流程不前進（「只有兩頁」）。
3. **手持 hotfix（PR #90，已 merge `a2441a7`）**：`soul-enroll.js` 的 motion 門檻對手持太嚴（`motion = 每像素平均亮度差 / 40`，Stillness 要 ≤0.16 = 平均差 ≤6.4，手機微震永遠超過）。放寬 `motionStill 0.16→0.40`、`motionNeutral 0.15→0.36`、`motionStability 0.13→0.30`、`motionArc 0.36→0.62`；`ENV_HOLD_MS 1500→1100`；新增 `ENV_FALLBACK_MS=6000`（Lighting 過且停留 >6s 就自動前進 → ceremony **永不 dead-end**）。門檻仍有反應（遮鏡頭 Lighting 紅、大動作 Stillness 跳）。

### ⚠️ LESSONS（寫進來避免重犯）
- **CI 不涵蓋 `apps/preview/**`**：`ci.yml` 只測 `packages/** + domain + apps/mobile`；`biome.json` 的 `files.includes` 也只有那三個。所以 preview 壞掉 CI 不會抓到 → **preview 改動一律手機實走驗證**，別靠 CI 綠燈當保證。
- **GOTCHA：#89 在我推 hotfix 之前就被 squash-merge** → 修正落在已關閉的分支、不在 main、CI 不會跑（PR 已 closed）→ 只好開 catch-up PR #90。教訓：preview 類改動最好在 founder merge 前就 push 完整；或預期會有補丁 PR。
- **Vercel deployment protection**：分支 preview 與正式站 `vercel.app/preview/` 匿名抓都 403，無法用 WebFetch 驗證部署內容；founder 是登入狀態才看得到。要程式化驗證得用 Vercel MCP（需授權）。

## Next session（接手點）
1. 收 founder 在 iPhone 確認 `/preview/` 整條（環境 → lock → neutral/arc/stability → processing 金球 → Baseline locked → 基線數據 → v6）順走。
2. 若手持門檻還是太鬆/太緊，微調 `T.motion*`（檔案 `apps/preview/soul-enroll.js`）。
3. （選做）v6 揭曉分數依即時品質浮動 + 清 `tlTlTlTeiScore` 命名；原生 vision-camera（需 Mac）。

---

# 2026-06-13 Session Update (Model B 全程串接：基線 → 掃描 → 結果，導入 v6)

> Branch `claude/face-baseline-enrollment-9cacp6`。承上：soul-enroll 之前停在「Baseline locked.」就沒了。本次把第一次的完整 Model B 旅程串起來。

## What was done（commit-per-todo）
1. **soul-enroll 旅程延伸**（`soul-enroll.js`/`.html`）：「Baseline locked.」→ 新增**質化「基線數據」快照**（maturity New、signal quality band、捕捉到的參考訊號清單 Steadiness/Centering/Lighting/Eye openness、文案「This is your personal reference — not a score」）→ CTA `Start your first scan` **導入 `/preview/v6/?from=baseline`**（重用既有星塵臉部掃描 + Today 揭曉 Edge Score）。決策：重用 v6（不另做掃描/結果頁）；分數維持固定 84（不動 v6 邏輯）。
2. **Processing 頁不漏掉**（founder 指定附圖）：把 `processing` 從一閃而過改成顯眼的**金色軌道球體**畫面 — canvas 畫 3 條傾斜旋轉金環 + 亮核 + glass sphere，搭配大字 `%` 倒數（PROCESSING_MS 1900→2800），文案「Securing your unique baseline…」+「All data is processed and stored locally for maximum privacy.」對齊附圖。
3. **手指流程收尾導入 v6**（`baseline-onboarding.js`）：`selectNextAction` 由 `/v3/…` 改為 founder 指定的 `/preview/v6/…`（scan→`?from=baseline`、explore→`#lab`）。Model B：finger PPG = 校準層，完成後進 Today 首頁。

### Notes / gotchas
- 完整 Model B 第一次旅程：`/preview/`（臉部基線 ceremony）→ 基線數據 → `/preview/v6/?from=baseline`（星塵臉部掃描 + 結果）；finger PPG 走 `/preview/finger/` → `/preview/v6/`。`/v3/` 與 `/preview/v6/` 是同一頁（vercel rewrite 雙路徑）。
- v6 揭曉分數元素 id 仍叫 `tlTlTlTeiScore`（v2 TEI 殘留命名），但對外呈現是 v3（Clear/Neutral/Strain）；本次未動 v6，固定 84。
- soul-enroll 仍是 vanilla canvas，無 Jest；驗證靠手機實走。

## Next session（接手點）
1. 收 founder 在 iPhone 實走整條 `/preview/ → v6` 的回饋。
2. （選做）讓 v6 揭曉分數依即時掃描品質浮動、並清掉 `tlTlTlTeiScore` 的 TEI 殘留命名。
3. 原生（需 Mac）：vision-camera 真 landmarks → 真 6 信號 → Skia。

---

# 2026-06-13 Session Update (Soul Scan 升級成 /preview/ 門面 + 真鏡頭 live gates)

> Branch `claude/face-baseline-enrollment-9cacp6`。目標：讓「第一次臉部掃描」像 iPhone Face ID — 精準、安靜、會對真臉反應。以已部署的 `/preview/` 為基底（founder 認可的最高完成度）。

## What was done（commit-per-todo）
1. **soul-enroll 真鏡頭重寫**：`apps/preview/soul-enroll.js` 從「純計時腳本」改成 **事件驅動 FSM**（鏡像 `faceBaselineMachine.ts`）。
   - 真前鏡頭 `getUserMedia`；每幀抽樣到 80×80 offscreen canvas 算 **brightness / lighting uniformity / motion**（真量測，全瀏覽器有效）。
   - **分層偵測**：Tier A 有 `window.FaceDetector`（Chrome/Edge）→ 真 centering / coverage / face-lock / arc；Tier B（**iOS Safari 沒有 FaceDetector**）退到誠實啟發式（中央細節 + 光線），lock/arc 導引式。
   - 3 個 precision indicators（Lighting/Centering/Stillness）反映**真實 gate 狀態**；environment 三燈同時過 1.5s 才放行。
   - 擷取階段進度**只在 gate 過時累積、掉時暫停不歸零**；持續掉 → `retry_needed` 局部重掃（neutral 重來、arc/stability 保留）。第一次基線用 strict 門檻。
   - 隱私：所有分析在 canvas/on-device，**沒有任何 frame 或衍生資料上網**。
2. **HTML camera layer**：`soul-enroll.html` 加 `<video id="cam-video">`（鏡像、cover、貼合掃描框圓角方形），+ favicon/OG meta 達門面水準。
3. **/preview/ 門面切換**：`vercel.json` 把 `/preview/` → `soul-enroll.html`，finger onboarding 移到 `/preview/finger/`（North Star §1：臉是主入口、finger 是校準層）。DEPLOYMENT_MAP(.md/.json) 同步。
4. **Mobile parity**：env 燈號標籤 `Distance/Stability` → `Centering/Stillness`（key 不變、僅顯示字 + icon🎯），intro 文案對齊 `Create your Face Baseline.`。mobile `npx tsc --noEmit` exit 0、face-baseline 49 tests 全綠。

### Notes / gotchas
- **iOS Safari 無 FaceDetector**（founder 多半用 iPhone）→ 臉部 centering/lock 在 iOS 是啟發式 + 導引；但 lighting/stillness gate 在所有瀏覽器都是真的，所以仍有「會對你反應」的感受。誠實設計，別宣稱 iOS 有真 3D 臉偵測。
- `apps/preview` 是 vanilla JS、沒有 Jest，且 biome 設定忽略它 → preview 驗證靠手機實走（grant 鏡頭、遮鏡頭看 Lighting 變紅擋進度、動一下看 Stillness 暫停進度）。
- 容器乾淨 clone：跑 mobile 驗證要先 `cd apps/mobile && npm install`（不在 root workspaces）。
- `/preview/` 直接路徑 `/preview/soul-enroll.html` 仍可用（內容相同）；finger 舊頁 `/preview/finger/`。

## Next session（接手點）
1. 收 founder 在 iPhone 上實走 `/preview/` 的回饋（節奏、文案、gate 鬆緊）。
2. 原生（需 Mac）：vision-camera frame processor 餵真 landmarks → 真 6 信號 → Skia halo（North Star §6 step 4）。
3. 把 mobile `/face-baseline` 接成 onboarding 主入口（North Star §6 step 3 未做部分）。

---

# 2026-06-13 Session Update (Face Baseline Enrollment — FSM 拆分 + 品質閘 + preview ceremony)

> Branch `claude/face-baseline-enrollment-7bmdmp`，7 commits（commit-per-todo）。落地 SOUL-SCAN-NORTH-STAR §6 step 2 的「雲端可做」邏輯層。

## What was done
1. **FSM 拆分（North Star §5 缺口）**：`motion_capture` → `arc_left` / `arc_right`，新增 `stability_pass`。
   流程 `neutral → arc_left → arc_right → stability_pass → processing`。新事件 `ARC_LEFT_DONE / ARC_RIGHT_DONE / STABILITY_DONE`（刪 `MOTION_DONE`）。`RESUME_TARGET` + `partialRetryPhase` 擴充：arc 失敗保留 neutral，stability 失敗保留 neutral+arc（局部重掃不整套重來）。
2. **QualityMetrics 擴充**：加 6 個臉部信號 `landmarkConfidence / headPoseRange / lightingUniformity / eyeVisibility / neutralExpressionConfidence / totalBaselineConfidence`。
3. **Per-phase 品質閘**：`neutralGate / arcGate / stabilityGate`，每個有 `{ strict }` —**第一次基線比日常嚴格**（`STRICT_DELTA=0.08`，North Star 鐵律 2）。`deriveQualityStatus` 加 arc `poseRange` nudge（arc 容忍轉頭、ceiling 0.6）。`totalBaselineConfidence` 聚合 6 信號（權重和=1）。`captureProgress` 重新加權 neutral .5 / arc .3 / stability .2。
4. **Screens/routes**：`BaselineCaptureMotionScreen` → `BaselineCaptureArcScreen`（arc_left→arc_right 單條閉合光弧 + 單一指令 turn left/right/return to center）；新增 `BaselineCaptureStabilityScreen`（一次自然呼吸）。route `capture-arc` / `capture-stability`。copy 走 compliance（不用「emotion」字眼）。
5. **測試**：mobile 4 suites 49 tests 全綠；`npx tsc --noEmit` exit 0；改動檔 biome 0 warning。
6. **Preview ceremony（給 founder 手機看）**：`/preview/soul-enroll.html`（+`.js`）獨立頁，自包含 canvas 星塵 mesh + 閉合金弧 + 3 個 precision indicators，cyan ACTIVE → gold SECURED，完成時粒子收束成核心 + `Baseline locked.`。對應 mobile FSM。DEPLOYMENT_MAP(.md/.json) 已登錄。

### Notes / gotchas
- 既有 finger ceremony `apps/preview/baseline-onboarding.js`（2000 行、iOS OOM 調校）**沒有**臉部 arc 流程，且改它風險高 → 改開獨立 `soul-enroll.html`，較安全也更貼合「感受 Face ID arc」的目標。
- 容器是乾淨 clone，root 與 apps/mobile 的 `node_modules` 都要各自 `npm ci`（mobile 不在 root workspaces）。`npx biome` 會誤抓到無關的 `biome@0.3.3`；要用 root 的 `./node_modules/.bin/biome`（@biomejs/biome 2.4.16）。biome 設定忽略 `apps/preview`。
- 仍未做（需 Mac，North Star §6 step 4）：vision-camera 真臉部偵測餵 6 信號、Skia halo gradient path、Reanimated 3。screens 目前用 timer mock 驅動（與既有 capture screen 同模式），契約不變、之後可換真信號。

## Next session（接手點）
1. 原生 session（Mac）：`useFaceDetector` frame processor → 真 landmarks → 真 6 信號餵 per-phase gate；Skia 化 halo。
2. 產品定位：把 `/face-baseline` 接成 onboarding 主入口；Scan tab 重定位為日常 Soul Scan（讀已建立 baseline），finger PPG 移校準層（North Star §6 step 3）。
3. 收 founder 看 `/preview/soul-enroll.html` 的回饋再迭代節奏/文案。

---

# 2026-06-13 Session Update (準星重設計 + 視覺迭代收口)

## What was done（PR #84、#85 均由 founder merge）

1. **Soul Lock 準星重設計（PR #84）**：founder 嫌舊準星難看 — 它是「虛線旋轉圈 + 十字箭頭 + `--` 殘影」的軍用 HUD 混合體。重設計為 Face-ID 級安靜 locus：96px 細環 + 四方位微點，等待白色呼吸（3.2s）、鎖定青色 bloom、訊號弱琥珀。十字箭頭全刪；計時改 300 字重、倒數前隱藏。
2. **同輪精準化（PR #84）**：face 模式 JS 蓋掉英文標題的 bug 修正（`Environment Calibration` 保住）；就緒頁降噪（藏 finger 時代 stage chips 與重複標題，coach 氣泡 = 唯一即時指令）；全 cosmos 畫面補紫/粉/藍三層 CSS 星雲；intro 去圓章 icon。
3. **黑屏遮擋修復（PR #85）**：掃描頁可捲動，但 `.scan-backdrop` 是 absolute — 跟著捲，95% 黑的 vignette 邊緣橫切畫面蓋住 banner/狀態列。改 `position: fixed` 釘 viewport + 黑度放軟 0.95→0.52。

### Notes / gotchas
- **scrollable step 裡的 `absolute inset:0` 覆蓋層都有同樣風險**（只蓋第一個視窗高、邊緣會滑進內容）— `.step::before/::after` 的星塵/星雲因為漸層淡出所以無感，但任何高對比 overlay 要用 fixed。
- 準星等互動狀態的視覺現在集中在 styles.css 尾部的 override 區塊，調整大小/顏色/呼吸速度都是單行改動。

## Next session
1. 視覺回饋隨時繼續（founder 連續快速 merge，迭代節奏很順）。
2. FSM 補缺口（雲端可做）：`arc_left/right`、`stability_pass`、QualityMetrics 擴充 + 測試。
3. 原生 session（等 Mac）：vision-camera 真信號、Skia orb、實機 QA。

---

# 2026-06-12 Session Update (品牌定案入庫 + Soul Scan 定調 + /preview/ 視覺對齊)

## What was done（PR #81、#82 均已 merge）

1. **品牌 Logo 定案入庫（PR #81）**：founder 的定案 mark（風掃過的浪）一直只存在 v6 splash 的 HTML 裡。已正式化：
   - `docs/assets/brand/tenki-mark.svg`（從 v6 splash 抽出的 master，currentColor）
   - `apps/mobile/assets/` 四個 PNG 全部從 master 重新輸出（之前是 Expo 佔位符！）
   - ANTIGRAVITY.md §18 = FINALIZED 規格（三段式 lockup：mark / TENKI 200·0.32em / CORE 600·0.4em `#00B4D8`+glow；動態 900ms 入場 + 6s 呼吸）
   - `/preview/brand/` 品牌預覽頁；中途的 Resonance Ensō 探索版已移除
   - 分工：`docs/BRAND.md` 管品牌語言、§18 管視覺，互相引用
2. **Soul Scan North Star（PR #81）**：`docs/SOUL-SCAN-NORTH-STAR.md` — 臉部基線 = 主掃描入口、finger 退為校準層、Face-ID 級首次建立、與現有 FSM 對照（缺口僅 `arc_left/right` 拆分 + `stability_pass` + 6 個原生品質信號）。CLAUDE.md 已加必讀指標。
3. **Visual Alignment Sprint（PR #82）**：`apps/preview/` 三畫面對齊參考圖（task.md P1–P3 全勾，5 commits）— tokens 進 `:root`、深空漸層 + CSS 星塵、漸層+光暈 CTA、Env Calibration 三顆狀態 pills（接 latched 訊號）、金框+藍弧+刻度尺+PRIVACY SECURED 的 capture 畫面。**task.md 寫的 "apps/web" 是筆誤，實際目標是 apps/preview**（apps/web 仍凍結未動）。
4. **持續擦屁股**：main 直推又兩次破壞（async-storage 沒裝、§18 衝突），均已修復。domain 測試 9 → 45。

### Notes / gotchas
- **Antigravity 仍在直推 main** — 已三度把紅燈/缺依賴帶進 main。請改走 feat/* → PR。
- npm 指令的 shell cwd 會在工具呼叫間被重置 — 在 apps/mobile 裝依賴務必用單一命令 `cd /abs/path && npm install ...`，否則會污染 root package.json。
- 背景 agent 可能撞 session 用量上限被砍 — 重要工作檢查 `git log` 確認實際 commits，別信 agent 的完成宣稱。

## Next session
1. 視覺二輪：吃 founder 看 `/preview/`、`/face-baseline/`、`/preview/brand/` 的回饋。
2. FSM 補缺口（可雲端做）：`arc_left/right`、`stability_pass`、QualityMetrics 擴充 + 測試（見 SOUL-SCAN-NORTH-STAR §5/§6）。
3. 原生 session（需 Mac）：vision-camera 真信號、Skia orb、實機 QA。

---

# 2026-06-11 Session Update #2 (main CI 紅燈修復 + 9 屏視覺對齊 pass)

## What was done（同分支續用，PR #79）

1. **修復 main CI 紅燈**：Antigravity 桌機把 Phase 1 視覺、Phase 2A（Skia+haptics）、2B（live camera）直推 main，8 個 commits CI 全紅。修復內容：
   - `BlurMask` 沒有 `sigma` prop → `blur`（兩個 `*Skia.native.tsx` 共 12 處）
   - 平台分檔 `*Skia.native/.web.tsx` 缺 tsc 解析目標 → 補 `.d.ts` shim（Metro 選平台檔、tsc 讀宣告）
   - vision-camera **v5** 沒有 `Camera.requestCameraPermission()` → `VisionCamera.requestCameraPermission()`（回傳 boolean）
   - hooks barrel 還在 export 已刪除的 `setHapticsImplementation`/`HapticsImpl`
   - hook 改為直接 import react-native 後破壞「無 RN 的 jest harness」→ `shouldFireHaptic` 純邏輯移回 `utils/haptics.ts`，hook re-export
   - 11 個 lint errors（forEach return + index keys）
   - `BrandWordmark` 的 favicon require 多一層 `../` → **web bundling 直接失敗**（dist 被 expo export 清空才發現）
2. **9 屏視覺對齊 pass**（founder 給 9 張 canonical 參考圖 + 嚴格任務書「收斂不創新」）：
   - 安裝 `expo-linear-gradient@~15.0.7` + `expo-blur@~15.0.7`（Expo Go + Web 相容）
   - 真 LinearGradient / BlurView 全面取代硬切色塊假漸層假毛玻璃；14 個 style commits（tokens → shared 元件 → 逐屏）
   - 逐屏自評 7.5–8.5/10，誠實差距與被原生卡住項目都寫在 PR #79 描述裡
3. Expo Web bundle 重建（`dist/` 是 gitignored，要 `git add -f`，沿用 Antigravity 的 force-add 慣例）。

## 結果
- **PR #79 已 merge**（founder 審過 preview）→ main CI 回綠，`/face-baseline/` 固定網址已是視覺對齊版。

### Notes / gotchas（給下個 session）
- **不要直推 main**：CI 只能擋 PR，直推會把紅燈帶進 main。Antigravity 桌機請改走 `feat/*` → PR。
- vision-camera v5 的 permission API 在 `VisionCamera` factory 上，不在 `Camera` 元件上。
- `expo export` 失敗時會先清空 output dir — dist 消失即 build 失敗的訊號。
- jest contract harness 依賴「`utils/` 永遠不 import react-native」這個約定，動 hooks 時要保持純邏輯在 utils。

## Next session
1. PR #79 merge 後：視覺第二輪（吃 founder 看 preview 的回饋）。
2. 原生 session（需 Mac）：Skia orb shader（消除同心圓色帶）、相機實拍、實機 haptics、Reanimated 轉場。
3. P2 backlog 不變：encrypted SQLite 持久化、Today tab 接 engine、domain policies 測試、Maestro E2E。

---

# 2026-06-11 Session Update (P0 基礎建設：CI + Biome + 文件糾正)

## What was done（branch `claude/fable5-opus48-specs-xaoghq`，Commit-Per-Todo 共 9 commits）

1. **CI 上線**：`.github/workflows/ci.yml` — 兩個 job（workspaces：lint + 4 套件 tsc + root npm test；mobile：tsc + jest）。在此之前 repo 完全沒有自動化檢查。
2. **Biome linter 上線**：root `biome.json` 只掃 packages/domain/apps-mobile（apps/web、core/、apps/preview 排除）；formatter 關閉避免大 diff。`npm run lint` / `npm run lint:fix`。`noExplicitAny` = error；`noNonNullAssertion`、`useExhaustiveDependencies` 降為 warn（hook deps 修正需實機 QA，留給 native 整合階段）。
3. **修了 4 個被掩蓋的真 bug**：
   - `packages/shared` 沒有 test script → 3 個測試套件（56 tests）從未被 root `npm test` 跑過；補上後曝露 `flags.ts` 的 import 路徑少一層 `../`（已修）。
   - `tsconfig.base.json` 的 `ignoreDeprecations: "6.0"` 在 TS 5.9 是非法值 → 所有 `tsc -p` 都跑不起來（已移除）。
   - `app/(tabs)/session.tsx` 的 `<ScrollView>` 沒關閉 → 該檔無法編譯（已修）。
   - `apps/mobile/package-lock.json` 與 package.json 不同步 → `npm ci` 失敗（已同步）。
4. **Lint 清理（104 檔）**：import type 轉換、移除 unused imports、7 個 `any` 換成正確型別、list key 改用內容 key（純計數渲染用 biome-ignore 註明）、`mock-scan.ts` 排程 helper 改為內部累加 timeline。
5. **文件糾正**：CLAUDE.md 工作流指令改為 Jest 實況（vitest 是寫錯的）+ 加 lint/CI 說明；root `vite.config.js` 移除從未生效的 vitest test 區塊。

## 驗證狀態
- root `npm test`：engine 259 + scan 111 + shared 56 + domain 9 = **435 tests 全綠**
- `cd apps/mobile && npm test`：**40 tests 全綠**；`tsc --noEmit` 零錯誤（4 個 packages 也零錯誤）
- `npm run lint`：**0 errors**（51 warnings 是刻意保留的已知項目）

### Notes / gotchas
- `biome.json` **不能寫註解**（會整份設定失效、退回全 repo 預設掃描）；要註解得改用 `biome.jsonc`。
- biome-ignore 註解只覆蓋「下一行」；JSX 多行屬性時要把註解放在 `key={i}` 的正上方（開標籤內可以放 `//` 註解）。
- `apps/mobile` 的 `(tabs)/scan.tsx` 仍在用 legacy `Animated`（違反 Reanimated 3 規範）— 是 mock 階段的權宜，P1 裝 Reanimated 時要一併改掉。

## Next session（P1 — Face Baseline 原生整合，原 plan 不變）
1. `apps/mobile` 安裝 `@shopify/react-native-skia`、`react-native-reanimated@3`、`react-native-vision-camera`(+face detection)、`expo-haptics`、`expo-blur`。
2. 按 SPEC Task 5 順序升級 14 個 Skia / 8 個 Reanimated `INTEGRATION` 標記點。
3. 實機 QA（需要 Mac / 裝置）。
4. P2 候選：encrypted SQLite 持久化（privacy-first 核心承諾，目前 0%）、Today tab 接 engine 真資料、domain policies 補測試、Maestro E2E。

---

# 2026-06-10 Session Update (Face Baseline System — Spec + Logic Foundation)

## What was done

1. **9-reference design unification**: Reverse-engineered all 9 Face Baseline reference frames into one production spec at `apps/mobile/features/face-baseline/SPEC.md`.
   - **Unifying law**: `cyan/blue = ACTIVE` (scan, setup, guidance, pre-baseline CTAs) · `gold = SECURED` (resonance, success, trust, maturity CTAs). CTA accent encodes which world the user acts from. Do NOT split these into two products.
   - 11 screens, full state machine, copy system, tokens, animation/haptics, Figma structure, guardrails.
2. **Camera-free logic foundation built + verified** (4 feat commits, Commit-Per-Todo):
   - `tokens/faceBaseline.tokens.ts` — design tokens
   - `types/` + `utils/` — domain types + pure logic (quality gate, maturity stages, capture progress weighting 0.6/0.4, retry-reason classification, confidence bands)
   - `store/` — Zustand store + selectors (maturity-aware)
   - `machine/` — typed dependency-free state machine + partial-retry/resume helpers
   - `index.ts` barrel.
   - Verified: `tsc --strict` clean on all `.ts`; runtime sanity checks pass (happy path + recovery + denied + maturity + retry classification).

## Recommended continuation

1. **Decide native dependency stack** before building components: `@shopify/react-native-skia`, `react-native-reanimated@3`, `react-native-vision-camera` (+ face detection), `expo-haptics`, `expo-blur`. None are installed yet; the app can't be run headlessly here, so this needs a deliberate install + a Mac/device to verify rendering.
2. Then build components in SPEC Task 5 order: `CosmicBackground` → `GlassInfoCard` → `GlowPrimaryButton` (cyan/gold) → `FaceScanFrame` → orbs/mesh.
3. Wire screens via `FaceBaselineNavigator` (expo-router) consuming the store + machine.

### Notes / gotchas
- `apps/mobile` is NOT in the root npm `workspaces` (only `packages/*` + `domain`) and has no vitest config — foundation was verified via standalone `tsc` + a throwaway compiled node script, not committed tests. If/when `apps/mobile` gets a test runner, port the sanity checks into real specs.
- No `node_modules` present on fresh container; installed `typescript` + `zustand` `--no-save` only for typechecking.

### Update — Static screens layer (same session)
Built the **onboarding-quality UI flow** on top of the verified logic foundation, using **core RN only** (no Skia/Reanimated/camera yet); every richer-visual point is marked `INTEGRATION (...)` in-file.
- `copy/face-baseline.copy.ts` — canonical English copy, all 11 screens, compliance-safe lexicon.
- `components/` — core-RN library faithful to the references: `CosmicBackground` (mode-driven), `GlowPrimaryButton` (cyan/gold accent law), glass card, resonance glyph, trust shield, privacy list, env checklist, `FaceScanFrame` (square/halo), soul mesh placeholder, processing orb, resonance orb, maturity bar, scan-history, insight card, recovery checklist, success card.
- `screens/` — 11 screens wired to the store + flow with **mocked** signals (env auto-readies, face auto-locks, capture/processing auto-progress with the 1.8s processing ritual honored).
- `app/face-baseline/` — **dedicated expo-router Stack** (`_layout.tsx` + 11 route files re-exporting feature screens). Reachable at route **`/face-baseline`**. Deliberately separate from `(tabs)/scan.tsx` — the generic scan tab was NOT touched.
- Verified: `tsc --strict` clean across all `.ts`/`.tsx` (RN+expo+zustand types installed `--no-save` for checking only; lockfile/package.json untouched). No runtime/device verification possible in this headless container.

### Next session continuation
1. Install the native stack (`@shopify/react-native-skia`, `react-native-reanimated@3`, `react-native-vision-camera` + face detection, `expo-haptics`, `expo-blur`) and upgrade each `INTEGRATION`-marked spot.
2. Replace mocked hooks with real `useCameraPermission` / `useFaceDetector` / `useEnvironmentChecks` / `useQualityMetrics`.
3. Wire a real entry point into `/face-baseline` (e.g. from first-run onboarding) and persist baseline + maturity to secure local storage.
4. Visual QA on device against the 9 references.

### Update — Logic tests (same session)
Converted the earlier throwaway sanity-checks into a committed **jest + ts-jest** harness (mirrors `packages/engine`; project uses jest, not vitest despite CLAUDE.md wording).
- `apps/mobile/package.json` — added `test` script, jest devDeps, and a jest block that transforms via a standalone `features/face-baseline/jest.tsconfig.json` (no expo extend, so tests don't need the RN/expo type tree).
- `features/face-baseline/__tests__/` — `machine.test.ts`, `utils.test.ts`, `store.test.ts` → **33 tests, all green** (state-machine happy path/recovery/denied/invariants, quality+maturity+progress+retry+confidence utils, store actions + selectors).
- Run with `cd apps/mobile && npm test`. apps/mobile is NOT a root workspace member, so root `npm test` won't pick these up — run them from the app dir.
- Verified green in-container; lockfile/`package-lock.json` untouched (test deps installed `--no-save` for the run only, but ARE declared in apps/mobile devDependencies for real installs).

*Last updated: 2026-06-10 (Claude Code — Face Baseline foundation + static screens + logic tests)*

---

# 2026-06-09 Session Update (New Computer Setup - 4th Migration)

## What was done

1. **New Machine Clone**: Cloned the repository into `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`.
2. **Tools Configuration**: Set up Portable Node.js v22.22.3 (LTS Jod) and MinGit v2.45.1 (Portable Git) under `C:\Users\patron\.gemini\antigravity\scratch\tools\node` and `C:\Users\patron\.gemini\antigravity\scratch\tools\git` respectively.
3. **Environment Integration**:
   - Added paths persistently to the User `PATH` environment variable.
   - Updated and wired all environment wrapper scripts in the repo root: `env.bat`, `env.cmd`, `env.ps1`, and `start_env.bat` to refer to the new `tools/node` and `tools/git/cmd` locations.
4. **Dependencies Resolved**: Completed `npm install` successfully without engine conflicts (Node v22.22.3 fully satisfies Vite 7 requirements).
5. **Handoff Documentation**: Updated `ANTIGRAVITY.md` and `MEMORY.md` with the new machine environment status for seamless future handoffs.

## Recommended continuation

1. Run `npm test` inside the project to verify that all 19 suites and 259 tests pass under Node v22.22.3.
2. Launch the dev servers or Expo shell under `apps/mobile` or `apps/preview` to check runtime environments.
3. Resume the Phase B/C implementation (Replay Engine, Insight Generator, and mobile view integrations).

---

# 2026-05-14 Session Update (iOS Safari OOM Fixes - Preview Flow)

## What was done

1. Conducted an end-to-end review of the `apps/preview/` Finger Baseline onboarding flow.
2. Verified 11 existing OOM fixes previously implemented by the team.
3. Identified and fixed the root cause of the remaining iPhone 13 Safari crashes:
   - **OOM Fix #12 & #13**: Removed `mix-blend-mode: screen` from `.scan-flash` and `.finger-silhouette` in `styles.css`. iOS WebKit forces full stacking-context per-pixel compositing when mix-blend is active, which triggered the crash. Replaced with safe opacity/alpha fallbacks.
   - Reduced `backdrop-filter: blur(32px)` on `ceremony-dialog` to `4px` during the `gather` phase to prevent overlapping with particles and camera layers.
4. E2E tested the full 6-step flow in Vite dev server on desktop — successful completion, 60-second timer runs correctly, and transitions are clean.

## Recommended continuation

1. Start the **Delight Upgrade (爽感升級)**:
   - `stardust.js`: Spring/damping sync, dual-layer halo particles, pointer events for ripple/attractor, score-driven palette.
   - `haptics.js`: Breath-haptic sync during scanning.
   - `scan-ux.js`, `audio-engine.js`: Integrate breath syncing and audio pulses.
   - `results-renderer.js` / `results-page.css`: Atmosphere tint and ring glow.

---

# 2026-05-14 Session Update (New Windows Machine — 3rd Migration)

1. Cloned the repo on the new machine into `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`
2. Initially installed portable Node.js v20.12.2, then **upgraded to v20.19.2** (LTS Iron) to satisfy React Native 0.81 / Metro 0.83 engine requirements (`>= 20.19.4`)
3. Updated `start_env.bat` to point to the new portable Node.js path
4. Installed dependencies at repo root, `packages/engine`, and `apps/mobile`
5. Verified:
   - Node.js `v20.19.2`
   - npm `10.8.2`
   - Engine tests: **19 suites, 259 tests — ALL PASSING**
6. Updated `ANTIGRAVITY.md` continuation note with new machine paths

## Important machine-specific notes

- Repo path: `C:\Users\patron\.gemini\antigravity\scratch\tenki-emotion-app`
- Portable Node.js: `C:\Users\patron\.gemini\antigravity\scratch\nodejs\node-v20.19.2-win-x64`
- Always set PATH before running npm/expo commands (use `start_env.bat` or set `$env:PATH` in PowerShell)

## Recommended continuation

1. Launch the Expo app from `apps/mobile` and verify the 5-tab shell
2. Continue Phase C integration — wire mobile screens to engine/domain/shared
3. First slice candidates: Today screen data wiring, Scan flow engine integration, or Session gate/state integration

---

# 2026-04-28 Session Update (New Windows Machine / Continuation Handoff)

## What was done

1. Cloned the repo again on the new machine into `C:\Users\patron\Documents\Codex\2026-04-28\clone-https-github-com-poshen100-tenki`
2. Installed portable Node.js at `C:\Users\patron\Documents\Codex\2026-04-28\node-v24.15.0-win-x64`
3. Verified `start_env.bat` already targets that portable Node.js path
4. Installed dependencies at repo root and at `apps/mobile`
5. Rebuilt npm dependencies successfully after correcting PATH to portable Node.js
6. Verified:
   - Node.js `v24.15.0`
   - npm `11.12.1`
   - Expo CLI available in `apps/mobile`
   - `apps/mobile` TypeScript check passes
   - Node.js `v24.15.0`
   - npm `11.12.1`
   - Expo CLI available in `apps/mobile`
   - `apps/mobile` TypeScript check passes

## Important machine-specific warning

On this machine, the default `node.exe` may resolve to a WindowsApps / Codex stub. When npm spawns child processes through that path, commands can fail with `Access is denied`.

Safe rule for future sessions:

- Always open the shell with `start_env.bat`
- Or prepend `C:\Users\patron\Documents\Codex\2026-04-28\node-v24.15.0-win-x64` to `PATH` before using npm/expo

## Active app reality check

- The real active mobile app is `apps/mobile`
- `README.md` now points collaborators to `apps/mobile` and `docs/DEPLOYMENT_MAP.md`
- The correct next-session dev path is:

```powershell
cd apps\mobile
npm start
```

## Recommended continuation

1. Launch the Expo app from `apps/mobile`
2. Verify the existing 5-tab shell renders on this machine
3. Continue Phase C integration/polish by wiring mobile screens to existing engine/domain/shared layers
4. Clean up stale root-level docs after confirming runtime flow

## Deployment map note

- Deployment URL meaning is now documented in `docs/DEPLOYMENT_MAP.md`
- Public Vercel root currently maps to `apps/web`
- `/preview/` routes map to `apps/preview`
- `apps/mobile` is the active implementation path but has no confirmed public deployment URL recorded in repo yet

# MEMORY.md — TENKI CORE AI Session Memory

> 此檔案由 AI 助手在每次 session 結束時更新。
> 人類不需要手動維護，但可以隨時修改或刪除任何條目。
> 每個 AI 工具（Antigravity / Claude / Claude Code）都應該讀取並更新此檔案。

---

## ⚠️ v3.0 架構轉型宣告 (2026-04-07)

**已廢棄概念（deprecated — 不要在新代碼中使用）**
- TEI / TEI PR99 → 改用 **Decision Edge Score (0-100)**
- FDCB (Floating Decision Control Bar) → 舊語意已廢棄
  - 計時/模板/事件邏輯 → 搬到 `packages/engine/src/session/`
  - `packages/fdcb/` → 改名為 `packages/scan/`（Finger Detection & Camera Biometrics）
- 4 zone (PEAK/OPTIMAL/NEUTRAL/DEGRADED) → 改為 **3 zone (Clear/Neutral/Strain)**
- 3 tier 訂閱 (free/retail/pro) → 改為 **2 tier (free/premium)**
- Supabase-first 架構 → 改為 **local-first + cloud-minimal**
- Trading 導向語言 → 改為 **wellness/readiness 語言**
- WIN/LOSS/BREAKEVEN → 改為 **outcome_tag**

**生效概念（active）**
- Decision Edge Score 0-100（8 維度加權）
- Session Governance Layer（modes + templates + timer + gate + violations）
- packages/scan/（Finger Heat Zone 掃描 pipeline）
- 3 zone：Clear (70-100) / Neutral (40-69) / Strain (0-39)
- 2 tier：Free / Premium
- Local-first encrypted SQLite
- Compliance Guardrail Engine
- Feature flags for dark launch

---

## 專案決策紀錄
- [2026-04-07] **v3.0 架構轉型啟動** — Founder 提供完整 16-section App Store-safe 規格書
  - 10 項決策全部確認：同目錄並行遷移、2 tier、scan 取代 fdcb、session governance、domain/ 取代 core 概念、ANTIGRAVITY v3 重寫、RULES-v3 建立、Phase A→B→C 順序、legacy adapter、feature flags
  - ANTIGRAVITY-v2.md 歸檔至 docs/archive/
  - ANTIGRAVITY.md v3.0 重寫完成
  - RULES-v3.md 建立（待 Founder 確認後覆蓋 RULES.md）
- [2026-03-27] 根目錄重整 — Web prototype 移入 apps/web/，Prompt 文件移入 docs/prompts/
- [2026-02-25] 架構決策：選擇 React Native + Swift Hybrid
- [2026-02-25] 後端選擇 Supabase → ⚠️ v3 改為 local-first
- [2026-02-25] 訂閱計費選擇 RevenueCat
- [2026-02-26] FDCB v2.0 spec → ⚠️ v3 已重新定義
- [2026-03-01] packages/engine/ 全模組完工（v2 — 現歸入 legacy）
- [2026-03-01] packages/fdcb/ 完整實作（v2 — 現歸入 legacy）
- [2026-03-02] **Phase 0 完工** — Engine 99.53% / FDCB 97.93% coverage（v2 baseline）

## Founder 偏好（AI 應記住）
- Poshen 偏好先看架構全貌再進細節
- 溝通語言：繁體中文，代碼用英文
- 不喜歡過長的解釋，喜歡表格比較 + 明確結論
- 每次決策要考慮 solo founder 時間效率
- 重視 Garmin 數據對齊（用戶信任感）
- 習慣雙 AI 工作流（Antigravity 寫代碼、Claude 做 review）
- Mac mini 尚未購買，目前只能做不需要 Mac 的任務
- **v3 新增**：重視 App Store compliance、privacy-first、安全語言

## 已知地雷（AI 應避免）
- 不要動 apps/web/ 裡的任何檔案
- 不要使用 prohibited vocabulary（見 ANTIGRAVITY.md v3 Section 2）
- 不要在 user-facing copy 中使用醫療或金融建議語言
- 不要把 raw biometric data 設計為上傳到雲端
- 星塵動效的「感覺」不能改，重建時保持 v25.8.2 的視覺體驗
- 不要用 SVG 畫環，用 Skia
- 不要用 Animated (legacy)，只用 Reanimated 3
- **v3 新增**：不要使用 TEI、PR99、舊 FDCB 語意
- **v3 新增**：不要設計 4 zone 或 3 tier subscription
- **v3 新增**：不要把隱私控制放在付費牆後

## 技術偏好與標準
- TypeScript strict mode，不允許 any
- 測試用 Jest + ts-jest
- 狀態管理用 Zustand（不用 Redux）
- 常數要導出且具名
- Edge Score 用加權正規化（不再是 PR99 百分位）
- 每個 function 必須有 JSDoc
- engine/ 和 scan/ 測試覆蓋率 ≥ 90%
- 動畫用 Reanimated 3（不用 legacy Animated）
- 環形圖用 Skia（不用 SVG）
- EWMA α=0.05 極慢收斂
- **v3 新增**：Feature flags 控制所有未成熟功能
- **v3 新增**：Compliance Layer 驗證所有 user-facing copy
- **v3 新增**：Local-first — 使用 encrypted SQLite

## 上次 Session 結束點
- **日期**: 2026-04-14
- **最後完成**:
  - ✅ Baseline Onboarding 4 交付全部完成
  - ✅ Signal Quality Gate (coverage/brightness/stability/SQI 四維度閘門)
  - ✅ Baseline Bootstrap Engine (30-60s 掃描 → 初始基線)
  - ✅ Domain contracts + policies (6 步狀態機、重試邏輯、失敗分類)
  - ✅ 6-step UX copy (5 個 UX 標準全部滿足)
  - ✅ Web Preview UI (`apps/preview/`) — 瀏覽器驗證全部通過
  - ✅ 22 個新測試案例 (signal-quality-gate: 12, bootstrap: 10)
- **下一步**:
  1. 跑 vitest 確認 engine 測試通過（需安裝 Node.js）
  2. git commit + push 所有 baseline onboarding 程式碼
  3. 繼續 Phase C — 5 Tab UI (Today/Scan/Session/Timeline/Lab)
  4. 或依 Founder 指示做下一個功能

## 各 AI 工具的角色分工
| 工具 | 角色 | 目前使用狀態 |
|------|------|-------------|
| Antigravity (Claude Opus 4.6 / Gemini 3.1 Pro) | 主力代碼生成 + 架構 | ✅ 使用中 |
| Claude (claude.ai) | 架構決策、代碼 review、文件制定 | ✅ 使用中 |
| Claude Code | Terminal 任務、Expo init、Native Module | ❌ 等 Mac 到手 |

---

## 2026-04-14 Session Update (Baseline Onboarding Complete)

### 4 Deliverables Completed:
1. **Baseline Onboarding Flow** — 6-step guided flow (Intro → Sensor Choice → Readiness Check → Calibration Scan → Baseline Result → Next Action)
2. **Signal Quality Gate** — Multi-dimensional readiness check (coverage, brightness, stability, SQI) with human-readable messages per failure type
3. **Baseline Bootstrap Engine** — Converts 30-60s scan into initial BaselineProfile via Welford's algorithm. Classifiable error codes: NO_READINGS, ALL_REJECTED, INSUFFICIENT_QUALITY, INSUFFICIENT_DURATION
4. **Completion UX** — "不是好壞分數" messaging, confidence badge, metric cards, next action routing

### New Files Created:
- `packages/engine/src/baseline/signal-quality-gate.ts`
- `packages/engine/src/baseline/bootstrap.ts`
- `packages/engine/src/baseline/__tests__/signal-quality-gate.test.ts` (12 test cases)
- `packages/engine/src/baseline/__tests__/bootstrap.test.ts` (10 test cases)
- `domain/src/contracts/baseline-contract.ts`
- `domain/src/policies/baseline-policy.ts`
- `packages/shared/src/copy/baseline-onboarding.ts`
- `apps/preview/index.html`
- `apps/preview/styles.css`
- `apps/preview/baseline-onboarding.js`

### UX Standards Met:
1. ✅ 掃描前就讓使用者知道成功條件
2. ✅ 掃描中只顯示 1 個主狀態
3. ✅ 任何失敗都可解釋
4. ✅ 結果頁講人話（「不是好壞分數」）
5. ✅ 成功後感受到之後每次評估都會更準

### Browser Verification:
- All 6 steps rendered and transitioned correctly
- Readiness meters animated properly
- Scan timer + progress ring worked
- Baseline result displayed realistic metric values
- No console errors

## 2026-04-21 Session Update (Library Session)

### 達成進度：
1. **環境設定與維護**：在免安裝 Node.js (v24.15.0) 環境中修復 `vitest` 到 `jest` 的兼容性錯誤，`packages/engine` 的 19 個測試套件 (259 個測試) 現已全數通過。
2. **Phase B 基礎建設 (Step 2)**：
   - 透過 GitHub 介面手動部署了 145KB 的 `apps/preview/v6/index.html`，成功規避了大檔案寫入造成的 Timeout 錯誤。
   - 完成 `.tei` 到 `.tl-tei` 的 CSS Class 重新命名任務（包含 3300 多行程式碼）。
   - 實作 **v3 語意合規**：全面替換不符合 v3 架構的專有名詞，例如將 `TEI` 替換為 `Edge Score`，將 `PR99` 替換為 `Decision Edge`。

### 下一步 (Next Session)：
1. 實作 Replay Engine 與 Insight Generator。
2. 完成完整的整合測試 (Full Pipeline)。

*Last updated: 2026-04-21 11:46*
*Updated by: Antigravity (Library Session End)*

## 2026-06-20 Session Update (Claude Code — Visual Direction + Color Spine + GSAP)

### 背景
Founder 要一份創意總監級的視覺優化方向書,並提到 Stitch → Claude Design → GSAP 的 AI 設計工作流。分支 `claude/ai-design-workflow-gyprba`。

### 做了什麼（6 commits, Commit-Per-Todo）
1. **視覺方向書**（對話交付,未落檔）：定調「會冷靜讀你的精密儀器,活在深空裡」;抓出五大系統破口（五種 cyan、Neutral 近白搶光、Strain 紫語義打架、gold=SECURED 沒進 token、SF Pro/Inter 雙頭 source）。
2. **色彩脊椎收斂**（已落地,零產品風險）：
   - `design-tokens.ts` 新增 canonical `brand`（cyanCore/cyanActive/goldSecured/spaceBg）+ 抽 `CYAN_CORE/CYAN_ACTIVE/GOLD_SECURED/SPACE_BG` consts,DRY 到 colors.primary / sparklines.rr / bottomNav.activeColor。
   - 新建 `apps/preview/tokens.css` 單一真相源(含 rgb 三元組),first-link 進 v6 / onboarding / scan-result。
   - 把 takeover、scan-result 殘留裸 cyan（#00F0FF/#23F3D4/#20D7F2）全指回 `--cyan-active`;rr sparkline canvas 透過 `getComputedStyle` 解析 token。
3. **GSAP 儀式三時刻**（3/3 完成,CDN 引入 gsap 3.12.5,全程 `if(window.gsap)` 漸進增強 + 保留原 fallback）：
   - Edge Score 揭曉（Today）：rAF → GSAP timeline,`expo.out` 收斂 + lock 呼吸。
   - 星塵 climax 鎖定（baseline）：保留 founder 的「极速运算」flicker,只把落地升級成 `back.out` snap-settle + **gold SECURED 輝光**（`.tei-secured` class 吃 `--gold-secured`）。
   - 進度弧/掃描觸點呼吸（takeover）：**沒動**既有 rAF fill/drain 物理（它本就是 pause-not-reset 平滑回抽）;只在掃描觸點 core 加 EWMA-slow idle breath（`sine.inOut` infinite yoyo）,hold 時 pause、放開 resume、climax 時 kill。

### 刻意沒做（留給 founder 拍板,風險/設計決策）
- **Zone 語義重定**（Neutral 降亮、Strain 改暖警示、紫留 Premium）— 牽動 compliance copy + 既有畫面,要先一起對齊。
- **soul-enroll / finger-demo 的電光藍 #00F0FF** — 各自內部自洽的獨立儀式頁,改招牌色屬設計決策非收斂。
- **status-warn 琥珀 #EAB308 vs token warning #F5A623 雙頭** — 屬另一條 warning 收斂線。

### 坑
- 官方 GSAP AI Skills（`greensock/gsap-skills`）被沙箱 auto-mode 分類器擋下(外部 skill 安裝需 founder 授權)→ 改用核心 GSAP best practices 手寫,只用免費 core API（timeline/expo.out/back.out/roundProps/fromTo yoyo），無 plugin。
- 這 container 沒裝 deps（`jest: not found`）→ 無法跑全測;改用 `tsc --noEmit -p packages/shared`（零錯,只剩 pre-existing moduleResolution deprecation）+ `node --check` + grep 確認無測試 assert 到改動值。

### 下次接手點
- 若 founder 要把方向書落檔 → 寫進 `docs/`。
- Zone 語義重定需先做 compliance/畫面盤點再動。
- GSAP 三時刻已全做完;實機看過後若要微調 ease/時長再說。

*Last updated: 2026-06-20*
*Updated by: Claude Code (Visual Direction Session)*

## 2026-06-20 Session Update #2 (Claude Code — Zone 重定 + Soul Scan glow-up)

### 做了什麼
1. **Zone 語義重定（✅ 全鏈落地）** — founder 拍板 Neutral→slate、Strain→ember：
   - `packages/shared/design-tokens.ts`：抽 `ZONE_NEUTRAL=#64748B` / `ZONE_STRAIN=#C2703D` consts；`zones.*.text` 統一白。
   - `zone-config.ts` 指向 `TENKI_THEME.zones`（兩處 shared 定義收斂成一源）。
   - 鏡像同步：`apps/mobile/theme/index.ts`（加 keep-in-sync 註解，不硬接跨套件 import）、`apps/preview/tokens.css` / `styles.css` / `v6/index.html`(vars + Today zone 對映)。
   - **範圍界線**：v6 的 `#5E3A87` 還有 session/呼吸段語義（Exhale/Lock/MANCINI_FBD，5 處）→ 全保留，只改 zone。compliance copy 不動。
2. **Soul Scan 首屏 glow-up（✅，`apps/preview/soul-enroll.js`）** — founder：「把框框和靈魂設計超酷，像 fable5」：
   - 靈魂：neural-lattice 星座（nearest-neighbour ≤3 連線 + depth sort）+ 呼吸核心 + 視差/公轉 + twinkle。
   - 框框：精密 reticle（雙層發光 + 轉角節點 + 邊刻度 + 呼吸）+ idle 掃描光線。
   - 全用 `idle = 1 - k` 收尾，capture/3D 不受影響。
3. docs：`VISUAL-DIRECTION.md` 破口 #3/#4 → ✅、加 §4.1；本檔記錄。

### 坑 / 工具
- 這 container 無 ffmpeg/headless browser → 用 `pip imageio-ffmpeg` 抽影片幀看 founder 錄影；`npm i puppeteer`（自帶 Chromium）+ `python3 -m http.server` 做 soul-enroll idle 真截圖驗證（loop：`/tmp/shot.js` `/tmp/crop.js`）。idle 首屏不需相機，可直接截。
- 第一版 lattice 全連 → 3× 放大像蜘蛛網；改 nearest-neighbour ≤3 + depth sort 後變乾淨星座。

### 下次接手點
- 待拍板：soul-enroll/finger-demo 招牌電光藍 #00F0FF 是否併 token；字體雙頭 source（SF Pro vs Inter）。
- soul-enroll capture/3D 階段尚未動（需相機才能測）。

*Last updated: 2026-06-20 (session #2)*
*Updated by: Claude Code (Zone retone + Soul Scan glow-up)*
