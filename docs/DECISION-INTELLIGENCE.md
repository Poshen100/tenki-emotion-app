# DECISION-INTELLIGENCE.md — 個人決策雷達（canonical）

> **這份文件的位置**：`docs/PLAYBOOK.md` §0 優先序的第 5 層（領域方向文件），
> 與 `docs/SOUL-SCAN-NORTH-STAR.md`（掃描）、`docs/brand.md`（品牌語言）同層。
> 與 `CLAUDE.md` / `SYSTEM.md` 矛盾時，**它們贏**。
>
> **這份文件回答什麼**：TENKI 除了「量出一個分數」之外，還宣稱什麼、
> 憑什麼宣稱、以及**什麼時候必須閉嘴**。五大支柱的規格、證據契約、
> 文案紅線、分期，全部在這裡。

---

## 0. 一句話

> **TENKI 不告訴你市場會怎麼走；它告訴你，此刻的你，是否正變成那個最容易偏離自己的版本。**

對外文案版本（founder 2026-09-09 定調）：

> **Before you make the decision you regret, TENKI helps you notice you are no longer yourself.**

⚠️ 這句是**敘事框架**，不是 App 內文案。真正進 UI 的字一律走 §5 的紅線與
`packages/engine/src/compliance/safe-copy.ts`。

### 這不是新產品，是同一個產品的第二層

`SYSTEM.md` §1 已經把 TENKI 定義成 Decision Infrastructure / Human State
Calibration System。本檔不改那個定義，只把它推進一格：

| 第一層（已存在） | 第二層（本檔） |
|---|---|
| 量出此刻的狀態（Edge Score / 帶位） | 把此刻的狀態**放進你自己的歷史**裡比 |
| 「你現在 43 分」 | 「你現在離**你自己**的常態 17 分，而這個距離你過去出現過 24 次」 |

第二層的價值不在模型，在**使用者帶不走的個人決策史**。那也是訂閱護城河：
別人可以抄畫面，抄不走 28 次可比較 session。

---

## 1. 五大支柱

每個支柱都必須歸進 `SYSTEM.md` §5.3 的四個桶，歸不進去就是超出範圍。

| # | 支柱 | 使用者看到什麼 | 桶（SYSTEM.md §5.3） | 引擎位置 | 狀態 |
|---|------|---------------|---------------------|---------|------|
| 1 | **Drift Alert 偏移預警** | 「你沒有更差，但正在偏離你通常最清醒的狀態。+17 away from your baseline」 | Radar + Baseline | `intelligence/drift.ts` | ✅ 已實作（flagship） |
| 2 | **Calibration Proof 校準證明** | 「這次 90 秒 reset 後，你的狀態沒有明顯改變。這也是有效資訊。」 | Calibration | `intelligence/calibration.ts` | ✅ 已實作 |
| 3 | **Decision Twin 決策分身** | 「這一刻像你過去 11 次重要決策前的狀態。」 | Baseline + Turning Point | `intelligence/twin.ts` | ✅ 已實作（需紀錄累積才會出聲） |
| 4 | **Decision Black Box 決策黑盒子** | 掃描 → 猶豫 → 偏移 → 校準 → 判定 的可回看證據鏈 | Turning Point | `intelligence/black-box.ts` | ✅ 已實作（事件鏈組裝） |
| 5 | **Clear Window 清醒窗口** | 「09:18–11:04 是你最穩定的窗口。」 | Baseline | — | ⛔ **未實作**（見 §6 Phase 2） |

⚠️ **第 5 條刻意留白**。它需要跨日、跨時段、數十次可比較 session 才有意義，
現在寫出來只會是一個看起來很合理、其實由三筆資料撐起的謊。
**不要因為表格有洞就去把它填滿。**

---

## 2. 🔴 最容易踩的坑：「baseline 的方向」有兩套相反的語意

這條放在最前面，因為它會**靜默地**壞掉，而且壞掉之後看起來完全正常。

- `docs/brand.md` §4.2 的 Baseline 模型是**偏離中心軸**：
  Above Baseline ＝ 過度刺激（不好）、At Baseline ＝ 調節良好（好）、
  Below Baseline ＝ 耗竭（不好）。**兩端都不好。**
- Edge Score 是**單一線性軸**：分數越高越好。

於是「above baseline」這個詞在兩套語意裡意思**完全相反** ——
Edge Score 高於個人常態是好事，brand.md 的 above baseline 是壞事。

`docs/brand.md` §7 明講這個 mapping **尚未定案，不得自行猜測**。

### 本檔的處置（不改任何命名，只約束宣稱）

1. **Drift 的使用者宣稱只有「距離」，沒有「方向」。**
   「+17 away from your baseline」是距離；「你在 baseline 之上/之下」**不准出現在 UI**。
   這等於採用 `docs/brand.md` §7 的選項 (a)（分數是**距離**的 proxy，不宣稱方向），
   **但只在文案層採用** —— `EdgeZone` / `zone-config.ts` / 任何 persisted 欄位一個字都不動。
2. **方向仍然算、仍然存，但只當事實脈絡。**
   `DriftAssessment.direction` 是 `'higher' | 'at' | 'lower'`，
   刻意**不叫** above/below，就是為了不跟 brand.md 的詞撞車。
   它可以出現在 Evidence X-Ray 的細節裡（「你的讀數高於你的常態」＝一句事實），
   不可以出現在主標，也不可以被翻譯成好/壞。
3. **`higher` 不等於「更好」。** 高於常態同樣是偏移。這正是 founder
   那句「你沒有更差，但正在偏離」的技術對應。

---

## 3. 證據契約（Evidence Contract）

> **沒有證據就不准有宣稱。這條沒有例外。**

每一個 insight —— 每一句 `TENKI NOTICED`、每一個偏移數字、每一次校準判定 ——
都必須帶一份 `EvidenceBasis`（`packages/engine/src/intelligence/evidence.ts`）：

| 欄位 | 意思 | 為什麼一定要有 |
|------|------|---------------|
| `sampleCount` | 這個宣稱吃了幾筆紀錄 | 使用者要能問「憑什麼」 |
| `windowDays` | 這些紀錄橫跨幾天 | 30 筆全在同一天 ≠ 30 筆橫跨 30 天 |
| `provenance` | 資料是哪一類（見下） | 量到的與推論的不能混為一談 |
| `confidence` | `high` / `moderate` / `low` | 沿用 `ConfidenceBand`，不另立一套 |
| `reasons` | 為什麼是這個 confidence | 「證據 X 光」的內容本身 |

### 3.1 Provenance 四級

| 級別 | 意思 | 例子 |
|------|------|------|
| `measured` | 感測器直接量到 | 臉部 landmark 幾何、stillness、HRV（有穿戴時） |
| `reported` | 使用者自己填的 | 反思標籤、決策結果自評 |
| `behavioral` | 從行為推得的事實 | 有沒有走完流程、判定花了多久 |
| `inferred` | 由上面三種推論出來的 | 相似度比對、偏移量、清醒窗口 |

規則：**一個 insight 的 provenance 是它所有輸入的聯集**，
而且 `inferred` 一旦在列，UI 就不得把它講得像量測值。

### 3.2 Confidence 不是自由心證

`resolveInsightConfidence()` 只吃三件事：樣本數、樣本橫跨天數、以及
「這個宣稱的門檻」。它是純函式、可測、拿掉任何一個輸入都會降級。
沒有「看起來蠻有信心的」這種輸入。

### 3.3 `insufficient` 是第一級公民

證據不足時，引擎**回傳一個明確的 `insufficient` 結果**，帶上「還差幾筆」，
不是回傳 `null` 讓 UI 自己編。UI 照著講：

> `Building your baseline — 6 more comparable sessions needed.`

⚠️ **不准用預設值撐場面**。`|| 0`、`?? 'moderate'` 這類寫法在這一層
等同偽造證據 —— PLAYBOOK §6 已經為 `|| fallback` 付過學費（「錯了也不吭聲」）。

---

## 4. 各支柱的判定規則

### 4.1 Drift Alert（flagship）

- **比較對象是使用者自己**，不是任何人群常模。
- 個人參考值 = 同一個 time bucket 的歷史讀數的 mean/std
  （重用 `baseline/baseline.ts` 的 Welford，不另寫一套統計）。
- 偏移量 `deviation` = 現在的讀數 − 參考 mean，**以分為單位**（使用者看得懂的單位）。
- `z` = deviation / std，決定 magnitude：
  `|z| < 1` → `within`（在常態內）、`1 ≤ |z| < 2` → `drifting`、`|z| ≥ 2` → `far`。
- 🔴 **零變異防呆**：std 太小（< `MIN_MEANINGFUL_STD`）時 z 會爆掉 ——
  這時**只用絕對距離判 magnitude，且 confidence 一律降到 `low`**。
  一個從來沒變過的人不是「劇烈偏移」，是「樣本還不夠有代表性」。
- 樣本不足（< `MIN_COMPARABLE_SESSIONS`）→ `insufficient`，**不報數字**。

### 4.2 Calibration Proof

- 三種判定：`improved` / `no_clear_shift` / `declined`。
- 🔴 **門檻由使用者自己的變異推導**（`max(MIN_ABSOLUTE_SHIFT, 0.5 × std)`），
  不是固定 2 分。理由：對一個讀數天天跳 20 分的人，+3 分什麼都不是。
- 🔴 **`no_clear_shift` 不是失敗，是結果。** 文案必須把它講成有效資訊
  （founder 原話：「這不是失敗。這是你現在最真實的訊號。」）。
  這是整個產品最反套路、也最建立信任的一點 —— **任何把它包裝成「再試一次！」
  的改寫都是在拆這個賣點。**
- 校準前後的讀數必須是**同一種量測**（同 tier、同來源），否則回 `insufficient`。

### 4.3 Decision Twin

- 相似度只吃**可比較且可解釋**的特徵：time bucket、帶位、drift magnitude、
  流程模板、是否完成判定。不吃黑箱 embedding —— 使用者要能看懂「為什麼像」。
- 樣本不足 → `insufficient`（「還需要 N 次相符的 session」）。
- 🔴 **只陳述歷史，不做預測**。允許：「其中 8 次，你最後沒有照原本的計畫執行。」
  禁止：「你這次也會偏離。」
- 🔴 **不准羞辱**。不出現「8 次中 8 次失敗」這種句子；用流程語言
  （`lower process adherence`），不用價值判斷。

### 4.4 Decision Black Box

- 把既有的決策紀錄（`domain/src/policies/decision-outcome.ts`）+ drift 事件
  + calibration 事件組成一條**帶時間戳的證據鏈**。
- 每一條事件都掛自己的 `EvidenceBasis` → 點下去就是「證據 X 光」。
- 它是**紀錄器**，不是分析師：不對事件下結論，只把事實排好。

---

## 5. 文案紅線

前四條是 `CLAUDE.md` / `SYSTEM.md` / `docs/brand.md` 既有規則的重申，
後四條是本檔新增的：

1. 不得醫療診斷、不得金融建議（`CLAUDE.md` 硬規則）。
2. 不得把產品講成 trading tool / signal system / meditation app（`SYSTEM.md` §5.1）。
3. `docs/brand.md` 的 dopamine / withdrawal / craving 措辭不得外流到 user-facing copy。
4. gold ＝ SECURED、cyan ＝ ACTIVE；**沒有讀數就不准上 gold**（`docs/VISUAL-DIRECTION.md` §3）。
   偏移量是**量測值** → 依 2026-09-08 的規則**不上色**，用 `--n-100` / `--n-200`。
5. 🔴 **不得宣稱偵測情緒**。所有宣稱只能建立在量得到的東西上
   （landmark 幾何、位移穩定度、該次帶位、行為紀錄）。
6. 🔴 **不得預測結果**。可以講「你的紀錄裡，這個狀態伴隨過較低的流程一致性」，
   不可以講「你會犯錯 / 不要進場」。
7. 🔴 **不得羞辱**。失敗次數不做成標題，不用 emoji 加強負面判定。
8. 🔴 **不得假精準**。兩秒的粗略初判要顯示成**區間 + 信心**，不是 `72.3`。
   founder 原話：「這比一開始丟出 72.3 更像頂級儀器，也更誠實。」

### 5.1 驗收方式

`packages/engine/src/intelligence/copy.ts` 是本層 user-facing 字串的**唯一產生點**，
且測試逐字串跑 `isCompliantCopy()`。新增文案不進那支檔案 ＝ 沒有被守到。

---

## 6. 分期

### Phase 1 — 現在就能做（不等穿戴、不等模型）✅ 本輪

Drift Alert、Calibration Proof、Decision Twin（會誠實說證據不足）、
Decision Black Box、以及全部 insight 的 evidence / sample count / confidence / provenance。

### Phase 2 — 要等資料累積

**⚠️ 前置條件在 2026-09-09 之前根本不成立**：`tenki.readiness.reading.v1` 是
`setItem` 單筆，每次掃描覆蓋上一次 —— 所以「使用者自己的歷史」**一筆都沒有在累積**，
本檔所有吃歷史的支柱（Drift / Twin / Clear Window）在真實 app 裡永遠只會說「證據不足」。
已修：`domain/src/policies/readiness-history.ts` + `apps/preview/readiness-history.js`
把每次掃描 append 進 `tenki.readiness.history.v1`（**只存原始 evidence，不存推導分數**）。

#### 🔴 下一個決定：drift 的軸

`assessDrift()` 吃 0-100，而 `domain/src/policies/readiness-band.ts` 檔頭明文
**刻意不產生數值分數**（capture tier 量不到 HRV，編一個就是捏造）。這兩層現在**接不起來**，
而把 band 硬換成 85/55/25 正是 §5 紅線 8 的假精準。定軸之前先看兩件事：

1. **span**（`/drift/` 的「你自己的資料」卡有）—— 訊號正規化成 0..1 不代表它會走遍 0..1。
   span 太小的訊號撐不起門檻，而摘要數字看不出來、直方圖看得出來。
2. **軸不得吃 capture quality**（lighting / uniformity）。那兩個講的是「房間變暗了」
   不是「你變了」；它們該進 confidence，不該進訊號 —— 否則偏移量會被燈光推著走。

⚠️ 定軸之後，`drift.ts` 的 `MIN_MEANINGFUL_STD` / `DRIFT_ABSOLUTE_THRESHOLDS` /
`AT_REFERENCE_POINTS` **全部要重新推導**（它們現在都是 0-100 軸上的值），不是改個名字。

其餘 Phase 2：Clear Window、Strain Window、The Turning Point（30 天）、個人介入反應圖譜。
⚠️ **開工前先確認真的有那麼多可比較 session**，不要拿三筆資料畫出一張很有說服力的圖
（2026-09-08 已經發生過一次：`isDisciplined` 吃錯型別，長出一張「每個帶位都 0%」
看起來很合理的圖，斷言抓不到，是把圖畫出來看才發現的）。

### Phase 3 — 接上真實多模態訊號

Apple Health / Health Connect / BLE（見 `docs/WEARABLE-INTEGRATION.md`）接通後：
provenance 標籤從 `inferred` 升級到 `measured`、confidence 跟著升、
個人參考值變細緻。**核心不變：生理資料是證據之一，不是魔法的替代品。**

---

## 7. Keep-in-sync 清單

`apps/preview/` 是 vanilla JS，**不能 import TS**（`CLAUDE.md` 架構限制），
所以偏移判定在 preview 有一份鏡射。PLAYBOOK §6 的教訓是「判定的單一來源要跨檔成立」，
這裡的做法與 `decision-outcome.js` 相同：**一份鏡射檔、兩邊都載它、不留 fallback**。

| TS 來源 | Preview 鏡射 | 守門 |
|---------|-------------|------|
| `packages/engine/src/intelligence/drift.ts` 的常數與 magnitude 判定 | `apps/preview/drift.js` | `scripts/preview-drift.mjs`（**逐一比對常數值**，不是靠自律） |
| `domain/src/contracts/readiness-history.ts` 的 key / schema / 上限 + `policies/readiness-history.ts` 的判定 | `apps/preview/readiness-history.js` | 同上（另含**接線**：`saveReading` 有 append、頁面載入順序、沒有第二份 store） |

⚠️ 鏡射只鏡射**判定與常數**，不鏡射整個引擎。engine 那邊改了常數而 preview 沒跟上，
harness 會當場紅 —— 這是本檔唯一防止「兩個頁面同一筆資料算出不同數字」的機制。
