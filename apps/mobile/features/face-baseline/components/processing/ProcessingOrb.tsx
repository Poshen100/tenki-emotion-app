/**
 * @module face-baseline/components/ProcessingOrb
 * @description Gold "securing" orb with orbiting rings + percent readout.
 *
 * INTEGRATION (Skia + Reanimated): render a gold sphere with 3-axis orbiting
 * light rings; accelerate + brighten near 100%. Reduced-motion = slow pulse.
 * This core-RN version is a static glowing orb holding the percent.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { clamp01 } from '../../utils/progress';

interface ProcessingOrbProps {
  /** 0–1. */
  progress: number;
  size?: number;
}

export function ProcessingOrb({ progress, size = 200 }: ProcessingOrbProps): React.JSX.Element {
  const pct = Math.round(clamp01(progress) * 100);
  return (
    <View style={[styles.glow, { width: size * 1.3, height: size * 1.3, borderRadius: size }]}>
      <View style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.ring, { width: size * 0.82, height: size * 0.82, borderRadius: size }]} />
        <View style={[styles.ring, styles.ring2, { width: size * 0.58, height: size * 0.58, borderRadius: size }]} />
      </View>
    </View>
  );
}

/** Large tabular percent numeral, shown beneath the orb. */
export function PercentReadout({ progress }: { progress: number }): React.JSX.Element {
  const pct = Math.round(clamp01(progress) * 100);
  return <Text style={styles.percent}>{pct}%</Text>;
}

const styles = StyleSheet.create({
  glow: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,157,47,0.05)',
    shadowColor: t.color.accent.goldBloom,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 48,
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.color.border.glassGold,
    backgroundColor: 'rgba(40,30,10,0.5)',
  },
  ring: {
    position: 'absolute',
    borderWidth: t.stroke.ringArc,
    borderColor: 'transparent',
    borderTopColor: t.color.accent.goldSoft,
    borderRightColor: t.color.accent.goldResonance,
    transform: [{ rotate: '30deg' }],
  },
  ring2: { borderTopColor: t.color.accent.goldHi, transform: [{ rotate: '-40deg' }] },
  percent: {
    fontSize: t.text.metric.size,
    lineHeight: t.text.metric.lineHeight,
    fontWeight: '300',
    color: t.color.accent.goldSoft,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
