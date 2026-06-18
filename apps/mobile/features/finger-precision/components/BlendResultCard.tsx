/**
 * @module finger-precision/components/BlendResultCard
 * @description Card showing the result of the multi-modal baseline blending.
 *
 * @version 1.0
 */

import type React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { fingerPrecisionTokens as t } from '../tokens/fingerPrecision.tokens';

interface BlendResultCardProps {
  blendModeText: string;
  confidenceUpliftText: string;
  beatsText: string;
  tierText: string;
}

export function BlendResultCard({
  blendModeText,
  confidenceUpliftText,
  beatsText,
  tierText,
}: BlendResultCardProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{blendModeText}</Text>
      
      <View style={styles.divider} />
      
      <View style={styles.row}>
        <Text style={styles.label}>Signal Improvement</Text>
        <Text style={styles.value}>{confidenceUpliftText}</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Heart Rhythm Beats</Text>
        <Text style={styles.value}>{beatsText}</Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Precision Calibration</Text>
        <Text style={styles.value}>{tierText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(243, 169, 42, 0.35)', // gold highlight
    padding: 24,
    width: '100%',
    marginVertical: 18,
    shadowColor: t.colors.precisionHigh,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EAF1F8',
    textAlign: 'center',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  label: {
    fontSize: 14,
    color: '#9DB2CC',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
