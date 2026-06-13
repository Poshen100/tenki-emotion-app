/**
 * @module face-baseline/components/EnvironmentChecklist
 * @description Live pass/fail rows for Lighting / Centering / Stillness,
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
import { BlurView } from 'expo-blur';

export type CheckStatus = 'pass' | 'fail' | 'pending';

export interface ChecklistItem {
  key: string;
  label: string;
  status: CheckStatus;
}

function statusColor(status: CheckStatus): string {
  if (status === 'pass') return '#4CD964'; // iOS green
  if (status === 'fail') return '#FF3B30'; // iOS red
  return 'rgba(255, 255, 255, 0.2)';
}

function statusGlyph(status: CheckStatus): string {
  if (status === 'pass') return '✓';
  if (status === 'fail') return '✕';
  return '…';
}

function getIcon(key: string): string {
  if (key === 'lighting') return '☀️';
  if (key === 'distance') return '🎯'; // centering
  if (key === 'stability') return '✋'; // stillness
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

  return (
    <Animated.View style={[
      styles.row,
      { transform: [{ translateX: shakeAnim }] }
    ]}>
      {/* frosted capsule backdrop */}
      <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.frostFill} pointerEvents="none" />
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
  list: { gap: 10, alignSelf: 'center', alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 168,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 99,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  frostFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 11, 20, 0.45)',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 15 },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', lineHeight: 13 },
});
