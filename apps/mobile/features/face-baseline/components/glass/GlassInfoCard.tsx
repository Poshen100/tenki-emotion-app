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
  const borderColor = isGold ? t.color.border.glassGold : t.color.border.glassCyan;
  const bg = isGold ? t.color.surface.glassGold : t.color.surface.glassBlue;
  const shadowColor = isGold ? t.color.accent.goldResonance : t.color.accent.cyanGlow;

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor, shadowColor }, style]}>
      <View style={styles.innerHighlight} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: t.radius.card.xl,
    borderWidth: 1,
    padding: t.spacing.cardPad,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  innerHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: t.radius.card.xl - 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
});
