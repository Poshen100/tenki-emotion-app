/**
 * @module face-baseline/components/RecoveryChecklist
 * @description Supportive fix-list on the Face Detection Recovery screen.
 * Tone is encouraging — this is recovery, never an error wall.
 */
import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

export function RecoveryChecklist({ items }: { items: readonly string[] }): React.JSX.Element {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item} style={styles.row}>
          <Text style={styles.check}>✓</Text>
          <Text style={styles.text}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: t.spacing.md, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  check: { color: t.color.status.pass, fontSize: 15, fontWeight: '700' },
  text: { color: t.color.text.secondary, fontSize: t.text.body.size },
});
