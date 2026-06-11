/**
 * @module face-baseline/components/ProcessingOrb
 * @description Gold "securing" orb with 3 orbiting light rings + percent readout.
 *
 * Pure RN Animated — the rings rotate on separate axes, the outer glow pulses
 * with progress intensity, and the sphere brightens near 100%.
 * Skia upgrade path: replace the ring Views with Skia arc paths + blur.
 *
 * @version 3.1
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';
import { clamp01 } from '../../utils/progress';

interface ProcessingOrbProps {
  /** 0–1. */
  progress: number;
  size?: number;
}

export function ProcessingOrb({ progress, size = 200 }: ProcessingOrbProps): React.JSX.Element {
  const clampedProgress = clamp01(progress);

  // Ring rotations — 3 rings at different speeds
  const ring1Rot = useRef(new Animated.Value(0)).current;
  const ring2Rot = useRef(new Animated.Value(0)).current;
  const ring3Rot = useRef(new Animated.Value(0)).current;

  // Outer glow pulse
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeRing = (anim: Animated.Value, dur: number) =>
      Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: dur,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );

    const r1 = makeRing(ring1Rot, 4000);
    const r2 = makeRing(ring2Rot, 5500);
    const r3 = makeRing(ring3Rot, 7000);

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    r1.start();
    r2.start();
    r3.start();
    glow.start();

    return () => { r1.stop(); r2.stop(); r3.stop(); glow.stop(); };
  }, [ring1Rot, ring2Rot, ring3Rot, glowPulse]);

  // Interpolations
  const spin1 = ring1Rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = ring2Rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const spin3 = ring3Rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const glowOp = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4 + clampedProgress * 0.2, 0.7 + clampedProgress * 0.15],
  });

  // Size-derived measurements
  const orbSize = size;
  const ringOuterSize = size * 0.88;
  const ringMidSize = size * 0.68;
  const ringInnerSize = size * 0.48;

  return (
    <View style={[styles.container, { width: size * 1.5, height: size * 1.5 }]}>
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: size,
            opacity: glowOp,
          },
        ]}
      />

      {/* Main sphere */}
      <View
        style={[
          styles.orb,
          {
            width: orbSize,
            height: orbSize,
            borderRadius: orbSize / 2,
          },
        ]}
      >
        {/* Orbiting ring 1 — outermost, tilted */}
        <Animated.View
          style={[
            styles.ring,
            {
              width: ringOuterSize,
              height: ringOuterSize,
              borderRadius: ringOuterSize / 2,
              transform: [{ rotate: spin1 }, { rotateX: '65deg' }],
            },
          ]}
        />

        {/* Orbiting ring 2 — mid, different tilt */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring2,
            {
              width: ringMidSize,
              height: ringMidSize,
              borderRadius: ringMidSize / 2,
              transform: [{ rotate: spin2 }, { rotateX: '45deg' }, { rotateY: '30deg' }],
            },
          ]}
        />

        {/* Orbiting ring 3 — innermost */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring3,
            {
              width: ringInnerSize,
              height: ringInnerSize,
              borderRadius: ringInnerSize / 2,
              transform: [{ rotate: spin3 }, { rotateX: '75deg' }, { rotateZ: '20deg' }],
            },
          ]}
        />

        {/* Bright core — intensifies with progress */}
        <View
          style={[
            styles.core,
            {
              width: size * 0.22,
              height: size * 0.22,
              borderRadius: size * 0.11,
              opacity: 0.3 + clampedProgress * 0.5,
            },
          ]}
        />
      </View>
    </View>
  );
}

/** Large tabular percent numeral, shown beneath the orb. */
export function PercentReadout({ progress }: { progress: number }): React.JSX.Element {
  const pct = Math.round(clamp01(progress) * 100);
  return <Text style={styles.percent}>{pct}%</Text>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(255,157,47,0.08)',
    shadowColor: t.color.accent.goldBloom,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 48,
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.color.border.glassGold,
    backgroundColor: 'rgba(40,30,10,0.45)',
    shadowColor: t.color.accent.goldResonance,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
  },
  ring: {
    position: 'absolute',
    borderWidth: t.stroke.ringArc,
    borderColor: 'transparent',
    borderTopColor: t.color.accent.goldSoft,
    borderRightColor: 'rgba(232,180,90,0.4)',
  },
  ring2: {
    borderTopColor: t.color.accent.goldHi,
    borderRightColor: 'rgba(255,210,122,0.3)',
    borderWidth: t.stroke.ringArc - 1,
  },
  ring3: {
    borderTopColor: t.color.accent.goldBloom,
    borderRightColor: 'rgba(255,157,47,0.35)',
    borderWidth: t.stroke.ringArc - 2,
  },
  core: {
    backgroundColor: t.color.accent.goldSoft,
    shadowColor: t.color.accent.goldSoft,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
  percent: {
    fontSize: t.text.metric.size,
    lineHeight: t.text.metric.lineHeight,
    fontWeight: '300',
    color: t.color.accent.goldSoft,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
