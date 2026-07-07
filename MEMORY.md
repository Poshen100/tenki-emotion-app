# 📋 MEMORY.md 協議（永久置頂，勿刪、勿在其上方加條目）

> 1. **新條目一律加在本協議正下方**（最新在上，越下方越舊）。⚠️ 檔尾殘留少數 2026-04~06 的舊條目是歷史遺留，別學它們 append 在檔尾。
> 2. 條目格式：`# YYYY-MM-DD Session Update (一句話主題)` → What was done → 教訓/注意 → 下次接手點。
> 3. **本檔是日誌，不是法典**：記「這次發生什麼」。可長期沿用的規則要出去 —— 工程硬規則 → `CLAUDE.md`、操作陷阱/流程 → `docs/PLAYBOOK.md`。
> 4. **同類教訓第二次出現 → 必須提煉成 PLAYBOOK 一條「情境 → 規則」**（compound learning 制度）。
> 5. 讀者（AI）只需讀最上面 1~2 條當交接，其餘用 grep；不要全文讀 —— 蒸餾版在 `docs/PLAYBOOK.md`。
> 6. 歸檔索引：2026-06-22 以前的條目在 `docs/archive/MEMORY-2026H1.md`（05 §4 精簡協議，2026-07-04 執行）。

---

# 2026-07-06 Session Update #13 (提升精度接進 v6：骨架上線 + 2050 視覺交棒 Antigravity)

> 承 #12。Founder 逐輪打磨後定案接法與視覺，雲端骨架落地，視覺動效+真訊號指派 Antigravity。

## 定案（founder 拍板）
- **接法＝強化 v6 結果頁本身**（非另開頁）：①環中心信心 pill 入口 ②完成後 Autonomic/環升級 ③header 第三來源。
- **命名**：user-facing 一律「**手指**」＋指紋線 icon；PPG 只作技術脈絡；指示句可用「食指」；**禁「補強」**。
- **視覺基準＝2050 生物儀器**（founder 五張參考定調）：熱感應手指熱場＋良好/歪掉/放開三態、生理正確 PPG 波形（核心隨拍脹縮+HRV 抖動、BPM 置中堆疊）、金色星塵只在完成爆一次、色語一色一義（紅=血流only讀取/金=完成/青=資料/mint=掌控）。**去 AI 感**：禁 emoji icon、禁假折線、克制。

## What was done
- **v6 骨架（`c743bb4`）**：`#edgeConfidence` pill（中→邀請/高→✓）、閉包內獨立 `openPrecisionBaseline()`（不受 stardust no-op 影響）、`applyPrecision()`＋`html.precision-calibrated` 視覺 hook、`#srcFinger`「手指 ✓」chip、`bfFinish()` 寫 `tenki.precision.*`。Playwright 實測：三段斷言全過、零 pageerror、鎖定環比例不變。
- **Antigravity 開工單（`1ea9872`）**：`docs/prompts/antigravity-finger-precision-kickoff.md`（2050 規格全文入 repo）；ANTIGRAVITY.md lane 4 更新；契約 §6 轉 as-built＋命名決策。

## 下次接手點
- Founder 手機驗 `/preview/v6/`（merge 後）：pill → 儀式 → bfFinish → 回 Today 狀態翻轉。
- Antigravity：照開工單做 A（2050 儀式視覺）+ B（#148 真訊號，需真機）。
- 雲端後續：Antigravity 交付後，環 mint 發光/Autonomic 精修已有 `precision-calibrated` hook 可掛。

---

# 2026-07-05 Session Update #12 (手指 PPG 回歸為「可選補強層」— 接線契約落地)

> 承 #11。Founder 補一層方向：手指**不是**回收，而是**重新定位為可選補強層** —— 臉掃永遠是唯一主流程，看到結果後才出現 opt-in「提升精度」入口。與 CLAUDE.md「finger PPG 退為校準/補強層」一致。

## What was done（本條 = 規劃 + 委派落地，雲端無相機部分）
- **接線契約 canonical**：`docs/FINGER-PRECISION-WIRING.md`（`5e17786`）—— 目標架構、既有可重用零件真實座標（v6 `.baseline-flow` API :3999/:4010/:3827/:4019、結果錨 `#edgeScoreReveal` :1938、PR #148 `finger-ppg.js`）、獨立入口 `openPrecisionBaseline()`、localStorage schema（只存衍生 HR）、注入錨點、cloud/Antigravity/Mac 分工、驗證。
- **Antigravity 任務 + §8.3 重定位**（`d71aa5f`）：桌機工作清單加「手指 PPG 真訊號 lane（需真機）」指向契約檔；§8.3 ⛔「已退場」改 ♻️「重新定位為可選補強層」。
- 本條記錄方向。
- **關鍵設計約束**：手指補強層走**獨立入口**，不碰臉掃星塵 takeover（`stardust-scan-takeover.js`:51-52 已把 `openBaseline` 覆寫成 no-op 擋 mock）；只存衍生 HR、raw 不上雲。

## 教訓/注意
- 大部分零件已存在（v6 `.baseline-flow` 儀式、`openBaseline` API、PR #148 真 PPG 引擎）→ **重用不重寫**。
- 真相機/真機/iOS OOM → Antigravity lane（PR #148 是 draft，未併主因就是等真機驗證）；雲端只做無相機、手機可驗的骨架。

## 下次接手點
- **雲端可續（我）**：步驟 2 骨架 —— v6 加獨立 `openPrecisionBaseline()` + `bfFinish()` 寫 localStorage 旗標 + 結果頁「已提升精度」徽章（純 JS、headless 截圖可驗）。做前讀 `docs/FINGER-PRECISION-WIRING.md` §6 + `docs/PLAYBOOK.md` §6。
- **Antigravity**：ANTIGRAVITY.md 工作清單 #4（真 PPG 進 `bf 'scan'`）。
- **入口 B 卡（結果頁「提升精度」）**：founder 說日後再補，等真訊號可用後再建。
- 本 branch `claude/fable5-system-setup-xuqbkg` 已從 merged main（`b06ad90`, #161）重啟；本條工作在其上。

---

# 2026-07-05 Session Update #11 (產品轉向定調：收斂成「只有臉」的 app + 刪手指基線)

> 這一條是**產品方向的錨**。任何未來 session（含較弱模型）接手前**先讀這條**，別再把產品想成多模態/交易工具。Founder 原話：「我沒有辦法重啟對話 因為我怕你會忘記 這邊的一切」→ 所以把「這邊的一切」刻進這裡，恐懼從此不成立。

## 產品定位（founder 本人一句話版本，這才是真正要做的東西）
**臉部掃描 → 從臉部血流讀生理訊號（rPPG）→ 跑 founder 設定好的邏輯 → 算出一個分數（Edge Score, 0-100）→ 顯示給使用者 → 給對應回饋。**
功能刻意**極簡**（founder：「我要的功能其實很簡單」「不要太多功能」）。不是多模態、不是交易工具、不是冥想 app（定位語言仍以 SYSTEM.md 為準）。

## Founder 決策與處境（接手前必懂）
- **「直接下場做」**：不再花時間找需求／驗證需求，直接把 app 生出來。
- **授權刪掉手指基線功能**，只留臉部（本 session 已執行，見下方 Todo 2-4）。
- Founder 一個人、**大部分時間只有手機、不看 code**；不缺錢，缺「一個可用的人或 AI 幫他把 app 生出來」。
- 朋友有 Mac + 一個工程師，但太忙、沒空幫 → 所以他一直自己用手機研究到現在。

## 真正的瓶頸（不是「他不會 coding」）
1. **rPPG 是真的難的核心技術**（從臉部微色變推 HR/HRV）。→ 建議 **用買的商用 rPPG SDK，不要自己從零寫**。
2. **缺 Mac / 真機**做 real scan（native camera → 真訊號 → 真分數）。目前 app 分數仍是 mock。
   → 建議：買 Mac + 找一個 React Native 工程師做「原生整合／上機／App Store」那一哩，**AI 出量、人把關落地**。

## What was done（本 session）
- 產品轉向寫入本條（🟢 green-zone add-only）。
- App 收斂成 face-only：刪 `apps/mobile/features/finger-precision/` + `app/finger-precision/` 路由 + `FingerSmartReminder`；清 `(tabs)/scan|index|lab.tsx` 與 `user-store` 的 finger 引用。
- Engine 刪孤兒融合 `baseline/multi-modal-blend.ts`（+test+匯出）。保留 `biometric/finger-ppg.ts`（低階 PPG 基元，rPPG 可重用）與 `packages/scan/`（FHZ infra）。
- Preview/部署清理：刪 `finger-demo.html`、`vercel.json` 的 `/preview/finger`、`DEPLOYMENT_MAP.md/.json` 條目。

## 下次接手點
- 產品是 **face-only**。要往前推的是「臉掃 → 真 rPPG 訊號 → Edge Score → 回饋」這條主線，核心卡在 rPPG SDK 選型 + Mac/真機。
- rPPG socket 已在 `apps/mobile/features/face-baseline/utils/dailyScan.ts`（`deriveDailyEdgeScore`：confidence>0 走 real 分支）— 真相機接上 `updateQuality` 後會自動切真分數。
- 本 branch（`claude/fable5-system-setup-xuqbkg`）另含前面 5 個 harness commit，尚未 merge 進 main。

---

# 2026-07-04 Session Update #10 (Harness 收官：05 維護協議 + 06 交接信 + 對抗審查 + 首次記憶精簡)

> Founder 給 Harness 最後兩件（F 知識迭代協議、G 交接信）+ 強制收尾（對抗審查、唯讀驗證、執行摘要）。

## What was done
- **`.cursor/harness/`（新，`32e1719`）**：`README.md`（01–04 映射既有檔案的索引，不複製內容）、`05_maintenance.md`（🟢🟡🔴 三級自我更新權限、防鑽漏洞 §2.1–2.4、Context/Error/Solution 踩坑格式、行數觸發精簡、品味類任務標準動作＝誠實條款）、`06_manifesto.md`（Fable 5 三件關鍵判斷：多 AI 狀態漂移是最大風險／驗證階梯／founder 溝通模式即 spec；七種退化模式與預防；一頁心法）。
- **對抗審查（fresh-context sonnet，`0360c23`）**：10 條發現全數覆核處置 — 含兩 HIGH：紅區觸發詞漏「鎖定」一詞（已補，實測 repo 多用此詞）、規則檔零機械護欄。PLAYBOOK §0 收編 harness 排位形成裁決閉環。
- **規則檔警示 hook（`391c40c`）**：`protect-files.sh` 對 CLAUDE/SYSTEM/PLAYBOOK/MOTION/harness 編輯注入 05 分級提醒（硬 block 不可行 — 🟢 新增教訓是合法編輯）；block/warn/silent 三向實測。
- **首次記憶精簡（05 §4 實戰，`8a8d0ab`）**：MEMORY.md 1206→246 行，2026-06-22 前條目原文歸檔 `docs/archive/MEMORY-2026H1.md`，協議加索引行。
- **唯讀驗證**：三個 harness 檔 Read 全文回讀無截斷；引用的 13 個路徑 `ls` 逐一存在。
- 接線：PLAYBOOK §10、CLAUDE.md 持續更新節、AGENTS.md Key Files。

## 下次接手點
- Harness 六層完整（01 CLAUDE / 02 PLAYBOOK / 03 MEMORY / 04 機械護欄 / 05 維護協議 / 06 交接信）。改任何規則文件前先讀 `.cursor/harness/05_maintenance.md`。
- 在外的球：Antigravity 動效開工單（`docs/prompts/antigravity-motion-kickoff.md`，founder 桌機貼上即開工）；founder 手機驗 `/v3/` 揭曉流程（TEI→Edge 改名後）。

---

# 2026-07-03 Session Update #9 (雙環比例拍板恢復 — 短視窗改捲動方案)

> Founder 看 #155 上線後回報「雙環變得太小，我喜歡原本 V6 的比例」→ 縮環方案否決。改為：**環比例完全恢復 `min(72vw,300px)` 並鎖定；短視窗（≤760px 高）讓 `.screen` 捲動**。

## What was done
- 撤掉 #155 的環自適應公式 + 縮字/藏 coach tiers；環規則加 founder 鎖定註解。
- 短視窗 tier：`.screens .screen{overflow-y:auto}` + 子元素 `flex-shrink:0` + **關鍵一擊 `.snap{flex:0 0 auto}`**（`.snap` 原是 `flex:1`＝高度永遠等於剩餘空間，內容在它體內溢出到 FDCB 底下且 scrollHeight 不會長 — 用頁內 computed-style 診斷抓到）。
- headless 驗證：390×660 頂部（環全尺寸）/捲底（卡片+Swipe+圓點完整在 bar 上方，scrollH 711 > clientH 646）；390×844 與原設計一致。三張截圖已交 founder。
- coach 卡在 ≤680px 消失是**既有規則**（index.html:4259，早於本次），founder 未反對，不動。

### 教訓（已入 PLAYBOOK §6）
- v6 CSS override 同權重早寫必輸（同 session 踩兩次）→ 位置或權重擇一，headless 截圖驗過才算。
- `.screen` 捲動三件套：overflow-y:auto + 子 flex-shrink:0 + `.snap` flex:0 0 auto；驗 scrollHeight>clientHeight。
- **產品裁決：V6 雙環比例鎖定，永不縮**（PLAYBOOK §6 已記，防止未來 AI 重演縮環）。

---

# 2026-07-03 Session Update #8 (動效方向書 MOTION-DIRECTION.md — GSAP skills 確認入庫 + Antigravity 調用手冊)

> Founder：確認 GSAP AI Skills 有沒有在 GitHub、把視覺動向做到國際品牌等級、確保 Antigravity 接手能完美調用（實作歸它）。

## What was done
- **確認**：8 包官方 GSAP AI Skills（core/timeline/scrolltrigger/performance/utils/plugins/react/frameworks，~1850 行）+ karpathy 均已 committed 在 main 的 `.claude/skills/`。
- **新增 `docs/MOTION-DIRECTION.md`（動效語言 canonical）**：North Star（儀器的生命跡象非裝飾）、三鐵律（誠實動效/GPU-only/reduced-motion 一級公民）、motion tokens（--ease-calm/breath/secure + duration 音階，全部取自既有落地值）、四大儀式語彙（Reveal/Breath/Lock/Travel，含鎖定資產清單）、每 surface 引擎表（**GSAP 只進 web preview；RN 走 Reanimated 3 同語彙翻譯**）、GSAP skill 包路由表、**Antigravity 調用手冊**（skills 是一般資料夾要手動讀全文 + 動效 PR 驗收清單）。
- **四入口接線**：ANTIGRAVITY.md 先讀制度、AGENTS.md Key Files、PLAYBOOK §1 路由表、CLAUDE.md 動畫節 — 任何 AI 做動效都會撞到這份文件。
- **分工不變**：動向書/規格/制度 = 雲端；手感/pixel/實機 60fps 調參 = Antigravity（真瀏覽器 + GPU）。

---

# 2026-07-03 Session Update #7 (/face-baseline/ 公開網址退場 + v3 短視窗遮擋修復 #155)

> Founder 兩個裁決：① `/v3/` snapshot 在 in-app browser 被 FDCB 蓋住 → 已修（#155，環自適應視窗高度 + 兩級降級，390×660/844 headless 截圖驗證）；② `/face-baseline/`（Expo Web 審查載具）看過後拍板退場。

## What was done
- **#155 已 merge**：`.tl-edge` 尺寸加高度項 `max(150px, min(72vw,300px,calc(100dvh-520px)))`；≤760px 高縮分數字、≤680px 高 coach 卡讓位。media tiers 要放在基礎規則之後（同權重晚者勝 — 第一版放前面被蓋掉，教訓）。
- **`/face-baseline/` 退場**：vercel.json 三條路由刪除、`apps/mobile/dist` 出庫（23 檔，gitignore 本來就擋）、app.json `experiments.baseUrl` 移除、部署地圖 .md/.json 同步、PLAYBOOK 截圖管線條目更新。⚠️ **app 內部 expo-router 的 `/face-baseline` 路由（手機畫面）完全不受影響** — 退場的只是公開網頁版。
- 目前公開路由只剩：`/`→`/story/`、`/v3/`（=`/preview/v6/`）、`/preview/`、`/preview/finger/`、`/preview/brand/`、`/brand/*`。

### 注意
- mobile 畫面截圖驗證照舊可用（PLAYBOOK §7）：本地 expo export → serve → Playwright；dist 不再入庫。

---

# 2026-07-03 Session Update #6 (RN 結果頁也退場 — 揭曉出口改 Today ring)

> Founder 看截圖後：「這個版本也是我不要的」— 繼 web scan-result.html 之後，RN `app/scan/result.tsx` 也否決。**結果頁體驗一律以 `/preview/v6/` 為準**。

## What was done（`ab15c3e`）
- 刪 `app/scan/result.tsx`（引用盤點：只有本次日常鏈的接線）。
- `DAILY_RESULT_ROUTE` `/scan/result` → `/`（Today）：日常掃描完成 → Today 分數環即揭曉（過渡態）；routes pin 測試同步；dist 重出。
- ANTIGRAVITY.md 桌機清單第 2 條改寫成明確設計任務：把 v6 星塵揭曉移植成 RN 版（Reanimated 3 + Skia），先對齊 founder、別自行發明視覺。

### 注意
- scan-store 的 `lastResult` 管線不變（Today/lab 消費中）；`dailyScan.ts` mock 分數照供。
- **產品裁決記錄**：founder 對「結果頁」的標準 = v6 星塵揭曉那種儀式感，不是靜態卡片頁 — 未來任何結果頁提案先過這關。

---

# 2026-07-03 Session Update #5 (RN 揭曉頁截圖驗證 + 修好 Expo Web bundling + dist 更新)

> Founder：「日常掃描揭曉頁也截圖給我」→ 起 Expo Web 才發現它從 fusion 工作(#116)起就 bundle 不過。順藤摸瓜修好三層問題，截到圖，dist 一併更新。

## What was done
- **修好 Expo Web（三層疊加 bug，`a87e2b2`）**：① `metro.config.js` 新增（watchFolders 涵蓋 packages/ — MEMORY 2026-06-19 預告的缺）；② zustand v5 ESM 的 `import.meta` 使 web 全白 → resolver 釘到 CJS（不能全域關 package exports，會壞 RN→RNW alias）；③ `SecureAccessRequiredScreen` 頂層 import vision-camera 拉 nitro/RN internals 進 web → 改 native 分支內 `await import()`。
- **RN 揭曉頁截圖成功**：生產 export（dev server 的 LogBox 在 web 會拉 RN internals，必須用 export）+ 本地 serve（處理 `baseUrl:/face-baseline` 前綴）+ Playwright → 「今日內在天氣」72/Clear 完整渲染，已交 founder。
- **dist 更新（`1d46944`）**：risks.md 未解#1（dist 過期）順帶解決 — merge 後 `/face-baseline/` 反映日常揭曉鏈 + web 修復。
- **另**：founder 拍板結果頁只留 `/preview/v6/`，獨立 scan-result 頁已退場（`6ff4016`）；PLAYBOOK §6/§7 新增截圖驗證界線與 web bundling 陷阱五條。

### 教訓（已入 PLAYBOOK §7）
- mobile↔packages import：tsc 與 Metro 是兩套解析，都要配。
- Expo Web 驗證用生產 export、別用 dev server。
- `pkill -f` pattern 含在自己命令列會自殺（exit 144）。

## 下次接手點
- merge 後 founder 手機驗：`/v3/` 揭曉流程（TEI→Edge 改名後）、`/face-baseline/`（新 dist）。
- Expo Web 現在可截圖 = mobile 畫面類改動的「截圖驗證」管線開通（PLAYBOOK §6）。

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
1. ~~`/preview/scan-result.html` — 三 zone 色~~ → **已裁決退場**：founder 看過截圖後拍板「結果頁只留 `/preview/v6/` 版本」（2026-07-03）。scan-result.{html,css,js} 已刪、部署地圖兩檔同步移除。結果頁 canonical = `/preview/v6/`（=`/v3/`）；mobile 端對應 `app/scan/result.tsx` 不受影響（那是 RN 頁非 web preview）。
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

