/**
 * @module design-tokens
 * @description TENKI CORE v3 Design Token System.
 * Updated for 3-zone system and privacy-first cognitive wellness branding.
 *
 * @version 3.0
 * @see ANTIGRAVITY.md v3.0 Section 1.2
 */

/** TENKI CORE v3 design tokens — colors, typography, animation, spacing. */
export const TENKI_THEME = {
  /** Readiness zone colors (v3: 3 zones). */
  zones: {
    clear:   { bg: '#00B4D8', text: '#FFFFFF', range: [70, 100] as const },
    neutral: { bg: '#E5E5EA', text: '#1C1C1E', range: [40, 69] as const },
    strain:  { bg: '#5E3A87', text: '#FFFFFF', range: [0, 39] as const },
  },
  /** Session governance bar UI. */
  sessionBar: {
    height: 72,
    expandedHeight: 200,
    background: 'rgba(28, 28, 30, 0.92)',
    blur: 20,
    completeFlash: '#34C759',
    dotActive: '#FFFFFF',
    dotInactive: '#48484A',
    dotCheckmark: '#34C759',
  },
  /** Typography system. */
  typography: {
    edgeScore: { fontSize: 72, fontWeight: '200' as const, fontFamily: 'SF Pro Display' },
    timerDisplay: { fontSize: 28, fontWeight: '600' as const, fontFamily: 'SF Pro Display', fontVariant: ['tabular-nums'] as const },
    label: { fontSize: 11, fontWeight: '500' as const },
    bodyText: { fontSize: 15, fontWeight: '400' as const, fontFamily: 'SF Pro Text' },
    caption: { fontSize: 11, fontWeight: '400' as const, color: '#8E8E93' },
    headline: { fontSize: 20, fontWeight: '600' as const, fontFamily: 'SF Pro Display' },
  },
  /** Animation parameters. */
  animation: {
    /** EWMA smoothing for score display. */
    scoreTransition: { type: 'ewma' as const, alpha: 0.05 },
    /** Message rotation interval (ms). */
    messageInterval: 3000,
    /** Warm-up period before first reading (ms). */
    warmUp: 8000,
    /** Session complete flash duration (ms). */
    sessionComplete: 800,
  },
  /** Base color palette. */
  colors: {
    background: '#000000',
    surface: '#1C1C1E',
    card: '#2C2C2E',
    border: '#38383A',
    primary: '#00B4D8',
    success: '#34C759',
    warning: '#F5A623',
    error: '#FF3B30',
    textPrimary: '#FFFFFF',
    textSecondary: '#8E8E93',
    textTertiary: '#48484A',
  },
  /** Spacing scale. */
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  /** Border radius. */
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  /** Scan result page tokens. */
  scanResult: {
    /** Dual-ring gauge dimensions. */
    ring: {
      size: 260,
      outerRadius: 116,
      innerRadius: 90,
      outerWidth: 14,
      innerWidth: 8,
      /** Ring start angle (radians) — lower-left (~8 o'clock). */
      startAngle: Math.PI * 0.74,
    },
    /** 12-stop spectrum gradient for outer ring (cyan → green → yellow → orange → red). */
    spectrum: [
      [0, 180, 180],   // teal
      [0, 190, 140],   // teal-green
      [40, 200, 100],  // green
      [80, 210, 60],   // yellow-green
      [140, 210, 50],  // lime
      [190, 200, 40],  // yellow-green
      [220, 180, 35],  // golden
      [240, 155, 30],  // amber
      [250, 125, 35],  // orange
      [255, 100, 45],  // deep orange
      [255, 80, 50],   // red-orange
      [255, 65, 55],   // red
    ] as const,
    /** Inner ring gradient: green → cyan. */
    innerGradient: {
      start: [82, 236, 145] as const,  // green
      end: [38, 201, 235] as const,    // cyan
    },
    /** Bento metric card colors. */
    sparklines: {
      hr: '#FF453A',
      hrv: '#67EA8E',
      rr: '#20D7F2',
    },
    /** Bento card dimensions. */
    bentoCard: {
      radius: 20,
      padding: 16,
      gap: 12,
    },
    /** Bottom navigation. */
    bottomNav: {
      height: 72,
      safeBottom: 24,
      background: 'rgba(15, 23, 42, 0.92)',
      blur: 24,
      activeColor: '#22D3EE',
      inactiveColor: '#475569',
    },
    /** Deep space background. */
    background: '#020617',
  },
} as const;
