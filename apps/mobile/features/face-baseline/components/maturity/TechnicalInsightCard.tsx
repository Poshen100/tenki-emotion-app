/**
 * @module face-baseline/components/TechnicalInsightCard
 * @description Frosted blue-glass insight card with a gold letterspaced
 * "✦ TECHNICAL INSIGHT" kicker, on the maturity surface.
 */
import type React from 'react';
import { Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { GlassInfoCard } from '../glass/GlassInfoCard';

export function TechnicalInsightCard({ text }: { text: string }): React.JSX.Element {
  return (
    <GlassInfoCard edge="cyan">
      <Text style={styles.kicker}>✦  TECHNICAL INSIGHT</Text>
      <Text style={styles.body}>{text}</Text>
    </GlassInfoCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#FFC85E',
    marginBottom: t.spacing.sm,
    textTransform: 'uppercase',
  },
  body: { 
    fontSize: 15, 
    lineHeight: 22, 
    color: '#A6B0D3',
    fontWeight: '500',
  },
});
