# TEI (Total Energy Index) Specification

## Core Metric Definition
- **TEI 是 PR99 (1-99)**，不是絕對分數。
- TEI_PR = 78 表示當下狀態優於個人歷史樣本中約 78% 的時刻。

## HRV Harmonization
- **短期基線 (7 天滾動)**：用於當日 PR 排名計算。
- **長期基線 (21 天滾動)**：用於健康趨勢警示。
- 獨立建立來源基線（Garmin, Apple, rPPG），只對比 PR。

## Sensor Fusion
1. Tier 1: BLE 胸帶 RR-interval
2. Tier 2: Apple Watch / Garmin HealthKit
3. Tier 3: 手機 rPPG (眉心ROI → 前額 → 臉頰)
