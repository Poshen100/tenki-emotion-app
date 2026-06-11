/**
 * @module face-baseline/components/MaturityProgressBar
 * @description 4-stage maturity track: New · Building · Ready · Mature.
 * The current stage and all earlier stages read as filled; the filled run is
 * painted with the cyan → teal → gold maturity ramp (real LinearGradient
 * slices per segment). Active label is white bold; others are tertiary.
 */
import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import type { MaturityStage } from '../../types/faceBaseline.types';
import { STAGE_ORDER } from '../../utils/maturityStage';

interface MaturityProgressBarProps {
  stage: MaturityStage;
  labels: Record<MaturityStage, string>;
}

/** Linearly interpolate between two hex colors (#RRGGBB). */
function lerpHex(a: string, b: string, f: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number): number => {
    const ca = (pa >> shift) & 0xff;
    const cb = (pb >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * f);
  };
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Sample the 3-stop maturity ramp (cyan → teal → gold) at fraction `f` ∈ [0,1]. */
function rampColor(f: number): string {
  const [c0, c1, c2] = t.gradient.maturityFill;
  if (f <= 0.5) return lerpHex(c0, c1, f * 2);
  return lerpHex(c1, c2, (f - 0.5) * 2);
}

export function MaturityProgressBar({ stage, labels }: MaturityProgressBarProps): React.JSX.Element {
  const activeIndex = STAGE_ORDER.indexOf(stage);
  const filledCount = activeIndex + 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        {STAGE_ORDER.map((s, i) => {
          const isCurrent = i === activeIndex;
          return (
            <Text key={s} style={[styles.label, isCurrent ? styles.labelActive : null]}>
              {labels[s]}
            </Text>
          );
        })}
      </View>
      <View style={styles.track}>
        {STAGE_ORDER.map((s, i) => {
          const filled = i <= activeIndex;
          const isCurrent = i === activeIndex;
          if (!filled) {
            return <View key={s} style={[styles.segment, styles.segmentEmpty]} />;
          }
          // gradient slice for this segment across the filled run
          const start = rampColor(i / filledCount);
          const end = rampColor((i + 1) / filledCount);
          return (
            <View
              key={s}
              style={[
                styles.segment,
                {
                  shadowColor: end,
                  shadowOpacity: isCurrent ? 0.8 : 0,
                  shadowRadius: isCurrent ? 8 : 0,
                  elevation: isCurrent ? 4 : 0,
                },
              ]}
            >
              <LinearGradient
                colors={[start, end]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8 },
  track: { flexDirection: 'row', gap: 6 },
  segment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
  },
  segmentEmpty: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { flex: 1, textAlign: 'center', fontSize: 13, color: t.color.text.tertiary, fontWeight: '600' },
  labelActive: { color: '#FFFFFF', fontWeight: '800' },
});
