# Antigravity 開工單 — 2026-09-19（圖書館桌機 session）

> 一句話：**先讓 founder 親眼看到「現在的」mobile app（P1），然後把相機掃描的 UI 做出來（P2）。**
> 這兩件都在 Expo Go 跑得到 —— 不需要 dev build、不需要 Mac、不需要 Apple 帳號。
>
> 建立者：雲端 Claude Code（對著 `main` 的實況盤點，不是憑記憶）。
> 執行環境：**圖書館公用電腦 + Antigravity**，founder 手邊只有 **iPhone**。

---

## 0. 先讀（house 制度，不可跳過）

`CLAUDE.md` → `docs/PLAYBOOK.md`（§0 文件矛盾裁決、§1 任務路由、§6 preview 陷阱）
→ `MEMORY.md` 最上面 1~2 條 → 本工單。

**Rule #0（防丟失，最高優先）**：開工第一分鐘就確認自己在正確分支上，
**每完成一段就 commit + push**。quota 快用完 → 先 push 再收工，並在
`ANTIGRAVITY.md` 置頂加一行「停在哪」。
（前例：Hero 相機那次沒 push，整份工作永久遺失。）

> **任何一步失敗就停下來回報，不要推測。** 推測出來的計畫比沒有計畫更貴
> （2026-08-19 發生過一次：猜出來的計畫主張用「模擬訊號管線」補上缺少的相機，
> 那正是規格明文禁止的事）。

---

## 1. 現況盤點 — 這三張表決定你今天不該做什麼

### 1a. 已經做完了，**不要重做**

`ANTIGRAVITY.md` 底下那幾份舊 ADDENDUM 仍寫著 "TOP PRIORITY"，那是歷史，不是待辦：

| 舊工單 | 狀態 |
|---|---|
| Soul Lock 柔性鎖定儀式（四拍 Seek→Align→Sync→Hold）| ✅ 已上線（#233 / #236 / #240），眨眼確認已在真機驗證通過 |
| Hero「鏡頭感」進場 | ✅ 已上線（#229 / #235）|
| #1-A 水晶球對標 IMG_8437 | ✅ 已上線（#234）|
| #1-B 超立體盾牌 | ✅ 已上線（#229）|

### 1b. 被**硬體／帳號**擋住，今天做不了（不要浪費整個 session 去試）

| 想做的事 | 為什麼今天不行 |
|---|---|
| VisionCamera frame processor → `PpgFrame`（相機擷取層）| Expo Go **載不了自訂原生模組**，需要 development build。裝進 iPhone 需要 **Apple Developer 付費帳號**（founder 沒有）；EAS 的 Android dev build 走得通，但 **founder 沒有 Android 機**。→ 見 `docs/WEARABLE-INTEGRATION.md` §4d |
| iOS HealthKit 橋接 | 同上，需要 dev build |
| 實機 PPG 準確度抽驗、門檻重校 | 需要先有擷取層 |

**這不是「你不夠努力」，是先決條件不在場。** 硬要做會得到一個編出來的結果。

### 1c. 真正開著、而且今天做得到的

- **founder 從來沒看過現在的 mobile app。** `apps/mobile` 有 154 個 ts/tsx 檔、
  9 月又進了 17 個 commit（BLE 胸帶、Health Connect、PPG 引擎鏈），
  全部是在雲端寫的 —— 容器裡沒有裝置。
- **相機掃描的 UI 還沒有**（品質 reasons、模式選擇、「擷取層還沒接上」的狀態）。
  它底下的引擎**已經做完而且有測試**（`packages/engine/src/biometric/`）。
  這一層是純 JS/TS → **Expo Go 看得到**。

---

## 2. P1（先做，約 1 小時）— 讓 founder 看到「現在的」app

### 2a. ⚠️ 在 `main` 上做，不要用那條舊分支

`docs/prompts/antigravity-expo-go-kickoff.md` 叫你切到
`claude/tenki-core-growth-arch-7teiqj`。**那份工單的前提已經過期**：

- 它最後一個**程式碼** commit 是 **2026-08-19**（之後只有文件）
- 它從 main 分叉在 **2026-08-11**
- 而 `main` 的 `apps/mobile` 在那之後**又走了 17 個 commit**

所以現在切過去，founder 看到的是一個**少掉整個九月**的 app。
**今天在 `main` 上跑。** 那條分支怎麼處理見 §2c。

### 2b. 跑起來

環境步驟（沒有 admin 權限的公用電腦怎麼裝、`--tunnel` 為什麼一開始就要用、
四個會吃掉整個下午的坑）**仍然有效**，照
`docs/prompts/antigravity-expo-go-kickoff.md` §3～§5、§7、§8 走。
只有「切哪條分支」那一段以本工單為準。

```
git checkout main && git pull origin main
npm ci
cd apps/mobile && npm ci
npx expo start --tunnel
```

### 2c. 交付物（這才是 P1 的價值）

1. **每一個畫面的截圖**，照 founder 實際會走的順序排好。
2. **一句話的判斷**：那條 `claude/tenki-core-growth-arch-7teiqj`（多感官掃描儀式、
   Skia orb 物理＋傾斜視差、Zone 自適應宇宙背景、手勢微互動語言）
   —— 跟 `main` 現在的 mobile UX 比，**值不值得 rebase 回來**？
   把你的理由寫進 `ANTIGRAVITY.md` 置頂，由 founder 拍板。
   ⚠️ 不要自己 rebase，那是 5 週的 drift，要先有決定。

---

## 3. P2（主戰場）— Soul Scan 的相機掃描 UI

**規格**：`docs/PHONE-PPG.md`（canonical，動工前必讀）＋ `docs/CAMERA-UI-SPEC.md`
＋ `docs/SOUL-SCAN-NORTH-STAR.md`（方向定調）。

### 3a. 放哪裡

🔴 **不得塞進 `apps/mobile/app/(tabs)/scan.tsx`**（CLAUDE.md 硬規則 —— 那是指尖 PPG
校準層的位置，臉部/相機主流程不進去）。新東西進 `apps/mobile/features/scan/`
或自己的 feature 目錄，`(tabs)/scan.tsx` 只負責導航。

### 3b. 要做的三件

1. **模式選擇** —— `quick_check` / `full_scan` / `precision`。
   來源是 `packages/engine/src/biometric/scan-modes.ts` 的 `SCAN_MODE_CONFIGS`，
   **不要自己再寫一份文案或一份參數**（PLAYBOOK：判定只能有一個來源）。
   `modeReports(mode, metric)` 決定某個模式到底報不報某個指標 —— UI 要照它講話。
2. **品質 reasons** —— 量不到的時候要說出**是哪一項**不合格
   （perfusion／periodicity／artefact 比例），不是一句「請再試一次」。
   來源 `biometric/ppg/quality.ts`。
3. 🔴 **「擷取層還沒接上」的誠實阻擋態** —— 這是這一刀最重要的一格。
   相機擷取層今天做不了（§1b），所以這條路上**必須有一個講清楚的阻擋畫面**：
   說明這一項還沒接上、不要給任何看起來像讀數的東西。

### 3c. 🔴 這一刀的紅線

- **嚴禁用任何形式的模擬訊號填補缺少的相機。** `replay.ts` 是**量具**，
  它產生的任何東西**都不得成為使用者看得到的讀數**（`docs/PHONE-PPG.md` §7）。
  開發時要預覽版面可以，但那條路不得能通到使用者面前的數字。
- **不得宣稱偵測情緒**；不得醫療／金融語言；不得放假的生理讀數。
- 顏色也會宣稱事實：**沒有讀數就不准上 gold**（gold = SECURED）。
- 量不到就說沒量到 —— Edge Score 與 baseline **已經能誠實表達「這一項沒有」**
  （2026-09-10 完成），UI 要用那條路，不要自己補一個預設值。

### 3d. 驗收

- [ ] `npx expo start --tunnel` 下，founder 用 iPhone 走得到這三個畫面
- [ ] 截圖每一個狀態，**包含阻擋態與每一種品質失敗原因**
- [ ] `cd apps/mobile && npm test` 綠；`npx tsc --noEmit` 零錯誤（禁用 `any`）
- [ ] `npm run verify`（root）綠燈
- [ ] 文案掃一遍：沒有情緒偵測、沒有醫療/金融語言、沒有假讀數
- [ ] 每做完一段就 commit + push

---

## 4. P3（只有在 Expo 完全連不上時才做）

圖書館網路可能把手機與電腦隔離，`--tunnel` 也可能被擋。真的連不上就**不要耗**，
改做這組 —— 它們需要的正是雲端沒有的東西：**真的 CDN 資源（GSAP / Three / MediaPipe）
與真的 Inter 字型**。

1. **用真 Inter 複驗版面數字。** 雲端沙箱載不到 Google Fonts，所以我所有的版面量測
   都帶著系統性誤差，`scripts/preview-today-layout.mjs` 是用 **6px 安全邊際**猜補的。
   在真瀏覽器跑一次那支 harness，把真實數字回報 —— 邊際該放大還是縮小，由數字說。
2. **`/story/` 與 `/preview/` 的動效實走**（本機 serve repo root）。
   ⚠️ **Hero 是鎖定資產**（`SYSTEM.md` §8）—— 它自帶一組調色盤
   （`--ink` / `--ink-dim` / `--hairline` 寫在 `story.html` 裡、不在 `tokens.css`），
   那是**刻意的**，不是 drift，**不要「統一」它**。你只回報看到什麼，不動它。
3. `prefers-reduced-motion: reduce` 下把每一頁走一遍：要是**靜態終態**，不是放慢版。

---

## 5. 明確不要做

| 不要 | 理由 |
|---|---|
| VisionCamera 擷取層 / HealthKit | 先決條件不在場（§1b），硬做會得到編出來的結果 |
| rebase `claude/tenki-core-growth-arch-7teiqj` | 5 週 drift，要 founder 先拍板（§2c）|
| 改 Hero / 統一 `story.html` 的調色盤 | 鎖定資產，`SYSTEM.md` §8 |
| 決定 drift 的軸 | 要 founder 先在手機上累積掃描資料才有分布可看（`docs/DECISION-INTELLIGENCE.md` §6）|
| 動 `apps/web/` 或 `core/` | CLAUDE.md 硬規則 |
| 改星塵內部手感（粒子數、Fibonacci 分布、entrance）| 鎖定資產；只能走公開通道 |

---

## 6. 回報

做完（或 quota 用完）在 `ANTIGRAVITY.md` **置頂**寫：
做了什麼 → 停在哪 → 截圖在哪 → 你對 §2c 那個問題的判斷。
然後 push。由雲端 Claude Code 開 PR、驗證、merge。
