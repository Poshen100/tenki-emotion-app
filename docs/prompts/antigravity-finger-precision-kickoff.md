# Antigravity 開工單 — 手指「提升精度」2050 視覺動效 + 真訊號

> Founder 桌機貼給 Antigravity 即開工。先讀：`CLAUDE.md` → `docs/FINGER-PRECISION-WIRING.md`（接線契約）→
> `docs/PLAYBOOK.md` §6（iOS 陷阱）→ `MEMORY.md` 最上 3 條（#14–#16）→ 本檔。動效語言另見 `docs/MOTION-DIRECTION.md`。
> 分支規則：`feat/*` → PR；絕不直推 main；`npm run verify` 綠才算完成；最終裁判 = founder 手機實走。

## 0. 定位（不可違背）
- 臉掃是唯一主流程；手指是**看到結果後、可略過的「提升精度」校準**。全程可退出、零損失。
- User-facing 命名（founder 拍板）：**「手指」＋髮絲線指紋圖示**；「PPG/rPPG」只當技術脈絡；掃描指示句可精準用「食指」；**禁用「補強」**。
- 合規：wellness 語氣（心率/HRV/呼吸節奏＝既有指標），禁醫療診斷、金融語言；raw 影像/波形不上雲、只存衍生值。
- 禁：TEI/PR99/PEAK/OPTIMAL、SVG 畫環（用 Skia/Canvas）、TypeScript `any`、改 `apps/web/`。

## 1. 現況接線（重要 — 別接錯檔）
「提升精度」開的**不是** v6 內建 mock，而是**旗艦手指儀式**（#165–#169 改定）：

| 環節 | 位置 |
|------|------|
| 入口 pill `#edgeConfidence` | `apps/preview/v6/index.html:1967`（未校準「信心·中　·　提升精度 ›」；當日已校準「信心·高　·　✓ 已校準」，**仍可點**重新校準） |
| `window.openPrecisionBaseline()` | `apps/preview/v6/index.html:4051` → 導航 `apps/preview/index.html?from=precision`（走 `/preview/(.*)` catch-all） |
| **儀式本體** | **旗艦 `apps/preview/index.html` + `apps/preview/baseline-onboarding.js`**（真相機、5 步 Ceremony、金色 climax、iOS-OOM 打磨過）——**這是你要升級視覺的檔**，不是 v6 的 `.baseline-flow` |
| `?from=precision` 已做 | `baseline-onboarding.js:1989–2021`：強制 `state.sensorChoice='finger'`（後鏡頭手指路徑）、掛 `body.precision-mode`、改 intro 文案「用手指，讀得更準」、改 `#scan-banner` 成手指版 |
| 回場 | 完成寫 `tenki.precision.{boosted,lastTs}` → 導回 `/preview/v6/?from=baseline` → v6 開機 `applyPrecision()` 翻「信心·高 ✓」＋`#srcFinger`「手指 ✓」chip |

## 2. 你的工作 A — 把旗艦手指儀式打成「2050 生物儀器」
既有 5 步儀式狀態機保留，**視覺全面升級**。旗艦真實錨點（`apps/preview/index.html`）：

| 錨點 | 作用 |
|------|------|
| `#scan-ring-container` / `.scan-ring` / `#scan-progress-ring` | 讀取環 + 進度弧 |
| `#ppg-waveform` | PPG 波形容器 |
| `.scan-ring-center` | 核心（放 BPM 大數字） |
| `#metric-hr`（及同組 metric 格） | HR/HRV/RR 讀數 |
| climax 金色閃光 overlay（`:248`） | 完成高峰唯一一次金爆 |
| `body.precision-mode` | precision 專屬視覺 hook |
| `#precision-privacy` / `#precision-lens` | mint 隱私 pill + 紅光鏡頭 hero（已就位，可強化） |

**2050 DNA**：深空層次（近黑藍 `#04060C` + 微星野 + 紫星雲，禁平塗）、玻璃面板（模糊+髮絲 1px 邊）、
髮絲級 HUD 環＋旋轉刻度、輕字重大數字（tabular-nums）、mono 微標籤寬字距、大量留白、克制。
**色語（一色一義，紀律使用）**：青 `#57E4FF`+紫 `#8B6BFF`=資料光/HUD；紅 `#FF3B54`=脈搏血流（**只在讀取畫面**）；
金 `#F4C669`=完成獎勵（**只在完成畫面爆一次**）；mint `#54E6A6`=信心/掌控/成功。

**邀請（intro，precision-mode）**：mint 隱私 pill「🔒 所有運算只在這支手機上」；標題「用手指，讀得更準」；
副標「手指直接量到脈搏，把心率、心率變異和呼吸節奏讀得更準。」；金句「→ 今日分數的可信度隨之提高」；
CTA「開始校準」／「稍後再說」。鏡頭 hero 帶紅色呼吸微光。

**讀取（主秀，founder 逐輪打磨過的規格）**：
- 背景＝**手指覆蓋後鏡頭的熱感應視覺**（暖紅放射熱場，像被血照亮的組織），疊 HUD 環+旋轉刻度+青色掃描進度弧。
- **真波形**：生理正確 PPG（收縮尖峰＋重搏切跡）即時捲動、亮頭游標；核心隨每拍**脹縮**，拍間隔帶 HRV 抖動（禁節拍器、禁假折線）。
- **讀數置中**：大 BPM 數字在 `.scan-ring-center` 正中央，「BPM」**堆疊在數字下方**（不可 inline 擠偏）；下標紅 mono「LIVE PULSE」。
- 遙測列：HRV／Beats／Signal（髮絲分隔線）；底部提示＋細進度條＋倒數。
- **三態（必做，founder 指定）**：
  - 3A 良好：熱場飽滿均勻、脈動強、青 pill「● 讀取中 · 僅在本機」、提示「保持手指不動，呼吸放鬆」。
  - 3B 歪掉/沒蓋滿：熱場偏移+一側月牙暗缺、整體轉涼；琥珀 pill「⚠ 手指沒蓋滿」；HR 暫緩；提示「往中間移一點，蓋滿整個鏡頭」；進度暫停。
  - 3C 放開：熱場塌冷暗藍、波形拉平、HR 顯「—」；提示「把食指輕輕蓋住鏡頭　開始讀取」；遙測轉灰；恢復即續。

**完成**：金色星塵/ensō 粒子爆發（全流程唯一一次）；金鉻斜體「校準完成」；
「這是你今天的生理指紋。60 秒，你更懂自己一點。」；信心條「今日分數信心 中 → 高」（金→mint 漸層，標「↑ 你剛把它變得更可信」）；
HR/HRV/RR 三格；「🔥 本週第 N 次主動校準」；金 CTA「回到今日」。

**回到今日**：回場後 v6 掛 `html.precision-calibrated` → Edge Score 環升級 mint 發光「確定態」；header 出現「手指 ✓」。

## 3. 你的工作 B — 真訊號（需真機）
併 **PR #148**（branch `feat/preview-finger-real-ppg`，`apps/preview/finger-ppg.js`：綠通道自相關 `estimateBpm`＋品質閘門＋Welford 基線，14 項 headless 測試）→
接進旗艦讀取步：取代寫死 BPM，餵真 HR/SQI 給熱場與波形；**品質閘門直接驅動 3A/3B/3C 三態**。
真 iPhone Safari 調參：ROI、torch 退化、fps、**iOS OOM**（#148 未併主因；PLAYBOOK §6 全集必讀）。
完成時把真衍生值寫進 `tenki.precision.*`（沿用既有回場 `?from=baseline` → `applyPrecision()` 路徑）。

## 4. iOS 陷阱（PLAYBOOK §6，務必遵守）
- 高度用 `100dvh`（非 `100vh`）+ `overscroll-behavior:none` + 高內容在容器內捲（旗艦已於 #169 落地，別退回）。
- 改 JS/CSS 一律 **bump `script`/`link` 的 `?v=` 字串**（固定字串＝裝置永遠拿到舊檔）。
- 指示文案有「靜態 HTML + JS 動態」**兩層**，改模式兩層都要掃（`#scan-banner` 靜態、`#scan-guidance` 動態）。

## 5. 完成定義
- `npm run verify` 綠；PR 附三態截圖/錄影；`apps/preview` 是 CI 盲區，真相機步驟只有真機能走。
- founder 手機實走 `/preview/v6/`：入口 pill → 儀式 → 手指蓋鏡頭（3A/3B/3C 可重現）→ 金色星塵完成 → 回 Today 環升級、header 出現「手指 ✓」。
- 鎖定資產別碰：`SYSTEM.md` §8（/story/ Hero、星塵球）、環比例 `min(72vw,300px)`（founder 拍板）。
