# Growth Architecture — TENKI CORE

> **最後更新**：2026-08-12
> **版本**：v1.0
> **狀態**：Active
> **原則**：迴圈每轉一圈，使用者的資料就更像他自己，而不是更像我們的。

---

## 1. 文件目的

TENKI CORE 的引擎層已經完成：Edge Score、Baseline、Session governance、Replay、
Insight Generator、合規引擎都在 `packages/engine/src/` 裡。**產品核心有了，但沒有 growth 層。**

本文件定義 growth 層的完整架構：flywheel、data moat、network effect、
social loop、AI Coach 路線圖、訂閱轉換策略。

這份文件回答三個決定 TENKI 長期價值的問題：

| # | 問題 | 難點 |
|---|------|------|
| 1 | 資料護城河累積在哪裡？ | local-first 架構下，moat 不能建立在「我們擁有你的數據」 |
| 2 | 沒有社群功能的產品，網路效應從哪來？ | TENKI 不做好友、不做動態牆、不做排行榜 |
| 3 | 什麼會讓使用者主動分享 TENKI？ | 分享的東西不能是績效，也不能是健康數值 |

### 1.1 不可違反的前置約束

本文件的所有設計都在既有紅線內。任何後續提案若與下表衝突，**以下表為準**。

| 約束 | 來源 | 對 growth 的限制 |
|------|------|------------------|
| S1–S3 數據永不上雲 | `PRIVACY_ARCHITECTURE.md` §3.2 | DPD 必須是裝置端資產；雲端只收匿名分桶 |
| Benchmark 需 k≥50 | `PRIVACY_ARCHITECTURE.md` §5.1 | 網路效應必須設計「不足 k 時顯示什麼」 |
| Benchmark / Analytics 預設 OFF | `PRIVACY_ARCHITECTURE.md` §8.1 | opt-in 率本身是 growth 指標，不能靠預設開啟灌數字 |
| `predict` 為禁用詞 | `compliance/safe-copy.ts` | Edge Prediction Engine 是**內部代號**；UI 一律用 pattern / tendency /「傾向」 |
| 金融、醫療、確定性語言禁用 | `ANTIGRAVITY.md` §2.1 | 分享卡與 Coach 文案必須通過 `isCompliantCopy()` |
| 推播不得含具體數值 | `ANTIGRAVITY.md` §2.2 | 習慣迴圈只能用 `SAFE_NOTIFICATION_TEMPLATES` |
| 反思內容永不做 NLP 分析 | `PRIVACY_ARCHITECTURE.md` §15 | AI Coach 只吃結構化訊號，不吃日誌文字 |
| 不得付費牆的功能 | `ANTIGRAVITY.md` §12.2 | 基本掃描、Edge Score、刪除/匯出、7 天歷史、多巴胺日誌 |

---

## 2. Growth Flywheel

### 2.1 迴圈總覽

```
        ┌──────────────────────────────────────────────────┐
        │                                                  │
        ▼                                                  │
  Biometric Data ──► Edge Score ──► AI Insights ──► Decision
   （30 秒掃描）      （0–100 +       （用你自己的     Reflection
                      zone +          基線解釋）      （事後自評
                      confidence）                     clarity）
                                                          │
        ▲                                                  ▼
        │                                          Personal Edge
     More Data ◄──── Daily Habit ◄──────────────────  Learning
   （樣本數 ↑        （連續天數 +                    （baseline 成熟度
    confidence ↑）    安全推播）                       new→mature）
        │                                                  │
        └──────────────────────────────────────────────────┘
```

### 2.2 七段詳解

| # | 段 | 輸入 | 產出 | 什麼推動使用者走到下一段 |
|---|-----|------|------|--------------------------|
| 1 | **Biometric Data** | 手指 PPG / HealthKit HR·HRV·RR | 一次有效量測（含 signal grade） | 摩擦低於 30 秒；量完就想看結果 |
| 2 | **Edge Score** | 8 維度加權 + 個人 baseline | Score 0–100、zone、confidence band | 數字本身有即時解釋需求：「為什麼是 62？」 |
| 3 | **AI Insights** | Score + baseline + 歷史 | 一句以**你自己的基線**為參照的觀察 | 洞察指向一個可回答的問題：「今天跟平常比如何？」 |
| 4 | **Decision Reflection** | 使用者事後 1–5 clarity 自評 | 一筆 **DPD 標註**（見 §3） | 30 秒成本換一次自我敘事的結案 |
| 5 | **Personal Edge Learning** | 累積的 DPD 記錄 | baseline 成熟度推進、時段分桶填滿 | 進度可見：`new → building → ready → mature` |
| 6 | **Daily Habit** | 成熟度提升 + 連續天數 | 儀式化的每日檢查點 | 連續天數的損失趨避 + 安全推播提醒 |
| 7 | **More Data** | 習慣產生的規律樣本 | confidence band 上升、洞察變準 | **越用越準 → 越準越想用**（迴圈閉合） |

### 2.3 為什麼這個迴圈增加留存

關鍵不是「使用者習慣了 UI」，而是**每轉一圈，退出成本就升高一次**。

| 迴圈段 | 這一圈留下什麼 | 換到競品時會損失什麼 |
|--------|----------------|----------------------|
| 1–2 | 一個分數 | 幾乎沒有（第一天可被複製） |
| 3 | 一句個人化解釋 | 解釋的參照系（你的基線）歸零 |
| 4 | 一筆 clarity 標註 | **標註資料無法轉移**（別家沒問過這個問題） |
| 5 | baseline 成熟度前進一格 | 回到 `new`，重新累積 15+ 樣本 / 3+ 天 |
| 6 | 連續天數 | 儀式斷裂 |
| 7 | confidence band 上升 | 分數回到低信心區，體感變「不準」 |

**第 5 段是真正的鎖定點。** baseline 成熟度不是帳號資料，是**時間的函數**：
`baseline.ts` 用 Welford 線上演算法累積，`mature` 需要 15+ 樣本且跨 3+ 天，
並依 Morning / Midday / Evening 分桶。這意味著即使競品逐字抄走 TENKI 的
UI、演算法、甚至文案，**也複製不了一個使用者已經走過的 90 天**。

> 一句話：TENKI 的留存不靠內容更新，靠的是**使用者自己已經投入的時間本身變成了產品價值**。

### 2.4 複利公式

使用者感知價值可以寫成：

```
V(user) ≈ f( baseline_maturity × reflection_labels × time_bucket_coverage )
```

| 因子 | 意義 | 為什麼是乘法而非加法 |
|------|------|----------------------|
| `baseline_maturity` | 分數的參照系有多準 | 沒有基線 → 分數只是一個裸數字 |
| `reflection_labels` | 生理狀態 ↔ 決策清晰度的配對數 | 沒有標註 → 只有生理趨勢，沒有意義 |
| `time_bucket_coverage` | 早/中/晚三個時段都有樣本 | 只掃早上 → 說不出「你的清晰窗口在哪」 |

三個因子任一為零，整體價值趨近零 —— 這正是**新用戶第 7 天是關鍵斷點**的原因：
D7 之前，三個因子都還沒起來，使用者只看得到「一個數字」。

### 2.5 迴圈段與留存指標的對應

| 指標 | 由哪一段負責 | 具體機制 |
|------|--------------|----------|
| **D1** | 段 1–2 | 首次掃描必須成功並產生分數（signal quality gate 的降級路徑要友善） |
| **D7** | 段 3–5 | baseline 從 `new` 推到 `building`／`ready`，洞察開始個人化 |
| **D30** | 段 5–6 | `mature` baseline + 時段覆蓋完成，Edge Graph 有東西可看 |
| **D90** | 段 7 | DPD 標註量足以支撐 P2 相關性洞察（睡眠 × clarity） |

### 2.6 迴圈斷點與修復

| 斷點 | 症狀 | 修復方向 |
|------|------|----------|
| 段 1 失敗 | 掃描信號品質不足，拿不到分數 | 降級為低 confidence 分數 + 明確重試指引，**絕不空手而回** |
| 段 3→4 流失 | 看完分數就關 app，不做反思 | 反思入口做進結果頁；限制為單擊 1–5，不強制文字 |
| 段 4→5 感知不到 | 使用者不知道自己在進步 | baseline 成熟度做成可見的進度元件（非數值化的四格） |
| 段 6 斷裂 | 連續天數中斷後不回來 | 安全推播（只能用既有模板）+ 回歸時**不懲罰、不重置 baseline** |

---

## 3. Data Moat — Decision Performance Dataset

### 3.1 DPD 是什麼

**Decision Performance Dataset (DPD)** 是把六種訊號綁定在**同一個決策時刻**上的記錄。
單獨看每一種訊號都不稀缺；綁在一起才是 TENKI 獨有的資產。

| 欄位群 | 內容 | 敏感度 | 儲存 |
|--------|------|--------|------|
| Biometrics | HRV / HR / RR 的**衍生值**（非原始序列） | S1–S2 | 裝置端 |
| Emotional state | 多巴胺三態自評（above / at / below baseline） | S3 | 裝置端 |
| Decision clarity | 事後 1–5 自評 | S3 | 裝置端 |
| Temporal | timeBucket、dayOfWeek、距上次掃描間隔 | S4 | 裝置端 |
| Stress | Stress Proxy level（REST / LOW / MEDIUM / HIGH） | S2 | 裝置端 |
| Score context | Edge Score、zone、confidence band、8 維度 breakdown | S2 | 裝置端 |

**DPD 永遠不上雲。** 上雲的只有 §4 定義的匿名分桶封包。

### 3.2 記錄生命週期

```
掃描完成 ──► 產生 Score ──► 建立 DPD 記錄（pending）
                                    │
                          使用者做決策、時間經過
                                    │
                                    ▼
                        反思自評 clarity ──► DPD 記錄（complete）
                                    │
                                    ▼
                   餵給 baseline 引擎 + Insight Generator
                                    │
                                    ▼
                  （opt-in 時）抽出分桶封包 → 匿名上傳
```

`pending` 狀態的記錄若 24 小時內未完成反思，保留生理側資料但標記
`unlabeled` —— 它仍然餵養 baseline，只是不進入標註集。

### 3.3 三層護城河

含糊地說「我們有資料」不構成 moat。TENKI 的 moat 是三層，各有不同的複製成本：

#### Layer 1 — Local moat（個人層）

DPD 存在使用者裝置的 Encrypted SQLite。競品即使抄走整套產品，
也複製不了「**這個人的 180 天**」。

**moat 的度量單位是時間，不是資料量。** 一個競爭者要追平一位 `mature` baseline 使用者，
需要那位使用者在競品上真的活過 15+ 樣本、3+ 天、三個時段都覆蓋 —— 而且從零開始。
這個成本由**使用者**承擔，不是由競爭者承擔，這正是它有效的原因。

#### Layer 2 — Aggregate moat（族群層）

只有匿名分桶封包上雲。累積的是「哪些 pattern 在哪些 cohort 出現」，
用途是**校準模型與門檻**（例如 Edge Detector 的 soft/strong 閾值、
各時段的 zone 分布先驗），不是用來識別任何人。

這一層的價值隨 opt-in 使用者數呈**超線性**成長：cohort 數是維度的乘積，
每多一批使用者，跨過 k=50 門檻的 cohort 數增加得比使用者數更快。

#### Layer 3 — Labeling moat（標註層，最深）

最稀缺的資源不是生理數據 —— Apple Watch、Oura、Whoop 都有，而且比 TENKI 多。
稀缺的是：

```
生理狀態  ↔  事後決策清晰度自評   的配對標註
```

**沒有任何一家在決策的前後兩端都問了問題。** 穿戴裝置量測身體但不知道你在決策；
生產力工具知道你在決策但量不到身體。TENKI 兩端都握著，因為它的核心互動
（scan → decision → reflection）天然產生這個配對。

| 玩家 | 有生理數據 | 有決策情境 | 有配對標註 |
|------|-----------|-----------|-----------|
| 穿戴裝置（Apple Watch / Oura / Whoop） | ✅ 多且準 | ❌ | ❌ |
| 生產力 / 日誌 app | ❌ | ✅ | ❌ |
| 冥想 app | 部分 | ❌ | ❌ |
| **TENKI** | ✅ | ✅ | **✅** |

這一層即使競爭者有更多錢、更多裝置、更多使用者，也要**重新設計核心互動**才追得上 ——
而那等於變成 TENKI。

### 3.4 moat 隨時間累積

| 時間點 | DPD 狀態 | 解鎖什麼 | 退出成本 |
|--------|----------|----------|----------|
| Day 1 | 1–3 筆，baseline `new` | 裸分數 | 幾乎為零 |
| Day 7 | ~7–20 筆，baseline `building`/`ready` | 個人化參照的洞察 | 低（但已有「重來一次很煩」的感覺） |
| Day 30 | ~30–90 筆，baseline `mature`，三時段覆蓋 | Edge Graph、時段 pattern | 中：重建需 30 天 |
| Day 90 | 標註量足夠做相關性 | 睡眠 × clarity 等 P2 洞察 | 高：這些洞察別處拿不到 |
| Day 365 | 跨季節、跨生活階段 | 長期基線漂移、年度回顧 | 極高：等同放棄一年的自我記錄 |

### 3.5 為什麼 local-first 反而強化 moat（反直覺）

直覺上，「資料不在我們手上」等於沒有 moat。實際上相反：

| 論點 | 說明 |
|------|------|
| **信任降低採集摩擦** | 生理數據是最私密的資料類別之一。「永不上雲」讓使用者願意每天交出它 —— 拿到的樣本密度比一個會上傳的競品更高 |
| **moat 在裝置上一樣是 moat** | 退出成本由使用者感知，與資料存在哪台機器無關 |
| **監管風險趨近零** | 沒有集中的生理資料庫 → 沒有 GDPR 特殊類別的大規模處理風險、沒有洩漏事件可以毀掉品牌 |
| **合規敘事本身是差異化** | 「你的身體數據永遠是你的」是可行銷的立場，不只是工程決策 |

代價要誠實承認：**無法做集中式的大模型訓練**。因應方式是 Layer 2 的匿名聚合
只用來**校準**（閾值、先驗分布），而不是用來訓練個人化模型 ——
個人化一律在裝置端發生。

---

## 4. Network Effect — 匿名 Benchmark 架構

### 4.1 設計原則

| 原則 | 規則 |
|------|------|
| 只上傳分桶 | 上傳 zone 與 band，**永遠沒有** Edge Score 數值、沒有 HR/HRV |
| 預設關閉 | opt-in only，Settings → Privacy 明確開啟 |
| k-anonymity | 任一 cohort 的 distinct devices < 50 → **不回傳比較結果** |
| 不可逆識別 | `deviceIdHash = SHA256(random_device_id + salt)`，salt 存 Keychain，不與帳號關聯 |
| 每日 1 次 | 裝置端 buffer，24h 批次上傳；離線不補傳 |
| 無社交圖譜 | 沒有好友、沒有追蹤、沒有排行榜（見 §4.7） |

### 4.2 Cohort 定義

```
cohortKey = timeBucket × dayOfWeek × baselineMaturity × scenarioMode
```

| 維度 | 值域 | 為什麼收錄 |
|------|------|-----------|
| `timeBucket` | morning / midday / evening | 時段是 baseline 分桶的既有維度 |
| `dayOfWeek` | 0–6 | 平日 / 週末的節律差異 |
| `baselineMaturity` | new / building / ready / mature | 不同成熟度的分數不可直接比較 |
| `scenarioMode` | health-reset / focus / performance / trader | 情境不同，參照群體不同 |

**刻意不收錄**：年齡、性別、地區、裝置型號。這些維度會快速把 cohort 切碎到
k=50 以下，同時大幅提高準識別（quasi-identifier）風險。收益低、風險高，不做。

### 4.3 上傳封包

```typescript
interface AnonymousBenchmarkEnvelope {
  deviceIdHash: string;                              // SHA256(random_id + keychain_salt)
  zone: 'clear' | 'neutral' | 'strain';              // 只有 zone，沒有分數
  confidenceBand: 'high' | 'moderate' | 'low';
  timeBucket: 'morning' | 'midday' | 'evening';
  dayOfWeek: number;                                 // 0–6
  baselineMaturity: 'new' | 'building' | 'ready' | 'mature';
  scenarioMode: ScenarioMode;
  clarityBand: 'low' | 'mid' | 'high' | null;        // 1–5 自評分桶後，未反思為 null
  // ❌ 沒有 Edge Score 數值
  // ❌ 沒有 HR / HRV / RR
  // ❌ 沒有反思文字
  // ❌ 沒有時間戳（只有分桶）
  // ❌ 沒有地理位置
}
```

> 注意封包**不含精確時間戳** —— 精確時間本身就是準識別資訊。

### 4.4 k-anonymity 閘門

```
查詢 cohort ──► 伺服器計算 distinctDevices
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
   distinct ≥ 50                distinct < 50
          │                           │
   回傳 zone 分布              回傳 status: 'insufficient'
   （百分比，非個體）          客戶端顯示「樣本仍在累積中」
```

**不足 k 時絕不降級顯示殘缺數據。** 這是隱私要求，也是產品要求：
一個用 6 個樣本算出來的「全球比較」比沒有比較更糟。

### 4.5 冷啟動階梯

benchmark 在使用者數少時無法運作，所以按 cohort 粗細分階段開放：

| 階段 | cohort 粒度 | 需要的 opt-in 使用者量級 |
|------|-------------|--------------------------|
| S1 | 全球 × timeBucket（3 個 cohort） | ~數百 |
| S2 | + dayOfWeek（21 個） | ~數千 |
| S3 | + baselineMaturity（84 個） | ~萬 |
| S4 | + scenarioMode（336 個） | ~數萬 |

由 `benchmark_cohorts_v1` feature flag 遠端控制目前開放到哪一階。

### 4.6 對外功能

| 功能 | 呈現方式 | 絕不呈現 |
|------|----------|----------|
| **Global HRV comparison** | 你的 zone 在 cohort 的 zone 分布中的位置 | 任何 HRV 毫秒數、任何人的個別數值 |
| **Decision clarity trends** | cohort 的 clarity band 分布走勢 | 個別使用者的反思、精確分數 |
| **Stress baseline comparison** | 相對位置（例如「偏向 cohort 的低壓力側」） | 絕對壓力數值、醫學化的分級語言 |

文案一律走 `safe-copy.ts`：不出現「你比 73% 的人健康」這種**比較式健康聲明**，
只描述**分布位置**，且附上「僅供參考」。

### 4.7 為什麼這是真正的網路效應

多數 wellness app 的「社群」是偽網路效應：它靠內容或社交壓力，而不是靠使用者數
提升產品本身的效用。TENKI 的 benchmark 不同：

```
更多 opt-in 使用者
   → 更多 cohort 跨過 k=50 門檻
   → benchmark 對「所有」使用者更有用（不只新加入者）
   → benchmark 是 Premium 功能
   → Premium 的價值隨用戶數自我增強
   → 更高的訂閱轉換 → 更多資源獲客 → 更多使用者
```

這是 **same-side network effect**，而且達成它**不需要任何社群功能**：
不需要好友、不需要 UGC、不需要動態牆、不需要內容審核。
對一個處理生理數據的 privacy-first 產品而言，這是唯一安全的網路效應形式。

### 4.8 明確不做

| 不做 | 原因 |
|------|------|
| 好友 / 追蹤關係 | 引入社交圖譜 = 引入去匿名化風險 |
| 排行榜 | 把 wellness 變競賽，違反產品倫理，也違反 App Store 健康類定位 |
| 公開個人檔案 | 任何公開頁面都可能與生理狀態關聯 |
| 群組挑戰 | 小群組必然打破 k-anonymity |

---

## 5. Social Growth — Edge Snapshot

### 5.1 卡片規格

使用者可將當日的決策準備度分享到社群平台。

```
┌────────────────────────────────┐
│                                │
│         [TENKI mark]           │
│                                │
│   Decision Readiness Today     │
│                                │
│             82                 │
│         ▔▔▔▔▔▔▔▔▔              │
│      [zone 色帶 · Clear]        │
│                                │
│   2026-08-12 · morning         │
│                                │
│   tenki.app                    │
└────────────────────────────────┘
```

| 元素 | 內容 | 規則 |
|------|------|------|
| 標題 | `Decision Readiness Today` | 固定字串，通過 `isCompliantCopy()` |
| 主數字 | Edge Score 0–100 | 唯一允許出現的數值 |
| 色帶 | zone（Clear / Neutral / Strain） | 用 `zone-config.ts` 既有色票 |
| 日期 / 時段 | 日期 + timeBucket | 不含精確時間 |
| 品牌 | TENKI mark（`docs/assets/brand/tenki-mark.svg`） | 不得重繪（`ANTIGRAVITY.md` §18.5） |

### 5.2 絕不出現在分享卡上

| 禁止 | 原因 |
|------|------|
| HRV / HR / RR 任何數值 | S1 數據不得離開裝置，遑論公開 |
| 「因此你應該…」任何行動指示 | 違反 §2.1 安全文案規則 |
| 任何市場 / 交易 / 績效字眼 | App Store 4.2 風險 |
| 醫療化描述（如「自律神經失調」） | 醫療聲明風險 |
| 反思日誌文字 | `PRIVACY_ARCHITECTURE.md` §15 |
| 連續天數以外的社交比較 | 避免比較式健康聲明 |

分享卡的所有文案在建構時就跑 `findProhibitedTerms()`，**回傳非空即拒絕產生卡片**。

### 5.3 為什麼會被分享（分享心理學）

Edge Snapshot 不是炫耀，是**身分表達**：

> 「我是一個在做重要決定前，會先確認自己狀態的人。」

這與健身房打卡、跑步紀錄同屬一類 —— 分享的是**自律的證據**，不是成績。
關鍵設計含意：

| 設計選擇 | 理由 |
|----------|------|
| 低分也要能分享 | 只讓高分分享 = 變成炫耀，違反 wellness 定位，也降低分享頻率 |
| 不做排名 | 一旦有排名，分享動機從自我表達變成競爭 |
| 卡片美感優先於資訊量 | 社群平台上，能被看的前提是好看 |
| 不強制帶連結追蹤參數 | 追蹤參數讓卡片看起來像廣告，降低分享意願 |

### 5.4 病毒迴圈

```
使用者分享 Edge Snapshot
        ↓
觀看者看到一個「自己不知道答案」的數字
        ↓
好奇：我的是多少？
        ↓
下載 → onboarding → 首次掃描（免費就有分數）
        ↓
拿到自己的分數 → 進入 §2 主迴圈
        ↓
分享自己的 Edge Snapshot
```

迴圈成立的關鍵條件：**觀看者必須在下載後很快拿到自己的數字。**
所以 §2.5 的 D1 機制（首次掃描必成功）同時也是病毒迴圈的成立條件。

### 5.5 Edge Snapshot 必須免費（硬規則）

**Edge Snapshot 在 Free 與 Premium 兩個 tier 都必須開放。**

把分享放進付費牆等於掐死病毒係數：付費使用者佔比若為 5%，
可分享人口就少了 95%。這條寫進 `subscription-tiers.ts`
（`edgeSnapshot: true` 於兩個 tier），並列入 `ANTIGRAVITY.md` §12.2
「不得付費牆的功能」。

### 5.6 追蹤指標

| 指標 | 定義 | 為什麼重要 |
|------|------|------------|
| Snapshot generation rate | 產生卡片的使用者 / DAU | 分享意願的上游 |
| Share-through rate | 實際分享 / 產生卡片 | 卡片美感與文案的品質訊號 |
| k-factor | 每位分享者帶來的安裝數 | 病毒迴圈是否成立 |
| Snapshot → first scan | 從分享安裝的使用者完成首掃比例 | 迴圈閉合率 |

> 所有指標都在 opt-in analytics 範圍內，且只記錄事件不記錄數值
> （`PRIVACY_ARCHITECTURE.md` §9.2）。

---

## 6. AI Coach Roadmap

### 6.1 定位與邊界

AI Coach 只討論**健康與認知覺察**。它不是醫生，不是理財顧問，也不是教練式的命令者。

| 允許 | 禁止 |
|------|------|
| 壓力 pattern 觀察 | 任何診斷、任何治療建議 |
| 睡眠對清晰度的**傾向性**關聯 | 「你的睡眠不足導致判斷失誤」（因果聲明） |
| 專注窗口的時段觀察 | 「你應該在早上做決定」（行動指示） |
| 認知清晰度的自我覺察 | 任何金融、市場、績效語言 |

### 6.2 四階段

| 階段 | 能力 | 運算位置 | Tier | 依賴 |
|------|------|----------|------|------|
| **P1 規則式** | 時段 pattern、趨勢方向、zone 分布 | 裝置端 | Free（基本）/ Premium（完整） | 既有 `insight-generator.ts` |
| **P2 相關性** | 睡眠 × clarity、stress × clarity 的**個人**相關性 | 裝置端 | Premium | DPD 標註 ≥ 30 筆 |
| **P3 個人模型** | 個人化 pattern 模型 + 情境提示 | 裝置端 | Premium | DPD 標註 ≥ 90 筆，跨 3 時段 |
| **P4 語言層** | 自然語言解釋與問答 | 雲端（opt-in） | Premium | 明確 opt-in + 特徵去識別化 |

### 6.3 洞察模板語法

所有洞察由模板產生，不由自由生成產生（P4 例外，見 §6.5）。模板形狀：

```
{觀察對象} 在 {條件} 時 {傾向動詞} {方向}。
```

| ✅ 安全範例 | 🚫 不安全對照 |
|------------|---------------|
| 你的 decision clarity 在睡眠低於 6 小時的日子**傾向**偏低。 | 睡眠不足**會導致**你判斷失誤。 |
| 你的清晰狀態多數出現在上午時段。 | 你**應該**在上午做重要決定。 |
| 近 7 天你的壓力指標**傾向**高於個人基線。 | 你的壓力**過高**，需要**治療**。 |
| 你的恢復訊號在週末**傾向**較穩定。 | 週末你的身體**恢復正常**了。 |

三條語言規則（源自 `ANTIGRAVITY.md` §2.1）：

1. 用「**傾向**」不用「會 / 導致 / 一定」
2. 用「**你的資料顯示**」不用「你應該 / 你必須」
3. 每則洞察附「僅供參考」層級的免責

> **命名警告**：`predict` 是 `PROHIBITED_VOCABULARY` 中的禁用詞。
> Edge Prediction Engine 是**內部模組代號**；任何 UI 文案一律用
> pattern / tendency /「傾向」/「模式」。

### 6.4 P4 隱私閘門

P4 是唯一涉及雲端運算的階段，因此門檻最嚴：

| 閘門 | 規則 |
|------|------|
| 明確 opt-in | 獨立的同意類別，預設 OFF，與 benchmark / analytics 分開 |
| 送出的是特徵 | **只送去識別化的聚合特徵向量**（如 zone 分布、相關係數） |
| 絕不送出 | 原始生理值、反思文字、精確時間戳、裝置識別 |
| 無留存 | 雲端不保存請求內容，不用於訓練 |
| 輸出再過濾 | LLM 回傳的文字**必須**再跑一次 `isCompliantCopy()` 才顯示 |
| 可降級 | opt-out 或離線時，自動回落到 P1–P3 的模板洞察 |

**輸出再過濾是不可省略的一步。** 雲端模型不知道 TENKI 的合規詞表，
唯一安全的假設是：它可能產生違規文案，而閘門在客戶端。

---

## 7. Subscription Growth Strategy

### 7.1 Tier 對照

以 `packages/shared/src/subscription-tiers.ts` 為準（本文件不修改既有數值）。

| 功能 | Free | Premium |
|------|------|---------|
| 基本生理掃描 | ✅ | ✅ |
| 每日 Edge Score | ✅ | ✅ |
| 每日掃描次數 | 受限（見 §7.5 待決） | 無限 |
| 本地歷史 | 7 天 | 無限 |
| **Edge Snapshot 分享** | ✅ **（永不付費牆）** | ✅ |
| 資料刪除 / 匯出 | ✅（隱私權利永不付費牆） | ✅ |
| 多巴胺狀態日誌 | ✅ | ✅ |
| Edge Prediction（內部代號） | — | ✅ |
| Personal Edge Graph | — | ✅ |
| Edge Timeline | 有限 | 完整 |
| Decision Replay 洞察 | 基本 | 進階 |
| AI Coach | P1 基本 | P1–P4 完整 |
| 匿名 Benchmark 比較 | — | ✅ |
| Edge Detector 提醒 | — | ✅ |

### 7.2 轉換觸發點：時機式，不是額度式

多數 app 用額度牆逼轉換（「今日次數已用完」）。TENKI 主要用**時機式**觸發：
在使用者的資料**剛好成熟到能解鎖某個洞察**的那一刻提示。

| 觸發時機 | 提示什麼 | 為什麼這時候有效 |
|----------|----------|------------------|
| baseline 推進到 `ready` | Personal Edge Graph | 使用者剛看到「我的基線建立好了」，正想知道能看到什麼 |
| 累積滿 7 天歷史 | Edge Timeline 完整版 | 免費歷史正好到頂，需求是自然浮現的 |
| 完成第 10 筆反思標註 | Replay 進階洞察 | 標註量剛好夠產生第一個有意義的 pattern |
| 所屬 cohort 跨過 k=50 | 匿名 Benchmark | 比較功能**此刻才真的可用**，不是空頭承諾 |
| 連續 14 天 | AI Coach P2 相關性 | 習慣已成立，使用者對自己的模式產生好奇 |

兩者的差別：

| | 額度式 | 時機式 |
|---|--------|--------|
| 觸發原因 | 你被擋住了 | 你剛解鎖了新東西 |
| 使用者情緒 | 挫折 | 好奇 |
| 對留存的影響 | 負向（被擋 → 流失） | 中性至正向 |
| 轉換品質 | 低（衝動、易退訂） | 高（理解價值後付費） |

額度牆仍然存在（Free tier 有每日上限），但它是**次要**觸發器，不是主要策略。

### 7.3 定價結構

| 項目 | 建議 | 說明 |
|------|------|------|
| 方案數 | 2（Monthly / Yearly） | 沿用既有 `BILLING_CADENCES`，不引入第三 tier |
| 年繳折扣 | ~20% | 既有 `BILLING_CADENCES.yearly.discount` 已定 |
| 試用 | 7 天，**在 baseline 成熟前不啟動** | 試用期若落在 `new` baseline 階段，使用者看不到 Premium 的真正價值 |
| 定價數字 | 由 founder 決定 | 本文件只定結構，不定價 |

> **試用時機建議**：把 7 天試用綁在「baseline 達到 `ready`」而非「安裝後第 N 天」。
> 這確保試用期展示的是成熟資料下的 Premium 體驗，而不是空圖表。

### 7.4 North Star Metric

**建議 North Star：每週完成完整迴圈（scan → reflection）的使用者數（WACL, Weekly Active Complete Loops）。**

為什麼不是 DAU：只開 app 看一眼分數的使用者，不餵養 moat（§3.3 Layer 3）。
只有**完成反思**的使用者才產生標註，而標註是最深的那層護城河。
把 North Star 設成 WACL，等於把整個團隊的注意力對準 moat 的成長速度。

指標樹：

```
WACL（North Star）
├── 掃描完成率        ← 段 1–2 健康度（signal quality gate）
├── 反思完成率        ← 段 3–4 轉換（結果頁的反思入口設計）
├── 週活躍天數        ← 段 6 習慣強度
└── baseline 成熟率   ← 段 5 進度（new→mature 的中位天數）

輔助指標
├── k-factor           ← §5.6 病毒迴圈
├── benchmark opt-in 率 ← §4 網路效應燃料
├── 時機式觸發轉換率    ← §7.2 各觸發點分別追蹤
└── Premium 續訂率      ← 價值兌現的最終驗證
```

### 7.5 反模式（明確不做）

| 反模式 | 為什麼不做 |
|--------|-----------|
| 把 Edge Snapshot 放進付費牆 | 掐死病毒係數（§5.5） |
| 用焦慮驅動轉換（「你的壓力很危險」） | 違反合規，且傷害品牌信任 |
| 預設開啟 benchmark 灌數據 | 違反 `PRIVACY_ARCHITECTURE.md` §8.1 |
| 連續天數中斷就重置 baseline | 懲罰回歸者，直接殺死 D30+ 留存 |
| 排行榜 / 群組挑戰 | 破壞 k-anonymity，違反產品倫理（§4.8） |
| 用推播數值製造焦慮 | 違反 `ANTIGRAVITY.md` §2.2 |

---

## 8. Feature Flags 與分階段推出

新增三個 flag（`packages/shared/src/feature-flags/flags.ts`）：

| Flag | 控制什麼 | 預設 | 遠端可控 |
|------|----------|------|----------|
| `edge_snapshot_v1` | Edge Snapshot 分享卡 | false | ✅ |
| `ai_coach_v1` | AI Coach P1–P2 洞察 | false | ✅ |
| `benchmark_cohorts_v1` | Benchmark cohort 階梯（§4.5） | false | ✅ |

推出順序：

```
1. ai_coach_v1（P1 模板）   → 強化段 3，先把主迴圈跑順
2. edge_snapshot_v1         → 開病毒迴圈（此時迴圈已能留住新用戶）
3. benchmark_cohorts_v1 S1  → 有足夠 opt-in 使用者後才開最粗的 cohort
```

順序不可顛倒：**在留存迴圈跑順之前開病毒迴圈，等於把使用者灌進漏斗然後流失掉。**

---

## 9. 隱私自檢（對照 `PRIVACY_ARCHITECTURE.md` §18.1）

| # | 檢查項 | 本文件的答案 |
|---|--------|--------------|
| 1 | 收集的數據分類？ | DPD 含 S1–S4；benchmark 封包為匿名化後的 S4 |
| 2 | 儲存位置？ | DPD 僅裝置端；benchmark 封包上雲 |
| 3 | 裝置端是否加密？ | ✅ Encrypted SQLite（沿用既有 DAL） |
| 4 | 上雲數據是否匿名化？ | ✅ 只有分桶 + hash device id + k≥50 閘門 |
| 5 | 需要新的同意類別？ | ✅ AI Coach P4 需獨立 opt-in（benchmark 沿用既有類別） |
| 6 | 使用者可刪除？ | ✅ DPD 隨 Data Deletion Flow 一併清除 |
| 7 | 使用者可匯出？ | ✅ DPD 納入既有 JSON 匯出 |
| 8 | 刪除流程是否涵蓋？ | ✅ 需在刪除流程加入 DPD 表與 benchmark buffer |
| 9 | **是否有原始生理數據離開裝置？** | ❌ **沒有。** benchmark 只送 zone/band；P4 只送聚合特徵 |
| 10 | Privacy Policy 需更新？ | ✅ 需加入 Edge Snapshot 與 AI Coach P4 兩節 |

---

## 10. Open Questions

| # | 問題 | 影響 | 狀態 |
|---|------|------|------|
| 1 | Free tier 每日掃描次數：`ANTIGRAVITY.md` §12.1 寫 3 次，`subscription-tiers.ts` 寫 `dailyScanLimit: 1` | 文件與程式碼不一致 | **待決** — 本次不動任何既有值，建議以 A/B 驗證（1 次 = 轉換壓力大；3 次 = 習慣建立快） |
| 2 | 試用啟動時機綁 baseline 成熟度是否會拖慢轉換？ | 轉換速度 vs 轉換品質 | 待驗證 |
| 3 | benchmark opt-in 率若長期低於 10%，S2 以上 cohort 永遠開不了 | 網路效應無法啟動 | 需觀察；備案是延長聚合視窗（跨週而非單日） |
| 4 | P4 雲端 LLM 的供應商選擇與資料處理協議 | 隱私承諾的法律基礎 | 需法律顧問 |
| 5 | Edge Snapshot 是否需要「不含分數」的變體（只有 zone 色帶）？ | 部分使用者不願公開數字 | 待使用者研究 |
| 6 | DPD 的 90 天原始數據輪轉是否會影響 P3 個人模型？ | 長期模型 vs 資料最小化 | 需確認：模型應吃衍生值而非原始值 |
| 7 | North Star（WACL）如何在不上傳數據的前提下量測？ | 指標可觀測性 | 需設計：opt-in analytics 只記事件不記數值 |

---

*— END OF GROWTH ARCHITECTURE v1.0 —*
