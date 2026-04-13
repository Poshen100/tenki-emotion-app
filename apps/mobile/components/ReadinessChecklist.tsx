import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

interface ChecklistItem {
  key: string;
  label: string;
  ready: boolean;
  skippable?: boolean;
}

interface ReadinessChecklistProps {
  items: ChecklistItem[];
}

/**
 * Readiness checklist gate — all non-skippable items must pass
 * before the scan Start button is enabled.
 */
export function ReadinessChecklist({ items }: ReadinessChecklistProps) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View
          key={item.key}
          style={[styles.item, item.ready && styles.itemReady]}
        >
          <Text style={styles.icon}>{item.ready ? '✓' : '○'}</Text>
          <Text style={[styles.label, item.ready && styles.labelReady]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    width: '48%',
  },
  itemReady: {
    borderColor: '#31d7c6',
    backgroundColor: 'rgba(49, 215, 198, 0.08)',
  },
  icon: {
    fontSize: 14,
    color: colors.textTertiary,
    marginRight: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  labelReady: {
    color: '#31d7c6',
  },
});
