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

// Specular shine layer to make the sphere look 3D glass
function GlassSpecularShine({ size }: { size: number }): React.JSX.Element {
  return (
    <>
      <View
        style={{
          position: 'absolute',
          top: size * 0.04,
          left: size * 0.1,
          width: size * 0.72,
          height: size * 0.28,
          borderRadius: size * 0.36,
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          transform: [{ rotate: '-28deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.08,
          right: size * 0.14,
          width: size * 0.3,
          height: size * 0.1,
          borderRadius: size * 0.05,
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          transform: [{ rotate: '45deg' }],
        }}
      />
    </>
  );
}

// Swirling golden dust particle inside the glass orb
function SwirlingSparkle({
  angle,
  radius,
  duration,
  size,
}: {
  angle: number;
  radius: number;
  duration: number;
  size: number;
}): React.JSX.Element {
  const rotAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotAnim, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [rotAnim, duration]);

  const rotate = rotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [`${angle}deg`, `${angle + 360}deg`],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFF0D0',
        shadowColor: '#FF8800',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
        transform: [
          { rotate },
          { translateY: radius },
        ],
      }}
    />
  );
}

export function ProcessingOrb({ progress, size = 220 }: ProcessingOrbProps): React.JSX.Element {
  const clampedProgress = clamp01(progress);

  // Concentric ring animations
  const ring1Rot = useRef(new Animated.Value(0)).current;
  const ring2Rot = useRef(new Animated.Value(0)).current;
  const ring3Rot = useRef(new Animated.Value(0)).current;
  const ring4Rot = useRef(new Animated.Value(0)).current;

  // Outer glow pulse
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeRing = (anim: Animated.Value, dur: number, reverse = false) =>
      Animated.loop(
        Animated.timing(anim, {
          toValue: reverse ? -1 : 1,
          duration: dur,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );

    const r1 = makeRing(ring1Rot, 5000);
    const r2 = makeRing(ring2Rot, 7500, true);
    const r3 = makeRing(ring3Rot, 9000);
    const r4 = makeRing(ring4Rot, 12000, true);

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    r1.start();
    r2.start();
    r3.start();
    r4.start();
    glow.start();

    return () => {
      r1.stop();
      r2.stop();
      r3.stop();
      r4.stop();
      glow.stop();
    };
  }, [ring1Rot, ring2Rot, ring3Rot, ring4Rot, glowPulse]);

  // Rotations
  const spin1 = ring1Rot.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });
  const spin2 = ring2Rot.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });
  const spin3 = ring3Rot.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });
  const spin4 = ring4Rot.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });

  const glowOp = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.65],
  });

  // Derived sizes
  const orbSize = size;
  const r1Size = size * 0.94;
  const r2Size = size * 0.82;
  const r3Size = size * 0.66;
  const r4Size = size * 0.48;

  return (
    <View style={[styles.container, { width: size * 1.5, height: size * 1.5 }]}>
      {/* Intense golden ambient nebula glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.45,
            height: size * 1.45,
            borderRadius: size,
            opacity: glowOp,
          },
        ]}
      />

      {/* Main glass marble container */}
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
        {/* Glass base shading layers */}
        <View style={styles.glassBaseGradient} />

        {/* Orbiting ring 1 — Outer ring */}
        <Animated.View
          style={[
            styles.ring,
            {
              width: r1Size,
              height: r1Size,
              borderRadius: r1Size / 2,
              transform: [{ rotate: spin1 }, { rotateX: '55deg' }, { rotateY: '10deg' }],
            },
          ]}
        />

        {/* Orbiting ring 2 — Mid ring */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring2,
            {
              width: r2Size,
              height: r2Size,
              borderRadius: r2Size / 2,
              transform: [{ rotate: spin2 }, { rotateX: '65deg' }, { rotateY: '-25deg' }],
            },
          ]}
        />

        {/* Orbiting ring 3 — Inner ring */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring3,
            {
              width: r3Size,
              height: r3Size,
              borderRadius: r3Size / 2,
              transform: [{ rotate: spin3 }, { rotateX: '40deg' }, { rotateY: '35deg' }],
            },
          ]}
        />

        {/* Orbiting ring 4 — Tiny core ring */}
        <Animated.View
          style={[
            styles.ring,
            styles.ring4,
            {
              width: r4Size,
              height: r4Size,
              borderRadius: r4Size / 2,
              transform: [{ rotate: spin4 }, { rotateX: '70deg' }, { rotateZ: '-15deg' }],
            },
          ]}
        />

        {/* Dense gold stardust sparkles floating inside the marble */}
        <SwirlingSparkle angle={0} radius={size * 0.35} duration={3800} size={5} />
        <SwirlingSparkle angle={120} radius={size * 0.28} duration={4600} size={4} />
        <SwirlingSparkle angle={240} radius={size * 0.42} duration={5200} size={3.5} />
        <SwirlingSparkle angle={60} radius={size * 0.22} duration={3100} size={4.5} />
        <SwirlingSparkle angle={180} radius={size * 0.31} duration={4900} size={3} />
        <SwirlingSparkle angle={300} radius={size * 0.16} duration={4100} size={5} />

        {/* Specs of white highlight light */}
        <GlassSpecularShine size={size} />

        {/* Supercharged golden particle core */}
        <View
          style={[
            styles.core,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              opacity: 0.45 + clampedProgress * 0.55,
              transform: [
                {
                  scale: glowPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1.15],
                  }),
                },
              ],
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
    backgroundColor: 'rgba(255, 136, 0, 0.08)',
    shadowColor: '#FF8800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 54,
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 200, 100, 0.35)',
    backgroundColor: 'rgba(28, 16, 6, 0.45)', // gold warm base tint
    shadowColor: '#FF8800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 40,
    position: 'relative',
    overflow: 'hidden',
  },
  glassBaseGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 9999,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: '#FFC85E',
    borderRightColor: 'rgba(255, 200, 94, 0.3)',
    borderLeftColor: 'rgba(255, 200, 94, 0.1)',
  },
  ring2: {
    borderTopColor: '#FFFFFF',
    borderRightColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1.5,
  },
  ring3: {
    borderTopColor: '#FF8800',
    borderRightColor: 'rgba(255, 136, 0, 0.35)',
    borderWidth: 2.5,
  },
  ring4: {
    borderTopColor: '#FFF0D0',
    borderRightColor: 'rgba(255, 240, 208, 0.25)',
    borderWidth: 1,
  },
  core: {
    backgroundColor: '#FFC85E',
    shadowColor: '#FF8800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
  },
  percent: {
    fontSize: t.text.metric.size,
    lineHeight: t.text.metric.lineHeight,
    fontWeight: '800', // extra bold for premium impact
    color: '#FFC85E',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
});
