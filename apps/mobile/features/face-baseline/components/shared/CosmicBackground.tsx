/**
 * @module face-baseline/components/CosmicBackground
 * @description Full-bleed dark cosmic backdrop with animated starfield,
 * layered nebula glows (concentric soft-falloff circles), a vertical
 * space gradient base, and a bottom vignette.
 *
 * 7 modes: deepNebula | dim | captureWarm | processing | circuit | success | faint
 *
 * Pure RN Animated + expo-linear-gradient — no Skia. The stars twinkle, the
 * nebula breathes softly, and warm modes get rising gold particles.
 * `processing` is nearly starless and heavily vignetted; `success` is warm
 * gold-tinted; `circuit` adds cyan traces flanking the center orb area.
 *
 * @version 3.2
 * @see apps/mobile/features/face-baseline/SPEC.md
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
/** Sparse subset for the nearly-starless processing mode. */
const SPARSE_STARS = STARS.filter((_, i) => i % 4 === 0);

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
    case 'faint': return 0.25;
    case 'dim': return 0.4;
    case 'processing': return 0.18;
    case 'success': return 0.45;
    default: return 0.8;
  }
}

// ─── Soft-falloff nebula glow (3 stacked concentric circles) ──
interface NebulaGlowProps {
  /** Center position of the glow, absolute in window units. */
  cx: number;
  cy: number;
  /** Radius of the brightest inner circle. */
  r: number;
  color: string;
  /** Peak (inner circle) opacity; outer rings fade from this. */
  peak: number;
}

/** Layered translucent circles approximating a radial gradient glow. */
function NebulaGlow({ cx, cy, r, color, peak }: NebulaGlowProps): React.JSX.Element {
  const rings = [
    { scale: 1, opacity: peak },
    { scale: 1.55, opacity: peak * 0.5 },
    { scale: 2.2, opacity: peak * 0.22 },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {rings.map((ring, i) => {
        const size = r * 2 * ring.scale;
        return (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count static render; index is the element identity
            key={i}
            style={{
              position: 'absolute',
              left: cx - size / 2,
              top: cy - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              opacity: ring.opacity,
            }}
          />
        );
      })}
    </View>
  );
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

// ─── Circuit traces (maturity surface) ───────────────────────
/** Cyan traces with nodes entering from both edges toward the orb area. */
function CircuitTraces(): React.JSX.Element {
  // The resonance orb sits roughly at 28% of screen height, centered.
  const orbY = H * 0.28;
  const reach = W * 0.26; // how far each trace extends inward
  const rows = [
    { y: orbY - 36, inset: 0 },
    { y: orbY, inset: 18 },
    { y: orbY + 36, inset: 0 },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count static render; index is the element identity
        <React.Fragment key={i}>
          {/* left trace + node */}
          <View style={[styles.circuitTrace, { top: row.y, left: 0, width: reach - row.inset }]} />
          <View style={[styles.circuitNode, { top: row.y - 2.5, left: reach - row.inset - 2.5 }]} />
          {/* right trace + node */}
          <View style={[styles.circuitTrace, { top: row.y, right: 0, width: reach - row.inset }]} />
          <View style={[styles.circuitNode, { top: row.y - 2.5, right: reach - row.inset - 2.5 }]} />
        </React.Fragment>
      ))}
      {/* short vertical stubs joining the outer traces */}
      <View style={[styles.circuitStub, { top: orbY - 36, left: W * 0.07 }]} />
      <View style={[styles.circuitStub, { top: orbY, right: W * 0.07 }]} />
    </View>
  );
}

// ─── Main component ──────────────────────────────────────────
export function CosmicBackground({ mode = 'deepNebula', children }: CosmicBackgroundProps): React.JSX.Element {
  const warm = isWarm(mode);
  const nebOp = nebulaOpacity(mode);

  // Nebula breathing animation (wraps all glow layers)
  const nebulaPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(nebulaPulse, {
          toValue: 0.8,
          duration: 6000,
          useNativeDriver: true,
        }),
        Animated.timing(nebulaPulse, {
          toValue: 1,
          duration: 6000,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [nebulaPulse]);

  const stars = mode === 'processing' ? SPARSE_STARS : STARS;

  return (
    <View style={styles.root}>
      {/* deep space vertical gradient base */}
      <LinearGradient
        colors={[...t.gradient.bgSpace] as [string, string]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* layered nebula glows — soft falloff via concentric circles */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: nebulaPulse }]} pointerEvents="none">
        {warm ? (
          <>
            {/* warm gold ambiance (capture / processing / success) */}
            <NebulaGlow cx={W * 0.5} cy={H * 0.42} r={W * 0.3} color="#3A2408" peak={nebOp * 0.5} />
            <NebulaGlow cx={W * 0.85} cy={H * 0.12} r={W * 0.22} color="#2A1A06" peak={nebOp * 0.4} />
            {mode === 'success' && (
              <NebulaGlow cx={W * 0.5} cy={H * 0.34} r={W * 0.34} color="#553308" peak={0.3} />
            )}
          </>
        ) : (
          <>
            {/* violet/magenta nebula wisps: top-right + bottom-left */}
            <NebulaGlow cx={W * 0.88} cy={H * 0.14} r={W * 0.3} color="#2B1A66" peak={nebOp * 0.55} />
            <NebulaGlow cx={W * 0.78} cy={H * 0.06} r={W * 0.18} color="#4A1E66" peak={nebOp * 0.4} />
            <NebulaGlow cx={W * 0.08} cy={H * 0.86} r={W * 0.28} color="#1E1450" peak={nebOp * 0.5} />
            {/* faint cyan aurora — ACTIVE world accent */}
            <NebulaGlow cx={W * 0.2} cy={H * 0.3} r={W * 0.24} color="#06303A" peak={nebOp * 0.3} />
          </>
        )}
      </Animated.View>

      {/* circuit traces for the maturity surface */}
      {mode === 'circuit' && <CircuitTraces />}

      {/* animated starfield */}
      {stars.map((star, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count static render; index is the element identity
        <AnimatedStar key={i} star={star} />
      ))}

      {/* gold particles drifting upward (warm modes) */}
      {warm && GOLD_PARTICLES.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count static render; index is the element identity
        <GoldParticle key={i} p={p} />
      ))}

      {/* bottom vignette */}
      <LinearGradient
        colors={[...t.gradient.vignette] as [string, string]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.vignette, mode === 'processing' && styles.vignetteDeep]}
        pointerEvents="none"
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.color.bg.deepSpace, overflow: 'hidden' },

  // ─── Vignette ───────────────────────
  vignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: H * 0.38,
  },
  vignetteDeep: { height: H * 0.6, opacity: 1.0 },

  // ─── Circuit traces (maturity) ──────
  circuitTrace: {
    position: 'absolute',
    height: 1,
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.22,
  },
  circuitNode: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.45,
  },
  circuitStub: {
    position: 'absolute',
    width: 1,
    height: 36,
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.14,
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
