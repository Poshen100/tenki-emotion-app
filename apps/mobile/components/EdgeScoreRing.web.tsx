import { View, Text, StyleSheet } from 'react-native';
import { spacing, typography as typo, getZoneForScore } from '../theme';

interface EdgeScoreRingProps {
  score: number;
  size?: number;
}

/**
 * Circular Edge Score display — web fallback.
 * View-based ring for Expo Web; the native implementation
 * (EdgeScoreRing.native.tsx) renders the ring with Skia.
 */
export function EdgeScoreRing({ score, size = 200 }: EdgeScoreRingProps) {
  const zone = getZoneForScore(score);
  const ringWidth = 6;

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          borderColor: zone.bg,
        },
      ]}
    >
      <Text style={[typo.edgeScore, { color: zone.bg }]}>{score}</Text>
      <Text style={[styles.label, { color: zone.bg }]}>Edge Score</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: -spacing.xs,
  },
});
