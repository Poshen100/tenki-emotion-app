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
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.text}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: t.spacing.md, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFC85E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#FFC85E',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 12,
  },
  text: { color: t.color.text.primary, fontSize: 15, fontWeight: '500' },
});
