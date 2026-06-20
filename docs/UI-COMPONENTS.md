# TENKI UI Components v1.0

> **創意總監設計規格** — 按鈕系統 + 圖示系統 + 全面優化建議  
> **Status**: Canonical. Phase C Mobile 實作參考文件。  
> **Last updated**: 2026-06-20

---

## 0. 設計總評 — 從整體角度看 TENKI

讀完 ANTIGRAVITY v4.1 + BRAND.md + DESIGN-SYSTEM.md，我看到一個**架構清晰、品牌精準**的產品。以下是最關鍵的觀察：

### 現有強項
- Edge Score 引擎設計完整（8 維度、信心區間、閘門邏輯）
- 品牌語言鮮明（Pivotal、Scientific、Calm 三角形非常準確）
- Privacy-first 架構從一開始就內建，不是事後加上去的
- Logo 定案（Wind-Swept Wave）非常適合這個品牌

### 最需要優化的三個層面

| 層面 | 問題 | 優先級 |
|------|------|--------|
| **UI 一致性** | 各元件缺乏統一的互動語言，按鈕與狀態回饋未規範 | 🔴 P0 |
| **Scan 流程** | 最核心的互動缺少視覺張力，2秒初步數字的「揭露時機」未設計 | 🔴 P0 |
| **圖示系統** | 5 個 Tab 圖示風格未統一，20 顆功能 icon 風格待確認 | 🟡 P1 |

---

## 1. 全面優化建議

### 1.1 Scan 頁面 — 最重要的一頁

這是 TENKI 的靈魂，必須是最精緻的一頁。目前架構建議加入：

**問題一：2秒初步數字缺少「期待感建構」**
```
現況: 按下 → 等待 → 數字出現
優化: 按下 → [0.5s Orb 收縮] → [粒子加速旋轉] → [進度弧線開始]
     → [1.5s 模糊數字若隱若現] → [2s 數字「凝固」揭露]
                                        ↑
                              這個0.5s的「凝固感」是魔法時刻
```

**問題二：精度進化缺少「生命感」**
```
精度條不應該是線性填充。
應該像心跳：每次 HRV 樣本進入，精度條「跳動」一下再穩定。
這讓使用者感覺數據是「活的」。
```

**問題三：Signal Quality 視覺化**
```
Finger Heat Zone 的 A/B/C/D/F 等級
應該用顏色漸層而非文字等級：
  A: Cyan 滿格
  B: Cyan 80%
  C: Amber 60%
  D: Amber 30% + 輕微抖動動效
  F: Red + 震動提示
```

### 1.2 Today 頁面 — 「早安，你的身體說...」

**優化方向**：Today 不是儀表板，它是「每日對話的開始」

```
目前設計思路: 展示數據
建議設計思路: 今天的第一句話

範例文案結構:
  ╔══════════════════════════════╗
  ║  上午 9:38                  ║
  ║                              ║
  ║  「你的身體昨晚恢復得不錯。  ║
  ║    現在是專注的好時機。」    ║
  ║                              ║
  ║  Edge Score: 78  [Clear]    ║
  ║  ──────────────────────     ║
  ║  [開始掃描]  [進入 Session] ║
  ╚══════════════════════════════╝

文案由 compliance safe-copy 引擎生成，永遠合規。
```

### 1.3 Tab Bar — Scan 必須「呼吸」

ANTIGRAVITY 第 11.3 節說：「Scan 應該是視覺上最突出的 tab」。
執行建議：

```
其他 4 個 Tab: 細線圖示，未選中時 color-text-faint
Scan Tab: 不是圖示，而是一個小型 Orb
  - 24×24pt 發光圓點
  - 選中時 cyan glow 脈衝
  - 未選中時靜態，但仍保留微光
  - 這讓 Tab Bar 本身就是一個「生命訊號」
```

### 1.4 數字動效 — 讓數據有重量感

```
Edge Score 從 0 計數到結果值（1.2秒）
使用 GSAP countUp，但加入「過衝」效果：
  目標 78 → 數到 83 → 彈回 78
  視覺感：數字有重量，不是輕飄飄地停在那裡

精度% 同理：
  82% → 先到 85% → 回到 82%
```

### 1.5 空白狀態設計 — 首次使用體驗

```
Timeline 空白時:
  不要「No records yet」
  而是: [Scan Orb 小型版] + 「你的第一次掃描，
         將成為你的起點。」
         [開始第一次掃描]

Lab 首次開啟:
  呼吸練習卡片帶有「今天試試這個」的語氣
  不是功能清單，是輕柔邀請
```

---

## 2. 按鈕系統 — 完整規格

### 2.1 按鈕層級架構

```
L1 Primary    → 唯一最重要行動（每個畫面只能一個）
L2 Secondary  → 次要行動
L3 Ghost      → 不強調的選項（取消、返回、跳過）
L4 Danger     → 破壞性行動（刪除、強制重置）
L5 State      → 狀態切換（Tab switch、Toggle）
L6 Icon-only  → 工具列動作（設定、返回、分享）
```

### 2.2 Primary Button — 「開始掃描」等級

```css
/* L1 Primary — Tenki Cyan 實色，每畫面限一個 */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 52px;                      /* 比最小 44pt 多 8pt，給旗艦動作更多份量 */
  padding: 0 28px;
  border-radius: 14px;               /* 介於 pill 和方形之間的精密感 */
  background: #00E5CC;
  color: #080A0E;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  border: none;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: transform 150ms cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1),
              background 150ms ease;

  /* 靜態時的 glow */
  box-shadow: 0 0 20px oklch(from #00E5CC l c h / 0.25),
              0 2px 8px oklch(0 0 0 / 0.3);
}

/* Ripple 效果層 */
.btn-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at var(--ripple-x, 50%) var(--ripple-y, 50%),
    oklch(1 0 0 / 0.2) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 300ms ease;
}

.btn-primary:hover {
  background: #00F5DB;               /* 比 primary 亮 5% */
  box-shadow: 0 0 32px oklch(from #00E5CC l c h / 0.4),
              0 4px 16px oklch(0 0 0 / 0.3);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: scale(0.96) translateY(0);
  box-shadow: 0 0 12px oklch(from #00E5CC l c h / 0.2);
}

.btn-primary:active::after { opacity: 1; }

.btn-primary:disabled {
  background: #243042;
  color: #4A5668;
  box-shadow: none;
  cursor: not-allowed;
}

/* 帶圖示的版本 */
.btn-primary .btn-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
```

### 2.3 Secondary Button — 「Deep Scan」等級

```css
/* L2 Secondary — 透明底 + cyan 邊框 */
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 48px;
  padding: 0 24px;
  border-radius: 12px;
  background: transparent;
  color: #00E5CC;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 500;
  border: 1px solid oklch(from #00E5CC l c h / 0.35);
  cursor: pointer;
  transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-secondary:hover {
  background: oklch(from #00E5CC l c h / 0.08);
  border-color: oklch(from #00E5CC l c h / 0.6);
  box-shadow: 0 0 16px oklch(from #00E5CC l c h / 0.15);
}

.btn-secondary:active {
  transform: scale(0.97);
  background: oklch(from #00E5CC l c h / 0.12);
}

.btn-secondary:disabled {
  color: #4A5668;
  border-color: #243042;
  cursor: not-allowed;
}
```

### 2.4 Ghost Button — 「跳過」等級

```css
/* L3 Ghost — 幾乎不可見，讓使用者不想點 */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  padding: 0 16px;
  border-radius: 10px;
  background: transparent;
  color: #8A99B0;                    /* text-muted */
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  border: none;
  cursor: pointer;
  transition: color 150ms ease, background 150ms ease;
}

.btn-ghost:hover {
  color: #E8EDF5;
  background: oklch(from #E8EDF5 l c h / 0.06);
}

.btn-ghost:active { transform: scale(0.98); }
```

### 2.5 Danger Button — 「刪除數據」等級

```css
/* L4 Danger — 破壞性行動，紅色但不嚇人 */
.btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 48px;
  padding: 0 24px;
  border-radius: 12px;
  background: oklch(from #EF4444 l c h / 0.12);
  color: #EF4444;
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 500;
  border: 1px solid oklch(from #EF4444 l c h / 0.25);
  cursor: pointer;
  transition: all 180ms ease;
}

.btn-danger:hover {
  background: oklch(from #EF4444 l c h / 0.2);
  border-color: oklch(from #EF4444 l c h / 0.4);
}

.btn-danger:active { transform: scale(0.97); }
```

### 2.6 Scan Trigger — 特殊等級（非一般按鈕）

```css
/* 這是 Scan Orb 的點擊目標，不繼承任何按鈕樣式 */
/* 尺寸、動效見 DESIGN-SYSTEM.md 的 scan-orb 規格 */
/* 這裡只補充 touch target 的無障礙包裝 */
.scan-trigger {
  /* 無任何視覺樣式 — 視覺完全由 StardustOrb canvas 負責 */
  display: flex;
  align-items: center;
  justify-content: center;
  /* touch target 至少 88×88pt（旗艦互動加倍）*/
  min-width: 88px;
  min-height: 88px;
  border-radius: 50%;
  background: transparent;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  /* Haptic feedback 由 React Native Haptics API 處理 */
}

.scan-trigger:focus-visible {
  outline: 2px solid oklch(from #00E5CC l c h / 0.5);
  outline-offset: 8px;
}
```

### 2.7 React Native 按鈕元件

```tsx
// packages/shared/src/components/Button.tsx
import { Pressable, Text, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  label,
  icon,
  onPress,
  disabled = false,
  loading = false,
  haptic = 'light',
}: ButtonProps) => {

  const handlePress = async () => {
    if (haptic !== 'none') {
      await Haptics.impactAsync(
        haptic === 'light'  ? Haptics.ImpactFeedbackStyle.Light  :
        haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium :
                              Haptics.ImpactFeedbackStyle.Heavy
      );
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
    >
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text style={[styles.label, styles[`label_${variant}`], styles[`label_${size}`]]}>
        {loading ? '...' : label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 8,
  },
  // Sizes
  size_sm: { height: 36, paddingHorizontal: 14 },
  size_md: { height: 48, paddingHorizontal: 22 },
  size_lg: { height: 56, paddingHorizontal: 28, borderRadius: 16 },
  // Variants
  primary:   { backgroundColor: '#00E5CC' },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(0,229,204,0.35)' },
  ghost:     { backgroundColor: 'transparent' },
  danger:    { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' },
  // Label colors
  label_primary:   { color: '#080A0E', fontWeight: '600' },
  label_secondary: { color: '#00E5CC', fontWeight: '500' },
  label_ghost:     { color: '#8A99B0', fontWeight: '400' },
  label_danger:    { color: '#EF4444', fontWeight: '500' },
  // Label sizes
  label_sm: { fontSize: 13 },
  label_md: { fontSize: 15 },
  label_lg: { fontSize: 16 },
  // States
  pressed:  { transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.4 },
  iconWrapper: { width: 18, height: 18 },
});
```

---

## 3. 圖示系統 — TENKI Icon Language

### 3.1 圖示設計語言

| 原則 | 規格 | 原因 |
|------|------|------|
| **線條風格** | 1.5px stroke，rounded cap & join | 精密但不冷硬 |
| **尺寸** | 20×20px（標準）/ 24×24px（Tab）/ 16×16px（badge） | 三級尺寸系統 |
| **ViewBox** | 0 0 24 24（統一） | 方便縮放 |
| **顏色** | currentColor（繼承父層色彩） | 一份 SVG 適配所有狀態 |
| **Fill vs Stroke** | 選中狀態 fill + stroke，未選中僅 stroke | 清晰的狀態區分 |

### 3.2 五個 Tab 圖示 — SVG 完整規格

```svg
<!-- TAB 1: Today（今日）— 太陽升起地平線 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="24" height="24">
  <!-- 地平線 -->
  <line x1="3" y1="16" x2="21" y2="16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <!-- 太陽半圓 -->
  <path d="M7 16 A5 5 0 0 1 17 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <!-- 光線 — 4道，對稱 -->
  <line x1="12" y1="9"  x2="12" y2="7"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="16.2" y1="10.8" x2="17.6" y2="9.4"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="7.8"  y1="10.8" x2="6.4"  y2="9.4"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="18.5" y1="14" x2="20.5" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="5.5"  y1="14" x2="3.5"  y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>

<!-- TAB 2: Scan（掃描）— 選中狀態：發光圓（用 Orb 替代圖示，見 1.3節）-->
<!-- 未選中時的靜態圖示：帶波紋的圓 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="24" height="24">
  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/>
  <path d="M12 4 A8 8 0 0 1 20 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
  <path d="M12 20 A8 8 0 0 1 4 12"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
  <!-- 十字準星 -->
  <line x1="12" y1="2.5" x2="12" y2="5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="12" y1="18.5" x2="12" y2="21.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="2.5" y1="12" x2="5.5" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="18.5" y1="12" x2="21.5" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>

<!-- TAB 3: Session（專注）— 沙漏（時間+專注感） -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="24" height="24">
  <!-- 沙漏外框 -->
  <path d="M6 3 H18 L13.5 9.5 L18 16 H6 L10.5 9.5 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- 沙漏頂蓋 -->
  <line x1="5" y1="3" x2="19" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <!-- 沙漏底蓋 -->
  <line x1="5" y1="21" x2="19" y2="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <!-- 底部沙堆（半填充表示進行中） -->
  <path d="M8 19 Q12 17 16 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
</svg>

<!-- TAB 4: Timeline（歷史）— 帶節點的時間線 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="24" height="24">
  <!-- 垂直時間線 -->
  <line x1="8" y1="4" x2="8" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <!-- 三個節點 -->
  <circle cx="8" cy="6"  r="2" fill="currentColor"/>
  <circle cx="8" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="8" cy="18" r="2" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
  <!-- 橫向內容條 -->
  <line x1="12" y1="6"  x2="20" y2="6"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="12" y1="12" x2="18" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
  <line x1="12" y1="18" x2="16" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
</svg>

<!-- TAB 5: Lab（實驗室）— 燒瓶 + 泡泡 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="24" height="24">
  <!-- 燒瓶頸 -->
  <path d="M9 3 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="10" y1="3" x2="10" y2="9" stroke="currentColor" stroke-width="1.5"/>
  <line x1="14" y1="3" x2="14" y2="9" stroke="currentColor" stroke-width="1.5"/>
  <!-- 燒瓶體 -->
  <path d="M10 9 L5.5 18 A1 1 0 0 0 6.4 19.5 H17.6 A1 1 0 0 0 18.5 18 L14 9 Z"
        stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- 液面線 -->
  <path d="M7 16 Q12 14.5 17 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
  <!-- 泡泡 -->
  <circle cx="10" cy="17.5" r="1" fill="currentColor" opacity="0.6"/>
  <circle cx="13" cy="16.5" r="0.8" fill="currentColor" opacity="0.4"/>
</svg>
```

### 3.3 功能圖示清單 — 20 顆核心 Icon

```svg
<!-- ICON 01: 設定（Settings）— 六邊形齒輪 -->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" stroke-width="1.5"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.5"/>
</svg>

<!-- ICON 02: 通知（Bell）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>

<!-- ICON 03: 心率（Heart Rate / HRV）— 心電圖波形 -->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polyline points="2,12 6,12 8,6 10,18 13,10 15,14 17,12 22,12"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- ICON 04: 呼吸（Breathing）— 肺葉輪廓 -->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- 氣管 -->
  <line x1="12" y1="3" x2="12" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <!-- 左肺 -->
  <path d="M12 10 C12 10 7 12 6 16 C5 19 7 21 9 20 C11 19 12 16 12 13"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- 右肺 -->
  <path d="M12 10 C12 10 17 12 18 16 C19 19 17 21 15 20 C13 19 12 16 12 13"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- ICON 05: 趨勢（Trend）— 上升折線 + 底部面積 -->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polyline points="3,17 9,11 13,14 21,6"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="17,6 21,6 21,10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- ICON 06: 分享（Share）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="18" cy="5" r="3" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="18" cy="19" r="3" stroke="currentColor" stroke-width="1.5"/>
  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>

<!-- ICON 07: 關閉（Close / X）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>

<!-- ICON 08: 返回（Back Arrow）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polyline points="15,18 9,12 15,6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- ICON 09: 勾選（Check / Done）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- ICON 10: 用戶（Profile）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>
  <path d="M4 20 C4 16 7.58 13 12 13 C16.42 13 20 16 20 20"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>

<!-- ICON 11: 鎖（Lock / Privacy）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/>
  <path d="M8 11 V7 A4 4 0 0 1 16 7 V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
</svg>

<!-- ICON 12: 閃電（Edge / Ready）— 狀態 clear 的輔助圖示 -->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polyline points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- ICON 13: 暫停（Pause）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6"  y="4" width="4" height="16" rx="1.5" fill="currentColor"/>
  <rect x="14" y="4" width="4" height="16" rx="1.5" fill="currentColor"/>
</svg>

<!-- ICON 14: 播放（Play / Resume）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 5 L20 12 L8 19 Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
</svg>

<!-- ICON 15: 資訊（Info）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
  <line x1="12" y1="16" x2="12" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="12" cy="8.5" r="0.75" fill="currentColor"/>
</svg>

<!-- ICON 16: 日曆（Calendar）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
  <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5"/>
  <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>

<!-- ICON 17: 星星（Favorite / Premium）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
           stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- ICON 18: 重置（Reset / Refresh）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M23 4v6h-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>

<!-- ICON 19: 加號（Add / New）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>

<!-- ICON 20: 音樂音符（Binaural Beats / Sound）-->
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- 音符 -->
  <path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="6"  cy="18" r="3" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.5"/>
</svg>
```

### 3.4 圖示使用規則

```tsx
// packages/shared/src/components/Icon.tsx
import { Svg, Path, Line, Circle, Polyline, Rect, Polygon } from 'react-native-svg';

interface IconProps {
  name: TENKIIconName;
  size?: 16 | 20 | 24;
  color?: string;
  style?: object;
}

// 所有圖示必須通過此元件渲染，不可直接用 SVG 字串
// 原因：確保 accessibilityLabel 一致，確保 dark/light mode 色彩正確

// 使用範例:
// <Icon name="hrv" size={20} color={colors.primary} />
// <Icon name="settings" size={24} />  // 自動繼承 currentColor
```

---

## 4. Tab Bar 完整設計

### 4.1 視覺規格

```css
.tab-bar {
  height: calc(56px + env(safe-area-inset-bottom));
  background: var(--color-surface);  /* #0D1117 */
  border-top: 1px solid var(--color-divider);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-bottom: env(safe-area-inset-bottom);

  /* 毛玻璃效果（iOS 原生感）*/
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  background: oklch(from #0D1117 l c h / 0.85);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 44px;   /* touch target */
  padding: 6px 0;
  position: relative;
  transition: color 200ms ease;
}

/* 一般 Tab */
.tab-item-icon    { color: #4A5668; }   /* text-faint，未選中 */
.tab-item-label   { font-size: 10px; font-weight: 500; letter-spacing: 0.03em; color: #4A5668; }

/* 選中狀態 */
.tab-item.active .tab-item-icon  { color: #00E5CC; }
.tab-item.active .tab-item-label { color: #00E5CC; }

/* 選中指示點 */
.tab-item.active::before {
  content: '';
  position: absolute;
  top: 0;
  width: 20px;
  height: 2px;
  border-radius: 0 0 2px 2px;
  background: #00E5CC;
  box-shadow: 0 0 8px oklch(from #00E5CC l c h / 0.5);
}

/* Scan Tab 特殊處理 — 中央發光 Orb */
.tab-scan {
  position: relative;
}

.tab-scan-orb {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: radial-gradient(circle, #00E5CC 0%, #00B8A3 60%, transparent 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -20px;   /* 讓 Orb 突出 Tab Bar 上方 */
  box-shadow: 0 0 20px oklch(from #00E5CC l c h / 0.4),
              0 -4px 16px oklch(from #00E5CC l c h / 0.2);
  animation: scan-tab-pulse 3s ease-in-out infinite;
}

@keyframes scan-tab-pulse {
  0%, 100% { box-shadow: 0 0 20px oklch(from #00E5CC l c h / 0.4); }
  50%       { box-shadow: 0 0 32px oklch(from #00E5CC l c h / 0.65); }
}

/* Scan Tab Orb 內的圖示 */
.tab-scan-orb svg { color: #080A0E; }  /* 深色圖示，對比 cyan 背景 */
```

### 4.2 Tab Bar React Native 元件

```tsx
// apps/mobile/components/TabBar.tsx
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';

export const TENKITabBar = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();

  const tabs = [
    { key: 'today',    label: '今日',    icon: 'today'    },
    { key: 'scan',     label: 'Scan',    icon: 'scan',     isScanTab: true },
    { key: 'session',  label: 'Session', icon: 'session'   },
    { key: 'timeline', label: '歷史',    icon: 'timeline'  },
    { key: 'lab',      label: 'Lab',     icon: 'lab'       },
  ];

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      {tabs.map((tab, index) => {
        const isActive = state.index === index;
        if (tab.isScanTab) {
          return (
            <Pressable
              key={tab.key}
              style={styles.scanTab}
              onPress={() => navigation.navigate(tab.key)}
              accessibilityLabel="開始掃描"
              accessibilityRole="tab"
            >
              <View style={[styles.scanOrb, isActive && styles.scanOrbActive]}>
                <Icon name="scan" size={22} color="#080A0E" />
              </View>
            </Pressable>
          );
        }
        return (
          <Pressable
            key={tab.key}
            style={styles.tabItem}
            onPress={() => navigation.navigate(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            {isActive && <View style={styles.activeBar} />}
            <Icon
              name={tab.icon}
              size={22}
              color={isActive ? '#00E5CC' : '#4A5668'}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: 'rgba(13,17,23,0.92)',
    borderTopWidth: 1,
    borderTopColor: '#1E2A38',
    alignItems: 'flex-end',
  },
  tabItem:      { flex: 1, alignItems: 'center', paddingBottom: 6, gap: 4, position: 'relative' },
  tabLabel:     { fontSize: 10, fontWeight: '500', color: '#4A5668', letterSpacing: 0.3 },
  tabLabelActive: { color: '#00E5CC' },
  activeBar:    { position: 'absolute', top: 0, width: 20, height: 2, borderRadius: 2, backgroundColor: '#00E5CC' },
  scanTab:      { flex: 1, alignItems: 'center', paddingBottom: 6 },
  scanOrb:      {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#00E5CC', alignItems: 'center', justifyContent: 'center',
    marginBottom: 4, marginTop: -16,
    shadowColor: '#00E5CC', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  scanOrbActive: { shadowOpacity: 0.65, shadowRadius: 20 },
});
```

---

## 5. 優先實作清單

按優先級排序，對應 ANTIGRAVITY Phase C：

| 優先級 | 元件 | 對應 Phase |
|--------|------|------------|
| P0 🔴 | Button 元件（Primary/Secondary/Ghost/Danger） | Phase C |
| P0 🔴 | Tab Bar + Scan Orb Tab | Phase C |
| P0 🔴 | 5 個 Tab 圖示 SVG | Phase C |
| P1 🟡 | 20 顆功能 Icon 元件化 | Phase C |
| P1 🟡 | State Badge（Clear/Neutral/Strain） | Phase C |
| P1 🟡 | HRV 波形元件 | Phase C |
| P2 🟢 | 精度漸進揭露動效 | Phase C 後期 |
| P2 🟢 | Today 頁面「第一句話」文案框架 | Phase C 後期 |

---

*TENKI UI Components v1.0 — 創意總監 × Perplexity AI*  
*Turn volatility into turning points.*
