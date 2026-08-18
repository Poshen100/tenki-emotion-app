/**
 * @module face-baseline/components/ProcessingOrb
 * @description Gold "securing" orb with 3 orbiting light rings + percent readout.
 *
 * Pure RN Animated — the rings rotate on separate axes, the outer glow pulses
 * with progress intensity, and the sphere brightens near 100%.
 * Skia upgrade path: replace the ring Views with Skia arc paths + blur.
 *
 * @version 3.1
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import type React from 'react';
import { Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { clamp01 } from '../../utils/progress';
import { ProcessingOrbSkia } from './ProcessingOrbSkia';
import type { SensoryFrame } from '../../utils/choreography';
import type { Tilt } from '../../utils/orbPhysics';

interface ProcessingOrbProps {
  progress: number;
  size?: number;
  /** Live signal state; a progress-derived frame is used when absent. */
  frame?: SensoryFrame;
  /** Device tilt for parallax. */
  tilt?: Tilt;
  /** Baseline maturity, 0–1. */
  maturityRatio?: number;
}

export function ProcessingOrb({
  progress,
  size = 220,
  frame,
  tilt,
  maturityRatio,
}: ProcessingOrbProps): React.JSX.Element {
  return (
    <ProcessingOrbSkia
      progress={progress}
      size={size}
      frame={frame}
      tilt={tilt}
      maturityRatio={maturityRatio}
    />
  );
}

/** Large tabular percent numeral, shown beneath the orb. */
export function PercentReadout({ progress }: { progress: number }): React.JSX.Element {
  const pct = Math.round(clamp01(progress) * 100);
  return <Text style={styles.percent}>{pct}%</Text>;
}

const styles = StyleSheet.create({
  percent: {
    fontSize: t.text.metric.size,
    lineHeight: t.text.metric.lineHeight,
    fontWeight: t.text.metric.weight,
    color: t.color.accent.goldWarm,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
});
