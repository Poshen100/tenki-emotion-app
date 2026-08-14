# Edge Detector — 即時認知準備度偵測架構

> **最後更新**：2026-08-14
> **版本**：v1.0
> **狀態**：Active
> **原則**：偵測器只回答「偵測到了嗎」。要不要打擾使用者，是另一層的事。

---

## 1. 現況盤點 — 先讀這節

**Edge Detector 的引擎層已經存在。** 開工前請先確認你要做的東西不在下表裡：

| 已存在 | 位置 | 內容 |
|--------|------|------|
| 偵測狀態機 | `packages/engine/src/scoring/edge-detector.ts` | soft/strong 門檻、連續視窗、hold duration、每日上限、抑制邏輯 |
| 門檻與型別 | `packages/engine/src/scoring/types.ts` | `EDGE_DETECTOR_THRESHOLDS`、`EdgeDetectorState`、`DetectedState` |
| 提醒節流 | `domain/src/policies/alert-policy.ts` | cooldown、聚合視窗、每日上限、安靜時段、同時多則分組 |
| 推播合規 | `packages/engine/src/compliance/notification-guard.ts` | `validateNotification()` + 安全模板（已含 `FOCUS_WINDOW`） |
| Tier gating | `packages/shared/src/subscription-tiers.ts` | `detectorAlerts`（Pro）/ `detectorDailyRecap`（兩 tier） |
| Edge Score 引擎 | `packages/engine/src/scoring/edge-score.ts` | 8 維度加權、zone 分類、`getTimeBucket()` |

本文件要補的是**周圍缺的三塊**，以及修掉**三個既有矛盾**。

### 1.1 缺的三塊

| # | 缺什麼 | 為什麼是缺口 |
|---|--------|-------------|
| 1 | **即時生理訊號管線** | `tickDetector()` 只吃 `score` + `confidence`。目前沒有任何東西在即時餵它 —— 偵測器是完整的，但沒有接上感測器 |
| 2 | **Focus Window** | 「10:00–12:00 高清晰時段」不存在。需要跨天的時段統計 |
| 3 | **EDGE DETECTED 事件契約 + EDGE STATUS UI** | 偵測結果目前停在 `EdgeDetectorState`，沒有對外的事件與呈現層 |

### 1.2 三個必須先解決的矛盾

見 §5.4、§5.5、§5.6。其中 §5.6 是**合規風險**，優先度最高。

---

## 2. 即時偵測架構

### 2.1 三層

```
┌────────────────────────────────────────────────────────┐
│ L1  訊號取得（Signal Acquisition）                      │
│     HealthKit observer query · 手指 PPG · 背景 delivery │
│     ↓ BiometricReading                                  │
├────────────────────────────────────────────────────────┤
│ L2  評分（Scoring）                                      │
│     Baseline 比對 → Edge Score 8 維度 → zone + 信心      │
│     ↓ score: number, confidence: number                 │
├────────────────────────────────────────────────────────┤
│ L3  偵測（Detection）                                    │
│     tickDetector() → EdgeDetectorState                  │
│     ↓ EdgeDetectedEvent（僅在確認時）                     │
├────────────────────────────────────────────────────────┤
│ L4  傳遞（Delivery）— 獨立一層，見 §5.5                   │
│     alert-policy 節流 → notification-guard 合規 → 推播    │
└────────────────────────────────────────────────────────┘
```

**L3 與 L4 之間的分界是這個架構最重要的一條線。**
偵測器不知道也不該知道現在幾點、使用者今天已經被打擾幾次、他有沒有訂閱。
它只回答一件事：**生理訊號現在是否處於持續的穩定視窗**。

### 2.2 Tick 的驅動來源

偵測需要連續的 tick，但連續取樣與電池是直接衝突的。三種驅動模式：

| 模式 | 觸發 | Tick 間隔 | 資料來源 | 電量 |
|------|------|-----------|----------|------|
| **Foreground Active** | app 在前景且使用者在 Scan/Session 頁 | 5 秒 | 手指 PPG 即時串流 | 高（可接受，使用者正在看） |
| **Foreground Passive** | app 在前景但在其他頁 | 60 秒 | HealthKit 最新樣本 | 低 |
| **Background** | HealthKit background delivery 喚醒 | 由系統決定（通常 15–60 分鐘） | HealthKit 批次樣本 | 極低 |

**背景模式的重要限制**：iOS 的 `HKObserverQuery` background delivery **不保證頻率**，
而且對 HRV 這類低頻資料，系統可能數十分鐘才送一次。這意味著：

> 背景模式偵測不到「180 秒的持續視窗」—— 因為它根本拿不到 180 秒內的連續樣本。

所以背景模式的角色**不是即時偵測，是回顧性標記**：它用批次樣本補算過去這段時間的
score 序列，事後判定「剛才有沒有出現過視窗」。這正好對應免費版的
**每日回顧**（`detectorDailyRecap`），也對應 §9 的 Focus Window 統計。

**即時提醒（`detectorAlerts`，Pro）只在 Foreground 模式下有意義。**
文件與 UI 都不得暗示 app 關閉時仍會即時提醒 —— 那是做不到的承諾。

### 2.3 狀態的持久化

`EdgeDetectorState` 是純資料，但它跨 tick 累積（`heldDurationSec`、
`consecutiveWindows`、`alertsFiredToday`）。持久化規則：

| 欄位 | 生命週期 | app 重啟後 |
|------|----------|-----------|
| `heldDurationSec` / `consecutiveWindows` | 單一連續視窗 | **重置**（連續性已斷） |
| `alertsFiredToday` | 當日 | **保留**（否則重啟可繞過上限） |
| `suppressed` / `suppressionReason` | 瞬時 | 重新計算 |

`alertsFiredToday` 存 Encrypted SQLite，與 DPD 同一個 DAL。
日界線用**使用者本地時區**的午夜，不是 UTC —— 見 §5.6。

---

## 3. 生理訊號管線

### 3.1 HealthKit 讀取

嚴格遵守 `PRIVACY_ARCHITECTURE.md` §14：

| 規則 | 實作 |
|------|------|
| 只讀不寫 | 只申請 read 權限，永不 `HKHealthStore.save()` |
| 不保留 HK identifier | 讀出後立刻轉為內部 `BiometricReading`，丟棄 `HKSample.uuid` |
| 不建快取 | 每次需要重新查詢；不維護 HK 資料的鏡像表 |
| 全部裝置端運算 | 訊號永不離開裝置（唯一例外是 §6.3 的匿名事件，且不含數值） |

讀取的型別（沿用 §14.1 既有清單，本次不擴充）：

| HealthKit 型別 | 用途 |
|---------------|------|
| `HKQuantityType.heartRate` | HR 穩定度、Stress Proxy |
| `HKQuantityType.heartRateVariabilitySDNN` | HRV vs baseline、ANS balance |
| `HKCategoryType.sleepAnalysis` | Sleep Recovery 維度 |

呼吸速率目前由 PPG 推算（`biometric/rr.ts`），不從 HealthKit 取 ——
避免新增權限類別，也避免 Apple Watch 呼吸資料的取樣間隔問題。

### 3.2 取樣視窗與降級

| 情境 | 行為 |
|------|------|
| HealthKit 有近 5 分鐘內的樣本 | 正常計算，`recency` 信心因子滿分 |
| 只有 5–60 分鐘前的樣本 | 正常計算，`recency` 下降 → 整體 confidence 下降 → 可能跌破 soft 門檻 |
| 超過 60 分鐘無樣本 | **不 tick**。舊資料算出來的「即時偵測」是假的 |
| 使用者拒絕 HealthKit | 僅 Foreground Active（手指 PPG）可偵測；背景模式停用 |
| 訊號品質不足 | `signal-quality-gate.ts` 既有邏輯：降 confidence 而非丟棄 |

**「不 tick」與「tick 出低分」不同。** 前者保持狀態不變，後者會重置
`consecutiveWindows`。資料過期屬於前者 —— 我們不知道，不代表狀態變差了。

---

## 4. ANS Balance

brief 列出的六個輸入中，五個已經是 Edge Score 的輸入。
**ANS balance 是唯一真正新增的訊號。**

### 4.1 設計為衍生指標，不是第 9 個維度

Edge Score 現有 8 個維度、權重總和為 1.0，且已經校準過。
加第 9 個維度意味著**重新分配所有權重並重跑校準** —— 成本遠高於收益。

ANS balance 改為由既有成分推導的**衍生指標**：

```
ansBalance = f(hrvVsBaseline, hrStability, stressProxy.hrvContribution)
```

它與 Edge Score **共用輸入但獨立輸出**：不進加權和，而是作為
UI 解釋層與 Coach 洞察的素材（「你的自律神經平衡今天偏向副交感側」）。

### 4.2 語言邊界

自律神經是醫學名詞，這裡踩線很近。三條規則：

| ✅ 可以說 | 🚫 不可以說 |
|----------|------------|
| 自律神經**平衡傾向**（相對、非診斷） | 自律神經**失調**（診斷語言） |
| 偏向**交感 / 副交感**側 | **過度活躍** / **功能低下** |
| 這是**相對於你自己基線**的觀察 | 與常模比較的絕對判定 |

輸出一律是**相對位置**（-1 交感側 ~ +1 副交感側），**不給絕對數值**，
也不做臨床分級。任何 UI 文案都必須通過 `findProhibitedTerms()`。

---

## 5. 偵測演算法

### 5.1 現行狀態機（已實作）

```
每個 tick：
  isSoft   = score ≥ 68 且 confidence ≥ 0.70
  isStrong = score ≥ 78 且 confidence ≥ 0.80

  若 !isSoft → 全部重置（視窗斷了）
  否則：
    heldDurationSec   += deltaSec
    consecutiveWindows += (首次進入時 +1)
    isDetected = consecutiveWindows ≥ 2
    strength   = isStrong ? 'strong' : 'soft'
```

`shouldFireAlert()` 額外要求 `heldDurationSec ≥ 180` 且未被抑制。

### 5.2 為什麼是「持續」而不是「瞬間」

單一高分不構成 Optimal Decision State。三道確認條件各擋掉一種假陽性：

| 條件 | 擋掉什麼 |
|------|----------|
| `consecutiveWindows ≥ 2` | 單次量測雜訊 |
| `heldDurationSec ≥ 180` | 短暫的生理波動（深呼吸幾次就能拉高瞬時 HRV） |
| `confidence ≥ 0.70` | 基線未成熟、資料過期、訊號品質差時的高分 |

第三條最容易被忽略：**新使用者的高分沒有意義**，因為沒有基線可比。
confidence 門檻讓 baseline `new` 階段幾乎不可能觸發偵測 —— 這是正確的。

### 5.3 `DetectedState` 分級

`classifyDetectedState()` 依分數給標籤：clear (≥85) / focused (≥80) /
stable (≥75) / balanced (≥72) / calm (其餘)。
全部是 `ALLOWED_VOCABULARY` 內的字彙。

> 注意 `DetectedState` 型別含 `'recovered'` 但 `classifyDetectedState()`
> 從未回傳它 —— 見 §11 Open Question #3。

### 5.4 矛盾 ① — 文件與程式碼的門檻不符

| 參數 | `ANTIGRAVITY.md` §5.2 | 程式碼 |
|------|----------------------|--------|
| Strong confidence | ≥ **0.82** | **0.80** |
| 每日提醒上限 | **3** 次 | **5** 次 |

**決議：以程式碼為準，改文件。**

理由：門檻是校準過的數值，改動需要重跑驗證；文件只是描述。
把 0.80 改成 0.82 會實際改變偵測行為，而沒有任何資料支持 0.82 更好 ——
它看起來只是文件寫錯了。每日上限同理。

（§5.5 決議後，engine 的 `DAILY_ALERT_CAP` 會退位，所以 3 vs 5 之爭自然消失。）

### 5.5 矛盾 ② — 三層節流互不知道對方存在

目前有三個地方在管「要不要打擾使用者」：

| 層 | 常數 | 值 |
|----|------|-----|
| engine | `EDGE_DETECTOR_THRESHOLDS.DAILY_ALERT_CAP` | 5 |
| domain | `ALERT_DAILY_SURFACE_CAP` | 10 |
| domain | `ALERT_COOLDOWN_SEC` | 300 |

engine 自己數一份、domain 又數一份，**兩邊沒有任何引用關係**。
實際上限是哪個，沒人說得準 —— 取決於呼叫順序。

**決議：職責單一化。**

```
engine  → 只回答「偵測到了嗎」
domain  → 唯一決定「要不要送出」
```

具體做法：

1. `alert-policy.ts` 成為**唯一**的節流權威（它已經有 cooldown、每日上限、
   安靜時段、分組，功能最完整）
2. engine 的 `DAILY_ALERT_CAP` 與 `recordAlertFired()` **標記為 deprecated**，
   保留欄位避免破壞既有測試，但不再作為決策依據
3. `tickDetector()` 的 `quietHoursActive` 參數改由呼叫端從 alert-policy 取得，
   engine 不自行判斷時間

**本次不動程式碼** —— 這是行為變更，需要獨立的 commit 與測試調整。
本節記錄決議，實作見 §11 Open Question #1。

### 5.6 矛盾 ③ — ⚠️ 安靜時段是用市場時間定義的

`domain/src/policies/alert-policy.ts`：

```typescript
export const QUIET_WINDOW_TZ = 'America/New_York';
export const QUIET_WINDOW_START_HOUR = 11;
export const QUIET_WINDOW_END_HOUR = 14;
export const QUIET_WINDOW_CONTEXT_ZH = '盤整迴避時段';
```

11:00–14:00 ET 是典型的美股盤中盤整時段，變數名直接寫「盤整迴避」。

**這是一個 Health & Fitness 分類的 app，在推播決策路徑上寫死了美股交易時段。**

問題的嚴重性不在文案 —— 使用者看不到變數名。問題在於：

1. **這是邏輯，不是措辭。** 它把應用行為綁定在金融市場的作息上，
   等於在程式碼層面承認產品的真實用途是交易輔助
2. **App Store 審查看得到程式碼。** 送審時提供的 build 含符號；
   而 `ANTIGRAVITY.md` §1.4 明列「市場時機指引」為絕對禁止
3. **它對非交易使用者是錯的。** 一個在台北用 TENKI 管理專注力的人，
   為什麼在他的深夜 23:00–02:00 收不到提醒？

**決議：去市場化。**

| 現行 | 改為 |
|------|------|
| 硬編碼 `America/New_York` | 使用者**本地時區** |
| 硬編碼 11–14 時 | 使用者可設定的安靜時段，**預設取 HealthKit 睡眠時段** |
| `盤整迴避時段` | `安靜時段` / `Quiet hours` |

**本次不動程式碼**，理由寫在 §11 Open Question #2 ——
這是合規議題不是實作細節，值得自己一次審查的注意力，
混在新功能的 commit 裡容易被略過。

---

## 6. EDGE DETECTED 事件契約

### 6.1 事件內容

```typescript
interface EdgeDetectedEvent {
  eventId: string;              // 裝置端 id，不離開裝置
  detectedAtMs: number;         // 本地時間戳
  strength: 'soft' | 'strong';
  detectedState: DetectedState; // calm / focused / stable / balanced / clear
  heldDurationSec: number;
  timeBucket: TimeBucket;
  confidenceBand: ConfidenceBand;
  // ❌ 沒有 Edge Score 數值
  // ❌ 沒有 HR / HRV / RR
  // ❌ 沒有 ANS balance 數值
}
```

**事件帶的是分類，不是量測。** 理由與 benchmark envelope 相同：
型別保證在物件跨越邊界後就不存在了，所以契約層要有執行期防呆
（`FORBIDDEN_EVENT_FIELDS` + `validateEdgeEvent()`）。

### 6.2 去重

同一個持續視窗只發**一次** EDGE DETECTED。
去重 key = `detectedAtMs` 所屬的視窗起點 + `timeBucket`。
視窗斷掉（`consecutiveWindows` 歸零）後重新累積才會產生新事件。

### 6.3 事件永不上雲

EDGE DETECTED 是**裝置端事件**。它會：

- 寫入 DPD 記錄（`decision-performance-record.ts`）
- 觸發 UI 狀態變更
- 送進 alert-policy 判斷要不要通知

它**不會**上傳。opt-in analytics 只記錄「發生了一次 `edge_detected`」這個事實，
不記錄任何欄位（`PRIVACY_ARCHITECTURE.md` §9.2）。

---

## 7. 通知設計

### 7.1 新增安全模板

```typescript
EDGE_DETECTED: 'Your signals suggest a steady, focused state right now.'
```

### 7.2 為什麼不直接用 "Edge detected"

brief 給的範例是「Edge detected. Your signals suggest a stable and focused state.」
但 `notification-guard.ts` 的 `NOTIFICATION_PROHIBITED` **已經禁了**：

```
'you have an edge'
```

「你有優勢」在交易語境下就是 edge 的意思，禁它是對的。
「Edge detected」與它只差一個詞，而 Edge 在 TENKI 是產品術語（Edge Score），
在金融語境是「優勢」—— **同一個詞在兩個語境下意思不同，這正是審查最容易誤判的地方**。

三條規則：

| 規則 | 說明 |
|------|------|
| 推播正文**不用** "Edge" 這個字 | 用 "steady, focused state" 描述狀態本身 |
| app 內文案**可以**用 Edge Score / Edge Status | 有完整產品語境，不會被誤讀 |
| 一律描述**狀態**，不描述**時機** | ✅「你的訊號顯示穩定專注」 🚫「現在是好時機」 |

第三條是關鍵：「時機」暗示行動，而行動 + 生理訊號 = 建議。

### 7.3 傳遞條件

一則 EDGE DETECTED 要真的送到使用者手上，必須同時滿足：

| # | 條件 | 由誰判斷 |
|---|------|----------|
| 1 | 偵測已確認且持續 ≥ 180 秒 | `shouldFireAlert()` |
| 2 | tier 含 `detectorAlerts` | `subscription-tiers.ts` |
| 3 | 未在安靜時段 | `alert-policy.ts` |
| 4 | 未超過每日上限、未在 cooldown | `alert-policy.ts` |
| 5 | 沒有進行中的 session | `alert-policy.ts`（`sessionActive`）|
| 6 | 文案通過 `validateNotification()` | `notification-guard.ts` |

條件 5 值得特別說：**提醒永遠不打斷進行中的決策 session。**
一個正在走流程的人，最不需要的就是一則通知。

### 7.4 免費版的每日回顧

`detectorDailyRecap` 對兩個 tier 都是 true。它不是推播，是 app 內的日終摘要：

```
今天你的清晰視窗出現在 09:40–11:15。
Pro 會在視窗開啟的當下就通知你。
```

它展示的是**已經發生在使用者身上**的事，不是功能廣告 ——
見 `GROWTH-ARCHITECTURE.md` §7.1 的主動性軸。

---

## 8. UI — EDGE STATUS

### 8.1 三態

brief 給的三態是 Edge Active / Neutral / **Recovery**，
但既有 zone 是 clear / neutral / **strain**。兩者不是同一個軸：

| EDGE STATUS | 判定來源 | 色彩 |
|-------------|----------|------|
| **Edge Active** | `detector.isDetected === true` | cyan `#00B4D8` |
| **Neutral** | 未偵測到，且 zone 為 clear 或 neutral | slate `#64748B` |
| **Recovery** | zone 為 `strain` | ember `#C2703D` |

**為什麼 UI 用 Recovery 而 zone 保持 strain**：

strain 描述問題，recovery 描述身體正在做的事。兩者同樣誠實，
但狀態列是使用者**整天都會看到**的元件 —— 一個常駐的
「Elevated Strain」標籤會製造焦慮，而那違反 §2.2 推播合規的精神
（不用威脅驅動行為）。

**Zone 本身不改名。** 引擎語意、DPD 記錄、benchmark 分桶全部維持
clear/neutral/strain。只有 UI 狀態列做這層轉譯。

### 8.2 版面

```
┌─────────────────────────────────────────┐
│  ● EDGE ACTIVE                          │  ← 狀態列（常駐）
│  Your signals suggest a steady,          │
│  focused state.                          │
│                                          │
│  Held for 4m 20s          ▁▂▃▅▆▅▃▂      │  ← 持續時間 + 迷你趨勢
├─────────────────────────────────────────┤
│  FOCUS WINDOW                            │
│  10:00 – 12:00                           │
│  High clarity period                     │
│  Based on 24 days of your own data       │  ← 樣本數，見 §9
└─────────────────────────────────────────┘
```

### 8.3 狀態轉換的動態

| 轉換 | 處理 |
|------|------|
| → Edge Active | 一次性的柔和進場（不用閃爍、不用震動預設開啟）|
| Edge Active → Neutral | 直接轉換，**不做「視窗結束了」的提示** |
| → Recovery | 溫和轉換，文案強調恢復而非警告 |

「視窗結束」不提示是刻意的：提示它等於製造錯過的焦慮（FOMO），
而 TENKI 的整個定位是**降低**衝動，不是製造它。

---

## 9. Focus Window 演算法

### 9.1 從歷史推導，不是預測

Focus Window 回答的是：**你過去在哪個時段最常出現清晰狀態。**

它不是預測。這個區別在合規上是硬的 —— `predict` 是 `PROHIBITED_VOCABULARY`
中的禁用詞（見 `ANTIGRAVITY.md` §13.5 的命名警告）。

演算法：

```
1. 取近 30 天的 DPD 記錄
2. 依小時分桶（24 桶），統計每桶的 clear-zone 比例
3. 找出連續 ≥ 2 小時且比例顯著高於個人平均的區段
4. 樣本不足 → 不輸出
```

### 9.2 樣本不足時不顯示

```
MIN_SAMPLES_FOR_WINDOW = 20   // 總記錄數
MIN_SAMPLES_PER_HOUR   = 3    // 該時段最少樣本
```

不足時 UI 顯示「還在累積你的模式」，**不顯示一個猜的視窗**。

這與 benchmark 的 k-anonymity 閘門是同一個精神：
**樣本不足時給誠實的空狀態，比給一個錯的答案好。**
一個用 3 筆記錄算出來的「你的高清晰時段」會被使用者拿去安排真實的行程，
然後發現不準 —— 那比沒有這個功能更傷。

### 9.3 文案

| ✅ 安全 | 🚫 不安全 |
|--------|-----------|
| 你的清晰狀態**過去**多出現在 10:00–12:00 | 你**將會**在 10:00–12:00 最清晰 |
| High clarity period | Best time to decide |
| Based on 24 days of your own data | Based on users like you |

第三列的差別容易被忽略：「像你這樣的使用者」引入了**族群比較**，
那會把 Focus Window 從個人觀察變成準健康聲明。

---

## 10. 合規檢查表

| # | 檢查項 | 本設計的答案 |
|---|--------|-------------|
| 1 | 有無金融語彙？ | 推播正文不含 "Edge"；§5.6 提出移除市場時段邏輯 |
| 2 | 有無醫療診斷語言？ | ANS balance 只給相對位置，不做臨床分級（§4.2）|
| 3 | 有無行動指示？ | 一律描述狀態不描述時機（§7.2）|
| 4 | 有無預測聲明？ | Focus Window 明確定義為歷史統計（§9.1）|
| 5 | 推播含具體數值？ | 否 —— 模板不含分數（§7.1）|
| 6 | 原始生理數據離開裝置？ | 否 —— 事件只帶分類（§6.1、§6.3）|
| 7 | 所有文案通過 `findProhibitedTerms()`？ | 是，且由測試強制 |
| 8 | 對非交易使用者是否合理？ | §5.6 決議後為是；現行的市場時段邏輯為否 |

---

## 11. Open Questions

| # | 問題 | 影響 | 狀態 |
|---|------|------|------|
| 1 | §5.5 節流單一化：engine 的 `DAILY_ALERT_CAP` 退位 | 行為變更 + 既有測試需調整 | **待實作** — 決議已定，需獨立 commit |
| 2 | §5.6 移除 `QUIET_WINDOW_*` 的市場時間邏輯 | **合規風險**，且動到既有 alert 行為 | **待 founder 決定** — 建議獨立 PR，優先度高 |
| 3 | `DetectedState` 含 `'recovered'` 但 `classifyDetectedState()` 從不回傳 | 死型別，或是遺漏的分支 | 待確認原始意圖 |
| 4 | 背景模式無法即時偵測（§2.2），UI 如何誠實表達？ | 期待管理 | 建議：設定頁明說「即時提醒需 app 在前景」 |
| 5 | ANS balance 是否應進入 Coach P2 的相關性分析？ | 需要 DPD 累積 ANS 欄位 | 待 P2 實作時決定 |
| 6 | 手指 PPG 連續串流的電量實測 | Foreground Active 模式可行性 | 需實機測試 |

---

*— END OF EDGE DETECTOR ARCHITECTURE v1.0 —*
