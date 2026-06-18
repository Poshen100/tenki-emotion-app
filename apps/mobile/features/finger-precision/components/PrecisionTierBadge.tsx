/**
 * @module finger-precision/components/PrecisionTierBadge
 * @description Capsule badge showing the current precision level.
 *
 * @version 1.0
 */

import type React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { fingerPrecisionTokens as t } from '../tokens/fingerPrecision.tokens';

interface PrecisionTierBadgeProps {
  tier: 'quick' | 'stable' | 'strong' | 'best';
  label: string;
}

export function PrecisionTierBadge({
  tier,
  label,
}: PrecisionTierBadgeProps): React.JSX.Element {
  const getColors = () => {
    switch (tier) {
      case 'best':
        return {
          bg: 'rgba(243, 169, 42, 0.12)',
          text: t.colors.precisionHigh,
        };
      case 'strong':
      case 'stable':
        return {
          bg: 'rgba(0, 212, 170, 0.12)',
          text: t.colors.precisionMid,
        };
      case 'quick':
      default:
        return {
          bg: 'rgba(0, 180, 216, 0.12)',
          text: t.colors.precisionLow,
        };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
