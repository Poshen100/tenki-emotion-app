/**
 * @module face-baseline/components/SoulParticleMesh
 * @description Gold stardust mesh over the face — "your living signal".
 *
 * Pure RN Animated: generates a mesh of floating golden stardust particles
 * that pulse, drift, and converge closer to their centers as stability rises,
 * scattering slightly when stability drops.
 *
 * @version 3.1
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

interface SoulParticleMeshProps {
  /** 0–1: higher = more crystallized/brighter. */
  stability?: number;
  size?: number;
}

interface SpeckDef {
  topPercent: number;
  leftPercent: number;
  offsetX: number; // random scatter range
  offsetY: number;
  pulseDuration: number;
  pulseDelay: number;
}

// Deterministic particle set matching general face contours
const SPECKS: SpeckDef[] = [
  // Eyebrows/Forehead area
  { topPercent: 20, leftPercent: 32, offsetX: -10, offsetY: -5, pulseDuration: 1800, pulseDelay: 100 },
  { topPercent: 18, leftPercent: 50, offsetX: 0, offsetY: -12, pulseDuration: 2200, pulseDelay: 400 },
  { topPercent: 20, leftPercent: 68, offsetX: 10, offsetY: -5, pulseDuration: 1900, pulseDelay: 200 },
  // Eyes/Cheeks area
  { topPercent: 35, leftPercent: 24, offsetX: -15, offsetY: 0, pulseDuration: 2500, pulseDelay: 600 },
  { topPercent: 38, leftPercent: 44, offsetX: -5, offsetY: 2, pulseDuration: 1700, pulseDelay: 0 },
  { topPercent: 38, leftPercent: 56, offsetX: 5, offsetY: 2, pulseDuration: 2100, pulseDelay: 300 },
  { topPercent: 35, leftPercent: 76, offsetX: 15, offsetY: 0, pulseDuration: 2400, pulseDelay: 700 },
  // Nose ridge
  { topPercent: 48, leftPercent: 50, offsetX: 0, offsetY: -5, pulseDuration: 2000, pulseDelay: 150 },
  // Mouth/Jaw area
  { topPercent: 62, leftPercent: 32, offsetX: -12, offsetY: 8, pulseDuration: 2300, pulseDelay: 500 },
  { topPercent: 68, leftPercent: 50, offsetX: 0, offsetY: 15, pulseDuration: 2600, pulseDelay: 850 },
  { topPercent: 62, leftPercent: 68, offsetX: 12, offsetY: 8, pulseDuration: 2000, pulseDelay: 100 },
  // Outer perimeter cheeks
  { topPercent: 50, leftPercent: 20, offsetX: -20, offsetY: 5, pulseDuration: 2800, pulseDelay: 900 },
  { topPercent: 50, leftPercent: 80, offsetX: 20, offsetY: 5, pulseDuration: 2700, pulseDelay: 1000 },
];

function AnimatedSpeck({
  speck,
  stability,
  containerSize,
}: {
  speck: SpeckDef;
  stability: number;
  containerSize: number;
}): React.JSX.Element {
  // Drift/wobble animation
  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Continuous random drift loop
    const createDrift = (anim: Animated.Value, max: number) => {
      const run = () => {
        const target = (Math.random() - 0.5) * max;
        Animated.timing(anim, {
          toValue: target,
          duration: 1500 + Math.random() * 1500,
          useNativeDriver: true,
        }).start(() => run());
      };
      run();
    };

    createDrift(driftX, 8);
    createDrift(driftY, 8);

    // Opacity pulse loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: speck.pulseDuration / 2,
          delay: speck.pulseDelay,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: speck.pulseDuration / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    return () => {
      driftX.stopAnimation();
      driftY.stopAnimation();
      pulseLoop.stop();
    };
  }, [driftX, driftY, pulse, speck]);

  // Scatter/Converge animation based on stability
  // As stability approaches 1, the scatter displacement decreases (converging onto grid)
  const stabilityFactor = 1 - stability; // 1 = fully scattered, 0 = fully converged
  const scatterX = speck.offsetX * stabilityFactor;
  const scatterY = speck.offsetY * stabilityFactor;

  // Animate the scatter transition
  const transitionX = useRef(new Animated.Value(scatterX)).current;
  const transitionY = useRef(new Animated.Value(scatterY)).current;

  useEffect(() => {
    Animated.spring(transitionX, {
      toValue: scatterX,
      friction: 7,
      useNativeDriver: true,
    }).start();
    Animated.spring(transitionY, {
      toValue: scatterY,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [scatterX, scatterY, transitionX, transitionY]);

  // Opacity derived from overall stability + internal breathing pulse
  const opacity = pulse.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0.2 + stability * 0.2, 0.5 + stability * 0.45],
  });

  const posX = (speck.leftPercent / 100) * containerSize;
  const posY = (speck.topPercent / 100) * containerSize;

  return (
    <Animated.View
      style={[
        styles.speck,
        {
          left: posX,
          top: posY,
          opacity,
          transform: [
            { translateX: Animated.add(driftX, transitionX) },
            { translateY: Animated.add(driftY, transitionY) },
          ],
        },
      ]}
    />
  );
}

export function SoulParticleMesh({ stability = 0.6, size = 200 }: SoulParticleMeshProps): React.JSX.Element {
  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      {SPECKS.map((speck, i) => (
        <AnimatedSpeck
          key={i}
          speck={speck}
          stability={stability}
          containerSize={size}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', overflow: 'visible' },
  speck: {
    position: 'absolute',
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: t.color.accent.goldSoft,
    shadowColor: t.color.accent.goldBloom,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
});
