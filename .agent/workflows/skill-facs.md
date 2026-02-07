---
description: FACS facial expression analysis reference for Tenki Core
---

# FACS Expression Analysis Skill

## Action Units (Ekman FACS)

| AU | 名稱 | 肌肉 | 檢測方法 |
|----|------|------|---------|
| AU1 | 內眉上揚 | Frontalis (內側) | 眉毛與眉心距離 |
| AU2 | 外眉上揚 | Frontalis (外側) | 眉毛外側高度 |
| AU4 | 皺眉 | Corrugator | 眉毛間距 |
| AU5 | 眼睛睜大 | Levator | 上眼瞼高度 |
| AU6 | 臉頰上提 | Orbicularis | 臉頰 Y 座標 |
| AU12 | 嘴角上揚 | Zygomaticus | 嘴角 Y 座標 |
| AU15 | 嘴角下垂 | Depressor | 嘴角 Y 座標 |
| AU25 | 嘴唇分開 | Depressor | 上下唇距離 |
| AU26 | 下巴下垂 | Masseter | 下巴與鼻子距離 |

## 情緒映射

| 情緒 | AU 組合 | 權重 |
|------|--------|------|
| 😊 快樂 | AU6 + AU12 | 高 |
| 😢 悲傷 | AU1 + AU4 + AU15 | 中 |
| 😠 憤怒 | AU4 + AU5 + AU7 | 中 |
| 😲 驚訝 | AU1 + AU2 + AU5 + AU26 | 高 |
| 😨 恐懼 | AU1 + AU2 + AU4 + AU5 | 低 |
| 🤢 厭惡 | AU9 + AU15 + AU17 | 低 |

## Tenki 模組使用

```javascript
// 創建追蹤器
const facs = TENKI_FACS.create();

// 推送 FaceMesh landmarks (468 點)
facs.pushFrame(landmarks);

// 獲取 AU 數值
const aus = facs.getAUValues();
console.log(aus.AU12); // 0.7 (嘴角上揚強度)

// 獲取情緒機率
const emotions = facs.getEmotions();
console.log(emotions.happy);   // 0.72
console.log(emotions.neutral); // 0.18

// 獲取主導情緒
const dominant = facs.getDominantEmotion();
console.log(dominant.emotion); // 'happy'
console.log(dominant.confidence); // 0.72

// 微表情檢測
const micro = facs.detectMicroExpressions();
if (micro.length > 0) {
    console.log('偵測到微表情:', micro[0].au, micro[0].change);
}
```

## 融合輸出

```javascript
const fusionOutput = facs.getFusionOutput();
// {
//   valence: 0.6,    // -1 (負面) 到 1 (正面)
//   arousal: 0.3,    // 0 (平靜) 到 1 (激動)
//   stress: 0.2,     // 0 (放鬆) 到 1 (壓力)
//   dominant: 'happy'
// }
```

## 校準

首 20 幀用於建立 **中性基線**，之後的 AU 數值都是相對於基線的偏差。

```javascript
// 強制重新校準
facs.recalibrate();
```
