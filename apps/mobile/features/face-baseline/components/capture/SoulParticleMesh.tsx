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
import type React from 'react';
import { useEffect, useRef } from 'react';
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
  color: 'cyan' | 'gold';
  size: number;
}

// Mapped face landmarks for a dense, high-fidelity stardust projection
const SPECKS: SpeckDef[] = [
  // Eyebrows (Left Arc)
  { topPercent: 18, leftPercent: 26, offsetX: -8, offsetY: -6, pulseDuration: 1500, pulseDelay: 100, color: 'cyan', size: 3 },
  { topPercent: 16, leftPercent: 33, offsetX: -4, offsetY: -8, pulseDuration: 1800, pulseDelay: 300, color: 'cyan', size: 2 },
  { topPercent: 17, leftPercent: 41, offsetX: 0, offsetY: -7, pulseDuration: 1600, pulseDelay: 200, color: 'gold', size: 3.5 },

  // Eyebrows (Right Arc)
  { topPercent: 17, leftPercent: 59, offsetX: 0, offsetY: -7, pulseDuration: 1700, pulseDelay: 150, color: 'gold', size: 3.5 },
  { topPercent: 16, leftPercent: 67, offsetX: 4, offsetY: -8, pulseDuration: 1900, pulseDelay: 400, color: 'cyan', size: 2 },
  { topPercent: 18, leftPercent: 74, offsetX: 8, offsetY: -6, pulseDuration: 1500, pulseDelay: 50, color: 'cyan', size: 3 },

  // Forehead Center
  { topPercent: 10, leftPercent: 50, offsetX: 0, offsetY: -12, pulseDuration: 2200, pulseDelay: 500, color: 'cyan', size: 2 },
  { topPercent: 12, leftPercent: 43, offsetX: -6, offsetY: -10, pulseDuration: 2400, pulseDelay: 700, color: 'gold', size: 1.5 },
  { topPercent: 12, leftPercent: 57, offsetX: 6, offsetY: -10, pulseDuration: 2000, pulseDelay: 600, color: 'gold', size: 1.5 },

  // Left Eye Ring
  { topPercent: 28, leftPercent: 28, offsetX: -10, offsetY: -2, pulseDuration: 2100, pulseDelay: 100, color: 'cyan', size: 2.5 },
  { topPercent: 26, leftPercent: 35, offsetX: -5, offsetY: -4, pulseDuration: 1900, pulseDelay: 250, color: 'cyan', size: 1.5 },
  { topPercent: 28, leftPercent: 42, offsetX: 0, offsetY: -2, pulseDuration: 2300, pulseDelay: 400, color: 'gold', size: 2.5 },
  { topPercent: 32, leftPercent: 35, offsetX: -5, offsetY: 3, pulseDuration: 2500, pulseDelay: 150, color: 'cyan', size: 2 },

  // Right Eye Ring
  { topPercent: 28, leftPercent: 58, offsetX: 0, offsetY: -2, pulseDuration: 2400, pulseDelay: 350, color: 'gold', size: 2.5 },
  { topPercent: 26, leftPercent: 65, offsetX: 5, offsetY: -4, pulseDuration: 2000, pulseDelay: 200, color: 'cyan', size: 1.5 },
  { topPercent: 28, leftPercent: 72, offsetX: 10, offsetY: -2, pulseDuration: 2200, pulseDelay: 50, color: 'cyan', size: 2.5 },
  { topPercent: 32, leftPercent: 65, offsetX: 5, offsetY: 3, pulseDuration: 2600, pulseDelay: 300, color: 'cyan', size: 2 },

  // Nose Bridge & Tip
  { topPercent: 27, leftPercent: 50, offsetX: 0, offsetY: -5, pulseDuration: 1800, pulseDelay: 500, color: 'cyan', size: 2 },
  { topPercent: 36, leftPercent: 50, offsetX: 0, offsetY: -3, pulseDuration: 1900, pulseDelay: 600, color: 'gold', size: 3 },
  { topPercent: 44, leftPercent: 50, offsetX: 0, offsetY: 0, pulseDuration: 2100, pulseDelay: 400, color: 'gold', size: 4 },
  { topPercent: 48, leftPercent: 46, offsetX: -4, offsetY: 2, pulseDuration: 2000, pulseDelay: 200, color: 'cyan', size: 2.5 },
  { topPercent: 48, leftPercent: 54, offsetX: 4, offsetY: 2, pulseDuration: 2200, pulseDelay: 350, color: 'cyan', size: 2.5 },

  // Left Cheek Contour
  { topPercent: 42, leftPercent: 20, offsetX: -16, offsetY: 4, pulseDuration: 2700, pulseDelay: 800, color: 'cyan', size: 3.5 },
  { topPercent: 46, leftPercent: 28, offsetX: -12, offsetY: 6, pulseDuration: 2500, pulseDelay: 600, color: 'gold', size: 2.5 },
  { topPercent: 54, leftPercent: 24, offsetX: -14, offsetY: 8, pulseDuration: 2900, pulseDelay: 700, color: 'cyan', size: 3 },

  // Right Cheek Contour
  { topPercent: 42, leftPercent: 80, offsetX: 16, offsetY: 4, pulseDuration: 2800, pulseDelay: 850, color: 'cyan', size: 3.5 },
  { topPercent: 46, leftPercent: 72, offsetX: 12, offsetY: 6, pulseDuration: 2600, pulseDelay: 650, color: 'gold', size: 2.5 },
  { topPercent: 54, leftPercent: 76, offsetX: 14, offsetY: 8, pulseDuration: 3000, pulseDelay: 750, color: 'cyan', size: 3 },

  // Mouth & Lips Outline
  { topPercent: 60, leftPercent: 40, offsetX: -6, offsetY: 4, pulseDuration: 1800, pulseDelay: 100, color: 'cyan', size: 2 },
  { topPercent: 58, leftPercent: 50, offsetX: 0, offsetY: 2, pulseDuration: 1900, pulseDelay: 200, color: 'gold', size: 3.5 },
  { topPercent: 60, leftPercent: 60, offsetX: 6, offsetY: 4, pulseDuration: 1700, pulseDelay: 150, color: 'cyan', size: 2 },
  { topPercent: 66, leftPercent: 42, offsetX: -5, offsetY: 8, pulseDuration: 2300, pulseDelay: 450, color: 'cyan', size: 2.5 },
  { topPercent: 68, leftPercent: 50, offsetX: 0, offsetY: 10, pulseDuration: 2500, pulseDelay: 500, color: 'gold', size: 3.5 },
  { topPercent: 66, leftPercent: 58, offsetX: 5, offsetY: 8, pulseDuration: 2200, pulseDelay: 400, color: 'cyan', size: 2.5 },

  // Jawline & Chin base
  { topPercent: 74, leftPercent: 30, offsetX: -12, offsetY: 12, pulseDuration: 2600, pulseDelay: 900, color: 'cyan', size: 3 },
  { topPercent: 80, leftPercent: 40, offsetX: -6, offsetY: 16, pulseDuration: 2800, pulseDelay: 1000, color: 'gold', size: 2.5 },
  { topPercent: 83, leftPercent: 50, offsetX: 0, offsetY: 20, pulseDuration: 3000, pulseDelay: 1100, color: 'gold', size: 4 },
  { topPercent: 80, leftPercent: 60, offsetX: 6, offsetY: 16, pulseDuration: 2700, pulseDelay: 950, color: 'gold', size: 2.5 },
  { topPercent: 74, leftPercent: 70, offsetX: 12, offsetY: 12, pulseDuration: 2500, pulseDelay: 850, color: 'cyan', size: 3 },

  // Face outer temples
  { topPercent: 22, leftPercent: 16, offsetX: -15, offsetY: -4, pulseDuration: 2900, pulseDelay: 900, color: 'cyan', size: 2 },
  { topPercent: 22, leftPercent: 84, offsetX: 15, offsetY: -4, pulseDuration: 2800, pulseDelay: 950, color: 'cyan', size: 2 },
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
    outputRange: [0.3 + stability * 0.2, 0.65 + stability * 0.35],
  });

  const posX = (speck.leftPercent / 100) * containerSize;
  const posY = (speck.topPercent / 100) * containerSize;

  const isGold = speck.color === 'gold';
  const dotColor = isGold ? '#FFC85E' : '#00F0FF';
  const glowColor = isGold ? '#FF8800' : '#00F0FF';

  return (
    <Animated.View
      style={[
        styles.speck,
        {
          left: posX,
          top: posY,
          opacity,
          width: speck.size,
          height: speck.size,
          borderRadius: speck.size / 2,
          backgroundColor: dotColor,
          shadowColor: glowColor,
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
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count static render; index is the element identity
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 6,
    elevation: 4,
  },
});
