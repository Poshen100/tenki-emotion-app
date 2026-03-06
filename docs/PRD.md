# Product Requirements Document (PRD)

> **Product**: Tenki Core — iOS/Android 訂閱制 App
> **Version**: v2.0 (with FDCB)
> **Last updated**: 2026-03-06

---

## 1. Product Vision

**Tenki Core** = 世界最精準、最專業、最普及的「情緒 + 健康風險指數」即時偵測 App。

- **消費者層面**：每日情緒與壓力自我管理工具
- **專業層面**：金融交易員、運動員、健康場景的生理風控引擎
- **品牌定位**：Decision Infrastructure for Traders — 多裝置、多模態的「生理 + 紀律引擎」
- **設計語言**：iPhone 級極簡、無縫感、星塵靈魂動效（形隨機能）
- **商業模式**：iOS / Android 訂閱制 App
- **OS Layer**：FDCB 讓 TENKI 成為貼在螢幕底部的「自我紀律引擎」

---

## 2. Core Metric: TEI (Total Energy Index)

- TEI 是 **PR99 (1-99)**，不是絕對分數
- TEI_PR = 78 表示當下狀態優於個人歷史樣本中約 78% 的時刻
- 採用 PR 語言，避免跨裝置指標定義差異

### 2.1 TEI 狀態區間

| PR 區間 | 狀態 | UI 色彩 | 交易建議 |
|---------|------|---------|---------|
| **80-99** | Peak Zone ⚠️ | 琥珀金 `#F5A623` | 可交易，但需雙重確認 |
| **55-79** | Optimal Zone ✅ | 青藍 `#00B4D8` | 理想執行區 |
| **35-54** | Neutral Zone ⏸️ | 淺灰 `#E5E5EA` | 僅 A+ Setup，倉位 50% |
| **01-34** | Degraded Zone 🔁 | 深紫 `#5E3A87` | 暫停交易，啟動呼吸校準 |

---

## 3. Subscription Tiers

| Tier | 價格 | 掃描次數 | 功能 |
|------|------|---------|------|
| Free | $0 | 1 次/天 | 基礎 TEI、7 天歷史、靜態建議 |
| Retail | $9/月 | 3 次/天 | 完整 TEI、21 天歷史、Bento 儀表板 |
| Pro | $22/月 | 無限 | 藍牙整合、FDCB 完整功能、Action Dock、CSV 匯出 |

---

## 4. Scan UX Flow

```
[用戶點擊掃描按鈕]
     │
     ▼ (0-2s) ── 暖機期：平靜引導語 + 星塵動效流動
     ▼ (2s)  ── 初步 TEI 數字（粗略精度），UI 標示 "Glimpse"
     ▼ (15s) ── QUICK 快速檢測 (15 組心率)
     ▼ (30s) ── STANDARD 標準分析 (30 組心率)
     ▼ (60s) ── DEEP 深度分析 (60 組心率)，最高精度
     ▼ ────── 結果頁 (FDCB 浮動條始終可見於底部)
```

### 4.1 關鍵 UX 規則

- 分數過渡用 EWMA α=0.05（極慢，不跳動）
- 品質差時**明確降級提示**，不輸出看似合理但錯的數字
- 星塵動效：形隨機能，表情同步回饋
- FDCB 在所有頁面底部永遠可見

---

## 5. Tech Stack

- **Framework**: React Native + Expo (SDK 52+)
- **Native Modules**: Swift (iOS rPPG/ARKit) + Kotlin (Android CameraX)
- **State**: Zustand (scanStore, userStore, fdcbStore)
- **Backend**: Supabase (Auth + Postgres + RLS + Edge Functions)
- **Subscriptions**: RevenueCat
- **Animation**: react-native-reanimated + @shopify/react-native-skia

---

## 6. Key Features

### 6.1 掃描 & TEI
- 漸進式精化掃描 (2s → 15s → 30s → 60s)
- 多模態感測器融合 (BLE > Watch > rPPG)
- SQI 品質門控 + 降級提示

### 6.2 FDCB (Floating Decision Control Bar)
- 永遠浮動在底部的自律紀律引擎
- 6 種預設情境模板 (3 交易 + 3 生活)
- 決策計時 + 事件紀錄 + TEI Bucket 統計
- 詳見 [FDCB-SPEC.md](./FDCB-SPEC.md)

### 6.3 結果頁
- TEI 雙環顯示 (外環 TEI / 內環 HRV)
- Snapshot 區 (HR / HRV / RR / Stress)
- ANS Balance 交感/副交感視覺化
- 詳見 [RESULTS-PAGE-SPEC.md](./RESULTS-PAGE-SPEC.md)

### 6.4 歷史 & 基線
- 7 天短期滾動基線 (PR 排名)
- 21 天長期滾動基線 (趨勢警示)
- 跨裝置 HRV 對齊 (PR 語言統一)

---

## 7. Done = Go Criteria

| 指標 | Pass 條件 |
|------|----------|
| TEI PR99 一致性 | 同組數據 100 次，PR 偏差 < ±1 |
| HRV 跨裝置對齊 | Garmin vs Apple，同用戶 PR 差 < ±5 |
| rPPG HR 準確度 | vs 胸帶 MAE < 3 BPM (靜態) |
| FDCB 狀態機 | IDLE→READY→RUNNING→COMPLETE 全路徑 |
| 冷啟動體驗 | 2 秒內看到數字 |
| 訂閱轉換 | Paywall 正確限制 |

---

*See also: [ANTIGRAVITY.md](../ANTIGRAVITY.md) for complete project spec*
