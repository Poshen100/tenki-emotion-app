/**
 * @module face-baseline/components/ProcessingOrbFallback
 * @description The gold "securing" orb in core RN Animated, for every runtime
 * that has no Skia canvas — the web build, and Expo Go, which does not bundle
 * `@shopify/react-native-skia`.
 *
 * It is a simpler orb, not a fake one: the rings really turn and the sphere
 * really brightens with progress. What it cannot do is the blur and the
 * radial gradients, so a development build still looks better.
 *
 * Props mirror the Skia implementation exactly so a call site does not care
 * which one it got.
 */
import type React from 'react';
import { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { clamp01 } from '../../utils/progress';

interface ProcessingOrbFallbackProps {
  progress: number;
  size?: number;
  /**
   * Accepted for parity with the native implementation. The web build keeps
   * the simpler progress-driven rendering — declaring the props here means a
   * shared call site type-checks on both platforms.
   */
  frame?: unknown;
  tilt?: unknown;
  maturityRatio?: number;
}

function GlassSpecularShine({ size }: { size: number }): React.JSX.Element {
  return (
    <>
      {/* soft diffuse highlight */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.04,
          left: size * 0.1,
          width: size * 0.72,
          height: size * 0.28,
          borderRadius: size * 0.36,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          transform: [{ rotate: '-28deg' }],
        }}
      />
      {/* glass rim highlight: thin top-left white arc */}
      <View
        style={{
          position: 'absolute',
          top: size * 0.02,
          left: size * 0.02,
          width: size * 0.96,
          height: size * 0.96,
          borderRadius: size * 0.48,
          borderWidth: 1.5,
          borderColor: 'transparent',
          borderTopColor: 'rgba(255, 255, 255, 0.55)',
          borderLeftColor: 'rgba(255, 255, 255, 0.2)',
          transform: [{ rotate: '-18deg' }],
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

export function ProcessingOrbFallback({ progress, size = 220 }: ProcessingOrbFallbackProps): React.JSX.Element {
  const clampedProgress = clamp01(progress);

  const ring1Rot = useRef(new Animated.Value(0)).current;
  const ring2Rot = useRef(new Animated.Value(0)).current;
  const ring3Rot = useRef(new Animated.Value(0)).current;
  const ring4Rot = useRef(new Animated.Value(0)).current;
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

  const spin1 = ring1Rot.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });
  const spin2 = ring2Rot.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });
  const spin3 = ring3Rot.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });
  const spin4 = ring4Rot.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });

  const glowOp = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.65],
  });

  const orbSize = size;
  const r1Size = size * 0.94;
  const r2Size = size * 0.82;
  const r3Size = size * 0.66;
  const r4Size = size * 0.48;

  return (
    <View style={[styles.container, { width: size * 1.5, height: size * 1.5 }]}>
      {/* concentric translucent gold glow (radial falloff illusion) */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.glowStack, { opacity: glowOp }]}>
        <View style={[styles.glowRing, { width: size * 1.5, height: size * 1.5, borderRadius: size * 0.75, backgroundColor: 'rgba(255, 157, 47, 0.05)' }]} />
        <View style={[styles.glowRing, { width: size * 1.3, height: size * 1.3, borderRadius: size * 0.65, backgroundColor: 'rgba(255, 157, 47, 0.07)' }]} />
        <View style={[styles.glow, { width: size * 1.12, height: size * 1.12, borderRadius: size * 0.56 }]} />
      </Animated.View>
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
        <View style={styles.glassBaseGradient} />

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

        <SwirlingSparkle angle={0} radius={size * 0.36} duration={3200} size={5} />
        <SwirlingSparkle angle={20} radius={size * 0.34} duration={3400} size={3.5} />
        <SwirlingSparkle angle={40} radius={size * 0.32} duration={3600} size={4.5} />
        <SwirlingSparkle angle={60} radius={size * 0.30} duration={3800} size={3} />
        <SwirlingSparkle angle={80} radius={size * 0.28} duration={4000} size={4} />

        <SwirlingSparkle angle={120} radius={size * 0.38} duration={4500} size={6} />
        <SwirlingSparkle angle={140} radius={size * 0.36} duration={4700} size={4} />
        <SwirlingSparkle angle={160} radius={size * 0.34} duration={4900} size={5} />
        <SwirlingSparkle angle={180} radius={size * 0.32} duration={5100} size={3.5} />
        <SwirlingSparkle angle={200} radius={size * 0.30} duration={5300} size={4.5} />

        <SwirlingSparkle angle={240} radius={size * 0.42} duration={5500} size={4} />
        <SwirlingSparkle angle={260} radius={size * 0.40} duration={5700} size={5.5} />
        <SwirlingSparkle angle={280} radius={size * 0.38} duration={5900} size={3} />
        <SwirlingSparkle angle={300} radius={size * 0.36} duration={6100} size={4.5} />
        <SwirlingSparkle angle={320} radius={size * 0.34} duration={6300} size={5} />

        {/* Inner high-speed stardust core */}
        <SwirlingSparkle angle={15} radius={size * 0.18} duration={2200} size={4} />
        <SwirlingSparkle angle={135} radius={size * 0.15} duration={2600} size={3.5} />
        <SwirlingSparkle angle={255} radius={size * 0.12} duration={2800} size={4.5} />

        <GlassSpecularShine size={size} />

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

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 157, 47, 0.1)',
    shadowColor: '#FF9D2F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 54,
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 200, 100, 0.35)',
    backgroundColor: 'rgba(28, 16, 6, 0.45)',
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
    borderWidth: 2.5,
    borderColor: 'transparent',
    borderTopColor: '#FFD27A',
    borderRightColor: 'rgba(255, 210, 122, 0.4)',
    borderLeftColor: 'rgba(255, 210, 122, 0.12)',
  },
  ring2: {
    borderTopColor: '#FFE9B0',
    borderRightColor: 'rgba(255, 233, 176, 0.35)',
    borderWidth: 1.5,
  },
  ring3: {
    borderTopColor: '#FF9D2F',
    borderRightColor: 'rgba(255, 157, 47, 0.45)',
    borderLeftColor: 'rgba(255, 157, 47, 0.15)',
    borderWidth: 3,
  },
  ring4: {
    borderTopColor: '#FFD27A',
    borderRightColor: 'rgba(255, 210, 122, 0.3)',
    borderWidth: 1.5,
  },
  core: {
    backgroundColor: '#FFC85E',
    shadowColor: '#FF8800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
  },
});
