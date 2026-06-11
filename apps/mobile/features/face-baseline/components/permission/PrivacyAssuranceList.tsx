/**
 * @module face-baseline/components/PrivacyAssuranceList
 * @description Numbered privacy guarantees (On-Device / Calibration-only /
 * No photos saved). Restrained, flat, high legibility.
 */
import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

export interface AssuranceItem {
  label: string;
  detail: string;
}

interface PrivacyAssuranceListProps {
  items: readonly AssuranceItem[];
}

export function PrivacyAssuranceList({ items }: PrivacyAssuranceListProps): React.JSX.Element {
  return (
    <View style={styles.list}>
      {items.map((item, i) => (
        <View key={item.label} style={styles.row}>
          <View style={styles.bullet} />
          <Text style={styles.text}>
            <Text style={styles.label}>{i + 1}. {item.label}: </Text>
            <Text style={styles.detail}>{item.detail}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: t.spacing.lg, paddingHorizontal: t.spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.md },
  bullet: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    marginTop: 3,
  },
  text: { flex: 1, fontSize: t.text.body.size, lineHeight: t.text.body.lineHeight },
  label: { color: '#FFFFFF', fontWeight: '700' },
  detail: { color: t.color.text.secondary },
});
