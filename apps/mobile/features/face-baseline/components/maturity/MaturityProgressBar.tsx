/**
 * @module face-baseline/components/MaturityProgressBar
 * @description 4-stage maturity track: New · Building · Ready · Mature.
 * The current stage and all earlier stages read as filled.
 *
 * INTEGRATION (Reanimated): spring the active-segment fill on stage advance.
 */
import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import type { MaturityStage } from '../../types/faceBaseline.types';
import { STAGE_ORDER } from '../../utils/maturityStage';

interface MaturityProgressBarProps {
  stage: MaturityStage;
  labels: Record<MaturityStage, string>;
}

export function MaturityProgressBar({ stage, labels }: MaturityProgressBarProps): React.JSX.Element {
  const activeIndex = STAGE_ORDER.indexOf(stage);
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {STAGE_ORDER.map((s, i) => {
          const filled = i <= activeIndex;
          return (
            <View
              key={s}
              style={[
                styles.segment,
                { backgroundColor: filled ? t.progress.stageColors[stage] : `rgba(255,255,255,${t.progress.trackOpacity})` },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.labels}>
        {STAGE_ORDER.map((s, i) => (
          <Text
            key={s}
            style={[styles.label, i === activeIndex ? styles.labelActive : null]}
          >
            {labels[s]}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: t.spacing.sm },
  track: { flexDirection: 'row', gap: t.progress.segmentGap },
  segment: { flex: 1, height: t.progress.barHeight, borderRadius: t.progress.barHeight / 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { flex: 1, textAlign: 'center', fontSize: t.text.caption.size, color: t.color.text.tertiary },
  labelActive: { color: t.color.text.primary, fontWeight: '600' },
});
