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
  if (status === 'pass') return '#00E699';
  if (status === 'fail') return '#FF4A4A';
  return '#A6B0D3';
}

function statusGlyph(status: CheckStatus): string {
  if (status === 'pass') return '✓';
  if (status === 'fail') return '✕';
  return '…';
}

function getIcon(key: string): string {
  if (key === 'lighting') return '☀️';
  if (key === 'distance') return '📐';
  if (key === 'stability') return '✋';
  return '•';
}

export function ChecklistRow({ item }: { item: ChecklistItem }): React.JSX.Element {
  const color = statusColor(item.status);
  const icon = getIcon(item.key);

  // Animated values for badge feedback
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Track status changes to fire micro-interactions
  const prevStatus = useRef<CheckStatus>(item.status);

  useEffect(() => {
    if (prevStatus.current !== item.status) {
      if (item.status === 'pass') {
        scaleAnim.setValue(0.5);
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }).start();
      } else if (item.status === 'fail') {
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

  const isPass = item.status === 'pass';

  return (
    <Animated.View style={[
      styles.row,
      isPass ? styles.rowPass : styles.rowFail,
      { transform: [{ translateX: shakeAnim }] }
    ]}>
      <View style={styles.left}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.label}>{item.label}</Text>
      </View>
      <Animated.View
        style={[
          styles.badge,
          {
            backgroundColor: color,
            borderColor: color,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.badgeGlyph}>{statusGlyph(item.status)}</Text>
      </Animated.View>
    </Animated.View>
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
  list: { gap: 10, alignSelf: 'center', width: '100%', paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 99,
    borderWidth: 1.5,
  },
  rowPass: {
    backgroundColor: 'rgba(12, 28, 20, 0.75)',
    borderColor: 'rgba(0, 230, 153, 0.35)',
  },
  rowFail: {
    backgroundColor: 'rgba(28, 14, 12, 0.75)',
    borderColor: 'rgba(255, 74, 74, 0.35)',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 16 },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontSize: 11, fontWeight: '900', color: '#030407' },
});
