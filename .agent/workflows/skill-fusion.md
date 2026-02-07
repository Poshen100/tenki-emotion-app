---
description: Multi-modal fusion reference for Tenki Core
---

# Multi-Modal Fusion Skill

## 預設權重

| 模態 | 權重 | 原因 |
|------|------|------|
| HRV (rPPG) | 60% | 客觀生理指標 |
| 面部表情 | 30% | 行為表現 |
| 穿戴裝置 | 10% | 補充資料 |

## 動態權重調整

```python
# 邏輯虛擬碼
if hrv_quality < 0.3:
    hrv_weight -= 70%
    expression_weight += 56%

if face_visibility < 0.3:
    expression_weight -= 80%
    hrv_weight += 72%

if device_only_reliable:
    device_weight = 60%
```

## 降級模式

| 模式 | 條件 | 信心度 |
|------|------|--------|
| `FULL` | 所有模態可用 | 高 |
| `HRV_EXPRESSION` | 無穿戴裝置 | 高 |
| `HRV_ONLY` | 僅生理信號 | 中 |
| `EXPRESSION_ONLY` | 僅表情 | 中 |
| `DEVICE_ONLY` | 僅穿戴裝置 | 中 |
| `HISTORICAL` | 無即時資料 | 低 |

## Tenki 模組使用

```javascript
// 創建融合控制器
const fusion = TENKI_FUSION.create({
    hrvModule: hrv,
    facsModule: facs,
    deviceModule: null  // 可選
});

// 計算融合分數
const result = fusion.computeFusion();
console.log(result.score);        // 0.72 (0-1)
console.log(result.teiEquivalent); // 72 (1-99)
console.log(result.confidence);   // 0.85
console.log(result.mode);         // 'hrv_expression'

// 各模態貢獻
console.log(result.components.hrv.score);    // 0.8
console.log(result.components.hrv.weight);   // 0.6
console.log(result.components.hrv.quality);  // 0.9
```

## 品質評估

```javascript
const state = fusion.getState();
console.log(state.quality.hrv);        // 0.9
console.log(state.quality.expression); // 0.7
console.log(state.quality.device);     // 0.0

const interpretation = fusion.getInterpretation();
console.log(interpretation.icon);    // '💚'
console.log(interpretation.message); // 'Camera-based analysis • Good condition'
```

## 歷史基準

當所有模態都不可用時，使用歷史資料：

```javascript
if (fusion.mode === 'historical') {
    const baseline = fusion.getHistoricalBaseline();
    // 使用最近 10 次有效結果的平均值
}
```
