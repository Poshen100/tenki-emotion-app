import type React from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Canvas, Circle, BlurMask } from '@shopify/react-native-skia';

export type ScanTapRingAccent = 'gold' | 'cyan';

interface ScanTapRingProps {
  onPress: () => void;
  accent: ScanTapRingAccent;
  size?: number;
  label?: string;
  disabled?: boolean;
}

const BREATH_PERIOD_MS = 3200;

// Mirrors packages/shared/src/design-tokens.ts brand spine (goldSecured / cyanActive).
const ACCENT_COLORS: Record<ScanTapRingAccent, string> = {
  gold: '#FFD46E',
  cyan: '#22D3EE',
};

/** Tappable concentric breathing rings (Skia) — a visual entry point with no progress fill. */
export function ScanTapRing({
  onPress,
  accent,
  size = 64,
  label,
  disabled = false,
}: ScanTapRingProps): React.JSX.Element {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    let animId: number;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const phase = (elapsed % BREATH_PERIOD_MS) / BREATH_PERIOD_MS;
      setPulse(Math.sin(phase * Math.PI * 2));
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const color = ACCENT_COLORS[accent];
  const center = size / 2;
  const baseRadius = size * 0.28;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.wrapper,
        { width: size, height: size, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={baseRadius + 0.06 * size * pulse} color={color} opacity={0.18}>
          <BlurMask blur={10} style="normal" />
        </Circle>
        <Circle
          cx={center}
          cy={center}
          r={baseRadius * 0.7}
          style="stroke"
          strokeWidth={2}
          color={color}
          opacity={0.5 + 0.2 * pulse}
        />
        <Circle cx={center} cy={center} r={baseRadius * 0.42} color={color} opacity={0.85} />
      </Canvas>
      {label && <Text style={[styles.label, { color }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    bottom: -20,
    fontSize: 11,
    fontWeight: '600',
  },
});
