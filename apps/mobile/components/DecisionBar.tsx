import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../theme';

interface DecisionBarProps {
  label?: string;
  duration?: string;
  onPress?: () => void;
}

export function DecisionBar({
  label = 'Health Stress',
  duration = '3:00',
  onPress,
}: DecisionBarProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* left: signal icon + label */}
      <View style={styles.left}>
        <Text style={styles.icon}>〜</Text>
        <View>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.duration}>{duration} ▾</Text>
        </View>
      </View>

      {/* center: CTA */}
      <Text style={styles.cta}>START DECISION</Text>

      {/* right: controls */}
      <View style={styles.controls}>
        <Text style={styles.dots}>• •</Text>
        <View style={styles.addBtn}>
          <Text style={styles.addText}>+</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  icon: {
    fontSize: 18,
    color: '#4CAF50',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  duration: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  cta: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dots: {
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 3,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontSize: 16,
    color: colors.textTertiary,
    lineHeight: 20,
  },
});
