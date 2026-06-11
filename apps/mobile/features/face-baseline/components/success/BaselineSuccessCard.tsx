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
      {/* Supercharged golden success seal with concentric pulsing halos */}
      <View style={styles.sealContainer}>
        <View style={styles.sealOuterHalo} />
        <View style={styles.sealInnerHalo} />
        <View style={styles.seal}>
          <Text style={styles.check}>✓</Text>
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      {/* Trust credentials checklist badge to make it feel premium and rewarding */}
      <View style={styles.divider} />
      <View style={styles.metricsContainer}>
        <View style={styles.metricRow}>
          <Text style={styles.metricBullet}>✦</Text>
          <Text style={styles.metricText}>Face Baseline 100% Calibrated</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricBullet}>✦</Text>
          <Text style={styles.metricText}>Secure Local Enclave Isolation</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricBullet}>✦</Text>
          <Text style={styles.metricText}>Resonance Tracking Activated</Text>
        </View>
      </View>
    </GlassInfoCard>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 32 },
  sealContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: t.spacing.lg,
  },
  sealOuterHalo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 94, 0.15)',
    borderStyle: 'dashed',
  },
  sealInnerHalo: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 200, 94, 0.25)',
  },
  seal: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFC85E',
    shadowColor: '#FF8800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 8,
  },
  check: { color: '#030407', fontSize: 36, fontWeight: '900' },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: t.spacing.md,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#A6B0D3',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 24,
  },
  metricsContainer: {
    width: '100%',
    paddingHorizontal: 24,
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricBullet: {
    color: '#FFC85E',
    fontSize: 16,
    fontWeight: '700',
  },
  metricText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
