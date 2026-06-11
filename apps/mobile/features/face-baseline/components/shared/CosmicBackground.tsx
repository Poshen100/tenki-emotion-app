/**
 * @module face-baseline/components/CosmicBackground
 * @description Full-bleed dark cosmic backdrop, mode-driven per screen.
 * Core-RN implementation (View-based nebula glows + stardust) that matches the
 * reference frames. The soft glows here are placeholders for a richer Skia
 * nebula — keep the same colors/positions when upgrading.
 *
 * INTEGRATION (Skia): replace the gradient/aurora Views with a Skia shader for
 * true nebula depth + parallax star drift. Preserve `mode` semantics.
 */
import type React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { faceBaselineTokens as t } from '../../tokens/faceBaseline.tokens';

const { width, height } = Dimensions.get('window');

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

const STAR_POSITIONS: ReadonlyArray<{ top: string; left: string; opacity: number }> = [
  { top: '12%', left: '14%', opacity: 0.7 },
  { top: '22%', left: '82%', opacity: 0.5 },
  { top: '38%', left: '68%', opacity: 0.4 },
  { top: '48%', left: '22%', opacity: 0.55 },
  { top: '66%', left: '78%', opacity: 0.35 },
  { top: '74%', left: '18%', opacity: 0.5 },
  { top: '84%', left: '60%', opacity: 0.3 },
];

/** Whether the warm (gold) accent layer is visible for a mode. */
function isWarm(mode: CosmicMode): boolean {
  return mode === 'captureWarm' || mode === 'processing' || mode === 'success';
}

export function CosmicBackground({ mode = 'deepNebula', children }: CosmicBackgroundProps): React.JSX.Element {
  const dim = mode === 'dim' || mode === 'faint';
  const nebulaOpacity = mode === 'faint' ? 0.25 : dim ? 0.4 : 0.7;

  return (
    <View style={styles.root}>
      {/* deep space base */}
      <View style={styles.base} />
      {/* violet nebula wash (top) */}
      <View style={[styles.nebula, { opacity: nebulaOpacity }]} />
      {/* cyan aurora — the ACTIVE accent */}
      {!isWarm(mode) && <View style={styles.cyanAurora} />}
      {/* gold vignette — the SECURED accent */}
      {isWarm(mode) && <View style={styles.goldVignette} />}
      {/* circuit traces for the maturity surface */}
      {mode === 'circuit' && <View style={styles.circuit} />}
      {/* stardust */}
      {STAR_POSITIONS.map((s) => (
        <View key={`${s.top}-${s.left}`} style={[styles.star, { top: s.top as never, left: s.left as never, opacity: s.opacity }]} />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.color.bg.deepSpace },
  base: { ...StyleSheet.absoluteFillObject, backgroundColor: t.color.bg.deepSpace },
  nebula: {
    position: 'absolute',
    top: -height * 0.12,
    left: -width * 0.15,
    width: width * 1.3,
    height: height * 0.6,
    borderRadius: 9999,
    backgroundColor: t.color.bg.nebulaTop,
  },
  cyanAurora: {
    position: 'absolute',
    top: -height * 0.08,
    right: -width * 0.18,
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 9999,
    backgroundColor: t.color.accent.cyanGlow,
    opacity: 0.06,
  },
  goldVignette: {
    position: 'absolute',
    bottom: -height * 0.06,
    left: -width * 0.12,
    width: width * 1.2,
    height: width * 0.9,
    borderRadius: 9999,
    backgroundColor: t.color.accent.goldResonance,
    opacity: 0.05,
  },
  circuit: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
    borderColor: t.color.accent.cyanGlow,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: t.color.text.primary,
  },
});
