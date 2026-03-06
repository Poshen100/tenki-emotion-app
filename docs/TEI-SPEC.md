# TEI (Total Energy Index) Specification

> **Version**: v2.0
> **Last updated**: 2026-03-06
> **Implementation**: `packages/engine/src/tei.ts`

---

## 1. Core Definition

- **TEI 是 PR99 (1-99)**，不是絕對分數
- TEI_PR = 78 表示當下狀態優於個人歷史樣本中約 78% 的時刻
- 採用 PR 語言，避免跨裝置指標定義差異（RMSSD vs SDNN）

---

## 2. TEI 計算：三維度加權

```
TEI_raw = HR_score × 0.30 + HRV_score × 0.50 + RR_score × 0.20
TEI_PR  = Math.round(percentileRank(TEI_raw, baseline))
```

| 維度 | 權重 | 來源 | 說明 |
|------|------|------|------|
| HR (心率) | 0.30 | BLE / Watch / rPPG | z-score vs baseline |
| HRV (心率變異度) | 0.50 | RMSSD 或 SDNN→RMSSD | 最重要的生理指標 |
| RR (呼吸率) | 0.20 | RSA zero-crossing | 輔助指標 |

> **注意**: PR 計算用 `Math.round`（非 `Math.floor`），避免系統性偏低。

---

## 3. TEI 狀態區間

| PR 區間 | 狀態 | UI 色彩 | 建議 |
|---------|------|---------|------|
| **80-99** | Peak Zone ⚠️ 高能警戒 | 琥珀金 `#F5A623` + 脈衝震動 | 可交易，但需雙重確認（過度自信風險） |
| **55-79** | Optimal Zone ✅ 最佳交易帶 | 青藍 `#00B4D8` | 理想執行區，全功能解鎖 |
| **35-54** | Neutral Zone ⏸️ 中性區 | 淺灰 `#E5E5EA` + 輕微震動 | 僅執行 A+ Setup，倉位 50% |
| **01-34** | Degraded Zone 🔁 低能區 | 深紫 `#5E3A87` + 呼吸引導震動 | 暫停交易，啟動呼吸校準 |

---

## 4. HRV Harmonization

### 4.1 基線系統
- **短期基線 (7 天滾動)**：用於當日 PR 排名計算
- **長期基線 (21 天滾動)**：用於健康趨勢警示
- 各來源獨立建立基線（Garmin RMSSD / Apple SDNN / rPPG）
- TEI 中只看 PR，不看 ms 絕對值 → 消除跨生態差異

### 4.2 冷啟動策略
- 新用戶：7 天建立初始基線，21 天達穩定精度
- 若有穿戴裝置數據 → 瞬間建立 PR99 基線（不用等 7 天）

### 4.3 SDNN → RMSSD 轉換
```
RMSSD_estimated = SDNN × 0.75
```
- Garmin 原生就是 RMSSD，直接使用
- Apple Watch 部分情況提供 SDNN，需轉換

---

## 5. Sensor Fusion Tiers

```
數據信任度排序:
  Tier 1 (最高): BLE 胸帶 RR-interval → 直算 RMSSD
  Tier 2:        Apple Watch / Garmin HealthKit
  Tier 3:        手機 rPPG (眉心ROI → 前額fallback → 臉頰)
```

### 5.1 Fusion Log 欄位
每次掃描必須記錄：
- `source`: `'ble_chest'` | `'watch_healthkit'` | `'rppg_glabella'` | `'rppg_forehead'` | `'rppg_cheek'`
- `confidence`: 0-1
- `sqi_score`: 0-100
- `fallback_reason`: string | null
- `degraded`: boolean

---

## 6. Signal Quality Index (SQI)

- 單一 SQI 指標 + 門檻（不堆 heuristic）
- SQI < threshold → 立即降級 + UI 提示
- 眉心被遮擋 → 提示用戶調整

---

## 7. Score Transition (EWMA)

```
EWMA α = 0.05  (極慢收斂)
new_display = α × new_value + (1 - α) × old_display
```

- 訊息更新間隔：3 秒
- 暖機期：8 秒
- TEI 數字**不從 0 爬升**，首幀直接跳入附近值

---

## 8. Stress Score (Garmin 對齊)

```
Stress = HRV_component × 0.60 + HR_component × 0.40
Scale: 0-100 (Garmin compatible)
```

| 等級 | 範圍 | 說明 |
|------|------|------|
| Low | 0-25 | 放鬆 |
| Medium | 26-50 | 一般 |
| High | 51-75 | 偏高 |
| Very High | 76-100 | 需要休息 |

---

## 9. Implementation Reference

| Module | File | Tests |
|--------|------|-------|
| TEI PR99 | `packages/engine/src/tei.ts` | `tei.test.ts` |
| HRV | `packages/engine/src/hrv.ts` | `hrv.test.ts` |
| Stress | `packages/engine/src/stress.ts` | `stress.test.ts` |
| Baseline | `packages/engine/src/baseline.ts` | `baseline.test.ts` |
| Fusion | `packages/engine/src/fusion.ts` | `fusion.test.ts` |
| SQI | `packages/engine/src/sqi.ts` | `sqi.test.ts` |
| RR | `packages/engine/src/rr.ts` | `rr.test.ts` |
| Types | `packages/engine/src/types.ts` | — |

---

*All TEI zone ranges are finalized and must not be modified.*
