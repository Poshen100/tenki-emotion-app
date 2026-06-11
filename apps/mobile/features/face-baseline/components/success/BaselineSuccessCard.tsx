/**
 * @module face-baseline/components/BaselineSuccessCard
 * @description Gold-edge secured confirmation card with a checkmark seal.
 *
 * INTEGRATION (Reanimated): checkmark draw + bloom pulse on reveal.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useBaselineHaptics } from '../../hooks/useBaselineHaptics';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { GlassInfoCard } from '../glass/GlassInfoCard';

interface BaselineSuccessCardProps {
  title: string;
  body: string;
}

export function BaselineSuccessCard({ title, body }: BaselineSuccessCardProps): React.JSX.Element {
  const haptics = useBaselineHaptics();

  // Seal animation values
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const particlePulse = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    // Trigger success haptic
    haptics.trigger('success');

    // Run spring mount animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Loop particle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(particlePulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(particlePulse, {
          toValue: 0.2,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [haptics, scaleAnim, opacityAnim, particlePulse]);

  return (
    <GlassInfoCard edge="gold" style={styles.card}>
      {/* Golden success seal with concentric pulsing halos - matches reference exactly */}
      <Animated.View style={[styles.sealContainer, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        <View style={styles.sealOuterHalo} />
        <View style={styles.sealInnerHalo} />
        
        {/* Pulsing golden particles around the seal */}
        <Animated.View style={[styles.successParticle, { top: -10, left: 10, opacity: particlePulse, transform: [{ scale: particlePulse }] }]} />
        <Animated.View style={[styles.successParticle, { top: 20, right: -12, opacity: particlePulse, transform: [{ scale: particlePulse }] }]} />
        <Animated.View style={[styles.successParticle, { bottom: -8, left: 24, opacity: particlePulse, transform: [{ scale: particlePulse }] }]} />
        <Animated.View style={[styles.successParticle, { bottom: 16, right: -8, opacity: particlePulse, transform: [{ scale: particlePulse }] }]} />

        <View style={styles.seal}>
          <Text style={styles.check}>✓</Text>
        </View>
      </Animated.View>

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
  successParticle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF0D0',
    shadowColor: '#FFC85E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  title: {
    fontSize: 28,
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
    paddingHorizontal: 8,
  },
});
