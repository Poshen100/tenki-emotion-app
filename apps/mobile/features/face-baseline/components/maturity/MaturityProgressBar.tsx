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
  const activeColor = t.progress.stageColors[stage];
  
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {STAGE_ORDER.map((s, i) => {
          const filled = i <= activeIndex;
          const isCurrent = i === activeIndex;
          
          return (
            <View
              key={s}
              style={[
                styles.segment,
                { 
                  backgroundColor: filled ? activeColor : 'rgba(255, 255, 255, 0.1)',
                  shadowColor: activeColor,
                  shadowOpacity: isCurrent ? 0.8 : 0,
                  shadowRadius: isCurrent ? 8 : 0,
                  elevation: isCurrent ? 4 : 0,
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.labels}>
        {STAGE_ORDER.map((s, i) => {
          const isCurrent = i === activeIndex;
          const isFilled = i <= activeIndex;
          
          return (
            <Text
              key={s}
              style={[
                styles.label, 
                isCurrent ? styles.labelActive : null,
                isFilled ? { color: activeColor } : null
              ]}
            >
              {labels[s]}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 12 },
  track: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 8, borderRadius: 4, shadowOffset: { width: 0, height: 0 } },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { flex: 1, textAlign: 'center', fontSize: 12, color: 'rgba(255, 255, 255, 0.35)', fontWeight: '500' },
  labelActive: { color: '#FFFFFF', fontWeight: '800' },
});
