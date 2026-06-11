/**
 * @module face-baseline/components/BaselineSuccessCard
 * @description Gold-edge secured confirmation card with a checkmark seal.
 *
 * INTEGRATION (Reanimated): checkmark draw + bloom pulse on reveal.
 */
import type React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { GlassInfoCard } from '../glass/GlassInfoCard';

interface BaselineSuccessCardProps {
  title: string;
  body: string;
}

export function BaselineSuccessCard({ title, body }: BaselineSuccessCardProps): React.JSX.Element {
  return (
    <GlassInfoCard edge="gold" style={styles.card}>
      <View style={styles.seal}>
        <Text style={styles.check}>✓</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </GlassInfoCard>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center' },
  seal: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: t.color.border.glassGold,
    marginBottom: t.spacing.md,
    shadowColor: t.color.accent.goldResonance,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  check: { color: t.color.accent.goldSoft, fontSize: 26, fontWeight: '700' },
  title: {
    fontSize: t.text.cardTitle.size,
    fontWeight: '700',
    color: t.color.text.primary,
    textAlign: 'center',
    marginBottom: t.spacing.sm,
  },
  body: {
    fontSize: t.text.body.size,
    lineHeight: t.text.body.lineHeight,
    color: t.color.text.secondary,
    textAlign: 'center',
  },
});
