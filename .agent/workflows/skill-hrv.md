---
description: HRV analysis reference for Tenki Core development
---

# HRV Signal Processing Skill

## 時域指標 (Time Domain)

| 指標 | 公式 | 正常範圍 | 意義 |
|------|------|---------|------|
| SDNN | std(RR) | 50-100 ms | 整體 HRV |
| rMSSD | sqrt(mean(diff²)) | 20-80 ms | 副交感神經 |
| pNN50 | count(diff>50ms)/total | 10-30% | 心跳變化 |

## 頻域指標 (Frequency Domain)

| 頻段 | 頻率範圍 | 意義 |
|------|---------|------|
| VLF | 0.003-0.04 Hz | 體溫調節 |
| LF | 0.04-0.15 Hz | 交感 + 副交感 |
| HF | 0.15-0.4 Hz | 副交感神經 |

**LF/HF Ratio**:
- < 1.0: 副交感主導 (休息)
- 1.0-2.0: 平衡狀態
- > 2.0: 交感主導 (壓力)

## Tenki 模組使用

```javascript
// 創建模組
const hrv = TENKI_HRV_ADVANCED.create(rppgController);

// 推送 RR 間期 (毫秒)
hrv.pushRR(800);
hrv.pushRR(820);
hrv.pushRR(790);

// 獲取指標
const metrics = hrv.getMetrics(60000); // 60 秒窗口
console.log(metrics.sdnn);     // 45.2
console.log(metrics.rmssd);    // 32.1
console.log(metrics.pnn50);    // 15.3
console.log(metrics.lfHfRatio); // 1.2

// 品質評估
console.log(metrics.quality);  // 0.85
```

## 信號處理流程

1. **帶通濾波**: 0.7-3.0 Hz
2. **峰值檢測**: 使用適應性閾值
3. **RR 間期計算**: 峰到峰時間差
4. **離群值剔除**: Malik Criteria (±20%)
5. **指標計算**: 時域 + 頻域

## 常見問題

| 問題 | 解決方案 |
|------|---------|
| 運動偽影 | `hasMotionArtifact()` 檢測 |
| 光線變化 | 使用 eyebrow ROI 優先 |
| 不規則心跳 | 自動離群值剔除 |
