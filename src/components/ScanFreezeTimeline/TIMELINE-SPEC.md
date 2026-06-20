# Scan 凝固時刻動效規格書 v1.0

> **給 Claude Code / Cursor Agent 的完整動效說明**  
> 對應元件：`src/components/ScanFreezeTimeline/index.tsx`  
> 相依：DESIGN-SYSTEM.md § 5.2、ANTIGRAVITY.md § 11

---

## 一、動效敘事弧 — 為什麼這樣設計

TENKI 的掃描不是「等待畫面」，它是一個**儀式**。

```
使用者按下 Orb
  ↓
[PRESS] 世界靜了一下（Orb 輕微下沉）
  ↓
[SCANNING] 系統開始工作（波紋、粒子加速）
  ↓
[FREEZE] ← 這是魔法節點（80ms 靜默）
  ↓
[REVEAL] 數字從虛空凝固出現（0.5s blur 清晰）
  ↓
[RESULT] 判斷完成（Badge 滑入、Haptic）
```

**為什麼需要 80ms 靜默間隙？**

在 FREEZE 進入前加入 80ms 的「什麼都不發生」，讓使用者的神經系統感知到「停頓」。
這個停頓製造期待感，讓接下來的 blur → clear 更有衝擊力。
類比：魔術師在變魔術前的那個「靜止的一秒鐘」。

---

## 二、逐格時序表

```
ms    0  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4000
         │                                                  │
Orb      ├─[收縮 0.95]──[回彈 1.0]─────────────────────────
         │  300ms         500ms
         │
掃描環   │          ├─────[旋轉 + 脈動]──────[淡出]─────────
         │          500ms                   200ms
         │
靜默     │                            ├──[80ms 什麼都不做]──
         │                            2300ms
         │
blur     │                                 ├──[8→0, 500ms]──
         │                                 2380ms
         │
opacity  │                                 ├──[0→1, 800ms]──
         │                                 2380ms
         │
scale    │                                 ├──[0.88→1, spring]─
         │                                 2380ms
         │
計數器   │                                      ├─[0→83→78]──
         │                                      2530ms (+150ms)
         │
精度條   │                                      ├─[心跳3步]──
         │                                      2530ms
         │
Badge    │                                              ├─[滑入]─
         │                                              3930ms
```

---

## 三、blur 揭露效果 — 技術實作細節

### 目標效果
數字像是從薄霧中「凝固出現」，不是淡入，不是縮放，是**材質感的清晰化**。

### React Native 的 blur 模擬方案

RN 沒有原生 CSS `filter: blur()`，使用多層 ghost 文字疊加模擬：

```
主數字層   (完全清晰，opacity: 1)
 Ghost 1   (偏移 4px, opacity: 0.15 → 0) ← 隨 blur SharedValue 淡出
 Ghost 2   (偏移 2.5px, opacity: 0.10 → 0)
 Ghost 3   (偏移 1.5px, opacity: 0.07 → 0)
 Ghost 4   (偏移 0.5px, opacity: 0.04 → 0)
```

當 `blur.value` 從 8 降到 0 時：
- Ghost 層 opacity 同步從 0.6 → 0
- 視覺上從「暈散」→「清晰」

### iOS 原生方案（更精確，限 iOS）

如果效果不夠理想，可用 `MaskedView` + `BlurView`：

```tsx
import { BlurView } from 'expo-blur';
// intensity: 0-100，對應 blur 8→0
// 用 Animated.Value 控制 intensity
```

---

## 四、數字過衝效果 — 讓數字有重量感

```
目標分數: 78

計數軌跡:
  0 ──────────────────→ 83 → 78
  0ms                 1200ms 1600ms
                        ↑
                     overshoot = target + 5
```

**為什麼要過衝到 83 再彈回 78？**

線性計數讓數字感覺「沒有重量」，像數位時鐘。
過衝讓數字感覺「有慣性」，像類比儀錶的指針。
用戶潛意識感受：這個數字是真實測量出來的，不是系統隨便給的。

---

## 五、精度條心跳填充 — 3 步驟節奏

```
時刻 0ms:   ████████████░░░░░░░░░░   33% (目標的 55%)
時刻 220ms: ████████████████████░░   48% (目標的 80%)
時刻 450ms: ██████████████████████   60% (目標 60%)
                                    ↑ 每步用 spring 動效，有彈跳感
```

每一步代表一批 HRV 樣本進入系統。
使用者看到的是：精度在「呼吸」，不是在「loading」。
心理效果：我的身體數據正在被認真分析。

---

## 六、Haptic Feedback 時序

| 時刻 | 觸感類型 | 強度 | 意義 |
|------|---------|------|------|
| PRESS (0ms) | Impact | Medium | 「我按下去了」確認感 |
| FREEZE→REVEAL (2380ms) | Notification Success | — | 「系統得到結果了」 |
| RESULT Badge (3930ms) | Impact | Light | 「資訊呈現完畢」輕點 |

---

## 七、狀態色變換邏輯

```
Orb glow 顏色跟隨 teiState:
  idle    → cyan   #00E5CC (opacity 0.25, 呼吸)
  press   → cyan   (opacity 0.05, 幾乎消失)
  scanning → cyan  (opacity 0.30, 掃描脈動)
  reveal  → [計算後狀態色] (opacity 0.45, 凝固時最亮)
  result  → [狀態色] (opacity 0.35, 穩定)
```

狀態色切換使用 withTiming 600ms，不用 spring（顏色漸變不適合彈跳）。

---

## 八、Accessibility

```tsx
// Orb 按鈕
accessibilityRole="button"
accessibilityLabel={scanState === 'idle' ? '開始 TEI 掃描' : '掃描進行中'}
accessibilityState={{ busy: scanState === 'scanning' }}
accessibilityHint="點擊後約 2 秒取得初步情緒指數"

// 結果 Badge
accessibilityRole="text"
accessibilityLabel={`TEI 分數 ${score}，狀態 ${stateLabel}，精度 ${precision}%`}

// prefers-reduced-motion:
// 偵測到 reduceMotion 時，跳過所有動效直接顯示結果
import { AccessibilityInfo } from 'react-native';
const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
```

---

## 九、Phase D 精度進化路線

```
2s  → 精度 60%（本文件實作範圍）
30s → 精度 82%（連續掃描升級，精度條第二階段）
60s → 精度 97%（Deep Scan，精度條第三階段）

每個精度升級觸發：
  - 精度條跳動到新百分比
  - 數字微調（更精確的 HRV 分析）
  - 輕微 Haptic (Light)
  - 文字提示：「精度提升至 82%」fade in
```

---

*TENKI Scan Freeze Timeline Spec v1.0*  
*Turn volatility into turning points.*
