import type React from 'react';
import { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ocean } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

export type OceanMode = 'default' | 'warm' | 'active' | 'success';

interface OceanBackgroundProps {
  mode?: OceanMode;
  /** Disable the stardust speck layer for screens with busy foreground Skia content. */
  showStardust?: boolean;
  children?: React.ReactNode;
}

const STARDUST = [
  { top: '15%', left: '10%', opacity: 0.7 },
  { top: '25%', left: '85%', opacity: 0.6 },
  { top: '45%', left: '70%', opacity: 0.4 },
  { top: '70%', left: '15%', opacity: 0.5 },
  { top: '80%', left: '75%', opacity: 0.3 },
] as const;

const BREATH_PERIOD_MS = 6000;

/** Per-mode aurora glow accents layered over the base ocean gradient. */
function auroraColors(mode: OceanMode): { primary: string; secondary: string } {
  switch (mode) {
    case 'warm':
      return { primary: ocean.auroraAmber, secondary: ocean.auroraTeal };
    case 'active':
      return { primary: '#22D3EE', secondary: ocean.auroraTeal };
    case 'success':
      return { primary: ocean.auroraAmber, secondary: '#67EA8E' };
    default:
      return { primary: ocean.auroraTeal, secondary: ocean.auroraAmber };
  }
}

function glowIntensity(mode: OceanMode): number {
  return mode === 'active' || mode === 'success' ? 0.1 : 0.06;
}

/**
 * Shared "midnight ocean" gradient backdrop used by all 5 main tabs and
 * onboarding, replacing the per-screen BackgroundContainer/CosmicBackground
 * treatments. Mode tints the aurora glow accents; the base gradient and
 * breathing pulse are constant across modes.
 */
export function OceanBackground({
  mode = 'default',
  showStardust = true,
  children,
}: OceanBackgroundProps): React.JSX.Element {
  const [pulse, setPulse] = useState(1);

  useEffect(() => {
    const startTime = Date.now();
    let animId: number;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const phase = (elapsed % BREATH_PERIOD_MS) / BREATH_PERIOD_MS;
      setPulse(0.85 + 0.15 * Math.sin(phase * Math.PI * 2));
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const { primary, secondary } = auroraColors(mode);
  const intensity = glowIntensity(mode);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[ocean.gradient.top, ocean.gradient.bottom] as [string, string]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.glow,
          {
            top: -H * 0.1,
            right: -W * 0.1,
            width: W * 0.6,
            height: W * 0.6,
            backgroundColor: primary,
            opacity: intensity * pulse,
          },
        ]}
      />
      <View
        style={[
          styles.glow,
          {
            bottom: -H * 0.08,
            left: -W * 0.1,
            width: W * 0.5,
            height: W * 0.5,
            backgroundColor: secondary,
            opacity: intensity * 0.6 * pulse,
          },
        ]}
      />

      {showStardust &&
        STARDUST.map((star, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count static render; index is the element identity
          <View
            key={i}
            style={[styles.star, { top: star.top, left: star.left, opacity: star.opacity }]}
          />
        ))}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050A14',
  },
  glow: {
    position: 'absolute',
    borderRadius: 9999,
  },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#EAF1F8',
  },
});
