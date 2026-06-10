/**
 * @module face-baseline/components/TechnicalInsightCard
 * @description Gold-edge insight card on the maturity surface.
 */
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { GlassInfoCard } from '../glass/GlassInfoCard';

export function TechnicalInsightCard({ text }: { text: string }): React.JSX.Element {
  return (
    <GlassInfoCard edge="gold">
      <Text style={styles.kicker}>Technical Insight</Text>
      <Text style={styles.body}>{text}</Text>
    </GlassInfoCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: t.text.pill.size,
    fontWeight: '700',
    letterSpacing: 1,
    color: t.color.accent.goldSoft,
    marginBottom: t.spacing.sm,
  },
  body: { fontSize: t.text.body.size, lineHeight: t.text.body.lineHeight, color: t.color.text.secondary },
});
