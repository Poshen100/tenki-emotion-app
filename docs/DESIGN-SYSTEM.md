# TENKI Design System v1.0

> **創意總監指令文件** — 設計創意總監 × 全端工程師合著  
> **Status**: Canonical. All UI agents, Claude Code, Cursor must reference this file.  
> **Last updated**: 2026-06-20

---

## 0. 設計哲學 — 像 Fable 5 一樣思考

Fable 5 的核心美學是「形隨機能的奇異感」——介面本身就是一個有生命的系統，不是靜態的排版。TENKI 承接這個精神：

> **Form Follows Function Follows Feeling.**  
> 掃描按鈕不只是按鈕。它是一個呼吸的生物。它感知你的壓力，它回應你的心跳。

三個設計原則：

| 原則 | 含義 | 實作方向 |
|------|------|----------|
| **Alive** 有生命感 | 介面永遠在微呼吸、微震動 | Idle 動效、星塵粒子持續存在 |
| **Calibrated** 精準感 | 數字的顯現像科學儀器 | Monospace digits、漸進精度揭露 |
| **Pivotal** 轉機感 | 每次掃描都是一個決策節點 | Scan → Result → Action 敘事弧 |

---

## 1. 藝術方向確立

```css
/* Art direction: 生物科技 × 深太空 × 量子觀測
   Palette: 極深暗場 (near-black) + 單一冷光 cyan 作為生命訊號
   Typography: 顯示字體 → Outfit (精密工程感); 數字 → JetBrains Mono (儀器感)
   Density: 極簡 spacious — 每一個元素都有呼吸空間
   Motion: 有機緩慢 (生物節律) + 精準瞬間 (數據揭露) */
```

---

## 2. 色彩系統 — Stardust Dark Palette

TENKI 永遠以暗色為主場景（掃描時環境光降低是理想狀態）。亮色模式用於白天 Dashboard 報表。

### 設計決策原則
- **一個主色調**：Tenki Cyan `#00E5CC` — 這是「生命訊號」的顏色，只用在最關鍵的讀數、CTA、HRV 波形
- **0 個裝飾性漸層** — 漸層只在數據視覺化時使用（TEI 環形、HRV 波形）
- **表面靠層次感**，不靠顏色數量

```css
/* ╔══════════════════════════════════════════════════════╗
   ║  TENKI DESIGN TOKENS — Stardust Dark System          ║
   ╚══════════════════════════════════════════════════════╝ */

:root, [data-theme="dark"] {
  /* === SURFACES (暗場深度層) === */
  --color-bg:               #080A0E;  /* 最深底色，宇宙黑 */
  --color-surface:          #0D1117;  /* 主卡片底色 */
  --color-surface-2:        #121820;  /* 次層卡片、懸浮元素 */
  --color-surface-3:        #171F2B;  /* 輸入框、選中態 */
  --color-surface-raised:   #1E2735;  /* 彈窗、Sheet */
  --color-divider:          #1E2A38;  /* 分隔線 */
  --color-border:           #243042;  /* 邊框，alpha-blended */
  --color-border-subtle:    oklch(from #243042 l c h / 0.5);

  /* === TEXT (文字層次) === */
  --color-text:             #E8EDF5;  /* 主文字，冷白 */
  --color-text-muted:       #8A99B0;  /* 次要文字、label */
  --color-text-faint:       #4A5668;  /* 裝飾性、禁用態 */
  --color-text-inverse:     #080A0E;  /* 反白文字（用在亮色按鈕上）*/

  /* === PRIMARY SIGNAL — Tenki Cyan === */
  --color-primary:          #00E5CC;  /* 主生命訊號 */
  --color-primary-dim:      #00B8A3;  /* hover / pressed */
  --color-primary-glow:     oklch(from #00E5CC l c h / 0.15); /* 發光暈 */
  --color-primary-surface:  oklch(from #00E5CC l c h / 0.07); /* 選中態底色 */

  /* === STATE ZONES (情緒狀態色) — 僅用於 TEI 環 & 數據視覺化 === */
  --color-state-clear:      #00E5CC;  /* Clear 穩定 */
  --color-state-neutral:    #FFB347;  /* Neutral 警戒 */
  --color-state-strain:     #FF4D6D;  /* Strain 過熱 */

  /* === FEEDBACK === */
  --color-success:          #22C55E;
  --color-warning:          #F59E0B;
  --color-error:            #EF4444;

  /* === RADIUS === */
  --radius-xs:  0.25rem;  /* 4px  — 小 badge */
  --radius-sm:  0.5rem;   /* 8px  — 按鈕、input */
  --radius-md:  0.75rem;  /* 12px — 小卡片 */
  --radius-lg:  1rem;     /* 16px — 主卡片 */
  --radius-xl:  1.5rem;   /* 24px — 底部 Sheet */
  --radius-2xl: 2rem;     /* 32px — Hero 掃描卡 */
  --radius-full: 9999px;  /* 膠囊、圓形 */

  /* === SHADOWS (深色場景陰影用光暈替代) === */
  --shadow-sm:  0 0 0 1px oklch(from #00E5CC l c h / 0.08);
  --shadow-md:  0 0 16px oklch(from #00E5CC l c h / 0.12),
                0 1px 3px oklch(0 0 0 / 0.4);
  --shadow-lg:  0 0 40px oklch(from #00E5CC l c h / 0.18),
                0 4px 16px oklch(0 0 0 / 0.5);
  --shadow-glow: 0 0 60px oklch(from #00E5CC l c h / 0.25);

  /* === TRANSITIONS === */
  --ease-organic: cubic-bezier(0.34, 1.56, 0.64, 1);  /* 有機彈跳 */
  --ease-precise: cubic-bezier(0.16, 1, 0.3, 1);       /* 精準滑入 */
  --ease-breath:  cubic-bezier(0.45, 0, 0.55, 1);      /* 呼吸韻律 */

  --transition-fast:   120ms var(--ease-precise);
  --transition-base:   200ms var(--ease-precise);
  --transition-slow:   400ms var(--ease-organic);
  --transition-breath: 3000ms var(--ease-breath);  /* Idle 動效 */

  /* === SPACING (4px grid) === */
  --space-1:  0.25rem;  --space-2:  0.5rem;   --space-3:  0.75rem;
  --space-4:  1rem;     --space-5:  1.25rem;  --space-6:  1.5rem;
  --space-8:  2rem;     --space-10: 2.5rem;   --space-12: 3rem;
  --space-16: 4rem;     --space-20: 5rem;     --space-24: 6rem;
}

/* LIGHT MODE — 白天 Dashboard 模式 */
[data-theme="light"] {
  --color-bg:               #F0F4F8;
  --color-surface:          #FFFFFF;
  --color-surface-2:        #F7FAFC;
  --color-surface-3:        #EDF2F7;
  --color-surface-raised:   #FFFFFF;
  --color-divider:          #E2E8F0;
  --color-border:           #CBD5E0;
  --color-text:             #1A202C;
  --color-text-muted:       #718096;
  --color-text-faint:       #A0AEC0;
  --color-text-inverse:     #FFFFFF;
  --color-primary:          #00897B;  /* 亮色模式 cyan 轉深綠 */
  --color-primary-dim:      #00796B;
  --color-primary-glow:     oklch(from #00897B l c h / 0.12);
  --color-primary-surface:  oklch(from #00897B l c h / 0.08);
  --shadow-sm:  0 1px 3px oklch(0.2 0.01 220 / 0.08);
  --shadow-md:  0 4px 16px oklch(0.2 0.01 220 / 0.10);
  --shadow-lg:  0 12px 40px oklch(0.2 0.01 220 / 0.14);
  --shadow-glow: 0 0 30px oklch(from #00897B l c h / 0.15);
}
```

---

## 3. 字體系統

### 字體選擇邏輯

| 角色 | 字體 | 理由 |
|------|------|------|
| Display (標題、TEI 數字大字) | **Outfit** (Google Fonts) | 幾何人文混血，精密工程感，不冷漠 |
| Body (說明文字、標籤) | **Inter** (Google Fonts) | 最高可讀性，不搶視覺焦點 |
| Numeric / Monospace (HRV 數值、毫秒) | **JetBrains Mono** | 儀器感，等寬防跳動 |

```html
<!-- 字體載入順序 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300..700&family=Inter:wght@300..600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

```css
--font-display: 'Outfit', 'SF Pro Display', sans-serif;
--font-body:    'Inter', 'SF Pro Text', sans-serif;
--font-mono:    'JetBrains Mono', 'SF Mono', monospace;
```

### 字型比例

```css
/* Mobile-first fluid type scale */
--text-xs:   clamp(0.75rem,  0.7rem  + 0.25vw, 0.875rem);  /* 12-14px labels */
--text-sm:   clamp(0.875rem, 0.83rem + 0.22vw, 1rem);      /* 14-16px buttons */
--text-base: clamp(1rem,     0.96rem + 0.2vw,  1.125rem);  /* 16-18px body */
--text-lg:   clamp(1.125rem, 1rem    + 0.6vw,  1.5rem);    /* 18-24px subhead */
--text-xl:   clamp(1.5rem,   1.2rem  + 1.5vw,  2.5rem);    /* 24-40px section title */
--text-2xl:  clamp(2rem,     1.5rem  + 2.5vw,  3.5rem);    /* TEI 大數字 */
--text-hero: clamp(3rem,     2rem    + 5vw,    5rem);       /* Hero 掃描數字 */
```

### 層次規則

```
Display font territory (--font-display):
  --text-hero  → TEI 分數大字、掃描結果
  --text-2xl   → Hero 標題
  --text-xl    → Section 標題

Body font territory (--font-body):
  --text-lg    → subheading, bold
  --text-base  → 主要內文
  --text-sm    → 按鈕、nav link
  --text-xs    → 標籤、時間戳記

Mono font territory (--font-mono):
  任何即時數值：HRV ms、bpm、精度 %  → tabular-nums + monospace
```

---

## 4. 核心元件規格

### 4.1 掃描按鈕 — The Stardust Orb

這是整個 App 最重要的元件。它不是「按鈕」，它是「啟動儀式」。

**視覺狀態機：**

```
IDLE        → 慢呼吸脈動 (scale 1.0 ↔ 1.03, 3s loop, --ease-breath)
             星塵粒子環繞 (canvas layer)
             邊緣 cyan glow 微明滅

PRESS       → 粒子向中心收縮 (0.3s --ease-organic)
             scale 0.95 觸感回饋

SCANNING    → 同心圓波紋向外擴散 (HRV-synced 頻率)
             粒子軌道加速
             進度弧線順時針掃描

REVEAL (2s) → 數字從模糊到清晰 (blur 8px → 0, opacity 0 → 1)
             粒子爆散後收斂成數字形狀
             精度條從左到右漸進填充

RESULT      → 根據狀態色變換 glow 顏色
             Clear → cyan  |  Neutral → amber  |  Strain → rose
```

**CSS 骨架：**

```css
.scan-orb {
  width: clamp(160px, 45vw, 220px);
  aspect-ratio: 1;
  border-radius: var(--radius-full);
  background: radial-gradient(
    ellipse at 30% 30%,
    var(--color-surface-3),
    var(--color-surface)
  );
  box-shadow: var(--shadow-glow);
  position: relative;
  cursor: pointer;
  /* 觸感：iOS 使用 Haptic Feedback API */
}

.scan-orb::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    var(--color-primary) 50%,
    transparent 100%
  );
  opacity: 0;
  animation: scan-rotate 2s linear infinite;
  transition: opacity var(--transition-base);
}

.scan-orb.scanning::before { opacity: 1; }

@keyframes scan-rotate {
  to { transform: rotate(360deg); }
}

@keyframes orb-breathe {
  0%, 100% { transform: scale(1.0); box-shadow: var(--shadow-glow); }
  50% { transform: scale(1.03); box-shadow: var(--shadow-glow), 0 0 80px oklch(from #00E5CC l c h / 0.3); }
}

.scan-orb.idle {
  animation: orb-breathe var(--transition-breath) infinite;
}
```

### 4.2 TEI 環形數字卡

```css
.tei-ring-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  padding: var(--space-8) var(--space-6);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.tei-score {
  font-family: var(--font-display);
  font-size: var(--text-hero);
  font-weight: 300;              /* 細線感更有科技感 */
  letter-spacing: -0.04em;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  transition: color var(--transition-slow);
}

/* 狀態色切換 */
.tei-score[data-state="clear"]   { color: var(--color-state-clear); }
.tei-score[data-state="neutral"] { color: var(--color-state-neutral); }
.tei-score[data-state="strain"]  { color: var(--color-state-strain); }

.precision-bar {
  width: 100%;
  height: 2px;
  background: var(--color-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.precision-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: inherit;
  transition: width 0.5s var(--ease-precise);
}
```

### 4.3 精度漸進揭露系統

這是 TENKI 的核心 UX 差異化。數字不是「突然出現」，而是「逐漸變清晰」。

```typescript
// 精度狀態機
type PrecisionStage = {
  label: string;       // "初步估計" | "精度提升" | "精準讀數"
  accuracy: number;    // 0.6 | 0.82 | 0.97
  sampleSeconds: number; // 2 | 30 | 60
  displayBlur: number; // CSS blur px: 4 | 2 | 0
};

const PRECISION_STAGES: PrecisionStage[] = [
  { label: '初步估計', accuracy: 0.60, sampleSeconds: 2,  displayBlur: 4 },
  { label: '精度提升', accuracy: 0.82, sampleSeconds: 30, displayBlur: 2 },
  { label: '精準讀數', accuracy: 0.97, sampleSeconds: 60, displayBlur: 0 },
];

// 動畫：數字模糊到清晰
// filter: blur(4px) → blur(0)
// opacity: 0.6 → 1
// 搭配 framer-motion 或 GSAP:
// gsap.to('.tei-score', { filter:'blur(0px)', opacity:1, duration:0.8, ease:'power2.out' })
```

### 4.4 HRV 波形元件

```css
.hrv-waveform {
  width: 100%;
  height: 64px;
  position: relative;
  overflow: hidden;
}

/* SVG path 使用 GSAP DrawSVG 動態繪製 */
.hrv-line {
  stroke: var(--color-primary);
  stroke-width: 1.5;
  fill: none;
  filter: drop-shadow(0 0 4px var(--color-primary-glow));
}

/* 漸層遮罩：左淡入 右淡出 */
.hrv-waveform::before,
.hrv-waveform::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  width: 48px;
  pointer-events: none;
  z-index: 1;
}
.hrv-waveform::before {
  left: 0;
  background: linear-gradient(to right, var(--color-surface), transparent);
}
.hrv-waveform::after {
  right: 0;
  background: linear-gradient(to left, var(--color-surface), transparent);
}
```

### 4.5 狀態 Badge

```css
.state-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.state-badge[data-state="clear"] {
  background: oklch(from #00E5CC l c h / 0.12);
  color: var(--color-state-clear);
  border: 1px solid oklch(from #00E5CC l c h / 0.25);
}

.state-badge[data-state="neutral"] {
  background: oklch(from #FFB347 l c h / 0.12);
  color: var(--color-state-neutral);
  border: 1px solid oklch(from #FFB347 l c h / 0.25);
}

.state-badge[data-state="strain"] {
  background: oklch(from #FF4D6D l c h / 0.12);
  color: var(--color-state-strain);
  border: 1px solid oklch(from #FF4D6D l c h / 0.25);
}

/* 狀態圓點 */
.state-badge::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: var(--radius-full);
  background: currentColor;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

### 4.6 按鈕系統

```css
/* Base */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  min-height: 44px;  /* 觸控最小尺寸 */
  cursor: pointer;
  border: none;
  transition: all var(--transition-base);
  -webkit-tap-highlight-color: transparent;
}

/* Primary — 主要行動 */
.btn-primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}
.btn-primary:hover  { background: var(--color-primary-dim); box-shadow: var(--shadow-md); }
.btn-primary:active { transform: scale(0.97); }

/* Ghost — 次要行動 */
.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
.btn-ghost:hover {
  background: var(--color-primary-surface);
  color: var(--color-primary);
  border-color: var(--color-primary-glow);
}

/* Danger */
.btn-danger {
  background: oklch(from #EF4444 l c h / 0.15);
  color: var(--color-error);
  border: 1px solid oklch(from #EF4444 l c h / 0.25);
}
```

---

## 5. 動效系統 — GSAP AI Skills 規格

### 5.1 AI 開發工作流（三步驟串聯）

```
第一步【雛形】Google Stitch
  → 輸入: "深暗色系、生物科技感 Dashboard，單一 cyan 主色"
  → 輸出: 多個畫面流程的早期品牌氛圍確立

第二步【精修】Claude Design
  → 將 Stitch 設計導入，利用強大設計推理微調 token 細節
  → 輸出: Handoff Bundle → 交付 Claude Code / Cursor

第三步【動畫工程】GSAP AI Skills
  → npx skills add gsap
  → 在本地端編輯器中，Claude Code / Cursor 擁有「動畫總監」能力
  → 加上精緻滾動特效、掃描動效、HRV 波形即時繪製
```

### 5.2 核心動效清單

```javascript
// ① Scan Orb 呼吸 (GSAP)
gsap.to('.scan-orb', {
  scale: 1.03,
  boxShadow: '0 0 80px oklch(from #00E5CC l c h / 0.3)',
  duration: 3,
  ease: 'sine.inOut',
  yoyo: true,
  repeat: -1,
});

// ② TEI 數字揭露 (GSAP)
const revealTimeline = gsap.timeline();
revealTimeline
  .to('.tei-score', {
    filter: 'blur(0px)',
    opacity: 1,
    duration: 0.8,
    ease: 'power2.out',
  })
  .to('.precision-fill', {
    width: '60%',  // 初步精度
    duration: 0.5,
    ease: 'power1.out',
  }, '<0.2')
  .to('.precision-label', {
    opacity: 1,
    y: 0,
    duration: 0.4,
  }, '<0.1');

// ③ HRV 波形即時繪製 (GSAP DrawSVG)
// 需要 GSAP DrawSVG Plugin
gsap.registerPlugin(DrawSVGPlugin);
gsap.fromTo('.hrv-line',
  { drawSVG: '0% 0%' },
  { drawSVG: '0% 100%', duration: 2, ease: 'power1.inOut' }
);

// ④ 粒子星塵系統 (Canvas API or Three.js)
// 見 src/components/StardustOrb/particles.ts
// 保留 v25.8.2 版星塵靈魂視覺代碼，僅調整色彩參數:
const PARTICLE_CONFIG = {
  baseColor:   { h: 177, s: 100, l: 45 }, // Tenki Cyan
  glowColor:   { h: 177, s: 100, l: 65 },
  count:       120,
  orbitRadius: { min: 0.4, max: 0.9 },
  speed:       { idle: 0.3, scanning: 1.2, reveal: 2.5 },
};

// ⑤ 數字計數動效 (GSAP)
const countUp = (el, from, to) => {
  gsap.fromTo(el,
    { textContent: from },
    {
      textContent: to,
      duration: 1.2,
      ease: 'power2.out',
      snap: { textContent: 1 },
      onUpdate() { el.textContent = Math.round(this.targets()[0].textContent); },
    }
  );
};

// ⑥ ScrollTrigger — Dashboard 日曆與歷史趨勢
gsap.registerPlugin(ScrollTrigger);
gsap.utils.toArray('.metric-card').forEach((card, i) => {
  gsap.fromTo(card,
    { opacity: 0, y: 20 },
    {
      opacity: 1,
      y: 0,
      duration: 0.6,
      delay: i * 0.08,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: card,
        start: 'top 90%',
      },
    }
  );
});
```

### 5.3 Reduced Motion 規則

```css
@media (prefers-reduced-motion: reduce) {
  .scan-orb         { animation: none !important; }
  .state-badge::before { animation: none !important; }
  /* 保留功能性 transition，移除裝飾性 animation */
}
```

---

## 6. 介面佈局架構

### 6.1 Mobile 主畫面層級

```
┌──────────────────────────────────┐  ← Safe Area Top
│  TENKI           [Avatar] [⚙]   │  Status Bar (44pt)
├──────────────────────────────────┤
│                                  │
│        ┌─────────────┐           │
│        │             │           │  ← Stardust Orb 區
│        │  Scan Orb   │           │     (佔螢幕 40% 高)
│        │  💫  TEI    │           │
│        │             │           │
│        └─────────────┘           │
│     [狀態 Badge: Clear]          │
│                                  │
├──────────────────────────────────┤
│  HRV波形  ───────────────────── │  ← 即時波形 (64pt)
├──────────────────────────────────┤
│                                  │
│  ┌──────────┐  ┌──────────────┐  │  ← 底部 Metric Cards
│  │ BPM: 72  │  │ HRV: 48ms   │  │
│  └──────────┘  └──────────────┘  │
│  ┌──────────┐  ┌──────────────┐  │
│  │精度: 82% │  │深掃: 28s    │  │
│  └──────────┘  └──────────────┘  │
│                                  │
├──────────────────────────────────┤
│  [🔍掃描]  [📊趨勢]  [🎯實驗室] │  ← Tab Bar (Safe Area Bottom)
└──────────────────────────────────┘
```

### 6.2 間距規則

```css
/* Mobile 安全區 */
.app-container {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-inline: var(--space-4);  /* 16px */
}

/* 主內容區 */
.main-content {
  padding-block: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  align-items: center;
}

/* 卡片格線 */
.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  width: 100%;
}

/* 數據卡片 */
.metric-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  min-height: 80px;
}
```

---

## 7. v25.8.2 星塵靈魂視覺整合規則

> **核心原則：不動視覺邏輯，只動色彩 token。**

整合時的修改清單（最小侵入）：

```typescript
// 找到粒子顏色設定，替換為 CSS 變數讀取
const getCSSVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// v25.8.2 原始代碼中的顏色硬編碼 → 替換
const particleColor = getCSSVar('--color-primary');       // '#00E5CC'
const glowColor     = getCSSVar('--color-primary-glow');  // oklch dim

// 張嘴/閉眼狀態同步 (Face ID expression data)
const syncFaceState = (expression: FaceExpression) => {
  if (expression.mouthOpen > 0.5) {
    orb.setMouthOpenState(true);    // 原始 v25.8.2 API
  }
  if (expression.eyesClosed > 0.7) {
    orb.setEyeClosedState(true);    // 原始 v25.8.2 API
  }
};
```

---

## 8. 可訪問性規範

| 要求 | 規格 |
|------|------|
| 對比度 | 主文字 `#E8EDF5` on `#0D1117` → 12.6:1 ✅ WCAG AAA |
| 觸控目標 | 所有互動元素 ≥ 44×44pt |
| Reduced Motion | 所有動效有靜態 fallback |
| 螢幕閱讀器 | `aria-label` 覆蓋所有 icon-only 元素 |
| 色盲友善 | 狀態不只用顏色，同時用 icon + 文字標籤 |
| 字型縮放 | 支援 iOS 動態字體 (Dynamic Type) |

---

## 9. 品牌一致性核查清單

每次 UI 新增前，對照 `BRAND.md` 確認：

- [ ] 是否使用批准的功能名稱？（Edge Score / Clear / Neutral / Strain）
- [ ] 沒有過度醫療化或過度金融化的語言？
- [ ] TEI 數字是否有「觀察性、相對性」免責語氣？
- [ ] Scan Orb 的星塵視覺是否完整保留 v25.8.2 核心？
- [ ] 新增動效是否有 `prefers-reduced-motion` 處理？
- [ ] 色彩是否只使用本文件定義的 token？

---

## 10. 參考資料

- `BRAND.md` — 品牌語言與定位
- `ANTIGRAVITY.md` — 完整技術架構
- `MEMORY.md` — 歷史決策記錄
- `src/components/StardustOrb/` — v25.8.2 視覺核心（不可隨意修改）
- [GSAP Documentation](https://gsap.com/docs/v3/)
- [GSAP DrawSVG Plugin](https://gsap.com/docs/v3/Plugins/DrawSVGPlugin/)
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)

---

*TENKI Design System v1.0 — 由創意總監 × Perplexity AI 合著*  
*Turn volatility into turning points.*
