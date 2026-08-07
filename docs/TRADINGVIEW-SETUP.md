# TradingView Premium → TENKI 快訊接線指南（founder 操作手冊）

> **給誰看**：founder（一次性部署設定）與任何要配對 TradingView 的使用者。
> **行為規格**：`docs/TRADINGVIEW-ALERT-SPEC.md`（本檔只講「怎麼設定」）。
> **端點程式**：`api/channel.ts`（配對）+ `api/alert.ts`（接收）+ `api/alerts.ts`（手機頁輪詢）。
> v1.2 起採**專屬連結（channel）模型**：不用帳號、不用輸入任何密碼 — 頁面自動產生你的私人 Webhook 連結。

---

## 1. 一次性部署設定（founder，兩步）

**① 開通儲存**：Vercel dashboard → 專案 `tenki-emotion-app` → **Storage** → Create → **Upstash Redis**（Marketplace，免費層即可）→ Connect to project → Redeploy 一次。連好後 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`（或 KV_ 命名）自動注入。

> 沒開通時所有端點會回明確的 500 訊息（不會靜默壞掉）。舊版的 `ALERT_INGEST_TOKEN` 已不再使用，設了也不會被讀。

**② 開 Protection Bypass for Automation**：Settings → **Deployment Protection** → 捲到 **Protection Bypass for Automation** → **Add Secret** → Save → Redeploy 一次。

> ### ⚠️ 沒做這一步，快訊會**完全靜默地**收不到
>
> 本專案的 Vercel Authentication（SSO）目前是 `all_except_custom_domains`，而專案底下
> **沒有任何自訂網域** —— 也就是說 `tenki-emotion-app.vercel.app`（正式站）和所有分支 preview
> **全部都在保護牆後面**。TradingView 是匿名 POST、又不能帶自訂 header，於是在 **edge 就被擋掉**，
> 請求根本不會進到 `/api/alert`。
>
> 這個失敗模式最惡毒的地方是它**不留痕跡**：Vercel runtime log 裡看不到任何 4xx/5xx（因為函式沒被叫到），
> TENKI 頁面照樣顯示「接收中」（那是本頁自己的輪詢，帶著你的登入 cookie，當然會通），
> TradingView 那邊也顯示 alert 已觸發。三邊都說「正常」，快訊就是不見。
> **2026-08-05 實例**：ES1! alert 有觸發、有推播，六小時 runtime log 只有 `GET /api/alerts`，
> `POST /api/alert` 零筆。
>
> 密鑰存在後，`/api/channel` 會自動把 `&x-vercel-protection-bypass=…` 烤進頁面產生的 webhook 連結
> ——**不用手貼**，但既有的舊連結要回頁面重新複製一次。
>
> 密鑰在網址裡＝看得到螢幕的人就拿得到。截圖分享那條連結時**要連 `ch=` 一起遮掉**（本來就該遮）。
>
> 若之後改用自訂網域，這一步就不再必要（自訂網域不受 SSO 保護），但留著也無害。

**驗證有沒有設好**：`/decision-alert/` → 連接 TradingView → 按「**測試這條連結**」。
它會用 TradingView 的身分（`credentials: 'omit'`，不帶你的登入 cookie）打一次自己的 webhook URL，
當場回答通或不通 —— 不寫入任何快訊。這是唯一能在「等下一根 K 棒」之前確認接線的方法。

## 2. 配對（使用者，零輸入）

1. 手機開 `https://tenki-emotion-app.vercel.app/decision-alert/`。
2. 點「**連接 TradingView**」→「**產生我的專屬連結**」— 系統生成一條不可猜測的私人通道，連結記在這台裝置的瀏覽器裡。
3. **填「標的」欄位**（預設 `ES1!`，可改；週期/策略可選）— 頁面會**即時把欄位烤進網址**，你複製到的就是含 `&symbol=` 的完整可用連結（治「裸連結漏 symbol → 400」的坑，見 §4a）。標的留空會顯示黃色警示。
4. 點「**複製連結**」。⚠️ 連結本身就是你的通道憑證，**勿公開分享**；外洩時點「重設連結」換新的（換連結後 webhook 要重貼）。
5. 頁面開著就會自動接收（每 10 秒輪詢），不用再按任何東西。

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

#### ⭐ 乾淨模式（推薦）：結構化欄位走 URL、訊息只留純人話

**問題**：TradingView 自家鎖屏推播會**原樣顯示整段 message**。只要 message 含 JSON，推播就有代碼感
（hybrid/note-first 只能讓第一行乾淨，整則展開仍看得到 JSON）。

**解法**：把 `symbol`/`condition`/`strategy` 這些**靜態**欄位（一標的一 alert，建立時就知道）搬進
**Webhook URL 的查詢參數**（推播看不到 URL），訊息欄則**只留純人話**。這樣鎖屏推播零代碼、
又保留了 TradingView 的通知。

1. **Webhook URL** 在專屬連結後面接參數（`symbol` 填實際代碼 — TradingView 不會展開 URL 裡的 `{{}}`）：
   ```
   https://tenki-emotion-app.vercel.app/api/alert?ch=你的頻道id&symbol=ES1!&condition=Level Break&strategy=Mancini
   ```
2. **「訊息」欄位**只寫純人話（可含 `{{close}}` 顯示價格）：
   ```
   ES1! 下穿 {{close}} · 離高點太近，不參與。等誘空+收回
   ```
   → 鎖屏推播顯示：`ES1! 下穿 7553.00 · 離高點太近，不參與。等誘空+收回`（**零大括號、零代碼**）。
   → TENKI：`symbol`/`condition`/`strategy` 取自 URL、整句訊息當 `note` 顯示在面板。

- 結構化欄位以 URL 為準，訊息文字自動成為 note（本身就是你的計畫句子）。
- 徹底無代碼的終局仍是 TENKI 原生推播（Phase 3）；乾淨模式是在那之前最接近的體驗。

#### §4a 頁內「快訊網址產生器」（`?v=alert13` 起）— 別再手拼 URL

`decision-alert.js` 的「連接 TradingView」區塊有**標的/週期/策略**輸入框（標的預設 `ES1!`）。
你填什麼，頁面就**即時把 `&symbol=`／`&timeframe=`／`&strategy=` 烤進上方那條 URL**，欄位存這台瀏覽器。
所以「複製連結」拿到的**已經是含 symbol 的完整可用連結** —— 貼進 TradingView 即可，不用自己在尾巴補參數。

> **為什麼加這個**：`symbol` 是 schema 必填（`domain/src/schemas/alert-schema.ts`）。過去「複製連結」只吐
> `?ch=…` 裸連結，貼上後 TradingView 送來缺 `symbol` → **400 被擋**（founder 2026-07 實機兩度踩到）。
> 產生器把欄位烤進 URL，源頭消滅這個坑；標的留空時頁面顯示黃色警示提醒。

#### §4b 頻道預設 symbol（server 端回填，雙保險）

產生器頁面填了「標的」後，會**把它綁成該頻道的 server 端預設 symbol**（`POST /api/channel?ch=<ch>` +
`{symbol}`，存 `tenki:chsym:v1:<ch>`，30 天滑動 TTL）。於是**即使 TradingView 那條 webhook 是裸的
`?ch=…`（漏了 `&symbol=`）**，`/api/alert` 也會自動回填這個預設 symbol → **200、正常入鏈、推播照送**，
不再 400。query 有明給 `symbol` 時仍以明給為準（明給優先）。

> 這是「裸連結漏 symbol」的**根治**：產生器（§4a）從 UI 端避免，頻道預設 symbol 從 server 端兜底 ——
> 兩層都補，founder 就算哪天又貼了舊的裸連結也不會再壞。實作：`api/channel.ts`（綁定）+ `api/alert.ts`
> （回填）+ `api/_lib/store.ts`（`set/getChannelSymbol`）。

#### 進階/相容：JSON 或 hybrid 寫法

純 JSON（§3 步驟 3）與「人話前綴 + 換行 + JSON」永遠有效 —— 既有 alert 不必重貼。差別只在
TradingView 原生推播的觀感：JSON 模式推播含代碼，乾淨模式零代碼。TENKI 面板兩者都是人話。

```
離高點太近，不參與。等誘空+收回
{"symbol":"{{ticker}}","price":{{close}},"condition":"Watch Only","timeframe":"{{interval}}","strategy":"Mancini"}
```
（hybrid：前綴勿含 `{`、JSON 放最後；接收端取「第一個 `{` 到最後一個 `}`」。）

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

- **先按「測試這條連結」**（§1 末）。沒過就不用等 K 棒了 —— 十之八九是 §1 ② 沒做。
- **正式站與 preview 一視同仁**：SSO 是 `all_except_custom_domains` 且無自訂網域，所以
  `tenki-emotion-app.vercel.app` 跟分支 preview **一樣需要** §1 ② 的 bypass 密鑰。
  （舊版本檔誤寫成「只有 preview 分支要」，2026-08-05 因此浪費了一整輪除錯 —— 已更正。）
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

## 7. 手機推播（Web Push，關掉網頁也收得到）

不用原生 App、不用 Mac —— iOS 16.4+ 的「網頁推播」即可做到 Safari 關著也跳通知。前置兩步（一次性）：

**A. Vercel 環境變數（founder，只做一次）**
在 Vercel → Project → Settings → Environment Variables 加三個，然後 Redeploy：
- `VAPID_PUBLIC_KEY` — 公鑰（已內建於前端 `decision-alert.js`；env 需填同一把，供伺服器簽章）。
- `VAPID_PRIVATE_KEY` — 私鑰（**機密，不入 repo**；由 Claude 私訊提供，只貼進 Vercel env）。
- `VAPID_SUBJECT` — `mailto:你的信箱`（省略則用預設）。
> 沒設這三個也不會壞：webhook 照常存快訊，只是不送推播（best-effort，優雅降級）。

**B. 手機端（使用者，一次性）**
1. Safari 開 `/decision-alert/` → 分享鈕 → **加入主畫面**（iOS Web Push 只在主畫面 App 生效）。
2. 從主畫面打開該 App → 連接面板 → **🔔 開啟手機推播** → 允許通知。
3. 之後即使關掉，ES1! 觸發 → webhook → 存頻道 → **伺服器主動推播** → 手機跳通知；點通知開回決策面板。

- 推播內容只有事實（symbol · condition · 你的備註），**無買賣指令**，過 `notification-guard` 精神。
- 訂閱存每頻道最多 5 個裝置、隨頻道 30 天 TTL；死掉的 endpoint（404/410）自動修剪。
- 端點：`POST /api/subscribe?ch=`（存訂閱）、`DELETE`（移除）。
