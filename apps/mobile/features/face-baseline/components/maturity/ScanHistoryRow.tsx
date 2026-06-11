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
  const dotColor = type === 'updated' ? '#00F0FF' : '#FFC85E';
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dotColor, shadowColor: dotColor }]} />
      <Text style={styles.time}>{time}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  time: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', width: 150 },
  label: { color: '#A6B0D3', fontSize: 14, fontWeight: '500', flex: 1, textAlign: 'right' },
});
