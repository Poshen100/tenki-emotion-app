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

## 這份程式碼的優點（為什麼很適合 v50）

### Hybrid Sync 的工程優點
- **單頁可跑**：整個 MVP 用一個 `index.html` 就能完成 demo/迭代，利於快速 A/B 與上線回圈。
- 可漸進升級：同時支援 Tier 3（Camera rPPG 模擬）與 Tier 1/2（Web Bluetooth 心率），不會因穿戴裝置缺席就卡住產品體驗。
- BLE 解析已到位：內建 Heart Rate Service / `heart_rate_measurement` 的 parsing，且能從 RR-Interval 推 RMSSD（當裝置提供時）。

### UX / 設計優點
- 隱私感強：相機 video element 直接藏到畫面外（`top:-9999px`），畫面只呈現抽象的「星塵宇宙」與 HUD，避免「真臉上鏡」造成阻抗。
- 新手不迷路：掃描採用「Hold to Sync」的儀式化交互 + 進度圈，並把 BLE 連線入口放在狀態膠囊（`VISION ONLY` 可點）。
- 儀表板資訊密度高但仍可讀：TEI/PR 主數字 + Zone + HR/RMSSD + confidence bar，一眼就能決策。

### 架構優點（可持續演進）
- Local-first baseline：baseline 直接存在 `localStorage`，匯入後可立刻算 PR，符合「不用等 7 天」的產品承諾。
- 視覺/演算解耦：rPPG 目前用 worker 模擬，後續可無痛替換成真 rPPG / 更完整 HRV pipeline，而不必重做 UI。
- 行動端友善：有 `viewport-fit=cover` 與 safe-area padding，iPhone 全螢幕下不會被劉海/底部手勢條吃掉。

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
