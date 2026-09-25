# Antigravity 開工單 — Soul Lock 柔性鎖定儀式（2026-08-19，founder 拍板）

> 目標：使用者按下 Scan 之後的頭 2 秒，不是被一個冷冰冰的圓框監控，而是**感覺到星塵靈魂正在
> 溫柔地找到他、對準他、與他同步**。四拍：**Seek → Align → Sync → Hold**。
>
> 一句話定調：**TENKI 不是在監控你，它正在等你與自己回到同一個節奏。**

---

## 這件事為什麼「不用重做星塵」（動手前先讀懂這段）

Soul Lock **不是新的感測**，是把**已經量到的東西**編成有節奏的儀式。雲端已核對過現況：

**訊號端 `apps/preview/readiness-scan.js` 已經有：**
- `stillness` —— 由 landmark 位移算出、每幀、真 0..1（閘門 `LANDMARK_STILL_GATE`）
- 眼睛開合正規化（landmark y 距離 → 0..1）→ **眨眼**
- `headPose` —— 頭部朝向的 landmark 索引與門檻
- `computeFaceBox` —— 臉部位置/大小
- Tier A 的**有效樣本門檻**（「只瞄到一兩幀不算量到」）→ 這正是 Hold 拍要的「有效秒數」

**視覺端 `apps/preview/v6/stardust.js` 已經有這些對外通道**（全部是「沒呼叫就完全 inert」的加法設計）：
`setExpression` / `clearExpression` · `setTone` / `clearTone` · `setReadout` / `clearReadout` ·
`setCamera` / `resetCamera` · `dim` / `brighten` / `playEntrance`

**所以：你要寫的是「編排層」，把上面兩排接起來 —— 不准改星塵內部。**

---

## 貼進 Antigravity 的 prompt

你是 TENKI CORE 的桌機實作 AI。先 `git pull origin main`，然後**依序讀完**（不要跳）：

1. `CLAUDE.md` → `docs/PLAYBOOK.md` §0/§1/§6 → `ANTIGRAVITY.md` 置頂 note
2. `docs/MOTION-DIRECTION.md` 全文（動效 canonical；驗收在 §7）＋ `docs/VISUAL-DIRECTION.md`
3. `.claude/skills/gsap-core` + `gsap-timeline`（本頁是 canvas/rAF 為主，GSAP 只用於 DOM 疊層）
4. 本開工單全文，以及 `apps/preview/readiness-scan.js` 的訊號定義段

任務：在 `/preview/` 掃描流程實作 **Soul Lock 四拍儀式**。
**Rule #0（防丟失，最高優先）：** 開工第一分鐘就
`git checkout -b feat/soul-lock && git push -u origin feat/soul-lock`；
**每完成一拍就 commit + push**；quota 快用完 → 先 push 再收工，並在 `ANTIGRAVITY.md` 置頂
加一行「停在哪」。（前例：Hero 相機那次沒 push，整份工作永久遺失。）

---

## 授權紀錄（governance）

Founder 於 2026-08-19 明確授權**重新編排掃描儀式的前 2 秒**（Soul Lock）。
邊界：
- **星塵 v25.8.2 的內部手感仍然鎖定**（`SYSTEM.md` §8）—— 只能透過上面列的公開通道驅動它，
  不得改粒子數、Fibonacci 分布、既有漂移/呼吸/滾動，也不得改 `setTone`/`setReadout` 的既有語意。
- 需要新通道時：**加法**，且預設 inert（照 `setCamera` 的作法），`/v3/` 與 `/story/` 行為必須完全不變。
- 掃描 FSM 的狀態機結構不重寫；相機權限仍必須在使用者手勢內請求。

## 四拍規格

### 1. Seek 星塵尋找你（0–0.5s）
- 外環出現 **3 顆極淡低透明度微光標記**；臉進入可量測範圍後才慢慢靠攏。
- 星塵重心朝臉部中心**極輕微**偏移（`computeFaceBox` 中心 → `setCamera` 的微幅 x/y，或外層 wrapper transform）。
- 文案：`正在找到你`；量不到時給**具體**提示：`再靠近一些` / `讓光線落在臉上`。
- **禁止**：紅色錯誤框、大型臉部輪廓、方形人臉框、「臉部辨識中」、「情緒分析中」。

### 2. Align 雙環對準你（0.5–1.2s）
- 臉部位置 + `headPose` + 光線達最低門檻後，外環出現 **25–35% 圓周的細光弧**。
- 光弧**不是轉圈 loading**：它朝正確對齊位置滑動；偏頭時停在對應方向。
- 對準後光弧吸附到上方核心點。文案：`對準中` / `保持自然呼吸`。
- 手感關鍵是 **soft magnetism**（畫面在等我回到中心），不是目標鎖定器。

### 3. Sync 眨眼成為確認（1.2–2s）
- 不要求誇張動作 —— **正常眨一次眼**，星塵回應一次：中心短暫收縮 → 細光波由中心推向雙環 →
  外環亮起一個小型「已同步」光點。
- 文案：`已同步` / `正在建立初步讀數`。
- **禁止**：打勾、「Face Verified」、任何身分驗證語彙。眨眼是 **human confirmation moment**，不是驗證。

### 4. Hold 鎖定有效訊號（2s → 掃描結束）
- 雙環之間長出一條極細 **Soul Thread**，**只隨有效 frame 累積**（用 Tier A 的有效樣本，不是計時器）。
- 星塵由「豐富流動」轉為「更穩定凝聚」（用 `stillness` 驅動，`setReadout` 既有語意）。
- 訊號失效時光帶**淡出並停住**，不歸零。
- 文案示例：`初步讀取已完成` / `正在提高信心` / `有效訊號 18 秒 · 再穩住片刻，可納入更多證據`。
- 對應產品理念：**15／30／60 秒不是等時間，而是逐步累積可相信的自己。**

## 視覺元件 ↔ 真實資料來源（不得脫鉤）

| 元件 | 資料來源 | 使用者感受 | **禁止宣稱** |
|---|---|---|---|
| 外環光弧 | 臉部置中、`headPose`、量測品質 | 正在對準 | 情緒狀態 |
| 星塵重心微偏移 | `computeFaceBox` / face transform | 星塵看見我 | 臉部監控 |
| 眨眼脈衝 | 眼瞼 landmark 開合 | 已同步 | 身分驗證 |
| Soul Thread | 有效 frames／有效秒數 | 正在建立可信讀數 | 健康改善 |
| 粒子凝聚與色彩層次 | `stillness` + 掃描階段 | 越來越清晰 | 心情好／安全 |
| 結果收束色 | **只在有有效結果之後** | 本次掃描完成 | 掃描中預告結果 |

## 硬規則（違反 = 打回）

1. **不得宣稱偵測情緒**，程式碼與 user-facing 文案都不行（`CLAUDE.md`）。
2. **不得放假的生理讀數** —— 心率／HRV／自律神經沒接感測器就不准用視覺假裝在量。
3. **不得出現監控語彙/視覺**：人臉方框、綠色準星、紅色警告、「目標已鎖定」「Face Locked」。
4. **掃描中不得把星塵染成 Clear／Strain／Neutral 結果色** —— 那等於還沒量完就預告結果。
5. **相機權限只在按下 Scan 之後請求**，並說明用途（Apple HIG）；不得一開始就要一堆權限。
6. **`prefers-reduced-motion`**：整套儀式要有靜態終態版，不是放慢版。
7. 每幀只動 transform/opacity（canvas 層除外）；真機 60fps；~390px 與短視窗都要看。
8. 改 preview 前先讀 `docs/PLAYBOOK.md` §6。

## 範圍（第一刀只做四拍）

**只做 Seek → Align → Sync → Hold。**
**Echo Ring（與昨天的自己對話）明確不在本次範圍**（founder 指示）。若日後要做，硬規則是：
**冷啟動期絕不顯示** —— 沒有歷史就沒有殘影。

聲音／觸覺同樣**不在第一刀**；未來若做，只有三個事件（對準／眨眼同步／初步讀數完成），
不得每秒震動或每個環都有音效。

## 驗收（每拍都要）

- [ ] 真瀏覽器 + 真相機**全程錄影**（founder 靠錄影拍板）
- [ ] `prefers-reduced-motion: reduce`：靜態終態，無誘發動暈的運動
- [ ] 真 iPhone Safari：60fps、~390px 無溢出、短視窗不破版
- [ ] `/v3/` 與 `/story/` 回歸確認（動過 stardust.js 就一定要做）
- [ ] `node scripts/preview-scan-stardust.mjs` 仍 106/106（星塵鎖定資產守門）
- [ ] `npm run verify` 綠燈；分支已 push（**每拍都要**）
- [ ] 文案掃過一遍：沒有情緒偵測、沒有醫療/金融語言、沒有假讀數

完成後 push + 錄影回報 founder，由雲端 Claude Code 開 PR 與 merge。
