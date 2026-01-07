# TENKI v50.0 — Neural Link (Hybrid Sync)

> Camera First + Wearable Boost：用 **PR99 生理指紋（TEI）** 做交易行為風控。

- Live demo: https://tenki-emotion-app.vercel.app
- MVP 入口：[`index.html`](https://github.com/Poshen100/tenki-emotion-app/blob/main/index.html)

---

## 你現在能做什麼（MVP）

### 1) Real-time：連 Garmin / 胸帶（Web Bluetooth）
1. 用 Chrome / Edge（桌機或 Android）。
2. 打開頁面後，點右上角 **`VISION ONLY`**（可點擊）。
3. 選擇你的裝置（Garmin HR Broadcast、Polar H10 等支援 Heart Rate Service 的 BLE 裝置）。

**Tier 行為（自動切換）**
- Tier 1：若收到 RR-Interval（如部分胸帶），會顯示 `MEDICAL GRADE (RR)`，並以 RR 推 RMSSD。
- Tier 2：若只有 BPM，會顯示 `WEARABLE LINKED`（Hybrid Sync：手錶心率 + 相機）。
- Tier 3：未連線則是相機 rPPG（MVP 以 worker 模擬）。

### 2) Data：Instant Baseline（不用等 7 天）
Dashboard 的 Source 卡片提供 **`Import CSV`**：
- CSV 欄位：`timestamp,rhr,rmssd`
- 建議：匯入 30 天（或至少 10 筆）
- 匯入後會建立 baseline 分佈，掃描後直接輸出 PR（1–99）

可用範例：[`baseline-template.csv`](https://github.com/Poshen100/tenki-emotion-app/blob/main/baseline-template.csv)

---

## 投資人版本（Why this wins）

### 1) 明確的 wedge：把「自控力」產品化
- TENKI 把交易前最難量化的「狀態」變成 PR99（可執行的開關），把抽象情緒管理落到 **行為風控**：何時可以下單、何時鎖單、何時呼吸重置。
- 這不是醫療診斷；是決策流程中的 readiness gate（像飛行前 check-list），天然能嵌入高頻使用場景。

### 2) 分發成本極低：Web-first + 現有穿戴就能跑
- 產品在瀏覽器就能完成 onboarding（無需下載 app），降低 CAC，利於社群/內容帶量與快速迭代。
- Hybrid Sync 同時支援「相機（可用）」與「穿戴（更準）」兩條路徑，避免因設備差異導致轉換掉隊。

### 3) 信任感是核心護城河：隱私感 + 可解釋
- UI 以抽象視覺呈現（星塵/HUD），相機畫面不出現在介面，讓使用者更願意在敏感情境（交易/壓力）下使用。
- 指標鏈路清楚（HR / RMSSD / baseline → PR），比黑盒情緒判斷更容易建立「我為何被鎖單」的信任。

### 4) 可累積的差異化資產：個人化 baseline
- Instant Baseline 用本地 CSV 匯入即可立刻個人化（不用等 7 天），降低冷啟動風險並提升留存。
- 長期可把 baseline 變成「個人狀態指紋」：同一個 PR 代表同一種可交易的生理 readiness，形成可擴展的 scoring 系統。

### 5) 商業化方向（MVP → 收費）
- B2C 訂閱：交易者（心態/風控）+ 進階報告（週/月趨勢、策略觸發回放）。
- B2B：Prop firm / 交易社群的風控層（上線前必過 PR 門檻、團隊健康度儀表板）。

---

## Apple Watch（重要限制）
Apple Watch **不會原生以 BLE HR Broadcast 給瀏覽器**（Web Bluetooth 無法直接抓到 Watch）。

建議路線（符合 spec 的 Hybrid Sync）：
- Real-time 層：讓使用者在 iPhone/Watch 端用轉播 App（例如 HeartCast 類型）把 HR 轉成 BLE Heart Rate Service，再由 TENKI 連線。
- Data 層：改用 Apple Health 匯出（或先轉成 CSV 再匯入）來建立 Instant Baseline。

---

## 本地開發
```bash
git clone https://github.com/Poshen100/tenki-emotion-app.git
cd tenki-emotion-app
# 用任何 static server（避免 file:// 權限問題）
python -m http.server 8080
# 打開 http://localhost:8080
```
