/**
 * @module face-baseline/components/TrustShield
 * @description Gold permission trust emblem (the SECURED accent).
 * Core-RN shield silhouette with a soft gold glow.
 *
 * INTEGRATION (Skia): replace with a gradient shield + inner sheen and a
 * gentle breathing glow; add a grant pulse on permission accept.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

export function TrustShield({ size = 96 }: { size?: number }): React.JSX.Element {
  // Sparkle animation values
  const pulse1 = useRef(new Animated.Value(0.3)).current;
  const pulse2 = useRef(new Animated.Value(0.6)).current;
  const pulse3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const startPulse = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.2,
            duration: 1600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startPulse(pulse1, 0);
    startPulse(pulse2, 400);
    startPulse(pulse3, 800);
  }, [pulse1, pulse2, pulse3]);

  return (
    <View style={[styles.container, { width: size * 1.6, height: size * 1.6 }]}>
      {/* Soft gold radial halo — layered concentric translucent circles */}
      <View style={[styles.haloRing, { width: size * 1.6, height: size * 1.6, borderRadius: size * 0.8, backgroundColor: 'rgba(243, 169, 42, 0.05)' }]} />
      <View style={[styles.haloRing, { width: size * 1.3, height: size * 1.3, borderRadius: size * 0.65, backgroundColor: 'rgba(243, 169, 42, 0.08)' }]} />
      <View style={[styles.goldGlow, { width: size * 1.05, height: size * 1.05, borderRadius: size }]} />

      {/* Floating Stardust Particles */}
      <Animated.View style={[styles.particle, { top: '15%', left: '15%', opacity: pulse1, transform: [{ scale: pulse1 }] }]} />
      <Animated.View style={[styles.particle, { top: '25%', right: '10%', opacity: pulse2, transform: [{ scale: pulse2 }] }]} />
      <Animated.View style={[styles.particle, { bottom: '20%', left: '20%', opacity: pulse3, transform: [{ scale: pulse3 }] }]} />
      <Animated.View style={[styles.particle, { bottom: '30%', right: '15%', opacity: pulse1, transform: [{ scale: pulse1 }] }]} />
      <Animated.View style={[styles.particle, { top: '55%', right: '25%', opacity: pulse2, transform: [{ scale: pulse2 }] }]} />
      <Animated.View style={[styles.particle, { top: '5%', right: '45%', opacity: pulse3, transform: [{ scale: pulse3 }] }]} />

      {/* Styled Glass Shield */}
      <View style={[styles.shield, { width: size * 0.9, height: size * 1.1 }]}>
        {/* Inner Highlight to create reflection sheen */}
        <View style={styles.sheen} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  goldGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(243, 169, 42, 0.13)',
    shadowColor: '#FFB81C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
  },
  haloRing: {
    position: 'absolute',
  },
  shield: {
    borderWidth: 1.5,
    borderColor: '#FFC85E',
    backgroundColor: 'rgba(30, 22, 8, 0.55)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ skewY: '-15deg' }],
  },
  particle: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFF0D0',
    shadowColor: '#FFC85E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
});
