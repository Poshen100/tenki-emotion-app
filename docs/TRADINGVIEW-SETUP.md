# TradingView Premium → TENKI 快訊接線指南（founder 操作手冊）

> **給誰看**：founder（一次性部署設定）與任何要配對 TradingView 的使用者。
> **行為規格**：`docs/TRADINGVIEW-ALERT-SPEC.md`（本檔只講「怎麼設定」）。
> **端點程式**：`api/channel.ts`（配對）+ `api/alert.ts`（接收）+ `api/alerts.ts`（手機頁輪詢）。
> v1.2 起採**專屬連結（channel）模型**：不用帳號、不用輸入任何密碼 — 頁面自動產生你的私人 Webhook 連結。

---

## 1. 一次性部署設定（founder，只有一步）

**開通儲存**：Vercel dashboard → 專案 `tenki-emotion-app` → **Storage** → Create → **Upstash Redis**（Marketplace，免費層即可）→ Connect to project → Redeploy 一次。連好後 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`（或 KV_ 命名）自動注入。

> 沒開通時所有端點會回明確的 500 訊息（不會靜默壞掉）。舊版的 `ALERT_INGEST_TOKEN` 已不再使用，設了也不會被讀。

## 2. 配對（使用者，零輸入）

1. 手機開 `https://tenki-emotion-app.vercel.app/decision-alert/`。
2. 點「**連接 TradingView**」→「**產生我的專屬連結**」— 系統生成一條不可猜測的私人通道，連結記在這台裝置的瀏覽器裡。
3. 點「**複製連結**」。⚠️ 連結本身就是你的通道憑證，**勿公開分享**；外洩時點「重設連結」換新的。
4. 頁面開著就會自動接收（每 10 秒輪詢），不用再按任何東西。

## 3. 在 TradingView 建 alert（每條約 1 分鐘，純手機可完成）

> 勘誤（founder 截圖實證 2026-07-12）：**手機 app 也有 Webhook URL** — alert 編輯 →「通知」分頁
> → 勾「Webhook URL」。web/桌面版位置相同。全流程（產生連結 → 貼 webhook → 貼 message）
> 不需要開電腦。

1. 圖表開 **Alert** 對話框（手機：編輯 alert →「通知」分頁），Condition 照你的策略設。
2. **勾 Webhook URL**，貼上剛複製的專屬連結（形如 `https://tenki-emotion-app.vercel.app/api/alert?ch=一長串英數`）。
3. **「訊息」欄位**貼 JSON 模板（`{{...}}` 是 TradingView 變數，送出時自動代入）：
   ```json
   {"symbol":"{{ticker}}","price":{{close}},"condition":"Breakout","timeframe":"{{interval}}","strategy":"CANSLIM","note":"{{exchange}}:{{ticker}} {{time}}"}
   ```

   ⚠️ **既有 alert 一定要改 message**：預設訊息是純文字（例：「ES1! 下穿 6,851.00」）—
   **不是 JSON，TENKI 會回 400 擋掉、不會入鏈**。把訊息欄整段換成上面的 JSON 模板才會通。
4. 儲存。觸發後 1–10 秒內手機頁浮出 Decision Entry Panel。

**兩個實戰註記（founder 實測 2026-07-13）**：
- **通知設定會自動沿用**：建新 alert 時，Webhook URL 勾選與網址會沿用上一條 — 存檔前掃一眼即可。
  ⚠️ 但如果你在 TENKI 點過「重設連結」，**所有舊 alert 的 webhook 都還指向已失效的舊頻道**，要逐條更新。
- **觸發頻率建議「僅觸發一次」**：level 類 alert 用重複觸發模式，價格在關鍵位附近震盪時會對
  原生推播與頻道灌重複資料（實測幾分鐘內 9+ 筆同價位）。TENKI 端有 5 分鐘冷卻擋浮出，但沒必要製造噪音；
  「僅觸發一次」觸發後手動重啟即可。

### Level 類 alert（如 ES1! 的關鍵價位下穿/上穿）建議填法

- `condition` 填 `Level Break`（或 `Level Cross`）— 語意是「價格進入計畫區域」，不是 setup 成形
  （見 `docs/TRADING-METHODOLOGY.md` §7：快訊 = step 2 的鈴聲，結構確認在 step 3）。
- `strategy` 填 `Mancini` → TENKI 會 ⭐ 建議「Mancini 假跌破流程」模板。

### `condition` / `strategy` 怎麼填（手填語意標籤）

- `condition`：情境描述（`Breakout` / `Reclaim` / `FBD` / `Fake Move`…），原樣顯示在面板。
- `strategy`：對應模板建議的關鍵字（大小寫不拘）：

| `strategy` 填入 | TENKI 建議模板 |
|----------------|---------------|
| `CANSLIM`（含 `Canslim GS`） | Canslim GS 流程（5 分鐘） |
| `FBD` 或 `Mancini` | Mancini 假跌破流程（3 分鐘） |
| `High RS` 或 `Mode 2` | 高 RS 突破流程（4 分鐘） |
| 其他 / 留空 | 不建議，自由選 |

## 4. Premium 額度的建議用法

- Premium：**400 價格 + 400 技術 alert、永不過期、秒級間隔** — 夠把整個自選清單鋪滿。
- **每標的一條、觸發設 Once Per Bar Close**：K 棒內反覆穿越不轟炸；TENKI 端另有同標的 5 分鐘冷卻與每日上限雙保險。
  （現實對照：原生推播沒有這層 — founder 實測同一 level 反覆穿越，8 分鐘內連發 4 則相同推播。
  走 TENKI 通道的差異就在這：同標的冷卻、Strain 靜默、聚合，訊號被節流成決策節奏。）
- 快訊條件寫「值得進入決策流程」的等級 — TENKI 的定位是把訊號轉成有節奏的決策，不是更快的行情推播。

## 5. 測試

- **正式**：merge 後 production URL 直接走一遍（TradingView alert 設成必觸發條件）。
- **Preview 分支**：preview 部署有 protection，TradingView 不能帶自訂 header → 需在 Vercel 開 Protection Bypass for Automation，webhook URL 再附 `&x-vercel-protection-bypass=<bypass密鑰>`。
- **不碰 TradingView 的乾測**（把 `ch=` 換成你頁面產生的連結裡那串）：
  ```bash
  curl -X POST 'https://tenki-emotion-app.vercel.app/api/alert?ch=你的頻道id' \
    -H 'content-type: text/plain' \
    -d '{"symbol":"NVDA","price":128.5,"condition":"Breakout","timeframe":"5m","strategy":"CANSLIM"}'
  ```
  回 `{"ok":true,"id":"..."}` 即通；手機頁 10 秒內浮出面板。打不存在的頻道會回 404。
- **肉眼檢查頻道內容**：瀏覽器直接開 `https://tenki-emotion-app.vercel.app/api/alerts?ch=你的頻道id&since=0`
  （把專屬連結的 `alert?` 改成 `alerts?` 加 `&since=0`），會回 JSON 列出頻道內所有快訊 — 驗證 webhook
  是否真的進來最快的方法。

## 6. 界線與模型（避免誤解）

- **這功能定位為 Premium**（`externalAlertBridge`，Free 層無）。目前無帳號/金流系統，屬 client 側標示；帳號＋金流上線後在 `/api/channel` 加訂閱資格驗證即完成付費牆（SPEC §11）。
- TradingView **沒有**公開使用者資料 API：watchlist、圖表版面拉不進來；webhook alert 是唯一官方通道。
- 頻道未使用 30 天自動過期（有在輪詢就不會）；快訊暫存每頻道 50 筆、24 小時過期；內容只有市場符號/價格/條件文字，與生理資料完全隔離（cloud-minimal 不受影響）。
- 推播到手機（不開網頁也收到）是 Phase 3，需要 mobile app 原生基建。
