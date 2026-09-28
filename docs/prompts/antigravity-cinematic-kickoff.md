# Antigravity 開工單 — 電影級視覺：掃描與揭曉（2026-09-28，founder 交辦）

> 使用方式：founder 在桌機 Antigravity 貼上下方 prompt 即可開工。
> 來源：founder 2026-09-28 丟了一支 Threads 上的「電影級視覺」參考，要求評估哪些優點適合 TENKI CORE。
> ⚠️ **雲端 Claude Code 打不開 Threads（網路政策擋住），所以本檔沒有逐格對照原片** ——
> 內容是「電影級 UI 的通用手法 × TENKI 的鎖定規則」交叉出來的。**founder 手上有原片**：
> 開工前請 founder 把連結或截圖直接給你，用它校準「質感的目標」，但**底線照本檔**。

---

## 方法論（沿用 hero-camera v2 的教訓，不給逐拍表）

`docs/prompts/antigravity-story-motion-kickoff.md`（v1）證明過：雲端寫死的逐拍規格
會把天花板壓在「依序淡入」。所以本檔只定義三件事：

1. **電影感的定義**（判準）
2. **不可破的底線**（guardrails）
3. **技術彈藥庫**（提高天花板用的，不是待辦清單）

其餘由你發揮，**每個表面交三個差異夠大的 take**，founder 看錄影挑一個。

---

## 貼進 Antigravity 的 prompt

你是 TENKI CORE 的桌機動效實作 AI。先 `git pull origin main`，然後**依序讀完**（不要跳）：

1. `CLAUDE.md`（**特別是「動畫 / 視覺」整節的星塵授權範圍**）→ `docs/PLAYBOOK.md` §0/§1/§6 → `ANTIGRAVITY.md` 置頂
2. `docs/MOTION-DIRECTION.md` 全文（動效 canonical；四大語彙 §4；驗收 §7）
3. `docs/VISUAL-DIRECTION.md` §1、§3（色彩脊椎 + gold 門檻 + 星塵色調層）、§3.5（誰擁有哪個顏色）
4. `docs/SOUL-SCAN-NORTH-STAR.md` §2、§4（**不露臉**那段必讀）
5. `.claude/skills/gsap-core` + `gsap-timeline` + `gsap-performance` 全文
6. 本開工單全文

任務：把 **掃描 → 結果揭曉** 這段做出電影級質感。
**Rule #0（防丟失，最高優先）：** 開工第一分鐘就
`git checkout -b feat/cinematic && git push -u origin feat/cinematic`；
**每個 take 完成就 commit + push**；quota 快用完 → 先 push 再收工，並在 `ANTIGRAVITY.md`
置頂加一行「停在哪」。

---

## 電影感 = 鏡頭 · 光 · 節奏 · 聲音（不是特效變多）

判準：**把錄影靜音播給沒看過的人，他會覺得自己在看一台儀器「鎖定」了某個東西，
而不是在看一個 app 播動畫。** 答案是「好多特效」就是做錯方向。

產品定調不變：**深空裡的精密儀器**（VISUAL-DIRECTION §1）。電影感要服務這句話：
安靜、有縱深、有重量、最後一拍乾淨地鎖住。

## 範圍與優先序

| 優先 | 表面 | 檔案 | 本次可做 |
|---|---|---|---|
| **P0** | 掃描 takeover（量測中） | `apps/preview/v6/index.html` + `v6/stardust-scan-takeover.{js,css}` + `readiness-scan.js` | 推軌、暗角、顆粒、聲音 |
| **P0** | 結果揭曉（`#edgeScoreReveal`） | 同上 | 靜默拍、轉焦、Lock 光條、字卡排版 |
| P1 | `/story/` | `story.html` / `story.js` | **只加質感層**（顆粒、暗角）；Hero 編排已鎖進 canon（#229/#235），不要重做 |
| P2 | `apps/mobile` | — | **本單不做**。web 端手感定案後，雲端再翻成 Skia RuntimeEffect + Reanimated 3 規格 |

`decision-alert.html` 也載入 `readiness-scan.js`：你動到的共用程式碼要回頭實走那一頁。

---

## 🔴 Guardrails（不可破）

1. **Dark launch：全部效果藏在 `?cine=1` 後面。** 不帶參數時，所有頁面行為與現在**逐位元組一致**。
   這是本單最重要的一條 —— 下面第 2 條有一半的東西還沒被 founder 授權，只能先做成可挑的 take。
2. **星塵授權範圍只有兩個通道**（CLAUDE.md 2026-08-10）：掃描期間的色彩 `setTone()` 與收散 `setReadout()`。
   - 粒子數、Fibonacci 分布、entrance **不在授權內**，不得碰。
   - 🟡 **掃描期間的鏡頭運動不在既有授權內。** 有兩條路，都只能在 `?cine=1` 下做，並在 PR 說明標為「待 founder 拍板」：
     - (a) 呼叫 `stardust.js` 既有的 `setCamera()` / `resetCamera()`（Hero 那時加的，未呼叫時 inert）；
     - (b) 只動 DOM 外層容器的 `transform`。
   - 任何新增到 stardust 的通道都照「**預設值 = 恆等變換**」的結構做（未呼叫＝完全 inert）。
3. **不露臉。** 日常掃描不顯示任何相機影像，一幀都不行；「電影級臉部特寫」是明確的退步（SOUL-SCAN §4）。
4. **gold 只在 `securedEarned(reading)` 成立時出現**（`readiness-scan.js`）。
   光條、bloom、輝光的顏色：成立 → `--gold-secured`；不成立 → `--cyan-active`。
   沒有讀數或低信心時，揭曉整段照跑，但**不上金色**。顏色宣稱的比文字強。
5. **調色只調明暗與反差，不調色相。** 青橘調色（teal & orange）禁用 —— 橘色在這個產品已有主人：
   `zoneStrain` `#C2703D`、`--warning` `#F5A623`、琥珀 `#FFA028`（VISUAL-DIRECTION §3.5）。
   新顏色一律先問「它是不是已經有主人」，並跑 `scripts/preview-scan-stardust.mjs` 看主色 ΔE。
6. **誠實動效**（MOTION-DIRECTION §2）：凡是會跟著掃描變化的鏡頭 / 光線，
   **只能吃量得到的值**（`stillness` 走既有的重映射，工作區間 `LANDMARK_STILL_GATE 0.5 → 0.95`；
   進度走 `heldMs/budgetMs`）。不得宣稱或暗示「偵測到情緒」，文案也不行。
7. **不慶祝。** 揭曉不做爆炸、彩帶、閃白；是**收束成穩定核心**然後鎖住（SOUL-SCAN §2.5）。
8. **不晃。** 手持感、鏡頭震動全部禁止 —— 畫面正在要求使用者保持靜止，自己晃等於跟量測唱反調。
9. **GPU-only**：每幀只寫 `transform` / `opacity`。**不要每幀跑 `filter: blur()` 或 `backdrop-filter`**
   （iPhone 13 Safari 會掉幀）—— 景深用「預先渲染好的模糊層 + opacity 交叉淡入」。
10. **`prefers-reduced-motion`**：reduced 分支 = 靜態終態、**零鏡頭運動**（推軌最容易誘發動暈）。
    顆粒改成靜止不動、光條改成直接出現。
11. **Duration 用 MOTION-DIRECTION §3 音階**（150/300/600/900/1400ms、6s）；ease 用 `calm`/`breath`/`secure`
    （CustomEase 三行**不可刪**）。音階真的不夠用 → PR 裡寫理由提案，不要 inline 裸值。
12. **聲音預設靜音**、必須由使用者手勢啟動、有明確的開關。iOS Safari 沒有 `navigator.vibrate`，
    觸覺在網頁版**做不到，不要假裝有**（留給原生版 `expo-haptics`）。
13. 改 preview 前先讀 `docs/PLAYBOOK.md` §6（iOS 陷阱）；改了任何 `.js`/`.css` 都要**跳 `?v=` 版本號**
    （2026-09-26 教訓：沒跳號 = 修好的東西到不了使用者）。

---

## 技術彈藥庫（挑你判斷最有效的；有更好的想法歡迎超出清單）

**A. 推軌（dolly-in）— 掃描中** · 語彙 Travel
越穩畫面越推近，像望遠鏡收斂到目標。這正是產品自己的心智模型：**雷達鎖定，不是鏡子**。
讀 `stillness` 的重映射值，而且吃 EWMA 式的慢收斂 —— 推軌不能跟著每幀抖。

**B. 轉焦（rack focus）— 揭曉** · 語彙 Reveal
焦點從星塵核心移到分數：球退成景深（預渲染模糊層淡入），數字從軟到銳。
順序對齊「先給結果、再解釋」。

**C. 靜默拍 — 揭曉前**
分數出現前一個短暫的暗場（600ms 量級），把期待壓住再放。電影感很多來自「不動的那一拍」。

**D. 變形鏡頭橫向光條 — Lock 那一拍** · 語彙 Lock
一道細、短、水平的光條，像儀器按下快門。顏色守 Guardrail 4。
保留 founder 認可的「极速运算」flicker，光條疊在 snap 那一刻，不取代它。

**E. 暗角 + 壓黑**
靜態徑向漸層，邊緣壓到 `--bg-space`。零每幀成本，視線自然收到中央。

**F. 底片顆粒**
極低透明度的靜態雜訊貼圖（一張小 PNG / 預生成 canvas，不要每幀產生雜訊）。
若要「活」，以 steps 方式位移 `transform`，不重畫。
真正的好處：**消除深色漸層在 OLED 上的色階斷層**。

**G. 字卡式排版 — 結果頁**
大字、細字重、寬字距的分數 + 一行下緣字幕式說明，對齊 VISUAL-DIRECTION §3.5 的儀器級版面。
⚠️ 等寬字只給數字 / 拉丁字母，中文一律比例字。字體雙頭 source 仍是 🟡 待拍板（VISUAL-DIRECTION §2 #5）—— 不要自己換字體家族。

**H. 聲音設計（可選）**
量測中低頻底噪、Lock 一記低音。預設靜音（Guardrail 12）。沒有把握做好就不要交 —— 爛聲音比沒聲音傷。

## 交付方式：三個 take，founder 挑一個

P0（掃描 + 揭曉）做 **3 個差異夠大的 take**，例如：

- **Take 1「望遠鏡」**：A 推軌為主軸 + E/F 質感 + 簡潔揭曉
- **Take 2「對焦」**：不推軌，靠 B 轉焦 + C 靜默拍做揭曉的重量
- **Take 3「快門」**：D 光條 + H 聲音，把 Lock 那一拍做成全片高潮

每個 take 用不同的 query 值切換（`?cine=1` / `?cine=2` / `?cine=3`），**獨立 commit + push**，
並附一句話說明鏡頭概念。P1 的質感層可以三個 take 共用。

**別自己先收斂成一個「安全解」。** founder 挑定之後才 polish 並寫進 canon（MOTION-DIRECTION §4 / VISUAL-DIRECTION）。

## 驗收清單（每個 take 都要）

- [ ] **全程螢幕錄影**：掃描開始 → 量測中（刻意晃一下再穩住）→ 揭曉。截圖對運鏡無效
- [ ] 兩種結局都錄：**信心中以上（gold）** 與 **低信心（不得出現 gold）**
- [ ] 不帶 `?cine` 時 `/v3/`、`/preview/`、`/story/`、`/decision-alert/` 與現況一致
- [ ] `prefers-reduced-motion: reduce` 模擬：靜態終態、零鏡頭運動
- [ ] 真 iPhone Safari：60fps、~390px 寬無溢出、~660px 短視窗不破版
- [ ] DevTools Performance 無 purple layout 帶、沒有每幀 filter
- [ ] 畫面上沒有任何相機影像
- [ ] `node scripts/preview-scan-stardust.mjs` 與 `node scripts/preview-scan-blink.mjs` 綠燈（動到色彩 / gold 接線時必跑）
- [ ] `npm run verify` 綠燈；分支已 push

完成後 push + 三支錄影（每個 take 兩支：gold / 非 gold）回報 founder，由雲端 Claude Code 開 PR、review 與 merge。

---

## 給雲端 Claude Code（review 時看）

- 逐行確認 `?cine` 缺席時的路徑沒有任何行為改變（Guardrail 1）。
- `classList.add('secured')` / `revealTone(` / 任何新的 gold 出口都要問到 `securedEarned`
  （`preview-scan-blink.mjs` 的接線守衛會掃，新出口若不在它的 pattern 內要補進去）。
- founder 挑定 take 後：鏡頭運動那一項要取得明確授權，寫進 CLAUDE.md「動畫 / 視覺」的星塵例外清單
  （🔴 級規則，需 founder 同意才能改），再把 `?cine` 拿掉轉正。
