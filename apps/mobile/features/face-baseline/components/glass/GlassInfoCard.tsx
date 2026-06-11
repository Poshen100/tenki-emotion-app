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
  const borderColor = isGold ? 'rgba(243, 169, 42, 0.32)' : 'rgba(0, 240, 255, 0.26)';
  const bg = isGold ? 'rgba(24, 18, 10, 0.82)' : 'rgba(8, 13, 28, 0.78)';
  const shadowColor = isGold ? t.color.accent.goldBloom : t.color.accent.cyanGlow;

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor, shadowColor }, style]}>
      {/* 3D bevel lighting border */}
      <View style={styles.innerHighlight} pointerEvents="none" />
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
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 8,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
  },
  neonAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
