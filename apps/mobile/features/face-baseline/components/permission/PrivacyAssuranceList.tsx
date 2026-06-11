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
          <View style={styles.bullet}>
            <Text style={styles.bulletNum}>{i + 1}</Text>
          </View>
          <Text style={styles.text}>
            <Text style={styles.label}>{item.label}: </Text>
            <Text style={styles.detail}>{item.detail}</Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: t.spacing.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.md },
  bullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.surface.glassBlue,
    borderWidth: 1,
    borderColor: t.color.border.glassCyan,
    marginTop: 1,
  },
  bulletNum: { color: t.color.accent.cyanGlow, fontSize: 12, fontWeight: '700' },
  text: { flex: 1, fontSize: t.text.body.size, lineHeight: t.text.body.lineHeight },
  label: { color: t.color.text.primary, fontWeight: '600' },
  detail: { color: t.color.text.secondary },
});
