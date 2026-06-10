/**
 * @module face-baseline/components/ResonanceWaveGlyph
 * @description The cyan interlaced-wave brand motif ("Personal Resonance").
 * Core-RN approximation built from layered bars; faithful to the reference.
 *
 * INTEGRATION (Skia): replace with two phase-shifted sine paths + glow and a
 * slow phase oscillation. Keep the cyan ramp.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

interface ResonanceWaveGlyphProps {
  size?: number;
}

const BAR_HEIGHTS = [10, 20, 34, 48, 34, 20, 10, 20, 34, 48, 34, 20, 10] as const;

export function ResonanceWaveGlyph({ size = 120 }: ResonanceWaveGlyphProps): React.JSX.Element {
  return (
    <View style={[styles.wrap, { width: size, height: size * 0.6 }]} accessibilityRole="image">
      <View style={styles.row}>
        {BAR_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: h, backgroundColor: i % 2 === 0 ? t.color.accent.cyanGlow : t.color.accent.indigo },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bar: { width: 2.5, borderRadius: 2 },
});
