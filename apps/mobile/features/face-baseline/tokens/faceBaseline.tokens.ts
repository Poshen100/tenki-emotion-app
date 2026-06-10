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
      deepSpace: '#05060A',
      nebulaTop: '#1A1140',
      nebulaBottom: '#0A0B12',
      dim: '#070811',
      processing: '#08060B',
      successVignette: '#100A04',
    },
    surface: {
      glass: 'rgba(16,20,34,0.62)',
      glassBlue: 'rgba(20,40,70,0.55)',
      glassGold: 'rgba(40,30,10,0.5)',
    },
    accent: {
      cyanGlow: '#3DE0FF',
      electricBlue: '#4DA6FF',
      indigo: '#6E8BFF',
      violet: '#7B61FF',
      goldResonance: '#E8B45A',
      goldSoft: '#FFD27A',
      goldHi: '#FFE9B0',
      goldBloom: '#FF9D2F',
    },
    status: {
      pass: '#46E0B0',
      caution: '#FFC24B',
      fail: '#FF6B6B',
    },
    text: {
      primary: '#F4F6FF',
      secondary: '#A6ADC8',
      tertiary: '#5A6178',
      onGlow: '#0A0B12',
    },
    trust: {
      pillBg: 'rgba(180,210,255,0.14)',
      pillText: '#BFD8FF',
    },
    frame: {
      idle: 'rgba(180,200,255,0.35)',
      tracking: '#3DE0FF',
      locked: '#46E0B0',
      capture: '#FFD27A',
    },
    border: {
      glassCyan: 'rgba(120,200,255,0.35)',
      glassGold: 'rgba(232,180,90,0.45)',
      hairline: 'rgba(255,255,255,0.08)',
    },
  },
  text: {
    wordmark: { size: 13, weight: '600', tracking: 3 },
    hero: { size: 30, lineHeight: 36, weight: '700', tracking: -0.4 },
    cardTitle: { size: 20, lineHeight: 26, weight: '600' },
    title: { size: 17, lineHeight: 22, weight: '600' },
    body: { size: 15, lineHeight: 22, weight: '400' },
    metric: { size: 50, lineHeight: 54, weight: '300', variant: 'tabular-nums' },
    pill: { size: 13, lineHeight: 16, weight: '600' },
    caption: { size: 11, lineHeight: 15, weight: '400' },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, gutter: 24, cardPad: 22, ctaDock: 24 },
  radius: {
    pill: 9999,
    card: { md: 16, xl: 24 },
    scanFrame: { lg: 28 },
    halo: 9999,
    badge: 14,
  },
  stroke: { hairline: 1, reticle: 2, halo: 4, progressBar: 3, ringArc: 6, glassBorder: 1 },
  shadow: {
    card: { color: '#000000', opacity: 0.45, radius: 18, y: 10 },
    ctaCyan: { color: '#3DE0FF', opacity: 0.32, radius: 24, y: 8 },
    ctaGold: { color: '#E8B45A', opacity: 0.34, radius: 24, y: 8 },
  },
  glow: {
    cta: {
      primaryCyan: { color: '#4DA6FF', blur: 24, spread: 0.35 },
      primaryGold: { color: '#E8B45A', blur: 24, spread: 0.35 },
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
