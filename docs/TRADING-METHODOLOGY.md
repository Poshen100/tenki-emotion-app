# TRADING-METHODOLOGY.md — Adam Mancini 交易方法論（AI 可執行版）

> **Status**: ACTIVE — founder 親自整理拍板（2026-07-12），本檔是 trader 模式所有功能的 domain 知識底座。
> **給誰看**：所有接手 TENKI 的 AI 協作者。看懂本檔才能理解 trader 模板、快訊分類、
> 以及「為什麼 TENKI 存在」。
> **來源**：founder 對 Adam Mancini 系統的第一手實戰整理（原文參考：tradecompanion.substack.com
> "My Trade Methodology - Fundamentals"；該站擋爬蟲，本檔內容以 founder 2026-07-12 提供之全文為準）。
>
> ⚠️ **Compliance 邊界**：本檔是內部 domain 知識文件，**不是投資建議**，且其中任何交易語言
> （買/賣/勝率/進出場等）**禁止**逐字進入 user-facing copy — 對外一律走
> `packages/engine/src/compliance/` 與 Radar/Baseline/Calibration/Turning Point 語言系統（SYSTEM.md）。
> TENKI 產品本身不判讀市場、不產生訊號 — 本檔存在的目的是讓 AI 理解**使用者在做什麼**，
> 從而把決策紀律工具做對。

---

## 0. 為什麼 TENKI 存在（起源敘事 — 必讀）

Founder 是 Mancini 系統的實戰交易者。**每次做 FBD（Failed Breakdown）交易時，情緒都非常緊張或太急躁** — 這個真實痛點就是 TENKI Core 訂閱制構想的原點：

> 方法論本身已經高度紀律化（不預測、只反應、結構觸發才進場），
> 但**執行者的內在狀態**是系統之外的最後一個變數。
> TENKI 的角色 = 在訊號觸發與行動之間，插入一段可量測、有節奏的決策環境
> （Decision Edge Score → Entry Panel → 模板計時 → 事件鏈）。

所以：TradingView 快訊整合不是「更快看盤」，而是把本檔 §7 執行流程的第 4 步（觸發 → 進場）
包進 Turning Point 決策流程。

## 1. 核心哲學（Core Philosophy）

1. **不做預測（No Prediction）** — 不對價格未來路徑做任何假設；不基於「應該」發生什麼交易。
2. **條件反應（Conditional Reaction）** — 所有交易必須基於「已發生的結構」，僅在條件觸發時執行。
3. **價格優先（Price First）** — 價格行為 > 個人觀點；結構出現就必須執行，即使與主觀方向相反。

## 2. 市場結構模型（Market Model）

### 核心循環（Primary Cycle）

```
Elevator Down（快速下跌）
        ↓
Failed Breakdown（跌破失敗）
        ↓
Short Squeeze（空頭回補）
```

### 2.1 Elevator Down（快速下跌）

- 特徵：快速、連續下跌；輕鬆跌破多個支撐；時間尺度分鐘～數小時。
- 含義：建立「能量累積」。

### 2.2 Failed Breakdown（FBD — 最重要結構）

**定義**：價格跌破關鍵低點後，迅速收回。屬於「trap（陷阱）」結構。

條件：
- 跌破關鍵水平（significant low）
- 且出現以下之一：快速收回／雙探（double dip）／無法延續下跌

品質分級：
| 等級 | 特徵 |
|------|------|
| 高品質 | 明確 flush（快速下殺）、深度淺（< 10 點）、失敗迅速（fast failure） |
| 次高品質 | 無明確 flush（如雙底），仍可透過 reclaim 交易 |

> 命名勘誤紀錄：engine `TraderTemplateId = 'FBD'` 即此結構（顯示名「Mancini 假跌破流程」）。
> v2 時代曾誤植為 "Follow-By-Discipline"，2026-07-12 已勘正 — 見 MEMORY #21。

### 2.3 Short Squeeze（空頭回補）

- 觸發條件：必須由 Failed Breakdown（優先）或 Level Reclaim 觸發。
- 規則：**不可預判、不可提前做多、只在觸發後進場**。

## 3. 執行模組（Execution Modules）

### 模組 1：Failed Breakdown Long
- 進場條件：跌破 significant low → 出現失敗（reclaim／無法延續）→ 確認 trap。
- 進場方式：reclaim 當下，或回測後進場。
- 風險控制：停損設於低點下方。

### 模組 2：Level Reclaim Long
- 進場條件：關鍵支撐被跌破 → 價格重新站回該水平。
- 用途：沒有明顯 Failed Breakdown 時的替代結構。

### 模組 3：Non-Acceptance Protocol
- 觸發條件：價格重新站回低點上方（例：+5 points）並維持數分鐘。
- 用途：判定市場「不接受低價」，作為 Failed Breakdown 的替代確認。

## 4. 交易管理（Trade Management）

**Level-to-Level 管理**：不預測目標價；按結構逐級出場；每個 level 都是決策點。

**Runner 概念**：保留部分倉位（如 10%）捕捉極端行情；不主動平倉，直到結構失效。

## 5. 市場模式分類（Mode 1 / Mode 2 — 整套系統的市況分類器）

> 這是「何時該積極 vs 何時該保守」的判斷底座。少了它，AI 無法正確評估
> 任一 setup 在當下市況的可靠度。

### Mode 1：趨勢日（Trend Day / 單向日）

- **定義**：市場單方向持續推進，回調淺且短暫。
- **結構特徵**：多次 Elevator Down 或單邊上漲；幾乎沒有有效 FBD/Failed Breakout；pullback 很淺（不給好進場）；持續創新高/新低。
- **行為特徵**：市場「不給你上車」；大多數回調失敗；逆勢者被持續碾壓。
- **可做**：順勢追隨（breakout/continuation）、持有 runner（延長持倉）、減少過早止盈。
- **不可做**：期待 Failed Breakdown、逆勢抄底/抄頂、頻繁 level-to-level scalping。
- **核心邏輯**：Mode 1 = 市場在「釋放能量」，不是製造陷阱。

### Mode 2：均值回歸日（Mean Reversion / Trap Day / 雙向收割日）

- **定義**：市場雙向掃流動性，來回製造陷阱。
- **結構特徵**：清晰的 `Elevator Down → Failed Breakdown → Squeeze`，或反向 `Breakout → Failed Breakout → Dump`；多次來回（雙向）。
- **行為特徵**：市場專門「收割預測者」；上下都掃；假突破頻繁。
- **可做**：專注 Failed Breakdown / Failed Breakout、level-to-level 管理、快速減倉＋留 runner、多次參與（多個 setup）。
- **不可做**：持有過大方向性偏見、長時間死抱單邊。
- **核心邏輯**：Mode 2 = 市場在「製造陷阱並回收流動性」。

### Mode 判斷規則（AI 可執行）

```
初始狀態（開盤）：預設 Mode 2（等待確認）

轉為 Mode 1（滿足以下）：
  - 單方向推進 > 30–50 點
  - 幾乎沒有有效回收（no reclaim）
  - Failed Breakdown / Breakout 失效
  - pullback 淺且無法進場

維持 Mode 2（出現以下）：
  - 多次 Failed Breakdown
  - 多次 Level Reclaim
  - 上下掃流動性、明顯雙向結構

切換原則：
  - Mode 2 → Mode 1 最常見
  - Mode 1 很少回到 Mode 2（除非結構破壞）
  - 一旦確認 Mode 1：停止 counter-trend 思維、停止等待 trap
```

### 與核心系統的整合

| 模組 | Mode 1 | Mode 2 |
|------|--------|--------|
| Failed Breakdown | 低頻／不可靠 | 高頻／核心 |
| Level-to-Level | 次要 | 核心 |
| Runner | 極重要 | 次重要 |
| 預測風險 | 高（會被打臉） | 極高（雙向打臉） |

### AI 執行優先級

```
Step 1: 判斷 Mode → Step 2: 選擇策略 → Step 3: 等待結構 → Step 4: 執行與管理
```

**一句話**：Mode 1 順勢，不要聰明；Mode 2 反應，不要預測。

> ⚠️ 命名澄清（勿再混淆）：這裡的 Mode 1/2 是**市況分類**；engine 的
> `TraderTemplateId = 'MODE_2'` 是歷史 ID，實指「Canslim High RS Breakout」模板，
> 與本節無關（MEMORY #21 勘誤）。

## 6. 行為規則（Behavioral Rules）

**必須遵守**：不做路徑預測、不提前進場、不因情緒改變策略、僅交易明確結構。

**禁止行為**：「價格應該會…」、「這裡看起來像頂部」、提前抄底/抄頂、未觸發條件下進場。

**決策邏輯對比**：
- 錯誤（Retail）：預測未來路徑 → 建立偏見 → 被市場誘捕。
- 正確（Professional）：定義條件 → 等待觸發 → 執行 → 管理。

## 7. 系統化流程（Execution Flow）

```
1. 定義關鍵 levels
2. 等待價格接近
3. 判斷是否出現：Failed Breakdown / Level Reclaim / Non-Acceptance
4. 若觸發 → 進場          ← TENKI 的 Turning Point 插入點（見 §9）
5. Level-to-level 管理
6. 保留 runner
7. 無觸發 → 不交易
```

## 8. 核心優勢（Edge）

利用「陷阱（trap）」而非預測；與市場機制對齊（流動性收割）；避免 bias；高一致性、可重複。

**一句話總結**：不預測價格路徑，只在價格製造陷阱並失敗時進場，並以結構逐級管理。

## 9. 與 TENKI 系統的映射（AI 協作者的落地對照）

| 方法論概念 | TENKI 對應 | 位置 |
|-----------|-----------|------|
| FBD 觸發（§7 step 4 的高張力瞬間） | 快訊 → Decision Entry Panel → 決策計時（Turning Point） | `docs/TRADINGVIEW-ALERT-SPEC.md` |
| FBD setup | 模板 `FBD`「Mancini 假跌破流程」（180s） | `packages/engine/src/session/templates.ts` |
| Canslim GS（成長股 pullback/breakout，founder 的 swing 系統） | 模板 `CANSLIM`「Canslim GS 流程」（300s） | 同上 |
| Canslim High RS Breakout | 模板 `MODE_2`「高 RS 突破流程」（240s；ID 為歷史遺留） | 同上 |
| TradingView alert 的 `strategy` 標籤 | `suggestTemplateForStrategyHint` 關鍵字映射 | `session/template-suggestion.ts` |
| 執行者內在狀態（系統外的最後變數） | Decision Edge Score / zone 閘門（strain → 快訊靜默） | `domain/src/policies/alert-policy.ts` |
| 「不因情緒改變策略」（§6） | 決策計時模板的 readinessWindow / preventEarlyComplete / 事件鏈 | Session Governance |
| Mode 1/2 市況分類 | **未接線**（候選：alert `condition` 語意標籤、模板情境提示、insight 層），見 §10 | — |

## 10. 未來接線候選（尚未拍板，動工前問 founder）

1. **Mode 標籤進快訊**：TradingView alert payload 的 `condition`/`note` 帶 `Mode 1`/`Mode 2` 標籤 → Entry Panel 顯示市況脈絡（事實陳述，不是建議）。
2. **Mode-aware 模板提示**：Mode 1 日對 FBD 類快訊降權提示（本檔 §5 整合表的機器化）。
3. **行為統計分層**：事件鏈統計依 Mode 分組（「Mode 2 日的紀律完成率」），仍走流程統計語言（勝率語言已禁）。
