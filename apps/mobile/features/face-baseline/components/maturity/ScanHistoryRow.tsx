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

function StardustWave(): React.JSX.Element {
  return (
    <View style={styles.waveContainer}>
      <View style={[styles.waveDot, { transform: [{ translateY: 2 }] }]} />
      <View style={[styles.waveDot, { transform: [{ translateY: -1 }] }]} />
      <View style={[styles.waveDot, { transform: [{ translateY: -3 }] }]} />
      <View style={[styles.waveDot, { transform: [{ translateY: 0 }] }]} />
      <View style={[styles.waveDot, { transform: [{ translateY: 2 }] }]} />
      <View style={[styles.waveDot, { transform: [{ translateY: -1 }] }]} />
      <View style={[styles.waveDot, { transform: [{ translateY: 1 }] }]} />
    </View>
  );
}

export function ScanHistoryRow({ time, label, type }: ScanHistoryRowProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.time}>{time}</Text>
      <StardustWave />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  time: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', width: 140 },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
    justifyContent: 'center',
  },
  waveDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: '#FFC85E',
    opacity: 0.6,
  },
  label: { color: '#A6B0D3', fontSize: 14, fontWeight: '500', width: 120, textAlign: 'right' },
});
