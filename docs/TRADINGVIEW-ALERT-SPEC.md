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
- **Session 進行中收到新快訊 → 一律靜默接收**（沿用舊 spec「僅觸發，不顯示」的正確直覺）：決策過程不被下一個訊號打斷。
- 未點擊前的最小呈現：底部 bar 顯示 `[ NVDA 快訊 ● ]`；點擊後轉為 `[ CANSLIM ▾  00:00 ● ]`。

## 9. 事件鏈模型（Alert → Decision → 過程 → Result）

**設計**：alert 先於 session 存在，因此不塞進 `SessionEventType`（該枚舉的 process-neutral 詞彙 `mark / add_mark / reduce / close / cancel / no_action` 是刻意的 compliance 設計，維持不動）。改為：

- Alert 自成紀錄（`AlertContract` + 生命週期狀態）。
- 由快訊開啟的 session 在 `SessionRecord` 上帶 `originAlertId`（`packages/engine/src/session/types.ts`）。
- 完整鏈 = alert 紀錄 join session 紀錄：
  `received → surfaced → engaged(originAlertId) → session events(mark/close/…) → outcomeTag`。

這條鏈餵給：狀態歷史統計（紀律完成率）、模板優化、行為分析 — 全部 local-first，僅衍生統計，不含 raw biometric。

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
| Phase 2 後段 | mobile UI（Decision Entry Panel / 浮動條，用 preview 驗證過的互動移植 apps/mobile） | 待排 |
| Phase 3 | 真推播到手機（expo-notifications + `tenki://` deep link）+ Watchlist 綁定 + 快訊自動分類 | Phase 2 後段 |

## 13. 驗收

- 邏輯層：`bash scripts/verify.sh` 全綠；domain/engine 新模組測試覆蓋（zone 三態、cooldown 邊界、跨日重置、聚合、中文禁詞攔截）。
- Demo：founder 手機實走 `/decision-alert/` — 模擬快訊 → 面板 → 模板 ⭐ → 計時條 → 事件鏈 log；strain 態安靜膠囊；同標的重觸發被冷卻。
