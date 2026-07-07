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

export { zones, getZoneForScore, zoneLabels } from './zones';
export type { ZoneName } from './zones';

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

