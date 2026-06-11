import { View, Text, StyleSheet } from 'react-native';
import { spacing, radius, getZoneForScore, zoneLabels, } from '../theme';

interface ZoneBadgeProps {
  score: number;
}

/**
 * Zone indicator badge showing Clear / Neutral / Strain
 * with zone-appropriate background color.
 */
export function ZoneBadge({ score }: ZoneBadgeProps) {
  const zone = getZoneForScore(score);

  return (
    <View style={[styles.badge, { backgroundColor: zone.bg }]}>
      <Text style={[styles.text, { color: zone.text }]}>
        {zoneLabels[zone.name]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
