/**
 * @module face-baseline/tokens
 * @description Design tokens for the TENKI Face Baseline system.
 * Derived from the 9 canonical reference frames (see ../SPEC.md).
 *
 * Unifying law:
 *   - cyan / electric blue  = ACTIVE  (scan, setup, guidance, pre-baseline CTAs)
 *   - aurora gold           = SECURED (resonance, success, trust, maturity CTAs)
 *
 * Pure data only — no React Native imports — so it is consumable from
 * components, animations, and tests alike.
 *
 * @version 3.0
 * @see apps/mobile/features/face-baseline/SPEC.md
 */

/** TENKI Face Baseline design tokens. */
export const faceBaselineTokens = {
  color: {
    bg: {
      deepSpace: '#030407',
      nebulaTop: '#1E124D',
      nebulaBottom: '#040508',
      dim: '#05060D',
      processing: '#060309',
      successVignette: '#140A02',
    },
    surface: {
      glass: 'rgba(8,11,24,0.72)',
      glassBlue: 'rgba(10,25,55,0.65)',
      glassGold: 'rgba(30,22,8,0.6)',
    },
    accent: {
      cyanGlow: '#00F0FF',
      electricBlue: '#3399FF',
      indigo: '#5A7DFF',
      violet: '#704BFF',
      goldResonance: '#F3A92A',
      goldSoft: '#FFC85E',
      goldHi: '#FFF0D0',
      goldBloom: '#FF8800',
    },
    status: {
      pass: '#00E699',
      caution: '#FFB81C',
      fail: '#FF4A4A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#A6B0D3',
      tertiary: '#5D6683',
      onGlow: '#030407',
    },
    trust: {
      pillBg: 'rgba(0,240,255,0.08)',
      pillText: '#99F6FF',
    },
    frame: {
      idle: 'rgba(150,180,255,0.25)',
      tracking: '#00F0FF',
      locked: '#00E699',
      capture: '#FFC85E',
    },
    border: {
      glassCyan: 'rgba(0,240,255,0.25)',
      glassGold: 'rgba(243,169,42,0.35)',
      hairline: 'rgba(255,255,255,0.06)',
    },
  },
  text: {
    wordmark: { size: 14, weight: '700', tracking: 4 },
    hero: { size: 35, lineHeight: 44, weight: '800', tracking: -0.6 },
    cardTitle: { size: 24, lineHeight: 30, weight: '700' },
    title: { size: 19, lineHeight: 25, weight: '700' },
    body: { size: 16, lineHeight: 24, weight: '400' },
    metric: { size: 56, lineHeight: 60, weight: '300', variant: 'tabular-nums' },
    pill: { size: 14, lineHeight: 18, weight: '700' },
    caption: { size: 12, lineHeight: 16, weight: '400' },
  },
  spacing: { xs: 6, sm: 10, md: 18, lg: 28, xl: 36, xxl: 54, gutter: 26, cardPad: 24, ctaDock: 28 },
  radius: {
    pill: 9999,
    card: { md: 18, xl: 28 },
    scanFrame: { lg: 32 },
    halo: 9999,
    badge: 16,
  },
  stroke: { hairline: 1, reticle: 2, halo: 4, progressBar: 4, ringArc: 7, glassBorder: 1.5 },
  shadow: {
    card: { color: '#000000', opacity: 0.6, radius: 24, y: 12 },
    ctaCyan: { color: '#00F0FF', opacity: 0.45, radius: 28, y: 10 },
    ctaGold: { color: '#F3A92A', opacity: 0.45, radius: 28, y: 10 },
  },
  glow: {
    cta: {
      primaryCyan: { color: '#00F0FF', blur: 30, spread: 0.45 },
      primaryGold: { color: '#F3A92A', blur: 30, spread: 0.45 },
    },
    glassCyan: { color: '#3DE0FF', blur: 18, spread: 0.25 },
    glassGold: { color: '#E8B45A', blur: 18, spread: 0.28 },
    lockMint: { color: '#46E0B0', blur: 28, spread: 0.5 },
    haloCyan: { color: '#3DE0FF', blur: 40, spread: 0.6 },
    soulGold: { color: '#FFD27A', blur: 36, spread: 0.7 },
    orbGold: { color: '#FF9D2F', blur: 48, spread: 0.8 },
    shieldGold: { color: '#E8B45A', blur: 32, spread: 0.6 },
    resonance: { color: '#7FE9D0', blur: 44, spread: 0.7 },
  },
  glass: { blur: 24, bgOpacity: 0.62, borderOpacity: 0.35, innerHighlight: 0.06 },
  progress: {
    trackOpacity: 0.18,
    barHeight: 6,
    segmentGap: 4,
    stageColors: { new: '#5A6178', building: '#3DE0FF', ready: '#7FE9D0', mature: '#E8B45A' },
  },
  motion: {
    duration: {
      introFade: 400,
      ctaGlowIn: 240,
      ctaBreath: 2400,
      lockSnap: 320,
      lockPulse: 360,
      haloSweep: 1200,
      particleStabilize: 900,
      processingOrb: 2400,
      processingMin: 1800,
      carouselPage: 380,
      percentTick: 800,
      successPulse: 520,
      maturityFill: 700,
      screenCrossfade: 600,
    },
    easing: {
      standard: 'cubic-bezier(0.4,0,0.2,1)',
      decelerate: 'cubic-bezier(0,0,0.2,1)',
      snap: 'cubic-bezier(0.2,0.9,0.1,1)',
      breath: 'cubic-bezier(0.45,0,0.55,1)',
      gentle: 'cubic-bezier(0.33,0,0.2,1)',
    },
  },
  overlay: {
    nebulaDim: 0.55,
    captureVignette: 0.7,
    scrim: 0.4,
    disabledCta: 0.3,
    particleAdditive: 0.85,
  },
} as const;

/** CTA / glow accent worlds: `cyan` = active, `gold` = secured. */
export type AccentWorld = 'cyan' | 'gold';

export type FaceBaselineTokens = typeof faceBaselineTokens;
