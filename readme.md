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
Dashboard 的 Source 卡片提供 **`Import Baseline (CSV)`**：
- CSV 欄位：`timestamp,rhr,rmssd`
- 建議：匯入 30 天（或至少 10 筆）
- 匯入後會建立 baseline 分佈，掃描後直接輸出 PR（1–99）

可用範例：[`baseline-template.csv`](https://github.com/Poshen100/tenki-emotion-app/blob/main/baseline-template.csv)

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
