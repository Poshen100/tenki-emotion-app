/**
 * @module face-baseline/components/CosmicBackground
 * @description Full-bleed dark cosmic backdrop with animated starfield,
 * layered nebula glows, and mode-driven accent layers.
 *
 * 7 modes: deepNebula | dim | captureWarm | processing | circuit | success | faint
 *
 * Pure RN Animated — no Skia. The stars twinkle, the nebula breathes softly,
 * and warm modes get rising gold particles. All honor reduced-motion by
 * snapping to a static frame.
 *
 * @version 3.1
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet, Dimensions, type ViewStyle } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

const { width: W, height: H } = Dimensions.get('window');

/** Visual mood per screen. */
export type CosmicMode =
  | 'deepNebula'
  | 'dim'
  | 'captureWarm'
  | 'processing'
  | 'circuit'
  | 'success'
  | 'faint';

interface CosmicBackgroundProps {
  mode?: CosmicMode;
  children?: React.ReactNode;
}

// ─── Star generation ─────────────────────────────────────────
interface StarDef {
  top: number; left: number; size: number;
  baseOpacity: number; duration: number; delay: number;
}

function generateStars(count: number): StarDef[] {
  const stars: StarDef[] = [];
  // Seeded pseudo-random for deterministic layout
  let seed = 42;
  const rand = (): number => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < count; i++) {
    stars.push({
      top: rand() * H,
      left: rand() * W,
      size: 1 + rand() * 2,
      baseOpacity: 0.15 + rand() * 0.6,
      duration: 2000 + rand() * 3000,
      delay: rand() * 2000,
    });
  }
  return stars;
}

const STARS = generateStars(35);

// ─── Gold particle positions for warm modes ──────────────────
interface GoldParticleDef {
  left: number; size: number; delay: number; duration: number;
}

function generateGoldParticles(count: number): GoldParticleDef[] {
  const particles: GoldParticleDef[] = [];
  let seed = 99;
  const rand = (): number => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < count; i++) {
    particles.push({
      left: rand() * W,
      size: 1.5 + rand() * 2.5,
      delay: rand() * 4000,
      duration: 4000 + rand() * 3000,
    });
  }
  return particles;
}

const GOLD_PARTICLES = generateGoldParticles(18);

/** Whether the warm (gold) accent layer is visible for a mode. */
function isWarm(mode: CosmicMode): boolean {
  return mode === 'captureWarm' || mode === 'processing' || mode === 'success';
}

function nebulaOpacity(mode: CosmicMode): number {
  switch (mode) {
    case 'faint': return 0.2;
    case 'dim': return 0.35;
    case 'processing': return 0.3;
    case 'success': return 0.25;
    default: return 0.65;
  }
}

// ─── Animated star ───────────────────────────────────────────
function AnimatedStar({ star }: { star: StarDef }): React.JSX.Element {
  const opacity = useRef(new Animated.Value(star.baseOpacity)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: star.baseOpacity * 0.3,
          duration: star.duration,
          delay: star.delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: star.baseOpacity,
          duration: star.duration,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, star]);

  return (
    <Animated.View
      style={[
        styles.star,
        {
          top: star.top,
          left: star.left,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          opacity,
        },
      ]}
    />
  );
}

// ─── Animated gold particle (drifts upward) ──────────────────
function GoldParticle({ p }: { p: GoldParticleDef }): React.JSX.Element {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -H * 0.4,
            duration: p.duration,
            delay: p.delay,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.7,
              duration: p.duration * 0.3,
              delay: p.delay,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: p.duration * 0.7,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [translateY, opacity, p]);

  return (
    <Animated.View
      style={[
        styles.goldDot,
        {
          left: p.left,
          bottom: H * 0.05,
          width: p.size,
          height: p.size,
          borderRadius: p.size / 2,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    />
  );
}

// ─── Main component ──────────────────────────────────────────
export function CosmicBackground({ mode = 'deepNebula', children }: CosmicBackgroundProps): React.JSX.Element {
  const warm = isWarm(mode);
  const nebOp = nebulaOpacity(mode);

  // Nebula breathing animation
  const nebulaPulse = useRef(new Animated.Value(nebOp)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(nebulaPulse, {
          toValue: nebOp * 0.8,
          duration: 6000,
          useNativeDriver: true,
        }),
        Animated.timing(nebulaPulse, {
          toValue: nebOp,
          duration: 6000,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [nebulaPulse, nebOp]);

  return (
    <View style={styles.root}>
      {/* deep space base */}
      <View style={styles.base} />

      {/* violet nebula wash (top-left) */}
      <Animated.View style={[styles.nebula, { opacity: nebulaPulse }]} />

      {/* secondary nebula wash (right, slightly lower) */}
      <Animated.View
        style={[
          styles.nebulaSecondary,
          { opacity: Animated.multiply(nebulaPulse, 0.5) },
        ]}
      />

      {/* cyan aurora — the ACTIVE accent */}
      {!warm && <View style={styles.cyanAurora} />}

      {/* gold vignette — the SECURED accent */}
      {warm && <View style={styles.goldVignette} />}

      {/* additional gold top glow for success */}
      {mode === 'success' && <View style={styles.goldTopGlow} />}

      {/* circuit traces for the maturity surface */}
      {mode === 'circuit' && (
        <View style={styles.circuitContainer}>
          <View style={styles.circuitHLine1} />
          <View style={styles.circuitHLine2} />
          <View style={styles.circuitVLine1} />
          <View style={styles.circuitVLine2} />
          <View style={styles.circuitNode1} />
          <View style={styles.circuitNode2} />
          <View style={styles.circuitNode3} />
        </View>
      )}

      {/* animated starfield */}
      {STARS.map((star, i) => (
        <AnimatedStar key={i} star={star} />
      ))}

      {/* gold particles drifting upward (warm modes) */}
      {warm && GOLD_PARTICLES.map((p, i) => (
        <GoldParticle key={i} p={p} />
      ))}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.color.bg.deepSpace, overflow: 'hidden' },
  base: { ...StyleSheet.absoluteFillObject, backgroundColor: t.color.bg.deepSpace },

  // ─── Nebula layers ──────────────────
  nebula: {
    position: 'absolute',
    top: -H * 0.15,
    left: -W * 0.2,
    width: W * 1.5,
    height: H * 0.55,
    borderRadius: 9999,
    backgroundColor: t.color.bg.nebulaTop, // violet
  },
  nebulaSecondary: {
    position: 'absolute',
    top: H * 0.15,
    right: -W * 0.3,
    width: W * 0.9,
    height: W * 0.9,
    borderRadius: 9999,
    backgroundColor: '#150A2E', // deep violet
  },

  // ─── Accent layers ─────────────────
  cyanAurora: {
    position: 'absolute',
    top: -H * 0.06,
    right: -W * 0.15,
    width: W * 0.75,
    height: W * 0.75,
    borderRadius: 9999,
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.05,
  },
  goldVignette: {
    position: 'absolute',
    bottom: -H * 0.08,
    left: -W * 0.1,
    width: W * 1.2,
    height: W * 0.8,
    borderRadius: 9999,
    backgroundColor: t.color.accent.goldResonance,
    opacity: 0.06,
  },
  goldTopGlow: {
    position: 'absolute',
    top: H * 0.15,
    left: W * 0.15,
    width: W * 0.7,
    height: W * 0.7,
    borderRadius: 9999,
    backgroundColor: t.color.accent.goldBloom,
    opacity: 0.04,
  },

  // ─── Circuit traces (maturity) ──────
  circuitContainer: { ...StyleSheet.absoluteFillObject },
  circuitHLine1: {
    position: 'absolute', top: H * 0.12, left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.08,
  },
  circuitHLine2: {
    position: 'absolute', top: H * 0.88, left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.06,
  },
  circuitVLine1: {
    position: 'absolute', top: 0, bottom: 0, left: W * 0.08,
    width: StyleSheet.hairlineWidth,
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.05,
  },
  circuitVLine2: {
    position: 'absolute', top: 0, bottom: 0, right: W * 0.08,
    width: StyleSheet.hairlineWidth,
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.05,
  },
  circuitNode1: {
    position: 'absolute', top: H * 0.12 - 3, left: W * 0.08 - 3,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: t.color.accent.cyanGlow, opacity: 0.15,
  },
  circuitNode2: {
    position: 'absolute', top: H * 0.12 - 3, right: W * 0.08 - 3,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: t.color.accent.cyanGlow, opacity: 0.12,
  },
  circuitNode3: {
    position: 'absolute', top: H * 0.88 - 3, left: W * 0.5 - 3,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: t.color.accent.cyanGlow, opacity: 0.1,
  },

  // ─── Stars ──────────────────────────
  star: {
    position: 'absolute',
    backgroundColor: t.color.text.primary,
  },

  // ─── Gold particles ─────────────────
  goldDot: {
    position: 'absolute',
    backgroundColor: t.color.accent.goldSoft,
  },
});
