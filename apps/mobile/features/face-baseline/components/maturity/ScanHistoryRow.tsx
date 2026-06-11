/**
 * @module face-baseline/components/ScanHistoryRow
 * @description One Daily Scan History entry: time + outcome label.
 */
import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

interface ScanHistoryRowProps {
  time: string;
  label: string;
  type: 'updated' | 'refined';
}

export function ScanHistoryRow({ time, label, type }: ScanHistoryRowProps): React.JSX.Element {
  const dot = type === 'updated' ? t.color.accent.cyanGlow : t.color.accent.goldSoft;
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={styles.time}>{time}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: t.spacing.sm, gap: t.spacing.md },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  time: { color: t.color.text.secondary, fontSize: t.text.body.size, width: 96 },
  label: { color: t.color.text.tertiary, fontSize: t.text.body.size, flex: 1 },
});
