# TEI (Total Energy Index) Specification

> ⚠️ **本文件為精簡摘要。完整定義見 [ANTIGRAVITY.md](../ANTIGRAVITY.md) — Section 1.1-1.2 (TEI Definition), Section 2.4-2.5 (Sensor Fusion & HRV Harmonization)。**
> **工程實作見 `packages/engine/src/tei.ts`, `hrv.ts`, `baseline.ts`, `fusion.ts`。**

## Core Metric Definition
- **TEI 是 PR99 (1-99)**，不是絕對分數。
- TEI_PR = 78 表示當下狀態優於個人歷史樣本中約 78% 的時刻。
- 三維度加權：HR (0.30) + HRV (0.50) + RR (0.20)
- 採用 PR 語言，避免跨裝置指標定義差異（RMSSD vs SDNN）

## 狀態區間（已定案，不可修改）

| PR 區間 | 狀態 | UI 色彩 | 交易建議 |
|---------|------|---------|---------|
| 80-99 | PEAK ⚠️ | `#F5A623` | 可交易，雙重確認 |
| 55-79 | OPTIMAL ✅ | `#00B4D8` | 理想執行區 |
| 35-54 | NEUTRAL ⏸️ | `#E5E5EA` | 僅 A+ Setup |
| 01-34 | DEGRADED 🔁 | `#5E3A87` | 暫停交易 |

## HRV Harmonization
- **短期基線 (7 天滾動)**：用於當日 PR 排名計算。
- **長期基線 (21 天滾動)**：用於健康趨勢警示。
- 獨立建立來源基線（Garmin, Apple, rPPG），只對比 PR。
- Apple Watch SDNN → RMSSD 轉換：`RMSSD ≈ SDNN × 0.75`

## Sensor Fusion Priority
1. **Tier 1**: BLE 胸帶 RR-interval → 直算 RMSSD（confidence: 1.0）
2. **Tier 2**: Apple Watch / Garmin HealthKit（confidence: 0.8）
3. **Tier 3**: 手機 rPPG — 眉心ROI → 前額 → 臉頰（confidence: 0.4-0.6）

## SQI Gating
- SQI < 40 → 降級 + UI 提示
- 品質差時降級，不輸出看似合理但錯的數字

## 新用戶冷啟動
- 7 天建立初始基線，21 天達穩定精度
- 若有穿戴裝置數據 → 瞬間建立 PR99 基線
- 冷啟動期間 PR 預設 50（中性）
