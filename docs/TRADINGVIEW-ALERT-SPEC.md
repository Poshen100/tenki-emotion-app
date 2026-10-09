# TENKI — TradingView 快訊整合規格書（Alert → Decision Flow）

> **Version**: v1.0（v3 語言 canonical）
> **Status**: ACTIVE — 本檔是 TradingView 快訊整合的唯一權威規格
> **Supersedes**: `docs/TRADER-MODE-SPEC.md` 中與快訊相關的行為描述（該檔使用 v2 廢棄詞彙，見其頂部橫幅）
> **Created**: 2026-07-11（founder spec v1.0 經 v3 硬規則翻譯後定稿）

---

## 0. 詞彙翻譯對照（founder 原始 spec → v3）

| 原始 spec 用語 | 本檔 canonical 用語 | 原因 |
|---------------|-------------------|------|
| TEI | **Decision Edge Score**（0-100） | TEI 是 v2 廢棄詞（CLAUDE.md 禁止事項） |
| TEI Gate | Zone 遞送閘門（strain → 靜默接收） | 同上 |
| `ALERT_TRIGGER` / `Entry` / `Add` / `Exit` 事件 | process-neutral 事件語言（見 §9） | 事件枚舉刻意避開金融動作詞（compliance） |
| 「你過去 Breakout 勝率：42%」 | 「在此狀態下，你過去的紀律完成率」 | **founder 決策（2026-07-11）**：否決勝率呈現，改流程統計框架；「勝率」入中文禁用詞庫 |
| Trader Mode | 決策紀律模式（`SessionMode = 'trader'`） | 沿用 engine 既有命名；user-facing 一律「決策紀律」 |

**產品框架**：本整合屬 SYSTEM.md 四 bucket 中的 **Turning Point**（行為從 reactive 轉 intentional 的時刻）。任何對外描述不得使用 "trading tool" / "signal system" 框架 — TENKI 不判斷市場，只讓「每一個外部訊號都被轉化為有節奏的決策過程」。

---

## 1. 核心定位

**Alert ≠ 進場訊號。Alert = 啟動「決策環境」的觸發器。**

```
TradingView（外部）— 提供：價格 / 指標 / 條件快訊（市場在動）
TENKI（內部）    — 負責：決策節奏 / 狀態閘門 / 模板 / 行為紀錄（你要不要動）
```

傳統快訊：價格到 → 通知 → 使用者慌張看盤。
TENKI 整合後：快訊到 → 狀態閘門 → 決策入口 → 有節奏的決策過程 → 完整行為紀錄。

## 2. 整體流程

```
[ TradingView Alert 觸發（Premium Webhook）]
        ↓
[ TENKI 接收 payload → schema 驗證 → AlertContract ]
        ↓
[ Delivery Policy：feature flag / tier / zone / cooldown / 聚合 ]
        ↓ surfaced
[ Decision Entry Panel（含當前 Edge 狀態，事實陳述）]
        ↓ 進入決策
[ 模板建議（不強制）→ 決策 session 啟動 → 浮動計時條 ]
        ↓
[ 事件鏈記錄：alert 紀錄 + session 紀錄（originAlertId join）]
```

## 3. Webhook Payload（TradingView 端設定）

TradingView Alert 勾選 Webhook URL，指向使用者的**專屬頻道連結**（**v1.2 channel 模型**，取代 v1.1 的共用 token）：

1. 裝置 `POST /api/channel`（`api/channel.ts`）→ 伺服器生成不可猜測的 channelId（SETNX 註冊，未使用 30 天過期、輪詢滑動續期）→ 回專屬 webhook URL。
2. TradingView → `POST /api/alert?ch=<channelId>`（`api/alert.ts`；憑證走查詢參數 = capability URL，因 TradingView 無法帶自訂 header；未註冊頻道一律 404，防隨機灌爆）。接收端容許 message 的 JSON 前後帶純文字（hybrid parser，取「第一個 `{` 到最後一個 `}`」），使 TradingView 原生推播可用純人話開頭 — 見 SETUP §3。
3. 裝置 `GET /api/alerts?ch=<channelId>&since=`（`api/alerts.ts`）輪詢拉取；遞送判定（§5）留在裝置端。

使用者體驗零輸入：頁面自動產生連結 → 複製貼進 TradingView 即完成配對。**設定步驟見 `docs/TRADINGVIEW-SETUP.md`。**

建議 payload 格式（TradingView alert message 欄位填 JSON）：

```json
{
  "symbol": "NVDA",
  "price": 128.5,
  "condition": "Breakout",
  "timeframe": "5m",
  "strategy": "CANSLIM",
  "note": "RS High + Volume Spike"
}
```

- `symbol`：必填，非空字串（解析時正規化為大寫）。
- 其餘欄位選填；字串有長度上限（防 payload 濫用）。
- 驗證實作：`domain/src/schemas/alert-schema.ts` `validateAlertPayloadContract`（手寫 type guard，無外部依賴，可 on-device 執行）。

**欄位來源（API adapter 組裝，`api/_lib/http.ts` `assembleAlertPayload`）**：欄位可來自 message body
（JSON / hybrid）**或** webhook URL 查詢參數（`?symbol=&condition=&strategy=&timeframe=&note=&price=`）。
組裝順序：①JSON body 為 base（純文字 body → 當 `note`）②query 參數 overlay（present 才蓋）。
用途 = 讓 TradingView message 可只留純人話（鎖屏推播零代碼），結構化欄位走 URL（見 SETUP §3 乾淨模式）。
**domain 只收組裝後的 `AlertPayloadContract` 物件 — contract/schema/policy 皆不動。**

## 4. 內部 Alert 物件

`domain/src/contracts/alert-contract.ts` `AlertContract`：

```
{ id, source: 'tradingview' | 'manual' | 'simulated',
  symbol, price | null, condition, timeframe | null,
  strategyHint | null, note | null, receivedAt, priority: 'high' | 'normal' | 'low' }
```

生命週期：`received → surfaced | silent_received | suppressed_cooldown | aggregated → engaged | dismissed | expired`。

## 5. Delivery Policy（遞送閘門 — 這是靈魂）

實作：`domain/src/policies/alert-policy.ts` `evaluateAlertDelivery`（純函式，狀態由呼叫端持有）。判定順序：

1. **Feature flag / Tier**：`tradingview_alerts_v1` flag off 或非 Premium → `silent_received`（收錄不打擾）。
2. **Zone 閘門**：當前 Decision Edge Score 落在 **Strain（0-39）** → `silent_received`。UI 僅顯示安靜膠囊「NVDA 快訊（已接收）」，不彈面板、不震動 — 呈現事實，不主動打擾，也不說「不要做」。
3. **Per-symbol cooldown**：同一 symbol `ALERT_COOLDOWN_SEC = 300`（5 分鐘）內只允許一次 surfaced → 期間內 `suppressed_cooldown`。
4. **每日上限**：`ALERT_DAILY_SURFACE_CAP`，超過 → `silent_received`（防快訊轟炸，模式仿 engine edge-detector 的 daily cap）。
5. **聚合**：`ALERT_AGGREGATION_WINDOW_SEC = 60` 內多個 symbol 同時觸發 → `aggregated`，UI 顯示「2 個決策機會：NVDA / TSLA［查看］」。
6. 其餘 → `surfaced`：彈出 Decision Entry Panel。

**✅ 使用者可調（Phase C，2026-07-19）**：上述 3–5 的常數改為可注入 `AlertDeliverySettings`（`createDefaultAlertSettings()` ＝現值，`evaluateAlertDelivery` 未給 settings 時向後相容用預設）。使用者可調：同標的冷卻秒數、每日上限、聚合窗、Strain 靜默（開關，預設開＝保護閘門）、同標的安靜更新（開關）。preview `/decision-alert/` 有設定面板（localStorage 持久，`?v=alert10`）。
- **Quiet window（軟性提示，非閘門）**：`isWithinQuietWindowET`（美東 11:00–14:00，DST-aware）。開啟時該時段快訊面板加事實行「安靜時段」（`QUIET_WINDOW_CONTEXT_ZH`），**不硬靜音**（軟性提示決策 2026-07-18）。

## 6. Decision Entry Panel（快訊觸發當下）

**❌ 不可以**：直接跳 chart、震動轟炸、顯示任何買賣方向詞。
**✅ 正確**：底部 sheet，內容全為事實陳述：

```
NVDA · Breakout · 5m
RS High + Volume Spike

你目前的狀態：Neutral（Decision Edge Score 58）
在此狀態下，你過去的紀律完成率：—（資料累積中）

你要進入決策流程嗎？
[ 進入決策 ]   [ 略過 ]
```

- 狀態行只呈現事實（zone + 分數 + 流程統計），**不給行動建議**（無「適合/不適合進場」措辭）。
- 「你過去的紀律完成率」原為 `—（資料累積中）`，**Phase A 起有值**：由決策收束頁累積的 `localStorage` 歷史算出（見 §9 Result 階段）。
- 統計框架一律流程語言：「紀律完成率」「完成/中斷比」。**禁止**勝率、獲利等結果語言（中文禁用詞已入 compliance 詞庫，見 §10）。
- 「略過」記為 `dismissed`，同樣入紀錄（Ignore 也是資料）。

## 7. 模板建議（建議，不強制）

`packages/engine/src/session/template-suggestion.ts` `suggestTemplateForStrategyHint`：

| `strategyHint` 關鍵字（正規化小寫） | 建議模板（engine `TraderTemplateId`） | 顯示名 |
|--------------------------------|-----------------------------------|--------|
| `canslim` | `CANSLIM`（300s） | Canslim GS 流程 |
| `fbd`、`mancini` | `FBD`（180s） | Mancini 假跌破流程（Failed Breakdown） |
| `high rs`、`mode 2`、`sensitivity` | `MODE_2`（240s） | 高 RS 突破流程（Canslim High RS Breakout） |
| 無匹配 | `null`（不建議，使用者自選） | — |

UI：三模板卡全列，建議者加 ⭐ 高亮；使用者永遠可自由選擇。

> **已定案（founder 2026-07-12）**：顯示名對齊舊 spec 三模板 — Canslim GS 5min / Canslim High RS Breakout 4min / Mancini FBD 3min（時長與 engine 現值完全對應）。命名勘誤：**FBD = Failed Breakdown**（Mancini 招牌 setup：跌破→收復→acceptance），舊名「Follow-By-Discipline」為誤植；**MODE_2 = Canslim High RS Breakout**，舊名「高靈敏控制」為誤譯（Mancini 語境的 Mode 2 另指區間震盪市況，與此模板無關）。ID 為持久化契約維持不動。方法論背景文件（Mancini FBD / level-to-level / Mode 1-2 市況 + Canslim）待 founder 提供 substack 全文後撰於 `docs/TRADING-METHODOLOGY.md`。

## 8. 與決策 session / 浮動計時條整合

- 點「進入決策」→ 走既有 Session Governance 流程（`packages/engine/src/session/`）：state machine `gated → active`，Edge Score 閘門 `evaluateGate` 照常適用（red_gate / force_hold 規則不因快訊來源而豁免）。
- 浮動計時條自動帶入：symbol、建議模板、時間戳；segments 分色與 readiness window 來自 `TRADER_TEMPLATES` 資料。
- **✅ Phase B（2026-07-19）**：計時條隨 elapsed **高亮當前段落標籤**；進入 readiness 窗 → 事實行「Readiness 窗開啟」（強調色，流程語言、非「可進場」建議），離開恢復「目前：<段落>」。early-complete（窗前收束）偵測見 §9。
- **Session 進行中收到新快訊 → 一律靜默接收**（沿用舊 spec「僅觸發，不顯示」的正確直覺）：決策過程不被下一個訊號打斷。
- **✅ 已落地（2026-08-21，preview）**：計時器跑在 `/v3/`、快訊在 `/decision-alert/`，所以「有沒有決策在跑」是**跨頁事實** — 由 `/v3/` 寫 `tenki.v6.activeDecision.v1`（`apps/preview/v6/index.html` `publishActiveDecision()`），`/decision-alert/` 的 `evaluateDelivery` 讀它。🔴 標記**自帶到期時間、寫一次就不更新**：心跳在分頁進背景時會被節流，而背景正是這條規則唯一有用的時候（在桌機／券商 APP 下單）；沒有到期時間則會在標記被留下時靜默吃掉之後每一則快訊。同標的後續觸發累加在標記上，收束時寫進紀錄的 `sameSymbolUpdates`（讀不回標記就寫 `null`＝不知道，不是 `0`）。守門：`scripts/preview-decision-chain.mjs`（開兩個 page）+ `scripts/preview-fdcb.mjs`（自己起跑的決策也算「進行中」）。
- **✅ 決策活得過「離開去下單」（2026-08-21，preview）**：交易者的實體動線是
  「進入決策 → 跳回手機桌面 → 開交易 App 下單 → 再回 TENKI Core」，而 iOS 會把
  standalone web app 清出記憶體 —— 回來時整頁重載，決策原本會連同標記一起蒸發
  （`sess` 只活在記憶體）。現在 `tenki.v6.activeDecision.v1` 是**可續跑的快照**
  （標的／模板／marks／events／awayCount／awayMs／hiddenAtMs），`/v3/` 開頁時
  `resumeActiveDecision()` 接回來，時間一律從 `startedAtMs` 用牆鐘算。
  🔴 **超過上限不是 resume 是收束**（走既有 `endDecision`，寫 `abandoned_no_judgment`
  或 `timed_out`）—— 決策不該憑空消失，也不該假裝還在跑。
  PWA 的 `start_url` 是 `/decision-alert/`，所以那一頁在決策進行中會浮出一條
  **可點的回程橫幅**（標的 + 牆鐘 + 關鍵價位 + 「點一下回到計時器」）。
  橫幅上**沒有判定鍵**：判定只有一份，在 `/v3/`。
  守門：`scripts/preview-decision-chain.mjs`（重載存活 + 橫幅 + 殭屍上限）。
- 未點擊前的最小呈現：底部 bar 顯示 `[ NVDA 快訊 ● ]`；點擊後轉為 `[ CANSLIM ▾  00:00 ● ]`。

## 9. 事件鏈模型（Alert → Decision → 過程 → Result）

**設計**：alert 先於 session 存在，因此不塞進 `SessionEventType`（該枚舉的 process-neutral 詞彙 `mark / add_mark / reduce / close / cancel / no_action` 是刻意的 compliance 設計，維持不動）。改為：

- Alert 自成紀錄（`AlertContract` + 生命週期狀態）。
- 由快訊開啟的 session 在 `SessionRecord` 上帶 `originAlertId`（`packages/engine/src/session/types.ts`）。
- 完整鏈 = alert 紀錄 join session 紀錄：
  `received → surfaced → engaged(originAlertId) → session events(mark/close/…) → outcomeTag`。

這條鏈餵給：狀態歷史統計（紀律完成率）、模板優化、行為分析 — 全部 local-first，僅衍生統計，不含 raw biometric。

**✅ Result 階段已落地（Phase A，2026-07-19）**：計時器結束（close/cancel/timeout）→ **決策收束頁**。
- outcome tag 用 engine process-neutral `OutcomeTag`（`domain/src/policies/decision-outcome.ts` `resolveOutcomeTag`）：
  close+已達 readiness → `stayed_disciplined`；close 但 readiness 窗前 → `broke_discipline`（提前收束）；
  cancel → `broke_discipline`；timeout → `timed_out`。
- 反思微輸入：三選 chip（跟計畫／有點急／偏離計畫）→ `contextTag`，流程語言、**禁 PnL/勝率**。
- 紀律完成率 `summarizeDisciplineRate`＝（`stayed_disciplined`＋`timed_out`）÷ 已收束數，local-first 存 `localStorage`（`tenki.alert.outcomes.v1`）。
- 背景關閉仍記錄（不漏資料，呼應 §6「Ignore 也是資料」）。preview `?v=alert8`；Playwright `shoot-result.mjs` 13 斷言。

## 9b. 結果軸（`tradeResult`）與日界節奏的接線設計

> **狀態**：✅ **A0 / A / B / C 全部已落地**（#218 domain 層；#272 階段 B；
> #273 階段 A 的回填入口；#275 階段 C）。
> ⚠️ 以下那句「**UI 一行都還沒接**」是 2026-09-28 寫的，**已經過期** ——
> 保留原文供對照，但**不要照著它做決定**。
>
> 🔴 **而這份過期狀態本身造成了一次真實的損失**（2026-10-09）：
> founder 實走回報「後面這一段沒有記錄到」，我照這句話判斷成「功能還沒做」，
> 差點重做一次已經存在的東西。真正的問題是另一件事 ——
> 機制全在，但 **`pending` 在 Session 列表上一個字都沒講**，
> 所以他的四筆紀錄看起來全都是完成品（#278 修）。
> **狀態行過期的成本不是「文件不準」，是「下一個人會去修錯的地方」。**
>
> ⚠️ §9 上面那段「Result 階段已落地（Phase A，2026-07-19）」描述的是
> **2026-08-04 語意斷點之前**的 tag（`stayed_disciplined` / `broke_discipline`）。
> 現行語意的 canonical 是 `apps/preview/decision-outcome.js` 的檔頭。
>
> <details><summary>原始狀態行（2026-09-28，已過期）</summary>
>
> > 設計。domain 層已落地（#218），**UI 一行都還沒接**。
> > 所以「第一筆達到目標之後，下一則快訊照樣彈面板」這個實際問題**目前仍然存在**。
>
> </details>

### 🔴 為什麼這是整條路線裡風險最高的一步

現行判定軸**刻意不看結果**。2026-08-04 那次語意斷點做的事，正是把「時間」
（一個結果的代理）從判定裡拿掉：「時間不再進入這個判斷，只作為事實脈絡呈現」。

而 `DomainTradeResult` 問的是結果。**畫面一開口問這個，使用者的注意力就從流程
移到結果上** —— 那正是 `SYSTEM.md` 說這個產品不做的事。

所以結果軸必須在**結構上**從屬，不是靠文件約束。三條硬規則：

1. 🔴 **結果不得改變紀律判定，也不得改變它的顏色。** 判定成立、進場、然後觸及
   保護價 —— 那是 **100% 紀律**。`isDisciplined()` 一個字都不能動。
2. 🔴 **結果不得上語意色。** 一個紅一個綠 ＝ app 在評價你的交易結果。這跟
   `--good` 綠退場、gold 只給 SECURED 是同一條紅線（2026-09-25：**顏色宣稱的
   比文字強**）。結果只用中性字體，零語意色。判準沿用 #259 那句：
   **把顏色全部拿掉，這一列還說得出同一件事嗎？**
3. 🔴 **結果不得聚合。** 不出勝率、期望值、損益。契約檔頭已寫死，但畫面要讓它
   **做不到**，而不是記得不要做。

### 🔴 文案約束：那三個選項不能用自然的交易詞彙

`PROHIBITED_VOCABULARY_ZH`（`packages/engine/src/compliance/safe-copy.ts`）
擋掉 **獲利／虧損／停損／停利**。實測（不是憑印象）：

| 候選 | `findProhibitedTerms` |
|---|---|
| `獲利了結` | **`['獲利']`** ← 不能用 |
| `停損出場` | **`['停損']`** ← 不能用 |
| `達到目標，出場` | `[]` ✅ |
| `觸及保護價，出場` | `[]` ✅ |
| `打平出場` | `[]` ✅ |
| `沒有進場` | `[]` ✅（禁的是「進場訊號」，不是「進場」）|

⚠️ **內部識別字不受此限** —— `profit_taken` / `stopped_out` 是 persisted
contract，照 §10 對「命名 vs 否認」的既有判準處理。

⚠️ 這條約束是**被踩到才發現的**：#218 的 `contextZh` 原本有兩句帶著「獲利」
與「停損」出貨，而該檔的紅線掃描掃的是評價詞、不是合規詞 —— 綠著，看起來像有在守
（2026-09-26 修）。**新增任何 user-facing 字串前，先對 `findProhibitedTerms` 跑一次。**

### 三個結構性發現（每個都改變了做法）

#### ① `no_entry` 不該問 —— 應該推導。四選一其實是三選一

`judged_stood_down`（判定不成立、放棄）與 `no_entry`（結構沒成形而收手）
**描述的是同一件事**。兩個都問，使用者可以答出「判定不成立」＋「達到目標」——
一筆自相矛盾、而且會污染節奏計數的紀錄。

| `outcomeTag` | `tradeResult` | 怎麼來 |
|---|---|---|
| `judged_entered` | 三選一 | **問**（唯一要問的一條路）|
| `judged_stood_down` | `no_entry` | **推導**，不問 |
| `abandoned_no_judgment` | `null` | 不問（契約：不猜）|

一次消掉一整類矛盾，UI 也少一個選項、少一條路徑。

⚠️ **誠實說出邊界**：`abandoned` 的人**可能真的有交易**，我們不知道 → `null`
→ `countsAsTrade` false → 節奏計數會少算。這是刻意選的（契約明訂不猜），
但它是一個真的洞，不要假裝它不存在。

#### ② `evaluateDelivery` 只回**第一個**理由 —— 直接加第四個閘門會讓畫面說謊

`apps/preview/decision-alert.js` 的 `evaluateDelivery()` 是早退 + 單一
`reason` 字串（決策進行中 → Strain → 冷卻）。

**雙輸熔斷與 Strain 同時成立時，使用者只會看到一個** —— 然後學到錯的規則
（「是因為我在 Strain」），而真正攔住他的是他自己的方法論。這是 §6 那個
「畫面宣稱了一件不成立的事」的家族。

**修法**：收集**全部**成立的理由，`decision` 取最強的那個，畫面列出全部。
這是既有函式的改寫，不是新增分支，而且可被 harness 直接驗。

#### ③ 不要硬靜音 —— 這個 repo 自己有先例

Quiet window 當年的裁決是**「面板仍浮出、加一行脈絡，不硬靜音」**（2026-07-18）。
而且靜音是不誠實的：快訊真的來了。

熔斷該做的是**收摺 + 事實行**，要多按一下才展開。摩擦，不是消失。

### 分三階段，順序有理由

| 階段 | 做什麼 | 動哪裡 | 驗收 |
|---|---|---|---|
| **A0** | 契約新增 `pending`（`countsAsTrade` 回 true、`isWin`/`isLoss` 回 false）| `domain/src/contracts/trade-result.ts` | `pending` 算一筆但不是贏也不是輸；`null` 行為不變 |
| **A** | 結果三選一 + 推導 + 「還沒有結果」為預設 | `apps/preview/v6/index.html` 的 `judgeWatch()` 之後 | 紀錄帶 `tradeResult`；**紀律判定與顏色逐位元組不變** |
| **B** | Entry Panel 顯示 `contextZh`（**唯讀，不閘門**）| `decision-alert.js` | 使用者第一次「看見」節奏存在 |
| **C** | 熔斷收摺 + `evaluateDelivery` 多理由改寫 | `decision-alert.js` | 兩個理由同時成立時**兩個都印出來** |

🔴 **順序的理由**：C 需要真實紀錄才有意義。先做 C 的話它永遠觸發不了 ——
沒有人填過結果，`resolveDayCadence` 永遠回 `fresh`，於是你會得到一個
「看起來沒壞」的空功能。這跟 2026-09-25 那條「demo 路徑走不到那一格，
所以它看起來一直是好的」是同一個陷阱。

### 要立的守門

- **鏡射比對**：`day-cadence.ts` 的常數 vs preview 手抄版，照
  `scripts/preview-drift.mjs` 既有做法**逐一比對常數值**。
  這個 repo 為鏡射漂移付過三次學費（同一筆決策，一頁 100%、另一頁 0%）。
- **結果不得上色**：接進 `preview-strip-color` 家族 —— 顏色洗掉之後，
  結果那一列要仍然說得出同一件事。
- **多理由**：兩個靜默理由同時成立 → 斷言兩個都出現。
  反向驗證：改回早退 → 必須紅。
- **文案**：任何新的 user-facing 字串先過 `findProhibitedTerms`。

### ✅ 已裁決：收束當下問，「還沒有結果」是預設（founder 2026-09-28）

> 收束當下問、但**「還沒有結果」是預設且完全正常的選項**，之後可回填。

理由與 CLAUDE.md 的硬規則同源：**量不到就是量不到，不要填一個合理的預設值。**
決策計時器 30 分鐘就收束，而那筆交易可能幾小時後才平倉 —— 逼使用者選一個，
拿到的是捏造的資料，**比沒有更糟**。

#### 🔴 這個裁決逼出一個契約修正：要新增 `'pending'`

對照實際程式碼（`resolveDayCadence`）之後發現的 —— **不改的話整條規則會靜默失效**：

```ts
const todays = records.filter((r) => countsAsTrade(r.tradeResult) && …);
countsAsTrade = (result) => result !== null && result !== 'no_entry';
```

「還沒有結果」如果存成 `null`，`countsAsTrade` 回 false → **那筆紀錄被整個濾掉**
→ 每日額度沒被消耗 → 面板照樣彈。也就是說：**沒有回填的人，這個功能等於不存在，
而且畫面上看不出任何異狀。**

所以 `DOMAIN_TRADE_RESULTS` 要新增 **`'pending'`**，讓三個**真的不同**的狀態各有其值：

| 值 | 意思 | `countsAsTrade` | `isWin` / `isLoss` |
|---|---|---|---|
| `'pending'` | 進場了，**結果還不知道** | **true** | false / false |
| `null` | **連有沒有交易都不知道**（契約前紀錄、`abandoned`）| false | false / false |
| `'no_entry'` | 確定沒進場 | false | false / false |

🔴 **判準沿用契約自己的哲學**：差異必須**跟著值一起走**，因為那正是
「TENKI 可以宣稱什麼／不可以宣稱什麼」的分界。把 `pending` 和 `null` 併成一個值，
就是把「我不知道結果」和「我不知道有沒有交易」當成同一件事。

#### 每個分支都往保守的方向倒（實際推過，不是猜的）

| 今天的紀錄 | `tradesToday` | state | 對不對 |
|---|---|---|---|
| 1 筆 `pending` | 1 | `second_chance` | ✅ 未知 ≠ 贏，第二次機會**保持開著** |
| 2 筆 `pending` | 2 | `day_complete` | ✅ 額度用完是事實；但不宣稱雙輸 |
| `pending` + 觸及保護價 | 2 | `day_complete` | ✅ **不**宣稱一個驗證不了的雙輸 |

**它從不宣稱一個驗證不了的停手點，但確實會消耗額度。**

#### 因此這個功能是逐級降級的，不是全有全無

| 規則 | 需要回填嗎 |
|---|---|
| **每日額度（1–2 筆）** | **不需要** —— `pending` 就算一筆 |
| **贏停 / 雙輸熔斷** | **需要** —— 那兩條必須知道結果才成立 |

⚠️ 所以階段 B 的事實行應該**順便報出「還有 N 筆沒填結果」**（那是事實，不是指示，
而且它正好是回填的入口）。文案記得先過 `findProhibitedTerms`。

⚠️ **回填會讓節奏狀態回溯改變** —— 那是對的（狀態是從紀錄重算出來的），
但代表事實行的內容在回填後會變。不要把它快取成「當天決定一次」。

## 10. Compliance（紅線）

- 英文禁用詞照舊（`packages/engine/src/compliance/safe-copy.ts` `PROHIBITED_VOCABULARY`：trade/buy/sell/win rate/setup…）。
- **新增中文禁用詞** `PROHIBITED_VOCABULARY_ZH`（勝率、買入、賣出、獲利、虧損、停損、停利、進場訊號、出場訊號、交易建議、保證報酬…）— 堵住原檢查器只掃英文的漏洞。
- 本檔 §6 的 panel 文案是 canonical，均通過 `isCompliantCopy`（測試鎖定：`compliance/__tests__/alert-copy.test.ts`）。
- 快訊相關 push 通知（Phase 3）必須過 `notification-guard.ts`。

## 11. 分級與 Dark Launch

- **Premium 功能**：`packages/shared/src/subscription-tiers.ts` `TierFeatures.externalAlertBridge`（free: false / premium: true）。「Pro 訂閱」對外命名對應現有 **Premium** 層 — v3 維持 2-tier，不開第三級。
- **Feature flag**：`tradingview_alerts_v1`（default off、remote-configurable）— dark launch 控制。
- **Entitlement 掛載點（founder 決策 2026-07-12）**：repo 目前無帳號/金流系統，伺服器端驗證不了訂閱狀態 → 現階段 Premium 屬 **client 側標示**（UI badge + tier 旗標）。帳號＋金流（IAP/Stripe）基建上線後，**在 `POST /api/channel` 加一步訂閱資格驗證**即完成伺服器端付費牆 — 頻道是唯一入口，擋住發頻道就擋住整個功能；既有頻道到期自然收斂。
- 隱私控制永不放付費牆後（CLAUDE.md 硬規則）；付費牆只鎖「外部快訊橋接」功能本身。

## 12. Phase Roadmap

| Phase | 內容 | 狀態 / 前置 |
|-------|------|------|
| **v1** | 規格書 + domain contract/schema/policy + engine 模板建議/compliance/連結欄位 + shared flag/tier + `/decision-alert/` preview demo（模擬快訊） | ✅ 已交付 |
| **v1.1（Phase 2 ingestion）** | HTTP 接收薄層（`api/alert.ts`：收 → validate → Upstash 暫存）+ `api/alerts.ts` 裝置輪詢 + `/decision-alert/` 連接真實快訊模式 + `docs/TRADINGVIEW-SETUP.md` | ✅ 已交付 |
| **v1.2（channel 模型）** | 專屬 webhook 連結取代共用 token：`api/channel.ts` 配對端點、per-channel 佇列隔離、零輸入配對 UX、Premium 標示 + entitlement 掛載點（§11） | ✅ 已交付（founder 僅需開通 Upstash） |
| **日界節奏 UI（§9b）** | 結果三選一 → Entry Panel 事實行 → 熔斷收摺 + `evaluateDelivery` 多理由 | ✅ **全部已交付**：domain（#218）、階段 B（#272）、階段 A 回填入口（#273）、階段 C（#275）、`pending` 在列表上可見（#278）。⚠️ 仍有一個**已知缺口**：收束頁的三選一只由**一次性回程票**打開 —— 判定完直接離開就不會在當下被問，只能靠 Session 列表的待填記號回來補 |
| Phase 2 後段 | mobile UI（Decision Entry Panel / 浮動條，用 preview 驗證過的互動移植 apps/mobile） | 待排 |
| **Phase D（Web Push）** | ✅ 手機網頁推播（不用原生 App/Mac）：`api/subscribe.ts` 訂閱端點 + `api/_lib/push.ts`（web-push/VAPID）+ `sw.js`/`manifest.webmanifest` PWA + 連接面板「開啟手機推播」。Safari 關著也跳通知（iOS 16.4+，需加入主畫面 + VAPID env）。設定見 `docs/TRADINGVIEW-SETUP.md §7` | ✅ 已交付（founder 需設 VAPID env + 加入主畫面） |
| Phase 3（原生） | 原生 App 推播（expo-notifications + `tenki://` deep link）+ Watchlist 綁定 + 快訊自動分類 | 需 mobile app + Mac |

## 13. 驗收

- 邏輯層：`bash scripts/verify.sh` 全綠；domain/engine 新模組測試覆蓋（zone 三態、cooldown 邊界、跨日重置、聚合、中文禁詞攔截）。
- Demo：founder 手機實走 `/decision-alert/` — 模擬快訊 → 面板 → 模板 ⭐ → 計時條 → 事件鏈 log；strain 態安靜膠囊；同標的重觸發被冷卻。
