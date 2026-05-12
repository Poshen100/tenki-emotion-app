# TENKI Core — Logo & Brand Identity Spec v1.0

> **Status**: Production-ready
> **Last updated**: 2026-05-06
> **Decision**: **Pure Wave (Variant A)** is the primary logo. With-Circle (Variant B) is auxiliary.
> **Source files**: `brand/` directory (committed to repo root)

---

## 1. The Mark

TENKI Core's logo is a **white wave silhouette** — three flowing horizontal bands rising into a single crest at the top right. It evokes:

- **Tenki (天気)** — atmospheric weather, biorhythm
- **Tides** — emotional and physiological flow
- **Decision discipline** — a calm wave, not a crashing one

```
       ╭───────╮
       │   ⌒    │       ← The wave silhouette
       │  ≈≈≈   │       ← (white fill, no stroke)
       │ ≈≈≈≈≈  │
       │  ≈≈≈   │
       ╰───────╯
```

---

## 2. Variants

### A. Pure Wave (PRIMARY) ⭐

The wave silhouette without external framing.

**Use as default for everything.** Specifically:
- iOS / Android app icon (all sizes)
- Favicon (16, 32, 180, 192, 512)
- Watch complication
- Splash screen
- Web header
- Document headers
- Email signatures
- Social media avatar

**File**: `brand/logo/tenki-logo-pure-wave.svg`

### B. With Circle (AUXILIARY) — use only when needed

The wave inside an outer ring. Faithful to the original sketch.

**Use only when**:
- A formal document needs visual weight (printed cover, certificate)
- The wave alone feels too informal for a specific layout
- Pairing with other circular logos in a row (visual consistency)

**Do not use** for app icon or favicon — Variant A is cleaner and reads better at small sizes.

**File**: `brand/logo/tenki-logo-with-circle.svg`

### C. Mono Black (PRINT)

Black wave on transparent background, for monochrome printing.

**File**: `brand/logo/tenki-logo-mono-black.svg`

---

## 3. Color System

### Primary Palette

| Token | Hex | Usage |
|---|---|---|
| `--tenki-cyan` | `#00B4D8` | Primary brand color, CORE wordmark, Edge Score Optimal Zone |
| `--tenki-mint` | `#5ECCC5` | Secondary highlight |
| `--tenki-bg-deep` | `#0A1628` | Primary dark background ⭐ |
| `--tenki-bg-base` | `#050A14` | Gradient bottom |
| `--tenki-bg-teal` | `#001824` | Alternative dark bg (more product-aligned) |
| `--tenki-bg-black` | `#000000` | Pure black variant |
| `--tenki-white` | `#FFFFFF` | Wave fill, TENKI wordmark |
| `--tenki-tagline` | `rgba(255,255,255,0.55)` | Taglines and supporting text |

### Recommended App Icon Background

```css
background: linear-gradient(180deg, #0A1628 0%, #050A14 100%);
```

This is a vertical "midnight ocean" gradient — deep enough to feel premium, cool enough to make the wave pop, not pure black (which can look dead next to colorful neighbor icons).

---

## 4. Typography

### Wordmark — `TENKI`

```css
font-family: -apple-system, "SF Pro Display", "Inter", sans-serif;
font-weight: 200;          /* Ultra Light — non-negotiable */
letter-spacing: 0.32em;    /* Wide breathing */
text-transform: uppercase;
color: #FFFFFF;
```

### Sub-wordmark — `CORE`

```css
font-family: -apple-system, "SF Pro Display", sans-serif;
font-weight: 600;          /* Semibold */
letter-spacing: 0.4em;
font-size: 0.45 × TENKI size;
color: #00B4D8;
```

### Tagline — `Decision Infrastructure for Traders`

```css
font-family: -apple-system, "SF Pro Text", sans-serif;
font-weight: 400;
letter-spacing: 0.05em;
color: rgba(255,255,255,0.55);
```

---

## 5. Hard Rules — Don't Modify

```
❌ Don't rotate the wave (orientation is fixed: crest top-right)
❌ Don't change wave color (always white #FFFFFF on dark backgrounds)
❌ Don't add gradients to the wave itself
❌ Don't add glow/shadow/blur to the wave (the dark bg provides depth)
❌ Don't stretch (always preserve 1:1 aspect ratio for icon)
❌ Don't change TENKI letter-spacing (must be 0.32em, ~42px at 130pt)
❌ Don't use bold (700+) on TENKI — Ultra Light 200 is the brand voice
❌ Don't combine with other typefaces (only SF Pro Display / SF Pro Text)
❌ Don't use on light backgrounds (logo is dark-mode native)
❌ Don't use Variant B (with circle) for app icon — it loses detail at small sizes
```

---

## 6. Lockup Specifications

### Vertical Lockup (Splash Screen, 1170×2532)

```
[Wave Symbol]                          ← 520×520 px, vertical center 35% from top
        ↓ 80px gap
TENKI                                  ← 130pt SF Pro 200, letter-spacing 42px
        ↓ 18px gap
CORE                                   ← 58pt SF Pro 600 #00B4D8, letter-spacing 23px
                                       ← (with subtle 0 0 20px rgba(0,180,216,0.4) text-shadow)
                  ⋮
                  ⋮
Decision Infrastructure for Traders    ← bottom 140px from edge
                                       ← 22pt SF Pro Text 400, 55% white
```

### Horizontal Lockup (Web Header, 1200×320)

```
[Wave Symbol] ⎮ TENKI                 ← 200×200 wave + 96pt TENKI
   200×200    ⎮ CORE                  ← 38pt CORE below
              ↑
           48px gap between symbol and text
```

---

## 7. Asset Directory Layout

This is the structure delivered in the brand kit:

```
brand/
├── LOGO-SPEC.md                      ← This document
├── preview-A-vs-B.png                ← Visual comparison reference
│
├── logo/                             ← SVG sources
│   ├── tenki-logo-pure-wave.svg     ← ⭐ Primary
│   ├── tenki-logo-with-circle.svg   ← Auxiliary
│   └── tenki-logo-mono-black.svg    ← Print/black-and-white
│
├── icon-ios/                         ← iOS Asset Catalog
│   ├── icon-1024.png                 ← App Store
│   ├── icon-180-iphone-app@3x.png
│   ├── icon-167-ipad-pro-app@2x.png
│   ├── icon-152-ipad-app@2x.png
│   ├── icon-120-iphone-app@2x.png
│   ├── icon-87-iphone-settings@3x.png
│   ├── icon-80-spotlight@2x.png
│   ├── icon-76-ipad-app.png
│   ├── icon-60-iphone-app.png
│   ├── icon-58-iphone-settings@2x.png
│   ├── icon-40-spotlight.png
│   └── icon-29-iphone-settings.png
│
├── icon-android/                     ← Android density buckets
│   ├── ic_launcher-512.png           (Play Store)
│   ├── ic_launcher-xxxhdpi-192.png
│   ├── ic_launcher-xxhdpi-144.png
│   ├── ic_launcher-xhdpi-96.png
│   ├── ic_launcher-hdpi-72.png
│   └── ic_launcher-mdpi-48.png
│
├── favicon/                          ← Web
│   ├── favicon-16.png
│   ├── favicon-32.png
│   ├── apple-touch-icon-180.png
│   ├── android-chrome-192.png
│   └── android-chrome-512.png
│
└── marketing/                        ← Hero / promotional
    ├── splash-iphone-1170x2532.png
    ├── lockup-horizontal-1200x320.png
    └── og-card-1200x630.png
```

---

## 8. HTML `<head>` Snippet for Web Deployment

For `apps/web/index.html`, `apps/preview/v6/index.html`, and any other web entry, add:

```html
<!-- Favicon -->
<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/brand/favicon/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/brand/favicon/apple-touch-icon-180.png">
<link rel="icon" type="image/png" sizes="192x192" href="/brand/favicon/android-chrome-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/brand/favicon/android-chrome-512.png">

<!-- Open Graph -->
<meta property="og:title" content="TENKI Core">
<meta property="og:description" content="Decision Infrastructure for Traders">
<meta property="og:image" content="https://tenki-emotion-app.vercel.app/brand/marketing/og-card-1200x630.png">
<meta property="og:type" content="website">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://tenki-emotion-app.vercel.app/brand/marketing/og-card-1200x630.png">

<!-- Theme -->
<meta name="theme-color" content="#0A1628">
```

---

## 9. Splash Animation Behavior

When TENKI launches, follow this timing (for future React Native / Expo implementation):

```
0ms          Black screen
100ms        Wave silhouette fade in (opacity 0 → 1)
500ms        Wave subtle scale (0.96 → 1.0, ease-out)
700ms        TENKI wordmark fade in from 8px below
900ms        CORE wordmark fade in (with cyan glow pulse once)
1200ms       Tagline fade in
1500-2300ms  Hold
2300ms       Cross-fade to Today screen
```

---

## 10. Brand Voice

✅ **TENKI is**: Calm, precise, instrument-grade. Apple Watch × Bloomberg Terminal. Decision discipline, internal weather. Quiet authority.

❌ **TENKI is not**: Wellness pink, fitness orange, generic fintech blue. Crypto futurism. Glow-heavy mood-board aesthetic. Corporate banking.

---

## 11. Version History

| Version | Date | Notes |
|---|---|---|
| v1.0 | 2026-05-06 | Vectorized from original Image 3 via potrace. Pure Wave (A) chosen as primary. Full multi-size icon set generated. |

---

## 12. License

TENKI Core logo and brand identity © 2026 Poshen / Tenki Core.
All rights reserved. Internal use within Tenki Core product and marketing only.
External usage requires written permission.

---

## 13. Tagline System — see `TAGLINE-SYSTEM.md`

The full tagline system (Universal / Splash / Trader Mode) is documented separately in `TAGLINE-SYSTEM.md`. Quick reference:

| Tier | Tagline | Where |
|---|---|---|
| Universal (default) | Read your inner weather. / Find your turning point. | App Store, web, social, press |
| Splash | Return to baseline. / Find your turning point. | iOS / Android splash screen |
| Trader Mode | Decision Infrastructure for Traders / Turn volatility into turning points. | After settings toggle |
| Short CTA | Turn the weather. / 翻轉天氣 | Buttons, push notifications |

Visual mockups in `marketing/`:
- `splash-iphone-1170x2532.png` — splash with Tier 2 tagline
- `og-card-1200x630.png` — social share with Tier 1 tagline  
- `appstore-hero-1290x2796.png` — App Store with Tier 1 tagline
- `trader-mode-unlock-1170x2532.png` — Trader Mode with Tier 3 tagline
