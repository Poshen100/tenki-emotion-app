/**
 * @module face-baseline/components/GlassInfoCard
 * @description Frosted dark glass card. Edge color encodes intent:
 * `cyan` = educational, `gold` = trust / success / insight.
 *
 * INTEGRATION (expo-blur): wrap content in a BlurView for true frosted glass.
 * This core-RN version uses a translucent fill + bordered highlight.
 */
import type React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import type { AccentWorld } from '../../tokens/faceBaseline.tokens';

interface GlassInfoCardProps {
  edge?: AccentWorld;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GlassInfoCard({ edge = 'cyan', children, style }: GlassInfoCardProps): React.JSX.Element {
  const isGold = edge === 'gold';
  const borderColor = isGold ? 'rgba(243, 169, 42, 0.44)' : 'rgba(0, 240, 255, 0.38)';
  const bg = isGold ? 'rgba(20, 14, 8, 0.58)' : 'rgba(6, 10, 24, 0.55)';
  const shadowColor = isGold ? t.color.accent.goldBloom : t.color.accent.cyanGlow;

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor, shadowColor }, style]}>
      {/* 3D bevel lighting border */}
      <View style={styles.innerHighlight} pointerEvents="none" />
      {/* Frosted glass top-half sheen reflection */}
      <View style={styles.sheenReflection} pointerEvents="none" />
      <View style={styles.neonAccent} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: t.radius.card.xl,
    borderWidth: 1.5,
    padding: t.spacing.cardPad,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.65,
    shadowRadius: 36,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  innerHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: t.radius.card.xl - 1.5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
  },
  sheenReflection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
  },
  neonAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
