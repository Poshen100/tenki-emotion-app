# TradingView Premium → TENKI 快訊接線指南（founder 操作手冊）

> **給誰看**：founder（一次性部署設定 + 之後每條 alert 的建立方式）。
> **行為規格**：`docs/TRADINGVIEW-ALERT-SPEC.md`（本檔只講「怎麼設定」）。
> **端點程式**：`api/alert.ts`（接收）+ `api/alerts.ts`（手機頁輪詢）。

---

## 1. 一次性部署設定（Vercel dashboard，約 3 分鐘）

1. **開通儲存**：Vercel dashboard → 專案 `tenki-emotion-app` → **Storage** → Create → **Upstash Redis**（Marketplace，免費層即可）→ Connect to project。連好後 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`（或 KV_ 命名）會自動注入環境變數。
2. **設定共享密鑰**：Settings → **Environment Variables** 新增：
   - Name：`ALERT_INGEST_TOKEN`
   - Value：自訂一串長亂數（例如密碼產生器出 32 字元；這串會出現在 webhook URL 與手機頁輸入框）
   - Environment：Production（要在 preview 測就 Preview 也勾）
3. 重新 deploy 一次讓 env 生效（Deployments → Redeploy）。

> 沒做這兩步時 endpoint 會回明確的 500 訊息（不會靜默壞掉）。

## 2. 在 TradingView 建一條 alert（每條約 1 分鐘）

⚠️ Webhook URL 欄位在 **web/桌面版** alert 對話框才有（手機 app 建的 alert 也會沿用已設定的 webhook）。

1. 圖表上開 **Alert** 對話框（鬧鐘 icon）。
2. Condition 照你的策略設（價格突破、指標交叉…）。
3. **Notifications 分頁 → 勾 Webhook URL**，貼上：
   ```
   https://tenki-emotion-app.vercel.app/api/alert?token=你的ALERT_INGEST_TOKEN
   ```
4. **Message 欄位**貼 JSON 模板（`{{...}}` 是 TradingView 變數，送出時自動代入）：
   ```json
   {"symbol":"{{ticker}}","price":{{close}},"condition":"Breakout","timeframe":"{{interval}}","strategy":"CANSLIM","note":"{{exchange}}:{{ticker}} {{time}}"}
   ```
5. 儲存。觸發後 1–2 秒內快訊就會出現在手機頁。

### `condition` / `strategy` 怎麼填（手填語意標籤）

- `condition`：這條 alert 的情境描述（`Breakout` / `Reclaim` / `FBD` / `Fake Move`…），會原樣顯示在 Decision Entry Panel。
- `strategy`：對應 TENKI 模板建議的關鍵字（大小寫不拘）：

| `strategy` 填入 | TENKI 建議模板 |
|----------------|---------------|
| `CANSLIM`（含 `Canslim GS`） | CANSLIM 流程（5 分鐘） |
| `FBD` 或 `Mancini` | 紀律跟隨模式（3 分鐘） |
| `High RS` 或 `Mode 2` | 高靈敏控制（4 分鐘） |
| 其他 / 留空 | 不建議，自由選 |

## 3. 手機端連線

1. 手機開 `https://tenki-emotion-app.vercel.app/decision-alert/`。
2. 點「**連接真實快訊**」→ 輸入同一串 token → 連線（token 記在瀏覽器，下次免輸）。
3. 頁面每 10 秒輪詢一次；只收連線之後的新快訊，不回放歷史。
4. 之後就是規格書的流程：Strain 狀態靜默、同標的 5 分鐘冷卻、60 秒窗聚合、進入決策 → 模板 → 計時條。

## 4. Premium 額度的建議用法

- 額度：**400 價格 + 400 技術 alert、永不過期、秒級間隔** — 夠把整個自選清單鋪滿。
- **每標的一條、觸發設 Once Per Bar Close**：K 棒內反覆穿越不會轟炸；TENKI 端另有同標的 5 分鐘冷卻與每日上限雙保險。
- 快訊條件寫「值得進入決策流程」的等級，不是每個 tick — TENKI 的定位是把訊號轉成有節奏的決策，不是更快的行情推播。

## 5. 測試

- **正式（建議）**：merge 到 main 後直接用 production URL 走一遍（用 TradingView alert 對話框的「測試」或把條件設成必觸發）。
- **Preview 分支要測 webhook**：preview 部署有 protection，TradingView 不能帶自訂 header → 在 Vercel 開 Protection Bypass for Automation，webhook URL 再附 `&x-vercel-protection-bypass=<bypass密鑰>`。
- **不碰 TradingView 的乾測**：
  ```bash
  curl -X POST 'https://tenki-emotion-app.vercel.app/api/alert?token=***' \
    -H 'content-type: text/plain' \
    -d '{"symbol":"NVDA","price":128.5,"condition":"Breakout","timeframe":"5m","strategy":"CANSLIM"}'
  ```
  回 `{"ok":true,"id":"..."}` 即通；手機頁 10 秒內浮出面板。

## 6. 界線（避免誤解）

- TradingView **沒有**公開使用者資料 API：watchlist、圖表版面、指標數值都拉不進來；webhook alert 是唯一官方通道。
- 快訊暫存只有 symbol/價格/條件文字，50 筆上限、24 小時自動過期；與生理資料完全隔離（cloud-minimal 不受影響）。
- 推播到手機（不開網頁也收到）是 Phase 3，需要 mobile app 原生基建。
