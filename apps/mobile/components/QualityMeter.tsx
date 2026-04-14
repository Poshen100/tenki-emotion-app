import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

interface QualityMeterProps {
  label: string;
  value: number; // 0-100
}

/**
 * Horizontal quality meter bar (Coverage, Stability, Signal Quality).
 * Gradient fill: red → amber → teal based on value.
 */
export function QualityMeter({ label, value }: QualityMeterProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const fillColor = clampedValue >= 65 ? '#31d7c6' : clampedValue >= 40 ? '#ffd46a' : '#ff7a6f';

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: fillColor }]}>{clampedValue}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clampedValue}%`, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
  },
  track: {
    height: 8,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.sm,
  },
});
