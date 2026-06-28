/**
 * @module theme
 * @description TENKI Core mobile theme adapter.
 * Re-exports design tokens from packages/shared and provides
 * React Native-specific StyleSheet helpers.
 *
 * @version 3.0
 * @see packages/shared/src/design-tokens.ts
 */

import { StyleSheet } from 'react-native';

/**
 * TENKI Core v3 design tokens — adapted for React Native.
 * Mirrors packages/shared/src/design-tokens.ts TENKI_THEME.
 */
export const colors = {
  background: '#000000',
  surface: '#1C1C1E',
  card: '#2C2C2E',
  border: '#38383A',
  cardBorder: '#38383A',
  primary: '#00B4D8',
  success: '#34C759',
  warning: '#F5A623',
  error: '#FF3B30',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#48484A',
} as const;

// keep in sync with @tenki/shared design-tokens brand spine (zone tones)
export const zones = {
  clear:   { bg: '#00B4D8', text: '#FFFFFF', range: [70, 100] as const },
  neutral: { bg: '#64748B', text: '#FFFFFF', range: [40, 69] as const },
  strain:  { bg: '#C2703D', text: '#FFFFFF', range: [0, 39] as const },
} as const;

export type ZoneName = keyof typeof zones;

// keep in sync with @tenki/shared design-tokens TENKI_THEME.ocean
export const ocean = {
  gradient: { top: '#0A1628', bottom: '#050A14' },
  auroraTeal: '#5FE9D0',
  auroraAmber: '#FFC68A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = StyleSheet.create({
  edgeScore: {
    fontSize: 72,
    fontWeight: '200',
    color: colors.textPrimary,
  },
  timerDisplay: {
    fontSize: 28,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  headline: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textSecondary,
  },
});

/** Returns zone config for a given Edge Score (0-100). */
export function getZoneForScore(score: number): { name: ZoneName; bg: string; text: string } {
  if (score >= 70) return { name: 'clear', bg: zones.clear.bg, text: zones.clear.text };
  if (score >= 40) return { name: 'neutral', bg: zones.neutral.bg, text: zones.neutral.text };
  return { name: 'strain', bg: zones.strain.bg, text: zones.strain.text };
}

/** Zone display labels (safe, compliance-checked wording). */
export const zoneLabels: Record<ZoneName, string> = {
  clear: 'Clear',
  neutral: 'Neutral',
  strain: 'Strain',
} as const;
