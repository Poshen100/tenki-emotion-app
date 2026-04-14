import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

type ScanUIState = 'idle' | 'searching' | 'detecting' | 'locked' | 'scanning' | 'processing' | 'results' | 'error';

interface StatusPillProps {
  state: ScanUIState;
}

const STATE_CONFIG: Record<ScanUIState, { label: string; color: string }> = {
  idle: { label: 'Ready', color: colors.textTertiary },
  searching: { label: 'Searching...', color: '#ff7a6f' },
  detecting: { label: 'Detecting', color: '#ffd46a' },
  locked: { label: 'Locked', color: '#31d7c6' },
  scanning: { label: 'Scanning', color: colors.primary },
  processing: { label: 'Processing', color: colors.primary },
  results: { label: 'Complete', color: colors.success },
  error: { label: 'Error', color: colors.error },
};

/** Scan state indicator pill shown over the camera feed. */
export function StatusPill({ state }: StatusPillProps) {
  const config = STATE_CONFIG[state];

  return (
    <View style={[styles.pill, { borderColor: config.color }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: radius.full,
    borderWidth: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
