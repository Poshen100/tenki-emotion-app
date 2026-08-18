/**
 * @module face-baseline/components/SoulParticleMesh
 * @description Gold stardust mesh over the face — "your living signal".
 *
 * Pure RN Animated on purpose: no Skia, so it renders in Expo Go and on web
 * without a development build, which is what makes the scan ritual something
 * that can be felt today rather than after a native toolchain exists.
 *
 * The mesh does not decide how it should look. It animates toward a
 * {@link SensoryFrame} produced by `utils/choreography.ts`, so the rules
 * governing convergence, scatter and glow live in one tested place instead of
 * being scattered across components.
 *
 * @version 3.2
 * @see apps/mobile/features/face-baseline/utils/choreography.ts
 */
import type React from 'react';
import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import type { SensoryFrame } from '../../utils/choreography';

interface SoulParticleMeshProps {
  /**
   * Target values from the choreography engine. Preferred over `stability`.
   */
  frame?: SensoryFrame;
  /**
   * Legacy single-value driver, kept so existing screens keep working. When
   * `frame` is absent one is derived from this.
   */
  stability?: number;
  size?: number;
  /**
   * Stops the ambient drift and breathing loops. The mesh still shows state
   * through position and opacity — motion is removed, information is not.
   */
  reducedMotion?: boolean;
}

/** Builds a frame from the legacy `stability` prop so old call sites behave as before. */
function frameFromStability(stability: number): SensoryFrame {
  const s = Math.min(1, Math.max(0, stability));
  return {
    convergence: s,
    scatter: 1 - s,
    brightness: 0.65 + s * 0.35,
    glow: s,
    transitionMs: 400,
  };
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
  frame,
  containerSize,
  reducedMotion,
}: {
  speck: SpeckDef;
  frame: SensoryFrame;
  containerSize: number;
  reducedMotion: boolean;
}): React.JSX.Element {
  // Drift/wobble animation
  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Reduced motion stops the ambient life entirely — no drift, no breathing.
    // State still reads through position and opacity below.
    if (reducedMotion) return;

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
  }, [driftX, driftY, pulse, speck, reducedMotion]);

  // Displacement is the choreography's scatter, damped by its convergence:
  // dispersing on poor quality and drawing back in as the capture settles are
  // two separate forces rather than one inverted number.
  const displacement = frame.scatter * (1 - frame.convergence * 0.6);
  const scatterX = speck.offsetX * displacement;
  const scatterY = speck.offsetY * displacement;

  const transitionX = useRef(new Animated.Value(scatterX)).current;
  const transitionY = useRef(new Animated.Value(scatterY)).current;

  useEffect(() => {
    // A shorter transitionMs means a tighter spring, so the phase's own sense
    // of urgency carries into how the particles physically move.
    const tension = Math.round(120000 / Math.max(120, frame.transitionMs));
    const config = { friction: 7, tension, useNativeDriver: true };

    Animated.spring(transitionX, { ...config, toValue: scatterX }).start();
    Animated.spring(transitionY, { ...config, toValue: scatterY }).start();
  }, [scatterX, scatterY, transitionX, transitionY, frame.transitionMs]);

  // Brightness sets the band the breathing pulse swings within. With reduced
  // motion the pulse never animates, so this settles at a steady value that
  // still encodes brightness.
  const opacity = pulse.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0.25 + frame.brightness * 0.3, 0.55 + frame.brightness * 0.45],
  });

  const posX = (speck.leftPercent / 100) * containerSize;
  const posY = (speck.topPercent / 100) * containerSize;

  const isGold = speck.color === 'gold';
  const dotColor = isGold ? '#FFC85E' : '#00F0FF';
  const glowColor = isGold ? '#FF8800' : '#00F0FF';
  // Halo grows with the frame's glow so a locked state reads as crystallised
  // rather than merely brighter.
  const shadowRadius = 3 + frame.glow * 6;

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
          shadowRadius,
          transform: [
            { translateX: Animated.add(driftX, transitionX) },
            { translateY: Animated.add(driftY, transitionY) },
          ],
        },
      ]}
    />
  );
}

export function SoulParticleMesh({
  frame,
  stability = 0.6,
  size = 200,
  reducedMotion = false,
}: SoulParticleMeshProps): React.JSX.Element {
  const resolved = frame ?? frameFromStability(stability);

  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      {SPECKS.map((speck, i) => (
        <AnimatedSpeck
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count static render; index is the element identity
          key={i}
          speck={speck}
          frame={resolved}
          containerSize={size}
          reducedMotion={reducedMotion}
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
    elevation: 4,
  },
});
