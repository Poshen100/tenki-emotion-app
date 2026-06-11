/**
 * @module face-baseline/components/BaselineSuccessCard
 * @description Gold-edge secured confirmation card with a checkmark seal.
 *
 * INTEGRATION (Reanimated): checkmark draw + bloom pulse on reveal.
 */
import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBaselineHaptics } from '../../hooks/useBaselineHaptics';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { GlassInfoCard } from '../glass/GlassInfoCard';

interface BaselineSuccessCardProps {
  title: string;
  body: string;
}

export function BaselineSuccessCard({ title, body }: BaselineSuccessCardProps): React.JSX.Element {
  const haptics = useBaselineHaptics();

  useEffect(() => {
    haptics.trigger('success');
  }, [haptics]);

  return (
    <GlassInfoCard edge="gold" style={styles.card}>
      {/* Golden success seal with concentric pulsing halos - matches reference exactly */}
      <View style={styles.sealContainer}>
        <View style={styles.sealOuterHalo} />
        <View style={styles.sealInnerHalo} />
        <View style={styles.seal}>
          <Text style={styles.check}>✓</Text>
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </GlassInfoCard>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24 },
  sealContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: t.spacing.xl,
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
    borderWidth: 2.5,
    borderColor: '#FFC85E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    shadowColor: '#FFC85E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 4,
  },
  check: { color: '#FFC85E', fontSize: 32, fontWeight: '800', lineHeight: 36 },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
    paddingHorizontal: 8,
  },
});
