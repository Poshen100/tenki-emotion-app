/**
 * @module face-baseline/components/TechnicalInsightCard
 * @description Gold-edge insight card on the maturity surface.
 */
import type React from 'react';
import { Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { GlassInfoCard } from '../glass/GlassInfoCard';

export function TechnicalInsightCard({ text }: { text: string }): React.JSX.Element {
  return (
    <GlassInfoCard edge="gold">
      <Text style={styles.kicker}>✦  TECHNICAL INSIGHT</Text>
      <Text style={styles.body}>{text}</Text>
    </GlassInfoCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
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
