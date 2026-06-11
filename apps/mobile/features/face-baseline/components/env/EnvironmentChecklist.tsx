/**
 * @module face-baseline/components/EnvironmentChecklist
 * @description Live pass/fail rows for Lighting / Distance / Stability,
 * styled as the reference's floating status pills.
 *
 * INTEGRATION (Reanimated): add the status-flip micro-bounce + fail shake.
 */
import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

export type CheckStatus = 'pass' | 'fail' | 'pending';

export interface ChecklistItem {
  key: string;
  label: string;
  status: CheckStatus;
}

function statusColor(status: CheckStatus): string {
  if (status === 'pass') return t.color.status.pass;
  if (status === 'fail') return t.color.status.fail;
  return t.color.text.tertiary;
}

function statusGlyph(status: CheckStatus): string {
  if (status === 'pass') return '✓';
  if (status === 'fail') return '✕';
  return '…';
}

export function ChecklistRow({ item }: { item: ChecklistItem }): React.JSX.Element {
  const color = statusColor(item.status);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{item.label}</Text>
      <View style={[styles.badge, { borderColor: color }]}>
        <Text style={[styles.badgeGlyph, { color }]}>{statusGlyph(item.status)}</Text>
      </View>
    </View>
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
  list: { gap: t.spacing.sm, alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 200,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.card.md,
    backgroundColor: t.color.surface.glass,
    borderWidth: 1,
    borderColor: t.color.border.hairline,
  },
  label: { color: t.color.text.primary, fontSize: t.text.body.size, fontWeight: '500' },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlyph: { fontSize: 12, fontWeight: '700' },
});
