# RESULTS-PAGE-SPEC.md — TENKI Results Page 完整工程規格書

> **Model**: Claude Opus 4.6 (`claude-opus-4-6`)
> **Target**: `apps/mobile/app/results.tsx` + 子元件群
> **Parent Spec**: ANTIGRAVITY.md v2.0
> **Visual Reference**: `tenki_optimal_zone_garmin_connected__2_.png` (已鎖定設計)
> **Version**: v4.2 FINAL

---

## 0. READ THIS FIRST — 你的任務

你要在 `apps/mobile/` 中建立完整的 **Results Page**。
這是 TENKI App 掃描完成後的核心結果畫面。

**此頁面做三件事**：
1. 漸進式顯示 TEI 分數（EWMA 極慢收斂，醫療級平滑）
2. 展示 Garmin 對齊的生理指標 Bento Dashboard
3. FDCB 永遠浮動在底部

**設計已鎖定**，不可自行發揮。完全依照本規格書實作。

---

## 1. 檔案結構

```
apps/mobile/
├── app/
│   └── results.tsx                    # Expo Router 頁面入口
├── components/
│   ├── results/                       # ★ 本次建立
│   │   ├── ResultsScreen.tsx          # 頂層容器 (ScrollView + FDCB overlay)
│   │   ├── StardustBackground.tsx     # 星塵星雲背景 (Skia)
│   │   ├── ScanBadge.tsx             # "✦ DEEP SCAN · 60s" pill
│   │   ├── SourceStrip.tsx           # Garmin + rPPG 來源晶片列
│   │   ├── TeiRing.tsx              # ★ 雙環 TEI 主圖 (Skia)
│   │   ├── TeiNumber.tsx            # ★ 金屬漸層數字 (MaskedView)
│   │   ├── ZonePill.tsx             # Zone 狀態膠囊
│   │   ├── CoachCard.tsx            # 教練提示卡
│   │   ├── BioCard.tsx              # 通用生理指標卡片
│   │   ├── HrvBadge.tsx             # Garmin HRV Status 膠囊
│   │   ├── StressBar.tsx            # Garmin Stress 0-100 進度條
│   │   ├── Sparkline.tsx            # 即時滾動波形圖 (Skia)
│   │   ├── BodyBatteryChart.tsx     # ★ Go Club 圓角柱狀圖
│   │   ├── AnsBalance.tsx           # 交感/副交感平衡條
│   │   ├── SignalQuality.tsx        # SQI 等級 + Fusion chips
│   │   ├── ActionButtons.tsx        # 三按鈕 + 洞察卡
│   │   └── TrendChart.tsx           # 7 天 TEI 趨勢線 (Skia)
│   └── fdcb/                         # (已定義於 ANTIGRAVITY.md)
│       └── FloatingBar.tsx
├── hooks/
│   ├── useProgressiveScan.ts         # ★ 漸進掃描 + EWMA 引擎
│   ├── useHeartbeatSync.ts           # ★ 心跳同步脈動
│   └── useGarminData.ts             # Garmin Connect 數據橋接
├── stores/
│   └── scanStore.ts                  # Zustand: 掃描結果狀態
└── constants/
    └── results-theme.ts              # 結果頁設計 Token
```

---

## 2. 設計 TOKEN — `results-theme.ts`

```typescript
// apps/mobile/constants/results-theme.ts

export const RESULTS_THEME = {
  // ═══ 裝置 ═══
  screen: { width: 393, height: 852 },  // iPhone 16 Pro
  contentPadding: 20,
  contentWidth: 353, // 393 - 20*2

  // ═══ 色彩系統 ═══
  colors: {
    bg: '#000000',
    card: '#1C1C1E',
    cardBorder: 'rgba(255,255,255,0.05)',
    cardHighlight: 'rgba(255,255,255,0.06)',  // 卡片頂部 1px 光澤

    text1: '#FFFFFF',
    text2: '#AEAEB2',
    text3: '#8E8E93',
    text4: '#636366',
    text5: '#48484A',
    text6: '#3A3A3C',

    hr: '#FF453A',
    hrv: '#34C759',
    rr: '#00B4D8',
    stress: '#34C759',     // 低壓力時
    stressHigh: '#FF453A',

    garminSync: '#34C759',
    garminOffset: '#F5A623',
  },

  // ═══ TEI 光譜漸層 ═══
  spectrum: {
    optimal: ['#00F5FF','#4361EE','#7B2FF7','#FF006E','#FF6B35','#F5A623'],
    peak:    ['#00D4AA','#F5A623','#FF6B35','#FF006E','#FF453A'],
    neutral: ['#636366','#8E8E93','#C7C7CC'],
    degraded:['#3A0CA3','#5E3A87','#7B2FF7'],
  },

  // ═══ TEI 數字金屬漸層 ═══
  teiGradient: {
    colors: ['#FFFFFF','#D1D1D6','#8E8E93'],
    locations: [0, 0.4, 1],
  },

  // ═══ Zone 定義 ═══
  zones: {
    peak:     { range:[80,99], emoji:'⚠️', name:'Peak Zone',     zh:'高能警戒',  color:'#F5A623', bg:'rgba(245,166,35,0.06)',  border:'rgba(245,166,35,0.16)' },
    optimal:  { range:[55,79], emoji:'✅', name:'Optimal Zone',  zh:'理想執行區', color:'#00B4D8', bg:'rgba(0,180,216,0.06)',   border:'rgba(0,180,216,0.16)' },
    neutral:  { range:[35,54], emoji:'⏸️', name:'Neutral Zone',  zh:'中性區',    color:'#8E8E93', bg:'rgba(142,142,147,0.06)', border:'rgba(142,142,147,0.16)' },
    degraded: { range:[1,34],  emoji:'🔁', name:'Degraded Zone', zh:'低能區',    color:'#5E3A87', bg:'rgba(94,58,135,0.06)',   border:'rgba(94,58,135,0.16)' },
  },

  // ═══ Body Battery 柱色 ═══
  bodyBattery: {
    high:   { range:[65,100], top:'#34C759', bottom:'#1A6B2E' },
    medium: { range:[40,64],  top:'#00B4D8', bottom:'#0E5A6F' },
    low:    { range:[25,39],  top:'#F5A623', bottom:'#8A5E14' },
    crit:   { range:[5,24],   top:'#FF6B35', bottom:'#7A3318' },
  },

  // ═══ 尺寸 ═══
  ring: { size: 220, outerR: 102, innerR: 80, outerStroke: 5, innerStroke: 3 },
  bentoGap: 10,
  cardRadius: 18,

  // ═══ 動畫參數 ═══
  animation: {
    ewmaAlpha: 0.05,           // EWMA 平滑係數 (極慢)
    updateIntervalMs: 350,     // 指標更新頻率
    ringTransitionMs: 1200,    // 環弧動畫時長
    ringEasing: [0.25, 0.1, 0.25, 1],  // cubic-bezier
    scoreTransitionMs: 300,    // 數字過渡
    sparklineWindow: 40,       // 波形圖數據點數
    bbStaggerBase: 1200,       // BB 柱 stagger 基礎延遲
    bbStaggerStep: 80,         // BB 每根柱額外延遲
    bbBounce: [0.34, 1.56, 0.64, 1],  // overshoot spring
    completeFlash: 800,        // 完成閃爍
    revealStagger: 100,        // 區塊入場 stagger
  },
} as const;
```

---

## 3. 核心引擎 — `useProgressiveScan.ts`

### 3.1 漸進掃描狀態機

```
Phase 0: WARMUP   (0-2s)   → 無數字, UI 顯示 "--", 星塵流動
Phase 1: GLIMPSE  (2-4s)   → 初步 TEI 出現 (精度低, 噪聲大)
Phase 2: QUICK    (4-17s)  → 15 組心率, EWMA 收斂中
Phase 3: STANDARD (17-32s) → 30 組心率, 精度提升
Phase 4: DEEP     (32-62s) → 60 組心率, 鎖定, 最高精度
```

### 3.2 EWMA 計算

```typescript
// hooks/useProgressiveScan.ts

import { useRef, useCallback, useEffect, useState } from 'react';
import { RESULTS_THEME as T } from '../constants/results-theme';

type ScanPhase = 'WARMUP' | 'GLIMPSE' | 'QUICK' | 'STANDARD' | 'DEEP' | 'COMPLETE';

interface ScanMetrics {
  tei: number;        // 1-99 PR
  hr: number;         // BPM
  hrv: number;        // ms RMSSD
  rr: number;         // BrPM
  stress: number;     // 0-100
  sns: number;        // 0-100%
  sqi: number;        // 0-100
}

interface ScanState {
  phase: ScanPhase;
  elapsedSec: number;
  metrics: ScanMetrics;
  isComplete: boolean;
  confidence: number;  // 0-1, 隨 phase 提升
}

const PHASE_THRESHOLDS = [2, 4, 17, 32, 62]; // 累計秒數
const PHASE_NAMES: ScanPhase[] = ['WARMUP','GLIMPSE','QUICK','STANDARD','DEEP','COMPLETE'];
const PHASE_NOISE: Record<ScanPhase, number> = {
  WARMUP: 0, GLIMPSE: 12, QUICK: 6, STANDARD: 3, DEEP: 1, COMPLETE: 0
};
const PHASE_CONFIDENCE: Record<ScanPhase, number> = {
  WARMUP: 0, GLIMPSE: 0.3, QUICK: 0.6, STANDARD: 0.8, DEEP: 0.95, COMPLETE: 1
};

/**
 * EWMA (Exponentially Weighted Moving Average)
 * α = 0.05 → 極慢收斂, 醫療級平滑
 * 
 * 公式: new = current × (1-α) + (target + noise) × α
 * 
 * 噪聲隨 phase 遞減:
 *   GLIMPSE: ±12 (粗略)
 *   QUICK:   ±6
 *   STANDARD:±3
 *   DEEP:    ±1 (幾乎無噪聲)
 */
function ewma(current: number, target: number, noise: number, alpha: number = T.animation.ewmaAlpha): number {
  if (current === 0) {
    // 首次: 直接跳到 target 附近 (有大噪聲)
    return target + (Math.random() - 0.5) * noise * 3;
  }
  const n = (Math.random() - 0.5) * noise;
  return current * (1 - alpha) + (target + n) * alpha;
}

export function useProgressiveScan(targetMetrics: ScanMetrics) {
  const [state, setState] = useState<ScanState>({
    phase: 'WARMUP',
    elapsedSec: 0,
    metrics: { tei:0, hr:0, hrv:0, rr:0, stress:0, sns:50, sqi:0 },
    isComplete: false,
    confidence: 0,
  });

  const metricsRef = useRef<ScanMetrics>({ tei:0, hr:0, hrv:0, rr:0, stress:0, sns:50, sqi:0 });
  const elapsedRef = useRef(0);

  // 每秒計時
  useEffect(() => {
    const secTimer = setInterval(() => {
      elapsedRef.current += 1;
      const sec = elapsedRef.current;

      let phase: ScanPhase = 'COMPLETE';
      for (let i = 0; i < PHASE_THRESHOLDS.length; i++) {
        if (sec < PHASE_THRESHOLDS[i]) {
          phase = PHASE_NAMES[i];
          break;
        }
      }

      setState(prev => ({
        ...prev,
        elapsedSec: sec,
        phase,
        isComplete: phase === 'COMPLETE',
        confidence: PHASE_CONFIDENCE[phase],
      }));

      if (sec >= 62) clearInterval(secTimer);
    }, 1000);

    return () => clearInterval(secTimer);
  }, []);

  // EWMA 指標更新 (350ms 間隔, 比秒計時更頻繁 → 更平滑)
  useEffect(() => {
    const metricTimer = setInterval(() => {
      const phase = state.phase;
      if (phase === 'WARMUP') return; // 暖機期不更新數字

      const noise = PHASE_NOISE[phase];
      const m = metricsRef.current;
      const t = targetMetrics;

      m.tei    = clamp(ewma(m.tei,    t.tei,    noise), 1, 99);
      m.hr     = clamp(ewma(m.hr,     t.hr,     noise), 40, 200);
      m.hrv    = clamp(ewma(m.hrv,    t.hrv,    noise), 5, 200);
      m.rr     = clamp(ewma(m.rr,     t.rr,     noise * 0.5), 6, 30);
      m.stress = clamp(ewma(m.stress, t.stress, noise), 0, 100);
      m.sns    = clamp(ewma(m.sns,    100 - t.stress * 0.6, noise * 0.5), 15, 85);
      m.sqi    = clamp(ewma(m.sqi,    t.sqi,    noise * 0.3), 0, 100);

      setState(prev => ({
        ...prev,
        metrics: { ...m },
      }));
    }, T.animation.updateIntervalMs);

    return () => clearInterval(metricTimer);
  }, [state.phase, targetMetrics]);

  return state;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
```

### 3.3 關鍵行為規則

| 規則 | 描述 |
|------|------|
| **暖機靜默** | Phase 0 (0-2s) 所有數字顯示 `--`，不顯示任何數值 |
| **首次跳入** | Phase 1 首幀，數字直接跳到 target ±15 範圍（不從 0 爬升） |
| **EWMA α=0.05** | 之後每 350ms 更新，數字幾乎不可見地緩慢移動 |
| **噪聲遞減** | GLIMPSE ±12 → QUICK ±6 → STANDARD ±3 → DEEP ±1 |
| **鎖定語義** | Phase 4 COMPLETE 後停止更新，數字凍結在最終值 |
| **不可倒退** | SQI 只升不降（信心單調遞增） |

---

## 4. 心跳同步脈動 — `useHeartbeatSync.ts`

```typescript
// hooks/useHeartbeatSync.ts

import { useEffect } from 'react';
import { useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';

/**
 * 心跳同步：所有 bio-value 元素 + TEI 數字共用一個 Reanimated shared value
 * 
 * 視覺效果: opacity 1 → 0.88 → 1 (微妙到幾乎不可見, 但潛意識感知)
 * 週期 = 60 / HR 秒
 * 
 * HR 68 BPM → pulse period = 0.882s
 * HR 82 BPM → pulse period = 0.732s
 * 
 * 這是「醫療級設計」的核心: 畫面在用戶心率節律上呼吸
 */
export function useHeartbeatSync(bpm: number) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (bpm <= 0) return;

    const periodMs = (60 / bpm) * 1000;
    const peakMs = periodMs * 0.15;   // systole (收縮期) = 15% 週期
    const restMs = periodMs * 0.85;   // diastole (舒張期) = 85% 週期

    pulse.value = withRepeat(
      withSequence(
        withTiming(0.88, { duration: peakMs, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: restMs, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, // infinite repeat
      false
    );
  }, [bpm]);

  return pulse; // 用作 animatedStyle = { opacity: pulse }
}
```

**使用方式**：
```tsx
const pulse = useHeartbeatSync(metrics.hr);
const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

// 所有需要心跳同步的元素
<Animated.Text style={[styles.teiNumber, pulseStyle]}>{tei}</Animated.Text>
<Animated.Text style={[styles.hrValue, pulseStyle]}>{hr}</Animated.Text>
<Animated.Text style={[styles.hrvValue, pulseStyle]}>{hrv}</Animated.Text>
```

---

## 5. 元件規格 — 逐一定義

### 5.0 頂層容器 `ResultsScreen.tsx`

```
結構:
  <View style={{ flex:1, backgroundColor:'#000' }}>
    <StardustBackground />
    <ScrollView>
      <ScanBadge />
      <SourceStrip />
      <TeiRing />
      <ZonePill />
      <CoachCard />
      <SectionHeader label="Snapshot" />
      <BentoGrid>
        <BioCard type="hr" />
        <BioCard type="hrv" />
        <BioCard type="rr" />
        <BioCard type="stress" />
      </BentoGrid>
      <BodyBatteryChart />
      <AnsBalance />
      <SectionHeader label="Quality · Fusion" />
      <SignalQuality />
      <SectionHeader label="Actions" />
      <ActionButtons />
      <SectionHeader label="Trend" />
      <TrendChart />
      <View height={120} />  ← FDCB 底部留白
    </ScrollView>
    <FloatingBar />  ← position absolute bottom
  </View>

入場動畫:
  每個區塊使用 Reanimated FadeInUp
  stagger = 100ms × index
  duration = 600ms
  easing = cubic-bezier(0.16, 1, 0.3, 1)
```

---

### 5.1 `StardustBackground.tsx` — 星塵星雲

```
渲染引擎: @shopify/react-native-skia
位置: position absolute, top:0, width:100%, height:560pt
z-index: 0 (在所有內容下方)

星雲層 (3 個 radial gradient):
  1. 中央青色: center=(196,80), r=170, color=#00B4D8, opacity=0.055
     animation: opacity 0.04↔0.06, 8s ease-in-out, infinite
  2. 左側紫色: center=(47,160), r=110, color=#7B2FF7, opacity=0.03
     animation: scale 1↔1.08, 11s, phase offset 3s
  3. 右側品紅: center=(350,100), r=90, color=#FF006E, opacity=0.02
     no animation (最微妙層)

星點 (50 個):
  x: random 0-393
  y: random 0-560
  size: random 0.4-1.5 px
  opacity: random 0.04-0.35
  animation: twinkle (opacity min↔max), random 2-4.5s, random delay

關鍵: 星塵是「感覺到而非看到」的。如果你瞇眼才注意到，就對了。
```

---

### 5.2 `ScanBadge.tsx`

```
佈局: 置中, 上方 padding 12pt
內容: "✦ DEEP SCAN · 60s"
  ✦ = teal #00F5FF, 9pt
  文字 = 11pt, weight 600, letter-spacing 1.5, uppercase
  顏色 = rgba(255,255,255,0.55)

掃描中動態:
  Phase 0-3: "✦ SCANNING · {elapsed}s"
  Phase 4+:  "✦ DEEP SCAN · 60s"

容器:
  padding: 7px 16px
  borderRadius: 100 (pill)
  background: rgba(255,255,255,0.03)
  border: 1px rgba(255,255,255,0.06)
  backdropFilter: blur(20)  ← React Native 用 @react-native-community/blur
```

---

### 5.3 `SourceStrip.tsx` — 數據來源

```
佈局: flexDirection:'row', justifyContent:'center', gap:8
margin-bottom: 16pt

Active chip (Garmin 連接時):
  text: "⌚ Garmin Forerunner"
  color: #00B4D8
  borderColor: rgba(0,180,216,0.2)
  background: rgba(0,180,216,0.06)
  左側 5px teal dot

Secondary chip (rPPG):
  text: "📸 rPPG 眉心"
  color: #8E8E93
  borderColor: rgba(255,255,255,0.06)
  background: rgba(255,255,255,0.03)

共通: padding 4×10, borderRadius 100, fontSize 10, fontWeight 500

No Garmin 時: 只顯示 rPPG chip (active 樣式)
```

---

### 5.4 `TeiRing.tsx` — ★ 雙環 TEI 核心 (Skia)

```
渲染引擎: @shopify/react-native-skia (Canvas)
尺寸: 220 × 220pt, 置中
viewBox 中心: (110, 110)

外環 (TEI):
  圓心: (110,110), 半徑: 102, strokeWidth: 5
  底軌: rgba(255,255,255,0.04)
  弧線: conic gradient (光譜), 從 12 點鐘順時針
  填充比例: TEI / 100 (TEI 72 → 72%)
  
  光譜漸層 (Optimal Zone):
    SweepGradient center=(110,110)
    colors: [#00F5FF, #4361EE, #7B2FF7, #FF006E, #FF6B35, #F5A623]
    positions: [0, 0.2, 0.4, 0.6, 0.8, 1.0]
  
  外發光: dropShadow(0, 0, 6, rgba(0,180,216,0.2))
  
  端點光點:
    位置: 用三角函數計算
      angle = -π/2 + (tei/100) × 2π
      x = 110 + 102 × cos(angle)
      y = 110 + 102 × sin(angle)
    大小: 8pt
    顏色: #F5A623 (amber)
    glow: 0 0 12px rgba(245,166,35,0.4)
    動畫: scale 1↔1.25, 呼吸節奏 (跟隨 heartbeat sync)

內環 (HRV):
  半徑: 80, strokeWidth: 3
  底軌: rgba(255,255,255,0.03)
  弧線: linear gradient #34C759 → #00B4D8
  填充比例: min(hrv / 80, 1) (hrv 52ms → 65%)

弧線動畫:
  使用 Reanimated + Skia 的 usePathValue
  transition: 1200ms, cubic-bezier(0.25, 0.1, 0.25, 1)
  每次 metrics 更新 → 平滑過渡到新弧度

PHASE 0 (WARMUP): 兩環都在 0%, 空環, 只有底軌可見
PHASE 1 (GLIMPSE): 弧線從 0 彈入到初步位置
```

---

### 5.5 `TeiNumber.tsx` — ★ 金屬漸層數字

```
渲染: @react-native-masked-view/masked-view + LinearGradient

結構:
  <MaskedView maskElement={<Text>{teiValue}</Text>}>
    <LinearGradient
      colors={['#FFFFFF', '#D1D1D6', '#8E8E93']}
      locations={[0, 0.4, 1]}
      start={{x:0,y:0}} end={{x:0,y:1}}
      style={{ width: 160, height: 80 }}
    />
  </MaskedView>

字型:
  fontSize: 72
  fontWeight: '300'  (非 100, 非 700 — 中等粗)
  fontFamily: 'SF Pro Display' (iOS) / 'Inter' (Android)
  fontVariantNumeric: 'tabular-nums'
  letterSpacing: -1

外發光: 
  textShadowColor: rgba(0,180,216,0.12)
  textShadowOffset: {0,0}
  textShadowRadius: 30

WARMUP 顯示: "--" (純白, 不帶漸層)
GLIMPSE 起: 數字 fade-in (300ms)
跟隨 heartbeat sync pulse (opacity 1→0.88→1)

副文字 (在數字下方, 不做漸層):
  "TEI · PR99" — 10pt, JetBrains Mono, letterSpacing 3, #636366
  "{ZoneName}" — 11pt, zone color, fontWeight 500
```

---

### 5.6 `BioCard.tsx` — 通用生理指標卡片

```
共用容器:
  background: #1C1C1E
  borderRadius: 18
  border: 1px rgba(255,255,255,0.05)
  padding: 14
  頂部光澤: position absolute, top:0, left:12%, right:12%, height:1px
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)

佈局 (由上到下):
  1. Header row: [icon 28×28] [label 11pt gray]
  2. Value: [number 32pt weight-200] [unit 12pt gray]
  3. Garmin sync line (9pt green)
  4. Sparkline (32pt tall)

四種 type 各自配置:

┌─ type="hr" ────────────────────────────┐
│ Icon: ❤️ on rgba(255,69,58,0.1) bg      │
│ Label: "Heart Rate"                     │
│ Value: "{hr}" color #FF453A             │
│ Unit: "BPM"                             │
│ Sync: "⌚ Garmin 同步 67 BPM"           │
│ Sparkline: red (#FF453A)                │
└─────────────────────────────────────────┘

┌─ type="hrv" ───────────────────────────┐
│ Icon: 💚 on rgba(52,199,89,0.1) bg      │
│ Label: "HRV"                            │
│ Value: "{hrv}" color #34C759            │
│ Unit: "ms RMSSD"                        │
│ HRV Badge: <HrvBadge status="Balanced"/>│
│ Sync: "⌚ 夜均 48ms · 基線 45-58"       │
│ Sparkline: green (#34C759)              │
└─────────────────────────────────────────┘

┌─ type="rr" ────────────────────────────┐
│ Icon: 🫁 on rgba(0,180,216,0.1) bg      │
│ Label: "Respiratory"                    │
│ Value: "{rr}" color #00B4D8             │
│ Unit: "BrPM"                            │
│ Sync: "⌚ Garmin 同步"                  │
│ Sparkline: teal (#00B4D8)               │
└─────────────────────────────────────────┘

┌─ type="stress" ────────────────────────┐
│ Icon: ⚡ on rgba(245,166,35,0.1) bg     │
│ Label: "Stress"                         │
│ Value: "{stress}" + "/ 100"             │
│   color: green(<26), amber(26-50),      │
│          orange(51-75), red(76+)        │
│ Sync: "⌚ Garmin 同步 23"               │
│ StressBar: <StressBar value={stress}/>  │
│ "Relaxed" label (10pt, right-aligned)   │
└─────────────────────────────────────────┘

Bento Grid: 2×2, gap 10pt
  Row 1: [hr] [hrv]
  Row 2: [rr] [stress]
```

---

### 5.7 `StressBar.tsx` — Garmin Stress 0-100

```
佈局 (由上到下):
  1. 進度條: 6pt tall, background #2C2C2E, borderRadius 3
     填充: width={stress}%, gradient → 色彩依值:
       0-25:  linear(#34C759, #80D99A) green
       26-50: linear(#F5A623, #F0C56E) amber
       51-75: linear(#FF6B35, #FF9B6B) orange
       76+:   linear(#FF453A, #FF7B73) red
     指示點: 16pt 白色圓, border 3px #1C1C1E, shadow, 在填充右端

  2. Tick marks: "0  25  50  75  100"
     font: 7.5pt JetBrains Mono, #3A3A3C

  3. 4-segment 參考條: 2pt tall, 30% opacity
     [gray 25%] [amber 25%] [orange 25%] [red 25%]
     對應 Garmin 四段: Rest / Low / Medium / High
```

---

### 5.8 `Sparkline.tsx` — 即時波形 (Skia)

```
渲染: @shopify/react-native-skia
尺寸: width=100% (卡片內寬), height=32pt

數據: 滾動窗口, 最多 40 個數據點
每 350ms 推入新數據, 超過 40 則 shift 移除最舊

繪製:
  1. Area fill: 從曲線底部到容器底部
     gradient: color+25 opacity → color+00 (top → bottom)
  2. Line: bezier smooth, strokeWidth 1.5
     color: {metricColor}+80 (50% opacity)

Y 軸範圍: auto-scale (max×1.15, min×0.85)
X 軸: 均分 40 點

動畫: 新數據推入時, 整條線平滑左移 (Skia path animation)

WARMUP: 空白 (無數據)
GLIMPSE 起: 開始繪製 (初期只有幾個點, 逐漸充滿)
```

---

### 5.9 `BodyBatteryChart.tsx` — ★ Go Club 圓角柱狀圖

```
容器: full-width glass card, padding 16×14

Header: "🔋 Body Battery" (13pt, semibold) + "⌚ Garmin Sync" pill

主內容: flexDirection:'row', alignItems:'flex-end', gap:14

左區 (~70%) — 柱狀圖:
  height: 80pt
  12 根柱, gap: 4px, flex:1 each

  ★ Go Club 柱形:
    borderRadius: [barWidth/2, barWidth/2, 3, 3]  (頂端全圓 pill)
    每根柱: LinearGradient vertical (亮色 top → 暗色 bottom)

  24hr 模擬數據:
    12am:90, 2am:95, 4am:92, 6am:85, 8am:72, 10am:55
    12pm:42, 2pm:48, 4pm:62, 6pm:70, 8pm:75, Now:78

  色彩對照 bodyBattery theme:
    val >= 65 → green (#34C759→#1A6B2E)
    val >= 40 → teal  (#00B4D8→#0E5A6F)
    val >= 25 → amber (#F5A623→#8A5E14)
    val <  25 → red   (#FF6B35→#7A3318)

  透明度遞增: bar[i].opacity = 0.2 + (i/12) × 0.55
  最後一根 (Now): opacity=1, box-shadow glow, 頂部白色光點 4px

  入場動畫:
    每根柱從 height=0 彈入到目標高度
    stagger: 1200ms + i×80ms
    easing: cubic-bezier(0.34, 1.56, 0.64, 1) ← overshoot bounce

右區 (~30%) — 分數:
  "78" — 42pt, weight 200, #34C759
  "/ 100" — 11pt, #636366
  "Body Battery" — 11pt, semibold, #8E8E93
  "● Garmin" — 9pt, #34C759

底部: 時間軸
  "12a  ...  4a  ...  8a  ...  12p  ...  4p  ...  8p  Now"
  7pt JetBrains Mono, #3A3A3C, "Now" = #8E8E93 bold
  padding-right: 82pt (對齊柱區, 不延伸到分數區)

無 Garmin: 整個元件隱藏
```

---

### 5.10 `AnsBalance.tsx`

```
容器: glass card, padding 16, margin-top 10

Header: "⚖️ ANS Balance" + "SNS {sns}% · PNS {pns}%" monospace

平衡條:
  height: 10pt, borderRadius: 5, flexDirection:'row', overflow:'hidden'
  左 (SNS): width={sns}%, gradient(#FF453A, #FF6B35)
  右 (PNS): flex:1, gradient(#00B4D8, #34C759)
  黑色分割線: 2px, position absolute left={sns}%

Labels: "交感 Sympathetic" ←→ "副交感 Parasympathetic"

動畫: sns width 用 Reanimated withTiming 1000ms
```

---

### 5.11 `SignalQuality.tsx`

```
Quality row (glass card):
  Grade badge: 28×28, borderRadius 8
    A (sqi≥85): bg #34C759
    B (sqi≥70): bg #00B4D8
    C (sqi≥50): bg #F5A623
    D (sqi<50): bg #FF453A
  Label: "Signal Quality: Excellent" (13pt)
  Detail: "SQI {sqi} · Fusion: Garmin T2 + rPPG T3" (10pt mono)

Fusion chips row (below, margin-top 10):
  3 chips:
  - "T1 BLE — 未連接" → green dot, gray text (disconnected)
  - "T2 ⌚ Garmin"    → teal dot+text (active)
  - "T3 📸 rPPG"      → amber dot+text (active)
  chip: padding 5×10, borderRadius 8, fontSize 10
```

---

### 5.12 `TrendChart.tsx` — 7 天趨勢 (Skia)

```
容器: glass card, padding 16
Header: "TEI 7-Day" + "近 7 天" pill

Chart (Skia Canvas):
  viewBox: 321 × 90
  三條參考線: y=18, y=40, y=63 (dashed, 4% white)
  
  7 data points: [52, 46, 58, 38, 44, 30, 24] (mapped to y)
  → 趨勢向上, 最後點 = 24 (最高位)
  
  Area fill: gradient #00B4D8 opacity 10% → 0%
  Line: spectrum gradient stroke, width 2.5, round join
  End dot: 4pt #00B4D8 + 8pt ring (30% opacity)

Dates: "2/19 2/20 2/21 2/22 2/23 2/24 2/25"
  9pt JetBrains Mono, #48484A
```

---

## 6. FDCB 整合

```
位置: position absolute, bottom: 0, left: 0, right: 0
z-index: 100 (高於 ScrollView)

結構: (詳見 ANTIGRAVITY.md Section 5)
  [fdcb-bar 72pt] + [safe-area 34pt]
  background: rgba(10,10,12,0.88), backdropFilter blur(30)
  border-top: 1px rgba(255,255,255,0.05)

佈局:
  左: 模板選擇器 "📊 Canslim GS ▾"
  中: 計時器 "02:18" (28pt teal) + "SWEET ZONE" + progress bar
  右: 事件圓點 ● ● ○ ✓

ScrollView 底部需要 paddingBottom: 120pt 來避免 FDCB 遮擋內容

FDCB 在結果頁永遠可見 — 它是 OS Layer
```

---

## 7. GARMIN 數據整合層

### 7.1 數據來源對照

| TENKI 指標 | Garmin 來源 | 對齊方式 |
|-----------|------------|---------|
| HR | Garmin HR (即時) | 直接顯示, 雙數對比 |
| HRV | Garmin HRV Status (3 週夜間基線) | ms RMSSD + Badge (Balanced/Unbalanced/Low/Poor) |
| RR | Garmin Respiration | 直接同步 |
| Stress | Garmin Stress Score (Firstbeat, 0-100) | 精確數字 + 4 段條 |
| Body Battery | Garmin Body Battery (5-100) | 完整 24hr 歷史 |
| TEI PR99 | TENKI 自有 (融合所有來源) | 獨立計算, Garmin 是 T2 輸入 |

### 7.2 Sync 一致性檢查

```typescript
// 顯示邏輯
function getSyncStatus(tenkiVal: number, garminVal: number): 'synced' | 'offset' {
  const delta = Math.abs(tenkiVal - garminVal) / garminVal;
  return delta < 0.05 ? 'synced' : 'offset';  // 5% 閾值
}

// synced → "⌚ Garmin 同步 67 BPM" (9pt, #34C759 green)
// offset → "⌚ Garmin 67 (偏差)" (9pt, #F5A623 amber)
```

### 7.3 無 Garmin 降級

| 元素 | 有 Garmin | 無 Garmin |
|------|----------|----------|
| Source Strip | ⌚ Garmin (active) + 📸 rPPG | 只有 📸 rPPG (active) |
| HRV Badge | "● Balanced" pill | 隱藏 (需 3 週基線) |
| HRV Sync | "夜均 48ms · 基線 45-58" | 隱藏 |
| Stress | "25 / 100" + bar | "Low" 文字 (無精確數字) |
| Body Battery | 完整 12 柱圖 | **整個卡片隱藏** |
| ANS "GARMIN" tag | 顯示 | 隱藏 |
| Fusion T2 chip | teal (active) | gray (disconnected) |
| 整體感覺 | 資訊豐富 | 依然完整美觀 (不可殘缺感) |

---

## 8. ZONE 變體

### 8.1 Zone 自動切換

```typescript
function getZone(tei: number) {
  if (tei >= 80) return RESULTS_THEME.zones.peak;
  if (tei >= 55) return RESULTS_THEME.zones.optimal;
  if (tei >= 35) return RESULTS_THEME.zones.neutral;
  return RESULTS_THEME.zones.degraded;
}
```

### 8.2 Zone 影響範圍

| 元素 | Optimal (55-79) | Peak (80-99) | Neutral (35-54) | Degraded (1-34) |
|------|----------------|-------------|----------------|-----------------|
| 光譜環色系 | 全彩虹 | 暖色偏移 | 灰色去飽和 | 冷紫 |
| Zone Pill 色 | teal | amber | gray | purple |
| Coach 文字 | 全功能交易 | 雙重確認警告 | 僅 A+ Setup | 暫停交易 |
| 「開始交易」按鈕 | enabled | enabled+warning | enabled+50% | **disabled** (lock icon) |
| 呼吸校準按鈕 | normal | normal | highlighted | **primary** |

### 8.3 各 Zone 模擬數據

```
Optimal (TEI 72):
  hr:68, hrv:52, rr:14, stress:25, sns:38, sqi:92, bb:78
  HRV Status: Balanced, Stress: Relaxed

Peak (TEI 87):
  hr:82, hrv:38, rr:18, stress:62, sns:58, sqi:88, bb:52
  HRV Status: Unbalanced↓, Stress: Medium
  Coach: "高能量狀態 — 過度自信風險升高。執行雙重確認，嚴守風控。"

Neutral (TEI 44):
  hr:72, hrv:42, rr:15, stress:48, sns:48, sqi:85, bb:55
  HRV Status: Balanced (borderline), Stress: Low/Medium edge
  Coach: "中性狀態 — 僅執行 A+ Setup，倉位降至 50%。"

Degraded (TEI 22):
  hr:74, hrv:28, rr:16, stress:78, sns:68, sqi:78, bb:18
  HRV Status: Low (RED), Stress: High
  Coach: "低能量狀態 — 暫停所有交易。啟動呼吸校準，等待恢復。"
```

---

## 9. 狀態管理 — `scanStore.ts`

```typescript
// stores/scanStore.ts (Zustand)

import { create } from 'zustand';

interface GarminData {
  connected: boolean;
  deviceName: string | null;        // "Forerunner 265"
  hr: number | null;
  hrvStatus: 'Balanced'|'Unbalanced'|'Low'|'Poor' | null;
  hrvNightMean: number | null;      // 夜間平均 ms
  hrvBaseline: [number, number] | null; // [min, max] 基線範圍
  stress: number | null;            // 0-100
  bodyBattery: number | null;       // 5-100
  bb24h: number[] | null;           // 12 個 2hr 數據點
  respiration: number | null;
}

interface ScanStore {
  // 掃描結果
  tei: number;
  hr: number;
  hrv: number;
  rr: number;
  stress: number;
  sns: number;
  pns: number;
  sqi: number;

  // 掃描狀態
  phase: ScanPhase;
  elapsedSec: number;
  isComplete: boolean;
  confidence: number;

  // Garmin
  garmin: GarminData;

  // 歷史 (sparkline 用)
  hrHistory: number[];
  hrvHistory: number[];
  rrHistory: number[];

  // Actions
  updateMetrics: (m: Partial<ScanMetrics>) => void;
  setPhase: (p: ScanPhase) => void;
  pushHistory: (hr: number, hrv: number, rr: number) => void;
  setGarmin: (g: Partial<GarminData>) => void;
  reset: () => void;
}
```

---

## 10. 測試規格

```
覆蓋目標: ≥ 90%

Unit Tests:
  ├── useProgressiveScan.test.ts
  │   ├── WARMUP 期間 metrics 全部為 0
  │   ├── GLIMPSE 後 tei 在 target ±15 範圍
  │   ├── EWMA 每次更新偏移量 < 前次 (收斂性)
  │   ├── COMPLETE 後 metrics 凍結
  │   └── 噪聲隨 phase 遞減 (GLIMPSE > QUICK > STANDARD > DEEP)
  │
  ├── useHeartbeatSync.test.ts
  │   ├── HR 0 時不啟動動畫
  │   ├── HR 60 → period = 1000ms
  │   └── HR 120 → period = 500ms
  │
  ├── zone.test.ts
  │   ├── TEI 72 → Optimal Zone
  │   ├── TEI 87 → Peak Zone
  │   ├── TEI 44 → Neutral Zone
  │   └── TEI 22 → Degraded Zone
  │
  └── garmin-sync.test.ts
      ├── |68-67|/67 < 0.05 → synced
      ├── |68-60|/60 > 0.05 → offset
      └── garmin.connected=false → 降級顯示

Snapshot Tests:
  每個 Zone 各一張:
  ResultsScreen.snapshot.optimal.tsx
  ResultsScreen.snapshot.peak.tsx
  ResultsScreen.snapshot.neutral.tsx
  ResultsScreen.snapshot.degraded.tsx
```

---

## 11. 效能約束

| 指標 | 目標 |
|------|------|
| FPS (掃描中) | ≥ 55fps (滾動 + 動畫同時) |
| Skia 重繪 | 只在 metrics 變化時 (350ms 間隔, 不是每幀) |
| 記憶體 | sparkline history 限制 40 points / metric |
| Re-render | BioCard 用 React.memo + 只在自己的 metric 變化時更新 |
| FDCB | 不隨 ScrollView 重繪 (position absolute, 獨立層) |

---

## 12. 實作順序 (建議)

```
Step 1: results-theme.ts + scanStore.ts
Step 2: useProgressiveScan.ts + useHeartbeatSync.ts (純邏輯, 可 unit test)
Step 3: ResultsScreen.tsx 骨架 (ScrollView + 佔位區塊)
Step 4: TeiRing.tsx + TeiNumber.tsx (核心英雄區)
Step 5: BioCard.tsx × 4 (HR/HRV/RR/Stress)
Step 6: Sparkline.tsx (接入 history 數據)
Step 7: BodyBatteryChart.tsx
Step 8: AnsBalance.tsx + SignalQuality.tsx + ActionButtons.tsx
Step 9: StardustBackground.tsx + TrendChart.tsx
Step 10: 接入 FDCB (FloatingBar.tsx)
Step 11: Zone 變體測試 (4 zones × garmin/no-garmin)
Step 12: 入場動畫 stagger + heartbeat sync 整合
```

---

## 13. DONE = GO CRITERIA

| 項目 | Pass 條件 | 驗證方法 |
|------|-----------|---------|
| EWMA 收斂 | 同組數據跑 100 次, TEI 偏差 < ±1 | Unit test |
| 暖機靜默 | 0-2s 所有數字為 "--" | Snapshot test |
| 首幀跳入 | 2s 時 TEI 出現在 target ±15 | Unit test |
| 心跳同步 | pulse period = 60/HR ±5ms | Unit test |
| 光譜環精度 | arc 填充 = TEI% ±0.5% | Visual test |
| 端點光點 | 跟隨弧線端點, 誤差 < 2pt | Visual test |
| Sparkline 滾動 | 40 點窗口, 不閃爍 | Manual test |
| BB 柱狀圖 | 12 柱 stagger bounce, 顏色正確 | Snapshot test |
| Garmin 降級 | 無 Garmin 時 BB 隱藏, Stress 文字化 | Snapshot test |
| Zone 切換 | 4 zone 色彩/文案/按鈕全正確 | Snapshot × 4 |
| FDCB 覆蓋 | 底部 120pt 不被遮擋 | Manual test |
| 55+ FPS | 掃描中滾動不卡頓 | Performance test |

---

## 14. 絕對不要做的事

1. **不要自行設計** — 所有視覺已鎖定, 照規格書實作
2. **不要修改 `apps/web/`** — 那是保留的 prototype
3. **不要動星塵靈魂動效** — 只建立新的 StardustBackground
4. **不要用 Animated (legacy)** — 只用 Reanimated 3
5. **不要用 SVG 元件畫環** — 用 Skia (效能更好)
6. **不要讓 TEI 數字從 0 爬升** — 首幀直接跳入附近值
7. **不要讓任何數字跳動** — EWMA α=0.05 = 極慢
8. **不要在 Phase 0 顯示任何數字** — 只有 "--"
9. **不要用 bottom tab bar** — FDCB 取代它
10. **不要改 FDCB 模板規則** — 已在 ANTIGRAVITY.md 鎖定

---

*Last updated: 2026-03-02*
*Version: v4.2 FINAL*
*Visual ref: tenki_optimal_zone_garmin_connected__2_.png*
*Parent: ANTIGRAVITY.md v2.0*
