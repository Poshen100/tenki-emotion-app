/**
 * @module face-baseline/components/EnvironmentChecklist
 * @description Live pass/fail rows for Lighting / Distance / Stability,
 * styled as the reference's floating status pills.
 *
 * Uses Animated to drive status-flip micro-bounce for passing state and
 * horizontal shake for failing state.
 *
 * @version 3.1
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

export type CheckStatus = 'pass' | 'fail' | 'pending';

export interface ChecklistItem {
  key: string;
  label: string;
  status: CheckStatus;
}

function statusColor(status: CheckStatus): string {
  if (status === 'pass') return t.color.status.pass;
  if (status === 'fail') return t.color.status.fail;
  return t.color.text.tertiary;
}

function statusGlyph(status: CheckStatus): string {
  if (status === 'pass') return '✓';
  if (status === 'fail') return '✕';
  return '…';
}

export function ChecklistRow({ item }: { item: ChecklistItem }): React.JSX.Element {
  const color = statusColor(item.status);

  // Animated values for badge feedback
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Track status changes to fire micro-interactions
  const prevStatus = useRef<CheckStatus>(item.status);

  useEffect(() => {
    if (prevStatus.current !== item.status) {
      if (item.status === 'pass') {
        // Bounce effect
        scaleAnim.setValue(0.5);
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }).start();
      } else if (item.status === 'fail') {
        // Shake sequence
        shakeAnim.setValue(0);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -4, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
      }
      prevStatus.current = item.status;
    }
  }, [item.status, scaleAnim, shakeAnim]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{item.label}</Text>
      <Animated.View
        style={[
          styles.badge,
          {
            borderColor: color,
            transform: [
              { scale: scaleAnim },
              { translateX: shakeAnim },
            ],
          },
        ]}
      >
        <Text style={[styles.badgeGlyph, { color }]}>{statusGlyph(item.status)}</Text>
      </Animated.View>
    </View>
  );
}

export function EnvironmentChecklist({ items }: { items: readonly ChecklistItem[] }): React.JSX.Element {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <ChecklistRow key={item.key} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: t.spacing.sm, alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 220,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.card.md,
    backgroundColor: t.color.surface.glass,
    borderWidth: 1,
    borderColor: t.color.border.hairline,
  },
  label: { color: t.color.text.primary, fontSize: t.text.body.size, fontWeight: '500' },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontSize: 12, fontWeight: '700' },
});
