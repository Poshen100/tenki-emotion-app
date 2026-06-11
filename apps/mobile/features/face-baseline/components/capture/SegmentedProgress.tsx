/**
 * @module face-baseline/components/SegmentedProgress
 * @description Thin 2-segment capture bar (neutral → motion). Pause dims the
 * fill; progress never visually resets on a transient quality dip.
 *
 * INTEGRATION (Reanimated): spring the fill width on progress change.
 */
import type React from 'react';
import { View, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { clamp01 } from '../../utils/progress';

interface SegmentedProgressProps {
  /** Overall progress 0–1 across all segments. */
  progress: number;
  segments?: number;
  accent?: 'cyan' | 'gold';
  paused?: boolean;
  width?: number;
}

export function SegmentedProgress({
  progress,
  segments = 2,
  accent = 'gold',
  paused = false,
  width = 220,
}: SegmentedProgressProps): React.JSX.Element {
  const fillColor = accent === 'gold' ? t.color.accent.goldSoft : t.color.accent.cyanGlow;
  const p = clamp01(progress);

  return (
    <View style={[styles.row, { width }]} accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(p * 100), min: 0, max: 100 }}>
      {Array.from({ length: segments }).map((_, i) => {
        const segStart = i / segments;
        const segFill = clamp01((p - segStart) * segments);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count segments; index is the segment's identity
          <View key={i} style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${segFill * 100}%`, backgroundColor: fillColor, opacity: paused ? 0.5 : 1 },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: t.progress.segmentGap, alignSelf: 'center' },
  track: {
    flex: 1,
    height: t.progress.barHeight,
    borderRadius: t.progress.barHeight / 2,
    backgroundColor: `rgba(255,255,255,${t.progress.trackOpacity})`,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: t.progress.barHeight / 2 },
});
