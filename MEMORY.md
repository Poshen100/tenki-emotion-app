# 📋 MEMORY.md 協議（永久置頂，勿刪、勿在其上方加條目）

> 1. **新條目一律加在本協議正下方**（最新在上，越下方越舊）。⚠️ 檔尾殘留少數 2026-04~06 的舊條目是歷史遺留，別學它們 append 在檔尾。
> 2. 條目格式：`# YYYY-MM-DD Session Update (一句話主題)` → What was done → 教訓/注意 → 下次接手點。
> 3. **本檔是日誌，不是法典**：記「這次發生什麼」。可長期沿用的規則要出去 —— 工程硬規則 → `CLAUDE.md`、操作陷阱/流程 → `docs/PLAYBOOK.md`。
> 4. **同類教訓第二次出現 → 必須提煉成 PLAYBOOK 一條「情境 → 規則」**（compound learning 制度）。
> 5. 讀者（AI）只需讀最上面 1~2 條當交接，其餘用 grep；不要全文讀 —— 蒸餾版在 `docs/PLAYBOOK.md`。
> 6. 歸檔索引：2026-06-22 以前的條目在 `docs/archive/MEMORY-2026H1.md`（05 §4 精簡協議，2026-07-04 執行）。

---

# 2026-07-30 Session Update #44 (v6 四頁升級 Phase 2：Session 頁做成真的)

> 四頁升級 Phase 2。Founder：「接著做 Session2」。決策（AskUserQuestion）：三格 stats＝**對齊率/決策次數/平均用時**（放棄無從推導的 Avg Edge Score）；drill-in **做成真的、只用 store 有的欄位**。

## 現況 → 做了什麼（`apps/preview/v6/index.html`，S1–S3 各一 commit）
- 舊：整個 `#session-screen` 寫死（88% 對齊率 / 73 Avg Edge Score / 2.1m + 4 張靜態卡 `openSessionDetail('s_wN')`）；drill-in（`SESSIONS` 物件 + `openSessionDetail`）全是**假生理數據**（Edge Score 曲線 SVG / HR / HRV / RR / clarity dots）。
- **S1 stats+清單+空狀態**：新 `renderSessionScreen()`（`goTab('session')` 觸發）讀統一 store `tenki.alert.outcomes.v1`（TradingView 快訊 + v6 計時器合流）。三格＝對齊率（`isDisciplinedV6` 佔比）/ 決策次數 / 平均用時（avg `durationSec`）；insight 事實化；清單依 `ts` 新→舊；badge：stayed→win「跟著流程」/ timed_out→breakeven「完整走完」/ broke→loss「提前收束」。空 store → `.session-empty` 引導。`outcomeMeta(rec)` 用 templateId 對 TEMPLATES，找不到 fallback 到 symbol。
- **S2 drill-in 做成真的**：重寫 `#sessionDetail` 為 store-driven 事實卡（outcome hero / 三段時間軸由 `segBounds(dur)` 推導 + 核心段 reached 高亮 / 用時·Readiness·Marks facts / 事實 insight）。**移除**所有造假生理數據；刪 `SESSIONS`/`renderEdgeTrace`/`renderEventsList`/`setClarity`；`openSessionDetail(ts)` 用時間戳從 store 取。
- **S3 爽感**：清單進場 stagger（`sessRise`，delay 上限 8 張）+ 三格 count-up（`countUpEl`）；`prefers-reduced-motion` 立即落終值、無動畫。

## 陷阱 / 注意
- **Avg Edge Score 無從推導**：統一 store 每筆只有 outcome/readiness/marks/durationSec/ts，沒有 Edge Score 或生理數據。凡是要在 store-driven UI 顯示 Edge Score/HR/HRV 的都是造假 → 改成可推導指標或留給 Scan phase（有真掃描時）。
- drill-in 拿掉了 reflection/clarity（那需要往 store 寫新欄位，超出「只用 store 有的欄位」範圍）；未來要反思可再加 clarity 欄位回寫。
- 舊的 `.sd-hero/.sd-trace/.sd-bio/.sd-reflect/.sd-evt` CSS 已無引用（dead CSS，留著無害，未清）。

## 下次接手點
- 四頁還剩 **Scan（P3）/ Timeline（P4）**，各自 PR。Timeline 同樣吃 `tenki.alert.outcomes.v1`（可直接複用 `loadOutcomes`/`outcomeMeta`/`OUTCOME_BADGE_V6`）。
- Playwright：`scratchpad/v6-session.mjs`（空狀態 + 3 筆統計/排序/badge + drill-in + reduced-motion）。

---

# 2026-07-30 Session Update #43 (v6 決策計時器做成真的 — dock 就地，取代假 8 秒 demo)

> 四頁升級延伸。Founder：dock 的決策計時器是 demo，要做成真的、「像 Fable 5」。決策（AskUserQuestion）：**dock 就地做真**（不做展開全屏儀表）；**outcomes 寫進和 TradingView 決策同一個 store**。

## 現況 → 做了什麼（`apps/preview/v6/index.html`，TM1–TM3 各一 commit）
- 舊：`renderFdcb` running 分支跑到 `elapsed>=8` 就 complete 的**假 8 秒**；prog 三段寫死 20/40/40；complete 不存任何東西。
- **TM1 真實引擎**：跑真 `tmpl.durationSec`；`.fdcb-fill` 填充；三段由時長推導 **Observe 0–33% →（`tmpl.segLabel`＝核心/readiness 段）33–66% → Extended**；`#fdcbSeg` 當前段；進核心段＝`reachedReadiness`。marks 真記錄（logEvent 只在 running 有效）。`nextState`：idle→ready→running；running 中點 core＝收束。
- **TM2 收束 + 統一 store**：`resolveOutcome`（鏡射 domain `resolveOutcomeTag`）：timeout→timed_out、收束後達 readiness→stayed_disciplined、未達→broke_discipline。`saveV6Outcome` append 到 `tenki.alert.outcomes.v1`（同鍵同形狀 + `marks`/`source:'v6'`，cap 200）→ **v6 決策與 TradingView 決策合流**（餵 /decision-alert/ 完成率 + 之後 Session/Timeline）。complete 顯示事實文字（跟著流程完成/提前收束/完整走完）。
- **TM3 爽感**：進 readiness 一次 breath 微光 + 收束一次色脈動（綠/橙）；`prefers-reduced-motion` 畫終態。

## 關鍵複用 / 對映
- v6 模板三段直接對到 decision-alert 的 readiness 模型：**核心段（segLabel）＝readiness 窗**，進入＝達 readiness。零新概念。
- 兩個計時器（v6 dock / `/decision-alert/`）目前各自 inline、不共用 code（鏡射同語意）；統一 store 讓資料合流。未來可考慮抽共用 decision-timer。

## 下次接手點
- 四頁還剩 Session / Scan / Timeline（各自 PR）。Session 頁現在可用真實 `tenki.alert.outcomes.v1`（含 v6 + TradingView）算對齊率/Insight。
- dock 展開「決策儀表」全屏（founder 這輪選 dock-only）是後續可選。

---

# 2026-07-30 Session Update #42 (v6 四頁升級 Phase 1：Lab / 模板自訂做成真的)

> Founder：四個 tab（Scan/Session/Timeline/Lab）「像 Fable 5 思考、提高爽感」+ 功能做成真的能用，點名**模板自訂「根本不能點」**。決策（AskUserQuestion）：分批做、**先 Lab / 模板自訂**；真實度＝**功能原型**。本輪＝Phase 1。

## 現況（v6 = 單檔瀏覽器原型，`apps/preview/v6/index.html` 4528 行）
- `goTab()` 切 screen（opacity-based，所有 screen 常駐 DOM）；大量數字寫死、多數按鈕死的。
- Lab 6 張卡只有 Baseline 有 onclick；模板自訂/穿戴/EdgeBucket/CSV/情境行事曆/Pro 全無 handler。
- 骨幹 `TEMPLATES`（6 內建）→ 底部 Select Template sheet（`selectTmpl` 讀 data-id）→ `currentTmpl` 驅動 session。

## 做了什麼（L1–L4，各一 commit）
- **L1**：自訂模板 localStorage（`tenki.v6.templates.v1`）→ merge 進 `TEMPLATES`（CUSTOM_<id>）→ 動態插入 sheet「我的模板」。選了走同一 currentTmpl 管線、零額外接線就能開 session。
- **L2**：`#tmplEditor` slide-in（名稱/時長/段標籤/顏色/圖示 + 即時預覽，建立/編輯/刪除 + 驗證）；Lab 卡接 `openTmplEditor()`。**z-index 9600 蓋過 scan-takeover**（見教訓）。
- **L3**：CSV 匯出真下載（`tenki.alert.outcomes.v1` → Blob/a[download]）；其餘死卡 → 誠實 `labInfo` toast（不留 dead click、不放假數據）。
- **L4**：Lab 進場 stagger（**opacity-only**，不與 :active transform 衝突）+ tap 深度 + featured glow；reduced-motion 安全。

## 教訓（→ PLAYBOOK 候選）
- **v6 有隱形吃點擊的全屏疊層**：`#stardust-scan-takeover`（z9000）雖 opacity:0/pointer-events:none，但子層 `.scan-takeover-fingerprint-wrapper` 是 `pointer-events:auto`（底部常駐掃描觸發區）→ 會吃掉它範圍內的點擊。新全屏 overlay/底部按鈕要 **z-index > 9000** 才不被吃（editor 設 9600）。headless 也會被 `tenki-splash` 擋 → 測試先 `remove()` 這兩個疊層。
- v6 screen 是 opacity 常駐（非 display:none）→ 進場動畫別用會在 load 就跑掉的 CSS animation；用 **transition keyed on `#lab-screen.active`**（opacity）才會「進頁才播」。

## 下次接手點
- Phase 2 Session（對齊率/Insight/卡由真實 outcomes 算）、P3 Scan、P4 Timeline 各自獨立 PR。
- v6 = CI 盲區 → founder 硬重載 `/v3/` 實走：Lab 建自訂模板 → Select Template 選它開 session。

---

# 2026-07-29 Session Update #41 (收束頁 v2 — 揭示時刻的儀式感 + Web Push 實機通關)

> #40 的收束頁揭示偏「平靜極簡」（所有東西同時放出）。founder 選「再進化、爽感加碼 → 只加揭示時刻儀式感」。另外 Web Push 這輪也實機通關了。

## Web Push 通關（延續 #39–#40）
- 頻道預設 symbol 根治後 log 顯示 webhook **200** 了，但推播仍沒跳 → log `[push] subscriptions=0`。
- 根因：`refreshPushRow` 只看本機 `getSubscription()` 就顯示「已開啟」，**從不把訂閱綁到「當前頻道」server 端** → 換頻道後訂閱掛舊頻道。修法：開頁偵測本機有訂閱就 best-effort 重 POST `/api/subscribe?ch=<當前頻道>`（冪等）。`?v=alert17`，PR #206。
- **實機驗收通過**：founder 在別的 App 裡收到「TENKI 決策快訊 · ES1! 交叉 7,480」背景通知。三塊（webhook 200 / 訂閱重綁 / sent=1）全通。

## 收束頁 v2：揭示編排（choreographed reveal，`?v=alert18`）
把「同時放出」改成**由弧驅動的時間軸**（弧＝真實資料）：
- `drawResultArc` 加 `onDone` callback（sweep 完成錨點；`animate=false` 同步呼叫）。
- `openResult` 編排：弧掃完 → 圓心 outcome **落定**（`.landed` scale 1.06→1）+ 一次微光 **breath**（`.result-arc-glow.pulse` 單次，非重複迴圈）+ **完成率 count-up**（`countUpRate` rAF，末值＝`rateText`）+ meter 同刻填 → 下方三區塊 **cascade**（`.reveal-item.in` stagger 90ms）。
- **平靜/合規**：一次呼吸不做 streak/confetti/音效；`prefers-reduced-motion` 不加 `.reveal`、無 glow、即見終態。
- Playwright `shoot-result.mjs` 38 斷言（含 landed/cascade/glow/count-up 末值 + reduced-motion 分支）。

## 教訓
- **page.clock 只 fake JS timers，不 fake CSS animation**：glow 的 `animationend` 走真實時間 → 測試別斷言「pulse 已移除」，改斷言「`--glow` 已設定」等同步狀態。
- 編排讓收束頁的 rAF/ setTimeout 變長 → 既有測試 `runFor(1000)` 不夠、殘留 pending timer 會卡住後續 clock 操作 → 加編排時**同步把測試等待拉到 ~1900ms**。

## 下次接手點
- 收束頁四塊只加碼了「揭示」；歷史 sparkline / clarity 反思 / 整頁配色收斂 三塊 founder 這輪沒選，之後可再問。
- Phase D 其餘（快訊 inbox / 連線健康度面板）仍未做。

---

# 2026-07-29 Session Update #40 (決策收束頁 Fable-5 視覺化 + 頻道預設 symbol 根治 400)

> 同一天續作。兩條線:①收束頁從純文字升級成視覺化(founder「像 Fable 5 思考、提高爽感」);②Web Push 又沒跳 → log 揪出還是裸連結 400 → 這次從 server 端根治。

## A. 決策收束頁視覺化(`?v=alert15`,R1–R3)
- **domain** `selectRecentOutcomes(records,limit)` 純函式 + Jest（取最近 N 筆供軌跡）。
- **收束頁重排**（`decision-alert.{html,js}`）:canvas 弧揭示（禁 SVG ring → canvas，弧長＝這次走多完整，rAF + reduced-motion 畫終態，固定 176px 避 offsetWidth=0 陷阱）+ 完成率 meter + momentum strip（最近 12 次，最右＝本次高亮）+ 事件鏈 recap（快訊→更新→Readiness→收束）。
- **反思 land 微互動** + **「收束頁設定」面板**（顯示紀律近況/軌跡/反思 三開關，存 `tenki.alert.result.settings.v1`）。記錄一律 on（auto-save-on-close 既有，背景關閉也存）→ 刻意不做關閉記錄的開關。
- 爽感走**平靜路線**（AskUserQuestion 定案）:無 streak 壓力，貼合 wellness + brand.md § 5。
- Playwright `shoot-result.mjs` 32 斷言全綠（弧 ratio/色、meter、strip、recap、反思、持久、設定隱藏、auto-save）。

## B. 頻道預設 symbol —— 裸連結 400 的 server 端根治（P1–P3）
- **又踩坑**:founder「開網頁能進決策頁但沒開網頁不跳」→ log 顯示 `/api/alert` 過去 14h **9 次全 400**。因輪詢正常(頻道有效)→ 400 = **webhook 又是裸連結、缺 symbol**（第 3 次）。推播是 200 後才送 → 全 400 就一則都不會推。
- **根治**:`api/_lib/store.ts` `set/getChannelSymbol`（`tenki:chsym:v1:<ch>`）;`api/channel.ts` 收 `POST ?ch=+{symbol}` 綁定頻道預設;`api/alert.ts` payload 缺 symbol 時 best-effort 回填頻道預設 → 200。query 明給仍優先。preview（`?v=alert16`）標的變更/開頁即 debounce POST 綁定。
- smoke +8（42 斷言）;Playwright bind 斷言。**兩層防呆**:產生器（UI）+ 頻道預設（server）。

## 教訓
- **iOS Web Push 只在『加入主畫面』PWA 背景跳,Safari 分頁不算**;且推播訂閱與 webhook 必須**同一頻道**（PWA/Safari/重設連結會換頻道）。已寫進 PLAYBOOK §6。
- 「裸連結漏 symbol」踩到第 3 次 → 光靠 UI 提醒不夠,**server 端兜底才是根治**。凡是「使用者手貼易錯」的必填欄位,想想能不能綁到已知的 server 狀態自動補。

## 下次接手點
- 本輪 PR merge 後,founder 開 `/decision-alert/`（PWA）填標的一次 → 頻道綁定預設 → 舊的裸 webhook 也會 200。實機驗一則 ES1! 觸發應見 200 + push。
- 收束頁 R4 docs（SPEC §9 升級）尚未寫；Phase D 其餘（inbox / 連線健康度）仍未做。

---

# 2026-07-29 Session Update #39 (基線結果頁改成校準尺 — Stitch 把區間帶做成了進度條)

> 同一個 session 第二次走「我寫 prompt → founder 丟給 Google Stitch → 我把產出真的做出來」。第一次是掃描頁（#37）。這次是 `#step-result`。

## 教訓一：Stitch 會把隱喻做反，照描就等於發錯意思的儀器
我 prompt 寫的是「**一條刻度軸 + 一段標示你範圍的區間帶**」。Stitch（IMG_0224）畫成「整條實心長條，左邊約 28% 填滿金色」—— 那是**進度條 / 油量表**，讀起來是「你完成了 28%」。這頁沒有任何東西在進行中，也沒有滿分。**產出的構圖可以照抄，語意必須自己驗**：問「這個形狀在使用者眼裡代表什麼」，不是「好不好看」。

## 教訓二：把帶子接上真資料，設計自己會擋掉壞資料
帶子的 `left`/`width` 直接由 `mean ± std` 映射到軸上（心率 40–120 / HRV 0–120 ms / 呼吸 6–24）。於是 IMG_0207 上那個 **HRV 510 ms**（峰值偵測抖動，不是心率變異）**畫不進軸**，該列自動變成「訊號不夠穩，下次掃描補上」並讓品質標籤降級 —— 不是額外加的檢查，是設計的必然結果。**不截斷到上限假裝正常**：把壞資料包裝成好資料比顯示壞資料更糟。

## 教訓三（→ PLAYBOOK 候選）：直向 flex 裡的固定尺寸元素會被壓扁
`.result-icon` 宣告 80×80，實測 computed **80×42** —— 直向 flex 容器內容一溢出，預設 `flex-shrink:1` 就壓高度。founder 看到的「橢圓綠勾」是這個，不是造型。判定法：**量 computed 尺寸，跟宣告值不符就是被 flex 壓的**。凡是 flex 容器裡的固定尺寸裝飾都要 `flex-shrink: 0`。

## 教訓四：兩個 absolute step 同時 active 就會互相畫在對方身上
`enterTransition()` 讓 `#step-result` 先 `.active`，`#step-scan` 到 **t=2.0s** 才拆。那 2 秒內掃描頁的 `.privacy-secured` / `.capture-frame` 整個蓋在結果卡上（founder 截圖裡的疊字與被裁的內文）。修法是轉場一開始就隱藏**非儀式性**裝飾，儀式層（particles / flash / backdrop）不動。**寫測試時要先證明測試會失敗**：第一版探針在掃描頁沒 active 的情況下量，三個數字都是 0 —— 看起來過了，其實什麼都沒驗到。

## 驗證 / 下次接手點
- headless 390×673：hr 70±2 → 帶子 left 35% / width 8%（夾到下限），與手算一致；HRV 510 → 帶子 hidden、品質「優良」降「普通」；捲到底時 CTA 距免責條 22.3px；轉場 t=0.5/1.5s 掃描家具皆不可見而 `#step-scan` 仍 active；pageerror 0。
- `?v=` 已 bump 成 `calib_v1`。**真機仍待 founder 實走**；#201 的 iOS switch 觸感也還沒回報。

---

# 2026-07-29 Session Update #38 (快訊網址產生器 — 根治「裸連結漏 symbol → 400」)

> #35 之後隔幾天 founder 又踩同一坑：TradingView alert 觸發、TV 自家通知有跳，但 TENKI 沒進。

## 診斷（又是 Vercel MCP get_runtime_logs 破案）
- log 顯示 `POST /api/alert` 一連串 **400**（不是 404 → 與頻道無關，是 payload 本身不合格）。
- 對照 founder 截圖：頁面「複製連結」按鈕吐的是 `?ch=…` **裸連結、沒有 `&symbol=`**；而 `symbol` 是 schema 必填（`domain/src/schemas/alert-schema.ts:45`）→ 缺 symbol → 400。
- 附帶再次確認 **PWA/Safari/重設連結會換頻道**（這次頻道從 `f655`→`f82b`→`1dbd` 連換），更凸顯手拼 URL 不可靠。

## What was done（一個 Todo = 一個 commit）
- **`apps/preview/decision-alert.{html,js}`（`?v=alert13`）**：「連接 TradingView」區塊加**標的/週期/策略**輸入框（標的預設 `ES1!`）→ 即時把 `&symbol=`/`&timeframe=`/`&strategy=` 烤進 webhook URL，存 `localStorage['tenki.alert.fields.v1']`。「複製連結」拿到的即含 symbol 的完整連結。標的留空顯示黃色警示。
- Playwright headless（`scratchpad/shoot-urlgen.mjs`）13 條斷言全綠：預設 ES1!、即時更新、重載持久、清空顯示警示、無 pageerror。
- 純 preview + docs，**不動 domain/api**（schema 維持 symbol 必填，是產生器去迎合它，不是放寬驗證）。

## 教訓
- **這是「裸連結漏 symbol」第二次出現 → 已提煉成 PLAYBOOK 一條**（見協議 §4 compound learning）。
- 治坑要治源頭：與其每次口頭提醒 founder「尾巴補 `&symbol=`」，不如讓 UI 根本吐不出裸連結。

## 下次接手點
- 產生器已上 `main` 後，founder 端要**重新複製一次連結**（新版才含 symbol）貼回 TradingView。
- Phase D 其餘打磨（頁內 setup step 卡、最近快訊 inbox、連線健康度）仍未做，非必要。

---

# 2026-07-28 Session Update #37 (手指掃描頁換成 tissue instrument — 讓量測值本身變成畫面)

> Founder：「長方框加圓再加橢圓手指，設計上有點奇怪」，附三張 Google Stitch mock（reading / adjust / waiting）＋「像 Fable 5 一樣思考，提高爽感」。同一 session 前半還做了 v6 圓片按鈕的陀螺儀化（#201）。

## 真因
`#step-scan` 疊了四種互相打架的形狀語言：金色圓角取景框＋四角標、圓形 ring container、細長指腹橢圓、方位點環。**那個取景框是從臉部掃描繼承來的** —— 臉需要對框，手指蓋住鏡頭時根本沒有東西需要取景。旁邊 `.ppg-waveform` 的 8 根長條是純 CSS 動畫、沒有任何 JS 餵它 → PLAYBOOK §6 明令禁止的假折線。

## 做法（3 commits，PR #202）
把三張 mock 照描成 CSS 只會得到一張好看的貼圖。真正的作法是**讓光球由真實訊號驅動**：`camera-scan.js` 的 `redMean` 就是穿過指腹的光量，所以紅色輝光**本身就是量測值**，波形是同一條序列畫出來的。新元件 `apps/preview/tissue-instrument.js`（`window.TENKI_TISSUE`），三態只由 `coverage` 決定 —— 那是使用者唯一能行動的訊號。
- adjust 時把發亮區域推離圓心 + 疊暗月牙，缺口就是沒被蓋滿的那一側；係數 `R*0.42` 太弱（實測只位移 0.13R ≈ 15px），提到 `R*0.72` 才在手機尺寸讀得出來。
- 波形以**視窗自身 min/max** 正規化 —— PPG 是大 DC 上的小 AC 漣漪，固定尺標會畫成直線。右緣對齊（床邊監視器邏輯），緩衝區沒填滿時向左生長，而不是右邊留一塊空白。
- 沒有相機 → 不餵任何樣本 → 停在 waiting、不畫波形、文案「示範模式 — 沒有真實訊號」。桌機比較安靜是對的。

## 教訓
- **臉/指共用畫面，改一邊要先確認另一邊**：不刪既有 markup，改用 `#step-scan[data-sensor]` 做 CSS gate。臉部零改動。
- **CSS gate 被自己的樣式區塊破功**：`.ti-telemetry { display:none }` 之後又在樣式區塊寫 `display:flex` → 那排數字漏進臉部畫面。**gate 擁有 `display` 時，樣式區塊就不准再宣告它**。是臉部回歸測試抓到的，不是眼睛看到的 → 每次改共用畫面都要跑另一條路徑。
- **canvas 裝飾畫在半徑外會被畫布邊緣切掉**：graduations 在 `R+11`、進度弧在 `R+14`＋10px shadow，而 `R = 半邊長 - 2` → 弧在左右被切成兩段。留 `RIM_ROOM = 22`。
- **合成感測器比 stub 好**：產一段 72 BPM 的 Y4M（收縮峰＋dicrotic notch，10s = 12 拍無縫循環）餵 `--use-file-for-fake-video-capture`，**真的** camera-scan pipeline 端到端跑出 72 BPM。比 mock 掉 `getUserMedia` 更能證明整條鏈是通的。

## 驗證 / 下次接手點
- 390×673 headless 四路徑（手指＋合成相機 / 臉部 / 拒絕權限 / reduced-motion）pageerror 皆 0；`verify.sh --quick` 全綠。`?v=` 已 bump 成 `tissue_v1`。
- **仍欠 founder 手機實走**：光球是否隨手指真的亮起來、月牙讀不讀得懂、波形有沒有跟著心跳走。另外 #201 的 **iOS switch 觸感到底有沒有觸發**（沙箱零可能驗證）也還沒回報。

---

# 2026-07-25 Session Update #36 (手指旗艦頁上下黑條 — 內層 scroller 架空外層的死區)

> Founder 實機四張截圖（IMG_0138–0141）：`/preview/index.html` 手指流程捲動時上下各一條黑色長條遮住內容。這是 #169「滑動黑屏」的**未竟殘留**，症狀不同、根因不同。

## 真因（headless 390×673 量到，非推測）
`.step-content` 有 `overflow-y:auto` + `max-height:100%` → 它才是真正在捲的容器，而它坐在 `.step` 的 padding 內縮框裡，內容被硬裁在 y=80 / y=593。於是 `.step` 的上下 padding 各 80px 變成「進不去、只有底色」的死區＝那兩條黑帶；而 #169 想讓 `.step` 內部捲動的設計實測 `溢出 = 0`，**從未生效**（被內層 scroller 架空）。底部 45px 的 `.disclaimer-bar`（幾乎不透明、DOM 在後所以蓋在上層）再吃一截 → 「繼續」鈕 rect 598–653 落在裁切線 593 外被切半。

## 修法（1 commit，只動 `styles.css` + `index.html` 的 `?v=`）
- 捲動容器改為**貫穿全高**的 `.step-content`（`height:100%`），clearance 移進它自己的 padding；`.step` 只留橫向 padding、`overflow:hidden` **不捲**。
- **為什麼不是讓 `.step` 捲**：掃描儀式的 `.scan-banner`／`.scan-backdrop`／`.scan-particles`／`.scan-flash` 與 `.step::before` 星塵、`.step::after` 星雲都是 `.step` 的 absolute 子層 —— `.step` 一捲，它們會整組跟著滑走。維持 `.step` 不捲＝疊層自動釘住（已斷言 banner 捲動前後 top 皆 0）。
- 加 `overscroll-behavior:contain`（阻斷捲動鏈到 body，正是 §6 iOS page-pan 黑屏成因）、`justify-content: safe center`（短步驟仍置中、長步驟自動起點對齊）。
- 底部 clearance 拆成 `--content-pad-b`（變體自調留白）＋ `--disclaimer-clear: 56px`（免責條清空高度，不可被覆蓋）。**踩到的坑**：`.readiness-step` 原本直接覆寫 `padding-bottom: 32px`，改動後就把免責條的清空高度一併蓋掉、鈕又被壓住 —— 變體改覆寫變數即可。

## 教訓（同類第二次出現就提煉進 PLAYBOOK §6）
**巢狀 scroller 陷阱**：外層設 `overflow:auto` + 內層又設 `overflow:auto`+`max-height:100%` → 外層永遠 `溢出 0`、內層在外層 padding 內縮處硬裁，padding 區變成死區黑帶。判定法：量 `scrollHeight - clientHeight`，等於 0 的那層就是被架空的假 scroller。

## 驗證
- headless 三種高度（390×673 in-app webview／844／667）× 5 個 step 共 15 項全綠：內容框 = `[0, 視窗高]`（死區歸零）、捲到底時最後按鈕 bottom ≤ 免責條 top、掃描疊層釘住、零 pageerror。`check-vocab` 綠。
- **真機仍待 founder 實走**（iOS 慣性、`safe` 關鍵字、backdrop-filter）；`styles.css?v=` 已 bump 成 `scroll_bands_v1`，記得硬重載。

---

# 2026-07-24 Session Update #35 (Web Push 實機 debug 通關 — 診斷 log 揪出 VAPID env 髒值)

> #34 上線後實機「推播沒跳」。靠伺服器 log 逐環查證,最後由**診斷 log** 直接指出根因。

## 逐環查證(Vercel MCP get_runtime_logs 是這次的英雄)
1. `/api/alert` 一開始 400 → **光禿 webhook URL 缺 symbol**（修：URL 尾接 `&symbol=ES1!`；founder 還踩過 URL 中間空格 → TradingView「該網址無效」）。
2. 改對後 200,但推播沒跳 → log 顯示 `/api/subscribe` **從沒被呼叫** → 沒訂閱可推。
3. founder「加入主畫面」開推播成功,但 **PWA 的 localStorage 跟 Safari 分開 → 產生新頻道 `f655…`**,而 TradingView webhook 還指著舊頻道 `9a94…` → **訂閱在新頻道、快訊在舊頻道,對不上**（修：webhook 換成新頻道連結）。
4. 對上後仍沒跳,且推播送出被 try/catch **吞掉、無 log** → 加診斷 log（`chore(api)`, #193）→ 下一則觸發即現形：
   ```
   [push] ch=f655f937 vapid=yes
   [push] subscriptions=1
   [push] send threw: Vapid public key must be a URL safe Base 64 (without "=")
   ```
   → **env `VAPID_PUBLIC_KEY` 值髒了**（手機貼 env 時夾到多餘字元）。重存乾淨 + redeploy 解決。

## 教訓（→ PLAYBOOK 候選，多條）
- **付費/機密以外的 debug 要靠伺服器 log**：sandbox 代理擋 `*.vercel.app`,我測不到正式站；**Vercel MCP `get_runtime_logs` / `list_deployments`** 是唯一窗口,善用。
- **推播/webhook 這種 best-effort 靜默失敗一定要留 log**：原本 try/catch 全吞 → 查了好幾輪才加 log。凡是「失敗不影響主流程」的分支,至少 `console.error` 狀態碼。
- **PWA 與 Safari 的 localStorage 是兩套** → 加入主畫面會產生**新頻道**,webhook 要跟著換。這是「網址產生器 / 把 symbol 烤進連結」還沒做前的必踩坑。
- 手機貼長字串到 env/URL 極易夾到空格/換行/`=`；**值錯 web-push 會丟明確訊息**（"URL safe Base 64 (without =)"）。

## 下次接手點
- 「快訊網址產生器」（symbol 烤進 URL + 綁定當前頻道）根治光禿 URL + PWA 換頻道兩個坑。
- Web Push 真機最終驗收（env 修好 + redeploy 後 log 應見 `sent=1`）。

---

# 2026-07-20 Session Update #34 (Web Push — 關掉網頁也收得到，不用 Mac · Phase D)

> 實機 debug：ES1! webhook 光禿 URL 缺 symbol → 400 沒進頻道（修：URL 尾接 `&symbol=ES1!`，founder 貼時還踩了空格）。修好後真實 ES1! 下穿 7519 首次完整浮出面板 🎉。接著 founder 要「不用一直開網頁」→ 做 Web Push。

## 重要更正
- 之前口誤「Web 推播需要 Mac」是**錯的**。**iPhone 網頁推播（Web Push, iOS 16.4+）不需要 Mac** —— service worker + VAPID + PWA 即可，Safari 關著也跳通知。需 Mac 的是**原生 App** 推播（Phase 3）。

## 做了什麼（repo 首個 runtime dependency: web-push）
- `api/subscribe.ts`（POST 存 / DELETE 移除訂閱，ch 把關）+ `store.ts` per-channel 訂閱（`tenki:push:v1:<ch>`，endpoint 去重、cap 5、頻道 TTL、死 endpoint 修剪）。
- `api/_lib/push.ts`：`resolveVapidConfig`（env）+ `buildPushPayload`（事實語言，無買賣）+ `sendAlertPush`（web-push 送、回死 endpoint）。`api/alert.ts` pushAlert 後 best-effort 送，try/catch **絕不因推播失敗而讓 webhook 失敗**；無 VAPID env 優雅跳過。
- preview（`?v=alert12`）：`sw.js` + `manifest.webmanifest`（PWA，brand icons）+ 連接面板「🔔 開啟手機推播」（register SW → 權限 → pushManager.subscribe → POST /api/subscribe）。
- smoke +8（共 32；NODE_PATH 修正讓 temp 編譯 resolve web-push）；Playwright `shoot-push.mjs` 9（mock SW/Push 鏈）。

## founder 前置（跟 Upstash 一樣一次性）
- Vercel env：`VAPID_PUBLIC_KEY`（＝前端內建那把）、`VAPID_PRIVATE_KEY`（機密，不入 repo，私訊給）、`VAPID_SUBJECT`（mailto）。VAPID 公鑰已內建 `decision-alert.js`；私鑰只進 Vercel env。
- 手機：Safari 開 `/decision-alert/` → 分享 → **加入主畫面** → 從 App 開 → 開啟推播。iOS Web Push 只在主畫面 App 生效。

## 教訓（→ PLAYBOOK 候選）
- **光禿 webhook URL（只有 ch）+ 純文字訊息 → 缺 symbol → 400**。頁面「複製連結」給的是光禿 URL,人話訊息又不帶 symbol,這組合必壞。解法：URL 尾接 `&symbol=`。**下個 session 若做「網址產生器」把 symbol 烤進 URL 可根治**（本次未做）。
- webhook 推播 ≠ TradingView 的 App 推播（兩個獨立勾）；沙箱代理擋 `*.vercel.app`,正式頻道只能靠 founder 開 `/api/alerts?ch=&since=0` 查證。
- Playwright 測 Web Push:真訂閱 headless 起不來 → mock `navigator.serviceWorker`/`PushManager`/`Notification`,只驗客戶端 wiring（POST /api/subscribe）。真送達靠 founder 實機。

## 下次接手點
- 「快訊網址產生器」（輸入 symbol → 產完整 URL,免手接 & 免踩空格）根治光禿 URL 陷阱。
- Web Push 真機驗收（founder 設 VAPID env + 加入主畫面 + 觸發）。

---

# 2026-07-19 Session Update #33 (demo 對齊 ES/Mancini — 修 NVDA 成長股框架不符)

> Founder 實機截圖:「我目前是 ES,不是 NVDA;也不是雙快訊(NVDA+TSLA)」。demo 三顆按鈕用成長股框架,與 founder 單一標的關卡交易不符。

## 交易型態差異（重新設計依據）
- 成長股(NVDA/CANSLIM):多檔、Breakout 突破買。
- founder(ES1!/Mancini):**單一標的、關鍵價位 → 假跌破 FBD**（掃低收回）。單檔沒有「多檔同時」;真正的叢集是**同一檔多個價位**（快速 flush 連踩兩級）。

## 做了什麼（preview `?v=alert11`）
- 單一快訊 → `ES1! · 假跌破 FBD · 1m · Mancini`（建議模板 = Mancini 假跌破流程 FBD ⭐）。
- 「雙快訊 NVDA+TSLA」→「連續價位」＝同一檔 ES1! 一波連踩兩級（60s 聚合）。
- 「同標的再觸發」→「同一價位再觸發」＝ K 棒內反覆穿越 → 冷卻。
- 聚合卡同標的顯示「ES1! · N 個價位同時觸發」（不再 `ES1! / ES1!` 冗餘）。
- Playwright `shoot-es-demo.mjs`（7 斷言）+ timer(改 FBD 段落 Ground/Execute/Confirm)/result/settings/wiring 全綠。

## 教訓
- **付費計劃內容不入 repo**:demo 用**合成示意價位/描述**（假跌破/掃下緣/續破），不寫 founder 實際 plan 的 7473/7408 等 Mancini 付費數字。
- 改 btnSingle 的 strategy（CANSLIM→Mancini）會連動建議模板（FBD 段落/時長不同）→ 相關 Playwright 段落斷言要同步改。

## 下次接手點
- 四階段規劃 Phase D（setup 頁內引導 + 快訊 inbox + 連線健康度）仍未做。

---

# 2026-07-19 Session Update #32 (決策節奏設定面板 — 使用者可調 · Phase C)

> 四階段規劃續作。冷卻/上限/聚合/偏好從寫死常數 → 使用者可調+持久。

## 做了什麼
- **domain**：`AlertDeliverySettings` + `createDefaultAlertSettings`（＝現值，向後相容）；`evaluateAlertDelivery` 收 optional settings（cooldownSec/dailySurfaceCap/strainSilent/sessionQuietUpdate）。`isWithinQuietWindowET`（美東 ET，DST-aware，用 Intl）+ `QUIET_WINDOW_CONTEXT_ZH`「盤整迴避時段」。Jest 29（+9）。
- **preview（`?v=alert10`）**：可收合「決策節奏設定」面板 — 同標的冷卻/聚合窗（秒）、Strain 靜默、同標的安靜更新、盤整迴避時段（美東 11–14）開關；localStorage `tenki.alert.settings.v1` 持久；evaluateDelivery 鏡像讀。quiet window 開且在 ET 窗內 → 面板加「盤整迴避時段」事實行（與 Mode 脈絡同一行 join）。
- Playwright `shoot-settings.mjs` 19 斷言（冷卻影響抑制、strain 靜默開關、quiet 提示、持久化、reset）；A/B/wiring 回歸全綠。

## 教訓
- preview 冷卻預設仍 30s（demo 縮時），domain 預設 300s — 兩者刻意不同；設定面板預設走 preview demo 值。
- Playwright `page.clock.install({ time })` 可把時鐘釘在特定 ET 時刻 → quiet-window 這種 time-of-day 行為才能 deterministic 測。

## 下次接手點（四階段剩 D）
- Phase D：setup 頁內引導（可複製 URL/範本）+ 快訊 inbox（拉 /api/alerts 歷史）+ 連線健康度。

---

# 2026-07-19 Session Update #31 (計時器優化 · Phase B)

> 四階段規劃續作。Phase B 純 preview 呈現（early-complete 偵測已在 A 接好）。

## 做了什麼（`?v=alert9`）
- 浮動計時條隨 elapsed **高亮當前段落標籤**（`.seg-label.active`）。
- 進入 readiness 窗 → 事實行 `#timerPhase`「Readiness 窗開啟」（強調色，流程語言、**非「可進場」**）；離開恢復「目前：<段落>」；結束清空。
- Playwright `shoot-timer.mjs` 11 斷言（Observe→Readiness→Extended 三段標籤高亮 + phase 行 + 時鐘 in-window + 結束清空）；result/wiring 回歸全綠。

## 下次接手點（四階段剩 C、D）
- Phase C 設定調整面板（冷卻/上限/quiet window ET/偏好，使用者可調+持久；domain 常數改可注入 `AlertDeliverySettings`）。
- Phase D setup 頁內引導 + 快訊 inbox + 連線健康度。

---

# 2026-07-19 Session Update #30 (決策收束頁 — 補上決策迴圈斷掉的尾端 · Phase A)

> Founder：「完整思考延伸優化結果頁、決策計時器、快訊完整功能」。深度盤點 → 四階段規劃（plan 檔），本次交付 **Phase A 決策收束頁**。

## 關鍵發現
- 決策迴圈**尾端是斷的**：計時器結束只 log 一行，無結果頁、outcome 未捕捉，連 Entry Panel「紀律完成率：—」永遠空。
- engine **早已定義** canonical 模型沒接上：`packages/engine/src/session/types.ts` 的 `OutcomeTag`（流程語言）+ `ReflectionRecord`。收束頁直接複用，不自創。

## 做了什麼（Phase A）
- `domain/src/policies/decision-outcome.ts`：`resolveOutcomeTag(endType,reachedReadiness)`（timeout→timed_out；cancel→broke；close+readiness→stayed_disciplined；close 窗前→broke）+ `summarizeDisciplineRate`（disciplined＝stayed+timed_out ÷ 全部）。Jest 9。
- preview 決策收束頁（`?v=alert8`）：outcome 顯示、Readiness 是否進入、同標的更新次數、反思三選 chip、紀律完成率回填 Entry Panel、early-complete 偵測、背景關閉仍記錄。localStorage `tenki.alert.outcomes.v1`。
- Playwright `shoot-result.mjs` 13 斷言（三 outcome 分支 + 反思存檔 + 持久化 + 完成率累計 33%）。

## 教訓
- **Playwright 時間控制**：`page.clock.fastForward` 每個 timer 只觸發**一次**（跳躍）；要逐 tick 推進 setInterval（計時器 elapsed）得用 **`page.clock.runFor(ms)`**。冷卻清除等「只需 Date.now 前進」才用 fastForward。
- domain 不依賴 engine → `OutcomeTag` union 在 domain 本地鏡射並註明 source of truth，勿跨 package import。

## 下次接手點（四階段規劃剩餘，plan 檔有全文）
- Phase B 計時器優化（當前段落標籤、readiness 窗更明確、early-complete 已在 A 接好）。
- Phase C 設定調整面板（冷卻/上限/quiet window ET/偏好，使用者可調+持久；domain 常數改可注入 `AlertDeliverySettings`）。
- Phase D setup 頁內引導 + 快訊 inbox + 連線健康度。

---

# 2026-07-18 Session Update #29 (§10 接線候選：Mode 標籤 + session 同標的安靜更新)

> 主線收尾後 founder：「不需 Mac 就實作」六接線候選。先問清楚（AskUserQuestion）再動：**低風險先上**。

## 做了什麼
- **§10 #1 Mode 標籤**：`domain/src/policies/market-mode.ts` — `extractMarketMode` 掃 `condition`→`note` 比對 `/mode\s*([12])\b/i` → Entry Panel 脈絡行「Mode 1 · 趨勢延續傾向」「Mode 2 · 區間／陷阱傾向」（事實非建議，過 compliance 詞庫）。
- **§10 #6 session 同標的安靜更新**：契約加 `session_quiet_update` 決策 + `AlertDeliveryInput.activeSessionSymbol`；active session 中同標的 → 計時條下浮一行、不彈新面板；異標的維持 `silent_received`。源自 7553/7547 僅距 6 點實戰。
- preview 鏡像（`?v=alert7`）兩者；Playwright headless 12 斷言全綠（scratchpad/shoot-wiring.mjs），既有 channel-mode 回歸也全綠。

## 決策紀錄（founder 拍板，寫進 METHODOLOGY §10 避免下個 session 重問）
- 未來 quiet window：時區 = **美東 ET**（Adam Mancini ES 盤）；抑制型呈現 = **軟性事實提示**（不硬靜音）。
- 未來節奏熔斷：同採軟性事實提示；勝負須映射到 session close/cancel，動工前再對齊語意。

## 教訓 / 下次接手點
- **兩層要同步**：canonical 邏輯進 `domain/`（Jest），preview 是 vanilla JS 鏡像（CI 盲區）→ 改 delivery 邏輯必同時改兩邊 + Playwright + founder 手機走。
- domain 測試**不要**跨 package import `packages/engine`（依賴方向不存在、ts-jest 脆）；本次已移除。
- backlog 未做：§10 #2 Mode-aware 模板提示、#3 行為統計分層、#4 quiet window、#5 節奏熔斷；Phase 3 原生推播（需 Mac）。

---

# 2026-07-16 Session Update #28 (🎉 端到端全鏈路實機首度完整貫通 — 開頁即見決策面板)

> #27 merge + founder 硬重載後，實機首度完整成功。整條 TradingView 整合線（#178–#186，9 個 PR）畫下句點。

## 實機證據（founder 截圖 10:28）
開 `/decision-alert/` → **零操作自動補浮出 Entry Panel**：
- 標題 `ES1! · SR Flip · 1`（condition 從 URL query-param）
- **founder 計畫原句登場**：「三日S/R轉換。緩跌可掛多；更安全=等7527/29低點群被掃再收回」（觸發瞬間顯示早上冷靜寫的計畫 = 產品靈魂）
- 狀態行事實陳述「Neutral · Decision Edge Score 58 · 紀律完成率 —」（零金融建議、零代碼）
- 事件鏈 `已呈現／已接收（含「稍早」靜默記錄）`、[略過]/[進入決策]

lastSeen 未讀模型 + 硬重載（`?v=alert6`）後，「隔多久開都補上未讀最新一則」在真機成立。

## 整條線完成清單（歷史索引）
規格書/邏輯層/demo(#178) → webhook 後端(#178) → 零輸入頻道配對(#179) → 命名勘誤+方法論(#180) → 手機實況(#181) → 里程碑(#182) → hybrid parser(#183) → query-param 乾淨模式(#184) → catch-up(#185) → lastSeen(#186)。Upstash 由 founder 開通。乾淨模式（URL 帶結構化欄位、message 純人話）＝零代碼推播。

## 下次接手點（此線已收尾，以下為 backlog）
- Phase 3 TENKI 原生推播（「不看也收到」終解，需 mobile app）。
- §10 六接線候選待 founder 拍板：Mode 標籤進快訊、quiet window(11-14 盤整)、贏停/雙輸熔斷、每日上限依節奏收斂、session 中同標的安靜更新。
- 每日 alert 階梯是 founder 手動維護（付費計畫內容不入 repo）。

---

# 2026-07-16 Session Update #27 (lastSeen 未讀模型 — #26 的 60min 窗太短，隔天開頁仍漏)

> Founder 二度回報「快訊有到但 TENKI 沒出現」。這次**先查證頻道內容**才動手（PLAYBOOK 教訓：不猜）。

## 診斷（關鍵）
- 用 `GET /api/alerts?ch=<founder ch>&since=0`（founder Safari 開、貼 JSON 回來）確認：**快訊全都在頻道裡**（webhook + 乾淨模式 query-param 都正常運作：`condition:"Key Low"` 從 URL、`note` 是計畫句子、price:null 如設計）。→ 不是 webhook/頻道問題，是**頁面沒顯示**。
- 根因：#26 的 catch-up 用固定 60 分鐘回看窗；founder 昨天觸發、今天才開 TENKI，全部超窗被濾掉。「昨天」這種真實節奏 60min 遠遠不夠。
- **自查工具無法用**：Vercel MCP web_fetch 需即時授權（本 session 沒跳成）；改請 founder 手機開 inspect URL 貼 JSON —— 最快的確定性診斷，已寫進 SETUP §5。

## 修法（`apps/preview/decision-alert.js`，`?v=alert6`）
用「**看過沒**」取代「**時間窗**」：per-channel `localStorage['tenki.alert.lastseen.<ch>']` 記上次看過的最新 receivedAt；開頁 `sinceMs = loadLastSeen(ch)`（預設 0）；catch-up 首輪浮出最新未讀一則、其餘靜默記錄；`advanceSince()` 每次前進都持久化。→ **不論多久前觸發，開頁一律補上未讀的最新一則；看過的不再重跳**。Playwright +3 斷言（20 小時前仍浮出 / lastSeen 持久化 / 看過不重跳），共 22 全過。stub 已對齊 production 的 `since` 過濾。

## 殘留界線
仍須開頁才看得到（web 版本質）；「不看也自動彈」＝ Phase 3 TENKI 原生推播。但 lastSeen 讓「隔多久開都不漏未讀」成立，web 版可用性到位。

## 下次接手點
- Founder merge 後**務必硬重載**（`?v=alert6`；快取是累犯陷阱 PLAYBOOK §6）→ 開頁應立刻補浮昨天最新那則（7572.75 Key Low）。
- §10 六候選待拍板不變；Phase 3 native push 仍是「不看也收到」終解。

---

# 2026-07-14 Session Update #26 (開頁回看窗 catch-up — 修「快訊觸發但 TENKI 什麼都沒發生」)

> Founder 回報：價格跌進計畫價位、TradingView 推播也來了，但開 /decision-alert/ 面板零反應。

## 根因與修法
- **根因**（`apps/preview/decision-alert.js`）：`startPolling` 把 `sinceMs = Date.now()`，只收「開頁之後」的快訊。真實流程 = 推播叫醒 → 才開 TENKI，那則「開頁前幾分鐘剛觸發」的快訊 `receivedAt < now` 被濾掉。**快訊其實已存進頻道**（webhook 正常），只是頁面沒回放。
- **修法**：`CONNECT_LOOKBACK_MS = 60min`；開頁 `sinceMs = now - 回看窗` + `catchUp` 旗標；首輪只把窗內**最新一則**走完整決策管線浮出面板，較舊者標記已讀 + 靜默記錄（`log('…（開頁前）')`）—— 避免開頁被舊快訊轟炸，又不漏掉剛觸發那則。`?v=alert5`。
- Playwright +2 斷言（catch-up 開頁浮出過去 2 分鐘觸發的快訊），共 20 全過。

## 殘留界線（誠實）
仍須在 60 分鐘窗內開頁；徹底「不看也收到」是 Phase 3 TENKI 原生推播。TradingView 推播（founder 已保留）＝叫醒鈴，catch-up 補完「開頁即見」。

## 支線（聊天，未入 repo）
- Founder 貼今日交易計畫（付費內容，**不入 repo**）；已以聊天給更新後 alert 階梯設定（7573/7570 pivot、7547 cluster、7533 日低、7482/7467/7454/7408）。
- 反覆確認的 UX：TradingView 推播「訊息」欄 = 鎖屏顯示內容；乾淨模式要把訊息欄清成純人話（結構化欄位走 URL query）。founder 曾誤把佔位文字/JSON 留在訊息欄。

## 下次接手點
- Founder merge 後實機：觸發一則 → 隔幾分鐘才開 /decision-alert/ → 應浮出該則面板。
- §10 六候選待拍板不變；Phase 3 native push 是「什麼都沒發生」的終極解。

---

# 2026-07-13 Session Update #25 (Query-param 模式 — 鎖屏推播零代碼的終極解，保留 TradingView 通知)

> 承 #24。Founder 實機發現 hybrid 只讓推播「第一行」乾淨，整則展開仍有 JSON。要「保留 TradingView 鎖屏通知＋零代碼」。

## 根因與解法
- **根因**：TradingView 一則 alert 只有一個 message 欄，同餵 webhook body + 鎖屏推播；message 含 JSON → 推播顯示 JSON。無法讓 JSON 從推播消失（除非換通知來源）。
- **唯一單-alert 解**：結構化欄位（symbol/condition/strategy，靜態、一標的一 alert）搬到 **webhook URL 查詢參數**（推播看不到 URL）；message 只留純人話 → 鎖屏推播零代碼、又保留通知。
- **Founder 決策**：price（動態、只能在 message）不單獨拆欄，整句 message 存成 note 顯示即可。

## What was done（3 commits）
- `api/_lib/http.ts` `assembleAlertPayload`：body（JSON/hybrid → 物件；純文字 → note）為 base + query overlay（symbol/condition/timeframe/strategy/note/price）。`api/alert.ts` 改用之。**domain 完全不動**（組裝後仍是 AlertPayloadContract → 同一套 validate/build）。
- smoke +5 斷言（純人話 body+query→200、query 覆蓋 body、向後相容），共 24 全過。
- SETUP §3「⭐乾淨模式（推薦）」：URL 帶參數 + 純人話 message；JSON/hybrid 降為進階/相容。SPEC §3 記組裝順序。

## 代碼感三層（最終定論）
1. TENKI 面板永遠人話（第一天起）。
2. TradingView 推播：**乾淨模式 = 零代碼**（本次，query-param）；hybrid（#24）為相容純文字 body 的鋪墊仍保留。
3. Phase 3 TENKI 原生推播 = 終局。

## 下次接手點
- Founder merge 後實機：改一條 alert 成乾淨模式（URL 帶 `&symbol=ES1!&condition=Level Break&strategy=Mancini` + 純人話 message）→ 觸發 → 鎖屏推播應純句子零代碼。
- 仍等 7553 Entry Panel 實戰截圖；§10 六候選待拍板不變。

---

# 2026-07-13 Session Update #24 (Hybrid message parser — 消除 TradingView 原生推播的代碼感)

> 承 #23。Founder 上線後提出 UX 顧慮：使用者看到 alert 推播裡的 JSON 純代碼可能以為「壞掉了」。

## 代碼感的三層（產品 UX 決策，已定案）
1. **TENKI 面板永遠人話**：Entry Panel / 事件鏈 log 從第一天就把 JSON 拆成欄位 + 人話句子（condition→標題、note→句子）。使用者在 TENKI 內**永遠看不到代碼**。
2. **TradingView 原生推播 = hybrid 緩解（本次）**：TradingView 自家推播原樣顯示 message，無法改它的渲染。`readJsonBody`（`api/_lib/http.ts`）改為取「第一個 `{` 到最後一個 `}`」，容許 message 前後帶純文字 → 推薦寫法「人話換行 + JSON」，推播第一行純句子零大括號。向後相容（純 JSON 不受影響），founder 現有 9 條不必重貼。
3. **終局 = Phase 3 TENKI 原生推播**：mobile app 自發推播，鎖屏看到 TENKI 漂亮通知，代碼感徹底歸零。

## What was done（3 commits）
- `api/_lib/http.ts` hybrid parser + smoke 4 條新斷言（純 JSON 向後相容/人話前綴/尾隨文字/無 JSON→400，共 19 斷言全過）。
- SETUP §3 加「人話前綴+換行+JSON」推薦寫法（限制：前綴勿含 `{`、JSON 在最後）；SPEC §3 端點說明補 hybrid 註記。

## 注意
- 解析寬容度只在接收端；contract/schema/policy 不動（schema 仍收乾淨 JSON 物件）。
- note-first 欄位順序（founder 已套用）讓純 JSON 寫法的推播也先顯示 note；hybrid 是更進一步的零大括號版。

## 下次接手點
- Founder merge 後可選：把一條 alert 改「人話換行+JSON」實機驗推播第一行純句子。
- 仍等 7553 觸發的 Entry Panel 實戰截圖；§10 六條接線候選待拍板不變。

---

# 2026-07-13 Session Update #23 (🏁 TradingView 整合端到端正式上線 — 第一則真實快訊全鏈路貫通)

> 承 #18–#22。CME 週一開盤一小時內，founder 的真實 Premium 快訊走完全鏈路，整合專案（#178/#179/#180/#181 四 PR + Upstash 開通）正式上線。

## 上線實證（2026-07-13 台灣 06:29 起）
- **觸發**：ES1! 下穿 7596 → TradingView webhook POST → `/api/alert` schema 驗證 → `buildAlertContract` → Upstash 專屬頻道。
- **founder 瀏覽器 GET `/api/alerts?ch=...&since=0` 實證**：頻道內完整 AlertContract（`price:7595.75`、`condition:"Watch Only"`、`strategyHint:"Mancini"`、`note` 為 founder 前晚寫的計畫原句、`receivedAt`、UUID）。
- **「note = 冷靜時的你對緊張時的你說話」**設計首次實戰：第一響就是 Watch Only（計畫說不參與的位置）— 系統開場即紀律提醒。
- Upstash 開通過程：founder 三下點擊（Marketplace 計費同意無法代辦，平台設計）；redeploy 用 empty commit `6c4a53ed` 觸發。**Vercel MCP 工具組無 storage/env 管理能力**，且 web_fetch/docs-search 工具需即時授權（本 session 未接通）— 驗證改走 founder 手機 + 瀏覽器 GET，反而更直接。

## 兩個實戰觀察（已入 SETUP §3/§5）
1. **通知設定自動沿用**（founder 糾正我的錯誤說法）：新 alert 沿用上一條的 webhook 設定；但「重設連結」後舊 alert 全部指向失效頻道要逐條換。
2. **重複觸發轟炸實證**：同 alert 重複模式幾分鐘灌 9+ 筆同價位 → 冷卻設計實戰正確；建議 level alert 用「僅觸發一次」。

## Founder 目前的 alert 階梯（9 條，全 ES1，來自其付費訂閱的 Mancini 週一計畫 — ⚠️ 付費內容不入 repo，此處僅記結構）
7596（Watch Only 預警）→ **7553 ⭐ Key Low（核心決策位）** → 7547（Flush Zone）→ 7533 → 7521 → 7482 → 7467 → 7454 → 7408。每條 note 帶計畫原句，condition 帶語意標籤（Watch Only / Key Low / Flush Zone / SR Flip / Major Support）。

## 下次接手點
- 等 **7553 觸發時的 Entry Panel 實戰截圖**（頁面開著才會浮出 — 不回放歷史）。
- §10 接線候選**新增第 6 條**（2026-07-13 提出，待 founder 拍板）：active session 中同標的後續觸發（如 7553 後 2 分鐘 7547 到達）在浮動計時條顯示安靜一行事實更新，不彈新面板 — 源自 7553/7547 僅距 6 點的實戰情境。
- 其餘候選不變：Mode 標籤、quiet window、節奏熔斷、每日上限收斂。

---

# 2026-07-12 Session Update #22 (手機端真實快訊樣貌 — 三個截圖事實入檔)

> 承 #21。Founder 三張實機截圖補充，全部是文件級勘誤/依據，無程式碼改動。

## 三個事實（截圖實證）
1. **TradingView 手機 app 有 Webhook URL**（alert 編輯 →「通知」分頁）— SETUP.md 原寫「web/桌面版才有」是錯的，已勘誤。**全流程純手機可完成**。
2. **既有 alert 的預設 message 是純文字**（「ES1! 下穿 6,851.00」）→ 非 JSON，TENKI schema 會 400 擋掉 — SETUP §3 已加醒目遷移提醒（訊息欄要整段換 JSON 模板）。
3. **原生推播轟炸實例**：同一 level 8 分鐘連發 4 則相同推播 — delivery policy（冷卻/靜默/聚合）的現實依據，已入方法論 §9 映射表。

## 語意澄清（入方法論 §7）
Founder 的 ES1! level alert =「價格進入計畫區域」的鈴聲（step 2），**不是 setup 成形**（step 3 才確認 FBD）— 這是「Alert ≠ 進場訊號」定位的方法論根據。Level 類 alert 建議 `condition: Level Break` / `strategy: Mancini`（SETUP §3 新段）。

## 下次接手點
- Founder 端不變：Vercel 開通 Upstash → 手機全程配對（現在確認連 TradingView 端也不用開電腦）→ 把既有 ES1! alert 的訊息欄換成 JSON 模板 + 勾 Webhook URL。
- §10 接線候選（Mode 標籤/quiet window/節奏熔斷）仍待 founder 拍板。

---

# 2026-07-12 Session Update #21 (Trader 模板命名勘誤：FBD = Mancini Failed Breakdown)

> 承 #20。PR #179 已 merge；founder 實機走模板選擇抓到兩個顯示名錯誤，並補上關鍵 domain 背景。

## Founder 提供的 domain 事實（重要，之後 AI 必知）
- **FBD = Adam Mancini 的 Failed Breakdown**（假跌破：跌破支撐→收復→acceptance 確認）— engine 舊名「Follow-By-Discipline」是 v2 期發明的錯誤 backronym。
- **MODE_2 =「Canslim High RS Breakout」**（舊 LOCKED spec 的 4min 模板，時長 240s 完全對應）—「高靈敏控制」是誤譯。Mancini 語境的 Mode 2 另指區間震盪市況（不猜突破、區間內操作），與此模板無關。
- **TENKI 訂閱制的起源**：founder 每次做 FBD 交易時情緒非常緊張/急躁 → 決策紀律系統的原點。
- 方法論全文（substack: tradecompanion「My Trade Methodology - Fundamentals」）擋爬蟲讀不到，**founder 決策：等他貼全文再寫 `docs/TRADING-METHODOLOGY.md`**（給後續 AI 的 domain 背景文件）。

## What was done（4 commits）
templates.ts 三模板 name/nameZh + JSDoc 勘誤（ID/時長/segments 不動 — ID 是持久化契約）；preview 鏡像同步（`?v=alert4`）；SETUP §3 對照表 + SPEC §7 定案（open question 關閉）；Playwright 18 斷言全過（含新名驗證）。

## 教訓
- **專有名詞縮寫不確定就問 founder，不要發明 backronym** — FBD 錯名從 v2 活到實機才被抓。
- 模板顯示名散在三處要一起改：engine templates.ts、preview demo 鏡像、SETUP/SPEC 文件表格。

## 下次接手點
- ~~founder 貼全文 → 寫 TRADING-METHODOLOGY.md~~ **已完成（同 session）**：founder 貼了完整方法論（含 Mode 1/2 市況分類器 + AI 可執行版）→ `docs/TRADING-METHODOLOGY.md` 落地（核心哲學/結構模型/三執行模組/level-to-level/Mode 判斷規則/TENKI 映射表/未來接線候選 §10 待 founder 拍板）。**這是 trader 功能的 domain 底座，接手 AI 必讀。**
- Founder 端待辦不變：Vercel 開通 Upstash → 實走 /decision-alert/ 配對。

---

# 2026-07-12 Session Update #20 (TradingView 快訊 v1.2：channel 模型 — 零輸入配對取代共用 token)

> 承 #19。PR #178（v1+v1.1）已 squash merge。Founder 三個回饋：①誤以為 token 是 Claude 計費 token（已澄清：只是自訂密碼）②功能應限付費客戶 ③想去掉輸入 token。兩決策拍板：channel 模型全面取代 token；付費門檻先 client 側標示、伺服器端驗證等金流基建。

## What was done（6 commits，分支從 origin/main 重起同名）
- **channel 模型**：`api/channel.ts`（POST 配對 → 伺服器生成 64-hex channelId，SETNX + 30 天滑動 TTL）；`api/alert.ts`/`api/alerts.ts` 改 `?ch=` 驗證（未註冊 404，防隨機灌爆）；per-channel 佇列 `tenki:alerts:v1:<id>`；`ALERT_INGEST_TOKEN` 全數移除 — **founder 一次性動作只剩 Upstash 開通**。
- **零輸入配對 UX**：`/decision-alert/` token 輸入整組拿掉 → 「產生我的專屬連結」→ 顯示 webhook URL + 複製/重設 → 自動輪詢（載入即接收）；404 顯示連結失效引導重設。Premium badge 掛在區塊標題。`?v=alert3`。
- smoke harness 15 斷言（含頻道隔離）、Playwright 16 斷言全過；SETUP/SPEC/DEPLOYMENT_MAP 同步。

## 教訓/注意
- capability URL 模型：連結即憑證（與 TradingView webhook secret 慣例同級）；「重設連結」=換新頻道，舊的 30 天自然過期。
- **Premium entitlement 掛載點在 `/api/channel`**（SPEC §11）：金流上線後在發頻道時驗訂閱資格即完成付費牆；「Pro」對外名對應現有 Premium 層（2-tier 硬規則，不開第三級）。

## 下次接手點
- 新 PR 待 founder merge；merge 後：Upstash 開通（唯一前置）→ 手機開 /decision-alert/ → 產生連結 → 貼 TradingView → 觸發驗收。
- 帳號＋金流基建（伺服器端付費牆）是獨立大工程，需另開規劃輪。

---

# 2026-07-11 Session Update #19 (TradingView 快訊 v1.1：真實 Premium webhook 接線 — repo 第一個後端)

> 承 #18 同一 session。Founder 出示 TradingView Premium 帳號要求真整合；三決策拍板（Upstash Redis 儲存 / 升級既有 demo 頁 / 同分支開 PR）後落地。

## What was done（6 commits）
- **repo 第一個後端**：根目錄 `api/`（Vercel 零設定 serverless functions；filesystem 優先於 rewrites，vercel.json 不用改）。`api/alert.ts` POST webhook（`?token=` 驗證因 TradingView 不能帶 header；重用 domain schema/contract；Upstash LPUSH 50 筆/24h TTL）＋ `api/alerts.ts` GET 輪詢（since 過濾，**遞送判定留在裝置端**）。零新依賴 — fetch 直打 Upstash REST，env 兼容 `UPSTASH_*`/`KV_*` 兩種命名。
- `api/tsconfig.json` + verify.sh 加 `tsc api` step（現在是 5 個 tsc）。
- `scripts/smoke-alert-api.mjs`：stub fetch 記憶體 Upstash + 假 req/res，11 斷言（401/405/400/text-plain body/輪詢/since/去重語意）。
- `/decision-alert/` 加「連接真實快訊」collapsible（token 存 `tenki.alert.token`、10s 輪詢、id 去重、401 停止顯示未授權）；真訊號與模擬走**同一條 ingest 管線**。`?v=alert2`。Playwright 13 斷言全過。
- `docs/TRADINGVIEW-SETUP.md`（founder 操作手冊：Upstash 開通、`ALERT_INGEST_TOKEN`、alert JSON 模板含 `{{ticker}}` 變數、strategy 標籤對應模板、Premium 額度建議、curl 乾測）；SPEC §3/§12 更新 v1.1 已交付。

## 教訓/注意
- TradingView webhook：不能自訂 header（token 只能走 query）、body 是 text/plain（handler 要 string→JSON.parse）、preview 部署 protection 會擋（端到端只能 production 或 bypass 查詢參數）。
- `api/tsconfig.json` include 不能掃 `../domain/src/**`（會拉進 jest 測試檔報型別錯）— 只 include `**/*.ts`，讓 tsc 順 import 跟進 domain 原始檔即可。
- since 過濾用 strictly-greater，同毫秒兩筆會漏 — 客戶端一律再用 id 去重（smoke 曾假紅）。

## 下次接手點（founder 兩個一次性動作後才通）
1. Vercel → Storage → 開通 Upstash Redis；2. env 加 `ALERT_INGEST_TOKEN` → redeploy。
- 然後照 `docs/TRADINGVIEW-SETUP.md` 建第一條真 alert → 手機 `/decision-alert/` 連線驗收。
- Phase 2 後段（mobile UI）與 Phase 3（推播）方向見 SPEC §12。

---

# 2026-07-11 Session Update #18 (TradingView 快訊整合 v1：規格書 + 邏輯層 + /decision-alert/ demo)

> Founder 提出 TradingView Premium Webhook 整合 spec（原文含 TEI/勝率等 v2 語彙）。經 AskUserQuestion 四題全採建議案後落地 v1。

## Founder 四決策（2026-07-11 拍板）
1. **v1 範圍**＝規格書＋domain/engine 邏輯層＋preview demo；mobile UI 留 phase 2。
2. **零後端維持**：payload contract/schema 純函式先行；`tenki.app/api/alert` 是 phase 2（repo 純靜態部署）。
3. **勝率呈現否決** → 流程統計語言（「此狀態下的紀律完成率」）；同時 `PROHIBITED_VOCABULARY_ZH` 堵住 compliance 只掃英文的漏洞（「勝率」原本會漏網）。
4. **`docs/TRADINGVIEW-ALERT-SPEC.md` 成為 canonical**；舊 LOCKED `TRADER-MODE-SPEC.md` 加「部分被取代」橫幅（founder 核可僅限橫幅）＋ PLAYBOOK §0 同步。

## What was done（11 commits，verify.sh 綠）
- **domain**：`alert-contract.ts`（DOMAIN_ALERT_* enums + `buildAlertContract`）、`alert-schema.ts`（手寫驗證）、`alert-policy.ts`（`evaluateAlertDelivery`：flag→tier→session中→strain→冷卻300s→日上限；`recordAlertSurfaced` 跨日重置；`groupSimultaneousAlerts` 60s 聚合窗）。
- **engine**：`session/template-suggestion.ts`（strategyHint 關鍵字→TraderTemplateId，建議不強制）；`SessionRecord.originAlertId?`（alert 先於 session 存在，故不動 `SessionEventType`，事件鏈=alert 紀錄 join session 紀錄）；compliance 中文禁用詞＋canonical panel 文案鎖測試。
- **shared**：`tradingview_alerts_v1` flag（default off/remote 可控）＋ `TierFeatures.externalAlertBridge`（Premium）。既有 flags 測試的「6 個 flag」計數斷言更新為 7。
- **preview**：`/decision-alert/` demo 頁（模擬快訊→Entry Panel→模板⭐→浮動計時條 segments/readiness→事件鏈 log；strain 靜默膠囊；冷卻 demo 縮時 30s）。Playwright 21 斷言全過＋六態截圖已交 founder。vercel.json + 兩份 DEPLOYMENT_MAP 同步。

## 教訓/注意
- compliance `findProhibitedTerms` 原為英文 lowercase substring only — 中文金融語永遠漏網；已加 ZH 清單（多字詞防誤殺：單字「買」會誤傷「購買 Premium」）。
- 新增 feature flag 要動兩處（engine `common/types.ts` union + shared `flags.ts`），且 flags 測試有 flag 總數斷言會紅。

## 下次接手點
- Founder 手機實走 `/decision-alert/`（merge 後固定網址；merge 前用 PR Vercel bot preview 連結）。
- Phase 2：HTTP 接收薄層（收→validate→轉發）＋ mobile UI（`DopamineJournalSheet` 是 entry panel 的元件範本、`DecisionBar` 是浮動條範本；mobile 不 import engine，要照 §7 mirror）。
- Open question 留 founder：模板顯示名（舊 spec「Canslim GS 5min」等）與 engine `TRADER_TEMPLATES` 現值的收斂，v1 未擅改。

---

# 2026-07-11 Session Update #17 (Hero 接進 /preview/ 開場 + 兩個實機小修，全數 merge)

> 承 #16 同一 session。Founder 手機實走回饋三連修，全部走 PR → CI 綠 → squash merge 慣例。

## What was done
1. **#175 rPPG 預設**：v6 Today 右上來源 pill 的 `active` 寫死在 Garmin 靜態 HTML → 移到 rPPG（face-only 產品，rPPG 是唯一主來源）。
2. **#176 iOS 放大鏡**：soul-enroll 長按（onboarding 第 4 步 Calibrating）觸發 iOS 文字選取＋放大鏡 → `html,body` 補 `-webkit-user-select:none` + `-webkit-touch-callout:none` + tap-highlight 透明（儀式頁無可複製文字/輸入框，頁面級關閉安全）。
3. **Hero 接進 /preview/**（founder 選「開場第一屏」）：`#hero-gate` overlay（z:20 > onboarding 的 10）原封搬入鎖定 Hero（headline verbatim/#universe 星塵球/kicker/sub/CTA，樣式 scope `#hero-gate`、色票釘 tokens.css hex）。Start Soul Scan → **先 `TENKI_STARDUST.destroy()` 釋放 WebGL context（iOS OOM 防護）** → 淡出進既有 onboarding；See how it works → `/story/`。scroll-cue 不搬（無捲動，搬了是謊報）。

## 關鍵技術點（下次接手要知道）
- **stardust.js 可跨頁共用 THREE**：它要求 r128+，soul-enroll 的 importmap module three@0.160 在 DOMContentLoaded 前設好 `window.THREE`，auto-init 吃得到；CDN 擋 → warn+skip 靜態降級。不需要第二份 three。
- **本地測試 server 的 /preview/ rewrite 陷阱**：vercel 是「精確 `/preview/` → soul-enroll.html」＋「`/preview/(.*)` → 檔案」兩條；簡化成一條會把 `/preview/` 對到目錄 index.html（手指旗艦頁）測錯頁。
- 眨眼 Phase 1 端到端驗證手法已建：假鏡頭均勻亮幀 Y4M ＋合成 MediaPipe stub（478 點、週期眨眼）可讓真 FSM 全程走完（腳本在 session scratchpad，`e2e-blink.mjs` 模式可重建）。

## 下次接手點
- Founder 真機驗收清單：/preview/ 開場見 Hero（星塵球需 CDN）→ Start 進 onboarding → 完整註冊見「Blink cadence ✓」→ v6 掃描見眨眼副行；長按不再有放大鏡。
- Hero 動效精修仍屬 Antigravity story-motion lane（#173 beat-spec），本次只做輕量 word-rise。
- Phase 2（engine blink.ts + StrainSubtype 第二證據）待 founder 驗收 Phase 1 後開。

---

# 2026-07-11 Session Update #16 (眨眼節奏 Blink Cadence Phase 1：眼動從品質閘門升級為第一個 baseline 信號)

> Founder 拍板方向後落地。完整方向文件（現況盤點 + 對外部研究的糾正 + 三階段藍圖）在本 session 的 claude.ai artifact；本條記 as-built。

## 方向（founder 已拍板的兩個決策）
- **Phase 1 排進 preview lane：是**（本條即交付）。核心哲學：不加新雷達，讓 Baseline 學會眨眼節奏 — 註冊量個人基線、日常只講相對偏差、質化不給數字。
- **眨眼偏差進不進 Edge Score 權重：先不進**，停留在 insight 層等真資料；8 維是規格，動它需 founder 再拍板。瞳孔/saccade 明確不做（光線混淆/醫療感/與靜態掃描不相容）。
- 外部研究報告兩個框架已糾正勿再引用：TEI 融合公式（v2 廢棄詞）、交易員 tunnel-vision 敘事（違反 face-only 定位錨 #11）。

## What was done（3 commits，全部 preview 層）
1. **`apps/preview/blink-cadence.js`（新，兩頁共用）**：`window.TENKI_BLINK` = 遲滯眨眼計數器 + `cadencePerMin`（<8s 量測窗回 null）+ `band()`（寬中性帶 0.55×–1.7×，小樣本 Poisson 誠實）+ `tenki.baseline.blink` 衍生純量儲存 + `?blink=clear` QA 重置。**v6 用 `/preview/` 絕對路徑載入 — 該頁同時掛 /v3/ 與 /preview/v6/，相對路徑在 /v3/ 下會 404（部署陷阱）。**
2. **soul-enroll 註冊端**：capture 四階段、`state.mpActive` 真 landmarks 才餵（blendshape eyeOpen，閾值 0.35/0.6，dt cap 200ms）；processing 完成才 save；`#bx-blink`「Blink cadence」列走 earned 哲學（Tier B / CDN 擋 → 保持 hidden，不假裝）。FSM 轉移零改動。
3. **v6 日常端**：FaceMesh 有臉幀餵計數器（EAR 閾值 0.25/0.55，臉丟失斷窗）；`from=baseline` 揭曉時「有註冊基線 + 本次窗 ≥8s」才在 coach card 顯示質化副行（`#blinkInsight`：一致/收斂/活躍），缺任一條件隱藏。測試 hooks：`STARDUST_SCAN_TAKEOVER._seedBlinkSample/_applyBlinkInsight`（無 production caller）。

## 驗證
- Playwright 全綠：helper 20 項單元斷言（遲滯/band 邊界/roundtrip/QA 開關）、soul-enroll 假鏡頭降級走行零 pageerror、v6 三態文案 + 三個誠實閘門 + coach card 截圖。`check-vocab` 綠。
- **真機（founder 手機）待走**：`/preview/` 完整註冊（MediaPipe 可達）→ 完成清單見「Blink cadence ✓」→ v6 掃描 → coach card 見眨眼副行。改了 JS 都已 bump `?v=blink1`，記得硬重載。

## 下次接手點
- Phase 2（engine 收編）方向已定於 artifact 藍圖：`packages/engine/src/biometric/blink.ts`（同款遲滯 + Welford 重用）→ 餵 `StrainSubtype` overstimulated 第二證據；等 founder 真機驗收 Phase 1 後再開。
- band 閾值（0.55/1.7）是小樣本下的保守初值，原生階段（Phase 3）用長窗真資料再調。

---

# 2026-07-09 Session Update #15 (實機打磨四連修：#166–#169 — 手指流程真機可用)

> 承 #14。Founder 實機逐輪回饋（截圖/錄影），四輪修完「提升精度」手指流程在真機的完整可用性。全部已 merge。

## 四輪修正（每輪都是 founder 實機抓的）
1. **#166**（救回 #165 撞掉的兩刀）：`from=precision` 強制 `sensorChoice='finger'`（預設是 face，曾誤入臉掃）＋ intro 紅光鏡頭 hero；已校準 pill 拿掉 disabled（可重新校準）。
2. **#167 掃描橫幅**：`#scan-banner` 是**寫死在 HTML 的臉部文案**（JS 只更新底部 pill）→ precision 時一次改寫成手指版；**發現快取炸彈**：`?v=` 固定字串＝裝置永遠舊 JS → bump。
3. **#168 誤發已校準**：mock `bfFinish()` 骨架殘留還在寫旗標 → 拔掉；**唯一發放點＝旗艦儀式完成**；新增 `/v3/?precision=clear` QA 重置開關。
4. **#169 滑動黑屏**：旗艦頁早於 PLAYBOOK §6 100vh 規則 → `body`/`.app-container` 補 `100dvh`＋`overscroll-behavior:none`＋`html` 上主題色＋`.step` 內部捲動；`styles.css` 也補 `?v=` bump。

## 教訓（全部已入 PLAYBOOK）
§6：文案兩層陷阱（靜態 HTML＋JS writer 要兩層掃）／固定 `?v=`＝舊 JS 永駐裝置／100vh 陷阱再現。§4：merge 前核實 PR head sha；stop-hook 對 merge commit 的 Unverified 是誤報。

## 下次接手點
- 手指流程真機可用（founder 驗收中）。狀態機：`tenki.precision.*` 只由旗艦完成寫入；`?precision=clear` 可重置。
- Antigravity lane 未動：`docs/prompts/antigravity-finger-precision-kickoff.md`（2050 儀式視覺 + #148 真 PPG + iOS 調參）。
- 品味/真機終裁一律 founder；改 preview 前讀 PLAYBOOK §6。

---

# 2026-07-08 Session Update #14 (提升精度接旗艦手指儀式 + merge 撞車救回)

> 承 #13。Founder 逐輪實機打磨（4 輪截圖回饋），「提升精度」現在開**旗艦手指儀式**；途中遭遇多 session merge 撞車，兩 commit 遺失已 cherry-pick 救回（教訓已入 PLAYBOOK §4）。

## 定案與落地
- **旗艦＝`apps/preview/index.html`+`baseline-onboarding.js`**（真相機、紅色血流手指視圈、金色 climax、iOS-OOM 打磨過；founder 目標圖 IMG_8188 即其實機畫面）。v6 pill → `/preview/index.html?from=precision`；完成寫 `tenki.precision.*` → 星塵回場 v6 翻 `信心·高 ✓`＋「手指 ✓」chip。
- **`from=precision` 三件事**：①強制 `state.sensorChoice='finger'`（預設是 face！founder 實機抓到誤入臉掃）②intro 換「用手指，讀得更準／開始校準」框＋mint 隱私 pill＋CSS 後鏡頭紅光 hero（對齊 Build Your Baseline 構圖）③已校準 pill **保持可點**（曾設 disabled → founder「不能點」→ 改隨時可重校準）。
- 對應 commits：`17a09bb`（#165 merge 進 main）＋ 救回的兩刀（cherry-pick 自 `3038e59`/`7599493`）。

## 事故：merge 撞車（PLAYBOOK §4 已加規則）
#165 merge 時 PR head 停在三刀中的**第一刀**（repo 另有「圖書館session」並行動同一 branch），後兩 fix 靜默遺失。本地 reflog cherry-pick 救回、全流程 Playwright 重驗綠。**規則：merge 前核實 PR head == 剛推的 tip；merge 後 log origin/main 確認自己的 commit 在裡面；一條 branch 不要給兩個 session 用。**

## 下次接手點
- 本 branch 帶救回兩刀等 founder merge（新 PR）。手機驗收：`/v3/` 點 pill → 紅光 hero →「把指腹移到後鏡頭正中央」→ 真紅色手指視圈 → 金色儀式 → 星塵回 Today。
- Antigravity lane 不變（開工單 `docs/prompts/antigravity-finger-precision-kickoff.md`：2050 儀式視覺 + #148 真 PPG）。

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

