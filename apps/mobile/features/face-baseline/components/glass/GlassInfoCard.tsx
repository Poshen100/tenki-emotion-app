/**
 * @module face-baseline/components/GlassInfoCard
 * @description Frosted dark glass card built on expo-blur. Edge color encodes
 * intent: `cyan` = educational, `gold` = trust / success / insight.
 *
 * Real frost: a `<BlurView>` (CSS backdrop-filter on web) wrapped with
 * overflow hidden, a translucent white fill, a hairline white inner border,
 * and a per-edge accent tint along the top.
 *
 * @version 3.2
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import type React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import type { AccentWorld } from '../../tokens/faceBaseline.tokens';

interface GlassInfoCardProps {
  edge?: AccentWorld;
  /** Stretch the card to fill its flex parent (large hero cards). */
  fill?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function GlassInfoCard({ edge = 'cyan', fill = false, children, style }: GlassInfoCardProps): React.JSX.Element {
  const isGold = edge === 'gold';
  const borderColor = isGold ? 'rgba(243, 169, 42, 0.38)' : 'rgba(120, 200, 255, 0.22)';
  const edgeTint = isGold ? 'rgba(255, 200, 94, 0.35)' : 'rgba(86, 232, 255, 0.35)';
  const shadowColor = isGold ? t.color.accent.goldBloom : t.color.accent.cyanGlow;
  const flexFill = fill ? styles.fill : null;

  return (
    <View style={[styles.shadowWrap, flexFill, { shadowColor }]}>
      <View style={[styles.clip, flexFill, { borderColor }]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        {/* translucent glass fill above the blur */}
        <View style={styles.glassFill} pointerEvents="none" />
        {/* hairline white inner border */}
        <View style={styles.innerHairline} pointerEvents="none" />
        {/* top sheen reflection */}
        <View style={styles.sheenReflection} pointerEvents="none" />
        {/* accent edge tint along the top */}
        <View style={[styles.edgeAccent, { backgroundColor: edgeTint }]} pointerEvents="none" />
        <View style={[styles.content, flexFill, style]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shadowWrap: {
    borderRadius: t.radius.card.xl,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 36,
    elevation: 12,
  },
  clip: {
    borderRadius: t.radius.card.xl,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  glassFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  innerHairline: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: t.radius.card.xl - 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheenReflection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  edgeAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  content: {
    padding: t.spacing.cardPad,
  },
});
